// Narrow character assignment/native lifecycle check. Not a hit-rate or balance gate.
// node tools/sim/experiments/yue_assignment_20261014.mjs --out=/tmp/halfsword-yue-20261014/native-01
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url)), own = 'tools/sim/experiments/yue_assignment_20261014.mjs';
const out = process.argv.find(x => x.startsWith('--out='))?.slice(6);
assert(out?.startsWith('/tmp/halfsword-yue-20261014/native-') && !fs.existsSync(out), 'Fresh external output required');
const hash = b => createHash('sha256').update(b).digest('hex');
const files = [...fs.readdirSync(path.join(root, 'src')).filter(p => p.endsWith('.js')).map(p => `src/${p}`), own,
  'tools/sim/harness_m.mjs', 'tools/sim/experiments/terracotta_vitals_gate.mjs', 'package.json', 'package-lock.json'].sort();
const source = Object.fromEntries(files.map(p => [p, hash(fs.readFileSync(path.join(root, p)))])), frozen = path.join(out, 'source');
for (const p of files) { const target = path.join(frozen, p); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, p), target); }
fs.symlinkSync(path.join(root, 'node_modules'), path.join(frozen, 'node_modules'), 'dir');
const result = { startedUTC: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: ['node', own, `--out=${out}`], frozen, source, sourceManifestSHA256: hash(JSON.stringify(source)), checks: [], rows: [], physicsSteps: 0,
  scope: 'Actual CHARACTERS_BY_ID -> Fighter constructor (including physiology) -> AI.update plus player hand input -> native Rapier/Combat for two seconds per character.',
  limitations: ['No hit-rate requirement or human/browser input equivalence. Existing Goujian 23/24 AI observation is separate and unchanged.',
    'Terracotta body injury and qualifying neck cut are explicitly synthetic production applyWound fixtures, adapted from terracotta_vitals_gate; they verify rules, not natural injury odds.',
    'Ordinary swordsmanship v2 remains player-only; enemy keeps ordinary production AI. Assignment support is additionally checked from each weapon profile.'] };
