// 막기 빈틈 지도 (10/16 20:2x 사장님 '빈틈부터 재 봐' — 유파 몸꼴 막기가 맡을 빈틈 찾기). 읽기만.
//  parry_assist_bench.mjs 와 같은 판: 막는 쪽 = 플레이어(이 무기 · 막기 버튼 버팀 — 처음부터 누름), 치는 쪽 = AI normal 몸이 대본으로
//  쉴 자세 0.6 s → 준비 자세(3 m/s) → 0.15 s 멈춤 → 길을 11 m/s 로 긋기 → 0.6 s 지켜봄. 간격 4 (1.35~1.80 m).
//  공격 = 기술 12 (TECH 모두) + 속임수 4 (FEINTS — ai.js 와 같이 가짜 길을 at 만큼 가다가 then 길로).
//  막는 쪽 꼴: 무기[:꼴] — 꼴 school(기본 · 2급 막기 책) · basic(책 없음 = 무유파 자리 · 덧씌우기 없음) · nocover(유파 자리 그대로, 몸꼴 덧씌우기만 뺌)
//  막음 = 칼날 상처 없음 + 칼끼리 닿음 · 베임 = 칼날 상처 · 둘 다 아님(간격 밖·스침)은 뺀다 (parry_assist_bench 와 같은 뜻)
//  FOLLOW=0|1 = 막기 따라가기 끄고 켜기(판 값 1) · PA=<막기 거듦 단계 0~3>(판 값 0) · ATK=<치는 무기>(기본 longsword) · GAPS=… · ATTACKS=이름,… · OUT=<json 경로>
//  닿은 자리 (10/17 이탈리아 forte 막기 연구 — docs/strike/italian_forte_parry_2026-10-17.md): json 의 판마다 닿은 자리 = 내 칼 위 몇 할(0 코등이 → 1 칼끝,
//   음수 = 자루·컵 쪽 · deflect_probe.mjs 와 같은 셈) — at · atPh = 처음 칼끼리 닿은 자리 · 그때 대본 단계(0 = 판 처음 서 있는 채 · 3 = 긋기) ·
//   atS = 긋기(단계 3~) 첫 닿음 · atE = 벤 때까지(못 베면 끝까지) 긋기 마지막 닿음 · atLn = 긋기 첫 닿음 때 막는 줄 · bp = 처음 벤 몸 부위(uarmS · farmS = 칼 든 팔).
//   CONTACT=1 이면 꼴마다 닿은 자리(긋기 첫 닿음) 줄을 하나 더 찍는다(기본 출력 줄은 그대로)
//  COVERS=<json> (같은 연구): { 꼴 이름: { 줄: 몸꼴 } } — '무기:꼴 이름' 으로 부르면 그 판에만 막는 쪽 유파 parryCover 에 그 몸꼴을 얹는다
//   (cover_search.mjs 와 같은 꼴 — 자리 pad 는 유파 parry[줄] 그대로, 몸꼴 칸 hand · blade · pelvisYaw · chestYaw · pitch · drop)
//  꼴 forte · forte2 (같은 연구): 이탈리아 forte 막기 후보 (가) — 그 판에만 SKILL.itForte = 1 · 2 (판 값 0 — 끔).  예) node tools/sim/parry_gap_map.mjs rapier,rapier:basic,rapier:forte
//  node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander,uchigatana,qinggang,qinggang:basic,qinggang:nocover
import { newRound, DT } from './harness_m.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { SKILL, NAGASHI } from '../../src/config.js';
import { TECH, FEINTS } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { NEW_TECH } from '../../src/frames.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const CONFIGS = (process.argv[2] ?? 'longsword').split(',').map((s) => {
  const [weapon, mode = 'school'] = s.split(':');
  return { weapon, mode, key: s };
});
if (process.env.NAGASHI != null) NAGASHI.on = +process.env.NAGASHI; // NAGASHI=0: 흘려 받기 규칙 끔 (config NAGASHI)
if (process.env.FOLLOW != null) SKILL.parryFollow = +process.env.FOLLOW; // 막기 따라가기 (판 값 — 10/16 22:5x 부터 1, 0 = 그 전)
const ATK = process.env.ATK ?? 'longsword';
const GAPS = (process.env.GAPS ?? '1.35,1.5,1.65,1.8').split(',').map(Number);
const COVERS = process.env.COVERS ? JSON.parse(readFileSync(process.env.COVERS, 'utf8')) : {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const byName = Object.fromEntries(TECH.map((t) => [t.name, t]));
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const ALL = [
  ...TECH.map((t) => ({ name: t.name, kind: t.kind, from: t.from, path: t.path })),
  ...FEINTS.map((f) => {
    const t = byName[f.fake];
    return { name: f.name, kind: 'feint', from: t.from, path: [lerp(t.from, t.path[0], f.at), ...f.then] };
  }),
];
// UNIQUE=1 | 이름,… (10/16 23:0x 사장님 '고유 동작 넣어서 빈틈 다시 재 봐'): 유파 고유 동작(TRADITIONS.*.unique — 길 · 속임수) + 몸 틀 새 기술(frames.js NEW_TECH)을 더한다.
//  발 디딤(step — 옆 비킴 · 뛰어듦)은 대본이 움직이지 않으므로 칼 길만 같다(그 기술 숫자는 대략값). ONLY=1 이면 고유 동작만
const UNIQ = [];
if (process.env.UNIQUE) {
  const want = process.env.UNIQUE === '1' ? null : new Set(process.env.UNIQUE.split(','));
  const seen = new Set();
  const add = (t) => {
    if (!t?.name || seen.has(t.name) || (want && !want.has(t.name))) return;
    seen.add(t.name);
    UNIQ.push(t);
  };
  for (const tr of Object.values(TRADITIONS)) for (const u of tr.unique ?? []) {
    if (u.from && u.path) add({ name: u.name, kind: u.kind, from: u.from, path: u.path, step: !!u.step });
    else if (u.feint && byName[u.feint.fake]) {
      const t = byName[u.feint.fake];
      add({ name: u.name, kind: 'feint', from: t.from, path: [lerp(t.from, t.path[0], u.feint.at), ...u.feint.then] });
    }
  }
  for (const list of Object.values(NEW_TECH)) for (const t of list) if (t.from && t.path) add({ name: t.name, kind: t.kind, from: t.from, path: t.path });
}
const POOL = process.env.ONLY ? UNIQ : [...ALL, ...UNIQ];
const ATTACKS = process.env.ATTACKS ? process.env.ATTACKS.split(',').map((n) => POOL.find((a) => a.name === n)).filter(Boolean) : POOL;

// 꼴 forte · forte2 (10/17 연구): 이탈리아 forte 막기 후보 (가) — 그 판에만 SKILL.itForte = 1 · 2 (schools.js ITALIAN_FORTE · 끝나면 되돌림 — 판 값 0)
function trial(cfg, atk, gap) {
  const itF = SKILL.itForte;
  if (cfg.mode === 'forte' || cfg.mode === 'forte2') SKILL.itForte = cfg.mode === 'forte2' ? 2 : 1;
  try {
    return trialRun(cfg, atk, gap);
  } finally {
    SKILL.itForte = itF;
  }
}

function trialRun(cfg, atk, gap) {
  SKILL.parryAssist = +(process.env.PA ?? 0); // 막기 거듦 단계 (지금 판 값 0 — PA=2 = 일찍·다시 읽기, docs/strike/parry_assist_2026-10-12.md)
  const Gm = newRound({ weapon: cfg.weapon, weapon2: ATK, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  if (cfg.mode === 'basic') D.schoolParry = false;
  // nocover: 이 판의 유파 덧씌우기만 잠깐 뺀다 (지킴이를 만들 때 installCover 가 읽는다)
  const tr = D.swordArt?.tradition;
  const saved = cfg.mode === 'nocover' ? Object.getOwnPropertyDescriptor(TRADITIONS[tr], 'parryCover') : null;
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', { value: null, configurable: true, writable: true });
  // COVERS 꼴: 이 판에만 후보 몸꼴을 유파 덧씌우기에 얹는다 (지킴이를 만들 때 installCover 가 읽는다 — 끝나면 되돌림)
  const extra = COVERS[cfg.mode] ?? null;
  const T = TRADITIONS[tr];
  const keep = extra ? Object.getOwnPropertyDescriptor(T, 'parryCover') : null;
  if (extra) {
    const base = keep ? ((keep.get ? keep.get.call(T) : keep.value) ?? {}) : {};
    const add = Object.fromEntries(Object.entries(extra).map(([ln, c]) => [ln, { name: `시험 ${cfg.mode}`, pad: T.parry[ln], ...c }]));
    Object.defineProperty(T, 'parryCover', { value: { ...base, ...add }, configurable: true, writable: true });
  }
  const guard = new PlayerParryGuard(D, A);
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', saved);
  if (extra) {
    if (keep) Object.defineProperty(T, 'parryCover', keep);
    else delete T.parryCover;
  }
  // CALM=<m/s> 시험 (10/17 01:1x): 따라가기를 상대 칼끝이 이 빠르기 밑일 때(정말 멈춘 준비 자세)만 — 긋는 중 위협이 잠깐 끊겨도 손 자리로 줄을 옮기지 않게
  if (process.env.CALM) {
    const CALM = +process.env.CALM, st = guard.step.bind(guard);
    guard.step = (dt) => {
      const s = guard.sense.seen(0), keep = SKILL.parryFollow;
      if (Math.hypot(s.tvx, s.tvy, s.tvz) >= CALM) SKILL.parryFollow = 0;
      const out = st(dt);
      SKILL.parryFollow = keep;
      return out;
    };
  }
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  guard.held = true;
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  const r = { cut: null, clash: null, lines: new Set(), nag: false, at: null, atPh: null, atS: null, atE: null, atLn: null, bp: null };
  let ph = 0, t0 = 0, pts = null;
  // 닿은 자리 = 내 칼 위 몇 할 (0 코등이 → 1 칼끝 · 음수 = 자루·컵 쪽 — deflect_probe.mjs 와 같은 셈)
  const along = (p) => {
    const a = D.bladePoint(0, _a), b = D.bladePoint(1, _b).sub(a);
    return +(((p.x - a.x) * b.x + (p.y - a.y) * b.y + (p.z - a.z) * b.z) / (b.lengthSq() || 1)).toFixed(2);
  };
  const prev = Gm.combat.hooks.onClash;
  Gm.combat.hooks.onClash = (point, sp, info) => {
    prev?.(point, sp, info);
    if (info.nagashi) r.nag = true; // 흘려 받기가 걸렸나 (combat.js nagashi)
    if (r.at == null) (r.at = along(point)), (r.atPh = ph);
    if (ph < 3 || r.cut) return;
    const a = along(point);
    if (r.atS == null) (r.atS = a), (r.atLn = guard.line); // 긋기 첫 닿음 (판 처음엔 두 칼이 서 있는 채 맞닿는 간격이 있다 — 단계 0)
    r.atE = a; // 벤 때까지(또는 끝까지) 긋기 마지막 닿음
  };
  const pw = Gm.combat.hooks.onWound;
  Gm.combat.hooks.onWound = (att, vic, res, point, pr) => {
    pw?.(att, vic, res, point, pr);
    if (vic === D && res.type !== 'blunt' && r.bp == null) r.bp = pr?.v?.part ?? null; // 처음 벤 몸 부위 (아래 r.cut 과 같은 상처)
  };
  const c0 = Gm.clashes;
  Gm.before = () => {
    guard.step(DT);
    D.inputActive = guard.active;
    if (guard.mode === 'defend' && guard.line) r.lines.add(guard.line);
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(atk.from[0], atk.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = atk.path.map((p) => p.slice()));
    else if (ph === 3 && go(pts[0][0], pts[0][1], 11) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (r.clash == null && Gm.clashes > c0) r.clash = Gm.t;
    if (!r.cut) {
      const w = Gm.wounds.find((x) => x.vic === D && x.type !== 'blunt');
      if (w) r.cut = { t: Gm.t, part: w.zone ?? w.part ?? w.region ?? null, ph };
    }
  };
  while (!(ph === 4 && Gm.t - t0 > 0.6) && Gm.t < 6) Gm.step();
  const lines = [...r.lines].join('>') || '-';
  const nag = r.nag ? 1 : 0;
  const at = r.at == null ? {} : { at: r.at, atPh: r.atPh, atS: r.atS, atE: r.atE, atLn: r.atLn };
  if (!r.cut && r.clash == null) return { why: 'clear', lines, nag };
  if (!r.cut) return { why: 'ok', lines, nag, ...at };
  // wind = 긋기 전(준비 동작 · 멈춤)에 벰 — 가까운 간격에서 준비 자세로 가는 칼끝이 다리를 스친다 (10/16 23:5x). 막음 셈에선 전과 같이 못 막음
  if (r.cut.ph < 3) return { why: 'wind', lines, part: r.cut.part, nag, ...at, bp: r.bp };
  return { why: r.clash != null && r.clash < r.cut.t ? 'pushed' : 'cut', lines, part: r.cut.part, nag, ...at, bp: r.bp };
}

const out = { atk: ATK, gaps: GAPS, configs: {} };
for (const cfg of CONFIGS) {
  const rows = {};
  for (const atk of ATTACKS) rows[atk.name] = GAPS.map((g) => trial(cfg, atk, g));
  out.configs[cfg.key] = rows;
  let ok = 0, n = 0, wind = 0, nag = 0;
  const cells = [];
  for (const [name, res] of Object.entries(rows)) {
    const v = res.filter((x) => x.why !== 'clear');
    const k = v.filter((x) => x.why === 'ok').length;
    const wd = v.filter((x) => x.why === 'wind').length;
    ok += k;
    n += v.length;
    wind += wd;
    nag += res.filter((x) => x.nag).length;
    cells.push(`${name} ${k}/${v.length}${wd ? `(준비 ${wd})` : ''}`);
  }
  console.log(`${cfg.key.padEnd(18)} 치는 칼 ${ATK.padEnd(10)} 막음 ${ok}/${n} = ${n ? Math.round((100 * ok) / n) : 0}% (준비 동작에 벰 ${wind}) 흘려 받기 걸린 판 ${nag} | ${cells.join(' · ')}`);
  if (process.env.CONTACT) {
    // 닿은 자리 줄 (CONTACT=1): 긋기 첫 닿음(atS)의 가운데값 · forte(코등이 ~ 칼 가운데, ≤ 0.5 — 카포 페로 [37]) 몫 — 모두 · 막음 · 밀려 벰, 칼 든 팔(uarmS · farmS) 벤 판
    const all = Object.values(rows).flat().filter((x) => x.atS != null);
    const mid = (a) => (a.length ? a.map((x) => x.atS).sort((p, q) => p - q)[Math.floor(a.length / 2)] : '-');
    const forte = (a) => (a.length ? Math.round((100 * a.filter((x) => x.atS <= 0.5).length) / a.length) : 0);
    const okA = all.filter((x) => x.why === 'ok'), puA = all.filter((x) => x.why === 'pushed');
    const arm = Object.values(rows).flat().filter((x) => x.bp === 'uarmS' || x.bp === 'farmS').length;
    console.log(`${cfg.key.padEnd(18)} 닿은 자리(0 코등이 → 1 칼끝) 가운데값 ${mid(all)} · forte ${forte(all)}% (${all.length} 판) | 막음 ${mid(okA)} · ${forte(okA)}% | 밀려 벰 ${mid(puA)} · ${forte(puA)}% (${puA.length}) | 칼 든 팔 벰 ${arm}`);
  }
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
