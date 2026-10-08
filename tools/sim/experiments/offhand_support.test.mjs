// Component regression of the optional linked off-hand candidate.
// Native Fighter/Combat/Rapier are used, but hand poses, contact states and wounds
// below are deliberately constructed fixtures, not naturally acquired gameplay.
// node tools/sim/experiments/offhand_support.test.mjs [external-report.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { newRound, CONFIG, THREE, DT } from '../harness_m.mjs';
import { offhandCanGrip, offhandHealthScale, sampleArmSupport, strikeArmAssist } from '../../../src/arm_support.js';
import { tryRevive, reviveTick } from '../../../src/revive.js';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.argv[2] || '/workspace/halfsword-handoff/offhand-support-20261008/components.json';
const sourceFiles = ['src/arm_support.js', 'src/fighter.js', 'src/combat.js', 'src/cut_reaction.js',
  'src/config.js', 'src/limb_sever.js', 'src/revive.js', 'tools/sim/harness_m.mjs',
  'tools/sim/experiments/offhand_support.test.mjs'];
const hashes = () => Object.fromEntries(sourceFiles.map(p => [p,
  crypto.createHash('sha256').update(fs.readFileSync(repo + p)).digest('hex')]));
const report = { startedUTC: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'],
  { cwd: repo, encoding: 'utf8' }).trim(), sourceBefore: hashes(), cases: [], rounds: 0,
  limitations: ['Synthetic supported poses can put the off-hand within reach without demonstrating an anatomically reachable arm pose.',
    'Cached contact fixtures call actual Combat.analyze/strike but are not native contact acquisition or natural wound frequency.',
    'Severing uses actual Fighter.applyWound with an explicit joint-local wound; revival uses the actual lifecycle API with controlled state transitions.',
    'Stuck fixtures seed an existing cut record and observe real Combat.afterStep/native impulses, rather than acquiring a stuck blade in a duel.'] };
class Passive { update() {} }
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const close = (actual, expected, message, eps = 1e-6) => assert.ok(Math.abs(actual - expected) <= eps,
  `${message}: expected ${expected}, observed ${actual}`);
