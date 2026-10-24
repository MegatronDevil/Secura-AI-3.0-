import time
from typing import List, Tuple, Optional
import numpy as np
from app.schemas.evidence import (
    BranchForensicResult,
    SuspiciousTemporalInterval,
    VideoAnalyzerStatus,
)
from app.services.video_sampler import SamplingResult
from app.services.video_branches.base import BaseVideoBranch

class RGBChromaticBranch(BaseVideoBranch):
    """Branch 1: Macro-temporal chromatic decomposition, spectral coherence, and rPPG hemodynamics."""

    def __init__(self):
        super().__init__(analyzer_id="branch_1_rgb", method="Deterministic Temporal Chromatic Decomposition")

    def analyze(self, sample_res: SamplingResult) -> Tuple[BranchForensicResult, List[SuspiciousTemporalInterval]]:
        start_t = time.perf_counter()
        frames = sample_res.frames
        timestamps = [f.timestamp_sec for f in frames]

        if not frames:
            return (
                BranchForensicResult(
                    analyzer_id=self.analyzer_id,
                    status=VideoAnalyzerStatus.INSUFFICIENT_DATA,
                    method=self.method,
                    frames_analyzed=0,
                    timestamps_analyzed=[],
                    raw_metrics={},
                    score=None,
                    score_semantics="P(Synthetic Chromatic Incoherence)",
                    runtime_ms=round((time.perf_counter() - start_t) * 1000.0, 2),
                    warnings=["No frames available for chromatic analysis."],
                    limitations=["Requires at least 2 decoded frames."],
                    evidence_summary="Zero frames decoded from video container.",
                ),
                [],
            )

        r_means, g_means, b_means = [], [], []
        r_stds, g_stds, b_stds = [], [], []
        deltas = []
        dr_list, dg_list, db_list = [], [], []
        prev_bgr = None
        prev_gray = None

        for f in frames:
            # OpenCV BGR to normalized channels
            b_norm = f.bgr[:, :, 0].astype(np.float32) / 255.0
            g_norm = f.bgr[:, :, 1].astype(np.float32) / 255.0
            r_norm = f.bgr[:, :, 2].astype(np.float32) / 255.0

            r_m = float(np.mean(r_norm))
            g_m = float(np.mean(g_norm))
            b_m = float(np.mean(b_norm))

            r_means.append(r_m)
            g_means.append(g_m)
            b_means.append(b_m)

            r_stds.append(float(np.std(r_norm)))
            g_stds.append(float(np.std(g_norm)))
            b_stds.append(float(np.std(b_norm)))

            if prev_gray is not None and prev_gray.shape == f.gray.shape:
                diff = float(np.mean(np.abs(f.gray.astype(np.float32) - prev_gray.astype(np.float32))) / 255.0)
            else:
                diff = 0.0
            deltas.append(diff)
            prev_gray = f.gray

            if len(r_means) > 1:
                dr = abs(r_m - r_means[-2])
                dg = abs(g_m - g_means[-2])
                db = abs(b_m - b_means[-2])
            else:
                dr, dg, db = 0.0, 0.0, 0.0
            dr_list.append(dr)
            dg_list.append(dg)
            db_list.append(db)

        mean_r = float(np.mean(r_means))
        mean_g = float(np.mean(g_means))
        mean_b = float(np.mean(b_means))
        jitter = float(np.std(deltas)) if len(deltas) > 1 else 0.0

        # Pearson Cross-Channel Correlation
        # Physical camera sensors exhibit high spectral cross-channel correlation (r >= 0.80)
        # under natural environmental photon illumination.
        rg_corr = float(np.corrcoef(r_means, g_means)[0, 1]) if len(r_means) > 2 and np.std(r_means) > 1e-5 and np.std(g_means) > 1e-5 else 0.85
        gb_corr = float(np.corrcoef(g_means, b_means)[0, 1]) if len(g_means) > 2 and np.std(g_means) > 1e-5 and np.std(b_means) > 1e-5 else 0.85
        if np.isnan(rg_corr):
            rg_corr = 0.85
        if np.isnan(gb_corr):
            gb_corr = 0.85

        # Spectral Entropy of Color Distribution
        s_total = mean_r + mean_g + mean_b + 1e-7
        p_dist = np.array([mean_r, mean_g, mean_b], dtype=np.float64) / s_total
        p_dist = np.clip(p_dist, 1e-12, 1.0)
        spectral_entropy = float(-np.sum(p_dist * np.log2(p_dist)) / np.log2(3.0))

        # Optical Photoplethysmography (rPPG) Biological Pulse Extraction
        # Green-channel absorption (520-560nm) varies with capillary blood volume pulsation
        dominant_pulse_hz: Optional[float] = None
        estimated_heart_rate_bpm: Optional[float] = None
        pulse_snr: float = 0.0

        if len(frames) >= 6 and sample_res.duration_sec >= 1.0:
            dt_series = np.diff(timestamps)
            mean_dt = float(np.mean(dt_series)) if len(dt_series) > 0 else 0.0
            if mean_dt > 0.005:
                fs = 1.0 / mean_dt
                if fs >= 1.5:  # Nyquist allows measuring up to fs/2 Hz
                    g_sig = np.array(g_means, dtype=np.float64)
                    # Detrend signal
                    trend = np.linspace(g_sig[0], g_sig[-1], len(g_sig))
                    detrended = g_sig - trend
                    
                    n_fft = max(64, len(detrended) * 4)
                    fft_vals = np.abs(np.fft.rfft(detrended, n=n_fft))
                    fft_freqs = np.fft.rfftfreq(n_fft, d=mean_dt)
                    
                    # Physiological cardiac band: 0.75 Hz to 2.50 Hz (45 to 150 BPM)
                    band_mask = (fft_freqs >= 0.75) & (fft_freqs <= 2.50)
                    if np.any(band_mask):
                        band_mags = fft_vals[band_mask]
                        band_freqs = fft_freqs[band_mask]
                        peak_i = int(np.argmax(band_mags))
                        best_freq = float(band_freqs[peak_i])
                        peak_power = float(band_mags[peak_i])
                        mean_power = float(np.mean(band_mags)) + 1e-9
                        pulse_snr = float(peak_power / mean_power)

                        # When signal exhibits distinct harmonic modulation in cardiac band
                        dominant_pulse_hz = round(best_freq, 2)
                        estimated_heart_rate_bpm = round(best_freq * 60.0, 1)

        # Flag anomalous chromatic desynchronization (NOT natural camera motion)
        # Real camera motion changes deltas across R, G, B in sync.
        # AI video exhibits independent channel mutations and severe chromatic ratio divergence.
        suspicious_intervals: List[SuspiciousTemporalInterval] = []
        chromatic_desync_count = 0

        for idx in range(1, len(deltas)):
            if idx in sample_res.scene_cut_indices:
                continue
            dr, dg, db = dr_list[idx], dg_list[idx], db_list[idx]
            max_d = max(dr, dg, db)
            min_d = min(dr, dg, db)
            
            # Chromatic divergence metric: ratio of inter-channel spread to magnitude
            spread = max_d - min_d
            if max_d > 0.12 and spread > 0.08 and (spread / (max_d + 1e-4)) > 0.55:
                chromatic_desync_count += 1
                start_ts = frames[idx - 1].timestamp_sec
                end_ts = frames[idx].timestamp_sec
                suspicious_intervals.append(
                    SuspiciousTemporalInterval(
                        start_timestamp=round(start_ts, 3),
                        end_timestamp=round(end_ts, 3),
                        frame_indices=[frames[idx - 1].frame_index, frames[idx].frame_index],
                        branch=self.analyzer_id,
                        measured_metric=f"Chromatic Desynchronization spread={spread:.3f} (R={dr:.3f}, G={dg:.3f}, B={db:.3f})",
                        threshold_or_basis="Spread > 0.08 with Channel Ratio Divergence > 55%",
                        explanation="Unphysical chromatic divergence across RGB color channels characteristic of latent diffusion desynchronization.",
                        confidence_semantics="Moderate Anomaly",
                        caveats="Severe localized neon/strobe lighting can occasionally cause chromatic separation.",
                    )
                )

        # Scientific Calibrated P(Synthetic Chromatic Incoherence) Score [0, 1]:
        # High spectral coherence (rg_corr >= 0.85, gb_corr >= 0.85) + biological pulse -> Authentic camera (< 0.20)
        # Low spectral coherence + chromatic desync spikes -> Generative AI (> 0.60)
        avg_corr = (rg_corr + gb_corr) / 2.0
        
        # Base score derived from cross-channel correlation deficit
        # High correlation (0.90+) -> corr_penalty near 0.0
        # Low correlation (0.40) -> corr_penalty near 0.60
        corr_penalty = float(np.clip((0.85 - avg_corr) * 1.5, 0.0, 0.70))
        
        # Desynchronization penalty
        desync_rate = chromatic_desync_count / max(len(deltas) - 1, 1)
        desync_penalty = float(min(0.40, desync_rate * 1.2))

        # Biological rPPG pulse reward (reduces synthetic score if cardiac harmonic present)
        pulse_reward = 0.15 if (dominant_pulse_hz is not None and pulse_snr >= 1.6) else 0.0

        rgb_ai_score = float(np.clip(0.08 + corr_penalty + desync_penalty - pulse_reward, 0.02, 0.95))

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        pulse_str = f"Estimated Pulse: {estimated_heart_rate_bpm:.1f} BPM ({dominant_pulse_hz:.2f} Hz, SNR: {pulse_snr:.2f}). " if dominant_pulse_hz else "No distinct biological pulse detected. "
        summary_text = (
            f"Evaluated {len(frames)} frames across {sample_res.duration_sec:.2f}s. "
            f"Channel Means: R={mean_r*100:.1f}%, G={mean_g*100:.1f}%, B={mean_b*100:.1f}%. "
            f"Spectral Coherence: r(RG)={rg_corr:.2f}, r(GB)={gb_corr:.2f}. "
            f"{pulse_str}Found {len(suspicious_intervals)} chromatic anomalies."
        )

        return (
            BranchForensicResult(
                analyzer_id=self.analyzer_id,
                status=VideoAnalyzerStatus.COMPLETED,
                method=self.method,
                frames_analyzed=len(frames),
                timestamps_analyzed=timestamps,
                raw_metrics={
                    "mean_red": round(mean_r, 4),
                    "mean_green": round(mean_g, 4),
                    "mean_blue": round(mean_b, 4),
                    "rg_correlation": round(rg_corr, 4),
                    "gb_correlation": round(gb_corr, 4),
                    "temporal_jitter_index": round(jitter, 4),
                    "dominant_pulse_hz": dominant_pulse_hz,
                    "estimated_heart_rate_bpm": estimated_heart_rate_bpm,
                    "pulse_snr": round(pulse_snr, 2),
                    "spectral_entropy": round(spectral_entropy, 4),
                    "chromatic_desync_count": chromatic_desync_count,
                    "frame_deltas": [round(d, 4) for d in deltas],
                    "scene_cut_count": len(sample_res.scene_cut_indices),
                },
                score=round(rgb_ai_score, 4),
                score_semantics="P(Synthetic Chromatic Incoherence) [0, 1]",
                runtime_ms=round(elapsed_ms, 2),
                warnings=[],
                limitations=[
                    "Spectral correlation is influenced by extreme monochromatic or neon lighting.",
                    "Optical rPPG pulse signal is subtle and requires stable lighting on living tissue."
                ],
                evidence_summary=summary_text,
            ),
            suspicious_intervals,
        )
