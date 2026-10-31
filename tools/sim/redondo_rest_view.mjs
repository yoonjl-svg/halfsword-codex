// ─────────────────────────────────────────────────────────────
//  redondo_rest_view.mjs — 풍차 베기 안 B 어깨에 얹은 자세가 게임 카메라에서 보이나 (사장님 10/31 08:xx '풍차 b는 칼을 어깨 위로 올리거나 들지 않던데? … 누가봐도 레돈두 준비처럼 보여야해.' ·
//   docs/strike/redondo_hold_2026-10-29.md §8-12). 재기만 — 게임 값은 --set · --cand 로 바꿔 견줌.
//  사람 몸(0 번 · 츠바이핸더 등)이 서서 손가락을 댄 채 길게 누름 → 감기(rdWindMode 'shoulder') → 얹은 채 rest 초 동안 스텝마다:
//   보임 — 게임 카메라(main.js updateCamera 와 같은 자리: 무게중심에서 상대 쪽 뒤로 CAMERA.back · 오른쪽 CAMERA.shoulder · 높이 CAMERA.height · 앞 lookAhead 를 1.1 m 높이로 봄 ·
//    fov 55 · 844×390)로 칼(밑동 → 칼끝)을 비춘 화면 길이(px)와 그중 내 머리(공 0.12 m) · 몸통(가슴 ~ 골반 줄 0.17 m) 뒤로 가려지지 않은 길이(px) · 칼끝이 머리 위로 솟은 px ·
//    상대 쪽(앞)에서 본 같은 셈(상대 눈 — 상대 가슴 높이에서 나를 봄)
//   자세 — 손목 교정 각(f.wristFixDeg — 최대 · 스텝 사이 뜀) · 놓인 칼 방향 ↔ 목표 방향 어긋남 ° · 칼날 ↔ 내 몸통 · 머리 가장 가까이(m) · 손 높이(가슴 기준) · 팔꿈치 높이(어깨 기준)
//   흔들림 — 가슴 기울기 바뀜 ° · 무게중심 발 둘레 밖(cm) · 넘어짐
//  사용법: node tools/sim/redondo_rest_view.mjs [--ws=zweihander] [--cand='[{"hand":[0.15,0.16,0.12],"blade":[12,155]}, …]'] [--rest=0.8] [--json=.tmp/파일]
//   cand 칸: hand · blade · via({hand, blade}) · body({chestYaw, pelvisYaw, pitch, drop} — 덧씌우기 몸 °·m) — 빠진 칸은 지금 rdShoulder
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { sample } from './duplieren_check.mjs';
import { isMain } from './is_main.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const R2D = 180 / Math.PI;
const r2 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(2));
const V = (p) => new THREE.Vector3(p.x, p.y, p.z);

