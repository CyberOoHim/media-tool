import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioVuMeterProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
}

export function AudioVuMeter({ analyserNode, isPlaying, className }: AudioVuMeterProps) {
  const [leftDb, setLeftDb] = useState(-60);
  const [rightDb, setRightDb] = useState(-60);
  const [leftPeak, setLeftPeak] = useState(-60);
  const [rightPeak, setRightPeak] = useState(-60);
  const [clipped, setClipped] = useState(false);

  const leftPeakRef = useRef(-60);
  const rightPeakRef = useRef(-60);
  const clipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!analyserNode || !isPlaying) {
      setLeftDb(-60);
      setRightDb(-60);
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const timeDomainData = new Float32Array(bufferLength);
    let animId: number;

    const tick = () => {
      analyserNode.getFloatTimeDomainData(timeDomainData);

      // Calculate RMS and Peak for Left / Mono
      let sumSquaresL = 0;
      let peakL = 0;
      let sumSquaresR = 0;
      let peakR = 0;

      for (let i = 0; i < bufferLength; i++) {
        const val = timeDomainData[i] ?? 0;
        const absVal = Math.abs(val);

        // Simulate stereo split with slight phase variation
        if (i % 2 === 0) {
          sumSquaresL += val * val;
          if (absVal > peakL) peakL = absVal;
        } else {
          sumSquaresR += val * val;
          if (absVal > peakR) peakR = absVal;
        }
      }

      const rmsL = Math.sqrt(sumSquaresL / (bufferLength / 2));
      const rmsR = Math.sqrt(sumSquaresR / (bufferLength / 2));

      // Convert to dB (-60 dB floor)
      const currentDbL = rmsL > 0.0001 ? Math.max(-60, 20 * Math.log10(rmsL * 1.6)) : -60;
      const currentDbR = rmsR > 0.0001 ? Math.max(-60, 20 * Math.log10(rmsR * 1.6)) : -60;

      // Peak Hold with Decay
      if (currentDbL > leftPeakRef.current) {
        leftPeakRef.current = currentDbL;
      } else {
        leftPeakRef.current = Math.max(-60, leftPeakRef.current - 0.5);
      }

      if (currentDbR > rightPeakRef.current) {
        rightPeakRef.current = currentDbR;
      } else {
        rightPeakRef.current = Math.max(-60, rightPeakRef.current - 0.5);
      }

      if (peakL >= 0.99 || peakR >= 0.99) {
        setClipped(true);
        if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
        clipTimeoutRef.current = setTimeout(() => setClipped(false), 800);
      }

      setLeftDb(currentDbL);
      setRightDb(currentDbR);
      setLeftPeak(leftPeakRef.current);
      setRightPeak(rightPeakRef.current);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
    };
  }, [analyserNode, isPlaying]);

  // Convert dB (-60 to +3) to percentage (0% to 100%)
  const dbToPercent = (db: number) => {
    if (db <= -60) return 0;
    if (db >= 3) return 100;
    return ((db + 60) / 63) * 100;
  };

  const lPercent = dbToPercent(leftDb);
  const rPercent = dbToPercent(rightDb);
  const lPeakPercent = dbToPercent(leftPeak);
  const rPeakPercent = dbToPercent(rightPeak);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-sm border border-border/80 bg-black/90 p-1.5 font-mono text-[9px] shadow-inner",
        className,
      )}
    >
      {/* VU Meter Header */}
      <div className="flex items-center justify-between px-0.5 text-muted-foreground">
        <span className="font-bold tracking-widest text-[8px] uppercase text-zinc-400">VU LEVEL</span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-zinc-500">
            L: {leftDb > -59 ? `${leftDb.toFixed(1)}dB` : "-∞"}
          </span>
          <span className="text-[8px] text-zinc-500">
            R: {rightDb > -59 ? `${rightDb.toFixed(1)}dB` : "-∞"}
          </span>
          {/* CLIP LED */}
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "size-2 rounded-full border border-red-950 transition-colors",
                clipped ? "bg-red-500 shadow-[0_0_6px_#ef4444]" : "bg-red-950/60",
              )}
            />
            <span className={cn("text-[8px] font-bold", clipped ? "text-red-400" : "text-zinc-600")}>
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
          {/* Segment Gradient Background Bar */}
          <div
            className="h-full transition-all duration-75 ease-out"
            style={{
              width: `${lPercent}%`,
              background: "linear-gradient(90deg, #10b981 0%, #22c55e 65%, #eab308 82%, #ef4444 95%)",
            }}
          />
          {/* Peak Hold Tick */}
          {lPeakPercent > 0 && (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_2px_#fff]"
              style={{ left: `${Math.min(99, lPeakPercent)}%` }}
            />
          )}
        </div>
      </div>

      {/* Channel R */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-center font-bold text-zinc-400">R</span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-xs bg-zinc-900/90 border border-zinc-800">
          <div
            className="h-full transition-all duration-75 ease-out"
            style={{
              width: `${rPercent}%`,
              background: "linear-gradient(90deg, #10b981 0%, #22c55e 65%, #eab308 82%, #ef4444 95%)",
            }}
          />
          {/* Peak Hold Tick */}
          {rPeakPercent > 0 && (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_2px_#fff]"
              style={{ left: `${Math.min(99, rPeakPercent)}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
