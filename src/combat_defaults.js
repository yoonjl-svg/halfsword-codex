/** User-adopted common behavior, selected by the feature a weapon uses.
 * Explicit research entries retain their original A/B setup and saved settings.
 * Stance memory belongs to the legs, including a gun user's legs. Guns keep
 * their existing aiming controller; edged melee weapons also use cut resistance.
 * Research roll/thrust controllers retain their bypass in Fighter.driveSword.
 */
export function configureCombatDefaults(entry, weapon) {
  const ordinary = !!entry?.active && !!weapon && !weapon.trialOnly;
  const melee = ordinary && !weapon.gun;
  return {
    stance: ordinary ? 'fresh' : 'legacy',
    cut: melee && weapon.edged ? 'centerline' : 'legacy',
    roll: melee ? 'bounded' : 'legacy',
  };
}
