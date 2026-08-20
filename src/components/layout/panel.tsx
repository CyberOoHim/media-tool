import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  status,
  statusVariant = "default",
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  status?: string;
  statusVariant?: "default" | "success" | "signal" | "destructive";
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border-2 border-border bg-card shadow-[4px_4px_0px_var(--color-border)] transition-all",
        className,
      )}
    >
      {/* Retro Window Titlebar */}
      <header className="flex select-none items-center justify-between gap-3 border-b-2 border-border bg-secondary/80 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Retro Window Dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full border border-border bg-destructive" />
            <span className="size-2.5 rounded-full border border-border bg-signal" />
            <span className="size-2.5 rounded-full border border-border bg-success" />
          </div>
          <span className="mx-1 h-3.5 w-[2px] bg-border/40" />
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground">
            {title}
          </h2>
          {status ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider",
                statusVariant === "success" && "bg-success text-success-foreground",
                statusVariant === "signal" && "bg-signal text-signal-foreground",
                statusVariant === "destructive" && "bg-destructive text-destructive-foreground",
                statusVariant === "default" && "bg-card text-foreground",
              )}
            >
              <span className="size-1.5 rounded-full bg-current animate-pulse" />
              {status}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">{action}</div>
      </header>

      {/* Panel Body */}
      <div className={cn("flex min-h-0 flex-1 flex-col p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
