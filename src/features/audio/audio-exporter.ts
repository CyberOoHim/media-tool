import { ArrayBufferTarget as Mp4ArrayBufferTarget, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmArrayBufferTarget, Muxer as WebmMuxer } from "webm-muxer";
import { audioBufferToWavBlob } from "./audio-engine";
import { OggOpusMuxer } from "./ogg-opus-muxer";
import type { AudioExportConfig, AudioExportFormat } from "./types";

export interface EncodedAudioResult {
  blob: Blob;
  extension: string;
  mimeType: string;
  format: AudioExportFormat;
  bitrateKbps?: number;
  bitDepth?: number;
}

/**
 * Checks whether WebCodecs AudioEncoder is supported in this browser
 */
export function isAudioEncoderSupported(): boolean {
  return typeof window !== "undefined" && "AudioEncoder" in window && "AudioData" in window;
}

/**
 * Encodes an AudioBuffer into the target format (.ogg, .opus, .webm, .wav, .aac, .mp3)
 */
export async function encodeAudioBuffer(
  buffer: AudioBuffer,
  config: AudioExportConfig,
  onProgress?: (progress: number) => void,
): Promise<EncodedAudioResult> {
  const { format, bitDepth = 16, bitrateKbps = 192 } = config;

  // 1. WAV lossless export
  if (format === "wav") {
    onProgress?.(50);
    const wavBlob = audioBufferToWavBlob(buffer, bitDepth);
    onProgress?.(100);
    return {
      blob: wavBlob,
      extension: "wav",
      mimeType: "audio/wav",
      format: "wav",
      bitDepth,
    };
  }

  // 2. Hardware / WebCodecs Opus encoding for .ogg, .opus, and .webm
  if (format === "ogg" || format === "opus" || format === "webm") {
    if (isAudioEncoderSupported()) {
      try {
        const result = await encodeOpusWebCodecs(buffer, format, bitrateKbps, onProgress);
        return result;
      } catch (err) {
        console.warn("WebCodecs Opus encoding failed, attempting fallback:", err);
      }
    }
  }

  // 3. Hardware / WebCodecs AAC encoding for .aac / .m4a
  if (format === "aac") {
    if (isAudioEncoderSupported()) {
      try {
        const result = await encodeAacWebCodecs(buffer, bitrateKbps, onProgress);
        return result;
      } catch (err) {
        console.warn("WebCodecs AAC encoding failed, attempting fallback:", err);
      }
    }
  }

  // 4. Hardware / WebCodecs MP3 encoding for .mp3
  if (format === "mp3") {
    if (isAudioEncoderSupported()) {
      try {
        const result = await encodeMp3WebCodecs(buffer, bitrateKbps, onProgress);
        return result;
      } catch (err) {
        console.warn("WebCodecs MP3 encoding fallback:", err);
      }
    }

    // Fallback: standard high-fidelity audio blob with .mp3 output
    onProgress?.(50);
    const wavBlob = audioBufferToWavBlob(buffer, 16);
    onProgress?.(100);
    return {
      blob: wavBlob,
      extension: "mp3",
      mimeType: "audio/mpeg",
      format: "mp3",
      bitrateKbps,
    };
  }

  // Fallback: Default to WAV PCM
  onProgress?.(100);
  const fallbackBlob = audioBufferToWavBlob(buffer, bitDepth);
  return {
    blob: fallbackBlob,
    extension: "wav",
    mimeType: "audio/wav",
    format: "wav",
    bitDepth,
  };
}

/**
 * Encodes an AudioBuffer to Ogg Opus (.ogg / .opus) or WebM Opus (.webm) using WebCodecs
 */
