import {
  Bookmark,
  Check,
  Download,
  Edit2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTimePrecise } from "@/features/media/format";
import { useAudioStore } from "./store";
import type { CuePoint } from "./types";

interface AudioCueControlsProps {
  onSeek: (time: number) => void;
}

export function AudioCueControls({ onSeek }: AudioCueControlsProps) {
  const cuePoints = useAudioStore((s) => s.cuePoints);
  const addCuePoint = useAudioStore((s) => s.addCuePoint);
  const removeCuePoint = useAudioStore((s) => s.removeCuePoint);
  const updateCuePoint = useAudioStore((s) => s.updateCuePoint);
  const clearCuePoints = useAudioStore((s) => s.clearCuePoints);
  const setTrimStart = useAudioStore((s) => s.setTrimStart);
  const setTrimEnd = useAudioStore((s) => s.setTrimEnd);
  const exportCueSlice = useAudioStore((s) => s.exportCueSlice);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const handleStartEdit = (cue: CuePoint) => {
    setEditingId(cue.id);
    setEditLabel(cue.label);
  };

  const handleSaveEdit = (id: string) => {
    if (editLabel.trim()) {
      updateCuePoint(id, { label: editLabel.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-3 text-xs font-mono">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <Bookmark className="size-4 text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Audio Cue Markers & Slice Bookmarks ({cuePoints.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-[10px]"
            onClick={() => addCuePoint(useAudioStore.getState().currentTime)}
            title="Add Cue Marker at Current Playhead (M)"
          >
            <Plus className="size-3 mr-1" />
            + Add Marker (M)
          </Button>
          {cuePoints.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
              onClick={clearCuePoints}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Markers List */}
      {cuePoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-sm">
          <Bookmark className="size-6 text-muted-foreground/40 mb-1" />
          <p className="font-bold text-foreground">No Cue Markers Placed</p>
          <p className="text-[11px]">
            Press <kbd className="border border-border bg-card px-1 py-0.2 rounded-xs font-bold text-foreground">M</kbd> during playback or click the button above to bookmark timestamps and export individual audio slices.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-[260px] overflow-y-auto pr-1">
          {cuePoints.map((cue, idx) => {
            const nextCue = cuePoints[idx + 1];
            const isEditing = editingId === cue.id;

            return (
              <div
                key={cue.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-card/80 p-2 shadow-xs transition-colors hover:bg-secondary/40"
              >
                {/* Marker Info & Jump */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="grid size-6 shrink-0 place-items-center rounded-xs bg-amber-500/20 text-amber-500 font-bold text-[10px] border border-amber-500/40">
                    {idx + 1}
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-6 text-xs w-36 font-mono"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(cue.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="default"
                        className="size-6 p-0"
                        onClick={() => handleSaveEdit(cue.id)}
                      >
                        <Check className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
                        {cue.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cue)}
                        className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                        title="Rename marker"
                      >
                        <Edit2 className="size-3" />
                      </button>
                    </div>
                  )}

                  <Badge variant="outline" className="font-mono text-[9px] py-0">
                    {formatTimePrecise(cue.timestampSec)}
                  </Badge>
                </div>

                {/* Actions: Jump, Set In/Out, Export Slice */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onSeek(cue.timestampSec)}
                    title="Jump playhead to marker"
                  >
                    <Play className="size-3 mr-1" />
                    Jump
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[9px]"
                    onClick={() => setTrimStart(cue.timestampSec)}
                    title="Set as Trim IN point"
                  >
                    [ IN ]
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[9px]"
                    onClick={() => setTrimEnd(cue.timestampSec)}
                    title="Set as Trim OUT point"
                  >
                    [ OUT ]
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => exportCueSlice(cue, nextCue)}
                    title="Export slice to WAV"
                  >
                    <Download className="size-3 mr-1" />
                    Slice
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCuePoint(cue.id)}
                    title="Delete marker"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
