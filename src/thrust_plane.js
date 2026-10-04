import * as THREE from 'three';

// Thrust-only roll reference. Swing, muscle limits and inertia remain with driveSword.
const states = new WeakMap();
export function applyTransportedThrustPlane(fighter, blade, flat, target) {
  const tap = fighter.skill.tap, weight = fighter.skill.thrustPose.w;
  if (!tap || tap.down || tap.bound || weight <= 0) {
    states.delete(fighter);
    return false;
  }
  const localBlade = blade.clone().applyQuaternion(fighter.yaw.clone().invert());
  let state = states.get(fighter);
  if (!state || state.tap !== tap) {
    state = { tap, blade: localBlade.clone(), plane: target.clone().applyQuaternion(fighter.yaw.clone().invert()) };
    states.set(fighter, state);
  } else {
    state.plane.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(state.blade, localBlade));
    state.blade.copy(localBlade);
  }
  state.plane.addScaledVector(localBlade, -state.plane.dot(localBlade)).normalize();
  const transported = state.plane.clone().applyQuaternion(fighter.yaw);
  if (transported.dot(flat) < 0) transported.negate();
  // The existing recovery/abort weight fades back to the ordinary cutting target.
  target.lerp(transported, weight).normalize();
  return true;
}

export function configureThrustPlaneTrial(params) {
  return params.get('weapon') === 'qinggang' && params.get('onehandArm') === 'manual' &&
    params.get('bladeShape') === 'profile' && params.get('thrustPlane') === 'transported';
}
