// ─────────────────────────────────────────────────────────────
//  다리가 체중을 싣는 걸음 (BODY.weightMode = 'hybrid')
//
//  예전 방식('levitate'): 보이지 않는 힘이 골반을 거의 전부(몸무게의 94%) 떠받치고, 다리는 흉내만 냈다.
//  → 걸을 때 발이 땅을 미끄러지고 몸이 제 무게를 느끼지 않는 것처럼 보였다.
//
//  이 방식: 몸무게의 대부분(약 70%)을 다리 관절이 땅까지 전한다. 나머지는 예전 보조 힘이 그대로 받친다
//  (보조가 조금 남아 있어서 예전만큼 잘 넘어지지 않는다). 몸을 앞으로 보내는 힘·똑바로 세우는 힘도 예전 그대로다.
//
//   1) 딛은 발: 발을 디딘 자리(월드 좌표)를 기억하고, 다리 역운동학(IK)으로 엉덩이 → 그 자리까지 다리를 뻗는다.
//      골반이 움직여도 발은 그 자리에 붙어 있다 (미끄러지지 않는다). 발바닥은 정지 마찰처럼 붙잡는다(한계 = 마찰계수 × 실린 무게,
//      실린 무게는 걸러서 쓴다: 접촉 힘이 순간 작게 잡힐 때마다 붙잡는 자리가 끌려가면 가만히 선 발이 조금씩 밀려난다).
//   2) 골반 높이: 딛은 다리가 닿을 수 있는 높이 (뒤집힌 진자) → 두 발을 딛을 때 낮아지고 한 발 위를 지날 때 높아진다.
//      발을 막 디딘 순간 무릎이 살짝 굽으며 무게를 받는다 (하중 반응). 옆걸음·천천히 걷기엔 골반을 조금 더 출렁인다.
//   3) 걸음: 시간으로 박자를 맞추고(빠를수록 잦게, 보폭은 길게), 내딛는 발은 "몸이 갈 곳"(속도 기반, Raibert)에 놓는다.
//      한 발로 설 때마다 무게중심이 딛은 발 쪽으로 옮겨 간다 (좌우 흔들림). 아주 빠르면 무릎을 굽힌 채 종종 뛴다.
//   4) 멈추면 펜싱 자세(칼 든 쪽 발이 앞, 무릎을 살짝 굽힘)로 발을 고쳐 딛는다. 몸을 돌리면 발도 돌려 딛는다
//      (돌아서는 방향을 미리 보고 짧고 빠른 걸음으로. 돌면서 걸을 땐 방향을 틀 수 있는 만큼만 빨리 간다).
//   5) 세게 맞아 발이 끌리거나, 넘어지거나, 쓰러진 뒤에는 예전 방식(보조 힘 100%)으로 돌아갔다가,
//      일어서면 보조 힘을 부드럽게 줄이며 다리로 넘겨준다 (다리가 이미 받치는 만큼은 보조를 덜 쓴다).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BODY, GAIT } from './config.js';

const A_LEN = 0.43; // 허벅지 (엉덩이 → 무릎)
const B_LEN = 0.42; // 정강이 (무릎 → 발목)
/**
 * 'hybrid'일 때 다리 관절을 조금 바꾼다 (몸이 만들어질 때 한 번):
 *  발목을 공 관절로 → 다리가 옆으로 기울어도 발바닥이 땅에 평평하게 닿는다 (경첩이면 발 모서리로 선다)
 *  엉덩이를 조금 더 비틀 수 있게 → 딛은 발 위에서 몸을 돌릴 수 있다
 */
export function hybridJointDefs(defs) {
  for (const jd of defs) {
    if (jd.c === 'footF' || jd.c === 'footB') {
      jd.type = 'ball';
      jd.lim = { x: [-0.4, 0.4], y: [-0.3, 0.3], z: [-0.6, 0.8] }; // 옆으로 기울기, 비틀기, 앞뒤 굽히기
    }
    // 엉덩이 비틀기(안쪽·바깥쪽 돌리기)를 사람만큼 (약 45도): 딛은 발 위에서 몸을 돌릴 때 관절 한계에 걸려 발을 비틀지 않게
    if ((jd.c === 'thighF' || jd.c === 'thighB') && GAIT.hipTwist) jd.lim = { ...jd.lim, y: [-GAIT.hipTwist, GAIT.hipTwist] };
  }
  return defs;
}

const ANKLE_H = 0.062; // 발바닥이 땅에 평평하게 닿았을 때 발목 높이 (발 0.07 − 체중에 눌려 땅에 파묻히는 몫 약 0.008: 물리 엔진의 부드러운 접촉)
const SOLE_C = new THREE.Vector3(0, -0.035, 0); // 발 몸체 기준 발바닥 가운데
const SOLE_T = new THREE.Vector3(0.12, -0.035, 0); // 발끝 쪽 (뒤꿈치를 들면 여기로 버틴다)
const TOE_X = 0.17; // 발목에서 발끝(뒤꿈치를 들 때 축이 되는 곳)까지 앞으로
const SOLE_Y = 0.07; // 발목에서 발바닥까지 아래로
// 뒤꿈치를 약 0.35라디안 들었을 때 발목이 올라가는 높이·앞으로 가는 거리 (골반 높이를 정할 때 쓴다)
const HEEL_DY = TOE_X * Math.sin(0.35) + SOLE_Y * (Math.cos(0.35) - 1);
const HEEL_DX = TOE_X * (1 - Math.cos(0.35)) + SOLE_Y * Math.sin(0.35);
const HIP_DROP = 0.04; // 골반 중심에서 엉덩이 관절까지 (아래로)
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 무릎을 phi(라디안) 굽혔을 때 엉덩이~발목 거리 */
const legLen = (phi) => Math.sqrt(A_LEN * A_LEN + B_LEN * B_LEN + 2 * A_LEN * B_LEN * Math.cos(phi));
const clamp = THREE.MathUtils.clamp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** 부드러운 출발·도착 (속도·가속도 0) */
const minJerk = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));

function mkLeg(k, side) {
  return {
    k,
    side, // 몸 기준 좌우 (+1 = 오른쪽)
    thigh: 'thigh' + k,
    shin: 'shin' + k,
    foot: 'foot' + k,
    stance: true,
    plant: new THREE.Vector3(), // 딛은 자리 (발목, 월드)
    yaw: 0, // 딛은 발의 방향 (월드)
    yawTD: 0, // 디딜 때의 발 방향
    tLand: 1, // 디딘 뒤 지난 시간
    hip: new THREE.Vector3(), // 엉덩이 관절 (월드, 실제)
    ankle: new THREE.Vector3(), // 발목 (월드, 실제)
    footYaw: 0,
    soleY: 0,
    toeY: 0,
    // 내딛는 중
    t: 0,
    T: 0.4,
    p0: new THREE.Vector3(),
    p1: new THREE.Vector3(),
    yaw0: 0,
    yaw1: 0,
    lift: 0,
    kind: 'walk',
    phi: 0, // 지금 목표 무릎 굽힘
    heel: 0, // 뒤꿈치를 든 각도
    phiTD: 0, // 디딜 때의 무릎 굽힘
    hFrac: 1,
    y0: 0, // 걸음을 바꿀 때 이미 들려 있던 높이
    rel: new THREE.Vector3(), // 엉덩이에 대한 내딛는 발목 목표
    relOk: false,
    des: new THREE.Vector3(), // 내딛는 발목 목표
    desV: new THREE.Vector3(), // 그 목표가 움직이는 속도
    v0: new THREE.Vector3(), // 발을 뗄 때 발의 출발 속도
    fq: new THREE.Quaternion(), // 발 자세 (월드)
    fp: new THREE.Vector3(), // 발 위치 (월드)
    pinC: new THREE.Vector3(), // 딛을 때 발바닥 가운데가 닿은 곳 (월드)
    pinT: new THREE.Vector3(), // 발끝이 닿은 곳
  };
}

export class Gait {
  constructor(fighter) {
    this.f = fighter;
    const s = fighter.side;
    this.legs = { F: mkLeg('F', s), B: mkLeg('B', -s) };
    this.active = false;
    this.lev = 0; // 넘겨받는 중 더하는 보조 힘 비율 (1 = 예전 방식 그대로, 0 = 다리가 GAIT.assist 몫 빼고 전부)
    this.levH = 0; // 그중 일어선 직후 넘겨받기 몫 (골반 높이는 다리가 닿는 만큼만)
    this.levC = 0; // 그중 붙잡기 반사 몫 (다리가 닿지 않아도 골반을 제 높이에 둔다)
    this.handU = 1; // 넘겨받기 진행 (0 → 1)
    this.h = BODY.standHeight; // 골반 높이 목표
    this.hNom = BODY.standHeight;
    this.hv = 0;
    this.sinceTD = 1; // 마지막으로 발을 디딘 뒤 지난 시간
    this.lastTD = 'B'; // 마지막으로 디딘 발
    this.walking = false;
    this.walkT = 0; // 걷기 시작한 뒤 / 멈춘 뒤 지난 시간
    this.idleT = 0;
    this.stepT = 0.5; // 지금 걸음 박자 (한 걸음 시간)
    this.vf = new THREE.Vector3(); // 골반 수평 속도 (걸러진 값)
    this.sway = new THREE.Vector3(); // 좌우로 무게를 옮기는 속도 (want에 더한다)
    this.req = null; // 기술이 부탁한 걸음 (requestStep)
    this.settles = 0; // 멈춘 뒤 고쳐 딛은 횟수
    this.prevHead = fighter.heading;
    this.headRate = 0; // 몸을 돌리는 빠르기(rad/s)
    this.sinceEnter = 0;
    this.speedF = 0;
    this.runW = 0;
  }

