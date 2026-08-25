import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { AudioPage } from "./routes/audio";
import { BenchPage } from "./routes/bench";
import { WorkspacePage } from "./routes/index";
import { PlayerPage } from "./routes/player";

function routerBasepath(): string | undefined {
  const base = import.meta.env.BASE_URL || "/";
  const trimmed = base.replace(/\/$/, "");
  return trimmed === "" ? undefined : trimmed;
}

const rootRoute = createRootRoute({
  component: function SpaShell() {
    return (
      <>
        <PreviewHostBridge />
        <TooltipProvider>
          <Outlet />
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorkspacePage,
});

const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/player",
  component: PlayerPage,
});

const audioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/audio",
  component: AudioPage,
});

const benchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bench",
  component: BenchPage,
});

const routeTree = rootRoute.addChildren([indexRoute, playerRoute, audioRoute, benchRoute]);

export function getSpaRouter() {
  return createRouter({
    routeTree,
    basepath: routerBasepath(),
  });
}
