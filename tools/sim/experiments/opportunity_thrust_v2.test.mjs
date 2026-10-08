// Command contracts only: real Skill/Fighter wiring, zero native physics steps.
// Native hit accuracy, physical speed and human movement are not established.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, THREE } from '../harness_m.mjs';
import { Skill } from '../../../src/skill.js';
import { THRUST } from '../../../src/config.js';
import { captureOpportunityThrust, updateOpportunityThrust, opportunityExtensionLength } from '../../../src/opportunity_thrust.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = '738ef0fbe9fe706c25a5d491506404600ec33e16';
let oldSource = execFileSync('git', ['show', `${baseline}:src/skill.js`], { cwd: root, encoding: 'utf8' });
oldSource = oldSource.replace(/from '([^']+)'/g, (_, name) => `from '${name.startsWith('.') ? new URL('src/' + name.slice(2), new URL('../../../', import.meta.url)).href : import.meta.resolve(name)}'`);
const { Skill: BaselineSkill } = await import('data:text/javascript;base64,' + Buffer.from(oldSource).toString('base64'));
const V = a => new THREE.Vector3(...a), near = (a, b, epsilon = 1e-10) => assert.ok(V(a).distanceTo(V(b)) < epsilon, `${a} != ${b}`);
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
const fake = (model = 'v2') => ({ opportunityModel: model, yaw: new THREE.Quaternion(),
  sword: { rotation: () => ({ x: 0, y: 0, z: -Math.SQRT1_2, w: Math.SQRT1_2 }), translation: () => ({ x: .55, y: .1, z: .1 }) },
  bodies: { chest: { translation: () => ({ x: 0, y: 0, z: 0 }) } } });
const tap = () => ({ h0: [.45, .2, .3], t: 0, down: false, bound: null,
  K: { aim: THRUST.aim, extend: THRUST.extend, hold: THRUST.hold, recover: THRUST.recover, reach: THRUST.reach },
  opportunity: { target: [1.2, -.1, -.2] } });
const pose = () => ({ hand: [0, 0, 0], dir: [1, 0, 0] });

check('v2 only: ordinary, v1, low finish and bind keep the original controller', () => {
  for (const model of ['off', 'v1']) assert.equal(captureOpportunityThrust(fake(model), tap()), null);
  for (const field of ['down', 'bound']) { const t = tap(); t[field] = true; assert.equal(captureOpportunityThrust(fake(), t), null); }
  const t = tap(); delete t.opportunity; assert.equal(captureOpportunityThrust(fake(), t), null);
});

check('aim ray crosses the fixed target despite command/actual grip disagreement', () => {
  const f = fake(), t = tap(), p = pose(), target = V(t.opportunity.target);
  t.opportunityPrecision = captureOpportunityThrust(f, t); t.t = .075;
  updateOpportunityThrust(f, t, p, target, .22);
  const grip = V(t.opportunityPrecision.rayOrigin), desired = target.clone().sub(grip).normalize();
  near(p.dir, desired.toArray());
  // The old past extension uses a different h0-origin ray and misses this goal.
  const old = target.clone().addScaledVector(target.clone().sub(V(t.h0)).normalize(), THRUST.past).sub(grip).normalize();
  assert.ok(old.angleTo(desired) > .01);
  near(target.toArray(), t.opportunity.target);
});

check('preparation retracts along the captured actual axis, without starting extension early', () => {
  const f = fake(), t = tap(), p = pose(); t.opportunityPrecision = captureOpportunityThrust(f, t);
  for (const time of [0, .025, .075, THRUST.aim - 1e-9]) {
    t.t = time; updateOpportunityThrust(f, t, p, V(t.opportunity.target), .22);
    const movement = V(p.hand).sub(V(t.h0));
    assert.ok(movement.clone().cross(V(t.opportunityPrecision.startAxis)).length() < 1e-10);
    assert.ok(movement.dot(V(t.opportunityPrecision.startAxis)) <= 0);
    assert.ok(movement.length() <= .22 + 1e-10); assert.equal(t.opportunityPrecision.phase, 'aim');
  }
});

