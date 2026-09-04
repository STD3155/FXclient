import WindowManager from "./windowManager.js";
import notifications from "./notifications.js";
import { requireElement } from "./dom.js";
import { createSettingsDefinitions } from "./settings/definitions.js";
import { createQuickEmojis } from "./settings/quickEmojis.js";
import {
  clearSettings,
  exportSettings,
  loadSettings,
  parseSettingsFile,
  saveSettings
} from "./settings/storage.js";
import { createSettingsUi } from "./settings/ui.js";

window.__fx = window.__fx || {};
const __fx = window.__fx;
let settings = loadSettings();

function migrateLegacyEmojiSettings() {
  if (settings.emojiBar === undefined && settings.customEmojiBar === undefined) return;
  if (settings.customQuickEmojis.length === 0 && !settings.customQuickEmojisEnabled) {
    if (Array.isArray(settings.emojiBar) && settings.emojiBar.length === 9)
      settings.customQuickEmojis = settings.emojiBar;
    if (settings.customEmojiBar) settings.customQuickEmojisEnabled = true;
  }
  delete settings.emojiBar;
  delete settings.customEmojiBar;
  saveSettings(settings);
}

migrateLegacyEmojiSettings();
__fx.settings = settings;
__fx.makeMainMenuTransparent = false;

const settingsWindow = requireElement(".settings");

let settingsUi;
const settingsManager = {
  open() {
    WindowManager.openWindow("settings");
  },

  applyPreset(name, values) {
    settingsUi.applyPreset(values);
    notifications.show(`${name} preset selected — save to apply`, "success");
  },

  save() {
    settingsUi.readInto(settings);
    this.applySettings();
    WindowManager.closeWindow("settings");
    saveSettings(settings);
    notifications.showAfterReload("Settings saved", "success");
    window.location.reload();
  },

  importFromFile() {
    fileInput.value = "";
    fileInput.click();
  },

  exportToFile() {
    exportSettings(settings);
  },

  syncFields() {
    settingsUi.sync(settings);
  },

  async resetAll() {
    if (!await notifications.confirm("Reset all settings to their defaults?", {
      confirmLabel: "Reset settings",
      danger: true
    })) return;
    clearSettings();
    notifications.showAfterReload("Settings reset", "success");
    window.location.reload();
  },

  applySettings() {
    const customBackground = settings.customBackgroundUrl.trim();
    document.body.style.backgroundImage = customBackground ? `url(${customBackground})` : "";
    document.body.style.backgroundSize = customBackground ? "cover" : "";
    document.body.style.backgroundPosition = customBackground ? "center" : "";
    __fx.makeMainMenuTransparent = Boolean(customBackground);
  }
};

const definitions = createSettingsDefinitions({
  customQuickEmojis: createQuickEmojis,
  applyPreset: (name, values) => settingsManager.applyPreset(name, values)
});
settingsUi = createSettingsUi({ settingsWindow, definitions });

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".json,application/json";
fileInput.addEventListener("change", () => {
  const selectedFile = fileInput.files?.[0];
  if (!selectedFile) return;
  if (!selectedFile.name.toLowerCase().endsWith(".json")) {
    notifications.show("Please select a JSON settings file", "error");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const imported = parseSettingsFile(reader.result);
      if (!await notifications.confirm("Replace all current settings with the imported file?", {
        confirmLabel: "Import settings",
        danger: true
      })) return;
      settings = imported;
      __fx.settings = settings;
      saveSettings(settings);
      notifications.showAfterReload("Settings imported", "success");
      window.location.reload();
    } catch (error) {
      notifications.show("Settings import failed: " + error.message, "error", 5000);
    }
  });
  reader.readAsText(selectedFile);
});

WindowManager.add({
  name: "settings",
  element: settingsWindow,
  beforeOpen: () => settingsManager.syncFields()
});

function bindHomeSettingsButton(root = document) {
  root.querySelectorAll?.("button").forEach((button) => {
    if (button.textContent.trim() !== "FX Client settings" || button.dataset.fxSettingsBound) return;
    button.dataset.fxSettingsBound = "true";
    button.onclick = () => settingsManager.open();
  });
}

const homeButtonObserver = new MutationObserver((records) => {
  records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node instanceof HTMLElement) bindHomeSettingsButton(node.matches("button") ? node.parentElement : node);
  }));
});
homeButtonObserver.observe(document.body, { childList: true, subtree: true });
bindHomeSettingsButton();

export function tryEnterFullscreen() {
  if (document.fullscreenElement !== null || !document.fullscreenEnabled) return;
  document.documentElement
    .requestFullscreen({ navigationUI: "hide" })
    .then(() => console.log("Fullscreen mode activated"))
    .catch((error) => console.warn("Could not enter fullscreen mode:", error));
}

let fullscreenAttempted = false;
document.addEventListener("mousedown", () => {
  if (!settings.useFullscreenMode || fullscreenAttempted) return;
  fullscreenAttempted = true;
  tryEnterFullscreen();
}, { passive: true, capture: true });

settingsManager.applySettings();

export default settingsManager;
export const getSettings = () => settings;
