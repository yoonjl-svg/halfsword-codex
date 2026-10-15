// 걸음 고르기 계기 (10/15 — 이탈리아 보법 '고른 바탕 걸음 · 작게 빨리' docs/strike/italian_rhythm_2026-10-15.md §10 · 유파 보폭 규칙 docs/strike/stride_rule_2026-10-15.md): 플레이어 스틱 대본에서 디딤마다
//  시각 · 간격 · 발(이끄는 = 다른 발보다 가는 쪽으로 앞에 딛음 / 따라붙는 = 뒤에 딛음) · 발이 옮긴 거리(뜬 자리 → 디딘 자리) · 몸이 간 거리(골반, 가는 쪽 몫) ·
//  그 발을 떼기 전 두 발 디딤 시간(짝걸음이면 짝 사이 쉼) · catch · 일찍 디딤 · 빠른 디딤(박자 걸음) · 발소리(sound.js BodySounds 판정 흉내 — 발 몸체 0.09 m 위로 떴다가 0.06 m 아래로,
//  0.12 s 안 두 번은 하나 · 강조 = 그 발 leg.fastStep — 이탈리아 고른 짝걸음은 게임처럼 걷는 디딤마다)를 뽑고 '고르기'를 숫자로 — 무기(유파)·박자 걸음 갈래끼리 같은 표.
//  고르기 칸 (걷는 동안 — 처음 두 디딤은 출발 몫이라 뺌):
//   간격 CV = 디딤 간격 표준편차 ÷ 평균 · 이끔→따름 ÷ 따름→이끔(a/b — 짝걸음 '따·닥'이면 작고 고른 걸음이면 1) · 옮긴 거리 CV · 이끄는 발 ÷ 따라붙는 발 옮긴 거리 ·
//   몸 빠르기 CV = 골반 가는 쪽 빠르기(0.02 s 마다) 표준편차 ÷ 평균 · 거의 섬 몫 = 그 빠르기가 평균의 30 % 아래인 시간 몫(몸이 섰다가 튀어 나가는 꼴) ·
//   몸 앞뒤 출렁임 cm = 골반이 간 자리(가는 쪽)에서 매끈한 2 차 곡선을 뺀 나머지의 표준편차 · 골반 높이 표준편차 cm · 짝 사이 쉼(따라붙는 발 디딤 → 다음 이끄는 발 뗌) 평균 · 걸음 꼴 바뀜(follow ↔ 지나 딛기) 수
//   박자 걸음이 켜졌으면: 보통 디딤 간격 CV(보통 디딤으로 끝나는 간격끼리) · 빠름 ÷ 보통(빠른 디딤으로 끝나는 간격 평균 ÷ 보통) — 목표 1 ÷ mul
//  대본 (스틱 앞뒤 y): A 앞 끝 3 s · B 뒤 끝 3 s · T 앞으로 짧게 톡(0.2 s 밀고 놓음 1.3 s) · U 뒤로 톡 · AH 앞 반(0.5) 3 s · BH 뒤 반(0.5) 3 s — 상대를 멀리 치움(혼자, 벽 없음)
//   NA 앞 끝 1.5 s · NB 뒤 끝 3 s · NH 앞 반(0.45) 3 s · NI 뒤 반(0.5) 3 s · NT 앞 톡 · NU 뒤 톡 — 상대가 가슴 거리 2.3 m 를 지킴(follow 문턱 2.8 m 안 — 가까이 ·
//    GEF_KEEP = 지키는 거리 · GEF_APPROACH = 다가가는 스틱 0.5 — 쉬는 자세의 발 자리가 달라짐)
//   톡: 디딤 수 · 마지막 디딤 시각(민 때부터) · 골반이 0.1 m/s 아래로 서는 시각 · 선 자리까지 간 거리
//  안정: 넘어짐 · 붙잡기 반사 s(levC > 0.3) · catch · 일찍 디딤(walk 걸음이 정한 발 뜬 시간 85 % 전) · 걷는 중 기술 걸음(req·draw) 수(런지 꼴이 걸음에 섞이나)
//  재기만 — 물리·난수는 게임 그대로(begin·touchdown 을 감싸 읽기만), 판 하나는 결정적. 다가가기·쉼은 박자 걸음 끔으로(갈래끼리 출발 자리가 같게)
//  실행: node tools/sim/gait_even_feel.mjs [무기들 rapier,longsword,uchigatana] [박자 걸음 갈래들 0,2+2] [대본들 A,B,T,U,NA,NB,NH,NI,NT,NU — AH·BH 도 있음]
//   박자 걸음 갈래는 setItalianRhythm 글(이탈리아 무기만 — 다른 무기는 한 번) · '-' = 손대지 않음(src 기본)
//   GEF_ROWS=1 → 디딤마다 줄(갈래마다) · GEF_CURVE=1 → 골반 빠르기 0.02 s 마다(첫 무기·갈래) · GEF_SUM=1 → 요약 줄만(H 표 — 대본마다 무기 한 줄)
import { newRound, DT, THREE } from './harness_m.mjs';
import { Gait } from '../../src/gait.js';
import { TRADITIONS, traditionOf, setItalianRhythm } from '../../src/schools.js';
import { getWeapon } from '../../src/weapons.js';

