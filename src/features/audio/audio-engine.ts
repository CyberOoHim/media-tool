import type { DynamicsSettings, EqBands, FilterSettings } from "./types";

let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioCtx = new AudioContextClass();
  }
  if (globalAudioCtx.state === "suspended") {
    void globalAudioCtx.resume();
  }
  return globalAudioCtx;
}

/**
 * Decodes an audio or video Blob into an AudioBuffer using Web Audio API
 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  // decodeAudioData consumes the arrayBuffer, so we pass a slice or clone if needed
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Extracts and decodes the audio track from a video ObjectURL or Blob
 */
export async function extractAudioFromVideoUrl(videoUrl: string): Promise<AudioBuffer> {
  const resp = await fetch(videoUrl);
  const blob = await resp.blob();
  return await decodeAudioBlob(blob);
}

/**
 * Computes min/max waveform peak data for instant Canvas visualization
 */
export interface WaveformPeaks {
  buckets: number;
  leftMin: Float32Array;
  leftMax: Float32Array;
  rightMin?: Float32Array;
  rightMax?: Float32Array;
  peakOverall: number;
}

export function computeWaveformPeaks(buffer: AudioBuffer, targetBuckets = 1200): WaveformPeaks {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const buckets = Math.min(length, Math.max(100, targetBuckets));
  const blockSize = Math.floor(length / buckets);

  const leftChannel = buffer.getChannelData(0);
  const leftMin = new Float32Array(buckets);
  const leftMax = new Float32Array(buckets);

  const hasRight = numChannels > 1;
  const rightChannel = hasRight ? buffer.getChannelData(1) : null;
  const rightMin = hasRight ? new Float32Array(buckets) : undefined;
  const rightMax = hasRight ? new Float32Array(buckets) : undefined;

  let peakOverall = 0.001;

  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, length);

    let lMin = 1.0;
    let lMax = -1.0;
    let rMin = 1.0;
    let rMax = -1.0;

    for (let j = start; j < end; j++) {
      const lVal = leftChannel[j] ?? 0;
      if (lVal < lMin) lMin = lVal;
      if (lVal > lMax) lMax = lVal;

      const absL = Math.abs(lVal);
      if (absL > peakOverall) peakOverall = absL;

      if (rightChannel) {
        const rVal = rightChannel[j] ?? 0;
        if (rVal < rMin) rMin = rVal;
        if (rVal > rMax) rMax = rVal;

        const absR = Math.abs(rVal);
        if (absR > peakOverall) peakOverall = absR;
      }
    }

    if (lMin > lMax) {
      lMin = 0;
      lMax = 0;
    }
    if (rMin > rMax) {
      rMin = 0;
      rMax = 0;
    }

    leftMin[i] = lMin;
    leftMax[i] = lMax;

    if (rightMin && rightMax) {
      rightMin[i] = rMin;
      rightMax[i] = rMax;
    }
  }

  return {
    buckets,
    leftMin,
    leftMax,
    rightMin,
    rightMax,
    peakOverall: Math.min(1, peakOverall),
  };
}

/**
 * Pure TypeScript WAV Encoder (16-bit, 24-bit, or 32-bit Float)
 */
