/**
 * MP4 / QuickTime AAC demuxer.
 * Primary path for iPad Safari/Chrome: copy raw AAC frames (no AudioEncoder).
 * Also packs those frames into ADTS for WebKit decodeAudioData fallback.
 */

const SAMPLING_FREQUENCIES: Record<number, number> = {
  96000: 0,
  88200: 1,
  64000: 2,
  48000: 3,
  44100: 4,
  32000: 5,
  24000: 6,
  22050: 7,
  16000: 8,
  12000: 9,
  11025: 10,
  8000: 11,
  7350: 12,
};

const ASC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

const AAC_LC_FRAME_SAMPLES = 1024;

export interface ExtractedAudioTrack {
  codec: string;
  sampleRate: number;
  channels: number;
  adtsData: Uint8Array;
}

export interface AacSample {
  data: Uint8Array;
  timestampUs: number;
  durationUs: number;
}

export interface ExtractedAacTrack {
  codec: "aac";
  sampleRate: number;
  channels: number;
  samples: AacSample[];
}

export interface AudioTimeRange {
  startSec: number;
  endSec: number;
}

/**
 * Creates a 7-byte ADTS (Audio Data Transport Stream) header for an AAC-LC frame.
 */
export function createAdtsHeader(
  frameLength: number,
  sampleRate: number,
  channels: number,
  profile = 1, // 1 = AAC-LC (MPEG-4 profile 2, 0-indexed is 1)
): Uint8Array {
  const freqIndex = SAMPLING_FREQUENCIES[sampleRate] ?? 3; // Default 48000Hz (index 3)
  const channelConfig = Math.min(2, Math.max(1, channels));
  const packetLength = frameLength + 7;

  const header = new Uint8Array(7);
  // Byte 0: Syncword high 8 bits (0xFF)
  header[0] = 0xff;
  // Byte 1: Syncword low 4 bits (0xF) + ID (0 = MPEG-4) + Layer (00) + Protection absent (1)
  header[1] = 0xf1;
  // Byte 2: Profile (2 bits) + Sampling frequency index (4 bits) + Private (0) + Channel config high bit
  header[2] =
    ((profile & 0x03) << 6) |
    ((freqIndex & 0x0f) << 2) |
    ((channelConfig >> 2) & 0x01);
  // Byte 3: Channel config low 2 bits + Original/Home/Copyright (0000) + Packet length high 2 bits
  header[3] =
    ((channelConfig & 0x03) << 6) |
    ((packetLength >> 11) & 0x03);
  // Byte 4: Packet length middle 8 bits
  header[4] = (packetLength >> 3) & 0xff;
  // Byte 5: Packet length low 3 bits + Buffer fullness high 5 bits (0x1F = VBR/fullness)
  header[5] = ((packetLength & 0x07) << 5) | 0x1f;
  // Byte 6: Buffer fullness low 6 bits (0x3F) + Number of raw data blocks (0 = 1 frame)
  header[6] = 0xfc;

  return header;
}

interface Mp4Box {
  type: string;
  start: number;
  headerSize: number;
  size: number;
  end: number;
}

function readBoxes(buffer: Uint8Array, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let pos = start;

  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    const type = String.fromCharCode(
      buffer[pos + 4],
      buffer[pos + 5],
      buffer[pos + 6],
      buffer[pos + 7],
    );

    let headerSize = 8;
    if (size === 1 && pos + 16 <= end) {
      const high = view.getUint32(pos + 8);
      const low = view.getUint32(pos + 12);
      size = high * 0x100000000 + low;
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }

    if (size < headerSize || pos + size > end + 1024) {
      break;
    }

    boxes.push({
      type,
      start: pos,
      headerSize,
      size,
      end: pos + size,
    });

    pos += size;
  }

  return boxes;
}

function findBox(boxes: Mp4Box[], type: string): Mp4Box | undefined {
  return boxes.find((b) => b.type === type);
}

function findAllBoxes(boxes: Mp4Box[], type: string): Mp4Box[] {
  return boxes.filter((b) => b.type === type);
}

function findEsdsBox(buffer: Uint8Array, start: number, end: number): Mp4Box | undefined {
  const boxes = readBoxes(buffer, start, end);
  for (const box of boxes) {
    if (box.type === "esds") return box;
    if (box.type === "wave" || box.type === "mp4a") {
      const nested = findEsdsBox(buffer, box.start + box.headerSize, box.end);
      if (nested) return nested;
    }
  }
  return undefined;
}

