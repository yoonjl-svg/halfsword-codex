// ─────────────────────────────────────────────────────────────
//  이베리아 특수 공격 '풍차 베기 (레돈두)' (B4 — 사장님 10/29 00:4x ~ 01:5x · 기록 docs/strike/redondo_hold_2026-10-29.md · 확인표 2727 ~ 2733) — 길게 누르는 동안 칼을 머리 위로 돌리는 감기
//   사장님: "탭을 오래 누르면 그 준비 동작이 시작되고 바로 손을 떼면 그걸 내려치는 거야. 그 사이에 이동을 할수 있고, 이동을 하면서 그걸 내려칠 타이밍을 고르는 거지" ·
//   '머리 위에서 계속 돈다' · 01:0x '이게 특수공격 위치의 스킬이잖아' (조건 · 기력 · 식힘은 unique_assist.js PlayerUniqueAssist.holdTick · 내려침은 secret_instant.js requestArtRedondo)
//
//  몸놀림만 대본 (물리 원칙의 예외 — 특수 공격 몸놀림 · 발도 · 특수 공격 넷의 끌고 가는 칼과 같은 놓기): 두 팔 · 칼을 물리 스텝마다 대본 자리에 놓는다(secret_instant.js placeArmsAt =
//   placeIai — 팔 IK · 굴림 묶음 · 손목 교정(사람 손목 범위) · 날 = 도는 쪽 · 빠르기 = 가슴 · 덧씌우기 칸도 같은 자세 · 몸 비틀기 0 — 팔만 · 몸은 상대를 봄).
//   칼 · 팔은 동역학 몸 그대로 · 충돌을 끄지 않는다(끌고 가는 칼의 충돌 끔 instantGhost 를 걸지 않음) → 칼을 세게 맞거나(jolt) 몸에 상처가 나면 감기를 그만둔다(holdTick — 식힘 없음) · 닿기만 하면 그대로 감음(닿은 스텝은 재기만).
//   감는 칼은 맞히는 칼이 아니다(빠르기 = 가슴 — 놓인 자리만 돈다 · 상처 판정은 물리 맞닿음 그대로).
//   앞 시험 (기록 §2): ① 서보로 감기(덧씌우기 칸만) — 칼이 길을 못 따라 평균 90° 어긋남 · 손목 범위 밖 42 % · 칼이 제 머리를 지남 /
//   ② 놓기 + 빠르기 = 놓은 자리의 차(싱지르 placeArms 꼴) — 팔 · 칼 운동량이 어깨로 가슴을 밀어 4 s 에 몸이 1.7 m 미끄러지고 넘어짐 /
//   ③ 머리 위 가로 고리 — 어깨 · 손목 밧줄이 팽팽해져 몸이 밀려 넘어지고 손목이 뒤집힘 → 지금 꼴(원뿔 고리 · 빠르기 = 가슴).
//
//  길 (몸 틀 — 지금 몸 방향 f.yaw · 가슴 원점 · x 앞 · y 위 · z 칼 든 쪽 m · UNIQUE_ASSIST.rdLoop — windPose):
//   두 손은 이마 앞 위에 두고 칼은 곧게 선 축에서 cone ° 기운 채, 기운 쪽 가로 각 ψ 가 rdLoopT 초에 한 바퀴 — 앞 → 칼 든 쪽 → 뒤 → 반대쪽
//   (내려칠 레베스가 왼 → 오른으로 가므로 같은 쪽으로 돎) · 칼끝이 머리 위에서 원을 그림 · 날 = 도는 쪽(rdEdge).
//   처음 rdWindIn 초는 지금 손 · 칼날에서 길로 섞는다(가로 각은 지금 칼 가로 각에서 시작 — 섞는 길이 짧게).
//  10/29 20:0x 사장님 '레돈두는 처음 발동을 시작할 때 캐릭터가 크게 휘청거려 … 머리 위로 칼을 돌리는 동작이 너무 빠르고 조악 … 좀 더 천천히 큰 동작으로 돌리거나 어깨에 얹는 고정 준비동작으로'
//   (기록 docs/strike/redondo_hold_2026-10-29.md §8):
//   ① 휘청 고침 (UNIQUE_ASSIST.rdSteady — 기본 켬): 감는 동안 손목 원뿔 · 칼 어깨 면 밧줄을 뗌(손가락을 댄 쉼 자세에서 머리 위로 섞을 때 어깨 면 밧줄이 가슴을 잡아채 넘어지던 것 — 가장 큰 까닭) ·
//    놓인 팔 · 칼의 근육 · 손목 헛힘 끔(fighter.js armsPlaced) · 섞는 동안 도는 빠르기도 0 에서 부드럽게 올림(rdRamp — 감는 첫머리 칼끝이 고리 빠르기의 두 배로 튀던 것)
//   ② 감기 꼴 셋 (UNIQUE_ASSIST.rdWindMode — windSpec): 'spin' 10/29 판 원뿔 고리 · 'slowSpin' 안 A(rdSlow — 한 바퀴 1.2 s · 칼을 더 눕힌 큰 고리 · 팔을 더 뻗음) ·
//    'shoulder' 안 B(rdShoulder — 오른 어깨에 얹어 멈춤 · 날 위 · 감은 셈은 그 자세로 woundT 넘게 쥐었나)
//  10/30 00:1x 사장님 '레돈두는 A로 하고 흐름 보너스 시간은 한바퀴로 둬' — 기본 'slowSpin' · 흐름 셈 '한 바퀴' 그대로 (내려침 길은 secret_instant.js comboPlanRdDiag — 기록 §8-9)
//  10/31 19:xx 사장님 '칼을 더 들어올리거나 아예 어깨에 얹거나. 그리고 칼 끝이 머리 뒤로 넘어와서 땅쪽으로 기울어 있어야 해' — 기본 'load'(UNIQUE_ASSIST.rdLoad — 칼 든 어깨에 메어 칼끝이 머리 뒤 · 땅 쪽 ·
//   놓기는 'shoulder' 와 같은 틀) · 내려침은 멘 어깨에서 반대쪽 아래로 사선(secret_instant.js comboPlanRdTajo) · 흐름과 무관(config IB_FLOW.windmillApart) — 기록 docs/strike/b4_rework_2026-10-31.md · `?b4Old=1` = 10/31 14:xx 판
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { UNIQUE_ASSIST as UA } from './config.js';
import { placeArmsAt, armRopes } from './secret_instant.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10)); // 섞기 (rdRamp): 빠르기 · 가속 모두 0 에서 시작해 0 으로 끝남
const sideOf = (f) => (f.side >= 0 ? 1 : -1);
const BODY0 = Object.freeze({ pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 });

