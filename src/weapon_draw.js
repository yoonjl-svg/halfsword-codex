/** Draw tiers, then independent entries, then a member of a paired entry.
 * Returns concrete weapon IDs: card preview and the whole round share that ID.
 * Single-member entries consume the same RNG calls as the original draw.
 */
export function drawGroupedWeaponCards(pool, n, { exclude = null, rnd = Math.random, getWeapon, tierWeights }) {
  const groupOf = id => getWeapon(id).drawGroup || id;
  const all = [...new Set(pool)];
  const excludedGroup = exclude == null ? null : groupOf(exclude);
  let left = all.filter(id => groupOf(id) !== excludedGroup);
  if (new Set(left.map(groupOf)).size < n) left = all;
  const out = [];
  while (out.length < n && left.length) {
    const byTier = {};
    for (const id of left) {
      const tier = getWeapon(id).tier;
      const entries = byTier[tier] ||= new Map();
      const group = groupOf(id);
      if (!entries.has(group)) entries.set(group, []);
      entries.get(group).push(id);
    }
    const tiers = Object.keys(byTier).filter(tier => (tierWeights[tier] ?? 0) > 0);
    if (!tiers.length) break;
    let r = rnd() * tiers.reduce((sum, tier) => sum + tierWeights[tier], 0);
    let tier = tiers[tiers.length - 1];
    for (const t of tiers) if ((r -= tierWeights[t]) < 0) { tier = t; break; }
    const entries = [...byTier[tier].entries()];
    const [group, members] = entries[Math.floor(rnd() * entries.length)];
    out.push(members.length === 1 ? members[0] : members[Math.floor(rnd() * members.length)]);
    left = left.filter(id => groupOf(id) !== group);
  }
  return out;
}
