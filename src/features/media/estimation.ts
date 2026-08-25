import { formatFileSize } from "./format";
import type { CropPresetId, OutputFormat, SourceImage } from "./types";
import type { ExportConfig, TrimMode } from "../player/trim-types";
import { calculateExportResolution } from "../player/trim-types";
import { resolveCropTarget } from "./crop";

export interface VideoSourceMetadata {
  containerLabel: string;
  codecGuess: string;
  sourceBitrateBps: number;
  sourceBitrateFormatted: string;
  width: number;
  height: number;
  aspectRatioLabel: string;
  durationSec: number;
  fileSizeBytes: number;
  hasAudio: boolean;
  audioLabel: string;
}

export interface VideoExportEstimation {
  retainedDurationSec: number;
  durationReductionPct: number;
  targetWidth: number;
  targetHeight: number;
  targetVideoBitrateBps: number;
  targetAudioBitrateBps: number;
  targetTotalBitrateBps: number;
  targetVideoBitrateFormatted: string;
  targetAudioBitrateFormatted: string;
  targetTotalBitrateFormatted: string;
  videoPayloadBytes: number;
  audioPayloadBytes: number;
  containerOverheadBytes: number;
  estimatedTotalBytes: number;
  estimatedTotalFormatted: string;
  savingsBytes: number;
  savingsPct: number;
  videoPayloadRatioPct: number;
  audioPayloadRatioPct: number;
  isLargerThanSource: boolean;
}

export interface ImageSourceMetadata {
  formatLabel: string;
  colorDepthLabel: string;
  width: number;
  height: number;
  megapixels: number;
  megapixelsFormatted: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  bitsPerPixel: number;
  bitsPerPixelFormatted: string;
  aspectRatioLabel: string;
}

export interface ImageTargetEstimation {
  targetWidth: number;
  targetHeight: number;
  targetMegapixels: number;
  targetFormat: string;
  estimatedBytes: number;
  estimatedFormatted: string;
  estimatedBpp: number;
  estimatedBppFormatted: string;
  budgetBytes: number;
  budgetFormatted: string;
  budgetDeltaBytes: number;
  savingsBytes: number;
  savingsPct: number;
  pixelCountChangePct: number;
}

/**
 * Calculates greatest common divisor for clean aspect ratios
 */
export function calculateGcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Returns human-readable aspect ratio label (e.g. "16:9", "4:3", "9:16", "21:9")
 */
export function getAspectRatioLabel(width: number, height: number): string {
  if (!width || !height || width <= 0 || height <= 0) return "16:9";
  const ratio = width / height;

  // Check common standard ratios with close tolerance
  if (Math.abs(ratio - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.02) return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.02) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.02) return "3:4";
  if (Math.abs(ratio - 3 / 2) < 0.02) return "3:2";
  if (Math.abs(ratio - 2 / 3) < 0.02) return "2:3";
  if (Math.abs(ratio - 1) < 0.01) return "1:1 (Square)";
  if (Math.abs(ratio - 21 / 9) < 0.05) return "21:9 (Ultrawide)";

  const gcd = calculateGcd(width, height);
  const w = Math.round(width / gcd);
  const h = Math.round(height / gcd);

  if (w <= 32 && h <= 32) {
    return `${w}:${h}`;
  }
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Detects container and video codec format from file metadata
 */
