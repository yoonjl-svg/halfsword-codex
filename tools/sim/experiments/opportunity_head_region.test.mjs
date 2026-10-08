// Pure JS geometry and real Skill command contracts. No Rapier/world creation.
// These checks do not establish native contact, armor penetration or hit rate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { Skill } from '../../../src/skill.js';
import { THRUST } from '../../../src/config.js';
import { thrustRegionCandidates } from '../../../src/opportunity_head_region.js';
import { captureOpportunityPose, findOpportunity, opportunityBlocked } from '../../../src/opportunity_target.js';
import { createOpportunityAI, updateOpportunityEpisode, prepareOpportunityAttack, refreshOpportunityAttack, commitOpportunityAttack } from '../../../src/opportunity_ai.js';

const rootURL = new URL('../../../', import.meta.url), root = fileURLToPath(rootURL);
const baseline = 'a7cdd9a318da4b45f38a35641915b4020b39e2d4';
async function oldModule(path) {
  const source = execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, encoding: 'utf8' })
    .replace(/from '([^']+)'/g, (_, name) => `from '${name.startsWith('.') ? new URL(name, new URL(path, rootURL)).href : import.meta.resolve(name)}'`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const oldTarget = await oldModule('src/opportunity_target.js');
const { Skill: BaselineSkill } = await oldModule('src/skill.js');
const V = a => new THREE.Vector3(...a), Q = () => new THREE.Quaternion();
const plain = v => ({ x: v.x, y: v.y, z: v.z });
const checks = [], check = (name, fn) => { fn(); checks.push(name); };
const near = (a, b, eps = 1e-10) => assert.ok(a.distanceTo(b) <= eps, `${a.toArray()} != ${b.toArray()}`);
const body = (p, q = Q()) => ({ translation: () => plain(p), rotation: () => ({ x: q.x, y: q.y, z: q.z, w: q.w }) });

function fixture(model = 'v3', mirrored = false, headRotation = Q(), direction = V([1, 0, 0])) {
  const yaw = mirrored ? new THREE.Quaternion().setFromAxisAngle(V([0, 1, 0]), Math.PI) : Q();
  const world = a => V(a).applyQuaternion(yaw);
  const swordQ = new THREE.Quaternion().setFromUnitVectors(V([0, 1, 0]), direction.clone().applyQuaternion(yaw).normalize());
  const foe = { index: 1, state: 'kneel', alive: true, armed: false, headR: .1,
    bodies: { head: body(world([1.2, 1.25, 0]), headRotation), chest: body(world([1.2, 1.02, 0])), pelvis: body(world([1.2, .9, 0])) },
    balance: 30, offBalance: .3, vigor: 1 };
  const f = { index: 0, opportunityModel: model, alive: true, armed: true, state: 'stand', side: mirrored ? -1 : 1,
    weapon: { id: 'rapier' }, weaponCfg: { edged: true, mCut: 1, mBlunt: 1, mThrust: 1, bladeLength: .9, hiltLength: .15 },
    bodies: { chest: body(world([0, 1.33, 0])) }, sword: body(world([.5, 1.32, .15]), swordQ), yaw,
    handOffset: new THREE.Vector2(.15, .1), handBase: [.5, 0, .27], guardPose: { hand: [.5, 0, .27], oneHand: true },
    guardWeight: () => 1, finishEntryModel: 'legacy', finish: { on: false, amt: 0 }, move: new THREE.Vector2(), foe };
  return { f, foe, snapshot: captureOpportunityPose(foe) };
}
function selection(finder, f, snapshot, kind) {
  const o = finder(f, snapshot, kind);
  return o && { ...o, target: o.target.toArray() };
}

check('owned snapshot uses actual head radius and preserves every baseline observation field', () => {
  const { foe } = fixture(), shared = foe.bodies.head.translation(), sharedQ = foe.bodies.head.rotation();
  foe.hasHelmet = true;
  foe.bodies.head.translation = () => shared; foe.bodies.head.rotation = () => sharedQ;
  const snapshot = captureOpportunityPose(foe), old = oldTarget.captureOpportunityPose(foe);
  const { headRadius, hasHelmet, ...rest } = snapshot;
  assert.equal(headRadius, foe.headR); assert.equal(hasHelmet, true); assert.deepEqual(rest, old);
  foe.headR = .2; assert.equal(snapshot.headRadius, .1);
  foe.hasHelmet = false; assert.equal(snapshot.hasHelmet, true);
  shared.x = 99; sharedQ.x = 42; assert.notEqual(snapshot.head.x, 99); assert.notEqual(snapshot.headQ.x, 42);
});

