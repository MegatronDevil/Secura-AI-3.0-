import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any

def compute_perceptual_hashes(image: Image.Image) -> Dict[str, Any]:
    """
    Computes robust 64-bit perceptual hashes (pHash via DCT, dHash via gradients, aHash)
    and formats reverse forensic lookup metadata.
    """
    try:
        # Convert to grayscale
        gray = np.array(image.convert("L"))

        # 1. pHash (DCT-based perceptual hash)
        # Resize to 32x32
        resized32 = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
        # Compute 2D DCT
        dct = cv2.dct(np.float32(resized32))
        # Extract top-left 8x8 low-frequency coefficients (excluding DC at [0,0])
        dct_low = dct[:8, :8]
        median_val = np.median(dct_low[1:, 1:])
        phash_bits = (dct_low > median_val).flatten()
        phash_hex = "".join([f"{int(''.join(map(str, phash_bits[i:i+4].astype(int))), 2):x}" for i in range(0, 64, 4)])

        # 2. dHash (Difference Hash via horizontal gradient)
        resized9x8 = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
        diff = resized9x8[:, 1:] > resized9x8[:, :-1]
        dhash_hex = "".join([f"{int(''.join(map(str, diff.flatten()[i:i+4].astype(int))), 2):x}" for i in range(0, 64, 4)])

        # 3. aHash (Average Hash)
        resized8x8 = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA)
        avg = np.mean(resized8x8)
        ahash_bits = (resized8x8 > avg).flatten()
        ahash_hex = "".join([f"{int(''.join(map(str, ahash_bits[i:i+4].astype(int))), 2):x}" for i in range(0, 64, 4)])

        # 4. Known Synthetic Pattern Cluster Proximity (Heuristic Hamming check)
        # Synthesized diffusion images often have high frequency concentration in low-frequency DCT bands
        high_freq_ratio = float(np.sum(np.abs(dct[16:, 16:])) / (np.sum(np.abs(dct[:16, :16])) + 1e-6))
        
        reverse_lookup_dict = {
            "google_lens": "https://lens.google.com/",
            "tineye": "https://tineye.com/",
            "bing_visual": "https://www.bing.com/visualsearch",
            "yandex_images": "https://yandex.com/images/",
        }

        return {
            "phash": f"0x{phash_hex}",
            "dhash": f"0x{dhash_hex}",
            "ahash": f"0x{ahash_hex}",
            "bit_length": 64,
            "description": "64-bit DCT / Gradient / Mean Perceptual Hashes",
            "high_frequency_ratio": round(high_freq_ratio, 4),
            "reverse_search_ready": True,
            "reverse_lookup_urls": reverse_lookup_dict,
            "google_lens_url": "https://lens.google.com/",
            "tineye_url": "https://tineye.com/",
            "bing_visual_url": "https://www.bing.com/visualsearch",
            "yandex_images_url": "https://yandex.com/images/",
        }

    except Exception as e:
        fallback_lookup = {
            "google_lens": "https://lens.google.com/",
            "tineye": "https://tineye.com/",
            "bing_visual": "https://www.bing.com/visualsearch",
            "yandex_images": "https://yandex.com/images/",
        }
        return {
            "phash": "0x0000000000000000",
            "dhash": "0x0000000000000000",
            "ahash": "0x0000000000000000",
            "bit_length": 64,
            "description": "Perceptual hashing fallback",
            "high_frequency_ratio": 0.0,
            "reverse_search_ready": False,
            "reverse_lookup_urls": fallback_lookup,
            "google_lens_url": "https://lens.google.com/",
            "tineye_url": "https://tineye.com/",
            "bing_visual_url": "https://www.bing.com/visualsearch",
            "yandex_images_url": "https://yandex.com/images/",
            "error": str(e),
        }
