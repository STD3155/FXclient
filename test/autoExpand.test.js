import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAutoExpandAttack,
  calculateNextIncome,
  createAutoExpandController
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

test("projects only the income that is actually paid on the next income tick", () => {
  assert.equal(calculateNextIncome(9_000, 100, 100, 83), 90);
  assert.equal(calculateNextIncome(9_000, 100, 100, 93), 190);
});

test("includes custom army and territorial income scales", () => {
  assert.equal(calculateNextIncome(10_000, 64, 100, 93, 16, 48), 204);
});

test("plans at tick three and never sends twice in one income cycle", () => {
  const controller = createAutoExpandController();
  assert.equal(controller.plan(2, 9_950, 100, 125), null);
  const attack = controller.plan(3, 9_950, 100, 125);
  assert.notEqual(attack, null);
  assert.equal(controller.plan(3, 9_950, 100, 125), null);
  controller.acknowledge(attack.encoded);
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
  controller.acknowledge(attack.encoded);
  assert.notEqual(controller.plan(23, 9_950, 100, 125), null);
});

test("retries after a missing server acknowledgement times out", () => {
  const controller = createAutoExpandController();
  assert.notEqual(controller.plan(3, 9_950, 100, 125), null);
  assert.equal(controller.plan(13, 9_950, 100, 125), null);
  assert.equal(controller.plan(23, 9_950, 100, 125), null);
  assert.notEqual(controller.plan(33, 9_950, 100, 125), null);
});
