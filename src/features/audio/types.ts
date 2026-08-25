export type AudioSourceType = "uploaded" | "extracted-video";

export interface AudioSession {
  objectUrl: string;
  blob?: Blob;
  fileName: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  audioBuffer: AudioBuffer | null;
  sourceType: AudioSourceType;
  extractedFromVideoName?: string;
}

export type AudioTrimMode = "trim" | "cut";

export interface EqBands {
  low80Hz: number; // dB (-12 to +12)
  lowMid300Hz: number; // dB (-12 to +12)
  mid1kHz: number; // dB (-12 to +12)
  highMid3kHz: number; // dB (-12 to +12)
  high10kHz: number; // dB (-12 to +12)
}

export interface FilterSettings {
  enabled: boolean;
  frequency: number; // Hz
  q: number; // Resonance
}

export interface DynamicsSettings {
  enabled: boolean;
  threshold: number; // dB (-60 to 0)
  ratio: number; // (1 to 20)
  attack: number; // s (0.001 to 0.1)
  release: number; // s (0.05 to 1.0)
  knee: number; // dB (0 to 40)
  makeupGain: number; // dB (0 to 24)
}

export interface CuePoint {
  id: string;
  timestampSec: number;
  label: string;
  createdAt: number;
  color?: string;
}

export type AudioExportFormat = "wav" | "mp3" | "aac" | "webm" | "ogg";
export type AudioBitDepth = 16 | 24 | 32;
export type AudioNormalizeMode = "none" | "peak-0db" | "peak-1db" | "ebu-r128";

export interface AudioExportConfig {
  format: AudioExportFormat;
  sampleRate: number; // 44100 | 48000
  channels: 1 | 2; // Mono | Stereo
  bitDepth: AudioBitDepth; // for WAV
  bitrateKbps: number; // 128 | 192 | 256 | 320 for compressed
  normalize: AudioNormalizeMode;
  fadeInSec: number; // 0 - 10s
  fadeOutSec: number; // 0 - 10s
  applyEq: boolean;
  applyDynamics: boolean;
  exportRangeOnly: boolean; // if true, uses [trimStart, trimEnd]
}

export type AudioVisualizerMode = "waveform" | "spectrum" | "oscilloscope" | "stereo-split";
export type PhosphorTheme = "green" | "cyan" | "amber" | "matrix";