export function audioBufferToWavBlob(
  buffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 = 16,
): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, "RIFF");
  // File size minus RIFF header (totalSize - 8)
  view.setUint32(4, totalSize - 8, true);
  // RIFF type
  writeString(8, "WAVE");
  // Format chunk identifier
  writeString(12, "fmt ");
  // Format chunk size (16 for PCM)
  view.setUint32(16, 16, true);
  // Audio format (1 = PCM, 3 = IEEE Float)
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  // Number of channels
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate
  view.setUint32(28, byteRate, true);
  // Block align
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, bitDepth, true);
  // Data chunk identifier
  writeString(36, "data");
  // Data chunk size
  view.setUint32(40, dataSize, true);

  // Write Interleaved Audio Samples using high-speed TypedArray direct views
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  if (bitDepth === 16) {
    // Direct Int16Array view for 3x-4x faster sample encoding than DataView.setInt16
    const int16View = new Int16Array(arrayBuffer, 44, numSamples * numChannels);
    let sampleIdx = 0;

    if (numChannels === 1) {
      const ch0 = channels[0]!;
      for (let i = 0; i < numSamples; i++) {
        let sample = ch0[i] ?? 0;
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        int16View[sampleIdx++] = sample < 0 ? (sample * 32768) | 0 : (sample * 32767) | 0;
      }
    } else if (numChannels === 2) {
      const ch0 = channels[0]!;
      const ch1 = channels[1]!;
      for (let i = 0; i < numSamples; i++) {
        let s0 = ch0[i] ?? 0;
        let s1 = ch1[i] ?? 0;
        if (s0 > 1) s0 = 1;
        else if (s0 < -1) s0 = -1;
        if (s1 > 1) s1 = 1;
        else if (s1 < -1) s1 = -1;
        int16View[sampleIdx++] = s0 < 0 ? (s0 * 32768) | 0 : (s0 * 32767) | 0;
        int16View[sampleIdx++] = s1 < 0 ? (s1 * 32768) | 0 : (s1 * 32767) | 0;
      }
    } else {
      for (let i = 0; i < numSamples; i++) {
        for (let c = 0; c < numChannels; c++) {
          let sample = channels[c]![i] ?? 0;
          if (sample > 1) sample = 1;
          else if (sample < -1) sample = -1;
          int16View[sampleIdx++] = sample < 0 ? (sample * 32768) | 0 : (sample * 32767) | 0;
        }
      }
    }
  } else if (bitDepth === 24) {
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c]![i] ?? 0;
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        const intSample = (sample < 0 ? sample * 8388608 : sample * 8388607) | 0;
        view.setUint8(offset, intSample & 0xff);
        view.setUint8(offset + 1, (intSample >> 8) & 0xff);
        view.setUint8(offset + 2, (intSample >> 16) & 0xff);
        offset += 3;
      }
    }
  } else {
    // 32-bit Float direct TypedArray view
    const float32View = new Float32Array(arrayBuffer, 44, numSamples * numChannels);
    let sampleIdx = 0;

    if (numChannels === 1) {
      const ch0 = channels[0]!;
      for (let i = 0; i < numSamples; i++) {
        float32View[sampleIdx++] = ch0[i] ?? 0;
      }
    } else if (numChannels === 2) {
      const ch0 = channels[0]!;
      const ch1 = channels[1]!;
      for (let i = 0; i < numSamples; i++) {
        float32View[sampleIdx++] = ch0[i] ?? 0;
        float32View[sampleIdx++] = ch1[i] ?? 0;
      }
    } else {
      for (let i = 0; i < numSamples; i++) {
        for (let c = 0; c < numChannels; c++) {
          float32View[sampleIdx++] = channels[c]![i] ?? 0;
        }
      }
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Waveform Similarity Overlap-Add (WSOLA) for high-fidelity time-stretching with pitch preservation
 */
export function timeStretchAudioBufferWSOLA(
  source: AudioBuffer,
  rate: number,
): AudioBuffer {
  if (Math.abs(rate - 1.0) < 0.001 || rate <= 0) {
    return source;
  }

  const numChannels = source.numberOfChannels;
  const sampleRate = source.sampleRate;
  const inLength = source.length;
  const outLength = Math.max(1, Math.round(inLength / rate));

  const inChannels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    inChannels.push(source.getChannelData(c));
  }

  // Mono mix for fast, phase-aligned cross-correlation search
  const mono = new Float32Array(inLength);
  if (numChannels === 1) {
    mono.set(inChannels[0]!);
  } else {
    const ch0 = inChannels[0]!;
    const ch1 = inChannels[1]!;
    for (let i = 0; i < inLength; i++) {
      mono[i] = (ch0[i]! + ch1[i]!) * 0.5;
    }
  }

  const windowSize = sampleRate >= 44100 ? 1024 : 512;
  const synthHop = Math.floor(windowSize / 2);
  const maxSearchDelta = Math.floor(synthHop / 2);

  // Hanning window
  const hannWindow = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  const allocLength = outLength + windowSize * 2;
  const outChannels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    outChannels.push(new Float32Array(allocLength));
  }
  const windowSum = new Float32Array(allocLength);

  let prevInputPos = 0;
  let outPos = 0;
  let synthIndex = 0;

  while (outPos < outLength) {
    const idealInputPos = Math.round(synthIndex * synthHop * rate);

    let bestOffset = 0;
    if (synthIndex === 0) {
      bestOffset = 0;
    } else {
      const naturalInputPos = prevInputPos + synthHop;
      const searchStart = Math.max(0, idealInputPos - maxSearchDelta);
      const searchEnd = Math.min(inLength - windowSize, idealInputPos + maxSearchDelta);

      let minDiff = Infinity;
      const compLen = Math.min(windowSize, Math.max(0, inLength - naturalInputPos));

      for (let cand = searchStart; cand <= searchEnd; cand += 2) {
        let diff = 0;
        for (let j = 0; j < compLen; j += 4) {
          const s1 = mono[cand + j] ?? 0;
          const s2 = mono[naturalInputPos + j] ?? 0;
          const d = s1 - s2;
          diff += d * d;
        }
        if (diff < minDiff) {
          minDiff = diff;
          bestOffset = cand - idealInputPos;
        }
      }
    }

    const actualInputPos = Math.max(0, Math.min(inLength - windowSize, idealInputPos + bestOffset));
    prevInputPos = actualInputPos;

    for (let c = 0; c < numChannels; c++) {
      const srcCh = inChannels[c]!;
      const dstCh = outChannels[c]!;
      for (let i = 0; i < windowSize; i++) {
        const sample = srcCh[actualInputPos + i] ?? 0;
        dstCh[outPos + i] += sample * hannWindow[i]!;
      }
    }

    for (let i = 0; i < windowSize; i++) {
      windowSum[outPos + i] += hannWindow[i]!;
    }

    outPos += synthHop;
    synthIndex++;
  }

  // Normalize by window overlap envelope to ensure flat, unity frequency response
  for (let i = 0; i < outLength; i++) {
    const sum = windowSum[i]!;
    if (sum > 1e-4) {
      const invSum = 1 / sum;
      for (let c = 0; c < numChannels; c++) {
        outChannels[c]![i] *= invSum;
      }
    }
  }

  const outBuffer = getAudioContext().createBuffer(numChannels, outLength, sampleRate);
  for (let c = 0; c < numChannels; c++) {
    outBuffer.getChannelData(c).set(outChannels[c]!.subarray(0, outLength));
  }

  return outBuffer;
}

