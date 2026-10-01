// Native actuator fixtures; contact flags are synthetic inputs, not a contact-detector test.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { applyAxialLegSupport } from '../../src/support_transfer.js';

await RAPIER.init();
const V = x => new THREE.Vector3(x.x, x.y, x.z);
const sha = async p => createHash('sha256').update(await readFile(p)).digest('hex');
const moduleUrl = new URL('../../src/support_transfer.js', import.meta.url);
const sourceBefore = await sha(moduleUrl);
const close = (x, y, tol = 1e-7) => assert.ok(Math.abs(x - y) <= tol, `${x} != ${y}`);
function snapshot(bodies) {
  const P = new THREE.Vector3(), L = new THREE.Vector3(); let K = 0;
  for (const b of bodies) {
    const p = V(b.linvel()).multiplyScalar(b.mass());
    const frame = new THREE.Quaternion().copy(b.rotation()).multiply(new THREE.Quaternion().copy(b.principalInertiaLocalFrame()));
    const w = V(b.angvel()).applyQuaternion(frame.clone().invert()), I = b.principalInertia();
    const spin = new THREE.Vector3(I.x * w.x, I.y * w.y, I.z * w.z);
    P.add(p); K += .5 * b.mass() * V(b.linvel()).lengthSq() + .5 * spin.dot(w);
    L.add(V(b.worldCom()).cross(p)).add(spin.applyQuaternion(frame));
  }
  return { P, L, K };
}

function fixture(name, o = {}) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = o.dt ?? 1 / 120; world.numSolverIterations = 6;
  const bodies = [], applications = [];
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw ?? 0);
  const offset = new THREE.Vector3(...(o.offset ?? [0, 0, 0]));
  const place = a => new THREE.Vector3(...a).applyQuaternion(yaw).add(offset);
  function body(pos, mass) {
    const p = place(pos);
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(yaw).setCanSleep(false));
    world.createCollider(RAPIER.ColliderDesc.cuboid(.13, .18, .11).setMass(mass).setCollisionGroups(0), b);
    b.recomputeMassPropertiesFromColliders(); bodies.push(b);
    const original = b.addForceAtPoint.bind(b);
    b.addForceAtPoint = (f, p, wake) => {
      applications.push({ force: V(f), point: V(p), velocity: V(b.velocityAtPoint(p)) });
      return original(f, p, wake);
    };
    return b;
  }
  try {
    const pelvis = body(o.pelvis ?? [0, 1, 0], 50), footF = body([0, 0, 0], 5);
    const feet = { F: footF }; if (o.twoLegs) feet.B = body([0, 0, .3], 5);
    const f = { limbs: { legF: o.healthF ?? 1, legB: o.healthB ?? 1 }, detachedParts: new Set(o.detached ?? []), jointByName: {} };
    for (const [k, foot] of Object.entries(feet)) {
      const localHip = o.centerAnchors ? { x: 0, y: 0, z: 0 } : { x: 0, y: -.1, z: k === 'B' ? .3 : 0 };
      const localAnkle = o.centerAnchors ? { x: 0, y: 0, z: 0 } : { x: .08, y: .04, z: 0 };
      f.jointByName['thigh' + k] = { parent: pelvis, joint: { anchor1: () => localHip } };
      f.jointByName['foot' + k] = { child: foot, joint: { anchor2: () => localAnkle } };
    }
    pelvis.setLinvel(new THREE.Vector3(...(o.velocity ?? [0, 0, 0])).applyQuaternion(yaw), true);
    pelvis.setAngvel(new THREE.Vector3(...(o.omega ?? [0, 0, 0])).applyQuaternion(yaw), true);
    if (o.rigidRotation) for (const b of bodies) {
      const w = new THREE.Vector3(0, 0, 2).applyQuaternion(yaw);
      b.setAngvel(w, true); b.setLinvel(w.clone().cross(V(b.worldCom()).sub(offset)), true);
    }
    const contacts = { groups: { footF: { hasSupport: o.contact !== false }, footB: { hasSupport: !!o.twoLegs && o.contactB !== false } } };
    const before = snapshot(bodies);
    const r = applyAxialLegSupport(f, o.request ?? 80, contacts, o.load ?? { F: 1, B: 1 }, o.cap ?? 160);
    const netF = new THREE.Vector3(), netT = new THREE.Vector3(); let power = 0;
    for (const a of applications) {
      netF.add(a.force); netT.add(a.point.clone().sub(offset).cross(a.force)); power += a.force.dot(a.velocity);
    }
    close(netF.length(), 0, 1e-9); close(netT.length(), 0, 1e-8);
    close(power, r.instantaneousPowerW, 1e-8);
    assert.equal(applications.length, r.legs.length * 2);
    for (let i = 0; i < r.legs.length; i++) {
      close(applications[2 * i].force.length(), r.legs[i].axialForceN);
      close(applications[2 * i + 1].force.length(), r.legs[i].axialForceN);
    }
    assert.ok(r.legs.every(l => Number.isFinite(l.axialForceN) && l.axialForceN >= 0 && l.axialForceN <= l.capN + 1e-8));
    assert.ok(r.legs.reduce((s, l) => s + l.axialForceN, 0) <= (o.cap ?? 160) + 1e-8);
    assert.ok(r.appliedUpN <= (o.request ?? 80) + 1e-8);
    world.step(); const after = snapshot(bodies);
    const dP = after.P.clone().sub(before.P), dL = after.L.clone().sub(before.L);
    assert.ok(dP.length() < 2e-5, 'isolated pair linear momentum'); assert.ok(Number.isFinite(after.K));
    return { name, dt: world.timestep, bodyCount: bodies.length, result: r, applicationCount: applications.length,
      netForceN: netF.toArray(), netTorqueNm: netT.toArray(), actualPowerW: power,
      deltaP: dP.toArray(), deltaL: dL.toArray(), deltaLNorm: dL.length(), deltaKJ: after.K - before.K };
  } finally { world.free(); }
}

