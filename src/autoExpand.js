import { calculateEconomicAttack } from "./economicAttack.js";

const OPTIMAL_GROWTH_DENSITY = 100;
const SERVER_RESERVE_PARTS = 12;
const ATTACK_PARTS = 1024;
const DEFAULT_EXPANSION_COST = 2;
export const AUTO_EXPAND_TRIGGER_TICK = 3;
export const PROACTIVE_EXPAND_TRIGGER_TICK = 0;
const PROACTIVE_HORIZON_CYCLES = 2;
const PENDING_TIMEOUT_CYCLES = 3;
const OPENING_END_TICK = 600;
const MIN_AUTO_ATTACK_INTERVAL_TICKS = 20;

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
  ownerSearchDepth = 2
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

export function calculateOpeningExpandAttack(
  balance,
  tick,
  neutralLayerSizes,
  normalPercentage,
  competitorNearby = false,
  expansionCost = DEFAULT_EXPANSION_COST
) {
  if (![balance, tick, normalPercentage, expansionCost].every(Number.isFinite) || !Array.isArray(neutralLayerSizes)) return null;
  balance = Math.max(0, Math.floor(balance));
  tick = Math.max(0, Math.floor(tick));
  expansionCost = Math.max(0, Math.floor(expansionCost));
  if (balance === 0 || tick >= OPENING_END_TICK) return null;

  let maxDepth;
  if (tick < 100) {
    maxDepth = 5;
  } else if (tick < 300) {
    maxDepth = 4;
  } else {
    maxDepth = 3;
  }
  if (competitorNearby) {
    maxDepth = 5;
  }

  const available = balance - Math.floor(SERVER_RESERVE_PARTS * balance / ATTACK_PARTS);
  const percentageLimit = calculatePercentageLimit(balance, normalPercentage);
  const budget = Math.min(available, percentageLimit);
  if (budget <= 0) return null;

  let previousTiles = 0;
  let minimumAmount = 0;
  let selectedMinimumAmount = 0;
  let selectedDepth = 0;
  let expectedTerritoryGain = 0;
  const depth = Math.min(maxDepth, neutralLayerSizes.length);
  for (let layer = 0; layer < depth; layer++) {
    const layerSize = Math.max(0, Math.floor(neutralLayerSizes[layer] || 0));
    if (layerSize === 0) break;

    // Completed layers consume expansionCost troops per tile. Reaching the
    // next layer requires one additional troop per frontier tile.
    minimumAmount = Math.max(
      minimumAmount,
      expansionCost * previousTiles + (expansionCost + 1) * layerSize
    );
    if (minimumAmount > budget) break;
    previousTiles += layerSize;
    selectedMinimumAmount = minimumAmount;
    selectedDepth = layer + 1;
    expectedTerritoryGain = previousTiles;
  }
  if (selectedMinimumAmount <= 0) return null;

  const amount = selectedMinimumAmount;
  const encoded = Math.ceil(amount * ATTACK_PARTS / balance) - 1;
  return {
    encoded: Math.max(0, Math.min(ATTACK_PARTS - 1, encoded)),
    amount,
    minimumAmount: selectedMinimumAmount,
    depth: selectedDepth,
    expectedTerritoryGain,
    budget,
    percentageLimit,
    competitorNearby: Boolean(competitorNearby)
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
  let lastNeutralAttackTick = null;

  function schedule(tick, phase, attack, target = null, useNeutralCooldown = false, bypassNeutralCooldown = false) {
    if (attack === null) return null;
    const cycle = Math.floor(tick / 10);
    if (cycle === lastCycleByPhase[phase]) return null;
    if (useNeutralCooldown && !bypassNeutralCooldown && lastNeutralAttackTick !== null
      && tick - lastNeutralAttackTick < MIN_AUTO_ATTACK_INTERVAL_TICKS) return null;

    if (pendingAttack !== null) {
      if (cycle - pendingAttack.cycle < PENDING_TIMEOUT_CYCLES) return null;
      pendingAttack = null;
    }

    lastCycleByPhase[phase] = cycle;
    if (useNeutralCooldown) lastNeutralAttackTick = tick;
    pendingAttack = { cycle, encoded: attack.encoded, target };
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
      // An urgent correction may reinforce neutral expansion immediately,
      // but it still respects the slider and the initial frontier cost.
      return schedule(tick, "correction", attack, target, true, true);
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
      return schedule(tick, "proactive", attack, target, true, false);
    },
    planOpening(
      tick,
      balance,
      neutralLayerSizes,
      normalPercentage,
      competitorNearby,
      target = null,
      expansionCost = DEFAULT_EXPANSION_COST
    ) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== PROACTIVE_EXPAND_TRIGGER_TICK) return null;
      const attack = calculateOpeningExpandAttack(
        balance,
        tick,
        neutralLayerSizes,
        normalPercentage,
        competitorNearby,
        expansionCost
      );
      return schedule(tick, "proactive", attack, target, true, false);
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
      expansionCost = DEFAULT_EXPANSION_COST
    ) {
      if (!Number.isFinite(tick)) return null;
      tick = Math.floor(tick);
      if (positiveModulo(tick, 10) !== triggerTick) return null;

      const neutralAttack = neutralFrontierTiles > 0
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
        return schedule(tick, "correction", targetedNeutralAttack, neutralTarget, true, true);
      }

      const botAttack = findAutoExpandBotAttack(balance, normalPercentage, botCandidates);
      return schedule(tick, "correction", botAttack, botAttack?.target ?? null);
    },
    acknowledge(target, encoded) {
      if (pendingAttack !== null && pendingAttack.target === target && pendingAttack.encoded === encoded) pendingAttack = null;
    },
    reset() {
      lastCycleByPhase.proactive = null;
      lastCycleByPhase.correction = null;
      pendingAttack = null;
      lastNeutralAttackTick = null;
    }
  };
}

const controller = createAutoExpandController();

export default {
  analyzeFrontier: analyzeExpansionFrontier,
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
  acknowledge: controller.acknowledge,
  reset: controller.reset
};
