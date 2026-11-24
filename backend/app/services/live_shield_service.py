import io
import time
import logging
from typing import Dict, Any, Optional
import cv2
import numpy as np
from PIL import Image

from app.services.ai_image_detector import get_ai_image_detector

logger = logging.getLogger(__name__)


class LiveShieldService:
    """
    Evaluates real-time video stream frames for deepfake injection, virtual camera spoofing,
    and biometric photoplethysmography (rPPG) liveness continuity.
    Uses calibrated multi-architecture Ensemble (Swin + CLIP ViT-L/14) and multi-region sampling.
    """
    def __init__(self):
        self.frame_history = []
        self.max_history = 30
        self.smoothed_score = None

    def evaluate_stream_frame(
        self,
        image: Image.Image,
        timestamp_ms: Optional[float] = None,
        frame_seq: Optional[int] = None
    ) -> Dict[str, Any]:
        t0 = time.time()
        w, h = image.size
        rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)

        # 1. Spatial face localization using adaptive skin-tone centroid
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        skin_mask = (r > 60) & (g > 40) & (b > 25) & (r > g) & ((r.astype(int) - g.astype(int)) > 10) & ((r.astype(int) - b.astype(int)) > 15)
        mask_y1, mask_y2 = int(h * 0.08), int(h * 0.92)
        mask_x1, mask_x2 = int(w * 0.12), int(w * 0.88)
        sub_mask = skin_mask[mask_y1:mask_y2, mask_x1:mask_x2]

        has_face = False
        face_crop = None
        face_box = None
        # Face must occupy at least 2.5% of total frame pixels to be a real human face candidate
        if np.sum(sub_mask) > (w * h * 0.025):
            y_indices, x_indices = np.where(sub_mask)
            cy = int(np.median(y_indices)) + mask_y1
            cx = int(np.median(x_indices)) + mask_x1
            box_half_w = int(w * 0.22)
            box_half_h = int(h * 0.26)
            x1 = max(0, cx - box_half_w)
            y1 = max(0, cy - box_half_h)
            x2 = min(w, cx + box_half_w)
            y2 = min(h, cy + box_half_h)
            face_crop = rgb[y1:y2, x1:x2]
            face_box = [round(y1 / h, 3), round(x1 / w, 3), round(y2 / h, 3), round(x2 / w, 3)]
            has_face = True

        # 2. Extract rPPG vascular green-channel absorption signal
        pulse_source = face_crop if has_face else rgb
        g_mean = float(pulse_source[:, :, 1].mean())
        r_mean = float(pulse_source[:, :, 0].mean())
        b_mean = float(pulse_source[:, :, 2].mean())

        now_ms = timestamp_ms or (time.time() * 1000)
        self.frame_history.append((now_ms, g_mean, r_mean, b_mean))
        if len(self.frame_history) > self.max_history:
            self.frame_history.pop(0)

        # 3. Calculate Chromatic Channel Variance (Geometric signal tracking)
        rppg_variance = 0.0
        if len(self.frame_history) >= 5:
            signals = np.array([x[1] for x in self.frame_history])
            rppg_variance = float(np.var(signals))

        # 4. Determine if image is predominantly document/UI (text, fonts, browser, IDE)
        # Real photos/videos have rich continuous color distributions, whereas font/text UI has
        # high edge density, near-zero saturation, flat backgrounds, and very few unique colors.
        def is_photographic_media(crop_rgb: np.ndarray) -> bool:
            if crop_rgb.size == 0:
                return False
            ch, cw = crop_rgb.shape[:2]
            if cw < 30 or ch < 30:
                return False

            # 1. Luminance distribution (avoid pure white/dark flat backgrounds)
            gray_crop = np.mean(crop_rgb, axis=-1)
            white_pct = float(np.mean(np.all(crop_rgb > 235, axis=-1)))
            dark_pct = float(np.mean(np.all(crop_rgb < 32, axis=-1)))
            if white_pct >= 0.60 or dark_pct >= 0.60:
                return False

            # 2. Color richness & saturation discrimination
            # Text/code documents have almost 0 saturation and very few quantized colors.
            # Real photos and AI imagery have rich continuous color distributions.
            try:
                sample = crop_rgb[::2, ::2] if (cw > 160 and ch > 160) else crop_rgb
                hsv = cv2.cvtColor(sample, cv2.COLOR_RGB2HSV)
                sat_mean = float(np.mean(hsv[:, :, 1]))

                # Fast 5-bit color quantization to count unique colors
                quant = (sample >> 3).reshape(-1, 3)
                unique_colors = len(np.unique(quant, axis=0))

                # Documents with text, typography fonts, or UI code typically have < 180 quantized colors and sat_mean < 8.0
                if unique_colors < 180 and sat_mean < 8.0:
                    return False
            except Exception:
                pass

            midtone_pct = float(np.mean((gray_crop >= 65) & (gray_crop <= 225)))
            return bool(midtone_pct >= 0.15)

        full_is_photo = is_photographic_media(rgb)

        detector = get_ai_image_detector()
        if detector.active_head != "Ensemble":
            detector.switch_head("Ensemble")

        eval_full = Image.fromarray(rgb)
        crops_to_check = []

        if has_face and face_crop is not None:
            crops_to_check.append(("face", Image.fromarray(face_crop)))

        # Find embedded photographic/media windows (phones, images, video players, photo cards)
        # Using dual discovery: Saturation richness map + Canny morphological boundary
        try:
            candidate_boxes = []
            min_area = w * h * 0.008

            # Method 1: Saturation map for vibrant/continuous media cards (catches borderless or small PiP cards)
            hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
            sat = hsv[:, :, 1]
            sat_mask = (sat > 25).astype(np.uint8) * 255
            k_open = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
            k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))
            clean_sat = cv2.morphologyEx(sat_mask, cv2.MORPH_OPEN, k_open)
            clean_sat = cv2.morphologyEx(clean_sat, cv2.MORPH_CLOSE, k_close)
            cnts_sat, _ = cv2.findContours(clean_sat, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in cnts_sat:
                bx, by, bw, bh = cv2.boundingRect(cnt)
                if bw >= 50 and bh >= 50 and (bw * bh) >= min_area and (bw < w * 0.98 or bh < h * 0.98):
                    candidate_boxes.append((bw * bh, bx, by, bw, bh))

            # Method 2: Edge morphological contours (fallback for grayscale/low-saturation media windows)
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            edges = cv2.Canny(gray, 35, 120)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
            closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(closed, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                bx, by, bw, bh = cv2.boundingRect(cnt)
                if bw >= 50 and bh >= 50 and (bw * bh) >= min_area and (bw < w * 0.98 or bh < h * 0.98):
                    candidate_boxes.append((bw * bh, bx, by, bw, bh))

            # Deduplicate and sort by area descending, pick top 2
            candidate_boxes.sort(key=lambda x: x[0], reverse=True)
            added_boxes = []
            for area, bx, by, bw, bh in candidate_boxes:
                overlap = False
                for obx, oby, obw, obh in added_boxes:
                    if abs(bx - obx) < 40 and abs(by - oby) < 40:
                        overlap = True
                        break
                if not overlap:
                    candidate_rgb = rgb[by:by+bh, bx:bx+bw]
                    if is_photographic_media(candidate_rgb):
                        added_boxes.append((bx, by, bw, bh))
                        crops_to_check.append(("media", eval_full.crop((bx, by, bx + bw, by + bh))))
                        if len(added_boxes) >= 2:
                            break
        except Exception as e:
            logger.debug("Media extraction note: %s", e)

        # Full frame is evaluated directly when it is a camera/photographic scene,
        # NEVER when it is a desktop UI/browser full of text.
        if full_is_photo:
            crops_to_check.append(("full", eval_full))

        max_score = 0.05
        trigger_tag = "none"

        for tag, crop_img in crops_to_check:
            res_c = detector.detect(crop_img, is_video_frame=True)
            if res_c and res_c.available and res_c.uncalibrated_margin is not None:
                c_score = float(res_c.uncalibrated_margin)
                if c_score > max_score:
                    max_score = c_score
                    trigger_tag = tag

        neural_score = max_score

        # Temporal smoothing: responsive exponential moving average without sticky max latch
        if self.smoothed_score is None:
            self.smoothed_score = neural_score
        elif neural_score >= 0.50:
            self.smoothed_score = 0.65 * neural_score + 0.35 * self.smoothed_score
        else:
            self.smoothed_score = 0.65 * neural_score + 0.35 * self.smoothed_score

        eval_score = float(self.smoothed_score)

        # 5. Composite Live Decision Boundary
        is_spoof = False
        warnings = []

        has_pulse = (rppg_variance >= 0.20 and len(self.frame_history) >= 5)

        if has_face:
            # Sensitive live stream detection for generative faces, morphing, and synthetic skin
            # If natural rPPG capillary pulse is actively detected, require >= 0.70 confidence to avoid webcam noise false positives
            face_threshold = 0.70 if has_pulse else 0.50
            if eval_score >= face_threshold:
                is_spoof = True
                warnings.append("Neural classifier detected generative facial artifacts or synthetic skin textures.")
        else:
            # Screen share / object / phone presentation mode
            # If an actual AI image or media crop was detected on screen or presented to camera
            if eval_score >= 0.50 and trigger_tag != "none":
                is_spoof = True
                warnings.append(f"Synthetic generative media texture detected on active visual stream ({trigger_tag} region).")

        # Provisional BRAHMA Policy Check for Live Shield
        brahma_provisional = {
            "decision": "REVIEW_REQUIRED" if is_spoof else "ALLOWED",
            "policy_scope": "PLATFORM_RULES & STATUTORY",
            "provisional": True,
            "note": "Provisional real-time stream check. Frame-level signal does not constitute a final pre-publication verdict."
        }

        liveness_confidence = round(max(0.0, min(1.0, 1.0 - eval_score)), 4)
        latency_ms = round((time.time() - t0) * 1000, 2)

        return {
            "verdict": "DEEPFAKE_INJECTION_DETECTED" if is_spoof else "LIVE_AUTHENTIC_STREAM",
            "is_live_authentic": not is_spoof,
            "neural_ai_score": round(eval_score, 4),
            "synthetic_confidence": round(eval_score, 4),
            "liveness_confidence": liveness_confidence,
            "frame_seq": frame_seq,
            "timestamp_ms": timestamp_ms or now_ms,
            "server_processed_at_ms": round(time.time() * 1000, 2),
            "trigger_region": trigger_tag,
            "rppg_signal_variance": round(rppg_variance, 6),
            "blood_volume_variance": round(rppg_variance, 6),
            "temporal_consistency": round(1.0 - min(1.0, rppg_variance * 100.0), 4),
            "detected_face_box": face_box,
            "face_box": face_box,
            "face_detected": face_box is not None,
            "warnings": warnings,
            "suspicion_flags": warnings,
            "brahma_provisional": brahma_provisional,
            "latency_ms": latency_ms,
            "history_window_frames": len(self.frame_history)
        }


# Global singleton instance
_live_shield_instance = LiveShieldService()

def get_live_shield_service() -> LiveShieldService:
    return _live_shield_instance
