export const SETTINGS_VERSION = 1;

export const defaultSettings = Object.freeze({
  displayWinCounter: true,
  displayTickNumber: true,
  useFullscreenMode: false,
  hoveringTooltip: true,
  realisticNames: false,
  playerStatsMode: "both",
  adaptivePlayerStats: true,
  coloredDensity: true,
  densityDisplayStyle: "absoluteQuotient",
  hideBotNames: false,
  highlightClanSpawns: false,
  highlightDuplicateIps: false,
  detailedTeamPercentage: false,
  openDonationHistoryFromLb: true,
  customBackgroundUrl: "",
  keybindButtons: false,
  attackPercentageKeybinds: [],
  startingPercentageEnabled: false,
  startingPercentage: 50,
  hidePropagandaPopup: false,
  showReplayTimebar: true,
  customQuickEmojisEnabled: false,
  customQuickEmojis: [],
  lobbyReminderRules: [],
  mutePingAll: false,
  mutePingEveryone: false,
  mutePingRoom: false,
  mutePingClan: false,
  mutePingLanguage: false,
  mutePingDirect: false,
  hideInappropriateNames: false,
  followedAccountNicknames: {}
});

export const discontinuedSettings = Object.freeze([
  "hideAllLinks",
  "fontName",
  "showPlayerDensity",
  "showPlayerGrowth"
]);

const statModes = new Set(["off", "growth", "density", "both"]);

function cloneDefault(defaultValue) {
  if (Array.isArray(defaultValue)) return [];
  if (defaultValue !== null && typeof defaultValue === "object") return {};
  return defaultValue;
}

function unwrapDocument(document) {
  if (document !== null && typeof document === "object" && !Array.isArray(document)
    && document.values !== null && typeof document.values === "object" && !Array.isArray(document.values))
    return document.values;
  return document;
}

export function normalizeSettings(document) {
  const value = unwrapDocument(document);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Settings must be a JSON object");

  const normalized = {};
  Object.entries(defaultSettings).forEach(([key, defaultValue]) => {
    const candidate = value[key];
    if (Array.isArray(defaultValue))
      normalized[key] = Array.isArray(candidate) ? candidate.slice() : cloneDefault(defaultValue);
    else if (defaultValue !== null && typeof defaultValue === "object")
      normalized[key] = candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
        ? { ...candidate } : cloneDefault(defaultValue);
    else
      normalized[key] = typeof candidate === typeof defaultValue ? candidate : defaultValue;
  });

  if (!statModes.has(value.playerStatsMode)) {
    const growth = value.showPlayerGrowth !== false;
    const density = value.showPlayerDensity !== false;
    normalized.playerStatsMode = growth && density ? "both" : growth ? "growth" : density ? "density" : "off";
  }
  normalized.attackPercentageKeybinds = normalized.attackPercentageKeybinds
    .filter((entry) => entry !== null && typeof entry === "object")
    .map((entry) => ({
      key: typeof entry.key === "string" ? entry.key : "",
      type: entry.type === "relative" ? "relative" : "absolute",
      value: Number.isFinite(Number(entry.value)) ? Number(entry.value) : 0.8,
    }));
  normalized.lobbyReminderRules = normalized.lobbyReminderRules
    .filter((entry) => entry !== null && typeof entry === "object")
    .map((entry) => ({ ...entry }));
  normalized.customQuickEmojis = normalized.customQuickEmojis
    .map((entry) => Number(entry?.code ?? entry))
    .filter(Number.isFinite)
    .slice(0, 9);

  // These values are only needed for the one-time emoji migration.
  if (Array.isArray(value.emojiBar)) normalized.emojiBar = value.emojiBar;
  if (typeof value.customEmojiBar === "boolean") normalized.customEmojiBar = value.customEmojiBar;
  return normalized;
}

export function createSettingsDocument(settings) {
  const values = { ...settings };
  discontinuedSettings.forEach((key) => delete values[key]);
  delete values.emojiBar;
  delete values.customEmojiBar;
  return { version: SETTINGS_VERSION, values };
}
