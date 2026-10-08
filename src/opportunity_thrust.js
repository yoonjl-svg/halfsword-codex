// Optional v2 thrust commands. No clocks, forces, native transforms, damage or
// opponent queries are changed here; the captured opportunity owns its target.
import * as THREE from 'three';
import { THRUST } from './config.js';
import { precisionEnabled } from './opportunity_target.js';

const clamp = THREE.MathUtils.clamp;
const smooth = x => x * x * (3 - 2 * x);
const finite = a => a.every(Number.isFinite);

export function captureOpportunityThrust(f, tap) {
  if (!precisionEnabled(f) || !tap.opportunity || tap.down || tap.bound) return null;
  if (![tap.K.aim, tap.K.extend, tap.K.reach].every(v => Number.isFinite(v) && v > 0) ||
      tap.K.reach < THRUST.chamber) return null;
  const q = f.sword.rotation();
  const axis = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w))
    .applyQuaternion(f.yaw.clone().invert()).normalize();
  if (!finite(axis.toArray()) || axis.lengthSq() < 0.5) return null;
  return { startAxis: axis.toArray(), dir: null, chamberEnd: null,
    extensionLength: 0, phase: 'aim', rayOrigin: null, rayTarget: null };
}

/** The positive intersection of a ray starting ch behind h0 with the existing
 * reach sphere around h0. Extension stays along dir, without gaining reach.
 * This length is <= ch+reach; aim+extension travel is <= 2*ch+reach, as before. */
export function opportunityExtensionLength(ch, reach, alignment) {
  const dot = clamp(alignment, -1, 1);
  return Math.max(0, Math.min(ch + reach,
    ch * dot + Math.sqrt(Math.max(0, reach * reach - ch * ch * (1 - dot * dot)))));
}

/** Mutates only the command pose and this tap's owned observation/state.
 * Axis and extension lock in the same yaw-local frame as the original thrust.
 * After aim ends, a turn of the body can still carry that local command around;
 * this is not a world-space homing constraint or a guarantee of contact. */
export function updateOpportunityThrust(f, tap, pose, targetLocal, ch) {
  const state = tap.opportunityPrecision;
  if (!state || tap.down || tap.bound) return false;
  const { K, t, h0 } = tap;
  const axis = new THREE.Vector3(...state.startAxis);
  const a = smooth(clamp(t / K.aim, 0, 1));
  if (!state.dir) {
    const c = f.bodies.chest.translation(), p = f.sword.translation();
    const grip = new THREE.Vector3(p.x - c.x, p.y - c.y, p.z - c.z)
      .applyQuaternion(f.yaw.clone().invert());
    const ray = targetLocal.clone().sub(grip);
    // A coincident target has no direction. Retain a finite existing command;
    // do not invent a new target or change the attack's time budget.
    if (ray.lengthSq() > 1e-12 && finite(ray.toArray())) ray.normalize();
    else ray.copy(axis);
    pose.dir.splice(0, 3, ray.x, ray.y, ray.z);
    state.rayOrigin = grip.toArray();
    state.rayTarget = targetLocal.toArray();
    if (t >= K.aim) {
      state.dir = ray.toArray();
      tap.dir = state.dir.slice();
      state.chamberEnd = h0.map((v, i) => v - ch * state.startAxis[i]);
      state.extensionLength = opportunityExtensionLength(ch, K.reach, axis.dot(ray));
    }
  }
  if (state.dir) {
    const s = smooth(clamp((t - K.aim) / K.extend, 0, 1));
    for (let i = 0; i < 3; i++) {
      pose.dir[i] = state.dir[i];
      pose.hand[i] = state.chamberEnd[i] + state.dir[i] * state.extensionLength * s;
    }
    state.phase = t < K.aim + K.extend ? 'extend' : t < K.aim + K.extend + K.hold ? 'hold' : 'recover';
  } else {
    for (let i = 0; i < 3; i++) pose.hand[i] = h0[i] - ch * a * state.startAxis[i];
    state.phase = 'aim';
  }
  return true;
}
