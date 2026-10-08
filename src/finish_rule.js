/** Optional injury-threshold policy for the approved finishing-thrust rule.
 * Legacy preserves its armor-independent exception. armorCausal only removes
 * that exception when contributing armor prevented an otherwise injuring stab.
 * armorGuard additionally suppresses the exception for weaker armored stabs,
 * avoiding a weak-hit kill / stronger-hit survival reversal. Causal wound
 * prevention (armorBlocked) stays distinct from this broader design rule.
 * Penetration/pass is deliberately separate from the injury threshold.
 * power replaces the death exception with uncapped 2.5x effective stab energy;
 * actual tissue/armor thresholds and normal lethal wounds decide the outcome.
 */
export const FINISH_POWER = 2.5;

export function effectiveFinishEnergy({ model, eligible, energy }) {
  return model === 'power' && eligible ? energy * FINISH_POWER : energy;
}

export function resolveFinishRule({ model = 'legacy', eligible = false, type, eff, threshold, bareThreshold, armorActive = false, ignoreArmor = false } = {}) {
  const armorBlocked = !!eligible && type === 'stab' && !!armorActive && !ignoreArmor
    && Number.isFinite(eff) && Number.isFinite(threshold) && Number.isFinite(bareThreshold)
    && threshold > bareThreshold && eff <= threshold && eff > bareThreshold;
  if (!eligible) return { finish: false, armorBlocked: false, reason: 'ineligible' };
  if (model === 'power') {
    const armorGuarded = type === 'stab' && !!armorActive && !ignoreArmor
      && Number.isFinite(eff) && Number.isFinite(threshold) && Number.isFinite(bareThreshold)
      && threshold > bareThreshold && eff <= threshold;
    return { finish: false, armorBlocked, armorGuarded,
      reason: armorGuarded ? 'armor-guarded' : 'powered-wound' };
  }
  if (model === 'armorGuard') {
    const armorGuarded = type === 'stab' && !!armorActive && !ignoreArmor
      && Number.isFinite(eff) && Number.isFinite(threshold) && Number.isFinite(bareThreshold)
      && threshold > bareThreshold && eff <= threshold;
    return { finish: !armorGuarded, armorBlocked, armorGuarded,
      reason: armorGuarded ? 'armor-guarded' : 'exception-preserved' };
  }
  if (model === 'armorCausal' && armorBlocked) return { finish: false, armorBlocked: true, reason: 'armor-blocked' };
  return { finish: true, armorBlocked, reason: model === 'armorCausal' ? 'exception-preserved' : 'legacy' };
}
