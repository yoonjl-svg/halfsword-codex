// Research-only secret measurements for build 88a96061. Never imported by the game.
// No CONFIG mutations, wound suppression, forced hits, or secret-use reset.
// node tools/sim/balance_secrets_20261101.mjs --suite=pilot --out=docs/research/attack_balance_20261101/secrets/pilot
// --suite=potential|conditional|scripted30 --seeds=1,2,3,4,5,6 --ranges=close,normal,edge --variants=on,off
// --suite=input --input-levels=exact,small,large --input-plans=1,2,3,4,5,6,7,8 --opponent-seed=2
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { PlayerSecretWatch, bladesTouch, secretLeft, secretUsesOf, foeRecentTipSp } from '../../src/secret.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerUniqueAssist, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { foeStep, coverDist, lungeGap, meFree } from '../../src/italian_risoluto.js';
import { recoverRate } from '../../src/stamina.js';

const args = Object.fromEntries(process.argv.slice(2).map(s => {
  const i = s.indexOf('=');
  return [s.slice(2, i < 0 ? undefined : i), i < 0 ? true : s.slice(i + 1)];
}));
const K = CONFIG.TIME.k;
const FR = 1 / 60;
const BUILD = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const configHash = () => createHash('sha256').update(JSON.stringify({ SECRET: CONFIG.SECRET, STAMINA: CONFIG.STAMINA, UNIQUE_ASSIST: CONFIG.UNIQUE_ASSIST, SKILL: CONFIG.SKILL, TIME: CONFIG.TIME, ARENA: CONFIG.ARENA })).digest('hex');
const initialConfigHash = configHash();
const ROOT = 'docs/research/attack_balance_20261101/secrets';
const suite = args.suite ?? 'pilot';
const out = args.out ?? (suite === 'input' ? `${ROOT}/input/matrix` : `${ROOT}/${suite}`);
const seeds = String(args.seeds ?? (suite === 'pilot' ? '1' : '1,2,3,4,5,6')).split(',').map(Number);
const ranges = String(args.ranges ?? (suite === 'pilot' ? 'normal' : 'close,normal,edge')).split(',');
const variants = String(args.variants ?? (suite === 'pilot' ? 'on' : 'on,off')).split(',');
const inputLevels = String(args['input-levels'] ?? 'exact,small,large').split(',');
const inputPlanIds = String(args['input-plans'] ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const filters = args.techs ? String(args.techs).split(',') : null;
const specs = [
  { school: 'italian', tech: 'andareRisoluto', weapon: 'rapier' },
  { school: 'iberian', tech: 'ibSpin', weapon: 'zweihander' },
  { school: 'japanese', tech: 'goNoSen', weapon: 'uchigatana' },
  ...['geojeong', 'eogeo', 'yoryak', 'bongdu'].map(stance => ({ school: 'chinese', tech: 'gyeoksal', weapon: 'hwando', stance })),
].filter(s => !filters || filters.includes(s.tech) || filters.includes(s.stance));

// Refuse inherited experiment switches because harness_m can change defaults from them.
for (const key of ['TIME_STD', 'IT_RHYTHM', 'FINISH_ENTRY', 'FINISH_MODE', 'FINISH_POWER', 'VITAL', 'PLATE_NECK', 'VITAL_AI', 'VITAL_THRUST', 'VITAL_PCUT', 'FINISH_LIFT', 'FINISH_AIM', 'FINISH_ARM', 'FINISH_WRIST', 'FINISH_CHEST_S', 'FINISH_CLEAVE', 'FINISH_CLEAVE_AI', 'FINISH_CLEAVE_POWER']) {
  if (process.env[key] != null) throw new Error(`Unset experiment environment variable ${key}.`);
}
if (BUILD !== '88a96061e8dd93e8f107b7b0df647a341e73fa5d') throw new Error(`Unexpected build ${BUILD}`);
if (CONFIG.UNIQUE_ASSIST.secretUses.default !== 1 || CONFIG.UNIQUE_ASSIST.secretUses.chinese !== 3 || !CONFIG.SECRET.secretStamina || CONFIG.SECRET.secretStaminaMin !== 0) throw new Error('Secret limits differ from pinned defaults');

const round = n => Number.isFinite(n) ? +n.toFixed(7) : null;
const total = o => Object.values(o ?? {}).reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0);
const jsonCopy = o => JSON.parse(JSON.stringify(o));
function makeInputPlan(id, level) {
  if (!Number.isInteger(id) || id < 1 || id > 8 || !['exact', 'small', 'large'].includes(level)) throw new Error('Input plan requires id 1..8 and exact/small/large level');
  const strength = { exact: 0, small: 1, large: 5 }[level];
  const sign = [-1, 1, -1, 1, 1, -1, 1, -1][id - 1];
  const phase = id * 0.71;
  const reactionBase = 0.16 + (id - 1) * 0.02;
  return {
    id, level, opponentSeed: Number(args['opponent-seed'] ?? 2),
    baselinePlan: 'eight actual motor plans; paired levels share opponent RNG seed, not only a seed replay',
    beginAt: (id - 1) / 60,
    phase, reactionBaseSeconds: reactionBase,
    reactionNoiseSeconds: sign * strength * (0.018 + id * 0.003),
    reactionSeconds: Math.max(0, reactionBase + sign * strength * (0.018 + id * 0.003)),
    tapApproachSeconds: 0.09 + id * 0.005,
    handTrackingSpeed: 0.55 + id * 0.015,
    coverOffsetY: 0.025 + id * 0.0015,
    handWobbleRadius: strength === 5 ? 0.045 : strength * 0.006,
    handWobbleHz: 4.5 + id * 0.2,
    mirrorReactionSeconds: Math.max(0, 0.16 + id * 0.01 + sign * strength * 0.02),
    guardReactionSeconds: Math.max(0, reactionBase + sign * strength * 0.045),
    guardReleaseSeconds: Math.max(0.04, 0.24 + id * 0.012 + sign * strength * 0.035),
    forwardPressLagSeconds: sign * strength * (0.012 + id * 0.003),
    footMagnitude: 0.90 + id * 0.01,
    stickBaseAngleDegrees: (id - 4.5) * 0.5,
    stickAngleAmplitudeDegrees: strength === 5 ? 65 : strength * 10,
    stickHz: 0.7 + id * 0.08,
    circleRadius: 0.14 + (id - 1) * 0.004,
    circleSeconds: 0.70 + (id - 1) * 0.025,
    circleTurns: 1.22 + (id - 1) * 0.025,
    circleEllipseX: 1 + (id - 4.5) * 0.01,
    circleStartDelaySeconds: Math.max(0, id * 0.01 + sign * strength * 0.035),
    circleRadialNoiseFraction: strength === 5 ? 0.45 : strength * 0.08,
    circleTimeWarpFraction: strength === 5 ? 0.26 : strength * 0.035,
    units: 'standard seconds; hand m; hand tracking speed m/physics second; degrees',
  };
}
const measureCache = new Map();
function measure(spec) {
  if (!measureCache.has(spec.weapon)) {
    const G = newRound({ weapon: spec.weapon, weapon2: 'longsword', seed: 1 });
    measureCache.set(spec.weapon, jsonCopy(G.player.swordArt.measure));
    G.world.free();
  }
  return measureCache.get(spec.weapon);
}
function distance(spec, range) {
  const m = measure(spec);
  const i = ['close', 'normal', 'edge'].indexOf(range);
  if (i < 0) throw new Error(`Unknown range ${range}`);
  if (spec.tech === 'ibSpin') return m.reach + [-0.15, 0.1, 0.3][i];
  if (spec.tech === 'goNoSen') return m.reach + CONFIG.SECRET.japaneseReach + [-0.3, 0, CONFIG.SECRET.japaneseFar][i];
  return m.contact + [-0.15, 0.05, 0.25][i];
}
function snapshot(f) {
  return {
    blood: f.blood, consciousness: f.consciousness, limbs: { ...f.limbs },
    wounds: f.wounds.map(w => ({ part: w.part, type: w.type, severity: w.severity, bleed: w.bleed })),
    detached: [...(f.detachedParts ?? [])], state: f.state, alive: !!f.alive, armed: !!f.armed,
    cause: f.causeOfDeath ?? null, pain: f.pain, balance: f.balance,
    stamina: { value: f.stamina.value, spent: { ...f.stamina.spent }, recovered: f.stamina.recovered, exhaustions: f.stamina.counts.exhaustion },
  };
}
function healthResult(start, end, tracked, wounds) {
  const limbFunctionLoss = Object.fromEntries(Object.keys(start.limbs).map(k => [k, round(Math.max(0, start.limbs[k] - end.limbs[k]))]));
  return {
    severity: round(wounds.reduce((a, w) => a + (w.severity ?? 0), 0)),
    lacerationSeverity: round(end.wounds.slice(start.wounds.length).reduce((a, w) => a + w.severity, 0)),
    bloodLost: round(Math.max(0, start.blood - end.blood)), consciousnessLost: round(Math.max(0, start.consciousness - end.consciousness)),
    peakConsciousnessLost: round(Math.max(0, start.consciousness - tracked.minConsciousness)),
    limbsLost: round(total(limbFunctionLoss)), limbFunctionLoss,
    detachedParts: end.detached.filter(p => !start.detached.includes(p)),
    dead: !end.alive || end.state === 'dead', engineEnded: !end.alive || end.state === 'dead',
    knockedOut: (!end.alive || end.state === 'dead') && end.cause === '기절',
    engineEndCauseClass: !end.alive || end.state === 'dead' ? end.cause === '기절' ? 'KO' : end.cause ?? 'unknown' : null,
    cause: end.cause,
    knockdowns: tracked.knockdowns, disarms: tracked.disarms, finalState: end.state,
  };
}

