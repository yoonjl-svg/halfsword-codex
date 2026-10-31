// 겹치기 단순 길 · 앞 박차기 시험 (사장님 10/31 19:xx '겹치기의 발동 경로가 좀 어색하더라 … 컨셉에 맞게 가장 효율적이고 단순한 움직임 … 속도는 … 낮추는 대신 박차기를 앞으로 쓰면서 치는 효과 …
//   앞 박차기는 … 겹치기와 함께만 발동' · '손 동작과 발 동작이 어우러져야 하니까. 그게 최우선.' — 기록 docs/strike/duplieren_simple_2026-10-31.md · 확인표 3301 ~ 3309):
//   기본 = 단순 길(dupOld 0 — 맞닿은 자리 축 한 축 돌림) · 앞 박차기 dupBurst(걸음 사다리 칸 · 죽음의 일격 거리에서 멈춤 · 칼과 같은 시간에 고르게 미끄러짐 · 앞발이 같은 시간에 내딛음 · 기력 pushCost — dupBurstFree 면 안 냄)
//   · `?dupOld=1` 판은 10/28 길 그대로(박차기 없음). 작게 · 빠르게: 판을 돌리지 않고 닿음을 손으로 놓고 겹치기를 낸 뒤 스텝을 몇 번 돌림.  node --test tools/sim/duplieren_simple.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET, STAMINA } = CONFIG;
const LADDER = [0.3, 0.45, 0.6, 0.9];

test('기본값 — 단순 길(dupOld 0) · 앞 박차기 걸음 사다리 칸 · 기력 안 냄(dupBurstFree 1 — 사장님) · 손발 순서(dupBurstSync 1 — 몸 · 발 먼저 · 칼은 디딤에 출발 · 정해 둔 칼 늦음 없음) · 박차기 물리(dupBurstMatch 1) · 길이 맞춤(dupBurstFit 1) · 몫 0.25 — 사장님 11/01 00:xx 결정 · 견줌 몫 0.5 · 시간 상한 없음', () => {
  assert.equal(UA.dupOld, 0);
  assert.ok(LADDER.includes(UA.dupBurst), `dupBurst ${UA.dupBurst}`);
  assert.equal(UA.dupBurstFree, 1, '사장님 10/31 22:xx — 겹치기 중 박차기 기력 0');
  assert.equal(UA.dupBurstT, 0, '박차기 시간 = 박찬 걸음 GAIT.burstT');
  assert.equal(UA.dupStrikeLag, undefined, '사장님 10/31 00:xx — 칼이 닿는 때는 정해 두지 않음(길 ÷ 몫 빠르기)');
  assert.equal(UA.dupBurstMatch, 1, '첫 걸음 박차기 물리 (사장님 11/01 00:xx 결정)');
  assert.equal(UA.dupBurstFit, 1, '가장 가까운 잘 드는 자리까지 (사장님 11/01 00:xx 결정)');
  assert.equal(UA.dupFitPoint, 0.2, '길이 맞춤 칼날 자리 — 잘 드는 몫의 코등이 쪽 끝 (사장님 확인 전)');
  assert.equal(UA.dupFitFloor, 0.5, '몸통이 맞닿는 가슴 사이까지 (죽음의 일격 거리 한도 없음 — 사장님 11/01 00:xx)');
  assert.equal(UA.dupOldShare, 0.5);
  assert.equal(UA.specialShare.duplieren, 0.25, `몫 ${UA.specialShare.duplieren}`); // 사장님 11/01 00:xx '겹치기도 25%로 테이블 맞추자'
  assert.equal(UA.dupBurstSync, 1, '몸 · 발 먼저 · 칼은 디딤에 출발');
  assert.equal(UA.dupSnapTime, 0, '시간 상한 없음 (사장님 11/01 00:xx)');
  assert.equal(UA.dupEdge, 1);
});

