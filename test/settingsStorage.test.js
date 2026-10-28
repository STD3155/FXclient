import assert from "node:assert/strict";
import test from "node:test";
import { SETTINGS_VERSION } from "../src/settings/schema.js";
import { loadSettings, saveSettings } from "../src/settings/storage.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("persists a versioned document and reads it back", () => {
  globalThis.localStorage = createStorage();
  saveSettings({ playerStatsMode: "growth", attackPercentageKeybinds: [] });
  const stored = JSON.parse(localStorage.getItem("fx_settings"));
  assert.equal(stored.version, SETTINGS_VERSION);
  assert.equal(stored.values.playerStatsMode, "growth");
  assert.equal(loadSettings().playerStatsMode, "growth");
});

test("recovers from corrupt storage", () => {
  globalThis.localStorage = createStorage();
  localStorage.setItem("fx_settings", "not json");
  assert.equal(loadSettings().playerStatsMode, "both");
  assert.equal(localStorage.getItem("fx_settings"), null);
});

test("preserves upstream account labels, colors and clan highlighting across reloads", () => {
  globalThis.localStorage = createStorage();
  const settings = loadSettings();
  settings.highlightSameClan = true;
  settings.followedAccountNicknames = { ally: "Teammate" };
  settings.followedAccountColors = { ally: "#12ab34" };
  settings.savedAccountLabels = { main: { label: "Main account", color: "#abcdef" } };
  saveSettings(settings);

  const reloaded = loadSettings();
  assert.equal(reloaded.highlightSameClan, true);
  assert.deepEqual(reloaded.followedAccountNicknames, settings.followedAccountNicknames);
  assert.deepEqual(reloaded.followedAccountColors, settings.followedAccountColors);
  assert.deepEqual(reloaded.savedAccountLabels, settings.savedAccountLabels);
});
