"""
Comprehensive Held-Out Evaluation for Secura Extension Image Detector v1.
Tests against locked held-out test split (154 variants) and diagnostic challenge images.
Evaluates FPR, FNR, Precision, Recall, F1, Balanced Accuracy, and per-transformation robustness.
"""

import os
import json
import time
import hashlib
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from transformers import CLIPImageProcessor, CLIPVisionModelWithProjection

class ExtensionRobustMLP(nn.Module):
    def __init__(self, in_features: int = 768, hidden_dim: int = 256, dropout_rate: float = 0.2):
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

def compute_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.5) -> Dict[str, Any]:
    y_pred = (y_prob >= threshold).astype(int)
    
    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))

    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
    tpr = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    tnr = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tpr
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    balanced_acc = 0.5 * (tpr + tnr)

    return {
        "threshold": threshold,
        "total_samples": len(y_true),
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "fpr": round(fpr, 4),
        "fnr": round(fnr, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "balanced_acc": round(balanced_acc, 4),
        "confusion_matrix": {
            "predicted_real": {"actual_real": tn, "actual_ai": fn},
            "predicted_ai": {"actual_real": fp, "actual_ai": tp}
        }
    }

def main():
    repo_root = Path("d:/SecuraAI2")
    data_dir = repo_root / "data" / "extension_training"
    weights_dir = repo_root / "backend" / "models" / "weights" / "extension_image_detector_v1"
    clip_dir = repo_root / "backend" / "models" / "weights" / "clip-vit-large-patch14"

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading evaluation environment on {device}...")

    # Load Config
    with open(weights_dir / "config.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    threshold = config["operating_threshold"]
    print(f"Loaded candidate model {config['model_name']} (operating threshold: {threshold})")

    # Load Candidate Head
    checkpoint = torch.load(weights_dir / "model_weights.pt", map_location=device)
    cand_model = ExtensionRobustMLP(in_features=768, hidden_dim=256, dropout_rate=0.0).to(device)
    cand_model.load_state_dict(checkpoint["model_state_dict"])
    cand_model.eval()

    # Load CLIP Vision Model
    clip_processor = CLIPImageProcessor.from_pretrained(str(clip_dir))
    clip_model = CLIPVisionModelWithProjection.from_pretrained(str(clip_dir)).to(device)
    clip_model.eval()

    # Load Test Manifest
    test_manifest_path = data_dir / "test_manifest.json"
    with open(test_manifest_path, "r", encoding="utf-8") as f:
        test_items = json.load(f)

    print(f"Evaluating {len(test_items)} held-out test images...")

    results = []
    y_true = []
    y_prob = []
    per_transform = {}

    for item in test_items:
        p = Path(item["file_path"])
        if not p.exists():
            continue

        label_binary = 1.0 if item["label"] == "AI_GENERATED" else 0.0
        ttype = item["transform_type"]

        with Image.open(p) as img:
            rgb_img = img.convert("RGB")
            inputs = clip_processor(images=rgb_img, return_tensors="pt").to(device)
            with torch.no_grad():
                embed = clip_model(**inputs).image_embeds[0].cpu().numpy()
            norm = np.linalg.norm(embed)
            if norm > 1e-8:
                embed = embed / norm

            feat_tensor = torch.tensor(embed, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.no_grad():
                logit = cand_model(feat_tensor).item()
                prob = float(torch.sigmoid(torch.tensor(logit)).item())

        is_pred_ai = prob >= threshold
        pred_label = "AI_GENERATED" if is_pred_ai else "REAL_AUTHENTIC"
        is_correct = (is_pred_ai == (label_binary == 1.0))

        y_true.append(label_binary)
        y_prob.append(prob)

        res_record = {
            "variant_id": item["variant_id"],
            "parent_id": item["parent_id"],
            "transform_type": ttype,
            "ground_truth": item["label"],
            "predicted_label": pred_label,
            "predicted_prob": round(prob, 4),
            "correct": is_correct
        }
        results.append(res_record)

        if ttype not in per_transform:
            per_transform[ttype] = {"true": [], "prob": []}
        per_transform[ttype]["true"].append(label_binary)
        per_transform[ttype]["prob"].append(prob)

    y_true = np.array(y_true)
    y_prob = np.array(y_prob)

    overall_metrics = compute_metrics(y_true, y_prob, threshold=threshold)
    print("\n================ HELD-OUT TEST SUITE RESULTS ================")
    print(f"Total Test Images: {overall_metrics['total_samples']}")
    print(f"Balanced Accuracy: {overall_metrics['balanced_acc']*100:.2f}%")
    print(f"F1 Score:          {overall_metrics['f1']:.4f}")
    print(f"Precision:         {overall_metrics['precision']*100:.2f}%")
    print(f"Recall:            {overall_metrics['recall']*100:.2f}%")
    print(f"False Positive Rate (Authentic misclassified as AI): {overall_metrics['fpr']*100:.2f}%")
    print(f"False Negative Rate (AI misclassified as Real):      {overall_metrics['fnr']*100:.2f}%")
    print("Confusion Matrix:")
    print(f"  TN (Real correctly identified): {overall_metrics['tn']}")
    print(f"  FP (Real false AI alarm):       {overall_metrics['fp']}")
    print(f"  FN (AI missed):                 {overall_metrics['fn']}")
    print(f"  TP (AI correctly identified):   {overall_metrics['tp']}")

    print("\n---------------- Per-Transformation Performance ----------------")
    transform_metrics = {}
    for ttype, data in per_transform.items():
        t_m = compute_metrics(np.array(data["true"]), np.array(data["prob"]), threshold=threshold)
        transform_metrics[ttype] = t_m
        print(f"  {ttype:<16} | Bal Acc: {t_m['balanced_acc']*100:.2f}% | FPR: {t_m['fpr']*100:.2f}% | FNR: {t_m['fnr']*100:.2f}% | F1: {t_m['f1']:.4f}")

    # Challenge Diagnostic Evaluation: Test against Phone Flash & Social Media Artifacts
    print("\n---------------- Diagnostic Challenge Evaluation ----------------")
    flash_path = repo_root / ".user_uploaded" / "media_1792740611532.jpg"
    diag_results = {}
    if flash_path.exists():
        with Image.open(flash_path) as img:
            rgb_img = img.convert("RGB")
            inputs = clip_processor(images=rgb_img, return_tensors="pt").to(device)
            with torch.no_grad():
                embed = clip_model(**inputs).image_embeds[0].cpu().numpy()
            norm = np.linalg.norm(embed)
            if norm > 1e-8:
                embed = embed / norm
            feat_tensor = torch.tensor(embed, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.no_grad():
                logit = cand_model(feat_tensor).item()
                prob = float(torch.sigmoid(torch.tensor(logit)).item())
        diag_results["phone_flash_photo"] = {
            "path": str(flash_path),
            "sha256": "4c4c23933c09f871302cba394c86bc9a0ebcc41a4a9cf47321e06fa59be73c3d",
            "ground_truth": "REAL_AUTHENTIC",
            "candidate_prob": round(prob, 4),
            "candidate_verdict": "AI_GENERATED" if prob >= threshold else "REAL_AUTHENTIC",
            "status": "PASS" if prob < threshold else "FAIL"
        }
        print(f"Diagnostic Flash Photo: Candidate prob={prob:.4f} -> Verdict={diag_results['phone_flash_photo']['candidate_verdict']} ({diag_results['phone_flash_photo']['status']})")

    report = {
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "model_id": config["model_id"],
        "model_version": config["model_version"],
        "threshold": threshold,
        "overall_test_metrics": overall_metrics,
        "per_transformation_metrics": transform_metrics,
        "diagnostic_challenges": diag_results
    }

    report_path = data_dir / "test_evaluation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nEvaluation report successfully saved to {report_path}")

if __name__ == "__main__":
    main()
