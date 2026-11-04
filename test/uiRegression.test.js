import assert from "node:assert/strict";
import test from "node:test";
import { createDomContext } from "./helpers/dom.js";

function setupWindows() {
  const dom = createDomContext();
  dom.addElement("windowContainer");
  dom.addElement("canvasA", "canvas");
  const manager = dom.load("windowManager.js");
  dom.context.WindowManager = manager;
  return { ...dom, manager };
}

test("keybind Add, Edit and Delete persist only when saved; reopening discards a draft", () => {
  const dom = createDomContext();
  const KeybindEditor = dom.load("keybindsInput.js", "KeybindsInput");
  const editor = new KeybindEditor(dom.addElement("keybinds"));
  const settings = { attackPercentageKeybinds: [{ key: "q", type: "absolute", value: 0.8 }] };
  editor.update(settings);
  editor.updateObject(0, "value", { target: { value: "15" } });
  assert.equal(settings.attackPercentageKeybinds[0].value, 0.8);
  editor.update(settings);
  assert.equal(editor.objectArray[0].value, 0.8);
  editor.addObject();
  editor.updateObject(1, "key", { key: "w" });
  editor.updateObject(1, "value", { target: { value: "25" } });
  editor.deleteObject(0);
  editor.save(settings);
  assert.equal(settings.attackPercentageKeybinds.length, 1);
  assert.equal(settings.attackPercentageKeybinds[0].key, "w");
  assert.equal(settings.attackPercentageKeybinds[0].value, 0.25);
  editor.updateObject(0, "value", { target: { value: "50" } });
  assert.equal(settings.attackPercentageKeybinds[0].value, 0.25);
});

for (const action of ["cancel", "escape", "backdrop"]) {
  test(`dismissing a confirmation via ${action} preserves settings and restores focus`, async () => {
    const dom = setupWindows();
    const settings = dom.addElement("settings");
    dom.manager.add({ name: "settings", element: settings });
    dom.manager.openWindow("settings");
    const button = dom.document.createElement("button");
    settings.append(button);
    button.focus();
    const notifications = dom.load("notifications.js");
    const confirmation = notifications.confirm("Reset settings?");
    const overlay = dom.document.querySelector(".fx-confirm-overlay");
    if (action === "escape") dom.dispatch("keydown", dom.document.activeElement, { key: "Escape" });
    else {
      const target = action === "backdrop" ? overlay : dom.document.activeElement;
      dom.dispatch("mousedown", target);
      dom.dispatch("click", target);
    }
    assert.equal(await confirmation, false);
    assert.equal(dom.manager.isWindowOpen("settings"), true);
    assert.equal(dom.document.activeElement, button);
  });
}

test("Escape is harmless without a window and still closes an ordinary window", () => {
  const dom = setupWindows();
  assert.doesNotThrow(() => dom.dispatch("keydown", dom.document.body, { key: "Escape" }));
  dom.manager.add({ name: "settings", element: dom.addElement("settings") });
  dom.manager.openWindow("settings");
  dom.dispatch("keydown", dom.document.body, { key: "Escape" });
  assert.equal(dom.manager.isWindowOpen("settings"), false);
});

test("replay Space toggles once per press and blocks the game's keyup toggle", () => {
  const dom = createDomContext();
  dom.addElement("windowContainer");
  dom.context.getVar = name => ({ gIsReplay: true, gameState: 1 })[name];
  const replay = dom.load("replay.js");
  let toggles = 0;
  replay.togglePlayPause = () => toggles++;
  dom.document.addEventListener("keyup", event => { if (event.code === "Space") toggles++; });
  const space = { key: " ", code: "Space" };
  dom.dispatch("keydown", dom.document.body, space);
  dom.dispatch("keydown", dom.document.body, { ...space, repeat: true });
  dom.dispatch("keyup", dom.document.body, space);
  assert.equal(toggles, 1);
  dom.dispatch("keydown", dom.document.body, space);
  dom.dispatch("keyup", dom.document.body, space);
  assert.equal(toggles, 2);
  const input = dom.addElement("chat", "input");
  dom.dispatch("keydown", input, space);
  dom.dispatch("keyup", input, space);
  assert.equal(toggles, 3, "typing Space in an input must not be intercepted");
});

for (const copyFails of [false, true]) {
  test(`copying a shared lobby URL replaces its existing hash (clipboard fails: ${copyFails})`, async () => {
    const dom = setupWindows();
    for (const id of ["customLobbyJoinMenu", "lobbyCode", "createLobbyButton", "customLobbyRegion"]) dom.addElement(id);
    dom.window.location.href = "https://example.test/FXclient/?mode=team#lobby=abcde";
    dom.window.location.hash = "#lobby=abcde";
    let copied;
    let errorShown = false;
    dom.context.navigator.clipboard = { async writeText(value) { if (copyFails) throw new Error("denied"); copied = value; } };
    dom.context.notifications = { show: () => { errorShown = true; } };
    const lobby = dom.load("customLobby.js");
    lobby.setJoinFunction(() => {});
    dom.timers.shift()();
    const copy = dom.document.body.querySelectorAll("button").find(button => button.textContent === "Copy link");
    await copy.listeners.get("click")[0].callback();
    if (copyFails) {
      assert.equal(errorShown, true);
      assert.equal(copy.textContent, "Copy link");
    } else {
      assert.equal(copied, "https://example.test/FXclient/?mode=team#lobby=abcde");
      assert.equal(copy.textContent, "Copied!");
    }
  });
}
