// 생사전 규칙 (사장님 10/29 14:1x · 14:2x · 14:5x — 설계 docs/design/saengsa_2026-10-29.md): 대진표 만들기 · 경기 시각 · 상대끼리 경기 저절로 끝내기 · 기권 · 출전 고르기 ·
//  빠른 셈 · 결과 적기 · 쉬는 동안 회복 · 왕의 하사품.
//  순수 함수 — 인물 · 무기 자료는 부르는 쪽이 넘긴다(src/saengsa_roster.js · 시험 tools/sim/saengsa.test.mjs 는 가짜 자료). 값은 config.js SAENGSA 한 곳.
//  대회 t = { v, day, seed, signedAt, teams: [{ mine, members: [사람] }], matches: [경기], status 'active' | 'done', champion, endedAt, chests }
//   사람 = { key '팀-자리', id(인물 id · 'player' · 'nameless'), weapon, school(그 무기 유파), tier(무기 등급), prof { german … chinese (, none) }, hp, injuries [부상], dead,
//          cloth · tag · main · sub(무명 검객만 — 옷 색 줄 번호 · 붙인 이름 · 메인 · 보조 유파 — 대회마다 새로 만든다, makeNameless) · sig(상대 팀 인물만 — 전용무기 id) }
//   내 팀 무기 = 내가 배정(신청 때 · 경기마다 — 사장님 10/29 18:2x · assignWeapons). 입장 조건 = entryMissing (호칭 · 가진 무기 수)
//   부러진 무기 (사장님 10/29 20:1x): 사람 broken(지금 든 무기가 부러짐) · 내 팀 = 대회 t.broken [무기 id] · 상대 팀 = pool[].broken — 대회 끝까지 그대로 · 결과 fighters[key].broken
//   상대 팀 = { mine false, members, pool: [{ weapon, school, tier }] } — 무기 다섯(전용무기 + 카드 확률 뽑기 · ??? 뺌 — 사장님 10/29 19:5x · makePool) · 사람 무기 = aiArm(신청 때 · 경기 뒤마다)
//  시험판(cfg.testMode — 사장님 10/29 17:5x): 신청 창 늘 열림 · 내 경기는 두 팀을 알면 바로 · 상대끼리 경기는 앞 대진이 다 끝나면 바로 · 쉬는 시간 · 대진 시각 · 기권 없음 · 결과 시각 = 셈한 때
//   부상 = { part 'arm' | 'leg' | 'torso' | 'head', sev(상처 심각도 — combat.js 와 같은 잣대), rests(다친 뒤 쉰 수) } · 중상 = sev ≥ SAENGSA.seriousAt
//   팀 0 = 내 팀(자리 0 = 나) · 대진표 자리는 씨앗으로 섞는다 · 첫 대진 경기만 a · b(팀 번호)를 적고, 다음 대진은 앞 두 경기의 이긴 팀(sidesOf).
//  경기 = { id 'r<대진>m<번호>', round, index, a, b, result } · 결과 = { at(저장 시각), winner 'a' | 'b', entrants { a: [key], b: [key] }, fighters { key: { hp, injuries, alive } },
//   by 'quick' | 'engine' | 'forfeit', seed, ver, pre { a: [사람], b: [사람] } } — seed · entrants · pre(경기 전 두 팀) · ver 는 2단계 다시보기 몫(사장님 10/29 14:5x — 같은 씨앗 · 같은 판으로 다시 셈).
//   2단계 엔진(실제 2:2 싸움)도 같은 꼴을 돌려준다(matchSetup → 엔진 → finishMine · 설계 §8).
import { SAENGSA } from './config.js';
import { roundAt, restUntil, startAt, signupWindow, windowOf, shiftDay } from './saengsa_clock.js';
import { NAMELESS_NAMES } from './saengsa_names.js';

export const SCHOOLS5 = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese']);
/** 무명 검객 인물 id (사장님 10/29 15:5x — 이름난 인물은 한 대회에 한 번씩 · 남는 자리를 채움 · 겉모습 saengsa_nameless.js) */
export const NAMELESS = 'nameless';
export const INJURY_PARTS = Object.freeze(['arm', 'leg', 'torso', 'head']);
/** 저장한 결과의 판 (다시보기가 같은 셈인지 가린다 — 빠른 셈 · 엔진 셈이 바뀌면 올린다) */
export const SAENGSA_VER = 'saengsa-1';

