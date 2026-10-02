// Research only: late native motor ablation after identical catchLoad history.
import { runSameLyingRecovery, withOriginalRecovery } from './same_lying_recovery_probe.mjs';
import { transformRecoveryLoadGait } from './recovery_load_candidate.mjs';
import { createUprightMotorState, configureUprightMotor } from './upright_motor_candidate.mjs';
import { RAPIER } from '../harness_m.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const ROOT = new URL('../../../', import.meta.url);
const EXPECTED_BASELINE = '178f2b69d673e1204a32b35ebb9728459a38615a750cb20d4623b8ade4b95999';
const FRAME = 772, DT = 1 / 120, SWITCH_S = FRAME * DT;
const hash = x => createHash('sha256').update(x).digest('hex');
const args = process.argv.slice(2);
if (args.length > 1 || args.some(x => !/^--out=.+$/.test(x))) throw Error('Only --out=PATH is supported');
const output = args[0]?.slice(6) ?? '/workspace/halfsword-hybrid-evidence/late-upright.json';
try { await access(output); throw Error('Refusing to overwrite existing evidence: ' + output); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

async function manifest() {
  async function files(dir) {
    const out = [];
    for (const entry of await readdir(new URL(dir, ROOT), { withFileTypes: true })) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) out.push(...await files(path));
      else if (entry.name.endsWith('.js')) out.push(path);
    }
    return out;
  }
  const paths = [...await files('src'), 'tools/sim/experiments/late_upright_probe.mjs',
    'tools/sim/experiments/same_lying_recovery_probe.mjs', 'tools/sim/experiments/recovery_load_candidate.mjs',
    'tools/sim/experiments/upright_motor_candidate.mjs', 'tools/sim/force_ledger.mjs',
    'tools/sim/harness_m.mjs', 'package-lock.json'];
  return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, hash(await readFile(new URL(path, ROOT)))])));
}

