// Isolated unit calibration only: no character, joints, game controller, or changed core.
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const output = process.argv[2] || '/tmp/halfsword-contact-force-calibration.json';
let previousSleepingRun;
try {
  const existing = JSON.parse(await readFile(output, 'utf8'));
  previousSleepingRun = existing.previousSleepingRun ?? (existing.statistics?.sleepingSamples > 0 ? {
    scope: 'First run used default sleeping; preserve this raw result but use the awake run for current contact-force inference.',
    statistics: existing.statistics, rows: existing.rows,
  } : undefined);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await RAPIER.init();
const dt = 1 / 120, gravity = -9.81, iterations = 6, requestedMassKg = 75;
const world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
world.timestep = dt;
world.integrationParameters.numSolverIterations = iterations;
try {
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floorCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(0, -0.5, 0).setFriction(0.9), floor);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.6, 0).setCanSleep(false));
  const box = world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setMass(requestedMassKg).setFriction(0.9), body);
  body.recomputeMassPropertiesFromColliders();
  const massKg = body.mass(), expectedMgN = massKg * Math.abs(gravity);
  for (let i = 0; i < 360; i++) world.step();
  const settled = { position: body.translation(), velocity: body.linvel(), sleeping: body.isSleeping() };
  const rows = [];
  for (let i = 0; i < 120; i++) {
    world.step();
    let normalImpulseNs = 0, verticalImpulseNs = 0, contacts = 0, solverContacts = 0;
    world.contactPair(box, floorCollider, (m) => {
      const normal = m.normal();
      for (let j = 0; j < m.numContacts(); j++) {
        const impulse = m.contactImpulse(j);
        normalImpulseNs += impulse;
        verticalImpulseNs += impulse * Math.abs(normal.y);
        contacts++;
      }
      solverContacts += m.numSolverContacts();
    });
    const rawVerticalForceN = verticalImpulseNs / dt;
    rows.push({ timeS: 3 + (i + 1) * dt, normalImpulseNs, verticalImpulseNs, rawVerticalForceN, correctedSixSeventhsN: rawVerticalForceN * 6 / 7, contacts, solverContacts, pelvisNotApplicable: true, boxHeightM: body.translation().y, verticalVelocityMps: body.linvel().y, sleeping: body.isSleeping() });
  }
  const summarize = key => ({ min: Math.min(...rows.map(r => r[key])), mean: rows.reduce((a, r) => a + r[key], 0) / rows.length, max: Math.max(...rows.map(r => r[key])) });
  const raw = summarize('rawVerticalForceN'), corrected = summarize('correctedSixSeventhsN');
  const result = {
    scope: 'One isolated resting 75kg box on a horizontal fixed floor. Unit calibration of contactImpulse/dt for this Rapier/solver configuration only; not character/joint load validation or a universal correction.',
    rapierVersion: RAPIER.version(), timestepS: dt, solverIterations: iterations, gravityMps2: gravity,
    requestedMassKg, measuredMassKg: massKg, expectedMgN, settleS: 3, observeS: 1, sampleTiming: 'Immediately after each completed world.step; manifold normal impulses summed, vertical projection magnitude used on a horizontal floor.',
    previousSleepingRun,
    canSleep: false, settled, statistics: { rawVerticalForceN: raw, correctedSixSeventhsN: corrected, rawToMg: raw.mean / expectedMgN, correctedToMg: corrected.mean / expectedMgN, empiricalCorrection: expectedMgN / raw.mean, verticalVelocityMps: summarize('verticalVelocityMps'), boxHeightM: summarize('boxHeightM'), sleepingSamples: rows.filter(r => r.sleeping).length }, rows,
  };
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ scope: result.scope, rapierVersion: result.rapierVersion, timestepS: dt, iterations, massKg, expectedMgN, settled, statistics: result.statistics }));
} finally { world.free(); }
