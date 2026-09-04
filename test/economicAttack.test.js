import assert from "node:assert/strict";
import test from "node:test";
import economicAttack, { calculateEconomicAttack } from "../src/economicAttack.js";

test("includes both defender troops and territory in the safe-conquest amount", () => {
  const attack = calculateEconomicAttack(10_000, 1_000, 100, 1023);
  assert.equal(attack.required, 2_420);
  assert.equal(attack.amount, 2_420);
  assert.equal(attack.isSafe, true);
  assert.ok(Math.floor(10_000 * (attack.encoded + 1) / 1024) >= attack.required);
});

test("subtracts troops already attacking the same player", () => {
  assert.equal(calculateEconomicAttack(10_000, 1_000, 100, 1023, 700).required, 1_720);
});

test("uses the smaller amount when the selected percentage is below the conquest amount", () => {
  const attack = calculateEconomicAttack(10_000, 1_000, 100, 102);
  assert.equal(attack.amount, 1_005);
  assert.equal(attack.percentageLimit, 1_005);
  assert.equal(attack.isSafe, false);
});

test("caps a full-send at the game's server-side reserve", () => {
  const attack = calculateEconomicAttack(2_000, 1_000, 0, 1023);
  assert.equal(attack.amount, 1_977);
  assert.equal(attack.available, 1_977);
  assert.equal(attack.isSafe, false);
});

test("rounds encoded percentages upward across integer boundaries", () => {
  const attack = calculateEconomicAttack(997, 100, 0, 1023);
  const sent = Math.floor(997 * (attack.encoded + 1) / 1024);
  assert.ok(sent >= 220);
});

test("is a one-shot mode and warns when the configured percentage caps the attack", () => {
  const messages = [];
  globalThis.window = { __fx: { notifications: { show: (message) => messages.push(message) } } };
  economicAttack.reset();
  economicAttack.toggle();
  assert.equal(economicAttack.isArmed(), true);
  assert.equal(typeof economicAttack.resolve(500, 2_000, 1_000, 100, 0), "number");
  assert.equal(economicAttack.isArmed(), false);
  assert.match(messages.at(-1), /capped at/);
});
