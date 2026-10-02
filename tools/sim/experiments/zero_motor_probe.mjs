// Native Rapier diagnostic only. Never imported by the game.
import RAPIER from '@dimforge/rapier3d-compat';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(out|seconds)=(.+)$/.exec(arg);
  if (!match) throw new Error('Use --out=path or --seconds=value');
  return [match[1], match[2]];
}));
const DT = 1 / 120;
const seconds = Number(options.seconds ?? 3);
if (!(seconds > 0 && Number.isFinite(seconds))) throw new Error('Invalid seconds');
const hash = value => createHash('sha256').update(value).digest('hex');
const axes = [3, 4, 5];
const vector = v => ({ x: v.x, y: v.y, z: v.z });
const rotation = q => ({ ...vector(q), w: q.w });
const generic = () => RAPIER.JointData.generic(
  { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0,
);
function motor(joint, stiffness, damping) {
  for (const axis of axes) {
    joint.rawSet.jointConfigureMotorModel(joint.handle, axis, 1);
    joint.rawSet.jointConfigureMotorPosition(joint.handle, axis, 0, stiffness, damping);
  }
}
function physical(body) {
  return { position: vector(body.translation()), rotation: rotation(body.rotation()),
    linearVelocity: vector(body.linvel()), angularVelocity: vector(body.angvel()),
    massKg: body.mass(), principalInertia: vector(body.principalInertia()) };
}
function observation(body, step) {
  const state = physical(body), v = state.linearVelocity, w = state.angularVelocity;
  const inertia = state.principalInertia;
  // A cube with no extra mass has isotropic inertia. No world-frame conversion needed.
  if (Math.max(inertia.x, inertia.y, inertia.z) - Math.min(inertia.x, inertia.y, inertia.z) > 1e-6)
    throw new Error('Energy calculation requires the isotropic cube inertia');
  const speed = Math.hypot(v.x, v.y, v.z), angularSpeed = Math.hypot(w.x, w.y, w.z);
  const energyJ = 0.5 * state.massKg * speed * speed + 0.5 * inertia.x * angularSpeed * angularSpeed;
  return { step, timeS: step * DT, ...state, speedMps: speed, angularSpeedRadS: angularSpeed, kineticEnergyJ: energyJ,
    finite: [...Object.values(state.position), ...Object.values(state.rotation), ...Object.values(v), ...Object.values(w), energyJ].every(Number.isFinite) };
}

await RAPIER.init();
const base = new RAPIER.World({ x: 0, y: 0, z: 0 });
base.timestep = DT;
const fixed = base.createRigidBody(RAPIER.RigidBodyDesc.fixed());
const dynamic = base.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
  .setCanSleep(false)
  .setRotation({ x: Math.sin(0.4), y: 0, z: 0, w: Math.cos(0.4) })
  .setLinvel(0.3, -0.2, 0.1).setAngvel({ x: 2, y: -0.7, z: 0.5 }));
