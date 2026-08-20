import {
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  FastForward,
  Layers,
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
import { TransformControls } from "@/components/media/transform-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import { copyBlobToClipboard } from "@/features/media/clipboard";
import { getCropAspectRatio, resolveCropTarget } from "@/features/media/crop";
import { formatFileSize, formatTime } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import {
  DEFAULT_TRANSFORM,
  calculateOrientedDimensions,
  clampPan,
  clampZoom,
  getTransformCss,
  hasActiveTransform,
  rotateClockwise,
  type TransformState,
} from "@/features/media/transform";
import { CROP_PRESETS } from "@/features/media/types";
import { cn } from "@/lib/utils";
import { captureVideoFrame } from "./capture-frame";
import { FRAME_STEP, PLAYBACK_RATES, nextRate } from "./rates";

export function VideoPlayer() {
  const videoSession = useMediaStore((s) => s.video);
  const captures = useMediaStore((s) => s.captures);
  const loadVideo = useMediaStore((s) => s.loadVideo);
  const captureFrame = useMediaStore((s) => s.captureFrame);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const progressRef = useRef<HTMLDivElement>(null);

  // Transform State for Video
  const [videoTransform, setVideoTransform] = useState<TransformState>(DEFAULT_TRANSFORM);
  const [bakeTransformOnCapture, setBakeTransformOnCapture] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const hasVideo = Boolean(videoSession);
  const longForm = duration >= 3600;

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setVideoDims(null);
    setVideoTransform(DEFAULT_TRANSFORM);
  }, [videoSession?.objectUrl]);

  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [videoSession?.objectUrl]);

  const triggerShutterFlash = () => {
    setFlashing(true);
    setTimeout(() => setFlashing(false), 350);
  };

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
    triggerShutterFlash();
    try {
      const activeTransform = bakeTransformOnCapture ? videoTransform : undefined;
      const frame = await captureVideoFrame(el, activeTransform);
      captureFrame({
        ...frame,
        timestampSec: el.currentTime,
        videoName: session.fileName,
      });
      const note =
        bakeTransformOnCapture && hasActiveTransform(videoTransform)
          ? " (Transformed)"
          : "";
      toast.success(`Snapped frame @ ${formatTime(el.currentTime, true)}${note} ➜ Bench`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Capture failed");
    }
  }, [bakeTransformOnCapture, captureFrame, videoTransform]);

  const burstCapture = useCallback(async () => {
    const el = videoRef.current;
    const session = useMediaStore.getState().video;
    if (!el || !session) {
      toast("Nothing to capture");
      return;
    }
    triggerShutterFlash();
    try {
      const activeTransform = bakeTransformOnCapture ? videoTransform : undefined;
      // Capture 3 frames in quick succession
      for (let i = 0; i < 3; i++) {
        const frame = await captureVideoFrame(el, activeTransform);
        captureFrame({
          ...frame,
          timestampSec: el.currentTime,
          videoName: session.fileName,
        });
        if (i < 2) {
          el.currentTime = Math.min(el.duration, el.currentTime + FRAME_STEP * 2);
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      toast.success("Burst captured 3 frames ➜ Bench");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Burst capture failed");
    }
  }, [bakeTransformOnCapture, captureFrame, videoTransform]);

  const copyFrame = useCallback(async () => {
    const el = videoRef.current;
    if (!el) {
      toast("Nothing to capture");
      return;
    }
    triggerShutterFlash();
    try {
      const activeTransform = bakeTransformOnCapture ? videoTransform : undefined;
      const frame = await captureVideoFrame(el, activeTransform);
      await copyBlobToClipboard(frame.blob);
      toast.success("Copied frame to clipboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  }, [bakeTransformOnCapture, videoTransform]);

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

  // Timeline dragging
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

  // Viewport Pan drag handler
  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!isPanning || !dragStartRef.current || !videoContainerRef.current) return;
      const rect = videoContainerRef.current.getBoundingClientRect();
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      const newPanX = clampPan(dragStartRef.current.startPanX + (dx / rect.width) * 100);
      const newPanY = clampPan(dragStartRef.current.startPanY + (dy / rect.height) * 100);
      setVideoTransform((prev) => ({ ...prev, panX: newPanX, panY: newPanY }));
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        dragStartRef.current = null;
      }
    };

    if (isPanning) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isPanning]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!videoSession) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void burstCapture();
        return;
      }

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
        case "r":
          event.preventDefault();
          setVideoTransform((prev) => ({
            ...prev,
            rotation: rotateClockwise(prev.rotation),
          }));
          toast("Rotated +90°");
          break;
        case "h":
          event.preventDefault();
          setVideoTransform((prev) => ({ ...prev, flipH: !prev.flipH }));
          toast("Flipped Horizontal");
          break;
        case "v":
          event.preventDefault();
          setVideoTransform((prev) => ({ ...prev, flipV: !prev.flipV }));
          toast("Flipped Vertical");
          break;
        case "+":
        case "=":
          event.preventDefault();
          setVideoTransform((prev) => ({
            ...prev,
            zoom: clampZoom(prev.zoom + 0.2),
          }));
          break;
        case "-":
        case "_":
          event.preventDefault();
          setVideoTransform((prev) => ({
            ...prev,
            zoom: clampZoom(prev.zoom - 0.2),
          }));
          break;
        case "0":
          event.preventDefault();
          setVideoTransform(DEFAULT_TRANSFORM);
          toast("Transforms Reset");
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    applyRate,
    burstCapture,
    capture,
    copyFrame,
    fullscreen,
    rate,
    seekBy,
    toggleMute,
    togglePlay,
    videoSession,
  ]);

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
    toast(`Jumped to ${formatTime(total, true)}`);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const disabled = !ready;

  // Deck status LED text
  const deckStatus = !videoSession
    ? "NO MEDIA"
    : !ready
      ? "LOADING"
      : playing
        ? "PLAYING"
        : "STANDBY";

  const deckStatusVariant = playing ? "success" : hasVideo ? "signal" : "default";

  return (
    <Panel
      title="Deck-1 // Video Player"
      status={deckStatus}
      statusVariant={deckStatusVariant}
      action={
        videoSession ? (
          <div className="flex items-center gap-2">
            <span className="max-w-[140px] truncate font-mono text-[11px] font-bold text-foreground sm:max-w-[220px]">
              {videoSession.fileName}
            </span>
            <DropZone
              accept="video/mp4,video/*"
              onFiles={(files) => {
                loadVideo(files[0]!);
                toast.success("Video loaded");
              }}
              className="border-0 bg-transparent px-0 py-0 hover:bg-transparent"
            >
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                Eject / Swap
              </Button>
            </DropZone>
          </div>
        ) : (
          <Badge variant="outline">No Tape Inserted</Badge>
        )
      }
    >
      {/* Video Screen Bezel */}
      <div className="relative overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-theater shadow-inner">
        {videoSession ? (
          <div
            ref={videoContainerRef}
            className={cn(
              "relative flex min-h-[240px] items-center justify-center overflow-hidden lg:min-h-[320px] select-none",
              videoTransform.zoom > 1 || isPanning
                ? isPanning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-default",
            )}
            onWheel={(event) => {
              event.preventDefault();
              const delta = event.deltaY < 0 ? 0.15 : -0.15;
              setVideoTransform((prev) => ({
                ...prev,
                zoom: clampZoom(prev.zoom + delta),
              }));
            }}
            onMouseDown={(event) => {
              if (event.button === 0) {
                dragStartRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  startPanX: videoTransform.panX,
                  startPanY: videoTransform.panY,
                };
                setIsPanning(true);
              }
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              setVideoTransform((prev) => ({
                ...prev,
                zoom: 1,
                panX: 0,
                panY: 0,
              }));
              toast("Zoom & Pan Centered");
            }}
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
            {/* Retro Bezel Overlay Frame Corners */}
            <div className="pointer-events-none absolute inset-2 z-10 flex flex-col justify-between text-muted/30 font-mono text-[10px]">
              <div className="flex justify-between">
                <span>⌜ VCR-REC</span>
                <div className="flex items-center gap-1.5">
                  {hasActiveTransform(videoTransform) ? (
                    <span className="rounded-xs bg-signal/20 px-1 text-signal font-bold">
                      TRANSFORM ACTIVE
                    </span>
                  ) : null}
                  <span>CH-01 ⌝</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span>⌞ {rate}× SPEED</span>
                <span>STILL-CAPTURE ⌟</span>
              </div>
            </div>

            {/* Visual Safe-Area / Crop Framing Mask */}
            {videoTransform.cropPreset !== "none" ? (() => {
              const oriented = videoDims
                ? calculateOrientedDimensions(videoDims.w, videoDims.h, videoTransform.rotation)
                : { width: 1920, height: 1080 };

              const cropRatio =
                getCropAspectRatio(
                  videoTransform.cropPreset,
                  videoTransform.customWidth,
                  videoTransform.customHeight,
                  oriented.width,
                  oriented.height,
                ) ?? (16 / 9);

              const cropTarget = videoDims
                ? resolveCropTarget(
                    oriented.width,
                    oriented.height,
                    videoTransform.cropPreset,
                    videoTransform.customWidth,
                    videoTransform.customHeight,
                  )
                : null;

              const presetLabel =
                CROP_PRESETS.find((p) => p.id === videoTransform.cropPreset)?.label ??
                videoTransform.cropPreset;

              // Best fit upon video viewport:
              // Width fit or Height fit, whichever first hits the edge flush (0 arbitrary padding)
              let frameStyle: React.CSSProperties = {
                aspectRatio: `${cropRatio}`,
              };

              if (viewportSize.width > 0 && viewportSize.height > 0) {
                const containerAspect = viewportSize.width / viewportSize.height;
                if (cropRatio >= containerAspect) {
                  // Width fit (hits left & right edges flush)
                  const fw = viewportSize.width;
                  const fh = Math.round(viewportSize.width / cropRatio);
                  frameStyle = {
                    width: `${fw}px`,
                    height: `${fh}px`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  };
                } else {
                  // Height fit (hits top & bottom edges flush)
                  const fh = viewportSize.height;
                  const fw = Math.round(viewportSize.height * cropRatio);
                  frameStyle = {
                    width: `${fw}px`,
                    height: `${fh}px`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  };
                }
              } else {
                frameStyle =
                  cropRatio >= 1
                    ? { width: "100%", height: "auto", aspectRatio: `${cropRatio}` }
                    : { height: "100%", width: "auto", aspectRatio: `${cropRatio}` };
              }

              return (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
                  <div
                    className="relative flex items-start justify-between border-2 border-dashed border-signal bg-signal/5 p-1.5 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all duration-100"
                    style={frameStyle}
                  >
                    {/* Rule of thirds grid lines */}
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                      <div className="border-r border-b border-dashed border-signal" />
                      <div className="border-r border-b border-dashed border-signal" />
                      <div className="border-b border-dashed border-signal" />
                      <div className="border-r border-b border-dashed border-signal" />
                      <div className="border-r border-b border-dashed border-signal" />
                      <div className="border-b border-dashed border-signal" />
                      <div className="border-r border-dashed border-signal" />
                      <div className="border-r border-dashed border-signal" />
                      <div />
                    </div>

                    {/* Center alignment crosshair */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
                      <div className="h-4 w-[1px] bg-signal" />
                      <div className="h-[1px] w-4 bg-signal absolute" />
                    </div>

                    {/* Framing Tag Badge with Dimensions */}
                    <div className="relative z-10 flex flex-wrap items-center gap-1">
                      <span className="rounded-xs bg-signal px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-foreground shadow-xs">
                        {presetLabel}
                      </span>
                      {cropTarget ? (
                        <span className="rounded-xs bg-black/85 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-[#fceee2] border border-signal/30">
                          {cropTarget.width} × {cropTarget.height} px
                        </span>
                      ) : null}
                    </div>

                    <div className="relative z-10">
                      <span className="rounded-xs bg-black/85 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-signal uppercase border border-signal/30">
                        CROP APERTURE
                      </span>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            {/* Shutter Flash Layer */}
            {flashing ? (
              <div className="pointer-events-none absolute inset-0 z-30 bg-white/90 animate-shutter" />
            ) : null}

            <video
              ref={videoRef}
              src={videoSession.objectUrl}
              style={{
                transform: getTransformCss(videoTransform),
                transformOrigin: "center center",
                transition: isPanning ? "none" : "transform 120ms ease-out",
              }}
              className="max-h-[50vh] w-full bg-black object-contain lg:max-h-[56vh]"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onClick={togglePlay}
              onLoadedMetadata={(event) => {
                setDuration(event.currentTarget.duration);
                setVideoDims({
                  w: event.currentTarget.videoWidth,
                  h: event.currentTarget.videoHeight,
                });
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
            className="flex min-h-[240px] flex-col items-center justify-center gap-3 border-0 bg-transparent px-6 py-12 text-center lg:min-h-[320px]"
          >
            <div className="grid size-14 place-items-center rounded-[var(--radius-sm)] border-2 border-border bg-signal text-foreground shadow-[2px_2px_0px_var(--color-border)]">
              <Upload className="size-7" />
            </div>
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                Insert Video Tape / File
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Drag & drop MP4, WebM, MOV or click to browse
              </p>
            </div>
          </DropZone>
        )}
      </div>

      {/* Retro Timeline & Scrubber with Capture Bookmark Pins */}
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-muted-foreground">
          <span className="uppercase tracking-wider">Timeline Scrubber</span>
          <span>{captures.length} Bookmark Pins</span>
        </div>

        <div
          ref={progressRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={current}
          aria-label="Seek"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "group relative h-5 cursor-pointer rounded-[var(--radius-sm)] border-2 border-border bg-secondary shadow-[1px_1px_0px_var(--color-border)] select-none",
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
          {/* Timeline Tick Marks Background */}
          <div className="absolute inset-0 flex justify-between px-1 opacity-25 pointer-events-none">
            {Array.from({ length: 11 }).map((_, i) => (
              <span key={i} className="h-full w-[1px] bg-border" />
            ))}
          </div>

          {/* Played Range Fill */}
          <div
            className="relative h-full bg-signal transition-all"
            style={{ width: `${progress}%` }}
          >
            {/* Scrubber Playhead Handle */}
            <span className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-[var(--radius-sm)] border-2 border-border bg-primary shadow-[1px_1px_0px_var(--color-border)] transition-transform group-hover:scale-110" />
          </div>

          {/* Capture Timestamp Bookmark Pins */}
          {duration > 0
            ? captures.map((cap) => {
                const pinPct = Math.min(100, Math.max(0, (cap.timestampSec / duration) * 100));
                return (
                  <button
                    key={cap.id}
                    type="button"
                    title={`Captured @ ${formatTime(cap.timestampSec)} (Click to jump)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      jumpTo(cap.timestampSec);
                    }}
                    className="absolute top-0 -ml-1 size-2.5 -translate-y-0.5 rounded-full border border-border bg-destructive hover:scale-150 transition-transform z-20"
                    style={{ left: `${pinPct}%` }}
                  />
                );
              })
            : null}
        </div>
      </div>

      {/* Main Transport Deck Controls & LCD Timecode */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/70 p-2.5 shadow-[2px_2px_0px_var(--color-border)]">
        {/* Navigation Transport Controls */}
        <div className="flex flex-wrap items-center gap-1">
          <Hint label="Jump Start">
            <Button variant="outline" size="icon-sm" disabled={disabled} onClick={() => jumpTo(0)}>
              <ChevronsLeft />
            </Button>
          </Hint>
          <Hint label="Rewind 10s (←)">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                seekBy(-10);
                toast("Rewind 10s");
              }}
            >
              <Rewind />
            </Button>
          </Hint>
          <Hint label="Previous Frame (,)">
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

          {/* Large Play/Pause Toggle */}
          <Button
            size="sm"
            variant={playing ? "signal" : "default"}
            disabled={disabled}
            onClick={togglePlay}
            className="min-w-22 gap-1.5 font-bold"
          >
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </Button>

          <Hint label="Next Frame (.)">
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
          <Hint label="Forward 10s (→)">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                seekBy(10);
                toast("Forward 10s");
              }}
            >
              <FastForward />
            </Button>
          </Hint>
          <Hint label="Jump End">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                jumpTo(Math.max(0, el.duration - 0.001));
              }}
            >
              <ChevronsRight />
            </Button>
          </Hint>
        </div>

        {/* Digital LCD Timecode Box */}
        <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border-2 border-border bg-theater px-3 py-1 text-center font-mono shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
          <span className="size-2 rounded-full bg-signal animate-pulse" />
          <p className="text-xs font-bold tabular tracking-widest text-[#FCEEE2]">
            <span>{formatTime(current, longForm)}</span>
            <span className="text-muted-foreground mx-1">/</span>
            <span className="text-muted-foreground">{formatTime(duration, longForm)}</span>
          </p>
        </div>

        {/* Audio Volume & Fullscreen */}
        <div className="flex items-center gap-2">
          <Hint label={muted ? "Unmute (M)" : "Mute (M)"}>
            <Button variant="outline" size="icon-sm" disabled={disabled} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
            </Button>
          </Hint>
          <Slider
            className="w-18"
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
            <Button variant="outline" size="icon-sm" disabled={disabled} onClick={fullscreen}>
              <Maximize />
            </Button>
          </Hint>
        </div>
      </div>

      {/* Deck Transform Toolbar (Zoom, Pan, Rotate, Flip, Crop) */}
      <div className="mt-3">
        <TransformControls
          transform={videoTransform}
          onChange={(partial) => setVideoTransform((prev) => ({ ...prev, ...partial }))}
          onReset={() => {
            setVideoTransform(DEFAULT_TRANSFORM);
            toast("Deck transforms reset");
          }}
          title="Deck-1 // Transform & Crop Framing"
          disabled={disabled}
          bakeToggle={{
            enabled: bakeTransformOnCapture,
            onToggle: (val) => setBakeTransformOnCapture(val),
          }}
        />
      </div>

      {/* Capture Action Bar (Snap, Burst, Copy) */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="success"
          size="default"
          disabled={disabled}
          onClick={() => void capture()}
          className="gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)]"
        >
          <Camera className="size-4" />
          Snap Frame (S)
        </Button>

        <Button
          type="button"
          variant="accent"
          size="default"
          disabled={disabled}
          onClick={() => void burstCapture()}
          className="gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)]"
          title="Capture 3 frames in quick succession"
        >
          <Layers className="size-4" />
          Burst 3× (Shift+S)
        </Button>

        <Button
          type="button"
          variant="outline"
          size="default"
          disabled={disabled}
          onClick={() => void copyFrame()}
          className="gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)]"
        >
          <Copy className="size-4" />
          Copy Still (C)
        </Button>
      </div>

      {/* Speed Selector & Direct Jump Row */}
      <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between border-t-2 border-border/40 pt-3">
        {/* Speed Selector Chips */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Deck Speed:
          </span>
          <div className="flex flex-wrap gap-1">
            {PLAYBACK_RATES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={rate === r ? "signal" : "outline"}
                disabled={disabled}
                onClick={() => applyRate(r)}
                className="h-6 min-w-9 px-1.5 text-[10px] font-bold"
              >
                {r}×
              </Button>
            ))}
          </div>
        </div>

        {/* Jump To Direct Timecode */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Jump TC:
          </span>
          <div className="flex items-center gap-1">
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
          </div>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" disabled={disabled} onClick={gotoTyped}>
            Go
          </Button>
        </div>
      </div>

      {/* Video Technical Specs Ribbon */}
      {videoSession ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-foreground">Size:</strong> {formatFileSize(videoSession.fileSize)}
            </span>
            {videoDims ? (
              <span>
                <strong className="text-foreground">Res:</strong> {videoDims.w} × {videoDims.h}
              </span>
            ) : null}
            {hasActiveTransform(videoTransform) ? (
              <span className="text-signal font-bold">
                ● Zoom: {Math.round(videoTransform.zoom * 100)}% | Rot: {Math.round(videoTransform.rotation)}°
                {videoTransform.cropPreset !== "none" ? ` | Crop: ${videoTransform.cropPreset}` : ""}
              </span>
            ) : null}
          </div>
          <span className="font-bold text-success uppercase">● Hardware Accelerated</span>
        </div>
      ) : null}
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
      className="h-7 w-12 px-1 text-center font-mono text-xs font-bold"
    />
  );
}
