import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Download, Film, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime } from "@/features/media/format";
import { SaveLink } from "@/features/media/save-link";
import { useMediaStore } from "@/features/media/store";
import { cn } from "@/lib/utils";

export function CaptureStrip() {
  const captures = useMediaStore((s) => s.captures);
  const source = useMediaStore((s) => s.source);
  const openCapture = useMediaStore((s) => s.openCapture);
  const removeCapture = useMediaStore((s) => s.removeCapture);
  const clearCaptures = useMediaStore((s) => s.clearCaptures);
  const downloadAllCaptures = useMediaStore((s) => s.downloadAllCaptures);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Panel
      title="35mm Filmstrip // Session Gallery"
      status={`${captures.length} STILLS`}
      statusVariant={captures.length > 0 ? "signal" : "default"}
      action={
        captures.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                downloadAllCaptures();
                toast.success(`Exporting ${captures.length} stills...`);
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
              Press <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] font-bold text-foreground">S</kbd> while playing a video to snap frames into this strip.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-[var(--radius-sm)] border-2 border-border bg-theater p-2.5 shadow-inner">
          {/* Top Filmstrip Sprockets */}
          <div className="filmstrip-sprockets mb-2 h-3.5 w-full border-b border-border/40" />

          <ScrollArea className="w-full">
            <ul className="flex gap-3 pb-2 pt-1">
              {captures.map((item, index) => {
                const active = source?.fromCaptureId === item.id;
                const frameNumber = String(captures.length - index).padStart(2, "0");

                return (
                  <li key={item.id} className="w-40 shrink-0">
                    {/* Frame Index Tag */}
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold text-[#fceee2]">
                      <span className="flex items-center gap-1 text-signal">
                        <Sparkles className="size-2.5" /> #{frameNumber}
                      </span>
                      <span className="tabular opacity-80">{formatTime(item.timestampSec)}</span>
                    </div>

                    {/* Thumbnail Card */}
                    <button
                      type="button"
                      onClick={() => {
                        openCapture(item.id);
                        if (pathname === "/player") void navigate({ to: "/bench" });
                      }}
                      className={cn(
                        "group block w-full overflow-hidden rounded-[var(--radius-sm)] border-2 bg-card text-left transition-all",
                        active
                          ? "border-signal shadow-[3px_3px_0px_var(--color-signal)] scale-[1.02]"
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
                      </div>

                      <div className="p-2 font-mono text-[10px]">
                        <p className="truncate font-bold text-foreground">{item.fileName}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {item.width} × {item.height} px
                        </p>
                      </div>
                    </button>

                    {/* Action Bar */}
                    <div className="mt-1.5 flex gap-1.5">
                      <SaveLink
                        blob={item.blob}
                        filename={item.fileName}
                        variant="outline"
                        size="sm"
                        className="h-6 flex-1 px-1 text-[10px]"
                      >
                        <Download className="size-3" />
                        Save
                      </SaveLink>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => removeCapture(item.id)}
                        title="Delete capture"
                      >
                        <Trash2 className="size-3" />
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
