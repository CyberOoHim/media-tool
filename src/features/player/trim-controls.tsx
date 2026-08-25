import {
  CheckCircle2,
  Cpu,
  Download,
  Film,
  Flame,
  HardDrive,
  HelpCircle,
  Link2,
  Monitor,
  RotateCcw,
  Scissors,
  Unlink2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { DeckExpander } from "@/components/layout/deck-expander";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import { downloadBlob } from "@/features/media/download";
import { estimateVideoExport, extractVideoSourceMetadata } from "@/features/media/estimation";
import { formatFileSize, formatTime, formatTimePrecise } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import { cn } from "@/lib/utils";
import {
  EXPORT_QUALITY_PRESETS,
  calculateExportResolution,
  type ExportProgress,
  type ExportQuality,
  type ExportResolutionPreset,
  type ExportResult,
} from "./trim-types";
import { exportVideoWebCodecs, isWebCodecsSupported } from "./webcodecs-export";

interface TrimControlsProps {
  currentSec: number;
  durationSec: number;
  onSeek: (time: number) => void;
  disabled?: boolean;
  videoDims?: { w: number; h: number } | null;
}

export function TrimControls({
  currentSec,
  durationSec,
  onSeek,
  disabled = false,
  videoDims,
}: TrimControlsProps) {
  const video = useMediaStore((s) => s.video);
  const trimMode = useMediaStore((s) => s.trimMode);
  const trimStart = useMediaStore((s) => s.trimStart);
  const trimEnd = useMediaStore((s) => s.trimEnd);
  const includeScreenshotFrame = useMediaStore((s) => s.includeScreenshotFrame);
  const exportConfig = useMediaStore((s) => s.exportConfig);

  const setTrimMode = useMediaStore((s) => s.setTrimMode);
  const setTrimStart = useMediaStore((s) => s.setTrimStart);
  const setTrimEnd = useMediaStore((s) => s.setTrimEnd);
  const setTrimRange = useMediaStore((s) => s.setTrimRange);
  const setIncludeScreenshotFrame = useMediaStore((s) => s.setIncludeScreenshotFrame);
  const setExportConfig = useMediaStore((s) => s.setExportConfig);
  const clearTrimRange = useMediaStore((s) => s.clearTrimRange);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasRange = trimStart !== null || trimEnd !== null;

  // Source video dimensions
  const sourceWidth = videoDims?.w || 1920;
  const sourceHeight = videoDims?.h || 1080;
  const sourceAspect = sourceWidth / sourceHeight;

  // Real-time computed target export resolution
  const targetResolution = calculateExportResolution(
    sourceWidth,
    sourceHeight,
    exportConfig.resolution || "original",
    exportConfig.customWidth,
    exportConfig.customHeight,
  );

  const sourcePixelCount = sourceWidth * sourceHeight;
  const targetPixelCount = targetResolution.width * targetResolution.height;
  const pixelPercentChange =
    sourcePixelCount > 0 ? Math.round(((targetPixelCount - sourcePixelCount) / sourcePixelCount) * 100) : 0;

  // Compute effective segments
  const effectiveStart = trimStart ?? 0;
  const effectiveEnd = trimEnd ?? (durationSec > 0 ? durationSec : 0);

  // Effective output duration calculation
  let outputDurationSec = 0;
  let retainedSegments: Array<{ startSec: number; endSec: number }> = [];

  if (durationSec > 0) {
    if (trimMode === "trim") {
      // Retain only selected period
      const s = Math.max(0, Math.min(durationSec, effectiveStart));
      const e = Math.max(s, Math.min(durationSec, effectiveEnd));
      outputDurationSec = Math.max(0, e - s);
      retainedSegments = [{ startSec: s, endSec: e }];
    } else {
      // Cut: Remove selected period, retain before start & after end
      const s = Math.max(0, Math.min(durationSec, effectiveStart));
      const e = Math.max(s, Math.min(durationSec, effectiveEnd));
      const seg1 = { startSec: 0, endSec: s };
      const seg2 = { startSec: e, endSec: durationSec };

      retainedSegments = [];
      if (seg1.endSec > seg1.startSec + 0.01) retainedSegments.push(seg1);
      if (seg2.endSec > seg2.startSec + 0.01) retainedSegments.push(seg2);

      outputDurationSec = retainedSegments.reduce(
        (acc, seg) => acc + (seg.endSec - seg.startSec),
        0,
      );
    }
  }

  const durationReductionPct =
    durationSec > 0
      ? Math.max(0, Math.round(((durationSec - outputDurationSec) / durationSec) * 100))
      : 0;

  // Real-time source metadata extraction and export estimation models
  const sourceMeta = extractVideoSourceMetadata({
    fileName: video?.fileName || "video.mp4",
    fileSize: video?.fileSize || 0,
    durationSec,
    width: sourceWidth,
    height: sourceHeight,
    hasAudio: true,
  });

  const videoEstimation = estimateVideoExport({
    sourceFileSize: video?.fileSize || 0,
    sourceDurationSec: durationSec,
    sourceWidth,
    sourceHeight,
    trimMode,
    trimStart,
    trimEnd,
    exportConfig,
  });

  // Mark IN / Start
  const handleMarkIn = useCallback(() => {
    setTrimStart(currentSec);
    toast.success(`Marked IN (Start) @ ${formatTimePrecise(currentSec)}`);
  }, [currentSec, setTrimStart]);

  // Mark OUT / End
  const handleMarkOut = useCallback(() => {
    if (trimStart !== null && currentSec <= trimStart) {
      toast.error("OUT point must be after IN point");
      return;
    }
    setTrimEnd(currentSec);
    toast.success(`Marked OUT (End) @ ${formatTimePrecise(currentSec)}`);
  }, [currentSec, setTrimEnd, trimStart]);

  // Start to End of Video (only start point set)
  const handleStartToVideoEnd = useCallback(() => {
    setTrimRange(currentSec, null);
    toast.success(`Range: ${formatTimePrecise(currentSec)} ➜ End of Video`);
  }, [currentSec, setTrimRange]);

  // Beginning of Video to End (only end point set)
  const handleVideoStartToEnd = useCallback(() => {
    setTrimRange(null, currentSec);
    toast.success(`Range: 00:00.000 ➜ ${formatTimePrecise(currentSec)}`);
  }, [currentSec, setTrimRange]);

  // Cancel export
  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExporting(false);
      setExportProgress(null);
      toast("Export cancelled");
    }
  };

  // Run WebCodecs Export
  const handleRunExport = async () => {
    if (!video) {
      toast.error("No video loaded");
      return;
    }
    if (retainedSegments.length === 0 || outputDurationSec <= 0.01) {
      toast.error("Invalid export range. Please adjust Start/End points.");
      return;
    }

    if (!isWebCodecsSupported()) {
      toast.error(
        "Hardware WebCodecs is not supported in this browser. Please use Chrome, Edge, or Safari.",
      );
      return;
    }

    setIsExporting(true);
    setExportResult(null);
    abortControllerRef.current = new AbortController();

    try {
      const activeBitrateMbps =
        exportConfig.quality === "original"
          ? (sourceMeta.sourceBitrateBps > 0
              ? Number((sourceMeta.sourceBitrateBps / 1_000_000).toFixed(2))
              : exportConfig.bitrateMbps || 14)
          : exportConfig.bitrateMbps;

      const result = await exportVideoWebCodecs({
        sourceUrl: video.objectUrl,
        fileName: video.fileName,
        segments: retainedSegments,
        config: {
          ...exportConfig,
          bitrateMbps: activeBitrateMbps,
        },
        onProgress: (prog) => {
          setExportProgress(prog);
        },
        signal: abortControllerRef.current.signal,
      });

      setExportResult(result);
      setIsExporting(false);
      toast.success(
        `Export complete! ${result.width}×${result.height} (${result.speedMultiplier}× hardware speed)`,
      );
    } catch (err) {
      setIsExporting(false);
      if (err instanceof Error && err.message.includes("cancelled")) {
        // User aborted
      } else {
        toast.error(err instanceof Error ? err.message : "WebCodecs export failed");
      }
    }
  };

  return (
    <div className="space-y-3.5">
      {/* DECK 1: VIDEO CUT & TRIM MARKERS */}
      <DeckExpander
        id="deck-video-cut-trim"
        title="Deck-1 // Video Cut & Trim Deck"
        subtitle="Frame-accurate In/Out markers, active duration & cut segment selector"
        icon={<Scissors className="size-3.5" />}
        badge={
          hasRange ? (
            <Badge variant="signal" className="px-1.5 py-0 text-[8px]">
              ACTIVE RANGE
            </Badge>
          ) : null
        }
        action={
          <div className="flex items-center rounded-[var(--radius-sm)] border border-border bg-secondary p-0.5 shadow-[1px_1px_0px_var(--color-border)]">
            <Button
              type="button"
              size="sm"
              variant={trimMode === "trim" ? "primary" : "ghost"}
              disabled={disabled}
              onClick={() => setTrimMode("trim")}
              className={cn(
                "h-5.5 px-2 text-[9px] font-bold uppercase tracking-wider",
                trimMode === "trim" && "shadow-[1px_1px_0px_var(--color-border)]",
              )}
            >
              <Film className="size-2.5 mr-1" />
              Trim
            </Button>

            <Button
              type="button"
              size="sm"
              variant={trimMode === "cut" ? "destructive" : "ghost"}
              disabled={disabled}
              onClick={() => setTrimMode("cut")}
              className={cn(
                "h-5.5 px-2 text-[9px] font-bold uppercase tracking-wider",
                trimMode === "cut" && "shadow-[1px_1px_0px_var(--color-border)] text-white",
              )}
            >
              <Scissors className="size-2.5 mr-1" />
              Cut
            </Button>
          </div>
        }
        disabled={disabled}
      >
        {/* Source Video Metadata Inspector Ribbon */}
        <div className="rounded-[var(--radius-sm)] border-2 border-border bg-card p-2.5 font-mono text-[11px] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <span className="rounded-xs bg-primary px-1.5 py-0.2 text-[9px] font-bold text-primary-foreground uppercase">
                Source Specs
              </span>
              <span>{sourceMeta.containerLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-[10px]">
              <span className="flex items-center gap-1">
                <Monitor className="size-3 text-signal" />
                <strong className="text-foreground">{sourceWidth} × {sourceHeight}</strong>
                <span>({sourceMeta.aspectRatioLabel})</span>
              </span>
              <span>•</span>
              <span>
                Bitrate: <strong className="text-foreground">~{sourceMeta.sourceBitrateFormatted}</strong>
              </span>
              <span>•</span>
              <span>
                Size: <strong className="text-foreground">{formatFileSize(video?.fileSize || 0)}</strong>
              </span>
              <span>•</span>
              <span>
                Total: <strong className="text-foreground">{formatTimePrecise(durationSec, true)}</strong>
              </span>
            </div>
          </div>

          {/* Retained Duration & Segment Summary Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xs border border-border/80 bg-secondary/50 px-2 py-1 text-[10px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Scissors className="size-2.5 text-signal" />
              <span>Operation:</span>
              <strong className="text-foreground uppercase">{trimMode} Mode</strong>
              <span>[{formatTimePrecise(effectiveStart)} ➜ {formatTimePrecise(effectiveEnd)}]</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span>Retained:</span>
              <strong className="text-foreground font-bold">{formatTimePrecise(outputDurationSec)}</strong>
              <span
                className={cn(
                  "rounded-xs px-1 py-0.2 font-bold",
                  durationReductionPct > 0
                    ? "border border-success/30 bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {durationReductionPct > 0 ? `-${durationReductionPct}% Duration` : "100% Retained"}
              </span>
            </div>
          </div>
        </div>

        {/* Range Definition & Transport Points */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* IN Point (Start) Box */}
          <div
            className={cn(
              "rounded-[var(--radius-sm)] border-2 p-3 transition-all",
              trimStart !== null
                ? "border-signal bg-signal/5 shadow-[2px_2px_0px_var(--color-signal)]"
                : "border-border bg-secondary/30",
            )}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="rounded-xs bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground font-bold">
                  [ IN
                </span>
                Start Point
              </span>
              {trimStart !== null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive touch-manipulation"
                  onClick={() => setTrimStart(null)}
                >
                  <X className="size-3 mr-1" /> Clear
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">00:00.000 (Start of Video)</span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="font-mono text-base font-bold tracking-widest text-foreground">
                {trimStart !== null ? formatTimePrecise(trimStart) : "00:00.000"}
              </div>
              <div className="flex items-center gap-1.5">
                {trimStart !== null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs touch-manipulation active:scale-95"
                    onClick={() => onSeek(trimStart)}
                    title="Jump playhead to IN point"
                  >
                    Jump
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={disabled}
                  onClick={handleMarkIn}
                  className="h-8 px-3 text-xs font-bold touch-manipulation active:scale-95"
                >
                  Mark IN (Current)
                </Button>
              </div>
            </div>
          </div>

          {/* OUT Point (End) Box */}
          <div
            className={cn(
              "rounded-[var(--radius-sm)] border-2 p-3 transition-all",
              trimEnd !== null
                ? "border-destructive bg-destructive/5 shadow-[2px_2px_0px_var(--color-destructive)]"
                : "border-border bg-secondary/30",
            )}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="rounded-xs bg-destructive px-1.5 py-0.5 font-mono text-[10px] text-white font-bold">
                  OUT ]
                </span>
                End Point
              </span>
              {trimEnd !== null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive touch-manipulation"
                  onClick={() => setTrimEnd(null)}
                >
                  <X className="size-3 mr-1" /> Clear
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {durationSec > 0 ? formatTimePrecise(durationSec) : "--:--"} (End of Video)
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="font-mono text-base font-bold tracking-widest text-foreground">
                {trimEnd !== null
                  ? formatTimePrecise(trimEnd)
                  : durationSec > 0
                    ? formatTimePrecise(durationSec)
                    : "--:--.---"}
              </div>
              <div className="flex items-center gap-1.5">
                {trimEnd !== null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs touch-manipulation active:scale-95"
                    onClick={() => onSeek(trimEnd)}
                    title="Jump playhead to OUT point"
                  >
                    Jump
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={disabled}
                  onClick={handleMarkOut}
                  className="h-8 px-3 text-xs font-bold touch-manipulation active:scale-95"
                >
                  Mark OUT (Current)
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Period Presets & Inclusion Checkbox */}
        <div className="flex flex-col gap-2.5 rounded-[var(--radius-sm)] border border-border bg-secondary/40 p-2.5 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick Period Shortcuts:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={handleStartToVideoEnd}
                className="h-6 px-2 text-[10px]"
                title="Set Start at current time and extend to the end of the video"
              >
                Start ➜ End of Video
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={handleVideoStartToEnd}
                className="h-6 px-2 text-[10px]"
                title="Set from start of the video to current time as End"
              >
                Video Start ➜ End
              </Button>
              {hasRange ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearTrimRange}
                  className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive hover:text-white"
                >
                  <RotateCcw className="size-2.5 mr-1" /> Reset Points
                </Button>
              ) : null}
            </div>
          </div>

          {/* Screenshot Frame Inclusion Checkbox */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-screenshot-frame-chk"
                checked={includeScreenshotFrame}
                onCheckedChange={(checked) => setIncludeScreenshotFrame(Boolean(checked))}
              />
              <label
                htmlFor="include-screenshot-frame-chk"
                className="cursor-pointer text-[11px] font-semibold text-foreground select-none flex items-center gap-1.5"
              >
                <span>Include screenshot frame in selected period</span>
                <Hint label="When unchecked (default), marking from a screenshot excludes the exact screenshot frame timestamp. When checked, the screenshot frame itself is included in the period.">
                  <HelpCircle className="size-3 text-muted-foreground" />
                </Hint>
              </label>
            </div>
            <span className="font-mono text-[9px] font-bold text-muted-foreground uppercase">
              Default: Not Included
            </span>
          </div>
        </div>

        {/* Real-Time Outcome Summary Ribbon */}
        <div className="rounded-[var(--radius-sm)] border-2 border-border bg-theater p-2.5 font-mono text-xs text-[#fceee2] shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  trimMode === "trim" ? "bg-signal animate-pulse" : "bg-destructive animate-pulse",
                )}
              />
              <span className="font-bold uppercase tracking-wider text-signal">
                {trimMode === "trim" ? "Trim Outcome (Retain)" : "Cut Outcome (Remove)"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span>
                Source: <strong className="text-white">{formatTime(durationSec, true)}</strong>
              </span>
              <span>➜</span>
              <span>
                Output:{" "}
                <strong className="text-signal font-bold">
                  {formatTime(outputDurationSec, true)}
                </strong>
              </span>
              {durationReductionPct > 0 ? (
                <span className="rounded-xs bg-signal/20 px-1 py-0.2 font-bold text-signal">
                  -{durationReductionPct}%
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div>
              {trimMode === "trim" ? (
                <span>
                  Retaining:{" "}
                  <strong className="text-white">
                    {formatTimePrecise(effectiveStart)} ➜ {formatTimePrecise(effectiveEnd)}
                  </strong>
                </span>
              ) : (
                <span>
                  Removing:{" "}
                  <strong className="text-destructive">
                    {formatTimePrecise(effectiveStart)} ➜ {formatTimePrecise(effectiveEnd)}
                  </strong>{" "}
                  (keeping before & after)
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#fceee2]/70 font-semibold">
              {retainedSegments.length} Segment{retainedSegments.length > 1 ? "s" : ""} to encode
            </span>
          </div>
        </div>
      </DeckExpander>

      {/* DECK 2: HARDWARE WEBCODECS EXPORT DECK */}
      <DeckExpander
        id="deck-webcodecs-export"
        title="Deck-1 // Hardware WebCodecs Export Deck"
        subtitle="Resolution selector, hardware WebCodecs encoder, bitrate profile & container export"
        icon={<Cpu className="size-3.5 text-signal" />}
        badge={
          exportResult ? (
            <Badge variant="signal" className="px-1.5 py-0 text-[8px] font-mono">
              EXPORT READY
            </Badge>
          ) : isExporting ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[8px] animate-pulse">
              ENCODING...
            </Badge>
          ) : (
            <div className="flex items-center gap-1">
              <span className="rounded-xs bg-success/20 px-1 py-0.2 font-mono text-[8px] font-bold text-success border border-success/30 uppercase">
                {targetResolution.width} × {targetResolution.height}
              </span>
            </div>
          )
        }
        disabled={disabled}
      >
        <div className="space-y-2.5">
          {/* Resolution, Quality Preset & Codec Controls */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Output Resolution Selector */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] flex items-center gap-1">
                  <Monitor className="size-3 text-signal" /> Output Resolution
                </Label>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {targetResolution.width}×{targetResolution.height}
                </span>
              </div>
              <Select
                value={exportConfig.resolution || "original"}
                onValueChange={(v: ExportResolutionPreset) => {
                  setExportConfig({ resolution: v });
                }}
                disabled={disabled || isExporting}
              >
                <SelectTrigger className="h-7 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original" className="text-xs font-mono font-bold text-foreground">
                    Original Dimension ({sourceWidth} × {sourceHeight})
                  </SelectItem>
                  <SelectItem value="4k" className="text-xs font-mono">
                    4K UHD (2160p)
                  </SelectItem>
                  <SelectItem value="1440p" className="text-xs font-mono">
                    1440p QHD (2K)
                  </SelectItem>
                  <SelectItem value="1080p" className="text-xs font-mono">
                    1080p FHD (Full HD)
                  </SelectItem>
                  <SelectItem value="720p" className="text-xs font-mono">
                    720p HD
                  </SelectItem>
                  <SelectItem value="480p" className="text-xs font-mono">
                    480p SD
                  </SelectItem>
                  <SelectItem value="360p" className="text-xs font-mono">
                    360p Low
                  </SelectItem>
                  <SelectItem value="scale-75" className="text-xs font-mono">
                    75% Scale
                  </SelectItem>
                  <SelectItem value="scale-50" className="text-xs font-mono">
                    50% Half Size
                  </SelectItem>
                  <SelectItem value="scale-25" className="text-xs font-mono">
                    25% Quarter Size
                  </SelectItem>
                  <SelectItem value="custom" className="text-xs font-mono font-bold text-signal">
                    Custom W × H...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quality Profile */}
            <div className="space-y-1">
              <Label className="text-[10px]">Quality & Bitrate</Label>
              <Select
                value={exportConfig.quality}
                onValueChange={(v: ExportQuality) => {
                  const preset = EXPORT_QUALITY_PRESETS[v];
                  if (v === "original") {
                    const srcMbps =
                      sourceMeta.sourceBitrateBps > 0
                        ? Number((sourceMeta.sourceBitrateBps / 1_000_000).toFixed(2))
                        : 14;
                    setExportConfig({
                      quality: v,
                      bitrateMbps: srcMbps,
                    });
                  } else if (v === "custom") {
                    setExportConfig({
                      quality: v,
                      bitrateMbps: Math.max(0.2, exportConfig.bitrateMbps || 8),
                    });
                  } else {
                    setExportConfig({
                      quality: v,
                      bitrateMbps: preset.bitrateMbps,
                    });
                  }
                }}
                disabled={disabled || isExporting}
              >
                <SelectTrigger className="h-7 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXPORT_QUALITY_PRESETS) as ExportQuality[]).map((key) => (
                    <SelectItem key={key} value={key} className="text-xs font-mono">
                      {EXPORT_QUALITY_PRESETS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Container Format */}
            <div className="space-y-1">
              <Label className="text-[10px]">Container Format</Label>
              <Select
                value={exportConfig.format}
                onValueChange={(v: "mp4") => setExportConfig({ format: v })}
                disabled={disabled || isExporting}
              >
                <SelectTrigger className="h-7 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4" className="text-xs font-mono">
                    MP4 (AVC/H.264 + AAC)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Synced Audio Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] flex items-center gap-1">
                  {exportConfig.keepAudio ? (
                    <Volume2 className="size-3 text-success" />
                  ) : (
                    <VolumeX className="size-3 text-destructive" />
                  )}
                  Export Audio
                </Label>
                <span
                  className={cn(
                    "rounded-xs px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase",
                    exportConfig.keepAudio
                      ? "border border-success/40 bg-success/15 text-success"
                      : "border border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {exportConfig.keepAudio ? "SOUND ON" : "SOUND OFF"}
                </span>
              </div>
              <Button
                type="button"
                variant={exportConfig.keepAudio ? "outline" : "secondary"}
                size="sm"
                disabled={disabled || isExporting}
                onClick={() => setExportConfig({ keepAudio: !exportConfig.keepAudio })}
                className={cn(
                  "h-7 w-full justify-between px-2 text-[11px] font-mono transition-all",
                  exportConfig.keepAudio
                    ? "border-success/60 bg-success/10 text-foreground hover:bg-success/20 shadow-[1px_1px_0px_var(--color-success)]"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                title={
                  exportConfig.keepAudio
                    ? "Audio track will be synchronized and included in the exported video"
                    : "Export will be silent / muted with no audio track"
                }
              >
                <span className="flex items-center gap-1.5 font-bold">
                  {exportConfig.keepAudio ? (
                    <Volume2 className="size-3.5 text-success animate-pulse" />
                  ) : (
                    <VolumeX className="size-3.5 text-destructive" />
                  )}
                  {exportConfig.keepAudio ? "Include Sound Track" : "Mute (No Sound Track)"}
                </span>
                <span className="text-[9px] font-mono font-bold uppercase">
                  {exportConfig.keepAudio ? "🔊 ON" : "🔇 OFF"}
                </span>
              </Button>
            </div>
          </div>

          {/* Custom Resolution Dimension Inputs if Custom is selected */}
          {exportConfig.resolution === "custom" ? (
            <div className="space-y-2 rounded-[var(--radius-sm)] border border-border bg-card p-2.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-foreground flex items-center gap-1">
                  <Monitor className="size-3 text-signal" /> Custom Output Resolution (Even Dimensions)
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Aspect: <strong>{(targetResolution.width / targetResolution.height).toFixed(2)}:1</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Width */}
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">W:</Label>
                  <Input
                    type="number"
                    min={64}
                    max={7680}
                    step={2}
                    value={exportConfig.customWidth ?? targetResolution.width}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (Number.isNaN(val) || val <= 0) return;
                      const evenW = Math.max(2, Math.floor(val / 2) * 2);
                      const isLocked = exportConfig.lockAspectRatio !== false;
                      if (isLocked) {
                        const evenH = Math.max(2, Math.floor(Math.round(evenW / sourceAspect) / 2) * 2);
                        setExportConfig({ customWidth: evenW, customHeight: evenH });
                      } else {
                        setExportConfig({ customWidth: evenW });
                      }
                    }}
                    className="h-7 w-20 px-1.5 text-center font-mono text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground">px</span>
                </div>

                {/* Aspect Ratio Lock Toggle */}
                <Button
                  type="button"
                  variant={exportConfig.lockAspectRatio !== false ? "signal" : "outline"}
                  size="sm"
                  onClick={() =>
                    setExportConfig({ lockAspectRatio: exportConfig.lockAspectRatio === false })
                  }
                  className="h-7 px-2 text-[10px]"
                  title={
                    exportConfig.lockAspectRatio !== false
                      ? "Aspect ratio locked to source video"
                      : "Aspect ratio unlocked"
                  }
                >
                  {exportConfig.lockAspectRatio !== false ? (
                    <span className="flex items-center gap-1">
                      <Link2 className="size-3" /> Locked Ratio
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Unlink2 className="size-3" /> Free Ratio
                    </span>
                  )}
                </Button>

                {/* Height */}
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">H:</Label>
                  <Input
                    type="number"
                    min={64}
                    max={4320}
                    step={2}
                    value={exportConfig.customHeight ?? targetResolution.height}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (Number.isNaN(val) || val <= 0) return;
                      const evenH = Math.max(2, Math.floor(val / 2) * 2);
                      const isLocked = exportConfig.lockAspectRatio !== false;
                      if (isLocked) {
                        const evenW = Math.max(2, Math.floor(Math.round(evenH * sourceAspect) / 2) * 2);
                        setExportConfig({ customWidth: evenW, customHeight: evenH });
                      } else {
                        setExportConfig({ customHeight: evenH });
                      }
                    }}
                    className="h-7 w-20 px-1.5 text-center font-mono text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground">px</span>
                </div>

                {/* Quick Aspect Presets */}
                <div className="flex flex-wrap items-center gap-1 ml-auto">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Presets:</span>
                  {[
                    { label: "1080p", w: 1920, h: 1080 },
                    { label: "720p", w: 1280, h: 720 },
                    { label: "Vertical 9:16", w: 1080, h: 1920 },
                    { label: "Square 1:1", w: 1080, h: 1080 },
                  ].map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExportConfig({ customWidth: p.w, customHeight: p.h })}
                      className="h-6 px-1.5 text-[9px]"
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Custom Bitrate Slider if selected */}
          {exportConfig.quality === "custom" ? (
            <div className="space-y-1.5 rounded-[var(--radius-sm)] border border-border bg-card p-2.5 font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-foreground">Custom Video Bitrate:</span>
                <strong className="text-signal text-xs">
                  {exportConfig.bitrateMbps < 1
                    ? `${Math.round(exportConfig.bitrateMbps * 1000)} kbps`
                    : `${exportConfig.bitrateMbps.toFixed(1)} Mbps`}
                </strong>
              </div>
              <Slider
                min={0.2}
                max={30}
                step={0.1}
                value={[exportConfig.bitrateMbps]}
                onValueChange={([val]) =>
                  setExportConfig({
                    bitrateMbps: Math.max(0.2, Number((val ?? 8).toFixed(1))),
                  })
                }
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>200 kbps (Min)</span>
                <span>5 Mbps</span>
                <span>15 Mbps</span>
                <span>30 Mbps (Max)</span>
              </div>
            </div>
          ) : null}

          {/* Real-Time Live Target Size Estimator & Specifications Deck */}
          <div className="space-y-2.5 rounded-[var(--radius-sm)] border-2 border-border bg-card p-3 font-mono text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Cpu className="size-3.5 text-signal" />
                <span className="uppercase tracking-wide">Live Target Size Estimator</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Est. Output Size:</span>
                <span className="rounded-xs border border-signal bg-signal/15 px-2 py-0.5 text-xs font-bold text-foreground shadow-[1px_1px_0px_var(--color-signal)]">
                  ~{videoEstimation.estimatedTotalFormatted}
                </span>
                <span
                  className={cn(
                    "rounded-xs px-1.5 py-0.2 text-[10px] font-bold border",
                    videoEstimation.savingsPct >= 0
                      ? "border-success/30 bg-success/15 text-success"
                      : "border-destructive/30 bg-destructive/15 text-destructive",
                  )}
                >
                  {videoEstimation.savingsPct >= 0
                    ? `-${videoEstimation.savingsPct}% vs source`
                    : `+${Math.abs(videoEstimation.savingsPct)}% vs source`}
                </span>
              </div>
            </div>

            {/* Proposed UI Layout Format: Specs & Real-Time Estimate Line */}
            <div className="space-y-1.5 rounded-xs border border-border/70 bg-secondary/40 p-2 text-[10px]">
              <div className="flex flex-wrap items-center justify-between gap-1 text-muted-foreground">
                <span className="flex items-center gap-1 text-foreground">
                  <Monitor className="size-3 text-signal" />
                  <span>⚙️ Export Specs:</span>
                  <strong>{targetResolution.width}×{targetResolution.height} px</strong>
                  <span>({exportConfig.resolution === "original" ? "100%" : pixelPercentChange > 0 ? `+${pixelPercentChange}%` : `${pixelPercentChange}%`})</span>
                </span>
                <span>
                  Bitrate:{" "}
                  <strong className="text-foreground">
                    {exportConfig.quality === "original"
                      ? `${videoEstimation.targetVideoBitrateFormatted} (Source Match)`
                      : exportConfig.bitrateMbps < 1
                        ? `${Math.round(exportConfig.bitrateMbps * 1000)} kbps`
                        : `${exportConfig.bitrateMbps.toFixed(1)} Mbps`}
                  </strong>{" "}
                  · MP4 (AVC) · Sound Track:{" "}
                  <strong
                    className={cn(
                      "font-bold",
                      exportConfig.keepAudio ? "text-success" : "text-destructive",
                    )}
                  >
                    {exportConfig.keepAudio
                      ? "🔊 ON (192 kbps AAC)"
                      : "🔇 OFF (Muted)"}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-border/40 font-bold">
                <span className="text-foreground">
                  📊 REAL-TIME ESTIMATE: <span className="text-signal">~{videoEstimation.estimatedTotalFormatted}</span> ({videoEstimation.savingsPct >= 0 ? `-${videoEstimation.savingsPct}% vs source` : `+${Math.abs(videoEstimation.savingsPct)}% vs source`})
                </span>
                <span className="text-muted-foreground text-[9.5px]">
                  Est. Bitrate: <strong className="text-foreground">{videoEstimation.targetTotalBitrateFormatted} Total</strong>
                </span>
              </div>
            </div>

            {/* Target Bitrate & Payload Allocation Split */}
            <div className="space-y-1 rounded-xs border border-border/40 bg-secondary/20 p-2 text-[10px]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Bitrate Payload Allocation:</span>
                <span className="text-foreground">
                  Video: {formatFileSize(videoEstimation.videoPayloadBytes)} ({videoEstimation.videoPayloadRatioPct}%) · Audio: {formatFileSize(videoEstimation.audioPayloadBytes)} ({videoEstimation.audioPayloadRatioPct}%) · Overhead: ~{formatFileSize(videoEstimation.containerOverheadBytes)}
                </span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary border border-border">
                <div
                  className="bg-signal transition-all"
                  style={{ width: `${Math.max(5, videoEstimation.videoPayloadRatioPct)}%` }}
                  title={`Video Payload: ${formatFileSize(videoEstimation.videoPayloadBytes)}`}
                />
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${Math.max(2, videoEstimation.audioPayloadRatioPct)}%` }}
                  title={`Audio Payload: ${formatFileSize(videoEstimation.audioPayloadBytes)}`}
                />
              </div>
            </div>

            {/* Storage Savings Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <HardDrive className="size-3 text-signal" />
                <span>Storage Savings:</span>
                <strong
                  className={
                    videoEstimation.savingsBytes >= 0
                      ? "text-success font-bold"
                      : "text-destructive font-bold"
                  }
                >
                  {videoEstimation.savingsBytes >= 0
                    ? `Save ~${formatFileSize(videoEstimation.savingsBytes)} (${videoEstimation.savingsPct}% reduction)`
                    : `+${formatFileSize(Math.abs(videoEstimation.savingsBytes))} larger due to bitrate increase`}
                </strong>
              </span>
              <span className="text-muted-foreground">
                Retained: <strong className="text-foreground">{formatTimePrecise(outputDurationSec)}</strong> ({durationReductionPct > 0 ? `-${durationReductionPct}% duration` : "full length"})
              </span>
            </div>
          </div>

          {/* Hardware WebCodecs Export Execution Button */}
          <div className="pt-1">
            <Button
              type="button"
              variant="signal"
              size="lg"
              disabled={disabled || isExporting || !video || outputDurationSec <= 0.01}
              onClick={() => void handleRunExport()}
              className="w-full gap-2 font-bold shadow-[3px_3px_0px_var(--color-border)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Zap className="size-4" />
              {isExporting ? (
                "Hardware WebCodecs Exporting..."
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span>
                    Export {trimMode === "trim" ? "Trimmed" : "Cut"} Video (
                    {targetResolution.width}×{targetResolution.height} · {formatTime(outputDurationSec)})
                  </span>
                  <span
                    className={cn(
                      "rounded-xs px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase",
                      exportConfig.keepAudio
                        ? "bg-black/80 text-success border border-success/40"
                        : "bg-black/80 text-muted-foreground border border-border",
                    )}
                  >
                    {exportConfig.keepAudio ? "🔊 Sound ON" : "🔇 Sound OFF"}
                  </span>
                </div>
              )}
            </Button>
          </div>

          {/* Active Export Progress Panel */}
          {isExporting && exportProgress ? (
            <div className="rounded-[var(--radius-sm)] border-2 border-signal bg-theater p-3 font-mono text-xs text-[#fceee2] shadow-inner space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-signal font-bold">
                  <Flame className="size-3.5 animate-bounce" />
                  {exportProgress.message || "Hardware Encoding..."}
                </span>
                <span className="font-bold text-white text-sm">{exportProgress.percent}%</span>
              </div>

              <Progress value={exportProgress.percent} className="h-2" />

              <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>
                  Speed: <strong className="text-signal font-bold">{exportProgress.speedMultiplier}×</strong> ({exportProgress.fps} fps)
                </span>
                <span>
                  Frames: <strong className="text-white">{exportProgress.currentFrame}</strong> / {exportProgress.totalFrames}
                </span>
                <span>
                  Sound:{" "}
                  <strong className={exportConfig.keepAudio ? "text-success font-bold" : "text-muted-foreground font-bold"}>
                    {exportConfig.keepAudio ? "🔊 ON (Synced Track)" : "🔇 OFF (Muted)"}
                  </strong>
                </span>
                <span>
                  Elapsed: <strong className="text-white">{exportProgress.elapsedSec}s</strong>
                  {exportProgress.estimatedRemainingSec > 0 ? ` (ETA: ${exportProgress.estimatedRemainingSec}s)` : ""}
                </span>
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelExport}
                  className="h-6 px-2 text-[10px]"
                >
                  Cancel Export
                </Button>
              </div>
            </div>
          ) : null}

          {/* Export Result & Download Card */}
          {exportResult ? (
            <div className="rounded-[var(--radius-sm)] border-2 border-success bg-success/10 p-3 font-mono text-xs text-foreground shadow-[2px_2px_0px_var(--color-border)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-success">
                  <CheckCircle2 className="size-4" />
                  <span>Export Succeeded (Hardware WebCodecs)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold font-mono text-[9px] uppercase",
                      exportResult.hasAudio
                        ? "border-success bg-success/20 text-success"
                        : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {exportResult.hasAudio ? (
                      <span className="flex items-center gap-1">
                        <Volume2 className="size-3" /> Sound ON ({exportResult.audioCodec || "Stereo"})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <VolumeX className="size-3" /> Sound OFF (Muted)
                      </span>
                    )}
                  </Badge>
                  <Badge variant="outline" className="border-success text-success">
                    {exportResult.speedMultiplier}× Speed
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border/50 pt-1.5">
                <span>
                  File: <strong className="text-foreground">{exportResult.fileName}</strong>
                </span>
                <span>
                  Resolution: <strong className="text-foreground">{exportResult.width} × {exportResult.height} px</strong>
                </span>
                <span>
                  Sound:{" "}
                  <strong className={exportResult.hasAudio ? "text-success font-bold" : "text-muted-foreground font-bold"}>
                    {exportResult.hasAudio ? `🔊 Included (${exportResult.audioCodec || "Audio Track"})` : "🔇 Muted / No Audio"}
                  </strong>
                </span>
                <span>
                  Size: <strong className="text-foreground">{formatFileSize(exportResult.fileSize)}</strong>
                </span>
                <span>
                  Duration: <strong className="text-foreground">{formatTime(exportResult.durationSec, true)}</strong>
                </span>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <Button
                  type="button"
                  variant="success"
                  size="default"
                  onClick={() => void downloadBlob(exportResult.blob, exportResult.fileName)}
                  className="flex-1 gap-2 font-bold shadow-[2px_2px_0px_var(--color-border)]"
                >
                  <Download className="size-4" />
                  Download Exported Video ({exportResult.width}×{exportResult.height} · {formatFileSize(exportResult.fileSize)})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setExportResult(null)}
                  className="px-2"
                  title="Dismiss result"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DeckExpander>
    </div>
  );
}
