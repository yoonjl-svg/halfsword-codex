// 동방 AI 걸음 박자 — 미는 시간과 몸이 간 거리 (10/15 — docs/strike/cn_light_feet_2026-10-15.md §7): AI 는 걸음을 '몇 m'가 아니라 '스틱을 몇 초 민다'로 정한다
//  (ai.js stepTime — 베며 내딛는 시간 = clamp(모자란 거리 × 0.8, 0, 0.3) s · contactDist — 베는 동안 내가 더 다가가는 몫 = 내 다가감 × 0.7 × cutTime).
//  그 시간·몫이 가벼운 발(가속 한도 × light)에서 몸을 얼마나 더 보내는지 재고, 같은 거리를 내는 미는 시간(T′)을 찾는다 — 감독 설명(미는 시간이 옛 가속에 맞춰짐)을 재는 계기 · 그 식으로 고친 갈래(문서 §7-5 ⓐ)는 승률이 그대로라 게임에 넣지 않음.
//  판: 동방 무기 몸(AI 가 모는 몸 표시 aiControlled — 유파 걸음 플레이어 덮개 없음) 대 롱소드(판단 끔 — 제자리 · 칼 충돌 끔 · 상대 가슴 gap m 앞 — 동방 따라붙는 걸음 문턱 3.3 m 안) · 벽 없음 · 씨앗 7 ·
//   판 시작 정지·쉼(3.3 s) 뒤 ① 다가감: 스틱 앞 s0(0 · 0.25 · 0.45 — AI 다가가기 approach 의 스틱 폭) 0.8 s ② 내딛기: 스틱 앞 1 을 T s + 그 순간 베기 걸음 부탁(ai.js gaitStep 과 같은
//   requestStep — 유파 걸음 칸 cutStep: 동방 앞발 lunge 0.5 m · 끌어붙임) ③ 멈춤: 스틱 −0.21(AI 가 내딛지 않을 때 발을 멈춰 세우는 값) 1.2 s.
//  잰다(내딛기 시작부터 · 가슴이 그때 몸 앞쪽으로 간 거리): 가장 멀리(= 선 자리) · cutTime(0.3 s) 뒤 · 다가감 빠르기 v0 (내딛기 시작 때 골반 앞 빠르기)
//   → 같은 v0·T 에서 light 1(끔)과 light(켬)의 가장 멀리 · light 켬 쪽 T 격자에서 끔 거리와 같은 T′ (선형 보간) · T′ ÷ T (1/√light 와 견줌)
//   · T 0(내딛지 않고 멈춤만): cutTime 동안 간 거리 ÷ (v0 × cutTime) — contactDist 의 0.7 이 가정한 몫
//  재기만 — 물리·난수는 게임 그대로(스틱·걸음 부탁만 대본), 판 하나는 결정적. 갈래는 이 도구가 GAIT.cnLight 를 0·1 로 바꿔 돈다
//  실행: node tools/sim/cn_light_push.mjs [무기 qinggang] [gap 3.0] [s0 0,0.25,0.45] (CLP_ROWS=1 → 판마다 줄)
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';

const { GAIT } = CONFIG;
const [id = 'qinggang', gapArg = '3.0', s0Arg = '0,0.25,0.45'] = process.argv.slice(2);
const GAP = +gapArg;
const S0 = s0Arg.split(',').map(Number);
const ROWS = process.env.CLP_ROWS === '1';
const TS = Array.from({ length: 16 }, (_, i) => +(i * 0.02).toFixed(2)); // 0 ~ 0.30 s (stepTime 상한 0.3)
const T_WAIT = 3.3;
const CN0 = GAIT.cnLight;

