// 동방 보법 '가벼운 발' 계기 (10/15 — docs/strike/cn_light_feet_2026-10-15.md): 발로 내는 몸 가속 한도의 보통 걸음 몫 × 1.5(유파 걸음 칸 light · GAIT.cnLight)를
//  끔(GAIT.cnLight 0)·켬(1 — 기본)으로 견준다. 칸 없는 유파(독일 롱소드·일본 우치가타나 — 견줄 거리)는 끔·켬이 같아야 한다(같으면 '같음'이라 적고 한 줄만).
//  A — 혼자 걷기 (상대 치움 G.park · 벽 없음 · 씨앗 7): 판 시작 정지(2 s)·쉼 뒤(대본 시작 = 판 시작 뒤 rest s — 3.0·3.2·3.4·3.6·3.8, 또는 걸은 시간을 바꿔 걸음 박자 위상을 퍼뜨림)
//   start = 서 있다가 앞 끝 3 s: 최고 빠르기(2~3 s 골반 앞 빠르기 평균)의 95 % 에 닿는 때(0.1 s 이동 평균) · 0.3·0.5·1.0 s 간 거리(골반)
//   stop  = 앞 끝으로 1.50~1.95 s 걷다(10 판 — 걸음 박자 위상 퍼짐) 스틱 놓기: 서기까지(골반 수평 빠르기 ≤ 0.1 m/s 첫 때 — german_hold §3-7 과 같은 셈) · 미끄러진 거리(골반·가슴)
//   turn  = 앞 끝 1.50~1.95 s → 뒤 끝: 뒤로 0.5 m/s 넘게 갈 때까지(골반 앞 빠르기 ≤ −0.5 첫 때) · 바꾼 뒤 앞으로 더 간 거리 / 뒤 끝 → 앞 끝도(뒤 첫 걸음은 박차기 — 1.5 s 뒤라 끝남)
//   side  = 서 있다가 오른 끝 1.5 s → 놓기: 옆 최고 빠르기의 95 % · 0.3·0.5·1.0 s 옆 거리 · 서기까지 · 미끄러짐
//   tap   = 서 있다가 스틱 톡(앞 끝·오른 끝 0.15·0.3 s 뒤 놓기): 놓은 뒤 1.5 s 까지 간 거리(골반)
//   안정(부분마다 판 합): 넘어짐 · 붙잡기 반사 s(levC > 0.3) · catch · 일찍 디딤/walk 디딤(walk 걸음이 정한 시간 85 % 전에 디딤 — german_hold 와 같은 셈)
//  B — 사람 대본(AI 아님) 대 같은 무기 AI(판단 끔 — 겨눔 자세로 제자리, 상처는 받음 · 벽 없음 · 씨앗 7) · 시작 거리 = 가슴-가슴 수평(foeDistance — AI 간격과 같은 잣대) · 판 시작 정지·쉼(3.3 s) 뒤 앞 끝:
//   cut   = '들어갔다 베고 빼기': 앞 끝으로 들어가다 거리 ≤ 내 무기 measure.reach(서서 한 걸음 휘두르면 닿는 거리 — 이 안이 위험)에서 사선 내려베기(corr 사람 대본 FAM.diagR — 손가락 12 m/s,
//           게임과 같은 입력 길 inputPump 60 Hz · 칼은 처음부터 감기 자리 오른 위) → 베기 시작과 함께(빼기 0) 또는 0.25 s 뒤 스틱 뒤 끝 · 시작 2.4~3.2 m 0.05 m 간격(17 판)
//           잰다: 벤 뒤 상대 reach(같은 무기 — 같은 값) 밖으로 나간 때(베기 시작부터 · 스틱을 뒤로 바꾼 때부터) · 가장 깊이 들어간 거리 · 닿은 때 거리·맞힘 ·
//           클린치(가장 가까움 < measure.clinch, 또는 근접 밀치기 barge·누르기 closeW > 0.05)
//   stand = '원하는 거리에서 서기': 앞 끝으로 들어가다 거리 ≤ contact + 0 · 0.2 · 0.4 m 에서 스틱 놓기 · 시작 2.6~3.4 m 0.025 m 간격(33 판 — 놓을 때 걸음 박자 위상 퍼짐)
//           상대 칼 두 차림: 그대로(겨눈 칼끝이 몸·칼을 막음) · 충돌 끔(걸음만 — german_hold §3-9 브라우저와 같은 차림)
//           잰다: 선 자리(놓은 뒤 골반의 상대 쪽 빠르기가 처음 0.1 m/s 아래가 된 때의 거리) − contact · 놓은 뒤 미끄러짐 · 클린치 비율(선 자리 또는 놓은 뒤 1.5 s 안 가장 가까움 < clinch)
//  재기만 — 물리·난수는 게임 그대로(touchdown·strike 를 감싸 읽기만), 판 하나는 결정적. 스위치는 이 도구가 판마다 GAIT.cnLight 를 바꿔 돈다(with_config 로 준 값은 끝에 되돌림)
//  실행: node tools/sim/cn_light_feel.mjs [무기들 qinggang,goujian] [부분 start,stop,turn,side,tap,cut,stand — 기본 전부] (CLF_ROWS=1 → 판마다 줄)
//   견줄 거리: node tools/sim/cn_light_feel.mjs longsword,uchigatana start,stop,turn,side,tap
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { Input } from '../../src/input.js';
import { inputPump, feedTrace, stroke, setPad, PAD, FAM, wilson } from './corr_lib.mjs';
import { Gait } from '../../src/gait.js';
import { Combat } from '../../src/combat.js';

