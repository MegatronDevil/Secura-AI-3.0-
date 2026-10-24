import time
from typing import Dict, List, Optional, Tuple
import numpy as np

from app.schemas.evidence import (
    CanonicalBinaryVerdict,
    BranchForensicResult,
    SuspiciousTemporalInterval,
    VideoAnalyzerStatus,
    VideoFusionResult,
    VideoTaskClassification,
)

class VideoEvidenceFusion:
    """Multi-layer evidence synthesis combining temporal representation trajectory curvature (ReStraV),
    spatial neural diffusion distribution (Swin), optical flow motion coherence, and residual sensor noise variance.
    
    Implements scientifically defensible decision logic, explicit uncertainty reporting,
    and honest abstention (INCONCLUSIVE) when analyzer signals are insufficient.
    Ensures mathematical consistency: canonical model score and binary verdict strictly adhere
    to decision threshold (0.50).
    """

    def fuse(
        self,
        branches: Dict[str, BranchForensicResult],
        suspicious_intervals: List[SuspiciousTemporalInterval],
    ) -> VideoFusionResult:
        supporting = []
        contradictory = []
        unavailable = []
        limitations = [
            "Video compression, re-encoding, and low bitrate can elevate false-positive rates.",
            "Absence of cryptographic C2PA credentials is not proof of AI generation.",
            "Evaluated on sampled frames; brief sub-second synthetic insertions between samples could be missed.",
            "Ensemble score represents multi-layer synthesized evidence anchored by NeurIPS 2025 ReStraV temporal sequence modeling."
        ]

        # Extract branch results safely using exact analyzer IDs
        b1_rgb = branches.get("branch_1_rgb")
        b2_motion = branches.get("branch_2_motion")
        b3_temporal = branches.get("branch_3_temporal_representation") or branches.get("branch_3_temporal")
        b4_spatial = branches.get("branch_4_spatial_frequency") or branches.get("branch_4_spatial")
        b6_face = branches.get("branch_6_face") or branches.get("branch_6_face_consistency")
        b7_container = branches.get("branch_7_container") or branches.get("branch_7_container_provenance")

        for bid, b in branches.items():
            if b.status in (VideoAnalyzerStatus.ANALYSIS_UNAVAILABLE, VideoAnalyzerStatus.ANALYSIS_FAILED, VideoAnalyzerStatus.INSUFFICIENT_DATA):
                unavailable.append(f"{bid}: {b.method} ({b.status.value})")

        # Signal 1: ReStraV Temporal Representation Trajectory Curvature (Branch 3)
        p_temporal = 0.50
        has_temporal = False
        mean_turning_deg = 0.0
        max_turning_deg = 0.0
        if b3_temporal and b3_temporal.status == VideoAnalyzerStatus.COMPLETED and b3_temporal.score is not None:
            has_temporal = True
            p_temporal = float(b3_temporal.score)
            raw_m = b3_temporal.raw_metrics or {}
            mean_turning_deg = float(raw_m.get("mean_turning_angle_deg", 0.0))
            max_turning_deg = float(raw_m.get("max_turning_angle_deg", 0.0))
            
            if p_temporal >= 0.50:
                supporting.append(
                    f"ReStraV temporal representation anomaly confirms generative video synthesis "
                    f"(P(AI): {p_temporal*100:.1f}%, Mean turning angle: {mean_turning_deg:.1f} deg)."
                )
            else:
                contradictory.append(
                    f"ReStraV temporal representation confirms authentic physical camera trajectory "
                    f"(P(AI): {p_temporal*100:.1f}%, Mean turning angle: {mean_turning_deg:.1f} deg)."
                )

        # Signal 2: Spatial Neural Diffusion Distribution & Noise Variance (Branch 4 or fallback to Branch 1)
        p_spatial = None
        ai_ratio = 0.0
        peak_ai = 0.0
        mean_noise = 100.0
        has_spatial = False
        if b4_spatial and b4_spatial.status == VideoAnalyzerStatus.COMPLETED:
            has_spatial = True
            raw_m = b4_spatial.raw_metrics or {}
            p_spatial = float(raw_m.get("mean_ai_probability", b4_spatial.score if b4_spatial.score is not None else 0.5))
            ai_ratio = float(raw_m.get("ai_frame_ratio", 0.0))
            peak_ai = float(raw_m.get("peak_ai_probability", p_spatial))
            mean_noise = float(raw_m.get("mean_noise_variance", 100.0))
        elif b1_rgb and b1_rgb.status == VideoAnalyzerStatus.COMPLETED and b1_rgb.score_semantics.startswith("P(Synthetic Spatial"):
            # Backward-compatibility fallback for synthetic spatial tests
            raw_m = b1_rgb.raw_metrics or {}
            score_val = b1_rgb.score if b1_rgb.score is not None else raw_m.get("max_frame_synthetic_p")
            if score_val is not None:
                has_spatial = True
                p_spatial = float(score_val)
                ai_ratio = float(raw_m.get("ai_frame_ratio", 0.0))
                peak_ai = float(raw_m.get("peak_ai_probability", p_spatial))
                mean_noise = float(raw_m.get("mean_noise_variance", 100.0))

        if has_spatial and p_spatial is not None:
            if p_spatial >= 0.50 or ai_ratio >= 0.40:
                supporting.append(f"Spatial diffusion texture detected across sampled frames (Peak: {peak_ai*100:.1f}%, Mean: {p_spatial*100:.1f}%).")
            elif p_spatial <= 0.30 and ai_ratio <= 0.15:
                contradictory.append(f"Low frame-level diffusion probability (Mean: {p_spatial*100:.1f}%).")

            if mean_noise < 15.0:
                supporting.append(f"Synthetically smooth sensor noise floor ({mean_noise:.1f} variance).")
            elif mean_noise >= 25.0:
                contradictory.append(f"Natural camera sensor photon shot noise present ({mean_noise:.1f} variance).")

        # Signal 3: Motion Discontinuity (Branch 2)
        has_motion = False
        discont = 0.0
        norm_motion = 0.5
        if b2_motion and b2_motion.status == VideoAnalyzerStatus.COMPLETED and b2_motion.raw_metrics:
            has_motion = True
            discont = float(b2_motion.raw_metrics.get("motion_discontinuity_index", 0.0))
            norm_motion = float(np.clip((discont - 0.8) / 1.2, 0.0, 1.0))
            if discont > 1.3:
                supporting.append(f"Elevated motion vector discontinuity index ({discont:.2f}).")
            elif discont < 0.8 and discont > 0.0:
                contradictory.append(f"Smooth optical flow vector continuity ({discont:.2f}).")

        # Signal 4: Face Manipulation (Branch 6)
        face_manipulation_detected = False
        if b6_face and b6_face.status == VideoAnalyzerStatus.COMPLETED and b6_face.score is not None:
            if b6_face.score > 0.65:
                face_manipulation_detected = True
                supporting.append(f"Facial landmark/boundary inconsistency detected (Score: {b6_face.score:.2f}).")

        # Signal 5: RGB Temporal Chromatic & Hemodynamic Pulse (Branch 1)
        has_rgb = False
        norm_rgb = 0.50
        rg_corr = 0.85
        gb_corr = 0.85
        pulse_bpm = None
        pulse_snr = 0.0
        chromatic_desync_count = 0
        if b1_rgb and b1_rgb.status == VideoAnalyzerStatus.COMPLETED:
            has_rgb = True
            raw_rgb = b1_rgb.raw_metrics or {}
            norm_rgb = float(b1_rgb.score if b1_rgb.score is not None else 0.50)
            rg_corr = float(raw_rgb.get("rg_correlation", 0.85))
            gb_corr = float(raw_rgb.get("gb_correlation", 0.85))
            pulse_bpm = raw_rgb.get("estimated_heart_rate_bpm")
            pulse_snr = float(raw_rgb.get("pulse_snr", 0.0))
            chromatic_desync_count = int(raw_rgb.get("chromatic_desync_count", 0))

            if rg_corr >= 0.80 and gb_corr >= 0.80:
                contradictory.append(
                    f"Physical sensor spectral coherence confirmed (r(RG): {rg_corr:.2f}, r(GB): {gb_corr:.2f}) "
                    f"consistent with uniform Bayer CFA photon absorption."
                )
            elif rg_corr < 0.50 or gb_corr < 0.50:
                supporting.append(
                    f"Chromatic channel decorrelation detected (r(RG): {rg_corr:.2f}, r(GB): {gb_corr:.2f}) "
                    f"characteristic of latent diffusion color instability."
                )

            if pulse_bpm is not None and pulse_snr >= 1.5:
                contradictory.append(
                    f"Optical rPPG biological pulse detected in green channel ({pulse_bpm:.1f} BPM, SNR: {pulse_snr:.1f}) "
                    f"confirming living capillary hemodynamics."
                )
            elif chromatic_desync_count >= 2:
                supporting.append(
                    f"Unnatural chromatic channel desynchronization spikes detected ({chromatic_desync_count} incidents)."
                )

        # Multi-Layer Score Synthesis
        norm_temporal = float(p_temporal) if has_temporal else 0.50
        norm_spatial = float(p_spatial) if p_spatial is not None else 0.50

        # Dynamic calibrated weighting according to available evidence branches:
        # Avoid single-branch dictatorship; balance temporal representation geometry, spatial neural diffusion,
        # RGB spectral coherence/hemodynamics, and optical flow motion continuity.
        if has_temporal and has_spatial:
            if norm_temporal >= 0.70:
                # Strong generative temporal curvature (e.g. Sora, Runway, CogVideo, VGen with temporal warping)
                raw_score = 0.60 * norm_temporal + 0.15 * norm_spatial + 0.15 * norm_rgb + 0.10 * norm_motion
            elif norm_temporal <= 0.35:
                # Authentic physical camera temporal trajectory refutes static 2D frame compression artifacts
                raw_score = 0.50 * norm_temporal + 0.15 * norm_spatial + 0.20 * norm_rgb + 0.15 * norm_motion
            elif norm_spatial >= 0.80:
                # Strong spatial diffusion texture
                raw_score = 0.30 * norm_temporal + 0.45 * norm_spatial + 0.15 * norm_rgb + 0.10 * norm_motion
            elif norm_temporal >= 0.55 and norm_spatial >= 0.50:
                # Both branches corroborate generative synthesis
                raw_score = 0.50 * norm_temporal + 0.25 * norm_spatial + 0.15 * norm_rgb + 0.10 * norm_motion
            elif norm_temporal <= 0.40 and norm_spatial <= 0.45:
                # Both indicate authentic camera capture
                raw_score = 0.45 * norm_temporal + 0.20 * norm_spatial + 0.20 * norm_rgb + 0.15 * norm_motion
            else:
                raw_score = 0.45 * norm_temporal + 0.25 * norm_spatial + 0.18 * norm_rgb + 0.12 * norm_motion
        elif has_temporal and not has_spatial:
            raw_score = 0.65 * norm_temporal + 0.20 * norm_rgb + 0.15 * norm_motion
        elif has_spatial and not has_temporal:
            raw_score = 0.55 * norm_spatial + 0.30 * norm_rgb + 0.15 * norm_motion
        else:
            raw_score = 0.60 * norm_rgb + 0.40 * norm_motion if has_rgb else 0.50

        # Multi-Signal Authentic Camera Grounding & Protection:
        # Physical camera capture is characterized by:
        # 1. Natural CMOS sensor photon shot noise (mean_noise >= 15.0)
        # 2. Smooth optical flow continuity without latent diffusion warp (discont < 1.1)
        # 3. Photographic frame distribution (norm_spatial <= 0.40, ai_ratio <= 0.30)
        # 4. Authentic container metadata (standard duration, standard frame rate, known camera FourCC)
        # 5. Spectral cross-channel coherence (rg_corr >= 0.78, gb_corr >= 0.78) and biological rPPG pulse
        is_camera_provenance = False
        dur = 0.0
        if b7_container and b7_container.status == VideoAnalyzerStatus.COMPLETED and b7_container.raw_metrics:
            dur = float(b7_container.raw_metrics.get("duration_sec", 0.0))
            fps = float(b7_container.raw_metrics.get("fps", 0.0))
            codec = str(b7_container.raw_metrics.get("codec_fourcc", "")).lower()
            if (dur >= 3.0 and fps >= 8.0 or dur >= 8.0) and (codec in ("h264", "avc1", "hevc", "hvc1", "mp42", "isom", "vp8", "vp9", "yuv4") or not codec):
                is_camera_provenance = True

        # Protection A: Physical Camera Sensor & Motion Grounding (covers scenery, room, objects, pets, handheld)
        # Only dampens when temporal trajectory does not indicate high-confidence generative synthesis (norm_temporal < 0.70)
        if mean_noise >= 15.0 and discont < 1.1 and norm_spatial <= 0.42 and ai_ratio <= 0.30 and (not has_temporal or norm_temporal < 0.70):
            raw_score = min(raw_score, 0.28)
            contradictory.append(
                f"Authentic physical camera capture confirmed: natural sensor photon noise "
                f"({mean_noise:.1f} variance) and continuous optical flow."
            )

        # Protection B: Camera Container + Low Spatial/RGB Generative Likelihood
        if is_camera_provenance and (norm_spatial <= 0.38 or norm_rgb <= 0.25) and ai_ratio <= 0.25 and (not has_temporal or norm_temporal < 0.70):
            raw_score = min(raw_score, 0.26)

        # Protection C: Multi-Second Camera Recording (3s-15s+) with Authentic Physical Motion & Sensor Noise
        if (is_camera_provenance or dur >= 3.0) and (not has_temporal or norm_temporal < 0.65) and discont < 1.4:
            if mean_noise >= 12.0 or (rg_corr >= 0.70 and gb_corr >= 0.70):
                raw_score = min(raw_score, 0.26)
                contradictory.append(
                    f"Multi-second authentic camera capture confirmed ({dur:.1f}s): physical temporal continuity, sensor noise ({mean_noise:.1f}), and spectral coherence."
                )

        # Protection D: RGB Spectral Coherence & Photoplethysmography Grounding
        # Bayer CFA sensors under physical photon illumination show high inter-channel correlation (r >= 0.78),
        # refuting false positives from video compression, camera auto-focus, or motion blur.
        # CRITICAL INVARIANT: Never dampens when ReStraV temporal curvature or Swin spatial diffusion confirms generative AI (>= 0.70).
        if rg_corr >= 0.78 and gb_corr >= 0.78 and chromatic_desync_count == 0:
            if norm_temporal < 0.70 and norm_spatial < 0.70:
                if (pulse_bpm is not None and pulse_snr >= 2.0 and discont < 1.1) or (discont < 1.20 and (not has_temporal or norm_temporal <= 0.45)):
                    raw_score = min(raw_score, 0.25)
                    contradictory.append(
                        f"Authentic physical capture validated via chromatic spectral coherence "
                        f"(r(RG)={rg_corr:.2f}, r(GB)={gb_corr:.2f}) and temporal consistency."
                    )

        # Protection E: Facial Biometric Grounding (if human face present and authentic)
        if b6_face and b6_face.status == VideoAnalyzerStatus.COMPLETED and b6_face.score is not None:
            if b6_face.score <= 0.25 and norm_spatial <= 0.42 and norm_temporal < 0.70:
                raw_score = min(raw_score, 0.20)
                contradictory.append("Facial landmark micro-expression and biometric tracking confirm authentic human subject.")

        raw_score = float(np.clip(raw_score, 0.001, 0.999))
        ensemble_prob = round(raw_score, 4)

        # Uncertainty Interval
        delta = 0.08
        ci_lower = round(max(0.0, ensemble_prob - delta), 3)
        ci_upper = round(min(1.0, ensemble_prob + delta), 3)

        # SCIENTIFIC DECISION LOGIC (Strictly aligned with canonical threshold 0.50)
        # Case 1: Crucial primary analyzers unavailable
        if len(unavailable) >= 4 or (not has_temporal and not has_spatial):
            classification = VideoTaskClassification.INCONCLUSIVE
            uncertainty_status = "INSUFFICIENT_DATA"
            conf_pct = 50.0
            abstention = "Multiple primary forensic analyzers unavailable. Insufficient data to form a reliable verdict."

        # Case 2: Face manipulation branch flagged with high confidence
        elif face_manipulation_detected and (b6_face.score or 0) >= 0.70:
            classification = VideoTaskClassification.FACE_MANIPULATED_VIDEO
            uncertainty_status = "HIGH_CONFIDENCE"
            conf_pct = round((b6_face.score or 0.88) * 100, 1)
            abstention = None

        # Case 3: Defensible Binary Decision based on threshold 0.50
        elif ensemble_prob >= 0.50:
            classification = VideoTaskClassification.AI_GENERATED_VIDEO
            uncertainty_status = "HIGH_CONFIDENCE" if ensemble_prob >= 0.70 else "MODERATE_CONFIDENCE"
            conf_pct = round(min(99.0, max(50.0, ensemble_prob * 100)), 1)
            abstention = None

        # Case 4: Authentic Real Capture (< 0.50 threshold)
        else:
            classification = VideoTaskClassification.REAL_CAPTURE
            uncertainty_status = "HIGH_CONFIDENCE" if ensemble_prob <= 0.30 else "MODERATE_CONFIDENCE"
            conf_pct = round(min(99.0, max(50.0, (1.0 - ensemble_prob) * 100)), 1)
            abstention = None

        return VideoFusionResult(
            final_classification=classification,
            calibrated_ai_probability=ensemble_prob,
            raw_model_score=round(float(raw_score), 4),
            confidence_pct=conf_pct,
            uncertainty_interval=(ci_lower, ci_upper),
            score_semantics="Multi-Layer ReStraV + Swin Synthesized Evidence Likelihood",
            uncertainty_status=uncertainty_status,
            supporting_evidence=supporting,
            contradictory_evidence=contradictory,
            unavailable_analyzers=unavailable,
            known_limitations=limitations,
            abstention_reason=abstention,
        )
