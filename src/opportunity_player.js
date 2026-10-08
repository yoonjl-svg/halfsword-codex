// Preparation-only player assistance. The input's lateral path, timing and
// reversals are preserved. A committed strike never follows a moving target.
import * as THREE from 'three';
import { ARM, WEAPON } from './config.js';
import { guardAt } from './guards.js';
import { OPPORTUNITY, enabled, captureOpportunityPose, findOpportunity } from './opportunity_target.js';

const clamp = THREE.MathUtils.clamp;

/** Change elevation while preserving the user's horizontal heading exactly.
 * Rotating around the body's Z axis also changes azimuth and lowers a blade
 * that points backwards, so it is not a valid height-only correction. */
export function applyOpportunityElevation(aim, pitch) {
  if (pitch === 0) return aim;
  const horizontal = Math.hypot(aim.x, aim.z);
  if (horizontal < 1e-8) return aim; // An exactly vertical blade has no heading.
  const elevation = clamp(Math.atan2(aim.y, horizontal) + pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  const scale = Math.cos(elevation) / horizontal;
  aim.x *= scale; aim.z *= scale; aim.y = Math.sin(elevation);
  return aim;
}

/** Command-map estimate of the frontward part of a horizontal sweep. The
 * chamber can point up/back and is not the height where a later cut crosses
 * the opponent. Use the current v2 strike weights and the user's same pad y.
 * This predicts a commanded crossing, not native blade motion or a hit. */
export function opportunityCrossingReference(f, target, policy) {
  const y = f.skill.aim.y, s = f.swordsmanshipState;
  const sample = x => {
    const hand = new THREE.Vector3(0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x*x+y*y)/(WEAPON.reach**2))), 0.1+y, 0.1+x);
    if (f.onehandArmModel === 'manual' && f.guardPose.oneHand && !f.weaponCfg.twoHand) {
      const shoulder = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (f.side ?? 1));
      hand.sub(shoulder).multiplyScalar(f.onehandReachScale ?? 1).add(shoulder);
    }
    const g = guardAt(x, y, { table: s.profile.table });
    hand.x += (g.hand[0] - hand.x) * policy.strokeDepth;
    hand.y += (g.hand[1] - hand.y) * policy.strokePlane;
    hand.z += (g.hand[2] - hand.z) * policy.strokePlane;
    const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
    const az = clamp((x - 0.05) * 1.7, -1.1, 1.3);
    const aim = new THREE.Vector3(Math.cos(el)*Math.cos(az), Math.sin(el), Math.cos(el)*Math.sin(az));
    const turn = new THREE.Quaternion().setFromUnitVectors(aim, new THREE.Vector3(...g.dir).normalize());
    turn.slerp(new THREE.Quaternion(), 1 - policy.strokeAim);
    aim.applyQuaternion(turn).normalize();
    const distance = (target.x - hand.x) / Math.max(0.05, aim.x);
    return { hand, aim, padX: x, padY: y, distance, height: hand.y + aim.y * distance,
      sideError: hand.z + aim.z * distance - target.z };
  };
  // Find the small frontward section of the existing left/right command map.
  // This query never writes the user's pad x or y.
  let low = -0.25, high = 0.25, crossing = sample(0.05);
  const left = sample(low), right = sample(high);
  if (![left.sideError, right.sideError].every(Number.isFinite) || left.sideError * right.sideError > 0) return null;
  for (let i = 0; i < 12; i++) {
    crossing = sample((low + high) * 0.5);
    if (crossing.sideError > 0) high = crossing.padX;
    else low = crossing.padX;
  }
  const length = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  if (![crossing.height, crossing.sideError, crossing.distance].every(Number.isFinite) ||
      crossing.aim.x <= 0.1 || crossing.distance <= 0 || crossing.distance > length + OPPORTUNITY.reachSlack ||
      Math.abs(crossing.sideError) > 0.025) return null;
  return crossing;
}

function setCrossingGoal(f, state, policy) {
  const local = new THREE.Vector3(...state.targetLocal);
  const crossing = opportunityCrossingReference(f, local, policy);
  if (!crossing) return false;
  state.crossing = { padX: crossing.padX, padY: crossing.padY,
    height: crossing.height, worldHeight: crossing.height + state.captureChestY,
    targetHeight: local.y, hand: crossing.hand.toArray(), aim: crossing.aim.toArray(),
    sideError: crossing.sideError, distance: crossing.distance };
  const heightError = local.y - crossing.height;
  state.desiredY = clamp(heightError * 0.55, -OPPORTUNITY.handHeightBudget, OPPORTUNITY.handHeightBudget);
  const pitch = Math.atan2(crossing.aim.y, Math.max(0.05, Math.hypot(crossing.aim.x, crossing.aim.z)));
  const wanted = Math.atan2(local.y - crossing.hand.y - state.desiredY,
    Math.max(0.2, Math.hypot(local.x - crossing.hand.x, local.z - crossing.hand.z)));
  state.desiredPitch = clamp(wanted - pitch, -OPPORTUNITY.pitchBudget, OPPORTUNITY.pitchBudget);
  return true;
}

