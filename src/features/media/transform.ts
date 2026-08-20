import { resolveCropTarget } from "./crop";
import type { CropPresetId } from "./types";

export type TransformState = {
  zoom: number; // 1.0 to 4.0
  panX: number; // offset in % (-100 to 100)
  panY: number; // offset in % (-100 to 100)
  rotation: number; // -180 to 180 degrees (continuous)
  flipH: boolean; // horizontal mirror
  flipV: boolean; // vertical mirror
  cropPreset: CropPresetId;
  customWidth?: number;
  customHeight?: number;
};

export const DEFAULT_TRANSFORM: TransformState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  cropPreset: "none",
};

export function hasActiveTransform(t: TransformState): boolean {
  const normRot = normalizeRotation(t.rotation);
  return (
    t.zoom !== 1 ||
    t.panX !== 0 ||
    t.panY !== 0 ||
    normRot !== 0 ||
    t.flipH ||
    t.flipV ||
    t.cropPreset !== "none"
  );
}

export function getTransformCss(t: TransformState): string {
  const scaleX = t.zoom * (t.flipH ? -1 : 1);
  const scaleY = t.zoom * (t.flipV ? -1 : 1);
  return `translate(${t.panX}%, ${t.panY}%) rotate(${t.rotation}deg) scale(${scaleX}, ${scaleY})`;
}

export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let norm = deg % 360;
  if (norm > 180) norm -= 360;
  if (norm < -180) norm += 360;
  if (Object.is(norm, -0)) norm = 0;
  return Number(norm.toFixed(1));
}

export function rotateClockwise(current: number, step = 90): number {
  return normalizeRotation(current + step);
}

export function rotateCounterClockwise(current: number, step = 90): number {
  return normalizeRotation(current - step);
}

export function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.5, Number(value.toFixed(2))));
}

export function clampPan(value: number): number {
  return Math.min(100, Math.max(-100, Number(value.toFixed(2))));
}

export function calculateOrientedDimensions(
  srcW: number,
  srcH: number,
  rotation: number,
): { width: number; height: number } {
  const rad = (rotation * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, Math.round(srcW * absCos + srcH * absSin)),
    height: Math.max(1, Math.round(srcW * absSin + srcH * absCos)),
  };
}

export function renderTransformedSource(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  transform: TransformState,
  overrideDstW?: number,
  overrideDstH?: number,
): HTMLCanvasElement {
  const oriented = calculateOrientedDimensions(srcW, srcH, transform.rotation);
  const crop = resolveCropTarget(
    oriented.width,
    oriented.height,
    transform.cropPreset,
    transform.customWidth,
    transform.customHeight,
  );

  const dstW = overrideDstW ?? crop.width;
  const dstH = overrideDstH ?? crop.height;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(dstW));
  canvas.height = Math.max(1, Math.round(dstH));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Move to center + percentage pan relative to output canvas dimensions
  const translateX = canvas.width / 2 + (transform.panX / 100) * canvas.width;
  const translateY = canvas.height / 2 + (transform.panY / 100) * canvas.height;
  ctx.translate(translateX, translateY);

  // Rotate
  ctx.rotate((transform.rotation * Math.PI) / 180);

  // Scale (Zoom and Mirroring)
  const scaleFit = Math.max(canvas.width / oriented.width, canvas.height / oriented.height);
  const scaleX = transform.zoom * (transform.flipH ? -1 : 1) * scaleFit;
  const scaleY = transform.zoom * (transform.flipV ? -1 : 1) * scaleFit;
  ctx.scale(scaleX, scaleY);

  // Draw centered
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();

  return canvas;
}
