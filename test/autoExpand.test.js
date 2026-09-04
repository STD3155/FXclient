import assert from "node:assert/strict";
import test from "node:test";
import { calculateAutoExpandAttack } from "../src/autoExpand.js";

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