check('extension is continuous, along the locked ray and never beyond existing reach', () => {
  const f = fake(), t = tap(), p = pose(); t.opportunityPrecision = captureOpportunityThrust(f, t);
  t.t = THRUST.aim - 1e-9; updateOpportunityThrust(f, t, p, V(t.opportunity.target), .22); const before = p.hand.slice();
  t.t = THRUST.aim; updateOpportunityThrust(f, t, p, V(t.opportunity.target), .22); near(p.hand, before);
  const start = p.hand.slice(), locked = p.dir.slice();
  // Moving own grip or supplying another target after lock cannot steer it.
  f.sword.translation = () => ({ x: -3, y: 2, z: 5 });
  for (const time of [.15, THRUST.aim + THRUST.extend, THRUST.aim + THRUST.extend + THRUST.hold]) {
    t.t = time; updateOpportunityThrust(f, t, p, V([9, 8, 7]), .22);
    near(p.dir, locked); assert.ok(V(p.hand).sub(V(start)).cross(V(locked)).length() < 1e-10);
    assert.ok(V(p.hand).distanceTo(V(t.h0)) <= t.K.reach + 1e-10);
  }
  assert.ok(Math.abs(V(p.hand).distanceTo(V(t.h0)) - t.K.reach) < 1e-10);
  near(t.dir, locked); p.dir[0] = 42; near(t.opportunityPrecision.dir, locked);
});

check('ray/sphere endpoint and travel budget hold for large initial angles', () => {
  for (const angle of [0, .2, .8, 1.6, Math.PI]) {
    const a = V([1, 0, 0]), d = V([Math.cos(angle), Math.sin(angle), 0]);
    const length = opportunityExtensionLength(.22, .4, a.dot(d));
    assert.ok(length >= 0 && length <= .62);
    assert.ok(Math.abs(a.multiplyScalar(-.22).addScaledVector(d, length).length() - .4) < 1e-10);
  }
});

function trace(SkillClass, model, index = 0) {
  const G = newRound({ seed: 271, weapon: 'rapier', weapon2: 'rapier', gap: 2, walls: false });
  try {
    const f = index === 0 ? G.player : G.enemy;
    G.player.foe = G.enemy; G.enemy.foe = G.player;
    f.opportunityModel = model; f.finishEntryModel = 'legacy'; f.finish.on = false; f.finish.amt = 0;
    f.skill = new SkillClass(f);
    const target = new THREE.Vector3(f.sword.translation().x + (index ? -1 : 1), 1.1, .1);
    assert.equal(f.skill.thrust({ step: false, opportunityTarget: { kind: 'thrust', zone: 'neck', targetId: f.foe.index, target } }), true);
    const timing = { ...f.skill.tap.K }, state = f.skill.tap.opportunityPrecision;
    const initialBodies = [f.sword.translation(), f.sword.rotation()];
    const frames = [];
    for (let i = 0; i < 65; i++) {
      f.skill.updateThrust(1 / 120);
      frames.push({ tap: !!f.skill.tap, hand: f.skill.thrustPose.hand.slice(), dir: f.skill.thrustPose.dir.slice(),
        w: f.skill.thrustPose.w, push: f.skill.thrustPush });
    }
    assert.deepEqual([f.sword.translation(), f.sword.rotation()], initialBodies);
    return { timing, state, frames };
  } finally { G.eventQueue.free(); G.world.free(); }
}

for (const model of ['off', 'v1']) check(`${model} real Skill command trace is byte-identical to the prior controller`, () => {
  assert.deepEqual(trace(Skill, model), trace(BaselineSkill, model));
});
for (const index of [0, 1]) check(`v2 real ${index ? 'AI' : 'player'} tap keeps timing, push schedule and finite commands`, () => {
  const v1 = trace(Skill, 'v1', index), v2 = trace(Skill, 'v2', index);
  assert.ok(v2.state); assert.deepEqual(v2.timing, v1.timing);
  assert.deepEqual(v2.frames.map(f => [f.tap, f.w, f.push]), v1.frames.map(f => [f.tap, f.w, f.push]));
  assert.ok(v2.frames.every(f => [...f.hand, ...f.dir, f.w].every(Number.isFinite)));
});

const paths = ['src/skill.js', 'src/opportunity_thrust.js', 'src/opportunity_target.js', 'tools/sim/experiments/opportunity_thrust_v2.test.mjs'];
const report = { pass: true, baseline, nativeSteps: 0, scope: 'Command contracts only; contact, physical speed and power unverified', checks,
  hashes: Object.fromEntries(paths.map(p => [p, createHash('sha256').update(fs.readFileSync(new URL(p, new URL('../../../', import.meta.url)))).digest('hex')])) };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
