// 독일 특수 공격 시험 — 겹치기 (G7 두플리렌 · 사장님 10/28 01:2x '지금대로' · 감독 전달 — docs/strike/duplieren_2026-10-28.md · config UNIQUE_ASSIST.dupTap · dupSnapShare · dupSnapTime · dupEdge):
//   내 긋기가 상대 칼에 맞물려 지금도 닿아 있는 동안의 탭 = 겹치기(맞물린 자리에서 상대 칼 뒤로 감아 얼굴을 사선으로 · 죽음의 일격 칼 빠르기 × 0.6 · 0.2 s) ·
//   찌르기 맞물림 · 떨어진 뒤 · 탭 연타는 보통 탭 찌르기 · 한 맞물림에 한 번 · 인데스(독일 유파 패시브)는 이 칼에도 실림(비기 아님 — strokeStart · inSecret 거짓)
//  작게 · 빠르게(사장님): 손으로 기록을 놓는 시험 + 씨앗 하나 판.  node --test tools/sim/duplieren_tap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist } from '../../src/unique_assist.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';
import { dupCheck, dupTable } from './duplieren_check.mjs';
import { drillRun } from './special_balance.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
// 이 파일은 전 판(맞물린 채 탭 — `?dupAuto=0`)을 본다: 10/31 18:xx 사장님 결정으로 기본이 겹치기 자동('bind' — duplieren_auto.test.mjs)이 되어 탭 조건은 자동 판이면 안 봄 · 시험 파일마다 따로 도는 프로세스라 여기서만 0
UA.dupAuto = 0;
const { realS, SECRET } = CONFIG;

test('기본값 — 겹치기 탭 켬 · 고노센 칼끝 × 0.3(10/31 19:xx — 전 0.5) · 시간 상한 없음 · 긴 날 · 긋기 조건 없음 (탭으로만)', () => {
  assert.equal(UA.dupTap, 1);
  assert.equal(UA.specialShare.duplieren, 0.3); // 10/31 19:xx 단순 길 · 앞 박차기와 함께 0.3 [사장님 확인 전 — duplieren_simple_2026-10-31.md] (10/29 02:0x 사장님 '두플리렌 50%' · 전 모르트슐라크 × 0.6 = 고노센 × 0.18)
  assert.equal(UA.dupOldShare, 0.5); // `?dupOld=1` 견줌 몫
  assert.equal(UA.dupSnapTime, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
  assert.equal(UA.dupEdge, 1);
  const e = PLAYER_UNIQUE.german.find((x) => x.name === 'duplieren');
  assert.deepEqual(e.on, []);
  assert.equal(e.tapKey, 'dup');
  assert.ok(e.tapDup && e.special);
});

/** 사람 롱소드 몸 + 겹치기만 연 강화 (판을 돌리지 않음 — 긋기 기록 · 맞댐을 손으로 놓고 탭을 부름) */
function body() {
  const G = newRound({ walls: true, seed: 3, weapon: 'longsword', weapon2: 'longsword' });
  const P = G.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['duplieren']) });
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  let touch = true;
  uq.bladeTouch = () => touch; // 칼끼리 닿아 있나 (판에서는 칼날 선분 0.07 m · 맞댐)
  const cut = (extra = {}) => {
    uq.tapRec = null;
    uq.cur = { tech: 'zornhau', kind: 'cut', tap: false, t0: uq.t - 0.2, dir: [-0.7, -0.7], landed: false, bound: true, tEnd: null, unique: null, ...extra };
    return uq.cur;
  };
  const tap = () => {
    P.skill.tap = null;
    P.iai = null;
    P.iaiReq = null;
    uq.tapRec = null;
    const n0 = uq.stats.fired.duplieren ?? 0;
    P.skill.thrust();
    return (uq.stats.fired.duplieren ?? 0) > n0;
  };
  const cd = UA.specialCooldown;
  UA.specialCooldown = 0; // 조건 시험은 식힘 없이 (식힘은 special_cooldown.test.mjs)
  return { G, P, uq, cut, tap, setTouch: (v) => (touch = v), free: () => ((UA.specialCooldown = cd), G.world.free()) };
}

