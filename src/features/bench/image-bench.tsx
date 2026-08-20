import {
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { DropZone } from "@/components/layout/drop-zone";
import { Panel } from "@/components/layout/panel";
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
import { extFromMime, fileStem, formatFileSize } from "@/features/media/format";
import { SaveLink } from "@/features/media/save-link";
import { useMediaStore } from "@/features/media/store";
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
  const processing = useMediaStore((s) => s.processing);
  const error = useMediaStore((s) => s.error);
  const loadImageFile = useMediaStore((s) => s.loadImageFile);
  const process = useMediaStore((s) => s.process);
  const clearBench = useMediaStore((s) => s.clearBench);
  const setSettings = useMediaStore((s) => s.setSettings);
  const setError = useMediaStore((s) => s.setError);

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

      {/* Preset Controls Container */}
      <div className={cn("relative space-y-3.5", !source && "pointer-events-none opacity-40")}>
        {/* Quick Aspect Ratio Chips */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              1. Aspect Ratio / Crop Preset:
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
                  onClick={() => setSettings({ cropPreset: asp.id })}
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

      {/* Side-by-Side Source vs Optimized Cards */}
      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Source Card */}
        <PreviewCard
          title="Raw Source Frame"
          src={source?.objectUrl}
          empty="Drop image or press S on player"
          dimensions={source ? `${source.width} × ${source.height} px` : "—"}
          size={source ? formatFileSize(source.fileSize) : "—"}
          tag="SOURCE"
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
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-border/40 pt-3">
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
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-sm)] border-2 border-border bg-card p-3 shadow-[2px_2px_0px_var(--color-border)]">
      {/* Card Header */}
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">{title}</p>
        <Badge variant={sizeAccent ? "success" : "outline"} className="text-[9px]">
          {tag}
        </Badge>
      </div>

      {/* Image Preview Canvas */}
      <div className="checkerboard relative mb-2.5 flex h-48 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border-2 border-border">
        {src ? (
          <img src={src} alt={title} className="max-h-full max-w-full object-contain p-1" />
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
