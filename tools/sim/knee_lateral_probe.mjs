// Read-only knee-rise geometry observations through the real harness_m step.
// No human thresholds, force monkeypatches, control changes, or phone-reproduction claim.
// node tools/sim/knee_lateral_probe.mjs --candidates=baseline,mixed,off \
//   --conditions=healthy,hurt --seeds=7 --out=/workspace/halfsword-hybrid-evidence/lateral-all.json
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const PRESETS = {
  baseline: { assist: 0.3, catchMode: 'on', catchScale: 1 },
  mixed: { assist: 0.2, catchMode: 'on', catchScale: 0.5 },
  off: { assist: 0, catchMode: 'off', catchScale: 0 },
};
const JOINTS = { F: { hip: 'thighF', knee: 'shinF', ankle: 'footF' }, B: { hip: 'thighB', knee: 'shinB', ankle: 'footB' } };
const LEG_BODIES = ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
const TORSO = ['pelvis', 'abdomen', 'chest'];
const SETTLE_S = Math.max(2.5, CONFIG.ARENA.startHold + 0.5);
const LIMIT_S = 12; // Test observation window, never a new game clock.
const POST_HANDOVER_S = 3;
const CONDITIONS = ['healthy', 'hurt', 'wound', 'wound_side_pos', 'wound_side_neg'];
const references = {
  jointAnchors: 'src/fighter.js:347 local a1/a2 = joint position minus body local position, rotated by inverse local rotation; :358 joint parent/child creation. Rapier ImpulseJoint.anchor1/anchor2 are body-local.',
  legLayout: 'src/fighter.js:60-65 body definitions; :91-96 hip/knee/ankle joints. Hybrid foot joints become spherical in src/gait.js:32-39.',
  jointLimitAxes: 'src/fighter.js:2333 MOTOR_AXES=[3,4,5], HINGE_AXIS=3; hinge physical axis is body-local z (:356). Current limits are queried from the live Rapier joint.',
  injury: 'src/fighter.js:538 legHealth=(legF+legB)/2; :848-868 state timer uses legHealth/vigor; :1673-1680 side injury and gait gain alter motor parameters.',
  kneelPose: 'src/fighter.js:1629-1638 pose blends to F hip1.25/knee-1.45/ankle0.2 and B hip-0.15/knee-1.75/ankle0.8 rad through kneelAmount.',
  footPins: 'src/gait.js:69-103 legs retain pinC and stance; src/fighter.js:820 calls gait.pinFeet if active. pinC is a target, not proof of immobility.',
  selfCollision: 'src/fighter.js:272-274 groups exclude self body/legs. Geometry contact queries below bypass group filtering for observation only.',
};
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const arr = (v) => [v.x, v.y, v.z];
const worldAnchor = (body, local) => V(local).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
const stat = () => ({ n: 0, sum: 0, min: Infinity, max: -Infinity });
const add = (s, v) => { if (!Number.isFinite(v)) throw new Error('Nonfinite observation'); s.n++; s.sum += v; s.min = Math.min(s.min, v); s.max = Math.max(s.max, v); };
const statsDone = (s) => s.n ? { mean: s.sum / s.n, min: s.min, max: s.max } : null;
class Passive { update() {} }

function options(args) {
  const result = { candidates: ['baseline'], conditions: ['healthy', 'hurt'], seeds: [7], out: null };
  for (const argument of args) {
    const m = /^--(candidates|conditions|seeds|out)=(.+)$/.exec(argument);
    if (!m) throw new Error(`Use --candidates=baseline,mixed,off --conditions=healthy,hurt --seeds=7 --out=path; invalid argument ${argument}`);
    result[m[1]] = m[1] === 'out' ? m[2] : m[2].split(',');
  }
  if (result.candidates.some((c) => !PRESETS[c])) throw new Error('Unknown candidate');
  if (result.conditions.some((c) => !CONDITIONS.includes(c))) throw new Error('Unknown condition');
  result.seeds = result.seeds.map((s) => {
    if (!/^\d+$/.test(String(s)) || +s > 0xffffffff) throw new Error('Seeds must be uint32 integers');
    return +s;
  });
  for (const k of ['seeds', 'conditions', 'candidates']) if (new Set(result[k]).size !== result[k].length) throw new Error(`Duplicate ${k}`);
  return result;
}

