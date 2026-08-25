import { create } from "zustand";
import { toast } from "sonner";

export const EXPANDER_STORAGE_KEY = "vst_deck_expanders_v1";
export const STORAGE_LOCK_KEY = "vst_deck_storage_lock_v1";

export type ExpanderId =
  | "deck-video-cut-trim"
  | "deck-webcodecs-export"
  | "deck-video-transform"
  | "deck-video-transport"
  | "deck-bench-transform"
  | "deck-bench-budget"
  | "deck-bench-comparison"
  | "deck-filmstrip-gallery"
  | "deck-audio-cut-trim"
  | "deck-audio-eq-dsp"
  | "deck-audio-cue-points";

export const DEFAULT_EXPANDER_STATES: Record<string, boolean> = {
  "deck-video-cut-trim": true,
  "deck-webcodecs-export": true,
  "deck-video-transform": true,
  "deck-video-transport": true,
  "deck-bench-transform": true,
  "deck-bench-budget": true,
  "deck-bench-comparison": true,
  "deck-filmstrip-gallery": true,
  "deck-audio-cut-trim": true,
  "deck-audio-eq-dsp": true,
  "deck-audio-cue-points": true,
};

function readStorageStates(): Record<string, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_EXPANDER_STATES };
  try {
    const raw = localStorage.getItem(EXPANDER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EXPANDER_STATES };
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return { ...DEFAULT_EXPANDER_STATES, ...parsed };
    }
  } catch {
    // ignore parse error
  }
  return { ...DEFAULT_EXPANDER_STATES };
}

function readStorageLock(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_LOCK_KEY);
    if (raw === null) return true; // default lock ON
    return raw === "true" || raw === "1";
  } catch {
    return true;
  }
}

function writeStorageStates(states: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXPANDER_STORAGE_KEY, JSON.stringify(states));
  } catch {
    // ignore quota error
  }
}

function writeStorageLock(locked: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_LOCK_KEY, String(locked));
  } catch {
    // ignore quota error
  }
}

export interface ExpanderStoreState {
  states: Record<string, boolean>;
  isStorageLocked: boolean;
  isOpen: (id: string, defaultVal?: boolean) => boolean;
  toggle: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  toggleStorageLock: () => void;
  setStorageLock: (locked: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  resetToDefaults: () => void;
}

export const useExpanderStore = create<ExpanderStoreState>((set, get) => ({
  states: readStorageStates(),
  isStorageLocked: readStorageLock(),

  isOpen: (id: string, defaultVal = true) => {
    const { states } = get();
    return states[id] !== undefined ? states[id] : defaultVal;
  },

  toggle: (id: string) => {
    const { states, isStorageLocked } = get();
    const current = states[id] !== undefined ? states[id] : true;
    const nextStates = { ...states, [id]: !current };
    set({ states: nextStates });
    if (isStorageLocked) {
      writeStorageStates(nextStates);
    }
  },

  setOpen: (id: string, open: boolean) => {
    const { states, isStorageLocked } = get();
    const nextStates = { ...states, [id]: open };
    set({ states: nextStates });
    if (isStorageLocked) {
      writeStorageStates(nextStates);
    }
  },

  toggleStorageLock: () => {
    const next = !get().isStorageLocked;
    set({ isStorageLocked: next });
    writeStorageLock(next);
    if (next) {
      // Save current states immediately on lock
      writeStorageStates(get().states);
      toast.success("Lock Storage: ON (Expander states locked & synced)", {
        description: "Deck open/closed positions will persist across sessions.",
      });
    } else {
      toast("Lock Storage: OFF (Temporary mode)", {
        description: "State changes will not be saved permanently.",
      });
    }
  },

  setStorageLock: (locked: boolean) => {
    set({ isStorageLocked: locked });
    writeStorageLock(locked);
    if (locked) {
      writeStorageStates(get().states);
    }
  },

  expandAll: () => {
    const { states, isStorageLocked } = get();
    const nextStates: Record<string, boolean> = {};
    for (const key of Object.keys(states)) {
      nextStates[key] = true;
    }
    // Also include defaults
    for (const key of Object.keys(DEFAULT_EXPANDER_STATES)) {
      nextStates[key] = true;
    }
    set({ states: nextStates });
    if (isStorageLocked) {
      writeStorageStates(nextStates);
    }
    toast.success("All Decks Expanded");
  },

  collapseAll: () => {
    const { states, isStorageLocked } = get();
    const nextStates: Record<string, boolean> = {};
    for (const key of Object.keys(states)) {
      nextStates[key] = false;
    }
    for (const key of Object.keys(DEFAULT_EXPANDER_STATES)) {
      nextStates[key] = false;
    }
    set({ states: nextStates });
    if (isStorageLocked) {
      writeStorageStates(nextStates);
    }
    toast("All Decks Collapsed");
  },

  resetToDefaults: () => {
    set({ states: { ...DEFAULT_EXPANDER_STATES }, isStorageLocked: true });
    writeStorageStates(DEFAULT_EXPANDER_STATES);
    writeStorageLock(true);
    toast.success("Expander Decks Reset to Default States");
  },
}));
