import { create } from "zustand";
import type { ExportConfig, TrimMode } from "../player/trim-types";
import { compressImage, loadHtmlImage } from "./compress";
import { downloadBlob } from "./download";
import { extFromMime, fileStem, timestampForFilename } from "./format";
import { revokeQuiet } from "./object-url";
import { DEFAULT_TRANSFORM, type TransformState } from "./transform";
import {
  DEFAULT_SETTINGS,
  MAX_CAPTURES,
  type BenchOutput,
  type BenchSettings,
  type CaptureItem,
  type CaptureSortOrder,
  type SourceImage,
  type VideoSession,
} from "./types";

export function sortCaptures(
  items: CaptureItem[],
  order: CaptureSortOrder = "time-asc",
): CaptureItem[] {
  return [...items].sort((a, b) => {
    if (order === "time-asc") {
      return a.timestampSec - b.timestampSec || a.createdAt - b.createdAt;
    }
    if (order === "time-desc") {
      return b.timestampSec - a.timestampSec || b.createdAt - a.createdAt;
    }
    if (order === "created-desc") {
      return b.createdAt - a.createdAt;
    }
    if (order === "created-asc") {
      return a.createdAt - b.createdAt;
    }
    return 0;
  });
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  quality: "lossless",
  format: "mp4",
  bitrateMbps: 18,
  fps: 30,
  keepAudio: true,
};

type MediaState = {
  video: VideoSession | null;
  source: SourceImage | null;
  captures: CaptureItem[];
  output: BenchOutput | null;
  settings: BenchSettings;
  benchTransform: TransformState;
  processing: boolean;
  error: string | null;
  captureSortOrder: CaptureSortOrder;

  // Video Cut & Trim State
  trimMode: TrimMode;
  trimStart: number | null;
  trimEnd: number | null;
  includeScreenshotFrame: boolean; // default: false (not included)
  previewTrimMode: boolean;
  exportConfig: ExportConfig;

  loadVideo: (file: File) => void;
  clearVideo: () => void;
  loadImageFile: (file: File) => Promise<void>;
  captureFrame: (opts: {
    blob: Blob;
    width: number;
    height: number;
    timestampSec: number;
    videoName: string;
  }) => string;
  openCapture: (id: string) => void;
  removeCapture: (id: string) => void;
  clearCaptures: () => void;
  process: () => Promise<void>;
  downloadOutput: () => void;
  downloadCapture: (id: string) => void;
  downloadAllCaptures: () => void;
  setCaptureSortOrder: (order: CaptureSortOrder) => void;
  setSettings: (partial: Partial<BenchSettings>, autoRun?: boolean) => void;
  setBenchTransform: (partial: Partial<TransformState>, autoRun?: boolean) => void;
  resetBenchTransform: () => void;
  clearBench: () => void;
  resetAll: () => void;
  setError: (message: string | null) => void;

  // Cut & Trim Actions
  setTrimMode: (mode: TrimMode) => void;
  setTrimStart: (sec: number | null) => void;
  setTrimEnd: (sec: number | null) => void;
  setTrimRange: (start: number | null, end: number | null) => void;
  setIncludeScreenshotFrame: (include: boolean) => void;
  setPreviewTrimMode: (preview: boolean) => void;
  setExportConfig: (partial: Partial<ExportConfig>) => void;
  applyScreenshotToTrim: (
    captureId: string,
    target: "start" | "end",
    includeFrameOverride?: boolean,
  ) => { start: number | null; end: number | null };
  clearTrimRange: () => void;
};

