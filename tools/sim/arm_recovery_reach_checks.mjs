/** Pure recovery-goal handover checks. No native world or physical execution. */
import assert from 'node:assert/strict';
import { constrainRecoveryArmReach as constrain } from '../../src/arm_recovery_reach.js';

const tests = [];
function check(name, run) {
  run();
  tests.push(name);
}
const point = x => ({ x, y: 0.31, z: -0.27 });
const apply = (fighter, x, side = 'S') => {
  const target = point(x);
  const changed = constrain(fighter, target, side);
  assert.equal(target.y, 0.31);
  assert.equal(target.z, -0.27);
  return { target, changed };
};

check('ordinary standing goals, including a rearward goal, stay exactly unchanged', () => {
  const f = { state: 'stand' };
  for (const x of [-0.6, -0, 0.04, 0.16, 0.6]) {
    const r = apply(f, x);
    assert.ok(Object.is(r.target.x, x));
    assert.equal(r.changed, false);
  }
});

for (const state of ['down', 'getup', 'kneel']) {
  check(`${state} keeps the goal forward and changes neither height nor side`, () => {
    const f = { state };
    const r = apply(f, -0.57);
    assert.equal(r.target.x, 0.16);
    assert.equal(r.changed, true);
    assert.equal(apply(f, 0.6).target.x, 0.6);
  });
}

check('getup to stand does not release a still-rearward requested goal', () => {
  const f = { state: 'getup' };
  const before = apply(f, -0.314);
  f.state = 'stand';
  const after = apply(f, -0.314);
  assert.deepEqual(after, before);
  // Elapsed time and stateTime cannot expire this geometry-based handover.
  f.stateTime = 1000;
  assert.equal(apply(f, -0.314).target.x, 0.16);
});

check('crossing the release margin is continuous and ends only that recovery episode', () => {
  const f = { state: 'getup' };
  apply(f, -0.3);
  f.state = 'stand';
  assert.equal(apply(f, 0.16 - 1e-9).target.x, 0.16);
  const atBoundary = apply(f, 0.16);
  assert.equal(atBoundary.target.x, 0.16);
  assert.equal(atBoundary.changed, false);
  assert.equal(apply(f, -0.3).target.x, -0.3);
});

check('a frontward goal during getup does not pre-release the stand handover', () => {
  const f = { state: 'getup' };
  apply(f, 0.2);
  f.state = 'stand';
  assert.equal(apply(f, -0.1).target.x, 0.16);
});

check('main and supporting arms complete their handovers independently', () => {
  const f = { state: 'getup' };
  apply(f, -0.3, 'S');
  apply(f, -0.3, 'O');
  f.state = 'stand';
  apply(f, 0.2, 'S');
  assert.equal(apply(f, -0.2, 'S').target.x, -0.2);
  assert.equal(apply(f, -0.2, 'O').target.x, 0.16);
  apply(f, 0.2, 'O');
  assert.equal(apply(f, -0.2, 'O').target.x, -0.2);
});

check('an arm with no recovery IK call does not inherit the other arm latch', () => {
  const f = { state: 'kneel' };
  apply(f, -0.3, 'S');
  f.state = 'stand';
  assert.equal(apply(f, -0.2, 'O').target.x, -0.2);
  assert.equal(apply(f, -0.2, 'S').target.x, 0.16);
});

check('fighters and newly created rounds never share a handover', () => {
  const first = { state: 'getup' }, second = { state: 'stand' };
  apply(first, -0.3);
  first.state = 'stand';
  assert.equal(apply(second, -0.3).target.x, -0.3);
  assert.equal(apply(first, -0.3).target.x, 0.16);
});

for (const state of ['dead', 'unsupported']) {
  check(`${state} is unchanged and clears both pending arms`, () => {
    const f = { state: 'getup' };
    apply(f, -0.3, 'S');
    apply(f, -0.3, 'O');
    f.state = state;
    assert.equal(apply(f, -0.2, 'S').target.x, -0.2);
    f.state = 'stand';
    assert.equal(apply(f, -0.2, 'S').target.x, -0.2);
    assert.equal(apply(f, -0.2, 'O').target.x, -0.2);
  });
}

check('a later new recovery episode re-arms a completed or cleared handover', () => {
  const f = { state: 'getup' };
  apply(f, -0.3);
  f.state = 'stand';
  apply(f, 0.2);
  f.state = 'down';
  apply(f, -0.2);
  f.state = 'stand';
  assert.equal(apply(f, -0.2).target.x, 0.16);
});

check('invalid side or non-finite goal does not release another valid pending goal', () => {
  const f = { state: 'getup' };
  apply(f, -0.3);
  f.state = 'stand';
  assert.equal(apply(f, 0.2, 'invalid').target.x, 0.2);
  assert.ok(Number.isNaN(apply(f, NaN).target.x));
  assert.equal(apply(f, -0.2).target.x, 0.16);
});

for (const weapon of [{ twoHand: true, gun: false }, { twoHand: false, gun: true }]) {
  check(`deferred controller stays unchanged: ${JSON.stringify(weapon)}`, () => {
    const f = { state: 'getup', weaponCfg: { twoHand: weapon.twoHand }, weapon: { gun: weapon.gun } };
    assert.equal(apply(f, -0.57).target.x, -0.57);
    f.state = 'stand';
    assert.equal(apply(f, -0.57).target.x, -0.57);
  });
}

console.log(JSON.stringify({
  suite: 'recovery arm reach handover',
  passed: tests.length,
  nativeSteps: 0,
  checks: tests,
}));
