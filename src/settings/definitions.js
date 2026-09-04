import { KeybindsInput } from "../keybindsInput.js";
import { LobbyReminderRulesInput } from "../lobbyReminderRulesInput.js";
import { FollowedAccountNicknames } from "../followedAccounts.js";
import winCounter from "../winCounter.js";
import versionData from "../../version.json";
import { displayChangelog } from "../changelog.js";
import {
  createButton,
  createMutePingSection,
  createPerformancePresets,
  createReplayHistoryList,
  createStartingPercentage
} from "./components.js";
import { component, section } from "./ui.js";

const construct = (Constructor) => (container) => new Constructor(container);

function createFooter(container) {
  const versionInfo = document.createElement("p");
  versionInfo.textContent = `FX Client v${versionData.version}`;
  const links = document.createElement("p");
  links.innerHTML = `<a href="https://discord.gg/dyxcwdNKwK" target="_blank">Discord server</a> |
    <a href="https://github.com/fxclient/FXclient#readme">Github repository</a>`;
  container.append(versionInfo, links, createButton("Changelog", displayChangelog));
  return {};
}

export function createSettingsDefinitions({ customQuickEmojis, applyPreset }) {
  return [
    section("Interface & performance"),
    component((container) => createPerformancePresets(container, applyPreset), "quick presets performance balanced maximum info"),
    {
      for: "displayWinCounter",
      type: "checkbox",
      label: "Display win counter",
      note: "The win counter tracks multiplayer solo wins (not in team games)"
    },
    { type: "button", text: "Reset win counter", action: winCounter.removeWins },
    { for: "displayTickNumber", type: "checkbox", label: "Display tick number near the balance" },
    {
      for: "useFullscreenMode",
      type: "checkbox",
      label: "Use fullscreen mode",
      note: "Note: fullscreen mode will trigger after you click anywhere on the page due to browser policy restrictions."
    },
    {
      for: "hoveringTooltip",
      type: "checkbox",
      label: "Hovering tooltip",
      note: "Display map territory info constantly (on mouse hover) instead of only when right clicking on the map"
    },
    { for: "realisticNames", type: "checkbox", label: "Realistic Bot Names" },
    component(customQuickEmojis, "custom quick emojis"),

    section("Map information"),
    {
      for: "playerStatsMode",
      type: "selectMenu",
      label: "Map stats:",
      note: "Choose which additional values are displayed below player names.",
      options: [
        { value: "both", label: "Growth and density" },
        { value: "growth", label: "Growth only" },
        { value: "density", label: "Density only" },
        { value: "off", label: "Off" }
      ]
    },
    {
      for: "adaptivePlayerStats",
      type: "checkbox",
      label: "Hide map stats at low zoom",
      note: "Improves responsiveness by only drawing density and growth when player labels are large enough to read."
    },
    {
      for: "coloredDensity",
      type: "checkbox",
      label: "Colored density",
      note: "Display the density with a color between red and green depending on the density value"
    },
    {
      for: "densityDisplayStyle",
      type: "selectMenu",
      label: "Density value display style:",
      tooltip: "Controls how the territorial density value should be rendered",
      options: [
        { value: "percentage", label: "Percentage" },
        { value: "absoluteQuotient", label: "Value from 0 to 150 (BetterTT style)" }
      ]
    },
    { for: "hideBotNames", type: "checkbox", label: "Hide bot names" },
    {
      for: "highlightClanSpawns",
      type: "checkbox",
      label: "Highlight clan spawnpoints",
      note: "Increases the spawnpoint glow size for members of your clan"
    },
    {
      for: "highlightDuplicateIps",
      type: "checkbox",
      label: "Duplicate IP highlighting",
      note: "Highlights players in the lobby's team list who share the same IP hash. Each group of matching IPs gets its own color."
    },
    { for: "hidePropagandaPopup", type: "checkbox", label: "Hide propaganda popup" },
    {
      for: "detailedTeamPercentage",
      type: "checkbox",
      label: "Detailed team pie chart percentage",
      note: "For example: this would show 25.82% instead of 26% on the pie chart in team games"
    },
    {
      for: "openDonationHistoryFromLb",
      type: "checkbox",
      label: "Open donation history from the leaderboard",
      note: "Changes whether clicking a player's name in the team leaderboard opens their donation history"
    },

    section("Gameplay & controls"),
    {
      for: "customBackgroundUrl",
      type: "textInput",
      label: "Custom main menu background:",
      placeholder: "Enter an image URL here",
      tooltip: "A custom image to be shown as the main menu background instead of the currently selected map."
    },
    component(construct(KeybindsInput), "attack percentage keybinds"),
    { for: "keybindButtons", type: "checkbox", label: "Keybind buttons", note: "Show keybind buttons above the troop selector (max 6)" },
    component(createStartingPercentage, "starting attack percentage"),

    section("Replay"),
    {
      for: "showReplayTimebar",
      type: "checkbox",
      label: "Replay timebar",
      note: "Show a seek bar when watching replays. Seeking backward re-simulates the replay from the start."
    },
    section("Lobby game reminders"),
    component(construct(LobbyReminderRulesInput), "lobby game reminder rules"),
    section("Muted lobby pings"),
    component(createMutePingSection, "mute lobby pings"),
    section("Other"),
    {
      for: "hideInappropriateNames",
      type: "checkbox",
      label: "Inappropriate name hider",
      note: "Replaces player names that contain common offensive or inappropriate words with \"Hidden Name\"."
    },
    component(construct(FollowedAccountNicknames), "followed account nicknames"),
    component(createReplayHistoryList, "saved replay history"),
    component(createFooter)
  ];
}
