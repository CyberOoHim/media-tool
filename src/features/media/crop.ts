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
  const current = srcW / srcH;
  if (current > ratio) {
    return { width: Math.round(srcH * ratio), height: srcH, crop: true, lockSize: false };
  }
  return { width: srcW, height: Math.round(srcW / ratio), crop: true, lockSize: false };
}

export function resolveCropTarget(
  srcW: number,
  srcH: number,
  preset: CropPresetId,
  customWidth?: number,
  customHeight?: number,
): CropTarget {
  switch (preset) {
    case "none":
      return { width: srcW, height: srcH, crop: false, lockSize: false };
    case "wide-banner":
      return { width: 1920, height: 480, crop: true, lockSize: true };
    case "std-banner":
      return { width: 1200, height: 400, crop: true, lockSize: true };
    case "og":
      return { width: 1200, height: 630, crop: true, lockSize: true };
    case "yt-thumb":
      return { width: 1280, height: 720, crop: true, lockSize: true };
    case "square": {
      const size = Math.min(srcW, srcH);
      return { width: size, height: size, crop: true, lockSize: false };
    }
    case "16:9":
      return fitRatio(srcW, srcH, 16 / 9);
    case "4:3":
      return fitRatio(srcW, srcH, 4 / 3);
    case "9:16":
      return fitRatio(srcW, srcH, 9 / 16);
    case "custom": {
      const w = clampDim(customWidth ?? srcW, srcW);
      const h = clampDim(customHeight ?? srcH, srcH);
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