function test(name, fn) {
  try { report.cases.push({ name, pass: true, evidence: fn() }); }
  catch (e) { report.cases.push({ name, pass: false, error: e.message, stack: e.stack }); console.error('FAIL', name, e.message); }
}
function round(options = {}) {
  report.rounds++;
  return newRound({ seed: 7, walls: false, weapon: 'longsword', weapon2: 'longsword',
    AIClass: Passive, ...options });
}
function withRound(fn, options) {
  const g = round(options);
  try { return fn(g); } finally { g.world.free(); }
}
function healthy(f, model = 'linked') {
  f.armSupportModel = model;
  f.state = 'stand'; f.armed = true; f.muscle = 1; f.limbs.armO = 1;
  f.detachedParts = new Set();
}
function poseHand(f, distance = 0) {
  const p = vec(0, f.weaponCfg.gripAlong, 0)
    .applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation()))
    .add(vec().copy(f.sword.translation()));
  f.bodies.farmO.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  f.bodies.farmO.setTranslation(p.add(vec(distance, .135, 0)), true);
  f.bodies.farmO.setLinvel(vec(), true); f.bodies.farmO.setAngvel(vec(), true);
}
function physicalPose(f, distance = .02, speed = 0) {
  f.sword.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  f.sword.setTranslation(vec(0, 2, 0), true);
  f.sword.setLinvel(vec(speed), true); f.sword.setAngvel(vec(), true);
  poseHand(f, distance);
}
function observeGrip(f) {
  const calls = [], saved = [];
  for (const [name, body] of [['hand', f.bodies.farmO], ['sword', f.sword]]) {
    const original = body.addForceAtPoint;
    saved.push(() => { body.addForceAtPoint = original; });
    body.addForceAtPoint = function(force, point, wake) {
      calls.push({ name, force: { ...force }, point: { ...point }, wake });
      return original.call(this, force, point, wake);
    };
  }
  try { f.offHand(); } finally { for (const restore of saved) restore(); }
  return { calls, gripping: f.gripping, forceN: calls.length ? Math.hypot(...Object.values(calls[0].force)) : 0 };
}
function pair(g, part = 'abdomen') {
  const entries = [...g.combat.info.entries()];
  const [wc, w] = entries.find(([, i]) => i.fighter === g.player && i.part === 'blade');
  const [vc, v] = entries.find(([, i]) => i.fighter === g.enemy && i.part === part);
  return { wc, vc, w, v };
}
function contactFixture(g, kind = 'cut', model = 'linked') {
  const f = g.player, vic = g.enemy, pr = pair(g);
  healthy(f, model); vic.state = 'stand';
  f.foe = vic; vic.foe = f;
  f.emoMods = { dealt: 1, pass: 0 }; vic.emoMods = { taken: 1, pass: 0 };
  f.skill.tap = null; f.skill.thrustPush = kind === 'stab';
  const point = vec().copy(pr.v.body.translation());
  const tip = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength * .95;
  f.sword.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  f.sword.setTranslation(point.clone().sub(vec(0, tip, 0)), true);
  f.sword.setLinvel(kind === 'stab' ? vec(0, 8, 0) : vec(18, 0, 0), true);
  f.sword.setAngvel(vec(), true);
  pr.v.body.setLinvel(vec(), true); pr.v.body.setAngvel(vec(), true);
  poseHand(f);
  f.cacheState(); vic.cacheState();
  return { f, vic, pr, point, S: f.cache.sword, P: vic.cache.parts.abdomen };
}
function forbidEngineReads(fighters, fn) {
  const restore = [];
  for (const f of fighters) for (const b of [f.sword, ...Object.values(f.bodies)]) {
    for (const name of ['translation', 'rotation', 'worldCom', 'linvel', 'angvel', 'velocityAtPoint', 'mass',
      'effectiveInvMass', 'effectiveWorldInvInertia', 'collider', 'numColliders']) {
      const original = b[name];
      if (typeof original !== 'function') continue;
      restore.push(() => { b[name] = original; });
      b[name] = () => { throw new Error(`Cached calculation read Rapier.${name}`); };
    }
  }
  try { return fn(); } finally { for (const fn of restore) fn(); }
}

test('configured baseline values and archived legacy assist remain exact', () => withRound(g => {
  const f = g.player;
  assert.equal(CONFIG.GRIP.maxForce, 250); assert.equal(CONFIG.GRIP.reach, .25);
  assert.equal(CONFIG.STRIKE.armAssist, .3); assert.equal(CONFIG.STRIKE.thrustAssist, 3.5);
  assert.ok(f.armSupportModel === undefined || f.armSupportModel === 'legacy');
  f.limbs.armO = 0; f.muscle = .02; f.state = 'down'; f.armed = false;
  close(strikeArmAssist(f), .3, 'default archived swing');
  close(strikeArmAssist(f, 'thrust'), 3.5, 'default archived thrust');
}));

test('actual offHand preserves healthy forces and scales saturated cap once', () => withRound(g => {
  const f = g.player, evidence = [];
  for (const [model, health, speed, expected] of [
    ['legacy', 1, 0, 30], ['linked', 1, 0, 30], ['legacy', .6, 0, 24], ['linked', .6, 0, 24],
    ['legacy', 1, 20, 250], ['linked', 1, 20, 250], ['legacy', .6, 20, 250], ['linked', .6, 20, 200],
  ]) {
    healthy(f, model); f.limbs.armO = health; physicalPose(f, .02, speed);
    const measured = observeGrip(f);
    close(measured.forceN, expected, `${model} health ${health} speed ${speed}`, 1e-4);
    assert.equal(measured.gripping, true); assert.equal(measured.calls.length, 2);
    for (const axis of ['x', 'y', 'z']) close(measured.calls[0].force[axis] + measured.calls[1].force[axis], 0, 'opposing pair');
    evidence.push({ model, health, speed, expectedN: expected, ...measured });
  }
  assert.deepEqual(evidence[0].calls, evidence[1].calls);
  assert.deepEqual(evidence[4].calls, evidence[5].calls);
  return evidence;
}));

