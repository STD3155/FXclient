import { fileURLToPath } from "node:url";
import { createAutoExpandController, calculateAutoExpandAttack } from "../src/autoExpand.js";

// Independent tick-by-tick reference model of an unobstructed 12-tile spawn.
// It deliberately does not use the planner's income or attack simulation.
export function simulateOpening({ legacy = false, layers = Array.from({ length: 160 }, (_, i) => 16 + 4 * i), percentage = 511, competitorNearby = false } = {}) {
  const controller = createAutoExpandController();
  let balance = 512, territory = 12, offset = 0, army = 0, nextExpansion = Infinity;
  let fees = 0, lastAttackTick = -100;
  const attacks = [];
  const snapshots = [];
  const started = performance.now();
  for (let tick = 0; tick < 600; tick++) {
    const rate = () => {
      let rate = Math.floor(700 - 5 * tick / 16);
      if (balance > 100 * territory) rate -= Math.floor(2 * rate * (balance - 100 * territory) / (100 * territory));
      return Math.max(0, Math.min(700, rate));
    };
    controller.update(tick);
    let attack = null;
    if (legacy) {
      if (tick % 10 === 0 && army === 0 && tick - lastAttackTick >= 20) {
        let tiles = 0, required = 0, amount = 0;
        const budget = Math.floor(balance * (percentage + 1) / 1024);
        const depth = tick < 100 ? 5 : tick < 300 ? 4 : 3;
        for (const size of layers.slice(offset, offset + depth)) {
          required = Math.max(required, 2 * tiles + 3 * size);
          if (required > budget) break;
          tiles += size;
          amount = required;
        }
        if (amount > 0) attack = { encoded: Math.ceil(amount * 1024 / balance) - 1 };
      } else if (tick % 10 === 3 && layers[offset]) {
        const income = Math.max(1, Math.floor(balance * rate() / 10_000)) + (tick % 100 >= 90 ? territory : 0);
        attack = calculateAutoExpandAttack(balance, territory, income, percentage, layers[offset]);
      }
    } else if (tick % 10 === 0 && army === 0) {
      attack = controller.planOpening(tick, balance, layers.slice(offset, offset + 48), percentage, competitorNearby, 512, 2, { territory });
    }
    if (attack) {
      const amount = Math.floor(balance * (attack.encoded + 1) / 1024);
      const fee = Math.floor(12 * balance / 1024);
      if (army === 0) nextExpansion = tick + 7;
      army += amount;
      attacks.push({ tick, balance, amount, fee, percentage: 100 * (attack.encoded + 1) / 1024 });
      balance -= amount + fee;
      fees += fee;
      lastAttackTick = tick;
      controller.acknowledge(512, attack.encoded, tick);
    }
    if (tick % 10 === 9) {
      balance = Math.min(150 * territory, balance + Math.max(1, Math.floor(balance * rate() / 10_000)));
      if (tick % 100 === 99) balance = Math.min(150 * territory, balance + territory);
    }
    if (tick === nextExpansion) {
      const size = layers[offset] || 0;
      const interval = territory < 1_000 ? 4 : territory < 10_000 ? 3 : 2;
      if (size === 0 || army < 3 * size) {
        balance = Math.min(150 * territory, balance + army);
        army = 0;
        nextExpansion = Infinity;
      } else {
        territory += size;
        offset++;
        army -= 2 * size;
        nextExpansion += interval;
      }
    }
    if (tick % 100 === 99) snapshots.push({ tick: tick + 1, balance, territory });
  }
  return { balance, territory, fees, assets: balance + army + 2 * territory, attacks, snapshots, durationMs: performance.now() - started };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, layers] of [
    ["Open land", undefined],
    ["20 layers", Array.from({ length: 20 }, (_, i) => 16 + 4 * i)],
    ["5 layers", Array.from({ length: 5 }, (_, i) => 16 + 4 * i)]
  ]) {
    for (const legacy of [true, false]) {
      const result = simulateOpening({ legacy, layers });
      console.log(JSON.stringify({ scenario: name, strategy: legacy ? "previous" : "optimized", ...result }));
    }
  }
}
