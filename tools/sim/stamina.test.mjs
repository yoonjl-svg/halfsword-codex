import test from 'node:test';
import assert from 'node:assert/strict';
import { Stamina } from '../../src/stamina.js';
import { STAMINA } from '../../src/config.js';

function actor(overrides = {}) {
  const f = { alive: true, armed: true, state: 'stand', feetHeld: false, move: { x: 0, y: 0 }, skill: {}, swordMass: 1.5, ...overrides };
  f.stamina = new Stamina(f);
  return f;
}
const tick = (f, seconds, dt = 1 / 120) => { for (let i = 0; i < Math.round(seconds / dt); i++) f.stamina.step(dt); };

test('이동·공격·막기는 소모, 막기는 공격의 1/8보다 적고 이중 청구 없음', () => {
  const move = actor({ move: { x: 0, y: 1 } });
  const attack = actor({ skill: { swinging: true } });
  const block = actor({ skill: { swinging: true } });
  block.stamina.controller = { active: true };
  for (const f of [move, attack, block]) tick(f, 2);
  assert.ok(move.stamina.value < 100);
  assert.ok(attack.stamina.spent.attack > 8 * block.stamina.spent.block);
  assert.equal(block.stamina.spent.attack, 0);
});

test('무거운 무기는 같은 이동·공격·막기에 더 소모', () => {
  for (const action of ['move', 'attack', 'block']) {
    const pair = [0.7, 4].map(swordMass => actor({ swordMass }));
    for (const f of pair) {
      if (action === 'move') f.move.y = 1;
      if (action === 'attack') f.skill.swinging = true;
      if (action === 'block') f.stamina.controller = { active: true };
      tick(f, 1);
    }
    assert.ok(pair[1].stamina.value < pair[0].stamina.value, action);
  }
});

test('시작 발 묶임·쓰러짐에는 이동 입력을 청구하지 않음', () => {
  for (const overrides of [{ feetHeld: true }, { state: 'down' }, { state: 'kneel' }]) {
    const f = actor({ move: { x: 1, y: 1 }, ...overrides });
    tick(f, 1);
    assert.equal(f.stamina.value, 100);
  }
});

test('휴식 지연 후 회복, 행동 재개는 회복 지연을 다시 시작', () => {
  const f = actor({ skill: { swinging: true } });
  tick(f, 1);
  const spent = f.stamina.value;
  f.skill.swinging = false;
  tick(f, 0.5);
  assert.equal(f.stamina.value, spent);
  tick(f, 1);
  assert.ok(f.stamina.value > spent);
  f.move.y = 1;
  tick(f, 0.1);
  f.move.y = 0;
  const now = f.stamina.value;
  tick(f, 0.5);
  assert.equal(f.stamina.value, now);
  tick(f, 20);
  assert.equal(f.stamina.value, 100);
});

test('고갈하면 힘 저하, 약간 회복해도 유지하고 20%에서 해제', () => {
  const f = actor({ skill: { swinging: true } });
  tick(f, 6);
  assert.equal(f.stamina.value, 0);
  assert.ok(f.stamina.exhausted && f.stamina.power < 1);
  f.skill.swinging = false;
  tick(f, 1.5);
  assert.ok(f.stamina.value > 0 && f.stamina.exhausted);
  tick(f, 1);
  assert.ok(f.stamina.value >= 20 && !f.stamina.exhausted);
  assert.equal(f.stamina.power, 1);
});

test('AI 막기는 싸게, 간 보기 손 이동은 공격이 아님', () => {
  const f = actor({ aiControlled: true, skill: { swinging: true } });
  const c = f.stamina.controller = { mode: 'watch' };
  tick(f, 1);
  assert.equal(f.stamina.value, 100);
  c.mode = 'defend';
  tick(f, 1);
  assert.ok(f.stamina.spent.block > 0);
  assert.equal(f.stamina.spent.attack, 0);
  c.mode = 'attack'; c.phase = 'strike';
  tick(f, 1);
  assert.ok(f.stamina.spent.attack > f.stamina.spent.block * 8);
});

test('버튼 없이 칼을 세워 받는 접촉도 막기로 청구', () => {
  const f = actor({ feel: { touching: true } });
  tick(f, 1);
  assert.ok(f.stamina.spent.block > 0);
  assert.equal(f.stamina.spent.attack, 0);
});

test('찌르기·폼멜과 사격도 청구; 사격은 발당 한 번', () => {
  for (const key of ['tap', 'pom', 'thrustPush']) {
    const f = actor({ skill: { [key]: true } });
    tick(f, 0.5);
    assert.ok(f.stamina.spent.attack > 0, key);
  }
  const f = actor({ gun: { shots: 1 } });
  tick(f, 0.1);
  const cost = f.stamina.spent.attack;
  tick(f, 0.1);
  assert.equal(f.stamina.spent.attack, cost);
});

test('같은 게임 시간은 스텝 간격과 무관하게 같은 비용·회복', () => {
  const a = actor({ move: { x: 1, y: 0 } });
  const b = actor({ move: { x: 1, y: 0 } });
  tick(a, 5); tick(b, 5, 1 / 60);
  a.move.x = b.move.x = 0;
  tick(a, 1.5); tick(b, 1.5, 1 / 60);
  assert.ok(Math.abs(a.stamina.value - b.stamina.value) < 1e-8);
});

test('사망·부활 중에는 정지, 새 검객은 가득 찬 기력', () => {
  const f = actor({ alive: false, skill: { swinging: true } });
  f.stamina.value = 30;
  tick(f, 5);
  assert.equal(f.stamina.value, 30);
  f.alive = true; f.revival = {};
  tick(f, 5);
  assert.equal(f.stamina.value, 30);
  assert.equal(actor().stamina.value, 100);
});

test('끔 대조는 고갈 효과까지 제거', () => {
  const f = actor({ skill: { swinging: true } });
  tick(f, 6);
  try {
    STAMINA.on = false;
    tick(f, 1);
    assert.equal(f.stamina.value, 100);
    assert.equal(f.stamina.power, 1);
  } finally { STAMINA.on = true; }
});
