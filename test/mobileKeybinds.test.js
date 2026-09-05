import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createAutoExpandController } from "../src/autoExpand.js";

test("ECO canvas displays the live cooldown and returns to the ready label", () => {
  const labels = [];
  const ctx = { clearRect() {}, fillRect() {}, fillText(text) { labels.push(text); } };
  const autoExpand = createAutoExpandController();
  let onEconomicModeChange;
  const source = readFileSync(new URL("../src/keybinds.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
  const context = vm.createContext({
    document: { createElement: () => ({ getContext: () => ctx }) },
    getUIGap: () => 10,
    getSettings: () => ({ keybindButtons: false }),
    economicAttack: { isArmed: () => true, subscribe(listener) { onEconomicModeChange = listener; } },
    autoExpand
  });
  vm.runInContext(source + '\nkeybindFunctions.repaintAttackPercentageBar = () => { throw new Error("attack bar not initialized"); };', context);
  assert.doesNotThrow(() => onEconomicModeChange());
  assert.doesNotThrow(() => autoExpand.reset());
  vm.runInContext('keybindFunctions.repaintAttackPercentageBar = () => {}; mobileKeybinds.setSize(700, 40, { font: "16px sans-serif" });', context);
  assert.equal(labels.at(-1), "ECO ✓");
  const attack = autoExpand.planProactive(0, 9_900, 100, 10_100, 10, 512);
  autoExpand.acknowledge(512, attack.encoded, 0);
  assert.equal(labels.at(-1), "2.8s");
  autoExpand.update(25);
  assert.equal(labels.at(-1), "1.4s");
  autoExpand.update(50);
  assert.equal(labels.at(-1), "ECO ✓");
});