const { GAIT } = CONFIG;
const ALL = ['start', 'stop', 'turn', 'side', 'tap', 'cut', 'stand'];
const args = process.argv.slice(2);
const WEAPONS_ARG = (args.find((a) => !a.split(',').some((x) => ALL.includes(x))) ?? 'qinggang,goujian').split(',');
const PARTS = new Set((args.find((a) => a.split(',').every((x) => ALL.includes(x))) ?? ALL.join(',')).split(','));
const ROWS = process.env.CLF_ROWS === '1';
const CN0 = GAIT.cnLight;
const ARMS = [0, 1];
const ARM_KO = { 0: '끔', 1: '켬' };
const deps = { Input, CONFIG, DT };
const RESTS = [3.0, 3.2, 3.4, 3.6, 3.8];
const WALKS = [1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95];
const T_WAIT = 3.3;

// ── 읽기만 하는 감싸개 ──
let rec = null;
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  const early = kind === 'walk' && l.t < 0.85 * l.T;
  TD0.call(this, l, speed);
  if (rec && this.f === rec.P) rec.tds.push({ t: rec.t, kind, early });
};
const S0 = Combat.prototype.strike;
Combat.prototype.strike = function (pr, point, passing) {
  if (rec && rec.E && !rec.contact && rec.cutT != null && rec.t >= rec.cutT && pr.w.fighter === rec.P && pr.v.fighter === rec.E) rec.contact = { t: rec.t, d: rec.P.foeDistance(), part: pr.v.part };
  return S0.call(this, pr, point, passing);
};

const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const fin = (a) => a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
const medOf = (a) => {
  const b = fin(a);
  if (!b.length) return null;
  const m = (b.length - 1) / 2;
  return (b[Math.floor(m)] + b[Math.ceil(m)]) / 2;
};
/** 중앙 [범위] (값이 하나면 그 값만) */
const mr = (a) => {
  const b = fin(a);
  if (!b.length) return '-';
  return b.length === 1 || b[0] === b[b.length - 1] ? f2(b[0]) : `${f2(medOf(b))} [${f2(b[0])}~${f2(b[b.length - 1])}]`;
};
const pct = (k, n) => {
  if (!n) return '-';
  const [lo, hi] = wilson(k, n);
  return `${k}/${n} (${Math.round((100 * k) / n)} % · ${Math.round(100 * lo)}~${Math.round(100 * hi)})`;
};
const stabOf = (runs) => {
  const s = runs.reduce((a, o) => ({ falls: a.falls + o.falls, lev: a.lev + o.lev, c: a.c + o.catches, e: a.e + o.early, w: a.w + o.walkTD }), { falls: 0, lev: 0, c: 0, e: 0, w: 0 });
  return `${s.falls} · ${f2(s.lev)} · ${s.c} · ${s.e}/${s.w}`;
};

// ── A: 혼자 걷기 ──
/**
 * 판 하나: 판 시작 뒤 rest s 서 있다가 seq([스틱 x(오른 +), 스틱 y(앞 +), 시간 s] …)를 차례로. 대본 시작 때 몸의 앞·오른쪽 축으로 골반·가슴 자리와 골반 빠르기(물리 값 그대로)를 스텝마다 적는다
 */
