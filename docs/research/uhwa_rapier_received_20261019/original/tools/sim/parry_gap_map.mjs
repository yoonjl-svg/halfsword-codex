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
//  꼴 cn<배율> (10/17 동방 막기 단추 손 빠르기 — docs/strike/chinese_parry_speed_2026-10-17.md): 그 판에만 SKILL.cnParrySpeedK = 배율 (판 값 1).  예) node tools/sim/parry_gap_map.mjs qinggang,qinggang:cn1.15,qinggang:cn1.3
//  꼴 cnB<K> · cnD<몫> (10/17 동방 막기 마지막 안 — docs/strike/chinese_parry_brace_2026-10-17.md): 그 판에만 SKILL.cnBraceK = K(버티는 힘) · SKILL.cnParryDmgCut = 몫(막는 동안 피해 감소) (판 값 0).
//   연구 판 json 칸 w 를 쓰고, 그 상처마다 여섯째 칸 = 입은 때 막는 중(mode 'defend')이면 1 · 아니면 0.  예) node tools/sim/parry_gap_map.mjs qinggang:cnB0,qinggang:cnB0.5,qinggang:cnD0.25
//  PRESS=<s> (같은 동방 연구 — 늦게 누르기): 막기 단추를 처음부터 누르지 않고 긋기 시작(대본 3 단계 — 0.15 s 멈춤이 끝난 때) + s 초에 누른다(−0.15 까지 = 멈춤 중 · 99 = 끝까지 안 누름).
//   json 칸 t3 = 긋기 시작 · tp = 누른 때 · tc = 처음 벤 때 (연구 판 칸 w · dead · d1 도 씀) — 사람이 칼이 오는 것을 보고 얼마나 늦게 눌러도 막나
//  꼴 retreat · beat (10/17 이탈리아 물러서기 연구 — docs/strike/italian_retreat_2026-10-17.md): 그 판에만 SKILL.itRetreat = 1 · itParryBeat = 1 ('+' 로 잇기 — rapier:retreat+beat).
//   RETREAT=<json> = SKILL.itRetreatVals 덮기(예 '{"gap":0,"low":0}') · json 칸 rt = 물러선 짝 수 · rtF = 그동안 디딘 발(S 짧은 · L 긴 · s 자세 고치기 · q 기술 걸음) · rtD = 물러선 거리(m) · rtT = 걸린 시간(s — 판이 먼저 끝나면 null)
//   꼴 retreat2 = SKILL.itRetreat 2(플레이어 스스로 — 막는 동안 스틱을 뒤로 당긴 두 디딤을 물러서는 한 짝으로 셈). HUMAN=<s> = 사람 흉내: 처음 읽은 때 거리가 gap 이상이면 그 s 뒤 스틱을 뒤로 당겨
//    두 디딤(retreat2 면 그 한 짝이 끝날 때까지 · maxT 안) — 막기 단추의 읽기보다 사람 반응만큼 늦게 물러서는 판
//   연구 판(RIPOSTE · NOHOLD · HUMAN · 꼴 retreat · retreat2 · beat · cn<배율> — 기본 판 json 은 그대로)의 json 칸 w = 막는 쪽이 입은 칼날 상처 [부위 · 자리 · c 베기 / s 찌르기 · 심각도 · J] 모두 · dead = 그 판에 죽은 까닭 · d1 = 처음 읽은 때 거리
//  RIPOSTE=1 (같은 연구): 막은 판은 막기 판정이 끝나면(긋기 끝 + 0.6 s — 기본 판이 끝나는 때와 같아 막음 · 베임 셈이 기본 판 그대로 · 물러서는 중이면 그 뒤) 막기 단추를 놓고 앞으로 걸으며(스틱 앞 끝) 가슴 사이 거리가 내 무기 reach(한 걸음 내디뎌 닿는 거리) 안이면
//   탭 찌르기 — json 칸 rp = { d0 시작 거리 · tap {t, d} · hit {t, zone} (상대 몸 칼날 상처) · feet 나아가며 디딘 걷는 발 첫 셋(S · L · u) · cnt 시작 때 박자 셈 · self 그동안 내가 베임 ·
//   w 그동안 상대가 입은 칼날 상처(위 w 와 같은 꼴) · dead 상대가 죽은 까닭 }, RIP_T s(기본 1.5) 안. 요약 줄 하나 더
//  node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander,uchigatana,qinggang,qinggang:basic,qinggang:nocover
import { newRound, DT } from './harness_m.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { SKILL, NAGASHI, ARENA } from '../../src/config.js';
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
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3();
if (process.env.RETREAT) Object.assign(SKILL.itRetreatVals, JSON.parse(process.env.RETREAT)); // 물러서기 걸이 · 걸음 값 덮기 (연구)
const RIP = !!process.env.RIPOSTE;
const RIP_T = +(process.env.RIP_T ?? 1.5);
const HUM = process.env.HUMAN != null ? +process.env.HUMAN : null; // 사람 흉내 반응 시간(s) — 위 머리말
const PRESS = process.env.PRESS != null ? +process.env.PRESS : null; // 늦게 누르기: 긋기 시작 + PRESS s 에 막기 단추를 누름 (위 머리말)
// NOHOLD=1 (같은 연구): 판 시작 발 묶임(ARENA.startHold 2 s — fighter.feetHeld)을 풀고 시작 — 이 판의 공격은 1.2~1.6 s 에 끝나 묶인 발로는 물러서기 · 되찌르기 걸음이 없다.
//  싸움 한가운데처럼 두 몸 fightT = startHold 로(fighter.feetHeld 가 읽는 판 시계를 묶임 끝으로 — 10/18 에 지운 대기실 3D 몸 lobby_rig.js 가 쓰던 길) · NOHOLD=D = 막는 쪽만(치는 쪽은 묶인 채 — 베기에 몸 내딛기가 안 붙는 지금 판 공격 그대로).
//  물러서기 연구는 바탕까지 모두 같은 판으로 견준다(짝 비교)
const NOHOLD = process.env.NOHOLD ?? '';
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
//  꼴 retreat · beat (10/17 연구): SKILL.itRetreat · itParryBeat = 1 — '+' 로 이은 꼴 이름 낱말마다 (끝나면 되돌림)
//  꼴 cn<배율> (10/17 동방 막기 단추 손 빠르기): SKILL.cnParrySpeedK = 배율 (끝나면 되돌림)
//  꼴 cnB<K> · cnD<몫> (10/17 동방 막기 마지막 안): SKILL.cnBraceK · SKILL.cnParryDmgCut (끝나면 되돌림)
let cnTok = false;
let cnBD = false; // 꼴 cnB · cnD 판: 상처 칸에 막는 중이었나를 더 적는다
function trial(cfg, atk, gap) {
  const keep = { f: SKILL.itForte, r: SKILL.itRetreat, b: SKILL.itParryBeat, k: SKILL.cnParrySpeedK, cb: SKILL.cnBraceK, cd: SKILL.cnParryDmgCut };
  const tok = new Set(cfg.mode.split('+'));
  if (tok.has('forte') || tok.has('forte2')) SKILL.itForte = tok.has('forte2') ? 2 : 1;
  if (tok.has('retreat')) SKILL.itRetreat = 1;
  if (tok.has('retreat2')) SKILL.itRetreat = 2;
  if (tok.has('beat')) SKILL.itParryBeat = 1;
  const cn = [...tok].find((t) => /^cn[\d.]+$/.test(t));
  if (cn) SKILL.cnParrySpeedK = +cn.slice(2);
  const cb = [...tok].find((t) => /^cnB[\d.]+$/.test(t));
  if (cb) SKILL.cnBraceK = +cb.slice(3);
  const cd = [...tok].find((t) => /^cnD[\d.]+$/.test(t));
  if (cd) SKILL.cnParryDmgCut = +cd.slice(3);
  cnBD = !!(cb || cd);
  cnTok = !!(cn || cnBD); // 연구 판 json 칸(w · dead · d1)을 쓴다 — 'cn1' · 'cnB0' 이면 판 값 그대로인 판의 상처 기록
  try {
    return trialRun(cfg, atk, gap);
  } finally {
    SKILL.itForte = keep.f;
    SKILL.itRetreat = keep.r;
    SKILL.itParryBeat = keep.b;
    SKILL.cnParrySpeedK = keep.k;
    SKILL.cnBraceK = keep.cb;
    SKILL.cnParryDmgCut = keep.cd;
  }
}

