// ─────────────────────────────────────────────────────────────
//  순간 베기 — 일본 비기 고노센의 실행 (10/10 사장님: '뭐가 나가긴 한 건지 식별 불가 · 전광석화처럼 · 물리 조건을 다 무시할 수 있는 방법 —
//   도착 지점에 순간이동해서 꽂히고 궤적이 잔상으로 남는다거나 · 경직은 더 길어도' → 디렉터 안 승인 "그렇게 하자").
//
//  **물리 원칙의 예외** (이 게임에서 '대가는 물리로만'을 깨는 곳 — docs/strike/school_secret_2026-10-09.md §13):
//   ① 내딛음: 몸의 강체 전부(골반 닻·칼 포함)를 같은 만큼 앞으로 평행 이동(속도 유지, 최대 SECRET.instantStep, 맞닿기 거리에서 멈추고 clinch 안으로는 안 감).
//      다리 걸음(gait)의 딛은 자리·목표도 같이 옮긴다.
//   ② 팔(칼 쪽 위팔·아래팔)과 칼을 한 프레임에 真向 끝 자세로: 손 목표(skill.aim)를 끝 패드에 두고 driveSword 가 그 패드로 정한 팔 관절 목표
//      (armIK — 서보가 쫓는 바로 그 자세)대로 강체를 놓는다 → 관절 기준점(어깨·팔꿈치·손목)이 맞고, 서보가 다음 스텝에 끌어당기지 않는다.
//      칼날 축 = 서보의 칼끝 목표(aimDirW), 날 = 쓸고 내려온 방향. 두 손 칼이면 빈팔도 빈손 IK(offArmIK)대로 칼자루 끝에. 팔·칼 속도는 가슴과 같게(각속도 0).
//   ③ 맞음은 충돌이 아니라 **쓸고 지나간 자리**: (시작 칼날 → 上段 → 끝 칼날)을 조각으로 보간한 칼날 선분과 상대 몸 부위 콜라이더(공·캡슐·상자)
//      거리로 첫 부위를 찾고, combat.analyze(기존 상처 함수 — 갑옷·투구·문턱·감정 그대로)로 상처를 준다. 에너지 = SECRET.instantJ × hitMul
//      (분석에 넣는 칼 속도를 그 에너지가 나오게 고른다). 결과 보장 아님 — 쓸린 자리에 몸이 없으면 헛침.
//   ④ 칼이 상대 몸 안에 놓일 수 있어 SECRET.instantNoCollide 초 동안 내 칼 ↔ 상대 몸 충돌을 끈다(combat.filterContactPair).
//   ⑤ 잔상: f.instantArc(조각마다 칼자루·칼끝 점)를 sword_trail.js 가 읽어 비기 색으로 한 번에 그린다.
//  부르는 곳: ai.js secretInstant · skill.js secret()(플레이어) 가 requestInstant → combat.afterStep 끝(world.step 뒤 — 권총 한 발과 같은 자리)에서 runInstants.
//  난수 없음. 비기가 아니면(요청 없음) 아무 일도 없다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, ARM, STRIKE, GAIT, ARENA, JOINTS, THRUST } from './config.js';
import { risolutoContact } from './weapon_measured.js'; // 10/25 THRUST.itMeasure 'contact' 판: 리솔루토 런지 미끄러짐은 지금 맞닿음 그대로
const GAIT_REACH = GAIT.reachMax;

const _qc = new THREE.Quaternion();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const clamp = THREE.MathUtils.clamp;
const LEG_POS = ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']; // gait 다리의 월드 자리 칸 (평행 이동에 같이 옮김)

/** 순간 베기를 걸어 둔다 (다음 combat.afterStep 이 실행). 결과는 f.instantResult = { ok, hit, energy, part, zone } */
export function requestInstant(f, opt = {}) {
  f.instantReq = { endPad: opt.endPad ?? SECRET.instantEndPad, at: opt.at ?? null };
  f.instantResult = null;
}

/** combat.afterStep 끝에서: 걸어 둔 순간 베기 실행 · 충돌 끔 시간 줄이기 */
export function runInstants(combat) {
  for (const f of combat.fighters) {
    if (f.stamina?.exhausted) {
      if (f.iai) setKinematic(f, false);
      if (f.iaiRopes) {
        if (f.iaiRopes.grip && f.armed && !f.gripCone) f.gripConeOn();
        if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
        f.iaiRopes = null;
      }
      f.secretStance = null;
      f.instantReq = f.iaiReq = f.iai = null;
      f.instantGhost = f.iaiHoldT = f.iaiFade = f.holdGhost = 0;
      f.iaiOneHold = false;
      continue;
    }
    if (f.instantGhost > 0) f.instantGhost--;
    if (f.holdGhost > 0) f.holdGhost--;
    if (f.instantReq) runInstant(f, combat);
    if (f.iaiReq) startIai(f, combat);
    if (f.iai) (f.iai.kind === 'combo' ? stepCombo : stepIai)(f, combat);
    if (f.iaiHoldT > 0 || f.iaiFade > 0) holdIai(f, combat.dt || 1 / 120);
    stanceTick(f, combat.dt || 1 / 120);
    artTrailTick(f);
  }
}

/** 칼 ↔ 몸 충돌을 끄는 중인가 (combat.filterContactPair) */
export function instantGhost(f) {
  return f.instantGhost > 0;
}

function tv(t, out) {
  return out.set(t.x, t.y, t.z);
}
function tq(r, out) {
  return out.set(r.x, r.y, r.z, r.w);
}

/** 몸 강체 전부·칼·골반 닻·다리 걸음 자리를 (dx, 0, dz) 만큼 평행 이동 (속도 그대로) */
function shiftFighter(f, dx, dz) {
  const bodies = [...Object.values(f.bodies), f.sword];
  for (const b of bodies) {
    const t = b.translation();
    b.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
  }
  if (f.anchor) {
    const t = f.anchor.translation();
    f.anchor.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
  }
  const g = f.gait;
  if (g?.legs) {
    for (const l of Object.values(g.legs)) {
      for (const k of LEG_POS) {
        const v = l[k];
        if (v?.isVector3) {
          v.x += dx;
          v.z += dz;
        }
      }
    }
  }
}

/** 손 목표를 패드 p 에 곧장 (거르기·가죽끈·이어 베기 모두 그 자리, 속도 0) — 서보가 끝 자세를 붙잡게 */
export function snapAim(f, p) {
  const s = f.skill;
  f.handOffset.set(p[0], p[1]);
  for (const v of [s.aim, s.aimRaw, s.anchor, s.prev]) v.set(p[0], p[1]);
  s.aimVel.set(0, 0);
  s.vel.set(0, 0);
  s.follow.set(0, 0);
}

/** 몸체 하나를 놓는다 (속도 = vel, 각속도 0) */
function place(b, p, q, vel) {
  b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
  b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  b.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** 칼 몸체 자세: 칼날 축(y) = D, 날(x) = 쓸고 내려온 방향(D 에 수직인 아래쪽) */
function swordQuat(D, out, hint = null) {
  const x = hint ? _v1.copy(hint).addScaledVector(D, -hint.dot(D)) : _v1.set(0, -1, 0).addScaledVector(D, D.y); // 날 = hint(쓸린 방향)의 D 수직 성분, 없으면 −up 의 D 수직 성분
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0).addScaledVector(D, -D.x);
  x.normalize();
  const z = _v2.crossVectors(x, D).normalize();
  _m.makeBasis(x, D, z);
  return out.setFromRotationMatrix(_m);
}

/** 팔(칼 쪽 위팔·아래팔)·칼(·빈팔)을 끝 패드의 서보 목표 자세로 놓는다. 끝 칼날 { B, D } (월드) */
function poseEnd(f, pad) {
  snapAim(f, pad);
  f.driveSword(); // 그 패드의 팔 관절 목표(armIK)와 칼끝 목표(aimDirW)를 정한다 (이 스텝 힘은 다음 스텝 머리에서 지워진다)
  const J = f.jointByName;
  const chest = f.bodies.chest;
  tq(chest.rotation(), _qc);
  const c = tv(chest.translation(), new THREE.Vector3());
  const vel = tv(chest.linvel(), new THREE.Vector3());
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(_qc).add(c);
  const qu = _q1.copy(_qc).multiply(J.uarmS.target);
  const qf = _q2.copy(qu).multiply(J.farmS.target);
  const elbow = new THREE.Vector3(0.3, 0, 0).applyQuaternion(qu).add(S);
  place(f.bodies.uarmS, new THREE.Vector3(0.15, 0, 0).applyQuaternion(qu).add(S), qu, vel);
  const fp = new THREE.Vector3(0.135, 0, 0).applyQuaternion(qf).add(elbow);
  place(f.bodies.farmS, fp, qf, vel);
  const wrist = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qf).add(fp);
  J.uarmS.prevTarget?.copy(J.uarmS.target); // 서보 목표 속도가 튀지 않게
  const D = f.aimDirW.clone().normalize();
  const qs = swordQuat(D, _qs);
  place(f.sword, wrist, qs, vel);
  // 두 손 칼: 빈팔을 빈손 IK 대로 칼자루 끝으로
  if (f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3) {
    const pommel = new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(wrist);
    f.offArmIK(pommel);
    const So = new THREE.Vector3(0, 0.1, -f.side * 0.2).applyQuaternion(_qc).add(c);
    const quo = new THREE.Quaternion().copy(_qc).multiply(J.uarmO.target);
    const qfo = new THREE.Quaternion().copy(quo).multiply(J.farmO.target);
    const eo = new THREE.Vector3(0, -0.3, 0).applyQuaternion(quo).add(So);
    place(f.bodies.uarmO, new THREE.Vector3(0, -0.15, 0).applyQuaternion(quo).add(So), quo, vel);
    place(f.bodies.farmO, new THREE.Vector3(0, -0.14, 0).applyQuaternion(qfo).add(eo), qfo, vel);
  }
  const B = new THREE.Vector3(0, f.weaponCfg.hiltLength, 0).applyQuaternion(qs).add(wrist);
  return { B, D, q: qs.clone() };
}

/** 선분 a–b 와 점 p 사이 거리 · 선분 위 가장 가까운 점 t */
function segPointT(a, b, p) {
  const u = _v3.subVectors(b, a);
  const L2 = u.lengthSq();
  const t = L2 > 1e-9 ? clamp(_v1.subVectors(p, a).dot(u) / L2, 0, 1) : 0;
  return { d: _v2.copy(a).addScaledVector(u, t).distanceTo(p), t };
}

/** 두 선분 사이 거리 (근사 — 한쪽을 9 점으로) */
function segSegApprox(a, b, c, d) {
  let best = Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 8; i++) {
    p.lerpVectors(a, b, i / 8);
    const r = segPointT(c, d, p).d;
    if (r < best) best = r;
  }
  return best;
}

/** 칼날 선분 a–b 와 콜라이더 겉 사이 거리 (공·캡슐·상자) — 음수/0 이면 겹침 */
function segToCollider(a, b, col) {
  const sh = col.shape;
  const ct = tv(col.translation(), new THREE.Vector3());
  const cq = tq(col.rotation(), new THREE.Quaternion());
  if (sh.type === 0) return segPointT(a, b, ct).d - sh.radius; // 공
  if (sh.type === 2) {
    // 캡슐: 몸 축 = 콜라이더 y
    const ax = new THREE.Vector3(0, sh.halfHeight, 0).applyQuaternion(cq);
    return segSegApprox(a, b, ct.clone().sub(ax), ct.clone().add(ax)) - sh.radius;
  }
  if (sh.type === 1) {
    // 상자: 선분 위 9 점의 상자 겉 거리 가운데 가장 작은 것
    const he = sh.halfExtents;
    const inv = cq.clone().invert();
    let best = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 8; i++) {
      p.lerpVectors(a, b, i / 8).sub(ct).applyQuaternion(inv);
      const qx = Math.abs(p.x) - he.x;
      const qy = Math.abs(p.y) - he.y;
      const qz = Math.abs(p.z) - he.z;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
      const r = out + Math.min(Math.max(qx, qy, qz), 0);
      if (r < best) best = r;
    }
    return best;
  }
  return Infinity;
}

/** 칼날 자세 둘 사이 보간 (자루 끝 B lerp, 칼날 축 D slerp) */
function lerpPose(A, Bp, t) {
  const B = new THREE.Vector3().lerpVectors(A.B, Bp.B, t);
  const q = new THREE.Quaternion().setFromUnitVectors(A.D, Bp.D);
  const D = A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, t)).normalize();
  return { B, D };
}

function runInstant(f, combat) {
  const req = f.instantReq;
  f.instantReq = null;
  const foe = f.foe;
  if (!foe || !f.alive || !f.armed || f.state !== 'stand' || !f.sword) {
    f.instantResult = { ok: false, hit: false };
    return;
  }
  const BL = f.weaponCfg.bladeLength;
  const M = f.swordArt.measure;
  // ① 내딛음
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  const step = Math.min(clamp(d - M.contact, 0, SECRET.instantStep), Math.max(0, d - M.clinch));
  if (step > 1e-3) shiftFighter(f, dx * step, dz * step);
  // 시작 칼날 (내디딘 뒤)
  const K0 = { B: f.bladePoint(0, new THREE.Vector3()), D: f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize() };
  // 上段 (머리 위, 칼끝 위·조금 뒤) — 시작이 이미 높으면 건너뜀
  tq(f.bodies.chest.rotation(), _qc);
  const c2 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const K1 = { B: new THREE.Vector3(0.15, 0.5, f.side * 0.05).applyQuaternion(_qc).add(c2), D: new THREE.Vector3(-0.35, 0.94, 0).normalize().applyQuaternion(_qc) };
  const high = K0.B.y > c2.y + 0.3;
  // ② 끝 자세
  const K2 = poseEnd(f, req.endPad);
  // 쓸린 자리 (그리기: 올림 + 내려벰 · 맞음: 내려벰 조각만 — 올리는 길은 베는 길이 아니다 [해석])
  const N = SECRET.instantSlices;
  const raise = high ? [] : Array.from({ length: 5 }, (_, i) => lerpPose(K0, K1, i / 5));
  const from = high ? K0 : K1;
  const cut = Array.from({ length: N + 1 }, (_, i) => lerpPose(from, K2, i / N));
  const tip = (P) => P.B.clone().addScaledVector(P.D, BL);
  // ③ 맞음: 조각마다 상대 몸 부위 콜라이더와 거리
  const parts = [];
  const world = f.world;
  for (const [h, info] of f.colliderInfo) {
    if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
    const col = world.getCollider(h);
    if (col) parts.push({ h, info, col });
  }
  let hit = null;
  for (let i = 1; i <= N && !hit; i++) {
    const a = cut[i].B;
    const b = tip(cut[i]);
    let best = null;
    for (const P of parts) {
      const r = segToCollider(a, b, P.col);
      if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { ...P, r };
    }
    if (best) hit = { i, best };
  }
  let res = null;
  if (hit && foe.alive && foe.state !== 'dead') res = instantWound(f, foe, cut, hit, combat);
  // ④ 충돌 끔 · ⑤ 잔상
  f.instantGhost = Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120));
  const pts = [...raise, ...cut].map((P) => {
    const t = tip(P);
    return [P.B.x, P.B.y, P.B.z, t.x, t.y, t.z];
  });
  f.instantArc = { id: (f.instantArc?.id ?? 0) + 1, pts };
  // 칼끝 추적 다시 (순간이동을 속도로 읽지 않게)
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  f.tipVel.set(0, 0, 0);
  f.hitPointVel.set(0, 0, 0);
  f.instantResult = { ok: true, hit: !!res, energy: res?.energy ?? 0, part: hit?.best.info.part ?? null, zone: res?.zone ?? null, type: res?.type ?? null, step };
}

/** 쓸린 자리의 첫 부위에 기존 상처 함수(combat.analyze → applyWound)로 상처. 에너지 = instantJ × hitMul 이 나오게 분석 속도를 고른다 */
function instantWound(f, foe, cut, hit, combat, J = SECRET.instantJ, dtSub = 0, hitMul = SECRET.hitMul, effMul = null, grip = null) {
  const { i, best } = hit;
  const P = cut[i];
  const P0 = cut[i - 1];
  const BL = f.weaponCfg.bladeLength;
  const HL = f.weaponCfg.hiltLength;
  // grip (죽음의 일격 운동학 길 — 10/22 밤): P.B = 손목 · P.D = 칼자루 쪽 · 치는 막대 = 손목 → 칼자루 끝(grip.Lp). 맞은 점의 칼 축 자리 = g − (손에서 거리) —
  //  코등이 아래(칼자루)면 칼자루 부품으로(둔타), 위(손과 코등이 사이 칼날)면 칼날 부품으로 기존 판정(combat.analyze — 날 맞춤으로 베임 · 둔타)
  const len = grip ? grip.Lp : BL;
  const a = P.B;
  const b = P.B.clone().addScaledVector(P.D, len);
  const bc = tv(best.col.translation(), new THREE.Vector3());
  const { t } = segPointT(a, b, bc);
  const point = a.clone().lerp(b, t);
  // 그 점이 쓸려 온 방향 (앞 조각의 같은 칼날 자리 → 이 조각)
  const prev = P0.B.clone().addScaledVector(P0.D, len * t);
  const tang = point.clone().sub(prev);
  const swept = tang.length(); // 그 점이 이 조각에 쓸려 온 길이 (m) — dtSub 가 있으면 빠르기 = swept / dtSub (중국 빠른 연환)
  if (tang.lengthSq() < 1e-8) tang.set(0, -1, 0);
  tang.normalize();
  let wCol = f.bladeColliders[0];
  const hy = grip ? grip.g - len * t : null; // 맞은 점의 칼 축 자리 (죽음의 일격)
  if (grip && hy < HL) {
    // 칼자루 부품 가운데 그 자리에 가장 가까운 것 (폼멜 · 손잡이 · 코등이)
    let bd = Infinity;
    for (const c of f.swordColliders ?? []) {
      if (f.colliderInfo.get(c.handle)?.part !== 'hilt') continue;
      const d = Math.abs(c.translationWrtParent().y - hy);
      if (d < bd) (bd = d), (wCol = c);
    }
  }
  const bladeInfo = f.colliderInfo.get(wCol?.handle);
  if (!bladeInfo) return null;
  if (grip && f.iai) (f.iai.wPart = bladeInfo.part), (f.iai.hy = +hy.toFixed(3)); // 재기 (판정에는 안 씀)
  const pr = { w: bladeInfo, v: best.info, wc: wCol.handle, vc: best.h };
  const yAx = grip ? P.D.clone().negate() : P.D;
  const qs = swordQuat(yAx, new THREE.Quaternion(), tang); // 날이 쓸린 방향을 향하게 (가로 발도·세로 真向 모두)
  const sp = grip ? P.B.clone().addScaledVector(P.D, grip.g) : P.B.clone().addScaledVector(P.D, -HL); // 칼 원점 (죽음의 일격: 손목 + 칼자루 쪽 × g)
  const S = { p: sp, q: qs, com: sp.clone().addScaledVector(yAx, f.swordCom ?? 0.3), v: new THREE.Vector3(), w: new THREE.Vector3() };
  const vb = best.info.body;
  const Pst = { p: tv(vb.translation(), new THREE.Vector3()), q: tq(vb.rotation(), new THREE.Quaternion()), com: tv(vb.worldCom(), new THREE.Vector3()), v: tv(vb.linvel(), new THREE.Vector3()), w: tv(vb.angvel(), new THREE.Vector3()) };
  const target = J * hitMul;
  const h0 = f.secretHit;
  f.secretHit = hitMul; // 비기 판정 배율 (진 · 츠바메가에시 되돌림 칼은 1 — 비기가 아니다)
  let r = null;
  if (dtSub > 0) {
    // 중국 빠른 연환 (10/12): 에너지를 정하지 않고 쓸린 그 점의 실제 빠르기로 분석 (기존 상처 함수 그대로 — 판정 배율 hitMul 은 아래 secretHit)
    //  격살(10/22): effMul 이 있으면 그 분석 동안만 f.effMul — combat.js analyze 가 문턱과 견주는 판정 에너지(eff)에 곱한다 (마무리 찍기 FINISH.power 와 같은 자리)
    S.v.copy(tang).multiplyScalar(swept / dtSub).add(Pst.v);
    const e0 = f.effMul;
    if (effMul) f.effMul = effMul;
    r = combat.analyze(pr, point, S, Pst);
    f.effMul = e0;
    f.secretHit = h0;
    if (!r || r.energy < STRIKE.minEnergy) return null;
    foe.hitCooldowns.set(`${f.index}:${best.info.part}`, STRIKE.hitCooldown);
    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {
      foe.applyWound({ ...r, part: best.info.part, passing: true });
      if (r.schoolK) f.schoolPassive?.onHit(r); // 유파 패시브 몫이 실린 맞음 (combat.js strike 와 같음 — 손가락 긋기를 이어 끄는 칼만 몫이 실림: 제비 베기 되돌림 칼의 켄타이 · 10/25)
    }
    combat.hooks.onWound?.(f, foe, r, point, pr);
    return r;
  }
  S.v.copy(tang).multiplyScalar(10).add(Pst.v);
  const r10 = combat.analyze(pr, point, S, Pst);
  if (r10 && r10.energy > 0) {
    const v = clamp(10 * Math.sqrt(target / r10.energy), 0.6, 29.5);
    S.v.copy(tang).multiplyScalar(v).add(Pst.v);
    r = combat.analyze(pr, point, S, Pst);
  }
  f.secretHit = h0;
  if (!r || r.energy < STRIKE.minEnergy) return null;
  foe.hitCooldowns.set(`${f.index}:${best.info.part}`, STRIKE.hitCooldown);
  if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {
    foe.applyWound({ ...r, part: best.info.part, passing: true });
    if (r.schoolK) f.schoolPassive?.onHit(r); // 유파 패시브 몫이 실린 맞음 (위 갈래와 같음 — 10/28 고노센 발도의 켄타이: 첫 상처에 씀 · 다른 비기는 몫 없음)
  }
  combat.hooks.onWound?.(f, foe, r, point, pr);
  return r;
}

// ─────────────────────────────────────────────────────────────
//  발도 (10/10 02:3x 사장님 발도술 GIF — '저 동작을 매우 빨리 할 방법은? 아니면 섬광만 날릴까? 물리를 초월해서' → 디렉터 결정 '보이는 초고속 + 섬광').
//  고노센 = 발도 (SECRET.iai 1, `?iai=0` 이면 위의 순간이동 고노센). **물리 원칙의 예외** — 이 파일 안:
//   · 팔 사슬(칼 쪽 위팔·아래팔, 두 손 칼이면 빈팔도)과 칼을 SECRET.iaiTime 초 동안 운동학 몸(kinematicPositionBased)으로 돌려
//     발도 길(왼 허리 → 상대 가슴~목 높이로 **가로** 휩쓸기 → 오른 앞으로 다 뻗은 따라 베기 끝)을 그대로 따라 움직인다.
//     길은 몸(가슴 자리 · 시작 때 몸 방향 yaw) 기준 손 자리 + 칼날 방향(가로 각) 열쇠 셋, 팔은 그 손 자리로 armIK — 관절 기준점이 맞다.
//   · 그동안 몸 전체가 앞으로 미끄러진다(순간 베기와 같은 한도 — 최대 instantStep, 맞닿기에서 멈춤, clinch 안 금지).
//   · 맞음은 쓸린 자리(스텝마다 칼날 선분 + 그 사이 조각)로, 상처는 instantWound(에너지 instantJ × hitMul). 운동학 칼·팔 ↔ 상대 몸·칼 충돌은 끈다(instantGhost).
//   · 끝나면 dynamic 으로 되돌리고(속도 = 가슴, 각속도 0) 경직 동안 덧씌우기 칸(skill.thrustPose)으로 따라 베기 끝 자세를 붙잡는다(앞으로 뻗은 채 굳음).
//   · 잔상: f.instantArc(kind 'iai')를 sword_trail.js 가 청백색 초승달 + 0.08 s 흰 섬광 선으로 그리고 main.js 가 화면을 아주 짧게 번쩍인다.
//  대기 자세(10/10 02:4x 사장님 수정): 일본 AI 가 상대 간격 밖에 SECRET.iaiArmTime 초 머물면(10/25 22:3x 부터 거리와 상관없이 침착하게 — secret.js gnsArmTick) 웅크린 발도 대기(iaiReadyPose — 덧씌우기 칸)로 들어가고,
//   고노센은 그 자세에서만 나간다(secret.js IaiArm · cond.armed). 플레이어는 자세를 바꾸지 않고 '고노센 준비' 표시만.
// ─────────────────────────────────────────────────────────────
const D2R = Math.PI / 180;
const ARM_PARTS = ['uarmS', 'farmS'];
const OFF_PARTS = ['uarmO', 'farmO'];

/** 발도를 걸어 둔다 (다음 combat.afterStep 이 시작). opt.player: 플레이어(지금 손에서 왼 허리를 거쳐 — 전체 iaiPlayerTime) ·
 *  opt.block: 막힐 수 있는 발도 — 칼이 몸보다 먼저 상대 칼에 닿으면 막힘(이베리아 휩쓸기 · 연환과 같은 거리 iberianBlockDist · 밀어냄 없음). 고노센 B(SECRET.gnsEnterBlock — 천천히 걸어 든 들어옴 창에서 낸 것만 · 10/25) ·
 *  'cover' = 그에 더해 상대 칼끝이 내 몸을 겨누고 있었음(낼 때 — secret.js foeOnline) — 몸에 닿는 그 자리에서 그 칼에 막힘 (SECRET.gnsEnterBlock 2 · 10/25 16:0x 시험) */
export function requestIai(f, opt = {}) {
  f.iaiReq = { player: !!opt.player, block: opt.block === 'cover' ? 'cover' : !!opt.block };
  f.instantResult = null;
}

/** 몸 기준(가슴 원점 · yaw 틀: x 앞, y 위, z 칼 든 쪽) 칼날 방향: 가로 각 yaw(°, 앞 0 → 칼 든 쪽 +), 높이 각 el(°) */
function dirOf(yawDeg, elDeg, out = new THREE.Vector3()) {
  const a = yawDeg * D2R;
  const e = elDeg * D2R;
  return out.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
}

/** 발도 길의 u(0~1) 자리: 손 H·칼날 D (몸 기준) */
function iaiPose(I, u) {
  const K = I.K ?? SECRET.iaiPath; // I.K: 이 발도의 길 (SECRET.iaiRise 면 올려베기 길 iaiPathRise — startIai). 없으면 가로 길 (연환 빠르기 기준 iaiTipSpeed 는 늘 가로 길)
  if (u < I.ab) {
    const v = u / I.ab;
    const H = I.A.H.clone().lerp(new THREE.Vector3(...K.B.hand), v);
    const q = new THREE.Quaternion().setFromUnitVectors(I.A.D, I.DB);
    const D = I.A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, v)).normalize();
    return { H, D };
  }
  const v = I.ab < 1 ? (u - I.ab) / (1 - I.ab) : 1;
  const [P, Q, w] = v < 0.5 ? [K.B, K.M, v / 0.5] : [K.M, K.E, (v - 0.5) / 0.5];
  const k = w * w * (3 - 2 * w) * 0.5 + w * 0.5; // 반쯤 부드럽게 (이음새에서 멈추지 않게)
  const H = new THREE.Vector3(...P.hand).lerp(new THREE.Vector3(...Q.hand), k);
  const D = dirOf(P.yaw + (Q.yaw - P.yaw) * k, P.el + (Q.el - P.el) * k);
  return { H, D };
}

/**
 * 고노센 팔 뻗음 (10/12 사장님 03:1x '고노센도 관절 비기 풀어' — SECRET.secretReach): 발도 길의 손 자리(iaiPath M·E)는 어깨에서 팔 길이의 0.83~0.92 라
 *  팔꿈치가 36° 안팎 굽은 채 휩쓸었다(tools/sim/secret_reach.mjs). 베는 몫에서 손 자리를 어깨 → 손 방향으로 팔 길이(위팔 + 아래팔 — 팔꿈치 곧게)까지 밀어낸다:
 *  왼 허리에서 뽑는 자리(B)는 그대로(0) → 가운데(M)에서 다 뻗음(1) → 끝(E)까지 다 뻗음. 어깨 = 지금 가슴의 칼 어깨 자리(발도 몸 틀). 방향·칼날·시간은 그대로 (새 값 없음)
 */
function iaiReach(f, I, P, u) {
  if (!SECRET.secretReach || u < I.ab) return P;
  const v = I.ab < 1 ? (u - I.ab) / (1 - I.ab) : 1;
  const x = Math.min(1, v / 0.5); // B → M 사이 몫 (iaiPose 의 가운데 이음새 v 0.5)
  const w = x * x * (3 - 2 * x);
  const chest = f.bodies.chest;
  const c = chest.translation();
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(tq(chest.rotation(), new THREE.Quaternion())).add(tv(c, new THREE.Vector3())).sub(tv(c, new THREE.Vector3())).applyQuaternion(I.yaw.clone().invert());
  const r = P.H.clone().sub(S);
  const d = r.length();
  const Lf = ARM.upper + ARM.fore;
  if (d < 1e-6 || d >= Lf) return P;
  return { H: S.add(r.multiplyScalar((d + w * (Lf - d)) / d)), D: P.D };
}

/** 휩쓸기 동안 손목 원뿔·칼 어깨 면 밧줄을 잠깐 뗀다 (머리 위 고리는 그 한도를 넘는 자리를 지나 — 밧줄이 매 스텝 팔·가슴을 잡아채 몸이 50° 넘게 기울었다). 끝나면 다시 건다
 *  (풍차 베기 감기도 같은 까닭으로 뗀다 — iberian_redondo.js windStart · windEnd · 10/29 20:0x 휘청 고침) */
export function armRopes(f, on) {
  return ropes(f, on);
}
function ropes(f, on) {
  if (!on) {
    if (f.gripCone) for (const j of f.gripCone) f.world.removeImpulseJoint(j, true);
    f.gripCone = null;
    if (f.shoulderRopes) for (const j of f.shoulderRopes) f.world.removeImpulseJoint(j, true);
    f.shoulderRopes = null;
    return;
  }
  if (f.armed && f.weaponCfg.hiltLength && !f.gripCone) f.gripConeOn();
  if (!f.shoulderRopes && f.bodies.uarmS && f.jointByName.uarmS) f.shoulderOn();
}

function setKinematic(f, on) {
  if (!SECRET.iaiKinematic) return;
  const R = f.R;
  const parts = [...ARM_PARTS, ...(f.iai?.off ? OFF_PARTS : [])];
  for (const n of parts) f.bodies[n]?.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
  f.sword.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
}

/** 굴림 묶음 (placeIai rollCap): 칼 면 z(zS)를 칼 축(Dw) 둘레로 아래팔 z(zF) 쪽에 돌려 zF · zS ≥ lim 이 되는 가장 작은 돌림 각(rad · 부호 = Dw 둘레 오른손) — 이미 안이면 0,
 *  끝까지 돌려도 못 닿으면 가장 가까워지는 돌림 (반으로 나눠 찾기 14 번 · 새 수 없음) */
function rollToCap(zF, zS, Dw, lim) {
  if (zF.dot(zS) >= lim) return 0;
  const w = new THREE.Vector3().crossVectors(Dw, zS); // 칼 면 z 를 칼 축 둘레로 +90°
  const full = Math.atan2(zF.dot(w), zF.dot(zS)); // 아래팔 z 에 가장 가까워지는 돌림
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const t = (lo + hi) / 2;
    if (zF.dot(zS) * Math.cos(full * t) + zF.dot(w) * Math.sin(full * t) >= lim) hi = t;
    else lo = t;
  }
  return full * hi;
}
const _wz = new THREE.Vector3(); // placeIai 손목 교정 (칼 면 · 날)
const _wx = new THREE.Vector3();
/**
 * 손 자리 H·칼날 D(몸 기준)에 칼이 놓일 자세를 셈한다 (placeIai 의 셈 — 팔 IK · 칼 면 · 굴림 묶음 · 손목 교정). 팔 관절 목표(armIK)를 쓰고 몸은 놓지 않는다.
 *  { M, Dw(교정 뒤 칼날 — 월드), up, fp, wrist, qu, qf, qs, fix(손목 교정 각) }
 */