function solo(weapon, arm, rest, seq) {
  GAIT.cnLight = arm;
  const G = newRound({ walls: false, seed: 7, weapon, weapon2: 'longsword' });
  G.park();
  const P = G.player;
  const g = P.gait;
  let t = 0;
  while (t < rest - 1e-9) {
    P.move.set(0, 0);
    G.step();
    t += DT;
  }
  const fwd = P.forward(new THREE.Vector3());
  const rgt = P.right(new THREE.Vector3());
  const p0 = P.bodies.pelvis.translation();
  const c0 = P.bodies.chest.translation();
  const P0 = { x: p0.x, z: p0.z };
  const C0 = { x: c0.x, z: c0.z };
  const o = { light: g.P.light ?? null, tr: [], pf: [], pr: [], vf: [], vr: [], cf: [], cr: [], falls: 0, lev: 0 };
  rec = { P, t: 0, tds: [] };
  let prev = P.state;
  let tr = 0;
  let i = 0;
  let segEnd = seq[0][2];
  const total = seq.reduce((a, s) => a + s[2], 0);
  while (tr < total - 1e-9) {
    while (i < seq.length - 1 && tr >= segEnd - 1e-9) segEnd += seq[++i][2];
    P.move.set(seq[i][0], seq[i][1]);
    G.step();
    tr += DT;
    rec.t = tr;
    const p = P.bodies.pelvis.translation();
    const c = P.bodies.chest.translation();
    const v = P.bodies.pelvis.linvel();
    o.tr.push(tr);
    o.pf.push((p.x - P0.x) * fwd.x + (p.z - P0.z) * fwd.z);
    o.pr.push((p.x - P0.x) * rgt.x + (p.z - P0.z) * rgt.z);
    o.cf.push((c.x - C0.x) * fwd.x + (c.z - C0.z) * fwd.z);
    o.cr.push((c.x - C0.x) * rgt.x + (c.z - C0.z) * rgt.z);
    o.vf.push(v.x * fwd.x + v.z * fwd.z);
    o.vr.push(v.x * rgt.x + v.z * rgt.z);
    if (prev === 'stand' && P.state === 'down') o.falls++;
    prev = P.state;
    if (g.active && g.levC > 0.3) o.lev += DT;
  }
  o.catches = rec.tds.filter((x) => x.kind === 'catch').length;
  o.early = rec.tds.filter((x) => x.early).length;
  o.walkTD = rec.tds.filter((x) => x.kind === 'walk').length;
  rec = null;
  GAIT.cnLight = CN0;
  return o;
}
const idxAt = (o, t) => Math.max(0, Math.min(o.tr.length - 1, Math.round(t / DT) - 1));
const valAt = (arr, o, t) => arr[idxAt(o, t)];
/** 0.1 s 이동 평균 빠르기 (그 축의 자리 차 ÷ 0.1) */
const winV = (arr, i) => {
  const n = Math.round(0.1 / DT);
  return i >= n ? (arr[i] - arr[i - n]) / 0.1 : null;
};
/** 출발: 축 자리 arr · 빠르기 varr — 최고(평균 [a, b] s) · 95 % 에 닿는 때(0.1 s 이동 평균) · 0.3·0.5·1.0 s 간 거리 */
function startStats(o, arr, varr, a, b) {
  const sel = o.tr.map((t, i) => (t > a && t <= b + 1e-9 ? varr[i] : null)).filter((x) => x != null);
  const top = sel.reduce((s, x) => s + x, 0) / sel.length;
  let t95 = null;
  for (let i = 0; i < arr.length; i++) {
    const w = winV(arr, i);
    if (w != null && w >= 0.95 * top) {
      t95 = o.tr[i];
      break;
    }
  }
  return { top, t95, d03: valAt(arr, o, 0.3), d05: valAt(arr, o, 0.5), d10: valAt(arr, o, 1.0) };
}
/** 놓은 뒤(t1 부터) 골반 수평 빠르기 ≤ 0.1 m/s 첫 때 · 그때까지 간 거리(골반·가슴 — 축 arr·carr) · 놓기 전 0.3 s 빠르기 평균 */
function stopStats(o, t1, arr, carr, varr) {
  const i1 = idxAt(o, t1);
  const pre = [];
  for (let i = 0; i <= i1; i++) if (o.tr[i] > t1 - 0.3) pre.push(Math.abs(varr[i]));
  let ts = null;
  let ds = null;
  let dc = null;
  for (let i = i1 + 1; i < o.tr.length; i++) {
    if (Math.hypot(o.vf[i], o.vr[i]) <= 0.1) {
      ts = o.tr[i] - t1;
      ds = Math.abs(arr[i] - arr[i1]);
      dc = Math.abs(carr[i] - carr[i1]);
      break;
    }
  }
  return { v0: pre.reduce((s, x) => s + x, 0) / pre.length, ts, ds, dc, dEnd: Math.abs(arr[arr.length - 1] - arr[i1]) };
}
/** 바꿈: t1 에 스틱 쪽이 sgn 에서 −sgn 으로 — 반대쪽으로 0.5 m/s 넘게 갈 때까지 · 그 전에 원래 쪽으로 더 간 거리(골반) · 바꾸기 전 0.3 s 빠르기 */
function turnStats(o, t1, sgn) {
  const i1 = idxAt(o, t1);
  const pre = [];
  for (let i = 0; i <= i1; i++) if (o.tr[i] > t1 - 0.3) pre.push(sgn * o.vf[i]);
  let tb = null;
  let extra = 0;
  for (let i = i1 + 1; i < o.tr.length; i++) {
    extra = Math.max(extra, sgn * (o.pf[i] - o.pf[i1]));
    if (tb == null && -sgn * o.vf[i] > 0.5) tb = o.tr[i] - t1;
  }
  return { v0: pre.reduce((s, x) => s + x, 0) / pre.length, tb, extra };
}

