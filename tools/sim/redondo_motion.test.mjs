// 풍차 베기(B4 레돈두) 감기 휘청 고침 · 감기 꼴 셋 시험 (사장님 10/29 20:0x '레돈두는 처음 발동을 시작할 때 캐릭터가 크게 휘청거려. 이 문제를 반드시 고쳐야 하고,
//  머리 위로 칼을 돌리는 동작이 너무 빠르고 조악 … 좀 더 천천히 큰 동작으로 돌리거나 어깨에 얹는 고정 준비동작으로' — docs/strike/redondo_hold_2026-10-29.md §8 ·
//  config UNIQUE_ASSIST.rdSteady · rdRamp · rdWindMode · rdSlow · rdShoulder · src/iberian_redondo.js · fighter.js armsPlaced)
//  손가락은 누르는 동안 화면에 닿아 있다(게임 main.js handHeld = activeTouch) — 이 몫이 없던 10/29 판 시험 · 재기는 휘청을 못 봤다.
//  node --test tools/sim/redondo_motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { windSpec, windRate } from '../../src/iberian_redondo.js';
import { applyB4Old } from '../../src/config.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, IB_FLOW } = CONFIG;
const R2D = 180 / Math.PI;
// 뗌 → 벰 상한: 칼끝 몫 0.5(10/30 · 10/31 판 시험을 맞춘 값)에서 잡은 수를 지금 칼끝 몫에 맞춰 늘림 — 드는 길은 같은 길을 칼끝 빠르기로 감 (10/31 13:5x 0.5 → 0.3 · 꼴은 그대로 지킴)
const LEAD_MAX = (s05) => s05 * 0.5 / UA.specialShare.redondo;

/** 사람 몸 + 풍차 베기만 · 상대는 멀리 서 있음 · 누르는 동안 손가락 닿음(handHeld) · set = 이 판만 바꿀 UNIQUE_ASSIST 칸 */
function body({ weapon = 'zweihander', set = {}, kit = null, seed = 3 } = {}) {
  const keep = Object.fromEntries(Object.keys(set).map((k) => [k, UA[k]]));
  Object.assign(UA, set);
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', kit });
  const P = G.player;
  G.ai.update = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  const press = { down: false };
  G.before = () => {
    uq.holdInput(press.down, true, false);
    P.handHeld = press.down;
  };
  const steps = (s, each) => { for (let i = 0; i < Math.round(s / DT); i++) { G.step(); each?.(); } };
  steps(3.0); // 판 시작 정지(2 s) 뒤 서 있는 자세
  return { G, P, uq, press, steps, free: () => { G.world.free(); Object.assign(UA, keep); } };
}
/** 가슴 위 축 ↔ 하늘 각 (°) */
const tiltOf = (P) => {
  const r = P.bodies.chest.rotation();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  return Math.acos(Math.min(1, up.y)) * R2D;
};
/** 누름 → 감기 holdS 실제 초 동안의 흔들림: 가슴 기울기 바뀜 최대 · 무게중심이 발 둘레 밖으로 벗어난 몫 최대(m) · 넘어짐 */
function sway(B, holdS) {
  const { P, uq, press, steps } = B;
  const t0 = tiltOf(P);
  let dTilt = 0, off = 0, fell = false;
  press.down = true;
  steps(realS(0.6) + realS(holdS), () => {
    if (!uq.winding) return;
    dTilt = Math.max(dTilt, Math.abs(tiltOf(P) - t0));
    off = Math.max(off, P.offBalance ?? 0);
    if (P.state !== 'stand') fell = true;
  });
  return { dTilt, off, fell };
}

