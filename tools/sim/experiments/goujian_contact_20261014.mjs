// Fixed native contact diagnostic after the unchanged 10-second AI gate missed a Goujian wound.
// node tools/sim/experiments/goujian_contact_20261014.mjs --out=/tmp/halfsword-goujian-20261014/native-contact-85-01
// Uses the existing artoria_rare_gate controlled contact geometry, with no search or tuning.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const own = 'tools/sim/experiments/goujian_contact_20261014.mjs';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
assert(out?.startsWith('/tmp/halfsword-goujian-20261014/native') && !fs.existsSync(out), 'Fresh external output required');
const hash = b => createHash('sha256').update(b).digest('hex'), baseline = '4e19099';
const files = [...fs.readdirSync(path.join(root, 'src')).filter(p => p.endsWith('.js')).map(p => `src/${p}`), own,
  'tools/sim/harness_m.mjs', 'package.json', 'package-lock.json'].sort();
const source = Object.fromEntries(files.map(p => [p, hash(fs.readFileSync(path.join(root, p)))])), frozen = path.join(out, 'source');
for (const p of files) { const target = path.join(frozen, p); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, p), target); }
fs.symlinkSync(path.join(root, 'node_modules'), path.join(frozen, 'node_modules'), 'dir');
fs.writeFileSync(path.join(frozen, 'src/weapons_baseline.js'), execFileSync('git', ['show', `${baseline}:src/weapons.js`], { cwd: root }));
const started = performance.now(), load = p => import(pathToFileURL(path.join(frozen, p)).href);
const result = { startedUTC: new Date().toISOString(), baseline, source, sourceManifestSHA256: hash(JSON.stringify(source)),
  command: ['node', own, `--out=${out}`], frozen,
  fixture: { source: 'tools/sim/experiments/artoria_rare_gate.mjs controlled-native-contact', seed: 17, initialGapM: 2.4,
    bladeFraction: .35, target: 'actual opponent farmO center after one ordinary step', swordRotationZRad: Math.PI / 2,
    edgeOffsetM: -.22, wholeAttackerLinearSpeedMps: 12, wholeAttackerAngularSpeedRadps: 0, nativeContactSteps: 24 },
  path: 'Fighter constructor -> one ordinary step -> declared whole-attacker placement/velocity -> cacheState -> Rapier World.step(Combat.physicsHooks) -> Combat.afterStep/manifolds -> Combat.strike -> actual Fighter.applyWound',
  scope: 'Only weapon specifications differ: 80cm baseline vs 85cm current, both using current frozen Fighter/Combat/engine. No wound, damage, death or contact-result injection.',
  priorGate: { path: '/tmp/halfsword-goujian-20261014/native-85-01/summary.json', passed: 23, total: 24,
    unresolved: 'Two fixed ten-second AI duels observed no new wound inflicted by Goujian. This diagnostic does not turn that gate into a pass.' },
  limitations: ['Authored placement and initial velocity are a controlled collision fixture, not human or AI input.',
    'The 24 collision steps retain native constraints and contact hooks but do not advance Fighter controllers after placement.',
    'This checks damage wiring in one reproducible geometry, not wound probability, handling quality, balance or browser play.'],
  checks: [], rows: [] };