/** 무기 하나·부분 하나를 끔·켬으로 돌림 → { arm: [판들] } · 칸 없는 무기는 켬 판이 끔과 같은지 본다 */
function both(weapon, runFn) {
  const out = {};
  for (const arm of ARMS) out[arm] = runFn(arm);
  const same = JSON.stringify(out[0].map((r) => r.key)) === JSON.stringify(out[1].map((r) => r.key));
  return { out, same };
}
const keyOf = (o) => `${o.pf.length}|${o.pf[o.pf.length - 1]}|${o.vf[o.vf.length - 1]}|${o.pr[o.pr.length - 1]}`;

console.log('# 동방 보법 가벼운 발 계기 — 끔(`GAIT.cnLight=0`) · 켬(기본) · 씨앗 7 · 무기 ' + WEAPONS_ARG.join(', '));
console.log(`- 걷기 값: moveSpeed ${GAIT.moveSpeed} m/s · 뒤 × ${GAIT.backFactor} · 옆 × ${GAIT.sideFactor} · 가속 한도 maxAccel ${GAIT.maxAccel} m/s² (켬 · 동방 = × 1.5 → ${(GAIT.maxAccel * 1.5).toFixed(1)}) · 박차기·세게 멈춤 × ${GAIT.burstAccel}`);

