import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const APP_NAME = "Media Tool";

function assetUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\//, "")}`;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Local video, frame capture, and image optimizer. Everything stays in your browser.",
      },
      { name: "theme-color", content: "#12100f" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: assetUrl("favicon.svg") },
      { rel: "icon", type: "image/png", sizes: "32x32", href: assetUrl("favicon-32x32.png") },
      { rel: "icon", type: "image/png", sizes: "16x16", href: assetUrl("favicon-16x16.png") },
      { rel: "shortcut icon", href: assetUrl("favicon.ico") },
      { rel: "apple-touch-icon", sizes: "180x180", href: assetUrl("apple-touch-icon.png") },
      { rel: "manifest", href: assetUrl("__app/manifest.webmanifest") },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("video_tool_theme")||"dark";var d=document.documentElement;d.classList.remove("dark","light");d.classList.add(t);d.setAttribute("data-theme",t);d.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",t==="light"?"#fceee2":"#12100f");}}catch(e){}try{var z=localStorage.getItem("video_tool_ui_zoom");if(z){var v=parseInt(z,10);if(v>=75&&v<=300){document.documentElement.style.zoom=(v/100);document.documentElement.style.setProperty("--ui-zoom",(v/100));}}}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <PreviewHostBridge />
        <TooltipProvider>
          <Outlet />
          <Toaster position="bottom-center" />
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
