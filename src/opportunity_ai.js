// Optional vulnerable-posture decisions. The victim geometry comes only from
// Senses' delayed owned snapshot; ordinary AI and damage rules are unchanged.
import * as THREE from 'three';
import { WEAPON } from './config.js';
import { guardAt } from './guards.js';
import { applyOpportunityElevation } from './opportunity_player.js';
import { enabled, precisionEnabled, findOpportunity, OPPORTUNITY } from './opportunity_target.js';
import { opportunityPathGoal } from './opportunity_path.js';
import { distanceEnabled, measureThrustDistance } from './combat_distance.js';

export const OPPORTUNITY_AI = Object.freeze({ attempts: 2, resetHold: 0.45, padHeightScale: 0.5 });
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function createOpportunityAI() {
  return { active: false, attempts: 0, stable: 0, episode: 0, targetId: null };
}

/** Distance preparation reads the same delayed target as the attack. It owns
 * only an ordinary Skill command, never the victim or a physical transform. */
export function opportunityRangeAttack(ai) {
  return distanceEnabled(ai.me) && ai.opportunityAttack?.kind === 'thrust';
}

export function clearOpportunityRange(ai) {
  if (ai.me.skill?.rangeAI) ai.me.skill.clearThrustRange();
}

export function prepareOpportunityRange(ai) {
  const lock = ai.opportunityAttack, me = ai.me;
  const preparing = opportunityRangeAttack(ai) && !lock.started &&
    ai.mode === 'attack' && ['windup', 'approach'].includes(ai.phase) &&
    me.alive && me.armed && !me.weaponBroken && ['stand', 'kneel'].includes(me.state) &&
    !me.skill.tap && !me.revival && !me.feetHeld;
  if (!preparing) { clearOpportunityRange(ai); return null; }
  const range = measureThrustDistance(me, lock.target);
  lock.distance = range;
  if (!range.valid) { clearOpportunityRange(ai); return range; }
  const request = me.skill.rangeAI;
  if (request && request.episode === lock.episode) {
    request.active = true;
    request.target.copy(lock.target);
  } else me.skill.rangeAI = { active: true, target: lock.target.clone(), episode: lock.episode };
  return range;
}

/** Distance, attack aborts, weapon changes and kneel/down/getup chatter cannot
 * refresh the budget. Only observed stable standing rearms the next crisis. */
export function updateOpportunityEpisode(ai, seen, dt) {
  if (!enabled(ai.me)) return;
  ai.opportunitySeen = seen;
  const s = seen?.opportunity;
  const state = ai.opportunityState;
  if (!s) { state.stable = 0; return; }
  if (state.targetId !== s.targetId) {
    state.targetId = s.targetId;
    state.active = false;
    state.attempts = 0;
    state.stable = 0;
  }
  if (!s.alive) { state.stable = 0; return; }
  if (['kneel', 'down', 'getup'].includes(s.state)) {
    if (!state.active) { state.active = true; state.episode++; }
    state.stable = 0;
  } else if (s.state === 'stand' && s.balance >= 65 && s.offBalance <= 0.03) {
    state.stable += dt;
    if (state.stable >= OPPORTUNITY_AI.resetHold) {
      state.active = false;
      state.attempts = 0;
    }
  } else state.stable = 0;
}

export function opportunityWeaponKind(me, tech = null) {
  if (me.weapon?.gun || me.weaponBroken) return null;
  const cfg = me.weaponCfg;
  if (!cfg) return null;
  if (tech?.kind === 'thrust') return (cfg.edged || cfg.spike) && cfg.mThrust > 0 ? 'thrust' : null;
  if (!cfg.edged || !(cfg.mCut > 0)) return cfg.mBlunt > 0 ? 'blunt' : null;
  if (!tech && cfg.mThrust > cfg.mCut) return 'thrust';
  return 'cut';
}

/** A neck cut must cross from one side to the other without first dropping
 * steeply through the skull. Select existing template geometry, not weapon or
 * technique names. These authored path limits are not a damage bonus. */