const tableRow = (cells) => `| ${cells.join(' | ')} |`;
for (const weapon of WEAPONS_ARG) {
  if (PARTS.has('start')) {
    const { out, same } = both(weapon, (arm) => RESTS.map((r) => {
      const o = solo(weapon, arm, r, [[0, 1, 3.0]]);
      return { key: keyOf(o), o, s: startStats(o, o.pf, o.vf, 2.0, 3.0) };
    }));
    console.log(`\n## A-start · ${weapon} — 서 있다가 앞 끝 3 s (쉼 ${RESTS.join('·')} s — 5 판 중앙 [범위]) · light ${out[1][0].o.light ?? '없음'}${same ? ' · 끔·켬 같음' : ''}\n`);
    console.log('| 갈래 | 최고 빠르기 m/s (2~3 s 평균) | 95 % 에 닿는 때 s | 0.3 s 간 거리 m | 0.5 s | 1.0 s | 안정 (넘어짐·붙잡기 반사 s·catch·일찍 디딤/walk 디딤) |');
    console.log('|---|---|---|---|---|---|---|');
    for (const arm of same ? [0] : ARMS) {
      const R = out[arm];
      console.log(tableRow([same ? '끔 = 켬' : ARM_KO[arm], mr(R.map((r) => r.s.top)), mr(R.map((r) => r.s.t95)), mr(R.map((r) => r.s.d03)), mr(R.map((r) => r.s.d05)), mr(R.map((r) => r.s.d10)), stabOf(R.map((r) => r.o))]));
    }
  }
  if (PARTS.has('stop')) {
    const { out, same } = both(weapon, (arm) => WALKS.map((T) => {
      const o = solo(weapon, arm, T_WAIT, [[0, 1, T], [0, 0, 2.0]]);
      return { key: keyOf(o), o, T, s: stopStats(o, T, o.pf, o.cf, o.vf) };
    }));
    console.log(`\n## A-stop · ${weapon} — 앞 끝 ${WALKS[0]}~${WALKS[WALKS.length - 1]} s 걷다 스틱 놓기 (10 판 중앙 [범위])${same ? ' · 끔·켬 같음' : ''}\n`);
    console.log('| 갈래 | 놓기 전 0.3 s 골반 빠르기 m/s | 서기까지 s (골반 ≤ 0.1 m/s) | 미끄러짐 골반 m | 가슴 m | 놓은 뒤 2 s 골반 m | 안정 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const arm of same ? [0] : ARMS) {
      const R = out[arm];
      console.log(tableRow([same ? '끔 = 켬' : ARM_KO[arm], mr(R.map((r) => r.s.v0)), mr(R.map((r) => r.s.ts)), mr(R.map((r) => r.s.ds)), mr(R.map((r) => r.s.dc)), mr(R.map((r) => r.s.dEnd)), stabOf(R.map((r) => r.o))]));
    }
    if (ROWS) for (const arm of ARMS) for (const r of out[arm]) console.log(`  ${ARM_KO[arm]} 걸음 ${r.T} s: v0 ${f2(r.s.v0)} · 서기 ${f2(r.s.ts)} s · 골반 ${f2(r.s.ds)} · 가슴 ${f2(r.s.dc)}`);
  }
  if (PARTS.has('turn')) {
    for (const [nm, sgn] of [['앞 끝 → 뒤 끝', 1], ['뒤 끝 → 앞 끝', -1]]) {
      const { out, same } = both(weapon, (arm) => WALKS.map((T) => {
        const o = solo(weapon, arm, T_WAIT, [[0, sgn, T], [0, -sgn, 2.0]]);
        return { key: keyOf(o), o, T, s: turnStats(o, T, sgn) };
      }));
      console.log(`\n## A-turn · ${weapon} — ${nm} (먼저 쪽 ${WALKS[0]}~${WALKS[WALKS.length - 1]} s 걷다 바꿈 · 10 판 중앙 [범위])${same ? ' · 끔·켬 같음' : ''}\n`);
      console.log(`| 갈래 | 바꾸기 전 0.3 s 빠르기 m/s | ${sgn > 0 ? '뒤로' : '앞으로'} 0.5 m/s 넘게 갈 때까지 s | 바꾼 뒤 ${sgn > 0 ? '앞으로' : '뒤로'} 더 간 거리 m (골반) | 안정 |`);
      console.log('|---|---|---|---|---|');
      for (const arm of same ? [0] : ARMS) {
        const R = out[arm];
        console.log(tableRow([same ? '끔 = 켬' : ARM_KO[arm], mr(R.map((r) => r.s.v0)), mr(R.map((r) => r.s.tb)), mr(R.map((r) => r.s.extra)), stabOf(R.map((r) => r.o))]));
      }
      if (ROWS) for (const arm of ARMS) for (const r of out[arm]) console.log(`  ${ARM_KO[arm]} 걸음 ${r.T} s: v0 ${f2(r.s.v0)} · 바뀜 ${f2(r.s.tb)} s · 더 감 ${f2(r.s.extra)}`);
    }
  }
  if (PARTS.has('side')) {
    const { out, same } = both(weapon, (arm) => RESTS.map((r) => {
      const o = solo(weapon, arm, r, [[1, 0, 1.5], [0, 0, 2.0]]);
      return { key: keyOf(o), o, s: startStats(o, o.pr, o.vr, 1.0, 1.5), e: stopStats(o, 1.5, o.pr, o.cr, o.vr) };
    }));
    console.log(`\n## A-side · ${weapon} — 서 있다가 오른 끝 1.5 s → 놓기 (쉼 ${RESTS.join('·')} s — 5 판 중앙 [범위])${same ? ' · 끔·켬 같음' : ''}\n`);
    console.log('| 갈래 | 옆 최고 빠르기 m/s (1~1.5 s 평균) | 95 % 에 닿는 때 s | 0.3 s 옆 거리 m | 0.5 s | 1.0 s | 놓기 전 0.3 s 빠르기 | 서기까지 s | 미끄러짐 골반 m | 안정 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const arm of same ? [0] : ARMS) {
      const R = out[arm];
      console.log(tableRow([same ? '끔 = 켬' : ARM_KO[arm], mr(R.map((r) => r.s.top)), mr(R.map((r) => r.s.t95)), mr(R.map((r) => r.s.d03)), mr(R.map((r) => r.s.d05)), mr(R.map((r) => r.s.d10)), mr(R.map((r) => r.e.v0)), mr(R.map((r) => r.e.ts)), mr(R.map((r) => r.e.ds)), stabOf(R.map((r) => r.o))]));
    }
  }
  if (PARTS.has('tap')) {
    console.log(`\n## A-tap · ${weapon} — 서 있다가 스틱 톡 → 놓은 뒤 1.5 s 까지 간 거리 골반 m (쉼 ${RESTS.join('·')} s — 5 판 중앙 [범위])\n`);
    console.log('| 스틱 · 누른 시간 | 끔 | 켬 | 가장 멀리 끔 | 켬 | 안정 끔 | 켬 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const [nm, x, y] of [['앞 끝', 0, 1], ['오른 끝', 1, 0]]) {
      for (const T of [0.15, 0.3]) {
        const { out, same } = both(weapon, (arm) => RESTS.map((r) => {
          const o = solo(weapon, arm, r, [[x, y, T], [0, 0, 1.5]]);
          const arr = y ? o.pf : o.pr;
          return { key: keyOf(o), o, d: arr[arr.length - 1], dMax: Math.max(...arr) };
        }));
        console.log(tableRow([`${nm} ${T} s${same ? ' (끔·켬 같음)' : ''}`, mr(out[0].map((r) => r.d)), mr(out[1].map((r) => r.d)), mr(out[0].map((r) => r.dMax)), mr(out[1].map((r) => r.dMax)), stabOf(out[0].map((r) => r.o)), stabOf(out[1].map((r) => r.o))]));
      }
    }
  }
}