  /** 서기 시작(라운드 시작, 일어선 직후): 두 발을 지금 자리에 딛고, 보조 힘을 천천히 줄인다 */
  enter() {
    this.active = true;
    this.sense();
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.stance = true;
      this.plantAt(L);
      this.footMass(L, true);
      L.tLand = 1;
    }
    // 라운드 시작: 이미 두 발로 서 있으니 바로 다리가 받친다. 일어선 직후: 보조 힘 100%에서 천천히 넘겨받는다
    this.levH = this.started ? 1 : 0;
    this.handU = this.started ? 0 : 1;
    this.levC = 0;
    this.lev = this.levH;
    this.started = true;
    this.sinceEnter = 0;
    const p = this.f.bodies.pelvis.translation();
    // 일어선 직후: 골반 높이 목표는 지금 높이에서 출발해 천천히 자세 높이로 간다 (한 번에 바꾸면 솟았다가 주저앉는다)
    this.hNomF = this.levH ? clamp(p.y, GAIT.guardHeight - 0.03, GAIT.walkHeight) : undefined;
    this.h = p.y;
    this.hv = this.levH ? clamp(this.f.bodies.pelvis.linvel().y, -0.3, 0.3) : 0;
    this.sinceTD = 0;
    this.walking = false;
    this.speedF = 0;
    this.idleT = 0;
    this.req = null;
    this.settles = 0;
    this.prevHead = this.f.heading;
    this.headRate = 0;
    this.resetRates();
  }

  exit() {
    this.active = false;
    const J = this.f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      J[l.thigh].gain = J[l.shin].gain = J[l.foot].gain = 1;
      this.footMass(l, false);
    }
    this.req = null;
  }

  // ── 몸 상태 읽기 ──
  sense() {
    const f = this.f;
    const pel = f.bodies.pelvis;
    const r = pel.rotation();
    const qP = _qP.set(r.x, r.y, r.z, r.w);
    const pt = pel.translation();
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.hip.set(0, -HIP_DROP, L.side * 0.095).applyQuaternion(qP).add(_s1.set(pt.x, pt.y, pt.z));
      const fb = f.bodies[L.foot];
      const fr = fb.rotation();
      _qF.set(fr.x, fr.y, fr.z, fr.w);
      const ft = fb.translation();
      _s1.set(ft.x, ft.y, ft.z);
      L.fq.copy(_qF);
      L.fp.copy(_s1);
      L.ankle.set(-0.05, 0.035, 0).applyQuaternion(_qF).add(_s1);
      L.soleY = _s2.set(0, -0.035, 0).applyQuaternion(_qF).add(_s1).y;
      L.toeY = _s2.copy(SOLE_T).applyQuaternion(_qF).add(_s1).y;
      const fx = _s2.set(1, 0, 0).applyQuaternion(_qF);
      L.footYaw = Math.atan2(-fx.z, fx.x);
    }
    const v = pel.linvel();
    this.vf.x += (v.x - this.vf.x) * 0.25;
    this.vf.z += (v.z - this.vf.z) * 0.25;
  }

  /**
   * 기술이 걸음을 부탁한다 (AI의 베며 내딛기). kind: 'pass'(뒷발이 앞으로 나간다) | 'lunge'(앞발을 내딛는다)
   * fwd: 몸 기준 앞으로(m), side: 오른쪽으로(m), duration: 발이 떠 있는 시간(초)
   */
  requestStep(o = {}) {
    if (!GAIT.requestSteps || !this.active || this.f.state !== 'stand') return false;
    if (this.f.feetHeld) return false; // 판 시작 정지 (ARENA.startHold): 기술 걸음도 받지 않는다
    // 물러나는 중이면 받지 않는다 (몸은 뒤로, 발은 앞으로 가면 넘어진다)
    if (this.f.move.y < -0.1) return false;
    this.req = { kind: o.kind || 'pass', fwd: o.fwd ?? 0.5, side: o.side ?? 0, duration: clamp(o.duration ?? 0.4, 0.28, 0.7), age: 0 };
    return true;
  }

  /** 몸을 turn(라디안)만큼 돌리려 할 때, 딛은 발에 대해 엉덩이가 비틀 수 있는 만큼으로 줄인다 */
  limitTurn(turn) {
    if (!turn) return turn;
    const f = this.f;
    const pel = f.heading + (f.pelvisYawOffset || 0);
    let lim = Infinity;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (!l.stance) continue;
      // 도는 쪽으로 이미 비튼 만큼 (디딜 때의 발 방향 기준: 발이 비틀려 끌려가도 한계가 따라 늘지 않게)
      const tw = wrap(pel - l.yawTD) * Math.sign(turn);
      lim = Math.min(lim, Math.max(0, GAIT.maxTwist - tw));
    }
    return Math.sign(turn) * Math.min(Math.abs(turn), lim);
  }

  /** 앞발(몸 기준 앞에 있는 발) */
  frontLeg(fwd) {
    const a = this.legs.F.plant;
    const b = this.legs.B.plant;
    return (a.x - b.x) * fwd.x + (a.z - b.z) * fwd.z >= 0 ? 'F' : 'B';
  }

  /**
   * 매 스텝(서 있는 동안) driveBalance가 부른다. want(가려는 속도, 월드)에 좌우 무게 옮기기·자리 지키기를 더하고,
   * 골반 높이 목표(this.h)를 정한다.
   */
  update(dt, want, fwd, rgt) {
    const f = this.f;
    if (!this.active) this.enter();
    else this.sense();
    // 넘겨받기: 일어선 직후엔 발을 펜싱 자세로 고쳐 딛을 때까지 보조 힘을 유지한다
    //  (무릎 꿇었던 자리 그대로 한 발로 서면 골반이 주저앉는다)
    this.sinceEnter += dt;
    const settled = !this.walking && this.legs.F.stance && this.legs.B.stance && this.sinceTD > 0.15 && !this.settleLeg(true);
    const walkedIn = this.walking && this.walkT > 0.8;
    if (this.sinceEnter > GAIT.handoverMax || settled || walkedIn) {
      // 넘겨받기는 부드럽게 (처음과 끝이 느리게: 끝에서 한 번에 다리로 넘기면 골반이 처진다)
      this.handU = Math.min(1, this.handU + dt / GAIT.handover);
      this.levH = 1 - minJerk(this.handU);
      this.levC = Math.max(0, this.levC - dt / GAIT.handover);
    }
    // 붙잡기 반사: 골반이 크게 주저앉거나 몸이 많이 기울면(세게 맞음) 보조 힘을 되살린다 → 예전 방식처럼 버틴다.
    //  보조가 커지면 딛은 발의 정지 마찰(pinFeet)도 약해져서 발이 끌려가며 버틴다
    {
      const sag = Math.max(this.h, this.hNom - 0.04) - f.bodies.pelvis.translation().y;
      const mode = GAIT.catchMode;
      const scale = mode === 'off' ? 0 : GAIT.catchScale;
      const falling = clamp((f.offBalance - GAIT.catchOff) / 0.25, 0, 1);
      const need = scale * (mode === 'fall' ? falling : Math.max(
        clamp((sag - GAIT.catchSag) / 0.08, 0, 1),
        clamp((f.tiltDeg() - GAIT.catchTilt) / 20, 0, 1),
        falling,
      ));
      // 설정을 낮추거나 끈 뒤 이전 반사가 새 강도를 넘겨 남지 않게 한다. levH는 건드리지 않는다.
      this.levC = Math.min(this.levC, scale);
      if (need > this.levC) this.levC += (need - this.levC) * Math.min(1, dt * 30);
      this.lev = Math.max(this.levH, this.levC);
    }
    // 다리가 실제로 땅을 누르는 힘 (지난 스텝, 걸러서): 넘겨받는 동안 보조 힘을 그만큼 덜 쓴다
    this.Mg = this.Mg || f.totalMass * 9.81;
    //  (딛은 발에 더한 무게(footExtra)는 땅이 바로 받치는 몫이라 뺀다)
    const Nn = Math.max(0, (this.legs.F.N || 0) + (this.legs.B.N || 0) - 9.81 * ((this.legs.F.N > 0 ? this.legs.F.extra || 0 : 0) + (this.legs.B.N > 0 ? this.legs.B.extra || 0 : 0)));
    this.Nsum = (this.Nsum ?? Nn) + (Nn - (this.Nsum ?? Nn)) * Math.min(1, dt * 20);
    const dHead = wrap(f.heading - this.prevHead);
    this.prevHead = f.heading;
    this.headRate += (dHead / dt - this.headRate) * Math.min(1, dt * 10);
    // 일어선 직후(보조 힘을 넘겨받는 중)엔 천천히 걷는다
    //  (보조가 다 빠진 뒤에도 조금 더 천천히 빨라진다: 한 번에 빨라지면 첫 걸음에 골반이 처진다)
    this.slow = Math.max(this.lev, (this.slow || 0) - dt / GAIT.handoverRamp);
    if (this.slow > 0) want.multiplyScalar(1 - GAIT.handoverSlow * minJerk(this.slow));
    // 돌면서 걸을 땐 (속도 × 도는 빠르기 = 방향을 트는 가속)이 발로 낼 수 있는 만큼만 빨리 간다
    //  (빠르게 걸으며 휙 돌면 몸이 옆으로 흘러 뒤에 남은 발이 닿지 않고 끌린다)
    if (GAIT.turnAccel > 0) {
      const vMax = GAIT.turnAccel / Math.max(0.1, Math.abs(this.headRate));
      const sp = Math.hypot(want.x, want.z);
      if (sp > vMax) want.multiplyScalar(vMax / sp);
    }
    const speed = Math.hypot(want.x, want.z);
    // 가려는 쪽의 앞뒤 몫 (+1 = 앞으로, −1 = 뒤로): 조종 입력으로 (want에는 균형 잡는 발걸음 등이 섞여 들쭉날쭉하다)
    const mv = f.feetHeld ? null : f.move; // 판 시작 정지 동안엔 조종 입력이 없는 것으로
    const foreFrac = mv && mv.lengthSq() > 1e-6 ? mv.y / mv.length() : 0;
    const backness = clamp((-foreFrac - GAIT.backFrom) / GAIT.backFull, 0, 1); // 뒤로 가는 정도 (0 ~ 1, 비스듬히 물러나는 것도)
    // 걷기 시작·멈추기 판단은 걸러진 속도로, 조금 여유를 두고 (균형 잡는 발걸음(stumble)이 매 스텝 들쭉날쭉해서
    //  걷기 ↔ 서기가 번갈아 바뀌면 발이 헛디딘다)
    this.speedF += (speed - this.speedF) * Math.min(1, dt * GAIT.walkFilter);
    const walkNow = this.walking ? this.speedF > GAIT.walkMin * 0.6 : this.speedF > GAIT.walkMin || speed > GAIT.walkMin * 2;
    if (walkNow !== this.walking) {
      this.walking = walkNow;
      this.walkT = 0;
    }
    this.walkT += dt;
    this.idleT = walkNow ? 0 : this.idleT + dt;
    if (walkNow) this.settles = 0;
    // 걸음 박자: 느리면 한 걸음 약 0.55초, 빠를수록 잦아지고 보폭이 길어진다
    const vLat = Math.abs(want.x * rgt.x + want.z * rgt.z);
    //  (비스듬히 물러날 땐 옆으로 옮기는 보폭을 줄인다: 뒤에 남는 발이 옆으로 멀어져 다리가 벌어진 채 골반이 주저앉는다)
    const sideStride = GAIT.sideStride * (1 - GAIT.backSideCut * backness);
    const cad = Math.max(GAIT.cadence0 + GAIT.cadenceK * Math.max(0, speed - 1), speed / GAIT.maxStride, (2 * vLat) / sideStride, GAIT.cadence0 * 0.9);
    const T = walkNow ? 1 / cad : GAIT.settleT / (1 - GAIT.dsFrac);
    this.stepT += (T - this.stepT) * Math.min(1, dt * 6);
    const Tds = this.stepT * GAIT.dsFrac;
    const Tsw = this.stepT - Tds;

    const L = this.legs;
    let swing = L.F.stance ? (L.B.stance ? null : L.B) : L.F;
    this.sinceTD += dt;
    for (const k of ['F', 'B']) L[k].tLand += dt;

    // ① 딛은 발이 크게 끌려갔으면(세게 맞음) 그 자리에서 다시 딛는다 (정지 마찰을 넘어 미끄러진 것)
    for (const k of ['F', 'B']) {
      const l = L[k];
      if (!l.stance) continue;
      const dx = l.ankle.x - l.plant.x;
      const dz = l.ankle.z - l.plant.z;
      if (dx * dx + dz * dz > GAIT.slipReset * GAIT.slipReset || l.soleY > 0.12) {
        this.plantAt(l);
      }
    }

    // ② 내딛는 발
    // 자세를 고쳐 딛던 중에 다시 걷기 시작하면: 지금 발 위치에서 걷는 걸음으로 바꾼다
    //  (이미 거의 딛었으면 그대로 딛는다: 무게가 실린 발을 다시 들어 옮기면 땅을 긁는다)
    //  (반 넘게 옮긴 발은 마저 딛는다: 땅 가까이 내려오는 발을 새 자리로 휙 옮기면 땅을 긁는다)
    if (swing && walkNow && swing.kind === 'settle' && swing.t > swing.T * 0.6 && swing.soleY < GAIT.convertLand) {
      this.touchdown(swing, 0);
      swing = null;
    }
    if (swing && walkNow && swing.kind === 'settle' && swing.t < swing.T * GAIT.convertMax) {
      swing.p0.copy(swing.des);
      swing.y0 = Math.max(0, swing.des.y - ANKLE_H);
      swing.p0.y = ANKLE_H;
      swing.v0.set(0, 0, 0);
      swing.T = clamp(swing.T - swing.t, GAIT.convertMinT, Math.max(GAIT.convertMinT, Tsw * 0.8)); // 이미 오래 들고 있었으면 조금 빨리 딛는다 (너무 서두르면 발이 땅을 긁는다)
      swing.t = 0;
      swing.kind = 'walk';
      swing.hFrac = 1;
    }
    // 세게 밀려 균형을 잃으면 내딛는 발을 서둘러 딛는다 (한 발로 오래 버티면 딛은 발이 들려 몸이 넘어간다)
    //  (걷기 시작·멈출 때 조금 기우는 정도(offBalance ≈ 0.3)에선 서두르지 않는다: 발이 움직이는 채로 닿아 미끄러진다)
    let hurry = GAIT.catchHurry * clamp((f.offBalance - GAIT.hurryFrom) / 0.2, 0, 1);
    // 딛은 발이 뒤로 빠져 뒤꿈치를 거의 끝까지 들었으면(다리가 곧 닿지 않는다) 내딛는 발을 서둘러 딛는다
    //  (빨리 나가기 시작할 때·뛸 때: 몸이 먼저 나가 뒤에 남은 발이 발끝으로 끌린다. 제자리에서 돌 땐 서두르지 않는다: 돌려 딛는 발이 돌아가는 채로 닿는다)
    if (swing && swing.kind === 'walk' && speed > GAIT.hurrySpeed && Math.abs(this.headRate) < 1) {
      const st = swing === L.F ? L.B : L.F;
      if (st.stance) hurry = Math.max(hurry, GAIT.reachHurry * clamp((st.heel - GAIT.heelHurry) / 0.12, 0, 1));
    }
    if (swing) {
      swing.t += dt * (swing.kind === 'req' ? 1 : 1 + hurry);
      const u = swing.t / swing.T;
      if (u < GAIT.retarget) this.target(swing, want, fwd, rgt, Math.max(0, swing.T - swing.t));
      if ((u >= 1 && swing.soleY < 0.02) || u >= 1 + GAIT.lateMax / swing.T || (u > 0.8 && swing.soleY < 0.004) || (u > GAIT.earlyTD && this.groundForce(swing) > GAIT.earlyLoad * this.Mg)) {
        // (발을 든 동안 발이 땅에 닿아 무게가 실리면(몸이 내려앉음) 그 자리에서 딛는다: 무게 실린 발을 끌고 가면 미끄러진다)
        this.touchdown(swing, speed);
        swing = null;
      }
    }

    // ③ 새 걸음 시작
    if (!swing && this.sinceTD >= Tds && f.muscle > 0.15) {
      let next = null;
      let kind = 'walk';
      let Tstep = Tsw;
      // 다리가 닿지 않을 만큼 벌어진 발은 먼저 옮긴다
      for (const k of ['F', 'B']) {
        const l = L[k];
        const hx = l.hip.x - l.plant.x;
        const hz = l.hip.z - l.plant.z;
        //  (일어선 직후처럼 "딛은" 발이 실제로는 떠 있으면 그 발부터 딛는다: 다른 발을 들면 두 발 다 떠 버린다)
        //  (서 있는 중에도 딛은 발이 발끝까지 땅에서 떠 무게가 없으면 (골반이 들려 다리가 닿지 않음) 그 발을 다시 딛는다: 공중에 뜬 채 끌려가지 않게)
        const air = l.soleY > GAIT.airFoot && (this.levH > 0 || (l.toeY > GAIT.airFoot * 0.75 && (l.N || 0) < 0.05 * this.Mg));
        if (hx * hx + hz * hz > GAIT.reachMax * GAIT.reachMax || air) next = next || k;
      }
      if (this.req && !next) {
        const front = this.frontLeg(fwd);
        next = this.req.kind === 'lunge' ? front : front === 'F' ? 'B' : 'F';
        kind = 'req';
        Tstep = this.req.duration;
      } else if (walkNow && !next) {
        // 걷기 시작: 가려는 쪽에서 뒤에 있는 발부터 (앞발부터 내딛으면 몸이 달아난다). 걷는 중: 번갈아
        //  (앞뒤로 걷기 시작할 땐 방금 디딘 발이라도 뒤에 있는 발부터: 앞발부터 내딛으면 뒷발이 닿지 않을 만큼 멀어진다)
        const fore = Math.abs(want.x * fwd.x + want.z * fwd.z) > vLat;
        if (this.walkT > this.stepT * 1.2 || (this.sinceTD < this.stepT && !(GAIT.startRear && fore))) next = this.lastTD === 'F' ? 'B' : 'F';
        else {
          const df = (L.F.plant.x - L.B.plant.x) * want.x + (L.F.plant.z - L.B.plant.z) * want.z;
          next = df > 0 ? 'B' : 'F';
        }
      } else if (next) kind = 'catch';
      else if (this.idleT > GAIT.settleDelay && !f.feetHeld) {
        // (판 시작 정지 동안엔 자세 고쳐 딛기도 미룬다. 닿지 않는 발·균형 잡는 걸음은 그대로)
        // 자리 고치기는 settleMax번까지, 몸을 돌려 발이 틀어진 것은 언제든 (발을 돌려 딛는다)
        next = this.settleLeg(this.settles < GAIT.settleMax);
        if (next) {
          kind = 'settle';
          this.settles++;
        }
      }
      // 걷는 걸음은 다른 발이 몸무게를 넘겨받은 뒤에 뗀다 (막 디딘 발이 아직 덜 실렸는데 떼면, 무게가 실린 발을 끌며 든다)
      //  (옆걸음은 빼고: 옆으로 벌려 딛은 발은 무게가 늦게 실려 기다리는 동안 다리가 벌어진다)
      if (next && kind === 'walk' && GAIT.liftLoad > 0 && vLat < 0.6 * speed && this.sinceTD < Tds + GAIT.liftWait) {
        const o = L[next === 'F' ? 'B' : 'F'];
        //  (보조 힘이 많이 받칠 땐(일어선 직후 등) 다리에 실리는 무게도 그만큼 적다)
        //  (뗄 발에 이미 무게가 거의 없으면(뒤로 빠져 떠 있음) 기다리지 않는다: 뛰듯 갈 땐 기다리는 동안 딛은 발이 끌린다)
        const need = GAIT.liftLoad * this.Mg * (1 - this.lev);
        if ((L[next].N || 0) > GAIT.liftOwn * need && (!o.stance || (o.N || 0) < need)) next = null;
      }
      if (next) {
        const l = L[next];
        if (kind === 'walk' || kind === 'catch') Tstep /= 1 + hurry;
        this.begin(l, kind, Tstep);
        this.target(l, want, fwd, rgt, Tstep);
        // 자세 고치기: 멀리 옮길수록 천천히 (휙 옮기면 딛을 때 미끄러진다)
        //  몸을 돌리느라 발을 돌려 딛는 걸음은 짧고 빠르게 (돌아서는 동안 몸이 발을 기다리지 않게)
        if (kind === 'settle') l.T = this.settleTurn ? GAIT.turnStepT : clamp(GAIT.settleT + 0.5 * l.p0.distanceTo(l.p1), GAIT.settleT, 0.6);
        swing = l;
      }
    }
    // 발을 뗀 뒤 땅에서 떨어지면 원래 무게로 (땅에 닿은 채 가벼워지면 다리 힘에 발이 휙 끌려 땅을 긁는다)
    if (swing && swing.extra && (swing.soleY > 0.015 || swing.t > 0.12)) this.footMass(swing, false);
    if (this.req) {
      this.req.age += dt;
      if (this.req.age > 1) this.req = null;
    }

    // 한 발로 서 있는데 몸이 그 발에서 너무 멀어지면(다리가 곧 닿지 않는다) 내딛는 발이 닿을 때까지 덜 나간다
    //  (계속 밀고 나가면 뒤에 남은 발이 발끝으로 끌린다)
    if (swing && swing.kind !== 'req' && GAIT.reachSlow > 0) {
      const st = swing === L.F ? L.B : L.F;
      const hx = st.hip.x - st.plant.x;
      const hz = st.hip.z - st.plant.z;
      const sp = Math.hypot(want.x, want.z);
      if (sp > 1e-3) {
        const ahead = (hx * want.x + hz * want.z) / sp; // 가려는 쪽으로 엉덩이가 발보다 앞선 거리
        const k = clamp(1 - (ahead - GAIT.reachSlow) / GAIT.reachSlowW, GAIT.reachSlowMin, 1);
        if (k < 1) want.multiplyScalar(k);
      }
    }
    // 기술 걸음 동안엔 몸도 그만큼 따라 나간다
    if (swing && swing.kind === 'req' && this.req) want.addScaledVector(fwd, (this.req.fwd * 0.8) / (swing.T + 0.15));
    // ④ 좌우 무게 옮기기: 한 발로 서는 동안 무게중심을 딛은 발 쪽으로 (want에 속도로 더한다)
    this.sway.set(0, 0, 0);
    if (swing && swing.kind !== 'catch') {
      const u = clamp(swing.t / swing.T, 0, 1);
      const st = swing === L.F ? L.B : L.F;
      const amp = GAIT.sway * (walkNow ? 1 : 0.5) * (1 - this.lev);
      const vs = ((amp * Math.PI) / swing.T) * Math.cos(Math.PI * u) * st.side;
      this.sway.set(rgt.x * vs, 0, rgt.z * vs);
      want.add(this.sway);
    }
    // ⑤ 가만히 서 있을 땐 무게중심을 두 발 사이(앞발 쪽으로 조금)에 둔다 → 서서 미끄러지지 않는다
    if (!walkNow && !swing) {
      const c = f.com;
      if (c) {
        const w = GAIT.weightFront;
        const front = this.frontLeg(fwd);
        const a = L[front].plant;
        const b = L[front === 'F' ? 'B' : 'F'].plant;
        const tx = b.x + (a.x - b.x) * w;
        const tz = b.z + (a.z - b.z) * w;
        const g = GAIT.holdGain * (1 - this.lev);
        _s1.set((tx - c.x) * g, 0, (tz - c.z) * g);
        if (_s1.length() > 0.3) _s1.setLength(0.3);
        want.add(_s1);
      }
    }

    // ⑥ 골반 높이: 딛은 다리가 닿는 높이 (무릎을 조금 굽힌 채)
    const drop = f.pelvisDropOffset || 0;
    const hurt = (1 - f.legHealth) * 0.1;
    // 빨리 걸을수록 무릎을 조금 더 굽힌 채 걷는다 (보폭이 길어도 골반이 크게 출렁이지 않게)
    //  뛰듯이 빨리 갈 땐 무릎을 더 굽혀 몸을 낮춘다
    //  옆걸음(옆으로 가는 몫이 절반 넘을 때)은 무릎을 조금 굽힌 채 (펜싱 발놀림처럼): 발을 옆으로 벌려 딛으면 어차피 골반이 내려간다
    this.runW = walkNow ? clamp((speed - GAIT.runFrom) / 0.5, 0, 1) : 0; // 뛰듯 가는 정도 (0 ~ 1)
    const walkH =
      GAIT.walkHeight -
      GAIT.walkHeightFast * clamp((speed - 0.8) / 0.8, 0, 1) -
      GAIT.runDrop * this.runW -
      GAIT.sideLow * clamp((speed > 1e-3 ? vLat / speed : 0) * 2 - 1, 0, 1);
    // 걷기 ↔ 서기 높이는 천천히 바꾼다 (한 번에 낮추면 다리를 오므려 두 발이 땅에서 뜬다)
    const hNomT = (walkNow ? walkH : GAIT.guardHeight) - hurt - Math.max(0, drop);
    const hr = GAIT.heightRate * dt;
    this.hNomF = this.hNomF === undefined ? hNomT : this.hNomF + clamp(hNomT - this.hNomF, -hr, hr);
    const hNom = this.hNomF;
    let hGeo = Infinity;
    let hLow = Infinity;
    for (const k of ['F', 'B']) {
      const l = L[k];
      if (!l.stance) continue;
      l.phi = GAIT.kneeBase; // 디딜 때 더 굽히기(옛 loadKnee)는 0이라 지웠다. 무게를 받으며 저절로 굽는다
      const Ls = legLen(l.phi);
      const hx = l.hip.x - l.plant.x;
      const hz = l.hip.z - l.plant.z;
      let hy = ANKLE_H + Math.sqrt(Math.max(0.04, Ls * Ls - hx * hx - hz * hz)) + HIP_DROP;
      // 뒤로 빠진 발은 뒤꿈치를 들어(발끝으로 서서) 더 높이 받칠 수 있다
      //  (발이 엉덩이 옆을 지나 뒤로 빠지는 동안 조금씩 더한다: 한 번에 켜고 끄면 골반 높이 목표가 한 스텝에 몇 cm씩 뛴다)
      const back = hx * fwd.x + hz * fwd.z; // + = 발이 엉덩이 뒤에
      if (back > 0) {
        const r = Math.hypot(hx, hz);
        const r2 = Math.max(0, r - HEEL_DX);
        const hyHeel = ANKLE_H + HEEL_DY + Math.sqrt(Math.max(0.04, Ls * Ls - r2 * r2)) + HIP_DROP;
        if (hyHeel > hy) hy += (hyHeel - hy) * clamp(back / GAIT.heelBlend, 0, 1);
      }
      // 두 발로 딛을 땐 더 높이 받칠 수 있는 다리 기준 (뒷발은 뒤꿈치를 들어 따라온다)
      hGeo = hGeo === Infinity ? hy : Math.max(hGeo, hy);
      hLow = Math.min(hLow, hy);
    }
    // 천천히 걸을 땐 두 발로 딛는 동안 낮은 쪽 다리 높이 쪽으로 내려앉는다 (뒷다리는 떼기 전에 무릎을 굽힌다):
    //  보폭이 짧아 골반이 거의 출렁이지 않는 것을 보탠다. 앞다리 무릎을 더 꺾지 않고 골반을 내린다
    //  (앞으로 걸을 때만: 옆걸음·뒷걸음은 따로 디딜 때 골반을 내린다)
    //  (걷기 시작 직후엔 조금씩 켠다: 두 발로 딛고 선 채 출발할 때 한꺼번에 내려앉으면 두 발이 다 뜨고, 뒷발이 세게 다시 딛으며 미끄러진다)
    if (walkNow && hLow < hGeo && GAIT.dsLow > 0 && speed > 1e-3) {
      const fore = clamp((foreFrac - 0.3) / 0.4, 0, 1);
      const easeIn = clamp(this.walkT / GAIT.dsLowIn, 0, 1);
      hGeo -= (hGeo - hLow) * GAIT.dsLow * fore * easeIn * Math.max(GAIT.dsLowFast, clamp((GAIT.bobUntil - speed) / 0.5, 0, 1));
    }
    this.hNom = hNom;
    // 보조 힘이 많이 받칠 땐(넘겨받는 중·붙잡기 반사) 다리가 닿지 않아도 골반을 제 높이에 둔다
    //  (일어선 직후 넘겨받는 몫은 다리가 닿는 높이를 지킨다: 보조가 빠질 때 골반이 내려앉지 않게)
    //  넘겨받는 동안엔 그 몫의 일부(handH)만큼은 자세 높이 쪽으로 (발이 아직 제자리에 없어도 골반이 주저앉지 않게)
    const levT = Math.max(this.levC, this.levH * GAIT.handH);
    let hT = THREE.MathUtils.lerp(clamp(Math.min(hNom, hGeo), hNom - GAIT.maxDip, hNom), hNom, levT);
    // 천천히 걸을 땐 보폭이 짧아 골반이 거의 출렁이지 않는다 → 두 발로 딛는 동안 살짝 내려앉았다가 한 발로 설 때 올라온다
    if (walkNow && GAIT.bobAdd > 0) {
      const up = swing && swing.kind !== 'settle' ? Math.sin(Math.PI * clamp(swing.t / swing.T, 0, 1)) : 0;
      hT -= GAIT.bobAdd * (1 - up) * clamp((GAIT.bobUntil - speed) / 0.5, 0, 1);
    }
    // 옆걸음·뒷걸음: 발을 디딜 때마다 골반을 살짝 내려 무릎이 무게를 받게 한다
    //  (옆걸음은 다리를 벌린 채, 뒷걸음은 발끝부터 디뎌 뒤꿈치를 든 채 무게를 받아서 저절로는 무릎이 굽지 않는다)
    if (walkNow && GAIT.sideDip > 0 && speed > 1e-3) {
      let bump = 0;
      for (const k of ['F', 'B']) {
        const l = L[k];
        if (l.stance && l.tLand < GAIT.loadTime) bump = Math.max(bump, Math.sin((Math.PI * l.tLand) / GAIT.loadTime));
      }
      //  (앞뒤로 비스듬히 갈 땐 내리지 않는다: 앞으로 내딛는 다리는 저절로 무릎이 굽는다)
      const side = clamp((vLat / speed - GAIT.sideDipFrom) / (1 - GAIT.sideDipFrom), 0, 1);
      const back = backness * clamp(speed / 0.9, 0.4, 1); // 천천히 물러날 땐 덜
      hT -= Math.max(GAIT.sideDip * side, GAIT.backDip * back) * bump;
    }
    // 딱 멈추는 2차 필터 (내려갈 땐 빨리: 다리가 닿지 않는 높이로 끌어올리지 않게)
    const w = hT < this.h ? GAIT.hDown : GAIT.hUp;
    this.hv += (w * w * (hT - this.h) - 2 * w * this.hv) * dt;
    // 올라가는 빠르기는 hUpMax(m/s)까지 (낮게 내려앉았던 골반을 한 번에 밀어 올리면 몸이 떠서 딛은 발이 미끄러진다)
    if (this.hv > GAIT.hUpMax) this.hv = GAIT.hUpMax;
    this.h += this.hv * dt;
    // 다리가 닿는 높이보다 높으면 내린다. 한 번에 내리지 않고 capRate(m/s)로 (디딘 발이 엉덩이 옆을 지날 때처럼 닿는 높이가
    //  갑자기 줄면, 한 스텝에 골반 목표를 몇 cm 떨어뜨려 두 발이 다 들렸다가 다음 발이 몸무게의 두 배 가까이 받으며 미끄러진다)
    const cap = Math.max(hGeo + 0.01 + levT, hNom - GAIT.maxDip);
    if (this.h > cap) {
      this.h = Math.max(cap, this.h - GAIT.capRate * dt);
      this.hv = Math.min(this.hv, 0);
    }
  }

  /**
   * 몸무게를 받치는 보조 힘의 비율 (driveBalance가 쓴다). 넘겨받는 중엔 다리가 이미 받치는 만큼 덜 받친다
   * (보조 힘 100% + 다리가 미는 힘이 겹치면 골반이 솟았다가, 보조가 빠질 때 주저앉는다)
   */
  supportShare(Mg) {
    const share = GAIT.assist + (1 - GAIT.assist) * this.lev;
    if (!(this.levH > 0) || this.levC >= this.levH) return share;
    const legs = clamp((this.Nsum || 0) / Mg, 0, 1); // 다리가 받치는 몫 (실측)
    const over = Math.max(0, share + legs - 1); // 넘치는 몫
    return Math.max(GAIT.assist, share - over * this.levH);
  }

  /** 멈춘 뒤 펜싱 자세에서 가장 벗어난 발 (고쳐 딛을 발). 괜찮으면 null */
  settleLeg(posOk) {
    const c = this.f.com;
    if (!c) return null;
    let worst = null;
    let worstE = 0;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      this.guardSpot(l, _s3);
      const e = Math.hypot(l.plant.x - _s3.x, l.plant.z - _s3.z);
      const ye = Math.abs(wrap(l.yaw - this.guardYaw(l)));
      const tol = this.settles === 0 ? GAIT.settleTol : GAIT.settleTol * 1.6;
      const score = Math.max(posOk ? e / tol : 0, ye / GAIT.yawTol);
      if (score > 1 && score > worstE) {
        worstE = score;
        worst = k;
        this.settleTurn = ye / GAIT.yawTol >= (posOk ? e / tol : 0); // 몸을 돌려서 고쳐 딛는 발
      }
    }
    return worst;
  }

  /** 펜싱 자세에서 이 발이 설 자리 (무게중심 기준) */
  guardSpot(l, out) {
    const c = this.f.com;
    // 몸을 돌리는 중이면 돌아갈 방향을 미리 본다
    const h = this.headAhead();
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const x = l.k === 'F' ? GAIT.guardLength * (1 - GAIT.weightFront) : -GAIT.guardLength * GAIT.weightFront;
    const z = l.side * GAIT.guardWidth * 0.5;
    // 오른쪽 = (-fz, 0, fx)
    return out.set(c.x + fx * x - fz * z, ANKLE_H, c.z + fz * x + fx * z);
  }

  /** 몸이 곧 바라볼 방향 (지금 도는 빠르기로 조금 앞질러) */
  headAhead() {
    const f = this.f;
    let lead = clamp(this.headRate * GAIT.turnLead, -0.5, 0.5);
    // 돌아서려는 방향(바라볼 곳)을 알면 그쪽을 미리 본다 (한 걸음에 발을 더 많이 돌려 딛는다)
    if (GAIT.turnAhead > 0 && f.faceTarget) {
      const p = f.bodies.pelvis.translation();
      const d = wrap(Math.atan2(-(f.faceTarget.z - p.z), f.faceTarget.x - p.x) - f.heading);
      if (Math.abs(d) > Math.abs(lead)) lead = clamp(d, -GAIT.turnAhead, GAIT.turnAhead);
    }
    return f.heading + lead;
  }

  guardYaw(l) {
    return this.headAhead() + (l.k === 'B' ? -l.side * GAIT.rearToe : 0);
  }

  begin(l, kind, T) {
    l.stance = false;
    l.heel = 0;
    l.y0 = 0;
    l.relOk = false;
    l.kind = kind;
    l.t = 0;
    l.T = T;
    l.p0.set(l.ankle.x, ANKLE_H, l.ankle.z);
    l.p1.copy(l.p0);
    l.v0.set(this.vf.x * GAIT.liftCarry, 0, this.vf.z * GAIT.liftCarry);
    l.yaw0 = l.footYaw;
    l.lift = kind === 'settle' ? GAIT.liftSettle : GAIT.lift;
    // 걷는 중엔 발을 든 시간 내내 옮긴다 (일찍 도착하면 몸이 따라올 때까지 발이 몸 앞 멀리 떠 있어야 한다)
    //  (다리가 닿지 않아 크게 옮기는 발(catch)은 조금 일찍 도착해 제자리에서 내려 딛는다: 움직이는 채로 닿으면 미끄러진다)
    l.hFrac = kind === 'settle' ? GAIT.hFrac : kind === 'catch' ? GAIT.hFracCatch : 1;
  }

  /** 내딛을 자리 정하기 (remain: 발이 땅에 닿기까지 남은 시간) */
  target(l, want, fwd, rgt, remain) {
    const f = this.f;
    const other = l === this.legs.F ? this.legs.B : this.legs.F;
    const p = f.bodies.pelvis.translation();
    const out = l.p1;
    if (l.kind === 'settle') {
      this.guardSpot(l, out);
      l.yaw1 = this.guardYaw(l);
    } else if (l.kind === 'req' && this.req) {
      // 기술 걸음. lunge: 앞발을 fwd만큼 내딛는다. pass: 뒷발이 앞발을 지나 그 앞에 딛는다 (앞뒤 발이 바뀐다)
      const r = this.req;
      const base = r.kind === 'lunge' ? l.p0 : other.plant;
      const x = r.kind === 'lunge' ? r.fwd : Math.max(0.3, r.fwd - 0.1);
      const z = r.side + (r.kind === 'pass' ? l.side * GAIT.guardWidth : 0);
      out.set(base.x + fwd.x * x + rgt.x * z, ANKLE_H, base.z + fwd.z * x + rgt.z * z);
      l.yaw1 = this.headAhead();
    } else {
      // 몸이 닿을 때 있을 곳 + 속도 × (딛는 시간의 절반) (Raibert). 속도가 원하는 것보다 빠르면 더 멀리 딛어 받는다
      const v = this.vf;
      const Tst = this.stepT * (1 + GAIT.dsFrac);
      const px = p.x + v.x * remain;
      const pz = p.z + v.z * remain;
      const ox = want.x * Tst * 0.5 + GAIT.kv * (v.x - want.x);
      const oz = want.z * Tst * 0.5 + GAIT.kv * (v.z - want.z);
      const wd = GAIT.width;
      out.set(px + ox + rgt.x * l.side * wd, ANKLE_H, pz + oz + rgt.z * l.side * wd);
      l.yaw1 = this.headAhead();
      // 너무 멀리 뻗지 않게
      const dx = out.x - px;
      const dz = out.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > GAIT.maxReach) {
        out.x = px + (dx / d) * GAIT.maxReach;
        out.z = pz + (dz / d) * GAIT.maxReach;
      }
    }
    // 발을 돌려 딛는 각도는 엉덩이·발목이 비틀 수 있는 만큼만 (더 돌려 디디면 디딘 뒤 다리가 발을 되돌려 비틀어 미끄러진다)
    if (GAIT.swingTwist > 0) {
      const pel = f.heading + (f.pelvisYawOffset || 0);
      l.yaw1 = pel + clamp(wrap(l.yaw1 - pel), -GAIT.swingTwist, GAIT.swingTwist);
    }
    // 다리가 꼬이지 않게: 딛은 발에서 자기 쪽으로 최소 간격
    const lat = (out.x - other.plant.x) * rgt.x + (out.z - other.plant.z) * rgt.z;
    const need = GAIT.minWidth - lat * l.side;
    if (need > 0) out.addScaledVector(rgt, need * l.side);
  }

  touchdown(l, speed) {
    l.stance = true;
    // 디딜 때의 무릎 굽힘 (허벅지와 정강이 사이 각도)
    const bt = this.f.bodies[l.thigh].rotation();
    const bs = this.f.bodies[l.shin].rotation();
    _s2.set(0, 1, 0).applyQuaternion(_qT.set(bt.x, bt.y, bt.z, bt.w));
    _s3.set(0, 1, 0).applyQuaternion(_qT.set(bs.x, bs.y, bs.z, bs.w));
    l.phiTD = Math.acos(clamp(_s2.dot(_s3), -1, 1));
    this.plantAt(l);
    this.footMass(l, true);
    l.tLand = 0;
    this.sinceTD = 0;
    this.lastTD = l.k;
    if (l.kind === 'req') this.req = null;
    this.f.footstep = Math.max(this.f.footstep, clamp(speed / GAIT.moveSpeed, 0.15, 1));
  }

  /**
   * 딛은 발만 조금 무겁게 한다 (신발·쇠 발싸개 몫, GAIT.footExtra kg).
   *  몸무게 대부분이 1kg 남짓한 발 하나에 실리면 물리 엔진의 반복 계산이 다 수렴하지 못해, 가만히 딛은 발이
   *  제자리에서 조금씩 움직이는 것처럼 계산된다 (발에 걸린 계산 오차가 발 무게에 반비례한다).
   *  내딛는 발은 땅에서 떨어지면 원래 무게로 (무거운 발을 휘두르면 그 반동에 몸이 흔들려 잘 넘어진다).
   *  발을 떼고 디디는 순간엔 발이 거의 멈춰 있어서 무게를 바꿔도 몸의 움직임은 거의 바뀌지 않는다
   */
  footMass(l, on) {
    const m = on ? GAIT.footExtra : 0;
    if (l.extra === m) return;
    l.extra = m;
    this.f.bodies[l.foot].setAdditionalMass(m, true);
  }

  /** 지금 발 자리를 딛은 자리로 기억한다 (발바닥 가운데·발끝이 땅에 붙은 곳도) */
  plantAt(l) {
    l.plant.set(l.ankle.x, ANKLE_H, l.ankle.z);
    l.yaw = l.footYaw;
    l.yawTD = l.footYaw;
    l.pinC.copy(SOLE_C).applyQuaternion(l.fq).add(l.fp);
    l.pinT.copy(SOLE_T).applyQuaternion(l.fq).add(l.fp);
    // 뒤꿈치를 든 채(발끝으로) 디뎠으면: 발끝 자리를 기준으로 발을 평평히 내렸을 때의 발목·발바닥 가운데 자리를 기억한다
    //  (들린 발 그대로 기억하면 뒤꿈치가 내려앉을 때 붙잡는 자리와 발이 어긋나 발이 끌린다)
    const fx = _s2.set(1, 0, 0).applyQuaternion(l.fq);
    if (fx.y < -GAIT.heelTD) {
      const cx = Math.cos(l.yaw);
      const cz = -Math.sin(l.yaw);
      l.pinT.y = 0;
      l.pinC.set(l.pinT.x - cx * (SOLE_T.x - SOLE_C.x), 0, l.pinT.z - cz * (SOLE_T.x - SOLE_C.x));
      l.plant.set(l.pinT.x - cx * TOE_X, ANKLE_H, l.pinT.z - cz * TOE_X);
    }
  }

  /** 다리 관절 목표 (applyPose가 부른다) */
  poseLegs() {
    const f = this.f;
    const J = f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      const g = l.stance ? 1 + (GAIT.stanceGain - 1) * (1 - this.lev) : GAIT.swingGain;
      J[l.thigh].gain = g;
      J[l.shin].gain = g;
      J[l.foot].gain = g;
    }
    const p = f.bodies.pelvis.translation();
    // 딛은 다리는 골반을 목표 높이로 밀어 올린다. 골반이 목표보다 높을 때 다리를 오므리면 (몸을 끌어내리지 못하고)
    // 발만 들리므로 조금만 오므린다
    const dh = clamp(this.h - p.y, -GAIT.dhDown, 0.05);
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (l.stance) {
        // 딛은 발: 골반이 목표 높이에 있다고 보고 그 자리까지 다리를 뻗는다 → 관절이 체중을 받쳐 골반을 그 높이로 민다
        _h.copy(l.hip);
        _h.y += dh;
        _a.copy(l.plant);
        // 다리가 닿지 않으면 발끝을 축으로 뒤꿈치를 든다 (뒤로 빠진 발이 땅을 끌지 않게)
        //  (조금만 모자랄 땐 들지 않는다: 들락날락하면 발이 떨린다)
        const heel = Math.max(0, this.heelOff(l, _h, _a, legLen(l.phi)) - GAIT.heelDead);
        l.heel += (heel - l.heel) * 0.3;
        if (l.heel > 0.01) this.toePivot(l, _a, l.heel);
        //  (디딜 때 이미 굽어 있던 만큼(phiTD)에서 더 굽히는 몫만 제한한다: 무릎을 굽힌 채 뛰듯 걸을 땐 그 굽힘부터)
        //  (걷는 중 디딘 직후(무게를 받는 동안)만: 서 있을 땐 자세대로 무릎을 굽힌다)
        const capK = GAIT.stanceKneeMax > 0 && this.walking && l.kind !== 'settle' && l.tLand < GAIT.loadTime * 1.5;
        //  (뛰듯 빨리 갈 땐 발을 디딜 때 부딪는 힘이 커서 무릎이 목표보다 더 꺾이므로 덜 굽히게 한다)
        this.legIK(l, _h, _a, l.yaw, -l.heel, capK ? legLen(Math.max(l.phi, l.phiTD) + GAIT.stanceKneeMax * (1 - GAIT.runKneeCut * this.runW)) : 0);
      } else {
        const u = clamp(l.t / l.T, 0, 1);
        // 앞뒤·옆으로는 발을 든 시간의 앞쪽 hFrac 동안 옮기고, 나머지 동안 거의 제자리에서 내려 딛는다
        //  (움직이는 채로 땅에 닿으면 미끄러진다)
        const uh = Math.min(1, u / l.hFrac);
        const s = minJerk(uh);
        // 5차 곡선: 발을 떼는 순간엔 몸과 함께 앞으로 나가기 시작하고(뒤에 끌리지 않게), 딛는 순간엔 땅에 대해 멈춘다
        const h1 = uh - 6 * uh * uh * uh + 8 * uh * uh * uh * uh - 3 * uh * uh * uh * uh * uh;
        _a.lerpVectors(l.p0, l.p1, s).addScaledVector(l.v0, h1 * l.T * l.hFrac);
        const late = l.t > l.T ? Math.min(0.02, (l.t - l.T) * 0.3) : 0;
        // 발은 일찍 들고(발끝이 걸리지 않게) 늦게 내린다. 들린 동안 발끝을 살짝 든다
        const up = THREE.MathUtils.smoothstep(u, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(u, Math.min(0.75, l.hFrac - 0.15), 1));
        _a.y = ANKLE_H + Math.max(l.lift * up, l.y0 * (1 - THREE.MathUtils.smoothstep(u, 0, 0.5))) - late;
        const yaw = l.yaw0 + wrap(l.yaw1 - l.yaw0) * s;
        // 엉덩이에 대한 발의 속도를 제한한다 (다리를 채찍처럼 휘두르면 그 반동이 몸을 떠민다)
        _d.subVectors(_a, l.hip);
        if (l.relOk) {
          const mv = GAIT.swingVmax * f.lastDt;
          _c.subVectors(_d, l.rel);
          if (_c.lengthSq() > mv * mv) {
            _c.setLength(mv);
            _d.copy(l.rel).add(_c);
            _a.addVectors(l.hip, _d);
          }
        }
        l.rel.copy(_d);
        // 내딛는 발을 목표로 이끄는 엉덩이·허벅지 근육 (발과 골반 사이에 서로 반대로 거는 힘 → 몸 전체로는 힘이 생기지 않는다).
        //  관절 모터만으로는 빠르게 휘두르는 다리가 목표를 지나쳐 땅에 미끄러지며 닿는다
        if (l.relOk && GAIT.swingK) this.swingPull(l, _a);
        else l.desV.set(0, 0, 0);
        l.relOk = true;
        l.des.copy(_a);
        this.legIK(l, l.hip, _a, yaw, GAIT.toeUp * Math.sin(Math.PI * u));
      }
    }
  }

  /** 내딛는 발목을 목표(a)로 당기는 힘 (발 ↔ 골반, 서로 반대) */
  swingPull(l, a) {
    const f = this.f;
    const dt = f.lastDt || 1 / 120;
    // 목표의 속도 (걸러서)
    _c.subVectors(a, l.des).multiplyScalar(1 / dt);
    l.desV.lerp(_c, 0.5);
    const fb = f.bodies[l.foot];
    const v = fb.linvel();
    const K = GAIT.swingK;
    const D = GAIT.swingD;
    _c.set(K * (a.x - l.ankle.x) + D * (l.desV.x - v.x), K * (a.y - l.ankle.y) + D * (l.desV.y - v.y), K * (a.z - l.ankle.z) + D * (l.desV.z - v.z));
    const m = _c.length();
    if (m > GAIT.swingFmax) _c.multiplyScalar(GAIT.swingFmax / m);
    _f.x = _c.x;
    _f.y = _c.y;
    _f.z = _c.z;
    _p.x = l.ankle.x;
    _p.y = l.ankle.y;
    _p.z = l.ankle.z;
    fb.addForceAtPoint(_f, _p, true);
    _f.x = -_c.x;
    _f.y = -_c.y;
    _f.z = -_c.z;
    _p.x = l.hip.x;
    _p.y = l.hip.y;
    _p.z = l.hip.z;
    f.bodies.pelvis.addForceAtPoint(_f, _p, true);
  }

  /** 딛은 발 발목이 엉덩이에서 Ls보다 멀면, 발끝을 축으로 뒤꿈치를 몇 라디안 들어야 닿는지 */
  heelOff(l, hip, ankle, Ls) {
    const dx = ankle.x - hip.x;
    const dy = ankle.y - hip.y;
    const dz = ankle.z - hip.z;
    if (dx * dx + dy * dy + dz * dz <= Ls * Ls) return 0;
    let lo = 0;
    let hi = GAIT.heelMax;
    for (let i = 0; i < 6; i++) {
      const m = (lo + hi) * 0.5;
      this.toePivot(l, _hp.copy(ankle), m);
      if (_hp.distanceToSquared(hip) > Ls * Ls) lo = m;
      else hi = m;
    }
    return hi;
  }

  /** 발끝(발바닥 앞쪽 모서리)을 축으로 뒤꿈치를 th만큼 들었을 때의 발목 위치 (ankle을 고친다) */
  toePivot(l, ankle, th) {
    const fx = Math.cos(l.yaw);
    const fz = -Math.sin(l.yaw);
    // 평평할 때 발끝 → 발목: 뒤로 TOE_X, 위로 SOLE_Y
    const c = Math.cos(th);
    const s = Math.sin(th);
    const back = TOE_X * c - SOLE_Y * s; // 발끝에서 뒤쪽으로
    const up = TOE_X * s + SOLE_Y * c;
    const tx = ankle.x + fx * TOE_X;
    const tz = ankle.z + fz * TOE_X;
    const ty = ankle.y - SOLE_Y;
    return ankle.set(tx - fx * back, ty + up, tz - fz * back);
  }

  /**
   * 다리 역운동학: 엉덩이(hip) → 발목(ankle)까지 다리를 뻗고, 발은 yaw 방향을 보며 땅과 나란하게.
   * 무릎은 경첩, 발목은 공 관절이라 다리가 옆으로 기울어도 발바닥은 평평하다.
   */
  legIK(l, hip, ankle, yaw, pitch, minLen = 0) {
    const f = this.f;
    const J = f.jointByName;
    const d = _d.subVectors(ankle, hip);
    let len = d.length();
    if (len < 1e-4) return;
    d.multiplyScalar(1 / len);
    // minLen: 딛은 다리는 무릎을 이 이상 굽히지 않고 버틴다 (몸무게를 받으며 무릎이 너무 꺾이지 않게: 다리가 골반을 밀어 올린다)
    len = clamp(len, Math.max(0.42, minLen), legLen(GAIT.kneeMin));
    const fwd = _fw.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // 무릎 축: 발이 보는 방향의 오른쪽 축을, 다리 방향에 수직이 되게 고친다
    const kx = _kx.set(-fwd.z, 0, fwd.x);
    kx.addScaledVector(d, -kx.dot(d));
    if (kx.lengthSq() < 1e-6) kx.set(0, 0, 1).applyQuaternion(f.yaw);
    kx.normalize();
    const m = _m.crossVectors(kx, d); // 다리 평면에서 앞쪽
    const cosK = clamp((A_LEN * A_LEN + B_LEN * B_LEN - len * len) / (2 * A_LEN * B_LEN), -1, 1);
    const phi = Math.PI - Math.acos(cosK); // 무릎 굽힘
    const cosA = clamp((A_LEN * A_LEN + len * len - B_LEN * B_LEN) / (2 * A_LEN * len), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const ut = _ut.copy(d).multiplyScalar(cosA).addScaledVector(m, sinA); // 허벅지 방향 (엉덩이 → 무릎)
    // 허벅지 자세 (월드): y = 뼈 반대 방향, z = 무릎 축
    _y.copy(ut).negate();
    _x.crossVectors(_y, kx);
    _M.makeBasis(_x, _y, kx);
    _qT.setFromRotationMatrix(_M);
    const pr = f.bodies.pelvis.rotation();
    _qP.set(pr.x, pr.y, pr.z, pr.w).invert();
    J[l.thigh].target.copy(_qP).multiply(_qT);
    J[l.shin].target.setFromAxisAngle(Z_AXIS, -phi);
    // 발목(공 관절): 발바닥이 땅과 나란히 yaw 방향을 보게 (pitch만큼 발끝을 들거나 뒤꿈치를 든다)
    //  발목 목표 = (정강이 목표 자세)⁻¹ × (발 월드 자세)
    _qS.copy(_qT).multiply(_qK.setFromAxisAngle(Z_AXIS, -phi)).invert();
    _qW.setFromAxisAngle(UP, yaw);
    if (pitch) _qW.multiply(_qK.setFromAxisAngle(Z_AXIS, pitch));
    J[l.foot].target.copy(_qS).multiply(_qW);
  }

  /** 이 발이 지난 물리 스텝에 땅에서 받은 수직 힘(N): 물리 엔진의 접촉 충격량 ÷ 시간 */
  groundForce(l) {
    const f = this.f;
    const w = f.world;
    const col = l.col || (l.col = f.bodies[l.foot].collider(0));
    _gf.imp = 0;
    _gf.col = col;
    _gf.w = w;
    w.contactPairsWith(col, _gfPair);
    return f.lastDt > 0 ? _gf.imp / f.lastDt : 0;
  }

  /**
   * 발바닥 정지 마찰: 딛은 발을 디딘 자리에 붙잡는다.
   * 한계 = 마찰계수 × 그 발이 실제로 땅을 누르는 힘 (물리 엔진 접촉에서 잰다) → 발에 무게가 없으면 붙잡지 못한다.
   * 한계를 넘으면 발이 미끄러지고, 붙잡는 자리도 발과 함께 옮겨 간다 (쿨롱 마찰: 미끄러진 발을 원래 자리로 끌어오지 않는다).
   */
  pinFeet() {
    const f = this.f;
    if (!GAIT.pinK) return;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      l.N = 0;
      if (!l.stance) {
        l.Nf = 0;
        continue;
      }
      // The contact trial must not keep applying cached ground friction in air.
      const supportContact = BODY.supportModel === 'axial' ? f.supportContacts?.groups[l.foot] : null;
      if (BODY.supportModel === 'axial' && !supportContact?.hasSupport) {
        l.Nf = 0; l.pinF = 0; l.pinLim = 0;
        continue;
      }
      // 붙잡는 곳: 발바닥 가운데 (뒤꿈치를 들었으면 발끝)
      const toe = l.heel > 0.05;
      const pin = toe ? l.pinT : l.pinC;
      const pt = _s1.copy(toe ? SOLE_T : SOLE_C).applyQuaternion(l.fq).add(l.fp);
      if (pt.y > 0.03) continue;
      const rawGround = supportContact
        ? supportContact.contacts.filter(c => c.hasSupport).reduce((sum, c) => sum + c.rawNormalImpulseNs * c.normalAlignmentWithUp, 0) / (f.lastDt || 1 / 120)
        : this.groundForce(l);
      const N = rawGround * f.muscle;
      l.N = N;
      const fb = f.bodies[l.foot];
      const v = fb.linvel();
      const w = fb.angvel();
      const c = fb.worldCom();
      const rx = pt.x - c.x;
      const ry = pt.y - c.y;
      const rz = pt.z - c.z;
      // 그 점의 속도 = v + ω × r
      const vx = v.x + w.y * rz - w.z * ry;
      const vz = v.z + w.x * ry - w.y * rx;
      // 한계는 걸러진 무게로 (접촉 힘은 스텝마다 들쭉날쭉해서, 순간적으로 작게 잡히면 붙잡는 자리가 조금씩 끌려간다)
      l.Nf = Math.max(N, (l.Nf || 0) * (1 - GAIT.pinHold * (f.lastDt || 1 / 120)));
      const lim = GAIT.pinMu * l.Nf;
      // 붙잡는 자리가 한계보다 멀면 (미끄러짐) 자리를 발 쪽으로 옮긴다. 딛은 자리(다리 IK 목표)도 같이
      const ex = pin.x - pt.x;
      const ez = pin.z - pt.z;
      const e = Math.hypot(ex, ez);
      const eMax = lim / GAIT.pinK;
      if (e > eMax) {
        const s = 1 - eMax / e;
        const mx = ex * s;
        const mz = ez * s;
        l.pinC.x -= mx;
        l.pinC.z -= mz;
        l.pinT.x -= mx;
        l.pinT.z -= mz;
        l.plant.x -= mx;
        l.plant.z -= mz;
      }
      let fx = GAIT.pinK * (pin.x - pt.x) - GAIT.pinD * vx;
      let fz = GAIT.pinK * (pin.z - pt.z) - GAIT.pinD * vz;
      const fl = Math.hypot(fx, fz);
      l.pinF = fl;
      l.pinLim = lim;
      if (fl > lim) {
        fx *= lim / (fl + 1e-9);
        fz *= lim / (fl + 1e-9);
      }
      _f.x = fx;
      _f.y = 0;
      _f.z = fz;
      _p.x = pt.x;
      _p.y = pt.y;
      _p.z = pt.z;
      fb.addForceAtPoint(_f, _p, true);
      // 발이 땅 위에서 도는 것도 마찰이 붙잡는다 (한계 = 마찰 × 무게 × 발바닥 크기). 넘으면 딛은 방향도 따라 돈다
      const lt = GAIT.pinMu * l.Nf * 0.05;
      let ye = wrap(l.yaw - l.footYaw);
      const yMax = lt / GAIT.pinYawK;
      if (Math.abs(ye) > yMax) {
        l.yaw = l.footYaw + Math.sign(ye) * yMax;
        ye = Math.sign(ye) * yMax;
      }
      _f.x = 0;
      _f.y = clamp(GAIT.pinYawK * ye - GAIT.pinYawD * w.y, -lt, lt);
      _f.z = 0;
      fb.addTorque(_f, true);
    }
  }

  /** 관절 목표 속도 기록(driveJoints의 prevRV)을 지운다 → 목표가 한 번에 바뀌어도 모터가 튀지 않는다 */
  resetRates() {
    const J = this.f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      for (const n of [l.thigh, l.shin, l.foot]) J[n].prevRV = null;
    }
  }
}

const _qP = new THREE.Quaternion();
const _qF = new THREE.Quaternion();
const _qT = new THREE.Quaternion();
const _M = new THREE.Matrix4();
const _s1 = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _s3 = new THREE.Vector3();
const _h = new THREE.Vector3();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _kx = new THREE.Vector3();
const _m = new THREE.Vector3();
const _ut = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _c = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _qS = new THREE.Quaternion();
const _qK = new THREE.Quaternion();
const _qW = new THREE.Quaternion();
const _f = { x: 0, y: 0, z: 0 };
// groundForce용 (매 스텝 함수를 새로 만들지 않게)
const _gf = { imp: 0, col: null, w: null };
const _gfSum = (m) => {
  for (let i = 0, n = m.numContacts(); i < n; i++) _gf.imp += m.contactImpulse(i);
};
const _gfPair = (other) => {
  const b = other.parent();
  if (b && b.isFixed()) _gf.w.contactPair(_gf.col, other, _gfSum);
};
const _p = { x: 0, y: 0, z: 0 };