function angularObservation(j) {
  const parentQ = Q(j.parent.rotation());
  const relative = j.restInv.clone().multiply(parentQ.clone().invert().multiply(Q(j.child.rotation()))).normalize();
  if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w);
  const sinHalf = Math.hypot(relative.x, relative.y, relative.z);
  const angle = 2 * Math.atan2(sinHalf, relative.w);
  const rotVec = sinHalf > 0 ? new THREE.Vector3(relative.x, relative.y, relative.z).multiplyScalar(angle / sinHalf) : new THREE.Vector3();
  const omega = V(j.child.angvel()).sub(V(j.parent.angvel())).applyQuaternion(parentQ.clone().invert());
  const axes = j.type === 'hinge' ? { z: 3 } : { x: 3, y: 4, z: 5 };
  const raw = j.joint.rawSet;
  const limits = Object.fromEntries(Object.entries(axes).map(([key, axis]) => [key, {
    enabled: raw.jointLimitsEnabled(j.joint.handle, axis),
    minRad: raw.jointLimitsMin(j.joint.handle, axis), maxRad: raw.jointLimitsMax(j.joint.handle, axis),
  }]));
  return { type: j.type, rotationVectorRad: arr(rotVec), relativeAngularVelocityParentRadps: arr(omega), limits, motorGain: j.gain ?? 1, targetQuaternion: [j.target.x, j.target.y, j.target.z, j.target.w] };
}

function groundContact(world, body) {
  let result = false;
  const collider = body.collider(0);
  world.contactPairsWith(collider, (other) => {
    if (!other.parent()?.isFixed()) return;
    world.contactPair(collider, other, (manifold) => { if (manifold.numSolverContacts() > 0) result = true; });
  });
  return result;
}

function pairsFor(f) {
  const joined = new Set(f.joints.map((j) => [j.parent.handle, j.child.handle].sort((a, b) => a - b).join(':')));
  const names = [...LEG_BODIES, ...TORSO];
  const pairs = [];
  for (let i = 0; i < names.length; i++) for (let k = i + 1; k < names.length; k++) {
    if (!LEG_BODIES.includes(names[i]) && !LEG_BODIES.includes(names[k])) continue;
    const a = f.bodies[names[i]], b = f.bodies[names[k]];
    if (joined.has([a.handle, b.handle].sort((x, y) => x - y).join(':'))) continue;
    const ca = a.collider(0), cb = b.collider(0);
    const ga = ca.collisionGroups() >>> 0, gb = cb.collisionGroups() >>> 0;
    pairs.push({ names: [names[i], names[k]], a: ca, b: cb, groupsPermitContact: !!((ga >>> 16) & (gb & 65535)) && !!((gb >>> 16) & (ga & 65535)) });
  }
  return pairs;
}

