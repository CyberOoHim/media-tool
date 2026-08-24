import {
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeckExpander } from "@/components/layout/deck-expander";
import { DropZone } from "@/components/layout/drop-zone";
import { Panel } from "@/components/layout/panel";
import { TransformControls } from "@/components/media/transform-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { copyBlobToClipboard, imageFileFromClipboard } from "@/features/media/clipboard";
import { getCropAspectRatio } from "@/features/media/crop";
import { extFromMime, fileStem, formatFileSize } from "@/features/media/format";
import { SaveLink } from "@/features/media/save-link";
import { useMediaStore } from "@/features/media/store";
import {
  clampPan,
  clampZoom,
  getTransformCss,
  hasActiveTransform,
  normalizeRotation,
  type TransformState,
} from "@/features/media/transform";
import {
  CROP_PRESETS,
  FORMAT_OPTIONS,
  type CropPresetId,
  type OutputFormat,
} from "@/features/media/types";
import { cn } from "@/lib/utils";

const QUICK_BUDGETS = [50, 100, 175, 300, 500] as const;

const QUICK_ASPECTS: { id: CropPresetId; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "16:9", label: "16:9" },
  { id: "4:3", label: "4:3" },
  { id: "3:4", label: "3:4" },
  { id: "3:2", label: "3:2" },
  { id: "2:3", label: "2:3" },
  { id: "square", label: "1:1" },
  { id: "9:16", label: "9:16" },
  { id: "yt-thumb", label: "YT 720p" },
  { id: "og", label: "OG Card" },
  { id: "std-banner", label: "Banner" },
  { id: "custom", label: "Custom" },
];