function nextId(): string {
  return `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useMediaStore = create<MediaState>((set, get) => ({
  video: null,
  source: null,
  captures: [],
  output: null,
  settings: { ...DEFAULT_SETTINGS },
  benchTransform: { ...DEFAULT_TRANSFORM },
  processing: false,
  error: null,
  captureSortOrder: "time-asc",

  // Cut & Trim Initial State
  trimMode: "trim",
  trimStart: null,
  trimEnd: null,
  includeScreenshotFrame: false, // Default: false (not included)
  previewTrimMode: false,
  exportConfig: { ...DEFAULT_EXPORT_CONFIG },

  loadVideo: (file) => {
    if (!file.type.startsWith("video/")) {
      set({ error: "Please select a valid video file." });
      return;
    }
    const prev = get().video;
    revokeQuiet(prev?.objectUrl);
    set({
      video: {
        objectUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileSize: file.size,
      },
      error: null,
    });
  },

  clearVideo: () => {
    revokeQuiet(get().video?.objectUrl);
    set({ video: null });
  },

  loadImageFile: async (file) => {
    if (!file.type.startsWith("image/")) {
      set({ error: "Please select a valid image file (JPG, PNG, WebP)." });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(objectUrl);
      const prev = get().source;
      const prevOut = get().output;
      if (prev && !prev.fromCaptureId) revokeQuiet(prev.objectUrl);
      revokeQuiet(prevOut?.objectUrl);
      set({
        source: {
          objectUrl,
          fileName: file.name,
          fileSize: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
        },
        output: null,
        error: null,
      });
      // Auto-process newly loaded image
      void get().process();
    } catch (err) {
      revokeQuiet(objectUrl);
      set({
        error: err instanceof Error ? err.message : "Failed to parse image data.",
      });
    }
  },

  captureFrame: ({ blob, width, height, timestampSec, videoName }) => {
    const id = nextId();
    const objectUrl = URL.createObjectURL(blob);
    const fileName = `${fileStem(videoName)}_${timestampForFilename(timestampSec)}.png`;
    const item: CaptureItem = {
      id,
      objectUrl,
      blob,
      fileName,
      width,
      height,
      timestampSec,
      createdAt: Date.now(),
    };

    const prevSource = get().source;
    const prevOut = get().output;
    if (!prevSource?.fromCaptureId) revokeQuiet(prevSource?.objectUrl);
    revokeQuiet(prevOut?.objectUrl);

    set((state) => {
      const next = [item, ...state.captures];
      const overflow = next.slice(MAX_CAPTURES);
      for (const old of overflow) {
        if (old.id !== id) revokeQuiet(old.objectUrl);
      }
      return {
        captures: next.slice(0, MAX_CAPTURES),
        source: {
          objectUrl,
          fileName,
          fileSize: blob.size,
          width,
          height,
          fromCaptureId: id,
        },
        output: null,
        error: null,
      };
    });

    // Auto-process the newly captured frame immediately
    void get().process();

    return id;
  },

  openCapture: (id) => {
    const item = get().captures.find((c) => c.id === id);
    if (!item) return;
    const prev = get().source;
    const prevOut = get().output;
    if (prev && !prev.fromCaptureId) revokeQuiet(prev.objectUrl);
    revokeQuiet(prevOut?.objectUrl);
    set({
      source: {
        objectUrl: item.objectUrl,
        fileName: item.fileName,
        fileSize: item.blob.size,
        width: item.width,
        height: item.height,
        fromCaptureId: item.id,
      },
      output: null,
      error: null,
    });
    // Auto-process opened capture
    void get().process();
  },

  removeCapture: (id) => {
    const item = get().captures.find((c) => c.id === id);
    const source = get().source;
    const using = source?.fromCaptureId === id;
    if (using) {
      revokeQuiet(item?.objectUrl);
      revokeQuiet(get().output?.objectUrl);
      set((state) => ({
        captures: state.captures.filter((c) => c.id !== id),
        source: null,
        output: null,
      }));
      return;
    }
    revokeQuiet(item?.objectUrl);
    set((state) => ({ captures: state.captures.filter((c) => c.id !== id) }));
  },

  clearCaptures: () => {
    const { captures, source } = get();
    for (const item of captures) {
      if (source?.fromCaptureId === item.id) continue;
      revokeQuiet(item.objectUrl);
    }
    set({ captures: [] });
  },

  process: async () => {
    const { source, settings, benchTransform, processing } = get();
    if (!source || processing) return;
    set({ processing: true, error: null });
    try {
      const img = await loadHtmlImage(source.objectUrl);
      const activeTransform: TransformState = {
        ...benchTransform,
        cropPreset: settings.cropPreset,
        customWidth: Number.parseInt(settings.customWidth, 10) || undefined,
        customHeight: Number.parseInt(settings.customHeight, 10) || undefined,
      };

      const result = await compressImage(img, img.naturalWidth, img.naturalHeight, {
        targetBytes: settings.targetKb * 1024,
        quality: settings.quality,
        format: settings.format,
        cropPreset: settings.cropPreset,
        customWidth: Number.parseInt(settings.customWidth, 10) || undefined,
        customHeight: Number.parseInt(settings.customHeight, 10) || undefined,
        transform: activeTransform,
      });
      const prevOut = get().output;
      revokeQuiet(prevOut?.objectUrl);
      set({
        output: {
          objectUrl: URL.createObjectURL(result.blob),
          blob: result.blob,
          width: result.width,
          height: result.height,
          format: result.format,
        },
        processing: false,
      });
    } catch (err) {
      set({
        processing: false,
        error: err instanceof Error ? err.message : "Failed to process image.",
      });
    }
  },

  downloadOutput: () => {
    const { output, source } = get();
    if (!output) return;
    const ext = extFromMime(output.format);
    const base = fileStem(source?.fileName ?? "image");
    void downloadBlob(output.blob, `${base}_optimized.${ext}`);
  },

  downloadCapture: (id) => {
    const item = get().captures.find((c) => c.id === id);
    if (!item) return;
    void downloadBlob(item.blob, item.fileName);
  },

  downloadAllCaptures: () => {
    const { captures, captureSortOrder } = get();
    const sorted = sortCaptures(captures, captureSortOrder);
    if (!sorted.length) return;
    sorted.forEach((item, index) => {
      setTimeout(() => {
        void downloadBlob(item.blob, item.fileName);
      }, index * 200);
    });
  },

  setCaptureSortOrder: (order) => set({ captureSortOrder: order }),

  setSettings: (partial, autoRun = true) => {
    set((state) => ({ settings: { ...state.settings, ...partial } }));
    if (autoRun && get().source) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void get().process();
      }, 150);
    }
  },

  setBenchTransform: (partial, autoRun = true) => {
    set((state) => ({ benchTransform: { ...state.benchTransform, ...partial } }));
    if (autoRun && get().source) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void get().process();
      }, 150);
    }
  },

  resetBenchTransform: () => {
    set({ benchTransform: { ...DEFAULT_TRANSFORM } });
    if (get().source) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void get().process();
      }, 150);
    }
  },

  clearBench: () => {
    const { source, output } = get();
    if (source && !source.fromCaptureId) revokeQuiet(source.objectUrl);
    revokeQuiet(output?.objectUrl);
    set({ source: null, output: null, benchTransform: { ...DEFAULT_TRANSFORM }, error: null });
  },

  resetAll: () => {
    const { video, source, output, captures } = get();
    revokeQuiet(video?.objectUrl);
    if (source && !source.fromCaptureId) revokeQuiet(source.objectUrl);
    revokeQuiet(output?.objectUrl);
    for (const item of captures) revokeQuiet(item.objectUrl);
    set({
      video: null,
      source: null,
      captures: [],
      output: null,
      settings: { ...DEFAULT_SETTINGS },
      benchTransform: { ...DEFAULT_TRANSFORM },
      processing: false,
      error: null,
      captureSortOrder: "time-asc",
    });
  },

  setError: (message) => set({ error: message }),

  setTrimMode: (mode) => set({ trimMode: mode }),

  setTrimStart: (sec) => {
    set((state) => {
      const finalStart = sec !== null ? Math.max(0, sec) : null;
      let finalEnd = state.trimEnd;
      if (finalStart !== null && finalEnd !== null && finalStart >= finalEnd) {
        // If start surpasses end, keep start and leave end or push end
        finalEnd = null;
      }
      return { trimStart: finalStart, trimEnd: finalEnd };
    });
  },

  setTrimEnd: (sec) => {
    set((state) => {
      const finalEnd = sec !== null ? Math.max(0, sec) : null;
      let finalStart = state.trimStart;
      if (finalStart !== null && finalEnd !== null && finalEnd <= finalStart) {
        finalStart = null;
      }
      return { trimStart: finalStart, trimEnd: finalEnd };
    });
  },

  setTrimRange: (start, end) => {
    const s = start !== null ? Math.max(0, start) : null;
    const e = end !== null ? Math.max(0, end) : null;
    if (s !== null && e !== null && s >= e) {
      set({ trimStart: s, trimEnd: null });
    } else {
      set({ trimStart: s, trimEnd: e });
    }
  },

  setIncludeScreenshotFrame: (include) => set({ includeScreenshotFrame: include }),

  setPreviewTrimMode: (preview) => set({ previewTrimMode: preview }),

  setExportConfig: (partial) =>
    set((state) => ({ exportConfig: { ...state.exportConfig, ...partial } })),

  applyScreenshotToTrim: (captureId, target, includeFrameOverride) => {
    const { captures, includeScreenshotFrame, trimStart, trimEnd } = get();
    const item = captures.find((c) => c.id === captureId);
    if (!item) return { start: trimStart, end: trimEnd };

    const include =
      typeof includeFrameOverride === "boolean"
        ? includeFrameOverride
        : includeScreenshotFrame;

    // Approximate frame duration ~33.3ms (1/30fps)
    const frameDelta = 0.0333;
    let nextStart = trimStart;
    let nextEnd = trimEnd;

    if (target === "start") {
      if (include) {
        // Included: starts exactly at screenshot timestamp
        nextStart = item.timestampSec;
      } else {
        // Excluded (default): starts after the screenshot frame
        nextStart = item.timestampSec + frameDelta;
      }
      if (nextEnd !== null && nextStart >= nextEnd) {
        nextEnd = null;
      }
    } else {
      if (include) {
        // Included: ends at or right after screenshot timestamp
        nextEnd = item.timestampSec;
      } else {
        // Excluded (default): ends before the screenshot frame
        nextEnd = Math.max(0, item.timestampSec - 0.001);
      }
      if (nextStart !== null && nextEnd <= nextStart) {
        nextStart = null;
      }
    }

    set({ trimStart: nextStart, trimEnd: nextEnd });
    return { start: nextStart, end: nextEnd };
  },

  clearTrimRange: () => set({ trimStart: null, trimEnd: null }),
}));
