import {
  ChevronDown,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { useExpanderStore } from "@/lib/expander-store";
import { cn } from "@/lib/utils";

interface DeckExpanderProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  disabled?: boolean;
}

export function DeckExpander({
  id,
  title,
  subtitle,
  icon,
  badge,
  action,
  children,
  defaultOpen = true,
  className,
  contentClassName,
  headerClassName,
  disabled = false,
}: DeckExpanderProps) {
  const isOpen = useExpanderStore((s) => s.isOpen(id, defaultOpen));
  const toggle = useExpanderStore((s) => s.toggle);
  const isStorageLocked = useExpanderStore((s) => s.isStorageLocked);

  return (
    <div
      id={id}
      data-state={isOpen ? "open" : "collapsed"}
      className={cn(
        "group relative rounded-[var(--radius-sm)] border-2 border-border bg-card shadow-[2px_2px_0px_var(--color-border)] transition-all",
        isOpen ? "border-border" : "border-border/80 bg-card/90",
        disabled && "opacity-60",
        className,
      )}
    >
      {/* Expander Header Bar */}
      <div
        className={cn(
          "flex select-none items-center justify-between gap-2 border-b-2 border-border/40 px-3 py-2 transition-colors",
          !isOpen && "border-b-0",
          isOpen ? "bg-secondary/60" : "bg-secondary/30 hover:bg-secondary/50",
          headerClassName,
        )}
      >
        <button
          type="button"
          onClick={() => !disabled && toggle(id)}
          aria-expanded={isOpen}
          aria-controls={`${id}-content`}
          disabled={disabled}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-hidden"
        >
          {icon ? (
            <div className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-card text-signal shadow-[1px_1px_0px_var(--color-border)]">
              {icon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {title}
              </h3>
              {badge}
              {isStorageLocked ? (
                <Hint label="Lock Storage active: Expander state is saved in local memory">
                  <span className="inline-flex items-center gap-0.5 rounded-xs border border-border/60 bg-card px-1 py-0.2 font-mono text-[8px] font-bold text-muted-foreground">
                    <Lock className="size-2 text-signal" />
                    LOCK MEM
                  </span>
                </Hint>
              ) : null}
            </div>
            {subtitle ? (
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </button>

        {/* Right Action + Toggle Chevron */}
        <div className="flex shrink-0 items-center gap-1.5">
          {action ? (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {action}
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => !disabled && toggle(id)}
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
            disabled={disabled}
            className="size-7 rounded-sm p-0 text-foreground transition-transform hover:bg-card"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                isOpen ? "rotate-0" : "-rotate-90",
              )}
            />
          </Button>
        </div>
      </div>

      {/* Expander Content */}
      <div
        id={`${id}-content`}
        role="region"
        aria-labelledby={id}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none hidden",
        )}
      >
        <div className={cn("overflow-hidden", !isOpen && "hidden")}>
          <div className={cn("p-3 space-y-3", contentClassName)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpanderStorageControls({ className }: { className?: string }) {
  const isStorageLocked = useExpanderStore((s) => s.isStorageLocked);
  const toggleStorageLock = useExpanderStore((s) => s.toggleStorageLock);
  const expandAll = useExpanderStore((s) => s.expandAll);
  const collapseAll = useExpanderStore((s) => s.collapseAll);
  const resetToDefaults = useExpanderStore((s) => s.resetToDefaults);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-card/80 px-2.5 py-1.5 font-mono text-[10px]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={isStorageLocked ? "signal" : "outline"}
          onClick={toggleStorageLock}
          className="h-6 gap-1 px-2 text-[10px] font-bold"
          title="Toggle persistent lock storage for expander open/collapsed states"
        >
          {isStorageLocked ? (
            <Lock className="size-3 text-foreground" />
          ) : (
            <Unlock className="size-3 text-muted-foreground" />
          )}
          <span>Lock Storage: {isStorageLocked ? "LOCKED" : "UNLOCKED"}</span>
        </Button>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {isStorageLocked
            ? "States saved to localStorage"
            : "Temporary session state"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Hint label="Expand all decks across the workstation">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="h-6 px-1.5 text-[9px] font-bold"
          >
            <Maximize2 className="size-2.5 mr-0.5" />
            Expand All
          </Button>
        </Hint>

        <Hint label="Collapse all decks into minimal summary headers">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="h-6 px-1.5 text-[9px] font-bold"
          >
            <Minimize2 className="size-2.5 mr-0.5" />
            Collapse All
          </Button>
        </Hint>

        <Hint label="Reset all expanders and lock states to defaults">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-2.5" />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