/**
 * 지금 감기 꼴 (UNIQUE_ASSIST.rdWindMode — 사장님 10/29 20:0x 두 안 · 10/30 00:1x 안 A 'slowSpin' 기본): { kind 'spin' | 'shoulder', loopT, cone, hand, handR, windIn, woundT, blade }
 *  'spin' = 10/29 판(rdLoopT · rdLoop · rdWindIn) · 'slowSpin' = 안 A(rdSlow) · 'shoulder' = 안 B(rdShoulder). 모르는 이름은 'spin'
 */
export function windSpec(f = null) {
  const m = f?.aiControlled && UA.rdAiOld > 0 ? 'shoulder' : UA.rdWindMode; // AI 옛 판 (10/31 19:xx UNIQUE_ASSIST.rdAiOld — 기본 0: AI 도 사람과 같은 꼴)
  if (m === 'load' && UA.rdLoad) return { kind: 'shoulder', name: 'load', loopT: 0, cone: 0, handR: 0, ...UA.rdLoad }; // B4 어깨에 메기 (10/31 19:xx — 놓기는 'shoulder' 와 같음 · 자리만 다름)
  if (m === 'shoulder' && UA.rdShoulder) return { kind: 'shoulder', loopT: 0, cone: 0, handR: 0, ...UA.rdShoulder };
  if (m === 'slowSpin' && UA.rdSlow) return { kind: 'spin', handR: 0, ...UA.rdSlow };
  return { kind: 'spin', loopT: UA.rdLoopT, cone: UA.rdLoop.cone, hand: UA.rdLoop.hand, handR: 0, windIn: UA.rdWindIn };
}
/** 내려침 앞 '먼저 머리 위로' 자리 (secret_instant.js comboPlanRd loop — { cone, hand }): 도는 꼴이면 그 고리 · 어깨 꼴이면 10/29 판 고리(rdLoop) */
export function windLoopOf(M = windSpec()) {
  return M.kind === 'spin' ? { cone: M.cone, hand: M.hand } : UA.rdLoop;
}

