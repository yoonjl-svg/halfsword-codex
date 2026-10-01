// Actual harness physics observations; no motor/force monkeypatch or game edits.
// node tools/sim/recovery_support_probe.mjs --out=evidence/recovery-support-baseline.json
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CONDITIONS = ['healthy', 'hurt', 'wound', 'wound_side_pos', 'wound_side_neg', 'disabled', 'unsupported'];
const PRESETS = {
  B: { assist: 0.1, catchMode: 'on', catchScale: 1, recoveryTrial: 'off' },
  R: { assist: 0.1, catchMode: 'on', catchScale: 1, recoveryTrial: 'contact' },
  A: { assist: 0.2, catchMode: 'on', catchScale: 0.5, recoveryTrial: 'off' },
  low_half: { assist: 0.1, catchMode: 'on', catchScale: 0.5, recoveryTrial: 'off' },
  high_full: { assist: 0.2, catchMode: 'on', catchScale: 1, recoveryTrial: 'off' },
};
const PARTS = ['footF', 'footB', 'shinF', 'shinB', 'farmS', 'farmO'];
const SETTLE = Math.max(2.5, CONFIG.ARENA.startHold + 0.5);
const vec = (v) => [v.x, v.y, v.z];
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
class Passive { update() {} }

function options(args) {
  const o = { candidates: ['B'], conditions: [...CONDITIONS], seeds: [7], seconds: 12,
    stride: 4, out: resolve(ROOT, 'evidence/recovery-support-baseline.json') };
  for (const arg of args) {
    if (arg === '--help') return { help: true };
    const m = /^--(candidates|conditions|seeds|seconds|stride|out)=(.+)$/.exec(arg);
    if (!m) throw new Error(`Invalid option: ${arg}`);
    o[m[1]] = ['candidates', 'conditions', 'seeds'].includes(m[1]) ? m[2].split(',') : m[2];
  }
  o.seeds = o.seeds.map(Number); o.seconds = Number(o.seconds); o.stride = Number(o.stride);
  if (o.candidates.some((x) => !PRESETS[x]) || o.conditions.some((x) => !CONDITIONS.includes(x))) throw new Error('Unknown candidate/condition');
  if (o.seeds.some((x) => !Number.isInteger(x) || x < 0 || x > 0xffffffff)) throw new Error('Seeds must be uint32');
  if (!Number.isFinite(o.seconds) || o.seconds <= 0 || !Number.isInteger(o.stride) || o.stride < 1) throw new Error('Invalid observation seconds/stride');
  for (const k of ['candidates', 'conditions', 'seeds']) if (new Set(o[k]).size !== o[k].length) throw new Error(`Duplicate ${k}`);
  o.out = resolve(ROOT, o.out);
  if (dirname(o.out) !== resolve(ROOT, 'evidence') || !/^recovery-support-[\w.-]+\.json$/.test(o.out.split('/').at(-1))) throw new Error('Output must be evidence/recovery-support-*.json');
  return o;
}

function pointVelocity(body, point) {
  if (typeof body.velocityAtPoint === 'function') return body.velocityAtPoint(point);
  return V(body.linvel()).add(V(body.angvel()).cross(V(point).sub(V(body.worldCom()))));
}

export function floorObservation(world, body) {
  const result = { solverPointCount: 0, manifoldCount: 0, normalImpulseNs: 0,
    verticalImpulseMagnitudeNs: 0, rawNormalForceN: 0, rawVerticalForceMagnitudeN: 0,
    maxContactHorizontalSpeedMps: null, contacts: [] };
  for (let index = 0; index < body.numColliders(); index++) {
    const collider = body.collider(index);
    world.contactPairsWith(collider, (other) => {
      const ground = other.parent();
      if (!ground?.isFixed()) return; // Scene has no walls: fixed collider is floor.
      world.contactPair(collider, other, (m, flipped) => {
        const normal = m.normal();
        let impulse = 0;
        for (let i = 0; i < m.numContacts(); i++) impulse += m.contactImpulse(i);
        result.manifoldCount++;
        result.normalImpulseNs += impulse;
        result.verticalImpulseMagnitudeNs += impulse * Math.abs(normal.y);
        const row = { normalWorld: vec(normal), flipped, normalImpulseNs: impulse,
          impulseContactCount: m.numContacts(), solverPoints: [] };
        // Solver contacts and impulse contacts are separate arrays: do not pair indices.
        for (let i = 0; i < m.numSolverContacts(); i++) {
          const point = m.solverContactPoint(i);
          const velocity = V(pointVelocity(body, point)).sub(V(pointVelocity(ground, point)));
          const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
          result.solverPointCount++;
          result.maxContactHorizontalSpeedMps = Math.max(result.maxContactHorizontalSpeedMps ?? 0, horizontalSpeed);
          row.solverPoints.push({ worldPointM: vec(point), distanceM: m.solverContactDist(i),
            relativePointVelocityMps: vec(velocity), horizontalSpeedMps: horizontalSpeed });
        }
        result.contacts.push(row);
      });
    });
  }
  result.rawNormalForceN = result.normalImpulseNs / DT;
  result.rawVerticalForceMagnitudeN = result.verticalImpulseMagnitudeNs / DT;
  // Retain historical 6/7 interpretation as a hypothesis, never substitute for raw.
  result.historicalSixSeventhsVerticalN = result.rawVerticalForceMagnitudeN * 6 / 7;
  return result;
}