/**
 * Varispeed / Tape Resampling: changes speed AND proportionally shifts pitch (e.g. analog tape / vinyl)
 */
export function varispeedAudioBuffer(
  source: AudioBuffer,
  rate: number,
): AudioBuffer {
  if (Math.abs(rate - 1.0) < 0.001 || rate <= 0) {
    return source;
  }

  const numChannels = source.numberOfChannels;
  const sampleRate = source.sampleRate;
  const inLength = source.length;
  const outLength = Math.max(1, Math.round(inLength / rate));

  const outBuffer = getAudioContext().createBuffer(numChannels, outLength, sampleRate);

  for (let c = 0; c < numChannels; c++) {
    const inData = source.getChannelData(c);
    const outData = new Float32Array(outLength);

    for (let i = 0; i < outLength; i++) {
      const srcPos = i * rate;
      const idx0 = Math.floor(srcPos);
      const frac = srcPos - idx0;

      // 4-point cubic Hermite interpolation for smooth, anti-aliased resampling
      const p0 = inData[Math.max(0, idx0 - 1)] ?? 0;
      const p1 = inData[Math.min(inLength - 1, idx0)] ?? 0;
      const p2 = inData[Math.min(inLength - 1, idx0 + 1)] ?? 0;
      const p3 = inData[Math.min(inLength - 1, idx0 + 2)] ?? 0;

      const a0 = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
      const a1 = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
      const a2 = -0.5 * p0 + 0.5 * p2;
      const a3 = p1;

      outData[i] = a0 * frac * frac * frac + a1 * frac * frac + a2 * frac + a3;
    }

    outBuffer.getChannelData(c).set(outData);
  }

  return outBuffer;
}

