// ─────────────────────────────────────────────────────────────
//  b4_probe.mjs — B4(이베리아 특수 공격 · 길게 눌러 메었다 떼어 내려침) 다시 짠 꼴 재기 (사장님 10/31 19:xx '칼을 더 들어올리거나 아예 어깨에 얹거나. 그리고 칼 끝이 머리 뒤로 넘어와서
//   땅쪽으로 기울어 있어야 해' · '45도~90도 사이로 적정 길을 유지해' — 기록 docs/strike/b4_rework_2026-10-31.md). 재기만 한다 — 게임 값은 --set · --old 로 바꿔 견줌.
//  사람 몸(0 번 · 츠바이핸더 등)이 손가락을 댄 채(handHeld) 탭을 끌지 않고 길게 누름 → 감기(메기) → 감기 시작부터 hold 실제 초 뒤 뗌 → 내려침 → 뗀 뒤 after 실제 초.
//   상대는 그 무기 닿는 거리 가운데(MEASURED 맞닿기 ~ 닿음 사이 — --gap 으로 바꿈)에 가만히(AI 끔 · 상처는 몸에 안 걸고 기록만 — 쓰러지지 않게).
//  메는 동안(섞기 끝 뒤 · 얹은 채): 칼끝이 내 머리 가운데보다 뒤(몸 틀 앞 x — 음수 = 뒤) · 손보다 아래(땅 쪽 기욺) · 칼 높이각 · 가로각 · 손목 교정(f.wristFixDeg) · 손목 범위 밖 스텝 몫 ·
//   팔 캡슐 넷 ↔ 내 머리 공 · 목 줄 틈(음수 = 뚫음 — tools/sim/mordschlag_selfclip.mjs 와 같은 셈) · 칼(폼멜 끝 ~ 칼끝) ↔ 머리 공 틈 · 칼날 ↔ 내 몸통(가슴 · 배 · 골반 · 머리 — duplieren_check sample) ·
//   가슴 기울기 바뀜 ° · 무게중심 발 둘레 밖(cm) · 균형 걸음 · 넘어짐 · 게임 카메라 칼 화면 길이(px — redondo_rest_view.mjs 와 같은 카메라).
//  내려침(뗀 뒤): 뗌 → 벰 첫 토막 · 뗌 → 첫 상처(실제 s) · 상처(자리 · 심각도 · 에너지 J) · 벰 칼끝 길(몸 틀 = 뗀 때 몸 방향 · 가슴 원점 — 끌고 가는 칼 I.yaw):
//   벰 면이 땅과 이루는 각(°) = 칼끝 점들의 가장 맞는 면(주성분) · 면에서 벗어난 거리 RMS · 최대(m — 곧은가) · 처음 → 끝 칼끝(높이 · 칼 든 쪽 + — 오른 위 → 왼 아래면 y 줄고 z 줄음) ·
//   칼날 ↔ 내 몸통 · 팔 ↔ 머리 틈 · 뗀 뒤 흔들림 · 넘어짐 · 기력(감기 + 칼 하나).
//  옆걸음 판(--side=1 · -1): 메는 동안 다가가다 뗌 sideLead 실제 초 전부터 스틱을 옆으로(이베리아 옆 박차기 B2 — 첫 걸음 박참) · 상대는 AI(막고 치는 — --ai=1)면 맞음 · 막힘을 셈.
//  사용법: node tools/sim/b4_probe.mjs [--ws=zweihander] [--hold=1.6] [--after=0.8] [--old=1] [--set=UNIQUE_ASSIST.rdTajo={"angle":60,…};…] [--seeds=1] [--gap=] [--side=0] [--ai=0] [--json=.tmp/파일] [--trace=1]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { applyB4Old } from '../../src/config.js';
import { sample } from './duplieren_check.mjs';
import { gameCamera, bladeView } from './redondo_rest_view.mjs';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
const r3 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(1));
const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const ptSeg = (A, B, P) => { const ab = B.clone().sub(A); const t = Math.max(0, Math.min(1, P.clone().sub(A).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return A.clone().addScaledVector(ab, t).distanceTo(P); };
const segSeg = (p1, q1, p2, q2) => {
  // 두 선분 사이 가장 가까운 거리 (표본 — 32 점)
  let m = Infinity;
  for (let i = 0; i <= 32; i++) m = Math.min(m, ptSeg(p2, q2, p1.clone().lerp(q1, i / 32)));
  return m;
};
// 몸 캡슐 (fighter.js partDefs): 칼 팔은 x 축 · 빈팔은 y 축 — [반 길이, 반지름, 축]
const CAPS = { uarmS: [0.105, 0.045, 'x'], farmS: [0.095, 0.04, 'x'], uarmO: [0.105, 0.045, 'y'], farmO: [0.095, 0.04, 'y'] };
const capSeg = (b, [h, , ax]) => { const q = Q(b.rotation()); const c = V(b.translation()); const a = new THREE.Vector3(ax === 'x' ? h : 0, ax === 'y' ? h : 0, 0).applyQuaternion(q); return [c.clone().sub(a), c.clone().add(a)]; };
const tilt = (P) => Math.acos(Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.bodies.chest.rotation())).y)) * R2D;

