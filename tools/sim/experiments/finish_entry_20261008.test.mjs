/** Prepared real Fighter/Skill/Combat checks for optional low finish entry.
 * No native steps are run: these verify input/state/geometry/damage connections,
 * not natural posture, contact probability, recovery, or player acceptance.
 * Usage: node tools/sim/experiments/finish_entry_20261008.test.mjs /tmp/new-report.json
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = process.argv[2];
const selection = process.argv[3] ? new RegExp(process.argv[3]) : null;
assert.ok(out && path.isAbsolute(out), 'Provide a fresh absolute report path');
assert.ok(!fs.existsSync(out), 'Refusing to overwrite a report');
const sourcePaths = fs.readdirSync(path.join(root, 'src')).filter(p => p.endsWith('.js')).map(p => `src/${p}`)
  .concat(['package-lock.json', 'tools/sim/harness_m.mjs', 'tools/sim/experiments/finish_entry_20261008.test.mjs']);
const hashes = () => Object.fromEntries(sourcePaths.map(p => [p,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
const before = hashes();
const { newRound, THREE } = await import('../harness_m.mjs');
const { updateFinish } = await import('../../../src/finish.js');
const { LOOKS } = await import('../../../src/looks.js');
const { CHARACTERS_BY_ID } = await import('../../../src/characters.js');
const results = [];
let fixtures = 0;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9 * Math.max(1, Math.abs(expected)),
  `${label}: ${actual} != ${expected}`);
async function test(name, fn) {
  if (selection && !selection.test(name)) return;
  try { results.push({ name, pass: true, details: await fn() }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); console.error('FAIL', name, error.stack); }
}
function fixture(fn, options = {}) {
  fixtures++;
  const G = newRound({ seed: 71, weapon: 'longsword', weapon2: 'longsword', gap: 1.5, walls: false, ...options });
  const f = G.player, v = G.enemy;
  f.foe = v; v.foe = f; f.finishEntryModel = 'low'; f.skill.level = 0;
  G.combat.finishRuleModel = 'power';
  try { return fn({ G, f, v }); }
  finally { G.eventQueue.free(); G.world.free(); }
}
function target(f, v, { state = 'down', x = .6, chest = .4, pelvis = .35, head = .5, z = 0 } = {}) {
  const c = f.bodies.chest.translation();
  v.state = state;
  for (const [part, y] of Object.entries({ chest, pelvis, head })) {
    v.bodies[part].setTranslation({ x: c.x + x, y, z: c.z + z }, true);
  }
}
function entry(f) {
  return { on: f.finish.on, canStart: f.finish.canStart, amount: f.finish.amt,
    surfaceInside: f.finish.plunge.surfaceInside, surfaceWalk: f.finish.plunge.surfaceWalk,
    move: f.move.y, down: f.skill.tap?.down ?? null, walking: f.skill.tap?.walking ?? false };
}
function tickIntent(f, dt = 1 / 120) { updateFinish(f, 0); f.skill.updateThrust(dt); }

for (const [name, prepared] of [
  ['high down', { state: 'down', chest: 1.31, pelvis: .95, head: 1.5 }],
  ['low pelvis but elevated chest', { chest: .92, pelvis: .35, head: 1.15 }],
  ['upright kneel', { state: 'kneel', chest: .916, pelvis: .567, head: 1.187 }],
  ['low body carrying stand state', { state: 'stand' }],
]) await test(`${name}: tap remains ordinary thrust`, () => fixture(({ f, v }) => {
  target(f, v, prepared); updateFinish(f, 0);
  assert.equal(f.finish.on, false); assert.equal(f.finish.canStart, false);
  assert.equal(f.skill.thrust(), true); assert.equal(f.skill.tap.down, false);
  return entry(f);
}));

for (const state of ['down', 'getup']) await test(`low ${state}: new tap accepted before pose fade`, () => fixture(({ f, v }) => {
  target(f, v, { state }); assert.equal(f.finish.amt, 0);
  assert.equal(f.skill.thrust(), true); assert.equal(f.skill.tap.down, true);
  assert.equal(f.finish.amt, 0); assert.equal(f.skill.tap.foe, v);
  tickIntent(f); assert.ok(!f.skill.tap.abort);
  return entry(f);
}));

await test('ongoing same-target tap tolerates small rise; fresh tap does not inherit exit margin', () => fixture(({ f, v }) => {
  target(f, v); assert.ok(f.skill.thrust()); tickIntent(f, .04);
  target(f, v, { state: 'getup', chest: .72, pelvis: .68, head: .8 });
  tickIntent(f); assert.equal(f.finish.on, true); assert.equal(f.finish.canStart, false);
  assert.ok(!f.skill.tap.abort); const ongoing = entry(f);
  f.skill.tap = null; updateFinish(f, 0);
  assert.equal(f.finish.on, false); assert.ok(f.skill.thrust()); assert.equal(f.skill.tap.down, false);
  return { ongoing, fresh: entry(f) };
}));

await test('exit margin cannot transfer to a replacement target', () => fixture(({ f, v }) => {
  target(f, v); assert.ok(f.skill.thrust()); tickIntent(f, .04);
  const replacement = newRound({ seed: 73, weapon: 'longsword', gap: 1.5, walls: false }); fixtures++;
  try {
    f.foe = replacement.enemy; target(f, f.foe, { state: 'getup', chest: .72, pelvis: .68 });
    tickIntent(f); assert.equal(f.finish.on, false); assert.equal(f.finish.canStart, false); assert.ok(f.skill.tap.abort);
    return entry(f);
  } finally { replacement.eventQueue.free(); replacement.world.free(); }
}));

for (const cause of ['target-rise', 'target-out-of-range', 'target-replaced']) {
  await test(`${cause}: smooth abort, release, and a fresh input`, () => fixture(({ f, v }) => {
    target(f, v); assert.ok(f.skill.thrust()); tickIntent(f, .08);
    const w = f.skill.thrustPose.w; assert.ok(w > 0);
    let replacement = null;
    try {
      if (cause === 'target-rise') target(f, v, { state: 'getup', chest: .91, pelvis: .7 });
      if (cause === 'target-out-of-range') target(f, v, { x: 3 });
      if (cause === 'target-replaced') {
        replacement = newRound({ seed: 72, weapon: 'longsword', gap: 1.5, walls: false }); fixtures++;
        f.foe = replacement.enemy; target(f, f.foe);
      }
      tickIntent(f);
      assert.ok(f.skill.tap.abort); assert.equal(f.skill.thrustPush, false);
      assert.equal(f.skill.thrustPose.w, w, 'abort begins at existing blend weight');
      f.skill.updateThrust(f.skill.tap.K.recover / 2);
      assert.ok(f.skill.thrustPose.w > 0 && f.skill.thrustPose.w < w);
      f.skill.updateThrust(f.skill.tap.K.recover);
      assert.equal(f.skill.tap, null); assert.equal(f.skill.thrustPose.w, 0);
      f.foe = v; target(f, v, { state: 'getup' });
      assert.ok(f.skill.thrust()); assert.equal(f.skill.tap.down, true); assert.equal(f.skill.tap.foe, v);
      return { cause, initialWeight: w, reinput: entry(f) };
    } finally { replacement?.eventQueue.free(); replacement?.world.free(); }
  }));
}

await test('level zero explicit approach advances; old assist intensity does not change its request', () => {
  const values = [0, .7].map(level => fixture(({ f, v }) => {
    f.skill.level = level; target(f, v, { x: 1.6 });
    assert.ok(f.skill.thrust()); assert.equal(f.skill.tap.down, true); assert.equal(f.skill.tap.walking, true);
    f.gait.active = true; f.gait.sinceTD = .17;
    tickIntent(f); assert.ok(f.move.y > 0 && f.move.y <= 1); assert.ok(f.skill.tap.walking);
    return { level, request: f.move.y };
  }));
  assert.equal(values[0].request, values[1].request); return values;
});

for (const mode of ['AI-no-step', 'kneeling-attacker', 'manual-back']) await test(`${mode}: explicit approach respects movement ownership`, () => fixture(({ f, v }) => {
  target(f, v, { x: 1.6 });
  if (mode === 'kneeling-attacker') f.state = 'kneel';
  assert.ok(f.skill.thrust({ step: mode !== 'AI-no-step' })); assert.equal(f.skill.tap.down, mode === 'manual-back');
  f.gait.active = true; f.gait.sinceTD = .17;
  if (mode === 'manual-back') f.move.y = -.6;
  tickIntent(f); assert.equal(f.move.y, mode === 'manual-back' ? -.6 : 0);
  assert.ok(!f.skill.tap.walking);
  if (mode === 'manual-back') assert.ok(f.skill.tap.abort, 'outside reach must not turn retreat into a futile plunge');
  return entry(f);
}));

for (const mode of ['AI-no-step', 'kneeling-attacker']) await test(`${mode}: already reachable target permits stationary plunge`, () => fixture(({ f, v }) => {
  target(f, v, { x: 1.35 }); if (mode === 'kneeling-attacker') f.state = 'kneel';
  assert.ok(f.skill.thrust({ step: mode !== 'AI-no-step' })); assert.equal(f.skill.tap.down, true);
  assert.equal(f.finish.plunge.surfaceInside, true); assert.equal(f.finish.plunge.inside, false);
  tickIntent(f); assert.equal(f.move.y, 0); assert.ok(!f.skill.tap.walking); assert.ok(!f.skill.tap.abort);
  return entry(f);
}));

for (const mode of ['AI-no-step', 'kneeling-attacker', 'walking-attacker-kneels']) {
  await test(`${mode}: lost stationary reach aborts preparation and allows fresh close input`, () => fixture(({ f, v }) => {
    const step = mode !== 'AI-no-step';
    if (mode === 'kneeling-attacker') f.state = 'kneel';
    target(f, v, { x: mode === 'walking-attacker-kneels' ? 1.6 : 1.35 });
    assert.ok(f.skill.thrust({ step })); assert.equal(f.skill.tap.down, true);
    f.gait.active = true; f.gait.sinceTD = .17;
    tickIntent(f, .08);
    const previousWeight = f.skill.thrustPose.w; assert.ok(previousWeight > 0);
    assert.ok(!f.skill.tap.abort);
    if (mode === 'walking-attacker-kneels') {
      assert.equal(f.skill.tap.walking, true); f.state = 'kneel';
    } else target(f, v, { x: 1.6 });
    f.move.y = 0; tickIntent(f);
    assert.equal(f.finish.on, true, 'target remains low and generally approachable');
    assert.equal(f.finish.plunge.surfaceInside, false); assert.equal(f.finish.plunge.surfaceWalk, true);
    assert.ok(f.skill.tap.abort, 'this accepted tap cannot follow the now unreachable target');
    assert.ok(!f.skill.tap.walking); assert.ok(!f.skill.tap.go); assert.equal(f.skill.thrustPush, false);
    assert.equal(f.move.y, 0); assert.equal(f.skill.thrustPose.w, previousWeight);
    const recovery = f.skill.tap.K.recover;
    f.skill.updateThrust(recovery / 2);
    assert.ok(f.skill.thrustPose.w > 0 && f.skill.thrustPose.w < previousWeight);
    f.skill.updateThrust(recovery); assert.equal(f.skill.tap, null);
    target(f, v, { x: 1.35 }); assert.ok(f.skill.thrust({ step }));
    assert.equal(f.skill.tap.down, true); tickIntent(f); assert.ok(!f.skill.tap.abort);
    assert.equal(f.move.y, 0);
    return { mode, previousWeight, reinput: entry(f) };
  }));
}

await test('target enters reachable surface without touchdown: approach stops immediately', () => fixture(({ f, v }) => {
  target(f, v, { x: 1.6 }); assert.ok(f.skill.thrust());
  f.gait.active = true; f.gait.sinceTD = .17; tickIntent(f); assert.ok(f.skill.tap.walking);
  // A freely walking sword must preserve intended penetration depth where
  // achievable: merely brushing the surface is not the end of its approach.
  f.move.y = 0; target(f, v, { x: 1.35 }); tickIntent(f);
  assert.equal(f.finish.plunge.surfaceInside, true); assert.equal(f.finish.plunge.inside, false);
  assert.equal(f.skill.tap.walking, true); assert.ok(f.move.y > 0);
  f.move.y = 0; target(f, v, { x: .6 }); tickIntent(f);
  assert.equal(f.skill.tap.walking, false); assert.equal(f.skill.tap.walkEnd, 'inside'); assert.equal(f.move.y, 0);
  return entry(f);
}));

await test('approach without distance progress across touchdowns aborts rather than stabbing air', () => fixture(({ f, v }) => {
  target(f, v, { x: 1.6 }); assert.ok(f.skill.thrust());
  f.gait.active = true; f.gait.sinceTD = 0; tickIntent(f);
  assert.ok(f.skill.tap.walking); f.move.y = 0; tickIntent(f);
  assert.equal(f.skill.tap.walkEnd, 'noprogress'); assert.ok(f.skill.tap.abort);
  assert.equal(f.skill.thrustPush, false); assert.equal(f.move.y, 0);
  return { walkEnd: f.skill.tap.walkEnd, aborted: true };
}));

await test('after approach, already aimed plunge waits for gait stance before commitment', () => fixture(({ f, v }) => {
  target(f, v, { x: 1.6 }); assert.ok(f.skill.thrust());
  f.gait.active = true; f.gait.sinceTD = .17; tickIntent(f);
  target(f, v); f.move.y = 0;
  Object.assign(f.skill.tap, { t: 1, upDone: true, lineDone: true, pv: 0, pvPrev: 0 });
  f.gait.legs.F.stance = true; f.gait.legs.B.stance = false;
  tickIntent(f); assert.equal(f.skill.tap.walking, false); assert.ok(!f.skill.tap.go);
  f.gait.legs.B.stance = true; tickIntent(f); assert.equal(f.skill.tap.go, true);
  return { go: f.skill.tap.go, thrustPush: f.skill.thrustPush };
}));

await test('blunt target requires low head, not only low pelvis/chest', () => fixture(({ f, v }) => {
  target(f, v, { head: 1.1 }); updateFinish(f, 0); assert.equal(f.finish.canStart, false);
  target(f, v, { chest: .53, pelvis: .5, head: .58 }); updateFinish(f, 0); assert.equal(f.finish.canStart, true);
  assert.ok(f.skill.thrust()); assert.equal(f.skill.tap.down, true); return entry(f);
}, { weapon: 'branch' }));

await test('broken very short weapon cannot enter an unreachable plunge', () => fixture(({ f, v }) => {
  f.weaponBroken = true; f.weaponCfg = { ...f.weaponCfg, bladeLength: .08, hiltLength: .12 };
  target(f, v, { x: .5, head: .3, chest: .25, pelvis: .2 }); updateFinish(f, 0);
  assert.equal(f.finish.canStart, false); assert.ok(f.skill.thrust()); assert.equal(f.skill.tap.down, false);
  return entry(f);
}));

await test('ordinary entry model preserves preexisting high-down fade and getup exclusion', () => fixture(({ f, v }) => {
  f.finishEntryModel = 'legacy'; target(f, v, { chest: 1.1, pelvis: .9, head: 1.3 });
  updateFinish(f, .2); assert.ok(f.finish.on); assert.ok(f.skill.thrust()); assert.equal(f.skill.tap.down, true);
  v.state = 'getup'; tickIntent(f); assert.ok(f.skill.tap.abort); return entry(f);
}));

const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const bodyState = body => ({ p: V(body.translation()), q: Q(body.rotation()), com: V(body.worldCom()),
  v: new THREE.Vector3(), w: new THREE.Vector3() });
const damageSnapshot = v => JSON.parse(JSON.stringify({ state: v.state, wounds: v.wounds, bleed: v.bleed,
  blood: v.blood, pain: v.pain, plate: v.plate, cloth: v.cloth, helmetIntegrity: v.helmetIntegrity }));

function damageCase({ part = 'chest', armor = true, high = false, blocked = false, gate = null, forbidLiveRead = false } = {}) {
  return fixture(({ G, f, v }) => {
    target(f, v, { state: 'getup', ...(high ? { chest: .95, pelvis: .75, head: 1.15 } : {}) });
    f.skill.tap = { down: true, go: true, foe: v }; f.skill.thrustPush = true;
    f.emoMods = { dealt: 1, pass: 0 }; v.emoMods = { taken: 1, pass: 0 };
    f.weaponCfg = { ...f.weaponCfg, power: 1 };
    if (gate === 'aborted') f.skill.tap.abort = { t: 0, w: 1 };
    if (gate === 'ended') f.skill.tap.ended = true;
    if (gate === 'ordinary') f.skill.tap.down = false;
    if (gate === 'different-foe') f.skill.tap.foe = f;
    if (gate === 'attacker-down') f.state = 'down';
    if (gate === 'target-kneel') v.state = 'kneel';
    f.cacheState(); v.cacheState();
    const eligible = !high && !gate;
    const entries = [...G.combat.info.values()];
    const wi = entries.find(i => i.fighter === f && i.part === 'blade');
    const vi = entries.find(i => i.fighter === v && i.part === part);
    const P = bodyState(vi.body), sw = bodyState(wi.body);
    const local = part === 'head' ? [.02, .08, .05] : [.11, 0, .05];
    const normalLocal = part === 'head' ? [.3, 1, .4] : [1, 0, 0];
    const point = new THREE.Vector3(...local).applyQuaternion(P.q).add(P.p);
    const normal = new THREE.Vector3(...normalLocal).applyQuaternion(P.q).normalize();
    const y = normal.clone().negate(), up = Math.abs(normal.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const x = new THREE.Vector3().crossVectors(normal, up).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
    const S = { p: point.clone().addScaledVector(y, -(f.weaponCfg.hiltLength + f.weaponCfg.bladeLength)), q,
      v: y.clone().multiplyScalar(5), w: new THREE.Vector3() };
    S.com = S.p.clone().add(comL.applyQuaternion(q));
    const pair = { w: wi, v: vi };
    const measure = predicting => G.combat.analyze(pair, point, S, P, predicting);
    const baseline = () => { G.combat.finishRuleModel = 'legacy'; try { return measure(true); } finally { G.combat.finishRuleModel = 'power'; } };
    const initial = baseline(); assert.equal(initial.type, 'stab'); assert.equal(!!(initial.plate || initial.helmet), armor);
    // 90% of the armor threshold after the bonus remains blocked while the
    // weakest plate fixture still reaches the ordinary 6J contact minimum.
    const baseEff = initial.thr * (blocked ? .36 : .56);
    S.v.multiplyScalar(Math.sqrt(baseEff / initial.eff));
    const base = baseline(); near(base.eff, baseEff, 'independently calibrated base energy');
    const beforeDamage = damageSnapshot(v), beforeTap = { ...f.skill.tap };
    const prediction = measure(true), actualAnalysis = measure(false);
    if (forbidLiveRead) {
      const bodies = [...new Set([...Object.values(f.bodies), ...Object.values(v.bodies), f.sword, v.sword])];
      const saved = bodies.map(body => ({ body, own: Object.hasOwn(body, 'translation'), translation: body.translation }));
      const cachedBefore = JSON.stringify([f.cache, v.cache]);
      try {
        for (const { body } of saved) body.translation = () => { throw Error('Prediction attempted live Rapier translation'); };
        const cached = measure(true); assert.deepEqual(cached, prediction);
        assert.equal(JSON.stringify([f.cache, v.cache]), cachedBefore, 'prediction must not edit cached geometry');
        for (const [who, part] of [[f, 'chest'], [v, 'chest'], [v, 'pelvis']]) {
          const savedPart = who.cache.parts[part];
          try {
            delete who.cache.parts[part];
            const incomplete = measure(true);
            assert.equal(incomplete.finishingStrike, false, 'missing cached geometry must reject without native fallback');
          } finally { who.cache.parts[part] = savedPart; }
        }
        const savedY = v.cache.parts.chest.p.y;
        try {
          v.cache.parts.chest.p.y = .95;
          assert.equal(measure(true).finishingStrike, false, 'prediction follows pre-step cache, not current native low position');
        } finally { v.cache.parts.chest.p.y = savedY; }
      } finally { for (const { body, own, translation } of saved) { if (own) body.translation = translation; else delete body.translation; } }
    }
    assert.deepEqual(damageSnapshot(v), beforeDamage); assert.deepEqual(f.skill.tap, beforeTap);
    assert.equal(prediction.eff, actualAnalysis.eff); assert.equal(prediction.pass, actualAnalysis.pass);
    assert.equal(!!prediction.finishingStrike, eligible); assert.equal(!!actualAnalysis.finishingStrike, eligible);
    assert.equal(prediction.finish, false); assert.equal(actualAnalysis.finish, false);
    near(prediction.eff, base.eff * (eligible ? 2.5 : 1), 'unchanged pre-armor bonus');
    for (const key of ['energy', 'ephys', 'mEff', 'mFree', 'thr']) assert.equal(prediction[key], base[key], `${key} unchanged`);
    f.cache = { sword: S }; v.cache = { parts: { [part]: P } }; v.hitCooldowns.clear();
    const actual = G.combat.strike(pair, point, false);
    assert.ok(actual, `fixture must reach real injury path: ${JSON.stringify(actualAnalysis)}`); assert.deepEqual(actual, actualAnalysis);
    if (!eligible || blocked) {
      assert.equal(prediction.pass, false); assert.equal(v.wounds.length, 0); assert.notEqual(v.state, 'dead');
    } else { assert.ok(prediction.pass); assert.ok(v.wounds.length > 0); }
    return { part, armor, high, blocked, gate, eligible, baseEff: base.eff, effective: prediction.eff,
      threshold: prediction.thr, predictedPass: prediction.pass, actualType: actual.type, wounds: v.wounds.length, forbidLiveRead };
  }, { look2: armor ? (part === 'head' ? LOOKS.player : CHARACTERS_BY_ID.heinrich.look) : LOOKS.enemy });
}
for (const part of ['chest', 'head']) for (const blocked of [true, false]) {
  await test(`low getup ${part} ${blocked ? 'blocked' : 'penetrating'}: armor and 2.5x agree in prediction/strike`, () => damageCase({ part, blocked }));
}
await test('low getup bare torso: normal wound after 2.5x, no automatic kill', () => damageCase({ armor: false }));
await test('high getup contact: no finish bonus', () => damageCase({ high: true }));
await test('prediction with cached low geometry never reads live Rapier body translation', () => damageCase({ forbidLiveRead: true }));
for (const gate of ['aborted', 'ended', 'ordinary', 'different-foe', 'attacker-down', 'target-kneel']) {
  await test(`${gate}: contact cannot gain finish bonus`, () => damageCase({ gate }));
}

const after = hashes();
const report = { kind: 'prepared real Fighter/Skill/Combat connection checks', timestamp: new Date().toISOString(),
  baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: `node tools/sim/experiments/finish_entry_20261008.test.mjs ${out}`,
  selection: selection?.source ?? null,
  limitations: ['No native physics steps or natural-combat efficacy measured', 'Prepared body translations and contact-cache inputs',
    'Height values are test inputs, not human motion measurements', 'Runtime opt-in candidate; this report does not imply public deployment'],
  fixtures, nativeSteps: 0, sourceStable: JSON.stringify(before) === JSON.stringify(after), sourcesBefore: before, sourcesAfter: after,
  passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
report.pass = report.sourceStable && report.failed === 0;
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, pass: report.pass, sourceStable: report.sourceStable, passed: report.passed, failed: report.failed, fixtures, nativeSteps: 0 }));
if (!report.pass) process.exitCode = 1;
