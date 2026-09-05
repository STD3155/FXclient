// Mechanics and assumptions: docs/auto-expand-opening.md.
export const OPENING_END_TICK = 600;
export const AUTO_ATTACK_COOLDOWN_TICKS = 50;
export const OPENING_FRONTIER_DEPTH = 48;
export const OPENING_FRONTIER_TILE_LIMIT = 32_768;
const CYCLE_TICKS = 100;
const ATTACK_PARTS = 1024;
const ATTACK_FEE_PARTS = 12;

function expansionInterval(territory) {
  return territory < 1_000 ? 4 : territory < 10_000 ? 3 : territory < 60_000 ? 2 : 1;
}

function interestRate(balance, territory, tick, economy) {
  let baseRate = economy.baseRates.get(territory);
  if (baseRate === undefined) {
    const share = Math.floor((economy.maxPlayers - 1) * territory / economy.mapTerritory);
    // The game's integer square-root table, including its rounding.
    const value = Math.floor(25_600 * Math.min(share, economy.maxPlayers - 1) / (economy.maxPlayers - 4));
    let root = Math.floor((value + 1) / 2);
    if (value > 0) for (let i = 0; i < 9; i++) root = Math.floor((root + Math.floor(value / root)) / 2);
    baseRate = 100 + root;
    economy.baseRates.set(territory, baseRate);
  }
  let rate = Math.max(baseRate, Math.floor(700 - 5 * tick / 16));
  const capacity = Math.min(100 * territory, 1_000_000_000);
  if (balance > capacity) rate -= Math.floor(2 * rate * (balance - capacity) / capacity);
  return Math.floor(Math.min(700, Math.max(0, rate)) * economy.interestScale / 64);
}

function addIncome(balance, territory, tick, economy) {
  const cap = Math.min(150 * territory, 1_500_000_000);
  balance = Math.min(cap, balance + Math.max(1, Math.floor(balance * interestRate(balance, territory, tick, economy) / 10_000)));
  balance = Math.min(cap, balance + Math.floor(economy.armyIncomeScale * territory / 128));
  if (tick % CYCLE_TICKS === 99) balance = Math.min(cap, balance + Math.floor(economy.territorialIncomeScale * territory / 32));
  return balance;
}

function advance(state, from, until, layers, economy, expansionCost, send = null) {
  let { balance, territory, offset, lastAttackTick } = state;
  let army = 0;
  let expansionTick = Infinity;
  if (send) {
    army = Math.floor(balance * (send.encoded + 1) / ATTACK_PARTS);
    balance -= army + Math.floor(ATTACK_FEE_PARTS * balance / ATTACK_PARTS);
    lastAttackTick = from;
    expansionTick = from + 7 + economy.commandDelayTicks;
  }
  let incomeTick = from + ((9 - from % 10 + 10) % 10);
  for (let tick = Math.min(incomeTick, expansionTick); tick <= until; tick = Math.min(incomeTick, expansionTick)) {
    // Income precedes land expansion in the actual game tick.
    if (tick === incomeTick) {
      balance = addIncome(balance, territory, tick, economy);
      incomeTick += 10;
    }
    if (tick === expansionTick) {
      const tiles = layers[offset] || 0;
      const interval = expansionInterval(territory);
      if (tiles === 0 || army < (expansionCost + 1) * tiles) {
        balance = Math.min(150 * territory, 1_500_000_000, balance + army);
        army = 0;
        expansionTick = Infinity;
      } else {
        territory += tiles;
        offset++;
        army -= expansionCost * tiles;
        expansionTick += interval;
      }
    }
  }
  return { balance, territory, offset, lastAttackTick, army };
}