test('기본값 — 휘청 고침 켬 · 감기 꼴 = 안 B(shoulder — 사장님 10/31 02:xx \'풍차 베기. 아까 b안으로 본판 적용해.\' · 10/30 00:1x 판 안 A) · 얹은 채 0.6 s = 감음(얹은 때부터 — 감독 해석) · 안 A 한 바퀴 1.2 s (시간 사다리) · 내려침 = 곧장 사선(direct)', () => {
  assert.equal(UA.rdSteady, 1);
  assert.equal(UA.rdRamp, 1);
  assert.equal(UA.rdWindMode, 'load'); // 10/31 19:xx B4 다시 짬 — 어깨에 메기 (전 10/31 02:xx 안 B 'shoulder' — `?b4Old=1`)
  assert.ok(Math.abs(UA.rdSlow.loopT - realS(1.2)) < 1e-12);
  assert.ok(Math.abs(UA.rdSlow.windIn - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.rdShoulder.windIn - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.rdShoulder.woundT - realS(0.6)) < 1e-12);
  assert.equal(UA.rdShoulder.woundFrom, 'rest'); // 10/31 감독 해석 · 사장님 확인 전 — 'start' = 10/29 판 셈(감기 시작부터)
  assert.equal(windSpec().kind, 'shoulder'); // 메기 'load' 는 어깨 꼴과 같은 놓기 (자리만 rdLoad)
  assert.equal(windSpec().name, 'load');
  assert.ok(Math.abs(UA.rdLoad.windIn - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.rdLoad.woundT - realS(0.6)) < 1e-12);
  assert.equal(windRate(), 0, '메기 · 안 B 는 돌지 않음');
  assert.ok(Math.abs(windRate({ ...UA.rdSlow }) - (2 * Math.PI) / UA.rdSlow.loopT) < 1e-12, '안 A 한 바퀴');
  assert.equal(UA.rdRelease, 'tajo'); // 10/31 19:xx 멘 어깨에서 내려침 (전 10/30 'direct' 곧장 사선 · 'chamber' = 10/29 판 왼 어깨 뒤 길)
  assert.ok(UA.rdTajo.angle >= 45 && UA.rdTajo.angle <= 90, '사장님 10/31 19:xx \'45도~90도 사이로\'');
  assert.equal(UA.rdAiOld, 0, 'AI 도 새 꼴');
  assert.deepEqual({ ...UA.rdDiag }, { angle: 60, from: 95, to: -45, at: 0.7, pull: 0, target: 'lung', lowY: 0.35 }); // angle 60 — 사장님 10/30 01:3x '그래 60도로 진행해' (벰 면이 땅과 이루는 각)
});

test('휘청 고침 — 네 칼(츠바이핸더 · 플랑베르주 · 티소나 · 듀란달) 손가락을 대고 길게 눌러 감아도(안 B 기본 · 안 A 둘 다) 가슴이 크게 안 젖혀지고 · 무게중심이 발 둘레 안 · 안 넘어짐 / 고치기 전(rdSteady 0)은 휘청', () => {
  for (const mode of ['load', 'shoulder', 'slowSpin'])
    for (const weapon of ['zweihander', 'flamberge', 'tizona', 'durandal']) {
      const B = body({ weapon, set: { rdWindMode: mode } });
      try {
        const s = sway(B, 1.2);
        assert.ok(s.dTilt < 12, `${mode} ${weapon} 가슴 기울기 ${s.dTilt.toFixed(1)}°`);
        assert.ok(s.off < 0.05, `${mode} ${weapon} 발 둘레 밖 ${(s.off * 100).toFixed(1)} cm`);
        assert.equal(s.fell, false, `${mode} ${weapon}`);
      } finally { B.free(); }
    }
  const B = body({ set: { rdSteady: 0 } });
  try {
    const s = sway(B, 1.2);
    assert.ok(s.off > 0.2 || s.dTilt > 20, `고치기 전 재현 — 발 둘레 밖 ${(s.off * 100).toFixed(1)} cm · 기울기 ${s.dTilt.toFixed(1)}°`);
  } finally { B.free(); }
});

