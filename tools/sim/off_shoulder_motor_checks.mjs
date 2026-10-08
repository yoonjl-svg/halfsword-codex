// Run: node tools/sim/off_shoulder_motor_checks.mjs
// Isolated native API and controller-coordinate contracts, not a recovery,
// anatomical range, force-cap, or whole-game outcome validation.
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { driveOffShoulderMotor, sphericalMotorPosition } from '../../src/off_shoulder_motor.js';

const checks = [];
const near = (actual, expected, tolerance = 1e-10) => {
  assert(Number.isFinite(actual), `non-finite actual: ${actual}`);
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
const negated = q => new Quaternion(-q.x, -q.y, -q.z, -q.w);
const rotation = (axis, angle) => new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), angle);
const vectorNear = (actual, expected, tolerance) => actual.forEach((v, i) => near(v, expected[i], tolerance));
function check(name, run) { run(); checks.push(name); }
function fixture({ parent = new Quaternion(), relative = new Quaternion(), target = new Quaternion(), previous } = {}) {
  const calls = [];
  // Rapier rotation() returns a plain object, not a THREE.Quaternion. Preserve
  // that boundary here: passing the native object directly to THREE multiply
  // silently produced NaN in an earlier draft.
  const plain = q => ({ x: q.x, y: q.y, z: q.z, w: q.w });
  const j = { parent: { rotation: () => plain(parent) },
    child: { rotation: () => plain(parent.clone().multiply(relative)) }, target: target.clone(),
    joint: { handle: 42, rawSet: { jointConfigureMotor(...args) {
      assert(args.every(Number.isFinite), `non-finite native request: ${args}`);
      calls.push(args);
    } } } };
  if (previous) j.previousShoulderGoal = previous.clone();
  return { j, calls };
}
function requested(f, invDt = 120, maxErr = .35) {
  driveOffShoulderMotor(f.j, 400, 36, maxErr, invDt);
  const rows = f.calls.slice(-3);
  assert.equal(rows.length, 3);
  rows.forEach((r, i) => { assert.equal(r[1], 3 + i); near(r[4], 400); near(r[5], 36); });
  return { position: rows.map(r => r[2]), velocity: rows.map(r => r[3]) };
}