function snapshot(G, timeS, pairList, startSoles) {
  const f = G.player;
  const pelvis = f.bodies.pelvis;
  const inverse = Q(pelvis.rotation()).invert();
  const origin = V(pelvis.translation());
  const points = {};
  const feet = {};
  for (const side of ['F', 'B']) {
    points[side] = {};
    for (const [name, key] of Object.entries(JOINTS[side])) {
      const j = f.jointByName[key];
      const a = worldAnchor(j.parent, j.joint.anchor1());
      const b = worldAnchor(j.child, j.joint.anchor2());
      const local = a.clone().sub(origin).applyQuaternion(inverse);
      points[side][name] = { parentAnchorWorldM: arr(a), childAnchorWorldM: arr(b), anchorGapM: a.distanceTo(b), parentAnchorPelvisFrameM: arr(local), ...angularObservation(j) };
    }
    const body = f.bodies['foot' + side];
    const sole = f.solePoint('foot' + side, new THREE.Vector3());
    const leg = f.gait.legs[side];
    const pin = leg.pinC;
    feet[side] = {
      soleWorldM: arr(sole), solePelvisFrameM: arr(sole.clone().sub(origin).applyQuaternion(inverse)),
      worldVelocityMps: arr(V(body.linvel())), worldAngularVelocityRadps: arr(V(body.angvel())),
      groundContact: groundContact(G.world, body),
      gaitStance: leg.stance, gaitPinActive: f.gait.active && leg.stance,
      pinTargetWorldM: arr(pin), soleToPinHorizontalM: Math.hypot(sole.x - pin.x, sole.z - pin.z),
      soleFromStartHorizontalM: Math.hypot(sole.x - startSoles[side].x, sole.z - startSoles[side].z),
    };
  }
  const overlaps = [];
  for (const pair of pairList) {
    const contact = pair.a.contactCollider(pair.b, 0);
    if (contact && contact.distance < 0) overlaps.push({ pair: pair.names, signedDistanceM: contact.distance, groupsPermitContact: pair.groupsPermitContact });
  }
  return {
    timeS, state: f.state, stateTimeS: f.stateTime, kneelAmount: f.kneelAmount,
    kneelTimeS: f.kneelTime, riseTimeS: f.riseTime, legF: f.limbs.legF, legB: f.limbs.legB, legHealth: f.legHealth,
    blood: f.blood, pain: f.pain, vigor: f.vigor, muscle: f.muscle,
    pelvisWorldM: arr(origin), pelvisQuaternion: Object.values(pelvis.rotation()), pelvisVelocityMps: arr(V(pelvis.linvel())), chestTiltDeg: f.tiltDeg(),
    levH: f.gait.levH, levC: f.gait.levC, handoverProgress: f.gait.handU,
    joints: points, feet,
    widthsPelvisFrameM: Object.fromEntries(['hip', 'knee', 'ankle'].map((name) => [name, { signedZ: points.F[name].parentAnchorPelvisFrameM[2] - points.B[name].parentAnchorPelvisFrameM[2], absoluteZ: Math.abs(points.F[name].parentAnchorPelvisFrameM[2] - points.B[name].parentAnchorPelvisFrameM[2]) }])),
    geometricOverlaps: overlaps,
  };
}

