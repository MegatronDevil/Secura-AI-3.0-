"""
Diagnostic test: Compare Extension Image Detector v1 vs Ensemble on phone flash and Instagram assets.
"""

import os
import json
import numpy as np
import torch
from pathlib import Path
from PIL import Image
from transformers import CLIPImageProcessor, CLIPVisionModelWithProjection

def main():
    repo_root = Path("d:/SecuraAI2")
    weights_dir = repo_root / "backend" / "models" / "weights" / "extension_image_detector_v1"
    clip_dir = repo_root / "backend" / "models" / "weights" / "clip-vit-large-patch14"
    artifacts_dir = Path(r"C:\Users\ammur\.gemini\antigravity-ide\brain\0ce9bb51-f8a1-4e1e-87cc-4c7b319c2ee2\.user_uploaded")

    # Define Head Architecture
    from torch import nn
    class ExtensionRobustMLP(nn.Module):
        def __init__(self, in_features: int = 768, hidden_dim: int = 256, dropout_rate: float = 0.0):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(in_features, hidden_dim),
                nn.LayerNorm(hidden_dim),
                nn.GELU(),
                nn.Dropout(dropout_rate),
                nn.Linear(hidden_dim, 64),
                nn.GELU(),
                nn.Dropout(dropout_rate * 0.5),
                nn.Linear(64, 1)
            )
        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.net(x).squeeze(-1)

    device = "cpu"
    cand_model = ExtensionRobustMLP(in_features=768, hidden_dim=256, dropout_rate=0.0).to(device)
    ckpt = torch.load(weights_dir / "model_weights.pt", map_location=device)
    cand_model.load_state_dict(ckpt["model_state_dict"])
    cand_model.eval()

    clip_processor = CLIPImageProcessor.from_pretrained(str(clip_dir))
    clip_model = CLIPVisionModelWithProjection.from_pretrained(str(clip_dir)).to(device)
    clip_model.eval()

    # Find test targets
    targets = []
    if artifacts_dir.exists():
        for f in artifacts_dir.glob("*.*"):
            if f.suffix.lower() in [".jpg", ".png", ".jpeg", ".webp"]:
                targets.append((f.name, f, "REAL_AUTHENTIC"))

    print(f"Testing {len(targets)} diagnostic target images from {artifacts_dir}...")
    results = {}
    for name, path, expected in targets:
        try:
            with Image.open(path) as img:
                rgb_img = img.convert("RGB")
                inputs = clip_processor(images=rgb_img, return_tensors="pt").to(device)
                with torch.no_grad():
                    feats = clip_model(**inputs).image_embeds[0].cpu().numpy()
                norm = np.linalg.norm(feats)
                if norm > 1e-8:
                    feats = feats / norm
                feat_tensor = torch.tensor(feats, dtype=torch.float32).unsqueeze(0).to(device)
                with torch.no_grad():
                    logit = float(cand_model(feat_tensor).item())
                    p_ai = float(torch.sigmoid(torch.tensor(logit)).item())

            verdict = "AI_GENERATED" if p_ai >= 0.50 else "REAL_AUTHENTIC"
            results[name] = {
                "path": str(path),
                "expected": expected,
                "p_ai": round(p_ai, 4),
                "logit": round(logit, 4),
                "verdict": verdict,
                "status": "PASS" if verdict == expected else "FAIL"
            }
            print(f"[{name}] p_ai: {p_ai:.4f} -> Verdict: {verdict}")
        except Exception as e:
            print(f"Error reading {name}: {e}")

    with open(repo_root / "data" / "extension_training" / "diagnostic_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved diagnostic results to data/extension_training/diagnostic_results.json")

if __name__ == "__main__":
    main()
