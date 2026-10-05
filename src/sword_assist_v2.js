// Learned readiness guides motor goals; strength/contact/inertia remain native.
// The references come from the current weapon table and corrected game ready
// pose. Numeric budgets are trial choices, not measured historical technique.
import * as THREE from 'three';
import { SKILL, WEAPON } from './config.js';
import { guardAt } from './guards.js';
import { assistHandDepth } from './motion_assist.js';
import { MOTION_TIMING } from './motion_timing.js';

export const SWORD_ASSIST_V2 = Object.freeze({
  guideWeight: 0.15, handBudgetM: 0.02, aimBudgetRad: 8 * Math.PI / 180,
  idleDelayS: 0.35, returnSpeedMps: 0.6, returnAccelerationMps2: 2.4,
  homePad: Object.freeze([0.15, 0.10]), homeHand: Object.freeze([0.50, 0.10, 0.05]),
  homeDir: Object.freeze([Math.cos(0.17), 0, Math.sin(0.17)]),
  homeBlendRangeM: 0.12, blendInS: 0.12, blendOutS: 0.06,
});
const reference = new THREE.Vector3(), delta = new THREE.Vector3(), axis = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const neutralHand = new THREE.Vector3(), neutralAim = new THREE.Vector3();
const homeRotation = new THREE.Quaternion(), identity = new THREE.Quaternion();

function capturedCommandWeight(f) {
  const tp = f.skill.tap;
  if (f.swordAssistModel !== 'v2' || !tp?.v2BaseDir) return 0;
  if (tp.abort) return tp.abort.t < tp.K.aim ?
    Math.max(0, Math.min(1, 1 - (tp.t - tp.abort.t) / tp.K.recover)) : 0;
  return tp.t < tp.K.aim ? 1 : 0;
}
function blendCapturedAim(f, aim, weight) {
  if (!weight) return;
  homeRotation.setFromUnitVectors(aim, reference.set(...f.skill.tap.v2BaseDir).normalize());
  aim.applyQuaternion(rotation.copy(identity).slerp(homeRotation, weight)).normalize();
}

export function applySwordAssistV2(info, f) {
  if (!info.active || info.comparison !== 'sword' || !['none', 'v2'].includes(info.swordAssist) ||
      f.index !== 0 || f.weapon.id !== 'qinggang' || f.onehandArmModel !== 'manual' ||
      !f.guardPose.oneHand || f.weaponCfg.twoHand || f.motionTimingModel !== 'sequenced') return false;
  f.swordAssistModel = info.swordAssist;
  f.swordAssistState = { phase: info.swordAssist === 'v2' ? 'waiting' : 'off', idleS: 0,
    returnVX: 0, returnVY: 0, generatedDX: 0, generatedDY: 0,
    homeBlend: 0, requestedHomeBlend: 0, handDeltaM: 0, aimDeltaRad: 0 };
  return true;
}

export function swordAssistEligible(f, commandBase = false) {
  return f.swordAssistModel === 'v2' && f.index === 0 && f.alive && f.armed && f.state === 'stand' &&
    (commandBase || (!f.skill.tap && f.skill.thrustPose.w === 0)) && !(f.finish?.amt > 0) &&
    !f.barge && !(f.lift > 0) && !(f.closeW > 0) && f.armHealth >= 0.75 &&
    f.limbs.legF >= 0.75 && f.limbs.legB >= 0.75 && f.pain < 0.2;
}