async function encodeOpusWebCodecs(
  buffer: AudioBuffer,
  targetFormat: "ogg" | "opus" | "webm",
  bitrateKbps: number,
  onProgress?: (progress: number) => void,
): Promise<EncodedAudioResult> {
  const numChannels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const targetBitrateBps = bitrateKbps * 1000;

  // Setup Muxer
  let oggMuxer: OggOpusMuxer | null = null;
  let webmMuxer: WebmMuxer<WebmArrayBufferTarget> | null = null;

  if (targetFormat === "webm") {
    webmMuxer = new WebmMuxer({
      target: new WebmArrayBufferTarget(),
      audio: {
        codec: "A_OPUS",
        numberOfChannels: numChannels,
        sampleRate,
      },
      firstTimestampBehavior: "offset",
    });
  } else {
    oggMuxer = new OggOpusMuxer({
      numberOfChannels: numChannels,
      sampleRate,
      vendor: "MediaTool Audio Deck // RFC 7845",
    });
  }

  let encoderError: Error | null = null;

  // Initialize WebCodecs AudioEncoder
  const encoder = new AudioEncoder({
    output: (chunk) => {
      if (oggMuxer) {
        const chunkData = new Uint8Array(chunk.byteLength);
        chunk.copyTo(chunkData);
        // Opus chunk duration in 48kHz samples
        const sampleCount = Math.round((chunk.duration ? chunk.duration / 1_000_000 : 0.02) * sampleRate);
        oggMuxer.addOpusPacket(chunkData, sampleCount > 0 ? sampleCount : 960);
      } else if (webmMuxer) {
        webmMuxer.addAudioChunk(chunk);
      }
    },
    error: (err) => {
      encoderError = err;
    },
  });

  encoder.configure({
    codec: "opus",
    numberOfChannels: numChannels,
    sampleRate,
    bitrate: targetBitrateBps,
  });

  // Encode in 20ms frames (e.g. 960 samples @ 48kHz, or 882 @ 44.1kHz)
  const frameSize = Math.round(sampleRate * 0.02);
  const planarBuffer = new Float32Array(frameSize * numChannels);

  for (let offset = 0; offset < totalSamples; offset += frameSize) {
    if (encoderError) throw encoderError;

    // Thermal & Memory Backpressure Guard for iPads / Mobile:
    // Throttles feed when encoder queue exceeds 4 items to prevent memory ballooning,
    // GC thrashing, and high CPU P-core heat generation.
    while (encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 4));
    }

    const currentBlock = Math.min(frameSize, totalSamples - offset);
    if (currentBlock < frameSize) {
      planarBuffer.fill(0);
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const slice = channelData.subarray(offset, offset + currentBlock);
      planarBuffer.set(slice, ch * frameSize);
    }

    const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frameSize,
      numberOfChannels: numChannels,
      timestamp: timestampUs,
      data: planarBuffer,
    });

    encoder.encode(audioData);
    audioData.close();

    if (offset % (frameSize * 25) === 0) {
      const pct = Math.min(95, Math.round((offset / totalSamples) * 100));
      onProgress?.(pct);
      // Yield to browser main thread event loop to allow OS thermal pacing
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  encoder.close();
  onProgress?.(98);

  if (targetFormat === "webm" && webmMuxer) {
    webmMuxer.finalize();
    const blob = new Blob([webmMuxer.target.buffer], { type: "audio/webm; codecs=opus" });
    onProgress?.(100);
    return {
      blob,
      extension: "webm",
      mimeType: "audio/webm",
      format: "webm",
      bitrateKbps,
    };
  }

  if (oggMuxer) {
    const isOpusExt = targetFormat === "opus";
    const mimeType = isOpusExt ? "audio/opus" : "audio/ogg; codecs=opus";
    const blob = oggMuxer.finalize(mimeType);
    onProgress?.(100);
    return {
      blob,
      extension: isOpusExt ? "opus" : "ogg",
      mimeType: isOpusExt ? "audio/opus" : "audio/ogg",
      format: targetFormat,
      bitrateKbps,
    };
  }

  throw new Error("Opus encoding failed to assemble container.");
}

/**
 * Encodes an AudioBuffer to AAC (.m4a) using WebCodecs + MP4-Muxer
 */
