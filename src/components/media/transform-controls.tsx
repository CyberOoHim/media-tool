import {
  Crop,
  FlipHorizontal,
  FlipVertical,
  Minus,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import {
  clampPan,
  clampZoom,
  hasActiveTransform,
  normalizeRotation,
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
  { id: "none", label: "Full / None" },
  { id: "16:9", label: "16:9 Wide" },
  { id: "4:3", label: "4:3 Standard" },
  { id: "3:4", label: "3:4 Vertical" },
  { id: "3:2", label: "3:2 Photo" },
  { id: "2:3", label: "2:3 Portrait" },
  { id: "square", label: "1:1 Square" },
  { id: "9:16", label: "9:16 Portrait" },
  { id: "yt-thumb", label: "YT 720p" },
  { id: "og", label: "OG Card" },
  { id: "std-banner", label: "Banner" },
  { id: "wide-banner", label: "Wide Banner" },
  { id: "custom", label: "Custom" },
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
        "rounded-[var(--radius-sm)] border-2 border-border bg-secondary/50 p-3 shadow-[2px_2px_0px_var(--color-border)] select-none",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {/* Header with Active Indicator and Reset Button */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          <Sparkles className="size-4 text-signal" />
          <span>{title}</span>
          {isActive ? (
            <Badge variant="signal" className="px-1.5 py-0.5 text-[9px] font-bold">
              MODIFIED
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {bakeToggle ? (
            <Hint label="Bake zoom, rotate, flip & crop directly into captured still">
              <Button
                type="button"
                size="sm"
                variant={bakeToggle.enabled ? "signal" : "outline"}
                className="h-8 px-2.5 text-[10px] font-bold touch-manipulation"
                onClick={() => bakeToggle.onToggle(!bakeToggle.enabled)}
              >
                Bake to Snap: {bakeToggle.enabled ? "ON" : "OFF"}
              </Button>
            </Hint>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-[11px] font-bold text-muted-foreground hover:text-foreground touch-manipulation"
            onClick={onReset}
            disabled={!isActive}
          >
            <RotateCcw className="size-3.5 mr-1" />
            Reset All
          </Button>
        </div>
      </div>

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Zoom Control */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ZoomIn className="size-3.5" /> Zoom
            </span>
            <span className="tabular text-foreground font-bold text-xs">
              {Math.round(transform.zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Hint label="Zoom Out (-)">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-9 p-0 touch-manipulation active:scale-95 shrink-0"
                onClick={() => onChange({ zoom: clampZoom(transform.zoom - 0.2) })}
              >
                <ZoomOut className="size-4" />
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
                size="sm"
                className="size-9 p-0 touch-manipulation active:scale-95 shrink-0"
                onClick={() => onChange({ zoom: clampZoom(transform.zoom + 0.2) })}
              >
                <ZoomIn className="size-4" />
              </Button>
            </Hint>
          </div>

          {/* Quick Zoom Touch Pills */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[1, 1.5, 2, 3].map((z) => (
              <Button
                key={z}
                type="button"
                variant={transform.zoom === z ? "signal" : "outline"}
                size="sm"
                className="h-7 px-0 text-[10px] font-mono font-bold touch-manipulation active:scale-95"
                onClick={() => onChange({ zoom: z })}
              >
                {z}×
              </Button>
            ))}
          </div>
        </div>

        {/* 2. Pan Offset Controls */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Move className="size-3.5" /> Pan Offset
            </span>
            <span className="tabular text-foreground text-[10px] font-bold">
              X:{Math.round(transform.panX)}% · Y:{Math.round(transform.panY)}%
            </span>
          </div>

          <div className="space-y-1.5 text-[10px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 text-muted-foreground font-bold">X:</span>
              <Slider
                min={-100}
                max={100}
                step={1}
                value={[Math.round(transform.panX)]}
                onValueChange={([v]) => onChange({ panX: clampPan(v ?? 0) })}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 text-muted-foreground font-bold">Y:</span>
              <Slider
                min={-100}
                max={100}
                step={1}
                value={[Math.round(transform.panY)]}
                onValueChange={([v]) => onChange({ panY: clampPan(v ?? 0) })}
                className="flex-1"
              />
            </div>
          </div>

          <div className="pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-[10px] font-mono font-bold touch-manipulation active:scale-95"
              onClick={() => onChange({ panX: 0, panY: 0 })}
              disabled={transform.panX === 0 && transform.panY === 0}
            >
              Center Viewport (0, 0)
            </Button>
          </div>
        </div>

        {/* 3. Rotate & Orientation Controls */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <RotateCw className="size-3.5" /> Rotation
            </span>
            <span className="tabular text-foreground font-bold text-xs">
              {Math.round(normalizeRotation(transform.rotation)) > 0
                ? `+${Math.round(normalizeRotation(transform.rotation))}°`
                : `${Math.round(normalizeRotation(transform.rotation))}°`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Hint label="Rotate 90° CCW">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-9 p-0 touch-manipulation active:scale-95 shrink-0"
                onClick={() => onChange({ rotation: rotateCounterClockwise(transform.rotation) })}
              >
                <RotateCcw className="size-4" />
              </Button>
            </Hint>

            <Slider
              min={-180}
              max={180}
              step={1}
              value={[Math.round(normalizeRotation(transform.rotation))]}
              onValueChange={([v]) => onChange({ rotation: normalizeRotation(v ?? 0) })}
              className="flex-1"
            />

            <Hint label="Rotate 90° CW (R)">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-9 p-0 touch-manipulation active:scale-95 shrink-0"
                onClick={() => onChange({ rotation: rotateClockwise(transform.rotation) })}
              >
                <RotateCw className="size-4" />
              </Button>
            </Hint>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[-180, -90, 90, 180].map((deg) => (
              <Button
                key={deg}
                type="button"
                variant={Math.round(normalizeRotation(transform.rotation)) === deg ? "signal" : "outline"}
                size="sm"
                className="h-7 px-0 text-[10px] font-mono font-bold touch-manipulation active:scale-95"
                onClick={() => onChange({ rotation: deg })}
              >
                {deg > 0 ? `+${deg}°` : `${deg}°`}
              </Button>
            ))}
          </div>
        </div>

        {/* 4. Flip / Mirror Controls */}
        <div className="rounded-[var(--radius-sm)] border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <FlipHorizontal className="size-3.5" /> Flip & Mirror
            </span>
            <span className="text-[10px] text-muted-foreground font-mono font-bold">
              {transform.flipH && transform.flipV
                ? "H+V"
                : transform.flipH
                  ? "H-MIRROR"
                  : transform.flipV
                    ? "V-FLIP"
                    : "NORMAL"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Hint label="Flip Horizontal / Mirror (H)">
              <Button
                type="button"
                variant={transform.flipH ? "signal" : "outline"}
                size="sm"
                className="h-9 text-[11px] font-mono font-bold gap-1.5 touch-manipulation active:scale-95"
                onClick={() => onChange({ flipH: !transform.flipH })}
              >
                <FlipHorizontal className="size-3.5" />
                Flip H
              </Button>
            </Hint>

            <Hint label="Flip Vertical (V)">
              <Button
                type="button"
                variant={transform.flipV ? "signal" : "outline"}
                size="sm"
                className="h-9 text-[11px] font-mono font-bold gap-1.5 touch-manipulation active:scale-95"
                onClick={() => onChange({ flipV: !transform.flipV })}
              >
                <FlipVertical className="size-3.5" />
                Flip V
              </Button>
            </Hint>
          </div>

          <div className="pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-[10px] font-mono font-bold touch-manipulation active:scale-95"
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
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="mb-2 flex items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Crop className="size-3.5 text-signal" />
              Crop / Aspect Framing Presets:
            </Label>
            <span className="font-mono text-xs font-bold text-primary">
              {CROP_PRESETS.find((p) => p.id === transform.cropPreset)?.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ASPECTS.map((asp) => {
              const active = transform.cropPreset === asp.id;
              return (
                <Button
                  key={asp.id}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  onClick={() => onChange({ cropPreset: asp.id })}
                  className="h-8 px-2.5 text-[11px] font-bold font-mono touch-manipulation active:scale-95"
                >
                  {asp.label}
                </Button>
              );
            })}
          </div>

          {/* Custom Width x Height Inputs with Touch Steppers */}
          {transform.cropPreset === "custom" ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3">
              <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Custom Dimensions:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Width stepper */}
                <div className="flex items-center rounded-[var(--radius-sm)] border border-border bg-secondary p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 touch-manipulation"
                    onClick={() => {
                      const cur = transform.customWidth ?? 1920;
                      onChange({ customWidth: Math.max(50, cur - 10) });
                    }}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={50}
                    max={4096}
                    placeholder="Width"
                    value={transform.customWidth ?? ""}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      onChange({ customWidth: Number.isNaN(val) ? undefined : val });
                    }}
                    className="h-7 w-20 border-0 bg-transparent text-center font-mono text-xs font-bold"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 touch-manipulation"
                    onClick={() => {
                      const cur = transform.customWidth ?? 1920;
                      onChange({ customWidth: Math.min(4096, cur + 10) });
                    }}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>

                <span className="text-sm font-bold text-foreground">×</span>

                {/* Height stepper */}
                <div className="flex items-center rounded-[var(--radius-sm)] border border-border bg-secondary p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 touch-manipulation"
                    onClick={() => {
                      const cur = transform.customHeight ?? 1080;
                      onChange({ customHeight: Math.max(50, cur - 10) });
                    }}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={50}
                    max={4096}
                    placeholder="Height"
                    value={transform.customHeight ?? ""}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      onChange({ customHeight: Number.isNaN(val) ? undefined : val });
                    }}
                    className="h-7 w-20 border-0 bg-transparent text-center font-mono text-xs font-bold"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 touch-manipulation"
                    onClick={() => {
                      const cur = transform.customHeight ?? 1080;
                      onChange({ customHeight: Math.min(4096, cur + 10) });
                    }}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>

                <span className="font-mono text-xs text-muted-foreground font-bold">px</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
