import {
  Activity,
  BarChart3,
  Bookmark,
  Radio,
  Waves,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatTimePrecise } from "@/features/media/format";
import { cn } from "@/lib/utils";
import { useAudioStore } from "./store";
import type { PhosphorTheme } from "./types";

interface AudioWaveformProps {
  analyserNode: AnalyserNode | null;
  onSeek: (timeSec: number) => void;
  className?: string;
}

const THEME_COLORS: Record<
  PhosphorTheme,
  {
    bg: string;
    waveTop: string;
    waveBot: string;
    centerLine: string;
    playhead: string;
    grid: string;
    glow: string;
  }
> = {
  green: {
    bg: "#051108",
    waveTop: "#22c55e",
    waveBot: "#15803d",
    centerLine: "#166534",
    playhead: "#4ade80",
    grid: "#14532d33",
    glow: "rgba(34, 197, 94, 0.4)",
  },
  cyan: {
    bg: "#041318",
    waveTop: "#06b6d4",
    waveBot: "#0891b2",
    centerLine: "#155e75",
    playhead: "#67e8f9",
    grid: "#164e6333",
    glow: "rgba(6, 182, 212, 0.4)",
  },
  amber: {
    bg: "#160e03",
    waveTop: "#f59e0b",
    waveBot: "#d97706",
    centerLine: "#92400e",
    playhead: "#fcd34d",
    grid: "#78350f33",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  matrix: {
    bg: "#020d06",
    waveTop: "#10b981",
    waveBot: "#047857",
    centerLine: "#065f46",
    playhead: "#34d399",
    grid: "#064e3b33",
    glow: "rgba(16, 185, 129, 0.4)",
  },
};

export function AudioWaveform({ analyserNode, onSeek, className }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const audio = useAudioStore((s) => s.audio);
  const peaks = useAudioStore((s) => s.peaks);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const isPlaying = useAudioStore((s) => s.playing);
  const trimMode = useAudioStore((s) => s.trimMode);
  const trimStart = useAudioStore((s) => s.trimStart);
  const trimEnd = useAudioStore((s) => s.trimEnd);
  const cuePoints = useAudioStore((s) => s.cuePoints);
  const visualizerMode = useAudioStore((s) => s.visualizerMode);
  const phosphorTheme = useAudioStore((s) => s.phosphorTheme);
  const zoom = useAudioStore((s) => s.zoom);
  const panOffset = useAudioStore((s) => s.panOffset);
  const setVisualizerMode = useAudioStore((s) => s.setVisualizerMode);
  const setPhosphorTheme = useAudioStore((s) => s.setPhosphorTheme);
  const setZoom = useAudioStore((s) => s.setZoom);
  const setPanOffset = useAudioStore((s) => s.setPanOffset);
  const addCuePoint = useAudioStore((s) => s.addCuePoint);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Pre-allocated reusable buffers for analyzer modes
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Helper to convert screen X coordinate into time (seconds) taking zoom & pan into account
  const xToTime = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return 0;
      const rect = canvas.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const normalizedX = relX / rect.width;

      const visibleDuration = duration / zoom;
      const startTime = panOffset * (duration - visibleDuration);
      const targetTime = startTime + normalizedX * visibleDuration;
      return Math.max(0, Math.min(duration, targetTime));
    },
    [duration, zoom, panOffset],
  );

  // Handle Drag Scrubbing
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsScrubbing(true);
    const t = xToTime(e.clientX);
    onSeek(t);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setHoverX(e.clientX - rect.left);
    }
    const t = xToTime(e.clientX);
    setHoverTime(t);
    if (isScrubbing) {
      onSeek(t);
    }
  };

  const handlePointerUp = () => {
    setIsScrubbing(false);
  };

  const handlePointerLeave = () => {
    if (!isScrubbing) {
      setHoverTime(null);
      setHoverX(null);
    }
  };

  // Zoom & Pan with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Zoom
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      const nextZoom = Math.max(1, Math.min(16, zoom * delta));
      setZoom(nextZoom);
    } else {
      // Pan
      const deltaPan = (e.deltaX || e.deltaY) * 0.001;
      setPanOffset(panOffset + deltaPan);
    }
  };

  // Keep playhead visible when zoomed in
  useEffect(() => {
    if (zoom > 1 && duration > 0 && isPlaying) {
      const visibleDuration = duration / zoom;
      const currentStart = panOffset * (duration - visibleDuration);
      const currentEnd = currentStart + visibleDuration;

      if (currentTime > currentEnd - visibleDuration * 0.1 || currentTime < currentStart) {
        const nextStart = Math.max(0, currentTime - visibleDuration * 0.2);
        const maxStart = duration - visibleDuration;
        const nextOffset = maxStart > 0 ? nextStart / maxStart : 0;
        setPanOffset(Math.max(0, Math.min(1, nextOffset)));
      }
    }
  }, [currentTime, duration, isPlaying, zoom, panOffset, setPanOffset]);

  // Pre-render Static Background Layer (Grid, Waveform Peaks, Cue Pins, Trim Range) to Offscreen Canvas
  const updateOffscreenBackground = useCallback(() => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== mainCanvas.width || offscreen.height !== mainCanvas.height) {
      offscreen.width = mainCanvas.width;
      offscreen.height = mainCanvas.height;
    }

    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const width = offscreen.width;
    const height = offscreen.height;
    if (width <= 0 || height <= 0) return;

    const theme = THEME_COLORS[phosphorTheme];

    // 1. Background fill
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw CRT Grid Lines
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    const numGridLines = 8;
    for (let i = 1; i < numGridLines; i++) {
      const y = (height / numGridLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const numVerticalGrid = 12;
    for (let i = 0; i <= numVerticalGrid; i++) {
      const x = (width / numVerticalGrid) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Center baseline
    const centerY = height / 2;
    ctx.strokeStyle = theme.centerLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const visibleDuration = duration > 0 ? duration / zoom : 1;
    const startTime = duration > 0 ? panOffset * (duration - visibleDuration) : 0;
    const endTime = startTime + visibleDuration;

    const timeToCanvasX = (t: number) => {
      if (visibleDuration <= 0) return 0;
      return ((t - startTime) / visibleDuration) * width;
    };

    // 3. Draw Peaks Waveform with a SINGLE shared vertical gradient (Zero GC churn)
    if (peaks && peaks.buckets > 0 && (visualizerMode === "waveform" || visualizerMode === "stereo-split")) {
      const numBuckets = peaks.buckets;
      const startBucket = Math.floor((startTime / (duration || 1)) * numBuckets);
      const endBucket = Math.ceil((endTime / (duration || 1)) * numBuckets);
      const visibleBuckets = Math.max(1, endBucket - startBucket);

      const barWidth = width / visibleBuckets;
      const hasStereo = Boolean(peaks.rightMin && peaks.rightMax && visualizerMode === "stereo-split");

      if (hasStereo) {
        // Stereo Split: Top L, Bottom R
        const lHalf = height / 2;
        ctx.fillStyle = theme.waveTop;
        for (let i = 0; i < visibleBuckets; i++) {
          const bIdx = startBucket + i;
          if (bIdx < 0 || bIdx >= numBuckets) continue;
          const minVal = peaks.leftMin[bIdx] ?? 0;
          const maxVal = peaks.leftMax[bIdx] ?? 0;
          const x = i * barWidth;
          const yTop = lHalf / 2 - maxVal * (lHalf / 2) * 0.95;
          const yBot = lHalf / 2 - minVal * (lHalf / 2) * 0.95;
          ctx.fillRect(x, yTop, Math.max(1, barWidth - 0.5), Math.max(1, yBot - yTop));
        }

        ctx.fillStyle = theme.waveBot;
        for (let i = 0; i < visibleBuckets; i++) {
          const bIdx = startBucket + i;
          if (bIdx < 0 || bIdx >= numBuckets) continue;
          const rMin = peaks.rightMin![bIdx] ?? 0;
          const rMax = peaks.rightMax![bIdx] ?? 0;
          const x = i * barWidth;
          const yTopR = lHalf + lHalf / 2 - rMax * (lHalf / 2) * 0.95;
          const yBotR = lHalf + lHalf / 2 - rMin * (lHalf / 2) * 0.95;
          ctx.fillRect(x, yTopR, Math.max(1, barWidth - 0.5), Math.max(1, yBotR - yTopR));
        }
      } else {
        // Dual mirrored mono / blended waveform with single pre-allocated linear gradient
        const sharedGrad = ctx.createLinearGradient(0, 0, 0, height);
        sharedGrad.addColorStop(0, theme.waveTop);
        sharedGrad.addColorStop(0.5, theme.playhead);
        sharedGrad.addColorStop(1, theme.waveBot);
        ctx.fillStyle = sharedGrad;

        for (let i = 0; i < visibleBuckets; i++) {
          const bIdx = startBucket + i;
          if (bIdx < 0 || bIdx >= numBuckets) continue;
          const minVal = peaks.leftMin[bIdx] ?? 0;
          const maxVal = peaks.leftMax[bIdx] ?? 0;
          const x = i * barWidth;
          const yTop = centerY - maxVal * (height / 2) * 0.9;
          const yBot = centerY - minVal * (height / 2) * 0.9;
          ctx.fillRect(x, yTop, Math.max(1, barWidth - 0.5), Math.max(1, yBot - yTop));
        }
      }
    }

    // 4. Render Trim Range Shaded Overlays
    if (duration > 0 && (trimStart !== null || trimEnd !== null)) {
      const startX = trimStart !== null ? timeToCanvasX(trimStart) : 0;
      const endX = trimEnd !== null ? timeToCanvasX(trimEnd) : width;

      if (trimMode === "trim") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        if (startX > 0) {
          ctx.fillRect(0, 0, Math.max(0, startX), height);
        }
        if (endX < width) {
          ctx.fillRect(endX, 0, Math.max(0, width - endX), height);
        }

        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        if (trimStart !== null) {
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX, height);
          ctx.stroke();
        }
        if (trimEnd !== null) {
          ctx.beginPath();
          ctx.moveTo(endX, 0);
          ctx.lineTo(endX, height);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
        const cutW = Math.max(0, endX - startX);
        ctx.fillRect(startX, 0, cutW, height);

        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, height);
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, height);
        ctx.stroke();
      }
    }

    // 5. Render Cue Marker Pins
    for (const cue of cuePoints) {
      const cx = timeToCanvasX(cue.timestampSec);
      if (cx >= -10 && cx <= width + 10) {
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#eab308";
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx + 10, 0);
        ctx.lineTo(cx + 5, 8);
        ctx.lineTo(cx, 0);
        ctx.fill();
      }
    }
  }, [
    peaks,
    duration,
    trimMode,
    trimStart,
    trimEnd,
    cuePoints,
    visualizerMode,
    phosphorTheme,
    zoom,
    panOffset,
  ]);

  // Update offscreen background cache when dependencies change
  useEffect(() => {
    updateOffscreenBackground();
  }, [updateOffscreenBackground]);

  // Main Canvas Render Loop (Zero per-frame allocations & 60fps frame budgeting)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number | null = null;
    const theme = THEME_COLORS[phosphorTheme];

    let lastFrameTime = 0;
    const FRAME_BUDGET_MS = 16.6; // ~60fps max cap (prevents 120Hz ProMotion overheating)
    let isDocVisible = !document.hidden;

    const render = (now = performance.now()) => {
      const width = canvas.width;
      const height = canvas.height;
      if (width <= 0 || height <= 0) return;

      const visibleDuration = duration > 0 ? duration / zoom : 1;
      const startTime = duration > 0 ? panOffset * (duration - visibleDuration) : 0;

      const timeToCanvasX = (t: number) => {
        if (visibleDuration <= 0) return 0;
        return ((t - startTime) / visibleDuration) * width;
      };

      if (visualizerMode === "spectrum" && analyserNode && isPlaying) {
        // Spectrum mode: Real-time 64-band bars with single pre-allocated vertical gradient
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
          const y = (height / 8) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        const bufferLength = analyserNode.frequencyBinCount;
        if (!freqDataRef.current || freqDataRef.current.length !== bufferLength) {
          freqDataRef.current = new Uint8Array(new ArrayBuffer(bufferLength));
        }
        const freqData = freqDataRef.current;
        analyserNode.getByteFrequencyData(freqData);

        const numBars = 64;
        const barWidth = width / numBars - 2;
        const step = Math.floor(bufferLength / numBars);

        const spectrumGrad = ctx.createLinearGradient(0, height, 0, 0);
        spectrumGrad.addColorStop(0, theme.waveBot);
        spectrumGrad.addColorStop(0.8, theme.waveTop);
        spectrumGrad.addColorStop(1, "#fff");
        ctx.fillStyle = spectrumGrad;

        for (let i = 0; i < numBars; i++) {
          const val = freqData[i * step] ?? 0;
          const barHeight = (val / 255) * (height * 0.85);
          const x = i * (barWidth + 2);
          const y = height - barHeight;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      } else if (visualizerMode === "oscilloscope" && analyserNode && isPlaying) {
        // Scope mode: Real-time Phosphor trace
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
          const y = (height / 8) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        const bufferLength = analyserNode.frequencyBinCount;
        if (!timeDataRef.current || timeDataRef.current.length !== bufferLength) {
          timeDataRef.current = new Uint8Array(new ArrayBuffer(bufferLength));
        }
        const timeData = timeDataRef.current;
        analyserNode.getByteTimeDomainData(timeData);

        ctx.lineWidth = 2;
        ctx.strokeStyle = theme.waveTop;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = (timeData[i] ?? 128) / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
      } else {
        // Fast Cached Background Waveform Blit (<0.1ms render time!)
        if (offscreenCanvasRef.current) {
          ctx.drawImage(offscreenCanvasRef.current, 0, 0);
        } else {
          updateOffscreenBackground();
          if (offscreenCanvasRef.current) {
            ctx.drawImage(offscreenCanvasRef.current, 0, 0);
          }
        }
      }

      // Draw Playhead Cursor
      if (duration > 0) {
        const playheadX = timeToCanvasX(currentTime);
        if (playheadX >= 0 && playheadX <= width) {
          ctx.strokeStyle = theme.playhead;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(playheadX, 0);
          ctx.lineTo(playheadX, height);
          ctx.stroke();

          // Playhead top badge triangle
          ctx.fillStyle = theme.playhead;
          ctx.beginPath();
          ctx.moveTo(playheadX - 6, 0);
          ctx.lineTo(playheadX + 6, 0);
          ctx.lineTo(playheadX, 9);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Hover Guide Line
      if (hoverX !== null && hoverX >= 0 && hoverX <= width) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const loop = (now: number) => {
      if (!isDocVisible) {
        animId = requestAnimationFrame(loop);
        return;
      }

      if (now - lastFrameTime >= FRAME_BUDGET_MS) {
        lastFrameTime = now;
        render(now);
      }

      if (isPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };

    // Render static frame once
    render();

    // If active playback, start frame-budgeted rAF loop
    if (isPlaying) {
      animId = requestAnimationFrame(loop);
    }

    const handleVisibilityChange = () => {
      isDocVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    currentTime,
    duration,
    isPlaying,
    visualizerMode,
    phosphorTheme,
    zoom,
    panOffset,
    hoverX,
    analyserNode,
    updateOffscreenBackground,
  ]);

  // Sync canvas dimensions with container on resize with clamped Retina DPR (max 1.5)
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      // Clamp DPR to max 1.5 to eliminate 4x-9x Retina pixel fill-rate thermal load
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);

      if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current.width = canvas.width;
        offscreenCanvasRef.current.height = canvas.height;
      }
      updateOffscreenBackground();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateOffscreenBackground]);

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      {/* Waveform Controls Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-mono">
        {/* Visualizer Mode Switchers */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={visualizerMode === "waveform" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setVisualizerMode("waveform")}
          >
            <Waves className="size-3 mr-1" />
            Waveform
          </Button>
          <Button
            size="sm"
            variant={visualizerMode === "stereo-split" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setVisualizerMode("stereo-split")}
          >
            <Radio className="size-3 mr-1" />
            Stereo L/R
          </Button>
          <Button
            size="sm"
            variant={visualizerMode === "spectrum" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setVisualizerMode("spectrum")}
          >
            <BarChart3 className="size-3 mr-1" />
            Spectrum
          </Button>
          <Button
            size="sm"
            variant={visualizerMode === "oscilloscope" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setVisualizerMode("oscilloscope")}
          >
            <Activity className="size-3 mr-1" />
            Scope
          </Button>
        </div>

        {/* Zoom, Theme & Cue Marker Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Phosphor Theme Selector */}
          <div className="flex items-center gap-1 rounded-xs border border-border/80 bg-secondary/60 px-1 py-0.5">
            {(["green", "cyan", "amber", "matrix"] as const).map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setPhosphorTheme(th)}
                className={cn(
                  "size-3 rounded-full border border-border transition-transform",
                  th === "green" && "bg-emerald-500",
                  th === "cyan" && "bg-cyan-500",
                  th === "amber" && "bg-amber-500",
                  th === "matrix" && "bg-green-400",
                  phosphorTheme === th ? "scale-125 ring-1 ring-foreground" : "opacity-60",
                )}
                title={`Phosphor theme: ${th}`}
              />
            ))}
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-0.5 rounded-xs border border-border/80 bg-secondary/60 p-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="size-5 p-0"
              disabled={zoom <= 1}
              onClick={() => setZoom(zoom / 1.5)}
              title="Zoom out"
            >
              <ZoomOut className="size-3" />
            </Button>
            <span className="min-w-[28px] text-center text-[9px] font-bold">
              {zoom.toFixed(1)}×
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="size-5 p-0"
              disabled={zoom >= 16}
              onClick={() => setZoom(zoom * 1.5)}
              title="Zoom in"
            >
              <ZoomIn className="size-3" />
            </Button>
          </div>

          {/* Quick Marker Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => addCuePoint()}
            title="Add Cue Marker at Playhead (M)"
          >
            <Bookmark className="size-3 mr-1 text-amber-500" />
            + Cue
          </Button>
        </div>
      </div>

      {/* Main Canvas Waveform Viewport */}
      <div
        ref={containerRef}
        className="relative h-[160px] w-full select-none overflow-hidden rounded-sm border-2 border-border bg-black shadow-inner touch-none cursor-crosshair sm:h-[190px]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="h-full w-full block" />

        {/* Hover Time Tooltip */}
        {hoverTime !== null && hoverX !== null && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded border border-border bg-card/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground shadow-[2px_2px_0px_var(--color-border)] backdrop-blur-xs"
            style={{ left: `${Math.max(30, Math.min((containerRef.current?.clientWidth || 300) - 30, hoverX))}px` }}
          >
            {formatTimePrecise(hoverTime)}
          </div>
        )}

        {/* Overlay Badges for Mode / Audio Info */}
        <div className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-1.5 font-mono text-[8px] text-zinc-400">
          <span className="rounded-xs bg-black/70 px-1 py-0.2 border border-zinc-800 uppercase tracking-wider">
            {audio?.sampleRate ? `${(audio.sampleRate / 1000).toFixed(1)} kHz` : "48.0 kHz"}
          </span>
          <span className="rounded-xs bg-black/70 px-1 py-0.2 border border-zinc-800 uppercase tracking-wider">
            {audio?.numberOfChannels === 1 ? "MONO" : "STEREO"}
          </span>
          {trimStart !== null || trimEnd !== null ? (
            <span
              className={cn(
                "rounded-xs px-1 py-0.2 font-bold uppercase tracking-wider border",
                trimMode === "trim"
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                  : "bg-red-950/80 text-red-400 border-red-800",
              )}
            >
              {trimMode === "trim" ? "TRIM RANGE ACTIVE" : "CUT ZONE ACTIVE"}
            </span>
          ) : null}
        </div>

        {/* Timecode HUD bottom-right */}
        <div className="pointer-events-none absolute bottom-1.5 right-2 rounded-xs bg-black/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400 border border-zinc-800">
          {formatTimePrecise(currentTime)} / {formatTimePrecise(duration)}
        </div>
      </div>

      {/* Mini Scroller Bar when Zoomed */}
      {zoom > 1 && (
        <div className="relative h-2 w-full overflow-hidden rounded-xs bg-secondary/80 border border-border/80">
          <div
            className="absolute top-0 bottom-0 rounded-xs bg-primary"
            style={{
              left: `${panOffset * 100}%`,
              width: `${(1 / zoom) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
