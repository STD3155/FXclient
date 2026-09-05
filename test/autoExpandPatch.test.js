import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import patch from "../patches/autoExpand.js";
import generalPatches from "../patches/patches.js";
import autoExpand, { createAutoExpandController } from "../src/autoExpand.js";
import economicAttack from "../src/economicAttack.js";

let hook;
patch({ insertCode: (_, code) => { hook = new vm.Script(code); }, replaceRawCode() {} });

function gameContext(tick) {
  const controller = { ...autoExpand, ...createAutoExpandController() };
  return {
    __fx: { autoExpand: controller, economicAttack: { isArmed: () => true } },
    aE: { fB: 0, fO: 512, km: 1, ha: false, l6: true, gl: 2, kW: 1_000_000,
      data: { aIncomeType: 1, aIncomeValue: 16, tIncomeType: 1, tIncomeValue: 48, iIncomeType: 1, iIncomeValue: 32 } },
    aN: { hb: false }, bi: { kj: () => tick, aCo: 56 },
    bD: { gn: { hc: () => true, hd: () => true, lQ: () => true } },
    ah: { hT: [512], hF: [12], h7: [[0]] },
    ad: { fT: [1], fI: cell => cell >= 1 && cell <= 48, h1: () => false },
    ae: { hU: () => 0 }, aS: { hv: () => 511 }, af: { aCn: () => 700 }
  };
}

test("game hook passes real territory and custom incomes into the opening planner", () => {
  const context = gameContext(0);
  let args;
  context.__fx.autoExpand.planOpening = (...values) => { args = values; return null; };
  hook.runInNewContext(context);
  assert.equal(args[2].length, 48);
  assert.deepEqual({ ...args[7] }, { territory: 12, armyIncomeScale: 16, territorialIncomeScale: 48,
    interestScale: 32, mapTerritory: 1_000_000, maxPlayers: 512, commandDelayTicks: 0 });
});

test("game hook cannot sneak a correction past an opening cooldown", () => {
  const context = gameContext(3);
  const controller = context.__fx.autoExpand;
  const attack = controller.planProactive(0, 9_900, 100, 10_100, 10, 512);
  controller.acknowledge(512, attack.encoded, 0);
  controller.analyzeFrontier = () => assert.fail("cooldown must stop planning before scanning the map");
  hook.runInNewContext(context);
  assert.equal(controller.getStatus().remainingTicks, 47);
});

test("game hook keeps opening timing in control while neutral territory is available", () => {
  const context = gameContext(3);
  context.__fx.autoExpand.planCorrection = () => assert.fail("opening must not be interrupted by correction or bot sends");
  hook.runInNewContext(context);
});

test("late corrections receive active neutral troops so they cannot duplicate expansion", () => {
  const context = gameContext(603);
  context.ae.hU = () => 500;
  context.__fx.autoExpand.planCorrection = (...args) => {
    assert.equal(args[8], 2);
    assert.equal(args[9], 500);
    return null;
  };
  hook.runInNewContext(context);
});

test("each live game enables ECO with a fresh opening, while replays leave it disabled", () => {
  let startGame;
  generalPatches({
    dictionary: { game: "game", gIsReplay: "isReplay" },
    insertCode: (pattern, code) => {
      if (pattern.startsWith("an.init();")) startGame = new vm.Script(code);
    },
    waitForMinification() {}
  });
  const controller = createAutoExpandController();
  const context = {
    game: { isReplay: false },
    __fx: { economicAttack, autoExpand: controller, donationsTracker: { reset() {} },
      leaderboardFilter: { reset() {} }, utils: {}, customLobby: { isActive: () => false } }
  };
  globalThis.window = { __fx: { notifications: { show() {} } } };
  economicAttack.reset();
  startGame.runInNewContext(context);
  assert.equal(economicAttack.isArmed(), true);
  assert.equal(controller.shouldPlanOpening(0), true);
  economicAttack.toggle();
  assert.equal(economicAttack.isArmed(), false);
  controller.planProactive(0, 9_900, 100, 10_100, 10, 512);
  assert.equal(controller.canPlan(0), false);
  startGame.runInNewContext(context);
  assert.equal(economicAttack.isArmed(), true);
  assert.equal(controller.shouldPlanOpening(0), true);
  assert.equal(controller.getStatus().pending, false);
  context.game.isReplay = true;
  startGame.runInNewContext(context);
  assert.equal(economicAttack.isArmed(), false);
});
