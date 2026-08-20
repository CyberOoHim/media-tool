import { create } from "zustand";
import { useEffect } from "react";
import { toast } from "sonner";

export const ZOOM_MIN = 75;
export const ZOOM_MAX = 300;
export const ZOOM_DEFAULT = 100;

export const ZOOM_STEPS = [
  75, 85, 90, 100, 110, 120, 130, 140, 150, 165, 180, 200, 225, 250, 275, 300,
] as const;

export const ZOOM_PRESETS = [
  { label: "80%", value: 80, desc: "Compact" },
  { label: "100%", value: 100, desc: "Standard" },
  { label: "125%", value: 125, desc: "Large" },
  { label: "150%", value: 150, desc: "X-Large" },
  { label: "175%", value: 175, desc: "2X-Large" },
  { label: "200%", value: 200, desc: "Maximum" },
  { label: "250%", value: 250, desc: "Giant" },
  { label: "300%", value: 300, desc: "Ultra" },
] as const;

const STORAGE_KEY = "video_tool_ui_zoom";

export function clampZoom(val: number): number {
  if (!Number.isFinite(val)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(val)));
}

export function applyZoomToDom(zoom: number) {
  if (typeof document === "undefined") return;
  const clamped = clampZoom(zoom);
  const scale = clamped / 100;
  try {
    document.documentElement.style.zoom = String(scale);
    document.documentElement.style.setProperty("--ui-zoom", String(scale));
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    // ignore quota/security errors
  }
}

export function getSavedZoom(): number {
  if (typeof window === "undefined") return ZOOM_DEFAULT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number.parseInt(saved, 10);
      if (Number.isFinite(parsed) && parsed >= ZOOM_MIN && parsed <= ZOOM_MAX) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return ZOOM_DEFAULT;
}

interface UiZoomState {
  zoom: number;
  setZoom: (val: number, showToast?: boolean) => void;
  zoomIn: (showToast?: boolean) => void;
  zoomOut: (showToast?: boolean) => void;
  resetZoom: (showToast?: boolean) => void;
}

function showZoomToast(zoom: number) {
  toast.dismiss("ui-zoom-toast");
  const isDefault = zoom === ZOOM_DEFAULT;
  toast(`UI Font Size: ${zoom}%${isDefault ? " (Default)" : ""}`, {
    id: "ui-zoom-toast",
    duration: 1200,
  });
}

export const useUiZoom = create<UiZoomState>((set, get) => ({
  zoom: typeof window !== "undefined" ? getSavedZoom() : ZOOM_DEFAULT,

  setZoom: (val, showFeedback = false) => {
    const clamped = clampZoom(val);
    applyZoomToDom(clamped);
    set({ zoom: clamped });
    if (showFeedback) {
      showZoomToast(clamped);
    }
  },

  zoomIn: (showFeedback = false) => {
    const current = get().zoom;
    const next = ZOOM_STEPS.find((s) => s > current) ?? ZOOM_MAX;
    get().setZoom(next, showFeedback);
  },

  zoomOut: (showFeedback = false) => {
    const current = get().zoom;
    const prev = [...ZOOM_STEPS].reverse().find((s) => s < current) ?? ZOOM_MIN;
    get().setZoom(prev, showFeedback);
  },

  resetZoom: (showFeedback = false) => {
    get().setZoom(ZOOM_DEFAULT, showFeedback);
  },
}));

/**
 * Hook to initialize zoom on mount and attach keyboard shortcuts.
 */
export function useUiZoomKeyboardShortcuts() {
  const zoomIn = useUiZoom((s) => s.zoomIn);
  const zoomOut = useUiZoom((s) => s.zoomOut);
  const resetZoom = useUiZoom((s) => s.resetZoom);
  const setZoom = useUiZoom((s) => s.setZoom);

  // Sync with stored value on initial mount
  useEffect(() => {
    const saved = getSavedZoom();
    setZoom(saved, false);
    applyZoomToDom(saved);
  }, [setZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when inside editable elements
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

      // Check for + / = (Zoom In)
      if (
        event.key === "+" ||
        event.key === "=" ||
        event.code === "NumpadAdd" ||
        (event.ctrlKey && (event.key === "=" || event.key === "+")) ||
        (event.metaKey && (event.key === "=" || event.key === "+"))
      ) {
        event.preventDefault();
        zoomIn(true);
        return;
      }

      // Check for - / _ (Zoom Out)
      if (
        event.key === "-" ||
        event.key === "_" ||
        event.code === "NumpadSubtract" ||
        (event.ctrlKey && (event.key === "-" || event.key === "_")) ||
        (event.metaKey && (event.key === "-" || event.key === "_"))
      ) {
        event.preventDefault();
        zoomOut(true);
        return;
      }

      // Check for 0 (Reset Zoom) - only if Ctrl/Cmd is pressed OR single 0 when not typing
      if (
        (event.key === "0" && !event.shiftKey && !event.altKey) ||
        event.code === "Numpad0" ||
        ((event.ctrlKey || event.metaKey) && event.key === "0")
      ) {
        if (event.ctrlKey || event.metaKey || event.key === "0") {
          event.preventDefault();
          resetZoom(true);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);
}