export function extractVideoSourceMetadata({
  fileName,
  fileSize,
  durationSec,
  width,
  height,
  hasAudio = true,
}: {
  fileName: string;
  fileSize: number;
  durationSec: number;
  width: number;
  height: number;
  hasAudio?: boolean;
}): VideoSourceMetadata {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  let containerLabel = "MP4 (AVC / H.264)";
  let codecGuess = "H.264";

  if (ext === "webm") {
    containerLabel = "WebM (VP9 / Opus)";
    codecGuess = "VP9";
  } else if (ext === "mov" || ext === "quicktime") {
    containerLabel = "QuickTime (MOV / ProRes or AVC)";
    codecGuess = "H.264 / ProRes";
  } else if (ext === "mkv") {
    containerLabel = "Matroska (MKV / AVC)";
    codecGuess = "H.264 / HEVC";
  } else if (ext === "avi") {
    containerLabel = "AVI (Audio Video Interleaved)";
    codecGuess = "MPEG-4";
  } else if (ext === "m4v") {
    containerLabel = "Apple M4V (AVC)";
    codecGuess = "H.264";
  }

  const safeDuration = Math.max(0.1, durationSec);
  const sourceBitrateBps = durationSec > 0 && fileSize > 0 ? (fileSize * 8) / safeDuration : 0;

  const sourceBitrateFormatted =
    sourceBitrateBps >= 1_000_000
      ? `${(sourceBitrateBps / 1_000_000).toFixed(2)} Mbps`
      : `${Math.round(sourceBitrateBps / 1_000)} kbps`;

  const audioLabel = hasAudio ? "Stereo AAC / 48kHz" : "Muted / No Audio";

  return {
    containerLabel,
    codecGuess,
    sourceBitrateBps,
    sourceBitrateFormatted,
    width: width || 1920,
    height: height || 1080,
    aspectRatioLabel: getAspectRatioLabel(width, height),
    durationSec,
    fileSizeBytes: fileSize,
    hasAudio,
    audioLabel,
  };
}

/**
 * Calculates retained duration based on Trim/Cut mode and Start/End points
 */
export function calculateRetainedDuration(
  durationSec: number,
  trimMode: TrimMode,
  trimStart: number | null,
  trimEnd: number | null,
): number {
  if (durationSec <= 0) return 0;
  const s = trimStart !== null ? Math.max(0, Math.min(durationSec, trimStart)) : 0;
  const e = trimEnd !== null ? Math.max(s, Math.min(durationSec, trimEnd)) : durationSec;

  if (trimMode === "trim") {
    return Math.max(0, e - s);
  } else {
    // Cut mode: total minus selected cut interval
    const cutDuration = Math.max(0, e - s);
    return Math.max(0, durationSec - cutDuration);
  }
}

/**
 * Computes live mathematical estimation for Video Export
 */
