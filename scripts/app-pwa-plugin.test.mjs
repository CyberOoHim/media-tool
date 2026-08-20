import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  appNameFromHost,
  createHeadInjector,
  appXCreatorHeadTags,
  injectAppPwaHead,
  isDocumentPath,
  isInstallQuery,
  renderWebManifest,
  snapshotOgIdentity,
  stripInstallParams,
} from "./app-pwa-shared.mjs";
import { renderInstallPage } from "./app-pwa-plugin.mjs";

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("injects before </head>", () => {
  const out = injectAppPwaHead("<html><head><title>x</title></head><body></body></html>", { site: {} });
  assert.match(out, /rel="manifest"/);
  assert.match(out, /apple-touch-icon/);
  assert.match(out, /app-builder\/extensions\.js/);
  assert.ok(out.indexOf("manifest") < out.indexOf("</head>"));
});

test("injects the extensions script without a project id", () => {
  const out = injectAppPwaHead("<html><head></head></html>", {
    appName: "Demo",
    projectId: "",
    site: {},
  });
  assert.match(out, /src="https:\/\/app\.com\/app-builder\/extensions\.js" defer/);
  assert.doesNotMatch(out, /app-project-id/);
  assert.doesNotMatch(out, /data-project-id/);
  assert.doesNotMatch(out, /property="app:app_id"/);
});

test("injects project id on the script and meta when provided", () => {
  const out = injectAppPwaHead("<html><head></head></html>", {
    appName: "Demo",
    projectId: "proj-123",
    site: {},
  });
  assert.match(out, /name="app-project-id" content="proj-123"/);
  assert.match(out, /data-project-id="proj-123"/);
  assert.match(out, /property="app:app_id" content="proj-123"/);
});

test("does not duplicate app:app_id", () => {
  const ctx = { appName: "Demo", projectId: "proj-123", site: {} };
  const once = injectAppPwaHead("<html><head></head></html>", ctx);
  const twice = injectAppPwaHead(once, ctx);
  assert.equal(once, twice);
  assert.equal(twice.split('property="app:app_id"').length - 1, 1);
});

test("omits x:creator tags without both creator values", () => {
  assert.deepEqual(appXCreatorHeadTags("", "42"), []);
  assert.deepEqual(appXCreatorHeadTags("@alice", ""), []);
  const out = injectAppPwaHead("<html><head></head></html>", {
    appName: "Demo",
    projectId: "",
    creator: "@alice",
    creatorId: "",
    site: {},
  });
  assert.doesNotMatch(out, /property="x:creator"/);
});

test("injects x:creator tags when both creator values are set", () => {
  const out = injectAppPwaHead("<html><head></head></html>", {
    appName: "Demo",
    projectId: "",
    creator: "@alice",
    creatorId: "42",
    site: {},
  });
  assert.match(out, /property="x:creator" content="@alice"/);
  assert.match(out, /property="x:creator:id" content="42"/);
});

test("escapes x:creator values", () => {
  const tags = appXCreatorHeadTags('"><script>', '1" onclick="alert(1)');
  assert.equal(
    tags[0],
    '<meta property="x:creator" content="&quot;&gt;&lt;script&gt;">',
  );
  assert.equal(
    tags[1],
    '<meta property="x:creator:id" content="1&quot; onclick=&quot;alert(1)">',
  );
});

test("does not duplicate x:creator tags", () => {
  const ctx = { appName: "Demo", projectId: "", creator: "@alice", creatorId: "42", site: {} };
  const once = injectAppPwaHead("<html><head></head></html>", ctx);
  const twice = injectAppPwaHead(once, ctx);
  assert.equal(once, twice);
  assert.equal(twice.split('property="x:creator" content=').length - 1, 1);
  assert.equal(twice.split('property="x:creator:id"').length - 1, 1);
});

test("platform chrome overwrites share-card metas and always sets og:title", () => {
  const html =
    '<html><head><title>Hello World</title><meta property="og:title" content="Old"><meta name="twitter:card" content="summary"></head></html>';
  const out = injectAppPwaHead(html, { appName: "Wild Race", site: {} });
  assert.match(out, /name="twitter:card" content="summary_large_image"/);
  assert.match(out, /property="og:title" content="Hello World"/);
  assert.doesNotMatch(out, /content="Old"/);
  assert.doesNotMatch(out, /content="summary"/);
  assert.equal(out.split('name="twitter:card"').length - 1, 1);
  assert.equal(out.split('property="og:title"').length - 1, 1);
  assert.doesNotMatch(out, /property="og:image"/);
});