// Run after measuring real input velocity and before the existing aim filter.
// Generated return displacement is accounted separately so it cannot become
// a swing/follow/lunge request on the next step. New held input cancels it even
// when that touch has not moved yet. No timer advances while physics is paused.
export function updateSwordAssistReturn(skill, dt) {
  const f = skill.f, s = f.swordAssistState;
  if (!s || !Number.isFinite(dt) || dt <= 0) return;
  s.generatedDX = s.generatedDY = 0;
  s.handDeltaM = s.aimDeltaRad = 0;
  if (f.swordAssistModel !== 'v2') return;
  const timing = f.motionTimingState;
  const age = timing?.lastMotionTimeS == null ? Infinity :
    Math.max(0, timing.lastInputTimeS - timing.lastMotionTimeS) + timing.elapsedSinceSampleS;
  // Keep a real movement consumed by a zero-step render until physics sees it.
  const moving = !!f.inputActive || !!(timing && !timing.released &&
    (timing.pendingMotion || age <= MOTION_TIMING.eventGapS));
  const eligible = swordAssistEligible(f), input = !!(f.handHeld || moving);
  s.idleS = input || !eligible ? 0 : s.idleS + dt;
  // A newly held, unmoving touch means hold this pose, not abandon readiness.
  // Actual movement withdraws the home reference; release waits before return.
  s.requestedHomeBlend = eligible && !moving ? s.homeBlend : 0;
  const returning = eligible && !input && s.idleS >= SWORD_ASSIST_V2.idleDelayS &&
    skill.vel.length() < SKILL.swingSpeed;
  if (!returning) {
    s.returnVX = s.returnVY = 0;
    s.phase = !eligible ? 'suspended' : input ? 'guidance' : 'waiting';
  } else {
    const off = f.handOffset;
    const dx = SWORD_ASSIST_V2.homePad[0] - off.x, dy = SWORD_ASSIST_V2.homePad[1] - off.y;
    const distance = Math.hypot(dx, dy), oldSpeed = Math.hypot(s.returnVX, s.returnVY);
    // A scalar accelerate/brake envelope along the remaining return segment.
    // This is a goal speed, not a clamp on physical sword/hand velocity.
    const speed = Math.min(SWORD_ASSIST_V2.returnSpeedMps,
      Math.sqrt(2 * SWORD_ASSIST_V2.returnAccelerationMps2 * distance),
      oldSpeed + SWORD_ASSIST_V2.returnAccelerationMps2 * dt);
    const step = Math.min(distance, speed * dt);
    s.generatedDX = distance > 1e-9 ? dx / distance * step : 0;
    s.generatedDY = distance > 1e-9 ? dy / distance * step : 0;
    off.x += s.generatedDX; off.y += s.generatedDY;
    skill.prev.x += s.generatedDX; skill.prev.y += s.generatedDY;
    // Carry the input anchor with the return; the separate home pose goal below
    // can settle fully even when the original input had a dead-band residual.
    skill.anchor.x += s.generatedDX; skill.anchor.y += s.generatedDY;
    s.returnVX = step < distance ? s.generatedDX / dt : 0;
    s.returnVY = step < distance ? s.generatedDY / dt : 0;
    s.phase = distance - step <= 1e-6 ? 'ready' : 'returning';
    s.requestedHomeBlend = Math.exp(-(((distance - step) / SWORD_ASSIST_V2.homeBlendRangeM) ** 2));
  }
  // An explicit thrust captures its own starting base below. Preserve its old
  // readiness reference for a continuous return at command completion. Pad
  // return stays off; its base is prepared under the full-weight command.
  if (!eligible && !skill.tap?.v2BaseDir) s.homeBlend = 0;
  else if (!eligible) s.requestedHomeBlend = s.homeBlend;
  else {
    const time = s.requestedHomeBlend > s.homeBlend ? SWORD_ASSIST_V2.blendInS : SWORD_ASSIST_V2.blendOutS;
    s.homeBlend += (s.requestedHomeBlend - s.homeBlend) * -Math.expm1(-dt / time);
  }
}