/** 사람 롱소드 몸 + 겹치기 (판을 돌리지 않음 — 가슴 사이를 d 로 두고 겹치기를 바로 냄) */
function body(set = {}, gap = 1.25) {
  const keys = ['dupOld', 'dupBurst', 'dupBurstFree', 'dupBurstSync', 'dupBurstT', 'dupBurstMatch', 'dupBurstFit', 'dupFitPoint', 'dupFitMin', 'dupFitFloor', 'specialCooldown'];
  const save = Object.fromEntries(keys.map((k) => [k, UA[k]]));
  const share0 = UA.specialShare.duplieren;
  Object.assign(UA, { specialCooldown: 0, ...set });
  if (set.share != null) UA.specialShare.duplieren = set.share;
  const G = newRound({ walls: true, seed: 3, weapon: 'longsword', weapon2: 'longsword', gap });
  const P = G.player;
  const E = G.enemy;
  G.ai.update = () => {};
  E.applyWound = () => {};
  const uq = new PlayerUniqueAssist(P, { names: new Set(['duplieren']) });
  // 판 시작 발 묶임(ARENA.startHold)을 넘김 — 묶인 발은 걸음을 안 받음
  while (P.feetHeld && G.t < 3) G.step();
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  const fire = () => {
    const ok = uq.launchTap(uq.dupE, uq.t, true);
    const out = { ok, steps: [] };
    for (let i = 0; i < 60; i++) {
      G.step();
      const I = P.iai;
      out.steps.push({ t: G.t, on: !!(I && I.tech === 'duplieren'), slide: I?.slide ? { ...I.slide } : null, dup: I?.dup ?? null, burst: I?.burst ?? null, maxT: I?.maxT ?? null, segs: I?.segs ? I.segs.map((s) => ({ D: s.B.D.clone(), T: s.T, pad: s.B.pad })) : null, cut: I?.segs ? I.segs.map((s) => s.cut) : null, legs: P.gait?.legs ? { F: !!P.gait.legs.F.stance, B: !!P.gait.legs.B.stance, kF: P.gait.legs.F.kind, kB: P.gait.legs.B.kind } : null, d: P.foeDistance(), req: P.gait?.req ? { ...P.gait.req } : null });
    }
    return out;
  };
  return { G, P, E, uq, fire, free: () => (Object.assign(UA, save), (UA.specialShare.duplieren = share0), G.world.free()) };
}