function trialRun(cfg, atk, gap) {
  SKILL.parryAssist = +(process.env.PA ?? 0); // 막기 거듦 단계 (지금 판 값 0 — PA=2 = 일찍·다시 읽기, docs/strike/parry_assist_2026-10-12.md)
  const Gm = newRound({ weapon: cfg.weapon, weapon2: ATK, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  if (NOHOLD) D.fightT = ARENA.startHold; // 발 묶임 풀고 시작 (위 NOHOLD)
  if (NOHOLD && NOHOLD !== 'D') A.fightT = ARENA.startHold;
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
  guard.held = PRESS == null; // PRESS 판은 누르는 때까지 안 누름
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  const r = { cut: null, clash: null, lines: new Set(), nag: false, at: null, atPh: null, atS: null, atE: null, atLn: null, bp: null, d1: null, t1: null, t3: null, tp: null };
  const W = [], WA = []; // 칼날 상처 (연구 판 json 칸 w · rp.w): 막는 쪽이 입은 것 · 되찌르기 동안 상대가 입은 것
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
    if (res.type !== 'blunt' && res.severity > 0) {
      const w = [pr?.v?.part ?? null, res.zone, res.type === 'stab' ? 's' : 'c', +res.severity.toFixed(3), Math.round(res.energy)];
      if (cnBD && vic === D) w.push(guard.mode === 'defend' ? 1 : 0); // 꼴 cnB · cnD: 입은 때 막는 중이었나 (피해 감소가 걸리는 때)
      if (vic === D) W.push(w);
      else if (vic === A && att === D && rp) WA.push(w);
    }
  };
  const c0 = Gm.clashes;
  // 디딘 발 기록 (10/17 물러서기 연구): S 짧은 디딤 · L 긴 디딤(박자 걸음이 센 디딤) · u 걷는 걸음이지만 셈 밖(자세 고치던 발이 걷기로 바뀜) · s 자세 고치기 · q 기술 걸음(찌르기 내딛기 등)
  //  센 디딤 = 그 발을 뗄 때 fastBegin 이 디딤 셈 가지를 탔다(앞뒤 몫 > 옆 몫 · walk 또는 걷는 중 catch — 한 번에 한 발만 떠 있어 다음 디딤이 그 발)
  const feet = [];
  const fwdX = (p) => {
    const f = D.forward(_f);
    return p.x * f.x + p.z * f.z;
  };
  const code = (e) => (e.kind === 'walk' || e.kind === 'catch' ? (e.c ? (e.s ? 'S' : 'L') : 'u') : e.kind === 'settle' ? 's' : 'q');
  const G8 = D.gait;
  let counted = false;
  if (G8) {
    const fb = G8.fastBegin.bind(G8);
    G8.fastBegin = (RHx, C, kind, PR, wf, vLat, vb, Tstep) => {
      counted = !!RHx && Math.abs(wf) > vLat && (kind === 'walk' || (kind === 'catch' && G8.walking));
      return fb(RHx, C, kind, PR, wf, vLat, vb, Tstep);
    };
    const td = G8.touchdown.bind(G8);
    G8.touchdown = (l, speed) => {
      const o = td(l, speed);
      feet.push({ t: Gm.t, k: l.k, kind: l.kind, s: l.fastStep ? 1 : 0, c: counted ? 1 : 0, x: fwdX(l.plant) });
      counted = false;
      return o;
    };
  }
  const rt = { n: 0, on: false, x0: 0, f0: 0, t0: 0, F: '', D: 0, T: 0 };
  let rp = null;
  const tapD = D.swordArt?.measure?.reach ?? 1.6; // 탭 찌르기 거리 = 한 걸음 내디뎌 닿는 거리 (레이피어 1.68 m)
  const cnt = () => {
    const g = D.gait;
    return g ? `${g.rhyGo ? 'go' : 'fresh'} N${g.rhyN} F${g.rhyF} P${g.shortPair ?? 0}` : '-';
  };
  // 사람 흉내 (HUMAN=<s>): 처음 읽은 때 거리가 gap 이상이면 그 s 뒤 스틱을 뒤로 — 막기 단추보다 먼저(main.js 가 스틱을 정한 뒤 막기 단추가 도는 차례와 같게)
  let hum = null;
  const human = () => {
    if (HUM == null || rp || r.t1 == null || hum?.done) return;
    if (!hum) hum = r.d1 >= SKILL.itRetreatVals.gap ? { at: r.t1 + HUM, on: false, f0: 0, t0: 0, seen: false } : { done: true };
    if (hum.done) return;
    if (!hum.on && Gm.t >= hum.at) Object.assign(hum, { on: true, f0: feet.length, t0: Gm.t });
    if (!hum.on) return;
    if (guard.retreat) hum.seen = true;
    const walked = feet.slice(hum.f0).filter((e) => e.kind === 'walk' || e.kind === 'catch').length;
    // 끝: retreat2 면 막기 단추가 센 물러서는 한 짝이 끝났을 때 · 아니면 걷는 디딤 둘 · 어느 쪽이든 maxT
    const end = SKILL.itRetreat === 2 ? hum.seen && !guard.retreat : walked >= 2;
    if (end || Gm.t - hum.t0 > SKILL.itRetreatVals.maxT) {
      hum.done = true;
      D.stickX = D.stickY = 0;
      D.move.set(0, 0);
    } else {
      D.stickX = 0;
      D.stickY = -1;
      D.move.set(0, -1);
    }
  };
  Gm.before = () => {
    if (PRESS != null && r.tp == null) {
      const ts = r.t3 ?? (ph === 2 ? t0 + 0.15 : Infinity); // 긋기 시작 (멈춤 중이면 멈춤이 끝나는 때)
      if (Gm.t >= ts + PRESS - 1e-9) (guard.held = true), (r.tp = Gm.t);
    }
    human();
    guard.step(DT);
    D.inputActive = guard.active;
    if (guard.mode === 'defend' && guard.line) r.lines.add(guard.line);
    if (r.d1 == null && guard.stats.threats > 0) (r.d1 = +D.foeDistance().toFixed(2)), (r.t1 = Gm.t); // 처음 공격을 읽은 때 가슴 사이 거리 (물러서기 걸이 gap 과 같은 잣대) · 그 때
    // 물러서는 한 짝 (guard.retreat — parry_button.js): 걸린 때 · 끝난 때 골반 앞 축 자리 · 그동안 디딘 발
    const px = fwdX(D.bodies.pelvis.translation());
    if (guard.retreat && !rt.on) Object.assign(rt, { on: true, n: rt.n + 1, x0: px, f0: feet.length, t0: Gm.t });
    else if (!guard.retreat && rt.on) {
      rt.on = false;
      rt.D += rt.x0 - px;
      rt.T += Gm.t - rt.t0;
      rt.F += feet.slice(rt.f0).map(code).join('');
    }
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(atk.from[0], atk.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = atk.path.map((p) => p.slice())), (r.t3 = Gm.t);
    else if (ph === 3 && go(pts[0][0], pts[0][1], 11) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (r.clash == null && Gm.clashes > c0) r.clash = Gm.t;
    if (!r.cut && !rp) {
      const w = Gm.wounds.find((x) => x.vic === D && x.type !== 'blunt');
      if (w) r.cut = { t: Gm.t, part: w.zone ?? w.part ?? w.region ?? null, ph };
    }
    // 되찌르기 (RIPOSTE=1): 막은 판만 — 막기 판정이 끝나고(긋기 끝 + 0.6 s · 그 전엔 손이 대본 끝에 닿아도 칼이 아직 온다) 물러서는 중이 아니면 막기 단추를 놓고 앞으로 걷다가 reach 안이면 탭 찌르기
    if (RIP && !rp && ph === 4 && Gm.t - t0 > 0.6 && !r.cut && !guard.retreat && !(hum?.on && !hum.done)) {
      rp = { t0: Gm.t, d0: +D.foeDistance().toFixed(2), tap: null, hit: null, self: null, f0: feet.length, cnt: cnt(), done: false };
      guard.held = false;
    }
    if (rp && !rp.done) {
      const el = Gm.t - rp.t0;
      D.move.set(0, 1);
      D.stickX = 0; // 스틱 원값도 앞 끝 (main.js 처럼 — 가까이선 근접 밀치기 걸쇠가 읽는다)
      D.stickY = 1;
      const dn = D.foeDistance();
      if (!rp.tap && dn <= tapD && D.skill.thrust()) rp.tap = { t: +el.toFixed(3), d: +dn.toFixed(2) };
      const w = Gm.wounds.find((x) => x.vic === A && x.att === D && x.type !== 'blunt' && x.t >= rp.t0);
      if (w && !rp.hit) rp.hit = { t: +el.toFixed(3), zone: w.zone };
      const sw = Gm.wounds.find((x) => x.vic === D && x.type !== 'blunt' && x.t >= rp.t0);
      if (sw && !rp.self) rp.self = { t: +el.toFixed(3), zone: sw.zone };
      if (rp.hit || el > RIP_T) {
        rp.done = true;
        D.move.set(0, 0);
        D.stickY = 0;
      }
    }
  };
  const over = () => (rp ? rp.done : ph === 4 && Gm.t - t0 > 0.6 && !(RIP && !r.cut));
  while (!over() && Gm.t < (RIP ? 8 : 6)) Gm.step();
  const lines = [...r.lines].join('>') || '-';
  const nag = r.nag ? 1 : 0;
  const at = r.at == null ? {} : { at: r.at, atPh: r.atPh, atS: r.atS, atE: r.atE, atLn: r.atLn };
  if (rt.on) rt.F += feet.slice(rt.f0).map(code).join('');
  const ex = rt.n ? { rt: rt.n, rtF: rt.F, rtD: +rt.D.toFixed(2), rtT: rt.on ? null : +rt.T.toFixed(2) } : {};
  const research = RIP || NOHOLD || HUM != null || SKILL.itRetreat || SKILL.itParryBeat || cnTok || PRESS != null;
  if (PRESS != null) Object.assign(ex, { t3: r.t3 == null ? null : +r.t3.toFixed(3), tp: r.tp == null ? null : +r.tp.toFixed(3), tc: r.cut ? +r.cut.t.toFixed(3) : null }); // 늦게 누르기 판
  if (r.d1 != null && research) ex.d1 = r.d1; // 연구 판에만 (기본 json 칸은 그대로)
  if (research && W.length) ex.w = W; // 막는 쪽 칼날 상처 모두
  if (research && D.state === 'dead') ex.dead = D.causeOfDeath ?? 'dead';
  if (rp) {
    const fw = feet.slice(rp.f0).filter((e) => e.kind === 'walk' || e.kind === 'catch');
    ex.rp = { d0: rp.d0, tap: rp.tap, hit: rp.hit, self: rp.self, feet: fw.slice(0, 3).map(code).join(''), cnt: rp.cnt };
    if (WA.length) ex.rp.w = WA;
    if (A.state === 'dead') ex.rp.dead = A.causeOfDeath ?? 'dead';
  }
  if (!r.cut && r.clash == null) return { why: 'clear', lines, nag, ...ex };
  if (!r.cut) return { why: 'ok', lines, nag, ...at, ...ex };
  // wind = 긋기 전(준비 동작 · 멈춤)에 벰 — 가까운 간격에서 준비 자세로 가는 칼끝이 다리를 스친다 (10/16 23:5x). 막음 셈에선 전과 같이 못 막음
  if (r.cut.ph < 3) return { why: 'wind', lines, part: r.cut.part, nag, ...at, bp: r.bp, ...ex };
  return { why: r.clash != null && r.clash < r.cut.t ? 'pushed' : 'cut', lines, part: r.cut.part, nag, ...at, bp: r.bp, ...ex };
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
  if (RIP) {
    // 되찌르기 줄 (RIPOSTE=1): 되찌른 판 · 탭 나감 · 맞힘 · 맞힌 때 가운데값(s — 되찌르기 시작부터) · 탭 거리 가운데값 · 그동안 내가 베임 · 나아간 첫 두 걷는 발
    const rr = Object.values(rows).flat().filter((x) => x.rp).map((x) => x.rp);
    const med = (a) => (a.length ? a.sort((p, q) => p - q)[Math.floor(a.length / 2)] : '-');
    const ft = {};
    for (const x of rr) ft[x.feet.slice(0, 2) || '-'] = (ft[x.feet.slice(0, 2) || '-'] ?? 0) + 1;
    const fts = Object.entries(ft).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
    console.log(`${cfg.key.padEnd(18)} 되찌르기 ${rr.length} 판 | 탭 ${rr.filter((x) => x.tap).length} · 맞힘 ${rr.filter((x) => x.hit).length} (맞힌 때 ${med(rr.filter((x) => x.hit).map((x) => x.hit.t))} s) · 탭 거리 ${med(rr.filter((x) => x.tap).map((x) => x.tap.d))} m · 내가 베임 ${rr.filter((x) => x.self).length} | 첫 두 발 ${fts}`);
  }
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
