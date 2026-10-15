// 카메라 따라가기 측정 (10/15 사장님 '백스텝을 밟으려 하면 카메라에 막히고, 카메라 이동 속도가 캐릭터 걸음보다 느리다' — docs/strike/camera_open_2026-10-15.md §2)
//  노드 물리(harness_m — 게임과 같은 몸·걸음) 위에 main.js 와 같은 카메라 셈(src/camera_rig.js)을 그대로 얹어 잰다. 화면은 게임 루프처럼:
//  화면 시간 dt(실제) · 게임 시간 = dt × 템포 1.1 을 acc 에 모아 1/120 s 스텝을 돌리고(화면마다 2·3 스텝), 남은 acc 를 카메라에 넘긴다.
//  견줌: 옛 카메라(10/15 오전 — 무게중심 follow 5 → 자리 6 · 바라보는 점 6) · 새 카메라(camera_rig 따라가기 + 물러날 때 올림 + 최소 거리)
//  재는 것 (구간마다): 빠르기(실제 m/s) · 카메라 ↔ 몸 무게중심 수평 거리(평균·최소·최대 — 서 있을 때 3.04) · 지연(진행 방향으로 카메라가 있어야 할 자리에서 뒤처진 몫 ÷ 빠르기, 실제 초)
//   · 흔들림(카메라 자리의 화면 사이 둘째 차분 RMS · 0.033 s 가우스로 거른 나머지 RMS, mm — 서 있기 · 걷기) · 물러날 때 올린 높이
//  플레이어(index 0)는 AI 없이 스틱 대본만 (끝까지 밂), 상대는 제자리. 대본 셋: walk(앞·뒤·옆 2 s 씩 — 서 있다가 뒤·옆으로 떼는 첫 걸음은 첫 걸음 박차기 GAIT.stepBurst 그대로)
//   · step(서 있다가 0.3 s 짧게 뒤·옆으로 미는 박차기 — 뒤 0.3 s 에 ≈ 0.40 m, 판 끝까지 카메라-몸 거리 최소·뒤처짐 최대) · emu(--emu: 뒤 2 m/s 를 1.2 s 이어 미는 흉내 — 그 동안 GAIT.backFactor·maxAccel 을 이 도구 안에서만)
//  실행: node tools/sim/cam_follow_probe.mjs [--walk=old] [--fps=60] [--weapon=longsword] [--jitter=0] [--emu [--burst=2.0]] [--stepBurst=0]  (--walk=old = 10/15 전 걷기 빠르기 2.3·×0.45·×0.31 — 브라우저 ?walk=old 와 같은 값)
//   --jitter=0.2: 화면 시간을 ±20 % 흔들어(폰 프레임 들쭉날쭉) 잰다 · --occl: 가림 모형만 (물러날 때 올림 vs 뒤로 빼기)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { followState, followReset, followStep, retreatStep, basePose, keepDistance } from '../../src/camera_rig.js';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const { CAMERA, GAIT, PHYSICS } = CONFIG;
const TEMPO = 1.1;
const FPS = +(opt.fps ?? 60);
const JIT = +(opt.jitter ?? 0);
const BURST = +(opt.burst ?? 2.0);
const BURST_ACC = +(opt.burstAccel ?? 2); // 박차기 흉내 동안 발 가속 한도 GAIT.maxAccel 배수 (보통 3.2 m/s² 로는 0.4 s 에 2 m/s 에 못 닿는다)
if (opt.walk === 'old') Object.assign(GAIT, { moveSpeed: 2.3, backFactor: 0.45, sideFactor: 0.31 });
if (opt.stepBurst != null) GAIT.stepBurst = +opt.stepBurst ? 1 : 0; // 첫 걸음 박차기 켬·끔 (브라우저 ?stepBurst 와 같은 뜻)
const baseBack = GAIT.backFactor;
const baseAcc = GAIT.maxAccel;

