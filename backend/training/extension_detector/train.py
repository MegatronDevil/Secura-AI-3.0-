"""
Training Pipeline for Extension-Specific Image Detector (v1).
Trains an isolated, robust MLP classification head on frozen CLIP ViT-L/14 representations.
Zero modifications to existing models or weights.
"""

import os
import json
import time
import random
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from transformers import CLIPImageProcessor, CLIPVisionModelWithProjection

class ExtensionRobustMLP(nn.Module):
    """
    Multi-layer perception head designed for robust web-compressed artifact discrimination.
    Input: 768-d normalized CLIP ViT-L/14 embedding
    Output: Single logit (positive => AI_GENERATED, negative => REAL_AUTHENTIC)
    """
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

class FeatureDataset(Dataset):
    def __init__(self, features: np.ndarray, labels: np.ndarray, metadata: List[Dict[str, Any]]):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.float32)
        self.metadata = metadata

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx], self.metadata[idx]

def extract_features(manifest_path: Path, clip_model, clip_processor, device: str) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]]]:
    with open(manifest_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    features = []
    labels = []
    valid_meta = []

    print(f"Extracting CLIP features for {len(items)} images from {manifest_path.name}...")
    t0 = time.time()
    for idx, item in enumerate(items):
        path = Path(item["file_path"])
        if not path.exists():
            continue
        try:
            with Image.open(path) as img:
                rgb_img = img.convert("RGB")
                inputs = clip_processor(images=rgb_img, return_tensors="pt").to(device)
                with torch.no_grad():
                    embed = clip_model(**inputs).image_embeds[0].cpu().numpy()
                norm = np.linalg.norm(embed)
                if norm > 1e-8:
                    embed = embed / norm
                features.append(embed)
                # REAL_AUTHENTIC: 0, AI_GENERATED: 1
                labels.append(1.0 if item["label"] == "AI_GENERATED" else 0.0)
                valid_meta.append(item)
        except Exception as e:
            print(f"Failed feature extraction on {path}: {e}")

        if (idx + 1) % 100 == 0 or idx == len(items) - 1:
            print(f"  Processed {idx + 1}/{len(items)} images ({time.time() - t0:.1f}s)")

    return np.array(features, dtype=np.float32), np.array(labels, dtype=np.float32), valid_meta

def compute_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.5) -> Dict[str, float]:
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
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "fpr": round(fpr, 4),
        "fnr": round(fnr, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "balanced_acc": round(balanced_acc, 4)
    }

