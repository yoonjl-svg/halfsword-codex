// 기준 하니스 (디렉터 10라운드 A6) — 실제 게임과 같은 성격으로 무기 승률을 잰다. 기본은 hybrid(게임 기본: 다리로 체중 받치기)
//  vs    : 무기 X 대 롱소드 (목표 승률표의 기준)
//          X 가 캐릭터 무기면 그 캐릭터가 쥔다(난이도·성격·근력 그대로): 나뭇가지 → 브란, 청강검 → 랴오, 복제품 → 하인리히.
//          아니면 '주인공 대리'가 쥔다: 기본 AI(normal) + 그 무기의 유파 꾸러미(persona.school — main.js 가 대체 무기에 쓰는 방식).
//          롱소드는 주인공 대리가 쥔다. (X = longsword 면 주인공 대리끼리 — 대조군)
//  field : '주인공이 쥔 경우' — 주인공 대리가 무기 X 로 캐릭터 다섯을 돌아가며 상대한다.
//          캐릭터는 게임처럼 제 무기·난이도·성격이고, 브란의 대체 무기(10%)도 판 시드로 굴린다.
//  두 모드 모두 자리를 바꿔 가며 붙인다: 시드 1000+s 는 X 가 player 자리, 2000+s 는 enemy 자리. 판마다 40초, 벽 있음.
//  간격 표는 게임 그대로(ai.js 가 무기로 정함) — 하니스용 applyWeaponMeasure 는 쓰지 않는다.
//  찍는 것: 승·패·무(시간 끝·둘 다 죽음 = 무), 승률(무는 승이 아님)과 윌슨 95% 구간, 평균 종료 시간, 파손 판
//  --proxy=ls : 주인공 대리를 롱소드 유파(persona 없음)로 몬다. 간격은 게임의 scaledM(ai.js MEASURED 비율, 베는 시간도 비율)으로 정해진다.
//               기본(유파 꾸러미)은 schools.js 의 무기별 measure 를 그대로 쓰는데, 그 표의 cutTime 은 보정 없는 raw 라서 비교용으로 둔다
//  --hero     : vs 에서 캐릭터 무기도 주인공 대리가 쥔다 (무기 탓인지 캐릭터 성격 탓인지 가르는 비교용)
// 사용법: node tools/sim/ref_duel.mjs [vs|field] [판 수(자리마다)] [무기id...] [--seed=첫 번호] [--levitate] [--proxy=ls] [--hero] [--json]
//   예: node tools/sim/ref_duel.mjs vs 48 qinggang falchion   (무기마다 96판, hybrid)
import * as CONFIG from '../../src/config.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { CHARACTERS, pickCharacterWeapon } from '../../src/characters.js';
import { isMain } from './is_main.mjs';

const ROUND_SECONDS = 40;
// 게임에서 그 무기를 쥐는 캐릭터 (롱소드는 이졸데·마르가레테 둘이라 기준 상대인 주인공 대리가 쥔다)
const OWNER = Object.fromEntries(CHARACTERS.filter((c) => c.weapon !== 'longsword').map((c) => [c.weapon, c]));
let PROXY_LS = false; // --proxy=ls
let HERO_ALL = false; // --hero
const hero = (w) => (PROXY_LS ? { level: 'normal', persona: null, who: '주인공 대리(롱소드 유파)' } : { level: 'normal', persona: { school: w }, who: '주인공 대리' });
const charSide = (c, w) => ({ level: c.ai.level, persona: w !== c.weapon ? { ...c.ai.persona, school: w } : c.ai.persona, who: c.id, revive: c.revive }); // revive: 이졸데의 부활