/** 카메라 (main.js updateCamera · camera_rig basePose 와 같은 자리) — eye(월드) · look(월드) */
export function gameCamera(P, D) {
  const a = V(P.com ?? P.bodies.pelvis.translation());
  const b = V(D.com ?? D.bodies.pelvis.translation());
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const C = CONFIG.CAMERA;
  const eye = a.clone().addScaledVector(dir, -C.back).addScaledVector(right, C.shoulder).setY(C.height);
  const look = a.clone().addScaledVector(dir, C.lookAhead).setY(1.1);
  return { eye, look, fov: C.fov };
}
/** 화면 비추기 (844×390 · 세로 fov) — { x, y, z(앞 거리) } px */
function projector(eye, look, fov, W = 844, H = 390) {
  const f = look.clone().sub(eye).normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  const t = Math.tan((fov * Math.PI) / 360);
  return (p) => {
    const v = p.clone().sub(eye);
    const z = v.dot(f);
    return { x: ((v.dot(r) / (z * t * (W / H)) + 1) / 2) * W, y: ((1 - v.dot(u) / (z * t)) / 2) * H, z };
  };
}
/** 점 p 가 눈 eye 에서 볼 때 몸 조각(공 · 줄) 뒤로 가려지나 */
function hidden(eye, p, parts) {
  const ray = p.clone().sub(eye);
  const L = ray.length();
  const d = ray.clone().divideScalar(L);
  for (const q of parts) {
    if (q.c) {
      // 공: 눈 → p 선분이 공을 지나고 공이 p 보다 앞
      const oc = q.c.clone().sub(eye);
      const tc = oc.dot(d);
      if (tc > 0 && tc < L - q.r * 0.5 && oc.lengthSq() - tc * tc < q.r * q.r) return true;
    } else {
      // 줄(캡슐): 눈 → p 선분과 줄 사이 가장 가까운 거리 < r 이고 그 자리가 p 앞
      const u = q.b.clone().sub(q.a);
      const w0 = eye.clone().sub(q.a);
      const A = d.dot(d), B = d.dot(u), Cc = u.dot(u), Dd = d.dot(w0), E = u.dot(w0);
      const den = A * Cc - B * B;
      let sc = den > 1e-9 ? (B * E - Cc * Dd) / den : 0;
      let tc = den > 1e-9 ? (A * E - B * Dd) / den : 0;
      tc = Math.max(0, Math.min(1, tc));
      sc = Math.max(0, Math.min(L, (tc * B - Dd) / A));
      const pc = eye.clone().addScaledVector(d, sc);
      const qc = q.a.clone().addScaledVector(u, tc);
      if (sc < L - q.r * 0.5 && pc.distanceTo(qc) < q.r) return true;
    }
  }
  return false;
}
/** 칼(밑동 → 칼끝)의 화면 길이 · 가려지지 않은 길이 · 칼끝이 머리 위로 솟은 px (눈 eye · 보는 점 look) */
export function bladeView(P, eye, look, fov) {
  const pr = projector(eye, look, fov);
  const a = P.bladePoint(0, new THREE.Vector3());
  const b = P.bladePoint(1, new THREE.Vector3());
  const head = V(P.bodies.head.translation());
  const parts = [{ c: head, r: 0.12 }, { a: V(P.bodies.chest.translation()).add(new THREE.Vector3(0, 0.1, 0)), b: V(P.bodies.pelvis.translation()), r: 0.17 }];
  let len = 0, vis = 0;
  const N = 16;
  let prev = pr(a), prevH = hidden(eye, a, parts);
  for (let i = 1; i <= N; i++) {
    const p = a.clone().lerp(b, i / N);
    const s = pr(p);
    const h = hidden(eye, p, parts);
    const seg = Math.hypot(s.x - prev.x, s.y - prev.y);
    len += seg;
    if (!h && !prevH) vis += seg;
    else if (!h || !prevH) vis += seg / 2;
    prev = s;
    prevH = h;
  }
  const ht = pr(head.clone().add(new THREE.Vector3(0, 0.12, 0)));
  const tp = pr(b);
  return { len, vis, above: ht.y - tp.y };
}

