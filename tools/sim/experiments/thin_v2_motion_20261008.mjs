// Actual-game same-input legacy/v2 comparison on the two formerly withheld weapons.
// Direct arm-function preparation is not a natural wound-frequency experiment.
// Usage: node tools/sim/experiments/thin_v2_motion_20261008.mjs ROOT NEW_OUTPUT
// Optional: --modes=legacy,v2 --weapons=monohoshizao,lightsaber
//           --conditions=healthy,severe --plan
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const [root, out, ...flags] = process.argv.slice(2);
assert(root && out && path.isAbsolute(root) && path.isAbsolute(out), 'ROOT and NEW_OUTPUT must be absolute');
const allowed = {modes: ['legacy', 'v2'], weapons: ['monohoshizao', 'lightsaber'],
  conditions: ['healthy', 'severe']};
const options = Object.fromEntries(Object.entries(allowed).map(([k, v]) => [k, [...v]]));
for (const flag of flags) {
  if (flag === '--plan') continue;
  const match = /^--(modes|weapons|conditions)=(.+)$/.exec(flag);
  assert(match, `Unknown option: ${flag}`);
  const [, key, value] = match, selected = value.split(',');
  assert(selected.length === new Set(selected).size && selected.every(x => allowed[key].includes(x)), `Bad ${key}`);
  options[key] = selected;
}

// Exact authored tape from arm_function_question_20261007.mjs; holding is an
// input stop, while release also permits the ordinary v2 return policy.
const schedule = [
  ['prefix', 300, [0, 0], true], ['postConditionHold', 60, [0, 0], true],
  ['raise', 48, [-.28, .38], true], ['raisedHold', 24, [0, 0], true],
  ['firstCut', 30, [.56, -.76], true], ['followHold', 36, [0, 0], true],
  ['reverse', 36, [-.38, .66], true], ['reverseHold', 24, [0, 0], true],
  ['recut', 30, [.40, -.70], true], ['recutHold', 36, [0, 0], true],
  ['release', 240, [0, 0], false],
];
const tape = schedule.flatMap(([phase, n, d, held]) =>
  Array.from({length: n}, () => ({phase, dx: d[0] / n, dy: d[1] / n, held})));
const protocol = {
  seed: 7, gapM: 5.6, modes: options.modes, weapons: options.weapons, conditions: options.conditions,
  runs: options.modes.length * options.weapons.length * options.conditions.length,
  preparation: {tick300: 'severe: armO=.2; healthy: no injury mutation'},
  configuration: 'current ordinary common stance/roll/cut + linked offhand BOTH + finish power BOTH + limb ON + gravity -9.81; legacy .7 versus v2/manual at creation',
  setting: 'Distant idle foe, no locomotion; actual Fighter/Rapier/Combat loop, no rendering.',
  scope: 'Two thin two-hand weapons, readiness/manual cut/reverse/recut/release. Severe .2 support-arm function from tick300. No natural injury/contact damage/human-motion claim.',
  schedule,
};
assert(protocol.runs <= 8, 'Bounded experiment permits at most 8 runs');
if (flags.includes('--plan')) { console.log(JSON.stringify(protocol, null, 2)); process.exit(0); }
assert(!fs.existsSync(out), 'Output must be new; earlier raw evidence is never overwritten');

const sha = b => createHash('sha256').update(b).digest('hex');
const relativeScript = 'tools/sim/experiments/thin_v2_motion_20261008.mjs';
const files = fs.readdirSync(path.join(root, 'src')).filter(n => n.endsWith('.js')).sort().map(n => `src/${n}`)
  .concat('tools/sim/harness_m.mjs', 'tools/sim/experiments/arm_function_question_20261007.mjs',
    relativeScript, 'package.json', 'package-lock.json');
