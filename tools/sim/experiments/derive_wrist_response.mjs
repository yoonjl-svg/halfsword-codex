// Read-only reconstruction of driveSword intermediates from actual call-boundary
// values. These are derived observations, not instrumented native motor work.
import * as THREE from 'three';
import { FINISH } from '../../../src/finish.js';

const V = value => new THREE.Vector3(value.x, value.y, value.z);
const Q = value => new THREE.Quaternion(value.x, value.y, value.z, value.w);
const from = value => new THREE.Vector3().fromArray(value);
const normDifference = (a, b) => a.clone().sub(b).length();

export function elbowResponse(f) {
  const parent = f.bodies.uarmS, child = f.bodies.farmS;
  const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(Q(parent.rotation()));
  return {
    // Relative body quaternion is not advertised as the native joint coordinate.
    relativeBodyQuaternion: Q(parent.rotation()).invert().multiply(Q(child.rotation())).toArray(),
    hingeAxisWorld: axis.toArray(),
    relativeHingeSpeedRadps: V(child.angvel()).sub(V(parent.angvel())).dot(axis),
  };
}

export function beforeWristResponse(f, previousYaw) {
  const sword = f.sword, forearm = f.bodies.farmS;
  return {
    yaw: f.yaw.toArray(), previousYaw: previousYaw?.slice() ?? null,
    previousAim: f.prevAim?.toArray() ?? null,
    swordRotation: Q(sword.rotation()).toArray(), swordOmega: V(sword.angvel()).toArray(),
    forearmOmega: V(forearm.angvel()).toArray(), forearmRotation: Q(forearm.rotation()).toArray(),
    forearmPosition: V(forearm.translation()).toArray(), swordCom: V(sword.worldCom()).toArray(),
    swordMass: sword.mass(), incomingBrake: f.wristBrake ?? false,
    incomingBrakeAngle: f.wristBrakeAng ?? null, incomingHill: f.wristHill ?? null,
    dt: f.lastDt, strength: f.strength, armHealth: f.armHealth, swordIhand: f.swordIhand,
    finishAmount: f.finish.amt, tapDown: !!f.skill.tap?.down, tapGo: !!f.skill.tap?.go,
    skillAim: f.skill.aim.toArray(), skillAimRaw: f.skill.aimRaw.toArray(),
    skillAimVelocity: f.skill.aimVel.toArray(), handOffset: f.handOffset.toArray(),
    skillLevel: f.skill.level, thrustWeight: f.skill.thrustPose.w,
    wristBrakingModel: f.wristBrakingModel ?? 'legacy', armTorqueModel: f.armTorqueModel ?? 'legacy',
    thrustDirection: [...f.skill.thrustPose.dir], elbow: elbowResponse(f),
  };
}

// Mirrors the documented private scalar function for observation only. The
// resulting cap and full pre-twist vector must match the original method output.
function derivedHill(v, vmax, a, ecc) {
  const r = v / vmax;
  if (r >= 1) return 0;
  if (r >= 0) return (1 - r) / (1 + r / a);
  const e = Math.min(1, -r / .3);
  return 1 + (ecc - 1) * (1 - (1 - e) * (1 - e));
}

