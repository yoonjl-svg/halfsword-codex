/** Read-only reduction of swordsmanship_probe output. Never imports physics. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const [input, out] = process.argv.slice(2);
assert(input && out && path.isAbsolute(input) && path.isAbsolute(out) && !fs.existsSync(out),
  'Use an existing absolute raw input and a fresh absolute derived output.');
const bytes = fs.readFileSync(input), raw = JSON.parse(bytes);
assert.equal(raw.probe, 'swordsmanship');
const sha = x => createHash('sha256').update(x).digest('hex');
const distance = (a, b) => a && b ? Math.hypot(...a.map((v, i) => v - b[i])) : null;
const angle = (a, b) => a && b && Math.hypot(...a) && Math.hypot(...b) ?
  Math.acos(Math.max(-1, Math.min(1, a.reduce((s, v, i) => s + v*b[i], 0)/(Math.hypot(...a)*Math.hypot(...b))))) : null;
const stats = values => {
  const xs = values.filter(Number.isFinite);
  if (!xs.length) return { count: 0 };
  return { count: xs.length, minimum: Math.min(...xs), mean: xs.reduce((a, b) => a + b, 0)/xs.length, maximum: Math.max(...xs) };
};
const counts = xs => Object.fromEntries([...new Set(xs)].map(x => [x, xs.filter(y => x === y).length]));
function movement(frames) {
  const changes = frames.slice(1).map((f, i) => ({
    tick: f.tick, timeS: f.timeS, phase: f.phase,
    requestedHandStepM: distance(f.control.handBase, frames[i].control.handBase),
    requestedWorldHandStepM: distance(f.physical.handTargetWorld, frames[i].physical.handTargetWorld),
    requestedWorldAimStepRad: angle(f.physical.aimWorld, frames[i].physical.aimWorld),
    actualHandStepM: distance(f.physical.handWorld, frames[i].physical.handWorld),
    actualBladeAxisStepRad: angle(f.physical.sword.axis, frames[i].physical.sword.axis),
    tap: !!f.control.tap, priorTap: !!frames[i].control.tap,
    alive: f.health.alive, state: f.health.state,
  }));
  const fields = ['requestedHandStepM', 'requestedWorldHandStepM', 'requestedWorldAimStepRad', 'actualHandStepM', 'actualBladeAxisStepRad'];
  return {
    statistics: Object.fromEntries(fields.map(k => [k, stats(changes.map(x => x[k]))])),
    largest: Object.fromEntries(fields.map(k => [k, [...changes].sort((a, b) => (b[k] ?? -1)-(a[k] ?? -1)).slice(0, 3)])),
  };
}
function independentProjection(frames) {
  const values=[];
  for(let i=1;i<frames.length;i++) {
    const f=frames[i],p=frames[i-1],s=f.control.assist?.state,old=p.control.assist?.state;
    if(!s?.moving||s.owner!=='player'||old?.owner!=='player'||!s.rawHand||!old.rawHand||f.control.tap||p.control.tap||f.control.finish.weight>0||p.control.finish.weight>0)continue;
    const dr=s.rawHand.map((v,k)=>v-old.rawHand[k]),dh=f.control.handBase.map((v,k)=>v-p.control.handBase[k]),den=dr[1]**2+dr[2]**2;
    if(den>1e-12)values.push({tick:f.tick,timeS:f.timeS,phase:f.phase,value:(dh[1]*dr[1]+dh[2]*dr[2])/den});
  }
  return {statistics:stats(values.map(x=>x.value)),lowest:values.sort((a,b)=>a.value-b.value).slice(0,3),
    definition:'Independently computed from resolved Fighter.handBase and stored raw-hand successive plane displacements. Ordinary moving/player-owned steps only; no use of the controller-reported retainedProjection.'};
}
function summarize(frames) {
  return {
    steps: frames.length, seconds: frames.length*raw.dt,
    healthyFrames: frames.filter(f => f.healthy).length,
    stateFrames: counts(frames.map(f => f.health.state)),
    controllerPhaseFrames: counts(frames.map(f => f.control.assist?.state?.phase ?? 'none')),
    postureMix: stats(frames.map(f => f.control.assist?.state?.postureMix)),
    handGuidanceM: stats(frames.map(f => {const s=f.control.assist?.state;return s?.handCorrection ? Math.hypot(...s.handCorrection) : s?.handDeltaM;})),
    aimGuidanceRad: stats(frames.map(f => {const s=f.control.assist?.state;return s?.aimCorrection ? 2*Math.acos(Math.min(1,Math.abs(s.aimCorrection[3]))) : s?.aimDeltaRad;})),
    correctionChangeM: stats(frames.map(f => f.control.assist?.state?.handChangeM)),
    correctionChangeRad: stats(frames.map(f => f.control.assist?.state?.aimChangeRad)),
    retainedPlanarProjection: stats(frames.map(f => f.control.assist?.state?.retainedProjection)),
    independentlyObservedPlanarProjection: independentProjection(frames),
    bodyWeight: stats(frames.map(f => f.control.bodyWeight)),
    bodyPose: Object.fromEntries(['pelvisYaw','chestYaw','pitch','drop'].map(k => [k, stats(frames.map(f => f.control.bodyPose[k]))])),
    generatedReturnFrames: frames.filter(f => f.accounting.generatedStepM > 1e-12).length,
    generatedWhileHeldOrActiveFrames: frames.filter(f => f.accounting.generatedWhileHeldOrActive).length,
    generatedAndNewSwingFrames: frames.filter(f => f.accounting.generatedAndNewSwing).length,
    generatedAndNewLungeFrames: frames.filter(f => f.accounting.generatedAndNewLunge).length,
    inputVelocityAccountingErrorMps: stats(frames.map(f => f.accounting.inputVelocityErrorMps)),
    padAccountingErrorM: stats(frames.map(f => f.accounting.padAccountingErrorM)),
    handTrackingErrorM: stats(frames.map(f => f.physical.handErrorM)),
    aimTrackingErrorRad: stats(frames.map(f => f.physical.aimErrorRad)),
    actualTipSpeedMps: stats(frames.map(f => f.physical.sword.tipSpeedMps)),
    actualIntentProjectedTipSpeedMps: stats(frames.map(f => f.physical.sword.intentProjectedTipSpeedMps)),
    actualSwordOmegaRadps: stats(frames.map(f => f.physical.sword.omegaRadps)),
    actualSwordAxialOmegaRadps: stats(frames.map(f => f.physical.sword.axialOmegaRadps)),
    swordAxisForearmDot: stats(frames.map(f => f.physical.swordAxisForearmDot)),
    jointGapM: stats(frames.map(f => Math.max(...Object.values(f.physical.jointGapM)))),
    tiltDeg: stats(frames.map(f => f.physical.tiltDeg)),
    supportNormalReferenceN: Object.fromEntries(['F','B'].map(k => [k, stats(frames.map(f => f.physical.support[k]?.N))])),
    massPropertyChangeFrames: frames.filter(f => f.ledger?.massPropertyChanges?.length).length,
    explicitBodyOverrideCalls: frames.reduce((n, f) => n+(f.ledger?.bodyOverrides?.length ?? 0), 0),
    explicitTorqueIntegralNms: frames.reduce((n, f) => n+(f.ledger?.explicitTorqueCalls ?? []).reduce((sum, c) => sum+Math.hypot(...c.torque)*raw.dt, 0), 0),
    explicitSignedWorkApproxJ: frames.reduce((n, f) => n+(f.ledger?.signedWorkApproxJ ?? 0), 0),
    opponentContactFrames: frames.filter(f => f.opponentContact).length,
    movement: movement(frames),
  };
}
function eventWindows(row) {
  return row.frames.flatMap((f, i) => {
    const p = row.frames[i-1];
    const reasons = [];
    if (f.request.tap) reasons.push('tap_requested');
    if (p && !!p.control.tap && !f.control.tap) reasons.push('tap_finished');
    if (p && !p.request.held && f.request.held) reasons.push('reheld');
    if (p && p.health.state !== f.health.state) reasons.push('state_changed');
    if (p && p.health.alive && !f.health.alive) reasons.push('died');
    if (!reasons.length) return [];
    const window = row.frames.slice(Math.max(0, i-2), i+4);
    return [{ reasons, tick: f.tick, timeS: f.timeS, phase: f.phase, movement: movement(window), frames: window.map(x => ({
      tick: x.tick, phase: x.phase, delta: x.request.delta, held: x.request.held, active: x.request.active,
      handBase: x.control.handBase, worldHandGoal: x.physical.handTargetWorld, worldAimGoal: x.physical.aimWorld,
      actualHand: x.physical.handWorld, actualSwordAxis: x.physical.sword.axis, assist: x.control.assist,
      tap: x.control.tap, health: x.health, accounting: x.accounting,
    })) }];
  });
}
const rows = raw.rows.map(row => ({
  weapon: row.weapon, model: row.model, scene: row.scene, fixtureChecks: row.fixtureChecks, observations: row.observations,
  creationNativeSHA256: row.creationNativeSHA256, nativeTraceSHA256: row.nativeTraceSHA256,
  suppliedInputSHA256: row.suppliedInputSHA256, appliedInputSHA256: row.appliedInputSHA256,
  first: row.frames[0] ? { input: row.frames[0].inputApplied, control: row.frames[0].control, physical: row.frames[0].physical } : null,
  all: summarize(row.frames), phases: Object.fromEntries([...new Set(row.frames.map(f => f.phase))].map(p => [p, summarize(row.frames.filter(f => f.phase === p))])),
  eventWindows: eventWindows(row), taps: row.taps, wounds: row.wounds, observerCounts: row.observerCounts,
}));
const paired = raw.comparisons.map(pair => {
  const reference = raw.rows.find(r => r.weapon === pair.weapon && r.model === 'reference');
  const candidate = raw.rows.find(r => r.weapon === pair.weapon && r.model === 'candidate');
  let firstNativeDivergence = null, firstEnemyInputDivergence = null;
  for (let i=0; i<Math.min(reference.frames.length, candidate.frames.length); i++) {
    const a=reference.frames[i], b=candidate.frames[i];
    if (firstNativeDivergence === null && a.nativeSHA256 !== b.nativeSHA256) firstNativeDivergence = a.timeS;
    if (firstEnemyInputDivergence === null && JSON.stringify(a.enemyInput) !== JSON.stringify(b.enemyInput)) firstEnemyInputDivergence = a.timeS;
  }
  return { ...pair, firstNativeDivergenceS: firstNativeDivergence, firstEnemyInputDivergenceS: firstEnemyInputDivergence,
    phaseComparisons: Object.fromEntries([...new Set(reference.frames.map(f => f.phase))].map(p => {
      const a = reference.frames.filter(f => f.phase === p), b = candidate.frames.filter(f => f.phase === p);
      return [p, { reference: summarize(a), candidate: summarize(b),
        finalRequestedHandDifferenceM: distance(a.at(-1)?.control.handBase, b.at(-1)?.control.handBase),
        finalRequestedAimDifferenceRad: angle(a.at(-1)?.physical.aimWorld, b.at(-1)?.physical.aimWorld),
        finalAchievedHandDifferenceM: distance(a.at(-1)?.physical.handWorld, b.at(-1)?.physical.handWorld),
      }];
    })),
  };
});
const report = {
  schemaVersion: 1, rawPath: input, rawBytes: bytes.length, rawSHA256: sha(bytes),
  sourceCommit: raw.sourceCommit, sourceStable: raw.sourceStable, headStable: raw.headStable,
  fixturePass: raw.fixturePass, effectAccepted: false, exactCLI: raw.command, derivedCLI: process.argv,
  protocol: raw.protocol, rows, comparisons: paired,
  definitions: {
    requestedVersusActual: 'Hand-base/world hand/aim differences are controller requests. Actual hand and sword-axis differences are solved native results. Neither is interchangeable with force, torque or human naturalness.',
    contact: 'Original reactive opponent and native contacts remain active. Subsequent divergent attacks or injuries do not establish matched-injury efficacy or victory benefit.',
    force: 'Torque magnitude is summed per explicit call and recipient; equal/opposite reaction calls remain separate. Signed work is the existing ledger midpoint approximation; native motor/contact/upright work is excluded.',
    inertia: 'Post-stop/reversal actual velocity and signed intent speed remain observations. Lower speed or tracking error alone is not acceptance; purposeful inertia may remain.',
    anatomy: 'Sword-axis/forearm dot and joint gap are geometric observations. They do not certify anatomical grip or skillful human movement.',
    fixture: 'Complete finite schedule, source stability and explicitly listed input/accounting/creation checks only. Optional all-weapon smoke is compatibility screening, not a paired efficacy test.',
    evidence: 'This derive reads every stored frame but performs no additional physics run, no threshold or seed search, and no substitution for unexposed contact/injury/getup/finish states.',
  },
};
fs.writeFileSync(out, JSON.stringify(report, null, 2)+'\n', { flag: 'wx' });
console.log(JSON.stringify({ output: out, rows: rows.length, rawSHA256: report.rawSHA256, fixturePass: report.fixturePass }));
