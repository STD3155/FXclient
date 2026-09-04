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