test('휘청 고침 — 감는 동안 손목 원뿔 · 칼 어깨 면 밧줄을 떼고, 내려침이 끝나면 · 그만둔 팔을 내려놓으면 다시 건다', () => {
  const B = body();
  try {
    const { P, uq, press, steps } = B;
    assert.ok(P.shoulderRopes?.length && P.gripCone?.length, '처음엔 걸려 있음');
    press.down = true; steps(realS(0.8));
    assert.equal(uq.winding, true);
    assert.equal(P.shoulderRopes, null, '감는 동안 어깨 면 밧줄 없음');
    assert.equal(P.gripCone, null, '감는 동안 손목 원뿔 없음');
    assert.equal(P.armsPlaced(), true);
    press.down = false; steps(DT * 3);
    assert.equal(uq.stats.fired.redondo, 1, '내려침');
    assert.equal(P.shoulderRopes, null, '내려침 동안도 뗀 채');
    let k = 0;
    while ((P.iai || P.iaiReq) && k++ < 400) steps(DT);
    steps(0.5); // 운동학 칼 끝 · 끝 자세 놓기(iaiFade) · 덧씌우기 칸 내려놓기(0.12 s) 뒤
    assert.ok(P.shoulderRopes?.length, '내려침 끝 → 어깨 면 밧줄 다시');
    assert.ok(P.gripCone?.length, '손목 원뿔 다시');
    assert.equal(P.armsPlaced(), false);
    // 그만둠 (막기 단추) → 덧씌우기 칸을 내려놓은 뒤 다시
    uq.coolT = {};
    press.down = true; steps(realS(0.8));
    assert.equal(P.shoulderRopes, null);
    uq.blocked = true; steps(DT * 2); uq.blocked = false; press.down = false;
    assert.equal(uq.winding, false);
    steps(0.4);
    assert.ok(P.shoulderRopes?.length && P.gripCone?.length, '그만둔 뒤 다시');
  } finally { B.free(); }
});

test('안 A slowSpin — 한 바퀴 실제 약 1.2 s · 칼끝 원이 10/29 판보다 큼 · 한 바퀴 넘게 감으면 흐름 셈 · 떼면 같은 내려침', () => {
  const B = body({ set: { rdWindMode: 'slowSpin' } });
  try {
    const { P, uq, press, steps } = B;
    press.down = true; steps(realS(0.7));
    assert.equal(uq.winding, true);
    assert.equal(P.rdWind.M.kind, 'spin');
    const T0 = P.rdWind.turns;
    steps(realS(0.6) + realS(1.2) * 0.5); // 섞기 끝 뒤
    const ta = P.rdWind.turns;
    steps(realS(0.6));
    const rate = (P.rdWind.turns - ta) / 0.6; // 실제 초당 바퀴
    assert.ok(Math.abs(1 / rate - 1.2) < 0.05, `한 바퀴 ${(1 / rate).toFixed(2)} s`);
    assert.ok(P.rdWind.turns > T0);
    // 칼끝 원 반지름 (손 ~ 칼끝 × sin cone) — 10/29 판 cone 30 보다 큼
    assert.ok(UA.rdSlow.cone > UA.rdLoop.cone);
    press.down = false; steps(DT * 3);
    assert.equal(uq.stats.fired.redondo, 1);
  } finally { B.free(); }
});

test('안 B shoulder — 오른 어깨에 얹어 멈춤(칼끝이 거의 안 움직임 · 날 위) · 얹은 때(섞기 0.6 s 끝)부터 0.6 s 넘게 쥐면 감음 · 그 전에 떼면 셈 없음 · 떼면 같은 내려침', () => {
  const run = (holdS) => {
    const B = body({ set: { rdWindMode: 'shoulder' } });
    try {
      const { P, uq, press, steps } = B;
      press.down = true; steps(realS(0.6) + realS(holdS));
      assert.equal(uq.winding, true);
      const W = P.rdWind;
      assert.equal(W.M.kind, 'shoulder');
      // 섞기 끝 뒤 칼끝 빠르기 (놓인 자리의 차)
      let tipV = 0;
      if (W.t > UA.rdShoulder.windIn + 0.05) {
        const a = P.bladePoint(1, new THREE.Vector3());
        steps(DT);
        tipV = P.bladePoint(1, new THREE.Vector3()).distanceTo(a) / DT;
      }
      // 칼 든 쪽 어깨 위 · 칼끝은 뒤 (몸 틀)
      const inv = P.yaw.clone().invert();
      const c = P.bodies.chest.translation();
      const tip = P.bladePoint(1, new THREE.Vector3()).sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(inv);
      const turns = W.turns;
      press.down = false; steps(DT * 3);
      return { tipV, tip, turns, fired: uq.stats.fired.redondo ?? 0, chain: uq.stats.windChain?.at(-1) };
    } finally { B.free(); }
  };
  const long = run(1.4); // 감기 1.4 s = 섞기 0.6 + 얹은 채 0.8
  assert.ok(long.tipV < 1.0, `얹은 칼끝 ${long.tipV.toFixed(2)} m/s`);
  // 10/31 08:xx 보이는 꼴 (사장님 '누가봐도 레돈두 준비처럼'): 칼끝이 칼 든 어깨 뒤 위로 머리 위 1 m 넘게 솟음 (10/31 02:xx 판은 가슴 위 0.43 m · 뒤 1.0 m — 게임 카메라에서 숨음)
  assert.ok(long.tip.x < -0.2, `칼끝은 뒤 ${long.tip.x.toFixed(2)}`);
  assert.ok(long.tip.y > 1.2, `칼끝은 위 ${long.tip.y.toFixed(2)}`);
  assert.ok(long.turns >= 1, '얹은 채 0.6 s 넘음 = 감음');
  assert.equal(long.fired, 1);
  const mid = run(1.0); // 얹은 채 0.4 s
  assert.ok(mid.turns > 0 && mid.turns < 1, `얹은 지 0.4 s — 셈 ${mid.turns.toFixed(2)}`);
  const short = run(0.3);
  assert.ok(short.turns === 0, '섞는 동안은 셈 0');
  assert.equal(short.fired, 1, '떼면 내려침 (셈 없이)');
});

