// Optional vulnerable-posture targeting. These are authored game geometry
// budgets, not measured human limits. No damage, force or native mutation.
import * as THREE from 'three';
import { ARM } from './config.js';
import { LOW_FINISH } from './finish_entry.js';

export const OPPORTUNITY = Object.freeze({
  version: 'v1', neckLocalY: -0.075, faceLocalX: 0.075, faceLocalY: -0.025,
  guardRadius: 0.14, guardNearTarget: 0.34, minForward: 0.2,
  maxSideRatio: 0.85, reachSlack: 0.04,
  minimumChestDrop: 0.12, maximumUprightCos: Math.cos(Math.PI / 6),
  handHeightBudget: 0.24, pitchBudget: 0.28, prepareSpeed: 0.75,
  prepareTurn: 1.6, fastInput: 2, commitAngularSpeed: 1.5,
  // 0.24m / 0.75m/s needs 0.32s of genuinely slow preparation. The spare
  // 0.08s covers discrete updates; a real strike still commits immediately.
  prepareWindow: 0.4, reverseCommitSpeed: 0.35, quietReset: 0.12,
  readyHeightChange: 0.06, // New vertical intent cancels a prepared plane.
});
export const precisionEnabled = f => f?.opportunityModel === 'v2';
export const enabled = f => f?.opportunityModel === OPPORTUNITY.version || precisionEnabled(f);
const xyz = v => ({ x: v.x, y: v.y, z: v.z });
const xyzw = q => ({ x: q.x, y: q.y, z: q.z, w: q.w });
const vec = v => new THREE.Vector3(v.x, v.y, v.z);
const finite = v => !!v && [v.x, v.y, v.z].every(Number.isFinite);
const finiteQ = q => finite(q) && Number.isFinite(q.w);
function localPoint(p, q, x, y, z) {
  return xyz(new THREE.Vector3(x, y, z).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(vec(p)));
}

/** Capture outside physics prediction hooks. Plain owned copies can be put
 * into the AI's existing delayed observation buffer without live references. */
export function captureOpportunityPose(f) {
  if (!f?.bodies?.head || !f.bodies.chest || !f.bodies.pelvis) return null;
  const head = xyz(f.bodies.head.translation()), chest = xyz(f.bodies.chest.translation());
  const pelvis = xyz(f.bodies.pelvis.translation()), headQ = xyzw(f.bodies.head.rotation());
  const chestQ = xyzw(f.bodies.chest.rotation());
  return {
    targetId: f.index, state: f.state, alive: !!f.alive, armed: !!f.armed,
    headOff: !!f.decapitated, head, chest, pelvis, headQ, chestQ,
    neck: localPoint(head, headQ, 0, OPPORTUNITY.neckLocalY, 0),
    face: localPoint(head, headQ, OPPORTUNITY.faceLocalX, OPPORTUNITY.faceLocalY, 0),
    bladeBase: f.armed ? xyz(f.bladePoint(0)) : null,
    bladeTip: f.armed ? xyz(f.bladePoint(1)) : null,
    balance: f.balance, offBalance: f.offBalance, vigor: f.vigor,
  };
}

function pointSegmentDistance(p, a, b) {
  const d = vec(b).sub(vec(a));
  const t = THREE.MathUtils.clamp(vec(p).sub(vec(a)).dot(d) / Math.max(d.lengthSq(), 1e-12), 0, 1);
  return vec(a).addScaledVector(d, t).distanceTo(vec(p));
}

/** A blade close to the target and crossing the incoming corridor counts as
 * a cover. This is a targeting refusal, never a substitute for collision. */
export function opportunityBlocked(origin, target, snapshot) {
  const a = snapshot?.bladeBase, b = snapshot?.bladeTip;
  if (!snapshot?.armed || !finite(a) || !finite(b)) return false;
  if (pointSegmentDistance(target, a, b) > OPPORTUNITY.guardNearTarget) return false;
  // Sample the short final approach, including the target. Sword thickness is
  // expanded to an authored conservative corridor instead of awarding a hit.
  const T = vec(target), start = T.clone().lerp(vec(origin), Math.min(1, 0.45 / T.distanceTo(vec(origin))));
  for (let i = 0; i <= 8; i++) {
    const p = start.clone().lerp(T, i / 8);
    if (pointSegmentDistance(p, a, b) <= OPPORTUNITY.guardRadius) return true;
  }
  return false;
}

