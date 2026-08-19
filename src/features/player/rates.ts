export const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const;

export function nextRate(current: number, dir: 1 | -1): number {
  const idx = PLAYBACK_RATES.findIndex((r) => r === current);
  const i = idx === -1 ? PLAYBACK_RATES.indexOf(1) : idx;
  return PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, Math.max(0, i + dir))] ?? 1;
}

export const FRAME_STEP = 1 / 30;