export function calculateOpeningExpandAttack(
  balance,
  tick,
  neutralLayerSizes,
  normalPercentage,
  competitorNearby = false,
  expansionCost = 2,
  options = {}
) {
  const economy = {
    territory: 12,
    armyIncomeScale: 0,
    territorialIncomeScale: 32,
    interestScale: 64,
    mapTerritory: 1_000_000,
    maxPlayers: 512,
    commandDelayTicks: 0,
    lastAttackTick: -AUTO_ATTACK_COOLDOWN_TICKS,
    ...options
  };
  if (![balance, tick, normalPercentage, expansionCost, ...Object.values(economy)].every(Number.isFinite)
    || !Array.isArray(neutralLayerSizes) || neutralLayerSizes.some(size => !Number.isFinite(size) || size < 0)
    || economy.territory <= 0 || economy.mapTerritory <= 0 || economy.maxPlayers <= 4
    || economy.armyIncomeScale < 0 || economy.territorialIncomeScale < 0 || economy.interestScale < 0
    || economy.commandDelayTicks < 0 || tick < 0 || tick >= OPENING_END_TICK || balance <= 0 || expansionCost < 0) return null;
  tick = Math.floor(tick);
  balance = Math.floor(balance);
  expansionCost = Math.floor(expansionCost);
  const layers = neutralLayerSizes.slice(0, OPENING_FRONTIER_DEPTH).map(Math.floor);
  if (!layers[0]) return null;
  economy.baseRates = new Map();
  // Keep at least half of the bank before the fee, even with a high slider.
  const percentage = Math.max(0, Math.min(511, Math.floor(normalPercentage)));
  const initial = { balance, territory: Math.floor(economy.territory), offset: 0, lastAttackTick: economy.lastAttackTick, first: null };
  let states = [initial];
  const landValue = expansionCost + (competitorNearby ? 1 : 0);
  const score = state => state.balance + landValue * state.territory;
  // Nearby rivals can take today's neutral land before a long forecast pays
  // off. Favor securing it over the next two territorial-income cycles.
  const horizon = competitorNearby ? Math.min(OPENING_END_TICK, (Math.floor(tick / CYCLE_TICKS) + 2) * CYCLE_TICKS) : OPENING_END_TICK;

  // Search complete-layer attacks on the ten-tick grid, at most once per
  // territorial-income cycle. Keep the strongest bank for each equivalent
  // territory/cooldown state; later cycles then retain the value of investing
  // in land early instead of greedily maximizing the next payout alone.
  for (let from = tick; from < horizon;) {
    const end = Math.floor(from / CYCLE_TICKS) * CYCLE_TICKS + CYCLE_TICKS - 1;
    const candidates = new Map();
    const keep = candidate => {
      const key = candidate.offset * CYCLE_TICKS + Math.max(0, candidate.lastAttackTick + AUTO_ATTACK_COOLDOWN_TICKS - end - 1);
      const previous = candidates.get(key);
      if (!previous || candidate.balance > previous.balance) candidates.set(key, candidate);
    };
    for (const state of states) {
      keep({ ...advance(state, from, end, layers, economy, expansionCost), first: state.first });
      const earliest = Math.ceil(Math.max(from, state.lastAttackTick + AUTO_ATTACK_COOLDOWN_TICKS) / 10) * 10;
      for (let start = earliest; start < end; start += 10) {
        const before = advance(state, from, start - 1, layers, economy, expansionCost);
        const budget = Math.min(
          Math.floor(before.balance * (percentage + 1) / ATTACK_PARTS),
          before.balance - Math.floor(ATTACK_FEE_PARTS * before.balance / ATTACK_PARTS)
        );
        let tiles = 0;
        let minimumAmount = 0;
        let returnTick = start + 7 + economy.commandDelayTicks;
        let territory = before.territory;
        for (let offset = before.offset; offset < layers.length && layers[offset] > 0; offset++) {
          minimumAmount = Math.max(minimumAmount, expansionCost * tiles + (expansionCost + 1) * layers[offset]);
          const encoded = Math.ceil(minimumAmount * ATTACK_PARTS / before.balance) - 1;
          const amount = Math.floor(before.balance * (encoded + 1) / ATTACK_PARTS);
          if (encoded > percentage || amount > budget) break;
          tiles += layers[offset];
          returnTick += expansionInterval(territory);
          territory += layers[offset];
          if (returnTick > end) break;
          const attack = { tick: start, encoded, amount, minimumAmount, depth: offset - before.offset + 1, expectedTerritoryGain: tiles, percentageLimit: budget };
          const after = advance(before, start, end, layers, economy, expansionCost, attack);
          if (after.army !== 0) continue;
          keep({ ...after, first: from === tick ? attack : state.first });
        }
      }
    }
    states = Array.from(candidates.values());
    from = end + 1;
  }
  const best = states.reduce((best, state) => score(state) > score(best) ? state : best);
  if (best.first === null) return null;
  return { ...best.first, projectedBalance: best.balance, projectedTerritory: best.territory, score: score(best), competitorNearby: Boolean(competitorNearby) };
}
