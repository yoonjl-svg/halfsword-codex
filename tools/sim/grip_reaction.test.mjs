// Actual offHand controller + native Rapier, with all other actuators/contacts absent.
// These engineering fixtures test conservation, not human grip realism.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { RAPIER, THREE, CONFIG, DT, newRound } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';
import { configurePhysicalTrial } from '../../src/physical_trial.js';

const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const snapshot = bodies => {
  const p = new THREE.Vector3(), L = new THREE.Vector3();
  let K = 0;
  for (const b of bodies) {
    const momentum = V(b.linvel()).multiplyScalar(b.mass());
    p.add(momentum);
    const frame = Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame()));
    const omega = V(b.angvel()).applyQuaternion(frame.clone().invert());
    const I = b.principalInertia();
    const spin = new THREE.Vector3(I.x * omega.x, I.y * omega.y, I.z * omega.z);
    K += 0.5 * b.mass() * V(b.linvel()).lengthSq() + 0.5 * spin.dot(omega);
    L.add(V(b.worldCom()).cross(momentum)).add(spin.applyQuaternion(frame));
  }
  return { p, L, K };
};

function fixture(model, motion, angle = 0, offset = new THREE.Vector3(), dt = DT) {
  const saved = { ...CONFIG.GRIP };
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = dt;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  const transform = v => v.clone().applyQuaternion(rotation).add(offset);
  const bodies = [], applications = [];
  try {
    Object.assign(CONFIG.GRIP, { on: true, reactionModel: model });
    for (const [position, mass] of [[new THREE.Vector3(0, 0.135, 0), 1], [new THREE.Vector3(0.04, 0.14, 0), 2]]) {
      const pos = transform(position);
      const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(rotation).setCanSleep(false));
      world.createCollider(RAPIER.ColliderDesc.ball(0.3).setMass(mass).setCollisionGroups(0), b);
      b.recomputeMassPropertiesFromColliders();
      bodies.push(b);
      const original = b.addForceAtPoint.bind(b);
      b.addForceAtPoint = (force, point, wake) => {
        applications.push({ force: V(force), point: V(point), velocity: V(b.velocityAtPoint(point)) });
        return original(force, point, wake);
      };
    }
    const [handBody, sword] = bodies;
    if (motion === 'rigid_rotation') {
      const omega = new THREE.Vector3(0, 0, 4).applyQuaternion(rotation);
      for (const b of bodies) {
        b.setAngvel(omega, true);
        b.setLinvel(omega.clone().cross(V(b.worldCom()).sub(offset)), true);
      }
    } else {
      sword.setLinvel(new THREE.Vector3(0, motion === 'tangential' ? 1 : 0, 0).add(new THREE.Vector3(motion === 'radial' ? 1 : 0, 0, 0)).applyQuaternion(rotation), true);
    }
    const f = { armed: true, weaponCfg: { twoHand: true, gripAlong: -0.14 }, state: 'stand', muscle: 1,
      limbs: { armO: 1 }, sword, bodies: { farmO: handBody }, aimDirW: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
      offArmIK() {} };
    const before = snapshot(bodies);
    Fighter.prototype.offHand.call(f);
    assert.equal(f.gripping, true);
    assert.equal(applications.length, 2);
    const netF = new THREE.Vector3(), netT = new THREE.Vector3();
    let power = 0;
    for (const a of applications) {
      netF.add(a.force); netT.add(a.point.clone().sub(offset).cross(a.force));
      power += a.force.dot(a.velocity);
      assert.ok(a.force.length() <= CONFIG.GRIP.maxForce + 1e-8);
    }
    assert.ok(netF.length() < 1e-10);
    if (model === 'paired') {
      assert.ok(netT.length() < 1e-10, 'internal grip must not apply a net torque');
      if (motion === 'rigid_rotation') assert.ok(Math.abs(power) < 1e-4, 'rigid co-rotation must not be damped');
      if (motion === 'tangential') assert.ok(power < -49.99 && power > -50.01, 'relative slip should still dissipate energy');
    }
    world.step();
    const after = snapshot(bodies);
    const row = { model, motion, timestepS: dt, angleRad: angle, originOffsetM: offset.toArray(),
      netForceN: netF.toArray(), netTorqueNm: netT.toArray(), instantaneousPowerW: power,
      deltaMomentumNs: after.p.clone().sub(before.p).toArray(), deltaAngularMomentumNms: after.L.clone().sub(before.L).toArray(),
      torqueImpulseNmS: netT.clone().multiplyScalar(dt).toArray(), deltaKJ: after.K - before.K,
      forceApplications: applications.map(a => ({ forceN: a.force.toArray(), pointM: a.point.toArray() })) };
    assert.ok(after.p.clone().sub(before.p).length() < 1e-5, 'native linear momentum conservation');
    assert.ok(Number.isFinite(after.K));
    return row;
  } finally { Object.assign(CONFIG.GRIP, saved); world.free(); }
}