const check = (name, ok, detail) => result.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
const health = f => ({ alive: f.alive, wounds: f.wounds.length, blood: f.blood, consciousness: f.consciousness, pain: f.pain, limbs: { ...f.limbs } });
const brief = r => r ? Object.fromEntries(['zone', 'part', 'type', 'energy', 'severity', 'speed', 'quality', 'passing'].filter(k => r[k] !== undefined).map(k => [k, r[k]])) : null;
try {
  const [{ newRound, DT, THREE }, { WEAPONS }, { getWeapon: oldWeapon }, { applySwordsmanship },
    { configureSwordsmanshipDefault }, { configureCombatDefaults }, { disposeVisualTrees }] = await Promise.all([
    load('tools/sim/harness_m.mjs'), load('src/weapons.js'), load('src/weapons_baseline.js'), load('src/swordsmanship.js'),
    load('src/swordsmanship_default.js'), load('src/combat_defaults.js'), load('src/visual_resources.js')]);
  class Passive { update() {} }
  const current = WEAPONS.goujian, ordinary = configureSwordsmanshipDefault(new URLSearchParams());
  for (const [label, spec] of [['baseline-80cm', oldWeapon('goujian')], ['current-85cm', current]]) {
    let G;
    // Constructor-only spec selection; restoration happens before any simulation.
    WEAPONS.goujian = spec;
    try {
      G = newRound({ seed: 17, weapon: 'goujian', weapon2: 'qinggang', gap: 2.4, sameLook: true, walls: false, AIClass: Passive,
        onFighter: f => {
          f.armTorqueModel = 'legacy'; f.armSupportModel = 'linked'; f.finishEntryModel = 'low'; f.onehandArmModel = 'legacy';
          if (!f.index) { const d = configureCombatDefaults(ordinary, f.weapon); f.onehandArmModel = 'manual'; f.stanceMemoryModel = d.stance; f.rollTargetModel = d.roll; }
        } });
    } finally { WEAPONS.goujian = current; }
    const a = G.player, v = G.enemy;
    assert(applySwordsmanship(a)); a.skill.autoGuard = true;
    G.combat.cutReactionModel = configureCombatDefaults(ordinary, a.weapon).cut; G.combat.cutReactionFighter = a;
    G.combat.finishRuleModel = 'power'; G.combat.finishRuleFighter = null;
    const row = { label, bladeLengthM: a.weaponCfg.bladeLength, nativeMassKg: a.sword.mass(), nativeComM: a.sword.localCom().y,
      nativeHandInertiaKgM2: a.swordIhand, contactCalls: [], manifolds: [], accepted: [], applied: [], nonfinite: false, steps: 0 };
    let activeAttacker = null;
    const strike = G.combat.strike;
    G.combat.strike = function (pair, point, passing) {
      const previous = activeAttacker; activeAttacker = pair.w.fighter.index;
      try { const r = strike.call(this, pair, point, passing); row.contactCalls.push({ tick: row.steps, attacker: activeAttacker, victim: pair.v.fighter.index, part: pair.v.part, passing: !!passing, result: brief(r) }); return r; }
      finally { activeAttacker = previous; }
    };
    const applyWound = v.applyWound;
    v.applyWound = function (...args) { const before = health(this), r = applyWound.apply(this, args), after = health(this);
      row.applied.push({ tick: row.steps, attacker: activeAttacker, result: brief(args[0]), before, after, addedWounds: after.wounds - before.wounds }); return r; };
    G.onWound = (attacker, victim, r) => row.accepted.push({ tick: row.steps, attacker: attacker.index, victim: victim.index, result: brief(r) });
    const contactPair = G.world.contactPair, victimBodies = new Set(Object.values(v.bodies).map(b => b.handle));
    G.world.contactPair = function (c1, c2, callback) {
      return contactPair.call(this, c1, c2, (manifold, flipped) => {
        const b1 = c1.parent()?.handle, b2 = c2.parent()?.handle;
        if ((b1 === a.sword.handle && victimBodies.has(b2)) || (b2 === a.sword.handle && victimBodies.has(b1))) {
          const distances = Array.from({ length: manifold.numContacts() }, (_, i) => manifold.contactDist(i));
          row.manifolds.push({ tick: row.steps, contacts: distances.length, distances, flipped });
        }
        return callback(manifold, flipped);
      });
    };
    try {
      G.step();
      const target = new THREE.Vector3().copy(v.bodies.farmO.translation()), desired = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      const rotation = desired.clone().multiply(new THREE.Quaternion().copy(a.sword.rotation()).invert()), origin = new THREE.Vector3().copy(a.sword.translation());
      const attackerBodies = [...a.meshes.map(m => m.rb), a.anchor];
      for (const b of attackerBodies) {
        b.setTranslation(new THREE.Vector3().copy(b.translation()).sub(origin).applyQuaternion(rotation).add(origin), true);
        b.setRotation(rotation.clone().multiply(new THREE.Quaternion().copy(b.rotation())), true);
      }
      const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(desired), shift = target.clone().sub(a.bladePoint(.35)).addScaledVector(edge, -.22);
      for (const b of attackerBodies) {
        b.setTranslation(new THREE.Vector3().copy(b.translation()).add(shift), true);
        if (b !== a.anchor) { b.setLinvel(edge.clone().multiplyScalar(12), true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
      }
      row.prescribed = { target: target.toArray(), swordQuaternion: desired.toArray(), edge: edge.toArray(), linearVelocity: edge.clone().multiplyScalar(12).toArray(), bladePoint: a.bladePoint(.35).toArray() };
      row.initialVictim = health(v);
      for (let tick = 0; tick < 24; tick++) {
        row.steps++; a.cacheState(); v.cacheState(); G.world.step(G.eventQueue, G.combat.physicsHooks); G.combat.afterStep(G.world, G.eventQueue); G.t += DT;
        G.world.forEachRigidBody(b => { for (const values of [b.translation(), b.rotation(), b.linvel(), b.angvel()]) row.nonfinite ||= !Object.values(values).every(Number.isFinite); });
      }
      row.finalVictim = health(v);
      row.attackerContacts = row.contactCalls.filter(r => r.attacker === 0).length;
      row.attackerAccepted = row.accepted.filter(r => r.attacker === 0);
      row.addedWounds = row.applied.filter(r => r.attacker === 0).reduce((n, r) => n + r.addedWounds, 0);
      check(`${label}/finite`, !row.nonfinite);
      check(`${label}/native-manifold-and-contact`, row.manifolds.some(r => r.contacts > 0) && row.attackerContacts > 0);
      check(`${label}/actual-cut-and-wound`, row.attackerAccepted.some(r => r.result.type === 'cut' && r.result.severity > 0) && row.addedWounds > 0);
      result.rows.push(row);
      console.log(JSON.stringify({ label, nativeMassKg: row.nativeMassKg, contactCalls: row.attackerContacts, manifoldObservations: row.manifolds.length, accepted: row.attackerAccepted, addedWounds: row.addedWounds }));
    } finally { for (const f of [a, v]) { f.clearLoose(); disposeVisualTrees(f.meshes.map(m => m.group)); } G.eventQueue.free(); G.world.free(); }
  }
  check('same-prescribed-velocity-orientation', ['swordQuaternion', 'edge', 'linearVelocity'].every(key => JSON.stringify(result.rows[0].prescribed[key]) === JSON.stringify(result.rows[1].prescribed[key])));
} catch (error) { result.exception = { message: error.message, stack: error.stack }; }
result.frozenUnchanged = files.every(p => hash(fs.readFileSync(path.join(frozen, p))) === source[p]);
result.liveChangedFiles = files.filter(p => hash(fs.readFileSync(path.join(root, p))) !== source[p]);
check('frozen-source-stable', result.frozenUnchanged);
result.failed = result.checks.filter(r => !r.ok).map(r => r.name); result.pass = !result.exception && result.failed.length === 0;
result.wallSeconds = (performance.now() - started) / 1000; result.completedUTC = new Date().toISOString();
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ out, pass: result.pass, checks: result.checks.length, failed: result.failed, exception: result.exception?.message, wallSeconds: result.wallSeconds, sourceManifestSHA256: result.sourceManifestSHA256, liveChangedFiles: result.liveChangedFiles }));
process.exitCode = result.pass ? 0 : 1;
