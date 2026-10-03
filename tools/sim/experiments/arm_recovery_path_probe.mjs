/** Same actual wounded-recovery prefix; research-only, temporary activation-route ablations. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { newRound, CONFIG, DT, THREE, handPos } from '../harness_m.mjs';
import { mainArmMuscle, readMainArmRecovery } from '../../../src/arm_recovery_activation.js';
import { beforeWristResponse, afterWristResponse, elbowResponse } from './derive_wrist_response.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const opts = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([^=]+)=(.+)$/.exec(arg);
  if (!match) throw Error('Use --out=NEW_PATH --reference=FROM_SPAWN_RAW');
  return [match[1], match[2]];
}));
if (Object.keys(opts).some(key => !['out', 'reference', 'case', 'response', 'audio-reference'].includes(key))) throw Error('Unknown option');
const output = opts.out, referencePath = opts.reference;
if (!output || fs.existsSync(output) || !referencePath || !fs.existsSync(referencePath)) throw Error('New output and received reference required');
const scene = opts.case ?? 'wounded';
if (!['wounded', 'healthyStop'].includes(scene)) throw Error('Unknown diagnostic case');
const responseMode = opts.response === 'derived';
if ((opts.response && !responseMode) || (responseMode && scene !== 'healthyStop')) throw Error('Derived response is restricted to healthyStop');
const weapon = scene === 'wounded' ? 'falchion' : 'sabre', seed = scene === 'wounded' ? 7 : 19;
const seconds = 18, windowSteps = 60;
const modes = scene === 'wounded' ? ['full', 'swordOrdinary', 'jointsOrdinary', 'allOrdinary'] : ['full', 'allOrdinary'];
const observerModes = scene === 'wounded' || responseMode ? ['full', 'allOrdinary'] : [];
const referenceBytes = fs.readFileSync(referencePath);
const reference = JSON.parse(referenceBytes);
const referenceRun = reference.rows.find(row => row.weapon === weapon && row.seed === seed && row.mode === 'independent' && row.observed);
if (!reference.measurementValid || !referenceRun) throw Error('A valid original independent reference is required');
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
  'tools/sim/experiments/arm_recovery_from_spawn_probe.mjs',
  'tools/sim/experiments/arm_recovery_path_probe.mjs', 'tools/sim/experiments/derive_wrist_response.mjs', 'package-lock.json',
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
const referenceSourceExact = Object.entries(reference.sourceBefore).every(([file, digest]) => sourceBefore[file] === digest);
const referenceSourceDifferences = Object.entries(reference.sourceBefore).filter(([file, digest]) => sourceBefore[file] !== digest);
let audioCompatibility = null;
if (opts['audio-reference']) {
  const commit = opts['audio-reference'];
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Explicit audio-only reference commit must be a full SHA');
  const expected = ['src/slash_draw.js', 'src/sound.js'];
  const changed = execFileSync('git', ['diff', '--name-only', commit + '^', commit, '--', 'src'], { cwd: root, encoding: 'utf8' }).trim().split('\n').sort();
  if (JSON.stringify(changed) !== JSON.stringify(expected)) throw Error('Reference commit is not strictly the two audio files');
  if (JSON.stringify(referenceSourceDifferences.map(([file]) => file).sort()) !== JSON.stringify(expected)) throw Error('Non-audio reference source drift');
  const differences = referenceSourceDifferences.map(([file, referenceHash]) => {
    const audioCommitHash = sha(execFileSync('git', ['show', commit + ':' + file], { cwd: root }));
    if (sourceBefore[file] !== audioCommitHash) throw Error('Current audio differs from the declared delivery commit');
    return { file, referenceHash, audioCommitHash, currentHash: sourceBefore[file] };
  });
  audioCompatibility = { commit, differences, nonAudioReferenceFilesExact: true };
}
const referenceSourceCompatible = referenceSourceExact || !!audioCompatibility;
if (!referenceSourceCompatible || sha(referenceBytes) !== '5c7df8c24ac3165815b2591578302807f1f8bcfa6c77cd0280851d5f7126c1d1')
  throw Error('Received original raw or its core/engine/probe source hashes differ');

function run(weapon, seed, mode, observed) {
  let branch = null, actuator = null;
  let previousAimYaw = null;
  let torqueRows = [], motorRows = [], dispatchRows = [], shoulderRequests = [];
  let stepDispatch = {};
  const restores = [], dispatchCounts = { driveSword: 0, driveJoints: 0, elbowGravity: 0 };
  let G;
  const started = performance.now(), events = [], traceFrames = [], metrics = [], taps = [], transitions = [];
  const nativeTrace = hash(), fullControllerTrace = hash(), physicalControllerTrace = hash(), appliedInputTrace = hash();
  let beforeStrike = null, previousState = 'stand', firstGetup = null, firstExtraArmActivation = null;
  let firstArmWound = null, firstDeath = null, firstDrop = null, stopReason = 'fixed_horizon';
  try {
    CONFIG.GRIP.reactionModel = 'paired'; CONFIG.BODY.supportModel = 'legacy'; CONFIG.GAIT.stanceMemory = 'legacy';
    CONFIG.GAIT.assist = .3; CONFIG.GAIT.catchMode = 'on'; CONFIG.GAIT.catchScale = 1;
    G = newRound({ seed, walls: false, weapon, weapon2: 'longsword', gap: 1.85, skill: 0, difficulty: 'normal',
      onFighter(fighter) { if (fighter.index === 0) fighter.armRecoveryModel = 'independent'; } });
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
    // All branches execute the original methods exactly once. No transformed Fighter,
    // state restore, pose/velocity/health edit or AI freeze is used.
    for (const name of ['driveSword', 'driveJoints', 'elbowGravity']) {
      const original = f[name];
      f[name] = function (...args) {
        const previousActuator = actuator, previousMode = this.armRecoveryModel;
        const filterBefore = readMainArmRecovery(this);
        const routed = !!branch && (mode === 'allOrdinary' ||
          (mode === 'swordOrdinary' && name === 'driveSword') ||
          (mode === 'jointsOrdinary' && name !== 'driveSword'));
        actuator = name;
        if (routed) this.armRecoveryModel = 'legacy';
        const consumedActivation = mainArmMuscle(this);
        const gate = name === 'driveJoints' ? null : consumedActivation >= .12;
        const previousAim = this.prevAim?.toArray() ?? null;
        const responseBefore = responseMode && observed && branch && name === 'driveSword' && gate && this.armed
          ? beforeWristResponse(this, previousAimYaw) : null;
        let restoredFilterExact = false;
        try {
          return original.apply(this, args);
        } finally {
          this.armRecoveryModel = previousMode;
          actuator = previousActuator;
          restoredFilterExact = JSON.stringify(readMainArmRecovery(this)) === JSON.stringify(filterBefore);
          if (!restoredFilterExact) throw Error('Temporary routing changed the persistent activation filter');
          const response = responseBefore ? afterWristResponse(this, responseBefore, consumedActivation) : null;
          if (responseMode && observed && name === 'driveSword' && gate && this.armed) previousAimYaw = this.yaw.toArray();
          if (branch) {
            dispatchCounts[name]++;
            stepDispatch[name] = (stepDispatch[name] ?? 0) + 1;
            if (observed) dispatchRows.push({ method: name, routed, consumedActivation,
              ordinaryActivation: this.muscle, independentActivation: filterBefore.value,
              muscleGateAt012: gate, restoredFilterExact, filterTarget: filterBefore.target,
              previousAim, currentAim: this.debug.aim.toArray(),
              wristHill: this.wristHill ?? null, wristBrake: this.wristBrake ?? false,
              wristBrakeAng: this.wristBrakeAng ?? null, ...(responseMode ? { derivedResponse: response } : {}) });
          }
        }
      };
      restores.push(() => { delete f[name]; });
    }
    // Observe actual post-cap/post-twist torque calls, not debug.wristTorque.
    if (observed) {
      const manual = f.manualMuscle;
      f.manualMuscle = function (joint, k, d, maxT) {
        if (branch && joint.name === 'uarmS') shoulderRequests.push({ joint: joint.name,
          k, d, maxTorqueRequestNm: maxT, targetQuaternion: joint.target.toArray() });
        return manual.call(this, joint, k, d, maxT);
      };
      restores.push(() => { delete f.manualMuscle; });
      for (const [part, body] of [...Object.entries(f.bodies), ['sword', f.sword]]) {
        const original = body.addTorque;
        body.addTorque = function (torque, wake) {
          if (branch && actuator) {
            const omega = this.angvel();
            torqueRows.push({ actuator, part, torqueNm: [torque.x, torque.y, torque.z],
              preSolverOmegaRadps: [omega.x, omega.y, omega.z],
              instantaneousPowerW: torque.x * omega.x + torque.y * omega.y + torque.z * omega.z });
          }
          return original.call(this, torque, wake);
        };
        restores.push(() => { delete body.addTorque; });
      }
      const raw = f.jointByName.farmS.joint.rawSet, original = raw.jointConfigureMotor;
      raw.jointConfigureMotor = function (...args) {
        const joint = f.joints.find(j => j.joint?.isValid() && j.joint.handle === args[0]);
        if (branch && actuator === 'driveJoints' && joint?.name === 'farmS')
          motorRows.push({ joint: joint.name, axis: args[1], targetPositionRad: args[2],
            targetVelocityRadps: args[3], stiffness: args[4], damping: args[5] });
        return original.apply(this, args);
      };
      restores.push(() => { delete raw.jointConfigureMotor; });
    }
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
      const activationBefore = readMainArmRecovery(f), nextRequest = schedule[tick];
      if (!branch && (scene === 'healthyStop' || firstArmWound) && f.state === 'getup' && f.armed && f.gripJoint?.isValid() &&
          activationBefore.value - f.muscle > 1e-4 && nextRequest.held && !nextRequest.active &&
          appliedRequest?.request.active) {
        branch = { tick, timeS: G.t, nativeSha256: sha(G.world.takeSnapshot()),
          fullControllerSha256: sha(JSON.stringify(control(G))), eventsPrefixSha256: sha(JSON.stringify(events)),
          inputPrefixSha256: appliedInputTrace.copy().digest('hex'), activation: activationBefore,
          health: health(f), previousRequest: appliedRequest.request, nextRequest };
      }
      if (branch && tick - branch.tick >= windowSteps) break;
      torqueRows = []; motorRows = []; dispatchRows = []; shoulderRequests = [];
      stepDispatch = {};
      const stateBefore = f.state;
      G.step();
      if (f.armRecoveryModel !== 'independent') throw Error('Flag was not restored at complete step boundary');
      if (branch && Object.keys(dispatchCounts).some(name => stepDispatch[name] !== 1))
        throw Error('Each original actuator must dispatch once in every treatment step');
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
      if (branch) traceFrame.actuatorCallsThisStep = { ...stepDispatch };
      traceFrames.push(traceFrame);
      if (f.state !== previousState) transitions.push({ timeS: G.t, before: previousState, after: f.state });
      if (!firstGetup && f.state === 'getup') firstGetup = { ...traceFrame, health: health(f) };
      previousState = f.state;
      if (!firstDeath && (!f.alive || !G.enemy.alive)) firstDeath = { timeS: G.t, player: health(f), enemy: health(G.enemy) };
      if (!firstDrop && !f.armed) firstDrop = { timeS: G.t, health: health(f) };
      if (!observed || !branch) continue;
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
        actualTorques: torqueRows, shoulderRequests, elbowMotorRequests: motorRows, pathDispatch: dispatchRows,
        pathTorqueReactionClosureNm: Object.fromEntries(['driveSword', 'driveJoints', 'elbowGravity'].map(name => [name,
          torqueRows.filter(row => row.actuator === name).reduce((a, row) => a.map((x, i) => x + row.torqueNm[i]), [0, 0, 0])])),
        explicitRecipientPowerW: torqueRows.reduce((sum, row) => sum + row.instantaneousPowerW, 0),
        wristCapNm: f.debug.wristCap, wristSwingBeforeTwistNm: f.debug.wristTorque.toArray(),
        wristBrake: f.wristBrake ?? false, wristBrakeAng: f.wristBrakeAng ?? null,
        wristHill: f.wristHill ?? null,
        ...(responseMode ? { postSolverSwordOmega: V(f.sword.angvel()).toArray(), postSolverElbow: elbowResponse(f) } : {}),
        jointTargets: { shoulder: f.jointByName.uarmS.target.toArray(), elbow: f.jointByName.farmS.target.toArray() },
        footMemory: Object.fromEntries(Object.entries(f.gait.legs).map(([key, leg]) => [key, { N: leg.N ?? null, Nf: leg.Nf ?? null, stance: leg.stance }])) });
    }
    if (firstDeath) stopReason = 'first_fighter_death';
    else stopReason = branch ? 'completed_same_state_window' : 'no_eligible_wounded_zero_delta_recovery';
    const firstPostBranchRecordedContact = branch ? events.find(event => event.afterStepTimeS > branch.timeS + 1e-10) ?? null : null;
    const latentFilterRecoverySteps = metrics.filter(row => row.health.alive && row.health.armed &&
      row.health.state === 'getup' && row.health.armHealth < 1 && row.extraArmActivation > activationEpsilon).length;
    const actualRecoveryExtraActivationStepsByPath = Object.fromEntries(Object.keys(dispatchCounts).map(name => [name,
      metrics.filter(row => row.health.alive && row.health.armed && row.health.state === 'getup' &&
        row.pathDispatch.some(call => call.method === name &&
          call.consumedActivation - call.ordinaryActivation > activationEpsilon)).length]));
    const actualExtraActivationStepsByPath = Object.fromEntries(Object.keys(dispatchCounts).map(name => [name,
      metrics.filter(row => row.health.alive && row.health.armed && row.health.state === 'getup' &&
        row.health.armHealth < 1 && row.pathDispatch.some(call => call.method === name &&
          call.consumedActivation - call.ordinaryActivation > activationEpsilon)).length]));
    return { weapon, seed, mode, observed, requestedScheduleSha256, first, branch, dispatchCounts, firstGetup,
      firstObservedStoredActivationAfterBranch: firstExtraArmActivation,
      firstArmWound, firstDeath, firstDrop, firstPostBranchRecordedContact, latentFilterRecoverySteps,
      actualExtraActivationStepsByPath, actualRecoveryExtraActivationStepsByPath, stopReason,
      durationS: G.t, finite: true, wallSeconds: (performance.now() - started) / 1000,
      nativeTraceSha256: nativeTrace.digest('hex'), fullControllerTraceSha256: fullControllerTrace.digest('hex'),
      physicalControllerTraceSha256: physicalControllerTrace.digest('hex'), appliedInputSha256: appliedInputTrace.digest('hex'),
      eventsSha256: sha(JSON.stringify(events)), events, taps, transitions, traceFrames, metrics,
      final: { player: health(f), enemy: health(G.enemy) } };
  } finally {
    for (const restore of restores.reverse()) restore();
    G?.eventQueue.free(); G?.world.free(); Math.random = originalRandom;
    CONFIG.GRIP.reactionModel = originalConfig.grip; CONFIG.BODY.supportModel = originalConfig.support;
    CONFIG.GAIT.stanceMemory = originalConfig.stance; CONFIG.GAIT.assist = originalConfig.assist;
    CONFIG.GAIT.catchMode = originalConfig.catchMode; CONFIG.GAIT.catchScale = originalConfig.catchScale;
  }
}

const rows = [], prefixChecks = [], observerChecks = [];
let error = null;
try {
  for (const mode of modes) {
    const row = run(weapon, seed, mode, true); rows.push(row);
    console.log(JSON.stringify({ mode, branch: row.branch?.timeS, durationS: row.durationS,
      observedSteps: row.metrics.length, dispatchCounts: row.dispatchCounts }));
  }
  for (const mode of observerModes) {
    const row = run(weapon, seed, mode, false); rows.push(row);
    const a = rows.find(r => r.mode === mode && r.observed);
    observerChecks.push({ mode, nativeTraceExact: a.nativeTraceSha256 === row.nativeTraceSha256,
      controllerTraceExact: a.fullControllerTraceSha256 === row.fullControllerTraceSha256,
      inputTraceExact: a.appliedInputSha256 === row.appliedInputSha256,
      eventTraceExact: a.eventsSha256 === row.eventsSha256,
      frameCountExact: a.traceFrames.length === row.traceFrames.length,
      dispatchCountsExact: JSON.stringify(a.dispatchCounts) === JSON.stringify(row.dispatchCounts) });
  }
  const baseline = rows[0], fields = ['nativeSha256', 'fullControllerSha256', 'physicalControllerSha256',
    'requestSha256', 'plannedRequestSha256', 'appliedInputPrefixSha256', 'eventsPrefixSha256'];
  for (const row of rows) {
    const prior = row.traceFrames.filter(f => f.tick < row.branch.tick);
    const exactPrefix = prior.every((f, i) => fields.every(key => f[key] === baseline.traceFrames[i][key]));
    const originalPrefixExact = row.traceFrames.filter(f => f.tick < row.branch.tick || row.mode === 'full')
      .every(f => fields.every(key => f[key] === referenceRun.traceFrames[f.tick][key]));
    prefixChecks.push({ mode: row.mode, observed: row.observed, branchTick: row.branch.tick,
      exactPrefix, originalPrefixExact, branchStateExact: JSON.stringify(row.branch) === JSON.stringify(baseline.branch),
      totalWindowSteps: row.traceFrames.length - row.branch.tick,
      allDispatchOnce: Object.values(row.dispatchCounts).every(n => n === windowSteps) });
  }
} catch (e) { error = String(e?.stack ?? e); }
const sourceAfter = manifest(), sourceCommitAfter = head();
const sourceStable = sourceCommit === sourceCommitAfter && JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
const expectedRows = modes.length + observerModes.length;
const measurementValid = !error && sourceStable && referenceSourceCompatible && rows.length === expectedRows &&
  prefixChecks.length === expectedRows && prefixChecks.every(c => c.exactPrefix && c.originalPrefixExact && c.branchStateExact && c.totalWindowSteps === windowSteps && c.allDispatchOnce) &&
  observerChecks.length === observerModes.length && observerChecks.every(c => Object.entries(c).every(([key, v]) => key === 'mode' || v === true));
const report = { schemaVersion: 1, probe: 'arm_recovery_path_ablation', sourceCommit, sourceCommitAfter,
  sourceBefore, sourceAfter, sourceStable, command: process.argv, createdUTC: new Date().toISOString(),
  wallSeconds: (performance.now() - begin) / 1000, referenceSourceExact, referenceSourceCompatible, audioCompatibility, reference: { path: referencePath, bytes: referenceBytes.length,
    sha256: sha(referenceBytes), sourceCommit: reference.sourceCommit }, measurementValid,
  executionCount: rows.length, error, schedule, requestedScheduleSha256, prefixChecks, observerChecks, rows,
  protocol: { scene, weapon, seed, windowSteps, DT, modes, observerModes, responseMode,
    branch: 'Wounded case requires first actual main-arm wound; healthyStop diagnoses a known healthy-arm recovery counterexample. Armed getup with extra activation >1e-4, then first active-to-held-zero-delta boundary. All runs are independent from spawn and replay exactly up to that same complete-step boundary.',
    treatment: 'Temporary ordinary-muscle routing only inside original driveSword and/or driveJoints+elbowGravity calls. Independent filter updates continue in original step; flag and filter are restored/unchanged before next method. allOrdinary is a diagnostic ablation after independent prefix, NOT legacy from spawn.',
    scope: 'driveSword includes IK gate and wrist torque/braking; driveJoints includes manual shoulder and native elbow; jointsOrdinary also routes separate elbowGravity. Other muscles, inputs, gains, strength, health, native poses and AI are unchanged.',
    observation: 'Original methods called exactly once. Actual addTorque values include final twist and actual recipients; instantaneous pre-solver recipient power is NOT integrated native work. Elbow motor settings are requests, not achieved torque/whole-substep work. Contact points/normal impulses remain last-solver-substep raw; no per-point load or COP inference.',
    inference: 'First dispatch and first physics response are local same-state path contrasts. Direct same-recorded-event windows and complete .5s reactive-AI outcomes are reported separately; later treatment-induced AI/contact changes are mediators of total game effect, not automatically invalidating paired whole-window regression. Not equal-torque efficiency or human acceptance.',
    referenceGate: 'All pre-branch and full-mode post-branch frame digests must match the previously received original from-spawn raw, including original control/event/input digests. Observer off still retains mandatory hashes, routing/dispatch counters and flag/filter assertions; optional torque/motor/contact/metrics reads are removed.',
    release: 'Research only. No runtime source/default/UI/public candidate change. Existing failed support/cut candidates remain withdrawn; one-hand recovery remains held.' } };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, measurementValid, executionCount: rows.length, prefixChecks, observerChecks,
  wallSeconds: report.wallSeconds, error }));
if (!measurementValid) process.exitCode = 1;
