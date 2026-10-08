// Review saved actual native traces without repeating the physics experiment.
// The older probe assumes policy changes occur at injury application; power
// can first alter the contact filter's predicted penetration before that hit.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [dir, out] = process.argv.slice(2);
assert(path.isAbsolute(dir) && path.isAbsolute(out) && !fs.existsSync(out));
const sha = x => createHash('sha256').update(x).digest('hex');
const reportPath = path.join(dir, 'report.json');
const original = JSON.parse(fs.readFileSync(reportPath));
assert(original.sourceStable && original.candidateModel === 'power');
const rows = [], artifacts = [];
for (const weapon of ['longsword', 'rapier']) for (const armor of ['none', 'plate']) {
  const [a, b] = ['legacy', 'power'].map(model => {
    const file = path.join(dir, `${weapon}-${armor}-${model}.json`), bytes = fs.readFileSync(file);
    artifacts.push({ file, sha256: sha(bytes), bytes: bytes.length });
    const row = JSON.parse(bytes); assert(!row.error); return row;
  });
  const prediction = a.predictions.find(p => p.result.pass !== p.candidate.pass);
  const firstActual = Math.min(a.firstPolicyIntervention ?? Infinity, b.firstPolicyIntervention ?? Infinity);
  const boundary = Math.min(prediction?.tick ?? Infinity, firstActual);
  assert(Number.isFinite(boundary));
  assert.equal(a.spawnSHA256, b.spawnSHA256);
  assert.equal(a.inputs.length, b.inputs.length);
  assert.deepEqual(a.inputs, b.inputs);
  assert(a.frames.slice(0, boundary).every((f, i) => f[1] === b.frames[i][1] && f[2] === b.frames[i][2]));
  const actuals = b.contacts.filter(c => c.actual?.finishingStrike);
  assert(actuals.length > 0);
  for (const c of actuals) {
    assert.equal(c.actual.finish, false); assert.equal(c.actual.finishPower, 2.5);
    assert(Math.abs(c.actual.eff - c.shadow.legacy.eff * 2.5) < 1e-9);
    assert.equal(c.actual.pass, c.shadow.candidate.pass);
    for (const k of ['energy','ephys','mEff','eff','thr','severity','speed']) assert(Number.isFinite(c.actual[k]));
    assert(c.after.wounds > c.before.wounds);
    assert.equal(c.after.state, 'down'); // these chest hits injure, not instant-kill
  }
  for (const r of b.rebounds) if (r.rebound) assert(Number.isFinite(r.rebound.J));
  rows.push({ weapon, armor, stepsPerVariant: b.steps, firstEffectivePolicyTick: boundary,
    firstPredictedPassChange: prediction ? { tick: prediction.tick, before: prediction.result.pass, after: prediction.candidate.pass } : null,
    matchedBeforePolicy: true, firstNativeDifference: a.frames.findIndex((f, i) => f[1] !== b.frames[i][1]),
    firstActual: actuals[0], final: b.final });
}
const result = { pass: true, originalReportSHA256: sha(fs.readFileSync(reportPath)),
  originalMeasurementValid: original.measurementValid,
  correction: 'Original injury-boundary prefix check rejects legitimate earlier predicted-pass changes. This read-only review checks identical spawn/input/native/controller prefix up to earliest contact-filter pass or actual injury policy change. Original failed report preserved; no physics rerun.',
  executions: original.executionCount, nativeSteps: original.steps, source: original.source,
  artifacts, rows };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, executions: result.executions, nativeSteps: result.nativeSteps,
  rows: rows.map(r=>({weapon:r.weapon,armor:r.armor,policyTick:r.firstEffectivePolicyTick,
    nativeDifference:r.firstNativeDifference, eff:r.firstActual.actual.eff, threshold:r.firstActual.actual.thr,
    severity:r.firstActual.actual.severity, finalAlive:r.final.enemy.alive})) }, null, 2));