const PLANS = {
  walk: [['s', 0.5], ['b', 2.0], ['s', 1], ['f', 2.0], ['s', 1], ['l', 2], ['s', 1], ['r', 2], ['s', 1]],
  step: [['s', 0.6], ['b', 0.3], ['s', 0.9], ['b', 0.3], ['s', 0.9], ['l', 0.3], ['s', 0.9], ['r', 0.3], ['s', 0.9], ['b', 0.6], ['s', 1.0]],
};
if (opt.emu) PLANS.emu = [['s', 0.5], ['B', 1.2], ['s', 1.2], ['f', 1.4], ['s', 1], ['B', 0.4], ['s', 0.6], ['B', 0.4], ['s', 0.6], ['B', 0.4], ['s', 1]];
const STICK = { f: [0, 1], b: [0, -1], B: [0, -1], l: [-1, 0], r: [1, 0], s: [0, 0] };
const NAME = { f: '앞', b: '뒤', B: `뒤 ${BURST} m/s`, l: '왼', r: '오른', s: '섬' };

/** 한 판: 대본대로 몰며 화면마다 몸·상대 자리를 적는다 (카메라는 나중에 같은 기록 위에서 두 가지로) */
function record(plan) {
  GAIT.backFactor = baseBack;
  const G = newRound({ walls: true, seed: 7, weapon: opt.weapon || 'longsword', weapon2: 'longsword' });
  G.ai.update = () => G.enemy.move.set(0, 0);
  const P = G.player;
  let t = 0, acc = 0, rnd = 1;
  const frames = [];
  const segs = [];
  let pi = -1, pEnd = 2.3;
  const jr = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  while (pi < plan.length) {
    const dt = (1 / FPS) * (1 + JIT * jr());
    acc += dt * TEMPO;
    let steps = 0;
    while (acc >= DT && steps < PHYSICS.maxStepsPerFrame) {
      if (t >= pEnd) {
        pi++;
        if (pi < plan.length) { segs.push({ k: plan[pi][0], a: t, b: t + plan[pi][1] }); pEnd = t + plan[pi][1]; }
      }
      const k = pi >= 0 && pi < plan.length ? plan[pi][0] : 's';
      GAIT.backFactor = k === 'B' ? BURST / GAIT.moveSpeed : baseBack;
      GAIT.maxAccel = k === 'B' ? baseAcc * BURST_ACC : baseAcc;
      P.move.set(STICK[k][0], STICK[k][1]);
      G.step();
      t += DT;
      acc -= DT;
      steps++;
    }
    if (steps === PHYSICS.maxStepsPerFrame) acc = 0;
    const c = P.com || P.bodies.pelvis.translation();
    const e = G.enemy.com || G.enemy.bodies.pelvis.translation();
    frames.push({ t, dt, steps, acc, x: c.x, y: c.y, z: c.z, ex: e.x, ez: e.z, stand: P.state === 'stand' });
  }
  GAIT.backFactor = baseBack;
  GAIT.maxAccel = baseAcc;
  return { frames, segs };
}