test('linked physical release gates and virtual main-hand remainder', () => withRound(g => {
  const f = g.player, rows = [];
  const gates = [
    ['severe arm', () => { f.limbs.armO = .3; }], ['weak muscle', () => { f.muscle = .3; }],
    ['unarmed', () => { f.armed = false; }], ['down', () => { f.state = 'down'; }],
    ['dead', () => { f.state = 'dead'; }], ['detached forearm', () => { f.detachedParts.add('farmO'); }],
    ['detached upper arm', () => { f.detachedParts.add('uarmO'); }],
    ['grip disabled', () => { CONFIG.GRIP.on = false; }],
  ];
  const gripOn = CONFIG.GRIP.on;
  try {
    for (const [label, change] of gates) {
      CONFIG.GRIP.on = true; healthy(f); physicalPose(f); f.cacheState(); change();
      assert.equal(offhandCanGrip(f), false, label);
      const measured = observeGrip(f); assert.equal(measured.calls.length, 0, label);
      close(strikeArmAssist(f), .15, label + ' swing main remainder');
      close(strikeArmAssist(f, 'thrust'), 1.75, label + ' thrust main remainder');
      rows.push({ label, ...measured });
    }
  } finally { CONFIG.GRIP.on = gripOn; }
  return rows;
}));

test('cache snapshot is pure and independently reproduces reach, muscle and health weights', () => withRound(g => {
  const f = g.player, rows = [];
  for (const [distance, muscle, health, expectedSwing, expectedThrust] of [
    [0, 1, 1, .3, 3.5], [.1875, 1, 1, .225, 2.625], [.25, 1, 1, .15, 1.75],
    [.30, 1, 1, .15, 1.75], [0, 1, .6, .27, 3.15], [0, .5, 1, .225, 2.625],
    [0, .5, .6, .21, 2.45], [0, 2, 1, .3, 3.5],
  ]) {
    healthy(f); f.muscle = muscle; f.limbs.armO = health; physicalPose(f, distance); f.cacheState();
    const before = JSON.stringify(f.cache), oldGrip = f.gripping;
    const sampled = forbidEngineReads([f], () => sampleArmSupport(f, f.cache));
    assert.equal(JSON.stringify(f.cache), before); assert.equal(f.gripping, oldGrip);
    assert.deepEqual(f.cache.armSupport, sampled, 'cacheState saves the same pure snapshot');
    close(strikeArmAssist(f), expectedSwing, 'weighted swing', 1e-6);
    close(strikeArmAssist(f, 'thrust'), expectedThrust, 'weighted thrust', 1e-5);
    rows.push({ distance, muscle, health, sampled, expectedSwing, expectedThrust });
  }
  close(offhandHealthScale({ limbs: { armO: .6 } }), .8, 'partial arm scale');
  return rows;
}));

test('current injury cuts stale support immediately and healing waits for a fresh sample', () => withRound(g => {
  const f = g.player; healthy(f); physicalPose(f, 0); f.cacheState();
  close(strikeArmAssist(f), .3, 'healthy cached');
  f.limbs.armO = .6; close(strikeArmAssist(f), .27, 'new partial injury');
  f.limbs.armO = 1; f.muscle = .5; close(strikeArmAssist(f), .225, 'new weakness');
  f.muscle = 1; f.limbs.armO = .6; f.cacheState();
  f.limbs.armO = 1; close(strikeArmAssist(f), .27, 'healing cannot exceed stale sample');
  f.cacheState(); close(strikeArmAssist(f), .3, 'new sample clears health penalty');
}));