function jointObservation(j) {
  const relative = j.restInv.clone().multiply(Q(j.parent.rotation()).invert().multiply(Q(j.child.rotation()))).normalize();
  if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w);
  const sine = Math.hypot(relative.x, relative.y, relative.z);
  const angle = 2 * Math.atan2(sine, relative.w);
  const rotation = sine > 0 ? new THREE.Vector3(relative.x, relative.y, relative.z).multiplyScalar(angle / sine) : new THREE.Vector3();
  const omega = V(j.child.angvel()).sub(V(j.parent.angvel())).applyQuaternion(Q(j.parent.rotation()).invert());
  return { type: j.type, restRelativeRotationVectorRad: vec(rotation),
    offLocalZRotationMagnitudeRad: Math.hypot(rotation.x, rotation.y),
    relativeAngularVelocityParentRadps: vec(omega), gain: j.gain ?? 1 };
}

function snapshot(G, timeS) {
  const f = G.player;
  const contacts = Object.fromEntries(PARTS.map((part) => [part, floorObservation(G.world, f.bodies[part])]));
  const unique = new Map(Object.values(f.bodies).map((b) => [b.handle, b]));
  for (const { rb } of f.meshes) if (rb?.isDynamic()) unique.set(rb.handle, rb);
  if (f.sword) unique.set(f.sword.handle, f.sword);
  let mass = 0; const com = new THREE.Vector3(), velocity = new THREE.Vector3();
  for (const b of unique.values()) { const m = b.mass(); mass += m; com.addScaledVector(V(b.worldCom()), m); velocity.addScaledVector(V(b.linvel()), m); }
  com.divideScalar(mass); velocity.divideScalar(mass);
  const joints = {};
  for (const part of ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB']) joints[part] = jointObservation(f.jointByName[part]);
  return { timeS, state: f.state, stateTimeS: f.stateTime, kneelTimeS: f.kneelTime,
    riseTimeS: f.riseTime, kneelAmount: f.kneelAmount, gaitActive: f.gait.active,
    retainedGaitN: { F: f.gait.legs.F.N ?? null, B: f.gait.legs.B.N ?? null },
    legF: f.limbs.legF, legB: f.limbs.legB, blood: f.blood, pain: f.pain, muscle: f.muscle,
    pelvisHeightM: f.bodies.pelvis.translation().y, pelvisVelocityMps: vec(f.bodies.pelvis.linvel()),
    chestTiltDeg: f.tiltDeg(), massKg: mass, comWorldM: vec(com), comVelocityMps: vec(velocity),
    levH: f.gait.levH, levC: f.gait.levC, handoverProgress: f.gait.handU,
    footRawVerticalN: contacts.footF.rawVerticalForceMagnitudeN + contacts.footB.rawVerticalForceMagnitudeN,
    shinRawVerticalN: contacts.shinF.rawVerticalForceMagnitudeN + contacts.shinB.rawVerticalForceMagnitudeN,
    balanceForces: f.balanceProbe ? { ...f.balanceProbe } : null,
    recovery: f.recovery ? { progress: f.recovery.progress, reason: f.recovery.reason,
      supported: f.recovery.supported ?? null, yielding: f.recovery.yielding,
      stableTimeS: f.recovery.stableTime, unsupportedTimeS: f.recovery.unsupportedTime } : null,
    contacts, joints };
}

function finite(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite observation');
  if (value && typeof value === 'object') for (const child of Object.values(value)) finite(child);
}

export function recoveryTrial(candidateName, condition, seed, seconds = 12, stride = 4) {
  const keys = ['assist', 'catchMode', 'catchScale', 'recoveryTrial'];
  const saved = Object.fromEntries(keys.map((k) => [k, CONFIG.GAIT[k]]));
  const originallyPresent = new Set(keys.filter((k) => Object.hasOwn(CONFIG.GAIT, k)));
  const random = Math.random;
  let G;
  const row = { candidateName, candidate: PRESETS[candidateName], condition, seed,
    status: 'observed', events: [], transitions: [], samples: [] };
  try {
    Object.assign(CONFIG.GAIT, PRESETS[candidateName]);
    G = newRound({ seed, walls: false, AIClass: Passive }); G.park();
    const f = G.player; f.skill.autoGuard = true; f.balanceProbe = {};
    if (PRESETS[candidateName].recoveryTrial === 'contact' && !f.recovery) {
      throw new Error('R0 is rejected and not installed. Apply tools/sim/experiments/recovery_contact_r0.patch only in an isolated research checkout to reproduce it.');
    }
    for (let i = 0; i < Math.ceil(SETTLE / DT); i++) { f.move.set(0, 0); G.step(); }
    if (f.state !== 'stand') throw new Error(`Settle precondition: ${f.state}`);
    row.settled = snapshot(G, 0);
    row.integration = { numSolverIterations: G.world.integrationParameters.numSolverIterations,
      numInternalPgsIterations: G.world.integrationParameters.numInternalPgsIterations };
    if (condition === 'unsupported') {
      const fixed = [];
      G.world.forEachRigidBody((b) => { if (b.isFixed()) fixed.push(b); });
      if (fixed.length !== 1 || fixed[0].numColliders() !== 1) throw new Error('Floor-removal scene requires exactly one fixed body with one collider');
      const floor = fixed[0].collider(0), p = floor.translation(), e = floor.halfExtents();
      if (!e || Math.abs(p.y + 0.5) > 1e-6 || Math.abs(e.y - 0.5) > 1e-6 || e.x !== 30 || e.z !== 30) throw new Error('Fixed collider does not match harness horizontal floor');
      row.events.push({ kind: 'removeFloorCollider', timeS: 0, handle: floor.handle,
        translationM: vec(p), halfExtentsM: vec(e), fixedBodyCount: fixed.length });
      G.world.removeCollider(floor, true);
      if (fixed[0].numColliders() !== 0) throw new Error('Floor removal did not complete');
    }
    if (condition === 'hurt') f.limbs.legF = 0.45;
    if (condition === 'disabled') f.limbs.legF = f.limbs.legB = 0.2;
    if (condition.startsWith('wound')) {
      const hit = { part: 'thighF', zone: 'leg', type: 'cut', severity: 0.8,
        energy: 60, bleedPerSev: CONFIG.ANATOMY.leg.bleed, local: new THREE.Vector3() };
      f.applyWound(hit);
      row.events.push({ kind: 'syntheticApplyWound', timeS: 0, ...hit });
    }
    f.knockDown(false);
    row.events.push({ kind: 'knockDown', heavy: false, timeS: 0, state: f.state });
    let previous = snapshot(G, 0), injected = false;
    row.samples.push(previous);
    const hash = createHash('sha256');
    for (let i = 0; i < Math.ceil(seconds / DT); i++) {
      if (condition.startsWith('wound_side_') && !injected && f.state === 'getup' && f.kneelAmount <= 0.75) {
        const sign = condition.endsWith('pos') ? 1 : -1;
        const impulse = new THREE.Vector3(0, 0, sign).applyQuaternion(Q(f.bodies.pelvis.rotation()));
        impulse.y = 0; impulse.normalize().multiplyScalar(18);
        f.bodies.pelvis.applyImpulse(impulse, true);
        row.events.push({ kind: 'lateralImpulse', timeS: i * DT, impulseWorldNs: vec(impulse), magnitudeNs: 18 });
        injected = true;
      }
      f.move.set(0, 0); G.step();
      const current = snapshot(G, (i + 1) * DT); finite(current); hash.update(JSON.stringify(current));
      if (current.state !== previous.state) row.transitions.push({ from: previous.state, to: current.state,
        preStep: previous, postStep: current, note: 'updateState runs before world.step; preStep is the preceding physical sample' });
      if (i % stride === 0 || current.state !== previous.state) row.samples.push(current);
      previous = current;
    }
    row.final = previous; row.traceSha256 = hash.digest('hex');
    row.sideImpulseApplied = injected;
    row.firstStandTransition = row.transitions.find((t) => t.to === 'stand') ?? null;
    row.summary = Object.fromEntries(['getup', 'kneel', 'stand', 'down', 'dead'].map((state) => {
      const s = row.samples.filter((x) => x.state === state);
      const speeds = s.flatMap((x) => ['footF', 'footB', 'shinF', 'shinB'].flatMap((part) => x.contacts[part].contacts.flatMap((m) => m.solverPoints.map((p) => p.horizontalSpeedMps))));
      return [state, { storedSamples: s.length, minPelvisHeightM: s.length ? Math.min(...s.map((x) => x.pelvisHeightM)) : null,
        maxPointHorizontalSpeedMps: speeds.length ? Math.max(...speeds) : null,
        meanFootRawVerticalN: s.length ? s.reduce((a, x) => a + x.footRawVerticalN, 0) / s.length : null }];
    }));
  } catch (error) { row.status = 'error'; row.error = error.message; }
  finally {
    Object.assign(CONFIG.GAIT, saved);
    for (const key of keys) if (!originallyPresent.has(key)) delete CONFIG.GAIT[key];
    Math.random = random; G?.world.free(); G?.eventQueue.free();
  }
  return row;
}

if (isMain(import.meta.url)) {
  try {
    const o = options(process.argv.slice(2));
    if (o.help) {
      console.log('Recovery support observations: --candidates=B,R,A,low_half,high_full --conditions=healthy,hurt,wound,wound_side_pos,wound_side_neg,disabled,unsupported --seeds=7 --seconds=12 --stride=4 --out=evidence/recovery-support-NAME.json');
    } else {
      const files = ['src/fighter.js', 'src/gait.js', 'src/recovery.js', 'src/config.js', 'tools/sim/harness_m.mjs', 'tools/sim/recovery_support_probe.mjs'];
      const hashes = async () => Object.fromEntries(await Promise.all(files.map(async (f) => {
        try { return [f, createHash('sha256').update(await readFile(resolve(ROOT, f))).digest('hex')]; }
        catch (error) { if (f === 'src/recovery.js' && error.code === 'ENOENT') return [f, null]; throw error; }
      })));
      const sourceBefore = await hashes();
      const result = { schemaVersion: 1, probe: 'recovery_support_probe', options: o, timestepS: DT,
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceBefore,
        protocol: { settleS: SETTLE, start: 'actual knockDown(false), not supine recovery',
          injury: 'hurt changes only legF=.45; wound applies cut severity.8/60J with actual bleeding; disabled changes both legs=.2. Synthetic injuries, not clinical calibration.',
          input: 'player move0, autoGuard true, enemy parked; harness G.step intact',
          unsupported: 'after settling verify single fixed floor and remove its collider; no artificial velocity/force or motor change',
          balanceForces: 'existing optional balanceProbe applied forces, not a complete force/torque ledger; recovery fields are controller state',
          forceMeaning: 'contactImpulse sum / DT is raw API interpretation; historical 6/7 is unvalidated here, retained separately',
          pointMeaning: 'actual solver world contact point; velocityAtPoint minus fixed floor velocity; not COM speed. Contact existence alone is not load-bearing.',
          jointMeaning: 'rest-relative rotation vector in joint frame; x/y magnitude is off-local-z bending, not clinical knee valgus',
          outcomeMeaning: 'observed means tool completed, not human-like recovery success' }, rows: [] };
      for (const c of o.candidates) for (const seed of o.seeds) for (const condition of o.conditions) {
        const row = recoveryTrial(c, condition, seed, o.seconds, o.stride); result.rows.push(row);
        console.error(JSON.stringify({ candidate: c, condition, status: row.status,
          firstStandS: row.firstStandTransition?.postStep.timeS ?? null, summary: row.summary }));
      }
      result.sourceAfter = await hashes();
      result.sourceUnchangedDuringRun = JSON.stringify(result.sourceBefore) === JSON.stringify(result.sourceAfter);
      await mkdir(dirname(o.out), { recursive: true }); await writeFile(o.out, JSON.stringify(result) + '\n');
      console.log(JSON.stringify({ out: o.out, rows: result.rows.length, sourceUnchangedDuringRun: result.sourceUnchangedDuringRun }));
      if (result.rows.some((r) => r.status === 'error') || !result.sourceUnchangedDuringRun) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
