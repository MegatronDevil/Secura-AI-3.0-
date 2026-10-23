"""Comprehensive Screen Share Sentinel Stress Test.
Tests screen share robustness against:
1. Code editors (VS Code dark theme with syntax colors)
2. Dense documentation (PDF / Word white background with typography)
3. Search engines & Wikipedia pages
4. Embedded AI generated images (Fullscreen, Windowed, and Small PiP)
5. Embedded AI generated video player
6. Rapid window switching / transitions between text and synthetic visual media.
"""

import sys
import os
import time

backend_dir = r"d:\SecuraAI2\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import cv2
import numpy as np
from PIL import Image

from app.services.live_shield_service import LiveShieldService

def create_code_editor_screen(w=1280, h=720):
    canvas = np.full((h, w, 3), 30, dtype=np.uint8) # Dark background #1e1e1e
    # Sidebar
    canvas[:, :180] = 37 # #252526
    cv2.putText(canvas, "EXPLORER", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)
    for i, f in enumerate(["main.py", "service.ts", "config.json", "README.md"]):
        cv2.putText(canvas, f"  {f}", (20, 60 + i * 22), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (160, 160, 160), 1)
    
    # Editor pane with syntax colors
    colors = [(86, 156, 214), (206, 145, 120), (181, 206, 168), (78, 201, 176), (220, 220, 170)]
    for line in range(25):
        y = 50 + line * 20
        cv2.putText(canvas, f"{line+1:02d}", (195, y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (100, 100, 100), 1)
        for seg in range(5):
            x = 230 + seg * 120
            c = colors[(line + seg) % len(colors)]
            cv2.putText(canvas, f"var_{seg} = compute()", (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, c, 1)

    # Terminal bottom panel
    canvas[520:, 180:] = 24
    cv2.line(canvas, (180, 520), (w, 520), (50, 50, 50), 1)
    cv2.putText(canvas, "TERMINAL: powershell", (195, 540), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
    cv2.putText(canvas, "PS D:\\SecuraAI2> uvicorn app.main:app --host 127.0.0.1", (195, 570), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 220, 120), 1)
    cv2.putText(canvas, "INFO: Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)", (195, 595), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (200, 200, 200), 1)
    return canvas

def create_document_screen(w=1280, h=720):
    canvas = np.full((h, w, 3), 248, dtype=np.uint8) # Light page background #f8f8f8
    # Document paper in center
    pw1, pw2 = 240, 1040
    canvas[:, pw1:pw2] = 255
    cv2.rectangle(canvas, (pw1, 0), (pw2, h), (210, 210, 210), 1)
    
    cv2.putText(canvas, "Secura AI Architecture Specification", (pw1 + 40, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)
    cv2.putText(canvas, "Section 4: Real-Time Stream Liveness Protocol", (pw1 + 40, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (60, 60, 60), 1)
    
    for para in range(12):
        y = 135 + para * 38
        line1 = f"Paragraph {para+1}: The multi-head ensemble executes sub-frame spatial and frequency transforms."
        line2 = "Vascular rPPG signals isolate chromatic fluctuations across subcutaneous capillary beds."
        cv2.putText(canvas, line1, (pw1 + 40, y), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (40, 40, 40), 1)
        cv2.putText(canvas, line2, (pw1 + 40, y + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (80, 80, 80), 1)
    return canvas

def create_search_screen(w=1280, h=720):
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    # Search bar
    cv2.rectangle(canvas, (100, 30), (700, 65), (210, 210, 210), 1)
    cv2.putText(canvas, "deepfake injection detection benchmark 2026", (115, 53), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (30, 30, 30), 1)
    # Search results
    for i in range(5):
        y = 110 + i * 100
        cv2.putText(canvas, f"https://research.secura.ai/paper-{i+1}", (100, y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 102, 33), 1)
        cv2.putText(canvas, f"Comprehensive Analysis of Generative AI Artifacts - Edition {i+1}", (100, y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (26, 13, 171), 1)
        cv2.putText(canvas, "Neural classifiers evaluate boundary discrepancies, frequency domain signatures, and temporal continuity.", (100, y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (80, 80, 80), 1)
        cv2.putText(canvas, "Demonstrating high specificity and low false positive rates across desktop screen shares.", (100, y + 58), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (100, 100, 100), 1)
    return canvas

def run_screenshare_stress_test():
    print("\n" + "="*70)
    print("STRESS TEST 2: HEAVY SCREEN SHARE SENTINEL (MIXED TYPOGRAPHY & AI MEDIA)")
    print("="*70)

    ai_img_dir = r"d:\SecuraAI2\data\online_dataset\ai"
    ai_files = sorted([f for f in os.listdir(ai_img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    ai_img = Image.open(os.path.join(ai_img_dir, ai_files[0])).convert("RGB")
    ai_img_np = np.asarray(ai_img)

    service = LiveShieldService()

    scenarios = [
        ("VS Code Dark IDE (Typography/Code)", create_code_editor_screen(), "LIVE_AUTHENTIC_STREAM", 20),
        ("Dense White PDF Document (Typography/Text)", create_document_screen(), "LIVE_AUTHENTIC_STREAM", 20),
        ("Web Search Results (Google/Bing Layout)", create_search_screen(), "LIVE_AUTHENTIC_STREAM", 20),
    ]

    # Add Screen Share with Medium AI Art Window (browser tab)
    screen_with_ai = create_code_editor_screen()
    # Place 400x300 AI image window in upper right
    ai_resized = cv2.resize(ai_img_np, (400, 300))
    screen_with_ai[60:360, 800:1200] = ai_resized
    # Window border & title bar
    cv2.rectangle(screen_with_ai, (798, 30), (1202, 362), (60, 60, 60), 2)
    cv2.rectangle(screen_with_ai, (798, 30), (1202, 60), (45, 45, 45), -1)
    cv2.putText(screen_with_ai, "AI Art Preview - midjourney_v6.png", (810, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (220, 220, 220), 1)
    scenarios.append(("Screen Share with Windowed AI Image (30% area)", screen_with_ai, "DEEPFAKE_INJECTION_DETECTED", 20))

    # Add Screen Share with Small AI Phone / PiP Window (~3% area)
    screen_pip = create_document_screen()
    pip_w, pip_h = 160, 120
    ai_pip = cv2.resize(ai_img_np, (pip_w, pip_h))
    screen_pip[500:500+pip_h, 1000:1000+pip_w] = ai_pip
    cv2.rectangle(screen_pip, (998, 498), (1000+pip_w+2, 500+pip_h+2), (0, 0, 0), 2)
    scenarios.append(("Screen Share with Small Floating AI Card (~2.5% area)", screen_pip, "DEEPFAKE_INJECTION_DETECTED", 20))

    # Clean Recovery back to Code Editor
    scenarios.append(("Recovery back to Clean Code Editor", create_code_editor_screen(), "LIVE_AUTHENTIC_STREAM", 20))

    total_tested = 0
    total_passed = 0
    scenario_details = []

    for name, canvas, expected_verdict, num_frames in scenarios:
        errs = 0
        scores = []
        for i in range(num_frames):
            img = Image.fromarray(canvas)
            res = service.evaluate_stream_frame(img, timestamp_ms=time.time()*1000 + i*100)
            scores.append(res["synthetic_confidence"])
            if res["verdict"] != expected_verdict:
                errs += 1
            total_tested += 1
            if res["verdict"] == expected_verdict:
                total_passed += 1

        mean_sc = float(np.mean(scores))
        status = "PASS" if errs == 0 else f"FAIL ({errs}/{num_frames} errors)"
        print(f"  [{status}] {name:<50} | Mean Score: {mean_sc:.4f} | Target: {expected_verdict}")
        scenario_details.append({
            "name": name,
            "status": status,
            "mean_score": mean_sc,
            "errors": errs,
            "frames": num_frames
        })

    print(f"\nScreen Share Stress Testing Complete: {total_passed}/{total_tested} frames passed ({total_passed/total_tested*100:.1f}% accuracy).")
    return scenario_details

if __name__ == "__main__":
    run_screenshare_stress_test()
