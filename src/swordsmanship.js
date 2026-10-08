// One swordsmanship policy for the current physical game. It authors
// goals, never body transforms, velocities, masses, gains or force budgets.
import * as THREE from 'three';
import { SKILL } from './config.js';
import { guardAt } from './guards.js';
import { swordsmanshipProfile } from './swordsmanship_profiles.js';
import { updateOpportunityPlayer } from './opportunity_player.js';
import { enabled as opportunityEnabled } from './opportunity_target.js';

// First candidate design budgets, not measured human optima. Slow deliberate
// positioning receives more help; a fast cut retains more of its raw path.
export const SWORDSMANSHIP = Object.freeze({
  version: 'unified-20261005-r2',
  returnDelayS: 0.25, returnSpeedMps: 0.75, returnAccelerationMps2: 3,
  slowInputMps: 0.35, fastInputMps: 2,
  stanceDepth: 0.65, stancePlane: 0.40, strokeDepth: 0.40, strokePlane: 0.18,
  stanceAim: 0.65, strokeAim: 0.25,
  correctionSpeedMps: 0.75, correctionTurnRadps: 3.2,
  handBudgetM: 0.32, aimBudgetRad: Math.PI / 3,
  retainedPlaneMotion: 0.65, retainedAttackPlaneMotion: 1, bodyAmount: 0.55,
  inputFreshS: 0.05, homeRangeM: 0.15,
});
const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;
const identity = new THREE.Quaternion();
const temp = new THREE.Vector3(), desired = new THREE.Vector3();
const rawDelta = new THREE.Vector3(), change = new THREE.Vector3();
const desiredRotation = new THREE.Quaternion(), captureRotation = new THREE.Quaternion();

export function hasSwordsmanship(f) {
  return f.swordsmanshipModel === 'unified' && !!f.swordsmanshipState &&
    f.swordsmanshipState.profile.weaponId === f.weapon?.id;
}

/** Call after normal round setup and before the first step. No native mutation. */
export function applySwordsmanship(f) {
  if (f.index !== 0) return false;
  const profile = swordsmanshipProfile(f.weapon);
  if (!profile.enabled) return false;
  f.swordsmanshipModel = 'unified';
  // The old all-in-one level must not write follow/return/stance goals a second
  // time. Explicit tap/finish/enter-parry mechanics retain their own contracts.
  f.skill.level = 0;
  f.skill.autoGuard = false;
  f.motionAssistModel = 'none';
  f.motionTimingModel = 'none';
  f.swordAssistModel = 'none';
  const initial = guardAt(f.skill.aim.x, f.skill.aim.y, { table: profile.table });
  const initialHand = f.handBase?.slice() ?? initial.hand.slice();
  const initialAim = f.onehandReady && f.aimDirW
    ? f.aimDirW.clone().applyQuaternion(f.yaw.clone().invert())
    : new THREE.Vector3(...initial.dir);
  f.handBase = initialHand.slice();
  f.swordsmanshipState = {
    profile, profileId: profile.id, version: SWORDSMANSHIP.version,
    phase: 'holding', owner: 'player', goalTick: 0, seeded: false,
    idleS: 0, generatedDX: 0, generatedDY: 0, returnVX: 0, returnVY: 0,
    lastBatchId: -1, pendingMotion: false, input: null, inputAgeS: 0,
    lastMotionTimeS: null, released: false, reversing: false, directionX: 0, directionY: 0, hasIntent: false,
    moving: false, returning: false, postureMix: 1,
    initialHand: new THREE.Vector3(...initialHand), initialAim,
    handCorrection: new THREE.Vector3(), aimCorrection: new THREE.Quaternion(),
    previousRawHand: new THREE.Vector3(), rawHand: new THREE.Vector3(), rawAim: new THREE.Vector3(),
    baseHand: new THREE.Vector3(...initialHand), baseAim: initialAim.clone(),
    hand: new THREE.Vector3(...initialHand), aim: initialAim.clone(),
    body: { pelvisYaw: 0, chestYaw: 0, directChestYaw: 0, pitch: 0, drop: 0 },
    postureBody: { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 },
    leadYaw: 0, handChangeM: 0, aimChangeRad: 0, retainedProjection: null,
    eligible: true, availability: 1,
  };
  // Seed from the actual spawn mapping now, before a render can accumulate
  // its first gesture. This computes commands only, without a physics step.
  f.prepareSwordsmanship?.(0);
  return true;
}

