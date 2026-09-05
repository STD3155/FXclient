import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeExpansionFrontier,
  calculateAutoExpandAttack,
  calculateNextIncome,
  calculateProactiveExpandAttack,
  createAutoExpandController,
  findAutoExpandBotAttack,
  projectBalance
} from "../src/autoExpand.js";

test("does nothing while the next income remains at or below 100% density", () => {
  assert.equal(calculateAutoExpandAttack(9_900, 100, 100), null);
});

test("uses the slider as a limit while correcting projected overflow", () => {
  const attack = calculateAutoExpandAttack(9_950, 100, 125, 204);
  assert.equal(attack.capacity, 10_000);
  assert.equal(attack.overflow, 75);
  assert.equal(attack.percentageLimit, 1_991);
  assert.equal(attack.amount, 75);
  assert.equal(attack.encoded, 7);
});

test("respects the reserve enforced by the game", () => {
  const attack = calculateAutoExpandAttack(2_000, 1, 5_000);
  assert.equal(attack.amount, 1_977);
});

test("never exceeds the configured attack percentage during a correction", () => {
  const attack = calculateAutoExpandAttack(9_950, 100, 125, 0);
  assert.equal(attack.percentageLimit, 9);
  assert.equal(attack.amount, 9);
});

test("does not let the game top up a correction beyond the slider limit", () => {
  assert.equal(calculateAutoExpandAttack(9_950, 100, 125, 0, 10, 2), null);

  const attack = calculateAutoExpandAttack(9_999, 100, 2, 204, 10, 2);
  assert.equal(attack.overflow, 1);
  assert.equal(attack.minimumAmount, 30);
  assert.equal(attack.amount, 30);
});

test("extracts multiple neutral layers and nearby owners from the map", () => {
  const neutralCells = new Set([1, 10, 2, 11, 20, 3]);
  const owners = new Map([[-10, 8], [12, 7]]);
  const analysis = analyzeExpansionFrontier({
    border: [0],
    directions: [-10, 1, 10, -1],
    isNeutral: (cell) => neutralCells.has(cell),
    getOwner: (cell) => owners.get(cell),
    maxDepth: 5,
    ownerSearchDepth: 2
  });

  assert.deepEqual(analysis.neutralLayerSizes, [2, 3, 1, 0]);
  assert.deepEqual(analysis.adjacentOwners, [8]);
  assert.deepEqual(analysis.nearbyOwners.sort((a, b) => a - b), [7, 8]);
});

test("projects only the income that is actually paid on the next income tick", () => {
  assert.equal(calculateNextIncome(9_000, 100, 100, 83), 90);
  assert.equal(calculateNextIncome(9_000, 100, 100, 93), 190);
});

test("includes custom army and territorial income scales", () => {
  assert.equal(calculateNextIncome(10_000, 64, 100, 93, 16, 48), 204);
});

test("projects two complete income cycles ahead", () => {
  assert.equal(projectBalance(9_000, 100, 100, 0), 9_180);
  assert.equal(projectBalance(9_000, 100, 100, 90), 9_281);
});

test("starts a minimal reliable neutral-front expansion before the projected cap", () => {
  const attack = calculateProactiveExpandAttack(9_900, 100, 10_100, 10, 204);
  assert.equal(attack.projectedOverflow, 100);
  assert.equal(attack.minimumAmount, 30);
  assert.equal(attack.amount, 30);
  assert.equal(attack.encoded, 3);
  assert.equal(attack.expectedTerritoryGain, 10);
});

test("does not start proactive expansion without a projected overflow or enough available troops", () => {
  assert.equal(calculateProactiveExpandAttack(9_900, 100, 10_000, 10), null);
  assert.equal(calculateProactiveExpandAttack(100, 1, 200, 40), null);
  assert.equal(calculateProactiveExpandAttack(9_900, 100, 10_100, 10, 1), null);
});

test("plans at tick three and enforces a cooldown after acknowledgement", () => {
  const controller = createAutoExpandController();
  assert.equal(controller.plan(2, 9_950, 100, 125), null);
  const attack = controller.plan(3, 9_950, 100, 125);
  assert.notEqual(attack, null);
  assert.equal(controller.plan(3, 9_950, 100, 125), null);
  controller.acknowledge(null, attack.encoded);
  assert.equal(controller.plan(13, 9_950, 100, 125), null);
  assert.notEqual(controller.plan(53, 9_950, 100, 125), null);
});