function iaiSolve(f, H, D, turn = 0, edgeHint = null, rollCap = false, I = f.iai) {
  const J = f.jointByName;
  const chest = f.bodies.chest;
  const qc = tq(chest.rotation(), new THREE.Quaternion());
  const c = tv(chest.translation(), new THREE.Vector3());
  const yaw = I.yaw;
  const target = H.clone().applyQuaternion(yaw).add(c);
  const M = I.mord; // 죽음의 일격 (10/22 밤 — 운동학 길): D = 칼자루 쪽 · 칼 축(+y) = −D · 칼 원점 = 손목 + D × g (거꾸로 쥔 자리 g 가 손목에) · 날은 휘두르는 면 안(몸 옆 축 × 칼 축)
  const Dw = D.clone().applyQuaternion(yaw).normalize();
  if (!M) (f.aimRawW ||= new THREE.Vector3()).copy(Dw); // 팔꿈치 돌림(armIK)이 이 칼날을 읽는다 (교정 전)
  const planeMove = !M && I.kind === 'combo' && !!I.moves?.[I.mi]?.plane; // 칼끝 돌려 빼기 (10/28): 아래팔을 칼 줄에 맞추는 팔꿈치 · 아래 손 면 찾기
  f.armIK(target, planeMove ? Dw : null);
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const qu = qc.clone().multiply(J.uarmS.target);
  const qf = qu.clone().multiply(J.farmS.target);
  const elbow = new THREE.Vector3(0.3, 0, 0).applyQuaternion(qu).add(S);
  const up = new THREE.Vector3(0.15, 0, 0).applyQuaternion(qu).add(S);
  const fp = new THREE.Vector3(0.135, 0, 0).applyQuaternion(qf).add(elbow);
  const wrist = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qf).add(fp);
  const yAx = M ? Dw.clone().negate() : Dw;
  // 날: 가로로 칼 든 쪽으로 쓸린다 → 날 = D × 위 · edgeHint(제비 베기 되돌림 칼 — 10/25)가 있으면 칼이 가는 쪽(날 세우기 — 날이 앞장섬, instantWound 와 같은 뜻)
  const edge = M ? new THREE.Vector3(0, 0, 1).applyQuaternion(yaw).cross(yAx) : edgeHint ? edgeHint.clone().addScaledVector(Dw, -edgeHint.dot(Dw)) : new THREE.Vector3().crossVectors(Dw, new THREE.Vector3(0, 1, 0));
  if (turn && !M) edge.applyAxisAngle(Dw, f.side * turn); // 길 덧칸 손 돌리기 (제비 베기 되돌림 칼 — 10/25): 칼 면을 칼 축 둘레로 (칼 든 쪽 + = 엎침 · fighter.js driveSword techPlan.turn 과 같은 식)
  const qs = swordQuat(yAx, new THREE.Quaternion(), edge.lengthSq() > 1e-6 ? edge.normalize() : null);
  // 굴림 묶음 (rollCap — 제비 베기 되돌림 칼 몸통 띠 판 · 10/25 23:1x): 운동학 칼은 손목 밧줄(HUMAN.forearmRoll — 아래팔 z ↔ 칼 면 z 각)이 못 막으므로
  //  놓을 아래팔(qf)과 칼 면이 그 한도 밖이면 칼 면을 칼 축 둘레로 아래팔 쪽에 한도까지만 돌린다(가장 작은 돌림 · 칼끝 · 손 자리 그대로 · 새 수 없음 — rollToCap)
  if (rollCap && !M && f.rollMax) {
    const lim = Math.cos(f.rollMax() * D2R);
    const zF = new THREE.Vector3(0, 0, 1).applyQuaternion(qf);
    const zS = new THREE.Vector3(0, 0, 1).applyQuaternion(qs);
    let rot = rollToCap(zF, zS, Dw, lim);
    //  날 세우기 두 쪽(날 = 칼끝이 가는 쪽 · 그 반대 = 등 — 칼 면을 칼 축 둘레로 180°: 칼 줄 · 칼끝 그대로 · 판정의 날 맞춤 |cos| 같음): 묶은 뒤에도 날 쪽이 판정 문턱
    //   (STRIKE.edgeAlign) 안에서 앞장서면 날 쪽(외날 打刀가 등으로 베지 않게), 아니면 덜 돈 쪽(driveSword rollSide 의 양날 규칙과 같음) —
    //   전엔 늘 날 쪽이라 낮게 지나는 올려 긋기에서 칼 면이 손에 대해 164° 돌았다(사람 밖 · 손목 교정이 손 면 각을 잃어 칼 줄이 스텝마다 튐)
    if (edgeHint && Math.cos(rot) < STRIKE.edgeAlign && !I.moves?.[I.mi]?.edge) { // 겹치기(edge 칸)는 고른 날 그대로
      const zB = zS.clone().negate();
      const rotB = rollToCap(zF, zB, Dw, lim);
      if (Math.abs(rotB) < Math.abs(rot)) {
        edge.negate();
        rot = rotB;
      }
    }
    if (rot) edge.applyAxisAngle(Dw, rot);
    swordQuat(yAx, qs, edge.normalize());
  }
  // 손 면 찾기 (칼끝 돌려 빼기 — 10/28 · 수의 plane 칸): 칼 줄(찌르는 줄)은 그대로 두고 칼 면만 칼 축 둘레로 돌려 손목(굽힘 · 폄 · 손 면 안 치우침 · 아래팔 굴림)이
  //  사람 범위 안이 되는 면 가운데 지금 면에 가장 가까운 것 (fighter.js wristPlane — 높은 자세의 엎친 손 길 JOINTS.wristPronate · 탭 찌르기와 같은 풀이 · 새 수 없음). 그런 면이 없으면 위 굴림 묶음 그대로
  if (planeMove && f.wristPlane) {
    const fx = new THREE.Vector3(1, 0, 0).applyQuaternion(qf);
    const zF = new THREE.Vector3(0, 0, 1).applyQuaternion(qf);
    const n = f.wristPlane(fx, zF, Dw, new THREE.Vector3(0, 0, 1).applyQuaternion(qs), new THREE.Vector3());
    if (n) swordQuat(yAx, qs, new THREE.Vector3().crossVectors(Dw, n));
    I.planeMiss = (I.planeMiss ?? 0) + (n ? 0 : 1); // 재기 (판정에는 안 씀)
  }
  // 비정상 손목 교정 (JOINTS.wristGuard — driveSword 와 같은 wristClamp): 놓을 아래팔(qf)과 칼날이 사람 손목 범위 밖이면 칼날을 칼 면 안에서 범위 끝으로. 손 자리 · 팔 · 칼 면 그대로
  //  겨눈 찌름(comboPlanAim thrust · SECRET.thrustArm — 런지 · 격살 허파 찌르기)은 칼이 어깨 → 겨눈 곳 줄 위라 건드리지 않는다: 칼끝을 줄에서 비키면 찌름이 베기가 된다(탭 찌르기와 같은 원칙 — 손목은 팔이 맡음)
  const thrustSeg = SECRET.thrustArm && I.kind === 'combo' && I.moves?.[I.mi]?.dyn?.thrust;
  const fix = JOINTS.wristGuard && !M && !thrustSeg ? f.wristClamp(new THREE.Vector3(1, 0, 0).applyQuaternion(qf), Dw, _wz.set(0, 0, 1).applyQuaternion(qs), I.wristMargin ?? 0) : 0; // fighter.js wristClamp (몸의 메서드로 — 이 모듈이 fighter.js 를 부르면 모듈 차례가 꼬인다)
  if (fix) swordQuat(Dw, qs, _wx.crossVectors(Dw, _wz));
  return { M, Dw, up, fp, wrist, qu, qf, qs, fix };
}

/**
 * 풍차 베기 감기 (B4 이베리아 특수 공격 — 사장님 10/29 · iberian_redondo.js windStep): 손 자리 H · 칼날 D(몸 틀 I.yaw — 가슴 원점)에 팔 · 칼(· 빈팔)을 놓는다 —
 *  아래 placeIai 그대로(팔 IK · 굴림 묶음 · 손목 교정 · 날 = edgeHint 쪽 · 빠르기 = 가슴 · 덧씌우기 칸도 같은 자세 · 몸 비틀기 = I.body). I = { yaw, off, body } (끌고 가는 칼 f.iai 가 아님). 칼날 선분 { B, D, tip }
 */
export function placeArmsAt(f, I, H, D, edgeHint = null) {
  return placeIai(f, H, D, false, 0, edgeHint, true, I);
}
/** 손 자리 H·칼날 D(몸 기준)로 팔·칼(·빈팔)을 놓는다 — now: 지금 자리로(첫 스텝), 아니면 다음 스텝 운동학 목표. 칼날 선분 { B, D, tip } (월드) */
function placeIai(f, H, D, now, turn = 0, edgeHint = null, rollCap = false, I = f.iai) {
  const J = f.jointByName;
  const chest = f.bodies.chest;
  const qc = tq(chest.rotation(), new THREE.Quaternion());
  const c = tv(chest.translation(), new THREE.Vector3());
  const yaw = I.yaw;
  const { M, Dw, up, fp, wrist, qu, qf, qs, fix } = iaiSolve(f, H, D, turn, edgeHint, rollCap, I);
  // 서보 목표도 같은 자세로 (덧씌우기 칸 = 이 손 자리·칼날): 팔 근육이 다른 자리로 당기며 가슴을 비틀어 넘어뜨리지 않게
  const th = f.skill.thrustPose;
  const Hy = H.clone().applyQuaternion(yaw).applyQuaternion(f.yaw.clone().invert());
  const Dy = D.clone().applyQuaternion(yaw).applyQuaternion(f.yaw.clone().invert());
  th.w = 1;
  th.hand[0] = Hy.x;
  th.hand[1] = Hy.y;
  th.hand[2] = Hy.z;
  th.dir[0] = Dy.x;
  th.dir[1] = Dy.y;
  th.dir[2] = Dy.z;
  const EB = I.bodyAt ? I.bodyAt(I.u ?? 0) : I.body; // 휩쓸기: 몸 비틀기가 길을 따라 (감기 → 돌리기)
  th.pelvisYaw = EB.pelvisYaw * D2R;
  th.chestYaw = EB.chestYaw * D2R;
  th.pitch = EB.pitch * D2R;
  th.drop = EB.drop;
  f.wristFixDeg = fix;
  const kin = SECRET.iaiKinematic;
  const cv = chest.linvel();
  const put = (b, p, q) => {
    if (now || !kin) {
      b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    }
    if (kin) {
      b.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      b.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    } else {
      b.setLinvel({ x: cv.x, y: cv.y, z: cv.z }, true); // 동역학 몸 그대로 스텝마다 자리를 정한다 (속도 = 가슴 — 다음 스텝이 자리를 흩뜨리지 않게)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  };
  put(f.bodies.uarmS, up, qu);
  put(f.bodies.farmS, fp, qf);
  put(f.sword, M ? wrist.clone().addScaledVector(Dw, M.g) : wrist, qs);
  if (I.off) {
    const pommel = M ? wrist.clone().addScaledVector(Dw, M.g - M.gOff) : new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(wrist); // 죽음의 일격: 빈손 = 칼 축 gOff
    f.offArmIK(pommel);
    const So = new THREE.Vector3(0, 0.1, -f.side * 0.2).applyQuaternion(qc).add(c);
    const quo = qc.clone().multiply(J.uarmO.target);
    const qfo = quo.clone().multiply(J.farmO.target);
    const eo = new THREE.Vector3(0, -0.3, 0).applyQuaternion(quo).add(So);
    put(f.bodies.uarmO, new THREE.Vector3(0, -0.15, 0).applyQuaternion(quo).add(So), quo);
    put(f.bodies.farmO, new THREE.Vector3(0, -0.14, 0).applyQuaternion(qfo).add(eo), qfo);
  }
  if (M) return { B: wrist.clone(), D: Dw, tip: wrist.clone().addScaledVector(Dw, M.Lp) }; // 죽음의 일격: 치는 막대 = 손목 → 칼자루 끝
  const B = new THREE.Vector3(0, f.weaponCfg.hiltLength, 0).applyQuaternion(qs).add(wrist);
  return { B, D: Dw, tip: B.clone().addScaledVector(Dw, f.weaponCfg.bladeLength) };
}

function startIai(f, combat) {
  const req = f.iaiReq;
  f.iaiReq = null;
  const foe = f.foe;
  if (!foe || !f.alive || !f.armed || f.state !== 'stand' || !f.sword || f.iai) {
    f.instantResult = { ok: false, hit: false };
    return;
  }
  if (req.sweep) return startSweep(f, combat, req);
  if (req.combo) return startCombo(f, combat, req);
  const M = f.swordArt.measure;
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  const slide = Math.min(clamp(d - M.contact, 0, SECRET.iaiStep), Math.max(0, d - M.clinch));
  const yaw = f.yaw.clone();
  const inv = yaw.clone().invert();
  // 지금 손(손목)·칼날 (몸 기준)
  const sw = tv(f.sword.translation(), new THREE.Vector3());
  const AH = sw.clone().sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  const K = SECRET.iaiPath;
  const DB = dirOf(K.B.yaw, K.B.el);
  const far = AH.distanceTo(new THREE.Vector3(...K.B.hand)) > 0.12 || AD.angleTo(DB) > 0.6;
  const T = req.player || far ? SECRET.iaiPlayerTime : SECRET.iaiTime; // 대기 자세(손이 왼 허리)면 곧장 가로, 아니면 왼 허리를 거쳐
  // 10/12 03:2x 사장님 '기술길이 좀 더 상승하게 … 사선 올려베기처럼' · '한 팔 완전히 쭉 뻗어서 써야 맞는 거 아냐?' (SECRET.iaiRise): 길 = 올려베기 iaiPathRise ·
  //  한 손 = 칼 쪽 손만 쥐고 빈손은 칼을 놓고 배 앞으로(10/14 — 전 왼 허리 뒤 鞘引き · fighter.js applyPose 가 iai.oneHand 를 읽어 빈팔을 SECRET.iaiSayaHand 로 · offHand 쥐기 쉼).
  //  틀이 무거운 칼(frame 'heavy' — 모노호시자오)은 한 손이 무리라 두 손 그대로 (무기 표에 이미 있는 틀 값을 읽음 — 새 규칙 없음). 다시 쥐기는 발도 뒤(경직 붙잡기) — iai 가 끝나면 offHand 가 다시 쥔다
  const rise = !!SECRET.iaiRise;
  const oneHand = rise && !!f.weaponCfg.twoHand && f.weapon?.frame !== 'heavy';
  f.iai = { kind: 'iai', K: rise ? SECRET.iaiPathRise : SECRET.iaiPath, oneHand, J: SECRET.instantJ, body: SECRET.iaiPath.E.body, hold: SECRET.stiff.japanese, pose: (I, u) => iaiReach(f, I, iaiPose(I, u), u), t: 0, T, ab: far ? SECRET.iaiDrawShare : 0, A: { H: AH, D: AD }, DB, yaw, slide, dx, dz, off: !oneHand && !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hit: null, res: null, arc: null };
  if (req.block) f.iai.block = true; // 고노센 B (SECRET.gnsEnterBlock — 천천히 걸어 든 들어옴 창에서 낸 발도): 몸보다 먼저 상대 칼에 닿으면 막힘 (아래 stepIai — 밀어냄은 휩쓸기만)
  if (req.block === 'cover') f.iai.cover = true; // gnsEnterBlock 2: 칼끝이 내 몸을 겨눈 채 천천히 든 상대 — 몸에 닿는 자리에서 막힘
  setKinematic(f, true);
  if (f.gait?.active && SECRET.iaiDrawStep > 0) f.gait.requestStep({ kind: 'lunge', fwd: SECRET.iaiDrawStep, duration: 0.3 }); // 발도 순간 앞발을 크게 (10/10 04:2x)
  f.instantGhost = Math.ceil((T + SECRET.instantNoCollide) / (combat.dt || 1 / 120)) + 1;
  const P0 = f.iai.pose(f.iai, 0);
  f.iai.prev = placeIai(f, P0.H, P0.D, true);
}

function stepIai(f, combat) {
  const I = f.iai;
  const dt = combat.dt || 1 / 120;
  const foe = f.foe;
  if (!f.alive || !f.armed || !foe) return endIai(f, combat);
  // 몸 미끄러짐: 칼이 가운데를 지나기 전(SECRET.iaiSlideShare 몫 안)에 다 내딛는다 (부드럽게 줄며)
  const pr = (t) => {
    const x = Math.min(1, t / (I.T * (I.slideShare ?? SECRET.iaiSlideShare)));
    return 1 - (1 - x) * (1 - x);
  };
  const ds = I.slide * (pr(I.t + dt * f.stamina.attackSpeed) - pr(I.t));
  if (ds > 1e-5) shiftFighter(f, I.dx * ds, I.dz * ds);
  I.t += dt * f.stamina.attackSpeed;
  const u = Math.min(1, I.t / I.T);
  I.u = u;
  const P = I.pose(I, u);
  const cur = placeIai(f, P.H, P.D, false);
  // 베는 몫(u ≥ ab): 잔상 점·쓸린 자리 맞음
  if (u >= I.ab) {
    if (!I.arc) {
      I.arc = { id: (f.instantArc?.id ?? 0) + 1, kind: I.kind, pts: [], side: I.sideW ?? null };
      f.instantArc = I.arc;
    }
    const subs = 3;
    for (let k = 1; k <= subs; k++) {
      const w = k / subs;
      const B = I.prev.B.clone().lerp(cur.B, w);
      const D = I.prev.D.clone().lerp(cur.D, w).normalize();
      const tip = B.clone().addScaledVector(D, f.weaponCfg.bladeLength);
      I.arc.pts.push([B.x, B.y, B.z, tip.x, tip.y, tip.z]);
      // 이베리아 휩쓸기: 몸보다 먼저 상대 칼에 닿으면 막힘 — 맞음 판정을 멈추고 상대를 밀어낸다 (sweepShove), 칼은 그 자리에서 멈춤
      if (I.block && !I.hit && !I.blocked && foe.armed && foe.sword && segSegApprox(B, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) < SECRET.iberianBlockDist) {
        I.blocked = true;
        I.uEnd = Math.max(I.ab, u - (1 - w) * (dt / I.T));
        if (I.kind === 'sweep') sweepShove(f, foe); // 발도(고노센 여쭘 B)는 막힌 자리에서 멈추기만 — 연환 · 격살 · 런지 막힘과 같음
      }
      if (!I.hit && !I.blocked && foe.alive && foe.state !== 'dead') {
        let best = null;
        for (const [h, info] of f.colliderInfo) {
          if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
          const col = f.world.getCollider(h);
          if (!col) continue;
          const r = segToCollider(B, tip, col);
          if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { h, info, col, r };
        }
        if (best && I.cover) {
          I.blocked = true; // gnsEnterBlock 2 (10/25 16:0x 시험): 가운데를 겨눈 칼이 앞을 가림 — 상처 없이 이 자리에서 멈춤 · 굳음 그대로
          I.uEnd = Math.max(I.ab, u - (1 - w) * (dt / I.T));
        } else if (best) {
          const prevW = Math.max(0, w - 1 / subs);
          const P0 = { B: I.prev.B.clone().lerp(cur.B, prevW), D: I.prev.D.clone().lerp(cur.D, prevW).normalize() };
          I.hit = best;
          I.res = instantWound(f, foe, [P0, { B, D }], { i: 1, best }, combat, I.J);
        }
      }
    }
  }
  I.prev = cur;
  if (u >= 1 || I.blocked) endIai(f, combat);
}

function endIai(f, combat) {
  const I = f.iai;
  setKinematic(f, false);
  if (f.iaiRopes) {
    // 뗀 밧줄을 다시 (있던 것만)
    if (f.iaiRopes.grip && f.armed && !f.gripCone) f.gripConeOn();
    if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
    f.iaiRopes = null;
  }
  const v = tv(f.bodies.chest.linvel(), new THREE.Vector3());
  for (const n of [...ARM_PARTS, ...(I.off ? OFF_PARTS : []), null]) {
    const b = n ? f.bodies[n] : f.sword;
    if (!b) continue;
    b.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  // 따라 베기 끝 자세를 경직 동안 붙잡는다 (앞으로 뻗은 채 굳음)
  const uE = I.uEnd ?? 1; // 막힌 휩쓸기는 막힌 자리에서 굳는다
  const K = { body: I.bodyAt ? I.bodyAt(uE) : I.body };
  const E = I.pose(I, uE);
  const th = f.skill.thrustPose;
  th.w = 1;
  th.hand[0] = E.H.x;
  th.hand[1] = E.H.y;
  th.hand[2] = E.H.z;
  th.dir[0] = E.D.x;
  th.dir[1] = E.D.y;
  th.dir[2] = E.D.z;
  th.pelvisYaw = K.body.pelvisYaw * D2R;
  th.chestYaw = K.body.chestYaw * D2R;
  th.pitch = K.body.pitch * D2R;
  th.drop = K.body.drop;
  f.iaiHoldT = I.hold;
  f.iaiHoldKind = I.kind;
  f.iaiFade = 0;
  // 10/12 08:2x 사장님 '공격 후 경직 자세에서 바로 왼손이 따라 잡으니까 한 손으로 팔을 쭉 벌려서 비기를 쓴 당위성이 사라져': 한 손 발도면 경직(붙잡기) 동안도
  //  오른팔 한 손으로 뻗은 끝 자세를 두고 빈손은 배 앞(iaiSayaHand)에 남긴다(잔심). 붙잡기가 풀리며(iaiFade) 칼이 가운데로 돌아온 뒤 빈손이 다시 쥔다 (holdIai)
  f.iaiOneHold = !!I.oneHand;
  f.instantGhost = Math.max(f.instantGhost ?? 0, Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120)));
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  f.tipVel.set(0, 0, 0);
  f.hitPointVel.set(0, 0, 0);
  const res = I.res;
  f.instantResult = { ok: true, hit: !!res, energy: res?.energy ?? 0, part: I.hit?.info.part ?? null, zone: res?.zone ?? null, type: res?.type ?? null, step: I.slide, iai: I.kind, blocked: !!I.blocked };
  f.iai = null;
}

/** 경직 동안 끝 자세 붙잡기 → 끝나면 0.2 s 에 풀기 */
function holdIai(f, dt) {
  const th = f.skill.thrustPose;
  if (f.iaiHoldT > 0) {
    f.iaiHoldT -= dt;
    th.w = 1;
    if (f.iaiHoldT <= 0) f.iaiFade = 0.2;
    if (!f.alive || f.state !== 'stand') {
      f.iaiHoldT = 0;
      f.iaiFade = 0.01;
    }
    return;
  }
  f.iaiFade -= dt;
  th.w = Math.max(0, f.iaiFade / 0.2);
  if (f.iaiFade <= 0) {
    f.iaiFade = 0;
    th.w = 0;
    f.iaiOneHold = false; // 한 손 발도 잔심 끝: 칼이 가운데로 돌아왔다 → 빈손이 다시 쥔다 (fighter.js offHand)
  }
}

/** 발도 중이거나 끝 자세를 붙잡는 중인가 (대기 자세·다른 덧씌우기가 칸을 건드리지 않게) */
export function iaiBusy(f) {
  return !!f.iai || !!f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0;
}

/** 발도 대기 자세 (AI 일본, 대기 IaiArm 이 찼을 때): 덧씌우기 칸에 웅크린 왼 허리 자세를 on 이면 0.35 s 에 켜고, 아니면 0.12 s 에 끈다 */
export function iaiReadyPose(f, on, dt) {
  if (iaiBusy(f)) {
    f.iaiReadyW = 0;
    return;
  }
  const w0 = f.iaiReadyW ?? 0;
  if (!on && w0 <= 0) return;
  // 대기에 들어가는 순간 앞발을 내딛어 발을 넓게 (GIF 첫 장면 — 10/10 04:2x)
  if (on && w0 <= 0 && f.gait?.active && SECRET.stance.iai.step > 0) f.gait.requestStep({ kind: 'lunge', fwd: SECRET.stance.iai.step, duration: 0.35 });
  const w = on ? Math.min(1, w0 + dt / 0.35) : Math.max(0, w0 - dt / 0.12);
  f.iaiReadyW = w;
  const R = SECRET.iaiReady;
  const th = f.skill.thrustPose;
  th.w = w;
  th.hand[0] = R.hand[0];
  th.hand[1] = R.hand[1];
  th.hand[2] = R.hand[2];
  const D = dirOf(R.yaw, R.el);
  th.dir[0] = D.x;
  th.dir[1] = D.y;
  th.dir[2] = D.z;
  th.pelvisYaw = R.body.pelvisYaw * D2R;
  th.chestYaw = R.body.chestYaw * D2R;
  th.pitch = R.body.pitch * D2R;
  th.drop = R.body.drop;
}

/**
 * 사람 고노센 준비 웅크림 (10/25 23:0x 사장님 '플레이어도 고노센 준비가 되면 웅크리게 해.' — SECRET.gnsCrouch · AI iaiReadyPose 와 같은 자세 SECRET.iaiReady · 비기 자세 stance.iai):
 *  on = 준비됨(PlayerSecretWatch iaiArm.armed) · handFree = 사람이 칼을 쥐고 있음(손가락 움직임 inputActive · 막기 단추 · 휘두름).
 *  ① 몸 웅크림 = f.iaiReadyW(stanceTick 의 골반 낮춤 · 몸통 숙임 — AI 와 같은 칸): 켜짐 0.35 s(AI 와 같음) · 풀림 SECRET.gnsCrouchOut 초(시간 사다리 — 공격 · 막기 · 맞음 · 비기로 준비가 풀릴 때).
 *   준비된 채 걸어도 그대로(AI 도 웅크린 채 걷는다).
 *  ② 손 · 칼 · 몸 비틂(왼 허리 발도 대기 — 덧씌우기 칸 thrustPose)은 손이 쉴 때만: 칼을 쥐면 곧장 0(입력을 잠그지 않음 — 손가락이 칼을 그대로 끔) · 놓으면 0.35 s 에 다시.
 *   그래서 손을 쉬고 기다리다 낸 발도는 그 자세(왼 허리)에서 나간다(requestIai player 길 — 지금 손 → 왼 허리 → 가로, iaiPlayerTime 그대로).
 *  ③ 탭 · 손잡이 찍기 · 비기 · 약한 자세 간격 맞추기가 덧씌우기 칸을 쓰는 동안은 칸을 건드리지 않음(그 동작이 칸을 가짐) · 발도 중이면 0(AI 와 같음).
 *  AI 와 다른 것: 들어갈 때 앞발 내딛기(stance.iai.step)는 안 함 — 사람 발은 스틱만 움직임(2 s 서 있다가 몸이 저절로 상대 쪽으로 나가지 않게).
 *  standing (10/31 사장님 08:xx '웅크리기를 없앴더니 고노센 발동창이 안열려.' — SECRET.gnsReadyHip · 웅크림 gnsCrouch 0 일 때): ① 몸 웅크림 없음(iaiReadyW 0 — stanceTick · AI crouchLow 그대로 쉼) ·
 *   ② 손 · 칼 · 몸 비틂만 위와 같이(왼 허리 발도 대기 · 몸 숙임 · 낮춤 0) — 준비가 칼 자리로 보이고, 칼끝이 상대를 안 겨눠 상대에게 빈틈으로 보임(웅크림 판과 같음).
 *   웅크림 판의 몸은 숙인 가슴이 상대 쪽으로 0.2 m · 그 자세로 0.5 m 남짓 저절로 다가가 발도가 낮게 나갔다(docs/strike/gonosen_window_2026-10-31.md) — 선 채 판은 그 둘이 없음
 */
/** 사람 발도 대기의 자세 이름 (① 자세 칸 — main.js updateGuardName · 10/31 13:xx 사장님 '1-2번 다 고쳐' — 확인표 3201): 칼이 왼 허리 발도 대기에 있는 동안(손 몫 iaiHandW > 0.5) '가운데 겨눔' 대신.
 *  이름은 이 저장소가 이 자세를 부르는 말(AI 발도 대기 · iaiReadyPose — 원어 쪽 출처 없음 · 사장님 확인 전) · 칼을 쥐면 손 몫이 곧장 0 이라 보통 자세 이름으로 돌아감 */
export const IAI_READY_STANCE = Object.freeze({ name: '발도 대기', desc: '왼 허리에서 뽑을 때를 기다린다' });
/** 사람 칼이 지금 발도 대기 자리에 있나 (손 덧씌우기 몫 — 웅크림 판 · 허리 대기 판 같음 · 발도 중 · 다른 덧씌우기 동작 중이면 아님) */
export function iaiReadyShown(f) {
  const sk = f?.skill;
  return (f?.iaiHandW ?? 0) > 0.5 && !!sk && !sk.tap && !sk.pom && !sk.sec && !iaiBusy(f);
}

export function iaiReadyPosePlayer(f, on, handFree, dt, standing = false) {
  const sk = f.skill;
  const own = !sk.tap && !sk.pom && !sk.sec && !sk.vitalRange && !sk.vitalRelease;
  if (iaiBusy(f)) {
    f.iaiReadyW = 0;
    f.iaiReadyR = 0;
    f.iaiHandW = 0;
    return;
  }
  // 준비 무게 r (켜짐 0.35 s · 풀림 gnsCrouchOut) — 웅크림 판이면 그대로 몸 웅크림 무게(iaiReadyW · stanceTick), 선 채 판(standing — SECRET.gnsReadyHip)이면 몸은 0 이고 손 몫의 한도로만
  const w0 = f.iaiReadyR ?? f.iaiReadyW ?? 0;
  const h0 = f.iaiHandW ?? 0;
  if (!on && w0 <= 0 && h0 <= 0) return;
  const w = on ? Math.min(1, w0 + dt / 0.35) : Math.max(0, w0 - dt / SECRET.gnsCrouchOut);
  const h = handFree || !on ? (handFree ? 0 : Math.min(h0, w)) : Math.min(w, h0 + dt / 0.35);
  f.iaiReadyR = w;
  f.iaiReadyW = standing ? 0 : w;
  f.iaiHandW = h;
  if (!own) return;
  const R = SECRET.iaiReady;
  const th = sk.thrustPose;
  th.w = h;
  th.hand[0] = R.hand[0];
  th.hand[1] = R.hand[1];
  th.hand[2] = R.hand[2];
  const D = dirOf(R.yaw, R.el);
  th.dir[0] = D.x;
  th.dir[1] = D.y;
  th.dir[2] = D.z;
  th.pelvisYaw = R.body.pelvisYaw * D2R;
  th.chestYaw = R.body.chestYaw * D2R;
  // 선 채 허리 대기 (10/31 — SECRET.gnsReadyHip): 몸 숙임 · 낮춤 없이(골반 높이 그대로 — 덧씌우기 몸 낮춤의 바탕 0.06 · fighter.js) 몸 비틂만 — 발도 길은 가슴 기준이라 서 있는 높이에서 나간다
  th.pitch = standing ? 0 : R.body.pitch * D2R;
  th.drop = standing ? 0.06 : R.body.drop;
}

// ─────────────────────────────────────────────────────────────
//  이베리아 휩쓸기 (10/10 02:5x 사장님 '이베리아 비기도 새 동작을 크게 만들어야겠다. 뭐가 나가는지 전혀 알 수 없었다'):
//   발도와 같은 틀(스텝마다 팔·칼 자리 지정 · 쓸린 자리 판정 · 충돌 끔 · 잔상)로 휘돌려 사선 베기를 크게 —
//   몸이 옆으로 크게 한 걸음(SECRET.iberianSweepSide, 즐겨 도는 쪽 — 닿기에 모자라면 앞으로도) 미끄러지는 동안 칼이 머리 위로 큰 고리를 한 바퀴 돌고
//   그대로 반대(왼) 허리 쪽까지 사선으로 내려 벤다. 전체 SECRET.iberianSweepTime. 맞음·잔상은 사선 몫(SECRET.iberianSweepPath.cut 부터)만.
//   잔상 kind 'sweep' + side(사이드스텝 방향, 월드) → main.js 가 카메라를 그쪽으로 SECRET.camSwing ° 돌렸다 되돌림
// ─────────────────────────────────────────────────────────────

/** 이베리아 휩쓸기를 걸어 둔다. opt.side: +1 칼 든 쪽(오른) · −1 왼 (즐겨 도는 쪽) */
export function requestSweep(f, opt = {}) {
  f.iaiReq = { sweep: true, side: opt.side >= 0 ? 1 : -1 };
  f.instantResult = null;
}

/** 휩쓸기 길의 u(0~1) 자리 (몸 기준): 지금 손 → 오른 어깨 뒤로 멀리 감기(wind) → 가운데를 지나 왼쪽 끝까지 한 번 가로 (고리 없음 — 10/10 04:4x) */
function sweepPose(I, u) {
  const P = SECRET.iberianSweepPath;
  if (u < P.wind) {
    const v = u / P.wind;
    const k = v * v * (3 - 2 * v);
    const H = I.A.H.clone().lerp(new THREE.Vector3(...P.w0.hand), k);
    const q = new THREE.Quaternion().setFromUnitVectors(I.A.D, I.DW);
    return { H, D: I.A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, k)).normalize() };
  }
  // 가로: 감은 자리 → 가운데 → 왼쪽 끝 (칼날 가로 각 165° → 10° → −100°, 한 호)
  const v = (u - P.wind) / (1 - P.wind);
  const [A, B, w] = v < 0.55 ? [P.w0, P.c1, v / 0.55] : [P.c1, P.c2, (v - 0.55) / 0.45];
  const H = new THREE.Vector3(...A.hand).lerp(new THREE.Vector3(...B.hand), w);
  return { H, D: dirOf(A.yaw + (B.yaw - A.yaw) * w, A.el + (B.el - A.el) * w) };
}

/** 휩쓸기 동안 몸 비틀기 (덧씌우기 칸 몸 값): 감기에서 오른쪽으로 감고(w0.body) → 베며 몸 전체를 왼쪽으로 돌린다(body) */
function sweepBody(u) {
  const P = SECRET.iberianSweepPath;
  const A = P.w0.body;
  const B = P.body;
  const k = u < P.wind ? 0 : Math.min(1, (u - P.wind) / (1 - P.wind));
  const t = u < P.wind ? u / P.wind : 1;
  const mix = (key) => (u < P.wind ? A[key] * t : A[key] + (B[key] - A[key]) * k);
  return { pelvisYaw: mix('pelvisYaw'), chestYaw: mix('chestYaw'), pitch: mix('pitch'), drop: mix('drop') };
}

/** 이베리아 휩쓸기가 막혔다 (내 칼이 상대 칼에 몸보다 먼저 닿음): 상대 가슴·골반에 나에게서 먼 쪽으로 충격량 SECRET.iberianShove (물리 — 넘어짐 보장 없음) */
function sweepShove(f, foe) {
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const J = SECRET.iberianShove;
  for (const [n, k] of [['chest', 0.6], ['pelvis', 0.4]]) {
    const b = foe.bodies[n];
    if (b) b.applyImpulse({ x: dx * J * k, y: 0, z: dz * J * k }, true);
  }
}

/** 휩쓸기 시작 (startIai 가 req.sweep 이면 부른다) */
function startSweep(f, combat, req) {
  const foe = f.foe;
  const M = f.swordArt.measure;
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  // 옆(즐겨 도는 쪽)으로 비켜 딛으며 반걸음 뒤(SECRET.iberianSweepBack — 호 안쪽으로 붙은 상대와 틈을 벌림, 10/10 04:4x) [해석]: 옆 = 앞을 칼 든 쪽으로 90° (yaw 틀 z+)
  const rx = -dz * req.side; // 오른쪽(칼 든 쪽) = (−앞z, 앞x)
  const rz = dx * req.side;
  const fwd = -Math.min(SECRET.iberianSweepBack, Math.max(0, M.reach - d)); // 뒤로 — 내 간격 끝을 넘지 않게
  const side = SECRET.iberianSweepSide;
  const yaw = f.yaw.clone();
  const inv = yaw.clone().invert();
  const sw = tv(f.sword.translation(), new THREE.Vector3());
  const AH = sw.clone().sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  f.iaiRopes = { grip: !!f.gripCone, shoulder: !!f.shoulderRopes };
  ropes(f, false);
  f.iai = {
    kind: 'sweep', slideShare: SECRET.iberianSweepSlideShare, J: SECRET.iberianSweepJ, body: SECRET.iberianSweepPath.body, bodyAt: sweepBody, hold: SECRET.stiff.iberian ?? 0.3, pose: sweepPose,
    t: 0, T: SECRET.iberianSweepTime, ab: SECRET.iberianSweepPath.wind, A: { H: AH, D: AD }, DW: dirOf(SECRET.iberianSweepPath.w0.yaw, SECRET.iberianSweepPath.w0.el), yaw, block: true, blocked: false,
    slide: 1, dx: dx * fwd + rx * side, dz: dz * fwd + rz * side, sideW: [rx, 0, rz],
    off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hit: null, res: null, arc: null,
  };
  setKinematic(f, true);
  f.instantGhost = Math.ceil((f.iai.T + SECRET.instantNoCollide) / (combat.dt || 1 / 120)) + 1;
  const P0 = sweepPose(f.iai, 0);
  f.iai.prev = placeIai(f, P0.H, P0.D, true);
}

// ─────────────────────────────────────────────────────────────
//  비기 자세 (10/10 04:2x 사장님 '고노센은 기술은 좋은데 자세가 어정쩡 — 발도술처럼 다리를 많이 굽히고 숙여야. 이탈리아도 마찬가지, 런지 자세 봐봐'):
//   f.secretStance = { drop(골반 더 낮춤 m), pitch(몸통 앞 숙임 rad), rate(골반 높이 바꾸는 빠르기 m/s), offArm?(빈팔 어깨 목표 — 뒤로 뻗기) } 를
//   gait.js(골반 목표 높이 hNomT·빠르기)와 fighter.js applyPose(몸통 숙임 bend · 빈팔)가 읽는다. 무게 w 로 켜고(inTime) 끈다(outTime) — 없으면 null(오늘 그대로).
//   일본 'iai': 발도 대기(iaiReadyW) · 발도 · 뻗은 경직 동안 / 이탈리아 'lunge': Passata 찌르기 시작부터 f.lungeT 초.
//   무릎은 낮춘 골반과 딛은 발 사이 다리 IK(gait)가 굽힌다 — 앞발을 멀리 딛을수록 앞무릎이 깊고 뒷다리는 펴진다
// ─────────────────────────────────────────────────────────────
function stanceTick(f, dt) {
  const ST = SECRET.stance;
  let key = null;
  let want = 0;
  if ((f.iai && f.iai.kind === 'iai') || ((f.iaiHoldT > 0 || f.iaiFade > 0) && f.iaiHoldKind === 'iai')) {
    key = 'iai';
    want = 1;
  } else if ((f.iaiReadyW ?? 0) > 0) {
    key = 'iai';
    want = f.iaiReadyW;
  } else if (f.lungeT > 0) {
    key = 'lunge';
    want = 1;
    f.lungeT -= dt;
  }
  if (!f.alive || f.state !== 'stand') {
    key = null;
    want = 0;
  }
  const cur = (f._stance ??= { key: null, w: 0 });
  if (key && (cur.key === key || cur.w <= 0)) {
    cur.key = key;
    const S = ST[key];
    const tin = key === 'iai' && f.iai ? 0.06 : S.inTime; // 발도 순간은 곧장 낮게
    cur.w = cur.w < want ? Math.min(want, cur.w + dt / tin) : Math.max(want, cur.w - dt / S.outTime);
  } else if (cur.key) cur.w = Math.max(0, cur.w - dt / ST[cur.key].outTime);
  if (!cur.key || cur.w <= 0) {
    cur.w = 0;
    cur.key = null;
    if (f.secretStance) f.secretStance = null;
    return;
  }
  const S = ST[cur.key];
  const st = (f.secretStance ??= {});
  // 발도·뻗은 경직 동안은 덧씌우기 칸 몸(iaiPath.E.body — 낮춤·숙임)이 함께 얹히니 그만큼 뺀 값(S.draw)으로 — 합이 대기 자세 깊이 안팎 (10/10 캡처: 둘을 다 얹으면 골반 0.58 m 쪼그려 앉음·숙임 54°)
  const drawing = cur.key === 'iai' && S.draw && (f.iai?.kind === 'iai' || ((f.iaiHoldT > 0 || f.iaiFade > 0) && f.iaiHoldKind === 'iai'));
  st.drop = (drawing ? S.draw.drop : S.drop) * cur.w;
  st.pitch = (drawing ? S.draw.pitch : S.pitch) * D2R * cur.w;
  st.rate = S.rate;
  st.offArm = S.offArm != null ? 0.5 + (S.offArm - 0.5) * cur.w : undefined;
  st.reach = S.reach != null ? GAIT_REACH + (S.reach - GAIT_REACH) * cur.w : undefined;
}

