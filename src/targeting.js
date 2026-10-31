// ─────────────────────────────────────────────────────────────
//  상대 고르기 — 2:2 · 2:1 동시 대전 2단계 (사장님 10/29 14:2x 생사전 · docs/strike/team_fight_2026-10-29.md §8)
//
//  난수 없음 (같은 판 = 같은 고름). 점수 = 가슴 수평 거리(m) + 더함 · 뺌, 낮을수록 고름 (같으면 작은 자리):
//   + downAdd   쓰러진(서 있지 않은) 상대 — 다른 상대가 downNear 안에 서 있으면 (서 있는 상대 먼저)
//   + allyAdd   내 편이 이미 겨눈 상대 하나마다 (나눠 맡기)
//   − attackSub 나를 겨눠 제 칼끝 거리(reach) 안에서 치고 있는 상대
//   + 인물 취향  f.targetPref ('weakest' · 'strongest' · 'allyAttacker' · 'nearest') × prefAdd — 갈고리만 (인물 시트가 아직 안 채움)
//  바꾸는 때: 지금 상대가 죽었거나 부활하는 중이면 곧장 (붙잡고 있어도 — 죽은 몸을 겨눌 까닭이 없다).
//   그 밖엔 다른 상대가 margin 넘게 낮은 채 hold 동안 이어지면. 나를 치고 있는 상대면 hold 를 기다리지 않는다 — 그 상대가 attackHold(실제 초 0.4) 동안 내리 쳤으면 (3단계 10/29 · 2877).
//   붙잡힘(committed — 공격 · 비기 · 칼끼리 맞댐 · 밀치기) 동안은 바꾸지 않는다.
//  값: config.js TEAM_FIGHT.target (모두 사장님 확인 전 — 확인표 2864 ~ 2869 · 2877)
// ─────────────────────────────────────────────────────────────
import { TEAM_FIGHT } from './config.js';
import { sameSide } from './team.js';
import { woundDegree } from './combat.js';

const hdist = (a, b) => {
  const p = a.bodies.chest.translation();
  const q = b.bodies.chest.translation();
  return Math.hypot(q.x - p.x, q.z - p.z);
};
/** 겨눌 수 있는 상대: 살아 있고 부활하는 중이 아님 */
export const targetable = (g) => !!g && g.alive && !g.revival;

/** 지금 치고 있나 (AI = 공격 꼴 · 비기 · 사람 = 기력 장부의 공격 · 휘두름 · 탭) */
export function isAttacking(g) {
  const c = g.aiCtl;
  if (c) return c.mode === 'attack' || !!c.secretRun;
  return !!g.stamina?.attacking || !!g.skill?.swinging || !!g.skill?.tap;
}

/** g 의 칼끝 거리 (AI 간격 M.reach · 없으면 검술 풀이의 간격) */
export const reachOf = (g) => g.aiCtl?.M?.reach ?? g.swordArt?.measure?.reach ?? 1.8;

/** g 가 f 를 겨눠 칼끝 거리 안에서 치고 있나 */
export function attacking(g, f) {
  return g.foe === f && targetable(g) && isAttacking(g) && hdist(g, f) <= reachOf(g);
}

/** 붙잡힘: 이 동안은 상대를 바꾸지 않는다 (공격 · 비기 · 칼끼리 맞댐 · 밀치기 — 쓰러진 상대 마무리는 AI 공격 꼴 · 사람 휘두름으로 들어간다) */
export function committed(f) {
  if (f.barge || f.skill?.sec || f.feel?.touching) return true;
  const c = f.aiCtl;
  if (c) return c.mode === 'attack' || c.mode === 'secret' || !!c.secretRun || !!c.bound;
  return !!f.stamina?.attacking || !!f.skill?.swinging || !!f.skill?.tap;
}