test("does not duplicate twitter:card or og:title", () => {
  const once = injectAppPwaHead("<html><head><title>Hello World</title></head></html>", { site: {} });
  const twice = injectAppPwaHead(once, { site: {} });
  assert.equal(once, twice);
  assert.equal(twice.split('name="twitter:card"').length - 1, 1);
  assert.equal(twice.split('property="og:title"').length - 1, 1);
});

test("baked identity does not need a workspace filesystem", () => {
  const empty = mkdtempSync(join(tmpdir(), "app-og-empty-"));
  const out = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    cwd: empty,
    site: { title: "Pixel Nova", type: "x:game", card: "custom" },
  });
  assert.match(out, /property="og:title" content="Pixel Nova"/);
  assert.match(out, /property="og:type" content="x:game"/);
  assert.match(out, /property="og:image" content="https:\/\/wild-race\.app\.me\/og\.jpg"/);
  assert.doesNotMatch(out, /og\.app\.me/);
});

test("explicit site without card=custom is not overridden by a cwd card file", () => {
  const root = mkdtempSync(join(tmpdir(), "app-og-card-"));
  mkdirSync(join(root, "public"));
  writeFileSync(join(root, "public/og.jpg"), "x");
  const out = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    cwd: root,
    site: {},
  });
  assert.match(out, /og\.app\.me\/v1\/card\.png/);
  assert.doesNotMatch(out, /wild-race\.app\.me\/og\.jpg/);
});

test("snapshotOgIdentity stamps card=custom from a public card file", () => {
  const root = mkdtempSync(join(tmpdir(), "app-og-snap-"));
  mkdirSync(join(root, "public"));
  writeFileSync(join(root, "public/og.jpg"), "x");
  const { site } = snapshotOgIdentity(root);
  assert.equal(site.card, "custom");
  assert.equal(site.image, "/og.jpg");
  assert.equal(site.banner, undefined);
});

test("snapshotOgIdentity stamps banner from public/x-banner.jpg", () => {
  const root = mkdtempSync(join(tmpdir(), "app-og-banner-"));
  mkdirSync(join(root, "public"));
  writeFileSync(join(root, "public/x-banner.jpg"), "x");
  const { site } = snapshotOgIdentity(root);
  assert.equal(site.banner, "/x-banner.jpg");
});

test("emits x:game:image for a public host when site.banner is set", () => {
  const html = "<html><head><meta property=\"x:game:image\" content=\"old\"></head></html>";
  const out = injectAppPwaHead(html, {
    host: "wild-race.app.me",
    site: { title: "Wild Race", type: "x:game", card: "custom", banner: "/x-banner.jpg" },
  });
  assert.match(
    out,
    /property="x:game:image" content="https:\/\/wild-race\.app\.me\/x-banner\.jpg"/,
  );
  assert.match(out, /property="x:game:image:width" content="1200"/);
  assert.match(out, /property="x:game:image:height" content="264"/);
  assert.doesNotMatch(out, /content="old"/);
  assert.equal(out.split('property="x:game:image"').length - 1, 1);
});

test("does not emit x:game:image without a public host or banner", () => {
  const noHost = injectAppPwaHead("<html><head></head></html>", {
    site: { banner: "/x-banner.jpg" },
  });
  assert.doesNotMatch(noHost, /x:game:image/);
  const noBanner = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: { type: "x:game", card: "custom" },
  });
  assert.doesNotMatch(noBanner, /x:game:image/);
});

test("site title App is a real name, not a sentinel", () => {
  const out = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: { title: "App" },
  });
  assert.match(out, /property="og:title" content="App"/);
});

test("published app.me slug is still a title fallback", () => {
  const out = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: {},
  });
  assert.match(out, /property="og:title" content="Wild Race"/);
});

