import WindowManager from "./windowManager.js";

// Custom-lobby patches are currently disabled. Keep only the small interface
// used by the rest of the client instead of constructing the full lobby UI.
const unavailableWindow = WindowManager.create({
    name: "customLobbiesUnavailable",
    closeWithButton: true
});
const unavailableMessage = document.createElement("p");
unavailableMessage.append("The latest version of FX Client doesn't support custom lobbies yet. Use the stable version at ");
const stableLink = document.createElement("a");
stableLink.href = "https://fxclient.github.io/custom-lobbies/";
stableLink.textContent = stableLink.href;
stableLink.target = "_blank";
stableLink.rel = "noopener";
unavailableMessage.append(stableLink);
unavailableWindow.prepend(unavailableMessage);

function showJoinPrompt() {
    WindowManager.openWindow("customLobbiesUnavailable");
}

function checkForLobbyLink() {
    if (window.location.hash.startsWith("#lobby=")) showJoinPrompt();
}

window.addEventListener("hashchange", checkForLobbyLink);
queueMicrotask(checkForLobbyLink);

const customLobby = {
    gameInfo: {},
    showJoinPrompt,
    isCustomMessage: () => false,
    getSocketURL: () => "",
    getPlayerId: () => 0,
    setJoinFunction: () => {},
    setLeaveFunction: () => {},
    setSendFunction: () => {},
    setMapInfo: () => {},
    rejoinLobby: () => {},
    hideWindow: () => {},
    isActive: () => false,
    setActive: () => {}
};

export default customLobby;
