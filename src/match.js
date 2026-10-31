// ─────────────────────────────────────────────────────────────
//  한 판의 물리 스텝 차례 — 1:1 · 2:1 · 2:2 같은 길 (동시 대전 1단계 배관, 사장님 10/29 14:2x 생사전 ·
//  docs/strike/team_fight_2026-10-29.md)
//
//  지금(1 · 2단계)은 시뮬 하니스(tools/sim/jelly_harness.mjs newMatch)만 부른다. main.js 의 스텝 고리는 아직 제 줄 그대로이고
//  (3단계에서 이 함수로 바꾼다) 차례는 그 고리와 똑같다:
//   ① 상대 · 바라볼 곳   f.foe = foeOf(f) · f.faceTarget = 상대 골반 · AI 의 겨눈 상대(ai.setFoe — 1:1 은 늘 같아 아무 일 없음)
//   ② 조종               1 편 → 0 편, 편 안에서 자리 차례, 사람 몸(human)의 조종은 맨 뒤 (orderControllers)
//   ③ 몸                 자리 차례로 f.step → (hooks.afterFighters) → 자리 차례로 f.cacheState
//   ④ 물리 · 전투        world.step → combat.afterStep → (hooks.afterWorld) → 판 끝 보기(한 편에 산 싸움꾼 0 — M.over · M.winner)
//  1:1 의 상대 고르기 = 다른 하나 (산 · 죽음 상관없이 — 예전 그대로). 셋 이상은 src/targeting.js chooseTarget (2단계) —
//  그때만 싸움꾼에 f.foes · f.mates(상대 편 · 같은 편 목록)를 달고 AI 에 상대마다 눈을 둔다(addFoe). 1:1 은 둘 다 없어 예전 길 그대로
// ─────────────────────────────────────────────────────────────
import { sameSide, teamOfIndex } from './team.js';
import { chooseTarget } from './targeting.js';
import { TEAM_FIGHT } from './config.js';

/**
 * 판 하나를 묶는다. o = { world, eventQueue, combat, fighters(자리 차례 — fighters[i].index === i), controllers([{ me, update(dt), setFoe?(f) }] — AI 들), foeOf?(f, M) }
 *  돌려줌 M = { ...o, order(조종 부르는 차례), t }. 판 도중에 조종을 바꾸면 M.order = orderControllers(M.controllers)
 */
export function createMatch(o) {
  const M = { foeOf: null, controllers: [], ...o, t: 0 };
  M.fighters.forEach((f, i) => {
    if (f.index !== i) throw new Error(`match: fighters[${i}].index = ${f.index}`);
  });
  M.order = orderControllers(M.controllers);
  if (M.fighters.length > 2) {
    M.foeOf ??= chooseTarget;
    for (const f of M.fighters) {
      f.foes = foesOf(M, f);
      f.mates = matesOf(M, f);
    }
    for (const c of M.controllers) if (c.addFoe) for (const g of c.me.foes) c.addFoe(g); // 상대마다 눈 · 간격 어림을 판 시작에 (같은 시계)
  }
  M.over = false; // 한 편에 산 싸움꾼이 없으면 true (stepMatch)
  M.winner = null; // 이긴 편 0 · 1 (둘 다 0 이면 null)
  M.endT = null;
  return M;
}

/**
 * 판 결과 (편 전멸 — 2단계): { over, winner, t(끝난 판 시간 · 아직이면 지금), fighters: 자리마다 { index, team, name, alive, blood, consciousness, wounds, causeOfDeath } }.
 *  wounds = 상처 사본 [{ part, type, severity, bleed, stump? }] — 6단계(판 사이 이어받기)의 바탕
 */
