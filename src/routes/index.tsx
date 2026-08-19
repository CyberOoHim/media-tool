import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ImageBench } from "@/features/bench";
import { VideoPlayer } from "@/features/player";
import { CaptureStrip } from "@/features/strip";

export const Route = createFileRoute("/")({ component: WorkspacePage });

function WorkspacePage() {
  return (
    <AppShell>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <VideoPlayer />
        <ImageBench />
      </div>
      <CaptureStrip />
    </AppShell>
  );
}
