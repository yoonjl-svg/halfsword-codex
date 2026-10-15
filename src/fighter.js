// ─────────────────────────────────────────────────────────────
//  검투사 한 명 = "액티브 래그돌"
//
//  몸은 관절로 이어진 강체(rigid body) 13개다. 애니메이션을 틀어주는
//  대신, 매 물리 스텝마다 "근육" 역할을 하는 힘과 회전력을 걸어서
//  서 있게 하고 걷게 하고 칼을 휘두르게 한다. 그래서 맞으면 비틀거리고
//  힘이 빠지면 인형처럼 쓰러진다. 이것이 하프 소드 느낌의 핵심이다.
//
//  좌표 약속: 몸 기준(로컬)으로 +x가 앞, +y가 위, +z가 오른쪽이다.
//  heading(라디안)은 몸이 월드에서 바라보는 방향. 항상 상대 쪽으로 천천히 돈다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BODY, WEAPON, VITALS, BALANCE, SKILL, SKILL_BODY, GRIP, STEEL, RECOIL, GAIT, ARMOR, ANATOMY, ARENA, COMBAT, CLOSE, ARM, JOINTS, SECRET } from './config.js';
import { COMBAT_HOOKS } from './combat.js';
import { Skill } from './skill.js';
import { Stamina } from './stamina.js';
import { Gait, hybridJointDefs } from './gait.js';
import { guardAt, finishAt } from './guards.js';
import { resolveSwordArt, applySwordArt } from './sword_art.js'; // 검술 풀이: 자세표·동작 라이브러리·덧씌우기·쥠·HUD 이름을 한 곳에서 (10/8 ① 구조)
import { corrStep } from './corr.js';
import { newFinish, updateFinish, FINISH, plungeBoost } from './finish.js';
import { vitalHand, vitalAim, playerVitalUpdate } from './vital_target.js'; // 약한 자세 겨눔 덧씌우기 (FINISH.vital, 10/12)
import { getWeapon, MATERIALS, weaponMatOpts, DEFAULT_WEAPON, BREAK } from './weapons.js';
import { breakWeaponLook } from './weapon_looks.js';
import { spawnDebris, scatterDebris, debrisEnabled } from './debris.js'; // 흩어지는 조각: 부러진 칼날 끝과 부서진 투구·판금을 한 모듈이 띄우고 치운다
// 방어구 겉모습(찌그러짐·금): 전투 쪽이 투구·판금 내구도가 바뀔 때마다 부른다
import { decorateOutfit, polishOutfit, setHelmetWear, setPlateWear } from './outfits.js';
import { reviveOf, tryRevive, reviveTick } from './revive.js';
import { fighterWetlandMoveScale } from './wetland_ground.js'; // 잠든 습지 진흙 웅덩이: 자발 이동만 줄인다 (다른 무대 배율 1 — 값이 비트 단위로 같다)

// 충돌 그룹 비트. 자기 몸과 자기 칼끼리는 부딪히지 않게 한다.
// 롱소드의 칼날 축(비트는 축) 관성 실측값 (칼자루+폼멜+코등이+칼날 합, kg·m²). fighter.js
// 생성자의 twistScale 계산 기준 (weapons.js의 롱소드 spec과 같은 수치가 나와야 한다).
const TWIST_I_BASE = 0.0010137;
const BIT = { ground: 1 };
const bodyBit = (i) => (i === 0 ? 2 : 8);
const weaponBit = (i) => (i === 0 ? 4 : 16);
// 발은 따로: 상대 발·다리와는 부딪히지 않는다 (서로 발을 밟고 마찰로 엉겨 붙는 것을 막는다)
const footBit = (i) => (i === 0 ? 64 : 128);
const groups = (member, filter) => (member << 16) | filter;
// 자기 몸 충돌 (BODY.humanLimits 일 때만): 제 몸통·허벅지, 제 칼팔
const torsoBit = (i) => (i === 0 ? 256 : 512);
const armSBit = (i) => (i === 0 ? 1024 : 2048);
const TORSO_PARTS = new Set(['pelvis', 'abdomen', 'chest', 'thighF', 'thighB']);
// ── 팔·다리 절단 (COMBAT.limbSever, 설계 docs/strike/limb_sever_design_2026-10-07.md §2) ──
//  베인 부위 → 뗄 수 있는 관절 후보. 'own' = 그 부위 자신의 관절(앵커2 가 부위 틀), 'child' = 아래 부위의 관절(앵커1 이 부위 틀).
//  팔꿈치 = farm*의 관절, 어깨 = uarm*의 관절, 무릎 = shin*의 관절, 엉덩이 = thigh*의 관절. 손목·발목은 안 한다(몸체가 손·발을 따로 안 가짐).
const LIMB_SEVER_JOINTS = {
  farmS: [['farmS', 'own', 'elbow']], farmO: [['farmO', 'own', 'elbow']],
  uarmS: [['farmS', 'child', 'elbow'], ['uarmS', 'own', 'shoulder']], uarmO: [['farmO', 'child', 'elbow'], ['uarmO', 'own', 'shoulder']],
  shinF: [['shinF', 'own', 'knee']], shinB: [['shinB', 'own', 'knee']],
  thighF: [['shinF', 'child', 'knee'], ['thighF', 'own', 'hip']], thighB: [['shinB', 'child', 'knee'], ['thighB', 'own', 'hip']],
};
/** count 모드의 수집함: 통과 베기가 팔다리 관절 근처에 닿을 때마다 한 줄 (자르지 않는다). 측정 도구 tools/sim/limb_sever_count.mjs 가 읽는다 */
export const LIMB_SEVER_COUNT = { events: [] };
// ── 몸 규칙 (병마용 — 샛별 저장소 901b1f39 와 같은 꼴, 사장님 결정 10/14 '샛별 그대로' · docs/import/chanda_terra_port_2026-10-14.md §3) ──
//  인물 시트 physiology 가 이 위에 덮인다. 없으면 이 값 그대로(사람) — 아래 갈래는 모두 이 값을 보고, 사람은 예전 길을 한 줄도 다르게 돌지 않는다.
//   body: 'human' | 'clay' — 겉모습·소리 갈래 표식(흙 알갱이·잔금·마른 타격음·흙 단면·부서지는 소리 — main.js · effects.js · decap_fx.js · limb_fx.js · sound.js)
//   bleeds: false 면 출혈 0 · 혈액 1 고정 · deathRequiresHeadDetachment: true 면 목 관절이 떨어지기 전에는 죽지 않는다(die 거부 — 부활보다 먼저 본다)
export const HUMAN_BODY = Object.freeze({ body: 'human', bleeds: true, deathRequiresHeadDetachment: false });
export const GROUND_GROUPS = groups(BIT.ground, 0xffff);

// ─────────────────────────────────────────────────────────────
//  몸 설계: 사람 인체 측정 자료(Winter, "Biomechanics and Motor Control of Human Movement")의
//  부위별 질량 비율·길이 비율로 키 1.75m, 몸무게 75kg인 사람을 만든다.
//  좌표: 앞(+x)을 보고 선 자세 기준. s = 칼 든 팔 쪽 z 부호(+1 = 오른손).
//   관절 높이: 발목 0.08, 무릎 0.50, 엉덩이 0.93, 허리 1.06, 등 1.20, 어깨 1.43, 목 1.50
// ─────────────────────────────────────────────────────────────
function partDefs(s) {
  return [
    // 몸통 (몸무게의 약 50%): 골반·배·가슴 세 덩어리로 나눠 허리가 휘고 비틀린다
    { name: 'pelvis', kind: 'pelvis', shape: ['box', 0.1, 0.085, 0.16], pos: [0, 0.97, 0], mass: 10.7 },
    { name: 'abdomen', kind: 'abdomen', shape: ['box', 0.1, 0.07, 0.15], pos: [0, 1.13, 0], mass: 10.4 },
    { name: 'chest', kind: 'chest', shape: ['box', 0.11, 0.13, 0.18], pos: [0, 1.33, 0], mass: 16.2 },
    { name: 'head', kind: 'head', shape: ['ball', 0.1], pos: [0, 1.62, 0], mass: 6.1 },
    // 팔: 위팔 2.8%, 아래팔+손 2.2%
    // 칼 든 팔은 "앞으로 뻗은 자세"를 관절의 기준(0°)으로 만든다. 칼을 쓰는 범위(겨누기~머리 위~아래)가
    // 기준에서 ±90° 안에 들어와야 물리 엔진의 관절 계산이 정확하다.
    // 몸체 좌표축은 가슴과 나란하게 두고(엔진의 0° = 이 자세), 뼈 모양만 앞(+x)으로 눕힌다(alongX).
    { name: 'uarmS', kind: 'arm', shape: ['capsule', 0.105, 0.045], pos: [0.15, 1.43, s * 0.2], alongX: true, mass: 2.1 },
    { name: 'farmS', kind: 'arm', shape: ['capsule', 0.095, 0.04], pos: [0.435, 1.43, s * 0.2], alongX: true, mass: 1.65 },
    { name: 'uarmO', kind: 'arm', shape: ['capsule', 0.105, 0.045], pos: [0, 1.28, -s * 0.2], mass: 2.1 },
    { name: 'farmO', kind: 'arm', shape: ['capsule', 0.095, 0.04], pos: [0, 0.99, -s * 0.2], mass: 1.65 },
    // 다리: 허벅지 10%, 정강이 4.65%, 발 1.45%
    { name: 'thighF', kind: 'leg', shape: ['capsule', 0.15, 0.065], pos: [0, 0.715, s * 0.095], mass: 7.5 },
    { name: 'shinF', kind: 'leg', shape: ['capsule', 0.16, 0.05], pos: [0, 0.29, s * 0.095], mass: 3.5 },
    { name: 'footF', kind: 'leg', shape: ['box', 0.12, 0.035, 0.05], pos: [0.05, 0.045, s * 0.095], mass: 1.1, foot: true },
    { name: 'thighB', kind: 'leg', shape: ['capsule', 0.15, 0.065], pos: [0, 0.715, -s * 0.095], mass: 7.5 },
    { name: 'shinB', kind: 'leg', shape: ['capsule', 0.16, 0.05], pos: [0, 0.29, -s * 0.095], mass: 3.5 },
    { name: 'footB', kind: 'leg', shape: ['box', 0.12, 0.035, 0.05], pos: [0.05, 0.045, -s * 0.095], mass: 1.1, foot: true },
  ];
}

// ─────────────────────────────────────────────────────────────
//  관절 = 뼈 연결 + 근육
//   ball  : 공 관절(엉덩이·어깨·척추·목) — 세 방향으로 돌지만 각도 제한이 있다
//   hinge : 경첩 관절(무릎·팔꿈치·발목) — 한 방향으로만 접힌다
//   k: 근육 강도(N·m/rad), d: 감쇠(N·m·s/rad), max: 낼 수 있는 최대 회전력(N·m)
//   (물리 엔진 모터가 실제로 내는 값 그대로다. 예전엔 엔진이 각도를 절반으로 잰다고 잘못 알고
//    코드에서 2배를 곱했는데, 실험해 보니 온각도로 잰다. 그래서 표의 숫자를 실제 작동값으로 바꿨다.)
//   lim: 각도 제한(라디안). 회전축 x = 옆으로 벌리기, y = 비틀기, z = 앞뒤로 굽히기(+ 앞)
//        (척추·목은 z가 + 일 때 뒤로 젖혀진다)
// ─────────────────────────────────────────────────────────────
function jointDefs(s) {
  return [
    { p: 'pelvis', c: 'abdomen', at: [0, 1.06, 0], type: 'ball', k: 1800, d: 180, max: 500, lim: { x: [-0.35, 0.35], y: [-0.5, 0.5], z: [-0.7, 0.3] } },
    { p: 'abdomen', c: 'chest', at: [0, 1.2, 0], type: 'ball', k: 1600, d: 160, max: 440, lim: { x: [-0.3, 0.3], y: [-0.6, 0.6], z: [-0.5, 0.25] } },
    { p: 'chest', c: 'head', at: [0, 1.5, 0], type: 'ball', k: 280, d: 16, max: 80, lim: { x: [-0.5, 0.5], y: [-1.0, 1.0], z: [-0.7, 0.5] } },
    // 칼 든 어깨: 뼈가 x축을 따라 누워 있어서 x = 팔 비틀기, y = 좌우로 휘두르기, z = 위아래
    //  (칼 든 어깨는 머리 위~등 뒤까지 크게 돌아서, 엔진 모터 대신 직접 계산한 근육 힘을 쓴다: manual)
    { p: 'chest', c: 'uarmS', at: [0, 1.43, s * 0.2], type: 'ball', manual: true, k: 320, d: 26, max: 80 }, // 사람 어깨 굽힘 힘 69~90N·m
    // 칼 든 팔꿈치: 팔이 앞으로 뻗은 자세 기준이라 어깨에서 위팔 길이(0.3m)만큼 앞. 칼 무게가 실려 감쇠를 넉넉히
    { p: 'uarmS', c: 'farmS', at: [0.3, 1.43, s * 0.2], type: 'hinge', k: 400, d: 38, max: 80, lim: [0, 2.5] }, // 사람 팔꿈치 굽힘 힘 50~75N·m
    { p: 'chest', c: 'uarmO', at: [0, 1.43, -s * 0.2], type: 'ball', k: 400, d: 36, max: 140, lim: { x: [-2.4, 2.4], y: [-1.5, 1.5], z: [-1.0, 2.9] } },
    { p: 'uarmO', c: 'farmO', at: [0, 1.13, -s * 0.2], type: 'hinge', k: 240, d: 20, max: 100, lim: [0, 2.5] },
    { p: 'pelvis', c: 'thighF', at: [0, 0.93, s * 0.095], type: 'ball', k: 1800, d: 160, max: 560, lim: { x: [-0.6, 0.6], y: [-0.6, 0.6], z: [-0.5, 2.0] } },
    { p: 'thighF', c: 'shinF', at: [0, 0.5, s * 0.095], type: 'hinge', k: 1600, d: 100, max: 500, lim: [-2.5, 0.02] },
    { p: 'shinF', c: 'footF', at: [0, 0.08, s * 0.095], type: 'hinge', k: 700, d: 24, max: 240, lim: [-0.6, 0.8] },
    { p: 'pelvis', c: 'thighB', at: [0, 0.93, -s * 0.095], type: 'ball', k: 1800, d: 160, max: 560, lim: { x: [-0.6, 0.6], y: [-0.6, 0.6], z: [-0.5, 2.0] } },
    { p: 'thighB', c: 'shinB', at: [0, 0.5, -s * 0.095], type: 'hinge', k: 1600, d: 100, max: 500, lim: [-2.5, 0.02] },
    { p: 'shinB', c: 'footB', at: [0, 0.08, -s * 0.095], type: 'hinge', k: 700, d: 24, max: 240, lim: [-0.6, 0.8] },
  ];
}

// BODY.legTorque 'human': 엉덩이·무릎 근육 상한(j.max)만 사람 최대 힘으로 (k·d·각도 제한·발목은 그대로, 새 한도 없음)
function humanLegTorque(jdefs) {
  for (const jd of jdefs) {
    if (jd.c === 'thighF' || jd.c === 'thighB') jd.max = BODY.legHipHuman;
    else if (jd.c === 'shinF' || jd.c === 'shinB') jd.max = BODY.legKneeHuman;
  }
}

// ─────────────────────────────────────────────────────────────
//  사람 관절 범위 (BODY.humanLimits, 사장님 9/30 23:40 "관절 한도·자기 몸 충돌 켬"). 튜닝 값이 아니라 물리 범위다
//  — 확인표 '사장님 확인 전 (해부학 범위)'. 출처: docs/motion/human_envelope_2026-09-30.md 표 1 (tools/motion/human_envelope.json
//  literature·bySize.large), 아래팔 돌림만 봉투에 칸이 없어 문헌: AAOS, "Joint Motion: Method of Measuring and Recording" (1965) —
//  엎침 80°·뒤침 80° (Norkin & White, "Measurement of Joint Motion" 도 같은 값).
//  엔진(Rapier) 공 관절 한도는 축마다 상대 회전 쿼터니언 성분(sin(θ/2))에 걸리고 기준(0)이 몸체 틀끼리 같은 자세라, 섞인 회전에선
//  근사다(탐침: 칼 어깨를 축 한도로 옮기면 억지로 민 표본의 27~34 % 가 면 범위 밖). 그래서 칼 어깨 면과 손목 원뿔은 밧줄(rope = 두 점
//  사이 최대 거리)로 각을 정확히 막는다: 관절 자리 W 에서 방향 u 로 L 인 점과 방향 n 으로 K 인 점 사이 거리 ≤ √(L²+K²−2LK·cosα)
//  ⟺ u 와 n 사이 각 ≤ α. K ≫ L 로 두면 거리가 한계 근처에서 가장 빨리 변해 엔진의 mm 위치 오차가 작은 각 오차가 된다(기하, 각은 L·K 와 무관).
// ─────────────────────────────────────────────────────────────
const HD = Math.PI / 180;
export const HUMAN = {
  // 척추 비틀림(어깨선 − 엉덩이선) °, + = 칼 든 어깨가 뒤로. 한쪽 45 대칭 (10/1 동작 PM 교정, docs/motion/corr_v2_shoulder_note_2026-10-01.md
  //  origin/…/pm-motion-research 922058d: 문헌 AAOS 가슴허리 돌림 한쪽 약 45, 왼쪽 벌 클립 −41°. 예전 −29~46 은 오른쪽 클립만 잰 값)
  spineTwist: [-45, 45],
  shoulderPlane: [-45, 130], // 칼 어깨 들림 면 °: 수평 벌림 약 45 · 수평 모음(몸 앞 가로지름) 약 130 (봉투 문헌 칸, AAOS)
  shoulderElev: 180, // 칼 어깨 들림 ° (굽힘·벌림 180, AAOS)
  shoulderExt: 60, // 칼 어깨 폄(뒤로) ° (AAOS)
  elbow: 150, // 칼 팔꿈치 굽힘 ° (AAOS 150, 봉투 문헌 칸)
  gripFlex: 163, // 아래팔-칼 각 ° 최대: 봉투 손목 칸 클립 크게 최대 163 (135~160 부터 무리), 설계 측정 줄 '> 163'
  forearmRoll: 80, // 아래팔 엎침·뒤침 ° (AAOS 80 · 80)
};
/**
 * BODY.humanLimits 일 때 관절 표를 사람 범위로 (몸이 만들어질 때 한 번). false 면 부르지 않는다 → 오늘 그대로
 *  - 척추 비틀림(축 한도 y): HUMAN.spineTwist ±45° 를 오늘 복부 0.5 : 가슴 0.6 비율로 나눈다. 엔진 y 가 + 면 칼 든 어깨가 앞으로 → 봉투 + (뒤로) 는 엔진 −
 *  - 칼 팔꿈치(경첩): 0~150°
 *  - 칼 어깨 면은 밧줄 (Fighter.shoulderOn), 손목 원뿔은 밧줄 (Fighter.gripConeOn)
 */
export function humanJointDefs(defs, s) {
  const [tw0, tw1] = HUMAN.spineTwist;
  const share = { abdomen: 0.5 / 1.1, chest: 0.6 / 1.1 }; // 오늘 척추 한도 0.5 : 0.6 (jointDefs) 의 비율
  const sideLim = (a, b) => (s > 0 ? [a * HD, b * HD] : [-b * HD, -a * HD]);
  for (const jd of defs) {
    if (jd.c === 'abdomen' || jd.c === 'chest') jd.lim = { ...jd.lim, y: sideLim(-tw1 * share[jd.c], -tw0 * share[jd.c]) };
    if (jd.c === 'farmS') jd.lim = [0, HUMAN.elbow * HD];
  }
  return defs;
}
// ─────────────────────────────────────────────────────────────
//  칼 팔 관절 가동 범위 교정 (config JOINTS, 시제품 기본 끔 — docs/motion/joint_range_2026-10-09.md). jm() = 켠 묶음의 몫 ({} = 끔 → 오늘 그대로)
// ─────────────────────────────────────────────────────────────
const jm = () => JOINTS.presets[JOINTS.mode] ?? {};
/** ⓐ 엔진 한도: 칼 팔꿈치 경첩 한도를 [elbowMin, elbowMax] 로 (몸이 만들어질 때·절단 뒤 수동 관절이 같은 표를 읽는다) */
function anatJointDefs(defs) {
  if (!jm().hard) return defs;
  for (const jd of defs) if (jd.c === 'farmS') jd.lim = [JOINTS.elbowMin * HD, JOINTS.elbowMax * HD];
  return defs;
}
/** ⓒ 손 목표 자르기: armIK·armU 가 손 목표 거리를 자르는 위 끝 (m). 끔이면 오늘 그대로 위팔 + 아래팔 − 여유 */
//  player: 사람 손가락이 모는 칼인가 (playerArm). 'anat' 의 playerReach 는 플레이어 칼에만 playerReachFrac 로 자른다 (AI 는 원래 거의 안 뻗고, 걸면 레이피어 승률 −14 — 기록 §7·§8)
function ikReach(a, b, player = false) {
  if (jm().reach) return Math.min(a + b - IK_MARGIN, (a + b) * JOINTS.reachFrac);
  if (player && jm().playerReach) return Math.min(a + b - IK_MARGIN, (a + b) * JOINTS.playerReachFrac);
  return a + b - IK_MARGIN;
}
/** 사람 손가락이 모는 칼인가: skill.autoGuard 는 플레이어만 true (main.js newRound · 시뮬 입력 길 corr_lib inputPump). skill.corr 로 가르면
 *  corr_s0 (모든 파이터 corr old/v2 바꿔 끼움)의 '설정 0 동일'이 깨져서 쓰지 않는다 */
const playerArm = (f) => f.skill?.autoGuard === true;
const _pe0 = new THREE.Vector3(), _pe1 = new THREE.Vector3(); // inputEdgeLead scratch
/** 위팔 비틀기 서보 강성 (N·m/rad): JOINTS.twistK 가 있으면 그것, 없으면 켠 묶음의 twistK, 둘 다 없으면 25 (오늘 값). 감쇠·상한은 같은 배율 (manualMuscle) */
const twistK = () => JOINTS.twistK ?? jm().twistK ?? 25;
/** 날 세우기 힘(twistScale) 배율: JOINTS.edgeK 가 있으면 그것, 없으면 켠 묶음의 edgeK, 둘 다 없으면 1 */
const edgeK = () => JOINTS.edgeK ?? jm().edgeK ?? 1;
/** 날 세우기 방식 (JOINTS.edge, 10/9 날 세우기): 'torque' = 명시 돌림힘(오늘, 끔) · 'motor' = 암시적 모터 ⓐ · 'ff' = 각속도 앞먹임 ⓑ · 'pre' = ⓐ + 미리 돌리기 ⓒ */
const edgeMode = () => JOINTS.edge ?? 'torque';
/**
 * armIK 의 위팔 방향 u (가슴 틀): 손 목표 T(가슴 틀)·어깨 S 에서 armIK 와 같은 식 (같은 IK_POLE·IK_DMIN·IK_MARGIN·ARM 길이). out 에 쓴다.
 *  보정 v2 순서 결합(Fighter.corrTrunkTurn)이 '이 가슴 yaw 면 칼 어깨가 어디를 향하나'를 몸을 움직이지 않고 묻는 데 쓴다
 */
function armU(T, S, side, out, player = false) {
  const a = ARM.upper;
  const b = ARM.fore;
  const D = _au1.copy(T).sub(S);
  const d = THREE.MathUtils.clamp(D.length(), IK_DMIN, ikReach(a, b, player));
  const Dn = D.normalize();
  const pole = _au2.set(IK_POLE[0], IK_POLE[1], side * IK_POLE[2]).normalize();
  const pDir = pole.addScaledVector(Dn, -pole.dot(Dn));
  if (pDir.lengthSq() < 1e-6) pDir.set(0, -1, 0);
  pDir.normalize();
  const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return out.copy(Dn).multiplyScalar(Math.cos(alpha)).addScaledVector(pDir, Math.sin(alpha));
}
/** ① 날것의 매핑 (몸 틀, 가슴 원점): 패드 (x, y) → 손 (깊이, 0.1 + y, 0.1 + x), 가운데로 모을수록 앞으로 뻗는다. driveSword·corrScale·padHand 가 같은 식을 읽는다 */
function rawHand(x, y, out) {
  const R = WEAPON.reach;
  const depth = 0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x * x + y * y) / (R * R)));
  return out.set(depth, 0.1 + y, 0.1 + x);
}
// 밧줄 기하: 관절 자리에서 몸 쪽 방향으로 L = 1 m, 다른 쪽 방향으로 K = 10 m 인 가상의 두 점 (각은 L·K 와 무관, 위 머리말)
const ROPE_L = 1;
const ROPE_K = 10;
// armIK 의 팔꿈치 겨냥(pole, 가슴 틀 (뒤, 아래, 바깥 × side) 방향)과 거리 자르기 (m): armIK 와 보정 v2 순서 결합(corrTrunkTurn)이 같은 값을 읽는다
const IK_POLE = [-0.25, -1, 0.5];
const IK_DMIN = 0.08;
const IK_MARGIN = ARM.slack; // 펴짐 여유 0.005 m (config ARM.slack — finish.js 닿는 공·근접 밀치기 armFull 과 한 값)
// 보정 v2 순서 결합의 이분법 횟수: 괄호 [0, δ*] 를 2⁻¹⁶ 로 (δ* ≤ π 면 0.003° 아래). 풀이 해상도일 뿐 크기·빠르기를 정하지 않는다 (기하)
const TURN_BISECT = 16;
// 보정 v2 몸 돌림의 골반 몫 (updateBodyPose v2 가지의 s·0.5·turn = 옛 가지 620 의 골반 몫 0.5, 이름만 붙인 재사용)
const PELVIS_SHARE = 0.5;
// 손이 있는 쪽으로 몸을 트는 계수 (rad / 패드 m): applyPose 의 −aim.x·0.35, 보정 v2 updateBodyPose 의 −aimRaw.x·0.35 와 같은 수 (이름만 붙인 재사용)
const BODY_TURN = 0.35;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const HELD_MOVE = Object.freeze({ x: 0, y: 0 }); // 발이 묶인 동안 읽는 조종 입력 (feetHeld)
const HOLD_MOVE = { x: 0, y: 0 }; // 독일 간격 잡기 동안 읽는 조종 입력 — 옆 몫만(앞 몫 0, gait.js holdTick · driveBalance)
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const toV = (v) => _v3.set(v.x, v.y, v.z);
const RIGHT_LOCAL = new THREE.Vector3(0, 0, 1);
const _cvFace = new THREE.Vector3(); // 막기 자리 몸꼴 칼 면 (driveSword — 10/12 왕관)
const rot = (b, out) => {
  const r = b.rotation();
  return out.set(r.x, r.y, r.z, r.w);
};
const angvel = (b, out) => {
  const v = b.angvel();
  return out.set(v.x, v.y, v.z);
};
const vecArg = (v) => ({ x: v.x, y: v.y, z: v.z });

/**
 * 근육의 힘-속도 관계 (Hill): 빨리 줄어들수록(당기는 방향으로 빨리 움직일수록) 낼 수 있는 힘이 준다.
 *  v = 힘을 내는 방향으로 움직이는 각속도 (음수 = 버티며 늘어남 → 오히려 조금 더 버틴다)
 *  vmax에서 힘은 0. a는 곡선의 휨 정도(사람 근육 약 0.25). ecc = 버틸 때 최대 배율
 */
function hill(v, vmax, a = 0.25, ecc = 1.4) {
  const r = v / vmax;
  if (r >= 1) return 0;
  if (r >= 0) return (1 - r) / (1 + r / a);
  const e = Math.min(1, -r / 0.3);
  return 1 + (ecc - 1) * (1 - (1 - e) * (1 - e));
}

/**
 * 손 목표(몸 앞 평면의 좌우 x, 위아래 y) → 칼끝 방향 (몸 기준: x 앞, y 위, z 칼 든 쪽)
 */
/**
 * 한손 칼끝 접기 (10/10 사장님 '칼끝 계속 이상하더라' — docs/motion/onehand_tip_2026-10-10.md, 확인표 523): 한손 칼은 손을 옆으로 뺄수록(|az| 26 → 46°)
 *  칼끝이 상대를 겨누지도, 분명히 위·아래도 아닌 '옆으로 누운' 자리(가슴 높이 옆 패드: 올림 −4° · 방위 46°)에 머문다 — 칼을 깃대처럼 옆으로 내민 꼴.
 *  그 자리에서 올림각을 위(JOINTS.oneTipUp) 또는 아래(oneTipDown)로 접는다: 가르는 선은 올림 oneTipFold (그 위면 위로, 아래면 아래로, 사이 ±5° 는 섞음).
 *  상대를 겨누는 가운데(|az| < 26°)와 이미 분명히 위·아래인 자리는 그대로다
 */
