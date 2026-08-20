import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MANIFEST_PATHS = ["public/manifest.json", "public/manifest.webmanifest"];

for (const relPath of MANIFEST_PATHS) {
  test(`manifest at ${relPath} uses relative paths for GitHub Pages subpath compatibility`, () => {
    const raw = readFileSync(join(process.cwd(), relPath), "utf8");
    const manifest = JSON.parse(raw);

    assert.ok(manifest.name, "manifest should have a name");
    assert.ok(manifest.short_name, "manifest should have a short_name");

    // Must not be hardcoded to domain root "/"
    assert.notEqual(manifest.start_url, "/", "start_url must not be root /");
    assert.notEqual(manifest.scope, "/", "scope must not be root /");
    assert.notEqual(manifest.id, "/", "id must not be root /");

    // Relative start_url and scope
    assert.match(manifest.start_url, /^\.\/?/, "start_url should be relative (./)");
    assert.match(manifest.scope, /^\.\/?/, "scope should be relative (./)");

    // Icons must be relative paths
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "manifest must define icons");
    for (const icon of manifest.icons) {
      assert.ok(!icon.src.startsWith("/"), `icon src "${icon.src}" must not be absolute domain path`);
      assert.match(icon.src, /^\.\/?/, `icon src "${icon.src}" must be relative`);
    }

    // Resolving relative to a GitHub Pages repository URL
    const manifestUrl = "https://example.github.io/video-tool/manifest.webmanifest";
    const resolvedStartUrl = new URL(manifest.start_url, manifestUrl).href;
    assert.equal(
      resolvedStartUrl,
      "https://example.github.io/video-tool/",
      "start_url must resolve to repo directory, not root domain",
    );

    const resolvedScope = new URL(manifest.scope, manifestUrl).href;
    assert.equal(
      resolvedScope,
      "https://example.github.io/video-tool/",
      "scope must resolve to repo directory, not root domain",
    );

    for (const icon of manifest.icons) {
      const resolvedIcon = new URL(icon.src, manifestUrl).href;
      assert.ok(
        resolvedIcon.startsWith("https://example.github.io/video-tool/"),
        `icon "${icon.src}" must resolve inside the repo subpath`,
      );
    }
  });
}
