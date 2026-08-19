import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pagesBase = (process.env.PAGES_BASE || "/video-tool/").replace(/\/?$/, "/");

export default defineConfig({
  base: pagesBase,
  define: {
    "import.meta.env.VITE_PAGES": JSON.stringify("1"),
  },
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  publicDir: "public",
  build: {
    outDir: ".output/public",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve("pages.html"),
    },
  },
});
