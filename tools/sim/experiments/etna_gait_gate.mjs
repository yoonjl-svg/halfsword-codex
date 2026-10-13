// Actual game Fighter/Rapier/Combat loop. This observes native support and
// recovery; timed `stand` alone is not accepted as a recovery result.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { newRound, CONFIG, THREE } from '../harness_m.mjs';
import { ETNA_TERRAIN } from '../../../src/etna_ground.js';

const out = process.argv[2] || '/tmp/halfsword-etna-gait.json';
const flatReference = process.argv[3];
assert(out.startsWith('/tmp/'), 'Keep run evidence outside the repository.');
const seed = 73021;
const sources = ['src/fighter.js', 'src/gait.js', 'src/etna_ground.js', 'tools/sim/harness_m.mjs'];
const hashes = () => Object.fromEntries(sources.map(path => [path, createHash('sha256').update(fs.readFileSync(new URL('../../../' + path, import.meta.url))).digest('hex')]));
const before = hashes();
const rows = [], failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const savedRandom = Math.random;
const policy = { gravity: CONFIG.PHYSICS.gravity, assist: CONFIG.GAIT.assist, supportModel: CONFIG.BODY.supportModel, footReaction: CONFIG.BODY.footReaction };

// Match the original pre-edit trace recipe exactly, including its park fixture.
let flatTrace;
{
  const G = newRound({ seed, walls: false });
  try {
    G.park();
    flatTrace = [];
    for (let i = 0; i < 1440; i++) {
      if (i === 780) G.player.knockDown(true);
      G.before = () => G.player.move.set(i < 300 ? 0 : i < 510 ? .5 : 0, i < 300 ? 0 : i < 510 ? .6 : i < 780 ? -.4 : 0);
      G.step();
      if (i % 12 === 0) flatTrace.push({ i, state: G.player.state, h: G.player.gait.h, hNom: G.player.gait.hNom,
        parts: Object.fromEntries(Object.entries(G.player.bodies).map(([k, b]) => [k, { p: b.translation(), v: b.linvel(), q: b.rotation(), w: b.angvel() }])) });
    }
    if (flatReference) check(JSON.stringify(flatTrace) === fs.readFileSync(flatReference, 'utf8').trim(), 'No-terrain native trace differs from the supplied pre-edit baseline.');
  } finally { G.eventQueue.free(); G.world.free(); }
}

// Construction must shift every attached part and its anchor together.
for (const z of [-2, 2]) {
  const flat = newRound({ seed, walls: false, playerZ: z, enemyZ: -20 });
  const hill = newRound({ seed, walls: false, stageId: 'etna', playerZ: z, enemyZ: -20 });
  try {
    const dy = ETNA_TERRAIN.heightAt(-CONFIG.ARENA.startGap / 2, z);
    for (const name of [...Object.keys(flat.player.bodies), 'anchor']) {
      const a = (name === 'anchor' ? flat.player.anchor : flat.player.bodies[name]).translation();
      const b = (name === 'anchor' ? hill.player.anchor : hill.player.bodies[name]).translation();
      check(Math.abs(b.x - a.x) < 1e-6 && Math.abs(b.z - a.z) < 1e-6 && Math.abs(b.y - a.y - dy) < 1e-6, `Spawn offset mismatch at z=${z}, ${name}.`);
    }
  } finally { for (const G of [flat, hill]) { G.eventQueue.free(); G.world.free(); } }
}