// GAIT_JSON='{"italian":{"even":{"pair":{"lead":0.8}}}}' → 그 유파 걸음 칸에 덮어 잰다(값 고르기용 — 객체 칸은 안쪽까지 덮음)
const deep = (a, b) => {
  const o = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? deep(a?.[k], v) : v;
  return o;
};
if (process.env.GAIT_JSON) for (const [t, o] of Object.entries(JSON.parse(process.env.GAIT_JSON))) TRADITIONS[t].gait = deep(TRADITIONS[t].gait, o);
const IDS = (process.argv[2] || 'rapier,longsword,uchigatana').split(',');
const RHY = (process.argv[3] || '0,2+2').split(',');
const SCN = (process.argv[4] || 'A,B,T,U,NA,NB,NH,NI,NT,NU').split(',');
const ROWS = process.env.GEF_ROWS === '1';
const CURVE = process.env.GEF_CURVE === '1';
const SUM = process.env.GEF_SUM === '1';
const RH = TRADITIONS.italian.gait.rhythm;
const RH0 = { ...RH };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const _f = new THREE.Vector3();

const SCRIPTS = {
  A: { far: true, name: '앞 끝 3 s', seq: [[1, 3]] },
  B: { far: true, name: '뒤 끝 3 s', seq: [[-1, 3]] },
  T: { far: true, tap: true, name: '앞 톡 0.2 s', seq: [[1, 0.2], [0, 1.3]] },
  U: { far: true, tap: true, name: '뒤 톡 0.2 s', seq: [[-1, 0.2], [0, 1.3]] },
  AH: { far: true, name: '앞 반(0.5) 3 s', seq: [[0.5, 3]] },
  BH: { far: true, name: '뒤 반(0.5) 3 s', seq: [[-0.5, 3]] },
  NA: { name: '가까이 앞 끝 1.5 s', seq: [[1, 1.5]] },
  NB: { name: '가까이 뒤 끝 3 s', seq: [[-1, 3]] },
  NH: { name: '가까이 앞 반(0.45) 3 s', seq: [[0.45, 3]] },
  NI: { name: '가까이 뒤 반(0.5) 3 s', seq: [[-0.5, 3]] },
  NT: { tap: true, name: '가까이 앞 톡 0.2 s', seq: [[1, 0.2], [0, 1.3]] },
  NU: { tap: true, name: '가까이 뒤 톡 0.2 s', seq: [[-1, 0.2], [0, 1.3]] },
};
const KEEP = +process.env.GEF_KEEP || 2.3; // 가까이 대본에서 상대가 지키는 가슴 거리 (GEF_KEEP)
const RELEASE = 1.0; // 톡 아닌 대본 뒤 스틱을 놓는 시간 s (멈춤 거리)
const APPROACH = +process.env.GEF_APPROACH || 0.5; // 가까이 대본 다가가는 스틱 (GEF_APPROACH — 쉬는 자세의 발 자리가 달라짐)