/** 카메라 셈: 'old' = 10/15 오전 main.js · 'new' = camera_rig (main.js 와 같은 함수 · 같은 차례) */
function camera(frames, kind) {
  const out = [];
  const S = followState();
  const f0 = frames[0];
  followReset(S, f0);
  let dirX = 1, dirZ = 0;
  let cam = null, look = null;
  const tgt = { x: 0, y: 0, z: 0 };
  for (const F of frames) {
    let a;
    if (kind === 'old') {
      const g = 1 - Math.exp(-F.dt * CAMERA.follow);
      S.f.x += (F.x - S.f.x) * g; S.f.y += (F.y - S.f.y) * g; S.f.z += (F.z - S.f.z) * g;
      a = S.f;
    } else a = followStep(S, F, F.steps, F.acc, F.dt, F.stand, CAMERA, DT);
    let dx = F.ex - a.x, dz = F.ez - a.z;
    const L = Math.hypot(dx, dz);
    if (L > 0.3) {
      const g = 1 - Math.exp(-F.dt * 3);
      dirX += (dx / L - dirX) * g; dirZ += (dz / L - dirZ) * g;
      const n = Math.hypot(dirX, dirZ); dirX /= n; dirZ /= n;
    }
    const lift = kind === 'old' ? 0 : retreatStep(S, dirX, dirZ, F.dt, F.stand, CAMERA);
    basePose(a, dirX, dirZ, lift, 0, CAMERA, tgt);
    if (kind !== 'old') keepDistance(tgt, F, CAMERA.minDist);
    const lk = { x: a.x + dirX * CAMERA.lookAhead, y: 1.1, z: a.z + dirZ * CAMERA.lookAhead };
    if (kind === 'old') {
      const k = 1 - Math.exp(-F.dt * 6);
      if (!cam) { cam = { ...tgt }; look = { ...lk }; }
      for (const c of ['x', 'y', 'z']) { cam[c] += (tgt[c] - cam[c]) * k; look[c] += (lk[c] - look[c]) * k; }
    } else { cam = { ...tgt }; look = lk; }
    out.push({ t: F.t, cx: cam.x, cy: cam.y, cz: cam.z, lx: look.x, lz: look.z, dirX, dirZ, lift, px: F.x, pz: F.z });
  }
  return out;
}

