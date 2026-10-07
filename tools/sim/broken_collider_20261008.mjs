// Controlled native API diagnosis. This is not a natural combat or balance test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PHYSICS } from '../../src/config.js';
import { Fighter } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { tryRevive, reviveTick } from '../../src/revive.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const mode = process.argv.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'api';
if (!out || fs.existsSync(out)) throw new Error('Supply --out=FRESH_DIRECTORY');
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const sourcePaths = ['src/fighter.js', 'src/revive.js', 'src/config.js', 'src/weapons.js',
  'tools/sim/broken_collider_20261008.mjs', 'package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/package.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const hashes = () => Object.fromEntries(sourcePaths.map((p) => [p, sha(fs.readFileSync(path.join(repo, p)))]));
const result = {
  kind: 'broken_collider_native_diagnosis', mode, createdUTC: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  command: [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)],
  sourceBefore: hashes(), rows: [], nativeSteps: 0,
  limits: [
    'Controlled primitive contact fixtures, not natural weapon breakage or gameplay.',
    'Native contact manifolds and cached contact impulses alone are not proof of a current physical response.',
    'Horizontal delta-v and current force events supply independent response observations; dynamic-owner fixtures record both velocities.',
    'World gravity and timestep use current game values. There are no game source or physics-parameter edits.',
  ],
};
const vec = (v) => ({ x: v.x, y: v.y, z: v.z });
const DT = PHYSICS.timestep;
const GROUPS = 0xffffffff;

