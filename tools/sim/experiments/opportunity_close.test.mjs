// Command contracts using real Fighter/Skill wiring, without native steps.
// Native wounds, arm naturalness and success rates need the separate probe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, THREE } from '../harness_m.mjs';
import { Skill } from '../../../src/skill.js';
import { ARM } from '../../../src/config.js';
import { captureCloseThrust, updateCloseThrust } from '../../../src/opportunity_close.js';
import { captureCloseCut, updateCloseCut } from '../../../src/opportunity_close_cut.js';
import { configureOpportunityTrial } from '../../../src/opportunity_trial.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = 'b1392e360d10ef87dcb656dcb49a3221d763cdb0';
let oldSource = execFileSync('git', ['show', `${baseline}:src/skill.js`], { cwd: root, encoding: 'utf8' });
oldSource = oldSource.replace(/from '([^']+)'/g, (_, name) => `from '${name.startsWith('.')
  ? new URL('src/' + name.slice(2), new URL('../../../', import.meta.url)).href : import.meta.resolve(name)}'`);
const { Skill: OriginalSkill } = await import('data:text/javascript;base64,' + Buffer.from(oldSource).toString('base64'));
const checks = [], V = a => new THREE.Vector3(...a);
// Native quaternion reads are float32; normalizing the owned direction can
// differ by a few billionths even with no native step.
const same = (a, b) => assert.ok(V(a).distanceTo(V(b)) < 1e-7, `${a} != ${b}`);
function check(name, fn) { fn(); checks.push(name); }
function withRound(weapon, fn, SkillClass = Skill) {
  const G = newRound({ seed: 31, weapon, weapon2: 'longsword', gap: 1.25, walls: false });
  try {
    const f = G.player; f.foe = G.enemy; G.enemy.foe = f;
    f.skill = new SkillClass(f); f.opportunityModel = 'v4'; f.opportunityCloseThrust = true;
    f.opportunityTapKind = weapon === 'estoc' ? 'cut' : 'thrust';
    f.finishEntryModel = 'legacy'; f.finish.on = false; f.finish.amt = 0;
    // An authored command fixture, not a replayed native posture.
    f.handBase = [.28, -.17, .38];
    const grip = f.sword.translation(), swordQ = f.sword.rotation();
    f.handTarget.set(grip.x, grip.y, grip.z);
    f.aimDirW.set(0, 1, 0).applyQuaternion(new THREE.Quaternion(swordQ.x, swordQ.y, swordQ.z, swordQ.w));
    const c = f.bodies.chest.translation();
    const target = V([.87, -.16, -.056]).applyQuaternion(f.yaw).add(new THREE.Vector3(c.x, c.y, c.z));
    const opening = { kind: f.opportunityTapKind, target, targetId: f.foe.index, zone: 'neck' };
    return fn(f, opening, G);
  } finally { G.eventQueue.free(); G.world.free(); }
}
function nativeState(G) {
  return [G.player, G.enemy].map(f => Object.fromEntries(Object.entries({ ...f.bodies, sword: f.sword })
    .map(([name, b]) => [name, [b.translation(), b.rotation(), b.linvel(), b.angvel()]])));
}
function shoulders(f) {
  const q = f.bodies.chest.rotation();
  const body = new THREE.Quaternion(q.x, q.y, q.z, q.w).premultiply(f.yaw.clone().invert());
  const main = V(ARM.shoulder), other = V(ARM.shoulder);
  main.z *= f.side; other.z *= -f.side;
  return [main.applyQuaternion(body), other.applyQuaternion(body)];
}
function reachable(f, hand, dir) {
  const [main, other] = shoulders(f), radius = ARM.upper + ARM.fore - ARM.slack;
  assert.ok(V(hand).distanceTo(main) <= radius + 1e-9);
  if (f.weaponCfg.twoHand) assert.ok(V(hand).addScaledVector(V(dir), f.weaponCfg.gripAlong).distanceTo(other) <= radius + 1e-9);
}

check('flag off keeps ordinary Skill command trace identical to delivered controller', () => {
  const trace = Class => withRound('rapier', (f, opening) => {
    f.opportunityCloseThrust = false; f.opportunityModel = 'v3';
    assert.equal(f.skill.thrust({ step: false, opportunityTarget: opening }), true);
    const timing = { ...f.skill.tap.K }, frames = [];
    for (let i = 0; i < 65; i++) {
      f.skill.updateThrust(1 / 120);
      frames.push({ hand: [...f.skill.thrustPose.hand], dir: [...f.skill.thrustPose.dir],
        w: f.skill.thrustPose.w, push: f.skill.thrustPush, tap: !!f.skill.tap });
    }
    return { timing, frames };
  }, Class);
  assert.deepEqual(trace(Skill), trace(OriginalSkill));
});

