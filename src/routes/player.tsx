import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { VideoPlayer } from "@/features/player";
import { CaptureStrip } from "@/features/strip";

export const Route = createFileRoute("/player")({ component: PlayerPage });

function PlayerPage() {
  return (
    <AppShell>
      <VideoPlayer />
      <CaptureStrip />
    </AppShell>
  );
}
