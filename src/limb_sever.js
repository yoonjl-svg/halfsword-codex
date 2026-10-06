// Joint-level arm/leg separation; ordinary fights and the explicit legacy trial.
import * as THREE from 'three';
import { COMBAT } from './config.js';

export const LIMB_SEVER_TRIAL = Object.freeze({ severity: 1.2, jointRadiusM: 0.085 });
const TARGETS = [
  { root: 'farmS', parent: 'uarmS', parts: ['farmS'], limb: 'armS', radius: 0.045 },
  { root: 'farmO', parent: 'uarmO', parts: ['farmO'], limb: 'armO', radius: 0.045 },
  { root: 'shinF', parent: 'thighF', parts: ['shinF', 'footF'], limb: 'legF', radius: 0.055 },
  { root: 'shinB', parent: 'thighB', parts: ['shinB', 'footB'], limb: 'legB', radius: 0.055 },
];

export function limbSeverCandidate(f, h) {
  if (!COMBAT.limbSeverTrial || f.state === 'dead' || f.revival || h.type !== 'cut'
      || !h.pass || !h.passing || h.stuck || !(h.severity >= LIMB_SEVER_TRIAL.severity) || !h.local) return null;
  for (const target of TARGETS) {
    if (f.detachedParts?.has(target.root) || ![target.root, target.parent].includes(h.part)) continue;
    const joint = f.jointByName[target.root]?.joint;
    if (!joint) continue;
    const anchor = h.part === target.root ? joint.anchor2() : joint.anchor1();
    const distance = Math.hypot(h.local.x - anchor.x, h.local.y - anchor.y, h.local.z - anchor.z);
    if (distance <= LIMB_SEVER_TRIAL.jointRadiusM) return target;
  }
  return null;
}

function stopMotor(j) {
  if (!j.joint || j.manual) return;
  const raw = j.joint.rawSet;
  for (const axis of j.type === 'hinge' ? [3] : [3, 4, 5]) raw.jointConfigureMotor(j.joint.handle, axis, 0, 0, 0, 0);
}

export function detachLimb(f, target, h, woundBleed) {
  const joint = f.jointByName[target.root];
  if (!joint?.joint || f.detachedParts?.has(target.root)) return false;
  const localParent = new THREE.Vector3().copy(joint.joint.anchor1());
  const localChild = new THREE.Vector3().copy(joint.joint.anchor2());
  const normalParent = localParent.clone().normalize();
  const normalChild = localChild.clone().normalize();
  f.detachedParts ||= new Set();
  f.severedLimbs ||= [];
  for (const name of target.parts) f.detachedParts.add(name);
  // Internal joints keep passive limits, never their last active motor command.
  for (const j of f.joints) if (target.parts.includes(j.name)) stopMotor(j);
  f.world.removeImpulseJoint(joint.joint, true);
  joint.joint = null;
  f.joints = f.joints.filter((j) => !target.parts.includes(j.name));
  for (const name of target.parts) {
    const body = f.bodies[name];
    f.totalMass -= body.collider(0).mass(); // controller's anatomical mass only
    for (let i = 0; i < body.numColliders(); i++) {
      const col = body.collider(i);
      const info = f.colliderInfo.get(col.handle);
      if (info) info.detached = true;
      col.setCollisionGroups((32 << 16) | 1); // loose pieces collide with floor
    }
  }
  if (f.gait) f.gait.Mg = f.totalMass * 9.81;
  // Transfer the existing wound budget to the proximal stump once.
  const sourceWound = f.wounds.at(-1);
  for (const w of f.wounds) if (target.parts.includes(w.part) || w === sourceWound) {
    f.bleed = Math.max(0, f.bleed - w.bleed);
    w.bleed = 0;
    w.detached = target.parts.includes(w.part);
  }
  f.bleed += woundBleed;
  f.wounds.push({ part: target.parent, type: 'cut', severity: h.severity, bleed: woundBleed,
    local: localParent.clone(), stump: true, limbStump: true });
  f.limbs[target.limb] = 0;
  if (target.limb === 'armS') f.dropSword();
  if (target.limb === 'armO') f.gripping = false;
  if (target.limb.startsWith('leg')) {
    f.missingSupportLeg = true;
    // Gait.exit deletes stance extra mass. Freeze the existing extra masses at
    // separation instead: preserve all physical masses and velocities here.
    if (f.gait) {
      f.gait.active = false;
      for (const side of ['F', 'B']) {
        const l = f.gait.legs[side];
        l.N = l.Nf = 0;
        for (const name of [l.thigh, l.shin, l.foot]) f.jointByName[name].gain = 1;
      }
    }
    f.knockDown(true);
  }
  f.severedLimbs.push({ ...target, localParent, localChild, normalParent, normalChild,
    energyJ: h.energy, severity: h.severity, source: 'passing-cut-near-joint' });
  return true;
}

/** No one-legged gait/recovery in this trial; collapse remains dynamic. */
export function disableMissingLegSupport(f) {
  const raw = f.uprightJoint.rawSet;
  for (const axis of [3, 4, 5]) raw.jointConfigureMotor(f.uprightJoint.handle, axis, 0, 0, 0, 0);
  f.footLoad.F = f.footLoad.B = 0;
  f.localVel.set(0, 0);
  f.stumble.set(0, 0);
  f.lean = 0;
  if (f.balanceProbe) Object.assign(f.balanceProbe, { appliedUpN: 0, baseSupportN: 0,
    heightSpringN: 0, verticalDampingN: 0, horizontalXN: 0, horizontalZN: 0,
    nominalWeightN: f.totalMass * 9.81, footReaction: 0 });
  const com = new THREE.Vector3();
  let mass = 0;
  for (const [name, b] of Object.entries(f.bodies)) if (!f.detachedParts.has(name)) {
    com.addScaledVector(new THREE.Vector3().copy(b.worldCom()), b.mass());
    mass += b.mass();
  }
  f.com ||= new THREE.Vector3();
  f.com.copy(com).divideScalar(mass);
}
