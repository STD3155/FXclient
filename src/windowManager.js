import { requireElementById } from "./dom.js";

const windows = new Map();
const container = requireElementById("windowContainer");
const backdrop = document.createElement("div");
backdrop.className = "window-backdrop d-none";
container.prepend(backdrop);

function updateBackdrop() {
  const visible = Array.from(windows.values()).some((windowObj) => windowObj.isOpen);
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
  if (!newWindow?.name || !newWindow.element) throw new TypeError("A window needs a name and element");
  windows.set(newWindow.name, newWindow);
  newWindow.isOpen = false;
  newWindow.element.setAttribute("role", "dialog");
  newWindow.element.setAttribute("aria-hidden", "true");
  newWindow.element.tabIndex = -1;
  if (newWindow.modal === true) newWindow.element.setAttribute("aria-modal", "true");
}
function openWindow(windowName, ...args) {
  const windowObj = windows.get(windowName);
  if (!windowObj) {
    console.error(`Unknown window: ${windowName}`);
    return;
  }
  if (windowObj.isOpen === true) return;
  // The game appends and reorders its own full-screen elements while changing
  // menus. Keeping our layer last prevents those elements from covering it.
  if (container.parentElement === document.body && container !== document.body.lastElementChild) {
    document.body.appendChild(container);
  }
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
  const windowObj = windows.get(windowName);
  if (!windowObj?.isOpen) return;
  windowObj.isOpen = false;
  windowObj.element.style.display = "none";
  windowObj.element.setAttribute("aria-hidden", "true");
  windowObj.onClose?.();
  updateBackdrop();
  const previousFocus = windowObj.previousFocus;
  if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
}
function isWindowOpen(windowName) {
  return windows.get(windowName)?.isOpen === true;
}
function setWindowVisible(windowName, visible) {
  const windowObj = windows.get(windowName);
  if (!windowObj) return;
  windowObj.element.style.display = visible ? null : "none";
  windowObj.element.setAttribute("aria-hidden", visible ? "false" : "true");
}
function closeAll() {
  const windowList = Array.from(windows.values());
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
  },
  { passive: true, capture: true }
);

requireElementById("canvasA").addEventListener("touchstart", closeAll, { passive: true });
document.addEventListener("keydown", (event) => {
  const openWindows = Array.from(windows.values())
    .filter((windowObj) => windowObj.isOpen && windowObj.element.style.display !== "none");
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