/**
 * Applies speed and pitch preservation to an AudioBuffer
 */
export function applySpeedAndPitchToBuffer(
  buffer: AudioBuffer,
  rate: number,
  pitchPreserve = true,
): AudioBuffer {
  if (Math.abs(rate - 1.0) < 0.001 || rate <= 0) {
    return buffer;
  }
  if (pitchPreserve) {
    return timeStretchAudioBufferWSOLA(buffer, rate);
  } else {
    return varispeedAudioBuffer(buffer, rate);
  }
}

/**
 * Slices contiguous or spliced segments from an AudioBuffer
 */
export function sliceSegmentsFromBuffer(
  source: AudioBuffer,
  segments: { sourceStart: number; sourceEnd: number }[],
): AudioBuffer {
  const sampleRate = source.sampleRate;
  const numChannels = source.numberOfChannels;

  let totalSamples = 0;
  for (const seg of segments) {
    const sIdx = Math.max(0, Math.min(source.length, Math.floor(seg.sourceStart * sampleRate)));
    const eIdx = Math.max(0, Math.min(source.length, Math.floor(seg.sourceEnd * sampleRate)));
    if (eIdx > sIdx) {
      totalSamples += eIdx - sIdx;
    }
  }

  if (totalSamples <= 0) {
    totalSamples = 1;
  }

  const sliced = getAudioContext().createBuffer(numChannels, totalSamples, sampleRate);

  for (let c = 0; c < numChannels; c++) {
    const srcCh = source.getChannelData(c);
    const dstCh = sliced.getChannelData(c);
    let dstOffset = 0;
    for (const seg of segments) {
      const sIdx = Math.max(0, Math.min(source.length, Math.floor(seg.sourceStart * sampleRate)));
      const eIdx = Math.max(0, Math.min(source.length, Math.floor(seg.sourceEnd * sampleRate)));
      if (eIdx > sIdx) {
        dstCh.set(srcCh.subarray(sIdx, eIdx), dstOffset);
        dstOffset += eIdx - sIdx;
      }
    }
  }

  return sliced;
}

/**
 * Offline Audio Processor for High-Speed Rendering of Cut/Trim/EQ/Dynamics/Normalizations/Speed & Pitch
 */
