// 유파 막기 몸꼴 찾기 — 아무 유파 · 아무 줄 (10/16 23:3x 사장님 '우케나가시 탈류 쳐내기 개발해'). 읽기만 — 판 값은 바꾸지 않는다.
//  yoryak_search.mjs(요략세)를 넓힌 것: 플레이어(그 유파 무기 · 유파 막기 책)가 막기 단추를 버티고, AI normal 몸이 대본으로 공격들을 긋는다.
//  후보 몸꼴을 TRADITIONS[TR].parryCover[LINE] 에 잠깐 얹어 막음을 센다(판 값 SKILL.parryFollow 그대로 — 막기 따라가기 켬).
//  TR=<유파> WEAPON=<무기> LINE=<줄> ATTACKS=<기술·속임수 이름,…> RANGE=ukenagashi|talho|sage|diag|talhoTh (찾는 범위 — 아래)
//  ATKS=<치는 칼,…> GAPS=… SPEEDS=… N=<후보 수> SEED=<씨앗> TOP=<보일 수> OUT=<json> CANDS=<json — 이 후보만>
//  node tools/sim/cover_search.mjs
import { newRound, DT } from './harness_m.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { SKILL, NAGASHI } from '../../src/config.js';
import { TECH, FEINTS } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

if (process.env.FOLLOW != null) SKILL.parryFollow = +process.env.FOLLOW;
if (process.env.NAGASHI != null) NAGASHI.on = +process.env.NAGASHI; // NAGASHI=0: 흘려 받기 규칙 끔 (config NAGASHI)
const TR = process.env.TR ?? 'japanese';
const WEAPON = process.env.WEAPON ?? 'uchigatana';
const LINE = process.env.LINE ?? 'highL';
const ATKS = (process.env.ATKS ?? 'longsword,zweihander').split(',');
const GAPS = (process.env.GAPS ?? '1.3,1.5,1.7').split(',').map(Number);
const SPEEDS = (process.env.SPEEDS ?? '11').split(',').map(Number);
const N = +(process.env.N ?? 40);
const TOP = +(process.env.TOP ?? 12);
let seed = +(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296);
const pick = (a, b) => a + (b - a) * rnd();
const r2 = (v) => Math.round(v * 100) / 100;
const byName = Object.fromEntries(TECH.map((t) => [t.name, t]));
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const ALL = [
  ...TECH.map((t) => ({ name: t.name, from: t.from, path: t.path })),
  ...FEINTS.map((f) => ({ name: f.name, from: byName[f.fake].from, path: [lerp(byName[f.fake].from, byName[f.fake].path[0], f.at), ...f.then] })),
];
const ATTACKS = (process.env.ATTACKS ?? 'zornhau').split(',').map((n) => ALL.find((a) => a.name === n)).filter(Boolean);
const sgn = LINE.endsWith('R') ? 1 : -1; // 가리는 쪽 (z: + = 칼 든 오른쪽)

// 찾는 범위 (원전 꼴을 해치지 않는 데서 — 수는 물리로 고른다)
//  ukenagashi: 검도형 소도 1·2본 「体を右に開き 右手 頭上·刃先 後ろ, 左鎬で受け流し」 — 손은 머리 위, 칼끝은 뒤(아래)로 비스듬히 지붕처럼, 몸을 연다
//  talho: 몬탄테 규칙 — 왼쪽으로 오는 칼을 탈류(오른 어깨에서 비스듬히 내려 베기)로 쳐내면 그 칼이 「머리 앞 왼쪽 둔각」에 멈춘다(복ⅩⅤ) — 손은 머리 앞 왼쪽, 칼은 비스듬히
const RANGES = {
  ukenagashi: () => ({
    hand: [r2(pick(0.0, 0.35)), r2(pick(0.25, 0.65)), r2(-sgn * pick(-0.35, 0.2))],
    blade: [Math.round(pick(-50, 25)), Math.round(sgn * pick(60, 180))],
  }),
  talho: () => ({
    hand: [r2(pick(0.1, 0.45)), r2(pick(-0.05, 0.5)), r2(sgn * pick(-0.15, 0.45))],
    blade: [Math.round(pick(-40, 60)), Math.round(sgn * pick(-30, 150))],
  }),
  // 10/16 23:4x 우케나가시·탈류가 맡으려던 줄(위 왼쪽 — 성난 베기·가로 베기)은 따라가기 뒤 이미 81~100 % 막힘 → 남은 빈틈 = 내 오른쪽 아래로 오는 올려 베기(lowR · unterhauL)
  //  sage: 오륜서 表3 下段 「太刀を下段に持ち、提げたる心にて、敵の打ちかく所を下より手をはる」 — 칼을 늘어뜨려 든 마음(提げ) · 칼끝을 가리는 쪽 아래로 드리운다 (요략세 드리운 꼴의 거울 범위)
  sage: () => ({
    hand: [r2(pick(0.1, 0.45)), r2(pick(-0.5, -0.1)), r2(sgn * pick(-0.2, 0.35))],
    blade: [Math.round(pick(-80, -20)), Math.round(sgn * pick(5, 120))],
  }),
  //  diag: 몬탄테 복ⅩⅣ 낮은 공격 「deflect it with the montante moving in acute angle along the left diagonal」 — 탈류(오른 위 → 왼 아래)가 끝나는 꼴:
  //   손은 칼 든 쪽(오른 허리~가슴), 칼끝은 왼 아래로 예각 — 칼이 아랫몸 앞을 비스듬히 가로지른다 (줄과 상관없이 왼 대각)
  diag: () => ({
    hand: [r2(pick(0.1, 0.45)), r2(pick(-0.45, 0.15)), r2(pick(-0.1, 0.4))],
    blade: [Math.round(pick(-75, -15)), Math.round(-pick(10, 120))],
  }),
  // 10/16 23:5x 준비 동작 스침을 뺀 '긋기' 빈틈 — 오른쪽 아래 올려 베기는 긋기 빈틈이 아니었다(못 막은 판이 모두 준비 동작에 다리를 스침).
  //  이베리아의 진짜 긋기 빈틈 = 찌르기→베기(찌르는 척 → 오른 어깨에서 성난 베기) 2/9 — 찌르기 줄(오른쪽 비낀 자세)에 칼이 있는 동안 왼 위로 베기가 온다.
  //  talhoTh: 복ⅩⅣ 첫 자세 「the montante in obtuse angle along the right diagonal, such that the right hand rests in front of the belt … to deflect the thrust aimed at the left breast with a talho」
  //   — 찌르기를 탈류로 왼쪽으로 쳐낸 뒤의 꼴: 손은 허리띠~가슴 앞, 칼은 둔각으로 왼쪽(칼끝 앞~왼 옆) · 이어 오는 왼 위 베기도 그 칼이 가린다
  talhoTh: () => ({
    hand: [r2(pick(0.15, 0.45)), r2(pick(-0.3, 0.25)), r2(pick(-0.1, 0.35))],
    blade: [Math.round(pick(-20, 50)), Math.round(-pick(0, 110))],
  }),
};
const RANGE = RANGES[process.env.RANGE ?? 'ukenagashi'];
function candidate() {
  return { ...RANGE(), pelvisYaw: Math.round(pick(-40, 40)), chestYaw: Math.round(pick(-50, 50)), pitch: Math.round(pick(0, 10)), drop: r2(pick(0, 0.1)) };
}

