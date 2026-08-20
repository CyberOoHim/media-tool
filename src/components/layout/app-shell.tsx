import { Link, useRouterState } from "@tanstack/react-router";
import { Film, Image as ImageIcon, LayoutGrid, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { KeyboardShortcutsDialog } from "@/components/layout/keyboard-dialog";
import { UiZoomControl } from "@/components/layout/ui-zoom-control";
import { useUiZoomKeyboardShortcuts } from "@/lib/ui-zoom";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Studio Deck", icon: LayoutGrid },
  { to: "/player", label: "Player Solo", icon: Film },
  { to: "/bench", label: "Optimizer Solo", icon: ImageIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useUiZoomKeyboardShortcuts();

  useEffect(() => {
    const prevent = (event: DragEvent) => {
      event.preventDefault();
    };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
      {/* Top Retro Header */}
      <header className="sticky top-0 z-40 border-b-2 border-border bg-card/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          {/* Brand Logo */}
          <Link to="/" className="flex min-w-0 items-center gap-2.5 no-underline group">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border-2 border-border bg-signal text-foreground shadow-[2px_2px_0px_var(--color-border)] group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[1px_1px_0px_var(--color-border)] transition-all">
              <RetroCassetteIcon />
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-bold tracking-[0.14em] text-foreground">
                  VIDEO TOOL
                </span>
                <span className="rounded-xs bg-primary px-1 py-0.2 font-mono text-[9px] font-bold text-primary-foreground uppercase tracking-widest">
                  VCR-77
                </span>
              </div>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
                Player · Stills · Optimizer
              </span>
            </div>
          </Link>

          {/* Navigation Mode Switcher */}
          <nav className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/60 p-1 shadow-[2px_2px_0px_var(--color-border)]">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider transition-all",
                    active
                      ? "border border-border bg-primary text-primary-foreground shadow-[1px_1px_0px_var(--color-border)]"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            <UiZoomControl />
            <KeyboardShortcutsDialog />

            <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/80 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-[1px_1px_0px_var(--color-border)]">
              <ShieldCheck className="size-3.5 text-success" />
              <span className="hidden sm:inline">100% On-Device</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5">
        {/* Workflow Quick-Tip Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/50 px-3.5 py-2 font-mono text-xs text-muted-foreground shadow-[2px_2px_0px_var(--color-border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-signal shrink-0" />
            <span>
              <strong className="text-foreground">Workflow:</strong> Drop local video ➜ Press <kbd className="rounded-xs border border-border bg-card px-1.5 py-0.5 text-[10px] font-bold text-foreground">S</kbd> to snap frame ➜ Pick crop & size budget ➜ Download / Copy.
            </span>
          </div>
          <span className="hidden text-[11px] text-foreground font-semibold lg:inline">
            Zero cloud upload · Private & instant
          </span>
        </div>

        {children}
      </main>

      {/* Retro Footer */}
      <footer className="mt-8 border-t-2 border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 text-xs font-mono text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" />
            <strong className="font-bold text-foreground">Client-Side Engine:</strong> All video decoding and image compression run locally on your device hardware.
          </p>
          <p className="text-[11px] uppercase tracking-wider">
            Retro Web Design Edition // 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

function RetroCassetteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" />
      <circle cx="8" cy="12" r="2.5" />
      <circle cx="16" cy="12" r="2.5" />
      <path d="M8 14.5h8" />
      <path d="M6 18h12" strokeWidth="1.5" />
    </svg>
  );
}