test('단순 길 — 맞물린 패드에서 얼굴로 가는 패드 곧은 줄 하나 (토막 패드가 한 줄 위 · 따로 밀어 넣는 토막 없음 · 모두 베는 토막 · 칼날이 얼굴 곁을 지남) · 앞 박차기 = 칼이 끌리는 시간 동안 고르게 · 앞발이 같은 때 뜸', () => {
  const B = body({ dupBurst: 0.45, dupBurstMatch: 0, dupBurstFit: 0, share: 0.2 });
  try {
    const R = B.fire();
    assert.ok(R.ok, '냄');
    const first = R.steps.find((s) => s.on);
    assert.ok(first, '운동학 칼');
    assert.equal(first.dup.line, 1, '단순 길');
    // 패드 곧은 줄 하나: 토막 끝 패드가 모두 p0 → p2 줄 위 (꺾임 없음) · 모두 베는 토막
    const segs = first.segs;
    assert.ok(segs.length >= 3);
    const [x0, y0] = first.dup.p0;
    const [x2, y2] = first.dup.p2;
    const L2 = Math.hypot(x2 - x0, y2 - y0);
    assert.ok(L2 > 0.02, `패드 길 ${L2}`);
    for (const sg of segs) {
      if (!sg.pad) continue; // 맞물린 채 실려 가는 토막 (칼 자세 그대로)
      const [x, y] = sg.pad;
      const off = Math.abs((x - x0) * (y2 - y0) - (y - y0) * (x2 - x0)) / L2;
      assert.ok(off < 0.011, `패드 줄 밖 ${off}`); // 0.01 칸 반올림 (I.dup 은 둘째 자리)
    }
    // 맞물린 채 실려 가는 토막(hold — 맞힘 없음)은 맨 앞 하나뿐 · 나머지는 모두 베는 토막
    assert.ok(first.cut.slice(first.dup.hold > 0 ? 1 : 0).every(Boolean), '모두 베는 토막');
    if (first.dup.hold > 0) assert.equal(first.cut[0], false, '실려 가는 토막은 맞힘 없음');
    assert.ok(first.dup.dFace < 0.15, `칼날 ↔ 얼굴 ${first.dup.dFace}`);
    // 박차기: 고르게 · 칼 시간에 맞춤 (상한 안)
    const S = first.slide;
    assert.ok(S && S.slide > 0.3 && S.slide <= 0.45 + 1e-9, `미끄러짐 ${S?.slide}`);
    // 고르게 (몸 꼴 0): 지난 시간 → 미끄러진 거리가 한 줄
    assert.equal(typeof S.pos, 'function');
    const Tstep = first.dup.Tstep;
    assert.ok(Math.abs(S.pos(Tstep / 2) - S.slide / 2) < 1e-6, '고르게');
    // 손발 순서: 미끄러짐 시간 = 앞발 발 뜬 시간 = 박찬 걸음 GAIT.burstT · 칼은 맞물린 채 실려 가다가(hold = 발 뜬 시간) 디딤에 출발 → 얼굴 = 출발 + 길 ÷ 몫 빠르기(t0) — 정해 둔 늦음 없음
    assert.ok(Math.abs(Tstep - CONFIG.GAIT.burstT) < 1e-6, `박차기 시간 ${Tstep}`);
    assert.ok(Math.abs(S.span - Tstep) < 1e-3, `미끄러짐 시간 ${S.span} · 박차기 ${Tstep}`);
    assert.ok(Math.abs(first.burst.Tf - CONFIG.GAIT.burstT) < 1e-3, `앞발 ${first.burst.Tf}`);
    assert.ok(Math.abs(first.dup.hold - CONFIG.GAIT.burstT) < 1e-6, `실려 감 ${first.dup.hold}`);
    assert.ok(Math.abs(first.dup.tFace - (first.dup.hold + first.dup.t0)) < 2e-3, `얼굴 ${first.dup.tFace} · 디딤 + 칼 시간 ${first.dup.hold + first.dup.t0}`);
    assert.ok(first.burst?.asked, '앞발 걸음을 받음');
    // 칼 출발 = 앞발이 디딘 스텝 (걸음이 없어지면 곧장 — 시간 한도 없음)
    const b = R.steps[R.steps.length - 1].burst ?? first.burst;
    assert.ok(b.launchT != null, '칼 출발');
    if (b.plantT != null) assert.ok(Math.abs(b.launchT - b.plantT) <= DT + 1e-6, `출발 ${b.launchT} · 디딤 ${b.plantT}`);
    // 시간 상한 없음: 운동학 칼은 길 끝까지 (끄는 시간 상한 maxT 0)
    assert.equal(first.maxT ?? 0, 0, '상한 없음');
    // 앞발: 칼이 시작한 뒤 두 스텝 안에 뜸 (걷던 앞발이 떠 있었으면 그 걸음을 이어받음 — 'req')
    const i0 = R.steps.indexOf(first);
    const lifted = R.steps.slice(i0, i0 + 3).some((s) => s.legs && ((!s.legs.F && s.legs.kF === 'req') || (!s.legs.B && s.legs.kB === 'req')));
    assert.ok(lifted, `앞발 뜸 ${JSON.stringify(R.steps.slice(i0, i0 + 3).map((s) => s.legs))}`);
  } finally {
    B.free();
  }
});

test('앞 박차기는 죽음의 일격 거리(가슴 사이 SECRET.mordCloseN 0.8 m)에서 멈춤 — 가슴 사이 1.0 m 에서 0.45 m 박차기면 0.2 m 만', () => {
  const B = body({ dupBurst: 0.45, dupBurstFit: 0, share: 0.2 }, 1.0);
  try {
    const d0 = B.P.foeDistance();
    const R = B.fire();
    const first = R.steps.find((s) => s.on);
    assert.ok(first?.slide, '미끄러짐');
    assert.ok(Math.abs(first.slide.slide - Math.max(0, Math.min(0.45, d0 - SECRET.mordCloseN))) < 0.03, `미끄러짐 ${first.slide.slide} · 처음 가슴 사이 ${d0}`);
  } finally {
    B.free();
  }
});

