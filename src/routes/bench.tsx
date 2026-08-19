import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ImageBench } from "@/features/bench";
import { CaptureStrip } from "@/features/strip";

export const Route = createFileRoute("/bench")({ component: BenchPage });

function BenchPage() {
  return (
    <AppShell>
      <ImageBench />
      <CaptureStrip />
    </AppShell>
  );
}