check('identity and signed single-axis coordinates', () => {
  vectorNear(sphericalMotorPosition(new Quaternion(), new Vector3()).toArray(), [0, 0, 0]);
  for (let axis = 0; axis < 3; axis++) for (const angle of [-2.4, -.1, .1, 2.4]) {
    const unit = [0, 0, 0]; unit[axis] = 1;
    const expected = [0, 0, 0]; expected[axis] = angle;
    vectorNear(sphericalMotorPosition(rotation(unit, angle), new Vector3()).toArray(), expected);
  }
});
check('diagonal coordinates match native API contract and quaternion sign', () => {
  const q = rotation([1, -1, 1], 2.3);
  const expected = [1.1100969690804097, -1.1100969690804097, 1.1100969690804097];
  vectorNear(sphericalMotorPosition(q, new Vector3()).toArray(), expected);
  vectorNear(sphericalMotorPosition(negated(q), new Vector3()).toArray(), expected);
});
check('quaternion sign changes do not command motion', () => {
  const q = rotation([1, 2, -1], 2.5);
  const a = requested(fixture({ relative: q, target: q, previous: q }));
  const b = requested(fixture({ relative: negated(q), target: negated(q), previous: q }));
  vectorNear(a.position, b.position);
  vectorNear(a.velocity, [0, 0, 0]); vectorNear(b.velocity, [0, 0, 0]);
});
check('179 to -179 degrees takes the two-degree motor path', () => {
  const degrees = Math.PI / 180;
  for (const direction of [-1, 1]) {
    const old = rotation([1, 0, 0], direction * 179 * degrees);
    const goal = rotation([1, 0, 0], -direction * 179 * degrees);
    const r = requested(fixture({ relative: old, target: goal, previous: old }));
    near(r.position[0], direction * 181 * degrees);
    near(r.velocity[0], direction * 2 * degrees * 120);
    vectorNear(r.position.slice(1), [0, 0]); vectorNear(r.velocity.slice(1), [0, 0]);
  }
});
check('velocity uses the parent-frame left quaternion difference', () => {
  const previous = rotation([0, 1, 0], 1.1);
  const target = rotation([1, 0, 0], .03).multiply(previous);
  const r = requested(fixture({ relative: previous, target, previous }));
  vectorNear(r.velocity, [3.6, 0, 0]);
  // Multiplying in the opposite order would rotate this x angular velocity by
  // the old child pose; the expected y/z above therefore detect that mistake.
});
check('changing the common world frame leaves relative commands unchanged', () => {
  const relative = rotation([1, -2, 3], 1.2);
  const previous = rotation([1, 1, 0], .7);
  const target = rotation([0, 0, 1], -.025).multiply(previous);
  const a = requested(fixture({ relative, previous, target }));
  const b = requested(fixture({ parent: rotation([2, -1, 1], 2.1), relative, previous, target }));
  vectorNear(a.position, b.position); vectorNear(a.velocity, b.velocity);
});
check('first call and zero time have finite zero velocity, and update history', () => {
  const q = rotation([1, 2, 3], 1.3);
  const first = fixture({ target: q });
  vectorNear(requested(first).velocity, [0, 0, 0]);
  const stopped = fixture({ target: q, previous: rotation([0, 1, 0], -.8) });
  vectorNear(requested(stopped, 0).velocity, [0, 0, 0]);
  stopped.j.target = rotation([0, 0, 1], .02).multiply(q);
  vectorNear(requested(stopped).velocity, [0, 0, 2.4]);
});
check('existing position-error and axis-rate budgets are retained', () => {
  const f = fixture({ target: rotation([1, 0, 0], 1.1), previous: new Quaternion() });
  const r = requested(f);
  vectorNear(r.position, [.35, 0, 0]); vectorNear(r.velocity, [15, 0, 0]);
  // A spring-error bound is not a bound on damping torque, the vector sum of
  // three motors, native limit impulses, or solver-delivered force.
});
check('asin domain clamp prevents f32 component overshoot from producing NaN', () => {
  const result = sphericalMotorPosition({ x: 1 + 1e-7, y: 0, z: 0, w: 0 }, new Vector3());
  vectorNear(result.toArray(), [Math.PI, 0, 0]);
});

await RAPIER.init();
const nativeRows = [];
const goal = rotation([1, -1, 1], 2.3);
for (const [name, worldFrame, legacy] of [
  ['exact-identity-frame', new Quaternion(), false],
  ['exact-rotated-frame', rotation([2, 1, -1], 1.7), false],
  ['legacy-rotvec-negative-control', new Quaternion(), true],
]) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 120;
  try {
    const parent = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation(worldFrame));
    const child = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setRotation(worldFrame)
      .setAdditionalMassProperties(1, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0, w: 1 }));
    const joint = world.createImpulseJoint(RAPIER.JointData.spherical(
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), parent, child, true);
    for (let i = 0; i < 3; i++) joint.rawSet.jointConfigureMotorModel(joint.handle, i + 3, 1);
    const j = { parent, child, joint, target: goal.clone() };
    if (legacy) for (let i = 0; i < 3; i++) joint.rawSet.jointConfigureMotor(
      joint.handle, i + 3, [1, -1, 1][i] * 2.3 / Math.sqrt(3), 0, 100, 20);
    for (let tick = 0; tick < 1200; tick++) {
      if (!legacy) driveOffShoulderMotor(j, 100, 20, .35, 120);
      world.step();
      const q = child.rotation(), w = child.angvel();
      assert([q.x, q.y, q.z, q.w, w.x, w.y, w.z].every(Number.isFinite), `${name} non-finite state ${tick}`);
    }
    const actual = new Quaternion().copy(parent.rotation()).invert()
      .multiply(new Quaternion().copy(child.rotation())).normalize();
    const errorRad = actual.angleTo(goal);
    assert(legacy ? errorRad > .5 : errorRad < .003, `${name}: error ${errorRad}`);
    nativeRows.push({ name, errorRad, finalRelativeQuaternion: actual.toArray() });
    checks.push(name);
  } finally { world.free(); }
}
console.log(JSON.stringify({ passed: checks.length, checks, engineVersion: RAPIER.version(), nativeRows,
  scope: 'Isolated npm spherical motor coordinates, parent-axis target velocity, and finite-state checks. No gameplay or anatomical acceptance.' }, null, 2));