/** 런지 자세를 켠다 (이탈리아 Passata 찌르기 시작 — AI startStrike·플레이어 secretStrikeStart) */
export function startLunge(f) {
  f.lungeT = SECRET.stance.lunge.time;
}

// ─────────────────────────────────────────────────────────────
//  이베리아 길목 지키기 한 칼의 덧씌우기 자세 (10/11 v6 2차 — 디렉터 '칼끝 선에서 실제로 닿게'): 둘러 베는 두 토막 동안 덧씌우기 칸(skill.thrustPose)에
//   손·칼날 방향·몸 돌림 목표를 준다 — 물리 서보 목표(스텝마다 자리 지정 아님). 수는 일본 발도 길 SECRET.iaiPath 의 가운데(M)·끝(E) 자리를 거울로 다시 씀(새 값 아님):
//   가운데 = 손 앞 0.5 · 위 0.1 · 칼날 수평(앞 0°, 높이 −3°) — 팔을 앞으로 뻗어 칼끝이 상대 몸통 높이로 지난다 ·
//   끝 = 손을 반대쪽 앞으로 다 뻗고 칼날 반대쪽 75° · 몸 돌림(칼 든 어깨가 앞).
//   1차(덧씌우기 없음 — 자세 지도의 패드 길만): 옆 자세에서 칼이 몸 뒤로 감겨 칼끝이 앞 1.3 m · 가슴 +0.8~1.5 m(상대 머리 위)에서 그쳐 48 판 맞힘 0.
//  감는 토막(gilmokWind — 플레이어가 옆 자세 밖에서 창을 받은 때)에는 덧씌우지 않는다 (10/11 v6 4차): 3차에 자세표 옆 자세를 덧씌웠더니 플레이어 칼이 2/2 헛쳤다 —
//   덧씌우기를 빼면 2/2 넓적다리에 닿는다(2차와 같음). 남은 낮음의 원인은 감음 토막의 떨어지는 힘(손을 미리 옆 자세에 두면 칼끝이 가슴 +0.1~0.3 m — 탐침)
//  seg: 'mid'(가운데 토막) | 'end'(끝 토막·따라 지나감·경직) | null(끔 — 0.12 s 에 걷음, iaiReadyPose 끄는 빠르기와 같음) · s: +1 오른쪽에서 탈류 · −1 왼쪽에서 레베스
// ─────────────────────────────────────────────────────────────
const _gh = new THREE.Vector3();
const _gt = new THREE.Vector3();
export function gilmokCutPose(f, seg, s, dt) {
  const th = f.skill.thrustPose;
  if (iaiBusy(f) || f.skill.tap || f.skill.pom) {
    f.gilCutW = 0;
    return;
  }
  const w0 = f.gilCutW ?? 0;
  if (!seg && w0 <= 0) return;
  const w = seg ? 1 : Math.max(0, w0 - dt / 0.12);
  f.gilCutW = w;
  th.w = w;
  if (!seg) return; // 걷는 동안은 마지막 목표 그대로
  const K = SECRET.iaiPath;
  const P = seg === 'mid' ? K.M : K.E;
  // 발도는 왼 허리 → 칼 든 쪽(+)으로 벤다. 길목 탈류(s +1)는 칼 든 쪽 → 반대쪽(−)이라 옆 자리·옆 각을 −s 로 뒤집는다
  th.hand[0] = P.hand[0];
  th.hand[1] = P.hand[1];
  th.hand[2] = -s * P.hand[2];
  // 높이 각 (10/11 v6 3차 — 디렉터 '칼끝이 가운데 선에서 상대 몸통 높이를 지나게'): 발도 길의 고정 각(el) 대신 그 순간의 칼자루 높이·칼 길이로 계산 —
  //  sin(el) = (상대 가슴 몸체 높이 − 내 칼자루 높이) / (칼자루 → 칼끝 길이). 기하에서 나오는 값(고르는 수 없음). 2차(고정 −3°): 칼끝이 츠바이핸더 가슴 −0.13~+0.35 ·
  //  북부 대공의 검 +0.53~0.65 m 로 뜨고, 플레이어는 넓적다리·정강이로 지났다. 상대가 없으면 발도 길 각 그대로
  let el = P.el;
  const foe = f.foe;
  if (foe?.bodies?.chest) {
    const hp = f.bladePoint(0, _gh);
    const tp = f.bladePoint(1, _gt);
    const L = hp.distanceTo(tp);
    // 겨누는 몸 자리 (사장님 결정 10/11 13:5x — SECRET.gilmokAim): 가슴 · 머리 가운데 · 머리 꼭대기(+ 머리 반지름). 처지는 만큼 위를 겨눔 (AI·플레이어 같은 함수)
    const A = SECRET.gilmokAim;
    const ty = A === 'chest' || !foe.bodies.head ? foe.bodies.chest.translation().y : foe.bodies.head.translation().y + (A === 'headTop' ? foe.headR ?? 0 : 0);
    if (L > 0) el = Math.asin(THREE.MathUtils.clamp((ty - hp.y) / L, -1, 1)) / D2R;
  }
  const D = dirOf(-s * P.yaw, el);
  th.dir[0] = D.x;
  th.dir[1] = D.y;
  th.dir[2] = D.z;
  const B = P.body ?? { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 };
  th.pelvisYaw = s * B.pelvisYaw * D2R; // 끝: 탈류는 칼 든 어깨가 앞(−) — 발도 E 와 같은 부호, 레베스는 거울
  th.chestYaw = s * B.chestYaw * D2R;
  th.pitch = B.pitch * D2R;
  th.drop = B.drop;
}

/** 길목 한 칼의 토막 이름 → gilmokCutPose 의 seg · s (그 밖이면 seg null) */
export function gilmokSeg(name, stiff) {
  const m = /^gilmok(Talho|Revez)(End)?$/.exec(name ?? '');
  if (!m) return { seg: null, s: 1 };
  return { seg: m[2] || stiff ? 'end' : 'mid', s: m[1] === 'Talho' ? 1 : -1 };
}

// ─────────────────────────────────────────────────────────────
//  중국 빠른 연환 (10/12 사장님 01:1x '연격은 기술 자체의 시각적 효과도 잘 안 보여서 … 고노센 50% 정도의 빠르기와 잔상' · 01:2x '잔상도 고노센의 50%나 65%로' —
//   docs/strike/cn_combo_play_2026-10-12.md §5). 서보는 손 빠르기 handSpeed 1.5 에서 포화돼 더 빨라지지 않는다 → 발도와 같은 틀(**물리 원칙의 예외** — 사장님 10/9 23:5x
//   '모든 비기 모션·판정 어드밴티지'): 팔 사슬·칼을 스텝마다 길 위 자리에 놓는다(placeIai — 관절 기준점이 맞음, 칼 쪽 팔·칼 ↔ 상대 몸·칼 충돌 끔 instantGhost).
//   길 = 막기 연환 두 수의 패드 길 그대로(schools.js CHINESE_SECRET_PARRY do.combo — 앞 수 끝에서 곧장): 지금 칼 → 첫 수 준비 자세(from) → 길 점 → 둘째 수 from → 길 점.
//   패드 → 손 자리·칼날 방향 = 휘두를 때 서보가 쫓는 목표와 같은 식(fighter.js padPose). 빠르기 = 칼끝(칼자루 끝 + 칼날 방향 × 칼 길이) 평균이 같은 칼의 발도 베는 몫
//   (iaiPath B→M→E 길이 / iaiTime)의 SECRET.cnFastShare 몫이 되게 토막마다 시간 = 칼끝 길이 / 그 빠르기 (새 시간 값 없음).
//   맞음 = 발도처럼 쓸린 자리(스텝마다 칼날 선분 3 조각 · 길 점 토막만 — 준비 토막은 베는 길이 아님) · 수마다 한 번. 상처 에너지는 정하지 않는다 — 쓸린 그 점의 실제 빠르기로
//   기존 상처 함수(combat.analyze, 판정 배율 hitMul) [발도는 칼끝 40 m/s 라 고정 J 를 썼다 — 연환은 그 절반이라 물리 빠르기 그대로가 자연스럽다]. 몸보다 먼저 상대 칼에 닿으면
//   (이베리아 휩쓸기와 같은 거리) 그 수는 막힘 — 남은 길을 건너뛰고 다음 수로(밀어냄 없음). 걸음 = 수마다 반걸음(step.fwd) 몸 미끄러짐(발도와 같은 한도 — 맞닿기에서 멈추고
//   clinch 안 금지) + 다리 걸음 요청. 잔상 = 발도와 같은 f.instantArc(kind 'combo', share — sword_trail.js 가 밝기·섬광을 share 배로). 끝나면 끝 자세를 경직 동안 붙잡는다(발도와 같음).
// ─────────────────────────────────────────────────────────────
const COMBO_TURN = 0.35; // 손이 있는 쪽으로 몸을 트는 계수 (rad / 패드 m) — fighter.js BODY_TURN 과 같은 수 (이름만 붙인 재사용)

/** 빠른 연환을 걸어 둔다. opt.moves = 두 수 (schools.js 막기 연환 seq 꼴, step.fwd 는 m 로 푼 것) */
export function requestCombo(f, opt = {}) {
  f.iaiReq = { combo: true, moves: opt.moves ?? [], share: opt.share, hold: opt.hold, hitMul: opt.hitMul, effMul: opt.effMul, width: opt.width, tech: opt.tech, mord: opt.mord ?? null, arcCut: !!opt.arcCut, face: opt.face || null, min: opt.min ?? 0, maxT: opt.maxT ?? 0, keepAim: !!opt.keepAim, attack: !!opt.attack, speed: opt.speed > 0 ? opt.speed : 0, noArc: !!opt.noArc, selfFree: +opt.selfFree || 0 }; // speed: 칼끝 빠르기 m/s 를 바로 (share 대신 — 10/31 칼끝 돌려 빼기 = 보통 찌르기 빠르기) · noArc: 잔상 없음 (10/31 — 특수 공격이 아닌 끌고 가는 칼) // width: 잔상 굵기 몫 (격살 시험 — sword_trail.js) · mord: 죽음의 일격 운동학 길(10/22 밤 — mordschlag.js) · arcCut: 잔상은 베는 토막만 · face: 마주 보는 띠('path' 치는 끝 길 · 'line' 찌르는 줄) · min: 잔상 밝기 바닥 (10/23 비기 잔상 점검 — 사람 비기만, 아래 stepCombo · sword_trail.js)
  f.instantResult = null;
}

/** 칼끝 자리 (몸 틀) = 손 자리 + 칼날 방향 × (칼자루 + 칼날) · L 을 주면 그 거리 (죽음의 일격: 칼자루 끝까지 — 방향은 칼자루 쪽) */
function comboTip(f, H, D, out = new THREE.Vector3(), L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength) {
  return out.copy(H).addScaledVector(D, L);
}

/** 토막 안 u 자리: 손 lerp · 칼날 slerp (iaiPose 와 같은 보간) · 패드 x (몸 돌림) · 손 돌리기 rad (길 덧칸이 있는 수만 — 없으면 0) */
function comboLerp(sg, u) {
  const H = sg.A.H.clone().lerp(sg.B.H, u);
  const q = new THREE.Quaternion().setFromUnitVectors(sg.A.D, sg.B.D);
  const D = sg.A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, u)).normalize();
  const ta = sg.A.turn ?? 0;
  return { H, D, px: sg.A.px + (sg.B.px - sg.A.px) * u, turn: ta + ((sg.B.turn ?? 0) - ta) * u };
}

/** 길 덧칸 (제비 베기 되돌림 칼 — 10/25 · 곁눈 베기 덧칸과 같은 칸 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °] · fighter.js driveSword techPlan 과 같은 식): 손 앞으로 · 칼 겨눔 높이각 · 손 돌리기(placeIai) */
function comboPlanAdd(B, pl) {
  B.H.x += pl[1] ?? 0;
  const tilt = (pl[0] ?? 0) * D2R;
  const h = Math.hypot(B.D.x, B.D.z);
  if (tilt && h > 1e-3) {
    const el = Math.atan2(B.D.y, h) + tilt;
    const c = Math.cos(el);
    B.D.set((B.D.x / h) * c, Math.sin(el), (B.D.z / h) * c);
  }
  B.turn = (pl[2] ?? 0) * D2R;
}

/** 토막의 칼끝 길이 (8 조각) · reach 를 주면 손에서 그 거리 점의 길이 (죽음의 일격 — 칼자루 끝) */
function comboSegLen(f, sg, reach) {
  let L = 0;
  let prev = comboTip(f, sg.A.H, sg.A.D, new THREE.Vector3(), reach);
  for (let i = 1; i <= 8; i++) {
    const P = comboLerp(sg, i / 8);
    const t = comboTip(f, P.H, P.D, new THREE.Vector3(), reach);
    L += t.distanceTo(prev);
    prev = t;
  }
  return L;
}

/** 같은 칼의 발도 베는 몫 칼끝 빠르기 (m/s): iaiPath B → M → E 칼끝 길이 / iaiTime (대기 자세에서 곧장 가로 — 고노센 기본 시간) */
export function iaiTipSpeed(f) {
  let L = 0;
  let prev = null;
  for (let i = 0; i <= 24; i++) {
    const P = iaiPose({ ab: 0 }, i / 24);
    const t = comboTip(f, P.H, P.D);
    if (prev) L += t.distanceTo(prev);
    prev = t;
  }
  return L / SECRET.iaiTime;
}

/** 몸 돌림 (덧씌우기 칸 몸 값, °): 손이 있는 쪽으로 — 검술 층의 휘두를 때 몸 돌림과 같은 계수 (가슴 전부 · 골반 반) */
function comboBody(px) {
  const ch = (-px * COMBO_TURN) / D2R;
  return { pelvisYaw: ch * 0.5, chestYaw: ch, pitch: 0, drop: 0 };
}

/**
 * 런지 빛줄기의 처음 점 (사장님 10/25 14:0x 리솔루토 연출 — sword_trail.js 런지 빛줄기): 런지를 시작하는 스텝의 칼날 밑동(칼자루 쪽 끝 — bladePoint 0, 월드 [x, y, z]) · 읽기만.
 *  칼끝이 아니라 밑동: 런지 칼끝은 0.24 m 남짓만 나가(가슴 사이 1.58 m — 탐침 · 몸 미끄러짐 한도 0.6 m 를 다 써도 1 m 안) 뒤 카메라에서 점에 가깝다 → 칼이 지나간 찌르는 줄 전체(처음 밑동 → 가장 멀리 간 칼끝)를 빛줄기로
 */
function lungeFrom(f) {
  const t = f.bladePoint(0, new THREE.Vector3());
  return [t.x, t.y, t.z];
}

function startCombo(f, combat, req) {
  const yaw = f.yaw.clone();
  const inv = yaw.clone().invert();
  const c = f.bodies.chest.translation();
  const AH = tv(f.sword.translation(), new THREE.Vector3()).sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  if (req.mord) {
    // 죽음의 일격 (10/22 밤 — 운동학 길): 손 = 손목(아래팔 앞끝 — 거꾸로 쥐면 칼 원점이 손이 아니다) · 방향 = 칼자루 쪽(칼 축 −y). 손목 · 칼 든 어깨 밧줄은 휩쓸기처럼 떼었다가 끝에 다시
    const fa = f.bodies.farmS;
    AH.set(0.13, 0, 0).applyQuaternion(tq(fa.rotation(), _qs)).add(tv(fa.translation(), _v3)).sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
    AD.negate();
    f.iaiRopes = { grip: !!f.gripCone, shoulder: !!f.shoulderRopes };
    ropes(f, false);
  }
  const share = req.share ?? SECRET.cnFastShare; // 빠르기 · 잔상 몫 (연환 cnFastShare · 진 · 츠바메가에시 되돌림 칼 secretBlade.kin — 10/21)
  const v = Math.max(1e-3, req.speed > 0 ? req.speed : share * iaiTipSpeed(f)); // speed: 칼끝 빠르기를 바로 준 칼 (10/31 칼끝 돌려 빼기)
  if (!req.moves.length) {
    f.instantResult = { ok: false, hit: false };
    return;
  }
  f.iai = {
    kind: 'combo', moves: req.moves, segs: [], si: 0, ts: 0, t: 0, v, yaw, mi: -1, moveName: null, cutting: false, cur: { H: AH, D: AD, px: f.handOffset.x }, last: null,
    body: comboBody(f.handOffset.x), bodyAt: null, hold: req.hold ?? SECRET.stiff[f.swordArt?.tradition] ?? 0.3, hitMul: req.hitMul ?? SECRET.hitMul, effMul: req.effMul ?? null, tech: req.tech ?? null,
    off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hits: 0, E: 0, Emax: 0, blocked: 0, part: null, zone: null, type: null,
    arc: { id: (f.instantArc?.id ?? 0) + 1, kind: 'combo', share, pts: [], ...(req.width > 0 && req.width < 1 ? { width: req.width } : {}), ...(req.face ? { face: req.face } : {}), ...(req.min > 0 ? { min: req.min } : {}), ...(req.moves.some((m) => m.lunge) ? { lunge: lungeFrom(f) } : {}) }, slide: null, mord: req.mord ?? null, arcCut: !!req.arcCut,
    maxT: req.maxT ?? 0, // 끌고 가는 시간 상한 (s — 제비 베기 되돌림 칼 requestArtSnap · 0 = 없음, 길 끝까지)
    keepAim: !!req.keepAim, // 끝나도 손 목표를 옮기지 않음 (탭으로 낸 칼 — 날개 접기 10/28: 손 목표 뜀이 긋기로 읽히지 않게)
    attack: !!req.attack, // 탭으로 낸 특수 공격 칼 (10/28): 끄는 동안 공격 중(stamina.attacking — 유파 패시브 인데스 · 몸 돌림 묶기 · 막아 받기 값이 보통 긋기 · 탭과 같게)
    noArc: !!req.noArc, // 잔상 없음 (10/31 칼끝 돌려 빼기 — 특수 공격이 아님)
    selfFree: req.selfFree ?? 0, // 10/31 칼끝 돌려 빼기 넘어짐 고침 (UNIQUE_ASSIST.cavSelfFree): 1 = 이 수 동안 칼 어깨 면 밧줄을 뗌(아래 · 끝나면 endCombo 가 다시 검)
  };
  if (req.selfFree >= 1 && f.shoulderRopes && !f.iaiRopes) {
    // 칼 어깨 면 밧줄(가슴 ↔ 위팔 — BODY.humanLimits)을 이 수 동안 뗌 (휩쓸기 · 풍차 감기 · 죽음의 일격과 같은 까닭): 돌려 빼는 위팔이 면 한도 밖을 지나면 밧줄이 스텝마다 가슴을 잡아채고
    //  놓인 팔 빠르기는 가슴 빠르기로 되돌려져(placeIai) 반작용만 몸에 남음 — 골반이 0.09 s 에 초속 5 m 로 뒤로 밀려 넘어졌다 · 끝나면 다시 건다(endCombo — iaiRopes) · 손목 원뿔은 그대로
    f.iaiRopes = { grip: false, shoulder: true };
    for (const j of f.shoulderRopes) f.world.removeImpulseJoint(j, true);
    f.shoulderRopes = null;
  }
  if (!req.arcCut && !req.noArc) f.instantArc = f.iai.arc; // 베는 토막만(arcCut)이면 첫 베는 점에서 건다 (stepCombo — 섬광 · 남는 시간이 베는 순간부터)
  f.artTech = req.tech ?? null; // 이 끌고 가는 칼이 어떤 기술인가 (unique_assist.js strokeTechOf — 진 · 츠바메가에시 피해 × 3)
  setKinematic(f, true);
  f.instantGhost = Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120)) + 1; // 수를 짤 때마다·스텝마다 다시 채운다 (stepCombo)
  f.iai.prev = placeIai(f, AH, AD, true);
  comboNext(f, f.iai);
}

/** 다음 수로: 반걸음·이름 → 길을 지금 자리에서 짠다 (cnPath 면 그때 계산, 아니면 패드 길). 수가 없으면 false */
function comboNext(f, I) {
  if (I.mi + 1 >= I.moves.length) return false;
  comboMoveStart(f, I, I.mi + 1);
  const m = I.moves[I.mi];
  const dyn = !!m.dyn && (!!SECRET.cnPath || !!m.lunge); // 안다레 리솔루토 런지(10/24 — m.lunge)는 연환 길 스위치(cnPath)와 따로 늘 그때 계산 찌름
  I.segs = (I.mord ? comboPlanMord(f, I, m, I.cur) : m.artThrust ? comboPlanArtThrust(f, I, m, I.cur) : m.dup ? (m.dyn?.old ? comboPlanDup(f, I, m, I.cur) : comboPlanDupLine(f, I, m, I.cur)) : m.rd ? comboPlanRd(f, I, m, I.cur) : dyn ? comboPlanDyn(f, I, m, I.cur) : comboPlanPad(f, I, m, I.cur)).filter((sg) => sg.T > 0); // rd: 사람 풍차 베기 (10/29 — 아래) // artThrust: 사람 칼끝 돌려 빼기 (10/28 — 아래)
  I.si = 0;
  I.ts = I.t;
  I.segT0 = I.t; // 이 수 토막들이 시작한 때 (런지 쓸린 자리 — lungeSweep)
  let span = I.segs.reduce((a, sg) => a + sg.T, 0);
  if (m.capFromCut && I.maxT > 0 && I.segs[0] && !I.segs[0].cut) {
    // 날개 접기 (10/28) · 풍차 베기 (10/29): 시간 상한은 베는 몫부터 (앞의 맞힘 없는 준비 토막들은 셈 밖 — 같은 빠르기 · 날개 접기는 준비 토막 하나라 전과 같음)
    let lead = 0;
    for (const sg of I.segs) {
      if (sg.cut) break;
      lead += sg.T;
    }
    I.maxT = I.t + lead + I.maxT;
  }
  if (m.artThrust || m.dup) {
    // 칼끝 돌려 빼기 (10/28): 몸 미끄러짐 시간 · 토막 늘림은 길을 짜며 정함 (comboPlanArtThrust — 찌름이 끝날 때 다 미끄러짐) · 겹치기는 앞 박차기가 있을 때만 (10/31 19:xx — dupBurstStart)
    if (m.dup && m.step?.burst) dupBurstStart(f, I, m, span);
  } else if (I.slide && I.slide.slide > 0 && dyn && span > 0) {
    // 그때 계산 길 (10/12 03:0x): 길은 미끄러진 뒤의 상대 자리로 짜므로 몸 틀 칼끝 길이 짧아진다 — 칼끝이 땅에 대해 지나는 길 = 몸 틀 길 + 반걸음.
    //  그만큼 시간을 늘려 칼끝 빠르기를 같은 값(I.v)에 두고, 반걸음은 그 수 시간 내내 미끄러진다. (안 하면 찌름 길이 0.02 s 로 줄어 몸이 12 m/s 로 미끄러지며 그 빠르기가
    //  찌름에 실려 48 판 찌름 상처가 566~811 J 로 튀었다)
    const L = span * I.v;
    const k = (L + I.slide.slide) / L;
    for (const sg of I.segs) sg.T *= k;
    span *= k;
    I.slide.span = span;
  } else if (I.slide && I.slide.slide < 0 && !I.slide.keep) I.slide.span = Math.max(1e-3, span); // 물러남(10/12 3 연격 마지막 수) · keep = 길을 짤 때 정한 span 그대로(죽음의 일격 머리 뚫음 막기 반걸음 — 10/31 시제품 · 기본 끔): 그 수 시간 내내 뒤로 — 벰은 옆으로 가로질러 칼끝 길은 그대로 둔다
  else if (I.slide && !I.slide.keep) I.slide.span = Math.max(1e-3, span * SECRET.iaiSlideShare); // 패드 길: 그 수 시간의 발도와 같은 몫 안에 (10/12 01:1x 그대로) · keep = 길을 짤 때 정한 span 그대로(죽음의 일격 폼멜 찍기 반걸음 — 10/31 시제품)
  return true;
}

