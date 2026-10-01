// Actual AI-v-AI combat observations, with no wound suppression or scene injury.
// Default: 3 support candidates x 2 weapons x seeds 7,11 = 12 rounds.
// node tools/sim/combat_recovery_probe.mjs --out=/workspace/halfsword-hybrid-evidence/combat-recovery.json
import { newRound, CONFIG, AI, DT, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CANDIDATES = {
  baseline: { assist: 0.3, catchMode: 'on', catchScale: 1 },
  mixed: { assist: 0.2, catchMode: 'on', catchScale: 0.5 },
  off: { assist: 0, catchMode: 'off', catchScale: 0 },
};
const JOINTS = { F: { hip: 'thighF', knee: 'shinF', ankle: 'footF' }, B: { hip: 'thighB', knee: 'shinB', ankle: 'footB' } };
const LIMIT_S = 30, AFTER_DEATH_S = 2, GETUP_RAW_LIMIT_PER_ACTOR = 1200;
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const xyz = (v) => [v.x, v.y, v.z];
const anchor = (body, p) => V(p).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
const stat = () => ({ n: 0, sum: 0, min: Infinity, max: -Infinity, maxAtS: null });
function observe(stats, value, timeS) {
  if (!Number.isFinite(value)) throw new Error('Nonfinite observation');
  stats.n++; stats.sum += value; stats.min = Math.min(stats.min, value);
  if (value > stats.max) { stats.max = value; stats.maxAtS = timeS; }
}
function summarize(s) { return s.n ? { sampleCount: s.n, mean: s.sum / s.n, min: s.min, max: s.max, range: s.max - s.min, maxAtS: s.maxAtS } : null; }
function options(args) {
  const o = { candidates: Object.keys(CANDIDATES), weapons: ['longsword', 'zweihander'], seeds: [7, 11], out: '/workspace/halfsword-hybrid-evidence/combat-recovery.json' };
  for (const arg of args) {
    const m = /^--(candidates|weapons|seeds|out)=(.+)$/.exec(arg);
    if (!m) throw new Error('Use --candidates=baseline,mixed,off --weapons=longsword,zweihander --seeds=7,11 --out=path');
    o[m[1]] = m[1] === 'out' ? m[2] : m[2].split(',');
  }
  if (o.candidates.some((v) => !CANDIDATES[v]) || o.weapons.some((v) => !['longsword', 'zweihander'].includes(v))) throw new Error('Unknown candidate or weapon');
  o.seeds = o.seeds.map((s) => { if (!/^\d+$/.test(String(s)) || +s > 0xffffffff) throw new Error('Seed must be uint32'); return +s; });
  for (const k of ['candidates', 'weapons', 'seeds']) if (new Set(o[k]).size !== o[k].length) throw new Error(`Duplicate ${k}`);
  return o;
}
function health(f) {
  return { state: f.state, stateTimeS: f.stateTime, limbs: { ...f.limbs }, woundCount: f.wounds.length, legHealth: f.legHealth, blood: f.blood, pain: f.pain, consciousness: f.consciousness, vigor: f.vigor, armed: f.armed, causeOfDeath: f.causeOfDeath ?? null };
}
function finite(f, timeS) {
  for (const [name, body] of [...Object.entries(f.bodies), ['sword', f.sword]]) {
    for (const method of ['translation', 'rotation', 'linvel', 'angvel']) {
      if (Object.values(body[method]()).some((v) => !Number.isFinite(v))) throw new Error(`Nonfinite ${f.name}.${name}.${method} at ${timeS}s`);
    }
  }
  for (const v of [f.stateTime, f.legHealth, f.blood, f.pain, f.consciousness, f.vigor, f.tiltDeg()]) if (!Number.isFinite(v)) throw new Error(`Nonfinite ${f.name} health at ${timeS}s`);
}
function floorContact(world, body) {
  let contact = false;
  const col = body.collider(0);
  world.contactPairsWith(col, (other) => {
    if (!other.parent()?.isFixed() || other.translation().y >= 0) return;
    world.contactPair(col, other, (manifold) => { if (manifold.numSolverContacts() > 0) contact = true; });
  });
  return contact;
}
function geometry(f, world, timeS) {
  const origin = V(f.bodies.pelvis.translation()), inverse = Q(f.bodies.pelvis.rotation()).invert();
  const joints = {};
  for (const side of ['F', 'B']) {
    joints[side] = {};
    for (const [name, key] of Object.entries(JOINTS[side])) {
      const j = f.jointByName[key], a = anchor(j.parent, j.joint.anchor1()), b = anchor(j.child, j.joint.anchor2());
      joints[side][name] = { anchor1WorldM: xyz(a), anchor2WorldM: xyz(b), anchorGapM: a.distanceTo(b), anchor1PelvisFrameM: xyz(a.clone().sub(origin).applyQuaternion(inverse)), relativeAngularVelocityParentRadps: xyz(V(j.child.angvel()).sub(V(j.parent.angvel())).applyQuaternion(Q(j.parent.rotation()).invert())), motorGain: j.gain ?? 1 };
    }
  }
  const feet = Object.fromEntries(['F', 'B'].map((side) => {
    const foot = f.bodies['foot' + side], sole = f.solePoint('foot' + side, new THREE.Vector3()), leg = f.gait.legs[side];
    return [side, { soleWorldM: xyz(sole), floorContact: floorContact(world, foot), footVelocityMps: xyz(V(foot.linvel())), gaitStance: leg.stance, gaitPinActive: f.gait.active && leg.stance, soleToPinHorizontalM: Math.hypot(sole.x - leg.pinC.x, sole.z - leg.pinC.z) }];
  }));
  return { timeS, ...health(f), pelvisPositionM: xyz(origin), pelvisVelocityMps: xyz(V(f.bodies.pelvis.linvel())), chestTiltDeg: f.tiltDeg(), levH: f.gait.levH, levC: f.gait.levC, handoverProgress: f.gait.handU, joints, feet };
}
function actorRecord(f) {
  return {
    name: f.name, initial: health(f), stateTransitions: [], injuryChanges: [], actualWounds: [],
    getupRawSamples: [], getupRawOmittedSamples: 0, geometryEvents: [],
    anchorGaps: Object.fromEntries(Object.values(JOINTS).flatMap((side) => Object.values(side)).map((key) => [key, stat()])),
    getupMetrics: {}, injuredGetupMetrics: {}, injuredStandMetrics: {},
    firstActualWoundS: null, firstLimbInjuryS: null, receivedImpactCount: 0,
  };
}
function phaseAdd(metrics, sample) {
  const add = (key, value) => observe(metrics[key] ??= stat(), value, sample.timeS);
  add('pelvisHeightM', sample.pelvisPositionM[1]); add('chestTiltDeg', sample.chestTiltDeg);
  for (const side of ['F', 'B']) {
    for (const name of ['hip', 'knee', 'ankle']) {
      const p = sample.joints[side][name];
      add(`${side}.${name}.lateralPositionM`, p.anchor1PelvisFrameM[2]);
      add(`${side}.${name}.anchorGapM`, p.anchorGapM);
      add(`${side}.${name}.angularSpeedRadps`, Math.hypot(...p.relativeAngularVelocityParentRadps));
    }
    add(side + '.floorContactFraction', +sample.feet[side].floorContact);
    if (sample.feet[side].floorContact) add(side + '.contactFootHorizontalSpeedMps', Math.hypot(sample.feet[side].footVelocityMps[0], sample.feet[side].footVelocityMps[2]));
    if (sample.feet[side].gaitPinActive) add(side + '.activePinResidualM', sample.feet[side].soleToPinHorizontalM);
  }
}

export function combatRound(candidateName, weapon, seed) {
  const settings = { assist: CONFIG.GAIT.assist, catchMode: CONFIG.GAIT.catchMode, catchScale: CONFIG.GAIT.catchScale }, random = Math.random;
  const row = { candidateName, candidate: CANDIDATES[candidateName], weapon, seed, status: 'ok', failures: [], impacts: [] };
  let G;
  const wallBegin = performance.now();
  try {
    Object.assign(CONFIG.GAIT, row.candidate);
    G = newRound({ seed, weapon, weapon2: weapon, walls: true, AI2Class: AI });
    row.bothAIActive = G.ai instanceof AI && G.ai2 instanceof AI;
    if (!row.bothAIActive) throw new Error('Both AI actors were not initialized');
    const actors = [G.player, G.enemy], records = actors.map(actorRecord), previous = actors.map(health);
    row.actors = records;
    G.onWound = (att, vic, r) => {
      const record = records[actors.indexOf(vic)];
      record.receivedImpactCount++;
      row.impacts.push({ timeS: G.t + DT, attacker: att.name, victim: vic.name, type: r.type, part: r.part ?? null, zone: r.zone, energyJ: r.energy, severity: r.severity, pass: r.pass, finish: !!r.finish, victimAfterImpact: health(vic) });
    };
    let firstDeathS = null, elapsed = 0;
    const trace = createHash('sha256');
    for (let step = 0; step < Math.ceil(LIMIT_S / DT); step++) {
      G.step(); elapsed = G.t;
      for (let i = 0; i < actors.length; i++) {
        const f = actors[i], record = records[i], old = previous[i]; finite(f, elapsed);
        const now = health(f), transition = old.state !== now.state;
        trace.update(JSON.stringify([now, xyz(V(f.bodies.pelvis.translation())), xyz(V(f.tipVel))]));
        if (transition) record.stateTransitions.push({ timeS: elapsed, from: old.state, to: now.state, previousStateTimeS: old.stateTimeS, after: now });
        const limbChange = Object.keys(now.limbs).some((key) => now.limbs[key] !== old.limbs[key]);
        const newWound = now.woundCount > old.woundCount;
        if (limbChange || newWound) record.injuryChanges.push({ timeS: elapsed, before: old, after: now });
        if (newWound) {
          record.firstActualWoundS ??= elapsed;
          for (const wound of f.wounds.slice(old.woundCount)) record.actualWounds.push({ timeS: elapsed, part: wound.part, type: wound.type, severity: wound.severity, bleed: wound.bleed, stump: !!wound.stump });
        }
        if (Object.values(now.limbs).some((value) => value < 1)) record.firstLimbInjuryS ??= elapsed;
        // Connection gap maxima are sampled every physics step, including pre-injury.
        for (const key of Object.keys(record.anchorGaps)) {
          const j = f.jointByName[key], a = anchor(j.parent, j.joint.anchor1()), b = anchor(j.child, j.joint.anchor2());
          observe(record.anchorGaps[key], a.distanceTo(b), elapsed);
        }
        const getup = now.state === 'getup';
        const postInjury = record.firstActualWoundS != null || record.firstLimbInjuryS != null;
        if (getup || transition || limbChange || newWound || (postInjury && now.state === 'stand' && step % 12 === 0)) {
          const sample = geometry(f, G.world, elapsed);
          if (getup) {
            phaseAdd(record.getupMetrics, sample);
            if (postInjury) phaseAdd(record.injuredGetupMetrics, sample);
            if (record.getupRawSamples.length < GETUP_RAW_LIMIT_PER_ACTOR) record.getupRawSamples.push(sample);
            else record.getupRawOmittedSamples++;
          }
          if (postInjury && now.state === 'stand') phaseAdd(record.injuredStandMetrics, sample);
          if (transition || limbChange || newWound) record.geometryEvents.push(sample);
        }
        previous[i] = now;
      }
      if (firstDeathS == null && actors.some((f) => f.state === 'dead')) firstDeathS = elapsed;
      if (firstDeathS != null && elapsed >= firstDeathS + AFTER_DEATH_S - DT / 2) break;
    }
    row.simulatedSeconds = elapsed; row.firstDeathS = firstDeathS; row.traceSha256 = trace.digest('hex');
    for (let i = 0; i < actors.length; i++) {
      const record = records[i]; record.final = health(actors[i]);
      record.actualWoundObserved = record.firstActualWoundS != null; record.actualLimbInjuryObserved = record.firstLimbInjuryS != null;
      record.injuryScope = record.actualWoundObserved || record.actualLimbInjuryObserved ? 'Actual combat injury observed' : 'No actual wound/limb injury in this actor; blunt impacts and falls may still occur';
      for (const key of ['anchorGaps', 'getupMetrics', 'injuredGetupMetrics', 'injuredStandMetrics']) record[key] = Object.fromEntries(Object.entries(record[key]).map(([name, value]) => [name, summarize(value)]));
    }
    row.anyActualWound = records.some((r) => r.actualWoundObserved); row.anyActualLimbInjury = records.some((r) => r.actualLimbInjuryObserved);
    row.injuryScope = row.anyActualWound || row.anyActualLimbInjury ? 'Actual injury observed; inspect actor and getup coverage separately' : 'No actual wound/limb injury in this round';
  } catch (error) { row.status = 'fail'; row.failures.push(error.message); }
  finally { Object.assign(CONFIG.GAIT, settings); Math.random = random; G?.world.free(); G?.eventQueue.free(); }
  row.wallSeconds = (performance.now() - wallBegin) / 1000;
  return row;
}

if (isMain(import.meta.url)) {
  try {
    const opt = options(process.argv.slice(2)), start = performance.now();
    const result = {
      schemaVersion: 1, probe: 'combat_recovery_probe', protocol: { bothActors: 'AI normal, actual AI2Class:AI; same weapon on both sides; original default looks/health/combat', wounds: 'actual combat only, no injection, suppression, freezing, manual injury or parked actor', limitSeconds: LIMIT_S, afterFirstDeathSeconds: AFTER_DEATH_S, timestepSeconds: DT, getupRawLimitPerActor: GETUP_RAW_LIMIT_PER_ACTOR, geometryCadence: 'anchor gaps every step; getup geometry120Hz, postinjury stand10Hz, state/injury events full snapshot' },
      units: { anchors: 'm; exact anchor1/2 body local coordinates transformed to world', lateral: 'm in actual pelvis rotation frame; includes movement of the frame', angular: 'rad/s child-parent angvel in parent frame', feet: 'floor solver contact, velocity m/s, pin residual m; pin flag is not immobility proof' },
      interpretation: 'No human acceptance thresholds; AI outcomes are not human difficulty. Injury-free rounds and injured actors without getup must not be counted as recovery evidence. Natural lateral-wobble reproduction remains undecided.',
      references: ['src/fighter.js:347-358 joint anchor definitions', 'src/fighter.js:848-868 timed state transitions', 'src/fighter.js:977-995 actual wound/limb injury', 'tools/sim/harness_m.mjs:64 player AI2Class and :65-80 unchanged step'], rows: [],
    };
    for (const candidate of opt.candidates) for (const weapon of opt.weapons) for (const seed of opt.seeds) {
      const row = combatRound(candidate, weapon, seed); result.rows.push(row);
      process.stderr.write(`${candidate}/${weapon}/${seed}: ${row.status}, simulated ${row.simulatedSeconds?.toFixed(2) ?? '?'}s, wall ${row.wallSeconds.toFixed(2)}s, actualWound=${row.anyActualWound ?? false}\n`);
    }
    result.wallSeconds = (performance.now() - start) / 1000;
    result.simulatedSeconds = result.rows.reduce((sum, r) => sum + (r.simulatedSeconds ?? 0), 0);
    result.sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8' }).trim();
    result.sourceSha256 = {};
    for (const file of ['src/fighter.js', 'src/gait.js', 'src/config.js', 'src/ai.js', 'src/combat.js', 'tools/sim/harness_m.mjs', 'tools/sim/combat_recovery_probe.mjs']) result.sourceSha256[file] = createHash('sha256').update(await readFile(new URL('../../' + file, import.meta.url))).digest('hex');
    const json = JSON.stringify(result) + '\n'; await writeFile(opt.out, json); process.stdout.write(json);
    if (result.rows.some((r) => r.status !== 'ok')) process.exitCode = 1;
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 2; }
}
