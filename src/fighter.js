import { updateIntentEdgePlane, smoothIntentElevation } from './edge_intent.js';
import { applyPlaneAlignmentPotential } from './edge_torque.js';
import { updateMainArmRecovery, mainArmMuscle } from './arm_recovery_activation.js';
import { advanceRollTarget, clearRollTarget } from './roll_target.js';
import { estimateWristStopBudget } from './wrist_braking.js';
import { applyTransportedThrustPlane } from './thrust_plane.js';
import { disposeVisualTrees } from './visual_resources.js';
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
import { BODY, WEAPON, VITALS, BALANCE, SKILL_BODY, GRIP, STEEL, RECOIL, GAIT, ARMOR, ANATOMY, ARENA, COMBAT, CLOSE, ARM, SKILL } from './config.js';
import { COMBAT_HOOKS } from './combat.js';
import { Skill } from './skill.js';
import { motionAssistWeight, assistHandDepth } from './motion_assist.js';
import { assistSwordHand, assistSwordAim } from './sword_assist_v2.js';
import { updateMotionTiming } from './motion_timing.js';
import { hasSwordsmanship, resolveSwordsmanshipGoals } from './swordsmanship.js';
import { Gait, hybridJointDefs } from './gait.js';
import { guardAt, guardBaseOne } from './guards.js';
import { classifyStyle } from './weapon_class.js';
import { newFinish, updateFinish, FINISH } from './finish.js';
import { getWeapon, MATERIALS, weaponMatOpts, DEFAULT_WEAPON, BREAK } from './weapons.js';
import { breakWeaponLook } from './weapon_looks.js';
import { spawnDebris, scatterDebris, debrisEnabled } from './debris.js'; // 흩어지는 조각: 부러진 칼날 끝과 부서진 투구·판금을 한 모듈이 띄우고 치운다
// 방어구 겉모습(찌그러짐·금): 전투 쪽이 투구·판금 내구도가 바뀔 때마다 부른다
import { decorateOutfit, setHelmetWear, setPlateWear } from './outfits.js';
import { reviveOf, tryRevive, reviveTick } from './revive.js';
import { limbSeverCandidate, detachLimb, disableMissingLegSupport } from './limb_sever.js';
import { collectSupportContacts } from './support_contacts.js';
import { applyAxialLegSupport } from './support_transfer.js';

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

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const HELD_MOVE = Object.freeze({ x: 0, y: 0 }); // 발이 묶인 동안 읽는 조종 입력 (feetHeld)
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const toV = (v) => _v3.set(v.x, v.y, v.z);
const RIGHT_LOCAL = new THREE.Vector3(0, 0, 1);
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
function guardDir(x, y) {
  // 들어 올릴수록 칼이 선다: 가슴 높이(0.1) 수평, 머리 위(0.6)에서 약 95°(살짝 뒤로)
  const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
  // 옆으로 뺄수록 칼이 그쪽으로 눕는다 (칼 든 쪽은 더 크게 뺄 수 있다)
  const az = THREE.MathUtils.clamp((x - 0.05) * 1.7, -1.1, 1.3);
  const c = Math.cos(el);
  return [c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}

export class Fighter {
  /**
   * @param {object} o
   * @param {number} o.index  0 = 플레이어, 1 = 상대
   * @param {number} o.x       시작 x 위치
   * @param {number} o.heading 처음 바라보는 방향(라디안). 0 = +x
   * @param {object} o.look    겉모습(색, 투구 등) — looks.js 참고
   */
  constructor(RAPIER, world, scene, colliderInfo, o) {
    this.R = RAPIER;
    this.world = world;
    this.index = o.index;
    this.name = o.name;
    this.side = 1; // 오른손잡이
    this.heading = o.heading ?? 0;
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
    this.colliderInfo = colliderInfo;
    this.armed = true;
    this.balance = 100; // 휘청임 게이지: 세게 맞으면 줄고, 바닥나면 넘어진다
    this.offBalance = 0; // 무게중심이 발 밖으로 벗어난 거리 (m)
    this.offBalanceTime = 0;
    this.stumble = new THREE.Vector2(); // 균형을 잡으려고 자동으로 딛는 걸음 (몸 기준)
    this.state = 'stand'; // stand | down | getup | dead
    this.stateTime = 0;
    this.fightT = 0; // 판이 시작된 뒤 흐른 시간 (step 이 센다. 판마다 새로 만들어져 0부터)
    this.muscle = 1; // 근육 힘 비율 (넘어지면 0 근처로)
    this.move = new THREE.Vector2(); // x: 옆걸음(+오른쪽), y: 앞(+)/뒤(-). 각각 -1 ~ 1
    // 근접 밀치기 (closeStep, config.js CLOSE). 기본은 끔: main.js 가 플레이어에, ai.js 가 persona.close 있는 AI 에 켠다
    this.canShove = false;
    this.stickX = 0; // 스틱 원값 (감정 배수·검술 층 덮어쓰기 전). 플레이어는 main.js, AI 는 moveFeet 가 쓴다
    this.stickY = 0;
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
    this.bodyPose = { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 };
    this.bodyPoseVel = { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 };
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
    const origin = new THREE.Vector3(o.x, 0, 0);
    const toWorld = (p) => new THREE.Vector3(...p).applyQuaternion(yaw).add(origin);

    const myBody = bodyBit(this.index);
    const otherBody = bodyBit(1 - this.index);
    const otherWeapon = weaponBit(1 - this.index);
    const bodyGroups = groups(myBody, BIT.ground | otherBody | otherWeapon);
    const footGroups = groups(footBit(this.index), BIT.ground | otherWeapon);
    const weaponGroups = groups(weaponBit(this.index), BIT.ground | otherBody | otherWeapon | footBit(1 - this.index));

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
        .setCollisionGroups(d.foot ? footGroups : bodyGroups);
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
    for (const ax of MOTOR_AXES) this.uprightJoint.rawSet.jointConfigureMotorModel(this.uprightJoint.handle, ax, 1); // 1 = 힘(N·m) 기준


    // ── 무기: 데이터 중심 무기고(weapons.js)에서 무기 하나를 골라 만든다 ──
    //  기본값(o.weapon 없음)은 그대로 롱소드라서 기존 시뮬 결과가 바뀌지 않는다.
    const spec = getWeapon(o.weapon || DEFAULT_WEAPON);
    this.weapon = spec;
    // These thin two-hand weapons spun at rest when the paired force point
    // sat outside their hilt axis. Use the actual hilt point for both fighters;
    // an explicit midpoint comparison may still override this after creation.
    this.gripPointModel = spec.id === 'monohoshizao' || spec.id === 'lightsaber' ? 'axial' : 'midpoint';
    // 이 무기를 쥔 이 싸움꾼만의 손목·팔 힘 한계 (config.js WEAPON 기본값 + 무기별 보정).
    // 칼 길이도 여기 담아서, 서로 다른 무기를 쥔 두 싸움꾼이 동시에 존재할 수 있게 한다.
    this.weaponCfg = {
      ...WEAPON,
      ...spec.controlOverrides,
      bladeLength: spec.bladeLength,
      hiltLength: spec.hiltLength,
      gripAlong: spec.gripAlong,
      edged: spec.edged,
      spike: !!spec.spike,
      mCut: spec.mCut,
      mThrust: spec.mThrust,
      mBlunt: spec.mBlunt,
      power: spec.power, // 등급 공격력 배율 (롱소드=1)
      ignoreArmor: spec.ignoreArmor,
      twoHand: spec.twoHand,
      thrustStyle: spec.thrustStyle ?? null, // 찌르기 무기의 찌르기 장점 (weapons.js THRUST_STYLE)
    };
    this.weaponBroken = false;
    this.guardPose.oneHand = this.bodyGuard.oneHand = !!spec.oneHandStance; // 한손 무기는 한손 자세표 (guards.js: 칼 든 어깨를 앞으로, 손을 더 뻗는다. weapons.js oneHandStance)
    // 우화 f53b330/9763484의 한손 자세표와 선택 규칙을 이식한다.
    // 찌르기/두루 무기는 THRUST, 베기/둔기 등은 SABRE 표. 두손의 기존 표는 유지한다.
    const gStyle = classifyStyle(spec);
    this.guardPose.table = this.bodyGuard.table = spec.oneHandStance ? guardBaseOne(gStyle) : undefined;
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
        this.bladeBaseColor = mesh.material.color.clone(); // 무기마다 다른 밑색 — bloodyBlade가 여기서부터 피 색으로 섞는다
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
    this.swordGroup = group;
    this.swordMass = sword.mass();
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
  guardWeight() {
    return Math.min(1, this.skill.level * 1.6);
  }

  // Separate body coordination from the legacy hand/direction pose replacement.
  bodyGuardWeight() {
    if (hasSwordsmanship(this)) return 1; // resolved snapshot already includes the raw body share
    return this.motionAssistModel === 'coordinated' ? motionAssistWeight(this) : this.guardWeight();
  }

  /**
   * 몸의 자세 목표 (골반·가슴 틀기, 숙이기, 낮추기). 손가락 입력을 "거르기 전" 값으로 곧바로 따라가서
   * 손(걸러진 값)보다 먼저 움직인다 → 골반 → 가슴 → 팔 → 칼 순서로 힘이 이어진다 (실제 베기의 순서).
   */
  updateBodyPose(dt) {
    const sk = this.skill;
    const gw = this.bodyGuardWeight();
    const G = guardAt(sk.aimRaw.x, sk.aimRaw.y, this.bodyGuard, this.finish, sk.thrustPose);
    const bp = this.bodyPose;
    const bv = this.bodyPoseVel;
    // 딱 멈추는(임계 감쇠) 2차 필터: 출발도 멈춤도 매끄럽다 (1차 필터는 출발 순간 속도가 튄다)
    const follow = (key, target, w) => {
      bv[key] += (w * w * (target - bp[key]) - 2 * w * bv[key]) * dt;
      bp[key] += bv[key] * dt;
    };
    if (hasSwordsmanship(this)) {
      const goals = this.swordsmanshipState.body;
      const speed = SKILL_BODY.holdSpeed + (1 - SKILL_BODY.holdSpeed) * sk.activity;
      follow('pelvisYaw', goals.pelvisYaw, SKILL_BODY.pelvis * speed);
      follow('chestYaw', goals.chestYaw, SKILL_BODY.chest * speed);
      follow('pitch', goals.pitch, SKILL_BODY.chest * speed);
      follow('drop', goals.drop, SKILL_BODY.pelvis * speed);
      this.pelvisYawOffset = bp.pelvisYaw;
      this.pelvisDropOffset = bp.drop;
      return;
    }
    // 벨 때는 온몸을 크게, 자세만 고칠 때는 팔 위주로 (몸통을 조금만, 느리게 튼다) → 자세를 옮길 때마다 몸이 춤추지 않게
    const act = sk.activity;
    const amp = SKILL_BODY.holdAmount + (1 - SKILL_BODY.holdAmount) * act;
    const spd = SKILL_BODY.holdSpeed + (1 - SKILL_BODY.holdSpeed) * act;
    if (this.motionAssistModel === 'coordinated') {
      // One shared gesture reference: the pelvis takes a small portion of the
      // existing hand-side turn, chest starts from the unfiltered request.
      // The ordinary raw chest term in applyPose supplies the remaining share.
      // A pose-table facing angle is not an independent second command here.
      const turn = -sk.aimRaw.x * 0.35;
      const timing = updateMotionTiming(this, dt, turn * 0.5 * gw, turn * gw, gw);
      follow('pelvisYaw', turn * 0.5 * gw, SKILL_BODY.pelvis * spd);
      follow('chestYaw', timing ? timing.chest : turn * gw, SKILL_BODY.chest * spd);
      follow('pitch', 0, SKILL_BODY.chest * spd);
      follow('drop', 0, SKILL_BODY.pelvis * spd);
      this.pelvisYawOffset = bp.pelvisYaw;
      this.pelvisDropOffset = bp.drop;
      return;
    }
    // 골반은 아직 발 위치를 바꾸지 못해서(발 딛기 방향 전환 전) 교본 값의 절반만 튼다
    follow('pelvisYaw', -G.pelvisYaw * 0.5 * gw * amp, SKILL_BODY.pelvis * spd);
    follow('chestYaw', -G.chestYaw * gw * amp, SKILL_BODY.chest * spd);
    follow('pitch', G.pitch * gw, SKILL_BODY.chest * spd);
    follow('drop', (G.drop - 0.06) * gw, SKILL_BODY.pelvis * spd);
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
  // Seed the optional player's first command before physics starts. A forward,
  // horizontal ready blade avoids importing the old raw pad's downward aim.
  // Keep live input, AI, guns and ordinary/two-hand starts on their own paths.
  initializeOnehandReadyPose() {
    if (this.index !== 0 || this.onehandArmModel !== 'manual' || !this.guardPose.oneHand || this.weaponCfg.twoHand || this.weapon.gun || this.fightT !== 0) return;
    if (this.handOffset.x !== 0.15 || this.handOffset.y !== 0 || this.handHeld || this.inputActive) return;
    this.handOffset.set(0.15, 0.1);
    for (const v of [this.skill.prev, this.skill.aim, this.skill.anchor, this.skill.aimRaw]) v.copy(this.handOffset);
    // A level point need not put the hand above the shoulder. These are modest
    // game ready positions, not reconstructions of one universal historical guard.
    const ready = this.weapon.id === 'rapier' ? [0.51, 0.10, 0.03]
      : this.weapon.id === 'sabre' ? [0.50, 0.08, 0.06] : [0.50, 0.10, 0.05];
    const R = WEAPON.reach;
    const raw = new THREE.Vector3(0.12 + 0.5 * Math.sqrt(1 - (0.15 ** 2 + 0.1 ** 2) / R ** 2), 0.2, 0.25);
    this.calibrateOnehandReach(raw);
    this.onehandReady = { delta: new THREE.Vector3(...ready).sub(raw), travel: 0, weight: 1 };
    this.handBase = ready.slice(); // A tap may arrive before the first physics step.
    const c = this.bodies.chest.translation();
    const cq = new THREE.Quaternion().copy(this.bodies.chest.rotation());
    this.handTarget.set(...ready).applyQuaternion(this.yaw).add(new THREE.Vector3(c.x, c.y, c.z));
    this.armIK(this.handTarget);
    // Configure the spawn once, after the joint reference frames exist. Keep
    // every joint anchor coincident; live play continues through native muscles.
    const shoulder = new THREE.Vector3(...ARM.shoulder).applyQuaternion(cq).add(new THREE.Vector3(c.x, c.y, c.z));
    const uq = cq.clone().multiply(this.jointByName.uarmS.target);
    const elbow = shoulder.clone().add(new THREE.Vector3(ARM.upper, 0, 0).applyQuaternion(uq));
    const fq = uq.clone().multiply(this.jointByName.farmS.target);
    const wrist = elbow.clone().add(new THREE.Vector3(0.265, 0, 0).applyQuaternion(fq));
    this.bodies.uarmS.setTranslation(vecArg(shoulder.clone().add(new THREE.Vector3(0.15, 0, 0).applyQuaternion(uq))), true);
    this.bodies.uarmS.setRotation(vecQ(uq), true);
    this.bodies.farmS.setTranslation(vecArg(elbow.clone().add(new THREE.Vector3(0.135, 0, 0).applyQuaternion(fq))), true);
    this.bodies.farmS.setRotation(vecQ(fq), true);
    const aim = new THREE.Vector3(...guardDir(0.15, 0.1)).applyQuaternion(this.yaw);
    this.sword.setTranslation(vecArg(wrist), true);
    const flat = RIGHT_LOCAL.clone().applyQuaternion(this.yaw).addScaledVector(aim, -RIGHT_LOCAL.clone().applyQuaternion(this.yaw).dot(aim)).normalize();
    const edge = new THREE.Vector3().crossVectors(aim, flat).normalize();
    this.sword.setRotation(vecQ(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge, aim, flat))), true);
    this.aimDirW.copy(aim);
    this.prevAim = aim.clone();
    this.trackBlade(0);
  }

  calibrateOnehandReach(handLocal) {
    if (this.onehandReachScale === undefined) {
      const home = guardAt(...SKILL.homeGuard, { oneHand: true, table: this.guardPose.table });
      const [hx, hy] = SKILL.homeGuard;
      const hd = 0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (hx * hx + hy * hy) / (WEAPON.reach ** 2)));
      const rawReach = Math.hypot(hd - ARM.shoulder[0], hy, 0.1 + hx - this.side * ARM.shoulder[2]);
      const guardReach = Math.hypot(home.hand[0] - ARM.shoulder[0], home.hand[1] - ARM.shoulder[1], home.hand[2] - this.side * ARM.shoulder[2]);
      this.onehandReachScale = guardReach / rawReach;
    }
    handLocal.sub(_v6.set(ARM.shoulder[0], ARM.shoulder[1], this.side * ARM.shoulder[2]))
      .multiplyScalar(this.onehandReachScale).add(_v6);
  }

  // Prepare the one shared command before body/hand readers. Ordinary games
  // retain the original mapping and calculation order below.
  prepareSwordsmanship(dt) {
    if (!hasSwordsmanship(this)) return;
    const s = this.swordsmanshipState;
    const off = this.skill.aim, R = WEAPON.reach;
    const raw = s.workHand ||= new THREE.Vector3();
    const home = s.workHome ||= new THREE.Vector3();
    const aim = s.workAim ||= new THREE.Vector3();
    const homeAim = s.workHomeAim ||= new THREE.Vector3();
    const map = (x, y, out) => out.set(0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x*x+y*y)/(R*R))), 0.1+y, 0.1+x);
    map(off.x, off.y, raw);
    map(...s.profile.homePad, home);
    if (this.onehandArmModel === 'manual' && this.guardPose.oneHand && !this.weaponCfg.twoHand) {
      this.calibrateOnehandReach(raw);
      this.calibrateOnehandReach(home);
      if (this.onehandReady) {
        const r = this.onehandReady;
        r.travel = Math.max(r.travel, Math.hypot(off.x - 0.15, off.y - 0.1));
        const t = Math.min(1, r.travel / 0.30);
        r.weight = 1 - t*t*(3-2*t);
        raw.addScaledVector(r.delta, r.weight);
        home.addScaledVector(r.delta, r.weight);
      }
    }
    aim.set(...guardDir(off.x, off.y));
    homeAim.set(...guardDir(...s.profile.homePad));
    resolveSwordsmanshipGoals(this, dt, raw, aim, home, homeAim);
  }

  step(dt) {
    this.lastDt = dt;
    this.stateTime += dt;
    this.updateState(dt);

    // 상태에 따른 근육 힘 목표치
    let targetMuscle = 1;
    if (this.state === 'down') targetMuscle = 0.1;
    else if (this.state === 'dead') targetMuscle = 0.02;
    else if (this.state === 'getup') targetMuscle = Math.min(1, 0.35 + this.stateTime / this.kneelTime);
    if (this.state !== 'dead') targetMuscle *= this.vigor;
    updateMainArmRecovery(this, dt, targetMuscle);
    this.muscle += (targetMuscle - this.muscle) * Math.min(1, dt * (targetMuscle > this.muscle ? 4 : 12));

    for (const { rb } of this.meshes) rb.resetForces(true), rb.resetTorques(true);
    this.jolt = Math.max(0, this.jolt - dt / RECOIL.joltTime);

    this.updateHeading(dt);
    updateFinish(this, dt); // 상대가 쓰러져 있으면 아래쪽 자세를 내려찍기로 (finish.js)
    this.skill.update(dt);
    this.prepareSwordsmanship(dt);
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
    this.trackBlade(dt);

    for (const [k, t] of this.hitCooldowns) {
      if (t - dt <= 0) this.hitCooldowns.delete(k);
      else this.hitCooldowns.set(k, t - dt);
    }
    this.fightT += dt;
  }

  /** 판 시작 뒤 ARENA.startHold 초 동안 발이 묶였나 (사장님 9/30: 시작 2초 뒤 움직여). 걷기·기술 걸음·자세 고쳐 딛기만 막고 팔·칼·균형 걸음(stumble·닿지 않는 발)은 그대로 */
  get feetHeld() {
    return this.fightT < ARENA.startHold - 1e-6;
  }

  // 상태: stand(서 있음) → down(완전히 쓰러짐) → getup(무릎 꿇고 → 일어섬) → stand
  //       kneel: 다리를 크게 다쳐 무릎 꿇은 채로 버팀(칼은 쓸 수 있다)
  updateState(dt) {
    this.updateVitals(dt);
    if (this.state === 'dead') return;
    if (this.missingSupportLeg) {
      if (this.state !== 'down') this.setState('down');
      return;
    }
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
      else if (this.legHealth < 0.25) this.knockDown(false); // 다리가 버티지 못해 주저앉는다
    } else if (this.state === 'down') {
      if (this.stateTime > this.downTime && this.consciousness > 0.3) this.setState('getup');
    } else if (this.state === 'getup') {
      if (this.stateTime > this.kneelTime) {
        // 무릎 꿇은 자세에서 일어서기. 다리가 못 버티면 무릎 꿇은 채로 남는다
        if (this.legHealth < 0.25) this.setState('kneel');
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

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  /**
   * 넘어지기. heavy = 크게 맞거나 완전히 균형을 잃음 → 인형처럼 쓰러짐.
   * 아니면 무릎이 꺾여 주저앉았다가(무릎 꿇기) 다시 일어난다.
   */
  knockDown(heavy = true) {
    if (this.missingSupportLeg) heavy = true;
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

  die(cause, finishingStrike = false) {
    if (this.state === 'dead') return;
    // Preserve the old no-revival rule only when a committed finishing stab
    // actually causes a fatal wound. A survived hit sets no lasting status;
    // later bleeding/concussion and unrelated hits retain ordinary revival.
    if (!finishingStrike && tryRevive(this, cause)) return;
    this.causeOfDeath = cause;
    this.setState('dead');
  }

  // ── 출혈·의식·통증 ──
  updateVitals(dt) {
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
    if (this.detachedParts?.has(h.part)) return;
    if (this.state === 'dead' || this.revival) return; // 부활하는 동안엔 상처를 받지 않는다
    const sev = h.severity;
    const Z = h.zone;
    // 날이 살을 갈랐나. 보통은 찌르기·베기 = 문턱을 넘음 (못 넘으면 combat.js 가 멍으로 바꿔 보낸다). 내려찍기 즉사 찌르기(h.finish)만
    //  문턱을 못 넘어도 찌르기로 온다 — 그땐 판·옷·상처를 막힌 타격(멍)처럼 적는다 (판을 뚫었다·옷이 찢겼다·빈 상처로 적지 않는다)
    const bit = h.type !== 'blunt' && sev > 0;
    // 통증과 휘청임 (에너지가 클수록)
    this.pain = Math.min(2, this.pain + sev * 0.8 + h.energy / 150);
    this.balance -= h.energy * VITALS.staggerPerJoule;

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
    //  찌르기로 닿았다 (combat.js analyze 의 finish) → 즉사. 옷·살·판금·투구 문턱은 따지지 않는다.
    //  판금·투구가 칼을 막아 튕겨 내는 것(analyze 의 pass → 물리 필터·rebound)은 그대로 — 막는 건 물리, 죽음은 이 규칙.
    //  찍기 즉사는 참수처럼 되살아나지 않는다 (디렉터 10/1): die → tryRevive 가 원인 '내려찍기'를 부활로 바꾸지 않는다 (revive.js)
    if (h.finish) this.die('내려찍기');

    if (!bit) {
      if (Z === 'head' || Z === 'neck') {
        const k = h.helmet ? h.helmetBlunt : 1;
        this.consciousness -= h.energy * VITALS.concussionPerJoule * k;
        if (h.energy * k > 45) this.knockDown(h.energy * k > 90); // 머리를 세게 맞으면 주저앉거나 쓰러진다
        this.daze = Math.min(1, (this.daze || 0) + h.energy * k / 100); // 멍함
      }
      return;
    }

    // 베기/찌르기 → 상처 + 출혈. 찌르기는 ×1.6 (가슴 찌르기 +0.25 는 이것과 겹쳐 지움 — 사장님 9/30 14:30, 128판 0회)
    const bleedPerSev = h.bleedPerSev;
    const bleed = sev * bleedPerSev * (h.type === 'stab' ? 1.6 : 1);
    this.bleed += bleed;
    this.wounds.push({ part: h.part, type: h.type, severity: sev, bleed, local: h.local.clone() });

    // 치명상
    if (Z === 'neck' && sev > 0.5) {
      // 참수 (COMBAT.decapitate): 칼이 목을 가르고 지나간 베기만. 튕긴 충돌·찌르기·둔기·총은 아니다
      const decap = COMBAT.decapitate && h.type === 'cut' && h.pass && h.passing;
      if (decap) this.decapitate(sev, bleed);
      this.die('목', !!h.finishingStrike);
      if (decap) COMBAT_HOOKS.onDecapitate?.(this, this.bodies.head);
    } else if (Z === 'head' && ((h.type === 'cut' && sev > 0.8) || (h.type === 'stab' && sev > 0.5))) this.die('머리', !!h.finishingStrike);

    // 팔다리 기능
    const limb = { uarmS: 'armS', farmS: 'armS', uarmO: 'armO', farmO: 'armO', thighF: 'legF', shinF: 'legF', footF: 'legF', thighB: 'legB', shinB: 'legB', footB: 'legB' }[h.part];
    if (limb) {
      this.limbs[limb] = Math.max(0, this.limbs[limb] - sev * 0.7);
      if (limb === 'armS' && this.limbs.armS < VITALS.dropSwordArm) this.dropSword();
    }
    const sever = limbSeverCandidate(this, h);
    if (sever) detachLimb(this, sever, h, bleed);
    if (Z === 'head' && h.type === 'cut') this.consciousness -= sev * 0.5;
  }

  /**
   * 참수: 목 관절(가슴 → 머리)을 뗀다. 물리 스텝 밖(combat.afterStep → strike → applyWound)에서만 불린다.
   *  머리 몸·콜라이더·겉모습(얼굴·눈·머리카락·투구)은 그대로 — 머리는 칼·끌림이 준 속도 그대로 날아간다(더하는 힘 없음).
   *  몸통엔 목 단면 상처(stump, 가슴 기준 목 관절 자리): 목 상처와 같은 출혈. 되살아나지 않는다(revive.js tryRevive)
   */
  decapitate(sev, bleed) {
    const J = this.jointByName.head;
    const a = J.joint.anchor1(); // 가슴 몸 기준 목 관절 자리
    this.world.removeImpulseJoint(J.joint, true);
    this.joints.splice(this.joints.indexOf(J), 1); // 근육을 더는 걸지 않는다 (applyPose 의 J.head 목표 쓰기는 아무 데도 안 간다)
    J.joint = null;
    this.decapitated = true;
    this.bleed += bleed;
    this.wounds.push({ part: 'chest', type: 'cut', severity: sev, bleed, local: new THREE.Vector3(a.x, a.y, a.z), stump: true });
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
    // 벗겨진 투구의 geometry/material은 이번 판 소유, 공유 texture는 유지한다.
    for (const m of this.meshes) if (m.kind === 'loose' && m.group.parent) {
      m.group.removeFromParent();
      disposeVisualTrees([m.group]);
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
    const at = THREE.MathUtils.clamp(this.weapon.breakAt ?? BREAK.at, 0.05, 0.95);
    const cutY = cfg.hiltLength + at * cfg.bladeLength;
    this.trimSword(cutY);
    cfg.bladeLength *= at; // 칼끝 계산(bladePoint)·판정(combat.js t)·마무리 간격(finish.js)이 새 길이를 쓴다
    if (BREAK.stubEdge) {
      cfg.mCut *= BREAK.stubCut;
      cfg.mThrust *= BREAK.stubThrust;
    }
    // 칼끝 자리가 한순간에 옮겨졌다: 칼끝 속도 추정이 튀지 않게 이전 값을 버린다
    this.tipPrev = null;
    this.hitPointPrev = null;
    this.shatterLook(cutY);
  }

  /** (파손) 칼 몸체에서 칼 축 높이 cutY(손 기준, m) 너머의 콜라이더를 잘라 내고 질량·관성 값을 다시 잰다 */
  trimSword(cutY) {
    const parts = this.weapon.buildParts({}); // 질량 자료만 쓴다 (색은 안 쓴다) — 생성자와 같은 순서라 swordColliders 와 짝이 맞다
    parts.forEach(([shape, y, [pm, pc, pIe, pIt]], i) => {
      const col = this.swordColliders[i];
      if (!col) return;
      // A rigid mace head leaves with the broken shaft. No retained invisible
      // collision or head mass on the handle. Existing box trimming is unchanged.
      if (shape[0] === 'ball') {
        if (y - shape[1] >= cutY - 0.005) {
          col.setEnabled(false);
          col.setCollisionGroups(0);
          col.setMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
        }
        return;
      }
      if (shape[0] !== 'box') return;
      const [, hx, hy, hz] = shape;
      const lo = y - hy;
      if (y + hy <= cutY) return; // 절단선 아래 부품 (자루·코등이·폼멜)
      if (lo >= cutY - 0.005) {
        col.setEnabled(false); // 통째로 떨어져 나간 부품 (지금 무기엔 없다)
        col.setCollisionGroups(0); // 동적 몸체의 비활성 콜라이더도 접촉 응답에서 확실히 제외
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
    // Gait.update calls this while driveBalance still holds its forward axis in _v1.
    const up = _tiltUp.set(0, 1, 0).applyQuaternion(_q1);
    const ref = this.anchorUp || UP;
    return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.dot(ref), -1, 1)));
  }

  // 골반을 떠받치고, 몸을 세우고, 걷게 한다.
  driveBalance(dt) {
    if (this.missingSupportLeg) {
      disableMissingLegSupport(this);
      this.supportContacts = null;
      if (this.balanceProbe) Object.assign(this.balanceProbe, { supportModel: BODY.supportModel,
        supportTransfer: null, actualFootSupport: null, actualAnySupport: null, uprightScale: 0 });
      return;
    }
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
    const mvIn = this.feetHeld ? HELD_MOVE : this.move; // 시작 정지: 조종 입력(플레이어·AI·기술 내딛기)만 0, 균형 잡는 걸음(stumble)은 그대로
    const mv = this.state === 'stand' ? { x: mvIn.x * (1 - st.length()) + st.x, y: mvIn.y * (1 - st.length()) + st.y } : { x: 0, y: 0 };
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
    const axialSupport = BODY.supportModel === 'axial';
    const contacts = axialSupport ? collectSupportContacts(this, { detail: false }) : null;
    const footSupport = !!contacts && (contacts.groups.footF.hasSupport || contacts.groups.footB.hasSupport);
    this.supportContacts = contacts;
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
    // Optional observation, never read by control logic: appliedUpN/horizontal* are applied forces.
    // baseSupportN/heightSpringN/verticalDampingN are demands BEFORE muscle scaling and clamping.
    const probe = this.balanceProbe;
    if (probe) Object.assign(probe, { appliedUpN: 0, baseSupportN: 0, heightSpringN: 0, verticalDampingN: 0, horizontalXN: 0, horizontalZN: 0, nominalWeightN: M * g, footReaction: BODY.footReaction,
      supportModel: BODY.supportModel, supportTransfer: null, actualFootSupport: footSupport,
      actualAnySupport: contacts?.anySupport ?? null, uprightScale: null });

    // 다리 근육이 "골반은 위로, 발은 아래로" 민다. 발이 땅을 딛고 있으면 땅이 되받아쳐서 몸이 선다.
    // 발이 공중이면 아무것도 받쳐주지 않으니 그대로 주저앉는다. (보이지 않는 줄에 매달려 있지 않다)
    // 몸 전체가 함께 가속되도록 힘을 골반과 상체에 무게 비율대로 나눈다
    // (골반만 밀면 막대 아래만 잡아당긴 것처럼 상체가 뒤로 젖혀진다)
    const chest = this.bodies.chest;
    const push = (fx, fy, fz) => {
      const up = BODY.upperShare; // 가슴(+머리·팔)이 몸무게에서 차지하는 비율
      pelvis.addForce({ x: fx * (1 - up), y: fy, z: fz * (1 - up) }, true);
      chest.addForce({ x: fx * up, y: 0, z: fz * up }, true);
      if (loadSum < 1e-3 || BODY.footReaction === 0) return;
      for (const [k, shin] of [['F', 'shinF'], ['B', 'shinB']]) {
        const w = load[k] / loadSum;
        const r = BODY.footReaction ?? 1;
        if (w > 0) this.bodies[shin].addForce({ x: -fx * w * r, y: -fy * w * r, z: -fz * w * r }, true);
      }
    };

    // 1) 체중 받치기 (다리를 펴는 힘)
    if (mus > 0.1 && loadSum > 0) {
      const h = hybrid ? G.h : BODY.standHeight - (1 - this.legHealth) * 0.1 - this.stanceDrop - this.crouch;
      // hybrid: 보조 힘은 몸무게의 GAIT.assist만 (일어선 직후엔 100%에서 천천히 줄인다). 나머지는 다리 관절이 받친다
      const share = hybrid ? G.supportShare(M * g) : BODY.support;
      let fy = M * g * share + BODY.supportStiffness * (h - p.y) - BODY.supportDamping * v.y;
      if (probe) Object.assign(probe, { baseSupportN: M * g * share, heightSpringN: BODY.supportStiffness * (h - p.y), verticalDampingN: -BODY.supportDamping * v.y });
      // 다친 다리는 힘을 못 쓴다 → 체중을 버틸 수 있는 한계
      const legPower = (load.F * this.limbs.legF + load.B * this.limbs.legB) / loadSum;
      const forceLimit = M * g * (1.2 + 1.3 * legPower) * Math.min(1, loadSum * 1.5);
      fy = THREE.MathUtils.clamp(fy * mus, 0, forceLimit);
      if (p.y > h + 0.25) fy = 0;
      if (axialSupport) {
        const transfer = applyAxialLegSupport(this, fy, contacts, load, forceLimit * mus);
        if (probe) { probe.appliedUpN = 0; probe.supportTransfer = transfer; }
      } else {
        if (probe) probe.appliedUpN = fy;
        push(0, fy, 0);
      }
    }

    // 2) 걷기: 딛고 있는 발로 땅을 밀어서 나아간다 (발이 떠 있으면 못 민다, 미끄러우면 미끄러진다)
    const dvx = want.x - v.x;
    const dvz = want.z - v.z;
    const grip = Math.min(1, loadSum * 1.5);
    const lim = M * (hybrid ? GAIT.maxAccel : BODY.maxAccel) * grip; // 사람이 발로 낼 수 있는 가속에는 한계가 있다 (다리로 서면 몸이 무거워 조금 더 느리게)
    const groundGate = axialSupport && !footSupport ? 0 : 1;
    const fx = THREE.MathUtils.clamp(M * BODY.moveAccel * dvx, -lim, lim) * mus * groundGate;
    const fz = THREE.MathUtils.clamp(M * BODY.moveAccel * dvz, -lim, lim) * mus * groundGate;
    if (probe) { probe.horizontalXN = fx; probe.horizontalZN = fz; }
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
    if (this.state === 'stand' && this.pelvisYawOffset) anchorQ = _qt.setFromAxisAngle(UP, this.heading + this.pelvisYawOffset);
    if (al > 1) {
      const ang = Math.atan(al / (M * g)) * BODY.accelLean;
      _axis2.set(this.accelLean.z / al, 0, -this.accelLean.x / al);
      anchorQ = _qt5.setFromAxisAngle(_axis2, ang).multiply(anchorQ);
    }
    this.anchor.setNextKinematicRotation(vecQ(anchorQ));
    this.anchorUp = (this.anchorUp || new THREE.Vector3()).set(0, 1, 0).applyQuaternion(anchorQ);
    const hold = THREE.MathUtils.clamp(1 - this.offBalance / BALANCE.fallRange, 0.15, 1);
    const assist = BODY.uprightAssist * mus * hold * (0.3 + 0.7 * Math.min(1, loadSum)) * (axialSupport && !contacts.anySupport ? 0 : 1);
    if (probe) probe.uprightScale = assist;
    const raw = this.uprightJoint.rawSet;
    for (const ax of MOTOR_AXES) {
      const r = this.uprightRelax(ax); // 휘두르거나 부딪히는 동안 덜 붙잡기 (실험, 기본 1)
      raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, BODY.uprightStiffness * assist * r, BODY.uprightDamping * assist * r);
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
      if (this.detachedParts?.has(name)) continue;
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
    const w0 = Math.sqrt(9.81 / Math.max(0.5, com.y));
    const cpx = com.x + vel.x / w0;
    const cpz = com.z + vel.z / w0;
    // 걷는 중엔 무게중심이 발보다 앞서는 게 정상이다(다음 발로 받는다).
    // 그래서 가려는 방향으로 "다음 발을 디딜 자리"까지는 안전하다고 본다.
    const planX = (want.x / w0) * 1.3;
    const planZ = (want.z / w0) * 1.3;
    // 발바닥 위치 (땅에 닿은 발만)
    const a = this.solePoint('footF', _c3);
    const b = this.solePoint('footB', _c4);
    const ga = a.y < 0.09;
    const gb = b.y < 0.09;
    // 발마다 "체중을 받을 수 있는 정도": 땅에 닿아 있고(높이) 몸 아래에 있을수록(수평 거리) 크다
    const pp = this.bodies.pelvis.translation();
    const loadOf = (f) => {
      const grounded = THREE.MathUtils.clamp((0.16 - f.y) / 0.08, 0, 1);
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
    if (kn > 0) {
      const K = (name, a) => J[name].target.slerp(_qk.setFromAxisAngle(Z_AXIS, a), kn);
      K('thighF', 1.25);
      K('shinF', -1.45);
      K('footF', 0.2);
      K('thighB', -0.15);
      K('shinB', -1.75);
      K('footB', 0.8); // 뒷발은 발끝으로 땅을 짚는다
    }
    const setZ = (name, a) => J[name].target.setFromAxisAngle(Z_AXIS, a);
    // 빈 손은 앞으로 들어 균형을 잡는다 (다친 팔은 힘없이 늘어진다)
    const armO = this.limbs.armO;
    setZ('uarmO', 0.5 * armO);
    setZ('farmO', 1.0 * armO);
    // (칼 든 팔은 driveSword의 역운동학이 정한다)
    // 척추: 걷는 방향으로 살짝 숙이고, 몸통을 다치면 웅크리고, 칼 든 손 쪽으로 허리를 튼다
    this.daze = Math.max(0, (this.daze || 0) - dt * 0.12);
    const gut = this.wounds.reduce((a, wd) => a + (wd.part === 'chest' || wd.part === 'abdomen' || wd.part === 'pelvis' ? wd.severity : 0), 0);
    const sk = this.skill;
    const bp = this.bodyPose;
    const gw = this.bodyGuardWeight();
    const bend = (this.lean || 0) - Math.min(0.45, gut * 0.3) - 0.2 * kn - bp.pitch;
    this.hunch = Math.max(0, -bend); // 일부러 앞으로 숙인 각도(라디안): 넘어짐 판정에서 뺀다
    // 가슴을 트는 각도(정면 기준): 검술 자세 지도 + (보정이 약할수록) 손이 있는 쪽으로.
    // 허리(척추)는 그중 골반이 이미 튼 만큼을 뺀 나머지만 튼다
    const chestYaw = bp.chestYaw + (1 - gw) * -sk.aim.x * 0.35 +
      (hasSwordsmanship(this) ? this.swordsmanshipState.body.directChestYaw :
        this.motionTimingModel === 'sequenced' ? this.motionTimingState?.extraChestYaw ?? 0 : 0);
    const twist = THREE.MathUtils.clamp(chestYaw - (this.state === 'stand' ? bp.pelvisYaw : 0), -0.8, 0.8);
    const spine = (name, pitch, yaw) => J[name].target.setFromEuler(_eu.set(0, yaw, pitch, 'YXZ'));
    spine('abdomen', bend * 0.5, twist * 0.45);
    spine('chest', bend * 0.5, twist * 0.55);
    // 머리: 몸통이 틀어져도 상대를 본다. 멍하면 고개가 떨어진다
    spine('head', -0.35 * this.daze, -chestYaw);
  }

  // 근육: 목표 자세로 관절을 돌린다. 모터는 물리 엔진이 한꺼번에 풀어서 떨리지 않는다.
  // 근력 한계: 목표를 "지금 자세 + (최대 회전력 / 강도)" 이내로만 잡는다 → 낼 수 있는 힘이 사람 수준으로 제한된다.
  driveJoints() {
    const legsMus = Math.max(0.15, this.muscle);
    const inv = this.lastDt > 0 ? 1 / this.lastDt : 0;
    for (const j of this.joints) {
      const n = j.name;
      const isLeg = n.startsWith('thigh') || n.startsWith('shin') || n.startsWith('foot');
      let mus = isLeg ? legsMus * (0.6 + 0.4 * this.legHealth) : Math.max(0.1, this.muscle);
      if (n === 'uarmO' || n === 'farmO') mus *= 0.15 + 0.85 * this.limbs.armO; // 다친 팔은 힘이 없다
      if (n === 'uarmS' || n === 'farmS') {
        mus = Math.max(0.1, mainArmMuscle(this));
        mus *= (0.3 + 0.7 * this.limbs.armS) * this.strength;
      }
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
          mErr *= hill(Math.sign(_rv.z - _cur.z || 1) * wRel, this.weaponCfg.elbowVmax);
        }
        const tz = _cur.z + THREE.MathUtils.clamp(_rv.z - _cur.z, -mErr, mErr);
        const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);
        raw.jointConfigureMotor(j.joint.handle, HINGE_AXIS, tz, vz, k, d);
      } else {
        for (const [i, ax] of [[0, 'x'], [1, 'y'], [2, 'z']]) {
          const t = _cur[ax] + THREE.MathUtils.clamp(_rv[ax] - _cur[ax], -maxErr, maxErr);
          const v = THREE.MathUtils.clamp((_rv[ax] - prev[ax]) * inv, -15, 15);
          raw.jointConfigureMotor(j.joint.handle, MOTOR_AXES[i], t, v, k, d);
        }
      }
      prev.copy(_rv);
    }
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
    if (this.detachedParts?.has('farmS')) return;
    if (mainArmMuscle(this) < 0.12 || this.state === 'dead') return;
    const up = this.bodies.uarmS;
    this.gravityTorque([this.bodies.farmS, this.armed ? this.sword : null], up, 0.15, _mG);
    rot(up, _qg);
    const axis = _gA.set(0, 0, 1).applyQuaternion(_qg); // 팔꿈치 경첩 축
    const mus = Math.min(1, Math.max(0.1, mainArmMuscle(this)) * (0.3 + 0.7 * this.limbs.armS) * this.strength);
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
    const mus = k / j.k;
    this.gravityTorque([this.bodies.uarmS, this.detachedParts?.has('farmS') ? null : this.bodies.farmS, this.armed ? this.sword : null], j.child, -0.15, _mG).multiplyScalar(-mus);
    // 팔꿈치를 굽히면 아래팔과 칼의 무게가 위팔을 길이 방향으로 비튼다 → 그 몫도 미리 버틴다
    //  (되먹임이 아닌 고정 보정이라 비틀기 축이 가벼워도 불안정해지지 않는다)
    const twistFF = THREE.MathUtils.clamp(_mG.dot(boneAxis), -10, 10);
    _mT.add(_mG.addScaledVector(boneAxis, -_mG.dot(boneAxis)));
    // 힘-속도 관계: 팔을 빨리 휘두를수록 어깨 힘이 빠진다
    const tlen = _mT.length();
    const cap = maxT * hill(tlen > 1e-6 ? wSw.dot(_mT) / tlen : 0, this.weaponCfg.shoulderVmax);
    if (tlen > cap) _mT.setLength(cap);
    // 비틀기: 위팔 자체의 비틀림 관성은 ≈0.003kg·m²로 아주 작다 → 안정 한계(강도 ≤10, 감쇠 ≤0.2) 안에서만
    //  (엔진 쪽 회전 감쇠(팔 몸체 1.5)가 함께 잡아줘서 조금 더 세게 걸 수 있다)
    _mT.addScaledVector(boneAxis, THREE.MathUtils.clamp(eTw * 25 - wTw * 0.8, -20, 20) + twistFF);
    // 선택형 비교: 휘두르기와 비틀기가 기존 어깨 한도를 함께 사용한다.
    // native 팔꿈치/다른 관절까지 포함한 전신 근력 한도는 아니다.
    if (this.armTorqueModel === 'sharedCap' && _mT.length() > cap) _mT.setLength(cap);
    j.child.addTorque(vecArg(_mT), true);
    j.parent.addTorque({ x: -_mT.x, y: -_mT.y, z: -_mT.z }, true);
  }

  // ── 칼 조종: 팔 근육(어깨·팔꿈치)이 손을 목표로 옮기고, 손목 근육이 칼끝 방향을 맞춘다 ──
  //  예전처럼 손을 보이지 않는 줄로 끌지 않는다. 손이 갈 곳 → 어깨·팔꿈치 각도(역운동학, IK)를 계산해서
  //  관절 근육의 목표로 준다. 칼의 무게와 관성은 팔과 몸통이 그대로 버틴다.
  driveSword() {
    if (this.wristBrakingModel === 'available') this.debug.wristStopBudget = null;
    const sword = this.sword;
    const chest = this.bodies.chest;
    const mus = mainArmMuscle(this);

    // 손 목표 위치: 가슴 앞 평면의 (좌우, 위아래) + 자동 깊이 (몸이 바라보는 방향 기준)
    const off = this.skill.aim; // 손 목표 (입력 + 검술 층의 이어 베기, 부드럽게 걸러진 값)
    const R = WEAPON.reach;
    // ① 날것의 매핑: 가운데로 모을수록 팔을 앞으로 뻗는다
    const depth = 0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (off.x * off.x + off.y * off.y) / (R * R)));
    const handLocal = _v2.set(depth, 0.1 + off.y, 0.1 + off.x);
    // ② 검술 자세 지도: 손가락 위치 → 실제 롱소드 자세의 손 위치(앞뒤 깊이 포함)와 칼끝 방향
    //  검술 보정이 셀수록 ②를 따른다 (끔 = ①만)
    const gw = this.guardWeight();
    const G = guardAt(off.x, off.y, this.guardPose, this.finish);
    const manualOnehand = this.onehandArmModel === 'manual' && this.guardPose.oneHand && !this.weaponCfg.twoHand;
    const unified = hasSwordsmanship(this) ? this.swordsmanshipState : null;
    if (unified) handLocal.copy(unified.hand);
    else if (manualOnehand) {
      // Keep manual pad movement authoritative. Calibrate radial reach from the
      // existing home guard, rather than replacing each drag by a fixed pose.
      this.calibrateOnehandReach(handLocal);
      if (this.onehandReady) {
        const r = this.onehandReady;
        r.travel = Math.max(r.travel, Math.hypot(off.x - 0.15, off.y - 0.1));
        const t = Math.min(1, r.travel / 0.30);
        r.weight = 1 - t * t * (3 - 2 * t);
        handLocal.addScaledVector(r.delta, r.weight);
      }
      // Fallen-opponent finishing takes over gradually through its existing
      // activation, instead of discarding the finishing hand/direction target.
      if (this.finish.amt > 0 && gw > 0) handLocal.lerp(_v6.set(...G.hand), gw * this.finish.amt);
    } else if (gw > 0) handLocal.lerp(_v6.set(G.hand[0], G.hand[1], G.hand[2]), gw);
    if (!unified) {
      assistHandDepth(this, handLocal, G.hand);
      assistSwordHand(this, handLocal, G.hand);
    }
    // 탭 찌르기(skill.thrustPose)는 보정이 아니라 명령이라 검술 보정 세기(gw)와 무관하게 덧씌운다 — 보정 0 에서도 찌른다.
    //  찌르기는 지금 손 목표(handBase, 덧씌우기 전)에서 뻗어 나간다 (skill.thrust)
    const hb = (this.handBase ||= [0, 0, 0]);
    hb[0] = unified ? unified.baseHand.x : handLocal.x;
    hb[1] = unified ? unified.baseHand.y : handLocal.y;
    hb[2] = unified ? unified.baseHand.z : handLocal.z;
    const th = this.skill.thrustPose;
    if (!unified && th.w > 0) handLocal.lerp(_v6.set(th.hand[0], th.hand[1], th.hand[2]), th.w);
    // 바짝 붙으면 손을 접는다 (closeReach). 근접 밀치기 중엔 접기를 lift 만큼 푼다: x' = 접은 x + (x − 접은 x)·lift.
    //  lift 0 이면 오늘 줄 그대로 (같은 float). 손이 자세 깊이에 남아 코등이·칼 팔뚝이 상대 몸통에 닿는다
    const foldX = Math.min(handLocal.x, this.closeReach());
    handLocal.x = foldX + (handLocal.x - foldX) * this.lift;
    // 누르기: 손 목표 앞뒤를 상대 가슴 앞면(d − 0.11, 가슴 반두께 partDefs chest)으로 closeW 만큼. 높이·옆은 손가락이 둔 그대로
    if (this.closeW > 0 && this.foe) handLocal.x += (this.foeDistance() - 0.11 - handLocal.x) * this.closeW;
    const c = chest.translation();
    const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));
    if (mus >= 0.12 && this.state !== 'dead') this.armIK(target);
    else this.armFull = false;
    if (mus < 0.12 || !this.armed) {
      // There is no one-step aim derivative across a disabled interval.
      // Seed it again on resumption; otherwise several down-state input steps
      // are interpreted as one frame of target motion (up to the 25 rad/s cap).
      this.prevAim = null;
      clearRollTarget(this);
      return;
    }
    const str = this.strength * mus * (0.35 + 0.65 * this.armHealth);
    const forearm = this.bodies.farmS;

    // 칼끝 방향: 손 위치가 곧 검술의 자세(가드)다.
    //  가슴 높이 가운데 → 칼끝이 상대를 겨눔(찌르기 자세)
    //  머리 위로 올리면 → 칼이 서고 조금 뒤로 누움(위에서 내려베기 준비, "지붕 자세")
    //  옆으로 빼면     → 칼이 그쪽으로 누움(가로베기 준비)
    //  허리 아래로     → 칼끝이 내려감(아래 자세)
    // 자세에서 자세로 손을 옮기면 칼이 크게(최대 100° 넘게) 돌며 베기가 된다.
    const aim = _v3.set(...guardDir(off.x, off.y));
    if (unified) aim.copy(unified.aim);
    else if (this.edgeIntentModel === 'commandedPlaneC1') smoothIntentElevation(aim, off.x, off.y);
    const aimGuideWeight = manualOnehand ? gw * this.finish.amt : gw;
    if (!unified && aimGuideWeight > 0) {
      aim.lerp(_v6.set(G.dir[0], G.dir[1], G.dir[2]), aimGuideWeight);
      if (aim.lengthSq() < 0.04) aim.set(G.dir[0], G.dir[1], G.dir[2]);
      aim.normalize();
    }
    if (!unified) assistSwordAim(this, aim, G.dir);
    if (!unified && th.w > 0) {
      aim.lerp(_v6.set(th.dir[0], th.dir[1], th.dir[2]), th.w);
      if (aim.lengthSq() < 1e-6) aim.set(th.dir[0], th.dir[1], th.dir[2]);
      aim.normalize();
    }
    aim.applyQuaternion(this.yaw);
    // 목표 방향이 도는 속도: 손목 감쇠는 이 속도를 향한다 (멈추려는 게 아니라 목표를 따라가는 감쇠)
    const wAim = _v5.set(0, 0, 0);
    if (this.prevAim && this.lastDt > 0) {
      wAim.crossVectors(this.prevAim, aim).multiplyScalar(1 / this.lastDt);
      if (wAim.length() > 25) wAim.setLength(25);
    }
    (this.prevAim || (this.prevAim = new THREE.Vector3())).copy(aim);
    this.aimDirW.copy(aim); // 빈손이 칼자루를 어디로 밀고 당길지 (offHand)
    rot(sword, _q1);
    const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(_q1);
    const axis = new THREE.Vector3().crossVectors(blade, aim);
    const sinA = axis.length();
    const angle = Math.atan2(sinA, blade.dot(aim));
    const torque = new THREE.Vector3();
    if (sinA > 1e-5) torque.copy(axis).multiplyScalar((this.weaponCfg.aimStiffness * angle) / sinA);
    // 칼날(날 선 쪽)이 휘두르는 방향을 향하도록 비틀림 유지.
    // 칼이 거의 멈춰 있으면 칼 면이 몸 오른쪽을 보게 둔다.
    const flat = new THREE.Vector3(0, 0, 1).applyQuaternion(_q1);
    // 칼날 가운데쯤이 실제로 움직이는 방향 (손잡이 속도와 다르다: 칼은 손을 축으로 돈다)
    const bv = this.hitPointVel;
    const edgeDir = new THREE.Vector3(bv.x, bv.y, bv.z).addScaledVector(blade, -bv.dot(blade));
    // 가만히 있을 때: 칼 면이 몸 오른쪽을 본다 / 움직일 때: 날이 움직이는 쪽을 향한다.
    // 속도에 따라 둘을 부드럽게 섞는다 (딱 잘라 바꾸면 경계 속도에서 칼이 매 순간 90°씩 비틀리며 떤다)
    const flatTarget = RIGHT_LOCAL.clone().applyQuaternion(this.yaw);
    flatTarget.addScaledVector(blade, -flatTarget.dot(blade));
    if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(flat);
    flatTarget.normalize();
    if (flatTarget.dot(flat) < 0) flatTarget.negate();
    const ev = edgeDir.length();
    let moving = THREE.MathUtils.smoothstep(ev, 0.5, 2.5);
    // During this optional thrust comparison, taper motion-driven roll into
    // the existing rest plane. Ordinary cutting and force limits stay intact.
    if (manualOnehand && this.thrustEdgeModel === 'steady') moving *= 1 - th.w;
    if (moving > 0) {
      const mf = edgeDir.crossVectors(blade, edgeDir).normalize();
      if (mf.dot(flat) < 0) mf.negate();
      flatTarget.lerp(mf, moving);
      if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(mf);
      flatTarget.normalize();
    }
    // Isolated research mode; ordinary games keep their existing edge alignment.
    if (this.edgeIntentModel === 'commandedPlane' || this.edgeIntentModel === 'commandedPlaneC1') updateIntentEdgePlane(this, aim, blade, flatTarget, flat);
    if (manualOnehand && this.thrustEdgeModel === 'transported') applyTransportedThrustPlane(this, blade, flat, flatTarget);
    // Keep optional direction/thrust experiments independent of this command
    // limiter. Discard history on every bypass, including disabled muscles.
    if (this.rollTargetModel === 'bounded' && !this.edgeIntentModel &&
      this.thrustEdgeModel !== 'transported') advanceRollTarget(this, flatTarget, blade);
    else clearRollTarget(this);
    // 칼날 축(길쭉한 방향)으로 도는 회전은 관성이 아주 작아서, 큰 힘을 주면
    // 계산이 폭주해 칼이 팽이처럼 돈다. 그래서 비틀림은 아주 약하게 따로 다룬다.
    const w = angvel(sword, new THREE.Vector3());
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
        let brakingTorque = cap * this.weaponCfg.brakeEcc;
        if (this.wristBrakingModel === 'available' && (!this.armTorqueModel || this.armTorqueModel === 'legacy')) {
          const fw = forearm.angvel();
          const budget = estimateWristStopBudget({positionTorque: torque, swingOmega: wSwing,
            targetOmega: wAim, relativeOmega: w.clone().sub(new THREE.Vector3(fw.x, fw.y, fw.z)),
            axisUnit: axis.clone().divideScalar(sinA),
            gravityTorque: this.gravityTorque([sword], forearm, .13, new THREE.Vector3()),
            strengthScale: str, baseCap: cap, damping: this.weaponCfg.aimDamping,
            incomingHill: this.wristHill, dt: this.lastDt,
            vmax: this.weaponCfg.wristVmax * Math.sqrt(this.strength), eccentric: this.weaponCfg.brakeEcc, hill});
          this.debug.wristStopBudget = budget;
          // A still-accelerating full request is not evidence of zero human
          // braking capacity. Preserve the old decision instead of latching it.
          if (budget.applicable) brakingTorque = budget.opposingNm;
        }
        const brakeAcc = brakingTorque / this.swordIhand;
        const stopAngle = (toward * toward) / (2 * brakeAcc);
        // 쓰러진 상대를 내려찍을 때는 늦게 세운다 (finish.js). 마무리 찌르기가 겨눔으로 칼을 옮기는 동안(skill.plungePose)은 치는 게 아니라 예전대로 세운다
        const tap = this.skill.tap;
        const fr = this.finish.amt > 0 && aim.y < blade.y && !(tap?.down && !tap.go) ? 1 - FINISH.brakeRelief * this.finish.amt : 1;
        if (angle > stopAngle * this.weaponCfg.releaseMargin * fr) damp = this.weaponCfg.releaseDamping;
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
    const h = hill(vAlong, this.weaponCfg.wristVmax * Math.sqrt(this.strength), 0.25, this.weaponCfg.brakeEcc);
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
    const twist = new THREE.Vector3().crossVectors(flat, flatTarget).projectOnVector(blade).multiplyScalar(4 * this.twistScale);
    if (this.edgeTorqueModel === 'planePotential') applyPlaneAlignmentPotential(twist, flat, flatTarget);
    twist.addScaledVector(wTwist, -0.12 * this.twistScale);
    torque.add(twist);
    // 최종 벡터를 제한한 뒤 아래팔/가슴 반작용도 같은 벡터에서 구한다.
    if (this.armTorqueModel === 'sharedCap' && torque.length() > cap) torque.setLength(cap);
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
   * 두 마디 팔 역운동학: 손(칼자루)이 target(월드)에 가도록 어깨·팔꿈치 목표 각도를 정한다.
   * 가슴 기준 좌표에서 계산하므로, 허리가 틀어져도 손은 목표를 향한다.
   */
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
    this.armFull = Dl >= a + b - ARM.slack; // 팔이 다 펴짐 = 목표가 팔 길이 밖 (근접 밀치기 누르기 끝을 읽는다)
    const d = THREE.MathUtils.clamp(Dl, 0.08, a + b - ARM.slack);
    const Dn = D.normalize();
    // 팔꿈치는 아래·뒤·바깥쪽을 향한다
    const pole = _ik3.set(-0.25, -1, this.side * 0.5).normalize();
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
    // 선택 시험: 떨어진 두 점의 횡방향 damper는 순 couple을 만든다.
    // 가상 공통점에서 속도와 ±힘을 함께 평가해 적용 힘쌍의 순토크를 0으로 한다.
    // 손/자루의 실제 위치와 IK는 그대로이며, 일반 경로의 연산은 바꾸지 않는다.
    const paired = GRIP.reactionModel === 'paired';
    // Optional comparison: place the common force/velocity point on the actual
    // hilt axis. A midpoint off that axis lets transverse damping spin a thin
    // sword around its long axis while the second hand is still approaching.
    const handPoint = paired ? (this.gripPointModel === 'axial'
      ? pommel : _gripMid.copy(hand).add(pommel).multiplyScalar(0.5)) : hand;
    const swordPoint = paired ? handPoint : pommel;
    const vp = sword.velocityAtPoint(swordPoint);
    const vh = fo.velocityAtPoint(handPoint);
    const F = _gf.set(pommel.x - hand.x, pommel.y - hand.y, pommel.z - hand.z).multiplyScalar(GRIP.k);
    F.x += (vp.x - vh.x) * GRIP.d;
    F.y += (vp.y - vh.y) * GRIP.d;
    F.z += (vp.z - vh.z) * GRIP.d;
    F.multiplyScalar(grab);
    if (F.length() > GRIP.maxForce) F.setLength(GRIP.maxForce);
    fo.addForceAtPoint(vecArg(F), vecArg(handPoint), true);
    sword.addForceAtPoint({ x: -F.x, y: -F.y, z: -F.z }, vecArg(swordPoint), true);
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
const _gripMid = new THREE.Vector3();
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
const _qk = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _bloodColor = new THREE.Color(0x5a0808);
const _paleColor = new THREE.Color(0xb8b4a8);
const _v4 = new THREE.Vector3();
const _tiltUp = new THREE.Vector3();
const _v5 = new THREE.Vector3();
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
