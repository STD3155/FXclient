import { getVar } from "./gameInterface.js";
import { getSettings } from "./settings.js";
import hoveringTooltip from "./hoveringTooltip.js";
import { requireElementById } from "./dom.js";

const replay = {
    totalTicks: 0,
    seekTarget: null,
    restoreState: null,
    isRestarting: false,
    tick: 0,
    hooks: null,
    controls: null,
    togglePlayPause: () => {},
    restartReplay: () => {},

    registerHooks(hooks) {
        this.hooks = hooks;
        this.tick = 0;
        if (!this.isRestarting) this.seekTarget = this.restoreState = null;
        this.isRestarting = false;
        startBarUpdates();
    },

    isWatching() {
        return Boolean(getVar("gIsReplay") && getVar("gameState") !== 0);
    },

    getTotalTicks() {
        const flags = getVar("tickFlags"), counts = getVar("tickCounts");
        if (!counts) return 0;
        if (counts !== this.countedEntries) {
            this.countedEntries = counts;
            this.totalTicks = 0;
            for (let i = 0; i < counts.length; i++) this.totalTicks += flags[i] ? 1 : counts[i];
        }
        return this.totalTicks;
    },

    getTickDuration() {
        const interval = this.hooks ? this.hooks.getTickInterval() : 56;
        return getVar("gSelectableSpawn") && !getVar("gIsSingleplayer") ? interval * 7 : interval;
    },

    seek(targetTick) {
        if (!this.isWatching() || !this.hooks) return;
        this.seekTarget = Math.max(0, Math.min(Math.round(targetTick), this.getTotalTicks()));
        if (this.seekTarget >= this.tick) return;
        if (!this.restoreState) this.restoreState =
            { playing: this.controls.fxIsPlaying(), speed: this.controls.fxGetSpeedIndex() };
        this.isRestarting = true;
        this.restartReplay();
    },

    frame() {
        if (this.seekTarget === null) return false;
        const hooks = this.hooks;
        // Keep replay seeking cooperative so input and rendering get a chance
        // to run between simulation batches.
        const deadline = performance.now() + 12;
        while (this.tick < this.seekTarget && !hooks.isEnded() && performance.now() < deadline)
            hooks.advance();
        hooks.finishTick();
        hooks.requestRedraw();
        if (this.tick < this.seekTarget && !hooks.isEnded()) return true;
        this.seekTarget = null;
        const restore = this.restoreState;
        if (restore) {
            this.restoreState = null;
            this.controls.fxSetSpeedIndex(restore.speed);
            if (restore.playing && !hooks.isEnded() && !this.controls.fxIsPlaying()) this.togglePlayPause();
        }
        return true;
    }
};

function createElement(tag, className, parent) {
    const element = document.createElement(tag);
    element.className = className;
    parent.append(element);
    return element;
}

const bar = createElement("div", "flex d-none", requireElementById("windowContainer"));
bar.id = "replayTimebar";
const currentTime = createElement("span", "replay-time", bar);
const track = createElement("div", "replay-track", bar);
const totalTime = createElement("span", "replay-time color-light-gray", bar);
const fill = createElement("div", "replay-fill", track);
const marker = createElement("div", "replay-target d-none", track);
const playButton = createElement("button", "replay-control", bar);
const rewindButton = createElement("button", "replay-control", bar);
const forwardButton = createElement("button", "replay-control", bar);
playButton.type = rewindButton.type = forwardButton.type = "button";
playButton.textContent = "▶";
playButton.title = "Play or pause (Space)";
playButton.setAttribute("aria-label", "Play or pause replay");
rewindButton.textContent = "−10s";
rewindButton.title = "Jump back 10 seconds (Left arrow)";
forwardButton.textContent = "+10s";
forwardButton.title = "Jump forward 10 seconds (Right arrow)";
bar.prepend(playButton, rewindButton);

let drag = null;

function jumpBy(seconds) {
    if (!replay.isWatching()) return;
    const tickDuration = replay.getTickDuration();
    if (!tickDuration) return;
    replay.seek(replay.tick + seconds * 1000 / tickDuration);
}

