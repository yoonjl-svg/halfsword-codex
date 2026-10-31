// ─────────────────────────────────────────────────────────────
//  생사전 ↔ 싸움 엔진 잇기 (동시 대전 3 · 6단계 — 10/29 · docs/strike/team_fight_2026-10-29.md §11)
//
//  생사전 쪽(가지 wk/saengsa — docs/design/saengsa_2026-10-29.md §8 · src/saengsa_engine.js makeEngine)이 부르는 꼴:
//   res = await game.launchSaengsa(setup)
//   setup = { matchId, round, seed, mineSide 'a'|'b', entrants { a: [key], b: [key] }, sides { a: [사람], b: [사람] }, control 'player' | 'watch' }
//    사람 = { key '팀-자리', id(인물 id · 'player' · 'nameless'), weapon(id 또는 { id, broken }), school, tier, prof { 유파: 숙련도 }, lent, hp 0~100, injuries [{ part 팔·다리·몸통·머리, sev, rests }], dead, cloth? }
//   res = { winner 'a'|'b', fighters { key: { hp, injuries, alive, weaponBroken } } } (나선 사람만) · 그만두고 나오면 null
//   부러진 무기는 그 대회 끝까지 부러진 채 (사장님 10/29 20:1x): 사람 broken: true (생사전 가지 꼴) 또는 weapon { id, broken: true } 면 처음부터 부러진 무기로 서고(fighter.js applySnapshot → breakWeapon) ·
//    판 끝 broken (= weaponBroken — 두 이름 다 적음)을 돌려준다
//   이름: 사람 name · 무명 검객은 '무명 검객 ' + tag (생사전 가지 saengsa_roster.js fighterName 과 같은 꼴)
//  이 파일은 그림 · 물리 없이 셈만 (Node 시험 tools/sim/saengsa_match.test.mjs). 판을 세우고 돌리는 것은 main.js launchSaengsa.
//
//  체력 ↔ 피: 체력 100 = 피 1 · 체력 0 = 쓰러져 죽는 문턱(VITALS.collapseBlood) — 판 끝 체력 = 그 사이의 몫(산 사람은 적어도 1).
//  부상 ↔ 상처: 들어올 때 부상 하나 = 그 부위의 닫힌 상처 하나(출혈 0 · carried 표시) — 팔다리 기능은 싸움 상처와 같은 셈(fighter.js WOUND_LIMB · LIMB_LOSS).
//   판 끝 부상 = injuriesFromWounds(경기 전 부상, 이 판에 새로 난 상처만) — carried 상처를 다시 세지 않는다(쉰 수가 0 으로 돌아가지 않게).
//  난수 없음 (같은 setup = 같은 판 꼴).
// ─────────────────────────────────────────────────────────────
import { VITALS } from './config.js';
import { WOUND_LIMB, LIMB_LOSS } from './fighter.js';

export const HP_MAX = 100;
/** 부상 부위(생사전 넷) → 들어올 때 상처를 놓을 몸 부위. 팔 · 다리는 칼을 안 든 쪽 · 뒷다리 (칼 쥔 팔이 처음부터 칼을 놓치지 않게 — 작업자 고름) */
export const INJURY_WOUND = Object.freeze({ arm: 'uarmO', leg: 'thighB', torso: 'abdomen', head: 'head' });

const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** 체력 0 ~ 100 → 피 (1 = 체력 100 · collapseBlood = 체력 0) */
export const bloodFromHp = (hp) => VITALS.collapseBlood + (1 - VITALS.collapseBlood) * clamp01((hp ?? HP_MAX) / HP_MAX);
/** 판 끝 체력: 죽었으면 0 · 살았으면 피의 몫(정수 · 적어도 1) */
export function hpFromFighter(f) {
  if (!f.alive) return 0;
  return Math.max(1, Math.min(HP_MAX, Math.round(((f.blood - VITALS.collapseBlood) / (1 - VITALS.collapseBlood)) * HP_MAX)));
}

/** 사람의 무기 칸 (id 문자열 또는 { id, broken }) → { id, broken } */
export const weaponOfPerson = (p) => (p?.weapon && typeof p.weapon === 'object' ? { id: p.weapon.id, broken: !!(p.weapon.broken || p.broken) } : { id: p?.weapon, broken: !!p?.broken });
/** 싸움 화면 이름: 사람 name · 무명 검객 = '무명 검객 ' + tag (붙인 이름) · 없으면 undefined (main.js teamName 이 인물 이름 · '무명 검객') */
export const nameOfPerson = (p) => p?.name ?? (p?.id === 'nameless' && p.tag ? `무명 검객 ${p.tag}` : undefined);

/** 사람(체력 · 부상 · 부러진 무기) → 싸움꾼 상태 사본 (fighter.js snapshot 꼴 — 판을 세울 때 applySnapshot) */
export function snapshotFromPerson(p) {
  const limbs = { armS: 1, armO: 1, legF: 1, legB: 1 };
  const wounds = [];
  for (const inj of p.injuries ?? []) {
    const part = INJURY_WOUND[inj.part];
    if (!part || !(inj.sev > 0)) continue;
    wounds.push({ part, type: 'cut', severity: inj.sev, bleed: 0, local: [0, 0, 0], carried: true });
    const limb = WOUND_LIMB[part];
    if (limb) limbs[limb] = Math.max(0, limbs[limb] - inj.sev * LIMB_LOSS);
  }
  return { v: 1, blood: bloodFromHp(p.hp), bleed: 0, consciousness: 1, pain: 0, limbs, wounds, weaponBroken: weaponOfPerson(p).broken };
}