// ── B: 사람 대본 대 같은 무기 AI(판단 끔) ──
/**
 * 판 하나. 시작 거리 D(가슴-가슴) · 판 시작 정지·쉼 T_WAIT 뒤 스틱 앞 끝 → trig(거리 d)가 참이 된 때(t1)부터 after(tr — t1 뒤 시각) 가 스틱을 정함 · cut = t1 에 사선 내려베기 · end = t1 뒤 끝 시각
 */
function duel({ weapon, arm, D, gapOff, trig, after, cut = false, end = 2.0, maxApproach = 4.0, foeSwordOff = false }) {
  GAIT.cnLight = arm;
  const G = newRound({ walls: false, seed: 7, weapon, weapon2: weapon, gap: D + gapOff });
  const P = G.player;
  const E = G.enemy;
  G.ai.update = () => E.move.set(0, 0); // 상대 AI 판단 끔 — 겨눔 자세로 제자리
  if (foeSwordOff) for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0); // 상대 칼 충돌 끔 (겨눈 칼끝이 내 몸·칼을 막지 않게 — german_hold §3-9 브라우저와 같음)
  setPad(P, PAD.ShR); // 칼은 감기 자리(오른 위)에서 기다림
  const pump = inputPump(G, deps, { pace: () => 60 });
  pump.stick = { x: 0, y: 0 };
  const fr = pump.frame;
  pump.frame = () => {
    fr();
    P.stickX = pump.stick.x; // main.js 처럼 스틱 원값
    P.stickY = pump.stick.y;
  };
  const g = P.gait;
  const meas = P.swordArt.measure;
  const foeReach = E.swordArt.measure.reach;
  let t = 0;
  rec = { P, E, t: 0, cutT: null, contact: null, tds: [] };
  const step = () => {
    G.step();
    t += DT;
    rec.t = t;
  };
  while (t < T_WAIT) step();
  const d0 = P.foeDistance();
  const o = { d0, falls: 0, lev: 0, t1: null, d1: null, v1: null, minD: Infinity, clinchState: false, stop: null, out: null, outRev: null, tRev: null, inside: false };
  let prev = P.state;
  const tP = t;
  let u = null;
  while (true) {
    const tr = o.t1 == null ? null : t - o.t1;
    if (o.t1 == null && t - tP > maxApproach) break;
    if (tr != null && tr >= end - 1e-9) break;
    const s = tr == null ? { x: 0, y: 1 } : after(tr, o);
    if (tr != null && o.tRev == null && s.y < 0) o.tRev = t;
    pump.stick.x = s.x;
    pump.stick.y = s.y;
    step();
    const d = P.foeDistance();
    if (prev === 'stand' && P.state === 'down') o.falls++;
    prev = P.state;
    if (g.active && g.levC > 0.3) o.lev += DT;
    if (P.barge || P.closeW > 0.05) o.clinchState = true;
    const a = P.bodies.chest.translation();
    const b = E.bodies.chest.translation();
    if (o.t1 == null && trig(d)) {
      o.t1 = t;
      o.d1 = d;
      u = { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
      const v = P.bodies.pelvis.linvel();
      o.v1 = v.x * u.x + v.z * u.z;
      if (cut) {
        const off = [P.handOffset.x, P.handOffset.y];
        feedTrace(G, stroke(FAM.diagR.end[0] - off[0], FAM.diagR.end[1] - off[1], FAM.diagR.v, { down: true, lift: true }));
        rec.cutT = t;
      }
    }
    if (o.t1 != null) {
      o.minD = Math.min(o.minD, d);
      if (d < foeReach) o.inside = true;
      const v = P.bodies.pelvis.linvel();
      const vt = v.x * u.x + v.z * u.z;
      if (!o.stop && t > o.t1 && vt <= 0.1) o.stop = { t: t - o.t1, d };
      if (o.inside && o.out == null && d > foeReach) {
        o.out = t - o.t1;
        if (o.tRev != null) o.outRev = t - o.tRev;
      }
    }
  }
  const w = G.wounds.filter((x) => x.att === P && x.vic === E && rec.cutT != null && x.t >= rec.cutT - 1e-9);
  o.hit = w.some((x) => x.severity > 0);
  o.got = G.wounds.filter((x) => x.att === E && x.vic === P).length; // (판단 끔이라 0 이어야 함 — 겨눈 칼에 걸려 다침만)
  o.contact = rec.contact;
  o.dEnd = P.foeDistance();
  o.catches = rec.tds.filter((x) => x.kind === 'catch' && x.t >= tP).length;
  o.early = rec.tds.filter((x) => x.early && x.t >= tP).length;
  o.walkTD = rec.tds.filter((x) => x.kind === 'walk' && x.t >= tP).length;
  o.meas = meas;
  o.foeReach = foeReach;
  rec = null;
  GAIT.cnLight = CN0;
  return o;
}
// 시작 거리 맞추기: 골반 간격 − 서 있는 가슴 거리 (무기마다 한 번 — 결정적)
const calibC = new Map();
function gapOf(weapon) {
  if (!calibC.has(weapon)) {
    const o = duel({ weapon, arm: 0, D: 2.6, gapOff: 0, trig: () => true, after: () => ({ x: 0, y: 0 }), end: 0.001 });
    calibC.set(weapon, 2.6 - o.d0);
  }
  return calibC.get(weapon);
}
for (const weapon of WEAPONS_ARG) {
  if (PARTS.has('cut')) {
    const g0 = gapOf(weapon);
    const ref = duel({ weapon, arm: 0, D: 2.6, gapOff: g0, trig: () => true, after: () => ({ x: 0, y: 0 }), end: 0.001 });
    const m = ref.meas;
    console.log(`\n## B-cut · ${weapon} — 들어갔다 베고 빼기: 앞 끝 → 거리 ≤ reach ${f2(m.reach)} m 에서 사선 내려베기 → 스틱 뒤 끝 (상대 = 같은 무기 AI 판단 끔 · reach ${f2(ref.foeReach)} · contact ${f2(m.contact)} · clinch ${f2(m.clinch)} m · 시작 2.4~3.2 m 0.05 m 간격 17 판)\n`);
    console.log('| 빼기 (베기 시작 뒤 s) | 갈래 | 벤 때 빠르기 m/s (상대 쪽) | 상대 reach 밖까지 s (베기 시작부터) | (스틱 뒤로부터) | 나간 판 | 가장 깊이 m | 클린치 (95 % 띠) | 닿은 때 거리 m (닿은 판) | 맞힘 (95 % 띠) | 안정 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const back of [0, 0.25]) {
      for (const arm of ARMS) {
        const R = [];
        for (let k = 0; k <= 16; k++) {
          const D = 2.4 + 0.05 * k;
          R.push(duel({ weapon, arm, D, gapOff: g0, cut: true, trig: (d) => d <= m.reach, after: (tr) => (tr < back - 1e-9 ? { x: 0, y: 1 } : { x: 0, y: -1 }), end: 2.5 }));
        }
        const n = R.length;
        const outs = R.filter((o) => o.out != null);
        const cd = R.filter((o) => o.contact).map((o) => o.contact.d);
        const cl = R.filter((o) => o.minD < m.clinch || o.clinchState).length;
        console.log(tableRow([back, ARM_KO[arm], mr(R.map((o) => o.v1)), mr(outs.map((o) => o.out)), mr(outs.map((o) => o.outRev)), `${outs.length}/${n}`, mr(R.map((o) => o.minD)), pct(cl, n), `${mr(cd)} (${cd.length})`, pct(R.filter((o) => o.hit).length, n), stabOf(R)]));
        if (ROWS) for (const o of R) console.log(`  ${ARM_KO[arm]} 빼기 ${back}: 시작 ${f2(o.d0)} · 벤 때 ${f2(o.d1)} m ${f2(o.v1)} m/s · 밖 ${f2(o.out)} s · 깊이 ${f2(o.minD)} · 닿음 ${o.contact ? `${f2(o.contact.d)} ${o.contact.part}` : '-'} · ${o.hit ? '맞힘' : '-'} · 받은 상처 ${o.got}`);
      }
    }
  }
  if (PARTS.has('stand')) {
    const g0 = gapOf(weapon);
    const ref = duel({ weapon, arm: 0, D: 2.6, gapOff: g0, trig: () => true, after: () => ({ x: 0, y: 0 }), end: 0.001 });
    const m = ref.meas;
    console.log(`\n## B-stand · ${weapon} — 원하는 거리에서 서기: 앞 끝으로 들어가다 거리 ≤ contact + 덧 에서 스틱 놓기 (contact ${f2(m.contact)} · clinch ${f2(m.clinch)} m · 상대 = 같은 무기 AI 판단 끔 · 시작 2.6~3.4 m 0.025 m 간격 33 판)`);
    console.log('- 상대 칼: 그대로 = 겨눈 칼끝이 몸·칼을 막음(판단 끔 상대의 겨눔 — 실제 판에서는 상대 칼이 움직인다) · 충돌 끔 = 걸음만 보기(german_hold §3-9 브라우저와 같은 차림)\n');
    console.log('| 상대 칼 | 놓는 거리 m (contact + 덧) | 갈래 | 놓을 때 빠르기 m/s (상대 쪽) | 서기까지 s | 놓은 뒤 미끄러짐 m | 선 자리 − contact m | 놓은 뒤 1.5 s 가장 가까움 − contact m | 클린치 (95 % 띠) | 안정 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const foeSwordOff of [false, true]) {
      for (const add of [0, 0.2, 0.4]) {
        for (const arm of ARMS) {
          const R = [];
          for (let k = 0; k <= 32; k++) {
            const D = 2.6 + 0.025 * k;
            R.push(duel({ weapon, arm, D, gapOff: g0, foeSwordOff, trig: (d) => d <= m.contact + add, after: () => ({ x: 0, y: 0 }), end: 1.5 }));
          }
          const n = R.length;
          const cl = R.filter((o) => (o.stop && o.stop.d < m.clinch) || o.minD < m.clinch || o.clinchState).length;
          console.log(tableRow([foeSwordOff ? '충돌 끔' : '그대로', `${f2(m.contact + add)} (+${add})`, ARM_KO[arm], mr(R.map((o) => o.v1)), mr(R.map((o) => o.stop?.t)), mr(R.map((o) => (o.stop ? o.d1 - o.stop.d : null))), mr(R.map((o) => (o.stop ? o.stop.d - m.contact : null))), mr(R.map((o) => o.minD - m.contact)), pct(cl, n), stabOf(R)]));
          if (ROWS) for (const o of R) console.log(`  ${foeSwordOff ? '칼 끔' : '칼'} ${ARM_KO[arm]} +${add}: 시작 ${f2(o.d0)} · 놓음 ${f2(o.d1)} m ${f2(o.v1)} m/s · 섬 ${o.stop ? `${f2(o.stop.t)} s ${f2(o.stop.d)} m` : '-'} · 가장 가까움 ${f2(o.minD)}`);
        }
      }
    }
  }
}
GAIT.cnLight = CN0;
