/** Component tests of real Combat/Fighter injury and finishing-rule branches.
 * Cached sword/part states and explicit down/tap preparation isolate damage;
 * no physics steps, natural-combat efficacy or human acceptance are claimed.
 * Output defaults outside the checkout. --helper-only omits Combat fixtures.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolveFinishRule } from '../../../src/finish_rule.js';

const results = [];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const files = ['src/combat.js', 'src/fighter.js', 'src/config.js', 'src/finish_rule.js', 'tools/sim/armor_eval.mjs', 'tools/sim/experiments/finish_rule.test.mjs'];
const hashes = () => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))]));
const before = hashes();
const armorGuard = process.argv.includes('--armor-guard');
const candidateModel = armorGuard ? 'armorGuard' : 'armorCausal';
const helperOnly = process.argv.includes('--helper-only');
const out = process.argv.slice(2).find(arg => !arg.startsWith('--')) || '/tmp/halfsword-finish-rule-tests.json';
if (fs.existsSync(out)) throw Error('Use a fresh output path');
async function test(name, fn) {
  try { results.push({ name, pass: true, details: await fn() }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); console.error('FAIL', name, error.stack); }
}
const base = { eligible: true, type: 'stab', eff: 40, threshold: 47, bareThreshold: 25, armorActive: true, ignoreArmor: false };
await test('helper: legacy default and unknown model preserve the approved exception', () => {
  for (const model of [undefined, 'legacy', 'unknown']) assert.deepEqual(resolveFinishRule({ ...base, model }), { finish: true, armorBlocked: true, reason: 'legacy' });
});
await test('helper: only contributing armor can cancel an eligible finishing stab', () => {
  assert.deepEqual(resolveFinishRule({ ...base, model: 'armorCausal' }), { finish: false, armorBlocked: true, reason: 'armor-blocked' });
  for (const patch of [{ armorActive: false }, { ignoreArmor: true }, { eff: 25 }, { eff: 24 }, { threshold: 25 }, { threshold: 20 }, { type: 'cut' }, { eff: NaN }, { bareThreshold: null }]) {
    const r = resolveFinishRule({ ...base, ...patch, model: 'armorCausal' });
    assert.equal(r.finish, true); assert.equal(r.armorBlocked, false);
  }
  assert.deepEqual(resolveFinishRule({ ...base, eligible: false, model: 'armorCausal' }), { finish: false, armorBlocked: false, reason: 'ineligible' });
});
await test('helper: equality blocks, injured nonpassing band and above-threshold hits retain finish', () => {
  assert.equal(resolveFinishRule({ ...base, eff: 47, model: 'armorCausal' }).finish, false);
  for (const eff of [47 + Number.EPSILON * 47, 50, 100]) assert.equal(resolveFinishRule({ ...base, eff, model: 'armorCausal' }).finish, true);
  assert.equal(resolveFinishRule({ ...base, eff: 25, model: 'armorCausal' }).finish, true);
});

if (armorGuard) {
  await test('helper: fixed armor has no weak-kill / stronger-survival reversal', () => {
    const rows = [0, 24, 25, 26, 40, 47, 47 + Number.EPSILON * 47, 60].map(eff => {
      const r = resolveFinishRule({ ...base, eff, model: 'armorGuard' });
      assert.equal(r.finish, eff > 47);
      assert.equal(r.armorGuarded, eff <= 47);
      assert.equal(r.armorBlocked, eff > 25 && eff <= 47);
      assert.equal(r.reason, eff <= 47 ? 'armor-guarded' : 'exception-preserved');
      return { eff, ...r };
    });
    for (const model of ['legacy', 'armorCausal']) {
      assert.equal(resolveFinishRule({ ...base, eff: 24, model }).finish, true);
    }
    return rows;
  });
  await test('helper: uncovered, ignored, depleted/noncontributing armor and invalid measures keep the exception', () => {
    for (const patch of [{ armorActive: false }, { ignoreArmor: true }, { eff: 24, threshold: 25 },
      { threshold: 20 }, { type: 'cut' }, { eff: NaN }, { threshold: Infinity }, { bareThreshold: null }]) {
      const r = resolveFinishRule({ ...base, ...patch, model: 'armorGuard' });
      assert.equal(r.finish, true); assert.equal(r.armorGuarded, false);
    }
    assert.deepEqual(resolveFinishRule({ ...base, eligible: false, model: 'armorGuard' }),
      { finish: false, armorBlocked: false, reason: 'ineligible' });
  });
}

if (!helperOnly) {
  const { newRound, THREE } = await import('../harness_m.mjs');
  const { LOOKS } = await import('../../../src/looks.js');
  const { CHARACTERS_BY_ID } = await import('../../../src/characters.js');
  const { ANATOMY, STRIKE, VITALS } = await import('../../../src/config.js');
  // Own repository's frozen prior runtime, changing import locations only.
  // Default exactness is checked against this class, not a mirrored formula.
  const coldCommit = 'f3ee59f9db764ec370237b5fd29f6b39a0ae2826';
  const coldSource = execFileSync('git', ['show', `${coldCommit}:src/combat.js`], { encoding: 'utf8' });
  const coldModule = coldSource.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
    const url = specifier.startsWith('.') ? new URL(specifier, new URL('../../../src/combat.js', import.meta.url)).href : import.meta.resolve(specifier);
    return `from ${quote}${url}${quote}`;
  });
  const { Combat: ColdCombat } = await import('data:text/javascript;base64,' + Buffer.from(coldModule).toString('base64'));
  const V = value => new THREE.Vector3(value.x, value.y, value.z);
  const Q = value => new THREE.Quaternion(value.x, value.y, value.z, value.w);
  const state = body => ({ p: V(body.translation()), q: Q(body.rotation()), com: V(body.worldCom()), v: new THREE.Vector3(), w: new THREE.Vector3() });
  const contexts = [
    { name: 'plate-chest', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true },
    { name: 'helmet-head', look: LOOKS.player, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4], armored: true },
    { name: 'bare-chest', look: LOOKS.enemy, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0] },
    { name: 'bare-head', look: LOOKS.enemy, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4] },
    { name: 'ignore-plate', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true, ignore: true },
    { name: 'ignore-helmet', look: LOOKS.player, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4], armored: true, ignore: true },
    { name: 'worn-plate-torn-cloth', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true, plateIntegrity: .3, cloth: .3 },
    { name: 'worn-helmet', look: LOOKS.player, part: 'head', local: [.02, .08, .05], normal: [.3, 1, .4], armored: true, helmetIntegrity: .05 },
    { name: 'estoc-gap-worn-plate', look: CHARACTERS_BY_ID.heinrich.look, part: 'chest', local: [.11, 0, .05], normal: [1, 0, 0], armored: true, weapon: 'estoc', plateIntegrity: .3, cloth: .3 },
  ];
  function outcome(vic) {
    return { state: vic.state, cause: vic.causeOfDeath ?? null, wounds: vic.wounds, bleed: vic.bleed, pain: vic.pain, balance: vic.balance,
      consciousness: vic.consciousness, daze: vic.daze ?? 0, cloth: vic.cloth, helmetIntegrity: vic.helmetIntegrity, hasHelmet: vic.hasHelmet, plate: vic.plate };
  }
  function resultSummary(r) {
    return { type: r.type, energy: r.energy, eff: r.eff, thr: r.thr, bareThreshold: r.bareThreshold, severity: r.severity, pass: r.pass, finish: r.finish, armorBlocked: r.armorBlocked, armorGuarded: r.armorGuarded, finishRuleReason: r.finishRuleReason,
      helmet: r.helmet, plate: r.plate, mEff: r.mEff, ephys: r.ephys };
  }
  function fixture(context, band, model, { eligible = true, cold = false, ordinaryLethal = false, lowConsciousness = false, opponentAttack = false, playerScope = false } = {}) {
    const G = newRound({ seed: 173, look: opponentAttack ? context.look : LOOKS.enemy, look2: opponentAttack ? LOOKS.enemy : context.look, weapon: opponentAttack ? 'longsword' : context.weapon ?? 'longsword', weapon2: opponentAttack ? context.weapon ?? 'longsword' : 'longsword', walls: false });
    try {
      const vic = opponentAttack ? G.player : G.enemy, att = opponentAttack ? G.enemy : G.player;
      if (cold) G.combat = new ColdCombat(G.combat.info, G.combat.hooks);
      if (model !== undefined) G.combat.finishRuleModel = model;
      if (playerScope) G.combat.finishRuleFighter = G.player;
      const effectiveModel = playerScope && opponentAttack ? 'legacy' : model;
      att.foe = vic; vic.foe = att;
      att.state = 'stand'; vic.state = ordinaryLethal ? 'stand' : 'down';
      if (lowConsciousness) vic.consciousness = .001;
      const consciousnessBefore = vic.consciousness;
      att.skill.tap = { down: eligible, go: true }; att.skill.thrustPush = true;
      // No emotional multipliers or foreign weapon changes confound thresholds.
      att.emoMods = { dealt: 1, pass: 0 }; vic.emoMods = { taken: 1, pass: 0 };
      att.weaponCfg = { ...att.weaponCfg, ignoreArmor: !!context.ignore, power: 1 };
      // Controlled damage-component preparation; these wear/cloth states are
      // assigned here, not produced by a simulated preceding combat.
      if (context.cloth !== undefined) vic.cloth[context.part] = context.cloth;
      if (context.plateIntegrity !== undefined) vic.plate[context.part] = context.plateIntegrity;
      if (context.helmetIntegrity !== undefined) vic.helmetIntegrity = context.helmetIntegrity;
      const clothBefore = vic.cloth[context.part] ?? 1, plateBefore = vic.plate[context.part] ?? 0, helmetBefore = vic.helmetIntegrity;
      const info = [...G.combat.info.values()];
      const wi = info.find(i => i.fighter === att && i.part === 'blade');
      const vi = info.find(i => i.fighter === vic && i.part === context.part);
      const P = state(vi.body), sw = state(wi.body);
      const point = new THREE.Vector3(...context.local).applyQuaternion(P.q).add(P.p);
      const n = new THREE.Vector3(...context.normal).applyQuaternion(P.q).normalize();
      const y = n.clone().negate(), up = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const x = new THREE.Vector3().crossVectors(n, up).normalize(), z = new THREE.Vector3().crossVectors(x, y);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
      const S = { p: point.clone().addScaledVector(y, -(att.weaponCfg.hiltLength + att.weaponCfg.bladeLength)), q, v: y.clone().multiplyScalar(5), w: new THREE.Vector3() };
      S.com = S.p.clone().add(comL.applyQuaternion(q));
      const pr = { w: wi, v: vi };
      const measure = () => G.combat.analyze(pr, point, S, P, true);
      const initial = measure();
      assert.ok(initial && initial.type === 'stab');
      assert.equal(!!(initial.plate || initial.helmet), !!context.armored);
      // The original full-cloth/no-gap cases could use ignoreArmor exactly.
      // It also resets clothing/gap handling, so the extended counterfactual
      // removes actual coverage instead, preserving cloth, weapon and S/P.
      const armorSnapshot = JSON.stringify(outcome(vic)), savedHelmet = vic.hasHelmet;
      const hadPlate = Object.hasOwn(vic.plate, context.part), savedPlate = vic.plate[context.part];
      let bareResult;
      try { vic.hasHelmet = false; vic.plate[context.part] = 0; bareResult = measure(); }
      finally { vic.hasHelmet = savedHelmet; if (hadPlate) vic.plate[context.part] = savedPlate; else delete vic.plate[context.part]; }
      assert.equal(JSON.stringify(outcome(vic)), armorSnapshot, 'matched bare measurement failed to restore armor');
      assert.equal(bareResult.eff, initial.eff, 'removing coverage changes effective strike energy');
      assert.equal(bareResult.helmet, false); assert.equal(bareResult.plate, false);
      const bareThreshold = bareResult.thr;
      const threshold = initial.thr;
      const targetEff = band === 'below-bare' ? bareThreshold * .75
        : band === 'between' ? (threshold > bareThreshold ? (bareThreshold + threshold) / 2 : bareThreshold)
          : band === 'exact' ? threshold : band === 'nonpassing' ? threshold * 1.1 : threshold * 2.7;
      // Scale speed to stay within actual 0.5..30 m/s classification bounds.
      S.v.multiplyScalar(Math.sqrt(targetEff / initial.eff));
      let predicted = measure();
      // Tune the component fixture's power to an exact threshold boundary.
      if (band === 'exact' || (band === 'between' && threshold === bareThreshold)) {
        for (let i = 0; i < 8 && predicted.eff !== targetEff; i++) { att.weaponCfg.power *= targetEff / predicted.eff; predicted = measure(); }
        assert.equal(predicted.eff, targetEff, 'component equality must be exact, not rounded across the strict boundary');
      }
      assert.ok(predicted.energy >= STRIKE.minEnergy);
      const snapshotBefore = JSON.stringify(outcome(vic));
      const prediction = measure();
      if (!cold && ['armorCausal', 'armorGuard'].includes(effectiveModel)) assert.equal(prediction.bareThreshold, bareThreshold, 'runtime bare threshold loses cloth/gap modifiers');
      assert.equal(JSON.stringify(outcome(vic)), snapshotBefore, 'prediction mutated fighter');
      const actualAnalysis = G.combat.analyze(pr, point, S, P, false);
      assert.equal(JSON.stringify(outcome(vic)), snapshotBefore, 'actual analysis mutated fighter');
      const causal = !!(eligible && !ordinaryLethal && context.armored && !context.ignore && threshold > bareThreshold && prediction.eff <= threshold && prediction.eff > bareThreshold);
      const guarded = !!(eligible && !ordinaryLethal && context.armored && !context.ignore && threshold > bareThreshold && prediction.eff <= threshold);
      const expectedFinish = eligible && !ordinaryLethal && !(effectiveModel === 'armorCausal' && causal) && !(effectiveModel === 'armorGuard' && guarded);
      assert.equal(prediction.finish, expectedFinish);
      assert.equal(actualAnalysis.finish, expectedFinish);
      if (!cold && ['armorCausal', 'armorGuard'].includes(effectiveModel)) assert.equal(prediction.armorBlocked, causal);
      if (effectiveModel === 'armorGuard') { assert.equal(prediction.armorGuarded, guarded); assert.equal(actualAnalysis.armorGuarded, guarded); }
      if (band === 'nonpassing') { assert.ok(prediction.severity > 0); assert.equal(prediction.pass, false); }
      if (band === 'above') assert.equal(prediction.pass, true);
      if (prediction.eff <= threshold) {
        assert.equal(prediction.type, 'stab'); assert.equal(prediction.pass, false);
        assert.equal(actualAnalysis.type, expectedFinish ? 'stab' : 'blunt');
      }
      att.cache = { sword: S }; vic.cache = { parts: { [context.part]: P } }; vic.hitCooldowns.clear();
      const result = G.combat.strike(pr, point, false);
      if (actualAnalysis.energy < STRIKE.minEnergy) { assert.equal(result, null); assert.equal(vic.hitCooldowns.size, 0); }
      else { assert.ok(result); assert.deepEqual(result, actualAnalysis); }
      const final = outcome(vic), applied = !!result && (result.type !== 'blunt' || result.severity > 0 || result.energy > 10);
      const bit = applied && result.type !== 'blunt' && result.severity > 0;
      if (!applied) assert.equal(JSON.stringify(final), snapshotBefore, 'sub-10J ordinary blunt hit must retain the no-effect gate');
      assert.equal(final.wounds.length, bit ? 1 : 0);
      assert.equal(final.bleed > 0, bit);
      if (expectedFinish) { assert.equal(final.state, 'dead'); assert.equal(final.cause, '내려찍기'); }
      else if (!ordinaryLethal) assert.equal(final.state, 'down');
      if (applied && !bit && context.part === 'head') {
        const k = result.helmet ? result.helmetBlunt : 1;
        assert.equal(final.consciousness, consciousnessBefore - result.energy * VITALS.concussionPerJoule * k);
        assert.ok(final.daze > 0);
      }
      if (!bit && prediction.plate) assert.equal(final.cloth[context.part] ?? 1, clothBefore, 'blocked plate hit tears underlying cloth');
      if (applied && context.armored) assert.ok(context.part === 'head' ? final.helmetIntegrity < helmetBefore : final.plate[context.part] < plateBefore, 'armor wear lost');
      if (!expectedFinish && prediction.eff <= threshold) {
        const push = att.skill.thrustPush; att.skill.thrustPush = false;
        const unassisted = G.combat.analyze(pr, point, S, P, false); att.skill.thrustPush = push;
        assert.equal(actualAnalysis.mEff, unassisted.mEff); assert.equal(actualAnalysis.energy, unassisted.energy); assert.equal(actualAnalysis.ephys, unassisted.ephys);
      }
      if (ordinaryLethal) { assert.equal(final.state, 'dead'); assert.equal(final.cause, '머리'); assert.equal(result.finish, false); }
      if (lowConsciousness) {
        assert.ok(vic.consciousness < 0); vic.updateVitals(0);
        assert.equal(vic.state, 'dead'); assert.equal(vic.causeOfDeath, '기절'); assert.equal(vic.wounds.length, 0);
        Object.assign(final, outcome(vic));
      }
      return { prediction, actual: result, final, details: { context: context.name, band, model: model ?? 'default', effectiveModel: effectiveModel ?? 'default', playerScope, attackerIndex: att.index, eligible, weapon: att.weaponCfg.id, thrustGap: att.weaponCfg.thrustStyle?.gap ?? 0, clothBefore, plateBefore, helmetBefore, bareThreshold, threshold, causal, applied, prediction: resultSummary(prediction), actualAnalysis: resultSummary(actualAnalysis), actual: result ? resultSummary(result) : null, state: final.state, cause: final.cause, wounds: final.wounds.length, bleed: final.bleed, consciousness: final.consciousness } };
    } finally { G.eventQueue.free(); G.world.free(); }
  }
  for (const context of contexts) for (const band of ['below-bare', 'between', 'exact', 'nonpassing', 'above']) {
    await test(`Combat/Fighter ${context.name} ${band}: candidate and default cold exact`, () => {
      const candidate = fixture(context, band, candidateModel);
      const ordinary = fixture(context, band, undefined), legacy = fixture(context, band, 'legacy'), cold = fixture(context, band, undefined, { cold: true });
      for (const current of [ordinary, legacy]) {
        assert.deepEqual(current.prediction, cold.prediction, 'cold prediction including return shape');
        assert.deepEqual(current.actual, cold.actual, 'cold actual including return shape');
        assert.deepEqual(current.final, cold.final);
      }
      return { candidate: candidate.details, default: ordinary.details, coldCommit, coldExact: true };
    });
  }
  for (const context of contexts) await test(`nonfinish control ${context.name}: injury/concussion/wear preserved`, () => fixture(context, 'between', candidateModel, { eligible: false }).details);
  for (const context of contexts.filter(c => ['plate-chest', 'helmet-head'].includes(c.name))) await test(`player scope ${context.name}: excluded opponent remains cold legacy exact`, () => {
    const current = fixture(context, 'between', candidateModel, { opponentAttack: true, playerScope: true });
    const cold = fixture(context, 'between', undefined, { opponentAttack: true, cold: true });
    assert.deepEqual(current.prediction, cold.prediction); assert.deepEqual(current.actual, cold.actual); assert.deepEqual(current.final, cold.final);
    const player = fixture(context, 'between', candidateModel, { playerScope: true });
    assert.equal(player.actual.finish, false); assert.equal(player.final.state, 'down');
    return { opponent: current.details, player: player.details, excludedOpponentColdExact: true };
  });
  await test('ordinary bare-head lethal stab remains allowed', () => fixture(contexts.find(c => c.name === 'bare-head'), 'above', candidateModel, { eligible: false, ordinaryLethal: true }).details);
  await test('nonfinish armored head concussion can cause ordinary death', () => fixture(contexts.find(c => c.name === 'helmet-head'), 'between', candidateModel, { eligible: false, lowConsciousness: true }).details);
}
const after = hashes();
const sourceStable = JSON.stringify(before) === JSON.stringify(after);
const report = { pass: sourceStable && results.every(r => r.pass), candidateModel, helperOnly, sourceStable, sourceBefore: before, sourceAfter: after, tests: results,
  method: 'Pure helper plus cached-state real Combat/Fighter component tests; deliberate preparation and no physics steps. Default compared to own frozen prior Combat. Not natural combat or acceptance.' };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, helperOnly, tests: results.length, failed: results.filter(r => !r.pass).map(r => r.name), sourceStable, out }));
process.exitCode = report.pass ? 0 : 1;
