import {
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Eye,
  FastForward,
  Layers,
  Maximize,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Sliders,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeckExpander } from "@/components/layout/deck-expander";
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
import { formatFileSize, formatTime, formatTimePrecise } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import {
  DEFAULT_TRANSFORM,
  calculateOrientedDimensions,
  clampPan,
  clampZoom,
  getTransformCss,
  hasActiveTransform,
  normalizeRotation,
  rotateClockwise,
  type TransformState,
} from "@/features/media/transform";
import { CROP_PRESETS } from "@/features/media/types";
import { cn } from "@/lib/utils";
import { captureVideoFrame } from "./capture-frame";
import { JogDial } from "./jog-dial";
import { FRAME_STEP, PLAYBACK_RATES, nextRate } from "./rates";
import { TrimControls } from "./trim-controls";

export function VideoPlayer() {
  const videoSession = useMediaStore((s) => s.video);
  const captures = useMediaStore((s) => s.captures);
  const loadVideo = useMediaStore((s) => s.loadVideo);
  const captureFrame = useMediaStore((s) => s.captureFrame);

  // Trim state
  const trimMode = useMediaStore((s) => s.trimMode);
  const trimStart = useMediaStore((s) => s.trimStart);
  const trimEnd = useMediaStore((s) => s.trimEnd);
  const previewTrimMode = useMediaStore((s) => s.previewTrimMode);
  const setTrimStart = useMediaStore((s) => s.setTrimStart);
  const setTrimEnd = useMediaStore((s) => s.setTrimEnd);
  const setPreviewTrimMode = useMediaStore((s) => s.setPreviewTrimMode);
  const clearTrimRange = useMediaStore((s) => s.clearTrimRange);
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

  // Multi-Touch Pinch, Rotate & Pan Touch References
  const touchStateRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    initialAngle: number;
    initialRotation: number;
    initialMidpoint: { x: number; y: number };
    startPanX: number;
    startPanY: number;
    lastTapTime: number;
    lastTapPos: { x: number; y: number };
  }>({
    initialDistance: 0,
    initialZoom: 1,
    initialAngle: 0,
    initialRotation: 0,
    initialMidpoint: { x: 0, y: 0 },
    startPanX: 0,
    startPanY: 0,
    lastTapTime: 0,
    lastTapPos: { x: 0, y: 0 },
  });

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

  const stepFrame = useCallback((frames: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.pause();
    const delta = frames * FRAME_STEP;
    el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + delta));
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
        case "i":
          event.preventDefault();
          setTrimStart(videoRef.current?.currentTime ?? 0);
          toast.success(`Marked IN (Start) @ ${formatTimePrecise(videoRef.current?.currentTime ?? 0)}`);
          break;
        case "o":
          event.preventDefault();
          setTrimEnd(videoRef.current?.currentTime ?? 0);
          toast.success(`Marked OUT (End) @ ${formatTimePrecise(videoRef.current?.currentTime ?? 0)}`);
          break;
        case "x":
          event.preventDefault();
          clearTrimRange();
          toast("Cleared Cut/Trim Points");
          break;
        case "p":
          event.preventDefault();
          setPreviewTrimMode(!previewTrimMode);
          toast(previewTrimMode ? "Preview Mode: OFF" : "Preview Mode: ON (Live Range)");
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
    clearTrimRange,
    copyFrame,
    fullscreen,
    previewTrimMode,
    rate,
    seekBy,
    setPreviewTrimMode,
    setTrimEnd,
    setTrimStart,
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
              "relative flex min-h-[240px] items-center justify-center overflow-hidden lg:min-h-[340px] select-none touch-none",
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
            onTouchStart={(event) => {
              if (event.touches.length === 2) {
                // Multi-touch Pinch to zoom, Two-finger Rotate, and Two-finger Pan
                const t1 = event.touches[0]!;
                const t2 = event.touches[1]!;
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
                const midX = (t1.clientX + t2.clientX) / 2;
                const midY = (t1.clientY + t2.clientY) / 2;
                touchStateRef.current = {
                  ...touchStateRef.current,
                  initialDistance: dist,
                  initialZoom: videoTransform.zoom,
                  initialAngle: angle,
                  initialRotation: videoTransform.rotation,
                  initialMidpoint: { x: midX, y: midY },
                  startPanX: videoTransform.panX,
                  startPanY: videoTransform.panY,
                };
              } else if (event.touches.length === 1) {
                const t = event.touches[0]!;
                const now = Date.now();
                const last = touchStateRef.current.lastTapTime;
                const lastPos = touchStateRef.current.lastTapPos;
                const distFromLast = Math.hypot(t.clientX - lastPos.x, t.clientY - lastPos.y);

                // Double-tap detection (<300ms, <40px movement)
                if (now - last < 300 && distFromLast < 40) {
                  const rect = videoContainerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const relativeX = (t.clientX - rect.left) / rect.width;
                    if (relativeX < 0.35) {
                      // Double tap left edge: -10s
                      seekBy(-10);
                      toast("-10s");
                    } else if (relativeX > 0.65) {
                      // Double tap right edge: +10s
                      seekBy(10);
                      toast("+10s");
                    } else {
                      // Double tap center: reset transforms or zoom toggle
                      if (hasActiveTransform(videoTransform)) {
                        setVideoTransform(DEFAULT_TRANSFORM);
                        toast("All Transforms Cleared (100% / 0°)");
                      } else {
                        setVideoTransform((prev) => ({ ...prev, zoom: 2 }));
                        toast("2× Zoom");
                      }
                    }
                  }
                  touchStateRef.current.lastTapTime = 0;
                  return;
                }

                touchStateRef.current.lastTapTime = now;
                touchStateRef.current.lastTapPos = { x: t.clientX, y: t.clientY };

                // 1-Finger Pan when zoomed in
                if (videoTransform.zoom > 1) {
                  dragStartRef.current = {
                    x: t.clientX,
                    y: t.clientY,
                    startPanX: videoTransform.panX,
                    startPanY: videoTransform.panY,
                  };
                  setIsPanning(true);
                }
              }
            }}
            onTouchMove={(event) => {
              if (event.touches.length === 2) {
                // Multi-touch: Pinch to Zoom + Two-Finger Rotate + Two-Finger Pan
                const t1 = event.touches[0]!;
                const t2 = event.touches[1]!;
                const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

                if (touchStateRef.current.initialDistance > 0) {
                  // 1. Pinch to Zoom
                  const scaleFactor = currentDist / touchStateRef.current.initialDistance;
                  const targetZoom = clampZoom(touchStateRef.current.initialZoom * scaleFactor);

                  // 2. Two-finger continuous Rotate
                  let angleDelta = currentAngle - touchStateRef.current.initialAngle;
                  while (angleDelta > 180) angleDelta -= 360;
                  while (angleDelta < -180) angleDelta += 360;
                  const targetRotation = normalizeRotation(touchStateRef.current.initialRotation + angleDelta);

                  // 3. 2-Finger Pan offset adjustment
                  const midX = (t1.clientX + t2.clientX) / 2;
                  const midY = (t1.clientY + t2.clientY) / 2;
                  const rect = videoContainerRef.current?.getBoundingClientRect();
                  let newPanX = videoTransform.panX;
                  let newPanY = videoTransform.panY;
                  if (rect && rect.width > 0 && rect.height > 0) {
                    const dx = midX - touchStateRef.current.initialMidpoint.x;
                    const dy = midY - touchStateRef.current.initialMidpoint.y;
                    newPanX = clampPan(touchStateRef.current.startPanX + (dx / rect.width) * 100);
                    newPanY = clampPan(touchStateRef.current.startPanY + (dy / rect.height) * 100);
                  }

                  setVideoTransform((prev) => ({
                    ...prev,
                    zoom: targetZoom,
                    rotation: targetRotation,
                    panX: newPanX,
                    panY: newPanY,
                  }));
                }
              } else if (event.touches.length === 1 && isPanning && dragStartRef.current && videoContainerRef.current) {
                // 1-Finger Pan Drag
                const t = event.touches[0]!;
                const rect = videoContainerRef.current.getBoundingClientRect();
                const dx = t.clientX - dragStartRef.current.x;
                const dy = t.clientY - dragStartRef.current.y;
                const newPanX = clampPan(dragStartRef.current.startPanX + (dx / rect.width) * 100);
                const newPanY = clampPan(dragStartRef.current.startPanY + (dy / rect.height) * 100);
                setVideoTransform((prev) => ({ ...prev, panX: newPanX, panY: newPanY }));
              }
            }}
            onTouchEnd={(event) => {
              if (event.touches.length < 2) {
                touchStateRef.current.initialDistance = 0;
                touchStateRef.current.initialAngle = 0;
              }
              if (event.touches.length === 1) {
                const t = event.touches[0]!;
                dragStartRef.current = {
                  x: t.clientX,
                  y: t.clientY,
                  startPanX: videoTransform.panX,
                  startPanY: videoTransform.panY,
                };
              } else if (event.touches.length === 0) {
                setIsPanning(false);
                dragStartRef.current = null;
              }
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
              setVideoTransform(DEFAULT_TRANSFORM);
              toast("All Transforms Cleared (100% / 0°)");
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
            {/* Retro Bezel Overlay Frame Corners & Floating Clear Button */}
            <div className="pointer-events-none absolute inset-2 z-10 flex flex-col justify-between text-muted/30 font-mono text-[10px]">
              <div className="flex items-center justify-between">
                <span>⌜ VCR-REC</span>
                <div className="flex items-center gap-2">
                  {hasActiveTransform(videoTransform) ? (
                    <div className="pointer-events-auto flex items-center gap-1.5">
                      <span className="rounded-xs bg-signal/20 px-1 text-signal font-bold">
                        {Math.round(normalizeRotation(videoTransform.rotation)) !== 0
                          ? `ROT ${Math.round(normalizeRotation(videoTransform.rotation))}°`
                          : "TRANSFORM ACTIVE"}
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 font-mono text-[9px] font-bold shadow-[2px_2px_0px_rgba(0,0,0,0.8)] touch-manipulation active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoTransform(DEFAULT_TRANSFORM);
                          toast("All video transforms cleared");
                        }}
                      >
                        <RotateCcw className="size-3 mr-1" />
                        Clear Transforms
                      </Button>
                    </div>
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
                const time = el.currentTime;

                // Live Trim/Cut Playback Preview Skipping
                if (previewTrimMode && Number.isFinite(el.duration) && el.duration > 0) {
                  const s = trimStart ?? 0;
                  const e = trimEnd ?? el.duration;

                  if (trimMode === "trim") {
                    // Retain only [s, e]
                    if (time < s - 0.05) {
                      el.currentTime = s;
                      return;
                    }
                    if (time >= e) {
                      el.pause();
                      el.currentTime = s;
                      setPlaying(false);
                      toast("Trim preview reached OUT point");
                      return;
                    }
                  } else {
                    // Cut: Remove [s, e] - automatically skip ahead
                    if (time >= s && time < e) {
                      el.currentTime = e;
                      toast("Skipped cut period");
                      return;
                    }
                  }
                }

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

      {/* Retro Timeline & Scrubber with Cut/Trim Region & Capture Bookmark Pins */}
      <div className="mt-3.5 space-y-2 select-none">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-muted-foreground">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Scissors className="size-3.5 text-signal" />
            <span>Timeline Scrubber</span>
            {(trimStart !== null || trimEnd !== null) && (
              <Badge variant="outline" className={cn(
                "h-5 px-1.5 text-[10px] uppercase font-bold",
                trimMode === "trim" ? "border-success text-success" : "border-destructive text-destructive",
              )}>
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
            <span className="text-[11px]">{captures.length} Bookmark Pins</span>
          </div>
        </div>

        {/* 40px High Touch Friendly Track */}
        <div
          ref={progressRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={current}
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
            const startPct = trimStart !== null ? Math.min(100, Math.max(0, (trimStart / duration) * 100)) : 0;
            const endPct = trimEnd !== null ? Math.min(100, Math.max(0, (trimEnd / duration) * 100)) : 100;
            const left = Math.min(startPct, endPct);
            const width = Math.max(0, Math.abs(endPct - startPct));

            if (trimMode === "trim") {
              // Trim: Highlight retained region in green/signal
              return (
                <div
                  className="absolute top-0 bottom-0 bg-success/25 border-x-2 border-success pointer-events-none z-10"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            } else {
              // Cut: Highlight removed region in red hatched/danger
              return (
                <div
                  className="absolute top-0 bottom-0 bg-destructive/30 border-x-2 border-destructive pointer-events-none z-10"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.25) 4px, rgba(239, 68, 68, 0.25) 8px)",
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

          {/* Capture Timestamp Bookmark Pins */}
          {duration > 0
            ? captures.map((cap) => {
                const pinPct = Math.min(100, Math.max(0, (cap.timestampSec / duration) * 100));
                return (
                  <button
                    key={cap.id}
                    type="button"
                    title={`Captured @ ${formatTimePrecise(cap.timestampSec)} (Click to jump)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      jumpTo(cap.timestampSec);
                    }}
                    className="absolute top-1/2 -ml-1.5 size-3.5 -translate-y-1/2 rounded-full border-2 border-border bg-destructive hover:scale-150 transition-transform z-25 shadow-[1px_1px_0px_var(--color-border)]"
                    style={{ left: `${pinPct}%` }}
                  />
                );
              })
            : null}
        </div>
      </div>

      {/* Touch Jog Wheel Deck (Frame-accurate tactile scrubbing) */}
      <div className="mt-3">
        <JogDial onStepFrame={stepFrame} disabled={disabled} />
      </div>

      {/* Main Transport Deck Controls & LCD Timecode */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/70 p-3 shadow-[2px_2px_0px_var(--color-border)]">
        {/* Navigation Transport Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Hint label="Jump Start">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => jumpTo(0)}
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
          <Hint label="Previous Frame (,)">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => {
                videoRef.current?.pause();
                seekBy(-FRAME_STEP);
              }}
            >
              <SkipBack className="size-4" />
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

          <Hint label="Next Frame (.)">
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={() => {
                videoRef.current?.pause();
                seekBy(FRAME_STEP);
              }}
            >
              <SkipForward className="size-4" />
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
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                jumpTo(Math.max(0, el.duration - 0.001));
              }}
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
                  setTrimStart(current);
                  toast.success(`Marked IN @ ${formatTimePrecise(current)}`);
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
                  if (trimStart !== null && current <= trimStart) {
                    toast.error("OUT point must be after IN point");
                    return;
                  }
                  setTrimEnd(current);
                  toast.success(`Marked OUT @ ${formatTimePrecise(current)}`);
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
                  setPreviewTrimMode(!previewTrimMode);
                  toast(previewTrimMode ? "Preview Mode: OFF" : "Preview Mode: ON (Live Skipping)");
                }}
                className="h-9 px-2.5 text-[11px] font-bold touch-manipulation active:scale-95"
              >
                <Eye className="size-3.5 mr-1" />
                Preview
              </Button>
            </Hint>
          </div>
        </div>

        {/* Digital LCD Timecode Box */}
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border-2 border-border bg-theater px-3 py-1.5 text-center font-mono shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
          <span className="size-2.5 rounded-full bg-signal animate-pulse" />
          <p className="text-xs sm:text-sm font-bold tabular tracking-widest text-[#FCEEE2]">
            <span>{formatTime(current, longForm)}</span>
            <span className="text-muted-foreground mx-1.5">/</span>
            <span className="text-muted-foreground">{formatTime(duration, longForm)}</span>
          </p>
        </div>

        {/* Audio Volume & Fullscreen */}
        <div className="flex items-center gap-2">
          <Hint label={muted ? "Unmute (M)" : "Mute (M)"}>
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={toggleMute}
            >
              {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
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
            <Button
              variant="outline"
              size="sm"
              className="size-9 p-0 touch-manipulation active:scale-95"
              disabled={disabled}
              onClick={fullscreen}
            >
              <Maximize className="size-4" />
            </Button>
          </Hint>
        </div>
      </div>

      {/* Hardware WebCodecs Video Cut & Trim Deck Component (Wrapped in DeckExpander) */}
      <div className="mt-3.5">
        <TrimControls
          currentSec={current}
          durationSec={duration}
          onSeek={jumpTo}
          disabled={disabled}
        />
      </div>

      {/* Deck Transform Toolbar (Zoom, Pan, Rotate, Flip, Crop) */}
      <div className="mt-3.5">
        <DeckExpander
          id="deck-video-transform"
          title="Deck-1 // Video Framing & Transform Deck"
          subtitle="Zoom, Pan, Rotate, Mirror Flip & Aspect Ratio Calibration"
          icon={<Sliders className="size-3.5" />}
          badge={
            hasActiveTransform(videoTransform) ? (
              <Badge variant="signal" className="px-1.5 py-0 text-[8px]">
                ACTIVE TRANSFORM
              </Badge>
            ) : null
          }
          disabled={disabled}
        >
          <TransformControls
            transform={videoTransform}
            onChange={(partial) => setVideoTransform((prev) => ({ ...prev, ...partial }))}
            onReset={() => {
              setVideoTransform(DEFAULT_TRANSFORM);
              toast("Deck transforms reset");
            }}
            title="Transform & Crop Framing"
            disabled={disabled}
            bakeToggle={{
              enabled: bakeTransformOnCapture,
              onToggle: (val) => setBakeTransformOnCapture(val),
            }}
          />
        </DeckExpander>
      </div>

      {/* Capture Action Bar & Transport Deck (Snap, Burst, Speed, Jump TC) */}
      <div className="mt-3.5">
        <DeckExpander
          id="deck-video-transport"
          title="Deck-1 // Capture Actions & Timecode Transport"
          subtitle="High-speed frame capture, variable playback rates & direct jump"
          icon={<Camera className="size-3.5" />}
          disabled={disabled}
        >
          <div className="space-y-3">
            {/* Capture Action Bar (Snap, Burst, Copy) */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Button
                type="button"
                variant="success"
                size="default"
                disabled={disabled}
                onClick={() => void capture()}
                className="h-11 gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)] text-sm touch-manipulation active:scale-95"
              >
                <Camera className="size-4.5" />
                Snap Frame (S)
              </Button>

              <Button
                type="button"
                variant="accent"
                size="default"
                disabled={disabled}
                onClick={() => void burstCapture()}
                className="h-11 gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)] text-sm touch-manipulation active:scale-95"
                title="Capture 3 frames in quick succession"
              >
                <Layers className="size-4.5" />
                Burst 3× (Shift+S)
              </Button>

              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={disabled}
                onClick={() => void copyFrame()}
                className="h-11 gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)] text-sm touch-manipulation active:scale-95"
              >
                <Copy className="size-4.5" />
                Copy Still (C)
              </Button>
            </div>

            {/* Speed Selector & Direct Jump Row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between border-t border-border/50 pt-3">
              {/* Speed Selector Chips */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Deck Speed:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PLAYBACK_RATES.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={rate === r ? "signal" : "outline"}
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

            {/* Video Technical Specs Ribbon */}
            {videoSession ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>
                    <strong className="text-foreground">Size:</strong>{" "}
                    {formatFileSize(videoSession.fileSize)}
                  </span>
                  {videoDims ? (
                    <span>
                      <strong className="text-foreground">Res:</strong> {videoDims.w} × {videoDims.h}
                    </span>
                  ) : null}
                  {hasActiveTransform(videoTransform) ? (
                    <span className="text-signal font-bold">
                      ● Zoom: {Math.round(videoTransform.zoom * 100)}% | Rot:{" "}
                      {Math.round(videoTransform.rotation)}°
                      {videoTransform.cropPreset !== "none"
                        ? ` | Crop: ${videoTransform.cropPreset}`
                        : ""}
                    </span>
                  ) : null}
                </div>
                <span className="font-bold text-success uppercase">● Hardware Accelerated</span>
              </div>
            ) : null}
          </div>
        </DeckExpander>
      </div>
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
