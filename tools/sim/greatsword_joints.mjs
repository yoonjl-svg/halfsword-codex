// ─────────────────────────────────────────────────────────────
//  greatsword_joints.mjs — 대검 동작마다 관절 꺾임 재기 (사장님 11/01 00:xx '대검 몇몇 동작애서 아직도 관절이 이상하게 꺾여.' — docs/motion/guard_arms_2026-10-31.md §11). 재기만.
//   사람 몸(0 번)을 main.js 손가락 규칙대로 몬다: 닿음 handHeld · 움직임 inputActive · 쥠 handGrip(닿은 자리에서 INPUT.holdPx 넘게 끎 — 화면 px = 패드 m ÷ (touchSensitivity / 390), 세로 × 1.35).
//   장면 (무기마다): idle 손 뗌 · rest 엄지 얹음 · cut:<길> 감기(0.3 s) → 긋기(0.15 s) → 댄 채 hold(0.5 s) → 뗌 recover(1.2 s) 여덟 길 · tap 탭 찌르기 ·
//    parry 막기 단추(멈춘 상대 · 치는 AI) · walk 걷기(앞 · 뒤 · 옆 둘 — 손 뗌 · 엄지 얹음) · spin 싱지르(iberian_spin_circle.mjs runCircle — 이베리아만) · b4 정수리 가르기(b4_probe.mjs b4Run — 이베리아만)
//   스텝마다(물리 스텝 뒤 = 그려지는 자세, Fighter.prototype.cacheState 를 감싸 읽기만): joint_range armAngles · wrist_audit wristSample →
//    칼 팔꿈치 굽힘(0 = 곧음 · − = 뒤로 꺾임) · 빈팔 팔꿈치 · 어깨 범위 밖(joint_range LIMITS) · 손목 범위 밖 > 10° · 아래팔-칼 > 135 · 굴림 ≥ 78(손목 밧줄 80 끝) · 교정 각 ·
//    팔꿈치 들림 > 30°(머리 곁으로 꺾여 듦) · 칼 팔 곧게 펴짐 < 10° · 두 팔꿈치 엇갈림(칼 팔꿈치가 빈 팔꿈치보다 빈손 쪽 — 가슴 틀)
//   묶음: 장면마다 스텝 · 각 몫(%) · 최솟값 · 최댓값 · 가장 나쁜 스텝(점수 = 넘친 각의 합) 몇 개
//  node tools/sim/greatsword_joints.mjs [--weapons=zweihander,flamberge,tizona,durandal,monohoshizao] [--scenes=idle,rest,cuts,tap,parry,walk,spin,b4] [--set=SKILL.frameScale=off;SKILL.restTouch=0] [--json=파일] [--worst=3]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';
import { armAngles, outKeys } from './joint_range.mjs';
import { wristSample, outOfRange } from './wrist_audit.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { G as PADS } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';

const { INPUT, ARENA } = CONFIG;
const PX = (INPUT.touchSensitivity ?? 2.6) / 390; // 화면 px 하나의 패드 m (844 × 390 가로 · mobile_intent.js mapMobileHandDelta)
const VG = 1.35; // 폰 세로 배율 (mobile_intent 기본)

