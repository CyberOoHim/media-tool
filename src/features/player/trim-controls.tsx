import {
  CheckCircle2,
  Cpu,
  Download,
  Film,
  Flame,
  HelpCircle,
  RotateCcw,
  Scissors,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatFileSize, formatTime, formatTimePrecise } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import { cn } from "@/lib/utils";
import {
  EXPORT_QUALITY_PRESETS,
  type ExportProgress,
  type ExportQuality,
  type ExportResult,
} from "./trim-types";
import { exportVideoWebCodecs, isWebCodecsSupported } from "./webcodecs-export";

interface TrimControlsProps {
  currentSec: number;
  durationSec: number;
  onSeek: (time: number) => void;
  disabled?: boolean;
}

export function TrimControls({
  currentSec,
  durationSec,
  onSeek,
  disabled = false,
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
      const result = await exportVideoWebCodecs({
        sourceUrl: video.objectUrl,
        fileName: video.fileName,
        segments: retainedSegments,
        config: exportConfig,
        onProgress: (prog) => {
          setExportProgress(prog);
        },
        signal: abortControllerRef.current.signal,
      });

      setExportResult(result);
      setIsExporting(false);
      toast.success(`Export complete! (${result.speedMultiplier}× hardware speed)`);
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
    <div className="space-y-3.5 rounded-[var(--radius-sm)] border-2 border-border bg-card p-3 shadow-[2px_2px_0px_var(--color-border)]">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-[var(--radius-sm)] border-2 border-border bg-signal text-foreground shadow-[1px_1px_0px_var(--color-border)]">
            <Scissors className="size-3.5" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Video Cut & Trim Deck
            </h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Frame-accurate cutting · Hardware WebCodecs export
            </p>
          </div>
        </div>

        {/* Operation Mode Tabs: Trim vs Cut */}
        <div className="flex items-center rounded-[var(--radius-sm)] border-2 border-border bg-secondary p-0.5 shadow-[1px_1px_0px_var(--color-border)]">
          <Button
            type="button"
            size="sm"
            variant={trimMode === "trim" ? "primary" : "ghost"}
            disabled={disabled}
            onClick={() => setTrimMode("trim")}
            className={cn(
              "h-6.5 px-2.5 text-[10px] font-bold uppercase tracking-wider",
              trimMode === "trim" && "shadow-[1px_1px_0px_var(--color-border)]",
            )}
          >
            <Film className="size-3 mr-1" />
            Trim (Retain)
          </Button>

          <Button
            type="button"
            size="sm"
            variant={trimMode === "cut" ? "destructive" : "ghost"}
            disabled={disabled}
            onClick={() => setTrimMode("cut")}
            className={cn(
              "h-6.5 px-2.5 text-[10px] font-bold uppercase tracking-wider",
              trimMode === "cut" && "shadow-[1px_1px_0px_var(--color-border)] text-white",
            )}
          >
            <Scissors className="size-3 mr-1" />
            Cut (Remove)
          </Button>
        </div>
      </div>

      {/* Range Definition & Transport Points */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* IN Point (Start) Box */}
        <div
          className={cn(
            "rounded-[var(--radius-sm)] border-2 p-2.5 transition-all",
            trimStart !== null
              ? "border-signal bg-signal/5 shadow-[2px_2px_0px_var(--color-signal)]"
              : "border-border bg-secondary/30",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1 font-bold text-foreground">
              <span className="rounded-xs bg-primary px-1 py-0.2 font-mono text-[9px] text-primary-foreground font-bold">
                [ IN
              </span>
              Start Point
            </span>
            {trimStart !== null ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={() => setTrimStart(null)}
              >
                <X className="size-2.5 mr-0.5" /> Clear
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground">00:00.000 (Start of Video)</span>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="font-mono text-sm font-bold tracking-widest text-foreground">
              {trimStart !== null ? formatTimePrecise(trimStart) : "00:00.000"}
            </div>
            <div className="flex items-center gap-1">
              {trimStart !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
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
                className="h-6 px-2 text-[10px] font-bold"
              >
                Mark IN (Current)
              </Button>
            </div>
          </div>
        </div>

        {/* OUT Point (End) Box */}
        <div
          className={cn(
            "rounded-[var(--radius-sm)] border-2 p-2.5 transition-all",
            trimEnd !== null
              ? "border-destructive bg-destructive/5 shadow-[2px_2px_0px_var(--color-destructive)]"
              : "border-border bg-secondary/30",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1 font-bold text-foreground">
              <span className="rounded-xs bg-destructive px-1 py-0.2 font-mono text-[9px] text-white font-bold">
                OUT ]
              </span>
              End Point
            </span>
            {trimEnd !== null ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={() => setTrimEnd(null)}
              >
                <X className="size-2.5 mr-0.5" /> Clear
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {durationSec > 0 ? formatTimePrecise(durationSec) : "--:--"} (End of Video)
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="font-mono text-sm font-bold tracking-widest text-foreground">
              {trimEnd !== null
                ? formatTimePrecise(trimEnd)
                : durationSec > 0
                  ? formatTimePrecise(durationSec)
                  : "--:--.---"}
            </div>
            <div className="flex items-center gap-1">
              {trimEnd !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
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
                className="h-6 px-2 text-[10px] font-bold"
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

        {/* Screenshot Frame Inclusion Checkbox - Explicit User Requirement */}
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

      {/* Hardware WebCodecs Export Deck */}
      <div className="rounded-[var(--radius-sm)] border-2 border-border bg-secondary/50 p-3 shadow-[1px_1px_0px_var(--color-border)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Cpu className="size-4 text-signal" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Hardware WebCodecs Export
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-xs bg-success/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-success border border-success/30 uppercase">
              100% Frame-Accurate
            </span>
            <span className="rounded-xs bg-signal/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-signal border border-signal/30 uppercase">
              Hardware Accelerated
            </span>
          </div>
        </div>

        {/* Quality Preset & Codec Controls */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {/* Quality Profile */}
          <div className="space-y-1">
            <Label className="text-[10px]">Quality & Bitrate</Label>
            <Select
              value={exportConfig.quality}
              onValueChange={(v: ExportQuality) => {
                const preset = EXPORT_QUALITY_PRESETS[v];
                setExportConfig({
                  quality: v,
                  bitrateMbps: preset.bitrateMbps,
                });
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
              onValueChange={(v: "mp4" | "webm") => setExportConfig({ format: v })}
              disabled={disabled || isExporting}
            >
              <SelectTrigger className="h-7 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4" className="text-xs font-mono">
                  MP4 (AVC/H.264 + AAC)
                </SelectItem>
                <SelectItem value="webm" className="text-xs font-mono">
                  WebM (VP9 + Opus)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Synced Audio Toggle */}
          <div className="space-y-1">
            <Label className="text-[10px]">Audio Track</Label>
            <Button
              type="button"
              variant={exportConfig.keepAudio ? "outline" : "secondary"}
              size="sm"
              disabled={disabled || isExporting}
              onClick={() => setExportConfig({ keepAudio: !exportConfig.keepAudio })}
              className="h-7 w-full justify-between px-2 text-[11px] font-mono"
            >
              <span className="flex items-center gap-1">
                {exportConfig.keepAudio ? (
                  <Volume2 className="size-3 text-success" />
                ) : (
                  <VolumeX className="size-3 text-muted-foreground" />
                )}
                {exportConfig.keepAudio ? "Retain Synced Audio" : "Muted (No Audio)"}
              </span>
              <span className="text-[9px] text-muted-foreground uppercase">
                {exportConfig.keepAudio ? "ON" : "OFF"}
              </span>
            </Button>
          </div>
        </div>

        {/* Custom Bitrate Slider if selected */}
        {exportConfig.quality === "custom" ? (
          <div className="space-y-1 rounded-[var(--radius-sm)] border border-border bg-card p-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span>Custom Bitrate</span>
              <strong className="text-signal">{exportConfig.bitrateMbps} Mbps</strong>
            </div>
            <Slider
              min={1}
              max={30}
              step={0.5}
              value={[exportConfig.bitrateMbps]}
              onValueChange={([val]) => setExportConfig({ bitrateMbps: val ?? 8 })}
            />
          </div>
        ) : null}

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
            {isExporting
              ? "Hardware WebCodecs Exporting..."
              : `Export ${trimMode === "trim" ? "Trimmed" : "Cut"} Video (${formatTime(outputDurationSec)})`}
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
              <Badge variant="outline" className="border-success text-success">
                {exportResult.speedMultiplier}× Realtime Speed
              </Badge>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border/50 pt-1.5">
              <span>
                File: <strong className="text-foreground">{exportResult.fileName}</strong>
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
                Download Exported Video ({formatFileSize(exportResult.fileSize)})
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
    </div>
  );
}