let rec = null;
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  const ds = this.sinceTD;
  B0.call(this, l, kind, T);
  if (!rec || this.f !== rec.who) return;
  rec.begins.push({ t: rec.t, k: l.k, kind, x: l.p0.x, z: l.p0.z, fastK: this.fastK, follow: !!this.follow, pairOn: !!this.pairOn, pairStep: this.pairStep, walking: !!this.walking, T, ds, lastTD: this.lastTD });
  rec.open[l.k] = rec.begins[rec.begins.length - 1];
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  const early = kind === 'walk' && l.t < 0.85 * l.T;
  TD0.call(this, l, speed);
  if (!rec || this.f !== rec.who) return;
  const o = this.legs[l.k === 'F' ? 'B' : 'F'];
  const b = rec.open[l.k];
  rec.open[l.k] = null;
  const p = this.f.bodies.pelvis.translation();
  rec.tds.push({ t: rec.t, k: l.k, kind, early, x: l.plant.x, z: l.plant.z, ox: o.plant.x, oz: o.plant.z, b, px: p.x, pz: p.z, fast: !!(b && b.fastK > 1), follow: !!this.follow });
  // 이탈리아 고른 짝걸음(P.pair.even): 게임 발소리는 걷는 디딤마다(sound.js BodySounds — gait leg.tdN) — 같은 발 0.08 s 안 두 번은 하나
  if (this.P.pair?.even && (kind === 'walk' || kind === 'catch') && rec.t - (rec.sndT[l.k] ?? -9) > 0.08) {
    rec.sounds.push({ t: rec.t, k: l.k, acc: !!l.fastStep });
    rec.sndT[l.k] = rec.t;
  }
};

function run(id, rhy, scn) {
  setItalianRhythm('0');
  const S = SCRIPTS[scn];
  const G = newRound({ walls: !S.far, seed: 7, weapon: id, weapon2: 'longsword' });
  const P = G.player;
  const E = G.enemy;
  if (S.far) G.park();
  else G.ai.update = () => E.move.set(0, clamp(2 * (P.foeDistance() - KEEP), -1, 1)); // 상대는 가슴 거리 KEEP 을 지킨다 (다가오거나 물러남만)
  const g = P.gait;
  let t = 0;
  let on = false;
  const st = { falls: 0, levT: 0, switches: 0 };
  let prevSt = P.state;
  let prevFollow = null;
  const feet = { footF: { up: false, t: -9 }, footB: { up: false, t: -9 } };
  let nextS = 0;
  const step = (my) => {
    P.move.set(0, my);
    G.step();
    t += DT;
    if (!on) return;
    rec.t = t;
    if (prevSt === 'stand' && P.state === 'down') st.falls++;
    prevSt = P.state;
    if (g.active && g.levC > 0.3) st.levT += DT;
    if (prevFollow !== null && prevFollow !== !!g.follow && g.walking) st.switches++;
    prevFollow = !!g.follow;
    if (t >= nextS - 1e-9) {
      nextS = t + 0.02;
      const v = P.bodies.pelvis.linvel();
      const pp = P.bodies.pelvis.translation();
      rec.samples.push({ t, v: v.x * rec.d.x + v.z * rec.d.z, vh: Math.hypot(v.x, v.z), y: pp.y, x: pp.x, z: pp.z });
    }
    for (const k of ['footF', 'footB']) {
      if (g.P?.pair?.even) break; // 고른 짝걸음은 디딤 셈(위 touchdown) — 높이 판정 안 씀(게임과 같게)
      const y = P.bodies[k].translation().y;
      const ft = feet[k];
      if (y > 0.09) ft.up = true;
      else if (ft.up && y < 0.06) {
        ft.up = false;
        if (t - ft.t > 0.12) rec.sounds.push({ t, k: k === 'footF' ? 'F' : 'B', acc: !!g.legs[k === 'footF' ? 'F' : 'B'].fastStep });
        ft.t = t;
      }
    }
  };
  while (t < 2.3) step(0); // 시작 정지 (ARENA.startHold)
  if (!S.far) {
    const t1 = t;
    while (P.foeDistance() > KEEP + 0.3 && t - t1 < 10) step(APPROACH);
  }
  for (let i = 0; i < 1.2 / DT; i++) step(0); // 쉼 — 셈이 처음부터 (idle 넘게) · 자세 고치기 끝
  if (rhy !== '-') setItalianRhythm(rhy);
  else Object.assign(RH, RH0);
  const dir = Math.sign(S.seq[0][0]);
  P.forward(_f);
  rec = { who: P, t, begins: [], tds: [], samples: [], sounds: [], sndT: {}, open: { F: null, B: null }, d: { x: _f.x * dir, z: _f.z * dir } };
  on = true;
  const t0 = t;
  const p0 = { ...P.bodies.pelvis.translation() };
  let t1 = t0;
  for (const [my, dur] of S.seq) {
    for (let i = 0, n = Math.round(dur / DT); i < n; i++) step(my);
    if (my !== 0) t1 = t;
  }
  // 놓기(톡 아닌 대본): 스틱을 놓고 RELEASE s — 멈춤 거리·서는 때(놓은 뒤 골반 가는 쪽으로 더 간 거리 · 0.1 m/s 아래로 서는 때)
  const pRel = { ...P.bodies.pelvis.translation() };
  if (!S.tap) for (let i = 0, n = Math.round(RELEASE / DT); i < n; i++) step(0);
  const r = rec;
  rec = null;
  Object.assign(RH, RH0);
  const pEnd = P.bodies.pelvis.translation();
  return { r, st, t0, t1, tEnd: t, p0, pEnd, pRel, d: r.d, tap: !!S.tap, rhy: { ...g.P.rhythm } };
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => {
  const m = mean(a);
  return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length) : NaN;
};
const cv = (a) => sd(a) / mean(a);