check('off/v1/v2 selections are baseline-identical across rotation, mirror, guard and attack kinds', () => {
  for (const model of ['off', 'v1', 'v2']) for (const mirrored of [false, true])
    for (const angle of [0, Math.PI / 3, Math.PI]) for (const guarded of [false, true]) {
      const { f, snapshot } = fixture(model, mirrored, new THREE.Quaternion().setFromAxisAngle(V([0, 0, 1]), angle));
      if (guarded) { snapshot.armed = true; snapshot.bladeBase = { ...snapshot.neck }; snapshot.bladeTip = { ...snapshot.head }; }
      for (const kind of ['cut', 'blunt', 'thrust']) assert.deepEqual(selection(findOpportunity, f, snapshot, kind), selection(oldTarget.findOpportunity, f, snapshot, kind));
    }
});

check('v3 cut and blunt retain v2 targets and all common eligibility gates', () => {
  for (const mirrored of [false, true]) for (const angle of [0, .8, Math.PI]) {
    const { f, snapshot } = fixture('v3', mirrored, new THREE.Quaternion().setFromAxisAngle(V([1, 0, 0]), angle));
    for (const kind of ['cut', 'blunt']) {
      const result = selection(findOpportunity, f, snapshot, kind); f.opportunityModel = 'v2';
      assert.deepEqual(result, selection(findOpportunity, f, snapshot, kind)); f.opportunityModel = 'v3';
    }
  }
  for (const field of ['alive', 'armed']) { const { f, snapshot } = fixture(); f[field] = false; assert.equal(findOpportunity(f, snapshot, 'thrust'), null); }
  for (const state of ['stand', 'dead']) { const { f, snapshot } = fixture(); snapshot.state = state; assert.equal(findOpportunity(f, snapshot, 'thrust'), null); }
  const { f, snapshot } = fixture(); snapshot.headOff = true; assert.equal(findOpportunity(f, snapshot, 'thrust'), null);
});

check('v3 picks deep primary samples before peripheral fallbacks at rotated/mirrored poses', () => {
  for (const mirrored of [false, true]) for (const angle of [0, .7, Math.PI]) {
    const { f, snapshot } = fixture('v3', mirrored, new THREE.Quaternion().setFromAxisAngle(V([1, 1, 0]).normalize(), angle));
    const origin = V(Object.values(f.sword.translation())), axis = V([0, 1, 0]).applyQuaternion(new THREE.Quaternion(...Object.values(f.sword.rotation())));
    const candidates = thrustRegionCandidates(snapshot, origin, axis), opening = findOpportunity(f, snapshot, 'thrust');
    assert.ok(opening); assert.ok(candidates.length >= 12);
    near(opening.target, candidates[0].point);
    for (const c of candidates) { assert.ok(c.point.distanceTo(V(Object.values(snapshot.head))) <= snapshot.headRadius + 1e-10); assert.ok(Number.isFinite(c.alignment)); }
    for (let i = 1; i < candidates.length; i++) {
      const a = candidates[i - 1], b = candidates[i];
      assert.ok(Number(a.covered) <= Number(b.covered));
      if (a.covered === b.covered) {
        assert.ok(a.fallback <= b.fallback);
        if (a.fallback === b.fallback) assert.ok(a.alignment >= b.alignment);
      }
    }
    const low = fixture('v3', mirrored, Q(), V([.7, -.145, -.15]).normalize());
    assert.equal(findOpportunity(low.f, low.snapshot, 'thrust')?.zone, 'neck');
  }
});

check('central projection keeps its existing axis, while an edge projection yields to deep primary targets', () => {
  const snapshot = { head: { x: 0, y: 0, z: 0 }, headRadius: .1, headQ: { x: 0, y: 0, z: 0, w: 1 }, neck: { x: 0, y: -.075, z: 0 } };
  const axis = V([1, 0, 0]);
  const central = thrustRegionCandidates(snapshot, V([-.5, .03, 0]), axis);
  near(central[0].point, V([0, .03, 0])); assert.equal(central[0].alignment, 1);
  const edge = thrustRegionCandidates(snapshot, V([-.5, .08, 0]), axis);
  assert.equal(edge[0].fallback, 0);
  assert.ok(!edge.some(c => c.point.distanceTo(V([0, .065, 0])) < 1e-10 && c.fallback === 0));
  const crown = edge.find(c => c.point.distanceTo(V([0, .065, 0])) < 1e-10);
  assert.ok(crown); assert.ok(crown.alignment > edge[0].alignment);
});

