export type OutputFormat = "auto" | "image/jpeg" | "image/png" | "image/webp";

export type CropPresetId =
  | "none"
  | "wide-banner"
  | "std-banner"
  | "og"
  | "yt-thumb"
  | "square"
  | "16:9"
  | "4:3"
  | "9:16"
  | "custom";

export type CropPreset = {
  id: CropPresetId;
  label: string;
};

export const CROP_PRESETS: readonly CropPreset[] = [
  { id: "none", label: "None (Original Ratio)" },
  { id: "wide-banner", label: "Wide Banner (1920×480)" },
  { id: "std-banner", label: "Standard Banner (1200×400)" },
  { id: "og", label: "Open Graph (1200×630)" },
  { id: "yt-thumb", label: "YouTube Thumb (1280×720)" },
  { id: "square", label: "Square (1:1)" },
  { id: "4:3", label: "Standard (4:3)" },
  { id: "16:9", label: "Widescreen (16:9)" },
  { id: "9:16", label: "Portrait (9:16)" },
  { id: "custom", label: "Custom..." },
] as const;

export const FORMAT_OPTIONS: { id: OutputFormat; label: string }[] = [
  { id: "auto", label: "Auto (Best Size)" },
  { id: "image/jpeg", label: "JPEG" },
  { id: "image/png", label: "PNG" },
  { id: "image/webp", label: "WebP" },
];

/** Absolute-pixel presets keep output size unless the byte budget forces a scale. */
export const LOCKED_SIZE_PRESETS = new Set<CropPresetId>([
  "wide-banner",
  "std-banner",
  "og",
  "yt-thumb",
  "custom",
]);

export type VideoSession = {
  objectUrl: string;
  fileName: string;
  fileSize: number;
};

export type SourceImage = {
  objectUrl: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  fromCaptureId?: string;
};

export type CaptureItem = {
  id: string;
  objectUrl: string;
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  timestampSec: number;
  createdAt: number;
};

export type BenchOutput = {
  objectUrl: string;
  blob: Blob;
  width: number;
  height: number;
  format: string;
};

export type BenchSettings = {
  targetKb: number;
  quality: number;
  format: OutputFormat;
  cropPreset: CropPresetId;
  customWidth: string;
  customHeight: string;
};

export const DEFAULT_SETTINGS: BenchSettings = {
  targetKb: 175,
  quality: 0.85,
  format: "auto",
  cropPreset: "none",
  customWidth: "",
  customHeight: "",
};

export const MAX_CAPTURES = 24;
export const MIN_DIMENSION = 50;
export const MAX_DIMENSION = 4096;
