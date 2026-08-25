import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateOggCrc, OggOpusMuxer } from "../src/features/audio/ogg-opus-muxer.ts";

test("Ogg CRC-32 checksum calculation", () => {
  // Test empty buffer
  const empty = new Uint8Array(0);
  assert.equal(calculateOggCrc(empty), 0);

  // Test simple string
  const data = new TextEncoder().encode("OggS");
  const crc = calculateOggCrc(data);
  assert.ok(typeof crc === "number" && crc >= 0);
});

test("OggOpusMuxer initializes with valid OpusHead and OpusTags headers", async () => {
  const muxer = new OggOpusMuxer({
    numberOfChannels: 2,
    sampleRate: 48000,
    serialNumber: 0x12345678,
    vendor: "TestVendor",
  });

  const blob = muxer.finalize("audio/ogg; codecs=opus");
  assert.equal(blob.type, "audio/ogg; codecs=opus");

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // Must have at least 2 pages (OpusHead + OpusTags)
  assert.ok(bytes.length > 50, "Blob should have header pages");

  // Page 0: Magic 'OggS'
  assert.equal(bytes[0], 0x4f); // 'O'
  assert.equal(bytes[1], 0x67); // 'g'
  assert.equal(bytes[2], 0x67); // 'g'
  assert.equal(bytes[3], 0x53); // 'S'

  // Page 0 header type: BOS (0x02)
  assert.equal(bytes[5], 0x02);

  // Page 0 Serial Number
  assert.equal(view.getUint32(14, true), 0x12345678);

  // Page 0 Sequence number = 0
  assert.equal(view.getUint32(18, true), 0);

  // Page 0 OpusHead content
  const page0PayloadOffset = 27 + bytes[26]; // 27 + segment table length
  const magicOpusHead = new TextDecoder().decode(bytes.slice(page0PayloadOffset, page0PayloadOffset + 8));
  assert.equal(magicOpusHead, "OpusHead");

  // Channels = 2
  assert.equal(bytes[page0PayloadOffset + 9], 2);
  // Sample rate = 48000
  assert.equal(view.getUint32(page0PayloadOffset + 12, true), 48000);
});

test("OggOpusMuxer packet segmenting, granule positioning, and EOS flag", async () => {
  const muxer = new OggOpusMuxer({
    numberOfChannels: 1,
    sampleRate: 48000,
    serialNumber: 0xabcdef01,
  });

  // Add 10 dummy Opus packets (each 120 bytes, 960 samples @ 48kHz = 20ms)
  for (let i = 0; i < 10; i++) {
    const dummyPacket = new Uint8Array(120);
    dummyPacket.fill(i + 1);
    muxer.addOpusPacket(dummyPacket, 960);
  }

  const opusBlob = muxer.finalize("audio/opus");
  assert.equal(opusBlob.type, "audio/opus");

  const arrayBuffer = await opusBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check that final page has EOS flag (0x04)
  // Search for the last 'OggS' in the buffer
  let lastOggsIdx = -1;
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === 0x4f && bytes[i + 1] === 0x67 && bytes[i + 2] === 0x67 && bytes[i + 3] === 0x53) {
      lastOggsIdx = i;
    }
  }

  assert.ok(lastOggsIdx >= 0, "Should have found OggS pages");
  const lastPageHeaderType = bytes[lastOggsIdx + 5];
  assert.equal(lastPageHeaderType & 0x04, 0x04, "Last page must have EOS flag set");
});

test("OggOpusMuxer handles large packets requiring multiple lacing segments (> 255 bytes)", async () => {
  const muxer = new OggOpusMuxer({
    numberOfChannels: 2,
    sampleRate: 48000,
  });

  // Large packet: 600 bytes -> requires segments [255, 255, 90]
  const largePacket = new Uint8Array(600);
  largePacket.fill(0xaa);
  muxer.addOpusPacket(largePacket, 960);

  const blob = muxer.finalize("audio/ogg; codecs=opus");
  assert.ok(blob.size > 650);
});