def main():
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)

    repo_root = Path("d:/SecuraAI2")
    data_dir = repo_root / "data" / "extension_training"
    out_weights_dir = repo_root / "backend" / "models" / "weights" / "extension_image_detector_v1"
    out_weights_dir.mkdir(parents=True, exist_ok=True)

    clip_dir = repo_root / "backend" / "models" / "weights" / "clip-vit-large-patch14"
    if not clip_dir.exists():
        raise FileNotFoundError(f"CLIP weights directory not found at {clip_dir}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading frozen CLIP ViT-L/14 from {clip_dir} on {device}...")
    clip_processor = CLIPImageProcessor.from_pretrained(str(clip_dir))
    clip_model = CLIPVisionModelWithProjection.from_pretrained(str(clip_dir)).to(device)
    clip_model.eval()

    # Pre-extract or load cached features
    train_cache = data_dir / "train_features.npz"
    val_cache = data_dir / "val_features.npz"

    if train_cache.exists():
        print(f"Loading cached train features from {train_cache}...")
        tr_data = np.load(train_cache, allow_pickle=True)
        X_train, y_train, meta_train = tr_data["X"], tr_data["y"], list(tr_data["meta"])
    else:
        X_train, y_train, meta_train = extract_features(data_dir / "train_manifest.json", clip_model, clip_processor, device)
        np.savez_compressed(train_cache, X=X_train, y=y_train, meta=meta_train)

    if val_cache.exists():
        print(f"Loading cached val features from {val_cache}...")
        val_data = np.load(val_cache, allow_pickle=True)
        X_val, y_val, meta_val = val_data["X"], val_data["y"], list(val_data["meta"])
    else:
        X_val, y_val, meta_val = extract_features(data_dir / "val_manifest.json", clip_model, clip_processor, device)
        np.savez_compressed(val_cache, X=X_val, y=y_val, meta=meta_val)

    print(f"Train samples: {len(X_train)} (Real: {np.sum(y_train == 0)}, AI: {np.sum(y_train == 1)})")
    print(f"Val samples: {len(X_val)} (Real: {np.sum(y_val == 0)}, AI: {np.sum(y_val == 1)})")

    # Hyperparameters
    batch_size = 32
    num_epochs = 35
    lr = 1e-3
    weight_decay = 1e-4

    train_dataset = FeatureDataset(X_train, y_train, meta_train)
    val_dataset = FeatureDataset(X_val, y_val, meta_val)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    model = ExtensionRobustMLP(in_features=768, hidden_dim=256, dropout_rate=0.25).to(device)

    # Class balance weighting
    n_pos = float(np.sum(y_train == 1))
    n_neg = float(np.sum(y_train == 0))
    pos_weight = torch.tensor([n_neg / max(1.0, n_pos)], device=device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-5)

    best_val_loss = float("inf")
    best_balanced_acc = 0.0
    best_epoch = -1
    best_weights_path = out_weights_dir / "model_weights.pt"

    history = []

    print("\n--- Beginning Isolated Model Training ---")
    for epoch in range(1, num_epochs + 1):
        model.train()
        total_loss = 0.0
        for feats, targets, _ in train_loader:
            feats = feats.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            logits = model(feats)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(targets)

        scheduler.step()
        train_loss = total_loss / len(train_dataset)

        # Validation
        model.eval()
        val_loss = 0.0
        val_probs = []
        val_targets = []
        with torch.no_grad():
            for feats, targets, _ in val_loader:
                feats = feats.to(device)
                targets = targets.to(device)
                logits = model(feats)
                loss = criterion(logits, targets)
                val_loss += loss.item() * len(targets)
                probs = torch.sigmoid(logits).cpu().numpy()
                val_probs.extend(probs)
                val_targets.extend(targets.cpu().numpy())

        val_loss = val_loss / len(val_dataset)
        val_probs = np.array(val_probs)
        val_targets = np.array(val_targets)

        metrics = compute_metrics(val_targets, val_probs, threshold=0.50)
        balanced_acc = metrics["balanced_acc"]
        fpr = metrics["fpr"]

        history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 5),
            "val_loss": round(val_loss, 5),
            "balanced_acc": balanced_acc,
            "fpr": fpr,
            "f1": metrics["f1"]
        })

        if epoch % 5 == 0 or epoch == num_epochs or balanced_acc > best_balanced_acc:
            print(f"Epoch {epoch:02d}/{num_epochs:02d} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Bal Acc: {balanced_acc*100:.2f}% | FPR: {fpr*100:.2f}% | F1: {metrics['f1']:.4f}")

        # Save checkpoint if best balanced accuracy and lower loss
        if (balanced_acc > best_balanced_acc) or (balanced_acc == best_balanced_acc and val_loss < best_val_loss):
            best_balanced_acc = balanced_acc
            best_val_loss = val_loss
            best_epoch = epoch
            torch.save({
                "model_state_dict": model.state_dict(),
                "in_features": 768,
                "hidden_dim": 256,
                "dropout_rate": 0.25,
                "epoch": epoch,
                "val_loss": val_loss,
                "balanced_acc": balanced_acc
            }, best_weights_path)

    print(f"\nTraining Complete! Best model from Epoch {best_epoch} (Val Bal Acc: {best_balanced_acc*100:.2f}%, Val Loss: {best_val_loss:.4f})")

    # Load best checkpoint to determine optimal operating threshold
    checkpoint = torch.load(best_weights_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    val_probs = []
    val_targets = []
    with torch.no_grad():
        for feats, targets, _ in val_loader:
            feats = feats.to(device)
            logits = model(feats)
            probs = torch.sigmoid(logits).cpu().numpy()
            val_probs.extend(probs)
            val_targets.extend(targets.numpy())
    val_probs = np.array(val_probs)
    val_targets = np.array(val_targets)

    # Threshold calibration sweep on validation set
    print("\n--- Threshold Optimization Sweep (Validation Set) ---")
    best_thresh = 0.50
    best_thresh_metrics = None
    min_fpr_at_good_recall = float("inf")

    for t in np.arange(0.35, 0.75, 0.05):
        t = round(float(t), 2)
        m = compute_metrics(val_targets, val_probs, threshold=t)
        print(f"  Thresh {t:.2f} -> FPR: {m['fpr']*100:.2f}%, FNR: {m['fnr']*100:.2f}%, Recall: {m['recall']*100:.2f}%, Prec: {m['precision']*100:.2f}%, F1: {m['f1']:.4f}, Bal Acc: {m['balanced_acc']*100:.2f}%")
        
        # We prioritize low FPR on authentic images while preserving >= 90% recall on AI
        if m["recall"] >= 0.90:
            if m["fpr"] < min_fpr_at_good_recall:
                min_fpr_at_good_recall = m["fpr"]
                best_thresh = t
                best_thresh_metrics = m

    if best_thresh_metrics is None:
        best_thresh = 0.50
        best_thresh_metrics = compute_metrics(val_targets, val_probs, threshold=0.50)

    print(f"\nOptimal Operating Threshold Selected: {best_thresh} (Val FPR: {best_thresh_metrics['fpr']*100:.2f}%, Val F1: {best_thresh_metrics['f1']:.4f})")

    # Save model config and training history
    config = {
        "model_id": "extension_image_detector_v1",
        "model_name": "Secura Extension Image Detector v1",
        "model_version": "1.0.0-ext-robust",
        "architecture": "Frozen CLIP ViT-L/14 + ExtensionRobustMLP (768->256->64->1)",
        "in_features": 768,
        "hidden_dim": 256,
        "operating_threshold": best_thresh,
        "score_semantics": "Calibrated probability p_ai from robust web-compressed MLP head",
        "class_mapping": {
            "0": "REAL_AUTHENTIC",
            "1": "AI_GENERATED"
        },
        "best_epoch": best_epoch,
        "best_val_metrics": best_thresh_metrics,
        "trained_date": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "checkpoint_file": "model_weights.pt"
    }

    with open(out_weights_dir / "config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    with open(out_weights_dir / "training_log.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    print("Model configuration and training log successfully saved to", out_weights_dir)

if __name__ == "__main__":
    main()
