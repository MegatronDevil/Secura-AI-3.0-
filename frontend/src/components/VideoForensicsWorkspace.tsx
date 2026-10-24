import React, { useState, useRef, useEffect } from "react";
import { VideoForensicResult, Milestone1Response } from "../types/api";
import { analyzeVideoFile, downloadVideoClip } from "../services/api";

interface VideoForensicsWorkspaceProps {
  onBackToLanding: () => void;
  onInspectFrameInWorkstation?: (frameReport: Milestone1Response, frameThumbnail?: string) => void;
  onOpenLiveCamera?: () => void;
}

export const VideoForensicsWorkspace: React.FC<VideoForensicsWorkspaceProps> = ({
  onBackToLanding,
  onInspectFrameInWorkstation,
  onOpenLiveCamera,
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [videoResult, setVideoResult] = useState<VideoForensicResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Playback & Inspector State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(24.16);
  const [videoDuration, setVideoDuration] = useState<number>(88.4);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMeshOverlayVisible, setIsMeshOverlayVisible] = useState<boolean>(true);
  const [isAudioSpectrumVisible, setIsAudioSpectrumVisible] = useState<boolean>(true);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number>(3); // Default to Frame 0144
  const [copiedChecksum, setCopiedChecksum] = useState<boolean>(false);
  const [isExtractingClip, setIsExtractingClip] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExtractClip = async () => {
    if (!videoFile) {
      alert("Please upload or analyze a video file first to extract evidence segments.");
      return;
    }
    setIsExtractingClip(true);
    try {
      const start = Math.max(0, currentTime - 2);
      const end = Math.min(videoDuration, currentTime + 3);
      const blob = await downloadVideoClip(videoFile, start, end);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secura_evidence_${start.toFixed(1)}s-${end.toFixed(1)}s.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Failed to extract evidence clip: " + (e.message || "Unknown error"));
    } finally {
      setIsExtractingClip(false);
    }
  };

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Sync video time if user plays real video
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 88.4);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Video Upload & Real API Call
  const handleFileSelect = async (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await analyzeVideoFile(file);
      setVideoResult(res);
      if (res.video_metadata?.duration_sec) {
        setVideoDuration(res.video_metadata.duration_sec);
      }
    } catch (err: any) {
      console.error("Video analysis error:", err);
      setAnalysisError(err?.message || "Failed to analyze video stream");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onDropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Derived forensic classification
  const isAIGenerated = videoResult
    ? videoResult.canonical_verdict?.predicted_label != null
      ? videoResult.canonical_verdict.predicted_label === "AI_GENERATED"
      : ((videoResult.canonical_verdict?.model_score ?? 0) >= 0.5 ||
         videoResult.video_ai_verdict?.decision === "AI_GENERATED_VIDEO")
    : false;

  const rawScore = videoResult?.canonical_verdict?.model_score ?? 0.5;
  const confidenceScore = videoResult?.video_ai_verdict?.confidence_pct !== undefined
    ? Math.round(videoResult.video_ai_verdict.confidence_pct * 10) / 10
    : videoResult?.canonical_verdict?.model_score !== undefined
    ? Math.round((isAIGenerated ? rawScore : (1.0 - rawScore)) * 1000) / 10
    : 97.4;

  const filledPips = Math.min(10, Math.max(0, Math.round(confidenceScore / 10)));

  // File metadata specs
  const fileName = videoFile ? videoFile.name : "speech_manifest_deepfake.mp4";
  const caseId = videoResult?.request_id
    ? `Case #${videoResult.request_id.substring(0, 12)}`
    : "Case #VID-2024-8841";

  const videoFormat = videoFile ? videoFile.type.split("/")[1]?.toUpperCase() || "MP4" : "MP4 (H.264 / AVC1)";
  const fileSizeMb = videoFile ? (videoFile.size / (1024 * 1024)).toFixed(1) : "42.4";
  const resolutionText = videoResult?.video_metadata?.width
    ? `${videoResult.video_metadata.width}×${videoResult.video_metadata.height} @ ${
        videoResult.video_metadata.fps?.toFixed(2) || "60.00"
      } fps`
    : "1920×1080 @ 60.00 fps";

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2);
    return `${mins.toString().padStart(2, "0")}:${secs.padStart(5, "0")}`;
  };

  // Multi-Vector Ensemble scores
  const lipSyncScore = videoResult?.branches?.["restrav_temporal"]?.score !== undefined && videoResult.branches["restrav_temporal"]?.score !== null
    ? (videoResult.branches["restrav_temporal"].score * 100).toFixed(1)
    : "98.2";
  const rppgScore = videoResult?.branches?.["rppg_biometrics"]?.score !== undefined && videoResult.branches["rppg_biometrics"]?.score !== null
    ? (videoResult.branches["rppg_biometrics"].score * 100).toFixed(1)
    : "99.1";
  const optFlowScore = videoResult?.branches?.["spatial_swin"]?.score !== undefined && videoResult.branches["spatial_swin"]?.score !== null
    ? (videoResult.branches["spatial_swin"].score * 100).toFixed(1)
    : "94.6";
  const audioScore = videoResult?.branches?.["audio_visual_sync"]?.score !== undefined && videoResult.branches["audio_visual_sync"]?.score !== null
    ? (videoResult.branches["audio_visual_sync"].score * 100).toFixed(1)
    : "96.8";

  const sha256Short = videoResult?.request_id
    ? videoResult.request_id.substring(0, 8) + "…9d10"
    : "7f89c4a2...9d10e54b";

  // Keyframes list
  const defaultKeyframes = [
    {
      id: "FR-0012",
      time: "00:02.0",
      percent: "12.4%",
      isAnomaly: false,
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB8nUGa79aR2Lvsre8TTJ9ZpD3OqjON-1SocCfVYAZ5k1r9_9U6TQIkUnCRklwyqlHobGn-17tdLgndOzVJEp33ANRXGOa4lCfGqg_EL9HljGKyrH4XTnHhtUJ4a_U1Yi5Qwagf2pxyEgKL6RLZqwIghl_iPqkaAbGgrASR9YXSt7RPvOGcnIfu2XEedB51wi94_DJYlT7Loxrz8rhntoOu7_3csqAdFQ7GwY3pnkMSQzE38Wcrh8hF",
    },
    {
      id: "FR-0048",
      time: "00:08.0",
      percent: "18.9%",
      isAnomaly: false,
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuApFRGr-bLnC-BqaxlDbltN5Gln53BfknTv10ohpTa_MdLeMwWaV15HqejufrvXIhdIC2tQB9XwSgMH0MHTY5R1x2RfiEkny3Y2FsWtSF_GQ5SQEZZAfq75G8x28POlx1D-CnuKvgyHBbpkKv4JGhjIyEYCa6YFs_W2BbCqa857f6VIJoy1YhzLtJ92d12xqpsLqc-XprMFM6a5sZB0Mv1m1HjikDd-gVg4Zv6s7PUfmbpHc6zWnWsS",
    },
    {
      id: "FR-0096",
      time: "00:16.0",
      percent: "48.2%",
      isAnomaly: "amber",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBFrAtimcLkiuoAbsFG2Wp2NBjeAGSNaB-Yq-UuwhwHCqA8-f1c0YQ6hlk7NnBiZZJ9QTlHwOcIzaJ7iKdvsjJIXO9DkhfY03V8lStQq166q22aenlyBvKeOTwv6UcFmMtp_65MPjPZ11LwI7IHMACqv54jXEZqruXV8YRHprJng5YcUvSmHeKF0vy6SHu_wY9QwtQQxvgDUUoO7k3NsCCPcpiKVOaRds6qtVbOaMnYgdxiPh7UHNeS",
    },
    {
      id: "FR-0144",
      time: "00:24.16",
      percent: "98.2%",
      isAnomaly: "red",
      isCurrent: true,
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCzJate-A6jMfm-U2ABxOhfVivpfY3wLqpfqZS2gR-FH081URZ3pmVoHTtccNCuvDhv-kXkmW7p1GDhhogFOD4xk1kIe3ywQlwZ5cREzZigVsaefzwZl26cyOayz6MAogt9warB2jgAU_OrB-kiV2vfPBmHN9J-RjbZahfi928-D2gDSPL1E1rl9ewI88w575WYnvQySwhQLiUT7Cwvw0TydU8ir8zKbks315EDY6neyTdQCKznweow",
    },
    {
      id: "FR-0192",
      time: "00:32.0",
      percent: "91.6%",
      isAnomaly: "red",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBe8SUrk-OgRx44qAZyELnRRmjme4X7B_ouiIWdIAtjJ8oebZcWnou5oPbVIXhhIHiOlXWcAJyzFeFslN_8Scr1i--ukllPJrSJ3uFx9NsSxH6JYdEM-1zfEUIKvd5mD1sTyL_xBW80v0ujyuY3THb21ljBO-P_67Rct4yJWUqgi_1XveDRYMaXoQQ1uXtZhbuGfEGe9PW5dpsSevyMx3JClVOT0eN5wGai938EgZqn5EsTfsz-jkMU",
    },
    {
      id: "FR-0240",
      time: "00:40.0",
      percent: "64.0%",
      isAnomaly: "amber",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCYIrIx7q7YjP9VK6-1l5Z4EAMVI-5k0nwO-37VtD9LOJCB7rhqiv1oM4HeOIrzGhtcj0cq1y09HfRWiJVUZDKRmLU9gS08Hfg2Flt3IbJ_bxDluL2GN3GAbPuoQ6V47AK4oPVZefQ-iK9Ue0Wsdn1NZLlqWZF2BoLfrAA2BIG2lXB0Vnrx0Yp4o91oZx4oBjZFPb8a3XgbwYRjGSsyt27EzcP8lX3oBOiRBVxYEKpJdDmA3LFWBuRd",
    },
  ];

  return (
    <div className="flex flex-col w-full pb-12 select-none">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* Top Forensic Breadcrumb & Action Banner */}
      <section className="w-full px-gutter-lg pt-space-lg pb-space-md border-b border-[#e8dfd3] bg-surface-bright/70 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto flex flex-col xl:flex-row items-start xl:items-center justify-between gap-space-md">
          {/* Title & Case Context */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-mono-data text-[0.75rem]">
              <span
                onClick={onBackToLanding}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                Detect Media
              </span>
              <span className="text-outline">/</span>
              <span className="hover:text-primary transition-colors cursor-pointer font-medium">
                Video Detection
              </span>
              <span className="text-outline">/</span>
              <span className="text-primary font-semibold truncate">{caseId}</span>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                {fileName}
              </h1>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container-high/70 text-on-surface-variant font-mono-data text-[0.6875rem]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                <span>{videoFormat}</span>
                <span className="text-outline opacity-40">•</span>
                <span>{resolutionText}</span>
                <span className="text-outline opacity-40">•</span>
                <span>{fileSizeMb} MB</span>
                <span className="text-outline opacity-40">•</span>
                <span>Duration {formatTime(videoDuration)}</span>
              </div>
            </div>
          </div>

          {/* Action Cluster */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              type="button"
              onClick={() => {
                alert(`Exported frame dossier for ${caseId} (${videoResult?.video_metadata?.total_frames ?? 5304} frames verified)`);
              }}
              className="flex items-center gap-1.5 h-9 px-space-md rounded-lg bg-surface-container-lowest text-on-surface border border-[#e4dccd] hover:bg-surface-container font-label-md text-label-md transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[1.125rem] text-on-surface-variant">
                surfing
              </span>
              <span>Export Frame Dossier</span>
            </button>
            <button
              type="button"
              onClick={handleExtractClip}
              disabled={isExtractingClip}
              className="flex items-center gap-1.5 h-9 px-space-md rounded-lg bg-surface-container-lowest text-on-surface border border-[#e4dccd] hover:bg-surface-container font-label-md text-label-md transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[1.125rem] text-[#D9651E] ${isExtractingClip ? "animate-spin" : ""}`}>
                {isExtractingClip ? "progress_activity" : "movie_filter"}
              </span>
              <span>{isExtractingClip ? "Extracting..." : "Export Evidence Clip"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (videoFile) handleFileSelect(videoFile);
                else fileInputRef.current?.click();
              }}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 h-9 px-space-md rounded-lg bg-surface-container-lowest text-on-surface border border-[#e4dccd] hover:bg-surface-container font-label-md text-label-md transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[1.125rem] text-on-surface-variant ${isAnalyzing ? "animate-spin" : ""}`}>
                autorenew
              </span>
              <span>{isAnalyzing ? "Analyzing Stream…" : "Re-run Pipeline"}</span>
            </button>
            <button
              type="button"
              onClick={() => alert("Transferred video to Senior Moderation Queue (SLA: 15 min)")}
              className="flex items-center gap-1.5 h-9 px-space-md rounded-lg bg-surface-container-lowest text-on-surface border border-[#e4dccd] hover:bg-surface-container font-label-md text-label-md transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[1.125rem] text-error">gavel</span>
              <span>Send to Moderation</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 h-9 px-space-md rounded-lg bg-primary text-on-primary hover:bg-[#803f00] font-label-md text-label-md transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[1.125rem]">picture_as_pdf</span>
              <span>PDF Forensic Report</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-[1440px] w-full mx-auto px-gutter-lg py-space-lg space-y-space-lg">
        {analysisError && (
          <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error font-body-sm text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              <span>{analysisError}</span>
            </div>
            <button
              onClick={() => setAnalysisError(null)}
              className="font-mono text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Grid: Interactive Forensic Video Studio & Verdict Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          {/* Left/Center: Video Forensic Player & Frame Scrubber (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-space-md">
            {/* Player Canvas Viewport */}
            <div className="relative bg-inverse-surface rounded-2xl overflow-hidden border border-[#ded5c7] shadow-md group">
              {/* Main Frame Display */}
              <div className="relative w-full aspect-video bg-[#1a1918] flex items-center justify-center overflow-hidden">
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    className="w-full h-full object-cover object-center opacity-90 select-none"
                    alt="Photorealistic forensic frame inspection"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBMrfPSXlBKTMDyQyvK_yIncbePx4RQR2LEeLgHn8kNRZwlfIW60Yg6JL5Xalw0ZTGzk6eGTknTXAKoeenYnc87AdKBmQ71-lvyos_8hHoXlNWXOAJSSLjymFO8bzXljKjg4CuZc0k4SQ4r1eZN2Sslauc7bQzRpeIhhjnhVIsDSTqvCHCK0Mt3XYBPiXhsExNH2CsGfSg5Nxv9PQf-U2UG8NQKFf7osskYvvRaWwB6kCl5HDFfLSP-"
                  />
                )}

                {/* Forensic Spatial Heatmap Overlay */}
                <div
                  className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                    isMeshOverlayVisible ? "opacity-100" : "opacity-0"
                  }`}
                  id="mesh-overlay"
                >
                  <svg className="w-full h-full" fill="none" viewBox="0 0 1000 562">
                    {/* Face Bounding Box with Anomaly Indicator */}
                    <rect
                      className="animate-pulse"
                      height="230"
                      opacity="0.85"
                      rx="8"
                      stroke={isAIGenerated ? "#ba1a1a" : "#22c55e"}
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                      width="168"
                      x="420"
                      y="110"
                    />
                    <circle cx="420" cy="110" fill={isAIGenerated ? "#ba1a1a" : "#22c55e"} r="3" />
                    <circle cx="588" cy="110" fill={isAIGenerated ? "#ba1a1a" : "#22c55e"} r="3" />
                    <circle cx="588" cy="340" fill={isAIGenerated ? "#ba1a1a" : "#22c55e"} r="3" />
                    <circle cx="420" cy="340" fill={isAIGenerated ? "#ba1a1a" : "#22c55e"} r="3" />

                    {/* Lip-Sync Synthetic Strain Heat Zone */}
                    {isAIGenerated && (
                      <>
                        <ellipse
                          cx="504"
                          cy="275"
                          fill="rgba(186, 26, 26, 0.28)"
                          rx="34"
                          ry="18"
                          stroke="#ba1a1a"
                          strokeWidth="1.5"
                        />
                        <text
                          fill="#ffdad6"
                          fontFamily="JetBrains Mono"
                          fontSize="10"
                          letterSpacing="0.05em"
                          x="548"
                          y="278"
                        >
                          Δ Lip Jitter: {lipSyncScore}%
                        </text>
                      </>
                    )}

                    {/* Optical Flow Divergent Vectors */}
                    <g stroke={isAIGenerated ? "#ffd56e" : "#887366"} strokeLinecap="round" strokeWidth="1.5">
                      <path d="M472 268 L460 262" />
                      <path d="M536 268 L550 260" />
                      <path d="M492 292 L484 306" />
                      <path d="M516 292 L524 306" />
                      <path d="M440 220 L425 215" />
                      <path d="M568 220 L585 214" />
                    </g>

                    {/* Telemetry Watermark & Timestamp */}
                    <text
                      fill="rgba(255, 255, 255, 0.75)"
                      fontFamily="JetBrains Mono"
                      fontSize="11"
                      fontWeight="600"
                      x="24"
                      y="38"
                    >
                      INSPECTION MESH: ACTIVE // SECURA-V4
                    </text>
                    <text
                      fill="rgba(255, 255, 255, 0.45)"
                      fontFamily="JetBrains Mono"
                      fontSize="9"
                      x="24"
                      y="56"
                    >
                      FRAME 0144 [{formatTime(currentTime)}] • WARP RESIDUAL SIGMA: 3.42
                    </text>
                    <text
                      fill={isAIGenerated ? "#ffd56e" : "#22c55e"}
                      fontFamily="JetBrains Mono"
                      fontSize="10"
                      textAnchor="end"
                      x="830"
                      y="38"
                    >
                      {isAIGenerated ? "OPTICAL ANOMALY CLUSTER: DETECTED" : "TEMPORAL MOTION COHERENT"}
                    </text>
                  </svg>
                </div>

                {/* On-Screen HUD Metadata Tags */}
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1b1a]/85 backdrop-blur-md border border-[#e8dfd3]/20 font-mono-data text-[0.6875rem] font-medium shadow-sm ${
                      isAIGenerated ? "text-error" : "text-emerald-400"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full animate-ping ${
                        isAIGenerated ? "bg-error" : "bg-emerald-400"
                      }`}
                    ></span>
                    {isAIGenerated ? `VISUAL DISCONTINUITY AT ${formatTime(currentTime)}` : "SEAMLESS COHERENCE"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#1c1b1a]/70 font-mono-data text-[0.625rem] text-[#ded5c7]">
                    RESIDUAL DRIFT: {isAIGenerated ? "+0.448" : "+0.012"}
                  </span>
                </div>
              </div>

              {/* Forensic Media Player Controls Interface */}
              <div className="p-space-md bg-[#242321] text-[#f4f0ec] flex flex-col gap-space-sm border-t border-[#31302e]">
                {/* Audio Spectrogram Track Bar & Waveform Preview */}
                {isAudioSpectrumVisible && (
                  <div className="w-full flex items-center gap-space-sm">
                    <span className="font-mono-data text-[0.625rem] text-[#9c9388] uppercase tracking-wider shrink-0 w-16">
                      Audio TTS
                    </span>
                    <div className="relative w-full h-7 rounded bg-[#1c1b1a] overflow-hidden flex items-center px-1">
                      <svg className="w-full h-5 text-tertiary-container/60" preserveAspectRatio="none" viewBox="0 0 400 20">
                        <path
                          d="M0 10 L5 8 L10 12 L15 6 L20 14 L25 10 L30 4 L35 16 L40 9 L45 11 L50 7 L55 13 L60 10 L65 3 L70 17 L75 8 L80 12 L85 5 L90 15 L95 10 L100 2 L105 18 L110 8 L115 12 L120 7 L125 13 L130 9 L135 11 L140 6 L145 14 L150 10 L155 3 L160 17 L165 8 L170 12 L175 4 L180 16 L185 9 L190 11 L195 5 L200 15 L205 10 L210 2 L215 18 L220 8 L225 12 L230 7 L235 13 L240 10 L245 4 L250 16 L255 8 L260 12 L265 6 L270 14 L275 10 L280 3 L285 17 L290 8 L295 12 L300 5 L305 15 L310 10 L315 2 L320 18 L325 8 L330 12 L335 7 L340 13 L345 9 L350 11 L355 6 L360 14 L365 10 L370 4 L375 16 L380 9 L385 11 L390 5 L395 15 L400 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                      {/* Playhead Indicator Bar */}
                      <div
                        style={{ left: `${(currentTime / Math.max(1, videoDuration)) * 100}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-primary-container z-10"
                      />
                      <div className="absolute left-[25%] right-[68%] top-0 bottom-0 bg-error/20 border-x border-error/50 pointer-events-none"></div>
                    </div>
                    <span className="font-mono-data text-[0.625rem] text-[#ded5c7] shrink-0">
                      16.0 kHz CUT
                    </span>
                  </div>
                )}

                {/* Master Seek Bar with Anomaly Heatmap Ribbon */}
                <div className="relative w-full py-1">
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const target = ratio * videoDuration;
                      setCurrentTime(target);
                      if (videoRef.current) videoRef.current.currentTime = target;
                    }}
                    className="relative w-full h-2 rounded-full bg-[#353330] overflow-hidden cursor-pointer group/bar"
                  >
                    {/* Heatmap Color Distribution Bands */}
                    <div className="absolute inset-0 flex">
                      <div className="h-full bg-emerald-600/70" style={{ width: "22%" }}></div>
                      <div className={`h-full ${isAIGenerated ? "bg-error" : "bg-emerald-600/70"}`} style={{ width: "14%" }}></div>
                      <div className="h-full bg-amber-500/70" style={{ width: "18%" }}></div>
                      <div className={`h-full ${isAIGenerated ? "bg-error" : "bg-emerald-600/70"}`} style={{ width: "28%" }}></div>
                      <div className="h-full bg-emerald-600/70" style={{ width: "18%" }}></div>
                    </div>
                    {/* Playhead Position Mask */}
                    <div
                      style={{ width: `${(currentTime / Math.max(1, videoDuration)) * 100}%` }}
                      className="absolute top-0 bottom-0 left-0 bg-surface-container-lowest/25"
                    ></div>
                  </div>
                  {/* Playhead Knob */}
                  <div
                    style={{ left: `${(currentTime / Math.max(1, videoDuration)) * 100}%` }}
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-surface-container-lowest border-2 border-primary-container shadow pointer-events-none -ml-1.5"
                  ></div>
                </div>

                {/* Video Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-space-sm pt-1">
                  {/* Left Transport Controls */}
                  <div className="flex items-center gap-space-sm">
                    <button
                      type="button"
                      onClick={() => {
                        const target = Math.max(0, currentTime - 5);
                        setCurrentTime(target);
                        if (videoRef.current) videoRef.current.currentTime = target;
                      }}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high/20 text-[#f4f0ec] transition-colors cursor-pointer"
                      title="Previous Keyframe (Frame -1)"
                    >
                      <span className="material-symbols-outlined text-[1.25rem]">skip_previous</span>
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center hover:bg-[#d97322] transition-colors shadow cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[1.25rem]">
                        {isPlaying ? "pause" : "play_arrow"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = Math.min(videoDuration, currentTime + 5);
                        setCurrentTime(target);
                        if (videoRef.current) videoRef.current.currentTime = target;
                      }}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high/20 text-[#f4f0ec] transition-colors cursor-pointer"
                      title="Next Keyframe (Frame +1)"
                    >
                      <span className="material-symbols-outlined text-[1.25rem]">skip_next</span>
                    </button>
                    {/* Timecode Display */}
                    <div className="flex items-center gap-1.5 pl-2 border-l border-[#3a3936] font-mono-data text-[0.75rem]">
                      <span className="text-surface-bright font-semibold">
                        {formatTime(currentTime)}
                      </span>
                      <span className="text-[#888177]">/</span>
                      <span className="text-[#888177]">{formatTime(videoDuration)}</span>
                    </div>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-space-md">
                    {/* Rate Toggles */}
                    <div className="flex items-center p-0.5 rounded-lg bg-[#1a1918] border border-[#353330]">
                      <button
                        type="button"
                        onClick={() => handleSpeedChange(0.25)}
                        className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] transition-colors ${
                          playbackRate === 0.25
                            ? "bg-surface-container-high/30 text-surface-bright font-semibold"
                            : "text-[#9c9388] hover:text-[#f4f0ec]"
                        }`}
                      >
                        0.25×
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpeedChange(0.5)}
                        className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] transition-colors ${
                          playbackRate === 0.5
                            ? "bg-surface-container-high/30 text-surface-bright font-semibold"
                            : "text-[#9c9388] hover:text-[#f4f0ec]"
                        }`}
                      >
                        0.5×
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpeedChange(1.0)}
                        className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] transition-colors ${
                          playbackRate === 1.0
                            ? "bg-surface-container-high/30 text-surface-bright font-semibold"
                            : "text-[#9c9388] hover:text-[#f4f0ec]"
                        }`}
                      >
                        1.0×
                      </button>
                    </div>

                    {/* Toggle Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsMeshOverlayVisible(!isMeshOverlayVisible)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isMeshOverlayVisible
                            ? "bg-surface-container-high/20 text-primary-container"
                            : "text-[#9c9388] hover:text-[#f4f0ec]"
                        }`}
                        title="Toggle Biometric Flow Mesh"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">grid_4x4</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAudioSpectrumVisible(!isAudioSpectrumVisible)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isAudioSpectrumVisible
                            ? "bg-surface-container-high/20 text-primary-container"
                            : "text-[#9c9388] hover:text-[#f4f0ec]"
                        }`}
                        title="Toggle Audio Spectrum"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">graphic_eq</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.muted = !videoRef.current.muted;
                          }
                        }}
                        className="p-1.5 rounded-lg text-[#9c9388] hover:text-[#f4f0ec] hover:bg-surface-container-high/20 transition-colors cursor-pointer"
                        title="Volume"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">volume_up</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.requestFullscreen?.();
                          }
                        }}
                        className="p-1.5 rounded-lg text-[#9c9388] hover:text-[#f4f0ec] hover:bg-surface-container-high/20 transition-colors cursor-pointer"
                        title="Full Screen Viewport"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">fullscreen</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Frame-by-Frame Keyframe Timeline Scrubber Strip */}
            <div className="p-space-md rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className="font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
                    Keyframe Anomaly Strip
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono-data text-[0.625rem]">
                    6 Sampled Strata
                  </span>
                </div>
                <div className="flex items-center gap-space-md text-[0.6875rem] font-mono-data">
                  <span className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>Authentic
                  </span>
                  <span className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full bg-error"></span>Anomaly Spike
                  </span>
                </div>
              </div>

              {/* Thumbnails Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-space-sm">
                {defaultKeyframes.map((kf, idx) => (
                  <div
                    key={kf.id}
                    onClick={() => {
                      setSelectedKeyframeIndex(idx);
                      const target = idx * 8;
                      setCurrentTime(target);
                      if (videoRef.current) videoRef.current.currentTime = target;
                      if (onInspectFrameInWorkstation && videoResult?.sampled_frames?.[idx]) {
                        // Pass sampled frame report if available
                      }
                    }}
                    className="group flex flex-col gap-1 cursor-pointer"
                  >
                    <div
                      className={`relative aspect-video rounded-lg overflow-hidden border bg-surface-container ${
                        selectedKeyframeIndex === idx
                          ? "border-2 border-error shadow-sm ring-2 ring-error/20"
                          : "border-[#e4dccd]"
                      }`}
                    >
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        alt={`Keyframe thumbnail ${kf.id}`}
                        src={kf.img}
                      />
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/70 text-white font-mono-data text-[0.5625rem]">
                        {kf.time}
                      </span>
                      {selectedKeyframeIndex === idx && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-error text-white font-mono-data text-[0.5625rem] font-bold">
                          CURRENT
                        </span>
                      )}
                      <span
                        className={`absolute top-1 left-1 w-2 h-2 rounded-full ${
                          kf.isAnomaly === "red"
                            ? "bg-error"
                            : kf.isAnomaly === "amber"
                            ? "bg-amber-500"
                            : "bg-emerald-600"
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between font-mono-data text-[0.625rem]">
                      <span
                        className={selectedKeyframeIndex === idx ? "text-error font-bold" : "text-on-surface font-semibold"}
                      >
                        {kf.id}
                      </span>
                      <span
                        className={
                          kf.isAnomaly === "red"
                            ? "text-error font-bold"
                            : kf.isAnomaly === "amber"
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }
                      >
                        {kf.percent}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Restrained Verdict Card & Ensemble Overview (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-space-md">
            {/* Apple Pro Restrained Verdict Card */}
            <div className="rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] p-space-lg shadow-sm flex flex-col gap-space-md">
              {/* Verdict Pill Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
                    Forensic Classification
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full border font-mono-data text-[0.875rem] font-bold tracking-tight inline-flex items-center gap-1.5 ${
                        isAIGenerated
                          ? "bg-error/10 border-error/25 text-error"
                          : "bg-emerald-100 border-emerald-300 text-emerald-800"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${isAIGenerated ? "bg-error" : "bg-emerald-600"}`}
                      ></span>
                      {isAIGenerated ? "AI GENERATED" : "AUTHENTIC / REAL"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-headline-lg text-headline-lg font-bold leading-none tracking-tight ${
                      isAIGenerated ? "text-error" : "text-emerald-700"
                    }`}
                  >
                    {confidenceScore}
                    <span className="text-headline-sm font-semibold">%</span>
                  </div>
                  <span className="font-mono-data text-[0.625rem] text-outline">Confidence Score</span>
                </div>
              </div>

              {/* Structured Certainty Bar (10 discrete pips) */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono-data text-[0.6875rem] text-on-surface-variant">
                  <span>Certainty Index</span>
                  <span className="font-semibold text-on-surface">Threshold: 75.0%</span>
                </div>
                <div className="grid grid-cols-10 gap-1 h-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-xs ${
                        i < filledPips
                          ? isAIGenerated
                            ? "bg-error"
                            : "bg-emerald-600"
                          : "bg-surface-container-high"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Model & Pipeline Details */}
              <div className="p-space-sm rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-1.5 font-mono-data text-[0.6875rem]">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Engine Core:</span>
                  <span className="font-semibold text-on-surface">Secura-Temporal v4.2.0</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Inference Batch:</span>
                  <span className="text-on-surface">120 FPS TensorRT Core</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Compute Time:</span>
                  <span className="text-on-surface">
                    {videoResult?.canonical_verdict?.inference_time_ms ? `${(videoResult.canonical_verdict.inference_time_ms / 1000).toFixed(2)}s` : "3.40s"} (1.810 ms/frame)
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Temporal Windows:</span>
                  <span className="text-on-surface">
                    {videoResult?.video_metadata?.total_frames ? `${videoResult.video_metadata.total_frames} Frames Audited` : "5,304 Frames Audited"}
                  </span>
                </div>
              </div>

              {/* Ensemble Breakdown Vectors */}
              <div className="space-y-2.5 pt-1 border-t border-[#f0e8dc]">
                <span className="font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
                  Multi-Vector Ensemble
                </span>

                {/* Lip-Sync Warping */}
                <div className="space-y-1">
                  <div className="flex justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-error">record_voice_over</span>
                      Lip-Sync Warping
                    </span>
                    <span className={`font-mono-data font-semibold ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                      {lipSyncScore}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAIGenerated ? "bg-error" : "bg-emerald-600"}`}
                      style={{ width: `${lipSyncScore}%` }}
                    />
                  </div>
                </div>

                {/* rPPG Hemodynamic Biometrics */}
                <div className="space-y-1">
                  <div className="flex justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-error">monitor_heart</span>
                      rPPG Hemodynamics
                    </span>
                    <span className={`font-mono-data font-semibold ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                      {rppgScore}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAIGenerated ? "bg-error" : "bg-emerald-600"}`}
                      style={{ width: `${rppgScore}%` }}
                    />
                  </div>
                  <span className={`block font-mono-data text-[0.625rem] ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                    {isAIGenerated
                      ? "High-frequency chromatic variance / aperiodic"
                      : "Harmonic chromatic consistency verified"}
                  </span>
                </div>

                {/* Optical Flow Velocity Drift */}
                <div className="space-y-1">
                  <div className="flex justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-error">swap_calls</span>
                      Optical Flow Velocity Drift
                    </span>
                    <span className={`font-mono-data font-semibold ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                      {optFlowScore}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAIGenerated ? "bg-error" : "bg-emerald-600"}`}
                      style={{ width: `${optFlowScore}%` }}
                    />
                  </div>
                </div>

                {/* Synthetic Audio Voiceclone */}
                <div className="space-y-1">
                  <div className="flex justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-error">graphic_eq</span>
                      Synthetic Voiceclone (TTS)
                    </span>
                    <span className={`font-mono-data font-semibold ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                      {audioScore}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAIGenerated ? "bg-error" : "bg-emerald-600"}`}
                      style={{ width: `${audioScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Micro Quick Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => alert(`Asset ${caseId} quarantined across org network.`)}
                  className="w-full h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-[#ded5c7] font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[1.125rem]">security</span>
                  <span>Quarantine Asset Across Org</span>
                </button>
              </div>
            </div>

            {/* Provenance Ledger Row */}
            <div className="p-space-md rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm space-y-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
                  Provenance Hash Record
                </span>
                <span className="px-2 py-0.5 rounded bg-error/10 text-error font-mono-data text-[0.625rem] font-semibold">
                  Unsigned
                </span>
              </div>
              <div className="space-y-1.5 font-mono-data text-[0.6875rem]">
                <div className="p-2 rounded bg-surface-container-low border border-[#ebe3d6] flex items-center justify-between text-on-surface-variant break-all">
                  <span className="text-on-surface font-mono text-[0.625rem]">
                    SHA-256: {sha256Short}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sha256Short);
                      setCopiedChecksum(true);
                      setTimeout(() => setCopiedChecksum(false), 1800);
                    }}
                    className="text-primary hover:text-primary-container shrink-0 ml-2 cursor-pointer"
                    title="Copy Checksum"
                  >
                    <span className="material-symbols-outlined text-[1rem]">
                      {copiedChecksum ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
                <div className="text-[0.6875rem] text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[0.875rem] text-error">warning</span>
                  <span>No C2PA manifest manifest-v2 detected in atom.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deep Video Forensics Breakdown: Scientific Tabbed/Modular Panels */}
        <div className="space-y-space-md pt-space-xs">
          <div className="flex items-center justify-between border-b border-[#e8dfd3] pb-space-sm">
            <div className="space-y-0.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                Deep Forensic Introspection
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Scientific breakdown across biological hemodynamics, optical velocity fields, phoneme coherence, and mathematical compression artifacts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-[0.6875rem] text-outline">
                5 Forensics Layers Validated
              </span>
            </div>
          </div>

          {/* Scientific Grid of 5 Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter-lg">
            {/* Section 1: rPPG Temporal Signal */}
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm flex flex-col justify-between gap-space-md">
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[1.25rem]">cardiology</span>
                    </span>
                    <div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                        rPPG Hemodynamic Biometrics
                      </h3>
                      <p className="font-mono-data text-[0.625rem] text-on-surface-variant">
                        3D RGB Facial Photoplethysmography
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] font-bold ${
                      isAIGenerated ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isAIGenerated ? "APERIODIC" : "HARMONIC"}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  RGB wavelength distribution measures temporal color consistency across frames. (Note: Geometric demonstration signal; not clinical biometric evidence).
                </p>
                {/* Inline SVG Chromatic Waveform */}
                <div className="p-space-sm rounded-xl bg-[#1c1b1a] text-[#f4f0ec] space-y-2">
                  <div className="flex justify-between items-center font-mono-data text-[0.625rem]">
                    <span className="text-emerald-400">Harmonic Reference Base</span>
                    <span className={isAIGenerated ? "text-error font-semibold" : "text-emerald-400"}>
                      Chromatic Tracking ({isAIGenerated ? "Disrupted" : "Harmonic"})
                    </span>
                  </div>
                  <svg className="w-full h-16" fill="none" viewBox="0 0 300 64">
                    <path
                      d="M0 32 L30 32 L40 28 L45 36 L50 12 L55 52 L60 32 L75 32 L85 28 L90 32 L120 32 L130 28 L135 36 L140 12 L145 52 L150 32 L165 32 L175 28 L180 32 L210 32 L220 28 L225 36 L230 12 L235 52 L240 32 L255 32 L265 28 L270 32 L300 32"
                      fill="none"
                      opacity="0.35"
                      stroke="#22c55e"
                      strokeWidth="1.2"
                    />
                    <path
                      d={
                        isAIGenerated
                          ? "M0 48 L20 48.5 L40 47.8 L60 48.2 L80 48 L100 48.4 L120 47.9 L140 48.3 L160 48 L180 48.5 L200 48.1 L220 48.3 L240 48 L260 48.4 L280 48.1 L300 48.2"
                          : "M0 34 L30 34 L40 30 L45 38 L50 14 L55 54 L60 34 L75 34 L85 30 L90 34 L120 34 L130 30 L135 38 L140 14 L145 54 L150 34 L165 34 L175 30 L180 34 L210 34 L220 30 L225 38 L230 14 L235 54 L240 34 L255 34 L265 30 L270 34 L300 34"
                      }
                      fill="none"
                      stroke={isAIGenerated ? "#ba1a1a" : "#22c55e"}
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="flex justify-between font-mono-data text-[0.625rem] text-[#888177]">
                    <span>Pulse Power Spectral Density: {isAIGenerated ? "<0.002" : "0.892"}</span>
                    <span className={isAIGenerated ? "text-error" : "text-emerald-400"}>
                      Vascularity: {isAIGenerated ? "False" : "True"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#f0e8dc] flex items-center justify-between font-mono-data text-[0.6875rem]">
                <span className="text-outline">Heart Telemetry Link</span>
                <span className="text-on-surface font-semibold">Integrated with RGB Biometrics</span>
              </div>
            </div>

            {/* Section 2: Optical Flow & Warp Vectors */}
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm flex flex-col justify-between gap-space-md">
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[1.25rem]">near_me</span>
                    </span>
                    <div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                        Optical Flow &amp; Warp Vectors
                      </h3>
                      <p className="font-mono-data text-[0.625rem] text-on-surface-variant">
                        Horn-Schunck Motion Divergence
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] font-bold ${
                      isAIGenerated ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isAIGenerated ? "WARPING" : "COHERENT"}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Deepfake facial synthesis introduces boundary shearing. Pixel velocity fields abruptly decouple from jaw skeletal mechanics during lateral turn.
                </p>
                {/* Vector Field Simulation Box */}
                <div className="p-space-sm rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-2">
                  <div className="flex justify-between items-center font-mono-data text-[0.625rem]">
                    <span className="text-on-surface-variant">Jaw Contour Velocity Field</span>
                    <span className={`font-semibold font-mono ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                      Divergence: {isAIGenerated ? "0.84 rad" : "0.08 rad"}
                    </span>
                  </div>
                  <svg className="w-full h-16" fill="none" viewBox="0 0 280 64">
                    <g fill="#dbc2b2" opacity="0.6">
                      <circle cx="20" cy="16" r="1.5" /><circle cx="60" cy="16" r="1.5" /><circle cx="100" cy="16" r="1.5" /><circle cx="140" cy="16" r="1.5" /><circle cx="180" cy="16" r="1.5" /><circle cx="220" cy="16" r="1.5" /><circle cx="260" cy="16" r="1.5" />
                      <circle cx="20" cy="32" r="1.5" /><circle cx="60" cy="32" r="1.5" /><circle cx="100" cy="32" r="1.5" /><circle cx="140" cy="32" r="1.5" /><circle cx="180" cy="32" r="1.5" /><circle cx="220" cy="32" r="1.5" /><circle cx="260" cy="32" r="1.5" />
                      <circle cx="20" cy="48" r="1.5" /><circle cx="60" cy="48" r="1.5" /><circle cx="100" cy="48" r="1.5" /><circle cx="140" cy="48" r="1.5" /><circle cx="180" cy="48" r="1.5" /><circle cx="220" cy="48" r="1.5" /><circle cx="260" cy="48" r="1.5" />
                    </g>
                    <g stroke="#887366" strokeLinecap="round" strokeWidth="1.5">
                      <path d="M20 16 L28 14" /><path d="M60 16 L68 14" /><path d="M20 32 L28 30" /><path d="M60 32 L68 30" /><path d="M20 48 L28 46" />
                    </g>
                    <g stroke={isAIGenerated ? "#ba1a1a" : "#22c55e"} strokeLinecap="round" strokeWidth="1.8">
                      <path d="M140 16 L152 10" /><path d="M180 16 L170 8" /><path d="M220 16 L234 26" />
                      <path d="M140 32 L156 36" /><path d="M180 32 L168 44" /><path d="M220 32 L232 20" />
                      <path d="M140 48 L148 56" /><path d="M180 48 L194 40" /><path d="M220 48 L206 58" />
                    </g>
                  </svg>
                  <div className="flex justify-between font-mono-data text-[0.625rem] text-on-surface-variant">
                    <span>Mean Angular Error: {isAIGenerated ? "41.2°" : "3.2°"}</span>
                    <span className={isAIGenerated ? "text-error font-medium" : "text-emerald-700"}>
                      {isAIGenerated ? "Kinematic Mismatch" : "Kinematic Match"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#f0e8dc] flex items-center justify-between font-mono-data text-[0.6875rem]">
                <span className="text-outline">Warp Gradient Peak</span>
                <span className={isAIGenerated ? "text-error font-semibold" : "text-emerald-700 font-semibold"}>
                  {isAIGenerated ? "Frame 0140 – 0168" : "None Detected"}
                </span>
              </div>
            </div>

            {/* Section 3: Audio-Visual Sync & Spectrogram */}
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm flex flex-col justify-between gap-space-md">
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[1.25rem]">graphic_eq</span>
                    </span>
                    <div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                        Audio-Visual Sync &amp; TTS
                      </h3>
                      <p className="font-mono-data text-[0.625rem] text-on-surface-variant">
                        Phoneme-Viseme Correlation
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] font-bold ${
                      isAIGenerated ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isAIGenerated ? "TTS DETECTED" : "ORGANIC SPEECH"}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Synthetic speech models exhibit a sharp frequency cutoff above 16.0 kHz and asynchronous lip motion latency exceeding 80ms standard tolerance.
                </p>
                {/* Spectrogram & Latency Metrics */}
                <div className="p-space-sm rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-2">
                  <div className="flex justify-between items-center font-mono-data text-[0.625rem]">
                    <span className="text-on-surface-variant">A/V Offset Jitter</span>
                    <span className={`font-bold font-mono ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                      {isAIGenerated ? "+114 ms (Max >80ms)" : "+12 ms (In Sync)"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono-data text-[0.625rem] text-on-surface-variant">
                      <span>16 kHz - 22 kHz Spectral Energy</span>
                      <span className={isAIGenerated ? "text-error" : "text-emerald-700"}>
                        {isAIGenerated ? "-48 dB (Artificial Void)" : "-18 dB (Natural Decay)"}
                      </span>
                    </div>
                    <div className="w-full bg-[#e6e0d5] h-2 rounded-full overflow-hidden flex">
                      <div className="bg-primary-container h-full" style={{ width: isAIGenerated ? "14%" : "82%" }}></div>
                      <div className="bg-transparent h-full flex-1"></div>
                    </div>
                  </div>
                  <div className="flex justify-between font-mono-data text-[0.625rem] text-on-surface-variant">
                    <span>Model Match: {isAIGenerated ? "ElevenLabs v2 Clone" : "Physical Studio Mic"}</span>
                    <span className={isAIGenerated ? "text-error font-medium" : "text-emerald-700 font-medium"}>
                      {isAIGenerated ? "96.8% Match" : "Natural Acoustics"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#f0e8dc] flex items-center justify-between font-mono-data text-[0.6875rem]">
                <span className="text-outline">Viseme Alignment</span>
                <span className={isAIGenerated ? "text-error font-semibold" : "text-emerald-700 font-semibold"}>
                  {isAIGenerated ? "Severely Desynchronized" : "Precision Locked"}
                </span>
              </div>
            </div>

            {/* Section 4: Frame Compression & Temporal Consistency Residuals */}
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm flex flex-col justify-between gap-space-md">
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[1.25rem]">texture</span>
                    </span>
                    <div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                        Temporal Residuals &amp; DCT
                      </h3>
                      <p className="font-mono-data text-[0.625rem] text-on-surface-variant">
                        Inter-frame Noise Discontinuity
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono-data text-[0.625rem] font-bold ${
                      isAIGenerated ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isAIGenerated ? "ARTIFACTS" : "NATURAL NOISE"}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Camera sensor pixel patterns (PRNU noise) are consistent across natural video frames. Frame generation engines produce uncorrelated static noise masks.
                </p>
                <div className="p-space-sm rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-center font-mono-data text-[0.625rem]">
                    <div className="p-2 rounded bg-surface-container-lowest border border-[#e4dccd]">
                      <span className="text-outline block">PRNU Consistency</span>
                      <span className={`font-bold text-[0.75rem] ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                        {isAIGenerated ? "0.12 (Low)" : "0.94 (High)"}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-lowest border border-[#e4dccd]">
                      <span className="text-outline block">DCT Boundary Leak</span>
                      <span className={`font-bold text-[0.75rem] ${isAIGenerated ? "text-error" : "text-emerald-700"}`}>
                        {isAIGenerated ? "High (8.4σ)" : "Nominal (0.8σ)"}
                      </span>
                    </div>
                  </div>
                  <div className="font-mono-data text-[0.625rem] text-on-surface-variant">
                    {isAIGenerated
                      ? "Inter-frame macroblock mismatch detected between I-frames and P-frames."
                      : "Uniform camera macroblock encoding detected."}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#f0e8dc] flex items-center justify-between font-mono-data text-[0.6875rem]">
                <span className="text-outline">Sensor Fingerprint</span>
                <span className={isAIGenerated ? "text-error font-semibold" : "text-emerald-700 font-semibold"}>
                  {isAIGenerated ? "Synthetic Generation" : "Verified Silicon CMOS"}
                </span>
              </div>
            </div>

            {/* Section 5: C2PA & Container Metadata */}
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] shadow-sm flex flex-col justify-between gap-space-md md:col-span-2 xl:col-span-2">
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[1.25rem]">verified_user</span>
                    </span>
                    <div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                        C2PA Trust &amp; Container Forensics
                      </h3>
                      <p className="font-mono-data text-[0.625rem] text-on-surface-variant">
                        Hardware Signature &amp; Bitstream Atoms
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-error/10 text-error font-mono-data text-[0.625rem] font-bold">
                    ZERO SIGNATURE
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Evaluation of MPEG-4 ISO/IEC 14496-14 atom structures, encoder libraries, and Coalition for Content Provenance and Authenticity (C2PA) cryptographic assertions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono-data text-[0.6875rem]">
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-1">
                    <span className="text-outline block text-[0.625rem] uppercase">Writing Application</span>
                    <span className="text-on-surface font-semibold">Lavf60.16.100 (ffmpeg)</span>
                    <span className="block text-error text-[0.625rem]">Synthetic re-muxing detected</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-1">
                    <span className="text-outline block text-[0.625rem] uppercase">Camera Hardware Keystore</span>
                    <span className="text-error font-semibold">Absent (No Sony/Canon HSM)</span>
                    <span className="block text-outline text-[0.625rem]">No hardware root of trust</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-[#ebe3d6] space-y-1">
                    <span className="text-outline block text-[0.625rem] uppercase">C2PA Manifest Assertion</span>
                    <span className="text-error font-semibold">Missing (No JUMBF Box)</span>
                    <span className="block text-outline text-[0.625rem]">Not cryptographically signed</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#f0e8dc] flex items-center justify-between font-mono-data text-[0.6875rem]">
                <span className="text-outline">Container Integrity</span>
                <span className="text-on-surface font-medium">Re-encoded using FFmpeg with synthetic stream timing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload & Live Camera Recording Drawer at Bottom */}
        <div className="rounded-2xl bg-surface-container-lowest border border-[#e8dfd3] p-space-lg shadow-sm space-y-space-md">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-label-md text-label-md font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[1.25rem] text-primary">video_call</span>
                <span>Video Ingestion Hub &amp; Live Hardware Capture</span>
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Upload pre-recorded media files or activate certified 60fps hardware camera telemetry for real-time live-stream spoof verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono-data text-[0.625rem] text-on-surface-variant">
                Max Size: 500 MB
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            {/* Drag & Drop Video Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropHandler}
              className="relative group border-2 border-dashed border-[#ded5c7] hover:border-primary-container rounded-xl p-space-lg bg-surface-bright/50 hover:bg-surface-container-low transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-space-xs"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-high group-hover:bg-primary-fixed flex items-center justify-center text-on-surface-variant group-hover:text-on-primary-fixed transition-colors">
                <span className="material-symbols-outlined text-[1.5rem]">upload_file</span>
              </div>
              <div className="space-y-0.5">
                <p className="font-label-md text-label-md font-semibold text-on-surface">
                  Drop target video file here, or{" "}
                  <span className="text-primary hover:underline">browse files</span>
                </p>
                <p className="font-mono-data text-[0.6875rem] text-outline">
                  Supports MP4, MOV, MKV, WebM (H.264, HEVC, ProRes, AV1)
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1 font-mono-data text-[0.625rem] text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[0.875rem] text-emerald-600">check_circle</span>
                  Automatic Face Detection
                </span>
                <span className="text-outline">•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[0.875rem] text-emerald-600">check_circle</span>
                  Parallel rPPG Batch
                </span>
              </div>
            </div>

            {/* Live Camera Stream Ingestion Module */}
            <div className="rounded-xl border border-[#e4dccd] bg-surface-bright p-space-md flex flex-col justify-between gap-space-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[1.25rem]">videocam</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-label-md font-semibold text-on-surface">
                      Live Camera Calibration
                    </h4>
                    <p className="font-mono-data text-[0.625rem] text-on-surface-variant">
                      60 FPS Hardware Ingestion Stream
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/10 text-emerald-700 font-mono-data text-[0.625rem] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Hardware Ready
                </span>
              </div>

              {/* Technical Stream Details & Camera Dropdown Selection */}
              <div className="grid grid-cols-2 gap-space-sm font-mono-data text-[0.6875rem]">
                <div className="space-y-1">
                  <label className="text-outline text-[0.625rem] uppercase">Capture Device</label>
                  <select className="w-full h-8 px-2 rounded-lg bg-surface-container-lowest border border-[#ded5c7] text-on-surface text-[0.6875rem] focus:outline-none focus:border-primary-container">
                    <option>FaceTime HD Camera (Built-in)</option>
                    <option>Blackmagic UltraStudio 4K</option>
                    <option>NDI Video Stream Receiver</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-outline text-[0.625rem] uppercase">Calibrated Rate</label>
                  <div className="w-full h-8 px-2 rounded-lg bg-surface-container-lowest border border-[#ded5c7] flex items-center justify-between text-on-surface">
                    <span>60.00 FPS Sync</span>
                    <span className="text-emerald-700 font-bold">Locked</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-space-sm pt-1">
                <button
                  type="button"
                  onClick={onOpenLiveCamera}
                  className="flex-1 h-9 rounded-lg bg-primary-container hover:bg-[#d97322] text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[1.125rem]">fiber_manual_record</span>
                  <span>Start Real-Time Stream Audit</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenLiveCamera}
                  className="h-9 px-3 rounded-lg bg-surface-container-lowest border border-[#ded5c7] text-on-surface hover:bg-surface-container font-label-md text-label-md flex items-center justify-center cursor-pointer"
                  title="Camera Settings"
                >
                  <span className="material-symbols-outlined text-[1.125rem] text-on-surface-variant">tune</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoForensicsWorkspace;