/**
 * 감는 길 한 자리 (몸 틀): 칼 가로 각 psi(rad — 0 앞 · + 칼 든 쪽) → 손(칼자루 쥔 자리 = 칼 원점) H · 칼날 D(단위).
 *  원뿔 고리 (UNIQUE_ASSIST.rdLoop): 두 손은 이마 앞 위 hand 에 두고, 칼은 곧게 선 축에서 cone ° 기운 채 그 기운 쪽(가로 각 psi)을 돌린다 — 칼끝이 머리 위에서 원을 그림.
 *  칼날이 아래팔 축 가까이(30°)라 어느 쪽으로 기울어도 손목이 굽힘 · 폄 · 치우침만으로 닿아 굴림을 뒤집지 않는다 (머리 위 가로 고리 · 자세표 머리 위 자세를 이은 고리는
 *  손목이 거꾸로 뒤집히거나 칼자루 · 팔이 머리를 지났다 — 기록 §2)
 */
export function windPose(f, psi, H = new THREE.Vector3(), D = new THREE.Vector3(), M = windSpec()) {
  const s = sideOf(f);
  if (M.kind === 'shoulder') {
    // 안 B 어깨에 얹음 (rdShoulder): 손 hand [앞, 위, 칼 든 쪽] m · 칼 blade [높이 °, 가로 °](0 앞 · + 칼 든 쪽 — 150 이면 뒤 · 칼 든 쪽) — 칼이 칼 든 어깨 위로 뒤로 누움
    const e = M.blade[0] * D2R;
    const a = M.blade[1] * D2R;
    H.set(M.hand[0], M.hand[1], s * M.hand[2]);
    D.set(Math.cos(e) * Math.cos(a), Math.sin(e), s * Math.cos(e) * Math.sin(a));
    return { H, D };
  }
  const b = M.cone * D2R;
  const r = M.handR ?? 0; // 손도 칼이 기운 쪽으로 원 (rdSlow.handR — 기본 0: 손이 원을 그리면 손목이 사람 범위 끝을 오가 칼이 튐 · 기록 §8-4)
  H.set(M.hand[0] + r * Math.cos(psi), M.hand[1], s * (M.hand[2] + r * Math.sin(psi)));
  D.set(Math.sin(b) * Math.cos(psi), Math.cos(b), s * Math.sin(b) * Math.sin(psi));
  if (M.lean) {
    // 안 A: 고리 축을 뒤로 lean ° 눕힘 (몸 옆 축 둘레) — 손은 이마 앞인데 칼끝 원의 가운데가 머리 위에 오게
    const l = M.lean * D2R;
    const x = D.x;
    D.x = x * Math.cos(l) - D.y * Math.sin(l);
    D.y = x * Math.sin(l) + D.y * Math.cos(l);
  }
  return { H, D };
}
/** 감는 빠르기 (rad/s — 어깨 꼴은 0) */
export const windRate = (M = windSpec()) => (M.loopT > 0 ? TAU / M.loopT : 0);
/** 감기 시작부터 '감음'(감은 셈 1 — windStep W.turns)까지 게임 초 (10/31 13:4x AI 기력 아낌 셈 — ai.js rdWindCost):
 *  어깨 꼴 = 얹음(windIn — woundFrom 'start' 면 0) + woundT · 도는 꼴 = 한 바퀴 loopT(섞기 rdRamp 면 섞는 windIn 동안 평균 반 빠르기 → + windIn / 2) */
export function windWoundT(M = windSpec()) {
  if (M.kind === 'shoulder') return (M.woundFrom === 'start' ? 0 : M.windIn ?? 0) + (M.woundT ?? 0);
  const T = M.windIn ?? 0;
  return (M.loopT ?? 0) + (UA.rdSteady > 0 && UA.rdRamp > 0 && T > 0 ? T / 2 : 0);
}
const _UP = new THREE.Vector3(0, 1, 0);
/** 감는 칼이 도는 쪽 (몸 틀 — 가로 각이 느는 쪽 · 날 세우기 · rdEdge −1 이면 반대 날) · 어깨 꼴은 날 위(하늘 쪽 — 사장님 '날 위') */
function windEdge(f, psi, out = new THREE.Vector3(), M = windSpec()) {
  if (M.kind === 'shoulder') return out.copy(_UP);
  return out.set(-Math.sin(psi), 0, sideOf(f) * Math.cos(psi)).multiplyScalar(UA.rdEdge < 0 ? -1 : 1);
}