function readMpeg4Length(bytes: Uint8Array, offset: number, end: number): { length: number; next: number } {
  let length = 0;
  let pos = offset;
  for (let i = 0; i < 4 && pos < end; i++) {
    const b = bytes[pos++];
    length = (length << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return { length, next: pos };
}

function parseAudioSpecificConfig(bytes: Uint8Array, offset: number): { sampleRate: number; channels: number } | null {
  if (offset + 2 > bytes.length) return null;
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const freqIndex = ((b0 & 0x07) << 1) | ((b1 >> 7) & 0x01);
  const sampleRate = ASC_SAMPLE_RATES[freqIndex] ?? 48000;
  const channels = Math.min(2, Math.max(1, (b1 >> 3) & 0x0f || 2));
  return { sampleRate, channels };
}

function scanDecoderSpecificInfo(
  bytes: Uint8Array,
  start: number,
  end: number,
): { sampleRate: number; channels: number } | null {
  let pos = start;
  while (pos + 2 < end) {
    const tag = bytes[pos++];
    const sized = readMpeg4Length(bytes, pos, end);
    pos = sized.next;
    const payloadEnd = Math.min(end, pos + sized.length);
    if (payloadEnd < pos) break;

    if (tag === 0x05) {
      return parseAudioSpecificConfig(bytes, pos);
    }
    if (tag === 0x03) {
      if (pos + 3 > payloadEnd) {
        pos = payloadEnd;
        continue;
      }
      const flags = bytes[pos + 2];
      let nested = pos + 3;
      if (flags & 0x80) nested += 2;
      if (flags & 0x40 && nested < payloadEnd) {
        nested += 1 + bytes[nested];
      }
      if (flags & 0x20) nested += 2;
      const found = scanDecoderSpecificInfo(bytes, nested, payloadEnd);
      if (found) return found;
    } else if (tag === 0x04) {
      const found = scanDecoderSpecificInfo(bytes, pos + 13, payloadEnd);
      if (found) return found;
    }
    pos = payloadEnd;
  }
  return null;
}

function parseEsdsConfig(bytes: Uint8Array, esds: Mp4Box): { sampleRate: number; channels: number } | null {
  return scanDecoderSpecificInfo(bytes, esds.start + esds.headerSize + 4, esds.end);
}

function readMdhdTimescale(bytes: Uint8Array, view: DataView, mdhd: Mp4Box): number {
  const payload = mdhd.start + mdhd.headerSize;
  const version = bytes[payload];
  const timescale = version === 1 ? view.getUint32(payload + 20) : view.getUint32(payload + 12);
  return timescale > 0 ? timescale : 0;
}

function audioSampleEntryBodyStart(view: DataView, entryStart: number): number {
  const version = view.getUint16(entryStart + 16);
  if (version === 1) return entryStart + 52;
  if (version === 2) return entryStart + 72;
  return entryStart + 36;
}

function stripAdtsIfPresent(sample: Uint8Array): Uint8Array {
  if (sample.length < 8) return sample;
  if (sample[0] !== 0xff || (sample[1] & 0xf0) !== 0xf0) return sample;
  const packetLength =
    ((sample[3] & 0x03) << 11) | (sample[4] << 3) | ((sample[5] >> 5) & 0x07);
  if (packetLength === sample.length && packetLength > 7) {
    return sample.subarray(7);
  }
  return sample;
}

function ticksToUs(ticks: number, timescale: number): number {
  if (ticks <= 0) return 0;
  return Math.round((ticks * 1_000_000) / timescale);
}

function durationTicksToUs(ticks: number, timescale: number): number {
  return Math.max(1, ticksToUs(Math.max(1, ticks), timescale));
}

/**
 * Parses an MP4/MOV buffer and returns raw AAC frames with timestamps.
 * Returns null when there is no usable AAC track (the iPad remux path then cannot run).
 */
export function extractMp4AacTrack(arrayBuffer: ArrayBuffer): ExtractedAacTrack | null {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const rootBoxes = readBoxes(bytes, 0, bytes.length);

    const moov = findBox(rootBoxes, "moov");
    if (!moov) return null;

    const moovBoxes = readBoxes(bytes, moov.start + moov.headerSize, moov.end);
    const traks = findAllBoxes(moovBoxes, "trak");

    for (const trak of traks) {
      const trakBoxes = readBoxes(bytes, trak.start + trak.headerSize, trak.end);
      const mdia = findBox(trakBoxes, "mdia");
      if (!mdia) continue;

      const mdiaBoxes = readBoxes(bytes, mdia.start + mdia.headerSize, mdia.end);
      const hdlr = findBox(mdiaBoxes, "hdlr");
      if (!hdlr) continue;

      const hdlrPayload = hdlr.start + hdlr.headerSize;
      const handlerType = String.fromCharCode(
        bytes[hdlrPayload + 8],
        bytes[hdlrPayload + 9],
        bytes[hdlrPayload + 10],
        bytes[hdlrPayload + 11],
      );

      if (handlerType !== "soun") continue;

      const mdhd = findBox(mdiaBoxes, "mdhd");
      const minf = findBox(mdiaBoxes, "minf");
      if (!minf) continue;

      const minfBoxes = readBoxes(bytes, minf.start + minf.headerSize, minf.end);
      const stbl = findBox(minfBoxes, "stbl");
      if (!stbl) continue;

      const stblBoxes = readBoxes(bytes, stbl.start + stbl.headerSize, stbl.end);
      const stsd = findBox(stblBoxes, "stsd");
      const stsz = findBox(stblBoxes, "stsz");
      const stsc = findBox(stblBoxes, "stsc");
      const stts = findBox(stblBoxes, "stts");
      const stco = findBox(stblBoxes, "stco");
      const co64 = findBox(stblBoxes, "co64");

      if (!stsd || !stsz || !stsc || (!stco && !co64)) continue;

      const stsdPayload = stsd.start + stsd.headerSize;
      const entryStart = stsdPayload + 8;
      if (entryStart + 8 > stsd.end) continue;

      const audioCodecType = String.fromCharCode(
        bytes[entryStart + 4],
        bytes[entryStart + 5],
        bytes[entryStart + 6],
        bytes[entryStart + 7],
      );

      if (audioCodecType !== "mp4a") continue;

      const entrySize = view.getUint32(entryStart);
      const entryEnd = Math.min(stsd.end, entryStart + Math.max(entrySize, 36));

      let channels = Math.min(2, Math.max(1, view.getUint16(entryStart + 24) || 2));
      const sampleRateRaw = view.getUint32(entryStart + 32);
      let sampleRate = sampleRateRaw >>> 16;
      if (sampleRate === 0) sampleRate = 48000;

      const esds = findEsdsBox(bytes, audioSampleEntryBodyStart(view, entryStart), entryEnd);
      if (esds) {
        const fromEsds = parseEsdsConfig(bytes, esds);
        if (fromEsds) {
          sampleRate = fromEsds.sampleRate;
          channels = fromEsds.channels;
        }
      }

      const timescale = (mdhd && readMdhdTimescale(bytes, view, mdhd)) || sampleRate;
      const defaultDeltaTicks = Math.max(
        1,
        Math.round((AAC_LC_FRAME_SAMPLES * timescale) / Math.max(1, sampleRate)),
      );

      const chunkOffsets: number[] = [];
      if (stco) {
        const p = stco.start + stco.headerSize + 4;
        const entryCount = view.getUint32(p);
        for (let i = 0; i < entryCount; i++) {
          chunkOffsets.push(view.getUint32(p + 4 + i * 4));
        }
      } else if (co64) {
        const p = co64.start + co64.headerSize + 4;
        const entryCount = view.getUint32(p);
        for (let i = 0; i < entryCount; i++) {
          const high = view.getUint32(p + 4 + i * 8);
          const low = view.getUint32(p + 8 + i * 8);
          chunkOffsets.push(high * 0x100000000 + low);
        }
      }

      const stszPayload = stsz.start + stsz.headerSize + 4;
      const uniformSampleSize = view.getUint32(stszPayload);
      const sampleCount = view.getUint32(stszPayload + 4);
      const sampleSizes: number[] = [];
      if (uniformSampleSize > 0) {
        for (let i = 0; i < sampleCount; i++) {
          sampleSizes.push(uniformSampleSize);
        }
      } else {
        for (let i = 0; i < sampleCount; i++) {
          sampleSizes.push(view.getUint32(stszPayload + 8 + i * 4));
        }
      }

      const stscPayload = stsc.start + stsc.headerSize + 4;
      const stscCount = view.getUint32(stscPayload);
      const stscEntries: Array<{ firstChunk: number; samplesPerChunk: number }> = [];
      for (let i = 0; i < stscCount; i++) {
        stscEntries.push({
          firstChunk: view.getUint32(stscPayload + 4 + i * 12),
          samplesPerChunk: view.getUint32(stscPayload + 8 + i * 12),
        });
      }

      const sttsEntries: Array<{ sampleCount: number; sampleDelta: number }> = [];
      if (stts) {
        const p = stts.start + stts.headerSize + 4;
        const sttsCount = view.getUint32(p);
        for (let i = 0; i < sttsCount; i++) {
          sttsEntries.push({
            sampleCount: view.getUint32(p + 4 + i * 8),
            sampleDelta: view.getUint32(p + 8 + i * 8),
          });
        }
      }

      const samples: AacSample[] = [];
      let sampleIdx = 0;
      let dtsTicks = 0;
      let sttsEntryIdx = 0;
      let sttsRemaining = sttsEntries[0]?.sampleCount ?? 0;

      const nextSampleDeltaTicks = (): number => {
        if (sttsEntries.length === 0) return defaultDeltaTicks;
        while (sttsEntryIdx < sttsEntries.length && sttsRemaining <= 0) {
          sttsEntryIdx++;
          sttsRemaining = sttsEntries[sttsEntryIdx]?.sampleCount ?? 0;
        }
        const delta = sttsEntries[sttsEntryIdx]?.sampleDelta ?? defaultDeltaTicks;
        if (sttsRemaining > 0) sttsRemaining--;
        return Math.max(1, delta);
      };

      for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
        const chunkNumber = chunkIdx + 1;
        let samplesInChunk = 1;
        for (let j = stscEntries.length - 1; j >= 0; j--) {
          if (chunkNumber >= stscEntries[j].firstChunk) {
            samplesInChunk = stscEntries[j].samplesPerChunk;
            break;
          }
        }

        let chunkFileOffset = chunkOffsets[chunkIdx];
        for (let s = 0; s < samplesInChunk && sampleIdx < sampleSizes.length; s++) {
          const sampleSize = sampleSizes[sampleIdx];
          const deltaTicks = nextSampleDeltaTicks();
          if (sampleSize > 0 && chunkFileOffset + sampleSize <= bytes.length) {
            const raw = stripAdtsIfPresent(bytes.subarray(chunkFileOffset, chunkFileOffset + sampleSize));
            if (raw.length > 0) {
              samples.push({
                data: raw.slice(),
                timestampUs: ticksToUs(dtsTicks, timescale),
                durationUs: durationTicksToUs(deltaTicks, timescale),
              });
            }
          }
          dtsTicks += deltaTicks;
          chunkFileOffset += sampleSize;
          sampleIdx++;
        }
      }

      if (samples.length > 0) {
        return {
          codec: "aac",
          sampleRate,
          channels,
          samples,
        };
      }
    }
  } catch (err) {
    console.warn("MP4 AAC track extraction failed:", err);
  }

  return null;
}

