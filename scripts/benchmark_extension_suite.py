"""
Comprehensive benchmark suite testing the Secura AI Chrome Extension & Backend Detection Pipeline.

Categories (20 images each):
1. Difficult-to-find AI images (subtle photorealism, high-end diffusion portraits/scenes)
2. Normal AI images (standard generative diffusion, midjourney scenes, creative concept art)
3. Easy-to-find AI images (surrealistic, abstract, GAN artifacts, stylized AI, C2PA sealed AI)
4. Hard-to-find normal/authentic images across Medium, High, and Max frequency:
   - Medium frequency: soft portraits, natural indoor lighting, smooth skin/gradations
   - High frequency: intricate architecture, foliage, fine fur/textiles, detailed textures
   - Max frequency: direct camera flash blowout, specular highlights, compression noise, high-ISO grain
"""

import glob
import io
import json
import os
import time
from pathlib import Path
from PIL import Image
import requests

API_ENDPOINT = "http://127.0.0.1:8000/api/v1/analyze/image?probe=Ensemble"

def collect_test_dataset():
    online_ai = sorted(glob.glob("data/online_dataset/ai/*.*"))
    online_real = sorted(glob.glob("data/online_dataset/real/*.*"))
    ai_det = sorted(glob.glob("data/ai_detection/images/*.*"))

    # 1. Easy-to-find AI images (20)
    # Obvious stylized, surrealistic, GAN artifacts, flat AI art
    easy_ai = []
    if Path("data/C2PA_SEALED_OIG1.7jRUm0wwnd2w9KcstkGnG8a06W.jpg").exists():
        easy_ai.append("data/C2PA_SEALED_OIG1.7jRUm0wwnd2w9KcstkGnG8a06W.jpg")
    for f in ["diff_diff_abstract_01.png", "diff_diff_abstract_01_downscale_50.png", "gan_gan_bedroom_01.png", "gan_gan_car_01.png", "gan_gan_church_01.png", "gan_gan_face_01.png", "gan_gan_face_02.png"]:
        p = f"data/ai_detection/images/{f}"
        if Path(p).exists() and p not in easy_ai:
            easy_ai.append(p)
    # Add surreal/stylized from online_ai
    for p in online_ai:
        name = Path(p).name.lower()
        if any(k in name for k in ["abstract", "trippy", "cubism", "psychedelic", "kimono", "coffee", "art", "lensa"]):
            if p not in easy_ai:
                easy_ai.append(p)
        if len(easy_ai) >= 20:
            break
    while len(easy_ai) < 20 and online_ai:
        for p in online_ai:
            if p not in easy_ai:
                easy_ai.append(p)
                if len(easy_ai) == 20:
                    break

    # 2. Normal AI images (20)
    # Standard generative diffusion compositions, landscape, creative synthesis
    normal_ai = []
    for f in ["diff_diff_cyberpunk_01.png", "diff_diff_cyberpunk_01_downscale_50.png", "diff_diff_fantasy_01.png", "diff_diff_fantasy_01_downscale_50.png"]:
        p = f"data/ai_detection/images/{f}"
        if Path(p).exists() and p not in normal_ai:
            normal_ai.append(p)
    for p in online_ai:
        if p not in easy_ai and p not in normal_ai:
            normal_ai.append(p)
            if len(normal_ai) >= 20:
                break

    # 3. Difficult-to-find AI images (20)
    # Photorealistic diffusion, high-detail realism portraits and scenes
    difficult_ai = []
    for f in ["diff_diff_photoreal_01.png", "diff_diff_photoreal_01_downscale_50.png", "diff_diff_portrait_01.png", "diff_diff_portrait_01_downscale_50.png"]:
        p = f"data/ai_detection/images/{f}"
        if Path(p).exists() and p not in difficult_ai:
            difficult_ai.append(p)
    for p in online_ai:
        name = Path(p).name.lower()
        if any(k in name for k in ["photo", "portrait", "realistic", "people", "urban"]):
            if p not in easy_ai and p not in normal_ai and p not in difficult_ai:
                difficult_ai.append(p)
        if len(difficult_ai) >= 20:
            break
    while len(difficult_ai) < 20 and online_ai:
        for p in online_ai:
            if p not in easy_ai and p not in normal_ai and p not in difficult_ai:
                difficult_ai.append(p)
                if len(difficult_ai) == 20:
                    break

    # 4. Hard-to-find Normal/Authentic images (20) across Medium, High, and Max frequency
    # Medium frequency (6 images): smooth portraits, gentle indoor lighting
    # High frequency (7 images): sharp architecture, detailed foliage, fine fur/fabrics
    # Max frequency (7 images): camera flash blowout, specular highlights, compression noise, sensor grain
    hard_real = []
    
    # User's uploaded flash photo is the prime Max Frequency test
    user_flash = r"C:\Users\ammur\.gemini\antigravity-ide\brain\0ce9bb51-f8a1-4e1e-87cc-4c7b319c2ee2\.user_uploaded\media_1792740611532.jpg"
    if Path(user_flash).exists():
        hard_real.append({"path": user_flash, "freq_band": "Max Frequency (Flash Specular Blowout)"})

    # High frequency / compression noise samples from ai_detection
    hf_samples = [
        ("data/ai_detection/images/real_indoor_09_jpeg_q70.png", "Max Frequency (JPEG Compression Noise)"),
        ("data/ai_detection/images/real_indoor_10_jpeg_q70.png", "Max Frequency (JPEG Compression Noise)"),
        ("data/ai_detection/images/real_architecture_03.png", "High Frequency (Dense Architectural Grid)"),
        ("data/ai_detection/images/real_architecture_04.png", "High Frequency (Structural Masonry & Edges)"),
        ("data/ai_detection/images/real_nature_01.png", "High Frequency (Intricate Botanical Foliage)"),
        ("data/ai_detection/images/real_nature_02.png", "High Frequency (Complex Organic Texture)"),
        ("data/ai_detection/images/real_object_08.png", "High Frequency (Specular Hardware Microtexture)"),
        ("data/ai_detection/images/real_indoor_09.png", "Medium Frequency (Diffuse Ambient Interior)"),
        ("data/ai_detection/images/real_indoor_10.png", "Medium Frequency (Complex Room Gradient)"),
        ("data/ai_detection/images/real_portrait_05.png", "Medium Frequency (Human Skin Pores & Shading)"),
        ("data/ai_detection/images/real_portrait_06.png", "Medium Frequency (Natural Lighting Facial Tones)")
    ]
    for p, band in hf_samples:
        if Path(p).exists():
            hard_real.append({"path": p, "freq_band": band})

    # Supplement remaining from online_real with frequency analysis
    for p in online_real:
        if len(hard_real) >= 20:
            break
        name = Path(p).name.lower()
        if any(k in name for k in ["portrait", "tamarin", "elephant", "drawing", "monet"]):
            hard_real.append({"path": p, "freq_band": "High Frequency (Wildlife Fur / Fine Art)"})

    while len(hard_real) < 20 and online_real:
        for p in online_real:
            if not any(item["path"] == p for item in hard_real):
                hard_real.append({"path": p, "freq_band": "Medium Frequency (Natural Scene)"})
                if len(hard_real) == 20:
                    break

    return {
        "Difficult AI (Photorealistic / Subtle)": [{"path": p, "expected": "AI_GENERATED"} for p in difficult_ai[:20]],
        "Normal AI (Standard Diffusion)": [{"path": p, "expected": "AI_GENERATED"} for p in normal_ai[:20]],
        "Easy AI (Stylized / Art / Artifacts)": [{"path": p, "expected": "AI_GENERATED"} for p in easy_ai[:20]],
        "Challenging Real (Med / High / Max Freq)": [{"path": item["path"], "expected": "NOT_AI_GENERATED", "freq_band": item.get("freq_band", "High Frequency")} for item in hard_real[:20]]
    }