let nag = false;
function trial(cover, atk, gap, speed, attack) {
  nag = false;
  SKILL.parryAssist = 0;
  const Gm = newRound({ weapon: WEAPON, weapon2: atk, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  const T = TRADITIONS[TR];
  const keep = Object.getOwnPropertyDescriptor(T, 'parryCover');
  if (cover) {
    const base = keep ? (keep.get ? keep.get.call(T) : keep.value) ?? {} : {};
    Object.defineProperty(T, 'parryCover', { value: { ...base, [LINE]: { name: '시험', pad: T.parry[LINE], ...cover } }, configurable: true, writable: true });
  }
  const guard = new PlayerParryGuard(D, A);
  if (cover) {
    if (keep) Object.defineProperty(T, 'parryCover', keep);
    else delete T.parryCover;
  }
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  guard.held = true;
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  let cut = null, clash = null, ph = 0, t0 = 0, pts = null, cutPh = null;
  const c0 = Gm.clashes;
  const prev = Gm.combat.hooks.onClash;
  Gm.combat.hooks.onClash = (point, sp, info) => (prev?.(point, sp, info), info.nagashi && (nag = true)); // 흘려 받기가 걸렸나 (combat.js nagashi)
  Gm.before = () => {
    guard.step(DT);
    D.inputActive = guard.active;
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(attack.from[0], attack.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = attack.path.map((p) => p.slice()));
    else if (ph === 3 && go(pts[0][0], pts[0][1], speed) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (clash == null && Gm.clashes > c0) clash = Gm.t;
    if (!cut && Gm.wounds.some((x) => x.vic === D && x.type !== 'blunt')) (cut = Gm.t), (cutPh = ph);
  };
  while (!(ph === 4 && Gm.t - t0 > 0.6) && Gm.t < 6) Gm.step();
  if (!cut && clash == null) return 'clear';
  // wind = 긋기 전(준비 동작 · 멈춤)에 벰 — 가까운 간격에서 준비 자세로 가는 칼끝이 다리를 스친다 (10/16 23:5x 추적). 막음 셈에선 베임과 같고, '긋기만' 셈(okS/nS)에서 뺀다
  return cut ? (cutPh < 3 ? 'wind' : 'cut') : 'ok';
}

function score(cover) {
  let ok = 0, n = 0, nS = 0, nN = 0;
  const trials = [];
  for (const attack of ATTACKS) for (const atk of ATKS) for (const gap of GAPS) for (const sp of SPEEDS) {
    const w = trial(cover, atk, gap, sp, attack);
    trials.push([attack.name, atk, gap, sp, w, nag ? 1 : 0]);
    if (nag) nN++;
    if (w === 'clear') continue;
    n++;
    if (w !== 'wind') nS++;
    if (w === 'ok') ok++;
  }
  return { ok, n, nS, nN, trials };
}

const cands = process.env.CANDS ? JSON.parse(readFileSync(process.env.CANDS, 'utf8')) : [{ tag: '지금', cover: null }, ...Array.from({ length: N }, (_, i) => ({ tag: `c${i}`, cover: candidate() }))];
const res = cands.map((c) => ({ ...c, ...score(c.cover) }));
res.sort((a, b) => b.ok / Math.max(1, b.n) - a.ok / Math.max(1, a.n) || b.n - a.n);
for (const r of res.slice(0, TOP)) console.log(`${r.tag.padEnd(6)} ${r.ok}/${r.n} (긋기만 ${r.ok}/${r.nS}) 흘림 ${r.nN} ${JSON.stringify(r.cover)}`);
const now = res.find((r) => r.tag === '지금');
if (now) console.log(`지금 ${now.ok}/${now.n} (긋기만 ${now.ok}/${now.nS}) 흘림 ${now.nN}`);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(res, null, 1));
