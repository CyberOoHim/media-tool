import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Disc,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface JogDialProps {
  onStepFrame: (frames: number) => void;
  disabled?: boolean;
}

export function JogDial({ onStepFrame, disabled = false }: JogDialProps) {
  const [activeDrag, setActiveDrag] = useState(false);
  const [accumulatedOffset, setAccumulatedOffset] = useState(0);
  const lastTouchXRef = useRef<number | null>(null);
  const touchRemainderRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length === 0) return;
    setActiveDrag(true);
    lastTouchXRef.current = e.touches[0]!.clientX;
    touchRemainderRef.current = 0;
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled || !activeDrag || lastTouchXRef.current === null || e.touches.length === 0)
        return;
      const currentX = e.touches[0]!.clientX;
      const deltaX = currentX - lastTouchXRef.current;
      lastTouchXRef.current = currentX;

      // Update visual wheel tick offset
      setAccumulatedOffset((prev) => (prev + deltaX) % 360);

      // Sensitivity: every 8px of finger movement = 1 video frame step
      const stepPixelThreshold = 8;
      const totalDelta = deltaX + touchRemainderRef.current;
      const frames = Math.trunc(totalDelta / stepPixelThreshold);
      touchRemainderRef.current = totalDelta % stepPixelThreshold;

      if (frames !== 0) {
        onStepFrame(frames);
      }
    },
    [activeDrag, disabled, onStepFrame],
  );

  const handleTouchEnd = () => {
    setActiveDrag(false);
    lastTouchXRef.current = null;
    touchRemainderRef.current = 0;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2.5 rounded-[var(--radius-sm)] border-2 border-border bg-card p-2.5 shadow-[2px_2px_0px_var(--color-border)] select-none">
      {/* Title & Quick Steppers Left */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Disc className={cn("size-4 text-signal", activeDrag && "animate-spin text-primary")} />
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          Touch Jog Wheel:
        </span>
      </div>

      {/* Frame Stepping Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <Hint label="Rewind 5 Frames">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onStepFrame(-5)}
            className="h-8 px-2 text-[10px] font-mono font-bold touch-manipulation active:scale-95"
          >
            <ChevronsLeft className="size-3 mr-0.5" /> -5F
          </Button>
        </Hint>

        <Hint label="Previous 1 Frame (,)">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onStepFrame(-1)}
            className="h-8 px-2.5 text-[11px] font-mono font-bold touch-manipulation active:scale-95"
          >
            <ChevronLeft className="size-3.5 mr-0.5" /> -1F
          </Button>
        </Hint>
      </div>

      {/* Interactive Touch Swipe Wheel Ribbon */}
      <div
        className={cn(
          "relative flex h-10 flex-1 w-full min-w-[140px] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-secondary cursor-ew-resize touch-none select-none transition-colors",
          activeDrag
            ? "border-signal bg-signal/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
            : "hover:border-foreground/60",
          disabled && "pointer-events-none opacity-40",
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={(e) => {
          if (disabled) return;
          setActiveDrag(true);
          let lastX = e.clientX;
          let remainder = 0;

          const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - lastX;
            lastX = moveEvent.clientX;
            setAccumulatedOffset((prev) => (prev + deltaX) % 360);

            const total = deltaX + remainder;
            const frames = Math.trunc(total / 8);
            remainder = total % 8;
            if (frames !== 0) {
              onStepFrame(frames);
            }
          };

          const onMouseUp = () => {
            setActiveDrag(false);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          };

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        }}
      >
        {/* Repeating Vertical Tick Ruler Marks */}
        <div
          className="pointer-events-none absolute inset-y-0 flex items-center gap-2 will-change-transform"
          style={{
            transform: `translateX(${accumulatedOffset % 24}px)`,
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-[2px] rounded-full transition-opacity",
                i % 5 === 0
                  ? "h-6 bg-signal opacity-90"
                  : "h-3.5 bg-muted-foreground/60 opacity-60",
              )}
            />
          ))}
        </div>

        {/* Center Target Indicator Needle */}
        <div className="pointer-events-none absolute inset-y-1 w-1 rounded-full bg-primary z-10 shadow-[0_0_6px_rgba(74,122,209,0.8)]" />

        {/* Touch HUD Caption */}
        <span className="pointer-events-none absolute bottom-0.5 right-1.5 font-mono text-[8px] font-bold uppercase text-muted-foreground tracking-wider opacity-70">
          {activeDrag ? "SCRUBBING FRAMES" : "SWIPE TO JOG"}
        </span>
      </div>

      {/* Frame Stepping Buttons Right */}
      <div className="flex items-center gap-1 shrink-0">
        <Hint label="Next 1 Frame (.)">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onStepFrame(1)}
            className="h-8 px-2.5 text-[11px] font-mono font-bold touch-manipulation active:scale-95"
          >
            +1F <ChevronRight className="size-3.5 ml-0.5" />
          </Button>
        </Hint>

        <Hint label="Forward 5 Frames">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onStepFrame(5)}
            className="h-8 px-2 text-[10px] font-mono font-bold touch-manipulation active:scale-95"
          >
            +5F <ChevronsRight className="size-3 ml-0.5" />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
