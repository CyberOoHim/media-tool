import {
  Bookmark,
  FastForward,
  Music,
  Pause,
  Play,
  Rewind,
  Scissors,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeckExpander } from "@/components/layout/deck-expander";
import { DropZone } from "@/components/layout/drop-zone";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatTimePrecise } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import { JogDial } from "@/features/player/jog-dial";
import { nextRate } from "@/features/player/rates";
import { cn } from "@/lib/utils";
import { AudioCueControls } from "./audio-cue-controls";
import { AudioDspControls } from "./audio-dsp-controls";
import { getAudioContext } from "./audio-engine";
import { AudioTrimControls } from "./audio-trim-controls";
import { AudioVuMeter } from "./audio-vu-meter";
import { AudioWaveform } from "./audio-waveform";
import { useAudioStore } from "./store";

function AudioTimecodeDisplay({ duration, sampleRate }: { duration: number; sampleRate?: number }) {
  const currentTime = useAudioStore((s) => s.currentTime);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-baseline gap-1 rounded-sm border border-border bg-black px-2.5 py-1 font-mono shadow-inner">
        <span className="text-base font-bold text-emerald-400">
          {formatTimePrecise(currentTime)}
        </span>
        <span className="text-xs text-zinc-500">/</span>
        <span className="text-xs text-zinc-400">{formatTimePrecise(duration)}</span>
      </div>
      {sampleRate && (
        <span className="hidden sm:inline font-mono text-[9px] text-muted-foreground">
          [{(currentTime * sampleRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} smp]
        </span>
      )}
    </div>
  );
}

