import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import appCss from "../styles.css?url";

const APP_NAME = "Video Tool";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

function assetUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\//, "")}`;
}

export const Route = createRootRoute({
  beforeLoad: async () => {
    try {
      return { sessionUser: await fetchSessionUser() };
    } catch {
      return { sessionUser: null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Local video player, frame capture, and image optimizer. Everything stays in your browser.",
      },
      { name: "theme-color", content: "#0a0c10" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: assetUrl("favicon.svg") },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: assetUrl("__grok/manifest.webmanifest") },
      { rel: "apple-touch-icon", href: assetUrl("__grok/icon-180.png") },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider>
            <Outlet />
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