const started = performance.now(), load = p => import(pathToFileURL(path.join(frozen, p)).href);
const check = (name, ok, detail) => result.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
try {
  const [{ RAPIER: R, THREE, DT, seedRandom, CONFIG }, { Fighter, GROUND_GROUPS }, { AI }, { Combat }, { CHARACTERS_BY_ID }, { LOOKS },
    { getWeapon, breakChance }, { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon }, { configureCombatDefaults },
    { applySwordsmanship, recordSwordsmanshipInput }, { swordsmanshipProfile }, { createArenaGround }, { disposeVisualTrees }] = await Promise.all([
    load('tools/sim/harness_m.mjs'), load('src/fighter.js'), load('src/ai.js'), load('src/combat.js'), load('src/characters.js'), load('src/looks.js'),
    load('src/weapons.js'), load('src/swordsmanship_default.js'), load('src/combat_defaults.js'), load('src/swordsmanship.js'),
    load('src/swordsmanship_profiles.js'), load('src/etna_ground.js'), load('src/visual_resources.js')]);
  const ordinary = configureSwordsmanshipDefault(new URLSearchParams()); result.dt = DT;
  const snapshot = f => ({ alive: f.alive, state: f.state, armed: f.armed, broken: f.weaponBroken, blood: f.blood, bleed: f.bleed,
    wounds: f.wounds.length, decapitated: !!f.decapitated, consciousness: f.consciousness, limbs: { ...f.limbs } });
  const wound = overrides => ({ part: 'chest', zone: 'chest', type: 'cut', severity: 1, energy: 40,
    local: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), bleedPerSev: .1,
    pass: true, passing: false, helmet: false, helmetBlunt: 1, plate: false, ...overrides });
  for (const [id, expectedWeapon] of [['terracotta', 'goujian'], ['chanda', 'moye']]) {
    const character = CHARACTERS_BY_ID[id], spec = getWeapon(expectedWeapon);
    assert(character, `Missing character ${id}`);
    check(`${id}/registry-weapon-school`, character.weapon === expectedWeapon && character.ai.persona.school === expectedWeapon);
    const profile = swordsmanshipProfile(spec);
    check(`${id}/ordinary-v2-supported`, ordinary.active && swordsmanshipDefaultSupportsWeapon(spec, ordinary) && profile.enabled && profile.weaponId === expectedWeapon);
    if (id === 'terracotta') {
      const lines = [character.taunt, ...Object.values(character.lines).flat(Infinity)];
      check('terracotta/ascii-quoted-dialogue', lines.length > 1 && lines.every(s => typeof s === 'string' && s.length > 2 && s.charCodeAt(0) === 34 && s.charCodeAt(s.length - 1) === 34), lines);
    }
    seedRandom(24);
    const world = new R.World({ x: 0, y: CONFIG.PHYSICS.gravity, z: 0 }); world.timestep = DT;
    world.integrationParameters.numSolverIterations = 6;
    const scene = new THREE.Scene(), info = new Map(), queue = new R.EventQueue(true);
    const environment = createArenaGround(R, world, GROUND_GROUPS, { walls: false });
    const player = new Fighter(R, world, scene, info, { index: 0, name: 'Input fixture', x: -CONFIG.ARENA.startGap / 2, heading: 0,
      terrain: environment.terrain, look: LOOKS.player, weapon: 'longsword', breakSeed: 24 });
    // Main.newRound passes these exact character bindings; harness_m does not pass physiology.
    const enemy = new Fighter(R, world, scene, info, { index: 1, name: character.name, x: CONFIG.ARENA.startGap / 2, heading: Math.PI,
      terrain: environment.terrain, look: character.look, weapon: character.weapon, physiology: character.physiology, revive: character.revive, breakSeed: 24 });
    enemy.terrainTraits = character.terrainTraits ?? null;
    for (const f of [player, enemy]) { f.armTorqueModel = 'legacy'; f.armSupportModel = 'linked'; f.finishEntryModel = 'low'; f.onehandArmModel = 'legacy'; }
    const adopted = configureCombatDefaults(ordinary, player.weapon);
    player.onehandArmModel = 'manual'; player.stanceMemoryModel = adopted.stance; player.rollTargetModel = adopted.roll;
    player.initializeOnehandReadyPose(); assert(applySwordsmanship(player)); player.skill.autoGuard = true; player.canShove = true;
    const ai = new AI(enemy, player, character.ai.level, character.ai.persona), combat = new Combat(info, {});
    combat.cutReactionModel = adopted.cut; combat.cutReactionFighter = player; combat.finishRuleModel = 'power'; combat.finishRuleFighter = null;
    const row = { id, weapon: enemy.weapon.id, school: ai.school.id, schoolWeapon: ai.school.weapon, physiology: enemy.physiology,
      tier: enemy.weapon.tier, fragility: enemy.weapon.fragility, breakChanceAt6Ns: breakChance(6, enemy.weapon.fragility, enemy.weapon.material),
      nativeMassKg: enemy.sword.mass(), nativeInertia: enemy.sword.principalInertia(), steps: 0, aiUpdates: 0, inputRequests: 0, finite: true, validJoints: true };
    const observe = () => {
      result.physicsSteps++; row.steps++;
      world.forEachRigidBody(b => { for (const v of [b.translation(), b.rotation(), b.linvel(), b.angvel()]) row.finite &&= Object.values(v).every(Number.isFinite); });
      for (const f of [player, enemy]) {
        row.finite &&= [f.blood, f.bleed, f.consciousness, ...Object.values(f.limbs)].every(Number.isFinite);
        row.validJoints &&= f.joints.every(j => j.joint?.isValid()) && (!f.armed || !!f.gripJoint?.isValid());
      }
    };
    try {
      check(`${id}/actual-constructor-and-ai`, enemy.weapon.id === expectedWeapon && ai.school.id === expectedWeapon && ai.school.weapon === expectedWeapon && !enemy.weaponCfg.twoHand && enemy.sword.mass() > 0 && Object.values(row.nativeInertia).every(x => Number.isFinite(x) && x > 0));
      const guards = new Set(ai.school.guards.map(g => g.name)), techniques = new Set(ai.school.tech.map(t => t.name)), persona = character.ai.persona;
      check(`${id}/persona-uses-existing-techniques`, Object.keys(persona.pers?.guardPref ?? {}).every(n => guards.has(n)) && Object.keys(persona.pers?.techPref ?? {}).every(n => techniques.has(n)) && (!persona.idle?.guard || guards.has(persona.idle.guard)));
      check(`${id}/break-policy`, id === 'terracotta' ? row.tier === 'rare' && row.fragility === .032 && row.breakChanceAt6Ns === .032 : row.tier === 'legend' && row.fragility === 0 && row.breakChanceAt6Ns === 0);
      const initialEnemyPosition = { ...enemy.bodies.pelvis.translation() };
      for (let tick = 0; tick < Math.round(2 / DT); tick++) {
        player.foe = enemy; enemy.foe = player; player.faceTarget = enemy.bodies.pelvis.translation(); enemy.faceTarget = player.bodies.pelvis.translation();
        ai.update(DT); row.aiUpdates++;
        const dx = tick >= 60 && tick < 90 ? .012 : 0, dy = tick >= 60 && tick < 90 ? -.016 : 0;
        player.handOffset.x += dx; player.handOffset.y += dy; player.handHeld = tick < 100; player.inputActive = !!(dx || dy);
        assert(recordSwordsmanshipInput(player, { id: tick, timeS: tick * DT, dx, dy, held: player.handHeld, active: player.inputActive })); row.inputRequests++;
        player.step(DT); enemy.step(DT); player.cacheState(); enemy.cacheState(); world.step(queue, combat.physicsHooks); combat.afterStep(world, queue); observe();
      }
      row.final = snapshot(enemy); row.aiMode = ai.mode; row.initialEnemyPosition = initialEnemyPosition; row.finalEnemyPosition = { ...enemy.bodies.pelvis.translation() };
      check(`${id}/two-second-input-ai-native`, row.aiUpdates === 240 && row.inputRequests === 240 && row.finite && row.validJoints && player.alive && enemy.alive && enemy.armed && !enemy.weaponBroken, row.final);
      if (id === 'terracotta') {
        check('terracotta/constructor-capabilities', enemy.physiology.bleeds === false && enemy.physiology.deathRequiresHeadDetachment === true && enemy.blood === 1 && enemy.bleed === 0);
        enemy.applyWound(wound({ severity: 3 })); enemy.applyWound(wound({ part: 'farmS', zone: 'arm', severity: 1 }));
        enemy.updateVitals(DT);
        check('terracotta/body-injury-bloodless-attached', enemy.alive && !enemy.decapitated && enemy.jointByName.head.joint?.isValid() && enemy.blood === 1 && enemy.bleed === 0 && enemy.wounds.every(w => w.bleed === 0) && enemy.limbs.armS < 1);
        const handle = enemy.jointByName.head.joint.handle;
        enemy.applyWound(wound({ part: 'head', zone: 'neck', severity: .5 }));
        check('terracotta/neck-threshold-equality-survives', enemy.alive && enemy.jointByName.head.joint?.isValid() && !enemy.decapitated);
        enemy.applyWound(wound({ part: 'head', zone: 'neck', severity: .501, passing: true }));
        for (let tick = 0; tick < 24; tick++) { player.step(DT); enemy.step(DT); player.cacheState(); enemy.cacheState(); world.step(queue, combat.physicsHooks); combat.afterStep(world, queue); observe(); }
        row.syntheticVitalFinal = snapshot(enemy);
        check('terracotta/qualifying-neck-cut-native-death', !enemy.alive && enemy.state === 'dead' && enemy.decapitated && enemy.jointByName.head.joint === null && !world.getImpulseJoint(handle)
          && !enemy.joints.some(j => j.name === 'head') && enemy.blood === 1 && enemy.bleed === 0 && enemy.wounds.every(w => w.bleed === 0) && row.finite && row.validJoints, row.syntheticVitalFinal);
      } else check('chanda/human-capabilities-preserved', enemy.physiology.bleeds === true && enemy.physiology.deathRequiresHeadDetachment === false);
      result.rows.push(row);
    } finally { for (const f of [player, enemy]) { f.clearLoose(); disposeVisualTrees(f.meshes.map(m => m.group)); } queue.free(); world.free(); }
  }
} catch (error) { result.exception = { message: error.message, stack: error.stack }; }
result.frozenUnchanged = files.every(p => hash(fs.readFileSync(path.join(frozen, p))) === source[p]);
result.liveChangedFiles = files.filter(p => hash(fs.readFileSync(path.join(root, p))) !== source[p]);
check('frozen-source-stable', result.frozenUnchanged);
result.failed = result.checks.filter(r => !r.ok).map(r => r.name); result.pass = !result.exception && !result.failed.length;
result.completedUTC = new Date().toISOString(); result.wallSeconds = (performance.now() - started) / 1000;
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ out, pass: result.pass, checks: result.checks.length, failed: result.failed, exception: result.exception?.message,
  rows: result.rows.length, physicsSteps: result.physicsSteps, wallSeconds: result.wallSeconds, sourceManifestSHA256: result.sourceManifestSHA256, liveChangedFiles: result.liveChangedFiles }));
process.exitCode = result.pass ? 0 : 1;