const rows = [];
function run(name, options, check) { const r = fixture(name, options); check?.(r); rows.push(r); return r; }
run('extension positive work', { centerAnchors: true, velocity: [0, 1, 0] }, r => { close(r.actualPowerW, 80); assert.ok(r.deltaKJ > 0); });
run('compression negative work', { centerAnchors: true, velocity: [0, -1, 0] }, r => { close(r.actualPowerW, -80); assert.ok(r.deltaKJ < 0); });
run('co-rotation no instantaneous work', { rigidRotation: true, yaw: .7, offset: [2, 1, -3] }, r => close(r.actualPowerW, 0, 2e-5));
run('no supporting contact', { contact: false }, r => { assert.equal(r.applicationCount, 0); close(r.result.unmetUpN, 80); });
run('near horizontal saturates', { centerAnchors: true, pelvis: [1, 1e-7, 0], cap: 90 }, r => { close(r.result.legs[0].axialForceN, 90); assert.ok(r.result.appliedUpN < 1e-4); });
for (const y of [0, -.1]) run('nonpositive ny ' + y, { centerAnchors: true, pelvis: [1, y, 0] }, r => assert.equal(r.applicationCount, 0));
run('coincident endpoints', { centerAnchors: true, pelvis: [0, 0, 0] }, r => assert.equal(r.applicationCount, 0));
run('asymmetric load', { twoLegs: true, load: { F: 3, B: 1 } }, r => { close(r.result.legs[0].share, .75); close(r.result.legs[1].share, .25); });
run('injury changes relative allocation', { twoLegs: true, healthF: .25 }, r => { close(r.result.legs[0].share, .2); close(r.result.legs[1].share, .8); });
run('zero health excluded', { healthF: 0 }, r => assert.equal(r.applicationCount, 0));
run('detached foot excluded', { detached: ['footF'] }, r => assert.equal(r.applicationCount, 0));
run('single injured leg capacity does not normalize away', { healthF: .01 }, r => { close(r.result.legs[0].capN, 1.6); assert.ok(r.result.appliedUpN > 0 && r.result.appliedUpN <= 1.6); });
run('bilateral injury reduces aggregate actuator cap', { twoLegs: true, healthF: .2, healthB: .2 }, r => { close(r.result.legs.reduce((s, l) => s + l.capN, 0), 32); assert.ok(r.result.appliedUpN <= 32); });
run('infinite cap rejected', { cap: Infinity }, r => assert.equal(r.applicationCount, 0));
const convergence = [1 / 120, 1 / 240, 1 / 480].map(dt => run('off-centre dt ' + dt, { dt, velocity: [1, .2, .1], omega: [.3, -.2, 1] }));
assert.ok(convergence[1].deltaLNorm < convergence[0].deltaLNorm * .4 + 1e-7, 'angular residual decreases with dt');
assert.ok(convergence[2].deltaLNorm < convergence[1].deltaLNorm * .4 + 1e-7, 'angular residual decreases again');
const sourceAfter = await sha(moduleUrl); assert.equal(sourceAfter, sourceBefore, 'actuator source stable during fixtures');
const result = { pass: true, fixtures: rows.length, sourceSha256: sourceAfter, testSha256: await sha(new URL(import.meta.url)),
  scope: 'Actual applyAxialLegSupport; native isolated two-body fixtures, three bodies only for two-leg allocation. Synthetic support flags and joint-anchor adapters; no native anatomical chain, real contact detection, PD, upright, horizontal helpers, gravity or human validation. Cap covers this actuator only, not aggregate muscle strength. Positive actuator work is allowed; finite-step angular residual is measured, not exact conservation asserted. Health reduces actuator capacity in addition to changing allocation; it is not a validated human injury-strength relation.', rows };
await writeFile(process.argv[2] || '/tmp/support-transfer-fixtures.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, fixtures: rows.length, sourceSha256: sourceAfter, convergence: convergence.map(r => ({ dt: r.dt, deltaLNorm: r.deltaLNorm })) }));