function analyse(R) {
  const { r, t0, t1, d } = R;
  const along = (ax, az, bx, bz) => (bx - ax) * d.x + (bz - az) * d.z;
  // 디딤 = 걷는 걸음(walk·catch) · 톡은 자세 고치기(settle)도 (멈춰 서는 디딤)
  const all = r.tds.filter((x) => x.t > t0 && (R.tap ? x.t <= R.tEnd : x.t <= t1 + 0.05) && (x.kind === 'walk' || x.kind === 'catch' || (R.tap && x.kind === 'settle')));
  const kinds = {};
  for (const x of r.tds.filter((x) => x.t > t0 && x.t <= (R.tap ? R.tEnd : t1 + 0.05))) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
  const rows = [];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    const prev = all[i - 1];
    const lead = along(a.ox, a.oz, a.x, a.z) > 0;
    const travel = a.b ? Math.hypot(a.x - a.b.x, a.z - a.b.z) : NaN;
    const body = prev ? along(prev.px, prev.pz, a.px, a.pz) : NaN;
    rows.push({ i: i + 1, t: a.t - t0, iv: prev ? a.t - prev.t : NaN, k: a.k, lead, kind: a.kind, travel, body, ds: a.b ? a.b.ds : NaN, T: a.b ? a.b.T : NaN, sw: a.b ? a.t - a.b.t : NaN, fast: a.fast, early: a.early, follow: a.follow, pair: a.b?.pairOn, snd: r.sounds.find((s) => s.k === a.k && Math.abs(s.t - a.t) < 0.06) });
  }
  const steady = rows.slice(2);
  const ivs = steady.map((x) => x.iv).filter(Number.isFinite);
  // 이끔 → 따름 · 따름 → 이끔 간격
  const ab = { a: [], b: [] };
  for (let i = 1; i < steady.length; i++) {
    if (steady[i - 1].lead && !steady[i].lead) ab.a.push(steady[i].iv);
    else if (!steady[i - 1].lead && steady[i].lead) ab.b.push(steady[i].iv);
  }
  const trav = steady.map((x) => x.travel).filter(Number.isFinite);
  const travL = steady.filter((x) => x.lead).map((x) => x.travel).filter(Number.isFinite);
  const travT = steady.filter((x) => !x.lead).map((x) => x.travel).filter(Number.isFinite);
  // 짝 사이 쉼 = 따라붙는 발 디딤 뒤 이끄는 발을 떼기까지 (짝걸음 이끄는 발의 두 발 디딤)
  const rest = steady.filter((x) => x.lead && x.pair).map((x) => x.ds).filter(Number.isFinite);
  const dsAll = steady.map((x) => x.ds).filter(Number.isFinite);
  // 몸 빠르기: 셋째 디딤 뒤 ~ 스틱 놓을 때
  const ts = rows[2]?.t ?? Infinity;
  const smp = r.samples.filter((s) => s.t - t0 >= ts && s.t <= t1);
  const vs = smp.map((s) => s.v);
  const ys = smp.map((s) => s.y);
  // 몸 출렁임(앞뒤) = 골반이 간 자리(가는 쪽 몫)에서 매끈한 2 차 곡선(고르게 빨라지는 움직임)을 뺀 나머지의 표준편차 cm — 몸이 섰다가 튀어 나가는 꼴이 눈에 보이는 크기
  let surge = NaN;
  if (smp.length > 6) {
    const t0s = smp[0].t;
    const xs = smp.map((s) => s.t - t0s);
    const ps = smp.map((s) => (s.x - smp[0].x) * d.x + (s.z - smp[0].z) * d.z);
    // 최소 제곱 p ≈ a + b·x + c·x² (3 × 3 정규 방정식 — 크라메르)
    const S = [0, 0, 0, 0, 0];
    const T = [0, 0, 0];
    for (let i = 0; i < xs.length; i++) {
      for (let k = 0; k < 5; k++) S[k] += xs[i] ** k;
      for (let k = 0; k < 3; k++) T[k] += ps[i] * xs[i] ** k;
    }
    const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
    const D = det3(M);
    const coef = [0, 1, 2].map((j) => det3(M.map((row, r) => row.map((v, c) => (c === j ? T[r] : v)))) / D);
    surge = sd(ps.map((p, i) => p - (coef[0] + coef[1] * xs[i] + coef[2] * xs[i] * xs[i])));
  }
  // 박자 걸음: 보통 · 빠른 디딤으로 끝나는 간격
  const ivN = steady.filter((x) => !x.fast).map((x) => x.iv).filter(Number.isFinite);
  const ivF = steady.filter((x) => x.fast).map((x) => x.iv).filter(Number.isFinite);
  const span = steady.length > 1 ? steady[steady.length - 1].t - steady[0].t : NaN;
  const rate = steady.length > 1 ? (steady.length - 1) / span : NaN;
  // 톡: 디딤 수 · 마지막 디딤 · 서는 때 · 간 거리
  let tap = null;
  if (R.tap) {
    const stopS = r.samples.find((s) => s.t > t1 + 0.05 && s.vh < 0.1);
    const last = all.length ? all[all.length - 1].t - t0 : NaN;
    tap = { n: all.length, last, stop: stopS ? stopS.t - t0 : NaN, dist: along(R.p0.x, R.p0.z, R.pEnd.x, R.pEnd.z) };
  }
  // 놓기: 놓은 뒤 더 간 거리 · 서는 때(놓은 때부터)
  let rel = null;
  if (!R.tap) {
    const stopS = r.samples.find((s) => s.t > t1 + 0.02 && s.vh < 0.1);
    rel = { dist: along(R.pRel.x, R.pRel.z, R.pEnd.x, R.pEnd.z), stop: stopS ? stopS.t - t1 : NaN };
  }
  const sounds = r.sounds.filter((s) => s.t > t0 && s.t <= (R.tap ? R.tEnd : t1 + 0.05));
  return {
    rel,
    rows,
    n: rows.length,
    rate,
    ivMean: mean(ivs),
    ivCV: cv(ivs),
    ab: ab.a.length && ab.b.length ? mean(ab.a) / mean(ab.b) : NaN,
    abA: mean(ab.a),
    abB: mean(ab.b),
    trav: mean(trav),
    travCV: cv(trav),
    travLT: travL.length && travT.length ? mean(travL) / mean(travT) : NaN,
    body: mean(steady.map((x) => x.body).filter(Number.isFinite)),
    bodyCV: cv(steady.map((x) => x.body).filter(Number.isFinite)),
    vMean: mean(vs),
    vCV: cv(vs),
    vStop: vs.length ? vs.filter((v) => v < 0.3 * mean(vs)).length / vs.length : NaN,
    yStd: sd(ys),
    surge,
    rest: mean(rest),
    restMax: rest.length ? Math.max(...rest) : NaN,
    ds: mean(dsAll),
    followShare: rows.length ? rows.filter((x) => x.follow).length / rows.length : NaN,
    leadShare: steady.length ? steady.filter((x) => x.lead).length / steady.length : NaN,
    ivNCV: cv(ivN),
    fastRatio: ivF.length && ivN.length ? mean(ivF) / mean(ivN) : NaN,
    nFast: steady.filter((x) => x.fast).length,
    catches: r.tds.filter((x) => x.t > t0 && x.kind === 'catch').length,
    early: rows.filter((x) => x.early).length,
    walkN: rows.filter((x) => x.kind === 'walk').length,
    req: (kinds.req || 0) + (kinds.draw || 0),
    sounds: sounds.length,
    soundsAcc: sounds.filter((s) => s.acc).length,
    sndT: sounds.map((s) => `${(s.t - t0).toFixed(2)}${s.acc ? '!' : ''}`),
    tap,
    samples: r.samples.map((s) => [s.t - t0, s.v]),
  };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
