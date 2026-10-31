// 동방 특수 공격 시험 — 날개 접기 (C6 염시 · 사장님 10/28 00:2x ~ 00:3x · 01:2x 조건 = 물러나며 탭 — docs/strike/lianchi_2026-10-28.md · config UNIQUE_ASSIST.lianTap · lianWindow · lianSnapShare · lianSnapTime):
//   스틱 뒤(뒤 몫 ≥ 0.5 · 옆 몫보다 큼)로 물러나는 동안의 탭 · 스틱을 놓고 실제 0.6 s 안의 탭 = 날개 접기(오른 허리로 거둠 → 앞으로 반걸음 들며 허리를 오른 → 왼 가로 호 · 격살 칼끝 빠르기 × 0.6 · 0.2 s) ·
//   스틱이 가운데이고 최근 물러남이 없는 탭 · 옆걸음 · 앞걸음의 탭은 보통 탭 찌르기 · 상대 칼 닿음은 조건이 아님
//  작게 · 빠르게(사장님): 손으로 스틱을 놓는 시험 + 씨앗 넷 판.  node --test tools/sim/lianchi_tap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist } from '../../src/unique_assist.js';
import { drillRun } from './special_balance.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET } = CONFIG;

test('기본값 — 날개 접기 탭 켬 · 놓은 뒤 창 실제 0.6 s · 고노센 칼끝 × 0.6(10/29 12:3x) · 실제 0.2 s (사장님 10/28 00:3x · 01:2x) · 긋기 조건 없음', () => {
  assert.equal(UA.lianTap, 1);
  assert.ok(Math.abs(UA.lianWindow - realS(0.6)) < 1e-12);
  assert.equal(UA.specialShare.lianchi, 0.6); // 10/29 12:3x 사장님 0.6 (02:0x '염시는 50%' · 전 격살 × 0.6 = 고노센 × 0.36)
  assert.equal(UA.lianSnapTime, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
  const e = PLAYER_UNIQUE.chinese.find((x) => x.name === 'lianchi');
  assert.deepEqual(e.on, []);
  assert.equal(e.tapKey, 'lian');
  assert.equal(UA.lianTrig, undefined, '조건 갈래 손잡이 없음');
  assert.ok(e.tapFold);
});

/** 사람 몸 + 날개 접기만 연 강화 (판을 조금 돌려 스틱 기록을 쌓고 탭을 부름) */
function body() {
  const G = newRound({ walls: true, seed: 3, weapon: 'hwando', weapon2: 'longsword' });
  const P = G.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['lianchi']) });
  const stick = (x, y) => {
    P.move.set(x, y);
    P.stickX = x;
    P.stickY = y;
  };
  G.before = () => {}; // 스틱은 시험이 놓음
  stick(0, 0);
  for (let i = 0; i < 3; i++) G.step();
  const run = (s, x, y) => {
    stick(x, y);
    const n = Math.round(s / DT);
    for (let i = 0; i < n; i++) G.step();
  };
  const tap = () => {
    P.skill.tap = null;
    P.iai = null;
    P.iaiReq = null;
    uq.tapRec = null;
    const n0 = uq.stats.fired.lianchi ?? 0;
    P.skill.thrust();
    return (uq.stats.fired.lianchi ?? 0) > n0;
  };
  const cd = UA.specialCooldown;
  UA.specialCooldown = 0; // 조건 시험은 식힘 없이 (식힘은 special_cooldown.test.mjs)
  return { G, P, uq, stick, run, tap, free: () => ((UA.specialCooldown = cd), G.world.free()) };
}

test('막기 단추를 쥔 채 친 탭 (사장님 10/30 08:2x \'날개접기랑 겹치기도 같게해\' — UNIQUE_ASSIST.tapHeld 1): 물러나며 쥔 막기 · 탭 = 날개 접기 · tapHeld 0 은 전 판(버려짐)', () => {
  const B = body();
  try {
    assert.equal(UA.tapHeld, 1);
    B.run(0.3, 0, -0.8);
    B.uq.feed(0, 0, 1 / 60, true, false);
    assert.equal(B.tap(), true, '쥔 채 탭 = 날개 접기');
    B.P.iai = null;
    B.P.iaiReq = null;
    UA.tapHeld = 0;
    try {
      B.run(0.3, 0, -0.8);
      B.uq.feed(0, 0, 1 / 60, true, false);
      assert.equal(B.tap(), false, '전 판');
    } finally {
      UA.tapHeld = 1;
    }
  } finally {
    B.free();
  }
});

