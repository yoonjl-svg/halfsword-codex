// Isolated settings comparison using production Fighter/Rapier/weapon control.
// No direct transforms, fake muscles, rendering or audio. Passive native opponent.
// node tools/sim/revolver_tremor_20261008.mjs /fresh/report.json [settings.json]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, THREE, DT } from './harness_m.mjs';
import { GUN, GUN_HOOKS, gunAimTarget, gunSway, gunCanFire } from '../../src/gun.js';

const BASE = '54119dda23f1dd56c5066f75c3388e71a3a0cb02';
const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const out = resolve(process.argv[2] ?? '/tmp/revolver-tremor-20261008.json');
assert(!existsSync(out), 'Use a fresh report path');
const defaults = { ...GUN }, oldRandom = Math.random, hooks = { ...GUN_HOOKS };
const presets = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : [
  { name: 'base', settings: { swayRandHold: .45, swayRandYaw: 5, swayRandPitch: 5 } },
  { name: 'hold-only', settings: { swayRandHold: .14, swayRandYaw: 5, swayRandPitch: 5 } },
  { name: 'random-dominant', settings: { swayRandHold: .14, swayRandYaw: 18, swayRandPitch: 12 } },
];
const hash = (s) => createHash('sha256').update(s).digest('hex');
const sourceHash = () => Object.fromEntries(['src/gun.js', 'src/fighter.js', 'src/skill.js', 'src/weapons.js', 'src/combat.js', 'src/sound.js'].map((p) => [p, hash(readFileSync(resolve(root, p)))]));
const report = { baselineCommit: BASE, currentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceBefore: sourceHash(),
  toolSha256: hash(readFileSync(new URL(import.meta.url))), command: process.argv.join(' '),
  scope: 'Controlled 7-second native runs: 1-second settling, 6-second motion analysis, one late real player shot. Native passive opponent. Frequency and speed measures are descriptive; not natural accuracy or human tremor acceptance.',
  presets, runs: [], pass: false };
