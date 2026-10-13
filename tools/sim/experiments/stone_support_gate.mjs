// Real Rapier manifolds through the game's actual Gait.groundForce method.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import RAPIER from '../../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import { Gait } from '../../../src/gait.js';

await RAPIER.init();
const DT = 1 / 120;
const out = process.argv[2] || '/tmp/halfsword-stone-support.json';
assert(out.startsWith('/tmp/'), 'Write evidence outside the repository.');
const cases = [
  { name: 'horizontal-floor', normal: { x: 0, y: 1, z: 0 }, half: [1, .5, 1], expectedUp: 1 },
  { name: 'vertical-wall', normal: { x: 1, y: 0, z: 0 }, half: [.5, 1, 1], expectedUp: 0 },
  { name: 'downward-ceiling', normal: { x: 0, y: -1, z: 0 }, half: [1, .5, 1], expectedUp: 0 },
];
const rows = [];
let failure = null;
try {
  for (const spec of cases) for (const groundFirst of [true, false]) {
    const n = spec.normal;
    const world = new RAPIER.World({ x: -9.81 * n.x, y: -9.81 * n.y, z: 0 });
    world.timestep = DT;
    world.integrationParameters.numSolverIterations = 6;
    let body, own, ground;
    const addGround = () => {
      const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-.5 * n.x, -.5 * n.y, 0));
      ground = world.createCollider(RAPIER.ColliderDesc.cuboid(...spec.half).setFriction(0), fixed);
    };
    const addFoot = () => {
      body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(.1 * n.x, .1 * n.y, 0));
      own = world.createCollider(RAPIER.ColliderDesc.ball(.1).setMass(2).setFriction(0), body);
    };
    try {
      if (groundFirst) { addGround(); addFoot(); } else { addFoot(); addGround(); }
      for (let tick = 0; tick < 30; tick++) world.step();
      const manifolds = [];
      let legacyImpulse = 0;
      world.contactPair(own, ground, (m, flipped) => {
        const raw = m.normal(), sign = flipped ? 1 : -1;
        let impulse = 0;
        for (let i = 0; i < m.numContacts(); i++) impulse += m.contactImpulse(i);
        legacyImpulse += impulse;
        manifolds.push({ flipped, normalTowardFoot: { x: raw.x * sign, y: raw.y * sign, z: raw.z * sign }, impulse });
      });
      assert(manifolds.length > 0, 'Must exercise an actual native contact manifold.');
      assert(legacyImpulse > 0, 'Must exercise a loaded contact, including horizontal wall impulse.');
      assert(manifolds.every(m => m.flipped === groundFirst), 'Both native manifold orders must be exercised.');
      assert(manifolds.every(m => Math.abs(m.normalTowardFoot.y - n.y) < 1e-7));
      const fighter = { world, bodies: { footF: body }, lastDt: DT };
      const forceN = Gait.prototype.groundForce.call({ f: fighter }, { foot: 'footF' });
      const legacyForceN = legacyImpulse / DT;
      assert.equal(forceN, legacyForceN * spec.expectedUp, 'Floor load stays exactly equal; side/downward load is zero.');
      rows.push({ name: spec.name, groundFirst, forceN, legacyForceN, manifolds });
    } finally {
      world.free();
    }
  }
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
}
const sources = Object.fromEntries(['src/gait.js', 'tools/sim/experiments/stone_support_gate.mjs'].map(path => [path,
  createHash('sha256').update(fs.readFileSync(new URL('../../../' + path, import.meta.url))).digest('hex')]));
const result = { pass: !failure, completedUTC: new Date().toISOString(), method: 'Actual native Rapier contacts, 30 steps at 120 Hz per fixture; production Gait.groundForce, both collider orders. No impulse calibration or controller substitution.', failure, sources, rows };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: result.pass, failure: failure?.message, rows: rows.map(({ name, groundFirst, forceN, legacyForceN }) => ({ name, groundFirst, forceN, legacyForceN })), out }));
