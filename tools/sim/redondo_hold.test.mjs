// 이베리아 특수 공격 시험 — 풍차 베기 (B4 레돈두 · 사장님 10/29 00:4x ~ 01:5x · 08:3x — docs/strike/redondo_hold_2026-10-29.md · config UNIQUE_ASSIST.rdHold · rdHoldTime · rdDrain · rdSnapShare · rdSnapTime · IB_FLOW.windmillChain):
//   탭(손가락 · PC 왼 단추)을 끌지 않고 실제 0.6 s 넘게 누르면 머리 위로 칼을 돌리고(감기 — 걸음 그대로 · 기력이 듦) 떼면 왼 위 → 오른 아래로 내려 벰(10/30 곧장 사선 — redondo_motion.test.mjs) ·
//   0.6 s 전에 떼면 보통 탭 · 끌면 보통 긋기 · 식힘(내려침이 나간 순간부터 6 s) 중엔 감지 않음 · 맞음 · 막기 단추 · 비기는 감기를 그만두게(식힘 없음) · 기력이 바닥이면 저절로 내려침 ·
//   한 바퀴 넘게 돌린 뒤 낸 칼 = 이어 그은 칼 하나(흐르는 긋기 B5 · 이어지는 흐름 B6) · 사람의 왼 가로베기는 보통 긋기 · AI 는 그대로(왼 가로베기 강화동작)
//  손으로 누름을 놓는 시험 + 입력 층(input.js) 흉내 판.  node --test tools/sim/redondo_hold.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist, enhancedMoves } from '../../src/unique_assist.js';
import { kitFromNodes, nodeOf } from '../../src/skill_tree_data.js';
import { classifyStroke } from '../../src/attack_stroke.js';
import { G as PAD } from '../../src/ai_techniques.js';
import { windSpec } from '../../src/iberian_redondo.js';
import { applyB4Old } from '../../src/config.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, STAMINA, IB_FLOW, INPUT } = CONFIG;

test('기본값 — 길게 누름 실제 0.6 s · 기력 초당 붙어 버티기와 같은 수 · 고노센 칼끝 × 0.3 · 실제 0.4 s · 식힘 3 s(끝난 때부터 — 10/29 19:5x) · 흐름과 무관(10/31 19:xx) · B4 칸 = 정수리 가르기 · AI 는 왼 가로베기 강화동작 그대로', () => {
  assert.equal(UA.rdHold, 1);
  assert.ok(Math.abs(UA.rdHoldTime - realS(0.6)) < 1e-12); // 사장님 '0.6초'
  assert.equal(UA.rdDrain, STAMINA.clinchPerSecond);
  assert.equal(UA.specialShare.redondo, 0.2); // 11/01 00:xx 사장님 '고노센의 20%로 바꿔' (전 0.3) // 10/31 13:5x 사장님 '배율을 0.5에서 0.3으로 낮춰' (전 0.5) // 10/29 02:0x 사장님 '풍차베기는 50%' (전 싱지르 × 0.6 = 고노센 × 0.42)
  assert.equal(UA.rdSnapTime, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0) · 전 0.4 — // 10/31 0.2 → 0.4 [사장님 확인 전] — 칼끝 × 0.3 의 벰(0.265 s)을 끊지 않게 (redondo_motion 내려침 길 시험)
  assert.ok(Math.abs(UA.specialCooldown - realS(3.0)) < 1e-12); // 10/29 19:5x 사장님 '특수공격 3초(발동이 완료된 시점부터)' (전 6 s · 나간 순간부터)
  assert.equal(UA.specialCoolFrom, 'free');
  assert.equal(IB_FLOW.windmillChain, 0); // 10/31 19:xx 사장님 '풍차베기는 이어지는 흐름과 무관한 게 낫겠어' (전 10/29 08:3x 'simple' — `?b4Old=1`)
  assert.equal(IB_FLOW.windmillApart, 1); // B4 칼은 흐름 위력 · 세 칼 기력 0 자리와 닿지 않음 (감독 판단 · 사장님 확인 전 — 확인표 3292)
  const e = PLAYER_UNIQUE.iberian.find((x) => x.name === 'redondo');
  assert.equal(e.role, 'hold');
  assert.deepEqual(e.on, []); // 사람: 긋기 조건 없음 — 왼 가로베기는 보통 긋기
  assert.ok(e.special && e.hold);
  assert.equal(e.nameKo, '정수리 가르기 (알티바슈 포르트)'); // 사장님 10/31 19:xx 결정 (전 10/29 01:5x '풍차 베기 (레돈두)')
  assert.equal(e.orig, 'altibaxo forte'); // 원어 글자는 대기실 스킬에서만 (화면 글 지침 §1) — 피게이레두 낱말 altibaxo 로 지은 이름
  const n = nodeOf('iberian', 'B4');
  assert.equal(n.u, 'redondo'); // 열쇠는 그대로 (10/31 — 이름만 바꿈)
  assert.equal(n.name, '정수리 가르기');
  assert.deepEqual([n.d, n.cx, [...n.pre]], [2, 560, ['B5']]); // 01:3x 흐르는 긋기와 자리 바꿈
  assert.deepEqual([nodeOf('iberian', 'B5').d, nodeOf('iberian', 'B5').cx, [...nodeOf('iberian', 'B5').pre]], [1, 588, ['B1']]);
  assert.deepEqual([...nodeOf('iberian', 'B6').pre], ['B4']);
  // AI 몫 그대로: 왼 가로베기 대신 머리 위 돌려 베기 (sword_art.js 가 읽는 표)
  assert.deepEqual(enhancedMoves('iberian'), [{ base: 'zwerchL', name: 'redondo', stage: 3 }]);
});