export function estimateVideoExport({
  sourceFileSize,
  sourceDurationSec,
  sourceWidth,
  sourceHeight,
  trimMode,
  trimStart,
  trimEnd,
  exportConfig,
}: {
  sourceFileSize: number;
  sourceDurationSec: number;
  sourceWidth: number;
  sourceHeight: number;
  trimMode: TrimMode;
  trimStart: number | null;
  trimEnd: number | null;
  exportConfig: ExportConfig;
}): VideoExportEstimation {
  const retainedDurationSec = calculateRetainedDuration(
    sourceDurationSec,
    trimMode,
    trimStart,
    trimEnd,
  );

  const durationReductionPct =
    sourceDurationSec > 0
      ? Math.max(0, Math.round(((sourceDurationSec - retainedDurationSec) / sourceDurationSec) * 100))
      : 0;

  const targetRes = calculateExportResolution(
    sourceWidth,
    sourceHeight,
    exportConfig.resolution || "original",
    exportConfig.customWidth,
    exportConfig.customHeight,
  );

  // Bitrates in bps
  let targetVideoBitrateBps: number;
  if (exportConfig.quality === "original" && sourceFileSize > 0 && sourceDurationSec > 0) {
    const rawSourceBitrateBps = Math.round((sourceFileSize * 8) / sourceDurationSec);
    targetVideoBitrateBps = Math.max(
      200_000,
      exportConfig.keepAudio ? rawSourceBitrateBps - 160_000 : rawSourceBitrateBps,
    );
  } else {
    targetVideoBitrateBps = Math.round((exportConfig.bitrateMbps || 8) * 1_000_000);
  }
  const targetAudioBitrateBps = exportConfig.keepAudio ? 160_000 : 0; // 160 kbps AAC/Opus
  const targetTotalBitrateBps = targetVideoBitrateBps + targetAudioBitrateBps;

  // Payloads in bytes
  const videoPayloadBytes = Math.round((targetVideoBitrateBps * retainedDurationSec) / 8);
  const audioPayloadBytes = Math.round((targetAudioBitrateBps * retainedDurationSec) / 8);

  // Container overhead estimation: ~1.5% of payload + 64KB base metadata
  const containerOverheadBytes =
    retainedDurationSec > 0
      ? Math.round(Math.max(64 * 1024, (videoPayloadBytes + audioPayloadBytes) * 0.015))
      : 0;

  const estimatedTotalBytes = videoPayloadBytes + audioPayloadBytes + containerOverheadBytes;

  const savingsBytes = sourceFileSize > 0 ? sourceFileSize - estimatedTotalBytes : 0;
  const savingsPct =
    sourceFileSize > 0
      ? Number((((sourceFileSize - estimatedTotalBytes) / sourceFileSize) * 100).toFixed(1))
      : 0;

  const totalPayload = Math.max(1, videoPayloadBytes + audioPayloadBytes);
  const videoPayloadRatioPct = Math.round((videoPayloadBytes / totalPayload) * 100);
  const audioPayloadRatioPct = 100 - videoPayloadRatioPct;

  const targetVideoBitrateFormatted =
    targetVideoBitrateBps >= 1_000_000
      ? `${(targetVideoBitrateBps / 1_000_000).toFixed(1)} Mbps`
      : `${Math.round(targetVideoBitrateBps / 1_000)} kbps`;

  const targetAudioBitrateFormatted =
    targetAudioBitrateBps > 0
      ? `${Math.round(targetAudioBitrateBps / 1_000)} kbps`
      : "0 kbps (Muted)";

  const targetTotalBitrateFormatted =
    targetTotalBitrateBps >= 1_000_000
      ? `${(targetTotalBitrateBps / 1_000_000).toFixed(2)} Mbps`
      : `${Math.round(targetTotalBitrateBps / 1_000)} kbps`;

  return {
    retainedDurationSec,
    durationReductionPct,
    targetWidth: targetRes.width,
    targetHeight: targetRes.height,
    targetVideoBitrateBps,
    targetAudioBitrateBps,
    targetTotalBitrateBps,
    targetVideoBitrateFormatted,
    targetAudioBitrateFormatted,
    targetTotalBitrateFormatted,
    videoPayloadBytes,
    audioPayloadBytes,
    containerOverheadBytes,
    estimatedTotalBytes,
    estimatedTotalFormatted: formatFileSize(estimatedTotalBytes),
    savingsBytes,
    savingsPct,
    videoPayloadRatioPct,
    audioPayloadRatioPct,
    isLargerThanSource: estimatedTotalBytes > sourceFileSize && sourceFileSize > 0,
  };
}

/**
 * Extracts comprehensive source metadata from SourceImage
 */
export function extractImageSourceMetadata(source: SourceImage): ImageSourceMetadata {
  const ext = (source.fileName.split(".").pop() || "").toLowerCase();
  let formatLabel = "PNG (24-bit RGB)";
  let colorDepthLabel = "24-bit sRGB";

  if (ext === "jpg" || ext === "jpeg") {
    formatLabel = "JPEG (DCT Baseline)";
    colorDepthLabel = "24-bit sRGB";
  } else if (ext === "webp") {
    formatLabel = "WebP (Lossy / VP8)";
    colorDepthLabel = "24-bit + Alpha";
  } else if (ext === "avif") {
    formatLabel = "AVIF (AV1 Still)";
    colorDepthLabel = "10/12-bit HDR";
  } else if (ext === "png") {
    formatLabel = "PNG (Deflate Lossless)";
    colorDepthLabel = "32-bit RGBA";
  }

  const w = source.width || 1920;
  const h = source.height || 1080;
  const totalPixels = w * h;
  const megapixels = totalPixels / 1_000_000;
  const megapixelsFormatted = `${megapixels.toFixed(2)} MP`;

  // Bits per pixel: (bytes * 8) / (width * height)
  const bitsPerPixel = totalPixels > 0 && source.fileSize > 0 ? (source.fileSize * 8) / totalPixels : 0;
  const bitsPerPixelFormatted = `${bitsPerPixel.toFixed(2)} bpp`;

  return {
    formatLabel,
    colorDepthLabel,
    width: w,
    height: h,
    megapixels,
    megapixelsFormatted,
    fileSizeBytes: source.fileSize,
    fileSizeFormatted: formatFileSize(source.fileSize),
    bitsPerPixel,
    bitsPerPixelFormatted,
    aspectRatioLabel: getAspectRatioLabel(w, h),
  };
}

