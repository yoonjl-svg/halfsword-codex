/** User-adopted comparisons, confined to their validated player/weapon scope.
 * Explicit research entries retain their original A/B setup and saved settings.
 */
export function configureCombatDefaults(entry, weapon) {
  const ordinary = entry.active && !weapon?.gun && !weapon?.trialOnly;
  const id = weapon?.id;
  return {
    stance: ordinary && id === 'zweihander' ? 'fresh' : 'legacy',
    cut: ordinary && ['longsword', 'zweihander'].includes(id) ? 'centerline' : 'legacy',
    roll: ordinary && ['longsword', 'qinggang'].includes(id) ? 'bounded' : 'legacy',
  };
}
