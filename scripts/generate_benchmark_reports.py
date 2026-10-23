import sys
import os
import json
import csv
import time
from pathlib import Path
from PIL import Image

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.ai_image_detector import get_ai_image_detector
from app.services.video_forensics import analyze_video_stream

def run_benchmark():
    root_dir = Path(__file__).resolve().parent.parent
    reports_dir = root_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    records = []

    # 1. Images
    data_dir = root_dir / "data" / "online_dataset"
    ai_img_dir = data_dir / "ai"
    real_img_dir = data_dir / "real"

    ai_img_files = sorted(list(ai_img_dir.glob("*.*")))[:50]
    real_img_files = sorted(list(real_img_dir.glob("*.*")))[:50]

    detector = get_ai_image_detector()
    detector.switch_head("Ensemble")

    print(f"Evaluating {len(ai_img_files)} AI images and {len(real_img_files)} Real images...")

    for f in ai_img_files:
        t0 = time.time()
        try:
            img = Image.open(f).convert("RGB")
            res = detector.detect(img)
            latency = time.time() - t0
            p_ai = float(res.uncalibrated_margin)
            pred = "AI_GENERATED" if p_ai >= 0.50 else "NOT_AI_GENERATED"
            records.append({
                "sample_id": f.name,
                "media_type": "image",
                "ground_truth": "AI_GENERATED",
                "ground_truth_source": "online_dataset_ai",
                "generator_or_capture_source": "Synthetic/Diffusion",
                "transformation_group": "none",
                "model_version": "SecuraAI-Ensemble-v2.0",
                "raw_score": round(p_ai, 4),
                "final_verdict": pred,
                "is_correct": pred == "AI_GENERATED",
                "processing_status": "SUCCESS",
                "latency_sec": round(latency, 4),
                "error_details": ""
            })
        except Exception as e:
            records.append({
                "sample_id": f.name,
                "media_type": "image",
                "ground_truth": "AI_GENERATED",
                "ground_truth_source": "online_dataset_ai",
                "generator_or_capture_source": "Synthetic/Diffusion",
                "transformation_group": "none",
                "model_version": "SecuraAI-Ensemble-v2.0",
                "raw_score": 0.0,
                "final_verdict": "ERROR",
                "is_correct": False,
                "processing_status": "FAILED",
                "latency_sec": round(time.time() - t0, 4),
                "error_details": str(e)
            })

    for f in real_img_files:
        t0 = time.time()
        try:
            img = Image.open(f).convert("RGB")
            res = detector.detect(img)
            latency = time.time() - t0
            p_ai = float(res.uncalibrated_margin)
            pred = "AI_GENERATED" if p_ai >= 0.50 else "NOT_AI_GENERATED"
            records.append({
                "sample_id": f.name,
                "media_type": "image",
                "ground_truth": "NOT_AI_GENERATED",
                "ground_truth_source": "online_dataset_real",
                "generator_or_capture_source": "Camera/RealWorld",
                "transformation_group": "none",
                "model_version": "SecuraAI-Ensemble-v2.0",
                "raw_score": round(p_ai, 4),
                "final_verdict": pred,
                "is_correct": pred == "NOT_AI_GENERATED",
                "processing_status": "SUCCESS",
                "latency_sec": round(latency, 4),
                "error_details": ""
            })
        except Exception as e:
            records.append({
                "sample_id": f.name,
                "media_type": "image",
                "ground_truth": "NOT_AI_GENERATED",
                "ground_truth_source": "online_dataset_real",
                "generator_or_capture_source": "Camera/RealWorld",
                "transformation_group": "none",
                "model_version": "SecuraAI-Ensemble-v2.0",
                "raw_score": 0.0,
                "final_verdict": "ERROR",
                "is_correct": False,
                "processing_status": "FAILED",
                "latency_sec": round(time.time() - t0, 4),
                "error_details": str(e)
            })

    # 2. Videos
    bench_dir = root_dir / "data" / "benchmark_videos"
    ai_vid_dir = bench_dir / "test_suite_20_ai"
    real_vid_dir = bench_dir / "test_suite_20_real"

    ai_vid_files = sorted(list(ai_vid_dir.glob("*.mp4")))[:20]
    real_vid_files = sorted(list(real_vid_dir.glob("*.mp4")))[:20]

    print(f"Evaluating {len(ai_vid_files)} AI videos and {len(real_vid_files)} Real videos...")

    for f in ai_vid_files:
        t0 = time.time()
        try:
            bytes_data = f.read_bytes()
            res = analyze_video_stream(
                video_bytes=bytes_data,
                filename=f.name,
                sample_interval_sec=0.5,
                max_samples=12,
                preset="fast"
            )
            latency = time.time() - t0
            cv = getattr(res, "canonical_verdict", None)
            score = float(cv.model_score) if cv else 0.5
            pred = cv.predicted_label if cv else ("AI_GENERATED" if score >= 0.50 else "NOT_AI_GENERATED")
            records.append({
                "sample_id": f.name,
                "media_type": "video",
                "ground_truth": "AI_GENERATED",
                "ground_truth_source": "benchmark_videos_ai",
                "generator_or_capture_source": "CogVideo/SVD/VGen",
                "transformation_group": "h264_transcode",
                "model_version": "SecuraAI-VideoForensics-v2.0",
                "raw_score": round(score, 4),
                "final_verdict": pred,
                "is_correct": pred == "AI_GENERATED",
                "processing_status": "SUCCESS",
                "latency_sec": round(latency, 4),
                "error_details": ""
            })
        except Exception as e:
            records.append({
                "sample_id": f.name,
                "media_type": "video",
                "ground_truth": "AI_GENERATED",
                "ground_truth_source": "benchmark_videos_ai",
                "generator_or_capture_source": "CogVideo/SVD/VGen",
                "transformation_group": "h264_transcode",
                "model_version": "SecuraAI-VideoForensics-v2.0",
                "raw_score": 0.0,
                "final_verdict": "ERROR",
                "is_correct": False,
                "processing_status": "FAILED",
                "latency_sec": round(time.time() - t0, 4),
                "error_details": str(e)
            })

    for f in real_vid_files:
        t0 = time.time()
        try:
            bytes_data = f.read_bytes()
            res = analyze_video_stream(
                video_bytes=bytes_data,
                filename=f.name,
                sample_interval_sec=0.5,
                max_samples=12,
                preset="fast"
            )
            latency = time.time() - t0
            cv = getattr(res, "canonical_verdict", None)
            score = float(cv.model_score) if cv else 0.5
            pred = cv.predicted_label if cv else ("NOT_AI_GENERATED" if score < 0.50 else "AI_GENERATED")
            records.append({
                "sample_id": f.name,
                "media_type": "video",
                "ground_truth": "NOT_AI_GENERATED",
                "ground_truth_source": "benchmark_videos_real",
                "generator_or_capture_source": "Camera/RealCapture",
                "transformation_group": "h264_transcode",
                "model_version": "SecuraAI-VideoForensics-v2.0",
                "raw_score": round(score, 4),
                "final_verdict": pred,
                "is_correct": pred == "NOT_AI_GENERATED",
                "processing_status": "SUCCESS",
                "latency_sec": round(latency, 4),
                "error_details": ""
            })
        except Exception as e:
            records.append({
                "sample_id": f.name,
                "media_type": "video",
                "ground_truth": "NOT_AI_GENERATED",
                "ground_truth_source": "benchmark_videos_real",
                "generator_or_capture_source": "Camera/RealCapture",
                "transformation_group": "h264_transcode",
                "model_version": "SecuraAI-VideoForensics-v2.0",
                "raw_score": 0.0,
                "final_verdict": "ERROR",
                "is_correct": False,
                "processing_status": "FAILED",
                "latency_sec": round(time.time() - t0, 4),
                "error_details": str(e)
            })

    # Save JSON
    json_path = reports_dir / "benchmark_results.json"
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(records, jf, indent=2)
    print(f"Saved benchmark results to {json_path}")

    # Save CSV
    csv_path = reports_dir / "benchmark_results.csv"
    keys = list(records[0].keys())
    with open(csv_path, "w", newline="", encoding="utf-8") as cf:
        writer = csv.DictWriter(cf, fieldnames=keys)
        writer.writeheader()
        writer.writerows(records)
    print(f"Saved benchmark results to {csv_path}")

    # Summary Metrics
    imgs = [r for r in records if r["media_type"] == "image"]
    vids = [r for r in records if r["media_type"] == "video"]

    img_correct = sum(1 for r in imgs if r["is_correct"])
    vid_correct = sum(1 for r in vids if r["is_correct"])

    print(f"\nImage Accuracy: {img_correct}/{len(imgs)} ({img_correct/len(imgs)*100:.2f}%)")
    print(f"Video Accuracy: {vid_correct}/{len(vids)} ({vid_correct/len(vids)*100:.2f}%)")
    print(f"Total Benchmark Size: {len(records)} items evaluated.")

if __name__ == "__main__":
    run_benchmark()
