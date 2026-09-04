import { calculateEconomicAttack } from "./economicAttack.js";

const OPTIMAL_GROWTH_DENSITY = 100;
const SERVER_RESERVE_PARTS = 12;
const ATTACK_PARTS = 1024;
export const AUTO_EXPAND_TRIGGER_TICK = 3;
export const PROACTIVE_EXPAND_TRIGGER_TICK = 0;
const PROACTIVE_HORIZON_CYCLES = 2;
const PENDING_TIMEOUT_CYCLES = 3;

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function calculateNextIncome(
  balance,
  territory,
  interestRate,
  tick,
  armyIncomeScale = 0,
  territorialIncomeScale = 32
) {
  if (![balance, territory, interestRate, tick, armyIncomeScale, territorialIncomeScale].every(Number.isFinite)) return 0;
  balance = Math.max(0, Math.floor(balance));
  territory = Math.max(0, Math.floor(territory));
  interestRate = Math.max(0, interestRate);
  tick = Math.floor(tick);
  armyIncomeScale = Math.max(0, armyIncomeScale);
  territorialIncomeScale = Math.max(0, territorialIncomeScale);

  const interestIncome = Math.max(Math.floor(interestRate * balance / 10_000), 1);
  const armyIncome = Math.floor(armyIncomeScale * territory / 128);
  const ticksUntilIncome = positiveModulo(9 - tick, 10);
  const nextIncomeTick = tick + ticksUntilIncome;
  const territorialIncome = positiveModulo(nextIncomeTick, 100) === 99
    ? Math.floor(territorialIncomeScale * territory / 32)
    : 0;

  return interestIncome + armyIncome + territorialIncome;
}

export function calculateAutoExpandAttack(balance, territory, nextIncome) {
  if (![balance, territory, nextIncome].every(Number.isFinite)) return null;
  balance = Math.max(0, Math.floor(balance));
  territory = Math.max(0, Math.floor(territory));
  nextIncome = Math.max(0, nextIncome);
  if (balance === 0 || territory === 0) return null;

  const capacity = OPTIMAL_GROWTH_DENSITY * territory;
  const overflow = Math.ceil(balance + nextIncome - capacity);
  if (overflow <= 0) return null;

  const available = balance - Math.floor(SERVER_RESERVE_PARTS * balance / ATTACK_PARTS);
  const amount = Math.min(overflow, available);
  if (amount <= 0) return null;

  const encoded = Math.ceil(amount * ATTACK_PARTS / balance) - 1;
  return {
    encoded: Math.max(0, Math.min(ATTACK_PARTS - 1, encoded)),
    amount,
    overflow,
    capacity
  };
}

export function projectBalance(
  balance,
  territory,
  interestRate,
  tick,
  armyIncomeScale = 0,
  territorialIncomeScale = 32,
  cycles = PROACTIVE_HORIZON_CYCLES
) {
  if (![balance, territory, interestRate, tick, cycles].every(Number.isFinite)) return 0;
  let projectedBalance = Math.max(0, Math.floor(balance));
  tick = Math.floor(tick);
  cycles = Math.max(0, Math.floor(cycles));

  for (let cycle = 0; cycle < cycles; cycle++) {
    projectedBalance += calculateNextIncome(
      projectedBalance,
      territory,
      interestRate,
      tick + cycle * 10,
      armyIncomeScale,
      territorialIncomeScale
    );
  }
  return projectedBalance;
}