test("reset allows a new game to reuse the same tick cycle", () => {
  const controller = createAutoExpandController();
  assert.notEqual(controller.plan(3, 9_950, 100, 125), null);
  controller.reset();
  assert.notEqual(controller.plan(3, 9_950, 100, 125), null);
});

test("waits for the server acknowledgement before planning another attack", () => {
  const controller = createAutoExpandController();
  const attack = controller.plan(3, 9_950, 100, 125);
  assert.equal(controller.plan(13, 9_950, 100, 125), null);
  controller.acknowledge(null, attack.encoded);
  assert.equal(controller.plan(23, 9_950, 100, 125), null);
  assert.notEqual(controller.plan(53, 9_950, 100, 125), null);
});

test("retries a missing acknowledgement only after the cooldown also expires", () => {
  const controller = createAutoExpandController();
  assert.notEqual(controller.plan(3, 9_950, 100, 125), null);
  assert.equal(controller.plan(13, 9_950, 100, 125), null);
  assert.equal(controller.plan(23, 9_950, 100, 125), null);
  assert.equal(controller.plan(33, 9_950, 100, 125), null);
  assert.notEqual(controller.plan(53, 9_950, 100, 125), null);
});

test("attacks only bots that fit within the configured attack percentage", () => {
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  assert.equal(findAutoExpandBotAttack(10_000, 20, candidates), null);

  const attack = findAutoExpandBotAttack(10_000, 30, candidates);
  assert.equal(attack.target, 8);
  assert.equal(attack.required, 264);
  assert.equal(attack.isSafe, true);
});

test("selects the conquerable bot with the best territory return", () => {
  const attack = findAutoExpandBotAttack(10_000, 1023, [
    { id: 8, balance: 100, territory: 20, existingAttack: 0 },
    { id: 9, balance: 100, territory: 100, existingAttack: 0 }
  ]);
  assert.equal(attack.target, 9);
});

test("does not reinforce an attack that is already sufficient to conquer a bot", () => {
  assert.equal(findAutoExpandBotAttack(10_000, 1023, [
    { id: 8, balance: 100, territory: 20, existingAttack: 264 }
  ]), null);
});

test("tracks bot targets while waiting for the authoritative server event", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  const attack = controller.planBot(3, 10_000, 1023, candidates);
  assert.equal(controller.planBot(13, 10_000, 1023, candidates), null);
  controller.acknowledge(8, attack.encoded);
  assert.equal(controller.planBot(23, 10_000, 1023, candidates), null);
  assert.notEqual(controller.planBot(53, 10_000, 1023, candidates), null);
});

test("prioritizes an actionable neutral correction over a conquerable bot", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  const attack = controller.planCorrection(3, 10_500, 100, 100, 10, 512, 1023, candidates, 2);
  assert.notEqual(attack, null);
  assert.equal(attack.target, 512);
});

test("saves for neutral expansion when the slider cannot yet fund the frontier", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  const attack = controller.planCorrection(3, 10_000, 100, 100, 200, 512, 30, candidates, 2);
  assert.equal(attack, null);
  assert.equal(controller.getStatus().pending, false);
  assert.equal(controller.canPlan(3), true);
});

test("an idle neutral frontier protects the bank even after the timed opening ends", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 0, territory: 10, existingAttack: 0 }];
  for (const tick of [593, 603, 1003]) {
    assert.equal(controller.planCorrection(tick, 5_000, 100, 70, 10, 512, 511, candidates), null);
    assert.equal(controller.getStatus().remainingTicks, 0);
  }
  // Saving must not consume the cooldown needed by the next neutral send.
  assert.notEqual(controller.planProactive(1010, 9_900, 100, 10_100, 10, 512, 511), null);
});

test("bot attacks wait for neutral troops to finish even when no neutral border remains", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 0, territory: 10, existingAttack: 0 }];
  assert.equal(controller.planCorrection(603, 5_000, 100, 0, 0, 512, 511, candidates, 2, 200), null);
  const attack = controller.planCorrection(613, 5_000, 100, 0, 0, 512, 511, candidates, 2, 0);
  assert.equal(attack.target, 8);
  assert.equal(attack.isSafe, true);
});

