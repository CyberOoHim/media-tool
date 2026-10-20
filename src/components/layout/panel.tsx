import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  status,
  statusVariant = "default",
  isFocused,
  onMouseEnter,
  onClick,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  status?: string;
  statusVariant?: "default" | "success" | "signal" | "destructive";
  isFocused?: boolean;
  onMouseEnter?: () => void;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-card/95 shadow-xs transition-all",
        isFocused
          ? "ring-1 ring-signal/80 border-signal/60 shadow-[0_0_16px_rgba(216,177,104,0.12)]"
          : "hover:border-border/90",
        className,
      )}
    >
      {/* Studio Window Titlebar */}
      <header className="flex select-none items-center justify-between gap-3 border-b border-border/80 bg-secondary/70 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* Subtle hardware status LED dots */}
          <div className="flex items-center gap-1 opacity-70" aria-hidden="true">
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
          </div>
          <span className="h-3 w-[1px] bg-border/60" />
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground truncate">
            {title}
          </h2>
          {isFocused ? (
            <span
              className="inline-flex items-center gap-1 rounded-xs border border-signal/40 bg-signal/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-signal uppercase tracking-wider animate-in fade-in"
              title="Keyboard shortcuts are actively routed to this deck"
            >
              <span className="size-1.5 rounded-full bg-signal animate-ping" />
              SHORTCUT FOCUS
            </span>
          ) : null}
          {status ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider",
                statusVariant === "success" && "border-success/40 bg-success/15 text-success",
                statusVariant === "signal" && "border-signal/40 bg-signal/15 text-signal",
                statusVariant === "destructive" && "border-destructive/40 bg-destructive/15 text-destructive",
                statusVariant === "default" && "border-border/60 bg-secondary text-muted-foreground",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {status}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">{action}</div>
      </header>

      {/* Panel Body */}
      <div className={cn("flex min-h-0 flex-1 flex-col p-3 sm:p-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}