/** 내 몸 틈: 팔 ↔ 머리 공 · 목 줄 (음수 = 뚫음) · 칼(폼멜 끝 ~ 칼끝) ↔ 머리 공 */
export function selfGaps(P) {
  const hd = V(P.bodies.head.translation());
  const hr = P.headR ?? 0.1;
  const ch = P.bodies.chest;
  const neckA = new THREE.Vector3(0, 0.13, 0).applyQuaternion(Q(ch.rotation())).add(V(ch.translation())); // 가슴 몸체 윗면 가운데 → 머리 가운데 (목 줄 · 반지름 0.05)
  let arm = Infinity, armPart = null, neck = Infinity, neckPart = null;
  for (const [k, cap] of Object.entries(CAPS)) {
    if (!P.bodies[k]) continue;
    const [A, B] = capSeg(P.bodies[k], cap);
    const g = ptSeg(A, B, hd) - hr - cap[1];
    if (g < arm) (arm = g), (armPart = k);
    const n = segSeg(A, B, neckA, hd) - 0.05 - cap[1];
    if (n < neck) (neck = n), (neckPart = k);
  }
  let blade = null, shoulder = null, uarm = null, above = null;
  if (P.armed && P.sword) {
    const sq = Q(P.sword.rotation()), sp = V(P.sword.translation()), W = P.weaponCfg;
    const pom = new THREE.Vector3(0, W.gripAlong ?? -0.15, 0).applyQuaternion(sq).add(sp);
    const tip = new THREE.Vector3(0, W.hiltLength + W.bladeLength, 0).applyQuaternion(sq).add(sp);
    blade = ptSeg(pom, tip, hd) - hr - 0.02;
    // 칼 든 어깨 (사장님 10/31 19:xx '칼이 어깨를 파고드는 것처럼 보여'): 어깨 관절(가슴 틀 [0, 0.10, 칼 든 쪽 0.2])에 반지름 0.075 m 공(어깨 · 삼각근 겉) · 칼(칼날 밑동 → 칼끝 · 반두께 0.01) 틈 ·
    //  위팔 캡슐(반지름 0.045) ↔ 칼날 틈 · 칼날이 어깨 관절 위를 지날 때의 높이(어깨 관절에 가로로 가장 가까운 칼날 점 y − 관절 y)
    const ch = P.bodies.chest;
    const S = new THREE.Vector3(0, 0.1, (P.side >= 0 ? 1 : -1) * 0.2).applyQuaternion(Q(ch.rotation())).add(V(ch.translation()));
    const b0 = new THREE.Vector3(0, W.hiltLength, 0).applyQuaternion(sq).add(sp);
    shoulder = ptSeg(b0, tip, S) - 0.075 - 0.01;
    if (P.bodies.uarmS) { const [A, B] = capSeg(P.bodies.uarmS, CAPS.uarmS); uarm = segSeg(A, B, b0, tip) - 0.045 - 0.01; }
    let best = Infinity;
    for (let i = 0; i <= 40; i++) {
      const q = b0.clone().lerp(tip, i / 40);
      const dh = Math.hypot(q.x - S.x, q.z - S.z);
      if (dh < best) (best = dh), (above = q.y - S.y);
    }
  }
  return { arm, armPart, neck, neckPart, blade, shoulder, uarm, above };
}