for (const kind of ['cut', 'stab']) test(`cached ${kind}: healthy equality, severe assist and actual wound agree`, () => {
  const rows = [];
  for (const [model, health, expectedAssist] of [
    ['legacy', 1, kind === 'stab' ? 3.5 : .3], ['linked', 1, kind === 'stab' ? 3.5 : .3],
    ['linked', .3, kind === 'stab' ? 1.75 : .15],
  ]) rows.push(withRound(g => {
    const { f, vic, pr, point, S, P } = contactFixture(g, kind, model);
    f.limbs.armO = health; // Deliberately injure after the healthy support cache.
    const cachedBefore = JSON.stringify([f.cache, vic.cache]), woundsBefore = vic.wounds.length;
    const results = forbidEngineReads([f, vic], () => ({
      prediction: g.combat.analyze(pr, point, S, P, true),
      analysis: g.combat.analyze(pr, point, S, P),
    }));
    assert.equal(JSON.stringify([f.cache, vic.cache]), cachedBefore, 'analyze does not mutate snapshots');
    assert.equal(vic.wounds.length, woundsBefore, 'analyze is wound-free');
    assert.equal(results.analysis.type, kind); assert.equal(results.prediction.type, kind);
    assert.deepEqual(results.prediction, results.analysis, 'penetrating prediction and analysis match');
    close(results.analysis.mEff - results.analysis.mFree, expectedAssist, 'independent assist mass');
    close(results.analysis.ephys, .5 * (results.analysis.mFree + expectedAssist) * results.analysis.speed ** 2, 'physical strike energy');
    const actual = g.combat.strike(pr, point, true);
    assert.ok(actual); assert.ok(actual.severity > 0); assert.equal(vic.wounds.length, woundsBefore + 1);
    for (const key of ['type', 'mEff', 'mFree', 'energy', 'ephys', 'severity', 'pass']) assert.equal(actual[key], results.analysis[key], key);
    close(vic.wounds.at(-1).severity, actual.severity, 'actual wound severity');
    return { model, health, expectedAssist, result: results.analysis, actualSeverity: vic.wounds.at(-1).severity };
  }));
  assert.deepEqual(rows[0].result, rows[1].result, 'healthy candidate exactly matches archived analyzer');
  close(rows[1].result.mFree, rows[2].result.mFree, 'injury does not alter rigid sword effective mass');
  close(rows[1].result.energy - rows[2].result.energy,
    (kind === 'stab' ? 1.75 : .15) * rows[1].result.speed ** 2, 'only the support assist changes strike energy');
  return rows;
});

test('one-hand weapons retain full assist and never gain an off-hand grip', () => withRound(g => {
  const f = g.player; healthy(f); f.limbs.armO = 0; f.detachedParts.add('farmO');
  assert.equal(f.weaponCfg.twoHand, false);
  physicalPose(f); f.cacheState();
  close(strikeArmAssist(f), .3, 'one-hand swing'); close(strikeArmAssist(f, 'thrust'), 3.5, 'one-hand thrust');
  assert.equal(observeGrip(f).calls.length, 0);
}, { weapon: 'sabre' }));

test('actual wound severing overrides a healthy cache without reading Rapier in the helper', () => withRound(g => {
  const { f, vic, pr, point, S, P } = contactFixture(g);
  const cached = JSON.stringify(f.cache.armSupport), joint = f.jointByName.farmO.joint;
  const local = vec().copy(joint.anchor2()), handle = joint.handle;
  const previous = CONFIG.COMBAT.limbSeverTrial;
  try {
    CONFIG.COMBAT.limbSeverTrial = true;
    f.applyWound({ part: 'farmO', zone: 'arm', type: 'cut', severity: 1.3, energy: 120,
      bleedPerSev: .015, local, dir: vec(1), pass: true, passing: true, stuck: false });
  } finally { CONFIG.COMBAT.limbSeverTrial = previous; }
  assert.equal(f.jointByName.farmO.joint, null); assert.equal(g.world.getImpulseJoint(handle), null);
  assert.ok(f.detachedParts.has('farmO')); assert.equal(f.severedLimbs.length, 1);
  assert.equal(JSON.stringify(f.cache.armSupport), cached, 'sever happens after healthy cache');
  f.limbs.armO = 1; // Attached-part gate must work even if health is accidentally restored.
  forbidEngineReads([f], () => {
    assert.equal(offhandCanGrip(f), false); close(strikeArmAssist(f), .15, 'detachment gate');
  });
  const after = forbidEngineReads([f, vic], () => g.combat.analyze(pr, point, S, P, true));
  close(after.mEff - after.mFree, .15, 'cached Combat immediately excludes actually severed support');
  assert.equal(observeGrip(f).calls.length, 0);
  assert.equal(tryRevive(f, 'blood'), false, 'revival does not regrow a severed limb');
  return { detached: [...f.detachedParts], cachedBeforeSever: JSON.parse(cached), swingAfterSever: strikeArmAssist(f) };
}, { revive2: { count: 1 } }));

