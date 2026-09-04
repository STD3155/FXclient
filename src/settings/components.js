import WindowManager from "../windowManager.js";
import notifications from "../notifications.js";
import replayHistory from "../replayHistory.js";
import { downloadFile } from "./storage.js";

export function createButton(text, action) {
  const button = document.createElement("button");
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}

export function createPerformancePresets(container, applyPreset) {
  const label = document.createElement("small");
  label.textContent = "Quick presets: ";
  const presets = {
    Performance: { playerStatsMode: "growth", adaptivePlayerStats: true, coloredDensity: false, hoveringTooltip: false },
    Balanced: { playerStatsMode: "both", adaptivePlayerStats: true, coloredDensity: true, hoveringTooltip: true },
    "Maximum info": { playerStatsMode: "both", adaptivePlayerStats: false, coloredDensity: true, hoveringTooltip: true }
  };
  container.append(label);
  Object.entries(presets).forEach(([name, values]) => {
    container.append(createButton(name, () => applyPreset(name, values)));
  });
  return {};
}

function createCheckboxRow(labelText, note) {
  const label = document.createElement("label");
  label.className = "checkbox";
  label.append(labelText + " ");
  if (note) {
    const noteElement = document.createElement("small");
    noteElement.textContent = note;
    label.append(document.createElement("br"), noteElement);
  }
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const checkmark = document.createElement("span");
  checkmark.className = "checkmark";
  label.append(checkbox, checkmark);
  return { label, checkbox };
}

export function createStartingPercentage(container) {
  const { label, checkbox } = createCheckboxRow(
    "Custom starting attack percentage",
    "Sets a fixed attack percentage for the troop bar at the start of every game."
  );
  container.append(label, document.createElement("br"));
  const inputRow = document.createElement("div");
  Object.assign(inputRow.style, { display: "none", transition: "none", animation: "none" });
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "100";
  input.step = "0.1";
  input.placeholder = "50";
  inputRow.append("Percentage (%): ", input);
  container.append(inputRow, document.createElement("br"));

  const updateVisibility = () => inputRow.style.display = checkbox.checked ? "block" : "none";
  checkbox.addEventListener("change", () => {
    if (checkbox.checked && input.value.trim() === "") input.value = "50";
    updateVisibility();
  });
  return {
    save(settings) {
      settings.startingPercentageEnabled = checkbox.checked;
      settings.startingPercentage = input.value.trim() === "" ? 50 : Number(input.value);
    },
    update(settings) {
      checkbox.checked = !!settings.startingPercentageEnabled;
      input.value = settings.startingPercentage ?? 50;
      updateVisibility();
    }
  };
}

export function createMutePingSection(container) {
  const pingTypes = [
    { key: "mutePingEveryone", label: "Mute @all, @everyone and @0ya pings" },
    { key: "mutePingRoom", label: "Mute @room1 - @room4 pings" },
    { key: "mutePingClan", label: "Mute clan pings (@[TAG])" },
    { key: "mutePingLanguage", label: "Mute language pings (@en, @de, ...)" },
    { key: "mutePingDirect", label: "Mute pings of your username" }
  ];
  const master = createCheckboxRow("Mute all pings");
  container.append(master.label, document.createElement("br"));
  const subCheckboxes = {};
  const savedState = {};
  pingTypes.forEach(({ key, label, note }) => {
    const row = createCheckboxRow(label, note);
    container.append(row.label, document.createElement("br"));
    subCheckboxes[key] = row.checkbox;
    row.checkbox.addEventListener("change", () => savedState[key] = row.checkbox.checked);
  });
  function applyMasterState() {
    const allMuted = master.checkbox.checked;
    Object.keys(subCheckboxes).forEach((key) => {
      subCheckboxes[key].checked = allMuted ? true : (savedState[key] ?? false);
      subCheckboxes[key].disabled = allMuted;
    });
  }
  master.checkbox.addEventListener("change", () => {
    if (master.checkbox.checked)
      Object.keys(subCheckboxes).forEach((key) => savedState[key] = subCheckboxes[key].checked);
    applyMasterState();
  });
  return {
    update(settings) {
      Object.keys(subCheckboxes).forEach((key) => savedState[key] = !!settings[key]);
      master.checkbox.checked = !!settings.mutePingAll;
      applyMasterState();
    },
    save(settings) {
      settings.mutePingAll = master.checkbox.checked;
      Object.keys(subCheckboxes).forEach((key) => {
        settings[key] = master.checkbox.checked ? savedState[key] : subCheckboxes[key].checked;
      });
    }
  };
}

export function createReplayHistoryList(container) {
  const title = document.createElement("p");
  title.innerHTML = "<b>Saved Replays</b> (auto-saves your last 5 games)";
  const list = document.createElement("div");
  container.append(title, list);

  function formatTime(timestamp) {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
  }

  function render() {
    list.innerHTML = "";
    const replays = replayHistory.getAll();
    if (!replays.length) {
      const empty = document.createElement("small");
      empty.textContent = "No replays saved yet. Finish a game and it'll show up here.";
      list.append(empty);
      return;
    }
    replays.forEach((replay) => {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" });
      const label = document.createElement("small");
      label.textContent = formatTime(replay.timestamp);
      label.style.flex = "1";
      const loadButton = createButton("Load", () => {
        WindowManager.closeWindow("settings");
        replayHistory.load(replay.data);
      });
      const copyButton = createButton("Copy", () => {
        navigator.clipboard.writeText(replay.data).then(() => {
          copyButton.textContent = "Copied!";
          setTimeout(() => copyButton.textContent = "Copy", 1500);
        }).catch(() => notifications.show("Could not copy the replay", "error"));
      });
      const deleteButton = createButton("Delete", () => {
        replayHistory.remove(replay.timestamp);
        render();
      });
      const downloadButton = createButton("Download", () =>
        downloadFile(replay.data, `replay_${replay.timestamp}.txt`, "text/plain")
      );
      row.append(label, loadButton, copyButton, downloadButton, deleteButton);
      list.append(row);
    });
  }
  return { update: render };
}
