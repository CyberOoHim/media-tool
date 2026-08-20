import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSwitch() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  return (
    <div
      role="group"
      aria-label="Color theme selector (Day / Dark)"
      className="flex items-center gap-0.5 rounded-[var(--radius-sm)] border-2 border-border bg-secondary/80 p-0.5 font-mono shadow-[1px_1px_0px_var(--color-border)]"
    >
      {/* Day / Light Mode Option */}
      <button
        type="button"
        role="button"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light", true)}
        className={cn(
          "flex items-center gap-1 rounded-xs px-2 py-0.5 text-xs font-bold uppercase tracking-wider transition-all select-none",
          theme === "light"
            ? "border border-border bg-signal text-signal-foreground shadow-[1px_1px_0px_var(--color-border)]"
            : "border border-transparent text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground active:translate-x-[1px] active:translate-y-[1px]",
        )}
        title="Switch to Day Mode (Shift + D)"
      >
        <Sun className="size-3.5" />
        <span className="hidden sm:inline">Day</span>
      </button>

      {/* Dark / Night Mode Option (Default) */}
      <button
        type="button"
        role="button"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark", true)}
        className={cn(
          "flex items-center gap-1 rounded-xs px-2 py-0.5 text-xs font-bold uppercase tracking-wider transition-all select-none",
          theme === "dark"
            ? "border border-border bg-primary text-primary-foreground shadow-[1px_1px_0px_var(--color-border)]"
            : "border border-transparent text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground active:translate-x-[1px] active:translate-y-[1px]",
        )}
        title="Switch to Dark Mode (Default) (Shift + D)"
      >
        <Moon className="size-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
