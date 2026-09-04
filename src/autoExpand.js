const OPTIMAL_GROWTH_DENSITY = 100;
const SERVER_RESERVE_PARTS = 12;
const ATTACK_PARTS = 1024;

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

export default { calculate: calculateAutoExpandAttack };
