/** Deterministic opportunity-path contracts. No native world or physics steps. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { opportunityPathGoal as goal, OPPORTUNITY_PATH } from '../../src/opportunity_path.js';
import { OPPORTUNITY } from '../../src/opportunity_target.js';

const results = [];
function check(name, run) {
  try { run(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); }
}
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, `${message}: ${a} != ${b}`);
const vec = values => new THREE.Vector3(...values);
const direction = pitch => [Math.cos(pitch), Math.sin(pitch), 0];
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function fixture({ yawAngle = 0, target = [0.8, -0.1, 0.04], actualHand = [0.25, -0.1, 0.04],
  actualAxis = [1, 0, 0], commandHand = [0.25, -0.1, 0.04], commandAxis = [1, 0, 0],
  reference = { hand: [0.25, -0.1, 0.04], aim: [1, 0, 0] } } = {}) {
  const yaw = new THREE.Quaternion().setFromAxisAngle(vec([0, 1, 0]), yawAngle);
  const chest = vec([2, 1.2, -3]);
  const point = local => vec(local).applyQuaternion(yaw).add(chest);
  const origin = point(actualHand);
  const axis = vec(actualAxis).normalize().applyQuaternion(yaw);
  const rotation = new THREE.Quaternion().setFromUnitVectors(vec([0, 1, 0]), axis);
  const f = { sword: { translation: () => origin, rotation: () => rotation },
    bodies: { chest: { translation: () => chest } }, yaw,
    weaponCfg: { hiltLength: 0.15, bladeLength: 0.9 },
    handTarget: point(commandHand), aimDirW: vec(commandAxis).applyQuaternion(yaw) };
  return freeze({ f, target: point(target), reference, nativeValues: { origin, rotation, chest } });
}
const evaluate = t => goal(t.f, t.target, t.reference);
function bounded(result) {
  assert.ok(result);
  for (const [value, bound] of [[result.handY, OPPORTUNITY.handHeightBudget],
    [result.pitch, OPPORTUNITY.pitchBudget], [result.observation.heightTrim, OPPORTUNITY_PATH.heightTrim],
    [result.observation.pitchTrim, OPPORTUNITY_PATH.pitchTrim]]) {
    assert.ok(Number.isFinite(value) && Math.abs(value) <= bound + 1e-12, `${value} exceeds ${bound}`);
  }
}

check('forward active blade interval accepts a command and observes the real segment', () => {
  const r = evaluate(fixture());
  bounded(r);
  assert.equal(r.observation.actualWithinAxialInterval, true);
  close(r.observation.commandAlong, 0.55, 'command blade distance');
  close(r.observation.actualAlong, 0.55, 'actual blade distance');
  close(r.handY, 0, 'unbiased hand'); close(r.pitch, 0, 'unbiased pitch');
});

check('hilt, rearward and beyond-tip targets are rejected', () => {
  for (const x of [0.25, 0.30, -0.4, 1.31, 2]) assert.equal(evaluate(fixture({ target: [x, -0.1, 0.04] })), null);
});

check('null and nonfinite inputs are rejected without throwing', () => {
  const t = fixture();
  for (const bad of [null, { x: NaN, y: 0, z: 0 }, { x: 1, y: Infinity, z: 0 }])
    assert.equal(goal(t.f, bad, t.reference), null);
  assert.equal(goal(null, t.target, t.reference), null);
  assert.equal(goal(t.f, t.target, null), null);
  for (const reference of [{ hand: [NaN, 0, 0], aim: [1, 0, 0] },
    { hand: [0, 0, 0], aim: [Infinity, 0, 0] }, { hand: [0, 0, 0], aim: [0, 0, 0] }])
    assert.equal(goal(t.f, t.target, reference), null);
  for (const f of [{ ...t.f, sword: { ...t.f.sword, translation: () => ({ x: NaN, y: 0, z: 0 }) } },
    { ...t.f, sword: { ...t.f.sword, rotation: () => ({ x: 0, y: NaN, z: 0, w: 1 }) } },
    { ...t.f, weaponCfg: { hiltLength: 0.15, bladeLength: Infinity } }])
    assert.equal(goal(f, t.target, t.reference), null);
});

check('actual hand above and below its command gets opposite height compensation', () => {
  for (const sign of [-1, 1]) {
    const r = evaluate(fixture({ actualHand: [0.25, -0.1 + sign * 0.08, 0.04] }));
    bounded(r); close(r.observation.trackingHeight, sign * 0.08, 'height residual');
    close(r.observation.heightTrim, -sign * 0.04, 'height trim');
    assert.ok(r.handY * sign < 0);
  }
});

check('actual blade pitched above and below its command gets opposite pitch compensation', () => {
  for (const sign of [-1, 1]) {
    const r = evaluate(fixture({ actualAxis: direction(sign * 0.1) }));
    bounded(r); close(r.observation.trackingPitch, sign * 0.1, 'pitch residual');
    close(r.observation.pitchTrim, -sign * 0.05, 'pitch trim');
    assert.ok(r.pitch * sign < 0);
  }
});

check('tracking residual uses the previous submitted command including its overlay', () => {
  const r = evaluate(fixture({ actualHand: [0.25, 0.06, 0.04], commandHand: [0.25, 0.02, 0.04],
    actualAxis: direction(0.2), commandAxis: direction(0.1) }));
  close(r.observation.trackingHeight, 0.04, 'submitted hand residual');
  close(r.observation.heightTrim, -0.02, 'submitted hand trim');
  close(r.observation.trackingPitch, 0.1, 'submitted pitch residual');
  close(r.observation.pitchTrim, -0.05, 'submitted pitch trim');
});

check('all offsets stay in the existing .24/.28 budgets and .06/.07 trim bounds', () => {
  close(OPPORTUNITY.handHeightBudget, 0.24, 'height budget');
  close(OPPORTUNITY.pitchBudget, 0.28, 'pitch budget');
  close(OPPORTUNITY_PATH.heightTrim, 0.06, 'height trim budget');
  close(OPPORTUNITY_PATH.pitchTrim, 0.07, 'pitch trim budget');
  for (const targetY of [-10, -0.1, 10]) for (const height of [-10, 10]) for (const pitch of [-1, 1]) {
    const r = evaluate(fixture({ target: [0.8, targetY, 0.04], actualHand: [0.25, height, 0.04], actualAxis: direction(pitch) }));
    bounded(r);
    close(Math.abs(r.observation.heightTrim), 0.06, 'height clamp reached');
    close(Math.abs(r.observation.pitchTrim), 0.07, 'pitch clamp reached');
  }
});

check('repeated calls do not accumulate previous compensation', () => {
  const t = fixture({ actualHand: [0.25, 0.06, 0.04], actualAxis: direction(0.2) });
  const expected = evaluate(t);
  for (let i = 0; i < 32; i++) assert.deepEqual(evaluate(t), expected);
});

check('world yaw rotation preserves the local goal and observations', () => {
  const options = { actualHand: [0.25, -0.02, 0.04], actualAxis: direction(0.12), commandAxis: direction(-0.03) };
  const expected = evaluate(fixture(options));
  for (const yawAngle of [0.7, -1.8, Math.PI]) {
    const r = evaluate(fixture({ ...options, yawAngle }));
    for (const key of ['handY', 'pitch']) close(r[key], expected[key], key);
    for (const key of ['commandAlong', 'actualAlong', 'actualHeight', 'actualSideError', 'trackingHeight', 'trackingPitch', 'heightTrim', 'pitchTrim'])
      close(r.observation[key], expected.observation[key], key);
    assert.equal(r.observation.actualWithinAxialInterval, expected.observation.actualWithinAxialInterval);
    for (const key of ['actualOrigin', 'actualAxis']) r.observation[key].forEach((v, i) => close(v, expected.observation[key][i], key));
  }
});

check('backward actual blade suppresses pitch compensation even if its old command points backward', () => {
  const r = evaluate(fixture({ actualAxis: [-Math.cos(0.2), Math.sin(0.2), 0], commandAxis: [-1, 0, 0] }));
  assert.equal(r.observation.actualWithinAxialInterval, false);
  assert.equal(r.observation.pitchTrim, 0);
});

check('vertical actual blade and mismatched command headings suppress pitch compensation', () => {
  for (const options of [{ actualAxis: [0, 1, 0] }, { actualAxis: direction(0.2), commandAxis: [0, 0, 1] }]) {
    const r = evaluate(fixture(options));
    assert.equal(r.observation.pitchTrim, 0);
  }
});

check('target, reference, fighter inputs and native fixture transforms stay unchanged', () => {
  const t = fixture({ yawAngle: 0.6, actualHand: [0.25, 0.01, 0.04], actualAxis: direction(0.16) });
  const before = JSON.stringify(t);
  const r = evaluate(t);
  r.observation.actualOrigin[0] = 1000;
  r.observation.actualAxis[1] = 1000;
  r.observation.bladeInterval[0] = 1000;
  assert.equal(JSON.stringify(t), before);
  assert.deepEqual(evaluate(t), evaluate(t));
});

console.log(JSON.stringify({ kind: 'pure helper contracts; no native physics', passed: results.filter(r => r.pass).length,
  failed: results.filter(r => !r.pass).length, results }, null, 2));
if (results.some(r => !r.pass)) process.exitCode = 1;
