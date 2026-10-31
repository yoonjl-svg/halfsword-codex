// 사람 제비 베기 세 해법 시험 (사장님 10/25 21:1x '해법 1~3 좋아' — docs/strike/tsubame_snap_2026-10-25.md · config UNIQUE_ASSIST.tsuRuler · tsuSnap · tsuAim):
//   ① 끝 힘 잣대 = 꺾은 자리부터(올려 긋는 길) · ② 꺾는 순간 올려 긋는 길을 고노센 칼끝 빠르기 × 0.6 으로 0.2 s 까지 끌고 감(운동학 — 손가락 긋기와 같은 공격 · 붙잡기 없이 0.2 s 에 손가락으로) ·
//   ③ 올려 긋는 길 끝을 아래팔 · 겨드랑이 · 가슴 높이로 + 손 돌리기(손목 사람 범위). AI 길(schools.js) · 진 · 츠바메가에시(모노호시자오 kin)는 그대로. 셋 다 끄면 10/25 전 판.
//   ③ 몸통 띠(사장님 10/25 23:1x — UNIQUE_ASSIST.tsuBand): 올려 긋는 길이 처음 닿을 곳을 미리 끌고 가 보아 몸통 띠(골반 ~ 목 아래 가슴) 밖이면 길 높이를 가장 적게 옮김 · 운동학 칼 굴림 묶음.
//    끄면(`tsuBand` 0) 10/25 21:1x 판(가슴 높이 끝 점)
//   ③ 곧은 길(사장님 10/31 16:xx '제비 베기는 곧은 길로 바꿔' — UNIQUE_ASSIST.tsuHook 0 · docs/strike/tsubame_straight_2026-10-31.md): 꺾은 자리에서 왼 위로 곧게 한 번(TSU_AIM.line) ·
//    `tsuHook` 1 = 10/25 갈고리 길(TSU_AIM.band — 아래 시험이 그 판도 지킴)
//  작게 · 빠르게(사장님): 씨앗 하나 · 14 s 판 셋 · 칼끝 길 판 넷.  node --test tools/sim/tsubame_snap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { tsubameRun, tsubameSummary } from './schielhau_strike.mjs';
import { TRADITIONS, JAPANESE_GAIT, setJapaneseGait } from '../../src/schools.js';
import { G } from '../../src/ai_techniques.js';
import { PLAYER_UNIQUE, uniqueDef, PlayerUniqueAssist, TSU_AIM } from '../../src/unique_assist.js';
import { HUMAN } from '../../src/fighter.js';
import { traceRun, bend, bendTrail } from './tsubame_trace.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const TSU = PLAYER_UNIQUE.japanese.find((e) => e.name === 'tsubameGaeshi');
const withUA = (o, fn) => {
  const old = Object.fromEntries(Object.keys(o).map((k) => [k, UA[k]]));
  Object.assign(UA, o);
  try {
    return fn();
  } finally {
    Object.assign(UA, old);
  }
};
const OFF = { tsuRuler: 0, tsuSnap: 0, tsuAim: 0 };
// 한 판 견줌은 10/25 · 10/27 판 걸음(일본 걸음 전 판 `?jpGait=old`)에서 — 10/29 일본 걸음(느린 걸음 · 자세 0.45)은 씨앗 1 의 들어가는 거리 · 때가 달라 그 한 번 맞음이
//  위팔에 닿음(씨앗 1 ~ 6 모아 보면 새 걸음도 몸통 4 · 팔 2 — 전 걸음 5 · 1 · docs/strike/jp_gait_2026-10-29.md §10). 이 시험은 제비 베기 세 해법을 보는 것이라 판을 묶어 둠
const withJpOld = (fn) => {
  const keep = { ...JAPANESE_GAIT };
  setJapaneseGait('old');
  try {
    return fn();
  } finally {
    for (const k of Object.keys(JAPANESE_GAIT)) delete JAPANESE_GAIT[k];
    Object.assign(JAPANESE_GAIT, keep);
  }
};

