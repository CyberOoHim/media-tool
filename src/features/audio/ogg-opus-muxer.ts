/**
 * Pure TypeScript RFC 7845 & RFC 3533 Ogg Opus Multiplexer
 * Encapsulates Opus packets (from WebCodecs AudioEncoder or Opus encoders)
 * into spec-compliant .ogg and .opus audio files in the browser.
 */

// Precomputed CRC-32 table for Ogg polynomial 0x04c11db7
const OGG_CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    if (r & 0x80000000) {
      r = (r << 1) ^ 0x04c11db7;
    } else {
      r = r << 1;
    }
  }
  OGG_CRC_TABLE[i] = r >>> 0;
}

/**
 * Calculates standard Ogg CRC-32 checksum
 */
export function calculateOggCrc(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ data[i]!) & 0xff]!) >>> 0;
  }
  return crc;
}

export interface OggOpusMuxerOptions {
  numberOfChannels: number; // 1 (mono) or 2 (stereo)
  sampleRate: number; // typically 48000
  serialNumber?: number; // Random 32-bit stream serial
  vendor?: string; // Vendor comment string
}

export class OggOpusMuxer {
  private numberOfChannels: number;
  private sampleRate: number;
  private serialNumber: number;
  private vendor: string;

  private pageSequenceNumber = 0;
  private totalGranulePosition = 0;
  private pages: Uint8Array[] = [];

  // Packet staging for multi-packet pages
  private stagedPackets: Uint8Array[] = [];
  private stagedSegmentCount = 0;
  private stagedGranule = 0;

  constructor(options: OggOpusMuxerOptions) {
    this.numberOfChannels = Math.max(1, Math.min(2, options.numberOfChannels || 2));
    this.sampleRate = options.sampleRate || 48000;
    this.serialNumber = options.serialNumber ?? ((Math.random() * 0xffffffff) >>> 0);
    this.vendor = options.vendor || "MediaTool Audio Deck (RFC 7845)";

    this.writeHeaderPages();
  }

  /**
   * Writes Page 0 (OpusHead) and Page 1 (OpusTags)
   */
  private writeHeaderPages(): void {
    // 1. Build OpusHead packet (19 bytes)
    const headPacket = new Uint8Array(19);
    const headView = new DataView(headPacket.buffer);

    // "OpusHead" magic
    const magicHead = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64];
    headPacket.set(magicHead, 0);
    headPacket[8] = 1; // Version
    headPacket[9] = this.numberOfChannels; // Channels
    headView.setUint16(10, 0, true); // Pre-skip = 0
    headView.setUint32(12, this.sampleRate, true); // Input Sample Rate
    headView.setInt16(16, 0, true); // Output gain = 0 dB
    headPacket[18] = 0; // Channel mapping family 0 (mono / stereo)

    // Write Page 0: BOS (Beginning of Stream) flag = 0x02
    this.writeOggPage([headPacket], 0, 0x02);

    // 2. Build OpusTags packet
    const vendorBytes = new TextEncoder().encode(this.vendor);
    const tagsPacketLength = 8 + 4 + vendorBytes.length + 4;
    const tagsPacket = new Uint8Array(tagsPacketLength);
    const tagsView = new DataView(tagsPacket.buffer);

    // "OpusTags" magic
    const magicTags = [0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73];
    tagsPacket.set(magicTags, 0);
    tagsView.setUint32(8, vendorBytes.length, true);
    tagsPacket.set(vendorBytes, 12);
    tagsView.setUint32(12 + vendorBytes.length, 0, true); // 0 user comments

