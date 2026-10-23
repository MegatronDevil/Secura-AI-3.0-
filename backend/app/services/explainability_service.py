import io
import base64
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F

from app.services.ai_image_detector import get_ai_image_detector

logger = logging.getLogger(__name__)


def generate_saliency_heatmap(
    image: Image.Image,
    alpha: float = 0.55
) -> Dict[str, Any]:
    """
    Computes explainability X-Ray spatial attribution heatmap for an image.
    Uses Swin transformer spatial tokens projected through the trained classifier linear head
    to calculate per-region synthetic vs. natural evidence without modifying model weights.
    Returns base64 PNG heatmap, peak anomaly coordinates, and attribution metrics.
    """
    orig_w, orig_h = image.size
    detector = get_ai_image_detector()
    
    # 1. Fallback if Swin is unavailable: spatial frequency variance map
    if not detector.swin_loaded or detector.swin_model is None or detector.swin_processor is None:
        return _generate_frequency_fallback_heatmap(image, alpha)

    try:
        rgb_img = image.convert("RGB")
        inputs = detector.swin_processor(images=rgb_img, return_tensors="pt").to(detector.device)
        
        features_list = []
        def _hook(module, inp, outp):
            features_list.append(outp)

        hook_handle = detector.swin_model.swin.layernorm.register_forward_hook(_hook)
        with torch.no_grad():
            outputs = detector.swin_model(**inputs)
        hook_handle.remove()

        if not features_list:
            return _generate_frequency_fallback_heatmap(image, alpha)

        features = features_list[0]  # Shape: (1, 49, 1024)
        
        # Classifier weights difference: Artificial (index 0) minus Human (index 1)
        w_diff = (detector.swin_model.classifier.weight[0] - detector.swin_model.classifier.weight[1]).unsqueeze(1)
        # Spatial attribution scores across 7x7 tokens
        spatial_scores = torch.matmul(features[0], w_diff).squeeze(1).reshape(1, 1, 7, 7)
        
        # Interpolate to original image dimensions with smooth bicubic upsampling
        heatmap_tensor = F.interpolate(spatial_scores, size=(orig_h, orig_w), mode="bicubic", align_corners=False)
        raw_map = heatmap_tensor.squeeze().detach().cpu().numpy()
        
        # Normalize map to [0, 1] range for visual heat mapping
        map_min = float(raw_map.min())
        map_max = float(raw_map.max())
        denom = max(1e-6, map_max - map_min)
        norm_map = (raw_map - map_min) / denom
        norm_map = np.clip(norm_map, 0.0, 1.0)

        # 2. Convert to RGBA Turbo/Jet Colormap Overlay
        colored_overlay, anomaly_regions = _colorize_and_extract_regions(rgb_img, norm_map, alpha)

        # 3. Encode to Base64 PNG
        buf = io.BytesIO()
        colored_overlay.save(buf, format="PNG", optimize=True)
        heatmap_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

        # Global AI prediction score from model output
        diff = float(outputs.logits[0, 0] - outputs.logits[0, 1])
        calibrated_p_ai = float(1.0 / (1.0 + np.exp(-(diff - 0.65))))

        # Format top regions with bbox and relative suspicion
        top_regions = [
            {
                "bbox": c["box"],
                "relative_suspicion": c["intensity"],
                "label": f"ROI #{i+1}"
            }
            for i, c in enumerate(anomaly_regions)
        ]

        return {
            "success": True,
            "heatmap_data_url": heatmap_b64,
            "heatmap_b64": heatmap_b64,
            "overlay_b64": heatmap_b64,
            "overall_ai_score": round(calibrated_p_ai, 4),
            "peak_anomaly_density": round(float(norm_map.max()), 4),
            "max_intensity": round(float(norm_map.max()), 4),
            "min_intensity": round(float(norm_map.min()), 4),
            "mean_synthetic_activation": round(float(norm_map.mean()), 4),
            "mean_intensity": round(float(norm_map.mean()), 4),
            "anomaly_clusters": anomaly_regions,
            "top_regions": top_regions,
            "methodology": "Swin-Transformer Spatial Token Projection (Closed-Form Activation Attribution)",
            "width": orig_w,
            "height": orig_h
        }

    except Exception as exc:
        logger.warning("Explainability generation failed, falling back to spatial frequency: %s", exc)
        return _generate_frequency_fallback_heatmap(image, alpha)