/**
 * Computes live real-time estimation for Image Bench optimization
 */
export function estimateImageOptimization({
  source,
  targetKb,
  quality,
  format,
  cropPreset,
  customWidth,
  customHeight,
}: {
  source: SourceImage | null;
  targetKb: number;
  quality: number;
  format: OutputFormat;
  cropPreset: CropPresetId;
  customWidth?: string;
  customHeight?: string;
}): ImageTargetEstimation {
  if (!source) {
    return {
      targetWidth: 1920,
      targetHeight: 1080,
      targetMegapixels: 2.07,
      targetFormat: "WEBP",
      estimatedBytes: targetKb * 1024,
      estimatedFormatted: `${targetKb} KB`,
      estimatedBpp: 0.65,
      estimatedBppFormatted: "0.65 bpp",
      budgetBytes: targetKb * 1024,
      budgetFormatted: `${targetKb} KB`,
      budgetDeltaBytes: 0,
      savingsBytes: 0,
      savingsPct: 0,
      pixelCountChangePct: 0,
    };
  }

  const cWidthNum = Number.parseInt(customWidth || "", 10) || undefined;
  const cHeightNum = Number.parseInt(customHeight || "", 10) || undefined;

  const targetDim = resolveCropTarget(
    source.width,
    source.height,
    cropPreset,
    cWidthNum,
    cHeightNum,
  );

  const targetW = targetDim.width;
  const targetH = targetDim.height;
  const targetPixels = targetW * targetH;
  const sourcePixels = Math.max(1, source.width * source.height);
  const targetMegapixels = Number((targetPixels / 1_000_000).toFixed(2));

  const pixelCountChangePct = Math.round(((targetPixels - sourcePixels) / sourcePixels) * 100);

  // Format compression coefficients (relative efficiency)
  // WebP ~ 0.14, JPEG ~ 0.18, PNG ~ 0.65
  let kFormat = 0.14;
  let targetFormatLabel = "WEBP";

  if (format === "image/png") {
    kFormat = 0.62;
    targetFormatLabel = "PNG";
  } else if (format === "image/jpeg") {
    kFormat = 0.19;
    targetFormatLabel = "JPEG";
  } else if (format === "image/webp" || format === "auto") {
    kFormat = 0.14;
    targetFormatLabel = "WEBP";
  }

  // Quality power curve for lossy compressors
  const qFactor = Math.pow(Math.max(0.1, quality), 1.6);
  // Estimated bits per pixel for target output
  const rawEstBpp = format === "image/png" ? 24 * kFormat : 24 * kFormat * (0.35 + 0.65 * qFactor);

  const rawEstBytes = Math.round((targetPixels * rawEstBpp) / 8);

  const budgetBytes = targetKb * 1024;

  // In auto / budget constrained mode, the output converges close to the budget
  // bounded by quality floor and format characteristics
  let estimatedBytes = rawEstBytes;
  if (rawEstBytes > budgetBytes) {
    // Compression clamps towards budget with minimum floor
    estimatedBytes = Math.round(budgetBytes * 0.95);
  }

  const estimatedBpp = targetPixels > 0 ? (estimatedBytes * 8) / targetPixels : 0;

  const savingsBytes = Math.max(0, source.fileSize - estimatedBytes);
  const savingsPct =
    source.fileSize > 0
      ? Number((((source.fileSize - estimatedBytes) / source.fileSize) * 100).toFixed(1))
      : 0;

  const budgetDeltaBytes = estimatedBytes - budgetBytes;

  return {
    targetWidth: targetW,
    targetHeight: targetH,
    targetMegapixels,
    targetFormat: targetFormatLabel,
    estimatedBytes,
    estimatedFormatted: formatFileSize(estimatedBytes),
    estimatedBpp,
    estimatedBppFormatted: `${estimatedBpp.toFixed(2)} bpp`,
    budgetBytes,
    budgetFormatted: `${targetKb} KB`,
    budgetDeltaBytes,
    savingsBytes,
    savingsPct,
    pixelCountChangePct,
  };
}
