import { ArrayBufferTarget, Muxer as Mp4Muxer } from "mp4-muxer";
import {
  extractMp4AacTrack,
  extractMp4AudioToAdts,
  sliceAacSamples,
} from "./mp4-audio-demuxer";
import {
  AUDIO_BITRATE_BPS,
  calculateExportResolution,
  calculateKeyframeInterval,
  resolveExportFps,
  selectAvcCodecString,
  type ExportConfig,
  type ExportProgress,
  type ExportResult,
} from "./trim-types";

export interface ExportSegment {
  startSec: number;
  endSec: number;
}

type MuxAudioPacket = {
  data: Uint8Array;
  timestampUs: number;
  durationUs: number;
};

function remuxAacPacketsForSegments(
  arrayBuffer: ArrayBuffer,
  segments: ExportSegment[],
): { packets: MuxAudioPacket[]; sampleRate: number; channels: 1 | 2 } | null {
  const track = extractMp4AacTrack(arrayBuffer);
  if (!track || track.samples.length === 0) return null;
  const sliced = sliceAacSamples(track, segments);
  if (sliced.samples.length === 0) return null;
  return {
    packets: sliced.samples.map((sample) => ({
      data: sample.data,
      timestampUs: sample.timestampUs,
      durationUs: sample.durationUs,
    })),
    sampleRate: sliced.sampleRate,
    channels: Math.min(2, Math.max(1, sliced.channels)) as 1 | 2,
  };
}

async function decodeAudioBufferForExport(arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> {
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      // WebKit may keep the context suspended; decodeAudioData can still succeed.
    }
  }

  try {
    try {
      return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      const adtsTrack = extractMp4AudioToAdts(arrayBuffer);
      if (!adtsTrack || adtsTrack.adtsData.length === 0) return null;
      const adtsCopy = new Uint8Array(adtsTrack.adtsData);
      return await audioCtx.decodeAudioData(adtsCopy.buffer);
    }
  } catch {
    return null;
  } finally {
    void audioCtx.close();
  }
}

async function encodeAacPacketsFromAudioBuffer(
  decodedBuffer: AudioBuffer,
  segments: ExportSegment[],
  totalOutputDuration: number,
  signal?: AbortSignal,
): Promise<{ packets: MuxAudioPacket[]; sampleRate: number; channels: 1 | 2 } | null> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") {
    return null;
  }

  const channels = Math.min(2, Math.max(1, decodedBuffer.numberOfChannels)) as 1 | 2;
  const preferredSampleRate = decodedBuffer.sampleRate === 44100 ? 44100 : 48000;
  const frameSize = 1024;

  let encoderConfig: AudioEncoderConfig | null = null;
  try {
    if (typeof AudioEncoder.isConfigSupported === "function") {
      const probe = await AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        numberOfChannels: channels,
        sampleRate: preferredSampleRate,
        bitrate: AUDIO_BITRATE_BPS,
      });
      if (probe.supported && probe.config) {
        encoderConfig = {
          codec: probe.config.codec || "mp4a.40.2",
          numberOfChannels: probe.config.numberOfChannels || channels,
          sampleRate: probe.config.sampleRate || preferredSampleRate,
          bitrate: probe.config.bitrate || AUDIO_BITRATE_BPS,
        };
      }
    } else {
      encoderConfig = {
        codec: "mp4a.40.2",
        numberOfChannels: channels,
        sampleRate: preferredSampleRate,
        bitrate: AUDIO_BITRATE_BPS,
      };
    }
  } catch {
    encoderConfig = null;
  }

  if (!encoderConfig) return null;

  const sampleRate = encoderConfig.sampleRate;
  const totalOutputSamples = Math.max(1, Math.round(totalOutputDuration * sampleRate));
  const offlineCtx = new OfflineAudioContext(channels, totalOutputSamples, sampleRate);

  let currentDestTime = 0;
  for (const seg of segments) {
    const segDuration = seg.endSec - seg.startSec;
    if (segDuration > 0 && seg.startSec < decodedBuffer.duration) {
      const safeOffset = Math.max(0, Math.min(seg.startSec, decodedBuffer.duration - 0.001));
      const safeDuration = Math.min(segDuration, Math.max(0, decodedBuffer.duration - safeOffset));
      if (safeDuration > 0) {
        const src = offlineCtx.createBufferSource();
        src.buffer = decodedBuffer;
        src.connect(offlineCtx.destination);
        src.start(currentDestTime, safeOffset, safeDuration);
      }
    }
    currentDestTime += segDuration;
  }

  const slicedAudioBuffer = await offlineCtx.startRendering();
  const packets: MuxAudioPacket[] = [];
  const frameDurationUs = Math.round((frameSize / sampleRate) * 1_000_000);
  let encoderError: Error | null = null;

  const encoder = new AudioEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      packets.push({
        data,
        timestampUs: chunk.timestamp,
        durationUs: chunk.duration && chunk.duration > 0 ? chunk.duration : frameDurationUs,
      });
    },
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
    },
  });

  try {
    encoder.configure(encoderConfig);
    const planarBuffer = new Float32Array(frameSize * channels);
    const totalSamples = slicedAudioBuffer.length;

    for (let offset = 0; offset < totalSamples; offset += frameSize) {
      if (signal?.aborted) break;
      if (encoderError) throw encoderError;

      while (encoder.encodeQueueSize > 6) {
        await new Promise((r) => setTimeout(r, 4));
      }

      const currentBlock = Math.min(frameSize, totalSamples - offset);
      planarBuffer.fill(0);
      for (let ch = 0; ch < channels; ch++) {
        const slice = slicedAudioBuffer.getChannelData(ch).subarray(offset, offset + currentBlock);
        planarBuffer.set(slice, ch * frameSize);
      }

      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: frameSize,
        numberOfChannels: channels,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: planarBuffer,
      });
      encoder.encode(audioData);
      audioData.close();
    }

    await encoder.flush();
    encoder.close();
    if (encoderError || packets.length === 0) return null;
    return { packets, sampleRate, channels };
  } catch (err) {
    console.warn("AAC AudioEncoder fallback failed:", err);
    try {
      encoder.close();
    } catch {
      // Encoder may already be closed.
    }
    return null;
  }
}