test("emits og:image for a public host and prefers a custom card", () => {
  const placeholder = injectAppPwaHead("<html><head></head></html>", {
    appName: "Wild Race",
    host: "wild-race.app.me",
    site: { title: "Wild Race" },
  });
  assert.match(
    placeholder,
    /property="og:image" content="https:\/\/og\.app\.me\/v1\/card\.png\?host=wild-race\.app\.me&amp;title=Wild%20Race"/,
  );
  assert.match(placeholder, /property="og:image:width" content="1200"/);

  const custom = injectAppPwaHead("<html><head></head></html>", {
    appName: "Wild Race",
    host: "wild-race.app.me",
    site: { title: "Wild Race", card: "custom", type: "x:game" },
  });
  assert.match(custom, /property="og:image" content="https:\/\/wild-race\.app\.me\/og\.jpg"/);
  assert.match(custom, /property="og:type" content="x:game"/);
});

test("placeholder og:image appends site.color when it is 6-digit hex", () => {
  const themed = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: { title: "Wild Race", color: "#FF4D2E" },
  });
  assert.match(
    themed,
    /property="og:image" content="https:\/\/og\.app\.me\/v1\/card\.png\?host=wild-race\.app\.me&amp;title=Wild%20Race&amp;color=FF4D2E"/,
  );

  const invalid = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: { title: "Wild Race", color: "red" },
  });
  assert.doesNotMatch(invalid, /color=/);

  const custom = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: { title: "Wild Race", card: "custom", color: "FF4D2E" },
  });
  assert.doesNotMatch(custom, /color=/);
});

test("document title entities are not double-escaped on og:title", () => {
  const out = injectAppPwaHead(
    "<html><head><title>Cats &amp; Dogs</title></head></html>",
    { site: {} },
  );
  assert.match(out, /property="og:title" content="Cats &amp; Dogs"/);
  assert.doesNotMatch(out, /Cats &amp;amp; Dogs/);
});

test("site.json title wins over the host slug", () => {
  const out = injectAppPwaHead("<html><head></head></html>", {
    host: "wild-race.app.me",
    site: { title: "Pixel Nova" },
  });
  assert.match(out, /property="og:title" content="Pixel Nova"/);
});

test("injects into documents with no head element", () => {
  const out = injectAppPwaHead("<html><body>hi</body></html>", { appName: "Solo", site: {} });
  assert.match(out, /<head>/);
  assert.match(out, /property="og:title" content="Solo"/);
  assert.match(out, /<\/head>/);
});

test("streaming injector matches </HEAD> case-insensitively", () => {
  const injector = createHeadInjector({ appName: "Wild Race", site: {} });
  const chunks = [
    ...injector.push("<html><HEAD><title>x</title></HE"),
    ...injector.push("AD><body>hello</body></html>"),
  ];
  const out = Buffer.concat(chunks).toString("utf8");
  assert.match(out, /property="og:title" content="x"/);
  assert.match(out, /<body>hello<\/body>/);
});

test("does not duplicate the extensions script", () => {
  const ctx = { appName: "Demo", projectId: "proj-123", site: {} };
  const once = injectAppPwaHead("<html><head></head></html>", ctx);
  const twice = injectAppPwaHead(once, ctx);
  assert.equal(once, twice);
  assert.equal(twice.split("extensions.js").length - 1, 1);
});

test("is idempotent", () => {
  const once = injectAppPwaHead("<html><head></head></html>", { site: {} });
  const twice = injectAppPwaHead(once, { site: {} });
  assert.equal(once, twice);
});