test('revival and a new round do not retain the previous disabled support snapshot', () => {
  const revived = withRound(g => {
    const f = g.player; healthy(f); physicalPose(f, 0); f.limbs.armO = .2; f.cacheState();
    close(strikeArmAssist(f), .15, 'initial disabled arm');
    assert.equal(tryRevive(f, 'blood'), true); reviveTick(f, f.revive.lie + .01);
    close(f.limbs.armO, .4, 'actual revival restores configured partial arm');
    // Controlled component transition: this does not claim native getup success.
    f.setState('stand'); f.muscle = 1;
    reviveTick(f, .01); reviveTick(f, f.revive.linger + f.revive.fade + .01);
    assert.equal(f.revival, null);
    physicalPose(f, 0); f.cacheState();
    close(strikeArmAssist(f), .255, 'restored partial arm receives a fresh sample');
    return { restoredArm: f.limbs.armO, swing: strikeArmAssist(f), sample: f.cache.armSupport };
  }, { revive2: { count: 1 } });
  const fresh = withRound(g => {
    const f = g.player; assert.equal(f.limbs.armO, 1); assert.ok(!f.detachedParts?.size);
    healthy(f); physicalPose(f, 0); f.cacheState(); close(strikeArmAssist(f), .3, 'new round healthy assist');
    return { swing: strikeArmAssist(f), sample: f.cache.armSupport };
  });
  return { revived, fresh };
});

for (const reaction of ['legacy', 'centerline', 'budgeted']) test(`${reaction} stuck resistance uses the same reduced assist budget`, () => {
  const rows = [];
  for (const [model, health, expectedRequest] of [['legacy', 1, .16], ['linked', 1, .16], ['linked', .3, .1]]) {
    rows.push(withRound(g => {
      const f = g.player, pr = pair(g); healthy(f, model); physicalPose(f, 0, .5); f.cacheState();
      f.limbs.armO = health; pr.v.body.setLinvel(vec(), true); pr.v.body.setAngvel(vec(), true);
      const point = vec().copy(f.sword.worldCom());
      const localPt = point.clone().sub(vec().copy(f.sword.translation()));
      const key = `${pr.wc}:${pr.vc}`;
      g.combat.cutting.set(key, { seen: 0, applied: true, pr, wc: pr.wc, vc: pr.vc,
        Eleft: 0, stuck: true, mFree: .1, stuckT: .25, localPt });
      g.combat.cutReactionModel = reaction; g.combat.cutReactionFighter = f;
      const impulses = [], diagnostics = [];
      const original = f.sword.applyImpulseAtPoint;
      f.sword.applyImpulseAtPoint = function(J, p, wake) {
        impulses.push({ ...J }); return original.call(this, J, p, wake);
      };
      g.combat.onCutReaction = r => diagnostics.push(r);
      try { g.combat.afterStep(g.world, g.eventQueue); } finally { f.sword.applyImpulseAtPoint = original; }
      const requested = reaction === 'legacy' ? Math.hypot(...Object.values(impulses[0] || {})) : diagnostics[0]?.requestedJ;
      close(requested, expectedRequest, 'independent stuck request 0.8 * (.1 + assist) * .5');
      assert.equal(impulses.length, 1); close(g.combat.cutting.get(key).stuckT, .25 - DT, 'stuck timer unchanged');
      return { model, health, expectedRequest, requested, impulses, diagnostics };
    }));
  }
  return rows;
});

report.sourceAfter = hashes();
report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
report.pass = report.sourceStable && report.cases.every(t => t.pass);
report.completedUTC = new Date().toISOString();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, pass: report.pass, cases: report.cases.length, rounds: report.rounds,
  failed: report.cases.filter(t => !t.pass).map(t => t.name), sourceStable: report.sourceStable }));
process.exitCode = report.pass ? 0 : 1;
