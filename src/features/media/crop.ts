import {
  LOCKED_SIZE_PRESETS,
  MAX_DIMENSION,
  MIN_DIMENSION,
  type CropPresetId,
} from "./types";

export type CropTarget = {
  width: number;
  height: number;
  crop: boolean;
  lockSize: boolean;
};

export function fitRatio(srcW: number, srcH: number, ratio: number): CropTarget {
  if (!srcW || !srcH || !ratio || !Number.isFinite(srcW) || !Number.isFinite(srcH) || !Number.isFinite(ratio)) {
    return { width: Math.max(1, srcW || 1920), height: Math.max(1, srcH || 1080), crop: true, lockSize: false };
  }
  const current = srcW / srcH;
  if (current > ratio) {
    return {
      width: Math.max(1, Math.round(srcH * ratio)),
      height: Math.max(1, Math.round(srcH)),
      crop: true,
      lockSize: false,
    };
  }
  return {
    width: Math.max(1, Math.round(srcW)),
    height: Math.max(1, Math.round(srcW / ratio)),
    crop: true,
    lockSize: false,
  };
}

export function getCropAspectRatio(
  preset: CropPresetId,
  customWidth?: number,
  customHeight?: number,
  fallbackWidth = 16,
  fallbackHeight = 9,
): number | null {
  switch (preset) {
    case "none":
      return null;
    case "wide-banner":
      return 1920 / 480;
    case "std-banner":
      return 1200 / 400;
    case "og":
      return 1200 / 630;
    case "yt-thumb":
      return 1280 / 720;
    case "square":
      return 1;
    case "16:9":
      return 16 / 9;
    case "4:3":
      return 4 / 3;
    case "3:4":
      return 3 / 4;
    case "3:2":
      return 3 / 2;
    case "2:3":
      return 2 / 3;
    case "9:16":
      return 9 / 16;
    case "custom": {
      if (customWidth && customHeight && customWidth > 0 && customHeight > 0) {
        return customWidth / customHeight;
      }
      if (fallbackWidth && fallbackHeight && fallbackWidth > 0 && fallbackHeight > 0) {
        return fallbackWidth / fallbackHeight;
      }
      return 16 / 9;
    }
  }
}

export function resolveCropTarget(
  srcW: number,
  srcH: number,
  preset: CropPresetId,
  customWidth?: number,
  customHeight?: number,
): CropTarget {
  const safeW = Math.max(1, Math.round(srcW || 1920));
  const safeH = Math.max(1, Math.round(srcH || 1080));

  switch (preset) {
    case "none":
      return { width: safeW, height: safeH, crop: false, lockSize: false };
    case "wide-banner":
      return { width: 1920, height: 480, crop: true, lockSize: true };
    case "std-banner":
      return { width: 1200, height: 400, crop: true, lockSize: true };
    case "og":
      return { width: 1200, height: 630, crop: true, lockSize: true };
    case "yt-thumb":
      return { width: 1280, height: 720, crop: true, lockSize: true };
    case "square": {
      const size = Math.min(safeW, safeH);
      return { width: size, height: size, crop: true, lockSize: false };
    }
    case "16:9":
      return fitRatio(safeW, safeH, 16 / 9);
    case "4:3":
      return fitRatio(safeW, safeH, 4 / 3);
    case "3:4":
      return fitRatio(safeW, safeH, 3 / 4);
    case "3:2":
      return fitRatio(safeW, safeH, 3 / 2);
    case "2:3":
      return fitRatio(safeW, safeH, 2 / 3);
    case "9:16":
      return fitRatio(safeW, safeH, 9 / 16);
    case "custom": {
      const w = clampDim(customWidth ?? safeW, safeW);
      const h = clampDim(customHeight ?? safeH, safeH);
      return { width: w, height: h, crop: true, lockSize: true };
    }
  }
}

function clampDim(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < MIN_DIMENSION) return fallback;
  return Math.min(MAX_DIMENSION, Math.round(value));
}

/** Source rect that cover-fills dstW×dstH without stretching. */
export function coverSourceRect(srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const sw = srcH * dstRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / dstRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

export function isLockedSizePreset(preset: CropPresetId): boolean {
  return LOCKED_SIZE_PRESETS.has(preset);
}