test("uses the app name in the injected title tag", () => {
  const out = injectAppPwaHead("<html><head></head></html>", { appName: "Wild Race", site: {} });
  assert.match(out, /apple-mobile-web-app-title" content="Wild Race"/);
});

test("streaming injector handles </head> split across chunks", () => {
  const injector = createHeadInjector({ appName: "Wild Race", site: {} });
  const chunks = [
    ...injector.push("<html><head><title>x</title></he"),
    ...injector.push("ad><body>hello</body></html>"),
  ];
  const out = Buffer.concat(chunks).toString("utf8");
  assert.match(out, /rel="manifest"/);
  assert.ok(out.indexOf("manifest") < out.indexOf("</head>"));
  assert.match(out, /<body>hello<\/body>/);
  assert.deepEqual(injector.flush(), []);
});

test("streaming injector passes post-head chunks through untouched", () => {
  const injector = createHeadInjector({ site: {} });
  injector.push("<html><head></head>");
  const [tail] = injector.push("<body>tail</body>");
  assert.equal(tail.toString("utf8"), "<body>tail</body>");
});

test("streaming injector falls back when no </head> is seen", () => {
  const injector = createHeadInjector({ site: {} });
  assert.deepEqual(injector.push("<html><head>"), []);
  const out = Buffer.concat(injector.flush()).toString("utf8");
  assert.match(out, /rel="manifest"/);
});

test("detects install query", () => {
  assert.equal(isInstallQuery("/?install=1&platform=ios"), true);
  assert.equal(isInstallQuery("/app?foo=1&install=true&platform=ios"), true);
  assert.equal(isInstallQuery("/?install=1"), false);
  assert.equal(isInstallQuery("/?install=1&platform=android"), false);
  assert.equal(isInstallQuery("/?install=0&platform=ios"), false);
  assert.equal(isInstallQuery("/"), false);
});

test("filters non-document paths", () => {
  assert.equal(isDocumentPath("/"), true);
  assert.equal(isDocumentPath("/app"), true);
  assert.equal(isDocumentPath("/api/thing"), false);
  assert.equal(isDocumentPath("/__app/install/styles.css"), false);
  assert.equal(isDocumentPath("/logo.png"), false);
});

test("strips install params from the app link", () => {
  assert.equal(stripInstallParams("/?install=1&platform=ios"), "/");
  assert.equal(stripInstallParams("/app?install=1&platform=ios&tab=2"), "/app?tab=2");
});

test("names the install page from host slug", () => {
  assert.equal(appNameFromHost("localhost:8080"), "App");
  assert.equal(appNameFromHost("172.17.154.217:8080"), "App");
  assert.equal(appNameFromHost("wild-race.app.me"), "Wild Race");
});

test("rejects hosts that are not plain slugs", () => {
  assert.equal(appNameFromHost("<script>alert(1)</script>"), "App");
  assert.equal(appNameFromHost('"><img src=x onerror=1>.app.me'), "App");
});

test("renders install page markup", () => {
  const html = renderInstallPage("wild-race.app.me", "/?install=1&platform=ios");
  assert.match(html, /Add Wild Race to your/);
  assert.match(html, /\/__app\/install\/styles\.css/);
  assert.match(html, /href="\/"/);
  assert.equal(html.includes("{{APP_NAME}}"), false);
  assert.equal(html.includes("{{APP_URL}}"), false);
});

test("escapes host-derived values in the install page", () => {
  const html = renderInstallPage("<script>alert(1)</script>", "/?install=1&platform=ios");
  assert.equal(html.includes("<script>alert(1)</script>"), false);
});

test("renders the manifest with the per-app name", () => {
  const manifest = JSON.parse(renderWebManifest("wild-race.app.me"));
  assert.equal(manifest.name, "Wild Race");
  assert.equal(manifest.short_name, "Wild Race");
  assert.equal(manifest.icons[0].src, "/__app/icon-180.png");
});

// Tripwires: the deployed-app path only works if Nitro scans server/ — an
// accidental edit that drops serverDir or the middleware file would otherwise
// fail silently (published apps would just render the app for ?install=1).
test("vite config keeps the nitro serverDir wiring", () => {
  const viteConfig = readFileSync(join(TEMPLATE_ROOT, "vite.config.ts"), "utf8");
  assert.match(viteConfig, /serverDir:\s*"\.\/server"/);
  assert.match(viteConfig, /appPwaPlugin\(\)/);
});

test("nitro middleware and its bundled assets exist", () => {
  const middleware = readFileSync(join(TEMPLATE_ROOT, "server/middleware/app-pwa.ts"), "utf8");
  assert.match(middleware, /install-page\.html\?raw/);
  assert.match(middleware, /virtual:app-og-identity/);
  readFileSync(join(TEMPLATE_ROOT, "scripts/install-page.html"));
  readFileSync(join(TEMPLATE_ROOT, "public/__app/icon-180.png"));
  readFileSync(join(TEMPLATE_ROOT, "public/__app/install/styles.css"));
});

test("vite plugin bakes og identity as a virtual module", () => {
  const plugin = readFileSync(join(TEMPLATE_ROOT, "scripts/app-pwa-plugin.mjs"), "utf8");
  assert.match(plugin, /virtual:app-og-identity/);
  assert.match(plugin, /snapshotOgIdentity/);
});

