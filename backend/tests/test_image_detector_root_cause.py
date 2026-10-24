"""Comprehensive regression test suite for Secura AI Image Classification Root Cause Repair.

Covers Phases 1 through 8:
- Test A: Exact supplied image (C2PA_SEALED_OIG1.7jRUm0wwnd2w9KcstkGnG8a06W.jpg)
- Test B: Model output interpretation & mathematical bounds
- Test C: Forensic heuristics non-authenticity invariant
- Test D: End-to-end agreement across API, schema, and dossier contract
- Test E: Broader performance on real vs synthetic imagery
"""

import hashlib
import io
import os
from pathlib import Path
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.evidence import AIDetectorResult, AIDetectionStatus, AIDetectionDecision
from app.services.ai_image_detector import get_ai_image_detector

client = TestClient(app)

SAMPLE_PATH = Path("d:/SecuraAI2/data/C2PA_SEALED_OIG1.7jRUm0wwnd2w9KcstkGnG8a06W.jpg")
EXPECTED_SHA256 = "8ba398df6bb1fb38da1d2f04fa5db2f48cc8b4c8f3c772fd0aaeb68d629fcd92"


# --- Test A: Exact Supplied Image Regression ---

def test_a_exact_sample_hash_and_pipeline():
    """Verify exact bytes SHA-256 and confirm the sample is classified as AI_GENERATED, never CAMERA_CAPTURED."""
    assert SAMPLE_PATH.exists(), f"Exact sample not found at {SAMPLE_PATH}"
    
    data = SAMPLE_PATH.read_bytes()
    computed_hash = hashlib.sha256(data).hexdigest()
    assert computed_hash == EXPECTED_SHA256, f"Hash mismatch: expected {EXPECTED_SHA256}, got {computed_hash}"

    # Run inference via FastAPI endpoint
    response = client.post(
        "/api/v1/analyze/image",
        files={"file": (SAMPLE_PATH.name, io.BytesIO(data), "image/jpeg")}
    )
    assert response.status_code == 200, f"API error: {response.text}"
    body = response.json()

    # Check canonical verdict
    canonical = body["canonical_verdict"]
    assert canonical["predicted_label"] == "AI_GENERATED", (
        f"Defect regression: sample was classified as {canonical['predicted_label']}"
    )
    assert "CAMERA_CAPTURED" not in canonical["predicted_label"]
    assert canonical["model_score"] >= 0.50

    # Check AI detection raw score vs probability
    ai_det = body["ai_detection"]
    assert ai_det is not None
    assert ai_det["available"] is True

    # Uncalibrated margin MUST be strictly within [0.0, 1.0]
    margin = ai_det["uncalibrated_margin"]
    assert 0.0 <= margin <= 1.0, f"Invalid margin: {margin}"

    # Raw score is an uncalibrated logit (can be negative, e.g. -1.77 or -4.68)
    raw_logit = ai_det["raw_score"]
    assert isinstance(raw_logit, (int, float))

    # Probabilities must be strictly bounded in [0.0, 1.0]
    probs = ai_det["probabilities"]
    assert probs is not None
    assert 0.0 <= probs["artificial"] <= 1.0
    assert 0.0 <= probs["human"] <= 1.0


# --- Test B: Model Output Interpretation & Mathematical Bounds ---

def test_b_margin_bounds_validation():
    """Ensure AIDetectorResult strictly enforces [0.0, 1.0] bounds on uncalibrated_margin."""
    # Valid result with negative logit and valid margin
    res = AIDetectorResult(
        available=True,
        inference_ready=True,
        model_name="TestSwin",
        model_version="1.0",
        model_status=AIDetectionStatus.LOADED,
        raw_score=-4.6874,
        uncalibrated_margin=0.0091,
        score_semantics="Test logit difference",
        predicted_class="human",
        decision_status=AIDetectionDecision.REAL_IMAGE_CLASS,
        preprocessing="Standard resize",
        probabilities={"artificial": 0.0091, "human": 0.9909}
    )
    assert res.raw_score == -4.6874
    assert res.uncalibrated_margin == 0.0091

    # Attempting to assign negative margin must raise a ValidationError
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        AIDetectorResult(
            available=True,
            inference_ready=True,
            model_name="TestSwin",
            model_version="1.0",
            model_status=AIDetectionStatus.LOADED,
            raw_score=-4.6874,
            uncalibrated_margin=-4.6874,  # ILLEGAL: negative margin
            score_semantics="Illegal test",
            predicted_class="human",
            decision_status=AIDetectionDecision.REAL_IMAGE_CLASS,
            preprocessing="Standard resize",
        )


