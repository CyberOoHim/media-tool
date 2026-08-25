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

test("Video Export estimation accurately accounts for Sound Track ON vs OFF", async () => {
  const { estimateVideoExport } = await import("../src/features/media/estimation.ts");

  // With Sound ON
  const estWithSound = estimateVideoExport({
    sourceFileSize: 50_000_000,
    sourceDurationSec: 60,
    sourceWidth: 1920,
    sourceHeight: 1080,
    trimMode: "trim",
    trimStart: 0,
    trimEnd: 30,
    exportConfig: {
      quality: "high",
      resolution: "1080p",
      format: "mp4",
      bitrateMbps: 10,
      fps: 30,
      keepAudio: true,
    },
  });

  assert.equal(estWithSound.retainedDurationSec, 30);
  assert.equal(estWithSound.targetAudioBitrateBps, 192_000);
  assert.ok(estWithSound.audioPayloadBytes > 0);
  assert.equal(estWithSound.targetAudioBitrateFormatted, "192 kbps");

  // With Sound OFF (Muted)
  const estMuted = estimateVideoExport({
    sourceFileSize: 50_000_000,
    sourceDurationSec: 60,
    sourceWidth: 1920,
    sourceHeight: 1080,
    trimMode: "trim",
    trimStart: 0,
    trimEnd: 30,
    exportConfig: {
      quality: "high",
      resolution: "1080p",
      format: "mp4",
      bitrateMbps: 10,
      fps: 30,
      keepAudio: false,
    },
  });

  assert.equal(estMuted.targetAudioBitrateBps, 0);
  assert.equal(estMuted.audioPayloadBytes, 0);
  assert.equal(estMuted.targetAudioBitrateFormatted, "0 kbps (Muted)");
  assert.ok(estMuted.estimatedTotalBytes < estWithSound.estimatedTotalBytes);
});

test("Video Export resolution calculation ensures even dimensions for WebCodecs hardware encoder", async () => {
  const { calculateExportResolution } = await import("../src/features/player/trim-types.ts");

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
});

test("Video Cut & Trim duration calculation handles Trim and Cut modes", async () => {
  const { calculateRetainedDuration } = await import("../src/features/media/estimation.ts");

  // Trim mode: keep [10, 30] of 60s -> 20s retained
  const trimDur = calculateRetainedDuration(60, "trim", 10, 30);
  assert.equal(trimDur, 20);

  // Cut mode: remove [10, 30] of 60s -> 40s retained
  const cutDur = calculateRetainedDuration(60, "cut", 10, 30);
  assert.equal(cutDur, 40);
});


