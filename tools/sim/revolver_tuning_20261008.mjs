// Narrow production timer/target check on native Fighter/Rapier objects.
// Direct updateGun calls; deliberately no world.step, dynamic-fight or pose claim.
// node tools/sim/revolver_tuning_20261008.mjs /fresh/report.json
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, THREE, DT } from './harness_m.mjs';
import * as current from '../../src/gun.js';
import { LOOKS } from '../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const BASE = '541c4cf1e2861b46735b818d66b270c1bf6105df';
const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const out = resolve(process.argv[2] ?? '/tmp/revolver-tuning-20261008.json');
assert(!existsSync(out), 'Use a fresh report path');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['src/gun.js', 'src/revolver_reload_audio.js', 'src/sound.js', 'src/fighter.js', 'src/combat.js', 'tools/sim/harness_m.mjs', 'tools/sim/revolver_tuning_20261008.mjs'];
const hashes = () => Object.fromEntries(files.map(f => [f, sha(readFileSync(resolve(root, f)))]));
const baselineText = execFileSync('git', ['show', `${BASE}:src/gun.js`], { cwd: root, encoding: 'utf8' });
// Import the historical production module with its ordinary dependencies. This
// retains its real state machine and PRNG, rather than reimplementing either.
const baselineImport = baselineText.replace(/from\s+(['"])([^'"]+)\1/g, (_, quote, spec) =>
  `from ${quote}${spec === 'three' ? import.meta.resolve('three') : new URL(spec, pathToFileURL(resolve(root, 'src/gun.js'))).href}${quote}`);
const baseline = await import(`data:text/javascript;base64,${Buffer.from(baselineImport).toString('base64')}`);
const report = { baselineCommit: BASE, currentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: `node tools/sim/revolver_tuning_20261008.mjs ${out}`, sourceBefore: hashes(), baselineGunSHA256: sha(baselineText),
  scope: 'Actual gunCanFire/updateGun/fire on native Fighter/Rapier objects, direct timer ticks and fixed transforms; zero world.step calls. Geometry and equal-time random-state checks. Not dynamic combat, visual pose, natural accuracy, or human acceptance.',
  checks: 0, physicsSteps: 0, cooldown: [], reload: null, fixedTickReload: null, tremor: null, geometry: [], damage: [], pass: false };
const check = (value, label) => { report.checks++; assert(value, label); };
const near = (a, b, label, eps = 2e-8) => check(Math.abs(a - b) < eps, `${label}: ${a} versus ${b}`);
const vectorNear = (a, b, label, eps = 3e-6) => check(a.distanceTo(b) < eps, `${label}: ${a.distanceTo(b)}`);
const V = p => new THREE.Vector3(p.x, p.y, p.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const originalRandom = Math.random, originalHooks = { ...current.GUN_HOOKS }, originalEnergy = current.GUN.energy;
class Passive { update() {} }
let G;
try {
  const { GUN, GUN_HOOKS, gunCanFire, updateGun, gunAimTarget } = current;
  near(GUN.cooldown, .8, 'Shot interval .8 seconds'); near(GUN.reload, 8, 'Reload eight seconds');
  near(GUN.reloadInsertInterval, ((9 - .9 - .8) / 6) * .8, 'Explicit insert intervals reduce historical interval by exactly 20%');
  near(GUN.aimEnvelopeScale, 1.1, 'Whole target envelope scale');
  near(GUN.energy, 80, 'Requested shot energy 80 J');
  for (const key of Object.keys(baseline.GUN)) if (!['cooldown', 'reload', 'energy'].includes(key)) {
    check(JSON.stringify(GUN[key]) === JSON.stringify(baseline.GUN[key]), `Unchanged previous GUN setting: ${key}`);
  }
  G = newRound({ seed: 19, walls: false, weapon: 'pistol', weapon2: 'longsword', AIClass: Passive });
  const f = G.player;
  let now = 0, updateCalls = 0;
  const shots = [], reloadEvents = [];
  GUN_HOOKS.onShot = (fighter, muzzle, direction) => {
    check(fighter === f, 'Shot hook comes from real player');
    check(muzzle.toArray().every(Number.isFinite) && direction.toArray().every(Number.isFinite), 'Real shot ray finite');
    shots.push({ time: now, ammo: fighter.gun.ammo, seed: fighter.gun.seed });
  };
  GUN_HOOKS.onReloadStart = () => reloadEvents.push({ kind: 'open', time: now });
  GUN_HOOKS.onLoadRound = (_, __, round) => reloadEvents.push({ kind: 'insert', round, time: now });
  GUN_HOOKS.onReload = () => reloadEvents.push({ kind: 'close', time: now });
  const tick = dt => { now += dt; updateCalls++; updateGun(f, G.world, G.combat, dt); };
  const fireNow = () => { check(gunCanFire(f, { now: true }), 'Fire input accepted'); tick(0); };
  const epsilon = 1e-7;
  fireNow();
  for (let n = 1; n < 6; n++) {
    const start = now;
    tick(.8 - epsilon);
    check(!gunCanFire(f, { now: true }), 'Shot blocked just before .8 seconds');
    check(f.gun.shots === n, 'Rejected early input consumes no shot');
    tick(2 * epsilon);
    fireNow();
    near(now - start, .8 + epsilon, 'Next real shot at .8 second boundary');
    report.cooldown.push({ shot: n + 1, rejectedAt: .8 - epsilon, acceptedAt: now - start });
  }
  check(shots.length === 6 && f.gun.ammo === 0 && f.gun.reloading, 'Six actual fire calls start empty reload');
  const reloadStart = now, scheduled = Array.from({ length: 6 }, (_, i) => .9 + ((9 - .9 - .8) / 6) * .8 * (i + .5));
  for (let i = 0; i < scheduled.length; i++) {
    tick(reloadStart + scheduled[i] - epsilon - now);
    check(reloadEvents.filter(e => e.kind === 'insert').length === i, 'Insert does not occur before its boundary');
    check(f.gun.ammo === 0 && f.gun.reloading && !gunCanFire(f, { now: true }), 'No partial refill or firing during insertion');
    tick(2 * epsilon);
    const inserts = reloadEvents.filter(e => e.kind === 'insert');
    check(inserts.length === i + 1 && inserts[i].round === i + 1, 'Exactly one correctly indexed insert at each boundary');
    near(inserts[i].time - reloadStart, scheduled[i] + epsilon, 'Insert hook timing');
  }
  tick(reloadStart + 8 - epsilon - now);
  check(f.gun.ammo === 0 && f.gun.reloading && !gunCanFire(f, { now: true }), 'Ammo unavailable before eight-second boundary');
  tick(2 * epsilon);
  check(f.gun.ammo === 6 && !f.gun.reloading, 'Exactly six rounds refill at eight-second boundary');
  check(reloadEvents.filter(e => e.kind === 'close').length === 1, 'One reload close');
  check(gunCanFire(f, { now: true }), 'Input available when refill completes'); f.gun.pending = -1;
  report.reload = { expectedInsertSeconds: scheduled, oldInsertIntervalSeconds: (9 - .9 - .8) / 6,
    newInsertIntervalSeconds: GUN.reloadInsertInterval, intervalRatio: GUN.reloadInsertInterval / ((9 - .9 - .8) / 6),
    hookEvents: reloadEvents.map(e => ({ ...e, time: e.time - reloadStart })), shots, updateCalls, boundaryEpsilonSeconds: epsilon };

  // Sample the same production timer at the game's actual 120 Hz fixed tick.
  // No simulated body motion is needed to measure timer quantization.
  reloadEvents.length = 0; now = 0;
  Object.assign(f.gun, { cool: 8, reloading: true, ammo: 0, pending: -1 });
  for (let i = 0; i < Math.ceil((8 + DT) / DT); i++) tick(DT);
  const fixedInserts = reloadEvents.filter(e => e.kind === 'insert');
  check(fixedInserts.length === 6, '120 Hz timer emits six inserts');
  for (let i = 0; i < 6; i++) check(fixedInserts[i].time >= scheduled[i] - 1e-10 && fixedInserts[i].time < scheduled[i] + DT + 1e-10, '120 Hz insertion lies in first eligible tick');
  const close = reloadEvents.find(e => e.kind === 'close');
  check(close && close.time >= 8 - 1e-10 && close.time <= 8 + DT + 1e-10, '120 Hz refill within one fixed step of eight seconds');
  report.fixedTickReload = { tickSeconds: DT, hookEvents: [{ kind: 'open', time: 0 }, ...reloadEvents], duration: now, expectedQuantizationLimitSeconds: DT };

  // Same production PRNG/state update, equal time, no shots or shared RNG.
  const left = { index: 0, alive: true, armed: true }, right = { index: 0, alive: true, armed: true };
  let randomCalls = 0, randomBefore = Math.random;
  const rhythm = [];
  Math.random = () => { randomCalls++; throw Error('Idle tremor consumed shared random'); };
  try {
    for (let i = 0; i < 1200; i++) {
      baseline.updateGun(left, G.world, G.combat, DT); updateGun(right, G.world, G.combat, DT);
      check(JSON.stringify(left.gun) === JSON.stringify(right.gun), 'Equal-time tremor/height RNG and interpolation exactly preserved');
      const oldSway = baseline.gunSway(right.gun.t, 0), newSway = current.gunSway(right.gun.t, 0);
      check(JSON.stringify(oldSway) === JSON.stringify(newSway), 'Deterministic sway phase exactly preserved');
      rhythm.push({ t: right.gun.t, sseed: right.gun.sseed, hseed: right.gun.hseed, rs: right.gun.rs, h: right.gun.h, sway: newSway });
    }
  } finally { Math.random = randomBefore; }
  report.tremor = { samples: rhythm.length, elapsedSeconds: 1200 * DT, stateSHA256: sha(JSON.stringify(rhythm)), sharedRandomCalls: randomCalls, bitExactToBaseline: true };

  const foe = G.enemy;
  for (const pose of ['upright', 'prone', 'head-detached']) {
    if (pose === 'prone') {
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, .4, Math.PI / 2));
      for (const body of Object.values(foe.bodies)) { body.setTranslation(V(body.translation()).applyQuaternion(rot), true); body.setRotation(rot.clone().multiply(Q(body.rotation())), true); }
    }
    if (pose === 'head-detached') { foe.decapitated = true; foe.bodies.head.setTranslation({ x: 100, y: -100, z: 100 }, true); }
    const low = baseline.gunAimTarget(foe, 0, { yaw: 0, pitch: 0 });
    const high = baseline.gunAimTarget(foe, 1, { yaw: 0, pitch: 0 });
    const center = low.clone().add(high).multiplyScalar(.5);
    const before = JSON.stringify(Object.values(foe.bodies).map(body => [body.translation(), body.rotation()]));
    let samples = 0, maxError = 0, maxLateral = 0;
    for (const h of [-1, 0, .2, .5, .8, 1, 2]) for (const yaw of [-1000, -17, 0, 17, 1000]) for (const pitch of [-1000, -9, 0, 9, 1000]) {
      const oldTarget = baseline.gunAimTarget(foe, h, { yaw, pitch });
      const target = gunAimTarget(foe, h, { yaw, pitch });
      const expected = oldTarget.clone().sub(center).multiplyScalar(1.1).add(center);
      vectorNear(target, expected, `${pose}: full target range uniformly expands 10%`);
      maxError = Math.max(maxError, target.distanceTo(expected)); samples++;
      const noYaw = gunAimTarget(foe, h, { yaw: 0, pitch });
      maxLateral = Math.max(maxLateral, target.distanceTo(noYaw));
    }
    const expandedLow = gunAimTarget(foe, 0, { yaw: 0, pitch: -1000 });
    const expandedHigh = gunAimTarget(foe, 1, { yaw: 0, pitch: 1000 });
    near(expandedHigh.distanceTo(expandedLow) / high.distanceTo(low), 1.1, `${pose}: full vertical endpoint span is 10% larger`, 5e-6);
    near(maxLateral, .33, `${pose}: actual lateral bound is .33m`, 5e-6);
    check(JSON.stringify(Object.values(foe.bodies).map(body => [body.translation(), body.rotation()])) === before, 'Target helper does not move native bodies');
    report.geometry.push({ pose, samples, maxError, maxLateral, oldEndpointSpan: high.distanceTo(low), newEndpointSpan: expandedHigh.distanceTo(expandedLow), center: center.toArray() });
  }
  // Native collider/body fixture through the real wound/armor branches. No
  // stepped physics or naturally occurring hit/TTK claim.
  for (const [name, part, look, armored] of [['bare-chest', 'chest', LOOKS.enemy, false], ['bare-head', 'head', LOOKS.enemy, false], ['plate-chest', 'chest', CHARACTERS_BY_ID.heinrich.look, true], ['helmet-head', 'head', LOOKS.player, true]]) {
    const rows = [];
    for (const energy of [75, 80]) {
      const fixture = newRound({ seed: 19, walls: false, weapon: 'pistol', weapon2: 'longsword', AIClass: Passive, look2: look });
      try {
        GUN.energy = energy;
        const victim = fixture.enemy, info = [...fixture.combat.info.values()].find(info => info.fighter === victim && info.part === part && info.kind !== 'weapon');
        check(!!info, 'Real native damage collider exists');
        const point = new THREE.Vector3(.02, part === 'head' ? .08 : 0, .05).applyQuaternion(Q(info.body.rotation())).add(V(info.body.translation()));
        const result = current.bulletHit(fixture.player, info, point, new THREE.Vector3(1, 0, 0), fixture.combat);
        check(!!result && fixture.wounds.length === 1, 'Production bulletHit produces real wound callback');
        check(!!result.armorStopped === armored, 'Expected real armor-coverage branch');
        near(result.energy, energy * (fixture.player.weaponCfg.power ?? 1) * (armored ? .25 : 1), 'Requested energy reaches native damage branch');
        if (armored) check(result.type === 'blunt' && result.severity === 0 && victim.wounds.length === 0, 'Armor preserves stopped/no flesh wound behavior');
        else check(result.type === 'stab' && result.pass && victim.wounds.length > 0 && victim.bleed > 0, 'Unprotected hit applies native flesh wound');
        rows.push({ configuredEnergy: energy, deliveredEnergy: result.energy, armorStopped: !!result.armorStopped, severity: result.severity, type: result.type, woundCount: victim.wounds.length, helmetIntegrity: victim.helmetIntegrity, plateIntegrity: victim.plate[part] ?? null });
      } finally { fixture.eventQueue.free(); fixture.world.free(); GUN.energy = originalEnergy; }
    }
    near(rows[1].deliveredEnergy - rows[0].deliveredEnergy, armored ? 1.25 : 5, '75 to 80 J change propagated');
    report.damage.push({ name, rows });
  }
  report.pass = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  if (G) { G.eventQueue.free(); G.world.free(); }
  Math.random = originalRandom; current.GUN.energy = originalEnergy; Object.assign(current.GUN_HOOKS, originalHooks);
  report.sourceAfter = hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  if (!report.sourceStable) { report.pass = false; report.error = `${report.error ?? ''}\nSource changed during execution`; process.exitCode = 1; }
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks, sourceStable: report.sourceStable, physicsSteps: report.physicsSteps, reportPath: out, error: report.error }));
}