def _colorize_and_extract_regions(
    orig_img: Image.Image,
    norm_map: np.ndarray,
    alpha: float
) -> Tuple[Image.Image, List[Dict[str, Any]]]:
    """Generates heat-colored overlay with alpha blending and identifies top anomalous bounding boxes."""
    h, w = norm_map.shape
    
    # Simple, high-speed custom Turbo-style colormap (Blue -> Cyan -> Green -> Yellow -> Red)
    # R, G, B channels as polynomial / piecewise approximation
    r = np.clip(1.5 * norm_map - 0.25, 0.0, 1.0)
    g = np.clip(1.0 - 2.0 * np.abs(norm_map - 0.5), 0.0, 1.0)
    b = np.clip(1.0 - 1.5 * norm_map, 0.0, 1.0)
    
    heatmap_rgb = np.stack([r * 255, g * 255, b * 255], axis=-1).astype(np.uint8)
    heatmap_pil = Image.fromarray(heatmap_rgb).convert("RGBA")
    
    # Create soft transparency mask based on intensity (low intensity = more transparent)
    alpha_channel = (norm_map * (alpha * 255)).astype(np.uint8)
    heatmap_pil.putalpha(Image.fromarray(alpha_channel))
    
    # Composite overlay on original image
    base = orig_img.convert("RGBA")
    composite = Image.alpha_composite(base, heatmap_pil)

    # Detect top anomalous bounding boxes (grid cells with high activation)
    step_y = max(1, h // 4)
    step_x = max(1, w // 4)
    clusters = []
    
    for y in range(0, h - step_y + 1, step_y):
        for x in range(0, w - step_x + 1, step_x):
            sub = norm_map[y:y+step_y, x:x+step_x]
            score = float(sub.mean())
            if score >= 0.70:
                clusters.append({
                    "box": [round(x / w, 3), round(y / h, 3), round((x + step_x) / w, 3), round((y + step_y) / h, 3)],
                    "intensity": round(score, 3),
                    "description": "High synthetic artifact density (unnatural micro-texture / boundary blur)"
                })

    # Sort descending by intensity
    clusters.sort(key=lambda c: c["intensity"], reverse=True)
    return composite, clusters[:5]


def _generate_frequency_fallback_heatmap(image: Image.Image, alpha: float) -> Dict[str, Any]:
    """Fallback Laplacian frequency residual heatmap when deep models are uninitialized."""
    orig_w, orig_h = image.size
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    # Simple Laplacian filter approximation
    padded = np.pad(gray, ((1, 1), (1, 1)), mode="reflect")
    lap = np.abs(padded[1:-1, 2:] + padded[1:-1, :-2] + padded[2:, 1:-1] + padded[:-2, 1:-1] - 4 * gray)
    norm_map = (lap - lap.min()) / max(1e-6, lap.max() - lap.min())
    norm_map = np.clip(norm_map, 0.0, 1.0)
    
    colored_overlay, clusters = _colorize_and_extract_regions(image.convert("RGB"), norm_map, alpha)
    buf = io.BytesIO()
    colored_overlay.save(buf, format="PNG")
    b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    
    top_regions = [
        {
            "bbox": c["box"],
            "relative_suspicion": c["intensity"],
            "label": f"ROI #{i+1}"
        }
        for i, c in enumerate(clusters)
    ]

    return {
        "success": True,
        "heatmap_data_url": b64,
        "heatmap_b64": b64,
        "overlay_b64": b64,
        "overall_ai_score": 0.50,
        "peak_anomaly_density": round(float(norm_map.max()), 4),
        "max_intensity": round(float(norm_map.max()), 4),
        "min_intensity": round(float(norm_map.min()), 4),
        "mean_synthetic_activation": round(float(norm_map.mean()), 4),
        "mean_intensity": round(float(norm_map.mean()), 4),
        "anomaly_clusters": clusters,
        "top_regions": top_regions,
        "methodology": "High-Frequency Laplacian Residual Variance (Spatial Fallback)",
        "width": orig_w,
        "height": orig_h
    }
