import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';

test('실제 Fighter 질량으로 무거운 무기 비용이 증가', () => {
  const costs = [];
  for (const weapon of ['rapier', 'zweihander']) {
    const g = newRound({ weapon, seed: 7 });
    try {
      g.ai.update = () => {};
      const p = g.player;
      for (let i = 0; i < 120; i++) {
        p.handOffset.set(0.48 * Math.sin(i * 0.25), 0.3 * Math.cos(i * 0.25));
        g.step();
      }
      assert.ok(p.stamina.spent.attack > 0);
      costs.push(p.stamina.spent.attack);
    } finally { g.world.free(); }
  }
  assert.ok(costs[1] > costs[0] * 1.3, JSON.stringify(costs));
});

test('실제 막기 버튼이 손을 옮겨도 공격 비용 없음, 휴식하면 회복', () => {
  const g = newRound({ weapon: 'longsword', seed: 7 });
  try {
    g.ai.update = () => {};
    const p = g.player;
    const guard = new PlayerParryGuard(p, g.enemy);
    p.stamina.controller = guard;
    guard.held = true;
    for (let i = 0; i < 120; i++) { guard.step(DT); g.step(); }
    assert.ok(p.stamina.spent.block > 0);
    assert.equal(p.stamina.spent.attack, 0);
    const depleted = p.stamina.value;
    guard.held = false;
    for (let i = 0; i < 360; i++) { guard.step(DT); g.step(); }
    assert.ok(p.stamina.value > depleted);
  } finally { g.world.free(); }
});

test('고갈 시 실제 팔 모터·손목 상한이 60%, 다리 모터·동작 목표는 동일', () => {
  const rows = [];
  for (const exhausted of [false, true]) {
    const g = newRound({ weapon: 'longsword', seed: 7 });
    try {
      const p = g.player;
      p.stamina.value = exhausted ? 0 : 100;
      p.stamina.exhausted = exhausted;
      p.handOffset.set(0.4, 0.35);
      const muscles = {};
      const raw = p.joints[0].joint.rawSet;
      const motor = raw.jointConfigureMotor.bind(raw);
      raw.jointConfigureMotor = (handle, axis, target, velocity, k, d) => {
        const j = p.joints.find(j => j.joint.handle === handle);
        if (j) muscles[j.name] = { k, d };
        return motor(handle, axis, target, velocity, k, d);
      };
      const original = p.manualMuscle.bind(p);
      p.manualMuscle = (j, k, d, max) => { muscles[j.name] = { k, d, max }; return original(j, k, d, max); };
      g.step();
      rows.push({ muscles, cap: p.debug.wristCap, target: p.handTarget.toArray(), aim: p.debug.aim.toArray() });
    } finally { g.world.free(); }
  }
  assert.ok(Math.abs(rows[1].cap / rows[0].cap - 0.6) < 1e-6);
  for (const name of ['uarmS', 'farmS', 'uarmO', 'farmO']) {
    assert.ok(rows[0].muscles[name], name);
    assert.ok(Math.abs(rows[1].muscles[name].k / rows[0].muscles[name].k - 0.6) < 1e-6, name);
  }
  for (const name of ['thighF', 'thighB', 'shinF', 'shinB']) {
    assert.ok(rows[0].muscles[name], name);
    assert.deepEqual(rows[1].muscles[name], rows[0].muscles[name]);
  }
  assert.deepEqual(rows[0].target, rows[1].target);
  assert.deepEqual(rows[0].aim, rows[1].aim);
});
