// Eight bounded actual-contact runs. Controlled down/tap fixture borrowed from
// phase3_finish_contact_20261007; no search grid, natural-injury or balance claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const [root, out] = process.argv.slice(2);
assert(root && out && path.isAbsolute(root) && path.isAbsolute(out) && !fs.existsSync(out));
const sha = x => createHash('sha256').update(x).digest('hex');
const own = 'tools/sim/experiments/offhand_contact_20261008.mjs';
const names = fs.readdirSync(path.join(root, 'src')).filter(n => n.endsWith('.js')).sort().map(n => `src/${n}`)
  .concat(own, 'tools/sim/harness_m.mjs', 'tools/sim/experiments/phase3_finish_contact_20261007.mjs', 'package.json', 'package-lock.json');
const manifest = base => Object.fromEntries(names.map(n => [n, sha(fs.readFileSync(path.join(base, n)))]));
const sourceBefore = manifest(root), frozen = path.join(out, 'source');
const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const write = (name, x) => fs.writeFileSync(path.join(out, name), JSON.stringify(x, null, 2) + '\n', {flag: 'wx'});
for (const name of names) {
  const dest = path.join(frozen, name); fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(path.join(root, name), dest);
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(frozen, 'node_modules'), 'dir');
assert.deepEqual(manifest(root), sourceBefore); assert.deepEqual(manifest(frozen), sourceBefore);
const load = file => import(pathToFileURL(path.join(frozen, file)).href);
const {newRound, THREE, DT, CONFIG} = await load('tools/sim/harness_m.mjs');
const {applySwordsmanship, recordSwordsmanshipInput} = await load('src/swordsmanship.js');
const {configureCombatDefaults} = await load('src/combat_defaults.js');
const {sampleArmSupport, strikeArmSupportScale, strikeArmAssist} = await load('src/arm_support.js');
assert(CONFIG.COMBAT.limbSeverTrial); assert.equal(CONFIG.PHYSICS.gravity, -9.81);
const protocol = {seed: 7, gapM: 2.4, runs: 8, maxSteps: 1320,
  modes: ['legacy', 'linked'], weapons: ['longsword', 'zweihander'], conditions: ['healthy', 'severe'],
  preparation: 'At creation idle enemy knockDown(true), downTime=1e9; chest and head each receive 40 Ns toward player over first .25s. No body-position, velocity or wound assignment. Severe player armO set directly to .2 at tick300.',
  input: 'Settle300; approach at <=.4 stick to torso distance .65±.06m (timeout780), wait90 then one native skill.thrust. Each linked run replays its same-condition legacy tape.',
  configuration: 'Ordinary player unified v2/manual/fresh stance/bounded roll/centerline cut; finish power both fighters; limb ON/gravity9.81; idle foe.',
  shadows: 'Pure cached geometry sample and Object.create(attacker) facades. Analyze legacy/linked using exactly the same point and cached S/P; no actual attacker/model/cache mutation.',
};
write('protocol.json', {...protocol, sourceBefore, head, argv: process.argv});
const small = r => r ? Object.fromEntries(['type', 'zone', 'energy', 'ephys', 'mFree', 'mEff', 'eff', 'thr',
  'severity', 'pass', 'finish', 'finishingStrike', 'finishPower', 'plate', 'helmet', 'speed', 't', 'stuck']
  .map(k => [k, r[k]]).concat([['assistProxyKg', r.mEff - r.mFree]])) : null;
const health = f => ({alive: f.alive, armed: f.armed, state: f.state, blood: f.blood, consciousness: f.consciousness,
  pain: f.pain, balance: f.balance, limbs: {...f.limbs}, wounds: f.wounds.length, bleed: f.bleed,
  cloth: {...f.cloth}, plate: {...f.plate}, helmetIntegrity: f.helmetIntegrity, cause: f.causeOfDeath ?? null});
