// Actual AI hand-controller regression. No Fighter, world, combat or browser is run.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { AI } from '../../src/ai.js';
import { AI_LEVELS, PHYSICS } from '../../src/config.js';
import { TECH, TECH_BY_NAME, FEINTS, G } from '../../src/ai_techniques.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const mode = arg('mode') ?? 'candidate';
const out = arg('out');
const baselinePath = arg('baseline');
if (!['baseline', 'candidate'].includes(mode) || !out || (mode === 'candidate' && !baselinePath)) {
  throw new Error('Use --mode=baseline|candidate --out=FRESH.json [--baseline=BASELINE.json for candidate]');
}
if (fs.existsSync(out)) throw new Error(`Refusing to overwrite evidence: ${out}`);
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
const sources = ['src/ai.js', 'src/config.js', 'src/ai_techniques.js', 'tools/sim/ai_hand_path.test.mjs'];
const hashes = () => Object.fromEntries(sources.map((name) => [name, digest(fs.readFileSync(path.join(repo, name)))]));
const dt = PHYSICS.timestep, limit = 600, radius = 0.62;
const result = {
  kind: 'actual_ai_moveHand_controller_regression', mode, createdUTC: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  command: [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)],
  sourceBefore: hashes(), actualMethodSource: AI.prototype.moveHand.toString(),
  dt, maxControllerStepsPerCase: limit, physicsSteps: 0, browserExecutions: 0,
  assertions: [], rows: [],
  limitations: [
    'Minimal Vector2 fixtures invoke actual AI.prototype.moveHand with actual technique and AI_LEVELS data.',
    'Constant lateral offset is a controlled controller condition, not a natural-match frequency or gameplay outcome.',
    'Completion means consuming the hand path, not a physical strike, damage, follow-up AI decision or posture success.',
    'Fear is zero; the intentional fear-tremor speed exception and feint hold timing are outside this regression.',
    'The unchanged 2-second opening hold, camera, enemy model, difficulty values and physics are not modified.',
  ],
};
function check(name, ok, detail = undefined) {
  result.assertions.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
}
function fixture(levelName, spec) {
  return {
    me: { handOffset: new THREE.Vector2(...spec.start) },
    hand: new THREE.Vector2(...spec.goal), handSpeed: spec.guard ? 1.2 : AI_LEVELS[levelName].strikeSpeed,
    mode: spec.guard ? 'watch' : 'attack', phase: spec.guard ? 'ready' : 'strike',
    path: spec.guard ? [] : spec.path.map((p) => [...p]), foeLat: spec.lateral,
    level: AI_LEVELS[levelName], fear: 0, feintHold: 0, feintPts: 0,
    tremor: new THREE.Vector2(), tremorApplied: new THREE.Vector2(), tremorT: 0,
  };
}
function run(levelName, spec, keepFrames) {
  const ai = fixture(levelName, spec);
  const initial = [...ai.me.handOffset];
  const frames = [];
  let completed = false, maxRadius = ai.me.handOffset.length(), maxSpeed = 0, randomCalls = 0;
  const original = Math.random;
  Math.random = () => { randomCalls++; return 0.5; };
  try {
    for (let step = 1; step <= limit; step++) {
      const x = ai.me.handOffset.x, y = ai.me.handOffset.y;
      AI.prototype.moveHand.call(ai, dt);
      maxRadius = Math.max(maxRadius, ai.me.handOffset.length());
      maxSpeed = Math.max(maxSpeed, Math.hypot(ai.me.handOffset.x - x, ai.me.handOffset.y - y) / dt);
      frames.push([ai.me.handOffset.x, ai.me.handOffset.y, ai.path.length]);
      completed = spec.guard ? ai.me.handOffset.distanceTo(ai.hand) <= 1e-12 : ai.path.length === 0;
      if (completed) break;
    }
  } finally { Math.random = original; }
  const row = {
    id: `${levelName}/${spec.id}`, category: spec.category, levelName,
    handSpeed: ai.handSpeed, technique: spec.technique, lateral: spec.lateral,
    initial, inputPath: spec.path, goal: spec.goal, completed, steps: frames.length,
    remainingPath: ai.path, final: [...ai.me.handOffset], maxRadius, maxSpeed, randomCalls,
    framesSha256: digest(JSON.stringify(frames)),
    ...(keepFrames ? { frames } : { firstFrames: frames.slice(0, 3), lastFrames: frames.slice(-3) }),
  };
  check(`${row.id}: bounded hand and finite speed`, Number.isFinite(maxSpeed) && maxRadius <= radius + 1e-12);
  check(`${row.id}: commanded speed bound`, maxSpeed <= ai.handSpeed + 1e-10);
  check(`${row.id}: fear-zero controller consumes no RNG`, randomCalls === 0);
  result.rows.push(row);
  return row;
}
const pathSpec = (technique, lateral, category = 'in-bound') => {
  const tech = TECH_BY_NAME[technique];
  return { id: `${technique}/lat${lateral}`, category, technique, lateral,
    start: tech.from, path: tech.path, goal: tech.path.at(-1) };
};