function oneTipLift(el, az) {
  const a = THREE.MathUtils.smoothstep(Math.abs(az), JOINTS.oneTipAz[0] * D2R_F, JOINTS.oneTipAz[1] * D2R_F);
  if (a <= 0) return el;
  const f = JOINTS.oneTipFold * D2R_F;
  const c = THREE.MathUtils.smoothstep(el, f - 5 * D2R_F, f + 5 * D2R_F);
  const up = Math.max(el, JOINTS.oneTipUp * D2R_F), dn = Math.min(el, JOINTS.oneTipDown * D2R_F);
  return el + a * (c * (up - el) + (1 - c) * (dn - el));
}
const D2R_F = Math.PI / 180;
function guardDir(x, y, oneHand = false) {
  // 들어 올릴수록 칼이 선다: 가슴 높이(0.1) 수평, 머리 위(0.6)에서 약 95°(살짝 뒤로)
  let el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
  // 옆으로 뺄수록 칼이 그쪽으로 눕는다 (칼 든 쪽은 더 크게 뺄 수 있다)
  const az = THREE.MathUtils.clamp((x - 0.05) * 1.7, -1.1, 1.3);
  if (oneHand && JOINTS.oneTip !== 'off') el = oneTipLift(el, az);
  const c = Math.cos(el);
  return [c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}

export class Fighter {
  /**
   * @param {object} o
   * @param {number} o.index  0 = 플레이어, 1 = 상대
   * @param {number} o.x       시작 x 위치
   * @param {number} [o.z]     시작 z 위치 (기본 0 — 잠든 습지만 옆으로 비켜 선다, main.js)
   * @param {object} [o.terrain] 땅 계약 { heightAt(x, z), normalAt(x, z), … } (화산섬만 — 없으면 평평한 y 0)
   * @param {number} o.heading 처음 바라보는 방향(라디안). 0 = +x
   * @param {object} o.look    겉모습(색, 투구 등) — looks.js 참고
   */
  constructor(RAPIER, world, scene, colliderInfo, o) {
    this.R = RAPIER;
    this.world = world;
    this.colliderInfo = colliderInfo; // 절단(sever) 이 떨어진 부위의 collider 에 detached 표시를 적는다 (combat.js 가 상처를 건너뜀)
    this.index = o.index;
    this.name = o.name;
    this.side = 1; // 오른손잡이
    this.heading = o.heading ?? 0;
    this.terrain = o.terrain ?? null; // 지형 무대(화산섬 — etna_ground.js 의 땅 계약)만. 없으면(평지 무대) 바닥은 늘 y 0 — 아래 '지형 있을 때만' 갈래를 하나도 타지 않는다
    this.faceTarget = null; // 바라볼 지점(보통 상대 골반). main이 매 스텝 넣어준다.

    // ── 몸 상태 (체력 게이지 대신) ──
    this.blood = 1; // 남은 피 (1 = 100%)
    this.bleed = 0; // 초당 출혈량 (전체 피 대비 비율)
    this.consciousness = 1; // 의식. 0이 되면 기절(패배)
    this.pain = 0; // 통증: 크게 맞으면 잠깐 힘이 빠진다
    this.limbs = { armS: 1, armO: 1, legF: 1, legB: 1 }; // 팔다리 기능 (1 = 멀쩡)
    this.wounds = []; // { part, type, severity, bleed, local(몸 기준 위치) }
    this.causeOfDeath = null;
    this.revive = reviveOf(o.revive); // 처음 죽을 때 한 번 더 일어서기 (캐릭터 시트 revive, 없으면 null) — revive.js
    this.revival = null; // 부활하는 중이면 그 진행 상태 (revive.js)
    this.physiology = o.physiology ? Object.freeze({ ...HUMAN_BODY, ...o.physiology }) : HUMAN_BODY; // 몸 규칙 (캐릭터 시트 physiology — 병마용, 위 HUMAN_BODY). 없으면 사람
    this.daze = 0;
    this.downTime = BODY.fallDuration;
    this.kneelTime = 1.1;
    this.riseTime = 0.9;
    // 투구: ARMOR.on 이면 look.helmet 에 무엇이든 적혀 있으면 막아 주는 투구다(종류별 값은 ARMOR.helmets).
    //  끄면 예전처럼 플레이어 케틀햇만 막는다
    const helmType = ARMOR.on ? o.look.helmet || null : o.look.helmet === 'kettle' ? 'kettle' : null;
    this.hasHelmet = !!helmType;
    this.helmetType = helmType;
    this.helmetSpec = helmType ? ARMOR.helmets[helmType] || ARMOR.helmets.kettle : null;
    this.helmetIntegrity = 1; // 투구 상태 (찌그러질수록 덜 막아준다)
    this.cloth = {}; // 부위별 옷(누비 상의) 상태 1 = 멀쩡, 0 = 넝마
    // 판금 (ARMOR.on 이고 look.armor === 'plate'): 판이 붙은 부위만 내구도 1 = 멀쩡 → 0 = 부서져 사라짐 (그 뒤로는 누비옷 판정)
    //  판이 붙은 부위는 outfits.js 가 판금 메쉬를 그 부위 그룹의 userData.armor 로 알려 준 곳 (아래 몸 만들기에서 모은다)
    this.plate = {};
    this.plateGroups = {}; // 부위 → userData.armor 가 달린 겉모습 그룹 (칼 든 팔은 그 안의 돌려 둔 그룹)
    // 부위 → { list: [{ box(그 부위 몸 좌표의 상자), mesh }], partial, shed } 아직 붙어 있는 판금 메쉬마다. 가슴판·배 판띠는 몸통을
    //  감싸서 그 부위 전체를, 나머지(견갑·손목 보호대·정강이받이·골반 아래 자락)는 판이 실제로 덮은 곳만 막는다(손목 보호대가
    //  아래팔 전체를, 허벅지께에 늘어진 자락이 골반 전체를 막지 않게). 흔적(데칼)은 맞은 곳에서 가장 가까운 판에 붙인다
    this.plateBoxes = {};
    this.plateGait = []; // 걷는 속도를 늦추는 판이 붙은 부위 (몸통·다리, ARMOR.moveMul)
    // 방어구가 부서진 기록 (측정 도구가 읽는다): 완전히 부서진 판금 부위 수, 파손(곁 조각이 떨어져 나감) 횟수
    this.platesBroken = 0;
    this.armorShed = 0;
    this._helmStage = 0; // 조각 투구의 파손 단계 (ARMOR.helmets[종류].shed 에서 몇 단계까지 떨어져 나갔나)
    this.armorBroke = false; // 이번 타격에 판금 부위나 투구가 완전히 부서졌다 (main.js onWound 가 깨지는 소리를 한 번 내고 되돌린다)
    this.scene = scene;
    this.armed = true;
    this.balance = 100; // 휘청임 게이지: 세게 맞으면 줄고, 바닥나면 넘어진다
    this.offBalance = 0; // 무게중심이 발 밖으로 벗어난 거리 (m)
    this.offBalanceTime = 0;
    this.stumble = new THREE.Vector2(); // 균형을 잡으려고 자동으로 딛는 걸음 (몸 기준)
    this.state = 'stand'; // stand | down | getup | dead
    this.stateTime = 0;
    this.fightT = 0; // 판이 시작된 뒤 흐른 시간 (step 이 센다. 판마다 새로 만들어져 0부터)
    this.muscle = 1; // 근육 힘 비율 (넘어지면 0 근처로)
    this.stamina = new Stamina(this);
    this.move = new THREE.Vector2(); // x: 옆걸음(+오른쪽), y: 앞(+)/뒤(-). 각각 -1 ~ 1
    // 근접 밀치기 (closeStep, config.js CLOSE). 기본은 끔: main.js 가 플레이어에, ai.js 가 persona.close 있는 AI 에 켠다
    this.canShove = false;
    this.stickX = 0; // 스틱 원값 (감정 배수·검술 층 덮어쓰기 전). 플레이어는 main.js, AI 는 moveFeet 가 쓴다
    this.stickY = 0;
    this.techCue = null; // 기술 알림 { text, kind:'passive'|'unique', school, schoolKo, t } — AI 가 유파 패시브·고유 동작을 낼 때 적고, main.js 가 상대 것만 화면 가운데에 보인다 (10/9)
    this.closeArmed = false; // 걸쇠: 안쪽에서 스틱을 안 밀면 켜지고, 밀면 발사
    this.barge = null; // 밀치는 중 { phase: 'step'|'press', L, stepOk, d0, req(걸음 요청), bent(누르기 중 팔이 굽어 있었나) } (발사 ~ 누르기 끝)
    this.bargeEnd = null; // 마지막 밀치기가 끝난 까닭 (refused·dropped·apart·release·armFull·state·swing·thrust)
    this.shoves = 0; // 발사 횟수
    this.closeStepKind = 'lunge'; // 딛기 걸음 종류: 앞발 lunge. 랴오(persona.close.kind 'kick')는 뒷발이 지나 딛는 pass (ai.js)
    this.lift = 0; // 접기 풀기 0~1 (0 = 오늘 접기 그대로)
    this.liftV = 0;
    this.closeW = 0; // 누르기 손 목표 무게 w 0~1
    this.closeWV = 0;
    this.armFull = false; // 칼 든 팔이 이번 IK 에서 다 펴졌나 (목표가 팔 길이 밖)
    this.strength = o.strength ?? 1;
    this.powerMul = 1; // 서보 힘 창 (유파 비기 — ai.js 가 비기 베기 동안만 SECRET.power 로 둔다). 1 = 그대로 (driveSword)
    this.secretHit = 1; // 결정타 판정 배율 (유파 비기 — 비기 베기 동안 SECRET.hitMul, combat.js 가 상처 에너지에 곱한다). 1 = 그대로
    this.gaitPhase = 0;
    this.gaitWeight = 0; // 0 = 서 있음, 1 = 걷는 중 (부드럽게 바뀜)
    this.stanceDrop = 0; // 딛는 다리가 기울어진 만큼 골반을 낮춰 발이 땅에 닿게 한다
    this.prevU = {};
    this.footLoad = { F: 1, B: 1 };
    this.crouch = 0; // 무릎 꿇기 등으로 낮춘 높이(m)
    this.hunch = 0; // 상처·자세로 일부러 앞으로 숙인 각도(라디안)
    this.footstep = 0; // 발을 디딘 순간의 세기 (main이 읽고 0으로 되돌린다)
    this.gaitDir = new THREE.Vector2(1, 0); // 몸 기준 이동 방향 (x 앞, y 오른쪽)
    this.localVel = new THREE.Vector2();
    this.hitCooldowns = new Map();
    this.onHurt = null;
    // 칼끼리 닿은 느낌 (combat.js가 매 스텝 채운다). 검술의 "느끼기(Fühlen)": 바인드에서 상대가 세게 미는지 약하게 미는지
    //  touching: 지금 칼끼리 닿아 있나, force: 상대 칼이 내 칼을 미는 힘(N), normal: 그 방향(월드), time: 맞댄 채 이어진 시간(초)
    //  impact: 마지막으로 새로 부딪힌 충격량(N·s), impactSpeed: 그때 부딪히는 속도(m/s)
    this.feel = { touching: false, force: 0, normal: new THREE.Vector3(), point: new THREE.Vector3(), time: 0, impact: 0, impactSpeed: 0 };
    // 칼이 세게 막히거나 딱딱한 곳을 친 충격 (0~1, RECOIL.joltTime 동안 사라진다). takeJolt 참고
    this.jolt = 0;

    // 손 목표: 몸 앞 평면에서 (좌우, 위아래) 오프셋(m). 입력/AI가 이 값을 바꾼다.
    // 앞뒤 깊이는 자동: 가운데로 모을수록 팔을 앞으로 뻗는다.
    this.handOffset = new THREE.Vector2(0.15, 0.0);
    this.skill = new Skill(this); // 검술 층: 손 목표·허리·발에 익힌 몸놀림을 보탠다
    this.guardPose = {}; // 손이 따라가는 자세 (걸러진 손 목표 기준)
    this.bodyGuard = {}; // 몸이 따라가는 자세 (거르기 전 입력 기준)
    this.finish = newFinish(); // 쓰러진 상대 마무리(내려찍기) 자세 (finish.js)
    // idle: 보정 v2 쉼 무게 (0 = 손길·휘두름 날것, 1 = 쉼 자세 지도). v2 가지만 쫓고 driveSword 가 읽는다 — 판은 쉼에서 시작
    this.bodyPose = { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0, idle: 1 };
    this.bodyPoseVel = { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0, idle: 0 };
    this.pelvisYawOffset = 0; // 골반을 트는 각도 (라디안, + = 왼쪽으로)
    this.pelvisDropOffset = 0; // 자세에 따라 골반을 더 낮추는 정도 (m)
    this.aimDirW = new THREE.Vector3(1, 0, 0); // 칼끝이 향해야 할 방향 (월드)
    this.debug = { aim: new THREE.Vector3(), wristTorque: new THREE.Vector3(), wristCap: 0 };

    this.bodies = {};
    this.groups = {}; // 부위 이름 → 화면용 그룹
    this.partMesh = {}; // 부위 이름 → 겉면 메쉬 (상처 자국을 붙인다)
    this.meshes = [];
    this.joints = [];
    this.totalMass = 0;

    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
    this.yaw = yaw;
    const origin = this.terrain ? new THREE.Vector3(o.x, this.terrain.heightAt(o.x, o.z ?? 0), o.z ?? 0) : new THREE.Vector3(o.x, 0, o.z ?? 0); // 지형 무대: 시작 자리 땅 높이만큼 몸 전체를 올려 세운다
    const toWorld = (p) => new THREE.Vector3(...p).applyQuaternion(yaw).add(origin);

    const myBody = bodyBit(this.index);
    const otherBody = bodyBit(1 - this.index);
    const otherWeapon = weaponBit(1 - this.index);
    const bodyGroups = groups(myBody, BIT.ground | otherBody | otherWeapon);
    const footGroups = groups(footBit(this.index), BIT.ground | otherWeapon);
    let weaponGroups = groups(weaponBit(this.index), BIT.ground | otherBody | otherWeapon | footBit(1 - this.index));
    // 자기 몸 충돌 (BODY.humanLimits): 제 칼·칼팔(위팔·아래팔) ↔ 제 몸통(골반·배·가슴)·허벅지. 그 밖의 제 몸끼리는 그대로 지나간다.
    //  제 몸 닿음은 combat.js 가 같은 싸움꾼 쌍을 버려 상처·부딪힘·불꽃·소리·멈칫이 되지 않는다(pairOf·접촉힘 사건)
    const HL = BODY.humanLimits;
    const myTorso = torsoBit(this.index);
    const myArmS = armSBit(this.index);
    const torsoGroups = groups(myBody | myTorso, BIT.ground | otherBody | otherWeapon | weaponBit(this.index) | myArmS);
    const armSGroups = groups(myBody | myArmS, BIT.ground | otherBody | otherWeapon | myTorso);
    if (HL) weaponGroups = groups(weaponBit(this.index), BIT.ground | otherBody | otherWeapon | footBit(1 - this.index) | myTorso);

    const defs = partDefs(this.side);
    this.headR = defs.find((d) => d.name === 'head').shape[1]; // 머리 공 반지름 (skill.js 찍기 겨눔이 머리 꼭대기 높이를 잰다)
    this.localPos = {};
    this.localRot = {};
    for (const d of defs) {
      const wp = toWorld(d.pos);
      const lq = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, d.rz || 0);
      this.localRot[d.name] = lq;
      const rb = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(wp.x, wp.y, wp.z)
          .setRotation(vecQ(yaw.clone().multiply(lq)))
          .setLinearDamping(0.05)
          // 칼 든 팔은 엔진 쪽 회전 감쇠를 조금 더 준다 (엔진이 안정적으로 처리하는 감쇠)
          .setAngularDamping(d.alongX ? 1.5 : 0.4),
      );
      const cd = shapeDesc(RAPIER, d.shape)
        .setRotation(vecQ(d.alongX ? ALONG_X : IDENTITY_Q))
        .setMass(d.mass)
        // 옷·살끼리는 잘 미끄러진다 (마찰이 크면 팔이 상대 몸에 걸려 같이 끌려간다)
        .setFriction(d.foot ? 0.9 : 0.25)
        .setCollisionGroups(d.foot ? footGroups : HL && TORSO_PARTS.has(d.name) ? torsoGroups : HL && (d.name === 'uarmS' || d.name === 'farmS') ? armSGroups : bodyGroups);
      const col = world.createCollider(cd, rb);
      if (d.name === 'abdomen') {
        // 배는 가볍고(10kg) 무거운 골반과 상체(30kg) 사이에 끼어 있어서, 엔진의 반복 계산(6회)으로는
        // 허리 근육 힘이 15%밖에 전달되지 않는다(허리가 흐물흐물). 회전 관성을 더해 계산이 수렴하게 한다.
        rb.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 0.4, y: 0.4, z: 0.4 }, vecQ(IDENTITY_Q), true);
      }
      if (d.alongX) {
        // 팔을 길이 방향으로 비트는 관성: 가느다란 캡슐만으로는 실제 팔(근육·뼈·손)보다 훨씬 작아서
        // 조금만 비틀어도 팽이처럼 돈다. 실제 팔 수준(약 0.004 kg·m²)을 더해 준다.
        rb.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 0.004, y: 0, z: 0 }, vecQ(IDENTITY_Q), true);
      }
      colliderInfo.set(col.handle, { fighter: this, kind: d.kind, part: d.name, body: rb });

      const group = new THREE.Group();
      this.groups[d.name] = group;
      // 뼈가 앞으로 누운 부위는 겉모습도 같이 눕힌다 (DRESS_ALONG_X: 겉모습의 +y(어깨 쪽)가 몸 −x(어깨), −y(손목 쪽)가 +x(손목))
      const dressTo = d.alongX ? new THREE.Group() : group;
      if (d.alongX) {
        dressTo.quaternion.copy(DRESS_ALONG_X);
        group.add(dressTo);
      }
      const mesh = dressPart(dressTo, d, o.look);
      // 장식 레이어(outfits.js): 갑옷판·머리모양 등을 얹는다. 무기 겉모습과 같은 이유로 전용 난수를
      // 써서(isolatedVisual) 기존 시드 기준 시뮬(fights12 등)의 결과를 건드리지 않는다.
      isolatedVisual(() => decorateOutfit(dressTo, d, o.look), 0);
      this.partMesh[d.name] = mesh; // 흔적(데칼)을 붙일 겉면
      if (group.userData.helmet) this.helmetGroup = group.userData.helmet;
      if (dressTo.userData.armor?.length) {
        this.plateGroups[d.name] = dressTo;
        this.plateBoxes[d.name] = armorBoxes(group, dressTo, d.kind !== 'chest' && d.kind !== 'abdomen');
        if (d.kind !== 'arm') this.plateGait.push(d.name);
      }
      // 표면만 다듬기 (샛별 저장소에서 가져옴 fe29ce4): 판금 경계를 잡은 뒤 — look.stockEyes·tailoring 표시가 있는 인물만(새 인물 넷). 몸·관절·충돌체는 안 건드린다
      isolatedVisual(() => polishOutfit(dressTo, d, o.look), 0);
      if (d.kind === 'head') {
        this.faceMat = mesh.material;
        this.skinColor = mesh.material.color.clone();
      }

      scene.add(group);
      this.meshes.push({ rb, group, kind: d.kind, mesh });
      this.bodies[d.name] = rb;
      this.localPos[d.name] = new THREE.Vector3(...d.pos);
      this.totalMass += d.mass;
    }
    if (ARMOR.on && o.look.armor === 'plate') for (const name in this.plateGroups) this.plate[name] = 1;

    // 관절 생성 + 근육(관절 모터) + 각도 제한
    const jdefs = jointDefs(this.side);
    if (BODY.weightMode === 'hybrid') hybridJointDefs(jdefs);
    if (BODY.legTorque === 'human') humanLegTorque(jdefs);
    if (HL) humanJointDefs(jdefs, this.side);
    anatJointDefs(jdefs); // 관절 가동 범위 교정 ⓐ (JOINTS, 끔이면 그대로)
    for (const jd of jdefs) {
      const P = new THREE.Vector3(...jd.at);
      const rp = this.localRot[jd.p];
      const rc = this.localRot[jd.c];
      const a1 = P.clone().sub(this.localPos[jd.p]).applyQuaternion(rp.clone().invert());
      const a2 = P.clone().sub(this.localPos[jd.c]).applyQuaternion(rc.clone().invert());
      // 만들 때의 상대 회전 = 관절의 기준(0°) 자세
      const rest = rp.clone().invert().multiply(rc);
      const data =
        jd.type === 'hinge'
          ? RAPIER.JointData.revolute(vecArg(a1), vecArg(a2), { x: 0, y: 0, z: 1 })
          : RAPIER.JointData.spherical(vecArg(a1), vecArg(a2));
      const joint = world.createImpulseJoint(data, this.bodies[jd.p], this.bodies[jd.c], true);
      const raw = joint.rawSet;
      if (jd.manual) {
        // 엔진 모터·각도 제한 없음 (driveJoints에서 직접 회전력을 건다)
        // 관절 가동 범위 교정 ⓐ (JOINTS hard): 칼 어깨 x 축(= 위팔 비틀기, 기준 = 팔 앞으로 뻗고 경첩 축 옆) 한도만 엔진에 건다. 축 한도는 쿼터니언 x 성분이라
        //  위팔을 많이 들수록(흔듦 θ) 실제 허용 돌림이 넓어지는 근사다 (흔듦 90° 에서 70° → 약 108°) — 기록 docs/motion/joint_range_2026-10-09.md
        if (jm().hard && jd.c === 'uarmS') raw.jointSetLimits(joint.handle, MOTOR_AXES[0], JOINTS.twist[0] * HD, JOINTS.twist[1] * HD);
      } else if (jd.type === 'hinge') {
        joint.setLimits(jd.lim[0], jd.lim[1]);
        raw.jointConfigureMotorModel(joint.handle, HINGE_AXIS, 1); // 1 = 힘(N·m) 기준
      } else {
        ['x', 'y', 'z'].forEach((ax, i) => {
          raw.jointSetLimits(joint.handle, MOTOR_AXES[i], jd.lim[ax][0], jd.lim[ax][1]);
          raw.jointConfigureMotorModel(joint.handle, MOTOR_AXES[i], 1);
        });
      }
      this.joints.push({ joint, name: jd.c, parent: this.bodies[jd.p], child: this.bodies[jd.c], type: jd.type, manual: !!jd.manual, restInv: rest.clone().invert(), k: jd.k, d: jd.d, max: jd.max, target: new THREE.Quaternion() });
    }
    this.jointByName = Object.fromEntries(this.joints.map((j) => [j.name, j]));
    // 자기 몸 충돌: 어깨에서 이어진 가슴 ↔ 위팔은 원래 겹쳐 있어 닿음을 끈다 (관절로 이어진 쌍)
    if (HL) {
      this.jointByName.uarmS.joint.setContactsEnabled(false);
      this.shoulderOn();
    }

    // ── 똑바로 서기: 보이지 않는 "기준 막대"(운동학 물체)에 골반을 회전 모터로 묶는다 ──
    //  위치는 자유(골반을 끌고 다니지 않음), 회전만 모터로 맞춘다. 엔진이 한꺼번에 풀어서 떨리지 않는다.
    const pp = this.bodies.pelvis.translation();
    this.anchor = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pp.x, pp.y, pp.z).setRotation(vecQ(yaw)),
    );
    this.uprightJoint = world.createImpulseJoint(
      RAPIER.JointData.generic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0),
      this.anchor,
      this.bodies.pelvis,
      true,
    );
    // 축 번호(측정 10/7, 디렉터 작업 공간 a021/axis_map_test): generic(축 (1,0,0)) 관절은 raw 3 = 닻 x, raw 4 = 닻 z(앞뒤 숙임), raw 5 = 닻 y(연직 = yaw). spherical(3·4·5 = x·y·z)과 다르다.
    //  R2′ K1 (확인표 123, legs): yaw 축(raw 5 = MOTOR_AXES[2]) 모터는 **설정하지 않는다** — 0·0 설정은 자유가 아니라 경성 속도 잠금(한 관절 시험 10/7). 모터 bit 가 안 켜진 축만 자유다.
    for (const ax of MOTOR_AXES) {
      if (BODY.chain === 'legs' && ax === MOTOR_AXES[2]) continue;
      this.uprightJoint.rawSet.jointConfigureMotorModel(this.uprightJoint.handle, ax, 1); // 1 = 힘(N·m) 기준
    }


    // ── 무기: 데이터 중심 무기고(weapons.js)에서 무기 하나를 골라 만든다 ──
    //  기본값(o.weapon 없음)은 그대로 롱소드라서 기존 시뮬 결과가 바뀌지 않는다.
    const spec = getWeapon(o.weapon || DEFAULT_WEAPON);
    this.weapon = spec;
    // 이 무기를 쥔 이 싸움꾼만의 손목·팔 힘 한계 (config.js WEAPON 기본값 + 무기별 보정).
    // 칼 길이도 여기 담아서, 서로 다른 무기를 쥔 두 싸움꾼이 동시에 존재할 수 있게 한다.
    this.weaponCfg = {
      ...WEAPON,
      ...spec.controlOverrides,
      bladeLength: spec.bladeLength,
      hiltLength: spec.hiltLength,
      gripAlong: spec.gripAlong,
      edged: spec.edged,
      mCut: spec.mCut,
      mThrust: spec.mThrust,
      mBlunt: spec.mBlunt,
      power: spec.power, // 등급 공격력 배율 (롱소드=1)
      ignoreArmor: spec.ignoreArmor,
      ignoreArmorDamage: !!spec.ignoreArmorDamage, // 판정만 갑옷 무시 (모르겐슈테른, 사장님 10/8 00:10): combat.analyze — 물리 되튐은 그대로
      twoHand: spec.twoHand,
      thrustStyle: spec.thrustStyle ?? null, // 찌르기 무기의 찌르기 장점 (weapons.js THRUST_STYLE)
      spike: !!spec.spike, // 가시 무기(모르겐슈테른): 날 없는 머리 끝의 약한 찌르기 (combat.js analyze, 확인표 줄 135). 없는 무기는 거짓
    };
    this.weaponSpecId = spec.id; // 기록용(절단 발생률 표의 무기 열)
    this.weaponBroken = false;
    this.guardPose.oneHand = this.bodyGuard.oneHand = !!spec.oneHandStance; // 한손 무기는 한손 자세표 (guards.js: 칼 든 어깨를 앞으로, 손을 더 뻗는다. weapons.js oneHandStance)
    // 검술 풀이 (sword_art.js resolveSwordArt — 10/8 ① 구조: 전엔 이 자리에서 표를 고르고 applyMotionLibrary 를 불렀다. 값은 그대로):
    //  자세표 = 무기 종류별 표(동작 PM 10/1, 사장님 10/1 21:45 승인 — 한손 → 찌르기/세이버 표, 두손 찌르기 칼 → 두손 찌르기 표, 그 밖 → 교본 표)
    //  위에 동작 라이브러리 몸 틀 표(무기 PM, 사장님 10/8 18:50 본판 기본 — 확인표 34: 앞무게 상단·팔상·중단·협, 한손 3번·2번 자세)를 덮은 것.
    //  라이브러리가 켜져 있으면 찌르기 무기 런지·앞무게 흐름도 덧씌운다. 롱소드류(두손 두루)·총은 바뀌는 것 없음. 끄면(SKILL.motionLib 0) 바이트 동일.
    //  AI 기술 목록·간격은 ai.js 생성자가 같은 함수(인물을 넘겨)로 읽는다. 손 모양(hands.js)·HUD 이름(main.js)은 this.swordArt 를 읽는다
    const art = resolveSwordArt(spec);
    this.swordArt = art;
    this.guardPose.table = this.bodyGuard.table = art.table;
    if (art.lib) applySwordArt(this, art, { cover: false });
    // 파손 굴림용 전용 난수 (Math.random 과 분리: 부러지지 않는 한 기존 시뮬의 난수 순서가 바뀌지 않는다).
    //  씨앗은 판 시드(o.breakSeed, 시뮬 하니스가 넘긴다) — 몇 번째로 돌리든 같은 시드면 같은 굴림이 나온다.
    //  시드가 없으면(실제 게임) "이 프로세스에서 몇 번째로 만들어진 파이터인가"로 — 판마다 다른 굴림.
    //  (자리 번호만으로 씨앗을 잡으면 매 판 같은 굴림이 나와 한쪽 자리만 계속 부러지거나 안 부러지는 편향이 생겼다)
    const breakSeed = o.breakSeed ?? (Fighter._breakCount = (Fighter._breakCount ?? 0) + 1);
    this._breakSeed = (Math.imul(0x9e3779b9, breakSeed) ^ ((o.index + 1) * 0x85ebca6b)) >>> 0;
    // 방어구 연출(벗겨진 케틀햇이 도는 힘, 부서진 투구·판금 조각이 흩어지는 방향·시간)용 전용 난수도 같은 까닭으로 따로 두고,
    //  씨앗도 같은 것(판 시드, 없으면 몇 번째 파이터인가)에서 다른 수로 섞어 잡는다 — 파손 굴림과 겹치지 않고,
    //  시뮬에서는 한 프로세스에서 다른 판을 먼저 몇 판 돌렸든 같은 판은 같은 굴림이 나온다
    const armorKey = (Math.imul(breakSeed | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
    this._armorSeed = (Math.imul(0x85ebca6b, armorKey) ^ ((o.index + 1) * 0x27d4eb2f)) >>> 0;
    const L = spec.bladeLength;
    const wristLocal = new THREE.Vector3(0.565, 1.43, this.side * 0.2); // 앞으로 뻗은 팔 끝
    const wp = toWorld(wristLocal.toArray());
    // 처음부터 준비 자세(칼끝이 앞을 향함)로 만든다. 세워서 만들면 시작하자마자 칼이 앞으로 쓰러지며 내리친다.
    const swordRot = yaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -1.45));
    const sword = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(wp.x, wp.y, wp.z)
        .setRotation(vecQ(swordRot))
        .setAngularDamping(0.3)
        // 부드러운 충돌 예측(soft CCD): 빠른 칼이 몸을 뚫고 지나가지 않게 하면서도, "베고 지나가기" 판정(combat.js의
        // 충돌 훅)을 거친다. 딱딱한 CCD는 이 판정을 무시하고 칼을 한 순간에 멈춰 세웠다 (칼끝 18 → 0.1 m/s)
        .setSoftCcdPrediction(0.2),
    );
    const parts = spec.buildParts(o.look); // [모양, 위치y, [질량, 무게중심y, 휘두르는 축 관성, 칼날 축 관성], 색, 칼날인가]
    const restitution = MATERIALS[spec.material]?.restitution ?? STEEL.restitution;
    this.restitution = restitution; // combat.js armSteel()이 바인드 풀린 뒤 되돌릴 때 이 무기 재질 값을 쓴다
    const group = new THREE.Group();
    this.bladeColliders = [];
    this.swordColliders = []; // 칼 전체(칼날+칼자루). 칼끼리 붙어 있는 동안 반발을 끄고 켠다 (combat.js)
    let partIdx = 0;
    for (const [shape, y, [pm, pc, pIe, pIt], color, isBlade, pose] of parts) {
      // pose(선택): 칼 축에서 비켜 놓거나 기울인 부품 — { x: 옆으로(m), rotZ: z 축 회전(rad), I: {x,y,z} 부품 기준 관성 }.
      //  권총 손잡이처럼 총신에서 꺾여 내려오는 부품만 쓴다 (없으면 예전 그대로 칼 축 위, 기울임 없음)
      const cd = shapeDesc(RAPIER, shape)
        .setTranslation(pose?.x ?? 0, y, 0)
        .setMassProperties(pm, { x: 0, y: pc, z: 0 }, pose?.I ?? { x: pIe, y: pIt, z: pIe }, { x: 0, y: 0, z: 0, w: 1 })
        .setFriction(0.4)
        // 재질별 반발 계수. 곱하기 규칙이라 반발이 0인 몸·땅과는 그대로 0 (칼이 살에 튕기지 않는다)
        .setRestitution(restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
        .setCollisionGroups(weaponGroups)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(1)
        // 칼날만: 충돌 직전에 combat.js가 "가르고 지나갈지"를 정할 수 있게 한다
        .setActiveHooks(isBlade ? RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS : RAPIER.ActiveHooks.NONE);
      if (pose?.rotZ) cd.setRotation(vecQ(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, pose.rotZ)));
      const col = world.createCollider(cd, sword);
      this.swordColliders.push(col);
      colliderInfo.set(col.handle, { fighter: this, kind: 'weapon', part: isBlade ? 'blade' : 'hilt', body: sword });
      // 부품 콜라이더는 늘 상자·공 모양이지만(물리 판정은 그대로), 보이는 모양은 두 가지 방식으로 바꿀 수 있다:
      //  · spec.partMesh(idx, ...)가 있으면 그 부품만 곡도·외날 단면·휘어진 몸통 등으로 그린다 (없으면 상자·공 그대로)
      //  · 색이 null 이면 물리 파트만 두고 아예 그리지 않는다 — decorate 가 진짜 모양(곡도·반달칼)을 그리고
      //    group.userData.bladeMesh 로 알려 준다 (연구 세션 세이버·팔쉬온 방식)
      //  어느 쪽이든 콜라이더 치수와 겉보기 치수는 ~1cm 안 (약속: docs/weapon_shots 참고).
      // 등급 마감(finishTier): 겉면이 등급대로 읽히게 한다. 엑스칼리버 복제품만 finishTier를 따로 정해
      // 진품(레전드)과 똑같은 마감을 받는다 — 눈으로 구분이 안 돼야 해서.
      const finish = spec.finishTier ?? spec.tier;
      const pi = partIdx;
      const mesh = isolatedVisual(
        () => spec.partMesh?.(pi, isBlade, shape, color ?? 0x888888, weaponMatOpts(spec.material, isBlade, finish), o.look, finish) ?? shapeMesh(shape, color ?? 0x888888, weaponMatOpts(spec.material, isBlade, finish)),
        VISUAL_DRAWS_PER_PART,
      );
      mesh.position.set(pose?.x ?? 0, y, 0);
      if (pose?.rotZ) mesh.rotation.z = pose.rotZ;
      mesh.visible = color != null; // 색이 null 이면 물리 파트만 두고 그리지 않는다 (decorate 가 곡도·반달칼 같은 진짜 모양을 그린다)
      group.add(mesh);
      partIdx++;
      if (isBlade) {
        this.bladeColliders.push(col);
        this.bladeMesh = mesh; // 벨수록 피가 묻는다
        // 무기마다 다른 밑색 — bloodyBlade가 여기서부터 피 색으로 섞는다. partMesh 가 안 그리는 무기(hiddenParts 인 'blade' 부품 — 모르겐슈테른 철구)는
        //  재질이 없어 null 로 두고, 아래 decorate 가 group.userData.bladeMesh 로 진짜 메쉬와 밑색을 준다
        this.bladeBaseColor = mesh.material?.color.clone() ?? null;
      }
    }
    isolatedVisual(() => spec.decorate?.(group, o.look), 0);
    if (group.userData.bladeMesh) {
      this.bladeMesh = group.userData.bladeMesh; // decorate 가 칼날을 따로 그렸으면 피는 거기에 묻는다
      this.bladeBaseColor = this.bladeMesh.material.color.clone();
    }
    scene.add(group);
    this.meshes.push({ rb: sword, group, kind: 'weapon' });
    this.sword = sword;
    this.gripJoint = world.createImpulseJoint(
      RAPIER.JointData.spherical({ x: 0.13, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), // 아래팔 앞끝(손목)
      this.bodies.farmS,
      sword,
      true,
    );
    if (HL) this.gripConeOn();
    this.swordGroup = group;
    this.swordMass = sword.mass();
    this.stamina.captureMass(this.swordMass); // 파손 전 질량 고정
    // 타격 계산용: 칼의 질량·주관성 모멘트(몸체 기준)와 손 기준 회전 관성
    const pI = sword.principalInertia();
    const pF = sword.principalInertiaLocalFrame();
    const lc = sword.localCom();
    this.swordProps = { m: sword.mass(), I: { x: pI.x, y: pI.y, z: pI.z }, frame: new THREE.Quaternion(pF.x, pF.y, pF.z, pF.w) };
    this.swordIhand = Math.max(pI.x, pI.z) + sword.mass() * lc.y * lc.y;
    this.swordCom = lc.y; // 손(칼 원점)에서 무게중심까지 (m)
    // 칼날 축(길이 방향, 비트는 축) 관성. driveSword()의 "날 세우기" 힘 세기는 롱소드
    // (코등이가 넓어 이 축 관성이 크다)를 기준으로 맞춰져 있어서, 코등이가 좁거나 칼날이
    // 얇은 무기(세이버·라이트세이버 등)는 그대로 쓰면 축이 팽이처럼 돈다. 실제 관성 비율만큼
    // 그 힘도 줄이거나 늘려 안정성을 맞춘다. 기본 롱소드는 그대로 1(원래 동작과 완전히 같음) —
    // TWIST_I_BASE는 반올림한 참고값이라 부동소수점이 완전히 같지 않을 수 있어 예외로 둔다.
    // 비율 그대로 쓰면 롱소드와 똑같은 반응(고유진동수·감쇠비)이 나와 안정적이다. 다만 무기에
    // 따라 이 비율이 너무 작으면(예: 카타나) 날을 세우는 힘이 약해져 짧은 휘두르기 동안 날이
    // 미처 정렬되지 못하는 경우가 있어, 그런 무기는 weapons.js의 controlOverrides.twistScale로
    // 개별 조정할 수 있게 한다 (없으면 실제 관성 비율 그대로).
    this.twistScale = spec.id === 'longsword' ? 1 : (this.weaponCfg.twistScale ?? pI.y / TWIST_I_BASE);
    // 관절 가동 범위 교정 (JOINTS edgeK, 10/9 3차): 위팔 비틀기 서보를 세게(twistK) 하면 날 세우기 힘이 상대적으로 밀려 칼 면으로 맞았다 → 같은 묶음에서 날 세우기 힘도 배율 (1 = 오늘 그대로)
    if (edgeK() !== 1) this.twistScale *= edgeK();
    this.handTarget = new THREE.Vector3();
    this.tipPrev = null;
    this.tipVel = new THREE.Vector3();
    this.hitPointPrev = null;
    this.hitPointVel = new THREE.Vector3();

    // 다리가 체중을 싣는 걸음 (BODY.weightMode 'hybrid'). 'levitate'면 없음 → 예전 방식 그대로
    this.gait = BODY.weightMode === 'hybrid' ? new Gait(this) : null;

    this.applyPose(0);
  }

  get alive() {
    return this.state !== 'dead';
  }

  /** 다리 기능 (두 다리 평균) */
  get legHealth() {
    return (this.limbs.legF + this.limbs.legB) / 2;
  }

  /**
   * 다리가 몸을 못 받친다: 두 다리 평균(legHealth)이 0.25 아래 — 그리고 화산섬 용암에 탄 다리가 하나라도 같은 문턱(0.25) 아래면
   *  (멀쩡한 다리와 평균을 내서 탄 다리가 다시 서는 것만 막는다 — 샛별 37c8857b 그대로, 확인표 1460~). 용암에 덴 적 없으면(lavaBurn 없음) legHealth < 0.25 와 같다
   */
  get legsCannotSupport() {
    return this.legHealth < 0.25 || (!!this.lavaBurn && this.lavaBurn.legs.some((limb) => this.limbs[limb] < 0.25));
  }

  /**
   * 균형 흔들림 배율 (1 = 그대로) — 이 몸이 받는 '균형이 흔들리는 양'에 곱하는 오직 한 자리 (docs/strike/japanese_steady_2026-10-15.md · 확인표 1520~).
   *  지금은 유파 보법 '버티기'(사장님 10/15 '휘청·넘어짐 저항') 하나: 지금 걸음 값(gait.P — 손에 든 무기 유파의 걸음 칸)의 steady → 1 − steady (일본 0.25 → 0.75).
   *  곱하는 곳 둘: ① 무게중심이 발 밖으로 벗어난 몫 offBalance(updateFooting) — 휘청 걸음·서두름(GAIT.hurryFrom)·붙잡기 반사(gait levC)·
   *  발 디딤 잃음(offBalanceTime)·기준 막대 풀림이 모두 이 값을 읽는다 ② 맞아서 깎이는 휘청임 게이지(applyWound — balance ≤ 0 넘어짐).
   *  머리 맞아 주저앉음(타격 에너지 문턱)·다리가 못 버팀(legsCannotSupport)은 부상이라 곱하지 않는다.
   *  steady 칸이 없는 유파(독일·무유파 …)·`?jpSteady=0`·`?schoolGait=0`(걸음 값이 GAIT 그 자체)은 1 → 두 곳 모두 곱하는 줄을 건너뛴다(지금 길 그대로).
   *  나중에 스태미너가 들어오면 여기에 곱한다 — 두 곳에 한꺼번에 걸린다.
   */
  get swayScale() {
    const s = BALANCE.schoolSteady ? this.gait?.P.steady : 0;
    return s > 0 ? 1 - s : 1;
  }

  /** 칼 든 팔 기능 */
  get armHealth() {
    return this.limbs.armS;
  }

  /** 피가 모자라거나 아프면 힘이 빠진다 (0~1) */
  get vigor() {
    const b = THREE.MathUtils.clamp((this.blood - VITALS.collapseBlood) / (VITALS.weakBlood - VITALS.collapseBlood), 0, 1);
    return Math.min(1, 0.35 + 0.65 * b) * (1 - 0.4 * Math.min(1, this.pain));
  }

  get pelvisPos() {
    return toV(this.bodies.pelvis.translation()).clone();
  }

  /** 칼날 위의 한 지점(0=손잡이, 1=칼끝)의 월드 좌표 */
  bladePoint(t, out = new THREE.Vector3()) {
    const p = this.sword.translation();
    rot(this.sword, _q1);
    return out.set(0, this.weaponCfg.hiltLength + this.weaponCfg.bladeLength * t, 0).applyQuaternion(_q1).add(_v1.set(p.x, p.y, p.z));
  }

  /** 몸 기준 앞 방향(수평) */
  forward(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  /** 몸 기준 오른쪽 방향(수평) */
  right(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // 상대 쪽으로 몸을 천천히 돌린다 (한 번에 휙 돌지 못하게 회전 속도 제한)
  updateHeading(dt) {
    if (this.state === 'stand' || this.state === 'getup' || this.state === 'kneel') {
      if (this.faceTarget) {
        const p = this.bodies.pelvis.translation();
        const want = Math.atan2(-(this.faceTarget.z - p.z), this.faceTarget.x - p.x);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const maxTurn = BODY.turnSpeed * this.muscle * dt;
        let turn = THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);
        // 다리가 체중을 싣는 걸음: 딛은 발은 땅에 붙어 있어서, 엉덩이가 비틀 수 있는 만큼만 몸을 돌린다 (그 다음은 발을 돌려 딛는다)
        if (this.gait?.active && this.state === 'stand') turn = this.gait.limitTurn(turn);
        this.heading += turn;
      }
    } else {
      // 쓰러져 있는 동안에는 골반이 실제로 향한 방향을 따라간다 (일어날 때 몸이 비틀리지 않게)
      rot(this.bodies.pelvis, _q1);
      const f = _v1.set(1, 0, 0).applyQuaternion(_q1);
      if (Math.hypot(f.x, f.z) > 0.3) this.heading = Math.atan2(-f.z, f.x);
    }
    this.yaw.setFromAxisAngle(UP, this.heading);
  }

  /**
   * 칼의 한 지점(칼날 길이 비율 t)을 쳤을 때 손이 받는 충격의 비율 (0 = 타격 중심, 손이 울리지 않음).
   * 손(칼자루)을 축으로 도는 강체: 1 − a·b/k² (a = 손~무게중심, b = 무게중심~맞은 점, k = 무게중심 기준 회전 반경)
   */
  swordSting(t) {
    const p = this.swordProps;
    if (!p) return 0.5;
    const a = this.swordCom;
    const b = this.weaponCfg.hiltLength + t * this.weaponCfg.bladeLength - a;
    const k2 = Math.max(p.I.x, p.I.z) / p.m;
    return Math.min(1.3, Math.abs(1 - (a * b) / k2));
  }

  /** 검술 자세 지도를 얼마나 따를지 (검술 보정 0 → 0, 약 0.4 → 0.64, 보통 이상 → 1) */
  guardWeight(s = this.skill.level) {
    return Math.min(1, s * 1.6);
  }

  /**
   * 보정 v2 날것 매핑 반지름 (fix2 B): 패드 → 손 매핑을 칼 어깨 S 둘레로 한 배수 k(s) 로 줄인다 (모양 그대로, 구에 자르기 없음).
   *  옛 보정은 쉼 자세(SKILL.homeGuard)에서 자세 지도 손으로 팔꿈치를 굽혀 두는데, 날것 매핑은 그 자리를 팔 길이(ARM 0.57 m) 너머에 둬서
   *  armIK 가 팔을 곧게 편다(10/1 탐침: 쉼 팔꿈치 16° 대 46°). 그래서 쉼 손 목표가 어깨에서 옛 보정 쉼과 같은 거리에 오게 한다:
   *   k(s) = |옛 쉼 손 목표(s) − 옛 쉼 어깨(s)| / |날것 쉼 손 목표 − v2 쉼 어깨|
   *   옛 쉼 손 목표 = 날것.lerp(guardAt(homeGuard).hand, gw(s))           (driveSword 옛 줄, gw = guardWeight(s) 그대로 부름)
   *   옛 쉼 어깨 = armIK 의 S 를 옛 길이 명령하는 가슴 자세로 돌린 자리: yaw −G.chestYaw·gw·holdAmount + (1 − gw)·몸 돌림, 숙임 G.pitch·gw
   *               (updateBodyPose 옛 가지 + applyPose, 쉼 = 휘두르지 않음 → amp = SKILL_BODY.holdAmount)
   *   v2 쉼 어깨 = S 를 v2 쉼 몸 돌림 −homeGuard.x·BODY_TURN 으로 돌린 자리 (v2 가지는 숙임 0) = 배수의 가운데(고정점)
   *  s → 0 이면 gw → 0 이라 두 거리가 같아져 k → 1 (v2 0 은 맨 팔 그대로). 자세표(guardPose.table·oneHand)가 바뀌면 다시 잰다.
   *  돌려주는 c = { k, S (가운데, 몸 틀 m), r (반지름 m) }
   */
  corrScale(s) {
    const gp = this.guardPose;
    const c = (this._corrK ||= { s: NaN, S: new THREE.Vector3() });
    if (c.s === s && c.table === gp.table && c.oneHand === gp.oneHand) return c;
    const [hx, hy] = SKILL.homeGuard;
    const raw = rawHand(hx, hy, _cs1);
    _csG.table = gp.table;
    _csG.oneHand = gp.oneHand;
    const G = guardAt(hx, hy, _csG);
    const gw = this.guardWeight(s);
    const turn = -hx * BODY_TURN;
    const old = _cs2.copy(raw).lerp(_v6.set(G.hand[0], G.hand[1], G.hand[2]), gw);
    const sh = _cs3.set(ARM.shoulder[0], ARM.shoulder[1], this.side * ARM.shoulder[2]);
    const shOld = _cs4.copy(sh).applyAxisAngle(Z_AXIS, -G.pitch * gw).applyAxisAngle(UP, -G.chestYaw * gw * SKILL_BODY.holdAmount + (1 - gw) * turn);
    // 한손 무기 (guardPose.oneHand, 사장님 탐색판 3·4차 '나뭇가지 기본 자세가 몸통 오른쪽으로 쭉 편 것처럼'): 옆으로 선 한손 자세를 날것 매핑의 바탕으로.
    //  선 자세 = 옛 보정 쉼(homeGuard)의 한손 자세표 몸 돌림 그대로 (updateBodyPose 옛 가지: 가슴 −G.chestYaw·gw·holdAmount, 골반 그 0.5 몫). 새 수 없음.
    //  날것 매핑을 그 가슴 yaw 로 돌려(가슴 틀에서 읽어) 칼 든 어깨가 앞으로 나온 몸 앞에 손이 오고, 배수 k 의 가운데도 그 어깨다. 두손은 0 (예전 그대로)
    c.stC = gp.oneHand ? -G.chestYaw * gw * SKILL_BODY.holdAmount : 0;
    c.stP = gp.oneHand ? -G.pelvisYaw * PELVIS_SHARE * gw * SKILL_BODY.holdAmount : 0;
    if (c.stC) raw.applyAxisAngle(UP, c.stC);
    c.S.copy(sh).applyAxisAngle(UP, c.stC ? turn + c.stC : turn);
    c.r = old.distanceTo(shOld);
    c.k = c.r / raw.distanceTo(c.S);
    c.s = s;
    c.table = gp.table;
    c.oneHand = gp.oneHand;
    return c;
  }

  /**
   * 보정 v2 순서 결합 (fix2 A): 패드 (x, y) 가 명령하는 손 목표 T (padHand, x 는 closeReach 로 자름 — driveSword 와 같음) 에 대해, 가슴 yaw 가
   *  psi0 (v2 가지의 총 가슴 명령 = 몸 돌림 −x·BODY_TURN) 일 때 칼 어깨가 T 에 닿지 못하면 그 넘침 각 δ (rad, 몸 틀 yaw 와 같은 부호)를 돌려준다. 0 = 닿음.
   *  가슴 yaw ψ 에서 armIK 는 T 를 가슴 틀 Ry(−ψ)·T 로 보고 어깨 S(ARM.shoulder) 에서 푼다 → 위팔 u 는 armIK 식 그대로 (armU, 같은 IK_POLE·IK_DMIN·IK_MARGIN).
   *   (1) 들림 면 (밧줄이 있을 때 = BODY.humanLimits): 밧줄 두 개가 거는 반공간 u·n ≥ 0 (n = 면 끝 − 90 · 시작 + 90 쪽 수평, shoulderOn 과 같은 식).
   *       끝(몸 앞 가로지름) 쪽을 넘으면 칼 든 어깨를 앞으로(+side), 시작 쪽을 넘으면 뒤로(−side) 튼다
   *   (2) 팔 길이 (옆으로만): 어깨–T 수평 거리가 그 높이의 수평 팔 길이 √(L² − Dy²) (L = ARM.upper + ARM.fore, |Dy| ≥ L 이면 0) 를 넘으면 T 쪽으로
   *  δ = 조건이 막 풀리는 가장 작은 각: 괄호 [0, δₑ] 를 TURN_BISECT 번 이분. δₑ = 그 방향으로 돌 때 조건이 가장 덜 걸리는 각 (기하 괄호, 자르기 아님):
   *   - 팔 길이·바깥 목표(|T 수평| ≥ |S 수평|)의 들림 면: δ* = 어깨가 T 의 수평 방향을 바로 보는 각. 거기서 수평 거리가 가장 짧고, 어깨 → T 방향은
   *     0° 쪽으로 한 방향으로 돈다(T 가 어깨를 품은 원 위를 돈다)
   *   - 안쪽 목표(|T 수평| < |S 수평|, 맞붙어 closeReach 로 당긴 손)의 들림 면: δ* 에서는 T 가 어깨와 가슴 가운데 사이라 팔이 몸 안쪽(180°)을 향해
   *     다시 나쁘다. 어깨 → T 방향이 가장 바깥으로 오는 곳은 T 의 원에 닿는 접선: δₜ = δ* − acos(|T 수평| / |S 수평|) (0 이하면 그쪽으로 트는 것이 돕지 못함 → 0)
   *  δₑ 에서도 안 풀리면(트는 것으로 다 닿지 못함) δₑ 를 돌려준다: 가장 덜 넘치는 데까지 튼다 (0 으로 끄면 풀리는 이웃 패드와 수십 도 뜀).
   *  두 조건이 다 걸리면 큰 쪽. 크기·빠르기는 부르는 쪽 follow(SKILL_BODY 빠르기·holdSpeed 몫)·관절·근육이 정한다
   */
  /** R2′ 팔 단계 묶음이 이 검객에게 걸리나 (BODY.r2pScope: 'player' = index 0 만, 'all' = 모두) */
  r2pOn() {
    return BODY.r2pScope === 'all' || this.index === 0;
  }

  corrTrunkTurn(x, y, s, psi0) {
    const T = this.padHand(x, y, s, _ct1);
    T.x = Math.min(T.x, this.closeReach());
    const side = this.side;
    const sh = _ct2.set(ARM.shoulder[0], ARM.shoulder[1], side * ARM.shoulder[2]);
    const L = ARM.upper + ARM.fore;
    // 어깨가 T 의 수평 방향을 보는 가슴 yaw (몸 틀 yaw: 방향 h = atan2(−z, x) 가 h + ψ 로 돈다). 어깨 방향 = atan2(−sh.z, sh.x)
    const face = Math.atan2(-T.z, T.x) - Math.atan2(-sh.z, sh.x);
    const towards = (dir) => {
      let a = (face - psi0) * dir;
      a -= 2 * Math.PI * Math.floor(a / (2 * Math.PI)); // [0, 2π): dir 쪽으로 도는 양
      return a;
    };
    const tc = (psi) => _ct3.copy(T).applyAxisAngle(UP, -psi); // 가슴 틀 T
    const rS = Math.hypot(sh.x, sh.z);
    const rT = Math.hypot(T.x, T.z);
    const solve = (dir, bad, hi0) => {
      if (!bad(psi0) || hi0 <= 0) return 0;
      if (bad(psi0 + dir * hi0)) return dir * hi0;
      let lo = 0;
      let hi = hi0;
      for (let i = 0; i < TURN_BISECT; i++) {
        const mid = 0.5 * (lo + hi);
        if (bad(psi0 + dir * mid)) lo = mid;
        else hi = mid;
      }
      return dir * hi;
    };
    let best = 0;
    if (this.shoulderRopes?.length) {
      const [p0, p1] = HUMAN.shoulderPlane;
      // 밧줄 밖 = 두 반공간 중 하나라도 u·n < 0 (n 은 shoulderOn 의 rope(c) 방향) = 면 각 φ 가 [p0, p1] 밖 (밖이 아니면 null)
      const phiOut = (psi) => {
        const u = armU(tc(psi), sh, side, _ct4, playerArm(this));
        const outside = [p1 - 90, p0 + 90].some((c) => Math.sin(c * HD) * u.x + side * Math.cos(c * HD) * u.z < 0);
        return outside ? Math.atan2(u.x, side * u.z) / HD : null;
      };
      const up = (phi) => phi - p1 - 360 * Math.floor((phi - p1) / 360); // p1 에서 위로 φ 까지 [0, 360)
      const down = (phi) => p0 - phi - 360 * Math.floor((p0 - phi) / 360); // φ 에서 위로 p0 까지 [0, 360)
      const phi0 = phiOut(psi0);
      if (phi0 !== null) {
        // 두 방향 다 푼다. +side(칼 든 어깨 앞으로): φ 가 줄어 p1 로 들어온다 → 아직 = 밖이고 p1 에서 위로 잰 각이 쐐기 밖 호의 가운데(half) 또는
        //  φ0 중 먼 쪽 안 (들어왔다 p0 로 다시 나간 φ 는 '아직' 이 아님). −side(뒤로): φ 가 늘어 p0 로 들어온다 → 거울. 넘침 = 들어올 끝까지의 각.
        //  φ0 가 그 쪽 반이면 예전 판정(가운데로 나눔) 그대로. 풀리는 쪽 중 작은 각, 둘 다 못 풀면 δₑ 에서 덜 넘치는 쪽
        //  (안쪽 목표는 φ 가 가운데 너머여도 실제로 풀리는 쪽을 고른다)
        const half = (360 - (p1 - p0)) / 2;
        // δₑ: 바깥 목표 δ*, 안쪽 목표 접선 δₜ. 반 바퀴(π) 너머는 다른 방향으로 덜 돌아 닿는 같은 가슴 방향이라 괄호를 π 에서 끊는다 (기하)
        const end = (dir) => Math.min(Math.PI, towards(dir) - (rT < rS ? Math.acos(rT / rS) : 0));
        const ways = [
          { dir: side, gap: up },
          { dir: -side, gap: down },
        ];
        let pick = null;
        for (const w of ways) {
          const g0 = w.gap(phi0);
          const left = (psi) => {
            const phi = phiOut(psi);
            return phi === null || w.gap(phi) > Math.max(g0, half) ? 0 : w.gap(phi);
          };
          const e = end(w.dir);
          const turn = solve(w.dir, (psi) => left(psi) > 0, e);
          const v = e > 0 ? left(psi0 + turn) : g0;
          if (!pick || v < pick.v || (v === pick.v && Math.abs(turn) < Math.abs(pick.turn))) pick = { turn, v };
        }
        best = pick.turn;
      }
    }
    const Dy = T.y - sh.y;
    const Lh = Math.sqrt(Math.max(0, L * L - Dy * Dy));
    const far = (psi) => {
      const t = tc(psi);
      return Math.hypot(t.x - sh.x, t.z - sh.z) > Lh;
    };
    const dir = Math.sin(face - psi0) >= 0 ? 1 : -1; // T 쪽으로 짧게 도는 방향
    const d3 = solve(dir, far, towards(dir));
    if (Math.abs(d3) > Math.abs(best)) best = d3;
    return best;
  }

  /** 보정 v2 패드 → 손 목표 (몸 틀, 가슴 원점): 날것 매핑을 corrScale 배수로 (driveSword 의 v2 줄과 같은 식). skill.js pad*·updateBodyPose 순서가 쓴다 */
  padHand(x, y, s, out) {
    rawHand(x, y, out);
    const c = this.corrScale(s);
    if (c.stC) out.applyAxisAngle(UP, c.stC); // 한손: 옆으로 선 가슴 틀 (corrScale)
    return out.sub(c.S).multiplyScalar(c.k).add(c.S);
  }

  /** 패드 (x, y) 가 휘두르는 동안 명령하는 손 목표·칼끝 방향 (몸 틀, 가슴 원점 — driveSword 의 날것 줄과 같은 식: 보정 v2 면 padHand, 칼끝 = guardDir).
   *  쉼 무게·자세 지도 섞기·덧씌우기는 넣지 않는다. 중국 빠른 연환(secret_instant.js requestCombo)이 기술 길의 패드를 운동학 길로 옮길 때 읽는다 */
  padPose(x, y, outH, outD) {
    const sv = this.skill.level;
    if (this.skill.corr === 'v2' && sv > 0) this.padHand(x, y, sv, outH);
    else rawHand(x, y, outH);
    return outD.set(...guardDir(x, y, !!this.guardPose?.oneHand)).normalize();
  }

  /** 패드 (x, y) 가 명령하는 손 목표·칼끝 방향 — driveSword 의 쉼 무게·덧씌우기 앞 줄과 같은 식 (보정 v2 = padPose, 옛 보정 = 날것.lerp(자세 지도, gw)).
   *  약한 자세 겨눔(vital_target.js strokeCrossing)이 베기 길이 목 앞을 지나는 높이를 잴 때 읽는다. 자세 지도는 제 scratch 로 부른다 (guardPose 를 건드리지 않는다) */
  strokeCommand(x, y, outH, outD) {
    if (this.skill.corr === 'v2' && this.skill.level > 0) return this.padPose(x, y, outH, outD);
    rawHand(x, y, outH);
    outD.set(...guardDir(x, y, !!this.guardPose?.oneHand));
    const gw = this.guardWeight();
    if (gw > 0) {
      const S = (this._strokeG ||= {});
      S.table = this.guardPose.table;
      S.oneHand = this.guardPose.oneHand;
      const G = guardAt(x, y, S, null);
      outH.lerp(_v6.set(G.hand[0], G.hand[1], G.hand[2]), gw);
      outD.lerp(_v6.set(G.dir[0], G.dir[1], G.dir[2]), gw);
      if (outD.lengthSq() < 0.04) outD.set(G.dir[0], G.dir[1], G.dir[2]);
    }
    return outD.normalize();
  }

  /**
   * 몸의 자세 목표 (골반·가슴 틀기, 숙이기, 낮추기). 손가락 입력을 "거르기 전" 값으로 곧바로 따라가서
   * 손(걸러진 값)보다 먼저 움직인다 → 골반 → 가슴 → 팔 → 칼 순서로 힘이 이어진다 (실제 베기의 순서).
   */
  updateBodyPose(dt) {
    const sk = this.skill;
    const gw = this.guardWeight();
    const G = guardAt(sk.aimRaw.x, sk.aimRaw.y, this.bodyGuard, this.finish, sk.thrustPose);
    const bp = this.bodyPose;
    const bv = this.bodyPoseVel;
    // 딱 멈추는(임계 감쇠) 2차 필터: 출발도 멈춤도 매끄럽다 (1차 필터는 출발 순간 속도가 튄다)
    const follow = (key, target, w) => {
      bv[key] += (w * w * (target - bp[key]) - 2 * w * bv[key]) * dt;
      bp[key] += bv[key] * dt;
    };
    // 벨 때는 온몸을 크게, 자세만 고칠 때는 팔 위주로 (몸통을 조금만, 느리게 튼다) → 자세를 옮길 때마다 몸이 춤추지 않게
    const act = sk.activity;
    const amp = SKILL_BODY.holdAmount + (1 - SKILL_BODY.holdAmount) * act;
    const spd = SKILL_BODY.holdSpeed + (1 - SKILL_BODY.holdSpeed) * act;
    const s = sk.level;
    let arc = 0; // 몸의 호 몫(rad): 순서 결합 ex 가 보는 turn 에는 넣지 않는다 — ex 는 '손이 닿는 데 필요한 만큼' 으로 되돌리는 보정이라 호를 상쇄한다(10/8 03:55 dbg)
    if ((BODY.trunkArc > 0 || BODY.trunkFollow > 0) && this.r2pOn()) {
      // 획 방향 = 손 목표 속도의 가로 성분(부드러운 부호: |vx| 0.5 m/s 에서 ±1, 세로 획은 0 근처). 가로로 움직이는 동안만 갱신 — 손가락이 끝 자리에 서면(follow-through 가 필요한 바로 그때) 마지막 방향을 지킨다
      const vx = sk.vel.x;
      if (sk.swinging && Math.abs(vx) > 0.3) this.swingDir = THREE.MathUtils.clamp(vx / 0.5, -1, 1);
      else if (!sk.swinging && act < 0.05) this.swingDir = 0;
      this.swingAct = act;
      // WA2 몸의 호 v2(10/8 13:30, WA5 에서 고침): 휘두르는 동안 자세 지도의 몸 돌림 기울기(−x·0.35)를 (1 + trunkArc·activity) 배로 — 호는 손가락 자리 x 그 자체에 비례하고(획 시작점 x0 와 무관)
      //  획의 가운데(x = 0)에서 0 이다: 오른쪽에서 감았으면 몸이 오른쪽으로 코일됐다가 베며 풀려 왼쪽으로 넘어간다 → 칼이 지나가는 호가 지도와 같은 자리를 가운데로 넓어져 **베는 자리가 그대로**다.
      //  전 판(x0 기준 변위, 10/8 03:40~13:00)은 호 전부가 베는 쪽에 쌓여 칼이 지도보다 0.6~1 rad 앞서 돌았다 — AI 첫 베기 25/30 → 6/30, 옆으로 0.17 m 빗나감(설계 §2j).
      //  획 구분(x0 재포착·arcHold 이월·가로→세로 전환·감아 올리기 예외)은 전부 필요 없어졌다. 숙련도 s 를 곱하지 않는다: 보정이 아니라 몸의 휘두름(ex 와 같은 뜻)
      if (BODY.trunkArc > 0) arc += -sk.aim.x * BODY.trunkArc * act * BODY_TURN;
      // WA2-2 follow-through(BODY.trunkFollow): 칼(머리)이 겨눔보다 획 방향으로 **뒤처진** 각(aimLagBehind, driveSword 가 부호 있게 잰다 — 앞서 넘어간 칼엔 0)만큼 획 방향으로 몸을 더 돌려 둔다 —
      //  손이 끝 자리에 닿아도 무거운 머리가 따라올 때까지 몸이 멈추지 않는다. 머리가 따라오면 저절로 사라진다. 전 판은 부호 없는 각이라 호가 칼을 지도보다 앞세운 것까지 '뒤처짐' 으로 읽어
      //  몸을 더 돌렸다(되먹임: AI 사선 베기 가슴 1.5 rad, 10/8 13:20 추적). activity 를 곱해 쉼 자세의 뒤처짐은 안 센다
      if (BODY.trunkFollow > 0 && this.aimLagBehind > 0) arc += -(this.swingDir || 0) * BODY.trunkFollow * this.aimLagBehind * act * BODY_TURN;
      this.arcLast = arc;
    }
    if (sk.corr === 'v2' && s > 0) {
      // 보정 v2 (설계 '순서와 정렬'): 자세표 몸 목표 없음. 오늘 끔의 몸 돌림(−x·0.35, applyPose 1510 의 수)을 거르기 전 aimRaw 로
      //  골반 s·0.5(620 의 골반 몫)·가슴 s 만큼 먼저 따라간다 → 골반 → 가슴 → 손(걸러진 aim) → 칼끝 순. 숙이기·낮추기 0
      // WA2 몸의 호(BODY.trunkArc, 10/8): 획 시작 때의 손가락 가로 자리 x0 를 잡아 두고, 휘두르는 동안 (x − x0)·trunkArc·activity 만큼 몸 돌림 명령을 더 튼다 —
      //  쉼·자세 고치기(activity 0)와 trunkArc 0 은 오늘 그대로. 골반(0.5 몫)·가슴(1)·순서 결합 ex 모두 같은 turn 을 보므로 비율은 그대로, 크기만 커진다.
      const turn = -sk.aimRaw.x * BODY_TURN;
      // 순서 결합 (fix2 A, 엉덩이가 손보다 먼저): 거르기 전 패드가 명령하는 손 목표에 칼 어깨가 닿지 못하면(들림 면 밖·팔 길이 밖) 그 넘침 각만큼
      //  가슴을 더 틀고 골반이 같은 몫(PELVIS_SHARE)을 받는다. 손이 필요로 하는 만큼 통째로(s 를 곱하지 않음: 어느 단계든 손은 손가락이 간 곳으로).
      //  자르기 없음 — 척추 ±45°(HUMAN.spineTwist)·applyPose 비틀림 ±0.8·근육이 막는다. 빠르기는 아래 follow 의 SKILL_BODY.pelvis·chest × spd 재사용
      //  (휘두르지 않을 때 spd = SKILL_BODY.holdSpeed 0.3 → 가슴 26·0.3 = 7.8 rad/s 로 손 거르기 SKILL.aimFilter 14 rad/s 보다 느려, 느린 끌기에선 몸이 손 목표 뒤에 온다: 10/1 검토 F2, 사장님 확인 거리)
      // 한손 무기: 옆으로 선 자세(corrScale stC·stP = 옛 쉼의 한손 자세표 몸 돌림)를 바탕으로 더한다. 가슴 총 명령도 그만큼 (순서 결합의 ψ0)
      const cs = this.corrScale(s);
      const ex = this.corrTrunkTurn(sk.aimRaw.x, sk.aimRaw.y, s, cs.stC ? turn + cs.stC : turn);
      let pT = s * PELVIS_SHARE * turn + PELVIS_SHARE * ex + PELVIS_SHARE * arc;
      let cT = s * turn + ex + arc;
      if (cs.stC) {
        pT += cs.stP;
        cT += cs.stC;
      }
      let piT = 0;
      let dT = 0;
      // 찌르기 몸 돌림은 명령(손·칼끝과 같다): thrustPose 몸 값을 th.w·s 로 덧씌운다 (오늘은 bodyGuard × gw)
      const th = sk.thrustPose;
      const kt = th.w * s;
      if (kt > 0) {
        pT += (-th.pelvisYaw * 0.5 * amp - pT) * kt;
        cT += (-th.chestYaw * amp - cT) * kt;
        piT += (th.pitch - piT) * kt;
        dT += (th.drop - 0.06 - dT) * kt;
      }
      // 플레이어 고유 동작 강화의 몸 (10/14 — unique_assist.js skill.uniqBody, 플레이어만 · 없으면 null 이라 그대로): 덧씌우기 칸 몸 값과 같은 꼴로 더한다(골반은 절반).
      //  손 목표·칼끝 방향은 건드리지 않는다 — 궤적은 손가락
      const ub = sk.uniqBody;
      if (ub) {
        pT += -ub.pelvisYaw * 0.5;
        cT += -ub.chestYaw;
        piT += ub.pitch;
        dT += ub.drop;
      }
      // 마무리(쓰러진 상대 내려찍기)만 자세 당김 예외 (사장님 9/30 23:40): FINISH_GUARDS 몫만(finishAt, 보통 자세표·찌르기 덧씌우기 없음)을
      //  s·(마무리 무게 몫, fin.amt 포함) 로 명령
      if (this.finish.amt > 0) {
        const F = finishAt(sk.aimRaw.x, sk.aimRaw.y, _finB, this.finish, this.bodyGuard);
        const kf = s * F.share;
        if (kf > 0) {
          pT += (-F.pelvisYaw * 0.5 * amp - pT) * kf;
          cT += (-F.chestYaw * amp - cT) * kf;
          piT += (F.pitch - piT) * kf;
          dT += (F.drop - 0.06 - dT) * kf;
        }
      }
      // 쉼 무게 (사장님 탐색판 2차 10/1 14:30): skill.idleGoal(손길·휘두름 0, 되돌아옴 recoverP, 쉼 1)을 가슴과 같은 따라가기로 쫓는다
      //  → 다시 닿으면 쉼 자세에서 날것으로, 되돌아오면 날것에서 쉼 자세로 몸처럼 매끄럽게 옮긴다 (튐 없음, 새 수·시계 없음).
      //  몸 목표도 그만큼 옛 가지(아래 else, 같은 G·gw·amp)쪽으로 섞는다: 쉼 손·칼끝(driveSword)만 섞으면 어깨 자리가 달라 팔꿈치·손목이 옛 쉼과 어긋난다
      follow('idle', sk.idleGoal ?? 1, SKILL_BODY.chest * spd);
      const wi = THREE.MathUtils.clamp(bp.idle, 0, 1);
      if (wi > 0) {
        pT += (-G.pelvisYaw * 0.5 * gw * amp - pT) * wi;
        cT += (-G.chestYaw * gw * amp - cT) * wi;
        piT += (G.pitch * gw - piT) * wi;
        dT += ((G.drop - 0.06) * gw - dT) * wi;
      }
      const arcSpd = BODY.trunkArc > 0 && this.r2pOn() ? 1 + (BODY.trunkArcSpeed - 1) * act : 1; // WA2 보조(trunkArcSpeed): 휘두르는 동안만 몸이 더 빨리 따라간다 (기본 1 = 오늘)
      follow('pelvisYaw', pT, SKILL_BODY.pelvis * spd * arcSpd);
      follow('chestYaw', cT, SKILL_BODY.chest * spd * arcSpd);
      follow('pitch', piT, SKILL_BODY.chest * spd);
      follow('drop', dT, SKILL_BODY.pelvis * spd);
    } else {
      // 골반은 아직 발 위치를 바꾸지 못해서(발 딛기 방향 전환 전) 교본 값의 절반만 튼다
      //  WA4(10/8): 옛 보정 가지(AI)에도 몸의 호·follow-through(arc)를 더한다 — arc 가 0 이면 식 그대로(바이트 동일)
      const pT0 = -G.pelvisYaw * 0.5 * gw * amp;
      const cT0 = -G.chestYaw * gw * amp;
      const arcSpd0 = BODY.trunkArc > 0 && this.r2pOn() ? 1 + (BODY.trunkArcSpeed - 1) * act : 1;
      const arcO = arc !== 0 ? arc * (1 - sk.thrustPose.w) : 0; // 찌르기 자세 동안은 v2 가지처럼 호를 줄인다 (검토 2-7)
      follow('pelvisYaw', arcO !== 0 ? pT0 + PELVIS_SHARE * arcO : pT0, SKILL_BODY.pelvis * spd * arcSpd0);
      follow('chestYaw', arcO !== 0 ? cT0 + arcO : cT0, SKILL_BODY.chest * spd * arcSpd0);
      follow('pitch', G.pitch * gw, SKILL_BODY.chest * spd);
      follow('drop', (G.drop - 0.06) * gw, SKILL_BODY.pelvis * spd);
    }
    this.pelvisYawOffset = bp.pelvisYaw;
    this.pelvisDropOffset = bp.drop;
  }

  /** 상대 가슴까지의 수평 거리 (상대가 없으면 Infinity) */
  foeDistance() {
    const f = this.foe;
    if (!f) return Infinity;
    const a = this.bodies.chest.translation();
    const b = f.bodies.chest.translation();
    return Math.hypot(b.x - a.x, b.z - a.z);
  }

  /** 바짝 붙었을 때 손을 상대 몸 속으로 뻗지 않는다 (팔을 접어 칼자루를 몸 가까이 당긴다) */
  closeReach() {
    const r = Math.max(0.12, this.foeDistance() - 0.3);
    // 쓰러진 상대는 발밑에 누워 있어 가슴끼리 가까워도 손을 앞으로 뻗어 내려찍을 수 있다 (finish.js)
    const fa = this.finish.amt;
    return fa > 0 ? r + Math.max(0, 0.6 - r) * fa : r;
  }

  /**
   * 밀쳐내기: 바짝 붙은 채 뒤로 물러나려 하면 빈손(과 칼자루)으로 상대 가슴을 민다.
   * 같은 크기, 반대 방향의 힘을 내 가슴에도 건다 (작용·반작용) → 둘 다 밀려 떨어진다.
   * 아주 가까우면(몸이 닿으면) 물러날 생각이 없어도 조금은 밀어낸다.
   */
  shove() {
    const f = this.foe;
    if (!f || !f.alive || this.revival || f.revival || this.muscle < 0.5) return; // 부활하는 동안엔 밀지도 밀리지도 않는다
    if (this.state !== 'stand' && this.state !== 'kneel') return;
    const d = this.foeDistance();
    if (d > 0.75) return;
    const back = Math.max(0, -this.move.y); // 조이스틱을 뒤로 당긴 정도
    const touch = THREE.MathUtils.clamp((0.55 - d) / 0.2, 0, 1); // 몸이 닿을수록
    const amt = Math.max(back, 0.35 * touch);
    if (amt <= 0) return;
    const a = this.bodies.chest.translation();
    const b = f.bodies.chest.translation();
    const dir = _v1.set(b.x - a.x, 0, b.z - a.z);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const F = BODY.shoveForce * amt * this.muscle * this.strength * (0.4 + 0.6 * this.limbs.armO);
    f.bodies.chest.addForce({ x: dir.x * F, y: 0, z: dir.z * F }, true);
    this.bodies.chest.addForce({ x: -dir.x * F, y: 0, z: -dir.z * F }, true);
  }

  /**
   * 근접 밀치기 (docs/strike/shove_design_2026-09-30.md, config.js CLOSE). 발은 gait 걸음 요청, 몸은 스틱 걷기의 다리 힘에
   *  누르기 동안 다리 밀기(CLOSE.legDrive) 하나를 더하고, 팔은 접기를 풀어 코등이·팔뚝이 상대 몸통에 버팀으로 닿는다 (driveSword).
   *  넘어짐은 상대 균형이 정한다.
   *  발사 = 걸쇠 && 밂 && 준비. 1단계(step) 딛기 → req 다리 착지 → 2단계(press) 누르기 → 물리 사건으로 끝 → lift·closeW 되돌림.
   */
  closeStep() {
    const dt = this.lastDt;
    const f = this.foe;
    const g = this.gait;
    const sk = this.skill;
    const d = this.foeDistance();
    const reach = CLOSE.reach(this.armed ? this.weapon : null); // 빈손은 맨몸 (칼자루 0)
    const push = this.stickY > Math.abs(this.stickX); // 밂 = 상대 쪽 90° 부채꼴 (기하, 감정 배수와 무관)
    const idle = this.stickY <= 0; // 안 밂. 그 사이(대각선 앞)는 걸쇠를 그대로 둔다 (숫자 없는 히스테리시스)
    const foeUp = !!f && f.alive && f.state === 'stand' && !f.revival; // 상대 kneel·getup 은 아님
    let b = this.barge;
    if (b) {
      // 끝 = 물리 사건 (시간값 없음). 먼저: 나·상대 stand 아님, 베기·찌르기 시작
      let end = null;
      if (this.state !== 'stand' || !foeUp || !g?.active) end = 'state';
      else if (sk.swinging) end = 'swing';
      else if (sk.tap) end = 'thrust';
      else if (b.phase === 'step' && g.req !== b.req) {
        // req 다리 착지는 touchdown 이 req 를 지운다 (gait.js touchdown). 오래돼 버려진 요청(기존 req.age > 1 s)이나
        //  다른 요청이 덮어쓴 것이면 밀치기 끝 (발 없는 팔 밀기는 없다)
        if (g.req || b.req.age > 1) end = 'dropped';
        else b.phase = 'press';
      }
      if (!end && b.phase === 'press') {
        if (d > reach) end = 'apart'; // 떨어짐: 팔·칼자루가 더는 닿지 않는다
        else if (idle) end = 'release'; // 밂이 풀림
        else if (this.armFull && b.bent && !this.closeTouch()) end = 'armFull'; // 팔이 다 펴졌는데 닿은 것 없음 (밂을 다 씀)
        // 다 펴짐은 누르기 중의 사건: 누르기 중 굽어 있던 팔이 다 펴진 때만. 처음부터 팔 길이 끝인 자세(지붕 등)는 밂을 쓴 게 아니다
        if (!this.armFull) b.bent = true;
      }
      if (end) {
        this.barge = b = null;
        this.bargeEnd = end;
      }
    }
    if (!b) {
      // 걸쇠: 밀치는 중엔 건드리지 않는다 (1단계 중 엄지가 가운데를 지나도 재발사 없음)
      if (!(d <= reach)) this.closeArmed = false;
      else if (idle) this.closeArmed = true;
      else if (push && this.closeArmed) {
        // 밀면 걸쇠를 쓴다 (준비가 안 된 밂 — 베는 중·찌르는 중·발 묶임 등 — 이 나중에 저절로 밀치기가 되지 않게)
        this.closeArmed = false;
        const ready =
          this.state === 'stand' && g?.active && !this.feetHeld && !(this.armed && this.weapon?.gun) && foeUp && !this.revival && !sk.swinging && !sk.tap;
        if (ready) {
          // 걸음 길이 L: 몸통 닿는 선(shove() 의 0.55)까지 남은 거리, 발 한 번(GAIT.maxReach). 0 이면 몸통이 이미 닿아 걸음 없음
          const L = THREE.MathUtils.clamp(d - 0.55, 0, GAIT.maxReach);
          this.shoves++;
          b = this.barge = { phase: L > 0 ? 'step' : 'press', L, stepOk: null, d0: d, req: null, bent: false };
          if (L > 0) {
            // 찌르기 걸음과 같은 요청 (skill.js thrust: lunge, 0.3 s. 랴오만 pass). 거절되면 밀치기 끝
            b.stepOk = g.requestStep({ kind: this.closeStepKind, fwd: L, duration: 0.3 });
            if (b.stepOk) b.req = g.req;
            else {
              this.barge = b = null;
              this.bargeEnd = 'refused';
            }
          }
        }
      }
    }
    // 다리 밀기 (config.js CLOSE.legDrive, 사장님 10/1 02:05): 누르기 동안만, 내 발 하나라도 땅을 딛고 있으면 (gait.pinFeet 가 이 스텝에
    //  잰 발의 땅 접촉 힘 l.N, 걸음·발 떼기 판단과 같은 값) 골반을 상대 가슴 쪽으로 수평으로 민다. 땅 반작용이라 반대 힘은 땅이 받는다.
    //  상대는 닿은 몸·칼로 받고, 넘어짐은 상대 균형이 정한다. 가슴 숙이기는 새 자세 값 없이 기존 걷는 방향 숙이기(driveBalance lean,
    //  골반 앞 속도)가 맡는다
    if (b?.phase === 'press' && ((g.legs.F.N || 0) > 0 || (g.legs.B.N || 0) > 0)) {
      const a = this.bodies.chest.translation();
      const c = f.bodies.chest.translation();
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const n = Math.hypot(dx, dz);
      if (n > 1e-6) {
        const k = (CLOSE.legDrive * this.muscle * this.strength) / n;
        this.bodies.pelvis.addForce({ x: dx * k, y: 0, z: dz * k }, true);
      }
    }
    // 되돌림 섞기: lift(접기 풀기)·closeW(누르기 무게)는 기존 몸 자세 따라가기 SKILL_BODY.chest(26/s, updateBodyPose 의
    //  임계 감쇠 2차 필터)로 목표를 따라간다. 밀치는 동안 lift → 1, 누르기에서 closeW → 1, 끝나면 둘 다 0 으로 (잠그지 않는다)
    const w = SKILL_BODY.chest;
    const lt = b ? 1 : 0;
    const wt = b?.phase === 'press' ? 1 : 0;
    this.liftV += (w * w * (lt - this.lift) - 2 * w * this.liftV) * dt;
    this.lift += this.liftV * dt;
    this.closeWV += (w * w * (wt - this.closeW) - 2 * w * this.closeWV) * dt;
    this.closeW += this.closeWV * dt;
  }

  /** 누르기: 내 팔·칼이 상대 몸(발 빼고)이나 칼에 닿아 있나 (Rapier 접촉을 읽기만 한다) */
  closeTouch() {
    const f = this.foe;
    if (!f) return false;
    const mine = [this.bodies.uarmS, this.bodies.farmS, this.bodies.uarmO, this.bodies.farmO].map((rb) => rb.collider(0)).concat(this.armed ? this.swordColliders : []);
    const theirs = [];
    for (const [k, rb] of Object.entries(f.bodies)) if (!k.startsWith('foot')) theirs.push(rb.collider(0));
    theirs.push(...f.swordColliders);
    let hit = false;
    for (const a of mine) {
      for (const c of theirs) {
        this.world.contactPair(a, c, (m) => {
          if (m.numContacts() > 0) hit = true;
        });
        if (hit) return true;
      }
    }
    return false;
  }

  // ── 매 물리 스텝마다 호출: 근육을 움직인다 ──
  step(dt) {
    this.lastDt = dt;
    this.stateTime += dt;
    this.updateState(dt);

    // 상태에 따른 근육 힘 목표치
    let targetMuscle = 1;
    if (this.state === 'down') targetMuscle = this.missingLeg ? 0.35 : 0.1; // 다리를 잃고 누운 몸: 팔·손목은 산다(절단 설계 §3-6 '누운 채 벤다' — driveSword 문턱 0.12 위, 10/8 검토 2)
    else if (this.state === 'dead') targetMuscle = 0.02;
    else if (this.state === 'getup') targetMuscle = Math.min(1, 0.35 + this.stateTime / this.kneelTime);
    if (this.state !== 'dead') targetMuscle *= this.vigor;
    this.muscle += (targetMuscle - this.muscle) * Math.min(1, dt * (targetMuscle > this.muscle ? 4 : 12));

    for (const { rb } of this.meshes) rb.resetForces(true), rb.resetTorques(true);
    this.jolt = Math.max(0, this.jolt - dt / RECOIL.joltTime);

    this.updateHeading(dt);
    if (this.stamina.exhausted) {
      this.move.set(0, 0); this.stickX = this.stickY = 0;
      this.barge = null;
      if (this.gait) this.gait.req = null;
    }
    updateFinish(this, dt); // 상대가 쓰러져 있으면 아래쪽 자세를 내려찍기로 (finish.js)
    this.skill.update(dt);
    this.stamina.step(dt);
    this.updateBodyPose(dt);
    this.driveBalance(dt);
    if (this.gait?.active) this.gait.pinFeet();
    this.applyPose(dt);
    if (this.canShove && CLOSE.on) this.closeStep(); // 근접 밀치기: 누르기 동안 다리 밀기만 더한다 (shove() 의 힘 순서 그대로)
    this.shove();
    this.driveSword(); // 팔 목표(IK)를 정한 뒤
    this.offHand(); // 빈손으로 칼자루 끝을 잡는다
    this.driveJoints(); // 모든 관절 근육을 움직인다
    this.elbowGravity();
    if (jm().soft) this.anatSoft(); // 관절 가동 범위 교정 ⓑ 범위 끝 되돌림 (JOINTS, 끔이면 부르지 않는다)
    this.trackBlade(dt);
    if (this.chainDbg) this.chainProbe(dt); // 탐색판 HUD 측정만 (public/r2p/?chain=…)

    for (const [k, t] of this.hitCooldowns) {
      if (t - dt <= 0) this.hitCooldowns.delete(k);
      else this.hitCooldowns.set(k, t - dt);
    }
    this.fightT += dt;
  }

  /** 판 시작 뒤 ARENA.startHold 초 동안 발이 묶였나 (사장님 9/30: 시작 2초 뒤 움직여). 걷기·기술 걸음·자세 고쳐 딛기만 막고 팔·칼·균형 걸음(stumble·닿지 않는 발)은 그대로 */
  get feetHeld() {
    return this.stamina.exhausted || this.fightT < ARENA.startHold - 1e-6;
  }

  // 상태: stand(서 있음) → down(완전히 쓰러짐) → getup(무릎 꿇고 → 일어섬) → stand
  //       kneel: 다리를 크게 다쳐 무릎 꿇은 채로 버팀(칼은 쓸 수 있다)
  updateState(dt) {
    this.updateVitals(dt);
    if (this.state === 'dead') return;
    const tilt = this.tiltDeg();
    const leg = Math.max(0.3, this.legHealth);
    // 일어나는 데 걸리는 시간: 다리가 다칠수록, 피를 흘릴수록 오래
    this.kneelTime = (1.1 / leg) / Math.max(0.5, this.vigor);
    this.riseTime = (0.9 / leg) / Math.max(0.5, this.vigor);
    if (this.revival) reviveTick(this, dt); // 부활: 쓰러져 누웠다가 정한 때에 일어난다 (revive.js)
    if (this.state === 'stand') {
      this.balance = Math.min(100, this.balance + VITALS.balanceRegen * dt);
      const lostFooting = this.offBalanceTime > BALANCE.fallDelay;
      // 기울기는 일부러 숙인 만큼(배를 다쳐 웅크림·자세)을 빼고 잰다: 웅크린 채 일어서자마자 넘어졌다고 다시 쓰러지기를 되풀이하지 않게
      const fallTilt = tilt - THREE.MathUtils.radToDeg(this.hunch);
      if (fallTilt > BODY.fallTiltDeg || this.balance <= 0 || lostFooting) this.knockDown(fallTilt > BODY.fallTiltDeg + 15);
      else if (this.legsCannotSupport) this.knockDown(false); // 다리가 버티지 못해 주저앉는다 (용암에 탄 다리 하나도 — legsCannotSupport)
    } else if (this.state === 'down') {
      if (this.stateTime > this.downTime && this.consciousness > 0.3 && !this.missingLeg) this.setState('getup'); // 다리를 잃었으면 서지 않는다 (절단 설계 §3-6)
    } else if (this.state === 'getup') {
      if (this.stateTime > this.kneelTime) {
        // 무릎 꿇은 자세에서 일어서기. 다리가 못 버티면 무릎 꿇은 채로 남는다
        if (this.legsCannotSupport) this.setState('kneel');
        else if (this.stateTime > this.kneelTime + this.riseTime) {
          this.setState('stand');
          this.balance = 60;
          this.offBalanceTime = 0;
        }
      }
    }
  }

  /** 일어나는 중 무릎 꿇은 정도 (1 = 완전히 무릎 꿇음, 0 = 서 있음) */
  get kneelAmount() {
    if (this.state === 'kneel') return 1;
    if (this.state !== 'getup') return 0;
    if (this.stateTime < this.kneelTime) return 1;
    return THREE.MathUtils.clamp(1 - (this.stateTime - this.kneelTime) / this.riseTime, 0, 1);
  }

  /**
   * 뒷다리(무릎 꿇은 다리 B)의 무릎 꿇은 정도. BODY.getupLead(10/8, 확인표 194) 면 앞다리(딛은 다리 F)가 먼저 펴고, 뒷다리는 riseTime 의 getupLag 몫만큼 접힌 채
   * 기다렸다가 남은 시간에 편다 — 사람이 한쪽 무릎에서 일어설 때 앞발로 밀어 서고 뒷발은 뒤따라 딛는 차례. 0(오늘)이면 kneelAmount 와 같은 값(두 다리가 한 비율로 함께 펴짐).
   */
  get kneelAmountB() {
    if (!(BODY.getupLead > 0) || this.state !== 'getup' || this.stateTime < this.kneelTime) return this.kneelAmount;
    const lag = THREE.MathUtils.clamp(BODY.getupLag, 0, 0.95);
    const u = (this.stateTime - this.kneelTime) / this.riseTime;
    return THREE.MathUtils.clamp(1 - (u - lag) / (1 - lag), 0, 1);
  }

  setState(s) {
    if (s === 'dead' && !this.canDie) return; // 흙 몸(병마용): 머리가 떨어지기 전에는 죽은 상태로 가지 않는다 (사람은 늘 canDie)
    this.state = s;
    this.stateTime = 0;
  }

  /**
   * 넘어지기. heavy = 크게 맞거나 완전히 균형을 잃음 → 인형처럼 쓰러짐.
   * 아니면 무릎이 꺾여 주저앉았다가(무릎 꿇기) 다시 일어난다.
   */
  knockDown(heavy = true) {
    if (this.state === 'dead' || this.state === 'down') return;
    if (!heavy && (this.state === 'getup' || this.state === 'kneel')) return;
    this.balance = 0;
    if (heavy) {
      this.downTime = BODY.fallDuration * (1 + (1 - this.legHealth) + (1 - this.vigor));
      this.setState('down');
    } else {
      this.setState('getup'); // 무릎 꿇은 자세부터
    }
  }

  die(cause, noRevive = false) { // noRevive: 즉사 대신 힘으로 들어간 찍기(FINISH.mode 'power25')가 낸 치명상 — 찍기 즉사처럼 되살아나지 않는다
    if (this.state === 'dead') return;
    if (!this.canDie) return; // 흙 몸(병마용): 몸통 찌르기·내려찍기·기절로는 죽지 않는다 — 부활(tryRevive)보다 먼저 보므로 남은 부활 횟수도 쓰지 않는다 (샛별 901b1f39 순서)
    if (!noRevive && tryRevive(this, cause)) return; // 처음 죽음이면 투지로 다시 일어선다 (revive.js) — 참수된 몸은 tryRevive 가 거절하니 흙 몸의 '머리 잘림 = 끝'도 여기서 그대로
    this.causeOfDeath = cause;
    this.setState('dead');
  }

  /** 죽을 수 있나: 사람은 늘 true. 목 관절이 떨어져야만 죽는 몸(병마용)은 참수되어 목 관절이 없을 때만 (샛별 901b1f39 canDie 그대로) */
  get canDie() {
    return !this.physiology.deathRequiresHeadDetachment || (this.decapitated && !this.jointByName.head?.joint);
  }

  // ── 출혈·의식·통증 ──
  updateVitals(dt) {
    if (!this.physiology.bleeds) { // 피 없는 몸(병마용): 혈액 1 · 출혈 0 고정 (사람은 이 줄을 타지 않는다)
      this.blood = 1;
      this.bleed = 0;
      for (const w of this.wounds) w.bleed = 0;
    }
    if (this.bleed > 0) {
      this.blood = Math.max(0, this.blood - this.bleed * dt);
      // 피가 굳으며 출혈이 줄어든다 (큰 상처일수록 느리게)
      this.bleed = Math.max(0, this.bleed - this.bleed * VITALS.clotting * dt);
      for (const w of this.wounds) w.bleed *= 1 - VITALS.clotting * dt;
    }
    this.pain = Math.max(0, this.pain - dt * 0.6);
    if (this.state === 'dead') return;
    this.consciousness = Math.min(1, this.consciousness + dt * 0.03); // 정신이 천천히 돌아온다
    if (this.revival) return; // 부활하는 동안은 죽지 않는다 (die → tryRevive 가 곧장 돌려보내던 것을 매 스텝 부르지 않게)
    if (this.blood < VITALS.collapseBlood) this.die('출혈');
    else if (this.consciousness <= 0) this.die('기절');
  }

  /**
   * 상처 입기. combat.js가 칼이 닿은 순간을 분석해서 부른다.
   * @param {object} h { part, zone('head'|'neck'|'chest'|'pelvis'|'arm'|'leg'), type('cut'|'stab'|'blunt'),
   *                     severity(0~), energy(J), local(부위 기준 위치), helmet(bool), plate(bool: 남은 판금이 덮은 곳) }
   */
  applyWound(h) {
    if (this.state === 'dead' || this.revival) return; // 부활하는 동안엔 상처를 받지 않는다
    const sev = h.severity;
    const Z = h.zone;
    // 날이 살을 갈랐나. 보통은 찌르기·베기 = 문턱을 넘음 (못 넘으면 combat.js 가 멍으로 바꿔 보낸다). 내려찍기 즉사 찌르기(h.finish)만
    //  문턱을 못 넘어도 찌르기로 온다 — 그땐 판·옷·상처를 막힌 타격(멍)처럼 적는다 (판을 뚫었다·옷이 찢겼다·빈 상처로 적지 않는다)
    const bit = h.type !== 'blunt' && sev > 0;
    // 통증과 휘청임 (에너지가 클수록)
    this.pain = Math.min(2, this.pain + sev * 0.8 + h.energy / 150);
    let stagger = h.energy * VITALS.staggerPerJoule;
    const sway = this.swayScale; // 유파 버티기 (swayScale ②): 휘청임 게이지가 덜 깎인다 — 아래 머리 맞아 주저앉음(에너지 문턱)은 그대로. 칸 없는 유파는 1 이라 건너뜀
    if (sway !== 1) stagger *= sway;
    this.balance -= stagger;

    // 옷과 투구·판금도 상한다 (투구·판금이 막은 부위의 옷은 그대로)
    if (h.helmet) {
      const hs = this.helmetSpec || ARMOR.helmets.kettle;
      this.helmetIntegrity = Math.max(0, this.helmetIntegrity - armorWear(hs, h.energy, 'head'));
      if (this.helmetGroup) {
        this.shedHelmet(hs, h); // 파손: 문턱을 넘을 때마다 곁 조각(뿔·볏)이 떨어져 날아간다 (조각 투구만)
        setHelmetWear(this.helmetGroup, this.helmetIntegrity); // 찌그러짐·금 (조각 투구만, 케틀햇은 그대로)
      }
      if (this.helmetIntegrity <= 0 || (!bit && h.energy > hs.knockBlunt)) this.knockOffHelmet(h.dir, h.energy);
    } else if (h.plate && !bit) {
      this.wearPlate(h.part, h.energy, h.dir, Z); // 판이 막았다: 판만 닳고 밑의 옷은 그대로
    } else if (Z !== 'head' && Z !== 'neck') {
      if (h.plate) this.wearPlate(h.part, h.energy, h.dir, Z); // 판을 뚫고 들어왔다: 판도 닳고 옷도 찢어진다
      const c = this.cloth[h.part] ?? 1;
      const tear = !bit ? h.energy / 800 : 0.25 + sev * 0.5;
      this.cloth[h.part] = Math.max(0, c - tear);
    }

    // 사장님 결정 (9/30 "맞으면 즉사로"): 쓰러진 상대를 탭 마무리로 내리찍는 칼끝이 몸통(가슴·배·골반)이나 머리에
    //  찌르기로 닿았다 (combat.js analyze 의 finish) → 즉사. 옷·살 문턱은 따지지 않는다.
    //  판금·투구가 칼을 막았으면(문턱 아래) analyze 가 finish 를 끄고 멍으로 보낸다 (사장님 10/1 C: 판금 상대는 목을 겨누고, 결과는 물리가 정한다).
    //  찍기 즉사는 참수처럼 되살아나지 않는다 (디렉터 10/1): die → tryRevive 가 원인 '내려찍기'를 부활로 바꾸지 않는다 (revive.js)
    if (h.finish) this.die('내려찍기');

    if (!bit) {
      // 판금 위 둔타: h.plateBlunt(판을 통해 몸에 전해지는 비율, config.js ARMOR.plate.blunt, 확인표 줄 140)는 몸통·팔다리 둔타 효과표(줄 141, R3 — 아직 없음)에만
      //  곱하기로 되어 있다. 아픔·균형·판 닳음은 위에서 E 전체로 적었다. 머리·목은 판이 덮지 않는다 (투구는 helmetBlunt)
      if (Z === 'head' || Z === 'neck') {
        const k = h.helmet ? h.helmetBlunt : 1;
        this.consciousness -= h.energy * VITALS.concussionPerJoule * k;
        if (h.energy * k > 45) this.knockDown(h.energy * k > 90); // 머리를 세게 맞으면 주저앉거나 쓰러진다
        this.daze = Math.min(1, (this.daze || 0) + h.energy * k / 100); // 멍함
        // 흙 몸(병마용): 사람을 기절로 끝내는 같은 머리·목 둔타 문턱(의식 ≤ 0)에서 목이 부러져 머리가 떨어진다 (샛별 901b1f39 — 새 문턱 없음).
        //  머리·목을 실제로 맞았을 때만 — 엉뚱한 기절 요청(die('기절'))은 머리를 떼지 않는다
        if (this.physiology.deathRequiresHeadDetachment && this.consciousness <= 0) this.detachHeadFromWound(h);
      }
      return;
    }

    // 베기/찌르기 → 상처 + 출혈. 찌르기는 ×1.6 (가슴 찌르기 +0.25 는 이것과 겹쳐 지움 — 사장님 9/30 14:30, 128판 0회)
    const bleedPerSev = h.bleedPerSev;
    const bleed = this.physiology.bleeds ? sev * bleedPerSev * (h.type === 'stab' ? 1.6 : 1) : 0; // 피 없는 몸(병마용)은 상처만 남고 출혈 0
    this.bleed += bleed;
    this.wounds.push({ part: h.part, type: h.type, severity: sev, bleed, local: h.local.clone() });
    if (COMBAT.limbSever !== 'off') this.limbSeverCheck(h); // 팔·다리 절단 후보 (count: 세기만 / on: 관절 떼기)

    // 치명상
    if (Z === 'neck' && sev > 0.5) {
      // 참수 (COMBAT.decapitate): 칼이 목을 가르고 지나간 베기만. 튕긴 충돌·찌르기·둔기·총은 아니다
      //  흙 몸(병마용)은 사람에게 치명인 목 상처(베기·찌르기 모두)면 목이 부서져 머리가 떨어진다 (샛별 901b1f39 — 같은 문턱 0.5)
      const decap = this.physiology.deathRequiresHeadDetachment || (COMBAT.decapitate && h.type === 'cut' && h.pass && h.passing);
      if (decap) this.decapitate(sev, bleed);
      this.die('목', !!h.finishPower);
      if (decap) COMBAT_HOOKS.onDecapitate?.(this, this.bodies.head);
    } else if (Z === 'head' && ((h.type === 'cut' && sev > 0.8) || (h.type === 'stab' && sev > 0.5))) {
      if (this.physiology.deathRequiresHeadDetachment) this.detachHeadFromWound(h); // 흙 몸: 사람에게 치명인 머리 상처면 머리가 떨어지고 그래서 죽는다
      else this.die('머리', !!h.finishPower);
    }

    // 팔다리 기능
    const limb = { uarmS: 'armS', farmS: 'armS', uarmO: 'armO', farmO: 'armO', thighF: 'legF', shinF: 'legF', footF: 'legF', thighB: 'legB', shinB: 'legB', footB: 'legB' }[h.part];
    if (limb) {
      this.limbs[limb] = Math.max(0, this.limbs[limb] - sev * 0.7);
      if (limb === 'armS' && this.limbs.armS < VITALS.dropSwordArm) this.dropSword();
    }
    if (Z === 'head' && h.type === 'cut') this.consciousness -= sev * 0.5;
  }

  /**
   * 참수: 목 관절(가슴 → 머리)을 뗀다. 물리 스텝 밖(combat.afterStep → strike → applyWound)에서만 불린다.
   *  머리 몸·콜라이더·겉모습(얼굴·눈·머리카락·투구)은 그대로 — 머리는 칼·끌림이 준 속도 그대로 날아간다(더하는 힘 없음).
   *  몸통엔 목 단면 상처(stump, 가슴 기준 목 관절 자리): 목 상처와 같은 출혈. 되살아나지 않는다(revive.js tryRevive)
   */
  decapitate(sev, bleed) {
    const J = this.jointByName.head;
    if (!J?.joint || this.decapitated) return false; // 이미 뗐다 (흙 몸은 머리 상처가 여러 번 올 수 있다 — 사람 길은 처음 한 번뿐이라 그대로)
    const a = J.joint.anchor1(); // 가슴 몸 기준 목 관절 자리
    this.world.removeImpulseJoint(J.joint, true);
    this.joints.splice(this.joints.indexOf(J), 1); // 근육을 더는 걸지 않는다 (applyPose 의 J.head 목표 쓰기는 아무 데도 안 간다)
    J.joint = null;
    this.decapitated = true;
    if (!this.physiology.bleeds) bleed = 0; // 피 없는 몸: 목 단면도 출혈 0
    this.bleed += bleed;
    this.wounds.push({ part: 'chest', type: 'cut', severity: sev, bleed, local: new THREE.Vector3(a.x, a.y, a.z), stump: true });
    return true;
  }

  /**
   * 흙 몸(병마용 — 목 관절이 떨어져야만 죽는 몸)의 머리 떨어짐: 사람에게 치명인 머리 베기·찌르기, 기절 문턱을 넘은 머리·목 둔타가 목을 부순다 (샛별 901b1f39 그대로).
   *  새 힘·배율 없음 — 머리는 칼·끌림이 준 속도 그대로 날아간다. 목을 뗀 뒤에야 die 가 받아들여진다
   */
  detachHeadFromWound(h) {
    if (!this.decapitate(h.severity, 0)) return;
    this.die(h.zone === 'neck' ? '목' : '머리', !!h.finishPower);
    COMBAT_HOOKS.onDecapitate?.(this, this.bodies.head);
  }

  /**
   * 팔·다리 절단 후보 — 베인 부위(h.part)에서 가장 가까운 뗄 수 있는 관절과 그 거리(m). 조건은 설계 §2:
   *  통과 베기(cut·pass·passing·!stuck)만 보고, 문턱(심각도·반경)은 여기서 안 자른다 — count 모드는 전부 기록하고 on 모드가 문턱을 댄다.
   *  h.local 은 베인 부위 몸체 틀의 점(combat.analyze vicLocal). 'own' 관절의 anchor2()·'child' 관절의 anchor1() 이 같은 틀이다.
   */
  limbSeverTarget(h) {
    const cands = LIMB_SEVER_JOINTS[h.part];
    if (!cands || !h.local) return null;
    let best = null;
    for (const [name, side, kind] of cands) {
      const J = this.jointByName[name];
      if (!J?.joint) continue; // 이미 뗀 관절
      const a = side === 'own' ? J.joint.anchor2() : J.joint.anchor1();
      const dist = Math.hypot(h.local.x - a.x, h.local.y - a.y, h.local.z - a.z);
      if (!best || dist < best.dist) best = { joint: name, kind, dist };
    }
    return best;
  }

  limbSeverCheck(h) {
    if (h.type !== 'cut' || !h.pass || !h.passing || h.stuck) return;
    const t = this.limbSeverTarget(h);
    if (!t) return;
    if (COMBAT.limbSever === 'count') {
      if (LIMB_SEVER_COUNT.events.length >= 20000) LIMB_SEVER_COUNT.events.shift(); // 상한(브라우저 콘솔에서 count 모드를 켜 둬도 안 불어남)
      LIMB_SEVER_COUNT.events.push({ victim: this.name, part: h.part, joint: t.joint, kind: t.kind, dist: +t.dist.toFixed(4), severity: +h.severity.toFixed(3), energy: Math.round(h.energy), weapon: this.foe?.weaponSpecId ?? null, state: this.state });
    }
    if (COMBAT.limbSever === 'on' && h.severity >= COMBAT.limbSeverSeverity && t.dist <= COMBAT.limbSeverRadius) this.sever(t, h);
  }

  /** 관절 정의 다시 셈(생성자와 같은 변형 순서) — 수동 관절 재생성에 쓴다 */
  jointDefFor(childName) {
    const jdefs = jointDefs(this.side);
    if (BODY.weightMode === 'hybrid') hybridJointDefs(jdefs);
    if (BODY.legTorque === 'human') humanLegTorque(jdefs);
    if (BODY.humanLimits) humanJointDefs(jdefs, this.side);
    anatJointDefs(jdefs);
    return jdefs.find((jd) => jd.c === childName) || null;
  }

  /**
   * 모터 없는 수동 관절(같은 자리·같은 한계). 떨어진 부위 안쪽 관절(무릎 아래 발목, 어깨 아래 팔꿈치 …)에 쓴다.
   *  모터 축을 0·0 으로 두면 Rapier 0.19.3 에선 속도 잠금이라(10/7 A-021) 설정하지 않은 축으로 새로 만든다 — 그래야 잘린 다리가 막대처럼 굳지 않는다.
   */
  passiveJoint(childName) {
    const jd = this.jointDefFor(childName);
    if (!jd) return null;
    const RAPIER = this.R;
    const P = new THREE.Vector3(...jd.at);
    const rp = this.localRot[jd.p];
    const rc = this.localRot[jd.c];
    const a1 = P.clone().sub(this.localPos[jd.p]).applyQuaternion(rp.clone().invert());
    const a2 = P.clone().sub(this.localPos[jd.c]).applyQuaternion(rc.clone().invert());
    const data = jd.type === 'hinge' ? RAPIER.JointData.revolute(vecArg(a1), vecArg(a2), { x: 0, y: 0, z: 1 }) : RAPIER.JointData.spherical(vecArg(a1), vecArg(a2));
    const joint = this.world.createImpulseJoint(data, this.bodies[jd.p], this.bodies[jd.c], true);
    if (jd.manual) return joint;
    if (jd.type === 'hinge') joint.setLimits(jd.lim[0], jd.lim[1]);
    else ['x', 'y', 'z'].forEach((ax, i) => joint.rawSet.jointSetLimits(joint.handle, MOTOR_AXES[i], jd.lim[ax][0], jd.lim[ax][1]));
    return joint;
  }

  /**
   * 팔·다리 절단 (설계 docs/strike/limb_sever_design_2026-10-07.md §3). 물리 스텝 밖(combat.afterStep → strike → applyWound)에서만.
   *  관절을 떼고(힘·속도 더하지 않음), 떨어진 부위 안쪽 관절은 수동 관절로 다시 만들며, 몸값(totalMass)·gait 받침을 고치고,
   *  떨어진 부위는 잔해(상처를 내지도 받지도 않음, colliderInfo.detached). 칼 팔이면 칼은 잘린 아래팔과 함께 간다(쥠 관절 그대로, armed 만 false).
   *  다리를 잃으면 서지 않는다(한 다리 보행 없음) — 부활은 참수 아닌 한 허용(사장님 10/8 00:20), 누운 채 손목 제어는 오늘처럼 산다.
   */
  sever(t, h) {
    const J = this.jointByName[t.joint];
    if (!J?.joint) return false;
    const PARTS = { farmS: ['farmS'], farmO: ['farmO'], uarmS: ['uarmS', 'farmS'], uarmO: ['uarmO', 'farmO'], shinF: ['shinF', 'footF'], shinB: ['shinB', 'footB'], thighF: ['thighF', 'shinF', 'footF'], thighB: ['thighB', 'shinB', 'footB'] }[t.joint];
    const limb = { farmS: 'armS', uarmS: 'armS', farmO: 'armO', uarmO: 'armO', shinF: 'legF', thighF: 'legF', shinB: 'legB', thighB: 'legB' }[t.joint];
    const jd = this.jointDefFor(t.joint);
    const parentName = jd ? jd.p : null;
    const a1 = J.joint.anchor1(); // 몸 쪽 부위 틀의 단면 자리
    const a2 = J.joint.anchor2(); // 떨어진 부위 틀의 단면 자리 (겉모습 limb_fx)
    // 1. 관절 떼기 (속도·힘은 그대로)
    this.world.removeImpulseJoint(J.joint, true);
    J.joint = null;
    this.joints = this.joints.filter((j) => j !== J);
    this.detachedParts ||= new Set();
    this.severedLimbs ||= new Set();
    const fresh = PARTS.filter((p) => !this.detachedParts.has(p)); // 같은 팔다리를 두 번 자를 때(팔꿈치 뒤 어깨) 이미 떨어진 부위는 다시 빼지 않는다 (10/8 검토 3)
    for (const p of PARTS) this.detachedParts.add(p);
    this.severedLimbs.add(limb);
    if (t.joint === 'uarmS' && this.shoulderRopes) { // 칼 어깨 면 밧줄(shoulderOn)은 가슴↔위팔 관절이라 함께 뗀다 (10/8 검토 4)
      for (const j of this.shoulderRopes) this.world.removeImpulseJoint(j, true);
      this.shoulderRopes = null;
    }
    // 2. 떨어진 부위 안쪽 관절 → 모터 없는 수동 관절
    for (const p of PARTS.slice(1)) {
      const Ji = this.jointByName[p];
      if (!Ji?.joint) continue;
      this.world.removeImpulseJoint(Ji.joint, true);
      this.joints = this.joints.filter((j) => j !== Ji);
      Ji.joint = this.passiveJoint(p);
      Ji.passive = true;
    }
    // 3. 몸값·받침 (제어기가 보는 질량만; 몸체 질량·속도는 손대지 않는다)
    let lost = 0;
    for (const p of fresh) {
      const b = this.bodies[p];
      for (let i = 0; i < b.numColliders(); i++) {
        const col = b.collider(i);
        lost += col.mass();
        const info = this.colliderInfo.get(col.handle);
        if (info) info.detached = true;
      }
    }
    this.totalMass = Math.max(1, this.totalMass - lost);
    if (this.gait) this.gait.Mg = this.totalMass * 9.81;
    // 4. 기능
    this.limbs[limb] = 0;
    if (limb === 'armS') {
      this.armed = false; // 칼은 잘린 아래팔이 쥔 채 떨어진다 (gripJoint·gripCone 그대로). combat.pairOf 는 armed 아닌 칼의 접촉에 상처를 안 적는다
      this.aimOff = true;
      this.prevAim = null;
      for (const col of this.swordColliders) { const info = this.colliderInfo.get(col.handle); if (info) info.detached = true; }
    }
    if (limb === 'armO') this.gripping = false;
    if (limb === 'legF' || limb === 'legB') {
      this.missingLeg = true;
      if (this.gait?.active) this.gait.exit();
      this.knockDown(true);
      this.downTime = 1e9; // 서지 않는다 (updateState 의 getup 전이도 missingLeg 를 본다)
    }
    // 5. 상처·출혈: 떨어진 부위의 상처는 더는 몸의 피가 아니다; 단면 상처를 몸 쪽 부위에 (참수와 같은 꼴)
    for (const w of this.wounds) if (this.detachedParts.has(w.part) && !w.detached) { this.bleed = Math.max(0, this.bleed - w.bleed); w.bleed = 0; w.detached = true; }
    const bleed = this.physiology.bleeds ? h.severity * (h.bleedPerSev ?? 0.012) : 0; // 피 없는 몸(병마용): 단면 출혈 0 (샛별 901b1f39 limb_sever 와 같은 뜻)
    this.bleed += bleed;
    this.wounds.push({ part: parentName, type: 'cut', severity: h.severity, bleed, local: new THREE.Vector3(a1.x, a1.y, a1.z), stump: true, limb: t.kind });
    this.severed ||= [];
    this.severed.push({ joint: t.joint, kind: t.kind, parts: PARTS, limb, parent: parentName, severity: h.severity, energy: h.energy, dist: t.dist, parentLocal: { x: a1.x, y: a1.y, z: a1.z }, childLocal: { x: a2.x, y: a2.y, z: a2.z } });
    COMBAT_HOOKS.onSever?.(this, t.kind, PARTS.map((p) => this.bodies[p]), parentName);
    return true;
  }

  /**
   * 투구가 벗겨져 날아간다 (따로 굴러다니는 물체가 된다). 조각으로 나뉜 투구(마르그레테 뿔 투구, userData.pieces)는
   * ARMOR.on 이면 벗겨지는 대신 부서져 흩어진다(shatterHelmet). 어느 쪽이든 그 뒤로는 맨머리다
   */
  knockOffHelmet(dir, energy) {
    if (!this.hasHelmet || !this.helmetGroup) return;
    if (ARMOR.on && this.helmetGroup.userData.pieces) return this.shatterHelmet(dir, energy);
    this.hasHelmet = false;
    // 도는 힘은 방어구 전용 난수로 (Math.random 을 쓰면 시드 시뮬에서 벗겨진 뒤의 AI 난수 흐름이 바뀐다).
    //  ARMOR 를 끄면 예전처럼 Math.random — 방어구를 넣기 전 기준선과 바이트 단위로 같게
    const rnd = ARMOR.on ? () => this.armorRandom() : Math.random;
    const R = this.R;
    const head = this.groups.head;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    this.helmetGroup.getWorldPosition(wp);
    this.helmetGroup.getWorldQuaternion(wq);
    head.remove(this.helmetGroup);
    this.scene.add(this.helmetGroup);
    const rb = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(wp.x, wp.y, wp.z).setRotation(vecQ(wq)).setAngularDamping(0.5),
    );
    this.world.createCollider(
      R.ColliderDesc.cylinder(0.04, 0.2).setMass(1.3).setFriction(0.7).setRestitution(0.3).setCollisionGroups((32 << 16) | 1),
      rb,
    );
    const k = Math.min(1, energy / 250);
    rb.applyImpulse({ x: dir.x * 3 * k, y: 1.5 + 1.5 * k, z: dir.z * 3 * k }, true);
    rb.applyTorqueImpulse({ x: (rnd() - 0.5) * 0.3, y: (rnd() - 0.5) * 0.3, z: (rnd() - 0.5) * 0.3 }, true);
    this.meshes.push({ rb, group: this.helmetGroup, kind: 'loose' });
  }

  /**
   * 이 부위의 이 점(부위 몸 좌표)이 남아 있는 판금 밑인가. 가슴판·배 판띠(몸통을 감싼다)는 부위 전체,
   * 견갑·손목 보호대·정강이받이·골반 아래 자락은 아직 붙어 있는 판이 덮은 곳(± ARMOR.plate.coverMargin)만.
   * ARMOR 를 끄면 plate 가 비어 있어 늘 아니다
   */
  platedAt(part, local) {
    if (!((this.plate[part] ?? 0) > 0)) return false;
    const B = this.plateBoxes[part];
    if (!B.partial) return true;
    for (const b of B.list) if (b.box.distanceToPoint(local) <= ARMOR.plate.coverMargin) return true;
    return false;
  }

  /** 몸통·다리 판금이 하나라도 남아 있나 (걷는 최고 속도 × ARMOR.moveMul). 팔 판만 남거나 다 부서지면 아니다. ARMOR 끔이면 늘 아니다 */
  wearsPlate() {
    for (const k of this.plateGait) if ((this.plate[k] ?? 0) > 0) return true;
    return false;
  }

  /** 몸통(가슴·배·골반) 판이 하나라도 남아 있나 — 쓰러진 뒤 찍기의 겨눔 점을 몸통 가운데 대신 목으로 옮기는 조건 (finish.js, 사장님 10/1 C). ARMOR 끔이면 늘 아니다 */
  torsoPlated() {
    return (this.plate.chest ?? 0) > 0 || (this.plate.abdomen ?? 0) > 0 || (this.plate.pelvis ?? 0) > 0;
  }

  /** 맞은 점(부위 몸 좌표)에서 가장 가까운 판금 메쉬 (흔적을 붙일 곳) */
  plateMeshNear(part, local) {
    let best = null;
    let bd = Infinity;
    for (const b of this.plateBoxes[part]?.list ?? []) {
      const d = b.box.distanceToPoint(local);
      if (d < bd) (bd = d), (best = b.mesh);
    }
    return best;
  }

  /** 방어구 연출 전용 난수 (파이터별 LCG, 결정적, Math.random 과 무관) */
  armorRandom() {
    this._armorSeed = (Math.imul(this._armorSeed, 1664525) + 1013904223) >>> 0;
    return this._armorSeed / 4294967296;
  }

  /**
   * 조각 투구의 파손: 내구도가 ARMOR.helmets[종류].shed 의 문턱 아래로 내려갈 때마다 그 단계의 조각이 떨어져 흩어진다
   * ('horn' = 맞은 쪽 뿔, 이미 없으면 남은 뿔). 떨어진 조각은 userData.pieces 에서 빼서 setHelmetWear 가 더는 건드리지 않게 한다
   * (그 함수는 없는 조각을 건너뛴다). 막는 정도는 내구도대로라 그대로다 — 사발은 완전 파손 때까지 남는다
   */
  shedHelmet(hs, h) {
    const P = ARMOR.on && this.hasHelmet ? this.helmetGroup.userData.pieces : null;
    const stages = hs.shed;
    if (!P || !stages) return;
    while (this._helmStage < stages.length && this.helmetIntegrity < stages[this._helmStage][0]) {
      let n = 0;
      for (const name of stages[this._helmStage++][1]) {
        const key = name === 'horn' ? nearHorn(P, h.local) : name;
        if (!key || !P[key]) continue;
        this.flingDebris(P[key], h.dir, h.energy);
        delete P[key];
        n++;
      }
      if (n) this.armorShed++;
    }
  }

  /** 조각 투구가 완전히 부서진다: 남은 조각(처음엔 7개: 사발·목가리개·첨탑·볏·뿔 둘·깃털 술)이 머리에서 떨어져 흩어졌다가 작아지며 사라진다 */
  shatterHelmet(dir, energy) {
    this.hasHelmet = false;
    this.armorBroke = true;
    const helm = this.helmetGroup;
    const P = helm.userData.pieces;
    for (const name in P) this.flingDebris(P[name], dir, energy);
    helm.removeFromParent(); // 빈 그룹. 붉은 옆머리·땋은 머리는 그룹 밖이라 머리에 남는다
  }

  /**
   * 판금이 맞아 닳는다 (armorWear: 에너지 ÷ wear + 제대로 맞은 한 번마다 perHit). 겉모습 함수 setPlateWear 가 있으면 닳은 정도를 넘긴다.
   * 파손(내구도 < ARMOR.plate.shedBelow): 본판(가장 큰 판)만 남고 곁 판(금띠·이음매 판·자락 끝단)이 떨어져 날아간다.
   * 완전 파손(0): 남은 판금 메쉬들이 떨어져 흩어졌다가 사라진다 — 그 뒤로 그 부위는 누비옷 판정이다.
   * 떨어진 메쉬는 userData.armor 와 plateBoxes 에서 빼서, 덮은 곳 판정·흔적·setPlateWear 가 붙어 있는 판만 보게 한다
   */
  wearPlate(part, energy, dir, zone = 'chest') {
    if (!((this.plate[part] ?? 0) > 0)) return; // 판이 없거나(ARMOR 끔) 이미 부서졌다
    const g = this.plateGroups[part];
    const B = this.plateBoxes[part];
    const left = Math.max(0, this.plate[part] - armorWear(ARMOR.plate, energy, zone));
    this.plate[part] = left;
    if (left > 0 && !B.shed && left < ARMOR.plate.shedBelow && B.list.length > 1) {
      // 파손: 본판(가장 큰 판)보다 한참 작은 곁 판(ARMOR.plate.trim 배 아래 — 금띠·이음매 판·자락 끝단)만 떨어져 나간다.
      //  하인리히 v2 견갑처럼 본판에 버금가는 판은 완전 파손 때까지 남는다
      B.shed = true;
      let main = B.list[0];
      for (const b of B.list) if (boxVolume(b.box) > boxVolume(main.box)) main = b;
      const vMain = boxVolume(main.box);
      const trim = B.list.filter((b) => b !== main && boxVolume(b.box) < ARMOR.plate.trim * vMain);
      for (const b of trim) this.dropPlateMesh(g, B, b.mesh, dir, energy);
      if (trim.length) {
        B.list = B.list.filter((b) => !trim.includes(b));
        this.armorShed++;
      }
    }
    setPlateWear(g, left);
    if (left > 0) return;
    this.platesBroken++;
    this.armorBroke = true;
    for (const b of B.list) this.dropPlateMesh(g, B, b.mesh, dir, energy);
    B.list = [];
  }

  /**
   * 판금 메쉬 하나를 부위에서 떼어 던진다 (userData.armor 에서도 뺀다). 금(outfits.js plateCrack, 첫 판의 앞면에 붙여 숨겨 둔 선)이
   * 붙은 판이면 금도 그 판에 붙여 같이 날아가게 한다 — 금만 몸에 남거나 따로 날지 않게
   */
  dropPlateMesh(g, B, mesh, dir, energy) {
    const A = g.userData.armor;
    const i = A.indexOf(mesh);
    if (i >= 0) A.splice(i, 1);
    if (mesh === B.host && g.userData.armorCracks?.length) {
      for (const c of g.userData.armorCracks) {
        mesh.attach(c);
        const k = A.indexOf(c);
        if (k >= 0) A.splice(k, 1);
      }
      g.userData.armorCracks = [];
    }
    this.flingDebris(mesh, dir, energy);
  }

  /**
   * 부서진 조각 하나를 장면으로 떼어 내 던진다 (월드 자세는 그대로). 물리 몸체 없이 겉모습만 날아가고
   * (debris.js scatterDebris — 칼 조각과 같은 모듈이 움직이고 치운다), ARMOR.debrisLife 초 안에 작아지며 사라진다.
   * 방향·도는 빠르기·수명은 방어구 전용 난수 — 조각을 띄우지 않는 헤드리스 시뮬에서도 똑같이 굴려서
   * 뒤따르는 방어구 난수(벗겨진 케틀햇이 도는 힘)가 브라우저와 같다
   */
  flingDebris(obj, dir, energy) {
    const r = () => this.armorRandom();
    const k = Math.min(1, energy / 250);
    const dx = dir?.x ?? 0;
    const dz = dir?.z ?? 0;
    const v = new THREE.Vector3(dx * (0.8 + 2.2 * k) + (r() - 0.5) * 1.6, 1.0 + 1.6 * r(), dz * (0.8 + 2.2 * k) + (r() - 0.5) * 1.6);
    const w = new THREE.Vector3((r() - 0.5) * 14, (r() - 0.5) * 14, (r() - 0.5) * 14);
    const [a, b] = ARMOR.debrisLife;
    scatterDebris(this.scene, obj, { vel: v, spin: w, life: a + (b - a) * r() });
  }

  /** 판이 바뀔 때(main.js newRound·배경 바꿈): 벗겨진 케틀햇(장면에 따로 있다)을 치운다. 흩어지던 조각은 debris.js clearDebris 가 치운다 */
  clearLoose() {
    // 모양 데이터만 푼다 (main.js newRound 가 캐릭터 그룹을 치우는 법과 같게)
    for (const m of this.meshes) if (m.kind === 'loose' && m.group.parent) {
      m.group.removeFromParent();
      m.group.traverse((o) => o.geometry?.dispose());
    }
  }

  /** 칼날에 피가 묻는다 */
  bloodyBlade(amount) {
    if (!this.bladeMesh) return;
    this.bladeBlood = Math.min(0.65, (this.bladeBlood || 0) + amount);
    this.bladeMesh.material.color.copy(this.bladeBaseColor).lerp(_bloodColor, this.bladeBlood);
  }

  dropSword() {
    if (!this.armed) return;
    this.armed = false;
    this.world.removeImpulseJoint(this.gripJoint, true);
    if (this.gripCone) for (const j of this.gripCone) this.world.removeImpulseJoint(j, true);
    this.gripCone = null;
  }

  /**
   * 손목 원뿔 (BODY.humanLimits, 설계 P1 = ② 의 전제). 엔진 공 관절 축 한도는 기준(0)이 '칼이 아래팔에 수직'이라 원뿔을 못 그린다
   *  → 밧줄(rope, 두 점 사이 최대 거리)로 각을 정확히 막는다 (위 머리말: W 에서 u 로 L 인 점 ↔ n 으로 K 인 점, 거리 ≤ √(L²+K²−2LK·cosα) ⟺ 각 ≤ α):
   *   (1) 아래팔-칼 각 ≤ HUMAN.gripFlex: 아래팔 축 W + K·x(아래팔) ↔ 칼 축 W + L·y(칼)
   *   (2) 아래팔 돌림 ≤ HUMAN.forearmRoll: 경첩 축 W + K·z(아래팔) ↔ 칼 면 W + L·z(칼). 쥔 자세에서 칼 면 = 팔꿈치 경첩 축이라
   *       곧은 칼의 굴림 = 엎침·뒤침. 옆으로 꺾은 손목(요골·척골 치우침)도 같은 몫을 쓴다
   *  손목 W = 아래팔 몸체 (0.13, 0, 0) (손목 관절 자리 재사용, 기하. 막는 각은 L·K 와 무관). 칼을 놓치면 풀고(dropSword) 다시 쥐면 건다(revive.js)
   */
  gripConeOn() {
    if (this.gripCone) return;
    const R = this.R;
    const L = ROPE_L;
    const K = ROPE_K;
    const len = (deg) => Math.sqrt(L * L + K * K - 2 * L * K * Math.cos(deg * HD));
    const rope = (deg, a1, a2) => this.world.createImpulseJoint(R.JointData.rope(len(deg), a1, a2), this.bodies.farmS, this.sword, true);
    // 손목 W = 아래팔 몸체 (0.13, 0, 0) = 칼 몸체 원점 (위 gripJoint)
    this.gripCone = [rope(HUMAN.gripFlex, { x: 0.13 + K, y: 0, z: 0 }, { x: 0, y: L, z: 0 }), rope(HUMAN.forearmRoll, { x: 0.13, y: 0, z: K }, { x: 0, y: 0, z: L })];
    // 관절 가동 범위 교정 ⓐ (JOINTS hard): 손목 굽힘·폄 ±wristFE — 칼날 축이 아래팔 경첩 축 ±z 와 이루는 각 ≤ 90 + wristFE (밧줄 둘, 같은 기하)
    if (jm().hard) for (const sz of [1, -1]) this.gripCone.push(rope(90 + JOINTS.wristFE, { x: 0.13, y: 0, z: sz * K }, { x: 0, y: L, z: 0 }));
  }

  /**
   * 칼 어깨 들림 면 −45°~130° (수평 벌림 45 · 수평 모음 130, HUMAN.shoulderPlane): 면 = atan2(앞, 바깥) 인 위팔 방향 u 가 두 반공간
   *  (면 40° 쪽 수평 n1 과 u 의 각 ≤ 90° → 면 −50~130, 면 45° 쪽 n2 → 면 −45~135) 의 교집합 = 쐐기 −45~130 에 있게 한다. 위팔 끝 쪽 점(어깨에서 L)
   *  ↔ 가슴에 붙은 먼 점(어깨에서 n 쪽 K) 밧줄 둘. 쐐기는 곧게 위·아래(들림 0·180)를 품으므로 들림 0~180 은 따로 막지 않는다.
   *  근사: 봉투의 폄 60°(늘어뜨린 팔을 뒤로)는 이 쐐기가 대신 막는다(팔을 −45° 면 뒤로 늘어뜨릴 수 없음) — 확인표 줄에 적음
   *  찍기(탭 마무리)도 이 밧줄을 풀지 않는다 (10/1 디렉터 워크플로, decisions.md 10/1 23:20): 옛 겨눔 손 자리(finish.js FINISH.hands 옆 0)가 수평 모음
   *  130° 끝에 걸려 찍기 즉사가 줄었던(맨몸 158→151 · 판금 98→65) 것은 손 자리를 한도 안으로 옮겨(확인표 121 줄, 157·104) 되살렸다. 탭 동안만
   *  이 밧줄·손목 원뿔의 닻을 관절 자리로 옮겨 느슨하게 하는 예외 안(후보 A, 가지 feat-finish-limits-A eb3e3cc, 156·97)은 채택하지 않았다
   */
  shoulderOn() {
    const R = this.R;
    const s = this.side;
    const L = ROPE_L;
    const K = ROPE_K;
    const [p0, p1] = HUMAN.shoulderPlane;
    const S = { x: ARM.shoulder[0], y: ARM.shoulder[1], z: ARM.shoulder[2] * s }; // 어깨 (가슴 몸체 기준, config ARM)
    const rope = (c) => {
      const n = { x: Math.sin(c * HD), z: s * Math.cos(c * HD) }; // 면 c 쪽 수평 방향 (가슴 틀: 앞 x, 바깥 = s·z)
      const j = this.world.createImpulseJoint(R.JointData.rope(Math.sqrt(L * L + K * K), { x: S.x + K * n.x, y: S.y, z: S.z + K * n.z }, { x: -0.15 + L, y: 0, z: 0 }), this.bodies.chest, this.bodies.uarmS, true);
      // 밧줄도 가슴 ↔ 위팔 사이 관절이다. 엔진은 두 몸체 사이 관절 중 하나라도 닿음이 켜져 있으면 그 쌍의 닿음을 되살린다 → 공 관절에서 끈 닿음
      //  (생성자 '원래 겹쳐 있어 닿음을 끈다')이 밧줄로 돌아와, 팔을 몸 앞으로 모으면 면 약 80° 에서 위팔 윗머리가 가슴 상자에 걸렸다
      //  (10/1 fix2 탐침: 한도 켬 쉼·왼쪽 누름 모든 스텝에서 −12~−20 mm 파고듦). 공 관절과 같이 끈다
      j.setContactsEnabled(false);
      return j;
    };
    // 위팔 몸체: 뼈가 x 를 따라 누움, 어깨 = (−0.15, 0, 0) (partDefs uarmS 자리 0.15). 반공간 가운데 면 = 끝 − 90 / 시작 + 90
    this.shoulderRopes = [rope(p1 - 90), rope(p0 + 90)];
  }

  /**
   * 칼이 세게 막히거나 딱딱한 곳을 쳤다 (combat.js가 충격량 J(N·s)로 부른다).
   * 충격 자체는 물리 엔진이 칼 → 손목 → 팔 → 가슴으로 전한다. 여기선 "방금 크게 부딪혔다"는 신호만 남긴다
   * (uprightRelax가 쓰고, 연출·AI도 읽을 수 있다).
   */
  takeJolt(J) {
    this.jolt = Math.max(this.jolt, Math.min(1, J / RECOIL.joltImpulse));
  }

  /**
   * 무기가 세게 부딪힐 때마다(J, N·s) 부러질지 굴린다. 확률은 weapons.js breakChance(J): 등급 내구가 낮고 무게가 실린
   * 충돌일수록 높다. 강철 레전드·고무·플라스마는 확률 0이라 아무 일도 없다 (weapons.js 파손 규칙 참고).
   *  칼끼리 부딪힌 경우 combat.js 가 상대 싸움꾼(by)을 넘긴다 — 투구·뼈에 되튄 충격은 by 없음.
   */
  absorbWeaponImpact(J, by = null) {
    if (!this.armed || this.weaponBroken || !this.weapon.fragile) return;
    // by: 칼끼리 부딪힌 상대. 그 칼이 무기를 잘 부수는 칼이면(spec.breakMult, 청강검 '창천') 부러질 확률을 그만큼 곱한다
    const mult = by?.armed && !by.weaponBroken ? (by.weapon?.breakMult ?? 1) : 1;
    const p = Math.min(1, this.weapon.breakChance(J) * mult);
    if (p <= 0) return;
    // 파이터별 LCG (결정적, Math.random 과 무관)
    this._breakSeed = (Math.imul(this._breakSeed, 1664525) + 1013904223) >>> 0;
    if (this._breakSeed / 4294967296 < p) this.breakWeapon();
  }

  /**
   * 무기가 부러진다: 칼날 끝쪽(spec.breakAt, 기본 절반 너머)이 떨어져 나가고 남은 토막은 뭉툭한 몽둥이가 된다
   *  (combat.js analyze()가 isBlade를 꺼서 처리. BREAK.stubEdge 를 켜면 토막 날로 효율을 깎아 벤다).
   *  물리: 칼날 콜라이더를 그 자리에서 줄인다(핸들이 그대로라 combat.js 의 접촉 기록이 끊기지 않는다) → 질량·관성·칼 길이가 함께 준다.
   *  겉모습: 절단선 위 메쉬는 조각이 되어 날아가 사라지고(debris.js), 남는 끝엔 톱니 모양 부러진 면을 얹는다.
   */
  breakWeapon() {
    if (this.weaponBroken) return; // 한 번만 부러진다
    this.weaponBroken = true;
    const cfg = this.weaponCfg;
    let cutY;
    if (this.weapon.breakY != null) {
      // 절대 높이에서 부러지는 무기 (모르겐슈테른 breakY 0.40, 확인표 줄 139): 나무 자루가 보강띠 밑에서 끊기고, 절단선 위에 통째로 있는
      //  쇠 공 머리는 trimSword 의 '통째로 떨어지는 부품' 가지로 콜라이더가 꺼진다 → 겉모습도 머리가 조각으로 날아간다(breakWeaponLook).
      //  남는 자루 토막이 둔기: 칼끝 계산·마무리 간격이 토막 길이를 읽게 hilt/blade 길이를 토막 끝에 맞춘다 (끝 2 cm 를 'blade' 구간으로)
      cutY = this.weapon.breakY;
      this.trimSword(cutY);
      cfg.hiltLength = cutY - 0.02;
      cfg.bladeLength = 0.02;
    } else {
      const at = THREE.MathUtils.clamp(this.weapon.breakAt ?? BREAK.at, 0.05, 0.95);
      cutY = cfg.hiltLength + at * cfg.bladeLength;
      this.trimSword(cutY);
      cfg.bladeLength *= at; // 칼끝 계산(bladePoint)·판정(combat.js t)·마무리 간격(finish.js)이 새 길이를 쓴다
    }
    if (BREAK.stubEdge) {
      cfg.mCut *= BREAK.stubCut;
      cfg.mThrust *= BREAK.stubThrust;
    }
    // 칼끝 자리가 한순간에 옮겨졌다: 칼끝 속도 추정이 튀지 않게 이전 값을 버린다
    this.tipPrev = null;
    this.hitPointPrev = null;
    this.shatterLook(cutY);
  }

  /** (파손) 떨어져 나간 부품의 콜라이더를 세계에서 떼어 낸다. Rapier 0.19.3 의 setEnabled(false) 는 충돌을 끄지 못한다
   *  (10/7 격리 시험: 비활성 뒤에도 13 스텝째 접촉 그대로, 게임에서는 떨어진 철구 머리가 30 초에 2,802 번 닿음) → 충돌 그룹 0 으로
   *  어떤 것과도 짝이 안 되게 하고, 부활의 유령 복원(revive.js ghost)이 되살리지 않도록 비활성 표시도 남긴다 */
  detachCollider(col) {
    col.setCollisionGroups(0);
    col.setEnabled(false);
  }

  /** (파손) 칼 몸체에서 칼 축 높이 cutY(손 기준, m) 너머의 콜라이더를 잘라 내고 질량·관성 값을 다시 잰다 */
  trimSword(cutY) {
    const parts = this.weapon.buildParts({}); // 질량 자료만 쓴다 (색은 안 쓴다) — 생성자와 같은 순서라 swordColliders 와 짝이 맞다
    parts.forEach(([shape, y, [pm, pc, pIe, pIt]], i) => {
      const col = this.swordColliders[i];
      if (!col) return;
      if (shape[0] !== 'box') {
        // 공 부품: 절단선 위에 통째로 있으면 떨어져 나간다 (모르겐슈테른 쇠 공 머리, spec.breakY). 폼멜·컵 힐트는 늘 절단선 아래라 예전처럼 그대로
        if (shape[0] === 'ball' && y - shape[1] >= cutY - 0.005) this.detachCollider(col);
        return;
      }
      const [, hx, hy, hz] = shape;
      const lo = y - hy;
      if (y + hy <= cutY) return; // 절단선 아래 부품 (자루·코등이·폼멜)
      if (lo >= cutY - 0.005) {
        this.detachCollider(col); // 통째로 떨어져 나간 부품 (칼에는 없다 — 모르겐슈테른은 머리가 공 부품이라 위 가지)
        return;
      }
      const f = (cutY - lo) / (2 * hy); // 남는 비율 (길이)
      const k = linearDensityK(pc / (2 * hy) + 0.5);
      const whole = barMoments(1, k);
      const kept = barMoments(f, k);
      const L = 2 * hy;
      const m2 = pm * (kept.m / whole.m);
      // 휘두르는 축 관성: 무기 제원(pIe)과 이 밀도 모델의 비를 그대로 옮긴다 (단면 두께 몫 등이 함께 따라온다)
      const Ie2 = (pIe / (pm * L * L * whole.var)) * m2 * L * L * kept.var;
      const hy2 = (f * L) / 2;
      col.setHalfExtents({ x: hx, y: hy2, z: hz });
      col.setTranslationWrtParent({ x: 0, y: lo + hy2, z: 0 });
      col.setMassProperties(m2, { x: 0, y: kept.com * L - hy2, z: 0 }, { x: Ie2, y: pIt * (kept.m / whole.m), z: Ie2 }, { x: 0, y: 0, z: 0, w: 1 });
    });
    const sword = this.sword;
    sword.recomputeMassPropertiesFromColliders();
    // 생성자와 같은 방식으로 타격·손목 계산용 값을 다시 잰다
    const oldIt = this.swordProps.I.y;
    const pI = sword.principalInertia();
    const pF = sword.principalInertiaLocalFrame();
    const lc = sword.localCom();
    this.swordMass = sword.mass();
    this.swordProps = { m: sword.mass(), I: { x: pI.x, y: pI.y, z: pI.z }, frame: new THREE.Quaternion(pF.x, pF.y, pF.z, pF.w) };
    this.swordIhand = Math.max(pI.x, pI.z) + sword.mass() * lc.y * lc.y;
    this.swordCom = lc.y;
    // 날 세우기 힘은 칼날 축 관성에 비례해 맞춘다 (생성자 twistScale 주석) — 가벼워진 만큼 줄여야 축이 팽이처럼 돌지 않는다
    if (oldIt > 0) this.twistScale *= pI.y / oldIt;
  }

  /** (파손) 칼 겉모습을 절단선에서 끊고, 떨어진 조각을 날려 보낸다 (보여 주기만 — 전역 난수를 건드리지 않는다) */
  shatterLook(cutY) {
    const group = this.swordGroup;
    const sword = this.sword;
    // 그룹 자세는 지난 화면 갱신 값일 수 있어 몸체 자세로 맞춘 뒤 자른다
    const p = sword.translation();
    group.position.set(p.x, p.y, p.z);
    rot(sword, group.quaternion);
    const out = isolatedVisual(() => breakWeaponLook(group, cutY, { material: this.weapon.material }), 0);
    if (!out.fragment) return;
    if (!debrisEnabled()) {
      out.fragment.traverse((o) => o.geometry?.dispose());
      return;
    }
    const v = sword.linvel();
    const w = sword.angvel();
    isolatedVisual(
      () =>
        spawnDebris(this.scene, out.fragment, {
          pos: group.position.clone(),
          quat: group.quaternion.clone(),
          vel: new THREE.Vector3(v.x, v.y, v.z),
          angvel: new THREE.Vector3(w.x, w.y, w.z),
          owner: group,
        }),
      0,
    );
  }

  /**
   * (실험, RECOIL.anchorRelax) 기준 막대(똑바로 서기 보조)가 몸을 붙잡는 힘의 비율. 모터 축 3 = 옆으로 기울기,
   * 4 = 앞뒤로 숙이기, 5 = 몸통 비틀기. 칼을 휘두르거나 부딪히는 동안 숙이기·비틀기를 덜 붙잡아서
   * 휘두르는 반작용과 충격이 골반·몸통으로 전해진다 (다리가 받아낸다).
   */
  uprightRelax(ax) {
    if (!RECOIL.anchorRelax || ax === MOTOR_AXES[0] || this.state !== 'stand') return 1;
    let swing = 0;
    if (this.armed) {
      const w = this.sword.angvel();
      const b = _ur.set(0, 1, 0).applyQuaternion(rot(this.sword, _urq));
      const wd = w.x * b.x + w.y * b.y + w.z * b.z; // 칼날 축으로 도는 몫(비틀기)은 뺀다
      swing = Math.sqrt(Math.max(0, w.x * w.x + w.y * w.y + w.z * w.z - wd * wd));
    }
    const effort = Math.max(THREE.MathUtils.smoothstep(swing, 4, 10), this.jolt);
    const min = ax === MOTOR_AXES[2] ? RECOIL.anchorYaw : RECOIL.anchorPitch;
    return 1 - (1 - min) * effort;
  }

  /** 몸통이 "의도한 자세"(가속할 때 숙인 것 포함)에서 벗어난 각도 */
  tiltDeg() {
    rot(this.bodies.chest, _q1);
    // Gait.update 가 driveBalance 의 앞 방향 축(_v1)을 든 채로 이 함수를 부른다 — 같은 임시 벡터를 쓰면 앞 축이 덮여 걸음 균형이 틀어진다
    //  (샛별 팀 A-001 7da5f3f 발견, 사장님 10/2 01:10 "복사해와"; 회귀 검사 tools/sim/balance_axes.test.mjs)
    const up = _tiltUp.set(0, 1, 0).applyQuaternion(_q1);
    const ref = this.anchorUp || UP;
    return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.dot(ref), -1, 1)));
  }

  /** 이 자리의 땅 높이 (지형 무대만 — 평지 무대는 늘 0. 걸음·효과·소리가 같이 쓴다) */
  groundHeightAt(x, z) {
    return this.terrain ? this.terrain.heightAt(x, z) : 0;
  }

  /** 수평 속도 v 로 이 자리를 지날 때 땅 높이가 바뀌는 빠르기(m/s) — 비탈을 따라 오르내리는 몫. 평지 무대는 0 */
  groundVelocityAt(x, z, v) {
    if (!this.terrain) return 0;
    const n = this.terrain.normalAt(x, z);
    return -(n.x * v.x + n.z * v.z) / n.y;
  }

  // 골반을 떠받치고, 몸을 세우고, 걷게 한다.
  driveBalance(dt) {
    const pelvis = this.bodies.pelvis;
    const M = this.totalMass;
    const g = 9.81;
    const mus = this.muscle;
    const p = pelvis.translation();
    const v = pelvis.linvel();
    const fwd = this.forward(_v1);
    const rgt = this.right(_v2);
    // 내가 가려는 속도 (입력 + 균형 잡으려는 발걸음)
    // 다리가 체중을 싣는 걸음: 서 있는 동안만 (쓰러짐·일어남·무릎 꿇기는 예전 방식)
    const G = this.gait;
    const hybrid = !!G && this.state === 'stand';
    const speed = (hybrid ? GAIT.moveSpeed : BODY.moveSpeed) * (0.45 + 0.55 * this.legHealth) * (this.weapon.moveMul ?? 1) * (this.wearsPlate() ? ARMOR.moveMul : 1); // moveMul: 권총은 발이 빠르다 (weapons.js), 판금은 느리다 (config.js ARMOR)
    const st = this.stumble;
    let mvIn = this.feetHeld ? HELD_MOVE : this.move; // 시작 정지: 조종 입력(플레이어·AI·기술 내딛기)만 0, 균형 잡는 걸음(stumble)은 그대로
    // 독일 간격 잡기의 잡기 (10/15 — GAIT.deHold, gait.js holdTick · docs/strike/german_hold_2026-10-15.md): 플레이어(AI 가 몰지 않는 몸)만 — 조종 입력을 읽기 전에 걸고·풀고·시간을 센다.
    //  잡는 동안 조종 입력의 앞(상대 쪽 — 몸은 늘 상대를 본다) 몫만 0 — 옆·뒤 몫·균형 걸음(stumble)·기술 걸음(gait req)은 그대로, 몸이 가진 빠르기는 물리대로(아래 가속 한도).
    //  끄면(0)·AI 는 부르지도 읽지도 않는다(바이트 같음)
    if (hybrid && GAIT.deHold && !this.aiControlled && G.active) G.holdTick(dt);
    if (hybrid && G.hold && mvIn.y > 0) {
      HOLD_MOVE.x = mvIn.x;
      mvIn = HOLD_MOVE;
    }
    // 진흙(잠든 습지 웅덩이)은 조종 입력만 줄인다 — 균형 잡는 걸음(stumble)·중력·공격은 그대로. 다른 무대는 정확히 1 (샛별 저장소 325a5c38 의 한 줄을 옮김)
    const terrainScale = fighterWetlandMoveScale(this, p.x, p.z);
    this.surfaceSpeedScale = terrainScale;
    const mv = this.state === 'stand' ? { x: mvIn.x * terrainScale * this.stamina.speed * (1 - st.length()) + st.x, y: mvIn.y * terrainScale * this.stamina.speed * (1 - st.length()) + st.y } : { x: 0, y: 0 };
    if (this.state === 'stand' && this.daze > 0.2) {
      // 멍하면 발이 제멋대로 움찔거린다
      mv.x += Math.sin(this.stateTime * 3.1) * this.daze * 0.5;
      mv.y += Math.sin(this.stateTime * 2.3 + 1) * this.daze * 0.4;
    }
    const along = mv.y * speed * (mv.y < 0 ? (hybrid ? GAIT.backFactor : 0.75) : 1);
    const side = mv.x * speed * (hybrid ? GAIT.sideFactor : 0.8);
    const want = _v4.set(fwd.x * along + rgt.x * side, 0, fwd.z * along + rgt.z * side);
    this.updateFooting(dt, fwd, rgt, want);
    if (hybrid) G.update(dt, want, fwd, rgt);
    else if (G?.active) G.exit();
    // 두 발이 체중을 얼마나 받는지 (땅에 닿고 몸 아래에 있을수록 1).
    // 걷는 중엔 들어 올리는 발(스윙)에는 체중을 싣지 않는다 → 발을 뗄 수 있다
    const stanceOf = (thigh) => {
      if (hybrid) return G.legs[thigh === 'thighF' ? 'F' : 'B'].stance ? 1 : 0.05;
      if (this.gaitWeight < 0.3) return 1;
      const u = this.prevU[thigh] ?? 0;
      return u < 0.6 ? 1 : 0.05;
    };
    const load = { F: this.footLoad.F * stanceOf('thighF'), B: this.footLoad.B * stanceOf('thighB') };
    // 무릎 꿇기/일어나는 중엔 무릎과 손으로 땅을 짚으니 받칠 수 있다
    const kn = this.kneelAmount;
    if (kn > 0) {
      load.F = Math.max(load.F, 0.6);
      load.B = Math.max(load.B, 0.6);
    }
    this.crouch = kn * 0.43;
    const loadSum = load.F + load.B;

    // 다리 근육이 "골반은 위로, 발은 아래로" 민다. 발이 땅을 딛고 있으면 땅이 되받아쳐서 몸이 선다.
    // 발이 공중이면 아무것도 받쳐주지 않으니 그대로 주저앉는다. (보이지 않는 줄에 매달려 있지 않다)
    // 몸 전체가 함께 가속되도록 힘을 골반과 상체에 무게 비율대로 나눈다
    // (골반만 밀면 막대 아래만 잡아당긴 것처럼 상체가 뒤로 젖혀진다)
    const chest = this.bodies.chest;
    const push = (fx, fy, fz) => {
      const up = BODY.upperShare; // 가슴(+머리·팔)이 몸무게에서 차지하는 비율
      // R2′ 걸음 조율 채널 A (GAIT.pushAtFoot, 확인표 181, 10/8): 수평 추진력의 골반 몫을 딛은 발 자리(발바닥 가운데 x·z, 골반 높이)에 하중 비율대로 건다 — 크기·방향은 같고 점만 옮기므로
      //  직진은 그대로, 발이 몸 중심선에서 옆으로 치우친 만큼 yaw 짝힘이 저절로 생긴다(오른발이 밀면 왼쪽으로 돈다 = 사람의 베는 걸음). 두 발 대칭이면 서로 지워져 오늘과 같다. 수직 받침 fy 와 가슴 몫은 오늘 자리. 0 = 오늘(바이트 동일)
      const paf = hybrid && GAIT.pushAtFoot > 0 && loadSum > 1e-3 && (fx !== 0 || fz !== 0) ? Math.min(1, GAIT.pushAtFoot) : 0;
      pelvis.addForce({ x: fx * (1 - up) * (1 - paf), y: fy, z: fz * (1 - up) * (1 - paf) }, true);
      chest.addForce({ x: fx * up, y: 0, z: fz * up }, true);
      if (paf > 0) {
        const py = pelvis.translation().y;
        for (const k of ['F', 'B']) {
          const w = load[k] / loadSum;
          if (w <= 0) continue;
          const l = G.legs[k];
          const pt = l.stance ? l.pinC : l.plant;
          pelvis.addForceAtPoint({ x: fx * (1 - up) * paf * w, y: 0, z: fz * (1 - up) * paf * w }, { x: pt.x, y: py, z: pt.z }, true);
        }
      }
      if (loadSum < 1e-3 || BODY.footReaction === 0) return;
      for (const [k, shin] of [['F', 'shinF'], ['B', 'shinB']]) {
        const w = load[k] / loadSum;
        const r = BODY.footReaction ?? 1;
        if (w > 0) this.bodies[shin].addForce({ x: -fx * w * r, y: -fy * w * r, z: -fz * w * r }, true);
      }
    };

    // 1) 체중 받치기 (다리를 펴는 힘)
    if (mus > 0.1 && loadSum > 0) {
      // 지형 무대: 서는 높이는 골반 밑 땅 위로, 수직 속도는 비탈을 따라 오르내리는 몫을 뺀 값 (평지 무대는 아래 원래 식 그대로)
      const h = hybrid ? G.h : this.terrain ? this.terrain.heightAt(p.x, p.z) + BODY.standHeight - (1 - this.legHealth) * 0.1 - this.stanceDrop - this.crouch : BODY.standHeight - (1 - this.legHealth) * 0.1 - this.stanceDrop - this.crouch;
      const vy = this.terrain ? v.y - this.groundVelocityAt(p.x, p.z, v) : v.y;
      // hybrid: 보조 힘은 몸무게의 GAIT.assist만 (일어선 직후엔 100%에서 천천히 줄인다). 나머지는 다리 관절이 받친다
      const share = hybrid ? G.supportShare(M * g) : BODY.support;
      let fy = M * g * share + BODY.supportStiffness * (h - p.y) - BODY.supportDamping * vy;
      // 다친 다리는 힘을 못 쓴다 → 체중을 버틸 수 있는 한계
      const legPower = (load.F * this.limbs.legF + load.B * this.limbs.legB) / loadSum;
      fy = THREE.MathUtils.clamp(fy * mus, 0, M * g * (1.2 + 1.3 * legPower) * Math.min(1, loadSum * 1.5));
      if (p.y > h + 0.25) fy = 0;
      push(0, fy, 0);
    }

    // 2) 걷기: 딛고 있는 발로 땅을 밀어서 나아간다 (발이 떠 있으면 못 민다, 미끄러우면 미끄러진다)
    const dvx = want.x - v.x;
    const dvz = want.z - v.z;
    const grip = Math.min(1, loadSum * 1.5);
    // 빠른 걸음(10/15 — gait.js fastBegin)이 가속 한도 배율을 두면(독일 간격 잡기 빠른 디딤 chase.accel — 헛침 뒤 박차고 들어감) 그 걸음 동안만 곱한다. 보통 걸음·이탈리아 박자 걸음은 × 1 (같은 수)
    //  첫 걸음 박차기(10/15 — GAIT.stepBurst)는 박찬 걸음 뒤에도 몸이 박찬 빠르기를 다 줄일 때까지(gait.burstBrake) 같은 배율 — 세게 멈춤. 간격 잡기의 잡기(gait.holdBrake)도
    //  잡기를 건 뒤 몸이 설 때까지 같은 배율(같은 값 — 새 값 없음). 둘 다 플레이어만이라 AI 는 늘 같은 수
    //  동방 보법 '가벼운 발'(10/15 — GAIT.cnLight · 유파 걸음 칸 light, 동방 1.5 · docs/strike/cn_light_feet_2026-10-15.md): 위 셋이 아닌 보통 걸음 몫(× 1)만 곱한다 —
    //  걷기 시작·멈춤·방향 바꿈이 같은 한도라 함께 빨라지고 최고 빠르기(speed)는 그대로. 몸의 일이라 사람·AI 같이. 칸 없는 유파·끔(0)은 × 1 그대로(바이트 같음)
    //  동방 AI 걸음 박자(10/15 — GAIT.cnLightAi · ai.js update 의 aiLightHold): 가벼운 발 몸의 AI 가 공격 꼴이 아닐 때(간 보기·막기·물러남)는 보통 걸음 몫 × 1(옛 가속) — 사람·끔은 그대로
    const lim = M * (hybrid ? GAIT.maxAccel * (G.fastK > 1 ? G.fastAcc : G.burstBrake || G.holdBrake ? GAIT.burstAccel : GAIT.cnLight && !this.aiLightHold ? (G.P.light ?? 1) : 1) : BODY.maxAccel) * grip; // 사람이 발로 낼 수 있는 가속에는 한계가 있다 (다리로 서면 몸이 무거워 조금 더 느리게)
    const fx = THREE.MathUtils.clamp(M * BODY.moveAccel * dvx, -lim, lim) * mus;
    const fz = THREE.MathUtils.clamp(M * BODY.moveAccel * dvz, -lim, lim) * mus;
    push(fx, 0, fz);

    // 3) 똑바로 서기: 주로 딛고 있는 다리의 엉덩이 관절이 골반을 세운다 (applyPose 참고).
    //    여기 "기준 막대"는 평형감각 정도의 약한 보조일 뿐이다.
    const vFwd = v.x * fwd.x + v.z * fwd.z;
    this.localVel.set(vFwd, v.x * rgt.x + v.z * rgt.z);
    this.anchor.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    // 가속하는 방향으로 몸을 숙인다 (달리기 출발처럼). 기울기 = atan(가속도 / 중력).
    // 발로 땅을 밀면 몸을 뒤로 넘기는 회전이 생기는데, 숙인 몸의 무게가 그걸 상쇄한다.
    const fh = Math.hypot(fx, fz);
    this.accelLean = this.accelLean || new THREE.Vector3();
    this.accelLean.lerp(_v5.set(fx, 0, fz), Math.min(1, dt * 10));
    const al = this.accelLean.length();
    // 자세에 따라 골반을 튼다 (서 있을 때만)
    let anchorQ = this.yaw;
    if (BODY.chain === 'legs') {
      // R2′ K1 (확인표 123): 닻은 **실제** 골반 yaw(측정값)를 따라 pitch·roll 기준 틀 노릇만 한다 — yaw 토크 0 (yaw 축 raw 5 모터 미설정).
      //  의도 ψ* = heading + pelvisYawOffset(오늘 닻 목표식 그대로, 새 식 없음)와의 차 Δψ 는 딛은 다리의 엉덩이 근육 몫 (gait.poseLegs, 124)
      const fp = _cv1.set(1, 0, 0).applyQuaternion(rot(pelvis, _cq1));
      if (Math.hypot(fp.x, fp.z) > 0.3) this.chainPsi = Math.atan2(-fp.z, fp.x);
      else if (this.chainPsi == null) this.chainPsi = this.heading;
      const psiStar = this.state === 'stand' && this.pelvisYawOffset ? this.heading + this.pelvisYawOffset : this.heading;
      this.chainDpsi = Math.atan2(Math.sin(psiStar - this.chainPsi), Math.cos(psiStar - this.chainPsi));
      anchorQ = _qt.setFromAxisAngle(UP, this.chainPsi);
    } else if (this.state === 'stand' && this.pelvisYawOffset) anchorQ = _qt.setFromAxisAngle(UP, this.heading + this.pelvisYawOffset);
    if (al > 1) {
      const ang = Math.atan(al / (M * g)) * BODY.accelLean;
      _axis2.set(this.accelLean.z / al, 0, -this.accelLean.x / al);
      anchorQ = _qt5.setFromAxisAngle(_axis2, ang).multiply(anchorQ);
    }
    this.anchor.setNextKinematicRotation(vecQ(anchorQ));
    this.anchorUp = (this.anchorUp || new THREE.Vector3()).set(0, 1, 0).applyQuaternion(anchorQ);
    const hold = THREE.MathUtils.clamp(1 - this.offBalance / BALANCE.fallRange, 0.15, 1);
    const assist = BODY.uprightAssist * mus * hold * (0.3 + 0.7 * Math.min(1, loadSum));
    const raw = this.uprightJoint.rawSet;
    for (const ax of MOTOR_AXES) {
      // R2′ K1 (123, legs): yaw 축 raw 5(MOTOR_AXES[2]) 는 생성 때부터 모터 미설정 → 여기서도 부르지 않는다(0·0 을 넣으면 그 축이 잠긴다 — 10/7 한 관절 시험).
      //  약한 닻·상한 둔 닻 없음(질량 무한 몸체의 토크는 반작용이 땅으로 안 간다). 감쇠 330 도 함께 사라진다. 옆·앞뒤 기울기(raw 3·4)는 오늘 그대로.
      //  10/2~10/6 의 W1b 는 raw 4(= 닻 z, 앞뒤 숙임)를 0·0 으로 잠그고 yaw 는 2500·330 그대로 둔 잘못된 구현이었다 — 그때의 W2 수치는 K1 측정이 아니다.
      if (BODY.chain === 'legs' && ax === MOTOR_AXES[2]) continue;
      const r = this.uprightRelax(ax); // 휘두르거나 부딪히는 동안 덜 붙잡기 (실험, 기본 1)
      let kk = BODY.uprightStiffness * assist * r, dd = BODY.uprightDamping * assist * r;
      if (ax === MOTOR_AXES[2] && BODY.anchorYawMax > 0 && this.state === 'stand') {
        // R2′ 닻 yaw 토크 상한(실험, 사장님 10/8 15:10; config BODY.anchorYawMax): 모터엔 상한 API 가 없어 이번 스텝의 요구 토크(k·e − d·ω, 아래 chainDbg.anchorTau 와 같은 식)가
        //  상한을 넘으면 그 비율만큼 강성·감쇠를 함께 낮춘다 → 이 스텝의 모터 토크 ≈ 상한(한 스텝 뒤처진 근사, 묵시 풀이라 안정). 0 = 오늘(무한)
        const ap = _cv1.set(1, 0, 0).applyQuaternion(rot(pelvis, _cq1));
        const psi = Math.hypot(ap.x, ap.z) > 0.3 ? Math.atan2(-ap.z, ap.x) : this.heading;
        const psiStar = this.pelvisYawOffset ? this.heading + this.pelvisYawOffset : this.heading;
        const e = Math.atan2(Math.sin(psiStar - psi), Math.cos(psiStar - psi));
        // 감쇠는 닻에 대한 **상대** 각속도에 걸린다 — 닻(운동학 몸체)도 목표 yaw 를 따라 도니 ω_pelvis 만 쓰면 요구 토크를 10 배 넘게 부풀린다(10/8 15:25 디버그: 세계 ω 4 rad/s × 330 = 1300 N·m 로 읽힘, 장부 실측 최고 233)
        const wA = this.anchorYawPsiPrev == null ? 0 : Math.atan2(Math.sin(psiStar - this.anchorYawPsiPrev), Math.cos(psiStar - this.anchorYawPsiPrev)) / dt;
        this.anchorYawPsiPrev = psiStar;
        const tau = kk * e - dd * (pelvis.angvel().y - wA); // 요구 토크(상대 각속도 감쇠) — 잔차 장부 r_V 와 상관 0.99·비 1.2(chain_ledger τ̂ 와 같은 식). 묵시 모터라 한 스텝 뒤처진 근사: 실측 최고는 상한의 1.3~2 배까지 샌다(10/8 15:30 보정표)
        const sc = Math.min(1, BODY.anchorYawMax / Math.max(1e-6, Math.abs(tau)));
        kk *= sc;
        dd *= sc;
        this.anchorYawTau = tau; // 측정용: 요구 토크(상한 전)
        this.anchorYawPeak = Math.max(this.anchorYawPeak || 0, Math.abs(tau));
        this.anchorYawN = (this.anchorYawN || 0) + 1;
        if (sc < 1) this.anchorYawSat = (this.anchorYawSat || 0) + 1;
      }
      raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, kk, dd);
    }
    if (this.chainDbg) {
      // 탐색판 HUD(측정만): 선언한 걷기 밀기 힘(골반 (1−up)·가슴 up)과 닻 yaw 토크 재계산(k·e + d·ω; legs 는 yaw 모터 미설정이라 0)
      const D = this.chainDbg;
      D.pushX = fx;
      D.pushZ = fz;
      if (BODY.chain === 'legs') D.anchorTau = 0;
      else {
        const ap = _cv1.set(1, 0, 0).applyQuaternion(rot(pelvis, _cq1));
        const psi = Math.hypot(ap.x, ap.z) > 0.3 ? Math.atan2(-ap.z, ap.x) : this.heading;
        const psiStar = this.state === 'stand' && this.pelvisYawOffset ? this.heading + this.pelvisYawOffset : this.heading;
        const e = Math.atan2(Math.sin(psiStar - psi), Math.cos(psiStar - psi));
        const r = this.uprightRelax(MOTOR_AXES[2]); // yaw 축 = raw 5 (uprightRelax 의 정의와 같음)
        D.anchorTau = BODY.uprightStiffness * assist * r * e - BODY.uprightDamping * assist * r * pelvis.angvel().y;
      }
    }
    // 걷는 방향으로 상체를 살짝 숙인다 (골반-가슴 관절 목표)
    this.lean = this.state === 'stand' ? THREE.MathUtils.clamp(-vFwd * 0.05, -0.12, 0.12) : 0;
  }

  // ── 진짜 균형 ──
  // 무게중심(CoM)의 속도까지 고려한 "캡처 포인트"(= 지금 속도로 몸이 멈추려면 발을 디뎌야 할 곳)를 구해서,
  // 그 점이 발 주변을 벗어나면 그쪽으로 발을 딛게 하고, 너무 멀면 넘어지게 한다.
  updateFooting(dt, fwd, rgt, want) {
    let M = 0;
    const com = _c1.set(0, 0, 0);
    const vel = _c2.set(0, 0, 0);
    // hybrid: 딛은 발에 더한 무게(GAIT.footExtra)는 땅이 바로 받치는 몫이라 무게중심 계산에서 뺀다
    //  (발을 들고 디딜 때마다 무게중심이 튀지 않게). 발 몸체의 무게 = 발 콜라이더 무게
    const G = this.gait;
    for (const name in this.bodies) {
      const b = this.bodies[name];
      const m = G && (name === 'footF' || name === 'footB') ? b.collider(0).mass() : b.mass();
      const c = b.worldCom();
      const v = b.linvel();
      com.x += c.x * m;
      com.y += c.y * m;
      com.z += c.z * m;
      vel.x += v.x * m;
      vel.z += v.z * m;
      M += m;
    }
    com.multiplyScalar(1 / M);
    vel.multiplyScalar(1 / M);
    this.com = this.com || new THREE.Vector3();
    this.com.copy(com);
    const w0 = Math.sqrt(9.81 / Math.max(0.5, this.terrain ? com.y - this.terrain.heightAt(com.x, com.z) : com.y)); // 지형 무대: 무게중심 높이는 그 밑 땅 위로
    const cpx = com.x + vel.x / w0;
    const cpz = com.z + vel.z / w0;
    // 걷는 중엔 무게중심이 발보다 앞서는 게 정상이다(다음 발로 받는다).
    // 그래서 가려는 방향으로 "다음 발을 디딜 자리"까지는 안전하다고 본다.
    const planX = (want.x / w0) * 1.3;
    const planZ = (want.z / w0) * 1.3;
    // 발바닥 위치 (땅에 닿은 발만)
    const a = this.solePoint('footF', _c3);
    const b = this.solePoint('footB', _c4);
    const T = this.terrain; // 지형 무대: 발 높이는 그 발 밑 땅 위로 (평지 무대는 원래 식 그대로)
    const ga = T ? a.y - T.heightAt(a.x, a.z) < 0.09 : a.y < 0.09;
    const gb = T ? b.y - T.heightAt(b.x, b.z) < 0.09 : b.y < 0.09;
    // 발마다 "체중을 받을 수 있는 정도": 땅에 닿아 있고(높이) 몸 아래에 있을수록(수평 거리) 크다
    const pp = this.bodies.pelvis.translation();
    const loadOf = (f) => {
      const grounded = THREE.MathUtils.clamp((0.16 - (T ? f.y - T.heightAt(f.x, f.z) : f.y)) / 0.08, 0, 1);
      const under = THREE.MathUtils.clamp(1.3 - Math.hypot(f.x - pp.x, f.z - pp.z) / 0.7, 0, 1);
      return grounded * under;
    };
    const k = Math.min(1, dt * 25);
    this.footLoad.F += (loadOf(a) - this.footLoad.F) * k;
    this.footLoad.B += (loadOf(b) - this.footLoad.B) * k;
    const offFrom = (x, z) => {
      if (ga && gb) return distToSegment2D(x, z, a.x, a.z, b.x, b.z);
      if (ga || gb) {
        const f = ga ? a : b;
        return Math.hypot(x - f.x, z - f.z);
      }
      // 두 발 모두 떠 있으면 (걷는 중 잠깐) 골반 아래를 기준으로
      return Math.hypot(x - pp.x, z - pp.z) + 0.05;
    };
    // 지금 발 위치 기준과, 계획한 다음 발 위치 기준 중 더 가까운 쪽
    const off = Math.min(offFrom(cpx, cpz), offFrom(cpx - planX, cpz - planZ));
    this.offBalance = this.state === 'stand' ? Math.max(0, off - BALANCE.footMargin) : 0;
    // 유파 버티기 (swayScale ①): 발 둘레 여유(footMargin) 밖으로 벗어난 몫에만 곱한다 — 여유 안에서는 그대로 0, 아래 문턱(fallRange·stumbleRange)과
    //  걸음 쪽 문턱(hurryFrom·catchOff)은 그대로라 같은 밀림에 덜 휘청이고 덜 붙잡고 덜 넘어진다. 칸 없는 유파는 1 이라 건너뜀
    const sway = this.swayScale;
    if (sway !== 1) this.offBalance *= sway;
    if (this.offBalance > BALANCE.fallRange) this.offBalanceTime += dt;
    else this.offBalanceTime = Math.max(0, this.offBalanceTime - dt * 2);
    // 넘어지지 않으려고 캡처 포인트 쪽으로 딛는 걸음 (몸 기준 방향으로 변환)
    const s = THREE.MathUtils.clamp(this.offBalance / BALANCE.stumbleRange, 0, 1);
    if (s > 0) {
      const p = this.bodies.pelvis.translation();
      const dx = cpx - p.x;
      const dz = cpz - p.z;
      const len = Math.hypot(dx, dz) || 1;
      this.stumble.set(((dx * rgt.x + dz * rgt.z) / len) * s, ((dx * fwd.x + dz * fwd.z) / len) * s);
    } else this.stumble.set(0, 0);
  }

  /** 발바닥 한가운데의 월드 좌표 */
  solePoint(foot, out) {
    const t = this.bodies[foot].translation();
    rot(this.bodies[foot], _q1);
    return out.set(0, -0.035, 0).applyQuaternion(_q1).add(_v3.set(t.x, t.y, t.z));
  }

  // 관절 목표 자세 정하기 (걷기 사이클, 방패 없는 손 가드)
  //
  // 걷기: 다리 흔드는 속도를 "실제로 이동한 거리"에 묶는다.
  //  - 보폭(stepLength)만큼 이동할 때마다 발이 한 번씩 번갈아 나간다 → 발이 미끄러지지 않는다.
  //  - 다리는 실제 이동 방향(앞/뒤/옆/대각선)으로 흔든다.
  //  - 멈추면 부드럽게 원래 서 있는 자세로 돌아온다.
  applyPose(dt = 0) {
    const J = this.jointByName;
    const lv = this.localVel;
    const speed = lv.length();
    const moving = this.state === 'stand' && speed > 0.12 ? 1 : 0;
    this.gaitWeight += (moving - this.gaitWeight) * Math.min(1, dt * 6);
    if (speed > 0.12) this.gaitDir.lerp(_v2d.set(lv.x / speed, lv.y / speed), Math.min(1, dt * 8)).normalize();
    // 한 주기(왼발+오른발) = 보폭 2개
    this.gaitPhase += (speed / (2 * BODY.stepLength)) * Math.PI * 2 * dt;

    const w = this.gaitWeight;
    const d = this.gaitDir;
    // (0,-1,0)으로 늘어진 다리를 방향 d(몸 기준 x=앞, z=오른쪽)로 보내는 회전축
    _axis.set(-d.y, 0, d.x);
    // 실제 걸음처럼: 한 주기의 60%는 발이 땅을 딛고(몸이 앞으로 가는 만큼 발이 뒤로 일정하게 밀림),
    // 나머지 40%는 발을 들어 앞으로 빠르게 가져온다. 딛는 동안 몸은 보폭의 1.2배를 가므로 발도 그만큼 쓸어준다.
    const STANCE = 0.6;
    const reach = 0.6 * BODY.stepLength; // 발이 몸 중심에서 앞뒤로 나가는 최대 거리
    let drop = 0;
    const legPose = (thigh, shin, foot, phase, stanceHip, stanceKnee) => {
      const u = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
      // 발을 막 디딘 순간(u가 1→0으로 넘어감) → 발소리/카메라 흔들림용 신호
      const prevU = this.prevU[thigh] ?? u;
      if (w > 0.5 && prevU > 0.8 && u < 0.2) this.footstep = Math.min(1, this.localVel.length() / BODY.moveSpeed);
      this.prevU[thigh] = u;
      let x; // 몸 기준 발의 앞뒤 위치(m)
      let lift = 0;
      if (u < STANCE) {
        x = reach - 2 * reach * (u / STANCE);
      } else {
        const t = (u - STANCE) / (1 - STANCE);
        x = -reach + 2 * reach * (0.5 - 0.5 * Math.cos(Math.PI * t));
        lift = Math.sin(Math.PI * t);
      }
      // 무릎을 굽히면 발이 몸 뒤쪽으로 빠지므로, 그만큼 허벅지를 더 앞으로 보내 상쇄한다
      const knee = 0.08 + 1.0 * lift;
      const hip = Math.atan2(x + 0.42 * Math.sin(knee) * d.x, 0.85) * w;
      const base = _qa.setFromAxisAngle(Z_AXIS, stanceHip * (1 - w));
      J[thigh].target.setFromAxisAngle(_axis, hip).multiply(base);
      // 딛고 있는 다리는 발이 땅에 붙어 있어서, 엉덩이 관절이 목표 각도를 맞추려 하면
      // 허벅지 대신 골반이 돌아간다 → 몸통을 세우는 힘의 반작용이 다리를 타고 땅으로 간다.
      const kneeAng = stanceKnee * (1 - w) - w * knee;
      J[shin].target.setFromAxisAngle(Z_AXIS, kneeAng);
      // 발목: 발바닥이 땅과 나란하도록 (엉덩이·무릎 굽힘을 되돌린다). 발을 들 땐 발끝을 살짝 든다
      const hipPitch = hip * d.x + stanceHip * (1 - 0.7 * w);
      J[foot].target.setFromAxisAngle(Z_AXIS, THREE.MathUtils.clamp(-(hipPitch + kneeAng) + 0.15 * lift, -0.6, 0.8));
      // 딛고 있는 다리: 비스듬할수록 엉덩이가 낮아진다 (다리 길이 0.85m)
      if (u < STANCE) drop = Math.max(drop, 0.85 * (1 - Math.cos(hip)) + 0.02 * w);
    };
    if (this.gait?.active && this.state === 'stand') {
      // 다리가 체중을 싣는 걸음: 딛은 발은 제자리, 내딛는 발은 딛을 자리로 (gait.js)
      this.gait.poseLegs();
    } else {
      // 가만히 있을 때는 펜싱 자세(앞발/뒷발), 걸을 때는 번갈아 걷기
      legPose('thighF', 'shinF', 'footF', this.gaitPhase, 0.24, -0.22);
      legPose('thighB', 'shinB', 'footB', this.gaitPhase + Math.PI, -0.18, -0.14);
      // 절뚝거림: 다친 다리로 디딜 때 골반이 더 내려앉는다
      const uF = this.prevU.thighF ?? 0;
      const bad = uF < STANCE ? 1 - this.limbs.legF : 1 - this.limbs.legB;
      drop += bad * 0.08 * w;
    }
    this.stanceDrop += (drop - this.stanceDrop) * Math.min(1, dt * 20);
    // 무릎 꿇기 자세 (앞다리는 세워 발을 딛고, 뒷다리는 무릎을 땅에)
    const kn = this.kneelAmount;
    const knB = this.kneelAmountB; // 뒷다리 차례(BODY.getupLead): 0 이면 kn 과 같은 값이라 오늘과 같은 섞기
    if (kn > 0 || knB > 0) {
      const K = (name, a, w) => J[name].target.slerp(_qk.setFromAxisAngle(Z_AXIS, a), w);
      K('thighF', 1.25, kn);
      K('shinF', -1.45, kn);
      K('footF', 0.2, kn);
      K('thighB', -0.15, knB);
      K('shinB', -1.75, knB);
      K('footB', 0.8, knB); // 뒷발은 발끝으로 땅을 짚는다
    }
    // 지형 무대(화산섬)만: 걸음(gait)이 발을 맡지 않는 동안(쓰러짐·무릎 꿇기·일어서기) 발목 목표를 그 발 밑 땅 기울기만큼 돌린다 —
    //  정강이 목표 자세 기준으로 월드 기울기를 표현해 발바닥이 비탈과 나란해진다. 무릎·엉덩이 목표와 뒷발 발끝 굽힘은 그대로 (샛별 0116047c 그대로)
    if (this.terrain && !(this.gait?.active && this.state === 'stand')) {
      for (const k of ['F', 'B']) {
        const fp = this.bodies['foot' + k].translation();
        const n = this.terrain.normalAt(fp.x, fp.z);
        const tilt = _terrainTilt.setFromUnitVectors(UP, _terrainNormal.set(n.x, n.y, n.z));
        rot(this.bodies.pelvis, _terrainShin).multiply(J['thigh' + k].target).multiply(J['shin' + k].target);
        _terrainFoot.copy(_terrainShin).multiply(J['foot' + k].target).premultiply(tilt);
        J['foot' + k].target.copy(_terrainShin.invert()).multiply(_terrainFoot);
      }
    }
    const setZ = (name, a) => J[name].target.setFromAxisAngle(Z_AXIS, a);
    // 빈 손은 앞으로 들어 균형을 잡는다 (다친 팔은 힘없이 늘어진다)
    const armO = this.limbs.armO;
    const OA = this.swordArt?.offArm; // 유파 빈팔 (10/10 고증 — schools.js offArm: 이탈리아만). 없으면 아래 두 줄 그대로
    if ((this.iai?.oneHand || this.iaiOneHold) && this.state === 'stand') this.offArmSchool({ guard: SECRET.iaiSayaHand }, armO); // 고노센 한 손 발도 (10/12 03:2x — secret_instant.js startIai): 빈손은 배 앞 (10/14 — 전 칼집을 뒤로 당기는 꼴 鞘引き, 뒷짐처럼 보여 몸통 앞으로)
    else if (OA && this.armed && this.state === 'stand') this.offArmSchool(OA, armO);
    else {
      setZ('uarmO', (this.secretStance?.offArm ?? 0.5) * armO); // 비기 런지: 빈팔을 뒤로 뻗어 균형 (secretStance.offArm, 없으면 오늘 그대로)
      setZ('farmO', 1.0 * armO);
    }
    // (칼 든 팔은 driveSword의 역운동학이 정한다)
    // 척추: 걷는 방향으로 살짝 숙이고, 몸통을 다치면 웅크리고, 칼 든 손 쪽으로 허리를 튼다
    this.daze = Math.max(0, (this.daze || 0) - dt * 0.12);
    const gut = this.wounds.reduce((a, wd) => a + (wd.part === 'chest' || wd.part === 'abdomen' || wd.part === 'pelvis' ? wd.severity : 0), 0);
    const sk = this.skill;
    const bp = this.bodyPose;
    const gw = this.guardWeight();
    const breathBend = this.stamina.pose * (0.07 + 0.025 * Math.sin(this.stamina.time * Math.PI * 2 / 0.85));
    const bend = (this.lean || 0) - breathBend - Math.min(0.45, gut * 0.3) - 0.2 * kn - bp.pitch - (this.secretStance?.pitch ?? 0); // secretStance: 비기 자세(발도 웅크림·런지 — secret_instant.js stanceTick) 몸통 숙임
    this.hunch = Math.max(0, -bend); // 일부러 앞으로 숙인 각도(라디안): 넘어짐 판정에서 뺀다
    // 가슴을 트는 각도(정면 기준): 검술 자세 지도 + (보정이 약할수록) 손이 있는 쪽으로.
    // 허리(척추)는 그중 골반이 이미 튼 만큼을 뺀 나머지만 튼다
    // 보정 v2 (s > 0): 몸 돌림의 s 몫은 이미 bodyPose(aimRaw) 에 있다 → 걸러진 손 쪽 몫은 (1 − s)
    //  (쉼 무게 bodyPose.idle 만큼 옛 몫 (1 − gw) 쪽으로 — updateBodyPose v2 가지의 몸 목표 섞기와 같은 무게)
    const chestYaw = sk.corr === 'v2' && sk.level > 0 ? bp.chestYaw + (1 - sk.level + (sk.level - gw) * THREE.MathUtils.clamp(bp.idle, 0, 1)) * -sk.aim.x * BODY_TURN : bp.chestYaw + (1 - gw) * -sk.aim.x * BODY_TURN;
    const twist = THREE.MathUtils.clamp(chestYaw - (this.state === 'stand' ? bp.pelvisYaw : 0), -0.8, 0.8);
    const spine = (name, pitch, yaw) => J[name].target.setFromEuler(_eu.set(0, yaw, pitch, 'YXZ'));
    spine('abdomen', bend * 0.5, twist * 0.45);
    spine('chest', bend * 0.5, twist * 0.55);
    // 머리: 몸통이 틀어져도 상대를 본다. 멍하면 고개가 떨어진다
    spine('head', -0.35 * this.daze, -THREE.MathUtils.clamp(chestYaw, -0.8, 0.8)); // 몸의 호가 가슴 명령을 키워도 머리 목표는 비틀기 한도(±0.8)와 같은 범위 (검토 2-6; 오늘 값은 이 안이라 바이트 동일)
  }

  // 근육: 목표 자세로 관절을 돌린다. 모터는 물리 엔진이 한꺼번에 풀어서 떨리지 않는다.
  // 근력 한계: 목표를 "지금 자세 + (최대 회전력 / 강도)" 이내로만 잡는다 → 낼 수 있는 힘이 사람 수준으로 제한된다.
  driveJoints() {
    const legsMus = Math.max(0.15, this.muscle);
    const inv = this.lastDt > 0 ? 1 / this.lastDt : 0;
    const armBoost = (this.armBoost = plungeBoost(this, 'strikeArm')); // 10/13 FINISH.lift (finish.js) — 중력 보상(manualMuscle)은 이 배율을 빼고 그대로
    for (const j of this.joints) {
      const n = j.name;
      const isLeg = n.startsWith('thigh') || n.startsWith('shin') || n.startsWith('foot');
      let mus = isLeg ? legsMus * (0.6 + 0.4 * this.legHealth) : Math.max(0.1, this.muscle);
      if (n === 'uarmO' || n === 'farmO') mus *= 0.15 + 0.85 * this.limbs.armO; // 다친 팔은 힘이 없다
      if (n === 'uarmS' || n === 'farmS') mus *= (0.3 + 0.7 * this.limbs.armS) * this.strength;
      if (n === 'uarmS' || n === 'farmS' || n === 'uarmO' || n === 'farmO') mus *= armBoost; // 10/13 내려찍기: 찍는 동안만 두 팔 근육 × FINISH.strikeArm (그 밖엔 1)
      if (n === 'uarmS' || n === 'farmS' || n === 'uarmO' || n === 'farmO') mus *= this.stamina.power;
      if (n.endsWith('F') && isLeg) mus *= 0.4 + 0.6 * this.limbs.legF;
      if (n.endsWith('B') && isLeg) mus *= 0.4 + 0.6 * this.limbs.legB;
      // gain: 다리가 체중을 싣는 걸음에서 딛은 다리는 근육을 더 단단히 쓴다 (gait.js)
      const k = j.k * mus * (j.gain || 1);
      const d = j.d * Math.sqrt(Math.max(0.05, mus)) * (j.gain || 1);
      const maxErr = (j.max * mus) / Math.max(1, k); // 이 이상 벌어진 목표는 근력으로 못 따라간다
      if (j.manual) {
        this.manualMuscle(j, k, d, j.max * mus);
        continue;
      }
      // 목표와 현재 자세를 "관절 기준 자세"에서 잰 회전으로 바꾼다
      toRotVec(_qt2.copy(j.restInv).multiply(j.target), _rv);
      rot(j.parent, _qp);
      rot(j.child, _qc);
      toRotVec(_qt2.copy(j.restInv).multiply(_qp.invert().multiply(_qc)), _cur);
      // 목표가 움직이는 속도 (걸음처럼 계속 움직이는 목표를 뒤처지지 않게)
      const prev = j.prevRV || (j.prevRV = _rv.clone());
      const raw = j.joint.rawSet;
      if (j.type === 'hinge') {
        let mErr = maxErr;
        if (n === 'farmS') {
          // 칼 든 팔꿈치: 빨리 펴거나 굽힐수록 힘이 빠진다 (힘-속도 관계). 엔진 모터의 "강도" 몫만 제한된다
          rot(j.parent, _qg);
          const ax = _gA.set(0, 0, 1).applyQuaternion(_qg);
          const wc = j.child.angvel();
          const wp = j.parent.angvel();
          const wRel = (wc.x - wp.x) * ax.x + (wc.y - wp.y) * ax.y + (wc.z - wp.z) * ax.z;
          mErr *= hill(Math.sign(_rv.z - _cur.z || 1) * wRel, this.weaponCfg.elbowVmax * (this.stamina.exhausted ? 1 : this.stamina.speed));
        }
        const tz = _cur.z + THREE.MathUtils.clamp(_rv.z - _cur.z, -mErr, mErr);
        const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);
        raw.jointConfigureMotor(j.joint.handle, HINGE_AXIS, tz, vz, k, d);
      } else {
        const chainY = BODY.chain === 'legs' && (n === 'thighF' || n === 'thighB' || n === 'abdomen' || n === 'chest'); // R2′ 비틀기 y 축 (124·125)
        for (const [i, ax] of [[0, 'x'], [1, 'y'], [2, 'z']]) {
          const t = _cur[ax] + THREE.MathUtils.clamp(_rv[ax] - _cur[ax], -maxErr, maxErr);
          if (chainY && i === 1) {
            this.chainAxisY(j, raw, t - _cur.y, t, k, d, mus);
            continue;
          }
          const v = THREE.MathUtils.clamp((_rv[ax] - prev[ax]) * inv, -15, 15);
          raw.jointConfigureMotor(j.joint.handle, MOTOR_AXES[i], t, v, k, d);
        }
      }
      prev.copy(_rv);
    }
  }

  /**
   * R2′ 'legs' 비틀기 y 축 구동 (명세 §2.2·§2.3, 심사 조건: 명시 토크 쌍 금지 → 엔진 암시 모터 + 포화 축소 σ).
   *  엉덩이(thigh, 124): 속도 목표 0, τ_pd = k·e − d·ω_rel,y, τ_cap = 기존 j.max × mus(새 수 없음), σ = min(1, τ_cap/|τ_pd|) → k·d 를 함께 σ 배.
   *  척추(abdomen·chest, 125): 같은 σ 길, 속도 목표 0(수동 감쇠), d_y = ζ·2·√(k_관절·I_윗몸) (ζ = BODY.chainSpineZeta, I 는 명세 부록 A 어림).
   *  e = 끌어 붙인 목표 − 현재(maxErr 자르기 뒤, 스프링 몫은 오늘처럼 j.max 안), ω_rel = (자식 − 부모) 각속도를 관절 기준 틀로.
   *  감쇠항까지 상한 안에 들어오고, 암시 해라 허벅지 비틀기 관성 0.02 kg·m² 에서도 안정하다. x·z 축은 오늘 그대로.
   */
  chainAxisY(j, raw, e, t, k, d, mus) {
    const n = j.name;
    let dy = d;
    if (n === 'abdomen' || n === 'chest') dy = BODY.chainSpineZeta * 2 * Math.sqrt(j.k * CHAIN_SPINE_I[n]) * Math.sqrt(Math.max(0.05, mus)) * (j.gain || 1);
    const wc = j.child.angvel();
    const wp = j.parent.angvel();
    // 상대 각속도를 부모 틀(부모⁻¹) → 관절 기준 틀(restInv)로
    const w = _cw.set(wc.x - wp.x, wc.y - wp.y, wc.z - wp.z).applyQuaternion(rot(j.parent, _cq1).invert()).applyQuaternion(j.restInv);
    const tau = k * e - dy * w.y;
    const cap = j.max * mus;
    const sigma = Math.min(1, cap / Math.max(1e-9, Math.abs(tau)));
    j.chainSigma = sigma;
    j.chainTau = tau * sigma; // 낼 토크 추정(스텝 전 값, 장부의 τ̂ 는 W1a 가 교차 검산)
    raw.jointConfigureMotor(j.joint.handle, MOTOR_AXES[1], t, 0, k * sigma, dy * sigma);
  }

  /**
   * 탐색판 HUD 전용 측정(시뮬·본판에서는 chainDbg 가 없어 돌지 않는다). 물리를 바꾸지 않는다.
   *  수직축 각운동량 L_y(모든 강체 + 칼, 무게중심 기준)·dL/dt, 선언한 힘의 yaw 토크(발 핀 힘·핀 yaw 토크·걷기 밀기)와의 차 r_y(잔차, 엔진 접촉 마찰과 닻 yaw 토크가 남는다 —
   *  W1a 장부 chain_ledger 의 식을 줄인 것: 접촉 임펄스 ×6/7×r 은 여기서 안 센다), 골반·가슴 yaw 각속도, 엉덩이 σ 포화율, 발 핀 미끄러짐 수.
   */
  chainProbe(dt) {
    const D = this.chainDbg;
    const list = this.meshes;
    let M = 0;
    let cx = 0;
    let cz = 0;
    let vx = 0;
    let vz = 0;
    const acc = (rb) => {
      const m = rb.mass();
      const c = rb.worldCom();
      const v = rb.linvel();
      M += m;
      cx += m * c.x;
      cz += m * c.z;
      vx += m * v.x;
      vz += m * v.z;
    };
    for (const { rb } of list) acc(rb);
    if (this.armed) acc(this.sword);
    if (M <= 0) return;
    cx /= M;
    cz /= M;
    vx /= M;
    vz /= M;
    let L = 0;
    const addL = (rb) => {
      const m = rb.mass();
      const c = rb.worldCom();
      const v = rb.linvel();
      L += m * ((c.z - cz) * (v.x - vx) - (c.x - cx) * (v.z - vz));
      const I = rb.principalInertia();
      const fr = rb.principalInertiaLocalFrame();
      rot(rb, _cq1).multiply(_cq2.set(fr.x, fr.y, fr.z, fr.w)); // 월드 ← 주축 틀
      const wv = rb.angvel();
      _cv1.set(wv.x, wv.y, wv.z).applyQuaternion(_cq3.copy(_cq1).invert());
      _cv1.set(_cv1.x * I.x, _cv1.y * I.y, _cv1.z * I.z).applyQuaternion(_cq1);
      L += _cv1.y;
    };
    for (const { rb } of list) addL(rb);
    if (this.armed) addL(this.sword);
    const dLdt = D.L == null || !(dt > 0) ? 0 : (L - D.L) / dt;
    D.L = L;
    // 선언한 외부 힘의 yaw 토크 (무게중심 기준): 발 핀 힘 + 핀 yaw 토크 + 걷기 밀기(골반 (1−up)·가슴 up)
    let tau = 0;
    const g = this.gait;
    if (g?.active) {
      for (const k of ['F', 'B']) {
        const l = g.legs[k];
        if (!l.chainPinOn) continue;
        tau += (l.chainPinZ - cz) * l.chainPinFx - (l.chainPinX - cx) * l.chainPinFz + l.chainPinTy;
      }
    }
    const pushX = D.pushX || 0;
    const pushZ = D.pushZ || 0;
    if (pushX || pushZ) {
      const up = BODY.upperShare;
      const pc = this.bodies.pelvis.translation();
      const cc = this.bodies.chest.translation();
      tau += (pc.z - cz) * pushX * (1 - up) - (pc.x - cx) * pushZ * (1 - up) + (cc.z - cz) * pushX * up - (cc.x - cx) * pushZ * up;
    }
    const r = dLdt - tau;
    // 창(약 0.5 s) 통계: 잔차 rms, σ<1 스텝 몫, 골반·가슴 yaw 각속도 최고(1 s 감쇠 유지)
    const N = 60;
    D.rr = D.rr || new Float64Array(N);
    D.sat = D.sat || new Uint8Array(N);
    D.i = ((D.i || 0) + 1) % N;
    D.rr[D.i] = r * r;
    const JF = this.jointByName.thighF;
    const JB = this.jointByName.thighB;
    const sF = JF.chainSigma ?? 1;
    const sB = JB.chainSigma ?? 1;
    D.sat[D.i] = sF < 1 || sB < 1 ? 1 : 0;
    let rs = 0;
    let sc = 0;
    for (let i = 0; i < N; i++) {
      rs += D.rr[i];
      sc += D.sat[i];
    }
    D.rRms = Math.sqrt(rs / N);
    D.satRate = sc / N;
    D.sigma = Math.min(sF, sB);
    D.hipTau = Math.max(Math.abs(JF.chainTau || 0), Math.abs(JB.chainTau || 0));
    const wp = Math.abs(this.bodies.pelvis.angvel().y) * 57.2958;
    const wc = Math.abs(this.bodies.chest.angvel().y) * 57.2958;
    D.pelvisW = wp;
    D.chestW = wc;
    const decay = Math.exp(-dt / 1.0);
    D.pelvisWmax = Math.max(wp, (D.pelvisWmax || 0) * decay);
    D.chestWmax = Math.max(wc, (D.chestWmax || 0) * decay);
    D.dpsi = this.chainDpsi || 0;
    D.spineTwist = 0;
    for (const nm of ['abdomen', 'chest']) {
      const j = this.jointByName[nm];
      rot(j.parent, _cq1).invert();
      rot(j.child, _cq2);
      toRotVec(_cq3.copy(j.restInv).multiply(_cq1.multiply(_cq2)), _cv1);
      D.spineTwist += _cv1.y;
    }
    D.slips = g?.active ? (g.legs.F.chainSlips || 0) + (g.legs.B.chainSlips || 0) : 0;
    D.steps = (D.steps || 0) + 1;
  }

  /**
   * bodies의 무게가 한 점(pivotBody의 로컬 x = localX 지점) 둘레에 만드는 회전력 (월드). out에 담아 돌려준다.
   */
  gravityTorque(bodies, pivotBody, localX, out) {
    const t = pivotBody.translation();
    rot(pivotBody, _qg);
    const A = _gA.set(localX, 0, 0).applyQuaternion(_qg).add(_gB.set(t.x, t.y, t.z));
    out.set(0, 0, 0);
    for (const b of bodies) {
      if (!b) continue;
      const c = b.worldCom();
      const m = b.mass();
      // (c − A) × (0, −m·g, 0)
      const rx = c.x - A.x;
      const rz = c.z - A.z;
      out.x += rz * m * 9.81;
      out.z += -rx * m * 9.81;
    }
    return out;
  }

  /** 팔꿈치 중력 보상: 아래팔과 칼의 무게를 팔꿈치 근육이 미리 버틴다 (엔진 모터는 목표 각도만 쫓으므로 따로 건다) */
  elbowGravity() {
    if (this.muscle < 0.12 || this.state === 'dead' || this.detachedParts?.has('farmS')) return; // 팔꿈치가 잘렸으면 보상 토크 없음 (잔해에 힘 0)
    const up = this.bodies.uarmS;
    this.gravityTorque([this.bodies.farmS, this.armed ? this.sword : null], up, 0.15, _mG);
    rot(up, _qg);
    const axis = _gA.set(0, 0, 1).applyQuaternion(_qg); // 팔꿈치 경첩 축
    const mus = Math.min(1, Math.max(0.1, this.muscle) * (0.3 + 0.7 * this.limbs.armS) * this.strength);
    const t = -_mG.dot(axis) * mus;
    this.bodies.farmS.addTorque({ x: axis.x * t, y: axis.y * t, z: axis.z * t }, true);
    up.addTorque({ x: -axis.x * t, y: -axis.y * t, z: -axis.z * t }, true);
  }

  /**
   * 직접 계산하는 근육 (큰 각도에서도 정확): 목표 자세와의 차이(쿼터니언)로 회전력을 만든다.
   * 뼈 길이 방향으로 비트는 축은 관성이 작아 세게 걸면 팽이처럼 돌기 때문에 약하게 따로 다룬다.
   */
  manualMuscle(j, k, d, maxT) {
    rot(j.parent, _qp);
    rot(j.child, _qc);
    _qt2.copy(_qp).multiply(j.target); // 목표 (월드)
    _qt2.multiply(_qc.clone().invert()); // 목표 × 현재⁻¹ = 남은 회전
    toRotVec(_qt2, _mE);
    const wc = j.child.angvel();
    const wp = j.parent.angvel();
    _mW.set(wc.x - wp.x, wc.y - wp.y, wc.z - wp.z);
    const boneAxis = _mA.set(1, 0, 0).applyQuaternion(_qc); // 위팔 뼈 방향 (x)
    const eTw = _mE.dot(boneAxis);
    const wTw = _mW.dot(boneAxis);
    const wSw = _mS.copy(_mW).addScaledVector(boneAxis, -wTw); // 휘두르는 방향의 실제 각속도 (힘-속도 관계용)
    // 목표 자세가 움직이는 속도 (가슴 기준 → 월드). 감쇠는 "멈춤"이 아니라 이 속도를 향한다
    //  → 감쇠를 넉넉히 줘도 휘두르는 속도가 줄지 않는다
    const wT = _mV.set(0, 0, 0);
    if (j.prevTarget && this.lastDt > 0) {
      toRotVec(_qt3.copy(j.target).multiply(_qt4.copy(j.prevTarget).invert()), wT).multiplyScalar(1 / this.lastDt).applyQuaternion(_qp);
      if (wT.length() > 20) wT.setLength(20);
    }
    (j.prevTarget || (j.prevTarget = new THREE.Quaternion())).copy(j.target);
    // 휘두르는 방향(뼈에 수직)
    _mT.copy(_mE).addScaledVector(boneAxis, -eTw).multiplyScalar(k);
    const wErr = _mW.sub(wT);
    _mT.addScaledVector(wErr.addScaledVector(boneAxis, -wErr.dot(boneAxis)), -d);
    // 중력 보상: 팔과 칼의 무게를 미리 알고 버틴다 (사람도 무게를 예상하고 힘을 준다 → 처지지 않는다)
    const mus = k / j.k / (this.armBoost ?? 1); // 10/13: 찍기 근육 배율(armBoost)은 무게를 더 버티는 데 쓰지 않는다 (1 이면 같은 float)
    this.gravityTorque([this.bodies.uarmS, this.bodies.farmS, this.armed ? this.sword : null], j.child, -0.15, _mG).multiplyScalar(-mus);
    // 팔꿈치를 굽히면 아래팔과 칼의 무게가 위팔을 길이 방향으로 비튼다 → 그 몫도 미리 버틴다
    //  (되먹임이 아닌 고정 보정이라 비틀기 축이 가벼워도 불안정해지지 않는다)
    const twistFF = THREE.MathUtils.clamp(_mG.dot(boneAxis), -10, 10);
    _mT.add(_mG.addScaledVector(boneAxis, -_mG.dot(boneAxis)));
    // 힘-속도 관계: 팔을 빨리 휘두를수록 어깨 힘이 빠진다
    const tlen = _mT.length();
    const cap = maxT * hill(tlen > 1e-6 ? wSw.dot(_mT) / tlen : 0, this.weaponCfg.shoulderVmax * (this.stamina.exhausted ? 1 : this.stamina.speed));
    if (tlen > cap) _mT.setLength(cap);
    // 비틀기: 위팔 자체의 비틀림 관성은 ≈0.003kg·m²로 아주 작다 → 안정 한계(강도 ≤10, 감쇠 ≤0.2) 안에서만
    //  (엔진 쪽 회전 감쇠(팔 몸체 1.5)가 함께 잡아줘서 조금 더 세게 걸 수 있다)
    //  관절 가동 범위 교정 (JOINTS twistK, 10/9 2차): 강성 25 → twistK 로 올리면 감쇠 0.8·상한 20 도 같은 배율 (25 = 오늘 그대로, 같은 float)
    const twR = twistK() / 25;
    // 날 세우기 팔 나눔 ⓓ (JOINTS.edgeArm, 10/10 — docs/motion/edge_alignment_2026-10-10.md): 칼 든 위팔은 날 세우기가 남긴 굴림 어긋남(칼날 축 둘레, 지난 스텝)의
    //  위팔 축 몫 × edgeArm 만큼 비틀기 목표를 옮긴다 — 아래팔 엎침·뒤침(손목 밧줄 ±80°)이 끝에 닿으면 어깨 돌림이 나머지를 낸다(사람 날 세우기 = 엎침 + 어깨 돌림).
    //  edgeArm 0 이면 이 줄은 eTw 그대로 (같은 float). 비틀기 서보 강성·감쇠·상한은 그대로
    const eTwE = this.edgeArmErr && j.child === this.bodies.uarmS ? eTw + JOINTS.edgeArm * this.edgeArmErr.dot(boneAxis) : eTw;
    _mT.addScaledVector(boneAxis, THREE.MathUtils.clamp(eTwE * 25 * twR - wTw * 0.8 * twR, -20 * twR, 20 * twR) + twistFF);
    j.child.addTorque(vecArg(_mT), true);
    j.parent.addTorque({ x: -_mT.x, y: -_mT.y, z: -_mT.z }, true);
  }

  /**
   * 관절 가동 범위 교정 ⓑ (JOINTS soft, 시제품): 범위 끝 zone 안에서만 되돌리는 스프링·감쇠 — 가운데 범위는 힘 0 이라 휘두르는 속도에 손대지 않는다.
   *  인대·관절낭이 끝에서 버티는 몫이라 근육 상한(j.max·손목 서보 상한) 밖이다. 각 정의는 tools/sim/joint_range.mjs 와 같다.
   *   (1) 칼 팔꿈치: 굽힘 < elbowSoft 이면 굽히는 쪽으로 kElbow·(elbowSoft − 굽힘) + 펴지는 속도 감쇠(kElbow·0.05). 축 = 위팔 z(경첩)
   *   (2) 위팔 돌림 (들림 120° 아래): 늘어뜨린 팔 기준 최단 호로 옮긴 옆 축과 경첩 축 사이 각이 [안쪽 + zone, 바깥 − zone] 밖이면 위팔 축 둘레로 되돌림 (반작용 = 가슴)
   *   (3) 손목 굽힘·폄: |asin(칼날·z_아래팔)| > wristFE − zone 이면 칼날을 경첩 면 쪽으로 (반작용 = 아래팔)
   */
  anatSoft() {
    if (this.state === 'dead' || this.detachedParts?.has('farmS') || this.detachedParts?.has('uarmS')) return;
    const up = this.bodies.uarmS;
    const fa = this.bodies.farmS;
    const chest = this.bodies.chest;
    const u = _ja1.set(1, 0, 0).applyQuaternion(rot(up, _jq1));
    const zU = _ja2.set(0, 0, 1).applyQuaternion(_jq1);
    const fx = _ja3.set(1, 0, 0).applyQuaternion(rot(fa, _jq2));
    const wu = up.angvel();
    const wf = fa.angvel();
    const torque = (b, ax, t) => b.addTorque({ x: ax.x * t, y: ax.y * t, z: ax.z * t }, true);
    // (1) 팔꿈치
    const flex = Math.atan2(_ja4.crossVectors(u, fx).dot(zU), u.dot(fx));
    const e0 = JOINTS.elbowSoft * HD;
    if (flex < e0) {
      const wRel = (wf.x - wu.x) * zU.x + (wf.y - wu.y) * zU.y + (wf.z - wu.z) * zU.z; // + = 굽히는 쪽
      const t = JOINTS.kElbow * (e0 - flex) + JOINTS.kElbow * 0.05 * Math.max(0, -wRel);
      torque(fa, zU, t);
      torque(up, zU, -t);
    }
    // (2) 위팔 돌림
    rot(chest, _jq3);
    const down = _ja4.set(0, -1, 0).applyQuaternion(_jq3);
    if (u.dot(down) > Math.cos(120 * HD)) {
      const r = _ja5.set(0, 0, this.side).applyQuaternion(_jq3).applyQuaternion(_jq4.setFromUnitVectors(down, u));
      const tw = this.side * Math.atan2(_ja6.crossVectors(r, zU).dot(u), r.dot(zU));
      const lo = (JOINTS.twist[0] + JOINTS.zone) * HD;
      const hi = (JOINTS.twist[1] - JOINTS.zone) * HD;
      const ex = tw < lo ? lo - tw : tw > hi ? hi - tw : 0;
      if (ex !== 0) {
        const wc = chest.angvel();
        const wTw = this.side * ((wu.x - wc.x) * u.x + (wu.y - wc.y) * u.y + (wu.z - wc.z) * u.z);
        const t = this.side * (JOINTS.kTwist * ex - (Math.sign(wTw) === -Math.sign(ex) ? JOINTS.dTwist * wTw : 0));
        torque(up, u, t);
        torque(chest, u, -t);
      }
    }
    // (3) 손목 굽힘·폄
    if (this.armed && this.sword) {
      const b = _ja4.set(0, 1, 0).applyQuaternion(rot(this.sword, _jq3));
      const zF = _ja5.set(0, 0, 1).applyQuaternion(_jq2);
      const fe = Math.asin(THREE.MathUtils.clamp(b.dot(zF), -1, 1));
      const w0 = (JOINTS.wristFE - JOINTS.zone) * HD;
      if (Math.abs(fe) > w0) {
        const ax = _ja6.crossVectors(zF, b).multiplyScalar(Math.sign(fe));
        if (ax.lengthSq() > 1e-9) {
          ax.normalize();
          const ws = this.sword.angvel();
          const wOut = -((ws.x - wf.x) * ax.x + (ws.y - wf.y) * ax.y + (ws.z - wf.z) * ax.z); // + = 범위 밖으로
          const t = JOINTS.kWrist * (Math.abs(fe) - w0) + JOINTS.dWrist * Math.max(0, wOut);
          torque(this.sword, ax, t);
          torque(fa, ax, -t);
        }
      }
    }
  }

  // ── 칼 조종: 팔 근육(어깨·팔꿈치)이 손을 목표로 옮기고, 손목 근육이 칼끝 방향을 맞춘다 ──
  //  예전처럼 손을 보이지 않는 줄로 끌지 않는다. 손이 갈 곳 → 어깨·팔꿈치 각도(역운동학, IK)를 계산해서
  //  관절 근육의 목표로 준다. 칼의 무게와 관성은 팔과 몸통이 그대로 버틴다.
  driveSword() {
    const sword = this.sword;
    const chest = this.bodies.chest;
    const mus = this.muscle;

    // 손 목표 위치: 가슴 앞 평면의 (좌우, 위아래) + 자동 깊이 (몸이 바라보는 방향 기준)
    const off = this.skill.aim; // 손 목표 (입력 + 검술 층의 이어 베기, 부드럽게 걸러진 값) — 자세 지도·겨눔·찌르기 출발점은 늘 이것을 본다
    const offH = off; // 손 자리 목표 (손 follow-through 는 10/8 17:20 지움 — 자리를 깨서 기각)
    // ① 날것의 매핑: 가운데로 모을수록 팔을 앞으로 뻗는다 (rawHand: corrScale·padHand 와 같은 식 하나)
    const handLocal = rawHand(offH.x, offH.y, _v2);
    // ② 검술 자세 지도: 손가락 위치 → 실제 롱소드 자세의 손 위치(앞뒤 깊이 포함)와 칼끝 방향
    //  검술 보정이 셀수록 ②를 따른다 (끔 = ①만)
    const gw = this.guardWeight();
    const G = guardAt(off.x, off.y, this.guardPose, this.finish); // v2 도 부른다: nearest → ai_sense.js·HUD
    const sv = this.skill.level;
    const v2 = this.skill.corr === 'v2' && sv > 0;
    // 보정 v2 쉼 무게 wi (updateBodyPose 가 쫓는 bodyPose.idle, 사장님 탐색판 2차 10/1 14:30): 쉼·되돌아옴은 자세 지도, 휘두르는 동안만 날것.
    //  손 목표와 칼끝 방향을 옛 보정의 명령(날것.lerp(G, gw), 아래 옛 줄과 같은 식)쪽으로 wi 만큼 섞는다 → wi = 1 이면 옛 보정 쉼과 같다
    const wi = v2 ? THREE.MathUtils.clamp(this.bodyPose.idle, 0, 1) : 0;
    if (v2) {
      const oldHand = wi > 0 ? _wi1.copy(handLocal).lerp(_v6.set(G.hand[0], G.hand[1], G.hand[2]), gw) : null;
      // 보정 v2: 손 당김 없음(한손 자세표도 함께). 날것 매핑은 어깨 둘레 한 배수 k(s) 로 (fix2 B, corrScale: 쉼 손이 옛 쉼과 같은 어깨 거리)
      const cs = this.corrScale(sv);
      if (cs.stC) handLocal.applyAxisAngle(UP, cs.stC); // 한손: 옆으로 선 가슴 틀에서 읽는다 (corrScale, padHand 와 같은 식)
      handLocal.sub(cs.S).multiplyScalar(cs.k).add(cs.S);
      // 마무리만 예외(사장님 9/30 23:40): FINISH_GUARDS 몫만(finishAt) s·몫 으로 명령
      if (this.finish.amt > 0) {
        const F = finishAt(off.x, off.y, _finH, this.finish, this.guardPose);
        const kf = sv * F.share;
        if (kf > 0) handLocal.lerp(_v6.set(F.hand[0], F.hand[1], F.hand[2]), kf);
      }
      if (oldHand) handLocal.lerp(oldHand, wi);
    } else if (gw > 0) handLocal.lerp(_v6.set(G.hand[0], G.hand[1], G.hand[2]), gw);
    // 탭 찌르기(skill.thrustPose)는 보정이 아니라 명령이라 검술 보정 세기(gw)와 무관하게 덧씌운다 — 보정 0 에서도 찌른다.
    //  찌르기는 지금 손 목표(handBase, 덧씌우기 전)에서 뻗어 나간다 (skill.thrust)
    // 약한 자세 겨눔 (FINISH.vital, 10/12 — vital_target.js): 상대가 무릎 꿇음·일어나는 중이면 베기 길이 목 앞을 지나게 손 높이를 준비 (보정 0 이면 손대지 않는다)
    if (FINISH.vital) {
      if (this.index === 0) playerVitalUpdate(this, this.lastDt || 0);
      vitalHand(this, handLocal);
    }
    const hb = (this.handBase ||= [0, 0, 0]);
    hb[0] = handLocal.x;
    hb[1] = handLocal.y;
    hb[2] = handLocal.z;
    const th = this.skill.thrustPose;
    if (th.w > 0) handLocal.lerp(_v6.set(th.hand[0], th.hand[1], th.hand[2]), th.w);
    // 바짝 붙으면 손을 접는다 (closeReach). 근접 밀치기 중엔 접기를 lift 만큼 푼다: x' = 접은 x + (x − 접은 x)·lift.
    //  lift 0 이면 오늘 줄 그대로 (같은 float). 손이 자세 깊이에 남아 코등이·칼 팔뚝이 상대 몸통에 닿는다
    //  손잡이 찍기(skill.pom, 시제품) 동안은 덧씌운 정도(th.w)만큼도 푼다 — 붙은 거리에서 폼멜을 앞으로 내지르는 동작이라. 찍기가 없으면 오늘 줄 그대로
    const foldX = Math.min(handLocal.x, this.closeReach());
    handLocal.x = foldX + (handLocal.x - foldX) * (this.skill.pom ? Math.max(this.lift, th.w) : this.lift);
    // 누르기: 손 목표 앞뒤를 상대 가슴 앞면(d − 0.11, 가슴 반두께 partDefs chest)으로 closeW 만큼. 높이·옆은 손가락이 둔 그대로
    //  (손잡이 찍기 동안은 덧씌운 정도만큼 덜 — 밀치기 끝에 곧장 찍으면 남은 누르기가 손을 상대 가슴 앞면에 붙잡지 않게)
    if (this.closeW > 0 && this.foe) handLocal.x += (this.foeDistance() - 0.11 - handLocal.x) * (this.skill.pom ? this.closeW * (1 - th.w) : this.closeW);
    const c = chest.translation();
    // 공통 탈진 덧씌움: 유파 자세표를 바꾸지 않고 손을 내리며 어깨/팔이 호흡을 따라간다.
    if (this.stamina.pose > 0) {
      const breath = Math.sin(this.stamina.time * Math.PI * 2 / 0.85) * 0.025;
      handLocal.lerp(_v6.set(0.23, -0.26 + breath, this.side * 0.17), this.stamina.pose);
    }
    const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));
    if (mus >= 0.12 && this.state !== 'dead') this.armIK(target);
    else this.armFull = false;
    if (mus < 0.12 || !this.armed) {
      this.aimLagBehind = 0;
      this.aimLagMap = 0; // follow-through 의 뒤처짐도 0 (쓰러짐·무장 해제 동안 낡은 값으로 몸을 더 틀지 않게 — 검토 2-5)
      // (손목 hold 상태 리셋은 10/8 17:20 hold 삭제와 함께 지움)
      this.aimOff = true; // 측정용: 다음 재개 스텝을 표시
      this.edgePrevT = null; // 날 세우기 목표 굴림 빠르기(JOINTS.edge)도 재개 때 0 부터
      this.edgeArmErr = null; // 팔 나눔 ⓓ 어긋남도 버린다 (쓰러짐·칼 놓침 동안 위팔 비틀기 목표를 옮기지 않게)
      this.prevAim = null; // 손목 제어가 멈춘 동안의 묵은 목표를 버린다 — 안 버리면 재개 첫 스텝에 지난 목표와의 차를 한 스텝 각속도(최대 120 rad/s)로 읽는다 (10/7; 샛별 A-021 뒤 injury_followup 과 같은 결함)
      return; // 쓰러지거나 칼을 놓치면 손목에 힘을 쓰지 않는다
    }
    const str = this.strength * (this.powerMul ?? 1) * plungeBoost(this, 'strikeWrist') * mus * (0.35 + 0.65 * this.armHealth) * this.stamina.power; // 기력 지침의 공통 힘 배율. 유파 목표는 유지
    const forearm = this.bodies.farmS;

    // 칼끝 방향: 손 위치가 곧 검술의 자세(가드)다.
    //  가슴 높이 가운데 → 칼끝이 상대를 겨눔(찌르기 자세)
    //  머리 위로 올리면 → 칼이 서고 조금 뒤로 누움(위에서 내려베기 준비, "지붕 자세")
    //  옆으로 빼면     → 칼이 그쪽으로 누움(가로베기 준비)
    //  허리 아래로     → 칼끝이 내려감(아래 자세)
    // 자세에서 자세로 손을 옮기면 칼이 크게(최대 100° 넘게) 돌며 베기가 된다.
    const aim = _v3.set(...guardDir(off.x, off.y, !!this.guardPose?.oneHand));
    if (v2) {
      // 쉼 무게 wi 의 섞을 곳 = 옛 보정 칼끝 방향 (아래 옛 줄과 같은 식)
      let oldAim = null;
      if (wi > 0) {
        oldAim = _wi2.copy(aim).lerp(_v6.set(G.dir[0], G.dir[1], G.dir[2]), gw);
        if (oldAim.lengthSq() < 0.04) oldAim.set(G.dir[0], G.dir[1], G.dir[2]);
        oldAim.normalize();
      }
      // 보정 v2: 칼끝 방향 당김 없음. 마무리만 FINISH_GUARDS 몫 s·몫 (위와 같은 예외, 같은 _finH)
      const kf = this.finish.amt > 0 ? sv * _finH.share : 0;
      if (kf > 0) {
        aim.lerp(_v6.set(_finH.dir[0], _finH.dir[1], _finH.dir[2]), kf);
        if (aim.lengthSq() < 0.04) aim.set(_finH.dir[0], _finH.dir[1], _finH.dir[2]);
        aim.normalize();
      }
      if (oldAim) {
        aim.lerp(oldAim, wi);
        if (aim.lengthSq() < 0.04) aim.copy(oldAim);
        aim.normalize();
      }
    } else if (gw > 0) {
      aim.lerp(_v6.set(G.dir[0], G.dir[1], G.dir[2]), gw);
      if (aim.lengthSq() < 0.04) aim.set(G.dir[0], G.dir[1], G.dir[2]);
      aim.normalize();
    }
    if (FINISH.vital) vitalAim(this, aim); // 약한 자세 겨눔: 칼 기울기 (높이만, 수평 방향 그대로)
    if (th.w > 0) {
      aim.lerp(_v6.set(th.dir[0], th.dir[1], th.dir[2]), th.w);
      if (aim.lengthSq() < 1e-6) aim.set(th.dir[0], th.dir[1], th.dir[2]);
      aim.normalize();
    }
    aim.applyQuaternion(this.yaw);
    // 보정 v2 (s > 0): 마지막 궤적 탐지기 (corr.js, 제 scratch 로 살아 있는 몸을 읽는다). 이 뒤 wAim·prevAim·aimDirW 가 같은 aim 을 본다
    if (v2) corrStep(this, aim, sv);
    if (ARM.vertLead > 0 && this.r2pOn()) {
      // 세로 follow-through(10/8 16:10, ARM.vertLead): 빠른 내려긋기 동안 서보 목표를 더 아래로 — 짧은 손가락 획도 칼끝은 몸통까지 내려가게. 손가락이 멈추면 τ 0.15 s 로 풀린다
      // 2 판(16:12): 긋는 내내가 아니라 **빠른 내려긋기가 가운데 위에서 짧게 멈췄을 때만** — 긋는 중엔 최고 하강 속도를 기억하고, 손가락이 그 30 % 아래로 느려졌는데 아직 패드 가운데 위(y > −0.15)면
      //  칼끝을 기억한 속도 × 값 만큼 더 내려 보낸다(관성 이월). 끝까지 그은 획(y < −0.15)엔 걸지 않는다 — 1 판은 전 구간에 걸어 끝까지 그은 세로가 몸 아래로 지나갔다
      const vy = this.skill.vel.y, ay = this.skill.aim.y, dtl = this.lastDt || 1 / 120;
      if (vy < -0.3 && this.skill.swinging) this.vertPeakDown = Math.max(this.vertPeakDown || 0, -vy);
      const stoppedShort = (this.vertPeakDown || 0) > 1 && -vy < 0.3 * this.vertPeakDown && ay > -0.15;
      const want = stoppedShort ? Math.min(0.5, this.vertPeakDown * ARM.vertLead) : 0;
      this.vertLeadAmt = want > (this.vertLeadAmt || 0) ? want : (this.vertLeadAmt || 0) * Math.max(0, 1 - dtl / 0.25);
      if (!this.skill.swinging && this.skill.activity < 0.05) this.vertPeakDown = 0; // 쉬면 기억 지움
      else if (vy > 0.3) this.vertPeakDown = 0; // 올리기 시작하면 지움
      if (this.vertLeadAmt > 1e-3) {
        const h = Math.hypot(aim.x, aim.z);
        if (h > 1e-3) { const ang = Math.atan2(aim.y, h) - this.vertLeadAmt; const c = Math.cos(ang); aim.set((aim.x / h) * c, Math.sin(ang), (aim.z / h) * c); }
      }
    } else this.vertLeadAmt = 0;
    if (this.stamina.pose > 0) aim.lerp(_v6.set(0.28, -0.93, this.side * 0.08).applyQuaternion(this.yaw).normalize(), this.stamina.pose).normalize();
    else if (this.stamina.level === 2 && this.stamina.speed < 1 && !this.skill.swinging && !this.skill.tap) { aim.y -= 0.12; aim.normalize(); }
    const mapAim = _mapAim.copy(aim); // 자세 지도 방향(빈손 짝힘·보정은 늘 이것을 본다)
    if (BODY.trunkFollow > 0) { // WA2-2 follow-through 가 읽는 '칼이 겨눔보다 뒤처진 각'(rad): 칼날 축 ↔ 자세 지도 방향 (hold 와 무관하게 지도 기준)
      rot(sword, _q1);
      const bl = _lagB.set(0, 1, 0).applyQuaternion(_q1);
      this.aimLagMap = Math.atan2(_lagC.crossVectors(bl, mapAim).length(), bl.dot(mapAim));
      // 부호 있는 가로 뒤처짐(10/8 WA5): 위에서 봐서 지도가 칼의 왼쪽(반시계, y 성분 +)에 있으면 +. 왼쪽 획(swingDir < 0)에선 + 가 뒤처짐, 오른쪽 획에선 − 가 뒤처짐 → 획 방향으로 뒤처진 몫만(앞서 넘어갔으면 0). 몸 follow-through 가 읽는다
      const sd = this.swingDir || 0;
      this.aimLagBehind = sd ? Math.max(0, -Math.sign(sd) * Math.atan2(_lagC.y, bl.dot(mapAim))) : 0;
    }
    // 목표 방향이 도는 속도: 손목 감쇠는 이 속도를 향한다 (멈추려는 게 아니라 목표를 따라가는 감쇠)
    const wAim = _v5.set(0, 0, 0);
    if (this.prevAim && this.lastDt > 0) {
      wAim.crossVectors(this.prevAim, aim).multiplyScalar(1 / this.lastDt);
      const wRaw = wAim.length(); // 측정용(동작 무관): 상한 전 목표 각속도 최고·상한에 걸린 횟수 (tools/sim 탐침이 읽는다)
      if (wRaw > (this.aimRateMax || 0)) this.aimRateMax = wRaw;
      if (this.aimOff) { this.aimOff = false; this.aimReactN = (this.aimReactN || 0) + 1; if (wRaw > (this.aimReactMax || 0)) this.aimReactMax = wRaw; } // 측정용: 재개 첫 스텝의 raw 목표 각속도
      if (wRaw > 25) { wAim.setLength(25); this.aimRateClamps = (this.aimRateClamps || 0) + 1; }
    }
    (this.prevAim || (this.prevAim = new THREE.Vector3())).copy(aim);
    this.aimDirW.copy(aim); // 빈손이 칼자루를 어디로 밀고 당길지 (offHand) — 서보 목표와 같은 방향(손목 hold 가지는 10/8 17:20 지움)(두 손 짝힘이 회전을 만든다)
    rot(sword, _q1);
    const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(_q1);
    const axis = new THREE.Vector3().crossVectors(blade, aim);
    const sinA = axis.length();
    const angle = Math.atan2(sinA, blade.dot(aim));
    const torque = new THREE.Vector3();
    const oneHandR2p = !this.weaponCfg.twoHand && this.r2pOn(); // 실험 길(서보 풀어주기·겨눔 앞세움)은 한손 무기·R2′ 범위 안에서만
    const leadK = ARM.servoLead > 0 && oneHandR2p ? 1 + ARM.servoLead : 1; // 실험(T2 길 (c)): 서보 목표 각을 (1 + servoLead) 배로 앞세움(스프링·제동 판단 모두). 1 = 오늘
    if (sinA > 1e-5) torque.copy(axis).multiplyScalar((this.weaponCfg.aimStiffness * angle) / sinA);
    if (leadK !== 1) torque.multiplyScalar(leadK);
    // 칼날(날 선 쪽)이 휘두르는 방향을 향하도록 비틀림 유지.
    // 칼이 거의 멈춰 있으면 칼 면이 몸 오른쪽을 보게 둔다.
    const flat = new THREE.Vector3(0, 0, 1).applyQuaternion(_q1);
    // 칼날 가운데쯤이 실제로 움직이는 방향 (손잡이 속도와 다르다: 칼은 손을 축으로 돈다)
    const bv = this.hitPointVel;
    const edgeDir = new THREE.Vector3(bv.x, bv.y, bv.z);
    const em = JOINTS.playerEdgeMode && playerArm(this) ? JOINTS.playerEdgeMode : edgeMode(); // 플레이어 칼만 다른 날 세우기 방식 (JOINTS.playerEdgeMode, 기본 null = 같음)
    // 날 세우기 ⓒ 미리 돌리기 (JOINTS.edge 'pre'): 명령 겨눔이 도는 빠르기(wAim, 서보 목표)로 칼날 70 % 지점이 곧 갈 속도를 읽어 더한다 —
    //  칼이 실제로 빨라지기 전(준비 자세에서 길의 첫 방향으로 손이 움직이기 시작할 때)에 날이 그쪽을 먼저 본다. 'pre' 가 아니면 오늘 줄 그대로
    if (em === 'pre') edgeDir.addScaledVector(_edL.crossVectors(wAim, blade), (this.weaponCfg.hiltLength + 0.7 * this.weaponCfg.bladeLength) * JOINTS.edgeLead);
    // 날 세우기 상대 속도 (JOINTS.edgeRel, 'torque' 가 아닐 때만): 베는 것은 상대 몸에 대한 칼 움직임이라 상대 가슴 속도를 뺀다 (판정 combat.js 의 rel 과 같은 뜻)
    if (em !== 'torque' && JOINTS.edgeRel && this.foe?.bodies?.chest) { const fv = this.foe.bodies.chest.linvel(); edgeDir.x -= fv.x; edgeDir.y -= fv.y; edgeDir.z -= fv.z; }
    // 날 세우기 닿을 자리 (JOINTS.edgeAt 'near', 'torque' 가 아닐 때만): 상대 몸 부위가 칼날 가까이(edgeNear m 안) 오면, 날 방향을 칼날 70 % 지점 제 속도 대신
    //  '그 부위에 가장 가까운 칼날 점의 속도 − 그 부위 속도'(판정 combat.js 의 rel 과 같은 뜻, 닿기 전에 미리)로 읽는다 — 상대 팔·몸이 움직여 칼 면으로 닿는 몫(칼 면 맞음의 약 ⅓)을 겨눈다
    if (em !== 'torque' && JOINTS.edgeAt === 'near' && this.foe?.bodies) this.edgeNearDir(edgeDir);
    // 플레이어 입력 미리 돌리기 (JOINTS.playerEdge, 10/10 플레이어 칼 면 — docs/motion/player_edge_2026-10-10.md): 사람 손가락 칼(playerArm)만.
    //  손가락이 가는 쪽으로 겨눔이 곧 돌 빠르기를 칼날 70 % 지점 속도로 바꿔 날 방향에 더한다 — 칼이 실제로 빨라지기 전에 날이 먼저 그쪽을 본다. 'off' 면 오늘 줄 그대로
    const pem = JOINTS.playerEdge ?? 'off';
    if (pem !== 'off' && playerArm(this)) this.inputEdgeLead(edgeDir, blade, pem);
    edgeDir.addScaledVector(blade, -edgeDir.dot(blade));
    const mv0 = em === 'torque' ? 0.5 : JOINTS.edgeMove0, mv1 = em === 'torque' ? 2.5 : JOINTS.edgeMove1; // 날을 세우기 시작하는 칼날 빠르기 (m/s, 오늘 0.5~2.5)
    // 가만히 있을 때: 칼 면이 몸 오른쪽을 본다 / 움직일 때: 날이 움직이는 쪽을 향한다.
    // 속도에 따라 둘을 부드럽게 섞는다 (딱 잘라 바꾸면 경계 속도에서 칼이 매 순간 90°씩 비틀리며 떤다)
    const flatTarget = RIGHT_LOCAL.clone().applyQuaternion(this.yaw);
    flatTarget.addScaledVector(blade, -flatTarget.dot(blade));
    if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(flat);
    flatTarget.normalize();
    if (flatTarget.dot(flat) < 0) flatTarget.negate();
    // 사람 관절 범위(BODY.humanLimits): 가까운 쪽 칼 면이 아래팔 돌림 범위(HUMAN.forearmRoll, 손목 밧줄) 밖이고 반대쪽은 안이면 반대쪽 날을 쓴다 (양날)
    const zf = BODY.humanLimits ? _cr2.set(0, 0, 1).applyQuaternion(rot(forearm, _cq)) : null;
    if (zf) rollSide(flatTarget, zf);
    const ev = edgeDir.length();
    if (v2 && this.corr?.win) {
      // 보정 v2 ① 날 맞춤 (창 안에서만, corr.js): 굴림 목표만 바꾼다. 판정(combat.js:179-181)이 쓸 상대 기준 속도 rel⊥ 로
      //  mfRel = b × rel⊥ 를 양날 규칙으로 mf 쪽에 부호 맞춘 뒤 방향끼리 섞는다(속도 벡터는 섞지 않는다: 반대여도 납작이 되지 않음).
      //  섞기 세기는 기존 smoothstep 0.5~2.5 m/s 를 max(|제 칼⊥|, |rel⊥|) 에 (여쭘 9). 이득 4 / 0.12·twistScale 그대로
      const rp = this.corr.relPerp;
      const moving = THREE.MathUtils.smoothstep(Math.max(ev, rp.length()), mv0, mv1);
      this.edgeMoving = moving; // 측정용 (joint_range 칼 면 계기가 맞는 순간 읽는다)
      if (moving > 0) {
        const mfRel = _cr1.crossVectors(blade, rp);
        const mf = edgeDir.crossVectors(blade, edgeDir);
        if (mf.lengthSq() < 1e-4) mf.copy(mfRel);
        if (mfRel.lengthSq() < 1e-4) mfRel.copy(mf);
        mf.normalize();
        mfRel.normalize();
        if (mf.dot(flat) < 0) mf.negate();
        if (zf) rollSide(mf, zf);
        if (mfRel.dot(mf) < 0) mfRel.negate();
        mf.lerp(mfRel, sv).normalize();
        flatTarget.lerp(mf, moving);
        if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(mf);
        flatTarget.normalize();
      }
      this.corr.rollTarget.copy(flatTarget);
    } else {
      const moving = THREE.MathUtils.smoothstep(ev, mv0, mv1);
      this.edgeMoving = moving; // 측정용 (joint_range 칼 면 계기가 맞는 순간 읽는다)
      if (moving > 0) {
        const mf = edgeDir.crossVectors(blade, edgeDir).normalize();
        if (mf.dot(flat) < 0) mf.negate();
        if (zf) rollSide(mf, zf);
        flatTarget.lerp(mf, moving);
        if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(mf);
        flatTarget.normalize();
      }
      if (v2 && this.corr) this.corr.rollTarget.copy(flatTarget);
    }
    // 막기 자리 몸꼴의 칼 면 (10/12 독일 왕관 — frames.js installCover 의 face, schools.js GERMAN_KRON): 덮개가 덧씌우기 칸을 쥔 동안 날 세우기 목표를 덮는 무게만큼
    //  그 쪽(왕관 = 칼 면이 상대 쪽, 날·코등이가 좌우)으로. 고르는 법은 위와 같다(가까운 칼 면 → 아래팔 돌림 범위). face 없는 덮개(중국 셋)·덮지 않는 때는 지나치기만 한다
    const cv = this.skill?._cover;
    if (cv?.own && cv.face && this.skill.thrustPose.w > 0) {
      const fw = _cvFace.set(cv.face[0], cv.face[1], this.side * cv.face[2]).applyQuaternion(this.yaw);
      fw.addScaledVector(blade, -fw.dot(blade));
      if (fw.lengthSq() > 1e-4) {
        fw.normalize();
        if (fw.dot(flat) < 0) fw.negate();
        if (zf) rollSide(fw, zf);
        if (flatTarget.dot(fw) < 0) flatTarget.negate();
        flatTarget.lerp(fw, this.skill.thrustPose.w);
        if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(fw);
        flatTarget.normalize();
        if (v2 && this.corr) this.corr.rollTarget.copy(flatTarget);
      }
    }
    // 칼날 축(길쭉한 방향)으로 도는 회전은 관성이 아주 작아서, 큰 힘을 주면
    // 계산이 폭주해 칼이 팽이처럼 돈다. 그래서 비틀림은 아주 약하게 따로 다룬다.
    const w = angvel(sword, new THREE.Vector3());
    this.edgeLag = Math.acos(THREE.MathUtils.clamp(Math.abs(flat.dot(flatTarget)), 0, 1)); // 측정용: 칼 면 ↔ 굴림 목표 어긋남 (rad, 양날이라 0~π/2)
    const wTwist = blade.clone().multiplyScalar(w.dot(blade));
    const wSwing = w.clone().sub(wTwist);
    wAim.addScaledVector(blade, -wAim.dot(blade));
    // 손목(두 손)의 힘은 사람 수준으로 제한된다 → 칼을 순식간에 돌리지 못하고, 칼의 무게와 관성이 느껴진다
    let cap = this.weaponCfg.maxAimTorque * str;
    // 놓아주기: 칼이 목표를 향해 날아가는 동안엔 붙잡지 않는다(관성으로 간다). 남은 각도가 "멈출 수 있는 거리"
    //  (각속도² / (2 × 최대 제동 각가속도)) 안으로 들어오면 그때부터 제동한다. 한 번 제동을 시작하면 이어 간다.
    let damp = this.weaponCfg.aimDamping;
    if (sinA > 1e-5) {
      const toward = wSwing.dot(axis) / sinA; // 목표 쪽으로 도는 빠르기 (rad/s)
      const tgtSp = wAim.dot(axis) / sinA;
      if (this.wristBrake && (toward < 1 || angle > this.wristBrakeAng + 0.35)) this.wristBrake = false;
      if (!this.wristBrake && toward > 3 && toward > tgtSp && angle > 0.25) {
        const brakeAcc = (cap * this.weaponCfg.brakeEcc) / this.swordIhand;
        const stopAngle = (toward * toward) / (2 * brakeAcc);
        // 쓰러진 상대를 내려찍을 때는 늦게 세운다 (finish.js). 마무리 찌르기가 겨눔으로 칼을 옮기는 동안(skill.plungePose)은 치는 게 아니라 예전대로 세운다
        const tap = this.skill.tap;
        const fr = this.finish.amt > 0 && aim.y < blade.y && !(tap?.down && !tap.go) ? 1 - FINISH.brakeRelief * this.finish.amt : 1;
        if (angle * leadK > stopAngle * this.weaponCfg.releaseMargin * fr) damp = this.weaponCfg.releaseDamping;
        else {
          this.wristBrake = true;
          this.wristBrakeAng = angle;
        }
      }
    }
    torque.addScaledVector(wSwing.sub(wAim), -damp);
    // 칼 무게도 같은 힘 안에서 버틴다 (칼끝이 처지지 않게)
    this.gravityTorque([sword], forearm, 0.13, _mG).multiplyScalar(-Math.min(1, str));
    torque.add(_mG);
    // 힘-속도 관계: 손목이 빨리 돌수록 힘이 빠진다 (근육 활성화 지연 30ms로 부드럽게)
    const fw = forearm.angvel();
    const tl = torque.length();
    const vAlong = tl > 1e-6 ? ((w.x - fw.x) * torque.x + (w.y - fw.y) * torque.y + (w.z - fw.z) * torque.z) / tl : 0;
    // 손목 각속도 한계는 힘(strength)의 제곱근에 비례한다 (감독 확정 V1, docs/characters.md "관절 각속도 한계를 힘에 묶는 실험"):
    //  힘이 세면 더 빠른 칼끝까지 힘이 실려 한 방이 실제로 세진다. 힘 1.0이면 예전과 같다 (기본 AI 회귀 동일)
    const h = hill(vAlong, this.weaponCfg.wristVmax * Math.sqrt(this.strength) * (this.stamina.exhausted ? 1 : this.stamina.speed), 0.25, this.weaponCfg.brakeEcc);
    this.wristHill = (this.wristHill ?? h) + (h - (this.wristHill ?? h)) * Math.min(1, (this.lastDt || 1 / 120) / 0.03);
    cap *= this.wristHill;
    if (tl > cap) torque.setLength(cap);
    // 측정용 (테스트 도구가 읽는다)
    this.debug.aim.copy(aim);
    this.debug.wristTorque.copy(torque);
    this.debug.wristCap = cap;
    // 날 세우기(손목 비틀기). 칼날 축 관성이 매우 작아 안정 한계(≈5) 안에서 최대한 세게.
    // 이 축 관성이 롱소드보다 작은/큰 무기는 twistScale만큼 힘도 같이 줄이거나 늘려서
    // (관성이 작을수록 같은 힘에도 더 빨리 도니까) 안정성을 맞춘다.
    let twist;
    if (em === 'torque') {
      twist = new THREE.Vector3().crossVectors(flat, flatTarget).projectOnVector(blade).multiplyScalar(4 * this.twistScale);
      twist.addScaledVector(wTwist, -0.12 * this.twistScale);
    } else twist = this.edgeTwist(em, blade, flat, flatTarget, w.dot(blade));
    torque.add(twist);
    sword.addTorque(vecArg(torque), true);
    // 손목 근육의 반작용은 아래팔로 간다. 단, 아래팔 길이 방향으로 비트는 몫은
    // 아래팔이 너무 가늘어(관성이 작아) 받으면 팽이처럼 돈다 → 팔뚝 뼈(요골·척골)가 그러듯
    // 팔을 따라 몸통으로 넘긴다. 전체 반작용의 합은 그대로다.
    rot(forearm, _q2);
    const fa = _v4.set(1, 0, 0).applyQuaternion(_q2);
    const along = torque.dot(fa);
    forearm.addTorque({ x: -(torque.x - fa.x * along), y: -(torque.y - fa.y * along), z: -(torque.z - fa.z * along) }, true);
    chest.addTorque({ x: -fa.x * along, y: -fa.y * along, z: -fa.z * along }, true);
  }

  /**
   * 플레이어 입력 미리 돌리기 (JOINTS.playerEdge — docs/motion/player_edge_2026-10-10.md). 칼은 읽기만, out(날 방향 속도)에 더한다.
   *  'input' = 손가락 속도(skill.vel, 패드 m/s) · 'goal' = 거른 손 목표가 아직 따라갈 몫((aimRaw − aim) × 거르기 빠르기) · 'both' = 둘의 합.
   *  그 패드 빠르기로 겨눔(guardDir)이 도는 각속도 × 칼날 70 % 반지름 = 곧 낼 칼날 속도, 무게 JOINTS.playerEdgeLead
   */
  inputEdgeLead(out, blade, mode) {
    const sk = this.skill;
    let vx = 0, vy = 0;
    if (mode === 'input' || mode === 'both') { vx += sk.vel.x; vy += sk.vel.y; }
    if (mode === 'goal' || mode === 'both') { const w = sk.filterW ?? 0; vx += (sk.aimRaw.x - sk.aim.x) * w; vy += (sk.aimRaw.y - sk.aim.y) * w; }
    // 덧씌우기 자세(skill.thrustPose — 찌르기·손잡이 찍기·비기 길목 한 칼 등)가 칼끝 방향을 명령하는 동안은 패드 → guardDir 이 겨눔이 아니라 그 몫(1 − th.w)만 (10/11 v6 §19):
    //  길목 한 칼은 패드 손 목표가 빠르게 옮겨 가는데 칼끝 방향은 덧씌우기(th.dir)가 쥔다 — 패드 길로 읽은 '곧 돌 쪽'이 날 방향에 더해져 높이 겨눔(머리)에서 칼이 위로 솟았다
    //  (탐침 tools/sim/gilmok_pair_probe.mjs: 플레이어 +1.06 m 헛침 → 이 몫을 빼면 AI 와 같은 +0.2~0.3 m). AI 는 이 앞당김이 없다(playerArm 만). 지움 몫 = 지도 몸 돌림 호(arcO)와 같은 (1 − th.w)
    const kw = 1 - (sk.thrustPose?.w ?? 0);
    vx *= kw;
    vy *= kw;
    // 플레이어 고유 동작 강화의 몸 돌림 (10/14 — skill.uniqBody.yawRate, 플레이어만 · 없으면 그대로): 덧씌운 가슴 돌림이 바뀌는 빠르기(가슴 명령 cT 에 − 로 더함 → 위축 둘레 −yawRate)로
    //  칼날 70 % 지점이 곧 낼 속도를 날 방향에 더한다 — 손가락 몫(위)만 읽으면 몸이 더 도는 몫을 날이 늦게 따라간다 (탐침 unique_enhance_measure feel: 날 각 23.4 → 22.2°, 부호를 뒤집으면 더 나빠짐 — 문서 §7)
    const ub = sk.uniqBody;
    if (ub?.yawRate) {
      const w = -ub.yawRate;
      const p = this.bladePoint(0.7, _pe0);
      const c = this.bodies.chest.translation();
      out.x += w * (p.z - c.z) * JOINTS.playerEdgeLead;
      out.z += -w * (p.x - c.x) * JOINTS.playerEdgeLead;
    }
    if (Math.hypot(vx, vy) < 1e-3) return;
    const oneHand = !!this.guardPose?.oneHand;
    const h = 0.02;
    const a0 = _pe0.set(...guardDir(sk.aim.x, sk.aim.y, oneHand));
    const a1 = _pe1.set(...guardDir(sk.aim.x + vx * h, sk.aim.y + vy * h, oneHand));
    const wIn = _pe1.crossVectors(a0, a1).multiplyScalar(1 / h).applyQuaternion(this.yaw);
    out.addScaledVector(_pe0.crossVectors(wIn, blade), (this.weaponCfg.hiltLength + 0.7 * this.weaponCfg.bladeLength) * JOINTS.playerEdgeLead);
  }

  /** 날 세우기 닿을 자리 (JOINTS.edgeAt 'near'): edgeDir(지금 = 칼날 70 % 지점 속도)를 가장 가까운 상대 부위 쪽 상대 속도로 섞는다. 칼은 읽기만 한다 */
  edgeNearDir(edgeDir) {
    const a = this.bladePoint(0, _enA), b = this.bladePoint(1, _enB);
    const ab = _enC.subVectors(b, a);
    const L2 = ab.lengthSq() || 1e-9;
    let best = Infinity, bp = null, bt = 0;
    for (const n of EDGE_NEAR_PARTS) {
      const pb = this.foe.bodies[n];
      if (!pb || this.foe.detachedParts?.has?.(n)) continue;
      const c = pb.translation();
      const t = THREE.MathUtils.clamp(((c.x - a.x) * ab.x + (c.y - a.y) * ab.y + (c.z - a.z) * ab.z) / L2, 0, 1);
      const d = Math.hypot(a.x + ab.x * t - c.x, a.y + ab.y * t - c.y, a.z + ab.z * t - c.z);
      if (d < best) { best = d; bp = pb; bt = t; }
    }
    const near = JOINTS.edgeNear;
    if (!bp || best > near) return;
    const wN = 1 - THREE.MathUtils.smoothstep(best, near * 0.5, near);
    const p = _enD.copy(a).addScaledVector(ab, bt);
    const sv = this.sword.linvel(), sw = this.sword.angvel(), com = this.sword.worldCom();
    const r = _enA.set(p.x - com.x, p.y - com.y, p.z - com.z);
    const vp = _enB.set(sw.y * r.z - sw.z * r.y + sv.x, sw.z * r.x - sw.x * r.z + sv.y, sw.x * r.y - sw.y * r.x + sv.z);
    const fv = bp.linvel();
    vp.x -= fv.x; vp.y -= fv.y; vp.z -= fv.z;
    edgeDir.lerp(vp, wN);
  }

  /**
   * 날 세우기 새 방식 (JOINTS.edge 'motor'·'ff'·'pre', 10/9~10/10 — docs/motion/edge_alignment_2026-10-10.md, 기본 끔). 칼날 축 둘레 1 자유도:
   *  e = flat → flatTarget 의 칼날 축 둘레 부호 있는 각, ω = 칼 각속도의 칼날 축 몫, ω* = 목표(flatTarget)가 칼날 축 둘레로 도는 빠르기(지난 스텝과 차).
   *  'ff' ⓑ: 오늘 명시 돌림힘에 목표 각속도 항 — 4·ts·sin e + 0.12·ts·(ω* − ω). 감쇠 계수는 오늘 그대로라 안정 한계도 그대로다(세기는 못 올림).
   *  'motor' ⓐ·'pre' ⓒ: 암시적(뒤 오일러) PD — 한 스텝 뒤 각·각속도로 힘을 정한다: τ = (k·e − (k·dt + d)·ω) / (1 + (k·dt² + d·dt)/I),
   *   I = 칼날 축 관성(swordProps.I.y). 엔진 관절 모터와 같은 적분이라 강성을 올려도 떨지 않는다. k = 4·ts·edgeMotorK, d = 0.12·ts·edgeMotorD, e 는 ±edgeClamp 로 포화.
   *   (Rapier 공 관절 모터를 칼 ↔ 아래팔에 걸어 보니 축 셋이 쿼터니언 성분으로 엮여, 칼날 축 목표 0.8 rad 이 0.53 rad 에 머물고 손목 굽힘 축으로 1.9 rad 돌았다 —
   *    칼날 축 하나만 잡을 수 없어 같은 적분을 이 축에 직접 푼다 — 10/9 앞 작업자 시험, 기록은 이 주석뿐)
   *  반작용은 오늘처럼 driveSword 끝에서 아래팔·가슴으로 나뉜다.
   */
  edgeTwist(em, blade, flat, flatTarget, wB) {
    const ts = this.twistScale;
    const e = Math.atan2(_edC.crossVectors(flat, flatTarget).dot(blade), flat.dot(flatTarget));
    const dt = this.lastDt || 1 / 120;
    // 목표 굴림 빠르기 ω*: 지난 목표 → 이번 목표의 칼날 축 둘레 각 / dt (처음·멈춤 뒤는 0)
    const prev = this.edgePrevT;
    let wT = 0;
    if (prev) wT = THREE.MathUtils.clamp(Math.atan2(_edC.crossVectors(prev, flatTarget).dot(blade), prev.dot(flatTarget)) / dt, -40, 40);
    (this.edgePrevT ||= new THREE.Vector3()).copy(flatTarget);
    let tau;
    if (em === 'ff') tau = 4 * ts * Math.sin(e) + 0.12 * ts * (wT - wB);
    else {
      const k = 4 * ts * JOINTS.edgeMotorK;
      const d = 0.12 * ts * JOINTS.edgeMotorD;
      const I = Math.max(1e-6, this.swordProps.I.y);
      const ec = THREE.MathUtils.clamp(e, -JOINTS.edgeClamp, JOINTS.edgeClamp);
      // 앞먹임 (JOINTS.edgeFF): 감쇠가 0 이 아니라 목표 굴림 빠르기 ω* 를 향한다 — 감쇠를 '멈춤'으로 두면 길이 휘며 목표가 도는 동안 (d/k)·ω* 만큼 늘 뒤처진다
      //  (오늘 명시 돌림힘: 0.12/4 × 20 rad/s ≈ 0.6 rad = 34°, 칼 면 맞음의 '못 따라감' 몫). edgeFF 0 = 10/9 첫 꼴(멈춤 감쇠)
      const wRel = wB - JOINTS.edgeFF * wT;
      tau = (k * ec - (k * dt + d) * wRel) / (1 + (k * dt * dt + d * dt) / I);
      // 손목 굴림 빠르기 한계: 이 힘이 한 스텝 뒤 칼날 축 각속도를 ±edgeWMax 밖으로 밀면 그 끝까지만 민다 (제동은 그대로) —
      //  큰 어긋남(양날 쪽 바꿈 등)에서 한 스텝에 1 rad 를 돌리는 '팽이'를 막는다. 사람 손목 엎침·뒤침 최고 빠르기 몫 (확인표 522)
      const wN = wB + (dt * tau) / I;
      const wM = JOINTS.edgeWMax;
      if (Math.abs(wN) > wM && Math.abs(wN) > Math.abs(wB)) tau = (I * (Math.sign(wN) * wM - wB)) / dt;
      const tM = 4 * ts * JOINTS.edgeTauK; // 돌림힘 상한 = 오늘 최대(4·ts·1) × edgeTauK
      if (Math.abs(tau) > tM) tau = Math.sign(tau) * tM;
    }
    this.edgeErr = e; // 측정용 (계기가 읽는다)
    // 팔 나눔 ⓓ: 다음 스텝 위팔 비틀기 목표가 읽는 어긋남 (칼날 축 × 부호 있는 각, ±edgeClamp). edgeArm 0 이면 두지 않는다
    if (JOINTS.edgeArm > 0) (this.edgeArmErr ||= new THREE.Vector3()).copy(blade).multiplyScalar(THREE.MathUtils.clamp(e, -JOINTS.edgeClamp, JOINTS.edgeClamp));
    return _edT.copy(blade).multiplyScalar(tau);
  }

  /**
   * 두 마디 팔 역운동학: 손(칼자루)이 target(월드)에 가도록 어깨·팔꿈치 목표 각도를 정한다.
   * 가슴 기준 좌표에서 계산하므로, 허리가 틀어져도 손은 목표를 향한다.
   */
  /** 비기를 실행하는 중인가 (경직 빼고) — 그동안 칼 팔 역운동학이 팔 끝까지 편다 (SECRET.secretReach, 10/12). 플레이어 = skill.sec · AI = ai.js 가 스텝마다 적는 secretActing · 발도·연환·휩쓸기 = iai */
  secretReaching() {
    if (!SECRET.secretReach) return false;
    const sec = this.skill?.sec;
    return !!this.iai || !!(sec && sec.stage !== 'stiff') || !!this.secretActing;
  }

  armIK(target) {
    const J = this.jointByName;
    const chest = this.bodies.chest;
    rot(chest, _q1);
    const c = chest.translation();
    const T = _ik1.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(_q2.copy(_q1).invert());
    const S = _ik2.set(ARM.shoulder[0], ARM.shoulder[1], this.side * ARM.shoulder[2]); // 어깨 (가슴 기준)
    const a = ARM.upper; // 위팔
    const b = ARM.fore; // 아래팔 + 손목까지
    const D = T.sub(S);
    const Dl = D.length();
    // 끔 = 위팔 + 아래팔 − 여유 (JOINTS reach ⓒ 면 팔 길이 × reachFrac — 팔이 늘 살짝 굽은 채로 뻗는다).
    //  비기 실행 동안(secretReaching — 경직 빼고, SECRET.secretReach)은 위팔 + 아래팔 그대로: 팔꿈치가 곧게(0°)까지 펴진다 (평소 여유 0.005 m 는 팔꿈치 15° · 플레이어 × 0.975 는 26°) — 사장님 10/12 03:0x
    const dMax = this.secretReaching() ? a + b : ikReach(a, b, playerArm(this));
    this.armFull = Dl >= dMax; // 팔이 다 펴짐 = 목표가 팔 길이 밖 (근접 밀치기 누르기 끝을 읽는다)
    const d = THREE.MathUtils.clamp(Dl, IK_DMIN, dMax);
    const Dn = D.normalize();
    // 팔꿈치는 아래·뒤·바깥쪽을 향한다
    const pole = _ik3.set(IK_POLE[0], IK_POLE[1], this.side * IK_POLE[2]).normalize();
    const pDir = pole.addScaledVector(Dn, -pole.dot(Dn));
    if (pDir.lengthSq() < 1e-6) pDir.set(0, -1, 0);
    pDir.normalize();
    const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const u = _ik4.copy(Dn).multiplyScalar(Math.cos(alpha)).addScaledVector(pDir, Math.sin(alpha)); // 위팔 방향
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    // 위팔 몸체 좌표축: x = 위팔 방향(어깨→팔꿈치), y = 아래팔이 접히는 쪽, z = x × y (팔꿈치 경첩 축)
    const xA = _ik5.copy(u);
    const fore = _ik6.copy(Dn).multiplyScalar(d).sub(_ik7.copy(u).multiplyScalar(a)); // 팔꿈치 → 손
    const yA = fore.addScaledVector(u, -fore.dot(u));
    if (yA.lengthSq() < 1e-6) yA.set(0, 1, 0).addScaledVector(u, -u.y);
    yA.normalize();
    const zA = _ik7.crossVectors(xA, yA).normalize();
    _ikM.makeBasis(xA, yA, zA);
    J.uarmS.target.setFromRotationMatrix(_ikM);
    J.farmS.target.setFromAxisAngle(Z_AXIS, flex);
  }

  /**
   * 두 손 잡기: 빈손이 칼자루 끝(폼멜 바로 위)을 잡는다. 롱소드는 두 손 칼이다.
   *  - 빈팔은 역운동학으로 그 점을 향해 뻗고(근육 목표),
   *  - 손과 칼자루 사이는 부드러운 스프링으로 잇는다(같은 크기 반대 방향 힘). 딱딱한 관절로 고리를 만들면
   *    물리 엔진이 떨기 쉬워서 스프링을 쓴다. 두 손이 함께 칼을 받치고 휘두른다.
   *  - 빈팔을 크게 다치거나, 쓰러지거나, 칼을 놓치면 손을 놓는다.
   */
  offHand() {
    const want =
      this.armed &&
      this.weaponCfg.twoHand && // 한손무기는 빈손이 칼자루를 잡지 않는다 (applyPose의 기본 손 자세를 그대로 쓴다)
      (this.state === 'stand' || this.state === 'kneel' || this.state === 'getup') &&
      this.muscle > 0.3 &&
      this.limbs.armO > 0.3 &&
      !(this.iai?.oneHand || this.iaiOneHold) && // 고노센 한 손 발도 동안(10/12 08:2x — 경직 붙잡기·풀기까지)은 빈손이 칼자루를 놓는다 (10/12 03:2x — 발도가 끝나면 다시 쥔다)
      GRIP.on;
    this.gripping = false;
    if (!want) return;
    const along = this.weaponCfg.gripAlong;
    const sword = this.sword;
    rot(sword, _q1);
    const st = sword.translation();
    const pommel = _gp.set(0, along, 0).applyQuaternion(_q1).add(_v7.set(st.x, st.y, st.z));
    // 빈손은 칼자루가 "있어야 할 곳"(칼끝이 향해야 할 방향 기준)을 향해 뻗는다 → 두 손이 칼자루를 밀고 당겨
    //  (손 사이 지렛대) 칼을 돌린다. 손목 힘이 사람 수준이라도 칼끝이 흔들리지 않는 이유
    const gripAim = _gw.copy(this.aimDirW).multiplyScalar(along).add(_v7.set(st.x, st.y, st.z));
    this.offArmIK(gripAim);
    // 빈손 위치 (아래팔 끝)
    const fo = this.bodies.farmO;
    rot(fo, _q2);
    const ft = fo.translation();
    const hand = _gh.set(0, -0.135, 0).applyQuaternion(_q2).add(_v7.set(ft.x, ft.y, ft.z));
    const dist = hand.distanceTo(pommel);
    if (dist > GRIP.reach) return; // 아직 손이 멀면 뻗기만 한다
    this.gripping = true;
    // 스프링: 멀수록 약하게 시작해 손이 닿으면 단단히 쥔다
    const grab = THREE.MathUtils.clamp((GRIP.reach - dist) / (GRIP.reach * 0.5), 0, 1) * Math.min(1, this.muscle) * (0.5 + 0.5 * this.limbs.armO);
    const vp = sword.velocityAtPoint(pommel);
    const vh = fo.velocityAtPoint(hand);
    const F = _gf.set(pommel.x - hand.x, pommel.y - hand.y, pommel.z - hand.z).multiplyScalar(GRIP.k);
    F.x += (vp.x - vh.x) * GRIP.d;
    F.y += (vp.y - vh.y) * GRIP.d;
    F.z += (vp.z - vh.z) * GRIP.d;
    F.multiplyScalar(grab);
    if (F.length() > GRIP.maxForce) F.setLength(GRIP.maxForce);
    fo.addForceAtPoint(vecArg(F), vecArg(hand), true);
    sword.addForceAtPoint({ x: -F.x, y: -F.y, z: -F.z }, vecArg(pommel), true);
  }

  /** 빈팔 역운동학 (팔이 아래로 늘어진 몸체 기준: 뼈 방향 −y, 팔꿈치는 앞(+x)으로 접힌다) */
  offArmIK(target) {
    const J = this.jointByName;
    const chest = this.bodies.chest;
    rot(chest, _q1);
    const c = chest.translation();
    const T = _ik1.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(_q2.copy(_q1).invert());
    const S = _ik2.set(0, 0.1, -this.side * 0.2); // 빈손 쪽 어깨 (가슴 기준)
    const a = 0.3;
    const b = 0.275;
    const D = T.sub(S);
    const d = THREE.MathUtils.clamp(D.length(), 0.08, a + b - 0.005);
    const Dn = D.normalize();
    const pole = _ik3.set(-0.25, -1, -this.side * 0.5).normalize(); // 팔꿈치는 아래·뒤·바깥
    const pDir = pole.addScaledVector(Dn, -pole.dot(Dn));
    if (pDir.lengthSq() < 1e-6) pDir.set(0, -1, 0);
    pDir.normalize();
    const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const u = _ik4.copy(Dn).multiplyScalar(Math.cos(alpha)).addScaledVector(pDir, Math.sin(alpha));
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    // 몸체 축: y = −(위팔 방향), x = 아래팔이 접히는 쪽, z = x × y
    const fore = _ik6.copy(Dn).multiplyScalar(d).sub(_ik7.copy(u).multiplyScalar(a));
    const xA = _ik5.copy(fore).addScaledVector(u, -fore.dot(u));
    if (xA.lengthSq() < 1e-6) xA.set(1, 0, 0).addScaledVector(u, -u.x);
    xA.normalize();
    const yA = _ik6.copy(u).negate();
    const zA = _ik7.crossVectors(xA, yA).normalize();
    _ikM.makeBasis(xA, yA, zA);
    J.uarmO.target.setFromRotationMatrix(_ikM);
    J.farmO.target.setFromAxisAngle(Z_AXIS, flex);
  }

  /**
   * 유파 빈팔 (10/10 고증 — schools.js offArm): 빈손을 가슴 몸체 기준 자리 [앞, 위, 바깥]로 보낸다(offArmIK).
   *  런지 자세(secret_instant.js stanceTick 의 _stance 무게) 동안 guard → lunge 로 옮긴다. 다친 팔은 오늘처럼 그만큼 늘어진다
   */
  offArmSchool(OA, armO) {
    const J = this.jointByName;
    const st = this._stance;
    const w = st?.key === 'lunge' && OA.lunge ? st.w : 0;
    const g = OA.guard, l = OA.lunge ?? g;
    const P = _oaP.set(g[0] + (l[0] - g[0]) * w, g[1] + (l[1] - g[1]) * w, -this.side * (g[2] + (l[2] - g[2]) * w));
    const chest = this.bodies.chest;
    const c = chest.translation();
    P.applyQuaternion(rot(chest, _oaQ)).add(_oaC.set(c.x, c.y, c.z));
    this.offArmIK(P);
    if (armO < 1) {
      J.uarmO.target.slerp(_oaI, 1 - armO);
      J.farmO.target.slerp(_oaI, 1 - armO);
    }
  }

  // 칼끝/타격 지점 속도 추적 (데미지 계산용)
  trackBlade(dt) {
    const tip = this.bladePoint(1, new THREE.Vector3());
    const mid = this.bladePoint(0.7, new THREE.Vector3());
    if (this.tipPrev) {
      this.tipVel.subVectors(tip, this.tipPrev).divideScalar(dt);
      this.hitPointVel.subVectors(mid, this.hitPointPrev).divideScalar(dt);
    }
    this.tipPrev = tip;
    this.hitPointPrev = mid;
  }

  /** 물리 스텝 직전의 상태를 JS 쪽에 복사해 둔다 (충돌 훅이 엔진을 건드리지 않고 계산하도록) */
  cacheState() {
    const c = (this.cache = this.cache || { parts: {} });
    const put = (b, o = {}) => {
      const t = b.translation();
      const r = b.rotation();
      const com = b.worldCom();
      const v = b.linvel();
      const w = b.angvel();
      o.p = (o.p || new THREE.Vector3()).set(t.x, t.y, t.z);
      o.q = (o.q || new THREE.Quaternion()).set(r.x, r.y, r.z, r.w);
      o.com = (o.com || new THREE.Vector3()).set(com.x, com.y, com.z);
      o.v = (o.v || new THREE.Vector3()).set(v.x, v.y, v.z);
      o.w = (o.w || new THREE.Vector3()).set(w.x, w.y, w.z);
      return o;
    };
    c.sword = put(this.sword, c.sword);
    for (const name in this.bodies) c.parts[name] = put(this.bodies[name], c.parts[name]);
  }

  syncMeshes() {
    // 피를 많이 흘리면 얼굴이 창백해진다
    if (this.faceMat) {
      const pale = THREE.MathUtils.clamp((1 - this.blood) / 0.5, 0, 1) * 0.7;
      this.faceMat.color.copy(this.skinColor).lerp(_paleColor, pale);
    }
    for (const { rb, group } of this.meshes) {
      const t = rb.translation();
      const r = rb.rotation();
      group.position.set(t.x, t.y, t.z);
      group.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}

// ── 도우미 함수들 ──

/**
 * 제대로 된 타격의 문턱(J): 방어구가 없었으면 그 부위(누비옷·맨머리)가 베였을 에너지 — ARMOR.solidJ(누비옷 가슴 45J)와
 *  그 부위 베기 문턱(ANATOMY) 가운데 작은 쪽. 가슴 45J · 배·골반 40J · 머리 30J · 다리 28J · 팔 22J.
 *  (팔다리 판을 가슴 기준 45J 로 재면, 맨팔이면 베였을 22~45J 타격을 판이 닳지도 않고 끝없이 막아 하인리히 v2 처럼 팔다리까지
 *  덮은 판금이 과한 어드밴티지가 됐다 — tools/sim/armor_eval.mjs)
 */
export function solidHitJ(zone) {
  return Math.min(ARMOR.solidJ, ANATOMY[zone]?.cut ?? ARMOR.solidJ);
}

/**
 * 방어구 한 번 맞을 때 닳는 양: 에너지(J) ÷ wear, 그리고 제대로 된 타격(solidHitJ 이상)이면 한 번마다 perHit 더.
 *  맨몸·누비옷으로도 괜찮았을 가벼운 타격은 거의 닳지 않고, 제대로 된 타격 몇 번에 부서진다 (케틀햇은 perHit 0 → 예전 ÷450 그대로)
 */
function armorWear(spec, energy, zone) {
  const per = spec.perHit ?? 0;
  return per > 0 && energy >= solidHitJ(zone) ? energy / spec.wear + per : energy / spec.wear;
}

/**
 * 판금 메쉬마다 그 부위 몸 좌표(= 겉모습 그룹 좌표, combat.js 가 맞은 점을 재는 좌표)의 상자.
 *  partial 이면 판은 이 상자(± ARMOR.plate.coverMargin)가 덮은 곳만 막는다 — 견갑·손목 보호대·정강이받이는 팔다리 일부,
 *  골반 자락(하인리히 앞 자락 두 장, 마르그레테 갑주 치마)은 골반 아래 허벅지께에 늘어져 골반은 아랫단만 덮는다.
 *  몸통을 감싸는 가슴판·배 판띠는 부위 전체를 덮는 것으로 친다
 */
function armorBoxes(group, dressTo, partial) {
  const list = [];
  // 금 메쉬(outfits.js plateCrack — 숨겨 두었다가 많이 닳으면 보인다)는 판이 아니다: 덮은 곳·본판 고르기에서 빼고,
  //  금이 붙은 판(host, 첫 판금 메쉬)이 떨어질 때 같이 떨어지게 한다
  const cracks = new Set(dressTo.userData.armorCracks || []);
  for (const mesh of dressTo.userData.armor) {
    if (cracks.has(mesh)) continue;
    const M = new THREE.Matrix4();
    for (let o = mesh; o && o !== group; o = o.parent) {
      o.updateMatrix();
      M.premultiply(o.matrix);
    }
    if (!mesh.geometry) continue;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    list.push({ box: mesh.geometry.boundingBox.clone().applyMatrix4(M), mesh });
  }
  return { list, partial, shed: false, host: list[0]?.mesh ?? null };
}

const _bs = new THREE.Vector3();
/** 상자 부피 (본판 = 부위에서 가장 큰 판금 메쉬를 고를 때) */
function boxVolume(box) {
  box.getSize(_bs);
  return _bs.x * _bs.y * _bs.z;
}

/** 맞은 쪽 뿔 (머리 몸 좌표 local 의 z 와 같은 쪽). 한쪽만 남았으면 그 뿔, 둘 다 없으면 null */
function nearHorn(P, local) {
  if (!P.hornR || !P.hornL) return P.hornR ? 'hornR' : P.hornL ? 'hornL' : null;
  return (local?.z ?? 0) * P.hornR.position.z >= 0 ? 'hornR' : 'hornL';
}

function vecQ(q) {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

// (파손) 칼날 질량이 길이를 따라 곧게 변한다고 본 밀도 ρ(u) = 1 + k·u (u: 자루 쪽 0 ~ 칼끝 1) 에서, 무게중심 비율 c 를 맞추는 k.
//  롱소드처럼 무게가 자루 쪽에 몰린 칼(c≈0.34)은 k<0 이라, 절반이 부러지면 질량은 절반보다 많이 남는다.
function linearDensityK(c) {
  const den = 1 / 3 - c / 2;
  return den > 1e-3 ? THREE.MathUtils.clamp((c - 0.5) / den, -0.95, 6) : 6;
}
/** 밀도 1 + k·u 인 막대의 [0, f] 구간: 질량 m, 무게중심 com(칼날 길이 비율), 무게중심 둘레 2차 모멘트 var(길이² 비율, 질량당) */
function barMoments(f, k) {
  const m = f + (k * f * f) / 2;
  const s1 = (f * f) / 2 + (k * f ** 3) / 3;
  const s2 = f ** 3 / 3 + (k * f ** 4) / 4;
  const com = s1 / m;
  return { m, com, var: s2 / m - com * com };
}

function shapeDesc(RAPIER, s) {
  if (s[0] === 'box') return RAPIER.ColliderDesc.cuboid(s[1], s[2], s[3]);
  if (s[0] === 'ball') return RAPIER.ColliderDesc.ball(s[1]);
  return RAPIER.ColliderDesc.capsule(s[1], s[2]);
}

// 무기 겉모습은 전역 난수(Math.random)를 건드리지 않는다. three.js 는 지오메트리·재질·메쉬를 만들 때마다 UUID 를 위해
//  Math.random 을 4번 부르는데, 시드를 고정한 시뮬(fights12·무기 배터리)은 그 난수 흐름에 결과가 걸려 있어 칼 장식 하나만
//  늘려도 결과가 바뀌었다(물리는 그대로인데). 겉모습을 만드는 동안만 따로 된 난수를 쓰고, 전역 난수는 옛 "부품당 상자
//  메쉬 하나"(지오메트리·재질·메쉬 UUID 3개 = 12번)만큼만 소비해 기존 시드 기준선을 그대로 지킨다. decorate 는 소비 0.
const VISUAL_DRAWS_PER_PART = 12;
let _visualSeed = 0x2545f491;
function visualRandom() {
  _visualSeed = (Math.imul(_visualSeed, 1664525) + 1013904223) >>> 0;
  return _visualSeed / 4294967296;
}
function isolatedVisual(build, globalDraws) {
  const real = Math.random;
  Math.random = visualRandom;
  try {
    return build();
  } finally {
    Math.random = real;
    for (let i = 0; i < globalDraws; i++) real();
  }
}

function shapeMesh(s, color, matOpts) {
  let geo;
  if (s[0] === 'box') geo = new THREE.BoxGeometry(s[1] * 2, s[2] * 2, s[3] * 2);
  else if (s[0] === 'ball') geo = new THREE.SphereGeometry(s[1], 16, 12);
  else geo = new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...(matOpts || {}) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function mat(color, opts) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...(opts || {}) });
}