test("free land reopened by a bot conquest pauses subsequent bot attacks", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 0, territory: 10, existingAttack: 0 }];
  const bot = controller.planCorrection(603, 5_000, 100, 0, 0, 512, 511, candidates);
  controller.acknowledge(8, bot.encoded, 603);
  assert.equal(controller.planCorrection(653, 5_000, 100, 70, 10, 512, 511, candidates), null);
  assert.equal(controller.canPlan(653), true);
});

test("an urgent growth correction cannot bypass the cooldown", () => {
  const controller = createAutoExpandController();
  const proactive = controller.planProactive(0, 9_900, 100, 10_100, 10, 512);
  assert.notEqual(proactive, null);
  controller.acknowledge(512, proactive.encoded);
  assert.equal(controller.plan(3, 9_950, 100, 125, 512), null);
  assert.notEqual(controller.plan(53, 9_950, 100, 125, 512), null);
});

test("does not duplicate a proactive expansion while its server event is pending", () => {
  const controller = createAutoExpandController();
  assert.notEqual(controller.planProactive(0, 9_900, 100, 10_100, 10, 512), null);
  assert.equal(controller.plan(3, 9_950, 100, 125, 512), null);
});

test("cooldown delays every neutral expansion phase", () => {
  const controller = createAutoExpandController();
  const first = controller.planProactive(0, 9_900, 100, 10_100, 10, 512);
  controller.acknowledge(512, first.encoded);
  assert.equal(controller.planProactive(20, 9_900, 100, 10_100, 10, 512), null);
  assert.equal(controller.planCorrection(23, 10_500, 100, 100, 10, 512, 1023, []), null);
  assert.equal(controller.planOpening(30, 10_000, [10, 14, 18], 1023, false, 512), null);
  assert.notEqual(controller.planProactive(50, 9_900, 100, 10_100, 10, 512), null);
});

test("neutral and bot attacks share the same cooldown in both directions", () => {
  const controller = createAutoExpandController();
  const neutral = controller.planProactive(0, 9_900, 100, 10_100, 10, 512);
  controller.acknowledge(512, neutral.encoded);
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  assert.equal(controller.planBot(3, 10_000, 1023, candidates), null);
  const bot = controller.planBot(53, 10_000, 1023, candidates);
  assert.notEqual(bot, null);
  controller.acknowledge(8, bot.encoded);
  assert.equal(controller.planProactive(60, 9_900, 100, 10_100, 10, 512), null);
  assert.notEqual(controller.plan(103, 9_950, 100, 125, 512), null);
});

test("does not reinforce neutral troops still expanding on the map", () => {
  const controller = createAutoExpandController();
  assert.equal(controller.planCorrection(3, 10_500, 100, 100, 10, 512, 1023, [], 2, 100), null);
  assert.notEqual(controller.planCorrection(13, 10_500, 100, 100, 10, 512, 1023, [], 2, 0), null);
});

test("shows the cooldown from acceptance and keeps it after unrelated events", () => {
  const controller = createAutoExpandController();
  const attack = controller.plan(3, 9_950, 100, 125, 512);
  controller.acknowledge(8, attack.encoded);
  assert.equal(controller.getStatus().pending, true);
  controller.acknowledge(512, attack.encoded, 10);
  assert.deepEqual(controller.getStatus(), { remainingTicks: 50, remainingSeconds: 2.8, pending: false });
  controller.update(35);
  assert.equal(controller.getStatus().remainingSeconds, 1.4);
  assert.equal(controller.canPlan(59), false);
  assert.equal(controller.canPlan(60), true);
  controller.update(60);
  assert.equal(controller.getStatus().remainingSeconds, 0);
  controller.reset();
  assert.equal(controller.canPlan(0), true);
});

test("a manual attack gives automatic expansion the same recovery period", () => {
  const controller = createAutoExpandController();
  controller.acknowledge(8, 50, 0);
  assert.equal(controller.plan(3, 9_950, 100, 125), null);
  assert.notEqual(controller.plan(53, 9_950, 100, 125), null);
});

test("frontier limits retain only complete layers so the budget is not underestimated", () => {
  const neutral = new Set([1, 2, 3, 4, 5]);
  const result = analyzeExpansionFrontier({
    border: [0], directions: [1, 2], isNeutral: cell => neutral.has(cell), getOwner: () => null,
    maxDepth: 5, maxNeutralTiles: 3
  });
  assert.deepEqual(result.neutralLayerSizes, [2]);
});