export function neckCrossingTechnique(tech) {
  if (tech?.kind !== 'cut' || !tech.from || !tech.path?.length) return false;
  const first = tech.from, last = tech.path[tech.path.length - 1];
  const dx = Math.abs(last[0] - first[0]);
  if (first[0] * last[0] >= 0 || dx < 0.3) return false;
  const heights = [first, ...tech.path].map(p => p[1]);
  return Math.max(...heights) - Math.min(...heights) <= dx * 0.65;
}

/** Includes the existing point-on-body threat even for a kneeling defender.
 * The geometric near-target cover check is additional and lives in the common
 * target helper. No aggression bonus is added here. */
export function opportunityCandidate(ai, tech = null) {
  const seen = ai.opportunitySeen;
  if (!enabled(ai.me) || ai.me.skill?.tap || ai.me.finish?.amt > 0 ||
      !ai.opportunityState.active || ai.opportunityState.attempts >= OPPORTUNITY_AI.attempts ||
      !seen?.opportunity || (seen.armed && ai.foeClass(seen).online)) return null;
  const kind = opportunityWeaponKind(ai.me, tech);
  // Counters and follow-ups keep their existing technical purpose when their
  // chosen path cannot cross the neck; they do not consume the special budget.
  if (tech && kind === 'cut' && !neckCrossingTechnique(tech)) return null;
  return kind ? findOpportunity(ai.me, seen.opportunity, kind) : null;
}

function offsetPad(point, shift) {
  let x = point[0], y = clamp(point[1] + shift, -0.6, 0.6);
  const length = Math.hypot(x, y);
  if (length > 0.62) { x *= 0.62 / length; y *= 0.62 / length; }
  return [x, y];
}

/** Pure command estimate for the existing AI hand map in driveSword. This
 * does not predict native blade lag, collision, body lowering or injury. */
export function opportunityAICrossing(ai, tech, target, shift = 0) {
  const me = ai.me, chest = me.bodies.chest.translation();
  const local = target.clone().sub(new THREE.Vector3(chest.x, chest.y, chest.z)).applyQuaternion(me.yaw.clone().invert());
  const weight = me.guardWeight(), lateral = clamp(ai.foeLat, -0.4, 0.4) * 0.5;
  const points = [tech.from, ...tech.path].map(p => offsetPad(p, shift));
  // y follows the chosen path, not a new horizontal animation. Corrected
  // points stay in the hand disk before moveHand's existing lateral offset.
  const pathY = x => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
      const t = (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
    return points[0][1];
  };
  const sample = pathX => {
    let x = clamp(pathX + lateral, -0.6, 0.6), y = pathY(pathX);
    const n = Math.hypot(x, y);
    if (n > 0.62) { x *= 0.62 / n; y *= 0.62 / n; }
    const hand = new THREE.Vector3(0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x*x+y*y)/(WEAPON.reach**2))), 0.1+y, 0.1+x);
    const G = guardAt(x, y, { table: me.guardPose.table, oneHand: me.guardPose.oneHand });
    hand.lerp(new THREE.Vector3(...G.hand), weight);
    const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
    const az = clamp((x - 0.05) * 1.7, -1.1, 1.3);
    const aim = new THREE.Vector3(Math.cos(el)*Math.cos(az), Math.sin(el), Math.cos(el)*Math.sin(az));
    aim.lerp(new THREE.Vector3(...G.dir), weight);
    if (aim.lengthSq() < 0.04) aim.set(...G.dir);
    aim.normalize();
    if (aim.x <= 0.05 || local.x <= hand.x) return null;
    const distance = (local.x - hand.x) / aim.x;
    if (distance < me.weaponCfg.hiltLength || distance > me.weaponCfg.hiltLength + me.weaponCfg.bladeLength) return null;
    const height = hand.y + aim.y * distance;
    return { pathX, padX: x, padY: y, height, worldHeight: height + chest.y,
      targetHeight: local.y, targetWorldHeight: target.y, error: height - local.y,
      sideError: hand.z + aim.z * distance - local.z, guardWeight: weight,
      bladeDistance: distance, insideBlade: distance >= me.weaponCfg.hiltLength &&
        distance <= me.weaponCfg.hiltLength + me.weaponCfg.bladeLength,
      hand: hand.toArray(), aim: aim.toArray() };
  };
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  // The legacy pose map's forward crossing can lie outside the player's
  // small central interval. Bracket within this actual technique's full path,
  // discarding backwards rays and points outside the real blade segment.
  const line = Array.from({ length: 17 }, (_, i) => sample(minX + (maxX - minX) * i / 16));
  let bracket = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (a && b && a.sideError * b.sideError <= 0 && (!bracket ||
        Math.abs(a.pathX + b.pathX) < Math.abs(bracket[0].pathX + bracket[1].pathX))) bracket = [a, b];
  }
  if (!bracket) return null;
  let [a, b] = bracket, low = a.pathX, high = b.pathX, crossing;
  for (let i = 0; i < 10; i++) {
    crossing = sample((low + high) / 2);
    if (!crossing) return null;
    if (a.sideError * crossing.sideError <= 0) { high = crossing.pathX; b = crossing; }
    else { low = crossing.pathX; a = crossing; }
  }
  return Math.abs(crossing.sideError) <= 0.04 ? crossing : null;
}

