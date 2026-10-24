import React, { useState, useEffect, useRef } from "react";
import { LiveShieldFrameResponse } from "../types/api";
import { sendStreamLivenessFrame } from "../services/api";

export interface StrikeRecord {
  strikeNumber: 1 | 2 | 3;
  timestampUtc: string;
  verdict: string;
  syntheticConfidence: number;
  triggerFrameSeq: number;
  triggerRegionOrResolution: string;
  suspicionFlags: string[];
}

interface WebcamDeepfakeShieldProps {
  onBackToOverview?: () => void;
}

export type StreamMode = "webcam" | "screen" | "simulated";
export type ScreeningLifecycleState = "IDLE" | "SCREENING_ACTIVE" | "PAUSED_STRIKE_2" | "TERMINATED_STRIKE_3";
export type ActiveModalType = null | "STRIKE_1" | "STRIKE_2" | "STRIKE_3";

export const WebcamDeepfakeShield: React.FC<WebcamDeepfakeShieldProps> = ({ onBackToOverview }) => {
  const [streamMode, setStreamMode] = useState<StreamMode>("webcam");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [livenessData, setLivenessData] = useState<LiveShieldFrameResponse | null>(null);
  const [pulseHistory, setPulseHistory] = useState<number[]>([]);
  const [fpsCounter, setFpsCounter] = useState<number>(0);

  // 3-Strike Explicit State Machine & Audit History
  const [screeningState, setScreeningState] = useState<ScreeningLifecycleState>("IDLE");
  const [strikeCount, setStrikeCount] = useState<number>(0);
  const [strikeHistory, setStrikeHistory] = useState<StrikeRecord[]>([]);
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [activeTriggerRecord, setActiveTriggerRecord] = useState<StrikeRecord | null>(null);
  const [shieldStatus, setShieldStatus] = useState<string>("IDLE");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const isSendingFrameRef = useRef<boolean>(false);
  const loopTimeoutRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());
  const simAnimationRef = useRef<number>(0);
  const strikeCountRef = useRef<number>(0);
  const screeningStateRef = useRef<ScreeningLifecycleState>("IDLE");
  const cooldownUntilRef = useRef<number>(0);
  const lastTriggeredFingerprintRef = useRef<Uint8Array | null>(null);
  const frameSeqRef = useRef<number>(0);
  const latestAppliedSeqRef = useRef<number>(0);
  const lastSampledFingerprintRef = useRef<Uint8Array | null>(null);

  // Start real webcam stream
  const startCamera = async () => {
    stopStream();
    setCameraError(null);
    setStreamMode("webcam");
    setScreeningState("SCREENING_ACTIVE");
    screeningStateRef.current = "SCREENING_ACTIVE";
    setShieldStatus("ANALYZING");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser mediaDevices API not available.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      isStreamingRef.current = true;
      setIsStreaming(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Video auto-play note:", playErr);
        }
      }

      scheduleNextFrame(100);
    } catch (err: any) {
      console.error("Camera access error:", err);
      const msg =
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission denied by browser. You can click 'Run Simulated Feed' to test."
          : `Camera notice: ${err.message || "Device unavailable"}`;
      setCameraError(msg);
      isStreamingRef.current = false;
      setIsStreaming(false);
      setScreeningState("IDLE");
      screeningStateRef.current = "IDLE";
      setShieldStatus("IDLE");
    }
  };

  // Start Desktop Screen Share stream
  const startScreenShare = async () => {
    stopStream();
    setCameraError(null);
    setStreamMode("screen");
    setScreeningState("SCREENING_ACTIVE");
    screeningStateRef.current = "SCREENING_ACTIVE";
    setShieldStatus("ANALYZING");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture API not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        } as any,
        audio: false,
      });

      streamRef.current = stream;
      isStreamingRef.current = true;
      setIsStreaming(true);

      // Handle user stopping share via browser floating bar
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopStream();
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Screen video play note:", playErr);
        }
      }

      scheduleNextFrame(120);
    } catch (err: any) {
      console.error("Screen share error:", err);
      if (err.name !== "NotAllowedError") {
        setCameraError(`Screen share initialization: ${err.message || "Failed to start"}`);
      }
      isStreamingRef.current = false;
      setIsStreaming(false);
      setScreeningState("IDLE");
      screeningStateRef.current = "IDLE";
      setShieldStatus("IDLE");
    }
  };

  // Start simulated biometric feed
  const startSimulatedFeed = () => {
    stopStream();
    setCameraError(null);
    setStreamMode("simulated");
    setScreeningState("SCREENING_ACTIVE");
    screeningStateRef.current = "SCREENING_ACTIVE";
    setShieldStatus("ANALYZING");
    isStreamingRef.current = true;
    setIsStreaming(true);
    scheduleNextFrame(50);
  };

  const stopStream = () => {
    isStreamingRef.current = false;
    isSendingFrameRef.current = false;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setFpsCounter(0);
    latestAppliedSeqRef.current = 0;
    frameSeqRef.current = 0;
    lastSampledFingerprintRef.current = null;
    if (screeningStateRef.current !== "TERMINATED_STRIKE_3" && screeningStateRef.current !== "PAUSED_STRIKE_2") {
      setScreeningState("IDLE");
      screeningStateRef.current = "IDLE";
      setShieldStatus("IDLE");
    }
  };

  const scheduleNextFrame = (delayMs: number) => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopTimeoutRef.current = window.setTimeout(processFrameLoop, delayMs);
  };

  // Adaptive processing loop: captures and analyzes frame sequentially with change-detection
  const processFrameLoop = async () => {
    if (!isStreamingRef.current) return;
    if (isSendingFrameRef.current) {
      scheduleNextFrame(100);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      scheduleNextFrame(120);
      return;
    }

    let blob: Blob | null = null;
    let hasMeaningfulChange = true;

    if (streamMode === "simulated") {
      simAnimationRef.current++;
      const t = simAnimationRef.current;
      canvas.width = 480;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 480, 360);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 480, 360);

        const pulseMod = Math.sin(t * 0.25) * 4;
        ctx.fillStyle = `rgb(${195 + Math.round(pulseMod)}, ${150 + Math.round(pulseMod)}, ${130})`;
        ctx.beginPath();
        ctx.ellipse(240, 180, 75, 100, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.ellipse(210, 160, 10, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(270, 160, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(240, 220, 18, 0.1, Math.PI - 0.1);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#475569";
        ctx.stroke();

        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      }
    } else {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        scheduleNextFrame(120);
        return;
      }

      canvas.width = 480;
      canvas.height = Math.round((480 * video.videoHeight) / video.videoWidth);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Screen share change-detection: compare low-res 64x48 thumbnail to avoid redundant ML calls
        if (streamMode === "screen") {
          try {
            const miniCanvas = document.createElement("canvas");
            miniCanvas.width = 64;
            miniCanvas.height = 48;
            const miniCtx = miniCanvas.getContext("2d");
            if (miniCtx) {
              miniCtx.drawImage(canvas, 0, 0, 64, 48);
              const miniData = miniCtx.getImageData(0, 0, 64, 48).data;
              if (lastSampledFingerprintRef.current && lastSampledFingerprintRef.current.length === miniData.length) {
                let totalDiff = 0;
                const prev = lastSampledFingerprintRef.current;
                for (let i = 0; i < miniData.length; i += 4) {
                  totalDiff += Math.abs(miniData[i] - prev[i]) + Math.abs(miniData[i+1] - prev[i+1]) + Math.abs(miniData[i+2] - prev[i+2]);
                }
                const avgDiff = totalDiff / (64 * 48 * 3);
                if (avgDiff < 2.0 && livenessData != null) {
                  hasMeaningfulChange = false;
                }
              }
              lastSampledFingerprintRef.current = new Uint8Array(miniData);
            }
          } catch (diffErr) {
            hasMeaningfulChange = true;
          }
        }

        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      }
    }

    if (!hasMeaningfulChange) {
      setShieldStatus("IDLE_NO_CHANGE");
      scheduleNextFrame(100);
      return;
    }

    if (!blob || !isStreamingRef.current) {
      scheduleNextFrame(100);
      return;
    }

    const currentSeq = ++frameSeqRef.current;
    const captureTime = Date.now();
    isSendingFrameRef.current = true;
    setShieldStatus("ANALYZING");

    try {
      const res = await sendStreamLivenessFrame(blob, captureTime, currentSeq);
      if (isStreamingRef.current) {
        // Enforce monotonic ordering: discard if newer frame was already processed
        if (res.frame_seq == null || res.frame_seq >= latestAppliedSeqRef.current) {
          latestAppliedSeqRef.current = res.frame_seq || currentSeq;
          setLivenessData(res);
          setShieldStatus(
            res.verdict === "DEEPFAKE_INJECTION_DETECTED"
              ? "THREAT_DETECTED"
              : "LIVE_AUTHENTIC"
          );
          if (res.rppg_pulse_estimate !== undefined && res.rppg_pulse_estimate !== null && res.rppg_pulse_estimate > 0) {
            setPulseHistory((prev) => [...prev.slice(-28), res.rppg_pulse_estimate!]);
          }
        }

        // Calculate actual FPS
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFpsCounter(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }

        // Explicit 3-Strike Lifecycle Enforcement with Deduplication & Cooldown
        const isSynthetic = res.verdict === "DEEPFAKE_INJECTION_DETECTED" || res.synthetic_confidence >= 0.65;

        if (isSynthetic) {
          // Safeguard 1: Cooldown boundary (minimum 5s between strikes so static content doesn't trigger all 3)
          const inCooldown = now < cooldownUntilRef.current;

          // Safeguard 2: Visual deduplication - check difference from last triggered strike frame
          let isDuplicateVisual = false;
          if (lastSampledFingerprintRef.current && lastTriggeredFingerprintRef.current) {
            let totalDiff = 0;
            const cur = lastSampledFingerprintRef.current;
            const prev = lastTriggeredFingerprintRef.current;
            for (let i = 0; i < Math.min(cur.length, prev.length); i += 4) {
              totalDiff += Math.abs(cur[i] - prev[i]) + Math.abs(cur[i+1] - prev[i+1]) + Math.abs(cur[i+2] - prev[i+2]);
            }
            const avgDiff = totalDiff / ((Math.min(cur.length, prev.length) / 4) * 3);
            if (avgDiff < 3.5) {
              isDuplicateVisual = true;
            }
          }

          // A strike requires an active screening session, no modal currently blocking, and passing safeguards
          if (!inCooldown && !isDuplicateVisual && activeModal === null && screeningStateRef.current === "SCREENING_ACTIVE") {
            const nextStrike = Math.min(3, strikeCountRef.current + 1) as 1 | 2 | 3;
            strikeCountRef.current = nextStrike;
            setStrikeCount(nextStrike);

            const triggerRecord: StrikeRecord = {
              strikeNumber: nextStrike,
              timestampUtc: new Date().toISOString(),
              verdict: res.verdict,
              syntheticConfidence: res.synthetic_confidence,
              triggerFrameSeq: res.frame_seq || currentSeq,
              triggerRegionOrResolution: `${canvas.width} × ${canvas.height} px (${streamMode})`,
              suspicionFlags: res.suspicion_flags && res.suspicion_flags.length > 0
                ? res.suspicion_flags
                : ["Neural spatial diffusion anomaly detected in active stream"]
            };

            setStrikeHistory((prev) => [...prev, triggerRecord]);
            setActiveTriggerRecord(triggerRecord);
            cooldownUntilRef.current = now + 5000; // 5-second deduplication cooldown
            if (lastSampledFingerprintRef.current) {
              lastTriggeredFingerprintRef.current = new Uint8Array(lastSampledFingerprintRef.current);
            }

            if (nextStrike === 1) {
              setActiveModal("STRIKE_1");
            } else if (nextStrike === 2) {
              setActiveModal("STRIKE_2");
            } else if (nextStrike === 3) {
              setActiveModal("STRIKE_3");
            }
          }
        }
      }
    } catch (e) {
      console.warn("Live Shield frame analysis note:", e);
    } finally {
      isSendingFrameRef.current = false;
      if (isStreamingRef.current) {
        scheduleNextFrame(150);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // THREE-STRIKE ACTION HANDLERS (Section 7 Specification)
  // ---------------------------------------------------------------------------

  // Strike 1: User clicks [ OK / Continue Screening ]
  const handleAcknowledgeStrike1 = () => {
    setActiveModal(null);
    cooldownUntilRef.current = Date.now() + 5000; // 5s cooldown
    setScreeningState("SCREENING_ACTIVE");
    screeningStateRef.current = "SCREENING_ACTIVE";
  };

  // Strike 2: User clicks [ OK / Pause Active Session ]
  const handlePauseStrike2 = () => {
    setActiveModal(null);
    setScreeningState("PAUSED_STRIKE_2");
    screeningStateRef.current = "PAUSED_STRIKE_2";
    setShieldStatus("PAUSED_ON_STRIKE_2");
  };

  // Strike 2: User clicks [ Resume Screening Session ]
  const handleResumeStrike2 = () => {
    setActiveModal(null);
    cooldownUntilRef.current = Date.now() + 6000;
    setScreeningState("SCREENING_ACTIVE");
    screeningStateRef.current = "SCREENING_ACTIVE";
    setShieldStatus("LIVE_AUTHENTIC");
    scheduleNextFrame(100);
  };

  // Strike 3: User clicks [ Acknowledge & Terminate Session ]
  const handleTerminateStrike3 = () => {
    setActiveModal(null);
    setScreeningState("TERMINATED_STRIKE_3");
    screeningStateRef.current = "TERMINATED_STRIKE_3";
    setShieldStatus("TERMINATED");
    stopStream();
  };

  // Explicit session reset (Reset button)
  const handleResetSession = () => {
    strikeCountRef.current = 0;
    setStrikeCount(0);
    setStrikeHistory([]);
    setActiveModal(null);
    setActiveTriggerRecord(null);
    lastTriggeredFingerprintRef.current = null;
    cooldownUntilRef.current = 0;
    setScreeningState("IDLE");
    screeningStateRef.current = "IDLE";
    setShieldStatus("IDLE");
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  const isDeepfake = livenessData?.verdict === "DEEPFAKE_INJECTION_DETECTED";
  const isAuthentic = livenessData?.verdict === "LIVE_AUTHENTIC_STREAM";
  const aiScore = livenessData ? Math.round(livenessData.synthetic_confidence * 100) : 0;
  const pulse =
    livenessData?.rppg_pulse_estimate !== undefined && livenessData.rppg_pulse_estimate !== null && livenessData.rppg_pulse_estimate > 0
      ? livenessData.rppg_pulse_estimate.toFixed(1)
      : "—";

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#D9651E]/10 text-[#D9651E]">
              <span className="material-symbols-outlined text-2xl">shield_person</span>
            </span>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#2A2521] tracking-tight">
              Real-Time Sentinel &amp; Screen Shield
            </h1>
          </div>
          <p className="text-sm text-[#6C6357] mt-1 max-w-2xl">
            Live WebRTC anti-spoofing sentinel for video streams and desktop screen shares. Evaluates sub-dermal rPPG vascular hemoglobin pulse waves, Swin facial boundary artifacts, and temporal texture consistency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBackToOverview && (
            <button
              onClick={onBackToOverview}
              className="px-3 py-2 rounded-xl bg-white border border-[#D5C9B3] text-[#2A2521] text-xs font-semibold hover:bg-[#F7F2E6] transition-colors"
            >
              &larr; Overview
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={stopStream}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">stop_screen_share</span>
              <span>Disarm Sentinel</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={startCamera}
                className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">videocam</span>
                <span>Start Webcam</span>
              </button>
              <button
                onClick={startScreenShare}
                className="hidden sm:flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#2A2521] hover:bg-[#1A1614] text-white font-bold text-xs transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-base text-[#38bdf8]">screen_share</span>
                <span>Share Screen</span>
              </button>
              <button
                onClick={startSimulatedFeed}
                className="px-3 py-2.5 rounded-xl bg-white border border-[#D5C9B3] hover:bg-[#FAF7EE] text-[#4D453C] font-semibold text-xs transition-colors flex items-center gap-1 shadow-2xs"
                title="Test sentinel evaluation with simulated synthetic facial stream"
              >
                <span className="material-symbols-outlined text-base text-[#D9651E]">smart_toy</span>
                <span>Simulate</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stream Mode Switcher Tabs - responsive horizontal scroll on mobile */}
      <div className="flex items-center gap-2 border-b border-[#E8DFCF] pb-2 overflow-x-auto no-scrollbar max-w-full touch-pan-x">
        <button
          onClick={startCamera}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            streamMode === "webcam" && isStreaming
              ? "bg-[#D9651E] text-white shadow-xs"
              : "text-[#6C6357] hover:bg-[#FAF7EE]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">videocam</span>
          <span>Webcam Biometrics</span>
        </button>
        <button
          onClick={startScreenShare}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            streamMode === "screen" && isStreaming
              ? "bg-[#2A2521] text-white shadow-xs"
              : "text-[#6C6357] hover:bg-[#FAF7EE]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">desktop_windows</span>
          <span>Desktop Screen Share</span>
        </button>
        <button
          onClick={startSimulatedFeed}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            streamMode === "simulated" && isStreaming
              ? "bg-[#6C6357] text-white shadow-xs"
              : "text-[#6C6357] hover:bg-[#FAF7EE]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">smart_toy</span>
          <span>Simulated Feed</span>
        </button>
      </div>

      {/* Camera error message / suggestion */}
      {cameraError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
            <span>{cameraError}</span>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <button
              onClick={startSimulatedFeed}
              className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors"
            >
              Run Simulated Feed
            </button>
            <button onClick={() => setCameraError(null)} className="underline font-semibold text-amber-800">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Stream Viewport (7 cols) + Real-Time Telemetry HUD (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Video Viewport & Canvas Overlay */}
        <div className="lg:col-span-7 rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2A2521]">
              <span className="material-symbols-outlined text-base text-[#D9651E]">sensors</span>
              <span>Live Sentinel Viewport</span>
              {isStreaming && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                  {streamMode.toUpperCase()} STREAM {fpsCounter > 0 ? `(${fpsCounter} FPS)` : ""} &bull; {shieldStatus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#8A7E70]">
                Methodology: <strong className="text-[#2A2521]">Swin Transformer + rPPG</strong>
              </span>
            </div>
          </div>

          {/* Viewport Box */}
          <div
            className={`relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 transition-all duration-300 ${
              isDeepfake
                ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                : isStreaming
                ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                : "border-[#3A3530]"
            }`}
          >
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${isStreaming && streamMode !== "simulated" ? "block" : "hidden"}`}
            />

            {/* Hidden capture canvas */}
            <canvas ref={canvasRef} className={streamMode === "simulated" && isStreaming ? "w-full h-full object-cover block" : "hidden"} />

            {/* Placeholder when stream is inactive */}
            {!isStreaming && (
              <div className="text-center p-8 space-y-3">
                {screeningState === "TERMINATED_STRIKE_3" ? (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                      <span className="material-symbols-outlined text-3xl">gpp_bad</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-red-400">Screening Session Terminated</p>
                      <p className="text-xs text-slate-300 max-w-sm mx-auto">
                        In accordance with automated defense policy, 3 confirmed synthetic media events triggered complete stream termination and hardware release.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={handleResetSession}
                        className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">restart_alt</span>
                        <span>Start New Session (Reset Strikes)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-[#2A2521] text-[#E8DFCF] flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-3xl">desktop_windows</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">Stream Sentinel Inactive</p>
                      <p className="text-xs text-[#9E9385] max-w-sm">
                        Select "Share Screen" to inspect shared tabs/windows in real time, or "Start Webcam" for facial biometric verification.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={startScreenShare}
                        className="px-4 py-2 rounded-xl bg-[#2A2521] hover:bg-[#1A1614] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm text-[#38bdf8]">screen_share</span>
                        <span>Share Screen</span>
                      </button>
                      <button
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">videocam</span>
                        <span>Start Webcam</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Live Facial ROI Bounding Box */}
            {isStreaming && livenessData?.face_detected && livenessData.face_box && (
              <div
                style={{
                  position: "absolute",
                  top: `${livenessData.face_box[0] * 100}%`,
                  left: `${livenessData.face_box[1] * 100}%`,
                  width: `${(livenessData.face_box[3] - livenessData.face_box[1]) * 100}%`,
                  height: `${(livenessData.face_box[2] - livenessData.face_box[0]) * 100}%`,
                }}
                className={`border-2 rounded-xl pointer-events-none transition-all duration-200 ${
                  isDeepfake
                    ? "border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    : "border-emerald-400 bg-emerald-500/5 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                }`}
              >
                <div
                  className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-white ${
                    isDeepfake ? "bg-red-600" : "bg-emerald-600"
                  }`}
                >
                  {isDeepfake ? `SYNTHETIC (${aiScore}%)` : `AUTHENTIC (${100 - aiScore}%)`}
                </div>
              </div>
            )}

            {/* In-viewport Live Alert Ribbon */}
            {isStreaming && (
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md text-white font-mono text-[11px] border border-white/10">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDeepfake ? "bg-red-500 animate-ping" : "bg-emerald-400"
                    }`}
                  ></span>
                  <span>{isDeepfake ? "ALERT: SYNTHETIC MEDIA" : "VERIFIED: AUTHENTIC FEED"}</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md text-white font-mono text-[11px] border border-white/10">
                  <span className="material-symbols-outlined text-xs text-rose-400">
                    sensors
                  </span>
                  <span>{pulse !== "—" ? `${pulse} BPM (rPPG)` : "Chromatic Analysis"}</span>
                </div>
              </div>
            )}

            {/* Paused on Strike 2 Banner Overlay */}
            {screeningState === "PAUSED_STRIKE_2" && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 z-40 text-center space-y-4 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl">
                  ⏸️
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Screening Session Paused (Strike 2)</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                    Active scanning is paused following Strike 2. You may remove or close the synthetic media window, then resume screening.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleResumeStrike2}
                    className="px-5 py-2.5 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    <span>Resume Screening (Strike Count: 2)</span>
                  </button>
                  <button
                    onClick={handleResetSession}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
                  >
                    Reset Session
                  </button>
                </div>
              </div>
            )}

            {/* STRIKE 1 WARNING MODAL */}
            {activeModal === "STRIKE_1" && activeTriggerRecord && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-40 animate-fade-in">
                <div className="bg-slate-900 border border-amber-500/80 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl">
                    ⚠️
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                      Security Warning • Strike 1 of 3
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">Synthetic AI Content Detected</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Generative neural diffusion patterns were detected on the active stream with{" "}
                      <strong>{(activeTriggerRecord.syntheticConfidence * 100).toFixed(1)}% confidence</strong>.
                    </p>
                    <div className="mt-3 p-2.5 rounded-lg bg-black/50 border border-white/10 text-left text-[11px] font-mono text-slate-300 space-y-1">
                      <div>Trigger: Frame #{activeTriggerRecord.triggerFrameSeq} ({activeTriggerRecord.triggerRegionOrResolution})</div>
                      <div className="text-amber-300">Flag: {activeTriggerRecord.suspicionFlags[0]}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleAcknowledgeStrike1}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                  >
                    OK / Continue Screening
                  </button>
                </div>
              </div>
            )}

            {/* STRIKE 2 WARNING MODAL */}
            {activeModal === "STRIKE_2" && activeTriggerRecord && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-40 animate-fade-in">
                <div className="bg-slate-900 border border-rose-500/80 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl">
                    🛑
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                      Defense Intervention • Strike 2 of 3
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">Second Confirmed AI Detection</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      A distinct second generative media event was detected. As specified by product policy, you may pause active screening or acknowledge and resume.
                    </p>

                    {/* Strike History Log */}
                    <div className="mt-3 p-2.5 rounded-lg bg-black/50 border border-white/10 text-left text-[10px] font-mono text-slate-300 space-y-1.5">
                      <div className="font-bold text-white uppercase">Session Strike History:</div>
                      {strikeHistory.map((s, idx) => (
                        <div key={idx} className="flex justify-between text-slate-400">
                          <span>Strike {s.strikeNumber}: Frame #{s.triggerFrameSeq}</span>
                          <span className="text-rose-400">{(s.syntheticConfidence * 100).toFixed(0)}% AI</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePauseStrike2}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-white/10"
                    >
                      OK / Pause Active Session
                    </button>
                    <button
                      onClick={handleResumeStrike2}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs transition-all shadow-md"
                    >
                      Resume Screening
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STRIKE 3 LOCKDOWN AUDIT MODAL */}
            {activeModal === "STRIKE_3" && activeTriggerRecord && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-40 animate-fade-in">
                <div className="bg-slate-900 border border-red-500 rounded-2xl p-6 max-w-lg w-full text-center space-y-4 shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto text-2xl">
                    🛡️
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                      Automated Defense Intervention • Strike 3 of 3
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">Maximum Threat Threshold Reached</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Three verified synthetic AI events were detected on the active stream. In accordance with Secura AI automated defense policy, your stream session will now be terminated and hardware capture streams released.
                    </p>

                    {/* Full 3-Strike Audit Table */}
                    <div className="mt-3 p-3 rounded-lg bg-black/60 border border-white/10 text-left text-[11px] font-mono text-slate-300 space-y-2 max-h-48 overflow-y-auto">
                      <div className="font-bold text-white uppercase text-[10px] tracking-wider border-b border-white/10 pb-1">
                        Incident Audit Trail ({strikeHistory.length} Recorded Strikes)
                      </div>
                      {strikeHistory.map((s, idx) => (
                        <div key={idx} className="p-2 rounded bg-white/5 border border-white/5 space-y-0.5">
                          <div className="flex justify-between font-bold">
                            <span className="text-red-400">Strike {s.strikeNumber} — Frame #{s.triggerFrameSeq}</span>
                            <span className="text-white">{(s.syntheticConfidence * 100).toFixed(1)}% AI</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex justify-between">
                            <span>{s.triggerRegionOrResolution}</span>
                            <span>{new Date(s.timestampUtc).toLocaleTimeString()}</span>
                          </div>
                          {s.suspicionFlags && s.suspicionFlags.length > 0 && (
                            <div className="text-[10px] text-amber-300 truncate">
                              Flag: {s.suspicionFlags[0]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleTerminateStrike3}
                    className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg cursor-pointer"
                  >
                    Acknowledge &amp; Terminate Session
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-viewport telemetry summary */}
          <div className="p-3 bg-[#FAF7EE] rounded-2xl border border-[#E8DFCF] flex flex-wrap items-center justify-between text-xs text-[#70675D]">
            <div className="flex items-center gap-4">
              <span>
                Temporal Continuity:{" "}
                <strong className="text-[#2A2521]">
                  {livenessData ? `${(livenessData.temporal_consistency * 100).toFixed(1)}%` : "98.2%"}
                </strong>
              </span>
              <span>
                Vascular Variance:{" "}
                <strong className="text-[#2A2521]">
                  {livenessData ? livenessData.blood_volume_variance.toFixed(4) : "0.0480"}
                </strong>
              </span>
            </div>
            <div className="text-[11px] text-[#8A7E70]">
              Sentinel Status:{" "}
              <strong
                className={
                  screeningState === "SCREENING_ACTIVE"
                    ? "text-emerald-700"
                    : screeningState === "PAUSED_STRIKE_2"
                    ? "text-amber-700"
                    : screeningState === "TERMINATED_STRIKE_3"
                    ? "text-rose-700"
                    : "text-[#70675D]"
                }
              >
                {screeningState === "SCREENING_ACTIVE"
                  ? `ARMED (STRIKES: ${strikeCount}/3)`
                  : screeningState === "PAUSED_STRIKE_2"
                  ? "PAUSED (STRIKES: 2/3)"
                  : screeningState === "TERMINATED_STRIKE_3"
                  ? "TERMINATED (STRIKES: 3/3)"
                  : "STANDBY (IDLE)"}
              </strong>
            </div>
          </div>
        </div>

        {/* Right: Telemetry & Verdict Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Verdict Banner Card */}
          <div className="rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8A7E70]">
                Live Stream Verdict
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#FAF7EE] text-[#6C6357] border border-[#E8DFCF]">
                ISO 30107-3 PAD
              </span>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                isDeepfake
                  ? "bg-red-50 border-red-300 text-red-800"
                  : isAuthentic
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-[#FAF7EE] border-[#E8DFCF] text-[#4D453C]"
              }`}
            >
              <div>
                <div className="font-bold text-base uppercase tracking-tight">
                  {livenessData?.verdict
                    ? livenessData.verdict.replace(/_/g, " ")
                    : "STANDBY FOR STREAM"}
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  {isDeepfake
                    ? "Generative boundary artifacts detected in active stream."
                    : isAuthentic
                    ? "Natural continuity confirmed across optical and vascular bands."
                    : "Sentinel inactive. Share screen or start camera to monitor."}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-2xl font-black">
                  {isStreaming ? `${aiScore}%` : "—"}
                </span>
                <span className="block text-[10px] font-mono uppercase opacity-70">AI Risk</span>
              </div>
            </div>

            {/* AI Risk Score Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-[#70675D]">
                <span>Neural Artifact Probability</span>
                <span className="font-mono font-bold text-[#2A2521]">{aiScore}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#EFE8DA] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    aiScore > 50 ? "bg-red-600" : "bg-emerald-600"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, aiScore))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#8A7E70]">
                <span>0% Authentic</span>
                <span>50% Warning</span>
                <span>100% Injection</span>
              </div>
            </div>
          </div>

          {/* Biometric Vascular rPPG Monitor Card */}
          <div className="rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-rose-500 animate-pulse">
                  ecg_heart
                </span>
                <h3 className="font-bold text-sm text-[#2A2521]">rPPG Pulse Waveform Monitor</h3>
              </div>
              <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {pulse !== "—" ? `${pulse} BPM (Est)` : "Signal Standby"}
              </span>
            </div>

            <p className="text-xs text-[#6C6357] leading-relaxed">
              Living human skin undergoes microscopic color fluctuations synchronized with cardiac systole/diastole cycles. Generative diffusion media and virtual cams lack continuous hemoglobin waveforms.
            </p>

            {/* Pulsing Waveform Visualizer */}
            <div className="h-20 w-full rounded-xl bg-[#181615] p-2 flex items-center justify-between gap-1 overflow-hidden">
              {pulseHistory.length === 0 ? (
                <div className="w-full text-center text-xs text-[#70675D] font-mono">
                  {isStreaming ? "Calibrating vascular baseline..." : "Stream offline"}
                </div>
              ) : (
                pulseHistory.map((val, idx) => {
                  const normHeight = Math.min(100, Math.max(20, ((val - 50) / 50) * 100));
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-gradient-to-t from-rose-900 to-rose-400 rounded-xs transition-all duration-150"
                      style={{ height: `${normHeight}%` }}
                    />
                  );
                })
              )}
            </div>

            {/* Suspicion Flags Pill List */}
            {livenessData?.suspicion_flags && livenessData.suspicion_flags.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-[#8A7E70] uppercase tracking-wider block">
                  Active Forensic Flags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {livenessData.suspicion_flags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono"
                    >
                      &bull; {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