// ── 씨앗 난수 (게임 난수 Math.random 을 건드리지 않는다) ──
/** 글 · 수 묶음 → 32 비트 씨앗 (FNV-1a) */
export function hash32(...xs) {
  let h = 0x811c9dc5;
  for (const ch of xs.join('|')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** 씨앗 → [0, 1) 난수 (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOne = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
function shuffle(r, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 대진표 팀 수 = SAENGSA.teams 를 2 의 거듭제곱으로 내림 (2 이상) */
export const bracketTeams = (cfg = SAENGSA) => 2 ** Math.floor(Math.log2(Math.max(2, Math.floor(cfg.teams) || 2)));
/** 대진 수 (16 팀 = 4: 16강 · 8강 · 4강 · 결승) */
export const roundsOf = (teamCount) => Math.round(Math.log2(teamCount));

/**
 * 신청 → 대회 하나 (씨앗이 같으면 바이트까지 같은 대회).
 *  companions: 동료 둘 — 인물 id 또는 NAMELESS(무명 검객 — 둘 다여도 됨 · 옷 색 = 자리 1 → 줄 0 · 자리 2 → 줄 1, 고르기 칸 미리 보기와 같게)
 *  roster: 이름난 인물 id 목록 — 상대 팀에는 한 대회에 한 번씩만(내 동료는 뺌 · 사장님 10/29 15:5x): 팀을 섞은 차례로 한 팀에 한 명씩 돌려 넣고(16 팀이면 아홉 팀에 한 명씩)
 *   남는 자리는 무명 검객 — 옷 색은 팀마다 서로 다르게(씨앗)
 *  weapons: 내 팀 세 자리의 무기 [나, 동료 1, 동료 2] (내가 배정 — 사장님 10/29 18:2x) · 빈 자리(시험의 옛 꼴)는 drawWeapon(rnd) 무작위
 *  상대 팀: 무기 다섯 = makePool(전용무기 signatureOf(id) + drawPool(rnd, n, 이미 든 무기)) → aiArm 이 사람마다 나눠 줌 (사장님 10/29 19:5x)
 *  weaponInfo(id) → { school, tier } · profOf(인물 id) → { german … chinese, none }
 */
export function createTournament({ day, seed, at, companions, roster, weapons = [], broken = [], drawWeapon, drawPool = null, signatureOf = null, weaponInfo, profOf, cfg = SAENGSA }) {
  const sigOf = signatureOf ?? ((id) => cfg.signature?.[id] ?? null);
  const sigWeapons = new Set(Object.values(cfg.signature ?? {}));
  const n = bracketTeams(cfg), size = cfg.teamSize, r = rng(seed);
  const usedNames = new Set();
  const fighter = (team, slot, id, given = null, cloth = null) => {
    const f = { key: `${team}-${slot}`, id, weapon: null, school: null, tier: null, prof: { ...profOf(id) }, hp: cfg.hpMax, injuries: [], dead: false };
    if (team === 0) { const weapon = given ?? drawWeapon(r); Object.assign(f, { weapon }, pickInfo(weaponInfo(weapon))); if (broken.includes(weapon)) f.broken = true; } // 상대 팀 무기는 아래 aiArm
    if (id === NAMELESS) Object.assign(f, { cloth: cloth ?? 0 }, makeNameless(r, usedNames, cfg));
    else if (team !== 0 && sigOf(id) && !weapons.includes(sigOf(id))) f.sig = sigOf(id); // 내 팀이 그 전용무기를 들고 나오면 주인은 이번 대회 전용무기 없음(같은 무기 둘을 피함)
    return f;
  };
  const mineIds = ['player', ...companions].slice(0, size);
  const teams = [{ mine: true, members: mineIds.map((id, s) => fighter(0, s, id, weapons[s] ?? null, s - 1)) }];
  // 상대 팀: 이름난 인물은 한 번씩만 — 섞은 팀 차례로 한 팀에 한 명씩 돌려 넣고(다 돌면 둘째 자리) · 남는 자리는 무명 검객
  const named = shuffle(r, roster.filter((id) => id !== NAMELESS && !mineIds.includes(id)));
  // 무작위로 뽑지 않는 전용무기 (사장님 10/29 22:3x — 한 대회에 같은 전용무기 둘 없음): 이번 대회에 나온 인물(내 동료 포함)의 전용무기 · 내 팀이 든 전용무기
  //  (주인이 없는 대회에서는 그 무기도 보통 무기처럼 뽑힐 수 있다)
  const reserved = [...new Set([...[...mineIds, ...named].map(sigOf).filter(Boolean), ...weapons.filter((w) => sigWeapons.has(w))])];
  const lineup = Array.from({ length: n - 1 }, () => []);
  const teamOrder = shuffle(r, lineup.map((_, i) => i));
  for (let s = 0, k = 0; s < size && k < named.length; s++) for (const ti of teamOrder) if (k < named.length) lineup[ti].push(named[k++]);
  lineup.forEach((ids, i) => {
    const cloths = shuffle(r, Array.from({ length: cfg.nameless.cloth.length }, (_, c) => c)); // 한 팀 안에서는 옷 색이 서로 다르게
    let c = 0;
    while (ids.length < size) ids.push(NAMELESS);
    const team = { mine: false, members: ids.map((id, s) => fighter(i + 1, s, id, null, id === NAMELESS ? cloths[c++ % cloths.length] : null)) };
    team.pool = makePool(r, team.members, { drawPool, drawWeapon, weaponInfo, reserved }, cfg);
    aiArm(team, cfg);
    teams.push(team);
  });
  const seats = shuffle(r, teams.map((_, i) => i)); // 대진표 자리 → 팀 번호
  const matches = [];
  for (let rd = 0; rd < roundsOf(n); rd++) {
    for (let i = 0; i < n >> (rd + 1); i++) matches.push({ id: `r${rd}m${i}`, round: rd, index: i, a: rd ? null : seats[2 * i], b: rd ? null : seats[2 * i + 1], result: null });
  }
  return { v: 1, day, seed: seed >>> 0, signedAt: at, teams, matches, status: 'active', champion: null, endedAt: null, chests: null, broken: [...new Set(broken)] };
}

/**
 * 무명 검객 하나 (사장님 10/29 17:5x 대회마다 새로 · 18:2x 결정 숫자): 다섯 유파 저마다 other 범위(0) · 메인 유파(무작위) main 범위(0 ~ 2) ·
 *  보조 유파(무작위 — 메인과 같을 수 있고, 같으면 높은 쪽만 남아 한 유파만 높음) sub 범위(0 ~ 2) · 0 = 그 유파 못 씀 ·
 *  이름 = 메인 유파 문화의 이름 표에서(한 대회 안에서 되도록 안 겹침)
 *  돌려줌 { prof, main, sub, tag }
 */
export function makeNameless(r, used = new Set(), cfg = SAENGSA) {
  const N = cfg.nameless, int = ([lo, hi]) => lo + Math.min(hi - lo, Math.floor(r() * (hi - lo + 1)));
  const prof = Object.fromEntries(SCHOOLS5.map((s) => [s, int(N.other)]));
  const main = pickOne(r, SCHOOLS5), sub = pickOne(r, SCHOOLS5);
  const mainV = int(N.main), subV = int(N.sub);
  prof[main] = mainV;
  prof[sub] = sub === main ? Math.max(mainV, subV) : subV;
  const pool = NAMELESS_NAMES[main] ?? [], fresh = pool.filter((n) => !used.has(n));
  const tag = pickOne(r, fresh.length ? fresh : pool) ?? '';
  used.add(tag);
  return { prof, main, sub, tag };
}

const pickInfo = ({ school, tier, frag = 0 }) => ({ school, tier, frag }); // frag = 무기 파손률(충돌 한 번 — 빠른 셈 부러짐)
// ── 상대 팀 무기 다섯 · 나눠 주기 (사장님 10/29 19:5x — 'AI 팀에게도 랜덤 무기를 5개 지급해 … 가장 최적의 배분으로 스스로 판단해서 나눠주게 해') ──
/**
 * 그 팀의 무기 SAENGSA.aiPool.size 개: 사람들의 전용무기(f.sig — 겹치면 하나) 먼저 · 나머지는 drawPool(rnd, 모자란 수, 이미 든 무기)
 *  (부르는 쪽 — saengsa_roster.js — 이 카드 뽑기 확률에서 ??? 를 뺀 표로 서로 다르게 뽑는다) · drawPool 이 없으면 drawWeapon 을 겹치지 않게 되풀이. 돌려줌 [{ weapon, school, tier }]
 */
export function makePool(r, members, { drawPool = null, drawWeapon, weaponInfo, reserved = [] }, cfg = SAENGSA) {
  const size = cfg.aiPool.size;
  const ids = [...new Set(members.map((f) => f.sig).filter(Boolean))].slice(0, size);
  const skip = (w) => ids.includes(w) || reserved.includes(w); // reserved = 이 대회에서 무작위로 뽑지 않는 전용무기
  if (ids.length < size) {
    if (drawPool) ids.push(...drawPool(r, size - ids.length, [...ids, ...reserved]).filter((w) => !skip(w)));
    for (let k = 0; ids.length < size && k < 64; k++) { const w = drawWeapon(r); if (!skip(w)) ids.push(w); }
  }
  return ids.slice(0, size).map((weapon) => ({ weapon, ...pickInfo(weaponInfo(weapon)) }));
}
/**
 * 한 사람에게 한 무기를 줄 때의 점수 (config SAENGSA.aiArm — 확인 전):
 *  몸 상태 × (prof × 그 무기 유파 숙련도 + tier[등급] + 제 전용무기면 sig) − (숙련도 0 이면 zero)
 *  몸 상태 = 빠른 셈과 같은 체력 · 부상 몫(quick.hpFloor · injuryK) — 다친 사람은 좋은 무기 차례가 뒤로 · 숙련도 = profFor(무유파 무기 규칙 포함)
 */
export function armScore(f, w, cfg = SAENGSA) {
  const A = cfg.aiArm, q = cfg.quick;
  const prof = profFor({ prof: f.prof, school: w.school });
  const fit = (q.hpFloor + (1 - q.hpFloor) * Math.max(0, Math.min(cfg.hpMax, f.hp)) / cfg.hpMax) * (f.injuries ?? []).reduce((k, i) => k * (isSerious(i, cfg) ? q.injuryK.serious : q.injuryK.light), 1);
  return fit * (A.prof * prof + (A.tier[w.tier] ?? 0) + (f.sig && f.sig === w.weapon ? A.sig : 0) - (w.broken ? A.broken : 0)) - (prof <= 0 ? A.zero : 0);
}
/**
 * 상대 팀 무기 나눠 주기: 살아 있는 사람마다 무기 다섯(team.pool) 가운데 하나씩 — 점수(armScore) 합이 가장 큰 배분(5P3 = 60 가지를 다 셈 · 같으면 먼저 센 것).
 *  죽은 사람은 마지막 무기 그대로(그 무기도 산 사람이 쓸 수 있음). pool 이 없으면(옛 저장) 그대로. 돌려줌: 나눴나
 */
export function aiArm(team, cfg = SAENGSA) {
  const pool = team?.pool;
  if (!Array.isArray(pool) || !pool.length || team.mine) return false;
  const alive = team.members.filter((f) => !f.dead);
  const k = Math.min(alive.length, pool.length);
  const score = alive.map((f) => pool.map((w) => armScore(f, w, cfg)));
  let best = null, bestSum = -Infinity;
  const pick = [], used = new Array(pool.length).fill(false);
  (function walk(i, sum) {
    if (i === k) { if (sum > bestSum + 1e-9) { bestSum = sum; best = [...pick]; } return; }
    for (let j = 0; j < pool.length; j++) {
      if (used[j]) continue;
      used[j] = true; pick.push(j);
      walk(i + 1, sum + score[i][j]);
      pick.pop(); used[j] = false;
    }
  })(0, 0);
  (best ?? []).forEach((j, i) => { Object.assign(alive[i], { weapon: pool[j].weapon, school: pool[j].school, tier: pool[j].tier, frag: pool[j].frag ?? 0 }); if (pool[j].broken) alive[i].broken = true; else delete alive[i].broken; });
  return !!best;
}

// ── 입장 조건 · 무기 배정 (사장님 10/29 18:2x) ──
/** 입장(신청) 조건에서 모자란 것: [{ kind 'title' }, { kind 'weapons', have, need }] — 빈 목록이면 됨. hasTitle = 호칭(cfg.entry.title)을 가졌나 · owned = 가진 무기 수 */
export function entryMissing({ hasTitle, owned }, cfg = SAENGSA) {
  const out = [];
  if (!hasTitle) out.push({ kind: 'title' });
  if (!(owned >= cfg.entry.weapons)) out.push({ kind: 'weapons', have: owned | 0, need: cfg.entry.weapons });
  return out;
}
/** 배정이 맞나: 자리마다(only 의 자리만) 가진 무기 · assignUnique 면 서로 다르게 */
export function validAssignment(weapons, owned, only = [0, 1, 2], cfg = SAENGSA) {
  if (!Array.isArray(weapons)) return false;
  const used = only.map((i) => weapons[i]);
  if (!used.every((w) => typeof w === 'string' && owned.includes(w))) return false;
  return !cfg.assignUnique || new Set(used).size === used.length;
}
/** 상대 팀 무기 다섯에 든 전용무기 (내 팀이 대회 도중에 쓸 수 없음 — 한 대회에 같은 전용무기 둘 없음 · 사장님 10/29 22:3x) */
export function lockedSignatures(t, cfg = SAENGSA) {
  const sig = new Set(Object.values(cfg.signature ?? {}));
  return new Set((t?.teams ?? []).filter((x) => !x.mine).flatMap((x) => (x.pool ?? []).map((w) => w.weapon)).filter((w) => sig.has(w)));
}
/** 경기 전 내 팀 무기 바꾸기 (살아 있는 사람만 — 죽은 사람은 그대로): weapons [나, 동료 1, 동료 2] · 돌려줌: 바꿨나(틀리면 아무것도 안 바꿈) */
export function assignWeapons(t, weapons, { owned, weaponInfo }, cfg = SAENGSA) {
  const members = t?.teams?.[0]?.members ?? [];
  const alive = members.map((f, i) => (f.dead ? -1 : i)).filter((i) => i >= 0);
  if (!validAssignment(weapons, owned, alive, cfg)) return false;
  const locked = lockedSignatures(t, cfg);
  if (alive.some((i) => locked.has(weapons[i]))) return false;
  const broken = new Set(t.broken ?? []);
  for (const i of alive) {
    const f = members[i], w = weapons[i];
    if (f.weapon !== w) Object.assign(f, { weapon: w }, pickInfo(weaponInfo(w)));
    if (broken.has(w)) f.broken = true; else delete f.broken; // 부러진 내 무기는 대회 끝까지 부러진 채 (사장님 10/29 20:1x)
  }
  return true;
}

// ── 대진표 읽기 ──
export const matchById = (t, id) => t.matches.find((m) => m.id === id) ?? null;
const matchAt = (t, round, index) => t.matches.find((m) => m.round === round && m.index === index) ?? null;
/** 이 경기의 두 팀 [a, b] (팀 번호 · 아직 모르면 null) */
export function sidesOf(t, m) {
  if (!m.round) return [m.a, m.b];
  return [winnerOf(t, matchAt(t, m.round - 1, 2 * m.index)), winnerOf(t, matchAt(t, m.round - 1, 2 * m.index + 1))];
}
/** 이긴 팀 번호 (끝나지 않았으면 null) */
export function winnerOf(t, m) {
  if (!m?.result) return null;
  return sidesOf(t, m)[m.result.winner === 'a' ? 0 : 1];
}
/** 대진표 자리 차례의 팀 번호 (첫 대진 a, b, a, b … — 화면의 '1번 팀' … 이름) */
export const seatOrder = (t) => t.matches.filter((m) => m.round === 0).flatMap((m) => [m.a, m.b]);
/** 그 팀이 이 대진(round) 앞에서 마지막으로 결과를 저장한 시각 (없으면 null) */
function lastResultAt(t, team, round) {
  let at = null;
  for (const m of t.matches) if (m.round < round && m.result && sidesOf(t, m).includes(team)) at = Math.max(at ?? -Infinity, m.result.at);
  return at;
}
/** 앞 대진이 다 끝났나 (시험판의 상대끼리 경기 차례) */
const roundDone = (t, round) => t.matches.every((m) => m.round !== round || m.result);
/**
 * 이 경기를 시작할 수 있는 시각 = max(대진 시각, 두 팀 저마다 마지막 결과 + 쉬는 시간) · 두 팀을 아직 모르면 null
 *  시험판: 시각 없음 — 내 경기는 두 팀을 알면 0(바로) · 상대끼리 경기는 앞 대진이 다 끝나야 0 (아니면 null)
 */
export function readyAt(t, m, cfg = SAENGSA) {
  const [A, B] = sidesOf(t, m);
  if (A == null || B == null) return null;
  if (cfg.testMode) return isMine(t, m) || m.round === 0 || roundDone(t, m.round - 1) ? 0 : null;
  let at = roundAt(t.day, m.round, cfg);
  for (const team of [A, B]) {
    const last = lastResultAt(t, team, m.round);
    if (last != null) at = Math.max(at, restUntil(last, cfg));
  }
  return at;
}
/** 내 경기 마감 = 다음 신청 창이 열리는 때(대회 날 밤 10시 — 사장님 10/29 14:5x). 이때까지 하지 않은 내 경기는 기권 */
export const deadlineOf = (t, cfg = SAENGSA) => windowOf(shiftDay(t.day, 1), cfg).from;
/** 내 팀이 든 경기인가 */
export const isMine = (t, m) => sidesOf(t, m).includes(0);
/**
 * 경기 상태: 'done' 끝 · 'wait' 앞 경기를 기다림 · 'soon' 시각 전(또는 쉬는 중) · 'ready' 내 경기 — 지금 싸울 수 있음 · 'due' 다음 셈(advance)에 끝남(상대끼리 · 마감 지난 내 경기)
 */
export function matchState(t, m, now, cfg = SAENGSA) {
  if (m.result) return 'done';
  const at = readyAt(t, m, cfg);
  if (at == null) return 'wait';
  if (now < at) return 'soon';
  return isMine(t, m) && (cfg.testMode || now < deadlineOf(t, cfg)) ? 'ready' : 'due';
}
/** 내 팀이 떨어졌나 */
export const myTeamOut = (t) => !!t && t.matches.some((m) => m.result && sidesOf(t, m).includes(0) && winnerOf(t, m) !== 0);
/** 내 팀의 다음 경기 (졌거나 대회가 끝났으면 null) */
export function myMatch(t) {
  if (!t || t.status === 'done' || myTeamOut(t)) return null;
  return t.matches.find((m) => !m.result && isMine(t, m)) ?? null;
}

// ── 부상 ──
/** 중상인가 (대회 동안 낫지 않음) */
export const isSerious = (inj, cfg = SAENGSA) => inj.sev >= cfg.seriousAt;
/** 부상 더하기: 같은 부위에 이미 있으면 더 깊은 쪽 심각도로 · 쉰 수는 0 부터 */
function addInjury(list, part, sev) {
  const out = list.map((i) => ({ ...i }));
  const old = out.find((i) => i.part === part);
  if (old) { old.sev = Math.max(old.sev, sev); old.rests = 0; } else out.push({ part, sev, rests: 0 });
  return out;
}
/** 2단계: 실제 싸움 상처(fighter.wounds — { part, severity }) → 부상 (woundMin 아래 긁힘은 뺌 · 몸 부위 → 넷) */
const WOUND_PART = { head: 'head', neck: 'head', chest: 'torso', abdomen: 'torso', pelvis: 'torso', uarmS: 'arm', uarmO: 'arm', farmS: 'arm', farmO: 'arm', thighF: 'leg', thighB: 'leg', shinF: 'leg', shinB: 'leg', footF: 'leg', footB: 'leg' };
export function injuriesFromWounds(prior, wounds, cfg = SAENGSA) {
  let out = (prior ?? []).map((i) => ({ ...i }));
  for (const w of wounds ?? []) {
    const part = WOUND_PART[w.part];
    if (part && w.severity >= cfg.woundMin) out = addInjury(out, part, w.severity);
  }
  return out;
}
/** 한 번 쉼 (이긴 팀 — 경기와 경기 사이): 살아 있는 사람 체력 + restHeal · 경상은 쉰 수 + 1 → lightRests 이면 나음 · 중상은 그대로 (사장님 10/29 14:5x) */
function rest(members, cfg) {
  for (const f of members) {
    if (f.dead) continue;
    f.hp = Math.min(cfg.hpMax, f.hp + cfg.restHeal);
    f.injuries = f.injuries.map((i) => (isSerious(i, cfg) ? i : { ...i, rests: i.rests + 1 })).filter((i) => isSerious(i, cfg) || i.rests < cfg.lightRests);
  }
}

// ── 빠른 셈 ──
/** 그 무기를 든 숙련도: 무기 유파 칸 · 무유파 무기인데 none 칸이 없으면(주 유파가 무유파가 아닌 사람) 다섯 유파 가운데 가장 높은 값 − 1 (확인 전 · 확인표 2799) */
export function profFor(f) {
  const p = f?.prof ?? {};
  if (p[f?.school] != null) return p[f.school];
  if (f?.school !== 'none') return 0;
  return Math.max(0, Math.max(0, ...SCHOOLS5.map((s) => p[s] ?? 0)) - 1);
}
/** 한 사람의 힘 (config SAENGSA.quick): 그 무기 유파 숙련도 · 무기 등급 · 남은 체력 · 부상(경상 · 중상) */
export function power(f, cfg = SAENGSA) {
  if (!f || f.dead) return 0;
  const q = cfg.quick;
  const prof = profFor(f);
  const hpK = q.hpFloor + (1 - q.hpFloor) * Math.max(0, Math.min(cfg.hpMax, f.hp)) / cfg.hpMax;
  const injK = (f.injuries ?? []).reduce((k, i) => k * (isSerious(i, cfg) ? q.injuryK.serious : q.injuryK.light), 1);
  return (q.profBase + q.profStep * prof) * (q.tierK[f.tier] ?? 1) * hpK * injK * (f.broken ? q.brokenK : 1);
}
/** 나서는 쪽의 힘 (둘이면 합 × pairK) */
export function sidePower(list, cfg = SAENGSA) {
  const sum = list.reduce((s, f) => s + power(f, cfg), 0);
  return list.length > 1 ? sum * cfg.quick.pairK : sum;
}
/** a 쪽이 이길 확률 */
export function winChance(a, b, cfg = SAENGSA) {
  const pa = sidePower(a, cfg) ** cfg.quick.sharp, pb = sidePower(b, cfg) ** cfg.quick.sharp;
  return pa + pb > 0 ? pa / (pa + pb) : 0.5;
}
/**
 * 빠른 셈 한 판 (씨앗 고정 — 같은 입력 · 같은 씨앗이면 늘 같은 결과): sides { a: [사람], b: [사람] } → { winner, fighters: { key: { hp, injuries, alive } } }
 *  진 쪽은 loseDmg · 이긴 쪽은 winDmg × (0.5 + 0.5 × 팽팽함) 만큼 체력을 잃고 · 경기마다 injury 확률로 새 부상 하나(심각도 injurySev) · 체력 0 = 죽음.
 *  이긴 쪽은 적어도 한 사람이 산다(모두 0 이 되면 남은 체력이 가장 많던 사람이 체력 1 로)
 */
export function quickResolve(sides, seed, cfg = SAENGSA) {
  const q = cfg.quick, r = rng(seed);
  const pa = winChance(sides.a, sides.b, cfg);
  const winner = r() < pa ? 'a' : 'b';
  const close = 1 - Math.abs(2 * pa - 1);
  const fighters = {};
  for (const side of ['a', 'b']) {
    const won = side === winner;
    const [lo, hi] = won ? q.winDmg : q.loseDmg;
    for (const f of sides[side]) {
      const dmg = Math.round((lo + (hi - lo) * r()) * (won ? 0.5 + 0.5 * close : 1));
      let injuries = (f.injuries ?? []).map((i) => ({ ...i }));
      if (r() < (won ? q.injury.win : q.injury.lose)) {
        const part = pickOne(r, INJURY_PARTS);
        injuries = addInjury(injuries, part, Math.round((q.injurySev[0] + (q.injurySev[1] - q.injurySev[0]) * r()) * 100) / 100);
      }
      const hp = Math.max(0, f.hp - dmg);
      fighters[f.key] = { hp, injuries, alive: hp > 0 };
    }
  }
  const team = sides[winner];
  if (team.length && team.every((f) => !fighters[f.key].alive)) {
    const best = team.reduce((x, y) => (y.hp > x.hp ? y : x));
    fighters[best.key] = { ...fighters[best.key], hp: 1, alive: true };
  }
  // 무기 부러짐 (사장님 10/29 20:1x — 앞 난수 다음에 굴려 승패 · 체력 · 부상은 전과 같음): 나선 사람마다 1 − (1 − 파손률)^breakClashes · 이미 부러졌으면 그대로
  for (const side of ['a', 'b']) {
    for (const f of sides[side]) {
      const p = 1 - (1 - Math.max(0, Math.min(1, f.frag ?? 0))) ** q.breakClashes;
      if (f.broken || (p > 0 && r() < p)) fighters[f.key].broken = true;
    }
  }
  return { winner, fighters };
}
/** 상대 팀이 내보낼 사람 (가린 채 고름 — 내 고름을 보지 않는다 · 사장님 10/29 14:5x): 체력 aiPairHp 이상이 둘 이상이면 가장 센 둘 · 아니면 가장 센 하나 */
export function aiPick(members, cfg = SAENGSA) {
  const alive = members.filter((f) => !f.dead).sort((x, y) => power(y, cfg) - power(x, cfg) || (x.key < y.key ? -1 : 1));
  const fit = alive.filter((f) => f.hp >= cfg.aiPairHp);
  return (fit.length >= 2 ? fit.slice(0, cfg.entrantsMax) : alive.slice(0, 1)).map((f) => f.key);
}

// ── 결과 적기 ──
/**
 * 결과를 대회에 적는다: 경기 결과(다시보기 몫 seed · ver · 경기 전 두 팀 pre 와 함께) · 두 팀 사람 상태(체력 · 부상 · 죽음) ·
 *  이긴 팀은 다음 경기까지 한 번 쉰다(rest) · 결승이면 대회 끝
 */
export function applyResult(t, m, { winner, fighters, entrants, by = 'quick' }, at, cfg = SAENGSA) {
  const [A, B] = sidesOf(t, m);
  const pre = { a: structuredClone(t.teams[A].members), b: structuredClone(t.teams[B].members) };
  m.result = { at, winner, entrants: { a: [...entrants.a], b: [...entrants.b] }, fighters: structuredClone(fighters), by, seed: hash32(t.seed, m.id), ver: SAENGSA_VER, pre };
  if (t.resume?.matchId === m.id) delete t.resume; // 끝난 경기는 이어받을 몸이 없다 (SAENGSA.resumeState — 결과 · 기권 · 빠른 셈 모두)
  for (const team of [A, B]) {
    for (const f of t.teams[team].members) {
      const o = fighters[f.key];
      if (!o) continue;
      f.hp = o.hp; f.injuries = o.injuries.map((i) => ({ ...i, sev: Math.max(0, Math.min(1, i.sev)) })); f.dead = !o.alive; // 실제 싸움 상처 심각도는 1 을 넘을 수 있다(2단계 — 2.23 까지) → 0 ~ 1
      if (o.broken) { // 부러진 무기는 대회 끝까지 (사장님 10/29 20:1x): 내 팀 = t.broken · 상대 팀 = 무기 다섯의 그 줄
        f.broken = true;
        if (t.teams[team].mine) t.broken = [...new Set([...(t.broken ?? []), f.weapon])];
        else for (const w of t.teams[team].pool ?? []) if (w.weapon === f.weapon) w.broken = true;
      }
    }
  }
  const W = winner === 'a' ? A : B;
  if (m.round < roundsOf(t.teams.length) - 1) { rest(t.teams[W].members, cfg); aiArm(t.teams[W], cfg); } // 이긴 상대 팀은 쉰 몸 · 죽음에 맞춰 무기를 다시 나눔 (사장님 10/29 19:5x)
  else { t.status = 'done'; t.champion = W; t.endedAt = at; }
  return m.result;
}
const membersOf = (t, team, keys) => keys.map((k) => t.teams[team].members.find((f) => f.key === k)).filter(Boolean);
/**
 * 지금까지 끝날 경기를 저절로 끝낸다 (대진 차례대로): 상대끼리 경기 = 빠른 셈(결과 시각 = 그 경기를 시작할 수 있던 시각) ·
 *  마감(deadlineOf)까지 하지 않은 내 경기 = 기권(결과 시각 = 마감과 시작할 수 있던 시각 중 늦은 쪽 · 체력 · 부상 그대로). 돌려줌: 끝낸 경기 수
 */
export function advance(t, now, cfg = SAENGSA) {
  if (!t || t.status === 'done') return 0;
  const deadline = cfg.testMode ? Infinity : deadlineOf(t, cfg); // 시험판은 기권 없음
  const dueAt = (m) => {
    const at = readyAt(t, m, cfg);
    if (at == null) return Infinity;
    if (isMine(t, m)) return cfg.testMode ? Infinity : Math.max(at, deadline);
    return at;
  };
  let n = 0;
  for (;;) {
    const m = t.matches.find((x) => { if (x.result) return false; const d = dueAt(x); return Number.isFinite(d) && d <= now; }); // 끝없음(두 팀 모름 · 시험판 내 경기)은 now = Infinity 여도 끝내지 않음
    if (!m) break;
    const [A, B] = sidesOf(t, m), at = cfg.testMode ? now : dueAt(m); // 시험판은 셈한 때
    if (isMine(t, m)) {
      const mineSide = A === 0 ? 'a' : 'b';
      applyResult(t, m, { winner: mineSide === 'a' ? 'b' : 'a', fighters: {}, entrants: { a: [], b: [] }, by: 'forfeit' }, at, cfg);
    } else {
      const entrants = { a: aiPick(t.teams[A].members, cfg), b: aiPick(t.teams[B].members, cfg) };
      const res = quickResolve({ a: membersOf(t, A, entrants.a), b: membersOf(t, B, entrants.b) }, hash32(t.seed, m.id), cfg);
      applyResult(t, m, { ...res, entrants, by: 'quick' }, at, cfg);
    }
    n++;
    if (t.status === 'done') break;
  }
  return n;
}
/** 내가 고른 사람이 맞나 (내 팀 · 살아 있음 · 1 ~ entrantsMax · 겹치지 않음) */
export function validPicks(t, picks, cfg = SAENGSA) {
  if (!Array.isArray(picks) || picks.length < 1 || picks.length > cfg.entrantsMax || new Set(picks).size !== picks.length) return false;
  return picks.every((k) => t.teams[0].members.some((f) => f.key === k && !f.dead));
}
/**
 * 내 경기 판 (2단계 엔진에 넘기는 꼴 — 설계 §8): { matchId, round, seed, mineSide, sides: { a: [사람], b: [사람] }, entrants: { a, b }, control }
 *  control = 'player'(내가 나섬 — 내 몸은 내가 · 함께 나선 동료는 AI) · 'watch'(동료만 — 지켜봄) (사장님 10/29 14:2x · 14:5x).
 *  상대 고름은 여기서(내 고름과 무관 — 가린 채 함께 고르고 입장 때 함께 보임). 지금 싸울 수 없으면(내 경기가 아님 · 시각 전 · 마감 뒤 · 고름이 틀림) null
 */
export function matchSetup(t, m, picks, now, cfg = SAENGSA) {
  if (!m || m.result || myMatch(t)?.id !== m.id || matchState(t, m, now, cfg) !== 'ready' || !validPicks(t, picks, cfg)) return null;
  const [A, B] = sidesOf(t, m), mineSide = A === 0 ? 'a' : 'b', foe = mineSide === 'a' ? B : A;
  const entrants = { [mineSide]: [...picks], [mineSide === 'a' ? 'b' : 'a']: aiPick(t.teams[foe].members, cfg) };
  const team = (side) => (side === 'a' ? A : B);
  return {
    matchId: m.id, round: m.round, seed: hash32(t.seed, m.id), mineSide, entrants,
    sides: { a: structuredClone(membersOf(t, team('a'), entrants.a)), b: structuredClone(membersOf(t, team('b'), entrants.b)) },
    control: picks.includes('0-0') ? 'player' : 'watch',
  };
}
/**
 * 이어받을 내 경기 몸 (SAENGSA.resumeState — 사장님 10/30 08:2x "몸 상태 이어받기 방랑 · 생사전 둘 다 켜."): 지금 내 경기의 사본이면 { v, matchId, picks, arms, bodies, at } · 아니면 null.
 *  picks = 나선 내 사람 열쇠 · arms = 그때 배정한 내 팀 무기 셋 · bodies = { 열쇠: 몸 사본 } (넷 — src/fight_snapshot.js)
 */
export function resumeOf(t, matchId, cfg = SAENGSA) {
  const R = t?.resume;
  if (!cfg.resumeState || !R || R.v !== 1 || R.matchId !== matchId || myMatch(t)?.id !== matchId) return null;
  if (!Array.isArray(R.picks) || !R.picks.length || !Array.isArray(R.arms) || !R.bodies || typeof R.bodies !== 'object') return null;
  return R;
}
/** 내 경기 결과 적기 (엔진 결과 — 없으면 빠른 셈). 저장 시각 = now (쉬는 시간이 여기서부터 — 사장님 10/29) · 돌려줌: 경기 결과 · 판이 틀리면 null */
export function finishMine(t, m, picks, now, engineResult = null, cfg = SAENGSA) {
  const setup = matchSetup(t, m, picks, now, cfg);
  if (!setup) return null;
  const res = engineResult ?? quickResolve(setup.sides, setup.seed, cfg);
  return applyResult(t, m, { winner: res.winner, fighters: res.fighters, entrants: setup.entrants, by: engineResult ? 'engine' : 'quick' }, now, cfg);
}

// ── 대회 자리 · 하사품 · 일정 ──
/** 내 팀이 오른 자리: 'champion' 우승 · 'final' 준우승 · 'semi' 4강 · 'first' 그 앞 · null 아직 */
export function placeOf(t) {
  if (!t) return null;
  if (t.champion === 0) return 'champion';
  const R = roundsOf(t.teams.length);
  const lost = t.matches.find((m) => m.result && sidesOf(t, m).includes(0) && winnerOf(t, m) !== 0);
  if (!lost) return null;
  return lost.round === R - 1 ? 'final' : lost.round === R - 2 ? 'semi' : 'first';
}
/** 열 수 있는 왕의 하사품 수 (대회가 끝났을 때 · 우승 셋 · 준우승 하나 — 사장님 10/29 14:5x) */
export const chestCount = (t, cfg = SAENGSA) => (t?.status === 'done' ? cfg.chests[placeOf(t)] ?? 0 : 0);
/** 하사품 열기 (씨앗 고정): 하사품마다 표(chestTable)에서 무게로 한 줄 → [{ kind, amount }] — 이미 열었거나 없으면 null */
export function openChests(t, cfg = SAENGSA) {
  const n = chestCount(t, cfg);
  if (!n || t.chests) return null;
  const table = cfg.chestTable, total = table.reduce((s, x) => s + x.weight, 0);
  return Array.from({ length: n }, (_, i) => {
    let u = rng(hash32(t.seed, 'chest', i))() * total;
    const row = table.find((x) => (u -= x.weight) < 0) ?? table[table.length - 1];
    return { kind: row.kind, amount: row.amount };
  });
}
/** 새로 신청할 수 있나: 신청 창이 열렸고 · 대회가 없거나 끝났거나 내 팀이 떨어졌고 · 그 창의 대회에 이미 들지 않았을 때 */
export function canSignUp(now, t, cfg = SAENGSA) {
  const w = signupWindow(now, cfg);
  return w.open && (!t || t.status === 'done' || myTeamOut(t)) && (cfg.testMode || t?.day !== w.day); // 시험판은 같은 날 몇 번이고
}
/**
 * 일정 상태 (대기실 칸 · 생사전 화면 머리줄): kind
 *  'signup' 신청 받는 중(until 창 닫힘) · 'waiting' 신청함 · 첫 대진 전(startAt) · 'running' 대회 진행 중 · 'done' 내 대회 끝 · 'closed' 신청 창 밖(opensAt 다음 창)
 */
export function scheduleState(now, t, cfg = SAENGSA) {
  const w = signupWindow(now, cfg);
  if (t && t.status !== 'done' && !myTeamOut(t)) {
    const s = startAt(t.day, cfg);
    return now < s && !cfg.testMode ? { kind: 'waiting', startAt: s } : { kind: 'running' };
  }
  if (canSignUp(now, t, cfg)) return { kind: 'signup', until: w.to, day: w.day };
  if (t && t.day === w.day && w.open) return { kind: 'waiting', startAt: startAt(t.day, cfg) };
  if (t && t.status !== 'done') return { kind: 'running' };
  return { kind: t ? 'done' : 'closed', opensAt: w.open ? signupWindow(w.to, cfg).from : w.from };
}
