import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpeningExpandAttack } from "../src/openingStrategy.js";
import { createAutoExpandController } from "../src/autoExpand.js";
import { simulateOpening } from "../scripts/benchmarkAutoExpand.js";

const layers = Array.from({ length: 48 }, (_, i) => 16 + 4 * i);

test("plans a late, affordable first attack and forecasts the complete opening", () => {
  const attack = calculateOpeningExpandAttack(512, 0, layers, 511);
  assert.equal(attack.tick, 80);
  assert.equal(attack.amount, 144);
  assert.equal(attack.depth, 3);
  assert.equal(attack.expectedTerritoryGain, 60);
  assert.equal(attack.projectedBalance, 9806);
  assert.equal(attack.projectedTerritory, 4128);
});

test("controller waits for the planned time and sends only once per opening cycle", () => {
  const controller = createAutoExpandController();
  assert.equal(controller.planOpening(0, 512, layers, 511, false, 512), null);
  assert.equal(controller.shouldPlanOpening(70), false);
  assert.equal(controller.shouldPlanOpening(80), true);
  const attack = controller.planOpening(80, 864, layers, 511, false, 512);
  assert.notEqual(attack, null);
  controller.acknowledge(512, attack.encoded, 80);
  assert.equal(controller.planOpening(90, 700, layers, 511, false, 512), null);
  controller.reset();
  assert.equal(controller.shouldPlanOpening(0), true);
});

test("adapts to restricted land and to the slider instead of repeating a fixed opening", () => {
  const open = simulateOpening();
  const restricted = simulateOpening({ layers: layers.slice(0, 5) });
  const limited = simulateOpening({ percentage: 127 });
  assert.ok(open.territory > restricted.territory);
  assert.equal(restricted.territory, 132);
  assert.ok(limited.attacks.every(attack => attack.percentage <= 12.5));
  assert.ok(open.attacks.every(attack => attack.percentage <= 50));
  for (let i = 1; i < open.attacks.length; i++) assert.ok(open.attacks[i].tick - open.attacks[i - 1].tick >= 50);
});

test("reference simulation confirms more land and troops than the previous opening", () => {
  const previous = simulateOpening({ legacy: true });
  const optimized = simulateOpening();
  assert.equal(previous.balance, 3444);
  assert.equal(previous.territory, 2800);
  assert.equal(optimized.balance, 9806);
  assert.equal(optimized.territory, 4128);
  assert.equal(optimized.attacks.length, 6);
  assert.ok(optimized.balance > previous.balance * 2);
  assert.ok(optimized.territory > previous.territory * 1.4);
  assert.ok(optimized.attacks.length < previous.attacks.length / 2);
});

test("nearby competitors bring expansion forward to secure contested land", () => {
  const map = layers.slice(0, 20);
  const peaceful = simulateOpening({ layers: map });
  const contested = simulateOpening({ layers: map, competitorNearby: true });
  assert.ok(contested.attacks[0].tick < peaceful.attacks[0].tick);
  assert.ok(contested.snapshots[1].territory > peaceful.snapshots[1].territory);
  assert.equal(contested.snapshots[3].territory, 1092);
});

test("accounts for custom incomes and leaves time for multiplayer command delivery", () => {
  const normal = calculateOpeningExpandAttack(1000, 500, layers, 511, false, 2, { territory: 100 });
  const custom = calculateOpeningExpandAttack(1000, 500, layers, 511, false, 2, {
    territory: 100, interestScale: 0, armyIncomeScale: 128, territorialIncomeScale: 64
  });
  assert.notEqual(custom, null);
  assert.ok(custom.projectedBalance > normal.projectedBalance);
  const delayed = calculateOpeningExpandAttack(512, 0, layers, 511, false, 2, { commandDelayTicks: 10 });
  assert.ok(delayed.tick + 7 + 10 + 4 * delayed.depth <= 99);
});

test("rejects invalid or unaffordable openings and stops at tick 600", () => {
  for (const values of [
    [0, 0, layers, 511], [512, 600, layers, 511], [512, 0, [], 511],
    [512, 0, [NaN], 511], [512, 0, layers, NaN], [512, -1, layers, 511],
    [512, 0, layers, 0], [512, 0, layers, 511, false, 2, { territory: 0 }]
  ]) assert.equal(calculateOpeningExpandAttack(...values), null);
});