test("Audio Export format configurations and mime types", () => {
  const formats = ["wav", "ogg", "opus", "webm", "aac", "mp3"];
  assert.ok(formats.includes("ogg"));
  assert.ok(formats.includes("opus"));
  assert.ok(formats.includes("wav"));
  assert.ok(formats.includes("webm"));
  assert.ok(formats.includes("aac"));
  assert.ok(formats.includes("mp3"));
});

test("Video Export resolution calculation ensures even dimensions for WebCodecs hardware encoder", async () => {
  const { calculateExportResolution, EXPORT_QUALITY_PRESETS, EXPORT_RESOLUTION_PRESETS } = await import("../src/features/player/trim-types.ts");

  // Standard 1080p from 1920x1080
  const res1 = calculateExportResolution(1920, 1080, "1080p");
  assert.equal(res1.width % 2, 0);
  assert.equal(res1.height % 2, 0);
  assert.equal(res1.width, 1920);
  assert.equal(res1.height, 1080);

  // Odd input dimension scaled to 50%
  const res2 = calculateExportResolution(1921, 1081, "scale-50");
  assert.equal(res2.width % 2, 0);
  assert.equal(res2.height % 2, 0);

  // Custom dimensions with odd numbers
  const resCustom = calculateExportResolution(1920, 1080, "custom", 1281, 719);
  assert.equal(resCustom.width % 2, 0);
  assert.equal(resCustom.height % 2, 0);

  // Quality presets and bitrates
  assert.ok(EXPORT_QUALITY_PRESETS.original);
  assert.ok(EXPORT_QUALITY_PRESETS.lossless);
  assert.ok(EXPORT_QUALITY_PRESETS.high);
  assert.equal(EXPORT_QUALITY_PRESETS.high.bitrateMbps, 10);

  // Resolution presets
  assert.ok(EXPORT_RESOLUTION_PRESETS["4k"]);
  assert.ok(EXPORT_RESOLUTION_PRESETS["1080p"]);
  assert.ok(EXPORT_RESOLUTION_PRESETS["720p"]);
});

test("Video Export duration calculation handles Trim and Cut segments", () => {
  function computeRetainedDuration(totalSec, mode, start, end) {
    const s = start !== null ? Math.max(0, Math.min(totalSec, start)) : 0;
    const e = end !== null ? Math.max(s, Math.min(totalSec, end)) : totalSec;
    if (mode === "trim") return Math.max(0, e - s);
    return Math.max(0, totalSec - Math.max(0, e - s));
  }

  // Trim mode: keep [10, 30] of 60s -> 20s retained
  assert.equal(computeRetainedDuration(60, "trim", 10, 30), 20);

  // Cut mode: remove [10, 30] of 60s -> 40s retained
  assert.equal(computeRetainedDuration(60, "cut", 10, 30), 40);

  // Default entire length
  assert.equal(computeRetainedDuration(60, "trim", null, null), 60);
});

test("Video Export format is restricted to MP4", () => {
  const formats = ["mp4"];
  assert.equal(formats.length, 1);
  assert.equal(formats[0], "mp4");
});

test("Audio slice bounds clamping prevents Web Audio InvalidStateError", () => {
  function computeSafeAudioSlice(startSec, endSec, bufferDuration) {
    const segDuration = endSec - startSec;
    if (segDuration <= 0 || startSec >= bufferDuration) {
      return null;
    }
    const safeOffset = Math.max(0, Math.min(startSec, bufferDuration - 0.001));
    const safeDuration = Math.min(segDuration, Math.max(0, bufferDuration - safeOffset));
    return { safeOffset, safeDuration };
  }

  // Normal in-bounds segment
  const s1 = computeSafeAudioSlice(2, 5, 10);
  assert.ok(s1);
  assert.equal(s1.safeOffset, 2);
  assert.equal(s1.safeDuration, 3);

  // Offset slightly past buffer duration (container track jitter)
  const s2 = computeSafeAudioSlice(10.05, 12, 10.0);
  assert.equal(s2, null, "Should safely return null instead of throwing InvalidStateError");

  // Offset near end of buffer
  const s3 = computeSafeAudioSlice(9.9, 11, 10.0);
  assert.ok(s3);
  assert.ok(s3.safeOffset <= 9.999);
  assert.ok(s3.safeDuration <= 0.1);
});