const cases = [
  { name: 'idle-high', z: -2, heading: 0, move: [0, 0] },
  { name: 'idle-low', z: 2, heading: 0, move: [0, 0] },
  { name: 'uphill', z: 1, heading: Math.PI / 2, move: [0, .5] },
  { name: 'downhill', z: -2, heading: -Math.PI / 2, move: [0, .5] },
  { name: 'across', z: 0, heading: 0, move: [0, .5] },
  { name: 'side-uphill', z: 1, heading: 0, move: [-.5, 0] },
  { name: 'side-downhill', z: -2, heading: 0, move: [.5, 0] },
  { name: 'shelf-uphill', z: -3.5, heading: Math.PI / 2, move: [0, .5] },
  { name: 'getup-high', z: -2, heading: 0, move: [0, 0], recovery: true },
  { name: 'getup-low', z: 2, heading: 0, move: [0, 0], recovery: true },
];
for (const spec of cases) {
  const G = newRound({ seed, walls: false, stageId: 'etna', playerZ: spec.z, enemyZ: -20, heading: spec.heading });
  // This flag only disables the distant opponent AI; no body is relocated.
  G.parkEnemy = true;
  const f = G.player, terrain = ETNA_TERRAIN, samples = [], transitions = [];
  let previousState = null, start, endMove, firstStand = null, firstGetup = null;
  let supportTicks = 0, measuredTicks = 0, standingTicks = 0, minHeight = Infinity, maxHeight = -Infinity, maxTilt = 0, minSole = Infinity;
  let i = 0;
  G.before = () => {
    f.faceTarget = null;
    f.move.set(...(i < 360 || i >= 720 ? [0, 0] : spec.move));
    if (spec.recovery && i === 360) {
      f.knockDown(true);
      f.bodies.chest.applyImpulse({ x: 55, y: 0, z: 0 }, true);
    }
  };
  try {
    const ticks = spec.recovery ? 1200 : 960;
    for (i = 0; i < ticks; i++) {
      G.step();
      const p = f.bodies.pelvis.translation();
      const h = p.y - terrain.heightAt(p.x, p.z), tilt = f.tiltDeg();
      const load = f.gait.groundForce(f.gait.legs.F) + f.gait.groundForce(f.gait.legs.B);
      if (i === 359) start = { ...p };
      if (i === 719) endMove = { ...p };
      if (f.state !== previousState) { transitions.push({ i, state: f.state, relativePelvisHeight: h }); previousState = f.state; }
      if (spec.recovery && f.state === 'getup' && firstGetup === null) firstGetup = i;
      if (firstGetup !== null && f.state === 'stand' && firstStand === null) firstStand = i;
      const measure = spec.recovery ? i >= 960 : i >= 420;
      if (measure) {
        measuredTicks++;
        if (load > 1) supportTicks++;
        if (f.state === 'stand') standingTicks++;
        minHeight = Math.min(minHeight, h); maxHeight = Math.max(maxHeight, h); maxTilt = Math.max(maxTilt, tilt);
        for (const foot of ['footF', 'footB']) {
          const sole = f.solePoint(foot, new THREE.Vector3());
          minSole = Math.min(minSole, sole.y - terrain.heightAt(sole.x, sole.z));
        }
      }
      if (i % 30 === 0) samples.push({ i, p: { ...p }, relativePelvisHeight: h, state: f.state, tilt, nativeFootSupportN: load, targetHeight: f.gait.h });
      check(Number.isFinite(h) && Number.isFinite(tilt) && f.alive, `${spec.name}: non-finite or dead at tick ${i}.`);
    }
    const end = f.bodies.pelvis.translation();
    const dx = endMove.x - start.x, dz = endMove.z - start.z;
    const intendedX = Math.cos(spec.heading) * spec.move[1] + Math.sin(spec.heading) * spec.move[0];
    const intendedZ = -Math.sin(spec.heading) * spec.move[1] + Math.cos(spec.heading) * spec.move[0];
    const directionLength = Math.hypot(intendedX, intendedZ);
    const progress = directionLength ? (dx * intendedX + dz * intendedZ) / directionLength : 0;
    const supportFraction = supportTicks / measuredTicks, standingFraction = standingTicks / measuredTicks;
    check(supportFraction > .9, `${spec.name}: native foot support fraction ${supportFraction}.`);
    check(standingFraction === 1 && minHeight > .72 && maxHeight < 1.12 && maxTilt < 40, `${spec.name}: posture/support envelope failed.`);
    check(minSole > -.045, `${spec.name}: excessive sole penetration ${minSole}.`);
    if (directionLength) check(progress > (spec.move[0] ? .6 : 2), `${spec.name}: no meaningful requested progress (${progress}m).`);
    if (spec.name.startsWith('idle')) check(Math.abs(end.z - start.z) < .15, `${spec.name}: resting downhill drift exceeds .15m.`);
    if (spec.recovery) check(firstGetup !== null && firstStand !== null && firstStand < 960, `${spec.name}: no physical recovery before the supported final window.`);
    rows.push({ ...spec, progress, start, end: { ...end }, firstGetup, firstStand, supportFraction, standingFraction, minHeight, maxHeight, maxTilt, minSole, transitions, samples });
  } finally { G.eventQueue.free(); G.world.free(); }
}
Math.random = savedRandom;
const after = hashes();
check(JSON.stringify(before) === JSON.stringify(after), 'Production source changed during this run.');
const report = { pass: failures.length === 0, completedUTC: new Date().toISOString(), seed, policy, sources: before, flatReference: flatReference ?? null,
  flatTraceCompared: !!flatReference, flatTraceFrames: flatTrace.length, flatTrace, failures, rows,
  method: 'Production newRound/Fighter/Gait/Combat/Rapier loop, existing input movement; getup uses existing knockDown(true) plus a55Ns chest impulse. No player translations, forced velocities, strength changes, or pose replacements.',
  limitations: ['Headless physics evidence; visual quality and mobile input need separate browser review.', 'No moving combat opponent in these locomotion fixtures; opponent is spawned remotely before simulation.', 'Support load is native contact impulse divided by timestep, used only as presence evidence.'] };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, failures, flatTraceCompared: report.flatTraceCompared, rows: rows.map(({ name, progress, supportFraction, standingFraction, minHeight, maxHeight, maxTilt, firstStand }) => ({ name, progress, supportFraction, standingFraction, minHeight, maxHeight, maxTilt, firstStand })), out }));
if (!report.pass) process.exitCode = 1;
