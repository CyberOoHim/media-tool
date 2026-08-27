import {
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAudioStore } from "./store";
import type { EqBands } from "./types";

const EQ_BAND_INFO: { key: keyof EqBands; label: string; freq: string; desc: string }[] = [
  { key: "low80Hz", label: "LOW", freq: "80 Hz", desc: "Sub-bass & punch" },
  { key: "lowMid300Hz", label: "LO-MID", freq: "300 Hz", desc: "Body & warmth" },
  { key: "mid1kHz", label: "MID", freq: "1.0 kHz", desc: "Clarity & vocal presence" },
  { key: "highMid3kHz", label: "HI-MID", freq: "3.5 kHz", desc: "Bite & crisp attack" },
  { key: "high10kHz", label: "HIGH", freq: "10.0 kHz", desc: "Air & brilliance" },
];

export function AudioDspControls() {
  const eq = useAudioStore((s) => s.eq);
  const eqBypass = useAudioStore((s) => s.eqBypass);
  const lowCut = useAudioStore((s) => s.lowCut);
  const highCut = useAudioStore((s) => s.highCut);
  const dynamics = useAudioStore((s) => s.dynamics);
  const dynamicsBypass = useAudioStore((s) => s.dynamicsBypass);
  const gainBoost = useAudioStore((s) => s.gainBoost);
  const pan = useAudioStore((s) => s.pan);
  const invertPhase = useAudioStore((s) => s.invertPhase);
  const monoSum = useAudioStore((s) => s.monoSum);

  const setEqBand = useAudioStore((s) => s.setEqBand);
  const setEqBypass = useAudioStore((s) => s.setEqBypass);
  const resetEq = useAudioStore((s) => s.resetEq);
  const setLowCut = useAudioStore((s) => s.setLowCut);
  const setHighCut = useAudioStore((s) => s.setHighCut);
  const setDynamics = useAudioStore((s) => s.setDynamics);
  const setDynamicsBypass = useAudioStore((s) => s.setDynamicsBypass);
  const setGainBoost = useAudioStore((s) => s.setGainBoost);
  const setPan = useAudioStore((s) => s.setPan);
  const setInvertPhase = useAudioStore((s) => s.setInvertPhase);
  const setMonoSum = useAudioStore((s) => s.setMonoSum);
  const resetAllDsp = useAudioStore((s) => s.resetAllDsp);

  return (
    <div className="flex flex-col gap-4 text-xs font-mono">
      {/* 1. 5-Band Graphic Equalizer Section */}
      <div className="rounded-sm border border-border bg-card/60 p-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              1. 5-Band Graphic Studio Equalizer
            </span>
            {eqBypass && (
              <Badge variant="outline" className="border-amber-600 text-amber-500 text-[9px] py-0">
                BYPASS
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
              <Switch checked={!eqBypass} onCheckedChange={(v) => setEqBypass(!v)} className="scale-75" />
              <span>{eqBypass ? "Enable EQ" : "Active"}</span>
            </label>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[9px]"
              onClick={resetEq}
              title="Reset EQ bands to 0 dB"
            >
              Reset 0dB
            </Button>
          </div>
        </div>

        {/* 5 Vertical/Horizontal Sliders for EQ Bands */}
        <div className="mt-3 grid grid-cols-5 gap-2 sm:gap-4">
          {EQ_BAND_INFO.map((band) => {
            const val = eq[band.key];
            const isPositive = val > 0;
            const isNegative = val < 0;

            return (
              <div
                key={band.key}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-sm border p-2 text-center transition-colors",
                  eqBypass
                    ? "border-border/40 bg-secondary/20 opacity-60"
                    : "border-border bg-secondary/50",
                )}
              >
                <span className="text-[10px] font-bold text-foreground">{band.label}</span>
                <span className="text-[9px] text-muted-foreground">{band.freq}</span>

                {/* Slider */}
                <div className="flex h-28 w-full items-center justify-center py-1">
                  <Slider
                    orientation="vertical"
                    value={[val]}
                    min={-12}
                    max={12}
                    step={0.5}
                    disabled={eqBypass}
                    onValueChange={([v]) => setEqBand(band.key, v ?? 0)}
                    className="h-full"
                  />
                </div>

                {/* dB Readout */}
                <span
                  className={cn(
                    "rounded-xs px-1 py-0.2 text-[10px] font-bold",
                    isPositive && "bg-emerald-950/80 text-emerald-400 border border-emerald-800",
                    isNegative && "bg-amber-950/80 text-amber-400 border border-amber-800",
                    val === 0 && "text-muted-foreground",
                  )}
                >
                  {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)} dB
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Low-Cut, High-Cut Filters & Tone Shaping */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Low-Cut (High-Pass Filter) */}
        <div className="flex flex-col gap-2 rounded-sm border border-border bg-card/60 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Low-Cut Filter (High Pass)
            </span>
            <Switch
              checked={lowCut.enabled}
              onCheckedChange={(v) => setLowCut({ enabled: v })}
              className="scale-75"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Removes sub-bass rumble, microphone handling noise, and AC hum.
          </p>
          <div className="mt-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span>Cutoff Frequency:</span>
              <span className="font-bold text-foreground">{lowCut.frequency} Hz</span>
            </div>
            <Slider
              value={[lowCut.frequency]}
              min={20}
              max={400}
              step={5}
              disabled={!lowCut.enabled}
              onValueChange={([v]) => setLowCut({ frequency: v ?? 80 })}
            />
          </div>
        </div>

        {/* High-Cut (Low-Pass Filter) */}
        <div className="flex flex-col gap-2 rounded-sm border border-border bg-card/60 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              High-Cut Filter (Low Pass)
            </span>
            <Switch
              checked={highCut.enabled}
              onCheckedChange={(v) => setHighCut({ enabled: v })}
              className="scale-75"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Tames harsh high frequencies, tape hiss, and sibilance.
          </p>
          <div className="mt-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span>Cutoff Frequency:</span>
              <span className="font-bold text-foreground">
                {(highCut.frequency / 1000).toFixed(1)} kHz
              </span>
            </div>
            <Slider
              value={[highCut.frequency]}
              min={2000}
              max={20000}
              step={100}
              disabled={!highCut.enabled}
              onValueChange={([v]) => setHighCut({ frequency: v ?? 12000 })}
            />
          </div>
        </div>
      </div>

      {/* 3. Dynamics Compressor & Master Gain Section */}
      <div className="rounded-sm border border-border bg-card/60 p-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              3. Dynamics Compressor & Gain Staging
            </span>
            {(!dynamics.enabled || dynamicsBypass) && (
              <Badge variant="outline" className="border-amber-600 text-amber-500 text-[9px] py-0">
                BYPASS
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
              <Switch
                checked={dynamics.enabled && !dynamicsBypass}
                onCheckedChange={(v) => {
                  setDynamics({ enabled: v });
                  setDynamicsBypass(!v);
                }}
                className="scale-75"
              />
              <span>{dynamics.enabled && !dynamicsBypass ? "Active" : "Enable Comp"}</span>
            </label>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Threshold */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Threshold:</span>
              <span className="font-bold">{dynamics.threshold} dB</span>
            </div>
            <Slider
              value={[dynamics.threshold]}
              min={-60}
              max={0}
              step={1}
              disabled={!dynamics.enabled || dynamicsBypass}
              onValueChange={([v]) => setDynamics({ threshold: v ?? -24 })}
            />
          </div>

          {/* Ratio */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Ratio:</span>
              <span className="font-bold">{dynamics.ratio}:1</span>
            </div>
            <Slider
              value={[dynamics.ratio]}
              min={1}
              max={20}
              step={0.5}
              disabled={!dynamics.enabled || dynamicsBypass}
              onValueChange={([v]) => setDynamics({ ratio: v ?? 4 })}
            />
          </div>

          {/* Makeup Gain */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Makeup Gain:</span>
              <span className="font-bold">+{dynamics.makeupGain} dB</span>
            </div>
            <Slider
              value={[dynamics.makeupGain]}
              min={0}
              max={24}
              step={0.5}
              disabled={!dynamics.enabled || dynamicsBypass}
              onValueChange={([v]) => setDynamics({ makeupGain: v ?? 0 })}
            />
          </div>
        </div>

        {/* Master Gain Boost & Stereo Phase Tools */}
        <div className="mt-3 border-t border-border/40 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Master Gain Boost */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Master Gain Boost:</span>
              <span className="font-bold">{(gainBoost * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[gainBoost]}
              min={0.1}
              max={3.0}
              step={0.05}
              onValueChange={([v]) => setGainBoost(v ?? 1.0)}
            />
          </div>

          {/* Stereo Panner */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Stereo Pan:</span>
              <span className="font-bold">
                {pan === 0
                  ? "Center"
                  : pan < 0
                    ? `L ${Math.abs(pan * 100).toFixed(0)}%`
                    : `R ${(pan * 100).toFixed(0)}%`}
              </span>
            </div>
            <Slider
              value={[pan]}
              min={-1}
              max={1}
              step={0.05}
              onValueChange={([v]) => setPan(v ?? 0)}
            />
          </div>
        </div>

        {/* Phase & Mono Sum Toggles */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[10px]">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={invertPhase} onCheckedChange={setInvertPhase} className="scale-75" />
              <span>Invert Phase Ø (180°)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={monoSum} onCheckedChange={setMonoSum} className="scale-75" />
              <span>Mono Sum (1ch)</span>
            </label>
          </div>
          <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px]" onClick={resetAllDsp}>
            <RotateCcw className="size-3 mr-1" />
            Reset All DSP
          </Button>
        </div>
      </div>
    </div>
  );
}
