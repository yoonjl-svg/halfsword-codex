// REJECTED research candidate: ordinary-r2 longsword recut rotated farther,
// aligned worse and swung slower. See docs/strike/p4_recut_v2_20261005.md.
// Never import into src or enable in public comparisons without a new design.
import * as THREE from 'three';

/** Continue an oriented representative of the two unsigned alignment planes.
 * The existing ordinary goal seeds the first call. Subsequent rest/motion
 * representatives follow the previous goal transported by actual blade turn.
 * No final actual-flat nearest-sign selection: that was the rejected seam.
 * This changes the chosen route, including possible turns greater than90deg;
 * it changes no torque law, gain, physical state, or motion weight.
 */
export function continueCutPlane(fighter, target, rest, edgeVelocity, blade, moving) {
  let state = fighter.p4ContinuedPlane;
  if (!state) {
    fighter.p4ContinuedPlane = {blade: blade.clone(), target: target.clone()};
    return target;
  }
  const reference = state.target.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(state.blade, blade));
  reference.addScaledVector(blade, -reference.dot(blade)).normalize();
  target.copy(rest);
  if (target.dot(reference) < 0) target.negate();
  if (moving > 0) {
    const motion = new THREE.Vector3().crossVectors(blade, edgeVelocity).normalize();
    if (motion.dot(reference) < 0) motion.negate();
    target.lerp(motion, moving);
    // An exact cancellation has no unique directed mean. Retain the previous
    // orientation there rather than manufacture an instantaneous half turn.
    if (target.lengthSq() < 1e-8) target.copy(reference);
    target.normalize();
  }
  state.blade.copy(blade);
  state.target.copy(target);
  return target;
}
