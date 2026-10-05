// Optional goal sequencing only. This never changes a body's pose/velocity,
// actuator gain, available torque, hand mapping or legacy blend weight.
export const MOTION_TIMING = Object.freeze({ eventGapS: 0.05, referenceTimeS: 0.04, idleAfterS: 0.2, chestBudgetRad: 2 * Math.PI / 180 });

export function applyMotionTiming(info, fighter) {
  if (!info.active || !['force', 'sword'].includes(info.comparison) || fighter.index !== 0 ||
      fighter.weapon.id !== 'qinggang' || fighter.onehandArmModel !== 'manual' ||
      fighter.motionAssistModel !== 'coordinated' || fighter.weaponCfg.twoHand ||
      !['baseline', 'sequenced'].includes(info.motionTiming)) return false;
  fighter.motionTimingModel = info.motionTiming === 'sequenced' ? 'sequenced' : 'none';
  fighter.motionTimingState = {
    phase: 'idle', lastBatchId: -1, consumedBatchId: -1, batchCount: 0, consumeCount: 0,
    lastInputTimeS: null, lastMotionTimeS: null, elapsedSinceSampleS: 0, stopAgeS: 0,
    pendingMotion: false, held: false, released: false, reversing: false,
    directionX: 0, directionY: 0, hasIntent: false,
    pelvisReference: fighter.bodyPose.pelvisYaw, chestReference: fighter.bodyPose.chestYaw, extraChestYaw: 0,
    targetRefs: null,
  };
  return true;
}

// Call once per consumed render input, before any number (including zero) of
// physics steps. Empty samples retain a pending movement until a step sees it.
export function recordMotionTimingInput(fighter, { id, timeS, dx, dy, held, active }) {
  const s = fighter.motionTimingState;
  if (!s || ![id, timeS, dx, dy].every(Number.isFinite) || id <= s.lastBatchId ||
      (s.lastInputTimeS !== null && timeS < s.lastInputTimeS)) return false;
  s.lastBatchId = id;
  fighter.motionTimingInput = { id, timeS, dx, dy, held: !!held, active: !!active };
  s.batchCount++;
  s.elapsedSinceSampleS = 0;
  s.lastInputTimeS = timeS;
  const length = Math.hypot(dx, dy);
  if (active && length > 1e-5) {
    const x = dx / length, y = dy / length;
    if (s.hasIntent && x * s.directionX + y * s.directionY < -0.2) s.reversing = true;
    s.directionX = x;
    s.directionY = y;
    s.hasIntent = true;
    s.pendingMotion = true;
    s.lastMotionTimeS = timeS;
    s.released = false;
  }
  if (s.held && !held) s.released = true;
  s.held = !!held;
  return true;
}

export function updateMotionTiming(fighter, dt, pelvisGoal, chestGoal, weight) {
  const s = fighter.motionTimingState;
  if (!s || !Number.isFinite(dt) || dt <= 0) return null;
  if (s.consumedBatchId !== s.lastBatchId) {
    s.consumedBatchId = s.lastBatchId;
    s.consumeCount++;
  }
  s.pendingMotion = false;
  s.elapsedSinceSampleS += dt;
  const age = s.lastMotionTimeS === null ? Infinity :
    Math.max(0, s.lastInputTimeS - s.lastMotionTimeS) + s.elapsedSinceSampleS;
  // A short event gap accommodates touch sampling, not a queued attack. Its
  // reference can only follow the already requested, bounded pelvis goal.
  const fresh = !s.released && age <= MOTION_TIMING.eventGapS;
  const eligible = weight > 0 && fighter.alive && fighter.armed && fighter.state === 'stand' &&
    !fighter.skill.tap && fighter.skill.thrustPose.w === 0 && !(fighter.finish?.amt > 0) &&
    fighter.armHealth >= 0.99 && fighter.limbs.armS >= 0.99 &&
    fighter.limbs.legF >= 0.99 && fighter.limbs.legB >= 0.99;
  if (s.reversing && fighter.skill.aimVel.x * s.directionX + fighter.skill.aimVel.y * s.directionY > 0) s.reversing = false;
  if (fresh && eligible) {
    s.phase = s.reversing ? 'reverse' : 'drive';
    s.stopAgeS = 0;
  } else {
    s.stopAgeS += dt;
    s.phase = s.hasIntent && s.stopAgeS < MOTION_TIMING.idleAfterS ? 'brake' : 'idle';
    s.reversing = false;
  }
  s.pelvisReference = pelvisGoal;
  if (fighter.motionTimingModel !== 'sequenced') {
    s.chestReference = chestGoal; // observational baseline; native goals unchanged
    s.targetRefs = { pelvis: pelvisGoal, chest: chestGoal, requestedChest: chestGoal, stageChest: chestGoal };
    return null;
  }
  // The existing body share already follows the unfiltered hand request.
  // Delaying it behind the pelvis worsened diagonal tracking (rejected screen).
  // Instead borrow a small part of the current raw-to-filtered hand gap for
  // an earlier chest goal. No guessed future input or new hand/sword target.
  const rawX = fighter.skill.aimRaw?.x ?? fighter.skill.aim?.x ?? 0;
  const aimX = fighter.skill.aim?.x ?? rawX;
  const wanted = s.phase === 'drive' ? -(rawX - aimX) * 0.35 * weight : 0;
  const bounded = Math.max(-MOTION_TIMING.chestBudgetRad, Math.min(MOTION_TIMING.chestBudgetRad, wanted));
  s.extraChestYaw += (bounded - s.extraChestYaw) * -Math.expm1(-dt / MOTION_TIMING.referenceTimeS);
  // Explicit special commands and unavailable limbs own the ordinary goals.
  // They do not inherit a stored motion-assistance goal.
  if (!eligible) s.extraChestYaw = 0;
  s.chestReference = chestGoal;
  s.targetRefs = { pelvis: pelvisGoal, chest: chestGoal, requestedChest: chestGoal,
    stageChest: chestGoal, extraChestYaw: s.extraChestYaw, requestedExtraChestYaw: bounded };
  return s.targetRefs;
}