/** 점들의 가장 맞는 면 (주성분 — 가장 작은 고유 벡터 = 면의 법선) · 면이 땅과 이루는 각 · 면에서 벗어난 거리 RMS · 최대 */
export function planeFit(pts) {
  const n = pts.length;
  if (n < 4) return null;
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(n);
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = [p.x - c.x, p.y - c.y, p.z - c.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += d[i] * d[j];
  }
  // 가장 작은 고윳값의 벡터: 역 거듭제곱 (M + εI)^-1 대신 — 가장 큰 둘을 거듭제곱으로 찾고 외적
  const mul = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
  const norm = (v) => { const L = Math.hypot(...v) || 1; return v.map((x) => x / L); };
  let e1 = norm([1, 0.3, 0.2]);
  for (let k = 0; k < 200; k++) e1 = norm(mul(M, e1));
  const l1 = Math.hypot(...mul(M, e1));
  const M2 = M.map((row, i) => row.map((x, j) => x - l1 * e1[i] * e1[j]));
  let e2 = norm([0.2, 1, 0.4]);
  for (let k = 0; k < 200; k++) e2 = norm(mul(M2, e2));
  const nv = new THREE.Vector3(...e1).cross(new THREE.Vector3(...e2)).normalize();
  const ds = pts.map((p) => p.clone().sub(c).dot(nv));
  return { angle: Math.acos(Math.min(1, Math.abs(nv.y))) * R2D, rms: Math.sqrt(ds.reduce((a, d) => a + d * d, 0) / n), max: Math.max(...ds.map(Math.abs)), normal: nv };
}

