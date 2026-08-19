import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Workspace" },
  { to: "/player", label: "Player" },
  { to: "/bench", label: "Bench" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 no-underline">
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-card text-foreground">
              <CropMark />
            </span>
            <span className="leading-tight">
              <span className="block font-mono text-sm font-medium tracking-[0.12em] text-foreground">
                VIDEO TOOL
              </span>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Player · Stills · Bench
              </span>
            </span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-0.5 sm:ml-2 sm:gap-1">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-[var(--radius-sm)] px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors sm:px-3 sm:text-xs",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              On-device
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5">{children}</main>

      <footer className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Privacy note:</strong> Processing happens
          entirely in your browser. No data leaves your device.
        </p>
      </footer>
    </div>
  );
}

function CropMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
      <rect x="6" y="7" width="12" height="10" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 4h4M4 3v4M21 4h-4M20 3v4M3 20h4M4 21v-4M21 20h-4M20 21v-4"
        className="stroke-signal"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  );
}
