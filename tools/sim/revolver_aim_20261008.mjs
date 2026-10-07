// Controlled component verification, not natural combat/accuracy or human-pose acceptance.
// Uses real Fighter/Rapier bodies, production targeting, native steps and actual bulletHit.
// node tools/sim/revolver_aim_20261008.mjs /absolute/fresh/report.json
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { newRound, THREE, DT } from './harness_m.mjs';
import { GUN, GUN_HOOKS, gunAimTarget, gunPose, gunSway, gunCanFire, bulletHit } from '../../src/gun.js';
import { LOOKS } from '../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const BASE = 'a34eff6b5b84ef1611f73db639135da64ae6eb09';
const reportPath = resolve(process.argv[2] ?? '/tmp/revolver-aim-20261008.json');
assert(!existsSync(reportPath), 'Use a fresh evidence path; previous results are preserved');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const sources = ['src/gun.js', 'src/fighter.js', 'src/combat.js', 'src/sound.js', 'tools/sim/harness_m.mjs'];
const hashes = () => Object.fromEntries(sources.map((p) => [p, hash(readFileSync(resolve(root, p)))]));
const report = { baselineCommit: BASE, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: `node tools/sim/revolver_aim_20261008.mjs ${reportPath}`, sourceBefore: hashes(),
  scope: 'Deliberately prepared native bodies for geometry/damage; passive-opponent short native runtime. No audio/rendering, natural combat accuracy, TTK, or human pose acceptance.',
  geometry: [], pose: [], damage: [], runtime: null, checks: 0, pass: false };
