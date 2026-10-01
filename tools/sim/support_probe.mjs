// Limited support candidate probe, using the real harness_m newRound/step.
// These are NEW scripted scenes, not a reproduction of the historical 12/12
// battery or phone input. No human acceptance thresholds or force replicas.
// node tools/sim/support_probe.mjs --assist=0.3 --catch=on --scale=1 \
//   --seeds=7 --scenarios=stand,walk,rise,getup_refall,disturbance,swing --out=result.json
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SCENARIOS = ['stand', 'walk', 'rise', 'getup_refall', 'disturbance', 'swing', 'kneel_hurt', 'kneel_swing', 'kneel_hurt_swing'];
const MODES = ['on', 'fall', 'off'];
const SETTLE_SECONDS = Math.max(2.5, CONFIG.ARENA.startHold + 0.5);
const POST_STAND_SECONDS = 3;
// Observation windows and perturbations belong to this probe, not game rules.
const SCENE_SECONDS = { stand: 3, walk: 6, rise: 12, getup_refall: 12, disturbance: 8, swing: 3, kneel_hurt: 12, kneel_swing: 12, kneel_hurt_swing: 12 };
const SWING_FROM = [0.52, 0.06];
const SWING_TO = [-0.5, 0.06];
const SWING_PAD_SPEED_MPS = 6;
const PULSE_NS = { getup_refall: [0, 0, 35], disturbance: [0, 0, 20] };
const units = {
  time: 's', position: 'm', velocity: 'm/s', tilt: 'deg', impulse: 'N s',
  padPosition: 'game pad coordinate (mapped metres)', padSpeed: 'mapped m/s',
  lev: 'dimensionless controller state; not measured force or body weight share',
  footGroundContact: 'at least one solver contact with a fixed collider; no load threshold',
};