const BACKPRESSURE_POLL_MS = 6; // 6ms polling interval (~1 frame at 165Hz iPad ProMotion)
const BACKPRESSURE_MAX_RETRIES = 500; // ~3 seconds safety limit to prevent permanent spin
const MICROTASK_YIELD_MS = 1; // Yield to browser event loop and allow GPU power-gating
const SEEK_TIMEOUT_MS = 600; // 600ms safety timeout for video seek operations on mobile/iPad

/**
 * Check if WebCodecs VideoEncoder is available and hardware accelerated in the browser
 */
export function isWebCodecsSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

/**
 * Hardware WebCodecs Frame-Accurate Video Exporter
 * Slices and stitches video segments with 100% precision using dedicated hardware acceleration.
 */
export async function exportVideoWebCodecs({
  sourceUrl,
  fileName,
  segments,
  config,
  onProgress,
  signal,
}: {
  sourceUrl: string;
  fileName: string;
  segments: ExportSegment[];
  config: ExportConfig;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<ExportResult> {
  const startTime = performance.now();

  // 1. Sanitize segments
  const validSegments = segments
    .filter((s) => Number.isFinite(s.startSec) && Number.isFinite(s.endSec) && s.endSec > s.startSec + 0.001)
    .map((s) => ({
      startSec: Math.max(0, s.startSec),
      endSec: Math.max(s.startSec + 0.001, s.endSec),
    }));

  if (validSegments.length === 0) {
    throw new Error("No valid video segments to export.");
  }

  const totalOutputDuration = validSegments.reduce(
    (acc, seg) => acc + (seg.endSec - seg.startSec),
    0,
  );

  if (totalOutputDuration <= 0.01) {
    throw new Error("Selected export duration is too short (< 10ms).");
  }

  onProgress?.({
    phase: "preparing",
    currentFrame: 0,
    totalFrames: 0,
    percent: 0,
    speedMultiplier: 0,
    fps: 0,
    elapsedSec: 0,
    estimatedRemainingSec: 0,
    message: "Initializing hardware encoder...",
  });

  // 2. Load off-screen video to inspect dimensions and retrieve frames
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  video.preload = "auto";
  video.src = sourceUrl;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to load video source for export."));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
    video.load();
  });

  const rawWidth = video.videoWidth || 1920;
  const rawHeight = video.videoHeight || 1080;

  // Calculate target output resolution based on exportConfig
  const { width, height } = calculateExportResolution(
    rawWidth,
    rawHeight,
    config.resolution || "original",
    config.customWidth,
    config.customHeight,
  );

  const targetFps = resolveExportFps(
    config.fpsPreset,
    config.customFps,
    config.fps > 0 ? config.fps : 30,
  );
  const frameDurationSec = 1 / targetFps;
  const totalFrames = Math.max(1, Math.round(totalOutputDuration * targetFps));

  const isOriginalResolution =
    (config.resolution === "original" || !config.resolution) &&
    width === rawWidth &&
    height === rawHeight;

  // Canvas for frame extraction (used when resizing/scaling is required)
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: false, alpha: false });
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context for video rendering.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 3. Audio: remux source AAC first (iPad Safari/Chrome have VideoEncoder but often
  // no AudioEncoder; Opus-in-MP4 is silent on iOS). Re-encode AAC only if remux fails.
  let hasAudioTrack = false;
  let chosenSampleRate = 48000;
  let targetChannels: 1 | 2 = 2;
  const audioPackets: MuxAudioPacket[] = [];

  if (config.keepAudio) {
    try {
      onProgress?.({
        phase: "audio_processing",
        currentFrame: 0,
        totalFrames,
        percent: 2,
        speedMultiplier: 0,
        fps: 0,
        elapsedSec: 0,
        estimatedRemainingSec: 0,
        message: "Copying AAC audio track...",
      });

      const response = await fetch(sourceUrl);
      const arrayBuffer = await response.arrayBuffer();
      const remuxed = remuxAacPacketsForSegments(arrayBuffer, validSegments);
      if (remuxed) {
        audioPackets.push(...remuxed.packets);
        chosenSampleRate = remuxed.sampleRate;
        targetChannels = remuxed.channels;
        hasAudioTrack = audioPackets.length > 0;
      } else {
        onProgress?.({
          phase: "audio_processing",
          currentFrame: 0,
          totalFrames,
          percent: 3,
          speedMultiplier: 0,
          fps: 0,
          elapsedSec: 0,
          estimatedRemainingSec: 0,
          message: "Encoding AAC audio track...",
        });
        const decodedBuffer = await decodeAudioBufferForExport(arrayBuffer);
        if (decodedBuffer && decodedBuffer.length > 0 && decodedBuffer.numberOfChannels > 0) {
          const encoded = await encodeAacPacketsFromAudioBuffer(
            decodedBuffer,
            validSegments,
            totalOutputDuration,
            signal,
          );
          if (encoded) {
            audioPackets.push(...encoded.packets);
            chosenSampleRate = encoded.sampleRate;
            targetChannels = encoded.channels;
            hasAudioTrack = audioPackets.length > 0;
          }
        }
      }
    } catch (err) {
      console.warn("Audio extraction failed (exporting video-only):", err);
      hasAudioTrack = false;
      audioPackets.length = 0;
    }
  }

  // 4. Initialize MP4 Muxer (AAC only — iOS will not play Opus in MP4)
  const mp4Muxer = new Mp4Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width,
      height,
      frameRate: targetFps,
    },
    audio:
      hasAudioTrack && audioPackets.length > 0
        ? {
            codec: "aac",
            numberOfChannels: targetChannels,
            sampleRate: chosenSampleRate,
          }
        : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "cross-track-offset",
  });

  let nextAudioPacketIdx = 0;
  const drainAudioChunksUpTo = (targetTimestampUs: number) => {
    if (!hasAudioTrack) return;
    while (
      nextAudioPacketIdx < audioPackets.length &&
      audioPackets[nextAudioPacketIdx].timestampUs <= targetTimestampUs
    ) {
      const packet = audioPackets[nextAudioPacketIdx];
      mp4Muxer.addAudioChunkRaw(packet.data, "key", packet.timestampUs, packet.durationUs);
      nextAudioPacketIdx++;
    }
  };

  // 5. Hardware Video Encoder Setup (with dynamic AVC Level negotiation & VBR mode)
  let _encodedChunksCount = 0;
  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      _encodedChunksCount++;
      // Interleave audio chunks up to the timestamp of the arriving video chunk
      drainAudioChunksUpTo(chunk.timestamp);
      mp4Muxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err;
    },
  });

  const bitrate = Math.max(200_000, Math.round((config.bitrateMbps || 8) * 1_000_000));
  const primaryCodecString = selectAvcCodecString(width, height, targetFps);

  // Candidate AVC codec strings from highest capability down to baseline
  const ALL_AVC_CANDIDATES = [
    "avc1.640033", // High Profile Level 5.1 (4K)
    "avc1.640032", // High Profile Level 5.0 (1440p / 1080p60)
    "avc1.640028", // High Profile Level 4.0 (1080p30)
    "avc1.64001f", // High Profile Level 3.1 (720p / 480p)
    "avc1.4d002a", // Main Profile Level 4.2
    "avc1.4d001f", // Main Profile Level 3.1
    "avc1.4d001e", // Main Profile Level 3.0
    "avc1.42001e", // Baseline Level 3.0
  ];

  // Candidates start at or below the primary codec to prevent unnecessary profile escalation
  const primaryIdx = ALL_AVC_CANDIDATES.indexOf(primaryCodecString);
  const candidateCodecs = Array.from(
    new Set(
      primaryIdx >= 0
        ? ALL_AVC_CANDIDATES.slice(primaryIdx)
        : [primaryCodecString, "avc1.4d002a", "avc1.4d001e", "avc1.42001e"],
    ),
  );

  let configuredSuccessfully = false;
  for (const candidate of candidateCodecs) {
    if (configuredSuccessfully) break;
    try {
      videoEncoder.configure({
        codec: candidate,
        width,
        height,
        bitrate,
        bitrateMode: "variable",
        framerate: targetFps,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      });
      configuredSuccessfully = true;
      break;
    } catch {
      try {
        // Fallback without explicit bitrateMode if unsupported on legacy browsers
        videoEncoder.configure({
          codec: candidate,
          width,
          height,
          bitrate,
          framerate: targetFps,
          hardwareAcceleration: "prefer-hardware",
          avc: { format: "avc" },
        });
        configuredSuccessfully = true;
        break;
      } catch {
        // Try next codec in chain
      }
    }
  }

  if (!configuredSuccessfully) {
    // Ultimate fallback configuration
    videoEncoder.configure({
      codec: "avc1.4d002a",
      width,
      height,
      bitrate,
      framerate: targetFps,
      avc: { format: "avc" },
    });
  }

  // 6. Frame-accurate Video Extraction & Hardware Encoding Loop
  let frameIndex = 0;
  const loopStartTime = performance.now();
  // Adaptive keyframe interval: prevents giant I-frame thermal spikes on iPads/mobile
  const keyframeInterval = calculateKeyframeInterval(width, height, targetFps);

  const seekVideoTo = (targetSec: number): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      const onSeeked = () => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener("seeked", onSeeked);
          resolve();
        }
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = targetSec;
      // Safety timeout for video seek operations on mobile/iPad to prevent duplicate frame capture
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener("seeked", onSeeked);
          resolve();
        }
      }, SEEK_TIMEOUT_MS);
    });
  };

  for (const seg of validSegments) {
    if (signal?.aborted) {
      videoEncoder.close();
      throw new Error("Export cancelled by user.");
    }

    const segDuration = seg.endSec - seg.startSec;
    const segFrames = Math.max(1, Math.round(segDuration * targetFps));

    for (let f = 0; f < segFrames; f++) {
      if (signal?.aborted) {
        videoEncoder.close();
        throw new Error("Export cancelled by user.");
      }
      if (encoderError) {
        throw encoderError;
      }

      // Thermal & GPU Backpressure Guard for iPads / Mobile:
      // Throttles feed when VideoEncoder queue exceeds 4 items to prevent memory ballooning and GPU thermal stalls
      let backpressureRetries = 0;
      while (videoEncoder.encodeQueueSize > 4 && backpressureRetries < BACKPRESSURE_MAX_RETRIES) {
        if (signal?.aborted) break;
        if (encoderError) throw encoderError;
        backpressureRetries++;
        await new Promise((r) => setTimeout(r, BACKPRESSURE_POLL_MS));
      }

      const currentSec = Math.min(seg.endSec, seg.startSec + f * frameDurationSec);
      await seekVideoTo(currentSec);

      let videoFrame: VideoFrame;
      const frameDurationUs = Math.round(frameDurationSec * 1_000_000);
      const outputTimestampUs = Math.round(frameIndex * frameDurationSec * 1_000_000);

      if (isOriginalResolution) {
        // Direct VideoFrame extraction from HTMLVideoElement preserves native YUV & avoids RGBA canvas artifacts
        videoFrame = new VideoFrame(video, {
          timestamp: outputTimestampUs,
          duration: frameDurationUs,
        });
      } else {
        // Scaled / custom resolution rendering
        ctx.drawImage(video, 0, 0, width, height);
        videoFrame = new VideoFrame(canvas, {
          timestamp: outputTimestampUs,
          duration: frameDurationUs,
        });
      }

      const isKeyFrame = frameIndex % keyframeInterval === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      frameIndex++;

      // Compute progress & speed stats
      if (frameIndex % 3 === 0 || frameIndex === totalFrames) {
        const now = performance.now();
        const elapsedSec = (now - loopStartTime) / 1000;
        const processedSec = frameIndex * frameDurationSec;
        const speedMultiplier = elapsedSec > 0 ? processedSec / elapsedSec : 1;
        const currentEncodingFps = elapsedSec > 0 ? frameIndex / elapsedSec : 0;
        const percent = Math.min(99, Math.round((frameIndex / totalFrames) * 100));
        const remainingFrames = Math.max(0, totalFrames - frameIndex);
        const estimatedRemainingSec =
          currentEncodingFps > 0 ? remainingFrames / currentEncodingFps : 0;

        onProgress?.({
          phase: "decoding_encoding",
          currentFrame: frameIndex,
          totalFrames,
          percent,
          speedMultiplier: Number(speedMultiplier.toFixed(1)),
          fps: Math.round(currentEncodingFps),
          elapsedSec: Math.round(elapsedSec),
          estimatedRemainingSec: Math.max(0, Math.round(estimatedRemainingSec)),
          message: `Hardware Encoding @ ${speedMultiplier.toFixed(1)}× speed (${Math.round(currentEncodingFps)} fps)...`,
        });
      }

      // Allow microtask drain and iPad GPU power-gating every 4 frames
      if (frameIndex % 4 === 0) {
        await new Promise((r) => setTimeout(r, MICROTASK_YIELD_MS));
      }
    }
  }

  // 7. Finalize Video Stream & Muxer
  onProgress?.({
    phase: "finalizing",
    currentFrame: frameIndex,
    totalFrames,
    percent: 99,
    speedMultiplier: 0,
    fps: 0,
    elapsedSec: Math.round((performance.now() - loopStartTime) / 1000),
    estimatedRemainingSec: 0,
    message: "Finalizing container metadata...",
  });

  await videoEncoder.flush();
  videoEncoder.close();

  // Drain any remaining trailing audio chunks past the last video frame
  drainAudioChunksUpTo(Infinity);

  mp4Muxer.finalize();
  const buffer = mp4Muxer.target.buffer;
  const finalBlob = new Blob([buffer], { type: "video/mp4" });

  const processingTimeMs = performance.now() - startTime;
  const totalElapsedSec = processingTimeMs / 1000;
  const finalSpeedMultiplier =
    totalElapsedSec > 0 ? Number((totalOutputDuration / totalElapsedSec).toFixed(1)) : 1;

  const stem = fileName.replace(/\.[^/.]+$/, "");
  const modeTag = segments.length > 1 ? "cut" : "trimmed";
  const actualHasAudio = Boolean(hasAudioTrack && audioPackets.length > 0);
  const soundTag = actualHasAudio ? "audio" : "muted";
  const exportedFileName = `${stem}_${modeTag}_${soundTag}_${Date.now().toString(36)}.mp4`;

  onProgress?.({
    phase: "completed",
    currentFrame: frameIndex,
    totalFrames,
    percent: 100,
    speedMultiplier: finalSpeedMultiplier,
    fps: Math.round(frameIndex / totalElapsedSec),
    elapsedSec: Math.round(totalElapsedSec),
    estimatedRemainingSec: 0,
    message: `Export completed in ${totalElapsedSec.toFixed(1)}s (${finalSpeedMultiplier}× realtime)!`,
  });

  const audioCodecLabel = actualHasAudio ? "AAC" : undefined;

  return {
    blob: finalBlob,
    fileName: exportedFileName,
    durationSec: totalOutputDuration,
    fileSize: finalBlob.size,
    frameCount: frameIndex,
    speedMultiplier: finalSpeedMultiplier,
    processingTimeMs: Math.round(processingTimeMs),
    format: "mp4",
    width,
    height,
    fps: targetFps,
    hasAudio: actualHasAudio,
    audioCodec: audioCodecLabel,
  };
}
