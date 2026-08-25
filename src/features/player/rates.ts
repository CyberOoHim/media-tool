export const PLAYBACK_RATES = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4] as const;

export const PLAYBACK_RATE_MIN = 0.1;
export const PLAYBACK_RATE_MAX = 16.0;
export const PLAYBACK_RATE_SLIDER_MAX = 4.0;
export const PLAYBACK_RATE_DEFAULT = 1.0;

export interface SpeedPreset {
  value: number;
  label: string;
  category: "slow" | "normal" | "fast";
}

export const SPEED_PRESETS: SpeedPreset[] = [
  { value: 0.1, label: "0.1×", category: "slow" },
  { value: 0.25, label: "0.25×", category: "slow" },
  { value: 0.5, label: "0.5×", category: "slow" },
  { value: 0.75, label: "0.75×", category: "slow" },
  { value: 0.9, label: "0.9×", category: "slow" },
  { value: 1.0, label: "1.0×", category: "normal" },
  { value: 1.1, label: "1.1×", category: "fast" },
  { value: 1.25, label: "1.25×", category: "fast" },
  { value: 1.5, label: "1.5×", category: "fast" },
  { value: 1.75, label: "1.75×", category: "fast" },
  { value: 2.0, label: "2.0×", category: "fast" },
  { value: 2.5, label: "2.5×", category: "fast" },
  { value: 3.0, label: "3.0×", category: "fast" },
  { value: 4.0, label: "4.0×", category: "fast" },
];

export function clampRate(rate: number, min = PLAYBACK_RATE_MIN, max = PLAYBACK_RATE_MAX): number {
  if (Number.isNaN(rate) || !Number.isFinite(rate)) return PLAYBACK_RATE_DEFAULT;
  const rounded = Math.round(rate * 100) / 100;
  return Math.min(max, Math.max(min, rounded));
}

export function nudgeRate(current: number, delta: number): number {
  return clampRate(current + delta);
}

export function nextRate(current: number, dir: 1 | -1): number {
  const currentClamped = clampRate(current);
  if (dir === 1) {
    const next = PLAYBACK_RATES.find((r) => r > currentClamped + 0.001);
    return next ?? PLAYBACK_RATES[PLAYBACK_RATES.length - 1];
  } else {
    const reversed = [...PLAYBACK_RATES].reverse();
    const prev = reversed.find((r) => r < currentClamped - 0.001);
    return prev ?? PLAYBACK_RATES[0];
  }
}

export const FRAME_STEP = 1 / 30;