const manifest = base => Object.fromEntries(files.map(n => [n, sha(fs.readFileSync(path.join(base, n)))]));
const sourceBefore = manifest(root), frozenRoot = path.join(out, 'source');
const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const gitStatus = execFileSync('git', ['status', '--short'], {cwd: root, encoding: 'utf8'});
fs.mkdirSync(out, {recursive: true});
for (const file of files) {
  const dest = path.join(frozenRoot, file);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(path.join(root, file), dest);
}
assert.deepEqual(manifest(root), sourceBefore, 'Checkout changed during source capture');
assert.deepEqual(manifest(frozenRoot), sourceBefore, 'Frozen source copy mismatch');
fs.symlinkSync(path.join(root, 'node_modules'), path.join(frozenRoot, 'node_modules'), 'dir');
const writeJSON = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
writeJSON(path.join(out, 'protocol.json'), {...protocol, head, gitStatus, sourceBefore,
  command: process.argv, toolSHA256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  dependencyNote: 'Runtime source frozen here; node_modules symlink uses existing installed lockfile dependencies.'});
writeJSON(path.join(out, 'input-tape.json'), tape);

const load = file => import(pathToFileURL(path.join(frozenRoot, file)).href);
const {newRound, THREE, DT, CONFIG} = await load('tools/sim/harness_m.mjs');
const {configureCombatDefaults} = await load('src/combat_defaults.js');
const {configureSwordsmanshipDefault} = await load('src/swordsmanship_default.js');
const {applySwordsmanship, recordSwordsmanshipInput} = await load('src/swordsmanship.js');
const {mainArmMuscle} = await load('src/arm_recovery_activation.js');
const {strikeArmAssist, strikeArmSupportScale, offhandHealthScale} = await load('src/arm_support.js');
assert.equal(CONFIG.PHYSICS.gravity, -9.81);
assert.equal(CONFIG.COMBAT.limbSeverTrial, true, 'Use the actual ordinary limb default');
const entry = configureSwordsmanshipDefault(new URLSearchParams());
assert(entry.active);
const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const plain = v => ({x: v.x, y: v.y, z: v.z});
const norm = v => Math.hypot(v.x, v.y, v.z);
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const finiteBody = b => [b.translation(), b.rotation(), b.linvel(), b.angvel()]
  .every(v => Object.values(v).every(Number.isFinite));
