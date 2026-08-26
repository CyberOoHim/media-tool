import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMMON_PLAYBACK_RATES,
  PLAYBACK_RATES,
  PLAYBACK_RATE_DEFAULT,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_SLIDER_MAX,
  SPEED_DROPDOWN_OPTIONS,
  SPEED_PRESETS,
  clampRate,
  nextRate,
  nudgeRate,
} from "../src/features/player/rates.ts";

test("Playback rate constants and bounds", () => {
  assert.equal(PLAYBACK_RATE_MIN, 0.1);
  assert.equal(PLAYBACK_RATE_MAX, 16.0);
  assert.equal(PLAYBACK_RATE_SLIDER_MAX, 4.0);
  assert.equal(PLAYBACK_RATE_DEFAULT, 1.0);
  assert.ok(PLAYBACK_RATES.includes(1.0), "Default 1.0 must be in presets");
  assert.ok(PLAYBACK_RATES.includes(0.1), "0.1 slow-mo must be in presets");
  assert.ok(PLAYBACK_RATES.includes(4.0), "4.0 high-speed must be in presets");
  assert.ok(COMMON_PLAYBACK_RATES.length >= 6, "Common playback rates defined");
  assert.ok(SPEED_PRESETS.length >= 10, "Speed presets defined");

  // Sorted in ascending order
  const sorted = [...PLAYBACK_RATES].sort((a, b) => a - b);
  assert.deepEqual([...PLAYBACK_RATES], sorted);
});

test("Playback rates include extended options: 2.0, 1.75, 1.5, 1.4 to 0.6 in 0.05 steps, and 0.5", () => {
  // Required anchors
  assert.ok(PLAYBACK_RATES.includes(2.0), "Includes 2.0");
  assert.ok(PLAYBACK_RATES.includes(1.75), "Includes 1.75");
  assert.ok(PLAYBACK_RATES.includes(1.5), "Includes 1.5");
  assert.ok(PLAYBACK_RATES.includes(0.5), "Includes 0.5");

  // Steps from 0.60 to 1.40 in 0.05 increments (17 values)
  for (let r = 60; r <= 140; r += 5) {
    const val = Number((r / 100).toFixed(2));
    assert.ok(
      PLAYBACK_RATES.includes(val),
      `PLAYBACK_RATES should include ${val}× in range 0.6 to 1.4 (step 0.05)`,
    );
  }
});

test("SPEED_DROPDOWN_OPTIONS contains comprehensive options with valid labels", () => {
  assert.ok(SPEED_DROPDOWN_OPTIONS.length >= 20);

  // Check key dropdown values
  const values = SPEED_DROPDOWN_OPTIONS.map((o) => o.value);
  assert.ok(values.includes(2.0));
  assert.ok(values.includes(1.75));
  assert.ok(values.includes(1.5));
  assert.ok(values.includes(0.5));

  for (let r = 60; r <= 140; r += 5) {
    const val = Number((r / 100).toFixed(2));
    assert.ok(values.includes(val), `Dropdown should contain ${val}×`);
  }

  // Check label format
  const normOption = SPEED_DROPDOWN_OPTIONS.find((o) => o.value === 1.0);
  assert.ok(normOption?.label.includes("1.0×"));
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
  // Step up from 1.0 (next in 0.05 step is 1.05)
  assert.equal(nextRate(1.0, 1), 1.05);
  // Step down from 1.0 (prev in 0.05 step is 0.95)
  assert.equal(nextRate(1.0, -1), 0.95);
  // Step up from 1.4 (next is 1.5)
  assert.equal(nextRate(1.4, 1), 1.5);
  // Step up from 1.5 (next is 1.75)
  assert.equal(nextRate(1.5, 1), 1.75);
  // Step up from 1.75 (next is 2.0)
  assert.equal(nextRate(1.75, 1), 2.0);
  // Upper boundary
  assert.equal(nextRate(4.0, 1), 4.0);
  // Lower boundary
  assert.equal(nextRate(0.1, -1), 0.1);
});
