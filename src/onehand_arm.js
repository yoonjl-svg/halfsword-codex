import * as THREE from 'three';

const bladeAcross = new THREE.Vector3();
const tangent = new THREE.Vector3();

/**
 * Swivel the elbow around the shoulder→hand axis only when the requested blade
 * points back along the planned forearm. Keep the hand endpoint and elbow flex.
 * The 90° boundary is a geometric guard, not a measured human wrist limit.
 * Inputs are unit vectors in the same chest-local coordinates; pole is mutated.
 */
export function alignOnehandPole(pole, reachAxis, blade, reach, upper, fore) {
  const cosBeta = THREE.MathUtils.clamp((fore * fore + reach * reach - upper * upper) / (2 * fore * reach), -1, 1);
  const sinBeta = Math.sqrt(Math.max(0, 1 - cosBeta * cosBeta));
  const axial = blade.dot(reachAxis);
  const before = cosBeta * axial - sinBeta * pole.dot(blade);
  if (before >= 0 || sinBeta < 1e-8) return false;
  bladeAcross.copy(blade).addScaledVector(reachAxis, -axial);
  const across = bladeAcross.length();
  if (across < 1e-8) return false;
  bladeAcross.divideScalar(across);
  const boundary = cosBeta * axial / (sinBeta * across);
  // No compatible swivel exists: do not invent a new hand or wrist goal.
  if (boundary < -1) return false;
  const k = THREE.MathUtils.clamp(boundary, -1, 1);
  tangent.copy(pole).addScaledVector(bladeAcross, -pole.dot(bladeAcross));
  if (tangent.lengthSq() < 1e-12) tangent.crossVectors(reachAxis, bladeAcross);
  tangent.normalize();
  pole.copy(bladeAcross).multiplyScalar(k).addScaledVector(tangent, Math.sqrt(Math.max(0, 1 - k * k)));
  return true;
}
