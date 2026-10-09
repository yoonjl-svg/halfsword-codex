// Optional explicit cut through a captured neck plane. These are ordinary
// hand/weapon command poses: native contact and the weapon's existing edge,
// speed, armor and damage rules decide the result.
import * as THREE from 'three';
import { ARM } from './config.js';

const V = a => new THREE.Vector3(...a);
const clamp = THREE.MathUtils.clamp;
const smooth = t => t * t * (3 - 2 * t);
const finite = a => a.every(Number.isFinite);
const direction = (yaw, pitch) => new THREE.Vector3(
  Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw));

function blendDirection(from, to, amount) {
  const turn = new THREE.Quaternion().setFromUnitVectors(from, to);
  return from.clone().applyQuaternion(new THREE.Quaternion().slerp(turn, amount));
}

function segmentDistance(point, a, b) {
  const delta = b.clone().sub(a);
  const t = clamp(point.clone().sub(a).dot(delta) / Math.max(1e-12, delta.lengthSq()), 0, 1);
  return point.distanceTo(a.clone().addScaledVector(delta, t));
}

// Slab test against a conservative chest box in the actual chest frame.
function intersectsChest(a, b, inverseBody) {
  const from = a.clone().applyQuaternion(inverseBody);
  const delta = b.clone().applyQuaternion(inverseBody).sub(from);
  const half = [.145, .165, .215]; // Existing chest half extents + weapon clearance.
  let enter = 0, exit = 1;
  for (let i = 0; i < 3; i++) {
    const start = from.getComponent(i), travel = delta.getComponent(i);
    if (Math.abs(travel) < 1e-12) {
      if (Math.abs(start) > half[i]) return false;
    } else {
      const t1 = (-half[i] - start) / travel, t2 = (half[i] - start) / travel;
      enter = Math.max(enter, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
      if (enter > exit) return false;
    }
  }
  return true;
}

export function captureCloseCut(f, target, h0) {
  const cfg = f?.weaponCfg;
  if (!cfg?.edged || !(cfg.mCut > 0) || !target || !h0 ||
      !finite([...target.toArray(), ...h0])) return null;
  const c = f.bodies.chest.translation(), inv = f.yaw.clone().invert();
  const local = target.clone().sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(inv);
  const cq = f.bodies.chest.rotation();
  const body = new THREE.Quaternion(cq.x, cq.y, cq.z, cq.w).premultiply(inv);
  const inverseBody = body.clone().invert();
  const shoulder = V(ARM.shoulder); shoulder.z *= f.side ?? 1; shoulder.applyQuaternion(body);
  const other = V(ARM.shoulder); other.z *= -(f.side ?? 1); other.applyQuaternion(body);
  const radius = ARM.upper + ARM.fore - ARM.slack;
  const length = cfg.hiltLength + cfg.bladeLength;
  const tail = Math.max(.12, -(cfg.gripAlong ?? -.12));
  const hp = f.bodies.head.translation();
  const head = new THREE.Vector3(hp.x - c.x, hp.y - c.y, hp.z - c.z).applyQuaternion(inv);
  const sq = f.sword.rotation();
  const startDir = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(new THREE.Quaternion(sq.x, sq.y, sq.z, sq.w)).applyQuaternion(inv).normalize();
  const start = V(h0);
  if (!finite([...startDir.toArray(), length, radius]) || length <= cfg.hiltLength) return null;

  const safe = (hand, dir) => {
    if (hand.distanceTo(shoulder) > radius + 1e-9) return false;
    if (cfg.twoHand && hand.clone().addScaledVector(dir, cfg.gripAlong)
      .distanceTo(other) > radius + 1e-9) return false;
    const back = hand.clone().addScaledVector(dir, -tail);
    const tip = hand.clone().addScaledVector(dir, length);
    return !intersectsChest(back, tip, inverseBody) &&
      segmentDistance(head, back, tip) >= (f.headR ?? .12) + .035;
  };

  let best = null;
  // Small authored front-hand choices; no behind-shoulder chamber and no
  // weapon-name exception. The blade's middle can cut at a range where its
  // point cannot be withdrawn for a thrust.
  for (const x of [.30, .36, .42]) for (const z of [-.06, .06, .18]) {
    for (const height of [0, .10, .20, -.10]) {
      const hand = new THREE.Vector3(x, local.y + height, z * (f.side ?? 1));
      const ray = local.clone().sub(hand), along = ray.length();
      if (ray.x <= .15 || along < cfg.hiltLength + .05 || along > length - .03) continue;
      const yaw = Math.atan2(ray.z, ray.x), pitch = Math.atan2(ray.y, Math.hypot(ray.x, ray.z));
      const arc = .60;
      if (Math.abs(yaw) + arc > 1.35 || Math.abs(pitch) > .65) continue;
      const left = direction(yaw - arc, pitch), right = direction(yaw + arc, pitch);
      // Use the nearer side for the chamber instead of always crossing the
      // player's current weapon through their own body first.
      const sign = startDir.angleTo(left) <= startDir.angleTo(right) ? 1 : -1;
      const chamberDir = sign === 1 ? left : right;
      let clear = true;
      for (let i = 0; i <= 12 && clear; i++) {
        const u = i / 12;
        clear = safe(hand, direction(yaw + sign * arc * (2 * u - 1), pitch));
        // The captured starting command can be beyond IK reach already. Test
        // the new sweep's complete reach, and the chamber's own-body clearance.
        if (clear && i > 0) {
          const h = start.clone().lerp(hand, u), d = blendDirection(startDir, chamberDir, u);
          const a = h.clone().addScaledVector(d, -tail), b = h.clone().addScaledVector(d, length);
          clear = !intersectsChest(a, b, inverseBody) &&
            segmentDistance(head, a, b) >= (f.headR ?? .12) + .035;
        }
      }
      if (!clear) continue;
      const score = hand.distanceTo(start) + startDir.angleTo(chamberDir) * .10 + Math.abs(height) * .10;
      if (!best || score < best.score) best = { score, hand: hand.toArray(), yaw, pitch, arc, sign,
        chamberDir: chamberDir.toArray(), along };
    }
  }
  if (!best) return null;
  return { ...best, start: h0.slice(), startDir: startDir.toArray(),
    target: target.toArray(), targetLocal: local.toArray(),
    captureChest: [c.x, c.y, c.z], captureYaw: f.yaw.toArray(),
    handTrim: 0, pitchTrim: 0, trackingLocked: false,
    phase: 'aim', aim: .24, extend: .25 };
}

export function updateCloseCut(f, tap, pose) {
  const s = tap.opportunityCut;
  if (!s || tap.opportunity?.kind !== 'cut' || tap.down || tap.bound) return false;
  const a = smooth(clamp(tap.t / tap.K.aim, 0, 1));
  const sweep = smooth(clamp((tap.t - tap.K.aim) / tap.K.extend, 0, 1));
  const dir = tap.t < tap.K.aim
    ? blendDirection(V(s.startDir), V(s.chamberDir), a)
    : direction(s.yaw + s.sign * s.arc * (2 * sweep - 1), s.pitch);
  const hand = V(s.start).lerp(V(s.hand), a);
  // Own tracking residual only, with the same half-share and trim budgets as
  // opportunityPathGoal. This is never accumulated onto the previous trim.
  // Freeze at strike entry: subsequent collisions cannot steer the cut.
  if (!s.trackingLocked) {
    const grip = f.sword.translation(), q = f.sword.rotation();
    const actual = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    s.handTrim = Number.isFinite(f.handTarget?.y)
      ? clamp((f.handTarget.y - grip.y) * .5, -.06, .06) : 0;
    const wanted = f.aimDirW;
    const ownHeading = wanted && actual.x * wanted.x + actual.z * wanted.z > 0;
    s.pitchTrim = ownHeading ? clamp((Math.atan2(wanted.y, Math.hypot(wanted.x, wanted.z)) -
      Math.atan2(actual.y, Math.hypot(actual.x, actual.z))) * .5, -.07, .07) : 0;
    if (tap.t >= tap.K.aim) s.trackingLocked = true;
  }
  // Keep the captured plane in world space while our chest lowers/turns for
  // the ordinary attack. This reads our own frame, never the opponent again.
  const captureYaw = new THREE.Quaternion(...s.captureYaw);
  hand.applyQuaternion(captureYaw).add(V(s.captureChest));
  hand.y += s.handTrim * a;
  dir.applyQuaternion(captureYaw);
  const azimuth = Math.atan2(dir.z, dir.x);
  const elevation = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) + s.pitchTrim * a;
  dir.copy(direction(azimuth, elevation));
  const c = f.bodies.chest.translation(), inverse = f.yaw.clone().invert();
  hand.sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(inverse);
  dir.applyQuaternion(inverse);
  pose.hand.splice(0, 3, ...hand.toArray());
  pose.dir.splice(0, 3, ...dir.toArray());
  tap.dir = dir.toArray();
  s.phase = tap.t < tap.K.aim ? 'aim' : tap.t < tap.K.aim + tap.K.extend ? 'cut' : 'recover';
  return true;
}