// ── 재기 ──
let CUR = null; // 지금 장면 칸 (null = 재지 않음)
let LABEL = null; // 지금 단계 (함수면 몸을 받아 고름)
const BOOK = new Map();
const cache0 = Fighter.prototype.cacheState;
Fighter.prototype.cacheState = function (...a) {
  const r = cache0.apply(this, a);
  if (CUR && this.index === 0 && !this.aiControlled) record(this);
  return r;
};
const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
function elbowsZ(f) {
  const B = f.bodies;
  const c = V(B.chest.translation()), ci = Qr(B.chest.rotation()).invert();
  const loc = (b, l) => new THREE.Vector3(...l).applyQuaternion(Qr(b.rotation())).add(V(b.translation())).sub(c).applyQuaternion(ci);
  const eS = loc(B.uarmS, [0.15, 0, 0]), eO = loc(B.uarmO, [0, -0.15, 0]);
  const s = f.side ?? 1;
  return { zS: eS.z * s, zO: eO.z * s };
}
function record(f) {
  const o = armAngles(f);
  const s = wristSample(f);
  if (!o || !s) return;
  const lab = typeof LABEL === 'function' ? LABEL(f) : LABEL;
  if (!lab) return;
  const key = `${CUR}${lab ? ' · ' + lab : ''}`;
  let T = BOOK.get(key);
  if (!T) BOOK.set(key, (T = { key, n: 0, c: {}, min: {}, max: {}, worst: [] }));
  const ez = elbowsZ(f);
  const v = {
    elbow: s.elbow, elbowO: o.elbowO, roll: s.roll, fix: Math.abs(s.fix ?? 0), wrist: s.wrist, oor: outOfRange(s), fe: Math.abs(s.fe), elbowUp: s.elbowUp, cross: ez.zO - ez.zS, reach: s.reach,
  };
  const sh = outKeys(o).filter((k) => k.startsWith('sh'));
  const flags = {
    hyper: v.elbow < -5, flex: v.elbow > 145, locked: v.elbow < 10, hyperO: v.elbowO != null && v.elbowO < -5, flexO: v.elbowO != null && v.elbowO > 145,
    sh: sh.length > 0, oor10: v.oor > 10, w135: v.wrist > 135, roll78: v.roll >= 78, fix10: v.fix > 10, up30: v.elbowUp > 30, cross: v.cross > 0.02,
  };
  T.n++;
  for (const [k, b] of Object.entries(flags)) if (b) T.c[k] = (T.c[k] ?? 0) + 1;
  for (const [k, x] of Object.entries(v)) if (x != null && Number.isFinite(x)) { T.min[k] = Math.min(T.min[k] ?? Infinity, x); T.max[k] = Math.max(T.max[k] ?? -Infinity, x); }
  // 가장 나쁜 스텝: 넘친 각의 합 (팔꿈치 뒤로 · 지나 굽힘 · 손목 범위 밖 · 굴림 끝 · 교정 · 들림)
  const score = Math.max(0, -5 - v.elbow) + Math.max(0, v.elbow - 145) + (v.elbowO != null ? Math.max(0, -5 - v.elbowO) + Math.max(0, v.elbowO - 145) : 0) + Math.max(0, v.oor - 10) + Math.max(0, v.roll - 78) * 2 + Math.max(0, v.fix - 10) + Math.max(0, v.elbowUp - 30) + sh.length * 10;
  if (score > 0) {
    T.worst.push({ t: +f.fightT?.toFixed?.(2) || null, score: +score.toFixed(1), elbow: +v.elbow.toFixed(0), elbowO: v.elbowO != null ? +v.elbowO.toFixed(0) : null, oor: +v.oor.toFixed(0), roll: +v.roll.toFixed(0), fix: +v.fix.toFixed(0), up: +v.elbowUp.toFixed(0), sh: sh.join('+') || null });
    T.worst.sort((a, b) => b.score - a.score);
    if (T.worst.length > 5) T.worst.length = 5;
  }
}

// ── 사람 손가락 (main.js frame 의 칼 손 줄과 같은 몫) ──
function finger(P) {
  const F = { down: false, x0: 0, y0: 0, moved: 0, path: null, t: 0 };
  F.touch = () => { F.down = true; F.x0 = P.handOffset.x; F.y0 = P.handOffset.y; F.moved = 0; };
  F.lift = () => { F.down = false; F.path = null; };
  /** 패드 길: [[x, y, 초], …] — 지금 자리에서 차례로 곧게 */
  F.go = (pts) => { F.path = { pts, i: 0, t: 0, from: [P.handOffset.x, P.handOffset.y] }; };
  F.tick = (dt) => {
    let dx = 0, dy = 0;
    if (F.down && F.path) {
      const p = F.path;
      const [tx, ty, T] = p.pts[p.i];
      p.t += dt;
      const u = Math.min(1, p.t / T);
      const nx = p.from[0] + (tx - p.from[0]) * u, ny = p.from[1] + (ty - p.from[1]) * u;
      dx = nx - P.handOffset.x;
      dy = ny - P.handOffset.y;
      if (u >= 1) { p.i++; p.t = 0; p.from = [tx, ty]; if (p.i >= p.pts.length) F.path = null; }
    }
    if (F.down) {
      P.handOffset.x += dx;
      P.handOffset.y += dy;
      F.moved = Math.max(F.moved, Math.hypot((P.handOffset.x - F.x0) / PX, (P.handOffset.y - F.y0) / (PX * VG)));
    }
    P.handHeld = F.down;
    P.inputActive = Math.abs(dx) + Math.abs(dy) > 1e-5;
    P.handGrip = F.down ? F.moved >= (INPUT.holdPx ?? INPUT.tapPx) : P.inputActive;
  };
  return F;
}
function round(w, { seed = 7, gap = null, ai = false } = {}) {
  const G = newRound({ seed, weapon: w, weapon2: 'longsword', gap: gap ?? ARENA.startGap });
  const P = G.player, E = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  if (!ai) G.ai.update = () => E.move.set(0, 0);
  E.die = () => {};
  const F = finger(P);
  const extra = [];
  G.before = () => { F.tick(DT); for (const fn of extra) fn(); };
  const steps = (s) => { for (let i = 0; i < Math.round(s / DT); i++) G.step(); };
  const sec = (s) => steps(CONFIG.realS ? CONFIG.realS(s) : s);
  steps(ARENA.startHold + 0.8);
  return { G, P, E, F, steps: sec, extra, free: () => G.world.free() };
}
const LANG = PADS.langort ?? [0, 0.03];
// 여덟 길 (자세 패드 — ai_techniques.js G): 감는 자리 → 끝 자리
const CUTS = {
  down: ['tag', 'alber'], up: ['alber', 'tag'], diagR: ['tagR', 'wechselL'], diagL: ['tagL', 'wechselR'],
  riseR: ['wechselR', 'ochsL'], riseL: ['wechselL', 'ochsR'], horizR: ['sideR', 'sideL'], horizL: ['sideL', 'sideR'],
};
function scene(name, fn) { CUR = name; try { fn(); } finally { CUR = null; LABEL = null; } }

