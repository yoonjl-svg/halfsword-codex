// 동시 대전 2:2 머리 없는 연기 시험 · 성능 (10/29 — docs/strike/team_fight_2026-10-29.md §성능 · src/match.js · src/team.js)
//  ① 시작 간격: 한 편 둘의 옆 간격(mateGap)마다 판 시작(0 s)과 발 묶임(ARENA.startHold) 동안 다른 싸움꾼 콜라이더 사이 가장 짧은 거리 (음수 = 겹침)
//  ② 연기: 2:2 를 secs 초 돌려 NaN · 예외 · 같은 편 접촉 · 같은 편 상처가 없는지, 상대 바꾸기(ai.setFoe) 횟수 · 끝 상태
//  ③ 성능: 같은 판(씨앗)들을 1:1 · 2:1 · 2:2 로 돌려 물리 한 스텝 ms (가운데 · p95 · 평균)와 그 몫(조종 · 몸 · 물리 world.step · 전투 afterStep)
//  쓰임: node tools/sim/team_perf.mjs [씨앗 수 4] [초 30] [--target=score|pair|nearest] [--only=spacing|smoke|perf] [--counts=2,3,4]
//   score(기본 — 2단계) = src/targeting.js chooseTarget · pair = src/match.js pairFoe (마주 선 짝 0↔1 · 2↔3, 짝이 죽으면 가장 가까운 산 상대 — 1단계 임시) · nearest = 매 스텝 가장 가까운 산 상대 (상대 바꾸기 시험)
//  게임 값이 아닌 재기 도구 — 시간은 이 기계의 Node(V8 + Rapier WASM) 값이다 (폰은 따로 재야 함)
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { newMatch, DT, CONFIG } from './jelly_harness.mjs';
import { stepMatch, nearestFoe, pairFoe, standing, matesOf, foesOf } from '../../src/match.js';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEEDS = +(pos[0] ?? 4);
const SECS = +(pos[1] ?? 30);
const TARGET = flag('target', 'score');
const ONLY = flag('only', '');
const COUNTS = flag('counts', '2,3,4').split(',').map(Number);
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const r1 = (x) => +x.toFixed(1), r2 = (x) => +x.toFixed(2), r3 = (x) => +x.toFixed(3);
const pct = (a, p) => { const b = Float64Array.from(a).sort(); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const foeOf = TARGET === 'nearest' ? (f, M) => nearestFoe(M, f) ?? f.foe ?? foesOf(M, f)[0] : TARGET === 'pair' ? pairFoe : null; // null = createMatch 기본 (chooseTarget)

/** 싸움꾼의 살아 있는 콜라이더 (몸 · 칼 — 떼어 낸 부품 빼고) */
function collidersOf(f, { sword = true } = {}) {
  const out = [];
  for (const k in f.bodies) { const rb = f.bodies[k]; for (let i = 0; i < rb.numColliders(); i++) out.push(rb.collider(i)); }
  if (sword) for (const c of f.swordColliders) if (c.isEnabled() && c.collisionGroups() !== 0) out.push(c);
  return out.filter((c) => !f.colliderInfo.get(c.handle)?.detached);
}
/** a · b 콜라이더 사이 가장 짧은 겉면 거리 (m, 음수 = 겹침 · pred 보다 멀면 Infinity) — 충돌 그룹과 상관없는 모양 거리 */
function minGap(a, b, { sword = true, pred = 3 } = {}) {
  let best = Infinity;
  const A = collidersOf(a, { sword }), B = collidersOf(b, { sword });
  for (const ca of A) for (const cb of B) { const c = ca.contactCollider(cb, pred); if (c && c.distance < best) best = c.distance; }
  return best;
}
/** 같은 편 둘 사이에 물리 접촉(엔진이 푼 접점)이 하나라도 있나 — 충돌 비트가 같은 편을 지나가게 하면 늘 0 */
function mateContacts(world, a, b) {
  let n = 0;
  for (const ca of collidersOf(a)) for (const cb of collidersOf(b)) world.contactPair(ca, cb, (m) => { n += m.numContacts(); });
  return n;
}
const finite = (f) => [f.bodies.chest.translation(), f.bodies.pelvis.translation(), f.sword.translation()].every((t) => Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z));