/** 한 판: 손가락을 댄 채 길게 누름 → 얹음 → rest 초 재기 */
export function restRun({ w = 'zweihander', cand = {}, rest = 0.8, seed = 3 } = {}) {
  const keep = UA.rdShoulder;
  const keepMode = UA.rdWindMode;
  UA.rdShoulder = { ...keep, ...cand, via: cand.via ?? keep.via };
  UA.rdWindMode = 'shoulder';
  const G = newRound({ walls: true, seed, weapon: w, weapon2: 'longsword', gap: 3.0 });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  let down = false;
  G.before = () => { uq.holdInput(down, true, false); P.handHeld = down; };
  const up = (o) => new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w));
  const out = { w, cand, n: 0, len: [], vis: [], above: [], foeVis: [], fix: [], fixJump: 0, dev: [], selfBlade: Infinity, hand: [], elbow: [], tilt0: null, dTilt: 0, off: 0, fell: false };
  try {
    for (let i = 0; i < Math.round(3.0 / DT); i++) G.step();
    out.tilt0 = Math.acos(Math.min(1, up(P.bodies.chest.rotation()).y)) * R2D;
    down = true;
    const M = UA.rdShoulder;
    const tEnd = CONFIG.realS(0.6) + M.windIn + CONFIG.realS(rest) + 0.05;
    let prevFix = null;
    for (let i = 0; i < Math.round(tEnd / DT); i++) {
      G.step();
      const W = P.rdWind;
      if (P.state !== 'stand') out.fell = true;
      const tilt = Math.acos(Math.min(1, up(P.bodies.chest.rotation()).y)) * R2D;
      out.dTilt = Math.max(out.dTilt, Math.abs(tilt - out.tilt0));
      out.off = Math.max(out.off, P.offBalance ?? 0);
      if (W) out.selfBladeWind = Math.min(out.selfBladeWind ?? Infinity, sample(P, D, { cross: 0 }).self.blade); // 섞는 길 포함 (via 를 거쳐 얹는 동안 칼날이 제 머리 · 몸을 지나나)
      if (!W || W.k < 1 || W.t < M.windIn + 0.1) continue;
      out.n++;
      // 가슴이 몸 방향에서 칼 든 쪽으로 돈 각 (° — 감는 몸 꼬임 body.chestYaw 의 실제)
      {
        const cq = P.bodies.chest.rotation();
        const cf = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(cq.x, cq.y, cq.z, cq.w)).applyQuaternion(P.yaw.clone().invert());
        (out.cy ??= []).push(Math.atan2((P.side >= 0 ? 1 : -1) * cf.z, cf.x) * R2D);
      }
      const cam = gameCamera(P, D);
      const v = bladeView(P, cam.eye, cam.look, cam.fov);
      out.len.push(v.len);
      out.vis.push(v.vis);
      out.above.push(v.above);
      // 상대 눈: 상대 가슴 높이에서 내 가슴을 봄
      const fe = V(D.bodies.head.translation());
      const fv = bladeView(P, fe, V(P.bodies.chest.translation()), 55);
      out.foeVis.push(fv.vis);
      const fx = P.wristFixDeg ?? 0;
      out.fix.push(fx);
      if (prevFix != null) out.fixJump = Math.max(out.fixJump, Math.abs(fx - prevFix));
      prevFix = fx;
      // 놓인 칼 방향 ↔ 목표 (몸 틀)
      const a = P.bladePoint(0, new THREE.Vector3());
      const b = P.bladePoint(1, new THREE.Vector3());
      const Dw = b.clone().sub(a).normalize().applyQuaternion(P.yaw.clone().invert());
      out.dev.push(Math.acos(Math.max(-1, Math.min(1, Dw.dot(W.D)))) * R2D);
      out.selfBlade = Math.min(out.selfBlade, sample(P, D, { cross: 0 }).self.blade);
      const c = V(P.bodies.chest.translation());
      const hw = V(P.sword.translation()).sub(c).applyQuaternion(P.yaw.clone().invert());
      out.hand.push(hw.y);
      // 팔꿈치 높이 (칼 팔 위팔 끝 — 아래팔 몸체 위쪽 끝 · 어깨 높이 기준)
      const fa = P.bodies.farmS;
      const fq = new THREE.Quaternion(fa.rotation().x, fa.rotation().y, fa.rotation().z, fa.rotation().w);
      const elbow = V(fa.translation()).add(new THREE.Vector3(0, 0.135, 0).applyQuaternion(fq));
      const sh = V(P.bodies.uarmS.translation()).add(new THREE.Vector3(0, 0.15, 0).applyQuaternion(new THREE.Quaternion(P.bodies.uarmS.rotation().x, P.bodies.uarmS.rotation().y, P.bodies.uarmS.rotation().z, P.bodies.uarmS.rotation().w)));
      out.elbow.push(elbow.y - sh.y);
    }
  } finally {
    G.world.free();
    UA.rdShoulder = keep;
    UA.rdWindMode = keepMode;
  }
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { w, cand, n: out.n, len: r2(avg(out.len)), vis: r2(avg(out.vis)), above: r2(avg(out.above)), foeVis: r2(avg(out.foeVis)), fixMax: r2(Math.max(0, ...out.fix)), fixJump: r2(out.fixJump), devMax: r2(Math.max(0, ...out.dev)), selfBlade: r2(out.selfBlade), selfBladeWind: r2(out.selfBladeWind), chestYaw: r2(avg(out.cy ?? [])), hand: r2(avg(out.hand)), elbow: r2(avg(out.elbow)), dTilt: r2(out.dTilt), off: r2(out.off * 100), fell: out.fell };
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const cands = args.cand ? JSON.parse(args.cand) : [{}];
  const out = [];
  for (const w of String(args.ws || 'zweihander').split(','))
    for (const cand of cands) {
      const r = restRun({ w, cand, rest: +(args.rest || 0.8) });
      out.push(r);
      console.log(JSON.stringify(r));
    }
  if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
}
