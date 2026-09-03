import { getSettings, tryEnterFullscreen } from "./settings.js";

var windows = {};
let fullscreenAttempted = false;

const container = document.getElementById("windowContainer");
function create(info) {
  const window = document.createElement("div");
  info.element = window;
  window.className =
    "window" +
    (info.classes !== undefined
      ? " " + info.classes
      : " scrollable selectable");
  window.style.display = "none";
  if (info.closeWithButton === true) {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => closeWindow(info.name));
    button.textContent = "Close";
    queueMicrotask(() => window.appendChild(button));
  }
  container.appendChild(window);
  add(info);
  return window;
}
function add(newWindow) {
  windows[newWindow.name] = newWindow;
  newWindow.isOpen = false;
  newWindow.element.setAttribute("role", "dialog");
  newWindow.element.setAttribute("aria-hidden", "true");
  newWindow.element.tabIndex = -1;
  if (newWindow.modal === true) newWindow.element.setAttribute("aria-modal", "true");
}
function openWindow(windowName, ...args) {
  if (windows[windowName].isOpen === true) return;
  if (windows[windowName].beforeOpen !== undefined)
    windows[windowName].beforeOpen(...args);
  windows[windowName].previousFocus = document.activeElement;
  windows[windowName].isOpen = true;
  windows[windowName].element.style.display = null;
  windows[windowName].element.setAttribute("aria-hidden", "false");
  windows[windowName].element.focus({ preventScroll: true });
}
function closeWindow(windowName) {
  if (windows[windowName].isOpen === false) return;
  windows[windowName].isOpen = false;
  windows[windowName].element.style.display = "none";
  windows[windowName].element.setAttribute("aria-hidden", "true");
  if (windows[windowName].onClose !== undefined) windows[windowName].onClose();
  const previousFocus = windows[windowName].previousFocus;
  if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
}
function isWindowOpen(windowName) {
  return windows[windowName].isOpen === true;
}
function setWindowVisible(windowName, visible) {
  windows[windowName].element.style.display = visible ? null : "none";
  windows[windowName].element.setAttribute("aria-hidden", visible ? "false" : "true");
}
function closeAll() {
  const windowList = Object.values(windows);
  if (windowList.some((windowObj) => windowObj.modal === true && windowObj.isOpen === true)) return;
  windowList.forEach(function (windowObj) {
    if (windowObj.closable !== false) closeWindow(windowObj.name);
  });
}
document.addEventListener(
  "mousedown",
  (e) => {
    // when clicking outside a window
    if (!container.contains(e.target)) closeAll();

    const isFullScreenEnabled = getSettings().useFullscreenMode;

    if (isFullScreenEnabled && !fullscreenAttempted) {
      fullscreenAttempted = true;
      tryEnterFullscreen();
    }
  },
  { passive: true, capture: true }
);

document
  .getElementById("canvasA")
  .addEventListener("touchstart", closeAll, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAll();
});

export default { create, add, openWindow, closeWindow, closeAll, isWindowOpen, setWindowVisible };
