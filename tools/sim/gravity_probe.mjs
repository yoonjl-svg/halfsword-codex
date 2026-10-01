// Engine laws and a matched-start ablation of the game's gravity compensation.
// Compensation-off is diagnostic only: no game setting/default is changed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { newRound, RAPIER, THREE, CONFIG, DT } from './harness_m.mjs';

const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
function energy(b) {
  const omegaPrincipal = V(b.angvel()).applyQuaternion(Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())).invert());
  const I = b.principalInertia();
  return { translationJ: 0.5 * b.mass() * V(b.linvel()).lengthSq(), rotationJ: 0.5 * (I.x * omegaPrincipal.x ** 2 + I.y * omegaPrincipal.y ** 2 + I.z * omegaPrincipal.z ** 2) };
}
function engineLaws(mass) {
  const w = new RAPIER.World({ x: 0, y: CONFIG.PHYSICS.gravity, z: 0 });
  w.timestep = DT;
  try {
    const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 10, 0));
    w.createCollider(RAPIER.ColliderDesc.ball(0.2).setMass(mass), b);
    b.recomputeMassPropertiesFromColliders();
    const I = b.principalInertia();
    b.addForce({ x: 3, y: 0, z: 0 }, true);
    b.addTorque({ x: 0, y: 0, z: 0.1 }, true);
    for (let i = 0; i < 120; i++) w.step();
    const t = 120 * DT;
    const expected = { vy: CONFIG.PHYSICS.gravity * t, vx: 3 / mass * t, wz: 0.1 / I.z * t };
    for (const [actual, target] of [[b.linvel().y, expected.vy], [b.linvel().x, expected.vx], [b.angvel().z, expected.wz]]) assert.ok(Math.abs(actual - target) < 0.001, 'isolated engine-law check failed');
    return { massKg: b.mass(), inertiaKgM2: I, seconds: t, forceN: 3, torqueNm: 0.1, velocityMps: b.linvel(), angularVelocityRadS: b.angvel(), expected, pass: true };
  } finally { w.free(); }
}

function stroke(weapon, direction, duration, compensation) {
  const G = newRound({ seed: 7, walls: false, weapon });
  G.park();
  const f = G.player;
  const high = [0.02, 0.52], low = [0.02, -0.45];
  const [from, to] = direction === 'down' ? [high, low] : [low, high];
  f.skill.autoGuard = true;
  f.handOffset.set(...from);
  for (const key of ['prev', 'aim', 'aimRaw', 'anchor']) f.skill[key].set(...from);
  f.skill.aimVel.set(0, 0); f.skill.vel.set(0, 0); f.skill.follow.set(0, 0);
  f.handHeld = true;
  try {
    for (let i = 0; i < 3 / DT; i++) G.step();
    const sword = f.sword;
    const mass = sword.mass();
    const initial = { com: sword.worldCom(), velocity: sword.linvel(), angularVelocity: sword.angvel(), energy: energy(sword), state: f.state };
    const startSha256 = createHash('sha256').update(JSON.stringify(Object.values(f.bodies).concat(sword).map(b => [b.translation(), b.rotation(), b.linvel(), b.angvel()]))).digest('hex');
    // Same full-compensation preparation, then change only the compensation helper.
    // Gravity remains -9.81 for every body. This avoids the hardcoded 9.81 compensation
    // remaining active in a misleading world-gravity-off experiment.
    if (compensation === 'off') {
      const gravityTorque = f.gravityTorque;
      f.gravityTorque = function (...args) { return gravityTorque.apply(this, args).multiplyScalar(0); };
    }
    const samples = [];
    let peak = null;
    let peakWindow = null;
    let userTorqueWorkJ = 0;
    let lastTip = f.bladePoint(1, new THREE.Vector3());
    for (let i = 0; i < Math.ceil((duration + 0.8) / DT); i++) {
      const t = i * DT;
      const u = Math.min(1, (t + DT) / duration);
      f.handHeld = u < 1;
      f.handOffset.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u);
      G.step();
      const tip = f.bladePoint(1, new THREE.Vector3());
      const E = energy(sword);
      const s = { t: (i + 1) * DT, comY: sword.worldCom().y, tipY: tip.y, tipSpeedMps: tip.distanceTo(lastTip) / DT, energyJ: E.translationJ + E.rotationJ, ...E, state: f.state, handHeld: f.handHeld, wristTorqueNm: f.debug.wristTorque.length() };
      s.gravityWorkSinceStartJ = mass * -CONFIG.PHYSICS.gravity * (initial.com.y - s.comY);
      // Explicit user torque only, sampled after the step. Joint impulses and forces
      // at attachments are not included; this is not the complete motor-work budget.
      userTorqueWorkJ += V(sword.userTorque()).dot(V(sword.angvel())) * DT;
      if (!Object.values(s).filter(v => typeof v === 'number').every(Number.isFinite)) throw new Error('nonfinite stroke state');
      if (!peak || s.tipSpeedMps > peak.tipSpeedMps) peak = s;
      if (s.t <= duration + 0.25 && (!peakWindow || s.tipSpeedMps > peakWindow.tipSpeedMps)) peakWindow = s;
      if (i % 6 === 0 || i + 1 === Math.ceil((duration + 0.8) / DT)) samples.push(s);
      lastTip = tip;
    }
    return { weapon, massKg: mass, inertiaKgM2: sword.principalInertia(), direction, durationS: duration, compensation, worldGravity: CONFIG.PHYSICS.gravity, startSha256, initial, peak, peakWindow, final: samples.at(-1), explicitSwordTorqueWorkEstimateJ: userTorqueWorkJ, samples };
  } finally { G.eventQueue.free(); G.world.free(); }
}

const result = {
  schemaVersion: 1,
  scope: 'Isolated Newton-law sanity checks plus live-game matched-start diagnostic ablation. Not a proposed production change or human-motion validation.',
  workMeaning: 'Gravity work uses sword COM drop m*g*dy. Kinetic energy is sword translation plus rotation about its COM. Their difference includes muscle work, joints, damping and contacts; it is not an isolated dissipation measurement.',
  protocol: { timestepS: DT, seed: 7, prepareS: 3, peakWindow: 'command duration plus 0.25s', fullWindow: 'command duration plus 0.8s', compensationOff: 'all shoulder, elbow and wrist paths through gravityTorque; world gravity unchanged', input: 'linear handOffset from high [.02,.52] to low [.02,-.45], or reverse; handHeld released at end; enemy parked' },
  engine: [engineLaws(1), engineLaws(3)], rows: [],
};
for (const weapon of ['longsword', 'zweihander']) for (const direction of ['down', 'up']) for (const duration of [0.18, 0.55]) {
  const on = stroke(weapon, direction, duration, 'on');
  const off = stroke(weapon, direction, duration, 'off');
  assert.equal(on.startSha256, off.startSha256, 'ablation must start from the same settled body state');
  result.rows.push(on, off);
}
result.sourceSha256 = {};
for (const file of ['src/fighter.js', 'src/gait.js', 'src/config.js', 'tools/sim/harness_m.mjs', 'tools/sim/gravity_probe.mjs']) {
  result.sourceSha256[file] = createHash('sha256').update(await readFile(new URL('../../' + file, import.meta.url))).digest('hex');
}
const json = JSON.stringify(result, null, 2) + '\n';
if (process.argv[2]) await writeFile(process.argv[2], json);
else process.stdout.write(json);
console.log(JSON.stringify({ engineChecks: result.engine.length, rows: result.rows.length, pass: true }));