/** 한 판 */
export function b4Run({ w = 'zweihander', seed = 1, hold = 1.6, after = 0.8, gap = null, side = 0, sideLead = 0.25, ai = false, prof = 4, foeW = 'longsword', walkIn = false, trace = false, loadOnly = false } = {}) {
  const [C, R] = MEASURED[w] ?? MEASURED.longsword;
  const G = newRound({ walls: true, seed, weapon: w, weapon2: foeW, persona: { proficiency: prof }, gap: gap ?? (ai || walkIn ? R + 1.2 : (C + R) / 2) });
  const P = G.player;
  const D = G.enemy;
  if (!ai) G.ai.update = () => {};
  const wounds = [];
  const pa = D.applyWound.bind(D);
  D.applyWound = (h) => { if (!ai) return; pa(h); }; // AI 판은 상처를 몸에 검 (막고 치는 상대 — 맞음이 판을 바꿈) · 아니면 기록만
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  if (!uq.holdE) throw new Error('B4 가 열리지 않음');
  const pressAt = 3.0;
  const holdG = CONFIG.realS(hold);
  const aftG = CONFIG.realS(after);
  const K = CONFIG.TIME.k;
  let down = false, tWind = null, tRel = null, tEnd = null, stick = [0, 0], st0 = null, stRel = null, rec = null;
  const out = { w, seed, side, load: { n: 0, behind: [], below: [], el: [], az: [], fix: 0, oor: 0, steps: 0, offGap: 0, arm: Infinity, armPart: null, neck: Infinity, blade: Infinity, self: Infinity, dTilt: 0, off: 0, stum: 0, fell: false, len: [], vis: [], above: [] },
    strike: { tLead: null, tHit: null, wounds, tip: [], self: Infinity, arm: Infinity, armPart: null, neck: Infinity, blade: Infinity, dTilt: 0, off: 0, stum: 0, fell: false, blocked: 0, res: null } };
  G.combat.hooks.onWound = ((pw) => (att, vic, r, ...rest) => { pw?.(att, vic, r, ...rest); if (att === P && vic === D && tRel != null) { wounds.push({ t: r3((G.t - tRel) / K), zone: r.zone, part: rest[1]?.v?.part ?? null, sev: r3(r.severity ?? 0), E: r1(r.energy) }); if (out.strike.tHit == null && (r.severity ?? 0) > 0) out.strike.tHit = r3((G.t - tRel) / K); } })(G.combat.hooks.onWound);
  G.before = () => {
    const t = G.t;
    if (t >= pressAt && tRel == null) down = true;
    if (tWind == null && uq.winding) tWind = t;
    const dist = P.foeDistance();
    // 다가감: AI 판 · walkIn 판은 메는 동안 닿는 거리 + 0.3 까지 걸어 들어감 · 옆걸음 판은 뗌 sideLead 전부터 옆
    let mv = [0, 0];
    if ((ai || walkIn) && t >= pressAt && tRel == null) mv = [0, dist > R + 0.05 ? 0.7 : 0];
    let rel = tWind != null && tRel == null && t - tWind >= holdG;
    if ((ai || walkIn) && tWind != null && tRel == null) rel = t - tWind >= holdG && dist <= R + 0.15;
    if ((ai || walkIn) && tWind != null && tRel == null && t - tWind > holdG + 3) rel = true; // 못 다가가면 그만 셈
    if (side && tWind != null && tRel == null && t - tWind >= holdG - CONFIG.realS(sideLead) && dist <= R + 0.5) {
      mv = [side, 0];
      out.sideFrom ??= r3(t);
    }
    if (rel) {
      tRel = t;
      down = false;
      stRel = P.stamina.value;
      out.turns = r3(P.rdWind?.turns ?? 0);
      out.distRel = r3(dist);
    }
    if (tRel != null && t - tRel < CONFIG.realS(0.15) && side) mv = [side, 0]; // 뗀 뒤 잠깐 옆걸음 이어감
    else if (tRel != null) mv = [0, 0];
    P.move.set(mv[0], mv[1]);
    P.stickX = mv[0];
    P.stickY = mv[1];
    uq.holdInput(down, true, false);
    P.handHeld = down;
  };
  const s = P.side >= 0 ? 1 : -1;
  let t0Tilt = null;
  try {
    while (G.t < pressAt + 12) {
      G.step();
      const t = G.t;
      if (t < pressAt) { t0Tilt = tilt(P); st0 = P.stamina.value; out.wounds0 = P.wounds?.length ?? 0; continue; }
      const Wd = P.rdWind;
      const I = P.iai?.moves?.[0]?.rd ? P.iai : null;
      const gp = selfGaps(P);
      if (Wd) {
        const L = out.load;
        L.dTilt = Math.max(L.dTilt, Math.abs(tilt(P) - t0Tilt));
        L.off = Math.max(L.off, P.offBalance ?? 0);
        L.stum = Math.max(L.stum, P.stumble?.length?.() ?? 0);
        if (P.state !== 'stand') L.fell = true;
        const sm = sample(P, D, { cross: 0 });
        if (Wd.t > 0 && Wd.k < 1) {
          // 섞는 길 (지금 손 → via → 메기 — 감기 첫 스텝은 놓기 전이라 뺌)
          L.bArm = Math.min(L.bArm ?? Infinity, gp.arm); if (gp.arm === L.bArm) L.bArmPart = gp.armPart;
          L.bNeck = Math.min(L.bNeck ?? Infinity, gp.neck);
          if (gp.blade != null) L.bBlade = Math.min(L.bBlade ?? Infinity, gp.blade);
          L.bSelf = Math.min(L.bSelf ?? Infinity, sm.self.blade);
        } else if (Wd.k >= 1) {
          L.arm = Math.min(L.arm, gp.arm); if (gp.arm === L.arm) (L.armPart = gp.armPart), (L.armAt = r3((Wd.t - (Wd.M?.windIn ?? 0)) / K)); // 얹은 뒤 몇 실제 초
          L.neck = Math.min(L.neck, gp.neck);
          if (gp.blade != null) L.blade = Math.min(L.blade, gp.blade);
          L.self = Math.min(L.self, sm.self.blade);
          if (gp.shoulder != null && Wd.t > (Wd.M?.windIn ?? 0) + 0.1) {
            L.shoulder = Math.min(L.shoulder ?? Infinity, gp.shoulder);
            if (gp.uarm != null) L.uarm = Math.min(L.uarm ?? Infinity, gp.uarm);
            (L.aboveS ??= []).push(gp.above);
          }
        }
        L.steps++;
        if (sm.w?.oor) L.oor++;
        if (Wd.k >= 1 && sm.off) L.offGap = Math.max(L.offGap, sm.off.gap); // 빈손 ↔ 폼멜 목 (얹은 동안 — 놓침)
        if (Wd.k >= 1 && Wd.t > (Wd.M?.windIn ?? 0) + 0.1) {
          L.n++;
          L.fix = Math.max(L.fix, Math.abs(P.wristFixDeg ?? 0)); // 손목 교정 크기 (부호 없이)
          const inv = P.yaw.clone().invert();
          const hd = V(P.bodies.head.translation());
          const tip = P.bladePoint(1, new THREE.Vector3());
          const hand = V(P.sword.translation());
          const b0 = P.bladePoint(0, new THREE.Vector3());
          L.behind.push(tip.clone().sub(hd).applyQuaternion(inv).x);
          L.below.push(hand.y - tip.y);
          const Dl = tip.clone().sub(b0).normalize().applyQuaternion(inv);
          L.el.push(Math.asin(Math.max(-1, Math.min(1, Dl.y))) * R2D);
          L.az.push(Math.atan2(s * Dl.z, Dl.x) * R2D);
          const cam = gameCamera(P, D);
          const v = bladeView(P, cam.eye, cam.look, cam.fov);
          L.len.push(v.len); L.vis.push(v.vis); L.above.push(v.above);
          L.tipLoc = tip.clone().sub(V(P.bodies.chest.translation())).applyQuaternion(inv).toArray().map((x, i) => r3(i === 2 ? s * x : x));
          L.handLoc = hand.clone().sub(V(P.bodies.chest.translation())).applyQuaternion(inv).toArray().map((x, i) => r3(i === 2 ? s * x : x));
        }
      }
      if (I) {
        const S = out.strike;
        rec ??= { yaw: I.yaw.clone(), c0: V(P.bodies.chest.translation()) };
        const seg = I.segs?.[I.si];
        if (seg?.cut && S.tLead == null) S.tLead = r3((t - tRel) / K);
        if (seg?.cut) {
          const inv = rec.yaw.clone().invert();
          const tip = P.bladePoint(1, new THREE.Vector3()).sub(rec.c0).applyQuaternion(inv); // 땅 틀 (뗀 때 가슴 자리 · 몸 방향 — 몸이 풀며 앉는 몫까지 든 실제 칼끝 길)
          tip.z *= s;
          S.tip.push(tip);
        }
        const sm = sample(P, D, { cross: 0 });
        S.self = Math.min(S.self, sm.self.blade);
        if (gp.arm < S.arm) (S.arm = gp.arm), (S.armPart = gp.armPart);
        S.neck = Math.min(S.neck, gp.neck);
        if (gp.blade != null) S.blade = Math.min(S.blade, gp.blade);
        if (trace) console.log(`t${((t - tRel) / K).toFixed(3)} seg${I.si}${seg?.cut ? 'c' : 'l'} tip ${P.bladePoint(1, new THREE.Vector3()).toArray().map((x) => x.toFixed(2))} arm ${gp.arm.toFixed(3)} ${gp.armPart} neck ${gp.neck.toFixed(3)} blade ${gp.blade?.toFixed(3)}`);
      }
      if (tRel != null) {
        const S = out.strike;
        S.dTilt = Math.max(S.dTilt, Math.abs(tilt(P) - t0Tilt));
        S.off = Math.max(S.off, P.offBalance ?? 0);
        S.stum = Math.max(S.stum, P.stumble?.length?.() ?? 0);
        if (P.state !== 'stand') S.fell = true;
        if (!I && !P.iaiReq) {
          tEnd ??= t;
          if (!S.res && P.instantResult) S.res = { hits: P.instantResult.hits ?? 0, blocked: !!P.instantResult.blocked, zone: P.instantResult.zone ?? null, E: r1(P.instantResult.energy), sev: r3(P.instantResult.sev) };
          if (t - tEnd > aftG) break;
        }
      }
      if (tWind != null && tRel == null && t - tWind > 8) break;
      if (loadOnly && tWind != null && t - tWind >= holdG) break;
    }
  } finally {
    G.world.free();
  }
  out.tWind = tWind != null ? r3((tWind - pressAt) / K) : null;
  out.tStrike = tEnd != null && tRel != null ? r3((tEnd - tRel) / K) : null;
  out.stamina = { wind: r1(st0 - (stRel ?? st0)), total: r1(st0 - P.stamina.value) };
  out.fired = !!rec; // 내려침이 실제로 나감 (끌고 가는 칼이 돎)
  out.cancel = uq.stats.windCancel ?? null; // 감기 그만둠 까닭 (AI 판 — 맞음 · 칼 세게 맞음 …)
  out.recv = (P.wounds?.length ?? 0) - (out.wounds0 ?? 0); // 이 판 동안 내가 받은 상처 수 (AI 판)
  return out;
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
/** 한 판 줄임 */
export function b4Sum(o) {
  const L = o.load, S = o.strike;
  const pf = planeFit(S.tip);
  const sevSum = S.wounds.reduce((a, x) => a + (x.sev ?? 0), 0);
  const firstCut = S.wounds.find((x) => x.sev > 0);
  return {
    w: o.w, seed: o.seed, side: o.side, tWind: o.tWind, turns: o.turns, distRel: o.distRel, fired: o.fired, cancel: o.cancel, recv: o.recv,
    load: { behind: r3(avg(L.behind)), below: r3(avg(L.below)), el: r1(avg(L.el)), az: r1(avg(L.az)), tip: L.tipLoc, hand: L.handLoc, fixMax: r1(L.fix), offGap: r3(L.offGap), oorShare: L.steps ? r3(L.oor / L.steps) : null, armHead: r3(L.arm), armPart: L.armPart, armAt: L.armAt ?? null, armNeck: r3(L.neck), bladeHead: r3(L.blade), selfBlade: r3(L.self), bladeShoulder: r3(L.shoulder), bladeUarm: r3(L.uarm), bladeAboveShoulder: r3(L.aboveS?.length ? avg(L.aboveS) : null), blend: { armHead: r3(L.bArm), armPart: L.bArmPart ?? null, armNeck: r3(L.bNeck), bladeHead: r3(L.bBlade), selfBlade: r3(L.bSelf) }, dTilt: r1(L.dTilt), offCm: r1(L.off * 100), stumble: r3(L.stum), fell: L.fell, screenPx: r1(avg(L.len)), visPx: r1(avg(L.vis)), abovePx: r1(avg(L.above)) },
    strike: { tLead: S.tLead, tHit: S.tHit, tStrike: o.tStrike, hits: S.wounds.filter((x) => x.sev > 0).length, sevSum: r3(sevSum), first: firstCut ? `${firstCut.zone}/${firstCut.part}:${firstCut.sev}:${firstCut.E}J` : null, res: S.res,
      plane: pf ? { angle: r1(pf.angle), rms: r3(pf.rms), max: r3(pf.max) } : null, tip0: S.tip[0] ? S.tip[0].toArray().map(r3) : null, tip1: S.tip.at(-1) ? S.tip.at(-1).toArray().map(r3) : null,
      selfBlade: r3(S.self), armHead: r3(S.arm), armPart: S.armPart, armNeck: r3(S.neck), bladeHead: r3(S.blade), dTilt: r1(S.dTilt), offCm: r1(S.off * 100), stumble: r3(S.stum), fell: S.fell },
    stamina: o.stamina,
  };
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  if (+args.old) applyB4Old(true);
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const out = [];
  // --cand='[{"hand":[…],"blade":[…],"body":{…}}, …]' : 메기 자리 훑기 (UNIQUE_ASSIST.rdLoad 칸을 덮음)
  const cands = args.cand ? JSON.parse(args.cand) : [null];
  const keepLoad = CONFIG.UNIQUE_ASSIST.rdLoad;
  for (const cand of cands)
  for (const w of String(args.ws || 'zweihander').split(','))
    for (let seed = 1; seed <= +(args.seeds || 1); seed++) {
      CONFIG.UNIQUE_ASSIST.rdLoad = cand ? { ...keepLoad, ...cand } : keepLoad;
      const o = b4Run({ w, seed, hold: +(args.hold || 1.6), after: +(args.after || 0.8), gap: args.gap ? +args.gap : null, side: +(args.side || 0), ai: !!+(args.ai || 0), walkIn: !!+(args.walk || 0), prof: +(args.prof || 4), trace: !!+(args.trace || 0), loadOnly: !!+(args.loadOnly || 0) });
      const sm = b4Sum(o);
      if (cand) sm.cand = cand;
      out.push(sm);
      console.log(JSON.stringify(sm));
    }
  if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
}