/** Same event shape as phone input; retain movement across zero-step renders. */
export function recordSwordsmanshipInput(f, input) {
  if (!hasSwordsmanship(f)) return false;
  const s = f.swordsmanshipState;
  if (![input.id, input.timeS, input.dx, input.dy].every(Number.isFinite) ||
      input.id <= s.lastBatchId || (s.input && input.timeS < s.input.timeS)) return false;
  s.lastBatchId = input.id;
  if (s.input?.held && !input.held) s.released = true;
  s.input = { ...input, held: !!input.held, active: !!input.active };
  s.inputAgeS = 0;
  const distance = Math.hypot(input.dx, input.dy);
  if (input.active && distance > 1e-5) {
    const x = input.dx / distance, y = input.dy / distance;
    if (s.hasIntent && x*s.directionX + y*s.directionY < -0.2) s.reversing = true;
    s.directionX = x; s.directionY = y; s.hasIntent = true;
    s.lastMotionTimeS = input.timeS; s.released = false;
    s.pendingMotion = true;
  }
  return true;
}

function ordinaryEligible(f) {
  return f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel') &&
    !f.skill.tap && !(f.skill.thrustPose.w > 0) && !(f.finish?.amt > 0) &&
    !f.barge && !(f.lift > 0) && !(f.closeW > 0);
}

/** After real input velocity is measured, before the original input filter. */
export function advanceSwordsmanship(skill, dt) {
  const f = skill.f;
  if (!hasSwordsmanship(f) || !(dt > 0) || !Number.isFinite(dt)) return;
  const s = f.swordsmanshipState, C = SWORDSMANSHIP;
  s.generatedDX = s.generatedDY = 0;
  s.moving = s.pendingMotion || (s.input
    ? s.input.active && s.inputAgeS <= C.inputFreshS : !!f.inputActive);
  s.pendingMotion = false;
  s.inputAgeS += dt;
  s.eligible = ordinaryEligible(f);
  // Muscles still apply their existing injury limits. Availability only slows
  // optional preparation; it cannot restore lost strength or force a stand.
  s.availability = smooth(f.armHealth, 0.25, 0.8) * (1 - smooth(f.pain, 0.15, 0.5));
  const held = !!f.handHeld;
  const canReturn = s.eligible && s.availability > 0 &&
    (f.state === 'kneel' || Math.min(f.limbs.legF, f.limbs.legB) >= 0.35);
  s.idleS = held || s.moving || !canReturn ? 0 : s.idleS + dt;
  s.returning = canReturn && !held && !s.moving && s.idleS >= C.returnDelayS &&
    skill.vel.length() < SKILL.swingSpeed;
  if (s.moving) s.postureMix = 1 - smooth(skill.vel.length(), C.slowInputMps, C.fastInputMps);
  if (!s.returning) {
    s.returnVX = s.returnVY = 0;
    s.phase = !s.eligible ? 'suspended' : s.moving ? 'moving' : held ? 'holding' : 'waiting';
    return;
  }
  const [hx, hy] = s.profile.homePad;
  const dx = hx - f.handOffset.x, dy = hy - f.handOffset.y;
  const distance = Math.hypot(dx, dy), scale = s.profile.returnScale * s.availability;
  const speed = Math.min(C.returnSpeedMps * scale,
    Math.sqrt(2 * C.returnAccelerationMps2 * scale * distance),
    Math.hypot(s.returnVX, s.returnVY) + C.returnAccelerationMps2 * scale * dt);
  const step = Math.min(distance, speed * dt);
  s.generatedDX = distance > 1e-9 ? dx / distance * step : 0;
  s.generatedDY = distance > 1e-9 ? dy / distance * step : 0;
  f.handOffset.x += s.generatedDX; f.handOffset.y += s.generatedDY;
  skill.prev.x += s.generatedDX; skill.prev.y += s.generatedDY;
  skill.anchor.x += s.generatedDX; skill.anchor.y += s.generatedDY;
  // A real gesture leaves a small dead-band offset between finger and anchor.
  // Carrying that offset forever would strand the filtered goal beside home.
  // During automatic return only, converge it at the same bounded goal speed;
  // prev still follows finger displacement so this cannot create swing input.
  const ax = f.handOffset.x - skill.anchor.x, ay = f.handOffset.y - skill.anchor.y;
  const anchorDistance = Math.hypot(ax, ay);
  const anchorStep = Math.min(anchorDistance, C.returnSpeedMps * scale * dt);
  if (anchorDistance > 1e-9) {
    skill.anchor.x += ax / anchorDistance * anchorStep;
    skill.anchor.y += ay / anchorDistance * anchorStep;
  }
  s.returnVX = step < distance ? s.generatedDX / dt : 0;
  s.returnVY = step < distance ? s.generatedDY / dt : 0;
  s.phase = 'returning';
}