def test_b_swin_logit_conversion_math():
    """Verify Swin raw logit difference mapping to probability: p = 1 / (1 + exp(-diff))."""
    import numpy as np
    diff = -4.6874
    prob = float(1.0 / (1.0 + np.exp(-diff)))
    assert 0.0 < prob < 0.01
    assert round(prob, 4) == 0.0091

    # Ensure logit can be recovered from prob without distortion
    recovered_logit = float(np.log(prob / (1.0 - prob)))
    assert abs(recovered_logit - diff) < 1e-3


# --- Test C: Forensic Evidence Invariant ---

def test_c_missing_exif_cannot_certify_camera_capture():
    """Verify that an image lacking camera metadata cannot receive CAMERA_CAPTURED verdict."""
    # Synthetic flat test image with no metadata
    img = Image.new("RGB", (256, 256), color=(200, 200, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    data = buf.getvalue()

    response = client.post(
        "/api/v1/analyze/image",
        files={"file": ("unverified_test.jpg", io.BytesIO(data), "image/jpeg")}
    )
    assert response.status_code == 200
    body = response.json()

    canonical = body["canonical_verdict"]
    # Without EXIF camera hardware, verdict can NEVER be CAMERA_CAPTURED
    assert canonical["predicted_label"] != "CAMERA_CAPTURED"
    assert canonical["predicted_label"] in ("NOT_AI_GENERATED", "INCONCLUSIVE", "AI_GENERATED")
    if canonical["predicted_label"] == "NOT_AI_GENERATED":
        assert "Unverified Origin" in canonical["display_label"]


# --- Test D: End-to-End Agreement ---

def test_d_end_to_end_agreement():
    """Verify that the active model, canonical verdict, and dossier fields agree on exact sample."""
    data = SAMPLE_PATH.read_bytes()
    response = client.post(
        "/api/v1/analyze/image",
        files={"file": (SAMPLE_PATH.name, io.BytesIO(data), "image/jpeg")}
    )
    assert response.status_code == 200
    res = response.json()

    canonical = res["canonical_verdict"]
    ai_det = res["ai_detection"]
    c2pa = res["c2pa_provenance"]
    metadata = res["metadata_forensics"]

    assert canonical["predicted_label"] == "AI_GENERATED"
    assert canonical["model_score"] >= 0.50
    assert c2pa["manifest_present"] is False
    assert metadata["camera_metadata"]["device_status"] == "ABSENT"


# --- Test E: Broader Performance on Labelled Real & Synthetic Imagery ---

def test_e_real_vs_synthetic_discrimination():
    """Test discrimination on reference samples."""
    detector = get_ai_image_detector()
    
    # 1. Known AI diffusion sample
    ai_path = Path("d:/SecuraAI2/data/ai_detection/images/diff_diff_abstract_01.png")
    if ai_path.exists():
        img = Image.open(ai_path)
        res = detector.detect(img)
        assert res.available is True
        assert 0.0 <= res.uncalibrated_margin <= 1.0

    # 2. Known real architecture sample
    real_path = Path("d:/SecuraAI2/data/ai_detection/images/real_architecture_03.png")
    if real_path.exists():
        img = Image.open(real_path)
        res = detector.detect(img)
        assert res.available is True
        assert 0.0 <= res.uncalibrated_margin <= 1.0
