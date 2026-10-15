import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina } from '../../src/stamina.js';
import { STAMINA, CLOSE } from '../../src/config.js';
import { newRound, DT } from './harness_m.mjs';

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function pair() {
  const fighters = [1.1, 2.9].map(swordMass => {
    const position = { x: 0, y: 1, z: 0 };
    const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass,
      move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false },
      canShove: true, stickY: 1, barge: { phase: 'press' }, contact: true,
      foeDistance: () => 0.5, closeTouch() { return this.contact; },
      bodies: { pelvis: { translation: () => position } }, position };
    f.stamina = new Stamina(f);
    f.stamina.value = 80; f.stamina.rest = 10;
    return f;
  });
  [fighters[0].foe, fighters[1].foe] = [fighters[1], fighters[0]];
  return fighters;
}
function tick(fs, duration, dt = 1 / 120, reverse = false) {
  let t = 0;
  while (t < duration - 1e-9) {
    const step = Math.min(dt, duration - t);
    for (const f of reverse ? [...fs].reverse() : fs) f.stamina.step(step);
    t += step;
  }
}

test('클린치 초당10은 소수점 연속 차감, 양쪽 밀기·무게·갱신 순서와 무관', () => {
  for (const reverse of [false, true]) {
    const fs = pair();
    tick(fs, 1 / 120, 1 / 120, reverse);
    for (const f of fs) { near(f.stamina.value, 80 - 10 / 120); near(f.stamina.recovered, 0); }
    tick(fs, 119 / 120, 1 / 120, reverse);
    for (const f of fs) { near(f.stamina.value, 70); near(f.stamina.spent.clinch, 10); near(f.stamina.clinchSeconds, 1); }
  }
});
test('한쪽만 밀어도 받는 사람/AI 양쪽 비용과 회복 중단은 같다', () => {
  for (const aiControlled of [false, true]) {
    const fs = pair(); fs[1].barge = null; fs[1].canShove = false; fs[1].stickY = 0; fs[1].aiControlled = aiControlled;
    tick(fs, 2);
    for (const f of fs) { near(f.stamina.value, 60); near(f.stamina.recovered, 0); }
  }
});
test('접촉·누르기·상태 조건이 없으면 가까이 있어도 클린치 비용 없음', () => {
  const cases = [
    fs => { fs.forEach(f => { f.contact = false; }); },
    fs => { fs.forEach(f => { f.barge.phase = 'step'; }); },
    fs => { fs.forEach(f => { f.stickY = 0; }); },
    fs => { fs.forEach(f => { f.foeDistance = () => 2; }); },
    fs => { fs[1].state = 'down'; }, fs => { fs[1].alive = false; },
    fs => { fs[1].revival = {}; }, fs => { fs[1].feetHeld = true; },
    fs => { fs[1].skill.tap = {}; }, fs => { fs[1].skill.sec = {}; },
  ];
  for (const setup of cases) {
    const fs = pair(); setup(fs); tick(fs, 0.2);
    fs.forEach(f => { near(f.stamina.spent.clinch, 0); assert.equal(f.stamina.clinching, false); });
  }
});
test('클린치 발 디딤·유지 접촉은 걷기나 예전 공격의 막기 비용과 중복되지 않음', () => {
  const fs = pair(); fs[1].swordArt = { tradition: 'japanese' };
  fs.forEach(f => { f.move.y = 1; f.stamina.attack(); });
  for (let i = 0; i < 120; i++) {
    fs.forEach(f => { f.position.x += 0.01; }); tick(fs, 1 / 120);
    fs.forEach(f => f.stamina.block(f.foe));
  }
  fs.forEach(f => { near(f.stamina.spent.clinch, 10); near(f.stamina.spent.move, 0); near(f.stamina.spent.block, 0); });
});
test('밀기 종료부터0.6초 후 회복, 짧게 놓아도 즉시 회복하지 않음', () => {
  const fs = pair(); fs[1].aiControlled = true; tick(fs, 1); fs.forEach(f => { f.stickY = 0; });
  tick(fs, 0.6); fs.forEach(f => near(f.stamina.value, 70));
  tick(fs, 0.2); near(fs[0].stamina.value, 74.2); near(fs[1].stamina.value, 73);
  fs.forEach(f => { f.stickY = 1; }); tick(fs, 0.1);
  fs.forEach(f => { f.stickY = 0; }); tick(fs, 0.2);
  near(fs[0].stamina.value, 73.2); near(fs[1].stamina.value, 72);
});
test('기력50 대 탈진+20:2초 뒤30 대 탈진, 갱신 순서에 따른 차이 없이 탈진', () => {
  for (const reverse of [false, true]) {
    const fs = pair(); fs[0].stamina.value = 50; fs[1].stamina.value = STAMINA.floor + 20; tick(fs, 2, 1 / 120, reverse);
    near(fs[0].stamina.value, 30); near(fs[1].stamina.value, STAMINA.floor);
    near(fs[0].stamina.spent.clinch, 20); near(fs[1].stamina.spent.clinch, 20);
    near(fs[1].stamina.exhaustLeft, 2.5);
    fs.forEach(f => { assert.equal(f.stamina.clinching, false); assert.equal(f.barge, null); });
    fs[1].stamina.controller = { held: true };
    tick(fs, 2.5, 1 / 120, reverse);
    near(fs[1].stamina.value, 0); near(fs[1].stamina.exhaustLeft, 0);
    fs.forEach(f => near(f.stamina.spent.clinch, 20));
  }
});
test('탈진 직전 마지막 소수점 비용도 양쪽이 같고, 동시 탈진도 강제 회복', () => {
  for (const both of [false, true]) {
    const fs = pair(); fs[0].stamina.value = both ? STAMINA.floor + 0.02 : 80; fs[1].stamina.value = STAMINA.floor + 0.02;
    fs[1].stamina.attack('cut', true); // 직전 공격 번호가 남아 있어도 누르기 접촉에 추가 청구하지 않는다.
    tick(fs, 1 / 120); fs[0].stamina.block(fs[1]);
    near(fs[0].stamina.value, both ? STAMINA.floor : 79.98); near(fs[0].stamina.spent.block, 0);
    fs.forEach(f => near(f.stamina.spent.clinch, 0.02));
    near(fs[1].stamina.value, STAMINA.floor); near(fs[1].stamina.exhaustLeft, 2.5);
    tick(fs, 2.5); near(fs[1].stamina.value, 0); if (both) near(fs[0].stamina.value, 0);
  }
});
test('클린치 소모는 물리dt에 비례하고 일시정지·기력 끔·밀기 끔에는 없음', () => {
  for (const dt of [1 / 120, 1 / 60, 0.1]) {
    const fs = pair(); tick(fs, 1.7, dt); fs.forEach(f => near(f.stamina.spent.clinch, 17));
    fs.forEach(f => f.stamina.step(0)); fs.forEach(f => near(f.stamina.spent.clinch, 17));
  }
  const on = STAMINA.on, close = CLOSE.on;
  try {
    STAMINA.on = false; let fs = pair(); tick(fs, 1); fs.forEach(f => { near(f.stamina.value, 100); near(f.stamina.spent.clinch, 0); });
    STAMINA.on = true; CLOSE.on = false; fs = pair(); tick(fs, 1); fs.forEach(f => near(f.stamina.spent.clinch, 0));
  } finally { STAMINA.on = on; CLOSE.on = close; }
});