test('물러나는(스틱 뒤 0.8) 동안의 탭 = 날개 접기 (허리 호 요청 · 고노센 × 0.6 · 실제 0.2 s · 앞으로 반걸음 · 같은 공격) · 스틱 가운데 · 최근 물러남 없음 탭은 보통 탭', () => {
  const B = body();
  try {
    B.run(0.5, 0, 0);
    assert.equal(B.tap(), false, '스틱 가운데 · 물러남 없음');
    assert.ok(B.P.skill.tap, '보통 탭 찌르기');
    B.run(0.3, 0, -0.8);
    assert.equal(B.tap(), true, '물러나는 채 탭');
    const R = B.P.iaiReq;
    assert.ok(R?.combo && R.tech === 'lianchi');
    assert.ok(Math.abs(R.share - 0.6) < 1e-12); // 고노센 × 0.6 (격살 빠르기와 따로 — 10/29 12:3x)
    assert.equal(R.maxT, UA.lianSnapTime);
    assert.equal(R.hold, 0);
    assert.ok(R.keepAim);
    const m = R.moves[0];
    assert.ok(m.same && m.cutSweep && m.capFromCut);
    assert.equal(m.dyn.target, 'waist');
    assert.equal(m.dyn.band, 'waist');
    assert.equal(m.step.fwd, UA.lianStep); // 날개 접기만의 앞 걸음 0.45 (10/29 14:3x — 연환 · 격살 반걸음 chineseStep 은 따로 — 10/29 14:5x 걸음 사다리 0.3)
    assert.equal(UA.lianStep, 0.45);
    assert.equal(SECRET.chineseStep, 0.3); // 걸음 사다리 0.3 칸 (사장님 10/29 14:5x '0.25는 0.3으로 합치자')
    assert.ok(B.P.skill.tap == null, '보통 탭 찌르기 없음');
  } finally {
    B.free();
  }
});

test('스틱을 놓고 실제 0.3 s 의 탭 = 날개 접기 · 0.7 s 는 보통 탭 · 옆걸음(옆 몫이 큼) · 앞걸음 · 뒤 몫 0.4 의 탭은 보통 탭 · 끔(lianTap 0)은 보통 탭', () => {
  const B = body();
  try {
    B.run(0.3, 0, -0.8);
    B.run(realS(0.3), 0, 0);
    assert.equal(B.tap(), true, '놓고 0.3 s');
    B.run(0.3, 0, -0.8);
    B.run(realS(0.7), 0, 0);
    assert.equal(B.tap(), false, '놓고 0.7 s');
    B.run(0.3, 0.8, -0.6);
    assert.equal(B.tap(), false, '옆걸음 (옆 몫이 큼)');
    B.run(realS(0.7), 0, 0);
    B.run(0.3, 0, 0.8);
    assert.equal(B.tap(), false, '앞걸음');
    B.run(0.3, 0, -0.4);
    assert.equal(B.tap(), false, '뒤 몫 0.4 (문턱 0.5 아래)');
    B.run(0.3, 0, -0.8);
    UA.lianTap = 0;
    try {
      assert.equal(B.tap(), false, '끔');
    } finally {
      UA.lianTap = 1;
    }
  } finally {
    B.free();
  }
});

test('탭 연타(0.15 s 마다 · 스틱 가운데 · 물러남 없음)는 날개 접기 0 번', () => {
  const B = body();
  try {
    B.run(1.0, 0, 0);
    let fired = 0;
    for (let k = 0; k < 12; k++) {
      if (B.tap()) fired++;
      B.run(realS(0.15), 0, 0);
    }
    assert.equal(fired, 0);
  } finally {
    B.free();
  }
});

test('판 (씨앗 넷 · 서 있는 상대): 물러나며 탭이 날개 접기로 나가 허리(배 · 골반)를 침 · 손목 사람 범위', () => {
  let fired = 0;
  const H = [];
  for (const seed of [1, 2, 3, 4]) {
    const r = drillRun('lianTap', seed, { foe: 'still', variant: 'on', dur: 14 });
    for (const a of r.atts.filter((x) => x.fired > 0)) {
      fired++;
      H.push(...a.hits.filter((h) => h.tech === 'lianchi'));
    }
  }
  assert.ok(fired >= 1, `나감 ${fired}`);
  assert.ok(H.some((h) => h.zone === 'abdomen' || h.zone === 'pelvis'), `허리 맞음 ${H.map((h) => h.zone).join(',')}`);
  for (const h of H.filter((x) => x.w)) assert.ok(h.w.oor <= 1 && Math.abs(h.w.fe) <= CONFIG.JOINTS.wristFE, `손목 ${JSON.stringify(h.w)}`);
});
