/** Read-only observations of the actual one-hand recovery runtime from round creation. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { newRound, CONFIG, DT, THREE, handPos } from '../harness_m.mjs';
import { readMainArmRecovery } from '../../../src/arm_recovery_activation.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const opts = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([^=]+)=(.+)$/.exec(arg);
  if (!match) throw Error('Use --out=NEW_PATH [--weapons=sabre,falchion] [--seeds=7,19] [--seconds=18]');
  return [match[1], match[2]];
}));
if (Object.keys(opts).some(key => !['out', 'weapons', 'seeds', 'seconds'].includes(key))) throw Error('Unknown option');
const output = opts.out;
const weapons = (opts.weapons ?? 'sabre,falchion').split(',');
const seeds = (opts.seeds ?? '7,19').split(',').map(Number);
const seconds = Number(opts.seconds ?? 18);
if (!output || fs.existsSync(output) || weapons.some(weapon => !['sabre', 'falchion'].includes(weapon)) ||
    !weapons.length || new Set(weapons).size !== weapons.length || !seeds.length ||
    seeds.some(seed => !Number.isInteger(seed) || seed < 0) || new Set(seeds).size !== seeds.length ||
    !Number.isFinite(seconds) || seconds < 4.4 || seconds > 24) throw Error('Invalid options or existing output');

const sha = value => createHash('sha256').update(value).digest('hex');
const hash = () => createHash('sha256');
const V = value => new THREE.Vector3(value.x, value.y, value.z);
const Q = value => new THREE.Quaternion(value.x, value.y, value.z, value.w);
const angle = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
const activationEpsilon = 1e-12;
function head() {
  const text = fs.readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim();
  if (!text.startsWith('ref: ')) return text;
  const ref = text.slice(5), loose = path.join(root, '.git', ref);
  const value = fs.existsSync(loose) ? fs.readFileSync(loose, 'utf8').trim() :
    fs.readFileSync(path.join(root, '.git/packed-refs'), 'utf8').split('\n').find(line => line.endsWith(' ' + ref))?.split(' ')[0];
  if (!/^[a-f0-9]{40}$/.test(value ?? '')) throw Error('Cannot identify source HEAD');
  return value;
}
function sourceFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? sourceFiles(directory + '/' + entry.name) : entry.name.endsWith('.js') ? [directory + '/' + entry.name] : []);
}
const files = [...sourceFiles('src'), 'tools/sim/harness_m.mjs',
  'tools/sim/experiments/arm_recovery_from_spawn_probe.mjs', 'package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest = () => Object.fromEntries(files.sort().map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));

// Plain copies exclude engine ownership/pointers and functions; they never change live vectors.
function ownState(object) {
  const omitted = new Set(['f', 'fighter', 'me', 'foe', 'world', 'scene', 'R', 'rb', 'body', 'parent', 'child',
    'joint', 'rawSet', 'raw', '__wbg_ptr', 'info', 'mesh', 'group', 'sword', 'grip', 'colliderSet']);
  const seen = new WeakSet();
  function copy(value, depth = 0) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) };
    if (typeof value !== 'object' || depth > 8 || value.isObject3D || typeof value.isValid === 'function') return undefined;
    if (value.isVector2 || value.isVector3 || value.isQuaternion || value.isEuler) return value.toArray();
    if (seen.has(value)) return { $shared: true };
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => copy(item, depth + 1));
    if (value instanceof Set) return [...value].map(item => copy(item, depth + 1));
    if (value instanceof Map) return [...value].map(([key, item]) => [copy(key, depth + 1), copy(item, depth + 1)]);
    const result = {};
    for (const [key, item] of Object.entries(value)) if (!omitted.has(key)) {
      const plain = copy(item, depth + 1);
      if (plain !== undefined) result[key] = plain;
    }
    return result;
  }
  return copy(object);
}
function control(G, removeMode = false) {
  const player = ownState(G.player);
  if (removeMode) delete player.armRecoveryModel;
  // WeakMap eligibility/value observations are metadata outside this controller digest.
  return { player, enemy: ownState(G.enemy), ai: ownState(G.ai), combat: {
    step: G.combat.stepNo, cuts: ownState(G.combat.cutting), touching: ownState(G.combat.touching),
    cutReactionModel: G.combat.cutReactionModel,
  } };
}
function health(f) {
  return { state: f.state, stateTimeS: f.stateTime, alive: f.alive, armed: f.armed,
    gripValid: !!f.gripJoint?.isValid(), armHealth: f.armHealth, legHealth: f.legHealth,
    limbs: { ...f.limbs }, muscle: f.muscle, vigor: f.vigor, pain: f.pain, blood: f.blood,
    consciousness: f.consciousness, woundCount: f.wounds.length, detached: [...(f.detachedParts ?? [])] };
}
function nativeFinite(G) {
  return G.world.bodies.getAll().every(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()]
    .every(value => Object.values(value).every(Number.isFinite)));
}
function jointGaps(f) {
  const point = (body, local) => V(local).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
  const gaps = [];
  for (const joint of f.joints) if (joint.joint?.isValid() && joint.parent.isValid() && joint.child.isValid()) {
    gaps.push({ name: joint.name, m: point(joint.parent, joint.joint.anchor1()).distanceTo(point(joint.child, joint.joint.anchor2())) });
  }
  if (f.gripJoint?.isValid()) {
    const joint = f.gripJoint;
    gaps.push({ name: 'grip', m: point(joint.body1(), joint.anchor1()).distanceTo(point(joint.body2(), joint.anchor2())) });
  }
  return gaps;
}
function kinetic(body) {
  const omega = V(body.angvel()).applyQuaternion(Q(body.rotation()).multiply(Q(body.principalInertiaLocalFrame())).invert());
  const inertia = body.principalInertia();
  return .5 * body.mass() * V(body.linvel()).lengthSq() +
    .5 * (inertia.x * omega.x ** 2 + inertia.y * omega.y ** 2 + inertia.z * omega.z ** 2);
}
function rawDirection(x, y) {
  const elevation = y <= .1 ? Math.max(-.6, (y - .1) * 1.1) : Math.min(1.75, ((y - .1) / .5) * 1.65);
  const azimuth = THREE.MathUtils.clamp((x - .05) * 1.7, -1.1, 1.3), cosine = Math.cos(elevation);
  return new THREE.Vector3(cosine * Math.cos(azimuth), Math.sin(elevation), cosine * Math.sin(azimuth));
}
function groundContacts(G, f) {
  const contacts = [];
  for (const foot of ['F', 'B']) {
    const body = f.bodies['foot' + foot];
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i);
      G.world.contactPairsWith(collider, other => {
        if (!other.parent()?.isFixed()) return;
        G.world.contactPair(collider, other, manifold => {
          let normalImpulseNs = 0;
          for (let j = 0; j < manifold.numContacts(); j++) normalImpulseNs += manifold.contactImpulse(j);
          const points = [];
          for (let j = 0; j < manifold.numSolverContacts(); j++) {
            const point = manifold.solverContactPoint(j), velocity = body.velocityAtPoint(point);
            points.push({ pointM: [point.x, point.y, point.z], distanceM: manifold.solverContactDist(j),
              horizontalMps: Math.hypot(velocity.x, velocity.z) });
          }
          contacts.push({ foot, normalImpulseNs, points });
        });
      });
    }
  }
  return contacts;
}

const high = [.02, .52], low = [.02, -.45], left = [-.42, .03], right = [.42, .03];
const mix = (a, b, fraction) => a.map((value, index) => value + (b[index] - value) * fraction);
function pose(time) {
  const t = time % 4.4;
  if (t < .6) return { offset: high, write: true, held: true, phase: 'guard' };
  if (t < 1.15) return { offset: mix(high, low, (t - .6) / .55), write: true, held: true, phase: 'down' };
  if (t < 1.55) return { offset: low, write: false, held: false, phase: 'release' };
  if (t < 2.1) return { offset: mix(low, high, (t - 1.55) / .55), write: true, held: true, phase: 'up' };
  if (t < 2.45) return { offset: mix(high, left, (t - 2.1) / .35), write: true, held: true, phase: 'prepare_cross' };
  if (t < 3) return { offset: mix(left, right, (t - 2.45) / .55), write: true, held: true, phase: 'cross' };
  if (t < 3.6) return { offset: right, write: false, held: true, phase: 'hold' };
  return { offset: mix(right, high, (t - 3.6) / .8), write: true, held: true, phase: 'reinput' };
}
const schedule = [];
let previousOffset = [...high], intendedOffset = [...high];
for (let tick = 0; tick < Math.round(seconds / DT); tick++) {
  const timeS = tick * DT, request = pose(timeS);
  const deltaM = request.write ? request.offset.map((value, index) => value - previousOffset[index]) : [0, 0];
  previousOffset = [...request.offset];
  intendedOffset = intendedOffset.map((value, index) => value + deltaM[index]);
  schedule.push({ tick, timeS, phase: request.phase, held: request.held,
    active: Math.abs(deltaM[0]) + Math.abs(deltaM[1]) > 1e-5, deltaM,
    intendedOffsetM: [...intendedOffset], move: [0, timeS < 2 ? .25 : timeS % 4.4 < .6 ? .08 : 0],
    tap: [2.2, 6.6, 11, 15.4, 19.8].some(time => Math.abs(timeS - time) < DT / 2) });
}
const requestedScheduleSha256 = sha(JSON.stringify(schedule));
const originalRandom = Math.random;
const originalConfig = { grip: CONFIG.GRIP.reactionModel, support: CONFIG.BODY.supportModel,
  stance: CONFIG.GAIT.stanceMemory, assist: CONFIG.GAIT.assist, catchMode: CONFIG.GAIT.catchMode, catchScale: CONFIG.GAIT.catchScale };
const sourceBefore = manifest(), sourceCommit = head(), begin = performance.now();

function run(weapon, seed, mode, observed) {
  let G;
  const started = performance.now(), events = [], traceFrames = [], metrics = [], taps = [], transitions = [];
  const nativeTrace = hash(), fullControllerTrace = hash(), physicalControllerTrace = hash(), appliedInputTrace = hash();
  let beforeStrike = null, previousState = 'stand', firstGetup = null, firstExtraArmActivation = null;
  let firstArmWound = null, firstDeath = null, firstDrop = null, stopReason = 'fixed_horizon';
  try {
    CONFIG.GRIP.reactionModel = 'paired'; CONFIG.BODY.supportModel = 'legacy'; CONFIG.GAIT.stanceMemory = 'legacy';
    CONFIG.GAIT.assist = .3; CONFIG.GAIT.catchMode = 'on'; CONFIG.GAIT.catchScale = 1;
    G = newRound({ seed, walls: false, weapon, weapon2: 'longsword', gap: 1.85, skill: 0, difficulty: 'normal',
      onFighter(fighter) { if (fighter.index === 0 && mode === 'independent') fighter.armRecoveryModel = 'independent'; } });
    const f = G.player;
    if (f.weaponCfg.twoHand || G.t !== 0 || G.enemy.armRecoveryModel !== undefined) throw Error('Spawn scope violated');
    f.skill.autoGuard = false; f.armTorqueModel = G.enemy.armTorqueModel = 'legacy'; f.edgeTorqueModel = 'legacy';
    G.combat.cutReactionModel = 'legacy';
    f.handOffset.set(...high);
    for (const key of ['prev', 'aim', 'aimRaw', 'anchor']) f.skill[key].set(...high);
    f.skill.aimVel.set(0, 0); f.skill.vel.set(0, 0); f.skill.follow.set(0, 0); f.handHeld = true; f.inputActive = false;
    const first = { timeS: G.t, nativeSha256: sha(G.world.takeSnapshot()),
      fullControllerSha256: sha(JSON.stringify(control(G))), physicalControllerSha256: sha(JSON.stringify(control(G, true))),
      modeOwn: Object.hasOwn(f, 'armRecoveryModel'), mode: f.armRecoveryModel ?? 'legacy', enemyModeOwn: Object.hasOwn(G.enemy, 'armRecoveryModel'),
      weapon: f.weapon.id, twoHand: f.weaponCfg.twoHand, cut: G.combat.cutReactionModel,
      arm: f.armTorqueModel, edge: f.edgeTorqueModel, support: CONFIG.BODY.supportModel, stance: CONFIG.GAIT.stanceMemory,
      level: f.skill.level, autoGuard: f.skill.autoGuard };
    const strike = G.combat.strike;
    G.combat.strike = function (...args) {
      const previous = beforeStrike;
      beforeStrike = health(args[0].v.fighter);
      try { return strike.apply(this, args); } finally { beforeStrike = previous; }
    };
    const wound = G.combat.hooks.onWound;
    G.combat.hooks.onWound = function (attacker, victim, result, point, pair) {
      wound?.(attacker, victim, result, point, pair);
      const event = { id: events.length, kind: 'strike', timeS: G.t, afterStepTimeS: G.t + DT,
        attacker: attacker.index, victim: victim.index, part: pair.v.part,
        result: ownState(result), pointM: [point.x, point.y, point.z], before: beforeStrike, after: health(victim) };
      events.push(event);
      if (!firstArmWound && victim.index === 0 && ['uarmS', 'farmS'].includes(pair.v.part) &&
          beforeStrike && beforeStrike.armHealth > victim.armHealth + 1e-9) firstArmWound = event;
    };
    const clash = G.combat.hooks.onClash;
    G.combat.hooks.onClash = function (...args) {
      clash?.(...args);
      events.push({ id: events.length, kind: 'clash', timeS: G.t, afterStepTimeS: G.t + DT, speedMps: args[1], info: ownState(args[2]) });
    };
    let appliedRequest;
    G.before = () => {
      const tick = Math.round(G.t / DT), request = schedule[tick];
      if (!request) throw Error('Schedule exhausted');
      f.handOffset.x += request.deltaM[0]; f.handOffset.y += request.deltaM[1];
      f.move.set(...request.move); f.stickX = request.move[0]; f.stickY = request.move[1];
      f.handHeld = request.held; f.inputActive = request.active;
      const pad = f.handOffset.toArray();
      const actualRequest = { ...request, held: f.handHeld, active: f.inputActive, move: f.move.toArray() };
      appliedRequest = { request: actualRequest, appliedOffsetM: pad };
      appliedInputTrace.update(JSON.stringify(appliedRequest));
      if (request.tap) taps.push({ timeS: G.t, accepted: f.skill.thrust(), health: health(f) });
    };
    for (let tick = 0; tick < schedule.length; tick++) {
      if (!f.alive || !G.enemy.alive) { stopReason = 'first_fighter_death'; break; }
      const stateBefore = f.state;
      G.step();
      if (!nativeFinite(G)) throw Error('Nonfinite native state');
      const native = sha(G.world.takeSnapshot()), fullController = sha(JSON.stringify(control(G)));
      const physicalController = sha(JSON.stringify(control(G, true))), eventsPrefix = sha(JSON.stringify(events));
      nativeTrace.update(native); fullControllerTrace.update(fullController); physicalControllerTrace.update(physicalController);
      const traceFrame = { tick, timeS: G.t, nativeSha256: native, fullControllerSha256: fullController,
        physicalControllerSha256: physicalController, requestSha256: sha(JSON.stringify(appliedRequest.request)),
        plannedRequestSha256: sha(JSON.stringify(schedule[tick])),
        appliedInputPrefixSha256: appliedInputTrace.copy().digest('hex'), appliedOffsetM: appliedRequest.appliedOffsetM,
        eventsPrefixSha256: eventsPrefix, playerStateBefore: stateBefore, playerStateAfter: f.state,
        playerAlive: f.alive, enemyAlive: G.enemy.alive, playerArmed: f.armed, playerGripValid: !!f.gripJoint?.isValid() };
      traceFrames.push(traceFrame);
      if (f.state !== previousState) transitions.push({ timeS: G.t, before: previousState, after: f.state });
      if (!firstGetup && f.state === 'getup') firstGetup = { ...traceFrame, health: health(f) };
      previousState = f.state;
      if (!firstDeath && (!f.alive || !G.enemy.alive)) firstDeath = { timeS: G.t, player: health(f), enemy: health(G.enemy) };
      if (!firstDrop && !f.armed) firstDrop = { timeS: G.t, health: health(f) };
      if (!observed) continue;
      const activation = readMainArmRecovery(f), extraArmActivation = activation.value - f.muscle;
      if (!firstExtraArmActivation && extraArmActivation > activationEpsilon) {
        firstExtraArmActivation = { ...traceFrame, activation, bodyMuscle: f.muscle, extraArmActivation, health: health(f) };
      }
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword.rotation())), omega = V(f.sword.angvel());
      const gaps = jointGaps(f), support = groundContacts(G, f);
      metrics.push({ tick, timeS: G.t, phase: schedule[tick].phase, health: health(f), enemyHealth: health(G.enemy),
        armActivation: activation, extraArmActivation, handErrorM: handPos(f).distanceTo(f.handTarget),
        ownAimErrorRad: angle(axis, f.debug.aim.clone().normalize()),
        externalRawAimErrorRad: angle(axis, rawDirection(...schedule[tick].intendedOffsetM).applyQuaternion(f.yaw)),
        swordOmegaRadps: omega.length(),
        swordTwistRadps: Math.abs(omega.dot(axis)), swordKJ: kinetic(f.sword),
        bodyAndSwordKJ: kinetic(f.sword) + Object.values(f.bodies).reduce((sum, body) => sum + kinetic(body), 0),
        actualHandWorldM: handPos(f).toArray(), handTargetWorldM: f.handTarget.toArray(),
        gaps, maxGapM: Math.max(0, ...gaps.map(gap => gap.m)), pelvisM: V(f.bodies.pelvis.translation()).toArray(),
        pelvisVelocityMps: V(f.bodies.pelvis.linvel()).toArray(), support,
        footMemory: Object.fromEntries(Object.entries(f.gait.legs).map(([key, leg]) => [key, { N: leg.N ?? null, Nf: leg.Nf ?? null, stance: leg.stance }])) });
    }
    if (firstDeath) stopReason = 'first_fighter_death';
    const subsequentContact = firstExtraArmActivation ? events.find(event => event.afterStepTimeS > firstExtraArmActivation.timeS + 1e-10) ?? null : null;
    const recoveryExposureSteps = metrics.filter(row => row.health.alive && row.health.armed &&
      row.health.state === 'getup' && row.health.armHealth < 1 && row.extraArmActivation > activationEpsilon).length;
    return { weapon, seed, mode, observed, requestedScheduleSha256, first, firstGetup, firstExtraArmActivation,
      firstArmWound, firstDeath, firstDrop, subsequentContact, recoveryExposureSteps, stopReason,
      durationS: G.t, finite: true, wallSeconds: (performance.now() - started) / 1000,
      nativeTraceSha256: nativeTrace.digest('hex'), fullControllerTraceSha256: fullControllerTrace.digest('hex'),
      physicalControllerTraceSha256: physicalControllerTrace.digest('hex'), appliedInputSha256: appliedInputTrace.digest('hex'),
      eventsSha256: sha(JSON.stringify(events)), events, taps, transitions, traceFrames, metrics,
      final: { player: health(f), enemy: health(G.enemy) } };
  } finally {
    G?.eventQueue.free(); G?.world.free(); Math.random = originalRandom;
    CONFIG.GRIP.reactionModel = originalConfig.grip; CONFIG.BODY.supportModel = originalConfig.support;
    CONFIG.GAIT.stanceMemory = originalConfig.stance; CONFIG.GAIT.assist = originalConfig.assist;
    CONFIG.GAIT.catchMode = originalConfig.catchMode; CONFIG.GAIT.catchScale = originalConfig.catchScale;
  }
}

const rows = [], pairedChecks = [], observerChecks = [];
let error = null;
try {
  for (const weapon of weapons) for (const seed of seeds) for (const mode of ['legacy', 'independent']) {
    const row = run(weapon, seed, mode, true); rows.push(row);
    console.log(JSON.stringify({ weapon, seed, mode, observed: true, durationS: row.durationS, stopReason: row.stopReason,
      firstArmWoundS: row.firstArmWound?.afterStepTimeS ?? null, firstGetupS: row.firstGetup?.timeS ?? null,
      firstExtraActivationS: row.firstExtraArmActivation?.timeS ?? null, exposureSteps: row.recoveryExposureSteps }));
  }
  for (const weapon of weapons) for (const seed of seeds) {
    const a = rows.find(row => row.weapon === weapon && row.seed === seed && row.mode === 'legacy');
    const b = rows.find(row => row.weapon === weapon && row.seed === seed && row.mode === 'independent');
    const sharedTicks = Math.min(a.traceFrames.length, b.traceFrames.length), common = Array.from({ length: sharedTicks }, (_, i) => i);
    const firstDifference = common.find(i => a.traceFrames[i].nativeSha256 !== b.traceFrames[i].nativeSha256 ||
      a.traceFrames[i].physicalControllerSha256 !== b.traceFrames[i].physicalControllerSha256 ||
      a.traceFrames[i].eventsPrefixSha256 !== b.traceFrames[i].eventsPrefixSha256);
    const contactDifference = common.find(i => a.traceFrames[i].eventsPrefixSha256 !== b.traceFrames[i].eventsPrefixSha256);
    const stateDifference = common.find(i => a.traceFrames[i].playerStateBefore !== b.traceFrames[i].playerStateBefore ||
      a.traceFrames[i].playerStateAfter !== b.traceFrames[i].playerStateAfter);
    const beforeEffectS = b.firstExtraArmActivation?.timeS ?? Infinity;
    const prefix = common.filter(i => a.traceFrames[i].timeS < beforeEffectS - 1e-10);
    const firstDropS = Math.min(a.firstDrop?.timeS ?? Infinity, b.firstDrop?.timeS ?? Infinity);
    const deathS = Math.min(a.firstDeath?.timeS ?? Infinity, b.firstDeath?.timeS ?? Infinity);
    const commonAliveArmedWindowEndS = Math.min(a.durationS, b.durationS, deathS, firstDropS);
    const firstUnequalContactS = contactDifference === undefined ? null : a.traceFrames[contactDifference].timeS;
    const firstUnequalStateS = stateDifference === undefined ? null : a.traceFrames[stateDifference].timeS;
    pairedChecks.push({ weapon, seed, initialNativeExact: a.first.nativeSha256 === b.first.nativeSha256,
      initialPhysicalControllerExact: a.first.physicalControllerSha256 === b.first.physicalControllerSha256,
      requestedScheduleExact: a.requestedScheduleSha256 === b.requestedScheduleSha256,
      actualRequestedCommonPrefixExact: common.every(i => a.traceFrames[i].requestSha256 === b.traceFrames[i].requestSha256),
      actualRequestedMatchesPlan: common.every(i => a.traceFrames[i].requestSha256 === a.traceFrames[i].plannedRequestSha256 &&
        b.traceFrames[i].requestSha256 === b.traceFrames[i].plannedRequestSha256),
      actualPadCommonPrefixExact: common.every(i => JSON.stringify(a.traceFrames[i].appliedOffsetM) === JSON.stringify(b.traceFrames[i].appliedOffsetM)),
      beforeEffectPrefixTicks: prefix.length,
      beforeEffectNativeExact: prefix.every(i => a.traceFrames[i].nativeSha256 === b.traceFrames[i].nativeSha256),
      beforeEffectPhysicalControllerExact: prefix.every(i => a.traceFrames[i].physicalControllerSha256 === b.traceFrames[i].physicalControllerSha256),
      beforeEffectEventsExact: prefix.every(i => a.traceFrames[i].eventsPrefixSha256 === b.traceFrames[i].eventsPrefixSha256),
      firstDifferenceS: firstDifference === undefined ? null : a.traceFrames[firstDifference].timeS,
      firstUnequalRecordedContactS: firstUnequalContactS, firstUnequalStateS,
      firstArmWoundExact: !!a.firstArmWound && !!b.firstArmWound && JSON.stringify(a.firstArmWound) === JSON.stringify(b.firstArmWound),
      commonEffectWindowStartS: b.firstExtraArmActivation?.timeS ?? null,
      commonEffectWindowEndS: Math.min(commonAliveArmedWindowEndS, firstUnequalContactS ?? Infinity, firstUnequalStateS ?? Infinity),
      commonAliveWindowEndS: Math.min(a.durationS, b.durationS, deathS),
      commonAliveArmedWindowEndS,
      commonWoundedRecoveryExtraExposureS: b.metrics.filter(row => row.timeS < commonAliveArmedWindowEndS - 1e-10 &&
        row.health.alive && row.health.armed && row.health.state === 'getup' && row.health.armHealth < 1 && row.extraArmActivation > activationEpsilon).length * DT,
      commonHoldReleaseExposureS: b.metrics.filter(row => row.timeS < commonAliveArmedWindowEndS - 1e-10 &&
        ['hold', 'release'].includes(row.phase)).length * DT,
      coverage: b.recoveryExposureSteps > 0 ? 'actual_wounded_recovery_exposed' : 'incomplete_no_actual_wounded_recovery_exposure' });
  }
  const exposed = rows.find(row => row.mode === 'independent' && row.recoveryExposureSteps > 0) ?? rows.find(row => row.mode === 'independent');
  for (const mode of ['legacy', 'independent']) {
    const a = rows.find(row => row.weapon === exposed.weapon && row.seed === exposed.seed && row.mode === mode);
    const b = run(a.weapon, a.seed, mode, false); rows.push(b);
    observerChecks.push({ weapon: a.weapon, seed: a.seed, mode,
      initialNativeExact: a.first.nativeSha256 === b.first.nativeSha256,
      nativeTraceExact: a.nativeTraceSha256 === b.nativeTraceSha256,
      fullControllerTraceExact: a.fullControllerTraceSha256 === b.fullControllerTraceSha256,
      physicalControllerTraceExact: a.physicalControllerTraceSha256 === b.physicalControllerTraceSha256,
      requestedScheduleExact: a.requestedScheduleSha256 === b.requestedScheduleSha256,
      appliedInputExact: a.appliedInputSha256 === b.appliedInputSha256,
      eventsExact: a.eventsSha256 === b.eventsSha256, durationExact: a.durationS === b.durationS });
    console.log(JSON.stringify({ weapon: b.weapon, seed: b.seed, mode, observed: false, durationS: b.durationS,
      stopReason: b.stopReason, observerCheck: observerChecks.at(-1) }));
  }
} catch (failure) { error = failure.stack; }
const sourceAfter = manifest(), sourceCommitAfter = head();
const sourceStable = sourceCommit === sourceCommitAfter && JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
const pairGuardKeys = ['initialNativeExact', 'initialPhysicalControllerExact', 'requestedScheduleExact', 'actualRequestedCommonPrefixExact', 'actualRequestedMatchesPlan',
  'beforeEffectNativeExact', 'beforeEffectPhysicalControllerExact', 'beforeEffectEventsExact'];
const measurementValid = !error && sourceStable && rows.length === weapons.length * seeds.length * 2 + 2 &&
  pairedChecks.every(check => pairGuardKeys.every(key => check[key] === true)) &&
  observerChecks.length === 2 && observerChecks.every(check => Object.values(check).every(value => value !== false));
const report = { schemaVersion: 1, probe: 'arm_recovery_from_spawn', sourceCommit, sourceCommitAfter, sourceBefore, sourceAfter,
  sourceStable, command: process.argv, createdUTC: new Date().toISOString(), wallSeconds: (performance.now() - begin) / 1000,
  measurementValid, executionCount: rows.length, error, schedule, requestedScheduleSha256, pairedChecks, observerChecks, rows,
  protocol: { weapons, seeds, seconds, modes: ['legacy', 'independent'], activationEpsilon,
    initialization: 'Actual Fighter/newRound; onFighter sets independent only on the newly created player before any G.step. Legacy has no own mode flag. Enemy retains normal AI and current runtime. No source transforms or controller clones.',
    settings: 'paired grip, legacy support/stance/arm/edge/cutting, assist .3/catch on/1, correction0/autoGuardfalse, enemy normal longsword, gap1.85m, no walls',
    input: 'Identical complete physics-clock delta/held/movement/tap schedule; no injury-triggered rescheduling. Actual pad and accepted taps are recorded separately from requested inputs.',
    observations: 'Hash/event/input recorder is present in both observer modes. Optional post-step helper/kinetic/contact/hand/gap reads are enabled only in observed runs. Original Combat strike and hooks execute once. No AI freeze, parking, wound/health or native pose/velocity injection.',
    controllerScope: 'Physical controller digest removes only player.armRecoveryModel; all other serialized controller fields remain. WeakMap eligibility/value metadata is outside this digest. Full controller equality is required only for same-mode observer repeats.',
    targetScope: 'handErrorM compares actual hand with the current runtime handTarget. ownAimErrorRad compares actual sword axis with the current filtered runtime aim. externalRawAimErrorRad uses the independent fixed input schedule and the existing raw mapping/yaw; these goals are recorded separately and are not interchangeable. Actual pad may differ after controller/contact divergence even when requested delta schedules are identical.',
    lifecycle: 'Stops at first fighter death or fixed horizon. Sword controllability comparisons are limited to the common alive+armed window; detached sword and post-drop states are separate. Report shared window lengths and censor inadequate recovery/hold exposure.',
    interpretation: 'Initial and pre-effect common-prefix equality are causal gates; later reactive AI/contact/wound divergence is a regression comparison, not same-hit efficacy. Contact-event comparisons cover recorded strike/clash callbacks, not persistent solver contacts. Contact data is last-solver-substep geometry/impulse, not complete COP or native work. K is state energy, not muscle work. A few exposed steps or no actual wounded getup cannot establish efficacy. Measurement validity does not authorize public release or general promotion.' } };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, measurementValid, executionCount: rows.length, sourceStable, error,
  coverage: pairedChecks.map(check => ({ weapon: check.weapon, seed: check.seed, coverage: check.coverage })), wallSeconds: report.wallSeconds }));
if (!measurementValid) process.exitCode = 1;
