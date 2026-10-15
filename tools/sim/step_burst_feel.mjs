// 첫 걸음 박차기 계기 (10/15 — docs/strike/step_burst_2026-10-15.md): 서 있다가 뒤·옆으로 미는 첫 걸음을 켬(GAIT.stepBurst 1)·끔(0)으로 견준다. 플레이어 혼자 — 상대는 세워 둠(AI 판단 끔).
//  판 시작 정지 → 앞으로 밀어 상대 가슴 near m(기본 2.4) → 쉼(1.5 s 뒤 자세 고치기가 끝나 두 발로 0.6 s 선 때까지) → 대본. 대본 시작 = 스틱을 민 순간(t 0).
//  칸: 가슴이 스틱 쪽으로 간 거리(0.2·0.3·0.4·0.5 s · 1.0 s) · 0.25 m 까지 걸린 시간 · 첫 걸음(뗀 때 · 발 뜬 시간 · 발 옮긴 거리 · 빠른 걸음인가) ·
//   가장 빠른 몸 빠르기(스틱 쪽) · 떼고 놓기 대본은 멈출 때까지 간 거리(흐름) · 이어 걷기 대본은 2·3째 걸음 빠르기(제 빠르기로 돌아오나)
//  안정: 넘어짐 · 붙잡기 반사 s(levC > 0.3) · catch · 일찍 디딤(walk 걸음이 정한 시간 85 % 전) — 대본 동안(쉼까지)
//  재기만 — 물리·난수는 게임 그대로(begin·touchdown 을 감싸 읽기만), 판 하나는 결정적.
//  실행: node tools/sim/step_burst_feel.mjs [무기 longsword] [가까움 2.4] [대본들 A,B,…]   (SBF_ROWS=1 → 걸음마다 줄 · SBF_JSON=파일 → 값 고르기용 기록)
//  값 고르기: node tools/sim/with_config.mjs GAIT.burstBackV=2.2 step_burst_feel.mjs …
//  이어 밀기 (10/15 뒤 2 s 고침 — 문서 §7): 대본 K(뒤 끝 2 s) · L(오른 끝 2 s) 은 표 밑에 빠르기(0.1 s 마다 · 게임 m/s)·1 s·2 s 간 거리·박찬 걸음 뒤(0.45 s~) 가장 느린 빠르기를 더 적는다.
//   차림 SBF_START: 'rest'(기본 — 위 쉼 뒤) · 'open:<s>[,<s>…]' = 판 시작 정지(ARENA.startHold)가 풀린 뒤 s 초 그 자리(상대 가슴 5.6 m)에 서 있다가 대본
//   (카메라 계기 cam_follow_probe.mjs 의 walk 대본이 open:0.8 — 자세 고치던 발이 아직 떠 있을 때) · 'open:sweep' = 풀린 뒤 0.4~2.1 s 스물한 때.
//   때를 둘 넘게 주면 대본마다 짧은 표(때마다 한 줄) + 켬 ≥ 끔 셈만. 예) SBF_START=open:sweep node tools/sim/step_burst_feel.mjs longsword 2.4 K,L
//  발소리 (10/15 15:2x 박차기 발소리 강조 — 문서 §9): 표 밑에 대본 동안 발소리(sound.js BodySounds 판정 흉내 — 발 몸체 0.09 m 위로 떴다가 0.06 m 아래로 · 0.12 s 안 두 번은 하나)와
//   그 가운데 강조(그때 그 발 gait leg.fastStep 이 { gain, rate })를 적는다 — 강조가 박찬 발 디딤에만 나나
//  비스듬히 (10/15 15:1x 옆 박차기는 이베리아만 — 문서 §8): 대본 G(45°) · M(옆 몫이 큼 — 옆 0.87 · 뒤 0.5) · N(뒤 몫이 큼 — 옆 0.5 · 뒤 0.87) 은 표 밑에 가슴이 간 거리의 뒤 몫·옆 몫을 따로 적는다
import { newRound, DT, THREE } from './harness_m.mjs';
import { GAIT, ARENA } from '../../src/config.js';
import { Gait } from '../../src/gait.js';