function run(arm, s0, T) {
  GAIT.cnLight = arm;
  const G = newRound({ walls: false, seed: 7, weapon: id, weapon2: 'longsword', gap: GAP });
  const P = G.player;
  const E = G.enemy;
  P.aiControlled = true; // AI 가 모는 몸 (유파 걸음 플레이어 덮개·플레이어만 장치 없음 — 동방은 덮개가 없어 걸음 값은 같음)
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  const g = P.gait;
  const cutTime = P.swordArt.measure.cutTime;
  let t = 0;
  const step = (y) => {
    P.move.set(0, y);
    G.step();
    t += DT;
  };
  while (t < T_WAIT - 1e-9) step(0);
  const t1 = t;
  while (t - t1 < 0.8 - 1e-9) step(s0);
  const fwd = P.forward(new THREE.Vector3());
  const c0 = P.bodies.chest.translation();
  const C0 = { x: c0.x, z: c0.z };
  const v = P.bodies.pelvis.linvel();
  const v0 = v.x * fwd.x + v.z * fwd.z;
  const along = () => {
    const c = P.bodies.chest.translation();
    return (c.x - C0.x) * fwd.x + (c.z - C0.z) * fwd.z;
  };
  const cs = g.P.cutStep;
  let asked = false;
  let tr = 0;
  let dMax = -Infinity;
  let dCut = null;
  let falls = 0;
  let prev = P.state;
  let lev = 0;
  const d0 = P.foeDistance();
  while (tr < T + 1.2 - 1e-9) {
    const pushing = tr < T - 1e-9;
    if (pushing && !asked && cs && g.requestStep({ kind: cs.kind, fwd: cs.fwd, hold: 0.3, draw: !!cs.draw })) asked = true;
    step(pushing ? 1 : -0.21);
    tr += DT;
    const d = along();
    dMax = Math.max(dMax, d);
    if (dCut == null && tr >= cutTime - 1e-9) dCut = d;
    if (prev === 'stand' && P.state === 'down') falls++;
    prev = P.state;
    if (g.active && g.levC > 0.3) lev += DT;
  }
  GAIT.cnLight = CN0;
  return { v0, dMax, dCut, asked, falls, lev, cutTime, d0, light: g.P.light ?? 1 };
}

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
console.log(`# 미는 시간과 몸이 간 거리 — ${id} (AI 몸) · 상대 가슴 ${GAP} m · 다가감 스틱 ${S0.join(' · ')} · 내딛기 스틱 1 을 T s(0 ~ 0.30) + 베기 걸음 부탁 → 스틱 −0.21 · 끔 = GAIT.cnLight 0 · 켬 = 1`);
const all = [];
for (const s0 of S0) {
  const off = TS.map((T) => run(0, s0, T));
  const on = TS.map((T) => run(1, s0, T));
  const L = on[0].light;
  all.push({ s0, off, on, L });
  console.log(`\n## 다가감 스틱 ${s0} — 내딛기 시작 때 골반 앞 빠르기 끔 ${f2(off[0].v0)} · 켬 ${f2(on[0].v0)} m/s · light ${L} · cutTime ${f2(off[0].cutTime)} s\n`);
  console.log('| T s | 가장 멀리 m 끔 → 켬 | cutTime 뒤 m 끔 → 켬 | 켬에서 같은 거리를 내는 T′ s | T′ ÷ T | 걸음 부탁 받음 (끔·켬) | 넘어짐 · 반사 s (끔 → 켬) |');
  console.log('|---|---|---|---|---|---|---|');
  for (let i = 0; i < TS.length; i++) {
    const T = TS[i];
    const target = off[i].dMax;
    // 켬 T 격자에서 target 과 같은 가장 멀리를 내는 T′ (선형 보간 — 단조 구간)
    let Tp = NaN;
    for (let j = 0; j < TS.length - 1; j++) {
      const a = on[j].dMax;
      const b = on[j + 1].dMax;
      if ((a - target) * (b - target) <= 0 && a !== b) {
        Tp = TS[j] + ((target - a) / (b - a)) * (TS[j + 1] - TS[j]);
        break;
      }
    }
    if (!Number.isFinite(Tp) && target <= on[0].dMax) Tp = 0;
    console.log(`| ${f2(T)} | ${f3(off[i].dMax)} → ${f3(on[i].dMax)} | ${f3(off[i].dCut)} → ${f3(on[i].dCut)} | ${f3(Tp)} | ${T > 0 && Tp > 0 ? f2(Tp / T) : '-'} | ${off[i].asked ? 'O' : '-'}·${on[i].asked ? 'O' : '-'} | ${off[i].falls} · ${f2(off[i].lev)} → ${on[i].falls} · ${f2(on[i].lev)} |`);
  }
  const s = (R) => (R[0].v0 > 0.05 ? R[0].dCut / (R[0].v0 * R[0].cutTime) : NaN);
  console.log(`\n- T 0 (내딛지 않고 멈춤만): cutTime 뒤 간 거리 끔 ${f3(off[0].dCut)} · 켬 ${f3(on[0].dCut)} m · ÷ (v0 × cutTime) = 끔 ${f2(s(off))} · 켬 ${f2(s(on))} (contactDist 가 가정한 몫 0.7)`);
  // 내딛기가 더한 거리 (T 의 가장 멀리 − T 0 의 가장 멀리) 의 켬 ÷ 끔
  const add = (R, i) => R[i].dMax - R[0].dMax;
  const ratios = TS.map((T, i) => (i > 0 && add(off, i) > 0.01 ? add(on, i) / add(off, i) : NaN)).filter(Number.isFinite);
  if (ratios.length) console.log(`- 내딛기가 더한 거리(가장 멀리 − T 0) 켬 ÷ 끔: ${ratios.map(f2).join(' · ')} (T 0.02 ~ 0.30 — 가속 한도에 묶이면 light ${L} · 빠르기 꼬리에 들면 그보다 작음)`);
}
// 요약: T′ ÷ T 의 분포 (T ≥ 0.06 · 모든 v0) vs 1/√light
const rs = [];
for (const A of all) {
  for (let i = 0; i < TS.length; i++) {
    const T = TS[i];
    if (T < 0.06) continue;
    const target = A.off[i].dMax;
    for (let j = 0; j < TS.length - 1; j++) {
      const a = A.on[j].dMax;
      const b = A.on[j + 1].dMax;
      if ((a - target) * (b - target) <= 0 && a !== b) {
        rs.push({ s0: A.s0, T, r: (TS[j] + ((target - a) / (b - a)) * (TS[j + 1] - TS[j])) / T });
        break;
      }
    }
  }
}
if (rs.length) {
  const r = rs.map((x) => x.r).sort((a, b) => a - b);
  const L = all[0].L;
  console.log(`\n## 요약 — 같은 거리를 내는 미는 시간 T′ ÷ T (T 0.06 ~ 0.30 · 다가감 ${S0.join(' · ')} · ${r.length} 칸): 중앙 ${f2(r[Math.floor(r.length / 2)])} [${f2(r[0])} ~ ${f2(r[r.length - 1])}] · 1/√light = ${f2(1 / Math.sqrt(L))} · 1/light = ${f2(1 / L)}`);
  for (const s0 of S0) {
    const q = rs.filter((x) => x.s0 === s0).map((x) => x.r);
    if (q.length) console.log(`  다가감 ${s0}: ${q.map(f2).join(' · ')}`);
  }
}
if (ROWS) for (const A of all) for (let i = 0; i < TS.length; i++) console.log(`  s0 ${A.s0} T ${f2(TS[i])} 끔 v0 ${f2(A.off[i].v0)} d0 ${f2(A.off[i].d0)} · 켬 v0 ${f2(A.on[i].v0)}`);
GAIT.cnLight = CN0;
