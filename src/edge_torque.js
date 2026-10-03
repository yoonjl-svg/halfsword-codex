/** Research-only alignment of an unoriented blade plane.
 * The caller supplies k*cross(flat,target) projected on the blade axis.
 * Multiplying by their dot product gives k*sin(theta)*cos(theta), invariant
 * under target -> -target. Near alignment stiffness remains k; peak torque
 * and the fixed-target potential barrier are half of the legacy law.
 * Damping and equal/opposite reactions are applied by the caller afterwards.
 * This is not a passivity guarantee for a moving target or the whole body.
 */
export function applyPlaneAlignmentPotential(torque, flat, target) {
  return torque.multiplyScalar(flat.dot(target));
}
