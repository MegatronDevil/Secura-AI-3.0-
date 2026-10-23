import { useState, useEffect, useRef } from "react";
import {
  Milestone1Response,
  VideoForensicResult,
  RGBFrameSample,
  BatchAnalysisResponse,
  SealedImageResponse,
  ExplainabilityHeatmapResponse,
} from "./types/api";
import {
  analyzeImageFile,
  analyzeVideoFile,
  sealImage,
  batchAnalyzeImages,
  fetchExplainabilityHeatmap,
  downloadVideoClip,
  ApiServiceError,
} from "./services/api";
import { API_BASE_URL } from "./services/env";
import { RGBHeartVisualization } from "./components/RGBHeartVisualization";
import { WebcamDeepfakeShield } from "./components/WebcamDeepfakeShield";
import {
  exportForensicReportPrint,
  exportForensicReportDoc,
} from "./services/forensicReportExporter";

export function App() {
  // Navigation Tabs: Landing Page, Image Workbench, Video Workbench, Batch Audit, Live Shield
  const [activeTab, setActiveTab] = useState<"landing" | "image" | "video" | "batch" | "live-shield">("landing");

  // C2PA Sealing & Tamper Assertion State
  const [isSealing, setIsSealing] = useState(false);
  const [sealedImage, setSealedImage] = useState<SealedImageResponse | null>(null);

  // Batch Ingestion & Forensic Ledger State
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchAnalysisResponse | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);

  // Backend Health Telemetry
  const [healthStatus, setHealthStatus] = useState<{
    online: boolean;
    version: string;
    latencyMs: number | null;
  }>({ online: false, version: "1.0.0", latencyMs: null });

  // ---------------------------------------------------------------------------
  // IMAGE DETECTION STATE
  // ---------------------------------------------------------------------------
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isImageAnalyzing, setIsImageAnalyzing] = useState(false);
  const [imageResult, setImageResult] = useState<Milestone1Response | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageInspectionMode, setImageInspectionMode] = useState<"original" | "ela" | "xray">("original");
  const [explainabilityResult, setExplainabilityResult] = useState<ExplainabilityHeatmapResponse | null>(null);
  const [isLoadingExplainability, setIsLoadingExplainability] = useState(false);
  const [explainabilityAlpha, setExplainabilityAlpha] = useState<number>(0.6);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // VIDEO DETECTION STATE
  // ---------------------------------------------------------------------------
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoAnalyzing, setIsVideoAnalyzing] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoForensicResult | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedVideoFrameIndex, setSelectedVideoFrameIndex] = useState<number>(0);
  const [clipStartSec, setClipStartSec] = useState<number>(0);
  const [clipEndSec, setClipEndSec] = useState<number>(5);
  const [isExtractingClip, setIsExtractingClip] = useState<boolean>(false);
  const [clipSuccessMsg, setClipSuccessMsg] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // C2PA CRYPTOGRAPHIC WATERMARK & ASSERTION SEALER
  // ---------------------------------------------------------------------------
  const handleSealImage = async () => {
    if (!imageFile || !imageResult) return;
    setIsSealing(true);
    try {
      const verdict = imageResult.canonical_verdict?.predicted_label || "AI_GENERATED";
      const confidence = imageResult.canonical_verdict?.model_score ?? 0.95;
      const res = await sealImage(imageFile, verdict, confidence, imageResult.request_id);
      setSealedImage(res);
      // Auto-trigger download of sealed cryptographic asset
      const a = document.createElement("a");
      a.href = res.sealed_image_data_url;
      a.download = `C2PA_SEALED_${imageFile.name}`;
      a.click();
    } catch (e: any) {
      alert("Failed to seal image: " + (e.message || "Unknown error"));
    } finally {
      setIsSealing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // BATCH MULTI-FILE INGESTION & CSV LEDGER HANDLERS
  // ---------------------------------------------------------------------------
  const handleSelectBatchFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).slice(0, 30);
    if (fileArr.length === 0) return;
    setBatchFiles(fileArr);
    setBatchResult(null);
    setBatchError(null);
    setIsBatchAnalyzing(true);
    try {
      const res = await batchAnalyzeImages(fileArr, "Ensemble");
      setBatchResult(res);
    } catch (err: any) {
      setBatchError(err instanceof ApiServiceError ? err.message : err.message || "Failed to process batch files.");
    } finally {
      setIsBatchAnalyzing(false);
    }
  };

  const handleExportBatchCSV = () => {
    if (!batchResult || !batchResult.items.length) return;
    const headers = [
      "Filename",
      "Media_Type",
      "File_Size_Bytes",
      "SHA256",
      "Perceptual_Hash_pHash",
      "Provenance_Signal",
      "Forensic_Recheck",
      "Predicted_Label",
      "Confidence_Score",
      "Model_Score",
      "Processing_Status"
    ];
    const rows = batchResult.items.map(item => [
      `"${item.filename.replace(/"/g, '""')}"`,
      `"${item.media_type}"`,
      item.file_size_bytes,
      `"${item.sha256}"`,
      `"${item.phash}"`,
      `"${item.provenance_signal || 'Deep Vision Probe'}"`,
      `"${item.rechecked ? 'VERIFIED' : 'PENDING'}"`,
      `"${item.predicted_label}"`,
      item.confidence_score,
      item.model_score,
      `"${item.status}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SecuraAI_Batch_Audit_${batchResult.batch_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------------------------------------------------------------------------
  // LIVE CAMERA CAPTURE (PHOTO & VIDEO)
  // ---------------------------------------------------------------------------
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordTimerSec, setRecordTimerSec] = useState(0);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const lastCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // LANDING PAGE INTERACTIVE SIMULATOR (SHOWCASING 3D HOLOGRAPHIC HEART)
  // ---------------------------------------------------------------------------
  const [landingSimMode, setLandingSimMode] = useState<"genuine" | "ai">("genuine");

  // ---------------------------------------------------------------------------
  // BACKEND HEALTH CHECK
  // ---------------------------------------------------------------------------
  const checkBackendHealth = async () => {
    try {
      const start = performance.now();
      const res = await fetch(`${API_BASE_URL}/api/v1/health`);
      if (res.ok) {
        const data = await res.json();
        const latency = Math.round(performance.now() - start);
        setHealthStatus({
          online: true,
          version: data.version || "1.0.0",
          latencyMs: latency,
        });
      } else {
        setHealthStatus({ online: false, version: "", latencyMs: null });
      }
    } catch {
      setHealthStatus({ online: false, version: "", latencyMs: null });
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      stopCamera();
    };
  }, [imagePreviewUrl, videoUrl]);

  // ---------------------------------------------------------------------------
  // IMAGE HANDLERS
  // ---------------------------------------------------------------------------
  const handleSelectImage = async (file: File) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const preview = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreviewUrl(preview);
    setImageResult(null);
    setImageError(null);
    setImageInspectionMode("original");
    setExplainabilityResult(null);
    setActiveTab("image");

    setIsImageAnalyzing(true);
    try {
      const result = await analyzeImageFile(file, "Ensemble");
      setImageResult(result);
    } catch (err: any) {
      setImageError(err instanceof ApiServiceError ? err.message : err.message || "Failed to analyze image.");
    } finally {
      setIsImageAnalyzing(false);
    }
  };

  const handleResetImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageResult(null);
    setImageError(null);
    setImageInspectionMode("original");
    setExplainabilityResult(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleLoadExplainability = async (alphaVal: number = explainabilityAlpha) => {
    if (!imageFile) return;
    setIsLoadingExplainability(true);
    try {
      const res = await fetchExplainabilityHeatmap(imageFile, alphaVal);
      setExplainabilityResult(res);
    } catch (e: any) {
      console.warn("Failed to load explainability heatmap:", e);
    } finally {
      setIsLoadingExplainability(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VIDEO HANDLERS
  // ---------------------------------------------------------------------------
  const handleSelectVideo = async (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setVideoResult(null);
    setVideoError(null);
    setSelectedVideoFrameIndex(0);
    setClipStartSec(0);
    setClipEndSec(5);
    setClipSuccessMsg(null);
    setActiveTab("video");

    setIsVideoAnalyzing(true);
    try {
      const result = await analyzeVideoFile(file);
      setVideoResult(result);
      if (result.video_metadata?.duration_sec) {
        setClipEndSec(Math.min(result.video_metadata.duration_sec, 5));
      }
    } catch (err: any) {
      setVideoError(err instanceof ApiServiceError ? err.message : err.message || "Failed to analyze video.");
    } finally {
      setIsVideoAnalyzing(false);
    }
  };

  const handleResetVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoResult(null);
    setVideoError(null);
    setSelectedVideoFrameIndex(0);
    setClipSuccessMsg(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleExtractClip = async () => {
    if (!videoFile) return;
    setIsExtractingClip(true);
    setClipSuccessMsg(null);
    try {
      const blob = await downloadVideoClip(videoFile, clipStartSec, clipEndSec);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secura_evidence_${clipStartSec.toFixed(1)}s-${clipEndSec.toFixed(1)}s.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setClipSuccessMsg(`Extracted & downloaded lossless clip (${clipStartSec}s - ${clipEndSec}s)`);
      setTimeout(() => setClipSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to extract clip: " + (err.message || "Unknown error"));
    } finally {
      setIsExtractingClip(false);
    }
  };

  // ---------------------------------------------------------------------------
  // CAMERA CAPTURE CONTROLS
  // ---------------------------------------------------------------------------
  const startCamera = async (mode: "photo" | "video") => {
    setCameraMode(mode);
    setIsCameraActive(true);
    setIsRecordingVideo(false);
    setRecordTimerSec(0);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: mode === "video",
      });
      cameraStreamRef.current = stream;
      if (stream.getVideoTracks().length > 0) {
        lastCameraTrackRef.current = stream.getVideoTracks()[0];
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play();
      }
    } catch (err: any) {
      alert("Camera access denied or device unavailable: " + (err.message || ""));
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsRecordingVideo(false);
  };

  const capturePhoto = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `live_photo_${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCamera();
        handleSelectImage(file);
      }
    }, "image/jpeg", 0.95);
  };

  const startVideoRecording = () => {
    if (!cameraStreamRef.current) return;
    recordedChunksRef.current = [];
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const file = new File([blob], `live_video_${Date.now()}.webm`, { type: "video/webm" });
        stopCamera();
        handleSelectVideo(file);
      };

      recorder.start(500);
      setIsRecordingVideo(true);
      setRecordTimerSec(0);
      recordIntervalRef.current = window.setInterval(() => {
        setRecordTimerSec((prev) => {
          if (prev >= 60) {
            stopVideoRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e: any) {
      alert("Failed to initialize video recorder: " + (e.message || ""));
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    setIsRecordingVideo(false);
  };

  // Derive active video frame sample for 3D Heart
  const activeVideoSample: RGBFrameSample | null =
    videoResult?.sampled_frames && videoResult.sampled_frames.length > 0
      ? videoResult.sampled_frames[Math.min(selectedVideoFrameIndex, videoResult.sampled_frames.length - 1)]
      : null;

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-[#2A2521] font-sans antialiased flex flex-col selection:bg-[#E9C46A]/40 selection:text-[#2A2521]">
      {/* ===================================================================== */}
      {/* BESPOKE TOP NAVIGATION BAR                                            */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#FAF7EE]/95 backdrop-blur border-b border-[#E8DFCF] px-6 lg:px-12 py-3.5 flex items-center justify-between">
        {/* Bespoke Vector Emblem Brand */}
        <div
          onClick={() => setActiveTab("landing")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* Custom SVG Precision Emblem (Cryptographic Aperture & Verification Prism) */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFFDF9] to-[#F5ECE0] border border-[#E5DAC6] p-2 shadow-xs flex items-center justify-center group-hover:border-[#D9651E] transition-colors">
            <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
              <circle cx="20" cy="20" r="16" stroke="#D9651E" strokeWidth="2" strokeDasharray="4 2" />
              <path
                d="M20 7L24 16L33 20L24 24L20 33L16 24L7 20L16 16L20 7Z"
                fill="url(#brandGrad)"
                stroke="#C6A64B"
                strokeWidth="1.2"
              />
              <circle cx="20" cy="20" r="3.5" fill="#D9651E" />
              <defs>
                <linearGradient id="brandGrad" x1="7" y1="7" x2="33" y2="33" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#EA7B32" />
                  <stop offset="0.6" stopColor="#E9C46A" />
                  <stop offset="1" stopColor="#C94A29" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-[#2A2521]">
                Secura<span className="text-[#D9651E]">.AI</span>
              </span>
              <span className="text-[10px] font-mono font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#F5ECDA] text-[#8A6714] border border-[#E8D9B5]">
                LABORATORY
              </span>
            </div>
            <p className="text-[11px] text-[#70675D]">Media Forensics &amp; Generative Inversion</p>
          </div>
        </div>

        {/* Tab Navigation Switcher */}
        <nav className="flex items-center bg-[#F2EBDB] p-1 rounded-xl border border-[#E2D6C0]">
          <button
            type="button"
            onClick={() => setActiveTab("landing")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "landing"
                ? "bg-white text-[#D9651E] shadow-xs"
                : "text-[#6A6156] hover:text-[#2A2521]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("image")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "image"
                ? "bg-white text-[#D9651E] shadow-xs"
                : "text-[#6A6156] hover:text-[#2A2521]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">image</span>
            <span>Image Lab</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "video"
                ? "bg-white text-[#D9651E] shadow-xs"
                : "text-[#6A6156] hover:text-[#2A2521]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">videocam</span>
            <span>Video Lab</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "batch"
                ? "bg-white text-[#D9651E] shadow-xs"
                : "text-[#6A6156] hover:text-[#2A2521]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">dynamic_feed</span>
            <span>Batch Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("live-shield")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "live-shield"
                ? "bg-white text-[#D9651E] shadow-xs"
                : "text-[#6A6156] hover:text-[#2A2521]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">shield_person</span>
            <span>Live Shield</span>
          </button>
        </nav>

        {/* Live Cluster Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-[#E8DFCF] shadow-xs text-xs">
          <span className="relative flex h-2 w-2">
            {healthStatus.online ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            )}
          </span>
          <span className="font-medium text-[#4D453C]">
            {healthStatus.online
              ? `Local Engine Active (${healthStatus.latencyMs ?? 15}ms)`
              : "Connecting to API..."}
          </span>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN VIEW CONTAINER                                                   */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* =================================================================== */}
        {/* VIEW 0: PRESTIGIOUS EDITORIAL LANDING PAGE                          */}
        {/* =================================================================== */}
        {activeTab === "landing" && (
          <div className="space-y-16 animate-fade-in pb-12">
            {/* Hero Section */}
            <div className="text-center space-y-6 pt-4 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4EBD9] border border-[#E8D9B5] text-[#8A6714] text-xs font-semibold">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>ISO/IEC 27037 Digital Evidence Standard &bull; Multi-Branch Neural Inference</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#2A2521] tracking-tight leading-[1.12]">
                The Forensic Standard for <span className="text-[#D9651E]">Media Authenticity</span>.
              </h1>

              <p className="text-base sm:text-lg text-[#6C6357] leading-relaxed">
                Secura AI combines Latent Diffusion Inversion, Photoplethysmography Biometrics, and Sensor Pattern Noise into a unified verification engine to detect synthetic images and manipulated video.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("image")}
                  className="px-6 py-3 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 hover:shadow-lg"
                >
                  <span className="material-symbols-outlined text-[18px]">image</span>
                  <span>Image Lab</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("video")}
                  className="px-6 py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#24543E] text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 hover:shadow-lg"
                >
                  <span className="material-symbols-outlined text-[18px]">videocam</span>
                  <span>Video Lab</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCamera("photo")}
                  className="px-5 py-3 rounded-xl bg-white hover:bg-[#F7F2E6] border border-[#DDD1BE] text-[#2A2521] font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#D9651E]">center_focus_strong</span>
                  <span>Live Camera Capture</span>
                </button>
              </div>
            </div>

            {/* Live Interactive 3D Holographic Cardioid Showcase */}
            <div className="rounded-3xl bg-white border border-[#E8DFCF] p-8 lg:p-12 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFE8DA] pb-6">
                <div>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-[#D9651E]">
                    Interactive Holographic Demonstrator
                  </span>
                  <h2 className="text-2xl font-bold text-[#2A2521] tracking-tight mt-1">
                    3D Holographic Cardioid Biometric Engine
                  </h2>
                  <p className="text-sm text-[#70675D] max-w-xl mt-1">
                    Witness how the 3D cardiac manifold behaves under real optical conditions versus AI-generated synthetic disruption.
                  </p>
                </div>

                {/* Simulation Mode Toggle */}
                <div className="flex items-center bg-[#F2EBDB] p-1 rounded-xl border border-[#E2D6C0] self-start md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setLandingSimMode("genuine")}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      landingSimMode === "genuine"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-[#6C6357] hover:text-[#2A2521]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Genuine Camera Media</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLandingSimMode("ai")}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      landingSimMode === "ai"
                        ? "bg-white text-[#D9651E] shadow-xs"
                        : "text-[#6C6357] hover:text-[#2A2521]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#D9651E] animate-pulse"></span>
                    <span>AI-Generated Deepfake</span>
                  </button>
                </div>
              </div>

              {/* Showcase Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* 3D Heart Canvas Column */}
                <div className="lg:col-span-6 flex justify-center">
                  <RGBHeartVisualization
                    isAiGenerated={landingSimMode === "ai"}
                    confidenceScore={landingSimMode === "ai" ? 0.942 : 0.985}
                    width={380}
                    height={330}
                    title={
                      landingSimMode === "ai"
                        ? "Synthetic Disruption (Turbulent Rotation)"
                        : "Authentic Hemodynamics (Steady Rotation)"
                    }
                  />
                </div>

                {/* Explanation & Technical Walkthrough */}
                <div className="lg:col-span-6 space-y-4">
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      landingSimMode === "ai"
                        ? "bg-[#FFF5ED] border-[#F2C2A2]"
                        : "bg-[#F0F8F3] border-[#BCE1CC]"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <span className="material-symbols-outlined text-lg">
                        {landingSimMode === "ai" ? "warning" : "check_circle"}
                      </span>
                      <span>
                        {landingSimMode === "ai"
                          ? "State: AI-Generated / Deepfake Profile Detected"
                          : "State: Camera Authentic / Physiological Profile"}
                      </span>
                    </div>
                    <p className="text-xs mt-1.5 leading-relaxed text-[#4A4237]">
                      {landingSimMode === "ai"
                        ? "The 3D holographic cardioid rotates rapidly and erratically with turbulent angular jitter and chromatic dispersion. Deep neural generative diffusion networks synthesize pixel textures without physical blood perfusion, destroying capillary rhythm."
                        : "The 3D holographic cardioid exhibits smooth, steady, majestic rotation synchronized to natural 72 BPM cardiac pulse wave. Remote photoplethysmography (rPPG) verifies microscopic hemoglobin absorption."}
                    </p>
                  </div>

                  <div className="space-y-2.5 text-xs text-[#5C5449]">
                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#D9651E] shrink-0">speed</span>
                      <div>
                        <strong>Rotational Dynamics:</strong> When synthetic media is introduced, the model triggers high-frequency manifold warping and accelerates angular rotation to signal anomalous spatial drift.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#8A6714] shrink-0">biometrics</span>
                      <div>
                        <strong>Sub-Dermal Perfusion:</strong> Green-channel light absorption measures authentic capillary volume fluctuations across temporal windows.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#2D6A4F] shrink-0">history_edu</span>
                      <div>
                        <strong>Exportable Audit Dossiers:</strong> Every inspection produces a cryptographically sealed, printable PDF dossier with SHA-256 validation.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Core Scientific Pillars */}
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D9651E]">
                  Scientific Architecture
                </span>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-[#2A2521] tracking-tight">
                  Multi-Pillar Verification Defense
                </h2>
                <p className="text-xs text-[#70675D]">
                  No single heuristic is sufficient. Secura AI cross-references spatial, temporal, and physical signals.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Pillar 1 */}
                <div className="rounded-2xl bg-white border border-[#E8DFCF] p-6 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FDF1E8] text-[#D9651E] flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">lens_blur</span>
                    </div>
                    <h3 className="font-bold text-base text-[#2A2521]">Latent Inversion &amp; Swin</h3>
                    <p className="text-xs text-[#6C6357] leading-relaxed">
                      Swin Transformer spatial backbone isolates micro-diffusion anomalies, high-frequency DCT blocking artifacts, and spatial token heatmaps.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("image")}
                    className="text-xs font-bold text-[#D9651E] hover:underline flex items-center gap-1 pt-2"
                  >
                    <span>Launch Image Inspection</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>

                {/* Pillar 2 */}
                <div className="rounded-2xl bg-white border border-[#E8DFCF] p-6 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-[#F0F8F3] text-[#2D6A4F] flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">timeline</span>
                    </div>
                    <h3 className="font-bold text-base text-[#2A2521]">Temporal ResTraV MLP</h3>
                    <p className="text-xs text-[#6C6357] leading-relaxed">
                      Inter-frame velocity and trajectory manifold tracking evaluates facial landmarks and timeline density anomaly segments.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("video")}
                    className="text-xs font-bold text-[#2D6A4F] hover:underline flex items-center gap-1 pt-2"
                  >
                    <span>Launch Video Inspection</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>

                {/* Pillar 3 */}
                <div className="rounded-2xl bg-white border border-[#E8DFCF] p-6 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FBF6EA] text-[#8A6714] flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">fingerprint</span>
                    </div>
                    <h3 className="font-bold text-base text-[#2A2521]">PRNU &amp; C2PA Provenance</h3>
                    <p className="text-xs text-[#6C6357] leading-relaxed">
                      Photo-Response Non-Uniformity extracts the unique silicon sensor fingerprint alongside C2PA cryptographic assertion seals.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("batch")}
                    className="text-xs font-bold text-[#8A6714] hover:underline flex items-center gap-1 pt-2"
                  >
                    <span>Launch Batch Audit</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>

                {/* Pillar 4 */}
                <div className="rounded-2xl bg-white border border-[#E8DFCF] p-6 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">shield_person</span>
                    </div>
                    <h3 className="font-bold text-base text-[#2A2521]">Live WebRTC Shield</h3>
                    <p className="text-xs text-[#6C6357] leading-relaxed">
                      Sub-dermal rPPG hemoglobin pulse tracking and facial boundary artifact sentinel for real-time video calls and live streaming.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("live-shield")}
                    className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 pt-2"
                  >
                    <span>Activate Live Shield</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Browser Extension Feature Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-[#2A2521] to-[#3D352E] text-white p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shrink-0 font-bold text-xl">
                    S
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Secura AI Chrome Extension (Manifest V3)</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">READY</span>
                    </h3>
                    <p className="text-xs text-[#C5BBAF] mt-0.5">
                      Right-click inspect any image or video directly on any website with instant in-page forensic HUD modal.
                    </p>
                  </div>
                </div>
                <div className="text-xs font-mono bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 text-white/90">
                  Folder: <code>d:\SecuraAI2\extension</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 1: IMAGE DETECTION WORKBENCH                                   */}
        {/* =================================================================== */}
        {activeTab === "image" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#2A2521] tracking-tight">
                  Image Forensic Inspection
                </h1>
                <p className="text-sm text-[#6C6357] mt-1 max-w-2xl">
                  Upload any digital image or capture via live camera to audit spatial diffusion patterns, error-level compression (ELA), and sensor noise.
                </p>
              </div>

              {/* Instant Camera Trigger */}
              <button
                type="button"
                onClick={() => startCamera("photo")}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#F9F5EC] border border-[#DDD1BE] text-xs font-bold text-[#2A2521] shadow-xs transition-colors flex items-center gap-2 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px] text-[#D9651E]">photo_camera</span>
                <span>Use Live Camera</span>
              </button>
            </div>

            {/* Upload Zone when no image selected */}
            {!imageFile && (
              <div
                onClick={() => imageInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleSelectImage(e.dataTransfer.files[0]);
                  }
                }}
                className="group cursor-pointer rounded-3xl border-2 border-dashed border-[#DFD4BF] hover:border-[#D9651E] bg-[#FFFDF9] hover:bg-[#FFF9F2] transition-all p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#F6EDE0] group-hover:bg-[#FBE9DC] text-[#D9651E] flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-3xl">upload_file</span>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-base text-[#2A2521]">
                    Click to select an image, or drag and drop here
                  </p>
                  <p className="text-xs text-[#7A7165]">
                    Supports PNG, JPG, JPEG, WebP, and TIFF formats
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-semibold text-sm transition-colors shadow-sm"
                  >
                    Browse Files
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera("photo");
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F7F2E6] border border-[#D5C9B3] text-[#2A2521] font-semibold text-sm transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm text-[#D9651E]">photo_camera</span>
                    <span>Live Snap</span>
                  </button>
                </div>
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/tiff"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectImage(e.target.files[0]);
                }
              }}
            />

            {/* Error Message */}
            {imageError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
                <span>{imageError}</span>
                <button
                  onClick={() => setImageError(null)}
                  className="text-xs font-semibold underline text-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Analyzing State */}
            {isImageAnalyzing && (
              <div className="p-10 rounded-3xl bg-white border border-[#E8DFCF] text-center space-y-4 shadow-xs">
                <div className="inline-block animate-spin text-[#D9651E]">
                  <span className="material-symbols-outlined text-5xl">progress_activity</span>
                </div>
                <h3 className="font-bold text-lg text-[#2A2521]">Executing Multi-Scale Forensic Inversion...</h3>
                <p className="text-xs text-[#70675D] max-w-md mx-auto">
                  Extracting Swin Transformer spatial representations, Error Level Analysis (ELA) re-quantization variance, and PRNU sensor noise.
                </p>
              </div>
            )}

            {/* Analysis Result Card */}
            {imageFile && !isImageAnalyzing && imageResult && (
              <div className="space-y-6">
                {/* Result Hero Banner & Export Bar */}
                <div className="rounded-3xl bg-white border border-[#E8DFCF] p-6 lg:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A7E70]">
                      Forensic Classification &bull; ISO/IEC 27037 Standard
                    </span>
                    <div className="flex items-center gap-3">
                      {imageResult.canonical_verdict?.predicted_label === "AI_GENERATED" ? (
                        <span className="px-4 py-1.5 rounded-full bg-red-100 border border-red-300 text-red-700 font-bold text-lg flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                          AI GENERATED SYNTHETIC
                        </span>
                      ) : (
                        <span className="px-4 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-lg flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                          GENUINE / CAMERA CAPTURED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#70675D] max-w-xl">
                      {imageResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                        ? "High likelihood of generative AI synthesis detected. Spatial micro-textures and frequency distributions deviate from physical camera sensors."
                        : "Authentic silicon camera sensor pattern noise and natural optical characteristics verified."}
                    </p>
                  </div>

                  {/* Actions & Confidence Meter */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-center gap-3 w-full md:w-auto shrink-0">
                    <div className="w-full md:w-56 p-4 rounded-2xl bg-[#FAF7EE] border border-[#E8DFCF] text-center space-y-1.5">
                      <span className="text-xs font-semibold text-[#7A7165]">Verdict Confidence</span>
                      <div className="text-3xl font-extrabold text-[#2A2521]">
                        {imageResult.canonical_verdict?.model_score != null
                          ? (() => {
                              const isAi = imageResult.canonical_verdict.predicted_label === "AI_GENERATED";
                              const raw = imageResult.canonical_verdict.model_score;
                              const conf = isAi ? raw : (1.0 - raw);
                              return `${(conf * 100).toFixed(1)}%`;
                            })()
                          : "—"}
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E5DCB8] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            imageResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                              ? "bg-[#D9651E]"
                              : "bg-emerald-600"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                ((imageResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                                  ? (imageResult.canonical_verdict?.model_score ?? 0.5)
                                  : 1.0 - (imageResult.canonical_verdict?.model_score ?? 0.5))) * 100
                              )
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-[#8A7E70] font-mono">
                        {imageResult.canonical_verdict?.model_score != null
                          ? imageResult.canonical_verdict.predicted_label === "AI_GENERATED"
                            ? `Synthetic score: ${(imageResult.canonical_verdict.model_score * 100).toFixed(1)}%`
                            : `Sensor integrity: ${((1.0 - imageResult.canonical_verdict.model_score) * 100).toFixed(1)}%`
                          : ""}
                      </div>
                    </div>

                    {/* Export & C2PA Sealing Buttons */}
                    <div className="space-y-2 w-full">
                      <div className="flex gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => exportForensicReportPrint(imageFile, "image", imageResult, null, lastCameraTrackRef.current)}
                          className="flex-1 px-3 py-2 rounded-xl bg-[#2A2521] hover:bg-[#3D352E] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[15px]">print</span>
                          <span>Export Dossier</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportForensicReportDoc(imageFile, "image", imageResult, null, lastCameraTrackRef.current)}
                          title="Download Word Document"
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F2EBDB] border border-[#D5C9B3] text-xs font-bold text-[#2A2521] transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px] text-[#D9651E]">description</span>
                          <span>Word</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleSealImage}
                        disabled={isSealing}
                        className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-[#D9651E] to-[#C94A29] hover:from-[#C25816] hover:to-[#B33E20] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[15px]">verified_user</span>
                        <span>{isSealing ? "Signing Manifest..." : "Sign & Seal Asset (C2PA)"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3D Holographic Heart + Viewport + Metrics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Image Viewer (6 cols) */}
                  <div className="lg:col-span-6 rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-sm text-[#2A2521]">
                        <span className="material-symbols-outlined text-[18px] text-[#D9651E]">photo</span>
                        <span>Inspection Viewport</span>
                      </div>

                      {/* View mode toggle */}
                      <div className="flex items-center bg-[#F2EBDB] p-0.5 rounded-lg border border-[#E2D6C0] text-xs">
                        <button
                          type="button"
                          onClick={() => setImageInspectionMode("original")}
                          className={`px-3 py-1 rounded-md font-medium transition-colors ${
                            imageInspectionMode === "original"
                              ? "bg-white text-[#D9651E] shadow-xs"
                              : "text-[#6C6357] hover:text-[#2A2521]"
                          }`}
                        >
                          Original
                        </button>
                        {imageResult.ela_forensics?.heatmap_data_url && (
                          <button
                            type="button"
                            onClick={() => setImageInspectionMode("ela")}
                            className={`px-3 py-1 rounded-md font-medium transition-colors ${
                              imageInspectionMode === "ela"
                                ? "bg-white text-[#D9651E] shadow-xs"
                                : "text-[#6C6357] hover:text-[#2A2521]"
                            }`}
                          >
                            ELA Heatmap
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setImageInspectionMode("xray");
                            if (!explainabilityResult) {
                              handleLoadExplainability();
                            }
                          }}
                          className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                            imageInspectionMode === "xray"
                              ? "bg-[#D9651E] text-white shadow-xs font-semibold"
                              : "text-[#6C6357] hover:text-[#2A2521]"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                          <span>X-Ray Saliency</span>
                        </button>
                      </div>
                    </div>

                    {/* Viewport Canvas */}
                    <div className="relative rounded-2xl overflow-hidden bg-[#181615] flex items-center justify-center min-h-[320px] max-h-[440px]">
                      {imageInspectionMode === "original" ? (
                        imagePreviewUrl && (
                          <img
                            src={imagePreviewUrl}
                            alt="Uploaded target"
                            className="max-h-[440px] w-auto max-w-full object-contain"
                          />
                        )
                      ) : imageInspectionMode === "ela" ? (
                        imageResult.ela_forensics?.heatmap_data_url && (
                          <img
                            src={imageResult.ela_forensics.heatmap_data_url}
                            alt="ELA Compression Map"
                            className="max-h-[440px] w-auto max-w-full object-contain"
                          />
                        )
                      ) : (
                        /* X-Ray Saliency Heatmap */
                        <div className="relative w-full h-full flex items-center justify-center">
                          {isLoadingExplainability ? (
                            <div className="text-center p-8 space-y-3">
                              <span className="material-symbols-outlined text-4xl text-[#D9651E] animate-spin">
                                progress_activity
                              </span>
                              <p className="text-xs text-white/80 font-mono">
                                Projecting Swin Spatial Tokens through Classifier Head...
                              </p>
                            </div>
                          ) : explainabilityResult?.overlay_b64 ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img
                                src={explainabilityResult.overlay_b64}
                                alt="Swin Spatial Attribution Heatmap"
                                className="max-h-[440px] w-auto max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleLoadExplainability()}
                              className="px-4 py-2 rounded-xl bg-[#D9651E] text-white text-xs font-bold"
                            >
                              Compute Saliency Heatmap
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* X-Ray Saliency Controls Bar when Active */}
                    {imageInspectionMode === "xray" && explainabilityResult && (
                      <div className="p-3 bg-[#FAF7EE] rounded-2xl border border-[#E8DFCF] space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#2A2521] flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-[#D9651E]">biotech</span>
                            <span>{explainabilityResult.methodology}</span>
                          </span>
                          <span className="font-mono text-[11px] text-[#70675D]">
                            Peak: {explainabilityResult.max_intensity.toFixed(2)}
                          </span>
                        </div>
                        {explainabilityResult.top_regions?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {explainabilityResult.top_regions.map((reg, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono text-[10px] font-semibold"
                              >
                                {reg.label}: {(reg.relative_suspicion * 100).toFixed(0)}% AI attribution
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-[#E8DFCF]">
                          <span className="text-[#6C6357]">Attribution Opacity:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.2"
                              max="0.95"
                              step="0.05"
                              value={explainabilityAlpha}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setExplainabilityAlpha(val);
                                handleLoadExplainability(val);
                              }}
                              className="w-24 accent-[#D9651E]"
                            />
                            <span className="font-mono font-bold text-[#2A2521]">{Math.round(explainabilityAlpha * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-[#70675D] pt-1">
                      <span>{imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)</span>
                      <button
                        onClick={handleResetImage}
                        className="text-[#D9651E] hover:underline font-semibold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        Analyze another image
                      </button>
                    </div>
                  </div>

                  {/* Right Column: 3D Holographic Heart + Real Diagnostic Metrics (6 cols) */}
                  <div className="lg:col-span-6 space-y-6">
                    {/* Embedded 3D Holographic Heart */}
                    <div className="flex justify-center">
                      <RGBHeartVisualization
                        isAiGenerated={imageResult.canonical_verdict?.predicted_label === "AI_GENERATED"}
                        confidenceScore={imageResult.canonical_verdict?.model_score}
                        width={380}
                        height={280}
                        title={
                          imageResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                            ? "3D Cardioid • Turbulent Jitter Active"
                            : "3D Cardioid • Steady Cardiac Rotation"
                        }
                      />
                    </div>

                    {/* Multi-Pillar Signals Card */}
                    <div className="rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-3.5">
                      <h3 className="font-bold text-sm text-[#2A2521] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#8A6714]">analytics</span>
                        <span>Forensic Signal Breakdown</span>
                      </h3>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Swin Score */}
                        <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                          <span className="text-[#6C6357] block text-[11px]">Swin Spatial Score</span>
                          <span className="text-base font-extrabold text-[#D9651E] font-mono">
                            {imageResult.ai_detection?.raw_score != null
                              ? `${(imageResult.ai_detection.raw_score * 100).toFixed(1)}%`
                              : "N/A"}
                          </span>
                        </div>

                        {/* ELA Delta */}
                        <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                          <span className="text-[#6C6357] block text-[11px]">ELA Compression Delta</span>
                          <span className="text-base font-extrabold text-[#2A2521] font-mono">
                            {imageResult.ela_forensics?.metrics?.mean_absolute_difference != null
                              ? imageResult.ela_forensics.metrics.mean_absolute_difference.toFixed(2)
                              : "—"}
                          </span>
                        </div>

                        {/* PRNU */}
                        <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                          <span className="text-[#6C6357] block text-[11px]">PRNU Sensor Residual</span>
                          <span className="text-base font-extrabold text-[#2A2521] font-mono">
                            {imageResult.noise_residual?.metrics?.mean_absolute_residual != null
                              ? imageResult.noise_residual.metrics.mean_absolute_residual.toFixed(4)
                              : "—"}
                          </span>
                        </div>

                        {/* DCT Blocking */}
                        <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                          <span className="text-[#6C6357] block text-[11px]">DCT Blocking Ratio</span>
                          <span className="text-base font-extrabold text-[#2A2521] font-mono">
                            {imageResult.dct_analysis?.metrics?.blocking_artifact_ratio != null
                              ? imageResult.dct_analysis.metrics.blocking_artifact_ratio.toFixed(4)
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* C2PA Provenance & EXIF */}
                      <div className="pt-2 border-t border-[#EDE4D5] text-[11px] text-[#70675D] space-y-1">
                        <div className="flex justify-between">
                          <span>C2PA Content Credentials:</span>
                          <span className="font-semibold text-[#2A2521]">
                            {imageResult.c2pa_provenance?.status || "ABSENT / STRIPPED"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Hardware Camera EXIF:</span>
                          <span className="font-semibold text-[#2A2521] truncate max-w-[200px]">
                            {imageResult.metadata_forensics?.camera_metadata?.device_display_text || "Absent / Synthetic"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Corneal Specular Reflection & Ocular Symmetry Card (Feature 2) */}
                    {imageResult.corneal_reflections && (
                      <div className="rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-[#2A2521] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#D9651E]">visibility</span>
                            <span>Corneal Specular Reflection &amp; Ocular Optics</span>
                          </h3>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            imageResult.corneal_reflections.verdict === "CONSISTENT_CORNEAL_SPECULARITY"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : imageResult.corneal_reflections.verdict === "NO_FACES_DETECTED"
                              ? "bg-gray-100 text-gray-700 border-gray-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}>
                            {imageResult.corneal_reflections.verdict.replace(/_/g, " ")}
                          </span>
                        </div>

                        {imageResult.corneal_reflections.status === "COMPLETED" ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                                <span className="text-[#6C6357] block text-[11px]">Bilateral Catchlight Symmetry</span>
                                <span className="text-base font-extrabold text-[#D9651E] font-mono">
                                  {(imageResult.corneal_reflections.specular_symmetry_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                                <span className="text-[#6C6357] block text-[11px]">Pupil Circularity Index</span>
                                <span className="text-base font-extrabold text-[#2A2521] font-mono">
                                  {(imageResult.corneal_reflections.pupil_circularity_score * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>

                            {imageResult.corneal_reflections.annotated_overlay_url && (
                              <div className="rounded-2xl overflow-hidden border border-[#E8DFCF] bg-[#181615] flex flex-col items-center">
                                <div className="w-full px-3 py-1.5 bg-[#2A2521] text-white text-[11px] font-mono flex items-center justify-between">
                                  <span>Ocular Landmark &amp; Specular Highlight Reticles</span>
                                  <span className="text-[#E9C46A]">{imageResult.corneal_reflections.eyes_detected} Dual Corneas</span>
                                </div>
                                <img
                                  src={imageResult.corneal_reflections.annotated_overlay_url}
                                  alt="Corneal specular reticles"
                                  className="max-h-52 w-auto object-contain"
                                />
                              </div>
                            )}

                            <p className="text-[11px] text-[#70675D]">
                              {imageResult.corneal_reflections.analysis_notes}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#70675D] italic">
                            {imageResult.corneal_reflections.analysis_notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Perceptual Hash (pHash) & Reverse Visual Lookup Card (Feature 5) */}
                    {imageResult.perceptual_hashes && (
                      <div className="rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-[#2A2521] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#8A6714]">fingerprint</span>
                            <span>Perceptual Hash Index &amp; Reverse Source Lookup</span>
                          </h3>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#F5ECDA] text-[#8A6714] border border-[#E8D9B5]">
                            64-BIT DCT
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[#6C6357]">Frequency Fingerprint (pHash):</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (imageResult.perceptual_hashes?.phash) {
                                  navigator.clipboard.writeText(imageResult.perceptual_hashes.phash);
                                  alert("Copied pHash to clipboard: " + imageResult.perceptual_hashes.phash);
                                }
                              }}
                              className="text-[11px] text-[#D9651E] hover:underline font-mono flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[13px]">content_copy</span>
                              <span>Copy</span>
                            </button>
                          </div>
                          <div className="font-mono text-xs font-bold text-[#2A2521] tracking-wider break-all bg-white p-2 rounded-lg border border-[#E5DAC6]">
                            {imageResult.perceptual_hashes?.phash || "N/A"}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#70675D]">
                            <div>dHash: <span className="font-semibold text-[#2A2521]">{imageResult.perceptual_hashes?.dhash || "N/A"}</span></div>
                            <div>aHash: <span className="font-semibold text-[#2A2521]">{imageResult.perceptual_hashes?.ahash || "N/A"}</span></div>
                          </div>
                        </div>

                        {/* Reverse Visual Search Engine Deep Links */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-[#2A2521] block">
                            Query Global Web Indices (Visual Match &amp; Clones):
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <a
                              href={imageResult.perceptual_hashes?.reverse_lookup_urls?.google_lens || (imageResult.perceptual_hashes as any)?.google_lens_url || "https://lens.google.com/"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-[#FAF7EE] hover:bg-[#F2EBDB] border border-[#E8DFCF] text-center text-xs font-semibold text-[#2A2521] transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px] text-blue-600">search</span>
                              <span>Google Lens</span>
                            </a>
                            <a
                              href={imageResult.perceptual_hashes?.reverse_lookup_urls?.tineye || (imageResult.perceptual_hashes as any)?.tineye_url || "https://tineye.com/"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-[#FAF7EE] hover:bg-[#F2EBDB] border border-[#E8DFCF] text-center text-xs font-semibold text-[#2A2521] transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px] text-indigo-600">travel_explore</span>
                              <span>TinEye</span>
                            </a>
                            <a
                              href={imageResult.perceptual_hashes?.reverse_lookup_urls?.bing_visual || (imageResult.perceptual_hashes as any)?.bing_visual_url || "https://www.bing.com/visualsearch"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-[#FAF7EE] hover:bg-[#F2EBDB] border border-[#E8DFCF] text-center text-xs font-semibold text-[#2A2521] transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px] text-cyan-600">pageview</span>
                              <span>Bing Visual</span>
                            </a>
                            <a
                              href={imageResult.perceptual_hashes?.reverse_lookup_urls?.yandex_images || (imageResult.perceptual_hashes as any)?.yandex_images_url || "https://yandex.com/images/"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-[#FAF7EE] hover:bg-[#F2EBDB] border border-[#E8DFCF] text-center text-xs font-semibold text-[#2A2521] transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px] text-red-600">manage_search</span>
                              <span>Yandex</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: VIDEO DETECTION WORKBENCH                                   */}
        {/* =================================================================== */}
        {activeTab === "video" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#2A2521] tracking-tight">
                  Video Temporal &amp; Deepfake Inspection
                </h1>
                <p className="text-sm text-[#6C6357] mt-1 max-w-2xl">
                  Upload a video file or record via live camera to audit inter-frame trajectory curvature, frame-wise segmentation, and biological hemodynamics.
                </p>
              </div>

              {/* Instant Camera Trigger */}
              <button
                type="button"
                onClick={() => startCamera("video")}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#F9F5EC] border border-[#DDD1BE] text-xs font-bold text-[#2A2521] shadow-xs transition-colors flex items-center gap-2 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px] text-[#2D6A4F]">videocam</span>
                <span>Record Live Video</span>
              </button>
            </div>

            {/* Upload Zone when no video selected */}
            {!videoFile && (
              <div
                onClick={() => videoInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleSelectVideo(e.dataTransfer.files[0]);
                  }
                }}
                className="group cursor-pointer rounded-3xl border-2 border-dashed border-[#DFD4BF] hover:border-[#D9651E] bg-[#FFFDF9] hover:bg-[#FFF9F2] transition-all p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#F6EDE0] group-hover:bg-[#FBE9DC] text-[#D9651E] flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-3xl">video_file</span>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-base text-[#2A2521]">
                    Click to select a video, or drag and drop here
                  </p>
                  <p className="text-xs text-[#7A7165]">
                    Supports MP4, WebM, MOV, and MKV formats
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="mt-2 px-5 py-2.5 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-semibold text-sm transition-colors shadow-sm"
                  >
                    Browse Video
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera("video");
                    }}
                    className="mt-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#F7F2E6] border border-[#D5C9B3] text-[#2A2521] font-semibold text-sm transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm text-[#2D6A4F]">videocam</span>
                    <span>Record Video</span>
                  </button>
                </div>
              </div>
            )}

            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectVideo(e.target.files[0]);
                }
              }}
            />

            {/* Error Message */}
            {videoError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
                <span>{videoError}</span>
                <button
                  onClick={() => setVideoError(null)}
                  className="text-xs font-semibold underline text-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Analyzing State */}
            {isVideoAnalyzing && (
              <div className="p-10 rounded-3xl bg-white border border-[#E8DFCF] text-center space-y-4 shadow-xs">
                <div className="inline-block animate-spin text-[#D9651E]">
                  <span className="material-symbols-outlined text-5xl">motion_photos_on</span>
                </div>
                <h3 className="font-bold text-lg text-[#2A2521]">Decoding &amp; Auditing Video Frames...</h3>
                <p className="text-xs text-[#70675D] max-w-md mx-auto">
                  Sampling video frames, measuring temporal continuity, and evaluating trajectory deviations via the ResTraV MLP model.
                </p>
              </div>
            )}

            {/* Video Result View */}
            {videoFile && !isVideoAnalyzing && (
              <div className="space-y-6">
                {/* Result Hero Banner & Export Bar */}
                {videoResult && (
                  <div className="rounded-3xl bg-white border border-[#E8DFCF] p-6 lg:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A7E70]">
                        Video Classification &bull; ISO/IEC 27037 Standard
                      </span>
                      <div className="flex items-center gap-3">
                        {videoResult.canonical_verdict?.predicted_label === "AI_GENERATED" ? (
                          <span className="px-4 py-1.5 rounded-full bg-red-100 border border-red-300 text-red-700 font-bold text-lg flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                            AI GENERATED VIDEO
                          </span>
                        ) : (
                          <span className="px-4 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-lg flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                            GENUINE VIDEO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#70675D] max-w-xl">
                        {videoResult.video_ai_verdict?.verdict_summary ||
                          (videoResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                            ? "Synthetic temporal distortion and facial warping patterns detected across decoded frames."
                            : "Physical camera frame continuity and optical trajectory verified across temporal windows.")}
                      </p>
                    </div>

                    {/* Actions & Confidence Meter */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-center gap-3 w-full md:w-auto shrink-0">
                      <div className="w-full md:w-56 p-4 rounded-2xl bg-[#FAF7EE] border border-[#E8DFCF] text-center space-y-1.5">
                        <span className="text-xs font-semibold text-[#7A7165]">Verdict Confidence</span>
                        <div className="text-3xl font-extrabold text-[#2A2521]">
                          {videoResult.video_ai_verdict?.confidence_pct != null
                            ? `${videoResult.video_ai_verdict.confidence_pct.toFixed(1)}%`
                            : videoResult.canonical_verdict?.model_score != null
                            ? (() => {
                                const isAi = videoResult.canonical_verdict.predicted_label === "AI_GENERATED";
                                const raw = videoResult.canonical_verdict.model_score;
                                const conf = isAi ? raw : (1.0 - raw);
                                return `${(conf * 100).toFixed(1)}%`;
                              })()
                            : "—"}
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E5DCB8] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              videoResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                                ? "bg-[#D9651E]"
                                : "bg-emerald-600"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  videoResult.video_ai_verdict?.confidence_pct ??
                                    ((videoResult.canonical_verdict?.predicted_label === "AI_GENERATED"
                                      ? (videoResult.canonical_verdict?.model_score ?? 0.5)
                                      : 1.0 - (videoResult.canonical_verdict?.model_score ?? 0.5)) * 100)
                                )
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Export Buttons */}
                      <div className="flex gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => exportForensicReportPrint(videoFile, "video", null, videoResult, lastCameraTrackRef.current)}
                          className="flex-1 px-3 py-2 rounded-xl bg-[#2A2521] hover:bg-[#3D352E] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[15px]">print</span>
                          <span>Export Dossier</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportForensicReportDoc(videoFile, "video", null, videoResult, lastCameraTrackRef.current)}
                          title="Download Word Document"
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F2EBDB] border border-[#D5C9B3] text-xs font-bold text-[#2A2521] transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px] text-[#D9651E]">description</span>
                          <span>Word</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Video Playback + 3D Holographic Heart Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Video Player (6 cols) */}
                  <div className="lg:col-span-6 rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[#2A2521] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#D9651E]">play_circle</span>
                        <span>Video Playback Viewport</span>
                      </span>
                    </div>

                    {videoUrl && (
                      <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                        <video
                          src={videoUrl}
                          controls
                          className="w-full max-h-[440px] object-contain"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-[#70675D]">
                      <span>{videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      <button
                        onClick={handleResetVideo}
                        className="text-[#D9651E] hover:underline font-semibold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        Analyze another video
                      </button>
                    </div>
                  </div>

                  {/* Right: 3D Holographic Heart + Real Temporal Metrics (6 cols) */}
                  <div className="lg:col-span-6 space-y-6">
                    {/* Embedded 3D Holographic Heart for Video */}
                    <div className="flex justify-center">
                      <RGBHeartVisualization
                        isAiGenerated={videoResult?.canonical_verdict?.predicted_label === "AI_GENERATED"}
                        confidenceScore={videoResult?.canonical_verdict?.model_score}
                        activeSample={activeVideoSample}
                        summary={videoResult?.rgb_summary}
                        width={380}
                        height={280}
                        title={
                          videoResult?.canonical_verdict?.predicted_label === "AI_GENERATED"
                            ? "3D Cardioid • Turbulent Rotation Detected"
                            : "3D Cardioid • Steady Cardiac Perfusion"
                        }
                      />
                    </div>

                    {/* ResTraV Model & Frame Analytics */}
                    <div className="rounded-3xl bg-white border border-[#E8DFCF] p-5 shadow-xs space-y-3.5">
                      <h3 className="font-bold text-sm text-[#2A2521] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#8A6714]">insights</span>
                        <span>ResTraV Temporal Analytics</span>
                      </h3>

                      {videoResult ? (
                        <div className="space-y-3">
                          <div className="p-3.5 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-[#4D453C]">ResTraV Temporal MLP Score</span>
                              <span className="text-[#D9651E] font-mono text-sm">
                                {videoResult.branches?.["restrav_temporal"]?.score != null
                                  ? `${(videoResult.branches["restrav_temporal"].score * 100).toFixed(1)}%`
                                  : videoResult.video_ai_verdict?.confidence_pct != null
                                  ? `${videoResult.video_ai_verdict.confidence_pct.toFixed(1)}%`
                                  : "Operational"}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#7A7165]">
                              Inter-frame trajectory curvature and generative manifold continuity check.
                            </p>
                          </div>

                          {videoResult.video_metadata && (
                            <div className="p-3.5 rounded-xl bg-[#FAF7EE] border border-[#E8DFCF] text-xs space-y-1.5">
                              <div className="flex justify-between">
                                <span className="text-[#6C6357]">Duration:</span>
                                <span className="font-semibold">{videoResult.video_metadata.duration_sec.toFixed(1)}s</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#6C6357]">Total Decoded Frames:</span>
                                <span className="font-semibold">{videoResult.video_metadata.total_frames}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#6C6357]">Resolution:</span>
                                <span className="font-semibold">
                                  {videoResult.video_metadata.width} &times; {videoResult.video_metadata.height} px
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[#70675D]">
                          Select or upload a video file to view real-time temporal analytics.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* FRAME-BY-FRAME SEGMENTATION STRIP                             */}
                {/* ============================================================= */}
                {videoResult?.sampled_frames && videoResult.sampled_frames.length > 0 && (
                  <div className="rounded-3xl bg-white border border-[#E8DFCF] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#D9651E]">view_timeline</span>
                        <h3 className="font-bold text-sm text-[#2A2521]">
                          Sampled Video Frames Segmentation ({videoResult.sampled_frames.length} Keyframes)
                        </h3>
                      </div>
                      <span className="text-[11px] text-[#8A7E70]">
                        Click any frame to inspect synchronized 3D cardioid biometric
                      </span>
                    </div>

                    {/* Scrollable Frame Strip */}
                    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin">
                      {videoResult.sampled_frames.map((frame, idx) => {
                        const isSelected = idx === selectedVideoFrameIndex;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedVideoFrameIndex(idx)}
                            className={`cursor-pointer rounded-2xl border p-2.5 min-w-[140px] max-w-[160px] shrink-0 transition-all text-xs ${
                              isSelected
                                ? "bg-[#FAF2EB] border-[#D9651E] ring-2 ring-[#D9651E]/20 shadow-xs"
                                : "bg-[#FAF7EE] border-[#E8DFCF] hover:border-[#D5C9B3]"
                            }`}
                          >
                            {/* Frame Thumbnail if available */}
                            {frame.thumbnail_data_url || frame.thumbnail_b64 ? (
                              <img
                                src={frame.thumbnail_data_url || `data:image/jpeg;base64,${frame.thumbnail_b64}`}
                                alt={`Frame ${frame.frame_index}`}
                                className="w-full h-18 object-cover rounded-lg mb-2 bg-black"
                              />
                            ) : (
                              <div className="w-full h-16 rounded-lg bg-[#EFE8DA] flex items-center justify-center text-[#8A7E70] mb-2 font-mono text-[11px]">
                                F#{frame.frame_index}
                              </div>
                            )}

                            <div className="flex justify-between font-mono font-bold text-[11px]">
                              <span>F#{frame.frame_index}</span>
                              <span className="text-[#8A7E70]">{frame.timestamp_sec.toFixed(2)}s</span>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[10px] text-[#70675D]">
                              <span>&Delta; RGB:</span>
                              <span className="font-mono">{frame.delta_prev_frame.toFixed(2)}</span>
                            </div>

                            {frame.ai_probability != null && (
                              <div className="mt-1 text-[10px] font-semibold flex justify-between">
                                <span>AI:</span>
                                <span className={frame.ai_probability > 0.5 ? "text-[#D9651E]" : "text-emerald-700"}>
                                  {(frame.ai_probability * 100).toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* TIMELINE ANOMALY HEATMAP & SEGMENT CLIPPING (FEATURE 6)       */}
                {/* ============================================================= */}
                <div className="rounded-3xl bg-white border border-[#E8DFCF] p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#EFE8DA]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-[#D9651E]">movie_filter</span>
                      <h3 className="font-bold text-sm text-[#2A2521]">
                        Timeline Anomaly Density &amp; Evidence Segment Clipper
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-[#8A7E70]">
                      OpenCV MP4 Lossless Slicing Engine
                    </span>
                  </div>

                  {/* Anomaly Density Heatmap Strip */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-[#70675D]">
                      <span>Temporal Anomaly Density (0.0s &rarr; {(videoResult?.video_metadata?.duration_sec || 10).toFixed(1)}s)</span>
                      <span className="font-mono text-[11px] text-[#D9651E] font-semibold">
                        Peak Anomaly Window: [{clipStartSec.toFixed(1)}s - {clipEndSec.toFixed(1)}s]
                      </span>
                    </div>

                    {/* Timeline Heatmap Bar */}
                    <div className="h-6 w-full rounded-xl bg-[#FAF7EE] border border-[#E2D6C0] p-0.5 flex gap-0.5 overflow-hidden">
                      {videoResult?.sampled_frames && videoResult.sampled_frames.length > 0 ? (
                        videoResult.sampled_frames.map((f, fIdx) => {
                          const aiProb = f.ai_probability ?? 0.5;
                          const isHigh = aiProb >= 0.7;
                          const isMed = aiProb >= 0.4 && aiProb < 0.7;
                          return (
                            <div
                              key={fIdx}
                              onClick={() => {
                                setSelectedVideoFrameIndex(fIdx);
                                setClipStartSec(Math.max(0, f.timestamp_sec - 1.5));
                                setClipEndSec(f.timestamp_sec + 2.5);
                              }}
                              title={`Frame #${f.frame_index} @ ${f.timestamp_sec.toFixed(2)}s - AI Prob: ${(aiProb * 100).toFixed(1)}%`}
                              className={`flex-1 rounded-sm cursor-pointer transition-all hover:scale-y-125 ${
                                isHigh
                                  ? "bg-red-500 hover:bg-red-600"
                                  : isMed
                                  ? "bg-amber-400 hover:bg-amber-500"
                                  : "bg-emerald-500 hover:bg-emerald-600"
                              } ${fIdx === selectedVideoFrameIndex ? "ring-2 ring-[#2A2521]" : ""}`}
                            />
                          );
                        })
                      ) : (
                        <div className="w-full bg-emerald-500 rounded-sm" />
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-[#8A7E70]">
                      <span>0.00s</span>
                      <span>Midpoint</span>
                      <span>{(videoResult?.video_metadata?.duration_sec || 10).toFixed(2)}s</span>
                    </div>
                  </div>

                  {/* Extraction Controls Bar */}
                  <div className="p-4 rounded-2xl bg-[#FAF7EE] border border-[#E8DFCF] flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#4D453C]">Start Time (s):</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={clipEndSec}
                          value={clipStartSec}
                          onChange={(e) => setClipStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-20 px-2 py-1 rounded-lg border border-[#D5C9B3] bg-white font-mono text-center font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#4D453C]">End Time (s):</span>
                        <input
                          type="number"
                          step="0.5"
                          min={clipStartSec}
                          max={videoResult?.video_metadata?.duration_sec || 300}
                          value={clipEndSec}
                          onChange={(e) => setClipEndSec(Math.max(clipStartSec + 0.5, parseFloat(e.target.value) || 5))}
                          className="w-20 px-2 py-1 rounded-lg border border-[#D5C9B3] bg-white font-mono text-center font-bold"
                        />
                      </div>

                      <span className="text-[#8A7E70] font-mono">
                        Duration: {(clipEndSec - clipStartSec).toFixed(1)}s
                      </span>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={handleExtractClip}
                        disabled={isExtractingClip}
                        className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D9651E] to-[#C94A29] hover:from-[#C25816] hover:to-[#B33E20] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isExtractingClip ? "animate-spin" : ""}`}>
                          {isExtractingClip ? "progress_activity" : "download"}
                        </span>
                        <span>{isExtractingClip ? "Slicing Clip (OpenCV)..." : "Export Evidence Clip (.mp4)"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Success notification banner */}
                  {clipSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in font-medium">
                      <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                      <span>{clipSuccessMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}



        {/* =================================================================== */}
        {/* VIEW 4: BATCH FORENSIC INGESTION & AUDIT LEDGER (FEATURE 4)         */}
        {/* =================================================================== */}
        {activeTab === "batch" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#2A2521] tracking-tight">
                  High-Throughput Batch Forensic Ingestion
                </h1>
                <p className="text-sm text-[#6C6357] mt-1 max-w-2xl">
                  Concurrent multi-file triage across up to 30 forensic assets. Extracts Swin representations, SHA-256 custody digests, 64-bit perceptual hashes (pHash), and generates exportable forensic CSV ledgers.
                </p>
              </div>

              {batchResult && batchResult.items.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportBatchCSV}
                  className="px-4 py-2 rounded-xl bg-[#2A2521] hover:bg-[#3D352E] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#E9C46A]">table_view</span>
                  <span>Export Batch Ledger (CSV)</span>
                </button>
              )}
            </div>

            {/* Batch Multi-File Dropzone */}
            <div
              onClick={() => batchInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleSelectBatchFiles(e.dataTransfer.files);
                }
              }}
              className="group cursor-pointer rounded-3xl border-2 border-dashed border-[#DFD4BF] hover:border-[#D9651E] bg-[#FFFDF9] hover:bg-[#FFF9F2] transition-all p-10 text-center flex flex-col items-center justify-center gap-3 shadow-xs"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#F6EDE0] group-hover:bg-[#FBE9DC] text-[#D9651E] flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-3xl">drive_folder_upload</span>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-base text-[#2A2521]">
                  Select multiple files, or drag and drop your evidence folder
                </p>
                <p className="text-xs text-[#7A7165]">
                  Supports multi-selection of JPG, PNG, WebP, and TIFF files (up to 30 assets concurrently)
                </p>
              </div>
              <button
                type="button"
                className="mt-2 px-5 py-2.5 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-semibold text-sm transition-colors shadow-sm"
              >
                Browse Multiple Assets
              </button>
            </div>

            <input
              ref={batchInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/tiff"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleSelectBatchFiles(e.target.files);
                }
              }}
            />

            {/* Error Message */}
            {batchError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
                <span>{batchError}</span>
                <button
                  onClick={() => setBatchError(null)}
                  className="text-xs font-semibold underline text-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Analyzing State */}
            {isBatchAnalyzing && (
              <div className="p-10 rounded-3xl bg-white border border-[#E8DFCF] text-center space-y-5 shadow-xs">
                <div className="inline-block animate-spin text-[#D9651E]">
                  <span className="material-symbols-outlined text-5xl">sync</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-[#2A2521]">
                    Deep Forensic Triage &amp; Recheck in Progress ({batchFiles.length} Assets)...
                  </h3>
                  <p className="text-xs text-[#70675D] max-w-lg mx-auto">
                    Extracting C2PA provenance manifests, detecting imperceptible SynthID &amp; visual watermarks, scanning neural representations, and running secondary verification passes.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-[#7A7165] pt-2">
                  <span className="px-3 py-1 rounded-full bg-[#FAF7EE] border border-[#E8DFCF] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-[#D9651E]">verified_user</span>
                    <span>1. C2PA &amp; SynthID Ingestion</span>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#FAF7EE] border border-[#E8DFCF] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-[#D9651E]">psychology</span>
                    <span>2. Deep Vision Scan</span>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#FAF7EE] border border-[#E8DFCF] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-emerald-600">published_with_changes</span>
                    <span>3. Multi-Crop Recheck Verification</span>
                  </span>
                </div>
              </div>
            )}

            {/* Batch Results & Metric Cards */}
            {batchResult && !isBatchAnalyzing && (
              <div className="space-y-6">
                {/* Summary Metrics Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-[#E8DFCF] shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-[#7A7165]">Total Assets Ingested</span>
                    <div className="text-2xl font-extrabold text-[#2A2521]">{batchResult.processed_count}</div>
                    <span className="text-[11px] text-[#8A7E70] font-mono">{batchResult.batch_id}</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E8DFCF] shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-[#7A7165]">Synthetic / AI Detected</span>
                    <div className="text-2xl font-extrabold text-red-600">{batchResult.ai_generated_count}</div>
                    <span className="text-[11px] text-red-700 font-medium">
                      {((batchResult.ai_generated_count / Math.max(1, batchResult.processed_count)) * 100).toFixed(1)}% of batch
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E8DFCF] shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-[#7A7165]">Genuine / Photographic</span>
                    <div className="text-2xl font-extrabold text-emerald-700">{batchResult.genuine_count}</div>
                    <span className="text-[11px] text-emerald-800 font-medium">
                      {((batchResult.genuine_count / Math.max(1, batchResult.processed_count)) * 100).toFixed(1)}% of batch
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E8DFCF] shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-[#7A7165]">Mean Confidence</span>
                    <div className="text-2xl font-extrabold text-[#D9651E]">
                      {(batchResult.average_confidence * 100).toFixed(1)}%
                    </div>
                    <span className="text-[11px] text-[#70675D]">Verified with Recheck</span>
                  </div>
                </div>

                {/* Evidence Ledger Table */}
                <div className="rounded-3xl bg-white border border-[#E8DFCF] overflow-hidden shadow-xs">
                  <div className="p-5 border-b border-[#E8DFCF] flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[#2A2521] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#D9651E]">list_alt</span>
                      <span>Asset Forensic Ledger &amp; Provenance Registry</span>
                    </h3>
                    <span className="text-xs font-mono text-[#70675D]">
                      {batchResult.processed_count} verified records &bull; Multi-layer rechecked
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#2A2521]">
                      <thead className="bg-[#FAF7EE] border-b border-[#E8DFCF] text-[#7A7165] font-semibold text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Asset Name</th>
                          <th className="py-3 px-4">Size / Format</th>
                          <th className="py-3 px-4">SHA-256 Digest</th>
                          <th className="py-3 px-4">Evidence &amp; Provenance</th>
                          <th className="py-3 px-4">Verdict</th>
                          <th className="py-3 px-4">Confidence</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE8DA]">
                        {batchResult.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#FFFDF9] transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#2A2521] max-w-[200px] truncate" title={item.filename}>
                              {item.filename}
                            </td>
                            <td className="py-3 px-4 text-[#70675D]">
                              {(item.file_size_bytes / 1024).toFixed(1)} KB &bull; {item.media_type}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#8A7E70] max-w-[120px] truncate" title={item.sha256}>
                              {item.sha256.slice(0, 12)}...
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <span className="font-medium text-[#2A2521] text-[11px] block">
                                  {item.provenance_signal || "Deep Vision Probe"}
                                </span>
                                <span className="font-mono text-[10px] text-[#D9651E] block">
                                  pHash: {item.phash}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div>
                                {item.predicted_label === "AI_GENERATED" ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px] border border-red-300 inline-block">
                                    AI GENERATED
                                  </span>
                                ) : item.predicted_label === "NOT_AI_GENERATED" ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 inline-block">
                                    GENUINE
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px] border border-gray-300 inline-block">
                                    INCONCLUSIVE
                                  </span>
                                )}
                                {item.rechecked && (
                                  <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5 mt-0.5">
                                    <span className="material-symbols-outlined text-[12px] text-emerald-600">verified</span>
                                    <span>Rechecked</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">{(item.confidence_score * 100).toFixed(1)}%</span>
                                <div className="w-16 h-1.5 rounded-full bg-[#E5DCB8] overflow-hidden">
                                  <div
                                    className={`h-full ${item.predicted_label === "AI_GENERATED" ? "bg-[#D9651E]" : "bg-emerald-600"}`}
                                    style={{ width: `${item.confidence_score * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const targetFile = batchFiles[idx] || batchFiles.find(f => f.name === item.filename) || batchFiles[0];
                                  if (targetFile) {
                                    handleSelectImage(targetFile);
                                    setActiveTab("image");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-[11px] shadow-xs transition-colors flex items-center gap-1 ml-auto"
                              >
                                <span className="material-symbols-outlined text-[13px]">zoom_in</span>
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 5: REAL-TIME WEBRTC DEEPFAKE SHIELD                            */}
        {/* =================================================================== */}
        {activeTab === "live-shield" && (
          <WebcamDeepfakeShield onBackToOverview={() => setActiveTab("landing")} />
        )}
      </main>

      {/* ===================================================================== */}
      {/* LIVE CAMERA CAPTURE MODAL (PHOTO SNAP & VIDEO RECORDING)              */}
      {/* ===================================================================== */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-[#E8DFCF] shadow-2xl overflow-hidden p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DA]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D9651E]">
                  {cameraMode === "photo" ? "photo_camera" : "videocam"}
                </span>
                <span className="font-bold text-base text-[#2A2521]">
                  {cameraMode === "photo" ? "Live Photo Capture" : "Live Video Recording"}
                </span>
              </div>
              <button
                onClick={stopCamera}
                className="w-8 h-8 rounded-full bg-[#FAF7EE] hover:bg-[#F2EBDB] flex items-center justify-center text-[#70675D] transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Camera Viewport Canvas */}
            <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center min-h-[300px] max-h-[380px]">
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Holographic Camera Alignment Reticle */}
              <div className="absolute inset-8 border border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-8 h-8 border-t-2 border-l-2 border-[#D9651E] absolute top-2 left-2"></div>
                <div className="w-8 h-8 border-t-2 border-r-2 border-[#D9651E] absolute top-2 right-2"></div>
                <div className="w-8 h-8 border-b-2 border-l-2 border-[#D9651E] absolute bottom-2 left-2"></div>
                <div className="w-8 h-8 border-b-2 border-r-2 border-[#D9651E] absolute bottom-2 right-2"></div>
                <span className="text-[10px] font-mono tracking-widest text-white/70 uppercase">
                  {cameraMode === "photo" ? "ALIGN SUBJECT" : isRecordingVideo ? `RECORDING: ${recordTimerSec}s` : "READY TO RECORD"}
                </span>
              </div>
            </div>

            {/* Camera Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#70675D]">
                {cameraMode === "photo"
                  ? "Position the target inside the reticle and capture."
                  : "Records a 5-15s temporal snippet for ResTraV trajectory auditing."}
              </span>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-xl bg-[#FAF7EE] hover:bg-[#F2EBDB] text-xs font-semibold text-[#70675D]"
                >
                  Cancel
                </button>

                {cameraMode === "photo" ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-5 py-2 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">camera</span>
                    <span>Capture Photo</span>
                  </button>
                ) : !isRecordingVideo ? (
                  <button
                    type="button"
                    onClick={startVideoRecording}
                    className="px-5 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#24543E] text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">fiber_manual_record</span>
                    <span>Start Recording</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVideoRecording}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 animate-pulse"
                  >
                    <span className="material-symbols-outlined text-[16px]">stop</span>
                    <span>Stop &amp; Analyze ({recordTimerSec}s)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* C2PA CRYPTOGRAPHIC WATERMARK & ASSERTION SEAL PREVIEW MODAL           */}
      {/* ===================================================================== */}
      {sealedImage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-[#E8DFCF] shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DA]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D9651E]">verified_user</span>
                <span className="font-bold text-base text-[#2A2521]">C2PA Cryptographically Sealed Asset</span>
              </div>
              <button
                onClick={() => setSealedImage(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7EE] hover:bg-[#F2EBDB] flex items-center justify-center text-[#70675D] transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-[#181615] flex items-center justify-center max-h-72">
              <img
                src={sealedImage.sealed_image_data_url}
                alt="C2PA Sealed Asset"
                className="max-h-72 w-auto object-contain"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF7EE] border border-[#E8DFCF] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6C6357]">C2PA Manifest Case:</span>
                <span className="font-mono font-semibold text-[#2A2521]">{sealedImage.c2pa_manifest_id || sealedImage.case_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6C6357]">SHA-256 Digest:</span>
                <span className="font-mono font-semibold text-[#2A2521] truncate max-w-[260px]">
                  {sealedImage.sealed_sha256 || sealedImage.sha256 || sealedImage.original_sha256 || "VERIFIED"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6C6357]">Signature Authority:</span>
                <span className="font-mono text-[#D9651E] truncate max-w-[260px]">
                  {sealedImage.signature_status || sealedImage.watermark_signature || "Secura.AI Root CA"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6C6357]">Timestamp (UTC):</span>
                <span className="font-semibold text-[#2A2521]">{sealedImage.signed_at_utc || new Date().toISOString()}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSealedImage(null)}
                className="px-4 py-2 rounded-xl bg-[#FAF7EE] hover:bg-[#F2EBDB] text-xs font-semibold text-[#70675D]"
              >
                Close
              </button>
              <a
                href={sealedImage.sealed_image_data_url}
                download={`C2PA_SEALED_ASSET.jpg`}
                className="px-5 py-2 rounded-xl bg-[#D9651E] hover:bg-[#C25816] text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Download Sealed Asset</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FOOTER                                                                */}
      {/* ===================================================================== */}
      <footer className="border-t border-[#E8DFCF] bg-[#FAF7EE] py-6 px-6 text-xs text-[#8A7E70]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#2A2521]">Secura.AI</span>
            <span>&bull; Enterprise Digital Trust &amp; Media Forensics</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#A39788]">
            <span>ISO/IEC 27037:2012 Standard</span>
            <span>&bull;</span>
            <span>SHA-256 Custody Sealing</span>
            <span>&bull;</span>
            <span>Local Cluster v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