function addMesh(group, geo, material, pos, rotEuler) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(...pos);
  if (rotEuler) m.rotation.set(...rotEuler);
  m.castShadow = true;
  group.add(m);
  return m;
}

/**
 * 부위 하나에 옷을 입힌다. 반환값은 "맞으면 붉어지는" 대표 메쉬.
 * 모든 좌표는 그 부위 몸체 기준 (+x 앞, +y 위, +z 오른쪽).
 */
function dressPart(group, d, look) {
  const s = d.shape;
  switch (d.name) {
    case 'pelvis': {
      const main = addMesh(group, new THREE.BoxGeometry(0.21, 0.18, 0.33), mat(look.tunic));
      // 상의 치마 자락 (허벅지 위를 덮음)
      addMesh(group, new THREE.CylinderGeometry(0.17, 0.215, 0.26, 14, 1, true), mat(look.tunic, { side: THREE.DoubleSide }), [0, -0.12, 0]);
      return main;
    }
    case 'abdomen': {
      const main = addMesh(group, new THREE.BoxGeometry(0.22, 0.155, 0.32), mat(look.tunic));
      addMesh(group, new THREE.BoxGeometry(0.235, 0.04, 0.335), mat(look.belt), [0, -0.05, 0]);
      for (const x of [0.111, -0.111]) for (const z of [-0.1, 0, 0.1]) addMesh(group, new THREE.BoxGeometry(0.004, 0.15, 0.012), mat(look.quilt), [x, 0, z]);
      return main;
    }
    case 'chest': {
      const main = addMesh(group, new THREE.BoxGeometry(0.24, 0.28, 0.37), mat(look.tunic));
      // 누빔 줄무늬 (앞/뒤)
      for (const x of [0.121, -0.121]) {
        for (const z of [-0.11, 0, 0.11]) addMesh(group, new THREE.BoxGeometry(0.004, 0.27, 0.012), mat(look.quilt), [x, 0, z]);
      }
      // 옷깃
      addMesh(group, new THREE.CylinderGeometry(0.07, 0.085, 0.05, 12), mat(look.quilt), [0, 0.15, 0]);
      // 가죽 끈 X자 (앞/뒤)
      if (look.straps) {
        for (const x of [0.126, -0.126]) {
          for (const a of [0.7, -0.7]) addMesh(group, new THREE.BoxGeometry(0.006, 0.36, 0.035), mat(look.straps), [x, 0, 0], [a, 0, 0]);
        }
      }
      return main;
    }
    case 'footF':
    case 'footB':
      return addMesh(group, new THREE.BoxGeometry(0.25, 0.075, 0.11), mat(look.shoes));
    case 'head': {
      const face = addMesh(group, new THREE.SphereGeometry(s[1], 18, 14), mat(look.skin));
      const dark = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
      for (const z of [-0.035, 0.035]) addMesh(group, new THREE.BoxGeometry(0.012, 0.015, 0.02), dark, [0.093, 0.016, z]);
      addMesh(group, new THREE.BoxGeometry(0.028, 0.032, 0.02), mat(look.skin), [0.102, -0.01, 0]);
      if (look.hair) {
        // 머리카락: 뒤통수와 정수리를 덮는 반구
        addMesh(group, new THREE.SphereGeometry(0.107, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(look.hair, { roughness: 1 }), [-0.011, 0.004, 0], [0, 0, 0.35]);
      }
      if (look.headband) addMesh(group, new THREE.CylinderGeometry(0.108, 0.108, 0.026, 18, 1, true), mat(look.headband), [0, 0.028, 0], [0, 0, 0.15]);
      if (look.helmet === 'kettle') {
        // 투구는 따로 묶어 둔다 → 세게 맞으면 통째로 벗겨져 날아간다
        const helm = new THREE.Group();
        const steel = mat(look.metal, { metalness: 0.75, roughness: 0.3 });
        addMesh(helm, new THREE.SphereGeometry(0.117, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), steel, [0, 0.018, 0]);
        // 넓은 챙 (아래로 살짝 퍼짐)
        addMesh(helm, new THREE.CylinderGeometry(0.123, 0.215, 0.046, 28, 1, true), new THREE.MeshStandardMaterial({ color: look.metal, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide }), [0, 0.0, 0]);
        // 정수리 능선
        addMesh(helm, new THREE.BoxGeometry(0.18, 0.023, 0.011), steel, [0, 0.128, 0], [0, 0, 0]);
        group.add(helm);
        group.userData.helmet = helm;
      }
      return face;
    }
    case 'uarmS':
    case 'uarmO':
      return addMesh(group, new THREE.CapsuleGeometry(s[2] + 0.008, s[1] * 2, 4, 10), mat(look.sleeve));
    case 'farmS':
    case 'farmO': {
      const m = addMesh(group, new THREE.CapsuleGeometry(s[2] + 0.004, s[1] * 2, 4, 10), mat(look.sleeve));
      addMesh(group, new THREE.SphereGeometry(0.042, 12, 8), mat(look.hands), [0, -0.135, 0]);
      return m;
    }
    case 'thighF':
    case 'thighB':
      return addMesh(group, new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10), mat(look.hoseUpper));
    default:
      return addMesh(group, new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10), mat(look.hoseLower));
  }
}