test('기력: 박차기는 기본 0 (사장님 10/31 22:xx — dupBurstFree 1) · dupBurstFree 0 이면 박찬 걸음 pushCost 12 (죽음의 일격 강제 박차기와 같은 칸) · 탭 하나(베기 12 × 무게)는 그대로', () => {
  for (const free of [0, 1]) {
    const B = body({ dupBurst: 0.45, dupBurstFit: 0, dupBurstFree: free, share: 0.2 });
    try {
      const st = B.P.stamina;
      const p0 = st.spent.push;
      const a0 = st.spent.attack;
      B.fire();
      assert.equal(st.spent.push - p0, free ? 0 : STAMINA.pushCost, `push ${st.spent.push - p0}`);
      assert.ok(st.spent.attack - a0 > 0, '탭 하나');
    } finally {
      B.free();
    }
  }
});

test('박차기 0 = 걸음 · 미끄러짐 없음 (단순 길만) · dupOld 1 = 10/28 길(comboPlanDup — 감는 쪽 way 칸) · 박차기 없음', () => {
  for (const [set, old] of [[{ dupBurst: 0, share: 0.2 }, false], [{ dupOld: 1, share: 0.5 }, true]]) {
    const B = body(set);
    try {
      const R = B.fire();
      const first = R.steps.find((s) => s.on);
      assert.ok(first, '운동학 칼');
      assert.equal(first.slide, null, '미끄러짐 없음');
      assert.equal(first.burst, null, '박차기 없음');
      if (old) assert.ok(first.dup.way != null && first.dup.line == null, '10/28 길');
      else assert.equal(first.dup.line, 1);
    } finally {
      B.free();
    }
  }
});

test('때 맞춤 끔(dupBurstSync 0) = 칼은 몫 빠르기 그대로 — 얼굴까지 늦추지 않음(slow 1) · 얼굴을 디딤과 같거나 먼저 지남 · 박차기 시간은 그대로(박찬 걸음 GAIT.burstT 이상)', () => {
  const B = body({ dupBurst: 0.45, dupBurstFit: 0, dupBurstSync: 0, share: 0.3 });
  try {
    const R = B.fire();
    const first = R.steps.find((s) => s.on);
    assert.ok(first?.dup?.line === 1);
    assert.equal(first.dup.slow, 1);
    assert.ok(first.dup.tFace <= first.dup.Tstep + 1e-6, `얼굴 ${first.dup.tFace} · 박차기 ${first.dup.Tstep}`);
    assert.ok(first.dup.Tstep >= CONFIG.GAIT.burstT - 1e-9);
  } finally {
    B.free();
  }
});

test('고르게 늦춤(dupBurstSync 2 — 10/31 첫 판 · 견줌) = 칼날이 얼굴을 지나는 때 = 디딤 · 실려 가는 토막 없음', () => {
  const B = body({ dupBurst: 0.45, dupBurstFit: 0, dupBurstSync: 2, share: 0.3 });
  try {
    const R = B.fire();
    const first = R.steps.find((s) => s.on);
    assert.ok(first?.dup?.line === 1);
    assert.equal(first.dup.hold, 0);
    assert.ok(Math.abs(first.dup.tFace - first.dup.Tstep) < 2e-3 || first.dup.tFace > first.dup.Tstep, `얼굴 ${first.dup.tFace} · 박차기 ${first.dup.Tstep}`);
  } finally {
    B.free();
  }
});

