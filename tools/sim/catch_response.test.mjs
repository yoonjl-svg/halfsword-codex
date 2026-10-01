// Exercise actual Gait.update: response amplitude, trigger choice and independent get-up support.
import assert from 'node:assert/strict';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';

function response(mode, scale, { imbalance = 0.5, tilt = 0, handover = false, previous = 0 } = {}) {
  CONFIG.GAIT.catchMode = mode;
  CONFIG.GAIT.catchScale = scale;
  const G = newRound({ seed: 5, walls: false });
  try {
    const f = G.player;
    const gait = f.gait;
    gait.enter();
    if (handover) { gait.exit(); gait.enter(); }
    gait.levC = previous;
    f.offBalance = imbalance;
    f.bodies.chest.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt), true);
    gait.update(DT, new THREE.Vector3(), f.forward(new THREE.Vector3()), f.right(new THREE.Vector3()));
    return { catch: gait.levC, handover: gait.levH, total: gait.lev };
  } finally {
    G.eventQueue.free();
    G.world.free();
  }
}

const saved = { catchMode: CONFIG.GAIT.catchMode, catchScale: CONFIG.GAIT.catchScale };
try {
  const full = response('on', 1);
  const half = response('on', 0.5);
  assert.ok(full.catch > 0, 'fixture must trigger the actual reflex');
  assert.ok(Math.abs(half.catch * 2 - full.catch) < 1e-12, 'half strength must halve a fresh response');
  assert.equal(response('on', 0).catch, 0);
  assert.equal(response('off', 1).catch, 0);
  assert.ok(response('on', 1, { imbalance: 0, tilt: 1 }).catch > 0, 'on must respond to tilt');
  assert.equal(response('fall', 1, { imbalance: 0, tilt: 1 }).catch, 0, 'fall is imbalance-only');
  assert.ok(response('fall', 1).catch > 0, 'fall must respond to imbalance');
  const offRecovery = response('off', 1, { handover: true, previous: 0.8 });
  const onRecovery = response('on', 1, { handover: true, previous: 0.8 });
  assert.equal(offRecovery.catch, 0, 'off must clear a previous reflex');
  assert.ok(offRecovery.handover > 0, 'get-up handover must remain active');
  assert.equal(offRecovery.handover, onRecovery.handover, 'catch setting must not alter handover');
  assert.equal(offRecovery.total, offRecovery.handover);
  assert.ok(response('on', 0.5, { previous: 0.8 }).catch <= 0.5, 'lowering strength must not retain stronger history');
  console.log(JSON.stringify({ test: 'catch response and independent handover', pass: true, full, half, offRecovery }));
} finally {
  Object.assign(CONFIG.GAIT, saved);
}