export function runWeapon(w, scenes) {
  const trad = (() => { const R = round(w); const t = R.P.swordArt?.tradition; R.free(); return t; })();
  if (scenes.has('idle') || scenes.has('rest')) {
    const R = round(w);
    if (scenes.has('idle')) scene(`${w} idle`, () => { LABEL = 'lifted'; R.steps(1.0); });
    if (scenes.has('rest')) scene(`${w} rest`, () => { R.F.touch(); R.steps(0.4); LABEL = 'thumb'; R.steps(1.0); R.F.lift(); });
    R.free();
  }
  if (scenes.has('cuts')) {
    for (const [cn, [a, b]] of Object.entries(CUTS)) {
      const R = round(w);
      const A = PADS[a], B = PADS[b];
      scene(`${w} cut:${cn}`, () => {
        R.F.touch();
        LABEL = 'wind'; R.F.go([[A[0], A[1], 0.3]]); R.steps(0.35);
        LABEL = 'cut'; R.F.go([[B[0], B[1], 0.15]]); R.steps(0.18);
        LABEL = 'hold'; R.steps(0.5);
        R.F.lift(); LABEL = 'recover'; R.steps(1.2);
      });
      R.free();
    }
  }
  if (scenes.has('tap')) {
    const R = round(w, { gap: 1.8 });
    scene(`${w} tap`, () => { R.F.touch(); R.steps(0.08); R.F.lift(); R.P.skill.thrust(); LABEL = 'thrust'; R.steps(1.2); });
    R.free();
  }
  if (scenes.has('parry')) {
    for (const ai of [false, true]) {
      const R = round(w, { ai, seed: 21 });
      const pg = new PlayerParryGuard(R.P, R.E);
      R.P.stamina.controller = pg;
      R.extra.push(() => pg.step(DT));
      scene(`${w} parry${ai ? ':ai' : ':still'}`, () => { pg.held = true; LABEL = (f) => (pg.active ? pg.mode ?? 'on' : 'off'); R.steps(ai ? 4.0 : 1.5); pg.held = false; LABEL = 'release'; R.steps(1.0); });
      R.free();
    }
  }
  if (scenes.has('walk')) {
    for (const thumb of [false, true]) {
      const R = round(w);
      scene(`${w} walk${thumb ? ':thumb' : ''}`, () => {
        if (thumb) { R.F.touch(); R.steps(0.3); }
        for (const [mn, mv] of [['fwd', [0, 1]], ['back', [0, -1]], ['left', [-1, 0]], ['right', [1, 0]]]) {
          R.extra.length = 0;
          R.extra.push(() => R.P.move.set(mv[0], mv[1]));
          LABEL = mn; R.steps(1.2);
          R.extra.length = 0; R.P.move.set(0, 0);
          LABEL = `${mn}-stop`; R.steps(0.5);
        }
        R.F.lift();
      });
      R.free();
    }
  }
  return trad;
}
async function runIberianExtras(w, scenes) {
  if (scenes.has('spin')) {
    const { runCircle } = await import('./iberian_spin_circle.mjs');
    for (const [st, input, c] of [['langort', 'circle', { r: 50, T: 0.8, a0: 0, dir: 'ccw', close: 380 }], ['langort', 'circle', { r: 50, T: 0.8, a0: 180, dir: 'cw', close: 380 }], ['ochsR', 'direct', { dir: 'ccw' }]]) {
      scene(`${w} spin:${st}:${c.dir}${input === 'direct' ? ':direct' : ''}`, () => { LABEL = (f) => (f.ibSpin ? 'spin' : f.skill?.secretPhase ? `sec:${f.skill.secretPhase}` : 'other'); runCircle(w, st, input, c, 'stand'); });
    }
  }
  if (scenes.has('b4')) {
    const { b4Run } = await import('./b4_probe.mjs');
    scene(`${w} b4`, () => { LABEL = (f) => (f.rdWind ? 'load' : f.armsPlaced?.() ? 'strike' : f.skill?.swinging ? 'swing' : 'rest'); b4Run({ w, hold: 1.6, after: 0.8 }); });
  }
}

