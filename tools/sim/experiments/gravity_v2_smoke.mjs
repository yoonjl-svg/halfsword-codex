/** Narrow delivery sanity, not gravity efficacy or natural-movement acceptance.
 * Old stance-B versus new gravity-base must be native-exact. Two larger gravity
 * worlds use the same fixed input, with all controller/global config unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound, DT, CONFIG, THREE} from '../harness_m.mjs';
import {configureGravityV2Trial} from '../../../src/gravity_v2_trial.js';
import {configureStanceV2Trial} from '../../../src/stance_v2_trial.js';
import {applySwordsmanship, recordSwordsmanshipInput} from '../../../src/swordsmanship.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
assert(args.length === 1 && args[0].startsWith('--out='), 'Use one --out=/absolute/fresh-directory argument');
const out = args[0].slice(6);
assert(path.isAbsolute(out) && !fs.existsSync(out), 'Output must be a fresh absolute directory');
const sha = x => createHash('sha256').update(x).digest('hex');
const V = v => ({x: v.x, y: v.y, z: v.z});
const norm = v => Math.hypot(v.x, v.y, v.z);
const configBefore = JSON.stringify(CONFIG);
assert.equal(CONFIG.PHYSICS.gravity, -9.81);
assert.equal(DT, 1 / 120);

const parserCases = [
  ['', false], ['weapon=zweihander', false], ['gravityV2=', false],
  ['gravityV2=unknown', false], ['gravityV2=base&gravityV2=base', false],
  ['gravityV2=base&weapon=', false], ['gravityV2=base&weapon=longsword', false],
  ['gravityV2=base&weapon=zweihander&weapon=zweihander', false],
  ['gravityV2=base&stanceV2=fresh', false], ['gravityV2=base&contactV2=legacy', false],
  ['gravityV2=base&limbTrial=1', false], ['gravityV2=base&unknown=1', false],
  ['gravityV2=base', true], ['gravityV2=plus15', true], ['gravityV2=plus25', true],
  ['gravityV2=base&weapon=zweihander', true],
].map(([query, active]) => {
  const info = configureGravityV2Trial(new URLSearchParams(query));
  assert.equal(info.active, active, query);
  assert.equal(info.requested, new URLSearchParams(query).has('gravityV2'), query);
  if (active) {
    assert.equal(info.weapon, 'zweihander'); assert.equal(info.foeWeapon, 'longsword');
    assert.equal(info.stanceModel, 'fresh');
    assert.deepEqual(info.settings, {skill: '0.7', difficulty: 'normal'});
    assert.equal(info.gravity, {base: -9.81, plus15: -11.2815, plus25: -12.2625}[info.level]);
  } else {
    assert.equal(info.gravity, null); assert.equal(info.level, null);
    assert.equal(info.weapon, null); assert.equal(info.foeWeapon, null);
    assert.equal(info.stanceModel, 'legacy'); assert.deepEqual(info.settings, {});
  }
  return {query, active, pass: true};
});
assert.equal(JSON.stringify(CONFIG), configBefore);
const scan = d => fs.readdirSync(path.join(root, d), {withFileTypes: true}).flatMap(e =>
  e.isDirectory() ? scan(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []);
const names = [...scan('src'), 'tools/sim/harness_m.mjs',
  'tools/sim/experiments/gravity_v2_smoke.mjs', 'package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest = () => Object.fromEntries(names.map(n => [n, sha(fs.readFileSync(path.join(root, n)))]));
const sourceBefore = manifest();
const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
fs.mkdirSync(out, {recursive: true});
for (const n of names) {
  const dest = path.join(out, 'frozen', n);
  fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(path.join(root, n), dest);
}
const rows = [], random = Math.random, started = performance.now(), startedUTC = new Date().toISOString();
let error = null;
function command(tick) {
  let x = 0, y = 0;
  if (tick >= 240 && tick < 420) y = 1;
  else if (tick >= 420 && tick < 540) x = 1;
  else if (tick >= 540 && tick < 660) x = -1;
  const active = tick >= 780 && tick < 810, held = tick >= 780 && tick < 846;
  return {x, y, dx: active ? .4 / 30 : 0, dy: active ? -.7 / 30 : 0, held, active};
}
async function run(level) {
  const old = level === 'old-stance-B';
  const info = old ? configureStanceV2Trial(new URLSearchParams('stanceV2=fresh&weapon=zweihander'))
    : configureGravityV2Trial(new URLSearchParams(`gravityV2=${level}`));
  assert(info.active);
  const gravity = old ? CONFIG.PHYSICS.gravity : info.gravity;
  const row = {level, gravity, frames: [], inputs: [], samples: [], complete: false};
  rows.push(row);
  let tick = 0;
  const G = newRound({seed: 7, weapon: info.weapon, weapon2: info.foeWeapon, walls: false,
    onFighter(f, world) {
      if (f.index !== 0) return;
      // The harness callback runs after creation, before either AI/first step.
      // Constructors do not read world.gravity. No CONFIG/global mutation.
      if (!old) world.gravity = {x: 0, y: gravity, z: 0};
      f.onehandArmModel = 'manual'; f.stanceMemoryModel = old ? info.model : info.stanceModel;
    }});
  try {
    assert(applySwordsmanship(G.player));
    G.combat.cutReactionModel = 'legacy'; G.combat.cutReactionFighter = null;
    G.park();
    assert.equal(G.player.stanceMemoryModel, 'fresh');
    assert.equal(G.player.skill.level, 0); assert.equal(G.player.skill.autoGuard, false);
    assert.notEqual(G.enemy.swordsmanshipModel, 'unified');
    assert.equal(G.enemy.stanceMemoryModel ?? 'legacy', 'legacy');
    assert.equal(G.world.gravity.y, gravity); assert.equal(G.world.timestep, Math.fround(DT));
    row.creationSHA256 = sha(G.world.takeSnapshot());
    G.before = () => {
      const c = command(tick), f = G.player;
      f.move.set(c.x, c.y); f.stickX = c.x; f.stickY = c.y;
      f.handOffset.x += c.dx; f.handOffset.y += c.dy;
      f.handHeld = c.held; f.inputActive = c.active;
      const input = {id: tick, timeS: G.t, dx: c.dx, dy: c.dy, held: c.held, active: c.active};
      assert(recordSwordsmanshipInput(f, input)); row.inputs.push({tick, ...c});
    };
    for (tick = 0; tick < 960; tick++) {
      if (tick % 120 === 0) await new Promise(resolve => setImmediate(resolve));
      G.step(); row.frames.push(sha(G.world.takeSnapshot()));
      assert.equal(G.world.gravity.y, gravity); assert.equal(G.world.timestep, Math.fround(DT));
      for (const f of [G.player, G.enemy]) for (const b of [...Object.values(f.bodies), f.sword]) {
        if (!b?.isValid()) continue;
        const p = b.translation(), v = b.linvel(), w = b.angvel(), q = b.rotation();
        assert([p.x, p.y, p.z, v.x, v.y, v.z, w.x, w.y, w.z, q.x, q.y, q.z, q.w].every(Number.isFinite), `${level}:${tick}`);
      }
      if (tick % 12 === 0 || tick === 959) {
        const f = G.player, tip = f.bladePoint(1, new THREE.Vector3());
        row.samples.push({tick, state: f.state, alive: f.alive, armed: f.armed,
          pelvis: V(f.bodies.pelvis.translation()), pelvisVelocity: V(f.bodies.pelvis.linvel()),
          tiltDeg: f.tiltDeg(), tipSpeedMps: norm(f.sword.velocityAtPoint(tip)),
          swordOmegaRadps: norm(f.sword.angvel()), phase: f.swordsmanshipState.phase});
      }
    }
    assert.equal(JSON.stringify(CONFIG), configBefore);
    row.complete = true;
    console.log(JSON.stringify({level, gravity, steps: row.frames.length, finite: true}));
  } finally {G.eventQueue.free(); G.world.free();}
}
try {
  for (const level of ['old-stance-B', 'base', 'plus15', 'plus25']) await run(level);
  assert.equal(rows[0].creationSHA256, rows[1].creationSHA256, 'Old B versus gravity-base creation');
  assert.deepEqual(rows[0].frames, rows[1].frames, 'Old B versus gravity-base all native steps');
  assert.deepEqual(rows[0].samples, rows[1].samples, 'Old B versus gravity-base observations');
  for (const row of rows.slice(1)) assert.deepEqual(row.inputs, rows[0].inputs, 'Same fixed requested input');
} catch (e) {error = {message: e.message, stack: e.stack}; process.exitCode = 1;}
finally {
  Math.random = random;
  const sourceAfter = manifest(), sourceStable = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  const configStable = JSON.stringify(CONFIG) === configBefore;
  const measurementValid = !error && sourceStable && configStable && rows.length === 4 && rows.every(r => r.complete);
  const result = {head, command: process.argv, startedUTC, completedUTC: new Date().toISOString(),
    wallSeconds: (performance.now() - started) / 1000, measurementValid, sourceStable, configStable,
    sourceBefore, sourceAfter, error, parserCases,
    protocol: {dt: DT, nativeStoredDt: Math.fround(DT), seed: 7, stepsPerRow: 960, weapon: 'zweihander', foeWeapon: 'longsword',
      scope: 'Actual game code, fixed 120Hz requests, parked opponent, no natural combat/user-sidefall/phone cadence claim.',
      gravityInstallation: 'World-only in onFighter before first step; main constructor path audited separately.',
      controller: 'Current player swordsmanship v2, fresh stance, legacy enemy/support/cutting. World gravity affects both fighters.',
      acceptance: 'Old stance B and gravity-base creation/all native steps exact; all fixed inputs equal; gravity/dt/config invariant and native body readings finite.',
      limits: 'Larger-gravity rows are finite-run delivery sanity, not efficacy, human naturalness, safe contact/recovery, or general adoption.'}, rows};
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result) + '\n');
  console.log(JSON.stringify({measurementValid, sourceStable, configStable, error,
    executions: rows.length, steps: rows.reduce((n, r) => n + r.frames.length, 0), wallSeconds: result.wallSeconds}));
  if (!measurementValid) process.exitCode = 1;
}
