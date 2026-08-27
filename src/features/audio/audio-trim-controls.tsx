import {
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Scissors,
  Sliders,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { downloadBlob } from "@/features/media/download";
import { formatFileSize, formatTime, formatTimePrecise } from "@/features/media/format";
import { cn } from "@/lib/utils";
import { useAudioStore } from "./store";
import type { AudioBitDepth, AudioExportFormat, AudioNormalizeMode } from "./types";

export function AudioTrimControls() {
  const audio = useAudioStore((s) => s.audio);
  const duration = useAudioStore((s) => s.duration);
  const rate = useAudioStore((s) => s.rate);
  const pitchPreserve = useAudioStore((s) => s.pitchPreserve);
  const trimMode = useAudioStore((s) => s.trimMode);
  const trimStart = useAudioStore((s) => s.trimStart);
  const trimEnd = useAudioStore((s) => s.trimEnd);
  const previewTrimMode = useAudioStore((s) => s.previewTrimMode);
  const loopRange = useAudioStore((s) => s.loopRange);
  const exportConfig = useAudioStore((s) => s.exportConfig);
  const isExporting = useAudioStore((s) => s.isExporting);
  const exportProgress = useAudioStore((s) => s.exportProgress);
  const exportProgressData = useAudioStore((s) => s.exportProgressData);
  const exportResult = useAudioStore((s) => s.exportResult);
  const setExportResult = useAudioStore((s) => s.setExportResult);
  const cancelExport = useAudioStore((s) => s.cancelExport);

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
  const effectiveBaseDuration =
    !exportConfig.exportRangeOnly || !hasRange
      ? duration
      : trimMode === "trim"
        ? rangeDuration
        : Math.max(0, duration - rangeDuration);
  const effectiveOutputDuration =
    exportConfig.applyPlaybackSpeed !== false && rate > 0
      ? effectiveBaseDuration / rate
      : effectiveBaseDuration;

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
            <label
              className="flex items-center gap-1.5 cursor-pointer select-none"
              title={
                previewTrimMode
                  ? "Loop Playback (L) - Looping within selected preview period"
                  : "Loop Playback (L) - Looping entire audio track"
              }
            >
              <Switch checked={loopRange} onCheckedChange={setLoopRange} className="scale-75" />
              <span>Loop Playback (L)</span>
            </label>
            <label
              className="flex items-center gap-1.5 cursor-pointer select-none"
              title="Preview Mode (P) - Plays only within selected period"
            >
              <Switch
                checked={previewTrimMode}
                onCheckedChange={setPreviewTrimMode}
                className="scale-75"
              />
              <span>Preview Mode (P)</span>
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
                <SelectItem value="mp3">MP3 Audio</SelectItem>
                <SelectItem value="opus">OPUS (RFC 7845 Native)</SelectItem>
                <SelectItem value="ogg">OGG (Opus Audio)</SelectItem>
                <SelectItem value="webm">WebM Audio</SelectItem>
                <SelectItem value="wav">WAV (PCM Lossless)</SelectItem>
                <SelectItem value="aac">AAC / M4A (MPEG-4)</SelectItem>
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
                value={String(exportConfig.bitrateKbps)}
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

        {/* Export DSP Routing & Range Toggles */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[10px]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer" title="Export with 5-Band EQ and Tone shaping applied">
              <Switch
                checked={exportConfig.applyEq}
                onCheckedChange={(checked) => setExportConfig({ applyEq: checked })}
                className="scale-75"
              />
              <span>Apply EQ</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="Export with Dynamics Compressor applied">
              <Switch
                checked={exportConfig.applyDynamics}
                onCheckedChange={(checked) => setExportConfig({ applyDynamics: checked })}
                className="scale-75"
              />
              <span>Apply Dynamics</span>
            </label>
            {hasRange && (
              <label className="flex items-center gap-1.5 cursor-pointer" title="Export trimmed/cut section instead of full audio track">
                <Switch
                  checked={exportConfig.exportRangeOnly}
                  onCheckedChange={(checked) => setExportConfig({ exportRangeOnly: checked })}
                  className="scale-75"
                />
                <span>Apply In/Out Range</span>
              </label>
            )}
          </div>
        </div>

        {/* 5. Deck Playback Speed & Pitch Preservation in Export */}
        <div className="mt-3 rounded-xs border border-border/80 bg-secondary/40 p-2 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch
                checked={exportConfig.applyPlaybackSpeed !== false}
                onCheckedChange={(checked) => setExportConfig({ applyPlaybackSpeed: checked })}
                className="scale-75"
              />
              <span className="font-bold text-foreground">
                Apply Deck Speed ({rate}×) & Pitch Mode in Output
              </span>
            </label>

            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="text-muted-foreground">Pitch Mode:</span>
              <span
                className={cn(
                  "rounded-xs px-1.5 py-0.5 font-bold uppercase",
                  pitchPreserve
                    ? "bg-signal/20 text-signal border border-signal/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40",
                )}
              >
                {pitchPreserve ? "Lock Tone (Pitch Preserved)" : "Tape (Varispeed)"}
              </span>
            </div>
          </div>

          <p className="mt-1 text-[10px] text-muted-foreground">
            {exportConfig.applyPlaybackSpeed !== false
              ? `Exported audio will play at ${rate}× speed (${effectiveOutputDuration.toFixed(2)}s duration) with ${pitchPreserve ? "WSOLA phase-locked pitch preservation (Lock Tone)" : "proportional analog tape pitch-shifting (Tape mode)"}.`
              : "Exported audio will render at native 1.0× speed without deck tempo modifications."}
          </p>
        </div>

        {/* Export Action Button, Progress Bar & Result Card */}
        <div className="mt-3 flex flex-col gap-3">
          <Button
            size="default"
            variant="default"
            disabled={!audio || isExporting}
            onClick={() => exportAudio()}
            className="w-full font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--color-border)] hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            <Download className="size-4 mr-2" />
            {isExporting
              ? "Rendering Master Audio..."
              : exportConfig.format === "wav"
                ? `Export Master Audio (${exportConfig.format.toUpperCase()} · ${exportConfig.bitDepth}-bit)`
                : `Export Master Audio (${exportConfig.format.toUpperCase()} · ${exportConfig.bitrateKbps} kbps)`}
          </Button>

          {/* Active Audio Export Progress Panel (matching Video Deck style) */}
          {isExporting && (
            <div className="rounded-[var(--radius-sm)] border-2 border-signal bg-theater p-3 font-mono text-xs text-[#fceee2] shadow-inner space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-signal font-bold">
                  <Flame className="size-3.5 animate-bounce" />
                  {exportProgressData?.message || "DSP Audio Rendering & Master Encoding..."}
                </span>
                <span className="font-bold text-white text-sm">
                  {exportProgressData?.percent ?? exportProgress}%
                </span>
              </div>

              <Progress value={exportProgressData?.percent ?? exportProgress} className="h-2" />

              <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1 gap-2">
                <span>
                  Stage:{" "}
                  <strong className="text-signal font-bold uppercase">
                    {exportProgressData?.stage === "dsp"
                      ? "🎛️ DSP Processing"
                      : exportProgressData?.stage === "timestretch"
                        ? "⏱️ WSOLA Time-Stretch"
                        : "💾 Audio Encoding"}
                  </strong>
                </span>
                <span>
                  Speed:{" "}
                  <strong className="text-signal font-bold">
                    {exportProgressData?.speedMultiplier ?? (exportConfig.applyPlaybackSpeed !== false ? rate : 1.0)}×
                  </strong>
                </span>
                <span>
                  Channels:{" "}
                  <strong className="text-white">
                    {exportProgressData?.channels === 1 ? "Mono" : "Stereo"} ({exportProgressData?.sampleRate ?? exportConfig.sampleRate} Hz)
                  </strong>
                </span>
                <span>
                  Elapsed:{" "}
                  <strong className="text-white">{exportProgressData?.elapsedSec ?? 0}s</strong>
                  {exportProgressData && exportProgressData.estimatedRemainingSec > 0
                    ? ` (ETA: ${exportProgressData.estimatedRemainingSec}s)`
                    : ""}
                </span>
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={cancelExport}
                  className="h-6 px-2 text-[10px]"
                >
                  Cancel Export
                </Button>
              </div>
            </div>
          )}

          {/* Dedicated Audio Export Succeeded Modal / Card */}
          {exportResult && (
            <div className="rounded-[var(--radius-sm)] border-2 border-success bg-success/10 p-3.5 font-mono text-xs text-foreground shadow-[2px_2px_0px_var(--color-border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-success">
                  <CheckCircle2 className="size-4" />
                  <span>Master Audio Export Succeeded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="font-bold font-mono text-[9px] uppercase border-success bg-success/20 text-success"
                  >
                    <span className="flex items-center gap-1">
                      <Volume2 className="size-3" />
                      {exportResult.channels === 1 ? "Mono" : "Stereo"} · {exportResult.format}
                    </span>
                  </Badge>
                  <Badge variant="outline" className="border-success text-success font-mono text-[9px]">
                    {exportResult.speedMultiplier}× Speed
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                <div>
                  <span className="text-muted-foreground">File Name:</span>{" "}
                  <strong className="text-foreground truncate block" title={exportResult.fileName}>
                    {exportResult.fileName}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  <strong className="text-foreground">
                    {formatTimePrecise(exportResult.durationSec)} ({formatTime(exportResult.durationSec, true)})
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Format & Quality:</span>{" "}
                  <strong className="text-foreground">
                    {exportResult.format} {exportResult.bitDepth ? `· ${exportResult.bitDepth}-bit` : exportResult.bitrateKbps ? `· ${exportResult.bitrateKbps} kbps` : ""}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Sample Rate & Layout:</span>{" "}
                  <strong className="text-foreground">
                    {(exportResult.sampleRate / 1000).toFixed(1)} kHz · {exportResult.channels === 1 ? "Mono" : "Stereo (2-ch)"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Speed & Pitch Mode:</span>{" "}
                  <strong className="text-foreground">
                    {exportResult.speedMultiplier}× ({exportResult.pitchPreserve ? "Lock Tone WSOLA" : "Tape Varispeed"})
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Rendered Size:</span>{" "}
                  <strong className="text-foreground font-bold text-success">
                    {formatFileSize(exportResult.fileSize)}
                  </strong>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <Button
                  type="button"
                  variant="success"
                  size="default"
                  onClick={() => void downloadBlob(exportResult.blob, exportResult.fileName)}
                  className="flex-1 gap-2 font-bold shadow-[2px_2px_0px_var(--color-border)]"
                >
                  <Download className="size-4" />
                  Save & Download Audio ({exportResult.format} · {formatFileSize(exportResult.fileSize)})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setExportResult(null)}
                  className="px-2"
                  title="Dismiss export result"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