const id = process.argv[2] || 'longsword';
const NEAR = +(process.argv[3] || 2.4);
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
const ROWS = process.env.SBF_ROWS === '1';
const START = (process.env.SBF_START || 'rest').trim().replace(/^open:/, '');
const SWEEP = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.78, 0.8, 0.82, 0.85, 0.9, 0.95, 1.0, 1.1, 1.2, 1.3, 1.5, 1.8, 2.1]; // 풀린 뒤 s (자세 고치던 발이 떠 있는 때를 촘촘히)
const STARTS = START === 'rest' ? ['rest'] : START === 'sweep' ? SWEEP : START.split(',').map(Number);
const SB0 = GAIT.stepBurst;
let rec = null;
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (!rec || this.f !== rec.who) return;
  rec.begins.push({ t: rec.t, kind, k: l.k, T, walking: !!this.walking, fastK: this.fastK, p0: l.p0.clone(), x: rec.cx(), z: rec.cz() });
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  const early = kind === 'walk' && l.t < 0.85 * l.T;
  TD0.call(this, l, speed);
  if (rec && this.f === rec.who) rec.tds.push({ t: rec.t, kind, k: l.k, early, plant: l.plant.clone() });
};

// 대본: [스틱 x(오른 +), 스틱 y(앞 +), 시간 s] …
const SCR = {
  A: { name: '뒤 끝 1.5 s (이어 걷기)', seq: [[0, -1, 1.5], [0, 0, 1.0]] },
  B: { name: '뒤 끝 0.3 s 떼고 놓기', seq: [[0, -1, 0.3], [0, 0, 1.5]] },
  C: { name: '오른 끝 1.5 s (이어 걷기)', seq: [[1, 0, 1.5], [0, 0, 1.0]] },
  D: { name: '오른 끝 0.3 s 떼고 놓기', seq: [[1, 0, 0.3], [0, 0, 1.5]] },
  E: { name: '왼 끝 1.5 s', seq: [[-1, 0, 1.5], [0, 0, 1.0]] },
  F: { name: '왼 끝 0.3 s 떼고 놓기', seq: [[-1, 0, 0.3], [0, 0, 1.5]] },
  G: { name: '비스듬히 뒤 오른 1.5 s', seq: [[0.707, -0.707, 1.5], [0, 0, 1.0]], diag: true },
  H: { name: '앞 끝 1.0 s (박차기 없음)', seq: [[0, 1, 1.0], [0, 0, 1.0]] },
  I: { name: '뒤 0.5 1.5 s (문턱 아래)', seq: [[0, -0.5, 1.5], [0, 0, 1.0]] },
  J: { name: '뒤 끝 0.15 s 떼고 놓기', seq: [[0, -1, 0.15], [0, 0, 1.5]] },
  K: { name: '뒤 끝 2 s (서 있다가 이어 물러나기)', seq: [[0, -1, 2.0], [0, 0, 0.5]], hold: true },
  L: { name: '오른 끝 2 s (서 있다가 이어 옆걸음)', seq: [[1, 0, 2.0], [0, 0, 0.5]], hold: true },
  M: { name: '비스듬히 옆 오른 1.5 s (옆 0.87 · 뒤 0.5 — 옆 몫이 큼)', seq: [[0.866, -0.5, 1.5], [0, 0, 1.0]], diag: true },
  N: { name: '비스듬히 뒤 오른 1.5 s (옆 0.5 · 뒤 0.87 — 뒤 몫이 큼)', seq: [[0.5, -0.866, 1.5], [0, 0, 1.0]], diag: true },
};

