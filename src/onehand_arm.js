import * as THREE from 'three';

const bladeAcross = new THREE.Vector3();
const tangent = new THREE.Vector3();
const transport = new THREE.Quaternion();

/**
 * Swivel the elbow around the shoulder→hand axis only when the requested blade
 * points back along the planned forearm. Keep the hand endpoint and elbow flex.
 * The 90° boundary is a geometric guard, not a measured human wrist limit.
 * Inputs are unit vectors in the same chest-local coordinates; pole is mutated.
 */
export function alignOnehandPole(pole, reachAxis, blade, state, dt) {
  if (!state.pole) { state.pole = pole.clone(); state.reachAxis = reachAxis.clone(); }
  transport.setFromUnitVectors(state.reachAxis, reachAxis);
  state.pole.applyQuaternion(transport).addScaledVector(reachAxis, -state.pole.dot(reachAxis)).normalize();
  // Among the elbow-circle solutions for this hand, this plane maximizes
  // forearm/blade alignment. It does not force the achieved wrist into place.
  bladeAcross.copy(blade).addScaledVector(reachAxis, -blade.dot(reachAxis));
  if (bladeAcross.lengthSq() > 1e-12) {
    bladeAcross.normalize().negate();
    const angle = Math.acos(THREE.MathUtils.clamp(state.pole.dot(bladeAcross), -1, 1));
    // Match the existing arm motor goal-speed ceiling (15 rad/s). This bounds
    // target-plane transitions, not actual motion, torque or anatomical range.
    const step = Math.min(angle, 15 * Math.max(0, dt));
    if (angle > 1e-8) {
      tangent.copy(bladeAcross).addScaledVector(state.pole, -bladeAcross.dot(state.pole));
      if (tangent.lengthSq() < 1e-12) tangent.crossVectors(reachAxis, state.pole);
      tangent.normalize();
      state.pole.multiplyScalar(Math.cos(step)).addScaledVector(tangent, Math.sin(step)).normalize();
    }
  }
  pole.copy(state.pole);
  state.reachAxis.copy(reachAxis);
}