export function assistSwordHand(f, hand, guard) {
  const s = f.swordAssistState;
  const commandBase = f.swordAssistModel === 'v2' && !!f.skill.tap?.v2BaseDir;
  const captured = capturedCommandWeight(f);
  if (captured === 1) {
    hand.set(...f.skill.tap.h0); // explicit command owns its captured base
    return 0;
  }
  // Once thrust weight is fully 1, its base is hidden. Prepare the current
  // underlying goal there so recovery blends to it instead of a final jump.
  if (!swordAssistEligible(f, commandBase)) {
    if (captured > 0) hand.lerp(reference.set(...f.skill.tap.h0), captured);
    return 0;
  }
  // B already helps depth. Add bounded height/side guidance, leaving the
  // corrected first-ready pose intact until the player starts using the pad.
  const readyFade = 1 - (f.onehandReady?.weight ?? 0);
  delta.set(0, (guard[1] - hand.y) * SWORD_ASSIST_V2.guideWeight * readyFade,
    (guard[2] - hand.z) * SWORD_ASSIST_V2.guideWeight * readyFade).clampLength(0, SWORD_ASSIST_V2.handBudgetM);
  const before = hand.clone();
  hand.add(delta);
  if (s.homeBlend > 0) {
    const [x, y] = SWORD_ASSIST_V2.homePad;
    const home = s.homeGuard ||= guardAt(x, y, { oneHand: true, table: f.guardPose.table });
    neutralHand.set(0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x*x+y*y)/(WEAPON.reach**2))), 0.1+y, 0.1+x);
    f.calibrateOnehandReach?.(neutralHand);
    if (f.onehandReady) neutralHand.addScaledVector(f.onehandReady.delta, f.onehandReady.weight);
    assistHandDepth(f, neutralHand, home.hand);
    delta.set(0, (home.hand[1]-neutralHand.y)*SWORD_ASSIST_V2.guideWeight*readyFade,
      (home.hand[2]-neutralHand.z)*SWORD_ASSIST_V2.guideWeight*readyFade).clampLength(0,SWORD_ASSIST_V2.handBudgetM);
    neutralHand.add(delta);
    // Carry a neutral offset instead of lerping a new gesture back to the
    // center. The player's whole displacement remains in the requested goal.
    hand.addScaledVector(reference.set(...SWORD_ASSIST_V2.homeHand).sub(neutralHand), s.homeBlend);
  }
  s.handDeltaM = before.distanceTo(hand);
  if (captured > 0) hand.lerp(reference.set(...f.skill.tap.h0), captured);
  return s.handDeltaM;
}

export function assistSwordAim(f, aim, guard) {
  const s = f.swordAssistState;
  const commandBase = f.swordAssistModel === 'v2' && !!f.skill.tap?.v2BaseDir;
  const captured = capturedCommandWeight(f);
  if (captured === 1) {
    aim.set(...f.skill.tap.v2BaseDir);
    return 0;
  }
  if (!swordAssistEligible(f, commandBase)) {
    blendCapturedAim(f, aim, captured);
    return 0;
  }
  const before = aim.clone();
  reference.set(...guard).normalize();
  const angle = aim.angleTo(reference);
  const amount = Math.min(angle * SWORD_ASSIST_V2.guideWeight, SWORD_ASSIST_V2.aimBudgetRad) *
    (1 - (f.onehandReady?.weight ?? 0));
  axis.crossVectors(aim, reference);
  if (axis.lengthSq() < 1e-12 && angle > Math.PI / 2) axis.crossVectors(aim, reference.set(0, 1, 0));
  if (axis.lengthSq() > 1e-12) aim.applyQuaternion(rotation.setFromAxisAngle(axis.normalize(), amount)).normalize();
  if (s.homeBlend > 0) {
    const home = s.homeGuard ||= guardAt(...SWORD_ASSIST_V2.homePad, {oneHand:true,table:f.guardPose.table});
    neutralAim.set(...SWORD_ASSIST_V2.homeDir);
    reference.set(...home.dir).normalize();
    const neutralAngle = neutralAim.angleTo(reference), neutralAmount =
      Math.min(neutralAngle*SWORD_ASSIST_V2.guideWeight,SWORD_ASSIST_V2.aimBudgetRad)*(1-(f.onehandReady?.weight??0));
    axis.crossVectors(neutralAim,reference);
    if(axis.lengthSq()>1e-12)neutralAim.applyQuaternion(rotation.setFromAxisAngle(axis.normalize(),neutralAmount));
    homeRotation.setFromUnitVectors(neutralAim,reference.set(...SWORD_ASSIST_V2.homeDir));
    rotation.copy(identity).slerp(homeRotation,s.homeBlend);
    aim.applyQuaternion(rotation).normalize();
  }
  // The neutral carry rotates with a new gesture; its combined angular help
  // still fits the same cone rather than replacing that gesture's direction.
  const totalAngle = before.angleTo(aim);
  if (totalAngle > SWORD_ASSIST_V2.aimBudgetRad) {
    axis.crossVectors(before, aim);
    if (axis.lengthSq() > 1e-12) aim.copy(before).applyQuaternion(
      rotation.setFromAxisAngle(axis.normalize(), SWORD_ASSIST_V2.aimBudgetRad));
  }
  s.aimDeltaRad = before.angleTo(aim);
  blendCapturedAim(f, aim, captured);
  return s.aimDeltaRad;
}
