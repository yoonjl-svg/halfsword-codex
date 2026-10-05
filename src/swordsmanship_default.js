// Entry policy only. Installation remains player-only in main.js; this helper
// does not write settings, configure physics, or activate research candidates.
import { WEAPON_LIST } from './weapons.js';

const WITHHELD = new Set(['monohoshizao', 'lightsaber']);
export const SWORDSMANSHIP_DEFAULT_WEAPONS = Object.freeze(WEAPON_LIST
  .filter(weapon => !weapon.trialOnly && !weapon.gun && !WITHHELD.has(weapon.id))
  .map(weapon => weapon.id));
const SUPPORTED = new Set(SWORDSMANSHIP_DEFAULT_WEAPONS);

// Explicit comparison/research intent keeps its old setup even when its value
// is malformed, withdrawn, or incomplete. Keep parameter names in sync with
// main.js, configure*Trial(), support_probe.js, and mobile_intent.js.
export const SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS = Object.freeze([
  'swordsmanshipTrial', 'combatTrial', 'contactV2', 'stanceV2',
  'physicsTrial', 'supportProbe', 'assist', 'catch', 'catchScale',
  'cutTrial', 'armTrial', 'armRecoveryTrial', 'wristBraking', 'edgeTrial', 'stanceTrial',
  'targetCorrection', 'onehandArm', 'gripPoint', 'thrustEdge', 'bladeShape', 'thrustPlane',
  'finishRule', 'motionAssist', 'motionTiming', 'swordAssist',
  'inputComparison', 'mobileVerticalGain', 'limbTrial', 'limbDemo', 'emo',
]);

/** A real resolved weapon specification, not an unvalidated URL identifier. */
export function swordsmanshipDefaultSupportsWeapon(weapon) {
  return !!weapon && !weapon.gun && !weapon.trialOnly && SUPPORTED.has(weapon.id);
}

/**
 * Read the original requested URLSearchParams BEFORE compound trial parsing
 * can replace malformed queries with empty params. Ordinary weapon/opponent,
 * arena, cards, appearance and performance selections do not opt out.
 * swordsmanship=legacy is the sole explicit fallback spelling; duplicates and
 * other values also stay legacy, rather than silently enabling a new policy.
 */
export function configureSwordsmanshipDefault(params) {
  const overrides = params.getAll('swordsmanship');
  const blockedBy = SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.filter(key => params.has(key));
  const malformed = overrides.length > 0 &&
    (overrides.length !== 1 || overrides[0] !== 'legacy');
  const explicitLegacy = overrides.length === 1 && overrides[0] === 'legacy';
  const active = !malformed && !explicitLegacy && blockedBy.length === 0;
  return {
    active,
    model: active ? 'unified' : 'legacy',
    reason: malformed ? 'malformed_default_override' : explicitLegacy ? 'explicit_legacy'
      : blockedBy.length ? 'research_entry' : 'ordinary_entry',
    blockedBy,
    settings: active ? { skill: '0.7' } : {},
    playerOnly: true,
  };
}