base.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(2), dynamic);
const joint = base.createImpulseJoint(generic(), fixed, dynamic, true);
const handles = { fixed: fixed.handle, dynamic: dynamic.handle, joint: joint.handle };
const initialSnapshot = base.takeSnapshot();
motor(joint, 2500, 330);
// Use a short preparation so the motor has nonzero motion and solver history at switch.
for (let step = 0; step < 6; step++) base.step();
const warmSnapshot = base.takeSnapshot();
const plans = [
  ['initial_never_configured', initialSnapshot, 'never'],
  ['initial_zero', initialSnapshot, 'zero'],
  ['initial_removed', initialSnapshot, 'remove'],
  ['warm_active', warmSnapshot, 'active'],
  ['warm_zero_existing', warmSnapshot, 'zero'],
  ['warm_removed', warmSnapshot, 'remove'],
  ['warm_recreated_never', warmSnapshot, 'recreate_never'],
  ['warm_recreated_zero', warmSnapshot, 'recreate_zero'],
];
const rows = [];
for (const [name, snapshot, change] of plans) {
  const world = RAPIER.World.restoreSnapshot(snapshot);
  const body = world.getRigidBody(handles.dynamic), anchor = world.getRigidBody(handles.fixed);
  let restoredJoint = world.getImpulseJoint(handles.joint);
  const before = physical(body), beforeHash = hash(JSON.stringify(before));
  if (change === 'remove' || change.startsWith('recreate')) {
    world.removeImpulseJoint(restoredJoint, true);
    restoredJoint = change.startsWith('recreate') ? world.createImpulseJoint(generic(), anchor, body, true) : null;
  }
  if (change === 'zero' || change === 'recreate_zero') motor(restoredJoint, 0, 0);
  const afterMutationHash = hash(JSON.stringify(physical(body)));
  const initial = observation(body, 0), samples = [initial];
  let finite = initial.finite, maxSpeedMps = initial.speedMps, maxAngularSpeedRadS = initial.angularSpeedRadS;
  let maxKineticEnergyJ = initial.kineticEnergyJ, maxDisplacementM = 0;
  let final = initial;
  for (let step = 1; step <= Math.round(seconds / DT); step++) {
    world.step();
    const sample = observation(body, step);
    final = sample;
    finite &&= sample.finite;
    maxSpeedMps = Math.max(maxSpeedMps, sample.speedMps);
    maxAngularSpeedRadS = Math.max(maxAngularSpeedRadS, sample.angularSpeedRadS);
    maxKineticEnergyJ = Math.max(maxKineticEnergyJ, sample.kineticEnergyJ);
    maxDisplacementM = Math.max(maxDisplacementM, Math.hypot(
      sample.position.x - initial.position.x, sample.position.y - initial.position.y, sample.position.z - initial.position.z));
    if (step <= 12 || step % 12 === 0 || step === Math.round(seconds / DT) || !sample.finite) samples.push(sample);
    if (!sample.finite) break;
  }
  rows.push({ name, snapshotHash: hash(snapshot), beforeHash, afterMutationHash,
    mutationPreservesPhysicalState: beforeHash === afterMutationHash, finite, maxSpeedMps,
    maxAngularSpeedRadS, maxKineticEnergyJ, maxDisplacementM, initial, final, samples });
  world.free();
}
base.free();
const packageData = JSON.parse(await readFile(new URL('../../../node_modules/@dimforge/rapier3d-compat/package.json', import.meta.url), 'utf8'));
const result = { probe: 'zero_motor_probe', rapierVersion: packageData.version,
  probeSourceSha256: hash(await readFile(new URL(import.meta.url))),
  protocol: { timestepS: DT, seconds, preparationSteps: 6, stiffnessNmPerRad: 2500, dampingNmSPerRad: 330,
    geometry: 'fixed anchor + dynamic 2kg isotropic cube; generic joint axesMask=0; no contacts/gravity/sleep; force-based angular motors',
    comparison: 'Each initial or warm group restores the identical native snapshot and reacquires native handles; removal/recreation intentionally changes only the generic motor joint.',
    limitation: 'An isolated no-contact motor test cannot establish the cause of whole-body recovery failure. No epsilon coefficients tested; no game fix claimed.' },
  sameInitialPhysicalState: new Set(rows.filter(r => r.name.startsWith('initial')).map(r => r.beforeHash)).size === 1,
  sameWarmPhysicalState: new Set(rows.filter(r => r.name.startsWith('warm')).map(r => r.beforeHash)).size === 1,
  mutationPreservesPhysicalState: rows.every(r => r.mutationPreservesPhysicalState), rows };
if (options.out) {
  await mkdir(dirname(options.out), { recursive: true });
  await writeFile(options.out, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ out: options.out ?? null, sameInitialPhysicalState: result.sameInitialPhysicalState,
  sameWarmPhysicalState: result.sameWarmPhysicalState, mutationPreservesPhysicalState: result.mutationPreservesPhysicalState,
  rows: rows.map(({ name, finite, maxSpeedMps, maxAngularSpeedRadS, maxKineticEnergyJ, maxDisplacementM, initial, final }) =>
    ({ name, finite, maxSpeedMps, maxAngularSpeedRadS, maxKineticEnergyJ, maxDisplacementM,
      initialKineticEnergyJ: initial.kineticEnergyJ, finalKineticEnergyJ: final.kineticEnergyJ })) }));
if (!result.sameInitialPhysicalState || !result.sameWarmPhysicalState || !result.mutationPreservesPhysicalState || rows.some(r => !r.finite)) process.exitCode = 1;
