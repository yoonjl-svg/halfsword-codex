// Movement support is separate from learned attacks/automatic steps. It changes
// motor goals only; physical strength, injury, contacts and inertia still decide
// how far the body and weapon actually move.
export const MOTION_ASSIST = Object.freeze({
  strength: 0.15,
  depthScale: 0.12, // smooth reference range; weak changes depth by <1.8 cm
  chestBudgetDeg: 2, // added reference share, not actual body-angle clamp
  depthBudgetM: 0.02,
  recutErrorBudgetM: 0.02, // acceptance watch budget, never a physical clamp
});

export function applyMotionAssist(info, fighter) {
  if (!info.active || fighter.index !== 0 || fighter.weapon.id !== 'qinggang' ||
      fighter.onehandArmModel !== 'manual' || !fighter.guardPose.oneHand || fighter.weaponCfg.twoHand) return false;
  fighter.motionAssistModel = info.motionAssist === 'weak' ? 'coordinated' : 'none';
  fighter.motionAssistStrength = fighter.motionAssistModel === 'coordinated' ? MOTION_ASSIST.strength : 0;
  return true;
}

export function motionAssistWeight(fighter) {
  if (fighter.motionAssistModel !== 'coordinated' || fighter.index !== 0 ||
      fighter.onehandArmModel !== 'manual' || !fighter.alive || !fighter.armed ||
      (fighter.state !== 'stand' && fighter.state !== 'kneel')) return 0;
  const strength = Math.max(0, Math.min(1, Number.isFinite(fighter.motionAssistStrength) ? fighter.motionAssistStrength : 0));
  // Fade before the fallen-opponent command takes over; do not mix its much
  // larger body bend into a supposedly small ordinary-movement reference.
  const finish = Math.max(0, Math.min(1, fighter.finish?.amt ?? 0));
  return strength * (1 - finish) ** 2;
}

// Phone drag owns lateral motion and height. The unsupplied fore/aft component
// borrows a little from the weapon's existing pose reference. A tanh bound keeps
// even a distant reference from replacing the player's gesture.
export function assistHandDepth(fighter, hand, reference) {
  const weight = motionAssistWeight(fighter);
  if (!weight) return 0;
  const delta = weight * MOTION_ASSIST.depthScale * Math.tanh((reference[0] - hand.x) / MOTION_ASSIST.depthScale);
  hand.x += delta;
  return delta;
}
