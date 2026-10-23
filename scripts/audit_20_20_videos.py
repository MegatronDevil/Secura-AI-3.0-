import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.video_forensics import analyze_video_stream

def audit_videos():
    bench_dir = Path(__file__).resolve().parent.parent / "data" / "benchmark_videos"
    ai_dir = bench_dir / "test_suite_20_ai"
    real_dir = bench_dir / "test_suite_20_real"

    ai_files = sorted(list(ai_dir.glob("*.mp4")))[:20]
    real_files = sorted(list(real_dir.glob("*.mp4")))[:20]

    print(f"Testing {len(ai_files)} AI videos and {len(real_files)} Real videos...")

    ai_ok = 0
    real_ok = 0

    print("\n--- Evaluating 20 AI Videos ---")
    for idx, f in enumerate(ai_files):
        try:
            bytes_data = f.read_bytes()
            res = analyze_video_stream(
                video_bytes=bytes_data,
                filename=f.name,
                sample_interval_sec=0.5,
                max_samples=12,
                preset="fast"
            )
            cv = getattr(res, "canonical_verdict", None)
            score = cv.model_score if cv else 0.5
            is_ai = cv.predicted_label == "AI_GENERATED" if cv else (score >= 0.50)
            if is_ai:
                ai_ok += 1
                print(f"[{idx+1}/20] AI PASS: {f.name} -> score={score:.4f}")
            else:
                print(f"[{idx+1}/20] AI FAIL: {f.name} -> score={score:.4f}, label={cv.predicted_label if cv else 'NONE'}")
        except Exception as e:
            print(f"[{idx+1}/20] AI ERROR on {f.name}: {e}")

    print(f"\nAI Video Accuracy: {ai_ok}/{len(ai_files)} ({ai_ok/max(1, len(ai_files))*100:.1f}%)")

    print("\n--- Evaluating 20 Real Videos ---")
    for idx, f in enumerate(real_files):
        try:
            bytes_data = f.read_bytes()
            res = analyze_video_stream(
                video_bytes=bytes_data,
                filename=f.name,
                sample_interval_sec=0.5,
                max_samples=12,
                preset="fast"
            )
            cv = getattr(res, "canonical_verdict", None)
            score = cv.model_score if cv else 0.5
            is_real = cv.predicted_label == "NOT_AI_GENERATED" if cv else (score < 0.50)
            if is_real:
                real_ok += 1
                print(f"[{idx+1}/20] REAL PASS: {f.name} -> score={score:.4f}")
            else:
                print(f"[{idx+1}/20] REAL FAIL: {f.name} -> score={score:.4f}, label={cv.predicted_label if cv else 'NONE'}")
        except Exception as e:
            print(f"[{idx+1}/20] REAL ERROR on {f.name}: {e}")

    print(f"\nReal Video Accuracy: {real_ok}/{len(real_files)} ({real_ok/max(1, len(real_files))*100:.1f}%)")
    total_acc = (ai_ok + real_ok) / (len(ai_files) + len(real_files)) * 100
    print(f"\nTotal Video Accuracy: {ai_ok + real_ok}/{len(ai_files) + len(real_files)} ({total_acc:.1f}%)")

if __name__ == "__main__":
    audit_videos()
