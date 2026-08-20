import assert from "node:assert/strict";
import { test } from "node:test";

const ZOOM_MIN = 75;
const ZOOM_MAX = 300;
const ZOOM_DEFAULT = 100;

const ZOOM_STEPS = [
  75, 85, 90, 100, 110, 120, 130, 140, 150, 165, 180, 200, 225, 250, 275, 300,
];

const ZOOM_PRESETS = [
  { label: "80%", value: 80, desc: "Compact" },
  { label: "100%", value: 100, desc: "Standard" },
  { label: "125%", value: 125, desc: "Large" },
  { label: "150%", value: 150, desc: "X-Large" },
  { label: "175%", value: 175, desc: "2X-Large" },
  { label: "200%", value: 200, desc: "Maximum" },
  { label: "250%", value: 250, desc: "Giant" },
  { label: "300%", value: 300, desc: "Ultra" },
];

function clampZoom(val) {
  if (!Number.isFinite(val)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(val)));
}

test("UI Zoom constants and bounds", () => {
  assert.equal(ZOOM_MIN, 75);
  assert.equal(ZOOM_MAX, 300);
  assert.equal(ZOOM_DEFAULT, 100);
  assert.ok(ZOOM_STEPS.length >= 10, "Should have rich zoom steps");
  assert.ok(ZOOM_STEPS.includes(100), "Default 100% must be in steps");
  assert.ok(ZOOM_STEPS.includes(300), "300% maximum range must be in steps");
  assert.ok(ZOOM_STEPS.includes(75), "75% minimum must be in steps");
  
  // Sorted in ascending order
  const sorted = [...ZOOM_STEPS].sort((a, b) => a - b);
  assert.deepEqual([...ZOOM_STEPS], sorted);
});

test("clampZoom handles out-of-bound and invalid values", () => {
  assert.equal(clampZoom(100), 100);
  assert.equal(clampZoom(50), 75);
  assert.equal(clampZoom(0), 75);
  assert.equal(clampZoom(-100), 75);
  assert.equal(clampZoom(350), 300);
  assert.equal(clampZoom(500), 300);
  assert.equal(clampZoom(149.6), 150);
  assert.equal(clampZoom(NaN), 100);
  assert.equal(clampZoom(Infinity), 100);
});

test("ZOOM_PRESETS covers compact through ultra large sizes", () => {
  assert.ok(ZOOM_PRESETS.length >= 6);
  const values = ZOOM_PRESETS.map((p) => p.value);
  assert.ok(values.includes(80));
  assert.ok(values.includes(100));
  assert.ok(values.includes(150));
  assert.ok(values.includes(200));
  assert.ok(values.includes(250));
  assert.ok(values.includes(300));
});

test("Zoom in and Zoom out transitions", () => {
  // Test stepping up
  let current = 100;
  const next = ZOOM_STEPS.find((s) => s > current) ?? ZOOM_MAX;
  assert.equal(next, 110);

  // Test stepping down
  current = 100;
  const prev = [...ZOOM_STEPS].reverse().find((s) => s < current) ?? ZOOM_MIN;
  assert.equal(prev, 90);

  // Test stepping up at max
  current = 300;
  const atMax = ZOOM_STEPS.find((s) => s > current) ?? ZOOM_MAX;
  assert.equal(atMax, 300);

  // Test stepping down at min
  current = 75;
  const atMin = [...ZOOM_STEPS].reverse().find((s) => s < current) ?? ZOOM_MIN;
  assert.equal(atMin, 75);
});
