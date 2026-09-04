import { calculateEconomicAttack } from "./economicAttack.js";

const OPTIMAL_GROWTH_DENSITY = 100;
const SERVER_RESERVE_PARTS = 12;
const ATTACK_PARTS = 1024;
export const AUTO_EXPAND_TRIGGER_TICK = 3;
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
  let lastCycle = null;
  let pendingAttack = null;

  function schedule(tick, attack, target = null) {
    if (attack === null) return null;
    const cycle = Math.floor(tick / 10);
    if (cycle === lastCycle) return null;
    lastCycle = cycle;

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
      return schedule(tick, attack, target);
    },
    planBot(tick, ownBalance, normalPercentage, candidates) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;
      const attack = findAutoExpandBotAttack(ownBalance, normalPercentage, candidates);
      return schedule(tick, attack, attack?.target ?? null);
    },
    acknowledge(target, encoded) {
      if (pendingAttack !== null && pendingAttack.target === target && pendingAttack.encoded === encoded) pendingAttack = null;
    },
    reset() {
      lastCycle = null;
      pendingAttack = null;
    }
  };
}

const controller = createAutoExpandController();

export default {
  calculate: calculateAutoExpandAttack,
  calculateNextIncome,
  findBotAttack: findAutoExpandBotAttack,
  plan: controller.plan,
  planBot: controller.planBot,
  acknowledge: controller.acknowledge,
  reset: controller.reset
};
