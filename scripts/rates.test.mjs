import assert from "node:assert/strict";
import { test } from "node:test";

const PLAYBACK_RATES = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const PLAYBACK_RATE_MIN = 0.1;
const PLAYBACK_RATE_MAX = 16.0;
const PLAYBACK_RATE_SLIDER_MAX = 4.0;
const PLAYBACK_RATE_DEFAULT = 1.0;

function clampRate(rate, min = PLAYBACK_RATE_MIN, max = PLAYBACK_RATE_MAX) {
  if (Number.isNaN(rate) || !Number.isFinite(rate)) return PLAYBACK_RATE_DEFAULT;
  const rounded = Math.round(rate * 100) / 100;
  return Math.min(max, Math.max(min, rounded));
}

function nudgeRate(current, delta) {
  return clampRate(current + delta);
}

function nextRate(current, dir) {
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

test("Playback rate constants and bounds", () => {
  assert.equal(PLAYBACK_RATE_MIN, 0.1);
  assert.equal(PLAYBACK_RATE_MAX, 16.0);
  assert.equal(PLAYBACK_RATE_SLIDER_MAX, 4.0);
  assert.equal(PLAYBACK_RATE_DEFAULT, 1.0);
  assert.ok(PLAYBACK_RATES.includes(1.0), "Default 1.0 must be in presets");
  assert.ok(PLAYBACK_RATES.includes(0.1), "0.1 slow-mo must be in presets");
  assert.ok(PLAYBACK_RATES.includes(4.0), "4.0 high-speed must be in presets");
  
  // Sorted in ascending order
  const sorted = [...PLAYBACK_RATES].sort((a, b) => a - b);
  assert.deepEqual([...PLAYBACK_RATES], sorted);
});

test("clampRate correctly constrains and normalizes values", () => {
  assert.equal(clampRate(1.0), 1.0);
  assert.equal(clampRate(0.05), 0.1, "Clamps to min");
  assert.equal(clampRate(-2), 0.1, "Negative values clamp to min");
  assert.equal(clampRate(20), 16.0, "Values above max clamp to max");
  assert.equal(clampRate(1.2345), 1.23, "Rounds to two decimal places");
  assert.equal(clampRate(NaN), 1.0, "NaN falls back to default");
  assert.equal(clampRate(Infinity), 1.0, "Infinity falls back to default");
});

test("nudgeRate performs fine-grained increments and decrements", () => {
  assert.equal(nudgeRate(1.0, 0.05), 1.05);
  assert.equal(nudgeRate(1.0, -0.05), 0.95);
  assert.equal(nudgeRate(1.0, 0.1), 1.1);
  assert.equal(nudgeRate(1.0, -0.1), 0.9);
  assert.equal(nudgeRate(0.1, -0.05), 0.1, "Cannot nudge below min");
  assert.equal(nudgeRate(16.0, 0.1), 16.0, "Cannot nudge above max");
});

test("nextRate steps correctly across presets", () => {
  // Step up from 1.0
  assert.equal(nextRate(1.0, 1), 1.25);
  // Step down from 1.0
  assert.equal(nextRate(1.0, -1), 0.75);
  // Step up from intermediate rate 1.15
  assert.equal(nextRate(1.15, 1), 1.25);
  // Step down from intermediate rate 1.15
  assert.equal(nextRate(1.15, -1), 1.0);
  // Upper boundary
  assert.equal(nextRate(4.0, 1), 4.0);
  // Lower boundary
  assert.equal(nextRate(0.1, -1), 0.1);
});
