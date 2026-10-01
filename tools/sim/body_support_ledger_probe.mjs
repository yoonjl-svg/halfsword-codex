// Actual game state transitions; no pose/velocity freezing and no forced contact loads.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { newRound, CONFIG, DT } from './harness_m.mjs';
import { installForceLedger } from './force_ledger.mjs';

class Passive { update() {} }
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['src/fighter.js', 'src/gait.js', 'src/config.js', 'tools/sim/harness_m.mjs', 'tools/sim/force_ledger.mjs', 'tools/sim/body_support_ledger_probe.mjs'];
async function sources() { return Object.fromEntries(await Promise.all(files.map(async f => [f, hash(await readFile(new URL('../../' + f, import.meta.url)))]))); }
const summarize = values => ({ min: Math.min(...values), mean: values.reduce((a, b) => a + b, 0) / values.length, max: Math.max(...values) });
const norm = v => Math.hypot(v.x, v.y, v.z);

function run(kind, floorPresent) {
  const saved = { assist: CONFIG.GAIT.assist, catchMode: CONFIG.GAIT.catchMode, catchScale: CONFIG.GAIT.catchScale, reactionModel: CONFIG.GRIP.reactionModel };
  const random = Math.random;
  Object.assign(CONFIG.GAIT, { assist: 0.1, catchMode: 'on', catchScale: 1 });
  CONFIG.GRIP.reactionModel = 'legacy';
  const G = newRound({ seed: 7, walls: false, weapon: 'longsword', AIClass: Passive });
  G.park();
  const f = G.player;
  let ledger;
  try {
    f.balanceProbe = {};
    const advance = seconds => { for (let i = 0; i < Math.ceil(seconds / DT); i++) G.step(); };
    advance(3);
    assert.equal(f.state, 'stand');
    if (kind === 'kneel') {
      f.limbs.legF = f.limbs.legB = 0.2;
      f.knockDown(false);
      for (let i = 0; i < 6 / DT && f.state !== 'kneel'; i++) G.step();
      advance(0.5);
    } else if (kind === 'getup') {
      f.knockDown(false); advance(1.2);
    } else if (kind === 'down') {
      f.knockDown(true); advance(0.4);
    }
    assert.equal(f.state, kind, `state precondition ${kind}`);
    const startHash = hash(JSON.stringify({ state: f.state, stateTime: f.stateTime, muscle: f.muscle,
      bodies: [...Object.values(f.bodies), f.sword].map(b => [b.translation(), b.rotation(), b.linvel(), b.angvel(), b.mass()]) }));
    const fixed = [];
    G.world.forEachRigidBody(b => { if (b.isFixed()) fixed.push(b); });
    assert.equal(fixed.length, 1); assert.equal(fixed[0].numColliders(), 1);
    const ground = fixed[0], floor = ground.collider(0), floorHandle = String(ground.handle);
    const extents = floor.halfExtents();
    assert.deepEqual([extents.x, extents.y, extents.z], [30, 0.5, 30]);
    if (!floorPresent) G.world.removeCollider(floor, true);
    ledger = installForceLedger(G, { fighters: [f], maxSamples: 0, contacts: true });
    const start = { state: f.state, stateTime: f.stateTime, pelvisY: f.bodies.pelvis.translation().y, actual: ledger.snapshot().total, controlMassKg: f.totalMass, gaitCachedMgN: f.gait.Mg };
    const samples = [], all = [], transitions = [];
    let previousState = f.state;
    for (let i = 0; i < 120; i++) {
      G.step();
      const frame = ledger.latest, segment = frame.physics[0];
      let rawVerticalN = 0, points = 0;
      for (const c of segment.contactsRaw) if (c.bodyA === floorHandle || c.bodyB === floorHandle) {
        rawVerticalN += c.rawNormalForceN * Math.abs(c.normal.y); points += c.solverPoints.length;
      }
      const row = { t: (i + 1) * DT, state: f.state, pelvisY: f.bodies.pelvis.translation().y, muscle: f.muscle,
        directSupportN: f.balanceProbe.appliedUpN, floorSolverPoints: points, rawFloorVerticalN: rawVerticalN,
        actualMassKg: frame.postGame.total.mass, controlMassKg: f.totalMass, KJ: frame.postGame.total.K,
        explicitForceWorkApproxJ: frame.balance.forceWorkApproxJ, energyResidualApproxJ: frame.balance.energyResidualApproxJ,
        unclosedImpulseNs: norm(frame.balance.residualP), massPropertyChanges: frame.balance.massPropertyChanges };
      assert.ok(Object.values(row).filter(v => typeof v === 'number').every(Number.isFinite));
      if (!floorPresent) assert.equal(points, 0, 'removed floor must have no solver contact points');
      if (f.state !== previousState) transitions.push({ t: row.t, from: previousState, to: f.state });
      previousState = f.state; all.push(row);
      if (i % 12 === 0 || i === 119) samples.push(row);
    }
    const summary = ledger.summary();
    return { kind, floorPresent, matchedStartSha256: startHash, start, transitions, samples,
      statistics: Object.fromEntries(['directSupportN', 'rawFloorVerticalN', 'actualMassKg', 'KJ', 'unclosedImpulseNs'].map(k => [k, summarize(all.map(r => r[k]))])),
      unsupportedDirectSupportFrames: all.filter(r => !r.floorSolverPoints && r.directSupportN > 1).length,
      statesSeen: [...new Set(all.map(r => r.state))], explicitLedger: summary };
  } finally {
    ledger?.restore(); G.eventQueue.free(); G.world.free(); Math.random = random;
    Object.assign(CONFIG.GAIT, { assist: saved.assist, catchMode: saved.catchMode, catchScale: saved.catchScale });
    CONFIG.GRIP.reactionModel = saved.reactionModel;
  }
}

const before = await sources(), wallStart = performance.now(), rows = [];
for (const kind of ['stand', 'kneel', 'getup', 'down']) {
  const grounded = run(kind, true), unsupported = run(kind, false);
  assert.equal(grounded.matchedStartSha256, unsupported.matchedStartSha256);
  rows.push(grounded, unsupported);
}
const after = await sources(); assert.deepEqual(after, before, 'source changed during measurement');
const result = { schemaVersion: 1, sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceHashes: before,
  dt: DT, seed: 7, wallSeconds: (performance.now() - wallStart) / 1000, sourceStable: true,
  scope: 'Same live game code, B settings, legacy grip. Each actual state is prepared before removing only the floor collider. State transitions remain enabled. Removal is a causal diagnostic, not a production terrain feature or human success criterion.',
  limitation: 'Native upright/joint reactions, full contact work, damping loss and changing-mass flux remain unmeasured. Contact forces are RAW and receive no 6/7 correction. Residuals are not automatically engine errors.', rows };
await writeFile(process.argv[2] || '/tmp/body-support-ledger.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, rows: rows.length, wallSeconds: result.wallSeconds, unsupported: rows.filter(r => !r.floorPresent).map(r => ({ kind: r.kind, directSupportN: r.statistics.directSupportN, unsupportedFrames: r.unsupportedDirectSupportFrames, states: r.statesSeen })) }));
