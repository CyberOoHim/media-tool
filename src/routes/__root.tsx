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
      { name: "theme-color", content: "#fceee2" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: assetUrl("favicon.svg") },
      { rel: "icon", type: "image/png", sizes: "32x32", href: assetUrl("favicon-32x32.png") },
      { rel: "icon", type: "image/png", sizes: "16x16", href: assetUrl("favicon-16x16.png") },
      { rel: "shortcut icon", href: assetUrl("favicon.ico") },
      { rel: "apple-touch-icon", sizes: "180x180", href: assetUrl("apple-touch-icon.png") },
      { rel: "manifest", href: assetUrl("__grok/manifest.webmanifest") },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var z=localStorage.getItem("video_tool_ui_zoom");if(z){var v=parseInt(z,10);if(v>=75&&v<=300){document.documentElement.style.zoom=(v/100);document.documentElement.style.setProperty("--ui-zoom",(v/100));}}}catch(e){}`,
          }}
        />
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