export function matchResult(M) {
  return {
    over: M.over,
    winner: M.winner,
    t: M.endT ?? M.t,
    fighters: M.fighters.map((f) => ({
      index: f.index,
      team: f.team,
      name: f.name,
      alive: f.alive,
      blood: f.blood,
      consciousness: f.consciousness,
      wounds: f.wounds.map((w) => ({ part: w.part, type: w.type, severity: w.severity, bleed: w.bleed, ...(w.stump ? { stump: true } : {}) })),
      causeOfDeath: f.causeOfDeath ?? null,
    })),
  };
}

/**
 * 조종 부르는 차례: 1 편 먼저, 편 안에서는 자리 차례, 사람 몸(human)을 조종하는 것은 맨 뒤.
 *  1:1 시뮬(fights12 — 상대 AI 다음에 자리 0 을 모는 AI)과 main.js(상대 AI 다음에 플레이어 비기 창 · 막기 단추)의 지금 차례와 같다.
 *  AI 를 만드는 차례도 이 차례로 한다 (AI 생성자의 Math.random 차례 — jelly_harness newMatch)
 */
export function orderControllers(list) {
  const key = (c) => (c.me.human ? 100 : 0) + (1 - c.me.team) * 10 + c.me.index;
  return list.map((c, i) => [c, i]).sort((a, b) => key(a[0]) - key(b[0]) || a[1] - b[1]).map(([c]) => c);
}

/** f 의 상대 편 싸움꾼들 (자리 차례) */
export function foesOf(M, f) {
  return M.fighters.filter((g) => !sameSide(g, f));
}

/** 같은 편 (자기 빼고, 자리 차례) */
export function matesOf(M, f) {
  return M.fighters.filter((g) => g !== f && sameSide(g, f));
}

/** 가장 가까운(가슴 수평 거리) 상대. alive 면 산 상대만 — 없으면 null */
export function nearestFoe(M, f, { alive = true } = {}) {
  const c = f.bodies.chest.translation();
  let best = null;
  let bd = Infinity;
  for (const g of M.fighters) {
    if (sameSide(g, f) || (alive && !g.alive)) continue;
    const p = g.bodies.chest.translation();
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < bd) (bd = d), (best = g);
  }
  return best;
}

/**
 * 짝 상대 고르기 (foeOf 를 안 줬을 때 1:1 의 기본 — 다른 하나, 예전 그대로). 셋 이상 판의 기본은 targeting.js chooseTarget 이고 이것은 1단계 임시 규칙(비교용 — team_perf --target=pair):
 *  마주 선 짝(자리 0 ↔ 1 · 2 ↔ 3)이 살아 있으면 그 짝, 아니면 가장 가까운 산 상대, 모두 죽었으면 지금 상대 그대로
 */
export function pairFoe(f, M) {
  const F = M.fighters;
  if (F.length === 2) return F[1 - f.index];
  const mate = F[f.index ^ 1];
  if (mate && mate.alive && !sameSide(mate, f)) return mate;
  return nearestFoe(M, f) ?? f.foe ?? nearestFoe(M, f, { alive: false });
}

/**
 * 죽은 몸 쉬게 하기 (3단계 10/29 — 셋 이상 판 · TEAM_FIGHT.deadSettle): 죽은 지 t 넘게 몸 부위 빠르기가 모두 v 밑이면 f.settled —
 *  그 뒤로 조종 · 스텝을 건너뛰고(그림 · 칼 잔상 · 바람 소리도 main.js · sword_trail.js 가 쉼) 몸 부위를 재운다(엔진이 셈에서 뺌 · 다른 몸이 닿으면 엔진이 깨운다)
 */
export function settleDead(f, dt) {
  if (f.settled || f.alive) return;
  f.deadT = (f.deadT ?? 0) + dt;
  const D = TEAM_FIGHT.deadSettle;
  if (f.deadT < D.t) return;
  for (const k in f.bodies) {
    const v = f.bodies[k].linvel();
    if (v.x * v.x + v.y * v.y + v.z * v.z > D.v * D.v) return;
  }
  f.settled = true;
  for (const k in f.bodies) f.bodies[k].sleep();
  f.sword?.sleep();
}

