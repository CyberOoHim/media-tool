import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Clock,
  Download,
  Film,
  HelpCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hint } from "@/components/ui/tooltip";
import { formatTimePrecise } from "@/features/media/format";
import { SaveLink } from "@/features/media/save-link";
import { sortCaptures, useMediaStore } from "@/features/media/store";
import type { CaptureSortOrder } from "@/features/media/types";
import { cn } from "@/lib/utils";

export function CaptureStrip() {
  const captures = useMediaStore((s) => s.captures);
  const captureSortOrder = useMediaStore((s) => s.captureSortOrder);
  const setCaptureSortOrder = useMediaStore((s) => s.setCaptureSortOrder);
  const source = useMediaStore((s) => s.source);
  const trimStart = useMediaStore((s) => s.trimStart);
  const trimEnd = useMediaStore((s) => s.trimEnd);
  const includeScreenshotFrame = useMediaStore((s) => s.includeScreenshotFrame);
  const setIncludeScreenshotFrame = useMediaStore((s) => s.setIncludeScreenshotFrame);
  const applyScreenshotToTrim = useMediaStore((s) => s.applyScreenshotToTrim);
  const openCapture = useMediaStore((s) => s.openCapture);
  const removeCapture = useMediaStore((s) => s.removeCapture);
  const clearCaptures = useMediaStore((s) => s.clearCaptures);
  const downloadAllCaptures = useMediaStore((s) => s.downloadAllCaptures);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Always derive sorted captures according to active sequence (defaults to chronological time sequence)
  const sortedCaptures = useMemo(
    () => sortCaptures(captures, captureSortOrder),
    [captures, captureSortOrder],
  );

  return (
    <Panel
      title="35mm Filmstrip // Session Gallery & Trim Markers"
      status={`${captures.length} STILLS`}
      statusVariant={captures.length > 0 ? "signal" : "default"}
      action={
        captures.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Sequence Sort Order Control */}
            <div className="flex items-center space-x-1.5 rounded-[var(--radius-sm)] border border-border bg-card px-2 py-1 font-mono text-[10px]">
              <Clock className="size-3 text-signal" />
              <label
                htmlFor="strip-sort-select"
                className="cursor-pointer font-bold text-foreground select-none"
              >
                Sort:
              </label>
              <div className="w-[180px]">
                <Select
                  value={captureSortOrder}
                  onValueChange={(val) => {
                    setCaptureSortOrder(val as CaptureSortOrder);
                    if (val === "time-asc") {
                      toast("Sorted by Time Sequence (Timeline 00:00 ➔ End)");
                    } else if (val === "time-desc") {
                      toast("Sorted by Time Sequence (Timeline End ➔ 00:00)");
                    } else if (val === "created-desc") {
                      toast("Sorted by Capture Order (Newest First)");
                    } else {
                      toast("Sorted by Capture Order (Oldest First)");
                    }
                  }}
                >
                  <SelectTrigger
                    id="strip-sort-select"
                    className="h-6 border-0 bg-transparent px-1.5 py-0 text-[10px] font-bold shadow-none hover:bg-secondary"
                  >
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time-asc">Time Sequence (00:00 ➔ End)</SelectItem>
                    <SelectItem value="time-desc">Time Sequence (End ➔ 00:00)</SelectItem>
                    <SelectItem value="created-desc">Captured (Newest First)</SelectItem>
                    <SelectItem value="created-asc">Captured (Oldest First)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Hint label="Chronological time sequence arranges stills in order of their video timestamp.">
                <HelpCircle className="size-3 text-muted-foreground" />
              </Hint>
            </div>

            {/* Global include screenshot checkbox quick-toggle in strip header */}
            <div className="flex items-center space-x-1.5 rounded-[var(--radius-sm)] border border-border bg-card px-2 py-1 font-mono text-[10px]">
              <Checkbox
                id="strip-include-frame-chk"
                checked={includeScreenshotFrame}
                onCheckedChange={(c) => setIncludeScreenshotFrame(Boolean(c))}
                className="size-3"
              />
              <label
                htmlFor="strip-include-frame-chk"
                className="cursor-pointer font-bold text-foreground select-none"
              >
                Include frame in period
              </label>
              <Hint label="Default: Not included. When setting IN/OUT from a screenshot, determines whether the screenshot's own frame time is included in the period.">
                <HelpCircle className="size-3 text-muted-foreground" />
              </Hint>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                downloadAllCaptures();
                toast.success(`Exporting ${captures.length} stills in time sequence...`);
              }}
              className="h-7 text-[10px]"
            >
              <Download className="size-3" />
              Download All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearCaptures();
                toast("Filmstrip cleared");
              }}
              className="h-7 text-[10px]"
            >
              <Trash2 className="size-3" />
              Clear
            </Button>
          </div>
        ) : null
      }
    >
      {captures.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border-2 border-dashed border-border bg-secondary/30 py-8 text-center">
          <div className="grid size-10 place-items-center rounded-full border-2 border-border bg-card">
            <Film className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Filmstrip is Empty
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Press <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] font-bold text-foreground">S</kbd> while playing a video to snap frames. Stills are sorted in chronological time sequence and can be used to set precise Cut/Trim IN & OUT points.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-[var(--radius-sm)] border-2 border-border bg-theater p-2.5 shadow-inner">
          {/* Top Filmstrip Sprockets */}
          <div className="filmstrip-sprockets mb-2 h-3.5 w-full border-b border-border/40" />

          <ScrollArea className="w-full">
            <ul className="flex gap-3 pb-2 pt-1">
              {sortedCaptures.map((item, index) => {
                const active = source?.fromCaptureId === item.id;
                const frameNumber = String(index + 1).padStart(2, "0");

                // Check if this capture timestamp matches trim IN or OUT
                const isTrimStart =
                  trimStart !== null && Math.abs(trimStart - item.timestampSec) < 0.05;
                const isTrimEnd =
                  trimEnd !== null && Math.abs(trimEnd - item.timestampSec) < 0.05;

                return (
                  <li key={item.id} className="w-44 shrink-0">
                    {/* Frame Index & Time Tag */}
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold text-[#fceee2]">
                      <span className="flex items-center gap-1 text-signal">
                        <Sparkles className="size-2.5" /> #{frameNumber}
                      </span>
                      <span className="tabular opacity-90 text-signal font-semibold">
                        {formatTimePrecise(item.timestampSec)}
                      </span>
                    </div>

                    {/* Thumbnail Card */}
                    <button
                      type="button"
                      onClick={() => {
                        openCapture(item.id);
                        if (pathname === "/player") void navigate({ to: "/bench" });
                      }}
                      className={cn(
                        "group block w-full overflow-hidden rounded-[var(--radius-sm)] border-2 bg-card text-left transition-all relative",
                        active
                          ? "border-signal shadow-[3px_3px_0px_var(--color-signal)] scale-[1.01]"
                          : isTrimStart || isTrimEnd
                            ? "border-primary shadow-[2px_2px_0px_var(--color-primary)]"
                            : "border-border shadow-[2px_2px_0px_var(--color-border)] hover:border-foreground/80 hover:translate-y-[-1px]",
                      )}
                    >
                      <div className="checkerboard relative h-24 w-full overflow-hidden">
                        <img
                          src={item.objectUrl}
                          alt={item.fileName}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        {active ? (
                          <span className="absolute bottom-1 right-1 rounded-xs border border-border bg-signal px-1 py-0.2 font-mono text-[8px] font-bold uppercase text-foreground">
                            ACTIVE
                          </span>
                        ) : null}

                        {isTrimStart ? (
                          <span className="absolute top-1 left-1 rounded-xs border border-border bg-primary px-1 py-0.2 font-mono text-[8px] font-bold text-primary-foreground">
                            [ IN POINT
                          </span>
                        ) : isTrimEnd ? (
                          <span className="absolute top-1 right-1 rounded-xs border border-border bg-destructive px-1 py-0.2 font-mono text-[8px] font-bold text-white">
                            OUT POINT ]
                          </span>
                        ) : null}
                      </div>

                      <div className="p-2 font-mono text-[10px]">
                        <p className="truncate font-bold text-foreground">{item.fileName}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {item.width} × {item.height} px
                        </p>
                      </div>
                    </button>

                    {/* Cut / Trim Marker Buttons for Screenshot */}
                    <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                      <Button
                        type="button"
                        variant={isTrimStart ? "primary" : "secondary"}
                        size="sm"
                        className="h-8 px-1.5 text-[10px] font-bold touch-manipulation active:scale-95"
                        onClick={() => {
                          const res = applyScreenshotToTrim(item.id, "start");
                          const inclText = includeScreenshotFrame
                            ? "included"
                            : "excluded (starts next frame)";
                          toast.success(
                            `Marked IN (Start) @ ${formatTimePrecise(res.start ?? item.timestampSec)} [Screenshot ${inclText}]`,
                          );
                        }}
                        title={`Set as Start point (Screenshot frame ${includeScreenshotFrame ? "included" : "not included"})`}
                      >
                        [ Set IN
                      </Button>

                      <Button
                        type="button"
                        variant={isTrimEnd ? "destructive" : "secondary"}
                        size="sm"
                        className={cn(
                          "h-8 px-1.5 text-[10px] font-bold touch-manipulation active:scale-95",
                          isTrimEnd && "text-white",
                        )}
                        onClick={() => {
                          const res = applyScreenshotToTrim(item.id, "end");
                          const inclText = includeScreenshotFrame
                            ? "included"
                            : "excluded (ends prior to frame)";
                          toast.success(
                            `Marked OUT (End) @ ${formatTimePrecise(res.end ?? item.timestampSec)} [Screenshot ${inclText}]`,
                          );
                        }}
                        title={`Set as End point (Screenshot frame ${includeScreenshotFrame ? "included" : "not included"})`}
                      >
                        Set OUT ]
                      </Button>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-1.5 flex gap-1.5">
                      <SaveLink
                        blob={item.blob}
                        filename={item.fileName}
                        variant="outline"
                        size="sm"
                        className="h-7 flex-1 px-1.5 text-[10px] font-bold touch-manipulation active:scale-95"
                      >
                        <Download className="size-3 mr-1" />
                        Save Still
                      </SaveLink>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:bg-destructive hover:text-white touch-manipulation active:scale-95"
                        onClick={() => removeCapture(item.id)}
                        title="Delete capture"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>

          {/* Bottom Filmstrip Sprockets */}
          <div className="filmstrip-sprockets mt-2 h-3.5 w-full border-t border-border/40" />
        </div>
      )}
    </Panel>
  );
}
