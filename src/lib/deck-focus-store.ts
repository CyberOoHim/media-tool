import { create } from "zustand";

export type DeckId = "video" | "audio" | "image" | null;

interface DeckFocusState {
  focusedDeck: DeckId;
  setFocusedDeck: (deck: DeckId) => void;
  claimFocus: (deck: DeckId) => void;
}

export const useDeckFocusStore = create<DeckFocusState>((set) => ({
  focusedDeck: "video",
  setFocusedDeck: (deck) => set({ focusedDeck: deck }),
  claimFocus: (deck) => set({ focusedDeck: deck }),
}));