test('맞물린 긋기가 닿아 있는 동안 탭 = 겹치기 (운동학 칼 요청 · 고노센 × 몫 · 실제 0.2 s · 같은 공격 · 긴 날) · 한 맞물림에 한 번', () => {
  const B = body();
  try {
    B.cut();
    assert.equal(B.tap(), true);
    const R = B.P.iaiReq;
    assert.ok(R?.combo && R.tech === 'duplieren');
    assert.ok(Math.abs(R.share - UA.specialShare.duplieren) < 1e-12); // 고노센 × 몫 (모르트슐라크 빠르기와 따로 — 10/29 02:0x · 10/31 19:xx 0.3)
    assert.equal(R.maxT, UA.dupSnapTime);
    assert.equal(R.hold, 0);
    assert.equal(R.hitMul, 1);
    assert.ok(R.keepAim);
    const m = R.moves[0];
    assert.ok(m.dup && m.same && m.cutSweep && m.roll && m.edge === 1);
    assert.deepEqual(m.bodyPose, UA.dupBody);
    assert.ok(B.P.skill.tap == null, '보통 탭 찌르기 없음');
    assert.ok(iaiTipSpeed(B.P) * R.share > 3, '칼끝 빠르기');
    // 같은 맞물림(그 기록)에 두 번째 탭 → 보통 탭
    const r = B.cut();
    assert.equal(B.tap(), true);
    B.uq.cur = r;
    assert.equal(B.tap(), false, '한 맞물림에 한 번');
    assert.ok(B.P.skill.tap, '보통 탭 찌르기');
  } finally {
    B.free();
  }
});

test('막기 단추를 쥔 채 친 탭 (사장님 10/30 08:2x \'날개접기랑 겹치기도 같게해\' — UNIQUE_ASSIST.tapHeld 1): 쥔 막기(feed 넷째 값)여도 손이 정말 쥐이지 않았으면(다섯째 값) 겹치기 · tapHeld 0 은 전 판(버려짐) · 손이 쥐였으면 버려짐', () => {
  const B = body();
  try {
    assert.equal(UA.tapHeld, 1);
    B.cut();
    B.uq.feed(0, 0, 1 / 60, true, false);
    assert.equal(B.tap(), true, '쥔 채 탭 = 겹치기');
    B.cut();
    B.uq.feed(0, 0, 1 / 60, true, true);
    assert.equal(B.tap(), false, '손이 쥐였으면 버려짐');
    B.cut();
    UA.tapHeld = 0;
    try {
      B.uq.feed(0, 0, 1 / 60, true, false);
      assert.equal(B.tap(), false, '전 판');
    } finally {
      UA.tapHeld = 1;
    }
  } finally {
    B.free();
  }
});

test('찌르기 맞물림 · 탭 기록 · 안 맞물린 긋기 · 떨어진 뒤(맞댐 없음) · 끔(dupTap 0)은 보통 탭 · 긋기가 끝난 뒤에도 맞댄 채면 겹치기', () => {
  const B = body();
  try {
    B.cut({ kind: 'thrust', tech: 'stichPflug' });
    assert.equal(B.tap(), false, '찌르기 맞물림');
    B.cut({ tap: true, tech: 'tap', kind: 'cut' });
    assert.equal(B.tap(), false, '탭 기록');
    B.cut({ bound: false });
    assert.equal(B.tap(), false, '안 맞물림');
    B.cut();
    B.setTouch(false);
    assert.equal(B.tap(), false, '떨어짐');
    B.setTouch(true);
    B.cut();
    UA.dupTap = 0;
    try {
      assert.equal(B.tap(), false, '끔');
    } finally {
      UA.dupTap = 1;
    }
    // 긋기가 끝남(last) — 맞댄 채
    const r = B.cut();
    r.tEnd = B.uq.t - 0.05;
    B.uq.last = r;
    B.uq.atk = r;
    B.uq.cur = null;
    assert.equal(B.tap(), true, '끝난 긋기 · 맞댄 채');
  } finally {
    B.free();
  }
});