/**
 * setup → 판 꼴 (main.js 가 이 꼴로 몸을 세운다): { matchId, seed, control, stage?, fighters: [자리 차례 { index, team, key, human, id, weapon, school, prof, cloth, snapshot, person }] }.
 *  자리: 내 편 = 0 편 · 상대 = 1 편. 자리 0 = 내 편 첫째(내가 나서면 나) · 1 = 상대 첫째 · 그다음 내 편 둘째 · 상대 둘째 차례로 (2:1 · 1:2 도 자리는 0 부터 빈틈없이 — 편은 칸에 적음).
 *  control 'player' 인데 내 사람('player' 인물 · 열쇠 '팀-0')이 없으면 지켜보기로 (그 판은 내 몸이 없다)
 */
export function specFromSetup(setup) {
  const mine = setup.mineSide === 'b' ? 'b' : 'a';
  const other = mine === 'a' ? 'b' : 'a';
  const persons = (side) => (setup.entrants?.[side] ?? []).map((k) => setup.sides?.[side]?.find((p) => p.key === k)).filter((p) => p && !p.dead);
  const A = persons(mine);
  const B = persons(other);
  const isMe = (p) => p.id === 'player';
  let human = setup.control === 'player' ? A.find(isMe) ?? null : null;
  if (human) A.splice(A.indexOf(human), 1), A.unshift(human);
  const seq = [];
  for (let k = 0; k < Math.max(A.length, B.length); k++) {
    if (A[k]) seq.push([A[k], 0]);
    if (B[k]) seq.push([B[k], 1]);
  }
  // 2:1 · 1:2 · 2:2 · 1:1 모두: 자리 차례 = [내 첫째, 상대 첫째, (내 둘째), (상대 둘째)] — 위 고리가 그 차례로 넣는다
  const fighters = seq.map(([p, team], index) => ({
    index, team, key: p.key, human: p === human, id: p.id, name: p === human ? undefined : nameOfPerson(p), weapon: weaponOfPerson(p).id, weaponBroken: weaponOfPerson(p).broken, school: p.school ?? null, prof: p.prof ?? null, cloth: p.cloth ?? null,
    snapshot: snapshotFromPerson(p), person: p,
  }));
  return { matchId: setup.matchId ?? null, seed: setup.seed ?? 0, control: human ? 'player' : 'watch', mineSide: mine, fighters };
}

/** 이 사람이 든 무기의 숙련도 — 생사전 쪽 profFor(saengsa_rules.js)와 같은 셈: 무기 유파 칸 · 그 칸이 없고 무유파 무기면 다섯 유파 가운데 가장 높은 값 − 1 · 그 밖엔 0 */
const SCHOOLS5 = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
export function profOfEntry(e) {
  const p = e?.prof ?? {};
  if (p[e?.school] != null) return p[e.school];
  if (e?.school !== 'none') return 0;
  return Math.max(0, Math.max(0, ...SCHOOLS5.map((s) => p[s] ?? 0)) - 1);
}

/**
 * 판 끝 → 생사전 결과 { winner 'a'|'b', fighters { key: { hp, injuries, alive, broken, weaponBroken } } } (broken = weaponBroken — 생사전 가지는 broken 을 읽음).
 *  winnerTeam = 이긴 편(0 = 내 편 · 1 = 상대 · null = 둘 다 쓰러짐 — 피가 더 남은 쪽, 같으면 상대) · injuriesFromWounds = 생사전 쪽 함수(saengsa_rules.js — 없으면 fallbackInjuries)
 */
export function resultFromMatch(spec, fighters, winnerTeam, injuriesFromWounds = fallbackInjuries) {
  const mine = spec.mineSide;
  const other = mine === 'a' ? 'b' : 'a';
  let team = winnerTeam;
  if (team == null) {
    const left = [0, 1].map((t) => fighters.filter((f) => f.team === t).reduce((s, f) => s + f.blood, 0));
    team = left[0] > left[1] ? 0 : 1;
  }
  const out = {};
  for (const e of spec.fighters) {
    const f = fighters[e.index];
    const fresh = (f.wounds ?? []).filter((w) => !w.carried).map((w) => ({ part: w.part, severity: w.severity }));
    out[e.key] = { hp: hpFromFighter(f), injuries: injuriesFromWounds(e.person?.injuries ?? [], fresh), alive: !!f.alive, broken: !!f.weaponBroken, weaponBroken: !!f.weaponBroken };
  }
  return { winner: team === 0 ? mine : other, fighters: out };
}

// 생사전 쪽 injuriesFromWounds 와 같은 셈 (가지 wk/saengsa src/saengsa_rules.js — 이 가지에 그 파일이 없을 때만 · 합치면 main.js 가 그쪽 것을 쓴다)
//  긁힘(woundMin 0.1 밑)은 뺌 · 몸 부위 → 넷 · 같은 부위에 또 다치면 더 깊은 심각도로 · 쉰 수 0
const FALLBACK_WOUND_MIN = 0.1;
const WOUND_PART = { head: 'head', neck: 'head', chest: 'torso', abdomen: 'torso', pelvis: 'torso', uarmS: 'arm', uarmO: 'arm', farmS: 'arm', farmO: 'arm', thighF: 'leg', thighB: 'leg', shinF: 'leg', shinB: 'leg', footF: 'leg', footB: 'leg' };
export function fallbackInjuries(prior, wounds) {
  const out = (prior ?? []).map((i) => ({ ...i }));
  for (const w of wounds ?? []) {
    const part = WOUND_PART[w.part];
    if (!part || !(w.severity >= FALLBACK_WOUND_MIN)) continue;
    const old = out.find((i) => i.part === part);
    if (old) (old.sev = Math.max(old.sev, w.severity)), (old.rests = 0);
    else out.push({ part, sev: w.severity, rests: 0 });
  }
  return out;
}
