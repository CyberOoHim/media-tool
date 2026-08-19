import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Download, Film, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime } from "@/features/media/format";
import { useMediaStore } from "@/features/media/store";
import { cn } from "@/lib/utils";

export function CaptureStrip() {
  const captures = useMediaStore((s) => s.captures);
  const source = useMediaStore((s) => s.source);
  const openCapture = useMediaStore((s) => s.openCapture);
  const downloadCapture = useMediaStore((s) => s.downloadCapture);
  const removeCapture = useMediaStore((s) => s.removeCapture);
  const clearCaptures = useMediaStore((s) => s.clearCaptures);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Panel
      title="Captures"
      action={
        captures.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearCaptures();
              toast("Strip cleared");
            }}
          >
            <Trash2 />
            Clear
          </Button>
        ) : null
      }
    >
      {captures.length === 0 ? (
        <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <Film className="size-4 shrink-0" />
          <p>
            Frames you capture land here, then open on the bench. Session only — nothing is uploaded.
          </p>
        </div>
      ) : (
        <ScrollArea className="w-full">
          <ul className="flex gap-3 pb-2">
            {captures.map((item) => {
              const active = source?.fromCaptureId === item.id;
              return (
                <li key={item.id} className="w-36 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      openCapture(item.id);
                      if (pathname === "/player") void navigate({ to: "/bench" });
                    }}
                    className={cn(
                      "block w-full overflow-hidden rounded-[var(--radius-sm)] border bg-theater text-left transition-colors",
                      active ? "border-signal" : "border-border hover:border-foreground/40",
                    )}
                  >
                    <img src={item.objectUrl} alt={item.fileName} className="h-20 w-full object-cover" />
                    <div className="px-2 py-1.5">
                      <p className="truncate font-mono text-[10px] text-foreground">{item.fileName}</p>
                      <p className="font-mono text-[10px] tabular text-muted-foreground">
                        {formatTime(item.timestampSec)} · {item.width}×{item.height}
                      </p>
                    </div>
                  </button>
                  <div className="mt-1 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 px-1"
                      onClick={() => downloadCapture(item.id)}
                    >
                      <Download className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 px-1"
                      onClick={() => removeCapture(item.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </Panel>
  );
}