const pct = (v) => (Number.isFinite(v) ? `${Math.round(100 * v)}%` : '-');
const schoolOf = (id) => TRADITIONS[traditionOf(getWeapon(id))]?.nameKo ?? '?';
const label = (id, rhy) => {
  if (traditionOf(getWeapon(id)) !== 'italian') return '';
  if (rhy === '-') return '기본';
  setItalianRhythm(rhy);
  const { mul, count, normal, fast, every } = RH;
  Object.assign(RH, RH0);
  return count === 'off' ? '박자 끔' : count === 'foot' ? `${normal} + ${fast} ×${mul}` : `옛 짝 ${every} + 1 ×${mul}`;
};

const out = [];
const detail = [];
const sumRows = [];
if (!SUM) {
  out.push(`걸음 고르기 계기 · 플레이어 · 디딤 = walk·catch(톡은 settle 도) · 고르기 칸은 처음 두 디딤 뺌 · 가까이 = 상대가 가슴 ${KEEP} m 를 지킴`);
  out.push('| 대본 | 무기 (유파) | 갈래 | 디딤 · 초당 | 간격 평균 s · CV | 이끔→따름 ÷ 따름→이끔 (a · b s) | 이끄는 디딤 몫 · follow 몫 · 꼴 바뀜 | 발이 옮긴 거리 m · CV · 이끔 ÷ 따름 | 몸이 한 디딤에 간 거리 m · CV | 몸 빠르기 m/s · CV · 거의 섬 몫 | 몸 앞뒤 출렁임 cm · 골반 높이 표준편차 cm | 짝 사이 쉼 s (최대) · 두 발 디딤 s | 보통 디딤 간격 CV · 빠름 ÷ 보통 (빠른 디딤) | 톡: 디딤 · 마지막 디딤 s · 서는 때 s · 간 거리 m / 그 밖: 놓은 뒤 서는 때 s · 더 간 거리 m | 넘어짐 · 붙잡기 반사 s · catch · 일찍 디딤 · 기술 걸음 | 발소리 (강조) |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
}
for (const scn of SCN) {
  for (const id of IDS) {
    const it = traditionOf(getWeapon(id)) === 'italian';
    for (const rhy of it ? RHY : ['-']) {
      const R = run(id, rhy, scn);
      const A = analyse(R);
      const lb = label(id, rhy);
      const tapCol = A.tap ? `${A.tap.n} · ${f2(A.tap.last)} · ${f2(A.tap.stop)} · ${f2(A.tap.dist)}` : A.rel ? `놓기: 서는 때 ${f2(A.rel.stop)} · 더 간 ${f2(A.rel.dist)}` : '';
      const line = `| ${scn} ${SCRIPTS[scn].name} | ${id} (${schoolOf(id)}) | ${lb} | ${A.n} · ${f2(A.rate)} | ${f3(A.ivMean)} · ${f2(A.ivCV)} | ${f2(A.ab)} (${f2(A.abA)} · ${f2(A.abB)}) | ${pct(A.leadShare)} · ${pct(A.followShare)} · ${R.st.switches} | ${f3(A.trav)} · ${f2(A.travCV)} · ${f2(A.travLT)} | ${f3(A.body)} · ${f2(A.bodyCV)} | ${f2(A.vMean)} · ${f2(A.vCV)} · ${pct(A.vStop)} | ${(100 * A.surge).toFixed(1)} · ${(100 * A.yStd).toFixed(1)} | ${f2(A.rest)} (${f2(A.restMax)}) · ${f2(A.ds)} | ${A.nFast ? `${f2(A.ivNCV)} · ${f2(A.fastRatio)} (${A.nFast})` : `${f2(A.ivNCV)} · -`} | ${tapCol} | ${R.st.falls} · ${f2(R.st.levT)} · ${A.catches} · ${A.early}/${A.walkN} · ${A.req} | ${A.sounds} (${A.soundsAcc}) |`;
      if (SUM) sumRows.push({ scn, id, lb, A, R });
      else out.push(line);
      if (ROWS) {
        detail.push(`\n#### ${scn} ${SCRIPTS[scn].name} · ${id} ${lb}\n\n| 디딤 | 시각 s | 간격 s | 발 | 이끔/따름 | 디딤 꼴 | 발이 옮긴 m | 몸이 간 m | 떼기 전 두 발 디딤 s | 발 뜬 시간 s (정한 값) | 빠름 | 일찍 | follow·짝 | 발소리 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
        for (const x of A.rows) detail.push(`| ${x.i} | ${f2(x.t)} | ${f3(x.iv)} | ${x.k} | ${x.lead ? '이끔' : '따름'} | ${x.kind} | ${f3(x.travel)} | ${f3(x.body)} | ${f3(x.ds)} | ${f3(x.sw)} (${f3(x.T)}) | ${x.fast ? '**빠름**' : ''} | ${x.early ? '일찍' : ''} | ${x.follow ? 'f' : ''}${x.pair ? '짝' : ''} | ${x.snd ? (x.snd.acc ? '강조' : '소리') : ''} |`);
        detail.push(`\n발소리 시각(! = 강조): ${A.sndT.join(' ') || '-'}`);
      }
      if (CURVE && detail.length < 4000) {
        detail.push(`\n골반 가는 쪽 빠르기 0.02 s 마다 (${scn} · ${id} ${lb}): ${A.samples.map(([tt, v]) => `${tt.toFixed(2)}:${v.toFixed(2)}`).join(' ')}`);
      }
    }
  }
}
if (SUM) {
  // H 표: 앞 끝(혼자) — 발 하나가 한 번 옮기는 거리 · 디딤 박자 · 몸이 한 디딤에 가는 거리 · 디딤 간격 고르기
  console.log('| 대본 | 무기 (유파) | 갈래 | 발 하나가 한 번 옮기는 거리 m (CV) | 디딤 박자 /s | 몸이 한 디딤에 가는 거리 m (CV) | 디딤 간격 s · CV | 몸 빠르기 m/s · CV | catch · 일찍 디딤 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const { scn, id, lb, A } of sumRows) console.log(`| ${scn} ${SCRIPTS[scn].name} | ${id} (${schoolOf(id)}) | ${lb} | ${f3(A.trav)} (${f2(A.travCV)}) | ${f2(A.rate)} | ${f3(A.body)} (${f2(A.bodyCV)}) | ${f3(A.ivMean)} · ${f2(A.ivCV)} | ${f2(A.vMean)} · ${f2(A.vCV)} | ${A.catches} · ${A.early}/${A.walkN} |`);
} else console.log(out.join('\n'));
if (detail.length) console.log(detail.join('\n'));