check('ordinary tap in close trial retains its ordinary lunge', () => {
  for (const close of [false, true]) withRound('rapier', f => {
    f.opportunityCloseThrust = close; f.gait.active = false;
    assert.equal(f.skill.thrust({ opportunityTarget: null }), true);
    assert.ok(f.skill.lunge > 0); assert.equal(f.skill.tap.opportunity, undefined);
  });
});

check('rapier starts immediate close attack without range queue, movement command or native mutation', () => withRound('rapier', (f, opening, G) => {
  const before = nativeState(G), target = opening.target.toArray(), hand = f.handBase.slice();
  f.move.set(.17, -.38); const move = f.move.toArray();
  assert.equal(f.skill.thrust({ opportunityTarget: opening }), true);
  assert.ok(f.skill.tap?.opportunityClose); assert.ok(!f.skill.thrustRange); assert.equal(f.skill.lunge, 0);
  const tap = f.skill.tap, plan = tap.opportunityClose, pose = { hand: [0, 0, 0], dir: [0, 0, 0] };
  tap.t = 0; updateCloseThrust(f, tap, pose); same(pose.hand, tap.h0); same(pose.dir, plan.startDir);
  for (let i = 0; i <= 20; i++) {
    tap.t = tap.K.aim + tap.K.extend * i / 20; updateCloseThrust(f, tap, pose);
    reachable(f, pose.hand, pose.dir); assert.ok([...pose.hand, ...pose.dir].every(Number.isFinite));
  }
  const frozen = structuredClone(pose); opening.target.set(99, 99, 99);
  updateCloseThrust(f, tap, pose); assert.deepEqual(pose, frozen);
  assert.deepEqual(tap.opportunity.target, target); assert.deepEqual(f.move.toArray(), move);
  assert.deepEqual(nativeState(G), before);
}));

check('unreachable or blocked rapier geometry does not produce a fabricated plan', () => withRound('rapier', (f, opening) => {
  assert.equal(captureCloseThrust(f, new THREE.Vector3(90, 0, 0), f.handBase, .5), null);
  const blocked = { ...f, headR: 10 };
  assert.equal(captureCloseThrust(blocked, opening.target, f.handBase, .5), null);
  assert.equal(captureCloseThrust({ ...f, opportunityCloseThrust: false }, opening.target, f.handBase, .5), null);
}));

check('estoc cut crosses captured neck plane within both arm limits and freezes target', () => withRound('estoc', (f, opening, G) => {
  const before = nativeState(G), target = opening.target.toArray();
  assert.equal(f.skill.thrust({ opportunityTarget: opening }), true);
  assert.ok(f.skill.tap.opportunityCut); assert.ok(!f.skill.tap.opportunityClose); assert.ok(!f.skill.tap.opportunityPrecision);
  const tap = f.skill.tap, p = tap.opportunityCut, pose = { hand: [0, 0, 0], dir: [0, 0, 0] };
  tap.t = 0; updateCloseCut(f, tap, pose); same(pose.hand, p.start); same(pose.dir, p.startDir);
  for (let i = 0; i <= 20; i++) {
    tap.t = tap.K.aim + tap.K.extend * i / 20; updateCloseCut(f, tap, pose);
    reachable(f, pose.hand, pose.dir); assert.ok(pose.dir[0] > 0);
  }
  tap.t = tap.K.aim + tap.K.extend / 2; updateCloseCut(f, tap, pose);
  same(V(pose.hand).addScaledVector(V(pose.dir), p.along).toArray(), p.targetLocal);
  assert.ok(p.along > f.weaponCfg.hiltLength && p.along < f.weaponCfg.hiltLength + f.weaponCfg.bladeLength);
  const frozen = structuredClone(pose); opening.target.set(99, 99, 99);
  updateCloseCut(f, tap, pose); assert.deepEqual(pose, frozen);
  assert.deepEqual(tap.opportunity.target, target); assert.deepEqual(p.target, target);
  assert.deepEqual(nativeState(G), before);
}));

check('actual Skill cut never enables thrust impact assistance, damage spec or native mutation', () => withRound('estoc', (f, opening, G) => {
  const before = nativeState(G), mCut = f.weaponCfg.mCut, mThrust = f.weaponCfg.mThrust;
  assert.equal(f.skill.thrust({ opportunityTarget: opening }), true);
  let count = 0;
  while (f.skill.tap && count++ < 160) {
    f.skill.updateThrust(1 / 120); assert.equal(f.skill.thrustPush, false);
    assert.ok([...f.skill.thrustPose.hand, ...f.skill.thrustPose.dir].every(Number.isFinite));
  }
  assert.ok(count < 160); assert.equal(f.weaponCfg.mCut, mCut); assert.equal(f.weaponCfg.mThrust, mThrust);
  assert.deepEqual(nativeState(G), before);
}));

