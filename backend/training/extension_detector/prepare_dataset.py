"""
Extension-Specific Image Dataset Preparation Pipeline.
Strict Data Leakage Prevention: Splits by parent source image.
All transformed variants (JPEG Q75, Q55, downscale, thumbnail, canvas re-encode, crop)
remain strictly within the parent image's assigned split.
"""

import os
import json
import hashlib
import random
from pathlib import Path
from PIL import Image

def get_file_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def generate_transformations(src_path: Path, output_dir: Path, base_id: str, label: str):
    """
    Generate web-realistic transformations:
    - original copy/link
    - jpeg_q75
    - jpeg_q55
    - downscale_50
    - thumbnail_320
    - canvas_png (metadata stripped, RGB re-encoded)
    - crop_80
    """
    try:
        with Image.open(src_path) as img:
            rgb_img = img.convert("RGB")
            w, h = rgb_img.size
            if w < 64 or h < 64:
                return []
    except Exception as e:
        print(f"Skipping corrupt or unreadable image {src_path}: {e}")
        return []

    transforms = []
    
    # 1. Original format
    orig_name = f"{base_id}_orig.jpg"
    orig_out = output_dir / orig_name
    rgb_img.save(orig_out, "JPEG", quality=95)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_orig",
        "file_path": str(orig_out.resolve()),
        "label": label,
        "transform_type": "original",
        "sha256": get_file_sha256(orig_out),
        "source_path": str(src_path.resolve())
    })

    # 2. JPEG Q75 (standard social media / CDN delivery)
    q75_name = f"{base_id}_jpeg_q75.jpg"
    q75_out = output_dir / q75_name
    rgb_img.save(q75_out, "JPEG", quality=75)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_jpeg_q75",
        "file_path": str(q75_out.resolve()),
        "label": label,
        "transform_type": "jpeg_q75",
        "sha256": get_file_sha256(q75_out),
        "source_path": str(src_path.resolve())
    })

    # 3. JPEG Q55 (aggressive mobile / bandwidth compression)
    q55_name = f"{base_id}_jpeg_q55.jpg"
    q55_out = output_dir / q55_name
    rgb_img.save(q55_out, "JPEG", quality=55)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_jpeg_q55",
        "file_path": str(q55_out.resolve()),
        "label": label,
        "transform_type": "jpeg_q55",
        "sha256": get_file_sha256(q55_out),
        "source_path": str(src_path.resolve())
    })

    # 4. Downscaled 50%
    new_w, new_h = max(32, w // 2), max(32, h // 2)
    downscaled = rgb_img.resize((new_w, new_h), Image.Resampling.BILINEAR)
    down_name = f"{base_id}_downscale50.jpg"
    down_out = output_dir / down_name
    downscaled.save(down_out, "JPEG", quality=80)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_downscale50",
        "file_path": str(down_out.resolve()),
        "label": label,
        "transform_type": "downscale_50",
        "sha256": get_file_sha256(down_out),
        "source_path": str(src_path.resolve())
    })

    # 5. Thumbnail 320x320
    thumb = rgb_img.copy()
    thumb.thumbnail((320, 320), Image.Resampling.LANCZOS)
    thumb_name = f"{base_id}_thumb320.jpg"
    thumb_out = output_dir / thumb_name
    thumb.save(thumb_out, "JPEG", quality=80)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_thumb320",
        "file_path": str(thumb_out.resolve()),
        "label": label,
        "transform_type": "thumbnail_320",
        "sha256": get_file_sha256(thumb_out),
        "source_path": str(src_path.resolve())
    })

    # 6. Canvas / PNG Export (stripping EXIF metadata, common in Chrome Extension DOM acquisitions)
    canvas_name = f"{base_id}_canvas.png"
    canvas_out = output_dir / canvas_name
    rgb_img.save(canvas_out, "PNG", optimize=True)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_canvas",
        "file_path": str(canvas_out.resolve()),
        "label": label,
        "transform_type": "canvas_png",
        "sha256": get_file_sha256(canvas_out),
        "source_path": str(src_path.resolve())
    })

    # 7. Viewport / Center Crop (80% box)
    cw, ch = int(w * 0.8), int(h * 0.8)
    left = (w - cw) // 2
    top = (h - ch) // 2
    cropped = rgb_img.crop((left, top, left + cw, top + ch))
    crop_name = f"{base_id}_crop80.jpg"
    crop_out = output_dir / crop_name
    cropped.save(crop_out, "JPEG", quality=80)
    transforms.append({
        "parent_id": base_id,
        "variant_id": f"{base_id}_crop80",
        "file_path": str(crop_out.resolve()),
        "label": label,
        "transform_type": "crop_80",
        "sha256": get_file_sha256(crop_out),
        "source_path": str(src_path.resolve())
    })

    return transforms