/** 10/12 01:1x 패드 길: 지금 자리 → 준비 자세(from, 준비 토막 — 맞힘 없음) → 길 점 */
function comboPlanPad(f, I, m, A) {
  const segs = [];
  let cur = A;
  // 패드 → 손 자리 · 칼날 (dy: 몸통 띠 겨눔이 패드 높이를 옮긴 몫 — 자세 지도가 손 · 칼끝을 함께 정함)
  const pts = [m.from, ...m.path];
  //  띠 높이 옮김 꼴 (곧은 제비 베기 — 10/31 · 수의 shift 칸 · 없으면 10/25 — 길 점 모두 같은 높이만큼):
  //   'pivot' 꺾은 자리는 두고 길 점을 꺾은 자리부터 간 길이 몫만큼 옮김(곧은 줄이 꺾은 자리를 축으로 기울어짐)
  //   'slide' 위로는 길을 제 줄 따라 밀어 올림(꺾은 자리 → 끝 줄 위로 — 준비 토막이 베는 줄과 한 줄) · 아래로는 'pivot' — 어느 쪽이든 칼끝 길이 곧은 줄 하나
  const cum = pts.map((p, k) => (k ? Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0));
  for (let k = 1; k < cum.length; k++) cum[k] += cum[k - 1];
  const last = pts[pts.length - 1];
  const kx = Math.abs(last[1] - pts[0][1]) > 1e-6 ? (last[0] - pts[0][0]) / (last[1] - pts[0][1]) : 0; // 줄 기울기 (패드 x / 높이)
  const pivot = (dy) => m.shift === 'pivot' || (m.shift === 'slide' && dy < 0);
  const build = (dy = 0) =>
    pts.map((p0, k) => {
      const p = !dy ? p0 : pivot(dy) ? [p0[0], p0[1] + (dy * cum[k]) / Math.max(1e-6, cum[cum.length - 1])] : m.shift === 'slide' ? [p0[0] + dy * kx, p0[1] + dy] : [p0[0], p0[1] + dy];
      const B = { H: new THREE.Vector3(), D: new THREE.Vector3(), px: p[0], pad: p };
      f.padPose(p[0], p[1], B.H, B.D);
      if (m.plan?.[k]) comboPlanAdd(B, m.plan[k]); // 길 덧칸 ([from, ...path] 점마다 — 제비 베기 되돌림 칼만)
      return B;
    });
  const poses = m.band ? comboBandShift(f, I, A, build) : build(); // 몸통 띠 겨눔 (제비 베기 되돌림 칼 — 10/25 23:1x)
  poses.forEach((B, k) => {
    const sg = { cut: k > 0, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  });
  return segs;
}

const BAND_LEG = new Set(['thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']);
/**
 * 몸통 띠 겨눔의 셈 (comboBandShift): 지금 자리 A → [from, ...path] 길(poses — 몸 틀)을 stepCombo 와 같은 스텝으로 미리 끌고 가 보아, 놓일 칼날이 상대 몸
 *  (칼 · 떨어진 조각 빼고)에 처음 닿는 곳 { part, y(월드 높이) } · 없으면(또는 상대 칼에 먼저 막힘) null.
 *  스텝 시간 · 토막 시간(칼끝 길이 / I.v) · 날 세우기(edgeHint — 길 위 칼끝 − 지난 스텝 칼끝) · 팔 IK · 굴림 묶음 · 손목 교정(iaiSolve) · 넘어온 스텝 맞힘 안 봄 · 한 스텝 3 조각 ·
 *  시간 상한까지 stepCombo 와 같다 — 패드 길만 보면 손목 교정 · 날 세우기가 칼끝을 5 ~ 20 cm 옮겨 '골반' 이라 셈한 길이 실제로는 앞을 막은 팔에 먼저 닿았다.
 *  셈만 하고 팔 관절 목표 · 팔꿈치 돌림 · 칼날 읽기 칸은 되돌린다. 두 몸의 움직임은 가슴 빠르기 차이만큼 칼을 곧게 옮겨 본다(끌고 가는 0.1 s 안팎 — 몸 비틀기 · 상대 팔 움직임은 셈 밖)
 */
function bandFirst(f, I, A, poses) {
  const segs = [];
  let from = A;
  for (let k = 0; k < poses.length; k++) {
    const sg = { cut: k > 0, A: from, B: poses[k] };
    sg.T = comboSegLen(f, sg) / I.v;
    if (sg.T > 0) segs.push(sg);
    from = poses[k];
  }
  return bandFirstSegs(f, I, segs);
}
/** bandFirst 의 셈 몸 (토막을 받음 — 날개 접기 허리 호 waistAim 도 씀 · 10/28). slide = { dx, dz, slide, span } 이면 그 미끄러짐(stepCombo 와 같은 1 − (1 − x)² 꼴)만큼 칼을 옮겨 봄 */
function bandFirstSegs(f, I, segs, slide = null) {
  const foe = f.foe;
  const J = f.jointByName;
  const HL = f.weaponCfg.hiltLength;
  const L = HL + f.weaponCfg.bladeLength;
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const slAt = (t) => (slide ? slide.slide * (1 - (1 - clamp((t - I.t) / slide.span, 0, 1)) ** 2) : 0);
  const keep = { u: J.uarmS.target.clone(), fa: J.farmS.target.clone(), sw: f.swivelTh, full: f.armFull, raw: f.aimRawW?.clone() ?? null };
  const dt = (f.lastDt || 1 / 120) * f.stamina.attackSpeed;
  const vRel = tv(f.bodies.chest.linvel(), new THREE.Vector3()).sub(tv(foe.bodies.chest.linvel(), new THREE.Vector3())); // 두 몸이 서로 다가오는 빠르기 (맞힘을 볼 때만 칼을 그만큼 옮김 — 끌고 가는 동안 가슴이 스텝마다 0.5 cm 안팎 감)
  let prev = I.prev;
  let hint = I.edgeHint ?? null;
  let si = 0;
  let ts = I.t;
  let hit = null;
  try {
    for (let t = I.t + dt; si < segs.length && !hit; t += dt) {
      const si0 = si;
      while (si < segs.length && t >= ts + segs[si].T) ts += segs[si++].T;
      if (si >= segs.length || (I.maxT > 0 && t >= I.maxT)) break;
      const sg = segs[si];
      const P = comboLerp(sg, clamp((t - ts) / sg.T, 0, 1));
      const Dp = P.D.clone().applyQuaternion(I.yaw).normalize();
      if (prev?.tip) {
        const h = P.H.clone().applyQuaternion(I.yaw).add(c).addScaledVector(Dp, L).sub(prev.tip);
        if (h.lengthSq() > 1e-8) hint = h;
      }
      const R = iaiSolve(f, P.H, P.D, P.turn ?? 0, hint, true);
      const B = new THREE.Vector3(0, HL, 0).applyQuaternion(R.qs).add(R.wrist);
      const cur = { B, D: R.Dw, tip: B.clone().addScaledVector(R.Dw, f.weaponCfg.bladeLength) };
      if (sg.cut && segs[si0]?.cut && prev) {
        for (let k = 1; k <= 3 && !hit; k++) {
          const tk = t - dt * (1 - k / 3);
          const Bk = prev.B.clone().lerp(cur.B, k / 3).addScaledVector(vRel, tk - I.t);
          if (slide) Bk.add(new THREE.Vector3(slide.dx, 0, slide.dz).multiplyScalar(slAt(tk)));
          const Dk = prev.D.clone().lerp(cur.D, k / 3).normalize();
          const tip = Bk.clone().addScaledVector(Dk, f.weaponCfg.bladeLength);
          if (foe.armed && foe.sword && segSegApprox(Bk, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) < SECRET.iberianBlockDist) {
            hit = { part: null, y: 0, blocked: true };
            break;
          }
          let best = null;
          for (const [h, info] of f.colliderInfo) {
            if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
            const col = f.world.getCollider(h);
            if (!col) continue;
            const r = segToCollider(Bk, tip, col);
            if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { r, info, col };
          }
          if (best) hit = { part: best.info.part, y: segPointT(Bk, tip, tv(best.col.translation(), new THREE.Vector3())).t * (tip.y - Bk.y) + Bk.y };
        }
      }
      prev = cur;
    }
  } finally {
    J.uarmS.target.copy(keep.u);
    J.farmS.target.copy(keep.fa);
    f.swivelTh = keep.sw;
    f.armFull = keep.full;
    if (keep.raw) f.aimRawW.copy(keep.raw);
  }
  return hit && !hit.blocked ? hit : null;
}
const BAND_STEP = 0.025; // 패드 높이 옮김 한 칸 (확인표 2587 — 사장님 확인 전)
const BAND_MAX = 16; // 칸 수 = 위아래 0.4 패드까지 (확인표 2587 — 사장님 확인 전)
/**
 * 몸통 띠 겨눔 (사장님 10/25 23:1x '제비베기는 위팔·가슴을 노리기보다 자연스럽게 몸통 전체(다리 위 골반부터 목 아래 가슴까지)를 노리게' — config UNIQUE_ASSIST.tsuBand):
 *  올려 긋는 길(꺾은 자리 = 내려간 칼이 멈춘 자리부터)이 상대 몸에 처음 닿을 곳을 지금 상대 자세로 잰다 — 몸통 띠(골반 · 배 · 목 아래 가슴)면 그대로.
 *  아니면 길 점 모두의 패드 높이를 0.025 씩 0.4 까지 옮겨 보며(다리면 위로만 · 목 · 머리면 아래로만 · 팔이면 위아래 번갈아 — 가까운 쪽 먼저) 처음 닿는 곳이 몸통 띠가 되는
 *  가장 적은 옮김을 고른다 = 자연스러운 길에서 가장 가까운 몸통 자리. 몸통이 안 나오면 다리 · 목 · 머리를 비킨 가장 적은 옮김(앞을 막은 팔), 그것도 없으면 그대로.
 *  띠 끝: 다리 위 = 골반 · 목 아래 = 가슴 몸체 가운데 0.11 m 위(combat.js zoneOf 목 경계).
 *  (죽음의 일격 pull · 격살 겨눔처럼 길 점 모두를 옮김 — 손 자리만 옮기면 칼끝이 손에 대해 사람 손목 밖으로 꺾여 손목 교정이 켜졌다 꺼졌다 칼 줄이 스텝마다 튐: 자세 지도가 손 · 칼끝을 함께 정하게 패드로).
 *  닿는 곳이 없으면(멀리) 그대로. build(dy) = 그 높이의 몸 틀 길 · 옮긴 패드 높이 I.bandDy · 옮기기 전 · 뒤 처음 닿을 곳 I.bandFrom · I.bandTo (재기)
 */
function comboBandShift(f, I, A, build) {
  const poses = build(0);
  I.bandDy = 0;
  I.bandFrom = null;
  I.bandTo = null;
  if (!f.foe?.bodies?.chest) return poses;
  const neckY = f.foe.bodies.chest.translation().y + 0.11;
  // 처음 닿는 곳 갈래: 'torso' 몸통 띠 · 'leg' 다리 · 'high' 목 · 머리 · 'arm' 그 밖(팔 — 몸통 앞을 막음) · null 안 닿음
  const cls = (h) => (!h ? null : BAND_LEG.has(h.part) ? 'leg' : h.part === 'head' || (h.part === 'chest' && h.y > neckY) ? 'high' : h.part === 'pelvis' || h.part === 'abdomen' || h.part === 'chest' ? 'torso' : 'arm');
  const h0 = bandFirst(f, I, A, poses);
  const c0 = cls(h0);
  I.bandFrom = I.bandTo = h0?.part ?? null;
  if (!c0 || c0 === 'torso') return poses;
  const dirs = c0 === 'leg' ? [1] : c0 === 'high' ? [-1] : [1, -1];
  let side = null; // 몸통이 안 나올 때: 다리 · 목 · 머리를 비킨 가장 적은 옮김
  for (let k = 1; k <= BAND_MAX; k++) {
    for (const s of dirs) {
      const dy = s * BAND_STEP * k;
      const P = build(dy);
      const h = bandFirst(f, I, A, P);
      const c = cls(h);
      if (c === 'torso' || (c === 'arm' && c0 !== 'arm' && !side)) {
        const pick = { dy, P, part: h.part };
        if (c === 'arm') side = pick;
        else return bandPick(I, pick);
      }
    }
  }
  return side ? bandPick(I, side) : poses;
}
function bandPick(I, { dy, P, part }) {
  I.bandDy = dy;
  I.bandTo = part; // 옮긴 뒤 처음 닿을 곳 (재기)
  return P;
}

/**
 * 죽음의 일격 운동학 길 (10/22 밤 감독 — SECRET.mord.kin · 기본 끔): 지금 자리 → 시작 자세(준비 — 맞힘 없음) → 기술 길 점(맞힘) → 시작 자세(다시 세우기 — 맞힘 없음).
 *  패드 → 손 자리 · 방향은 서보 길과 같은 padPose — 방향은 칼자루 쪽(겨눔 뒤집기와 같음). 시간 = 칼자루 끝(I.mord.Lp) 길이 / I.v.
 *  I.mord.pull (SECRET.mord.aim 'pull'): 베는 길 위 칼자루 가운데 점(손에서 (Lc + Lp)/2)이 상대 머리 가운데에 가장 가까운 자리를 찾아, 시작 자세 · 길 점의 손 자리를
 *   그 차이만큼 옮긴다 — 칼자루 가운데가 머리 가운데를 지난다 (격살 겨눔 comboPlanAim 과 같은 꼴 · 새 수 없음 · 길을 짜는 그때의 머리 자리). 다시 세우기는 옮기기 전 시작 자세로
 */
function comboPlanMord(f, I, m, A) {
  const M = I.mord;
  const pose = (p) => {
    const B = { H: new THREE.Vector3(), D: new THREE.Vector3(), px: p[0], pad: p };
    f.padPose(p[0], p[1], B.H, B.D);
    return B;
  };
  let pts = [m.from, ...m.path].map(pose);
  let home = pose(m.from); // 다시 세우기 끝 = 옮기기 전 시작 자세 (굳음 붙잡기 · 원래 쥠으로 돌아가는 자리)
  const R = M.regrip; // 자연스러운 쥠 바꿈 (10/31 시제품 — SECRET.mord.regrip · 기본 끔): 길 · 겨눔 · 토막 시간은 끝 쥠(G)의 칼자루 길이로
  const Lc = R ? R.G.g - R.HL : M.Lc;
  const Lp = R ? R.G.g - R.yp : M.Lp;
  if (M.pommel) {
    // 폼멜 찍기 (10/31 시제품 — SECRET.mord.pommel · 기본 끔 · 사장님 '칼은 그대로 쥐고 폼멜이나 손잡이 하단부로 찍기'): 쥠 그대로 · D = 폼멜 쪽(칼날은 위 뒤로 섬) —
    //  머리 위에서(손 이마 앞 위) 폼멜 끝을 앞 아래로 내려찍는 길 (몸 틀 · 칼 든 쪽 z = side). 'pull' 겨눔 · 머리 따라 겨눔 · 머리 뚫음 막기는 같은 셈
    const z = f.side ?? 1;
    const mk = (h, d) => ({ H: new THREE.Vector3(h[0], h[1], h[2] * z), D: new THREE.Vector3(d[0], d[1], d[2] * z).normalize(), px: m.from[0], pad: m.from });
    pts = [mk([0.26, 0.6, 0.1], [0.15, -1, 0]), mk([0.4, 0.42, 0.06], [0.45, -0.9, 0]), mk([0.42, 0.1, 0.04], [0.75, -0.65, 0])];
    home = mk([0.26, 0.6, 0.1], [0.15, -1, 0]);
  }
  M.start = pts[0]; // 재기 (시작 자세 · 다시 세우기 끝 — 옮김 delta = start.H − home.H)
  M.home = home;
  if (M.pull && f.foe?.bodies.head) {
    const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
    const P = tv(f.foe.bodies.head.translation(), new THREE.Vector3()).sub(c).applyQuaternion(I.yaw.clone().invert());
    const r = M.pommel ? Lp * 0.8 : (Lc + Lp) / 2; // 폼멜 찍기: 폼멜 공 가운데 쯤
    let best = null;
    for (let k = 0; k + 1 < pts.length; k++) {
      for (let i = 0; i <= 8; i++) {
        const Q = comboLerp({ A: pts[k], B: pts[k + 1] }, i / 8);
        const C = Q.H.clone().addScaledVector(Q.D, r);
        const d = C.distanceTo(P);
        if (!best || d < best.d) best = { d, C, k, i };
      }
    }
    if (best) {
      const delta = P.clone().sub(best.C);
      // 머리 따라 겨눔 (10/30 시제품 — SECRET.mord.track · 기본 끔): 옮기기 전 길 · 겨눈 길 자리(토막 k 의 i/8)를 두었다가 stepCombo 가 스텝마다 그때 머리로 다시 옮김 (mordTrack)
      if (SECRET.mord.track) M.trk = { pts, base: pts.map((B) => ({ H: B.H.clone(), D: B.D.clone() })), k: best.k, w: best.i / 8, r, seg: null, tAim: null, done: false, n: 0, moved: 0 };
      if (SECRET.mord.noSelfClip) M.clip = mordClipPlan(f, I, pts, M.trk?.base ?? pts.map((B) => ({ H: B.H.clone(), D: B.D.clone() })), best.k, best.i / 8, P, r); // 내 머리 뚫음 막기 (10/31 시제품 · 기본 끔 — 아래)
      else for (const B of pts) B.H.add(delta);
      M.pullD = delta.length(); // 재기 (옮긴 거리 m)
    }
  }
  const segs = [];
  let cur = A;
  const push = (B, cut, rg = null) => {
    const sg = { cut, A: cur, B };
    sg.T = rg ? rg.T : (M.pommel ? Math.max(comboSegLen(f, sg, Lp), comboSegLen(f, sg, 0)) : comboSegLen(f, sg, Lp)) / I.v; // 폼멜 찍기: 폼멜 끝 길이 짧아(손이 0.4 m 드는데 0.02 s) 손 길이 쪽으로
    if (rg) sg.rg = rg;
    segs.push(sg);
    cur = B;
  };
  if (R) {
    // 쥠 바꿈 토막 셋 (맞힘 없음 · 시간 R.T 를 0.4 · 0.3 · 0.3): ① 칼이 칼끝 위로 서며(칼자루 아래) 손이 오른 어깨 앞으로 · 빈손이 먼저 칼날을 타고 오름 · 칼 든 손은 뒤에 코등이까지
    //  ② 칼자루가 칼 든 쪽으로 눕고(칼끝은 왼쪽 아래) ③ 칼자루가 섬(시작 자세의 칼자루 쪽) — ②③ 동안 두 손이 함께 칼날의 끝 자리(G)로. 앞 면(상대 쪽)에서 옆으로 도는 뒤집기 —
    //  칼이 상대 몸 · 내 머리 쪽으로 휩쓸리지 않게. 끝 = 시작 자세 쪽으로 준비 토막(아래 pts[0])이 이어 받음
    const z = f.side ?? 1;
    const px = pts[0].px;
    const mk = (h, d) => ({ H: new THREE.Vector3(h[0], h[1], h[2] * z), D: new THREE.Vector3(d[0], d[1], d[2] * z).normalize(), px, pad: m.from });
    const gF = R.G.g;
    const oF = R.G.gOff;
    const dO = oF - gF; // 빈손은 칼 든 손보다 칼끝 쪽으로 이만큼
    const gM = (R.HL + gF) / 2;
    const T = R.T;
    const up = (M.trk?.base?.[0]?.D ?? pts[0].D).clone();
    push(mk([0.3, 0.12, 0.12], [0.1, -1, 0]), false, { T: T * 0.4, g: [R.g0, R.g0], o: [R.o0, R.HL + dO], ow: [0, 0.8], in: true }); // ① 반손 쥠: 칼 든 손은 손잡이 그대로 · 빈손이 칼날(코등이 위)로
    push(mk([0.3, 0.2, 0.1], [0.1, 0.05, 1]), false, { T: T * 0.3, g: [R.g0, R.HL], o: [R.HL + dO, R.HL + dO], gw: [0.2, 1], in: true }); // ② 칼자루가 옆으로 눕는 동안 칼 든 손이 코등이까지
    push({ ...mk([0.3, 0.3, 0.08], [0, 1, 0]), D: up.normalize() }, false, { T: T * 0.3, g: [R.HL, gF], o: [R.HL + dO, oF], in: true }); // ③ 칼자루가 서며 두 손이 함께 끝 쥠으로
  }
  const pre = segs.length; // 쥠 바꿈 토막 수 (없으면 0 — 아래 토막 번호는 지금 판 그대로)
  push(pts[0], false);
  for (let k = 1; k < pts.length; k++) push(pts[k], true);
  push({ ...home, back: true }, false);
  if (R) {
    // 다시 세우기 뒤 거꾸로 쥠 바꿈 (같은 시간 · 0.5 · 0.5): 칼자루가 칼 든 쪽으로 눕고 → 아래로(칼끝 곧게 위 — mordEnd 의 원래 쥠과 같은 자세) · 칼 든 손이 먼저 손잡이로 · 빈손이 뒤에 폼멜 쪽으로
    const z = f.side ?? 1;
    const gF = R.G.g;
    const dO = R.G.gOff - gF;
    const gM = (R.HL + gF) / 2;
    const h = home.H;
    push({ H: new THREE.Vector3(h.x - 0.02, h.y - 0.12, h.z), D: new THREE.Vector3(0.1, 0.05, z).normalize(), px: home.px, pad: home.pad }, false, { T: R.T * 0.5, g: [gF, gM], o: [R.G.gOff, gM + dO], out: true });
    push({ H: new THREE.Vector3(h.x - 0.04, h.y - 0.2, h.z), D: new THREE.Vector3(0, -1, 0), px: home.px, pad: home.pad, regripEnd: true }, false, { T: R.T * 0.5, g: [gM, 0], o: [gM + dO, R.o0], gw: [0, 0.7], ow: [0.3, 1], out: true });
  }
  M.pre = pre;
  if (M.trk) M.trk.seg = segs[pre + M.trk.k + 1]; // 겨눈 자리가 든 토막 (pts[k] → pts[k + 1])
  if (M.clip && I.slide?.keep) {
    // 내 머리 뚫음 막기 반걸음: 칼자루가 겨눈 자리에 닿는 때까지 다 물러남 (준비 토막 + 겨눈 토막 앞 토막들 + 겨눈 토막의 w 몫)
    let t = 0;
    for (let s = 0; s <= pre + M.clip.k && s < segs.length; s++) t += segs[s].T;
    I.slide.span = Math.max(1e-3, t + M.clip.w * (segs[pre + M.clip.k + 1]?.T ?? 0));
  }
  return segs;
}

/** 쥠 바꿈 토막의 u 자리 쥠 (칼 축 — 칼 든 손 g · 빈손 o): 토막의 창(gw · ow) 안에서 부드럽게 */
function regripAt(rg, u) {
  const e = (a, w) => {
    const x = clamp((u - (w?.[0] ?? 0)) / Math.max(1e-6, (w?.[1] ?? 1) - (w?.[0] ?? 0)), 0, 1);
    return a[0] + (a[1] - a[0]) * x * x * (3 - 2 * x);
  };
  return { g: e(rg.g, rg.gw), o: e(rg.o, rg.ow) };
}

/**
 * 쥠 바꿈 한 스텝 (10/31 시제품 — SECRET.mord.regrip · 기본 끔 · stepCombo 가 놓기 전에 부름): 쥠 바꿈 토막이면 그 자리 쥠으로 I.mord(g · gOff · Lc · Lp)를 옮기고
 *  (placeIai 가 칼 원점 = 손목 + 칼자루 쪽 × g · 빈손 = 손목 + 칼자루 쪽 × (g − gOff) 로 놓음 — g 0 이 원래 쥠), 들어가는 쥠 바꿈을 다 지난 첫 스텝에 몸의 쥠을 바꿈
 *  (fighter.reverseGrip — 칼이 이미 그 자세라 옮김 없음 · 손목 관절 · 밧줄 닻 · 손 기준 관성)
 */
function mordRegripStep(f, I, sg, u) {
  const M = I.mord;
  const R = M.regrip;
  let g = R.G.g;
  let o = R.G.gOff;
  if (sg.rg) ({ g, o } = regripAt(sg.rg, u));
  else if (!R.done) ({ g, o } = { g: R.g0, o: R.o0 }); // 아직 쥠 바꿈 앞(없음 — 쥠 바꿈 토막이 맨 앞)
  if (!R.done && !sg.rg?.in && I.segs.indexOf(sg) >= (M.pre ?? 0)) {
    g = R.G.g;
    o = R.G.gOff;
    const Dw = I.cur.D.clone().applyQuaternion(I.yaw).normalize();
    R.done = f.reverseGrip(R.G, Dw.negate()) || !!f.mordGrip;
    R.doneT = I.t;
  }
  M.g = g;
  M.gOff = o;
  M.Lc = g - R.HL;
  M.Lp = g - R.yp;
  // 손목 관절 닻도 같은 칼 축 자리로 (팔 · 칼은 스텝마다 놓이는 동역학 몸 — SECRET.iaiKinematic 0: 닻이 놓인 쥠과 어긋나면 관절이 팔 · 몸을 홱 당김)
  if (sg.rg && f.gripJoint) f.gripJoint.setAnchor2({ x: 0, y: g, z: 0 });
}

/**
 * 내 머리 뚫음 막기 (10/31 시제품 — 사장님 확인 전 · 기본 끔 SECRET.mord.noSelfClip · 확인표 3110 ~ 3116): 사장님 10/31 02:xx '가까이서 보면 팔이 나의 머리를 뚫고 뒤로 갔다가 다시 적을 강타하는 것처럼 보여'.
 *  까닭: 거꾸로 쥔 칼(at 0.6)의 칼자루 가운데가 손에서 (Lc + Lp)/2 ≈ 0.76 m(롱소드) — 지붕 자세 손(내 이마 앞 위)에서 휘두르면 그 점이 가슴 사이 약 1.05 m 의 머리를 지나는데,
 *   창은 가슴 사이 0.8 m 안이라 'pull' 이 길 전체를 0.3 ~ 0.8 m 뒤로 옮긴다 → 두 손이 내 머리 위 · 속(0.75 ~ 0.8 m) · 머리 뒤 목덜미(0.45 ~ 0.65 m)를 지나 내리친다.
 *  B = 옮기기 전 길(손 H · 칼자루 쪽 D — 몸 틀), (k, w) = 겨눈 자리(토막 k 의 w 몫), P = 상대 머리 가운데(몸 틀), r = 손 → 칼자루 가운데. 셋:
 *   ① 앞뒤 묶음: 옮긴 길의 두 손(칼 든 손 · 빈손 — 시작 자세 + 기술 길, 토막마다 8 조각)이 내 머리 가운데보다 몸 앞으로 SECRET.mord.clipX 밖에 있게 — 앞뒤 옮김(d.x)만 묶음 · 위아래 · 옆 그대로
 *   ② 기울임: 묶어서 못 옮긴 몫은 겨눈 자리의 칼자루 방향을 손 → 상대 머리 줄로 돌려 메움 — 길 전체 D 를 같은 돌림으로(손 자리 그대로) · 머리에 닿는 칼자루 자리 = 손 ~ 머리 거리
 *   ③ 반걸음 뒤로(mordClipPlan 만): 묶어서 못 옮긴 몫(앞뒤 m)을 SECRET.mord.clipStep 까지 몸을 상대 반대쪽으로 미끄러뜨려 메움(칼자루가 겨눈 자리에 닿는 때까지 — 1 − (1 − x)² 꼴 · 경기장 테두리 안)
 *  { d (손 옮김), q (D 돌림), short (못 옮긴 앞뒤 m — 걸음 앞), xMin }
 */
function mordClipSolve(f, I, B, k, w, P, r) {
  const M = I.mord;
  const X = SECRET.mord.clipX ?? 0.16;
  const Hh = tv(f.bodies.head.translation(), new THREE.Vector3()).sub(tv(f.bodies.chest.translation(), new THREE.Vector3())).applyQuaternion(I.yaw.clone().invert()); // 내 머리 가운데 (몸 틀)
  const off = (M.g ?? 0) - (M.gOff ?? 0); // 빈손 = 칼 든 손 + D × (g − gOff) — placeIai 와 같은 자리(거꾸로 쥐면 칼끝 쪽 −0.14)
  const Q = comboLerp({ A: B[k], B: B[k + 1] }, w);
  const d = P.clone().sub(Q.H.clone().addScaledVector(Q.D, r));
  const want = d.x;
  let xMin = -Infinity;
  for (let j = 0; j < B.length; j++) {
    const n = j + 1 < B.length ? 8 : 1;
    for (let i = 0; i < n; i++) {
      const S = j + 1 < B.length ? comboLerp({ A: B[j], B: B[j + 1] }, i / 8) : B[j];
      xMin = Math.max(xMin, X - (S.H.x - Hh.x), X - (S.H.x + S.D.x * off - Hh.x));
    }
  }
  if (d.x < xMin) d.x = xMin;
  const q = new THREE.Quaternion();
  if (d.x > want + 1e-4) {
    const u = P.clone().sub(Q.H.clone().add(d));
    if (u.lengthSq() > 1e-8) q.setFromUnitVectors(Q.D.clone().normalize(), u.normalize());
  }
  return { d, q, short: d.x - want, xMin };
}
function mordClipPut(pts, base, sol) {
  for (let j = 0; j < pts.length; j++) {
    pts[j].H.copy(base[j].H).add(sol.d);
    pts[j].D.copy(base[j].D).applyQuaternion(sol.q);
  }
}
function mordClipPlan(f, I, pts, base, k, w, P, r) {
  let sol = mordClipSolve(f, I, base, k, w, P, r);
  let s = Math.min(SECRET.mord.clipStep ?? 0, Math.max(0, sol.short));
  let e = null;
  let dir = -1; // −1 = 뒤로(못 옮긴 몫) · +1 = 앞으로(폼멜 찍기 — 팔이 안 닿는 몫)
  if (I.mord.pommel && s <= 1e-3) {
    // 폼멜 찍기 (10/31 시제품): 옮긴 길의 겨눈 자리 손이 칼 어깨에서 팔 길이(comboArmLen) 밖이면 그만큼 앞으로 반걸음(clipStep 까지 · 같은 미끄러짐 틀)
    const Q = comboLerp({ A: base[k], B: base[k + 1] }, w);
    const H = Q.H.clone().add(sol.d);
    const S = comboShoulder(f, I.yaw);
    const need = H.distanceTo(S) - comboArmLen();
    if (need > 1e-3) {
      s = Math.min(SECRET.mord.clipStep ?? 0, need);
      dir = 1;
    }
  }
  if (s > 1e-3 && f.foe) {
    const c = f.bodies.chest.translation();
    const fc = f.foe.bodies.chest.translation();
    let dx = fc.x - c.x;
    let dz = fc.z - c.z;
    const dl = Math.max(1e-3, Math.hypot(dx, dz));
    dx /= dl;
    dz /= dl;
    if (dir < 0 && Math.hypot(c.x - dx * s, c.z - dz * s) > ARENA.radius) s = Math.max(0, Math.min(s, ARENA.radius - Math.hypot(c.x, c.z))); // 경기장 테두리 (comboMoveStart 물러남과 같은 규칙)
    if (dir > 0) s = Math.min(s, Math.max(0, dl - (f.swordArt?.measure?.clinch ?? 0) * 0.5)); // 앞으로는 상대 몸을 뚫지 않게 (붙은 거리의 반까지)
    if (s > 1e-3) {
      e = new THREE.Vector3(dx, 0, dz).applyQuaternion(I.yaw.clone().invert()); // 몸 틀에서 상대 쪽 (물러나면 상대 머리가 이쪽으로 s 만큼 멀어짐)
      I.slide = { dx, dz, slide: dir * s, t0: I.t, span: 1, done: 0, keep: true }; // span 은 길을 다 짠 뒤 (comboPlanMord 끝)
      sol = mordClipSolve(f, I, base, k, w, P.clone().addScaledVector(e, -dir * s), r);
    } else s = 0;
  } else s = 0;
  mordClipPut(pts, base, sol);
  return { base, k, w, r, s, e, dir, short0: sol.short, d0: sol.d.clone(), tilt: (2 * Math.acos(Math.min(1, Math.abs(sol.q.w))) * 180) / Math.PI };
}

/**
 * 머리 따라 겨눔 (10/30 시제품 — 사장님 '모르트가 빗나가는 경우는 어떤거지? … 모르트의 적중은 실력이 아니라 그저 행운인가?' · SECRET.mord.track · 기본 끔):
 *  길을 짠 때 한 번만 머리에 맞추던('pull') 칼자루 길을, 칼자루 가운데가 겨눈 자리에 닿기 SECRET.mord.trackCommit 초 전까지 스텝마다 그때 머리(내 가슴 틀 — 내 몸이 밀려도)로 다시 옮긴다
 *  (trackUntil 'cut' 이면 베는 토막이 시작될 때까지만). 그 뒤는 고정 — 마지막 몫에 머리를 빼면 빗나감. 막힘 · 맞힘 · 다시 세우기면 멈춤. 옮김은 길 전체를 그대로 평행 이동(pull 과 같은 꼴)
 */
function mordTrack(f, I) {
  const T = I.mord.trk;
  if (T.done || !T.seg) return;
  if (T.tAim == null) {
    const j = I.segs.indexOf(T.seg);
    if (j < 0) return void (T.done = true);
    let t = I.segT0;
    for (let s = 0; s < j; s++) t += I.segs[s].T;
    T.tCut = I.segT0 + (I.segs[0]?.cut ? 0 : I.segs[0].T);
    if (I.mord.pre > 0) for (let s = 1; s < I.segs.length && !I.segs[s].cut; s++) T.tCut += I.segs[s].T; // 쥠 바꿈 토막 (10/31 시제품) 뒤 첫 베는 토막까지
    T.tAim = t + T.w * T.seg.T;
  }
  const until = SECRET.mord.trackUntil === 'cut' ? T.tCut : T.tAim - (SECRET.mord.trackCommit ?? 0);
  if (I.mordBacked || I.hitM || I.blockM || I.t >= until || !f.foe?.bodies.head) return void (T.done = true);
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const P = tv(f.foe.bodies.head.translation(), new THREE.Vector3()).sub(c).applyQuaternion(I.yaw.clone().invert());
  const C = I.mord.clip;
  if (C) {
    // 내 머리 뚫음 막기 (10/31 시제품 · 기본 끔): 같은 셈(묶음 · 기울임)을 그때 머리로 — 남은 반걸음만큼 상대 머리를 멀리 둔 자리(물러난 뒤의 자리)로 겨눔
    const rem = C.e && I.slide?.keep ? C.s - Math.abs(I.slide.done) : 0; // 남은 걸음 (뒤로면 상대 머리가 그만큼 멀어질 것 · 앞으로면 가까워질 것)
    const sol = mordClipSolve(f, I, T.base, T.k, T.w, rem > 0 ? P.clone().addScaledVector(C.e, -(C.dir ?? -1) * rem) : P, T.r);
    T.moved += T.pts[0].H.distanceTo(T.base[0].H.clone().add(sol.d));
    mordClipPut(T.pts, T.base, sol);
    C.short = sol.short;
    C.tiltMax = Math.max(C.tiltMax ?? 0, (2 * Math.acos(Math.min(1, Math.abs(sol.q.w))) * 180) / Math.PI);
    T.n++;
    return;
  }
  const Q = comboLerp({ A: T.base[T.k], B: T.base[T.k + 1] }, T.w);
  const delta = P.sub(Q.H.addScaledVector(Q.D, T.r));
  for (let j = 0; j < T.pts.length; j++) {
    const H = T.pts[j].H;
    if (j === 0) T.moved += H.distanceTo(T.base[0].H.clone().add(delta)); // 재기: 스텝마다 옮긴 거리 합
    H.copy(T.base[j].H).add(delta);
  }
  T.n++;
}

/** 죽음의 일격이 막혔을 때 (상대 칼이 칼자루 길에 먼저): 남은 베는 길을 건너뛰고 지금 자리에서 시작 자세로 곧장 (다시 세우기 — 맞힘 없음) */
function comboMordBack(f, I) {
  const last = I.segs[I.segs.length - 1];
  const sg = { cut: false, A: I.cur, B: last.B };
  sg.T = comboSegLen(f, sg, I.mord.Lp) / I.v;
  const R = I.mord.regrip;
  if (R?.done) {
    // 쥠 바꿈 (10/31 시제품): 지금 자리에서 원래 쥠(칼끝 위)으로 곧장 — 칼 든 손이 먼저 손잡이로 · 빈손이 뒤에 (시간 = 쥠 바꿈 시간 이상)
    sg.rg = { T: Math.max(sg.T, R.T), g: [I.mord.g, 0], o: [I.mord.gOff, R.o0], gw: [0, 0.7], ow: [0.3, 1], out: true };
    sg.T = sg.rg.T;
  }
  I.segs = [sg];
  I.si = 0;
  I.ts = I.t;
}

/** 몸 틀(발도 몸 틀 — 시작 yaw, 가슴 원점)의 칼 어깨 자리 (지금 가슴 기울기·돌림을 넣음) */
function comboShoulder(f, yaw) {
  const chest = f.bodies.chest;
  return new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(tq(chest.rotation(), new THREE.Quaternion())).applyQuaternion(yaw.clone().invert());
}

/** 칼 팔이 닿는 거리 — fighter.armIK 와 같은 끝 (비기 동안 SECRET.secretReach 면 위팔 + 아래팔, 아니면 평소 여유) · 10/24 모르트슐라크 AI 머리 닿음(mordschlag.js mordHeadReach)도 */
export function comboArmLen() {
  return ARM.upper + ARM.fore - (SECRET.secretReach ? 0 : ARM.slack);
}

/** 상대 몸통 선(가슴 → 골반 몸체 가운데) 두 끝을 몸 틀로 — 이 수의 반걸음 미끄러짐만큼 당겨 둔다(미끄러진 뒤의 자리) */
function comboTorso(f, I) {
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const inv = I.yaw.clone().invert();
  const sl = I.slide ? new THREE.Vector3(I.slide.dx * I.slide.slide, 0, I.slide.dz * I.slide.slide) : new THREE.Vector3();
  const at = (b) => tv(b.translation(), new THREE.Vector3()).sub(c).sub(sl).applyQuaternion(inv);
  return { a: at(f.foe.bodies.chest), b: at(f.foe.bodies.pelvis) };
}

/** 몸 틀 방향 (가로 각 ψ · 높이 각 ε, rad) */
function comboDir(psi, eps, out = new THREE.Vector3()) {
  return out.set(Math.cos(eps) * Math.cos(psi), Math.sin(eps), Math.cos(eps) * Math.sin(psi));
}

/**
 * 연환 길 그때 계산 (10/12 사장님 03:0x '막았다 칼이 떨어진 바로 그 순간에 상대 몸통과 가장 가까운 경로로 찌르고 … 그다음 베기는 찌른 곳에서 크게 호를 그리며(팔을 쭉 뻗어서)
 *  내 쪽으로 검을 회수' — docs/strike/cn_combo_play_2026-10-12.md §11):
 *  thrust — 지금 칼끝에서 상대 몸통 선(가슴~골반)의 가장 가까운 점으로 곧게: 손은 어깨 → 그 점 쪽으로 팔 길이까지(닿으면 그만큼만), 칼끝이 그 점까지(몸통 가운데 — 겉을 뚫음).
 *   칼끝을 곧은 줄로 옮기며 칼날은 손 → 칼끝 줄 (4 토막) · 모두 맞힘 토막. back 이면(마지막 수) 온 길로 뽑아 거둠 (맞힘 없음).
 *  draw — 팔을 쭉 뻗은 큰 호: 가로 각 = 상대 몸통 가운데 쪽 + side × yaw[0 → 1] · 높이 각 = 그 쪽 + el[0 → 1] (°, 6 토막). 손은 어깨에서 팔 길이(팔 방향 = 칼 방향의 반만 돎),
 *   마지막 ⅓ 은 손을 팔 길이의 0.75 까지 내 쪽으로 당기며 벤다(掣 — 당김). from 'stab' = 찌른 끝에서 곧장(이음 토막도 맞힘) · 'prep' = 호 첫 자리로 옮기는 이음 토막은 맞힘 없음.
 *   끝 = 호 끝(손을 당긴 자리 — 지킴 자세로 더 거두지 않음, 아래 까닭). 호의 각은 schools.js 에 [추정].
 */
function comboPlanDyn(f, I, m, A) {
  const D = m.dyn;
  if (D.kind === 'aim') return D.band === 'waist' ? waistAim(f, I, m, A, D) : comboPlanAim(f, I, m, A, D); // 격살 (10/22): 그 순간 상대 몸의 겨눌 곳으로 · 허리 띠(날개 접기 10/28)
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const Lb = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  const T = comboTorso(f, I);
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad }; // px: 날것 매핑 z = 0.1 + 패드 x 를 거꾸로 (몸 돌림)
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  if (D.kind === 'thrust') {
    const T0 = comboTip(f, A.H, A.D);
    const ab = T.b.clone().sub(T.a);
    const P = T.a.clone().addScaledVector(ab, clamp(T0.clone().sub(T.a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1)); // 가장 가까운 점
    const dir = P.clone().sub(S);
    const dist = dir.length();
    dir.normalize();
    const H1 = S.clone().addScaledVector(dir, clamp(dist - Lb, 0.15, Lf));
    const E = H1.clone().addScaledVector(dir, Lb);
    for (let k = 1; k <= 4; k++) {
      const H = A.H.clone().lerp(H1, k / 4);
      const t = T0.clone().lerp(E, k / 4);
      const Dv = t.sub(H);
      push(H, Dv.lengthSq() > 1e-6 ? Dv.normalize() : dir.clone(), true);
    }
    if (D.back) push(A.H.clone(), A.D.clone(), false, comboPad(A.H)); // 마지막 수가 찌름이면 온 길로 뽑아 거둔다 (맞힘 없음 — 칼이 몸통 가운데에 꽂힌 채 경직 붙잡기에 들지 않게)
    return segs;
  }
  // draw — 큰 호
  const mid = T.a.clone().add(T.b).multiplyScalar(0.5);
  const Dc = mid.sub(S).normalize();
  const psi0 = Math.atan2(Dc.z, Dc.x);
  const eps0 = Math.asin(clamp(Dc.y, -1, 1));
  const N = 6;
  const pull = D.pull !== false; // 10/12 3 연격: pull false = 손을 당기지 않고 뻗은 채 끝냄 (다음 벰이 그 자리에서 곧장 이어짐)
  if (D.from === 'roll') {
    // 10/12 3 연격 滾手 (검결가 「滾手連環」): 앞 수 끝(찌른 칼끝은 몸통 안)에서 손목을 굴려 칼끝을 들며 호 첫 자리 바깥으로 — 맞힘 없음.
    //  (전 두 수의 벰은 찌른 칼끝에서 곧장 맞힘 토막으로 시작해 몸 안에서 첫 맞닿음이 잡혀 16 J 에 그쳤다 — 이제 바깥에서 들어와 몸을 가로지른다)
    const pa = Math.atan2(A.D.z, A.D.x);
    const ea = Math.asin(clamp(A.D.y, -1, 1));
    const ps = psi0 + D.side * D.yaw[0] * D2R;
    const es = eps0 + D.el[0] * D2R;
    const pm = 0.5 * (pa + ps);
    const em = Math.max(ea, es) + (D.roll ?? 0) * D2R;
    push(S.clone().addScaledVector(comboDir(psi0 + 0.5 * (pm - psi0), eps0 + 0.5 * (em - eps0)), Lf), comboDir(pm, em), false);
  }
  for (let j = 0; j <= N; j++) {
    const w = j / N;
    const psi = psi0 + D.side * (D.yaw[0] + (D.yaw[1] - D.yaw[0]) * w) * D2R;
    const eps = eps0 + (D.el[0] + (D.el[1] - D.el[0]) * w) * D2R;
    const r = Lf * (!pull || w <= 2 / 3 ? 1 : 1 - 0.25 * ((w - 2 / 3) / (1 / 3)));
    const H = S.clone().addScaledVector(comboDir(psi0 + 0.5 * (psi - psi0), eps0 + 0.5 * (eps - eps0)), r);
    push(H, comboDir(psi, eps), j > 0 || D.from === 'stab', j === N ? comboPad(H) : null);
  }
  return segs; // 끝 = 호 끝(손을 당긴 자리, 칼은 상대 몸 옆 밖). 지킴 자세(긴 자세)로 더 거두면 칼끝이 상대를 겨눠 가까운 거리에서 몸통에 꽂힌 채 붙잡혔다(48 판 상처 최대 811 J)
}

/**
 * 격살 겨눌 곳 (10/22 — schools.js CHINESE_SECRET_GYEOKSAL dyn.target): 몸 틀(시작 yaw · 가슴 원점 · 이 수의 반걸음만큼 당김 — comboTorso 와 같음)의 점 { P, part }.
 *  head = 머리 가운데에서 목 쪽으로 (가슴 → 머리 사이 0.8 — 목 점 0.6(lethalPath)과 머리 사이 · 「上殺」 머리 · 목) ·
 *  arm = 칼 든 팔꿈치(아래팔 관절) — 절단은 관절 곁 0.11 m 안 베기만(COMBAT.limbSeverRadius) · 「削殺兩手」 ·
 *  leg = 나에게 가까운 다리의 무릎(정강이 관절) · 「下殺」 · lung = 가슴 몸체 가운데 0.05 m 위(허파 — 0.11 m 위부터는 목) · 「刺」. 자리 [추정]
 */
function comboAimPoint(f, I, target) {
  const foe = f.foe;
  const B = foe.bodies;
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const inv = I.yaw.clone().invert();
  const sl = I.slide ? new THREE.Vector3(I.slide.dx * I.slide.slide, 0, I.slide.dz * I.slide.slide) : new THREE.Vector3();
  const at = (w) => w.clone().sub(c).sub(sl).applyQuaternion(inv);
  const W = (b) => tv(b.translation(), new THREE.Vector3());
  const jointW = (child, own) => {
    const J = foe.jointByName?.[child]?.joint;
    const body = own ? B[child] : B[{ farmS: 'uarmS', farmO: 'uarmO', shinF: 'thighF', shinB: 'thighB' }[child]];
    if (!J || !body) return null;
    const a = own ? J.anchor2() : J.anchor1();
    return new THREE.Vector3(a.x, a.y, a.z).applyQuaternion(tq(body.rotation(), new THREE.Quaternion())).add(W(body));
  };
  if (target === 'head' && B.head) return { P: at(W(B.chest).lerp(W(B.head), 0.8)), part: 'head' };
  if (target === 'waist' && B.abdomen) return { P: at(W(B.abdomen)), part: 'waist' }; // 허리 (날개 접기 10/28 '허리(배 · 골반)를'): 배 몸체 가운데
  if (target === 'arm' && B.farmS) {
    const e = jointW('farmS', false) ?? W(B.farmS); // 팔꿈치 — 절단은 관절 곁 0.11 m 안(COMBAT.limbSeverRadius): 아래팔 가운데를 겨누면 관절에서 0.15 ~ 0.17 m 라 잘리지 않았다(탐침)
    return { P: at(e), part: 'arm' };
  }
  if (target === 'leg') {
    let best = null;
    for (const k of ['shinF', 'shinB']) {
      if (foe.detachedParts?.has(k)) continue;
      const q = jointW(k, false);
      if (q && (!best || Math.hypot(q.x - c.x, q.z - c.z) < Math.hypot(best.x - c.x, best.z - c.z))) best = q;
    }
    if (best) return { P: at(best), part: 'leg' }; // 무릎 — 넓적다리 가운데와 무릎 사이를 겨누면 관절에서 0.18 m 라 잘리지 않았다(탐침)
  }
  const up = new THREE.Vector3(0, 0.05, 0); // 가슴 몸체 가운데에서 0.05 m 위 — 허파 (가슴 몸체 0.11 m 위부터는 목 — combat.js zoneOf · [추정])
  return { P: at(W(B.chest)).add(up), part: 'lung' }; // lung · 또는 겨눌 곳이 없어짐(이미 잘림) — 가슴
}

/**
 * 격살 한 칼의 길 (10/22): 겨눌 곳 P 를 지나도록 짠다.
 *  thrust — 어깨 → P 줄 위로 칼을 끌어 겨눈 뒤(맞힘 없음) 그 줄을 따라 곧게 찌름(손은 팔 길이까지 · 칼끝이 P 까지 · 4 토막 맞힘) + back(겨눈 자리로 뽑아 거둠, 맞힘 없음)
 *  벰 — 연환 'draw' 와 같은 큰 호(가로 각 side × yaw · 높이 각 el, 6 토막 · 마지막 ⅓ 은 손을 당겨 벰)인데 가운데 줄이 상대 몸통이 아니라 P 이고,
 *   손 거리 r 은 칼날 dyn.at(기본 0.6) 자리가 P 에 오게(칼자루 + 칼날 × at 을 뺀 거리 — [0.15, 팔 길이] 로 자름 · 비율 [추정]). from 'prep' = 호 첫 자리로 옮기는 이음 토막은 맞힘 없음.
 */
/**
 * 날개 접기 허리 호 (사장님 10/28 00:3x '허리(배 · 골반)를 … 실제로 닿게' — requestArtFold · D.band 'waist'): 격살 한 칼의 가로 호(comboPlanAim)를 겨눈 곳(배 몸체 가운데)으로 짜고,
 *  그 길을 미리 끌고 가 보아(bandFirstSegs — stepCombo 와 같은 스텝 · 미끄러짐 · 날 세우기 · 손목 교정) 처음 닿을 곳이 허리 띠(배 · 골반) 밖이면 겨눈 곳 높이를 가장 적게 옮긴다
 *  (제비 베기 몸통 띠 comboBandShift 와 같은 규칙 · 같은 칸 BAND_STEP · BAND_MAX — 가슴 · 목 · 머리면 아래로 · 다리면 위로 · 팔(띠 앞을 막음)이면 위아래 가까운 쪽 먼저 · 안 나오면 다리 · 가슴 위를 비킨 가장 적은 옮김 · 안 닿으면 그대로).
 *  재기: I.bandDy (m) · I.bandFrom · I.bandTo
 */
function waistAim(f, I, m, A, D) {
  const base = comboAimPoint(f, I, D.target);
  const sl = I.slide && I.slide.slide > 0 ? I.slide : null;
  const plan = (dy) => {
    const P = base.P.clone().add(new THREE.Vector3(0, dy, 0)); // 몸 틀 위쪽 = 세상 위쪽 (yaw 만)
    return comboPlanAim(f, I, m, A, D, { P, part: base.part });
  };
  const first = (segs) => {
    if (!sl) return bandFirstSegs(f, I, segs);
    // comboNext 의 그때 계산 길 늘림과 같은 셈: 칼끝 길이 + 미끄러짐 만큼 시간을 늘리고 그 동안 미끄러짐
    const span = segs.reduce((a, sg) => a + sg.T, 0);
    const k = span > 0 ? (span * I.v + sl.slide) / (span * I.v) : 1;
    const S2 = segs.map((sg) => ({ ...sg, T: sg.T * k }));
    return bandFirstSegs(f, I, S2, { dx: sl.dx, dz: sl.dz, slide: sl.slide, span: Math.max(1e-3, span * k) });
  };
  const cls = (h) => (!h ? null : BAND_LEG.has(h.part) ? 'leg' : h.part === 'head' || h.part === 'chest' ? 'high' : h.part === 'pelvis' || h.part === 'abdomen' ? 'torso' : 'arm');
  const s0 = plan(0);
  const h0 = first(s0);
  const c0 = cls(h0);
  I.bandDy = 0;
  I.bandFrom = I.bandTo = h0?.part ?? null;
  if (!c0 || c0 === 'torso') return s0;
  const dirs = c0 === 'leg' ? [1] : c0 === 'high' ? [-1] : [1, -1];
  let side = null;
  for (let k = 1; k <= BAND_MAX; k++) {
    for (const sg of dirs) {
      const dy = sg * BAND_STEP * k;
      const P = plan(dy);
      const h = first(P);
      const c = cls(h);
      if (c === 'torso') {
        I.bandDy = dy;
        I.bandTo = h.part;
        return P;
      }
      if (c === 'arm' && c0 !== 'arm' && !side) side = { dy, P, part: h.part };
    }
  }
  if (side) {
    I.bandDy = side.dy;
    I.bandTo = side.part;
    return side.P;
  }
  return s0;
}

function comboPlanAim(f, I, m, A, D, at0 = null) {
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const { P, part } = at0 ?? comboAimPoint(f, I, D.target);
  I.aim = part;
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad };
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  const dc = P.clone().sub(S);
  const dist = dc.length();
  dc.normalize();
  if (D.thrust && SECRET.thrustArm) {
    // 10/24 15:5x 팔을 뻗은 찌름 (SECRET.thrustArm 1 — 사장님 '주먹 아래쪽으로 칼날이 향하도록 거꾸로 쥐고 있는 거 같은데?' · docs/strike/wrist_audit_2026-10-24.md):
    //  손을 어깨 → P 줄 위 팔 길이(Lf — 팔꿈치 곧게)에 두고 칼을 그 줄 = 곧게 편 아래팔의 연장으로 (카포 페로 · 파브리스 런지 도판: 맞히는 순간 칼 팔이 어깨 높이로 다 펴지고 팔과 칼이 한 줄).
    //  옛 길(아래 — `?thrustArm=0`)은 칼끝이 꼭 P 에 닿게 손을 어깨에서 dist − 칼 길이(맞닿기 거리에서 0.1 ~ 0.5 m) · 뽑아 붙잡는 자리는 다시 D.draw 만큼 어깨 쪽(0.1 ~ 0.2 m)에
    //  두고 칼은 같은 어깨 → P 줄로 눕혔다 — 팔꿈치가 굽은 채 칼이 어깨 → 손 줄을 따르면 칼은 늘 아래팔의 새끼 쪽으로, 굽은 팔 세모의 손 쪽 각만큼(팔 길이 18 ~ 37 % 면 75 ~ 85°) 꺾인다 = 거꾸로 쥔 꼴.
    //  찌름 = 손이 팔 길이 − D.draw 에서 팔 길이까지 그 줄을 따라 곧게 (칼끝 길이 D.draw 그대로 · 4 토막 맞힘) — 칼끝은 P 를 팔 길이 + 칼 길이 − dist 만큼 지난다(맞닿기 거리에서 0 ~ 0.15 m).
    //  back 이어도 뽑지 않고 다 뻗은 자리를 굳음 동안 붙잡는다(런지 · 맞힌 뒤 팔을 뻗은 채) — 뽑던 토막 자리에 같은 시간(D.draw ÷ 빠르기 — 옛 뽑음과 같은 칼끝 길이)만큼
    //  뻗은 채 머무는 토막(맞힘 없음)을 두고 그 손의 패드(굳음 뒤 손 목표)를 단다: 길 전체 시간이 옛 길과 같아야 몸 미끄러짐을 그 시간에 나눠 싣는 셈(comboNext)이
    //  찌르는 토막 칼끝 빠르기(고노센 × risolutoShare)를 옛 길과 같게 둔다 (머무는 토막을 빼면 간격을 아는 운전 30 판 칼끝 몫 p50 0.97 → 0.92). 새 수 없음
    const H1 = S.clone().addScaledVector(dc, Lf);
    const H0 = S.clone().addScaledVector(dc, Math.max(0.1, Lf - (D.draw ?? 0.35)));
    push(H0, dc.clone(), false);
    for (let k = 1; k <= 4; k++) push(H0.clone().lerp(H1, k / 4), dc.clone(), true);
    if (D.back) {
      push(H1.clone(), dc.clone(), false, comboPad(H1));
      segs[segs.length - 1].T = (D.draw ?? 0.35) / I.v; // 같은 자리 토막은 칼끝 길이 0 — 옛 뽑음 토막의 시간
    }
    I.overshoot = Lf + HL + BL - dist; // 재기 (판정에는 안 씀): 칼끝이 겨눈 곳을 지난 길이 (m)
    return segs;
  }
  if (D.thrust) {
    // 겨눔 (맞힘 없음): 칼을 어깨 → P 줄 위에 눕혀 칼끝이 P 앞 D.draw(0.35 m) 에 오게 끌어 둔다 → 찌름: 그 줄을 따라 곧게 (칼끝이 P 까지 — 몸 안, 겉을 뚫음 · 4 토막 맞힘).
    //  (지금 칼끝에서 곧장 찌르면 막은 자리에서 칼날이 상대 팔을 먼저 가로질러 찌르기가 아닌 벰으로 닿았다 — 탐침)
    const H1 = S.clone().addScaledVector(dc, clamp(dist - HL - BL, 0.15, Lf));
    const H0 = S.clone().addScaledVector(dc, clamp(dist - HL - BL - (D.draw ?? 0.35), 0.1, Lf));
    push(H0, dc.clone(), false);
    for (let k = 1; k <= 4; k++) push(H0.clone().lerp(H1, k / 4), dc.clone(), true);
    if (D.back) push(H0.clone(), dc.clone(), false, comboPad(H0));
    return segs;
  }
  const psi0 = Math.atan2(dc.z, dc.x);
  const eps0 = Math.asin(clamp(dc.y, -1, 1));
  const r0 = clamp(dist - HL - BL * (D.at ?? 0.6), 0.15, Lf); // 칼날 D.at 자리가 겨눈 곳에 오게 (넘어선 칼날이 뒤의 몸을 먼저 건드리지 않게 — 끝 쪽)
  const N = 6;
  for (let j = 0; j <= N; j++) {
    const w = j / N;
    const psi = psi0 + D.side * (D.yaw[0] + (D.yaw[1] - D.yaw[0]) * w) * D2R;
    const eps = eps0 + (D.el[0] + (D.el[1] - D.el[0]) * w) * D2R;
    const r = r0 * (w <= 2 / 3 ? 1 : 1 - 0.25 * ((w - 2 / 3) / (1 / 3)));
    const H = S.clone().addScaledVector(comboDir(psi0 + 0.5 * (psi - psi0), eps0 + 0.5 * (eps - eps0)), r);
    push(H, comboDir(psi, eps), j > 0 || D.from === 'stab', j === N ? comboPad(H) : null);
  }
  return segs;
}