/** 인물 취향 덧셈 (m — 낮을수록 고름). 이름이 없거나 모르면 0 */
export const TARGET_PREFS = {
  nearest: () => 0,
  weakest: (M, f, g) => -TEAM_FIGHT.target.prefAdd * woundDegree(g), // 많이 다친 상대 먼저
  strongest: (M, f, g) => -TEAM_FIGHT.target.prefAdd * (1 - woundDegree(g)), // 덜 다친 상대 먼저
  allyAttacker: (M, f, g) => (M.fighters.some((m) => m !== f && sameSide(m, f) && m.alive && g.foe === m) ? -TEAM_FIGHT.target.prefAdd : 0), // 내 편을 겨눈 상대 먼저
};

/** f 가 g 를 겨눌 점수 (m, 낮을수록 고름) — 읽기만 */
export function targetScore(M, f, g) {
  const T = TEAM_FIGHT.target;
  let s = hdist(f, g);
  if (g.state !== 'stand') {
    for (const h of M.fighters) if (h !== g && !sameSide(h, f) && targetable(h) && h.state === 'stand' && hdist(f, h) <= T.downNear) { s += T.downAdd; break; }
  }
  for (const m of M.fighters) if (m !== f && sameSide(m, f) && m.alive && m.foe === g) s += T.allyAdd;
  if (attacking(g, f)) s -= T.attackSub;
  const pref = f.targetPref && TARGET_PREFS[f.targetPref];
  if (pref) s += pref(M, f, g);
  return s;
}

/**
 * 상대 고르기 (src/match.js stepMatch 의 foeOf 자리 — createMatch 가 셋 이상 판에 건다). 판(M)마다 싸움꾼별 상태 M.targeting(Map):
 *  { foe(지금 상대), cand(바꿀 후보), held(후보가 이어진 시간 s), switches(바꾼 수), log? }
 */
export function chooseTarget(f, M, dt = 0) {
  const T = TEAM_FIGHT.target;
  const S = M.targeting ?? (M.targeting = new Map());
  let st = S.get(f);
  if (!st) S.set(f, (st = { foe: null, cand: null, held: 0, switches: 0, why: { gone: 0, attacked: 0, held: 0 }, atk: new Map() }));
  if (!f.alive) return st.foe ?? f.foe ?? null;
  if (T.attackHold > 0) for (const g of M.fighters) if (!sameSide(g, f)) { if (attacking(g, f)) st.atk.set(g, (st.atk.get(g) ?? 0) + dt); else st.atk.delete(g); } // '나를 침'이 이어진 시간 (멈추면 0 부터)
  let best = null;
  let bs = Infinity;
  let cur = Infinity;
  for (const g of M.fighters) {
    if (sameSide(g, f) || !targetable(g)) continue;
    const s = targetScore(M, f, g);
    if (g === st.foe) cur = s;
    if (s < bs) (bs = s), (best = g); // 같으면 먼저 본(작은) 자리
  }
  if (!best) return st.foe ?? f.foe ?? null; // 겨눌 상대가 없다 (판 끝) — 지금 상대 그대로
  const take = (g, why) => {
    if (st.foe && st.foe !== g) (st.switches++), st.why[why]++;
    st.foe = g;
    st.cand = null;
    st.held = 0;
  };
  if (!targetable(st.foe)) take(best, 'gone'); // 처음 · 죽음 · 부활 — 곧장
  else if (best !== st.foe) {
    if (committed(f) || cur - bs < T.margin) {
      st.cand = null;
      st.held = 0;
    } else {
      if (st.cand !== best) (st.cand = best), (st.held = 0);
      st.held += dt;
      if (attacking(best, f) && (T.attackHold <= 0 || (st.atk.get(best) ?? 0) >= T.attackHold)) take(best, 'attacked'); // 나를 치는 상대는 hold 를 기다리지 않는다 (attackHold 만큼 내리 쳤으면)
      else if (st.held >= T.hold) take(best, 'held');
    }
  } else (st.cand = null), (st.held = 0);
  return st.foe;
}
