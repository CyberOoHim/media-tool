import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdtsHeader, extractMp4AudioToAdts } from "../src/features/player/mp4-audio-demuxer.ts";

test("createAdtsHeader creates valid 7-byte ADTS headers for AAC-LC", () => {
  // Test 48000Hz stereo frame with 250 bytes payload
  const header48k = createAdtsHeader(250, 48000, 2);
  assert.equal(header48k.length, 7);

  // Syncword 0xFFF
  assert.equal(header48k[0], 0xff);
  assert.equal(header48k[1] & 0xf0, 0xf0);

  // Layer 00, ID 0 (MPEG-4), protection absent 1 -> header[1] == 0xF1
  assert.equal(header48k[1], 0xf1);

  // Profile AAC-LC (01), freqIndex 3 for 48000Hz -> (1 << 6) | (3 << 2) = 0x40 | 0x0c = 0x4c
  // channelConfig 2 (high bit 0) -> header[2] == 0x4c
  assert.equal(header48k[2], 0x4c);

  // Packet length: 250 + 7 = 257
  const packetLength = 257;
  const extractedLen =
    ((header48k[3] & 0x03) << 11) |
    (header48k[4] << 3) |
    ((header48k[5] >> 5) & 0x07);
  assert.equal(extractedLen, packetLength);
});

test("createAdtsHeader handles 44100Hz mono and stereo correctly", () => {
  const header44kMono = createAdtsHeader(100, 44100, 1);
  // freqIndex 4 for 44100Hz -> (1 << 6) | (4 << 2) = 0x40 | 0x10 = 0x50
  assert.equal(header44kMono[2], 0x50);

  const header44kStereo = createAdtsHeader(100, 44100, 2);
  assert.equal(header44kStereo[2], 0x50);
});

test("extractMp4AudioToAdts safely returns null for empty or non-MP4 buffers", () => {
  const empty = new ArrayBuffer(0);
  assert.equal(extractMp4AudioToAdts(empty), null);

  const dummy = new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112]).buffer; // ftyp only
  assert.equal(extractMp4AudioToAdts(dummy), null);
});