/** Victim information is read exclusively from snapshot. AI callers must use
 * their delayed snapshot; only the attacker's own present geometry is read. */
export function findOpportunity(att, snapshot, kind = 'cut') {
  if (!enabled(att) || !att.alive || !att.armed || att.weapon?.gun || att.weaponBroken ||
      !['stand', 'kneel'].includes(att.state) || !snapshot?.alive || snapshot.headOff ||
      !['kneel', 'down', 'getup'].includes(snapshot.state) ||
      !['cut', 'blunt', 'thrust'].includes(kind)) return null;
  const cfg = att.weaponCfg;
  if (kind === 'cut' && (!cfg.edged || !(cfg.mCut > 0))) return null;
  if (kind === 'blunt' && !(cfg.mBlunt > 0)) return null;
  if (kind === 'thrust' && (!(cfg.edged || cfg.spike) || !(cfg.mThrust > 0))) return null;
  if (![snapshot.head, snapshot.chest, snapshot.pelvis].every(finite) ||
      !finiteQ(snapshot.headQ) || !finiteQ(snapshot.chestQ)) return null;
  const chest = xyz(att.bodies.chest.translation());
  // A newly assigned fall state can precede any actual fall. Require either
  // a visibly lower chest or at least 30 degrees of torso tilt as well.
  const chestUp = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(
    snapshot.chestQ.x, snapshot.chestQ.y, snapshot.chestQ.z, snapshot.chestQ.w));
  if (snapshot.chest.y > chest.y - OPPORTUNITY.minimumChestDrop &&
      chestUp.y > OPPORTUNITY.maximumUprightCos) return null;
  // Same low-posture boundary as the selected finish-entry comparison. That
  // mechanic owns a fully low opponent and retains its existing 2.5x rules.
  const lowHighest = Math.max(snapshot.chest.y, snapshot.pelvis.y, !cfg.edged ? snapshot.head.y : -Infinity);
  if (['down', 'getup'].includes(snapshot.state) && lowHighest <= LOW_FINISH.enterHeight &&
      lowHighest + LOW_FINISH.minimumDrop < chest.y) return null;
  const shoulder = new THREE.Vector3(...ARM.shoulder);
  shoulder.z *= att.side ?? 1;
  const chestQ = att.bodies.chest.rotation();
  shoulder.applyQuaternion(new THREE.Quaternion(chestQ.x, chestQ.y, chestQ.z, chestQ.w)).add(vec(chest));
  const reach = ARM.upper + ARM.fore - ARM.slack + cfg.hiltLength + cfg.bladeLength + OPPORTUNITY.reachSlack;
  const origin = xyz(att.sword.translation());
  const inv = att.yaw.clone().invert();
  const candidates = kind === 'blunt' ? [['head', snapshot.head]] : kind === 'cut'
    ? [['neck', snapshot.neck]] : [['neck', snapshot.neck], ['face', snapshot.face]];
  for (const [zone, point] of candidates) {
    if (!finite(point)) continue;
    if (zone === 'face') {
      const front = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(
        snapshot.headQ.x, snapshot.headQ.y, snapshot.headQ.z, snapshot.headQ.w));
      // A face point on the far side of the skull is not a visible opening.
      if (front.dot(vec(origin).sub(vec(snapshot.head))) <= 0) continue;
    }
    const local = vec(point).sub(vec(chest)).applyQuaternion(inv);
    if (local.x < OPPORTUNITY.minForward || Math.abs(local.z) > local.x * OPPORTUNITY.maxSideRatio ||
        shoulder.distanceTo(vec(point)) > reach || opportunityBlocked(origin, point, snapshot)) continue;
    return { target: vec(point), zone, kind, targetId: snapshot.targetId };
  }
  return null;
}
