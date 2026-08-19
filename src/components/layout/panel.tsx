import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card p-4",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
        {action}
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </section>
  );
}