/**
 * Copies AAC frames that overlap the export ranges and rebases timestamps to 0.
 */
export function sliceAacSamples(track: ExtractedAacTrack, ranges: AudioTimeRange[]): ExtractedAacTrack {
  const samples: AacSample[] = [];
  let destUs = 0;

  for (const range of ranges) {
    if (!(range.endSec > range.startSec)) continue;
    const startUs = Math.max(0, range.startSec) * 1_000_000;
    const endUs = range.endSec * 1_000_000;

    for (const sample of track.samples) {
      const sampleEndUs = sample.timestampUs + sample.durationUs;
      if (sampleEndUs <= startUs) continue;
      if (sample.timestampUs >= endUs) break;
      samples.push({
        data: sample.data,
        timestampUs: destUs,
        durationUs: sample.durationUs,
      });
      destUs += sample.durationUs;
    }
  }

  return {
    codec: "aac",
    sampleRate: track.sampleRate,
    channels: track.channels,
    samples,
  };
}

/**
 * Parses an MP4/MOV ArrayBuffer and extracts AAC audio packets converted to ADTS.
 * Returns null if the file has no AAC audio track or is not an ISOBMFF file.
 */
export function extractMp4AudioToAdts(arrayBuffer: ArrayBuffer): ExtractedAudioTrack | null {
  const track = extractMp4AacTrack(arrayBuffer);
  if (!track || track.samples.length === 0) return null;

  let totalAdtsBytes = 0;
  for (const sample of track.samples) {
    totalAdtsBytes += sample.data.length + 7;
  }

  const adtsBuffer = new Uint8Array(totalAdtsBytes);
  let writeOffset = 0;
  for (const sample of track.samples) {
    adtsBuffer.set(createAdtsHeader(sample.data.length, track.sampleRate, track.channels), writeOffset);
    writeOffset += 7;
    adtsBuffer.set(sample.data, writeOffset);
    writeOffset += sample.data.length;
  }

  return {
    codec: "aac",
    sampleRate: track.sampleRate,
    channels: track.channels,
    adtsData: adtsBuffer.subarray(0, writeOffset),
  };
}
