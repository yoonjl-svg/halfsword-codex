// Geometry for choosing where to prepare a thrust. These are command margins,
// not a damage multiplier or a measurement of historical optimal range.
import * as THREE from 'three';
import { ARM, THRUST } from './config.js';

export const distanceEnabled = f => f?.opportunityModel === 'v4';
// Optional continuous preparation: command speed, not a physics time scale or
// extra muscle/impact force. Actual movement still depends on body support.
export const rangeTempo = f => distanceEnabled(f) && f.thrustRangeTempo === 1.2 ? 1.2 : 1;
export const THRUST_DISTANCE = Object.freeze({ captureTravel: 1, timeout: 2,
  maxTravel: 1, alignmentCos: Math.cos(20 * Math.PI / 180), manualDead: 0.15 });
const clamp = THREE.MathUtils.clamp;
const v = p => new THREE.Vector3(p.x, p.y, p.z);

export function measureThrustDistance(f, target) {
  const invalid = { valid: false, ready: false, aligned: false, move: 0 };
  if (!target || !f?.sword || !f.weaponCfg || ![target.x,target.y,target.z].every(Number.isFinite)) return invalid;
  const grip = v(f.sword.translation()), ray = v(target).sub(grip), distance = ray.length();
  if (!(distance > 0.01)) return invalid;
  ray.divideScalar(distance);
  const q = f.bodies.chest.rotation(), c = f.bodies.chest.translation();
  const shoulder = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (f.side ?? 1))
    .applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w)).add(v(c));
  const offset = grip.clone().sub(shoulder), dot = offset.dot(ray);
  const radius = ARM.upper + ARM.fore - ARM.slack;
  const discriminant = dot * dot + radius * radius - offset.lengthSq();
  const armTravel = discriminant < 0 ? 0 : Math.max(0, -dot + Math.sqrt(discriminant));
  const reach = Math.min(THRUST.reach + (f.weaponCfg.thrustStyle?.reach ?? 0), armTravel);
  const length = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  // Leave the point near, but ahead of, the target before the arm extends.
  // The existing chamber supplies additional travel at an already long arm.
  const min = length - Math.min(0.06, THRUST.chamber * 0.5);
  const max = length + Math.max(0.035, reach * 0.65);
  const preferred = (min + max) * 0.5;
  const error = distance - preferred;
  const ready = distance >= min && distance <= max;
  const sq = f.sword.rotation();
  const axis = new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(sq.x,sq.y,sq.z,sq.w));
  const alignment = axis.dot(ray);
  const lineMiss = distance * Math.sqrt(Math.max(0, 1 - alignment * alignment));
  // Movement is the normal forward/back stick, never a body translation.
  // Project the desired range correction onto the existing facing direction.
  const forward = f.forward(new THREE.Vector3()), projection = ray.dot(forward);
  const valid = Number.isFinite(length + reach) && length > 0 && projection > 0.25;
  const move = !valid || ready ? 0 : Math.sign(error) * clamp(Math.abs(error) * 2 / Math.max(0.5, projection), 0.18, 0.65) * rangeTempo(f);
  return { valid, distance, min, max, preferred, error, ready: valid && ready, move,
    alignment, lineMiss, aligned: alignment >= THRUST_DISTANCE.alignmentCos && lineMiss <= 0.07, armTravel, reach };
}