/** 감기 시작부터 '한 바퀴' (게임 초 — 흐르는 긋기 셈 자리): 도는 꼴 = 꼴 한 바퀴 + 섞는 동안 도는 빠르기를 0 에서 올린 늦음(rdRamp — smooth 의 적분 = 섞기의 반) ·
 *  어깨 꼴(안 B — 10/31 기본) = 어깨에 얹는 섞기(windIn) + 얹은 채 woundT (woundFrom 'rest' — 감독 해석 · 'start' 면 감기 시작부터 woundT) */
function oneTurn() {
  const M = windSpec();
  if (M.kind === 'shoulder') return (M.woundFrom === 'start' ? 0 : M.windIn ?? 0) + M.woundT;
  return M.loopT + (UA.rdSteady > 0 && UA.rdRamp > 0 ? (M.windIn ?? 0) / 2 : 0);
}
/** 감기 꼴을 이 시험 동안만 (안 A 'slowSpin' · 안 B 'shoulder' — 둘 다 덮음) · 흐름 셈 시험은 10/31 14:xx 판(B4 옛 판 — 흐름의 첫 칼 'simple' · 흐름과 닿음)으로 덮음 (`?b4Old=1`) */
function withWind(mode, fn) {
  applyB4Old(true);
  const keep = UA.rdWindMode;
  UA.rdWindMode = mode;
  try { return fn(); } finally { UA.rdWindMode = keep; applyB4Old(false); }
}

/** 사람 츠바이핸더 + 풍차 베기만 연 강화 · 상대는 서 있음 */
function body({ seed = 3, gap = 2.4, names = ['redondo'], kit = null, weapon = 'zweihander' } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', gap, kit });
  const P = G.player;
  G.ai.update = () => {};
  const uq = new PlayerUniqueAssist(P, { names: new Set(names) });
  const press = { down: false, still: true };
  G.before = () => uq.holdInput(press.down, press.still, false);
  for (let i = 0; i < 3; i++) G.step();
  const steps = (s) => { for (let i = 0; i < Math.round(s / DT); i++) G.step(); };
  return { G, P, uq, press, steps, free: () => G.world.free() };
}

