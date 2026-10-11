import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGrowthStrength } from '../../src/account/growth-model.js';
import { newRound } from '../sim/harness_m.mjs';

const snapshot = (strength, rules) => ({
  characters: { player: { strength } },
  ...(rules ? { rules } : {}),
});

function dispose(round) {
  round.eventQueue.free();
  round.world.free();
}

test('growth assigns bounded strength to a real player without compounding or changing the enemy', () => {
  const round = newRound({ seed: 301, weapon: 'longsword' });
  try {
    const enemyStrength = round.enemy.strength;
    applyGrowthStrength(round.player, snapshot(5));
    assert.equal(round.player.strength, 1.10);
    applyGrowthStrength(round.player, snapshot(5));
    assert.equal(round.player.strength, 1.10);
    applyGrowthStrength(round.player, snapshot(0));
    assert.equal(round.player.strength, 1);
    for (const value of [undefined, null, {}, ...[NaN, Infinity, -1, 100, 1.5, '5'].map(value => snapshot(value))]) {
      applyGrowthStrength(round.player, snapshot(5));
      applyGrowthStrength(round.player, value);
      assert.equal(round.player.strength, 1);
    }
    applyGrowthStrength(round.player, snapshot(5, { strengthStep: 2, strengthCap: 100 }));
    assert.equal(round.player.strength, 1.10);
    assert.equal(round.enemy.strength, enemyStrength);
  } finally {
    dispose(round);
  }
});

test('growth reaches actual shove forces and remains finite through 240 Rapier steps per level', (t) => {
  const forces = [];
  for (const level of [0, 5]) {
    // The player receives scripted input, never AI2Class: AI would replace strength.
    const round = newRound({ seed: 301, weapon: 'longsword', gap: 0.5 });
    try {
      const strength = 1 + 0.02 * level;
      const enemyStrength = round.enemy.strength;
      applyGrowthStrength(round.player, snapshot(level));
      assert.equal(round.player.strength, strength);
      round.player.foe = round.enemy;
      round.player.move.set(0, -1);
      round.player.shove();
      const force = round.enemy.bodies.chest.userForce();
      forces.push(Math.hypot(force.x, force.y, force.z));

      round.before = () => {
        round.player.handOffset.set(0.2 * Math.sin(round.t * 3), 0.1 * Math.cos(round.t * 2));
        round.player.move.set(0, 0);
      };
      for (let step = 0; step < 240; step++) {
        round.step();
        round.world.forEachRigidBody((body) => {
          for (const vector of [body.translation(), body.rotation(), body.linvel(), body.angvel()]) {
            assert.ok(Object.values(vector).every(Number.isFinite), `level ${level}, step ${step}, body ${body.handle}`);
          }
        });
      }
      assert.equal(round.player.strength, strength);
      assert.equal(round.enemy.strength, enemyStrength);
    } finally {
      dispose(round);
    }
  }
  assert.deepEqual(forces, [320, 352]);
  assert.equal(forces[1] / forces[0], 1.10);
  t.diagnostic(JSON.stringify({ levels: [0, 5], stepsPerLevel: 240, shoveForces: forces, ratio: forces[1] / forces[0], finite: true }));
});