/** An overhead blunt path can have constant pad x. Sample its authored path
 * rather than treating it as a horizontal neck sweep. These are command
 * references on the active weapon segment, not predicted contacts. */
export function opportunityAIBluntReference(ai, tech, target) {
  if (!tech?.from || !tech.path?.length) return null;
  const me = ai.me, chest = vectorOf(me.bodies.chest.translation());
  const local = target.clone().sub(chest).applyQuaternion(me.yaw.clone().invert());
  const points = [tech.from, ...tech.path], weight = me.guardWeight();
  const lateral = clamp(ai.foeLat, -0.4, 0.4) * 0.5;
  let best = null, bestError = Infinity;
  for (let i = 0; i <= 16; i++) {
    const u = i / 16 * (points.length - 1), at = Math.min(points.length - 2, Math.floor(u));
    const t = u - at, a = points[at], b = points[at + 1];
    let [x, y] = offsetPad([a[0] + (b[0] - a[0]) * t + lateral, a[1] + (b[1] - a[1]) * t], 0);
    const hand = new THREE.Vector3(0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x*x+y*y)/(WEAPON.reach**2))), 0.1+y, 0.1+x);
    const g = guardAt(x, y, { table: me.guardPose.table, oneHand: me.guardPose.oneHand });
    hand.lerp(new THREE.Vector3(...g.hand), weight);
    const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
    const az = clamp((x - 0.05) * 1.7, -1.1, 1.3);
    const aim = new THREE.Vector3(Math.cos(el)*Math.cos(az), Math.sin(el), Math.cos(el)*Math.sin(az));
    aim.lerp(new THREE.Vector3(...g.dir), weight);
    if (aim.lengthSq() < 0.04) aim.set(...g.dir);
    aim.normalize();
    if (aim.x <= 0.1) continue;
    const distance = (local.x - hand.x) / aim.x;
    if (!(distance >= me.weaponCfg.hiltLength && distance <= me.weaponCfg.hiltLength + me.weaponCfg.bladeLength)) continue;
    const sideError = hand.z + aim.z * distance - local.z, height = hand.y + aim.y * distance;
    if (Math.abs(sideError) > OPPORTUNITY.guardRadius) continue;
    const error = Math.hypot(sideError, height - local.y);
    if (error < bestError) {
      bestError = error;
      best = { hand: hand.toArray(), aim: aim.toArray(), padX: x, padY: y,
        height, worldHeight: height + chest.y, targetHeight: local.y, targetWorldHeight: target.y,
        error: height - local.y, sideError, bladeDistance: distance, insideBlade: true };
    }
  }
  return best;
}
const vectorOf = v => new THREE.Vector3(v.x, v.y, v.z);

