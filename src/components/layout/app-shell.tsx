import { Link, useRouterState } from "@tanstack/react-router";
import { Film, Image as ImageIcon, LayoutGrid, Music, ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { ExpanderStorageControls } from "@/components/layout/deck-expander";
import { KeyboardShortcutsDialog } from "@/components/layout/keyboard-dialog";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { UiZoomControl } from "@/components/layout/ui-zoom-control";
import { useThemeSync } from "@/lib/theme";
import { useUiZoomKeyboardShortcuts } from "@/lib/ui-zoom";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Studio Deck", icon: LayoutGrid },
  { to: "/player", label: "Video Solo", icon: Film },
  { to: "/audio", label: "Audio Solo", icon: Music },
  { to: "/bench", label: "Optimizer Solo", icon: ImageIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useThemeSync();
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
      {/* Studio Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1720px] w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 sm:px-4 lg:px-6 py-2">
          {/* Brand Logo */}
          <Link to="/" className="flex min-w-0 items-center gap-2.5 no-underline group">
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-signal text-foreground shadow-xs group-hover:bg-signal/90 transition-colors">
              <RetroCassetteIcon />
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-bold tracking-[0.12em] text-foreground">
                  MEDIA TOOL
                </span>
                <span className="rounded-xs bg-primary/20 border border-primary/40 px-1 py-0.2 font-mono text-[9px] font-bold text-primary uppercase tracking-widest">
                  PRO STUDIO
                </span>
              </div>
              <span className="hidden font-mono text-[10px] text-muted-foreground sm:block tracking-wide">
                Video · Audio · Frame Snap · Image Optimizer
              </span>
            </div>
          </Link>

          {/* Navigation Mode Switcher */}
          <nav className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-border/80 bg-secondary/50 p-1">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xs px-2.5 py-1 font-mono text-xs font-semibold tracking-wide transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Header Controls */}
          <div className="flex items-center gap-1.5">
            <div className="hidden xl:block">
              <ExpanderStorageControls />
            </div>
            <ThemeSwitch />
            <UiZoomControl />
            <KeyboardShortcutsDialog />

            <div className="hidden sm:flex items-center gap-1 rounded-xs border border-border/60 bg-secondary/60 px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              <span>100% On-Device</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col gap-3.5 px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {children}
      </main>

      {/* Studio Footer */}
      <footer className="mt-8 border-t border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-4 px-3 sm:px-4 lg:px-6 py-2.5 text-xs font-mono text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-semibold text-foreground">Hardware Accelerated:</span> Video decoding, audio DSP graph & image compression run 100% locally on your machine.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="xl:hidden">
              <ExpanderStorageControls />
            </span>
            <span>Studio Engine 2026</span>
          </div>
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
