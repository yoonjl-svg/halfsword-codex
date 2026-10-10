// Actual character binding/AI, then an explicitly controlled six-shot timer fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { newRound, CONFIG } from '../harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { GUN, updateGun } from '../../../src/gun.js';
const out = process.argv[2]; assert(out && path.isAbsolute(out) && !fs.existsSync(out));
const files = ['src/characters_expansion.js', 'src/gun.js', 'src/ai.js', 'src/fighter.js', 'src/skill.js', 'src/config.js'];
const hashes = () => Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before = hashes(), c = CHARACTERS_BY_ID.crown_boss;
assert.equal(c.weapon, 'pistol');
const fresh = () => newRound({ seed: 83, weapon: 'longsword', weapon2: c.weapon, look2: c.look, persona: c.ai.persona, difficulty: c.ai.level, gap: 4, walls: false });
const dispose = g => { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); };
const natural = fresh(); let observed;
try {
  for (let i = 0; i < 960; i++) natural.step();
  const f = natural.enemy;
  assert(f.weapon.gun && f.gun.shots > 0 && natural.ai.gunT > 0, 'Character uses production gun AI and actually fires');
  assert(natural.world.bodies.getAll().every(b => [b.translation(), b.rotation(), b.linvel(), b.angvel()].every(v => Object.values(v).every(Number.isFinite))));
  observed = { steps: 960, seconds: natural.t, shots: f.gun.shots, hits: f.gun.hits, ammo: f.gun.ammo, gunAISeconds: natural.ai.gunT, finite: true };
} finally { dispose(natural); }
const cycle = fresh(); let controlled;
try {
  const f = cycle.enemy; f.foe = cycle.player; cycle.player.foe = f;
  f.fightT = CONFIG.ARENA.startHold;
  const tick = dt => updateGun(f, cycle.world, cycle.combat, dt);
  for (let round = 1; round <= 6; round++) {
    assert(f.skill.thrust()); tick(0);
    assert.equal(f.gun.shots, round); assert.equal(f.gun.ammo, 6 - round);
    assert(!f.skill.thrust());
    tick((round < 6 ? GUN.cooldown : GUN.reload) - 1e-5);
    assert(!f.skill.thrust()); tick(2e-5);
  }
  assert.equal(f.gun.ammo, 6); assert.equal(f.gun.reloading, false);
  assert(f.skill.thrust()); tick(0); assert.equal(f.gun.shots, 7); assert.equal(f.gun.ammo, 5);
  controlled = { shots: 7, ammo: 5, cooldown: GUN.cooldown, reload: GUN.reload, energy: GUN.energy, rounds: GUN.rounds };
  assert.deepEqual([GUN.cooldown, GUN.reload, GUN.energy, GUN.rounds], [.8, 8, 80, 6]);
} finally { dispose(cycle); }
assert.deepEqual(hashes(), before);
const report = { pass: true, observed, controlled, sourceHashes: before, sourceStable: true,
  limits: ['Natural sample is one bounded actual-game AI run against a passive opponent; not a win-rate benchmark.', 'Reload fixture deliberately advances fight time and gun timers; not natural combat or animation evidence.'] };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, observed, controlled }));