function kinetic(b) {
  const w = V(b.angvel()).applyQuaternion(Q(b.rotation()).invert())
    .applyQuaternion(Q(b.principalInertiaLocalFrame()).invert());
  const I = b.principalInertia();
  return .5 * b.mass() * norm(b.linvel()) ** 2 + .5 * (I.x * w.x ** 2 + I.y * w.y ** 2 + I.z * w.z ** 2);
}
function controller(f) {
  return {state: f.state, alive: f.alive, armed: f.armed, gripping: !!f.gripping,
    limbs: {...f.limbs}, muscle: f.muscle, armHealth: f.armHealth, pain: f.pain,
    blood: f.blood, bleed: f.bleed, detachedParts: [...(f.detachedParts ?? [])],
    handOffset: {...f.handOffset}, handHeld: f.handHeld, inputActive: f.inputActive,
    handTarget: plain(f.handTarget), aimDirW: plain(f.aimDirW),
    wristCapNm: f.debug.wristCap, wristHill: f.wristHill ?? null, wristBrake: !!f.wristBrake,
    swordsmanship: {model: f.swordsmanshipModel, phase: f.swordsmanshipState?.phase,
      goalTick: f.swordsmanshipState?.goalTick, input: f.swordsmanshipState?.input,
      hand: f.swordsmanshipState ? plain(f.swordsmanshipState.hand) : null, aim: f.swordsmanshipState ? plain(f.swordsmanshipState.aim) : null},
    armSupportModel: f.armSupportModel ?? 'legacy', armSupport: f.cache?.armSupport ?? null,
    strikeSupportScale: strikeArmSupportScale(f), swingAssistKg: strikeArmAssist(f),
    thrustAssistKg: strikeArmAssist(f, 'thrust')};
}
function saveState(G, directory, label, tick) {
  const binary = Buffer.from(G.world.takeSnapshot()), file = path.join(directory, `${label}.rapier.bin`);
  fs.writeFileSync(file, binary, {flag: 'wx'});
  const record = {label, tick, timeS: G.t, physicsSnapshot: {path: file, sha256: sha(binary), bytes: binary.length},
    player: controller(G.player), enemy: {state: G.enemy.state, alive: G.enemy.alive, limbs: {...G.enemy.limbs}},
    note: 'Rapier snapshot preserves physics; controller JSON is a selected setup summary, not a restorable whole-game save.'};
  writeJSON(path.join(directory, `${label}.state.json`), record);
  return record;
}
// Transparent wrappers capture requests actually submitted to Rapier. They never
// replace force/torque values, transforms, velocities, or control decisions.
function observe(f) {
  const measurement = {};
  let insideDrive = false, insideOff = false;
  const original = {drive: f.driveSword, off: f.offHand,
    torque: f.sword.addTorque, force: f.sword.addForceAtPoint};
  f.driveSword = function (...args) {
    insideDrive = true;
    try { return original.drive.apply(this, args); } finally { insideDrive = false; }
  };
  f.offHand = function (...args) {
    insideOff = true;
    try { return original.off.apply(this, args); } finally { insideOff = false; }
  };
  f.sword.addTorque = function (torque, ...args) {
    if (insideDrive) {
      measurement.motorTorque.add(V(torque));
      measurement.motorTorqueAbsNm += norm(torque);
      measurement.motorRotPowerW += V(torque).dot(V(this.angvel()));
      measurement.motorCalls++;
    }
    return original.torque.call(this, torque, ...args);
  };
  f.sword.addForceAtPoint = function (force, point, ...args) {
    if (insideOff) {
      const F = V(force), moment = V(point).sub(V(this.worldCom())).cross(F);
      measurement.offForce.add(F); measurement.offForceAbsN += norm(force);
      measurement.offTorque.add(moment);
      measurement.offRotPowerW += moment.dot(V(this.angvel()));
      measurement.offPointPowerW += F.dot(V(this.velocityAtPoint(point)));
      measurement.offCalls++;
    }
    return original.force.call(this, force, point, ...args);
  };
  return {measurement, reset() {
    Object.assign(measurement, {motorTorque: new THREE.Vector3(), offForce: new THREE.Vector3(),
      offTorque: new THREE.Vector3(), motorTorqueAbsNm: 0, motorRotPowerW: 0,
      offForceAbsN: 0, offRotPowerW: 0, offPointPowerW: 0, motorCalls: 0, offCalls: 0});
  }};
}
function summarize(trace) {
  const phases = {};
  for (const [phase] of schedule) {
    const t = trace.filter(r => r.phase === phase);
    const values = key => t.map(r => r[key]);
    phases[phase] = {steps: t.length, stateCounts: Object.fromEntries([...new Set(t.map(r => r.state))]
      .map(s => [s, t.filter(r => r.state === s).length])),
    grippingSteps: t.filter(r => r.gripping).length, wristBrakeSteps: t.filter(r => r.wristBrake).length};
    for (const key of ['offForceN', 'offTorqueNm', 'motorTorqueNm', 'combinedControlTorqueNm',
      'wristCapNm', 'baseWristCapNm', 'handErrorM', 'mainGripGapM', 'offGripGapM', 'aimErrorRad', 'aimCommandTurnRadps',
      'handCommandSpeedMps', 'swordOmegaRadps', 'absAxialOmegaRadps', 'swingOmegaRadps', 'tipSpeedMps', 'edgeSpeedMps', 'center70SpeedMps', 'swordEnergyJ',
      'gripForceCapN', 'strikeSupportScale', 'swingAssistKg', 'thrustAssistKg']) {
      phases[phase][key] = {mean: mean(values(key)), max: Math.max(...values(key)),
        first: t[0][key], last: t.at(-1)[key]};
    }
    for (const key of ['tipSpeedMps', 'edgeSpeedMps', 'center70SpeedMps', 'swordEnergyJ']) {
      const n50 = Math.round(.05 / DT), a = values(key);
      phases[phase][key].peak50msMean = Math.max(...a.slice(n50-1).map((_, i) => mean(a.slice(i, i+n50))));
      phases[phase][key].late250msMean = mean(a.slice(-Math.round(.25/DT)));
      phases[phase][key].late1sMean = mean(a.slice(-Math.round(1/DT)));
    }
    phases[phase].last1s = {steps: t.slice(-Math.round(1/DT)).length, omegaMeanRadps: mean(t.slice(-Math.round(1/DT)).map(r=>r.swordOmegaRadps)), absAxialMeanRadps: mean(t.slice(-Math.round(1/DT)).map(r=>r.absAxialOmegaRadps)), handTargetSpeedMeanMps: mean(t.slice(-Math.round(1/DT)).map(r=>r.handCommandSpeedMps)), aimTargetTurnMeanRadps: mean(t.slice(-Math.round(1/DT)).map(r=>r.aimCommandTurnRadps)), finalControllerPhase: t.at(-1).swordsmanshipPhase};
    phases[phase].swordsmanshipPhases = Object.fromEntries([...new Set(t.map(r => r.swordsmanshipPhase))].map(p => [p, t.filter(r => r.swordsmanshipPhase === p).length]));
    phases[phase].swingingSteps = t.filter(r => r.swinging).length;
    phases[phase].negativeMotorRotWorkJ = t.reduce((s, r) => s + Math.max(0, -r.motorRotPowerW) * DT, 0);
    phases[phase].negativeOffRotWorkJ = t.reduce((s, r) => s + Math.max(0, -r.offRotPowerW) * DT, 0);
    phases[phase].motorBrakingSteps = t.filter(r => r.motorRotPowerW < -1e-9).length;
    phases[phase].gripCapSaturatedSteps = t.filter(r => r.offCalls && r.offForceN >= r.gripForceCapN - 1e-6).length;
    if (phase !== 'prefix' && (phase.endsWith('Hold') || phase === 'release')) {
      const previous = trace[t[0].tick - 1], threshold = previous.swordOmegaRadps * .5;
      const stop = t.findIndex((r, i) => i + 2 < t.length &&
        t.slice(i, i + 3).every(sample => sample.swordOmegaRadps <= threshold));
      phases[phase].inputStopResponse = {startingOmegaRadps: previous.swordOmegaRadps,
        endOmegaRadps: t.at(-1).swordOmegaRadps,
        firstSustainedHalfOmegaS: stop < 0 ? null : (stop + 1) * DT,
        criterion: 'Three consecutive samples at <= half the prior input phase final angular speed; null means not observed.'};
    }
  }
  return phases;
}

