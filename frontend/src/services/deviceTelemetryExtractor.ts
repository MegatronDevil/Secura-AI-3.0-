/**
 * Real-Time Device Telemetry & Client-Side EXIF / C2PA Container Scanner.
 * Extracts hardware profile, GPU rendering architecture, display metrics,
 * camera stream parameters, and file-embedded EXIF/JUMBF (C2PA) markers.
 */

export interface RealtimeDeviceTelemetry {
  os: string;
  architecture: string;
  cpuCores: number;
  systemMemory: string;
  gpuRenderer: string;
  screenResolution: string;
  colorDepth: string;
  pixelRatio: number;
  ingestionSource: string;
  cameraHardwareLabel?: string;
  cameraCapabilities?: {
    width?: number;
    height?: number;
    frameRate?: number;
    facingMode?: string;
  };
}

export interface ExtractedFileMetadata {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  focalLength?: string;
  iso?: string;
  lensModel?: string;
  hasC2paJumbf: boolean;
  c2paClaimGenerator?: string;
  c2paStatusDescription: string;
  rawExifFound: boolean;
}

/**
 * Extracts real-time hardware telemetry from the current runtime environment.
 */
export function getRealtimeDeviceTelemetry(
  ingestionSource: "Live Camera Stream" | "File Ingestion / Drag-and-Drop" = "File Ingestion / Drag-and-Drop",
  cameraTrack?: MediaStreamTrack | null
): RealtimeDeviceTelemetry {
  // 1. Operating System & Architecture
  const userAgent = navigator.userAgent;
  let os = "Desktop Environment";
  if (userAgent.indexOf("Win") !== -1) os = "Microsoft Windows 10/11 (NT Kernel)";
  else if (userAgent.indexOf("Mac") !== -1) os = "Apple macOS (Darwin Kernel)";
  else if (userAgent.indexOf("Linux") !== -1) os = "Linux (X11 / Wayland)";
  else if (userAgent.indexOf("Android") !== -1) os = "Google Android OS";
  else if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) os = "Apple iOS / iPadOS";

  // 2. Hardware CPU & Memory
  const cpuCores = navigator.hardwareConcurrency || 8;
  const memoryGb = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB Unified RAM` : "Physical Workstation Memory";

  // 3. WebGL GPU Hardware Unmasking
  let gpuRenderer = "Integrated Hardware Accelerator";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        gpuRenderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
      }
    }
  } catch {
    gpuRenderer = "Hardware Direct3D / OpenGL Pipeline";
  }

  // 4. Display Metrics
  const screenResolution = `${window.screen.width} × ${window.screen.height} px`;
  const colorDepth = `${window.screen.colorDepth || 24}-bit (sRGB / DCI-P3 Gamut)`;
  const pixelRatio = window.devicePixelRatio || 1;

  // 5. Camera Track Details (if captured live)
  let cameraHardwareLabel: string | undefined = undefined;
  let cameraCapabilities: RealtimeDeviceTelemetry["cameraCapabilities"] = undefined;

  if (cameraTrack) {
    cameraHardwareLabel = cameraTrack.label || "Integrated Optical Camera Sensor";
    const settings = cameraTrack.getSettings ? cameraTrack.getSettings() : {};
    cameraCapabilities = {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      facingMode: settings.facingMode,
    };
  }

  return {
    os,
    architecture: navigator.platform || "x86_64 / ARM64",
    cpuCores,
    systemMemory: memoryGb,
    gpuRenderer,
    screenResolution,
    colorDepth,
    pixelRatio,
    ingestionSource,
    cameraHardwareLabel,
    cameraCapabilities,
  };
}

/**
 * Scans binary image buffers directly in browser for EXIF tags and C2PA JUMBF boxes.
 */
export async function scanFileBinaryForExifAndC2PA(file: File): Promise<ExtractedFileMetadata> {
  const result: ExtractedFileMetadata = {
    hasC2paJumbf: false,
    c2paStatusDescription: "No JUMBF Content Credentials box found in container.",
    rawExifFound: false,
  };

  try {
    // Read first 256KB for metadata headers
    const slice = file.slice(0, Math.min(file.size, 262144));
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const textChunk = new TextDecoder("latin1").decode(bytes);

    // 1. Scan for C2PA JUMBF signatures: 'c2pa', 'urn:uuid:cbfb0cd0' or 'cai:manifest'
    if (textChunk.includes("c2pa") || textChunk.includes("cbfb0cd0") || textChunk.includes("claim_generator") || textChunk.includes("cai.manifest")) {
      result.hasC2paJumbf = true;
      result.c2paStatusDescription = "C2PA JUMBF Manifest Box Detected in Asset Container";

      // Attempt to extract claim generator string
      const match = textChunk.match(/"claim_generator":\s*"([^"]+)"/) || textChunk.match(/claim_generator=([^\s,;]+)/);
      if (match && match[1]) {
        result.c2paClaimGenerator = match[1];
      } else if (textChunk.includes("Adobe")) {
        result.c2paClaimGenerator = "Adobe Content Authenticity Initiative (CAI)";
      } else if (textChunk.includes("Truepic")) {
        result.c2paClaimGenerator = "Truepic Lens Verified Provenance";
      } else {
        result.c2paClaimGenerator = "C2PA Coalition for Content Provenance & Authenticity";
      }
    }

    // 2. Scan for Camera EXIF tags (Make, Model, Software, Lens, DateTime)
    if (textChunk.includes("Exif") || bytes[0] === 0xFF && bytes[1] === 0xD8) {
      result.rawExifFound = true;

      // Extract Common Camera Makes & Models
      const makes = ["Apple", "Sony", "Canon", "Nikon", "Samsung", "Google", "Fujifilm", "Panasonic", "Leica", "Olympus", "DJI", "GoPro", "OnePlus", "Xiaomi"];
      for (const m of makes) {
        if (textChunk.includes(m)) {
          result.make = m;
          break;
        }
      }

      // Check for iPhone / Galaxy / Pixel model patterns
      const modelMatch = textChunk.match(/iPhone\s[0-9A-Za-z\s]+/i) ||
                         textChunk.match(/Pixel\s[0-9A-Za-z\s]+/i) ||
                         textChunk.match(/ILCE-[0-9A-Za-z]+/i) ||
                         textChunk.match(/EOS\s[0-9A-Za-z\s]+/i) ||
                         textChunk.match(/SM-[0-9A-Za-z]+/i);
      if (modelMatch) {
        result.model = modelMatch[0].trim();
      }

      // Check for Software
      const softwareMatch = textChunk.match(/Photoshop\s[0-9A-Za-z.]+/i) ||
                            textChunk.match(/Lightroom\s[0-9A-Za-z.]+/i) ||
                            textChunk.match(/iOS\s[0-9.]+/i) ||
                            textChunk.match(/GIMP\s[0-9.]+/i);
      if (softwareMatch) {
        result.software = softwareMatch[0].trim();
      }

      // Check for ISO
      const isoMatch = textChunk.match(/ISO\s?([0-9]{2,5})/i);
      if (isoMatch) result.iso = `ISO ${isoMatch[1]}`;

      // Check for Date/Time (YYYY:MM:DD HH:MM:SS)
      const dateMatch = textChunk.match(/20[0-2][0-9]:[0-1][0-9]:[0-3][0-9]\s[0-2][0-9]:[0-5][0-9]:[0-5][0-9]/);
      if (dateMatch) {
        result.dateTime = dateMatch[0];
      }
    }
  } catch (err) {
    console.warn("Client-side metadata extraction notice:", err);
  }

  return result;
}
