export const GROWTH_APP = 'halfsword-codex-growth-trial';
export const TRIAL_RULES = Object.freeze({ winCoins: 10, milestone: 3, pointsPerMilestone: 1, strengthStep: 0.02, strengthCap: 5 });
export const TRIAL_CATALOG = Object.freeze([{ id: 'wayfarer_seal', name: '여행자의 인장', price: 30 }]);
export function emptyGrowth() {
  return { wins: 0, coins: 0, points: 0, characters: { player: { strength: 0 } }, inventory: [], equipped: null, revision: 0, rules: { ...TRIAL_RULES }, catalog: structuredClone(TRIAL_CATALOG) };
}
export function checkedGrowth(value) {
  for (const key of ['wins', 'coins', 'points', 'revision']) if (!Number.isSafeInteger(value?.[key]) || value[key] < 0) throw Error('Invalid growth data');
  if (!Number.isInteger(value?.characters?.player?.strength) || value.characters.player.strength < 0 || value.characters.player.strength > 5) throw Error('Invalid strength');
  if (!Array.isArray(value.inventory) || value.inventory.length > 1000 || value.inventory.some(x => typeof x !== 'string' || x.length > 64)) throw Error('Invalid inventory');
  if (value.equipped !== null && !value.inventory.includes(value.equipped)) throw Error('Invalid equipped item');
  return structuredClone(value);
}
export function growthEntry(params) {
  return params.getAll('account').length === 1 && params.get('account') === '1' && params.getAll('growth').length === 1 && params.get('growth') === '1' && [...params.keys()].every(key => ['account', 'growth'].includes(key));
}
export function applyGrowthStrength(fighter, snapshot) {
  const n = snapshot?.characters?.player?.strength;
  const level = Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
  fighter.strength = 1 + 0.02 * level;
  return fighter.strength;
}
