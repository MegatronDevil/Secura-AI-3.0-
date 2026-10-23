import os
import io
import tempfile
import logging
from typing import Dict, Any, Tuple
import cv2

logger = logging.getLogger(__name__)


def extract_video_segment(
    video_bytes: bytes,
    start_sec: float,
    end_sec: float,
    filename: str = "video.mp4"
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Extracts an isolated video clip between start_sec and end_sec using OpenCV VideoWriter.
    Returns (clipped_mp4_bytes, metadata_dict).
    """
    if start_sec < 0:
        start_sec = 0.0
    if end_sec <= start_sec:
        end_sec = start_sec + 3.0

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as in_temp:
        in_temp.write(video_bytes)
        in_temp_path = in_temp.name

    out_temp_path = in_temp_path + "_clip.mp4"

    try:
        cap = cv2.VideoCapture(in_temp_path)
        if not cap.isOpened():
            raise ValueError("Could not open input video with OpenCV decoder.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0.0

        actual_end = min(end_sec, duration) if duration > 0 else end_sec
        start_frame = int(start_sec * fps)
        end_frame = int(actual_end * fps)

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(out_temp_path, fourcc, fps, (width, height))

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        curr_frame = start_frame
        extracted_count = 0

        while curr_frame <= end_frame:
            ret, frame = cap.read()
            if not ret:
                break
            writer.write(frame)
            extracted_count += 1
            curr_frame += 1

        cap.release()
        writer.release()

        with open(out_temp_path, "rb") as out_f:
            clip_bytes = out_f.read()

        meta = {
            "original_filename": filename,
            "clip_filename": f"evidence_clip_{start_sec:.1f}s_to_{actual_end:.1f}s_{filename}",
            "start_sec": round(start_sec, 2),
            "end_sec": round(actual_end, 2),
            "duration_sec": round(actual_end - start_sec, 2),
            "fps": fps,
            "width": width,
            "height": height,
            "frame_count": extracted_count,
            "size_bytes": len(clip_bytes)
        }
        return clip_bytes, meta

    finally:
        for p in (in_temp_path, out_temp_path):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass
