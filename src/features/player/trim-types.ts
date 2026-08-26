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

export type ExportFpsPreset =
  | "original"
  | "60"
  | "50"
  | "30"
  | "29.97"
  | "25"
  | "24"
  | "15"
  | "12"
  | "custom";

export interface ResolutionPresetInfo {
  id: ExportResolutionPreset;
  label: string;
  shortLabel: string;
  targetHeight?: number;
  scaleFactor?: number;
  description: string;
}

export interface FpsPresetInfo {
  id: ExportFpsPreset;
  label: string;
  shortLabel: string;
  fpsValue?: number;
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
  fpsPreset?: ExportFpsPreset;
  customFps?: number;
  fps: number;
  format: "mp4";
  bitrateMbps: number;
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
  format: "mp4";
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  audioCodec?: string;
}

export const AUDIO_BITRATE_BPS = 192_000; // 192 kbps AAC/Opus
export const AUDIO_BITRATE_MBPS = 0.192;
export const DEFAULT_SOURCE_FPS = 30;
export const MIN_RESOLUTION_DIMENSION = 32;
export const MAX_RESOLUTION_DIMENSION = 4096;

export const EXPORT_QUALITY_PRESETS: Record<
  ExportQuality,
  { label: string; bitrateMbps: number; description: string }
> = {
  original: {
    label: "Original (Match Source Bitrate)",
    bitrateMbps: 0,
    description: "Preserve exact native source video bitrate and quality scaled to resolution (Default)",
  },
  lossless: {
    label: "Visually Lossless (High Bitrate)",
    bitrateMbps: 18,
    description: "Highest quality near-identical master export calibrated for 1080p (scales with resolution)",
  },
  high: {
    label: "High Quality (10 Mbps @ 1080p)",
    bitrateMbps: 10,
    description: "Great for archiving and social media sharing with perceptual scaling",
  },
  medium: {
    label: "Balanced (5 Mbps @ 1080p)",
    bitrateMbps: 5,
    description: "Fast export with great balance of speed, iPad power efficiency, and file size",
  },
  compact: {
    label: "Compact (2.5 Mbps @ 1080p)",
    bitrateMbps: 2.5,
    description: "Optimized for lightweight quick sharing and web embeddings",
  },
  "ultra-compact": {
    label: "Ultra-Compact (1 Mbps @ 1080p)",
    bitrateMbps: 1,
    description: "Minimal file size / low bitrate for instant mobile sharing",
  },
  custom: {
    label: "Custom Bitrate",
    bitrateMbps: 8,
    description: "User-defined explicit bitrate configuration",
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

export const EXPORT_FPS_PRESETS: Record<ExportFpsPreset, FpsPresetInfo> = {
  original: {
    id: "original",
    label: "Original Frame Rate",
    shortLabel: "Original FPS",
    description: "Preserve exact native source video frame rate (Default)",
  },
  "60": {
    id: "60",
    label: "60 fps (Ultra Smooth / High Motion)",
    shortLabel: "60 fps",
    fpsValue: 60,
    description: "Ultra-smooth motion for high action, gaming, and sports",
  },
  "50": {
    id: "50",
    label: "50 fps (PAL High Motion)",
    shortLabel: "50 fps",
    fpsValue: 50,
    description: "High motion standard for PAL regions and 50Hz broadcast",
  },
  "30": {
    id: "30",
    label: "30 fps (Standard Web / Mobile)",
    shortLabel: "30 fps",
    fpsValue: 30,
    description: "Standard web and mobile video playback frame rate",
  },
  "29.97": {
    id: "29.97",
    label: "29.97 fps (NTSC Broadcast)",
    shortLabel: "29.97 fps",
    fpsValue: 29.97,
    description: "Standard NTSC broadcast and television video standard",
  },
  "25": {
    id: "25",
    label: "25 fps (PAL / European Cinema)",
    shortLabel: "25 fps",
    fpsValue: 25,
    description: "European and international broadcast video standard",
  },
  "24": {
    id: "24",
    label: "24 fps (Cinematic Film Standard)",
    shortLabel: "24 fps",
    fpsValue: 24,
    description: "Classic cinematic 24p film motion cadence and aesthetic",
  },
  "15": {
    id: "15",
    label: "15 fps (Compact / Screencast)",
    shortLabel: "15 fps",
    fpsValue: 15,
    description: "Lightweight frame rate for screencasts, slides, and low power",
  },
  "12": {
    id: "12",
    label: "12 fps (Ultra Compact / Animation)",
    shortLabel: "12 fps",
    fpsValue: 12,
    description: "Minimal frame rate for stop-motion, low-bandwidth, and animation",
  },
  custom: {
    id: "custom",
    label: "Custom Frame Rate...",
    shortLabel: "Custom FPS",
    description: "User-defined custom frame rate (1–120 fps)",
  },
};

/**
 * Resolves effective target frame rate in frames per second
 */
export function resolveExportFps(
  preset: ExportFpsPreset = "original",
  customFps?: number,
  detectedSourceFps?: number,
): number {
  const fallbackSourceFps =
    detectedSourceFps && detectedSourceFps > 0 ? detectedSourceFps : DEFAULT_SOURCE_FPS;
  if (preset === "original") {
    return Math.max(1, Math.min(120, fallbackSourceFps));
  }
  if (preset === "custom") {
    return Math.max(1, Math.min(120, customFps && customFps > 0 ? customFps : fallbackSourceFps));
  }
  const info = EXPORT_FPS_PRESETS[preset];
  if (info?.fpsValue) {
    return info.fpsValue;
  }
  return fallbackSourceFps;
}

/**
 * Calculates target output resolution while ensuring even dimension requirements
 * and hardware encoder limits for H.264/WebCodecs
 */
export function calculateExportResolution(
  sourceWidth: number,
  sourceHeight: number,
  preset: ExportResolutionPreset = "original",
  customWidth?: number,
  customHeight?: number,
): { width: number; height: number } {
  const safeSourceW = Math.max(MIN_RESOLUTION_DIMENSION, sourceWidth || 1920);
  const safeSourceH = Math.max(MIN_RESOLUTION_DIMENSION, sourceHeight || 1080);

  let w = safeSourceW;
  let h = safeSourceH;

  if (preset === "original") {
    w = safeSourceW;
    h = safeSourceH;
  } else if (preset === "custom") {
    // Clamp custom dimensions between 32 and 4096 (Hardware/H.264 max level)
    const cw = customWidth && customWidth > 0 ? customWidth : safeSourceW;
    const ch = customHeight && customHeight > 0 ? customHeight : safeSourceH;
    w = Math.max(MIN_RESOLUTION_DIMENSION, Math.min(MAX_RESOLUTION_DIMENSION, cw));
    h = Math.max(MIN_RESOLUTION_DIMENSION, Math.min(MAX_RESOLUTION_DIMENSION, ch));
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

  // Video encoders strictly require dimensions to be even integers (clamped between 32 and 4096)
  const finalW = Math.max(
    MIN_RESOLUTION_DIMENSION,
    Math.min(MAX_RESOLUTION_DIMENSION, Math.floor(w / 2) * 2),
  );
  const finalH = Math.max(
    MIN_RESOLUTION_DIMENSION,
    Math.min(MAX_RESOLUTION_DIMENSION, Math.floor(h / 2) * 2),
  );

  return { width: finalW, height: finalH };
}

/**
 * Scales video bitrate based on perceptual pixel count and frame rate ratios
 * relative to reference (1080p @ 30fps).
 * Uses power scaling (exponent ~0.7) for optimal perceptual visual fidelity & iPad power efficiency.
 */
export function calculateTargetBitrateMbps({
  quality,
  configuredBitrateMbps,
  sourceBitrateBps,
  targetWidth,
  targetHeight,
  targetFps = DEFAULT_SOURCE_FPS,
  sourceWidth = 1920,
  sourceHeight = 1080,
  sourceFps = DEFAULT_SOURCE_FPS,
  keepAudio = true,
}: {
  quality: ExportQuality;
  configuredBitrateMbps?: number;
  sourceBitrateBps?: number;
  targetWidth: number;
  targetHeight: number;
  targetFps?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFps?: number;
  keepAudio?: boolean;
}): number {
  const targetPixels = Math.max(1, targetWidth * targetHeight);
  const refPixels = 1920 * 1080; // 2,073,600 px reference (1080p)
  const safeTargetFps = Math.max(1, targetFps);
  const safeSourceFps = Math.max(1, sourceFps || DEFAULT_SOURCE_FPS);

  // Perceptual resolution scaling factor relative to 1080p
  const resScaleRatio = targetPixels / refPixels;
  // Exponent 0.7 gives smooth perceptual curve (4K ~2.6×, 720p ~0.57×, 480p ~0.33×, 360p ~0.21×)
  const resFactor = Math.pow(resScaleRatio, 0.7);

  // FPS scaling factor (60fps requires ~1.41× bitrate of 30fps, 15fps requires ~0.71×)
  const fpsRatio = safeTargetFps / DEFAULT_SOURCE_FPS;
  const fpsFactor = Math.pow(fpsRatio, 0.5);

  if (quality === "custom") {
    // Custom user-specified bitrate is respected directly with safety clamp
    const userMbps = configuredBitrateMbps && configuredBitrateMbps > 0 ? configuredBitrateMbps : 8;
    return Math.max(0.2, Math.min(60, Math.round(userMbps * 100) / 100));
  }

  if (quality === "original") {
    // If source bitrate is known, scale it proportionally to resolution and fps changes
    const rawSourceBitrateBps = sourceBitrateBps && sourceBitrateBps > 0 ? sourceBitrateBps : 0;
    if (rawSourceBitrateBps > 0) {
      const rawSourceMbps = rawSourceBitrateBps / 1_000_000;
      const sourceVideoMbps = keepAudio
        ? Math.max(0.2, rawSourceMbps - AUDIO_BITRATE_MBPS)
        : rawSourceMbps;

      const safeSourcePixels = Math.max(1, (sourceWidth || 1920) * (sourceHeight || 1080));

      const pixelRatioFromSource = targetPixels / safeSourcePixels;
      const fpsRatioFromSource = safeTargetFps / safeSourceFps;

      // If resolution and fps are unchanged (or within 2%), preserve exact source video bitrate
      if (Math.abs(pixelRatioFromSource - 1) < 0.03 && Math.abs(fpsRatioFromSource - 1) < 0.03) {
        return Math.max(0.2, Math.min(60, Math.round(sourceVideoMbps * 100) / 100));
      }

      const scaledFromSource =
        sourceVideoMbps * Math.pow(pixelRatioFromSource, 0.7) * Math.pow(fpsRatioFromSource, 0.5);
      return Math.max(0.2, Math.min(60, Math.round(scaledFromSource * 100) / 100));
    } else {
      // Fallback base for 1080p is ~8 Mbps
      const scaled = 8 * resFactor * fpsFactor;
      return Math.max(0.2, Math.min(60, Math.round(scaled * 100) / 100));
    }
  }

  // Quality preset (lossless: 18 Mbps, high: 10 Mbps, medium: 5 Mbps, compact: 2.5 Mbps, ultra-compact: 1 Mbps)
  const basePresetMbps = EXPORT_QUALITY_PRESETS[quality]?.bitrateMbps || configuredBitrateMbps || 8;
  const scaledMbps = basePresetMbps * resFactor * fpsFactor;

  // If source bitrate is known, prevent preset from upscaling beyond source bitrate if resolution didn't increase
  if (sourceBitrateBps && sourceBitrateBps > 0) {
    const rawSourceMbps = sourceBitrateBps / 1_000_000;
    const safeSourcePixels = Math.max(1, (sourceWidth || 1920) * (sourceHeight || 1080));
    if (targetPixels <= safeSourcePixels && scaledMbps > rawSourceMbps * 1.1) {
      const sourceClamped =
        rawSourceMbps * Math.pow(targetPixels / safeSourcePixels, 0.7) * Math.pow(safeTargetFps / safeSourceFps, 0.5);
      return Math.max(0.2, Math.min(60, Math.round(sourceClamped * 100) / 100));
    }
  }

  return Math.max(0.2, Math.min(60, Math.round(scaledMbps * 100) / 100));
}

/**
 * Selects appropriate H.264 (AVC) profile & level string based on dimensions and frame rate.
 * Level 5.1 is required for 4K30; Level 5.0 for 1440p / 1080p60; Level 4.0 for 1080p30; Level 3.1 for 720p / 480p widescreen.
 */
export function selectAvcCodecString(width: number, height: number, fps: number): string {
  const pixels = width * height;
  const safeFps = Math.max(1, fps);
  // Macroblock calculation (16x16 blocks)
  const mbWidth = Math.ceil(width / 16);
  const mbHeight = Math.ceil(height / 16);
  const mbPerSec = mbWidth * mbHeight * safeFps;

  // Level 5.1: 4K UHD (3840x2160 @ 30-60fps) or mb/s > 589,824
  if (pixels >= 3840 * 2160 || mbPerSec > 589824) {
    return "avc1.640033"; // High Profile Level 5.1
  }
  // Level 5.0: 1440p QHD (2560x1440 @ 30fps) or 1080p @ 60fps (mb/s > 245,760)
  if (pixels >= 2560 * 1440 || mbPerSec > 245760) {
    return "avc1.640032"; // High Profile Level 5.0
  }
  // Level 4.0: 1080p FHD (1920x1080 @ 30fps) (mb/s > 108,000)
  if (pixels >= 1920 * 1080 || mbPerSec > 108000) {
    return "avc1.640028"; // High Profile Level 4.0
  }
  // Level 3.1: 720p HD (1280x720 @ 30fps) or 480p widescreen (854x480) (mb/s > 40,500)
  if (pixels >= 854 * 480 || mbPerSec > 40500) {
    return "avc1.64001f"; // High Profile Level 3.1
  }
  // Level 3.0: 720x480 SD / 360p (640x360 @ 30fps)
  return "avc1.4d001e"; // Main Profile Level 3.0
}

/**
 * Calculates adaptive keyframe interval (GOP length) in frames.
 * Adapts to resolution and FPS to avoid giant I-frame thermal spikes on mobile/iPads.
 */
export function calculateKeyframeInterval(width: number, height: number, fps: number): number {
  const safeFps = Math.max(1, Math.round(fps));
  const pixels = width * height;
  if (pixels >= 3840 * 2160) {
    return Math.max(1, safeFps * 2); // 4K: every 2 seconds
  }
  if (pixels >= 2560 * 1440) {
    return Math.max(1, Math.round(safeFps * 2.5)); // 1440p: every 2.5 seconds
  }
  if (pixels >= 1920 * 1080) {
    return Math.max(1, safeFps * 3); // 1080p: every 3 seconds
  }
  return Math.max(1, safeFps * 4); // 720p and below: every 4 seconds
}