playButton.addEventListener("click", () => replay.togglePlayPause());
rewindButton.addEventListener("click", () => jumpBy(-10));
forwardButton.addEventListener("click", () => jumpBy(10));

document.addEventListener("keydown", (event) => {
    if (!replay.isWatching() || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
    if (event.key === " ") replay.togglePlayPause();
    else if (event.key === "ArrowLeft") jumpBy(-10);
    else if (event.key === "ArrowRight") jumpBy(10);
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
});

const trackFraction = (event) => {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return 0;
    const fraction = (event.clientX - rect.left) / rect.width;
    return fraction < 0 ? 0 : fraction > 1 ? 1 : fraction;
};
track.addEventListener("pointerdown", (event) => {
    if (!replay.isWatching()) return;
    event.preventDefault();
    track.setPointerCapture(event.pointerId);
    drag = trackFraction(event);
});
track.addEventListener("pointermove", (event) => {
    if (drag !== null) drag = trackFraction(event);
});
track.addEventListener("pointerup", (event) => {
    if (drag === null) return;
    drag = null;
    replay.seek(trackFraction(event) * replay.getTotalTicks());
});
track.addEventListener("pointercancel", () => drag = null);

const formatTime = (time) => {
    let s = Math.floor(time / 1000);
    const m = Math.floor(s / 60);
    s %= 60;
    return m + (s < 10 ? ":0" : ":") + s;
};

let barAnimationFrame = null;
let barVisible = false;
let lastBottom = "";
let lastFill = "";
let lastMarker = "";
let lastSeeking = false;
let lastCurrentTime = "";
let lastTotalTime = "";
let lastPlaying = null;

function startBarUpdates() {
    if (barAnimationFrame === null) barAnimationFrame = requestAnimationFrame(updateBar);
}

function updateBar() {
    barAnimationFrame = null;
    const watching = replay.isWatching();
    const visible = getSettings().showReplayTimebar && watching && !getVar("uiHidden");
    if (visible !== barVisible) {
        barVisible = visible;
        bar.classList.toggle("d-none", !visible);
    }
    if (!visible) {
        drag = null;
        if (watching) startBarUpdates();
        return;
    }
    const panelTop = replay.controls && replay.controls.fxGetPanelTop();
    const scale = hoveringTooltip.canvasPixelScale || window.devicePixelRatio || 1;
    const bottom = panelTop > 0 ? Math.max(0, Math.round(window.innerHeight - panelTop / scale) + 8) + "px" : "";
    if (bottom !== lastBottom) bar.style.bottom = lastBottom = bottom;

    const total = replay.getTotalTicks();
    const seeking = replay.seekTarget !== null && total !== 0;
    let fraction = total ? Math.min(replay.tick / total, 1) : 0;
    if (drag !== null) fraction = drag;

    const fillWidth = (Math.max(0, fraction) * 100).toFixed(2) + "%";
    if (fillWidth !== lastFill) fill.style.width = lastFill = fillWidth;
    if (seeking !== lastSeeking) {
        lastSeeking = seeking;
        bar.classList.toggle("seeking", seeking);
        marker.classList.toggle("d-none", !seeking);
    }
    if (seeking) {
        const markerPosition = (Math.min(replay.seekTarget / total, 1) * 100).toFixed(2) + "%";
        if (markerPosition !== lastMarker) marker.style.left = lastMarker = markerPosition;
    }

    const tickDuration = replay.getTickDuration();
    const nextCurrentTime = formatTime(fraction * total * tickDuration);
    const nextTotalTime = formatTime(total * tickDuration);
    if (nextCurrentTime !== lastCurrentTime) currentTime.textContent = lastCurrentTime = nextCurrentTime;
    if (nextTotalTime !== lastTotalTime) totalTime.textContent = lastTotalTime = nextTotalTime;
    const playing = Boolean(replay.controls?.fxIsPlaying());
    if (playing !== lastPlaying) {
        lastPlaying = playing;
        playButton.textContent = playing ? "⏸" : "▶";
        playButton.setAttribute("aria-label", playing ? "Pause replay" : "Play replay");
    }
    startBarUpdates();
}
startBarUpdates();

export default replay;