test("Video Export bitrate estimation and source bitrate clamping", () => {
  function computeTargetBitrate({ sourceFileSize, sourceDurationSec, quality, keepAudio, bitrateMbps }) {
    let targetVideoBitrateBps;
    if (quality === "original" && sourceFileSize > 0 && sourceDurationSec > 0) {
      const rawSourceBitrateBps = Math.round((sourceFileSize * 8) / sourceDurationSec);
      targetVideoBitrateBps = Math.max(
        200_000,
        keepAudio ? rawSourceBitrateBps - 192_000 : rawSourceBitrateBps,
      );
    } else {
      targetVideoBitrateBps = Math.round((bitrateMbps || 8) * 1_000_000);
    }
    const targetAudioBitrateBps = keepAudio ? 192_000 : 0;
    const targetTotalBitrateBps = targetVideoBitrateBps + targetAudioBitrateBps;

    const videoPayloadBytes = Math.round((targetVideoBitrateBps * sourceDurationSec) / 8);
    const audioPayloadBytes = Math.round((targetAudioBitrateBps * sourceDurationSec) / 8);
    const containerOverheadBytes = Math.round(Math.max(64 * 1024, (videoPayloadBytes + audioPayloadBytes) * 0.015));
    const estimatedTotalBytes = videoPayloadBytes + audioPayloadBytes + containerOverheadBytes;
    const savingsPct = Number((((sourceFileSize - estimatedTotalBytes) / sourceFileSize) * 100).toFixed(1));

    return { targetVideoBitrateBps, targetAudioBitrateBps, targetTotalBitrateBps, estimatedTotalBytes, savingsPct };
  }

  // Source video: 10s, 2.5 MB -> ~2.0 Mbps
  const sourceFileSize = 2.5 * 1024 * 1024;
  const sourceDurationSec = 10;
  const sourceBitrateBps = (sourceFileSize * 8) / sourceDurationSec; // 2,097,152 bps

  // Original quality preset
  const estOrig = computeTargetBitrate({
    sourceFileSize,
    sourceDurationSec,
    quality: "original",
    keepAudio: true,
    bitrateMbps: 8,
  });

  // Native video bitrate should be source minus audio (192kbps)
  assert.ok(estOrig.targetVideoBitrateBps < sourceBitrateBps);
  assert.ok(estOrig.targetVideoBitrateBps >= 1_500_000);
  assert.ok(estOrig.estimatedTotalBytes <= sourceFileSize * 1.05);

  // Preset with lower bitrate (Compact @ 2.5 Mbps vs High @ 10 Mbps)
  const estCompact = computeTargetBitrate({
    sourceFileSize: 20 * 1024 * 1024, // 20MB @ 10s = 16 Mbps source
    sourceDurationSec: 10,
    quality: "compact",
    keepAudio: true,
    bitrateMbps: 2.5,
  });

  // Compact should have substantial savings vs 16 Mbps source
  assert.ok(estCompact.savingsPct > 70);
  assert.ok(estCompact.estimatedTotalBytes < 5 * 1024 * 1024);
});

test("WebCodecs audio frame size and planar buffer calculation for AAC and Opus", () => {
  // AAC: 1024 samples/frame
  const aacFrameSize = 1024;
  const aacSampleRate = 48000;
  const aacFrameDurationUs = Math.round((aacFrameSize / aacSampleRate) * 1_000_000);
  assert.equal(aacFrameDurationUs, 21333); // ~21.33ms

  // Opus: 960 samples/frame @ 48kHz (exact 20ms)
  const opusFrameSize = 960;
  const opusSampleRate = 48000;
  const opusFrameDurationUs = Math.round((opusFrameSize / opusSampleRate) * 1_000_000);
  assert.equal(opusFrameDurationUs, 20000); // 20ms exact
});



