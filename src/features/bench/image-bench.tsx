import { Copy, Download, ExternalLink, ImageIcon, RotateCcw, Upload } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { DropZone } from "@/components/layout/drop-zone";
import { Panel } from "@/components/layout/panel";
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
import { CROP_PRESETS, FORMAT_OPTIONS, type CropPresetId, type OutputFormat } from "@/features/media/types";
import { cn } from "@/lib/utils";

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
      toast.success("Image pasted");
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
      toast.success("Copied optimized image");
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

  return (
    <Panel title="Bench">
      <DropZone
        accept="image/*"
        onFiles={onPick}
        className="flex flex-col items-center justify-center gap-1 px-6 py-8 text-center"
      >
        <Upload className="size-7 text-signal" />
        <p className="font-mono text-sm text-foreground">Click or drag & drop image</p>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP supported · paste also works</p>
        {source ? (
          <p className="mt-2 font-mono text-xs text-success">{source.fileName}</p>
        ) : null}
      </DropZone>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex gap-2 rounded-[var(--radius-sm)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <button type="button" className="ml-auto text-xs underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={cn("relative mt-4", !source && "pointer-events-none opacity-40")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ControlBlock label="Target Size" value={`${settings.targetKb} KB`}>
            <Slider
              min={25}
              max={500}
              step={5}
              value={[settings.targetKb]}
              onValueChange={([v]) => setSettings({ targetKb: v ?? 175 })}
            />
          </ControlBlock>

          <ControlBlock label="Quality" value={settings.quality.toFixed(2)}>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[Math.round(settings.quality * 100)]}
              onValueChange={([v]) => setSettings({ quality: (v ?? 85) / 100 })}
            />
          </ControlBlock>

          <ControlBlock label="Format">
            <Select
              value={settings.format}
              onValueChange={(value) => setSettings({ format: value as OutputFormat })}
            >
              <SelectTrigger>
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
          </ControlBlock>

          <ControlBlock label="Crop / Resize">
            <Select
              value={settings.cropPreset}
              onValueChange={(value) => setSettings({ cropPreset: value as CropPresetId })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CROP_PRESETS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ControlBlock>
        </div>

        {settings.cropPreset === "custom" ? (
          <div className="mt-3">
            <Label className="mb-2">Custom Dimensions (px)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={50}
                max={4096}
                placeholder="Width"
                value={settings.customWidth}
                onChange={(e) => setSettings({ customWidth: e.target.value })}
                className="w-28"
              />
              <span className="text-muted-foreground">×</span>
              <Input
                type="number"
                min={50}
                max={4096}
                placeholder="Height"
                value={settings.customHeight}
                onChange={(e) => setSettings({ customHeight: e.target.value })}
                className="w-28"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-center">
          <Button type="button" disabled={!source || processing} onClick={() => void process()}>
            Process Image
          </Button>
        </div>

        {processing ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-md)] bg-background/80 font-mono text-sm tracking-widest text-signal">
            PROCESSING...
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PreviewCard
          title="Source"
          src={source?.objectUrl}
          empty="Drop an image or capture a frame"
          dimensions={source ? `${source.width} × ${source.height}` : "-"}
          size={source ? formatFileSize(source.fileSize) : "-"}
        />
        <PreviewCard
          title="Output"
          src={output?.objectUrl}
          empty="WAITING..."
          dimensions={output ? `${output.width} × ${output.height}` : "-"}
          size={output ? formatFileSize(output.blob.size) : "-"}
          sizeAccent
          extra={
            pct
              ? { label: "Reduction", value: savings > 0 ? `-${pct}%` : "+0%" }
              : { label: "Reduction", value: "-" }
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {output ? (
          <>
            <SaveLink href={output.objectUrl} filename={outputName}>
              <Download />
              Download Saved Image
            </SaveLink>
            <Button asChild variant="outline">
              <a href={output.objectUrl} target="_blank" rel="noopener">
                <ExternalLink />
                Open
              </a>
            </Button>
          </>
        ) : (
          <Button type="button" variant="success" disabled>
            <Download />
            Download Saved Image
          </Button>
        )}
        <Button type="button" variant="outline" disabled={!output} onClick={() => void copyOutput()}>
          <Copy />
          Copy
        </Button>
        <Button type="button" variant="outline" onClick={clearBench} disabled={!source && !output}>
          <RotateCcw />
          Reset
        </Button>
      </div>
    </Panel>
  );
}

function ControlBlock({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {value ? <span className="text-signal">{value}</span> : null}
      </Label>
      {children}
    </div>
  );
}

function PreviewCard({
  title,
  src,
  empty,
  dimensions,
  size,
  sizeAccent,
  extra,
}: {
  title: string;
  src?: string;
  empty: string;
  dimensions: string;
  size: string;
  sizeAccent?: boolean;
  extra?: { label: string; value: string };
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-secondary/40 p-3">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="checkerboard mb-3 flex h-44 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-border">
        {src ? (
          <img src={src} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {title === "Source" ? <Upload className="size-3.5" /> : <ImageIcon className="size-3.5" />}
            {empty}
          </span>
        )}
      </div>
      <StatRow label="Dimensions" value={dimensions} />
      <StatRow label="Size" value={size} accent={sizeAccent} />
      {extra ? <StatRow label={extra.label} value={extra.value} /> : null}
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1.5 font-mono text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular text-foreground", accent && "text-success")}>{value}</span>
    </div>
  );
}
