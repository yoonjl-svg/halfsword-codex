// Exercise real harness boundaries and terrain with moving bodies in the newly
// opened annulus. No combat/motion coefficients are overridden.
import assert from 'node:assert/strict';
import { newRound, RAPIER, CONFIG } from './jelly_harness.mjs';
import { ETNA, etnaHeight, etnaNormal } from '../../src/etna_ground.js';
import { WETLAND_PUDDLES, wetlandWetness, wetlandIslandRadius } from '../../src/wetland_ground.js';
const { ARENA, ARENA_SCALE } = CONFIG;
assert.ok(Math.abs((ARENA.radius / 6.5) ** 2 - 2) < 1e-12);
assert.equal(ARENA.startGap, 5.6);
assert.equal(ETNA.degrees, 10);
assert.ok(Math.abs(ETNA.lavaEdgeZ / ARENA.radius - 5.25 / 6.5) < 1e-12);
const results = [];
for (const stageId of ['castle', 'etna']) {
  const g = newRound({ stageId });
  const remove = [];
  g.world.bodies.forEach(b => { if (!b.isFixed()) remove.push(b); });
  for (const b of remove) g.world.removeRigidBody(b);
  const height = stageId === 'etna' ? etnaHeight : () => 0;
  const balls = [];
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, x = Math.cos(a), z = Math.sin(a);
    const body = g.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x * 7.8, height(x * 7.8, z * 7.8) + 0.25, z * 7.8).setCcdEnabled(true));
    g.world.createCollider(RAPIER.ColliderDesc.ball(0.2).setFriction(0), body);
    balls.push({ body, x, z });
  }
  for (let n = 0; n < 360; n++) {
    for (const { body, x, z } of balls) body.setLinvel({ x: x * 2, y: body.linvel().y, z: z * 2 }, true);
    g.world.step();
  }
  const distances = balls.map(({ body }) => {
    const p = body.translation(), r = Math.hypot(p.x, p.z);
    assert.ok(r > 8.8 && r < ARENA.radius + 0.15, `${stageId}: wall containment ${r}`);
    assert.ok(Math.abs(p.y - height(p.x, p.z) - 0.2) < 0.09, `${stageId}: floor support ${JSON.stringify(p)}`);
    return r;
  });
  results.push({ stageId, bodies: balls.length, minRadius: Math.min(...distances), maxRadius: Math.max(...distances) });
  g.world.free();
  g.eventQueue?.free();
}
// The visible volcanic shore is the same plane as the sensor/height contract.
for (let x = -9; x <= 9; x += 0.25) {
  assert.ok(Math.abs(etnaHeight(x, ETNA.lavaEdgeZ) - ETNA.lavaLevel) < 1e-6);
  const n = etnaNormal(x, 0);
  assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-6);
}
for (let i = 0; i < 360; i++) assert.ok(wetlandIslandRadius(i * Math.PI / 180) > ARENA.radius + 1);
for (const p of WETLAND_PUDDLES) assert.equal(wetlandWetness(p.x, p.z), 1);
assert.ok(Math.abs(WETLAND_PUDDLES[0].rx * WETLAND_PUDDLES[0].rz / (2 * 1.1) - 2) < 1e-12);
console.log(JSON.stringify({ pass: true, areaScale: ARENA_SCALE ** 2, radius: ARENA.radius, startGap: ARENA.startGap, movingBodies: results, shorelineSamples: 73, islandSamples: 360, puddles: WETLAND_PUDDLES.length }, null, 2));