test('짧은 누름 · 끈 누름은 감지 않음 / 0.6 s 넘게 누르면 감고 · 떼면 내려침 · 식힘은 내려침이 나간 순간부터', () => {
  const B = body();
  try {
    const { P, uq, press, steps } = B;
    press.down = true; steps(realS(0.4)); press.down = false; steps(0.1); // 0.4 s 누름 → 아무것도 아님
    assert.equal(uq.stats.winds ?? 0, 0);
    press.down = true; press.still = false; steps(realS(0.9)); press.down = false; press.still = true; steps(0.1); // 끈 누름(긋기) → 감지 않음
    assert.equal(uq.stats.winds ?? 0, 0);
    press.down = true; steps(realS(0.55));
    assert.equal(uq.winding, false, '0.55 s 는 아직');
    steps(realS(0.1));
    assert.equal(uq.winding, true, '0.65 s 감기');
    assert.ok(P.rdWind);
    const v0 = P.stamina.value;
    steps(realS(1.0));
    assert.ok(v0 - P.stamina.value > 0.9 * STAMINA.clinchPerSecond * realS(1.0) * 0.99, '감는 동안 기력이 듦');
    assert.equal(uq.coolLeft('redondo'), 0, '감는 동안은 식힘 아님');
    press.down = false; steps(DT * 2);
    assert.equal(uq.stats.fired.redondo, 1, '떼면 내려침');
    assert.equal(uq.coolT.redondo, Infinity, '내려침이 도는 동안 식힘 중 (끝난 때부터 셈 — 10/29 19:5x)');
    assert.ok(P.iai || P.instantResult?.combo, '운동학 칼');
    steps(1.1); // 내려침(10/31 19:xx 멘 어깨에서 — 11/01 빠르기 0.2 에서 실제 약 0.67 s) + 끝 자세 풀기 0.2 s 뒤
    assert.equal(P.instantResult?.tech, 'redondo');
    const run = uq.stats.coolRuns?.at(-1);
    assert.ok(run?.name === 'redondo' && Number.isFinite(uq.coolT.redondo), '내려침 · 풀기가 끝나면 식힘을 셈');
    assert.ok(uq.coolLeft('redondo') > realS(2.0) && uq.coolLeft('redondo') <= realS(3.0), `남은 식힘 ${uq.coolLeft('redondo')}`);
    // 식힘 중: 길게 눌러도 감지 않음 · 떼도 아무것도 아님(탭 찌르기 없음 — 누른 시간이 탭 문턱 밖)
    press.down = true; steps(realS(1.0)); press.down = false; steps(0.1);
    assert.equal(uq.stats.winds, 1);
    assert.equal(uq.stats.fired.redondo, 1);
    assert.equal(P.skill.tap, null);
  } finally { B.free(); }
});

test('그만둠 (식힘 없음): 막기 단추 · 맞음(칼날 상처) · 비기 · 넘어짐 / 기력이 바닥이면 저절로 내려침', () => {
  for (const why of ['parry', 'hit', 'down']) {
    const B = body({ seed: 5 });
    try {
      const { P, uq, press, steps } = B;
      press.down = true; steps(realS(0.8));
      assert.equal(uq.winding, true, why);
      if (why === 'parry') uq.blocked = true;
      if (why === 'hit') P.wounds.push({ part: 'chest', type: 'cut', severity: 0.2, bleed: 0, local: null });
      if (why === 'down') P.state = 'down';
      uq.holdTick(DT);
      assert.equal(uq.winding, false, why);
      assert.equal(uq.stats.windCancel?.[why], 1, why);
      assert.equal(uq.coolLeft('redondo'), 0, `${why} — 식힘 없음`);
      assert.equal(uq.stats.fired.redondo ?? 0, 0, why);
      if (why === 'down') P.state = 'stand';
    } finally { B.free(); }
  }
  const B = body({ seed: 6 });
  try {
    const { P, uq, press, steps } = B;
    P.stamina.value = 3; // 거의 바닥
    press.down = true; steps(realS(1.2));
    assert.equal(uq.stats.windFire?.empty, 1, '기력 바닥 → 저절로 내려침');
    assert.equal(uq.stats.fired.redondo, 1);
    assert.equal(uq.winding, false);
    steps(realS(1.0));
    assert.equal(uq.stats.winds, 1, '누른 채면 다시 감지 않음');
  } finally { B.free(); }
});