export function ImageBench() {
  const source = useMediaStore((s) => s.source);
  const output = useMediaStore((s) => s.output);
  const settings = useMediaStore((s) => s.settings);
  const benchTransform = useMediaStore((s) => s.benchTransform);
  const processing = useMediaStore((s) => s.processing);
  const error = useMediaStore((s) => s.error);
  const loadImageFile = useMediaStore((s) => s.loadImageFile);
  const process = useMediaStore((s) => s.process);
  const clearBench = useMediaStore((s) => s.clearBench);
  const setSettings = useMediaStore((s) => s.setSettings);
  const setBenchTransform = useMediaStore((s) => s.setBenchTransform);
  const resetBenchTransform = useMediaStore((s) => s.resetBenchTransform);
  const setError = useMediaStore((s) => s.setError);

  const [isPanning, setIsPanning] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Global pan handler for image preview
  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!isPanning || !dragStartRef.current || !previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      const newPanX = clampPan(dragStartRef.current.startPanX + (dx / rect.width) * 100);
      const newPanY = clampPan(dragStartRef.current.startPanY + (dy / rect.height) * 100);
      setBenchTransform({ panX: newPanX, panY: newPanY });
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
  }, [isPanning, setBenchTransform]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const file = imageFileFromClipboard(event);
      if (!file) return;
      event.preventDefault();
      void loadImageFile(file);
      toast.success("Pasted image into Bench");
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadImageFile]);

  const onPick = (files: FileList) => {
    const file = files[0];
    if (!file) return;
    void loadImageFile(file);
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await copyBlobToClipboard(output.blob);
      toast.success("Copied optimized still to clipboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  };

  const savings = source && output ? source.fileSize - output.blob.size : 0;
  const pct =
    source && output && source.fileSize > 0
      ? ((savings / source.fileSize) * 100).toFixed(1)
      : null;

  const outputName = output
    ? `${fileStem(source?.fileName ?? "image")}_optimized.${extFromMime(output.format)}`
    : "image_optimized.jpg";

  const benchStatus = processing
    ? "PROCESSING"
    : output
      ? "OPTIMIZED"
      : source
        ? "READY"
        : "IDLE";

  const benchStatusVariant = processing
    ? "signal"
    : output
      ? "success"
      : "default";

  return (
    <Panel
      title="Bench-2 // Still Optimizer"
      status={benchStatus}
      statusVariant={benchStatusVariant}
      action={
        source ? (
          <span className="max-w-[140px] truncate font-mono text-[11px] font-bold text-foreground sm:max-w-[200px]">
            {source.fileName}
          </span>
        ) : (
          <Badge variant="outline">No Frame Loaded</Badge>
        )
      }
    >
      {/* Drop / Load Area */}
      {!source ? (
        <DropZone
          accept="image/*"
          onFiles={onPick}
          className="flex min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <div className="grid size-12 place-items-center rounded-[var(--radius-sm)] border-2 border-border bg-signal text-foreground shadow-[2px_2px_0px_var(--color-border)]">
            <Upload className="size-6" />
          </div>
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
              Drop Still Image or Snap Video Frame
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Supports JPG, PNG, WebP, AVIF · Clipboard paste works anywhere
            </p>
          </div>
        </DropZone>
      ) : null}

      {/* Error Alert */}
      {error ? (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between rounded-[var(--radius-sm)] border-2 border-destructive bg-destructive/10 px-3 py-2 text-xs font-mono font-bold text-destructive shadow-[2px_2px_0px_var(--color-border)]"
        >
          <span>{error}</span>
          <button type="button" className="underline hover:no-underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Bench Transform Toolbar (Zoom, Pan, Rotate, Flip, Crop) */}
      <div className={cn("mb-3.5", !source && "pointer-events-none opacity-40")}>
        <DeckExpander
          id="deck-bench-transform"
          title="Bench-2 // Transform & Framing Calibration"
          subtitle="Zoom, pan, rotate & framing alignment for the target image"
          icon={<Sliders className="size-3.5" />}
          badge={
            hasActiveTransform(benchTransform) ? (
              <Badge variant="signal" className="px-1.5 py-0 text-[8px]">
                ACTIVE TRANSFORM
              </Badge>
            ) : null
          }
          disabled={!source}
        >
          <TransformControls
            transform={{
              ...benchTransform,
              cropPreset: settings.cropPreset,
            }}
            onChange={(partial) => {
              if (partial.cropPreset !== undefined) {
                setSettings({ cropPreset: partial.cropPreset });
              }
              setBenchTransform(partial);
            }}
            onReset={() => {
              resetBenchTransform();
              setSettings({ cropPreset: "none" });
              toast("Bench transforms reset");
            }}
            title="Transform Calibration"
            disabled={!source}
          />
        </DeckExpander>
      </div>

      {/* Preset Controls & Compression Budget Deck */}
      <div className={cn("relative mb-3.5", !source && "pointer-events-none opacity-40")}>
        <DeckExpander
          id="deck-bench-budget"
          title="Bench-2 // Compression Budget & Output Quality"
          subtitle="Aspect ratio framing, target file size budget & format presets"
          icon={<Sparkles className="size-3.5" />}
          badge={
            <Badge variant="outline" className="px-1.5 py-0 text-[8px] font-mono">
              {settings.targetKb} KB · {settings.format.toUpperCase()}
            </Badge>
          }
          disabled={!source}
        >
          <div className="relative space-y-3.5">
            {/* Quick Aspect Ratio Chips */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Aspect Ratio / Framing Preset:
                </Label>
                <span className="font-mono text-[11px] font-bold text-primary">
                  {CROP_PRESETS.find((p) => p.id === settings.cropPreset)?.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {QUICK_ASPECTS.map((asp) => {
                  const active = settings.cropPreset === asp.id;
                  return (
                    <Button
                      key={asp.id}
                      type="button"
                      size="sm"
                      variant={active ? "primary" : "outline"}
                      onClick={() => {
                        setSettings({ cropPreset: asp.id });
                        setBenchTransform({ cropPreset: asp.id });
                      }}
                      className="h-7 px-2 text-[10px] font-bold"
                    >
                      {asp.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Custom Dimensions If Selected */}
            {settings.cropPreset === "custom" ? (
              <div className="rounded-[var(--radius-sm)] border-2 border-border bg-secondary/50 p-2.5">
                <Label className="mb-1.5 block font-mono text-[11px] font-bold uppercase text-foreground">
                  Custom Pixel Dimensions (Width × Height)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={50}
                    max={4096}
                    placeholder="Width"
                    value={settings.customWidth}
                    onChange={(e) => setSettings({ customWidth: e.target.value })}
                    className="w-28 font-mono text-xs"
                  />
                  <span className="font-bold text-foreground">×</span>
                  <Input
                    type="number"
                    min={50}
                    max={4096}
                    placeholder="Height"
                    value={settings.customHeight}
                    onChange={(e) => setSettings({ customHeight: e.target.value })}
                    className="w-28 font-mono text-xs"
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">px</span>
                </div>
              </div>
            ) : null}

            {/* Quick Target Budget Chips & Sliders */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Target KB Slider & Quick Chips */}
              <div className="rounded-[var(--radius-sm)] border-2 border-border bg-secondary/40 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                    2. Target Budget:
                  </Label>
                  <span className="rounded-xs border border-border bg-signal px-1.5 py-0.2 font-mono text-xs font-bold text-foreground">
                    {settings.targetKb} KB
                  </span>
                </div>

                <Slider
                  min={20}
                  max={600}
                  step={5}
                  value={[settings.targetKb]}
                  onValueChange={([v]) => setSettings({ targetKb: v ?? 175 })}
                />

                <div className="mt-2 flex flex-wrap gap-1">
                  {QUICK_BUDGETS.map((kb) => (
                    <Button
                      key={kb}
                      type="button"
                      size="sm"
                      variant={settings.targetKb === kb ? "signal" : "outline"}
                      onClick={() => setSettings({ targetKb: kb })}
                      className="h-6 px-1.5 text-[9px] font-bold"
                    >
                      {kb}K
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quality & Format Block */}
              <div className="rounded-[var(--radius-sm)] border-2 border-border bg-secondary/40 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                    3. Quality & Format:
                  </Label>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {Math.round(settings.quality * 100)}%
                  </span>
                </div>

                <Slider
                  min={10}
                  max={100}
                  step={5}
                  value={[Math.round(settings.quality * 100)]}
                  onValueChange={([v]) => setSettings({ quality: (v ?? 85) / 100 })}
                />

                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">Format:</span>
                  <Select
                    value={settings.format}
                    onValueChange={(value) => setSettings({ format: value as OutputFormat })}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Processing Indicator Overlay */}
            {processing ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius-md)] bg-card/80 backdrop-blur-xs font-mono text-xs font-bold tracking-widest text-primary">
                <span className="flex items-center gap-2 rounded border-2 border-border bg-secondary px-3 py-1.5 shadow-[2px_2px_0px_var(--color-border)]">
                  <RefreshCw className="size-4 animate-spin" />
                  COMPRESSING TO BUDGET...
                </span>
              </div>
            ) : null}
          </div>
        </DeckExpander>
      </div>

      {/* Side-by-Side Source vs Optimized Cards & Actions Deck */}
      <DeckExpander
        id="deck-bench-comparison"
        title="Bench-2 // Output Comparison & Action Deck"
        subtitle="Side-by-side visual analysis, byte savings & export commands"
        icon={<ImageIcon className="size-3.5" />}
        badge={
          output ? (
            <Badge variant="signal" className="px-1.5 py-0 text-[8px] font-mono">
              {formatFileSize(output.blob.size)} · READY
            </Badge>
          ) : null
        }
      >
        <div className="space-y-3.5">
          {/* Side-by-Side Source vs Optimized Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Source Card */}
            <PreviewCard
              title="Raw Source Frame"
              src={source?.objectUrl}
              empty="Drop image or press S on player"
              dimensions={source ? `${source.width} × ${source.height} px` : "—"}
              size={source ? formatFileSize(source.fileSize) : "—"}
              tag="SOURCE"
              transform={benchTransform}
              isSourceInteractive={Boolean(source)}
              isPanning={isPanning}
              onWheelZoom={(delta) => {
                setBenchTransform({ zoom: clampZoom(benchTransform.zoom + delta) });
              }}
              onPanStart={(e) => {
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  startPanX: benchTransform.panX,
                  startPanY: benchTransform.panY,
                };
                setIsPanning(true);
              }}
              onResetZoomPan={() => {
                setBenchTransform({ zoom: 1, panX: 0, panY: 0 });
                toast("Zoom & Pan Centered");
              }}
              onClearTransforms={() => {
                resetBenchTransform();
                setSettings({ cropPreset: "none" });
                toast("All bench transforms cleared");
              }}
              onTransformChange={(partial) => setBenchTransform(partial)}
              containerRef={previewContainerRef}
            />

            {/* Optimized Card */}
            <PreviewCard
              title="Optimized Output"
              src={output?.objectUrl}
              empty={source ? "Optimizing..." : "Waiting for source frame..."}
              dimensions={output ? `${output.width} × ${output.height} px` : "—"}
              size={output ? formatFileSize(output.blob.size) : "—"}
              tag={output ? extFromMime(output.format).toUpperCase() : "TARGET"}
              sizeAccent
              extra={
                pct
                  ? {
                      label: "Byte Reduction",
                      value: savings > 0 ? `-${pct}% SAVED` : "+0% (RAW)",
                      isPositive: savings > 0,
                    }
                  : undefined
              }
              budgetNote={
                output
                  ? output.blob.size <= settings.targetKb * 1024
                    ? `✔ Fits ${settings.targetKb} KB budget`
                    : `Target ${settings.targetKb} KB (quality floor)`
                  : undefined
              }
            />
          </div>

          {/* Action Command Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {output ? (
                <>
                  <SaveLink blob={output.blob} filename={outputName}>
                    <Download className="size-4" />
                    Download ({formatFileSize(output.blob.size)})
                  </SaveLink>

                  <Button asChild variant="outline" size="sm">
                    <a href={output.objectUrl} target="_blank" rel="noopener">
                      <ExternalLink className="size-3.5" />
                      Full Preview
                    </a>
                  </Button>
                </>
              ) : (
                <Button type="button" variant="success" size="sm" disabled>
                  <Download className="size-4" />
                  Download Saved Still
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!output}
                onClick={() => void copyOutput()}
                title="Copy optimized image to clipboard"
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void process()}
                disabled={!source || processing}
                title="Re-run compression algorithm"
              >
                <RefreshCw className={cn("size-3.5", processing && "animate-spin")} />
                Re-process
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearBench}
                disabled={!source && !output}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </DeckExpander>
    </Panel>
  );
}

function PreviewCard({
  title,
  src,
  empty,
  dimensions,
  size,
  sizeAccent,
  tag,
  extra,
  budgetNote,
  transform,
  isSourceInteractive,
  isPanning,
  onWheelZoom,
  onPanStart,
  onResetZoomPan,
  onClearTransforms,
  onTransformChange,
  containerRef,
}: {
  title: string;
  src?: string;
  empty: string;
  dimensions: string;
  size: string;
  sizeAccent?: boolean;
  tag: string;
  extra?: { label: string; value: string; isPositive?: boolean };
  budgetNote?: string;
  transform?: TransformState;
  isSourceInteractive?: boolean;
  isPanning?: boolean;
  onWheelZoom?: (delta: number) => void;
  onPanStart?: (e: React.MouseEvent) => void;
  onResetZoomPan?: () => void;
  onClearTransforms?: () => void;
  onTransformChange?: (partial: Partial<TransformState>) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const hasTransform = transform && hasActiveTransform(transform);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

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

  useEffect(() => {
    const el = containerRef?.current;
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
  }, [containerRef]);

  return (
    <div className="flex flex-col rounded-[var(--radius-sm)] border-2 border-border bg-card p-3 shadow-[2px_2px_0px_var(--color-border)]">
      {/* Card Header */}
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground truncate">{title}</p>
          {hasTransform ? (
            <span className="rounded-xs bg-signal/20 px-1 font-mono text-[9px] font-bold text-signal shrink-0">
              {Math.round(normalizeRotation(transform.rotation)) !== 0
                ? `ROT ${Math.round(normalizeRotation(transform.rotation))}°`
                : "TRANSFORMED"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasTransform && onClearTransforms ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-5 px-1.5 font-mono text-[9px] font-bold touch-manipulation active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                onClearTransforms();
              }}
            >
              <RotateCcw className="size-2.5 mr-1" />
              Clear
            </Button>
          ) : null}
          <Badge variant={sizeAccent ? "success" : "outline"} className="text-[9px]">
            {tag}
          </Badge>
        </div>
      </div>

      {/* Image Preview Canvas */}
      <div
        ref={containerRef}
        onWheel={(e) => {
          if (isSourceInteractive && onWheelZoom) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.15 : -0.15;
            onWheelZoom(delta);
          }
        }}
        onMouseDown={(e) => {
          if (isSourceInteractive && onPanStart && e.button === 0) {
            onPanStart(e);
          }
        }}
        onDoubleClick={() => {
          if (isSourceInteractive) {
            if (hasTransform && onClearTransforms) {
              onClearTransforms();
            } else if (onResetZoomPan) {
              onResetZoomPan();
            }
          }
        }}
        onTouchStart={(event) => {
          if (!isSourceInteractive || !transform || !onTransformChange) return;
          if (event.touches.length === 2) {
            const t1 = event.touches[0]!;
            const t2 = event.touches[1]!;
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
            const midX = (t1.clientX + t2.clientX) / 2;
            const midY = (t1.clientY + t2.clientY) / 2;
            touchStateRef.current = {
              ...touchStateRef.current,
              initialDistance: dist,
              initialZoom: transform.zoom,
              initialAngle: angle,
              initialRotation: transform.rotation,
              initialMidpoint: { x: midX, y: midY },
              startPanX: transform.panX,
              startPanY: transform.panY,
            };
          } else if (event.touches.length === 1) {
            const t = event.touches[0]!;
            const now = Date.now();
            const last = touchStateRef.current.lastTapTime;
            const lastPos = touchStateRef.current.lastTapPos;
            const distFromLast = Math.hypot(t.clientX - lastPos.x, t.clientY - lastPos.y);

            if (now - last < 300 && distFromLast < 40) {
              if (hasTransform && onClearTransforms) {
                onClearTransforms();
              } else if (onResetZoomPan) {
                onResetZoomPan();
              } else {
                onTransformChange({ zoom: 2 });
              }
              touchStateRef.current.lastTapTime = 0;
              return;
            }

            touchStateRef.current.lastTapTime = now;
            touchStateRef.current.lastTapPos = { x: t.clientX, y: t.clientY };
            touchStateRef.current.startPanX = transform.panX;
            touchStateRef.current.startPanY = transform.panY;
          }
        }}
        onTouchMove={(event) => {
          if (!isSourceInteractive || !transform || !onTransformChange) return;
          if (event.touches.length === 2) {
            const t1 = event.touches[0]!;
            const t2 = event.touches[1]!;
            const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

            if (touchStateRef.current.initialDistance > 0) {
              const scaleFactor = currentDist / touchStateRef.current.initialDistance;
              const targetZoom = clampZoom(touchStateRef.current.initialZoom * scaleFactor);

              let angleDelta = currentAngle - touchStateRef.current.initialAngle;
              while (angleDelta > 180) angleDelta -= 360;
              while (angleDelta < -180) angleDelta += 360;
              const targetRotation = normalizeRotation(touchStateRef.current.initialRotation + angleDelta);

              const midX = (t1.clientX + t2.clientX) / 2;
              const midY = (t1.clientY + t2.clientY) / 2;
              const rect = containerRef?.current?.getBoundingClientRect();
              let newPanX = transform.panX;
              let newPanY = transform.panY;
              if (rect && rect.width > 0 && rect.height > 0) {
                const dx = midX - touchStateRef.current.initialMidpoint.x;
                const dy = midY - touchStateRef.current.initialMidpoint.y;
                newPanX = clampPan(touchStateRef.current.startPanX + (dx / rect.width) * 100);
                newPanY = clampPan(touchStateRef.current.startPanY + (dy / rect.height) * 100);
              }

              onTransformChange({
                zoom: targetZoom,
                rotation: targetRotation,
                panX: newPanX,
                panY: newPanY,
              });
            }
          } else if (event.touches.length === 1 && transform.zoom > 1) {
            const t = event.touches[0]!;
            const rect = containerRef?.current?.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
              const dx = t.clientX - touchStateRef.current.lastTapPos.x;
              const dy = t.clientY - touchStateRef.current.lastTapPos.y;
              const newPanX = clampPan(touchStateRef.current.startPanX + (dx / rect.width) * 100);
              const newPanY = clampPan(touchStateRef.current.startPanY + (dy / rect.height) * 100);
              onTransformChange({ panX: newPanX, panY: newPanY });
            }
          }
        }}
        onTouchEnd={(event) => {
          if (event.touches.length < 2) {
            touchStateRef.current.initialDistance = 0;
            touchStateRef.current.initialAngle = 0;
          }
        }}
        className={cn(
          "checkerboard relative mb-2.5 flex h-48 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border-2 border-border select-none touch-none",
          isSourceInteractive && transform && transform.zoom > 1
            ? isPanning
              ? "cursor-grabbing"
              : "cursor-grab"
            : isSourceInteractive
              ? "cursor-crosshair"
              : "cursor-default",
        )}
      >
        {/* Visual Safe-Area / Crop Framing Mask */}
        {transform && transform.cropPreset && transform.cropPreset !== "none" ? (() => {
          const cropRatio =
            getCropAspectRatio(
              transform.cropPreset,
              transform.customWidth,
              transform.customHeight,
              16,
              9,
            ) ?? (16 / 9);

          const presetLabel =
            CROP_PRESETS.find((p) => p.id === transform.cropPreset)?.label ??
            transform.cropPreset;

          // Best fit upon viewport: width fit or height fit, whichever first hits the edge
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
                className="relative flex items-start justify-between border-2 border-dashed border-signal bg-signal/5 p-1 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all duration-100"
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

                <span className="relative z-10 rounded-xs bg-signal px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-foreground shadow-xs">
                  {presetLabel}
                </span>
                <span className="relative z-10 rounded-xs bg-black/85 px-1 py-0.5 font-mono text-[8px] font-semibold text-signal uppercase border border-signal/30">
                  CROP
                </span>
              </div>
            </div>
          );
        })() : null}

        {src ? (
          <img
            src={src}
            alt={title}
            style={
              transform
                ? {
                    transform: getTransformCss(transform),
                    transformOrigin: "center center",
                    transition: isPanning ? "none" : "transform 120ms ease-out",
                  }
                : undefined
            }
            className="max-h-full max-w-full object-contain p-1"
          />
        ) : (
          <span className="flex items-center gap-2 font-mono text-xs font-semibold text-muted-foreground">
            <ImageIcon className="size-4" />
            {empty}
          </span>
        )}
      </div>

      {/* Stats Metadata */}
      <div className="space-y-1 text-xs font-mono">
        <StatRow label="Resolution" value={dimensions} />
        <StatRow label="File Size" value={size} accent={sizeAccent} />
        {extra ? (
          <StatRow
            label={extra.label}
            value={extra.value}
            accent={extra.isPositive}
            isTag
          />
        ) : null}
      </div>

      {budgetNote ? (
        <p className="mt-1.5 font-mono text-[10px] font-bold text-success uppercase">
          {budgetNote}
        </p>
      ) : null}
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
  isTag,
}: {
  label: string;
  value: string;
  accent?: boolean;
  isTag?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1 font-mono text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {isTag ? (
        <span
          className={cn(
            "rounded-xs px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase tracking-wider",
            accent ? "bg-success text-success-foreground" : "bg-secondary text-foreground",
          )}
        >
          {value}
        </span>
      ) : (
        <span className={cn("tabular font-semibold text-foreground", accent && "text-success font-bold")}>
          {value}
        </span>
      )}
    </div>
  );
}
