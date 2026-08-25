import { useEffect, useRef, useState } from "react";
import { Gauge, Moon, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioVuMeterProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
}

// Convert dB (-60 to +3) to normalized scale (0 to 1)
function dbToNormalized(db: number): number {
  if (db <= -60) return 0;
  if (db >= 3) return 1;
  return (db + 60) / 63;
}

export function AudioVuMeter({ analyserNode, isPlaying, className }: AudioVuMeterProps) {
  // Meter power mode: 'normal' (25fps, 4x stride), 'eco' (15fps, 8x stride), 'off' (100% suspended)
  const [meterPowerMode, setMeterPowerMode] = useState<"normal" | "eco" | "off">("normal");

  const barLRef = useRef<HTMLDivElement>(null);
  const barRRef = useRef<HTMLDivElement>(null);
  const peakLRef = useRef<HTMLDivElement>(null);
  const peakRRef = useRef<HTMLDivElement>(null);
  const textLRef = useRef<HTMLSpanElement>(null);
  const textRRef = useRef<HTMLSpanElement>(null);
  const clipLedRef = useRef<HTMLSpanElement>(null);
  const clipTextRef = useRef<HTMLSpanElement>(null);

  const leftPeakRef = useRef(-60);
  const rightPeakRef = useRef(-60);
  const clipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    const resetDisplay = () => {
      leftPeakRef.current = -60;
      rightPeakRef.current = -60;
      if (barLRef.current) barLRef.current.style.transform = "scaleX(0)";
      if (barRRef.current) barRRef.current.style.transform = "scaleX(0)";
      if (peakLRef.current) peakLRef.current.style.opacity = "0";
      if (peakRRef.current) peakRRef.current.style.opacity = "0";
      if (textLRef.current) textLRef.current.textContent = "L: -∞";
      if (textRRef.current) textRRef.current.textContent = "R: -∞";
      if (clipLedRef.current) {
        clipLedRef.current.className = "size-2 rounded-full border border-red-950 bg-red-950/60";
      }
      if (clipTextRef.current) {
        clipTextRef.current.className = "text-[8px] font-bold text-zinc-600";
      }
    };

    if (!analyserNode || !isPlaying || meterPowerMode === "off") {
      resetDisplay();
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    if (!bufferRef.current || bufferRef.current.length !== bufferLength) {
      bufferRef.current = new Float32Array(new ArrayBuffer(bufferLength * 4));
    }
    const timeDomainData = bufferRef.current;

    let animId: number | null = null;
    let lastFrameTime = 0;

    // Ballistics frame throttle: 25fps (40ms) for normal, 15fps (66ms) for eco mode
    const frameBudgetMs = meterPowerMode === "eco" ? 66.6 : 40.0;
    const stride = meterPowerMode === "eco" ? 8 : 4; // Sub-sample loop iterations

    let isDocumentVisible = !document.hidden;

    const tick = (now: number) => {
      if (!isDocumentVisible) {
        animId = requestAnimationFrame(tick);
        return;
      }

      if (now - lastFrameTime >= frameBudgetMs) {
        lastFrameTime = now;
        analyserNode.getFloatTimeDomainData(timeDomainData);

        // Ultra-light Sub-Sampled RMS & Peak calculation (only 32-64 iterations!)
        let sumSquaresL = 0;
        let peakL = 0;
        let sumSquaresR = 0;
        let peakR = 0;
        let samplesL = 0;
        let samplesR = 0;

        for (let i = 0; i < bufferLength; i += stride) {
          const val = timeDomainData[i] ?? 0;
          const absVal = Math.abs(val);

          if ((i & 1) === 0) {
            sumSquaresL += val * val;
            if (absVal > peakL) peakL = absVal;
            samplesL++;
          } else {
            sumSquaresR += val * val;
            if (absVal > peakR) peakR = absVal;
            samplesR++;
          }
        }

        const rmsL = Math.sqrt(sumSquaresL / (samplesL || 1));
        const rmsR = Math.sqrt(sumSquaresR / (samplesR || 1));

        // Convert to dB (-60 dB floor)
        const currentDbL = rmsL > 0.0001 ? Math.max(-60, 20 * Math.log10(rmsL * 1.6)) : -60;
        const currentDbR = rmsR > 0.0001 ? Math.max(-60, 20 * Math.log10(rmsR * 1.6)) : -60;

        // Peak Hold with Decay (decay adjusted for 25/15 fps)
        const decayRate = meterPowerMode === "eco" ? 1.5 : 1.0;
        if (currentDbL > leftPeakRef.current) {
          leftPeakRef.current = currentDbL;
        } else {
          leftPeakRef.current = Math.max(-60, leftPeakRef.current - decayRate);
        }

        if (currentDbR > rightPeakRef.current) {
          rightPeakRef.current = currentDbR;
        } else {
          rightPeakRef.current = Math.max(-60, rightPeakRef.current - decayRate);
        }

        // Clipping Detection
        if (peakL >= 0.99 || peakR >= 0.99) {
          if (clipLedRef.current) {
            clipLedRef.current.className = "size-2 rounded-full border border-red-950 bg-red-500 shadow-[0_0_6px_#ef4444]";
          }
          if (clipTextRef.current) {
            clipTextRef.current.className = "text-[8px] font-bold text-red-400";
          }
          if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
          clipTimeoutRef.current = setTimeout(() => {
            if (clipLedRef.current) {
              clipLedRef.current.className = "size-2 rounded-full border border-red-950 bg-red-950/60";
            }
            if (clipTextRef.current) {
              clipTextRef.current.className = "text-[8px] font-bold text-zinc-600";
            }
          }, 800);
        }

        // Direct GPU-accelerated DOM transforms (zero React re-render overhead)
        const normL = dbToNormalized(currentDbL);
        const normR = dbToNormalized(currentDbR);
        const normPeakL = dbToNormalized(leftPeakRef.current);
        const normPeakR = dbToNormalized(rightPeakRef.current);

        if (barLRef.current) {
          barLRef.current.style.transform = `scaleX(${normL.toFixed(3)})`;
        }
        if (barRRef.current) {
          barRRef.current.style.transform = `scaleX(${normR.toFixed(3)})`;
        }

        if (peakLRef.current) {
          if (normPeakL > 0.01) {
            peakLRef.current.style.opacity = "1";
            peakLRef.current.style.left = `${Math.min(99, normPeakL * 100).toFixed(1)}%`;
          } else {
            peakLRef.current.style.opacity = "0";
          }
        }

        if (peakRRef.current) {
          if (normPeakR > 0.01) {
            peakRRef.current.style.opacity = "1";
            peakRRef.current.style.left = `${Math.min(99, normPeakR * 100).toFixed(1)}%`;
          } else {
            peakRRef.current.style.opacity = "0";
          }
        }

        if (textLRef.current) {
          textLRef.current.textContent = currentDbL > -59 ? `L: ${currentDbL.toFixed(1)}dB` : "L: -∞";
        }
        if (textRRef.current) {
          textRRef.current.textContent = currentDbR > -59 ? `R: ${currentDbR.toFixed(1)}dB` : "R: -∞";
        }
      }

      animId = requestAnimationFrame(tick);
    };

    const handleVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    animId = requestAnimationFrame(tick);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resetDisplay();
    };
  }, [analyserNode, isPlaying, meterPowerMode]);

  const cyclePowerMode = () => {
    if (meterPowerMode === "normal") setMeterPowerMode("eco");
    else if (meterPowerMode === "eco") setMeterPowerMode("off");
    else setMeterPowerMode("normal");
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-sm border border-border/80 bg-black/90 p-1.5 font-mono text-[9px] shadow-inner",
        className,
      )}
    >
      {/* VU Meter Header */}
      <div className="flex items-center justify-between px-0.5 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-bold tracking-widest text-[8px] uppercase text-zinc-400">VU LEVEL</span>
          {/* One-tap Power/Eco Mode Switch */}
          <button
            type="button"
            onClick={cyclePowerMode}
            className={cn(
              "flex items-center gap-0.5 rounded px-1 py-0.2 text-[7px] font-bold uppercase transition-colors",
              meterPowerMode === "normal" && "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
              meterPowerMode === "eco" && "bg-emerald-950 text-emerald-400 border border-emerald-800",
              meterPowerMode === "off" && "bg-amber-950 text-amber-400 border border-amber-800",
            )}
            title="Cycle VU Meter power mode: Normal (25fps) -> Eco (15fps) -> Sleep (0% CPU)"
          >
            {meterPowerMode === "normal" && <Gauge className="size-2" />}
            {meterPowerMode === "eco" && <Zap className="size-2" />}
            {meterPowerMode === "off" && <Moon className="size-2" />}
            <span>{meterPowerMode === "normal" ? "25fps" : meterPowerMode === "eco" ? "ECO" : "SLEEP"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span ref={textLRef} className="text-[8px] text-zinc-500">
            L: -∞
          </span>
          <span ref={textRRef} className="text-[8px] text-zinc-500">
            R: -∞
          </span>
          {/* CLIP LED */}
          <div className="flex items-center gap-1">
            <span
              ref={clipLedRef}
              className="size-2 rounded-full border border-red-950 bg-red-950/60"
            />
            <span ref={clipTextRef} className="text-[8px] font-bold text-zinc-600">
              CLIP
            </span>
          </div>
        </div>
      </div>

      {/* Scale markers */}
      <div className="relative flex justify-between px-6 text-[7px] text-zinc-500 select-none">
        <span>-60</span>
        <span>-40</span>
        <span>-20</span>
        <span>-12</span>
        <span>-6</span>
        <span>0</span>
        <span className="text-red-500 font-bold">+3</span>
      </div>

      {/* Channel L */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-center font-bold text-zinc-400">L</span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-xs bg-zinc-900/90 border border-zinc-800">
          <div
            ref={barLRef}
            className="h-full w-full will-change-transform"
            style={{
              transformOrigin: "left",
              transform: "scaleX(0)",
              background: "linear-gradient(90deg, #10b981 0%, #22c55e 65%, #eab308 82%, #ef4444 95%)",
            }}
          />
          <div
            ref={peakLRef}
            className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_2px_#fff] opacity-0 will-change-transform"
          />
        </div>
      </div>

      {/* Channel R */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-center font-bold text-zinc-400">R</span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-xs bg-zinc-900/90 border border-zinc-800">
          <div
            ref={barRRef}
            className="h-full w-full will-change-transform"
            style={{
              transformOrigin: "left",
              transform: "scaleX(0)",
              background: "linear-gradient(90deg, #10b981 0%, #22c55e 65%, #eab308 82%, #ef4444 95%)",
            }}
          />
          <div
            ref={peakRRef}
            className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_2px_#fff] opacity-0 will-change-transform"
          />
        </div>
      </div>
    </div>
  );
}
