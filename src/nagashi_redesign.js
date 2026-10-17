// Opt-in Japanese flow research. These geometry tolerances are initial design
// candidates, not validated balance values. The normal game remains unchanged.
import * as THREE from 'three';
import { STEEL, PHYSICS } from './config.js';
export const FLOW_REDESIGN = {
  on: false, window: 0.12, penalty: 40, naturalExhaust: false,
  minSpeed: 2.5, minApproach: 0.5, minSweep: 1.5, minSweepRatio: 0.4,
  minImpact: 0.5, upperHeight: -0.15, maxHeight: 0.85,
  minTangent: 0.25, exitDistance: 0.30, exitGain: 0.015, sideGain: 0.06, frontClearance: 0.10,
};
const v = x => new THREE.Vector3(x.x, x.y, x.z);
const velocity = (s, p) => v(p).sub(s.com).cross(s.w).negate().add(s.v);

// Only actual steel contacts call this function. Keep the entry velocity of one
// attack, then recheck the CURRENT blade geometry/guard during the short window.
// Continuous contact cannot extend the window. Separation (the existing steel
// rearm rule) starts a new contact window, but the attack can pay only once.
export function flowCandidate(D, O, SO, point, normal, impact, now) {
  const st = D.skill?._cover, s = O.stamina;
  const no = (reason, details = {}) => { D.flowCheck = { time: now, attackId: s.attackId, reason, ...details }; return null; };
  if (!D.alive || !O.alive || !D.armed || !O.armed || D.state !== 'stand' ||
      D.stamina.exhausted || s.exhausted || O.state !== 'stand' || !st?.nagashi || D.schoolParry === false ||
      !O.swordProps) return no('scope');
  O.flowContactWindows ??= new WeakMap();
  let entry = O.flowContactWindows.get(D);
  const chest = v(D.bodies.chest.translation());
  if (!entry || now - entry.last > STEEL.rearmSteps * PHYSICS.timestep + 1e-9) {
    const relative = velocity(SO, point);
    const body = D.cache?.parts?.chest;
    if (body) relative.sub(velocity(body, point));
    // The upper torso/head column is the protected region. This admits overhead
    // and side cuts, but rejects retreating blades and mostly axial thrusts.
    const target = chest.clone();
    target.y = Math.min(chest.y + 0.28, Math.max(chest.y - 0.15, point.y));
    const toward = target.sub(point).normalize();
    const speed = relative.length();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(SO.q);
    const sweep = relative.clone().addScaledVector(axis, -relative.dot(axis)).length();
    const radialApproach = relative.dot(toward), height = point.y - chest.y;
    // A vertical cut can already be over the arms while its contact point moves
    // away horizontally. Keep descending upper-body cuts in that close envelope.
    const nearUpper = height >= -0.10 && Math.hypot(point.x - chest.x, point.z - chest.z) <= 0.65;
    const approach = Math.max(radialApproach, nearUpper ? -relative.y : -Infinity);
    entry = { attackId: s.attackId, start: now, last: now, speed, sweep, approach, impact,
      height, radialApproach, nearUpper, velocity: relative.toArray(),
      eligible: speed >= FLOW_REDESIGN.minSpeed && approach >= FLOW_REDESIGN.minApproach &&
        sweep >= FLOW_REDESIGN.minSweep && sweep >= speed * FLOW_REDESIGN.minSweepRatio &&
        impact >= FLOW_REDESIGN.minImpact && height >= FLOW_REDESIGN.upperHeight && height <= FLOW_REDESIGN.maxHeight };
    O.flowContactWindows.set(D, entry);
  }
  entry.last = now;
  if (!s.attackId || s.flowAttackKind === 'thrust') return no('attack-kind');
  // Reuse the game's attack attribution interval. This is renewed throughout
  // an actual strike/swing, including slowed swings; it is not a fixed timeout
  // from chargeAttack. An old paid ID must not turn a later recovery into a cut.
  if (s.time > s.attackUntil) return no('attack-ended', { time: s.time, until: s.attackUntil });
  if (O.flowSpentAttack === s.attackId) return no('already-paid');
  if (entry.attackId !== s.attackId) return no('new-command-in-bind');
  const age = now - entry.start;
  const guard = D.parryGuard ? D.parryGuard.active && D.parryGuard.held && !D.parryGuard.broken : st.ai?.mode === 'defend' && !st.ai.defVoid;
  if (!guard) return no('not-guarding');
  if (!entry.eligible) return no('entry-path', { entry: { ...entry } });
  if (age < -1e-9 || age > FLOW_REDESIGN.window + 1e-9) return no('window-expired', { age });
  const height = point.y - chest.y;
  if (height < FLOW_REDESIGN.upperHeight || height > FLOW_REDESIGN.maxHeight) return no('current-height', { height });
  const axis = D.bladePoint(1, new THREE.Vector3()).sub(D.bladePoint(0, new THREE.Vector3())).normalize();
  const direction = axis.clone().addScaledVector(normal, -axis.dot(normal));
  if (direction.length() < FLOW_REDESIGN.minTangent) return no('head-on', { tangent: direction.length() });
  direction.normalize(); // ALWAYS hilt -> tip; never drag a blade into the hands.
  const off = v(point).sub(chest), exit = off.clone().addScaledVector(direction, FLOW_REDESIGN.exitDistance);
  // Open radial clearance OR move sideways while remaining in front of the
  // torso. A roof can shed a blade sideways while its radial distance decreases;
  // requiring radial distance alone incorrectly rejects that ordinary geometry.
  const gain = exit.x * exit.x + exit.z * exit.z - off.x * off.x - off.z * off.z;
  const heading = D.heading ?? 0;
  const front = p => p.x * Math.cos(heading) - p.z * Math.sin(heading);
  const side = p => p.x * Math.sin(heading) + p.z * Math.cos(heading);
  const sideGain = Math.abs(side(exit)) - Math.abs(side(off));
  const sideways = sideGain >= FLOW_REDESIGN.sideGain &&
    Math.min(front(off), front(exit)) >= FLOW_REDESIGN.frontClearance;
  if (gain < FLOW_REDESIGN.exitGain && !sideways) return no('exit-towards-body', { gain, sideGain, offset: off.toArray(), direction: direction.toArray(), front: [front(off), front(exit)] });
  if (!(impact > 0)) return no('no-current-approach');
  D.flowCheck = { time: now, attackId: s.attackId, reason: 'eligible', age, gain, sideGain };
  return { direction, entry, age, gain, sideGain, height, impact: Math.min(entry.impact, impact) };
}

export function spendFlowPenalty(O, D) {
  const s = O.stamina;
  if (!s.attackId || O.flowSpentAttack === s.attackId) return null;
  O.flowSpentAttack = s.attackId;
  s.spent.flow ??= 0;
  s.counts.flow ??= 0;
  const before = s.value;
  const charged = s.spend('flow', FLOW_REDESIGN.penalty);
  if (charged) s.counts.flow++;
  const event = { attackId: s.attackId, time: s.time, defender: D.index,
    requested: FLOW_REDESIGN.penalty, charged, before, after: s.value,
    actual: before - s.value };
  O.lastFlowPenalty = event;
  return event;
}
