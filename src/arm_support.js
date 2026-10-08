/** Injury-aware offhand coupling. No Rapier calls: safe in contact filters.
 * Existing wrist motors and actual sword inertia are deliberately separate.
 * The virtual contact proxy is split equally between main and supporting arm;
 * this is a game-model allocation, not a measured anatomical mass fraction.
 */
import * as THREE from 'three';
import { GRIP, STRIKE } from './config.js';

const clamp01 = x => Math.max(0, Math.min(1, x));
const gripStates = new Set(['stand', 'kneel', 'getup']);

export function offhandHealthScale(f) {
  return 0.5 + 0.5 * clamp01(f.limbs.armO);
}

export function offhandCanGrip(f) {
  return !!(f.armed && f.weaponCfg.twoHand && gripStates.has(f.state)
    && f.muscle > 0.3 && f.limbs.armO > 0.3 && GRIP.on
    && !f.detachedParts?.has('uarmO') && !f.detachedParts?.has('farmO'));
}

export function sampleArmSupport(f, cache) {
  const eligible = offhandCanGrip(f);
  const hand = cache?.parts?.farmO, sword = cache?.sword;
  let distance = null, reachWeight = 0;
  if (eligible && hand && sword) {
    const h = new THREE.Vector3(0, -0.135, 0).applyQuaternion(hand.q).add(hand.p);
    const p = new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(sword.q).add(sword.p);
    distance = h.distanceTo(p);
    reachWeight = clamp01((GRIP.reach - distance) / (GRIP.reach * 0.5));
  }
  const muscleScale = clamp01(f.muscle), healthScale = offhandHealthScale(f);
  return { eligible, distance, reachWeight, muscleScale, healthScale,
    weight: eligible ? reachWeight * muscleScale * healthScale : 0 };
}

export function strikeArmSupportScale(f) {
  if (f.armSupportModel !== 'linked' || !f.weaponCfg.twoHand) return 1;
  const sample = f.cache?.armSupport;
  // The geometry belongs to the same pre-step sample as contact velocity.
  // New loss/detachment within afterStep takes effect immediately. Recovery
  // cannot reuse old support before the next real cacheState sample.
  const support = sample?.eligible && offhandCanGrip(f)
    ? sample.reachWeight * Math.min(sample.muscleScale, clamp01(f.muscle))
      * Math.min(sample.healthScale, offhandHealthScale(f)) : 0;
  return 0.5 + 0.5 * clamp01(support);
}

export function strikeArmAssist(f, kind = 'swing') {
  const base = kind === 'thrust' ? STRIKE.thrustAssist : STRIKE.armAssist;
  return base * strikeArmSupportScale(f);
}