test('몸 꼴 첫 걸음 박차기 물리(dupBurstMatch 1 · 2 — 감독 10/31 23:xx): 골반 꼴 빠르기 ≤ GAIT.burstBackV · 가속 ≤ maxAccel × burstAccel · 0.45 m 를 다 감 · 박찬 걸음보다 오래 · 앞발 발 뜬 시간은 박찬 걸음 그대로 · 1 은 같은 한도로 줄여 섬', () => {
  const a = CONFIG.GAIT.maxAccel * CONFIG.GAIT.burstAccel;
  for (const match of [1, 2]) {
    const B = body({ dupBurst: 0.45, dupBurstFit: 0, dupBurstMatch: match, share: 0.3 });
    try {
      const R = B.fire();
      const first = R.steps.find((s) => s.on);
      assert.ok(first?.slide?.pos, '꼴');
      const S = first.slide;
      const T = first.dup.Tstep;
      assert.equal(first.dup.match, match);
      assert.ok(Math.abs(first.burst.Tf - CONFIG.GAIT.burstT) < 1e-3, `앞발 ${first.burst.Tf}`);
      assert.ok(T > CONFIG.GAIT.burstT, `몸 ${T}`);
      assert.ok(Math.abs(S.pos(T) - S.slide) < 1e-6 && Math.abs(S.pos(T + 0.1) - S.slide) < 1e-6, '다 감');
      const h = 1 / 240;
      let vPrev = first.dup.v0 ?? 0;
      let vEnd = 0;
      for (let t = h; t <= T + 1e-9; t += h) {
        const v = (S.pos(t) - S.pos(t - h)) / h;
        assert.ok(v <= CONFIG.GAIT.burstBackV + 1e-6, `빠르기 ${v} @ ${t}`);
        assert.ok(Math.abs(v - vPrev) / h <= a * 1.05 + 1e-6, `가속 ${(v - vPrev) / h} @ ${t}`);
        vPrev = v;
        vEnd = v;
      }
      if (match === 1) assert.ok(vEnd < 0.2, `줄여 섬 ${vEnd}`);
      // 몸이 칼보다 오래 가면 끝 자세 그대로 몸이 설 때까지 (맞힘 없음)
      const segT = first.segs.reduce((x, sg) => x + sg.T, 0);
      assert.ok(segT >= T - 1e-3, `토막 ${segT} · 몸 ${T}`);
    } finally {
      B.free();
    }
  }
});

test('박차기 길이 맞춤(dupBurstFit 1 — 사장님 11/01 00:xx): 낸 자리에서 짠 얼굴 베기가 얼굴을 칼날 dupFitPoint 자리에서 지나는 거리까지 · 첫 걸음 박차기 물리 · 죽음의 일격 거리 한도 없음(몸통이 맞닿는 dupFitFloor 까지) · 짧으면 걸음 없음', () => {
  for (const gap of [1.5, 1.0, 0.82]) {
    const B = body({ dupBurst: 0.45, dupBurstFit: 1, share: 0.3 }, gap);
    try {
      const d0 = B.P.foeDistance();
      const R = B.fire();
      const first = R.steps.find((s) => s.on);
      assert.ok(first?.dup?.line === 1, '단순 길');
      const F = first.dup.fitStep;
      const S = first.slide;
      if (d0 <= UA.dupFitFloor + 1e-3) {
        assert.equal(S, null, `걸음 없음 (가슴 사이 ${d0})`);
        continue;
      }
      assert.ok(F, `맞춤 ${JSON.stringify(first.dup)}`);
      assert.ok(F.sMax <= d0 - UA.dupFitFloor + 0.02 && F.sMax > d0 - SECRET.mordCloseN, `한도 ${F.sMax} · 가슴 사이 ${d0} (죽음의 일격 거리 너머까지)`);
      if (S) {
        assert.ok(S.slide >= UA.dupFitMin - 1e-9 && S.slide <= F.sMax + 1e-9, `걸음 ${S.slide}`);
        assert.equal(first.dup.match, 1, '첫 걸음 박차기 물리');
        assert.ok(Math.abs(F.err) < 0.1 || S.slide >= F.sMax - 1e-3, `어긋남 ${F.err} · 걸음 ${S.slide}`);
        assert.ok(Math.abs(first.burst.Tf - Math.min(CONFIG.GAIT.burstT, Math.max(0.1, first.dup.Tstep))) < 1e-3, `앞발 ${first.burst.Tf} · 몸 ${first.dup.Tstep} (박찬 걸음 · 짧으면 몸이 설 때)`);
      } else assert.equal(F.s, 0, '짧으면 걸음 없음');
    } finally {
      B.free();
    }
  }
});