test('흐르는 긋기 셈 (IB_FLOW.windmillChain simple) — 안 B 는 어깨에 얹은 채 0.6 s 를 한 바퀴 자리로 (10/31 감독 해석 · 사장님 확인 전 — 얹은 때부터 · woundFrom \'start\' = 10/29 판 감기 시작부터)', async () => {
  const { kitFromNodes } = await import('../../src/skill_tree_data.js');
  const kitAll = kitFromNodes('iberian', new Set(['B1', 'B5', 'B4', 'B6']));
  const run = (holdS, from = 'rest') => {
    const B = body({ set: { rdWindMode: 'shoulder', rdShoulder: { ...UA.rdShoulder, woundFrom: from } }, kit: kitAll, seed: 7 });
    try {
      const { uq, press, steps } = B;
      press.down = true; steps(realS(0.6) + realS(holdS)); press.down = false; steps(DT * 3);
      return uq.stats.windChain?.at(-1);
    } finally { B.free(); }
  };
  applyB4Old(true); // 흐름 셈은 10/31 14:xx 판 몫 (10/31 19:xx 부터 B4 는 흐름과 무관 — redondo_hold.test.mjs)
  try {
  assert.equal(IB_FLOW.windmillChain, 'simple');
  assert.equal(run(0.8), 0, '감기 0.8 s = 얹은 지 0.2 s → 셈 없음');
  assert.equal(run(1.0), 0, '얹은 지 0.4 s → 셈 없음');
  assert.equal(run(1.4), 1, '얹은 채 0.8 s → n 1');
  assert.equal(run(0.8, 'start'), 1, "10/29 판 셈(woundFrom 'start') — 감기 0.6 s 넘으면 n 1");
  } finally { applyB4Old(false); }
});

test('내려침 길 [안 A 고리] (사장님 10/30 00:1x \'궤적이 8자 모양으로 현란해 보이는데. 바로 내려치는 게 아닌가?\') — 곧장 사선(direct): 원 어디서 떼도 칼끝이 머리 위에 머문 채 왼 위로 들려 왼 위 → 오른 아래로 벰 · 10/29 판(chamber)은 칼끝이 어깨 뒤로 떨어지는 고리', async () => {
  const { traceRun, figure8 } = await import('./redondo_trace.mjs');
  const keepWind = UA.rdWindMode;
  const keepRel = UA.rdRelease;
  UA.rdWindMode = 'slowSpin'; // 안 A 를 덮음 (10/31 부터 기본은 안 B — 아래 시험)
  UA.rdRelease = 'direct'; // 10/30 곧장 사선 (10/31 19:xx 부터 기본은 멘 어깨에서 내려침 'tajo')
  try {
  for (const release of [1.6, 2.2]) {
    const r = traceRun({ w: 'zweihander', release });
    const m = figure8(r);
    assert.equal(r.fell, false);
    assert.ok(m.leadLow > 0.9, `${release} s — 드는 동안 칼끝 가장 낮은 곳 가슴 위 ${m.leadLow} m (머리 위에 머묾)`);
    assert.ok(r.tCut != null && r.tCut < LEAD_MAX(0.12), `${release} s — 뗌 → 벰 ${r.tCut} s (상한 ${LEAD_MAX(0.12).toFixed(3)} — 칼끝 몫에 맞춤)`);
    assert.ok(m.cutY[0] - m.cutY[1] > 1.2, `내려 벰 — 칼끝 높이 ${m.cutY} (벰이 끝까지 — 시간 상한에 안 끊김)`);
    assert.ok(m.cutZ[0] < -0.6 && m.cutZ[1] > 0.2, `왼 → 오른 — 칼끝 옆 ${m.cutZ}`);
  }
  const keep = UA.rdRelease;
  UA.rdRelease = 'chamber';
  try {
    const m = figure8(traceRun({ w: 'zweihander', release: 1.6 }));
    assert.ok(m.leadBack < -0.7 && m.leadLow < 0.6, `10/29 판 — 칼끝이 가슴 뒤 ${m.leadBack} m · 높이 ${m.leadLow} m 로 떨어짐 (8 자의 둘째 고리)`);
    assert.ok(m.leadLen > 2.5, `드는 길 ${m.leadLen} m`);
  } finally { UA.rdRelease = keep; }
  } finally { UA.rdWindMode = keepWind; UA.rdRelease = keepRel; }
});

