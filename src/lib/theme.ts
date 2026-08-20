import { create } from "zustand";
import { useEffect } from "react";
import { toast } from "sonner";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "video_tool_theme";
export const DEFAULT_THEME: Theme = "dark";

export function normalizeTheme(val: unknown): Theme {
  if (val === "light") return "light";
  return "dark";
}

export function applyThemeToDom(theme: Theme) {
  if (typeof document === "undefined") return;
  const normalized = normalizeTheme(theme);
  const root = document.documentElement;

  try {
    if (normalized === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    }
  } catch {
    // ignore
  }

  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", normalized === "light" ? "#fceee2" : "#12100f");
    }
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // ignore quota/security errors
  }
}

export function getSavedTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      return normalizeTheme(saved);
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme, showToast?: boolean) => void;
  toggleTheme: (showToast?: boolean) => void;
}

function showThemeToast(theme: Theme) {
  toast.dismiss("theme-toast");
  toast(theme === "dark" ? "Theme: Dark Mode (Default)" : "Theme: Day Mode", {
    id: "theme-toast",
    duration: 1200,
  });
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: typeof window !== "undefined" ? getSavedTheme() : DEFAULT_THEME,

  setTheme: (theme, showFeedback = false) => {
    const normalized = normalizeTheme(theme);
    applyThemeToDom(normalized);
    set({ theme: normalized });
    if (showFeedback) {
      showThemeToast(normalized);
    }
  },

  toggleTheme: (showFeedback = false) => {
    const current = get().theme;
    const next = current === "dark" ? "light" : "dark";
    get().setTheme(next, showFeedback);
  },
}));

/**
 * Hook to initialize theme on mount and attach keyboard shortcut (Shift + D / Shift + T).
 */
export function useThemeSync() {
  const setTheme = useTheme((s) => s.setTheme);
  const toggleTheme = useTheme((s) => s.toggleTheme);

  // Sync with stored value on initial mount
  useEffect(() => {
    const saved = getSavedTheme();
    setTheme(saved, false);
    applyThemeToDom(saved);
  }, [setTheme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing inside editable elements
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Check for Shift + D or Shift + T to toggle Day/Dark theme
      if (
        (event.key === "D" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) ||
        (event.key === "T" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)
      ) {
        event.preventDefault();
        toggleTheme(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);
}