/** Mutates only the resolved command vectors passed by swordsmanship v2. */
export function updateOpportunityPlayer(f, dt, hand, aim, policy) {
  if (!enabled(f) || f.index !== 0 || !(dt > 0)) return;
  const s = f.swordsmanshipState, skill = f.skill;
  if (!s) return;
  const state = f.opportunityPlayer ||= {
    phase: 'idle', target: null, zone: null, foe: null, age: 0, quiet: 0,
    handY: 0, pitch: 0, desiredY: 0, desiredPitch: 0, captures: 0,
  };
  const moving = s.moving && !s.returning;
  const speed = skill.vel.length();
  const av = f.sword.angvel(), angularSpeed = Math.hypot(av.x, av.y, av.z);
  state.quiet = moving ? 0 : state.quiet + dt;
  const eligible = s.eligible && f.alive && f.armed && !f.weapon?.gun && !f.weaponBroken &&
    !skill.tap && f.move.y > -0.2;
  const lostOwnership = !eligible || !['stand', 'kneel'].includes(f.state) ||
    (state.foe && (state.foe !== f.foe || !f.foe?.alive || f.foe.decapitated || state.weaponId !== f.weapon.id));
  if (state.phase !== 'idle' && lostOwnership) state.phase = 'releasing';
  // Let physical follow-through finish after the finger stops. The existing
  // v2 return may take ownership sooner; no new attack clock is introduced.
  if (state.phase === 'committed' && state.quiet >= OPPORTUNITY.quietReset &&
      (s.returning || !skill.swinging && angularSpeed < OPPORTUNITY.commitAngularSpeed)) state.phase = 'releasing';
  if (state.phase === 'ready' && moving &&
      Math.abs(f.handOffset.y - state.crossing.padY) > OPPORTUNITY.readyHeightChange) state.phase = 'releasing';
  // Chambering right then cutting left is an intentional attack, not a
  // cancellation. Freeze the prepared height while leaving that reversal
  // fully controlled by the user's raw lateral input.
  if (['preparing', 'ready'].includes(state.phase) && eligible && f.handHeld && moving && s.reversing &&
      speed >= OPPORTUNITY.reverseCommitSpeed) {
    state.phase = 'committed';
  }
  if (['preparing', 'ready'].includes(state.phase) && (!eligible || !f.handHeld ||
      state.foe !== f.foe || !f.foe?.alive || f.foe.decapitated || f.foe.state === 'stand')) {
    state.phase = skill.swinging ? 'committed' : 'releasing';
  }
  if (state.phase === 'idle' && eligible && moving && f.handHeld && !s.reversing && speed < OPPORTUNITY.fastInput) {
    const kind = f.weaponCfg.edged ? 'cut' : 'blunt';
    const found = findOpportunity(f, captureOpportunityPose(f.foe), kind);
    if (found) {
      // Lock opponent and own-frame geometry now. During preparation only,
      // a user's changed pad height can recompute that same captured crossing.
      // No later opponent position or orientation is read for this goal.
      const chest = f.bodies.chest.translation();
      const local = found.target.clone().sub(new THREE.Vector3(chest.x, chest.y, chest.z)).applyQuaternion(f.yaw.clone().invert());
      state.targetLocal = local.toArray(); state.captureChestY = chest.y;
      if (!setCrossingGoal(f, state, policy)) return;
      state.phase = 'preparing'; state.target = found.target.toArray();
      state.zone = found.zone; state.kind = kind; state.foe = f.foe;
      state.weaponId = f.weapon.id;
      state.age = 0; state.captures++;
    }
  }
  if (state.phase === 'ready' && skill.swinging) state.phase = 'committed';
  if (state.phase === 'preparing') {
    state.age += dt;
    // Strong user input or physical acceleration ends preparation immediately.
    // The short window is a design budget, not a replacement attack clock.
    if (speed >= OPPORTUNITY.fastInput || (skill.swinging && angularSpeed >= OPPORTUNITY.commitAngularSpeed)) state.phase = 'committed';
    else if (state.age >= OPPORTUNITY.prepareWindow) state.phase = 'ready';
    else if (Math.abs(skill.aim.y - state.crossing.padY) > 1e-6 && !setCrossingGoal(f, state, policy)) {
      state.phase = 'releasing';
    } else {
      const changeY = clamp(state.desiredY - state.handY, -OPPORTUNITY.prepareSpeed * dt, OPPORTUNITY.prepareSpeed * dt);
      // The optional height adjustment cannot oppose an intentional vertical
      // swipe. Horizontal positioning can still prepare a lower attack plane.
      if (changeY * skill.vel.y >= 0 || Math.abs(skill.vel.y) < 0.05) state.handY += changeY;
      state.pitch += clamp(state.desiredPitch - state.pitch, -OPPORTUNITY.prepareTurn * dt, OPPORTUNITY.prepareTurn * dt);
    }
  }
  if (state.phase === 'releasing' || !eligible && state.phase !== 'committed') {
    state.handY += clamp(-state.handY, -OPPORTUNITY.prepareSpeed * dt, OPPORTUNITY.prepareSpeed * dt);
    state.pitch += clamp(-state.pitch, -OPPORTUNITY.prepareTurn * dt, OPPORTUNITY.prepareTurn * dt);
    if (Math.abs(state.handY) + Math.abs(state.pitch) < 1e-9) {
      state.phase = 'idle'; state.target = null; state.zone = null; state.foe = null;
    }
  }
  // Explicit tap/finish owns the complete command; do not layer these offsets
  // into its already-captured base. Existing v2 blending handles handover.
  if (!skill.tap && !(f.finish?.amt > 0)) {
    if (state.handY !== 0) hand.y += state.handY;
    applyOpportunityElevation(aim, state.pitch);
  }
}