test('내려침 길 [안 B 어깨 — 10/31 기본] 곧장 사선 60°: 어깨에 얹은 칼을 떼어 들면 칼끝이 얹은 자리보다 더 뒤로 가지 않고 머리 위에 머문 채(어깨 뒤 고리 · 8 자 없음) 왼 위 → 오른 아래로 벰 · 칼날이 제 몸을 지나지 않음 · 섞는 첫머리에 떼어도 같음', async () => {
  const { traceRun, figure8 } = await import('./redondo_trace.mjs');
  applyB4Old(true); // 10/31 14:xx 판 (`?b4Old=1` — 안 B 어깨 · 곧장 사선 60°)
  try {
  assert.equal(UA.rdWindMode, 'shoulder');
  for (const release of [0.4, 1.4]) { // 0.4 s = 아직 어깨로 섞는 중 · 1.4 s = 얹은 채 0.8 s
    const r = traceRun({ w: 'zweihander', release });
    const m = figure8(r);
    assert.equal(r.fell, false, `${release} s`);
    assert.ok(m.liftBack < 0.05, `${release} s — 드는 동안 뗀 자리보다 더 뒤 ${m.liftBack} m`);
    assert.ok(m.leadLow > 0.9, `${release} s — 드는 동안 칼끝 가장 낮은 곳 가슴 위 ${m.leadLow} m (머리 위에 머묾 — 10/31 08:xx 꼴은 칼을 세워 얹어 처음부터 머리 위)`);
    assert.ok(r.tCut != null && r.tCut < LEAD_MAX(0.15), `${release} s — 뗌 → 벰 ${r.tCut} s (상한 ${LEAD_MAX(0.15).toFixed(3)} — 칼끝 몫에 맞춤)`);
    assert.ok(m.cutY[0] - m.cutY[1] > 1.2, `내려 벰 — 칼끝 높이 ${m.cutY}`);
    assert.ok(m.cutZ[0] < -0.5 && m.cutZ[1] > 0.2, `왼 → 오른 — 칼끝 옆 ${m.cutZ}`);
    assert.ok(r.selfBlade > 0.05, `${release} s — 칼날 ↔ 내 몸 가장 가까이 ${r.selfBlade} m`);
  }
  } finally { applyB4Old(false); }
});

