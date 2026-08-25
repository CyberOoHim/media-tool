import { createFileRoute } from "@tanstack/react-router";
import { Film, Image as ImageIcon, LayoutGrid, Layers, Music } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { AudioDeck } from "@/features/audio";
import { ImageBench } from "@/features/bench";
import { VideoPlayer } from "@/features/player";
import { CaptureStrip } from "@/features/strip";

export const Route = createFileRoute("/")({ component: WorkspacePage });

type LayoutMode = "video-bench" | "video-audio" | "audio-bench" | "all-three";

export function WorkspacePage() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vcr77_studio_layout");
      if (saved === "video-bench" || saved === "video-audio" || saved === "audio-bench" || saved === "all-three") {
        return saved;
      }
    }
    return "video-bench";
  });

  const changeLayout = (mode: LayoutMode) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem("vcr77_studio_layout", mode);
    } catch {
      // LocalStorage access restricted
    }
  };

  return (
    <AppShell>
      {/* Studio Deck Rack Configuration Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-signal" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
            Studio Rack Viewport:
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <Button
            size="sm"
            variant={layoutMode === "video-bench" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => changeLayout("video-bench")}
          >
            <Film className="size-3 mr-1" />
            <span className="hidden sm:inline">Deck-1 (Video) + Deck-2 (Image)</span>
            <span className="sm:hidden">Video + Img</span>
          </Button>

          <Button
            size="sm"
            variant={layoutMode === "video-audio" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => changeLayout("video-audio")}
          >
            <Music className="size-3 mr-1 text-emerald-400" />
            <span className="hidden sm:inline">Deck-1 (Video) + Audio Deck</span>
            <span className="sm:hidden">Video + Audio</span>
          </Button>

          <Button
            size="sm"
            variant={layoutMode === "audio-bench" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => changeLayout("audio-bench")}
          >
            <ImageIcon className="size-3 mr-1" />
            <span className="hidden sm:inline">Audio Deck + Deck-2 (Image)</span>
            <span className="sm:hidden">Audio + Img</span>
          </Button>

          <Button
            size="sm"
            variant={layoutMode === "all-three" ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => changeLayout("all-three")}
          >
            <LayoutGrid className="size-3 mr-1 text-signal" />
            <span className="hidden sm:inline">Full Studio Rack (All 3 Decks)</span>
            <span className="sm:hidden">All 3 Decks</span>
          </Button>
        </div>
      </div>

      {/* Main Grid Viewport */}
      {layoutMode === "video-bench" && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <VideoPlayer />
          <ImageBench />
        </div>
      )}

      {layoutMode === "video-audio" && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <VideoPlayer />
          <AudioDeck />
        </div>
      )}

      {layoutMode === "audio-bench" && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <AudioDeck />
          <ImageBench />
        </div>
      )}

      {layoutMode === "all-three" && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-3">
          <VideoPlayer />
          <AudioDeck />
          <ImageBench />
        </div>
      )}

      {/* Persistent Bottom Capture Strip */}
      <CaptureStrip />
    </AppShell>
  );
}