check('helmet preference uses snapshot-only first sphere entry, rotated head-local band and exposure before alignment', () => {
  for (const angle of [0, .8, Math.PI]) {
    const q = new THREE.Quaternion().setFromAxisAngle(V([1, 0, 1]).normalize(), angle), center = V([.1, .5, .2]);
    const origin = V([-.3, .04, 0]).applyQuaternion(q).add(center), axis = center.clone().sub(origin).normalize();
    const snapshot = { head: plain(center), headRadius: .1, headQ: { x: q.x, y: q.y, z: q.z, w: q.w },
      neck: plain(V([0, -.075, 0]).applyQuaternion(q).add(center)), hasHelmet: false };
    const bare = thrustRegionCandidates(snapshot, origin, axis); near(bare[0].point, center);
    assert.ok(bare.every(c => c.covered === false));
    const helmet = thrustRegionCandidates({ ...snapshot, hasHelmet: true }, origin, axis);
    assert.ok(helmet.some(c => c.covered)); assert.ok(helmet.some(c => !c.covered));
    assert.equal(helmet[0].covered, false); assert.ok(helmet[0].alignment < bare[0].alignment);
    const centerSample = helmet.find(c => c.point.distanceTo(center) < 1e-10);
    assert.equal(centerSample.covered, true);
    for (const c of helmet) {
      const ray = new THREE.Ray(origin, c.point.clone().sub(origin).normalize());
      const entry = ray.intersectSphere(new THREE.Sphere(center, .1), new THREE.Vector3()); assert.ok(entry);
      const localEntry = entry.sub(center).applyQuaternion(q.clone().invert());
      assert.equal(c.covered, localEntry.y > -.01);
    }
    // Helmet observation alone cannot change legacy selections.
    for (const model of ['off', 'v1', 'v2']) {
      const { f, snapshot: s } = fixture(model); s.hasHelmet = false;
      const before = selection(findOpportunity, f, s, 'thrust'); s.hasHelmet = true;
      assert.deepEqual(selection(findOpportunity, f, s, 'thrust'), before);
    }
  }
});

check('guard refusal uses the existing blade corridor and can choose a clear alternative sample', () => {
  const { f, snapshot } = fixture(), origin = V(Object.values(f.sword.translation()));
  snapshot.armed = true; snapshot.bladeBase = { x: 1.2, y: 1, z: 0 }; snapshot.bladeTip = { x: 1.2, y: 1.5, z: 0 };
  assert.equal(findOpportunity(f, snapshot, 'thrust'), null);
  // A blade just outside one side covers near samples but leaves the far side clear.
  snapshot.bladeBase = { x: 1.2, y: 1, z: .19 }; snapshot.bladeTip = { x: 1.2, y: 1.5, z: .19 };
  const all = thrustRegionCandidates(snapshot, origin, V([1, 0, 0]));
  assert.ok(all.some(c => opportunityBlocked(origin, c.point, snapshot)));
  const clear = all.find(c => !opportunityBlocked(origin, c.point, snapshot)); assert.ok(clear);
  const opening = findOpportunity(f, snapshot, 'thrust'); assert.ok(opening); near(opening.target, clear.point);
});

check('invalid geometry rejects without nonfinite commands and samples do not mutate inputs', () => {
  const { f, snapshot } = fixture(), origin = V([.5, 1.32, .15]), axis = V([1, 0, 0]);
  const before = JSON.stringify(snapshot), originBefore = origin.clone(), axisBefore = axis.clone();
  thrustRegionCandidates(snapshot, origin, axis); assert.equal(JSON.stringify(snapshot), before); near(origin, originBefore); near(axis, axisBefore);
  for (const value of [undefined, NaN, Infinity, 0, -.1]) { const bad = { ...snapshot, headRadius: value }; assert.deepEqual(thrustRegionCandidates(bad, origin, axis), []); assert.equal(findOpportunity(f, bad, 'thrust'), null); }
  for (const badAxis of [V([0, 0, 0]), V([NaN, 1, 0]), V([Infinity, 0, 0])]) assert.deepEqual(thrustRegionCandidates(snapshot, origin, badAxis), []);
  for (const field of ['head', 'chest', 'pelvis']) assert.equal(findOpportunity(f, { ...snapshot, [field]: { x: NaN, y: 0, z: 0 } }, 'thrust'), null);
  assert.equal(findOpportunity(f, { ...snapshot, headQ: { x: 0, y: NaN, z: 0, w: 1 } }, 'thrust'), null);
});