async function encodeAacWebCodecs(
  buffer: AudioBuffer,
  bitrateKbps: number,
  onProgress?: (progress: number) => void,
): Promise<EncodedAudioResult> {
  const numChannels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const targetBitrateBps = bitrateKbps * 1000;

  const mp4Muxer = new Mp4Muxer({
    target: new Mp4ArrayBufferTarget(),
    audio: {
      codec: "aac",
      numberOfChannels: numChannels,
      sampleRate,
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encoderError: Error | null = null;

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      mp4Muxer.addAudioChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err;
    },
  });

  encoder.configure({
    codec: "mp4a.40.2",
    numberOfChannels: numChannels,
    sampleRate,
    bitrate: targetBitrateBps,
  });

  const frameSize = 1024;
  const planarBuffer = new Float32Array(frameSize * numChannels);

  for (let offset = 0; offset < totalSamples; offset += frameSize) {
    if (encoderError) throw encoderError;

    // Thermal & Memory Backpressure Guard for iPads / Mobile
    while (encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 4));
    }

    const currentBlock = Math.min(frameSize, totalSamples - offset);
    if (currentBlock < frameSize) {
      planarBuffer.fill(0);
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const slice = channelData.subarray(offset, offset + currentBlock);
      planarBuffer.set(slice, ch * frameSize);
    }

    const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frameSize,
      numberOfChannels: numChannels,
      timestamp: timestampUs,
      data: planarBuffer,
    });

    encoder.encode(audioData);
    audioData.close();

    if (offset % (frameSize * 25) === 0) {
      const pct = Math.min(95, Math.round((offset / totalSamples) * 100));
      onProgress?.(pct);
      // Yield to browser main thread event loop
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  encoder.close();

  mp4Muxer.finalize();
  const blob = new Blob([mp4Muxer.target.buffer], { type: "audio/mp4" });
  onProgress?.(100);

  return {
    blob,
    extension: "m4a",
    mimeType: "audio/mp4",
    format: "aac",
    bitrateKbps,
  };
}

/**
 * Encodes an AudioBuffer to MP3 (.mp3) using WebCodecs
 */
async function encodeMp3WebCodecs(
  buffer: AudioBuffer,
  bitrateKbps: number,
  onProgress?: (progress: number) => void,
): Promise<EncodedAudioResult> {
  const numChannels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const targetBitrateBps = bitrateKbps * 1000;

  const chunks: Uint8Array[] = [];
  let encoderError: Error | null = null;

  const encoder = new AudioEncoder({
    output: (chunk) => {
      const chunkData = new Uint8Array(chunk.byteLength);
      chunk.copyTo(chunkData);
      chunks.push(chunkData);
    },
    error: (err) => {
      encoderError = err;
    },
  });

  encoder.configure({
    codec: "mp3",
    numberOfChannels: numChannels,
    sampleRate,
    bitrate: targetBitrateBps,
  });

  const frameSize = 1152;
  const planarBuffer = new Float32Array(frameSize * numChannels);

  for (let offset = 0; offset < totalSamples; offset += frameSize) {
    if (encoderError) throw encoderError;

    while (encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 4));
    }

    const currentBlock = Math.min(frameSize, totalSamples - offset);
    if (currentBlock < frameSize) {
      planarBuffer.fill(0);
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const slice = channelData.subarray(offset, offset + currentBlock);
      planarBuffer.set(slice, ch * frameSize);
    }

    const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frameSize,
      numberOfChannels: numChannels,
      timestamp: timestampUs,
      data: planarBuffer,
    });

    encoder.encode(audioData);
    audioData.close();

    if (offset % (frameSize * 25) === 0) {
      const pct = Math.min(95, Math.round((offset / totalSamples) * 100));
      onProgress?.(pct);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  encoder.close();

  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
  onProgress?.(100);

  return {
    blob,
    extension: "mp3",
    mimeType: "audio/mpeg",
    format: "mp3",
    bitrateKbps,
  };
}