/**
 * 사람 풍차 베기 한 칼의 길 (B4 레돈두 — 사장님 10/29 · config UNIQUE_ASSIST.rdArc · requestArtRedondo): 피게이레두 복합 규칙 2 「칼을 머리 위로 넘겨 어깨 뒤로 보내, 왼팔 위로 떨어뜨리며 둘러 벤다」 [원문 영역 · 길은 해석].
 *  ① 넘김(맞힘 없음): 지금 자리(머리 위에서 돌던 칼) → 왼 어깨 뒤(m.rd.arc.chamber — 이베리아 자세표 '왼 어깨 지붕' 손 · 칼 그대로 · 레베스 준비).
 *  ② 떨어뜨림(맞힘 없음): 왼 어깨 뒤 → 호 첫 자리(겨눈 곳 줄에서 반대쪽(왼) 위) — 칼이 왼팔 위로 넘어온다.
 *  ③ 벰(맞힘): 격살 한 칼 comboPlanAim 과 같은 틀의 큰 호 — 어깨 → 겨눈 곳(상대 가슴 위 'lung' 점) 줄에서 가로 yaw[0] → yaw[1] °(칼 든 쪽 + — 왼 → 오른 · 레베스) · 높이 el[0] → el[1] °(조금 내려 비스듬히) ·
 *   칼날 at 자리가 겨눈 곳에 오게 손 거리 · 마지막 ⅓ 은 손을 당김. 몸은 곧게(덧씌우기 몸 = 손 쪽 몸 돌림 — 싱지르의 온몸 한 바퀴가 아님)
 */
function comboPlanRd(f, I, m, A) {
  if (m.rd.tajo) return comboPlanRdTajo(f, I, m, A); // 10/31 19:xx B4 멘 어깨에서 내려침 (rdRelease 'tajo' — 아래)
  if (m.rd.diag) return comboPlanRdDiag(f, I, m, A); // 10/30 곧장 사선 내려침 (rdRelease 'direct' — 아래)
  const R = m.rd.arc;
  const s = f.side >= 0 ? 1 : -1;
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad };
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  // ① 왼 어깨 뒤 (자세표 칸 꼴 — 손 [앞, 위, 칼 든 쪽] · 칼 [높이 °, 가로 °])
  const C = R.chamber;
  const ce = C.blade[0] * D2R;
  const ca = C.blade[1] * D2R;
  // ⓪ 칼이 아직 머리 위에 없으면(감기 섞는 첫 0.2 s 안에 뗌 — 칼이 앞 · 아래) 먼저 머리 위로 (10/29 몸 검사: 곧장 어깨 뒤로 slerp 하면 칼날이 제 배 · 가슴 · 머리를
  //  최대 10 cm 지나감 — 원전 '머리 위로 넘겨 어깨 뒤로') · 머리 위 자리 = 감는 길(rdLoop)의 이마 앞 위 손 · 어깨 뒤 쪽(chamber 가로 각)으로 cone ° 기운 칼 · 맞힘 없음 · 같은 빠르기
  const L = m.rd.loop;
  if (L && A?.D && A.D.y < (R.overY ?? 0.75)) {
    const b = L.cone * D2R;
    push(new THREE.Vector3(L.hand[0], L.hand[1], s * L.hand[2]), new THREE.Vector3(Math.sin(b) * Math.cos(ca), Math.cos(b), s * Math.sin(b) * Math.sin(ca)), false);
  }
  push(new THREE.Vector3(C.hand[0], C.hand[1], s * C.hand[2]), new THREE.Vector3(Math.cos(ce) * Math.cos(ca), Math.sin(ce), s * Math.cos(ce) * Math.sin(ca)), false);
  // ③ 호 (② 는 그 첫 자리로)
  const { P, part } = comboAimPoint(f, I, R.target ?? 'lung');
  I.aim = part;
  const dc = P.clone().sub(S);
  const dist = dc.length();
  dc.normalize();
  const psi0 = Math.atan2(dc.z, dc.x);
  const eps0 = Math.asin(clamp(dc.y, -1, 1));
  const r0 = clamp(dist - HL - BL * (R.at ?? 0.7), 0.15, Lf);
  const N = 6;
  const arc = (w) => {
    const psi = psi0 + s * (R.yaw[0] + (R.yaw[1] - R.yaw[0]) * w) * D2R;
    const eps = eps0 + (R.el[0] + (R.el[1] - R.el[0]) * w) * D2R;
    const r = r0 * (w <= 2 / 3 ? 1 : 1 - 0.25 * ((w - 2 / 3) / (1 / 3)));
    return { H: S.clone().addScaledVector(comboDir(psi0 + 0.5 * (psi - psi0), eps0 + 0.5 * (eps - eps0)), r), D: comboDir(psi, eps) };
  };
  const a0 = arc(0);
  push(a0.H, a0.D, false); // ② 왼팔 위로 떨어뜨림
  for (let j = 1; j <= N; j++) {
    const a = arc(j / N);
    push(a.H, a.D, true, j === N ? comboPad(a.H) : null);
  }
  return segs;
}

/**
 * 사람 풍차 베기 곧장 사선 내려침 (사장님 10/30 00:1x '근데 궤적이 8자 모양으로 현란해 보이는데. 바로 내려치는 게 아닌가?' · config UNIQUE_ASSIST.rdRelease 'direct' · rdDiag ·
 *  기록 docs/strike/redondo_hold_2026-10-29.md §8-9): 머리 위에서 돌던 칼을 그 자리에서 곧장 왼 위로 들어(맞힘 없음 · 한 토막) 왼 위 → 오른 아래 한 면으로 내려 벤다(맞힘 · 6 토막).
 *  10/29 판(위 comboPlanRd — 왼 어깨 뒤로 넘겨 왼팔 위로 떨어뜨림)은 머리 위 원 뒤에 어깨 뒤 고리가 하나 더 붙어 칼끝 길이 8 자였다(위에서 본 칼끝 — 기록 §8-9).
 *  면 = 어깨 S → 겨눈 곳 P 줄 dc · 그에 수직인 '왼 위' u (칼 안 든 쪽 가로에서 하늘 쪽으로 angle ° — 벰 면이 땅과 이루는 각 · 10/30 01:3x 사장님 60) — 칼 D(θ) = dc cos θ + u sin θ (θ = from → to °) ·
 *  손 = S + r · (dc cos θ/2 + u sin θ/2) (칼날 at 자리가 P 에 오는 r — 격살 한 칼 comboPlanAim 과 같은 틀 · 마지막 ⅓ 에 pull 몫만큼 당김 — 기본 0 끝까지 뻗음). 칼이 아직 머리 위에 없으면(섞는 첫머리) 먼저 그 가로 쪽으로 세운다
 */
function comboPlanRdDiag(f, I, m, A) {
  const R = m.rd.diag;
  const s = f.side >= 0 ? 1 : -1;
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad };
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  const { P, part } = comboAimPoint(f, I, R.target ?? 'lung');
  I.aim = part;
  const dc = P.clone().sub(S);
  const dist = dc.length();
  dc.normalize();
  const an = (R.angle ?? 45) * D2R; // 벰 면이 땅과 이루는 각 (90 = 곧게 내려침 · 0 = 가로)
  const u = new THREE.Vector3(0, Math.sin(an), -s * Math.cos(an));
  u.addScaledVector(dc, -u.dot(dc)).normalize();
  const r0 = clamp(dist - HL - BL * (R.at ?? 0.7), 0.15, Lf);
  const pose = (w) => {
    const th = (R.from + (R.to - R.from) * w) * D2R;
    const r = r0 * (w <= 2 / 3 ? 1 : 1 - (R.pull ?? 0.25) * ((w - 2 / 3) / (1 / 3)));
    const Hd = dc.clone().multiplyScalar(Math.cos(th / 2)).addScaledVector(u, Math.sin(th / 2));
    return { H: S.clone().addScaledVector(Hd, r), D: dc.clone().multiplyScalar(Math.cos(th)).addScaledVector(u, Math.sin(th)).normalize() };
  };
  const p0 = pose(0);
  const L = m.rd.loop;
  if (L && A?.D && A.D.y < (R.lowY ?? 0.35)) {
    // 섞는 첫머리에 뗌 (칼이 아직 앞 · 아래): 감는 고리의 손 · 지금 칼 가로 쪽으로 cone ° 기운 칼로 먼저 세움 (곧장 왼 위로 slerp 하면 칼날이 제 몸 앞을 가로지름)
    const b = L.cone * D2R;
    const h = Math.hypot(A.D.x, A.D.z);
    const cx = h > 1e-3 ? A.D.x / h : 1;
    const cz = h > 1e-3 ? A.D.z / h : 0;
    push(new THREE.Vector3(L.hand[0], L.hand[1], s * L.hand[2]), new THREE.Vector3(Math.sin(b) * cx, Math.cos(b), Math.sin(b) * cz), false);
  }
  push(p0.H, p0.D, false); // 든 자리 (왼 위)
  const N = 6;
  for (let j = 1; j <= N; j++) {
    const p = pose(j / N);
    push(p.H, p.D, true, j === N ? comboPad(p.H) : null);
  }
  return segs;
}

/**
 * B4 멘 어깨에서 내려침 (사장님 10/31 19:xx '온몸으로 대검의 힘을 응축해서 … 강하고 재빠르게 치는 일격' · '45도~90도 사이로 … 살짝 사선이어야 어깨에 얹고 있다가 치는 게 자연스럽고' —
 *  config UNIQUE_ASSIST.rdRelease 'tajo' · rdTajo · 기록 docs/strike/b4_rework_2026-10-31.md §3): 칼 든 어깨에 멘 칼(칼끝 뒤 아래 — iberian_redondo.js 'load')을 머리 위로 들어(맞힘 없음 · 한 토막)
 *  멘 쪽 위 → 반대쪽 아래 한 면으로 내려 벤다(맞힘 · 6 토막). 틀은 곧장 사선(comboPlanRdDiag)과 같고 u 가 칼 **든** 쪽(멘 어깨) 가로에서 하늘 쪽으로 angle ° — 탈류(오른 위 → 왼 아래).
 *  드는 토막은 멘 칼에서 θ = from 자리로 곧장(칼끝이 뒤 아래 → 뒤 → 위 · 손은 어깨 앞 위로) — 어깨 뒤로 더 내리는 고리 없음. 섞는 첫머리에 떼어 칼이 아직 앞 · 아래면(칼 앞 성분 > 0 · 위 성분 < lowY)
 *  먼저 감는 고리 손 자리로 세운다(rdDiag 와 같음).
 */
function comboPlanRdTajo(f, I, m, A) {
  const R = m.rd.tajo;
  const s = f.side >= 0 ? 1 : -1;
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad };
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  const { P, part } = comboAimPoint(f, I, R.target ?? 'lung');
  I.aim = part;
  const dc = P.clone().sub(S);
  const dist = dc.length();
  dc.normalize();
  const an = (R.angle ?? 75) * D2R; // 벰 면이 땅과 이루는 각 (90 = 곧게 내려침 · 45 = 사선)
  const u = new THREE.Vector3(0, Math.sin(an), s * Math.cos(an)); // 칼 든 쪽(멘 어깨) 위 — 곧장 사선(rdDiag)의 −s 와 반대
  u.addScaledVector(dc, -u.dot(dc)).normalize();
  const r0 = clamp(dist - HL - BL * (R.at ?? 0.7), 0.15, Lf);
  const pose = (w) => {
    const th = (R.from + (R.to - R.from) * w) * D2R;
    const r = r0 * (w <= 2 / 3 ? 1 : 1 - (R.pull ?? 0) * ((w - 2 / 3) / (1 / 3)));
    const Hd = dc.clone().multiplyScalar(Math.cos(th / 2)).addScaledVector(u, Math.sin(th / 2));
    return { H: S.clone().addScaledVector(Hd, r), D: dc.clone().multiplyScalar(Math.cos(th)).addScaledVector(u, Math.sin(th)).normalize() };
  };
  const p0 = pose(0);
  const L = m.rd.loop;
  if (L && A?.D && A.D.x > 0 && A.D.y < (R.lowY ?? 0.35)) {
    // 섞는 첫머리에 뗌 (칼이 아직 앞 · 아래): 감는 고리의 손 · 지금 칼 가로 쪽으로 cone ° 기운 칼로 먼저 세움 (곧장 들면 칼날이 제 몸 앞을 가로지름)
    const b = L.cone * D2R;
    const h = Math.hypot(A.D.x, A.D.z);
    const cx = h > 1e-3 ? A.D.x / h : 1;
    const cz = h > 1e-3 ? A.D.z / h : 0;
    push(new THREE.Vector3(L.hand[0], L.hand[1], s * L.hand[2]), new THREE.Vector3(Math.sin(b) * cx, Math.cos(b), Math.sin(b) * cz), false);
  }
  const lead0 = segs.length;
  push(p0.H, p0.D, false); // 든 자리 (멘 쪽 위)
  // 드는 몫 빠르기 배 (rdTajo.liftK — 1 = 벰과 같은 칼끝 빠르기): 맞힘 없는 드는 토막만 · 벰 칼끝 빠르기(specialShare)는 그대로
  if ((R.liftK ?? 1) > 0 && (R.liftK ?? 1) !== 1) for (let k = lead0; k < segs.length; k++) segs[k].T /= R.liftK;
  const N = 6;
  for (let j = 1; j <= N; j++) {
    const p = pose(j / N);
    push(p.H, p.D, true, j === N ? comboPad(p.H) : null);
  }
  return segs;
}

/**
 * 사람 칼끝 돌려 빼기 한 칼의 길 (I9 — 사장님 10/28 00:5x 'cavazione … 칼끝을 빼 돌리고 조이며 나아가, 가슴을 찔러라' — config UNIQUE_ASSIST.cavSnap · requestArtThrust):
 *  몸 틀(시작 yaw · 가슴 원점)에서 겨눌 곳 P = 목 아래 ~ 가슴 위 띠: 상대 가슴 몸체 틀에서 가운데 0.05 m 위(리솔루토 런지 · 격살 허파 찌르기 'lung' 점과 같은 높이를 그 몸 틀로 —
 *   숙인 몸이면 세상 위쪽 0.05 m 가 목 경계(몸 틀 0.11 m — combat.js zoneOf)에 가까워져 목으로 셈됐다).
 *  찌르는 줄(칼 방향 dc · 찌르는 동안 그대로 — 칼 축으로 곧게 = 찌르기): 팔을 다 편 손 H1(어깨에서 comboArmLen)에서 P 로 · 팔 ↔ 칼 꺾임 = 사람 손목 척측 한도(HUMAN.ulnarDev 30°)가 되게
 *   어깨 → P 줄에서 팔을 φ 만큼 '비킨 쪽'(상대 칼이 없는 쪽 — 상대 칼 날 선분이 어깨 → P 줄에서 비킨 쪽의 반대 · 상대 칼이 없으면 지금 손 쪽)으로 든다 (φ + 칼이 줄에서 내려가는 각 = 30°).
 *   다 뻗은 칼끝이 P 를 지나는 길이 = 칼 길이 − |P − H1| (가까우면 + — 리솔루토 팔을 뻗은 찌름과 같음) · 모자라면(멀면) 그만큼 런지(아래 — 이탈리아 찌르기 THRUST.itLunge 와 같은 뜻 · THRUST.step 까지).
 *  토막: 돌려 빼기(맞힘 없음 — 손은 그대로 · 칼끝을 맞물린 상대 칼 밑으로: 지금 칼끝에 가장 가까운 상대 칼 자리에서 막힘 거리 + 닿음 거리만큼 아래) → 겨눔(맞힘 없음 — 찌름 시작: 끝 손에서 줄을 따라
 *   draw + 지나는 길이 뒤 · 손이 어깨에서 아래팔 길이까지만) → 찌름(줄을 따라 곧게 4 토막 · 맞힘 · 막힘) → 뻗은 채 둠(탭 찌르기 버팀 THRUST.hold · 맞힘 없음) → 찌름 시작 자리로 거둠(맞힘 없음 ·
 *   손 목표는 손가락 그대로 — 끝 자세에서 0.2 s 에 서보로). draw = 탭 찌르기 당김 THRUST.chamber(0.22 m). 새 수 없음.
 *  손목: 맞는 때 팔이 거의 펴져 있게(다 뻗은 손에서 칼끝이 P 언저리) + 아래팔을 칼 줄에 맞추는 팔꿈치(fighter.js armIK alignDir — 어깨 → 손 줄 위로 들지 않게) + 칼 면 손 면 찾기(iaiSolve plane)
 */