def main():
    repo_root = Path("d:/SecuraAI2")
    output_base = repo_root / "data" / "extension_training"
    transformed_dir = output_base / "transformed_images"
    transformed_dir.mkdir(parents=True, exist_ok=True)

    print("--- Collecting Authentic Image Sources ---")
    real_sources = []
    # 1. data/online_dataset/real
    p1 = repo_root / "data" / "online_dataset" / "real"
    if p1.exists():
        for f in p1.glob("*.*"):
            if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                real_sources.append(("online_dataset_real", f))
                
    # 2. data/ai_detection/images real
    p2 = repo_root / "data" / "ai_detection" / "images"
    if p2.exists():
        for f in p2.glob("real_*.*"):
            if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                real_sources.append(("benchmark_real", f))
                
    # 3. User uploaded authentic media (such as phone flash photo)
    flash_img = repo_root / ".user_uploaded" / "media_1792740611532.jpg"
    if flash_img.exists():
        real_sources.append(("phone_flash_authentic", flash_img))

    print(f"Total Authentic Source Candidates: {len(real_sources)}")

    print("--- Collecting AI Synthetic Image Sources ---")
    ai_sources = []
    # 1. data/online_dataset/ai
    p3 = repo_root / "data" / "online_dataset" / "ai"
    if p3.exists():
        for f in p3.glob("*.*"):
            if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                ai_sources.append(("online_dataset_ai", f))
                
    # 2. data/ai_detection/images ai
    if p2.exists():
        for f in p2.glob("ai_*.*"):
            if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                ai_sources.append(("benchmark_ai", f))

    # 3. Sealed C2PA synthetic sample
    p4 = repo_root / "data" / "C2PA_SEALED_OIG1.7jRUm0wwnd2w9KcstkGnG8a06W.jpg"
    if p4.exists():
        ai_sources.append(("dalle3_c2pa", p4))

    print(f"Total AI Synthetic Source Candidates: {len(ai_sources)}")

    # Deduplicate sources by SHA-256
    unique_real = {}
    for prov, path in real_sources:
        h = get_file_sha256(path)
        if h not in unique_real:
            unique_real[h] = {"provenance": prov, "path": path}

    unique_ai = {}
    for prov, path in ai_sources:
        h = get_file_sha256(path)
        if h not in unique_ai:
            unique_ai[h] = {"provenance": prov, "path": path}

    print(f"Unique Authentic Source Images: {len(unique_real)}")
    print(f"Unique AI Synthetic Source Images: {len(unique_ai)}")

    # Seed for deterministic parent splitting
    random.seed(42)

    real_items = list(unique_real.items())
    ai_items = list(unique_ai.items())
    random.shuffle(real_items)
    random.shuffle(ai_items)

    def split_items(items):
        n = len(items)
        n_train = int(n * 0.70)
        n_val = int(n * 0.15)
        # remainder for test
        train = items[:n_train]
        val = items[n_train:n_train + n_val]
        test = items[n_train + n_val:]
        return train, val, test

    real_train, real_val, real_test = split_items(real_items)
    ai_train, ai_val, ai_test = split_items(ai_items)

    splits = {
        "train": {"real": real_train, "ai": ai_train},
        "val": {"real": real_val, "ai": ai_val},
        "test": {"real": real_test, "ai": ai_test}
    }

    manifests = {"train": [], "val": [], "test": []}

    print("--- Generating Paired Web Transformations ---")
    for split_name, group in splits.items():
        print(f"Generating for {split_name} split (Real: {len(group['real'])}, AI: {len(group['ai'])})...")
        # Process Real
        for idx, (h, meta) in enumerate(group["real"]):
            base_id = f"{split_name}_real_{idx:03d}_{h[:8]}"
            variants = generate_transformations(meta["path"], transformed_dir, base_id, "REAL_AUTHENTIC")
            for v in variants:
                v["provenance"] = meta["provenance"]
                v["split"] = split_name
                manifests[split_name].append(v)

        # Process AI
        for idx, (h, meta) in enumerate(group["ai"]):
            base_id = f"{split_name}_ai_{idx:03d}_{h[:8]}"
            variants = generate_transformations(meta["path"], transformed_dir, base_id, "AI_GENERATED")
            for v in variants:
                v["provenance"] = meta["provenance"]
                v["split"] = split_name
                manifests[split_name].append(v)

    # Save Manifests
    for split_name in ["train", "val", "test"]:
        manifest_file = output_base / f"{split_name}_manifest.json"
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifests[split_name], f, indent=2)
        n_r = sum(1 for x in manifests[split_name] if x["label"] == "REAL_AUTHENTIC")
        n_a = sum(1 for x in manifests[split_name] if x["label"] == "AI_GENERATED")
        print(f"Saved {manifest_file.name}: Total {len(manifests[split_name])} (Real: {n_r}, AI: {n_a})")

    # Dataset Summary Metadata
    summary = {
        "dataset_name": "Secura Extension-Specific Robust Web Classifier Dataset v1",
        "description": "Multi-condition web-realistic augmented dataset strictly partitioned by parent image.",
        "split_policy": "70% Train, 15% Validation, 15% Test. Zero leakage across parent SHA-256.",
        "unique_source_counts": {
            "real_authentic": len(unique_real),
            "ai_synthetic": len(unique_ai),
            "total_unique_parents": len(unique_real) + len(unique_ai)
        },
        "split_parent_distribution": {
            "train": {"real": len(real_train), "ai": len(ai_train)},
            "val": {"real": len(real_val), "ai": len(ai_val)},
            "test": {"real": len(real_test), "ai": len(ai_test)}
        },
        "split_variant_distribution": {
            "train": len(manifests["train"]),
            "val": len(manifests["val"]),
            "test": len(manifests["test"]),
            "total_variants": len(manifests["train"]) + len(manifests["val"]) + len(manifests["test"])
        },
        "transformations": [
            "original",
            "jpeg_q75",
            "jpeg_q55",
            "downscale_50",
            "thumbnail_320",
            "canvas_png",
            "crop_80"
        ]
    }
    with open(output_base / "dataset_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print("Dataset preparation complete! Summary saved.")

if __name__ == "__main__":
    main()
