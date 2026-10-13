import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newRound } from '../harness_m.mjs';
import { GAIT } from '../../../src/config.js';

const out = process.argv[2];
assert(out?.startsWith('/tmp/'), 'Provide a fresh /tmp/ report path');
assert(!fs.existsSync(out), 'Do not overwrite earlier evidence');
const report = { pass: false, checks: [], runs: [], failure: null };
const check = (name, value) => { assert(value, name); report.checks.push(name); };
const close = g => { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); };
const desiredZ = f => (f.move.x * GAIT.sideFactor * Math.cos(f.heading)
  - f.move.y * (f.move.y < 0 ? GAIT.backFactor : 1) * Math.sin(f.heading)) * GAIT.moveSpeed;

try {
  // A passive disarmed opponent downhill gives the real combat AI a reason to
  // approach. Observers sample existing input; they add no steering or forces.
  const g = newRound({ seed: 251, stageId: 'etna', playerZ: 4.4, enemyZ: 3.2,
    gap: 2.5, heading: Math.PI / 2, heading2: -Math.PI / 2 });
  try {
    g.player.dropSword();
    let redirects = 0, before = 0, active = false, maxZ = -Infinity, minZ = Infinity;
    const updateCombat = g.ai.updateCombat.bind(g.ai);
    g.ai.updateCombat = dt => {
      updateCombat(dt);
      before = desiredZ(g.enemy);
      active = g.enemy.alive && g.enemy.state === 'stand' && !g.enemy.feetHeld;
    };
    g.before = () => { if (active && before > 0.01 && desiredZ(g.enemy) < -0.01) redirects++; };
    for (let i = 0; i < 720; i++) {
      g.step();
      const p = g.enemy.bodies.pelvis.translation();
      assert(Object.values(p).every(Number.isFinite));
      maxZ = Math.max(maxZ, p.z); minZ = Math.min(minZ, p.z);
    }
    report.runs.push({ kind: 'native AI approach', seed: 251, steps: 720, seconds: g.t,
      redirects, minZ, maxZ, state: g.enemy.state, death: g.enemy.terrainDeath ?? null });
    check('Real AI reverses at least one downhill approach request', redirects > 0);
    check('Unforced AI remains alive outside lava', g.enemy.alive && !g.enemy.terrainDeath && maxZ < 5.25);
  } finally { close(g); }

  // Controlled external impulse tests the boundary contract, not the force of a
  // particular combat move. Normal AI, locomotion, collisions and hazard remain.
  const pushed = newRound({ seed: 251, stageId: 'etna', playerZ: 0, enemyZ: 3.6,
    gap: 2.5, heading2: Math.PI / 2 });
  try {
    let impulseApplied = false, before = null, deathAt = null, maxZ = -Infinity;
    pushed.before = () => {
      if (impulseApplied || pushed.t < 2.1) return;
      impulseApplied = true;
      before = { state: pushed.enemy.state, z: pushed.enemy.bodies.pelvis.translation().z };
      for (const body of new Set([...Object.values(pushed.enemy.bodies), pushed.enemy.sword])) {
        body.applyImpulse({ x: 0, y: 0, z: body.mass() * 7 }, true);
      }
    };
    for (let i = 0; i < 720; i++) {
      pushed.step();
      maxZ = Math.max(maxZ, pushed.enemy.bodies.pelvis.translation().z);
      if (pushed.enemy.terrainDeath) { deathAt = pushed.t; break; }
    }
    report.runs.push({ kind: 'native external downhill impulse', seed: 251,
      deltaVelocity: 7, before, maxZ, deathAt, death: pushed.enemy.terrainDeath ?? null });
    check('External impulse begins with a standing live AI', impulseApplied && before.state === 'stand');
    check('Physical downhill impulse can cross the lava edge despite AI avoidance', maxZ > 5.25);
    check('Physical body lava contact still kills the AI', !pushed.enemy.alive && !!pushed.enemy.terrainDeath);
  } finally { close(pushed); }
  report.pass = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
}
report.sources = Object.fromEntries(['src/ai.js', 'src/terrain_navigation.js', 'src/etna_ground.js',
  'src/fighter.js', 'src/gait.js', 'tools/sim/harness_m.mjs', 'tools/sim/experiments/etna_ai_gate.mjs']
  .map(path => [path, createHash('sha256').update(fs.readFileSync(path)).digest('hex')]));
report.completedUTC = new Date().toISOString();
report.limits = ['One seed and one passive disarmed opponent, not a general survival guarantee or match balance study.',
  'The shove is a controlled distributed native impulse, not a measured combat move.', 'No rendering or browser checks.'];
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, runs: report.runs, failure: report.failure?.message }));
