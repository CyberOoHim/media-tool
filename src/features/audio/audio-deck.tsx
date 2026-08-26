import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FastForward,
  Music,
  Pause,
  Play,
  Repeat,
  Rewind,
  Scissors,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeckExpander } from "@/components/layout/deck-expander";
import { DropZone } from "@/components/layout/drop-zone";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import { formatFileSize, formatTimePrecise } from "@/features/media/format";
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

function TimeField({
  value,
  placeholder,
  disabled,
  max,
  onChange,
  onEnter,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  max: number;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={(event) => {
        const n = Number(event.target.value);
        if (event.target.value === "") {
          onChange("");
          return;
        }
        if (Number.isNaN(n)) return;
        onChange(String(Math.min(max, Math.max(0, n))));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter();
      }}
      className="h-7 w-12 px-1 text-center font-mono text-xs font-bold"
    />
  );
}

export function AudioDeck() {
  const videoSession = useMediaStore((s) => s.video);

  const audio = useAudioStore((s) => s.audio);
  const ready = useAudioStore((s) => s.ready);
  const playing = useAudioStore((s) => s.playing);
  const currentTime = useAudioStore((s) => s.currentTime);
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
  const cuePoints = useAudioStore((s) => s.cuePoints);
  const eqBypass = useAudioStore((s) => s.eqBypass);
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
  const setPreviewTrimMode = useAudioStore((s) => s.setPreviewTrimMode);
  const addCuePoint = useAudioStore((s) => s.addCuePoint);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  const disabled = !audio || !ready;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
            if (el.paused) void el.play();
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
    }
  }, [loopRange, previewTrimMode, setCurrentTime, setPlaying, trimEnd, trimMode, trimStart]);

  const handleEnded = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (loopRange) {
      if (previewTrimMode && trimMode === "trim") {
        const s = trimStart !== null ? trimStart : 0;
        el.currentTime = s;
        void el.play();
      } else {
        el.currentTime = 0;
        void el.play();
      }
    } else {
      setPlaying(false);
    }
  }, [loopRange, previewTrimMode, setPlaying, trimMode, trimStart]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !audio?.objectUrl) return;

    if (el.paused) {
      if (previewTrimMode && trimMode === "trim") {
        const s = trimStart !== null ? trimStart : 0;
        const e = trimEnd !== null ? trimEnd : el.duration;
        if (el.currentTime >= e - 0.05 || el.currentTime < s - 0.05) {
          el.currentTime = s;
        }
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
  }, [audio?.objectUrl, previewTrimMode, setPlaying, trimEnd, trimMode, trimStart]);

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

  const stepFrame = useCallback(
    (frames: number) => {
      const el = audioRef.current;
      if (!el || !Number.isFinite(el.duration)) return;
      el.pause();
      setPlaying(false);
      seekTo(el.currentTime + (frames * 33.33) / 1000);
    },
    [seekTo, setPlaying],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = progressRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(pct * duration);
    },
    [duration, seekTo],
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
  const gotoTyped = () => {
    const h = Number.parseInt(hours, 10) || 0;
    const m = Number.parseInt(minutes, 10) || 0;
    const s = Number.parseFloat(seconds) || 0;
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
        case "L": {
          e.preventDefault();
          const next = !loopRange;
          toggleLoopRange();
          if (previewTrimMode) {
            toast(`Loop: ${next ? "ON (Selected Period)" : "OFF"}`);
          } else {
            toast(`Loop: ${next ? "ON (Entire Track)" : "OFF"}`);
          }
          break;
        }
        case "p":
        case "P": {
          e.preventDefault();
          const next = !previewTrimMode;
          setPreviewTrimMode(next);
          toast(next ? "Preview Mode: ON (Selected Period)" : "Preview Mode: OFF (Full Audio)");
          break;
        }
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
    previewTrimMode,
    setPreviewTrimMode,
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
      title="Deck-2 // Audio Workstation"
      status={deckStatus}
      statusVariant={deckStatusVariant}
      action={
        audio ? (
          <div className="flex items-center gap-2">
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
                <span className="hidden sm:inline">
                  {isExtracting ? "Extracting Track..." : "Extract from Video"}
                </span>
                <span className="sm:hidden">Extract</span>
              </Button>
            )}
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
          <div className="flex items-center gap-2">
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
                <span>Extract from Video</span>
              </Button>
            )}
            <Badge variant="outline">No Track Inserted</Badge>
          </div>
        )
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

      {/* Main Bezel: Audio Waveform Screen & Stereo VU Meter */}
      <div className="relative overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-theater shadow-inner">
        {audio ? (
          <div className="p-2 sm:p-2.5 flex flex-col gap-2 bg-theater">
            {/* Visualizer and Waveform */}
            <AudioWaveform onSeek={seekTo} />

            {/* Stereo VU Level Meter */}
            <AudioVuMeter isPlaying={playing} />
          </div>
        ) : (
          /* Empty State Drop Box (matching video-player design) */
          <DropZone
            accept="audio/*,video/*"
            onFiles={(files) => {
              if (files[0]) void loadAudioFile(files[0]);
            }}
            className="flex min-h-[240px] lg:min-h-[340px] flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-black/60 p-6 text-center hover:bg-secondary/20 cursor-pointer"
          >
            <div className="grid size-12 place-items-center rounded-full border border-border bg-card shadow-[2px_2px_0px_var(--color-border)]">
              <Music className="size-6 text-signal" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
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

      {/* Retro Timeline & Scrubber with Cut/Trim Region & Cue Marker Pins (matching Video Player) */}
      <div className="mt-3.5 space-y-2 select-none">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-muted-foreground">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Scissors className="size-3.5 text-signal" />
            <span>Timeline Scrubber</span>
            {(trimStart !== null || trimEnd !== null) && (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px] uppercase font-bold",
                  trimMode === "trim"
                    ? "border-success text-success"
                    : "border-destructive text-destructive",
                )}
              >
                {trimMode === "trim" ? "Trim Active" : "Cut Active"}
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-2">
            {previewTrimMode ? (
              <span className="flex items-center gap-1 text-xs text-signal font-bold animate-pulse">
                <Eye className="size-3" /> Preview Active
              </span>
            ) : null}
            <span className="text-[11px]">{cuePoints.length} Cue Marker Pins</span>
          </div>
        </div>

        {/* 36px High Touch Friendly Track */}
        <div
          ref={progressRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          aria-label="Seek"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "group relative h-9 cursor-pointer rounded-[var(--radius-sm)] border-2 border-border bg-secondary shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] select-none overflow-hidden touch-none",
            disabled && "pointer-events-none opacity-50",
          )}
          onMouseDown={(event) => {
            setDragging(true);
            seekFromClientX(event.clientX);
          }}
          onTouchStart={(event) => {
            setDragging(true);
            seekFromClientX(event.touches[0]!.clientX);
          }}
          onTouchMove={(event) => {
            if (dragging && event.touches.length > 0) {
              seekFromClientX(event.touches[0]!.clientX);
            }
          }}
          onTouchEnd={() => setDragging(false)}
          onTouchCancel={() => setDragging(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") seekBy(-2);
            if (event.key === "ArrowRight") seekBy(2);
          }}
        >
          {/* Timeline Tick Marks Background */}
          <div className="absolute inset-0 flex justify-between px-1 opacity-30 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-full w-[1px]",
                  i % 5 === 0 ? "bg-foreground/50 w-[2px]" : "bg-border",
                )}
              />
            ))}
          </div>

          {/* Shaded Trim / Cut Range Overlays */}
          {duration > 0 && (trimStart !== null || trimEnd !== null) ? (() => {
            const startPct =
              trimStart !== null ? Math.min(100, Math.max(0, (trimStart / duration) * 100)) : 0;
            const endPct =
              trimEnd !== null ? Math.min(100, Math.max(0, (trimEnd / duration) * 100)) : 100;
            const left = Math.min(startPct, endPct);
            const width = Math.max(0, Math.abs(endPct - startPct));

            if (trimMode === "trim") {
              return (
                <div
                  className="absolute top-0 bottom-0 bg-success/25 border-x-2 border-success pointer-events-none z-10"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            } else {
              return (
                <div
                  className="absolute top-0 bottom-0 bg-destructive/30 border-x-2 border-destructive pointer-events-none z-10"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.25) 4px, rgba(239, 68, 68, 0.25) 8px)",
                  }}
                />
              );
            }
          })() : null}

          {/* Played Range Fill */}
          <div
            className="relative h-full bg-signal/70 transition-all z-1"
            style={{ width: `${progress}%` }}
          >
            {/* Scrubber Playhead Handle */}
            <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-[var(--radius-sm)] border-2 border-border bg-primary shadow-[2px_2px_0px_var(--color-border)] transition-transform group-hover:scale-110 z-30" />
          </div>

          {/* IN Marker Line & Handle */}
          {duration > 0 && trimStart !== null ? (() => {
            const inPct = Math.min(100, Math.max(0, (trimStart / duration) * 100));
            return (
              <div
                className="absolute top-0 bottom-0 w-[3px] bg-primary z-20 pointer-events-none"
                style={{ left: `${inPct}%` }}
              >
                <span className="absolute top-0.5 -left-2.5 rounded-xs border border-border bg-primary px-1 py-0.5 font-mono text-[9px] font-bold text-primary-foreground shadow-[1px_1px_0px_var(--color-border)]">
                  [ IN
                </span>
              </div>
            );
          })() : null}

          {/* OUT Marker Line & Handle */}
          {duration > 0 && trimEnd !== null ? (() => {
            const outPct = Math.min(100, Math.max(0, (trimEnd / duration) * 100));
            return (
              <div
                className="absolute top-0 bottom-0 w-[3px] bg-destructive z-20 pointer-events-none"
                style={{ left: `${outPct}%` }}
              >
                <span className="absolute bottom-0.5 -right-2.5 rounded-xs border border-border bg-destructive px-1 py-0.5 font-mono text-[9px] font-bold text-white shadow-[1px_1px_0px_var(--color-border)]">
                  OUT ]
                </span>
              </div>
            );
          })() : null}

          {/* Cue Marker Bookmark Pins */}
          {duration > 0
            ? cuePoints.map((cue, idx) => {
                const pinPct = Math.min(100, Math.max(0, (cue.timestampSec / duration) * 100));
                return (
                  <button
                    key={cue.id}
                    type="button"
                    title={`Cue ${idx + 1}: "${cue.label}" @ ${formatTimePrecise(cue.timestampSec)} (Click to jump)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(cue.timestampSec);
                    }}
                    className="absolute top-1/2 -ml-1.5 size-3.5 -translate-y-1/2 rounded-full border-2 border-border bg-amber-500 hover:scale-150 transition-transform z-25 shadow-[1px_1px_0px_var(--color-border)]"
                    style={{ left: `${pinPct}%` }}
                  />
                );
              })
            : null}
        </div>
      </div>

      {/* Touch Jog Wheel Deck (Frame-accurate tactile scrubbing - identical to video player) */}
      <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1">
          <JogDial onStepFrame={stepFrame} disabled={disabled} />
        </div>
        <div className="flex items-center justify-end gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 font-mono text-[11px] font-bold touch-manipulation active:scale-95"
            disabled={disabled}
            onClick={() => stepMs(-50)}
            title="Step backward 50ms (,)"
          >
            -50ms
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 font-mono text-[11px] font-bold touch-manipulation active:scale-95"
            disabled={disabled}
            onClick={() => stepMs(50)}
            title="Step forward 50ms (.)"
          >
            +50ms
          </Button>
        </div>
      </div>

      {/* Main Transport Deck Controls & LCD Timecode (matching Video Player) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/70 p-3 shadow-[2px_2px_0px_var(--color-border)]">
        {/* Navigation Transport Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Hint label="Jump Start">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => seekTo(0)}
            >
              <ChevronsLeft className="size-4" />
            </Button>
          </Hint>
          <Hint label="Rewind 10s (←)">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => {
                seekBy(-10);
                toast("Rewind 10s");
              }}
            >
              <Rewind className="size-4" />
            </Button>
          </Hint>
          <Hint label="Step backward 50ms (,)">
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-2 font-mono text-[11px] font-bold touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => stepMs(-50)}
              title="Step backward 50ms (,)"
            >
              -50ms
            </Button>
          </Hint>

          {/* Large Play/Pause Toggle */}
          <Button
            size="sm"
            variant={playing ? "signal" : "default"}
            disabled={disabled}
            onClick={togglePlay}
            className="h-9 min-w-24 gap-2 font-bold touch-manipulation active:scale-95 text-xs"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause" : "Play"}
          </Button>

          <Hint label="Step forward 50ms (.)">
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-2 font-mono text-[11px] font-bold touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => stepMs(50)}
              title="Step forward 50ms (.)"
            >
              +50ms
            </Button>
          </Hint>
          <Hint label="Forward 10s (→)">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => {
                seekBy(10);
                toast("Forward 10s");
              }}
            >
              <FastForward className="size-4" />
            </Button>
          </Hint>
          <Hint label="Jump End">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => seekTo(Math.max(0, duration - 0.001))}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </Hint>

          {/* Quick In / Out / Preview Buttons directly on Transport */}
          <div className="ml-1 flex items-center gap-1.5 border-l-2 border-border/50 pl-1.5">
            <Hint label="Mark IN Point (I)">
              <Button
                variant={trimStart !== null ? "primary" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setTrimStart(currentTime);
                  toast.success(`Marked IN @ ${formatTimePrecise(currentTime)}`);
                }}
                className="h-9 px-2 font-mono text-[11px] font-bold touch-manipulation active:scale-95"
              >
                [ IN
              </Button>
            </Hint>

            <Hint label="Mark OUT Point (O)">
              <Button
                variant={trimEnd !== null ? "destructive" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={() => {
                  if (trimStart !== null && currentTime <= trimStart) {
                    toast.error("OUT point must be after IN point");
                    return;
                  }
                  setTrimEnd(currentTime);
                  toast.success(`Marked OUT @ ${formatTimePrecise(currentTime)}`);
                }}
                className="h-9 px-2 font-mono text-[11px] font-bold touch-manipulation active:scale-95"
              >
                OUT ]
              </Button>
            </Hint>

            <Hint label="Live Preview Playback (P)">
              <Button
                variant={previewTrimMode ? "signal" : "outline"}
                size="sm"
                disabled={disabled || (trimStart === null && trimEnd === null)}
                onClick={() => {
                  const next = !previewTrimMode;
                  setPreviewTrimMode(next);
                  toast(next ? "Preview Mode: ON (Live Skipping)" : "Preview Mode: OFF");
                }}
                className="h-9 px-2.5 text-[11px] font-bold touch-manipulation active:scale-95"
              >
                <Eye className="size-3.5 mr-1" />
                Preview
              </Button>
            </Hint>

            <Hint
              label={
                loopRange
                  ? previewTrimMode
                    ? "Loop: ON (Selected Period) (L)"
                    : "Loop: ON (Entire Track) (L)"
                  : "Loop (L)"
              }
            >
              <Button
                variant={loopRange ? "signal" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={() => {
                  const next = !loopRange;
                  toggleLoopRange();
                  if (previewTrimMode) {
                    toast(`Loop: ${next ? "ON (Selected Period)" : "OFF"}`);
                  } else {
                    toast(`Loop: ${next ? "ON (Entire Track)" : "OFF"}`);
                  }
                }}
                className="h-9 px-2.5 text-[11px] font-bold touch-manipulation active:scale-95"
              >
                <Repeat className="size-3.5 mr-1" />
                Loop
              </Button>
            </Hint>
          </div>
        </div>

        {/* Digital LCD Timecode Box (matching Video Player) */}
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border-2 border-border bg-theater px-3 py-1.5 text-center font-mono shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
          <span className="size-2.5 rounded-full bg-signal animate-pulse" />
          <p className="text-xs sm:text-sm font-bold tabular tracking-widest text-[#FCEEE2]">
            <span>{formatTimePrecise(currentTime)}</span>
            <span className="text-muted-foreground mx-1.5">/</span>
            <span className="text-muted-foreground">{formatTimePrecise(duration)}</span>
          </p>
        </div>

        {/* Audio Volume & Deck Playback Speed Control */}
        <div className="flex items-center gap-2">
          <Hint label={muted ? "Unmute (M)" : "Mute (M)"}>
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={toggleMute}
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>
          </Hint>
          <Slider
            className="w-20"
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
            value={[muted ? 0 : volume]}
            onValueChange={([value]) => {
              const v = value ?? 0;
              if (muted) setMuted(false);
              setVolume(v);
            }}
          />
          {/* Deck Playback Speed Control */}
          <SpeedControl
            rate={rate}
            onRateChange={applyRate}
            disabled={disabled}
            pitchPreserve={pitchPreserve}
            onPitchPreserveChange={togglePitchPreserve}
          />
        </div>
      </div>

      {/* 3 Expandable Sub-Decks (aligned with Video Player layout & typography) */}
      <div className="mt-3.5 space-y-3.5">
        {/* Expander 1: Cut, Trim & Multi-Format Exporter */}
        <DeckExpander
          id="deck-audio-cut-trim"
          title="Deck-2 // Audio Cut, Trim & Master Exporter"
          subtitle="Sample-accurate splicing, lossless trimming, fade curves & multi-format master export"
          icon={<Scissors className="size-3.5" />}
          badge={
            trimStart !== null || trimEnd !== null ? (
              <Badge variant="signal" className="px-1.5 py-0 text-[8px]">
                RANGE ACTIVE
              </Badge>
            ) : null
          }
          disabled={disabled}
          defaultOpen={true}
        >
          <AudioTrimControls />
        </DeckExpander>

        {/* Expander 2: 5-Band Graphic EQ, Filters & Tone Rack */}
        <DeckExpander
          id="deck-audio-eq-dsp"
          title="Deck-2 // 5-Band Graphic EQ & DSP Tone Rack"
          subtitle="Hardware-modeled parametric equalizer, high/low-pass filters, loudness normalization & dynamics"
          icon={<SlidersHorizontal className="size-3.5" />}
          badge={
            !eqBypass ? (
              <Badge variant="signal" className="px-1.5 py-0 text-[8px]">
                EQ ACTIVE
              </Badge>
            ) : null
          }
          disabled={disabled}
          defaultOpen={true}
        >
          <AudioDspControls />
        </DeckExpander>

        {/* Expander 3: Cue Points & Audio Slice Bookmarks & Direct Timecode Transport */}
        <DeckExpander
          id="deck-audio-cue-points"
          title="Deck-2 // Cue Actions & Timecode Transport"
          subtitle="Timecode slice bookmarking, hot cues, variable playback rates & direct jump"
          icon={<Bookmark className="size-3.5" />}
          badge={
            cuePoints.length > 0 ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[8px] border-amber-500 text-amber-500">
                {cuePoints.length} CUES
              </Badge>
            ) : null
          }
          disabled={disabled}
          defaultOpen={true}
        >
          <div className="space-y-3">
            {/* Speed Selector & Direct Jump Row (identical to Video Player) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between border-b border-border/50 pb-3">
              {/* Speed Selector Dropdown, Chips & Fine Control */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Deck Speed:
                </span>
                <SpeedDropdown
                  rate={rate}
                  onRateChange={applyRate}
                  disabled={disabled}
                  className="w-28 sm:w-32"
                />
                <SpeedControl
                  rate={rate}
                  onRateChange={applyRate}
                  disabled={disabled}
                  pitchPreserve={pitchPreserve}
                  onPitchPreserveChange={togglePitchPreserve}
                />
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_PLAYBACK_RATES.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={Math.abs(rate - r) < 0.001 ? "signal" : "outline"}
                      disabled={disabled}
                      onClick={() => applyRate(r)}
                      className="h-8 min-w-10 px-2 text-xs font-bold font-mono touch-manipulation active:scale-95"
                    >
                      {r}×
                    </Button>
                  ))}
                </div>
              </div>

              {/* Jump To Direct Timecode */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Jump TC:
                </span>
                <div className="flex items-center gap-1.5">
                  <TimeField
                    value={hours}
                    placeholder="00"
                    disabled={disabled}
                    max={99}
                    onChange={setHours}
                    onEnter={gotoTyped}
                  />
                  <span className="font-bold text-muted-foreground">:</span>
                  <TimeField
                    value={minutes}
                    placeholder="00"
                    disabled={disabled}
                    max={59}
                    onChange={setMinutes}
                    onEnter={gotoTyped}
                  />
                  <span className="font-bold text-muted-foreground">:</span>
                  <TimeField
                    value={seconds}
                    placeholder="00"
                    disabled={disabled}
                    max={59}
                    onChange={setSeconds}
                    onEnter={gotoTyped}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={disabled}
                    onClick={gotoTyped}
                    className="h-8 px-2.5 text-xs font-bold font-mono touch-manipulation active:scale-95 ml-1"
                  >
                    Go
                  </Button>
                </div>
              </div>
            </div>

            {/* Audio Technical Specs Ribbon */}
            {audio ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>
                    <strong className="text-foreground">Size:</strong>{" "}
                    {formatFileSize(audio.fileSize)}
                  </span>
                  <span>
                    <strong className="text-foreground">Rate:</strong>{" "}
                    {(audio.sampleRate / 1000).toFixed(1)} kHz
                  </span>
                  <span>
                    <strong className="text-foreground">Layout:</strong>{" "}
                    {audio.numberOfChannels === 1 ? "Mono" : "Stereo (2-ch)"}
                  </span>
                  {!eqBypass ? (
                    <span className="text-signal font-bold">
                      ● EQ: Active 5-Band
                    </span>
                  ) : null}
                </div>
                <span className="font-bold text-success uppercase">● Web Audio Hardware DSP</span>
              </div>
            ) : null}

            {/* Cue Marker Controls Component */}
            <AudioCueControls onSeek={seekTo} />
          </div>
        </DeckExpander>
      </div>
    </Panel>
  );
}