for (const mode of ['slowSpin', 'shoulder'])
test(`흐르는 긋기 (IB_FLOW.windmillChain — 사장님 10/29 01:5x · 08:3x simple · 10/31 14:xx windmillPower 0) [${mode === 'shoulder' ? '안 B 어깨 — 기본 10/31 · 얹은 채 0.6 s = 한 바퀴(감독 해석)' : '안 A 고리 — 사장님 10/30 00:1x 한 바퀴'}]: 한 바퀴 전에 떼면 셈 없음 · simple = 사슬 안이든 밖이든 n 1 · inside(견줌) = 창 안에서 누르면 n + 1 · 흐르는 긋기(B5) 없으면 셈 없음 · 풍차 베기 칼 자체 위력은 × 1(흐름보너스 없음 — windmillPower 1 = 10/29 판 × 1.2 · inside × 1.8) · 0 = 끔`, () => withWind(mode, () => {
  // 한 바퀴 = 안 A 꼴 한 바퀴 + 섞는 동안 도는 빠르기를 0 에서 올린 늦음(rdRamp — 섞기의 반 · 사장님 10/30 00:1x 'A로 하고 흐름 보너스 시간은 한바퀴로' — 감기 시작부터 실제 약 1.5 s) ·
  //  안 B = 어깨에 얹는 섞기 0.6 s + 얹은 채 0.6 s (감기 시작부터 실제 1.2 s — 10/31 감독 해석 · 사장님 확인 전)
  const rot = oneTurn();
  const kitAll = kitFromNodes('iberian', new Set(['B1', 'B5', 'B4', 'B6']));
  const inPrep = (P) => { P.ibFlowT = 10; P.ibFlowCutEnd = 10; P.ibLastN = 3; }; // 이어 긋기 창 안 · 사슬 셋
  const run = (holdS, prep, kit = kitAll, mode = 'simple', power = IB_FLOW.windmillPower) => {
    const keep = [IB_FLOW.windmillChain, IB_FLOW.windmillPower];
    IB_FLOW.windmillChain = mode;
    IB_FLOW.windmillPower = power;
    const B = body({ seed: 7, kit });
    try {
      const { P, uq, press, steps } = B;
      prep?.(P);
      press.down = true; steps(realS(0.6) + holdS); press.down = false; steps(DT * 3);
      const n = uq.stats.windChain?.at(-1);
      const on = P.ibFlowOn;
      const k = on ? P.ibFlowK() : 1;
      const cost = P.ibChainCostK();
      return { n, k, cost, on, strike: P.ibStrike };
    } finally { [IB_FLOW.windmillChain, IB_FLOW.windmillPower] = keep; B.free(); }
  };
  assert.equal(IB_FLOW.windmillPower, 0, '10/31 14:xx 사장님 결정 — 풍차 베기 칼 자체 흐름 위력 없음');
  assert.equal(run(rot * 0.7).n, 0, '한 바퀴 전');
  const out = run(rot * 1.2);
  assert.equal(out.n, 1, '사슬 밖 → 첫 수 (흐름의 첫 칼로 인정)');
  assert.ok(out.on && out.strike, '내려침 동안 흐름 켜짐 · 사슬 자리 그대로');
  assert.equal(out.k, 1, '풍차 베기 칼 자체 × 1 (흐름보너스 없음)');
  assert.equal(out.cost, 1, '풍차 베기 칼은 기력 0 자리가 아님 (10/29 14:2x)');
  const inSimple = run(rot * 1.2, inPrep);
  assert.equal(inSimple.n, 1, 'simple — 사슬 안에서 눌러도 n 1');
  assert.equal(inSimple.k, 1);
  const inChain = run(rot * 1.2, inPrep, kitAll, 'inside');
  assert.equal(inChain.n, 4, 'inside — 사슬 안 → n + 1');
  assert.equal(inChain.k, 1, 'inside 도 칼 자체 × 1');
  const b5 = run(rot * 1.2, inPrep, kitFromNodes('iberian', new Set(['B1', 'B5', 'B4'])), 'inside');
  assert.equal(b5.k, 1, 'B5 만 → 칼 자체 × 1');
  assert.equal(b5.cost, 1, 'B5 만 → 기력 그대로');
  // 10/29 판 (windmillPower 1): 풍차 베기 칼도 이어 그은 칼 위력
  assert.ok(Math.abs(run(rot * 1.2, null, kitAll, 'simple', 1).k - 1.2) < 1e-9, '10/29 판 × 1.2');
  assert.ok(Math.abs(run(rot * 1.2, inPrep, kitAll, 'inside', 1).k - 1.8) < 1e-9, '10/29 판 inside 1 + 0.2 × 4');
  assert.ok(Math.abs(run(rot * 1.2, inPrep, kitFromNodes('iberian', new Set(['B1', 'B5', 'B4'])), 'inside', 1).k - 1.2) < 1e-9, '10/29 판 B5 만 → 1.2');
  const none = run(rot * 1.2, null, kitFromNodes('iberian', new Set(['B1', 'B4'])));
  assert.equal(none.n, 0, 'B5 없음 → 셈 없음');
  assert.equal(none.k, 1);
  const off = run(rot * 1.2, null, kitAll, 0);
  assert.equal(off.n, 0, '끔');
}));