export function parseOptions(args) {
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') return { help: true };
    const match = /^--(assist|catch|scale|seeds|scenarios|out|ledger)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unknown option: ${arg}`);
    const value = match[2] ?? args[++i];
    if (value == null || value === '' || value.startsWith('--')) throw new Error(`Missing value: --${match[1]}`);
    if (Object.hasOwn(opt, match[1])) throw new Error(`Duplicate option: --${match[1]}`);
    opt[match[1]] = value;
  }
  const number = (key, fallback) => {
    const n = opt[key] == null ? fallback : Number(opt[key]);
    if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`--${key} must be finite and within 0..1`);
    return n;
  };
  const seeds = (opt.seeds ?? '7').split(',').map((s) => {
    if (!/^\d+$/.test(s)) throw new Error('--seeds must be comma-separated unsigned integers');
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n > 0xffffffff) throw new Error('--seeds must be within uint32');
    return n;
  });
  const scenarios = (opt.scenarios ?? SCENARIOS.join(',')).split(',');
  if (scenarios.some((s) => !SCENARIOS.includes(s))) throw new Error(`--scenarios must use: ${SCENARIOS.join(',')}`);
  if (new Set(seeds).size !== seeds.length || new Set(scenarios).size !== scenarios.length) throw new Error('Duplicate seed or scenario');
  const catchMode = opt.catch ?? CONFIG.GAIT.catchMode ?? 'on';
  if (opt.ledger != null && !['0', '1'].includes(opt.ledger)) throw new Error('--ledger must be 0 or 1');
  if (!MODES.includes(catchMode)) throw new Error('--catch must be on, fall or off');
  if ((!Object.hasOwn(CONFIG.GAIT, 'catchMode') || !Object.hasOwn(CONFIG.GAIT, 'catchScale')) && (catchMode !== 'on' || number('scale', 1) !== 1)) {
    throw new Error('Nondefault catch candidate requires implemented GAIT.catchMode and GAIT.catchScale');
  }
  return {
    assist: number('assist', CONFIG.GAIT.assist), catchMode,
    catchScale: number('scale', CONFIG.GAIT.catchScale ?? 1), seeds, scenarios, out: opt.out ?? null, ledger: opt.ledger !== '0',
  };
}

class Passive {
  update() {} // Harness step stays intact; enemy is parked through its own API.
}

function vector(v) { return [v.x, v.y, v.z]; }
function stat() { return { count: 0, min: Infinity, max: -Infinity, sum: 0 }; }
function add(s, x) { s.count++; s.min = Math.min(s.min, x); s.max = Math.max(s.max, x); s.sum += x; }
function finishStat(s) { return s.count ? { min: s.min, mean: s.sum / s.count, max: s.max } : null; }
function assertFinite(f, t) {
  for (const [name, body] of [...Object.entries(f.bodies), ['sword', f.sword]]) {
    for (const method of ['translation', 'linvel', 'angvel', 'rotation']) {
      const value = body[method]();
      if (Object.values(value).some((n) => !Number.isFinite(n))) throw new Error(`Nonfinite ${name}.${method} at ${t}s`);
    }
  }
  for (const [name, value] of Object.entries({ stateTime: f.stateTime, tiltDeg: f.tiltDeg(), tipSpeedMps: f.tipVel.length(), offBalanceM: f.offBalance, muscle: f.muscle, lev: f.gait.lev, levH: f.gait.levH, levC: f.gait.levC })) {
    if (!Number.isFinite(value)) throw new Error(`Nonfinite ${name} at ${t}s`);
  }
}

function grounded(world, foot) {
  const collider = foot.collider(0);
  let contact = false;
  world.contactPairsWith(collider, (other) => {
    if (!other.parent()?.isFixed()) return;
    world.contactPair(collider, other, (manifold) => {
      if (manifold.numSolverContacts() > 0) contact = true;
    });
  });
  return contact;
}

function snapshot(G, t, start) {
  const f = G.player;
  const p = f.bodies.pelvis.translation();
  const v = f.bodies.pelvis.linvel();
  const soles = ['footF', 'footB'].map((key) => f.solePoint(key, new THREE.Vector3()).y);
  const ground = ['footF', 'footB'].map((key) => grounded(G.world, f.bodies[key]));
  return {
    timeS: t, state: f.state, stateTimeS: f.stateTime,
    pelvisPositionM: vector(p), pelvisVelocityMps: vector(v),
    pelvisHeightM: p.y, pelvisVerticalVelocityMps: v.y,
    pelvisHorizontalSpeedMps: Math.hypot(v.x, v.z),
    horizontalDisplacementM: Math.hypot(p.x - start.x, p.z - start.z),
    tiltDeg: f.tiltDeg(), correctedChestTiltDeg: f.tiltDeg() - THREE.MathUtils.radToDeg(f.hunch), offBalanceM: f.offBalance,
    soleHeightM: { F: soles[0], B: soles[1] },
    groundContact: { F: ground[0], B: ground[1] },
    lev: f.gait.lev, levH: f.gait.levH, levC: f.gait.levC, handoverProgress: f.gait.handU,
    gaitActive: f.gait.active, gaitWalking: f.gait.walking,
    tipSpeedMps: f.tipVel.length(), handPad: [f.handOffset.x, f.handOffset.y],
    filteredHandPad: [f.skill.aim.x, f.skill.aim.y],
    skillSwinging: f.skill.swinging, skillSwings: f.skill.swings,
    physicallyUpright: p.y >= CONFIG.GAIT.guardHeight - CONFIG.GAIT.catchSag &&
      f.tiltDeg() - THREE.MathUtils.radToDeg(f.hunch) <= CONFIG.BODY.fallTiltDeg && ground.some(Boolean),
  };
}

function seedScene(seed) {
  // Vary disturbance direction reproducibly without consuming game Math.random.
  // A seed that never affects a scene can produce the same trajectory: traces expose this.
  const angle = ((seed % 8) - 3.5) * Math.PI / 16;
  return { angleRad: angle };
}

export function runTrial(scenario, seed, ledger = true) {
  let G;
  const row = { scenario, seed, status: 'ok', failures: [], units, transitions: [], samples: [] };
  try {
    G = newRound({ seed, walls: false, AIClass: Passive, skill: 0.7 });
    G.park();
    const f = G.player;
    if (ledger) f.balanceProbe = {};
    f.skill.autoGuard = true; // Same player flag as main.js.
    const kneelSwing = scenario === 'kneel_swing' || scenario === 'kneel_hurt_swing';
    if (scenario === 'swing' || kneelSwing) {
      f.handOffset.set(...SWING_FROM);
      for (const key of ['prev', 'aim', 'aimRaw', 'anchor']) f.skill[key].set(...SWING_FROM);
      f.skill.aimVel.set(0, 0);
      f.skill.vel.set(0, 0);
      f.skill.follow.set(0, 0);
    }
    for (let i = 0; i < Math.ceil(SETTLE_SECONDS / DT); i++) {
      f.move.set(0, 0);
      G.step();
      assertFinite(f, G.t);
    }
    if (f.state !== 'stand' || !f.gait.active) throw new Error(`Scene precondition failed after settling: ${f.state}, gaitActive=${f.gait.active}`);
    const start = { ...f.bodies.pelvis.translation() };
    const beforePulse = snapshot(G, 0, start);
    row.initial = beforePulse;
    row.protocol = {
      settleS: SETTLE_SECONDS, observationLimitS: SCENE_SECONDS[scenario],
      input: 'passive player, enemy parked; no AI combat',
    };
    let oldState = f.state;
    let firstStandS = null;
    let handoverEndS = null;
    let handoverObserved = false;
    const getup = scenario === 'rise' || scenario === 'getup_refall' || scenario.startsWith('kneel_');
    if (getup) {
      if (scenario === 'kneel_hurt' || scenario === 'kneel_hurt_swing') {
        // Controlled residual leg health, not a simulated wound or a clinical injury model.
        f.limbs.legF = 0.45;
        row.protocol.legHealth = { F: f.limbs.legF, B: f.limbs.legB };
      }
      f.knockDown(scenario === 'getup_refall');
      row.transitions.push({ timeS: 0, from: oldState, to: f.state, previousStateTimeS: beforePulse.stateTimeS, stateTimeS: f.stateTime, source: 'probe knockDown' });
      oldState = f.state;
      row.protocol.knockDownHeavy = scenario === 'getup_refall';
      row.protocol.postStandObservationS = POST_STAND_SECONDS;
      row.protocol.postHandoverObservationS = POST_STAND_SECONDS;
      row.protocol.physicallyUprightDefinition = {
        pelvisMinimumHeightM: CONFIG.GAIT.guardHeight - CONFIG.GAIT.catchSag,
        correctedChestMaximumTiltDeg: CONFIG.BODY.fallTiltDeg,
        groundContact: 'at least one foot with a ground solver contact',
        basis: 'existing game guardHeight, catchSag and fallTiltDeg; probe geometry condition, not a human acceptance threshold or proof of muscle-supported standing',
      };
    }
    if (PULSE_NS[scenario]) {
      const base = PULSE_NS[scenario];
      const a = seedScene(seed).angleRad;
      const impulse = { x: base[2] * Math.sin(a), y: base[1], z: base[2] * Math.cos(a) };
      const point = f.bodies.chest.translation();
      // External test disturbance is an impulse, not a monkeypatch or game force replica.
      f.bodies.chest.applyImpulseAtPoint(impulse, point, true);
      row.disturbance = { body: 'chest', impulseNs: vector(impulse), impulseMagnitudeNs: Math.hypot(...vector(impulse)), pointM: vector(point), atS: 0, directionVariationRad: a, before: beforePulse };
    }
    if (scenario === 'walk') row.protocol.input = 'move.y=+1 for 2s, -1 for 2s, then 0 for 2s';
    if (scenario === 'swing') row.protocol.input = { path: 'handOffset -> Skill.update -> Fighter.driveSword', fromPad: SWING_FROM, toPad: SWING_TO, padSpeedMps: SWING_PAD_SPEED_MPS, releaseAtS: Math.hypot(SWING_TO[0] - SWING_FROM[0], SWING_TO[1] - SWING_FROM[1]) / SWING_PAD_SPEED_MPS, phoneInput: false };
    if (kneelSwing) row.protocol.input = { path: 'handOffset and handHeld -> Skill.update -> Fighter.driveSword', kind: 'horizontal sweeps during knee-rise and handover', startS: 1, releaseAtS: 4, periodS: 0.8, amplitude: 0.52, phoneInput: false };
    const metricKeys = ['pelvisHeightM', 'pelvisVerticalVelocityMps', 'pelvisHorizontalSpeedMps', 'horizontalDisplacementM', 'tiltDeg', 'correctedChestTiltDeg', 'offBalanceM', 'tipSpeedMps', 'lev', 'levH', 'levC'];
    const sums = Object.fromEntries(metricKeys.map((key) => [key, stat()]));
    const phaseStats = Object.fromEntries(['afterStateReturned', 'afterHandoverEnded'].map((phase) => [phase, {
      samples: 0, physicallyUprightSamples: 0, bothFeetNoGroundContactS: 0,
      metrics: Object.fromEntries(metricKeys.map((key) => [key, stat()])),
    }]));
    const forceKeys = ['appliedUpN', 'baseSupportN', 'heightSpringN', 'verticalDampingN', 'horizontalXN', 'horizontalZN', 'nominalWeightN', 'footReaction'];
    const forceStats = Object.fromEntries(forceKeys.map((key) => [key, stat()]));
    const forcePhaseStats = Object.fromEntries(['afterStateReturned', 'afterHandoverEnded'].map((phase) => [phase, Object.fromEntries(forceKeys.map((key) => [key, stat()]))]));
    const attachedMass = stat();
    row.forceLedger = {
      requested: ledger, available: false, units: 'N except dimensionless footReaction',
      scope: 'Balance controller only. Components are before clamp; appliedUpN is after clamp. Not total external force or joint torque.',
      timing: 'For each sample, force is the input applied before world.step; geometry/contact is the resulting state after that step.',
      samples: [],
    };
    const states = {};
    let bothFeetAirS = 0;
    let standingBothFeetAirS = 0;
    let standS = 0;
    let walkingS = 0;
    let swingingS = 0;
    let padChanges = 0;
    let filteredChanges = 0;
    let elapsed = 0;
    let previous = beforePulse;
    const swingsBefore = f.skill.swings;
    const trace = createHash('sha256');
    for (let i = 0; i < Math.ceil(SCENE_SECONDS[scenario] / DT); i++) {
      const t = i * DT;
      f.move.set(0, scenario === 'walk' ? (t < 2 ? 1 : t < 4 ? -1 : 0) : 0);
      if (kneelSwing) {
        f.handHeld = t >= 1 && t < 4;
        if (f.handHeld) f.handOffset.set(0.52 * Math.cos((t - 1) * 2 * Math.PI / 0.8), 0.06);
      }
      if (scenario === 'swing' && t < row.protocol.input.releaseAtS) {
        const d = Math.hypot(SWING_TO[0] - f.handOffset.x, SWING_TO[1] - f.handOffset.y);
        if (d <= SWING_PAD_SPEED_MPS * DT) f.handOffset.set(...SWING_TO);
        else f.handOffset.addScaledVector(new THREE.Vector2(SWING_TO[0] - f.handOffset.x, SWING_TO[1] - f.handOffset.y), SWING_PAD_SPEED_MPS * DT / d);
      }
      const previousStateTime = f.stateTime;
      G.step();
      elapsed = (i + 1) * DT;
      assertFinite(f, elapsed);
      const s = snapshot(G, elapsed, start);
      trace.update(JSON.stringify(s));
      if (s.state !== oldState) {
        row.transitions.push({ timeS: elapsed, from: oldState, to: s.state, previousStateTimeS: previousStateTime, stateTimeS: s.stateTimeS, source: 'game step' });
        if (getup && s.state === 'stand' && firstStandS == null) firstStandS = elapsed;
        oldState = s.state;
      }
      if (getup && firstStandS != null) {
        if (s.levH > 0) handoverObserved = true;
        if (handoverObserved && handoverEndS == null && s.handoverProgress >= 1 && s.levH <= 0) handoverEndS = elapsed;
        for (const [phase, active] of [['afterStateReturned', true], ['afterHandoverEnded', handoverEndS != null]]) {
          if (!active) continue;
          const stats = phaseStats[phase];
          stats.samples++;
          if (s.physicallyUpright) stats.physicallyUprightSamples++;
          if (!s.groundContact.F && !s.groundContact.B) stats.bothFeetNoGroundContactS += DT;
          for (const key of metricKeys) add(stats.metrics[key], s[key]);
        }
      }
      for (const key of Object.keys(sums)) add(sums[key], s[key]);
      const massKg = Object.values(f.bodies).reduce((sum, body) => sum + body.mass(), 0) + f.sword.mass();
      if (!Number.isFinite(massKg)) throw new Error(`Nonfinite attached body mass at ${elapsed}s`);
      add(attachedMass, massKg);
      if (ledger && Number.isFinite(f.balanceProbe?.appliedUpN)) {
        row.forceLedger.available = true;
        for (const key of forceKeys) {
          const value = f.balanceProbe[key];
          if (!Number.isFinite(value)) throw new Error(`Nonfinite balanceProbe.${key} at ${elapsed}s`);
          add(forceStats[key], value);
          if (getup && firstStandS != null) add(forcePhaseStats.afterStateReturned[key], value);
          if (getup && handoverEndS != null) add(forcePhaseStats.afterHandoverEnded[key], value);
        }
        if (i % 12 === 0) row.forceLedger.samples.push({ timeS: elapsed, ...f.balanceProbe, attachedMassKg: massKg, attachedWeightN: massKg * Math.abs(CONFIG.PHYSICS.gravity) });
      }
      states[s.state] = (states[s.state] ?? 0) + DT;
      if (!s.groundContact.F && !s.groundContact.B) {
        bothFeetAirS += DT;
        if (s.state === 'stand') standingBothFeetAirS += DT;
      }
      if (s.state === 'stand') standS += DT;
      if (s.gaitWalking) walkingS += DT;
      if (s.skillSwinging) swingingS += DT;
      if (s.handPad.some((n, k) => n !== previous.handPad[k])) padChanges++;
      if (s.filteredHandPad.some((n, k) => n !== previous.filteredHandPad[k])) filteredChanges++;
      if (i % 12 === 0 || s.state !== previous.state || i + 1 === Math.ceil(SCENE_SECONDS[scenario] / DT)) row.samples.push(s);
      previous = s;
      if (getup && handoverEndS != null && elapsed - handoverEndS >= POST_STAND_SECONDS - DT / 2) break;
    }
    row.final = previous;
    if (row.samples.at(-1)?.timeS !== previous.timeS) row.samples.push(previous);
    row.observedS = elapsed;
    row.traceSha256 = trace.digest('hex');
    row.metrics = Object.fromEntries(Object.entries(sums).map(([key, value]) => [key, finishStat(value)]));
    row.metrics.stateDurationS = states;
    row.attachedMassKg = finishStat(attachedMass);
    row.attachedWeightN = Object.fromEntries(Object.entries(row.attachedMassKg).map(([key, value]) => [key, value * Math.abs(CONFIG.PHYSICS.gravity)]));
    row.forceLedger.metrics = Object.fromEntries(Object.entries(forceStats).map(([key, value]) => [key, finishStat(value)]));
    row.forceLedger.geometryPhases = Object.fromEntries(Object.entries(forcePhaseStats).map(([phase, stats]) => [phase, Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, finishStat(value)]))]));
    row.metrics.bothFeetNoGroundContactS = bothFeetAirS;
    row.metrics.standingBothFeetNoGroundContactS = standingBothFeetAirS;
    row.metrics.standingBothFeetNoGroundContactFraction = standS ? standingBothFeetAirS / standS : null;
    row.inputEvidence = { aiPlayer: false, enemyParked: G.parkEnemy, gaitWalkingS: walkingS, skillSwingingS: swingingS, skillSwingsDelta: f.skill.swings - swingsBefore, handPadChangedSteps: padChanges, filteredHandPadChangedSteps: filteredChanges };
    if (scenario === 'walk' && walkingS === 0) row.failures.push('Walking input did not activate gait.walking');
    if ((scenario === 'swing' || kneelSwing) && (padChanges === 0 || filteredChanges === 0 || swingingS === 0)) row.failures.push('Fixed swing input did not activate the player hand/skill path');
    if (getup) {
      const later = firstStandS == null ? [] : row.transitions.filter((s) => s.timeS > firstStandS && s.timeS <= firstStandS + POST_STAND_SECONDS && s.to !== 'stand');
      const allPostStand = firstStandS == null ? [] : row.transitions.filter((s) => s.timeS > firstStandS && s.to !== 'stand');
      const afterHandover = handoverEndS == null ? [] : row.transitions.filter((s) => s.timeS > handoverEndS && s.to !== 'stand');
      row.getup = {
        enteredGetup: row.transitions.some((s) => s.to === 'getup'), firstStandS,
        stateReturned: firstStandS != null,
        physicallyUprightAtEnd: previous.physicallyUpright,
        postStandObservedS: firstStandS == null ? 0 : elapsed - firstStandS,
        refellWithin3S: later.length > 0, postStandTransitions: later,
        leftStandDuringObservation: allPostStand.length > 0, allPostStandTransitions: allPostStand,
        handoverObserved, handoverEndS,
        postHandoverObservedS: handoverEndS == null ? 0 : elapsed - handoverEndS,
        refellWithin3SAfterHandover: afterHandover.length > 0,
        postHandoverTransitions: afterHandover,
        geometryByPhase: Object.fromEntries(Object.entries(phaseStats).map(([phase, stats]) => [phase, {
          observedS: stats.samples * DT,
          physicallyUprightFraction: stats.samples ? stats.physicallyUprightSamples / stats.samples : null,
          bothFeetNoGroundContactS: stats.bothFeetNoGroundContactS,
          metrics: Object.fromEntries(Object.entries(stats.metrics).map(([key, value]) => [key, finishStat(value)])),
        }])),
      };
      if (!row.getup.enteredGetup) row.failures.push('No actual getup transition observed');
      if (!row.getup.stateReturned) row.failures.push('No stand state transition within the 12s observation window');
      if (row.getup.refellWithin3S) row.failures.push('Left stand within the 3s post-getup observation window');
      if (handoverEndS == null || row.getup.postHandoverObservedS < POST_STAND_SECONDS - DT / 2) row.failures.push('Handover end plus 3s observation incomplete within the 12s window');
      if (row.getup.refellWithin3SAfterHandover) row.failures.push('Left stand within the 3s post-handover observation window');
      if (allPostStand.length) row.failures.push('Left stand between first state return and observation end (including any delayed handover)');
    }
    if (row.disturbance) {
      row.disturbance.after = previous;
      row.disturbance.standingAtEnd = f.state === 'stand';
      row.disturbance.fallTransitions = row.transitions.filter((s) => s.to === 'down' || s.to === 'getup');
      row.disturbance.recoveredStateAtS = row.transitions.find((s) => s.to === 'stand')?.timeS ?? null;
      // Numeric residuals are observations; no invented stability tolerance.
      row.disturbance.residualHeightChangeM = previous.pelvisHeightM - beforePulse.pelvisHeightM;
      row.disturbance.residualTiltChangeDeg = previous.tiltDeg - beforePulse.tiltDeg;
      row.disturbance.residualHorizontalSpeedMps = previous.pelvisHorizontalSpeedMps;
    }
    if (f.state === 'dead') row.failures.push('Player died in noncombat probe');
    if (!previous.physicallyUpright) row.failures.push('Final posture does not meet probe game-geometry condition (height/tilt/ground contact); stand state alone is insufficient');
  } catch (error) {
    row.failures.push(error.message);
  } finally {
    G?.world.free();
    G?.eventQueue.free();
  }
  if (row.failures.length) row.status = 'fail';
  return row;
}

export function runProbe(options) {
  const gait = CONFIG.GAIT;
  const original = Object.fromEntries(['assist', 'catchMode', 'catchScale'].map((key) => [key, { exists: Object.hasOwn(gait, key), value: gait[key] }]));
  const random = Math.random;
  try {
    gait.assist = options.assist;
    if (original.catchMode.exists) gait.catchMode = options.catchMode;
    if (original.catchScale.exists) gait.catchScale = options.catchScale;
    const rows = [];
    for (const seed of options.seeds) for (const scenario of options.scenarios) rows.push(runTrial(scenario, seed, options.ledger));
    return {
      schemaVersion: 1, probe: 'support_probe',
      scope: 'new limited scripted scenes; not historical 12/12 reproduction, AI fights, or phone input',
      interpretation: 'No human acceptance thresholds. stand state is a timed game transition, not successful physical standing. fail denotes invalid/inactive scene, nonfinite state, incomplete handover observation, any state exit after initial getup, or a final posture outside the stated game-geometry condition. Continuous posture statistics are also reported; ok does not establish natural motion.',
      candidate: { assist: gait.assist, catchMode: options.catchMode, catchScale: options.catchScale, catchOptionsPresent: original.catchMode.exists && original.catchScale.exists, legConfigUnchanged: true },
      harness: 'tools/sim/harness_m.mjs:newRound/step', timestepS: DT, seeds: options.seeds,
      scenarios: options.scenarios, ledgerRequested: options.ledger, rows, status: rows.some((row) => row.status === 'fail') ? 'fail' : 'ok',
    };
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value.exists) gait[key] = value.value;
      else delete gait[key];
    }
    Math.random = random;
  }
}

if (isMain(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node tools/sim/support_probe.mjs [--assist=0..1] [--catch=on|fall|off] [--scale=0..1] [--seeds=7,8] [--scenarios=' + SCENARIOS.join(',') + '] [--ledger=0|1] [--out=result.json]');
    } else {
      const startMs = performance.now();
      const result = runProbe(options);
      try { result.sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8' }).trim(); } catch { result.sourceHead = null; }
      result.sourceFilesSha256 = {};
      for (const file of ['src/config.js', 'src/gait.js', 'src/fighter.js', 'tools/sim/harness_m.mjs', 'tools/sim/support_probe.mjs']) {
        result.sourceFilesSha256[file] = createHash('sha256').update(await readFile(new URL('../../' + file, import.meta.url))).digest('hex');
      }
      const json = JSON.stringify(result, null, 2) + '\n';
      if (options.out) await writeFile(options.out, json);
      process.stdout.write(json);
      process.stderr.write(`support_probe: ${result.rows.length} scene(s), ${((performance.now() - startMs) / 1000).toFixed(2)}s wall, status=${result.status}\n`);
      if (result.status !== 'ok') process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`support_probe: ${error.message}\n`);
    process.exitCode = 2;
  }
}
