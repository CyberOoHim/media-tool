import {
  Clock,
  Download,
  Scissors,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatTimePrecise } from "@/features/media/format";
import { cn } from "@/lib/utils";
import { useAudioStore } from "./store";
import type { AudioBitDepth, AudioExportFormat, AudioNormalizeMode } from "./types";

export function AudioTrimControls() {
  const audio = useAudioStore((s) => s.audio);
  const duration = useAudioStore((s) => s.duration);
  const trimMode = useAudioStore((s) => s.trimMode);
  const trimStart = useAudioStore((s) => s.trimStart);
  const trimEnd = useAudioStore((s) => s.trimEnd);
  const previewTrimMode = useAudioStore((s) => s.previewTrimMode);
  const loopRange = useAudioStore((s) => s.loopRange);
  const exportConfig = useAudioStore((s) => s.exportConfig);
  const isExporting = useAudioStore((s) => s.isExporting);
  const exportProgress = useAudioStore((s) => s.exportProgress);

  const setTrimMode = useAudioStore((s) => s.setTrimMode);
  const setTrimStart = useAudioStore((s) => s.setTrimStart);
  const setTrimEnd = useAudioStore((s) => s.setTrimEnd);
  const clearTrimRange = useAudioStore((s) => s.clearTrimRange);
  const setPreviewTrimMode = useAudioStore((s) => s.setPreviewTrimMode);
  const setLoopRange = useAudioStore((s) => s.setLoopRange);
  const setExportConfig = useAudioStore((s) => s.setExportConfig);
  const exportAudio = useAudioStore((s) => s.exportAudio);

  const hasRange = trimStart !== null || trimEnd !== null;
  const startVal = trimStart ?? 0;
  const endVal = trimEnd ?? duration;
  const rangeDuration = Math.max(0, endVal - startVal);
  const effectiveOutputDuration =
    trimMode === "trim" ? (hasRange ? rangeDuration : duration) : Math.max(0, duration - rangeDuration);

  const markIn = () => {
    setTrimStart(useAudioStore.getState().currentTime);
  };

  const markOut = () => {
    setTrimEnd(useAudioStore.getState().currentTime);
  };

  return (
    <div className="flex flex-col gap-4 text-xs font-mono">
      {/* 1. Mode Switcher & In/Out Quick Markers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Trim / Cut Mode Pill Switcher */}
        <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-secondary/30 p-2.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            1. Trim / Cut Mode
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTrimMode("trim")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xs border py-1.5 text-xs font-bold uppercase transition-all",
                trimMode === "trim"
                  ? "border-emerald-600 bg-emerald-950/70 text-emerald-300 shadow-inner"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <Sliders className="size-3.5" />
              Trim (Keep)
            </button>
            <button
              type="button"
              onClick={() => setTrimMode("cut")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xs border py-1.5 text-xs font-bold uppercase transition-all",
                trimMode === "cut"
                  ? "border-red-600 bg-red-950/70 text-red-300 shadow-inner"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <Scissors className="size-3.5" />
              Cut (Delete)
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {trimMode === "trim"
              ? "Keeps only audio inside the [IN, OUT] marker boundaries."
              : "Splices and deletes the portion between [IN, OUT] markers."}
          </p>
        </div>

        {/* IN / OUT Boundaries */}
        <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-secondary/30 p-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              2. Marker Boundaries
            </span>
            {hasRange && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
                onClick={clearTrimRange}
              >
                Clear [X]
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Mark IN Button */}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant={trimStart !== null ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={markIn}
              >
                [ Mark IN ]
              </Button>
              <span className="text-center text-[10px] font-bold text-foreground">
                {trimStart !== null ? formatTimePrecise(trimStart) : "00:00:00.000"}
              </span>
            </div>

            {/* Mark OUT Button */}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant={trimEnd !== null ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={markOut}
              >
                [ Mark OUT ]
              </Button>
              <span className="text-center text-[10px] font-bold text-foreground">
                {trimEnd !== null ? formatTimePrecise(trimEnd) : formatTimePrecise(duration)}
              </span>
            </div>
          </div>

          {/* Quick options: Loop range & Preview mode */}
          <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1.5 text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={loopRange} onCheckedChange={setLoopRange} className="scale-75" />
              <span>Loop Range (L)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={previewTrimMode}
                onCheckedChange={setPreviewTrimMode}
                className="scale-75"
              />
              <span>Preview Mode Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Fade Curves & Output Normalization */}
      <div className="rounded-sm border border-border bg-card/60 p-3 shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          3. Fades & Dynamics Shaping
        </span>

        <div className="mt-2.5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Fade-In Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Fade-In:</span>
              <span className="font-bold">{exportConfig.fadeInSec.toFixed(2)}s</span>
            </div>
            <Slider
              value={[exportConfig.fadeInSec]}
              min={0}
              max={5.0}
              step={0.05}
              onValueChange={([v]) => setExportConfig({ fadeInSec: v ?? 0 })}
            />
          </div>

          {/* Fade-Out Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Fade-Out:</span>
              <span className="font-bold">{exportConfig.fadeOutSec.toFixed(2)}s</span>
            </div>
            <Slider
              value={[exportConfig.fadeOutSec]}
              min={0}
              max={5.0}
              step={0.05}
              onValueChange={([v]) => setExportConfig({ fadeOutSec: v ?? 0 })}
            />
          </div>

          {/* Normalization Target */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Normalization:</span>
            <Select
              value={exportConfig.normalize}
              onValueChange={(val) => setExportConfig({ normalize: val as AudioNormalizeMode })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Raw Gain)</SelectItem>
                <SelectItem value="peak-0db">Peak 0 dB (Full Range)</SelectItem>
                <SelectItem value="peak-1db">Peak -1 dB (True Peak Safe)</SelectItem>
                <SelectItem value="ebu-r128">EBU R128 Broadcast (-3dB Target)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3. Export Codec & Hardware Audio Render */}
      <div className="rounded-sm border border-border bg-card/60 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            4. Export Master Format
          </span>
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Clock className="size-3 text-signal" />
            <span>Est. Length: {formatTimePrecise(effectiveOutputDuration)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {/* Format */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Format</Label>
            <Select
              value={exportConfig.format}
              onValueChange={(val) => setExportConfig({ format: val as AudioExportFormat })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opus">OPUS (RFC 7845 Native)</SelectItem>
                <SelectItem value="ogg">OGG (Opus Audio)</SelectItem>
                <SelectItem value="webm">WebM Audio</SelectItem>
                <SelectItem value="wav">WAV (PCM Lossless)</SelectItem>
                <SelectItem value="aac">AAC / M4A (MPEG-4)</SelectItem>
                <SelectItem value="mp3">MP3 Audio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sample Rate */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Sample Rate</Label>
            <Select
              value={String(exportConfig.sampleRate)}
              onValueChange={(val) => setExportConfig({ sampleRate: Number.parseInt(val, 10) })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="48000">48.0 kHz (Opus / Studio Standard)</SelectItem>
                <SelectItem value="44100">44.1 kHz (CD Quality)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bit Depth (WAV) or Bitrate (Compressed) */}
          {exportConfig.format === "wav" ? (
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">Bit Depth</Label>
              <Select
                value={String(exportConfig.bitDepth)}
                onValueChange={(val) =>
                  setExportConfig({ bitDepth: Number.parseInt(val, 10) as AudioBitDepth })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16">16-bit (Standard PCM)</SelectItem>
                  <SelectItem value="24">24-bit (High Res PCM)</SelectItem>
                  <SelectItem value="32">32-bit Float</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">Bitrate (kbps)</Label>
              <Select
                value={String(exportConfig.bitrateKbps || 192)}
                onValueChange={(val) =>
                  setExportConfig({ bitrateKbps: Number.parseInt(val, 10) })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="64">64 kbps (Voice / Low)</SelectItem>
                  <SelectItem value="96">96 kbps (Speech)</SelectItem>
                  <SelectItem value="128">128 kbps (Standard)</SelectItem>
                  <SelectItem value="192">192 kbps (High Quality)</SelectItem>
                  <SelectItem value="256">256 kbps (Studio)</SelectItem>
                  <SelectItem value="320">320 kbps (Max Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Channels */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Channels</Label>
            <Select
              value={String(exportConfig.channels)}
              onValueChange={(val) =>
                setExportConfig({ channels: Number.parseInt(val, 10) as 1 | 2 })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Stereo (2 Channels)</SelectItem>
                <SelectItem value="1">Mono (1 Channel)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Export Action Button & Progress */}
        <div className="mt-4 flex flex-col gap-2">
          {isExporting && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-signal font-bold">Rendering & Encoding Master Audio...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-1.5" />
            </div>
          )}

          <Button
            size="default"
            variant="default"
            disabled={!audio || isExporting}
            onClick={() => exportAudio()}
            className="w-full font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--color-border)] hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            <Download className="size-4 mr-2" />
            {isExporting
              ? "Rendering Master File..."
              : exportConfig.format === "wav"
                ? `Export Master Audio (${exportConfig.format.toUpperCase()} · ${exportConfig.bitDepth}-bit)`
                : `Export Master Audio (${exportConfig.format.toUpperCase()} · ${exportConfig.bitrateKbps || 192} kbps)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