/** 감기 시작 (지금 손 · 칼날을 몸 틀로 적어 둠 — 섞기의 처음) · f.rdWind 를 돌려줌 */
export function windStart(f) {
  const inv = f.yaw.clone().invert();
  const c = f.bodies.chest.translation();
  const sw = f.sword.translation();
  const AH = new THREE.Vector3(sw.x - c.x, sw.y - c.y, sw.z - c.z).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  const psi = Math.atan2(sideOf(f) * AD.z, AD.x); // 지금 칼 가로 각에서 돌기 시작
  const M = windSpec(f); // 이 감기의 꼴 (감는 동안 그대로 · AI 옛 판 rdAiOld 면 AI 는 'shoulder')
  const I = { yaw: f.yaw.clone(), mord: null, kind: 'wind', moves: null, mi: 0, off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), body: M.body ? { ...BODY0, ...M.body } : BODY0, wristMargin: UA.rdWristMargin ?? 0 }; // 손목 교정은 범위 끝에서 rdWristMargin ° 안쪽으로 (10/29 몸 검사) · 몸 = 꼴의 body(덧씌우기 몸 ° · m) 없으면 0
  f.rdWind = { t: 0, psi, psi0: psi, AH, AD, H: AH.clone(), D: AD.clone(), k: 0, I, turns: 0, M };
  // 휘청 고침 ① (rdSteady — 10/29 20:0x): 감는 동안 손목 원뿔 · 칼 어깨 면 밧줄을 뗀다 (휩쓸기 · 죽음의 일격과 같음 — secret_instant.js ropes).
  //  놓은 위팔이 어깨 면 한도(HUMAN.shoulderPlane) 밖을 지나면 밧줄이 매 스텝 가슴을 팔 쪽으로 잡아챈다 — 손가락을 대고 있는(handHeld) 쉼 자세(칼이 오른쪽 아래)에서
  //  머리 위로 섞을 때 가슴이 0.1 s 에 7 rad/s 로 뒤로 젖혀져 37° · 무게중심이 발 밖 1 m 로 나가 넘어짐(브라우저 · 시뮬 같음 — 기록 §8). 감기 끝(windEnd)에 다시 건다
  if (UA.rdSteady > 0) {
    f.rdWind.ropes = { grip: !!f.gripCone, shoulder: !!f.shoulderRopes };
    armRopes(f, false);
  }
  return f.rdWind;
}

const _q = new THREE.Quaternion();
const _e = new THREE.Vector3();
const _vh = new THREE.Vector3();
const _vd = new THREE.Vector3();
const _bh = new THREE.Vector3();
const _bd = new THREE.Vector3();
/** 손 · 칼날 섞기 (손 곧게 · 칼날 slerp): (AH, AD) → (BH, BD) 의 k 자리 → (oH, oD) — oH · oD 가 BH · BD 와 같아도 됨 */
function blendTo(AH, AD, BH, BD, k, oH, oD) {
  const qd = _q.setFromUnitVectors(AD, BD);
  const d = AD.clone().applyQuaternion(new THREE.Quaternion().slerp(qd, k)).normalize();
  oH.lerpVectors(AH, BH, k);
  oD.copy(d);
}
/** 안 B 섞기의 거쳐 가는 자리 (M.via — 손 [앞, 위, 칼 든 쪽] m · 칼 [높이 °, 가로 °]) */
function windVia(f, M, H, D) {
  const s = sideOf(f);
  const e = M.via.blade[0] * D2R;
  const a = M.via.blade[1] * D2R;
  H.set(M.via.hand[0], M.via.hand[1], s * M.via.hand[2]);
  D.set(Math.cos(e) * Math.cos(a), Math.sin(e), s * Math.cos(e) * Math.sin(a));
  return { H, D };
}
/**
 * 한 물리 스텝 (unique_assist.js holdTick — skill.update 머리 · 물리 스텝 앞): 가로 각을 돌리고 그 자리에 두 팔 · 칼을 놓는다.
 *  돌려줌 = 감는 칼이 지난 물리 스텝에 무엇에 닿았나('body' 상대 몸 · 'blade' 상대 칼 · 'other' 벽 · 땅) 또는 null
 */
