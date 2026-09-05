import { calculateEconomicAttack } from "./economicAttack.js";
import {
  calculateOpeningExpandAttack, AUTO_ATTACK_COOLDOWN_TICKS, OPENING_FRONTIER_DEPTH,
  OPENING_FRONTIER_TILE_LIMIT
} from "./openingStrategy.js";
export { calculateOpeningExpandAttack, AUTO_ATTACK_COOLDOWN_TICKS };

const OPTIMAL_GROWTH_DENSITY = 100;
const SERVER_RESERVE_PARTS = 12;
const ATTACK_PARTS = 1024;
const DEFAULT_EXPANSION_COST = 2;
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

function calculatePercentageLimit(balance, normalPercentage) {
  normalPercentage = Math.max(0, Math.min(ATTACK_PARTS - 1, Math.floor(normalPercentage)));
  return Math.floor(balance * (normalPercentage + 1) / ATTACK_PARTS);
}

export function analyzeExpansionFrontier({
  border,
  directions,
  isNeutral,
  getOwner,
  maxDepth = 5,
  ownerSearchDepth = 2,
  maxNeutralTiles = Infinity
} = {}) {
  if (!border || typeof border[Symbol.iterator] !== "function"
    || !directions || typeof directions[Symbol.iterator] !== "function"
    || typeof isNeutral !== "function" || typeof getOwner !== "function") {
    return { neutralLayerSizes: [], adjacentOwners: [], nearbyOwners: [] };
  }

  maxDepth = Math.max(1, Math.floor(Number.isFinite(maxDepth) ? maxDepth : 1));
  ownerSearchDepth = Math.max(0, Math.floor(Number.isFinite(ownerSearchDepth) ? ownerSearchDepth : 0));

  const seenNeutral = new Set();
  const adjacentOwners = new Set();
  const nearbyOwners = new Set();
  const addOwner = (cell, owners) => {
    const owner = getOwner(cell);
    if (Number.isFinite(owner)) owners.add(Math.floor(owner));
  };

  for (const borderCell of border) {
    for (const direction of directions) {
      const neighbor = borderCell + direction;
      if (isNeutral(neighbor)) {
        seenNeutral.add(neighbor);
      } else {
        addOwner(neighbor, adjacentOwners);
        addOwner(neighbor, nearbyOwners);
      }
    }
  }

  const neutralLayerSizes = [seenNeutral.size];
  let neutralLayer = Array.from(seenNeutral);
  for (let layerDepth = 1; layerDepth < maxDepth && neutralLayer.length > 0; layerDepth++) {
    const nextNeutralLayer = [];
    for (const neutralCell of neutralLayer) {
      for (const direction of directions) {
        const neighbor = neutralCell + direction;
        if (isNeutral(neighbor)) {
          if (!seenNeutral.has(neighbor)) {
            seenNeutral.add(neighbor);
            nextNeutralLayer.push(neighbor);
          }
        } else if (layerDepth <= ownerSearchDepth) {
          addOwner(neighbor, nearbyOwners);
        }
      }
    }
    // Discard an incomplete lookahead layer rather than underpricing it.
    if (seenNeutral.size > maxNeutralTiles) break;
    neutralLayerSizes.push(nextNeutralLayer.length);
    neutralLayer = nextNeutralLayer;
  }

  return {
    neutralLayerSizes,
    adjacentOwners: Array.from(adjacentOwners),
    nearbyOwners: Array.from(nearbyOwners)
  };
}

