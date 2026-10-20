import { getAudioContext } from "./audio-engine";
import type { DynamicsSettings, EqBands, FilterSettings } from "./types";

interface LiveDspNodes {
  sourceNode: MediaElementAudioSourceNode;
  lowCut: BiquadFilterNode;
  sub: BiquadFilterNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  highMid: BiquadFilterNode;
  air: BiquadFilterNode;
  highCut: BiquadFilterNode;
  dynamics: DynamicsCompressorNode;
  gain: GainNode;
  analyser: AnalyserNode;
}

let activeNodes: LiveDspNodes | null = null;
let activeElement: HTMLAudioElement | null = null;

// WeakMap to prevent recreate errors on the same HTMLAudioElement
const sourceNodeCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

export function getLiveAnalyserNode(): AnalyserNode | null {
  return activeNodes?.analyser ?? null;
}

/**
 * Initializes or binds the Web Audio API live DSP graph to an HTMLAudioElement.
 */
export function connectLiveAudioGraph(audioElement: HTMLAudioElement): AnalyserNode {
  if (activeElement === audioElement && activeNodes) {
    return activeNodes.analyser;
  }

  const ctx = getAudioContext();

  let sourceNode = sourceNodeCache.get(audioElement);
  if (!sourceNode) {
    sourceNode = ctx.createMediaElementSource(audioElement);
    sourceNodeCache.set(audioElement, sourceNode);
  }

  // 1. Low Cut Filter (Highpass)
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = "highpass";
  lowCut.frequency.value = 20;
  lowCut.Q.value = 0.707;

  // 2. 5-Band Parametric EQ
  // Sub (Low Shelf @ 60Hz)
  const sub = ctx.createBiquadFilter();
  sub.type = "lowshelf";
  sub.frequency.value = 60;
  sub.gain.value = 0;

  // Low (Peaking @ 200Hz)
  const low = ctx.createBiquadFilter();
  low.type = "peaking";
  low.frequency.value = 200;
  low.Q.value = 1.0;
  low.gain.value = 0;

  // Mid (Peaking @ 1000Hz)
  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 1.0;
  mid.gain.value = 0;

  // High Mid (Peaking @ 4000Hz)
  const highMid = ctx.createBiquadFilter();
  highMid.type = "peaking";
  highMid.frequency.value = 4000;
  highMid.Q.value = 1.0;
  highMid.gain.value = 0;

  // Air (High Shelf @ 12000Hz)
  const air = ctx.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 12000;
  air.gain.value = 0;

  // 3. High Cut Filter (Lowpass)
  const highCut = ctx.createBiquadFilter();
  highCut.type = "lowpass";
  highCut.frequency.value = 20000;
  highCut.Q.value = 0.707;

  // 4. Dynamics Compressor
  const dynamics = ctx.createDynamicsCompressor();
  dynamics.threshold.value = -18;
  dynamics.knee.value = 6;
  dynamics.ratio.value = 3;
  dynamics.attack.value = 0.01;
  dynamics.release.value = 0.15;

  // 5. Gain Boost & Output Gain
  const gain = ctx.createGain();
  gain.gain.value = 1.0;

  // 6. Analyser Node for Spectrum & VU meters
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;

  // Wire graph: Source -> LowCut -> Sub -> Low -> Mid -> HighMid -> Air -> HighCut -> Dynamics -> Gain -> Analyser -> Destination
  try {
    sourceNode.disconnect();
  } catch {
    // ignore
  }

  sourceNode.connect(lowCut);
  lowCut.connect(sub);
  sub.connect(low);
  low.connect(mid);
  mid.connect(highMid);
  highMid.connect(air);
  air.connect(highCut);
  highCut.connect(dynamics);
  dynamics.connect(gain);
  gain.connect(analyser);
  analyser.connect(ctx.destination);

  activeElement = audioElement;
  activeNodes = {
    sourceNode,
    lowCut,
    sub,
    low,
    mid,
    highMid,
    air,
    highCut,
    dynamics,
    gain,
    analyser,
  };

  return analyser;
}

export interface LiveDspUpdateParams {
  eq: EqBands;
  eqBypass: boolean;
  lowCut: FilterSettings;
  highCut: FilterSettings;
  dynamics: DynamicsSettings;
  dynamicsBypass: boolean;
  gainBoost: number;
  volume: number;
  muted: boolean;
}

/**
 * Updates active live DSP parameters in real time without audio glitches.
 */
export function updateLiveDspGraph({
  eq,
  eqBypass,
  lowCut,
  highCut,
  dynamics,
  dynamicsBypass,
  gainBoost,
  volume,
  muted,
}: LiveDspUpdateParams): void {
  if (!activeNodes) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // 1. Low Cut
  if (eqBypass) {
    activeNodes.lowCut.frequency.setTargetAtTime(10, now, 0.02);
  } else {
    activeNodes.lowCut.frequency.setTargetAtTime(Math.max(10, lowCut.frequency), now, 0.02);
    activeNodes.lowCut.Q.setTargetAtTime(Math.max(0.1, lowCut.q), now, 0.02);
  }

  // 2. 5-Band EQ
  if (eqBypass) {
    activeNodes.sub.gain.setTargetAtTime(0, now, 0.02);
    activeNodes.low.gain.setTargetAtTime(0, now, 0.02);
    activeNodes.mid.gain.setTargetAtTime(0, now, 0.02);
    activeNodes.highMid.gain.setTargetAtTime(0, now, 0.02);
    activeNodes.air.gain.setTargetAtTime(0, now, 0.02);
  } else {
    activeNodes.sub.gain.setTargetAtTime(eq.sub, now, 0.02);
    activeNodes.low.gain.setTargetAtTime(eq.low, now, 0.02);
    activeNodes.mid.gain.setTargetAtTime(eq.mid, now, 0.02);
    activeNodes.highMid.gain.setTargetAtTime(eq.highMid, now, 0.02);
    activeNodes.air.gain.setTargetAtTime(eq.air, now, 0.02);
  }

  // 3. High Cut
  if (eqBypass) {
    activeNodes.highCut.frequency.setTargetAtTime(22000, now, 0.02);
  } else {
    activeNodes.highCut.frequency.setTargetAtTime(Math.min(22000, highCut.frequency), now, 0.02);
    activeNodes.highCut.Q.setTargetAtTime(Math.max(0.1, highCut.q), now, 0.02);
  }

  // 4. Dynamics
  if (dynamicsBypass) {
    activeNodes.dynamics.threshold.setTargetAtTime(0, now, 0.02);
    activeNodes.dynamics.ratio.setTargetAtTime(1, now, 0.02);
  } else {
    activeNodes.dynamics.threshold.setTargetAtTime(dynamics.threshold, now, 0.02);
    activeNodes.dynamics.knee.setTargetAtTime(dynamics.knee, now, 0.02);
    activeNodes.dynamics.ratio.setTargetAtTime(dynamics.ratio, now, 0.02);
    activeNodes.dynamics.attack.setTargetAtTime(dynamics.attack, now, 0.02);
    activeNodes.dynamics.release.setTargetAtTime(dynamics.release, now, 0.02);
  }

  // 5. Gain Boost & Volume: convert gainBoost dB to amplitude
  const boostLinear = Math.pow(10, (gainBoost || 0) / 20);
  const targetGain = muted ? 0 : Math.max(0, Math.min(1, volume)) * boostLinear;
  activeNodes.gain.gain.setTargetAtTime(targetGain, now, 0.02);
}
