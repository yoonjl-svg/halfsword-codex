// Production AI input routing with synthetic body records. Physics is tested by
// the Etna stage gate; these cases isolate input permissions and heading math.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { GAIT } from '../../src/config.js';
import { AI } from '../../src/ai.js';
import { avoidEtnaLava } from '../../src/terrain_navigation.js';

function fixture({ x = 0, z = 4.2, vz = 0, heading = 0, move = [0, 0.8], ...props } = {}) {
  const position = Object.freeze({ x, y: 1, z }), velocity = Object.freeze({ x: 0, y: 0, z: vz });
  return { me: {
    alive: true, state: 'stand', heading, terrain: { id: 'etna', lavaEdgeZ: 5.25 },
    move: new Vector2(...move), stickX: move[0], stickY: move[1], gait: {},
    bodies: { pelvis: { translation: () => position, linvel: () => velocity } }, ...props,
  } };
}
const command = ai => [ai.me.move.x, ai.me.move.y, ai.me.stickX, ai.me.stickY];
function travel(f) {
  const side = f.move.x * GAIT.sideFactor;
  const forward = f.move.y * (f.move.y < 0 ? GAIT.backFactor : 1);
  return { x: side * Math.sin(f.heading) + forward * Math.cos(f.heading),
    z: side * Math.cos(f.heading) - forward * Math.sin(f.heading) };
}

for (const terrain of [undefined, null, { id: 'sluice' }, { id: 'etna' }]) {
  test(`flat/other/incomplete terrain preserves exact commands (${JSON.stringify(terrain)})`, () => {
    const ai = fixture({ terrain, move: [-0, -0.713] }), before = command(ai);
    assert.equal(avoidEtnaLava(ai), false);
    assert.deepEqual(command(ai), before);
  });
}
for (const props of [
  { alive: false }, { state: 'dead' }, { state: 'down' }, { state: 'kneel' }, { state: 'getup' },
  { feetHeld: true }, { revival: { phase: 'stand' } }, { missingSupportLeg: true },
  { emoMods: { move: 0 } }, { move: [0, 0] },
]) test(`does not revive movement permission ${JSON.stringify(props)}`, () => {
  const ai = fixture(props), before = command(ai);
  assert.equal(avoidEtnaLava(ai), false);
  assert.deepEqual(command(ai), before);
});

test('safe interior preserves commands; projected downhill inertia warns early', () => {
  const safe = fixture({ z: 2.5 }), before = command(safe);
  assert.equal(avoidEtnaLava(safe), false);
  assert.deepEqual(command(safe), before);
  const sliding = fixture({ z: 2.5, vz: 3 });
  const velocity = sliding.me.bodies.pelvis.linvel();
  assert.equal(avoidEtnaLava(sliding), true);
  assert.ok(travel(sliding.me).z < 0);
  assert.strictEqual(sliding.me.bodies.pelvis.linvel(), velocity);
  assert.equal(velocity.z, 3, 'involuntary velocity is not clamped');
});

test('leading foot can trigger a warning before the pelvis does', () => {
  const ai = fixture({ z: 3, heading: Math.PI / 2 });
  ai.me.bodies.footF = { translation: () => ({ x: 0, y: 0, z: 4.0 }) };
  assert.equal(avoidEtnaLava(ai), true);
  assert.ok(travel(ai.me).z < 0);
});

test('downhill attack-step input cannot override avoidance; upslope requests remain', () => {
  for (const move of [[0, 0.8], [0, 0]]) {
    const ai = fixture({ heading: -Math.PI / 2, move });
    ai.me.gait.req = { kind: 'lunge', fwd: 0.6, side: 0 };
    assert.equal(avoidEtnaLava(ai), true);
    assert.equal(ai.me.gait.req, null);
    if (move[1] === 0) assert.deepEqual(command(ai), [0, 0, 0, 0]);
  }
  const uphill = fixture({ heading: Math.PI / 2 });
  const request = uphill.me.gait.req = { kind: 'lunge', fwd: 0.6, side: 0 };
  assert.equal(avoidEtnaLava(uphill), true);
  assert.strictEqual(uphill.me.gait.req, request);
});

test('forward/reverse/sideways inputs at every heading route upslope within control budget', () => {
  for (let degrees = 0; degrees < 360; degrees += 5) for (const move of [[0, 0.8], [0, -0.8], [0.8, 0], [-0.8, 0], [1, 1]]) {
    for (const emotionScale of [0.2, 1, 1.3]) {
      const ai = fixture({ x: 1.2, heading: degrees * Math.PI / 180,
        move: move.map(v => v * emotionScale), emoMods: { move: emotionScale } });
      const before = ai.me.move.length(), position = ai.me.bodies.pelvis.translation();
      assert.equal(avoidEtnaLava(ai), true);
      const velocity = travel(ai.me);
      assert.ok(velocity.z < 0, `heading=${degrees},move=${move},emotion=${emotionScale}`);
      assert.ok(velocity.x < 0, 'small inward target survives unequal side/back speed');
      assert.ok(ai.me.move.length() <= before + 1e-12);
      assert.ok(Math.abs(ai.me.stickX) <= 1 + 1e-12 && Math.abs(ai.me.stickY) <= 1 + 1e-12);
      assert.strictEqual(ai.me.bodies.pelvis.translation(), position, 'routing never teleports');
    }
  }
});

test('production AI applies terrain routing after combat chooses its final input', () => {
  const ai = fixture({ move: [0, 0] });
  let calls = 0;
  ai.updateCombat = dt => { assert.equal(dt, 1 / 120); calls++; ai.me.move.set(0.8, 0); };
  AI.prototype.update.call(ai, 1 / 120);
  assert.equal(calls, 1);
  assert.ok(travel(ai.me).z < 0);
});
