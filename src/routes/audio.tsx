import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { AudioDeck } from "@/features/audio";
import { CaptureStrip } from "@/features/strip";

export const Route = createFileRoute("/audio")({ component: AudioPage });

export function AudioPage() {
  return (
    <AppShell>
      <AudioDeck />
      <CaptureStrip />
    </AppShell>
  );
}