try {
  check('Native timestep is exactly 1/120 seconds', dt === 1 / 120);
  check('Use actual easy/normal/hard speeds; novice/master are not config keys',
    ['easy', 'normal', 'hard'].every((k) => Number.isFinite(AI_LEVELS[k]?.strikeSpeed))
    && !('novice' in AI_LEVELS) && !('master' in AI_LEVELS));
  const baseline = baselinePath ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;
  if (baseline) {
    result.baselineArtifact = { path: baselinePath, bytes: fs.statSync(baselinePath).size,
      sha256: digest(fs.readFileSync(baselinePath)) };
    check('Reference is a successful baseline reproduction', baseline.kind === result.kind
      && baseline.mode === 'baseline' && baseline.pass && baseline.confirmedStalls >= 3);
    for (const name of ['src/config.js', 'src/ai_techniques.js', 'tools/sim/ai_hand_path.test.mjs']) {
      check(`Reference compatibility: ${name}`, baseline.sourceBefore[name] === result.sourceBefore[name]);
    }
  }
  for (const level of ['easy', 'normal', 'hard']) {
    const corners = [
      pathSpec('zornhau', -0.4, 'corner'),
      pathSpec('zornhauL', 0.4, 'corner'),
      // Real feint waypoint: left-to-right feint prepares at the right shoulder.
      { id: 'feint-upper-corner/lat0.4', category: 'corner', technique: 'FEINTS:왼쪽→오른쪽.then[1]',
        lateral: 0.4, start: G.langort, path: [FEINTS.find((f) => f.fake === 'zornhauL').then[1]],
        goal: FEINTS.find((f) => f.fake === 'zornhauL').then[1] },
    ];
    for (const spec of corners) {
      const row = run(level, spec, false);
      if (mode === 'candidate') {
        check(`${row.id}: bounded path completes`, row.completed && row.steps < limit);
        const target = [THREE.MathUtils.clamp(spec.goal[0] + spec.lateral * 0.5, -0.6, 0.6), spec.goal[1]];
        const norm = Math.hypot(...target);
        check(`${row.id}: final point is the reachable boundary in the intended direction`,
          Math.abs(Math.hypot(...row.final) - radius) < 1e-12 && norm > radius
          && Math.abs(row.final[0] * target[1] - row.final[1] * target[0]) < 1e-12
          && row.final[0] * target[0] + row.final[1] * target[1] > 0);
      } else if (spec.technique !== 'zornhauL' || level !== 'hard') {
        check(`${row.id}: baseline remains blocked for all 600 controller steps`, !row.completed
          && row.steps === limit && row.remainingPath.length === 1);
      } else {
        // Its 0.108011m overshoot is just below hard's 13/120m step: a useful counterexample.
        check(`${row.id}: documented faster-step counterexample completes`, row.completed);
      }
    }
    const inBounds = TECH.map((t) => pathSpec(t.name, 0));
    for (const name of ['zornhau', 'zornhauL']) for (const lateral of [-0.1, 0.1]) inBounds.push(pathSpec(name, lateral));
    inBounds.push({ id: 'neutral-guard', category: 'in-bound', technique: 'G.langort',
      guard: true, lateral: 0, start: G.tagR, path: [], goal: G.langort });
    for (const spec of inBounds) {
      const row = run(level, spec, true);
      check(`${row.id}: reachable path or neutral guard completes`, row.completed && row.steps < limit);
      if (baseline) {
        const old = baseline.rows.find((r) => r.id === row.id);
        check(`${row.id}: exact old in-bound trajectory and completion`, !!old
          && JSON.stringify(row.frames) === JSON.stringify(old.frames) && row.steps === old.steps
          && JSON.stringify(row.initial) === JSON.stringify(old.initial));
      }
    }
  }
  const corners = result.rows.filter((r) => r.category === 'corner');
  result.confirmedStalls = corners.filter((r) => !r.completed).length;
  result.gameContractSatisfied = result.rows.every((r) => r.completed);
  result.controllerSteps = result.rows.reduce((n, r) => n + r.steps, 0);
  result.summary = { cases: result.rows.length, inBoundCases: result.rows.length - corners.length,
    cornerCases: corners.length, completedCorners: corners.filter((r) => r.completed).length,
    stalledCorners: result.confirmedStalls, totalRandomCalls: result.rows.reduce((n, r) => n + r.randomCalls, 0) };
} catch (error) {
  result.exception = { name: error.name, message: error.message, stack: error.stack };
} finally {
  result.sourceAfter = hashes();
  result.sourceStable = JSON.stringify(result.sourceBefore) === JSON.stringify(result.sourceAfter);
  result.pass = !result.exception && result.sourceStable && result.assertions.every((a) => a.ok);
  result.failed = result.assertions.filter((a) => !a.ok).map((a) => a.name);
  result.completedUTC = new Date().toISOString();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  const data = fs.readFileSync(out);
  console.log(JSON.stringify({ out, bytes: data.length, sha256: digest(data), mode, pass: result.pass,
    gameContractSatisfied: result.gameContractSatisfied, ...result.summary, assertions: result.assertions.length,
    sourceStable: result.sourceStable, failed: result.failed, exception: result.exception,
    controllerSteps: result.controllerSteps, physicsSteps: 0, browserExecutions: 0 }));
  process.exitCode = result.pass ? 0 : 1;
}
