// Reuse three verified support_probe cells; execute only the missing 0.1/on/0.5.
// This is a controlled scripted 2x2 matrix, not a human motion ranking.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './is_main.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_EVIDENCE = '/workspace/halfsword-hybrid-evidence';
const DEFAULT_OUT = resolve(ROOT, 'docs/strike/support_matrix_round2_metrics.json');
const CELLS = [
  { id: 'a10_half', assist: 0.1, scale: 0.5, file: null },
  { id: 'a10_full', assist: 0.1, scale: 1, file: 'final-lower-assist.json' },
  { id: 'a20_half', assist: 0.2, scale: 0.5, file: 'final-candidate.json' },
  { id: 'a20_full', assist: 0.2, scale: 1, file: 'final-same-assist-full.json' },
];
const SHA = (data) => createHash('sha256').update(data).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const oldSource = (commit, file) => execFileSync('git', ['show', `${commit}:${file}`], { cwd: ROOT });
const requireCondition = (ok, message) => { if (!ok) throw new Error(message); };
function physicsConfig(code) {
  // This exact export is audio configuration, never a body/gait parameter.
  const re = /export const SOUND = \{[\s\S]*?\n\};/g;
  requireCondition((code.match(re) ?? []).length === 1, 'Expected exactly one SOUND export');
  return code.replace(re, 'export const SOUND = { /* excluded audio configuration */ };');
}
async function dependencies(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  if (file.startsWith('node_modules/')) return seen;
  const code = await readFile(resolve(ROOT, file), 'utf8');
  // Static imports/reexports and literal dynamic imports; bare packages use package-lock.
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g;
  for (const m of code.matchAll(imports)) {
    const child = relative(ROOT, resolve(ROOT, dirname(file), m[1]));
    requireCondition(!child.startsWith('..'), `Dependency escapes repository: ${child}`);
    await dependencies(child, seen);
  }
  return seen;
}
async function verifySources(reused) {
  const reference = reused[0].data.sourceHead;
  requireCondition(reused.every(({ data }) => data.sourceHead === reference), 'Reused cells have different source commits');
  const files = [...await dependencies('tools/sim/support_probe.mjs'), 'package.json', 'package-lock.json'].sort();
  const comparisons = {};
  for (const file of files) {
    const now = await readFile(resolve(ROOT, file));
    if (file.startsWith('node_modules/')) {
      comparisons[file] = { currentSha256: SHA(now), evidence: 'Installed dependency bytes were not hashed in old results; unchanged lockfile plus exact one-scene regression support runtime compatibility.' };
      continue;
    }
    const before = oldSource(reference, file);
    const byteIdentical = SHA(before) === SHA(now);
    const physicsEquivalent = byteIdentical || (file === 'src/config.js' && physicsConfig(before.toString()) === physicsConfig(now.toString()));
    requireCondition(physicsEquivalent, `Cannot reuse evidence after physics/tool dependency change: ${file}`);
    comparisons[file] = { referenceSha256: SHA(before), currentSha256: SHA(now), byteIdentical, physicsEquivalent };
  }
  for (const { data, path } of reused) for (const [file, expected] of Object.entries(data.sourceFilesSha256)) {
    requireCondition(SHA(oldSource(reference, file)) === expected, `Recorded source hash differs from commit: ${path}: ${file}`);
  }
  return {
    referenceCommit: reference, currentCommit: git('rev-parse', 'HEAD'), comparisons,
    configDiff: execFileSync('git', ['diff', reference, '--', 'src/config.js'], { cwd: ROOT, encoding: 'utf8' }),
    configException: 'Only SOUND.fleshHit legacy -> samsho plus adjacent sound comments differ. All text outside SOUND export is identical; headless harness does not construct game audio.',
    dependencyPolicy: 'Transitive relative game/tool imports compared with recorded reference commit. Explicit node_modules entrypoints are currently hashed; historical installed bytes were not recorded. package.json/package-lock are unchanged and one-scene trace replay is checked.',
  };
}
function validate(data, cell, scenarios) {
  requireCondition(data.probe === 'support_probe' && data.status === 'ok', `Invalid probe result: ${cell.id}`);
  requireCondition(data.candidate.assist === cell.assist && data.candidate.catchMode === 'on' && data.candidate.catchScale === cell.scale, `Wrong candidate: ${cell.id}`);
  requireCondition(data.ledgerRequested === true && data.timestepS === 1 / 120, `Ledger/timestep mismatch: ${cell.id}`);
  requireCondition(JSON.stringify(data.seeds) === '[7]' && JSON.stringify(data.scenarios) === JSON.stringify(scenarios), `Scenario/seed mismatch: ${cell.id}`);
  requireCondition(data.rows.length === scenarios.length && data.rows.every((r, i) => r.scenario === scenarios[i] && r.seed === 7 && r.status === 'ok' && r.forceLedger.available), `Incomplete rows: ${cell.id}`);
}
function compact(row) {
  const { samples, forceLedger, ...rest } = row;
  const { samples: forceSamples, ...force } = forceLedger;
  return { ...rest, forceLedger: force };
}
function tableRow(data) {
  const row = (name) => data.rows.find((r) => r.scenario === name);
  const walk = row('walk'), swing = row('swing'), hurt = row('kneel_hurt_swing');
  return {
    walkAppliedUpMeanN: walk.forceLedger.metrics.appliedUpN.mean,
    walkPelvisMinimumM: walk.metrics.pelvisHeightM.min,
    walkBothFeetNoContactPercent: walk.metrics.bothFeetNoGroundContactS / walk.observedS * 100,
    swingTipMaximumMps: swing.metrics.tipSpeedMps.max,
    hurtSwingPostHandoverPelvisMinimumM: hurt.getup.geometryByPhase.afterHandoverEnded.metrics.pelvisHeightM.min,
  };
}
function difference(low, high, metadata) {
  const numericDeltas = {};
  for (const key of Object.keys(low.table)) numericDeltas[key] = high.table[key] - low.table[key];
  const scenarioDeltas = low.rows.map((a) => {
    const b = high.rows.find((r) => r.scenario === a.scenario);
    return { scenario: a.scenario, identicalTrace: a.traceSha256 === b.traceSha256,
      reflexActiveInEither: a.metrics.levC.max > 0 || b.metrics.levC.max > 0,
      appliedUpMeanN: b.forceLedger.metrics.appliedUpN.mean - a.forceLedger.metrics.appliedUpN.mean,
      pelvisMinimumM: b.metrics.pelvisHeightM.min - a.metrics.pelvisHeightM.min,
      tipMaximumMps: b.metrics.tipSpeedMps.max - a.metrics.tipSpeedMps.max,
      postHandoverPelvisMinimumM: a.getup ? b.getup.geometryByPhase.afterHandoverEnded.metrics.pelvisHeightM.min - a.getup.geometryByPhase.afterHandoverEnded.metrics.pelvisHeightM.min : null };
  });
  return { ...metadata, lowCell: low.id, highCell: high.id, subtraction: 'high minus low; percentage metric is percentage points', numericDeltas, scenarioDeltas };
}

