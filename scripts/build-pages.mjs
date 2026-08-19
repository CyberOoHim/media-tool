import { copyFileSync, existsSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "vite";

await build({ configFile: path.resolve("vite.pages.config.ts") });

const dir = path.resolve(".output/public");
const pagesHtml = path.join(dir, "pages.html");
const indexHtml = path.join(dir, "index.html");

if (existsSync(pagesHtml)) {
  renameSync(pagesHtml, indexHtml);
}

if (!existsSync(indexHtml)) {
  throw new Error("GitHub Pages build did not produce index.html");
}

copyFileSync(indexHtml, path.join(dir, "404.html"));
writeFileSync(path.join(dir, ".nojekyll"), "");

console.log("GitHub Pages site ready in .output/public");
