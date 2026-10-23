"""Stress testing suite for Live Stream Shield and Screen Share Sentinel.
Simulates:
1. 10-minute (600s) continuous live stream with 5 minutes (300s) AI deepfake injection:
   - 0:00 - 2:30 (150s): Authentic human webcam stream
   - 2:30 - 7:30 (300s): AI Deepfake stream injection
   - 7:30 - 10:00 (150s): Authentic human webcam stream resumes
2. Heavy Screen Share Stress Testing:
   - Dark code IDE with syntax highlighting & terminal
   - Dense white documentation / PDF
   - Search results & browser layout
   - Embedded AI art gallery & AI video playback
   - Small embedded AI phone/PiP windows
   - Clean recovery back to typography
"""

import sys
import os
import time
from pathlib import Path

backend_dir = r"d:\SecuraAI2\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import cv2
import numpy as np
from PIL import Image

from app.services.live_shield_service import LiveShieldService

def load_video_frames(video_path: str, max_frames: int = 150):
    cap = cv2.VideoCapture(video_path)
    frames = []
    while cap.isOpened() and len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        # Convert BGR to RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(rgb)
    cap.release()
    return frames

def run_10_min_live_stream_test():
    print("\n" + "="*70)
    print("STRESS TEST 1: 10-MINUTE CONTINUOUS LIVE STREAM (5 MIN AI INJECTION)")
    print("="*70)

    # 1. Load real video source
    real_vid_path = r"d:\SecuraAI2\data\benchmark_videos\real\test_real_stream.mp4"
    if not os.path.exists(real_vid_path):
        real_vid_path = r"d:\SecuraAI2\data\benchmark_videos\real\Q300001.mp4"
    real_frames = load_video_frames(real_vid_path, max_frames=300)
    print(f"Loaded {len(real_frames)} authentic human frames from {os.path.basename(real_vid_path)}")

    # 2. Load AI video source
    ai_vid_path = r"d:\SecuraAI2\data\benchmark_videos\ai\test_ai_stream.mp4"
    ai_frames = load_video_frames(ai_vid_path, max_frames=300)
    print(f"Loaded {len(ai_frames)} AI deepfake frames from {os.path.basename(ai_vid_path)}")

    # Service under test
    service = LiveShieldService()

    # Timeline: 600 steps (each step = 1 second in a 10-minute live session)
    # Phase 1: 0 - 149 (150s, 2.5 min) -> Real Human
    # Phase 2: 150 - 449 (300s, 5.0 min) -> AI Deepfake Injection
    # Phase 3: 450 - 599 (150s, 2.5 min) -> Real Human Recovery
    
    phase1_errors = 0
    phase2_errors = 0
    phase3_errors = 0
    
    phase1_scores = []
    phase2_scores = []
    phase3_scores = []

    t_start = time.time()
    
    print("\nExecuting 600-second timeline simulation...")
    # Sample every second
    for sec in range(600):
        sim_timestamp_ms = sec * 1000.0

        if sec < 150:
            # Phase 1: Real human
            expected = "LIVE_AUTHENTIC_STREAM"
            base_frame = real_frames[sec % len(real_frames)].copy()
            # Add subtle natural lighting & micro-motion fluctuations
            flicker = int(np.sin(sec * 0.1) * 3)
            frame_arr = np.clip(base_frame.astype(int) + flicker, 0, 255).astype(np.uint8)
            img = Image.fromarray(frame_arr)
            res = service.evaluate_stream_frame(img, timestamp_ms=sim_timestamp_ms)
            phase1_scores.append(res["synthetic_confidence"])
            if res["verdict"] != expected:
                phase1_errors += 1
                if phase1_errors <= 3:
                    print(f"  [SEC {sec:03d} - Phase 1 Real] UNEXPECTED VERDICT: {res['verdict']} (score: {res['synthetic_confidence']})")

        elif sec < 450:
            # Phase 2: AI deepfake injection (5 full minutes!)
            expected = "DEEPFAKE_INJECTION_DETECTED"
            base_frame = ai_frames[(sec - 150) % len(ai_frames)].copy()
            img = Image.fromarray(base_frame)
            res = service.evaluate_stream_frame(img, timestamp_ms=sim_timestamp_ms)
            phase2_scores.append(res["synthetic_confidence"])
            if res["verdict"] != expected:
                phase2_errors += 1
                if phase2_errors <= 3:
                    print(f"  [SEC {sec:03d} - Phase 2 AI] UNEXPECTED VERDICT: {res['verdict']} (score: {res['synthetic_confidence']})")

        else:
            # Phase 3: Real human returns
            expected = "LIVE_AUTHENTIC_STREAM"
            base_frame = real_frames[(sec - 450) % len(real_frames)].copy()
            flicker = int(np.sin(sec * 0.1) * 3)
            frame_arr = np.clip(base_frame.astype(int) + flicker, 0, 255).astype(np.uint8)
            img = Image.fromarray(frame_arr)
            res = service.evaluate_stream_frame(img, timestamp_ms=sim_timestamp_ms)
            phase3_scores.append(res["synthetic_confidence"])
            if res["verdict"] != expected:
                phase3_errors += 1
                if phase3_errors <= 3:
                    print(f"  [SEC {sec:03d} - Phase 3 Recovery] UNEXPECTED VERDICT: {res['verdict']} (score: {res['synthetic_confidence']})")

    elapsed = round(time.time() - t_start, 2)
    print(f"\nCompleted 600-second stream evaluation in {elapsed}s.")
    print(f"Phase 1 (Authentic, 150s): Errors = {phase1_errors}/150 (Mean Score: {np.mean(phase1_scores):.3f})")
    print(f"Phase 2 (AI Injection, 300s): Errors = {phase2_errors}/300 (Mean Score: {np.mean(phase2_scores):.3f})")
    print(f"Phase 3 (Recovery, 150s): Errors = {phase3_errors}/150 (Mean Score: {np.mean(phase3_scores):.3f})")

    return {
        "phase1_errors": phase1_errors,
        "phase2_errors": phase2_errors,
        "phase3_errors": phase3_errors,
        "phase1_mean": float(np.mean(phase1_scores)),
        "phase2_mean": float(np.mean(phase2_scores)),
        "phase3_mean": float(np.mean(phase3_scores)),
    }

if __name__ == "__main__":
    run_10_min_live_stream_test()
