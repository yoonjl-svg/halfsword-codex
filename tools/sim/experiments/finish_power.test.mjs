/** Regression of the ordinary finishing policy through real Combat/Fighter.
 * Deliberately prepared cached sword/body states isolate damage and vitals.
 * No physics steps, natural combat efficacy, or human acceptance are claimed.
 * Usage: node tools/sim/experiments/finish_power.test.mjs /tmp/fresh-report.json
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { newRound, THREE } from '../harness_m.mjs';
import { LOOKS } from '../../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { STRIKE, VITALS } from '../../../src/config.js';

// Independent policy expectation, deliberately not imported from its helper.
const EXPECTED_POWER = 2.5;
const results = [];
const root = new URL('../../../', import.meta.url);
const sources = ['src/combat.js', 'src/fighter.js', 'src/config.js', 'src/finish_rule.js', 'src/revive.js',
  'tools/sim/experiments/finish_power.test.mjs'];
const hashes = () => Object.fromEntries(sources.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex')]));
const beforeHashes = hashes();
const out = process.argv[2] || '/tmp/halfsword-finish-power-tests.json';
if (fs.existsSync(out)) throw Error('Use a fresh output path');
async function test(name, fn) {
  try { results.push({ name, pass: true, details: await fn() }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); console.error('FAIL', name, error.stack); }
}
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1e-11 * Math.max(1, Math.abs(expected)),
  `${message}: actual=${actual}, expected=${expected}`);
const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const state = body => ({ p: V(body.translation()), q: Q(body.rotation()), com: V(body.worldCom()),
  v: new THREE.Vector3(), w: new THREE.Vector3() });
const contexts = [
  { name: 'plate-chest', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true },
  { name: 'helmet-head', look: LOOKS.player, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4], armored: true },
  { name: 'bare-chest', look: LOOKS.enemy, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0] },
  { name: 'bare-head', look: LOOKS.enemy, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4] },
  { name: 'ignore-plate', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true, ignore: true },
  { name: 'ignore-helmet', look: LOOKS.player, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4], armored: true, ignore: true },
  { name: 'worn-plate-cloth-gap', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true, weapon: 'estoc', plate: .3, cloth: .3 },
  { name: 'worn-helmet-gap', look: LOOKS.player, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4], armored: true, weapon: 'estoc', helmet: .05 },
];
const context = name => contexts.find(c => c.name === name);
function outcome(vic) {
  return { state: vic.state, cause: vic.causeOfDeath ?? null, wounds: vic.wounds, bleed: vic.bleed,
    blood: vic.blood, pain: vic.pain, balance: vic.balance, consciousness: vic.consciousness,
    daze: vic.daze ?? 0, cloth: vic.cloth, helmetIntegrity: vic.helmetIntegrity, hasHelmet: vic.hasHelmet,
    plate: vic.plate, reviveLeft: vic.revive?.left ?? null, revival: vic.revival ? { phase: vic.revival.phase, cause: vic.revival.cause } : null };
}
const snapshot = vic => JSON.parse(JSON.stringify(outcome(vic)));
function summary(r) {
  if (!r) return null;
  return Object.fromEntries(['type', 'zone', 'energy', 'ephys', 'mEff', 'mFree', 'eff', 'thr', 'severity',
    'pass', 'finish', 'finishingStrike', 'helmet', 'plate', 'speed'].map(k => [k, r[k]]));
}
function ordinaryFields(r) {
  if (!r) return null;
  const { finishingStrike, bareThreshold, armorBlocked, armorGuarded, finishRuleReason, ...rest } = r;
  return rest;
}

function fixture(c, band, options = {}, verify = () => {}) {
  const { model = 'power', gate = null, opponent = false, playerScope = false, revive = false,
    lowConsciousness = false, shape = 'stab', extraBaseEff = null } = options;
  const reviveSpec = revive ? CHARACTERS_BY_ID.isolde.revive : undefined;
  const G = newRound({ seed: 173, look: opponent ? c.look : LOOKS.enemy, look2: opponent ? LOOKS.enemy : c.look,
    weapon: opponent ? 'longsword' : c.weapon ?? 'longsword', weapon2: opponent ? c.weapon ?? 'longsword' : 'longsword',
    revive: opponent ? undefined : reviveSpec, revive2: opponent ? reviveSpec : undefined, walls: false });
  try {
    const att = opponent ? G.enemy : G.player, vic = opponent ? G.player : G.enemy;
    G.combat.finishRuleModel = model;
    if (playerScope) G.combat.finishRuleFighter = G.player;
    const effectiveModel = playerScope && opponent ? 'legacy' : model;
    att.foe = vic; vic.foe = att;
    att.state = 'stand'; vic.state = 'down';
    att.skill.tap = { down: true, go: true }; att.skill.thrustPush = true;
    att.emoMods = { dealt: 1, pass: 0 }; vic.emoMods = { taken: 1, pass: 0 };
    att.weaponCfg = { ...att.weaponCfg, ignoreArmor: !!c.ignore, power: 1 };
    if (lowConsciousness) vic.consciousness = .001;
    if (c.cloth !== undefined) vic.cloth[c.part] = c.cloth;
    if (c.plate !== undefined) vic.plate[c.part] = c.plate;
    if (c.helmet !== undefined) vic.helmetIntegrity = c.helmet;
    const gates = {
      'no-down-tap': () => { att.skill.tap.down = false; },
      'no-tap': () => { att.skill.tap = null; },
      'aiming': () => { att.skill.tap.go = false; },
      'no-push': () => { att.skill.thrustPush = false; },
      'attacker-down': () => { att.state = 'down'; },
      'target-stand': () => { vic.state = 'stand'; },
      'target-kneel': () => { vic.state = 'kneel'; },
      'target-getup': () => { vic.state = 'getup'; },
      'different-foe': () => { att.foe = null; },
    };
    if (gate) gates[gate]();
    const expectedEligible = !gate && shape === 'stab' && ['head', 'chest', 'abdomen', 'pelvis'].includes(c.part);
    const entries = [...G.combat.info.values()];
    const wi = entries.find(i => i.fighter === att && i.part === 'blade');
    const vi = entries.find(i => i.fighter === vic && i.part === c.part);
    const P = state(vi.body), sw = state(wi.body);
    const point = new THREE.Vector3(...c.local).applyQuaternion(P.q).add(P.p);
    const normal = new THREE.Vector3(...c.normal).applyQuaternion(P.q).normalize();
    const y = normal.clone().negate();
    const up = Math.abs(normal.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const x = new THREE.Vector3().crossVectors(normal, up).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
    const S = { p: point.clone().addScaledVector(y, -(att.weaponCfg.hiltLength + att.weaponCfg.bladeLength)), q,
      v: (shape === 'cut' ? x : shape === 'blunt' ? z : y).clone().multiplyScalar(5), w: new THREE.Vector3() };
    S.com = S.p.clone().add(comL.applyQuaternion(q));
    const pr = { w: wi, v: vi };
    const measure = predicting => G.combat.analyze(pr, point, S, P, predicting);
    const legacyMeasure = predicting => {
      const savedModel = G.combat.finishRuleModel;
      try { G.combat.finishRuleModel = 'legacy'; return measure(predicting); }
      finally { G.combat.finishRuleModel = savedModel; }
    };
    const initial = legacyMeasure(true);
    assert.ok(initial); assert.equal(initial.type, shape);
    assert.equal(!!(initial.plate || initial.helmet), !!c.armored);
    const threshold = initial.thr;
    if (shape !== 'blunt') {
      // Calibrate from the unamplified real analyzer, so asserting ×2.5 below
      // is independent of the candidate's implementation and energy helper.
      const targetAmplified = band === 'weak' ? threshold * .8 : band === 'equal' ? threshold
        : band === 'just-below' ? threshold - 1e-10 : band === 'just-above' ? threshold + 1e-10
        : band === 'wound' ? threshold * 1.1 : band === 'pass' ? threshold * 1.4
          : band === 'head-safe' ? threshold + 20 : band === 'head-fatal' ? threshold + 31 : threshold * 3;
      const targetBase = extraBaseEff ?? targetAmplified / EXPECTED_POWER;
      S.v.multiplyScalar(Math.sqrt(targetBase / initial.eff));
      let measured = legacyMeasure(true);
      for (let i = 0; i < 10 && measured.eff !== targetBase; i++) {
        att.weaponCfg.power *= targetBase / measured.eff; measured = legacyMeasure(true);
      }
      near(measured.eff, targetBase, 'unamplified fixture calibration');
      // Exact equality is an essential strict-boundary case, not a rounded
      // display. Adjust the prepared input if arithmetic needs it.
      if (band === 'equal' && effectiveModel === 'power' && expectedEligible) {
        let measuredPower = measure(true);
        for (let i = 0; i < 10 && measuredPower.eff !== threshold; i++) {
          att.weaponCfg.power *= threshold / measuredPower.eff; measuredPower = measure(true);
        }
        assert.equal(measuredPower.eff, threshold, 'fixture must land exactly on armor threshold');
      }
    }
    const before = snapshot(vic);
    const legacy = legacyMeasure(true);
    const prediction = measure(true);
    const actualAnalysis = measure(false);
    assert.deepEqual(snapshot(vic), before, 'prediction/analysis must not mutate Fighter');
    assert.equal(prediction.eff, actualAnalysis.eff, 'prediction and actual effective energy');
    assert.equal(prediction.thr, actualAnalysis.thr, 'prediction and actual armor threshold');
    assert.equal(prediction.pass, actualAnalysis.pass, 'prediction and actual pass decision');
    assert.equal(prediction.finish, actualAnalysis.finish, 'prediction and actual auto-death flag');
    if (effectiveModel === 'power') {
      assert.equal(prediction.finish, false, 'power must never request automatic death');
      assert.equal(!!prediction.finishingStrike, expectedEligible, 'finishing commitment must follow all eligibility gates');
      assert.equal(!!actualAnalysis.finishingStrike, expectedEligible);
      if (shape !== 'blunt') near(prediction.eff, legacy.eff * (expectedEligible ? EXPECTED_POWER : 1), 'pre-armor effective multiplier');
      for (const k of ['energy', 'ephys', 'mEff', 'mFree']) assert.equal(prediction[k], legacy[k], `bonus must not scale ${k}`);
      if (prediction.eff !== null && prediction.eff <= prediction.thr && shape !== 'blunt') {
        assert.equal(prediction.type, shape); assert.equal(actualAnalysis.type, 'blunt');
        const savedTap = att.skill.tap;
        try {
          att.skill.tap = null;
          const noFinish = measure(false);
          for (const k of ['energy', 'ephys', 'mEff']) assert.equal(actualAnalysis[k], noFinish[k], `blocked fallback must retain ${k}`);
        } finally { att.skill.tap = savedTap; }
      }
    }
    att.cache = { sword: S }; vic.cache = { parts: { [c.part]: P } }; vic.hitCooldowns.clear();
    const actual = G.combat.strike(pr, point, false);
    if (actualAnalysis.energy < STRIKE.minEnergy) assert.equal(actual, null);
    else assert.deepEqual(actual, actualAnalysis, 'strike must apply the actual analyzed hit');
    const immediate = snapshot(vic);
    const applied = !!actual && (actual.type !== 'blunt' || actual.severity > 0 || actual.energy > 10);
    const bit = applied && actual.type !== 'blunt' && actual.severity > 0;
    assert.equal(vic.wounds.length, bit ? 1 : 0, 'blocked contact must not invent a wound');
    assert.equal(vic.bleed > 0, bit, 'bleed must come from a tissue wound');
    if (!applied) assert.deepEqual(immediate, before, 'ordinary sub-minimum/no-effect gate');
    if (applied && c.armored) assert.ok(c.part === 'head' ? vic.helmetIntegrity < before.helmetIntegrity : vic.plate[c.part] < before.plate[c.part], 'ordinary armor wear must remain');
    if (applied && !bit && prediction.plate) assert.equal(vic.cloth[c.part] ?? 1, before.cloth[c.part] ?? 1, 'blocked plate must preserve underlying cloth');
    const data = { G, att, vic, before, legacy, prediction, actualAnalysis, actual, immediate, applied, bit, expectedEligible };
    verify(data);
    return { context: c.name, band, model, effectiveModel, gate, opponent, playerScope, shape,
      expectedEligible, base: summary(legacy), prediction: summary(prediction), actual: summary(actual), before, immediate, final: snapshot(vic) };
  } finally { G.eventQueue.free(); G.world.free(); }
}

for (const c of contexts) {
  // At 5% helmet integrity plus estoc gap, the actual threshold is
  // 25.874999999999996. No representable double multiplied by 2.5 equals
  // that double. Bracket it closely; seven other contexts test exact equality.
  const bands = c.name === 'worn-helmet-gap' ? ['weak', 'just-below', 'just-above', 'wound', 'pass'] : ['weak', 'equal', 'wound', 'pass'];
  for (const band of bands) {
  await test(`power ${c.name} ${band}: armor, prediction, wounds and wear`, () => fixture(c, band, {}, d => {
    const r = d.prediction;
    if (band === 'weak' || band === 'equal' || band === 'just-below') {
      assert.ok(r.eff <= r.thr); assert.equal(r.pass, false); assert.equal(r.severity, 0);
      assert.equal(d.vic.state, 'down', 'blocked eligible hit cannot kill automatically');
    } else {
      assert.ok(d.actual, 'above-threshold fixture must reach Fighter');
      assert.ok(r.severity > 0); assert.equal(r.pass, band === 'pass');
      assert.ok(d.vic.bleed > 0); assert.equal(d.vic.wounds.length, 1);
      if (c.part !== 'head' || r.severity <= .5) assert.equal(d.vic.state, 'down', 'nonfatal wound cannot become auto-death');
      else assert.equal(d.vic.state, 'dead', 'ordinary fatal head threshold still applies');
    }
  }));
  }
}

for (const name of ['bare-chest', 'plate-chest', 'bare-head', 'helmet-head']) {
  await test(`power ${name}: high energy has no additional 80J cap`, () => fixture(context(name), 'high', { extraBaseEff: 200 }, d => {
    near(d.prediction.eff, 500, 'uncapped 200J effective input');
    assert.ok(d.prediction.eff - d.legacy.eff > 80, 'must distinguish uncapped policy from capped proposal');
    assert.equal(d.actual.type, 'stab'); assert.equal(d.actual.pass, true);
    assert.equal(d.vic.state, name.endsWith('head') ? 'dead' : 'down');
  }));
}

for (const gate of ['no-down-tap', 'no-tap', 'aiming', 'no-push', 'attacker-down', 'target-stand', 'target-kneel', 'target-getup', 'different-foe']) {
  await test(`ineligible ${gate}: actual injury remains legacy exact`, () => {
    const power = fixture(context('plate-chest'), 'high', { gate, extraBaseEff: 90 });
    const legacy = fixture(context('plate-chest'), 'high', { gate, extraBaseEff: 90, model: 'legacy' });
    assert.deepEqual(ordinaryFields(power.prediction), ordinaryFields(legacy.prediction));
    assert.deepEqual(ordinaryFields(power.actual), ordinaryFields(legacy.actual));
    assert.deepEqual(power.final, legacy.final);
    return { power, legacyExact: true };
  });
}
for (const shape of ['cut', 'blunt']) await test(`ineligible ${shape}: no bonus and legacy exact wound`, () => {
  const power = fixture(context('bare-chest'), 'high', { shape, extraBaseEff: 90 });
  const legacy = fixture(context('bare-chest'), 'high', { shape, extraBaseEff: 90, model: 'legacy' });
  assert.deepEqual(ordinaryFields(power.prediction), ordinaryFields(legacy.prediction));
  assert.deepEqual(ordinaryFields(power.actual), ordinaryFields(legacy.actual));
  assert.deepEqual(power.final, legacy.final);
  return { power, legacyExact: true };
});
await test('ineligible arm: no finishing bonus on a limb', () => {
  const c = { name: 'bare-arm', look: LOOKS.enemy, part: 'uarmS', local: [0, 0, .045], normal: [0, 0, 1] };
  const power = fixture(c, 'high', { extraBaseEff: 40 });
  const legacy = fixture(c, 'high', { extraBaseEff: 40, model: 'legacy' });
  assert.deepEqual(ordinaryFields(power.actual), ordinaryFields(legacy.actual));
  assert.deepEqual(power.final, legacy.final);
  return { power, legacyExact: true };
});
await test('unrestricted ordinary policy also boosts opponent finish', () => fixture(context('plate-chest'), 'pass', { opponent: true }, d => {
  assert.ok(d.actual); assert.equal(d.actual.finishingStrike, true); assert.equal(d.actual.finish, false);
  assert.equal(d.vic.state, 'down');
}));
await test('player-scoped historical comparison leaves excluded opponent legacy exact', () => {
  const power = fixture(context('plate-chest'), 'weak', { opponent: true, playerScope: true });
  const legacy = fixture(context('plate-chest'), 'weak', { opponent: true, model: 'legacy' });
  assert.deepEqual(power.prediction, legacy.prediction); assert.deepEqual(power.actual, legacy.actual);
  assert.deepEqual(power.final, legacy.final); assert.equal(power.final.state, 'dead');
  const player = fixture(context('plate-chest'), 'weak', { playerScope: true });
  assert.equal(player.final.state, 'down');
  return { opponent: power, player, excludedOpponentLegacyExact: true };
});

await test('eligible head wound below ordinary fatal severity survives', () => fixture(context('bare-head'), 'head-safe', {}, d => {
  near(d.actual.severity, 1 / 3, 'normal head injury severity'); assert.equal(d.vic.state, 'down');
  assert.ok(d.vic.bleed > 0); d.vic.updateVitals(.1); assert.equal(d.vic.state, 'down');
}));
await test('eligible head wound above ordinary fatal severity dies', () => fixture(context('bare-head'), 'head-fatal', {}, d => {
  assert.ok(d.actual.severity > .5); assert.equal(d.actual.finish, false); assert.equal(d.vic.state, 'dead');
}));
await test('eligible torso wound survives impact and can later die through normal bleeding', () => fixture(context('bare-chest'), 'high', { extraBaseEff: 200 }, d => {
  assert.equal(d.vic.state, 'down'); assert.ok(d.vic.bleed > 0);
  d.vic.updateVitals((d.vic.blood - VITALS.collapseBlood + .01) / d.vic.bleed);
  assert.equal(d.vic.state, 'dead'); assert.equal(d.vic.causeOfDeath, '출혈');
}));
await test('Isolde ordinary fatal head wound still starts revival', () => fixture(context('bare-head'), 'high', { gate: 'no-down-tap', extraBaseEff: 90, revive: true }, d => {
  assert.equal(d.actual.finish, false); assert.equal(!!d.actual.finishingStrike, false);
  assert.equal(d.vic.state, 'down'); assert.equal(d.vic.revival?.phase, 'fall');
  assert.equal(d.vic.revival?.cause, '머리'); assert.equal(d.vic.revive.left, 0);
}));
await test('Isolde genuinely fatal finishing head wound cannot revive', () => fixture(context('bare-head'), 'head-fatal', { revive: true }, d => {
  assert.equal(d.actual.finish, false); assert.equal(d.actual.finishingStrike, true);
  assert.ok(d.actual.severity > .5); assert.equal(d.vic.state, 'dead');
  assert.equal(d.vic.revival, null); assert.equal(d.vic.revive.left, 1);
}));
await test('Isolde nonfatal finishing torso wound retains later bleeding revival', () => fixture(context('bare-chest'), 'high', { extraBaseEff: 200, revive: true }, d => {
  assert.equal(d.vic.state, 'down'); assert.equal(d.vic.revival, null); assert.equal(d.vic.revive.left, 1);
  d.vic.updateVitals((d.vic.blood - VITALS.collapseBlood + .01) / d.vic.bleed);
  assert.equal(d.vic.state, 'down'); assert.equal(d.vic.revival?.cause, '출혈'); assert.equal(d.vic.revive.left, 0);
}));
await test('Isolde blocked finishing head strike retains ordinary concussion revival', () => fixture(context('helmet-head'), 'weak', { lowConsciousness: true, revive: true }, d => {
  assert.equal(d.actual.type, 'blunt'); assert.equal(d.actual.finishingStrike, true);
  assert.equal(d.vic.wounds.length, 0); assert.equal(d.vic.revival, null); assert.equal(d.vic.revive.left, 1);
  assert.ok(d.vic.consciousness < 0); d.vic.updateVitals(0);
  assert.equal(d.vic.state, 'down'); assert.equal(d.vic.revival?.cause, '기절'); assert.equal(d.vic.revive.left, 0);
}));

const afterHashes = hashes();
const sourceStable = JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
const report = { pass: sourceStable && results.every(r => r.pass), model: 'power', expectedPower: EXPECTED_POWER,
  sourceStable, sourceBefore: beforeHashes, sourceAfter: afterHashes, sourceRoot: fileURLToPath(root), tests: results,
  method: 'Prepared cached-state real Combat.analyze/strike and Fighter wounds/vitals; no physics steps. Legacy analyzer supplies matched unamplified controls. Not natural combat or acceptance.' };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, tests: results.length, failed: results.filter(r => !r.pass).map(r => r.name), sourceStable, out }));
process.exitCode = report.pass ? 0 : 1;