const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
function gauss(v, sigma) {
  const r = Math.ceil(4 * sigma);
  const w = []; let ws = 0;
  for (let i = -r; i <= r; i++) { const x = Math.exp(-0.5 * (i / sigma) ** 2); w.push(x); ws += x; }
  return v.map((_, i) => { let s = 0; for (let j = -r; j <= r; j++) s += w[j + r] * v[Math.min(v.length - 1, Math.max(0, i + j))]; return s / ws; });
}
/** 흔들림 (mm): 화면 사이 둘째 차분 RMS · 0.033 s(2 화면) 가우스로 거른 나머지 RMS — 고른 i 화면만 센다 */
function jitter(C, idx, kx = 'cx', kz = 'cz') {
  const X = C.map((c) => c[kx]), Z = C.map((c) => c[kz]);
  const sx = gauss(X, 2), sz = gauss(Z, 2);
  const hp = idx.map((i) => Math.hypot(X[i] - sx[i], Z[i] - sz[i]) * 1000);
  const d2 = idx.filter((i) => i > 0 && i < C.length - 1).map((i) => Math.hypot(X[i + 1] - 2 * X[i] + X[i - 1], Z[i + 1] - 2 * Z[i] + Z[i - 1]) * 1000);
  return { d2: rms(d2), hp: rms(hp) };
}
/** 짧은 박차기 (step 대본): 구간 시작 ~ 놓은 뒤 0.6 s — 몸 최고 빠르기(실제 m/s) · 첫 0.3 s(게임) 간 거리 · 카메라-몸 수평 거리 최소 · 진행 방향으로 있어야 할 자리에서 뒤처진 몫 최대(mm) · 올림 최대 */
function burstReport(C, segs) {
  const rows = [];
  for (const s of segs) {
    if (s.k === 's') continue;
    const idx = C.map((c, i) => i).filter((i) => C[i].t >= s.a && C[i].t <= s.b + 0.6);
    if (idx.length < 4) continue;
    const i0 = idx[0];
    const at03 = idx.find((i) => C[i].t >= s.a + 0.3) ?? idx.at(-1);
    const dx = C[at03].px - C[i0].px, dz = C[at03].pz - C[i0].pz;
    const moved = Math.hypot(dx, dz), ux = dx / (moved || 1), uz = dz / (moved || 1);
    let vmax = 0, dmin = Infinity, lagMax = 0, lift = 0;
    for (let j = 1; j < idx.length; j++) {
      const a = C[idx[j - 1]], c = C[idx[j]];
      vmax = Math.max(vmax, (Math.hypot(c.px - a.px, c.pz - a.pz) / (c.t - a.t)) * TEMPO);
      dmin = Math.min(dmin, Math.hypot(c.cx - c.px, c.cz - c.pz));
      const ix = c.px - c.dirX * CAMERA.back - c.dirZ * CAMERA.shoulder, iz = c.pz - c.dirZ * CAMERA.back + c.dirX * CAMERA.shoulder;
      lagMax = Math.max(lagMax, (ix - c.cx) * ux + (iz - c.cz) * uz);
      lift = Math.max(lift, c.lift);
    }
    rows.push({ k: s.k, moved, vmax, dmin, lagMax, lift });
  }
  return rows;
}
function report(name, C, segs) {
  const rows = [];
  for (const s of segs) {
    if (s.k === 's') continue;
    const settle = s.k === 'B' ? 0.2 : 0.5;
    const idx = C.map((c, i) => i).filter((i) => C[i].t >= s.a + settle && C[i].t <= s.b);
    if (idx.length < 4) continue;
    const i0 = idx[0], i1 = idx.at(-1);
    const vx = (C[i1].px - C[i0].px) / (C[i1].t - C[i0].t), vz = (C[i1].pz - C[i0].pz) / (C[i1].t - C[i0].t);
    const sp = Math.hypot(vx, vz), ux = vx / sp, uz = vz / sp;
    let lagSum = 0;
    const d = [];
    for (const i of idx) {
      const c = C[i];
      // 있어야 할 자리 = 지금 몸 자리에서 같은 방향으로 계산한 평소 자리 (올림·최소 거리는 수평이 아니니 수평만)
      const ix = c.px - c.dirX * CAMERA.back - c.dirZ * CAMERA.shoulder, iz = c.pz - c.dirZ * CAMERA.back + c.dirX * CAMERA.shoulder;
      lagSum += (ix - c.cx) * ux + (iz - c.cz) * uz;
      d.push(Math.hypot(c.cx - c.px, c.cz - c.pz));
    }
    const lift = Math.max(...C.filter((c) => c.t >= s.a && c.t <= s.b + 0.3).map((c) => c.lift));
    rows.push({ k: s.k, sp: sp * TEMPO, lag: lagSum / idx.length / (sp * TEMPO), dMean: d.reduce((a, b) => a + b, 0) / d.length, dMin: Math.min(...d), dMax: Math.max(...d), lift, jit: jitter(C, idx) });
  }
  // 서 있기: 대본의 '섬' 구간 가운데 멈춘 지 0.6 s 넘은 화면 + 처음 정지
  const still = C.map((c, i) => i).filter((i) => segs.some((s) => s.k === 's' && C[i].t >= s.a + 0.6 && C[i].t <= s.b) || C[i].t < 2.2);
  const j0 = jitter(C, still), jl = jitter(C, still, 'lx', 'lz');
  const walk = C.map((c, i) => i).filter((i) => segs.some((s) => s.k !== 's' && C[i].t >= s.a + 0.3 && C[i].t <= s.b));
  const j1 = jitter(C, walk), jlw = jitter(C, walk, 'lx', 'lz');
  return { name, rows, still: j0, stillLook: jl, walk: j1, walkLook: jlw };
}

const f2 = (x) => x.toFixed(2);

