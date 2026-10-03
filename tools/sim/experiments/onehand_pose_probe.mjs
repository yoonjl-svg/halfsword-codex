/** Read-only actual-game pose observations with a scripted player and reactive enemy AI. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, CONFIG, DT, THREE } from '../harness_m.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([^=]+)=(.+)$/.exec(arg);
  if (!match) throw Error('Use --out=NEW_PATH [--weapons=sabre,falchion,rapier,longsword] [--skill=0] [--observerRepeats=true]');
  return [match[1], match[2]];
}));
if (Object.keys(options).some(key => !['out', 'weapons', 'skill', 'observerRepeats', 'model'].includes(key))) throw Error('Unknown option');
const output = options.out;
const receiptPath = output ? output + '.receipt.json' : null;
const weapons = (options.weapons ?? 'sabre,falchion,rapier,longsword').split(',');
const skill = Number(options.skill ?? 0);
const model = options.model ?? 'legacy';
const repeatObservers = options.observerRepeats !== 'false';
if (!output || fs.existsSync(output) || fs.existsSync(receiptPath) || !weapons.length || weapons.length > 4 ||
    new Set(weapons).size !== weapons.length || weapons.some(w => !['sabre', 'falchion', 'rapier', 'longsword'].includes(w)) ||
    !['legacy', 'manual'].includes(model) || !Number.isFinite(skill) || skill < 0 || skill > 1 ||
    (options.observerRepeats && !['true', 'false'].includes(options.observerRepeats))) throw Error('Invalid options or existing output');

const sha = value => createHash('sha256').update(value).digest('hex');
const V = value => new THREE.Vector3(value.x, value.y, value.z);
const Q = value => new THREE.Quaternion(value.x, value.y, value.z, value.w);
const point = (body, local) => V(local).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
const direction = (body, local) => V(local).applyQuaternion(Q(body.rotation())).normalize();
function rotationVector(q) {
  const w = Math.min(1, Math.abs(q.w)), s = Math.sqrt(1 - w * w);
  return s < 1e-6 ? new THREE.Vector3() : new THREE.Vector3(q.x, q.y, q.z).multiplyScalar((q.w < 0 ? -1 : 1) * 2 * Math.acos(w) / s);
}
function plain(object) {
  const skip = new Set(['f', 'fighter', 'me', 'foe', 'world', 'scene', 'R', 'rb', 'body', 'parent', 'child',
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
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      const result = skip.has(key) ? undefined : copy(item, depth + 1);
      return result === undefined ? [] : [[key, result]];
    }));
  }
  return copy(object);
}
function controller(G) {
  return { player: plain(G.player), enemy: plain(G.enemy), ai: plain(G.ai), combat: {
    step: G.combat.stepNo, cutting: plain(G.combat.cutting), touching: plain(G.combat.touching),
    cutReactionModel: G.combat.cutReactionModel } };
}
function health(f) {
  return { state: f.state, stateTimeS: f.stateTime, alive: f.alive, armed: f.armed, gripping: !!f.gripping,
    gripValid: !!f.gripJoint?.isValid(), armHealth: f.armHealth, limbs: { ...f.limbs }, muscle: f.muscle,
    vigor: f.vigor, blood: f.blood, pain: f.pain, consciousness: f.consciousness,
    wounds: f.wounds.map(w => ({ part: w.part, type: w.type, severity: w.severity })), detached: [...(f.detachedParts ?? [])] };
}
function sourceFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? sourceFiles(directory + '/' + entry.name) : entry.name.endsWith('.js') ? [directory + '/' + entry.name] : []);
}
const files = [...sourceFiles('src'), 'tools/sim/harness_m.mjs', 'tools/sim/experiments/onehand_pose_probe.mjs',
  'package-lock.json', 'node_modules/@dimforge/rapier3d-compat/rapier.mjs', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest = () => Object.fromEntries(files.sort().map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

// Consecutive nominal changes are added to the live pad; holds never overwrite the pad.
const phases = [
  { name: 'spawn_hold', seconds: .25, targetM: [.15, 0] },
  { name: 'drag_side', seconds: .6, targetM: [.52, .03] },
  { name: 'side_hold', seconds: 2, targetM: [.52, .03] },
  { name: 'drag_high', seconds: .6, targetM: [.02, .52] },
  { name: 'high_hold', seconds: 2, targetM: [.02, .52] },
];
const schedule = [];
let nominal = [.15, 0];
for (const phase of phases) {
  const start = [...nominal], count = Math.round(phase.seconds / DT);
  for (let index = 0; index < count; index++) {
    const next = start.map((x, axis) => x + (phase.targetM[axis] - x) * (index + 1) / count);
    const deltaM = next.map((x, axis) => x - nominal[axis]);
    schedule.push({ tick: schedule.length, timeS: schedule.length * DT, phase: phase.name,
      intendedOffsetM: next, deltaM, held: true, active: Math.abs(deltaM[0]) + Math.abs(deltaM[1]) > 1e-5, move: [0, 0], tap: false });
    nominal = next;
  }
}
const scheduleSha256 = sha(JSON.stringify(schedule));
const sourceBefore = manifest(), sourceCommit = head(), started = performance.now(), originalRandom = Math.random;

function anatomy(f) {
  const shoulderJoint = f.jointByName.uarmS, elbowJoint = f.jointByName.farmS;
  const chest = f.bodies.chest, upper = f.bodies.uarmS, forearm = f.bodies.farmS, sword = f.sword;
  const shoulder = point(chest, shoulderJoint.joint.anchor1());
  const elbowParent = point(upper, elbowJoint.joint.anchor1()), elbowChild = point(forearm, elbowJoint.joint.anchor2());
  const hand = point(forearm, { x: .13, y: 0, z: 0 });
  const swordRoot = V(sword.translation()), bladeRoot = point(sword, { x: 0, y: f.weaponCfg.hiltLength, z: 0 });
  const tip = point(sword, { x: 0, y: f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, z: 0 });
  const relative = Q(upper.rotation()).invert().multiply(Q(forearm.rotation()));
  const currentRV = rotationVector(elbowJoint.restInv.clone().multiply(relative));
  const targetRV = rotationVector(elbowJoint.restInv.clone().multiply(elbowJoint.target));
  const targetEndLocal = new THREE.Vector3(CONFIG.ARM.fore, 0, 0).applyQuaternion(elbowJoint.target)
    .add(new THREE.Vector3(CONFIG.ARM.upper, 0, 0)).applyQuaternion(shoulderJoint.target).applyQuaternion(Q(chest.rotation()));
  const targetEnd = shoulder.clone().add(targetEndLocal);
  const grip = f.gripJoint?.isValid() ? { forearmPointM: point(forearm, f.gripJoint.anchor1()).toArray(),
    swordPointM: point(sword, f.gripJoint.anchor2()).toArray(),
    gapM: point(forearm, f.gripJoint.anchor1()).distanceTo(point(sword, f.gripJoint.anchor2())) } : null;
  const actualAxis = direction(sword, { x: 0, y: 1, z: 0 }), forearmAxis = direction(forearm, { x: 1, y: 0, z: 0 });
  const gaps = f.joints.filter(j => j.joint?.isValid()).map(j => ({ name: j.name,
    gapM: point(j.parent, j.joint.anchor1()).distanceTo(point(j.child, j.joint.anchor2())) }));
  return { shoulderWorldM: shoulder.toArray(), elbowParentWorldM: elbowParent.toArray(), elbowChildWorldM: elbowChild.toArray(),
    handEndpointWorldM: hand.toArray(), swordRootWorldM: swordRoot.toArray(), bladeRootWorldM: bladeRoot.toArray(), swordTipWorldM: tip.toArray(),
    shoulderToElbowWorldM: elbowParent.clone().sub(shoulder).toArray(), elbowToHandWorldM: hand.clone().sub(elbowChild).toArray(),
    handToSwordRootWorldM: swordRoot.clone().sub(hand).toArray(), swordRootToTipWorldM: tip.clone().sub(swordRoot).toArray(),
    chestQuaternion: Q(chest.rotation()).toArray(), upperQuaternion: Q(upper.rotation()).toArray(),
    forearmQuaternion: Q(forearm.rotation()).toArray(), swordQuaternion: Q(sword.rotation()).toArray(),
    swordRelativeForearmQuaternion: Q(forearm.rotation()).invert().multiply(Q(sword.rotation())).toArray(),
    elbowRelativeQuaternion: relative.toArray(), elbowCurrentRestRotationVectorRad: currentRV.toArray(),
    elbowCurrentZRad: currentRV.z, elbowTargetRestRotationVectorRad: targetRV.toArray(), elbowTargetZRad: targetRV.z,
    nativeElbowLimits: { enabled: elbowJoint.joint.limitsEnabled(), minimumRad: elbowJoint.joint.limitsMin(), maximumRad: elbowJoint.joint.limitsMax() },
    handTargetWorldM: f.handTarget.toArray(), handErrorM: hand.distanceTo(f.handTarget),
    ikReconstructedTargetEndpointWorldM: targetEnd.toArray(), ikReconstructionErrorM: targetEnd.distanceTo(f.handTarget),
    requestedShoulderHandReachM: shoulder.distanceTo(f.handTarget), maximumIKReachM: CONFIG.ARM.upper + CONFIG.ARM.fore - CONFIG.ARM.slack,
    armFull: f.armFull, shoulderTargetQuaternion: shoulderJoint.target.toArray(), elbowTargetQuaternion: elbowJoint.target.toArray(),
    actualSwordAxisWorld: actualAxis.toArray(), actualForearmAxisWorld: forearmAxis.toArray(), actualAimWorld: f.debug.aim.toArray(),
    swordAxisDotForearm: actualAxis.dot(forearmAxis), ownAimErrorRad: actualAxis.angleTo(f.debug.aim), grip, jointGaps: gaps,
    bodyMotion: Object.fromEntries([['chest', chest], ['upper', upper], ['forearm', forearm], ['sword', sword]].map(([name, body]) =>
      [name, { worldPositionM: V(body.translation()).toArray(), velocityMps: V(body.linvel()).toArray(), omegaRadps: V(body.angvel()).toArray() }])) };
}
function activeContacts(G, f, labels) {
  const result = [], seen = new Set();
  for (const [name, body] of [['upper', f.bodies.uarmS], ['forearm', f.bodies.farmS], ['sword', f.sword]]) {
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i);
      G.world.contactPairsWith(collider, other => {
        const key = [collider.handle, other.handle].sort((a, b) => a - b).join(':');
        if (seen.has(key)) return;
        seen.add(key);
        G.world.contactPair(collider, other, manifold => {
          let normalImpulseNs = 0;
          for (let index = 0; index < manifold.numContacts(); index++) normalImpulseNs += manifold.contactImpulse(index);
          result.push({ part: name, collider: collider.handle, otherCollider: other.handle,
            other: labels.get(other.handle) ?? { fixed: !!other.parent()?.isFixed() },
            contacts: manifold.numContacts(), solverContacts: manifold.numSolverContacts(), normalImpulseNs,
            solverPoints: Array.from({ length: manifold.numSolverContacts() }, (_, index) => ({
              worldM: V(manifold.solverContactPoint(index)).toArray(), distanceM: manifold.solverContactDist(index) })) });
        });
      });
    }
  }
  return result;
}
function run(weapon, observed) {
  let G, preSolver = null, motorRows = [], shoulderRows = [], currentInput = null;
  const frames = [], events = [], traceFrames = [], restores = [];
  const nativeTrace = createHash('sha256'), controllerTrace = createHash('sha256'), inputTrace = createHash('sha256');
  const begin = performance.now();
  let stopReason = 'fixed_horizon';
  try {
    G = newRound({ seed: 7, walls: false, weapon, weapon2: 'longsword', gap: 1.85, skill, difficulty: 'normal', onFighter: f => { f.onehandArmModel = model; } });
    const f = G.player;
    if (f.weapon.id !== weapon || G.ai2 || G.parkEnemy || G.t !== 0) throw Error('Actual user-path scope violated');
    f.skill.level = skill; f.skill.autoGuard = false;
    const first = { nativeSha256: sha(G.world.takeSnapshot()), controllerSha256: sha(JSON.stringify(controller(G))),
      player: health(f), enemy: health(G.enemy), handOffsetM: f.handOffset.toArray(),
      weapon: f.weapon.id, twoHand: f.weaponCfg.twoHand, oneHandStance: !!f.guardPose.oneHand,
      guardTableNames: (f.guardPose.table ?? []).map(g => g.name), skill, autoGuard: false,
      models: { grip: CONFIG.GRIP.reactionModel, support: CONFIG.BODY.supportModel, weightMode: CONFIG.BODY.weightMode,
        onehandArm: f.onehandArmModel, arm: f.armTorqueModel ?? 'legacy', edge: f.edgeTorqueModel ?? 'legacy', armRecovery: f.armRecoveryModel ?? 'legacy',
        cutting: G.combat.cutReactionModel ?? 'legacy', assist: CONFIG.GAIT.assist, catchMode: CONFIG.GAIT.catchMode, catchScale: CONFIG.GAIT.catchScale } };
    const labels = new Map();
    for (const actor of [G.player, G.enemy]) for (const [part, body] of [...Object.entries(actor.bodies), ['sword', actor.sword]])
      for (let index = 0; index < body.numColliders(); index++) labels.set(body.collider(index).handle, { fighter: actor.index, part });
    if (observed) {
      const raw = f.jointByName.farmS.joint.rawSet, originalMotor = raw.jointConfigureMotor;
      const descriptor = Object.getOwnPropertyDescriptor(raw, 'jointConfigureMotor');
      raw.jointConfigureMotor = function (...args) {
        if (args[0] === f.jointByName.farmS.joint.handle) motorRows.push({ axis: args[1], targetPositionRad: args[2],
          targetVelocityRadps: args[3], stiffness: args[4], damping: args[5] });
        return originalMotor.apply(this, args);
      };
      restores.push(() => { if (descriptor) Object.defineProperty(raw, 'jointConfigureMotor', descriptor); else delete raw.jointConfigureMotor; });
      const originalManual = f.manualMuscle, manualDescriptor = Object.getOwnPropertyDescriptor(f, 'manualMuscle');
      f.manualMuscle = function (joint, k, d, maxT) {
        if (joint.name === 'uarmS') shoulderRows.push({ k, d, maximumTorqueRequestNm: maxT, targetQuaternion: joint.target.toArray() });
        return originalManual.call(this, joint, k, d, maxT);
      };
      restores.push(() => { if (manualDescriptor) Object.defineProperty(f, 'manualMuscle', manualDescriptor); else delete f.manualMuscle; });
    }
    const originalStep = G.world.step, stepDescriptor = Object.getOwnPropertyDescriptor(G.world, 'step');
    G.world.step = function (...args) {
      preSolver = { nativeSha256: sha(G.world.takeSnapshot()), controllerSha256: sha(JSON.stringify(controller(G))) };
      if (observed) preSolver.pose = anatomy(f);
      return originalStep.apply(this, args);
    };
    restores.push(() => { if (stepDescriptor) Object.defineProperty(G.world, 'step', stepDescriptor); else delete G.world.step; });
    const wound = G.combat.hooks.onWound;
    G.combat.hooks.onWound = function (attacker, victim, result, p, pair) {
      wound?.(attacker, victim, result, p, pair);
      events.push({ kind: 'wound', timeS: G.t, postStepTimeS: G.t + DT, attacker: attacker.index, victim: victim.index,
        part: pair.v.part, pointM: V(p).toArray(), result: plain(result), after: health(victim) });
    };
    const clash = G.combat.hooks.onClash;
    G.combat.hooks.onClash = function (...args) {
      clash?.(...args); events.push({ kind: 'clash', timeS: G.t, postStepTimeS: G.t + DT, speedMps: args[1], info: plain(args[2]) });
    };
    G.before = () => {
      const tick = Math.round(G.t / DT), request = schedule[tick];
      const beforePadM = f.handOffset.toArray();
      f.skill.level = skill; f.skill.autoGuard = false;
      f.handOffset.x += request.deltaM[0]; f.handOffset.y += request.deltaM[1];
      f.handHeld = request.held; f.inputActive = request.active; f.move.set(0, 0); f.stickX = f.stickY = 0;
      currentInput = { request, beforePadM, appliedPadM: f.handOffset.toArray(), skill: f.skill.level, autoGuard: f.skill.autoGuard };
      inputTrace.update(JSON.stringify(currentInput));
    };
    for (let tick = 0; tick < schedule.length; tick++) {
      if (!f.alive || !G.enemy.alive) { stopReason = 'first_fighter_death'; break; }
      if (!f.armed) { stopReason = 'first_player_drop'; break; }
      motorRows = []; shoulderRows = []; G.step();
      if (!G.world.bodies.getAll().every(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()]
        .every(value => Object.values(value).every(Number.isFinite)))) throw Error('Nonfinite native state');
      const nativeSha256 = sha(G.world.takeSnapshot()), controllerSha256 = sha(JSON.stringify(controller(G)));
      nativeTrace.update(nativeSha256); controllerTrace.update(controllerSha256);
      traceFrames.push({ tick, timeS: G.t, preNativeSha256: preSolver.nativeSha256, preControllerSha256: preSolver.controllerSha256,
        nativeSha256, controllerSha256, inputPrefixSha256: inputTrace.copy().digest('hex'), eventsPrefixSha256: sha(JSON.stringify(events)) });
      if (observed) frames.push({ tick, timeS: G.t, phase: schedule[tick].phase, input: currentInput,
        player: health(f), enemy: health(G.enemy), aimM: f.skill.aim.toArray(), aimRawM: f.skill.aimRaw.toArray(),
        skillControl: { level: f.skill.level, autoGuard: f.skill.autoGuard, recovering: f.skill.recovering,
          cutPending: f.skill.cutPending, idleS: f.skill.idle, quietS: f.skill.quiet, swinging: f.skill.swinging,
          inputVelocityMps: f.skill.vel.toArray(), followOffsetM: f.skill.follow.toArray(), anchorM: f.skill.anchor.toArray(),
          aimVelocityMps: f.skill.aimVel.toArray(), guardFollow: f.skill.guardFollow ?? null },
        guardWeight: f.guardWeight(), nearestGuard: f.guardPose.nearest, runtimeGuardMap: { hand: [...f.guardPose.hand], dir: [...f.guardPose.dir] },
        handHeld: f.handHeld, inputActive: f.inputActive, thrustWeight: f.skill.thrustPose.w,
        preSolverPose: preSolver.pose, elbowMotorRequests: motorRows, shoulderRequests: shoulderRows,
        postSolverPose: anatomy(f), contacts: activeContacts(G, f, labels),
        wristCapNm: f.debug.wristCap ?? null, wristSwingBeforeTwistNm: f.debug.wristTorque.toArray(), wristBrake: !!f.wristBrake });
    }
    return { weapon, seed: 7, observed, first, stopReason, durationS: G.t, frames, traceFrames, events,
      nativeTraceSha256: nativeTrace.digest('hex'), controllerTraceSha256: controllerTrace.digest('hex'), inputTraceSha256: inputTrace.digest('hex'),
      eventsSha256: sha(JSON.stringify(events)), finite: true, wallSeconds: (performance.now() - begin) / 1000,
      final: { player: health(f), enemy: health(G.enemy) } };
  } finally {
    for (const restore of restores.reverse()) restore();
    G?.eventQueue.free(); G?.world.free(); Math.random = originalRandom;
  }
}

const rows = [], observerChecks = [];
let error = null;
try {
  for (const weapon of weapons) {
    const row = run(weapon, true); rows.push(row);
    console.log(JSON.stringify({ weapon, observed: true, durationS: row.durationS, stopReason: row.stopReason, recordedSteps: row.frames.length, events: row.events.length }));
  }
  if (repeatObservers) for (const weapon of [...new Set([weapons[0], weapons.at(-1)])]) {
    const original = rows.find(row => row.weapon === weapon && row.observed), repeat = run(weapon, false); rows.push(repeat);
    const fields = ['nativeTraceSha256', 'controllerTraceSha256', 'inputTraceSha256', 'eventsSha256', 'durationS'];
    observerChecks.push({ weapon, traceExact: fields.every(field => original[field] === repeat[field]),
      firstExact: JSON.stringify(original.first) === JSON.stringify(repeat.first), framesExact: JSON.stringify(original.traceFrames) === JSON.stringify(repeat.traceFrames) });
  }
} catch (failure) { error = String(failure?.stack ?? failure); }
const sourceAfter = manifest(), sourceCommitAfter = head();
const sourceStable = sourceCommit === sourceCommitAfter && JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
const expectedRows = weapons.length + (repeatObservers ? new Set([weapons[0], weapons.at(-1)]).size : 0);
const measurementValid = !error && sourceStable && rows.length === expectedRows && rows.every(row => row.finite && row.traceFrames.length > 0) &&
  observerChecks.every(check => check.traceExact && check.firstExact && check.framesExact);
const report = { schemaVersion: 1, probe: 'onehand_pose', sourceCommit, sourceCommitAfter, sourceBefore, sourceAfter, sourceStable,
  measurementValid, executionCount: rows.length, createdUTC: new Date().toISOString(), command: process.argv,
  wallSeconds: (performance.now() - started) / 1000, error, schedule, scheduleSha256, observerChecks, rows,
  protocol: { weapons, seed: 7, timestepSeconds: DT, requestedSteps: schedule.length, model, skill, autoGuard: false,
    settings: 'Current runtime defaults; scripted player input and original normal longsword enemy AI; gap1.85m, no walls, player movement0, no new tap. No AI2, park, wound/state/pose/velocity injection, source transforms. Explicit onehandArm model is installed on both fighters before the first controller/physics step.',
    input: 'Initial native spawn handOffset(.15,0) retained. Nominal consecutive pad deltas generate side(.52,.03) and high(.02,.52) intent with .6s drags and2s held zero-delta intervals. Actual pad is separate from nominal intention; hand/aim targets remain under original Skill/Fighter control.',
    observations: 'Pre-solver anatomy is read after both original Fighter/cache steps and before original world.step exactly once. Motor requests and shoulder parameters wrap original calls exactly once. Post-solver contact data and all physical endpoints are read-only. Observer-off removes optional motor/manual/anatomy/contact/frame reads; hash/input/event/world-step recorder remains.',
    coordinates: 'World metre points/vectors. Physical swordRoot is the sword rigid-body origin/grip; bladeRoot/tip follow runtime local +y hiltLength/bladeLength. This does not measure rendered fingers or curved visual mesh endpoints. ElbowCurrentZRad reproduces Fighter toRotVec(restInv*parent^-1*child). Native limits are public joint getter values. IK endpoint reconstruction uses current chest and controller shoulder/elbow targets, not achieved native motor motion.',
    interpretation: 'Fixed-arm/reverse-grip appearance is not certified by these data. Sword/forearm axis dot is a geometric relation, not proof of grip style. Shoulder is manual and has no native motor/angle limits. Native elbow motor values are requests. At skill0 guard map is observed but guardWeight0 does not apply its hand/direction blend. Recorded injury/death/drop and healthy held-frame coverage limit pose interpretation; measurementValid is numerical/source/observer validity, not symptom reproduction or acceptance.',
    limitations: 'Four weapon conditions plus up to two observer repeats are not independent efficacy samples. Same input phases in different reactive combats are descriptive, not identical contacts. Fixed120Hz actual physics, no browser rendering/camera/rAF/hit-stop or human appearance judgment.',
  } };
fs.mkdirSync(path.dirname(output), { recursive: true });
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(output, bytes, { flag: 'wx' });
const receipt = { rawPath: path.resolve(output), rawBytes: bytes.length, rawSha256: sha(bytes), sourceCommit,
  probeSha256: sourceBefore['tools/sim/experiments/onehand_pose_probe.mjs'], command: process.argv, sourceStable, measurementValid, executionCount: rows.length };
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...receipt, receiptPath, wallSeconds: report.wallSeconds, observerChecks, error }));
if (!measurementValid) process.exitCode = 1;
