import assert from "node:assert/strict";
import test from "node:test";
import {
  SETTINGS_VERSION,
  createSettingsDocument,
  defaultSettings,
  normalizeSettings
} from "../src/settings/schema.js";

test("fills missing values from defaults without sharing mutable values", () => {
  const settings = normalizeSettings({});
  assert.equal(settings.playerStatsMode, defaultSettings.playerStatsMode);
  assert.deepEqual(settings.attackPercentageKeybinds, []);
  assert.notEqual(settings.attackPercentageKeybinds, defaultSettings.attackPercentageKeybinds);
});

test("migrates the legacy growth and density flags", () => {
  assert.equal(normalizeSettings({ showPlayerGrowth: true, showPlayerDensity: false }).playerStatsMode, "growth");
  assert.equal(normalizeSettings({ showPlayerGrowth: false, showPlayerDensity: true }).playerStatsMode, "density");
  assert.equal(normalizeSettings({ showPlayerGrowth: false, showPlayerDensity: false }).playerStatsMode, "off");
});

test("cleans malformed nested settings", () => {
  const settings = normalizeSettings({
    attackPercentageKeybinds: [null, { key: 7, type: "unknown", value: "bad" }],
    lobbyReminderRules: [null, { game: "br" }],
    customQuickEmojis: [{ code: "1011" }, "bad", 1012]
  });
  assert.deepEqual(settings.attackPercentageKeybinds, [{ key: "", type: "absolute", value: 0.8 }]);
  assert.deepEqual(settings.lobbyReminderRules, [{ game: "br" }]);
  assert.deepEqual(settings.customQuickEmojis, [1011, 1012]);
});

test("reads versioned documents and removes discontinued values on write", () => {
  const settings = normalizeSettings({ version: SETTINGS_VERSION, values: { playerStatsMode: "density" } });
  settings.showPlayerGrowth = true;
  const document = createSettingsDocument(settings);
  assert.equal(document.version, SETTINGS_VERSION);
  assert.equal(document.values.playerStatsMode, "density");
  assert.equal("showPlayerGrowth" in document.values, false);
});

test("rejects non-object settings", () => {
  assert.throws(() => normalizeSettings(null), /JSON object/);
  assert.throws(() => normalizeSettings([]), /JSON object/);
});
