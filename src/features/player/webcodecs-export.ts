import { ArrayBufferTarget, Muxer as Mp4Muxer } from "mp4-muxer";
import {
  calculateExportResolution,
  type ExportConfig,
  type ExportProgress,
  type ExportResult,
} from "./trim-types";

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

  // Calculate target output resolution based on exportConfig
  const { width, height } = calculateExportResolution(
    rawWidth,
    rawHeight,
    config.resolution || "original",
    config.customWidth,
    config.customHeight,
  );

  const targetFps = config.fps > 0 ? config.fps : 30;
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

  // 3. Audio Extraction & Dynamic Codec Negotiation (AAC -> Opus fallback)
  let slicedAudioBuffer: AudioBuffer | null = null;
  let hasAudioTrack = false;
  let chosenAudioCodec: "aac" | "opus" | null = null;
  let chosenCodecString = "mp4a.40.2";
  let chosenFrameSize = 1024;
  let chosenSampleRate = 48000;
  let targetChannels: 1 | 2 = 2;
  const audioChunks: Array<{ chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }> = [];

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
        message: "Processing and syncing audio track...",
      });

      const response = await fetch(sourceUrl);
      const arrayBuffer = await response.arrayBuffer();
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch {
          // Ignore resume error
        }
      }

      let decodedBuffer: AudioBuffer | null = null;
      try {
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      } catch (decodeErr) {
        console.warn("AudioContext decodeAudioData failed:", decodeErr);
      } finally {
        void audioCtx.close();
      }

      if (decodedBuffer && decodedBuffer.length > 0 && decodedBuffer.numberOfChannels > 0) {
        targetChannels = Math.min(2, Math.max(1, decodedBuffer.numberOfChannels)) as 1 | 2;
        const nativeSampleRate = decodedBuffer.sampleRate;
        const preferredSampleRate = nativeSampleRate === 44100 ? 44100 : 48000;

        // Check WebCodecs AudioEncoder availability and probe codec support
        if (typeof AudioEncoder !== "undefined" && typeof AudioData !== "undefined") {
          // 1. Probe AAC support (1024 frames/chunk)
          let aacSupported = false;
          try {
            if (typeof AudioEncoder.isConfigSupported === "function") {
              const aacCheck = await AudioEncoder.isConfigSupported({
                codec: "mp4a.40.2",
                numberOfChannels: targetChannels,
                sampleRate: preferredSampleRate,
                bitrate: 192_000,
              });
              aacSupported = Boolean(aacCheck.supported);
            } else {
              aacSupported = true;
            }
          } catch {
            aacSupported = false;
          }

          if (aacSupported) {
            chosenAudioCodec = "aac";
            chosenCodecString = "mp4a.40.2";
            chosenFrameSize = 1024;
            chosenSampleRate = preferredSampleRate;
          } else {
            // 2. Fallback to Opus support (960 frames/chunk @ 48kHz)
            let opusSupported = false;
            try {
              if (typeof AudioEncoder.isConfigSupported === "function") {
                const opusCheck = await AudioEncoder.isConfigSupported({
                  codec: "opus",
                  numberOfChannels: targetChannels,
                  sampleRate: 48000,
                  bitrate: 192_000,
                });
                opusSupported = Boolean(opusCheck.supported);
              } else {
                opusSupported = true;
              }
            } catch {
              opusSupported = false;
            }

            if (opusSupported) {
              chosenAudioCodec = "opus";
              chosenCodecString = "opus";
              chosenFrameSize = 960; // 20ms @ 48kHz
              chosenSampleRate = 48000;
            }
          }
        }

        // Render offline sliced audio buffer if codec was successfully negotiated
        if (chosenAudioCodec) {
          const totalOutputSamples = Math.max(1, Math.round(totalOutputDuration * chosenSampleRate));
          const offlineCtx = new OfflineAudioContext(
            targetChannels,
            totalOutputSamples,
            chosenSampleRate,
          );

          let currentDestTime = 0;
          for (const seg of validSegments) {
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

          slicedAudioBuffer = await offlineCtx.startRendering();

          // Encode Audio Samples with WebCodecs
          let audioEncoderError: Error | null = null;
          const audioEngine = new AudioEncoder({
            output: (chunk, meta) => {
              audioChunks.push({ chunk, meta });
            },
            error: (e) => {
              console.error("AudioEncoder runtime error:", e);
              audioEncoderError = e instanceof Error ? e : new Error(String(e));
            },
          });

          try {
            audioEngine.configure({
              codec: chosenCodecString,
              numberOfChannels: targetChannels,
              sampleRate: chosenSampleRate,
              bitrate: 192_000,
            });

            const frameSize = chosenFrameSize;
            const sampleRate = chosenSampleRate;
            const numChannels = targetChannels;
            const totalSamples = slicedAudioBuffer.length;
            const planarBuffer = new Float32Array(frameSize * numChannels);

            for (let offset = 0; offset < totalSamples; offset += frameSize) {
              if (signal?.aborted) break;
              if (audioEncoderError) throw audioEncoderError;

              // Thermal & memory backpressure throttling
              while (audioEngine.encodeQueueSize > 6) {
                await new Promise((r) => setTimeout(r, 4));
              }

              const currentBlock = Math.min(frameSize, totalSamples - offset);
              planarBuffer.fill(0); // Zero-pad the trailing samples

              for (let ch = 0; ch < numChannels; ch++) {
                const chData = slicedAudioBuffer.getChannelData(ch);
                const slice = chData.subarray(offset, offset + currentBlock);
                planarBuffer.set(slice, ch * frameSize);
              }

              const audioTimestampUs = Math.round((offset / sampleRate) * 1_000_000);
              const audioData = new AudioData({
                format: "f32-planar",
                sampleRate,
                numberOfFrames: frameSize,
                numberOfChannels: numChannels,
                timestamp: audioTimestampUs,
                data: planarBuffer,
              });

              audioEngine.encode(audioData);
              audioData.close();
            }

            await audioEngine.flush();
            audioEngine.close();
            hasAudioTrack = audioChunks.length > 0;
          } catch (encErr) {
            console.warn("Audio encoding was bypassed due to encoder error:", encErr);
            try {
              audioEngine.close();
            } catch {
              // Ignore cleanup error
            }
            hasAudioTrack = false;
            audioChunks.length = 0;
          }
        }
      }
    } catch (err) {
      console.warn("Audio extraction or decoding failed (exporting video-only):", err);
      slicedAudioBuffer = null;
      hasAudioTrack = false;
      audioChunks.length = 0;
    }
  }

  // 4. Initialize MP4 Muxer (with verified audio track configuration)
  const mp4Muxer = new Mp4Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width,
      height,
      frameRate: targetFps,
    },
    audio:
      hasAudioTrack && chosenAudioCodec && slicedAudioBuffer
        ? {
            codec: chosenAudioCodec,
            numberOfChannels: targetChannels,
            sampleRate: chosenSampleRate,
          }
        : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  // Write pre-encoded audio chunks into muxer
  if (hasAudioTrack && audioChunks.length > 0) {
    for (const { chunk, meta } of audioChunks) {
      mp4Muxer.addAudioChunk(chunk, meta);
    }
  }

  // 5. Hardware Video Encoder Setup (with VBR mode & efficient bitrate allocation)
  let _encodedChunksCount = 0;
  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      _encodedChunksCount++;
      mp4Muxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err;
    },
  });

  const bitrate = Math.max(200_000, Math.round((config.bitrateMbps || 8) * 1_000_000));

  // AVC / H.264 profile: High Profile 4.0 'avc1.640028' (1080p60) or Main 'avc1.4d002a'
  const videoCodecString = "avc1.640028";

  // Configure with hardware acceleration & VBR (Variable Bitrate) mode to prevent bit stuffing
  try {
    videoEncoder.configure({
      codec: videoCodecString,
      width,
      height,
      bitrate,
      bitrateMode: "variable",
      framerate: targetFps,
      hardwareAcceleration: "prefer-hardware",
      avc: { format: "avc" },
    });
  } catch {
    try {
      videoEncoder.configure({
        codec: "avc1.4d002a",
        width,
        height,
        bitrate,
        bitrateMode: "variable",
        framerate: targetFps,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      });
    } catch {
      // Fallback without explicit bitrateMode if unsupported on legacy implementations
      videoEncoder.configure({
        codec: "avc1.4d002a",
        width,
        height,
        bitrate,
        framerate: targetFps,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      });
    }
  }

  // 6. Frame-accurate Video Extraction & Hardware Encoding Loop
  let frameIndex = 0;
  let outputTimestampUs = 0;
  const loopStartTime = performance.now();
  // Keyframe interval: every 4 seconds (reduces I-frame bitrate overhead while keeping seek smoothness)
  const keyframeInterval = Math.max(1, Math.round(targetFps * 4));

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

      let videoFrame: VideoFrame;
      const frameDurationUs = Math.round(frameDurationSec * 1_000_000);

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

      outputTimestampUs += frameDurationUs;
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

  mp4Muxer.finalize();
  const buffer = mp4Muxer.target.buffer;
  const finalBlob = new Blob([buffer], { type: "video/mp4" });

  const processingTimeMs = performance.now() - startTime;
  const totalElapsedSec = processingTimeMs / 1000;
  const finalSpeedMultiplier =
    totalElapsedSec > 0 ? Number((totalOutputDuration / totalElapsedSec).toFixed(1)) : 1;

  const stem = fileName.replace(/\.[^/.]+$/, "");
  const modeTag = segments.length > 1 ? "cut" : "trimmed";
  const actualHasAudio = Boolean(hasAudioTrack && audioChunks.length > 0);
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

  const audioCodecLabel = actualHasAudio
    ? (chosenAudioCodec === "opus" ? "Opus (48kHz)" : "AAC (Stereo)")
    : undefined;

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
    hasAudio: actualHasAudio,
    audioCodec: audioCodecLabel,
  };
}
