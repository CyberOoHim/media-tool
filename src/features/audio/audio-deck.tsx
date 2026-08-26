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
import { formatTimePrecise } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import { JogDial } from "@/features/player/jog-dial";
import {
  COMMON_PLAYBACK_RATES,
  clampRate,
  nextRate,
  nudgeRate,
} from "@/features/player/rates";
import { SpeedControl, SpeedDropdown } from "@/features/player/speed-control";
import { cn } from "@/lib/utils";
import { AudioCueControls } from "./audio-cue-controls";
import { AudioDspControls } from "./audio-dsp-controls";
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
  const muted = useAudioStore((s) => s.muted);
  const rate = useAudioStore((s) => s.rate);
  const pitchPreserve = useAudioStore((s) => s.pitchPreserve);
  const loopRange = useAudioStore((s) => s.loopRange);
  const trimMode = useAudioStore((s) => s.trimMode);
  const trimStart = useAudioStore((s) => s.trimStart);
  const trimEnd = useAudioStore((s) => s.trimEnd);
  const previewTrimMode = useAudioStore((s) => s.previewTrimMode);
  const isExtracting = useAudioStore((s) => s.isExtracting);

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

  // Direct Time Jump inputs
  const [jumpHours, setJumpHours] = useState("");
  const [jumpMinutes, setJumpMinutes] = useState("");
  const [jumpSeconds, setJumpSeconds] = useState("");

  // Sync volume and mute directly with the native audio element
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.volume = Math.min(1, Math.max(0, volume));
      el.muted = muted;
    }
  }, [volume, muted]);

  // Audio Playhead Time & Loop bounds synchronization
  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const cur = el.currentTime;
    setCurrentTime(cur);

    // Live Trim/Cut Playback Preview Handling
    if (previewTrimMode) {
      const s = trimStart !== null ? trimStart : 0;
      const e = trimEnd !== null ? trimEnd : el.duration;

      if (trimMode === "trim") {
        // Retain only [s, e]
        if (cur < s - 0.05) {
          el.currentTime = s;
          return;
        }
        if (cur >= e) {
          if (loopRange) {
            el.currentTime = s;
          } else {
            el.pause();
            el.currentTime = s;
            setPlaying(false);
            toast("Trim preview reached OUT point");
          }
          return;
        }
      } else {
        // Cut: Remove [s, e] - automatically skip ahead
        if (trimStart !== null && trimEnd !== null && cur >= s && cur < e) {
          el.currentTime = e;
          toast("Skipped cut period");
          return;
        }
      }
    } else if (loopRange) {
      // Loop Range when not in preview trim mode (only if valid in/out points set)
      if (trimStart !== null && trimEnd !== null && trimEnd > trimStart) {
        if (cur >= trimEnd || cur < trimStart - 0.05) {
          el.currentTime = trimStart;
        }
      }
    }
  }, [loopRange, previewTrimMode, setCurrentTime, setPlaying, trimEnd, trimMode, trimStart]);

  const handleEnded = useCallback(() => {
    const el = audioRef.current;
    if (loopRange && el) {
      const s = trimStart !== null ? trimStart : 0;
      el.currentTime = s;
      void el.play();
    } else {
      setPlaying(false);
    }
  }, [loopRange, setPlaying, trimStart]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !audio?.objectUrl) return;

    if (el.paused) {
      // If at end of track or trim boundary, restart from start
      if (trimEnd !== null && previewTrimMode && el.currentTime >= trimEnd) {
        el.currentTime = trimStart !== null ? trimStart : 0;
      } else if (el.duration > 0 && el.currentTime >= el.duration - 0.05) {
        el.currentTime = 0;
      }

      void el
        .play()
        .then(() => {
          setPlaying(true);
        })
        .catch(() => {
          setPlaying(false);
        });
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [audio?.objectUrl, previewTrimMode, setPlaying, trimEnd, trimStart]);

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
      const clamped = clampRate(next);
      setRate(clamped);
      if (el) {
        el.defaultPlaybackRate = clamped;
        el.playbackRate = clamped;
        if ("preservesPitch" in el) {
          (el as unknown as { preservesPitch: boolean }).preservesPitch = pitchPreserve;
        }
        if ("webkitPreservesPitch" in el) {
          (el as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch = pitchPreserve;
        }
        if ("mozPreservesPitch" in el) {
          (el as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch = pitchPreserve;
        }
      }
    },
    [pitchPreserve, setRate],
  );

  const togglePitchPreserve = useCallback(
    (val: boolean) => {
      setPitchPreserve(val);
      const el = audioRef.current;
      if (el) {
        if ("preservesPitch" in el) {
          (el as unknown as { preservesPitch: boolean }).preservesPitch = val;
        }
        if ("webkitPreservesPitch" in el) {
          (el as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch = val;
        }
        if ("mozPreservesPitch" in el) {
          (el as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch = val;
        }
        // Force the browser audio decoder to apply the pitch preservation mode immediately
        const current = el.playbackRate;
        el.defaultPlaybackRate = current;
        el.playbackRate = current;
      }
    },
    [setPitchPreserve],
  );

  // Sync rate and pitch preservation properties with audio element
  const syncMediaProperties = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    if ("preservesPitch" in el) {
      (el as unknown as { preservesPitch: boolean }).preservesPitch = pitchPreserve;
    }
    if ("webkitPreservesPitch" in el) {
      (el as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch = pitchPreserve;
    }
    if ("mozPreservesPitch" in el) {
      (el as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch = pitchPreserve;
    }
  }, [pitchPreserve, rate]);

  useEffect(() => {
    syncMediaProperties();
  }, [syncMediaProperties, audio?.objectUrl]);

  // High-frequency 60fps playhead timecode sync while playing
  useEffect(() => {
    if (!playing) return;
    let animId: number;
    const syncTime = () => {
      const el = audioRef.current;
      if (el && !el.paused) {
        setCurrentTime(el.currentTime);
        animId = requestAnimationFrame(syncTime);
      }
    };

    animId = requestAnimationFrame(syncTime);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [playing, setCurrentTime]);

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
          if (e.shiftKey) {
            const next = nudgeRate(rate, -0.05);
            applyRate(next);
            toast(`Speed: ${next}×`);
          } else {
            const next = nextRate(rate, -1);
            applyRate(next);
            toast(`Speed: ${next}×`);
          }
          break;
        case "]":
          e.preventDefault();
          if (e.shiftKey) {
            const next = nudgeRate(rate, 0.05);
            applyRate(next);
            toast(`Speed: ${next}×`);
          } else {
            const next = nextRate(rate, 1);
            applyRate(next);
            toast(`Speed: ${next}×`);
          }
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
      {/* Native HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={audio?.objectUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={syncMediaProperties}
        onLoadedData={syncMediaProperties}
        onCanPlay={syncMediaProperties}
        onSeeked={syncMediaProperties}
        onEnded={handleEnded}
        onPlay={() => {
          syncMediaProperties();
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        preload="auto"
      />

      {/* Main Bezel: Waveform Display & Stereo VU Level Meter */}
      <div className="flex flex-col gap-2 rounded-sm border-2 border-border bg-theater p-2.5 shadow-inner">
        {audio ? (
          <div className="flex flex-col gap-2">
            {/* Visualizer and Waveform */}
            <AudioWaveform
              onSeek={seekTo}
            />

            {/* Stereo VU Level Meter */}
            <AudioVuMeter isPlaying={playing} />
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
            <SpeedControl
              rate={rate}
              onRateChange={applyRate}
              disabled={!audio}
              pitchPreserve={pitchPreserve}
              onPitchPreserveChange={togglePitchPreserve}
            />
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

        {/* Row 3: Deck Speed Suite (Dropdown, Presets Chips, Popover & Pitch Keep Switch) */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between border-t border-border/40 pt-2.5">
          {/* Speed Dropdown, Fine Speed Popover & Common Presets Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Deck Speed:
            </span>
            <SpeedDropdown
              rate={rate}
              onRateChange={applyRate}
              disabled={!audio}
              className="w-28 sm:w-32"
            />
            <SpeedControl
              rate={rate}
              onRateChange={applyRate}
              disabled={!audio}
              pitchPreserve={pitchPreserve}
              onPitchPreserveChange={togglePitchPreserve}
            />
            <div className="flex flex-wrap items-center gap-1">
              {COMMON_PLAYBACK_RATES.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={Math.abs(rate - r) < 0.001 ? "signal" : "outline"}
                  disabled={!audio}
                  onClick={() => applyRate(r)}
                  className="h-8 min-w-9 px-2 text-xs font-bold font-mono touch-manipulation active:scale-95"
                >
                  {r}×
                </Button>
              ))}
            </div>
          </div>

          {/* Direct Pitch Keep Toggle Switch */}
          <div className="flex items-center gap-2 rounded-xs border border-border/60 bg-secondary/40 px-2.5 py-1">
            <Volume2 className="size-3 text-muted-foreground" />
            <span className="text-[10px] font-bold text-foreground">
              Preserve Audio Pitch:
            </span>
            <Button
              type="button"
              size="sm"
              variant={pitchPreserve ? "signal" : "outline"}
              disabled={!audio}
              onClick={() => togglePitchPreserve(!pitchPreserve)}
              className="h-6 px-2 text-[10px] font-bold font-mono"
              title="Preserve vocal pitch during variable speed playback (prevents chipmunk / deep voice effect)"
            >
              {pitchPreserve ? "ON (Lock Tone)" : "OFF (Tape)"}
            </Button>
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
