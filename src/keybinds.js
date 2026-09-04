import { getUIGap, getVar } from "./gameInterface.js";
import { getSettings } from "./settings.js";
import economicAttack from "./economicAttack.js";

export const keybindFunctions = {
    setAbsolute: () => {},
    setRelative: () => {},
    repaintAttackPercentageBar: () => {}
};
export const keybindHandler = key => {
    const keybindData = getSettings().attackPercentageKeybinds.find(keybind => keybind.key === key);
    if (keybindData === undefined) return false;
    if (getVar("gameState") !== 0) executeKeybind(keybindData);
    return true;
};
function executeKeybind(keybind) {
    if (keybind.type === "absolute") keybindFunctions.setAbsolute(keybind.value);
    else keybindFunctions.setRelative(keybind.value);
    keybindFunctions.repaintAttackPercentageBar();
}

// mobile keybinds (keybind buttons)

let canvas;
let width = 0;
let height = 0;
let fontName = "sans-serif";
const keybindCount = 6;
const slotCount = keybindCount + 1;

function renderMobileButtons() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.font = "bold " + height / 2 + "px " + fontName;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const gap = getUIGap() / 4;
    const buttonWidth = (width - gap * (slotCount - 1)) / slotCount;
    const drawButton = (index, label, active = false) => {
        const x = index * (buttonWidth + gap);
        ctx.fillStyle = active ? "rgba(0, 125, 35, 0.92)" : "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(x, 0, buttonWidth, height);
        ctx.fillStyle = "white";
        ctx.fillText(label, x + buttonWidth / 2, height / 2);
    };

    drawButton(0, economicAttack.isArmed() ? "ECO ✓" : "ECO", economicAttack.isArmed());
    if (getSettings().keybindButtons !== true) return;
    getSettings().attackPercentageKeybinds.slice(0, keybindCount).forEach((keybind, i) => {
        const label = keybind.type === "absolute" ? (keybind.value * 100).toFixed() + "%" : "x " + Math.round(keybind.value * 100) / 100;
        drawButton(i + 1, label);
    });
}

export const mobileKeybinds = {
    setSize: (w, h, mainCanvas) => {
        const newFontName = mainCanvas.font.split("px ", 2)[1] || "sans-serif";
        if (canvas && width === w && height === h && fontName === newFontName) {
            renderMobileButtons();
            return;
        }
        width = w;
        height = h;
        fontName = newFontName;

        if (!canvas) canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        renderMobileButtons();
    },
    click: (xRelative) => {
        if (width <= 0 || xRelative < 0 || xRelative > width) return false;
        const gap = getUIGap() / 4;
        const buttonWidth = (width - gap * (slotCount - 1)) / slotCount;
        const stride = buttonWidth + gap;
        const index = Math.floor(xRelative / stride);
        if (index < 0 || index >= slotCount || xRelative - index * stride > buttonWidth) return false;
        if (index === 0) {
            economicAttack.toggle();
            renderMobileButtons();
            keybindFunctions.repaintAttackPercentageBar();
            return true;
        }
        if (getSettings().keybindButtons !== true) return false;
        const keybind = getSettings().attackPercentageKeybinds[index - 1];
        if (!keybind) return false;
        executeKeybind(keybind);
        return true;
    },
    draw: (mainCanvas, x, y) => {
        if (!canvas) return;
        mainCanvas.drawImage(canvas, x, y - (height + getUIGap() / 4));
    }
}

economicAttack.subscribe(() => {
    renderMobileButtons();
    keybindFunctions.repaintAttackPercentageBar();
});
