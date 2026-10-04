// REJECTED STATIC DIAGNOSTIC. Rest/motion orthogonality moves the sign jump.
// Never exposed by Fighter/main. Preserved to reproduce the frozen-frame failure.
export function applyCoherentMovingPlane(flatTarget, flat, blade, edgeDir, moving) {
  const mf = edgeDir.crossVectors(blade, edgeDir).normalize();
  if (mf.dot(flatTarget) < 0) mf.negate();
  flatTarget.lerp(mf, moving);
  if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(mf);
  flatTarget.normalize();
  if (flatTarget.dot(flat) < 0) flatTarget.negate();
}
