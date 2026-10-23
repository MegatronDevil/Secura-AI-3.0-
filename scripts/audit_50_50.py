import sys
from pathlib import Path
import numpy as np
import torch
from PIL import Image

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.ai_image_detector import get_ai_image_detector

def audit_dataset():
    data_dir = Path(__file__).resolve().parent.parent / "data" / "online_dataset"
    ai_dir = data_dir / "ai"
    real_dir = data_dir / "real"

    ai_files = sorted(list(ai_dir.glob("*.*")))[:50]
    real_files = sorted(list(real_dir.glob("*.*")))[:50]

    print(f"Loaded {len(ai_files)} AI files and {len(real_files)} Real files.")

    detector = get_ai_image_detector()
    
    # Test Ensemble
    detector.switch_head("Ensemble")
    
    ai_correct_ens = 0
    real_correct_ens = 0

    ai_swin_correct = 0
    real_swin_correct = 0

    ai_clip_correct = 0
    real_clip_correct = 0

    print("\n--- Evaluating 50 AI Images ---")
    for idx, f in enumerate(ai_files):
        try:
            img = Image.open(f).convert("RGB")
            res = detector.detect(img)
            p_ai = res.uncalibrated_margin
            is_ai = p_ai >= 0.50
            if is_ai:
                ai_correct_ens += 1
            else:
                print(f"[AI MISCLASSIFIED AS REAL] {f.name}: p_ai={p_ai:.4f}, raw={res.raw_score}")
        except Exception as e:
            print(f"Error on {f.name}: {e}")

    print(f"\nAI Accuracy (Ensemble): {ai_correct_ens}/{len(ai_files)} ({ai_correct_ens/len(ai_files)*100:.1f}%)")

    print("\n--- Evaluating 50 Real Images ---")
    for idx, f in enumerate(real_files):
        try:
            img = Image.open(f).convert("RGB")
            res = detector.detect(img)
            p_ai = res.uncalibrated_margin
            is_real = p_ai < 0.50
            if is_real:
                real_correct_ens += 1
            else:
                print(f"[REAL MISCLASSIFIED AS AI] {f.name}: p_ai={p_ai:.4f}, raw={res.raw_score}")
        except Exception as e:
            print(f"Error on {f.name}: {e}")

    print(f"\nReal Accuracy (Ensemble): {real_correct_ens}/{len(real_files)} ({real_correct_ens/len(real_files)*100:.1f}%)")
    total_acc = (ai_correct_ens + real_correct_ens) / (len(ai_files) + len(real_files)) * 100
    print(f"\nTotal Ensemble Accuracy: {ai_correct_ens + real_correct_ens}/100 ({total_acc:.1f}%)")

if __name__ == "__main__":
    audit_dataset()
