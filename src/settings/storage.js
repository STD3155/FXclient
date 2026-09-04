import { createSettingsDocument, defaultSettings, normalizeSettings } from "./schema.js";

const STORAGE_KEY = "fx_settings";

export function loadSettings() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return normalizeSettings(defaultSettings);
  try {
    return normalizeSettings(JSON.parse(stored));
  } catch (error) {
    console.warn("Ignoring invalid saved settings:", error);
    localStorage.removeItem(STORAGE_KEY);
    return normalizeSettings(defaultSettings);
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createSettingsDocument(settings)));
}

export function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
}

export function parseSettingsFile(content) {
  return normalizeSettings(JSON.parse(content));
}

export function downloadFile(content, fileName, contentType) {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type: contentType }));
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportSettings(settings) {
  downloadFile(
    JSON.stringify(createSettingsDocument(settings), null, 2),
    "FX_client_settings.json",
    "application/json"
  );
}