function contacts(world, a, b) {
  const found = [];
  world.contactPair(a, b, (m, flipped) => {
    const values = [];
    for (let k = 0; k < m.numContacts(); k++) values.push({ distance: m.contactDist(k), impulse: m.contactImpulse(k),
      tangentX: m.contactTangentImpulseX(k), tangentY: m.contactTangentImpulseY(k) });
    found.push({ flipped, contacts: values, solverContacts: m.numSolverContacts() });
  });
  return found;
}
function apiFixture(condition, fixture) {
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = DT;
  world.integrationParameters.numSolverIterations = 6;
  const queue = new RAPIER.EventQueue(true);
  const wallBody = world.createRigidBody(mode === 'dynamic'
    ? RAPIER.RigidBodyDesc.dynamic().setAdditionalMass(1).setCanSleep(false)
    : RAPIER.RigidBodyDesc.fixed());
  const wall = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
    .setFriction(0).setRestitution(0).setCollisionGroups(GROUPS), wallBody);
  const handle = wall.handle;
  let body, probe;
  const createProbe = () => {
    body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.8, 0, 0)
      .setCanSleep(false).setLinearDamping(0).setAngularDamping(0));
    probe = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1)
      .setFriction(0).setRestitution(0).setCollisionGroups(GROUPS)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0), body);
  };
  const steps = [];
  const step = (phase, index) => {
    const before = { position: vec(body.translation()), velocity: vec(body.linvel()) };
    world.step(queue);
    result.nativeSteps++;
    const forces = [];
    queue.drainContactForceEvents((ev) => forces.push({ a: ev.collider1(), b: ev.collider2(),
      total: vec(ev.totalForce()), magnitude: ev.totalForceMagnitude() }));
    const after = { position: vec(body.translation()), velocity: vec(body.linvel()) };
    const manifolds = contacts(world, wall, probe);
    const row = { phase, index, before, after, deltaVx: after.velocity.x - before.velocity.x,
      wall: { sameHandle: wall.handle === handle, valid: wall.isValid(), enabled: wall.isEnabled(), groups: wall.collisionGroups(),
        mass: wallBody.mass(), position: vec(wallBody.translation()), velocity: vec(wallBody.linvel()) },
      manifolds, contactImpulse: manifolds.reduce((s, m) => s + m.contacts.reduce((n, c) => n + c.impulse, 0), 0), forces };
    steps.push(row);
    return row;
  };
  try {
    if (fixture === 'existing-contact') {
      createProbe();
      body.setLinvel({ x: -1, y: 0, z: 0 }, true);
      for (let k = 0; k < 2; k++) step('warmup', k);
    }
    if (condition !== 'active') wall.setEnabled(false);
    if (condition === 'disabled-groups-zero') wall.setCollisionGroups(0);
    if (!probe) createProbe();
    else {
      body.setTranslation({ x: 0.8, y: 0, z: 0 }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    body.setLinvel({ x: -1, y: 0, z: 0 }, true);
    const immediately = { enabled: wall.isEnabled(), groups: wall.collisionGroups(), valid: wall.isValid() };
    for (let k = 0; k < 16; k++) step('measurement', k);
    const measured = steps.filter((s) => s.phase === 'measurement');
    return { condition, fixture, fixtureParameters: { overlap: 0.2, initialVx: -1, probeMass: 1,
      gravity: PHYSICS.gravity, dt: DT, measuredSteps: 16, staticObstacle: mode !== 'dynamic' }, immediately,
      steps, finalVx: body.linvel().x,
      maxAbsDeltaVx: Math.max(...measured.map((s) => Math.abs(s.deltaVx))),
      maxContactImpulse: Math.max(...measured.map((s) => s.contactImpulse)),
      responseSteps: measured.filter((s) => Math.abs(s.deltaVx) > 1e-6).length,
      lateResponseSteps: measured.filter((s) => s.index >= 12 && Math.abs(s.deltaVx) > 1e-6).length,
      lateManifoldSteps: measured.filter((s) => s.index >= 12 && s.manifolds.length > 0).length,
    };
  } finally { queue.free(); world.free(); }
}

function fighterFixture() {
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = DT;
  world.integrationParameters.numSolverIterations = 6;
  const queue = new RAPIER.EventQueue(true);
  const f = new Fighter(RAPIER, world, new THREE.Scene(), new Map(), {
    index: 0, name: 'controlled-mace', x: 100, heading: 0, look: LOOKS.player,
    weapon: 'morgenstern', breakSeed: 7, revive: { count: 1 },
  });
  const sw = f.sword;
  const removedBox = f.swordColliders[2], removedBall = f.swordColliders[3];
  const handles = [removedBox.handle, removedBall.handle];
  const expectedGroups = f.swordColliders.map((c) => c.collisionGroups());
  const state = () => ({ swordMass: sw.mass(), storedSwordMass: f.swordMass, centerOfMass: vec(sw.localCom()),
    inertia: vec(sw.principalInertia()), colliders: f.swordColliders.map((c) => ({ handle: c.handle,
      valid: c.isValid(), enabled: c.isEnabled(), groups: c.collisionGroups(), mass: c.mass() })) });
  const probeBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false));
  const probe = world.createCollider(RAPIER.ColliderDesc.ball(0.045).setMass(1).setFriction(0).setRestitution(0)
    .setCollisionGroups(GROUPS).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0), probeBody);
  const reset = () => {
    sw.setTranslation({ x: 0, y: 0, z: 0 }, true);
    sw.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    sw.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sw.setAngvel({ x: 0, y: 0, z: 0 }, true);
    probeBody.setTranslation({ x: 0.06, y: 0.5, z: 0 }, true);
    probeBody.setLinvel({ x: -0.1, y: 0, z: 0 }, true);
    probeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };
  const steps = [];
  const block = (phase, count = 16) => {
    reset();
    for (let k = 0; k < count; k++) {
      const before = vec(probeBody.linvel());
      // Fighter weapon colliders request hooks. This probe is not a registered
      // fighter target; production Combat also returns ordinary impulses for it.
      world.step(queue, { filterContactPair: () => 1, filterIntersectionPair: () => true });
      result.nativeSteps++;
      const forces = [];
      queue.drainContactForceEvents((ev) => { if ([ev.collider1(), ev.collider2()].includes(probe.handle))
        forces.push({ a: ev.collider1(), b: ev.collider2(), total: vec(ev.totalForce()), magnitude: ev.totalForceMagnitude() }); });
      const box = contacts(world, removedBox, probe), ball = contacts(world, removedBall, probe);
      steps.push({ phase, index: k, before, velocity: vec(probeBody.linvel()), position: vec(probeBody.translation()),
        deltaVx: probeBody.linvel().x - before.x, box, ball, forces,
        sameHandles: handles[0] === removedBox.handle && handles[1] === removedBall.handle, state: state() });
    }
  };
  try {
    world.removeImpulseJoint(f.gripJoint, true);
    f.gripJoint = null;
    const before = state();
    block('active', 2);
    const cutY = f.weaponCfg.hiltLength + f.weapon.breakAt * f.weaponCfg.bladeLength;
    f.trimSword(cutY); // Exact production method; controlled trigger, not random combat breakage.
    const afterTrim = state();
    block('after-trim');
    const ghostStarted = tryRevive(f, 'controlled-collider-diagnosis');
    const duringGhost = state();
    block('during-ghost');
    f.revival.phase = 'stand';
    f.revival.standT = 0;
    f.revival.t = f.revive.linger + f.revive.fade;
    reviveTick(f, 0); // Real ghost exit, intentionally bypassing the get-up animation/physics.
    const afterGhost = state();
    block('after-ghost');
    return { fixture: 'actual-Fighter.trimSword-morgenstern', cutY, before, afterTrim, ghostStarted,
      duringGhost, afterGhost, expectedGroups, steps,
      limitations: ['Morgenstern is an existing trial-only weapon chosen because one cut exercises both complete box and ball removal.',
        'Grip is removed and sword/probe poses reset per phase; no full controller or natural combat is claimed.',
        'Real revival ghost entry/exit execute, but get-up and sword-return animation are bypassed.'],
      phases: [...new Set(steps.map((s) => s.phase))].map((phase) => {
        const list = steps.filter((s) => s.phase === phase);
        return { phase, nativeSteps: list.length, maxAbsDeltaVx: Math.max(...list.map((s) => Math.abs(s.deltaVx))),
          maxPairImpulse: Math.max(...list.map((s) => [...s.box, ...s.ball].reduce((n, m) => n + m.contacts.reduce((a, c) => a + c.impulse, 0), 0))),
          lateManifoldSteps: list.filter((s) => s.index >= 12 && s.box.length + s.ball.length > 0).length };
      }) };
  } finally { queue.free(); world.free(); }
}

