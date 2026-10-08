import { BODY, SKILL } from './config.js';

/** Optional low-target entry. Combat floors are currently the plane y=0.
 * Heights are gameplay entry geometry, not measured human motion limits.
 * The exit margin spans roughly one torso half-thickness to avoid chatter.
 */
export const LOW_FINISH = Object.freeze({
  enterHeight: BODY.standHeight * 0.7,
  exitMargin: 0.1,
  minimumDrop: 0.2,
  approach: SKILL.lungeMove * SKILL.level,
});

export const lowFinishEnabled = f => f?.finishEntryModel === 'low';

/** Pure current-body predicate: safe in repeated contact prediction queries.
 * A kneeling attacker is allowed; an upright kneeling victim is not a finish.
 * Do not read the previous frame's fin.on or mutate the tap here.
 */
export function lowFinishPosture(att, vic = att?.foe, continuing = false, cached = false) {
  if (!att?.alive || !att.armed || !vic?.alive ||
      !['stand', 'kneel'].includes(att.state) || !['down', 'getup'].includes(vic.state)) return false;
  // Rapier contact prediction owns the native world: only pre-step JS copies
  // may be read there. Missing cache rejects; it must not fall back to native.
  const position = (f, part) => cached ? f.cache?.parts?.[part]?.p : f.bodies[part].translation();
  const chest = position(vic, 'chest'), pelvis = position(vic, 'pelvis'), attacker = position(att, 'chest');
  const headTarget = !att.weaponCfg.edged || att.weaponBroken;
  const head = headTarget ? position(vic, 'head')?.y : -Infinity;
  if (!chest || !pelvis || !attacker || (headTarget && !Number.isFinite(head))) return false;
  const highest = Math.max(chest.y, pelvis.y, head);
  const limit = LOW_FINISH.enterHeight + (continuing ? LOW_FINISH.exitMargin : 0);
  return Number.isFinite(highest) && highest <= limit &&
    highest + LOW_FINISH.minimumDrop < attacker.y;
}
