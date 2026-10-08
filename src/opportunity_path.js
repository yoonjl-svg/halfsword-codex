// Preparation observations, not a native trajectory predictor. A resolved
// future command plane and the weapon's present tracking error are distinct.
import * as THREE from 'three';
import { OPPORTUNITY } from './opportunity_target.js';

export const OPPORTUNITY_PATH = Object.freeze({
  trackingShare: 0.5,
  heightTrim: OPPORTUNITY.handHeightBudget * 0.25,
  pitchTrim: OPPORTUNITY.pitchBudget * 0.25,
  minHorizontal: 0.2,
  minHeadingAgreement: Math.cos(Math.PI / 4),
});
const clamp = THREE.MathUtils.clamp;
const finite = v => v && [v.x, v.y, v.z].every(Number.isFinite);
const vector = v => Array.isArray(v) ? new THREE.Vector3(...v) : new THREE.Vector3(v.x, v.y, v.z);
const elevation = v => Math.atan2(v.y, Math.hypot(v.x, v.z));

/** Read only the attacker's own bodies and an already-owned target. Residuals
 * are measured against the last command submitted to the ordinary muscles,
 * including its previous overlay. They are NOT added to the previous trim.
 * Total offsets and their callers' existing slew rates retain the v1 budget.
 * A hilt or an unbounded backward ray is never treated as a hitting blade. */
export function opportunityPathGoal(f, targetWorld, reference) {
  if (!reference?.hand || !reference.aim || !finite(targetWorld) || !f?.sword ||
      !f.bodies?.chest || !f.yaw || !f.weaponCfg) return null;
  const hand = vector(reference.hand), aim = vector(reference.aim);
  const chest = vector(f.bodies.chest.translation());
  const inv = f.yaw.clone().invert();
  const target = vector(targetWorld).sub(chest).applyQuaternion(inv);
  const lo = f.weaponCfg.hiltLength, hi = lo + f.weaponCfg.bladeLength;
  if (![hand, aim, chest, target].every(finite) || !Number.isFinite(lo) ||
      !Number.isFinite(hi) || !(hi > lo) || aim.lengthSq() < 1e-10) return null;
  aim.normalize();
  const along = (target.x - hand.x) / aim.x;
  if (aim.x <= 0.1 || !(along >= lo && along <= hi) ||
      Math.abs(hand.z + aim.z * along - target.z) > OPPORTUNITY.guardRadius) return null;

  const origin = vector(f.sword.translation());
  const q = f.sword.rotation();
  if (!finite(origin) || !q || ![q.x, q.y, q.z, q.w].every(Number.isFinite)) return null;
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).normalize();
  const actualOrigin = origin.clone().sub(chest).applyQuaternion(inv);
  const actualAxis = axis.clone().applyQuaternion(inv);
  // This is only the present segment's target-plane intersection, not a
  // future contact claim. A chambered/backward blade can have no intersection.
  const actualAlong = actualAxis.x > 0.1 ? (target.x - actualOrigin.x) / actualAxis.x : null;
  const actualWithinAxialInterval = actualAlong !== null && actualAlong >= lo && actualAlong <= hi;
  const actualHeight = actualWithinAxialInterval ? actualOrigin.y + actualAxis.y * actualAlong : null;
  const actualSideError = actualWithinAxialInterval ? actualOrigin.z + actualAxis.z * actualAlong - target.z : null;

  let heightTrim = 0, pitchTrim = 0, trackingHeight = null, trackingPitch = null;
  if (finite(f.handTarget)) {
    trackingHeight = origin.y - f.handTarget.y;
    heightTrim = clamp(-trackingHeight * OPPORTUNITY_PATH.trackingShare,
      -OPPORTUNITY_PATH.heightTrim, OPPORTUNITY_PATH.heightTrim);
  }
  if (finite(f.aimDirW)) {
    const commandAxis = vector(f.aimDirW), commandLocal = commandAxis.clone().applyQuaternion(inv);
    const ah = Math.hypot(axis.x, axis.z), ch = Math.hypot(commandAxis.x, commandAxis.z);
    const sameHeading = actualAxis.x > 0.1 && commandLocal.x > 0.1 &&
      ah > OPPORTUNITY_PATH.minHorizontal && ch > OPPORTUNITY_PATH.minHorizontal &&
      (axis.x * commandAxis.x + axis.z * commandAxis.z) / (ah * ch) >= OPPORTUNITY_PATH.minHeadingAgreement;
    if (sameHeading) {
      trackingPitch = elevation(axis) - elevation(commandAxis);
      pitchTrim = clamp(-trackingPitch * OPPORTUNITY_PATH.trackingShare,
        -OPPORTUNITY_PATH.pitchTrim, OPPORTUNITY_PATH.pitchTrim);
    }
  }
  const nominalHeight = hand.y + aim.y * along;
  const handY = clamp((target.y - nominalHeight) * 0.55 + heightTrim,
    -OPPORTUNITY.handHeightBudget, OPPORTUNITY.handHeightBudget);
  const wanted = Math.atan2(target.y - hand.y - handY,
    Math.max(0.2, Math.hypot(target.x - hand.x, target.z - hand.z)));
  const pitch = clamp(wanted - elevation(aim) + pitchTrim,
    -OPPORTUNITY.pitchBudget, OPPORTUNITY.pitchBudget);
  return { handY, pitch, observation: {
    kind: 'present weapon tracking; command crossing is not native prediction',
    bladeInterval: [lo, hi], commandAlong: along, nominalHeight, targetHeight: target.y,
    actualOrigin: actualOrigin.toArray(), actualAxis: actualAxis.toArray(),
    actualWithinAxialInterval, actualAlong, actualHeight, actualSideError,
    trackingHeight, trackingPitch, heightTrim, pitchTrim,
  } };
}