export function afterWristResponse(f, before, consumedActivation) {
  const cfg = f.weaponCfg, aim = f.debug.aim.clone();
  const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().fromArray(before.swordRotation));
  const axis = new THREE.Vector3().crossVectors(blade, aim), sinA = axis.length();
  const angle = Math.atan2(sinA, blade.dot(aim));
  const w = from(before.swordOmega), wTwist = blade.clone().multiplyScalar(w.dot(blade));
  const wSwing = w.clone().sub(wTwist), wAimRaw = new THREE.Vector3();
  if (before.previousAim && before.dt > 0) wAimRaw.crossVectors(from(before.previousAim), aim).multiplyScalar(1 / before.dt);
  const wAimClamped = wAimRaw.clone();
  if (wAimClamped.length() > 25) wAimClamped.setLength(25);
  const wAim = wAimClamped.clone().addScaledVector(blade, -wAimClamped.dot(blade));
  const str = before.strength * consumedActivation * (.35 + .65 * before.armHealth);
  const baseCap = cfg.maxAimTorque * str;
  const position = new THREE.Vector3();
  if (sinA > 1e-5) position.copy(axis).multiplyScalar(cfg.aimStiffness * angle / sinA);
  const pivot = new THREE.Vector3(.13, 0, 0).applyQuaternion(new THREE.Quaternion().fromArray(before.forearmRotation)).add(from(before.forearmPosition));
  const arm = from(before.swordCom).sub(pivot);
  const rawGravity = new THREE.Vector3(arm.z * before.swordMass * 9.81, 0, -arm.x * before.swordMass * 9.81);
  const gravity = rawGravity.clone().multiplyScalar(-Math.min(1, str));
  const relativeOmega = w.clone().sub(from(before.forearmOmega));
  let stopBudget = null;
  let latch = before.incomingBrake, latchAngle = before.incomingBrakeAngle, damping = cfg.aimDamping, releaseBranchEntered = false;
  let toward = null, tgtSp = null, brakeAcc = null, stopAngle = null, relief = null, releaseThreshold = null;
  const gate = { nonparallel: sinA > 1e-5, unlatched: null, towardAbove3: null, fasterThanTarget: null, angleAbove025: null };
  if (gate.nonparallel) {
    toward = wSwing.dot(axis) / sinA; tgtSp = wAim.dot(axis) / sinA;
    if (latch && (toward < 1 || angle > before.incomingBrakeAngle + .35)) latch = false;
    gate.unlatched = !latch; gate.towardAbove3 = toward > 3;
    gate.fasterThanTarget = toward > tgtSp; gate.angleAbove025 = angle > .25;
    if (gate.unlatched && gate.towardAbove3 && gate.fasterThanTarget && gate.angleAbove025) {
      brakeAcc = baseCap * cfg.brakeEcc / before.swordIhand;
      if (before.wristBrakingModel === 'available' && before.armTorqueModel === 'legacy') {
        const full = position.clone().addScaledVector(wSwing.clone().sub(wAim), -cfg.aimDamping).add(gravity);
        const size = full.length();
        const speed = size > 1e-6 ? relativeOmega.dot(full) / size : 0;
        const highHill = derivedHill(speed, cfg.wristVmax * Math.sqrt(before.strength), .25, cfg.brakeEcc);
        const prior = before.incomingHill ?? highHill;
        const previewHill = prior + (highHill - prior) * Math.min(1, (before.dt || 1 / 120) / .03);
        const previewCap = baseCap * previewHill;
        if (size > previewCap) full.setLength(previewCap);
        const opposingNm = -full.clone().add(rawGravity).dot(axis.clone().divideScalar(sinA));
        const applicable = Number.isFinite(opposingNm) && opposingNm > 0;
        const actual = f.debug.wristStopBudget;
        const errors = [Math.abs(opposingNm - actual.opposingNm), Math.abs(previewHill - actual.previewHill),
          Math.abs(previewCap - actual.previewCap), normDifference(full, from(actual.previewTorque))];
        if (applicable !== actual.applicable || !errors.every(Number.isFinite) || Math.max(...errors) > 1e-9)
          throw Error('Stopping preview does not match independent read-only reconstruction');
        stopBudget = {applicable, reason: actual.reason, opposingNm, previewHill, previewCap,
          previewTorque: full.toArray(), maximumReconstructionError: Math.max(...errors)};
        if (applicable) brakeAcc = opposingNm / before.swordIhand;
      }
      stopAngle = toward * toward / (2 * brakeAcc);
      relief = before.finishAmount > 0 && aim.y < blade.y && !(before.tapDown && !before.tapGo)
        ? 1 - FINISH.brakeRelief * before.finishAmount : 1;
      releaseThreshold = stopAngle * cfg.releaseMargin * relief;
      if (angle > releaseThreshold) { damping = cfg.releaseDamping; releaseBranchEntered = true; }
      else { latch = true; latchAngle = angle; }
    }
  }
  const dampingTorque = wSwing.clone().sub(wAim).multiplyScalar(-damping);
  const requested = position.clone().add(dampingTorque).add(gravity), tl = requested.length();
  const vAlong = tl > 1e-6 ? relativeOmega.dot(requested) / tl : 0;
  const h = derivedHill(vAlong, cfg.wristVmax * Math.sqrt(before.strength), .25, cfg.brakeEcc);
  const hillBefore = before.incomingHill ?? h;
  const hillAfter = hillBefore + (h - hillBefore) * Math.min(1, (before.dt || 1 / 120) / .03);
  const finalCap = baseCap * hillAfter, predicted = requested.clone();
  if (tl > finalCap) predicted.setLength(finalCap);
  const capError = Math.abs(finalCap - f.debug.wristCap);
  const torqueError = normDifference(predicted, f.debug.wristTorque);
  const hillError = Math.abs(hillAfter - f.wristHill);
  const latchExact = latch === (f.wristBrake ?? false);
  const latchAngleExact = latchAngle === (f.wristBrakeAng ?? null);
  if (![capError, torqueError, hillError].every(Number.isFinite) ||
      Math.max(capError, torqueError, hillError) > 1e-9 || !latchExact || !latchAngleExact ||
      (latchAngle !== null && !Number.isFinite(latchAngle)))
    throw Error('Derived wrist terms do not match original call outputs');
  const localAim = aim.clone().applyQuaternion(new THREE.Quaternion().fromArray(before.yaw).invert());
  let yawOnlyRate = null, localOnlyRate = null;
  if (before.previousAim && before.previousYaw && before.dt > 0) {
    const previous = from(before.previousAim);
    const carried = previous.clone().applyQuaternion(new THREE.Quaternion().fromArray(before.previousYaw).invert())
      .applyQuaternion(new THREE.Quaternion().fromArray(before.yaw));
    // Two finite-angle counterfactual rates; they are not an additive decomposition.
    yawOnlyRate = new THREE.Vector3().crossVectors(previous, carried).multiplyScalar(1 / before.dt).toArray();
    localOnlyRate = new THREE.Vector3().crossVectors(carried, aim).multiplyScalar(1 / before.dt).toArray();
  }
  return {
    method: 'Read-only reconstruction from real call-boundary values, validated against original cap, Hill, latch and pre-twist torque outputs.',
    before, aimWorld: aim.toArray(), aimLocalResolved: localAim.toArray(), blade: blade.toArray(),
    axis: axis.toArray(), sinA, angleRad: angle, swordSwingOmega: wSwing.toArray(),
    targetOmegaBeforeClamp: wAimRaw.toArray(), targetOmegaAfterClamp: wAimClamped.toArray(), targetOmegaProjected: wAim.toArray(),
    yawOnlyCounterfactualRate: yawOnlyRate, localOnlyCounterfactualRate: localOnlyRate,
    towardRadps: toward, targetTowardRadps: tgtSp, gate, selectedDamping: damping,
    stopBudget,
    releaseBranchEntered, configuredAimDamping: cfg.aimDamping, configuredReleaseDamping: cfg.releaseDamping,
    releaseSelected: damping === cfg.releaseDamping && damping !== cfg.aimDamping,
    brakeAccRadps2: brakeAcc, stopAngleRad: stopAngle, finishRelief: relief, releaseThresholdRad: releaseThreshold,
    baseCapBeforeHillNm: baseCap, positionTorqueNm: position.toArray(), dampingTorqueNm: dampingTorque.toArray(),
    gravityCompensationNm: gravity.toArray(), requestedBeforeCapNm: requested.toArray(),
    relativeSwordForearmOmega: relativeOmega.toArray(), vAlongRadps: vAlong,
    instantaneousHill: h, filteredHill: hillAfter, capAfterHillNm: finalCap, capSaturated: tl > finalCap,
    dampingInstantaneousSwordPowerW: dampingTorque.dot(w),
    dampingRelativeTargetPowerW: dampingTorque.dot(wSwing.clone().sub(wAim)),
    originalOutputCheck: { capError, torqueError, hillError, latchExact, latchAngleExact },
  };
}