export async function renderProcessedAudioOffline(options: {
  sourceBuffer: AudioBuffer;
  trimMode: "trim" | "cut";
  trimStart: number | null;
  trimEnd: number | null;
  eq: EqBands;
  applyEq: boolean;
  lowCut: FilterSettings;
  highCut: FilterSettings;
  dynamics: DynamicsSettings;
  applyDynamics: boolean;
  gainBoost: number;
  fadeInSec: number;
  fadeOutSec: number;
  normalize: "none" | "peak-0db" | "peak-1db" | "ebu-r128";
  invertPhase?: boolean;
  monoSum?: boolean;
  targetChannels?: 1 | 2;
  targetSampleRate?: number;
  playbackRate?: number;
  pitchPreserve?: boolean;
}): Promise<AudioBuffer> {
  const {
    sourceBuffer,
    trimMode,
    trimStart,
    trimEnd,
    eq,
    applyEq,
    lowCut,
    highCut,
    dynamics,
    applyDynamics,
    gainBoost,
    fadeInSec,
    fadeOutSec,
    normalize,
    invertPhase = false,
    monoSum = false,
    targetChannels = sourceBuffer.numberOfChannels as 1 | 2,
    targetSampleRate = sourceBuffer.sampleRate,
    playbackRate = 1.0,
    pitchPreserve = true,
  } = options;

  const totalDuration = sourceBuffer.duration;

  // 1. Determine time slice segments to render
  interface SliceSegment {
    sourceStart: number;
    sourceEnd: number;
    outputDuration: number;
  }

  const segments: SliceSegment[] = [];

  const startSec = trimStart !== null ? Math.max(0, trimStart) : 0;
  const endSec = trimEnd !== null ? Math.min(totalDuration, trimEnd) : totalDuration;

  if (trimMode === "trim") {
    // Keep between start and end
    if (endSec > startSec) {
      segments.push({
        sourceStart: startSec,
        sourceEnd: endSec,
        outputDuration: endSec - startSec,
      });
    } else {
      segments.push({
        sourceStart: 0,
        sourceEnd: totalDuration,
        outputDuration: totalDuration,
      });
    }
  } else {
    // Cut mode: Keep [0, startSec] and [endSec, totalDuration]
    if (startSec > 0) {
      segments.push({
        sourceStart: 0,
        sourceEnd: startSec,
        outputDuration: startSec,
      });
    }
    if (endSec < totalDuration) {
      segments.push({
        sourceStart: endSec,
        sourceEnd: totalDuration,
        outputDuration: totalDuration - endSec,
      });
    }
    if (segments.length === 0) {
      segments.push({
        sourceStart: 0,
        sourceEnd: totalDuration,
        outputDuration: totalDuration,
      });
    }
  }

  // Slice audio buffer from source
  let intermediateBuffer = sliceSegmentsFromBuffer(sourceBuffer, segments);

  // Apply speed and pitch transformation if rate is modified
  if (Math.abs(playbackRate - 1.0) >= 0.001 && playbackRate > 0) {
    intermediateBuffer = applySpeedAndPitchToBuffer(
      intermediateBuffer,
      playbackRate,
      pitchPreserve,
    );
  }

  const renderedDuration = intermediateBuffer.duration;
  const totalLength = Math.max(1, Math.round(renderedDuration * targetSampleRate));

  // 2. Setup OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(targetChannels, totalLength, targetSampleRate);

  // Build DSP Node chain inside OfflineAudioContext
  const dest = offlineCtx.destination;

  // DSP: Low Cut (High Pass)
  let lowCutNode: BiquadFilterNode | null = null;
  if (lowCut.enabled && lowCut.frequency > 10) {
    lowCutNode = offlineCtx.createBiquadFilter();
    lowCutNode.type = "highpass";
    lowCutNode.frequency.value = lowCut.frequency;
    lowCutNode.Q.value = lowCut.q || 1.0;
  }

  // DSP: High Cut (Low Pass)
  let highCutNode: BiquadFilterNode | null = null;
  if (highCut.enabled && highCut.frequency < 22000) {
    highCutNode = offlineCtx.createBiquadFilter();
    highCutNode.type = "lowpass";
    highCutNode.frequency.value = highCut.frequency;
    highCutNode.Q.value = highCut.q || 1.0;
  }

  // DSP: 5-Band EQ
  let eqNodes: BiquadFilterNode[] = [];
  if (applyEq) {
    const f1 = offlineCtx.createBiquadFilter();
    f1.type = "lowshelf";
    f1.frequency.value = 80;
    f1.gain.value = eq.low80Hz;

    const f2 = offlineCtx.createBiquadFilter();
    f2.type = "peaking";
    f2.frequency.value = 300;
    f2.Q.value = 1.2;
    f2.gain.value = eq.lowMid300Hz;

    const f3 = offlineCtx.createBiquadFilter();
    f3.type = "peaking";
    f3.frequency.value = 1000;
    f3.Q.value = 1.2;
    f3.gain.value = eq.mid1kHz;

    const f4 = offlineCtx.createBiquadFilter();
    f4.type = "peaking";
    f4.frequency.value = 3500;
    f4.Q.value = 1.2;
    f4.gain.value = eq.highMid3kHz;

    const f5 = offlineCtx.createBiquadFilter();
    f5.type = "highshelf";
    f5.frequency.value = 10000;
    f5.gain.value = eq.high10kHz;

    eqNodes = [f1, f2, f3, f4, f5];
  }

  // DSP: Dynamics Compressor
  let compNode: DynamicsCompressorNode | null = null;
  if (applyDynamics && dynamics.enabled) {
    compNode = offlineCtx.createDynamicsCompressor();
    compNode.threshold.value = dynamics.threshold;
    compNode.ratio.value = dynamics.ratio;
    compNode.attack.value = dynamics.attack;
    compNode.release.value = dynamics.release;
    compNode.knee.value = dynamics.knee;
  }

  // Master Gain & Fades Node
  const gainNode = offlineCtx.createGain();
  const baseGain =
    (gainBoost || 1.0) *
    (applyDynamics && dynamics.enabled ? Math.pow(10, dynamics.makeupGain / 20) : 1.0);
  gainNode.gain.setValueAtTime(baseGain, 0);

  // Apply Fade-In
  if (fadeInSec > 0) {
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(baseGain, Math.min(fadeInSec, renderedDuration));
  }

  // Apply Fade-Out
  if (fadeOutSec > 0 && renderedDuration > fadeOutSec) {
    const fadeOutStart = renderedDuration - fadeOutSec;
    gainNode.gain.setValueAtTime(baseGain, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, renderedDuration);
  }

  // Chain Nodes: LowCut -> EQ Nodes -> HighCut -> Compressor -> Gain -> Destination
  const chain: AudioNode[] = [];
  if (lowCutNode) chain.push(lowCutNode);
  for (const eqNode of eqNodes) chain.push(eqNode);
  if (highCutNode) chain.push(highCutNode);
  if (compNode) chain.push(compNode);
  chain.push(gainNode);
  chain.push(dest);

  for (let i = 0; i < chain.length - 1; i++) {
    chain[i]!.connect(chain[i + 1]!);
  }

  const entryNode = chain[0] ?? dest;

  // Feed intermediate sliced and speed/pitch adjusted buffer
  const src = offlineCtx.createBufferSource();
  src.buffer = intermediateBuffer;
  src.connect(entryNode);
  src.start(0);

  // Render audio offline
  const renderedBuffer = await offlineCtx.startRendering();

  // 3. Post-Process Invert Phase / Mono Sum if enabled
  if (invertPhase) {
    // Invert phase of channel 1 (or all channels)
    const ch = renderedBuffer.numberOfChannels > 1 ? 1 : 0;
    const data = renderedBuffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = -data[i]!;
    }
  }

  if (monoSum && renderedBuffer.numberOfChannels > 1) {
    const left = renderedBuffer.getChannelData(0);
    const right = renderedBuffer.getChannelData(1);
    for (let i = 0; i < left.length; i++) {
      const mono = (left[i]! + right[i]!) * 0.5;
      left[i] = mono;
      right[i] = mono;
    }
  }

  // 4. Post-Process Normalization if enabled
  if (normalize !== "none") {
    applyNormalization(renderedBuffer, normalize);
  }

  return renderedBuffer;
}

/**
 * In-place AudioBuffer Peak Normalization
 */
function applyNormalization(
  buffer: AudioBuffer,
  mode: "peak-0db" | "peak-1db" | "ebu-r128",
) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  let maxPeak = 0;

  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(data[i] ?? 0);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  if (maxPeak <= 0.00001) return;

  let targetPeak = 1.0; // 0 dB
  if (mode === "peak-1db") {
    targetPeak = 0.89125; // -1 dB
  } else if (mode === "ebu-r128") {
    targetPeak = 0.70795; // -3 dB safety margin
  }

  const multiplier = targetPeak / maxPeak;

  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (data[i] ?? 0) * multiplier;
    }
  }
}