export function AudioDeck() {
  const videoSession = useMediaStore((s) => s.video);

  const audio = useAudioStore((s) => s.audio);
  const ready = useAudioStore((s) => s.ready);
  const playing = useAudioStore((s) => s.playing);
  const duration = useAudioStore((s) => s.duration);
  const volume = useAudioStore((s) => s.volume);
  const gainBoost = useAudioStore((s) => s.gainBoost);
  const muted = useAudioStore((s) => s.muted);
  const rate = useAudioStore((s) => s.rate);
  const pitchPreserve = useAudioStore((s) => s.pitchPreserve);
  const pan = useAudioStore((s) => s.pan);
  const loopRange = useAudioStore((s) => s.loopRange);
  const trimMode = useAudioStore((s) => s.trimMode);
  const trimStart = useAudioStore((s) => s.trimStart);
  const trimEnd = useAudioStore((s) => s.trimEnd);
  const previewTrimMode = useAudioStore((s) => s.previewTrimMode);
  const isExtracting = useAudioStore((s) => s.isExtracting);

  // DSP settings from store
  const eq = useAudioStore((s) => s.eq);
  const eqBypass = useAudioStore((s) => s.eqBypass);
  const lowCut = useAudioStore((s) => s.lowCut);
  const highCut = useAudioStore((s) => s.highCut);
  const dynamics = useAudioStore((s) => s.dynamics);
  const dynamicsBypass = useAudioStore((s) => s.dynamicsBypass);
  const loadAudioFile = useAudioStore((s) => s.loadAudioFile);
  const extractFromVideoSession = useAudioStore((s) => s.extractFromVideoSession);
  const setPlaying = useAudioStore((s) => s.setPlaying);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const setRate = useAudioStore((s) => s.setRate);
  const setPitchPreserve = useAudioStore((s) => s.setPitchPreserve);
  const toggleLoopRange = useAudioStore((s) => s.toggleLoopRange);
  const setTrimStart = useAudioStore((s) => s.setTrimStart);
  const setTrimEnd = useAudioStore((s) => s.setTrimEnd);
  const clearTrimRange = useAudioStore((s) => s.clearTrimRange);
  const addCuePoint = useAudioStore((s) => s.addCuePoint);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Web Audio Graph Nodes ref
  const audioGraphRef = useRef<{
    source: MediaElementAudioSourceNode | null;
    lowCutNode: BiquadFilterNode;
    f1: BiquadFilterNode;
    f2: BiquadFilterNode;
    f3: BiquadFilterNode;
    f4: BiquadFilterNode;
    f5: BiquadFilterNode;
    highCutNode: BiquadFilterNode;
    compNode: DynamicsCompressorNode;
    panNode: StereoPannerNode;
    gainNode: GainNode;
    analyserNode: AnalyserNode;
  } | null>(null);

  // Direct Time Jump inputs
  const [jumpHours, setJumpHours] = useState("");
  const [jumpMinutes, setJumpMinutes] = useState("");
  const [jumpSeconds, setJumpSeconds] = useState("");

  // Initialize Web Audio DSP Graph
  useEffect(() => {
    const el = audioRef.current;
    if (!el || audioGraphRef.current) return;

    try {
      const ctx = getAudioContext();
      const source = ctx.createMediaElementSource(el);

      // Low Cut (High Pass)
      const lowCutNode = ctx.createBiquadFilter();
      lowCutNode.type = "highpass";
      lowCutNode.frequency.value = 20;

      // 5-Band Equalizer Nodes
      const f1 = ctx.createBiquadFilter();
      f1.type = "lowshelf";
      f1.frequency.value = 80;

      const f2 = ctx.createBiquadFilter();
      f2.type = "peaking";
      f2.frequency.value = 300;
      f2.Q.value = 1.2;

      const f3 = ctx.createBiquadFilter();
      f3.type = "peaking";
      f3.frequency.value = 1000;
      f3.Q.value = 1.2;

      const f4 = ctx.createBiquadFilter();
      f4.type = "peaking";
      f4.frequency.value = 3500;
      f4.Q.value = 1.2;

      const f5 = ctx.createBiquadFilter();
      f5.type = "highshelf";
      f5.frequency.value = 10000;

      // High Cut (Low Pass)
      const highCutNode = ctx.createBiquadFilter();
      highCutNode.type = "lowpass";
      highCutNode.frequency.value = 20000;

      // Compressor
      const compNode = ctx.createDynamicsCompressor();

      // Pan Node
      const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : (ctx.createGain() as unknown as StereoPannerNode);

      // Master Gain
      const gainNode = ctx.createGain();

      // Analyser Node
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Connect DSP chain:
      // source -> lowCut -> f1 -> f2 -> f3 -> f4 -> f5 -> highCut -> compNode -> panNode -> gainNode -> analyser -> destination
      source.connect(lowCutNode);
      lowCutNode.connect(f1);
      f1.connect(f2);
      f2.connect(f3);
      f3.connect(f4);
      f4.connect(f5);
      f5.connect(highCutNode);
      highCutNode.connect(compNode);
      compNode.connect(panNode);
      panNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(ctx.destination);

      audioGraphRef.current = {
        source,
        lowCutNode,
        f1,
        f2,
        f3,
        f4,
        f5,
        highCutNode,
        compNode,
        panNode,
        gainNode,
        analyserNode: analyser,
      };

      setAnalyserNode(analyser);
    } catch {
      // Audio graph already connected or running in restricted mode
    }
  }, []);

  // Update Live Web Audio DSP Nodes whenever Store state changes
  useEffect(() => {
    const graph = audioGraphRef.current;
    if (!graph) return;

    // EQ bands
    if (eqBypass) {
      graph.f1.gain.value = 0;
      graph.f2.gain.value = 0;
      graph.f3.gain.value = 0;
      graph.f4.gain.value = 0;
      graph.f5.gain.value = 0;
    } else {
      graph.f1.gain.value = eq.low80Hz;
      graph.f2.gain.value = eq.lowMid300Hz;
      graph.f3.gain.value = eq.mid1kHz;
      graph.f4.gain.value = eq.highMid3kHz;
      graph.f5.gain.value = eq.high10kHz;
    }

    // Low-Cut
    if (lowCut.enabled) {
      graph.lowCutNode.frequency.value = lowCut.frequency;
      graph.lowCutNode.Q.value = lowCut.q;
    } else {
      graph.lowCutNode.frequency.value = 10;
    }

    // High-Cut
    if (highCut.enabled) {
      graph.highCutNode.frequency.value = highCut.frequency;
      graph.highCutNode.Q.value = highCut.q;
    } else {
      graph.highCutNode.frequency.value = 22000;
    }

    // Dynamics Compressor
    if (dynamics.enabled && !dynamicsBypass) {
      graph.compNode.threshold.value = dynamics.threshold;
      graph.compNode.ratio.value = dynamics.ratio;
      graph.compNode.attack.value = dynamics.attack;
      graph.compNode.release.value = dynamics.release;
      graph.compNode.knee.value = dynamics.knee;
    } else {
      graph.compNode.threshold.value = 0;
      graph.compNode.ratio.value = 1;
    }

    // Stereo Pan
    if (graph.panNode.pan) {
      graph.panNode.pan.value = pan;
    }

    // Master Gain & Makeup
    const makeup = dynamics.enabled && !dynamicsBypass ? Math.pow(10, dynamics.makeupGain / 20) : 1.0;
    graph.gainNode.gain.value = (muted ? 0 : volume) * gainBoost * makeup;
  }, [
    eq,
    eqBypass,
    lowCut,
    highCut,
    dynamics,
    dynamicsBypass,
    gainBoost,
    pan,
    volume,
    muted,
  ]);

  // Audio Playhead Time & Loop bounds synchronization
  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const cur = el.currentTime;
    setCurrentTime(cur);

    // Range / Trim enforcement
    if (loopRange && trimStart !== null && trimEnd !== null && trimEnd > trimStart) {
      if (cur >= trimEnd) {
        el.currentTime = trimStart;
        void el.play();
      }
    } else if (previewTrimMode && trimStart !== null && trimEnd !== null) {
      if (trimMode === "trim" && cur >= trimEnd) {
        el.pause();
        el.currentTime = trimStart;
      }
    }
  };

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [setPlaying]);

  const seekTo = useCallback(
    (timeSec: number) => {
      const el = audioRef.current;
      if (!el || !Number.isFinite(el.duration)) return;
      const target = Math.max(0, Math.min(el.duration, timeSec));
      el.currentTime = target;
      setCurrentTime(target);
    },
    [setCurrentTime],
  );

  const seekBy = useCallback(
    (deltaSec: number) => {
      const el = audioRef.current;
      if (!el || !Number.isFinite(el.duration)) return;
      seekTo(el.currentTime + deltaSec);
    },
    [seekTo],
  );

  const stepMs = useCallback(
    (deltaMs: number) => {
      const el = audioRef.current;
      if (!el || !Number.isFinite(el.duration)) return;
      el.pause();
      setPlaying(false);
      seekTo(el.currentTime + deltaMs / 1000);
    },
    [seekTo, setPlaying],
  );

  const applyRate = useCallback(
    (next: number) => {
      const el = audioRef.current;
      setRate(next);
      if (el) {
        el.playbackRate = next;
        const mediaEl = el as HTMLMediaElement & { preservesPitch?: boolean };
        if (mediaEl.preservesPitch !== undefined) {
          mediaEl.preservesPitch = pitchPreserve;
        }
      }
    },
    [pitchPreserve, setRate],
  );

  // Sync pitch preservation
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      const mediaEl = el as HTMLMediaElement & { preservesPitch?: boolean };
      if (mediaEl.preservesPitch !== undefined) {
        mediaEl.preservesPitch = pitchPreserve;
      }
    }
  }, [pitchPreserve]);

  // Jump to Typed Timecode
  const gotoTypedTime = () => {
    const h = Number.parseInt(jumpHours, 10) || 0;
    const m = Number.parseInt(jumpMinutes, 10) || 0;
    const s = Number.parseFloat(jumpSeconds) || 0;
    const total = h * 3600 + m * 60 + s;
    if (total > duration) {
      toast.error("Invalid timecode");
      return;
    }
    seekTo(total);
    toast(`Jumped to ${formatTimePrecise(total)}`);
  };

  // Keyboard Shortcuts Handler for Audio Deck
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "combobox")
      ) {
        return;
      }

      if (!audio) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) seekBy(-1.0);
          else seekBy(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) seekBy(1.0);
          else seekBy(10);
          break;
        case ",":
        case "<":
          e.preventDefault();
          stepMs(-50);
          break;
        case ".":
        case ">":
          e.preventDefault();
          stepMs(50);
          break;
        case "i":
        case "I": {
          e.preventDefault();
          const cur = useAudioStore.getState().currentTime;
          setTrimStart(cur);
          toast(`Mark IN set: ${formatTimePrecise(cur)}`);
          break;
        }
        case "o":
        case "O": {
          e.preventDefault();
          const cur = useAudioStore.getState().currentTime;
          setTrimEnd(cur);
          toast(`Mark OUT set: ${formatTimePrecise(cur)}`);
          break;
        }
        case "x":
        case "X":
          e.preventDefault();
          clearTrimRange();
          toast("Trim range cleared");
          break;
        case "m":
        case "M": {
          e.preventDefault();
          const cur = useAudioStore.getState().currentTime;
          addCuePoint(cur);
          break;
        }
        case "l":
        case "L":
          e.preventDefault();
          toggleLoopRange();
          toast(`Loop range ${!loopRange ? "Enabled" : "Disabled"}`);
          break;
        case "[":
          e.preventDefault();
          applyRate(nextRate(rate, -1));
          break;
        case "]":
          e.preventDefault();
          applyRate(nextRate(rate, 1));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    audio,
    togglePlay,
    seekBy,
    stepMs,
    setTrimStart,
    setTrimEnd,
    clearTrimRange,
    addCuePoint,
    loopRange,
    toggleLoopRange,
    rate,
    applyRate,
  ]);

  const deckStatus = isExtracting
    ? "EXTRACTING"
    : !audio
      ? "NO AUDIO"
      : !ready
        ? "LOADING"
        : playing
          ? "PLAYING"
          : "STANDBY";

  const deckStatusVariant = playing ? "success" : audio ? "signal" : "default";

  return (
    <Panel
      title="Deck-Audio // Audio Workstation"
      status={deckStatus}
      statusVariant={deckStatusVariant}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Extract from Video if available */}
          {videoSession && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-6 px-2 text-[10px] font-mono border-signal/60 bg-signal/10 hover:bg-signal/20 text-foreground transition-all",
                isExtracting && "animate-pulse",
              )}
              disabled={isExtracting}
              onClick={() => {
                if (videoSession) {
                  void extractFromVideoSession(videoSession.objectUrl, videoSession.fileName);
                }
              }}
              title="Extract sound track from Deck-1 Video"
            >
              <Zap className="size-3 mr-1 text-signal" />
              {isExtracting ? "Extracting Track..." : "Extract from Video"}
            </Button>
          )}

          {/* Audio session active */}
          {audio ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[120px] truncate font-mono text-[11px] font-bold text-foreground sm:max-w-[180px]">
                {audio.fileName}
              </span>
              <DropZone
                accept="audio/*,video/*"
                onFiles={(files) => {
                  if (files[0]) void loadAudioFile(files[0]);
                }}
                className="border-0 bg-transparent px-0 py-0 hover:bg-transparent"
              >
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                  Eject / Swap
                </Button>
              </DropZone>
            </div>
          ) : (
            <DropZone
              accept="audio/*,video/*"
              onFiles={(files) => {
                if (files[0]) void loadAudioFile(files[0]);
              }}
              className="border-0 bg-transparent px-0 py-0 hover:bg-transparent"
            >
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                <Upload className="size-3 mr-1" />
                Load Audio File
              </Button>
            </DropZone>
          )}
        </div>
      }
    >
      {/* Hidden HTML5 Audio Element connected to Web Audio DSP */}
      <audio
        ref={audioRef}
        src={audio?.objectUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="auto"
      />

      {/* Main Bezel: Waveform Display & Stereo VU Level Meter */}
      <div className="flex flex-col gap-2 rounded-sm border-2 border-border bg-theater p-2.5 shadow-inner">
        {audio ? (
          <div className="flex flex-col gap-2">
            {/* Visualizer and Waveform */}
            <AudioWaveform
              analyserNode={analyserNode}
              onSeek={seekTo}
            />

            {/* Stereo VU Level Meter */}
            <AudioVuMeter analyserNode={analyserNode} isPlaying={playing} />
          </div>
        ) : (
          /* Empty State Drop Box */
          <DropZone
            accept="audio/*,video/*"
            onFiles={(files) => {
              if (files[0]) void loadAudioFile(files[0]);
            }}
            className="flex min-h-[220px] flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-black/60 p-6 text-center hover:bg-secondary/20"
          >
            <div className="grid size-12 place-items-center rounded-full border border-border bg-card shadow-[2px_2px_0px_var(--color-border)]">
              <Music className="size-6 text-signal" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                Drop Audio Track or Extract from Video
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                Supports MP3, WAV, AAC, FLAC, OGG, M4A, WEBM, and direct extraction from Deck-1
              </p>
            </div>
            {videoSession && (
              <Button
                size="sm"
                variant="default"
                className="mt-1 font-mono text-xs shadow-[2px_2px_0px_var(--color-border)]"
                onClick={(e) => {
                  e.stopPropagation();
                  void extractFromVideoSession(videoSession.objectUrl, videoSession.fileName);
                }}
              >
                <Zap className="size-3.5 mr-1 text-signal" />
                Extract Audio from &quot;{videoSession.fileName}&quot;
              </Button>
            )}
          </DropZone>
        )}
      </div>

      {/* Master Audio Transport & Jog Dial Bar */}
      <div className="flex flex-col gap-2 rounded-sm border border-border bg-card/60 p-2.5 shadow-xs">
        {/* Row 1: Timecode & Jog Dial & Direct Jump */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2">
          {/* Timecode Readout */}
          <AudioTimecodeDisplay duration={duration} sampleRate={audio?.sampleRate} />

          {/* Precision Hardware Jog Dial */}
          <div className="flex items-center gap-2">
            <JogDial
              onStepFrame={(frames) => stepMs(frames * 33.33)}
              disabled={!audio}
            />
            {/* Step buttons */}
            <div className="flex items-center gap-0.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-1.5 font-mono text-[10px]"
                disabled={!audio}
                onClick={() => stepMs(-50)}
                title="Step backward 50ms (,)"
              >
                -50ms
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-1.5 font-mono text-[10px]"
                disabled={!audio}
                onClick={() => stepMs(50)}
                title="Step forward 50ms (.)"
              >
                +50ms
              </Button>
            </div>
          </div>

          {/* Direct Timecode Goto Input */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <Input
              placeholder="HH"
              value={jumpHours}
              onChange={(e) => setJumpHours(e.target.value)}
              className="h-7 w-10 px-1 text-center font-mono text-xs"
              maxLength={2}
            />
            <span>:</span>
            <Input
              placeholder="MM"
              value={jumpMinutes}
              onChange={(e) => setJumpMinutes(e.target.value)}
              className="h-7 w-10 px-1 text-center font-mono text-xs"
              maxLength={2}
            />
            <span>:</span>
            <Input
              placeholder="SS"
              value={jumpSeconds}
              onChange={(e) => setJumpSeconds(e.target.value)}
              className="h-7 w-12 px-1 text-center font-mono text-xs"
              maxLength={4}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 font-mono text-[10px]"
              onClick={gotoTypedTime}
              disabled={!audio}
            >
              Go
            </Button>
          </div>
        </div>

        {/* Row 2: Transport Buttons, Speed & Volume Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Main Transport Buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!audio}
              onClick={() => seekTo(0)}
              title="Jump to Start"
            >
              <SkipBack className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!audio}
              onClick={() => seekBy(-10)}
              title="Rewind 10s (←)"
            >
              <Rewind className="size-3.5" />
            </Button>

            {/* Main Play/Pause Button */}
            <Button
              size="sm"
              variant={playing ? "default" : "outline"}
              className="h-8 px-3 font-mono text-xs font-bold uppercase tracking-wider"
              disabled={!audio}
              onClick={togglePlay}
              title="Play / Pause (Space)"
            >
              {playing ? <Pause className="size-4 mr-1" /> : <Play className="size-4 mr-1" />}
              {playing ? "PAUSE" : "PLAY"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!audio}
              onClick={() => seekBy(10)}
              title="Fast Forward 10s (→)"
            >
              <FastForward className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!audio}
              onClick={() => seekTo(duration)}
              title="Jump to End"
            >
              <SkipForward className="size-3.5" />
            </Button>
          </div>

          {/* Playback Rate & Pitch Preserves */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[10px] text-muted-foreground">Speed:</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 font-mono text-[10px] font-bold"
                disabled={!audio}
                onClick={() => applyRate(nextRate(rate, 1))}
              >
                {rate}×
              </Button>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground cursor-pointer">
                <Switch
                  checked={pitchPreserve}
                  onCheckedChange={setPitchPreserve}
                  className="scale-65"
                />
                <span className="hidden sm:inline">Pitch Lock</span>
              </label>
            </div>
          </div>

          {/* Master Volume & Mute */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              disabled={!audio}
              onClick={toggleMute}
              title="Mute / Unmute"
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-4 text-destructive" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>
            <div className="w-20 sm:w-24">
              <Slider
                value={[muted ? 0 : volume]}
                min={0}
                max={1}
                step={0.05}
                disabled={!audio}
                onValueChange={([v]) => {
                  if (muted) setMuted(false);
                  setVolume(v ?? 1);
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground min-w-[28px]">
              {muted ? "0%" : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Expandable Sub-Decks */}
      <div className="flex flex-col gap-3">
        {/* Expander 1: Cut, Trim & Multi-Format Exporter */}
        <DeckExpander
          id="deck-audio-cut-trim"
          title="Deck // Cut, Trim & Multi-Format Audio Exporter"
          icon={<Scissors className="size-3.5" />}
          defaultOpen={true}
        >
          <AudioTrimControls />
        </DeckExpander>

        {/* Expander 2: 5-Band Graphic EQ, Filters & Tone Rack */}
        <DeckExpander
          id="deck-audio-eq-dsp"
          title="Deck // 5-Band EQ, DSP Filters & Tone Rack"
          icon={<SlidersHorizontal className="size-3.5" />}
          defaultOpen={true}
        >
          <AudioDspControls />
        </DeckExpander>

        {/* Expander 3: Cue Points & Audio Slice Bookmarks */}
        <DeckExpander
          id="deck-audio-cue-points"
          title="Deck // Cue Points & Audio Slices"
          icon={<Bookmark className="size-3.5" />}
          defaultOpen={true}
        >
          <AudioCueControls onSeek={seekTo} />
        </DeckExpander>
      </div>
    </Panel>
  );
}