class Idle { update() {} }
const rows = [], startedUTC = new Date().toISOString(), start = performance.now();
for (const weapon of options.weapons) for (const condition of options.conditions) for (const mode of options.modes) {
  const name = `${weapon}-${condition}-${mode}`, directory = path.join(out, name);
  fs.mkdirSync(directory);
  const G = newRound({seed: protocol.seed, weapon, weapon2: 'longsword', walls: false,
    gap: protocol.gapM, skill: .7, AIClass: Idle, onFighter: f => {
      f.armSupportModel = 'linked';
      if (f.index !== 0) return;
      f.onehandArmModel = mode === 'v2' ? 'manual' : 'legacy';
      const policy = configureCombatDefaults(entry, f.weapon);
      f.stanceMemoryModel = policy.stance; f.rollTargetModel = policy.roll;
    }});
  const f = G.player;
  if (mode === 'v2') assert(applySwordsmanship(f));
  else { assert.equal(f.skill.level, .7); f.skill.autoGuard = true; }
  assert.equal(f.gripPointModel, 'axial');
  f.canShove = true;
  const policy = configureCombatDefaults(entry, f.weapon);
  G.combat.cutReactionModel = policy.cut; G.combat.cutReactionFighter = f;
  G.combat.finishRuleModel = 'power'; G.combat.finishRuleFighter = null;
  const observed = observe(f), trace = [], preparation = [], prefix = createHash('sha256'),
    physicsHash = createHash('sha256'), inputHash = createHash('sha256');
  let tick = 0, accepted = true, finite = true;
  const spawn = saveState(G, directory, 'spawn', tick);
  G.before = () => {
    observed.reset();
    if (tick === 300) {
      const before = saveState(G, directory, 'pre-condition', tick);
      if (condition === 'severe') f.limbs.armO = .2;
      const after = saveState(G, directory, 'post-condition', tick);
      assert.equal(before.physicsSnapshot.sha256, after.physicsSnapshot.sha256,
        'Function fixture must not alter native body state');
      preparation.push({kind: 'direct-limb-function', tick, before, after});
    }
    const r = tape[tick];
    f.handOffset.x += r.dx; f.handOffset.y += r.dy; f.handHeld = r.held;
    f.inputActive = Math.abs(r.dx) + Math.abs(r.dy) > 1e-5;
    f.move.set(0, 0); f.stickX = f.stickY = 0;
    const input = {id: tick, timeS: G.t, dx: r.dx, dy: r.dy, held: r.held, active: f.inputActive};
    const recorded = recordSwordsmanshipInput(f, input);
    accepted &&= recorded === (mode === 'v2'); inputHash.update(JSON.stringify(input));
  };
  try {
    for (tick = 0; tick < tape.length; tick++) {
      G.step();
      const physicsSnapshot = G.world.takeSnapshot();
      physicsHash.update(physicsSnapshot);
      if (tick < 300) prefix.update(physicsSnapshot);
      const m = observed.measurement, allBodies = G.world.bodies.getAll();
      const bodiesFinite = allBodies.every(finiteBody); finite &&= bodiesFinite;
      const hand = new THREE.Vector3(.13, 0, 0).applyQuaternion(Q(f.bodies.farmS.rotation()))
        .add(V(f.bodies.farmS.translation()));
      const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword.rotation()));
      const swordQ = Q(f.sword.rotation()), swordP = V(f.sword.translation());
      const edgeHalfWidth = weapon === 'monohoshizao' ? .015 : .012;
      const edgePoint = sign => new THREE.Vector3(sign * edgeHalfWidth, f.weaponCfg.hiltLength + .7*f.weaponCfg.bladeLength, 0).applyQuaternion(swordQ).add(swordP);
      const edgeSpeedMps = Math.max(...[-1,1].map(sign => norm(f.sword.velocityAtPoint(edgePoint(sign)))));
      const off = new THREE.Vector3(0,-.135,0).applyQuaternion(Q(f.bodies.farmO.rotation())).add(V(f.bodies.farmO.translation()));
      const pommel = new THREE.Vector3(0,f.weaponCfg.gripAlong,0).applyQuaternion(swordQ).add(swordP);
      const omega = V(f.sword.angvel()), axial = omega.dot(blade);
      const row = {tick, timeS: G.t, phase: tape[tick].phase, armO: f.limbs.armO,
        detached: !!f.detachedParts?.has('farmO'), finite: bodiesFinite, bodyCount: allBodies.length,
        state: f.state, alive: f.alive, armed: f.armed, blood: f.blood, pain: f.pain,
        gripping: !!f.gripping, muscle: f.muscle, armHealth: f.armHealth,
        armSupport: f.cache?.armSupport ? {...f.cache.armSupport} : null,
        strikeSupportScale: strikeArmSupportScale(f), swingAssistKg: strikeArmAssist(f),
        thrustAssistKg: strikeArmAssist(f, 'thrust'),
        gripForceCapN: CONFIG.GRIP.maxForce * offhandHealthScale(f),
        offForceN: m.offForceAbsN, offForce: plain(m.offForce), offCalls: m.offCalls,
        offTorqueNm: m.offTorque.length(), offTorque: plain(m.offTorque),
        motorTorqueNm: m.motorTorque.length(), motorTorque: plain(m.motorTorque), motorCalls: m.motorCalls,
        combinedControlTorqueNm: m.motorTorque.clone().add(m.offTorque).length(),
        motorRotPowerW: m.motorRotPowerW, offRotPowerW: m.offRotPowerW, offPointPowerW: m.offPointPowerW,
        wristCapNm: f.debug.wristCap,
        baseWristCapNm: f.weaponCfg.maxAimTorque * f.strength * mainArmMuscle(f) * (.35 + .65 * f.armHealth),
        wristBrake: !!f.wristBrake, handActual: plain(hand), handTarget: plain(f.handTarget),
        handErrorM: hand.distanceTo(f.handTarget), mainGripGapM: hand.distanceTo(swordP), offGripGapM: off.distanceTo(pommel), aimActual: plain(blade), aimTarget: plain(f.debug.aim),
        aimCommandTurnRadps: trace.length ? f.debug.aim.angleTo(V(trace.at(-1).aimTarget)) / DT : 0,
        handCommandSpeedMps: trace.length ? f.handTarget.distanceTo(V(trace.at(-1).handTarget)) / DT : 0,
        aimErrorRad: blade.angleTo(f.debug.aim), swordOmegaRadps: norm(f.sword.angvel()),
        axialOmegaRadps: axial, absAxialOmegaRadps: Math.abs(axial), swingOmegaRadps: omega.clone().addScaledVector(blade,-axial).length(),
        edgeSpeedMps, center70SpeedMps: norm(f.sword.velocityAtPoint(f.bladePoint(.7, new THREE.Vector3()))),
        handOffset: f.handOffset.toArray(), skillAim: f.skill.aim.toArray(), swinging: f.skill.swinging, recovering: f.skill.recovering,
        tipSpeedMps: norm(f.sword.velocityAtPoint(f.bladePoint(1, new THREE.Vector3()))),
        swordEnergyJ: kinetic(f.sword), swordsmanshipPhase: f.swordsmanshipState?.phase ?? 'legacy',
        woundCount: G.wounds.length, clashCount: G.clashes};
      trace.push(row);
      if (tick === 299 || tick === 431 || tick === 461 || tick === 557 || tick === 623 || tick === tape.length-1) saveState(G,directory,`checkpoint-${tick}`,tick);
    }
    const raw = path.join(directory, 'trace.jsonl');
    fs.writeFileSync(raw, `${trace.map(r => JSON.stringify(r)).join('\n')}\n`, {flag: 'wx'});
    const row = {weapon, condition, mode, steps: trace.length, finite, accepted,
      spawnSHA256: spawn.physicsSnapshot.sha256, prefixSHA256: prefix.digest('hex'),
      physicsSHA256: physicsHash.digest('hex'), inputSHA256: inputHash.digest('hex'),
      allAliveArmed: trace.every(r => r.alive && r.armed), states: [...new Set(trace.map(r => r.state))],
      observedWounds: G.wounds.length, observedClashes: G.clashes, preparation,
      phases: summarize(trace), raw: {path: raw, bytes: fs.statSync(raw).size, sha256: sha(fs.readFileSync(raw))}};
    writeJSON(path.join(directory, 'summary.json'), row);
    rows.push(row);
    console.log(JSON.stringify({weapon, condition, mode, finite, accepted, steps: row.steps,
      inputSHA256: row.inputSHA256, prefixSHA256: row.prefixSHA256, observedWounds: row.observedWounds,
      firstCut: row.phases.firstCut, recutHold: row.phases.recutHold}));
  } catch (error) {
    writeJSON(path.join(directory, 'failure.json'), {tick, error: String(error), stack: error.stack, preparation});
    fs.writeFileSync(path.join(directory, 'partial-trace.jsonl'), `${trace.map(r => JSON.stringify(r)).join('\n')}\n`, {flag: 'wx'});
    throw error;
  } finally { G.eventQueue.free(); G.world.free(); }
}
const pairing = options.weapons.flatMap(weapon => options.modes.map(mode => {
  const runs = rows.filter(r => r.weapon === weapon && r.mode === mode);
  return {weapon, mode, identicalSpawn: new Set(rows.filter(r=>r.weapon===weapon).map(r=>r.spawnSHA256)).size===1,
    identicalHealthyPrefix: new Set(runs.map(r => r.prefixSHA256)).size === 1,
    identicalRequestedInput: new Set(rows.filter(r=>r.weapon===weapon).map(r=>r.inputSHA256)).size===1};
}));
const checks = {allAliveArmed: rows.every(r=>r.allAliveArmed), allStanding: rows.every(r=>r.states.length===1&&r.states[0]==='stand'), noDamageContact: rows.every(r=>r.observedWounds===0&&r.observedClashes===0), finite: rows.every(r => r.finite), accepted: rows.every(r => r.accepted),
  identicalSpawn: pairing.every(p => p.identicalSpawn), identicalHealthyPrefix: pairing.every(p => p.identicalHealthyPrefix),
  identicalRequestedInput: pairing.every(p => p.identicalRequestedInput),
  frozenSourceStable: JSON.stringify(manifest(frozenRoot)) === JSON.stringify(sourceBefore)};