try {
  await RAPIER.init();
  result.rapierVersion = RAPIER.version();
  if (mode === 'fighter') result.fighter = fighterFixture();
  else for (const fixture of ['fresh-overlap', 'existing-contact']) {
    for (const condition of ['active', 'disabled', 'disabled-groups-zero']) result.rows.push(apiFixture(condition, fixture));
  }
} catch (error) {
  result.exception = { name: error.name, message: error.message, stack: error.stack?.split('\n').slice(0, 6) };
} finally {
  result.sourceAfter = hashes();
  result.sourceStable = JSON.stringify(result.sourceBefore) === JSON.stringify(result.sourceAfter);
  result.measurementPass = !result.exception && result.sourceStable && (mode === 'fighter' ? !!result.fighter : result.rows.length === 6);
  result.completedUTC = new Date().toISOString();
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(fileURLToPath(import.meta.url), path.join(out, 'SCRIPT.mjs'));
  fs.writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  const raw = fs.readFileSync(path.join(out, 'report.json'));
  console.log(JSON.stringify({ out, measurementPass: result.measurementPass, exception: result.exception,
    bytes: raw.length, sha256: sha(raw), nativeSteps: result.nativeSteps, fighterPhases: result.fighter?.phases,
    rows: result.rows.map(({ condition, fixture, maxAbsDeltaVx, maxContactImpulse, finalVx, responseSteps,
      lateResponseSteps, lateManifoldSteps }) => ({ condition, fixture, maxAbsDeltaVx, maxContactImpulse, finalVx,
      responseSteps, lateResponseSteps, lateManifoldSteps })) }));
  process.exitCode = result.measurementPass ? 0 : 1;
}