function comboPlanArtThrust(f, I, m, A) {
  const D = m.dyn;
  const S = comboShoulder(f, I.yaw);
  const L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  const draw = D.draw ?? THRUST.chamber; // 찌름 길이 = 탭 찌르기가 칼 선 뒤로 당겼다 뻗는 길이(THRUST.chamber 0.22 m)
  const Lf = comboArmLen();
  const beta = (f.ulnarMax ? f.ulnarMax() : 30) * D2R; // 팔 ↔ 칼 꺾임 = 사람 손목 척측 한도(HUMAN.ulnarDev) — 팔꿈치를 내린 채 손목만으로 칼끝을 비키는 끝
  const inv = I.yaw.clone().invert();
  const c0 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const body = (w) => w.clone().sub(c0).applyQuaternion(inv); // 세상 → 몸 틀
  const foe = f.foe;
  const fb = foe?.armed && foe.sword ? [body(foe.bladePoint(0, new THREE.Vector3())), body(foe.bladePoint(1, new THREE.Vector3()))] : null; // 상대 칼 날 선분 (몸 틀)
  // 줄 짜기: 어깨 S → P(거리 dX · 방향 xh) 줄에서 비킨 쪽으로 φ 만큼 든 팔(다 펴짐) 끝 H1 에서 P 로 칼 (꺾임 φ + ψ = beta — ψ = 칼이 S → P 줄에서 돌아오는 각)
  const solve = (P) => {
    const X = P.clone().sub(S);
    const dX = Math.max(1e-3, X.length());
    const xh = X.clone().divideScalar(dX);
    let side = null;
    if (D.under && D.side) {
      // 10/31 칼끝 돌려 빼기 (UNIQUE_ASSIST.cavSide 'contact'): 비킨 쪽 = 닿았을 때 상대 칼이 있던 쪽(feel.normal 의 반대 — 월드 → 몸 틀) — 상대 칼 밑을 지나 그 너머 열린 줄로 · 위 몫은 아래 규칙대로 뺌
      const w = D.side.clone().applyQuaternion(inv);
      w.addScaledVector(xh, -w.dot(xh));
      if (w.y > 0) w.y = 0;
      w.addScaledVector(xh, -w.dot(xh));
      if (w.lengthSq() > 1e-4) side = w.normalize();
    }
    if (!side && D.under && fb) {
      // 비킨 쪽 = 상대 칼이 없는 쪽: 상대 칼 날 선분에서 S → P 줄에 가장 가까운 점(8 조각)이 줄에서 비킨 쪽의 반대
      let best = null;
      for (let i = 0; i <= 8; i++) {
        const q = fb[0].clone().lerp(fb[1], i / 8).sub(S);
        const along = clamp(q.dot(xh), 0, dX);
        const off = q.addScaledVector(xh, -along);
        if (!best || off.lengthSq() < best.lengthSq()) best = off;
      }
      best.addScaledVector(xh, -best.dot(xh));
      if (best.lengthSq() > 1e-8) {
        side = best.normalize().negate();
        // 밑으로 돌려 뺌 (cavazione — 상대 칼 밑을 지나 다른 쪽으로): 비킨 쪽이 위로 들면 위 몫을 빼 옆으로만 (위로 든 팔에서 내려 찌르면 목 · 머리로 들었다) · 옆 몫도 없으면 아래로
        if (side.y > 0) {
          side.y = 0;
          side.addScaledVector(xh, -side.dot(xh));
          if (side.lengthSq() < 1e-4) side.set(0, -1, 0).addScaledVector(xh, xh.y);
          side.normalize();
        }
      }
    }
    if (side && D.tapTiming) {
      // 10/31 칼끝 돌려 빼기 (보통 찌르기 빠르기): 팔이 몸 앞을 가로지르는 쪽(칼 든 어깨의 반대 — 몸 틀 z)이면 그 몫을 빼 아래로 — 가로지르는 운동학 팔이 제 몸통을 밀어
      //  몸이 뒤로 밀려 넘어졌다(싸움 판 — 끄는 시간이 길어 미는 시간도 김 · 팔 ↔ 몸통 충돌은 거르는 훅이 없음)
      const out = Math.sign(S.z) || 1;
      if (side.z * out < 0) {
        side.z = 0;
        side.addScaledVector(xh, -side.dot(xh));
        if (side.lengthSq() < 1e-4) side.set(0, -1, 0).addScaledVector(xh, xh.y);
        side.normalize();
      }
    }
    if (!side) {
      const w = A.H.clone().sub(S); // 지금 손 쪽
      side = w.addScaledVector(xh, -w.dot(xh));
      if (side.lengthSq() < 1e-8) side.set(0, 1, 0).addScaledVector(xh, -xh.y);
      side.normalize();
    }
    const g = (ph) => ph + Math.atan2(Lf * Math.sin(ph), Math.max(1e-3, dX - Lf * Math.cos(ph))) - beta;
    let lo = 0;
    let hi = beta;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (g(mid) > 0) hi = mid;
      else lo = mid;
    }
    const ph = (lo + hi) / 2;
    const u = xh.clone().multiplyScalar(Math.cos(ph)).addScaledVector(side, Math.sin(ph));
    const H1 = S.clone().addScaledVector(u, Lf);
    const toP = P.clone().sub(H1);
    const dP = toP.length();
    return { dX, ph, H1, dc: toP.divideScalar(Math.max(1e-6, dP)), dP };
  };
  // 겨눌 곳: 목 아래 ~ 가슴 위 띠 = 상대 가슴 몸체 틀에서 가운데 0.05 m 위 (리솔루토 'lung' 점과 같은 높이를 그 몸 틀로 — 숙인 몸이면 세상 위쪽 0.05 m 가 목 경계(몸 틀 0.11 m — combat.js zoneOf)에 가까워져서)
  const aimAt = () => {
    const B = f.foe.bodies.chest;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(tq(B.rotation(), new THREE.Quaternion()));
    const r = comboAimPoint(f, I, 'lung'); // 몸 틀 · 미끄러짐 당김 그대로 — 세상 위쪽 0.05 m 를 몸 틀 위쪽 0.05 m 로 바꿈
    return r.P.sub(new THREE.Vector3(0, 0.05, 0).applyQuaternion(I.yaw.clone().invert())).add(up.multiplyScalar(0.05).applyQuaternion(I.yaw.clone().invert()));
  };
  // 10/31 비껴서며 찌르기 몸 빼기 (D.void { lat 스틱 쪽 옆 · fwd 앞 m — schools.js inquartata step}): 이 수 동안 몸을 상대 칼 줄 밖으로 미끄러뜨리고(몸 · 두 발 — shiftFighter · 운동학 칼의 물리 예외) ·
  //  뒷발을 그쪽으로 돌려 디딤(gait 'retreat' 걸음 — 뒷발만 옆으로) · 길은 미끄러진 뒤 자리로 짬(comboAimPoint 가 I.slide 를 뺌) · 모자라면 앞 몫에 런지(THRUST.step 까지 — 아래 런지와 같은 한도)
  if (D.void && f.foe?.bodies?.chest && !I.slide) {
    const c1 = f.bodies.chest.translation();
    const fc = f.foe.bodies.chest.translation();
    const ux = fc.x - c1.x;
    const uz = fc.z - c1.z;
    const d = Math.max(1e-3, Math.hypot(ux, uz));
    const M = f.swordArt.measure;
    const fx = ux / d;
    const fz = uz / d;
    const rx = -fz; // 몸 기준 오른쪽 (상대 쪽 수평 단위의 오른쪽 — gait 걸음 side + 와 같은 쪽)
    const rz = fx;
    const lat = D.void.lat ?? 0;
    const fwdMax = Math.max(0, d - M.clinch);
    const mk = (fwd) => {
      const vx = fx * fwd + rx * lat;
      const vz = fz * fwd + rz * lat;
      const L = Math.hypot(vx, vz);
      return L > 1e-3 ? { dx: vx / L, dz: vz / L, slide: L, t0: I.t, span: 1, done: 0, void: true } : null;
    };
    I.slide = mk(Math.min(D.void.fwd ?? 0, fwdMax));
    if (I.slide) {
      const P0 = aimAt();
      const Z0 = solve(P0);
      const short = Z0.dP - (f.weaponCfg.hiltLength + f.weaponCfg.bladeLength);
      if (short > 1e-3) I.slide = mk(Math.min((D.void.fwd ?? 0) + Math.min(short, THRUST.step), fwdMax, Math.max(0, d - M.contact) + (D.void.fwd ?? 0)));
      I.artVoid = { lat, fwd: I.slide ? +(I.slide.slide ** 2 - lat * lat > 0 ? Math.sqrt(I.slide.slide ** 2 - lat * lat) : 0).toFixed(3) : 0 }; // 재기
      if (f.gait?.active) f.gait.requestStep({ kind: 'retreat', fwd: 0, side: lat, duration: 0.35 }); // 뒷발을 몸 뺀 쪽으로 돌려 디딤 (뒷발 — retreat 걸음은 앞발이 아닌 발)
    }
  }
  let P = aimAt();
  I.aim = 'lung';
  let Z = solve(P);
  // 팔을 다 펴도 칼끝이 겨눈 곳에 못 닿으면 모자란 만큼 런지 (이탈리아 찌르기 ③ THRUST.itLunge · AI 임브로카타 탭 찌르기 길과 같은 뜻 — 런지 걸음 THRUST.step 까지):
  //  몸 미끄러짐(comboMoveStart 와 같은 한도 — 맞닿기에서 멈춤 · clinch 안 금지) + 다리 런지 걸음(몸이 앞발을 따라 실림 — SECRET.stepPush · accel) · 길은 미끄러진 뒤 자리로 짬
  const short = Z.dP - L;
  if (short > 1e-3 && f.foe?.bodies?.chest && !I.slide) {
    const M = f.swordArt.measure;
    const c0 = f.bodies.chest.translation();
    const fc = f.foe.bodies.chest.translation();
    const dx = fc.x - c0.x;
    const dz = fc.z - c0.z;
    const d = Math.max(1e-3, Math.hypot(dx, dz));
    const slide = Math.min(short, THRUST.step, Math.max(0, d - M.contact), Math.max(0, d - M.clinch));
    if (slide > 1e-3) {
      I.slide = { dx: dx / d, dz: dz / d, slide, t0: I.t, span: 1, done: 0 };
      if (f.gait?.active) f.gait.requestStep({ kind: 'lunge', fwd: slide, duration: 0.3, push: SECRET.stepPush, accel: true });
      I.artLunge = slide; // 재기
      P = aimAt();
      Z = solve(P);
    }
  }
  const { H1, dc } = Z;
  const dX = Z.dX;
  const over = L - Z.dP; // 다 뻗은 칼끝이 P 를 지나는 길이 (가까우면 + — 리솔루토 팔을 뻗은 찌름과 같음)
  const H0 = H1.clone().addScaledVector(dc, -Math.min(draw + Math.max(0, over), Lf - ARM.fore)); // 찌름 시작: 칼끝이 P 앞 draw (몸 겉 밖) — 아주 가까우면 손이 어깨에서 아래팔 길이까지만 (팔꿈치를 다 접은 자리)
  const segs = [];
  let cur = A;
  const push = (H, cut, pad = null, T = null, Dv = dc) => {
    const B = { H, D: Dv.clone(), px: H.z - 0.1, pad };
    const sg = { cut, A: cur, B };
    sg.T = T ?? comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  if (D.under && fb) {
    // 돌려 빼기: 손은 그대로 두고 칼끝을 맞물린 상대 칼 밑으로 (지금 칼끝에 가장 가까운 상대 칼 자리에서 막힘 거리 + 닿음 거리만큼 아래 — 칼끼리 막힘으로 셈되지 않는 거리)
    const tip = A.H.clone().addScaledVector(A.D, L);
    let q = fb[0];
    let bd = Infinity;
    for (let i = 0; i <= 8; i++) {
      const p = fb[0].clone().lerp(fb[1], i / 8);
      const d = p.distanceTo(tip);
      if (d < bd) (bd = d), (q = p);
    }
    const W = q.clone().add(new THREE.Vector3(0, -(SECRET.iberianBlockDist + SECRET.instantTouch), 0).applyQuaternion(inv));
    const Dv = W.sub(A.H);
    if (Dv.lengthSq() > 1e-6) push(A.H.clone(), false, null, null, Dv.normalize());
  }
  push(H0.clone(), false);
  for (let k = 1; k <= 4; k++) push(H0.clone().lerp(H1, k / 4), true);
  if (D.tapTiming) {
    // 10/31 칼끝 돌려 빼기 (기본 고유 공격 — '보통 찌르기 빠르기'): 찌르는 토막은 보통 찌르기 빠르기(I.v = cavTipSpeed) 그대로 · 맞힘 없는 토막(돌려 빼기 · 겨눔)은 다 해서 탭 찌르기 겨눔 시간
    //  THRUST.aim 안(길면 줄임 — 가까우면 칼을 크게 당기는 길이라 보통 빠르기로는 1 s 넘게 팔이 묶였음) · 아래 거둠 = THRUST.recover × 무기 thrustStyle(skill.js thrust 의 K 와 같은 수 · 새 수 없음) · 런지 미끄러짐도 겨눔 + 찌름 안에
    const lead = segs.filter((sg) => !sg.cut);
    const Tl = lead.reduce((a, sg) => a + sg.T, 0);
    if (Tl > THRUST.aim) for (const sg of lead) sg.T = (sg.T * THRUST.aim) / Tl;
    if (I.slide) I.slide.span = Math.max(1e-3, segs.reduce((a, sg) => a + sg.T, 0));
  } else if (I.slide?.void) {
    // 비껴서며 찌르기 몸 빼기 (10/31): 이 수 내내(겨눔 · 찌름 · 뻗은 채 · 거둠 — 아래 끝에서 정함) 미끄러짐 — 옆으로 빠지는 몸이라 칼끝 빠르기 맞춤(아래 런지 k)은 하지 않음 (찌름은 고노센 × 몫 그대로)
  } else if (I.slide && I.slide.slide > 0) {
    // 런지: 겨눔 · 찌름 동안 다 미끄러지고 칼끝이 땅에 대해 지나는 길(몸 틀 길 + 미끄러짐)의 빠르기가 I.v 그대로 (comboNext 의 그때 계산 길과 같은 셈)
    const T = segs.reduce((a, sg) => a + sg.T, 0);
    const k = T > 0 ? (T * I.v + I.slide.slide) / (T * I.v) : 1;
    for (const sg of segs) sg.T *= k;
    I.slide.span = Math.max(1e-3, T * k);
  }
  push(H1.clone(), false, null, THRUST.hold); // 뻗은 채 둠 (같은 자리 토막은 칼끝 길이 0 — 탭 찌르기 버팀 시간)
  push(H0.clone(), false, null, D.tapTiming ? THRUST.recover * (f.weaponCfg.thrustStyle?.recover ?? 1) : null); // 손 목표는 그대로 (tapTiming — 10/31 칼끝 돌려 빼기: 탭 찌르기 거둠 시간) (손가락이 둔 자리 — 탭으로 낸 칼이라 손 목표를 옮기면 그 뜀이 긋기로 읽혔다) · 끝 자세에서 0.2 s 에 서보로
  if (I.slide?.void && !D.tapTiming) I.slide.span = Math.max(1e-3, segs.reduce((a, sg) => a + sg.T, 0)); // 비껴서며 찌르기 몸 빼기 (10/31): 이 수 내내
  I.overshoot = H1.clone().addScaledVector(dc, L).sub(P).dot(dc); // 재기 (판정에는 안 씀): 다 뻗은 칼끝이 겨눈 곳을 지난 길이 (m — 음수면 못 닿음)
  I.artReach = { dX, el: Math.asin(clamp(dc.y, -1, 1)) / D2R, lift: Z.ph / D2R, hand: H1.distanceTo(S) }; // 재기: 어깨 → P · 칼 높이각(°) · 팔을 든 각 φ(°) · 끝 손 ↔ 어깨
  return segs;
}

/**
 * 사람 겹치기 한 칼의 길 (G7 두플리렌 — requestArtDup · 원전 Ringeck 주해 Duplieren 「폼멜을 왼손으로 오른팔 밑으로 밀고 상대 칼 뒤, 칼과 사람 사이로 엇갈린 팔로 얼굴을 친다」 [원전 2차] · 길 [해석]):
 *  몸 틀(시작 yaw · 가슴 원점). X = 지금 내 칼날과 상대 칼날이 가장 가까운 내 칼 자리(손에서 칼 축으로 sx) · 맞닿은 어긋남(내 칼 − 상대 칼)은 그대로(칼을 떼지 않음).
 *  얼굴 P = 상대 머리 몸체 가운데에서 머리 틀 아래로 dyn.face m (입 언저리 — 투구 테 아래).
 *  ① 미끄러뜨려 밀어 넣기 (맞힘 없음): 내 칼 방향 그대로 맞닿은 자리를 상대 칼 줄을 따라 칼끝 쪽으로 옮기고(상대 칼 몫 0.05 칸) 칼 축으로 밀어 X 너머 칼날이 얼굴까지 닿게(X 너머 길이 ≥ |P − X| + 닿음 거리 ·
 *   손은 어깨에서 팔 길이까지). ② 감아 베기 (맞힘): 맞닿은 자리 X 를 축으로 칼을 지금 방향 D0 → 얼굴 쪽 방향 Dp → 그 길 끝 방향으로 dyn.follow ° 더. 얼굴까지는 상대 칼 줄(X 에서 상대 칼자루 쪽 u)을 둘레로 감는 길
 *   (u 에서 벌어진 각 α · u 둘레 각 β 를 고르게 — α 는 늘 두 끝 가운데 작은 쪽 이상 = 내 칼 줄이 상대 칼 줄과 겹치지 않음 → 칼이 칼을 지나가지 않음 · 감기 Winden 과 같은 꼴) ·
 *   손 = X − 칼 방향 × sx (칼자루는 칼끝 반대쪽 — 오른쪽으로 돌면 폼멜이 오른팔 밑 · 손이 엇갈림).
 *   옮김 자리 · 감는 쪽(둘레 두 쪽)은 얼굴에 닿기 전 X 너머 칼날이 상대 몸(머리 · 목 밖 — 팔 · 몸통 · 다리)을 닿음 거리 안에 지나지 않는 것 가운데 가장 덜 옮긴 것 · 같으면 얼굴을 내려 지나는 쪽
 *   (다 막히면 가장 멀리 비킨 것 — 앞을 가린 팔에 먼저 닿음). 길 덧칸 m.plan [밀어 넣은 자리 · 얼굴을 지나는 자리 · 끝] 마다 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °] (comboPlanAdd).
 *  재기: I.dup = { sx, push, sweep(°), down(° — 얼굴을 지날 때 칼끝이 내려가는 각 · + = 내려 벰), reach(손 ↔ 어깨 최대), dP, minA(상대 칼 줄에서 가장 가까이 간 각), tX · tC(맞닿은 자리 상대 칼 몫 — 처음 · 옮긴 뒤), clear }
 */
function comboPlanDup(f, I, m, A) {
  const D = m.dyn;
  const HL = f.weaponCfg.hiltLength;
  const L = HL + f.weaponCfg.bladeLength;
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const inv = I.yaw.clone().invert();
  const c0 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const body = (w) => w.clone().sub(c0).applyQuaternion(inv);
  const toW = (v) => v.clone().applyQuaternion(I.yaw).add(c0);
  const foe = f.foe;
  const fb0 = body(foe.bladePoint(0, new THREE.Vector3()));
  const fb1 = body(foe.bladePoint(1, new THREE.Vector3()));
  const hb = foe.bodies.head;
  const hup = new THREE.Vector3(0, 1, 0).applyQuaternion(tq(hb.rotation(), new THREE.Quaternion()));
  const P = body(tv(hb.translation(), new THREE.Vector3()).addScaledVector(hup, -(D.face ?? 0)));
  const touch = SECRET.instantTouch;
  // 맞닿은 자리 (내 칼 축 16 조각 중 상대 칼날에 가장 가까운 곳)
  let best = null;
  for (let i = 0; i <= 16; i++) {
    const sx = HL + (L - HL) * (i / 16);
    const p = A.H.clone().addScaledVector(A.D, sx);
    const r = segPointT(fb0, fb1, p);
    if (!best || r.d < best.d) best = { d: r.d, sx, X: p, t: r.t };
  }
  const tX = best.t;
  const D0 = A.D.clone().normalize();
  const u = fb0.clone().sub(fb1).normalize(); // X → 상대 칼자루 쪽
  const e1 = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const e2 = new THREE.Vector3().crossVectors(u, e1);
  const sph = (v) => ({ a: Math.acos(clamp(v.dot(u), -1, 1)), b: Math.atan2(v.dot(e2), v.dot(e1)) });
  const S0 = sph(D0);
  const cols = [];
  for (const [h, info] of f.colliderInfo) {
    if (info.fighter !== foe || info.kind === 'weapon' || info.detached || info.part === 'head' || info.part === 'neck') continue;
    const col = f.world.getCollider(h);
    if (col) cols.push(col);
  }
  // 한 판 짜기: 상대 칼 몫 t 로 옮긴 맞닿은 자리 · 감는 쪽 k (0 짧은 쪽 · 1 긴 쪽)
  const plan = (t, k) => {
    const slide = fb0.clone().lerp(fb1, t).sub(fb0.clone().lerp(fb1, tX));
    const X = best.X.clone().add(slide);
    const Hs = A.H.clone().add(slide);
    const need = P.distanceTo(X) + touch;
    let push = clamp(best.sx - (L - need), 0, Math.max(0, best.sx - HL - touch)); // 맞닿은 자리는 칼날 위(코등이에서 닿음 거리 너머)에 남음
    if (Hs.clone().addScaledVector(D0, push).distanceTo(S) > Lf) {
      let lo = 0;
      let hi = push;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (Hs.clone().addScaledVector(D0, mid).distanceTo(S) > Lf) hi = mid;
        else lo = mid;
      }
      push = lo;
    }
    const sx = best.sx - push;
    const Dp = P.clone().sub(X).normalize();
    const Sp = sph(Dp);
    let db = Sp.b - S0.b;
    if (db > Math.PI) db -= 2 * Math.PI;
    if (db < -Math.PI) db += 2 * Math.PI;
    if (k && Math.abs(db) > 1e-3) db -= Math.sign(db) * 2 * Math.PI;
    const dirAt = (w) => {
      const a = S0.a + (Sp.a - S0.a) * w;
      const b = S0.b + db * w;
      return u.clone().multiplyScalar(Math.cos(a)).addScaledVector(e1, Math.sin(a) * Math.cos(b)).addScaledVector(e2, Math.sin(a) * Math.sin(b)).normalize();
    };
    // 얼굴에 닿기 전(감는 길 0 ~ 0.95) X 너머 칼날 ↔ 상대 몸(머리 · 목 밖)의 가장 가까운 거리 · 얼굴이 X 너머 칼날 밖이면 −1 (못 닿음)
    let clear = P.distanceTo(X) > L - sx ? -1 : Infinity;
    for (let j = 1; j <= 19 && clear >= 0; j++) {
      const Dv = dirAt((0.95 * j) / 19);
      const a = toW(X.clone().addScaledVector(Dv, touch));
      const b = toW(X.clone().addScaledVector(Dv, L - sx));
      for (const col of cols) clear = Math.min(clear, segToCollider(a, b, col));
    }
    const tan = dirAt(1).sub(dirAt(0.98)).normalize();
    return { t, k, X, Hs, push, sx, Dp, db, Sp, dirAt, clear, tan, down: Math.asin(clamp(-tan.y, -1, 1)) / D2R };
  };
  // 비킴 문턱 = 막힘 거리 + 닿음 거리 (칼끝 돌려 빼기가 상대 칼 밑을 지나는 거리와 같음 — 놓인 칼은 손목 교정 · 날 세우기로 짠 길에서 몇 cm 비켜 남)
  const need = SECRET.iberianBlockDist + touch;
  let pick = null;
  for (let t = tX; t <= 1 + 1e-9 && !(pick && pick.clear > need); t += 0.05) {
    for (const k of [0, 1]) {
      const z = plan(t, k);
      const ok = z.clear > need;
      if (!pick || (ok && !(pick.clear > need)) || (ok && pick.clear > need && pick.t === z.t && z.down > pick.down) || (!ok && !(pick.clear > need) && z.clear > pick.clear)) pick = z;
    }
  }
  const { X, Hs, push, sx, Dp, dirAt, tan, t: tC } = pick;
  const H0 = Hs.clone().addScaledVector(D0, push);
  const segs = [];
  let cur = A;
  const pl = m.plan ?? [];
  const put = (H, Dv, cut, row) => {
    const B = { H: H.clone(), D: Dv.clone().normalize(), px: H.z - 0.1, pad: null };
    if (row) comboPlanAdd(B, row);
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  put(H0, D0, false, pl[0]);
  let ax2 = new THREE.Vector3().crossVectors(Dp, tan);
  if (ax2.lengthSq() < 1e-8) ax2 = new THREE.Vector3(0, 1, 0);
  ax2.normalize();
  const fol = (D.follow ?? 25) * D2R;
  let arc = 0;
  for (let j = 1; j <= 20; j++) arc += Math.acos(clamp(dirAt(j / 20).dot(dirAt((j - 1) / 20)), -1, 1));
  const N1 = Math.max(2, Math.round((6 * arc) / Math.max(1e-6, arc + fol)));
  const N2 = Math.max(1, 6 - N1);
  let reach = 0;
  const rowAt = (k, a, b) => (a || b ? [0, 1, 2].map((q) => (a?.[q] ?? 0) + ((b?.[q] ?? 0) - (a?.[q] ?? 0)) * k) : null);
  for (let j = 1; j <= N1 + N2; j++) {
    const Dv = j <= N1 ? dirAt(j / N1) : Dp.clone().applyAxisAngle(ax2, (fol * (j - N1)) / N2);
    const H = X.clone().addScaledVector(Dv, -sx);
    reach = Math.max(reach, H.distanceTo(S));
    put(H, Dv, true, j <= N1 ? rowAt(j / N1, pl[0], pl[1]) : rowAt((j - N1) / N2, pl[1], pl[2])); // 길 덧칸 칸마다 보간 (얼굴까지 [0] → [1] · 그 뒤 [1] → [2])
  }
  let minA = 180;
  for (let j = 0; j <= 20; j++) minA = Math.min(minA, Math.acos(clamp(dirAt(j / 20).dot(u), -1, 1)) / D2R);
  I.dup = { sx: +sx.toFixed(3), push: +push.toFixed(3), sweep: +((arc + fol) / D2R).toFixed(1), down: +pick.down.toFixed(1), reach: +reach.toFixed(3), dP: +P.distanceTo(X).toFixed(3), minA: +minA.toFixed(1), tX: +tX.toFixed(2), tC: +tC.toFixed(2), clear: +pick.clear.toFixed(3), way: pick.k };
  I.dupGlide = true; // 처음 닿아 있던 상대 칼을 따라 감는 동안은 막힘이 아님 (stepCombo — 떨어진 뒤 다시 닿으면 막힘)
  I.aim = 'face';
  return segs;
}

/**
 * 사람 겹치기 단순 길 (10/31 19:xx 사장님 '겹치기의 발동 경로가 좀 어색하더라 … 컨셉에 맞게 가장 효율적이고 단순한 움직임' — UNIQUE_ASSIST.dupOld 0 · 기록 docs/strike/duplieren_simple_2026-10-31.md):
 *  맞물린 자리(지금 놓인 칼에 가장 가까운 자세 지도 패드 p0)에서 **패드 곧은 줄 하나**로 칼날이 얼굴을 지나는 패드 p1 까지 · 같은 줄로 dyn.follow ° 만큼 더(칼날이 얼굴을 다 지나게) — 감는 둘레 길 · 밀어 넣는 토막 · 꺾임 없음.
 *   패드 → 손 · 칼 방향은 몸이 늘 쓰는 자세 지도(f.padPose — 제비 베기 곧은 길과 같은 틀)라 손목이 사람 범위 안 · 손이 팔 길이 안. 맞물린 칼에서 얼굴로 가장 가까운(패드 거리 가장 짧은) 줄 =
 *   상대 칼을 떼지 않고 그 칼과 사람 사이로 들어가 얼굴을 침(Liechtenauer 두플리렌 — 다시 침). 처음 붙어 있던 상대 칼에 닿아 있는 동안은 막힘이 아님(dupGlide — comboPlanDup 과 같음).
 *   p1 = 칼날(코등이 ~ 칼끝)이 얼굴에서 가장 가까이 지나는 패드들(가장 가까운 것 + 2 cm 안) 가운데 p0 에서 가장 가까운 것 (0.05 칸 → 0.01 칸).
 *   앞 박차기(I.slide — 이 수 동안 몸이 상대 쪽으로 고르게 미끄러짐)가 있으면 칼날이 얼굴을 지나는 때 = 앞발 디딤 = 미끄러짐 끝 → 얼굴은 다 다가온 자리 (아래 때 맞춤).
 *   토막 시간 = 칼끝 길 · 손 길 가운데 긴 것 ÷ I.v.
 *  재기: I.dup = { p0, p1, p2, padLen, dFace(칼날 ↔ 얼굴 m), sweep(칼 방향 돈 각 °), k, tFace, Tstep, slow(얼굴까지 늦춘 배), fit(놓인 칼 ↔ p0 자세 m), line: 1 }
 */
function comboPlanDupLine(f, I, m, A) {
  const D = m.dyn;
  const HL = f.weaponCfg.hiltLength;
  const L = HL + f.weaponCfg.bladeLength;
  const inv = I.yaw.clone().invert();
  const c0 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const body = (w) => w.clone().sub(c0).applyQuaternion(inv);
  const foe = f.foe;
  const hb = foe.bodies.head;
  const hup = new THREE.Vector3(0, 1, 0).applyQuaternion(tq(hb.rotation(), new THREE.Quaternion()));
  const P0 = body(tv(hb.translation(), new THREE.Vector3()).addScaledVector(hup, -(D.face ?? 0)));
  let sl = I.slide && I.slide.slide > 0 ? new THREE.Vector3(I.slide.dx, 0, I.slide.dz).applyQuaternion(inv).multiplyScalar(I.slide.slide) : null; // 앞 박차기 (몸 틀 — 상대가 다가오는 몫)
  const PM = 0.6; // 패드 끝 (comboPad 와 같은 한도)
  const pose = (p) => {
    const B = { H: new THREE.Vector3(), D: new THREE.Vector3(), px: p[0], pad: [p[0], p[1]] };
    f.padPose(p[0], p[1], B.H, B.D);
    return B;
  };
  const bladeTo = (B, P) => {
    const a = B.H.clone().addScaledVector(B.D, HL);
    const b = B.H.clone().addScaledVector(B.D, L);
    return segPointT(a, b, P).d;
  };
  // p0 = 지금 놓인 칼(A — 맞물려 상대 칼에 밀린 자리)에 가장 가까운 자세 지도 패드 (손 · 칼끝 거리 합 — 0.05 칸 → 0.01 칸). 손가락 패드(handOffset)는 칼이 밀려 있으면 놓인 칼과 달라
  //  그 자리로 먼저 거두는 갈고리가 생김
  const tipA = A.H.clone().addScaledVector(A.D.clone().normalize(), L);
  const poseCost = (p) => {
    const B = pose(p);
    return B.H.distanceTo(A.H) + B.H.clone().addScaledVector(B.D, L).distanceTo(tipA);
  };
  let p0 = [clamp(f.handOffset.x, -PM, PM), clamp(f.handOffset.y, -PM, PM)];
  let c0b = poseCost(p0);
  for (let x = -PM; x <= PM + 1e-9; x += 0.05) for (let y = -PM; y <= PM + 1e-9; y += 0.05) {
    const c = poseCost([x, y]);
    if (c < c0b) (c0b = c), (p0 = [x, y]);
  }
  const g0 = p0;
  for (let x = g0[0] - 0.05; x <= g0[0] + 0.05 + 1e-9; x += 0.01) for (let y = g0[1] - 0.05; y <= g0[1] + 0.05 + 1e-9; y += 0.01) {
    if (Math.abs(x) > PM || Math.abs(y) > PM) continue;
    const c = poseCost([x, y]);
    if (c < c0b) (c0b = c), (p0 = [x, y]);
  }
  // 얼굴 P 로 가는 패드 p1 (가장 가까이 지나는 것 + 2 cm 안 가운데 p0 에서 가장 가까운 것)
  const target = (P) => {
    const cand = [];
    for (let x = -PM; x <= PM + 1e-9; x += 0.05) for (let y = -PM; y <= PM + 1e-9; y += 0.05) cand.push([x, y, bladeTo(pose([x, y]), P)]);
    let dmin = Math.min(...cand.map((c) => c[2]));
    let best = null;
    for (const c of cand) if (c[2] <= dmin + 0.02 && (!best || Math.hypot(c[0] - p0[0], c[1] - p0[1]) < Math.hypot(best[0] - p0[0], best[1] - p0[1]))) best = c;
    // 0.01 칸으로 다듬음 (같은 잣대 — 그 둘레 ± 0.05)
    const fine = [];
    for (let x = best[0] - 0.05; x <= best[0] + 0.05 + 1e-9; x += 0.01) for (let y = best[1] - 0.05; y <= best[1] + 0.05 + 1e-9; y += 0.01) if (Math.abs(x) <= PM && Math.abs(y) <= PM) fine.push([x, y, bladeTo(pose([x, y]), P)]);
    dmin = Math.min(dmin, ...fine.map((c) => c[2]));
    best = null;
    for (const c of fine) if (c[2] <= dmin + 0.02 && (!best || Math.hypot(c[0] - p0[0], c[1] - p0[1]) < Math.hypot(best[0] - p0[0], best[1] - p0[1]))) best = c;
    if (!(D.edgeLead > 0)) return best;
    // 긴 날 앞장 (10/31 22:xx 감독 '닿을 때 긴 날이 앞장'): 칼날이 얼굴 5 cm 안을 지나는 패드들 가운데 p0 → p1 줄로 칠 때 긴 날(칼 틀 +x · dupEdge −1 이면 짧은 날)이
    //  손목 굴림 밧줄(80°) 안에서 칼이 가는 쪽과 cos > STRIKE.edgeAlign 로 설 수 있는 것 중 p0 에서 가장 가까운 것 (iaiSolve — 놓을 때와 같은 풀이 · 팔 관절 목표는 다음 놓기가 다시 셈)
    //  없으면 2 cm 안에서 날이 가장 잘 서는 것
    const pool = [...fine, ...cand].filter((c) => c[2] <= dmin + 0.05);
    const L6 = HL + 0.6 * f.weaponCfg.bladeLength;
    const edgeOf = (c, sgn) => {
      const du = [c[0] - p0[0], c[1] - p0[1]];
      const n = Math.hypot(du[0], du[1]);
      if (n < 1e-3) return -1;
      const B = pose([c[0], c[1]]);
      const Bq = pose([c[0] - (du[0] / n) * 0.02, c[1] - (du[1] / n) * 0.02]);
      const hint = B.H.clone().addScaledVector(B.D, L6).sub(Bq.H.clone().addScaledVector(Bq.D, L6)).applyQuaternion(I.yaw);
      const r = iaiSolve(f, B.H, B.D, 0, hint.clone().multiplyScalar(sgn), true, I);
      const Dw = r.Dw;
      const perp = hint.addScaledVector(Dw, -hint.dot(Dw));
      const pl = perp.length();
      return pl > 1e-6 ? (sgn * new THREE.Vector3(1, 0, 0).applyQuaternion(r.qs).dot(perp)) / pl : -1;
    };
    //  긴 날이 어느 패드에서도 못 서면(맞물린 자리에서 얼굴로 가는 쪽이 손목 굴림 밖 — 낮은 맞물림에서 올려 칠 때) 짧은 날이 서는 가장 가까운 것 (칼 면으로 치지 않게 — 판정은 날 맞춤 |cos| ·
    //  롱소드는 양날) · 둘 다 못 서면 2 cm 안에서 긴 날이 가장 잘 서는 것. 넷째 칸 = 날 cos · 다섯째 = 쓴 날(1 긴 · −1 짧은)
    const side = (m.edge ?? 1) < 0 ? -1 : 1;
    pool.sort((a2, b2) => Math.hypot(a2[0] - p0[0], a2[1] - p0[1]) - Math.hypot(b2[0] - p0[0], b2[1] - p0[1]));
    let alt = null;
    let other = null;
    let tried = 0;
    for (const c of pool) {
      if (tried++ > 60) break;
      const e = edgeOf(c, side);
      if (e > STRIKE.edgeAlign) return [...c.slice(0, 3), e, side];
      if (!other) {
        const e2 = edgeOf(c, -side);
        if (e2 > STRIKE.edgeAlign) other = [...c.slice(0, 3), e2, -side];
      }
      if (c[2] <= dmin + 0.02 && (!alt || e > alt[3])) alt = [...c.slice(0, 3), e, side];
    }
    return other ?? alt ?? best;
  };
  // 한 판: 얼굴 P → p1 → 같은 줄로 follow ° 더 (p2) → 토막
  const build = (P) => {
    const t1 = target(P);
    const p1 = [t1[0], t1[1]];
    const B1 = pose(p1);
    let u = [p1[0] - p0[0], p1[1] - p0[1]];
    const un = Math.hypot(u[0], u[1]);
    let p2 = p1;
    if (un > 1e-3) {
      u = [u[0] / un, u[1] / un];
      const fol = (D.follow ?? 25) * D2R;
      for (let e = 0.02; e <= 0.5 + 1e-9; e += 0.02) {
        const q = [clamp(p1[0] + u[0] * e, -PM, PM), clamp(p1[1] + u[1] * e, -PM, PM)];
        p2 = q;
        if (Math.acos(clamp(pose(q).D.dot(B1.D), -1, 1)) >= fol || Math.abs(q[0]) >= PM || Math.abs(q[1]) >= PM) break; // follow ° 만큼 돌았거나 패드 끝
      }
    }
    // 토막: A(지금 칼) → p0 → p1 줄 위 0.05 칸 → p2
    const pts = [];
    const n1 = Math.max(1, Math.ceil(un / 0.05));
    for (let j = 1; j <= n1; j++) pts.push([p0[0] + (p1[0] - p0[0]) * (j / n1), p0[1] + (p1[1] - p0[1]) * (j / n1)]);
    const iFace = pts.length;
    const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n2 = Math.ceil(l2 / 0.05);
    for (let j = 1; j <= n2; j++) pts.push([p1[0] + (p2[0] - p1[0]) * (j / n2), p1[1] + (p2[1] - p1[1]) * (j / n2)]);
    const segs = [];
    let cur = A;
    let tFace = 0;
    let sweep = 0;
    pts.forEach((p, j) => {
      const B = pose(p);
      const sg = { cut: true, A: cur, B };
      sg.T = Math.max(comboSegLen(f, sg), cur.H.distanceTo(B.H)) / I.v; // 칼끝 길 · 손 길 가운데 긴 것
      sweep += Math.acos(clamp(cur.D.clone().normalize().dot(B.D), -1, 1));
      segs.push(sg);
      if (j < iFace) tFace += sg.T;
      cur = B;
    });
    const tB = segPointT(B1.H.clone().addScaledVector(B1.D, HL), B1.H.clone().addScaledVector(B1.D, L), P).t; // 얼굴을 지나는 칼날 자리 (코등이 0 ~ 칼끝 1)
    return { segs, p1, p2, padLen: un + l2, dFace: t1[2], tFace, iFace, sweep, edge1: t1[3] ?? null, side: t1[4] ?? null, tB };
  };
  // 앞 박차기와 때 맞춤 (사장님 10/31 19:xx '손 동작과 발 동작이 어우러져야'): 칼날이 얼굴을 지나는 때 = 앞발이 디디는 때 = 몸 미끄러짐이 끝나는 때.
  //  그 때 Tstep = 얼굴까지 칼 시간(몫 빠르기) · 박찬 걸음 발 뜬 시간 GAIT.burstT(0.22 s) 가운데 긴 것 → 얼굴은 미끄러진 끝 자리(k = 1).
  //  칼이 몫 빠르기로 그보다 일찍 닿으면 얼굴까지 토막을 그만큼 늦춤(손이 발을 기다림 — 몫은 빠르기 위 끝) · 얼굴 뒤 끝 따라 돌기는 몫 빠르기 그대로 · 끄는 시간 상한은 얼굴까지(Tstep) + 끝 따라 돌기
  let k = 1;
  let z = null;
  let fit = null;
  if (sl && m.step?.fit && (m.step?.sync ?? 1) === 1) {
    // 박차기 길이 맞춤 (사장님 11/01 00:xx — 독일 박차기 ② 간격 잡기처럼 '가장 잘 드는 거리'까지): 걸음 s 를 바꿔 가며 짠 얼굴 베기가 얼굴을 칼날 fit.point 자리에서 지나게 —
    //  맞추는 자리 = 몸이 다 들어가 선 자리(그 자리에서 얼굴을 칼날 point 자리로 침 = 가장 가까운 잘 드는 자리 · 모르트슐라크로 이어 갈 자리) · 칼은 박찬 걸음 디딤에 출발해 몸이 그 자리로 마저 들어가는 동안 얼굴을 지남
    //  어긋남 = (지나는 칼날 자리 − point) × 칼날 길이 ± 못 닿는 몫(칼날 ↔ 얼굴 3 cm 넘음 — 칼끝 너머 + · 코등이 안쪽 −) → 그만큼 더(덜) 들어감 (양쪽이 잡히면 할선 / 가운데) · 3 cm 안이면 멈춤 · 여섯까지
    const dir = sl.clone().normalize();
    const sMax = I.slide.slide; // 몸통이 맞닿는 거리까지 (comboMoveStart — st.stop = fit.floor · 사장님 11/01 00:xx '들어가도 돼. 제한 없이')
    const Lb = f.weaponCfg.bladeLength;
    const pt = m.step.fit.point ?? 0.6;
    let sv = Math.min(sMax, 0.45);
    let best = null;
    let lo = null; // 덜 들어간 쪽 (어긋남 > 0 — 더 들어가야 함)
    let hi = null; // 더 들어간 쪽 (어긋남 < 0)
    for (let it = 0; it < 6; it++) {
      const kk = 1; // 맞추는 것은 몸이 다 들어가 선 자리 (칼은 박찬 걸음 디딤에 출발해 그보다 조금 앞에서 얼굴을 지남 — 아래 sync 1 이 그 때 자리로 다시 짬)
      z = build(P0.clone().addScaledVector(dir, -sv));
      const err = (z.tB - pt) * Lb + (z.tB >= 0.99 ? 1 : z.tB <= 0.01 ? -1 : 0) * Math.max(0, z.dFace - 0.03); // 못 닿는 몫: 얼굴이 칼끝 너머면 더 들어감 · 코등이 안쪽(너무 가까움)이면 덜
      if (!best || Math.abs(err) < Math.abs(best.err)) best = { s: sv, z, k: kk, err, it };
      if (Math.abs(err) < 0.03) break;
      if (err > 0 && (!lo || sv > lo.s)) lo = { s: sv, err };
      if (err < 0 && (!hi || sv < hi.s)) hi = { s: sv, err };
      let sN;
      if (lo && hi && hi.s > lo.s) {
        // 사이에 끼면 할선 (끝에 너무 붙으면 가운데)
        sN = lo.s + ((hi.s - lo.s) * lo.err) / (lo.err - hi.err);
        if (!(sN > lo.s + 0.1 * (hi.s - lo.s) && sN < hi.s - 0.1 * (hi.s - lo.s))) sN = 0.5 * (lo.s + hi.s);
      } else sN = clamp(sv + err / Math.max(0.5, kk), 0, sMax);
      if (Math.abs(sN - sv) < 0.01) break;
      sv = sN;
    }
    fit = { s: +best.s.toFixed(3), sMax: +sMax.toFixed(3), tB: +best.z.tB.toFixed(2), err: +best.err.toFixed(3), it: best.it }; // tB = 선 자리에서 얼굴을 지나는 칼날 자리
    if (best.s < (m.step.fit.min ?? 0.05)) {
      // 이미 그 거리거나 안: 걸음 없이 곧장 (칼은 몫 빠르기로 바로)
      I.slide = null;
      sl = null;
      z = build(P0);
      fit.s = 0;
    } else {
      I.slide.slide = best.s;
      sl = dir.multiplyScalar(best.s);
      z = best.z; // 선 자리 판 — sync 1 이 칼이 얼굴을 지날 때 몸이 간 몫 k 로 다시 짬
      k = 1;
    }
  }
  if (!z) z = build(sl ? P0.clone().addScaledVector(sl, -k) : P0);
  for (let it = 0; it < 3 && sl && m.step?.sync === 0; it++) {
    // 때 맞춤 끔: 칼이 몫 빠르기로 얼굴을 지나는 때(tFace)의 다가온 자리로 겨눔 (몫 k = tFace ÷ 박차기 시간)
    k = clamp(z.tFace / Math.max(z.tFace, GAIT.burstT), 0, 1);
    z = build(P0.clone().addScaledVector(sl, -k));
  }
  if (sl) {
    // 손발 순서 (사장님 10/31 22:xx '손발 맞춤으로' → '이론적으로 생각하면 발과 몸이 먼저 (굉장히 빠르게) 파고들고 손으로 빠르게 치는 게 맞긴 해' ·
    //  10/31 00:xx '칼이 닿기까지 시간이 왜 정해져있는가? 속도(고노센의 30%)에 따라 결정되는게 아닌가?'):
    //  sync 1 = 몸 · 발 먼저 · 칼은 앞발이 디디는 스텝에 출발: 앞발 발 뜬 시간 Tf = m.step.burstT(0 = 박찬 걸음 GAIT.burstT) 동안 칼은 맞물린 채 몸에 실려 감(맞힘 없음) ·
    //   디딤 스텝에 몫 빠르기로 출발(stepCombo dupLaunchTick — 디딤이 늦으면 기다리고 이르면 곧장) — 얼굴까지 시간은 길 ÷ 몫 빠르기 그대로(정해 둔 때 없음) ·
    //   몸 미끄러짐 꼴 = dupBurstProfile(m.step.match — 0 고르게 Tf 동안 · 1 · 2 첫 걸음 박차기 물리: 디딘 뒤에도 몸이 실려 감) → 얼굴은 칼이 얼굴을 지날 때(Tf + 얼굴까지 칼 시간) 미끄러진 몫 k 만큼 다가온 자리
    //  sync 2 = 고르게 늦춤(10/31 첫 판 — 칼날이 얼굴을 지나는 때 = 디딤 · 얼굴까지 칼을 고르게 늦춤 · 견줌) · sync 0 = 끔(칼은 몫 빠르기 그대로 · 박차기 시간 = 얼굴까지 칼 시간 · 박찬 걸음 GAIT.burstT 가운데 긴 것)
    const sync = m.step?.sync ?? 1;
    let t0 = z.tFace;
    let Tstep = Math.max(t0, GAIT.burstT);
    let Tfoot = Tstep;
    let sc = 1;
    let hold = 0;
    let prof = null;
    if (sync === 2 && t0 > 1e-6 && Tstep > t0) sc = Tstep / t0;
    if (sync === 1) {
      Tfoot = m.step?.burstT > 0 ? m.step.burstT : GAIT.burstT;
      prof = dupBurstProfile(f, I, m, Tfoot);
      if (m.step?.fit && prof.mode > 0) Tfoot = Math.min(Tfoot, Math.max(prof.T, 0.1)); // 길이 맞춤: 앞발은 박찬 걸음 그대로(GAIT.burstT) · 짧은 걸음은 몸이 서는 때 — 몸이 다 들어가 설 때 디디면(11/01 재기) 칼이 0.35 ~ 0.4 s 에야 나가 헛침 · 받은 것이 늘고 디딤 앞 멈칫이 생김
      for (let it = 0; it < 2; it++) {
        const k2 = clamp(prof.pos(Tfoot + z.tFace) / I.slide.slide, 0, 1);
        if (Math.abs(k2 - k) < 0.02) break;
        k = k2;
        z = build(P0.clone().addScaledVector(sl, -k));
      }
      t0 = z.tFace;
      Tstep = prof.T;
      hold = Tfoot;
    }
    let Tfol = 0;
    z.segs.forEach((sg, j) => {
      if (j < z.iFace) {
        if (sc !== 1) sg.T *= sc;
      } else Tfol += sg.T;
    });
    if (hold > 0) {
      // 맞물린 채 몸에 실려 감 (칼 자세 그대로 · 맞힘 · 막힘 없음 — 10/28 길 밀어 넣는 토막과 같은 뜻) · 날 쪽은 처음부터 칠 쪽으로 (dupHoldHint — 출발 때 칼 면이 한 스텝에 돌지 않게) · launch = 앞발 디딤에 끝남
      const B0 = { H: A.H.clone(), D: A.D.clone(), px: A.px, pad: null };
      z.segs.unshift({ cut: false, hold: true, launch: true, A, B: B0, T: hold });
      z.iFace += 1;
      const s1 = z.segs[1];
      if (s1) {
        const tip = (q) => q.H.clone().addScaledVector(q.D.clone().normalize(), f.weaponCfg.hiltLength + 0.6 * f.weaponCfg.bladeLength);
        I.dupHoldHint = tip(s1.B).sub(tip(A));
      }
    }
    z.tFace = z.segs.slice(0, z.iFace).reduce((x, sg) => x + sg.T, 0);
    // 칼이 다 끌린 뒤에도 몸이 아직 실려 가면(첫 걸음 박차기 물리 — 세게 멈춤) 끝 자세 그대로 몸이 다 설 때까지 (맞힘 없음)
    const tail = sync === 1 ? Tstep - (z.tFace + Tfol) : 0;
    if (tail > 1e-3) {
      const Z = z.segs[z.segs.length - 1].B;
      z.segs.push({ cut: false, tail: true, A: Z, B: { H: Z.H.clone(), D: Z.D.clone(), px: Z.px, pad: null }, T: tail });
    }
    I.dupStepT = Tstep; // 몸 미끄러짐 시간 (dupBurstStart)
    I.dupFootT = Tfoot; // 앞발 발 뜬 시간 (dupBurstStart — sync 1 은 박찬 걸음 그대로 · 아니면 미끄러짐과 같음)
    I.dupProf = prof; // 몸 미끄러짐 꼴 (sync 1)
    if (I.maxT > 0) I.maxT = I.t + Math.max(Tstep, z.tFace + Tfol); // 상한을 따로 준 판만(`?dupSnapTime=`): 길 끝 · 몸이 다 설 때까지로 늘림 — 기본은 상한 없음(dupSnapTime 0 · 사장님 11/01 00:xx '공격이 몇 초 안에 끝나야한다 이런 기준 없애라') · 칼은 길 끝까지
    z.slow = sc;
    z.hold = hold;
    z.t0 = t0;
    z.Tfoot = Tfoot;
    z.tail = tail > 1e-3 ? tail : 0;
  } else I.dupStepT = null;
  const r2 = (v) => +v.toFixed(2);
  I.dup = { p0: p0.map(r2), p1: z.p1.map(r2), p2: z.p2.map(r2), padLen: +z.padLen.toFixed(3), dFace: +z.dFace.toFixed(3), sweep: +(z.sweep / D2R).toFixed(1), k: +k.toFixed(2), tFace: +z.tFace.toFixed(3), Tstep: I.dupStepT == null ? null : +I.dupStepT.toFixed(3), Tfoot: z.Tfoot == null ? null : +z.Tfoot.toFixed(3), tail: z.tail ?? null, match: I.dupProf?.mode ?? null, v0: I.dupProf?.v0 == null ? null : +I.dupProf.v0.toFixed(3), fitStep: fit, tB: +z.tB.toFixed(2), slow: z.slow == null ? null : +z.slow.toFixed(2), hold: z.hold == null ? null : +z.hold.toFixed(3), t0: z.t0 == null ? null : +z.t0.toFixed(3), edge1: z.edge1 == null ? null : +z.edge1.toFixed(2), side: z.side, fit: +c0b.toFixed(3), line: 1 };
  I.dupEdgeSide = z.side ?? null; // 이 칼이 쓰는 날 (1 긴 · −1 짧은 — 날 쪽 hint 부호 · stepCombo)
  I.dupGlide = true; // 처음 닿아 있던 상대 칼에 닿아 있는 동안은 막힘이 아님 (comboPlanDup 과 같음)
  I.aim = 'face';
  return z.segs;
}