/** 편마다 산(죽지 않은) 싸움꾼 수 [0 편, 1 편] — 한 편이 0 이면 판 끝 (stepMatch) */
export function standing(M) {
  const n = [0, 0];
  for (const f of M.fighters) if (f.alive) n[f.team]++;
  return n;
}

/**
 * 시작 자리 (평지 · 원점 둘레). teams[i] = 자리 i 의 편 (안 주면 자리의 홀짝). 0 편은 x = −gap/2 에서 +x 를, 1 편은 +gap/2 에서 −x 를 본다.
 *  한 편에 둘이면 옆(z)으로 mateGap 만큼 벌린다 — 편 안 첫째(자리 0 · 1)가 −z 쪽이라 0 ↔ 1 · 2 ↔ 3 이 마주 선다. 혼자면 z 0 (1:1 은 예전 자리 그대로)
 */
export function spawnSpots(count, { gap, mateGap, teams = null } = {}) {
  const team = (i) => (teams ? teams[i] : teamOfIndex(i));
  const size = [0, 0];
  for (let i = 0; i < count; i++) size[team(i)]++;
  const seen = [0, 0];
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = team(i);
    const k = seen[t]++;
    const z = size[t] > 1 ? (k - (size[t] - 1) / 2) * mateGap : 0;
    out.push({ x: t === 0 ? -gap / 2 : gap / 2, z, heading: t === 0 ? 0 : Math.PI, team: t });
  }
  return out;
}

/**
 * 물리 한 스텝 (위 ①~④). hooks(모두 없어도 됨):
 *  faceOf(f, M) → 바라볼 점 (없으면 상대 골반) · afterControl(M, dt) — 조종 뒤 몸 전 (main.js 플레이어 비기 창 · 막기 단추 · 시뮬 G.before) ·
 *  afterFighters(M, dt) — 몸 스텝 뒤 cacheState 전 (main.js tickDebris) · afterWorld(M, dt) — 전투 뒤 (용암 화상 · 칼 잔상 띠)
 */
export function stepMatch(M, dt, hooks = {}) {
  const F = M.fighters;
  const foeOf = M.foeOf || pairFoe;
  // ① 상대 · 바라볼 곳 (모두 정한 뒤 바라볼 곳 — 1:1 의 예전 차례)
  for (const f of F) f.foe = foeOf(f, M, dt);
  for (const f of F) {
    const t = hooks.faceOf?.(f, M) ?? f.foe?.bodies.pelvis.translation();
    if (t) f.faceTarget = t;
  }
  for (const c of M.order) if (c.setFoe && c.me.foe && c.foe !== c.me.foe) c.setFoe(c.me.foe);
  // ② 조종
  const team = F.length > 2; // 셋 이상 판만: 쉬는 죽은 몸(f.settled — 아래 settleDead)은 조종 · 스텝을 건너뛴다 (1:1 은 예전 그대로 모두)
  for (const c of M.order) if (!(team && c.me.settled)) c.update(dt);
  hooks.afterControl?.(M, dt);
  // ③ 몸
  for (const f of F) if (!(team && f.settled)) f.step(dt);
  hooks.afterFighters?.(M, dt);
  for (const f of F) f.cacheState();
  // ④ 물리 · 전투
  M.world.step(M.eventQueue, M.combat.physicsHooks);
  M.combat.afterStep(M.world, M.eventQueue);
  hooks.afterWorld?.(M, dt);
  if (team) for (const f of F) settleDead(f, dt);
  M.t += dt;
  // 판 끝: 한 편에 산 싸움꾼이 없다 (죽은 싸움꾼은 빠짐 — 사장님 10/29 '이번 대회만 빠짐'). 읽기만 — 스텝을 멈추는 것은 부르는 쪽
  if (!M.over) {
    const n = standing(M);
    if (n[0] === 0 || n[1] === 0) (M.over = true), (M.endT = M.t), (M.winner = n[0] ? 0 : n[1] ? 1 : null);
  }
}
