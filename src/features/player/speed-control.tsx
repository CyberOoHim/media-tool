import {
  Gauge,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_SLIDER_MAX,
  SPEED_PRESETS,
  clampRate,
  nudgeRate,
} from "./rates";

export interface SpeedControlProps {
  rate: number;
  onRateChange: (rate: number) => void;
  disabled?: boolean;
  pitchPreserve?: boolean;
  onPitchPreserveChange?: (preserve: boolean) => void;
  className?: string;
  variant?: "transport" | "full" | "chips";
}

export function SpeedControl({
  rate,
  onRateChange,
  disabled = false,
  pitchPreserve = true,
  onPitchPreserveChange,
  className,
  variant = "transport",
}: SpeedControlProps) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState(String(rate));

  // Sync custom input with active rate
  useEffect(() => {
    setCustomInput(String(rate));
  }, [rate]);

  const handleCustomSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = Number.parseFloat(customInput);
    if (!Number.isNaN(val)) {
      const clamped = clampRate(val);
      onRateChange(clamped);
      setCustomInput(String(clamped));
    } else {
      setCustomInput(String(rate));
    }
  };

  const isDefaultRate = Math.abs(rate - 1.0) < 0.001;

  if (variant === "chips") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {SPEED_PRESETS.map((p) => {
          const isSelected = Math.abs(rate - p.value) < 0.001;
          return (
            <Button
              key={p.value}
              size="sm"
              variant={isSelected ? "signal" : "outline"}
              disabled={disabled}
              onClick={() => onRateChange(p.value)}
              className="h-8 min-w-10 px-2 text-xs font-bold font-mono touch-manipulation active:scale-95"
            >
              {p.label}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <Hint
          label={`Deck Speed: ${rate}× ${!isDefaultRate ? "(Modified)" : ""} • Click for fine options`}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={!isDefaultRate ? "signal" : "outline"}
              size="sm"
              disabled={disabled}
              className={cn(
                "h-9 min-w-14 px-2 gap-1.5 font-mono text-xs font-bold touch-manipulation active:scale-95",
                !isDefaultRate
                  ? "border-signal bg-signal text-foreground shadow-[1px_1px_0px_var(--color-border)]"
                  : "border-border",
              )}
              aria-label={`Playback speed: ${rate}x. Click to open fine speed options.`}
            >
              <Gauge className="size-3.5 shrink-0 text-primary" />
              <span className="tabular">{rate}×</span>
            </Button>
          </PopoverTrigger>
        </Hint>

        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-80 sm:w-[350px] p-3.5 border-2 border-border bg-card shadow-[5px_5px_0px_var(--color-border)] font-mono focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-xs border border-border bg-primary/10 text-primary">
                <Gauge className="size-3.5" />
              </div>
              <div>
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground leading-none">
                  Playback Speed
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Fine-grained deck rate calibration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge
                variant={!isDefaultRate ? "signal" : "outline"}
                className="font-mono text-[11px] font-bold px-1.5 py-0.5"
              >
                {rate}×
              </Badge>
              <Hint label="Reset speed to 1.0× Normal">
                <Button
                  type="button"
                  variant={isDefaultRate ? "outline" : "signal"}
                  size="sm"
                  disabled={disabled || isDefaultRate}
                  onClick={() => onRateChange(1.0)}
                  className="h-6 px-2 text-[10px] font-mono gap-1"
                >
                  <RotateCcw className="size-3" />
                  1.0×
                </Button>
              </Hint>
            </div>
          </div>

          {/* Section 1: Fine Slider with Step Nudge Buttons */}
          <div className="space-y-2 mb-3.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
              <span className="flex items-center gap-1">
                <SlidersHorizontal className="size-3" /> Fine Slider Range
              </span>
              <span>
                {PLAYBACK_RATE_MIN}× – {PLAYBACK_RATE_SLIDER_MAX}×
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Hint label="Nudge -0.05×">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || rate <= PLAYBACK_RATE_MIN}
                  onClick={() => onRateChange(nudgeRate(rate, -0.05))}
                  className="size-7 p-0 shrink-0 touch-manipulation active:scale-95"
                >
                  <Minus className="size-3" />
                </Button>
              </Hint>

              <Slider
                value={[Math.min(PLAYBACK_RATE_SLIDER_MAX, Math.max(PLAYBACK_RATE_MIN, rate))]}
                min={PLAYBACK_RATE_MIN}
                max={PLAYBACK_RATE_SLIDER_MAX}
                step={0.05}
                disabled={disabled}
                onValueChange={([val]) => {
                  if (val !== undefined) {
                    onRateChange(clampRate(val));
                  }
                }}
                className="flex-1"
                aria-label="Playback speed slider"
              />

              <Hint label="Nudge +0.05×">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || rate >= PLAYBACK_RATE_MAX}
                  onClick={() => onRateChange(nudgeRate(rate, 0.05))}
                  className="size-7 p-0 shrink-0 touch-manipulation active:scale-95"
                >
                  <Plus className="size-3" />
                </Button>
              </Hint>
            </div>

            <div className="flex justify-between px-0.5 text-[9px] font-mono text-muted-foreground/80">
              <button
                type="button"
                onClick={() => onRateChange(0.25)}
                className="hover:text-foreground transition-colors"
              >
                0.25×
              </button>
              <button
                type="button"
                onClick={() => onRateChange(0.5)}
                className="hover:text-foreground transition-colors"
              >
                0.5×
              </button>
              <button
                type="button"
                onClick={() => onRateChange(1.0)}
                className={cn(
                  "hover:text-foreground transition-colors font-bold",
                  isDefaultRate && "text-foreground",
                )}
              >
                1.0× (Norm)
              </button>
              <button
                type="button"
                onClick={() => onRateChange(1.5)}
                className="hover:text-foreground transition-colors"
              >
                1.5×
              </button>
              <button
                type="button"
                onClick={() => onRateChange(2.0)}
                className="hover:text-foreground transition-colors"
              >
                2.0×
              </button>
              <button
                type="button"
                onClick={() => onRateChange(4.0)}
                className="hover:text-foreground transition-colors"
              >
                4.0×
              </button>
            </div>
          </div>

          {/* Section 2: Direct Custom Speed Input */}
          <div className="mb-3.5 rounded-[var(--radius-sm)] border border-border/70 bg-secondary/40 p-2">
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
              <div className="flex-1">
                <label
                  htmlFor="custom-speed-input"
                  className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Custom Exact Rate ({PLAYBACK_RATE_MIN}× – {PLAYBACK_RATE_MAX}×):
                </label>
                <div className="relative flex items-center">
                  <Input
                    id="custom-speed-input"
                    type="number"
                    step="0.01"
                    min={PLAYBACK_RATE_MIN}
                    max={PLAYBACK_RATE_MAX}
                    value={customInput}
                    disabled={disabled}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onBlur={() => handleCustomSubmit()}
                    placeholder="1.0"
                    className="h-7 text-xs font-mono font-bold pr-7 bg-card"
                  />
                  <span className="absolute right-2.5 text-xs text-muted-foreground font-bold pointer-events-none">
                    ×
                  </span>
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={disabled}
                className="h-7 self-end px-3 text-[11px] font-bold font-mono touch-manipulation active:scale-95"
              >
                Apply
              </Button>
            </form>

            <div className="mt-1.5 flex items-center justify-between gap-1 text-[9px]">
              <span className="text-muted-foreground">Quick Nudges:</span>
              <div className="flex items-center gap-1">
                {[-0.25, -0.1, 0.1, 0.25].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    disabled={disabled}
                    onClick={() => onRateChange(nudgeRate(rate, delta))}
                    className="rounded-xs border border-border bg-card px-1 py-0.5 font-mono text-[9px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {delta > 0 ? `+${delta}` : delta}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Fine-Grained Presets Grid */}
          <div className="space-y-1.5 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Rate Presets (Slow-Mo to Turbo)
            </p>

            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {SPEED_PRESETS.map((p) => {
                const isSelected = Math.abs(rate - p.value) < 0.001;
                return (
                  <button
                    key={p.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onRateChange(p.value)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xs border py-1 font-mono transition-all text-center touch-manipulation active:scale-95",
                      isSelected
                        ? "border-border bg-primary font-bold text-primary-foreground shadow-[1px_1px_0px_var(--color-border)]"
                        : "border-border/60 bg-secondary/50 text-foreground hover:border-border hover:bg-card",
                    )}
                  >
                    <span className="text-[10px] font-bold">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Pitch Lock / Audio Tone Toggle */}
          {onPitchPreserveChange ? (
            <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border/50 bg-secondary/30 px-2.5 py-1.5 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Volume2 className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-bold text-foreground">
                  Preserve Audio Pitch
                </span>
              </div>
              <Switch
                checked={pitchPreserve}
                disabled={disabled}
                onCheckedChange={onPitchPreserveChange}
                className="scale-75"
              />
            </div>
          ) : null}

          {/* Footer Keyboard Shortcut Notes */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>Deck Keys:</span>
              <kbd className="rounded border border-border bg-secondary px-1 py-0.2 font-bold text-foreground">
                [
              </kbd>
              <kbd className="rounded border border-border bg-secondary px-1 py-0.2 font-bold text-foreground">
                ]
              </kbd>
              <span className="text-[9px] text-muted-foreground/80">(Shift for ±0.05×)</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-5 px-1.5 text-[10px] hover:bg-secondary"
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