const _rv = new THREE.Vector3();
const MOTOR_AXES = [3, 4, 5]; // 회전 x, y, z (RawJointAxis.AngX/AngY/AngZ)
const HINGE_AXIS = 3; // 경첩 관절의 회전축은 엔진 안에서 첫 번째 회전축(AngX)으로 다룬다
const _cur = new THREE.Vector3();
const _q2 = new THREE.Quaternion();
const _qt3 = new THREE.Quaternion();
const _qt5 = new THREE.Quaternion();
const _gp = new THREE.Vector3();
const _gw = new THREE.Vector3();
const _gh = new THREE.Vector3();
const _gf = new THREE.Vector3();
const _v7 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _qt4 = new THREE.Quaternion();
const _qg = new THREE.Quaternion();
const _gA = new THREE.Vector3();
const _gB = new THREE.Vector3();
const _mG = new THREE.Vector3();
const _mV = new THREE.Vector3();
const _ik1 = new THREE.Vector3();
const _ik2 = new THREE.Vector3();
const _ik3 = new THREE.Vector3();
const _ik4 = new THREE.Vector3();
const _ik5 = new THREE.Vector3();
const _ik6 = new THREE.Vector3();
const _ik7 = new THREE.Vector3();
const _ikM = new THREE.Matrix4();
const _oaP = new THREE.Vector3(); // 유파 빈팔 (offArmSchool)
const _oaC = new THREE.Vector3();
const _oaQ = new THREE.Quaternion();
const _oaI = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _qt2 = new THREE.Quaternion();
const _mE = new THREE.Vector3();
const _mW = new THREE.Vector3();
const _mA = new THREE.Vector3();
const _mT = new THREE.Vector3();
const _mS = new THREE.Vector3();
const IDENTITY_Q = new THREE.Quaternion();
const ALONG_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2); // 세로(y) 뼈 → 앞(x)으로 눕힘
// 칼 든 팔 겉모습(dressPart·outfits.js)을 눕히는 회전. 겉모습은 "+y = 어깨 쪽, −y = 손목 쪽, +x = 앞"으로 그려지고,
//  칼 든 팔 뼈는 어깨(몸 −x 쪽)에서 손목(+x 쪽)으로 뻗는다 → 팔을 앞으로 든 것처럼 +90° 돌린다 (−y → +x, 앞 → 위).
//  콜라이더(ALONG_X, −90°)와 모양은 같고(캡슐은 대칭) 끝이 바뀐다: ALONG_X 를 그대로 쓰면 손 구체·견갑·손목 보호대가
//  팔꿈치 쪽에 그려졌다. 겉모습 전용이라 물리·시드 시뮬에는 영향이 없다
const DRESS_ALONG_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