/**
 * 겹치기 앞 박차기 (10/31 19:xx 사장님 '박차기를 앞으로 쓰면서 치는 효과를 넣자. 앞 박차기는 현재 게임 커맨드로 불가능하니 겹치기와 함께만 발동' — UNIQUE_ASSIST.dupBurst):
 *  길을 짠 뒤(comboNext) 칼과 같은 시간에 — 몸 미끄러짐(I.slide — 고노센 발도 · 날개 접기 걸음과 같은 shiftFighter)을 칼이 끌리는 시간 전체(시간 상한 안)에 고르게 ·
 *  앞발 걸음(gait 'lunge' — 날개 접기 걸음과 같은 꼴 · 발 뜬 시간 = 칼이 끌리는 시간 → 칼이 얼굴을 지난 뒤 끝 따라 돌기 동안 디딤 · 몸 가속 한도 × 박차기 burstAccel)을 같은 스텝에 시작.
 *  기력: 박찬 걸음과 같은 pushCost 12 (stamina.burst — 죽음의 일격 강제 박차기 burstFree 와 같은 틀: free 면 안 냄). 재기 I.burst
 */
function dupBurstStart(f, I, m, span) {
  const S = I.slide;
  const T0 = I.dupStepT > 0 ? I.dupStepT : span; // 길이 정한 몸 미끄러짐 시간 (comboPlanDupLine)
  const T = I.maxT > 0 ? Math.min(T0, Math.max(0, I.maxT - I.t)) : T0;
  if (!S || !(S.slide > 1e-3) || !(T > 0)) return;
  S.span = T;
  if (I.dupProf) {
    S.pos = I.dupProf.pos; // 손발 순서 (sync 1): 몸 미끄러짐 꼴 (dupBurstProfile — 고르게 · 첫 걸음 박차기 물리)
    if (I.dupProf.closed) {
      const p = f.bodies.pelvis.translation();
      S.p0 = { x: p.x, z: p.z }; // 골반 자리 맞춤의 원점
    }
  }
  else S.ease = 'line'; // 고르게 (칼끝이 고른 빠르기로 끌리는 동안 몸도 고른 빠르기 — 손과 몸이 한 움직임)
  const Tf = I.dupFootT > 0 ? Math.min(I.dupFootT, T0) : T; // 앞발 발 뜬 시간 (sync 1 = 박찬 걸음 GAIT.burstT 그대로)
  const k = f.stamina?.attackSpeed > 0 ? f.stamina.attackSpeed : 1; // 지친 몸은 칼 시간이 늘어남 (stepCombo I.t) — 걸음도 같은 실제 시간에
  const g = f.gait;
  const why = !g?.active ? 'gait' : f.state !== 'stand' ? 'state' : f.feetHeld ? 'held' : (f.move?.y ?? 0) < -0.1 ? 'back' : !g.legs?.F.stance || !g.legs?.B.stance ? 'swing' : 'stand'; // 재기: 걸음을 부탁할 때 다리 · 스틱
  const asked = g?.active ? g.takeStep({ kind: 'lunge', fwd: S.slide, duration: Tf / k, minT: Tf / k, accel: true, force: true }) : false; // 앞발이 이미 떠 있으면 그 걸음을 이어받음 (gait.js takeStep)
  if (!m.step.free) f.stamina?.burst();
  I.burst = { slide: +S.slide.toFixed(3), T: +T.toFixed(3), Tf: +Tf.toFixed(3), asked: !!asked, why, match: I.dupProf?.mode ?? null, v0: I.dupProf?.v0 == null ? null : +I.dupProf.v0.toFixed(3), plantT: null, launchT: null };
  I.burstFoot = asked && I.segs[0]?.launch ? { mi: I.mi, t0: I.t, leg: null, plantT: null, launchT: null } : null; // 칼 출발 = 앞발 디딤 (stepCombo dupLaunchTick — 시간 한도 없음)
}

/**
 * 겹치기 박차기 몸 미끄러짐 꼴 (comboPlanDupLine sync 1 · m.step.match — UNIQUE_ASSIST.dupBurstMatch) → { mode, T(다 미끄러지는 시간), v0, pos(t) — 지난 시간(게임 초) → 미끄러진 거리 }:
 *  0 = 고르게 (앞발 발 뜬 시간 Tf 동안 같은 빠르기)
 *  1 = 첫 걸음 박차기 물리 그대로 (감독 10/31 23:xx — 사장님 '원래의 박차기 속도와 비슷한가?'): 골반이 지금 앞 빠르기 v0 에서 가속 한도 GAIT.maxAccel × burstAccel 로 GAIT.burstBackV 까지 ·
 *   박찬 뒤 세게 멈춤과 같은 한도로 줄여 dupBurst 에서 섬. 골반 자리를 그 꼴로 맞춤(closed — stepCombo: 몸 미끄러짐 = 꼴 자리 − 골반이 실제 간 거리 · 뒤로는 안 당김) —
 *   걸음 · 균형이 몸을 함께 밀어도 골반 빠르기가 박찬 빠르기를 넘지 않게
 *  2 = 1 과 같되 줄임 없이 dupBurst 에 닿으면 섬
 */
function dupBurstProfile(f, I, m, Tf) {
  const S = I.slide.slide;
  const mode = m.step?.match ?? 0;
  if (!(mode > 0)) return { mode: 0, T: Tf, v0: null, pos: (t) => S * clamp(t / Tf, 0, 1) };
  const a = GAIT.maxAccel * GAIT.burstAccel;
  const V = GAIT.burstBackV;
  const lv = f.bodies.pelvis.linvel();
  const v0 = clamp(lv.x * I.slide.dx + lv.z * I.slide.dz, 0, V);
  const s1 = (V * V - v0 * v0) / (2 * a); // v0 → V 까지 간 거리 · 줄이는 몫 = 간격 잡기(gait.js holdTick)와 같은 세게 멈춤 거리 v² ÷ (2 · maxAccel · burstAccel)
  let T;
  let pos;
  if (mode === 1 && s1 + (V * V) / (2 * a) >= S) {
    // 빨라지다 곧장 줄임 (V 에 못 닿음)
    const vp = Math.sqrt(a * S + (v0 * v0) / 2);
    const t1 = (vp - v0) / a;
    T = t1 + vp / a;
    pos = (t) => (t <= 0 ? 0 : t < t1 ? v0 * t + 0.5 * a * t * t : t < T ? S - 0.5 * a * (T - t) ** 2 : S);
  } else if (mode === 1) {
    const t1 = (V - v0) / a;
    const tc = (S - s1 - (V * V) / (2 * a)) / V;
    T = t1 + tc + V / a;
    pos = (t) => (t <= 0 ? 0 : t < t1 ? v0 * t + 0.5 * a * t * t : t < t1 + tc ? s1 + V * (t - t1) : t < T ? S - 0.5 * a * (T - t) ** 2 : S);
  } else if (s1 >= S) {
    T = (-v0 + Math.sqrt(v0 * v0 + 2 * a * S)) / a;
    pos = (t) => (t <= 0 ? 0 : t < T ? v0 * t + 0.5 * a * t * t : S);
  } else {
    const t1 = (V - v0) / a;
    T = t1 + (S - s1) / V;
    pos = (t) => (t <= 0 ? 0 : t < t1 ? v0 * t + 0.5 * a * t * t : t < T ? s1 + V * (t - t1) : S);
  }
  return { mode, T, v0, pos, closed: true };
}

/**
 * 겹치기 칼 출발 = 앞발 디딤 (사장님 10/31 00:xx — 얼굴까지 시간은 길 ÷ 몫 빠르기): 박찬 앞발이 디딘 스텝에 실려 가는 토막(launch)을 끝냄 —
 *  디딤이 짠 때보다 이르면 곧장 · 늦으면 그 발이 아직 그 걸음으로 떠 있는 동안 기다림(시간 한도 없음 — 사장님 11/01 00:xx) ·
 *  걸음이 없어지면(넘어짐 · 걸음 꺼짐 · 다른 걸음이 덮음 · 부탁이 버려짐) 곧장. 상한을 따로 준 판만 끄는 시간 상한도 그만큼 옮김. 재기 I.burst.plantT · launchT (낸 때부터 게임 초)
 */
function dupLaunchTick(f, I) {
  const B = I.burstFoot;
  if (I.mi !== B.mi) return;
  const L = f.gait?.legs;
  if (B.plantT == null && L) {
    if (!B.leg) for (const k of ['F', 'B']) if (L[k] && !L[k].stance && L[k].kind === 'req') B.leg = k;
    if (B.leg && L[B.leg].stance) {
      B.plantT = I.t;
      if (I.burst) I.burst.plantT = +(I.t - B.t0).toFixed(3);
    }
  }
  const sg = I.segs[I.si];
  if (!sg?.launch || B.launchT != null) return;
  const end = I.ts + sg.T;
  const g = f.gait;
  const live = !!g?.active && f.state === 'stand' && (B.leg ? !L[B.leg].stance && L[B.leg].kind === 'req' : !!g.req); // 그 걸음이 아직 살아 있음 (발이 그 걸음으로 떠 있거나 부탁이 남음)
  const go = B.plantT != null || !live;
  let d = 0;
  if (go) d = Math.min(0, I.t - end);
  else if (I.t >= end) d = I.t - end + 1e-4;
  if (d) {
    sg.T += d;
    if (I.maxT > 0) I.maxT += d;
  }
  if (go) {
    B.launchT = I.ts + sg.T;
    if (I.burst) I.burst.launchT = +(B.launchT - B.t0).toFixed(3);
  }
}

/** 몸 틀 손 자리 → 그 손을 부르는 패드 (날것 매핑 z = 0.1 + x · y = 0.1 + y 를 거꾸로, 패드 안으로) — 연환이 끝난 뒤 손 목표를 그 자리에 둔다 (endCombo snapAim) */
function comboPad(H) {
  return [clamp(H.z - 0.1, -0.6, 0.6), clamp(H.y - 0.1, -0.6, 0.6)];
}

/** 두 발(다리 걸음이 딛은 자리)의 앞뒤 간격 (m — 몸 앞 방향으로) · 다리 걸음이 없으면 null (안다레 리솔루토 런지 되돌아오기 — skill.js) */
export function stanceSpread(f) {
  const L = f.gait?.legs;
  if (!L?.F || !L?.B) return null;
  const fw = f.forward(new THREE.Vector3());
  return Math.abs((L.F.plant.x - L.B.plant.x) * fw.x + (L.F.plant.z - L.B.plant.z) * fw.z);
}

/** 새 수에 들어섬: 이름 · 수마다 한 번 맞음 · 반걸음(몸 미끄러짐 + 다리 걸음 — 시간 몫은 comboNext 가 길을 짠 뒤 채움) */
function comboMoveStart(f, I, mi) {
  const m = I.moves[mi];
  I.mi = mi;
  if (!m.same) f.stamina.attack(m.kind === 'thrust' || m.dyn?.kind === 'thrust' ? 'thrust' : 'cut', true); // same: 손가락 긋기를 이어 끄는 칼(제비 베기 되돌림 칼 — 10/25)은 새 공격이 아니다 (기력 청구 · 유파 패시브 묶음 그대로 — 켄타이 넘김이 제비 베기에 실림)
  I.moveName = m.name;
  I.hitM = false;
  I.blockM = false;
  I.slide = null;
  const st = m.step;
  const fwd = st?.fit ? 9 : typeof st?.fwd === 'number' ? st.fwd : 0; // 겹치기 박차기 길이 맞춤 (11/01): 걸음 한도는 st.stop(몸통이 맞닿는 거리)까지 — 길이는 길을 짜며 정함 (comboPlanDupLine)
  if (!fwd || !f.foe) return;
  const M = f.swordArt.measure;
  const c = f.bodies.chest.translation();
  const fc = f.foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  // 안다레 리솔루토 런지(앞발 st.foot 이 있는 수 — SECRET.risolutoStep 만)는 이탈리아 간격 줄 'contact' 판에서 지금 맞닿음으로 멈춤 (weapon_measured.js risolutoContact · 없으면 몸 간격 그대로)
  const contact = (st.foot != null && risolutoContact(f.weapon?.id)) || M.contact;
  let slide = fwd > 0 ? Math.min(st.close ? fwd : clamp(d - contact, 0, fwd), Math.max(0, d - (st.stop ?? M.clinch))) : fwd; // st.stop: 이 가슴 사이에서 멈춤 (겹치기 앞 박차기 — 죽음의 일격 거리 SECRET.mordCloseN · 없으면 clinch) // 앞 = 발도 미끄러짐과 같은 한도(close — 날개 접기 10/28: 맞닿기에서 멈추지 않고 걸음만큼 · clinch 안 금지 그대로) · 뒤(물러남 — 10/12 3 연격) = 반걸음 그대로
  if (slide < 0) {
    // 물러남은 경기장 테두리(ARENA.radius — 이미 있는 값)를 넘지 않게: 끝 자리 가슴이 반지름 밖이면 그 안까지만
    const ex = c.x + dx * slide;
    const ez = c.z + dz * slide;
    if (Math.hypot(ex, ez) > ARENA.radius) slide = -Math.max(0, Math.min(-slide, ARENA.radius - Math.hypot(c.x, c.z)));
  }
  if (Math.abs(slide) > 1e-3) I.slide = { dx, dz, slide, t0: I.t, span: 1, done: 0 };

  // 앞발 걸음: st.foot 이 있으면 몸 미끄러짐(fwd)과 따로 (안다레 리솔루토 런지 — 앞발 SECRET.italianStep) · st.room 이면 미끄러짐과 같은 한도로 미끄러진 뒤 가슴 사이가
  //  맞붙는 거리(clinch) 안으로 들지 않을 만큼까지만(걸음 동안 몸이 따라 나가 상대 몸에 붙지 않게 — 브라우저: 0.9 m 그대로 디디면 가슴 사이 1.82 → 0.94 m · 기본 끔 SECRET.risolutoStep.room) ·
  //  st.draw 면 디딘 뒤 뒷발 끌어붙임 (유파 걸음 drawT — 런지 뒤 자세로). 둘 다 없으면 전과 같음
  const foot = st.foot != null ? (st.room ? Math.min(st.foot, Math.max(0, d - Math.max(0, slide) - M.clinch)) : st.foot) : fwd;
  if (st.foot != null) I.footStep = foot; // 재기
  //  st.push 면 걸음 동안 몸 따라감 배율 (런지 — 엇박 찌르기 런지와 같은 SECRET.stepPush: 골반이 앞발 쪽으로 실려 앞무릎이 굽고 뒷다리가 펴짐)
  if (st.burst) return; // 겹치기 앞 박차기: 앞발 걸음은 길을 짠 뒤 칼 시간에 맞춰 (comboNext → dupBurstStart)
  const asked = f.gait?.active && (st.foot == null || foot > 1e-3) ? f.gait.requestStep({ kind: st.kind ?? 'lunge', fwd: foot, side: st.lat ?? 0, duration: st.dur ?? 0.35, ...(st.draw ? { draw: true } : {}), ...(st.push ? { push: st.push } : {}), ...(st.accel ? { accel: true } : {}) }) : false;
  if (st.foot != null) {
    f.lungeReq = asked ? f.gait.req : null; // 런지 앞발 걸음 (skill.js lungeRecoverTick — 디디고 몸이 다 실리면 앞발을 뒤로 거둠)
    f.lungeSpread0 = asked ? stanceSpread(f) : null; // 런지 전 두 발 앞뒤 간격 (되돌아오기가 그 보폭까지 거둠)
  }
}

function stepCombo(f, combat) {
  const I = f.iai;
  const dt = combat.dt || 1 / 120;
  const foe = f.foe;
  if (!f.alive || !f.armed || !foe) return endCombo(f, combat);
  if (I.mord && !f.mordAim) return endCombo(f, combat); // 죽음의 일격이 끊겨(skill.js secretEnd → mordEnd) 이미 원래 쥠이면 거꾸로 놓기를 멈춘다
  const t0 = I.t;
  const mi0 = I.mi;
  const si0 = I.si;
  I.t += dt * f.stamina.attackSpeed;
  f.instantGhost = Math.max(f.instantGhost ?? 0, Math.ceil(SECRET.instantNoCollide / dt) + 1);
  if (I.burstFoot) dupLaunchTick(f, I); // 겹치기 칼 출발 = 앞발 디딤
  // 토막 넘기기 — 이 수의 토막이 끝나면 다음 수를 지금 자리에서 짠다 (없으면 끝)
  for (;;) {
    while (I.si < I.segs.length && I.t >= I.ts + I.segs[I.si].T) {
      I.ts += I.segs[I.si].T;
      I.cur = I.segs[I.si].B;
      I.last = I.segs[I.si].B;
      I.si++;
    }
    if (I.si < I.segs.length) break;
    if (!comboNext(f, I)) {
      placeIai(f, I.cur.H, I.cur.D, false, I.cur.turn ?? 0, I.edgeHint ?? null, !!(I.moves[I.mi]?.band || I.moves[I.mi]?.roll));
      if (I.moves[I.mi]?.lunge) lungeSweep(f, I, combat, t0, I.t); // 런지: 이 스텝에 남은 토막(찌름 · 뽑음)을 지났으면 그 길도 본다
      return endCombo(f, combat);
    }
  }
  const sg = I.segs[I.si];
  // 겨눈 찌름(comboPlanAim thrust — 격살 허파 찌르기): 이 스텝에 맞힘 없는 겨눔 토막에서 찌르는 토막으로 넘어왔으면 쓸린 자리를 찌르는 토막 첫 자리부터 본다.
  //  지난 스텝 자리(겨눔 토막 가운데)부터 보면 겨눔의 옆 움직임이 찌름 방향에 섞여, 칼끝이 이미 몸 깊이에 든 맞닿기 언저리에서 찌름이 베기로 셈됐다
  //  (10/24 17:2x 뒤 — 시작 자세가 바뀌면 겨눔이 끝나는 스텝이 달라져 맞닿기 −0.1 ~ +0.1 m 의 찌름 17 → 8 / 20 · 런지 lungeSweep 과 같은 까닭 · SECRET.thrustSweep)
  if (SECRET.thrustSweep && I.mi === mi0 && I.si > si0 && sg?.cut && !I.mord && I.moves[I.mi]?.dyn?.thrust) {
    let k = I.si;
    while (k > si0 && I.segs[k - 1].cut) k--;
    if (k > si0) {
      const A = I.segs[k].A;
      const D = A.D.clone().applyQuaternion(I.yaw).normalize();
      I.prev = { B: A.H.clone().applyQuaternion(I.yaw).add(tv(f.bodies.chest.translation(), new THREE.Vector3())).addScaledVector(D, f.weaponCfg.hiltLength), D };
    }
  }
  // 반걸음 몸 미끄러짐 (발도와 같은 꼴 — 부드럽게 줄며)
  const S = I.slide;
  if (S) {
    const x = Math.min(1, (I.t - S.t0) / S.span);
    let want = S.pos ? S.pos(I.t - S.t0) : S.slide * (S.ease === 'line' ? x : 1 - (1 - x) * (1 - x)); // line: 고르게 (겹치기 앞 박차기 — 칼과 같은 고른 빠르기) · pos: 겹치기 박차기 꼴 (dupBurstProfile)
    if (S.p0) {
      // 골반 자리 맞춤 (첫 걸음 박차기 물리): 꼴 자리 − 골반이 실제 간 거리만큼만 (뒤로는 안 당김 · 미끄러짐 합은 S.slide 까지)
      const p = f.bodies.pelvis.translation();
      const got = (p.x - S.p0.x) * S.dx + (p.z - S.p0.z) * S.dz;
      want = S.done + clamp(want - got, 0, S.slide - S.done);
    }
    const ds = want - S.done;
    if (Math.abs(ds) > 1e-5) shiftFighter(f, S.dx * ds, S.dz * ds);
    S.done = want;
    I.slideDs = (I.slideDs ?? new THREE.Vector3()).set(S.dx * ds, 0, S.dz * ds); // 이 스텝 몸 옮김 (겹치기 날 쪽 — hintBody)
  }
  if (I.mord?.trk) mordTrack(f, I); // 죽음의 일격 머리 따라 겨눔 (10/30 시제품 — SECRET.mord.track · 기본 끔)
  const u = sg.T > 0 ? clamp((I.t - I.ts) / sg.T, 0, 1) : 1;
  const P = comboLerp(sg, u);
  I.cutting = sg.cut;
  const bp = I.moves[I.mi]?.bodyPose; // 겹치기 몸 (10/28 — 엇갈린 손: UNIQUE_ASSIST.dupBody [골반 °, 가슴 °, 숙임 °, 낮춤 m] — 이 수 동안 손 쪽 몸 돌림에서 그 꼴로)
  if (bp) {
    const b0 = I.moves[I.mi]?.bodyFrom ?? comboBody(P.px); // bodyFrom: 이 수의 몸 처음 꼴 (B4 멘 몸 꼬임 — 10/31 19:xx requestArtRedondo tajo) · 없으면 손 쪽 몸 돌림 (전과 같음)
    const w = clamp((I.t - I.segT0) / Math.max(1e-3, I.segs.reduce((a, x) => a + x.T, 0)), 0, 1);
    I.body = { pelvisYaw: b0.pelvisYaw + (bp[0] - b0.pelvisYaw) * w, chestYaw: b0.chestYaw + (bp[1] - b0.chestYaw) * w, pitch: b0.pitch + (bp[2] - b0.pitch) * w, drop: b0.drop + (bp[3] - b0.drop) * w };
  } else I.body = comboBody(P.px);
  I.cur = P;
  if (I.mord?.regrip) mordRegripStep(f, I, sg, u); // 죽음의 일격 자연스러운 쥠 바꿈 (10/31 시제품 — SECRET.mord.regrip · 기본 끔)
  // 제비 베기 되돌림 칼(cutSweep — 10/25): 날이 칼끝이 가는 쪽(길 위 이 자리 칼끝 − 지난 스텝 칼끝)을 향하게 (날 세우기)
  if (I.moves[I.mi]?.cutSweep && I.prev?.tip) {
    const Dw = P.D.clone().applyQuaternion(I.yaw).normalize();
    const tipP = P.H.clone().applyQuaternion(I.yaw).add(tv(f.bodies.chest.translation(), new THREE.Vector3())).addScaledVector(Dw, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength);
    //  pathHint (곧은 제비 베기 — 10/31): 칼끝이 가는 쪽 = 길 위 이 자리 − 길 위 지난 자리 (놓인 칼끝이 아니라) — 손목 교정이 놓인 칼끝을 옮기면 다음 스텝 날 쪽이 비틀려
    //   날 쪽 · 손목 교정이 스텝마다 오가며 곧은 길이 꺾였다. 없으면 10/25 그대로(놓인 지난 칼끝)
    const ref = I.moves[I.mi]?.pathHint ? I.pathTip ?? I.prev.tip : I.prev.tip;
    let hint = tipP.clone().sub(ref);
    if (I.moves[I.mi]?.pathHint) I.pathTip = tipP;
    if (I.moves[I.mi]?.hintBody) {
      // 겹치기 단순 길 (10/31): 날 쪽 = 짠 길에서 칼날 0.6 자리(흔히 닿는 곳)가 실제로 가는 쪽 — 몸 틀 길의 옮김(세계로) + 이 스텝 박차기 몸 옮김.
      //  놓인 칼끝으로 재면 손목 교정 몫이 섞여 날 쪽이 스텝마다 흔들리고, 몸 옮김을 빼면 박차기가 칼을 앞으로 실어 가는 동안 칼 면으로 닿음(22:xx 판 — 날 앞장 16 %)
      const tb = P.H.clone().addScaledVector(P.D.clone().normalize(), f.weaponCfg.hiltLength + 0.6 * f.weaponCfg.bladeLength);
      if (sg?.hold && I.dupHoldHint) hint = I.dupHoldHint.clone().applyQuaternion(I.yaw); // 맞물린 채 실려 가는 동안은 칠 쪽으로 날을 미리 세움
      else if (sg?.tail) hint = null; // 끝 자세로 몸이 다 설 때까지: 날 쪽 그대로 (I.edgeHint)
      else if (I.bodyTip) {
        hint = tb.clone().sub(I.bodyTip).applyQuaternion(I.yaw);
        if (I.slide && I.slideDs) hint.add(I.slideDs);
      }
      I.bodyTip = tb;
    }
    if (hint && (I.dupEdgeSide ?? I.moves[I.mi]?.edge) < 0) hint.negate(); // 겹치기 짧은 날 (UNIQUE_ASSIST.dupEdge −1 · 단순 길이 짧은 날을 고른 칼 dupEdgeSide — 칼 면 +x 날의 반대가 앞장)
    if (hint && hint.lengthSq() > 1e-8) I.edgeHint = hint;
  }
  const cur = placeIai(f, P.H, P.D, false, P.turn, I.moves[I.mi]?.cutSweep ? I.edgeHint ?? null : null, !!(I.moves[I.mi]?.band || I.moves[I.mi]?.roll)); // roll: 굴림 묶음만 (칼끝 돌려 빼기 — 10/28)
  const subs = I.moves[I.mi]?.lunge ? 0 : 3; // 런지는 아래 lungeSweep (지나온 토막 길을 따라)
  // 제비 베기 되돌림 칼(10/25 — requestArtSnap 의 cutSweep): 꺾은 자리로 거두는 준비 토막(맞힘 없음)에서 베는 토막으로 넘어온 스텝은 맞힘을 보지 않는다 —
  //  그 스텝 쓸린 자리가 준비 토막(내려간 칼 자리 — 상대 다리 곁)부터 베기로 셈됐다 (겨눈 찌름 thrustSweep 과 같은 까닭 · 길 점 자리는 팔이 다 닿지 않아 실제 놓인 칼과 달라 그 자리부터 재지 않음)
  const fresh = !!I.moves[I.mi]?.cutSweep && I.mi === mi0 && !!sg?.cut && !I.segs[si0]?.cut;
  if (!subs) lungeSweep(f, I, combat, t0, I.t);
  for (let k = 1; k <= subs; k++) {
    const w = k / subs;
    const B = I.prev.B.clone().lerp(cur.B, w);
    const D = I.prev.D.clone().lerp(cur.D, w).normalize();
    const tip = B.clone().addScaledVector(D, I.mord ? I.mord.Lp : f.weaponCfg.bladeLength); // 죽음의 일격: 손 → 칼자루 끝 (치는 막대)
    // 잔상 (10/23 사장님 '잔상과 궤적도 비기에 걸맞는지 체크해'): 사람 비기(모르트슐라크 · 격살 — arcCut)는 베는 토막(맞음이 날 수 있는 몫)만 — 준비 · 다시 세우기는 그리지 않는다
    if (!I.noArc && (!I.arcCut || (sg.cut && !(fresh && I.moves[I.mi]?.cleanArc)))) { // cleanArc (곧은 제비 베기 — 10/31): 준비 토막에서 넘어온 스텝도 안 그림 (그 스텝 조각은 준비 토막 끝 → 베는 줄이라 옆으로 꺾임)
      I.arc.pts.push([B.x, B.y, B.z, tip.x, tip.y, tip.z]);
      if (I.arcCut && f.instantArc !== I.arc) f.instantArc = I.arc;
    }
    if (!sg.cut || fresh || I.hitM || I.blockM || !foe.alive || foe.state === 'dead') continue;
    // 몸보다 먼저 상대 칼에 닿으면 이 수는 막힘 (이베리아 휩쓸기와 같은 거리 — 밀어냄 없음) · 죽음의 일격은 넘어 들어감 규칙(SECRET.mordOver)이면 막힘 없음
    // 겹치기(10/28 — 맞닿은 자리를 축으로 감아 돌림): 처음 붙어 있던 상대 칼에 닿아 있는 동안은 막힘이 아님 · 한 번 떨어진(같은 거리 밖) 뒤 다시 닿으면 막힘 (붙은 칼 따라 미끄러짐 risolutoGlide 와 같은 규칙 · 새 수 없음)
    const bd = foe.armed && foe.sword ? segSegApprox(B, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) : Infinity;
    if (I.dupGlide && I.moves[I.mi]?.dup) {
      if (bd >= SECRET.iberianBlockDist) I.dupGlide = false;
      else I.glided = (I.glided ?? 0) + 1;
    } else if (!I.mord?.over && bd < SECRET.iberianBlockDist) {
      I.blockM = true;
      I.blocked++;
      continue;
    }
    let best = null;
    for (const [h, info] of f.colliderInfo) {
      if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
      const col = f.world.getCollider(h);
      if (!col) continue;
      const r = segToCollider(B, tip, col);
      if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { h, info, col, r };
    }
    if (best) {
      const prevW = Math.max(0, w - 1 / subs);
      const P0 = { B: I.prev.B.clone().lerp(cur.B, prevW), D: I.prev.D.clone().lerp(cur.D, prevW).normalize() };
      I.hitM = true;
      const res = instantWound(f, foe, [P0, { B, D }], { i: 1, best }, combat, 0, dt / subs, I.hitMul, I.effMul, I.mord);
      if (res) {
        I.hits++;
        I.E += res.energy;
        I.Emax = Math.max(I.Emax, res.energy);
        I.part = best.info.part;
        I.zone = res.zone;
        I.type = res.type;
        I.sev = Math.max(I.sev ?? 0, res.severity ?? 0); // 격살 재기 (판정에는 안 씀)
      }
    }
  }
  I.prev = cur;
  // 막힘: 이 수의 남은 길을 건너뛰고 다음 수를 지금 자리에서 짠다 (다음 수가 없으면 끝) · 죽음의 일격은 다시 세우기 토막으로 (한 번)
  if (I.blockM && I.mord && !I.mordBacked) {
    I.mordBacked = true;
    comboMordBack(f, I);
  } else if (I.blockM && !I.mord && !comboNext(f, I)) return endCombo(f, combat);
  else if (I.maxT > 0 && I.t >= I.maxT) return endCombo(f, combat); // 시간 상한 (제비 베기 되돌림 칼 — 이 스텝 자리에서 끝)
}

