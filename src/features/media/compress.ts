import { resolveCropTarget } from "./crop";
import {
  type TransformState,
  calculateOrientedDimensions,
  renderTransformedSource,
} from "./transform";
import { MIN_DIMENSION, type CropPresetId, type OutputFormat } from "./types";

export type CompressOptions = {
  targetBytes: number;
  quality: number;
  format: OutputFormat;
  cropPreset: CropPresetId;
  customWidth?: number;
  customHeight?: number;
  transform?: TransformState;
};

export type CompressResult = {
  blob: Blob;
  width: number;
  height: number;
  format: string;
};

const MAX_ITERATIONS = 15;
const QUALITY_FLOOR = 0.4;
const SIZE_TOLERANCE = 1.05;

function yieldUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<{ blob: Blob; mime: string }> {
  let type = mime;
  let blob = await canvasToBlob(canvas, type, quality);
  if (!blob && type === "image/webp") {
    type = "image/jpeg";
    blob = await canvasToBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("Failed to encode image.");
  return { blob, mime: type };
}

function drawScaled(
  source: CanvasImageSource,
  dstW: number,
  dstH: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, dstW);
  canvas.height = Math.max(1, dstH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, dstW, dstH);
  return canvas;
}

async function fitQuality(
  canvas: HTMLCanvasElement,
  mime: string,
  targetBytes: number,
  startQuality: number,
): Promise<{ blob: Blob; mime: string; quality: number }> {
  const first = await encode(canvas, mime, startQuality);
  mime = first.mime;
  if (first.blob.size <= targetBytes * SIZE_TOLERANCE || mime === "image/png") {
    return { blob: first.blob, mime, quality: startQuality };
  }

  let lo = QUALITY_FLOOR;
  let hi = startQuality;
  let bestFit: { blob: Blob; quality: number } | null = null;
  let last = first.blob;

  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const next = await encode(canvas, mime, mid);
    last = next.blob;
    if (next.blob.size <= targetBytes * SIZE_TOLERANCE) {
      bestFit = { blob: next.blob, quality: mid };
      lo = mid;
    } else {
      hi = mid;
    }
    if (i % 2 === 0) await yieldUi();
  }

  return {
    blob: bestFit?.blob ?? last,
    mime,
    quality: bestFit?.quality ?? QUALITY_FLOOR,
  };
}

export async function compressImage(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  options: CompressOptions,
): Promise<CompressResult> {
  const transform: TransformState = options.transform ?? {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
    cropPreset: options.cropPreset,
    customWidth: options.customWidth,
    customHeight: options.customHeight,
  };

  const oriented = calculateOrientedDimensions(srcW, srcH, transform.rotation);
  const target = resolveCropTarget(
    oriented.width,
    oriented.height,
    transform.cropPreset,
    transform.customWidth,
    transform.customHeight,
  );

  const baseW = target.width;
  const baseH = target.height;
  let mime: string = options.format === "auto" ? "image/webp" : options.format;
  let scale = 1;
  let blob: Blob | null = null;
  let outW = baseW;
  let outH = baseH;
  let iterations = 0;

  // Render master transformed image canvas
  const masterCanvas = renderTransformedSource(source, srcW, srcH, transform, baseW, baseH);

  while (iterations < MAX_ITERATIONS) {
    outW = Math.max(1, Math.round(baseW * scale));
    outH = Math.max(1, Math.round(baseH * scale));

    if (outW < MIN_DIMENSION || outH < MIN_DIMENSION) {
      if (!blob) {
        const canvas = drawScaled(
          masterCanvas,
          Math.max(outW, MIN_DIMENSION),
          Math.max(outH, MIN_DIMENSION),
        );
        const encoded = await encode(canvas, mime, options.quality);
        blob = encoded.blob;
        mime = encoded.mime;
        outW = canvas.width;
        outH = canvas.height;
      }
      break;
    }

    const canvas = scale === 1 ? masterCanvas : drawScaled(masterCanvas, outW, outH);
    const fitted = await fitQuality(canvas, mime, options.targetBytes, options.quality);
    blob = fitted.blob;
    mime = fitted.mime;

    if (blob.size <= options.targetBytes * SIZE_TOLERANCE) break;

    scale *= 0.9;
    iterations += 1;
    if (iterations % 2 === 0) await yieldUi();
  }

  if (!blob) throw new Error("Failed to process image.");

  return { blob, width: outW, height: outH, format: mime };
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to parse image data."));
    img.src = src;
  });
}

