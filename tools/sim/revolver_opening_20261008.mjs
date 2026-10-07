// Focused native opening-hold regression. Only the runtime case steps Rapier;
// boundary/AI/reload cases deliberately control time and body transforms.
// node tools/sim/revolver_opening_20261008.mjs /fresh/report.json
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { newRound, AI, CONFIG, DT, THREE } from './harness_m.mjs';
import { GUN, GUN_HOOKS, gunCanFire, gunAI, updateGun } from '../../src/gun.js';

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const out = resolve(process.argv[2] ?? '/tmp/revolver-opening-20261008.json');
assert(!existsSync(out), 'Preserve evidence: use a fresh report path');
const files = ['src/gun.js', 'src/fighter.js', 'src/skill.js', 'src/ai.js', 'src/combat.js', 'src/config.js', 'tools/sim/harness_m.mjs', 'tools/sim/revolver_opening_20261008.mjs'];
const hashes = () => Object.fromEntries(files.map(p => [p, createHash('sha256').update(readFileSync(resolve(root, p))).digest('hex')]));
const report = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: `node tools/sim/revolver_opening_20261008.mjs ${out}`,
  sourceBefore: hashes(), startHold: CONFIG.ARENA.startHold, fixedTick: DT,
  scope: 'Real Fighter/Skill/Gun exports and native Rapier objects. One passive 2.1-second fixed-step opening runtime; direct controlled boundary, AI, timer and restart fixtures. No full combat, browser input, natural accuracy, audio or human acceptance claim.',
  checks: 0, physicsSteps: 0, cases: [], pass: false,
};
const check = (condition, label) => { report.checks++; assert(condition, label); };
const near = (actual, expected, label) => check(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} vs ${expected}`);
const hold = CONFIG.ARENA.startHold;
const originalRandom = Math.random, originalHooks = { ...GUN_HOOKS };
class Passive { update() {} }
const fixtures = [];
const fresh = () => {
  const g = newRound({ seed: 83, walls: false, weapon: 'pistol', weapon2: 'pistol', AIClass: Passive });
  g.player.foe = g.enemy; g.enemy.foe = g.player; fixtures.push(g); return g;
};
const tick = (G, f, dt) => updateGun(f, G.world, G.combat, dt);
const shots = [];
GUN_HOOKS.onShot = f => shots.push({ index: f.index, fightT: f.fightT, gunT: f.gun.t });
GUN_HOOKS.onImpact = () => {};
GUN_HOOKS.onReloadStart = () => {};
GUN_HOOKS.onLoadRound = () => {};
GUN_HOOKS.onReload = () => {};
try {
  check(hold === 2, 'Production opening hold remains two seconds');
  const boundary = fresh();
  for (const f of [boundary.player, boundary.enemy]) {
    check(!gunCanFire(f, { now: true }), `${f.index}: fresh direct firing rejected`);
    check(f.gun == null, `${f.index}: rejected fresh input creates no gun queue/state`);
    for (const t of [0, .5, 1.5, hold - DT, hold - 2e-6]) {
      f.fightT = t;
      check(f.feetHeld, `${f.index}: test is inside native hold`);
      for (let i = 0; i < 6; i++) check(!f.skill.thrust(), `${f.index}: repeated Skill.thrust rejected at ${t}`);
      check(f.gun == null, `${f.index}: held taps do not create a pending shot`);
    }
    // Uses the existing Fighter getter, including its 1e-6 fixed-tick tolerance.
    f.fightT = hold - 1e-6;
    check(!f.feetHeld, `${f.index}: native movement boundary released`);
    check(f.skill.thrust(), `${f.index}: firing accepted at same native release boundary`);
    const before = shots.length;
    tick(boundary, f, DT);
    check(shots.length === before + 1 && f.gun.ammo === 5, `${f.index}: accepted boundary input produces one real shot`);
    report.cases.push({ name: 'native-boundary-and-repeat-taps', index: f.index, acceptedFightT: f.fightT, shots: f.gun.shots });
  }

  // Defensively abandon an already-pending shot during the hold. This prepares
  // impossible ordinary input state deliberately to exercise the firing gate.
  const pending = fresh();
  for (const f of [pending.player, pending.enemy]) {
    tick(pending, f, 0);
    Object.assign(f.gun, { pending: GUN.maxWait, cool: .4 });
    const before = shots.length, seed = f.gun.sseed;
    tick(pending, f, .2);
    check(f.gun.pending === -1 && f.gun.shots === 0 && f.gun.ammo === 6, `${f.index}: pending shot discarded without ammo consumption`);
    near(f.gun.t, .2, 'Aim clock progresses during hold');
    near(f.gun.cool, .2, 'Cooldown progresses during hold');
    check(f.gun.sseed !== seed && Number.isFinite(f.gun.h), 'Tremor and aim height continue updating');
    f.fightT = hold;
    tick(pending, f, .7);
    check(shots.length === before && f.gun.shots === 0, `${f.index}: discarded input does not fire after release`);
  }
  report.cases.push({ name: 'pending-abort-keeps-aim-and-cooldown', indices: [0, 1] });

  const idleA = fresh(), idleB = fresh();
  for (const key of ['player', 'enemy']) {
    idleB[key].fightT = hold + 1;
    for (let i = 0; i < Math.round(hold / DT); i++) {
      tick(idleA, idleA[key], DT); tick(idleB, idleB[key], DT);
      check(JSON.stringify(idleA[key].gun) === JSON.stringify(idleB[key].gun), `${key}: held and released idle aim state is bit-identical`);
    }
  }
  report.cases.push({ name: 'unchanged-idle-aim-clock-and-rng', samplesPerIndex: Math.round(hold / DT) });

  const runtime = fresh(), beforeRuntimeShots = shots.length;
  while (runtime.player.feetHeld) {
    for (const f of [runtime.player, runtime.enemy]) check(!f.skill.thrust(), `${f.index}: fixed-step held tap rejected`);
    runtime.step(); report.physicsSteps++;
  }
  const releaseT = runtime.t;
  for (let i = 0; i < 12; i++) { runtime.step(); report.physicsSteps++; }
  check(shots.length === beforeRuntimeShots, 'Native opening/release steps never replay held taps');
  for (const f of [runtime.player, runtime.enemy]) {
    check(f.gun.shots === 0 && f.gun.ammo === 6 && f.gun.pending < 0, `${f.index}: native runtime has full magazine and no pending input`);
    near(f.gun.t, report.physicsSteps * runtime.world.timestep, `${f.index}: aim clock follows actual Rapier fixed timestep`);
    for (const body of Object.values(f.bodies)) check(Object.values(body.translation()).every(Number.isFinite), 'Native runtime body positions finite');
  }
  check(runtime.player.skill.thrust(), 'Fresh input after stepped hold is accepted');
  runtime.step(); report.physicsSteps++;
  check(shots.length === beforeRuntimeShots + 1, 'Fresh post-hold tap fires in native combat.afterStep');
  report.cases.push({ name: 'native-fixed-step-opening-no-queue', releaseT, duration: runtime.t, steps: report.physicsSteps, shots: runtime.player.gun.shots });

  const aiFixture = fresh(), me = aiFixture.enemy, foe = aiFixture.player;
  const ai = new AI(me, foe, 'normal');
  ai.gunT = GUN.aiFirst + 1; ai.d = 4;
  // Align the real weapon body at chest height; the production aim check still
  // decides whether gunAI reaches the real Skill.thrust input gate.
  const chest = new THREE.Vector3().copy(foe.bodies.chest.translation());
  const origin = chest.clone().add(new THREE.Vector3(4, 0, 0));
  me.sword.setTranslation(origin, true);
  me.sword.setRotation(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)), true);
  let aiAttempts = 0, aiAccepted = 0;
  const thrust = me.skill.thrust;
  me.skill.thrust = function (...args) { aiAttempts++; const ok = thrust.apply(this, args); aiAccepted += Number(ok); return ok; };
  for (const t of [1.5, 1.9, hold - 2e-6]) { me.fightT = t; gunAI(ai, DT); }
  check(aiAttempts === 3 && aiAccepted === 0, 'Aimed production AI attempts all reach and fail held Skill.thrust');
  me.fightT = hold; gunAI(ai, DT);
  check(aiAccepted === 1 && me.gun.pending >= 0, 'Aimed production AI accepts new input after release');
  const aiShots = shots.length; tick(aiFixture, me, DT);
  check(shots.length === aiShots + 1, 'Post-hold AI request emits one shot');
  report.cases.push({ name: 'production-ai-controlled-aim', attempts: aiAttempts, accepted: aiAccepted, index: me.index });

  const cycle = fresh(), f = cycle.player;
  f.fightT = hold;
  for (let round = 1; round <= GUN.rounds; round++) {
    check(f.skill.thrust(), `Post-hold round ${round} accepted`); tick(cycle, f, 0);
    check(f.gun.shots === round && f.gun.ammo === GUN.rounds - round, `Round ${round} fires/consumes once`);
    check(!f.skill.thrust(), `Round ${round}: cooldown/reload rejects repeat`);
    const duration = round < GUN.rounds ? GUN.cooldown : GUN.reload;
    tick(cycle, f, duration - 1e-5);
    check(!f.skill.thrust(), `Round ${round}: input rejected immediately before timer boundary`);
    tick(cycle, f, 2e-5);
  }
  check(f.gun.ammo === 6 && !f.gun.reloading && f.gun.shots === 6, 'Six shots and complete reload restore six rounds');
  check(f.skill.thrust(), 'New shot accepted after complete reload');
  tick(cycle, f, 0); check(f.gun.shots === 7 && f.gun.ammo === 5, 'Seventh shot fires normally');
  report.cases.push({ name: 'post-opening-cooldown-and-full-reload', cooldown: GUN.cooldown, reload: GUN.reload, shots: f.gun.shots });

  check(GUN.cooldown === .8 && GUN.reload === 8 && GUN.energy === 80 && GUN.rounds === 6, 'Requested firing, reload, energy and capacity settings preserved');
  near(GUN.reloadInsertInterval, (7.3 / 6) * .8 * .8, 'Insertion spacing shortened a further twenty percent');
  const timer = fresh(), loader = timer.player, events = [];
  loader.fightT = hold; tick(timer, loader, 0);
  Object.assign(loader.gun, { ammo: 0, cool: GUN.reload, reloading: true, pending: -1 });
  let elapsed = 0;
  const timerTick = dt => { elapsed += dt; tick(timer, loader, dt); };
  GUN_HOOKS.onLoadRound = (_f, _pos, index) => events.push({ kind: 'insert', index, time: elapsed });
  GUN_HOOKS.onReload = () => events.push({ kind: 'close', time: elapsed });
  const expected = Array.from({ length: 6 }, (_, i) => GUN.reload - GUN.reloadClose - GUN.reloadInsertInterval * (5 - i));
  for (let i = 0; i < expected.length; i++) {
    timerTick(expected[i] - 1e-5 - elapsed);
    check(events.length === i, `Insertion ${i + 1} absent immediately before onset`);
    check(loader.gun.ammo === 0 && loader.gun.reloading, 'Ammo stays empty during every insertion');
    timerTick(2e-5);
    check(events.length === i + 1 && events[i].kind === 'insert' && events[i].index === i + 1, `Exactly insertion index ${i + 1} emitted at crossing`);
    near(events[i].time, expected[i] + 1e-5, `Insertion ${i + 1} follows expected production crossing`);
    timerTick(0); check(events.length === i + 1, 'Zero elapsed time never duplicates insertion');
  }
  timerTick(8 - 1e-5 - elapsed);
  check(events.length === 6 && loader.gun.ammo === 0 && loader.gun.reloading, 'No refill or close before eight seconds');
  check(!loader.skill.thrust(), 'Cannot fire immediately before reload completion');
  timerTick(2e-5);
  check(events.length === 7 && events[6].kind === 'close', 'Exactly one close at eight-second boundary');
  check(loader.gun.ammo === 6 && !loader.gun.reloading && loader.skill.thrust(), 'Six rounds and input return together at eight seconds');
  report.cases.push({ name: 'exact-six-insert-and-close-boundaries', expectedInsertSeconds: expected, events, boundaryEpsilonSeconds: 1e-5 });

  const restart = fresh();
  for (const f of [restart.player, restart.enemy]) {
    check(f.fightT === 0 && f.feetHeld, 'New round resets native hold');
    check(!f.skill.thrust(), 'New round rejects first tap'); tick(restart, f, DT);
    check(f.gun.ammo === 6 && f.gun.shots === 0 && f.gun.pending < 0, 'New round has no previous ammo/shot/pending state');
  }
  report.cases.push({ name: 'fresh-round-restart', indices: [0, 1] });
  report.pass = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  for (const G of fixtures) { G.eventQueue.free(); G.world.free(); }
  Math.random = originalRandom; Object.assign(GUN_HOOKS, originalHooks);
  report.sourceAfter = hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  if (!report.sourceStable) { report.pass = false; report.error = `${report.error ?? ''}\nSource changed during execution`; process.exitCode = 1; }
  report.shots = shots;
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks, physicsSteps: report.physicsSteps, sourceStable: report.sourceStable, out, error: report.error }));
}
