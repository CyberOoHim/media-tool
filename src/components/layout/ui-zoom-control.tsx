import { Minus, Plus, RotateCcw, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_PRESETS,
  useUiZoom,
} from "@/lib/ui-zoom";
import { cn } from "@/lib/utils";

export function UiZoomControl({ className }: { className?: string }) {
  const zoom = useUiZoom((s) => s.zoom);
  const zoomIn = useUiZoom((s) => s.zoomIn);
  const zoomOut = useUiZoom((s) => s.zoomOut);
  const resetZoom = useUiZoom((s) => s.resetZoom);
  const setZoom = useUiZoom((s) => s.setZoom);

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayZoom = mounted ? zoom : ZOOM_DEFAULT;
  const isDefault = displayZoom === ZOOM_DEFAULT;
  const canZoomOut = displayZoom > ZOOM_MIN;
  const canZoomIn = displayZoom < ZOOM_MAX;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/80 p-0.5 font-mono shadow-[1px_1px_0px_var(--color-border)]",
        className,
      )}
    >
      {/* Zoom Out Button (-) */}
      <Hint label="Zoom out / Smaller text (-)" side="bottom">
        <button
          type="button"
          onClick={() => zoomOut(true)}
          disabled={!canZoomOut}
          aria-label="Decrease UI font size (-)"
          className="grid size-6 place-items-center rounded-xs border border-transparent text-foreground transition-all hover:border-border hover:bg-card hover:shadow-[1px_1px_0px_var(--color-border)] active:translate-x-[1px] active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus className="size-3.5" />
        </button>
      </Hint>

      {/* Center Interactive Zoom Badge & Settings Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <Hint label="UI text zoom presets & fine slider (0 to reset)" side="bottom">
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                isDefault
                  ? "border-transparent text-foreground hover:border-border hover:bg-card hover:shadow-[1px_1px_0px_var(--color-border)]"
                  : "border-border bg-signal text-foreground shadow-[1px_1px_0px_var(--color-border)] hover:brightness-105",
              )}
              aria-label={`UI Zoom level: ${displayZoom}%. Click for controls.`}
            >
              <Type className="size-3 shrink-0 text-muted-foreground" />
              <span className="tabular min-w-[3ch] text-center">{displayZoom}%</span>
            </button>
          </PopoverTrigger>
        </Hint>

        <PopoverContent align="center" className="w-80 p-3">
          {/* Popover Header */}
          <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-1.5">
              <Type className="size-3.5 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                UI Font Size & Zoom
              </span>
            </div>
            <span className="rounded-xs border border-border bg-signal px-1.5 py-0.2 font-mono text-[10px] font-bold text-foreground">
              {displayZoom}%
            </span>
          </div>

          {/* Slider Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase text-muted-foreground">
              <span>Scale Range</span>
              <span>
                {ZOOM_MIN}% – {ZOOM_MAX}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => zoomOut(true)}
                disabled={!canZoomOut}
                aria-label="Zoom out"
                className="grid size-6 shrink-0 place-items-center rounded border border-border bg-card hover:bg-secondary disabled:opacity-40"
              >
                <Minus className="size-3" />
              </button>

              <Slider
                value={[displayZoom]}
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={5}
                onValueChange={([val]) => setZoom(val, false)}
                className="flex-1"
                aria-label="UI Font Scale Slider"
              />

              <button
                type="button"
                onClick={() => zoomIn(true)}
                disabled={!canZoomIn}
                aria-label="Zoom in"
                className="grid size-6 shrink-0 place-items-center rounded border border-border bg-card hover:bg-secondary disabled:opacity-40"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          {/* Quick Presets Grid */}
          <div className="mt-4">
            <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick Sizes (Expanded Range)
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {ZOOM_PRESETS.map((p) => {
                const active = displayZoom === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setZoom(p.value, true);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xs border py-1 font-mono transition-all text-center",
                      active
                        ? "border-border bg-primary font-bold text-primary-foreground shadow-[1px_1px_0px_var(--color-border)]"
                        : "border-border/60 bg-secondary/50 text-foreground hover:border-border hover:bg-card",
                    )}
                  >
                    <span className="text-[11px] font-bold">{p.label}</span>
                    <span
                      className={cn(
                        "text-[8px] uppercase tracking-wider",
                        active ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer with Reset & Shortcuts note */}
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>Keys:</span>
              <kbd className="rounded border border-border bg-secondary px-1 py-0.2 font-bold text-foreground">
                +
              </kbd>
              <kbd className="rounded border border-border bg-secondary px-1 py-0.2 font-bold text-foreground">
                -
              </kbd>
              <kbd className="rounded border border-border bg-secondary px-1 py-0.2 font-bold text-foreground">
                0
              </kbd>
            </div>

            <Button
              variant={isDefault ? "outline" : "signal"}
              size="sm"
              onClick={() => resetZoom(true)}
              disabled={isDefault}
              className="h-6 px-2 text-[10px]"
            >
              <RotateCcw className="size-3 mr-1" />
              Reset (100%)
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Zoom In Button (+) */}
      <Hint label="Zoom in / Larger text (+)" side="bottom">
        <button
          type="button"
          onClick={() => zoomIn(true)}
          disabled={!canZoomIn}
          aria-label="Increase UI font size (+)"
          className="grid size-6 place-items-center rounded-xs border border-transparent text-foreground transition-all hover:border-border hover:bg-card hover:shadow-[1px_1px_0px_var(--color-border)] active:translate-x-[1px] active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </Hint>
    </div>
  );
}
