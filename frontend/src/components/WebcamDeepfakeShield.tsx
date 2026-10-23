import React, { useState, useEffect, useRef } from "react";
import { LiveShieldFrameResponse } from "../types/api";
import { sendStreamLivenessFrame } from "../services/api";

interface WebcamDeepfakeShieldProps {
  onBackToOverview?: () => void;
}

type StreamMode = "webcam" | "screen" | "simulated";

export const WebcamDeepfakeShield: React.FC<WebcamDeepfakeShieldProps> = ({ onBackToOverview }) => {
  const [streamMode, setStreamMode] = useState<StreamMode>("webcam");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [livenessData, setLivenessData] = useState<LiveShieldFrameResponse | null>(null);
  const [pulseHistory, setPulseHistory] = useState<number[]>([]);
  const [fpsCounter, setFpsCounter] = useState<number>(0);

  // Grace Period & Warning States
  const [consecutiveStrikes, setConsecutiveStrikes] = useState<number>(0);
  const [isGraceActive, setIsGraceActive] = useState<boolean>(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState<number>(10);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [showLockdownModal, setShowLockdownModal] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const isSendingFrameRef = useRef<boolean>(false);
  const loopTimeoutRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());
  const simAnimationRef = useRef<number>(0);
  const graceTimerRef = useRef<number | null>(null);
  const strikesRef = useRef<number>(0);
  const isGraceActiveRef = useRef<boolean>(false);

  // Start real webcam stream
  const startCamera = async () => {
    stopStream();
    setCameraError(null);
    setStreamMode("webcam");
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
    }
  };

  // Start Desktop Screen Share stream
  const startScreenShare = async () => {
    stopStream();
    setCameraError(null);
    setStreamMode("screen");
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
    }
  };

  // Start simulated biometric feed
  const startSimulatedFeed = () => {
    stopStream();
    setCameraError(null);
    setStreamMode("simulated");
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
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setShowWarningModal(false);
    setIsGraceActive(false);
    isGraceActiveRef.current = false;
    setFpsCounter(0);
  };

  const scheduleNextFrame = (delayMs: number) => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopTimeoutRef.current = window.setTimeout(processFrameLoop, delayMs);
  };

  // Adaptive processing loop: captures and analyzes frame sequentially without overlaps
  const processFrameLoop = async () => {
    if (!isStreamingRef.current) return;
    if (isSendingFrameRef.current) {
      scheduleNextFrame(120);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      scheduleNextFrame(150);
      return;
    }

    let blob: Blob | null = null;

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
        scheduleNextFrame(150);
        return;
      }

      canvas.width = 480;
      canvas.height = Math.round((480 * video.videoHeight) / video.videoWidth);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      }
    }

    if (!blob || !isStreamingRef.current) {
      scheduleNextFrame(150);
      return;
    }

    isSendingFrameRef.current = true;
    try {
      const res = await sendStreamLivenessFrame(blob, Date.now());
      if (isStreamingRef.current) {
        setLivenessData(res);
        if (res.rppg_pulse_estimate !== undefined && res.rppg_pulse_estimate !== null && res.rppg_pulse_estimate > 0) {
          setPulseHistory((prev) => [...prev.slice(-28), res.rppg_pulse_estimate!]);
        }

        // Calculate actual FPS
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFpsCounter(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }

        // Strike enforcement & grace timer management
        const isSynthetic = res.verdict === "DEEPFAKE_INJECTION_DETECTED" || res.synthetic_confidence >= 0.55;
        if (isSynthetic) {
          if (!isGraceActiveRef.current) {
            strikesRef.current += 1;
            setConsecutiveStrikes(strikesRef.current);
            if (strikesRef.current >= 3) {
              stopStream();
              setShowLockdownModal(true);
              return;
            }
            setShowWarningModal(true);
          }
        } else {
          if (!isGraceActiveRef.current && strikesRef.current > 0 && frameCountRef.current % 12 === 0) {
            strikesRef.current = Math.max(0, strikesRef.current - 1);
            setConsecutiveStrikes(strikesRef.current);
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

  // User clicks [ OK — I'm Closing It ]
  const acknowledgeWarning = () => {
    setShowWarningModal(false);
    setIsGraceActive(true);
    isGraceActiveRef.current = true;
    setGraceSecondsLeft(10);

    if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    let left = 10;
    graceTimerRef.current = window.setInterval(() => {
      left -= 1;
      setGraceSecondsLeft(left);
      if (left <= 0) {
        if (graceTimerRef.current) clearInterval(graceTimerRef.current);
        graceTimerRef.current = null;
        setIsGraceActive(false);
        isGraceActiveRef.current = false;
      }
    }, 1000);
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
      : isStreaming
      ? "72.0"
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

        <div className="flex items-center gap-3">
          {onBackToOverview && (
            <button
              onClick={onBackToOverview}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#D5C9B3] text-[#2A2521] text-xs font-semibold hover:bg-[#F7F2E6] transition-colors"
            >
              &larr; Overview
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={stopStream}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">stop_screen_share</span>
              <span>Disarm Sentinel</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={startScreenShare}
                className="px-4 py-2.5 rounded-xl bg-[#2A2521] hover:bg-[#1A1614] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base text-[#38bdf8]">screen_share</span>
                <span>Share Screen</span>
              </button>
              <button
                onClick={startCamera}
                className="px-4 py-2.5 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">videocam</span>
                <span>Start Webcam</span>
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

      {/* Stream Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8DFCF] pb-2">
        <button
          onClick={startScreenShare}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            streamMode === "screen" && isStreaming
              ? "bg-[#2A2521] text-white shadow-xs"
              : "text-[#6C6357] hover:bg-[#FAF7EE]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">desktop_windows</span>
          <span>Desktop Screen Share</span>
        </button>
        <button
          onClick={startCamera}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            streamMode === "webcam" && isStreaming
              ? "bg-[#D9651E] text-white shadow-xs"
              : "text-[#6C6357] hover:bg-[#FAF7EE]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">videocam</span>
          <span>Webcam Biometrics</span>
        </button>
        <button
          onClick={startSimulatedFeed}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
                  {streamMode.toUpperCase()} STREAM {fpsCounter > 0 ? `(${fpsCounter} FPS)` : ""}
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
                  <span className="material-symbols-outlined text-xs text-rose-400 animate-pulse">
                    favorite
                  </span>
                  <span>{pulse} BPM</span>
                </div>
              </div>
            )}

            {/* Apple-style Grace HUD pill when OK is clicked */}
            {isGraceActive && (
              <div className="absolute top-4 inset-x-4 flex items-center justify-center pointer-events-none z-30 animate-fade-in">
                <div className="px-4 py-2 rounded-full bg-slate-900/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
                  <span className="text-xs font-semibold font-mono text-sky-300">
                    Grace Active: Close AI Window in [ {graceSecondsLeft}s ]
                  </span>
                </div>
              </div>
            )}

            {/* Interactive Threat Warning Modal */}
            {showWarningModal && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-40 animate-fade-in">
                <div className="bg-slate-900 border border-red-500/60 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">AI Content Detected</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Synthetic deepfake artifacts were detected on the active stream (Strike {consecutiveStrikes}/3).
                    </p>
                  </div>
                  <button
                    onClick={acknowledgeWarning}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md"
                  >
                    OK — Close AI Window
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
              Sentinel Status: <strong className="text-emerald-700">ARMED (STRIKES: {consecutiveStrikes}/3)</strong>
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
                {pulse} BPM
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

      {/* Fullscreen Lockdown Modal */}
      {showLockdownModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/80 rounded-3xl p-8 max-w-lg w-full text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto text-3xl">
              🛡️
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Security Intervention Triggered</h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                3 consecutive synthetic AI injection attempts were detected in the active stream. In accordance with Secura AI automated defense policy, your stream has been terminated immediately.
              </p>
            </div>
            <button
              onClick={() => setShowLockdownModal(false)}
              className="w-full py-3 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg"
            >
              Acknowledge &amp; Reset Sentinel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