const control = f => ({health: health(f), hand: f.handOffset.toArray(), move: f.move.toArray(), held: f.handHeld,
  active: f.inputActive, tap: f.skill.tap ? {down: f.skill.tap.down, go: f.skill.tap.go, t: f.skill.tap.t} : null,
  push: f.skill.thrustPush, finish: f.finish.on});
const different = (a, b) => JSON.stringify(small(a)) !== JSON.stringify(small(b));
const torsoDist = (p, e) => Math.min(...['chest', 'abdomen', 'pelvis'].map(k => {
  const a = p.bodies.chest.translation(), b = e.bodies[k].translation(); return Math.hypot(a.x - b.x, a.z - b.z);
}));
const norm = v => Math.hypot(v.x, v.y, v.z);
const finite = G => G.world.bodies.getAll().every(b => [b.translation(), b.rotation(), b.linvel(), b.angvel()]
  .every(v => Object.values(v).every(Number.isFinite)));
class Idle { update() {} }
const rows = [], start = performance.now(), startedUTC = new Date().toISOString();
for (const weapon of protocol.weapons) for (const condition of protocol.conditions) {
  let tape = null;
  for (const mode of protocol.modes) {
    const row = {weapon, condition, mode, steps: 0, finite: true, taps: [], analyses: [], contacts: [], wounds: [],
      frames: [], inputs: [], firstPredictedPassDifference: null, firstActualPassDifference: null,
      firstStrikeDifference: null, forceMaxN: 0, forceAtLegacyCapSteps: 0, forceAtInjuryCapSteps: 0};
    rows.push(row); let tick = 0, G;
    try {
      G = newRound({seed: protocol.seed, weapon, weapon2: 'longsword', gap: protocol.gapM,
        walls: false, AIClass: Idle, onFighter: f => {
          if (f.index !== 0) return;
          f.onehandArmModel = 'manual'; f.armSupportModel = mode;
          const p = configureCombatDefaults({active: true}, f.weapon);
          f.stanceMemoryModel = p.stance; f.rollTargetModel = p.roll;
        }});
      const f = G.player, e = G.enemy, C = G.combat;
      assert(applySwordsmanship(f)); f.canShove = true;
      C.cutReactionModel = 'centerline'; C.cutReactionFighter = f;
      C.finishRuleModel = 'power'; C.finishRuleFighter = null;
      e.knockDown(true); e.downTime = 1e9;
      row.spawnSHA256 = sha(G.world.takeSnapshot());
      const capture = label => {
        const bytes = Buffer.from(G.world.takeSnapshot()), name = `${weapon}-${condition}-${mode}-${label}.rapier.bin`;
        fs.writeFileSync(path.join(out, name), bytes, {flag: 'wx'});
        return {tick, file: name, sha256: sha(bytes), player: control(f), enemy: control(e)};
      };
      row.spawn = capture('spawn');
      const analyze = C.analyze;
      const shadow = (pr, point, S, P, predicting) => {
        const attacker = pr.w.fighter, support = sampleArmSupport(attacker, attacker.cache);
        const results = {};
        for (const shadowMode of protocol.modes) {
          const facade = Object.create(attacker);
          facade.armSupportModel = shadowMode;
          facade.cache = {...attacker.cache, armSupport: support};
          const shadowPair = {...pr, w: {...pr.w, fighter: facade}};
          results[shadowMode] = analyze.call(C, shadowPair, point.clone(), S, P, predicting);
        }
        return {support, ...results};
      };
      C.analyze = function(pr, point, S, P, predicting = false) {
        const pointCopy = point.clone();
        const result = analyze.call(this, pr, point, S, P, predicting);
        if (pr.w.fighter === f && pr.v.fighter === e) {
          const matched = shadow(pr, pointCopy, S, P, predicting);
          if (result || matched.legacy || matched.linked) {
            const passDifference = !!matched.legacy?.pass !== !!matched.linked?.pass;
            if (passDifference) {
              if (predicting) row.firstPredictedPassDifference ??= tick;
              else row.firstActualPassDifference ??= tick;
            }
            row.analyses.push({tick, predicting, part: pr.v.part, point: pointCopy.toArray(),
              support: matched.support, passDifference, changed: different(matched.legacy, matched.linked),
              actual: small(result), legacy: small(matched.legacy), linked: small(matched.linked)});
          }
        }
        return result;
      };
      const strike = C.strike;
      C.strike = function(pr, point, passing) {
        if (pr.w.fighter !== f || pr.v.fighter !== e) return strike.call(this, pr, point, passing);
        const S = f.cache.sword, P = e.cache.parts[pr.v.part], pointCopy = point.clone();
        const matched = shadow(pr, pointCopy, S, P, false), before = health(e);
        const cool = e.hitCooldowns.has(`${f.index}:${pr.v.part}`), attacker = control(f);
        const result = strike.call(this, pr, point, passing);
        if (result) {
          const changed = different(matched.legacy, matched.linked);
          if (changed) row.firstStrikeDifference ??= tick;
          row.contacts.push({tick, part: pr.v.part, passing, cool, point: pointCopy.toArray(), attacker,
            support: matched.support, before, after: health(e), changed,
            legacy: small(matched.legacy), linked: small(matched.linked), actual: small(result)});
        }
        return result;
      };
      const wound = e.applyWound;
      e.applyWound = function(result) {
        const before = health(this), ret = wound.call(this, result);
        row.wounds.push({tick, result: small(result), part: result.part, before, after: health(this)});
        return ret;
      };
      let insideOff = false, stepOffForceN = 0;
      const off = f.offHand, force = f.sword.addForceAtPoint;
      f.offHand = function(...args) { insideOff = true; try {return off.apply(this, args);} finally {insideOff = false;} };
      f.sword.addForceAtPoint = function(F, ...args) {
        if (insideOff) stepOffForceN += norm(F); return force.call(this, F, ...args);
      };
      let approachDone = null;
      G.before = () => {
        stepOffForceN = 0;
        if (tick === 300) {
          row.preCondition = capture('pre-condition');
          if (condition === 'severe') f.limbs.armO = .2;
          row.postCondition = capture('post-condition');
          assert.equal(row.preCondition.sha256, row.postCondition.sha256);
        }
        const d = torsoDist(f, e);
        let req = tape?.[tick];
        if (!tape) {
          if (tick >= 300 && approachDone === null && Math.abs(d - .65) < .06) approachDone = tick;
          if (tick >= 780 && approachDone === null) approachDone = tick;
          const ready = approachDone !== null && tick >= approachDone + 90;
          req = {dx: 0, dy: 0, held: true, stickY: tick < 300 || approachDone !== null ? 0 : Math.max(-.4, Math.min(.4, (d - .65) * 2)),
            tap: ready && row.taps.length === 0 && !f.skill.tap, phase: ready ? 'controlled-tap' : tick < 300 ? 'settle' : 'approach'};
        }
        assert(req); row.inputs.push(req);
        if (tick < 30) for (const k of ['chest', 'head']) e.bodies[k].applyImpulse({x: -40 * DT * 4, y: 0, z: 0}, true);
        const allowed = f.alive && f.armed;
        f.handHeld = req.held; f.inputActive = false;
        assert(recordSwordsmanshipInput(f, {id: tick, timeS: G.t, dx: 0, dy: 0, held: req.held, active: false}));
        f.move.set(0, f.alive ? req.stickY : 0); f.stickX = 0; f.stickY = f.alive ? req.stickY : 0;
        if (req.tap) {
          const accepted = allowed && f.skill.thrust();
          row.taps.push({tick, accepted, down: !!f.skill.tap?.down, finishOn: f.finish.on, distance: d});
        }
      };
      for (tick = 0; tick < protocol.maxSteps; tick++) {
        G.step(); row.steps++; row.finite &&= finite(G);
        row.forceMaxN = Math.max(row.forceMaxN, stepOffForceN);
        row.forceAtLegacyCapSteps += stepOffForceN >= CONFIG.GRIP.maxForce - 1e-6;
        const cap = CONFIG.GRIP.maxForce * (.5 + .5 * f.limbs.armO);
        row.forceAtInjuryCapSteps += stepOffForceN >= cap - 1e-6;
        row.frames.push({tick, physics: sha(G.world.takeSnapshot()), controller: sha(JSON.stringify([control(f), control(e)])),
          input: sha(JSON.stringify(row.inputs[tick])), offForceN: stepOffForceN,
          supportScale: strikeArmSupportScale(f), swingAssistKg: strikeArmAssist(f), thrustAssistKg: strikeArmAssist(f, 'thrust'),
          player: {alive: f.alive, armed: f.armed, state: f.state}, enemy: {alive: e.alive, state: e.state}});
      }
      row.final = {player: health(f), enemy: health(e)};
      if (!tape) tape = row.inputs;
    } catch (error) {row.error = {message: error.message, stack: error.stack};}
    finally {
      G?.eventQueue.free(); G?.world.free();
      const filename = `${weapon}-${condition}-${mode}.json`;
      write(filename, row);
      row.artifact = {path: path.join(out, filename), sha256: sha(fs.readFileSync(path.join(out, filename)))};
      console.log(JSON.stringify({weapon, condition, mode, steps: row.steps, finite: row.finite,
        taps: row.taps, contacts: row.contacts.length, wounds: row.wounds.length,
        predictionPassChange: row.firstPredictedPassDifference, strikeChange: row.firstStrikeDifference, error: row.error}));
    }
  }
}
const comparisons = [];
for (let i = 0; i < rows.length; i += 2) {
  const a = rows[i], b = rows[i + 1], n = Math.min(a.frames.length, b.frames.length);
  const first = field => a.frames.slice(0, n).findIndex((r, j) => r[field] !== b.frames[j][field]);
  const events = [a.firstPredictedPassDifference, b.firstPredictedPassDifference,
    a.firstActualPassDifference, b.firstActualPassDifference, a.firstStrikeDifference, b.firstStrikeDifference].filter(x => x !== null);
  const boundary = events.length ? Math.min(...events) : n;
  comparisons.push({weapon: a.weapon, condition: a.condition, sameSpawn: a.spawnSHA256 === b.spawnSHA256,
    comparisonBoundary: boundary, firstNativeDifference: first('physics'), firstControllerDifference: first('controller'),
    firstInputDifference: first('input'), prefixExact: a.frames.slice(0, boundary).every((r, j) =>
      r.physics === b.frames[j].physics && r.controller === b.frames[j].controller)});
}
const sourceStable = JSON.stringify(manifest(frozen)) === JSON.stringify(sourceBefore);
const report = {head, startedUTC, finishedUTC: new Date().toISOString(), wallSeconds: (performance.now() - start) / 1000,
  protocol, sourceBefore, sourceStable, steps: rows.reduce((s, r) => s + r.steps, 0), comparisons,
  valid: sourceStable && rows.every(r => !r.error && r.finite) && comparisons.every(c => c.sameSpawn && c.prefixExact && c.firstInputDifference === -1),
  rows: rows.map(({frames, inputs, analyses, contacts, ...r}) => ({...r,
    inputSHA256: sha(JSON.stringify(inputs)), analyses: analyses.length, changedAnalyses: analyses.filter(a => a.changed).length,
    contacts: contacts.length, changedContacts: contacts.filter(c => c.changed).length,
    firstChangedContact: contacts.find(c => c.changed) ?? null})),
  limitations: ['Controlled knockdown/impulses/idle opponent and direct arm-function preparation; no natural fight success rate.',
    'Same-state shadow algebra is valid within each event. Actual runs after their first legitimate divergence are distinct trajectories.',
    'Virtual arm assistance is added to mFree for a gameplay energy proxy; it does not alter Rapier mass or inertia.']};
write('report.json', report);
if (!report.valid) process.exitCode = 1;
