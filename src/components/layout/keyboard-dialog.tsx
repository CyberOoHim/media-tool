import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Keyboard, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  { key: "Space", desc: "Play / Pause deck (Video & Audio)" },
  { key: "← / →", desc: "Seek backward / forward 10s" },
  { key: ", / .", desc: "Step frame / 50ms backward & forward" },
  { key: "[ / ]", desc: "Decrease / increase playback speed" },
  { key: "I / O", desc: "Mark In / Mark Out bounds" },
  { key: "X", desc: "Clear In / Out marker range" },
  { key: "M", desc: "Add Cue Marker / Bookmark" },
  { key: "L", desc: "Toggle range loop playback" },
  { key: "+ / -", desc: "Zoom UI font size in / out" },
  { key: "0", desc: "Reset UI font size zoom (100%)" },
  { key: "Shift + D", desc: "Switch Day / Dark theme" },
  { key: "S", desc: "Snap video frame to bench & filmstrip" },
  { key: "Shift + S", desc: "Burst capture (3 frames)" },
  { key: "C", desc: "Copy current frame to clipboard" },
  { key: "F", desc: "Toggle fullscreen" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 font-mono text-[11px]"
          title="Keyboard shortcuts"
        >
          <Keyboard className="size-3.5" />
          <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-xs transition-opacity" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border-2 border-border bg-card p-0 shadow-[6px_6px_0px_var(--color-border)] focus:outline-none">
          {/* Retro Window Header */}
          <div className="flex items-center justify-between border-b-2 border-border bg-secondary px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="size-2.5 rounded-full border border-border bg-destructive" />
                <span className="size-2.5 rounded-full border border-border bg-signal" />
                <span className="size-2.5 rounded-full border border-border bg-success" />
              </div>
              <span className="mx-1 h-3.5 w-[2px] bg-border/40" />
              <DialogPrimitive.Title className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Keyboard Shortcuts
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="size-6 rounded border border-border bg-card grid place-items-center hover:bg-destructive hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="mb-3 font-mono text-xs text-muted-foreground">
              Master the player with these physical deck shortcuts:
            </p>
            <div className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between border-b border-border/40 pb-1.5 text-xs last:border-0"
                >
                  <span className="font-mono text-muted-foreground">{s.desc}</span>
                  <kbd className="rounded-sm border-2 border-border bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground shadow-[1px_1px_0px_var(--color-border)]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <DialogPrimitive.Close asChild>
                <Button size="sm" variant="default">
                  Got it
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
