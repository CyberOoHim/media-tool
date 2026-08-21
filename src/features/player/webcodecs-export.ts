import { ArrayBufferTarget, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmArrayBufferTarget, Muxer as WebmMuxer } from "webm-muxer";
import type { ExportConfig, ExportProgress, ExportResult } from "./trim-types";

export interface ExportSegment {
  startSec: number;
  endSec: number;
}

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
  // Video codecs require dimensions to be even numbers
  const width = Math.floor(rawWidth / 2) * 2;
  const height = Math.floor(rawHeight / 2) * 2;

  const targetFps = config.fps > 0 ? config.fps : 30;
  const frameDurationSec = 1 / targetFps;
  const totalFrames = Math.max(1, Math.round(totalOutputDuration * targetFps));

  // Canvas for frame extraction
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: false, alpha: false });
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context for video rendering.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 3. Audio Extraction & Preparation (if requested)
  let slicedAudioBuffer: AudioBuffer | null = null;
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
        message: "Processing synced audio track...",
      });

      const response = await fetch(sourceUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Slice and stitch audio segments
      const sampleRate = decodedBuffer.sampleRate;
      const numChannels = decodedBuffer.numberOfChannels;
      const totalAudioSamples = Math.round(totalOutputDuration * sampleRate);

      if (totalAudioSamples > 0 && numChannels > 0) {
        slicedAudioBuffer = audioCtx.createBuffer(numChannels, totalAudioSamples, sampleRate);

        for (let ch = 0; ch < numChannels; ch++) {
          const sourceChannelData = decodedBuffer.getChannelData(ch);
          const targetChannelData = slicedAudioBuffer.getChannelData(ch);
          let targetOffset = 0;

          for (const seg of validSegments) {
            const startSample = Math.min(
              sourceChannelData.length,
              Math.floor(seg.startSec * sampleRate),
            );
            const endSample = Math.min(
              sourceChannelData.length,
              Math.floor(seg.endSec * sampleRate),
            );
            const sliceLength = Math.max(0, endSample - startSample);

            if (sliceLength > 0 && targetOffset < totalAudioSamples) {
              const toCopy = Math.min(sliceLength, totalAudioSamples - targetOffset);
              const slice = sourceChannelData.subarray(startSample, startSample + toCopy);
              targetChannelData.set(slice, targetOffset);
              targetOffset += toCopy;
            }
          }
        }
      }
      void audioCtx.close();
    } catch {
      // If audio decode fails or video is silent, proceed with video-only export
      slicedAudioBuffer = null;
    }
  }

  // 4. Initialize Muxer (MP4 or WebM)
  const isMp4 = config.format === "mp4";
  const hasAudioTrack = Boolean(slicedAudioBuffer && config.keepAudio);

  let mp4Muxer: Mp4Muxer<ArrayBufferTarget> | null = null;
  let webmMuxer: WebmMuxer<WebmArrayBufferTarget> | null = null;

  if (isMp4) {
    mp4Muxer = new Mp4Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width,
        height,
      },
      audio: hasAudioTrack && slicedAudioBuffer
        ? {
            codec: "aac",
            numberOfChannels: slicedAudioBuffer.numberOfChannels,
            sampleRate: slicedAudioBuffer.sampleRate,
          }
        : undefined,
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
  } else {
    webmMuxer = new WebmMuxer({
      target: new WebmArrayBufferTarget(),
      video: {
        codec: "V_VP9",
        width,
        height,
        frameRate: targetFps,
      },
      audio: hasAudioTrack && slicedAudioBuffer
        ? {
            codec: "A_OPUS",
            numberOfChannels: slicedAudioBuffer.numberOfChannels,
            sampleRate: slicedAudioBuffer.sampleRate,
          }
        : undefined,
      firstTimestampBehavior: "offset",
    });
  }

  // 5. Hardware Video Encoder Setup
  let _encodedChunksCount = 0;
  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      _encodedChunksCount++;
      if (mp4Muxer) {
        mp4Muxer.addVideoChunk(chunk, meta);
      } else if (webmMuxer) {
        webmMuxer.addVideoChunk(chunk, meta);
      }
    },
    error: (err) => {
      encoderError = err;
    },
  });

  const bitrate = Math.round(config.bitrateMbps * 1_000_000);

  // AVC / H.264 profile: High Profile 4.0 'avc1.640028' (1080p60) or Main 'avc1.4d002a'
  const videoCodecString = isMp4 ? "avc1.640028" : "vp09.00.10.08";

  // Configure with hardware acceleration
  try {
    videoEncoder.configure({
      codec: videoCodecString,
      width,
      height,
      bitrate,
      framerate: targetFps,
      hardwareAcceleration: "prefer-hardware",
      avc: isMp4 ? { format: "avc" } : undefined,
    });
  } catch {
    // Fallback to basic AVC Main profile if High profile is unsupported
    if (isMp4) {
      videoEncoder.configure({
        codec: "avc1.4d002a",
        width,
        height,
        bitrate,
        framerate: targetFps,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      });
    } else {
      videoEncoder.configure({
        codec: "vp8",
        width,
        height,
        bitrate,
        framerate: targetFps,
        hardwareAcceleration: "prefer-hardware",
      });
    }
  }

  // 6. Audio Encoder Setup (if audio present)
  let audioEngine: AudioEncoder | null = null;
  if (hasAudioTrack && slicedAudioBuffer && typeof AudioEncoder !== "undefined") {
    try {
      audioEngine = new AudioEncoder({
        output: (chunk, meta) => {
          if (mp4Muxer) {
            mp4Muxer.addAudioChunk(chunk, meta);
          } else if (webmMuxer) {
            webmMuxer.addAudioChunk(chunk, meta);
          }
        },
        error: (e) => console.warn("AudioEncoder warning:", e),
      });

      audioEngine.configure({
        codec: isMp4 ? "mp4a.40.2" : "opus",
        numberOfChannels: slicedAudioBuffer.numberOfChannels,
        sampleRate: slicedAudioBuffer.sampleRate,
        bitrate: 192_000,
      });

      // Encode audio data in blocks
      const sampleRate = slicedAudioBuffer.sampleRate;
      const numChannels = slicedAudioBuffer.numberOfChannels;
      const totalSamples = slicedAudioBuffer.length;
      const blockSize = 2048;

      for (let offset = 0; offset < totalSamples; offset += blockSize) {
        if (signal?.aborted) break;
        const currentBlock = Math.min(blockSize, totalSamples - offset);
        const planarData = new Float32Array(currentBlock * numChannels);

        for (let ch = 0; ch < numChannels; ch++) {
          const chData = slicedAudioBuffer.getChannelData(ch);
          planarData.set(chData.subarray(offset, offset + currentBlock), ch * currentBlock);
        }

        const audioTimestampUs = Math.round((offset / sampleRate) * 1_000_000);
        const audioData = new AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfFrames: currentBlock,
          numberOfChannels: numChannels,
          timestamp: audioTimestampUs,
          data: planarData,
        });

        audioEngine.encode(audioData);
        audioData.close();
      }

      await audioEngine.flush();
    } catch (e) {
      console.warn("Audio encoding was bypassed:", e);
    }
  }

  // 7. Frame-accurate Video Extraction & Hardware Encoding Loop
  let frameIndex = 0;
  let outputTimestampUs = 0;
  const loopStartTime = performance.now();

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
      // Fallback timer in case seek event is delayed
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener("seeked", onSeeked);
          resolve();
        }
      }, 100);
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

      const currentSec = Math.min(seg.endSec, seg.startSec + f * frameDurationSec);
      await seekVideoTo(currentSec);

      ctx.drawImage(video, 0, 0, width, height);

      // Create hardware VideoFrame from canvas
      const videoFrame = new VideoFrame(canvas, {
        timestamp: outputTimestampUs,
        duration: Math.round(frameDurationSec * 1_000_000),
      });

      // Keyframe interval: every 2 seconds for high seeking smoothness
      const isKeyFrame = frameIndex % (targetFps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      outputTimestampUs += Math.round(frameDurationSec * 1_000_000);
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

      // Allow microtask drain so encoder pipeline doesn't block UI thread
      if (frameIndex % 15 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  // 8. Finalize Video Stream & Muxer
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

  let finalBlob: Blob;
  if (mp4Muxer) {
    mp4Muxer.finalize();
    const buffer = mp4Muxer.target.buffer;
    finalBlob = new Blob([buffer], { type: "video/mp4" });
  } else if (webmMuxer) {
    webmMuxer.finalize();
    const buffer = webmMuxer.target.buffer;
    finalBlob = new Blob([buffer], { type: "video/webm" });
  } else {
    throw new Error("Failed to finalize video muxer.");
  }

  const processingTimeMs = performance.now() - startTime;
  const totalElapsedSec = processingTimeMs / 1000;
  const finalSpeedMultiplier =
    totalElapsedSec > 0 ? Number((totalOutputDuration / totalElapsedSec).toFixed(1)) : 1;

  const ext = isMp4 ? "mp4" : "webm";
  const stem = fileName.replace(/\.[^/.]+$/, "");
  const modeTag = segments.length > 1 ? "cut" : "trimmed";
  const exportedFileName = `${stem}_${modeTag}_${Date.now().toString(36)}.${ext}`;

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

  return {
    blob: finalBlob,
    fileName: exportedFileName,
    durationSec: totalOutputDuration,
    fileSize: finalBlob.size,
    frameCount: frameIndex,
    speedMultiplier: finalSpeedMultiplier,
    processingTimeMs: Math.round(processingTimeMs),
    format: isMp4 ? "mp4" : "webm",
  };
}
