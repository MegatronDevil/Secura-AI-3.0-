import React, { useEffect, useRef, useState } from "react";
import { RGBFrameSample, RGBSummary } from "../types/api";

export interface RGBHeartProps {
  isAiGenerated?: boolean | null;
  confidenceScore?: number | null;
  activeSample?: RGBFrameSample | null;
  summary?: RGBSummary | null;
  isPlaying?: boolean;
  width?: number;
  height?: number;
  showLabels?: boolean;
  interactive?: boolean;
  className?: string;
  title?: string;
}

export const RGBHeartVisualization: React.FC<RGBHeartProps> = ({
  isAiGenerated,
  confidenceScore,
  activeSample,
  summary,
  isPlaying = false,
  width = 380,
  height = 340,
  showLabels = true,
  interactive = true,
  className = "",
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Rotation & levitation state
  const rotYRef = useRef<number>(0);
  const rotXRef = useRef<number>(0.22); // subtle tilt for 3D depth
  const floatOffsetRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const ecgHistoryRef = useRef<number[]>([]);

  // Analytical channel toggles
  const [showR, setShowR] = useState(true);
  const [showG, setShowG] = useState(true);
  const [showB, setShowB] = useState(true);

  // Derive pulse & classification state
  const rawBpm = activeSample?.heart_rate_bpm ?? summary?.estimated_heart_rate_bpm ?? 0.0;
  const isSynthetic = isAiGenerated ?? (activeSample?.ai_probability != null ? activeSample.ai_probability > 0.5 : false);
  const hasCardiacPulse = !isSynthetic && rawBpm >= 45.0 && rawBpm <= 160.0;

  // Normalized channel levels
  const rVal = activeSample ? (activeSample.r_mean > 1.0 ? activeSample.r_mean / 255.0 : activeSample.r_mean) : 0.62;
  const gVal = activeSample ? (activeSample.g_mean > 1.0 ? activeSample.g_mean / 255.0 : activeSample.g_mean) : 0.46;
  const bVal = activeSample ? (activeSample.b_mean > 1.0 ? activeSample.b_mean / 255.0 : activeSample.b_mean) : 0.38;

  const rDisplay = Math.round(rVal * 255);
  const gDisplay = Math.round(gVal * 255);
  const bDisplay = Math.round(bVal * 255);

  // ---------------------------------------------------------------------------
  // 1. CINEMA-GRADE 3D HOLOGRAPHIC CARDIOID ENGINE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let isMounted = true;

    // Generate 3D Mathematical Cardioid Lattice
    // Parametric surface: u in [0, PI], v in [-PI, PI]
    const uRings = 24;
    const vSteps = 32;

    const render = () => {
      if (!isMounted) return;

      // SPEED TUNING:
      // Genuine: majestic, smooth, hypnotic (0.015 rad/frame)
      // AI: controlled, turbulent agitation (0.036 rad/frame) with brief glitch bursts
      const targetSpeed = isSynthetic ? 0.036 : isPlaying ? 0.020 : 0.014;
      rotYRef.current += targetSpeed;
      timeRef.current += 0.016;

      const t = timeRef.current;
      const rotY = rotYRef.current;
      const rotX = rotXRef.current + Math.sin(t * 0.9) * 0.03;
      floatOffsetRef.current = Math.sin(t * 1.8) * 5; // Organic levitation bob

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 - 4 + floatOffsetRef.current;
      const fov = 340;
      const cameraDistance = 330;
      const baseScale = Math.min(width, height) / 36;

      // Pulse breathing: Authentic 72 BPM cardiac expansion or synthetic micro-jitter
      const pulseWave = hasCardiacPulse || isAiGenerated === false
        ? Math.sin(t * 2.8) * 0.065 + Math.sin(t * 5.6) * 0.02
        : isSynthetic
        ? Math.sin(t * 7.0) * 0.045 + (Math.random() - 0.5) * 0.03
        : Math.sin(t * 1.5) * 0.02;

      const dynamicScale = baseScale * (1.0 + pulseWave);

      // -----------------------------------------------------------------------
      // A. Dark Holographic Chamber Background & Projector Beam
      // -----------------------------------------------------------------------
      // Chamber radial ambient glow
      const chamberGrad = ctx.createRadialGradient(
        centerX, centerY, 10,
        centerX, centerY, width * 0.65
      );
      if (isSynthetic) {
        chamberGrad.addColorStop(0, "rgba(255, 42, 85, 0.12)");
        chamberGrad.addColorStop(0.5, "rgba(255, 107, 8, 0.04)");
        chamberGrad.addColorStop(1, "rgba(10, 14, 23, 0.0)");
      } else {
        chamberGrad.addColorStop(0, "rgba(0, 242, 254, 0.12)");
        chamberGrad.addColorStop(0.5, "rgba(0, 163, 255, 0.04)");
        chamberGrad.addColorStop(1, "rgba(10, 14, 23, 0.0)");
      }
      ctx.fillStyle = chamberGrad;
      ctx.fillRect(0, 0, width, height);

      // Holographic Projector Emitter Pedestal (Base)
      const pedestalY = height - 26;
      ctx.save();
      const emitterColor = isSynthetic ? "rgba(255, 42, 85, " : "rgba(0, 242, 254, ";
      
      // Projector beam cone radiating upward
      const beamGrad = ctx.createLinearGradient(centerX, pedestalY, centerX, centerY);
      beamGrad.addColorStop(0, `${emitterColor}0.25)`);
      beamGrad.addColorStop(0.8, `${emitterColor}0.03)`);
      beamGrad.addColorStop(1, `${emitterColor}0)`);
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(centerX - 45, pedestalY);
      ctx.lineTo(centerX + 45, pedestalY);
      ctx.lineTo(centerX + 110, centerY - 60);
      ctx.lineTo(centerX - 110, centerY - 60);
      ctx.closePath();
      ctx.fill();

      // Pedestal rings
      ctx.strokeStyle = `${emitterColor}0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(centerX, pedestalY, 52, 14, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `${emitterColor}0.65)`;
      ctx.beginPath();
      ctx.ellipse(centerX, pedestalY, 28, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Pedestal glowing lens core
      ctx.fillStyle = isSynthetic ? "#FF2A55" : "#00F2FE";
      ctx.shadowColor = isSynthetic ? "#FF2A55" : "#00F2FE";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(centerX, pedestalY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // -----------------------------------------------------------------------
      // B. Concentric Holographic Gimbal Coordinate Rings (HUD Orbit)
      // -----------------------------------------------------------------------
      ctx.save();
      ctx.strokeStyle = isSynthetic ? "rgba(255, 80, 80, 0.22)" : "rgba(0, 229, 255, 0.24)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);

      // Equatorial Gimbal Ring tilted in 3D
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 8, baseScale * 14.5, baseScale * 4.2, rotY * 0.4, 0, Math.PI * 2);
      ctx.stroke();

      // Polar Gimbal Ring
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 4, baseScale * 3.8, baseScale * 14.2, rotX * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // -----------------------------------------------------------------------
      // C. 3D Cardioid Points Calculation & Depth Projection
      // -----------------------------------------------------------------------
      interface HologramPoint {
        px: number;
        py: number;
        z: number;
        alpha: number;
        isGlitch: boolean;
      }

      const points: HologramPoint[] = [];

      // Optional chromatic glitch burst for AI detection
      const glitchActive = isSynthetic && Math.sin(t * 8.5) > 0.82;
      const glitchShift = glitchActive ? (Math.random() - 0.5) * 8 : 0;

      for (let i = 1; i < uRings; i++) {
        const u = (i / uRings) * Math.PI;
        const sinU = Math.sin(u);

        for (let j = 0; j < vSteps; j++) {
          const v = (j / vSteps) * Math.PI * 2 - Math.PI;

          // Classical 3D parametric cardioid equations
          const rawX = 16 * Math.pow(sinU, 3) * Math.cos(v);
          const rawY = -(
            13 * Math.cos(u) -
            5 * Math.cos(2 * u) -
            2 * Math.cos(3 * u) -
            Math.cos(4 * u)
          );
          const rawZ = 16 * Math.pow(sinU, 3) * Math.sin(v) * 0.70;

          // Surface perturbation (erratic arrhythmia ripple if AI)
          const harmonic = isSynthetic
            ? 1.0 + Math.sin(u * 6 + v * 5 + t * 9) * 0.08
            : 1.0 + Math.sin(u * 4 + v * 3 + t * 2) * 0.015;

          const scaledX = rawX * dynamicScale * harmonic;
          const scaledY = rawY * dynamicScale * harmonic;
          const scaledZ = rawZ * dynamicScale * harmonic;

          // 3D Matrix Rotation (Yaw then Pitch)
          const x1 = scaledX * Math.cos(rotY) + scaledZ * Math.sin(rotY);
          const y1 = scaledY;
          const z1 = -scaledX * Math.sin(rotY) + scaledZ * Math.cos(rotY);

          const x2 = x1;
          const y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
          const z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);

          // Perspective Projection
          const depth = z2 + cameraDistance;
          const proj = fov / Math.max(depth, 40);
          const px = centerX + x2 * proj + glitchShift;
          const py = centerY + y2 * proj;

          // Depth-based luminous transparency
          const alpha = Math.max(0.12, Math.min(0.95, (z2 + 110) / 220));

          points.push({ px, py, z: z2, alpha, isGlitch: glitchActive });
        }
      }

      // Sort points by depth (Z-buffering for back-to-front rendering)
      points.sort((a, b) => a.z - b.z);

      // -----------------------------------------------------------------------
      // D. Render Volumetric Holographic Nodes & Photon Trails
      // -----------------------------------------------------------------------
      ctx.save();
      for (let k = 0; k < points.length; k++) {
        const pt = points[k];
        const isFore = pt.z > 0;
        const radius = isFore ? pt.alpha * 2.2 : pt.alpha * 1.3;

        ctx.beginPath();
        ctx.arc(pt.px, pt.py, radius, 0, Math.PI * 2);

        if (isSynthetic) {
          // AI GENERATED: High-voltage Electric Crimson & Neon Coral
          if (pt.isGlitch && k % 3 === 0) {
            ctx.fillStyle = `rgba(0, 240, 255, ${pt.alpha * 0.9})`; // Chromatic cyan offset
          } else {
            ctx.fillStyle = k % 5 === 0
              ? `rgba(255, 180, 0, ${pt.alpha})` // Golden warning spark
              : `rgba(255, 42, 85, ${pt.alpha * 0.95})`; // Electric crimson
          }
          if (isFore && k % 4 === 0) {
            ctx.shadowColor = "#FF2A55";
            ctx.shadowBlur = 8;
          } else {
            ctx.shadowBlur = 0;
          }
        } else {
          // GENUINE / AUTHENTIC: Electric Cyan, Luminous Aqua & Warm Champagne Gold
          ctx.fillStyle = k % 6 === 0
            ? `rgba(233, 196, 106, ${pt.alpha * 0.95})` // Champagne Gold highlight
            : `rgba(0, 242, 254, ${pt.alpha * 0.9})`; // Electric Cyan
          if (isFore && k % 4 === 0) {
            ctx.shadowColor = "#00F2FE";
            ctx.shadowBlur = 7;
          } else {
            ctx.shadowBlur = 0;
          }
        }

        ctx.fill();
      }
      ctx.restore();

      // -----------------------------------------------------------------------
      // E. Holographic Laser Scanning Plane Sweep
      // -----------------------------------------------------------------------
      const scanPeriod = (Math.sin(t * 2.4) + 1) / 2;
      const scanY = centerY - baseScale * 13 + scanPeriod * (baseScale * 25);

      ctx.save();
      const sweepGrad = ctx.createLinearGradient(centerX - baseScale * 14, scanY, centerX + baseScale * 14, scanY);
      const sweepColor = isSynthetic ? "rgba(255, 42, 85, " : "rgba(0, 242, 254, ";
      sweepGrad.addColorStop(0, `${sweepColor}0)`);
      sweepGrad.addColorStop(0.5, `${sweepColor}0.85)`);
      sweepGrad.addColorStop(1, `${sweepColor}0)`);

      ctx.strokeStyle = sweepGrad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(centerX - baseScale * 14, scanY);
      ctx.lineTo(centerX + baseScale * 14, scanY);
      ctx.stroke();

      // Laser plane bloom
      ctx.fillStyle = `${sweepColor}0.07)`;
      ctx.fillRect(centerX - baseScale * 13, scanY - 2, baseScale * 26, 4);
      ctx.restore();

      // -----------------------------------------------------------------------
      // F. Orbiting Photon Satellite & 3D Azimuth Tag
      // -----------------------------------------------------------------------
      ctx.save();
      const satAngle = t * (isSynthetic ? 3.6 : 1.8);
      const satRadiusX = baseScale * 13.5;
      const satRadiusY = baseScale * 5.0;
      const sx = centerX + Math.cos(satAngle) * satRadiusX;
      const sy = centerY + Math.sin(satAngle) * satRadiusY;

      ctx.fillStyle = isSynthetic ? "#FFD200" : "#E9C46A";
      ctx.shadowColor = isSynthetic ? "#FF2A55" : "#00F2FE";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Tiny HUD tag floating next to satellite
      ctx.shadowBlur = 0;
      ctx.font = "8px ui-monospace, monospace";
      ctx.fillStyle = isSynthetic ? "rgba(255, 210, 0, 0.75)" : "rgba(233, 196, 106, 0.75)";
      ctx.fillText(`SAT-${Math.round((satAngle % (Math.PI * 2)) * (180 / Math.PI))}°`, sx + 6, sy - 3);
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [width, height, isPlaying, isSynthetic, hasCardiacPulse, rawBpm, isAiGenerated]);

  // ---------------------------------------------------------------------------
  // 2. LIVE rPPG HEMODYNAMIC WAVEFORM SPARKLINE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const ecgCanvas = ecgCanvasRef.current;
    if (!ecgCanvas) return;
    const ctx = ecgCanvas.getContext("2d");
    if (!ctx) return;

    const w = width;
    const h = 40;
    ecgCanvas.width = w;
    ecgCanvas.height = h;

    const history = ecgHistoryRef.current;
    if (history.length === 0) {
      for (let i = 0; i < 90; i++) history.push(0);
    }

    const t = timeRef.current;
    let newSample = 0;
    if (hasCardiacPulse || isAiGenerated === false) {
      const phase = (t * 2.8) % (Math.PI * 2);
      newSample = Math.sin(phase) * 0.68 + Math.sin(phase * 2) * 0.28;
    } else {
      newSample = isSynthetic ? (Math.random() - 0.5) * 0.55 : (Math.random() - 0.5) * 0.1;
    }

    history.push(newSample);
    if (history.length > 90) history.shift();

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = isSynthetic ? "#FF2A55" : hasCardiacPulse || isAiGenerated === false ? "#00F2FE" : "#8A7E70";
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    const dx = w / (history.length - 1);
    for (let i = 0; i < history.length; i++) {
      const x = i * dx;
      const y = h / 2 - history[i] * (h * 0.38);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = isSynthetic ? "#FF2A55" : "#00F2FE";
    ctx.beginPath();
    ctx.arc(w - 4, h / 2 - newSample * (h * 0.38), 3, 0, Math.PI * 2);
    ctx.fill();
  }, [width, hasCardiacPulse, isSynthetic, isAiGenerated]);

  return (
    <div
      className={`rounded-3xl border border-[#E8DFCF] bg-[#FFFDF9] p-5 shadow-sm flex flex-col items-center max-w-full ${className}`}
      style={{ width: width + 36 }}
    >
      {/* Top Header & Cardiac Telemetry */}
      <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#EFE8DA]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
              isSynthetic
                ? "bg-red-50 text-[#FF2A55] animate-pulse"
                : hasCardiacPulse || isAiGenerated === false
                ? "bg-cyan-50 text-[#00A3FF]"
                : "bg-[#F3ECE0] text-[#7A7165]"
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">
              {isSynthetic ? "crisis_alert" : "cardiology"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-[#2A2521]">
                {title || "3D Holographic Cardioid Biometric"}
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  isSynthetic
                    ? "bg-red-100 text-[#FF2A55]"
                    : hasCardiacPulse || isAiGenerated === false
                    ? "bg-cyan-100 text-[#0084B4]"
                    : "bg-[#F3ECE0] text-[#7A7165]"
                }`}
              >
                {isSynthetic ? "TURBULENT GLITCH" : "STEADY HOLOGRAM"}
              </span>
            </div>
            <p className="text-[10px] text-[#7A7165]">
              {isSynthetic
                ? "Volumetric chromatic disruption • High-frequency dispersion"
                : "Harmonic RGB color-space geometry • Simulated representation"}
            </p>
          </div>
        </div>

        {/* Telemetry and Status */}
        <div className="text-right">
          <div className="font-mono font-extrabold text-xs text-[#2A2521]">
            {rawBpm > 0 ? `${rawBpm.toFixed(1)} rPPG (Est)` : "GEOMETRIC TELEMETRY"}
          </div>
          <span className="text-[10px] text-[#8A7E70]">
            {confidenceScore != null ? `Confidence: ${(confidenceScore * 100).toFixed(0)}%` : "Simulated Demonstration"}
          </span>
        </div>
      </div>

      {/* 3D Holographic Chamber Canvas (Deep Space Optics Backdrop) */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0A0E17] border border-[#1E2638] flex items-center justify-center shadow-inner">
        <canvas
          ref={canvasRef}
          style={{
            width,
            height,
            display: "block",
          }}
        />

        {/* Holographic Watermark HUD */}
        <div className="absolute top-2.5 left-2.5 text-[9px] font-mono tracking-widest text-[#00F2FE]/70 uppercase select-none pointer-events-none bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded border border-[#00F2FE]/20">
          3D CHROMATIC MANIFOLD &bull; {isSynthetic ? "DISPERSED" : "HARMONIC"}
        </div>

        {/* Bottom Coordinates Readout */}
        <div className="absolute bottom-2.5 right-2.5 text-[8px] font-mono text-white/50 select-none pointer-events-none">
          FOV: 340mm &bull; GEOMETRIC DEMONSTRATION &bull; NON-BIOMETRIC
        </div>
      </div>

      {/* Chromatic Waveform Sparkline */}
      <div className="w-full mt-3 space-y-1">
        <div className="flex justify-between items-center text-[10px] font-semibold text-[#7A7165]">
          <span>CHROMATIC VARIANCE WAVEFORM (DEMONSTRATION)</span>
          <span
            className={`font-mono ${
              isSynthetic ? "text-[#FF2A55]" : "text-[#00A3FF]"
            }`}
          >
            {isSynthetic ? "DISPERSED" : "CHROMATIC OSCILLATION"}
          </span>
        </div>
        <canvas
          ref={ecgCanvasRef}
          className="w-full rounded-xl bg-[#0A0E17] border border-[#1E2638] block"
          style={{ height: 38 }}
        />
      </div>

      {/* Channel Solo Toggles */}
      {showLabels && (
        <div className="w-full mt-3 pt-3 border-t border-[#EFE8DA] grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => interactive && setShowR(!showR)}
            className={`py-1.5 px-2 rounded-xl border text-center transition-all text-xs font-semibold ${
              showR
                ? "bg-[#FFF2F4] border-[#FF2A55] text-[#FF2A55]"
                : "bg-white border-[#E2D6C0] text-[#8A7E70]"
            }`}
          >
            <div className="text-[9px] font-mono text-[#8A7E70]">R-ARTERIAL</div>
            <div className="font-mono text-xs">{rDisplay}</div>
          </button>

          <button
            type="button"
            onClick={() => interactive && setShowG(!showG)}
            className={`py-1.5 px-2 rounded-xl border text-center transition-all text-xs font-semibold ${
              showG
                ? "bg-[#EBFBFF] border-[#00A3FF] text-[#0084B4]"
                : "bg-white border-[#E2D6C0] text-[#8A7E70]"
            }`}
          >
            <div className="text-[9px] font-mono text-[#8A7E70]">G-rPPG CAPILLARY</div>
            <div className="font-mono text-xs">{gDisplay}</div>
          </button>

          <button
            type="button"
            onClick={() => interactive && setShowB(!showB)}
            className={`py-1.5 px-2 rounded-xl border text-center transition-all text-xs font-semibold ${
              showB
                ? "bg-[#FFFBEB] border-[#E9C46A] text-[#8A6714]"
                : "bg-white border-[#E2D6C0] text-[#8A7E70]"
            }`}
          >
            <div className="text-[9px] font-mono text-[#8A7E70]">B-VENOUS</div>
            <div className="font-mono text-xs">{bDisplay}</div>
          </button>
        </div>
      )}
    </div>
  );
};

export default RGBHeartVisualization;
