import assert from 'node:assert/strict';
import { MOBILE_VERTICAL_GAIN, configureMobileIntent, mapMobileHandDelta } from '../../src/mobile_intent.js';

let checks = 0;
function check(name, fn) { fn(); checks++; }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
const configure = query => configureMobileIntent(new URLSearchParams(query));
const delta = (dx, dy, extra = {}) => mapMobileHandDelta({ dx, dy, height: 390, sensitivity: 2.6, pointerType: 'touch', ...extra });

check('candidate default', () => assert.deepEqual(configure(''), { verticalGain: 1.35, source: 'default' }));
for (const value of ['1', '1.35', '1.8', '1.35e0', ' 1.5 ']) {
  check(`URL accepts ${value}`, () => assert.deepEqual(configure(new URLSearchParams({ mobileVerticalGain: value })), { verticalGain: Number(value), source: 'url' }));
}
for (const value of ['', ' ', '0', '.99', '-1', '1.800001', '8', 'NaN', 'Infinity', '1e999', '0x1', '1.35px', '+1.35']) {
  check(`URL rejects ${JSON.stringify(value)}`, () => assert.deepEqual(configure(new URLSearchParams({ mobileVerticalGain: value })), { verticalGain: 1.35, source: 'default' }));
}
check('opt-in integration fallback', () => assert.deepEqual(configureMobileIntent(new URLSearchParams(), 1), { verticalGain: 1, source: 'default' }));
check('invalid integration fallback', () => assert.equal(configureMobileIntent(new URLSearchParams(), Infinity).verticalGain, 1.35));
check('bounds are immutable', () => assert.ok(Object.isFrozen(MOBILE_VERTICAL_GAIN)));

for (const height of [250, 320, 390, 420, 844]) {
  check(`original mapping exact at gain 1 / height ${height}`, () => {
    for (const [dx, dy] of [[0, 0], [60, -40], [-19, 7], [.01, -.03]]) {
      const d = delta(dx, dy, { height, verticalGain: 1 });
      assert.equal(d.x, dx * (2.6 / Math.max(320, height)));
      assert.equal(d.y, -dy * (2.6 / Math.max(320, height)));
    }
  });
  check(`touch Y-only compensation / height ${height}`, () => {
    const before = delta(60, -40, { height, verticalGain: 1 });
    const after = delta(60, -40, { height, verticalGain: 1.35 });
    assert.equal(after.x, before.x);
    close(after.y, before.y * 1.35);
  });
}
for (const pointerType of ['mouse', 'pen', '', undefined]) {
  check(`${pointerType} retains legacy mapping`, () => assert.deepEqual(delta(20, -30, { pointerType }), delta(20, -30, { pointerType, verticalGain: 1 })));
}
for (const verticalGain of [0, -1, 1.81, Infinity, NaN, '1.35']) {
  check(`mapping rejects unchecked gain ${verticalGain}`, () => assert.deepEqual(delta(5, -7, { verticalGain }), delta(5, -7, { verticalGain: 1 })));
}
check('both vertical directions preserve sign and symmetry', () => {
  for (const dy of [1, 12, 40, 120]) close(delta(0, -dy).y, -delta(0, dy).y);
  assert.ok(delta(0, -40).y > 0 && delta(0, 40).y < 0);
});
check('small vertical thumb travel compensates distance and speed with same gain', () => {
  const horizontal = delta(54, 0);
  const vertical = delta(0, -40);
  close(horizontal.x, vertical.y);
  close(horizontal.x / .25, vertical.y / .25);
});
for (const count of [1, 4, 12, 120]) {
  check(`event partition invariant / ${count} move events`, () => {
    const total = delta(72, -40), sum = { x: 0, y: 0 };
    for (let n = 0; n < count; n++) {
      const part = delta(72 / count, -40 / count);
      sum.x += part.x; sum.y += part.y;
    }
    close(sum.x, total.x); close(sum.y, total.y);
  });
}
check('hold has no residual input', () => {
  delta(0, -40);
  for (let n = 0; n < 180; n++) assert.equal(Math.hypot(...Object.values(delta(0, 0))), 0);
});
check('reverse gesture returns to original intent', () => {
  const down = delta(19, 40), up = delta(-19, -40);
  close(down.x + up.x, 0); close(down.y + up.y, 0);
});
check('mapping does not mutate raw event data', () => {
  const input = { dx: 0, dy: 11, height: 390, sensitivity: 2.6, pointerType: 'touch', verticalGain: 1.35 };
  const original = { ...input };
  mapMobileHandDelta(input);
  assert.deepEqual(input, original);
  assert.equal(Math.hypot(input.dx, input.dy), 11); // below original 12px tap threshold
});
console.log(`Mobile intent: ${checks} checks PASS (pure mapping; runtime integration not claimed)`);
