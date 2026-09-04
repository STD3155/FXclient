import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAutoExpandAttack,
  calculateNextIncome,
  calculateOpeningExpandAttack,
  calculateProactiveExpandAttack,
  createAutoExpandController,
  findAutoExpandBotAttack,
  projectBalance
} from "../src/autoExpand.js";

test("does nothing while the next income remains at or below 100% density", () => {
  assert.equal(calculateAutoExpandAttack(9_900, 100, 100), null);
});

test("sends only the projected amount above optimal growth density", () => {
  const attack = calculateAutoExpandAttack(9_950, 100, 125);
  assert.equal(attack.capacity, 10_000);
  assert.equal(attack.overflow, 75);
  assert.equal(attack.amount, 75);
  assert.ok(Math.floor(9_950 * (attack.encoded + 1) / 1024) >= 75);
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
  const attack = calculateProactiveExpandAttack(9_900, 100, 10_100, 10);
  assert.equal(attack.projectedOverflow, 100);
  assert.equal(attack.amount, 30);
  assert.equal(attack.expectedTerritoryGain, 10);
  assert.ok(Math.floor(9_900 * (attack.encoded + 1) / 1024) >= 30);
});

test("does not start proactive expansion without a projected overflow or enough available troops", () => {
  assert.equal(calculateProactiveExpandAttack(9_900, 100, 10_000, 10), null);
  assert.equal(calculateProactiveExpandAttack(100, 1, 200, 40), null);
  assert.equal(calculateProactiveExpandAttack(9_900, 100, 10_100, 10, 1), null);
});

test("opening expansion selects the deepest affordable neutral layer", () => {
  const attack = calculateOpeningExpandAttack(10_000, 0, [10, 14, 18, 22, 26], 1023, false);
  assert.equal(attack.amount, 206);
  assert.equal(attack.depth, 5);
  assert.equal(attack.expectedTerritoryGain, 90);
  assert.equal(attack.phaseLimit, 1_800);
});

test("opening aggression decreases by phase and increases near a competitor", () => {
  const layers = [100, 150, 200];
  const middle = calculateOpeningExpandAttack(10_000, 100, layers, 1023, false);
  assert.equal(middle.depth, 3);
  assert.equal(middle.phaseLimit, 1_200);

  const late = calculateOpeningExpandAttack(10_000, 300, layers, 1023, false);
  assert.equal(late.depth, 2);
  assert.equal(late.phaseLimit, 800);

  const contested = calculateOpeningExpandAttack(10_000, 300, layers, 1023, true);
  assert.equal(contested.depth, 3);
  assert.equal(contested.phaseLimit, 2_000);
});

test("opening expansion respects the slider and ends after tick 599", () => {
  const sliderLimited = calculateOpeningExpandAttack(10_000, 0, [10, 14, 18], 5, false);
  assert.equal(sliderLimited.depth, 1);
  assert.equal(sliderLimited.amount, 30);
  assert.equal(sliderLimited.percentageLimit, 58);
  assert.equal(calculateOpeningExpandAttack(10_000, 600, [10, 14, 18], 1023, true), null);
});

test("plans at tick three and never sends twice in one income cycle", () => {
  const controller = createAutoExpandController();
  assert.equal(controller.plan(2, 9_950, 100, 125), null);
  const attack = controller.plan(3, 9_950, 100, 125);
  assert.notEqual(attack, null);
  assert.equal(controller.plan(3, 9_950, 100, 125), null);
  controller.acknowledge(null, attack.encoded);
  assert.notEqual(controller.plan(13, 9_950, 100, 125), null);
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
  assert.notEqual(controller.plan(23, 9_950, 100, 125), null);
});

test("retries after a missing server acknowledgement times out", () => {
  const controller = createAutoExpandController();
  assert.notEqual(controller.plan(3, 9_950, 100, 125), null);
  assert.equal(controller.plan(13, 9_950, 100, 125), null);
  assert.equal(controller.plan(23, 9_950, 100, 125), null);
  assert.notEqual(controller.plan(33, 9_950, 100, 125), null);
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
  assert.notEqual(controller.planBot(23, 10_000, 1023, candidates), null);
});

test("always prioritizes adjacent neutral territory over a conquerable bot", () => {
  const controller = createAutoExpandController();
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  assert.equal(controller.planBot(3, 10_000, 1023, candidates, true), null);
  assert.notEqual(controller.plan(3, 10_500, 100, 100, 512, 1023), null);
});

test("lets an urgent growth correction bypass the neutral expansion cooldown", () => {
  const controller = createAutoExpandController();
  const proactive = controller.planProactive(0, 9_900, 100, 10_100, 10, 512);
  assert.notEqual(proactive, null);
  controller.acknowledge(512, proactive.encoded);
  assert.notEqual(controller.plan(3, 9_950, 100, 125, 512), null);
});

test("does not duplicate a proactive expansion while its server event is pending", () => {
  const controller = createAutoExpandController();
  assert.notEqual(controller.planProactive(0, 9_900, 100, 10_100, 10, 512), null);
  assert.equal(controller.plan(3, 9_950, 100, 125, 512), null);
});

test("cooldown bundles only non-urgent attacks against neutral territory", () => {
  const controller = createAutoExpandController();
  const first = controller.planOpening(0, 10_000, [10, 14, 18], 1023, false, 512);
  assert.notEqual(first, null);
  controller.acknowledge(512, first.encoded);
  assert.equal(controller.planOpening(10, 10_000, [10, 14, 18], 1023, false, 512), null);
  assert.notEqual(controller.planOpening(20, 10_000, [10, 14, 18], 1023, false, 512), null);
});

test("neutral cooldown never delays an eligible bot attack", () => {
  const controller = createAutoExpandController();
  const neutral = controller.planOpening(0, 10_000, [10, 14, 18], 1023, false, 512);
  controller.acknowledge(512, neutral.encoded);
  const candidates = [{ id: 8, balance: 100, territory: 20, existingAttack: 0 }];
  assert.notEqual(controller.planBot(3, 10_000, 1023, candidates), null);
});