/** 판 시드로 굴리는 작은 난수 (브란의 대체 무기 뽑기용 — Math.random 을 건드리지 않는다) */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 한 판: x = X 쪽 {weapon, level, persona}, y = 상대 쪽. xFirst 면 X 가 player 자리 */
export function playOne(x, y, seed, xFirst) {
  const P = xFirst ? x : y;
  const E = xFirst ? y : x;
  const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: E.level, persona: E.persona, AI2Class: AI, difficulty2: P.level, persona2: P.persona, revive: E.revive, revive2: P.revive });
  let tDead = null;
  let res = 'D';
  let nan = false;
  for (let i = 0; i < ROUND_SECONDS / DT; i++) {
    G.step();
    const sv = G.player.sword.linvel();
    if (![sv.x, sv.y, sv.z].every(Number.isFinite)) {
      nan = true;
      break;
    }
    const pd = G.player.state === 'dead';
    const ed = G.enemy.state === 'dead';
    if (pd || ed) {
      tDead = G.t;
      res = pd && ed ? 'D' : (ed === xFirst ? 'W' : 'L');
      break;
    }
  }
  const xf = xFirst ? G.player : G.enemy;
  return { res, tDead, nan, broke: xf.weaponBroken || (xFirst ? G.enemy : G.player).weaponBroken };
}

/** 윌슨 95% 구간 */
export function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function runWeapon(mode, id, N, S0) {
  const rows = [];
  for (let s = S0; s < S0 + N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s;
      let x;
      let y;
      if (mode === 'field') {
        const c = CHARACTERS[(s - 1) % CHARACTERS.length];
        const cw = pickCharacterWeapon(c, rng(seed));
        x = { weapon: id, ...hero(id) };
        y = { weapon: cw, ...charSide(c, cw) };
      } else {
        x = OWNER[id] && !HERO_ALL ? { weapon: id, ...charSide(OWNER[id], id) } : { weapon: id, ...hero(id) };
        y = { weapon: 'longsword', ...hero('longsword') };
      }
      rows.push({ ...playOne(x, y, seed, xFirst), vs: y.who, xWho: x.who });
    }
  }
  const n = rows.length;
  const W = rows.filter((r) => r.res === 'W').length;
  const L = rows.filter((r) => r.res === 'L').length;
  const D = n - W - L;
  const ends = rows.filter((r) => r.tDead != null).map((r) => r.tDead);
  const [lo, hi] = wilson(W, n);
  const byFoe = {};
  if (mode === 'field') for (const r of rows) (byFoe[r.vs] ||= { W: 0, L: 0, D: 0 })[r.res]++;
  return { mode, id, n, W, L, D, p: W / n, lo, hi, tEnd: ends.length ? ends.reduce((a, b) => a + b, 0) / ends.length : null, broke: rows.filter((r) => r.broke).length, nan: rows.filter((r) => r.nan).length, holder: rows[0].xWho, byFoe };
}

export function fmt(r) {
  const pc = (v) => `${Math.round(100 * v)}%`;
  const foes = Object.entries(r.byFoe).map(([k, v]) => `${k} ${v.W}-${v.L}-${v.D}`).join(' · ');
  return `${r.id.padEnd(18)} 승 ${r.W} 패 ${r.L} 무 ${r.D} / ${r.n} · 승률 ${pc(r.p)} (95% ${pc(r.lo)}~${pc(r.hi)}) · 평균 종료 ${r.tEnd?.toFixed(1) ?? '-'}s · 파손 ${r.broke} · NaN ${r.nan} · 쥔 쪽 ${r.holder}${foes ? ` | ${foes}` : ''}`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const mode = pos[0] === 'field' ? 'field' : 'vs';
  const N = +(pos[1] || 48);
  const ids = pos.slice(2).length ? pos.slice(2) : Object.keys(WEAPONS).filter((id) => mode === 'field' || id !== 'longsword');
  const S0 = +(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1);
  CONFIG.BODY.weightMode = args.includes('--levitate') ? 'levitate' : 'hybrid';
  PROXY_LS = args.includes('--proxy=ls');
  HERO_ALL = args.includes('--hero');
  console.log(`기준 하니스 · ${mode === 'field' ? '주인공이 쥔 경우(캐릭터 다섯 상대)' : '롱소드 상대'} · ${CONFIG.BODY.weightMode} · 자리마다 ${N}판(시드 ${S0}부터) × 2`);
  for (const id of ids) {
    const r = runWeapon(mode, id, N, S0);
    console.log(fmt(r));
    if (args.includes('--json')) console.log(JSON.stringify(r));
  }
}
