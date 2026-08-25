export type TrimMode = "trim" | "cut";

export type ExportQuality =
  | "original"
  | "lossless"
  | "high"
  | "medium"
  | "compact"
  | "ultra-compact"
  | "custom";

export type ExportResolutionPreset =
  | "original"
  | "4k"
  | "1440p"
  | "1080p"
  | "720p"
  | "480p"
  | "360p"
  | "scale-75"
  | "scale-50"
  | "scale-25"
  | "custom";

export interface ResolutionPresetInfo {
  id: ExportResolutionPreset;
  label: string;
  shortLabel: string;
  targetHeight?: number;
  scaleFactor?: number;
  description: string;
}

export interface TrimState {
  mode: TrimMode;
  startSec: number | null;
  endSec: number | null;
  includeScreenshotFrame: boolean; // default: false (not included)
  previewMode: boolean; // true if previewing the cut/trim playback
}

export interface ExportConfig {
  quality: ExportQuality;
  resolution: ExportResolutionPreset;
  customWidth?: number;
  customHeight?: number;
  lockAspectRatio?: boolean;
  format: "mp4" | "webm";
  bitrateMbps: number;
  fps: number;
  keepAudio: boolean;
}

export interface ExportProgress {
  phase: "preparing" | "decoding_encoding" | "audio_processing" | "finalizing" | "completed" | "error";
  currentFrame: number;
  totalFrames: number;
  percent: number;
  speedMultiplier: number;
  fps: number;
  elapsedSec: number;
  estimatedRemainingSec: number;
  message?: string;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  durationSec: number;
  fileSize: number;
  frameCount: number;
  speedMultiplier: number;
  processingTimeMs: number;
  format: "mp4" | "webm";
  width: number;
  height: number;
}

export const EXPORT_QUALITY_PRESETS: Record<
  ExportQuality,
  { label: string; bitrateMbps: number; description: string }
> = {
  original: {
    label: "Original (Same as Source)",
    bitrateMbps: 0,
    description: "Preserve exact native source video bitrate and quality (Default)",
  },
  lossless: {
    label: "Visually Lossless (18 Mbps)",
    bitrateMbps: 18,
    description: "Highest quality / near-identical master export with high bitrate CRF",
  },
  high: {
    label: "High Quality (10 Mbps)",
    bitrateMbps: 10,
    description: "Great for 1080p/4K archiving and social media sharing",
  },
  medium: {
    label: "Balanced (5 Mbps)",
    bitrateMbps: 5,
    description: "Fast export with great balance of speed and file size",
  },
  compact: {
    label: "Compact (2.5 Mbps)",
    bitrateMbps: 2.5,
    description: "Optimized for lightweight quick sharing and web embeddings",
  },
  "ultra-compact": {
    label: "Ultra-Compact (1 Mbps)",
    bitrateMbps: 1,
    description: "Minimal file size / low bitrate (1 Mbps) for instant mobile sharing",
  },
  custom: {
    label: "Custom Bitrate",
    bitrateMbps: 8,
    description: "User-defined bitrate configuration",
  },
};

export const EXPORT_RESOLUTION_PRESETS: Record<ExportResolutionPreset, ResolutionPresetInfo> = {
  original: {
    id: "original",
    label: "Original Dimension",
    shortLabel: "Original Dimension",
    scaleFactor: 1,
    description: "Preserve exact native source video dimensions (Default)",
  },
  "4k": {
    id: "4k",
    label: "4K UHD (2160p)",
    shortLabel: "4K (2160p)",
    targetHeight: 2160,
    description: "Ultra High Definition (3840 × 2160 or 2160p vertical)",
  },
  "1440p": {
    id: "1440p",
    label: "1440p QHD (2K)",
    shortLabel: "1440p (2K)",
    targetHeight: 1440,
    description: "Quad HD (2560 × 1440 or 1440p vertical)",
  },
  "1080p": {
    id: "1080p",
    label: "1080p FHD (Full HD)",
    shortLabel: "1080p (FHD)",
    targetHeight: 1080,
    description: "Standard Full HD (1920 × 1080 or 1080p vertical)",
  },
  "720p": {
    id: "720p",
    label: "720p HD",
    shortLabel: "720p (HD)",
    targetHeight: 720,
    description: "High Definition (1280 × 720 or 720p vertical)",
  },
  "480p": {
    id: "480p",
    label: "480p SD",
    shortLabel: "480p (SD)",
    targetHeight: 480,
    description: "Standard Definition (854 × 480 or 480p vertical)",
  },
  "360p": {
    id: "360p",
    label: "360p Low",
    shortLabel: "360p",
    targetHeight: 360,
    description: "Low resolution (640 × 360) for fast preview and small file size",
  },
  "scale-75": {
    id: "scale-75",
    label: "75% of Source",
    shortLabel: "75% Scale",
    scaleFactor: 0.75,
    description: "Scale source dimensions to 75%",
  },
  "scale-50": {
    id: "scale-50",
    label: "50% of Source (Half)",
    shortLabel: "50% Scale",
    scaleFactor: 0.5,
    description: "Scale source dimensions to 50%",
  },
  "scale-25": {
    id: "scale-25",
    label: "25% of Source (Quarter)",
    shortLabel: "25% Scale",
    scaleFactor: 0.25,
    description: "Scale source dimensions to 25%",
  },
  custom: {
    id: "custom",
    label: "Custom Resolution (W × H)",
    shortLabel: "Custom",
    description: "Specify custom width and height in pixels",
  },
};

/**
 * Calculates target output resolution while ensuring even dimension requirements for H.264/WebCodecs
 */
export function calculateExportResolution(
  sourceWidth: number,
  sourceHeight: number,
  preset: ExportResolutionPreset = "original",
  customWidth?: number,
  customHeight?: number,
): { width: number; height: number } {
  const safeSourceW = Math.max(2, sourceWidth || 1920);
  const safeSourceH = Math.max(2, sourceHeight || 1080);

  let w = safeSourceW;
  let h = safeSourceH;

  if (preset === "original") {
    w = safeSourceW;
    h = safeSourceH;
  } else if (preset === "custom") {
    w = customWidth && customWidth > 0 ? customWidth : safeSourceW;
    h = customHeight && customHeight > 0 ? customHeight : safeSourceH;
  } else {
    const info = EXPORT_RESOLUTION_PRESETS[preset];
    if (info.scaleFactor) {
      w = Math.round(safeSourceW * info.scaleFactor);
      h = Math.round(safeSourceH * info.scaleFactor);
    } else if (info.targetHeight) {
      const isLandscape = safeSourceW >= safeSourceH;
      if (isLandscape) {
        const targetH = info.targetHeight;
        const targetW = Math.round((safeSourceW / safeSourceH) * targetH);
        w = targetW;
        h = targetH;
      } else {
        // Portrait (e.g. 9:16 mobile): short edge is targetHeight
        const targetW = info.targetHeight;
        const targetH = Math.round((safeSourceH / safeSourceW) * targetW);
        w = targetW;
        h = targetH;
      }
    }
  }

  // Video encoders strictly require dimensions to be even integers
  const finalW = Math.max(2, Math.floor(w / 2) * 2);
  const finalH = Math.max(2, Math.floor(h / 2) * 2);

  return { width: finalW, height: finalH };
}
