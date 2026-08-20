import {
  Crop,
  FlipHorizontal,
  FlipVertical,
  Move,
  RotateCcw,
  RotateCw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import {
  clampPan,
  clampZoom,
  hasActiveTransform,
  rotateClockwise,
  rotateCounterClockwise,
  type TransformState,
} from "@/features/media/transform";
import {
  CROP_PRESETS,
  type CropPresetId,
} from "@/features/media/types";
import { cn } from "@/lib/utils";

const QUICK_ASPECTS: { id: CropPresetId; label: string }[] = [
  { id: "none", label: "Full" },
  { id: "16:9", label: "16:9" },
  { id: "4:3", label: "4:3" },
  { id: "square", label: "1:1" },
  { id: "9:16", label: "9:16" },
  { id: "yt-thumb", label: "YT 720p" },
  { id: "og", label: "OG Card" },
  { id: "std-banner", label: "Banner" },
];

export function TransformControls({
  transform,
  onChange,
  onReset,
  title = "Transform & Framing",
  disabled = false,
  showCropPresets = true,
  bakeToggle,
}: {
  transform: TransformState;
  onChange: (partial: Partial<TransformState>) => void;
  onReset: () => void;
  title?: string;
  disabled?: boolean;
  showCropPresets?: boolean;
  bakeToggle?: {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
  };
}) {
  const isActive = hasActiveTransform(transform);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border-2 border-border bg-secondary/50 p-2.5 shadow-[2px_2px_0px_var(--color-border)]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {/* Header with Active Indicator and Reset Button */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          <Sparkles className="size-3.5 text-signal" />
          <span>{title}</span>
          {isActive ? (
            <Badge variant="signal" className="px-1.5 py-0 text-[8px]">
              MODIFIED
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {bakeToggle ? (
            <Hint label="Bake zoom, rotate, flip & crop directly into captured still">
              <Button
                type="button"
                size="sm"
                variant={bakeToggle.enabled ? "signal" : "outline"}
                className="h-6 px-1.5 text-[9px] font-bold"
                onClick={() => bakeToggle.onToggle(!bakeToggle.enabled)}
              >
                Bake to Snap: {bakeToggle.enabled ? "ON" : "OFF"}
              </Button>
            </Hint>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onReset}
            disabled={!isActive}
          >
            <RotateCcw className="size-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Zoom Control */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1">
              <ZoomIn className="size-3" /> Zoom
            </span>
            <span className="tabular text-foreground">
              {Math.round(transform.zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Hint label="Zoom Out (-)">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-6"
                onClick={() => onChange({ zoom: clampZoom(transform.zoom - 0.2) })}
              >
                <ZoomOut className="size-3" />
              </Button>
            </Hint>

            <Slider
              min={50}
              max={400}
              step={5}
              value={[Math.round(transform.zoom * 100)]}
              onValueChange={([v]) => onChange({ zoom: clampZoom((v ?? 100) / 100) })}
              className="flex-1"
            />

            <Hint label="Zoom In (+)">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-6"
                onClick={() => onChange({ zoom: clampZoom(transform.zoom + 0.2) })}
              >
                <ZoomIn className="size-3" />
              </Button>
            </Hint>
          </div>

          <div className="flex justify-between gap-1 pt-0.5">
            {[1, 1.5, 2, 3].map((z) => (
              <Button
                key={z}
                type="button"
                variant={transform.zoom === z ? "signal" : "outline"}
                size="sm"
                className="h-5 flex-1 px-0 text-[8px] font-mono font-bold"
                onClick={() => onChange({ zoom: z })}
              >
                {z}×
              </Button>
            ))}
          </div>
        </div>

        {/* 2. Pan Offset Controls */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1">
              <Move className="size-3" /> Pan Offset
            </span>
            <span className="tabular text-foreground text-[9px]">
              X:{Math.round(transform.panX)}% Y:{Math.round(transform.panY)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">X:</span>
              <Slider
                min={-100}
                max={100}
                step={1}
                value={[Math.round(transform.panX)]}
                onValueChange={([v]) => onChange({ panX: clampPan(v ?? 0) })}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Y:</span>
              <Slider
                min={-100}
                max={100}
                step={1}
                value={[Math.round(transform.panY)]}
                onValueChange={([v]) => onChange({ panY: clampPan(v ?? 0) })}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 w-full text-[8px] font-mono font-bold"
              onClick={() => onChange({ panX: 0, panY: 0 })}
              disabled={transform.panX === 0 && transform.panY === 0}
            >
              Center Viewport
            </Button>
          </div>
        </div>

        {/* 3. Rotate & Orientation Controls */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1">
              <RotateCw className="size-3" /> Rotate & Orientation
            </span>
            <Badge variant="outline" className="h-4 px-1 text-[8px] font-mono">
              {transform.rotation}°
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Hint label="Rotate 90° CCW">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 flex-1 text-[9px] font-mono font-bold"
                onClick={() => onChange({ rotation: rotateCounterClockwise(transform.rotation) })}
              >
                <RotateCcw className="size-3 mr-1" />
                -90°
              </Button>
            </Hint>

            <Hint label="Rotate 90° CW (R)">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 flex-1 text-[9px] font-mono font-bold"
                onClick={() => onChange({ rotation: rotateClockwise(transform.rotation) })}
              >
                <RotateCw className="size-3 mr-1" />
                +90°
              </Button>
            </Hint>
          </div>

          <div className="flex justify-between gap-1 pt-0.5">
            {[0, 90, 180, 270].map((deg) => (
              <Button
                key={deg}
                type="button"
                variant={transform.rotation === deg ? "signal" : "outline"}
                size="sm"
                className="h-5 flex-1 px-0 text-[8px] font-mono font-bold"
                onClick={() => onChange({ rotation: deg })}
              >
                {deg}°
              </Button>
            ))}
          </div>
        </div>

        {/* 4. Flip / Mirror Controls */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1">
              <FlipHorizontal className="size-3" /> Flip & Mirror
            </span>
            <span className="text-[9px] text-muted-foreground font-mono">
              {transform.flipH && transform.flipV
                ? "H+V"
                : transform.flipH
                  ? "H-MIRROR"
                  : transform.flipV
                    ? "V-FLIP"
                    : "NORMAL"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Hint label="Flip Horizontal / Mirror (H)">
              <Button
                type="button"
                variant={transform.flipH ? "signal" : "outline"}
                size="sm"
                className="h-6 flex-1 text-[9px] font-mono font-bold gap-1"
                onClick={() => onChange({ flipH: !transform.flipH })}
              >
                <FlipHorizontal className="size-3" />
                Flip H
              </Button>
            </Hint>

            <Hint label="Flip Vertical (V)">
              <Button
                type="button"
                variant={transform.flipV ? "signal" : "outline"}
                size="sm"
                className="h-6 flex-1 text-[9px] font-mono font-bold gap-1"
                onClick={() => onChange({ flipV: !transform.flipV })}
              >
                <FlipVertical className="size-3" />
                Flip V
              </Button>
            </Hint>
          </div>

          <div className="flex justify-between items-center pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 w-full text-[8px] font-mono font-bold"
              onClick={() => onChange({ flipH: false, flipV: false })}
              disabled={!transform.flipH && !transform.flipV}
            >
              Reset Flip
            </Button>
          </div>
        </div>
      </div>

      {/* 5. Crop / Aspect Framing Guide Presets */}
      {showCropPresets ? (
        <div className="mt-2.5 pt-2 border-t border-border/40">
          <div className="mb-1 flex items-center justify-between">
            <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Crop className="size-3 text-signal" />
              Crop / Aspect Framing:
            </Label>
            <span className="font-mono text-[10px] font-bold text-primary">
              {CROP_PRESETS.find((p) => p.id === transform.cropPreset)?.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_ASPECTS.map((asp) => {
              const active = transform.cropPreset === asp.id;
              return (
                <Button
                  key={asp.id}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  onClick={() => onChange({ cropPreset: asp.id })}
                  className="h-6 px-2 text-[9px] font-bold font-mono"
                >
                  {asp.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
