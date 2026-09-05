const COMBAT_COST = 2;
const SAFETY_NUMERATOR = 11;
const SAFETY_DENOMINATOR = 10;
const SERVER_RESERVE_PARTS = 12;
const ATTACK_PARTS = 1024;

let armed = false;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener(armed));
}

function notify(message, type = "info") {
  window.__fx?.notifications?.show(message, type, 4200);
}

export function calculateEconomicAttack(
  ownBalance,
  targetBalance,
  targetTerritory,
  normalPercentage,
  existingAttack = 0
) {
  if (![ownBalance, targetBalance, targetTerritory, normalPercentage, existingAttack].every(Number.isFinite)) return null;
  ownBalance = Math.max(0, Math.floor(ownBalance));
  targetBalance = Math.max(0, Math.floor(targetBalance));
  targetTerritory = Math.max(0, Math.floor(targetTerritory));
  normalPercentage = Math.max(0, Math.min(ATTACK_PARTS - 1, Math.floor(normalPercentage)));
  existingAttack = Math.max(0, Math.floor(existingAttack));

  // Capturing costs two troops per territory tile, while defeating one enemy
  // troop costs roughly two attackers. Add the same 10% safety margin the game
  // uses for its conservative bot attacks.
  const conquestCost = COMBAT_COST * (targetBalance + targetTerritory);
  const required = Math.max(
    1,
    Math.ceil(conquestCost * SAFETY_NUMERATOR / SAFETY_DENOMINATOR) - existingAttack
  );
  const available = ownBalance - Math.floor(SERVER_RESERVE_PARTS * ownBalance / ATTACK_PARTS);
  const percentageLimit = Math.min(
    available,
    Math.floor(ownBalance * (normalPercentage + 1) / ATTACK_PARTS)
  );
  const amount = Math.min(required, percentageLimit);
  if (ownBalance === 0 || amount <= 0) return null;

  // Territorial sends floor(balance * (encoded + 1) / 1024). Round upward so
  // integer truncation can never make the requested amount one troop short.
  const encoded = Math.ceil(amount * ATTACK_PARTS / ownBalance) - 1;
  return {
    encoded: Math.max(0, Math.min(ATTACK_PARTS - 1, encoded)),
    amount,
    required,
    available,
    percentageLimit,
    isSafe: amount >= required
  };
}

function setArmed(nextArmed) {
  if (armed === nextArmed) return;
  armed = nextArmed;
  notifyListeners();
}

function toggle() {
  setArmed(!armed);
  notify(armed ? "Economic mode enabled — auto-expansion active" : "Economic mode disabled");
  return armed;
}

function reset(enabled = false) {
  setArmed(Boolean(enabled));
}

function resolve(normalPercentage, ownBalance, targetBalance, targetTerritory, existingAttack) {
  if (!armed) return normalPercentage;

  if (targetBalance === null || targetBalance === undefined || targetTerritory === null || targetTerritory === undefined) {
    // ECO only modifies player attacks. Neutral expansion keeps the requested
    // percentage, including percentages produced by automatic expansion.
    return normalPercentage;
  }

  const attack = calculateEconomicAttack(
    ownBalance,
    targetBalance,
    targetTerritory,
    normalPercentage,
    existingAttack
  );
  if (!attack) {
    notify("Economic attack cancelled — the selected percentage sends no troops", "error");
    return null;
  }

  if (attack.isSafe) {
    notify(`Economic attack: sending ${attack.amount.toLocaleString()} troops`, "success");
  } else {
    notify(
      `Economic attack capped at ${attack.amount.toLocaleString()} troops; ${attack.required.toLocaleString()} needed for a safe conquest`,
      "info"
    );
  }
  return attack.encoded;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const economicAttack = {
  isArmed: () => armed,
  toggle,
  reset,
  resolve,
  subscribe
};

export default economicAttack;