/** 쿼터니언 → 회전 벡터(축 * 각도) */
function toRotVec(q, out) {
  const w = Math.min(1, Math.abs(q.w));
  const sgn = q.w < 0 ? -1 : 1;
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-6) return out.set(0, 0, 0);
  const angle = 2 * Math.acos(w);
  return out.set(q.x, q.y, q.z).multiplyScalar((sgn * angle) / s);
}
const _qa = new THREE.Quaternion();
// 관절 가동 범위 교정 ⓑ (anatSoft) 전용 scratch
const _ja1 = new THREE.Vector3();
const _ja2 = new THREE.Vector3();
const _ja3 = new THREE.Vector3();
const _ja4 = new THREE.Vector3();
const _ja5 = new THREE.Vector3();
const _ja6 = new THREE.Vector3();
const _jq1 = new THREE.Quaternion();
const _jq2 = new THREE.Quaternion();
const _jq3 = new THREE.Quaternion();
const _jq4 = new THREE.Quaternion();
const _qk = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _bloodColor = new THREE.Color(0x5a0808);
const _paleColor = new THREE.Color(0xb8b4a8);
const _v4 = new THREE.Vector3();
const _tiltUp = new THREE.Vector3(); // tiltDeg 전용 (driveBalance 의 _v1 과 겹치지 않게)
// R2′ 운동 사슬 전용 임시값 (다른 함수의 임시 벡터와 겹치지 않게)
const _cv1 = new THREE.Vector3();
const _cw = new THREE.Vector3();
const _cq1 = new THREE.Quaternion();
const _cq2 = new THREE.Quaternion();
const _cq3 = new THREE.Quaternion();
// 척추 비틀기 축의 윗몸 yaw 관성 어림 (kg·m², 명세 부록 A: 가슴+머리+두 팔+칼 ≈ 2.0, 복부는 그 위 전부 ≈ 2.45) — 확인표 125 의 d 를 ζ 에서 셈하는 데만 쓴다
const CHAIN_SPINE_I = { abdomen: 2.45, chest: 2.0 };
const _v5 = new THREE.Vector3();
const _mapAim = new THREE.Vector3(); // driveSword: 자세 지도 방향 사본(follow-through 뒤처짐 계산)
const _lagB = new THREE.Vector3(); // WA2-2 follow-through 뒤처짐 각
const _lagC = new THREE.Vector3();
const _edL = new THREE.Vector3(); // 날 세우기 ⓒ 미리 돌리기 scratch
const _edC = new THREE.Vector3(); // 날 세우기 edgeTwist scratch
const _enA = new THREE.Vector3(), _enB = new THREE.Vector3(), _enC = new THREE.Vector3(), _enD = new THREE.Vector3(); // 날 세우기 닿을 자리 scratch
const EDGE_NEAR_PARTS = ['head', 'chest', 'abdomen', 'pelvis', 'uarmS', 'farmS', 'uarmO', 'farmO', 'thighF', 'thighB'];
const _edT = new THREE.Vector3(); // 날 세우기 edgeTwist 돌림힘
const _cr1 = new THREE.Vector3(); // 보정 v2 ① 날 맞춤 scratch
const _cr2 = new THREE.Vector3(); // 사람 관절 범위: 아래팔 경첩 축(세계)
const _cq = new THREE.Quaternion();
const _ct1 = new THREE.Vector3(); // 보정 v2 corrTrunkTurn (순서 결합)
const _ct2 = new THREE.Vector3();
const _ct3 = new THREE.Vector3();
const _ct4 = new THREE.Vector3();
const _au1 = new THREE.Vector3(); // armU
const _au2 = new THREE.Vector3();
const _cs1 = new THREE.Vector3(); // 보정 v2 corrScale (반지름 유도)
const _cs2 = new THREE.Vector3();
const _cs3 = new THREE.Vector3();
const _cs4 = new THREE.Vector3();
const _csG = {}; // corrScale 의 guardAt 결과 (guardPose.nearest 를 건드리지 않게 따로)
const _finB = {}; // 보정 v2 마무리 명령 (finishAt): 몸
const _finH = {}; // 보정 v2 마무리 명령 (finishAt): 손·칼끝 (driveSword 한 번 안에서 손 → 칼끝이 같은 값을 읽는다)
const _wi1 = new THREE.Vector3(); // 보정 v2 쉼 무게: 옛 보정 손 목표 (driveSword)
const _wi2 = new THREE.Vector3(); // 보정 v2 쉼 무게: 옛 보정 칼끝 방향 (driveSword)
const COS_ROLL = Math.cos(HUMAN.forearmRoll * HD);
/** 칼 면 목표 t(단위, 칼에 수직)가 아래팔 돌림 범위 밖이고 −t 는 안이면 뒤집는다 (BODY.humanLimits 일 때만 부른다) */
function rollSide(t, zf) {
  if (t.dot(zf) < COS_ROLL && -t.dot(zf) >= COS_ROLL) t.negate();
}
const _ur = new THREE.Vector3();
const _urq = new THREE.Quaternion();
const _axis2 = new THREE.Vector3();
const _qt = new THREE.Quaternion();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _c4 = new THREE.Vector3();

/** 점 (px,pz) 에서 선분 (ax,az)-(bx,bz) 까지 거리 (수평면) */
function distToSegment2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
const _axis = new THREE.Vector3();
const _v2d = new THREE.Vector2();
// 지형 무대 발목 목표용 (applyPose — 지형 없으면 쓰지 않는다)
const _terrainNormal = new THREE.Vector3();
const _terrainTilt = new THREE.Quaternion();
const _terrainShin = new THREE.Quaternion();
const _terrainFoot = new THREE.Quaternion();