test('AI 풍차 베기 (사장님 10/31 08:xx \'플레이어만 그런 건가? 누가봐도 레돈두 준비처럼 보여야해.\' — UNIQUE_ASSIST.rdAiWind): 머리 위 돌려 베기를 고르면 사람과 같은 감기(안 B 어깨에 얹음 — 칼끝이 머리 위로 솟음)로 다가가 감음 뒤 닿는 거리에서 같은 곧장 사선 내려침 · 밧줄 다시 · 0 = 옛 패드 길', async () => {
  const { TRADITIONS } = await import('../../src/schools.js');
  const t = TRADITIONS.iberian.unique.find((u) => u.name === 'redondo');
  const run = (on) => {
    const keep = UA.rdAiWind;
    UA.rdAiWind = on;
    const G = newRound({ walls: true, seed: 1, weapon: 'longsword', weapon2: 'zweihander', gap: 2.3, persona: { proficiency: 4 } });
    try {
      const E = G.enemy;
      for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
      assert.ok(G.ai.startAttack({ ...t, plain: null }, 'open', { noFeint: true }));
      const o = { phases: new Set(), restTipY: null, rdMove: false, wound: false, ropesBack: null, kind: E.rdWind?.M?.kind ?? null, name: E.rdWind?.M?.name ?? null, tajo: false };
      const w0 = G.wounds.length;
      for (let i = 0; i < Math.round(4.0 / DT); i++) {
        G.step();
        o.phases.add(G.ai.phase);
        const W = E.rdWind;
        if (W && W.k >= 1 && o.restTipY == null) {
          const c = E.bodies.chest.translation();
          o.restTipY = E.bladePoint(1, new THREE.Vector3()).y - c.y;
          o.placed = E.armsPlaced();
        }
        if (E.iai?.moves?.[0]?.rd) { o.rdMove = true; if (E.iai.moves[0].rd.tajo) o.tajo = true; }
        if (o.rdMove && !E.iai && o.ropesBack == null && G.ai.phase !== 'rdStrike') o.ropesBack = false;
        if (o.ropesBack === false && E.shoulderRopes?.length && E.gripCone?.length) o.ropesBack = true;
      }
      o.wound = G.wounds.slice(w0).some((x) => x.att === E);
      o.stats = G.ai.stats.rdWind ?? null;
      return o;
    } finally { G.world.free(); UA.rdAiWind = keep; }
  };
  assert.equal(UA.rdAiWind, 1);
  const on = run(1);
  assert.equal(on.kind, 'shoulder', '사람과 같은 감기 꼴 (놓기 틀)');
  assert.equal(on.name, 'load', '10/31 19:xx — AI 도 어깨에 메기 (rdAiOld 0)');
  assert.ok(on.phases.has('rdWind') && on.phases.has('rdStrike'), [...on.phases].join(','));
  assert.equal(on.placed, true, '감는 동안 두 팔 · 칼을 놓음');
  assert.ok(on.restTipY < -0.2, `멘 칼끝 가슴 아래 ${on.restTipY?.toFixed(2)} m (땅 쪽으로 기욺)`);
  assert.equal(on.tajo, true, '내려침 = 멘 어깨에서 내려침');
  assert.equal(on.rdMove, true, '내려침 = 사람 풍차 베기 운동학 칼');
  assert.equal(on.wound, true, '서 있는 사람을 벰');
  assert.equal(on.ropesBack, true, '내려침 뒤 밧줄 다시');
  assert.equal(on.stats.fire, 1);
  // AI 옛 판 (rdAiOld 1 — 10/31 14:xx 판 어깨 'shoulder' · 곧장 사선): 사람 기본은 그대로
  const keepOld = UA.rdAiOld;
  UA.rdAiOld = 1;
  try {
    const old = run(1);
    assert.equal(old.kind, 'shoulder');
    assert.equal(old.name, null, 'AI 옛 판 = 안 B');
    assert.ok(old.restTipY > 1.2, `옛 얹은 칼끝 가슴 위 ${old.restTipY?.toFixed(2)} m`);
    assert.equal(old.tajo, false, '옛 판 = 곧장 사선');
    assert.equal(UA.rdWindMode, 'load');
  } finally { UA.rdAiOld = keepOld; }
  const off = run(0);
  assert.equal(off.kind, null);
  assert.ok(!off.phases.has('rdWind') && off.phases.has('strike'), `옛 패드 길 — ${[...off.phases].join(',')}`);
  assert.equal(off.rdMove, false);
});

