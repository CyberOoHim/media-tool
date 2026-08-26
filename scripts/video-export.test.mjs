import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIO_BITRATE_BPS,
  AUDIO_BITRATE_MBPS,
  DEFAULT_SOURCE_FPS,
  EXPORT_FPS_PRESETS,
  EXPORT_QUALITY_PRESETS,
  EXPORT_RESOLUTION_PRESETS,
  MAX_RESOLUTION_DIMENSION,
  MIN_RESOLUTION_DIMENSION,
  calculateExportResolution,
  calculateKeyframeInterval,
  calculateTargetBitrateMbps,
  resolveExportFps,
  selectAvcCodecString,
} from "../src/features/player/trim-types.ts";

test("exported constants maintain valid specs and bounds", () => {
  assert.equal(AUDIO_BITRATE_BPS, 192_000);
  assert.equal(AUDIO_BITRATE_MBPS, 0.192);
  assert.equal(DEFAULT_SOURCE_FPS, 30);
  assert.equal(MIN_RESOLUTION_DIMENSION, 32);
  assert.equal(MAX_RESOLUTION_DIMENSION, 4096);
  assert.ok(EXPORT_FPS_PRESETS.original);
  assert.ok(EXPORT_QUALITY_PRESETS.original);
  assert.ok(EXPORT_RESOLUTION_PRESETS["1080p"]);
});

test("calculateExportResolution calculates correct even dimensions for standard landscape", () => {
  const res1080 = calculateExportResolution(1920, 1080, "original");
  assert.equal(res1080.width, 1920);
  assert.equal(res1080.height, 1080);

  const res720 = calculateExportResolution(1920, 1080, "720p");
  assert.equal(res720.width, 1280);
  assert.equal(res720.height, 720);

  const res4k = calculateExportResolution(1920, 1080, "4k");
  assert.equal(res4k.width, 3840);
  assert.equal(res4k.height, 2160);

  const res360 = calculateExportResolution(1920, 1080, "360p");
  assert.equal(res360.width, 640);
  assert.equal(res360.height, 360);

  const resHalf = calculateExportResolution(1920, 1080, "scale-50");
  assert.equal(resHalf.width, 960);
  assert.equal(resHalf.height, 540);
});

test("calculateExportResolution handles portrait 9:16 mobile videos correctly", () => {
  const res = calculateExportResolution(1080, 1920, "720p");
  assert.equal(res.width, 720);
  assert.equal(res.height, 1280);
  assert.equal(res.width % 2, 0);
  assert.equal(res.height % 2, 0);

  const res480 = calculateExportResolution(1080, 1920, "480p");
  assert.equal(res480.width, 480);
  assert.equal(res480.height, 852);
  assert.equal(res480.height % 2, 0);
});

test("calculateExportResolution enforces even dimensions and bounds for custom resolutions", () => {
  const oddRes = calculateExportResolution(1920, 1080, "custom", 1281, 721);
  assert.equal(oddRes.width, 1280);
  assert.equal(oddRes.height, 720);

  const maxRes = calculateExportResolution(1920, 1080, "custom", 8000, 5000);
  assert.equal(maxRes.width, 4096);
  assert.equal(maxRes.height, 4096);

  const minRes = calculateExportResolution(1920, 1080, "custom", 10, 10);
  assert.equal(minRes.width, 32);
  assert.equal(minRes.height, 32);
});

test("resolveExportFps resolves presets, native source and custom fps", () => {
  assert.equal(resolveExportFps("original", undefined, 60), 60);
  assert.equal(resolveExportFps("original", undefined, undefined), 30);
  assert.equal(resolveExportFps("60"), 60);
  assert.equal(resolveExportFps("50"), 50);
  assert.equal(resolveExportFps("30"), 30);
  assert.equal(resolveExportFps("29.97"), 29.97);
  assert.equal(resolveExportFps("25"), 25);
  assert.equal(resolveExportFps("24"), 24);
  assert.equal(resolveExportFps("15"), 15);
  assert.equal(resolveExportFps("12"), 12);
  assert.equal(resolveExportFps("custom", 45), 45);
  assert.equal(resolveExportFps("custom", 150), 120);
  assert.equal(resolveExportFps("custom", 0), 30);
});