// This controller uses engine geometry and the actual window truth. It measures an
// automatic input upper bound, never a human success rate or natural play frequency.
function closestPair(a0, a1, b0, b1) {
  // Same segment projection used by risoluto_play; return actual blade points.
  const u = a1.clone().sub(a0), v = b1.clone().sub(b0), w = a0.clone().sub(b0);
  const A = u.dot(u), B = u.dot(v), C = v.dot(v), D = u.dot(w), E = v.dot(w), den = A * C - B * B;
  let s = den > 1e-10 ? THREE.MathUtils.clamp((B * E - C * D) / den, 0, 1) : 0;
  let t = C > 1e-10 ? THREE.MathUtils.clamp((B * s + E) / C, 0, 1) : 0;
  s = A > 1e-10 ? THREE.MathUtils.clamp((B * t - D) / A, 0, 1) : 0;
  return [a0.addScaledVector(u, s), b0.addScaledVector(v, t)];
}

function runTrial(spec, mode, variant, seed, range, inputPlan = null) {
  const wallStart = performance.now();
  const potential = mode === 'direct_potential';
  const natural = mode === 'scripted_30s';
  const requestedGap = distance(spec, range);
  const initialGap = potential || spec.tech === 'goNoSen' ? requestedGap : requestedGap + 0.9;
  const G = newRound({ weapon: spec.weapon, weapon2: 'longsword', seed, gap: initialGap, walls: true, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player, E = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  P.canShove = true;
  const guard = new PlayerParryGuard(P, E);
  P.stamina.controller = guard;
  const uniq = new PlayerUniqueAssist(P, { names: new Set((PLAYER_UNIQUE[spec.school] ?? []).map(e => e.name)) });
  const watch = new PlayerSecretWatch(P, E);
  if (watch.S?.name !== spec.tech) throw new Error(`${spec.weapon}: expected ${spec.tech}, got ${watch.S?.name}`);
  const startP = snapshot(P), startE = snapshot(E);
  const row = {
    schemaVersion: inputPlan ? 4 : 3, build: BUILD, school: spec.school, tech: spec.tech, category: 'secret', mode, variant, seed, range,
    inputPlan, intendedInputTrace: inputPlan ? [] : null, inputTraceDigest: null,
    branch: potential ? spec.stance ?? null : null, weapon: spec.weapon, opponentWeapon: 'longsword',
    controller: potential ? 'direct request against stationary armed target; window conditions bypassed' : '60 Hz scripted main-order inputs + engine-truth geometry/window observer; normal opponent AI',
    limitsPreserved: { humanInput: P.humanInput === true, humanRecoveryPerStandardSecond: round(recoverRate(P) * K), staminaMax: P.stamina.max, maxBonus: P.stamina.maxBonus, infiniteStamina: P.stamina.infinite, secretUses: secretUsesOf(P), secretStaminaMinExclusive: CONFIG.SECRET.secretStaminaMin, woundSuppression: false, forcedHit: false, configOverrides: false },
    conditions: { bypassed: potential, branchForcedByRequest: potential && !!spec.stance, requestedGap, initialGap, conditionalInitialDistanceDefinition: potential || spec.tech === 'goNoSen' ? 'requestedGap' : 'requestedGap + 0.9m approach space; no distance clamping', skillLevel: P.skill.level, distanceDefinition: spec.tech === 'goNoSen' ? 'measure.reach + japaneseReach + [-0.3,0,japaneseFar]' : spec.tech === 'ibSpin' ? 'measure.reach + [-0.15,0.1,0.3]' : 'measure.contact + [-0.15,0.05,0.25]', measure: measure(spec), windows: 0, readyEpisodes: 0, actualBranchCounts: {}, diagnostic: null },
    attempted: 0, requestAttempted: 0, accepted: 0, started: 0, contacts: { woundCallbacks: 0, inflictedWoundCallbacks: 0, receivedWoundCallbacks: 0, bladeTouchEpisodes: 0, clashes: 0, instantBodyHitRuns: 0, blockedRuns: 0, bodyContactsWithoutWound: null },
    inflicted: null, received: null, stamina: null,
    timeline: { physicsTimestep: DT, inputFrameSeconds: FR, timeK: K, timeTempo: CONFIG.TIME.tempo, startHoldPhysicsSeconds: CONFIG.ARENA.startHold, cameraAndPresentation: false, hitStopAndSecretSlowMotion: false, preparationStart: 0, firstIntent: null, request: null, started: null, firstInflictedContact: null, attackEnded: null, controlRestored: null, observedPhysicsSeconds: null, observedStandardSeconds: null, wallSeconds: null, at1s: null, at5s: null },
    events: [], inputTrace: [], validity: { observationComplete: true, executionFailure: null, naturalHumanFrequency: false, inputToleranceTest: !!inputPlan, inputInterface: inputPlan ? '60Hz main-frame consumed hand deltas/taps/stick/guard; not DOM tap classification or visible-cue response' : null, seedIsIndependentInputTrajectory: false, actualInputPlanVaried: !!inputPlan, attemptedDefinition: 'intended tap/swipe, circle begin, or new guard+forward press; direct mode counts direct requests', requestAttemptedDefinition: 'actual secret execution request, including disabled control requests', actualStartedDefinition: 'first actual Skill.updateSecret callback for the accepted run; counted once per run', configHashBefore: initialConfigHash, configHashAfter: null, damageScope: 'entire preparation through observation; attack-only events retain timestamps', controlInterpretation: variant === 'off' ? 'secret connection disabled; same scripted inputs continue as ordinary actions; not a pure damage multiplier comparison' : null },
    initial: { player: startP, enemy: startE }, final: null,
  };
  const tracked = new Map([P, E].map(f => [f, { state: f.state, armed: !!f.armed, minConsciousness: f.consciousness, minStamina: f.stamina.value, knockdowns: 0, disarms: 0 }]));
  const wounds = [];
  const event = (kind, detail = {}) => row.events.push({ t: round(G.t / K), physicsT: round(G.t), kind, ...detail });
  let woundPartContext = null;
  const oldWoundHook = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, point, pr) => {
    woundPartContext = pr?.v?.part ?? null;
    const result = oldWoundHook(att, vic, r, point, pr);
    woundPartContext = null;
    return result;
  };
  G.onWound = (att, vic, r) => {
    const w = { t: round(G.t / K), physicsT: round(G.t), attacker: att === P ? 'player' : 'enemy', victim: vic === P ? 'player' : 'enemy', part: r.part ?? woundPartContext, zone: r.zone, type: r.type, energy: round(r.energy), severity: round(r.severity), helmet: !!r.helmet, plate: !!r.plate, stage: P.skill.sec?.stage ?? null };
    wounds.push(w); event('wound', w);
    row.contacts.woundCallbacks++;
    if (att === P) { row.contacts.inflictedWoundCallbacks++; row.timeline.firstInflictedContact ??= round(G.t / K); }
    if (vic === P) row.contacts.receivedWoundCallbacks++;
  };
  if (potential) G.ai.update = () => {}; // Defined target policy, not altered physiology or hit detection.
  let nextFrame = 0, seenWindows = 0, wasReady = false, touched = false;
  let due = null, attemptedAt = null, runRef = null, lastStage = null, endAt = null;
  let circle = null, circleDone = false, targetHand = [0.1, 0.05], enemyAttack = null, releaseAt = -1, history = [];
  let lastInput = null, terminatedByDeath = false, lastPress = false;
  let tapIntentBegan = false, tapDelivered = false, scheduledCircleAt = null;
  let wobbleStartedAt = null, wobblePrevious = [0, 0];
  const intent = (source, detail = {}) => {
    row.attempted++; row.timeline.firstIntent ??= round(G.t / K);
    event('intended_input', { source, ...detail });
  };
  if (spec.tech === 'gyeoksal') {
    const tick = watch.gyeoksalTick.bind(watch);
    watch.gyeoksalTick = (dt, touch, attacking, busy) => {
      const edge = touch && !watch.pc?.prev;
      const prior = { ...(watch.pc?.gk ?? {}) };
      const result = tick(dt, touch, attacking, busy);
      if (edge) {
        const pc = watch.pc, now = pc?.gk ?? {};
        const rejected = ['busy', 'atk', 'noPress', 'late', 'notFwd', 'slow', 'hurt', 'noStance'].filter(k => (now[k] ?? 0) > (prior[k] ?? 0));
        event('gyeoksal_contact_opportunity', { acceptedPending: (now.pend ?? 0) > (prior.pend ?? 0), rejected, stanceAtContact: pc?.pend?.stance ?? null, possibleStanceFromCurrentGuard: watch.gyeoksalStance(guard), defLine: guard.defLine, held: guard.held, broken: guard.broken, pressAge: round(pc?.pressAge / K), woundAge: round(pc?.woundAge / K), stickX: P.stickX, stickY: P.stickY, recentFoeTipSpeed: round(foeRecentTipSp(watch.sense, 0.6 * K)), attacking, busy, stamina: round(P.stamina.value), gap: round(P.foeDistance()) });
      }
      return result;
    };
  }
  const observedRuns = new WeakSet();
  const updateSecret = P.skill.updateSecret.bind(P.skill);
  P.skill.updateSecret = dt => {
    const run = P.skill.sec;
    if (run && !observedRuns.has(run)) {
      observedRuns.add(run); row.started++;
      row.timeline.started ??= round(G.t / K);
      event('actual_execution_callback', { stage: run.stage, stamina: round(P.stamina.value) });
    }
    return updateSecret(dt);
  };
  const activeLimit = Number(args.seconds ?? 30);
  const observerLimit = potential ? 30 : activeLimit + 30; // Observer guard only. Never cancels an action.
  function request(o, source) {
    row.requestAttempted++; row.timeline.request ??= round(G.t / K);
    if (potential) intent(source);
    attemptedAt ??= G.t / K;
    event('attempt', { source, open: !!watch.open, stamina: round(P.stamina.value), state: P.state, left: secretLeft(P), gap: round(P.foeDistance()), ctx: o?.ctx ? jsonCopy(o.ctx) : null });
    if (inputPlan && row.attempted === 0) event('request_without_intended_attack', { source });
    if (variant === 'off') return false;
    if (!(secretLeft(P) > 0)) { event('refused', { why: 'use_limit' }); return false; }
    const ok = P.skill.secret(o);
    if (ok) {
      row.accepted++;
      runRef = P.skill.sec; lastStage = runRef?.stage;
      event('accepted', { source, stage: lastStage, gap: round(P.foeDistance()), stamina: round(P.stamina.value), ctx: o?.ctx ? jsonCopy(o.ctx) : null });
      const st = o?.ctx?.stance;
      if (st) row.conditions.actualBranchCounts[st] = (row.conditions.actualBranchCounts[st] ?? 0) + 1;
    } else event('refused', { why: !P.stamina.secretReady ? 'stamina' : P.state !== 'stand' ? 'state' : P.skill.tap ? 'tap_busy' : P.skill.pom ? 'pommel_busy' : P.skill.sec ? 'secret_busy' : !P.armed ? 'disarmed' : 'execution_rejected' });
    return ok;
  }
  const ordinary = kind => {
    if (kind === 'tap') { const ok = P.skill.thrust(); event('ordinary_tap', { accepted: !!ok }); return !!ok; }
    return false;
  };
  function inputFrame() {
    const rt = G.t / K;
    const busy = P.stamina.exhausted || !!P.skill.secretPhase;
    let d = { x: 0, y: 0 }, tap = false, fwd = 0, press = false, down = false;
    let side = 0;
    const stillTrial = natural || row.requestAttempted === 0;
    if (potential && row.requestAttempted === 0 && rt >= 3) {
      const o = { S: watch.S, ctx: spec.stance ? { slot: spec.stance, stance: spec.stance, ev: 'direct_request' } : { ev: 'direct_request' } };
      if (!request(o, 'direct_request') && variant === 'off') {
        if (spec.tech === 'andareRisoluto' || spec.stance === 'bongdu') ordinary('tap');
        else circle = { t: rt, previous: [0, 0], baselineCut: true };
      }
    }
    if (!potential && stillTrial && P.alive && E.alive && (!inputPlan || rt >= inputPlan.beginAt)) {
      if (spec.tech === 'andareRisoluto') {
        down = !busy;
        if (!busy && P.armed && E.armed) {
          const [pa, pb] = closestPair(P.bladePoint(0, new THREE.Vector3()), P.bladePoint(0.5, new THREE.Vector3()), E.bladePoint(0.5, new THREE.Vector3()), E.bladePoint(1, new THREE.Vector3()));
          const dv = pb.sub(pa).applyQuaternion(P.yaw.clone().invert());
          if (P.foeDistance() < 3) targetHand = [THREE.MathUtils.clamp(targetHand[0] + dv.z * 4 * FR * K, -0.5, 0.5), THREE.MathUtils.clamp(targetHand[1] + (dv.y + (inputPlan?.coverOffsetY ?? 0.03)) * 4 * FR * K, -0.3, 0.45)];
          const dx = targetHand[0] - P.handOffset.x, dy = targetHand[1] - P.handOffset.y, len = Math.hypot(dx, dy), step = Math.min(len, (inputPlan?.handTrackingSpeed ?? 0.6) * FR * K);
          if (len > 1e-8) d = { x: dx / len * step, y: dy / len * step };
        }
        fwd = P.foeDistance() > P.swordArt.measure.clinch ? 1 : 0;
        const past = history.findLast(x => rt - x.t >= (inputPlan?.mirrorReactionSeconds ?? 0.2))?.step;
        if (coverDist(P, E) <= CONFIG.SECRET.risolutoCover && past) fwd = past === 'advance' ? -1 : 1;
      } else if (spec.tech === 'gyeoksal') {
        const isAttack = G.ai.mode === 'attack';
        if (isAttack && !enemyAttack) enemyAttack = { t: rt };
        if (!isAttack && enemyAttack) { enemyAttack = null; releaseAt = rt + (inputPlan?.guardReleaseSeconds ?? 0.3); }
        const reaction = inputPlan?.guardReactionSeconds ?? 0.25;
        const lag = inputPlan?.forwardPressLagSeconds ?? 0;
        press = (!!enemyAttack && rt - enemyAttack.t >= reaction) || rt < releaseAt;
        const forwardWithPress = (!!enemyAttack && rt - enemyAttack.t >= reaction + lag) || rt < releaseAt;
        fwd = forwardWithPress || P.foeDistance() > P.swordArt.measure.contact + 0.2 ? 1 : 0;
      } else if (spec.tech === 'ibSpin') {
        if (watch.spinArm.armed) {
          fwd = P.foeDistance() > requestedGap ? 1 : 0;
          if (!circle && !circleDone && P.foeDistance() <= requestedGap + 0.12) {
            if (inputPlan) scheduledCircleAt ??= rt + inputPlan.circleStartDelaySeconds;
            else { circle = { t: rt, previous: [0, 0] }; intent('attack_circle_begin', { radius: 0.15, seconds: 0.8, turns: 1.35 }); event('circle_begin', { radius: 0.15, seconds: 0.8, turns: 1.35 }); }
          }
        }
      } else if (spec.tech === 'goNoSen') {
        // Let the actual 2 s idle timer arm. Once armed, walk only if outside the chosen test range.
        fwd = watch.iaiArm.armed && P.foeDistance() > requestedGap ? 1 : 0;
      }
      if (!inputPlan && due != null && rt >= due && !busy) { due = null; tap = true; tapDelivered = true; }
    }
    // Planned fingers keep moving/releasing on schedule while the game consumes
    // and ignores their inputs during a secret; never resume an old gesture later.
    if (inputPlan && due != null && P.alive) {
      if (!tapIntentBegan && rt >= due - inputPlan.tapApproachSeconds) {
        tapIntentBegan = true; intent('planned_tap_approach', { releaseAt: round(due), window: !!watch.open });
      }
      if (rt >= due) { due = null; tap = true; tapDelivered = true; }
    }
    if (inputPlan && scheduledCircleAt != null && rt >= scheduledCircleAt && !circle && !circleDone && stillTrial && P.alive) {
      circle = { t: rt, previous: [0, 0] }; scheduledCircleAt = null;
      intent('attack_circle_begin', { radius: inputPlan.circleRadius, seconds: inputPlan.circleSeconds, turns: inputPlan.circleTurns, level: inputPlan.level });
      event('circle_begin', { radius: inputPlan.circleRadius, seconds: inputPlan.circleSeconds, turns: inputPlan.circleTurns });
    }
    if (!potential && press && !lastPress) intent('new_guard_forward_press', { gap: round(P.foeDistance()) });
    lastPress = press;
    if (!potential && tap && (!inputPlan || !tapIntentBegan)) intent('tap_after_window', { window: !!watch.open, gap: round(P.foeDistance()) });
    if (inputPlan && P.alive && (spec.tech === 'andareRisoluto' && stillTrial && !busy || spec.tech === 'goNoSen' && tapIntentBegan && !tapDelivered)) {
      wobbleStartedAt ??= rt;
      const t = rt - wobbleStartedAt, w = inputPlan.handWobbleHz * Math.PI * 2, a = inputPlan.handWobbleRadius, ph = inputPlan.phase;
      const point = [a * (Math.sin(w * t + ph) - Math.sin(ph)), a * 0.8 * (Math.cos(w * t + ph) - Math.cos(ph))];
      d.x += point[0] - wobblePrevious[0]; d.y += point[1] - wobblePrevious[1]; wobblePrevious = point; down = true;
    }
    if (circle && (!busy || inputPlan)) {
      const q = Math.min(1, Math.max(0, (rt - circle.t) / (circle.baselineCut ? 0.2 : inputPlan?.circleSeconds ?? 0.8)));
      let point = circle.baselineCut ? [-0.65 * q, -0.18 * q] : [0.15 * (Math.cos(q * Math.PI * 2 * 1.35) - 1), 0.15 * Math.sin(q * Math.PI * 2 * 1.35)];
      if (inputPlan && !circle.baselineCut) {
        const ip = inputPlan, warped = q + ip.circleTimeWarpFraction * Math.sin(Math.PI * 2 * q) / (Math.PI * 2);
        const th = warped * Math.PI * 2 * ip.circleTurns, ph = ip.phase;
        const radius = ip.circleRadius * (1 + ip.circleRadialNoiseFraction * Math.sin(th * 3 + ph));
        const r0 = ip.circleRadius * (1 + ip.circleRadialNoiseFraction * Math.sin(ph));
        point = [ip.circleEllipseX * (radius * Math.cos(th + ph) - r0 * Math.cos(ph)), (radius * Math.sin(th + ph) - r0 * Math.sin(ph)) / ip.circleEllipseX];
      }
      d = { x: point[0] - circle.previous[0], y: point[1] - circle.previous[1] };
      circle.previous = point; down = true;
      if (q >= 1) { circle = null; circleDone = true; }
    }
    if (inputPlan && fwd) {
      const a = (inputPlan.stickBaseAngleDegrees + inputPlan.stickAngleAmplitudeDegrees * Math.sin(rt * Math.PI * 2 * inputPlan.stickHz + inputPlan.phase)) * Math.PI / 180;
      side = Math.abs(fwd) * inputPlan.footMagnitude * Math.sin(a);
      fwd *= inputPlan.footMagnitude * Math.cos(a);
    }
    if (inputPlan) row.intendedInputTrace.push({ t: round(rt), dx: round(d.x), dy: round(d.y), tap, fwd: round(fwd), side: round(side), guard: press, down, busy, window: !!watch.open });
    if (busy || !P.alive) { d = { x: 0, y: 0 }; tap = false; }
    let secBusy = busy;
    const swipe = Math.hypot(d.x, d.y) / FR >= CONFIG.SKILL.swingSpeed;
    const circleGo = watch.spinCircle(FR, d, down, !secBusy && P.alive);
    const atkWin = !!watch.open && !watch.stickOwns() && !watch.circleOwns();
    const eligible = !(CONFIG.SECRET.secretHold && (P.skill.tap || P.skill.pom));
    if (!potential && (natural || row.requestAttempted === 0) && (((atkWin && (tap || swipe && !watch.S?.do?.tapOnly)) || circleGo) && !secBusy && P.alive && eligible)) {
      const o = watch.fire();
      if (o) o.dir = [d.x, d.y];
      if (request(o, circleGo ? 'attack_circle' : tap ? 'tap_in_window' : 'swipe_in_window')) secBusy = true;
    } else if (!potential && tap && stillTrial) {
      event('input_missed_window', { busy, window: !!watch.open, state: P.state });
    }
    if (!secBusy && P.alive && (tap || swipe) && watch.canBuffer() && variant === 'on') watch.buffer([d.x, d.y]);
    const bufHold = !secBusy && !!watch.bufferHold && variant === 'on';
    if (secBusy || bufHold) tap = false;
    guard.held = press;
    if (guard.broken && (!press || (!P.skill.swinging && !P.skill.tap && !swipe && !tap))) guard.broken = false;
    if (press && !bufHold && (swipe || tap)) guard.broken = true;
    const guardHold = press && !guard.broken && !secBusy;
    uniq.feed(d.x, d.y, FR, guardHold || bufHold || press, guardHold || bufHold);
    if (!secBusy && !guardHold && !bufHold && !uniq.winding && P.alive) { P.handOffset.x += d.x; P.handOffset.y += d.y; }
    P.handHeld = down;
    P.inputActive = !secBusy && !bufHold && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    P.handGrip = P.inputActive;
    if (tap && P.alive) ordinary('tap');
    const feet = P.alive && !P.stamina.exhausted && P.skill.secretPhase !== 'stiff';
    P.move.set(feet ? side : 0, feet ? fwd : 0); P.stickX = feet ? side : 0; P.stickY = feet ? fwd : 0;
    const input = { t: round(rt), dx: round(d.x), dy: round(d.y), tap, fwd: feet ? fwd : 0, side: feet ? side : 0, guard: press, down };
    const sig = JSON.stringify([input.dx, input.dy, input.tap, input.fwd, input.side, input.guard, input.down]);
    if (sig !== lastInput) { row.inputTrace.push(input); lastInput = sig; }
  }
  G.before = () => {
    watch.update(DT, !!P.skill.sec);
    if (watch.queued && !P.skill.sec && P.alive && (natural || row.requestAttempted === 0)) {
      const o = watch.fire();
      request(o, 'gyeoksal_auto_after_separation');
      if (variant === 'off') { watch.queued = null; watch.open = null; }
    }
    guard.step(DT);
    if (guard.active) { P.inputActive = true; P.handHeld = true; }
    if (watch.opened !== seenWindows) {
      row.conditions.windows += watch.opened - seenWindows; seenWindows = watch.opened;
      event('window', { ctx: watch.open?.ctx ? jsonCopy(watch.open.ctx) : null, gap: round(P.foeDistance()), remaining: round(watch.open?.t / K) });
      if (!potential && spec.tech !== 'gyeoksal' && spec.tech !== 'ibSpin' && (natural || row.requestAttempted === 0) && (!inputPlan || !tapDelivered && due == null)) due = G.t / K + (inputPlan?.reactionSeconds ?? 0.25);
    }
    const ready = !!(watch.iaiArm.armed || watch.spinArm.armed);
    if (ready && !wasReady) { row.conditions.readyEpisodes++; event('ready'); }
    wasReady = ready;
    history.push({ t: G.t / K, step: foeStep(E) });
    if (history.length > 240) history.shift();
  };
  function observe() {
    const rt = G.t / K;
    for (const [f, tr] of tracked) {
      tr.minConsciousness = Math.min(tr.minConsciousness, f.consciousness);
      tr.minStamina = Math.min(tr.minStamina, f.stamina.value);
      if (f.state !== tr.state) {
        event('state', { who: f === P ? 'player' : 'enemy', from: tr.state, to: f.state, cause: f.causeOfDeath ?? null });
        if (['down', 'getup', 'kneel'].includes(f.state) && tr.state === 'stand') tr.knockdowns++;
        tr.state = f.state;
      }
      if (tr.armed && !f.armed) { tr.disarms++; event('disarm', { who: f === P ? 'player' : 'enemy' }); }
      tr.armed = !!f.armed;
    }
    const touch = bladesTouch(P, E);
    if (touch && !touched) row.contacts.bladeTouchEpisodes++;
    touched = touch;
    if (runRef && P.skill.sec === runRef && P.skill.sec.stage !== lastStage) { lastStage = P.skill.sec.stage; event('stage', { stage: lastStage }); }
    if (runRef && P.skill.sec !== runRef) {
      row.timeline.attackEnded ??= round(rt); endAt = rt;
      const res = P.instantResult ? jsonCopy(P.instantResult) : null;
      if (res?.hit) row.contacts.instantBodyHitRuns++;
      if (res?.blocked) row.contacts.blockedRuns++;
      event('ended', { result: res }); runRef = null;
    }
    if (endAt != null && row.timeline.controlRestored == null && !P.skill.sec && !P.iai && !P.ibSpin && !P.skill.tap && !P.skill.pom) row.timeline.controlRestored = round(rt);
    const s = row.timeline.started;
    if (s != null) for (const n of [1, 5]) if (row.timeline[`at${n}s`] == null && rt >= s + n) row.timeline[`at${n}s`] = { t: round(rt), player: snapshot(P), enemy: snapshot(E) };
  }
  try {
    while (G.t / K < observerLimit) {
      const rt = G.t / K;
      if (rt + 1e-8 >= nextFrame) { inputFrame(); nextFrame += FR; }
      G.step(); observe();
      const now = G.t / K;
      if (!P.alive || !E.alive || P.state === 'dead' || E.state === 'dead') terminatedByDeath = true;
      if (natural) {
        if ((now >= activeLimit || terminatedByDeath) && !P.skill.sec && !P.iai && !P.ibSpin) {
          if (!terminatedByDeath || row.timeline.started == null || now >= row.timeline.started + 5) break;
        }
      } else if (row.requestAttempted > 0) {
        if (!P.skill.sec && !P.iai && !P.ibSpin && now >= (row.timeline.started ?? attemptedAt) + 5) break;
      } else if (now >= activeLimit || terminatedByDeath) break;
    }
  } catch (error) { row.validity.executionFailure = String(error.stack ?? error); row.validity.observationComplete = false; }
  if (P.skill.sec || P.iai || P.ibSpin) { row.validity.observationComplete = false; row.validity.executionFailure ??= 'observer_budget_ended_with_action_active; action was not cancelled'; }
  if (row.requestAttempted && !row.accepted && variant === 'on') row.validity.executionFailure ??= 'secret_request_not_accepted';
  if (!row.requestAttempted) row.validity.executionFailure ??= terminatedByDeath ? 'died_before_secret_request' : row.attempted ? 'intended_input_did_not_produce_secret_request' : row.conditions.windows ? 'window_observed_but_script_did_not_attempt' : 'no_executable_opportunity_observed';
  row.contacts.clashes = G.clashes;
  const finalP = snapshot(P), finalE = snapshot(E);
  row.final = { player: finalP, enemy: finalE, secretUsed: P.secretUsed ?? 0, secretLeft: secretLeft(P), wounds };
  row.inflicted = healthResult(startE, finalE, tracked.get(E), wounds.filter(w => w.attacker === 'player'));
  row.received = healthResult(startP, finalP, tracked.get(P), wounds.filter(w => w.victim === 'player'));
  row.stamina = { spent: round(total(P.stamina.spent)), spentByKind: jsonCopy(P.stamina.spent), recovered: round(P.stamina.recovered), min: round(tracked.get(P).minStamina), exhaustions: P.stamina.counts.exhaustion, final: round(P.stamina.value), recoveryTo15AfterRun: null };
  row.conditions.diagnostic = spec.tech === 'andareRisoluto' ? { ...watch.riso, me: undefined, foe: undefined, hand: [P.handOffset.x, P.handOffset.y], gapNow: P.foeDistance(), lungeGap: lungeGap(P), meFreeNow: meFree(P), coverDistanceNow: coverDist(P, E) } : spec.tech === 'gyeoksal' ? jsonCopy(watch.pc ?? {}) : spec.tech === 'goNoSen' ? { arm: { t: watch.iaiArm.t, armed: watch.iaiArm.armed }, event: jsonCopy(watch.ev), poor: jsonCopy(watch.poor) } : { arm: { t: watch.spinArm.t, armed: watch.spinArm.armed }, circleFires: watch.circleFires ?? 0, poor: jsonCopy(watch.poor) };
  // Record callback data, never Rapier or Fighter object references.
  if (row.conditions.diagnostic?.pend?.stance) row.conditions.diagnostic.pend = { ...row.conditions.diagnostic.pend };
  row.timeline.observedPhysicsSeconds = round(G.t);
  row.timeline.observedStandardSeconds = round(G.t / K);
  row.timeline.wallSeconds = round((performance.now() - wallStart) / 1000);
  row.validity.observationHorizonEnded = row.timeline.started == null && !terminatedByDeath && G.t / K >= activeLimit;
  row.validity.stationaryTargetSeedCaveat = potential ? 'same geometry + fresh state across seeds can be deterministic duplicates; do not claim six independent human/input samples' : null;
  row.validity.at5sObserved = row.timeline.at5s != null;
  row.validity.configHashAfter = configHash();
  row.validity.configUnchanged = row.validity.configHashBefore === row.validity.configHashAfter;
  row.validity.secretUsesWithinLimit = (P.secretUsed ?? 0) <= secretUsesOf(P);
  if (inputPlan) {
    const commandTrace = row.intendedInputTrace.map(({ t, dx, dy, tap, fwd, side, guard, down }) => [t, dx, dy, tap, fwd, side, guard, down]);
    row.inputTraceDigest = createHash('sha256').update(JSON.stringify(commandTrace)).digest('hex');
    const actionTrace = commandTrace.filter(([, dx, dy, tap, fwd, side, guard, down]) => dx || dy || tap || fwd || side || guard || down);
    row.inputActionDigest = createHash('sha256').update(JSON.stringify(actionTrace)).digest('hex');
    row.inputMetrics = { intendedFrames: commandTrace.length, intendedHandPathLength: round(row.intendedInputTrace.reduce((a, s) => a + Math.hypot(s.dx, s.dy), 0)), maxIntendedHandSpeedPerStandardSecond: round(Math.max(0, ...row.intendedInputTrace.map(s => Math.hypot(s.dx, s.dy) / FR))), tapReleases: row.intendedInputTrace.filter(s => s.tap).map(s => s.t), guardPresses: row.events.filter(e => e.kind === 'intended_input' && e.source === 'new_guard_forward_press').map(e => e.t), circleBegins: row.events.filter(e => e.kind === 'circle_begin').map(e => e.t) };
  }
  G.world.free();
  return row;
}

function summarize(rows, wallSeconds) {
  const groups = {};
  for (const r of rows) {
    const key = [r.school, r.tech, r.branch ?? '-', r.mode, r.variant, r.range, r.inputPlan?.level ?? '-'].join('|');
    const g = groups[key] ??= { school: r.school, tech: r.tech, branch: r.branch, mode: r.mode, variant: r.variant, range: r.range, inputLevel: r.inputPlan?.level ?? null, inputPlanIds: [], inputActionDigests: [], n: 0, attempted: 0, requestAttempted: 0, accepted: 0, started: 0, windows: 0, readyEpisodes: 0, hitRuns: 0, blockedRuns: 0, inflictedSeverity: [], receivedSeverity: [], enemyDead: 0, playerDead: 0, enemyEndCauses: {}, playerEndCauses: {}, enemyDisarms: 0, playerDisarms: 0, enemyKnockdowns: 0, playerKnockdowns: 0, incomplete: 0, executionFailures: {}, observedSeconds: [], wallSeconds: 0, actualBranches: {} };
    g.n++; for (const k of ['attempted', 'requestAttempted', 'accepted', 'started']) g[k] += r[k];
    g.windows += r.conditions.windows; g.readyEpisodes += r.conditions.readyEpisodes;
    if (r.contacts.inflictedWoundCallbacks || r.contacts.instantBodyHitRuns) g.hitRuns++;
    g.blockedRuns += r.contacts.blockedRuns;
    g.inflictedSeverity.push(r.inflicted.severity); g.receivedSeverity.push(r.received.severity);
    g.enemyDead += +r.inflicted.dead; g.playerDead += +r.received.dead;
    if (r.inflicted.dead) { const c = r.inflicted.engineEndCauseClass ?? r.inflicted.cause ?? 'unknown'; g.enemyEndCauses[c] = (g.enemyEndCauses[c] ?? 0) + 1; }
    if (r.received.dead) { const c = r.received.engineEndCauseClass ?? r.received.cause ?? 'unknown'; g.playerEndCauses[c] = (g.playerEndCauses[c] ?? 0) + 1; }
    if (r.inputPlan) { g.inputPlanIds.push(r.inputPlan.id); g.inputActionDigests.push(r.inputActionDigest); }
    g.enemyDisarms += r.inflicted.disarms; g.playerDisarms += r.received.disarms;
    g.enemyKnockdowns += r.inflicted.knockdowns; g.playerKnockdowns += r.received.knockdowns;
    g.incomplete += +!r.validity.observationComplete;
    if (r.validity.executionFailure) g.executionFailures[r.validity.executionFailure] = (g.executionFailures[r.validity.executionFailure] ?? 0) + 1;
    g.observedSeconds.push(r.timeline.observedStandardSeconds); g.wallSeconds += r.timeline.wallSeconds;
    for (const [st, n] of Object.entries(r.conditions.actualBranchCounts)) g.actualBranches[st] = (g.actualBranches[st] ?? 0) + n;
  }
  for (const g of Object.values(groups)) for (const k of ['inflictedSeverity', 'receivedSeverity']) {
    const a = g[k]; g[`${k}Mean`] = round(a.reduce((a, b) => a + b, 0) / a.length); g[`${k}Max`] = Math.max(...a);
  }
  return { build: BUILD, suite, generatedAt: new Date().toISOString(), rows: rows.length, measuredWallSeconds: round(wallSeconds), groups: Object.values(groups), interpretation: ['Direct requests bypass window conditions and measure potential only.', 'Conditional and scripted policies use engine-truth geometry/window observations; no human success rate is measured.', 'Off is the same input policy with the secret connection disabled, not a pure damage multiplier comparison.', 'No runtime files, configuration constants, wounds, hit tests, uses, or stamina thresholds are changed.', 'All timelines are fixed-step physics converted to standard seconds by TIME.k; camera, hit stop, secret slow motion and rendering are absent.', 'Ranges specify initial direct-request distance or a target for normal input; actual request distance is recorded separately.', 'Severity is onWound reported trauma; lacerationSeverity is the actual new wound list. End-point and peak consciousness loss are separate.'] };
}

fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(`${out}.jsonl`) || fs.existsSync(`${out}.summary.json`)) {
  throw new Error(`Output already exists: ${out}. Choose a new --out path to preserve the original records.`);
}
fs.writeFileSync(`${out}.jsonl`, '');
const rows = [], start = performance.now();
const modes = suite === 'input' ? ['input_robustness'] : suite === 'pilot' ? ['direct_potential', 'conditional_upper'] : suite === 'potential' ? ['direct_potential'] : suite === 'conditional' ? ['conditional_upper'] : suite === 'scripted30' ? ['scripted_30s'] : ['direct_potential', 'conditional_upper'];
for (const mode of modes) for (const spec of specs) {
  // Conditional branch is produced by the actual guard, not selected by a request.
  if (mode !== 'direct_potential' && spec.stance && spec.stance !== 'geojeong') continue;
  if (mode === 'input_robustness') {
    for (const level of inputLevels) for (const id of inputPlanIds) {
      const plan = makeInputPlan(id, level);
      const row = runTrial(spec, mode, 'on', plan.opponentSeed, 'normal', plan); rows.push(row);
      fs.appendFileSync(`${out}.jsonl`, JSON.stringify(row) + '\n');
      process.stderr.write(`${mode} ${spec.tech} level=${level} plan=${id}: intent=${row.attempted} request=${row.requestAttempted} accepted=${row.accepted} started=${row.started} damage=${row.inflicted.severity}/${row.received.severity} wall=${row.timeline.wallSeconds}s ${row.validity.executionFailure ?? ''}\n`);
    }
    continue;
  }
  for (const range of ranges) for (const seed of seeds) for (const variant of variants) {
    const row = runTrial(spec, mode, variant, seed, range); rows.push(row);
    fs.appendFileSync(`${out}.jsonl`, JSON.stringify(row) + '\n');
    process.stderr.write(`${mode} ${spec.tech}${row.branch ? ':' + row.branch : ''} ${range} seed=${seed} ${variant}: attempt=${row.attempted} accepted=${row.accepted} started=${row.started} damage=${row.inflicted.severity}/${row.received.severity} dead=${+row.inflicted.dead}/${+row.received.dead} wall=${row.timeline.wallSeconds}s ${row.validity.executionFailure ?? ''}\n`);
  }
}
const summary = summarize(rows, (performance.now() - start) / 1000);
fs.writeFileSync(`${out}.summary.json`, JSON.stringify(summary, null, 2) + '\n');
process.stdout.write(JSON.stringify({ out, rows: rows.length, wallSeconds: summary.measuredWallSeconds, groups: summary.groups.map(({ tech, branch, mode, variant, range, n, started, windows, inflictedSeverityMean, receivedSeverityMean, executionFailures }) => ({ tech, branch, mode, variant, range, n, started, windows, inflictedSeverityMean, receivedSeverityMean, executionFailures })) }, null, 2) + '\n');
