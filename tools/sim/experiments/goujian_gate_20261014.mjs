// Narrow native delivery gate, not a weapon league or human-playability test.
// node tools/sim/experiments/goujian_gate_20261014.mjs --out=/tmp/halfsword-goujian-20261014/native-01
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const own = 'tools/sim/experiments/goujian_gate_20261014.mjs';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
assert(out?.startsWith('/tmp/halfsword-goujian-20261014/native') && !fs.existsSync(out), 'Fresh native output directory required');
const started = performance.now(), hash = x => createHash('sha256').update(x).digest('hex');
const scan = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? scan(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []);
const files = [...scan('src'), own, 'tools/sim/harness_m.mjs', 'package.json', 'package-lock.json'].sort();
const source = Object.fromEntries(files.map(p => [p, hash(fs.readFileSync(path.join(root, p)))]));
const frozen = path.join(out, 'source');
for (const name of files) {
  const target = path.join(frozen, name); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, name), target);
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(frozen, 'node_modules'), 'dir');
const baseline = 'c640139';
fs.writeFileSync(path.join(frozen, 'src/weapons_baseline.js'), execFileSync('git', ['show', `${baseline}:src/weapons.js`], { cwd: root }));
const engineFiles = ['node_modules/@dimforge/rapier3d-compat/rapier.mjs', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const engineHashes = () => Object.fromEntries(engineFiles.map(p => [p, hash(fs.readFileSync(path.join(root, p)))]));
const result = { startedUTC: new Date().toISOString(), baseline,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: ['node', own, `--out=${out}`], frozen, source, sourceManifestSHA256: hash(JSON.stringify(source)),
  engineBefore: engineHashes(), checks: [], rows: [], physicsSteps: 0,
  limitations: [
    'Actual Fighter/Rapier/Combat source, with ordinary player v2 settings; no browser rendering or touch event equivalence is claimed.',
    'Authored hand deltas and Skill.thrust exercise production input consumers; the two 10-second duels use AI in both slots and ordinary 5.6m spawns.',
    'No body pose, velocity, damage, healing or collision injection is used. The break case explicitly invokes production breakWeapon; it does not measure break probability.',
    'Two deterministic duel observations establish neither win rates nor historical handling, human naturalness, contact success chance or performance on a device.',
    'Resource dispose events verify ownership, not GPU deallocation. Native maxima are observations, not new controller limits.'
  ] };
fs.writeFileSync(path.join(out, 'protocol.json'), JSON.stringify(result, null, 2) + '\n');
const check = (name, ok, details) => result.checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const load = p => import(pathToFileURL(path.join(frozen, p)).href);

try {
  const [{ newRound, AI, DT, THREE, CONFIG }, { getWeapon }, { getWeapon: getBaseline }, { weaponPhysics },
    { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon }, { configureCombatDefaults },
    { applySwordsmanship, recordSwordsmanshipInput }, { disposeVisualTrees }, { DEBRIS, tickDebris, clearDebris, debrisCount }, { schoolOf }] = await Promise.all([
    load('tools/sim/harness_m.mjs'), load('src/weapons.js'), load('src/weapons_baseline.js'), load('src/weapon_class.js'),
    load('src/swordsmanship_default.js'), load('src/combat_defaults.js'), load('src/swordsmanship.js'),
    load('src/visual_resources.js'), load('src/debris.js'), load('src/schools.js')
  ]);
  result.dt = DT;
  const ordinary = configureSwordsmanshipDefault(new URLSearchParams());
  class Passive { update() {} }
  function create({ player = 'goujian', enemy = 'qinggang', seed = 17, duel = false, ...extra } = {}) {
    const G = newRound({ seed, weapon: player, weapon2: enemy, ...(duel ? { AI2Class: AI, persona: { school: enemy }, persona2: { school: player } } : { gap: 12, AIClass: Passive, walls: false }), ...extra,
      onFighter: f => {
        f.armTorqueModel = 'legacy'; f.armSupportModel = 'linked'; f.finishEntryModel = 'low'; f.onehandArmModel = 'legacy';
        if (f.index === 0) { const d = configureCombatDefaults(ordinary, f.weapon); f.onehandArmModel = 'manual'; f.stanceMemoryModel = d.stance; f.rollTargetModel = d.roll; }
      } });
    assert(applySwordsmanship(G.player)); G.player.skill.autoGuard = true; G.player.canShove = true;
    G.combat.cutReactionModel = configureCombatDefaults(ordinary, G.player.weapon).cut;
    G.combat.cutReactionFighter = G.player; G.combat.finishRuleModel = 'power'; G.combat.finishRuleFighter = null;
    return G;
  }
  function cleanup(G) {
    clearDebris();
    for (const f of [G.player, G.enemy]) { f.clearLoose(); disposeVisualTrees(f.meshes.map(m => m.group)); }
    G.eventQueue.free(); G.world.free();
  }
  function geometry(group, ignoreBreakFace = false) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), box = new THREE.Box3(), point = new THREE.Vector3();
    let vertices = 0, triangles = 0, finite = true, maxOutsideM = 0;
    const parts = getWeapon('goujian').buildParts({});
    group.traverse(o => {
      if (!o.isMesh || (ignoreBreakFace && o.name === 'breakFace')) return;
      for (let p = o; p; p = p.parent) { if (!p.visible) return; if (p === group) break; }
      for (const attribute of Object.values(o.geometry.attributes)) finite &&= Array.from(attribute.array).every(Number.isFinite);
      const a = o.geometry.attributes.position, matrix = new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld);
      triangles += (o.geometry.index?.count ?? a.count) / 3;
      for (let i = 0; i < a.count; i++) {
        point.fromBufferAttribute(a, i).applyMatrix4(matrix); vertices++; box.expandByPoint(point);
        let nearest = Infinity;
        for (const [shape, y] of parts) {
          if (shape[0] !== 'box') continue;
          nearest = Math.min(nearest, Math.hypot(Math.max(0, Math.abs(point.x) - shape[1]),
            Math.max(0, Math.abs(point.y - y) - shape[2]), Math.max(0, Math.abs(point.z) - shape[3])));
        }
        maxOutsideM = Math.max(maxOutsideM, nearest);
      }
    });
    return { vertices, triangles, finite, min: box.min.toArray(), max: box.max.toArray(), length: box.max.y - box.min.y, maxOutsideM };
  }
  const resources = group => { const set = new Set(); group.traverse(o => {
    if (o.geometry) set.add(o.geometry); for (const material of [].concat(o.material ?? [])) set.add(material);
  }); return set; };
  const policy = f => ({ weapon: f.weapon.id, twoHand: f.weaponCfg.twoHand, frame: f.weapon.frame, swordsmanship: f.swordsmanshipModel,
    arm: f.onehandArmModel, stance: f.stanceMemoryModel, roll: f.rollTargetModel, support: f.armSupportModel, finishEntry: f.finishEntryModel });
  const health = f => ({ alive: f.alive, state: f.state, armed: f.armed, broken: f.weaponBroken, blood: f.blood,
    consciousness: f.consciousness, pain: f.pain, wounds: f.wounds.length, limbs: { ...f.limbs } });
  const point = (body, p) => new THREE.Vector3().copy(p).applyQuaternion(new THREE.Quaternion().copy(body.rotation())).add(new THREE.Vector3().copy(body.translation()));
  const jointGap = j => point(j.body1(), j.anchor1()).distanceTo(point(j.body2(), j.anchor2()));
  function observe(G, row) {
    row.steps++; result.physicsSteps++;
    G.world.forEachRigidBody(b => { for (const v of [b.translation(), b.rotation(), b.linvel(), b.angvel()]) row.nonfinite ||= !Object.values(v).every(Number.isFinite); });
    for (const f of [G.player, G.enemy]) {
      row.nonfinite ||= ![f.blood, f.consciousness, f.pain, ...Object.values(f.limbs)].every(Number.isFinite);
      for (const j of f.joints) { row.invalidJoints ||= !j.joint?.isValid(); if (j.joint?.isValid()) row.maxJointGapM = Math.max(row.maxJointGapM, jointGap(j.joint)); }
      row.unexplainedDisarm ||= f.armed && !f.gripJoint?.isValid();
      if (f.armed && f.gripJoint?.isValid()) row.maxGripGapM = Math.max(row.maxGripGapM, jointGap(f.gripJoint));
    }
    const f = G.player, velocity = f.sword.velocityAtPoint(f.bladePoint(1, new THREE.Vector3()));
    row.maxTipSpeedMps = Math.max(row.maxTipSpeedMps, Math.hypot(velocity.x, velocity.y, velocity.z));
    row.maxOmegaRadps = Math.max(row.maxOmegaRadps, ...[G.player, G.enemy].map(f => { const w = f.sword.angvel(); return Math.hypot(w.x, w.y, w.z); }));
    row.swingTicks += Number(f.skill.swinging); row.thrustTicks += Number(f.skill.thrustPose.w > 0);
  }
  const startRow = (scenario, G) => ({ scenario, steps: 0, nonfinite: false, invalidJoints: false, unexplainedDisarm: false,
    maxJointGapM: 0, maxGripGapM: 0, maxTipSpeedMps: 0, maxOmegaRadps: 0, swingTicks: 0, thrustTicks: 0,
    policy: [policy(G.player), policy(G.enemy)] });
  const closeRow = (G, row) => {
    row.elapsedS = G.t; row.final = [health(G.player), health(G.enemy)]; row.clashes = G.clashes;
    row.wounds = G.wounds.map(w => ({ t: w.t, attacker: w.att.index, victim: w.vic.index, zone: w.zone, type: w.type, energy: w.energy, severity: w.severity }));
    check(`${row.scenario}/finite-connected`, !row.nonfinite && !row.invalidJoints && !row.unexplainedDisarm);
    result.rows.push(row); console.log(JSON.stringify({ scenario: row.scenario, steps: row.steps, wounds: row.wounds.length, clashes: row.clashes, finite: !row.nonfinite }));
  };

  const spec = getWeapon('goujian'), parts = spec.buildParts({}), physics = weaponPhysics(spec);
  const lo = Math.min(...parts.map(([s, y]) => y - s[2])), hi = Math.max(...parts.map(([s, y]) => y + s[2]));
  result.spec = { id: spec.id, tier: spec.tier, grip: spec.grip, fullLengthM: hi - lo, colliderBoundsY: [lo, hi], bladeLengthM: spec.bladeLength, physics, parts };
  check('approved-spec', spec.id === 'goujian' && spec.tier === 'rare' && spec.grip === 'one-hand' && !spec.twoHand && near(hi - lo, .8) && near(spec.bladeLength, .62) && near(physics.mass, 1.15));
  check('part-mass-inertia', parts.every(p => p[2].every(Number.isFinite) && p[2][0] > 0 && p[2][2] > 0 && p[2][3] > 0) && physics.I > 0);
  check('ordinary-v2-support', ordinary.active && swordsmanshipDefaultSupportsWeapon(spec, ordinary) && schoolOf('goujian').weapon === 'goujian' && CONFIG.COMBAT.limbSeverTrial);
  for (const id of ['qinggang', 'sain']) {
    const comparable = w => ({ ...Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v !== 'function')), parts: w.buildParts({}) });
    check(`${id}/baseline-spec-unchanged`, JSON.stringify(comparable(getWeapon(id))) === JSON.stringify(comparable(getBaseline(id))));
  }
  let oldResources, oldPhysics;
  for (let cycle = 0; cycle < 2; cycle++) {
    const G = create(), f = G.player, visual = geometry(f.swordGroup), tracked = resources(f.swordGroup), counts = new Map();
    try {
      for (const r of tracked) { counts.set(r, 0); r.addEventListener('dispose', () => counts.set(r, counts.get(r) + 1)); }
      const native = { mass: f.sword.mass(), com: f.sword.localCom(), inertia: f.sword.principalInertia(), handInertia: f.swordIhand };
      check(`constructor${cycle}/native-mass-inertia`, near(native.mass, 1.15) && near(native.handInertia, physics.I) && Object.values(native.inertia).every(x => Number.isFinite(x) && x > 0));
      check(`constructor${cycle}/finite-visible-bound`, visual.finite && visual.vertices > 0 && near(visual.length, .8, .001) && visual.length >= .69 && visual.maxOutsideM <= .01, visual);
      if (cycle) check('constructor-recreation-fresh', [...tracked].every(r => !oldResources.has(r)) && JSON.stringify(native) === JSON.stringify(oldPhysics));
      oldResources = tracked; oldPhysics = native; result.visual = visual; result.native = native;
    } finally { cleanup(G); }
    check(`constructor${cycle}/disposal-once`, [...counts.values()].every(n => n === 1), { resources: tracked.size, calls: [...counts.values()].reduce((a, b) => a + b, 0) });
  }
  {
    const G = create(), f = G.player, row = startRow('authored-cut-recut-thrust', G), inputHash = createHash('sha256');
    row.inputPath = 'handOffset + handHeld + inputActive + recordSwordsmanshipInput; Skill.thrust(); Fighter.step -> Rapier -> Combat';
    row.tapAccepted = false; row.inputConsumed = true;
    const tape = [['settle', 180, 0, 0, false], ['raise', 60, -.24, .35, true], ['cut', 30, .48, -.68, true],
      ['release', 90, 0, 0, false], ['recut', 36, -.46, .62, true], ['release2', 90, 0, 0, false], ['tap', 180, 0, 0, true]];
    let tick = 0;
    try {
      for (const [phase, count, dx, dy, held] of tape) for (let i = 0; i < count; i++) {
        const request = { id: tick++, timeS: G.t, dx: dx / count, dy: dy / count, held, active: Math.abs(dx) + Math.abs(dy) > 1e-5 };
        f.handOffset.x += request.dx; f.handOffset.y += request.dy; f.handHeld = held; f.inputActive = request.active;
        assert(recordSwordsmanshipInput(f, request)); inputHash.update(JSON.stringify(request) + '\n');
        if (phase === 'tap' && i === 0) row.tapAccepted = f.skill.thrust();
        G.step(); observe(G, row); row.inputConsumed &&= JSON.stringify(f.swordsmanshipState.input) === JSON.stringify(request);
      }
      row.inputSHA256 = inputHash.digest('hex');
      check('authored/consumed-cut-thrust', row.inputConsumed && row.tapAccepted && row.swingTicks > 0 && row.thrustTicks > 0 && row.maxTipSpeedMps > 1, { swingTicks: row.swingTicks, thrustTicks: row.thrustTicks, tapAccepted: row.tapAccepted });
      check('authored/survived-armed', f.alive && f.armed && !f.weaponBroken); closeRow(G, row);
    } finally { cleanup(G); }
  }
  for (const configuration of [{ player: 'goujian', enemy: 'qinggang', seed: 307 }, { player: 'sain', enemy: 'goujian', seed: 911 }]) {
    const G = create({ ...configuration, duel: true }), row = startRow(`duel-${configuration.player}-${configuration.enemy}-${configuration.seed}`, G);
    row.configuration = { ...configuration, gap: CONFIG.ARENA.startGap, seconds: 10 }; row.attacks = []; row.contactCalls = [0, 0]; row.appliedWounds = [0, 0];
    row.inputPath = 'Both production AI.update -> handOffset/move/Skill.thrust -> Fighter.step -> Rapier collision -> Combat.strike/applyWound';
    for (const [index, ai] of [G.ai2, G.ai].entries()) {
      const start = ai.startStrike; ai.startStrike = function (...args) { const accepted = start.apply(this, args); if (accepted === true) row.attacks.push({ t: G.t, actor: index, kind: this.tech?.kind, technique: this.tech?.name }); return accepted; };
      const f = [G.player, G.enemy][index], apply = f.applyWound;
      f.applyWound = function (...args) { const before = this.wounds.length, value = apply.apply(this, args); row.appliedWounds[index] += this.wounds.length - before; return value; };
    }
    const strike = G.combat.strike; G.combat.strike = function (pair, ...args) { row.contactCalls[pair.w.fighter.index]++; return strike.call(this, pair, ...args); };
    try {
      for (let tick = 0; tick < Math.round(10 / DT); tick++) { G.step(); observe(G, row); if (!G.player.alive || !G.enemy.alive) break; }
      row.stopReason = !G.player.alive || !G.enemy.alive ? 'natural-death' : 'ten-second-limit';
      check(`${row.scenario}/both-ai-issued-attacks`, [0, 1].every(i => row.attacks.some(a => a.actor === i)), row.attacks);
      closeRow(G, row);
    } finally { cleanup(G); }
  }
  const duels = result.rows.filter(r => r.scenario.startsWith('duel-'));
  result.duelContacts = duels.map(r => ({ scenario: r.scenario, calls: r.contactCalls, accepted: r.wounds.length, addedWounds: r.appliedWounds }));
  check('duels/goujian-actual-contact-and-wound', duels.some(r => { const index = r.configuration.player === 'goujian' ? 0 : 1; return r.contactCalls[index] > 0 && r.wounds.some(w => w.attacker === index) && r.appliedWounds[1 - index] > 0; }), result.duelContacts);
  {
    const G = create(), f = G.player, row = startRow('production-break-followup', G);
    DEBRIS.headless = true;
    try {
      for (let i = 0; i < 60; i++) { G.step(); observe(G, row); }
      row.before = { length: f.weaponCfg.bladeLength, mass: f.sword.mass(), inertia: f.swordIhand };
      f.breakWeapon(); row.debrisAtBreak = debrisCount();
      const cut = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, visual = geometry(f.swordGroup, true);
      const colliderTop = Math.max(...f.swordColliders.filter(c => c.isEnabled()).map(c => c.translationWrtParent().y + c.halfExtents().y));
      check('break/native-visual-trim', f.weaponBroken && near(f.weaponCfg.bladeLength, .31) && f.sword.mass() < row.before.mass && f.swordIhand < row.before.inertia
        && visual.finite && visual.max[1] <= cut + 1e-4 && near(colliderTop, cut, .001) && row.debrisAtBreak > 0, { cut, colliderTop, visual });
      for (let i = 0; i < Math.round(4 / DT); i++) { G.step(); tickDebris(DT); observe(G, row); }
      row.debrisAfter = debrisCount(); row.after = { length: f.weaponCfg.bladeLength, mass: f.sword.mass(), inertia: f.swordIhand };
      check('break/debris-expired-and-finite', row.debrisAfter === 0 && !row.nonfinite); closeRow(G, row);
    } finally { cleanup(G); DEBRIS.headless = false; }
  }
} catch (error) { result.exception = { message: error.message, stack: error.stack }; }
result.frozenUnchanged = files.every(p => source[p] === hash(fs.readFileSync(path.join(frozen, p))));
result.liveChangedFiles = files.filter(p => source[p] !== hash(fs.readFileSync(path.join(root, p))));
result.engineUnchanged = JSON.stringify(result.engineBefore) === JSON.stringify(engineHashes());
check('frozen-source-and-engine-stable', result.frozenUnchanged && result.engineUnchanged);
result.failed = result.checks.filter(c => !c.ok).map(c => c.name);
result.pass = !result.exception && result.failed.length === 0;
result.wallSeconds = (performance.now() - started) / 1000; result.completedUTC = new Date().toISOString();
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ out, pass: result.pass, checks: result.checks.length, failed: result.failed, exception: result.exception?.message, rows: result.rows.length,
  physicsSteps: result.physicsSteps, wallSeconds: result.wallSeconds, sourceManifestSHA256: result.sourceManifestSHA256, liveChangedFiles: result.liveChangedFiles }));
process.exitCode = result.pass ? 0 : 1;