test('탭 연타(0.15 s 마다 · 긋기 없이 · 탭 찌르기가 상대 칼에 맞닿음)는 겹치기 0 번', () => {
  const B = body();
  try {
    B.uq.cur = null;
    B.uq.last = null;
    let fired = 0;
    for (let k = 0; k < 12; k++) {
      // 앞 탭 찌르기가 맞물리고 닿은 채 (찌르기 기록)
      B.uq.last = { tech: 'tap', kind: 'thrust', tap: true, t0: B.uq.t - 0.15, bound: true, landed: false, tEnd: B.uq.t - 0.02, unique: null };
      B.uq.atk = B.uq.last;
      if (B.tap()) fired++;
      B.uq.t += realS(0.15);
    }
    assert.equal(fired, 0);
  } finally {
    B.free();
  }
});

test('인데스 (독일 유파 패시브): 겹치기 탭은 비기가 아님 — 칼을 낸 순간(strokeStart · 비기 거짓)을 지나 인데스 창 몫이 이 칼에 묶임 · inSecret 거짓', () => {
  const B = body();
  try {
    const SP = B.P.schoolPassive;
    assert.equal(SP.school, 'german');
    const calls = [];
    const st0 = SP.strokeStart.bind(SP);
    SP.strokeStart = (secret = false) => {
      calls.push(secret);
      return st0(secret);
    };
    SP.foeFailed('blocked'); // 상대 공격이 내 칼에 막힘 → 인데스 창
    assert.ok(SP.indesOpen);
    B.cut();
    assert.equal(B.tap(), true);
    assert.deepEqual(calls, [false], '칼을 낸 순간 — 비기 아님');
    assert.ok(SP.lock.indes > 0, '인데스 몫이 이 칼에 묶임');
    assert.equal(B.P.stamina.inSecret, false);
  } finally {
    B.free();
  }
});

test('인데스 판 (씨앗 둘 · 칼끝을 든 가운데 자세 상대): 맞물린 뒤 인데스 창이 열린 채 낸 겹치기 — 끄는 동안 공격 중 · 주는 피해 배율 > 1 (비기 아님)', () => {
  const K = [];
  for (const seed of [1, 2])
    drillRun('dupTap', seed, {
      foe: 'guardHigh',
      dur: 10,
      probe: (G, P) => {
        const SP = P.schoolPassive;
        const uq = P.skill.uniq;
        if (!P.iai && uq?.cur?.bound && !SP.indesOpen) SP.foeFailed('blocked'); // 내 긋기가 맞물린 뒤 창을 엶 (그 긋기는 이미 냄 — 다음 칼 = 겹치기 탭)
        if (P.iai?.moves?.[0]?.dup) K.push({ k: SP.dealtK(), att: P.stamina.attacking, sec: P.stamina.inSecret });
      },
    });
  assert.ok(K.length >= 1, `겹치기 스텝 ${K.length}`);
  assert.ok(K.every((x) => x.att && !x.sec), '공격 중 · 비기 아님');
  assert.ok(K.some((x) => x.k > 1), `피해 배율 ${JSON.stringify(K.slice(0, 3))}`);
});

test('판 (씨앗 둘 · 칼끝을 든 가운데 자세 상대): 맞물린 긋기 뒤 탭이 겹치기로 나감 · 칼이 상대 칼을 지나가지 않음 · 칼 팔 손목 사람 범위 안 · 내 칼날이 내 몸을 지나지 않음', () => {
  const { S, runs } = dupCheck({ seeds: 2, foes: ['guardHigh'] });
  assert.ok(runs.length >= 1, `나감 ${runs.length}`);
  const T = dupTable(S);
  assert.equal(T.foeBlade.farTouch, 0, '맞닿은 자리 밖에서 상대 칼에 닿음');
  assert.ok(T.sword.oorShare <= 0.05, `손목 범위 밖 ${T.sword.oorShare}`);
  assert.ok(T.sword.roll[1] <= 80.5, `굴림 ${T.sword.roll}`);
  assert.equal(T.self.bladeHitShare, 0, '내 칼날 ↔ 내 몸');
});