const vector = value => ({ x: value.x, y: value.y, z: value.z });
function bodyState(body) {
  const q = body.rotation(), iFrame = body.principalInertiaLocalFrame();
  return { handle: String(body.handle), position: vector(body.translation()), rotation: { ...vector(q), w: q.w },
    velocity: vector(body.linvel()), omega: vector(body.angvel()), massKg: body.mass(),
    localCOM: vector(body.localCom()), inertia: vector(body.principalInertia()),
    inertiaFrame: { ...vector(iFrame), w: iFrame.w } };
}
// Capture numeric/vector controller state without serializing raw WASM allocation pointers,
// methods, rendering objects, or rigid-body wrappers. Full native data is hashed separately.
function encode(value, depth = 0) {
  if (value == null || ['string', 'boolean', 'number'].includes(typeof value)) return value;
  if (typeof value === 'function' || depth > 6) return undefined;
  if (value.isVector2 || value.isVector3 || value.isQuaternion || value.isEuler) return value.toArray();
  if (Array.isArray(value)) return value.map(x => encode(x, depth + 1));
  if (value instanceof Map) return [...value].map(([k, v]) => [encode(k, depth + 1), encode(v, depth + 1)]);
  if (value instanceof Set) return [...value].map(x => encode(x, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return undefined;
  return Object.fromEntries(Object.keys(value).sort().flatMap(key => {
    const x = encode(value[key], depth + 1); return x === undefined ? [] : [[key, x]];
  }));
}
function ownState(object) {
  return Object.fromEntries(Object.keys(object).sort().flatMap(key => {
    const x = encode(object[key]); return x === undefined ? [] : [[key, x]];
  }));
}
function capture(f) {
  const bodies = [...new Map([...Object.values(f.bodies), f.sword, ...f.meshes.map(m => m.rb)]
    .filter(b => b?.isValid() && b.isDynamic()).map(b => [b.handle, b])).values()];
  return { bodyStates: bodies.map(bodyState), anchor: bodyState(f.anchor),
    fighterOwn: ownState(f), gaitOwn: ownState(f.gait), skillOwn: ownState(f.skill),
    joints: f.joints.map(j => ({ name: j.name, handle: String(j.joint.handle), manual: j.manual,
      target: j.target.toArray(), prevRV: j.prevRV?.toArray() ?? null, gain: j.gain ?? 1,
      anchors: [vector(j.joint.anchor1()), vector(j.joint.anchor2())] })) };
}

let CandidateGait, directory, transformedHash;
async function prepareCandidate() {
  const source = await readFile(new URL('src/gait.js', ROOT), 'utf8');
  const imports = source.replace("from 'three'", 'from ' + JSON.stringify(import.meta.resolve('three')))
    .replace("from './config.js'", 'from ' + JSON.stringify(new URL('src/config.js', ROOT).href));
  if (imports.includes("from './config.js'") || imports === source) throw Error('Shared imports were not isolated');
  const transformed = transformRecoveryLoadGait(imports, { preload: false, selectByLoad: true,
    contactModuleUrl: new URL('src/support_contacts.js', ROOT).href });
  transformedHash = hash(transformed);
  directory = await mkdtemp(join(tmpdir(), 'halfsword-late-upright-'));
  const path = join(directory, 'catch-load.mjs');
  await writeFile(path, transformed);
  ({ Gait: CandidateGait } = await import(pathToFileURL(path).href));
}

function intervention(kind, expectedLate = null) {
  const undo = [], prefix = createHash('sha256');
  let active = false, capturedFrames = 0;
  return {
    activate({ f, row, ledger }) {
      if (typeof ledger?.replaceObservedMethod !== 'function') throw Error('Observed method dispatch API required');
      row.intervention = { kind, candidateUpdateCalls: 0, removed: 0, recreated: 0, zeroRequestsDisabled: 0, batches: [] };
      for (const name of Object.getOwnPropertyNames(CandidateGait.prototype)) {
        const candidate = Object.getOwnPropertyDescriptor(CandidateGait.prototype, name)?.value;
        if (name === 'constructor' || typeof candidate !== 'function') continue;
        const replacement = name === 'update' ? function (...args) {
          row.intervention.candidateUpdateCalls++; return candidate.apply(this, args);
        } : candidate;
        undo.push(ledger.replaceObservedMethod(f.gait, name, replacement));
      }
    },
    afterStep({ G, f, row, observation, iteration }) {
      if (iteration + 1 <= FRAME) {
        prefix.update(JSON.stringify(capture(f))); capturedFrames++;
      }
      if (iteration + 1 === FRAME) {
        const control = capture(f);
        row.lateCheckpoint = { frame: FRAME, timeS: observation.timeS,
          nativeWorldSha256: hash(G.world.takeSnapshot()), controllerSha256: hash(JSON.stringify(control)),
          bodyPrefixSha256: prefix.digest('hex'), prefixFrames: capturedFrames, control,
          beforeInterventionObservation: observation, preStepUprightScale: f.balanceProbe?.uprightScale };
        if (expectedLate) {
          const gate = ['nativeWorldSha256', 'controllerSha256', 'bodyPrefixSha256', 'prefixFrames']
            .every(key => row.lateCheckpoint[key] === expectedLate[key]);
          row.lateCheckpoint.matchedBaseline = gate;
          if (!gate) throw Error('Late native/controller/prefix checkpoint mismatch');
        }
        if (kind === 'lateNativeDisable') {
          const before = hash(JSON.stringify(capture(f))), nativeBefore = hash(G.world.takeSnapshot());
          const raw = f.uprightJoint.rawSet, original = raw.jointConfigureMotorPosition;
          const owned = new Set([f.uprightJoint.handle]);
          const state = createUprightMotorState({ world: G.world, joint: f.uprightJoint,
            activeAxes: [3, 4, 5], createJoint() {
              const joint = G.world.createImpulseJoint(RAPIER.JointData.generic(
                { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0), f.anchor, f.bodies.pelvis, true);
              owned.add(joint.handle); return joint;
            } });
          let requests = [], applying = false;
          raw.jointConfigureMotorPosition = function (handle, axis, target, stiffness, damping) {
            if (applying || !owned.has(handle)) return original.call(this, handle, axis, target, stiffness, damping);
            requests.push({ axis, target, stiffness, damping });
            if (requests.length !== 3) return;
            const previous = state.joint;
            applying = true;
            try {
              const current = configureUprightMotor(state, requests);
              if (current !== previous) { row.intervention.removed += +!!previous; row.intervention.recreated += +!!current; }
              if (current) f.uprightJoint = current;
              const zero = requests.filter(r => r.stiffness === 0 && r.damping === 0).length;
              row.intervention.zeroRequestsDisabled += zero;
              const timeS = G.t - row.prepareSeconds;
              if (timeS < SWITCH_S + .15 || current !== previous) row.intervention.batches.push({ timeS,
                requests: requests.map(r => ({ ...r })), removed: !!previous && current !== previous,
                recreated: !!current && current !== previous });
            } finally { applying = false; requests = []; }
          };
          undo.push(() => { raw.jointConfigureMotorPosition = original; });
          row.lateCheckpoint.hookInstallPreservesController = before === hash(JSON.stringify(capture(f)));
          row.lateCheckpoint.hookInstallPreservesNative = nativeBefore === hash(G.world.takeSnapshot());
          if (!row.lateCheckpoint.hookInstallPreservesController || !row.lateCheckpoint.hookInstallPreservesNative)
            throw Error('Installing the late hook changed physical/native state');
          active = true;
        }
      }
      if (f.gait.recoveryLoadProbe) row.intervention.recoveryLoadProbe = encode(f.gait.recoveryLoadProbe);
      if (active) row.intervention.lateActive = true;
    },
    restore() { for (const restore of undo.reverse()) restore(); },
  };
}

function summary(row) {
  const frames = row.launchObservation?.compactPerStep ?? [];
  let maximum = null;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (b.timeS <= SWITCH_S) continue;
    const deltaKJ = b.KJ - a.KJ;
    const deltaMechanicalJ = deltaKJ + 9.81 * (b.massKg * b.COM.y - a.massKg * a.COM.y);
    if (!maximum || deltaMechanicalJ > maximum.deltaMechanicalJ) maximum = { timeS: b.timeS, deltaKJ, deltaMechanicalJ,
      massChanges: b.massChanges, explicitWorkApproxJ: b.explicitWorkApproxJ, maxJointAnchorGapM: b.maxJointAnchorGapM };
  }
  return { kind: row.intervention?.kind, status: row.status, error: row.error ?? null,
    traceSha256: row.traceSha256, lateMatched: row.lateCheckpoint?.matchedBaseline,
    refalls: row.postStandRefallTransitions?.length, maxPostSwitchEnergyStep: maximum,
    maxKJ: Math.max(...frames.map(f => f.KJ)), maxHeightM: Math.max(...frames.map(f => f.pelvisHeightM)),
    maxGapM: Math.max(...frames.map(f => f.maxJointAnchorGapM)),
    firstPostSwitch: frames.filter(f => f.timeS >= SWITCH_S && f.timeS <= 6.55).map(f => ({ timeS: f.timeS,
      state: f.state, KJ: f.KJ, massKg: f.massKg, pelvisHeightM: f.pelvisHeightM,
      pelvisVyMps: f.pelvisVelocityMps.y, maxJointAnchorGapM: f.maxJointAnchorGapM,
      nonPredictiveSolverPoints: f.nonPredictiveSolverPoints, controllerSupport: f.controllerSupport,
      explicitWorkApproxJ: f.explicitWorkApproxJ })) };
}

const before = await manifest(), start = performance.now(), rows = [], guards = {};
let error = null;
try {
  await prepareCandidate();
  await withOriginalRecovery(async reference => {
    const original = runSameLyingRecovery({ scenario: 'hurt_getup', model: 'axial' });
    guards.originalExact = original.status === 'observed'
      && original.traceSha256 === reference.expectedOriginalTraceSha256.hurt_getup;
    if (!guards.originalExact) throw Error('Original exact-trace gate failed');
    const baseline = runSameLyingRecovery({ scenario: 'hurt_getup', model: 'projected',
      expectedSwitch: original.switchSnapshot, intervention: intervention('zeroContinues') });
    rows.push(baseline);
    guards.baselineExact = baseline.status === 'observed' && baseline.traceSha256 === EXPECTED_BASELINE;
    guards.baselineCandidateExecuted = baseline.intervention?.candidateUpdateCalls > 0
      && baseline.intervention?.recoveryLoadProbe?.updateCount > 0;
    if (!guards.baselineExact || !guards.baselineCandidateExecuted || !baseline.lateCheckpoint)
      throw Error('CatchLoad exact baseline/execution gate failed');
    const candidate = runSameLyingRecovery({ scenario: 'hurt_getup', model: 'projected',
      expectedSwitch: original.switchSnapshot, intervention: intervention('lateNativeDisable', baseline.lateCheckpoint) });
    rows.push(candidate);
    guards.lateExact = candidate.status === 'observed' && candidate.lateCheckpoint?.matchedBaseline === true;
    guards.candidateExecuted = candidate.intervention?.candidateUpdateCalls > 0
      && candidate.intervention?.zeroRequestsDisabled > 0 && candidate.intervention?.removed > 0;
    guards.sameInput = baseline.inputSha256 === candidate.inputSha256;
    if (!guards.lateExact || !guards.candidateExecuted || !guards.sameInput) throw Error('Late intervention evidence gate failed');
  });
} catch (caught) { error = caught.stack; }
finally { if (directory) await rm(directory, { recursive: true, force: true }); }
const after = await manifest();
const result = { probe: 'late_upright', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  sourceSha256: before, sourceSha256After: after, sourceStable: JSON.stringify(before) === JSON.stringify(after),
  transformedGaitSha256: transformedHash, expectedBaselineTraceSha256: EXPECTED_BASELINE,
  protocol: { scenario: 'hurt_getup', timestepS: DT, switchFrame: FRAME, switchTimeS: SWITCH_S,
    scope: 'Identical matched low-down checkpoint and catchLoad control. Replay both branches to frame772 with matching native snapshot and scalar/vector/joint/gait/body prefix hashes. Only future zero-coefficient upright requests are truly disabled in the late branch.',
    captureDefinition: 'Explicit dynamic body/anchor transforms, velocities, mass/inertia; fighter/gait/skill own scalar/vector/plain fields; joint targets/prevRV/gain/anchors. Excludes methods, arbitrary class instances and WASM wrapper pointers; complete native state is separately hashed.',
    caution: 'Energy differences include unmeasured native motor/contact work. Momentum residual is not an energy supply measurement. No recovery acceptance claimed.' },
  wallSeconds: (performance.now() - start) / 1000, guards, error, summary: rows.map(summary), rows };
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
await writeFile(output.replace(/\.json$/, '') + '.summary.json', JSON.stringify({ ...result, rows: undefined }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ out: output, sourceStable: result.sourceStable, guards, error,
  wallSeconds: result.wallSeconds, summary: result.summary.map(({ firstPostSwitch, ...row }) => row) }));
if (error || !result.sourceStable || Object.values(guards).some(value => !value)) process.exitCode = 1;