const options = { reactionModel: 'legacy' };
const bodyOptions = { supportModel: 'axial' };
for (const query of ['', 'physicsTrial=wrong', 'physicsTrial=paired', 'gripReaction=paired']) {
  assert.equal(configurePhysicalTrial(new URLSearchParams(query), options, bodyOptions).active, false);
  assert.equal(options.reactionModel, 'paired');
  assert.equal(bodyOptions.supportModel, 'legacy');
}
assert.equal(configurePhysicalTrial(new URLSearchParams('physicsTrial=grip'), options, bodyOptions).gripReaction, 'paired');
assert.equal(configurePhysicalTrial(new URLSearchParams('physicsTrial=legacyGrip'), options, bodyOptions).gripReaction, 'legacy');
assert.equal(configurePhysicalTrial(new URLSearchParams('physicsTrial=support'), options, bodyOptions).supportModel, 'axial');
assert.equal(options.reactionModel, 'paired');
assert.equal(configurePhysicalTrial(new URLSearchParams(), options, bodyOptions).gripReaction, 'paired');
assert.equal(bodyOptions.supportModel, 'legacy');

const rows = [];
for (const motion of ['rigid_rotation', 'tangential', 'radial']) for (const model of ['legacy', 'paired']) rows.push(fixture(model, motion));
for (const angle of [0.7, -1.1]) for (const model of ['legacy', 'paired']) rows.push(fixture(model, 'rigid_rotation', angle, new THREE.Vector3(2, 1, -3)));
assert.ok(Math.hypot(...rows[0].netTorqueNm) > 0.3, 'legacy defect must be reproduced');
// Explicit spring integration can leave an O(dt²) angular-momentum residual.
// Zero applied net torque is not a claim of exact finite-step solver conservation.
const coarse = rows.find(r => r.model === 'paired' && r.motion === 'tangential');
const half = fixture('paired', 'tangential', 0, new THREE.Vector3(), DT / 2);
const quarter = fixture('paired', 'tangential', 0, new THREE.Vector3(), DT / 4);
assert.ok(Math.hypot(...half.deltaAngularMomentumNms) < Math.hypot(...coarse.deltaAngularMomentumNms) * 0.3);
assert.ok(Math.hypot(...quarter.deltaAngularMomentumNms) < Math.hypot(...half.deltaAngularMomentumNms) * 0.3);
rows.push(half, quarter);

// One-handed weapons and a lost off-hand cannot engage either trial model.
const saved = CONFIG.GRIP.reactionModel;
for (const weapon of ['falchion', 'longsword']) {
  const G = newRound({ seed: 7, walls: false, weapon });
  try {
    CONFIG.GRIP.reactionModel = 'paired';
    const f = G.player;
    if (weapon === 'longsword') f.limbs.armO = 0;
    f.offHand(); assert.equal(f.gripping, false);
  } finally { CONFIG.GRIP.reactionModel = saved; G.eventQueue.free(); G.world.free(); }
}

const result = { pass: true, fixtures: rows.length, dt: DT,
  scope: 'Native two-body fixtures using actual Fighter.offHand with IK omitted. Zero gravity, no contacts, no other actuators. No human grip validation. Native delta K includes spring response and integration effects; instantaneous power is measured separately. Zero applied net torque does not mean zero finite-step angular-momentum residual: dt-halving convergence is checked.', rows };
await writeFile(process.argv[2] || '/tmp/grip-reaction-fixtures.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, fixtures: rows.length, legacyRigidRotationTorqueNm: rows[0].netTorqueNm, pairedRigidRotationTorqueNm: rows[1].netTorqueNm, legacyPowerW: rows[0].instantaneousPowerW, pairedPowerW: rows[1].instantaneousPowerW }));
