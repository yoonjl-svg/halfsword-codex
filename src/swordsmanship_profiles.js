// Weapon-aware references for the optional unified swordsmanship controller.
// These are authored game targets, not reconstructed historical techniques or
// measured human optima. The controller owns phase blending and command limits;
// this module changes no bodies, motors, input, attack selection, or strength.
import {
  GUARD_BASE, GUARD_BASE_ONE_SABRE, GUARD_BASE_ONE_THRUST, guardAt,
} from './guards.js';
import { CLASS_RULE, classifyWeapon } from './weapon_class.js';
import { SKILL } from './config.js';

export const PROFILE_VERSION = '20261005-r1';

// Own every array so freezing these references cannot freeze or mutate the
// legacy tables used by the ordinary game and old comparison fixtures.
function copyTable(source) {
  return Object.freeze(source.map((g) => Object.freeze(Object.fromEntries(
    Object.entries(g).map(([key, value]) => [key,
      Array.isArray(value) ? Object.freeze(value.slice()) : value]),
  ))));
}
const TWO_TABLE = copyTable(GUARD_BASE);
const CUT_TABLE = copyTable(GUARD_BASE_ONE_SABRE);
const THRUST_TABLE = copyTable(GUARD_BASE_ONE_THRUST);

// The versatile Qinggang uses the existing cutting reference rather than the
// rapier's point-forward map. In particular side/high directions now differ;
// the controller must blend those references continuously during a new cut.
// No old motion_library heavy/cover/flow override is installed here.
const TABLES = Object.freeze({
  cut: CUT_TABLE, versatile: CUT_TABLE, blunt: CUT_TABLE, thrust: THRUST_TABLE,
});
const ONE_HOME_PAD = Object.freeze([0.15, 0.10]);
const ONE_HOME_DIR = Object.freeze([Math.cos(0.17), 0, Math.sin(0.17)]);
const ONE_HOME_HAND = Object.freeze([0.50, 0.10, 0.05]);
const ONE_READY = Object.freeze({
  sabre: Object.freeze([0.50, 0.08, 0.06]),
  rapier: Object.freeze([0.51, 0.10, 0.03]),
});

/**
 * Build once when configuring a fighter, rather than in a per-step loop.
 * Coordinates: hand/dir = local [forward, up, weapon side]; pad = [side, up].
 * table is a low-speed/preparation reference, not a path to force every moving
 * gesture through. bodyScale and returnScale are initial design multipliers on
 * goal assistance only, not changes to physical force or sword velocity.
 * Guns and unimplemented pole frames deliberately have no sword reference.
 */
export function swordsmanshipProfile(weapon) {
  if (!weapon || typeof weapon !== 'object') throw new TypeError('weapon specification required');
  const { frame, style, phys } = classifyWeapon(weapon);
  const one = frame === 'one';
  const enabled = ['one', 'two', 'heavy'].includes(frame) &&
    ['cut', 'thrust', 'versatile', 'blunt'].includes(style);
  const table = enabled ? (one ? TABLES[style] : TWO_TABLE) : null;
  // Reuse the existing model's high-inertia/front-COM thresholds. A one-hand
  // head-heavy weapon still remains one-handed (currently the trial mace).
  const headHeavyOne = one && phys.I >= CLASS_RULE.heavyIMid && phys.com >= CLASS_RULE.heavyCom;
  let homePad = null, homeHand = null, homeDir = null;
  if (enabled && one) {
    homePad = ONE_HOME_PAD;
    homeHand = ONE_READY[weapon.id] ?? ONE_HOME_HAND;
    homeDir = ONE_HOME_DIR;
  } else if (enabled) {
    homePad = Object.freeze(SKILL.homeGuard.slice());
    const home = guardAt(...homePad, { table });
    homeHand = Object.freeze(home.hand.slice());
    homeDir = Object.freeze(home.dir.slice());
  }
  return Object.freeze({
    version: PROFILE_VERSION,
    id: `${frame}:${style}`,
    weaponId: weapon.id ?? null,
    frame, style, enabled,
    physics: Object.freeze({ ...phys }),
    homePad, homeHand, homeDir, table,
    bodyScale: !enabled ? 0 : one ? (style === 'thrust' ? 0.55 : 0.7) : 1,
    returnScale: !enabled ? 0 : frame === 'heavy' ? 0.75 : headHeavyOne ? 0.8 : 1,
  });
}