const originalRandom = Math.random, originalEnergy = GUN.energy, originalHooks = { ...GUN_HOOKS };
class Passive { update() {} }
const v = (p) => new THREE.Vector3(p.x, p.y, p.z);
const q = (p) => new THREE.Quaternion(p.x, p.y, p.z, p.w);
const check = (condition, label) => { report.checks++; assert(condition, label); };
const near = (a, b, label, eps = 2e-6) => check(Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
const close = (a, b, label, eps = 2e-6) => check(a.distanceTo(b) <= eps, `${label}: distance ${a.distanceTo(b)}`);
const fresh = (extra = {}) => newRound({ seed: 19, walls: false, weapon: 'pistol', weapon2: 'longsword', AIClass: Passive, ...extra });
const free = (G) => { G.eventQueue.free(); G.world.free(); };
const snapshot = (f) => JSON.stringify(Object.entries(f.bodies).map(([name, b]) => [name, b.translation(), b.rotation()]));
const line = (f) => ['pelvis', 'abdomen', 'chest', ...(!f.decapitated && f.bodies.head ? ['head'] : [])].map((k) => v(f.bodies[k].translation()));
function project(p, points) {
  let distance = Infinity, along = 0, length = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].clone().sub(points[i - 1]), len = d.length();
    const t = len ? THREE.MathUtils.clamp(p.clone().sub(points[i - 1]).dot(d) / (len * len), 0, 1) : 0;
    const candidate = points[i - 1].clone().addScaledVector(d, t), error = p.distanceTo(candidate);
    if (error < distance) { distance = error; along = length + t * len; }
    length += len;
  }
  return { distance, along, length };
}
function transform(f, rotation, shift) {
  for (const b of Object.values(f.bodies)) {
    b.setTranslation(v(b.translation()).applyQuaternion(rotation).add(shift), true);
    b.setRotation(rotation.clone().multiply(q(b.rotation())), true);
  }
}
function functionText(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0);
  let depth = 0, first = source.indexOf('{', start);
  for (let i = first; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed ${name}`);
}
try {
  check(originalEnergy === 75, 'Production default must be 75 J');
  // The source check protects timing/RNG, scheduler and previous sound work against this patch.
  const cold = execFileSync('git', ['show', `${BASE}:src/gun.js`], { cwd: root, encoding: 'utf8' });
  const current = readFileSync(resolve(root, 'src/gun.js'), 'utf8');
  for (const name of ['gunSway', 'updateAimSpan', 'updateRandSway', 'updateGun', 'bulletHit', 'armorStop', 'sound', 'gunshotSound', 'clicks', 'loadRoundSound', 'gateOpenSound', 'reloadSound']) {
    check(functionText(cold, name) === functionText(current, name), `${name} cold/current unchanged`);
  }
  check(readFileSync(resolve(root, 'src/sound.js'), 'utf8') === execFileSync('git', ['show', `${BASE}:src/sound.js`], { cwd: root, encoding: 'utf8' }), 'Previous shot gain source unchanged');
  const yB = 18.7, pB = 13.34;
  for (const name of ['upright', 'kneel-folded', 'prone', 'headOff', 'collapsed-line']) {
    const G = fresh(), f = G.enemy;
    try {
      // Preparation changes native body transforms only for this component. No physics is stepped here.
      if (name === 'kneel-folded') {
        f.state = 'kneel';
        const base = v(f.bodies.pelvis.translation()).add(new THREE.Vector3(0, -.35, 0));
        for (const [part, offset] of [['pelvis', [0, 0, 0]], ['abdomen', [.08, .14, 0]], ['chest', [.16, .26, 0]], ['head', [.21, .48, 0]]]) {
          f.bodies[part].setTranslation(base.clone().add(new THREE.Vector3(...offset)), true);
        }
      }
      if (name === 'prone') transform(f, new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, .4, Math.PI / 2)), new THREE.Vector3(1, .3, -.7));
      if (name === 'headOff') { f.decapitated = true; f.bodies.head.setTranslation({ x: 100, y: -20, z: 35 }, true); }
      if (name === 'collapsed-line') for (const part of ['abdomen', 'chest', 'head']) f.bodies[part].setTranslation(f.bodies.pelvis.translation(), true);
      const before = snapshot(f), points = line(f), side = new THREE.Vector3(0, 0, 1).applyQuaternion(q(f.bodies.chest.rotation()));
      let samples = 0, maxLateral = 0, maxProjectionError = 0;
      const oldRandom = Math.random; Math.random = () => { throw new Error('Target helper consumed shared RNG'); };
      try {
        for (const h of [-1, 0, .25, .5, 1, 2]) for (const yaw of [-1000, -yB, 0, yB, 1000]) for (const pitch of [-1000, -pB, 0, pB, 1000]) {
          const center = gunAimTarget(f, h, { yaw: 0, pitch }), target = gunAimTarget(f, h, { yaw, pitch }), delta = target.clone().sub(center);
          const projected = project(center, points);
          check([target.x, target.y, target.z].every(Number.isFinite), `${name} finite target`);
          check(projected.distance < 2e-6, `${name} center stays on anatomy polyline`);
          near(delta.dot(side), GUN.aimSide * THREE.MathUtils.clamp(yaw / yB, -1, 1), `${name} lateral normalization`);
          check(delta.clone().cross(side).length() < 2e-6, `${name} body-local lateral axis`);
          check(delta.length() <= GUN.aimSide + 2e-6, `${name} lateral maximum`);
          maxLateral = Math.max(maxLateral, delta.length()); maxProjectionError = Math.max(maxProjectionError, projected.distance); samples++;
        }
      } finally { Math.random = oldRandom; }
      close(gunAimTarget(f, 0, { yaw: 0, pitch: -1000 }), points[0], `${name} lower clamp at pelvis`);
      const high = project(gunAimTarget(f, 1, { yaw: 0, pitch: 1000 }), points);
      near(high.along, Math.max(0, high.length - GUN.aimLow), `${name} aimLow follows body arc`);
      check(snapshot(f) === before, `${name} helper does not move any native body`);
      if (name === 'headOff') {
        const old = gunAimTarget(f, 1, { yaw: yB, pitch: pB });
        f.bodies.head.setTranslation({ x: -100, y: 200, z: 55 }, true);
        close(old, gunAimTarget(f, 1, { yaw: yB, pitch: pB }), 'Detached head never changes target');
      }
      // Rigid covariance independently catches world-height corrections on prone targets.
      const old = gunAimTarget(f, .63, { yaw: 10, pitch: -7 });
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.6, -.8, .4)), shift = new THREE.Vector3(2, -.8, 3);
      transform(f, rotation, shift);
      close(gunAimTarget(f, .63, { yaw: 10, pitch: -7 }), old.applyQuaternion(rotation).add(shift), `${name} rigid covariance`, 4e-6);
      report.geometry.push({ name, samples, maxLateral, maxProjectionError });
    } finally { free(G); }
  }
  {
    const G = fresh(), f = G.player;
    try {
      f.foe = G.enemy; gunCanFire(f); f.gun.pending = -1;
      for (const h of [0, .5, 1]) {
        Object.assign(f.gun, { h, t: 1.2, rs: { yaw: 5, pitch: -5 }, since: Infinity, cool: 0, reloading: false });
        const before = snapshot(f) + JSON.stringify([f.sword.translation(), f.sword.rotation()]);
        const sw = gunSway(f.gun.t, f.index * 2.1), target = gunAimTarget(G.enemy, h, { yaw: sw.yaw + 5, pitch: sw.pitch - 5 });
        const shoulder = v(f.bodies.chest.translation()).add(new THREE.Vector3(...GUN.shoulder).applyQuaternion(f.yaw));
        const expected = target.clone().sub(shoulder).normalize(), pose = { hand: [0, 0, 0], dir: [0, 0, 0] };
        check(gunPose(f, pose) === 1, 'Production gunPose active');
        close(new THREE.Vector3(...pose.dir).applyQuaternion(f.yaw), expected, 'gunPose follows bounded target without extra angular sway');
        check(before === snapshot(f) + JSON.stringify([f.sword.translation(), f.sword.rotation()]), 'gunPose does not teleport body or physical weapon');
        report.pose.push({ h, target: target.toArray(), direction: pose.dir });
      }
    } finally { free(G); }
  }
  {
    const G = fresh(), shots = [];
    try {
      GUN_HOOKS.onShot = (f, pos, dir, dist) => {
        const rot = q(f.sword.rotation()), axis = new THREE.Vector3(0, 1, 0).applyQuaternion(rot);
        const muzzle = new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(rot).add(v(f.sword.translation()));
        close(pos, muzzle, 'Actual shot originates at native physical muzzle');
        const run = Math.min(1, Math.hypot(f.bodies.pelvis.linvel().x, f.bodies.pelvis.linvel().z) / 2.3);
        const angle = axis.angleTo(dir) * 180 / Math.PI, bound = GUN.spread + GUN.spreadMove * run;
        check(f.gun.aim === 0 && angle <= bound + 2e-4, 'Player shot remains physical barrel plus native spread');
        shots.push({ t: G.t, angle, bound, dist, seed: f.gun.seed, position: pos.toArray(), direction: dir.toArray() });
      };
      let taps = 0;
      for (let i = 0; i < Math.ceil(3 / DT); i++) {
        if (taps < 3 && G.t >= .5 + taps * .85) { check(gunCanFire(G.player, { now: true }), 'Controlled player tap accepted'); taps++; }
        G.step();
        for (const f of [G.player, G.enemy]) for (const b of Object.values(f.bodies)) check(Object.values(b.translation()).every(Number.isFinite), 'Native runtime finite bodies');
      }
      check(shots.length === 3 && G.player.gun.ammo === 3, 'Three real shots consume three rounds');
      report.runtime = { physicsSteps: Math.ceil(3 / DT), duration: G.t, input: 'gunCanFire(now:true), three taps against passive native opponent', shots,
        outcomes: G.player.gun.what, wounds: G.wounds.map(({ zone, type, energy, severity }) => ({ zone, type, energy, severity })) };
    } finally { free(G); Object.assign(GUN_HOOKS, originalHooks); }
  }
  for (const [name, part, look] of [['bare-chest', 'chest', LOOKS.enemy], ['bare-head', 'head', LOOKS.enemy], ['plate-chest', 'chest', CHARACTERS_BY_ID.heinrich.look], ['helmet-head', 'head', LOOKS.player]]) {
    const rows = [];
    for (const energy of [70, 75]) {
      const G = fresh({ look2: look });
      try {
        GUN.energy = energy;
        const vic = G.enemy, vi = [...G.combat.info.values()].find((i) => i.fighter === vic && i.part === part && i.kind !== 'weapon');
        check(!!vi, `${name} real colliderInfo available`);
        const local = new THREE.Vector3(.02, part === 'head' ? .08 : 0, .05), point = local.clone().applyQuaternion(q(vi.body.rotation())).add(v(vi.body.translation()));
        const res = bulletHit(G.player, vi, point, new THREE.Vector3(1, 0, 0), G.combat);
        check(!!res && G.wounds.length === 1, `${name} actual damage branch and callback`);
        const armored = name.startsWith('plate') || name.startsWith('helmet');
        check(!!res.armorStopped === armored, `${name} actual armor coverage`);
        near(res.energy, energy * (G.player.weaponCfg.power ?? 1) * (armored ? GUN.armorBlunt : 1), `${name} correct delivered energy`);
        if (armored) check(res.type === 'blunt' && res.severity === 0 && vic.wounds.length === 0 && vic.bleed === 0, `${name} preserves armor stop without wound`);
        else check(res.type === 'stab' && res.pass && vic.wounds.length >= 1 && vic.bleed > 0, `${name} applies real flesh wound`);
        rows.push({ configuredEnergy: energy, energy: res.energy, severity: res.severity, type: res.type, zone: res.zone, armorStopped: !!res.armorStopped,
          power: G.player.weaponCfg.power ?? 1, state: vic.state, wounds: vic.wounds.length, bleed: vic.bleed, pain: vic.pain, consciousness: vic.consciousness, helmetIntegrity: vic.helmetIntegrity, plateIntegrity: vic.plate[part] ?? null });
      } finally { free(G); GUN.energy = originalEnergy; }
    }
    near(rows[1].energy - rows[0].energy, 5 * rows[0].power * (rows[0].armorStopped ? GUN.armorBlunt : 1), `${name} +5 J propagated`);
    if (!rows[0].armorStopped) near(rows[1].severity - rows[0].severity, 5 * rows[0].power / 60, `${name} actual severity increases`);
    report.damage.push({ name, rows });
  }
  report.pass = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  Math.random = originalRandom; GUN.energy = originalEnergy; Object.assign(GUN_HOOKS, originalHooks);
  report.sourceAfter = hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  if (!report.sourceStable) { report.pass = false; report.error = `${report.error ?? ''}\nProduction sources changed during execution`; process.exitCode = 1; }
  mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks, geometrySamples: report.geometry.reduce((n, x) => n + x.samples, 0), physicsSteps: report.runtime?.physicsSteps ?? 0, damageCases: report.damage.length, sourceStable: report.sourceStable, reportPath, error: report.error }));
}