export function calculateProactiveExpandAttack(balance, territory, projectedBalance, neutralFrontierTiles) {
  if (![balance, territory, projectedBalance, neutralFrontierTiles].every(Number.isFinite)) return null;
  balance = Math.max(0, Math.floor(balance));
  territory = Math.max(0, Math.floor(territory));
  projectedBalance = Math.max(0, Math.floor(projectedBalance));
  neutralFrontierTiles = Math.max(0, Math.floor(neutralFrontierTiles));
  if (balance === 0 || territory === 0 || neutralFrontierTiles === 0) return null;

  const capacity = OPTIMAL_GROWTH_DENSITY * territory;
  const projectedOverflow = projectedBalance - capacity;
  if (projectedOverflow <= 0) return null;

  // Neutral expansion is distributed over the complete frontier. Territorial
  // requires more than two troops per frontier tile for the first wave, so
  // three per currently reachable tile is the smallest reliable click.
  const amount = 3 * neutralFrontierTiles;
  const available = balance - Math.floor(SERVER_RESERVE_PARTS * balance / ATTACK_PARTS);
  if (amount > available) return null;

  const encoded = Math.ceil(amount * ATTACK_PARTS / balance) - 1;
  return {
    encoded: Math.max(0, Math.min(ATTACK_PARTS - 1, encoded)),
    amount,
    capacity,
    projectedBalance,
    projectedOverflow,
    expectedTerritoryGain: neutralFrontierTiles
  };
}

export function findAutoExpandBotAttack(ownBalance, normalPercentage, candidates) {
  if (!Array.isArray(candidates)) return null;

  let best = null;
  for (const candidate of candidates) {
    if (!candidate || !Number.isFinite(candidate.id)) continue;
    const targetBalance = Math.max(0, Math.floor(candidate.balance));
    const targetTerritory = Math.max(0, Math.floor(candidate.territory));
    const existingAttack = Math.max(0, Math.floor(candidate.existingAttack || 0));
    const totalRequired = Math.ceil(2 * (targetBalance + targetTerritory) * 11 / 10);
    if (existingAttack >= totalRequired) continue;

    const attack = calculateEconomicAttack(
      ownBalance,
      targetBalance,
      targetTerritory,
      normalPercentage,
      existingAttack
    );
    if (!attack?.isSafe) continue;

    const value = targetTerritory / attack.required;
    if (best === null || value > best.value || (value === best.value && attack.required < best.required)) {
      best = {
        ...attack,
        target: Math.floor(candidate.id),
        value
      };
    }
  }
  return best;
}

export function createAutoExpandController(triggerTick = AUTO_EXPAND_TRIGGER_TICK) {
  const lastCycleByPhase = { proactive: null, correction: null };
  let pendingAttack = null;

  function schedule(tick, phase, attack, target = null) {
    if (attack === null) return null;
    const cycle = Math.floor(tick / 10);
    if (cycle === lastCycleByPhase[phase]) return null;
    lastCycleByPhase[phase] = cycle;

    if (pendingAttack !== null) {
      if (cycle - pendingAttack.cycle < PENDING_TIMEOUT_CYCLES) return null;
      pendingAttack = null;
    }

    pendingAttack = { cycle, encoded: attack.encoded, target };
    return attack;
  }

  return {
    plan(tick, balance, territory, nextIncome, target = null) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;
      const attack = calculateAutoExpandAttack(balance, territory, nextIncome);
      return schedule(tick, "correction", attack, target);
    },
    planProactive(tick, balance, territory, projectedBalance, neutralFrontierTiles, target = null) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== PROACTIVE_EXPAND_TRIGGER_TICK) return null;
      const attack = calculateProactiveExpandAttack(balance, territory, projectedBalance, neutralFrontierTiles);
      return schedule(tick, "proactive", attack, target);
    },
    planBot(tick, ownBalance, normalPercentage, candidates) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;
      const attack = findAutoExpandBotAttack(ownBalance, normalPercentage, candidates);
      return schedule(tick, "correction", attack, attack?.target ?? null);
    },
    acknowledge(target, encoded) {
      if (pendingAttack !== null && pendingAttack.target === target && pendingAttack.encoded === encoded) pendingAttack = null;
    },
    reset() {
      lastCycleByPhase.proactive = null;
      lastCycleByPhase.correction = null;
      pendingAttack = null;
    }
  };
}

const controller = createAutoExpandController();

export default {
  calculate: calculateAutoExpandAttack,
  calculateProactive: calculateProactiveExpandAttack,
  calculateNextIncome,
  projectBalance,
  findBotAttack: findAutoExpandBotAttack,
  plan: controller.plan,
  planProactive: controller.planProactive,
  planBot: controller.planBot,
  acknowledge: controller.acknowledge,
  reset: controller.reset
};
