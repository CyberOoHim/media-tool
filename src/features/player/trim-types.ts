export type TrimMode = "trim" | "cut";

export type ExportQuality = "lossless" | "high" | "medium" | "compact" | "custom";

export interface TrimState {
  mode: TrimMode;
  startSec: number | null;
  endSec: number | null;
  includeScreenshotFrame: boolean; // default: false (not included)
  previewMode: boolean; // true if previewing the cut/trim playback
}

export interface ExportConfig {
  quality: ExportQuality;
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
}

export const EXPORT_QUALITY_PRESETS: Record<
  ExportQuality,
  { label: string; bitrateMbps: number; description: string }
> = {
  lossless: {
    label: "Visually Lossless (Master)",
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
  custom: {
    label: "Custom Bitrate",
    bitrateMbps: 8,
    description: "User-defined bitrate configuration",
  },
};