check('own chest translation and yaw cannot carry the captured cut plane away', () => withRound('estoc', (f, opening) => {
  const plan = captureCloseCut(f, opening.target, f.handBase); assert.ok(plan);
  const tap = { opportunity: { kind: 'cut' }, opportunityCut: plan,
    K: { aim: plan.aim, extend: plan.extend }, t: plan.aim + plan.extend / 2 };
  const c = f.bodies.chest.translation(), shifted = { x: c.x + .1, y: c.y - .07, z: c.z + .04 };
  const moved = { ...f, yaw: f.yaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .2)),
    bodies: { ...f.bodies, chest: { translation: () => shifted } } };
  const pose = { hand: [0, 0, 0], dir: [0, 0, 0] };
  updateCloseCut(moved, tap, pose);
  const crossing = V(pose.hand).addScaledVector(V(pose.dir), plan.along)
    .applyQuaternion(moved.yaw).add(new THREE.Vector3(shifted.x, shifted.y, shifted.z));
  same(crossing.toArray(), plan.target);
}));

check('own tracking trim is bounded during preparation and frozen before the cut', () => withRound('estoc', (f, opening) => {
  const plan = captureCloseCut(f, opening.target, f.handBase); assert.ok(plan);
  const pose = { hand: [0, 0, 0], dir: [0, 0, 0] };
  const tap = { opportunity: { kind: 'cut' }, opportunityCut: plan,
    K: { aim: plan.aim, extend: plan.extend }, t: plan.aim };
  f.handTarget.y += 1;
  f.aimDirW.set(1, 1, 0).normalize();
  updateCloseCut(f, tap, pose);
  assert.ok(Math.abs(plan.handTrim) <= .06); assert.ok(Math.abs(plan.pitchTrim) <= .07);
  assert.ok(plan.handTrim > 0 && plan.pitchTrim > 0); assert.equal(plan.trackingLocked, true);
  const frozen = structuredClone(pose), trims = [plan.handTrim, plan.pitchTrim];
  f.handTarget.y -= 10; f.aimDirW.set(1, -1, 0).normalize();
  updateCloseCut(f, tap, pose);
  assert.deepEqual([plan.handTrim, plan.pitchTrim], trims); assert.deepEqual(pose, frozen);
}));

check('blocked, unreachable or noncuttable cut plans fail without a substitute cut', () => withRound('estoc', (f, opening) => {
  assert.equal(captureCloseCut({ ...f, headR: 10 }, opening.target, f.handBase), null);
  assert.equal(captureCloseCut(f, new THREE.Vector3(90, 0, 0), f.handBase), null);
  assert.equal(captureCloseCut({ ...f, weaponCfg: { ...f.weaponCfg, mCut: 0 } }, opening.target, f.handBase), null);
  f.headR = 10;
  assert.equal(f.skill.thrust({ opportunityTarget: opening }), false); assert.equal(f.skill.tap, null);
}));

check('comparison query rejects duplicate controls and unrecognized settings', () => {
  for (const weapon of ['rapier', 'estoc']) {
    const info = configureOpportunityTrial(new URLSearchParams(`opportunity=close&weapon=${weapon}&drill=near`));
    assert.equal(info.active, true); assert.equal(info.close, true);
  }
  for (const query of ['opportunity=close&opportunity=flow', 'opportunity=close&weapon=rapier&weapon=estoc',
    'opportunity=close&weapon=rapier&drill=near&drill=far', 'opportunity=close&weapon=rapier&force=9',
    'opportunity=close&weapon=rapier&drill=unknown']) {
    const info = configureOpportunityTrial(new URLSearchParams(query)); assert.equal(info.active, false); assert.equal(info.close, false);
  }
  assert.equal(configureOpportunityTrial(new URLSearchParams()).close, false);
});

const paths = ['src/skill.js', 'src/opportunity_close.js', 'src/opportunity_close_cut.js', 'src/opportunity_trial.js',
  'tools/sim/experiments/opportunity_close.test.mjs'];
const report = { pass: true, baseline, nativeSteps: 0, checks,
  scope: 'Authored command fixtures and real Skill wiring only; native injury success and motion quality unverified.',
  hashes: Object.fromEntries(paths.map(p => [p, createHash('sha256').update(fs.readFileSync(new URL(p, new URL('../../../', import.meta.url)))).digest('hex')])) };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