function physicalClinch(mutual, exhaust = false) {
  const g = newRound({ weapon: 'longsword', seed: 7, gap: 1.6, sameLook: true });
  const fs = [g.player, g.enemy];
  g.ai.update = () => {};
  fs[0].canShove = true; fs[1].canShove = mutual;
  let phase = 'approach', releaseAt = null, pressAt = null, activeSteps = 0, prepared = false, exhaustedAt = null;
  try {
    g.before = t => {
      if (t > 2 && phase === 'approach' && fs[0].foeDistance() < 0.7) { phase = 'release'; releaseAt = t; }
      if (phase === 'release' && t - releaseAt > 0.15) { phase = 'press'; pressAt = t; }
      if (phase === 'press' && (t - pressAt > 3 || exhaustedAt != null)) phase = 'after';
      fs.forEach((f, i) => {
        const v = t < 2 ? 0 : phase === 'approach' ? 1 : phase === 'press' ? (i === 0 || mutual ? 1 : 0) : 0;
        f.move.set(0, v); f.stickX = 0; f.stickY = v;
        const off = f.handOffset, dx = 0.18 - off.x, dy = -0.28 - off.y;
        const k = Math.min(1, DT / Math.max(Math.hypot(dx, dy), 1e-9));
        off.x += dx * k; off.y += dy * k;
      });
    };
    for (let i = 0; i < 120 * 9 && fs.every(f => f.alive); i++) {
      if (exhaust && !prepared && fs[0].stamina.clinching) {
        fs[0].stamina.value = 50; fs[1].stamina.value = STAMINA.floor + 0.5;
        fs[1].stamina.controller = { held: true }; prepared = true;
      }
      const before = fs.map(f => ({ cost: f.stamina.spent.clinch, move: f.stamina.spent.move, recovered: f.stamina.recovered }));
      g.step();
      const costs = fs.map((f, n) => f.stamina.spent.clinch - before[n].cost);
      near(costs[0], costs[1]);
      if (costs[0] > 0) {
        activeSteps++;
        assert.ok(costs[0] <= STAMINA.clinchPerSecond * DT + 1e-9);
        fs.forEach((f, n) => { near(f.stamina.recovered, before[n].recovered); near(f.stamina.spent.move, before[n].move); });
      }
      if (exhaust && fs[1].stamina.exhausted && exhaustedAt == null) {
        exhaustedAt = g.t;
        near(fs[0].stamina.value, 49.5); near(fs[1].stamina.value, STAMINA.floor);
        fs.forEach(f => assert.equal(f.barge, null));
      }
      if (exhaustedAt != null && !fs[1].stamina.exhausted) {
        near(g.t - exhaustedAt, 2.5); near(fs[1].stamina.value, 0); break;
      }
    }
    assert.ok(activeSteps > 5, `actual contact never drained: ${activeSteps}`);
    if (exhaust) assert.ok(exhaustedAt != null, 'clinch did not exhaust the defender');
    else fs.forEach(f => near(f.stamina.spent.clinch, activeSteps * DT * 10));
    fs.forEach(f => assert.ok(Number.isFinite(f.bodies.pelvis.translation().y)));
  } finally { g.world.free(); }
}
test('실물리: 한쪽 밀기·상대 버티기에서 양쪽 같은 비용, 회복·걸음 중복 없음', () => physicalClinch(false));
test('실물리: 서로 밀어도10/s 한 번, 실제 접촉 시간만 소모', () => physicalClinch(true));
test('실물리: 클린치로 상대 탈진·누르기 해제·막기 유지 중2.5초 회복', () => physicalClinch(true, true));
