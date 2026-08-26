export const PLAYBACK_RATES = [
  0.1,
  0.25,
  0.5,
  0.6,
  0.65,
  0.7,
  0.75,
  0.8,
  0.85,
  0.9,
  0.95,
  1.0,
  1.05,
  1.1,
  1.15,
  1.2,
  1.25,
  1.3,
  1.35,
  1.4,
  1.5,
  1.75,
  2.0,
  2.5,
  3.0,
  4.0,
] as const;

export const COMMON_PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

export const PLAYBACK_RATE_MIN = 0.1;
export const PLAYBACK_RATE_MAX = 16.0;
export const PLAYBACK_RATE_SLIDER_MAX = 4.0;
export const PLAYBACK_RATE_DEFAULT = 1.0;

export interface SpeedPreset {
  value: number;
  label: string;
  category: "slow" | "normal" | "fast";
}

export interface SpeedOption {
  value: number;
  label: string;
  shortLabel: string;
  category?: "slow" | "normal" | "fast";
}

export const SPEED_PRESETS: SpeedPreset[] = [
  { value: 0.1, label: "0.1×", category: "slow" },
  { value: 0.25, label: "0.25×", category: "slow" },
  { value: 0.5, label: "0.5×", category: "slow" },
  { value: 0.6, label: "0.6×", category: "slow" },
  { value: 0.65, label: "0.65×", category: "slow" },
  { value: 0.7, label: "0.7×", category: "slow" },
  { value: 0.75, label: "0.75×", category: "slow" },
  { value: 0.8, label: "0.8×", category: "slow" },
  { value: 0.85, label: "0.85×", category: "slow" },
  { value: 0.9, label: "0.9×", category: "slow" },
  { value: 0.95, label: "0.95×", category: "slow" },
  { value: 1.0, label: "1.0×", category: "normal" },
  { value: 1.05, label: "1.05×", category: "fast" },
  { value: 1.1, label: "1.1×", category: "fast" },
  { value: 1.15, label: "1.15×", category: "fast" },
  { value: 1.2, label: "1.2×", category: "fast" },
  { value: 1.25, label: "1.25×", category: "fast" },
  { value: 1.3, label: "1.3×", category: "fast" },
  { value: 1.35, label: "1.35×", category: "fast" },
  { value: 1.4, label: "1.4×", category: "fast" },
  { value: 1.5, label: "1.5×", category: "fast" },
  { value: 1.75, label: "1.75×", category: "fast" },
  { value: 2.0, label: "2.0×", category: "fast" },
  { value: 2.5, label: "2.5×", category: "fast" },
  { value: 3.0, label: "3.0×", category: "fast" },
  { value: 4.0, label: "4.0×", category: "fast" },
];

export const SPEED_DROPDOWN_OPTIONS: SpeedOption[] = [
  { value: 4.0, label: "4.0× (Maximum Turbo)", shortLabel: "4.0×", category: "fast" },
  { value: 3.0, label: "3.0× (Triple Speed)", shortLabel: "3.0×", category: "fast" },
  { value: 2.5, label: "2.5× (Fast Forward)", shortLabel: "2.5×", category: "fast" },
  { value: 2.0, label: "2.0× (Double Speed)", shortLabel: "2.0×", category: "fast" },
  { value: 1.75, label: "1.75× Speed", shortLabel: "1.75×", category: "fast" },
  { value: 1.5, label: "1.5× Speed", shortLabel: "1.5×", category: "fast" },
  { value: 1.4, label: "1.4× Speed", shortLabel: "1.4×", category: "fast" },
  { value: 1.35, label: "1.35× Speed", shortLabel: "1.35×", category: "fast" },
  { value: 1.3, label: "1.3× Speed", shortLabel: "1.3×", category: "fast" },
  { value: 1.25, label: "1.25× Speed", shortLabel: "1.25×", category: "fast" },
  { value: 1.2, label: "1.2× Speed", shortLabel: "1.2×", category: "fast" },
  { value: 1.15, label: "1.15× Speed", shortLabel: "1.15×", category: "fast" },
  { value: 1.1, label: "1.1× Speed", shortLabel: "1.1×", category: "fast" },
  { value: 1.05, label: "1.05× Speed", shortLabel: "1.05×", category: "fast" },
  { value: 1.0, label: "1.0× (Normal Speed)", shortLabel: "1.0×", category: "normal" },
  { value: 0.95, label: "0.95× Speed", shortLabel: "0.95×", category: "slow" },
  { value: 0.9, label: "0.9× Speed", shortLabel: "0.9×", category: "slow" },
  { value: 0.85, label: "0.85× Speed", shortLabel: "0.85×", category: "slow" },
  { value: 0.8, label: "0.8× Speed", shortLabel: "0.8×", category: "slow" },
  { value: 0.75, label: "0.75× Speed", shortLabel: "0.75×", category: "slow" },
  { value: 0.7, label: "0.7× Speed", shortLabel: "0.7×", category: "slow" },
  { value: 0.65, label: "0.65× Speed", shortLabel: "0.65×", category: "slow" },
  { value: 0.6, label: "0.6× Speed", shortLabel: "0.6×", category: "slow" },
  { value: 0.5, label: "0.5× (Half Speed / Slow-Mo)", shortLabel: "0.5×", category: "slow" },
  { value: 0.25, label: "0.25× (Quarter Speed)", shortLabel: "0.25×", category: "slow" },
  { value: 0.1, label: "0.1× (Ultra Slow-Mo)", shortLabel: "0.1×", category: "slow" },
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