/**
 * 안다레 리솔루토 런지의 쓸린 자리 (10/24 — 고노센 칼끝 빠르기): 한 물리 스텝에 겨눔 → 찌름 → 뽑음 토막을 여럿 지나므로 연환처럼 '지난 자리 → 지금 자리' 사이만 보면
 *  찌른 끝을 건너뛴다(탐침: 맞힘 0 · 끝을 스텝마다 놓게 멈추면 빠르기가 줄어 마지막 짧은 스텝에 닿은 찌르기가 3 m/s · 13 J 로 셈됨). 그래서 이 스텝(t0 → t1)에 지난
 *  토막마다 3 조각으로 길 위 자리(comboLerp — 몸 틀)를 그때 가슴 자리(지난 · 지금 가슴 사이)로 월드에 옮겨(손 = 팔 IK 목표 · 칼자루 → 칼날) 맞힘을 본다 (지난 점도 같은 식 — 빠르기가 한 식에서).
 *  맞힘 토막만 잔상 · 맞힘(수마다 한 번) — 빠르기 = 그 조각 사이 칼 자리 옮김 ÷ 그 조각의 실제 시간 (연환과 같은 상처 함수 · 판정 배율 hitMul).
 *  막힘 = 연환과 같은 거리(iberianBlockDist) · 붙은 칼 따라 미끄러짐(m.glide · SECRET.risolutoGlide — 원전 [156] '칼날을 놓지 말고 따라 미끄러져 몸까지'): 처음 붙어 있던 상대 칼에
 *  닿아 있는 동안은 막힘이 아님 · 한 번 떨어진(같은 거리 밖) 뒤 다시 닿으면 막힘
 */
function lungeSweep(f, I, combat, t0, t1) {
  const foe = f.foe;
  const c1 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const c0 = I.cPrev ?? c1;
  I.cPrev = c1;
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const m = I.moves[I.mi];
  const T0 = I.segT0 ?? I.ts;
  const tEnd = I.segs.reduce((a, sg) => a + sg.T, T0);
  // 길 위 자리 (때 t — 몸 틀 길을 그때 가슴 자리로 월드에: 손 = 팔 IK 목표 · 칼자루 → 칼날). 지난 점 · 지금 점도 같은 식으로 (빠르기가 한 식에서 나오게)
  const poseAt = (t) => {
    let s0 = T0;
    let sg = I.segs[I.segs.length - 1];
    for (const g of I.segs) {
      if (t <= s0 + g.T + 1e-12) {
        sg = g;
        break;
      }
      s0 += g.T;
    }
    if (t > s0 + sg.T) s0 = t - sg.T;
    const P = comboLerp(sg, sg.T > 0 ? clamp((t - s0) / sg.T, 0, 1) : 1);
    const c = c0.clone().lerp(c1, t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 1);
    const D = P.D.clone().applyQuaternion(I.yaw).normalize();
    const B = P.H.clone().applyQuaternion(I.yaw).add(c).addScaledVector(D, HL);
    return { B, D, sg, t };
  };
  const ts = [];
  let s0 = T0;
  for (const sg of I.segs) {
    const s1 = s0 + sg.T;
    const a = Math.max(s0, t0);
    const b = Math.min(s1, t1, tEnd);
    if (b > a + 1e-9) for (let k = 1; k <= 3; k++) ts.push(a + ((b - a) * k) / 3);
    s0 = s1;
  }
  const rate = Math.max(1e-3, f.stamina.attackSpeed);
  let prev = poseAt(Math.min(t0, tEnd));
  for (const t of ts) {
    const q = poseAt(t);
    const { B, D } = q;
    const tip = B.clone().addScaledVector(D, BL);
    if (q.sg.cut) {
      if (!I.noArc) {
        I.arc.pts.push([B.x, B.y, B.z, tip.x, tip.y, tip.z]);
        if (f.instantArc !== I.arc) f.instantArc = I.arc;
      }
      // 재기 (판정에는 안 씀): 찌르는 토막 칼끝 빠르기 (월드 — 조각 사이 칼끝 옮김 ÷ 실제 시간) — 같은 칼 고노센 칼끝 iaiTipSpeed 와 견줌
      const dtq = (t - prev.t) / rate;
      if (dtq > 1e-6) {
        const v = tip.distanceTo(prev.B.clone().addScaledVector(prev.D, BL)) / dtq;
        I.tipL = (I.tipL ?? 0) + v * dtq;
        I.tipT = (I.tipT ?? 0) + dtq;
        I.tipVmax = Math.max(I.tipVmax ?? 0, v);
      }
    }
    if (q.sg.cut && !I.hitM && !I.blockM && foe?.alive && foe.state !== 'dead') {
      let blocked = false;
      if (foe.armed && foe.sword) {
        const near = segSegApprox(B, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) < SECRET.iberianBlockDist;
        const glide = !!m?.glide && !I.glideOff;
        if (glide && !near) I.glideOff = true;
        if (near && glide) I.glided = (I.glided ?? 0) + 1; // 재기 (판정에는 안 씀)
        if (near && !glide) {
          I.blockM = true;
          I.blocked++;
          blocked = true;
        }
      }
      let best = null;
      if (!blocked) {
        for (const [h, info] of f.colliderInfo) {
          if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
          const col = f.world.getCollider(h);
          if (!col) continue;
          const r = segToCollider(B, tip, col);
          if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { h, info, col, r };
        }
      }
      if (best) {
        I.hitM = true;
        const res = instantWound(f, foe, [{ B: prev.B, D: prev.D }, { B, D }], { i: 1, best }, combat, 0, Math.max(1e-4, (t - prev.t) / rate), I.hitMul, I.effMul, null);
        if (res) {
          I.hits++;
          I.E += res.energy;
          I.Emax = Math.max(I.Emax, res.energy);
          I.part = best.info.part;
          I.zone = res.zone;
          I.type = res.type;
          I.sev = Math.max(I.sev ?? 0, res.severity ?? 0);
        }
      }
    }
    prev = q;
  }
}

function endCombo(f, combat) {
  const I = f.iai;
  setKinematic(f, false);
  const v = tv(f.bodies.chest.linvel(), new THREE.Vector3());
  for (const n of [...ARM_PARTS, ...(I.off ? OFF_PARTS : []), null]) {
    const b = n ? f.bodies[n] : f.sword;
    if (!b) continue;
    b.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  if (I.mord) {
    // 죽음의 일격: 원래 쥠으로(칼끝 곧게 위 — mordschlag.js mordEnd) 돌아간 뒤 뗀 밧줄을 다시 건다 (굳음 붙잡기 방향 = 시작 자세의 칼자루 쪽 → 이제 칼끝 쪽 — 지붕)
    const R = I.mord.regrip;
    if (R && !R.done && I.mord.g > 1e-3) {
      // 쥠 바꿈 (10/31 시제품) 도중 끊김: 몸의 쥠은 아직 원래 — 칼을 칼 축 그대로 손잡이가 손목에 오게 옮김 (손목 관절이 칼을 홱 당기지 않게)
      const q = f.sword.rotation();
      const y = new THREE.Vector3(0, 1, 0).applyQuaternion(tq(q, new THREE.Quaternion()));
      const t = f.sword.translation();
      f.sword.setTranslation({ x: t.x + y.x * I.mord.g, y: t.y + y.y * I.mord.g, z: t.z + y.z * I.mord.g }, true);
      f.gripJoint?.setAnchor2({ x: 0, y: 0, z: 0 });
    }
    I.mord.end?.(f);
    if (f.iaiRopes) {
      if (f.iaiRopes.grip && f.armed && !f.gripCone) f.gripConeOn();
      if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
      f.iaiRopes = null;
    }
  }
  if (I.selfFree >= 1 && f.iaiRopes) {
    // 10/31 칼끝 돌려 빼기: 뗀 칼 어깨 면 밧줄을 다시 건다 (startCombo — UNIQUE_ASSIST.cavSelfFree)
    if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
    f.iaiRopes = null;
  }
  // 끝 자세를 경직 동안 붙잡는다 (발도와 같음) · 손 목표도 지금 토막 끝 길 점으로 (붙잡기가 풀린 뒤 칼이 막기 자리로 튀어 돌아가지 않게)
  const last = I.last ?? I.cur;
  const E = I.cur ?? last;
  const th = f.skill.thrustPose;
  th.w = 1;
  th.hand[0] = E.H.x;
  th.hand[1] = E.H.y;
  th.hand[2] = E.H.z;
  const flipDir = I.mord && (I.mord.regrip || I.mord.pommel) ? -1 : 1; // 쥠 바꿈 · 폼멜 찍기 (10/31 시제품): 끝 자세가 원래 쥠이라 D(칼자루 쪽)의 반대가 칼끝 쪽
  th.dir[0] = E.D.x * flipDir;
  th.dir[1] = E.D.y * flipDir;
  th.dir[2] = E.D.z * flipDir;
  const K = I.body;
  th.pelvisYaw = K.pelvisYaw * D2R;
  th.chestYaw = K.chestYaw * D2R;
  th.pitch = K.pitch * D2R;
  th.drop = K.drop;
  if (last?.pad && !I.keepAim) snapAim(f, last.pad);
  f.iaiHoldT = I.hold;
  f.iaiHoldKind = 'combo';
  f.iaiFade = I.hold > 0 ? 0 : 0.2; // 붙잡기 0 (제비 베기 되돌림 칼 — 비기 굳음이 아님)이면 곧장 손가락에 돌려준다 (holdIai 의 0.2 s 풀기 그대로)
  f.instantGhost = Math.max(f.instantGhost ?? 0, Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120)));
  // 10/24 15:5x 팔을 뻗은 겨눈 찌름(SECRET.thrustArm)이 맞혔으면: 뻗은 채 굳는 동안 칼은 이미 상처 속 — 내 칼 ↔ 상대 몸만 그 굳음 동안 부딪히지 않음(combat.js filterContactPair · 칼끼리 · 팔은 그대로)
  if (SECRET.thrustArm && I.hits > 0 && I.moves.some((m) => m.dyn?.thrust)) f.holdGhost = Math.ceil(I.hold / (combat.dt || 1 / 120));
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  f.tipVel.set(0, 0, 0);
  f.hitPointVel.set(0, 0, 0);
  f.instantResult = { ok: true, hit: I.hits > 0, hits: I.hits, energy: I.E, Emax: I.Emax, part: I.part, zone: I.zone, type: I.type, blocked: I.blocked > 0, combo: true, T: I.t, tech: I.tech, aim: I.aim ?? null, sev: I.sev ?? 0, ...(I.mord ? { mord: true, pullD: I.mord.pullD ?? 0, wPart: I.wPart ?? null, hy: I.hy ?? null, ...(I.mord.trk ? { trackN: I.mord.trk.n, trackMoved: I.mord.trk.moved } : {}), ...(I.mord.clip ? { clip: { step: +I.mord.clip.s.toFixed(3), short0: +I.mord.clip.short0.toFixed(3), short: +(I.mord.clip.short ?? I.mord.clip.short0).toFixed(3), tilt: +Math.max(I.mord.clip.tilt, I.mord.clip.tiltMax ?? 0).toFixed(1) } } : {}) } : {}), ...(I.dup ? { dup: I.dup, glided: I.glided ?? 0, ...(I.burst ? { burst: I.burst } : {}) } : {}), ...(I.moves.some((m) => m.lunge) ? { lunge: true, glided: I.glided ?? 0, slide: I.slide?.slide ?? 0, foot: I.footStep ?? 0, tipV: I.tipT > 0 ? I.tipL / I.tipT : 0, tipVmax: I.tipVmax ?? 0, v: I.v } : {}) };
  f.iai = null;
  f.artTech = null;
}

// ─────────────────────────────────────────────────────────────
//  고유 동작 잔상 · 진 · 츠바메가에시 (10/21 15:5x 사장님 '고노센의 50% 빠르기에 잔상도 그에 비례해서 … 일반 츠바메가에시에도 잔상은 넣자')
//   · requestArtReturn: 무기 비검(weapons.js secretBlade.kin)의 되돌림 칼을 연환과 같은 틀로 — 칼끝 빠르기 = 고노센(발도 베는 몫)의 kin 몫 · 잔상 세기도 같은 몫 ·
//     맞음은 쓸린 자리의 실제 빠르기로 기존 상처 함수(비기 판정 배율 없음 — hitMul 1) · 끝 자세 붙잡기 hold s. 사람 · AI 같이 (unique_assist.js start · ai.js 베기 중)
//   · artTrailTick: 끌고 가지 않는 보통 츠바메가에시의 되돌림 칼(칼끝이 위로 움직이는 동안)에 잔상 — 비기 잔상과 같은 그림(sword_trail.js f.instantArc · kind 'combo'),
//     세기 = 그 칼끝 평균 빠르기 / 고노센 칼끝 빠르기 (잔상은 빠르기의 표시 — 연환 · 진과 같은 체계). 물리 · 판정 무관(읽기만)
// ─────────────────────────────────────────────────────────────
export const ART_TRAIL = new Set(['tsubameGaeshi']); // 되돌림 칼이 그리는 동안 잔상 (칼끝이 위로)
//  이점이 터진 순간 잔상 (10/21 16:1x 사장님 '잔상은 이점 터진 순간만 넣는 안으로 해'): 칼은 늘 최근 ART_HIST 초의 길(칼자루 · 칼끝)을 기억하고,
//  이점이 터지면(곁눈 베기 무릎 꺾임 · 내려 찌르기 상처 · 요격 몸통 출혈 — combat.js) 그 길을 한 번에 잔상으로 그린다(artFlash). 이베리아 머리 위 돌려 베기는
//  이어 그은 둘째 칼부터 그리는 동안 잔상(세기 + ART_STACK × 쌓인 수 — 몰아치는 흐름). 세기는 늘 칼끝 평균 빠르기 ÷ 고노센 칼끝 빠르기(ART_MIN 0.3 ~ 1)
/** 진 · 츠바메가에시 되돌림 칼: from(패드) → path(패드들)를 끌고 간다. 이미 끌고 가는 중이면 거절(false) */
export function requestArtReturn(f, from, path, SB) {
  if (f.iai || f.iaiReq || !SB?.kin || !path?.length) return false;
  requestCombo(f, { moves: [{ from, path, kind: 'cut', name: SB.tech }], share: SB.kin, hold: SB.hold ?? 0.2, hitMul: 1, tech: SB.tech });
  return true;
}
/**
 * 사람 제비 베기 되돌림 칼 (사장님 10/25 21:1x '해법 1~3 좋아' — 해법 ② 중력과 관성을 거스름 · config UNIQUE_ASSIST.tsuSnap · unique_assist.js start):
 *  꺾는 순간 from(손가락이 꺾은 자리 — 패드) → path(올려 긋는 길 패드들)를 진 · 츠바메가에시와 같은 틀(연환 — 운동학 · 쓸린 자리의 실제 빠르기 · 판정 배율 1)로 끌고 간다.
 *  칼끝 빠르기 = 고노센 발도 칼끝 빠르기 × share · 시간 상한 maxT · 끝 자세 붙잡기 없음(곧장 0.2 s 에 손가락으로). 이미 끌고 가는 중이면 거절(false)
 */
export function requestArtSnap(f, from, path, { share, maxT, tech, plan = null, band = false, roll = false, shift = null, pathHint = false, arcCut = false }) {
  if (f.iai || f.iaiReq || !path?.length || !(share > 0)) return false;
  requestCombo(f, { moves: [{ from, path, plan, kind: 'cut', name: tech, cutSweep: true, same: true, band, ...(roll ? { roll: true } : {}), ...(shift ? { shift } : {}), ...(pathHint ? { pathHint: true } : {}), ...(arcCut ? { cleanArc: true } : {}) }], share, hold: 0, hitMul: 1, tech, maxT, arcCut }); // plan = [from, ...path] 점마다 길 덧칸 (comboPlanAdd) · cutSweep = 날 세우기 · 준비 토막에서 넘어온 스텝은 맞힘 안 봄 (stepCombo) · same = 손가락 긋기와 같은 공격 (comboMoveStart) · band = 몸통 띠 겨눔(comboBandShift) · 굴림 묶음(placeIai) · 곧은 길 (10/31): roll = 띠 옮김 없이 굴림 묶음만 · shift = 띠 높이 옮김 꼴 · pathHint = 날 쪽을 길 위 칼끝으로 · arcCut = 잔상은 베는 토막만(꺾은 자리로 거두는 준비 토막 · 거기서 넘어온 스텝은 안 그림)
  return true;
}
/**
 * 사람 칼끝 돌려 빼기 (I9 — 사장님 10/28 00:5x · 01:0x — config UNIQUE_ASSIST.cavSnap · unique_assist.js tapChain): 맞물린 뒤 창 안의 탭으로 낸 그 칼을
 *  제비 베기 되돌림 칼과 같은 틀(연환 — 운동학 · 쓸린 자리의 실제 빠르기 · 판정 배율 1 · 같은 공격 · 끝 자세 붙잡기 없음 · 시간 상한 maxT)로 찌른다. 길 = comboPlanArtThrust (under = 상대 칼 밑으로 돌려 빼기).
 *  칼끝 빠르기 = 고노센 발도 칼끝 빠르기 × share (unique_assist.js 가 UNIQUE_ASSIST.specialShare.cavazione 로 넘김 — 10/29 02:0x) · 잔상 = 제비 베기 되돌림 칼과 같은 연환 잔상(share 몫).
 *  plane = 아래팔을 칼 줄에 맞추는 팔꿈치 · 손목이 사람 범위 안인 칼 면(iaiSolve — fighter.js armIK alignDir · wristPlane) · roll = 굴림 묶음(그런 면이 없을 때) ·
 *  dyn.thrust = 겨눈 찌름과 같이 찌르는 토막 첫 자리부터 쓸린 자리(thrustSweep) · 손목 교정은 칼을 줄에서 비키지 않음(iaiSolve thrustSeg). 이미 끌고 가는 중이면 거절(false)
 */
export function requestArtThrust(f, { share = 0, v = 0, trail = true, maxT, tech, under = false, capFromCut = false, side = null, voidStep = null, bodyPose = null, tapTiming = false, selfFree = 0, hitMul = 1 }) {
  if (f.iai || f.iaiReq || !(share > 0 || v > 0) || !f.foe?.bodies?.chest) return false;
  // capFromCut (10/30 — UNIQUE_ASSIST.cavCapCut): 시간 상한을 찌르는 토막부터 셈 (돌려 빼기 · 겨눔 토막은 셈 밖 — 날개 접기 · 풍차 베기와 같은 셈) — 가까우면 돌려 빼기 길이 길어 상한 안에 찌름까지 못 갔다
  // 10/31 이탈리아 자리 바꿈: v = 칼끝 빠르기 m/s 를 바로(share 대신 — 칼끝 돌려 빼기 = 보통 찌르기 빠르기) · trail false = 잔상 없음 · side = 비킨 쪽(월드 — 닿았을 때 상대 칼 쪽) ·
  //  voidStep { lat, fwd } = 비껴서며 찌르기 몸 빼기(스틱 쪽 옆 + 앞 m — 몸 미끄러짐 · 뒷발 걸음) · bodyPose = 이 수 동안 몸 꼴 [골반 °, 가슴 °, 숙임 °, 낮춤 m] (겹치기 dupBody 와 같은 칸)
  //  tapTiming = 탭 찌르기와 같은 박자(겨눔 THRUST.aim · 뻗음 THRUST.extend · 버팀 · 거둠 — 10/31 칼끝 돌려 빼기: 보통 찌르기 · v 는 이때 겨눔 길 짜기의 잣대만)
  //  selfFree = 10/31 칼끝 돌려 빼기 넘어짐 고침 (UNIQUE_ASSIST.cavSelfFree): 1 = 이 수 동안 칼 어깨 면 밧줄을 뗌 · 0 = 전 판
  //  hitMul = 이 찌르기 상처 판정 배율 (10/31 시제품 — UNIQUE_ASSIST.cavHitMul · 기본 1)
  const dyn = { kind: 'artThrust', thrust: true, target: 'lung', under, ...(side?.isVector3 ? { side: side.clone() } : {}), ...(voidStep ? { void: { ...voidStep } } : {}), ...(tapTiming ? { tapTiming: true } : {}) };
  requestCombo(f, { moves: [{ name: tech, kind: 'thrust', same: true, artThrust: true, roll: true, plane: true, ...(capFromCut ? { capFromCut: true } : {}), ...(bodyPose ? { bodyPose } : {}), dyn }], share: share > 0 ? share : 1, speed: v, noArc: !trail, hold: 0, hitMul: hitMul > 0 ? hitMul : 1, tech, maxT, attack: true, selfFree });
  return true;
}
/**
 * 사람 날개 접기 (C6 염시 — 사장님 10/28 00:3x · 01:0x — config UNIQUE_ASSIST.lianTap · unique_assist.js tapChain): 내가 긋던 칼이 상대 칼에 부딪힌 뒤 창 안의 탭으로 낸 그 칼을
 *  제비 베기 되돌림 칼과 같은 틀(연환 — 운동학 · 쓸린 자리의 실제 빠르기 · 판정 배율 1 · 같은 공격 · 끝 자세 붙잡기 없음 · 시간 상한 maxT · 잔상 = 연환 잔상 share 몫)로 끈다.
 *  길 = 격살 한 칼과 같은 큰 가로 호(comboPlanAim — 오른 → 왼 side −1 · 가로 ± 40° · 높이 10 → −10° · 칼날 0.8 자리가 겨눈 곳 — 격살 팔 깎기 · 다리 베기와 같은 호) ·
 *   겨눌 곳 = 상대 배 몸체 가운데(comboAimPoint 'waist') · 처음 닿을 곳이 배 · 골반이 되게 높이를 가장 적게 옮김(waistAim) · 첫 토막(호 첫 자리 = 오른 옆으로 옮김)은 맞힘 없음 = 날개 접기(부딪힌 칼을 오른 허리 옆으로 거둠) ·
 *  날 세우기 · 굴림 묶음(cutSweep · roll) · 걸음(앞으로 반걸음 SECRET.chineseStep — comboMoveStart: 몸 미끄러짐은 맞닿기에서 멈추지 않고 걸음만큼(close) · clinch 안 금지 · 다리 런지 걸음 ·
 *  길은 미끄러진 뒤 자리로 짬) · 시간 상한은 베는 몫부터(capFromCut) · 끝나도 손 목표 그대로(keepAim). 이미 끌고 가는 중이면 거절(false)
 */
export function requestArtFold(f, { share, maxT, tech, step = null }) {
  if (f.iai || f.iaiReq || !(share > 0) || !f.foe?.bodies?.abdomen) return false;
  requestCombo(f, { moves: [{ name: tech, kind: 'cut', cutSweep: true, same: true, roll: true, capFromCut: true, ...(step ? { step: { ...step, close: true } } : {}), dyn: { kind: 'aim', target: 'waist', band: 'waist', from: 'prep', side: -1, yaw: [-40, 40], el: [10, -10], at: 0.8 } }], share, hold: 0, hitMul: 1, tech, maxT, keepAim: true, attack: true });
  return true;
}
/**
 * 사람 겹치기 (G7 두플리렌 — 사장님 10/28 01:2x '지금대로' · 감독 전달 — config UNIQUE_ASSIST.dupTap · unique_assist.js tapChain): 내 긋기가 상대 칼에 맞물려 닿아 있는 동안의 탭으로 낸 그 칼을
 *  제비 베기 되돌림 칼과 같은 틀(연환 — 운동학 · 쓸린 자리의 실제 빠르기 · 판정 배율 1 · 같은 공격 · 끝 자세 붙잡기 없음 · 시간 상한 maxT · 잔상 = 연환 잔상 share 몫)로 끈다.
 *  길 = comboPlanDup (맞물린 자리에서 칼을 떼지 않고 상대 칼 뒤 — 상대 칼과 몸 사이 — 로 밀어 넣은 뒤 맞닿은 자리를 축으로 칼자루를 오른쪽(폼멜이 오른팔 밑)으로 돌려
 *   칼날 앞몫이 얼굴을 지나는 사선 베기 · 손이 엇갈림) · 날 = edge(1 긴 날 · −1 짧은 날 — 날 세우기 쪽) · 몸 = bodyPose · 끝나도 손 목표 그대로(keepAim). 이미 끌고 가는 중이면 거절(false)
 */
export function requestArtDup(f, { share, maxT, tech, face = 0, follow = 25, plan = null, body = null, edge = 1, step = null, old = true, burst = null }) {
  if (f.iai || f.iaiReq || !(share > 0) || !f.foe?.bodies?.head || !f.foe.armed || !f.foe.sword) return false;
  // old: 10/28 길 (comboPlanDup — 감기 · 밀어 넣기) · 아니면 단순 길 (comboPlanDupLine — 10/31 19:xx) · burst { fwd, free }: 앞 박차기 (dupBurstStart — 죽음의 일격 거리에서 멈춤)
  const st = burst?.fwd > 0 ? { kind: 'lunge', fwd: burst.fwd, close: true, stop: burst.fit ? burst.fit.floor ?? 0.5 : SECRET.mordCloseN ?? 0.8, burst: true, free: !!burst.free, sync: burst.sync ?? 1, burstT: burst.T ?? 0, match: burst.fit ? burst.match || 1 : burst.match ?? 0, fit: burst.fit ?? null } : step ? { ...step, close: true } : null;
  requestCombo(f, { moves: [{ name: tech, kind: 'cut', cutSweep: true, same: true, roll: true, dup: true, edge, plan: old ? plan : null, bodyPose: body, ...(old ? {} : { hintBody: true }), ...(st ? { step: st } : {}), dyn: { kind: 'dup', face, follow, old: !!old, edgeLead: old ? 0 : 1 } }], share, hold: 0, hitMul: 1, tech, maxT, keepAim: true, attack: true }); // step: 시제품 앞 걸음(10/31 UNIQUE_ASSIST.dupStep — 기본 없음 · 박차기가 있으면 안 씀)
  return true;
}
/**
 * 사람 풍차 베기 (B4 레돈두 — 이베리아 특수 공격 · 사장님 10/29 · config UNIQUE_ASSIST.rdHold · unique_assist.js holdTick): 길게 눌러 머리 위로 돌리던 칼(iberian_redondo.js)을 뗀 순간
 *  제비 베기 되돌림 칼과 같은 틀(연환 — 운동학 · 쓸린 자리의 실제 빠르기 · 판정 배율 1 · 같은 공격 · 끝 자세 붙잡기 없음 · 시간 상한 maxT — 베는 몫부터 capFromCut · 잔상 = 연환 잔상 share 몫)로 끈다.
 *  길 = comboPlanRd (arc = UNIQUE_ASSIST.rdArc) · 날 세우기 · 굴림 묶음 · 끝나도 손 목표 그대로(keepAim). 이미 끌고 가는 중이면 거절(false)
 *  diag 를 주면(10/30 rdRelease 'direct' — UNIQUE_ASSIST.rdDiag) 곧장 사선 내려침 comboPlanRdDiag · 잔상은 베는 토막만(arcCut)
 */
export function requestArtRedondo(f, { share, maxT, tech, arc, loop = null, diag = null, tajo = null, bodyFrom = null }) {
  if (f.iai || f.iaiReq || !(share > 0) || !f.foe?.bodies?.chest || !(arc || diag || tajo)) return false;
  if (tajo) {
    // 10/31 19:xx B4 멘 어깨에서 내려침 (comboPlanRdTajo): 몸 = 멘 몸 꼬임(bodyFrom — 감기 꼴 body)에서 tajo.body 로 풀며 앉음 · 잔상은 베는 토막만
    const bf = bodyFrom ? { pelvisYaw: bodyFrom.pelvisYaw ?? 0, chestYaw: bodyFrom.chestYaw ?? 0, pitch: bodyFrom.pitch ?? 0, drop: bodyFrom.drop ?? 0 } : null;
    requestCombo(f, { moves: [{ name: tech, kind: 'cut', cutSweep: true, same: true, roll: true, capFromCut: true, rd: { loop, tajo }, ...(tajo.body ? { bodyPose: tajo.body } : {}), ...(bf ? { bodyFrom: bf } : {}) }], share, hold: 0, hitMul: 1, tech, maxT, keepAim: true, attack: true, arcCut: true });
    return true;
  }
  requestCombo(f, { moves: [{ name: tech, kind: 'cut', cutSweep: true, same: true, roll: true, capFromCut: true, rd: { arc, loop, diag } }], share, hold: 0, hitMul: 1, tech, maxT, keepAim: true, attack: true, arcCut: !!diag });
  return true;
}
export const ART_HIST = 0.3; // s — 잔상으로 그릴 지난 길 (감독 값)
export const ART_STACK = 0.1; // 이어 그은 수 하나마다 더하는 잔상 세기 (감독 값)
export const ART_MIN = 0.3; // 고유 동작 잔상의 가장 흐린 세기 (10/21 16:2x 사장님 '0.3' — 연환 잔상 30 % · 일반 칼 궤적 띠 가장 진한 30 % 와 같게 · 빠른 칼은 빠르기만큼 더 진함)
const HIST_N = 64;
function speedShare(f, sum, n) { return clamp(sum / Math.max(1, n) / Math.max(1, iaiTipSpeed(f)), ART_MIN, 1); }
function artTrailTick(f) {
  if (!f.armed || !f.sword) { f.artTrail = null; f.bladeHist = null; return; }
  const a = f.bladePoint(0, new THREE.Vector3());
  const b = f.bladePoint(1, new THREE.Vector3());
  const sp = f.tipVel?.length?.() ?? 0;
  const H = (f.bladeHist ??= { pts: [], t: 0 });
  H.pts.push([a.x, a.y, a.z, b.x, b.y, b.z, sp, H.t]);
  H.t += 1;
  if (H.pts.length > HIST_N) H.pts.shift();
  if (f.iai) { f.artTrail = null; return; }
  const name = artTechOf(f);
  const stack = name ? artStackOf(f) : 0;
  const on = name && ((ART_TRAIL.has(name) && (f.tipVel?.y ?? 0) > 1.5) || (stack >= 1 && sp > 8));
  if (!on) { f.artTrail = null; return; }
  let A = f.artTrail;
  if (!A || A.name !== name) {
    A = f.artTrail = { name, arc: { id: (f.instantArc?.id ?? 0) + 1, kind: 'combo', share: ART_MIN, pts: [] }, sum: 0, n: 0 };
    f.instantArc = A.arc;
  }
  A.arc.pts.push([a.x, a.y, a.z, b.x, b.y, b.z]);
  A.sum += sp;
  A.n++;
  A.arc.share = clamp(speedShare(f, A.sum, A.n) + ART_STACK * stack, ART_MIN, 1);
}
/** 이점이 터진 순간: 그 칼이 지나온 최근 ART_HIST 초의 길을 잔상으로 (비기 · 끌고 가는 칼이 그리는 중이면 안 함) */
export function artFlash(f, dt = 1 / 120) {
  if (f.iai || !f.bladeHist?.pts.length) return;
  const n = Math.max(2, Math.round(ART_HIST / Math.max(1e-3, dt)));
  const P = f.bladeHist.pts.slice(-n);
  const sum = P.reduce((s, p) => s + p[6], 0);
  f.instantArc = { id: (f.instantArc?.id ?? 0) + 1, kind: 'art', share: speedShare(f, sum, P.length), pts: P.map((p) => p.slice(0, 6)) };
  f.artTrail = null;
}
let artTechOf = () => null; // unique_assist.js strokeTechOf 를 이어 둔다 (서로 부르는 고리를 피함)
let artStackOf = () => 0; // unique_assist.js strokeStackN
export function setArtTechOf(fn, stackFn) { artTechOf = fn; if (stackFn) artStackOf = stackFn; }