test("calculateTargetBitrateMbps scales bitrate with resolution and avoids iPad thermal overshoot", () => {
  const b1080 = calculateTargetBitrateMbps({
    quality: "high",
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 30,
  });
  assert.equal(b1080, 10);

  const b4k = calculateTargetBitrateMbps({
    quality: "high",
    targetWidth: 3840,
    targetHeight: 2160,
    targetFps: 30,
  });
  assert.ok(b4k > 20 && b4k < 30, `4K bitrate should scale perceptually (~26 Mbps), got ${b4k}`);

  const b720 = calculateTargetBitrateMbps({
    quality: "high",
    targetWidth: 1280,
    targetHeight: 720,
    targetFps: 30,
  });
  assert.ok(b720 > 4.5 && b720 < 7.0, `720p bitrate should scale down (~5.7 Mbps), got ${b720}`);

  const b360 = calculateTargetBitrateMbps({
    quality: "high",
    targetWidth: 640,
    targetHeight: 360,
    targetFps: 30,
  });
  assert.ok(b360 > 1.5 && b360 < 3.0, `360p bitrate should be ~2.1 Mbps, got ${b360}`);

  const b1080_60fps = calculateTargetBitrateMbps({
    quality: "high",
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 60,
  });
  assert.ok(b1080_60fps > b1080, "60fps should require higher bitrate than 30fps");
});

test("calculateTargetBitrateMbps correctly downscales 'original' quality when resolution is changed", () => {
  const sourceBitrateBps = 12_000_000;

  const bOrig = calculateTargetBitrateMbps({
    quality: "original",
    sourceBitrateBps,
    sourceWidth: 1920,
    sourceHeight: 1080,
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 30,
    keepAudio: true,
  });
  assert.ok(Math.abs(bOrig - 11.8) < 0.2, `Original bitrate should match source (~11.8 Mbps), got ${bOrig}`);

  const b480 = calculateTargetBitrateMbps({
    quality: "original",
    sourceBitrateBps,
    sourceWidth: 1920,
    sourceHeight: 1080,
    targetWidth: 854,
    targetHeight: 480,
    targetFps: 30,
    keepAudio: true,
  });
  assert.ok(b480 < 5.5 && b480 > 3.0, `Downscaled original quality should be ~4.0 Mbps, got ${b480}`);
});

test("calculateTargetBitrateMbps correctly preserves 60fps source video bitrate for 'original' quality", () => {
  const sourceBitrateBps = 16_000_000; // 16 Mbps 1080p @ 60fps

  // When source is 60fps and export is 60fps, ratio is 1.0 (no false +41% inflation!)
  const bOrig60 = calculateTargetBitrateMbps({
    quality: "original",
    sourceBitrateBps,
    sourceWidth: 1920,
    sourceHeight: 1080,
    sourceFps: 60,
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 60,
    keepAudio: true,
  });
  assert.ok(
    Math.abs(bOrig60 - 15.8) < 0.2,
    `60fps source exported at 60fps should preserve ~15.8 Mbps, got ${bOrig60}`,
  );
});

test("selectAvcCodecString chooses correct AVC profile and level for all resolution and fps combinations", () => {
  // 4K UHD -> Level 5.1
  assert.equal(selectAvcCodecString(3840, 2160, 30), "avc1.640033");
  assert.equal(selectAvcCodecString(3840, 2160, 60), "avc1.640033");

  // 1440p / 1080p60 -> Level 5.0
  assert.equal(selectAvcCodecString(2560, 1440, 30), "avc1.640032");
  assert.equal(selectAvcCodecString(1920, 1080, 60), "avc1.640032");

  // 1080p30 -> Level 4.0
  assert.equal(selectAvcCodecString(1920, 1080, 30), "avc1.640028");

  // 720p / 480p widescreen -> Level 3.1
  assert.equal(selectAvcCodecString(1280, 720, 30), "avc1.64001f");
  assert.equal(selectAvcCodecString(854, 480, 30), "avc1.64001f");
  assert.equal(selectAvcCodecString(854, 480, 24), "avc1.64001f");

  // 720x480 SD / 360p -> Level 3.0
  assert.equal(selectAvcCodecString(720, 480, 30), "avc1.4d001e");
  assert.equal(selectAvcCodecString(640, 360, 30), "avc1.4d001e");
});

test("calculateKeyframeInterval provides adaptive intervals based on resolution and fps", () => {
  assert.equal(calculateKeyframeInterval(3840, 2160, 30), 60);
  assert.equal(calculateKeyframeInterval(2560, 1440, 30), 75);
  assert.equal(calculateKeyframeInterval(1920, 1080, 30), 90);
  assert.equal(calculateKeyframeInterval(1280, 720, 30), 120);
  assert.equal(calculateKeyframeInterval(1920, 1080, 60), 180);
});
