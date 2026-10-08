/** Numeric design probe, NOT a gameplay patch or native combat test.
 * Loads actual Combat with two asserted in-memory substitutions: remove the
 * instant-death flag and boost eligible effective stab energy before armor.
 * Uses actual strike/applyWound/updateVitals; no physics world steps are run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, THREE, V, Q, DT } from '../harness_m.mjs';
import { LOOKS } from '../../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';

const out = process.argv[2];
assert(out && path.isAbsolute(out) && !fs.existsSync(out), 'Fresh absolute output required');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const source = fs.readFileSync('src/combat.js', 'utf8');
let candidate = source;
function replaceOnce(before, after) {
  assert.equal(candidate.split(before).length, 2, 'Source moved: review substitution');
  candidate = candidate.replace(before, after);
}
replaceOnce('    let finishRuleResult = null;',
  '    const bonusEligible = finish; finish = false;\n    let finishRuleResult = null;');
replaceOnce('      eff = energy * quality * wMult * emoDealt * emoTaken;',
  `      eff = energy * quality * wMult * emoDealt * emoTaken;
      if (bonusEligible) eff += Math.min(eff * (this.probeFactor - 1), 80);`);
candidate = candidate.replace(/from (['"])([^'"]+)\1/g, (_, q, spec) => {
  const url = spec.startsWith('.') ? new URL(spec, new URL('../../../src/combat.js', import.meta.url)).href : import.meta.resolve(spec);
  return `from ${q}${url}${q}`;
});
const { Combat: ProbeCombat } = await import('data:text/javascript;base64,' + Buffer.from(candidate).toString('base64'));
const contexts = [
  { name: 'cloth-chest', part: 'chest', look: LOOKS.enemy, eff: 36.283 },
  { name: 'plate-chest', part: 'chest', look: CHARACTERS_BY_ID.heinrich.look, eff: 36.283 },
  { name: 'bare-head', part: 'head', look: LOOKS.enemy, eff: 36.283 },
  { name: 'helmet-head', part: 'head', look: LOOKS.player, eff: 36.283 },
  { name: 'strong-helmet', part: 'head', look: LOOKS.player, eff: 80 },
  { name: 'weak-plate', part: 'chest', look: CHARACTERS_BY_ID.heinrich.look, eff: 10 },
  { name: 'injured-plate', part: 'chest', look: CHARACTERS_BY_ID.heinrich.look, eff: 36.283, blood: .7 },
  { name: 'ordinary-plate', part: 'chest', look: CHARACTERS_BY_ID.heinrich.look, eff: 36.283, eligible: false },
];
const rows = [];
for (const context of contexts) for (const factor of [1, 1.5, 2, 2.5, 3]) {
  const G = newRound({ seed: 173, weapon: 'longsword', weapon2: 'longsword', look2: context.look, walls: false });
  try {
    const att = G.player, vic = G.enemy;
    G.combat = new ProbeCombat(G.combat.info, {});
    const C = G.combat;
    C.finishRuleModel = 'armorGuard'; C.probeFactor = 1;
    att.foe = vic; vic.foe = att; att.state = 'stand'; vic.state = 'down';
    att.skill.tap = { down: context.eligible !== false, go: true }; att.skill.thrustPush = true;
    att.emoMods = { dealt: 1, pass: 0 }; vic.emoMods = { taken: 1, pass: 0 };
    att.weaponCfg = { ...att.weaponCfg, power: 1 };
    vic.blood = context.blood ?? 1;
    const entries = [...C.info.values()];
    const wi = entries.find(i => i.fighter === att && i.part === 'blade');
    const vi = entries.find(i => i.fighter === vic && i.part === context.part);
    const state = body => ({ p: V(body.translation()), q: Q(body.rotation()), com: V(body.worldCom()), v: new THREE.Vector3(), w: new THREE.Vector3() });
    const P = state(vi.body), sw = state(wi.body);
    const local = context.part === 'head' ? [.02, .08, .05] : [.11, 0, .05];
    const normal = context.part === 'head' ? [.3, 1, .4] : [1, 0, 0];
    const point = new THREE.Vector3(...local).applyQuaternion(P.q).add(P.p);
    const n = new THREE.Vector3(...normal).applyQuaternion(P.q).normalize();
    const y = n.clone().negate(), up = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const x = new THREE.Vector3().crossVectors(n, up).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
    const S = { p: point.clone().addScaledVector(y, -(att.weaponCfg.hiltLength + att.weaponCfg.bladeLength)), q, v: y.clone().multiplyScalar(5), w: new THREE.Vector3() };
    S.com = S.p.clone().add(comL.applyQuaternion(q));
    const pr = { w: wi, v: vi };
    const initial = C.analyze(pr, point, S, P, true);
    S.v.multiplyScalar(Math.sqrt(context.eff / initial.eff));
    const base = C.analyze(pr, point, S, P, true);
    assert(Math.abs(base.eff - context.eff) < 1e-9);
    C.probeFactor = factor;
    const predicted = C.analyze(pr, point, S, P, true);
    const actual = C.analyze(pr, point, S, P, false);
    assert.equal(predicted.finish, false); assert.equal(actual.finish, false);
    assert.equal(predicted.eff, actual.eff); assert.equal(predicted.pass, actual.pass);
    assert.equal(predicted.severity, actual.severity);
    att.cache = { sword: S }; vic.cache = { parts: { [context.part]: P } };
    const result = C.strike(pr, point, false);
    const initialBleed = vic.bleed;
    let deathS = vic.state === 'dead' ? 0 : null;
    for (let step = 1; step <= 3600; step++) {
      vic.updateVitals(DT);
      if (deathS === null && vic.state === 'dead') deathS = step * DT;
    }
    rows.push({ context: context.name, factor, baseEff: base.eff, eff: actual.eff, threshold: actual.thr,
      bonus: actual.eff - base.eff, type: actual.type, returnedHit: !!result, severity: actual.severity, pass: actual.pass,
      initialBleed, startingBlood: context.blood ?? 1, blood30s: vic.blood, deathS, cause: vic.causeOfDeath ?? null,
      physicalEnergy: actual.ephys, reportedEnergy: actual.energy });
  } finally { G.eventQueue.free(); G.world.free(); }
}
const ordinary = rows.filter(r => r.context === 'ordinary-plate');
assert(ordinary.every(r => r.eff === ordinary[0].eff && r.blood30s === ordinary[0].blood30s));
assert(rows.filter(r => r.context === 'weak-plate').every(r => r.type === 'blunt' && r.deathS === null));
assert(rows.filter(r => r.context === 'helmet-head').every(r => r.type === 'blunt' && r.deathS === null));
const report = { baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: '40 cached component fixtures, 0 native physics steps; explicit down/tap/energy/blood setup. Normal wound/vitals code; 30s isolated vitals, no movement or later hits. Not a finished candidate or balance validation.',
  candidate: 'Eligible effective stab energy += min(baseEff*(factor-1),80); finish always false. No direct energy/mass multiplier. Penetration changes can bypass blocked-thrust fallback and thereby alter returned energy, pain, wear and resistance. Production design must review these effects and revival.',
  inputs: { seed: 173, factors: [1,1.5,2,2.5,3], bonusCap: 80, contexts: contexts.map(({look,...c}) => c), step: DT },
  sources: Object.fromEntries(['src/combat.js','src/fighter.js','src/config.js','src/finish_rule.js','src/revive.js','src/weapons.js','tools/sim/experiments/finish_bonus_probe_20261008.mjs'].map(p => [p, sha(fs.readFileSync(p))])),
  transformedCombatSHA256: sha(candidate), rows };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({out, fixtures: rows.length, sourceUnchanged: sha(source) === sha(fs.readFileSync('src/combat.js')), rows: rows.filter(r => ['plate-chest','helmet-head','strong-helmet','injured-plate'].includes(r.context)).map(r=>({context:r.context,factor:r.factor,eff:r.eff,threshold:r.threshold,blood30s:r.blood30s,deathS:r.deathS}))}, null, 2));
