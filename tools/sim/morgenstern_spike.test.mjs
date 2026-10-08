/** Real Combat/Fighter component boundaries with native collider surface queries.
 * Explicit cached contact states isolate classification, resistance and finish;
 * this is not a natural-swing or human-play acceptance test.
 * Usage: node tools/sim/morgenstern_spike.test.mjs /outside/checkout/report.json
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, THREE, RAPIER } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { WEAPONS } from '../../src/weapons.js';
import { LOOKS } from '../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { ANATOMY, ARMOR, STRIKE } from '../../src/config.js';

const out = process.argv[2] || '/tmp/morgenstern-spike-report.json';
assert(!fs.existsSync(out), 'Use a fresh report path');
const files = ['src/combat.js', 'src/fighter.js', 'src/weapons.js', 'src/config.js', 'tools/sim/morgenstern_spike.test.mjs'];
const sha = data => createHash('sha256').update(data).digest('hex');
const manifest = () => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))]));
const before = manifest(), rows = [];
const checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const baseline = 'bab7c1f4feb5b6c0ce7057ffc137ccc16baebfea'; // Own runtime before spike support; never compare to this test's eventual HEAD.
const coldSource = execFileSync('git', ['show', `${baseline}:src/combat.js`], { encoding: 'utf8' });
const coldModule = coldSource.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
  const url = specifier.startsWith('.') ? new URL(specifier, new URL('../../src/combat.js', import.meta.url)).href : import.meta.resolve(specifier);
  return `from ${quote}${url}${quote}`;
});
const { Combat: ColdCombat } = await import('data:text/javascript;base64,' + Buffer.from(coldModule).toString('base64'));
const V = p => new THREE.Vector3(p.x, p.y, p.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const Y = new THREE.Vector3(0, 1, 0);
const state = body => ({ p: V(body.translation()), q: Q(body.rotation()), com: V(body.worldCom()), v: new THREE.Vector3(), w: new THREE.Vector3() });
const summary = r => r && Object.fromEntries(['type', 'zone', 'energy', 'eff', 'thr', 'mEff', 'severity', 'pass', 'finish', 't', 'helmet', 'plate'].map(key => [key, r[key]]));
async function test(name, fn) {
  try { const details = await fn(); rows.push({ name, pass: true, details }); console.log('PASS', name); }
  catch (error) { rows.push({ name, pass: false, error: error.stack }); console.error('FAIL', name, error.stack); }
}

// Native ray query against the production head shape, used only as a test probe.
// Runtime melee uses contact manifolds, not rays.
function headSurface(col, front = true) {
  const c = col.translationWrtParent(), q = col.rotationWrtParent();
  const origin = { x: c.x, y: c.y + (front ? 1 : -1), z: c.z };
  const dir = { x: 0, y: front ? -1 : 1, z: 0 };
  const ray = new RAPIER.Ray(origin, dir);
  const hit = col.shape.castRayAndGetNormal(ray, c, q, 2, true);
  assert(hit, 'Production head must have a native collider surface');
  return V(ray.pointAt(hit.timeOfImpact));
}
function fixture({ weapon = 'morgenstern', part = 'chest', armor = 'cloth', finish = false, surface = 'front', direction = 'axial' } = {}) {
  const look2 = armor === 'plate' ? CHARACTERS_BY_ID.heinrich.look : armor === 'helmet' ? LOOKS.player : LOOKS.enemy;
  const G = newRound({ seed: 173, weapon, weapon2: 'longsword', look2, walls: false });
  const att = G.player, vic = G.enemy, C = G.combat;
  att.foe = vic; vic.foe = att; att.state = 'stand'; vic.state = finish ? 'down' : 'stand';
  att.skill.tap = { down: finish, go: true }; att.skill.thrustPush = finish;
  att.emoMods = { dealt: 1, pass: 0 }; vic.emoMods = { taken: 1, pass: 0 };
  if (armor === 'torn') vic.cloth[part] = 0;
  const weaponEntries = [...C.info].filter(([, i]) => i.fighter === att && i.kind === 'weapon');
  const [wc, wi] = weaponEntries.find(([, i]) => i.part === 'blade') || weaponEntries[0];
  const [vc, vi] = [...C.info].find(([, i]) => i.fighter === vic && i.part === part);
  const pr = { wc, vc, w: wi, v: vi }, P = state(vi.body), original = state(wi.body);
  // Target surface/local coverage is explicit, not an invented armor predicate.
  const point = new THREE.Vector3(...(part === 'head' ? [.02, .08, .05] : [.11, 0, .05])).applyQuaternion(P.q).add(P.p);
  const axis = new THREE.Vector3(-1, 0, 0).applyQuaternion(P.q);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, axis);
  const local = weapon === 'morgenstern' ? headSurface(G.world.getCollider(wc), surface !== 'rear')
    : new THREE.Vector3(0, att.weaponCfg.hiltLength + att.weaponCfg.bladeLength, 0);
  const S = { p: point.clone().sub(local.clone().applyQuaternion(q)), q, v: axis.clone().multiplyScalar(5), w: new THREE.Vector3() };
  S.com = original.com.clone().sub(original.p).applyQuaternion(original.q.clone().invert()).applyQuaternion(q).add(S.p);
  if (direction === 'side') S.v.set(1, 0, 0).applyQuaternion(q).multiplyScalar(15);
  if (direction === 'backward') S.v.copy(axis).multiplyScalar(-15);
  att.cache = { sword: S }; vic.cache = { parts: { [part]: P } };
  const analyze = predicting => C.analyze(pr, point, S, P, predicting);
  const scaleEff = (target, exact = false) => {
    let r = analyze(true);
    assert(r?.eff > 0, 'Fixture must exercise actual stab analysis before scaling');
    S.v.multiplyScalar(Math.sqrt(target / r.eff));
    r = analyze(true);
    assert(r && r.speed >= .5 && r.speed <= 30, 'Stay inside supported physical speed range');
    // Equality fixture adjusts only its grade multiplier for a strict IEEE boundary.
    if (exact) {
      for (let i = 0; i < 8 && r.eff !== target; i++) { att.weaponCfg.power *= target / r.eff; r = analyze(true); }
      assert.equal(r.eff, target);
    } else assert(Math.abs(r.eff - target) < target * 1e-12);
    return r;
  };
  return { G, C, att, vic, pr, S, P, point, axis, local, analyze, scaleEff, free: () => { G.eventQueue.free(); G.world.free(); } };
}
function useFixture(options, fn) { const f = fixture(options); try { return fn(f); } finally { f.free(); } }

await test('production spike schema reaches Fighter; ordinary weapons have no spike ability', () => useFixture({}, f => {
  assert.equal(f.att.weaponCfg.spike, true);
  assert.equal(f.att.weaponCfg.mThrust, .35);
  assert.equal(f.att.weaponCfg.edged, false);
  assert.equal(f.att.weaponCfg.ignoreArmor, false);
  for (const [id, weapon] of Object.entries(WEAPONS)) if (id !== 'morgenstern') assert(!weapon.spike, id);
  const r = f.analyze(true);
  assert.equal(r.type, 'stab'); assert(r.t > .8);
  return { headSurface: f.local.toArray(), result: summary(r) };
}));

for (const armor of ['cloth', 'torn', 'plate', 'helmet']) for (const band of ['below', 'equal', 'wound', 'pass']) {
  await test(`${armor}/${band}: actual resistance, prediction and finishing boundary`, () => useFixture({ armor, part: armor === 'helmet' ? 'head' : 'chest', finish: true }, f => {
    const initial = f.analyze(true), threshold = initial.thr;
    assert.equal(threshold, armor === 'plate' ? ARMOR.plate.stab : armor === 'helmet' ? ARMOR.helmets.kettle.stab : ANATOMY.chest.stab * (armor === 'torn' ? .55 : 1));
    const target = threshold * ({ below: .75, equal: 1, wound: 1.1, pass: 1.4 }[band]);
    const predicted = f.scaleEff(target, band === 'equal'), actual = f.analyze(false);
    const penetrates = band === 'wound' || band === 'pass';
    assert.equal(predicted.finish, penetrates); assert.equal(actual.finish, penetrates);
    assert.equal(predicted.pass, band === 'pass'); assert.equal(actual.pass, predicted.pass);
    assert.equal(actual.type, penetrates ? 'stab' : 'blunt');
    assert.equal(actual.severity > 0, penetrates);
    // Prediction intentionally retains the stab hypothesis when blocked, as for swords.
    assert.equal(predicted.type, 'stab');
    if (!penetrates) {
      f.att.skill.thrustPush = false;
      const unassisted = f.analyze(false); f.att.skill.thrustPush = true;
      assert.equal(actual.energy, unassisted.energy); assert.equal(actual.mEff, unassisted.mEff);
    }
    const clothBefore = f.vic.cloth[f.pr.v.part], wearBefore = armor === 'helmet' ? f.vic.helmetIntegrity : f.vic.plate[f.pr.v.part];
    const result = f.C.strike(f.pr, f.point, false);
    assert.deepEqual(result, actual, 'Real strike must use the analyzed boundary');
    assert.equal(f.vic.causeOfDeath === '내려찍기', penetrates, 'No legacy finishing bypass below resistance');
    assert.equal(f.vic.wounds.length > 0, penetrates);
    assert.equal(f.vic.bleed > 0, penetrates);
    if (!penetrates && armor === 'plate') assert.equal(f.vic.cloth[f.pr.v.part], clothBefore);
    if (armor === 'plate' || armor === 'helmet') assert((armor === 'helmet' ? f.vic.helmetIntegrity : f.vic.plate[f.pr.v.part]) < wearBefore);
    return { threshold, predicted: summary(predicted), actual: summary(actual), cause: f.vic.causeOfDeath ?? null };
  }));
}

for (const armor of ['cloth', 'plate', 'helmet']) for (const factor of [.9, 1.1, 1.4]) {
  await test(`${armor}/${factor}: real predict/filterContactPair respects resistance`, () => useFixture({ armor, part: armor === 'helmet' ? 'head' : 'chest' }, f => {
    // Hold armor coverage fixed for the centerline estimate and the actual surface point.
    if (armor === 'helmet') f.P.com.copy(f.point).addScaledVector(f.axis, .12);
    const threshold = f.analyze(true).thr;
    f.scaleEff(threshold * factor);
    const predicted = f.C.predict(f.pr), actual = f.analyze(false);
    assert.equal(predicted.thr, actual.thr);
    assert.equal(predicted.pass, factor > 1.25);
    assert.equal(actual.pass, predicted.pass);
    const response = f.C.filterContactPair(f.pr.wc, f.pr.vc);
    assert.equal(response, 1, 'A COM prediction cannot disable the first native spike contact');
    assert.equal(f.C.cutting.has(`${f.pr.wc}:${f.pr.vc}`), false);
    return { predicted: summary(predicted), actual: summary(actual), response };
  }));
}

for (const direction of ['side', 'backward']) await test(`${direction} head motion remains blunt`, () => useFixture({ direction }, f => {
  for (const predicting of [false, true]) { const r = f.analyze(predicting); assert.equal(r.type, 'blunt'); assert.equal(r.pass, false); assert.equal(r.finish, false); }
  return summary(f.analyze(false));
}));
await test('rear head surface, shaft metadata and broken head remain blunt', () => {
  const rows = [];
  useFixture({ surface: 'rear' }, f => { const r = f.analyze(true); assert(r.t <= .8); assert.equal(r.type, 'blunt'); rows.push(summary(r)); });
  useFixture({}, f => {
    f.pr.w = { ...f.pr.w, part: 'hilt' };
    assert.equal(f.analyze(true).type, 'blunt');
    f.pr.w = { ...f.pr.w, part: 'blade' }; f.att.weaponBroken = true;
    assert.equal(f.analyze(true).type, 'blunt'); assert.equal(f.analyze(false).type, 'blunt');
    assert.equal(f.C.filterContactPair(f.pr.wc, f.pr.vc), 1);
  });
  return rows;
});
await test('strict head fraction and alignment do not inherit thrust-style window/gap', () => useFixture({}, f => {
  f.att.weaponCfg.thrustStyle = { window: .2, gap: 1 };
  const before = f.analyze(true); assert.equal(before.thr, ANATOMY.chest.stab);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(f.S.q);
  f.S.v.copy(f.axis).multiplyScalar(STRIKE.stabAlign).addScaledVector(edge, Math.sqrt(1 - STRIKE.stabAlign ** 2)).multiplyScalar(12);
  assert.equal(f.analyze(true).type, 'blunt', 'Alignment equality cannot puncture');
  f.S.v.copy(f.axis).multiplyScalar(12);
  const point = f.S.p.clone().addScaledVector(f.axis, f.att.weaponCfg.hiltLength + f.att.weaponCfg.bladeLength * .799999);
  assert.equal(f.C.analyze(f.pr, point, f.S, f.P, true).type, 'blunt');
  return summary(before);
}));
await test('spike opt-out exactly preserves the previous blunt weapon analysis', () => useFixture({ finish: true }, f => {
  f.att.weaponCfg.spike = false;
  const old = new ColdCombat(f.C.info, {});
  for (const predicting of [false, true]) assert.deepEqual(f.analyze(predicting), old.analyze(f.pr, f.point, f.S, f.P, predicting));
}));
for (const oblique of [false, true]) await test(`native ${oblique ? 'oblique side' : 'forward tip'} contact controls the solver gate`, () => useFixture({}, f => {
  // Isolate the production head/body shapes and complete sword mass properties.
  // One native step has no controller, gravity, joints or invented contact point.
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }), events = new RAPIER.EventQueue(true);
  world.timestep = .001;
  try {
    const sourceW = f.G.world.getCollider(f.pr.wc), sourceV = f.G.world.getCollider(f.pr.vc);
    const sourceBody = f.pr.w.body, headCenter = sourceW.translationWrtParent();
    const sw = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinvel(0, 15, 0)
      .setAdditionalMassProperties(sourceBody.mass(), sourceBody.localCom(), sourceBody.principalInertia(), sourceBody.principalInertiaLocalFrame()));
    const head = world.createCollider(new RAPIER.ColliderDesc(sourceW.shape).setTranslation(headCenter.x, headCenter.y, headCenter.z)
      .setDensity(0).setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0), sw);
    const half = sourceV.shape.halfExtents;
    assert(half, 'This controlled native fixture uses the production chest box');
    const target = oblique ? { x: half.x + sourceW.shape.radius - .003, y: headCenter.y + .06, z: 0 }
      : { x: 0, y: headCenter.y + sourceW.shape.radius + half.y - .003, z: 0 };
    const vb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(target.x, target.y, target.z));
    const body = world.createCollider(new RAPIER.ColliderDesc(sourceV.shape), vb);
    world.propagateModifiedBodyPositionsToColliders();
    const pr = { wc: head.handle, vc: body.handle, w: { ...f.pr.w, body: sw }, v: { ...f.pr.v, body: vb } };
    const S = state(sw), P = state(vb); S.v.copy(sw.linvel());
    f.att.cache = { sword: S }; f.vic.cache = { parts: { chest: P } };
    const hits = [], C = new Combat(new Map([[head.handle, pr.w], [body.handle, pr.v]]), { onWound: (_a, _v, r) => hits.push(summary(r)) });
    const contact = head.contactCollider(body, .01);
    assert(contact && contact.distance < 0, 'Native shapes must really overlap');
    const predicted = C.predict(pr), actual = C.analyze(pr, V(contact.point1), S, P);
    assert.equal(predicted.pass, true);
    assert.equal(actual.type, oblique ? 'blunt' : 'stab');
    assert.equal(actual.pass, !oblique);
    assert.equal(C.filterContactPair(pr.wc, pr.vc), 1, 'Unverified COM projection must preserve native collision');
    world.step(events, C.physicsHooks);
    let forceEvents = 0;
    C.afterStep(world, { drainContactForceEvents: fn => events.drainContactForceEvents(event => { forceEvents++; fn(event); }) });
    assert(forceEvents > 0, 'The native solver must produce a real contact-force event');
    assert.equal(hits.length, 1, 'afterStep must process exactly one real contact');
    assert.equal(hits[0].pass, !oblique);
    assert.equal(C.cutting.size, oblique ? 0 : 1);
    if (!oblique) {
      assert.equal(C.filterContactPair(pr.wc, pr.vc), 0, 'An actual passing tip contact may continue cutting');
      f.att.weaponBroken = true;
      assert.equal(C.filterContactPair(pr.wc, pr.vc), 1, 'A broken spike cannot retain stale solver bypass');
      assert.equal(C.cutting.size, 0);
    }
    return { contact: { distance: contact.distance, point: contact.point1 }, predicted: summary(predicted), actual: summary(actual), forceEvents, hits, postVelocity: sw.linvel() };
  } finally { events.free(); world.free(); }
}));
await test('all ordinary weapons retain exact previous Combat output including legacy finish', () => {
  let comparisons = 0;
  for (const weapon of Object.keys(WEAPONS).filter(id => id !== 'morgenstern')) {
    useFixture({ weapon, armor: 'plate', finish: true }, f => {
      const old = new ColdCombat(f.C.info, {});
      for (const speed of [1, 6, 15]) for (const side of [false, true]) for (const predicting of [false, true]) {
        f.S.v.copy(side ? new THREE.Vector3(1, 0, 0).applyQuaternion(f.S.q) : f.axis).multiplyScalar(speed);
        assert.deepEqual(f.analyze(predicting), old.analyze(f.pr, f.point, f.S, f.P, predicting), `${weapon}/${speed}/${side}/${predicting}`);
        assert.deepEqual(f.C.predict(f.pr), old.predict(f.pr));
        assert.equal(f.C.filterContactPair(f.pr.wc, f.pr.vc), old.filterContactPair(f.pr.wc, f.pr.vc));
        assert.deepEqual(f.C.cutting, old.cutting);
        f.C.cutting.clear(); old.cutting.clear();
        comparisons++;
      }
    });
  }
  return { comparisons, baseline };
});

const after = manifest();
await test('sources stayed fixed during verification', () => assert.deepEqual(after, before));
const report = { checkout, baseline, pass: rows.every(row => row.pass), tests: rows.length, failed: rows.filter(row => !row.pass).length,
  scope: 'Real Combat.analyze, predict, contact filter and Fighter.applyWound with controlled cached states; production shape probes and two isolated native solver/afterStep contacts. No natural-swing claim.', before, after, rows };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ pass: report.pass, tests: report.tests, failed: report.failed, out }));
if (!report.pass) process.exitCode = 1;
