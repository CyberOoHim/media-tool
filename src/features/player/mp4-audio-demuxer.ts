/**
 * MP4 / QuickTime Audio Track Demuxer and ADTS Extractor
 * Extracts raw AAC audio streams from MP4/MOV/M4V video files and formats them into
 * standard ADTS streams, enabling 100% reliable AudioContext.decodeAudioData on all browsers
 * (specifically bypassing Safari/WebKit's limitation where decodeAudioData fails on video containers).
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

export interface ExtractedAudioTrack {
  codec: string;
  sampleRate: number;
  channels: number;
  adtsData: Uint8Array;
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
      // 64-bit large size
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

/**
 * Parses an MP4/MOV ArrayBuffer and extracts AAC audio packets converted to ADTS.
 * Returns null if the file has no AAC audio track or is not an ISOBMFF file.
 */
export function extractMp4AudioToAdts(arrayBuffer: ArrayBuffer): ExtractedAudioTrack | null {
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

      // Check handler type at offset 8 of hdlr box payload
      const hdlrPayload = hdlr.start + hdlr.headerSize;
      const handlerType = String.fromCharCode(
        bytes[hdlrPayload + 8],
        bytes[hdlrPayload + 9],
        bytes[hdlrPayload + 10],
        bytes[hdlrPayload + 11],
      );

      if (handlerType !== "soun") continue; // Not an audio track

      const minf = findBox(mdiaBoxes, "minf");
      if (!minf) continue;

      const minfBoxes = readBoxes(bytes, minf.start + minf.headerSize, minf.end);
      const stbl = findBox(minfBoxes, "stbl");
      if (!stbl) continue;

      const stblBoxes = readBoxes(bytes, stbl.start + stbl.headerSize, stbl.end);
      const stsd = findBox(stblBoxes, "stsd");
      const stsz = findBox(stblBoxes, "stsz");
      const stsc = findBox(stblBoxes, "stsc");
      const stco = findBox(stblBoxes, "stco");
      const co64 = findBox(stblBoxes, "co64");

      if (!stsd || !stsz || !stsc || (!stco && !co64)) continue;

      // Parse sample description (stsd)
      const stsdPayload = stsd.start + stsd.headerSize;
      // skip version (4 bytes), entry count (4 bytes) -> offset 8
      const entryStart = stsdPayload + 8;
      const audioCodecType = String.fromCharCode(
        bytes[entryStart + 4],
        bytes[entryStart + 5],
        bytes[entryStart + 6],
        bytes[entryStart + 7],
      );

      // We handle AAC audio tracks ('mp4a')
      if (audioCodecType !== "mp4a") continue;

      const channels = view.getUint16(entryStart + 16 + 8); // AudioSampleEntry channel count
      const sampleRateRaw = view.getUint32(entryStart + 24 + 8); // AudioSampleEntry sample rate (16.16 fixed point)
      let sampleRate = sampleRateRaw >>> 16;
      if (sampleRate === 0) sampleRate = 48000;

      // Parse Chunk Offsets (stco or co64)
      const chunkOffsets: number[] = [];
      if (stco) {
        const p = stco.start + stco.headerSize + 4; // skip version/flags (4)
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

      // Parse Sample Sizes (stsz)
      const stszPayload = stsz.start + stsz.headerSize + 4; // skip version/flags
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

      // Parse Sample to Chunk (stsc)
      const stscPayload = stsc.start + stsc.headerSize + 4;
      const stscCount = view.getUint32(stscPayload);
      interface StscEntry {
        firstChunk: number;
        samplesPerChunk: number;
      }
      const stscEntries: StscEntry[] = [];
      for (let i = 0; i < stscCount; i++) {
        stscEntries.push({
          firstChunk: view.getUint32(stscPayload + 4 + i * 12),
          samplesPerChunk: view.getUint32(stscPayload + 8 + i * 12),
        });
      }

      // Reconstruct sample byte positions and pack into ADTS
      let totalAdtsBytes = 0;
      for (const size of sampleSizes) {
        totalAdtsBytes += size + 7;
      }

      if (totalAdtsBytes === 0) return null;

      const adtsBuffer = new Uint8Array(totalAdtsBytes);
      let writeOffset = 0;
      let sampleIdx = 0;

      for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
        const chunkNumber = chunkIdx + 1; // 1-indexed
        let samplesInChunk = 1;

        // Find applicable stsc entry
        for (let j = stscEntries.length - 1; j >= 0; j--) {
          if (chunkNumber >= stscEntries[j].firstChunk) {
            samplesInChunk = stscEntries[j].samplesPerChunk;
            break;
          }
        }

        let chunkFileOffset = chunkOffsets[chunkIdx];

        for (let s = 0; s < samplesInChunk && sampleIdx < sampleSizes.length; s++) {
          const sampleSize = sampleSizes[sampleIdx];
          if (chunkFileOffset + sampleSize <= bytes.length) {
            const header = createAdtsHeader(sampleSize, sampleRate, channels);
            adtsBuffer.set(header, writeOffset);
            writeOffset += 7;

            const sampleData = bytes.subarray(chunkFileOffset, chunkFileOffset + sampleSize);
            adtsBuffer.set(sampleData, writeOffset);
            writeOffset += sampleSize;
          }

          chunkFileOffset += sampleSize;
          sampleIdx++;
        }
      }

      if (writeOffset > 0) {
        return {
          codec: "aac",
          sampleRate,
          channels,
          adtsData: adtsBuffer.subarray(0, writeOffset),
        };
      }
    }
  } catch (err) {
    console.warn("MP4 audio track extraction failed:", err);
  }

  return null;
}
