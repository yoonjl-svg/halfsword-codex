import { Quaternion, Vector3, MathUtils } from 'three';

const current = new Quaternion(), goal = new Quaternion(), delta = new Quaternion();
const position = new Vector3(), desired = new Vector3(), velocity = new Vector3();
const axes = ['x', 'y', 'z'];

// Rapier spherical motors measure each position as 2 asin(q.imag[axis]),
// with q.w >= 0. These are NOT the components of an axis-angle vector.
export function sphericalMotorPosition(q, out) {
  const sign = q.w < 0 ? -1 : 1;
  return out.set(2 * Math.asin(MathUtils.clamp(sign * q.x, -1, 1)),
    2 * Math.asin(MathUtils.clamp(sign * q.y, -1, 1)),
    2 * Math.asin(MathUtils.clamp(sign * q.z, -1, 1)));
}

// This shoulder's native joint frames are identity. Targets and velocities are
// in the parent's local frame; unlike position coordinates, velocity is angular
// velocity along that frame's axes. Retain the existing stiffness/error budget.
export function driveOffShoulderMotor(j, k, d, maxErr, invDt) {
  current.copy(j.parent.rotation()).invert().multiply(delta.copy(j.child.rotation())).normalize();
  goal.copy(j.target).normalize();
  sphericalMotorPosition(current, position);
  sphericalMotorPosition(goal, desired);
  velocity.set(0, 0, 0);
  if (j.previousShoulderGoal) {
    delta.copy(j.previousShoulderGoal).invert().premultiply(goal).normalize();
    const sign = delta.w < 0 ? -1 : 1;
    const len = Math.hypot(delta.x, delta.y, delta.z);
    if (len > 1e-10) {
      const scale = sign * 2 * Math.atan2(len, Math.abs(delta.w)) * invDt / len;
      velocity.set(delta.x, delta.y, delta.z).multiplyScalar(scale);
    }
  } else j.previousShoulderGoal = new Quaternion();
  j.previousShoulderGoal.copy(goal);
  for (let i = 0; i < 3; i++) {
    const axis = axes[i];
    const difference = desired[axis] - position[axis];
    const error = Math.atan2(Math.sin(difference), Math.cos(difference));
    const target = position[axis] + MathUtils.clamp(error, -maxErr, maxErr);
    j.joint.rawSet.jointConfigureMotor(j.joint.handle, 3 + i, target,
      MathUtils.clamp(velocity[axis], -15, 15), k, d);
  }
}