test('기본값 — 세 해법 켬 · 0.6 · 0.2 s (사장님 10/25 결정) · AI 길 그대로', () => {
  assert.equal(UA.tsuRuler, 1);
  assert.equal(UA.tsuSnap, 1);
  assert.equal(UA.tsuAim, 1);
  assert.equal(UA.tsuBand, 1);
  assert.equal(UA.tsuHook, 0, '곧은 길 (사장님 10/31 16:xx)');
  assert.deepEqual(TSU_AIM.line, { path: [[-0.3, 0.25]], plan: [[0, 0, 0], [0, 0, 0]], shift: 'slide', pathHint: true, arcCut: true });
  assert.deepEqual(TSU_AIM.band.path, [[0.2, -0.2], [0, 0.1]], '갈고리 길은 `?tsuHook=1` 로 그대로');
  assert.equal(UA.specialShare.tsubameGaeshi, 0.6); // 10/29 02:0x 특수 공격 칼끝 = 고노센 × n 한 표 (제비 베기는 전과 같은 0.6)
  assert.equal(UA.tsuSnapTime, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
  const u = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
  assert.deepEqual([u.from, ...u.path], [G.tag, [0.0, 0.14], G.alber, [0.06, -0.15], G.ochsR]); // AI 가 읽는 길은 그대로
});

test('③ 사람 잣대 길: 꺾는 자리까지 그대로 · 그 뒤 곧은 길(line) — tsuHook 1 이면 갈고리 몸통 띠 길(band) · tsuBand 0 이면 21:1x 길 · tsuAim 0 이면 전 길 · 덧칸 없음', () => {
  const ln = uniqueDef('japanese', TSU);
  assert.deepEqual(ln.pts.slice(0, 3), [G.tag, [0.0, 0.14], G.alber]);
  assert.deepEqual(ln.pts.slice(3), TSU_AIM.line.path, '꺾은 자리 다음은 점 하나 — 꺾은 자리가 어디든 곧은 줄');
  assert.equal(ln.plan.length, ln.pts.length);
  assert.deepEqual(ln.plan, ln.pts.map(() => [0, 0, 0]), '손가락 몫 덧칸 0');
  assert.deepEqual(ln.snapPlan.slice(2), TSU_AIM.line.plan, '끌고 가는 칼 덧칸 0');
  assert.equal(ln.band, true, '몸통 띠 · 굴림 묶음 그대로');
  assert.deepEqual(ln.snapOpt, { shift: 'slide', pathHint: true, arcCut: true });
  const on = withUA({ tsuHook: 1 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(on.pts.slice(0, 3), [G.tag, [0.0, 0.14], G.alber]);
  assert.deepEqual(on.pts.slice(3), TSU_AIM.band.path);
  assert.equal(on.plan.length, on.pts.length);
  assert.deepEqual(on.plan.slice(2), TSU_AIM.plan, '손가락 몫 덧칸은 21:1x 그대로');
  assert.deepEqual(on.snapPlan.slice(2), TSU_AIM.band.plan, '끌고 가는 칼 덧칸');
  assert.equal(on.band, true);
  assert.equal(on.snapOpt, undefined, '갈고리 판은 10/25 그대로 (띠 옮김 꼴 · 날 쪽 셈 · 잔상)');
  const old = withUA({ tsuBand: 0 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(old.pts.slice(3), TSU_AIM.path);
  assert.deepEqual(old.plan.slice(2), TSU_AIM.plan);
  assert.ok(!old.band);
  const off = withUA({ tsuAim: 0 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(off.pts.slice(3), [[0.06, -0.15], G.ochsR]);
  assert.equal(off.plan, undefined);
  assert.ok(!off.band);
});

/** 제비 베기 강화를 손으로 연다 (앞 칼 빗나감 뒤 위로 — 조건은 detect 가 보지만 여기선 start 만) → 걸린 끌고 감 요청 */
function fire(weapon = 'uchigatana') {
  const g = newRound({ walls: true, seed: 1, weapon, weapon2: 'longsword' });
  const P = g.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['tsubameGaeshi']) });
  const e = uq.list.find((x) => x.name === 'tsubameGaeshi');
  P.handOffset.set(0, -0.5);
  uq.start(e, { tech: null, kind: 'cut', pad: 'alber', t0: 0, dir: [0, 1], start: [0, -0.5], landed: false, bound: false, tEnd: null, unique: null }, 1);
  return { g, P, uq, e };
}

test('① 끝 힘 잣대 = 꺾은 자리부터 (끄면 내려베기 몫)', () => {
  const lenOf = PlayerUniqueAssist.lenOf;
  const a = fire();
  try {
    assert.ok(Math.abs(a.uq.r.len - lenOf(a.e.U.pts, 2)) < 1e-12);
  } finally {
    a.g.world.free();
  }
  const b = withUA({ tsuRuler: 0 }, fire);
  try {
    assert.ok(Math.abs(b.uq.r.len - lenOf(b.e.U.pts, 0, 2)) < 1e-12);
  } finally {
    b.g.world.free();
  }
});

test('② 꺾는 순간 끌고 감: 몫 0.6 · 0.2 s 상한 · 붙잡기 0 · 손가락 긋기와 같은 공격 · 덧칸 — 끝나면 0.2 s 에 손가락으로 · 끄면 요청 없음 · 갈고리 판(tsuHook 1) 요청 그대로', () => {
  const h = withUA({ tsuHook: 1 }, fire);
  try {
    const m = h.P.iaiReq.moves[0];
    assert.deepEqual(m.path, TSU_AIM.band.path);
    assert.deepEqual(m.plan, TSU_AIM.band.plan);
    assert.equal(m.band, true);
    assert.ok(!m.shift && !m.pathHint && !m.cleanArc && !m.roll && !h.P.iaiReq.arcCut, '10/25 갈고리 판 그대로');
  } finally {
    h.g.world.free();
  }
  const a = fire();
  try {
    const R = a.P.iaiReq;
    assert.ok(R?.combo);
    assert.equal(R.share, 0.6);
    assert.equal(R.maxT, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
    assert.equal(R.hold, 0);
    assert.equal(R.hitMul, 1);
    assert.equal(R.arcCut, true, '잔상은 베는 토막만');
    const m = R.moves[0];
    assert.ok(m.same && m.cutSweep);
    assert.deepEqual(m.from, [0, -0.5]);
    assert.deepEqual(m.path, TSU_AIM.line.path);
    assert.deepEqual(m.plan, TSU_AIM.line.plan);
    assert.equal(m.band, true, '몸통 띠 겨눔 · 굴림 묶음');
    assert.equal(m.shift, 'slide');
    assert.equal(m.pathHint, true);
    assert.equal(m.cleanArc, true);
    assert.ok(a.uq.r, '강화는 그대로');
    let n = 0;
    a.g.step();
    while (a.P.iai && n < 100) {
      a.g.step();
      n++;
    }
    assert.ok(n < 100, `끌고 간 칼이 끝남 ${(n * DT).toFixed(3)} s`); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
    for (let k = 0; k < Math.ceil(0.25 / DT); k++) a.g.step();
    assert.equal(a.P.skill.thrustPose.w, 0, '0.2 s 뒤 손가락으로');
  } finally {
    a.g.world.free();
  }
  const b = withUA({ tsuSnap: 0 }, fire);
  try {
    assert.equal(b.P.iaiReq ?? null, null);
  } finally {
    b.g.world.free();
  }
});

test('진 · 츠바메가에시(모노호시자오 무기 비검 kin)는 그대로 — 전 길 · kin 0.5 · 붙잡기 0.2', () => {
  const a = fire('monohoshizao');
  try {
    assert.deepEqual(a.e.U.pts.slice(3), [[0.06, -0.15], G.ochsR]);
    const R = a.P.iaiReq;
    assert.equal(R.share, 0.5);
    assert.equal(R.hold, 0.2);
    assert.ok(!R.moves[0].same);
  } finally {
    a.g.world.free();
  }
});

/** 한 판 견줌 몫: 공격당 심각도 10 배 넘게(셋 다 끈 10/25 전 판 대비) · 몸통 띠(다리 없음 · 팔보다 몸통) · 손목 범위 안 · 굴림 한도 안 */
function oneFight(ua) {
  const run = () => withJpOld(() => tsubameRun(1, { immortal: true, dur: 14, ghostDown: true }));
  const R = withUA(ua, run);
  const on = tsubameSummary([R]);
  const off = tsubameSummary([withUA(OFF, run)]);
  assert.ok(on.perAtk >= 10 * Math.max(off.perAtk, 0.02), `켬 ${on.perAtk} · 끔 ${off.perAtk}`);
  assert.ok(on.snapHits >= 1);
  const P = on.parts;
  const n = (...k) => k.reduce((a, x) => a + (P[x] ?? 0), 0);
  const legs = n('thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB');
  const torso = n('pelvis', 'abdomen', 'chest');
  const arms = n('farmS', 'farmO', 'uarmS', 'uarmO');
  assert.equal(legs, 0, JSON.stringify(P));
  assert.ok(torso > arms, JSON.stringify(P));
  assert.equal(on.oor, 0);
  const rolls = R.rows.map((r) => r.hit?.s?.roll).filter((x) => x != null);
  assert.ok(Math.max(...rolls) <= HUMAN.forearmRoll + 1, `굴림 ${Math.max(...rolls)}° (손목 밧줄 ${HUMAN.forearmRoll}°)`);
}

test('한 판 견줌 (씨앗 1 · 14 s · 상대 상처 끔 · 아래 칼 빗나감) — 곧은 길(기본): 10 배 넘게 · 몸통 띠 · 손목 범위 안 · 굴림 한도 안', () => oneFight({}));

test('한 판 견줌 — 갈고리 길(`tsuHook` 1 — 10/25 판)도 그대로', () => oneFight({ tsuHook: 1 }));

test('곧은 길 꼴 (tsubame_trace — 가만히 선 상대 · 가슴 사이 1.15 · 1.3 m · 손가락 그대로 · 흔들림): 칼끝 · 잔상 곧음 · 날 앞장 · 손목 범위 안 · 굴림 한도 안 · 갈고리 판은 휨', () => {
  const k = CONFIG.STRIKE.edgeAlign;
  for (const [gap, seed] of [[1.15, 701], [1.3, 702]]) {
    const tr = traceRun('line', seed, gap);
    assert.ok(tr.fired, `${gap} m`);
    const b = bend(tr);
    const t = bendTrail(tr);
    assert.ok(b.devShare < 0.12 && b.kinkDeg < 15, `칼끝 길 ${gap} m: ${JSON.stringify(b)}`);
    assert.ok(t.devShare < 0.12 && t.kinkDeg < 15, `잔상 ${gap} m: ${JSON.stringify(t)}`);
    const W = tr.wr.filter((w) => w && w[1]);
    assert.ok(W.every((w) => w[3] <= 1), '끌고 가는 동안 손목 범위 안');
    assert.ok(W.every((w) => w[2] <= HUMAN.forearmRoll + 1), '끌고 가는 동안 굴림 한도 안');
    assert.ok(W.filter((w) => w[5] > k).length >= 0.8 * W.length, `날 앞장 ${W.map((w) => w[5]).join(',')}`);
    const h = tr.hits[0];
    assert.ok(h && ['pelvis', 'abdomen', 'chest'].includes(h.part) && h.edge > k, JSON.stringify(tr.hits));
    const hk = traceRun('hook', seed, gap);
    assert.ok(bend(hk).devShare > 0.4, `갈고리 판 휨 ${JSON.stringify(bend(hk))}`);
  }
});
