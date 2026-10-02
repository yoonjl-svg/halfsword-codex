import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { createHash } from 'node:crypto';
import { configureUprightMotor, createUprightMotorState } from './upright_motor_candidate.mjs';

await RAPIER.init();
const DT = 1 / 120, AXES = [3, 4, 5];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requests = active => AXES.map(axis => ({ axis, target: 0,
  stiffness: active.includes(axis) ? 2500 : 0, damping: active.includes(axis) ? 330 : 0 }));
function fixture({kinematic = false} = {}) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  const anchor = world.createRigidBody(kinematic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed());
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false)
    .setRotation({ x: Math.sin(.4), y: 0, z: 0, w: Math.cos(.4) })
    .setLinvel(.3, -.2, .1).setAngvel({ x: 2, y: -.7, z: .5 }));
  world.createCollider(RAPIER.ColliderDesc.cuboid(.2, .2, .2).setMass(2), body);
  const createJoint = () => world.createImpulseJoint(RAPIER.JointData.generic(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0), anchor, body, true);
  const state = createUprightMotorState({ world, createJoint, joint: createJoint() });
  return { world, anchor, body, createJoint, state };
}
function physical(body) {
  const v = value => ({ x: value.x, y: value.y, z: value.z });
  const q = body.rotation();
  return { p: v(body.translation()), q: { ...v(q), w: q.w }, v: v(body.linvel()), w: v(body.angvel()),
    mass: body.mass(), inertia: v(body.principalInertia()) };
}
const angularSpeed = body => Math.hypot(...Object.values(physical(body).w));
function restore(snapshot, handles) {
  const world = RAPIER.World.restoreSnapshot(snapshot);
  const body = world.getRigidBody(handles.body), anchor = world.getRigidBody(handles.anchor);
  const createJoint = () => world.createImpulseJoint(RAPIER.JointData.generic(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0), anchor, body, true);
  return { world, body, anchor, createJoint, joint: world.getImpulseJoint(handles.joint) };
}

