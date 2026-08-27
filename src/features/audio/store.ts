import { create } from "zustand";
import { toast } from "sonner";
import { fileStem } from "@/features/media/format";
import { revokeQuiet } from "@/features/media/object-url";
import {
  audioBufferToWavBlob,
  computeWaveformPeaks,
  decodeAudioBlob,
  extractAudioFromVideoUrl,
  renderProcessedAudioOffline,
  type WaveformPeaks,
} from "./audio-engine";
import { encodeAudioBuffer } from "./audio-exporter";
import type {
  AudioExportConfig,
  AudioExportProgress,
  AudioExportResult,
  AudioSession,
  AudioTrimMode,
  AudioVisualizerMode,
  CuePoint,
  DynamicsSettings,
  EqBands,
  FilterSettings,
  PhosphorTheme,
} from "./types";

export const DEFAULT_EQ: EqBands = {
  low80Hz: 0,
  lowMid300Hz: 0,
  mid1kHz: 0,
  highMid3kHz: 0,
  high10kHz: 0,
};

export const DEFAULT_LOW_CUT: FilterSettings = {
  enabled: false,
  frequency: 80,
  q: 1.0,
};

export const DEFAULT_HIGH_CUT: FilterSettings = {
  enabled: false,
  frequency: 12000,
  q: 1.0,
};

export const DEFAULT_DYNAMICS: DynamicsSettings = {
  enabled: false,
  threshold: -24,
  ratio: 4,
  attack: 0.01,
  release: 0.25,
  knee: 10,
  makeupGain: 0,
};

export const DEFAULT_AUDIO_EXPORT_CONFIG: AudioExportConfig = {
  format: "mp3",
  sampleRate: 48000,
  channels: 2,
  bitDepth: 16,
  bitrateKbps: 256,
  normalize: "peak-0db",
  fadeInSec: 0,
  fadeOutSec: 0,
  applyEq: true,
  applyDynamics: true,
  exportRangeOnly: true,
  applyPlaybackSpeed: true,
};

export interface AudioState {
  audio: AudioSession | null;
  peaks: WaveformPeaks | null;
  ready: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  gainBoost: number;
  muted: boolean;
  rate: number;
  pitchPreserve: boolean;
  pan: number;
  loop: boolean;
  loopRange: boolean;
  isSeeking: boolean;
  error: string | null;
  isExtracting: boolean;

  // Trim state
  trimMode: AudioTrimMode;
  trimStart: number | null;
  trimEnd: number | null;
  previewTrimMode: boolean;

  // DSP Tone Controls
  eq: EqBands;
  eqBypass: boolean;
  lowCut: FilterSettings;
  highCut: FilterSettings;
  dynamics: DynamicsSettings;
  dynamicsBypass: boolean;
  invertPhase: boolean;
  monoSum: boolean;

  // Cue Points
  cuePoints: CuePoint[];

  // Waveform / UI Visuals
  visualizerMode: AudioVisualizerMode;
  phosphorTheme: PhosphorTheme;
  zoom: number; // 1 to 16
  panOffset: number; // 0 to 1

  // Export State
  exportConfig: AudioExportConfig;
  isExporting: boolean;
  exportProgress: number;
  exportProgressData: AudioExportProgress | null;
  exportResult: AudioExportResult | null;