    // Write Page 1: Normal flag = 0x00
    this.writeOggPage([tagsPacket], 0, 0x00);
  }

  /**
   * Adds an encoded Opus packet with its sample duration (typically 960 samples for 20ms at 48kHz)
   */
  public addOpusPacket(packetData: Uint8Array, sampleCount = 960): void {
    this.totalGranulePosition += sampleCount;

    // Calculate segments needed for this packet
    const packetLen = packetData.length;
    const segsNeeded = Math.floor(packetLen / 255) + 1;

    // If adding this packet exceeds max segments per page (255) or we have ~40-50 packets (~1 sec)
    if (this.stagedSegmentCount + segsNeeded > 240 || this.stagedPackets.length >= 50) {
      this.flushStagedPage(false);
    }

    this.stagedPackets.push(packetData);
    this.stagedSegmentCount += segsNeeded;
    this.stagedGranule = this.totalGranulePosition;
  }

  /**
   * Flushes any staged packets to an Ogg page
   */
  private flushStagedPage(isEos: boolean): void {
    if (this.stagedPackets.length === 0) {
      if (isEos && this.pages.length > 2) {
        // Mark the last existing page as EOS
        const lastPage = this.pages[this.pages.length - 1]!;
        lastPage[5] |= 0x04; // Set EOS flag
        // Recompute CRC for last page
        lastPage[22] = 0;
        lastPage[23] = 0;
        lastPage[24] = 0;
        lastPage[25] = 0;
        const crc = calculateOggCrc(lastPage);
        const view = new DataView(lastPage.buffer, lastPage.byteOffset, lastPage.byteLength);
        view.setUint32(22, crc, true);
      }
      return;
    }

    const headerType = isEos ? 0x04 : 0x00;
    this.writeOggPage(this.stagedPackets, this.stagedGranule, headerType);

    this.stagedPackets = [];
    this.stagedSegmentCount = 0;
  }

  /**
   * Low-level Ogg page writer
   */
  private writeOggPage(packets: Uint8Array[], granulePosition: number, headerType: number): void {
    // 1. Build Segment Table
    const segmentTable: number[] = [];
    let totalPayloadSize = 0;

    for (const pkt of packets) {
      let len = pkt.length;
      totalPayloadSize += len;
      while (len >= 255) {
        segmentTable.push(255);
        len -= 255;
      }
      segmentTable.push(len);
    }

    const numSegments = segmentTable.length;
    if (numSegments > 255) {
      throw new Error(`Ogg page segment overflow: ${numSegments} > 255`);
    }

    const headerSize = 27 + numSegments;
    const pageSize = headerSize + totalPayloadSize;
    const page = new Uint8Array(pageSize);
    const view = new DataView(page.buffer);

    // 'OggS' capture pattern
    page[0] = 0x4f; // 'O'
    page[1] = 0x67; // 'g'
    page[2] = 0x67; // 'g'
    page[3] = 0x53; // 'S'

    // Stream structure version (0)
    page[4] = 0;

    // Header type flag (0x02 BOS, 0x00 MID, 0x04 EOS)
    page[5] = headerType;

    // Granule position (64-bit int LE)
    const granLow = (granulePosition & 0xffffffff) >>> 0;
    const granHigh = Math.floor(granulePosition / 0x100000000) >>> 0;
    view.setUint32(6, granLow, true);
    view.setUint32(10, granHigh, true);

    // Bitstream serial number
    view.setUint32(14, this.serialNumber, true);

    // Page sequence number
    view.setUint32(18, this.pageSequenceNumber++, true);

    // Checksum (zeroed before calculation)
    view.setUint32(22, 0, true);

    // Number of page segments
    page[26] = numSegments;

    // Segment table
    page.set(segmentTable, 27);

    // Copy packet payloads
    let offset = headerSize;
    for (const pkt of packets) {
      page.set(pkt, offset);
      offset += pkt.length;
    }

    // Calculate CRC-32 checksum and write into offset 22
    const crc = calculateOggCrc(page);
    view.setUint32(22, crc, true);

    this.pages.push(page);
  }

  /**
   * Finalizes the muxer and returns the concatenated binary data as a Blob with zero heap duplication
   */
  public finalize(mimeType: "audio/ogg; codecs=opus" | "audio/opus" | "audio/ogg" = "audio/ogg; codecs=opus"): Blob {
    this.flushStagedPage(true);
    // Directly construct Blob from array of pages, avoiding duplicate buffer allocation
    return new Blob(this.pages as BlobPart[], { type: mimeType });
  }
}
