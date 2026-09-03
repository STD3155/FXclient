import { getVar } from "./gameInterface.js";
import { escapeHtml } from "./utils.js";
import donationsTracker from "./donationsTracker.js";
import WindowManager from "./windowManager.js";

const playerList = new (function () {
    const playersIcon = document.createElement('img');
    playersIcon.setAttribute('src', 'assets/players_icon.png');
    const content = document.getElementById("playerlist_content");
    function activatePlayer(event) {
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        const row = event.target.closest("tr[data-player-id]");
        if (!row || !getVar("gIsTeamGame")) return;
        if (event.type === "keydown") event.preventDefault();
        WindowManager.closeWindow("playerList");
        donationsTracker.displayHistory(Number(row.dataset.playerId));
    }
    content.addEventListener("click", activatePlayer);
    content.addEventListener("keydown", activatePlayer);
    this.display = function displayPlayerList(playerNames) {
        const gHumans = getVar("gHumans");
        const gLobbyMaxJoin = getVar("gLobbyMaxJoin");
        const isTeamGame = getVar("gIsTeamGame");
        const rows = [`<tr class="player-list-section"><th>Players (${gHumans})</th></tr>`];
        for (let i = 0; i < gLobbyMaxJoin; i++) {
            if (i === gHumans) rows.push(`<tr class="player-list-section"><th>Bots (${gLobbyMaxJoin - gHumans})</th></tr>`);
            rows.push(`<tr data-player-id="${i}"${isTeamGame ? ' tabindex="0"' : ""}><td><span class="color-light-gray">${i + 1}.</span> ${escapeHtml(playerNames[i])}</td></tr>`);
        }
        content.innerHTML = rows.join("");
        content.className = isTeamGame ? "clickable" : "";
        WindowManager.openWindow("playerList");
    }
    this.hoveringOverButton = false;
    this.drawButton = (canvas, x, y, size) => {
        canvas.fillRect(x, y, size, size);
        canvas.fillStyle = this.hoveringOverButton ? "#aaaaaaaa" : "#000000aa";
        canvas.clearRect(x + 1, y + 1, size - 2, size - 2);
        canvas.fillRect(x + 1, y + 1, size - 2, size - 2);
        canvas.fillStyle = "#ffffff";
        canvas.imageSmoothingEnabled = true;
        canvas.drawImage(playersIcon, x + 2, y + 2, size - 4, size - 4);
        canvas.imageSmoothingEnabled = false;
    }
});
WindowManager.add({
    name: "playerList",
    element: document.getElementById("playerlist")
});

export default playerList