// ── ① 시작 간격 ──
function spacing() {
  const rows = [];
  const hold = CONFIG.ARENA.startHold;
  for (const mateGap of [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0]) {
    seedRand(1);
    const G = newMatch({ count: 4, ai: 'all', seed: 1, walls: true, mateGap, foeOf });
    const F = G.fighters;
    const mates = [[F[0], F[2]], [F[1], F[3]]];
    const at0 = { body: Math.min(...mates.map(([a, b]) => minGap(a, b, { sword: false }))), all: Math.min(...mates.map(([a, b]) => minGap(a, b))) };
    const foe0 = Math.min(...F.flatMap((a) => foesOf(G, a).map((b) => minGap(a, b))));
    let holdBody = Infinity, holdAll = Infinity;
    for (let i = 0; i < hold / DT; i++) {
      G.step();
      if (i % 6) continue;
      for (const [a, b] of mates) { holdBody = Math.min(holdBody, minGap(a, b, { sword: false })); holdAll = Math.min(holdAll, minGap(a, b)); }
    }
    rows.push({ mateGap, mate0_body: r3(at0.body), mate0_all: r3(at0.all), foe0: r3(foe0), hold_body: r3(holdBody), hold_all: r3(holdAll) });
  }
  return rows;
}

// ── ② · ③ 판 하나 ──
function run(count, seed, { secs = SECS, probe = false } = {}) {
  seedRand(seed);
  const G = newMatch({ count, ai: 'all', seed, walls: true, foeOf });
  const F = G.fighters;
  let mateWounds = 0, wounds = 0;
  G.combat.hooks.onWound = (att, vic) => { wounds++; if (att.team === vic.team) mateWounds++; };
  let swaps = 0;
  for (const ai of G.ais) if (ai) { const s = ai.setFoe.bind(ai); ai.setFoe = (f) => { if (f && f !== ai.foe) swaps++; s(f); }; }
  // 몫 재기: 조종(① ②) · 몸(③ step) · 물리(cacheState + world.step) · 전투(combat.afterStep)
  let t0 = 0, tc = 0, tf = 0, tw = 0, te = 0;
  const after = G.combat.afterStep.bind(G.combat);
  G.combat.afterStep = (w, q) => { tw = performance.now(); after(w, q); te = performance.now(); };
  const hooks = { afterControl: () => { tc = performance.now(); }, afterFighters: () => { tf = performance.now(); } };
  const n = Math.round(secs / DT);
  const ms = new Float64Array(n), ctl = new Float64Array(n), body = new Float64Array(n), phys = new Float64Array(n), cmb = new Float64Array(n);
  let nan = null, error = null, mateTouch = 0, mateOverlap = 0, mateSamples = 0, done = 0;
  const mates = F.flatMap((a) => matesOf(G, a).filter((b) => b.index > a.index).map((b) => [a, b]));
  const cpu0 = process.cpuUsage();
  for (let i = 0; i < n; i++) {
    t0 = performance.now();
    try { stepMatch(G, DT, hooks); } catch (e) { error = `${(i * DT).toFixed(2)} s: ${e.message}`; break; }
    const t1 = performance.now();
    ms[i] = t1 - t0; ctl[i] = tc - t0; body[i] = tf - tc; phys[i] = tw - tf; cmb[i] = te - tw;
    done = i + 1;
    if (!nan) for (const f of F) if (!finite(f)) { nan = `${f.name} @ ${(i * DT).toFixed(2)} s`; break; }
    if (probe && i % 12 === 0) for (const [a, b] of mates) { mateTouch += mateContacts(G.world, a, b); if (G.over || !a.alive || !b.alive) continue; mateSamples++; if (minGap(a, b, { sword: false, pred: 0.5 }) < 0) mateOverlap++; }
  }
  const cpu = process.cpuUsage(cpu0); // 이 판 전체 CPU 시간 (µs — 기계가 붐벼 벽시계가 늘어도 덜 흔들린다 · 첫 1 s 포함)
  const skip = Math.min(done, Math.round(1 / DT)); // 첫 1 s(JIT 데우기)는 시간 셈에서 뺀다
  const sl = (a) => Array.from(a.subarray(skip, done));
  return {
    count, seed, steps: done, nan, error, wounds, mateWounds, swaps, mateTouch, mateOverlapPct: mateSamples ? r1((100 * mateOverlap) / mateSamples) : null,
    end: F.map((f) => `${f.name}:${f.state}`).join(' '), standing: standing(G).join(':'),
    t: { ms: sl(ms), ctl: sl(ctl), body: sl(body), phys: sl(phys), cmb: sl(cmb) }, cpuMs: (cpu.user + cpu.system) / 1000 / Math.max(1, done),
  };
}

