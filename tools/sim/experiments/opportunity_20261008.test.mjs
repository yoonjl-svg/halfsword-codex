/** Prepared real Fighter / Skill / AI connections for the opportunity trial.
 * Native physics steps: zero. This does not measure contact success, lethality,
 * natural movement, or player acceptance. Inputs/transforms are prepared.
 * Usage: node tools/sim/experiments/opportunity_20261008.test.mjs /tmp/fresh.json [name-regex]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = process.argv[2], selection = process.argv[3] ? new RegExp(process.argv[3]) : null;
assert.ok(out && path.isAbsolute(out) && !fs.existsSync(out), 'Provide a fresh absolute report path');
const sourcePaths = fs.readdirSync(path.join(root, 'src')).filter(p => p.endsWith('.js')).map(p => `src/${p}`)
  .concat(['package-lock.json', 'tools/sim/harness_m.mjs', 'tools/sim/experiments/opportunity_20261008.test.mjs']);
const hashes = () => Object.fromEntries(sourcePaths.map(p => [p,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
const before = hashes();
const executedTool = fs.readFileSync(fileURLToPath(import.meta.url));
const { newRound, THREE, AI } = await import('../harness_m.mjs');
const { SWORDSMANSHIP, applySwordsmanship, recordSwordsmanshipInput, advanceSwordsmanship } = await import('../../../src/swordsmanship.js');
const { OPPORTUNITY, captureOpportunityPose, findOpportunity } = await import('../../../src/opportunity_target.js');
const { updateOpportunityPlayer: updatePlayer, opportunityCrossingReference } = await import('../../../src/opportunity_player.js');
const { updateOpportunityEpisode, opportunityCandidate, neckCrossingTechnique, opportunityPad,
  opportunityAICrossing, advanceOpportunityAICommand, applyOpportunityAIHand, applyOpportunityAIAim } = await import('../../../src/opportunity_ai.js');
const updateOpportunityPlayer = (f, dt, hand, aim) => updatePlayer(f, dt, hand, aim, SWORDSMANSHIP);
const results = [];
let fixtures = 0;
async function test(name, fn) {
  if (selection && !selection.test(name)) return;
  try { results.push({ name, pass: true, details: await fn() }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); console.error('FAIL', name, error.stack); }
}
function fixture(fn, options = {}) {
  fixtures++;
  const G = newRound({ seed: 317, weapon: 'longsword', weapon2: 'longsword', gap: 1.5, walls: false, ...options });
  const f = G.player, v = G.enemy;
  f.foe = v; v.foe = f;
  f.finishEntryModel = v.finishEntryModel = 'low';
  f.opportunityModel = v.opportunityModel = 'v1';
  G.combat.finishRuleModel = 'power';
  try { return fn({ G, f, v, ai: G.ai }); }
  finally { G.eventQueue.free(); G.world.free(); }
}
function pose(f, v, { state = 'getup', x = 1, chest = .93, pelvis = .55, head = 1.2, z = 0 } = {}) {
  const c = f.bodies.chest.translation();
  v.state = state;
  for (const [part, y] of Object.entries({ chest, pelvis, head })) {
    v.bodies[part].setTranslation({ x: c.x + x, y, z: c.z + z }, true);
  }
  // Prepared clearance only, not native disarming or a successful parry.
  v.sword.setTranslation({ x: c.x + x, y: .6, z: 3 }, true);
  v.tipPrev = v.bladePoint(1); v.hitPointPrev = v.bladePoint(.7);
}
const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const bodyState = body => ({ p: V(body.translation()), q: Q(body.rotation()), com: V(body.worldCom()),
  v: new THREE.Vector3(), w: new THREE.Vector3() });

await test('precision entry preserves previous v1 and requires explicit valid comparison URL', async () => {
  const { configureOpportunityTrial } = await import('../../../src/opportunity_trial.js');
  const { enabled, precisionEnabled } = await import('../../../src/opportunity_target.js');
  let entries = 0;
  for (const weapon of ['longsword', 'branch', 'rapier']) {
    for (const [model, expected] of [['baseline', 'off'], ['assisted', 'v1'], ['precision', 'v2']]) {
      const info = configureOpportunityTrial(new URLSearchParams({ opportunity: model, weapon }));
      assert.equal(info.active, true); assert.equal(info.opportunity, expected);
      assert.equal(info.finish, 'low'); assert.equal(info.recovery, 'legacy');
      assert.deepEqual(info.settings, { skill: '0.7', difficulty: 'normal' });
      assert.equal(enabled({ opportunityModel: expected }), expected !== 'off');
      assert.equal(precisionEnabled({ opportunityModel: expected }), expected === 'v2'); entries++;
    }
  }
  for (const query of ['', 'opportunity=precision&unexpected=1', 'opportunity=precision&opportunity=precision',
    'opportunity=precision&weapon=rapier&weapon=rapier', 'opportunity=precision&weapon=unknown',
    'opportunity=precision&swordsmanship=legacy', 'opportunity=unknown']) {
    const info = configureOpportunityTrial(new URLSearchParams(query));
    assert.equal(info.active, false, query); assert.equal(info.opportunity, 'off', query); entries++;
  }
  return { entries, ordinaryDefaultChanged: false };
});

await test('opportunity trial leaves damage, weapon, gravity, and low-finish policy source unchanged', () => {
  const baseline = '451a541e5d806674ed1fc62b3d1d1f63cc8117fb'; // Current approved weapons/physics before precision work.
  const checked = ['src/combat.js', 'src/config.js', 'src/weapons.js', 'src/finish_rule.js', 'src/finish_entry.js'];
  for (const p of checked) {
    const original = execFileSync('git', ['show', `${baseline}:${p}`], { cwd: root });
    assert.deepEqual(fs.readFileSync(path.join(root, p)), original, `${p}: policy changed during target-guidance trial`);
  }
  return { baseline, checked };
});

for (const shape of ['stab', 'cut', 'blunt']) await test(`same ${shape} contact: prediction and actual analysis unchanged by opportunity flag`, () => fixture(({ G, f, v }) => {
  pose(f, v); f.skill.tap = { down: false, go: true }; f.skill.thrustPush = true;
  f.emoMods = { dealt: 1, pass: 0 }; v.emoMods = { taken: 1, pass: 0 };
  f.cacheState(); v.cacheState();
  const entries = [...G.combat.info.values()];
  const wi = entries.find(i => i.fighter === f && i.part === 'blade');
  const vi = entries.find(i => i.fighter === v && i.part === 'chest');
  const P = bodyState(vi.body), sw = bodyState(wi.body);
  const point = new THREE.Vector3(.11, 0, .05).applyQuaternion(P.q).add(P.p);
  const normal = new THREE.Vector3(1, 0, 0).applyQuaternion(P.q).normalize();
  const y = normal.clone().negate(), x = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const comLocal = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
  const S = { p: point.clone().addScaledVector(y, -(f.weaponCfg.hiltLength + f.weaponCfg.bladeLength)), q,
    v: (shape === 'stab' ? y : shape === 'cut' ? x : z).clone().multiplyScalar(7), w: new THREE.Vector3() };
  S.com = S.p.clone().add(comLocal.applyQuaternion(q));
  const pair = { w: wi, v: vi };
  const measure = predicting => G.combat.analyze(pair, point, S, P, predicting);
  const beforeVictim = JSON.stringify({ state: v.state, wounds: v.wounds, blood: v.blood, plate: v.plate, pain: v.pain });
  f.opportunityModel = 'off'; const baseline = [measure(true), measure(false)];
  f.opportunityModel = 'v1'; const candidate = [measure(true), measure(false)];
  assert.ok(baseline[0]); assert.equal(baseline[0].type, shape);
  assert.deepEqual(candidate, baseline);
  assert.equal(JSON.stringify({ state: v.state, wounds: v.wounds, blood: v.blood, plate: v.plate, pain: v.pain }), beforeVictim);
  assert.ok(!candidate[0].finishingStrike); assert.ok(!candidate[0].finish);
  return { shape, energy: candidate[0].energy, effective: candidate[0].eff, threshold: candidate[0].thr,
    predictionPass: candidate[0].pass, actualType: candidate[1].type, unchanged: true };
}));

for (const state of ['kneel', 'down', 'getup']) await test(`elevated ${state}: edged cut selects exposed neck`, () => fixture(({ f, v }) => {
  pose(f, v, { state }); const found = findOpportunity(f, captureOpportunityPose(v), 'cut');
  assert.ok(found); assert.equal(found.zone, 'neck'); assert.equal(found.kind, 'cut'); assert.equal(found.targetId, v.index);
  return { state, zone: found.zone, target: found.target.toArray() };
}));

for (const prepared of [{ name: 'healthy stand', chest: 1.33, pelvis: .95, head: 1.61 },
  { name: 'deliberate low stand', chest: .72, pelvis: .5, head: 1 }]) {
  await test(`${prepared.name}: no vulnerable-target assist`, () => fixture(({ f, v }) => {
    pose(f, v, { state: 'stand', ...prepared }); v.balance = 100; v.offBalance = 0;
    for (const kind of ['cut', 'blunt', 'thrust']) assert.equal(findOpportunity(f, captureOpportunityPose(v), kind), null);
    return prepared;
  }));
}
for (const state of ['down', 'getup']) await test(`fully low ${state}: existing low-finish mechanic retains ownership`, () => fixture(({ f, v }) => {
  pose(f, v, { state, chest: .45, pelvis: .35, head: .55 });
  for (const kind of ['cut', 'blunt', 'thrust']) assert.equal(findOpportunity(f, captureOpportunityPose(v), kind), null);
  return { state, rejectedKinds: ['cut', 'blunt', 'thrust'] };
}));

await test('collapse state alone is insufficient; actual tilted torso opens the elevated opportunity', () => fixture(({ f, v }) => {
  pose(f, v, { state: 'getup', chest: 1.33, pelvis: .95, head: 1.61 });
  assert.equal(findOpportunity(f, captureOpportunityPose(v), 'cut'), null);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4);
  v.bodies.chest.setRotation(q, true);
  const found = findOpportunity(f, captureOpportunityPose(v), 'cut'); assert.ok(found); assert.equal(found.zone, 'neck');
  return { uprightStateRefused: true, preparedTorsoTiltDegrees: 45, tiltedAccepted: true };
}));

await test('branch uses head blunt target and cannot acquire cut or pointed thrust', () => fixture(({ f, v }) => {
  pose(f, v); const snapshot = captureOpportunityPose(v);
  const found = findOpportunity(f, snapshot, 'blunt'); assert.ok(found); assert.equal(found.zone, 'head');
  assert.equal(findOpportunity(f, snapshot, 'cut'), null); assert.equal(findOpportunity(f, snapshot, 'thrust'), null);
  return { zone: found.zone, target: found.target.toArray() };
}, { weapon: 'branch' }));

await test('explicit pointed thrust chooses neck or face without inventing a cut', () => fixture(({ f, v }) => {
  pose(f, v); const found = findOpportunity(f, captureOpportunityPose(v), 'thrust');
  assert.ok(found); assert.ok(['neck', 'face'].includes(found.zone)); assert.equal(found.kind, 'thrust');
  return { zone: found.zone, target: found.target.toArray() };
}, { weapon: 'rapier' }));

await test('pointed thrust can use exposed front face around covered neck but cannot aim through the back of head', () => fixture(({ f, v }) => {
  pose(f, v); const snapshot = captureOpportunityPose(v);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  v.sword.setRotation(q, true);
  v.sword.setTranslation({ x: snapshot.neck.x, y: snapshot.neck.y - .13,
    z: -v.weaponCfg.hiltLength - v.weaponCfg.bladeLength / 2 }, true);
  const found = findOpportunity(f, captureOpportunityPose(v), 'thrust'); assert.ok(found); assert.equal(found.zone, 'face');
  v.bodies.head.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  assert.equal(findOpportunity(f, captureOpportunityPose(v), 'thrust'), null);
  return { frontFaceAccepted: true, backOfHeadRefused: true };
}, { weapon: 'rapier' }));

await test('firearm cannot acquire melee opportunity targets', () => fixture(({ f, v }) => {
  pose(f, v); assert.equal(f.weapon.gun, true);
  for (const kind of ['cut', 'blunt', 'thrust']) assert.equal(findOpportunity(f, captureOpportunityPose(v), kind), null);
  return { gun: true, meleeAcquisition: false };
}, { weapon: 'pistol' }));

for (const gate of ['feature-off', 'attacker-dead', 'attacker-disarmed', 'attacker-down', 'broken-weapon',
  'victim-dead', 'head-detached', 'outside-reach', 'behind', 'far-side']) {
  await test(`${gate}: opportunity cannot be acquired`, () => fixture(({ f, v }) => {
    pose(f, v);
    if (gate === 'feature-off') f.opportunityModel = 'off';
    if (gate === 'attacker-dead') f.state = 'dead';
    if (gate === 'attacker-disarmed') f.armed = false;
    if (gate === 'attacker-down') f.state = 'down';
    if (gate === 'broken-weapon') f.weaponBroken = true;
    if (gate === 'victim-dead') v.state = 'dead';
    if (gate === 'head-detached') v.decapitated = true;
    if (gate === 'outside-reach') pose(f, v, { x: 4 });
    if (gate === 'behind') pose(f, v, { x: -.3 });
    if (gate === 'far-side') pose(f, v, { x: .7, z: 2 });
    for (const kind of ['cut', 'blunt', 'thrust']) assert.equal(findOpportunity(f, captureOpportunityPose(v), kind), null);
    return { gate };
  }));
}

await test('real opposing blade covering neck refuses targeting; moving it aside reopens', () => fixture(({ f, v }) => {
  pose(f, v); const open = findOpportunity(f, captureOpportunityPose(v), 'cut'); assert.ok(open);
  v.sword.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  v.sword.setTranslation({ x: open.target.x, y: open.target.y - v.weaponCfg.hiltLength - v.weaponCfg.bladeLength * .5, z: open.target.z }, true);
  assert.equal(findOpportunity(f, captureOpportunityPose(v), 'cut'), null);
  pose(f, v); assert.ok(findOpportunity(f, captureOpportunityPose(v), 'cut'));
  return { coveredRefused: true, uncoveredAccepted: true };
}));

await test('captured victim geometry is an owned snapshot unaffected by later native changes', () => fixture(({ f, v }) => {
  pose(f, v); const snapshot = captureOpportunityPose(v), saved = JSON.stringify(snapshot);
  const initial = findOpportunity(f, snapshot, 'cut'); assert.ok(initial);
  pose(f, v, { state: 'stand', x: 4, chest: 1.33, pelvis: .95, head: 1.61 });
  assert.equal(JSON.stringify(snapshot), saved);
  const delayed = findOpportunity(f, snapshot, 'cut'); assert.deepEqual(delayed, initial);
  assert.equal(findOpportunity(f, captureOpportunityPose(v), 'cut'), null);
  return { snapshotUnchanged: true, delayedTarget: delayed.target.toArray() };
}));

await test('invalid or incomplete observed rotations cannot become a target', () => fixture(({ f, v }) => {
  pose(f, v);
  for (const key of ['headQ', 'chestQ']) {
    const missing = captureOpportunityPose(v); delete missing[key];
    assert.equal(findOpportunity(f, missing, 'thrust'), null);
    const invalid = captureOpportunityPose(v); invalid[key].w = NaN;
    assert.equal(findOpportunity(f, invalid, 'thrust'), null);
  }
  return { missingAndNonfiniteRotationCases: 4 };
}));

function playerInput(f, { id = 1, dx = .006, dy = 0, held = true, active = true, reversing = false } = {}) {
  f.handHeld = held;
  assert.ok(recordSwordsmanshipInput(f, { id, timeS: id / 60, dx, dy, held, active }));
  f.skill.vel.set(dx * 60, dy * 60);
  advanceSwordsmanship(f.skill, 1 / 60);
  if (reversing) f.swordsmanshipState.reversing = true;
}
const command = () => ({ hand: new THREE.Vector3(.45, .1, .15), aim: new THREE.Vector3(1, .2, .3).normalize() });
function preparePlayer(f) { assert.ok(applySwordsmanship(f)); playerInput(f); }

await test('without movement input, vulnerable opponent cannot generate an attack or hand correction', () => fixture(({ f, v }) => {
  pose(f, v); assert.ok(applySwordsmanship(f));
  const { hand, aim } = command(), handBefore = hand.clone(), aimBefore = aim.clone();
  for (let i = 0; i < 20; i++) updateOpportunityPlayer(f, 1 / 60, hand, aim);
  assert.deepEqual(hand, handBefore); assert.ok(aim.angleTo(aimBefore) < 1e-7);
  assert.equal(f.opportunityPlayer.captures, 0); assert.equal(f.opportunityPlayer.phase, 'idle');
  assert.equal(f.skill.tap, null); assert.equal(f.skill.thrusts, 0);
  return { captures: 0, automaticAttacks: 0 };
}));

await test('actual swordsmanship resolve connects bounded preparation while preserving lateral input', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f);
  const inputBefore = { hand: f.handOffset.toArray(), vel: f.skill.vel.toArray(), raw: f.skill.aimRaw.toArray() };
  const bodyBefore = f.bodies.chest.translation(), swordBefore = f.sword.translation();
  f.prepareSwordsmanship(1 / 60);
  assert.equal(f.opportunityPlayer.captures, 1); assert.equal(f.opportunityPlayer.phase, 'preparing');
  assert.ok(Math.abs(f.opportunityPlayer.handY) <= .013); assert.ok(Math.abs(f.opportunityPlayer.pitch) <= .027);
  assert.deepEqual({ hand: f.handOffset.toArray(), vel: f.skill.vel.toArray(), raw: f.skill.aimRaw.toArray() }, inputBefore);
  assert.deepEqual(f.bodies.chest.translation(), bodyBefore); assert.deepEqual(f.sword.translation(), swordBefore);
  return { phase: f.opportunityPlayer.phase, handY: f.opportunityPlayer.handY, pitch: f.opportunityPlayer.pitch };
}));

await test('upward swipe and reversal retain player ownership', () => fixture(({ f, v }) => {
  pose(f, v); assert.ok(applySwordsmanship(f)); playerInput(f, { dx: 0, dy: .006 });
  let { hand, aim } = command(); const handX = hand.x, handZ = hand.z, azimuth = Math.atan2(aim.z, aim.x);
  updateOpportunityPlayer(f, 1 / 60, hand, aim);
  assert.equal(f.opportunityPlayer.handY, 0, 'lower-target help must not subtract an intentional upward swipe');
  assert.equal(hand.x, handX); assert.equal(hand.z, handZ); assert.ok(Math.abs(Math.atan2(aim.z, aim.x) - azimuth) < 1e-12);
  const preparedPitch = f.opportunityPlayer.pitch;
  playerInput(f, { id: 2, dx: 0, dy: -.006, reversing: true }); f.skill.swinging = false;
  ({ hand, aim } = command()); updateOpportunityPlayer(f, 1 / 60, hand, aim);
  assert.equal(f.opportunityPlayer.phase, 'committed'); assert.equal(f.opportunityPlayer.pitch, preparedPitch);
  assert.equal(f.opportunityPlayer.captures, 1);
  assert.ok(f.skill.vel.y < 0); return { phase: f.opportunityPlayer.phase, captures: f.opportunityPlayer.captures };
}));

await test('committed player attack keeps captured target and correction when victim moves', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f); let c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  const target = f.opportunityPlayer.target.slice();
  const beforeFastInput = [f.opportunityPlayer.handY, f.opportunityPlayer.pitch];
  f.skill.vel.set(3, 0); f.skill.swinging = true;
  c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  assert.equal(f.opportunityPlayer.phase, 'committed');
  const correction = [f.opportunityPlayer.handY, f.opportunityPlayer.pitch];
  assert.deepEqual(correction, beforeFastInput, 'fast cut must commit immediately without adding preparation delay');
  assert.ok(f.opportunityPlayer.age < OPPORTUNITY.prepareWindow);
  pose(f, v, { x: 1.4, head: 1.4, chest: 1.1 });
  c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  assert.deepEqual(f.opportunityPlayer.target, target);
  assert.deepEqual([f.opportunityPlayer.handY, f.opportunityPlayer.pitch], correction);
  assert.equal(f.opportunityPlayer.captures, 1);
  return { target, correction, captures: 1 };
}));

await test('slow preparation window can reach the full authored height before becoming ready', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f);
  f.skill.aim.y = f.handOffset.y = .35; // Aligned raw/filtered elevated pad exposes the complete correction budget.
  let c;
  for (let i = 0; i < 12; i++) { c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim); }
  assert.equal(f.opportunityPlayer.phase, 'preparing', '0.2s slow preparation must not freeze at the old short window');
  assert.equal(f.opportunityPlayer.desiredY, -.24, 'fixture exposes the full height budget');
  for (let i = 12; i < Math.ceil(OPPORTUNITY.prepareWindow * 60) + 2; i++) {
    c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  }
  assert.equal(f.opportunityPlayer.phase, 'ready');
  assert.ok(Math.abs(f.opportunityPlayer.handY + .24) < 1e-12);
  assert.equal(f.opportunityPlayer.captures, 1); assert.equal(f.skill.tap, null);
  return { window: OPPORTUNITY.prepareWindow, height: f.opportunityPlayer.handY, phase: 'ready', automaticAttacks: 0 };
}));

await test('tiny reversal does not prematurely commit or reacquire the prepared target', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f); let c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  const target = f.opportunityPlayer.target.slice();
  playerInput(f, { id: 2, dx: -.001, reversing: true }); f.skill.swinging = false;
  c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  assert.equal(f.opportunityPlayer.phase, 'preparing'); assert.equal(f.opportunityPlayer.captures, 1);
  assert.deepEqual(f.opportunityPlayer.target, target); assert.ok(f.skill.vel.x < 0);
  return { rawReversalSpeed: f.skill.vel.length(), phase: 'preparing', captures: 1 };
}));

await test('front crossing reference is a finite reachable ray and improves target height without moving input', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f);
  const found = findOpportunity(f, captureOpportunityPose(v), 'cut'); assert.ok(found);
  const chest = V(f.bodies.chest.translation());
  const local = found.target.clone().sub(chest).applyQuaternion(f.yaw.clone().invert());
  const beforeInput = { pad: f.handOffset.toArray(), aim: f.skill.aim.toArray(), native: f.sword.translation() };
  const reference = opportunityCrossingReference(f, local, SWORDSMANSHIP); assert.ok(reference);
  const length = (local.x - reference.hand.x) / reference.aim.x;
  assert.ok(length > 0 && length <= f.weaponCfg.hiltLength + f.weaponCfg.bladeLength + .041);
  const crossing = reference.hand.clone().addScaledVector(reference.aim, length);
  assert.ok(Math.abs(crossing.y - reference.height) < 1e-12);
  assert.ok(Math.abs(crossing.z - local.z) <= .025);
  assert.ok(Math.abs(crossing.z - local.z - reference.sideError) < 1e-12);
  const c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  assert.ok(f.opportunityPlayer.crossing);
  assert.ok(Math.abs(f.opportunityPlayer.crossing.worldHeight - (reference.height + chest.y)) < 1e-12);
  const correctedHand = reference.hand.clone().add(new THREE.Vector3(0, f.opportunityPlayer.desiredY, 0));
  const azimuth = Math.atan2(reference.aim.z, reference.aim.x);
  const elevation = Math.atan2(reference.aim.y, Math.hypot(reference.aim.x, reference.aim.z)) + f.opportunityPlayer.desiredPitch;
  const correctedAim = new THREE.Vector3(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth));
  const correctedHeight = correctedHand.y + correctedAim.y * (local.x - correctedHand.x) / correctedAim.x;
  assert.ok(Math.abs(correctedHeight - local.y) < Math.abs(reference.height - local.y));
  assert.deepEqual({ pad: f.handOffset.toArray(), aim: f.skill.aim.toArray(), native: f.sword.translation() }, beforeInput);
  assert.equal(opportunityCrossingReference(f, new THREE.Vector3(5, -.3, 0), SWORDSMANSHIP), null);
  return { referenceHeight: reference.height, targetHeight: local.y, correctedHeight, sideError: reference.sideError, rayLength: length };
}));

await test('preparation changes only aim elevation and preserves both horizontal azimuth directions', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f);
  for (const side of [-1, 1]) {
    const hand = new THREE.Vector3(.45, .1, .15), aim = new THREE.Vector3(.8, .1, .5 * side).normalize();
    const azimuth = Math.atan2(aim.z, aim.x), elevation = Math.atan2(aim.y, Math.hypot(aim.x, aim.z));
    updateOpportunityPlayer(f, 1 / 60, hand, aim);
    assert.ok(Math.abs(Math.atan2(aim.z, aim.x) - azimuth) < 1e-12);
    assert.ok(Math.abs(Math.atan2(aim.y, Math.hypot(aim.x, aim.z)) - elevation) > 1e-6);
    assert.ok(Math.abs(aim.length() - 1) < 1e-12);
  }
  return { leftAndRightAzimuthPreserved: true, elevationChanged: true };
}));

await test('changing preparation height recalculates the crossing while keeping the captured world target', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f); let c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  const target = f.opportunityPlayer.target.slice(), oldPadY = f.opportunityPlayer.crossing.padY;
  f.skill.aim.y -= .08; f.handOffset.y = f.skill.aim.y; f.skill.vel.set(.2, -.1);
  c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  assert.equal(f.opportunityPlayer.phase, 'preparing'); assert.equal(f.opportunityPlayer.captures, 1);
  assert.deepEqual(f.opportunityPlayer.target, target);
  assert.equal(f.opportunityPlayer.crossing.padY, f.skill.aim.y); assert.notEqual(f.opportunityPlayer.crossing.padY, oldPadY);
  assert.ok(f.skill.vel.y < 0);
  return { oldPadY, newPadY: f.opportunityPlayer.crossing.padY, fixedTarget: target, captures: 1 };
}));

await test('a ready attack yields its prepared plane to a later deliberate vertical input', () => fixture(({ f, v }) => {
  pose(f, v); preparePlayer(f); let c;
  for (let i = 0; i < Math.ceil(OPPORTUNITY.prepareWindow * 60) + 2; i++) {
    c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  }
  assert.equal(f.opportunityPlayer.phase, 'ready');
  f.handOffset.y += .2; f.skill.vel.set(.1, .3); f.skill.swinging = false;
  const y = f.handOffset.y;
  c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
  assert.ok(['releasing', 'idle'].includes(f.opportunityPlayer.phase));
  assert.equal(f.handOffset.y, y); assert.equal(f.opportunityPlayer.captures, 1);
  return { newInputY: y, phase: f.opportunityPlayer.phase, captures: 1 };
}));

for (const reason of ['new-foe', 'disarm', 'attacker-down', 'manual-back']) {
  await test(`committed player ${reason}: ownership loss releases even while input stays moving`, () => fixture(({ f, v }) => {
    pose(f, v); preparePlayer(f); let c;
    for (let i = 0; i < 8; i++) { c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim); }
    f.skill.vel.set(3, 0); f.skill.swinging = true; c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
    assert.equal(f.opportunityPlayer.phase, 'committed');
    const beforeMagnitude = Math.abs(f.opportunityPlayer.handY) + Math.abs(f.opportunityPlayer.pitch); assert.ok(beforeMagnitude > 0);
    let other = null;
    try {
      if (reason === 'new-foe') { other = newRound({ seed: 319, weapon: 'longsword', walls: false }); fixtures++; f.foe = other.enemy; }
      if (reason === 'disarm') f.armed = false;
      if (reason === 'attacker-down') f.state = 'down';
      if (reason === 'manual-back') f.move.y = -.6;
      c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
      assert.equal(f.opportunityPlayer.phase, 'releasing');
      const afterMagnitude = Math.abs(f.opportunityPlayer.handY) + Math.abs(f.opportunityPlayer.pitch);
      assert.ok(afterMagnitude < beforeMagnitude && afterMagnitude > 0);
      for (let i = 0; i < 30; i++) { c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim); }
      assert.equal(f.opportunityPlayer.phase, 'idle'); assert.equal(f.opportunityPlayer.target, null);
      assert.ok(Math.abs(f.opportunityPlayer.handY) < 1e-12); assert.ok(Math.abs(f.opportunityPlayer.pitch) < 1e-12);
      assert.equal(f.opportunityPlayer.captures, 1);
      return { reason, movingInputHeld: true, beforeMagnitude, firstReleaseMagnitude: afterMagnitude, finalPhase: 'idle' };
    } finally { other?.eventQueue.free(); other?.world.free(); }
  }));
}

await test('release and a newly created round do not inherit prior target capture', () => {
  const prior = fixture(({ f, v }) => {
    pose(f, v); preparePlayer(f); let c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
    f.skill.vel.set(3, 0); f.skill.swinging = true; c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
    f.swordsmanshipState.moving = false; f.skill.swinging = false; f.handHeld = false; f.skill.vel.set(0, 0);
    for (let i = 0; i < 30; i++) { c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim); }
    assert.equal(f.opportunityPlayer.phase, 'idle'); assert.equal(f.opportunityPlayer.target, null);
    return f.opportunityPlayer;
  });
  return fixture(({ f, v, ai }) => {
    pose(f, v); assert.ok(applySwordsmanship(f)); const c = command(); updateOpportunityPlayer(f, 1 / 60, c.hand, c.aim);
    assert.equal(f.opportunityPlayer.captures, 0); assert.notEqual(f.opportunityPlayer, prior);
    assert.equal(ai.opportunityState.attempts, 0); assert.equal(ai.opportunityState.active, false);
    return { playerCaptures: 0, aiAttempts: 0, separateObjects: true };
  });
});

await test('explicit player thrust captures neck/face once and does not follow victim movement', () => fixture(({ f, v }) => {
  pose(f, v); assert.ok(applySwordsmanship(f)); assert.ok(f.skill.thrust({ step: false }));
  assert.equal(f.skill.tap.down, false); assert.ok(f.skill.tap.opportunity);
  const original = f.skill.tap.opportunity.target.slice();
  f.skill.updateThrust(.02); pose(f, v, { x: 1.3, head: 1.38, chest: 1.07 }); f.skill.updateThrust(.02);
  assert.deepEqual(f.skill.tap.opportunity.target, original); assert.ok(!f.skill.tap.abort);
  v.state = 'dead'; f.skill.updateThrust(.02); assert.ok(f.skill.tap.abort);
  return { zone: f.skill.tap.opportunity.zone, original, deadTargetAborted: true };
}, { weapon: 'rapier' }));

await test('AI explicitly supplying no opportunity cannot fall back to live player-target capture', () => fixture(({ f, v }) => {
  pose(f, v); assert.ok(f.skill.thrust({ step: false, opportunityTarget: null }));
  assert.equal(f.skill.tap.down, false); assert.equal(f.skill.tap.opportunity, undefined);
  return { ordinaryThrust: true };
}));

function realAI(f, v) { return new AI(f, v, 'normal', { pers: { precision: 1 } }); }
function observeNow(ai, dt = 1 / 120) {
  ai.sense.record(dt); const seen = ai.sense.seen(0); updateOpportunityEpisode(ai, seen, dt); return seen;
}
const cutTech = ai => ai.school.tech.find(neckCrossingTechnique);

await test('real AI update retains ordinary opportunity method and uses delayed crisis observation', () => fixture(({ f, v }) => {
  const ai = realAI(f, v);
  assert.equal(typeof ai.opportunity, 'function', 'new budget storage must not shadow preexisting AI method');
  pose(f, v, { state: 'stand', x: 3, chest: 1.33, pelvis: .95, head: 1.61 });
  ai.mode = 'withdraw'; ai.timer = 20;
  for (let i = 0; i < 100; i++) ai.update(1 / 120);
  assert.equal(ai.opportunityState.active, false);
  assert.ok(ai.opportunity(ai.sense.seen(0), 3));
  const delay = ai.level.reaction + .04 * ai.anger;
  pose(f, v); ai.update(1 / 120);
  assert.equal(ai.opportunityState.active, false, 'first crisis record is not instantaneous perception');
  const steps = Math.ceil(delay * 120) + 3;
  for (let i = 0; i < steps; i++) ai.update(1 / 120);
  assert.equal(ai.opportunitySeen.opportunity.state, 'getup'); assert.equal(ai.opportunityState.active, true);
  return { delay, followupObservationUpdates: steps, active: true, nativeSteps: 0 };
}));

await test('AI baseline flag leaves new episode inactive through actual watch/update', () => fixture(({ f, v }) => {
  f.opportunityModel = 'off'; const ai = realAI(f, v); pose(f, v);
  ai.guardTimer = 1; ai.seizeT = 1; ai.decideTimer = -1;
  ai.update(1 / 120);
  assert.equal(ai.opportunitySeen, null); assert.equal(ai.opportunityState.active, false);
  assert.equal(typeof ai.opportunity, 'function');
  return { newEpisodeInactive: true, mode: ai.mode };
}));

await test('AI consumes only two committed opportunities, chatter cannot refill, ordinary attack remains', () => fixture(({ f, v }) => {
  pose(f, v); const ai = realAI(f, v); observeNow(ai); const tech = cutTech(ai); assert.ok(tech);
  assert.ok(opportunityCandidate(ai, tech));
  assert.ok(ai.startAttack(tech, 'recover', { noFeint: true }));
  assert.ok(ai.opportunityAttack); assert.equal(ai.opportunityState.attempts, 0);
  ai.abortAttack(); assert.equal(ai.opportunityState.attempts, 0, 'chamber cancellation consumes no strike');
  for (let count = 1; count <= 2; count++) {
    assert.ok(ai.startAttack(tech, 'recover', { noFeint: true })); assert.ok(ai.opportunityAttack);
    ai.startStrike(); assert.equal(ai.phase, 'strike'); assert.equal(ai.opportunityState.attempts, count);
    ai.startStrike(); assert.equal(ai.opportunityState.attempts, count, 'same commitment is idempotent');
    ai.startWithdraw(.1);
  }
  const episode = ai.opportunityState.episode;
  for (const state of ['down', 'kneel', 'getup', 'stand', 'kneel']) {
    pose(f, v, { state, x: state === 'down' ? 4 : 1 });
    v.balance = state === 'stand' ? 60 : 100; observeNow(ai, .2);
    assert.equal(ai.opportunityState.attempts, 2); assert.equal(ai.opportunityState.episode, episode);
  }
  pose(f, v); observeNow(ai); assert.equal(opportunityCandidate(ai, tech), null);
  assert.ok(ai.startAttack(tech, 'recover', { noFeint: true })); assert.equal(ai.opportunityAttack, null);
  ai.startStrike(); assert.equal(ai.phase, 'strike'); assert.ok(ai.path.length > 0); assert.equal(ai.opportunityState.attempts, 2);
  ai.startWithdraw(.1);
  pose(f, v, { state: 'stand', chest: 1.33, pelvis: .95, head: 1.61 }); v.balance = 100; v.offBalance = 0;
  observeNow(ai, .2); assert.equal(ai.opportunityState.attempts, 2, 'short stand cannot refill');
  observeNow(ai, .26); assert.equal(ai.opportunityState.attempts, 0); assert.equal(ai.opportunityState.active, false);
  pose(f, v); observeNow(ai); assert.equal(ai.opportunityState.episode, episode + 1);
  assert.ok(opportunityCandidate(ai, tech));
  return { specialCommitted: 2, ordinaryAfterLimit: true, abortedPreparationCost: 0, nextEpisode: ai.opportunityState.episode };
}));

await test('committed AI path and target stay locked after new observation', () => fixture(({ f, v }) => {
  pose(f, v); const ai = realAI(f, v); observeNow(ai); const tech = cutTech(ai);
  assert.ok(ai.startAttack(tech, 'recover', { noFeint: true })); ai.startStrike();
  assert.ok(ai.opportunityAttack?.started);
  const target = ai.opportunityAttack.target.toArray(), path = ai.path.map(p => p.slice());
  const oldLateral = ai.opportunityAttack.lateral;
  pose(f, v, { x: 1.3, head: 1.4, chest: 1.08 }); observeNow(ai); ai.foeLat = 5;
  ai.attack(1 / 120, ai.opportunitySeen, 1.3, null);
  assert.deepEqual(ai.opportunityAttack.target.toArray(), target); assert.deepEqual(ai.path, path);
  assert.equal(ai.opportunityAttack.lateral, oldLateral);
  return { target, padY: ai.opportunityAttack.padY, preservedPath: true };
}));

await test('AI neck focus selects a crossing cut; steep downward cut stays ordinary and within hand disk', () => fixture(({ f, v }) => {
  pose(f, v); const ai = realAI(f, v); const seen = observeNow(ai);
  const selected = ai.pickTech(seen, 'finish'); assert.ok(neckCrossingTechnique(selected));
  assert.ok(ai.startAttack(selected, 'finish', { noFeint: true })); assert.ok(ai.opportunityAttack);
  const points = [selected.from, ...selected.path].map(p => opportunityPad(ai, p));
  for (const p of points) assert.ok(Math.hypot(...p) <= .6200000001);
  const saturated = opportunityPad(ai, [.59, -.59]); assert.ok(Math.hypot(...saturated) <= .6200000001);
  ai.abortAttack();
  const steep = ai.school.tech.find(t => t.kind === 'cut' && !neckCrossingTechnique(t)); assert.ok(steep);
  assert.ok(ai.startAttack(steep, 'recover', { noFeint: true })); assert.equal(ai.opportunityAttack, null);
  ai.startStrike(); assert.equal(ai.phase, 'strike'); assert.equal(ai.opportunityState.attempts, 0);
  return { selected: selected.name, ordinary: steep.name, preparedPointRadii: points.map(p => Math.hypot(...p)), specialAttempts: 0 };
}));

await test('AI explicit thrust keeps original preparation height and passes fixed target to real Skill', () => fixture(({ f, v }) => {
  pose(f, v); const ai = realAI(f, v); observeNow(ai);
  const tech = ai.school.tech.find(t => t.kind === 'thrust'); assert.ok(tech);
  assert.ok(ai.startAttack(tech, 'recover', { noFeint: true })); assert.ok(ai.opportunityAttack);
  assert.equal(ai.opportunityAttack.kind, 'thrust'); assert.equal(ai.opportunityAttack.padY, 0);
  const target = ai.opportunityAttack.target.toArray();
  ai.startStrike(); assert.equal(ai.opportunityState.attempts, 1);
  assert.ok(f.skill.tap?.opportunity); assert.deepEqual(f.skill.tap.opportunity.target, target);
  assert.equal(f.skill.tap.down, false);
  return { technique: tech.name, preparationOffset: 0, fixedTarget: target, committed: 1 };
}, { weapon: 'rapier' }));

await test('AI command overlay prepares a lower crossing, locks on commit, and releases without native or input mutation', () => fixture(({ G, f, v }) => {
  pose(f, v); const ai = realAI(f, v); observeNow(ai); const tech = cutTech(ai);
  assert.ok(ai.startAttack(tech, 'recover', { noFeint: true })); assert.ok(ai.opportunityAttack?.crossing);
  const c = ai.opportunityAttack.crossing, target = ai.opportunityAttack.target.toArray();
  const nativeHash = () => crypto.createHash('sha256').update(G.world.takeSnapshot()).digest('hex');
  const nativeBefore = nativeHash();
  const inputBefore = { hand: f.handOffset.toArray(), aim: f.skill.aim.toArray(), level: f.skill.level,
    strength: f.strength, cfg: JSON.stringify(f.weaponCfg) };
  advanceOpportunityAICommand(ai, 1 / 60);
  assert.ok(Math.abs(ai.opportunityCommand.handY) <= .0125000001);
  assert.ok(Math.abs(ai.opportunityCommand.pitch) <= 1.6 / 60 + 1e-12);
  for (let i = 1; i < 12; i++) advanceOpportunityAICommand(ai, 1 / 60);
  const hand = new THREE.Vector3(...c.hand), aim = new THREE.Vector3(...c.aim);
  const azimuth = Math.atan2(aim.z, aim.x);
  applyOpportunityAIHand(f, hand); applyOpportunityAIAim(f, aim);
  assert.ok(Math.abs(Math.atan2(aim.z, aim.x) - azimuth) < 1e-12);
  const forward = c.bladeDistance * c.aim[0];
  const afterHeight = c.worldHeight - c.height + hand.y + aim.y * forward / aim.x;
  assert.ok(Math.abs(afterHeight - target[1]) < Math.abs(c.worldHeight - target[1]));
  assert.deepEqual({ hand: f.handOffset.toArray(), aim: f.skill.aim.toArray(), level: f.skill.level,
    strength: f.strength, cfg: JSON.stringify(f.weaponCfg) }, inputBefore);
  assert.equal(nativeHash(), nativeBefore, 'command authoring must not touch native bodies/forces');
  ai.startStrike(); assert.ok(ai.opportunityAttack.started);
  const locked = { ...ai.opportunityCommand };
  ai.opportunityAttack.desiredY = .24; ai.opportunityAttack.desiredPitch = .28;
  advanceOpportunityAICommand(ai, 1 / 60); assert.deepEqual(ai.opportunityCommand, locked);
  assert.deepEqual(ai.opportunityAttack.target.toArray(), target);
  for (const owner of ['tap', 'finish']) {
    if (owner === 'tap') f.skill.tap = { down: false }; else f.finish.amt = .4;
    const h = new THREE.Vector3(...c.hand), a = new THREE.Vector3(...c.aim);
    applyOpportunityAIHand(f, h); applyOpportunityAIAim(f, a);
    assert.deepEqual(h.toArray(), c.hand); assert.deepEqual(a.toArray(), c.aim);
    f.skill.tap = null; f.finish.amt = 0;
  }
  ai.abortAttack();
  const beforeRelease = Math.abs(locked.handY) + Math.abs(locked.pitch); assert.ok(beforeRelease > 0);
  advanceOpportunityAICommand(ai, 1 / 60);
  assert.ok(Math.abs(ai.opportunityCommand.handY) + Math.abs(ai.opportunityCommand.pitch) < beforeRelease);
  for (let i = 0; i < 30; i++) advanceOpportunityAICommand(ai, 1 / 60);
  assert.ok(Math.abs(ai.opportunityCommand.handY) < 1e-12 && Math.abs(ai.opportunityCommand.pitch) < 1e-12);
  return { referenceHeight: c.worldHeight, commandedHeight: afterHeight, targetHeight: target[1], locked,
    nativeUnchanged: true, rawInputAndBudgetUnchanged: true, released: true };
}));

await test('AI crossing estimate rejects targets beyond its real blade instead of inventing a plane', () => fixture(({ f, v }) => {
  pose(f, v); const ai = realAI(f, v); observeNow(ai); const tech = cutTech(ai);
  const chest = V(f.bodies.chest.translation());
  const far = chest.clone().add(new THREE.Vector3(4, -.3, 0));
  assert.equal(opportunityAICrossing(ai, tech, far), null);
  const behind = chest.clone().add(new THREE.Vector3(-.4, -.3, 0));
  assert.equal(opportunityAICrossing(ai, tech, behind), null);
  return { farRefused: true, backwardRefused: true };
}));

await test('AI refuses an on-line defensive blade even when defender is kneeling', () => fixture(({ f, v }) => {
  pose(f, v, { state: 'kneel' }); const ai = realAI(f, v);
  const c = V(f.bodies.chest.translation()), targetPoint = new THREE.Vector3(c.x + .5, c.y, c.z);
  // Actual observed line endpoints: blade midpoint is ahead; tip points at us.
  v.hitPointPrev = targetPoint; v.tipPrev = targetPoint.clone().add(new THREE.Vector3(-.4, 0, 0));
  const seen = observeNow(ai); assert.equal(ai.foeClass(seen).online, true);
  assert.equal(opportunityCandidate(ai, cutTech(ai)), null); assert.equal(ai.opportunityState.attempts, 0);
  return { online: true, rejected: true };
}));

for (const owner of ['tap', 'finish-fade']) await test(`existing ${owner} owns command and prevents fresh AI opportunity`, () => fixture(({ f, v }) => {
  pose(f, v); const ai = realAI(f, v); observeNow(ai);
  if (owner === 'tap') f.skill.tap = { down: true, go: false };
  else f.finish.amt = .4;
  assert.equal(opportunityCandidate(ai, cutTech(ai)), null); assert.equal(ai.opportunityState.attempts, 0);
  return { owner, consumed: 0 };
}));

const after = hashes();
const report = { kind: 'prepared real Fighter / Skill / AI opportunity connections', timestamp: new Date().toISOString(),
  baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: `node tools/sim/experiments/opportunity_20261008.test.mjs ${out}${selection ? ` '${selection.source}'` : ''}`,
  selection: selection?.source ?? null, fixtures, nativeSteps: 0,
  limitations: ['Prepared transforms and explicit states; no natural collapse or native contact measured',
    'No prediction of actual lethality, human realism, or phone play', 'No general-release claim'],
  sourceStable: JSON.stringify(before) === JSON.stringify(after), sourcesBefore: before, sourcesAfter: after,
  passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
report.pass = results.length > 0 && report.sourceStable && report.failed === 0;
fs.mkdirSync(path.dirname(out), { recursive: true });
const toolArchive = `${out}.tool.mjs`;
assert.ok(!fs.existsSync(toolArchive), 'Refusing to overwrite an executed tool archive');
fs.writeFileSync(toolArchive, executedTool); report.executedTool = toolArchive;
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, pass: report.pass, sourceStable: report.sourceStable, passed: report.passed, failed: report.failed, fixtures, nativeSteps: 0 }));
if (!report.pass) process.exitCode = 1;