export function summary() {
  return [...BOOK.values()].map((T) => {
    const pc = (k) => +((100 * (T.c[k] ?? 0)) / T.n).toFixed(1);
    const r0 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(0));
    return {
      key: T.key, n: T.n, elbow: [r0(T.min.elbow), r0(T.max.elbow)], elbowO: [r0(T.min.elbowO), r0(T.max.elbowO)], hyper: pc('hyper'), flex: pc('flex'), locked: pc('locked'), hyperO: pc('hyperO'), flexO: pc('flexO'),
      sh: pc('sh'), oor10: pc('oor10'), oorMax: r0(T.max.oor), w135: pc('w135'), roll78: pc('roll78'), rollMax: r0(T.max.roll), fix10: pc('fix10'), fixMax: r0(T.max.fix), up30: pc('up30'), upMax: r0(T.max.elbowUp), cross: pc('cross'), worst: T.worst,
    };
  });
}
export const HEAD = '| 장면 · 단계 | 스텝 | 칼 팔꿈치 최소 · 최대 | 빈 팔꿈치 최소 · 최대 | 뒤로 꺾임 % (칼 · 빈) | 지나 굽힘 % (칼 · 빈) | 칼 팔 곧게 % | 어깨 범위 밖 % | 손목 밖 > 10° % · 최대 | 굴림 ≥ 78 % · 최대 | 교정 > 10° % · 최대 | 팔꿈치 들림 > 30° % · 최대 | 엇갈림 % |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
export const fmt = (r) => `| ${r.key} | ${r.n} | ${r.elbow.join(' · ')} | ${r.elbowO.join(' · ')} | ${r.hyper} · ${r.hyperO} | ${r.flex} · ${r.flexO} | ${r.locked} | ${r.sh} | ${r.oor10} · ${r.oorMax} | ${r.roll78} · ${r.rollMax} | ${r.fix10} · ${r.fixMax} | ${r.up30} · ${r.upMax} | ${r.cross} |`;

if (isMain(import.meta.url)) {
  const args = {};
  for (const a of process.argv.slice(2)) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) args[m[1]] = m[2] ?? true; }
  if (args.set) for (const kv of String(args.set).split(';')) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG[ks[0]];
    for (const k of ks.slice(1, -1)) o = o[k];
    const val = kv.slice(i + 1);
    o[ks.at(-1)] = isNaN(+val) ? val : +val;
  }
  const weapons = String(args.weapons ?? 'zweihander,flamberge,tizona,durandal,monohoshizao').split(',');
  const scenes = new Set(String(args.scenes ?? 'idle,rest,cuts,tap,parry,walk,spin,b4').split(','));
  for (const w of weapons) {
    const trad = runWeapon(w, scenes);
    if (trad === 'iberian') await runIberianExtras(w, scenes);
  }
  const S = summary();
  console.log(`대검 관절 재기${args.set ? ` · set ${args.set}` : ''}`);
  console.log(HEAD);
  for (const r of S) console.log(fmt(r));
  const nW = +(args.worst ?? 3);
  console.log('\n가장 나쁜 스텝 (장면마다 점수 위 ' + nW + ')');
  for (const r of [...S].sort((a, b) => (b.worst[0]?.score ?? 0) - (a.worst[0]?.score ?? 0))) if (r.worst.length) console.log(`${r.key}: ${r.worst.slice(0, nW).map((x) => JSON.stringify(x)).join(' ')}`);
  if (args.json) writeFileSync(args.json, JSON.stringify(S, null, 1));
  process.exit(0);
}