function finiteDeep(value, path = 'sample') {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Nonfinite ${path}`);
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) finiteDeep(child, `${path}.${key}`);
}

function summarize(samples) {
  const sums = {}, changes = {}, previous = {};
  const observe = (name, value) => add(sums[name] ??= stat(), value);
  for (const sample of samples) {
    observe('pelvisHeightM', sample.pelvisWorldM[1]); observe('chestTiltDeg', sample.chestTiltDeg);
    for (const joint of ['hip', 'knee', 'ankle']) observe(joint + 'WidthM', sample.widthsPelvisFrameM[joint].absoluteZ);
    for (const side of ['F', 'B']) {
      for (const name of ['hip', 'knee', 'ankle']) {
        const point = sample.joints[side][name], key = side + '.' + name;
        observe(key + '.anchorGapM', point.anchorGapM);
        observe(key + '.lateralPositionM', point.parentAnchorPelvisFrameM[2]);
        observe(key + '.relativeAngularSpeedRadps', Math.hypot(...point.relativeAngularVelocityParentRadps));
        const old = previous[key];
        if (old) {
          const speed = (point.parentAnchorPelvisFrameM[2] - old.position) / (sample.timeS - old.time);
          observe(key + '.lateralVelocityMps', speed);
          const sign = Math.sign(speed);
          if (old.nonzeroSign && sign && old.nonzeroSign !== sign) changes[key] = (changes[key] ?? 0) + 1;
          previous[key] = { position: point.parentAnchorPelvisFrameM[2], time: sample.timeS, nonzeroSign: sign || old.nonzeroSign };
        } else previous[key] = { position: point.parentAnchorPelvisFrameM[2], time: sample.timeS, nonzeroSign: 0 };
      }
      observe(side + '.footHorizontalSpeedMps', Math.hypot(sample.feet[side].worldVelocityMps[0], sample.feet[side].worldVelocityMps[2]));
      observe(side + '.soleToPinHorizontalM', sample.feet[side].soleToPinHorizontalM);
      observe(side + '.soleFromStartHorizontalM', sample.feet[side].soleFromStartHorizontalM);
      observe(side + '.groundContactFraction', +sample.feet[side].groundContact);
      if (sample.feet[side].groundContact) {
        observe(side + '.groundContactFootHorizontalSpeedMps', Math.hypot(sample.feet[side].worldVelocityMps[0], sample.feet[side].worldVelocityMps[2]));
        if (sample.feet[side].gaitPinActive) observe(side + '.pinActiveSoleToPinHorizontalM', sample.feet[side].soleToPinHorizontalM);
      }
    }
    observe('overlapPairCount', sample.geometricOverlaps.length);
    observe('maximumOverlapDepthM', Math.max(0, ...sample.geometricOverlaps.map((p) => -p.signedDistanceM)));
  }
  return { sampleCount: samples.length, metrics: Object.fromEntries(Object.entries(sums).map(([key, value]) => [key, { ...statsDone(value), range: value.max - value.min }])), rawLateralVelocitySignChanges: changes };
}

export function kneeTrial(candidateName, condition, seed) {
  const candidate = PRESETS[candidateName];
  const saved = { assist: CONFIG.GAIT.assist, catchMode: CONFIG.GAIT.catchMode, catchScale: CONFIG.GAIT.catchScale };
  const random = Math.random;
  let G;
  const row = { candidateName, candidate, condition, seed, status: 'ok', failures: [], transitions: [], injectedEvents: [], samples: [] };
  try {
    Object.assign(CONFIG.GAIT, candidate);
    G = newRound({ seed, walls: false, AIClass: Passive }); G.park();
    const f = G.player; f.skill.autoGuard = true;
    for (let i = 0; i < Math.ceil(SETTLE_S / DT); i++) { f.move.set(0, 0); G.step(); }
    if (f.state !== 'stand') throw new Error('Not standing after scene settle');
    if (condition === 'hurt') f.limbs.legF = 0.45;
    if (condition.startsWith('wound')) {
      // Inject a controlled injury through the real damage handler. This is not
      // a collision-generated wound; impact physics is deliberately separate.
      const h = { part: 'thighF', zone: 'leg', type: 'cut', severity: 0.8, energy: 60, bleedPerSev: CONFIG.ANATOMY.leg.bleed, local: new THREE.Vector3() };
      f.applyWound(h);
      row.injectedEvents.push({ timeS: 0, kind: 'applyWound', ...h, note: 'synthetic damage-handler input, not a sword collision' });
    }
    f.knockDown(false);
    if (f.state !== 'getup') throw new Error('knockDown(false) did not enter getup');
    const pairs = pairsFor(f);
    row.selfGeometryPairs = pairs.map(({ names, groupsPermitContact }) => ({ names, groupsPermitContact }));
    const soles = Object.fromEntries(['F', 'B'].map((side) => [side, f.solePoint('foot' + side, new THREE.Vector3())]));
    row.samples.push(snapshot(G, 0, pairs, soles));
    let oldState = 'getup', returnedS = null, handoverEndS = null, seenHandover = false;
    let sideImpulseApplied = false;
    const trace = createHash('sha256');
    for (let i = 0; i < Math.ceil(LIMIT_S / DT); i++) {
      if (condition.startsWith('wound_side_') && !sideImpulseApplied && f.state === 'getup' && f.kneelAmount <= 0.75) {
        const side = condition.endsWith('pos') ? 1 : -1;
        const impulse = new THREE.Vector3(0, 0, side).applyQuaternion(Q(f.bodies.pelvis.rotation()));
        impulse.y = 0; impulse.normalize().multiplyScalar(18);
        f.bodies.pelvis.applyImpulse(impulse, true);
        row.injectedEvents.push({ timeS: i * DT, kind: 'lateralImpulse', body: 'pelvis', impulseWorldNs: arr(impulse), magnitudeNs: 18, trigger: 'first getup step with kneelAmount <= 0.75' });
        sideImpulseApplied = true;
      }
      f.move.set(0, 0); G.step();
      const sample = snapshot(G, (i + 1) * DT, pairs, soles);
      finiteDeep(sample); row.samples.push(sample); trace.update(JSON.stringify(sample));
      if (sample.state !== oldState) { row.transitions.push({ timeS: sample.timeS, from: oldState, to: sample.state, stateTimeS: sample.stateTimeS }); oldState = sample.state; }
      if (sample.state === 'stand' && returnedS == null) returnedS = sample.timeS;
      if (returnedS != null && sample.levH > 0) seenHandover = true;
      if (seenHandover && handoverEndS == null && sample.handoverProgress >= 1 && sample.levH <= 0) handoverEndS = sample.timeS;
      if (handoverEndS != null && sample.timeS - handoverEndS >= POST_HANDOVER_S - DT / 2) break;
    }
    row.stateReturnedS = returnedS; row.handoverEndS = handoverEndS;
    row.traceSha256 = trace.digest('hex');
    row.byPhase = {
      getup: summarize(row.samples.filter((s) => s.state === 'getup')),
      stand: summarize(row.samples.filter((s) => s.state === 'stand')),
      afterHandover: summarize(row.samples.filter((s) => handoverEndS != null && s.timeS >= handoverEndS)),
      all: summarize(row.samples),
    };
    if (returnedS == null) row.failures.push('No stand transition within observation window');
    if (condition.startsWith('wound_side_') && !sideImpulseApplied) row.failures.push('Requested lateral impulse trigger not reached');
    if (handoverEndS == null || row.samples.at(-1).timeS - handoverEndS < POST_HANDOVER_S - DT / 2) row.failures.push('Handover completion plus 3s not fully observed');
  } catch (error) { row.failures.push(error.message); }
  finally { Object.assign(CONFIG.GAIT, saved); Math.random = random; G?.world.free(); G?.eventQueue.free(); }
  if (row.failures.length) row.status = 'fail';
  return row;
}

if (isMain(import.meta.url)) {
  try {
    const opt = options(process.argv.slice(2)), begin = performance.now();
    const result = {
      schemaVersion: 2, probe: 'knee_lateral_probe', references,
      protocol: { settleS: SETTLE_S, observationLimitS: LIMIT_S, postHandoverS: POST_HANDOVER_S, timestepS: DT, injury: 'healthy legF=legB=1; hurt changes only legF=0.45; wound variants inject applyWound cut severity0.8/60J on thighF with actual configured bleeding, followed by forced kneel entry. Side variants inject one 18Ns pelvis impulse during rising. Not collision reproduction or calibrated human injury.', start: 'actual Fighter.knockDown(false)', input: 'player move0, enemy parked, player autoGuard; harness step unmodified' },
      meanings: {
        pelvisFrame: 'actual pelvis quaternion inverse; local x forward, y up, z lateral. Lateral finite differences include pelvis frame rotation.',
        jointPoint: 'exact joint anchor1 on parent, and anchor2 on child transformed by each body rotation+translation; both recorded, not COM approximations',
        angular: 'relative child-parent world angvel expressed in parent frame; rotation vector is the controller representation, not exact Euler joint angles or definitive spherical limit violations',
        signChanges: 'all raw nonzero finite-difference lateral velocity sign reversals; no amplitude/noise gate; raw 120Hz samples retained',
        footSlip: 'sole movement, foot COM velocity and pin target residual; stance/pinActive are controller flags, not proof of fixed foot',
        overlap: 'signed collider distance queried geometrically without collision-group filtering; negative means overlap. Adjacent joint-connected bodies excluded. Overlap is not a temporal pass-through proof or mesh diagnosis.',
        status: 'tool execution and required state/window observations only; neither ok nor stand means natural or successful human movement. User lateral-wobble reproduction remains undecided.',
      }, rows: [],
    };
    for (const name of opt.candidates) for (const seed of opt.seeds) for (const condition of opt.conditions) result.rows.push(kneeTrial(name, condition, seed));
    result.sourceSha256 = {};
    for (const file of ['src/fighter.js', 'src/gait.js', 'src/config.js', 'tools/sim/harness_m.mjs', 'tools/sim/knee_lateral_probe.mjs']) result.sourceSha256[file] = createHash('sha256').update(await readFile(new URL('../../' + file, import.meta.url))).digest('hex');
    const json = JSON.stringify(result) + '\n';
    if (opt.out) {
      await writeFile(opt.out, json);
      process.stdout.write(JSON.stringify({ rows: result.rows.length, failures: result.rows.filter((r) => r.status !== 'ok').length, out: opt.out }) + '\n');
    } else process.stdout.write(json);
    process.stderr.write(`knee_lateral_probe: ${result.rows.length} scene(s), ${((performance.now() - begin) / 1000).toFixed(2)}s wall\n`);
    if (result.rows.some((r) => r.status !== 'ok')) process.exitCode = 1;
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 2; }
}