for (const mode of ['slowSpin', 'shoulder'])
test(`simple — 풍차 베기 뒤 이어 그은 긋기는 n 2 (× 1.4) [${mode === 'shoulder' ? '안 B 어깨' : '안 A 고리'}]: 풍차 베기가 새 사슬의 첫 칼(칼 자체는 × 1 — 10/31 14:xx) — 세 칼 셈은 풍차 베기가 1 번째 · 그 뒤 두 번째 긋기(사슬 3 번째)가 기력 0`, () => withWind(mode, () => {
  const B = body({ seed: 7, kit: kitFromNodes('iberian', new Set(['B1', 'B5', 'B4', 'B6'])) });
  try {
    const { P, press, steps } = B;
    press.down = true; steps(realS(0.6) + oneTurn() * 1.2); press.down = false;
    let k = 0;
    while (!(P.iai || P.iaiReq) && k++ < 40) steps(DT); // 뗀 다음 스텝에 내려침이 나감
    assert.ok(P.iai || P.iaiReq, '내려침');
    steps(DT);
    assert.ok(P.ibFlowOn && P.ibStrike, '내려침 동안 흐름 켜짐');
    assert.equal(P.ibChainN(), 1, '풍차 베기 = 사슬 첫 칼 n 1');
    assert.equal(P.ibFlowK(), 1, '풍차 베기 칼 자체 흐름 위력 없음');
    while ((P.iai || P.iaiReq) && k++ < 400) steps(DT);
    steps(0.05);
    assert.ok(P.ibFlowOn, '내려침 끝 뒤 창 안 — 흐름 켜짐');
    P.skill.swinging = true; P.skill.vel.set(-8, 0); P.updateIbFlow(1 / 120);
    assert.equal(P.ibChainN(), 2, '다음 긋기 = n 2');
    assert.ok(Math.abs(P.ibFlowK() - 1.4) < 1e-9);
    assert.equal(P.ibChainCostK(), 1, '사슬 2 번째 = 보통');
    P.skill.swinging = false; for (let i = 0; i < 30; i++) P.updateIbFlow(1 / 120);
    P.skill.swinging = true; P.skill.vel.set(8, 0); P.updateIbFlow(1 / 120);
    assert.equal(P.ibChainN(), 3);
    assert.equal(P.ibChainCostK(), 0, '사슬 3 번째 = 기력 0');
  } finally { B.free(); }
}));