const out = { node: process.version, cpu: os.cpus()[0]?.model, cores: os.cpus().length, dt: DT, seeds: SEEDS, secs: SECS, target: TARGET, mateGap: CONFIG.TEAM_FIGHT.mateGap };
console.log(JSON.stringify(out));
if (!ONLY || ONLY === 'spacing') {
  console.log('\n① 시작 간격 (m, 음수 = 겹침) — mate0 = 0 s 같은 편 · foe0 = 0 s 상대 편 · hold = 발 묶임 2 s 동안 같은 편 가장 짧은 (body = 몸만 · all = 칼 포함)');
  for (const r of spacing()) console.log(JSON.stringify(r));
}
if (ONLY === 'spacing') process.exit(0);
let bad = 0;
if (ONLY !== 'perf') {
console.log(`\n② 연기 2:2 (${SECS} s · 상대 고르기 ${TARGET})`);
for (let s = 1; s <= SEEDS; s++) {
  const r = run(4, s, { probe: true });
  if (r.nan || r.error || r.mateWounds || r.mateTouch || r.steps * DT < SECS - 1e-6) bad++;
  console.log(JSON.stringify({ seed: s, steps: r.steps, nan: r.nan, error: r.error, wounds: r.wounds, mateWounds: r.mateWounds, mateContacts: r.mateTouch, mateBodyOverlapPct: r.mateOverlapPct, swaps: r.swaps, standing: r.standing, end: r.end }));
}
console.log(bad ? `연기 실패 ${bad} 판` : '연기 OK (NaN · 예외 · 같은 편 접촉 · 같은 편 상처 0)');
}
if (ONLY === 'smoke') process.exit(bad ? 1 : 0);
console.log(`\n③ 물리 한 스텝 ms (첫 1 s 뺌 · 씨앗 ${SEEDS} · ${SECS} s · 가운데 / p95 / 평균) — 몫: ctl 조종 · body 몸 step · phys cacheState+world.step · cmb combat.afterStep`);
const agg = {};
for (const c of COUNTS) agg[c] = { ms: [], ctl: [], body: [], phys: [], cmb: [], cpu: [] };
for (let s = 1; s <= SEEDS; s++) for (const c of COUNTS) { const r = run(c, s); for (const k in r.t) agg[c][k].push(...r.t[k]); agg[c].cpu.push(r.cpuMs); }
const base = {};
for (const c of COUNTS) {
  const A = agg[c];
  const row = { fighters: c };
  for (const k of ['ms', 'ctl', 'body', 'phys', 'cmb']) row[k] = `${r3(pct(A[k], 0.5))} / ${r3(pct(A[k], 0.95))} / ${r3(mean(A[k]))}`;
  base[c] = pct(A.ms, 0.5);
  row.x2 = base[2] ? r2(base[c] / base[2]) : null; // 1:1 대비 가운데
  row.frame120 = r2(2 * mean(A.ms)); // 60 fps 화면 한 장에 물리 2 스텝(120 Hz)의 평균 ms
  row.cpuPerStep = A.cpu.map(r3).join(' '); // 판마다 CPU ms / 스텝 (씨앗 차례 — 첫 1 s 포함)
  console.log(JSON.stringify(row));
}
process.exit(bad ? 1 : 0);
