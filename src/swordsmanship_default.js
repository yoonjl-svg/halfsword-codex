// Entry policy only. Installation remains player-only in main.js; this helper
// does not write settings, configure physics, or activate research candidates.
import { WEAPON_LIST } from './weapons.js';

// Monohoshizao passed the current axial-grip/linked-arm comparison. Lightsaber
// remains a preview because some real follow-up swings lose speed/energy.
const WITHHELD = new Set(['lightsaber']);
export const SWORDSMANSHIP_DEFAULT_WEAPONS = Object.freeze(WEAPON_LIST
  .filter(weapon => !weapon.trialOnly && !weapon.gun && !WITHHELD.has(weapon.id))
  .map(weapon => weapon.id));
const SUPPORTED = new Set(SWORDSMANSHIP_DEFAULT_WEAPONS);

// Explicit comparison/research intent keeps its old setup even when its value
// is malformed, withdrawn, or incomplete. Keep parameter names in sync with
// main.js, configure*Trial(), support_probe.js, and mobile_intent.js.
export const SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS = Object.freeze([
  'swordsmanshipTrial', 'combatTrial', 'contactV2', 'stanceV2', 'gravityV2', 'recoveryContactV2', 'recutV2', 'finishV2',
  'physicsTrial', 'supportProbe', 'assist', 'catch', 'catchScale',
  'cutTrial', 'armTrial', 'armRecoveryTrial', 'wristBraking', 'edgeTrial', 'stanceTrial',
  'targetCorrection', 'onehandArm', 'gripPoint', 'thrustEdge', 'bladeShape', 'thrustPlane',
  'finishRule', 'motionAssist', 'motionTiming', 'swordAssist',
  'inputComparison', 'mobileVerticalGain', 'limbTrial', 'limbDemo', 'emo',
]);

/** A real resolved weapon specification, not an unvalidated URL identifier. */
export function swordsmanshipDefaultSupportsWeapon(weapon, entry) {
  return !!weapon && !weapon.gun && !weapon.trialOnly &&
    (SUPPORTED.has(weapon.id) || !!(entry?.active && entry.previewWeapon === weapon.id));
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
  // The preview changes player goal authorship only. Keeping this inside the
  // ordinary entry preserves current grip, recovery, cut and finishing rules.
  // It is intentionally not the broad swordsmanship=legacy fallback.
  const preview = params.getAll('swordsmanshipPreview');
  const previewRequested = preview.length > 0;
  const previewValid = preview.length === 1 && preview[0] === 'v2' &&
    params.getAll('weapon').length === 1 && params.get('weapon') === 'lightsaber' &&
    overrides.length === 0;
  const malformedPreview = previewRequested && !previewValid;
  const blockedBy = SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.filter(key => params.has(key));
  const malformed = overrides.length > 0 &&
    (overrides.length !== 1 || overrides[0] !== 'legacy');
  const explicitLegacy = overrides.length === 1 && overrides[0] === 'legacy';
  const active = !malformed && !malformedPreview && !explicitLegacy && blockedBy.length === 0;
  return {
    active,
    model: active ? 'unified' : 'legacy',
    reason: malformedPreview ? 'malformed_swordsmanship_preview'
      : malformed ? 'malformed_default_override' : explicitLegacy ? 'explicit_legacy'
      : blockedBy.length ? 'research_entry' : 'ordinary_entry',
    previewWeapon: active && previewValid ? 'lightsaber' : null,
    blockedBy,
    settings: active ? { skill: '0.7' } : {},
    playerOnly: true,
  };
}