test('B4 는 이어지는 흐름과 무관 (사장님 10/31 19:xx \'풍차베기는 이어지는 흐름과 무관한 게 낫겠어\' — windmillChain 0 · windmillApart 1): 흐름의 첫 칼이 아님 · 사슬이 켜져 있어도 B4 칼은 흐름 위력 × 1 · 세 칼 기력 0 자리가 아님 · 사슬을 늘이거나 끊지 않음 (옛 판은 B4_OLD)', () => {
  const kitAll = kitFromNodes('iberian', new Set(['B1', 'B5', 'B4', 'B6']));
  const B = body({ seed: 7, kit: kitAll });
  try {
    const { P, uq, press, steps } = B;
    // 바로 앞에 사슬 둘 (마지막 진짜 긋기가 막 끝남 — 이어짐 창 안에서 누르기 시작)
    P.ibFlowT = 10; P.ibFlowCutEnd = 10; P.ibLastN = 2;
    const cutEnd0 = P.ibFlowCutEnd;
    press.down = true; steps(realS(0.6) + realS(1.4)); press.down = false;
    let k = 0;
    while (!(P.iai || P.iaiReq) && k++ < 40) steps(DT);
    assert.ok(P.iai || P.iaiReq, '내려침');
    steps(DT);
    assert.equal(P.ibStrike, null, '흐름 칼로 셈하지 않음 (ibStrike 없음)');
    assert.equal(uq.stats.windChain.at(-1), 0, '이어 그은 수 0 — 흐름의 첫 칼 아님');
    assert.equal(P.rdStrikeNow(), true);
    // 사슬이 켜진 채로 B4 칼이 맞는다고 해도 (흐름 켬 · 이어 그은 수 2 — 사슬 3 번째 자리) 위력 · 기력은 보통
    P.ibFlowOn = true; P.ibFlowSw = true; P.ibFlowChain = true; P.ibCutN = 2; P.ibChainN0 = 0;
    assert.equal(P.ibFlowK(), 1, 'B4 칼 흐름 위력 × 1');
    assert.equal(P.ibChainCostK(), 1, 'B4 칼은 세 칼 기력 0 자리가 아님');
    IB_FLOW.windmillApart = 0;
    try {
      assert.ok(Math.abs(P.ibFlowK() - 1.4) < 1e-9, '닿음 판이면 1 + 0.2 × 2 (가드가 하는 일)');
      assert.equal(P.ibChainCostK(), 0, '닿음 판이면 사슬 3 번째 기력 0');
    } finally { IB_FLOW.windmillApart = 1; }
    P.ibFlowSw = false;
    while ((P.iai || P.iaiReq) && k++ < 400) steps(DT);
    steps(0.05);
    assert.equal(P.ibFlowCutEnd, cutEnd0, 'B4 는 마지막 진짜 긋기 끝을 옮기지 않음 (사슬을 늘이지 않음)');
    // B4 뒤 첫 긋기 = 새 사슬 (앞 사슬의 창은 감는 동안 이미 지남 — 길게 누름 0.6 s = 이어짐 창 0.6 s)
    P.skill.swinging = true; P.skill.vel.set(-8, 0); P.updateIbFlow(1 / 120);
    assert.equal(P.ibChainN(), 0, 'B4 뒤 첫 긋기 = 새 사슬의 첫 칼');
  } finally { B.free(); }
});

test('사람 왼 가로베기는 보통 긋기 (풍차 베기를 열어도 강화동작으로 안 읽힘)', () => {
  const B = body();
  try {
    const { uq } = B;
    const c = classifyStroke(PAD.sideL, [1, 0]);
    assert.equal(c.tech, 'zwerchL');
    const pick = uq.choose({ tech: 'zwerchL', kind: 'cut', pad: c.pad, start: PAD.sideL }, PAD.sideL, [1, 0], uq.t);
    assert.equal(pick, null);
  } finally { B.free(); }
});