const report = {head, startedUTC, finishedUTC: new Date().toISOString(), wallSeconds: (performance.now() - start) / 1000,
  protocol, checks, pairing, sourceBefore, frozenSourceAfter: manifest(frozenRoot), rows,
  measurementDefinitions: {
    peak50msMean: 'Largest contiguous six-frame mean within each named phase; attack/free-motion values are not contact damage.',
    edgeSpeed: 'Max speed at both local x collider edges at 70% blade length: ±.015m mono, ±.012m light. Centerline tip unaffected by pure axial spin; edge speed exposes that contribution. Render taper/curve ignored.',
    motorTorque: 'Final actual driveSword addTorque vector, including edge/twist addition; wristCap/debug wristTorque are distinct.',
    offForce: 'Actual sword addForceAtPoint requests inside offHand only.',
    offTorque: 'Cross product of actual sword application point relative to sword COM and actual offHand force.',
    combinedControlTorque: 'Vector sum of explicit sword motor and offHand moments about sword COM; excludes native joint reaction/contact/gravity.',
    brakingWork: 'Integral of negative instantaneous torque dot sword angular velocity at application, not net energy loss or all-body dissipation.',
    baseWristCap: 'Original unscaled main-arm base before Hill force/velocity limit, kept as reference.',
    virtualContactAssist: 'Read-only strikeArmAssist/current cached support values; available virtual contribution, not measured contact damage or force.',
  },
  limitations: ['No natural wound prevalence, damage balance, contact power, revive or screen/phone validation in this tape.',
    'Input stop can retain filtered/assisted target motion; release may enter ordinary v2 home return.',
    'Legacy recorder returning false is expected/verified; only v2 consumes the same input event. Controller differs from creation, so cross-mode pre-input prefixes need not match.',
    'No assertion that loss of offhand support must lower peak tip speed, angular speed or energy.',
    'Transparent method wrappers submit unchanged arguments; no separate observer-off equivalence run.'],
};
writeJSON(path.join(out, 'report.json'), report);
assert(Object.values(checks).every(Boolean), `Experiment validity checks failed: ${JSON.stringify(checks)}`);
