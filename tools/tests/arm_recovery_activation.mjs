import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateMainArmRecovery,
  mainArmMuscle,
  readMainArmRecovery,
} from '../../src/arm_recovery_activation.js';

const dt = 1 / 120;
const makeFighter = (overrides = {}) => ({
  muscle: 0.6,
  vigor: 0.8,
  state: 'stand',
  weaponCfg: { twoHand: false },
  ...overrides,
});
const filter = (value, target, step = dt) =>
  value + (target - value) * Math.min(1, step * (target > value ? 4 : 12));
function tick(f, target, step = dt) {
  updateMainArmRecovery(f, step, target);
  f.muscle = filter(f.muscle, target, step);
}

test('default, unknown mode and two-handed weapons leave fighter state untouched', () => {
  for (const overrides of [
    {},
    { armRecoveryModel: 'unknown' },
    { armRecoveryModel: 'independent', weaponCfg: { twoHand: true } },
  ]) {
    const f = makeFighter(overrides);
    const before = structuredClone(f);
    updateMainArmRecovery(f, dt, 0.3);
    assert.deepEqual(f, before);
    assert.equal(mainArmMuscle(f), f.muscle);
    assert.deepEqual(readMainArmRecovery(f), { enabled: false, value: f.muscle, target: null });
  }
});

test('healthy standing activation exactly follows the ordinary filter', () => {
  const f = makeFighter({ armRecoveryModel: 'independent', vigor: 1 });
  assert.equal(mainArmMuscle(f), f.muscle); // No record until the first update.
  for (const target of [1, 1, 0.7, 0.3, 0.3, 1, 1]) {
    tick(f, target);
    assert.equal(mainArmMuscle(f), f.muscle);
    assert.equal(readMainArmRecovery(f).target, target);
  }
});

test('getup separates the arm target while retaining weakened vigor and fighter health', () => {
  const f = makeFighter({
    armRecoveryModel: 'independent', state: 'getup', muscle: 0.8, vigor: 0.4,
    strength: 0.9, limbs: { armS: 0.299184, armO: 1, legF: 0.7, legB: 1 },
  });
  const health = structuredClone({ strength: f.strength, limbs: f.limbs });
  let expected = f.muscle;
  for (let i = 0; i < 240; i++) {
    expected = filter(expected, f.vigor);
    tick(f, 0.35 * f.vigor);
    assert.equal(mainArmMuscle(f), expected);
  }
  // This is the original filter, not an instantaneous vigor clamp.
  assert.ok(Math.abs(mainArmMuscle(f) - 0.4) < 1e-10);
  assert.ok(mainArmMuscle(f) > f.muscle);
  assert.equal(readMainArmRecovery(f).target, 0.4);
  assert.deepEqual({ strength: f.strength, limbs: f.limbs }, health);
});

test('both filter rates and saturation retain the original formula', () => {
  for (const [value, target, step] of [[0.2, 0.8, dt], [0.8, 0.2, dt], [0.2, 0.8, 1], [0.8, 0.2, 1]]) {
    const f = makeFighter({ armRecoveryModel: 'independent', muscle: value });
    updateMainArmRecovery(f, step, target);
    assert.equal(mainArmMuscle(f), filter(value, target, step));
    assert.equal(f.muscle, value);
  }
});

test('down and dead use the ordinary target even after getup divergence', () => {
  const f = makeFighter({ armRecoveryModel: 'independent', state: 'getup' });
  tick(f, 0.28);
  for (const [state, target] of [['down', 0.08], ['dead', 0.02]]) {
    const expected = filter(mainArmMuscle(f), target);
    f.state = state;
    tick(f, target);
    assert.equal(mainArmMuscle(f), expected);
    assert.equal(readMainArmRecovery(f).target, target);
  }
});

test('turning off or changing to two hands clears history and re-enabling starts at current muscle', () => {
  for (const disable of ['mode', 'weapon']) {
    const f = makeFighter({ armRecoveryModel: 'independent', state: 'getup' });
    tick(f, 0.28);
    assert.notEqual(mainArmMuscle(f), f.muscle);
    if (disable === 'mode') f.armRecoveryModel = 'legacy';
    else f.weaponCfg.twoHand = true;
    assert.equal(mainArmMuscle(f), f.muscle);
    tick(f, 0.28);
    assert.equal(readMainArmRecovery(f).enabled, false);
    f.armRecoveryModel = 'independent';
    f.weaponCfg.twoHand = false;
    const expected = filter(f.muscle, f.vigor);
    tick(f, 0.28);
    assert.equal(mainArmMuscle(f), expected);
  }
});

test('diagnostics are copied and fighter instances have independent lifetimes', () => {
  const a = makeFighter({ armRecoveryModel: 'independent', state: 'getup' });
  const b = makeFighter({ armRecoveryModel: 'independent', muscle: 0.2 });
  updateMainArmRecovery(a, dt, 0.28);
  const expected = mainArmMuscle(a);
  const snapshot = readMainArmRecovery(a);
  snapshot.value = 999;
  snapshot.target = 999;
  assert.equal(mainArmMuscle(a), expected);
  assert.equal(readMainArmRecovery(a).target, a.vigor);
  assert.equal(mainArmMuscle(b), b.muscle);
  assert.equal(readMainArmRecovery(b).enabled, false);
  updateMainArmRecovery(b, dt, 0.8);
  assert.equal(mainArmMuscle(b), filter(0.2, 0.8));
  assert.equal(mainArmMuscle(a), expected);
});