// ── 입력 층 (input.js — 브라우저 흉내는 부르는 동안만: 늘 두면 Rapier 가 멈춘다 · live_twin.mjs 와 같은 꼴) ──
const SHIM = { window: { addEventListener() {}, innerHeight: 390, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
const withBrowser = (fn) => {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try { return fn(); } finally { for (const k of added) delete globalThis[k]; }
};
const { Input } = await import('../../src/input.js');

test('입력 층 — 사람 손 흉내 500 번: 짧은 탭(40 ~ 150 ms · 12 px 안 — 탭 문턱 180 ms)은 늘 탭 · 감지 않음 / 끌기(0.6 s 전에 12 px 넘게)는 늘 긋기 · 감지 않음 / 끌지 않은 0.6 s 넘는 누름만 감음', () => {
  const B = body({ seed: 11, gap: 3.4 });
  try {
    const { P, uq, G } = B;
    const input = withBrowser(() => new Input({ addEventListener() {} }, new URLSearchParams('mobileVerticalGain=1')));
    input.enabled = true;
    let ms = 1000;
    let lcg = 12345;
    const rnd = () => (lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0) / 4294967296;
    const send = (type, x, y) => withBrowser(() => { const e = { type, pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: ms }; type === 'pointerdown' ? input.onDown(e) : type === 'pointermove' ? input.onMove(e) : input.onUp(e); });
    const frame = () => { // 60 Hz 화면 한 장 = 물리 두 스텝 (main.js 차례: 누름 상태 → 스텝)
      const hs = input.holdState();
      uq.holdInput(hs.down, hs.still, false);
      G.before = () => {};
      G.step(); G.step();
      ms += 1000 / 60;
    };
    const tally = { tap: 0, tapWind: 0, drag: 0, dragWind: 0, long: 0, longWind: 0 };
    const cool = () => { uq.coolT = {}; }; // 감은 뒤 식힘은 이 시험 밖
    for (let i = 0; i < 500; i++) {
      const kind = i % 3 === 0 ? 'tap' : i % 3 === 1 ? 'drag' : 'long';
      const w0 = uq.stats.winds ?? 0;
      const x = 600 + rnd() * 100, y = 200 + rnd() * 60;
      send('pointerdown', x, y);
      let dur = kind === 'tap' ? 40 + rnd() * 110 : kind === 'drag' ? 650 + rnd() * 500 : 700 + rnd() * 600;
      const t0 = ms;
      let mx = x, my = y;
      while (ms - t0 < dur) {
        if (kind === 'tap' || kind === 'long') { mx = x + (rnd() - 0.5) * 8; my = y + (rnd() - 0.5) * 8; } // 손가락 떨림 (12 px 안)
        else if (ms - t0 > 80 && ms - t0 < 80 + 400) { mx += 3 + rnd() * 4; my += rnd() * 2; } // 0.08 s 뒤 끌기 시작 (0.6 s 전에 12 px 넘음)
        send('pointermove', mx, my);
        frame();
      }
      const taps0 = input.taps;
      send('pointerup', mx, my);
      const tapped = input.consumeTaps() > 0;
      frame(); frame();
      const wound = (uq.stats.winds ?? 0) > w0;
      if (kind === 'tap') { tally.tap += tapped ? 1 : 0; tally.tapWind += wound ? 1 : 0; }
      if (kind === 'drag') { tally.drag += !tapped ? 1 : 0; tally.dragWind += wound ? 1 : 0; }
      if (kind === 'long') { tally.long += 1; tally.longWind += wound ? 1 : 0; }
      void taps0;
      for (let k = 0; k < 40; k++) frame(); // 칼이 끝나고 쉼
      cool();
      P.stamina.value = STAMINA.max;
    }
    assert.equal(tally.tapWind, 0, '탭이 감김');
    assert.equal(tally.dragWind, 0, '끌기가 감김');
    assert.equal(tally.tap, 167, '짧은 탭은 모두 탭');
    assert.equal(tally.drag, 167, '끌기는 탭이 아님');
    assert.equal(tally.longWind, tally.long, '끌지 않은 긴 누름은 모두 감김');
  } finally { B.free(); }
});