  // Actions
  loadAudioFile: (file: File) => Promise<void>;
  extractFromVideoSession: (videoUrl: string, fileName: string) => Promise<void>;
  clearAudio: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setGainBoost: (gain: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setRate: (rate: number) => void;
  setPitchPreserve: (preserve: boolean) => void;
  setPan: (pan: number) => void;
  setLoop: (loop: boolean) => void;
  toggleLoop: () => void;
  setLoopRange: (loop: boolean) => void;
  toggleLoopRange: () => void;
  setTrimMode: (mode: AudioTrimMode) => void;
  setTrimStart: (sec: number | null) => void;
  setTrimEnd: (sec: number | null) => void;
  setTrimRange: (start: number | null, end: number | null) => void;
  clearTrimRange: () => void;
  setPreviewTrimMode: (preview: boolean) => void;

  // DSP actions
  setEqBand: (band: keyof EqBands, val: number) => void;
  setEqBypass: (bypass: boolean) => void;
  resetEq: () => void;
  setLowCut: (partial: Partial<FilterSettings>) => void;
  setHighCut: (partial: Partial<FilterSettings>) => void;
  setDynamics: (partial: Partial<DynamicsSettings>) => void;
  setDynamicsBypass: (bypass: boolean) => void;
  setInvertPhase: (invert: boolean) => void;
  setMonoSum: (mono: boolean) => void;
  resetAllDsp: () => void;

  // Cue Points actions
  addCuePoint: (timestampSec?: number, label?: string) => void;
  removeCuePoint: (id: string) => void;
  updateCuePoint: (id: string, partial: Partial<CuePoint>) => void;
  clearCuePoints: () => void;

  // Visualizer actions
  setVisualizerMode: (mode: AudioVisualizerMode) => void;
  setPhosphorTheme: (theme: PhosphorTheme) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: number) => void;

  // Export Actions
  setExportConfig: (partial: Partial<AudioExportConfig>) => void;
  setExportProgressData: (data: AudioExportProgress | null) => void;
  setExportResult: (result: AudioExportResult | null) => void;
  cancelExport: () => void;
  exportAudio: (overrideOptions?: Partial<AudioExportConfig>) => Promise<void>;
  exportCueSlice: (cue: CuePoint, nextCue?: CuePoint) => Promise<void>;
  setError: (err: string | null) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audio: null,
  peaks: null,
  ready: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0,
  gainBoost: 1.0,
  muted: false,
  rate: 1.0,
  pitchPreserve: true,
  pan: 0,
  loop: false,
  loopRange: false,
  isSeeking: false,
  error: null,
  isExtracting: false,

  trimMode: "trim",
  trimStart: null,
  trimEnd: null,
  previewTrimMode: false,

  eq: { ...DEFAULT_EQ },
  eqBypass: false,
  lowCut: { ...DEFAULT_LOW_CUT },
  highCut: { ...DEFAULT_HIGH_CUT },
  dynamics: { ...DEFAULT_DYNAMICS },
  dynamicsBypass: false,
  invertPhase: false,
  monoSum: false,

  cuePoints: [],

  visualizerMode: "waveform",
  phosphorTheme: "green",
  zoom: 1,
  panOffset: 0,

  exportConfig: { ...DEFAULT_AUDIO_EXPORT_CONFIG },
  isExporting: false,
  exportProgress: 0,
  exportProgressData: null,
  exportResult: null,

  loadAudioFile: async (file: File) => {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      set({ error: "Please provide a valid audio file (.mp3, .wav, .aac, .ogg, .flac, .m4a)." });
      return;
    }
    set({ isExtracting: true, error: null });
    const prev = get().audio;
    revokeQuiet(prev?.objectUrl);