class Passive { update() {} }
const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const Q = (p) => new THREE.Quaternion(p.x, p.y, p.z, p.w);
const radians = Math.PI / 180;
const angular = (d) => [Math.atan2(d.z, d.x) / radians, Math.atan2(d.y, Math.hypot(d.x, d.z)) / radians];
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
function highPass(values, seconds = .25) {
  const half = Math.round(seconds / DT / 2);
  return values.map((x, i) => x - mean(values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1))));
}
function bandRms(values, low = 2, high = 12) {
  const n = values.length, centered = values.map((v) => v - mean(values));
  let sum = 0;
  for (let k = Math.ceil(low * n * DT); k <= Math.floor(high * n * DT); k++) {
    let real = 0, imag = 0;
    for (let i = 0; i < n; i++) { const angle = 2 * Math.PI * k * i / n; real += centered[i] * Math.cos(angle); imag -= centered[i] * Math.sin(angle); }
    sum += 2 * (real * real + imag * imag) / (n * n);
  }
  return Math.sqrt(sum);
}
function stats(samples, key) {
  const axes = samples.map((s) => angular(new THREE.Vector3(...s[key])));
  const velocity = [];
  for (let i = 1; i < samples.length; i++) velocity.push(new THREE.Vector3(...samples[i - 1][key]).angleTo(new THREE.Vector3(...samples[i][key])) / radians / DT);
  const hp = [0, 1].map((axis) => rms(highPass(axes.map((a) => a[axis]))));
  const band = [0, 1].map((axis) => bandRms(axes.map((a) => a[axis])));
  const reversals = [0, 1].map((axis) => {
    let last = 0, count = 0;
    for (let i = 1; i < axes.length; i++) { const speed = (axes[i][axis] - axes[i - 1][axis]) / DT, sign = Math.abs(speed) > .5 ? Math.sign(speed) : 0; if (sign && last && sign !== last) count++; if (sign) last = sign; }
    return count;
  });
  return { meanAngularSpeedDegSec: mean(velocity), rmsAngularSpeedDegSec: rms(velocity), maxAngularSpeedDegSec: Math.max(...velocity), highPassRmsDeg: hp, band2to12HzRmsDeg: band, reversalCounts: reversals };
}
function segmentDistance(point, f) {
  const parts = ['pelvis', 'abdomen', 'chest', ...(!f.decapitated ? ['head'] : [])], points = parts.map((part) => V(f.bodies[part].translation()));
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const edge = points[i].clone().sub(points[i - 1]), len2 = edge.lengthSq();
    const t = len2 ? THREE.MathUtils.clamp(point.clone().sub(points[i - 1]).dot(edge) / len2, 0, 1) : 0;
    best = Math.min(best, point.distanceTo(points[i - 1].clone().addScaledVector(edge, t)));
  }
  return best;
}
try {
  for (const preset of presets) for (const seed of [19, 29]) {
    Object.assign(GUN, defaults, preset.settings);
    assert.equal(GUN.energy, 75); assert.equal(GUN.aimSide, .3); assert.equal(GUN.aimHeightSway, .2);
    const G = newRound({ seed, gap: 4, walls: false, weapon: 'pistol', weapon2: 'longsword', AIClass: Passive });
    const frames = [], shots = []; let maxBoundDistance = 0, maxTrackingError = 0;
    try {
      GUN_HOOKS.onShot = (f, pos, dir, dist) => {
        const rot = Q(f.sword.rotation()), axis = new THREE.Vector3(0, 1, 0).applyQuaternion(rot);
        const muzzle = new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(rot).add(V(f.sword.translation()));
        assert(pos.distanceTo(muzzle) < 2e-6, 'Shot starts at physical muzzle');
        const pv = f.bodies.pelvis.linvel(), cone = GUN.spread + GUN.spreadMove * Math.min(1, Math.hypot(pv.x, pv.z) / 2.3);
        const angle = axis.angleTo(dir) / radians;
        assert(f.gun.aim === 0 && angle <= cone + 2e-4, 'Player actual ray has only preexisting barrel spread');
        shots.push({ t: G.t, position: pos.toArray(), direction: dir.toArray(), spreadDeg: angle, spreadBoundDeg: cone, dist, seed: f.gun.seed });
      };
      for (let i = 0; i < Math.ceil(7 / DT); i++) {
        if (i === Math.ceil(6.7 / DT)) assert(gunCanFire(G.player, { now: true }), 'Late player shot accepted');
        G.step();
        const f = G.player, foe = G.enemy;
        for (const person of [f, foe]) for (const body of Object.values(person.bodies)) assert(Object.values(body.translation()).every(Number.isFinite), 'Native body position finite');
        const actual = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword.rotation())), command = f.aimDirW.clone().normalize();
        const sw = gunSway(f.gun.t ?? 0, f.index * 2.1), rs = f.gun.rs;
        const target = gunAimTarget(foe, f.gun.h, { yaw: sw.yaw + rs.yaw, pitch: sw.pitch + rs.pitch });
        const distance = segmentDistance(target, foe);
        assert(distance <= GUN.aimSide + 2e-6, 'Desired target remains upper-body corridor');
        maxBoundDistance = Math.max(maxBoundDistance, distance);
        const trackingErrorDeg = actual.angleTo(command) / radians;
        maxTrackingError = Math.max(maxTrackingError, trackingErrorDeg);
        if (G.t >= 1 && G.t < 6.7) frames.push({ t: G.t, actual: actual.toArray(), command: command.toArray(), target: target.toArray(),
          muzzle: new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(Q(f.sword.rotation())).add(V(f.sword.translation())).toArray(),
          trackingErrorDeg, playerState: f.state, enemyState: foe.state, h: f.gun.h, rs: { ...rs }, chestPosition: V(foe.bodies.chest.translation()).toArray() });
      }
      assert(shots.length === 1 && G.player.gun.ammo === 5, 'One actual shot, one round consumed');
      const tracking = frames.map((s) => s.trackingErrorDeg);
      report.runs.push({ preset: preset.name, seed, settings: { swayRandHold: GUN.swayRandHold, swayRandYaw: GUN.swayRandYaw, swayRandPitch: GUN.swayRandPitch, swayPeriod: GUN.swayPeriod, energy: GUN.energy, aimSide: GUN.aimSide, aimHeightSway: GUN.aimHeightSway },
        physicsSteps: Math.ceil(7 / DT), analyzedSeconds: frames.length * DT, maxBoundDistance, maxTrackingErrorDeg: maxTrackingError,
        meanTrackingErrorDeg: mean(tracking), commandMotion: stats(frames, 'command'), actualMuzzleMotion: stats(frames, 'actual'), shots,
        outcome: G.player.gun.what, finalStates: [G.player.state, G.enemy.state], frames });
    } finally { G.eventQueue.free(); G.world.free(); }
  }
  report.pass = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  Object.assign(GUN, defaults); Object.assign(GUN_HOOKS, hooks); Math.random = oldRandom;
  report.sourceAfter = sourceHash(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  if (!report.sourceStable) { report.pass = false; report.error = `${report.error ?? ''}\nSources changed during native run`; process.exitCode = 1; }
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, sourceStable: report.sourceStable, reportPath: out,
    runs: report.runs.map(({ preset, seed, commandMotion, actualMuzzleMotion, meanTrackingErrorDeg, maxBoundDistance, finalStates }) => ({ preset, seed, commandMotion, actualMuzzleMotion, meanTrackingErrorDeg, maxBoundDistance, finalStates })), error: report.error }));
}