export async function runMatrix(evidenceDir = DEFAULT_EVIDENCE, out = DEFAULT_OUT) {
  const wallStart = performance.now(), reused = [];
  for (const cell of CELLS.filter((c) => c.file)) {
    const path = resolve(evidenceDir, cell.file), raw = await readFile(path);
    reused.push({ cell, path, rawSha256: SHA(raw), data: JSON.parse(raw) });
  }
  // Verification precedes importing and executing current game modules.
  const sourceVerification = await verifySources(reused);
  const { runProbe, SCENARIOS } = await import('./support_probe.mjs');
  requireCondition(SCENARIOS.length === 9, 'Expected nine frozen scripted scenes');
  for (const { data, cell } of reused) validate(data, cell, SCENARIOS);
  const options = (assist, catchScale, scenarios) => ({ assist, catchMode: 'on', catchScale, seeds: [7], scenarios, ledger: true });
  const regressionStart = performance.now();
  const regression = runProbe(options(0.1, 1, ['walk']));
  const oldWalk = reused.find(({ cell }) => cell.id === 'a10_full').data.rows.find((r) => r.scenario === 'walk');
  requireCondition(regression.status === 'ok' && regression.rows[0].traceSha256 === oldWalk.traceSha256, 'Single walk regression does not reproduce stored trace');
  const regressionEvidence = { candidate: regression.candidate, scenario: 'walk', status: regression.status, identicalTrace: true, traceSha256: oldWalk.traceSha256, wallSeconds: (performance.now() - regressionStart) / 1000, executedScenes: 1 };
  const missingStart = performance.now(), missing = runProbe(options(0.1, 0.5, SCENARIOS));
  validate(missing, CELLS[0], SCENARIOS);
  const missingWallSeconds = (performance.now() - missingStart) / 1000;
  // Recheck the on-disk sources before attaching hashes to the new result.
  const after = await verifySources(reused);
  requireCondition(JSON.stringify(after.comparisons) === JSON.stringify(sourceVerification.comparisons), 'Sources changed while matrix was running');
  missing.sourceHead = sourceVerification.currentCommit;
  missing.sourceFilesSha256 = Object.fromEntries(Object.keys(reused[0].data.sourceFilesSha256).map((f) => [f, sourceVerification.comparisons[f].currentSha256]));
  const rawPath = resolve(evidenceDir, 'support-matrix-missing-a10-half.json'), raw = JSON.stringify(missing, null, 2) + '\n';
  await writeFile(rawPath, raw);
  const cases = CELLS.map((cell) => {
    const stored = reused.find((r) => r.cell.id === cell.id), data = stored?.data ?? missing;
    return { id: cell.id, candidate: data.candidate, sourceHead: data.sourceHead, status: data.status,
      provenance: stored ? { mode: 'reused', rawPath: stored.path, rawSha256: stored.rawSha256 } : { mode: 'newly_executed', rawPath, rawSha256: SHA(raw), wallSeconds: missingWallSeconds },
      table: tableRow(data), rows: data.rows.map(compact) };
  });
  const find = (id) => cases.find((c) => c.id === id);
  const result = {
    schemaVersion: 1, probe: 'support_matrix_round2', seed: 7, scenarios: SCENARIOS, sourceVerification,
    meaning: 'Four controlled candidate settings, nine scripted scenes each. Reused 27 observations; newly executed nine missing scenes and one trace regression. Not 36 independent human samples or proof of naturalness.',
    userObservation: 'User reported B(0.1/on/1) slightly preferable to A(0.2/on/0.5), with no large difference. This is user feedback, separate from these scripted metrics.',
    interpretation: ['No settings selected or game defaults changed.', 'Force is actual balance controller appliedUpN after clamp; not total external force or joint effort.', 'Both-feet no-contact time is solver contact absence; contact is not proof of weight bearing.', 'Posthandover height is minimum over the observed three seconds after levH ends.', 'Timed stand transition and probe geometry condition do not establish human naturalness.', 'If levC.max is zero in both compared scenes, those scenes cannot establish a reflex-strength effect.'],
    units: { walkAppliedUpMeanN: 'N', walkPelvisMinimumM: 'm', walkBothFeetNoContactPercent: '% of observed walk duration', swingTipMaximumMps: 'm/s', hurtSwingPostHandoverPelvisMinimumM: 'm', deltas: 'same units; percent deltas are percentage points' },
    singleSceneRegression: regressionEvidence, cases,
    effects: [difference(find('a10_half'), find('a10_full'), { factor: 'reflex 0.5 -> 1', heldAssist: 0.1 }), difference(find('a20_half'), find('a20_full'), { factor: 'reflex 0.5 -> 1', heldAssist: 0.2 }), difference(find('a10_half'), find('a20_half'), { factor: 'assist 0.1 -> 0.2', heldReflexScale: 0.5 }), difference(find('a10_full'), find('a20_full'), { factor: 'assist 0.1 -> 0.2', heldReflexScale: 1 })],
    execution: { command: 'node tools/sim/support_matrix.mjs', executedScenes: 10, reusedScenes: 27, comparedScenes: 36, wallSeconds: (performance.now() - wallStart) / 1000, newMissingCandidateWallSeconds: missingWallSeconds, simulatedObservationSecondsExecuted: missing.rows.reduce((n, r) => n + r.observedS, 0) + regression.rows[0].observedS, settlingIncludedInSimulatedObservationSeconds: false },
  };
  await writeFile(out, JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (isMain(import.meta.url)) {
  try {
    let evidenceDir = DEFAULT_EVIDENCE, out = DEFAULT_OUT;
    for (const arg of process.argv.slice(2)) {
      if (arg.startsWith('--evidence-dir=')) evidenceDir = arg.slice(15);
      else if (arg.startsWith('--out=')) out = arg.slice(6);
      else throw new Error('Use --evidence-dir=directory --out=metrics.json');
    }
    const result = await runMatrix(evidenceDir, out);
    process.stdout.write(JSON.stringify({ out, execution: result.execution, table: result.cases.map((c) => ({ id: c.id, ...c.table })), effects: result.effects.map(({ scenarioDeltas, ...effect }) => effect) }, null, 2) + '\n');
  } catch (error) { process.stderr.write(`support_matrix: ${error.message}\n`); process.exitCode = 1; }
}