function prepared(ai, found, tech) {
  const precise = precisionEnabled(ai.me);
  const chestY = ai.me.bodies.chest.translation().y;
  // The old templates cross an upright opponent's neck/head. This only shifts
  // their hand-plane height toward the observed lower target within the same
  // authored preparation budget as the player. It does not guarantee contact.
  const uprightTarget = chestY + (found.zone === 'head' ? 0.28 : 0.17);
  const crossing = found.kind === 'cut' && neckCrossingTechnique(tech)
    ? opportunityAICrossing(ai, tech, found.target)
    : precise && found.kind === 'blunt' ? opportunityAIBluntReference(ai, tech, found.target) : null;
  if ((found.kind === 'cut' || precise && found.kind === 'blunt') && !crossing) return null;
  let desiredY = 0, desiredPitch = 0;
  if (crossing) {
    const c = ai.me.bodies.chest.translation();
    const local = found.target.clone().sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(ai.me.yaw.clone().invert());
    const hand = new THREE.Vector3(...crossing.hand), aim = new THREE.Vector3(...crossing.aim);
    desiredY = clamp(-crossing.error * 0.55, -OPPORTUNITY.handHeightBudget, OPPORTUNITY.handHeightBudget);
    const pitch = Math.atan2(aim.y, Math.hypot(aim.x, aim.z));
    const wanted = Math.atan2(local.y - hand.y - desiredY, Math.hypot(local.x - hand.x, local.z - hand.z));
    desiredPitch = clamp(wanted - pitch, -OPPORTUNITY.pitchBudget, OPPORTUNITY.pitchBudget);
    const corrected = applyOpportunityElevation(aim.clone(), desiredPitch);
    crossing.desiredWorldHeight = chestY + hand.y + desiredY + corrected.y * (local.x - hand.x) / corrected.x;
    crossing.desiredError = crossing.desiredWorldHeight - found.target.y;
  }
  const pathGoal = precise && crossing ? opportunityPathGoal(ai.me, found.target, crossing) : null;
  if (precise && crossing && !pathGoal) return null;
  if (pathGoal) { desiredY = pathGoal.handY; desiredPitch = pathGoal.pitch; }
  return {
    ...found, target: found.target.clone(), episode: ai.opportunityState.episode,
    observedAt: ai.opportunitySeen.t, started: false,
    // Explicit Skill.thrust already aims at the fixed world target. Lowering
    // its hand-map preparation too would apply the same height change twice.
    padY: found.kind === 'blunt' && !precise ? clamp((found.target.y - uprightTarget) * OPPORTUNITY_AI.padHeightScale,
      -OPPORTUNITY.handHeightBudget, OPPORTUNITY.handHeightBudget) : 0,
    desiredY, desiredPitch,
    crossing,
    ...(precise ? { pathObservation: pathGoal?.observation ?? null } : {}),
    lateral: ai.foeLat,
  };
}

export function prepareOpportunityAttack(ai, tech) {
  const found = opportunityCandidate(ai, tech);
  ai.opportunityAttack = found ? prepared(ai, found, tech) : null;
  return ai.opportunityAttack;
}

/** Recheck while chambering only. After strike start the target and both path
 * corrections are fixed; a moving defender is allowed to escape or block. */
export function refreshOpportunityAttack(ai) {
  const old = ai.opportunityAttack;
  if (!old || old.started) return true;
  const found = opportunityCandidate(ai, ai.tech);
  if (!found || found.targetId !== old.targetId || ai.opportunityState.episode !== old.episode) return false;
  const next = prepared(ai, found, ai.tech);
  if (!next) return false;
  ai.opportunityAttack = next;
  return true;
}

