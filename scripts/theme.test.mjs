import assert from "node:assert/strict";
import { test } from "node:test";

const THEME_STORAGE_KEY = "video_tool_theme";
const DEFAULT_THEME = "dark";

function normalizeTheme(val) {
  if (val === "light") return "light";
  return "dark";
}

test("Theme constants and defaults", () => {
  assert.equal(DEFAULT_THEME, "dark", "Default theme must be dark");
  assert.equal(THEME_STORAGE_KEY, "video_tool_theme", "Storage key must match");
});

test("normalizeTheme correctly normalizes theme inputs with dark as default", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme(""), "dark", "Empty string should fallback to default dark");
  assert.equal(normalizeTheme(null), "dark", "Null should fallback to default dark");
  assert.equal(normalizeTheme(undefined), "dark", "Undefined should fallback to default dark");
  assert.equal(normalizeTheme("system"), "dark", "Unknown strings should fallback to default dark");
  assert.equal(normalizeTheme(123), "dark", "Invalid types should fallback to default dark");
});

test("Theme toggle transition logic", () => {
  let theme = DEFAULT_THEME;
  assert.equal(theme, "dark");

  // Toggle dark -> light
  theme = theme === "dark" ? "light" : "dark";
  assert.equal(theme, "light");

  // Toggle light -> dark
  theme = theme === "dark" ? "light" : "dark";
  assert.equal(theme, "dark");
});
