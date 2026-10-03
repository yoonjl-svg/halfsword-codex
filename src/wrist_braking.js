/**
 * One-call forecast of the EXISTING full-damping wrist request, about the hand.
 * This is a fixed-hand stopping approximation, not maximum human muscle force.
 * The caller supplies the original Hill curve. No controller/native state changes.
 */
export function estimateWristStopBudget({positionTorque, swingOmega, targetOmega,
  relativeOmega, axisUnit, gravityTorque, strengthScale, baseCap, damping,
  incomingHill, dt, vmax, eccentric, hill}) {
  const request = positionTorque.clone().addScaledVector(swingOmega.clone().sub(targetOmega), -damping)
    .addScaledVector(gravityTorque, -Math.min(1, strengthScale));
  const length = request.length();
  const along = length > 1e-6 ? relativeOmega.dot(request) / length : 0;
  const instantaneousHill = hill(along, vmax, .25, eccentric);
  const previous = incomingHill ?? instantaneousHill;
  const previewHill = previous + (instantaneousHill - previous) * Math.min(1, (dt || 1 / 120) / .03);
  const previewCap = baseCap * previewHill;
  if (length > previewCap) request.setLength(previewCap);
  // Compensation is already in the capped muscle request. True external gravity
  // is added once, outside that cap, using the same hand pivot.
  const opposingNm = -request.clone().add(gravityTorque).dot(axisUnit);
  const applicable = Number.isFinite(opposingNm) && opposingNm > 0;
  return {applicable, reason: applicable ? 'opposing' : 'nonOpposingFallback',
    opposingNm, previewHill, previewCap, previewTorque: request.toArray()};
}