export function commitOpportunityAttack(ai) {
  if (!ai.opportunityAttack) return true;
  if (ai.opportunityAttack.started) return true;
  if (!refreshOpportunityAttack(ai)) return false;
  if (opportunityRangeAttack(ai)) {
    const range = measureThrustDistance(ai.me, ai.opportunityAttack.target);
    if (!range.valid || !range.ready || !range.aligned) return false;
  }
  ai.opportunityAttack.started = true;
  ai.opportunityAttack.handY = ai.opportunityCommand?.handY ?? 0;
  ai.opportunityAttack.pitch = ai.opportunityCommand?.pitch ?? 0;
  const c = ai.opportunityAttack.crossing;
  if (c) {
    const aim = applyOpportunityElevation(new THREE.Vector3(...c.aim), ai.opportunityAttack.pitch);
    const forward = c.bladeDistance * c.aim[0];
    c.committedWorldHeight = c.worldHeight - c.height + c.hand[1] + ai.opportunityAttack.handY + aim.y * forward / aim.x;
    c.committedError = c.committedWorldHeight - c.targetWorldHeight;
  }
  ai.opportunityState.attempts++;
  ai.stats.opportunityAttacks = (ai.stats.opportunityAttacks ?? 0) + 1;
  return true;
}

export function opportunityPad(ai, point) {
  if (!ai.opportunityAttack) return point;
  // Lowering an existing windup can move it outside the actual hand disk.
  // Keep both preparation and strike points reachable, like moveHand does.
  return offsetPad(point, ai.opportunityAttack.padY);
}

/** One update per AI step; only preparation ramps toward the selected plane.
 * A committed attack freezes actual offsets, and clearing it ramps to zero. */
export function advanceOpportunityAICommand(ai, dt) {
  if (!enabled(ai.me) || !(dt > 0)) return;
  const state = ai.opportunityCommand ||= { handY: 0, pitch: 0 };
  const lock = ai.opportunityAttack;
  const usable = ai.mode === 'attack' && ai.me.alive && ai.me.armed && !ai.me.weaponBroken &&
    ['stand', 'kneel'].includes(ai.me.state) && !ai.me.skill.tap && !(ai.me.finish?.amt > 0) &&
    (lock?.kind === 'cut' || precisionEnabled(ai.me) && lock?.kind === 'blunt');
  if (usable && lock.started) {
    state.handY = lock.handY;
    state.pitch = lock.pitch;
    return;
  }
  let targetY = usable ? lock.desiredY : 0, targetPitch = usable ? lock.desiredPitch : 0;
  if (usable && precisionEnabled(ai.me)) {
    const goal = opportunityPathGoal(ai.me, lock.target, lock.crossing);
    lock.pathObservation = goal?.observation ?? null;
    targetY = goal?.handY ?? 0; targetPitch = goal?.pitch ?? 0;
  }
  state.handY += clamp(targetY - state.handY, -OPPORTUNITY.prepareSpeed * dt, OPPORTUNITY.prepareSpeed * dt);
  state.pitch += clamp(targetPitch - state.pitch, -OPPORTUNITY.prepareTurn * dt, OPPORTUNITY.prepareTurn * dt);
}

/** Only resolved muscle commands change. No body, velocity, force, damage or
 * victim query is accessed by these hooks. Explicit thrust/finish owns its
 * complete command and never receives a residual cut overlay. */
function activeCommand(f) {
  return enabled(f) && f.opportunityAI?.me === f && f.alive && f.armed &&
    ['stand', 'kneel'].includes(f.state) && !f.skill.tap && !(f.finish?.amt > 0)
    ? f.opportunityAI.opportunityCommand : null;
}
export function applyOpportunityAIHand(f, hand) {
  const state = activeCommand(f);
  if (state?.handY) hand.y += state.handY;
}
export function applyOpportunityAIAim(f, aim) {
  const state = activeCommand(f);
  if (state?.pitch) applyOpportunityElevation(aim, state.pitch);
}