export function windStep(f, dt) {
  const W = f.rdWind;
  if (!W) return null;
  const hit = windContact(f);
  const M = W.M ?? windSpec();
  const T = M.windIn ?? 0;
  const ramp = UA.rdSteady > 0 && UA.rdRamp > 0 && T > 0; // 휘청 고침 ③ (rdRamp): 도는 빠르기를 섞는 동안 0 → 고리 빠르기로 · 섞기 smoother (전: 첫 스텝부터 고리 빠르기 + smooth 섞기)
  W.psi += windRate(M) * (ramp ? smooth((W.t + 0.5 * dt) / T) : 1) * dt;
  W.t += dt;
  // 어깨 꼴: 감은 셈 = 어깨에 얹은 채 쥔 시간 ÷ woundT (흐르는 긋기 '한 바퀴' 자리 — 10/31 감독 해석 · 사장님 확인 전): 얹은 때 = 섞기(windIn)가 끝난 때 ·
  //  woundFrom 'start' = 10/29 판 셈(감기 시작부터 — 섞는 동안도 셈해 칼이 어깨에 닿는 순간 1)
  W.turns = M.kind === 'shoulder' ? Math.max(0, W.t - (M.woundFrom === 'start' ? 0 : M.windIn ?? 0)) / Math.max(1e-3, M.woundT) : (W.psi - W.psi0) / TAU;
  const { H, D } = windPose(f, W.psi, undefined, undefined, M);
  const k = T > 0 ? (ramp ? smoother(W.t / T) : smooth(W.t / T)) : 1;
  if (k < 1) {
    if (M.via) {
      // 안 B: 지금 칼 → 거쳐 가는 자리(via — 칼을 세워 든 자리) → 어깨 (곧장 섞으면 칼이 앞에서 뒤로 넘어가며 제 머리 · 몸을 지남 — 몸 검사)
      const V = windVia(f, M, _vh, _vd);
      const k1 = Math.min(1, 2 * k);
      const k2 = Math.max(0, 2 * k - 1);
      blendTo(W.AH, W.AD, V.H, V.D, k1, _bh, _bd);
      blendTo(_bh, _bd, H, D, k2, H, D);
    } else blendTo(W.AH, W.AD, H, D, k, H, D);
  }
  W.H.copy(H);
  W.D.copy(D);
  W.k = k;
  W.I.yaw.copy(f.yaw); // 몸 틀 = 지금 몸 방향 (걷고 돌아도 머리 위 그대로)
  placeArmsAt(f, W.I, H, D, windEdge(f, W.psi, _e, M).applyQuaternion(f.yaw));
  return hit;
}

/** 감기 끝 (내려침이 이어받든 그만두든): 대본 놓기를 멈춤 — 팔 · 칼은 동역학 몸 그대로(서보 · 덧씌우기 칸은 holdTick 이 내려놓음) */
export function windEnd(f, keepRopes = false) {
  const R = f.rdWind?.ropes ?? null;
  f.rdWind = null;
  if (keepRopes) return R; // 뗀 밧줄 기록을 돌려줌 — 내려침 운동학 칼이 끝나고 · 그만둔 팔이 서보로 돌아온 뒤 다시 건다 (unique_assist.js holdTick → windRopesBack)
  windRopesBack(f, R);
  return null;
}
/** 감기에 뗀 밧줄을 다시 (있던 것만 · 칼을 잃었으면 손목 원뿔은 걸지 않음 — secret_instant.js endIai 와 같은 조건) */
export function windRopesBack(f, R) {
  if (!R) return;
  if (R.grip && f.armed && f.sword && f.weaponCfg.hiltLength && !f.gripCone) f.gripConeOn();
  if (R.shoulder && !f.shoulderRopes && f.bodies.uarmS && f.jointByName.uarmS) f.shoulderOn();
}

/** 감는 칼이 지난 물리 스텝에 무엇에 닿았나 (iberian_spin.js swordContact 와 같은 셈 — 내 몸은 뺌): 'body' · 'blade' · 'other'(벽 · 땅) · null */
function windContact(f) {
  const Wd = f.world;
  const foe = f.foe;
  if (!Wd || !f.armed || !f.swordColliders) return null;
  const mine = new Set([...Object.values(f.bodies).map((b) => b.handle), f.sword.handle]);
  const foeB = new Set(foe?.bodies ? Object.values(foe.bodies).map((b) => b.handle) : []);
  const foeSword = foe?.sword?.handle;
  let out = null;
  for (const c1 of f.swordColliders) {
    Wd.contactPairsWith(c1, (c2) => {
      if (out) return;
      const h = c2.parent()?.handle;
      if (h != null && mine.has(h)) return;
      Wd.contactPair(c1, c2, (m) => {
        for (let i = 0; i < m.numContacts(); i++) {
          if (m.contactDist(i) <= 0) {
            out = h === foeSword ? 'blade' : foeB.has(h) ? 'body' : 'other';
            return;
          }
        }
      });
    });
    if (out) break;
  }
  return out;
}
