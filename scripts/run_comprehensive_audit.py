"""Comprehensive Secura AI 2.0 Benchmark and Verification Suite.
Evaluates:
1. 50 AI images vs 50 Authentic Real images
2. 20 AI videos vs 20 Authentic Real videos
3. Live Webcam Stream & Screen Share Sentinel feeds (font/text vs AI injection)
"""

import json
import os
import sys
import time

# Ensure backend modules can be imported directly
backend_dir = r"d:\SecuraAI2\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import requests
import cv2
import numpy as np
from PIL import Image

API_BASE = "http://127.0.0.1:8000"

def test_image_benchmark():
    print("\n" + "="*60, flush=True)
    print("STEP 1: 50 AI + 50 AUTHENTIC IMAGE BENCHMARK", flush=True)
    print("="*60, flush=True)

    ai_dir = r"d:\SecuraAI2\data\online_dataset\ai"
    real_dir = r"d:\SecuraAI2\data\online_dataset\real"

    ai_files = sorted([f for f in os.listdir(ai_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])[:50]
    real_files = sorted([f for f in os.listdir(real_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])[:50]

    assert len(ai_files) == 50, f"Expected 50 AI files, found {len(ai_files)}"
    assert len(real_files) == 50, f"Expected 50 Real files, found {len(real_files)}"

    tp = 0  # AI predicted AI
    fn = 0  # AI predicted Real
    tn = 0  # Real predicted Real
    fp = 0  # Real predicted AI

    results = []

    print("\n--- Evaluating 50 AI Images ---", flush=True)
    for i, fname in enumerate(ai_files, 1):
        fpath = os.path.join(ai_dir, fname)
        t0 = time.time()
        mime = "image/png" if fname.lower().endswith(".png") else "image/jpeg"
        with open(fpath, "rb") as f:
            resp = requests.post(
                f"{API_BASE}/api/v1/analyze/image?probe=Ensemble",
                files={"file": (fname, f, mime)},
                timeout=15
            )
        lat = round((time.time() - t0) * 1000, 1)

        if resp.status_code == 200:
            data = resp.json()
            cv = data.get("canonical_verdict", {})
            pred = cv.get("predicted_label", "UNKNOWN")
            score = cv.get("model_score", 0.0)
            is_ai = ("AI" in pred and "NOT" not in pred) or score >= 0.50
            if is_ai:
                tp += 1
                status = "PASS (AI Detected)"
            else:
                fn += 1
                status = "FAIL (Missed AI)"
            print(f"[{i:02d}/50] AI: {fname[:35]} -> Score: {score:.4f} | {pred} | {status} ({lat}ms)", flush=True)
            results.append({"type": "image", "file": fname, "ground_truth": "AI", "predicted": pred, "score": score, "latency_ms": lat})
        else:
            fn += 1
            print(f"[{i:02d}/50] AI: {fname[:35]} -> HTTP {resp.status_code}: {resp.text[:100]}", flush=True)
            results.append({"type": "image", "file": fname, "ground_truth": "AI", "error": resp.text, "latency_ms": lat})

    print("\n--- Evaluating 50 Authentic Real Images ---", flush=True)
    for i, fname in enumerate(real_files, 1):
        fpath = os.path.join(real_dir, fname)
        t0 = time.time()
        mime = "image/png" if fname.lower().endswith(".png") else "image/jpeg"
        with open(fpath, "rb") as f:
            resp = requests.post(
                f"{API_BASE}/api/v1/analyze/image?probe=Ensemble",
                files={"file": (fname, f, mime)},
                timeout=15
            )
        lat = round((time.time() - t0) * 1000, 1)

        if resp.status_code == 200:
            data = resp.json()
            cv = data.get("canonical_verdict", {})
            pred = cv.get("predicted_label", "UNKNOWN")
            score = cv.get("model_score", 0.0)
            is_real = ("NOT" in pred or "REAL" in pred or "AUTHENTIC" in pred) or score < 0.50
            if is_real:
                tn += 1
                status = "PASS (Authentic)"
            else:
                fp += 1
                status = "FAIL (False Alarm)"
            print(f"[{i:02d}/50] REAL: {fname[:35]} -> Score: {score:.4f} | {pred} | {status} ({lat}ms)", flush=True)
            results.append({"type": "image", "file": fname, "ground_truth": "REAL", "predicted": pred, "score": score, "latency_ms": lat})
        else:
            fp += 1
            print(f"[{i:02d}/50] REAL: {fname[:35]} -> HTTP {resp.status_code}: {resp.text[:100]}", flush=True)
            results.append({"type": "image", "file": fname, "ground_truth": "REAL", "error": resp.text, "latency_ms": lat})

    img_acc = (tp + tn) / 100.0
    img_prec = tp / (tp + fp) if (tp + fp) > 0 else 0
    img_rec = tp / (tp + fn) if (tp + fn) > 0 else 0
    img_f1 = (2 * img_prec * img_rec) / (img_prec + img_rec) if (img_prec + img_rec) > 0 else 0

    print("\n" + "="*40, flush=True)
    print("IMAGE BENCHMARK SUMMARY (100 SAMPLES):", flush=True)
    print(f"Total AI Tested: 50   | True AI Detected (TP): {tp} | Missed (FN): {fn}", flush=True)
    print(f"Total Real Tested: 50 | True Authentic (TN): {tn} | False Alarms (FP): {fp}", flush=True)
    print(f"Overall Accuracy: {img_acc*100:.1f}%", flush=True)
    print(f"Precision: {img_prec*100:.1f}% | Recall: {img_rec*100:.1f}% | F1: {img_f1:.4f}", flush=True)
    print("="*40, flush=True)

    return {
        "tp": tp, "fn": fn, "tn": tn, "fp": fp,
        "accuracy": img_acc, "precision": img_prec, "recall": img_rec, "f1": img_f1,
        "details": results
    }


def test_video_benchmark():
    print("\n" + "="*60, flush=True)
    print("STEP 2: 20 AI + 20 AUTHENTIC VIDEO BENCHMARK", flush=True)
    print("="*60, flush=True)

    ai_vids_dir = r"d:\SecuraAI2\data\benchmark_videos\test_suite_20_ai"
    real_vids_dir = r"d:\SecuraAI2\data\benchmark_videos\test_suite_20_real"

    ai_files = sorted([f for f in os.listdir(ai_vids_dir) if f.endswith(".mp4")])[:20]
    real_files = sorted([f for f in os.listdir(real_vids_dir) if f.endswith(".mp4")])[:20]

    assert len(ai_files) == 20, f"Expected 20 AI videos, found {len(ai_files)}"
    assert len(real_files) == 20, f"Expected 20 Real videos, found {len(real_files)}"

    tp = 0  # AI predicted AI
    fn = 0  # AI predicted Real
    tn = 0  # Real predicted Real
    fp = 0  # Real predicted AI

    results = []

    print("\n--- Evaluating 20 AI Videos ---", flush=True)
    for i, fname in enumerate(ai_files, 1):
        fpath = os.path.join(ai_vids_dir, fname)
        t0 = time.time()
        with open(fpath, "rb") as f:
            resp = requests.post(
                f"{API_BASE}/api/v1/analyze/video",
                files={"file": (fname, f, "video/mp4")},
                timeout=60
            )
        lat = round((time.time() - t0) * 1000, 1)

        if resp.status_code == 200:
            data = resp.json()
            cv = data.get("canonical_verdict") or {}
            pred = cv.get("predicted_label", "")
            score = cv.get("model_score", 0.0)
            is_ai = ("AI" in pred and "NOT" not in pred) or ("MANIPULATED" in pred) or score >= 0.50
            if is_ai:
                tp += 1
                status = "PASS (AI Video Detected)"
            else:
                fn += 1
                status = "FAIL (Missed AI Video)"
            print(f"[{i:02d}/20] AI VID: {fname[:35]} -> Score: {score:.4f} | {pred} | {status} ({lat}ms)", flush=True)
            results.append({"type": "video", "file": fname, "ground_truth": "AI", "predicted": pred, "score": score, "latency_ms": lat})
        else:
            fn += 1
            print(f"[{i:02d}/20] AI VID: {fname[:35]} -> HTTP {resp.status_code}: {resp.text[:100]}", flush=True)
            results.append({"type": "video", "file": fname, "ground_truth": "AI", "error": resp.text, "latency_ms": lat})

    print("\n--- Evaluating 20 Authentic Real Videos ---", flush=True)
    for i, fname in enumerate(real_files, 1):
        fpath = os.path.join(real_vids_dir, fname)
        t0 = time.time()
        with open(fpath, "rb") as f:
            resp = requests.post(
                f"{API_BASE}/api/v1/analyze/video",
                files={"file": (fname, f, "video/mp4")},
                timeout=60
            )
        lat = round((time.time() - t0) * 1000, 1)

        if resp.status_code == 200:
            data = resp.json()
            cv = data.get("canonical_verdict") or {}
            pred = cv.get("predicted_label", "")
            score = cv.get("model_score", 0.0)
            is_real = ("NOT" in pred or "REAL" in pred or "AUTHENTIC" in pred) or score < 0.50
            if is_real:
                tn += 1
                status = "PASS (Authentic Real Video)"
            else:
                fp += 1
                status = "FAIL (False Alarm)"
            print(f"[{i:02d}/20] REAL VID: {fname[:35]} -> Score: {score:.4f} | {pred} | {status} ({lat}ms)", flush=True)
            results.append({"type": "video", "file": fname, "ground_truth": "REAL", "predicted": pred, "score": score, "latency_ms": lat})
        else:
            fp += 1
            print(f"[{i:02d}/20] REAL VID: {fname[:35]} -> HTTP {resp.status_code}: {resp.text[:100]}", flush=True)
            results.append({"type": "video", "file": fname, "ground_truth": "REAL", "error": resp.text, "latency_ms": lat})

    vid_acc = (tp + tn) / 40.0
    vid_prec = tp / (tp + fp) if (tp + fp) > 0 else 0
    vid_rec = tp / (tp + fn) if (tp + fn) > 0 else 0

    print("\n" + "="*40, flush=True)
    print("VIDEO BENCHMARK SUMMARY (40 SAMPLES):", flush=True)
    print(f"Total AI Videos: 20   | Detected (TP): {tp} | Missed (FN): {fn}", flush=True)
    print(f"Total Real Videos: 20 | Authentic (TN): {tn} | False Alarms (FP): {fp}", flush=True)
    print(f"Video Overall Accuracy: {vid_acc*100:.1f}%", flush=True)
    print(f"Video Precision: {vid_prec*100:.1f}% | Recall: {vid_rec*100:.1f}%", flush=True)
    print("="*40, flush=True)

    return {
        "tp": tp, "fn": fn, "tn": tn, "fp": fp,
        "accuracy": vid_acc, "precision": vid_prec, "recall": vid_rec,
        "details": results
    }


def test_live_shield_and_screenshare():
    print("\n" + "="*60, flush=True)
    print("STEP 3: LIVE STREAM & SCREEN SHARE SENTINEL VERIFICATION", flush=True)
    print("="*60, flush=True)

    from app.services.live_shield_service import LiveShieldService

    shield = LiveShieldService()

    tests = []

    # Test 1: Clean screen share of light document / typography
    doc_frame = np.full((720, 1280, 3), 245, dtype=np.uint8)
    cv2.putText(doc_frame, "Secura AI - Enterprise System Manual", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (20, 20, 20), 2)
    for i in range(12):
        cv2.putText(doc_frame, f"System Requirement Section {i+1}: Standardized font styling and telemetry.", (50, 130 + i * 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 1)

    _, enc1 = cv2.imencode(".jpg", cv2.cvtColor(doc_frame, cv2.COLOR_RGB2BGR))
    res1 = shield.analyze_live_stream_frame(enc1.tobytes())
    t1_pass = res1["verdict"] == "LIVE_AUTHENTIC_STREAM" and res1["neural_ai_score"] < 0.20
    print(f"Screen Share (Light Doc/Text Font): {res1['verdict']} | Score: {res1['neural_ai_score']} | {'PASS (No Font False Alarm)' if t1_pass else 'FAIL'}", flush=True)
    tests.append({"name": "Screen Share (Light Doc/Text)", "pass": t1_pass, "result": res1})

    # Test 2: Clean screen share of dark code editor (VS Code style)
    code_frame = np.full((720, 1280, 3), 32, dtype=np.uint8)
    cv2.putText(code_frame, "import torch; import torchvision", (50, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (120, 220, 255), 2)
    for i in range(12):
        cv2.putText(code_frame, f"def evaluate_layer_{i}(tensor): return tensor.relu()", (50, 120 + i * 38), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)

    _, enc2 = cv2.imencode(".jpg", cv2.cvtColor(code_frame, cv2.COLOR_RGB2BGR))
    res2 = shield.analyze_live_stream_frame(enc2.tobytes())
    t2_pass = res2["verdict"] == "LIVE_AUTHENTIC_STREAM" and res2["neural_ai_score"] < 0.20
    print(f"Screen Share (Dark IDE/Code Font): {res2['verdict']} | Score: {res2['neural_ai_score']} | {'PASS (No Code False Alarm)' if t2_pass else 'FAIL'}", flush=True)
    tests.append({"name": "Screen Share (Dark IDE/Code)", "pass": t2_pass, "result": res2})

    # Test 3: Screen share containing an AI Image on screen
    screen_with_ai = doc_frame.copy()
    ai_img = cv2.imread(r"d:\SecuraAI2\data\online_dataset\ai\img_002_-using-generative-ai-technology-landscape-pattern-abstract-concept-269270897.jpg")
    if ai_img is not None:
        ai_crop = cv2.resize(ai_img, (400, 300))
        screen_with_ai[200:500, 400:800] = cv2.cvtColor(ai_crop, cv2.COLOR_BGR2RGB)

    _, enc3 = cv2.imencode(".jpg", cv2.cvtColor(screen_with_ai, cv2.COLOR_RGB2BGR))
    res3 = shield.analyze_live_stream_frame(enc3.tobytes())
    t3_pass = res3["verdict"] == "DEEPFAKE_INJECTION_DETECTED" and res3["neural_ai_score"] >= 0.48
    print(f"Screen Share with AI Art: {res3['verdict']} | Score: {res3['neural_ai_score']} | {'PASS (AI Detected)' if t3_pass else 'FAIL'}", flush=True)
    tests.append({"name": "Screen Share with AI Art", "pass": t3_pass, "result": res3})

    # Test 4: Live Webcam stream with phone presenting subtle/small AI image
    webcam_feed = np.full((720, 1280, 3), (120, 140, 150), dtype=np.uint8) # room background
    cv2.circle(webcam_feed, (200, 300), 120, (180, 150, 130), -1) # person silhouette
    # Add a phone displaying an AI image
    if ai_img is not None:
        phone_screen = cv2.resize(ai_img, (220, 280)) # small phone screen (~1.2% area)
        webcam_feed[250:530, 500:720] = cv2.cvtColor(phone_screen, cv2.COLOR_BGR2RGB)

    _, enc4 = cv2.imencode(".jpg", cv2.cvtColor(webcam_feed, cv2.COLOR_RGB2BGR))
    res4 = shield.analyze_live_stream_frame(enc4.tobytes())
    t4_pass = res4["verdict"] == "DEEPFAKE_INJECTION_DETECTED" and res4["neural_ai_score"] >= 0.48
    print(f"Live Stream with Presented AI Image: {res4['verdict']} | Score: {res4['neural_ai_score']} | {'PASS (Subtle AI Caught)' if t4_pass else 'FAIL'}", flush=True)
    tests.append({"name": "Live Stream with Presented AI Image", "pass": t4_pass, "result": res4})

    # Test 5: Live Webcam stream with authentic human face and natural rPPG
    face_sample = cv2.imread(r"d:\SecuraAI2\data\online_dataset\real\img_001_-man-sits-with-a-woman-on-her-phone-at-a-table-while-looking-at-a-computer_l.jpg")
    if face_sample is not None:
        authentic_feed = cv2.resize(face_sample, (1280, 720))
        authentic_feed = cv2.cvtColor(authentic_feed, cv2.COLOR_BGR2RGB)
    else:
        authentic_feed = np.full((720, 1280, 3), (140, 160, 170), dtype=np.uint8)

    shield2 = LiveShieldService() # fresh instance
    for frame_idx in range(16):
        var_feed = authentic_feed.copy()
        noise = (np.sin(frame_idx * 0.4) * 3).astype(np.int16)
        var_feed = np.clip(var_feed.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        _, enc_human = cv2.imencode(".jpg", cv2.cvtColor(var_feed, cv2.COLOR_RGB2BGR))
        res5 = shield2.analyze_live_stream_frame(enc_human.tobytes())

    t5_pass = res5["verdict"] == "LIVE_AUTHENTIC_STREAM" and res5["neural_ai_score"] < 0.48
    print(f"Live Stream (Authentic Human): {res5['verdict']} | Score: {res5['neural_ai_score']} | BPM: {res5.get('estimated_pulse_bpm')} | {'PASS (Verified Authentic)' if t5_pass else 'FAIL'}", flush=True)
    tests.append({"name": "Live Stream (Authentic Human)", "pass": t5_pass, "result": res5})

    return tests

if __name__ == "__main__":
    t_start = time.time()
    img_report = test_image_benchmark()
    vid_report = test_video_benchmark()
    live_report = test_live_shield_and_screenshare()

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_duration_sec": round(time.time() - t_start, 2),
        "image_benchmark": img_report,
        "video_benchmark": vid_report,
        "live_and_screenshare": live_report
    }

    out_file = r"d:\SecuraAI2\audit_benchmark_results.json"
    with open(out_file, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "="*60, flush=True)
    print(f"COMPREHENSIVE AUDIT COMPLETE. Results saved to {out_file}", flush=True)
    print("="*60, flush=True)