def run_benchmark():
    dataset = collect_test_dataset()
    results = {}

    print("=" * 80)
    print("SECURA AI - CHROME EXTENSION BENCHMARK SUITE (80 IMAGES TOTAL)")
    print("=" * 80)

    total_tested = 0
    total_correct = 0

    for cat_name, items in dataset.items():
        print(f"\n--- Testing Category: {cat_name} ({len(items)} images) ---")
        cat_results = []
        cat_correct = 0

        for idx, item in enumerate(items, start=1):
            file_path = item["path"]
            expected = item["expected"]
            freq_band = item.get("freq_band", "N/A")
            filename = Path(file_path).name

            t0 = time.time()
            try:
                with open(file_path, "rb") as f:
                    resp = requests.post(
                        API_ENDPOINT,
                        files={"file": (filename, f, "image/jpeg" if filename.lower().endswith((".jpg", ".jpeg")) else "image/png")}
                    )
                latency = round((time.time() - t0) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    cv = data.get("canonical_verdict", {})
                    pred_label = cv.get("predicted_label", "UNKNOWN")
                    model_score = cv.get("model_score", 0.0)
                    display_label = cv.get("display_label", "")

                    ai_det = data.get("ai_detection", {})
                    p_ai = ai_det.get("uncalibrated_margin", 0.0)
                    ai_class = ai_det.get("predicted_class", "")

                    # Correctness evaluation:
                    # If expected is AI_GENERATED: pred_label == AI_GENERATED is correct
                    # If expected is NOT_AI_GENERATED: pred_label in (NOT_AI_GENERATED, CAMERA_CAPTURED) is correct
                    if expected == "AI_GENERATED":
                        is_match = (pred_label == "AI_GENERATED")
                    else:
                        is_match = (pred_label in ("NOT_AI_GENERATED", "CAMERA_CAPTURED"))

                    if is_match:
                        cat_correct += 1
                        total_correct += 1
                    total_tested += 1

                    status_mark = "PASS" if is_match else "FAIL"
                    short_name = filename[:32]
                    print(f"[{status_mark}] #{idx:02d} {short_name:<32} | Pred: {pred_label:<18} | Score: {model_score*100:5.1f}% | Latency: {latency:5.1f}ms | {freq_band}")

                    cat_results.append({
                        "filename": filename,
                        "path": file_path,
                        "expected": expected,
                        "predicted_label": pred_label,
                        "display_label": display_label,
                        "model_score": model_score,
                        "p_ai": p_ai,
                        "ai_class": ai_class,
                        "latency_ms": latency,
                        "match": is_match,
                        "freq_band": freq_band,
                    })
                else:
                    print(f"[ERR ] #{idx:02d} {filename[:32]} HTTP {resp.status_code}")
                    cat_results.append({
                        "filename": filename,
                        "error": f"HTTP {resp.status_code}",
                        "match": False
                    })
                    total_tested += 1
            except Exception as e:
                print(f"[EXC ] #{idx:02d} {filename[:32]} {e}")
                cat_results.append({
                    "filename": filename,
                    "error": str(e),
                    "match": False
                })
                total_tested += 1

        acc = (cat_correct / len(items)) * 100 if items else 0.0
        print(f"--> {cat_name} Accuracy: {cat_correct}/{len(items)} ({acc:.1f}%)")
        results[cat_name] = {
            "total": len(items),
            "correct": cat_correct,
            "accuracy_pct": acc,
            "items": cat_results
        }

    overall_acc = (total_correct / total_tested) * 100 if total_tested else 0.0
    print("\n" + "=" * 80)
    print(f"BENCHMARK COMPLETED: {total_correct}/{total_tested} Overall Accuracy ({overall_acc:.1f}%)")
    print("=" * 80)

    # Save summary report to JSON
    out_path = Path("benchmark_extension_suite_results.json")
    out_path.write_text(json.dumps({
        "timestamp": time.time(),
        "total_tested": total_tested,
        "total_correct": total_correct,
        "overall_accuracy_pct": overall_acc,
        "categories": results
    }, indent=2))
    print(f"Detailed results saved to {out_path.name}")

if __name__ == "__main__":
    run_benchmark()