test('AI 풍차 베기 빠른 틈 · 성향 기력 아낌 (사장님 10/31 13:4x \'a는 기본 적용하고 c는 성향마다 달랐음 좋겠어. 싸움을 풀어가는 방식에 따라 자율적으로.\' — rdAiQuick · rdAiThrift): 빠른 틈 · 기력 모자람은 바탕 동작 · 공격적 기질 · 분노는 감음 · 감는 중 기력이 아낌 줄 아래면 그만둠', () => {
  const mk = () => {
    const G = newRound({ walls: true, seed: 1, weapon: 'longsword', weapon2: 'zweihander', gap: 2.3, persona: { proficiency: 4 } });
    for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
    const rd = G.ai.school.tech.find((x) => x.name === 'redondo');
    assert.ok(rd?.plain, '머리 위 돌려 베기 강화동작 · 바탕 동작');
    return { G, ai: G.ai, E: G.enemy, rd };
  };
  const once = (fn) => {
    const o = mk();
    try { return fn(o); } finally { o.G.world.free(); }
  };
  assert.equal(UA.rdAiQuick, 1);
  assert.equal(UA.rdAiThrift, 1);
  // (a) 빠른 틈 — 상대 헛친 뒤(recover) · 이어 치기 → 바탕 동작 · 느긋한 틈(open) → 감기
  once(({ ai, E, rd }) => {
    assert.ok(ai.startAttack(rd, 'recover', { noFeint: true }));
    assert.equal(ai.tech.name, rd.plain.name, '빠른 틈 = 바탕 동작');
    assert.ok(!E.rdWind && ai.phase !== 'rdWind');
    assert.equal(ai.stats.rdWind.skip.quick, 1);
  });
  once(({ ai, rd }) => {
    assert.ok(ai.startAttack(rd, 'open', { noFeint: true, chain: 1 }));
    assert.equal(ai.tech.name, rd.plain.name, '이어 치기 = 빠른 틈');
  });
  once(({ ai, E, rd }) => {
    assert.ok(ai.startAttack(rd, 'open', { noFeint: true }));
    assert.equal(ai.phase, 'rdWind');
    assert.ok(E.rdWind);
  });
  // (c) 기력 30 — 바탕 AI(규율 0.85 · 공격적 기질 아님): 아낌 0.85 × (쉼 20 + 감기 31.3) ≈ 44 > 30 → 바탕 동작 (11/01 메는 동안 초당 베기 한 번 값 — 츠바이핸더 16.1/s · 전 감기 24)
  once(({ ai, E, rd }) => {
    assert.equal(ai.aggressiveTemper, false);
    assert.ok(Math.abs(ai.rdWindCost() - 31.3) < 0.5, `감기 한 번 몫 ${ai.rdWindCost()}`); // 11/01 rdDrainCut (전 24)
    E.stamina.value = 30;
    assert.ok(ai.startAttack(rd, 'open', { noFeint: true }));
    assert.equal(ai.tech.name, rd.plain.name);
    assert.equal(ai.stats.rdWind.skip.low, 1);
  });
  // 공격적 기질(공격 성향 × aggression > 1.15) · 지금 분노 0.6 → 같은 기력에도 감음
  once(({ ai, E, rd }) => {
    ai.pers.aggr = 1.4;
    assert.equal(ai.aggressiveTemper, true);
    assert.equal(ai.rdThrift(), 0);
    E.stamina.value = 30;
    assert.ok(ai.startAttack(rd, 'open', { noFeint: true }));
    assert.equal(ai.phase, 'rdWind');
  });
  once(({ ai, E, rd }) => {
    ai.anger = 0.6;
    E.stamina.value = 30;
    assert.ok(ai.startAttack(rd, 'open', { noFeint: true }));
    assert.equal(ai.phase, 'rdWind', `분노 아낌 ${ai.rdThrift().toFixed(2)}`);
  });
  // 감는 중 기력이 아낌 × 쉼 기력(≈ 17) 아래 · 감기 전 → 그만둠 'low' (아낌 0 이면 0 까지 감음)
  once(({ G, ai, E, rd }) => {
    assert.ok(ai.startAttack(rd, 'open', { noFeint: true }));
    G.step();
    E.stamina.value = 10;
    for (let i = 0; i < 3; i++) G.step();
    assert.equal(ai.stats.rdWind.cancel.low, 1, JSON.stringify(ai.stats.rdWind));
    assert.ok(!E.rdWind);
  });
  // 끔: 빠른 틈 · 기력 모자람에도 감음 (10/31 08:xx 판)
  const keep = [UA.rdAiQuick, UA.rdAiThrift];
  UA.rdAiQuick = 0;
  UA.rdAiThrift = 0;
  try {
    once(({ ai, E, rd }) => {
      E.stamina.value = 30;
      assert.ok(ai.startAttack(rd, 'recover', { noFeint: true }));
      assert.equal(ai.phase, 'rdWind');
    });
  } finally { [UA.rdAiQuick, UA.rdAiThrift] = keep; }
});