export function calculateAutoExpandAttack(
  balance,
  territory,
  nextIncome,
  normalPercentage = ATTACK_PARTS - 1,
  neutralFrontierTiles = 0,
  expansionCost = DEFAULT_EXPANSION_COST
) {
  if (![balance, territory, nextIncome, normalPercentage, neutralFrontierTiles, expansionCost].every(Number.isFinite)) return null;
  balance = Math.max(0, Math.floor(balance));
  territory = Math.max(0, Math.floor(territory));
  nextIncome = Math.max(0, nextIncome);
  neutralFrontierTiles = Math.max(0, Math.floor(neutralFrontierTiles));
  expansionCost = Math.max(0, Math.floor(expansionCost));
  if (balance === 0 || territory === 0) return null;

  const capacity = OPTIMAL_GROWTH_DENSITY * territory;
  const overflow = Math.ceil(balance + nextIncome - capacity);
  if (overflow <= 0) return null;

  const available = balance - Math.floor(SERVER_RESERVE_PARTS * balance / ATTACK_PARTS);
  const percentageLimit = calculatePercentageLimit(balance, normalPercentage);
  const minimumAmount = neutralFrontierTiles * (expansionCost + 1);
  const desiredAmount = Math.max(overflow, minimumAmount);
  const amount = Math.min(available, percentageLimit, desiredAmount);
  if (amount <= 0 || amount < minimumAmount) return null;

  const encoded = Math.ceil(amount * ATTACK_PARTS / balance) - 1;
  return {
    encoded: Math.max(0, Math.min(ATTACK_PARTS - 1, encoded)),
    amount,
    overflow,
    capacity,
    minimumAmount,
    percentageLimit
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

export function calculateProactiveExpandAttack(
  balance,
  territory,
  projectedBalance,
  neutralFrontierTiles,
  normalPercentage = ATTACK_PARTS - 1,
  expansionCost = DEFAULT_EXPANSION_COST
) {
  if (![balance, territory, projectedBalance, neutralFrontierTiles, normalPercentage, expansionCost].every(Number.isFinite)) return null;
  balance = Math.max(0, Math.floor(balance));
  territory = Math.max(0, Math.floor(territory));
  projectedBalance = Math.max(0, Math.floor(projectedBalance));
  neutralFrontierTiles = Math.max(0, Math.floor(neutralFrontierTiles));
  expansionCost = Math.max(0, Math.floor(expansionCost));
  if (balance === 0 || territory === 0 || neutralFrontierTiles === 0) return null;

  const capacity = OPTIMAL_GROWTH_DENSITY * territory;
  const projectedOverflow = projectedBalance - capacity;
  if (projectedOverflow <= 0) return null;

  const minimumAmount = (expansionCost + 1) * neutralFrontierTiles;
  const available = balance - Math.floor(SERVER_RESERVE_PARTS * balance / ATTACK_PARTS);
  const percentageLimit = calculatePercentageLimit(balance, normalPercentage);
  if (minimumAmount > available || minimumAmount > percentageLimit) return null;
  const amount = minimumAmount;

  const encoded = Math.ceil(amount * ATTACK_PARTS / balance) - 1;
  return {
    encoded: Math.max(0, Math.min(ATTACK_PARTS - 1, encoded)),
    amount,
    capacity,
    projectedBalance,
    projectedOverflow,
    expectedTerritoryGain: neutralFrontierTiles,
    minimumAmount,
    percentageLimit
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
  let lastAttackTick = null;
  let currentTick = 0;
  let tickDurationMs = 56;
  let lastOpeningCycle = null;
  let nextOpeningCheckTick = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach(listener => listener());
  const remainingTicks = tick => lastAttackTick === null ? 0 : Math.max(0, AUTO_ATTACK_COOLDOWN_TICKS - (tick - lastAttackTick));
  function canPlan(tick) {
    return Number.isFinite(tick) && remainingTicks(tick) === 0
      && (pendingAttack === null || Math.floor(tick / 10) - pendingAttack.cycle >= PENDING_TIMEOUT_CYCLES);
  }
  function shouldPlanOpening(tick) {
    return canPlan(tick) && tick >= nextOpeningCheckTick && Math.floor(tick / 100) !== lastOpeningCycle;
  }

  function schedule(tick, phase, attack, target = null) {
    if (attack === null) return null;
    const cycle = Math.floor(tick / 10);
    if (cycle === lastCycleByPhase[phase]) return null;
    if (!canPlan(tick)) return null;

    lastCycleByPhase[phase] = cycle;
    currentTick = tick;
    lastAttackTick = tick;
    pendingAttack = { cycle, encoded: attack.encoded, target };
    notify();
    return attack;
  }

  return {
    plan(
      tick,
      balance,
      territory,
      nextIncome,
      target = null,
      normalPercentage = ATTACK_PARTS - 1,
      neutralFrontierTiles = 0,
      expansionCost = DEFAULT_EXPANSION_COST
    ) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;
      const attack = calculateAutoExpandAttack(
        balance,
        territory,
        nextIncome,
        normalPercentage,
        neutralFrontierTiles,
        expansionCost
      );
      return schedule(tick, "correction", attack, target);
    },
    planProactive(
      tick,
      balance,
      territory,
      projectedBalance,
      neutralFrontierTiles,
      target = null,
      normalPercentage = ATTACK_PARTS - 1,
      expansionCost = DEFAULT_EXPANSION_COST
    ) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== PROACTIVE_EXPAND_TRIGGER_TICK) return null;
      const attack = calculateProactiveExpandAttack(
        balance,
        territory,
        projectedBalance,
        neutralFrontierTiles,
        normalPercentage,
        expansionCost
      );
      return schedule(tick, "proactive", attack, target);
    },
    planOpening(
      tick,
      balance,
      neutralLayerSizes,
      normalPercentage,
      competitorNearby,
      target = null,
      expansionCost = DEFAULT_EXPANSION_COST,
      options = {}
    ) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== PROACTIVE_EXPAND_TRIGGER_TICK || !shouldPlanOpening(tick)) return null;
      const attack = calculateOpeningExpandAttack(
        balance, tick, neutralLayerSizes, normalPercentage, competitorNearby, expansionCost,
        { ...options, lastAttackTick: lastAttackTick ?? -AUTO_ATTACK_COOLDOWN_TICKS }
      );
      nextOpeningCheckTick = attack?.tick ?? (Math.floor(tick / 100) + 1) * 100;
      if (attack === null || attack.tick !== tick) return null;
      const scheduled = schedule(tick, "proactive", attack, target);
      if (scheduled !== null) lastOpeningCycle = Math.floor(tick / 100);
      return scheduled;
    },
    planBot(tick, ownBalance, normalPercentage, candidates) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;
      const attack = findAutoExpandBotAttack(ownBalance, normalPercentage, candidates);
      return schedule(tick, "correction", attack, attack?.target ?? null);
    },
    planCorrection(
      tick,
      balance,
      territory,
      nextIncome,
      neutralFrontierTiles,
      neutralTarget,
      normalPercentage,
      botCandidates,
      expansionCost = DEFAULT_EXPANSION_COST,
      existingNeutralAttack = 0
    ) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;

      const neutralAttack = neutralFrontierTiles > 0 && existingNeutralAttack === 0
        ? calculateAutoExpandAttack(
          balance,
          territory,
          nextIncome,
          normalPercentage,
          neutralFrontierTiles,
          expansionCost
        )
        : null;
      if (neutralAttack !== null) {
        const targetedNeutralAttack = { ...neutralAttack, target: neutralTarget };
        return schedule(tick, "correction", targetedNeutralAttack, neutralTarget);
      }

      const botAttack = findAutoExpandBotAttack(balance, normalPercentage, botCandidates);
      return schedule(tick, "correction", botAttack, botAttack?.target ?? null);
    },
    canPlan,
    shouldPlanOpening,
    update(tick, durationMs = tickDurationMs) {
      if (!Number.isFinite(tick) || !Number.isFinite(durationMs) || durationMs <= 0) return;
      const previous = remainingTicks(currentTick);
      currentTick = Math.floor(tick);
      tickDurationMs = durationMs;
      if (remainingTicks(currentTick) !== previous) notify();
    },
    getStatus() {
      const ticks = remainingTicks(currentTick);
      return { remainingTicks: ticks, remainingSeconds: ticks * tickDurationMs / 1000, pending: pendingAttack !== null };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    acknowledge(target, encoded, tick) {
      if (pendingAttack !== null && pendingAttack.target === target && pendingAttack.encoded === encoded) pendingAttack = null;
      // An accepted manual attack also gives the bank a recovery period.
      if (Number.isFinite(tick)) {
        currentTick = Math.floor(tick);
        lastAttackTick = Math.max(lastAttackTick ?? currentTick, currentTick);
        nextOpeningCheckTick = 0;
      }
      notify();
    },
    reset() {
      lastCycleByPhase.proactive = null;
      lastCycleByPhase.correction = null;
      pendingAttack = null;
      lastAttackTick = null;
      currentTick = 0;
      lastOpeningCycle = null;
      nextOpeningCheckTick = 0;
      notify();
    }
  };
}

const controller = createAutoExpandController();

export default {
  analyzeFrontier: analyzeExpansionFrontier,
  openingFrontierDepth: OPENING_FRONTIER_DEPTH,
  openingFrontierTileLimit: OPENING_FRONTIER_TILE_LIMIT,
  cooldownTicks: AUTO_ATTACK_COOLDOWN_TICKS,
  calculate: calculateAutoExpandAttack,
  calculateProactive: calculateProactiveExpandAttack,
  calculateOpening: calculateOpeningExpandAttack,
  calculateNextIncome,
  projectBalance,
  findBotAttack: findAutoExpandBotAttack,
  plan: controller.plan,
  planProactive: controller.planProactive,
  planOpening: controller.planOpening,
  planBot: controller.planBot,
  planCorrection: controller.planCorrection,
  canPlan: controller.canPlan,
  shouldPlanOpening: controller.shouldPlanOpening,
  update: controller.update,
  getStatus: controller.getStatus,
  subscribe: controller.subscribe,
  acknowledge: controller.acknowledge,
  reset: controller.reset
};
