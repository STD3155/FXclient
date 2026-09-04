import { getSettings, tryEnterFullscreen } from "./settings.js";

var windows = {};
let fullscreenAttempted = false;

const container = document.getElementById("windowContainer");
const backdrop = document.createElement("div");
backdrop.className = "window-backdrop d-none";
container.prepend(backdrop);

function updateBackdrop() {
  const visible = Object.values(windows).some((windowObj) => windowObj.isOpen);
  backdrop.classList.toggle("d-none", !visible);
}

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
    button.className = "window-close";
    button.setAttribute("aria-label", "Close dialog");
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
  const windowObj = windows[windowName];
  if (!windowObj) {
    console.error(`Unknown window: ${windowName}`);
    return;
  }
  if (windowObj.isOpen === true) return;
  if (windowObj.beforeOpen !== undefined) {
    try {
      windowObj.beforeOpen(...args);
    } catch (error) {
      console.error(`Could not prepare window ${windowName}:`, error);
      window.__fx?.notifications?.show(`Some ${windowName} content could not be loaded`, "error", 5000);
    }
  }
  windowObj.previousFocus = document.activeElement;
  windowObj.isOpen = true;
  windowObj.element.style.display = null;
  windowObj.element.setAttribute("aria-hidden", "false");
  const heading = windowObj.element.querySelector("h1, h2, h3");
  if (heading && !windowObj.element.hasAttribute("aria-labelledby")) {
    if (!heading.id) heading.id = `fx-dialog-title-${windowName}`;
    windowObj.element.setAttribute("aria-labelledby", heading.id);
  }
  updateBackdrop();
  windowObj.element.focus({ preventScroll: true });
}
function closeWindow(windowName) {
  if (windows[windowName].isOpen === false) return;
  windows[windowName].isOpen = false;
  windows[windowName].element.style.display = "none";
  windows[windowName].element.setAttribute("aria-hidden", "true");
  if (windows[windowName].onClose !== undefined) windows[windowName].onClose();
  updateBackdrop();
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
backdrop.addEventListener("click", closeAll);
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
  const openWindows = Object.values(windows).filter((windowObj) => windowObj.isOpen && windowObj.element.style.display !== "none");
  const topWindow = openWindows[openWindows.length - 1];
  if (event.key === "Escape") {
    if (topWindow?.closable !== false) closeWindow(topWindow.name);
    return;
  }
  if (event.key !== "Tab" || topWindow?.modal !== true) return;
  const focusable = Array.from(topWindow.element.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
  )).filter((element) => element.offsetParent !== null);
  if (!focusable.length) return event.preventDefault();
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

export default { create, add, openWindow, closeWindow, closeAll, isWindowOpen, setWindowVisible };