const _u = new THREE.Vector3();
function run(scn, on, start = 'rest') {
  GAIT.stepBurst = on;
  const G = newRound({ walls: true, seed: 7, weapon: id, weapon2: 'longsword' });
  const E = G.enemy;
  G.ai.update = () => E.move.set(0, 0); // 상대는 세워 둔다
  const P = G.player;
  const g = P.gait;
  let t = 0;
  let falls = 0;
  let lev = 0;
  let prev = P.state;
  const feet = { footF: { up: false, t: -1 }, footB: { up: false, t: -1 } };
  const sounds = [];
  const step = (mx, my, live) => {
    P.move.set(mx, my);
    G.step();
    t += DT;
    if (rec) rec.t = t - rec.t0;
    // 발소리 판정 흉내 (sound.js BodySounds — 서 있거나 일어나는 몸만): 대본 동안만 적는다
    if (P.state === 'stand' || P.state === 'getup') {
      for (const k of ['footF', 'footB']) {
        const y = P.bodies[k].translation().y;
        const ft = feet[k];
        if (y > 0.09) ft.up = true;
        else if (ft.up && y < 0.06) {
          ft.up = false;
          const acc = g.legs[k === 'footF' ? 'F' : 'B'].fastStep;
          if (t - ft.t > 0.12 && rec) sounds.push({ t: rec.t, k: k === 'footF' ? 'F' : 'B', acc: !!acc && typeof acc === 'object' });
          ft.t = t;
        }
      }
    }
    if (!live) return;
    if (prev === 'stand' && P.state === 'down') falls++;
    prev = P.state;
    if (g.active && g.levC > 0.3) lev += DT;
  };
  if (start === 'rest') {
    while (t < 2.3) step(0, 0, false);
    const t1 = t;
    while (P.foeDistance() > NEAR && t - t1 < 8) step(0, 1, false);
    // 쉼: 1.5 s 뒤 두 발이 다 딛고 마지막 디딤 뒤 0.6 s 가 지날 때까지(자세 고치기가 끝난 선 몸 — 늦어도 5 s)
    const t2 = t;
    while (t - t2 < 5 && (t - t2 < 1.5 || !(g.legs.F.stance && g.legs.B.stance && g.sinceTD > 0.6))) step(0, 0, false);
  } else while (t < ARENA.startHold + start - 1e-9) step(0, 0, false); // 판 시작 자리에서: 정지가 풀린 뒤 start 초 (자세 고치기가 아직 남았을 수 있음)
  const swing0 = g.legs.F.stance && g.legs.B.stance ? '-' : g.legs.F.stance ? `B ${g.legs.B.kind}` : `F ${g.legs.F.kind}`; // 대본 시작 때 떠 있던 발
  const seq = SCR[scn].seq;
  const [mx0, my0] = seq[0];
  const fwd = P.forward(new THREE.Vector3());
  const rgt = P.right(new THREE.Vector3());
  _u.set(fwd.x * my0 + rgt.x * mx0, 0, fwd.z * my0 + rgt.z * mx0).normalize();
  const c0 = P.bodies.chest.translation();
  const C0 = { x: c0.x, z: c0.z };
  const along = () => {
    const c = P.bodies.chest.translation();
    return (c.x - C0.x) * _u.x + (c.z - C0.z) * _u.z;
  };
  const sx = Math.sign(mx0) || 1;
  const comp = () => {
    const c = P.bodies.chest.translation();
    const dx = c.x - C0.x;
    const dz = c.z - C0.z;
    return [-(dx * fwd.x + dz * fwd.z), sx * (dx * rgt.x + dz * rgt.z)]; // 비스듬히 대본: 뒤 몫 · 스틱 옆 쪽 몫 (대본 시작 때 몸 방향)
  };
  rec = { who: P, t0: t, t: 0, begins: [], tds: [], cx: () => P.bodies.chest.translation().x, cz: () => P.bodies.chest.translation().z };
  const at = {};
  const atC = {};
  const marks = [0.2, 0.3, 0.4, 0.5, 1.0, 1.5, 2.0];
  let t25 = NaN;
  let vMax = 0;
  let dPrev = 0;
  let dMax = 0;
  let tStill = NaN;
  let still = 0;
  const trace = [];
  // 이어 밀기: 스틱을 미는 동안(첫 줄) 0.1 s 마다 간 거리 → 빠르기 · 0.5 s 뒤(박찬 걸음·세게 멈춤이 끝난 뒤) 가장 느린 0.1 s 빠르기
  const v01 = [];
  let d01 = 0;
  let vLow = Infinity;
  let tt = 0;
  for (const [si, [mx, my, d]] of seq.entries()) {
    for (let i = 0, n = Math.round(d / DT); i < n; i++) {
      step(mx, my, true);
      tt += DT;
      const dd = along();
      const v = (dd - dPrev) / DT;
      dPrev = dd;
      vMax = Math.max(vMax, v);
      dMax = Math.max(dMax, dd);
      for (const m of marks) if (at[m] == null && tt >= m - 1e-9) (at[m] = dd), (atC[m] = comp());
      if (si === 0 && Math.round(tt / DT) % Math.round(0.1 / DT) === 0) {
        v01.push((dd - d01) / 0.1);
        d01 = dd;
        if (tt > 0.55) vLow = Math.min(vLow, v01[v01.length - 1]);
      }
      if (Number.isNaN(t25) && dd >= 0.25) t25 = tt;
      // 멈춤: 놓은 뒤 골반 빠르기 0.1 m/s 아래로 0.1 s 가 처음 찬 때
      if (mx === 0 && my === 0 && Number.isNaN(tStill)) {
        const lv = P.bodies.pelvis.linvel();
        still = Math.hypot(lv.x, lv.z) < 0.1 ? still + DT : 0;
        if (still >= 0.1) tStill = tt;
      }
      if (ROWS && Math.round(tt / DT) % 6 === 0) trace.push([tt, dd, v]);
    }
  }
  const dEnd = along();
  const r = rec;
  rec = null;
  GAIT.stepBurst = SB0;
  // 걸음: 대본 동안 walk·catch 로 뗀 걸음 (자세 고치기 빼고) — 시간 = 그 발이 뜬 시간(정한 T), 옮긴 거리 = 디딘 자리 − 뗀 자리 (스틱 쪽)
  const steps = [];
  for (const b of r.begins) {
    if (b.kind === 'settle') continue;
    const td = r.tds.find((d) => d.k === b.k && d.t >= b.t);
    const footD = td ? (td.plant.x - b.p0.x) * _u.x + (td.plant.z - b.p0.z) * _u.z : NaN;
    steps.push({ t: b.t, kind: b.kind, T: b.T, air: td ? td.t - b.t : NaN, footD, fast: b.fastK > 1, k: b.k });
  }
  for (let i = 0; i < steps.length; i++) {
    const a = steps[i];
    const b = steps[i + 1];
    const bx = b ? r.begins.find((q) => q.t === b.t) : null;
    const ax = r.begins.find((q) => q.t === a.t);
    a.bodyD = bx ? (bx.x - ax.x) * _u.x + (bx.z - ax.z) * _u.z : NaN; // 이 걸음을 뗀 때부터 다음 걸음을 뗄 때까지 가슴이 간 거리
    a.dur = b ? b.t - a.t : NaN;
  }
  return {
    at,
    atC,
    t25,
    vMax,
    dMax,
    dEnd,
    tStill,
    steps,
    falls,
    lev,
    catches: r.tds.filter((d) => d.kind === 'catch').length,
    early: r.tds.filter((d) => d.early).length,
    walkTD: r.tds.filter((d) => d.kind === 'walk').length,
    trace,
    v01,
    vLow,
    swing0,
    sounds,
  };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
const head = `첫 걸음 박차기 계기 · ${id} 플레이어 · ${STARTS[0] === 'rest' ? `상대 가슴 ${NEAR} m 에서 쉼 뒤 대본` : `판 시작 자리에서 정지가 풀린 뒤 ${STARTS.join(' · ')} s 서 있다가 대본`} · 켬 = GAIT.stepBurst 1 · 끔 = 0 · burstBackV ${GAIT.burstBackV} · burstSideV ${GAIT.burstSideV} · burstAccel ${GAIT.burstAccel}`;
const scns = Object.keys(SCR).filter((s) => !ONLY || ONLY.includes(s));
if (STARTS.length > 1) {
  // 때 여럿: 대본마다 짧은 표 — 때마다 켬·끔 한 줄 + 켬 ≥ 끔 셈 (스틱을 미는 동안 끝의 간 거리로)
  console.log(head);
  const json = {};
  for (const scn of scns) {
    const T = SCR[scn].seq[0][2];
    console.log(`\n#### ${scn} ${SCR[scn].name}\n\n| 풀린 뒤 s | 그때 떠 있던 발 | 0.3 s m (끔 → 켬) | 1 s m | ${T >= 2 ? '2 s' : '끝'} m | 0.5 s 뒤 가장 느린 m/s | 넘어짐 · 붙잡기 반사 s · catch (끔 → 켬) |\n|---|---|---|---|---|---|---|`);
    let ok = 0;
    let worst = Infinity;
    let worstAt = null;
    for (const st of STARTS) {
      const a = run(scn, 0, st);
      const b = run(scn, 1, st);
      (json[scn] ||= {})[st] = { off: { ...a, trace: undefined }, on: { ...b, trace: undefined } };
      const ea = T >= 2 ? a.at[2.0] : a.dEnd;
      const eb = T >= 2 ? b.at[2.0] : b.dEnd;
      if (eb >= ea - 1e-9) ok++;
      if (eb - ea < worst) (worst = eb - ea), (worstAt = st);
      console.log(`| ${st} | ${b.swing0} | ${f2(a.at[0.3])} → ${f2(b.at[0.3])} | ${f2(a.at[1.0])} → ${f2(b.at[1.0])} | ${f2(ea)} → ${f2(eb)}${eb < ea - 1e-9 ? ' **' : ''} | ${f2(a.vLow)} → ${f2(b.vLow)} | ${a.falls}·${f2(a.lev)}·${a.catches} → ${b.falls}·${f2(b.lev)}·${b.catches} |`);
    }
    console.log(`\n켬 ≥ 끔 (${T >= 2 ? '2 s' : '끝'} 간 거리): ${ok}/${STARTS.length} · 가장 나쁜 켬 − 끔 ${f2(worst)} m (풀린 뒤 ${worstAt} s)`);
  }
  if (process.env.SBF_JSON) (await import('node:fs')).writeFileSync(process.env.SBF_JSON, JSON.stringify(json));
  process.exit(0);
}
const ST = STARTS[0];
console.log(head);
console.log('| 대본 | 0.2 · 0.3 · 0.4 · 0.5 s 간 거리 m (끔 → 켬) | 1.0 s | 0.25 m 까지 s | 첫 걸음: 발 뜬 s · 발 옮김 m · 다음 걸음까지 가슴 m (끔 → 켬) | 빠른 걸음 (켬) | 가장 빠른 몸 m/s | 가장 멀리 · 끝 m | 멈춤 s | 2·3째 걸음 다음까지 가슴 m (끔 → 켬) | 넘어짐 · 붙잡기 반사 s · catch · 일찍 디딤 (끔 → 켬) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
const detail = [];
const holds = [];
const diags = [];
const snds = [];
const json = {};
for (const scn of scns) {
  const a = run(scn, 0, ST);
  const b = run(scn, 1, ST);
  json[scn] = { off: { ...a, trace: undefined }, on: { ...b, trace: undefined } };
  if (SCR[scn].hold) holds.push([scn, a, b]);
  if (SCR[scn].diag) diags.push([scn, a, b]);
  snds.push([scn, a, b]);
  const p = (k, fmt) => `${fmt(a[k])} → ${fmt(b[k])}`;
  const m4 = [0.2, 0.3, 0.4, 0.5].map((m) => `${f2(a.at[m])}→${f2(b.at[m])}`).join(' · ');
  const s1 = (R) => R.steps[0];
  const fs = (R, i) => R.steps[i];
  const first = `${f3(s1(a)?.air)}→${f3(s1(b)?.air)} · ${f2(s1(a)?.footD)}→${f2(s1(b)?.footD)} · ${f2(s1(a)?.bodyD)}→${f2(s1(b)?.bodyD)}`;
  const fastOrder = b.steps.map((s, i) => (s.fast ? i + 1 : null)).filter((x) => x).join('·') || '-';
  const later = `${f2(fs(a, 1)?.bodyD)}·${f2(fs(a, 2)?.bodyD)} → ${f2(fs(b, 1)?.bodyD)}·${f2(fs(b, 2)?.bodyD)}`;
  console.log(`| ${scn} ${SCR[scn].name} | ${m4} | ${f2(a.at[1.0])}→${f2(b.at[1.0])} | ${p('t25', f2)} | ${first} | ${fastOrder} | ${p('vMax', f2)} | ${f2(a.dMax)}·${f2(a.dEnd)} → ${f2(b.dMax)}·${f2(b.dEnd)} | ${p('tStill', f2)} | ${later} | ${a.falls}·${f2(a.lev)}·${a.catches}·${a.early}/${a.walkTD} → ${b.falls}·${f2(b.lev)}·${b.catches}·${b.early}/${b.walkTD} |`);
  if (ROWS) {
    for (const [nm, R] of [['끔', a], ['켬', b]]) {
      detail.push(`\n#### ${scn} ${SCR[scn].name} · ${nm}\n\n| 걸음 | 뗀 때 s | 디딤 | 발 | 정한 T s | 발 뜬 s | 발 옮김 m | 다음 걸음까지 s | 가슴 m | 빠른 걸음 |\n|---|---|---|---|---|---|---|---|---|---|`);
      R.steps.slice(0, 6).forEach((s, i) => detail.push(`| ${i + 1} | ${f2(s.t)} | ${s.kind} | ${s.k} | ${f3(s.T)} | ${f3(s.air)} | ${f2(s.footD)} | ${f3(s.dur)} | ${f2(s.bodyD)} | ${s.fast ? '**빠름**' : ''} |`));
      detail.push(`\n시각·간 거리·빠르기: ${R.trace.map(([t, d, v]) => `${t.toFixed(2)}:${d.toFixed(2)}/${v.toFixed(1)}`).join(' ')}`);
    }
  }
}
if (holds.length) {
  // 이어 밀기 (K·L): 박찬 걸음 뒤에도 그 스틱의 걷는 빠르기로 이어 걷나 — 0.1 s 마다 빠르기 · 1 s · 2 s 간 거리 · 0.5 s 뒤 가장 느린 빠르기
  console.log('\n이어 밀기 — 스틱을 미는 동안 0.1 s 마다 빠르기(게임 m/s, 스틱 쪽) · 끔 / 켬');
  console.log('| 대본 | 1 s m (끔 → 켬) | 2 s m | 0.5 s 뒤 가장 느린 m/s | 빠르기 끔 | 빠르기 켬 |\n|---|---|---|---|---|---|');
  for (const [scn, a, b] of holds) console.log(`| ${scn} | ${f2(a.at[1.0])} → ${f2(b.at[1.0])} | ${f2(a.at[2.0])} → ${f2(b.at[2.0])}${b.at[2.0] < a.at[2.0] - 1e-9 ? ' **' : ''} | ${f2(a.vLow)} → ${f2(b.vLow)} | ${a.v01.map(f2).join(' ')} | ${b.v01.map(f2).join(' ')} |`);
}
if (diags.length) {
  // 비스듬히 (G·M·N): 가슴이 간 거리의 뒤 몫 · 옆 몫 — 이베리아 아닌 유파의 비스듬히 뒤 박차기는 뒤 몫만 빠르게(옆 몫은 보통 빠르기 — 문서 §8)
  console.log('\n비스듬히 — 가슴이 간 거리의 뒤 몫 · 옆 몫 (m · 끔 → 켬)');
  console.log('| 대본 | 0.3 s 뒤 몫 | 0.3 s 옆 몫 | 0.5 s 뒤 몫 | 0.5 s 옆 몫 | 1.0 s 뒤 몫 | 1.0 s 옆 몫 |\n|---|---|---|---|---|---|---|');
  for (const [scn, a, b] of diags) console.log(`| ${scn} | ${[0.3, 0.5, 1.0].map((m) => `${f2(a.atC[m]?.[0])} → ${f2(b.atC[m]?.[0])} | ${f2(a.atC[m]?.[1])} → ${f2(b.atC[m]?.[1])}`).join(' | ')} |`);
}
{
  // 발소리 (켬): 강조는 박찬 발 디딤에만 나야 한다 (10/15 15:2x — 문서 §9)
  console.log('\n발소리 — 대본 동안 (sound.js 판정 흉내) · 강조 = 그때 그 발이 빠른 걸음 발(leg.fastStep)');
  console.log('| 대본 | 발소리 수 (끔 → 켬) | 강조 (끔 → 켬) | 켬: 강조 때 s · 발 | 켬: 첫 걸음 발 · 디딘 때 s | 켬: 박찬 발 디딤 밖 강조 (다른 발 · 그 발 다음 걸음 뒤) |\n|---|---|---|---|---|---|');
  for (const [scn, a, b] of snds) {
    const s0 = b.steps[0];
    const td0 = s0 && Number.isFinite(s0.air) ? s0.t + s0.air : NaN;
    const accs = b.sounds.filter((q) => q.acc);
    const tNext = b.steps.slice(1).find((q) => q.k === s0?.k)?.t ?? Infinity; // 박찬 발이 다음 걸음을 뗀 때 — 그 뒤 강조는 박찬 디딤이 아님
    const outside = accs.filter((q) => !s0?.fast || q.k !== s0.k || q.t >= tNext).length;
    console.log(`| ${scn} | ${a.sounds.length} → ${b.sounds.length} | ${a.sounds.filter((q) => q.acc).length} → ${accs.length} | ${accs.map((q) => `${f2(q.t)} ${q.k}`).join(' · ') || '-'} | ${s0 ? `${s0.k} · ${f2(td0)}` : '-'}${s0?.fast ? ' (박참)' : ''} | ${outside} |`);
  }
}
if (detail.length) console.log(detail.join('\n'));
if (process.env.SBF_JSON) (await import('node:fs')).writeFileSync(process.env.SBF_JSON, JSON.stringify(json)); // 값 고르기용 (SBF_JSON=파일)
