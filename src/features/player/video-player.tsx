import {
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  FastForward,
  Maximize,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DropZone } from "@/components/layout/drop-zone";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import { copyBlobToClipboard } from "@/features/media/clipboard";
import { formatFileSize, formatTime } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import { cn } from "@/lib/utils";
import { captureVideoFrame } from "./capture-frame";
import { FRAME_STEP, PLAYBACK_RATES, nextRate } from "./rates";

export function VideoPlayer() {
  const videoSession = useMediaStore((s) => s.video);
  const loadVideo = useMediaStore((s) => s.loadVideo);
  const captureFrame = useMediaStore((s) => s.captureFrame);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const progressRef = useRef<HTMLDivElement>(null);

  const hasVideo = Boolean(videoSession);
  const longForm = duration >= 3600;

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [videoSession?.objectUrl]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el?.src) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + delta));
  }, []);

  const jumpTo = useCallback((time: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(el.duration, Math.max(0, time));
  }, []);

  const applyRate = useCallback((next: number) => {
    const el = videoRef.current;
    setRate(next);
    if (el) el.playbackRate = next;
  }, []);

  const capture = useCallback(async () => {
    const el = videoRef.current;
    const session = useMediaStore.getState().video;
    if (!el || !session) {
      toast("Nothing to capture");
      return;
    }
    try {
      const frame = await captureVideoFrame(el);
      captureFrame({
        ...frame,
        timestampSec: el.currentTime,
        videoName: session.fileName,
      });
      toast.success("Frame captured");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Capture failed");
    }
  }, [captureFrame]);

  const copyFrame = useCallback(async () => {
    const el = videoRef.current;
    if (!el) {
      toast("Nothing to capture");
      return;
    }
    try {
      const frame = await captureVideoFrame(el);
      await copyBlobToClipboard(frame.blob);
      toast.success("Frame copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    toast(el.muted ? "Muted" : "Unmuted");
  }, []);

  const fullscreen = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen();
    else if ("webkitRequestFullscreen" in el) {
      (el as HTMLVideoElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    }
  }, []);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = videoRef.current;
      const bar = progressRef.current;
      if (!el || !bar || !Number.isFinite(el.duration)) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      el.currentTime = pct * el.duration;
    },
    [],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (dragging) seekFromClientX(event.clientX);
    };
    const onUp = () => setDragging(false);
    const onTouchMove = (event: TouchEvent) => {
      if (dragging && event.touches[0]) seekFromClientX(event.touches[0].clientX);
    };
    const onTouchEnd = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragging, seekFromClientX]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!videoSession) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          event.preventDefault();
          seekBy(-10);
          toast("-10s");
          break;
        case "arrowright":
          event.preventDefault();
          seekBy(10);
          toast("+10s");
          break;
        case ",":
          event.preventDefault();
          videoRef.current?.pause();
          seekBy(-FRAME_STEP);
          break;
        case ".":
          event.preventDefault();
          videoRef.current?.pause();
          seekBy(FRAME_STEP);
          break;
        case "[":
          event.preventDefault();
          applyRate(nextRate(rate, -1));
          break;
        case "]":
          event.preventDefault();
          applyRate(nextRate(rate, 1));
          break;
        case "s":
          event.preventDefault();
          void capture();
          break;
        case "c":
          event.preventDefault();
          void copyFrame();
          break;
        case "m":
          event.preventDefault();
          toggleMute();
          break;
        case "f":
          event.preventDefault();
          fullscreen();
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [applyRate, capture, copyFrame, fullscreen, rate, seekBy, toggleMute, togglePlay, videoSession]);

  const gotoTyped = () => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const h = Number.parseInt(hours, 10) || 0;
    const m = Number.parseInt(minutes, 10) || 0;
    const s = Number.parseInt(seconds, 10) || 0;
    const total = h * 3600 + m * 60 + s;
    if (total > el.duration) {
      toast.error("Invalid time");
      return;
    }
    el.currentTime = total;
    toast(`Jump to ${formatTime(total, true)}`);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const disabled = !ready;

  return (
    <Panel
      title="Player"
      action={
        videoSession ? (
          <span className="truncate font-mono text-xs text-muted-foreground">{videoSession.fileName}</span>
        ) : (
          <Badge>No file selected</Badge>
        )
      }
    >
      {videoSession ? (
        <div
          className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-theater lg:min-h-[300px]"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file?.type.startsWith("video/")) {
              loadVideo(file);
              toast.success("Video loaded");
            }
          }}
        >
          <video
            ref={videoRef}
            src={videoSession.objectUrl}
            className="max-h-[50vh] w-full bg-black object-contain lg:max-h-[56vh]"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration);
              setReady(true);
              event.currentTarget.volume = volume;
              event.currentTarget.playbackRate = rate;
            }}
            onTimeUpdate={(event) => {
              const el = event.currentTarget;
              if (el.duration - el.currentTime < 0.1) setCurrent(el.duration);
              else setCurrent(el.currentTime);
            }}
            onVolumeChange={(event) => {
              setMuted(event.currentTarget.muted);
              setVolume(event.currentTarget.volume);
            }}
          />
        </div>
      ) : (
        <DropZone
          accept="video/mp4,video/*"
          onFiles={(files) => {
            loadVideo(files[0]!);
            toast.success("Video loaded");
          }}
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-theater px-6 py-10 text-center lg:min-h-[300px]"
        >
          <Upload className="size-8 text-signal" />
          <p className="font-mono text-sm text-foreground">Click or drag a video file</p>
          <p className="text-xs text-muted-foreground">MP4, WebM, and other browser-playable formats</p>
        </DropZone>
      )}

      {videoSession ? (
        <div className="mt-2 flex justify-end">
          <DropZone
            accept="video/mp4,video/*"
            onFiles={(files) => {
              loadVideo(files[0]!);
              toast.success("Video loaded");
            }}
            className="border-0 px-0 py-0"
          >
            <span className="font-mono text-xs text-signal underline-offset-4 hover:underline">Replace video</span>
          </DropZone>
        </div>
      ) : null}

      <div
        ref={progressRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={current}
        aria-label="Seek"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "group mt-4 h-4 cursor-pointer rounded-full bg-border",
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
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") seekBy(-2);
          if (event.key === "ArrowRight") seekBy(2);
        }}
      >
        <div
          className="relative h-full rounded-full bg-signal"
          style={{ width: `${progress}%` }}
        >
          <span className="absolute -right-2 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-foreground shadow transition-transform group-hover:scale-110" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Hint label="Start">
            <Button variant="outline" size="icon-sm" disabled={disabled} onClick={() => jumpTo(0)}>
              <ChevronsLeft />
            </Button>
          </Hint>
          <Hint label="Rewind 10s">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                seekBy(-10);
                toast("Rewind 10s");
              }}
            >
              <Rewind />
              10s
            </Button>
          </Hint>
          <Hint label="Previous frame">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                videoRef.current?.pause();
                seekBy(-FRAME_STEP);
              }}
            >
              <SkipBack />
            </Button>
          </Hint>
          <Button size="sm" disabled={disabled} onClick={togglePlay} className="min-w-20">
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Hint label="Next frame">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                videoRef.current?.pause();
                seekBy(FRAME_STEP);
              }}
            >
              <SkipForward />
            </Button>
          </Hint>
          <Hint label="Forward 10s">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                seekBy(10);
                toast("Forward 10s");
              }}
            >
              <FastForward />
              10s
            </Button>
          </Hint>
          <Hint label="End">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                jumpTo(Math.max(0, el.duration - 0.001));
                toast("Jump to end");
              }}
            >
              <ChevronsRight />
            </Button>
          </Hint>
        </div>

        <p className="font-mono text-sm tabular text-muted-foreground">
          <span className="text-foreground">{formatTime(current, longForm)}</span>
          {" / "}
          {formatTime(duration, longForm)}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Hint label="Capture frame (S)">
            <Button variant="success" size="icon" disabled={disabled} onClick={() => void capture()}>
              <Camera />
            </Button>
          </Hint>
          <Hint label="Copy frame (C)">
            <Button variant="outline" size="icon" disabled={disabled} onClick={() => void copyFrame()}>
              <Copy />
            </Button>
          </Hint>
          <Hint label={muted ? "Unmute (M)" : "Mute (M)"}>
            <Button variant="outline" size="icon" disabled={disabled} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
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
              const el = videoRef.current;
              const v = value ?? 0;
              setVolume(v);
              if (el) {
                el.volume = v;
                el.muted = v === 0;
              }
            }}
          />
          <Hint label="Fullscreen (F)">
            <Button variant="outline" size="icon" disabled={disabled} onClick={fullscreen}>
              <Maximize />
            </Button>
          </Hint>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Jump to</span>
          <div className="flex items-center gap-1">
            <TimeField
              value={hours}
              placeholder="00"
              disabled={disabled}
              max={99}
              onChange={setHours}
              onEnter={gotoTyped}
            />
            <span className="text-muted-foreground">:</span>
            <TimeField
              value={minutes}
              placeholder="00"
              disabled={disabled}
              max={59}
              onChange={setMinutes}
              onEnter={gotoTyped}
            />
            <span className="text-muted-foreground">:</span>
            <TimeField
              value={seconds}
              placeholder="00"
              disabled={disabled}
              max={59}
              onChange={setSeconds}
              onEnter={gotoTyped}
            />
          </div>
          <Button variant="outline" size="sm" disabled={disabled} onClick={gotoTyped}>
            Go
          </Button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Rate</span>
          <div className="flex flex-wrap gap-1">
            {PLAYBACK_RATES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={rate === r ? "default" : "outline"}
                disabled={disabled}
                onClick={() => applyRate(r)}
                className="min-w-11 px-2"
              >
                {r}×
              </Button>
            ))}
          </div>
        </div>
      </div>

      {videoSession ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {formatFileSize(videoSession.fileSize)}
        </p>
      ) : null}

      <p className="mt-3 border-t border-border pt-3 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
        <Kbd>Space</Kbd> Play/Pause&nbsp;&nbsp;
        <Kbd>←/→</Kbd> Seek&nbsp;&nbsp;
        <Kbd>,/.</Kbd> Frame&nbsp;&nbsp;
        <Kbd>[/]</Kbd> Rate&nbsp;&nbsp;
        <Kbd>S</Kbd> Capture&nbsp;&nbsp;
        <Kbd>C</Kbd> Copy&nbsp;&nbsp;
        <Kbd>F</Kbd> Fullscreen
      </p>
    </Panel>
  );
}

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
      className="h-9 w-14 px-1 text-center"
    />
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}