const results = [];
{
  const f = fixture({kinematic:true});
  configureUprightMotor(f.state, requests(AXES));
  for(let step=0;step<6;step++)f.world.step();
  configureUprightMotor(f.state, requests([]));
  const omega=angularSpeed(f.body),before=physical(f.body);
  for(let step=1;step<=120;step++){
    const t=step*DT;
    f.anchor.setNextKinematicTranslation({x:3*t,y:t,z:-t});
    f.anchor.setNextKinematicRotation({x:0,y:Math.sin(t),z:0,w:Math.cos(t)});
    f.world.step();
  }
  assert.ok(Math.abs(angularSpeed(f.body)-omega)<1e-6,'off cannot inherit moving anchor rotation');
  for(const axis of ['x','y','z'])assert.ok(Math.abs(f.body.translation()[axis]-(before.p[axis]+before.v[axis]))<1e-5,'off remains translationally free');
  results.push({test:'off with translating and rotating kinematic anchor',freeAngularSpeedRadS:omega,finalAngularSpeedRadS:angularSpeed(f.body)});
  f.world.free();
}
{
  const f = fixture();
  configureUprightMotor(f.state, requests(AXES));
  const originalJoint = f.state.joint;
  const result = configureUprightMotor(f.state, requests(AXES));
  assert.equal(result, originalJoint, 'positive requests preserve the existing native joint');
  for (let step = 0; step < 6; step++) f.world.step();
  const before = physical(f.body), omega = angularSpeed(f.body);
  assert.equal(configureUprightMotor(f.state, requests([])), null);
  assert.equal(f.world.impulseJoints.len(), 0);
  assert.equal(originalJoint.isValid(), false);
  assert.deepEqual(physical(f.body), before, 'off does not directly mutate physical state');
  for (let step = 0; step < 120; step++) f.world.step();
  assert.ok(Math.abs(angularSpeed(f.body) - omega) < 1e-6, 'off permits free rotation');
  configureUprightMotor(f.state, requests(AXES));
  assert.equal(f.world.impulseJoints.len(), 1);
  for (let step = 0; step < 360; step++) f.world.step();
  assert.ok(angularSpeed(f.body) < .001, 'positive motors restore control');
  assert.ok(Math.abs(f.body.rotation().w) > .999, 'positive motor tracks the upright target');
  results.push({ test: 'moving off and back on', freeAngularSpeedRadS: omega,
    controlledAngularSpeedRadS: angularSpeed(f.body) });
  f.world.free();
}
{
  const f = fixture();
  configureUprightMotor(f.state, requests(AXES));
  const oldJoint = f.state.joint;
  const before = physical(f.body);
  configureUprightMotor(f.state, requests([4, 5]));
  assert.equal(oldJoint.isValid(), false);
  assert.deepEqual(physical(f.body), before);
  assert.equal(f.state.activeAxisMask, (1 << 4) | (1 << 5));
  assert.equal(f.world.impulseJoints.len(), 1);
  // Free x-axis rotation is not stopped by a zero-coefficient motor;
  // positive y/z motors remain active on this same newly created joint.
  f.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  f.body.setAngvel({ x: 2, y: 0, z: 0 }, true);
  for (let step = 0; step < 60; step++) f.world.step();
  assert.ok(Math.abs(f.body.angvel().x - 2) < 1e-5);
  f.body.setRotation({ x: 0, y: Math.sin(.25), z: 0, w: Math.cos(.25) }, true);
  f.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  f.world.step();
  assert.ok(Math.abs(f.body.angvel().y) > .1, 'surviving y motor supplies real control');
  results.push({ test: 'partial axis off', survivingYResponseRadS: f.body.angvel().y });
  f.world.free();
}
{
  const f = fixture();
  let maximumJointCount = 0;
  for (let cycle = 0; cycle < 50; cycle++) {
    for (const axes of [AXES, [3, 5], [], [4], AXES, []]) {
      configureUprightMotor(f.state, requests(axes));
      assert.equal(f.world.impulseJoints.len(), axes.length ? 1 : 0);
      assert.equal(f.state.activeAxisMask, axes.reduce((mask, axis) => mask | (1 << axis), 0));
      maximumJointCount = Math.max(maximumJointCount, f.world.impulseJoints.len());
      f.world.step();
    }
  }
  results.push({ test: '50 activation cycles', maximumJointCount });
  f.world.free();
}
{
  const f = fixture(), snapshot = f.world.takeSnapshot();
  const handles = { body: f.body.handle, anchor: f.anchor.handle, joint: f.state.joint.handle };
  const baseline = restore(snapshot, handles), candidate = restore(snapshot, handles);
  const state = createUprightMotorState({ ...candidate, activeAxes: [] });
  for (const axis of AXES) baseline.joint.rawSet.jointConfigureMotorModel(baseline.joint.handle, axis, 1);
  const initialExact = hash(physical(baseline.body)) === hash(physical(candidate.body));
  assert.ok(initialExact);
  const trace = [];
  for (let step = 0; step < 360; step++) {
    const request = AXES.map(axis => ({ axis, target: .1 * Math.sin(step * DT * 2 + axis),
      stiffness: 2500 * (.5 + .5 * Math.cos(step * DT)), damping: 330 }));
    for (const r of request) baseline.joint.rawSet.jointConfigureMotorPosition(
      baseline.joint.handle, r.axis, r.target, r.stiffness, r.damping);
    configureUprightMotor(state, request);
    baseline.world.step(); candidate.world.step();
    assert.deepEqual(physical(candidate.body), physical(baseline.body), 'positive baseline trace must be exact');
    trace.push(physical(candidate.body));
  }
  results.push({ test: '360-step positive baseline', initialExact, traceExact: true, traceSha256: hash(trace) });
  baseline.world.free(); candidate.world.free(); f.world.free();
}
{
  const f = fixture(), before = physical(f.body), joint = f.state.joint;
  assert.throws(() => configureUprightMotor(f.state, requests([3]).map(r => ({ ...r, damping: NaN }))), /finite/);
  assert.equal(f.state.joint, joint);
  assert.deepEqual(physical(f.body), before);
  assert.equal(f.world.impulseJoints.len(), 1);
  // A damping-only positive motor is active, rather than treated as off.
  const dampingOnly = requests([]); dampingOnly[0].damping = 1;
  configureUprightMotor(f.state, dampingOnly);
  assert.equal(f.state.activeAxisMask, 1 << 3);
  results.push({ test: 'validation is atomic; damping-only axis stays active' });
  f.world.free();
}
console.log(JSON.stringify({ probe: 'upright_motor_candidate', timestepS: DT,
  scope: 'Native generic motor lifecycle; no game core changes or recovery acceptance claimed.', results }));