    try {
      const objectUrl = URL.createObjectURL(file);
      const buffer = await decodeAudioBlob(file);
      const peaks = computeWaveformPeaks(buffer, 1200);

      set({
        audio: {
          objectUrl,
          blob: file,
          fileName: file.name,
          fileSize: file.size,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          numberOfChannels: buffer.numberOfChannels,
          audioBuffer: buffer,
          sourceType: "uploaded",
        },
        peaks,
        ready: true,
        duration: buffer.duration,
        currentTime: 0,
        playing: false,
        trimStart: null,
        trimEnd: null,
        isExtracting: false,
        error: null,
      });
      toast.success(`Loaded audio: ${file.name}`);
    } catch (err) {
      set({
        isExtracting: false,
        error: err instanceof Error ? err.message : "Failed to decode audio file.",
      });
      toast.error("Could not parse audio track");
    }
  },

  extractFromVideoSession: async (videoUrl: string, videoFileName: string) => {
    set({ isExtracting: true, error: null });
    const prev = get().audio;
    revokeQuiet(prev?.objectUrl);

    try {
      const buffer = await extractAudioFromVideoUrl(videoUrl);
      const peaks = computeWaveformPeaks(buffer, 1200);
      const wavBlob = audioBufferToWavBlob(buffer, 16);
      const objectUrl = URL.createObjectURL(wavBlob);
      const audioName = `${fileStem(videoFileName)}_audio.wav`;

      set({
        audio: {
          objectUrl,
          blob: wavBlob,
          fileName: audioName,
          fileSize: wavBlob.size,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          numberOfChannels: buffer.numberOfChannels,
          audioBuffer: buffer,
          sourceType: "extracted-video",
          extractedFromVideoName: videoFileName,
        },
        peaks,
        ready: true,
        duration: buffer.duration,
        currentTime: 0,
        playing: false,
        trimStart: null,
        trimEnd: null,
        isExtracting: false,
        error: null,
      });
      toast.success(`Extracted audio from video: ${videoFileName}`);
    } catch (err) {
      set({
        isExtracting: false,
        error: err instanceof Error ? err.message : "Failed to extract audio from video.",
      });
      toast.error("Could not extract audio track from video");
    }
  },

  clearAudio: () => {
    const prev = get().audio;
    revokeQuiet(prev?.objectUrl);
    set({
      audio: null,
      peaks: null,
      ready: false,
      playing: false,
      currentTime: 0,
      duration: 0,
      trimStart: null,
      trimEnd: null,
      cuePoints: [],
      error: null,
    });
  },

  setPlaying: (playing) => set({ playing }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setGainBoost: (gainBoost) => set({ gainBoost }),
  setMuted: (muted) => set({ muted }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setRate: (rate) => set({ rate }),
  setPitchPreserve: (pitchPreserve) => set({ pitchPreserve }),
  setPan: (pan) => set({ pan }),
  setLoop: (loop) => set({ loop, loopRange: loop }),
  toggleLoop: () => set((s) => ({ loop: !s.loop, loopRange: !s.loop })),
  setLoopRange: (loopRange) => set({ loop: loopRange, loopRange }),
  toggleLoopRange: () => set((s) => ({ loop: !s.loopRange, loopRange: !s.loopRange })),

  setTrimMode: (trimMode) => set({ trimMode }),
  setTrimStart: (sec) => {
    set((state) => {
      const finalStart = sec !== null ? Math.max(0, sec) : null;
      let finalEnd = state.trimEnd;
      if (finalStart !== null && finalEnd !== null && finalStart >= finalEnd) {
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
  clearTrimRange: () => set({ trimStart: null, trimEnd: null }),
  setPreviewTrimMode: (previewTrimMode) => set({ previewTrimMode }),

  setEqBand: (band, val) =>
    set((s) => ({ eq: { ...s.eq, [band]: Math.max(-12, Math.min(12, val)) } })),
  setEqBypass: (eqBypass) => set({ eqBypass }),
  resetEq: () => set({ eq: { ...DEFAULT_EQ } }),

  setLowCut: (partial) => set((s) => ({ lowCut: { ...s.lowCut, ...partial } })),
  setHighCut: (partial) => set((s) => ({ highCut: { ...s.highCut, ...partial } })),
  setDynamics: (partial) => set((s) => ({ dynamics: { ...s.dynamics, ...partial } })),
  setDynamicsBypass: (dynamicsBypass) => set({ dynamicsBypass }),
  setInvertPhase: (invertPhase) => set({ invertPhase }),
  setMonoSum: (monoSum) => set({ monoSum }),

  resetAllDsp: () =>
    set({
      eq: { ...DEFAULT_EQ },
      eqBypass: false,
      lowCut: { ...DEFAULT_LOW_CUT },
      highCut: { ...DEFAULT_HIGH_CUT },
      dynamics: { ...DEFAULT_DYNAMICS },
      dynamicsBypass: false,
      gainBoost: 1.0,
      invertPhase: false,
      monoSum: false,
    }),

  addCuePoint: (timestampSec, label) => {
    const time = timestampSec !== undefined ? timestampSec : get().currentTime;
    const count = get().cuePoints.length + 1;
    const cue: CuePoint = {
      id: `cue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestampSec: Math.max(0, Math.min(get().duration, time)),
      label: label || `Marker #${count}`,
      createdAt: Date.now(),
    };
    set((s) => ({
      cuePoints: [...s.cuePoints, cue].sort((a, b) => a.timestampSec - b.timestampSec),
    }));
    toast.success(`Added Cue Marker @ ${time.toFixed(2)}s`);
  },

  removeCuePoint: (id) =>
    set((s) => ({ cuePoints: s.cuePoints.filter((c) => c.id !== id) })),

  updateCuePoint: (id, partial) =>
    set((s) => ({
      cuePoints: s.cuePoints.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    })),

  clearCuePoints: () => set({ cuePoints: [] }),

  setVisualizerMode: (visualizerMode) => set({ visualizerMode }),
  setPhosphorTheme: (phosphorTheme) => set({ phosphorTheme }),
  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(16, zoom)) }),
  setPanOffset: (panOffset) => set({ panOffset: Math.max(0, Math.min(1, panOffset)) }),

  setExportConfig: (partial) =>
    set((s) => ({ exportConfig: { ...s.exportConfig, ...partial } })),

  setExportProgressData: (exportProgressData) => set({ exportProgressData }),
  setExportResult: (exportResult) => set({ exportResult }),
  cancelExport: () => {
    set({ isExporting: false, exportProgress: 0, exportProgressData: null });
    toast.info("Audio export cancelled");
  },

  exportAudio: async (overrideOptions) => {
    const {
      audio,
      rate,
      pitchPreserve,
      trimMode,
      trimStart,
      trimEnd,
      eq,
      eqBypass,
      lowCut,
      highCut,
      dynamics,
      dynamicsBypass,
      gainBoost,
      invertPhase,
      monoSum,
      exportConfig,
    } = get();

    if (!audio?.audioBuffer) {
      toast.error("No audio loaded to export");
      return;
    }

    const cfg = { ...exportConfig, ...overrideOptions };
    const effectiveRate = cfg.applyPlaybackSpeed !== false ? (cfg.playbackRate ?? rate) : 1.0;
    const effectivePitchPreserve =
      cfg.applyPlaybackSpeed !== false ? (cfg.pitchPreserve ?? pitchPreserve) : true;
    const useRange = cfg.exportRangeOnly && (trimStart !== null || trimEnd !== null);
    const effectiveTrimStart = useRange ? trimStart : null;
    const effectiveTrimEnd = useRange ? trimEnd : null;

    const startTime = performance.now();
    set({
      isExporting: true,
      exportProgress: 5,
      exportResult: null,
      exportProgressData: {
        percent: 5,
        stage: "dsp",
        message: "Rendering DSP Audio & Tone Curves...",
        elapsedSec: 0,
        estimatedRemainingSec: 2,
        speedMultiplier: effectiveRate,
        channels: cfg.channels,
        sampleRate: cfg.sampleRate,
        format: cfg.format.toUpperCase(),
      },
    });

    try {
      const renderedBuffer = await renderProcessedAudioOffline({
        sourceBuffer: audio.audioBuffer,
        trimMode,
        trimStart: effectiveTrimStart,
        trimEnd: effectiveTrimEnd,
        eq,
        applyEq: !eqBypass && cfg.applyEq,
        lowCut,
        highCut,
        dynamics,
        applyDynamics: !dynamicsBypass && cfg.applyDynamics,
        gainBoost,
        fadeInSec: cfg.fadeInSec,
        fadeOutSec: cfg.fadeOutSec,
        normalize: cfg.normalize,
        invertPhase,
        monoSum,
        targetChannels: cfg.channels,
        targetSampleRate: cfg.sampleRate,
        playbackRate: effectiveRate,
        pitchPreserve: effectivePitchPreserve,
      });

      const elapsedMid = Math.max(0.1, (performance.now() - startTime) / 1000);
      const isStretching = Math.abs(effectiveRate - 1.0) >= 0.01;

      set({
        exportProgress: 50,
        exportProgressData: {
          percent: 50,
          stage: isStretching ? "timestretch" : "encoding",
          message: isStretching
            ? `WSOLA Time-Stretching (${effectiveRate}× speed)...`
            : `Encoding ${cfg.format.toUpperCase()} bitstream...`,
          elapsedSec: Math.round(elapsedMid * 10) / 10,
          estimatedRemainingSec: Math.max(0.5, Math.round(elapsedMid * 0.8 * 10) / 10),
          speedMultiplier: effectiveRate,
          channels: cfg.channels,
          sampleRate: cfg.sampleRate,
          format: cfg.format.toUpperCase(),
        },
      });

      const encoded = await encodeAudioBuffer(renderedBuffer, cfg, (progress) => {
        const currentPercent = Math.min(99, 50 + Math.round(progress * 0.49));
        const elapsed = Math.max(0.1, (performance.now() - startTime) / 1000);
        const remaining =
          currentPercent > 5
            ? Math.max(0.2, Math.round(((elapsed / (currentPercent / 100)) - elapsed) * 10) / 10)
            : 1;

        set({
          exportProgress: currentPercent,
          exportProgressData: {
            percent: currentPercent,
            stage: "encoding",
            message: `Encoding ${cfg.format.toUpperCase()} bitstream (${Math.round(progress * 100)}%)...`,
            elapsedSec: Math.round(elapsed * 10) / 10,
            estimatedRemainingSec: remaining,
            speedMultiplier: effectiveRate,
            channels: cfg.channels,
            sampleRate: cfg.sampleRate,
            format: cfg.format.toUpperCase(),
          },
        });
      });

      const baseName = fileStem(audio.fileName);
      const modeSuffix = useRange ? `_${trimMode}` : "_master";
      const speedSuffix =
        Math.abs(effectiveRate - 1.0) >= 0.01
          ? `_${effectiveRate}x${effectivePitchPreserve ? "" : "_tape"}`
          : "";
      const outFileName = `${baseName}${modeSuffix}${speedSuffix}.${encoded.extension}`;

      const totalElapsed = Math.max(0.1, (performance.now() - startTime) / 1000);

      const result: AudioExportResult = {
        blob: encoded.blob,
        fileName: outFileName,
        fileSize: encoded.blob.size,
        format: encoded.extension.toUpperCase(),
        sampleRate: cfg.sampleRate,
        channels: cfg.channels,
        bitDepth: cfg.format === "wav" ? cfg.bitDepth : undefined,
        bitrateKbps: cfg.format !== "wav" ? cfg.bitrateKbps : undefined,
        durationSec: renderedBuffer.duration,
        speedMultiplier: effectiveRate,
        pitchPreserve: effectivePitchPreserve,
        normalize: cfg.normalize,
        applyEq: cfg.applyEq && !eqBypass,
        applyDynamics: cfg.applyDynamics && !dynamicsBypass,
      };

      set({
        isExporting: false,
        exportProgress: 100,
        exportProgressData: {
          percent: 100,
          stage: "complete",
          message: "Render & Encoding Complete",
          elapsedSec: Math.round(totalElapsed * 10) / 10,
          estimatedRemainingSec: 0,
          speedMultiplier: effectiveRate,
          channels: cfg.channels,
          sampleRate: cfg.sampleRate,
          format: cfg.format.toUpperCase(),
        },
        exportResult: result,
      });

      if (encoded.fallbackOccurred) {
        toast.warning(
          `Browser does not support ${encoded.originalFormat?.toUpperCase()} encoding. Exported as lossless WAV (${outFileName}) instead.`,
          { duration: 6000 },
        );
      } else {
        toast.success(`Export succeeded! Ready to download: ${outFileName}`);
      }
    } catch (err) {
      set({
        isExporting: false,
        exportProgress: 0,
        exportProgressData: null,
        exportResult: null,
      });
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  },

  exportCueSlice: async (cue, nextCue) => {
    const {
      audio,
      rate,
      pitchPreserve,
      eq,
      eqBypass,
      lowCut,
      highCut,
      dynamics,
      dynamicsBypass,
      gainBoost,
      invertPhase,
      monoSum,
      exportConfig,
    } = get();
    if (!audio?.audioBuffer) return;

    const startSec = cue.timestampSec;
    const endSec = nextCue ? nextCue.timestampSec : audio.duration;
    if (endSec <= startSec) return;

    const effectiveRate = exportConfig.applyPlaybackSpeed !== false ? rate : 1.0;
    const effectivePitchPreserve =
      exportConfig.applyPlaybackSpeed !== false ? pitchPreserve : true;

    set({ isExporting: true, exportProgress: 10, exportResult: null });
    try {
      const renderedBuffer = await renderProcessedAudioOffline({
        sourceBuffer: audio.audioBuffer,
        trimMode: "trim",
        trimStart: startSec,
        trimEnd: endSec,
        eq,
        applyEq: !eqBypass,
        lowCut,
        highCut,
        dynamics,
        applyDynamics: !dynamicsBypass,
        gainBoost,
        fadeInSec: 0.01,
        fadeOutSec: 0.01,
        normalize: "peak-0db",
        invertPhase,
        monoSum,
        targetChannels: exportConfig.channels,
        targetSampleRate: exportConfig.sampleRate,
        playbackRate: effectiveRate,
        pitchPreserve: effectivePitchPreserve,
      });

      set({ exportProgress: 50 });

      const encoded = await encodeAudioBuffer(renderedBuffer, exportConfig, (progress) => {
        set({ exportProgress: Math.min(99, 50 + Math.round(progress * 0.49)) });
      });

      const safeLabel = cue.label.replace(/[^a-zA-Z0-9_-]/g, "_");
      const speedSuffix =
        Math.abs(effectiveRate - 1.0) >= 0.01
          ? `_${effectiveRate}x${effectivePitchPreserve ? "" : "_tape"}`
          : "";
      const outFileName = `${fileStem(audio.fileName)}_${safeLabel}${speedSuffix}.${encoded.extension}`;

      const result: AudioExportResult = {
        blob: encoded.blob,
        fileName: outFileName,
        fileSize: encoded.blob.size,
        format: encoded.extension.toUpperCase(),
        sampleRate: exportConfig.sampleRate,
        channels: exportConfig.channels,
        bitDepth: exportConfig.format === "wav" ? exportConfig.bitDepth : undefined,
        bitrateKbps: exportConfig.format !== "wav" ? exportConfig.bitrateKbps : undefined,
        durationSec: renderedBuffer.duration,
        speedMultiplier: effectiveRate,
        pitchPreserve: effectivePitchPreserve,
        normalize: "peak-0db",
        applyEq: !eqBypass,
        applyDynamics: !dynamicsBypass,
      };

      set({
        isExporting: false,
        exportProgress: 100,
        exportProgressData: null,
        exportResult: result,
      });

      if (encoded.fallbackOccurred) {
        toast.warning(
          `Browser does not support ${encoded.originalFormat?.toUpperCase()} encoding. Exported slice as lossless WAV (${outFileName}) instead.`,
          { duration: 6000 },
        );
      } else {
        toast.success(`Exported slice: ${outFileName}. Click Save to download.`);
      }
    } catch (err) {
      set({
        isExporting: false,
        exportProgress: 0,
        exportProgressData: null,
        exportResult: null,
      });
      toast.error(err instanceof Error ? err.message : "Failed to export slice");
    }
  },

  setError: (err) => set({ error: err }),
}));