// --occl: 가림 모형 — 내 몸(세운 캡슐 반지름 0.24 m · 0.15~1.45 m + 머리 0.12 m + 칼팔)이 사이 거리 gap 앞 상대의 머리·가슴·배 15 점을 가리는 몫 (카메라 뒤 B · 높이 H · 어깨 0.9)
if (opt.occl) {
  const segDist = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; const t = L ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)) : 0; return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t); };
  const caps = [[[0, 0.15, 0], [0, 1.45, 0], 0.24], [[0, 1.6, 0], [0, 1.64, 0], 0.12], [[0.15, 1.0, 0.22], [0.35, 1.35, 0.25], 0.08]];
  const hidden = (g, B, H) => {
    const C = [-B, H, CAMERA.shoulder];
    let n = 0, all = 0;
    for (const y of [1.62, 1.45, 1.3, 1.15, 1.0]) for (const z of [-0.15, 0, 0.15]) {
      all++;
      const q = [g, y, z];
      for (let k = 1; k < 160; k++) {
        const t = k / 160;
        const p = [C[0] + (q[0] - C[0]) * t, C[1] + (q[1] - C[1]) * t, C[2] + (q[2] - C[2]) * t];
        if (caps.some(([a, b, r]) => segDist(p, a, b) < r)) { n++; break; }
      }
    }
    return n / all;
  };
  const B = CAMERA.back, H = CAMERA.height, d = CAMERA.retreatLift;
  console.log(`가림 모형 (사이 거리 → 상대 15 점 가운데 내 몸에 가린 몫): 평소(뒤 ${B} · 높이 ${H}) | +${d} 올림 | +${d} 뒤로 | 둘 다`);
  for (const g of [1.2, 1.5, 1.8, 2.1]) console.log(`  ${g} m: ${[[B, H], [B, H + d], [B + d, H], [B + d, H + d]].map(([b, h]) => `${(hidden(g, b, h) * 100).toFixed(0)} %`).join(' | ')}`);
  process.exit(0);
}
console.log(`카메라 따라가기 측정 — 걷기 ${opt.walk === 'old' ? '10/15 전 값' : '지금 값'}(앞 ${GAIT.moveSpeed} · 뒤 × ${baseBack} · 옆 × ${GAIT.sideFactor}) · 화면 ${FPS} fps${JIT ? ` ±${JIT * 100}%` : ''} · 템포 ${TEMPO} · 무기 ${opt.weapon || 'longsword'}`);
console.log(`새 카메라 값: followTau ${CAMERA.followTau} s · followTauDown ${CAMERA.followTauDown} s · minDist ${CAMERA.minDist} m · retreatLift ${CAMERA.retreatLift} m (${CAMERA.retreatFrom}→${CAMERA.retreatFull} m/s, 오름 ${CAMERA.retreatRise} · 내림 ${CAMERA.retreatFall} s)`);
for (const [pname, plan] of Object.entries(PLANS)) {
  const R = record(plan);
  for (const kind of ['old', 'new']) {
    const C = camera(R.frames, kind);
    const rep = report(kind, C, R.segs);
    console.log(`\n[${pname} · ${kind === 'old' ? '옛 카메라' : '새 카메라'}]`);
    if (pname === 'step') {
      for (const r of burstReport(C, R.segs)) console.log(`  ${NAME[r.k].padEnd(5)} 0.3 s 간 ${f2(r.moved)} m · 몸 최고 ${f2(r.vmax)} m/s · 카메라-몸 거리 최소 ${f2(r.dmin)} m · 뒤처짐 최대 ${(r.lagMax * 1000).toFixed(0)} mm · 올림 최대 ${f2(r.lift * CAMERA.retreatLift)} m`);
      continue;
    }
    for (const r of rep.rows) console.log(`  ${NAME[r.k].padEnd(9)} 빠르기 ${f2(r.sp)} m/s · 지연 ${(r.lag * 1000).toFixed(0).padStart(4)} ms · 거리 평균 ${f2(r.dMean)} (최소 ${f2(r.dMin)} · 최대 ${f2(r.dMax)}) m · 올림 최대 ${f2(r.lift * CAMERA.retreatLift)} m · 흔들림 둘째 차분 ${f2(r.jit.d2)} · 거른 나머지 ${f2(r.jit.hp)} mm`);
    console.log(`  서 있기 흔들림: 카메라 둘째 차분 ${f2(rep.still.d2)} · 거른 나머지 ${f2(rep.still.hp)} mm · 바라보는 점 ${f2(rep.stillLook.d2)} · ${f2(rep.stillLook.hp)} mm`);
    console.log(`  걷기 흔들림:   카메라 둘째 차분 ${f2(rep.walk.d2)} · 거른 나머지 ${f2(rep.walk.hp)} mm · 바라보는 점 ${f2(rep.walkLook.d2)} · ${f2(rep.walkLook.hp)} mm`);
  }
}