function captureWeight(tp) {
  if (!tp?.swordsmanshipBaseDir) return 0;
  if (tp.abort) return tp.abort.t < tp.K.aim
    ? clamp(1 - (tp.t - tp.abort.t) / tp.K.recover, 0, 1) : 0;
  return tp.t < tp.K.aim ? 1 : 0;
}

function turnToward(out, target, amount) {
  captureRotation.setFromUnitVectors(out, temp.copy(target).normalize());
  out.applyQuaternion(desiredRotation.copy(identity).slerp(captureRotation, amount)).normalize();
}

/** One resolved snapshot per physics step, shared by body and weapon readers. */
export function resolveSwordsmanshipGoals(f, dt, rawHand, rawAim, homeRawHand, homeRawAim) {
  if (!hasSwordsmanship(f)) return null;
  const s = f.swordsmanshipState, C = SWORDSMANSHIP, p = s.profile;
  s.rawHand.copy(rawHand); s.rawAim.copy(rawAim);
  const G = guardAt(f.skill.aim.x, f.skill.aim.y, s.guard ||= { table: p.table });
  const bodyG = guardAt(f.skill.aimRaw.x, f.skill.aimRaw.y, s.bodyGuard ||= { table: p.table });
  if (!s.seeded) {
    s.handCorrection.copy(s.initialHand).sub(rawHand);
    s.aimCorrection.setFromUnitVectors(rawAim, s.initialAim);
    s.previousRawHand.copy(rawHand);
    s.seeded = true;
  }
  s.handChangeM = s.aimChangeRad = 0;
  s.retainedProjection = null;
  // Holding freezes the learned offset, not the physical body or input filter.
  // Losing eligibility stops automatic authorship without deleting the old
  // offset in a single step. Explicit commands blend over that continuous base.
  if (s.eligible && (s.moving || s.returning)) {
    const mix = s.returning ? 1 : s.postureMix;
    const depth = THREE.MathUtils.lerp(C.strokeDepth, C.stanceDepth, mix);
    const plane = THREE.MathUtils.lerp(C.strokePlane, C.stancePlane, mix);
    desired.set((G.hand[0] - rawHand.x) * depth,
      (G.hand[1] - rawHand.y) * plane, (G.hand[2] - rawHand.z) * plane);
    // Preserve the corrected first ready pose during its short departure.
    const ready = f.onehandReady?.weight ?? 0;
    desired.multiplyScalar(1 - ready);
    const homeDistance = Math.hypot(f.skill.aim.x - p.homePad[0], f.skill.aim.y - p.homePad[1]);
    const homeWeight = s.returning ? 1 - smooth(homeDistance, 0, C.homeRangeM) : 0;
    if (homeWeight > 0) desired.lerp(temp.set(...p.homeHand).sub(homeRawHand), homeWeight);
    desired.clampLength(0, C.handBudgetM);
    change.copy(desired).sub(s.handCorrection).clampLength(0, C.correctionSpeedMps * dt);
    rawDelta.copy(rawHand).sub(s.previousRawHand);
    const plane2 = rawDelta.y ** 2 + rawDelta.z ** 2;
    if (s.moving && plane2 > 1e-12) {
      const projection = (change.y * rawDelta.y + change.z * rawDelta.z) / plane2;
      // During a recognized cut, preparation guidance may redirect across the
      // raw path but must not subtract from its forward planar displacement.
      // Keep the existing slow preparation budget. This is a command-space
      // weight, not a promise or clamp on physical blade speed or impact power.
      const retained = f.skill.swinging ? C.retainedAttackPlaneMotion : C.retainedPlaneMotion;
      const min = -(1 - retained);
      if (projection < min) {
        change.y += (min - projection) * rawDelta.y;
        change.z += (min - projection) * rawDelta.z;
      }
      s.retainedProjection = 1 + (change.y * rawDelta.y + change.z * rawDelta.z) / plane2;
    }
    s.handCorrection.add(change);
    s.handChangeM = change.length();
    const aimWeight = THREE.MathUtils.lerp(C.strokeAim, C.stanceAim, mix) * (1 - ready);
    desiredRotation.setFromUnitVectors(rawAim, temp.set(...G.dir).normalize());
    desiredRotation.slerp(identity, 1 - aimWeight);
    const angle = identity.angleTo(desiredRotation);
    if (angle > C.aimBudgetRad) desiredRotation.slerp(identity, 1 - C.aimBudgetRad / angle);
    if (homeWeight > 0) {
      captureRotation.setFromUnitVectors(homeRawAim, temp.set(...p.homeDir).normalize());
      desiredRotation.slerp(captureRotation, homeWeight);
    }
    const before = s.aimCorrection.clone();
    s.aimCorrection.rotateTowards(desiredRotation, C.correctionTurnRadps * dt);
    s.aimChangeRad = before.angleTo(s.aimCorrection);
    const bodyMix = C.bodyAmount * p.bodyScale * (s.returning ? 1 : THREE.MathUtils.lerp(0.45, 1, mix));
    const targets = {
      pelvisYaw: -bodyG.pelvisYaw * 0.5 * bodyMix,
      chestYaw: -bodyG.chestYaw * bodyMix,
      pitch: bodyG.pitch * bodyMix,
      drop: (bodyG.drop - 0.06) * bodyMix,
    };
    for (const key of Object.keys(targets)) {
      const max = (key === 'drop' ? 0.08 : 1.6) * dt;
      s.postureBody[key] += clamp(targets[key] - s.postureBody[key], -max, max);
    }
  }
  s.previousRawHand.copy(rawHand);
  s.baseHand.copy(rawHand).add(s.handCorrection);
  s.baseAim.copy(rawAim).applyQuaternion(s.aimCorrection).normalize();
  if (opportunityEnabled(f)) updateOpportunityPlayer(f, dt, s.baseHand, s.baseAim, C);
  const tp = f.skill.tap, capture = captureWeight(tp);
  if (capture > 0) {
    s.baseHand.lerp(temp.set(...tp.h0), capture);
    turnToward(s.baseAim, temp.set(...tp.swordsmanshipBaseDir), capture);
  }
  s.hand.copy(s.baseHand); s.aim.copy(s.baseAim);
  // Same small raw-ahead-of-filtered chest contribution as the preferred B.
  // There is no queued future motion or artificial lag behind the pelvis.
  const turn = -f.skill.aimRaw.x * 0.35;
  const fresh = s.lastMotionTimeS !== null && !s.released &&
    s.input.timeS - s.lastMotionTimeS + s.inputAgeS <= C.inputFreshS;
  const leadEligible = s.eligible && f.state === 'stand' && f.armHealth >= 0.99 &&
    f.limbs.armS >= 0.99 && f.limbs.legF >= 0.99 && f.limbs.legB >= 0.99;
  if (s.reversing && f.skill.aimVel.x*s.directionX + f.skill.aimVel.y*s.directionY > 0) s.reversing = false;
  if (!fresh || !leadEligible) s.reversing = false;
  const lead = leadEligible && fresh && !s.reversing ? clamp(-(f.skill.aimRaw.x - f.skill.aim.x) * 0.35 * 0.15,
    -2 * Math.PI / 180, 2 * Math.PI / 180) : 0;
  s.leadYaw += (lead - s.leadYaw) * -Math.expm1(-dt / 0.04);
  if (!leadEligible) s.leadYaw = 0;
  const bodyAvailable = f.alive && f.armed && f.state === 'stand'
    ? Math.min(s.availability, smooth(Math.min(f.limbs.legF, f.limbs.legB), 0.25, 0.8)) : 0;
  s.body.pelvisYaw = (turn * 0.5 * 0.15 + s.postureBody.pelvisYaw) * bodyAvailable;
  // Preserve B's response order: only its small raw body share is second-order
  // filtered. The remaining filtered-input share and small lead are read once
  // by applyPose, avoiding a new second filter over the entire gesture.
  s.body.chestYaw = (turn * 0.15 + s.postureBody.chestYaw) * bodyAvailable;
  s.body.directChestYaw = (-f.skill.aim.x * 0.35 * 0.85 + s.leadYaw) * bodyAvailable;
  s.body.pitch = s.postureBody.pitch * bodyAvailable;
  s.body.drop = s.postureBody.drop * bodyAvailable;
  s.owner = s.returning ? 'return' : 'player';
  if (!s.eligible) s.owner = !f.alive || !f.armed ? 'inactive' : 'recovery';
  const finish = clamp(f.finish?.amt ?? 0, 0, 1);
  if (finish > 0) {
    const F = guardAt(f.skill.aim.x, f.skill.aim.y, s.finishGuard ||= { oneHand: !!f.guardPose.oneHand, table: f.guardPose.table }, f.finish);
    s.hand.lerp(temp.set(...F.hand), finish);
    turnToward(s.aim, temp.set(...F.dir), finish);
    s.body.pelvisYaw = THREE.MathUtils.lerp(s.body.pelvisYaw, -F.pelvisYaw * 0.5, finish);
    s.body.chestYaw = THREE.MathUtils.lerp(s.body.chestYaw, -F.chestYaw, finish);
    s.body.pitch = THREE.MathUtils.lerp(s.body.pitch, F.pitch, finish);
    s.body.drop = THREE.MathUtils.lerp(s.body.drop, F.drop - 0.06, finish);
    s.body.directChestYaw *= 1 - finish;
    s.owner = 'finish'; s.phase = 'command';
  }
  const th = f.skill.thrustPose;
  if (tp || th.w > 0) {
    s.hand.lerp(temp.set(...th.hand), th.w);
    turnToward(s.aim, temp.set(...th.dir), th.w);
    s.body.pelvisYaw = THREE.MathUtils.lerp(s.body.pelvisYaw, -th.pelvisYaw * 0.5, th.w);
    s.body.chestYaw = THREE.MathUtils.lerp(s.body.chestYaw, -th.chestYaw, th.w);
    s.body.pitch = THREE.MathUtils.lerp(s.body.pitch, th.pitch, th.w);
    s.body.drop = THREE.MathUtils.lerp(s.body.drop, th.drop - 0.06, th.w);
    s.body.directChestYaw *= 1 - th.w;
    s.owner = 'thrust'; s.phase = 'command';
  }
  if (s.returning && Math.hypot(f.handOffset.x - p.homePad[0], f.handOffset.y - p.homePad[1]) < 1e-6 &&
      s.baseHand.distanceTo(temp.set(...p.homeHand)) < 0.003 &&
      s.baseAim.angleTo(temp.set(...p.homeDir)) < 0.02) s.phase = 'ready';
  if (dt > 0) s.goalTick++;
  return s;
}