function commandTrace(SkillClass, model, zone = 'neck') {
  const { f } = fixture(model); const skill = new SkillClass(f); f.skill = skill;
  assert.equal(skill.thrust({ step: false, opportunityTarget: { kind: 'thrust', zone, targetId: 1, target: V([1.2, 1.25, 0]) } }), true);
  const timing = { ...skill.tap.K }, captured = skill.tap.opportunity && { target: skill.tap.opportunity.target.slice(), zone: skill.tap.opportunity.zone };
  const frames = [];
  for (let i = 0; i < 90; i++) { skill.updateThrust(1 / 120); frames.push({ tap: !!skill.tap, hand: skill.thrustPose.hand.slice(), dir: skill.thrustPose.dir.slice(), w: skill.thrustPose.w, push: skill.thrustPush }); }
  return { timing, captured, frames };
}
check('real Skill off/v1/v2 command traces remain baseline-exact including recovery and push schedule', () => {
  for (const model of ['off', 'v1', 'v2']) assert.deepEqual(commandTrace(Skill, model), commandTrace(BaselineSkill, model));
  const v2 = commandTrace(Skill, 'v2'), v3 = commandTrace(Skill, 'v3', 'head');
  assert.deepEqual(v3.timing, v2.timing); assert.deepEqual(v3.frames, v2.frames);
  for (const model of ['off', 'v1', 'v2']) assert.equal(commandTrace(Skill, model, 'head').captured, undefined);
});

check('v3 tap owns a copied world target, never reacquires moving opponent, and locks extension axis', () => {
  const { f, snapshot } = fixture(), skill = new Skill(f); f.skill = skill;
  const opening = findOpportunity(f, snapshot, 'thrust'), saved = opening.target.toArray();
  assert.equal(skill.thrust({ step: false, opportunityTarget: opening }), true);
  opening.target.set(99, 88, 77); snapshot.head.x = -20;
  f.foe.bodies.head = { translation: () => { throw new Error('live opponent read after commit'); } };
  f.foe.bodies.chest = f.foe.bodies.head;
  const K = { ...skill.tap.K };
  for (let i = 0; i < Math.ceil(K.aim * 120) + 2; i++) { skill.updateThrust(1 / 120); assert.deepEqual(skill.tap.opportunity.target, saved); }
  const locked = skill.thrustPose.dir.slice(); f.sword = body(V([-5, 9, 4]));
  for (let i = 0; i < 15; i++) { skill.updateThrust(1 / 120); assert.deepEqual(skill.thrustPose.dir, locked); }
  assert.ok([...skill.thrustPose.hand, ...skill.thrustPose.dir].every(Number.isFinite));
  assert.equal(skill.thrust({ step: false, opportunityTarget: opening }), false);
});

check('v3 AI consumes its supplied observation, locks a committed target and retains the two-attempt cap', () => {
  const { f, snapshot } = fixture(); f.skill = new Skill(f);
  const noLive = { translation: () => { throw new Error('live victim geometry read'); }, rotation: () => { throw new Error('live victim rotation read'); } };
  f.foe.bodies = { head: noLive, chest: noLive, pelvis: noLive };
  Object.defineProperties(f.foe, {
    hasHelmet: { get: () => { throw new Error('live victim helmet read'); } },
    headR: { get: () => { throw new Error('live victim radius read'); } },
  });
  const ai = { me: f, opportunityState: createOpportunityAI(), foeLat: 0, tech: { kind: 'thrust' }, stats: {} };
  updateOpportunityEpisode(ai, { t: 10, armed: false, opportunity: snapshot }, 1 / 120);
  assert.ok(prepareOpportunityAttack(ai, ai.tech));
  assert.equal(ai.opportunityAttack.observedAt, 10);
  assert.equal(commitOpportunityAttack(ai), true); assert.equal(ai.opportunityState.attempts, 1);
  const locked = ai.opportunityAttack.target.toArray();
  snapshot.head.x += .05; snapshot.neck.x += .05;
  updateOpportunityEpisode(ai, { t: 11, armed: false, opportunity: snapshot }, 1 / 120);
  assert.equal(refreshOpportunityAttack(ai), true); assert.deepEqual(ai.opportunityAttack.target.toArray(), locked);
  assert.equal(commitOpportunityAttack(ai), true); assert.equal(ai.opportunityState.attempts, 1);
  assert.ok(prepareOpportunityAttack(ai, ai.tech)); assert.equal(commitOpportunityAttack(ai), true);
  assert.equal(ai.opportunityState.attempts, 2); assert.equal(ai.stats.opportunityAttacks, 2);
  assert.equal(prepareOpportunityAttack(ai, ai.tech), null);
});

const paths = ['src/opportunity_head_region.js', 'src/opportunity_target.js', 'src/skill.js', 'src/opportunity_ai.js', 'tools/sim/experiments/opportunity_head_region.test.mjs'];
const report = { pass: true, baseline, nativeSteps: 0, nativeWorldsCreated: 0,
  scope: 'Pure geometry and real Skill commands only; native contact, armor penetration, efficacy and continuous-region optimality unverified',
  checks, hashes: Object.fromEntries(paths.map(p => [p, createHash('sha256').update(fs.readFileSync(new URL(p, rootURL))).digest('hex')])) };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
