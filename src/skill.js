import { tempoHand, observeTempoInput } from './attack_tempo.js';
// ─────────────────────────────────────────────────────────────
//  검술 층 (숙련도 보정)
//
//  입력(손가락/AI) → [검술 층] → 근육(관절 모터, 근력 한계) → 물리
//
//  이 캐릭터는 이미 검술을 익힌 사람이라고 가정하고, 입력이 "휘두르기"로 보이면
//  훈련된 사람이 저절로 하는 몸놀림을 덧붙인다. 단, 여기서 바꾸는 것은 "목표"뿐이다.
//  실제 움직임은 언제나 근육(힘의 한계)과 물리가 만든다 → 맞으면 흐트러지고, 칼은 여전히 무겁다.
//
//   0) 입력 쪽 관성("가죽끈", SKILL.handDynamicsOn): 손가락 목표 앞에 반지름 작은 원(anchor)을 둔다.
//      손가락이 그 안에서 떨리는 동안은 anchor가 안 움직이고, 반경을 넘어야 그만큼만 끌려간다.
//      → 잘게 떠는 손가락이 자세 경계(guards.js RBF 블렌드)를 스치며 칼끝·몸통을 흔드는 것을 원천에서 막는다.
//      진짜 베기·자세 이동처럼 큰 움직임은 anchor가 거의 즉시 팽팽해져 그대로 전해진다 → 반응은 그대로.
//   1) 이어 베기(follow-through): 짧고 빠르게 그어도 칼이 그 방향으로 끝까지 지나간다
//   2) 검술 자세(guards.js): 손가락 위치를 실제 롱소드 자세로 바꾼다. 몸(골반·가슴)은 손보다 먼저
//      자세를 따라가서, 베기를 시작하면 허리 → 가슴 → 팔 → 칼 순서로 힘이 이어진다 (fighter.updateBodyPose)
//   3) 내딛기: 알맞은 간격에서 휘두르기 시작하면 앞발을 내딛으며 벤다
//   4) 자세로 돌아가기: 베기를 마치고 손가락을 떼면(마우스는 잠깐 멈추면) 교본의 기본 자세(쟁기)로 칼을 되돌린다.
//      숙련된 검사는 베고 나서 칼을 아무 데나 두지 않고 곧바로 자세를 잡는다. (플레이어만. AI는 스스로 자세를 고른다)
//   5) 탭 찌르기(thrust): 화면을 톡 치면 칼끝을 상대 몸통(칼이 높으면 머리)으로 맞추고 칼 선을 따라
//      손을 뻗은 뒤 자세로 돌아온다 (약 0.45초, 한 걸음 내딛으며). 자세 지도 위에 덧씌우는 자세(thrustPose)로 한다.
//      쓰러진 상대면 찍기(plungePose): 닿는 곳까지 걸어 들어가 두 손을 머리 위로 들고 칼끝을 누운 몸에 겨눈 뒤 힘껏 내려찍는다.
//
//  level: 0 = 보정 없음(날것 그대로의 물리 조작), 1 = 숙련된 검사
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { STAMINA, SKILL, WEAPON, THRUST, BODY, GAIT, POMMEL, SECRET, AI_LEVELS, ARM, UNIQUE_ASSIST } from './config.js';
import { gunCanFire, gunPose, headOff } from './gun.js';
import { FINISH, armRay, updateFinish, finishHands } from './finish.js';
import { VITAL, playerVitalThrust, measureThrustRange } from './vital_target.js'; // 약한 자세 겨눔 탭 찌르기 (FINISH.vital, 10/12)
import { LOW_FINISH, lowFinishOn } from './finish_entry.js'; // 낮은 상대 진입 (FINISH.entry 'low', 기본 끔 — 10/12)
import { requestInstant, requestIai, requestSweep, requestCombo, startLunge, gilmokCutPose, gilmokSeg } from './secret_instant.js'; // 일본 비기 순간 베기 (10/10)
import { montanteFlowSeq, flowGate, FLOW_GATE_MAX, bindGain } from './secret.js'; // 이베리아 멈추지 않는 흐름의 수 (10/11 — AI 와 같은 함수. secret.js 가 이 파일의 segDist 를 부르는 고리지만 둘 다 함수 선언이라 읽는 때에 이미 있다)

const D2R = Math.PI / 180;
const _yawInv = new THREE.Quaternion();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _u = new THREE.Vector3();
const _b = new THREE.Vector3();
const _wa = new THREE.Vector3(); // 사람 휘두르기 헛침 셈 전용 (whiffTrack)
const _wb = new THREE.Vector3();
const _sq = new THREE.Quaternion();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u0 = [0, 0, 0];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const _ps = new THREE.Vector3();
const _pd = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _ph = new THREE.Vector3(); // pad* 의 손 자리 (fighter.padHand)
const _sf = new THREE.Vector3();
const _sr = new THREE.Vector3();
const secVal = (v) => (typeof v === 'string' ? SECRET[v] : v); // 비기 칸 값: 문자열이면 SECRET 열쇠 (ai.js secretVal 과 같음)
const padD = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * 보정 v2 ③ pad*: 칼끝이 상대 가슴을 향하는 패드 = fighter.js guardDir 의 닫힌 역 (az → x, el → y, 같은 조각 식·같은 끝값).
 *  칼 방향은 손(v2 매핑의 손 자리 = fighter.padHand, 날것 매핑을 어깨 둘레 배수로)에서 상대 가슴으로. 손 자리가 패드에 따라 바뀌니 homeGuard 에서 시작해 두 번 고쳐 잡는다(기하).
 *  패드 범위는 입력 매핑이 쓰는 WEAPON.reach 안 (update 첫 줄의 손가락 자르기와 같은 값)
 */
function padStar(f, out) {
  const c = f.bodies.chest.translation();
  const fc = f.foe.bodies.chest.translation();
  _yawInv.copy(f.yaw).invert();
  _ps.set(fc.x - c.x, fc.y - c.y, fc.z - c.z).applyQuaternion(_yawInv); // 상대 가슴 (내 가슴 원점, 몸 틀)
  const R = WEAPON.reach;
  let x = SKILL.homeGuard[0];
  let y = SKILL.homeGuard[1];
  for (let k = 0; k < 2; k++) {
    const h = f.padHand(x, y, f.skill.level, _ph); // v2 매핑 손 자리 (driveSword 와 같은 배수, fix2 B)
    _pd.set(_ps.x - h.x, _ps.y - h.y, _ps.z - h.z).normalize(); // 손 → 상대 가슴
    const az = THREE.MathUtils.clamp(Math.atan2(_pd.z, _pd.x), -1.1, 1.3);
    const el = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(_pd.y, -1, 1)), -0.6, 1.75);
    x = az / 1.7 + 0.05;
    y = el <= 0 ? 0.1 + el / 1.1 : 0.1 + (el * 0.5) / 1.65;
    const d = Math.hypot(x, y);
    if (d > R) {
      x *= R / d;
      y *= R / d;
    }
  }
  out[0] = x;
  out[1] = y;
  return out;
}

/** 두 선분(p1–q1, p2–q2) 사이 가장 가까운 거리 (칼날끼리 맞닿았나 — 칼 길 잡기 · 플레이어 비기 창의 맞물림 secret.js) */
export function segDist(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1);
  _d2.subVectors(q2, p2);
  _r.subVectors(p1, p2);
  const a = _d1.dot(_d1);
  const e = _d2.dot(_d2);
  const f = _d2.dot(_r);
  const c = _d1.dot(_r);
  const b = _d1.dot(_d2);
  const den = a * e - b * b;
  let s = den > 1e-9 ? clamp01((b * f - c * e) / den) : 0;
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = clamp01(-c / a);
  } else if (t > 1) {
    t = 1;
    s = clamp01((b - c) / a);
  }
  return _r.copy(p1).addScaledVector(_d1, s).sub(p2).addScaledVector(_d2, -t).length();
}

export class Skill {
  constructor(fighter, level = SKILL.level) {
    this.f = fighter;
    this.level = level;
    this.corr = SKILL.corr; // 보정 방식 'v2' | 'old' (플레이어 = config 그대로, 새 보정 하나 — 사장님 10/1 22:05 위임 → 디렉터 결정; AI 는 ai.js setLevel 이 SKILL.corrAI 'old' 로 덮어쓴다)
    this.corrTip = SKILL.corrTip; // v2 끝점 겨눔 ② (config 기본 끔, 같은 결정. AI 는 늘 끔)
    this.prev = fighter.handOffset.clone();
    this.vel = new THREE.Vector2(); // 손 목표가 움직이는 속도 (m/s, 몸 앞 평면)
    this.follow = new THREE.Vector2(); // 이어 베기로 더해지는 손 목표
    this.aim = fighter.handOffset.clone(); // 실제로 근육이 따라갈 손 목표 (부드럽게 걸러진 값)
    this.anchor = fighter.handOffset.clone(); // 입력 쪽 관성의 "가죽끈" 중심 (0번 단계)
    this.aimRaw = fighter.handOffset.clone(); // 거르기 전 목표 (가죽끈으로 거른 입력 + 이어 베기)
    this.aimVel = new THREE.Vector2(); // 걸러진 목표가 움직이는 속도
    this.quiet = 1; // 손이 느리게 움직인 시간 (새 휘두르기 시작 판단용)
    this.lunge = 0; // 내딛는 중 남은 시간
    this.swings = 0;
    this.activity = 0; // 휘두르는 중인 정도 (0~1)
    this.swinging = false; // 이번 스텝에 휘두르는 중인가 (update 의 판단을 필드로: 근접 밀치기가 읽는다)
    this.autoGuard = false; // 플레이어만 true (main.js)
    this.cutPending = false; // 베기를 했고 아직 자세로 돌아가지 않음
    this.idle = 0; // 손가락(마우스)이 움직이지 않은 시간
    this.recovering = false;
    // 5) 탭 찌르기: 진행 중인 찌르기(tap)와 자세 지도 위에 덧씌우는 자세(thrustPose, guards.js guardAt 이 w 만큼 섞는다)
    this.tap = null;
    this.thrusts = 0;
    this.sinceThrust = Infinity; // 바로 앞 찌르기가 끝난 뒤 지난 시간 (탭 연타 억제 — THRUST.bindRest)
    this.thrustPush = false; // 지금 칼끝을 뻗는 구간인가 (겨눈 뒤 ~ 뻗고 버티기 끝). combat.js 가 팔 유효 질량을 이때만 싣는다
    this.flowing = false; // 흐름(SKILL.flow) 중인가 — 끄면 늘 false
    // 손잡이 찍기(시제품, pommel()): 진행 중인 찍기와 센 수. 찌르기와 같은 덧씌우기 칸(thrustPose)을 쓴다 — 둘은 함께 돌지 않는다
    this.pom = null;
    this.pommels = 0;
    // 플레이어 비기(secret(), 10/9 23:5x — docs/strike/player_secret_2026-10-09.md): 진행 중인 비기(sec)·센 수. 실행 동안 손 목표(handOffset)를 비기 길로 옮긴다 — 입력은 main.js 가 막는다
    this.sec = null;
    this.secretStats = {}; // 이름 → { fired, landed }
    this.uniq = null; // 플레이어 고유 동작 강화 (unique_assist.js PlayerUniqueAssist — main.js 가 플레이어에게만, 열린 동작이 있을 때만 붙인다)
    this.uniqBody = null; // 그 강화의 몸 덧씌우기 { pelvisYaw, chestYaw, pitch, drop } (덧씌우기 칸 몸 값과 같은 꼴 — fighter.js updateBodyPose 가 더한다). 없으면 null
    this.secretBursts = 0; // 비기가 터뜨려진 수 (main.js 연출이 바뀐 것을 본다)
    const b = THRUST.body;
    this.thrustPose = { w: 0, hand: [0, 0, 0], dir: [1, 0, 0], pelvisYaw: b.pelvisYaw * D2R, chestYaw: b.chestYaw * D2R, pitch: b.pitch * D2R, drop: b.drop };
  }

  /**
   * 탭 찌르기 시작. 칼끝을 상대 몸통으로 (칼이 이미 높은 자세면 머리로, 상대가 쓰러져 있으면 누운 몸으로) 맞추고
   * 칼 선을 따라 손을 뻗었다가 자세로 돌아온다. 찌르는 중엔 다시 받지 않는다.
   * @param opt.step false 면 내딛지 않는다 — AI 는 제 걸음(ai.js gaitStep·stepTime)으로 내딛을지 정하므로 false 로 부른다
   *  (검술 층이 따로 내딛기를 부탁하면 AI 가 "안 내딛는다"고 정한 때도 내딛고, 곧이어 AI 걸음이 그 부탁을 덮어써 두 번 내딛었다)
   * @returns 시작했으면 true
   */
  thrust({ step = true, vital = undefined, rangeCommit = false } = {}) {
    const f = this.f;
    if (f.stamina.exhausted || this.tap || this.pom || (this.vitalRange && !rangeCommit) || !f.alive || !f.armed || !f.foe || (f.state !== 'stand' && f.state !== 'kneel')) return false;
    // 권총(??? 등급): 찌르기 = 발사. 장전 중이면 쏘지 않는다 (gun.js)
    if (f.weapon?.gun) return gunCanFire(f, { now: true }); // 권총: 찌르는 동작 없이 사격 자세(gunPose, 자동 조준 + 흔들림)의 지금 총신 방향으로 바로 쏜다 (AI 조준 보정은 gunAI)
    // 지금 손 목표 (몸 기준 [앞, 위, 칼 든 쪽]). 검술 보정이 다 걸려 있으면 자세 지도의 손, 덜 걸려 있으면(보정 약·끔)
    //  날것 손 위치와 섞인 실제 손 목표(fighter.handBase)에서 뻗는다 — 자세 지도의 손에서 뻗으면 실제 손보다 뒤에서 시작해 덜 나갔다
    // 보정 v2 (s > 0): 자세 지도의 손이 없다 → 늘 지금 손 목표(handBase)에서 뻗는다
    const g = this.corr === 'v2' && this.level > 0 ? f.handBase || f.guardPose.hand : f.guardWeight() >= 1 || !f.handBase ? f.guardPose.hand : f.handBase;
    // 쓰러진 상대: 누운 몸을 내리찌른다 (finish.js 가 겨눈 곳)
    //  낮은 상대 진입(FINISH.entry 'low'): 탭은 파이터 스텝보다 먼저 오므로 지금 몸으로 다시 잰다(dt 0 — 자세 섞기 amt 는 그대로).
    //  시작 허가는 amt 를 기다리지 않는다: 새로 열림(canStart) + 칼끝이 몸 겉면에 닿음(서서 걸을 수 있으면 걸어서 닿음도)
    const lowEntry = lowFinishOn(FINISH);
    if (lowEntry) updateFinish(f, 0);
    const down = lowEntry ? f.finish.canStart && (f.finish.plunge.surfaceInside || (step !== false && f.state === 'stand' && f.finish.plunge.surfaceWalk)) : f.finish.on && f.finish.amt > 0.5;
    // 찌르기 무기(weapons.js THRUST_STYLE)는 더 멀리 찌르고 더 빨리 자세로 돌아온다.
    //  (겨누기·뻗기까지 빠르게 하면 팔이 손 목표를 따라가지 못해 오히려 덜 뻗는다 — 측정: 레이피어 탭 상처 60% → 20%)
    const ts = f.weaponCfg.thrustStyle;
    const K = { aim: THRUST.aim, extend: THRUST.extend, hold: THRUST.hold, recover: THRUST.recover * (ts?.recover ?? 1), reach: THRUST.reach + (ts?.reach ?? 0) };
    // 약한 자세 겨눔 (FINISH.vital, 10/12 — vital_target.js, 샛별 저장소 ccea5855·07206655·8bbee803 의 뜻): 무릎 꿇음·일어나는 중인 상대는 목·얼굴·머리 한 점을 찌른다.
    //  AI 는 늦게 본 점을 넘긴다(vital, 없으면 null). 플레이어(vital 안 넘김)는 지금 모습에서 고르고, 칼끝이 목표 바로 앞에 오는 간격이 아니면
    //  먼저 걸어 맞춘 뒤(updateVitalRange) 찌른다. 점은 탭 때 세계 좌표로 고정 — 그 뒤 상대를 따라가지 않는다. 못 고르면 예전처럼 가슴·머리
    let V = null;
    if (!down && FINISH.vital && !f.weapon?.gun) {
      if (vital !== undefined) V = vital;
      else {
        const walk = !rangeCommit && step !== false && f.state === 'stand';
        V = playerVitalThrust(f, walk ? VITAL.rangeTravel : 0);
        if (V && walk) {
          const m = measureThrustRange(f, V.target);
          if (m.valid && !(m.ready && m.aligned)) {
            const c = f.bodies.chest.translation();
            this.vitalRange = { age: 0, foe: f.foe, weapon: f.weapon?.id, origin: { x: c.x, z: c.z }, hand: g ? [g[0], g[1], g[2]] : [0.3, -0.2, 0.12] };
            this.vitalRanges = (this.vitalRanges ?? 0) + 1;
            return true;
          }
          if (!m.valid) V = playerVitalThrust(f, 0);
        }
      }
    }
    const h0 = rangeCommit && this.thrustPose.w > 0 ? this.thrustPose.hand.slice() : g ? [g[0], g[1], g[2]] : [0.3, -0.2, 0.12];
    if (!f.aiControlled) f.stamina.attack('thrust');
    this.tap = { t: 0, h0, down, head: !down && !V && this.aimRaw.y > THRUST.headPad, K };
    if (rangeCommit) this.tap.w0 = this.thrustPose.w; // 간격 맞추기 자세에서 곧장 이어 간다 (덧씌우기를 0 으로 떨어뜨리지 않는다)
    if (V) {
      this.tap.vital = { target: V.target.toArray(), zone: V.zone, foe: f.foe };
      if (VITAL.track) {
        // 겨누는 동안(K.aim)은 상대 머리 몸체에 붙은 점으로 따라가고, 뻗기 시작하면 세계 점으로 고정한다 (보통 찌르기가 가슴을 따라가는 것과 같은 몫)
        const hp = f.foe.bodies.head.translation();
        const hq = f.foe.bodies.head.rotation();
        this.tap.vital.local = V.target.clone().sub(_q.set(hp.x, hp.y, hp.z)).applyQuaternion(new THREE.Quaternion(hq.x, hq.y, hq.z, hq.w).invert()).toArray();
      }
      this.vitalThrusts = (this.vitalThrusts ?? 0) + 1;
    }
    if (lowEntry && down) this.tap.foe = f.foe; // 낮은 상대 진입: 시작한 상대 (바뀌면 거둔다)
    // 칼 길 잡기(R6): 칼이 맞닿았으면 그 칼 선 (아니면 null). 바로 앞 찌르기가 끝나고 bindRest 초 안의 탭(연타)은 잡지 않는다
    this.tap.bound = down || this.sinceThrust < THRUST.bindRest ? null : this.boundAxis();
    this.thrusts++;
    if (down) {
      // 쓰러진 상대: 누운 몸 점이 닿는 곳(finish.js plunge.inside) 밖이고 걸어서 닿으면(plunge.walk) 걸어 들어간다 (plungePose — 디딤마다 본다).
      //  AI(step:false — 제 걸음은 AI 가 정한다)·무릎 꿇은 채는 걷지 않고 그 자리에서 찍는다
      const tp = this.tap;
      tp.walkOk = step !== false && f.state === 'stand';
      if (tp.walkOk && (lowEntry ? f.finish.plunge.walk || f.finish.plunge.surfaceWalk : f.finish.plunge.walk)) tp.walking = true;
    } else if (step && f.state === 'stand' && !rangeCommit) {
      // 한 걸음 내딛으며 찌른다 (약한 자세 간격 맞추기 뒤엔 이미 걸었다 — 내딛지 않는다)
      if (f.gait?.active) f.gait.requestStep({ kind: 'lunge', fwd: THRUST.step, duration: 0.3 });
      else this.lunge = SKILL.lungeTime;
    }
    return true;
  }

  /**
   * 약한 자세 탭 찌르기의 간격 맞추기 (샛별 저장소 8bbee803 의 뜻, FINISH.vital): 칼끝이 목표 바로 앞에 오는 거리(무기 길이 기준, measureThrustRange)까지
   *  조이스틱처럼 앞뒤로 걷고, 그동안 칼을 목표 쪽으로 겨눈 자세(덧씌우기)를 잡는다. 거리·겨눔이 맞으면 그 자리에서 찌른다(thrust rangeCommit).
   *  거둠: 조이스틱을 밂 · 상대·무기·자세가 바뀜 · 빈틈이 닫힘 · VITAL.rangeTimeout 초 · 1 m 넘게 걸음 · 무릎 꿇은 채 안 맞음. 새 힘·빠르기 없음
   */
  updateVitalRange(dt) {
    const f = this.f;
    const R = this.vitalRange;
    const pose = this.thrustPose;
    if (!R) {
      // 거둔 뒤: 덧씌운 겨눔 자세를 0.12 s 에 내려놓는다
      if (!this.tap) pose.w = Math.max(0, pose.w - dt / 0.12);
      if (pose.w === 0 || this.tap) this.vitalRelease = false;
      return;
    }
    R.age += dt;
    const c = f.bodies.chest.translation();
    const travel = Math.hypot(c.x - R.origin.x, c.z - R.origin.z);
    // 사람의 뜻: 스틱 원값(main.js stickX·stickY)을 밀었거나 새로 칼을 끌었다 (inputActive). 이 함수·내딛기가 넣는 move 는 보지 않는다
    const manual = Math.hypot(f.stickX ?? 0, f.stickY ?? 0) > VITAL.manualDead || !!f.inputActive;
    const lost = !f.alive || !f.armed || f.weaponBroken || (f.state !== 'stand' && f.state !== 'kneel') || f.foe !== R.foe || f.weapon?.id !== R.weapon || this.pom;
    const V = !manual && !lost ? playerVitalThrust(f, VITAL.rangeTravel) : null;
    const m = V ? measureThrustRange(f, V.target) : null;
    if (!V || !m.valid || R.age > VITAL.rangeTimeout || travel > 1 || (f.state === 'kneel' && !m.ready)) {
      this.vitalRange = null;
      this.vitalRelease = true;
      this.lastVitalRange = manual ? 'manual' : lost ? 'lost' : !V ? 'closed' : R.age > VITAL.rangeTimeout ? 'timeout' : 'unreachable';
      (this.vitalRangeEnds ||= {})[this.lastVitalRange] = (this.vitalRangeEnds[this.lastVitalRange] ?? 0) + 1; // 재기만
      // 빈틈이 닫혔거나 못 맞췄으면 탭을 버리지 않고 그 자리에서 보통 찌르기 (사람이 거두지 않은 탭이 허공에 사라지지 않게 — 우리 쪽 고침)
      if (!manual && !lost) this.thrust({ step: false, vital: null, rangeCommit: true });
      return;
    }
    // 겨눔 자세: 손은 어깨에서 팔 길이 85 % 안, 칼끝은 칼자루 → 목표
    const sh = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (f.side ?? 1));
    const off = new THREE.Vector3(...R.hand).sub(sh);
    const ready = (ARM.upper + ARM.fore - ARM.slack) * 0.85;
    if (off.length() > ready) R.hand = off.setLength(ready).add(sh).toArray();
    const sp = f.sword.translation();
    _yawInv.copy(f.yaw).invert();
    const dir = V.target.clone().sub(_q.set(sp.x, sp.y, sp.z)).normalize().applyQuaternion(_yawInv);
    pose.w = Math.min(1, pose.w + dt / 0.15);
    for (let k = 0; k < 3; k++) (pose.hand[k] = R.hand[k]), (pose.dir[k] = dir.getComponent(k));
    const b = THRUST.body;
    pose.pelvisYaw = b.pelvisYaw * D2R;
    pose.chestYaw = b.chestYaw * D2R;
    pose.pitch = b.pitch * D2R;
    pose.drop = b.drop;
    this.thrustPush = false;
    this.activity = Math.max(this.activity, pose.w);
    if (m.ready && m.aligned) {
      this.vitalRange = null;
      f.move.y = 0;
      this.lastVitalRange = 'committed';
      this.thrust({ step: false, rangeCommit: true });
    } else {
      f.move.y = m.move;
    }
  }

  /**
   * 찌르기 목표점 (몸 기준): 쓰러진 상대는 칼끝이 찔러 들어갈 끝(누운 몸 중심 너머, finish.js plunge.tip) / 머리 / 가슴.
   * 몸통은 가슴을 겨눈다 — 배 쪽은 칼자루를 쥔 상대의 두 팔뚝이 앞을 가려 칼끝이 팔에 먼저 걸린다 (측정: 첫 접촉의 3/4이 팔)
   */
  thrustTarget(out) {
    const f = this.f;
    const tp = this.tap;
    if (tp.down) {
      const T = f.finish.plunge.tip;
      return out.set(T[0], T[1], T[2]);
    }
    if (tp.vital) {
      // 약한 자세 겨눔: 탭 때 고정한 세계 점 (VITAL.track: 겨누는 동안은 상대 머리에 붙은 점을 따라가다 뻗을 때 고정)
      const V = tp.vital;
      if (V.local && tp.t < tp.K.aim) {
        const hp = f.foe.bodies.head.translation();
        const hq = f.foe.bodies.head.rotation();
        out.fromArray(V.local).applyQuaternion(_sq.set(hq.x, hq.y, hq.z, hq.w)).add(_u.set(hp.x, hp.y, hp.z));
        V.target = out.toArray();
      } else out.fromArray(V.target);
      return out.sub(_c).applyQuaternion(_yawInv);
    }
    const foe = f.foe;
    // 떨어진 머리(참수)·죽은 상대의 머리는 겨누지 않는다: 가슴으로 (gun.js headOff)
    out.copy(foe.bodies[tp.head && !headOff(foe) ? 'head' : 'chest'].translation());
    return out.sub(_c).applyQuaternion(_yawInv);
  }

  /**
   * 칼 길 잡기(R6): 찌르기를 시작할 때 내 칼과 상대 칼이 맞닿아(THRUST.bind m 안) 있으면 지금 내 칼 선(몸 기준 단위 벡터)을,
   * 아니면 null. 맞닿은 채로 칼끝을 목표로 크게 돌리면 상대 칼을 쓸고 지나가다 걸리므로, 이 선을 거의 그대로 따라 민다(updateThrust)
   */
  boundAxis() {
    const f = this.f;
    const foe = f.foe;
    if (!(THRUST.bind > 0) || !foe?.armed || foe.weaponBroken) return null;
    if (segDist(f.bladePoint(0, _u), f.bladePoint(1, _b), foe.bladePoint(0, _c), foe.bladePoint(1, _p)) > THRUST.bind) return null;
    const q = f.sword.rotation();
    _sq.set(q.x, q.y, q.z, q.w);
    _yawInv.copy(f.yaw).invert();
    const ax = _u.set(0, 1, 0).applyQuaternion(_sq).applyQuaternion(_yawInv).toArray();
    // 칼끝이 이미 목표 줄에 있을 때만(목표 방향과 bindAim 도 안) 맞댄 채 민다 — 아니면 몸을 비껴간다
    //  (측정: 숨 고르고 찌른 탭에서는 칼 길을 잡은 탭의 상처율이 오히려 낮았다. 효과는 앞 찌르기로 칼이 줄에 놓인 연타에서만 났다)
    if (THRUST.bindAim < 180) {
      const c = f.bodies.chest.translation();
      _c.set(c.x, c.y, c.z);
      const P = this.thrustTarget(_p);
      const h0 = this.tap.h0;
      _b.set(P.x - h0[0], P.y - h0[1], P.z - h0[2]).normalize();
      if (_b.x * ax[0] + _b.y * ax[1] + _b.z * ax[2] < Math.cos(THRUST.bindAim * D2R)) return null;
    }
    return ax;
  }

  /** 매 스텝: 찌르기 자세(thrustPose) 갱신 */
  updateThrust(dt) {
    const tp = this.tap;
    const pose = this.thrustPose;
    const f = this.f;
    const T = THRUST;
    const K = tp?.K; // 이번 찌르기의 시간·뻗는 거리 (무기의 찌르기 장점 반영)
    if (tp) tp.t += dt * f.stamina.attackSpeed;
    this.thrustPush = false;
    // 찍기(tp.down)의 끝은 시간이 아니라 몸의 일(plungePose 의 tEnd): 끝난 뒤 자세로 돌아오는 시간만 잰다
    if (!tp || tp.t >= (tp.down ? (tp.tEnd ?? Infinity) + K.recover : K.aim + K.extend + K.hold + K.recover) || !f.alive || !f.armed || !f.foe) {
      this.tap = null;
      pose.w = 0;
      return;
    }
    // 넘어졌거나(서 있지도 무릎 꿇지도 않음) 내리찌르던 상대가 일어나면 더 뻗지 않고 곧바로 돌아온다:
    //  지금 덧씌운 정도(w)에서 돌아오는 시간 동안 0으로 (한 스텝에 끊으면 칼이 튄다). 팔 유효 질량도 더는 싣지 않는다
    if (!tp.abort && ((f.state !== 'stand' && f.state !== 'kneel') || (tp.down && (!f.finish.on || (tp.foe && tp.foe !== f.foe))) || (tp.vital && (tp.vital.foe !== f.foe || f.foe.decapitated)))) {
      tp.abort = { t: tp.t, w: pose.w };
    }
    if (tp.abort) {
      const r = (tp.t - tp.abort.t) / K.recover;
      if (r >= 1) {
        this.tap = null;
        pose.w = 0;
      } else pose.w = tp.abort.w * (1 - r);
      return;
    }
    if (tp.down) {
      this.plungePose(tp, K);
      return;
    }
    const t = tp.t;
    const end = K.aim + K.extend + K.hold;
    this.thrustPush = t >= K.aim && t < end;
    if (tp.step && t < K.aim + K.extend && f.move.y > -0.2) f.move.y = Math.max(f.move.y, SKILL.lungeMove * this.level);
    // 덧씌우는 정도: 겨누며 빠르게 1로, 뻗은 뒤 자세로 돌아오며 0으로
    pose.w = t < K.aim ? (tp.w0 ? tp.w0 + (1 - tp.w0) * (t / K.aim) : t / K.aim) : t < end ? 1 : 1 - (t - end) / K.recover;
    const c = f.bodies.chest.translation();
    _c.set(c.x, c.y, c.z);
    _yawInv.copy(f.yaw).invert();
    const P = this.thrustTarget(_p);
    // 손: 찌르기 시작 때의 손 목표에서 목표점 쪽으로 칼 선을 따라 뻗는다. 겨누는 동안 칼 선 뒤로 조금 당겼다가(준비)
    //  뻗어서 손이 속도를 붙일 거리를 번다
    const h0 = tp.h0;
    _q.set(P.x - h0[0], P.y - h0[1], P.z - h0[2]).normalize();
    // 칼 길 잡기(R6): 칼이 맞닿은 채 찌르면 지금 칼 선을 bindTurn 만큼만 목표 쪽으로 틀어 그 선으로 민다 (칼끝을 크게 돌리지 않는다)
    const bd = tp.bound;
    if (bd) _q.multiplyScalar(THRUST.bindTurn).add(_u.set(bd[0], bd[1], bd[2]).multiplyScalar(1 - THRUST.bindTurn)).normalize();
    //  팔이 이미 굽어 있으면(황소처럼 손이 머리 옆) 당길 필요가 없다 — 어깨에서 손까지 거리로 가늠한다.
    //  (칼이 맞닿았으면 당기지 않고 곧게 민다. 쓰러진 상대는 plungePose)
    const ext = Math.hypot(h0[0], h0[1] - 0.1, h0[2] - 0.2); // 어깨(가슴 기준 [0, 0.1, 0.2])에서 손까지
    const ch = bd ? 0 : T.chamber * THREE.MathUtils.clamp((ext - 0.36) / 0.12, 0, 1);
    const a = THREE.MathUtils.clamp(t / K.aim, 0, 1);
    const s = THREE.MathUtils.clamp((t - K.aim) / K.extend, 0, 1);
    const e = -ch * a * a * (3 - 2 * a) + (ch + K.reach) * s * s * (3 - 2 * s);
    for (let k = 0; k < 3; k++) pose.hand[k] = h0[k] + _q.getComponent(k) * e;
    if (bd) {
      // 칼끝은 민 선 그대로 (돌리지 않는다)
      pose.dir[0] = _q.x;
      pose.dir[1] = _q.y;
      pose.dir[2] = _q.z;
      tp.dir = pose.dir;
    }
    // 칼끝: 겨누는 동안은 지금 손(칼자루)에서 목표점 너머 past 의 점을 향해 돌리고, 뻗기 시작하면 그 방향을 붙잡는다.
    //  뻗는 동안 손은 거의 칼 축 방향으로 가는데(측정 0.96), 방향을 계속 고쳐 잡으면 손목이 5~9° 늦게 따라 돌며
    //  칼끝이 옆으로 쓸려 칼 축 방향 성분이 0.7까지 떨어졌다 → 붙잡아 두면 칼끝은 손과 함께 칼 축을 따라 나간다
    //  (쓰러진 상대는 plungePose 가 칼끝을 매 스텝 고쳐 잡는다)
    if (!bd && (t < K.aim || !tp.dir)) {
      const sp = f.sword.translation();
      P.addScaledVector(_q, T.past);
      _q.set(sp.x, sp.y, sp.z).sub(_c).applyQuaternion(_yawInv);
      P.sub(_q).normalize();
      pose.dir[0] = P.x;
      pose.dir[1] = P.y;
      pose.dir[2] = P.z;
      if (t >= K.aim) tp.dir = [P.x, P.y, P.z];
    }
    const b = T.body;
    pose.pelvisYaw = b.pelvisYaw * D2R;
    pose.chestYaw = b.chestYaw * D2R;
    pose.pitch = b.pitch * D2R;
    pose.drop = b.drop;
  }

  /**
   * 손잡이 찍기 (Knaufschlag, 시제품 — 사장님 아이디어 3], docs/strike/pommel_strike_2026-10-09.md, config.js POMMEL).
   *  붙은 거리에서 칼자루를 가슴 높이로 당기며 칼끝을 위·뒤로 세우고(chamber), 폼멜을 상대 얼굴(또는 윗가슴)로 내지른 뒤(drive·hold)
   *  자세로 돌아온다(recover). 손 자리만 옮기는 길(패드 점)로는 안 된다 — 자세 지도는 손과 칼끝 방향을 함께 정해서 손을 앞으로 내밀면
   *  칼끝도 앞으로 돈다(베기·찌르기가 된다). 그래서 탭 찌르기처럼 덧씌우기 칸(thrustPose)에 손·칼끝·몸을 w 만큼 덮는다.
   *  combat 은 그대로: 자루(part 'hilt')가 닿으면 지금처럼 둔타로 센다. 찌르기·찍기 중이거나 서 있지 않으면 받지 않는다
   * @param opt.target 'head' | 'chest' (기본 POMMEL.target)
   * @param opt.step false 면 내딛지 않는다 (기본: POMMEL.step 만큼 한 걸음 — 팔만으로는 붙은 거리에서도 폼멜이 얼굴에 못 닿는다, 문서 탐침)
   * @returns 시작했으면 true
   */
  pommel({ target = POMMEL.target, step = true } = {}) {
    const f = this.f;
    if (f.stamina.exhausted || this.tap || this.pom || !f.alive || !f.armed || !f.foe || f.weapon?.gun || f.state !== 'stand') return false;
    const g = f.handBase || f.guardPose.hand; // 지금 손 목표 (덧씌우기 전, driveSword 가 매 스텝 적는다)
    this.pom = { t: 0, h0: g ? [g[0], g[1], g[2]] : [0.3, -0.2, 0.12], head: target === 'head' && !headOff(f.foe), go: null };
    this.pommels++;
    f.stamina.attack('cut'); // 기력: 사람·AI 같은 규칙(설계안 §1) — AI 찍기(persona.close then 'pommel')는 startStrike 를 거치지 않으니 여기서 한 번 (10/16 감독: 들여온 판은 사람만 청구 — D14)
    // 한 걸음 내딛으며 찍는다 (찌르기와 같은 요청 꼴: gait lunge 0.3 s — 당기는 동안 발이 나가 내지를 때 딛는다)
    if (step && POMMEL.step > 0 && f.gait?.active) f.gait.requestStep({ kind: 'lunge', fwd: POMMEL.step, duration: 0.3 });
    return true;
  }

  /** 매 스텝: 손잡이 찍기 자세(thrustPose) 갱신 */
  updatePommel(dt) {
    const p = this.pom;
    const pose = this.thrustPose;
    const f = this.f;
    const P = POMMEL;
    p.t += dt * f.stamina.attackSpeed;
    const end = P.chamber + P.drive + P.hold;
    if (p.t >= end + P.recover || !f.alive || !f.armed || !f.foe) {
      this.pom = null;
      pose.w = 0;
      return;
    }
    // 넘어지면 더 내지르지 않고 지금 덮은 정도에서 돌아온다 (찌르기 tp.abort 와 같은 꼴)
    if (!p.abort && f.state !== 'stand') p.abort = { t: p.t, w: pose.w };
    if (p.abort) {
      const r = (p.t - p.abort.t) / P.recover;
      if (r >= 1) {
        this.pom = null;
        pose.w = 0;
      } else pose.w = p.abort.w * (1 - r);
      return;
    }
    const t = p.t;
    pose.w = t < P.chamber ? t / P.chamber : t < end ? 1 : 1 - (t - end) / P.recover;
    // 칼끝: 위·뒤 (몸 기준, 옆 0). 폼멜은 손에서 −dir 쪽 knob 거리
    const el = P.elev * D2R;
    const dx = -Math.cos(el);
    const dy = Math.sin(el);
    pose.dir[0] = dx;
    pose.dir[1] = dy;
    pose.dir[2] = 0;
    // 칼끝을 옆으로 돌려 세우기(POMMEL.side > 0): 당기는 동안 칼끝 목표를 칼 든 쪽 옆(+옆)으로 먼저 보냈다가 위·뒤로 —
    //  앞을 겨누던 칼끝이 상대 앞(팔·머리)을 올려 쓸지 않고 내 옆으로 돌아 선다. 0 = 곧장 (덧씌우기 w 가 섞는 길)
    if (P.side > 0 && t < P.chamber) {
      const a = 1 - t / P.chamber;
      pose.dir[0] = dx * (1 - a);
      pose.dir[1] = dy * (1 - a) + 0.3 * a;
      pose.dir[2] = P.side * a;
      const n = Math.hypot(pose.dir[0], pose.dir[1], pose.dir[2]);
      for (let k = 0; k < 3; k++) pose.dir[k] /= n;
    }
    // 당긴 자리 C: 가슴 앞 몸 가까이, 옆은 시작 손의 절반
    const h0 = p.h0;
    const C0 = P.pull[0];
    const C1 = P.pull[1];
    const C2 = h0[2] * 0.5;
    if (t < P.chamber || !p.go) {
      // 목표: 폼멜 가운데가 상대 머리(가슴)에 오도록 손 자리 = 목표 + dir·knob, 그 너머로 past (당긴 자리 → 손 자리 방향).
      //  내지르기 시작하면(t ≥ chamber) 붙잡는다 — 찌르기 칼끝 방향을 붙잡는 것과 같은 까닭(계속 고치면 손이 옆으로 쓸린다)
      const c = f.bodies.chest.translation();
      _c.set(c.x, c.y, c.z);
      _yawInv.copy(f.yaw).invert();
      const foe = f.foe;
      const T = _p.copy(foe.bodies[p.head && !headOff(foe) ? 'head' : 'chest'].translation()).sub(_c).applyQuaternion(_yawInv);
      T.x += dx * P.knob;
      T.y += dy * P.knob;
      _q.set(T.x - C0, T.y - C1, T.z - C2);
      const n = _q.length();
      if (n > 1e-6) T.addScaledVector(_q, P.past / n);
      if (t >= P.chamber) p.go = [T.x, T.y, T.z];
      else p.aim = [T.x, T.y, T.z];
    }
    const H = p.go ?? p.aim;
    if (t < P.chamber) {
      const a = t / P.chamber;
      const k = a * a * (3 - 2 * a);
      pose.hand[0] = h0[0] + (C0 - h0[0]) * k;
      pose.hand[1] = h0[1] + (C1 - h0[1]) * k;
      pose.hand[2] = h0[2] + (C2 - h0[2]) * k;
    } else {
      const s = Math.min(1, (t - P.chamber) / P.drive);
      const k = s * s * (3 - 2 * s);
      pose.hand[0] = C0 + (H[0] - C0) * k;
      pose.hand[1] = C1 + (H[1] - C1) * k;
      pose.hand[2] = C2 + (H[2] - C2) * k;
    }
    const b = P.body;
    pose.pelvisYaw = b.pelvisYaw * D2R;
    pose.chestYaw = b.chestYaw * D2R;
    pose.pitch = b.pitch * D2R;
    pose.drop = b.drop;
  }

  // ───────────────────────── 플레이어 비기 (10/9 23:5x — docs/strike/player_secret_2026-10-09.md) ─────────────────────────
  //  사장님 '인간 플레이어로서는 비기를 아예 못 쓰겠어' → 창(secret.js PlayerSecretWatch, main.js)이 열린 동안 공격 입력이 오면 secret() 로 완벽 실행.
  //  pommel() 시제품과 같은 꼴(칼을 잠깐 대본대로 움직이고 끝나면 조작으로) — 다만 덧씌우기 칸 대신 손 목표(handOffset)를 AI 와 같은 패드 길로 옮긴다
  //  (ai.js moveHand 와 같은 '제한 속도로 목표점 쫓기'). 길·걸음·터뜨림 창·경직은 AI 비기(ai.js secretGo·secretRelease·secretStiffen)와 같은 칸을 읽는다.
  //  반응 지연 0(창이 이미 지금 모습으로 봤다) · 정확도 1(길 그대로) · 손 속도 배율(do.hand·loopHand 또는 SECRET.handSpeed) · 서보 힘 창(powerMul) · 몸의 힘(do.strength) ·
  //  결정타 판정 배율(secretHit = SECRET.hitMul, 베기 길·따라 지나감 동안) · 경직(SECRET.stiff — 그동안 칼·발 조작이 안 듣고 칼은 그 자리에 멈춤: holdStiff, 10/10 20:5x). 손 빠르기 바탕은 AI 보통 난이도(AI_LEVELS.normal)

  /**
   * 플레이어 비기 시작. o = { S(유파 비기 schools.js *_SECRET), ctx(창을 연 상대 사건 — 독일은 들어오는 줄) }. 시작했으면 true
   */
  secret(o) {
    const f = this.f;
    if (f.stamina.exhausted || this.sec || this.tap || this.pom || !o?.S || !f.alive || !f.armed || f.state !== 'stand' || !f.foe) return false;
    const S = o.S;
    const D = S.do;
    const school = f.swordArt?.school;
    const byName = school?.techByName ?? {};
    const hand = [f.handOffset.x, f.handOffset.y];
    const nearest = (names) => {
      let best = null;
      let bd = 1e9;
      for (const n of [].concat(names ?? [])) {
        const t = byName[n];
        if (t && padD(hand, t.from) < bd) {
          bd = padD(hand, t.from);
          best = t;
        }
      }
      return best;
    };
    const run = { S, ctx: o.ctx ?? null, tr: f.swordArt.tradition, stage: null, t: 0, queue: [], cur: null, path: [], landed: false, bound: false, str0: f.strength, painFoe: f.foe.pain, painMe: f.pain };
    if (D.break) {
      // 독일 Versetzen: 들어오는 줄을 깨는 비밀 베기 (창을 연 위협의 줄)
      const th = run.ctx ?? {};
      const key = th.line === 'thrust' ? (th.high ? 'thrustHigh' : 'thrust') : th.line;
      const t = nearest(D.break[key]) ?? nearest(school?.counter?.[th.line] ?? school?.counter?.default);
      if (!t) return false;
      run.queue.push(t);
      run.bind = D.bind ? byName[D.bind] ?? null : null;
    } else if (D.back && SECRET.instant && D.instant) {
      // 일본 순간 베기 (10/10): 물러남·담기 없이 곧장 — 이번 스텝 끝(combat.afterStep)에 내딛음·끝 자세·쓸린 자리 상처 (secret_instant.js, AI 와 같은 실행부)
      run.stage = 'instant';
      run.instant = true;
      run.end = D.tech.path[D.tech.path.length - 1];
      if (SECRET.iai) requestIai(f, { player: true }); // 10/10 발도: 지금 손 → 왼 허리 → 가로 (전체 iaiPlayerTime)
      else requestInstant(f, { endPad: run.end });
      this.secretBursts++;
    } else if (D.back) {
      run.stage = 'back'; // 일본 後の先 ①: 물러서며 脇構え 로 끌어 담기
    } else if (D.flow) {
      // 이베리아 멈추지 않는 흐름 (10/11 — schools.js IBERIAN_SECRET): 비기를 낸 끌기의 방향(o.dir — main.js, 톡이면 걸러진 손 목표 속도)을 이어받아
      //  지금 손에서 곧장 번갈아 올려베기 → 머리 위 돌려 큰 한 칼. 칼 길·빠르기는 비기가 맡고 발(스틱)은 플레이어 것 (AI 와 같은 수 — secret.js montanteFlowSeq)
      const dir = o.dir && Math.hypot(o.dir[0], o.dir[1]) > 1e-6 ? o.dir : [this.aimVel.x, this.aimVel.y];
      for (const t of montanteFlowSeq(hand, dir, D, f)) run.queue.push(t);
      run.flow = true;
    } else if (D.path && SECRET.iberianSweep) {
      // 이베리아 휩쓸기 (10/10 02:5x): 사이드스텝(스틱이 옆을 누르면 그쪽, 아니면 오른쪽) + 머리 위 큰 고리 + 사선 — AI 와 같은 실행부
      run.stage = 'instant';
      run.instant = true;
      requestSweep(f, { side: Math.abs(f.stickX ?? 0) > 0.3 ? Math.sign(f.stickX) : 1 });
      this.secretBursts++;
    } else if (D.path) {
      // 이베리아: 몸 뒤 고리를 돌다(준비) 터뜨림 창에 들면 고리 꼭대기에서 사선으로
      run.loop = (D.loop ?? []).map((p) => p.slice());
      run.tech = { name: S.name, from: D.loop ? D.loop[D.loop.length - 1] : hand, path: D.path, kind: 'cut', reach: D.reach ?? 0 };
      const lat = secVal(D.side ?? 0) * (Math.abs(f.stickX ?? 0) > 0.3 ? Math.sign(f.stickX) : 1); // 옆걸음 쪽: 스틱이 옆을 누르고 있으면 그쪽, 아니면 오른쪽 [해석]
      const back = secVal(D.sideBack ?? 0);
      if (lat) run.loopStep = { kind: back < 0 ? 'retreat' : 'pass', fwd: back, side: lat };
      run.stage = 'loop';
    } else if (D.combo) {
      // 막기 연환 (10/11): 창을 연 막기의 자리(ctx.slot)의 두 수 — 이음새 고리 없이 앞 수 끝에서 곧장 (AI ai.js secretGo 와 같은 칸)
      const C = D.combo[run.ctx?.slot];
      if (!C) return false;
      for (const t of C.seq) run.queue.push({ ...t, step: t.step ? { ...t.step, fwd: secVal(t.step.fwd) * (t.step.back ? -1 : 1) } : undefined }); // back = 반걸음 물러남 (10/12 3 연격 마지막 수)
      run.flow = true;
      if (D.fast && secVal(D.fast)) {
        // 중국 빠른 연환 (10/12 — SECRET.cnFast): 두 수를 운동학 팔·칼로 길을 따라 (secret_instant.js requestCombo — AI 와 같은 실행부). 결과는 순간 베기와 같은 칸(instant)으로
        run.stage = 'instant';
        run.instant = true;
        requestCombo(f, { moves: run.queue.splice(0) });
        this.secretBursts++;
      }
      if (S.cond?.window === 'bind') run.gain = bindGain(run.ctx.held ?? 0); // 독일: 붙어 있던 만큼 판정 배율·힘 창 (secret.js bindGain)
    } else if (D.seq) {
      // 중국 連環三擊: 세 수를 이음새 0 으로 (첫 수부터 흐름 — 지금 손에서 곧장)
      for (const t of D.seq) run.queue.push({ ...t, step: t.step ? { ...t.step, fwd: secVal(t.step.fwd) } : undefined });
      run.flow = true;
    } else if (D.tech) {
      // 이탈리아 Passata in contratempo: 고유 passata sotto 길 + 뒷발 지나 보내기
      const base = byName[D.tech];
      if (!base) return false;
      run.queue.push(D.step ? { ...base, step: { ...D.step, fwd: secVal(D.step.fwd), push: secVal(D.step.push) } } : base);
    } else return false;
    this.sec = run;
    f.stamina.secret();
    this.recovering = false;
    this.cutPending = true;
    const st = (this.secretStats[S.name] ??= { fired: 0, landed: 0 });
    st.fired++;
    if (!run.stage) this.secretNextMove();
    return true;
  }

  /** 다음 수: 대기열의 기술로. 흐름(連環)이면 지금 손에서 물레 점·준비 자세를 지나 곧장 벤다(ai.js flowInto 와 같은 길), 아니면 준비 자세로 빠르게 옮긴 뒤 */
  secretNextMove() {
    const run = this.sec;
    const t = run.queue.shift();
    if (!t) return false;
    run.cur = t;
    this.f.stamina.attack(t.kind === 'thrust' ? 'thrust' : 'cut', true);
    run.bound = false;
    run.segHit = false;
    if (run.flow) {
      const h = [this.f.handOffset.x, this.f.handOffset.y];
      const mx = (h[0] + t.from[0]) / 2;
      run.path = t.pre ? [...t.pre.map((p) => p.slice()), t.from.slice()] : [[THREE.MathUtils.clamp(mx + Math.sign(mx || h[0] || 1) * 0.12, -0.6, 0.6), (h[1] + t.from[1]) / 2], t.from.slice()]; // 연환삼격 이음새 고리 (ai.js flowInto 와 같은 길)
      this.secretStrikeStart(true);
    } else {
      run.stage = 'chamber';
      run.t = 0;
    }
    return true;
  }

  /** 베기 길을 연다: 길 점 · 걸음 · 터뜨림(연출 수) · 찌르기 무기의 찌르기 */
  secretStrikeStart(keepPath) {
    const f = this.f;
    const run = this.sec;
    const t = run.cur;
    if (!keepPath) run.path = [];
    for (const p of t.path) run.path.push(p.slice());
    run.stage = 'strike';
    run.t = 0;
    run.stepAsked = false;
    if (!run.burst) {
      run.burst = true;
      this.secretBursts++; // 결정타 연출 (main.js 가 화면 시간을 잠깐 늦춘다)
      if (run.S.do.stance === 'lunge') startLunge(f); // 이탈리아 런지 자세 (10/10 04:2x)
    }
    // 걸음: 기술 걸음 칸이 있으면 그것(일본 앞발 lunge·이탈리아 뒷발 pass·중국 반걸음), 없으면 닿기에 모자랄 때 한 걸음 (AI stepTime 과 같은 뜻)
    const M = f.swordArt.measure;
    run.wantStep = t.step
      ? { kind: t.step.kind ?? 'lunge', fwd: t.step.fwd, side: t.step.lat ?? 0, duration: t.step.dur ?? 0.35, ...(t.step.push ? { push: t.step.push } : {}) }
      : f.foeDistance() - M.contact - (t.reach ?? 0) > 0.05
        ? { kind: t.kind === 'thrust' ? 'lunge' : 'pass', fwd: 0.6, duration: 0.35 }
        : null;
    // 찌르기 무기(레이피어·에스톡)의 찌르기 기술은 AI 처럼 칼끝 찌르기 덧씌우기로 (ai.js startStrike)
    if (t.kind === 'thrust' && f.weaponCfg.thrustStyle && !this.tap) this.thrust({ step: false });
  }

  /** 손 목표를 tx, ty 로 제한 속도 v(m/s 패드)로 (ai.js moveHand 와 같은 꼴). 닿았으면 true */
  secretMove(tx, ty, v, dt) {
    const off = this.f.handOffset;
    const dx = tx - off.x;
    const dy = ty - off.y;
    const dd = Math.hypot(dx, dy);
    const step = v * dt * this.f.stamina.attackSpeed;
    if (dd > step) {
      off.x += (dx / dd) * step;
      off.y += (dy / dd) * step;
      return false;
    }
    off.set(tx, ty);
    return true;
  }

  /** 지금 터뜨리면 닿을 때 거리 (ai.js secretDistAtHit 와 같은 식 — 지금 모습) */
  secretDistAtHit() {
    const f = this.f;
    const c = f.bodies.chest.translation();
    const fc = f.foe.bodies.chest.translation();
    const dx = fc.x - c.x;
    const dz = fc.z - c.z;
    const d0 = Math.max(0.01, Math.hypot(dx, dz));
    const fv = f.foe.bodies.pelvis.linvel();
    const mv = f.bodies.pelvis.linvel();
    const foeIn = -(fv.x * dx + fv.z * dz) / d0;
    const myIn = (mv.x * dx + mv.z * dz) / d0;
    return d0 - (Math.max(0, foeIn) + Math.max(0, myIn) * 0.7) * SECRET.releaseT;
  }

  /** 터뜨림 창 (do.release): 창에 들거나 이미 창보다 가까우면 true(터뜨림), maxHold 가 지나면 가까우면 치고 멀면 거둠('drop') */
  secretRelease(dt) {
    const run = this.sec;
    const R = run.S.do.release;
    const [lo, hi] = secVal(R.dist);
    const reach = this.f.swordArt.measure.reach;
    run.holdT = (run.holdT ?? 0) + dt;
    const dc = this.secretDistAtHit();
    // 창 안이면 터뜨린다. 창보다 이미 가까우면(상대가 달려듦) 기다리지 않고 곧장 — AI 는 maxHold 까지 기다리지만, 플레이어는 그 사이 맞아 끊기는 일이 잦았다(브라우저 시험) [해석]
    if (dc <= reach + hi && (dc >= reach + lo || this.f.foeDistance() < reach + lo)) return true;
    if (run.holdT > secVal(R.maxHold)) return dc > reach + hi ? 'drop' : true;
    return false;
  }

  /** 매 스텝 (skill.update 머리): 비기 단계 */
  updateSecret(dt) {
    const f = this.f;
    const run = this.sec;
    const D = run.S.do;
    const L = AI_LEVELS.normal;
    run.t += dt;
    const foe = f.foe;
    if (!f.alive || !f.armed || f.state !== 'stand' || !foe) return this.secretEnd();
    // 맞힘 (AI 와 같은 눈: 상대 아픔 +0.05)
    if (foe.pain > run.painFoe + 0.05 && (run.stage === 'strike' || run.stage === 'follow')) run.landed = run.segHit = true; // segHit: 이 토막이 맞힘 (이베리아 흐름 문 — 10/11)
    run.painFoe = foe.pain;
    const hurt = f.pain > run.painMe + 0.05;
    run.painMe = f.pain;
    // 준비·붙잡는 동안 맞으면 비기는 끊긴다 (AI 는 물러남) — 베기 길·경직 동안은 그대로
    if (hurt && (run.stage === 'chamber' || run.stage === 'back' || run.stage === 'hold' || run.stage === 'loop')) return this.secretEnd();
    const handMul = secVal(D.hand ?? 'handSpeed');
    const g = f.gait;
    const ask = (o) => !!(g?.requestStep && g.active && g.requestStep(o));
    if (run.stage === 'instant') {
      const R = f.instantResult;
      if (!R) return;
      if (!R.ok) return this.secretEnd();
      run.landed = R.hit;
      if (run.landed) this.secretStats[run.S.name].landed++;
      f.secretHit = 1;
      run.stage = 'stiff';
      run.t = 0;
      run.stiffT = SECRET.stiff[run.tr] ?? 0.3;
      return;
    }
    if (run.stage === 'back') {
      const B = D.back;
      this.secretMove(B.guard[0], B.guard[1], L.parrySpeed * handMul, dt);
      if (!run.stepAsked && run.t < 0.25) run.stepAsked = ask({ kind: 'retreat', fwd: secVal(B.fwd), side: 0, duration: 0.3 });
      const handIn = padD([f.handOffset.x, f.handOffset.y], B.guard) < 0.06;
      if ((handIn && (!g?.req || run.t > 0.6) && run.t > 0.15) || run.t > 0.8) {
        run.stage = 'hold';
        run.t = 0;
        run.holdT = 0;
      }
      return;
    }
    if (run.stage === 'hold') {
      const B = D.back;
      this.secretMove(B.guard[0], B.guard[1], L.parrySpeed, dt);
      const r = this.secretRelease(dt);
      if (r === 'drop') return this.secretEnd(true);
      if (r) {
        const T = D.tech;
        run.cur = { ...T, reach: secVal(T.reach), step: { ...D.step, fwd: secVal(D.step.fwd), push: secVal(D.step.push) } };
        this.secretStrikeStart();
      }
      return;
    }
    if (run.stage === 'loop') {
      // 이베리아 고리: 점을 차례로 (베기 빠르기 × loopHand), 처음 0.3 s 안에 옆(뒤)으로 비껴 딛기
      if (run.loopStep && run.t < 0.3 && ask({ ...run.loopStep, duration: 0.35 })) run.loopStep = null;
      const LP = run.loop;
      if (LP.length) {
        if (this.secretMove(LP[0][0], LP[0][1], L.strikeSpeed * secVal(D.loopHand ?? 'handSpeed'), dt)) LP.shift();
        return;
      }
      const r = this.secretRelease(dt);
      if (r === 'drop') return this.secretEnd(true);
      if (r) {
        run.cur = run.tech;
        this.secretStrikeStart();
        return;
      }
      run.loop = D.loop.map((p) => p.slice()); // 몬탄테는 멈추지 않고 돈다 — 고리 되풀이
      return;
    }
    if (run.stage === 'chamber') {
      const t = run.cur;
      if (this.secretMove(t.from[0], t.from[1], L.parrySpeed * handMul, dt) || run.t > 0.6) this.secretStrikeStart();
      return;
    }
    if (run.stage === 'strike') {
      const inLoop = !!run.cur?.pre?.length && run.path.length > run.cur.path.length; // 연환삼격 이음새 고리 동안 (10/10 04:4x): 검무 빠르기(loopHand), 힘 창·판정 배율 없음 — ai.js 와 같음
      f.powerMul = inLoop ? 1 : secVal(D.power ?? 'power') * (run.gain ?? 1); // run.gain: 독일 막기 연환 붙은 시간 어드밴티지 (없으면 1 — 다른 비기는 전과 같음)
      f.secretHit = inLoop ? 1 : SECRET.hitMul * (run.gain ?? 1);
      if (D.strength) f.strength = run.str0 * (inLoop ? 1 : secVal(D.strength));
      if (run.wantStep && !run.stepAsked && run.t >= 0.04 && run.t < 0.4) run.stepAsked = ask(run.wantStep);
      // 길목 디딤 (10/11 v6 6차): 걸음은 받아 줘도(다리) 플레이어 스틱이 0 이면 몸이 거의 안 따라갔다(브라우저: 가운데 선까지 몸 옮김 0.01~0.02 m). AI 는 내딛는 동안 스틱을
      //  앞으로 민다(ai.js moveFeet — stepT 동안 fwd 1, 맞닿기 − 0.1 보다 멀 때) → 같게: 걸음을 받은 뒤 0.3 s(ai.js STEP_T) 동안 스틱 앞 1. 길목만 (다른 유파 플레이어 비기는 전과 같다)
      if (D.gilmok && run.stepAsked && run.t < 0.04 + 0.3 && f.foeDistance() > f.swordArt.measure.contact - 0.1) f.move.y = Math.max(f.move.y, 1);
      // 칼끼리 맞물림 (ai.js checkBind 와 같은 기하)
      if (!run.bound && f.tipPrev && foe.tipPrev && segDist(f.bladePoint(0.1, _sf), f.tipPrev, foe.bladePoint(0.1, _sr), foe.tipPrev) < 0.07) run.bound = true;
      if (run.path.length) {
        const P = run.path[0];
        // 상대가 옆으로 비껴 있으면 그만큼 손을 옮겨 겨눈다 (ai.js moveHand 와 같음)
        const c = f.bodies.chest.translation();
        const fc = foe.bodies.chest.translation();
        const r = f.right(_sr);
        const lat = (fc.x - c.x) * r.x + (fc.z - c.z) * r.z;
        const tx = THREE.MathUtils.clamp(P[0] + THREE.MathUtils.clamp(lat, -0.4, 0.4) * 0.5, -0.6, 0.6);
        if (this.secretMove(tx, P[1], L.strikeSpeed * (inLoop ? secVal(D.loopHand ?? 'handSpeed') : handMul), dt)) run.path.shift();
        return;
      }
      // 길 끝: 대기열(連環 다음 수)로 곧장, 독일은 맞물렸고 못 맞혔으면 Duplieren 한 번, 아니면 따라 지나감
      // 이베리아 흐름 (10/11): 실제 칼이 토막 끝 자리에 갈 때까지 기다린다 (flowGate, 최대 FLOW_GATE_MAX, 이 토막이 맞혔으면 곧장 — ai.js secretStrikeEnd 와 같음).
      //  v6 길목 지키기의 한 칼은 마지막 토막에도 문이 있다(칼끝이 반대쪽으로 건너감) — v5 의 마지막 토막은 문이 없어 전과 같다
      if (run.cur?.gate) {
        run.gateT = (run.gateT ?? 0) + dt;
        if (!flowGate(f, run.cur.gate) && !run.segHit && run.gateT < FLOW_GATE_MAX) return; // 이 토막이 맞혔으면 기다리지 않는다
        run.gateT = 0;
      }
      if (run.queue.length) {
        this.secretNextMove();
        return;
      }
      if (run.bind && run.bound && !run.landed && !run.bindDone) {
        run.bindDone = true;
        run.flow = true;
        run.queue.push(run.bind);
        this.secretNextMove();
        return;
      }
      run.stage = 'follow';
      run.t = 0;
      f.powerMul = 1;
      if (D.strength) f.strength = run.str0;
      return;
    }
    if (run.stage === 'follow') {
      // 손은 끝 자세에 닿았지만 칼은 아직 지나가는 중 — 판정 배율은 칼이 지나갈 때까지
      if ((run.t >= 0.3 && f.tipVel.length() < 6) || run.t > 0.5) {
        f.secretHit = 1;
        if (run.landed) this.secretStats[run.S.name].landed++;
        run.stage = 'stiff';
        run.t = 0;
        run.stiffT = SECRET.stiff[run.tr] ?? 0.3;
      }
      return;
    }
    // 경직: 칼·발 조작이 안 듣는다 — 칼은 경직이 시작된 자리에 멈춤 (update → holdStiff), main.js 가 칼 입력·스틱을 막는다.
    //  (전: 순간 베기는 칼끝을 떨어뜨린 stiffPose 쪽으로 손 빠르기 ×stiffHand — 사장님 10/10 20:5x '손 빠르기 줄이지 말고 잠깐 아예 못 움직이게'로 없앰)
    if (run.stage === 'stiff') {
      if (run.t >= run.stiffT) this.secretEnd();
    }
  }

  /** 비기를 끝낸다 (끝·끊김): 힘·판정 배율·몸의 힘을 되돌리고 조작으로. dropped = 터뜨림 창을 못 만나 거둠 */
  secretEnd(dropped) {
    const f = this.f;
    const run = this.sec;
    this.sec = null;
    f.powerMul = 1;
    f.secretHit = 1;
    if (run && run.str0 != null) f.strength = run.str0;
    if (dropped) this.secretDropped = (this.secretDropped ?? 0) + 1;
    this.prev.copy(f.handOffset); // 손 목표 속도가 튀지 않게
    this.anchor.copy(f.handOffset);
  }

  /** 지금 비기 단계 (main.js HUD·입력 막기): null | 'run' | 'stiff' */
  get secretPhase() {
    return !this.sec ? null : this.sec.stage === 'stiff' ? 'stiff' : 'run';
  }

  /**
   * 찍기 (쓰러진 상대에게 탭, 사장님 9/30: "닿을 때까지 걸어들어가 … 양손을 번쩍 드는 동시에 칼날을 아래로 돌려잡고 힘껏 내려찍음").
   * finish.js 가 매 스텝 정한 fin.plunge(몸 점 T, 칼 방향 dir, 닿는 곳 inside·short)를 읽는다. 매 스텝 차례로:
   *  1) 걸어 들어가기: 몸 점이 닿는 곳 밖이고 걸어서 닿으면 앞으로 걷는다(내딛기와 같은 밀기). 끝은 발이 디딜 때 본다 — 닿는 곳에
   *     들어온 뒤 첫 디딤 · 한 걸음(디딤 → 디딤)이 몸 점을 가깝게 하지 못함 · 걸어서는 닿지 않게 됨(몸 점이 손 아래를 지남) ·
   *     플레이어가 물러남 · 서 있지 않음 · 그만두기(tp.abort)
   *  2) 겨눔: 칼자루를 머리 위 FINISH.hands 로 올리며 칼끝을 몸 점 너머로 겨눈다. 두 가지를 붙잡으면(latch) 찍는다(go):
   *     손이 올라옴 = 오르던 칼자루가 멈춘 봉우리가 머리 꼭대기 높이 이상이거나, 앞 봉우리보다 높지 않음(팔이 더 오르지 못함)
   *     칼이 선에 섬 = 칼 축 ↔ 몸 점 선 각의 골이 누운 몸 두께가 보이는 각(asin(top/거리)) 안이거나, 앞 골보다 낮지 않음(흔들림 바닥)
   *     그리고 걷기가 끝났고, 걸었으면 골반이 멈추거나 더 느려지지 않을 때
   *  3) 내려찍기: 찍기 시작 때 칼자루 G0 에서 몸 점 쪽 칼 선을 따라 팔이 닿는 끝까지 한 번에 손 목표를 둔다
   *     (빠르기는 근육이 정한다). 칼끝은 매 스텝 몸 점 너머로 다시 겨눈다. 끝은 칼자루가 칼 선을 따라 나아가다 멈춘 때:
   *     칼끝이 누운 몸 윗면 높이 아래면(몸·땅에 박힘) 끝, 아니면 앞 멈춤보다 더 나아가지 못했으면 끝(팔 끝)
   * 끝나는가: 걷기는 디딤마다 가까워지거나 끝난다(몸 점이 들어오거나, minFwd 뒤로 지나가면 finish 가 꺼져 그만둔다).
   *  봉우리·골·멈춤은 칼자루 흔들림(±0.04m, 약 5Hz)으로 되풀이되고, 두 번째로 나아지지 않는 것에서 끝난다.
   *  상대가 일어나거나 죽거나 내가 넘어지면 tp.abort. 시간으로 끝내는 것은 없다
   */
  plungePose(tp, K) {
    const f = this.f;
    const pose = this.thrustPose;
    const fin = f.finish;
    const pl = fin.plunge;
    // 낮은 상대 진입 (FINISH.entry 'low'): 걸어서 깊이(몸 너머 sink)까지 닿을 수 있으면 그 걸음을 끝까지, 아니면 몸 겉면에 닿는 것으로 된다.
    //  (끔이면 inside·walk·short 가 예전 pl.inside·pl.walk·pl.short 그대로)
    const lowEntry = lowFinishOn(FINISH);
    const canWalk = tp.walkOk && f.state === 'stand';
    const seekDepth = lowEntry && canWalk && pl.walk;
    const inside = lowEntry ? (seekDepth ? pl.inside : pl.surfaceInside) : pl.inside;
    const walk = lowEntry ? pl.walk || pl.surfaceWalk : pl.walk;
    const short = lowEntry && !seekDepth ? pl.surfaceShort : pl.short;
    const side = f.side ?? 1;
    const L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
    const c = f.bodies.chest.translation();
    _c.set(c.x, c.y, c.z);
    _yawInv.copy(f.yaw).invert();
    const sp = f.sword.translation();
    const G = _p.set(sp.x, sp.y, sp.z).sub(_c).applyQuaternion(_yawInv); // 칼자루 (몸 기준)
    const q = f.sword.rotation();
    const bAx = _u.set(0, 1, 0).applyQuaternion(_sq.set(q.x, q.y, q.z, q.w)).applyQuaternion(_yawInv); // 칼 축 (몸 기준)
    // ── 1) 걸어 들어가기 (시간으로 끝내지 않는다)
    //  찍기 전에 몸 점이 다시 닿는 곳 밖으로 나가면(겨누며 몸이 흔들려) 다시 걷는다
    if (tp.walkOk && !tp.go && !tp.walking && !tp.walkDone && walk && f.state === 'stand') {
      tp.walking = true;
      tp.crossed = false;
      tp.plantShort = null;
    }
    if (tp.walking) {
      tp.walked = true;
      const plant = f.gait?.active ? f.gait.sinceTD === 0 : true; // 발을 디딘 스텝 (다리 걸음이 없으면 매 스텝)
      if (f.state !== 'stand') tp.walking = false;
      else if (f.move.y <= -0.2) {
        tp.walking = false; // 플레이어가 물러선다: 여기서 찍는다
        tp.walkDone = true;
        tp.walkEnd = 'back';
      } else if (lowEntry && inside) {
        // 낮은 상대 진입: 상대가 스스로 닿는 곳에 들어왔으면 오지 않을 디딤을 기다리지 않는다
        tp.walking = false;
        tp.walkEnd = 'inside';
      } else if (tp.crossed) {
        if (plant) {
          tp.walking = false; // 닿는 곳에 들어온 뒤 첫 디딤
          tp.walkEnd = 'inside';
        }
      } else if (inside) tp.crossed = true; // 닿는 곳 안: 더 밀지 않고 디딜 때까지 기다린다
      else if (!walk) {
        tp.walking = false; // 걸어서는 닿지 않게 됐다 (몸 점이 손 아래를 지났다): 여기서 찍는다
        tp.walkDone = true;
        tp.walkEnd = 'unreachable';
      } else if (plant) {
        tp.plants = (tp.plants || 0) + 1;
        // 한 걸음(디딤 → 디딤)이 몸 점을 가깝게 하지 못했으면 멈추고 여기서 찍는다. 첫 디딤은 기준만 잡는다 (탭은 걸음 중간이라 견줄 수 없다)
        if (tp.plantShort != null && short >= tp.plantShort) {
          tp.walking = false;
          tp.walkDone = true;
          tp.walkEnd = 'noprogress';
        }
        tp.plantShort = short;
      }
      if (tp.walking && !tp.crossed) f.move.y = Math.max(f.move.y, lowEntry ? LOW_FINISH.approach : SKILL.lungeMove * this.level);
    }
    if (lowEntry && !inside && (tp.walkDone || !canWalk)) {
      tp.abort = { t: tp.t, w: pose.w }; // 낮은 상대 진입: 다 걸었거나 걸을 수 없는데 닿지 않으면 허공을 찍지 않고 거둔다
      return;
    }
    // ── 2) 겨눔 도착 (찍기 전): 손이 올라옴 · 칼이 선에 섬 을 붙잡는다
    if (!tp.go) {
      const y = G.y; // 칼자루 높이 (가슴 기준)
      if (tp.y != null) {
        const headTop = f.bodies.head.translation().y + f.headR - c.y; // 머리 꼭대기 (가슴 기준)
        let peakNow = false;
        let sat = false;
        if (y > tp.y) tp.rose = true;
        else if (tp.rose) {
          // 오르던 칼자루가 멈춘 곳(봉우리). 앞 봉우리보다 높지 않으면 팔이 더 오르지 못한다
          sat = tp.peak != null && tp.y <= tp.peak;
          tp.peak = Math.max(tp.peak ?? -Infinity, tp.y);
          tp.rose = false;
          peakNow = true;
        }
        if (!tp.upDone && ((peakNow && tp.peak >= headTop) || sat)) {
          tp.upDone = true;
          tp.upWhy = sat ? 'peak' : 'head';
        }
        const T = pl.T;
        const tx = T[0] - G.x;
        const ty = T[1] - G.y;
        const tz = T[2] - G.z;
        const tn = Math.hypot(tx, ty, tz); // 칼자루 → 몸 점 (머리 위 손이면 1.2m 넘게)
        const la = Math.acos(THREE.MathUtils.clamp((bAx.x * tx + bAx.y * ty + bAx.z * tz) / tn, -1, 1)); // 칼 축 ↔ 몸 점 선
        if (tp.upDone && bAx.y < 0 && tp.la != null && !tp.lineDone) {
          if (la < tp.la) tp.laFalling = true;
          else if (tp.laFalling) {
            tp.laFalling = false;
            const tol = Math.asin(FINISH.top / tn); // 칼 선이 누운 몸 두께 안으로 지나는 각
            if (tp.la <= tol || (tp.laMin != null && tp.la >= tp.laMin)) {
              tp.lineDone = true;
              tp.lineWhy = tp.la <= tol ? 'tol' : 'floor';
            }
            tp.laMin = Math.min(tp.laMin ?? Infinity, tp.la);
          }
        }
        tp.la = la;
        // 걸었으면 골반이 멈추거나 더 느려지지 않을 때 (낮은 상대 진입: 두 발이 다 디뎠을 때만)
        const planted = !lowEntry || !f.gait?.active || (f.gait.legs.F.stance && f.gait.legs.B.stance);
        const settled = !tp.walked || (planted && ((tp.pvPrev != null && tp.pv >= tp.pvPrev) || tp.pv <= 0));
        if (tp.t >= K.aim && tp.upDone && tp.lineDone && !tp.walking && settled) {
          tp.go = true;
          tp.tGo = tp.t;
          tp.G0 = [G.x, G.y, G.z];
        }
      }
      tp.y = y;
      tp.pvPrev = tp.pv;
    }
    {
      const pv = f.bodies.pelvis.linvel();
      const fw = _b.set(1, 0, 0).applyQuaternion(f.yaw);
      tp.pv = pv.x * fw.x + pv.z * fw.z; // 골반이 앞으로 가는 빠르기
    }
    // ── 3) 내려찍기: 칼 선 = 찍기 시작 때 칼자루 G0 → 몸 점
    let G0 = null;
    let u0x = 0;
    let u0y = 0;
    let u0z = 0;
    let n0 = 0;
    if (tp.go) {
      G0 = tp.G0;
      const ex = pl.T[0] - G0[0];
      const ey = pl.T[1] - G0[1];
      const ez = pl.T[2] - G0[2];
      n0 = Math.hypot(ex, ey, ez);
      u0x = ex / n0;
      u0y = ey / n0;
      u0z = ez / n0;
    }
    if (tp.go && !tp.ended) {
      // 끝 (시간이 아니라 몸의 일): 칼자루가 칼 선을 따라 나아가다 멈췄다
      const prog = (G.x - G0[0]) * u0x + (G.y - G0[1]) * u0y + (G.z - G0[2]) * u0z;
      const sv = f.sword.linvel();
      const uw = _b.set(u0x, u0y, u0z).applyQuaternion(f.yaw);
      const va = sv.x * uw.x + sv.y * uw.y + sv.z * uw.z;
      const tipLow = G.y + bAx.y * L <= pl.T[1] + FINISH.top; // 칼끝이 누운 몸 윗면 높이에 닿았거나 아래
      if (tp.va > 0 && va <= 0) {
        // 몸·땅에 박힘 / 앞 멈춤보다 더 나아가지 못함 (팔 끝)
        if (tipLow || (tp.revProg != null && prog <= tp.revProg)) {
          tp.ended = true;
          tp.tEnd = tp.t;
        }
        tp.revProg = Math.max(tp.revProg ?? -Infinity, prog);
      }
      tp.va = va;
    }
    this.thrustPush = !!tp.go && !tp.ended; // 팔 무게는 내려찍는 동안만 싣는다 (combat.js)
    // ── 4) 자세
    pose.w = tp.ended ? 1 - (tp.t - tp.tEnd) / K.recover : Math.min(1, tp.t / K.aim);
    if (!tp.go) {
      const hs = finishHands(); // 머리 위 겨눔 손 (10/13 FINISH.lift: 더 높이 — 끄면 FINISH.hands)
      pose.hand[0] = hs[0];
      pose.hand[1] = hs[1];
      pose.hand[2] = hs[2] * side;
    } else if (!tp.ended) {
      // 칼 선을 따라 팔이 닿는 끝까지 한 번에 (빠르기는 근육이 정한다). 칼끝이 몸 점 너머 sink 에 닿는 거리보다 짧지 않게
      //  (G0 는 팔이 놓은 곳이라 팔이 닿는 공 안 — 근이 실수. 만에 하나 아니면 비교가 거짓이라 칼끝 거리를 쓴다)
      const D = n0 + FINISH.sink - L;
      _u0[0] = u0x;
      _u0[1] = u0y;
      _u0[2] = u0z;
      const ray = armRay(G0, _u0, side);
      const D0 = ray >= D ? ray : D;
      for (let k = 0; k < 3; k++) pose.hand[k] = G0[k] + _u0[k] * D0;
    } // 끝난 뒤: 마지막 손 목표 그대로 돌아온다
    for (let k = 0; k < 3; k++) pose.dir[k] = pl.dir[k];
    // 몸: 허리 비틀기는 겨눔 그대로, 찍으면 숙이고 낮춘다
    const H = FINISH.hover;
    const B = tp.go ? FINISH.strike : FINISH.hover;
    pose.pelvisYaw = H.pelvisYaw * D2R;
    pose.chestYaw = H.chestYaw * D2R;
    pose.pitch = B.pitch * D2R;
    pose.drop = B.drop;
  }

  /**
   * 흐름 판단(SKILL.flow): 휘두르기가 멈추지 않은 채 끌기 방향이 flowTurn(rad) 넘게 휘어 돌면 흐름(this.flowing)이다.
   *  - 흐르는 동안 반 바퀴(새 베기)마다 한 걸음 내딛는다 (상대가 한 걸음 거리일 때)
   *  - 안전장치: 칼이 세게 막히면(fighter.jolt) 흐름이 끊기고 flowBreak 초 동안 다시 흐르지 못한다
   *  - 손을 멈추면(0.08초) 흐름이 끝나 예전처럼 자세에서 선다
   *  손목 제동을 풀어 칼이 관성으로 돌아 나가게 하는 것은 fighter.js 몫이다(this.flowing 을 읽으면 된다 — 디렉터가 넣는다)
   */
  updateFlow(dt, swinging) {
    const f = this.f;
    this.flowLock = Math.max(0, (this.flowLock ?? 0) - dt);
    if (f.jolt > 0.5) {
      this.flowing = false;
      this.flowTurn = 0;
      this.flowLock = SKILL.flowBreak;
    }
    if (!swinging) {
      this.flowQuiet = (this.flowQuiet ?? 0) + dt;
      if (this.flowQuiet > 0.08) {
        this.flowing = false;
        this.flowTurn = 0;
        this.flowDir = null;
      }
      return;
    }
    this.flowQuiet = 0;
    const a = Math.atan2(this.vel.y, this.vel.x);
    if (this.flowDir != null) {
      const da = Math.abs(Math.atan2(Math.sin(a - this.flowDir), Math.cos(a - this.flowDir)));
      this.flowTurn = (this.flowTurn ?? 0) + da;
      this.flowStepTurn = (this.flowStepTurn ?? 0) + da;
    }
    this.flowDir = a;
    if (!this.flowing && this.flowLock <= 0 && this.flowTurn > SKILL.flowTurn) {
      this.flowing = true;
      this.flows = (this.flows ?? 0) + 1;
      this.flowStepTurn = Math.PI; // 흐르기 시작하는 베기부터 내딛는다
    }
    if (this.flowing && this.flowStepTurn >= Math.PI && f.state === 'stand') {
      this.flowStepTurn = 0;
      const d = f.foeDistance();
      if (d > SKILL.lungeMin && d < SKILL.lungeMax && !(f.finish?.amt > 0.5)) {
        if (f.gait?.active) f.gait.requestStep({ kind: 'pass', fwd: 0.3, duration: 0.3 });
        else this.lunge = SKILL.lungeTime;
      }
    }
  }

  /**
   * 들어가며 막기(R3 — 짧은 한손 칼, weapons.js enterParry): 상대가 휘두른 칼을 내 칼로 받아 낸 순간 한 걸음 앞으로 들어간다.
   *  긴 칼이 닿고 짧은 칼은 못 닿는 띠를 막은 칼로 덮은 채 건너, 긴 칼이 옹색한 안쪽으로 간다 (AI 는 거기서 되받아 친다).
   *  내가 휘두르던 중(내 공격이 막힌 것)이면 아니다
   */
  enterParry(dt) {
    const f = this.f;
    const foe = f.foe;
    this.enterCool = Math.max(0, (this.enterCool ?? 0) - dt);
    if (this.enterCool > 0 || f.jolt < SKILL.enterJolt || f.state !== 'stand' || !foe?.alive) return;
    if (this.activity > 0.5 || (foe.skill?.activity ?? 0) < 0.5) return;
    const d = f.foeDistance();
    if (d < SKILL.enterMin || d > SKILL.lungeMax) return;
    this.enterCool = SKILL.enterCool;
    this.enters = (this.enters ?? 0) + 1;
    if (f.gait?.active) f.gait.requestStep({ kind: 'pass', fwd: SKILL.enterStep, duration: 0.3 });
    else this.lunge = SKILL.lungeTime;
  }

  /**
   * 비기 경직 (사장님 10/10 20:5x '손 빠르기 줄이지 말고 잠깐 아예 못 움직이게'): 걸러진 손 목표(aim — 서보가 쫓는 자리)를 경직이 시작된 자리에 붙든다.
   *  손 목표(handOffset)·가죽끈·이어 베기·거르기를 모두 그 자리로 맞추고 속도는 0 → 칼이 처지거나 흔들리지 않고 서보가 그 자리를 붙든다.
   *  휘두름(내딛기)·들어가며 막기·흐름·자세로 돌아가기 없음. 몸은 물리대로(맞고 밀림·균형 걸음은 gait 몫)
   */
  holdStiff(dt) {
    const f = this.f;
    const off = f.handOffset;
    if (!this.stiffHeld) off.copy(this.aim); // 경직이 시작된 자리
    this.stiffHeld = true;
    this.prev.copy(off);
    this.anchor.copy(off);
    this.aimRaw.copy(off);
    this.aim.copy(off);
    this.vel.set(0, 0);
    if (this.inputMotion) { this.inputMotion.prev.copy(off); this.inputMotion.vel.set(0, 0); }
    this.inputSwinging = false;
    this.follow.set(0, 0);
    this.aimVel.set(0, 0);
    this.swinging = false;
    this.flowing = false;
    this.lunge = 0;
    this.activity += (0 - this.activity) * Math.min(1, dt / 0.4);
    this.quiet += dt;
    this.idle = f.inputActive ? 0 : this.idle + dt;
    this.lift = !!this.heldPrev && !f.handHeld;
    this.heldPrev = !!f.handHeld;
    if (this.corr === 'v2' && this.level > 0) this.idleGoal = 0;
  }

  /**
   * 사람 휘두르기 헛침 (10/15 독일 간격 잡기 — docs/strike/german_chase_2026-10-15.md): AI 가 몰지 않는 몸만(AI 는 ai.js afterStrike 의 missed 가 알린다).
   *  한 번의 공격 = 휘두르기(또는 탭 찌르기)가 이어진 동안 + 손이 멈춘 뒤(UNIQUE_ASSIST.onsetQuiet) 칼이 다 지나갈 때까지(AI follow 와 같은 꼴: 0.3 s 지나고
   *  칼끝이 6 m/s 아래로, 늦어도 0.5 s). 그 사이 다시 휘두르면 같은 공격으로 잇는다 — 감기 + 긋기, 잇따른 긋기는 한 번(AI 도 감기·베기·지나감이 한 공격) · 그 사이 한 번이라도 닿으면 헛침 아님.
   *  맞힘 = 상대 아픔 +0.05(AI hitLanded·unique_assist 와 같은 눈) · 맞물림 = 칼끼리 0.07 m(ai.js checkBind 와 같은 기하). 끝날 때 둘 다 없으면 상대 걸음에 알린다
   *  (gait.foeWhiff — 독일 유파 몸만 받음). 손 목표·몸·난수는 건드리지 않는다
   */
  whiffTrack(dt, swinging) {
    const f = this.f;
    const foe = f.foe;
    const W = (this.whiff ??= { on: false, quiet: 0, tail: 0, landed: false, bound: false, pain: null });
    if (swinging || this.tap) {
      if (!W.on) {
        W.on = true;
        W.landed = false;
        W.bound = false;
      }
      W.quiet = 0;
      W.tail = 0;
    } else if (W.on && (W.quiet += dt) >= UNIQUE_ASSIST.onsetQuiet) {
      W.tail += dt;
      if ((W.tail >= 0.3 && f.tipVel.length() < 6) || W.tail >= 0.5) this.whiffEnd(W, foe);
    }
    if (W.on && foe) {
      if (W.pain != null && foe.pain > W.pain + 0.05) W.landed = true;
      if (!W.bound && foe.armed && f.tipPrev && foe.tipPrev && segDist(f.bladePoint(0.1, _wa), f.tipPrev, foe.bladePoint(0.1, _wb), foe.tipPrev) < 0.07) W.bound = true;
    }
    W.pain = foe ? foe.pain : null;
  }

  whiffEnd(W, foe) {
    W.on = false;
    if (!W.landed && !W.bound) foe?.gait?.foeWhiff();
  }

  /** 기력 탈진 (샛별 저장소 6ac1070d — docs/strike/stamina_import_2026-10-15.md): 비기·찌르기·손잡이 찍기·고유 동작을 거두고 손을 늘어뜨린 자리로 — 입력은 main.js 가 0 으로 */
  holdExhausted(dt) {
    const f = this.f;
    if (this.sec) this.secretEnd();
    this.tap = this.pom = this.vitalRange = null;
    this.thrustPose.w = 0;
    this.thrustPush = false;
    if (this.uniq?.running) this.uniq.end('exhausted');
    const k = Math.min(1, dt * 6);
    f.handOffset.x += (0.08 - f.handOffset.x) * k;
    f.handOffset.y += (-0.32 - f.handOffset.y) * k;
    this.stiffHeld = true;
    this.holdStiff(dt);
    this.guardDrive = 0;
    this.cutPending = this.recovering = false;
  }

  update(dt) {
    if (dt <= 0) return;
    const f = this.f;
    const L = this.level;
    if (f.stamina.exhausted) return this.holdExhausted(dt);
    this.sinceThrust = this.tap ? 0 : this.sinceThrust + dt;
    if (this.sec) this.updateSecret(dt); // 플레이어 비기: 손 목표를 비기 길로 (이 스텝의 거르기·몸 따라가기는 아래 그대로)
    if (this.uniq) this.uniq.drive(dt); // 플레이어 고유 동작 강화 (unique_assist.js — main.js 가 플레이어에게만 붙인다, AI 는 없음): 몸 덧씌우기·끝 힘·걸음 (손 목표는 건드리지 않는다)
    if (this.sec?.S?.do?.gilmok || f.gilCutW > 0) {
      // 이베리아 길목 한 칼의 덧씌우기 자세 (10/11 v6 2차 — AI 와 같은 함수 secret_instant.js gilmokCutPose): 팔을 앞으로 뻗어 몸통 높이로 둘러 벰
      const g = this.sec ? gilmokSeg(this.sec.cur?.name, this.sec.stage === 'stiff') : { seg: null, s: 1 };
      gilmokCutPose(f, g.seg, g.s, dt);
    }
    const R = WEAPON.reach;
    if (f.handOffset.length() > R) f.handOffset.setLength(R);
    observeTempoInput(this, dt);
    const off = tempoHand(this, dt);
    if (off !== f.handOffset && off.length() > R) off.setLength(R);
    if (this.sec?.stage === 'stiff' || f.secretStiff) return this.holdStiff(dt); // 비기 경직 (플레이어 sec · AI 는 ai.js moveHand 가 secretStiff 를 켠다)
    this.stiffHeld = false;

    // 손 목표 속도 (손가락 떨림을 거르기 위해 살짝 부드럽게)
    const motionDt = STAMINA.attackTempo && STAMINA.tempoInput && f.stamina.attackSpeed > 0 && !f.stamina.guarding ? dt * f.stamina.attackSpeed : dt;
    const rx = (off.x - this.prev.x) / motionDt;
    const ry = (off.y - this.prev.y) / motionDt;
    this.prev.copy(off);
    const k = 1 - Math.exp(-motionDt * 25);
    this.vel.x += (rx - this.vel.x) * k;
    this.vel.y += (ry - this.vel.y) * k;
    const sp = this.vel.length();
    const swinging = sp > SKILL.swingSpeed && f.alive && f.armed;
    this.swinging = swinging;
    this.inputSwinging = this.inputMotion ? this.inputMotion.vel.length() > SKILL.swingSpeed && f.alive && f.armed : swinging;
    if (GAIT.deChase && !f.aiControlled) this.whiffTrack(dt, swinging); // 사람 휘두르기 헛침 → 상대 걸음(독일 간격 잡기, 10/15). AI 는 ai.js afterStrike 가 알린다
    if (this.uniq) this.uniq.detect(dt, this.inputSwinging, this.inputMotion?.vel); // 원래 입력 시계/방향으로 인식. 유파 동작·보법 정의는 그대로.
    // 플레이어 막기 버튼 (10/11 — parry_button.js): 버튼이 손 목표를 휘두르기 문턱보다 빠르게 옮기는 동안은 AI 막기(손이 parrySpeed 로 옮겨져 휘두르기로 잡힘)처럼
    //  휘두르기 꼴의 거르기·몸 따라가기를 쓴다. 휘두르기 사건(swinging — 내딛기·베기 덩이·자세로 돌아가기)은 손가락 끌기만 (버튼이 prev 도 옮긴다). 버튼이 없으면 guardDrive 없음 → 그대로
    const fast = swinging || this.guardDrive > SKILL.swingSpeed;
    // 휘두르는 중인 정도 (0~1): 휘두르기 시작하면 빨리 1로, 멈추면 천천히 0으로 (몸을 크게 쓰는 건 벨 때뿐)
    this.activity += ((fast ? 1 : 0) - this.activity) * Math.min(1, motionDt / (fast ? 0.04 : 0.4));

    // 0) 가죽끈: anchor는 손가락(off)이 반경(inputDeadRadius)을 넘어야 그만큼만 끌려간다.
    //  반경 안의 떨림은 anchor를 전혀 움직이지 못한다 — 어디서 떨든(자세 경계라도) 걸러진다.
    //  큰 움직임(진짜 베기)은 반경이 순식간에 다 채워져 손가락과 거의 같이 움직인다(지연 ≈ 반경/속도).
    if (SKILL.handDynamicsOn) {
      const adx = off.x - this.anchor.x;
      const ady = off.y - this.anchor.y;
      const ad = Math.hypot(adx, ady);
      const dead = SKILL.inputDeadRadius;
      if (ad > dead) {
        const k = (ad - dead) / ad;
        this.anchor.x += adx * k;
        this.anchor.y += ady * k;
      }
    } else {
      this.anchor.copy(off);
    }

    // 흐름(SKILL.flow, 시제품): 멈추지 않고 휘어 이어지는 끌기를 흐름으로 본다 (끄면 아무 일도 없다 — flowing 은 늘 false)
    if (SKILL.flow) this.updateFlow(dt, swinging);
    // 들어가며 막기 (짧은 한손 칼만 — 다른 무기는 아무 일도 없다)
    if (f.weapon?.enterParry) this.enterParry(dt);
    const fk = this.flowing ? SKILL.flowFollow : 1; // 흐르는 동안은 이어 베기를 더 밀어 칼이 멈추지 않고 돌아 나가게

    if (this.corr === 'v2' && L > 0) {
      // 보정 v2: 이어 베기 없음 (손은 손가락 너머로 가지 않는다 — 손가락 너머는 칼끝뿐, 여쭘 12)
      this.aimRaw.copy(this.anchor);
    } else {
      // 1) 이어 베기: 휘두르는 동안 움직이는 방향으로 목표를 더 밀어 두었다가 천천히 되돌린다
      if (swinging) this.follow.addScaledVector(this.vel, motionDt * SKILL.followGain * L * fk);
      this.follow.multiplyScalar(Math.exp(-motionDt / SKILL.followDecay));
      const fm = SKILL.followMax * L * fk;
      if (this.follow.length() > fm) this.follow.setLength(fm);
      this.aimRaw.copy(this.anchor).add(this.follow);
    }
    if (this.aimRaw.length() > R) this.aimRaw.setLength(R);
    // 손 목표를 "딱 멈추는"(임계 감쇠) 2차 필터로 거른다: 목표가 순간이동해도 손은 가속·감속하며 간다.
    //  (사람의 손도 순간적으로 속도를 바꾸지 못한다. 목표가 튀면 근육이 그 충격을 몸통에 그대로 전해 출렁인다)
    // 휘두르는 순간엔 근육을 긴장시켜(공동 수축) 더 빠르고 단단하게 따라간다
    const wT = fast ? SKILL.aimFilterStrike : SKILL.aimFilter;
    this.filterW = (this.filterW ?? wT) + (wT - (this.filterW ?? wT)) * Math.min(1, motionDt * 30);
    const w = this.filterW;
    const ax = w * w * (this.aimRaw.x - this.aim.x) - 2 * w * this.aimVel.x;
    const ay = w * w * (this.aimRaw.y - this.aim.y) - 2 * w * this.aimVel.y;
    // 지친 경로와 그 경로를 따르는 필터를 같은 명령 시간으로 진행한다.
    // 속도 기반 이어 베기까지 같은 시계로 적분해 공격 호가 줄지 않게 한다.
    const aimDt = dt * (!f.stamina.guarding && (STAMINA.attackTempo && STAMINA.tempoInput || !f.aiControlled && !this.sec) ? f.stamina.attackSpeed : 1);
    this.aimVel.x += ax * aimDt;
    this.aimVel.y += ay * aimDt;
    if (!f.aiControlled && f.stamina.attackSpeed < 1 && !f.stamina.guarding) this.aimVel.clampLength(0, AI_LEVELS.normal.strikeSpeed * (STAMINA.attackTempo && STAMINA.tempoInput ? 1 : f.stamina.attackSpeed));
    this.aim.x += this.aimVel.x * aimDt;
    this.aim.y += this.aimVel.y * aimDt;

    // 3) 내딛기: 잠깐 멈췄다가 새로 휘두르기 시작할 때, 상대가 한 걸음 거리에 있으면
    if (swinging && this.quiet > 0.2 && f.state === 'stand') {
      this.swings++;
      const d = f.foeDistance();
      // 쓰러진 상대를 내려찍을 때(finish.js)는 내딛지 않는다: 마무리 자세가 거리를 맞추고, 내딛으면 칼이 누운 몸을 지나 발밑에 떨어진다
      // R2′ 'legs' (확인표 126): 매 베기 앞걸음(lunge)을 끈다 — 걸음은 균형(capture point·stumble·settle)에서만. 대안 156(거리식)은 둘째 탐색판
      if (d > SKILL.lungeMin && d < SKILL.lungeMax && !(f.finish?.amt > 0.5)) {
        if (BODY.chain !== 'legs') this.lunge = SKILL.lungeTime;
        else if (GAIT.cutStep > 0 && f.gait?.active) {
          // R2′ 걸음 조율 채널 B(확인표 182, 10/8): legs 에서 꺼 두었던 베기 앞걸음을 '발 고르기 걸음' 으로 — 획 방향의 반대 발이 나가고(오른쪽 → 왼쪽 베기 = 왼발) 획 시작 쪽 발이 민다
          //  (채널 A 가 그 밀기를 yaw 짝힘으로 바꾼다). 세로 획(|가로 속도| ≤ 0.3)은 gait 의 발 고르기 그대로. 걸음 길이·시간은 AI 기술 걸음과 같은 0.6·lungeTime
          const vx = Math.abs(this.vel.x) > 0.3 ? this.vel.x : this.aimVel.x; // 획 첫 틱엔 걸러진 속도(aimVel)가 아직 작아 날 속도(vel)로 방향을 읽는다
          f.gait.requestStep({ kind: 'pass', leg: vx < -0.3 ? 'left' : vx > 0.3 ? 'right' : null, fwd: 0.6, duration: SKILL.lungeTime });
        }
      }
    }
    this.quiet = swinging ? 0 : this.quiet + dt;

    // 4) 자세로 돌아가기
    if (swinging) {
      this.cutPending = true;
      this.recovering = false;
    }
    this.idle = f.inputActive || this.tempoInput?.pending ? 0 : this.idle + dt;
    // 보정 v2 사건: 손 뗌 = 손가락이 화면에서 떨어진 스텝 (handHeld 참 → 거짓, main.js — 입력 쪽 사건이라 공포 떨림에 속지 않음)
    this.lift = !!this.heldPrev && !f.handHeld;
    this.heldPrev = !!f.handHeld;
    const canRecover = this.autoGuard && !this.sec && L >= 0.35 && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel'); // 비기 실행 중엔 자세로 돌아가지 않는다 (비기 길이 손을 쥔다)
    // 보정 v2 ③ 되돌아옴 겨눔 (s > 0, 선 자세·총 아님·상대 있음): 걷는 목적지만 바꾼다 dest = lerp(homeGuard, pad*, s). 무릎은 오늘 걷기
    const v2r = this.corr === 'v2' && L > 0 && f.state === 'stand' && !f.weapon?.gun && !!f.foe;
    if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay) {
      this.recovering = true;
      this.cutPending = false;
      if (v2r) {
        // 한손 무기(guardPose.oneHand)는 옛 보정처럼 homeGuard 로 (사장님 탐색판 3·4차 '나뭇가지 기본 자세가 몸통 오른쪽으로 쭉 편 것처럼 고정'):
        //  pad*(가슴 앞 가운데)의 한손 자세표는 팔을 끝까지 뻗고 45° 옆으로 선 3번 자세(찌르기 자세)라, 쉼 무게(bodyPose.idle)가 그리로 끌면
        //  벤 뒤마다 팔이 곧게 뻗은 채 굳는다. homeGuard 의 한손 쟁기는 칼끝이 상대 얼굴을 겨누니(guards.js) ③ 의 겨눔은 그대로다. 걷기·진행 p 는 같다
        //  쉴 자리(home) = 유파 쉴 자세(sword_art.js restGuard.pad — 10/9 ②③, 스위치 SKILL.schoolArt 0 이면 SKILL.homeGuard 그대로)
        const ps = (this.recoverDest ||= [0, 0]);
        const home = f.swordArt?.restGuard?.pad ?? SKILL.homeGuard;
        if (f.guardPose?.oneHand) {
          ps[0] = home[0];
          ps[1] = home[1];
        } else {
          padStar(f, ps);
          ps[0] = home[0] + (ps[0] - home[0]) * L;
          ps[1] = home[1] + (ps[1] - home[1]) * L;
        }
        this.recoverD0 = Math.hypot(ps[0] - off.x, ps[1] - off.y);
        this.recoverP = 0;
      }
    }
    if (this.recovering && v2r && this.recoverD0 != null) {
      // 보정 v2: 같은 빠르기(recoverSpeed)로 pad* 쪽 목적지로 걷는다. 겨눔 덧씌우기 없음 → 다음 손길에 튐 없음. 진행 p = 1 − d/d0 (② 붙잡음을 푼다)
      if (f.inputActive || !canRecover) this.recovering = false;
      else {
        const hx = this.recoverDest[0] - off.x;
        const hy = this.recoverDest[1] - off.y;
        const d = Math.hypot(hx, hy);
        const step = SKILL.recoverSpeed * dt;
        if (d <= step) {
          off.set(this.recoverDest[0], this.recoverDest[1]);
          this.recovering = false;
          this.recoverP = 1;
        } else {
          off.x += (hx / d) * step;
          off.y += (hy / d) * step;
          this.recoverP = this.recoverD0 > 0 ? 1 - (d - step) / this.recoverD0 : 1;
        }
      }
    } else if (this.recovering) {
      if (f.inputActive || !canRecover) this.recovering = false; // 다시 조작하면 바로 조작이 우선
      else {
        const home = f.swordArt?.restGuard?.pad ?? SKILL.homeGuard; // 유파 쉴 자세 (10/9 ②③, 스위치 끔 = homeGuard)
        const hx = home[0] - off.x;
        const hy = home[1] - off.y;
        const d = Math.hypot(hx, hy);
        // 휘두르기로 오인되지 않게 휘두르기 기준 속도보다 느리게 옮긴다
        const step = SKILL.recoverSpeed * dt;
        if (d <= step) {
          off.set(home[0], home[1]);
          this.recovering = false;
        } else {
          off.x += (hx / d) * step;
          off.y += (hy / d) * step;
        }
      }
    }
    if (!this.recovering) this.recoverD0 = null;
    // 보정 v2 'ready' 사건 (재기만, 아무것도 막지 않음): 칼끝이 가슴 앞(가슴 상자 단면 안, 앞쪽)이고 두 발이 다 딛고 있다
    if (this.corr === 'v2' && L > 0 && f.alive && f.armed) {
      const g = f.gait;
      const sp = f.sword.translation();
      const sr = f.sword.rotation();
      const c = f.bodies.chest.translation();
      _yawInv.copy(f.yaw).invert();
      const tip = _pt.set(0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(_sq.set(sr.x, sr.y, sr.z, sr.w));
      tip.set(tip.x + sp.x - c.x, tip.y + sp.y - c.y, tip.z + sp.z - c.z).applyQuaternion(_yawInv);
      const ready = !swinging && tip.x > 0 && Math.abs(tip.y) <= 0.13 && Math.abs(tip.z) <= 0.18 && (!g?.active || (g.legs.F.stance && g.legs.B.stance)); // 가슴 상자 반 높이·반 폭 (fighter.js partDefs)
      if (ready && !this.readyNow) {
        this.readies = (this.readies ?? 0) + 1;
        this.readyT = f.fightT;
      }
      this.readyNow = ready;
    }
    if (this.corr === 'v2' && L > 0) {
      // 보정 v2 쉼 무게의 목표 (fighter.updateBodyPose 가 SKILL_BODY 따라가기로 쫓고 driveSword 가 손·칼끝을 그만큼 옛 자세 지도 쪽으로 섞는다):
      //  손가락이 닿았거나 움직이거나 휘두르는 중 = 0 (날것), 되돌아오는 동안 = 걷기 진행 recoverP (무릎 걷기는 진행 값이 없어 끝날 때까지 0),
      //  벤 뒤 되돌아옴을 기다리는 동안 = 0, 그 밖(쉼, 되돌아옴 끝) = 1. 새 수·시계 없음 — 있는 사건만 읽는다
      this.idleGoal = f.handHeld || f.inputActive || swinging || this.sec ? 0 : this.recovering ? (this.recoverD0 != null ? this.recoverP : 0) : this.cutPending && canRecover ? 0 : 1;
    }
    if (this.lunge > 0) {
      this.lunge -= dt;
      // 물러나려는 중이면 내딛지 않는다 (조작이 우선)
      if (f.move.y > -0.2 && f.foeDistance() > SKILL.lungeMin) f.move.y = Math.max(f.move.y, SKILL.lungeMove * L);
    }

    // 5) 탭 찌르기 (약한 자세 간격 맞추기가 먼저 — FINISH.vital, 없으면 타지 않는다)
    if (this.vitalRange || this.vitalRelease) this.updateVitalRange(dt);
    if (this.tap) {
      this.updateThrust(dt);
      this.activity = Math.max(this.activity, this.thrustPose.w); // 찌르는 동안엔 몸도 벨 때처럼 빠르게 따라온다
    } else if (this.pom) {
      this.updatePommel(dt); // 손잡이 찍기 (시제품, 부를 때만)
      this.activity = Math.max(this.activity, this.thrustPose.w);
    } else if (this.f.weapon?.gun) this.thrustPose.w = gunPose(this.f, this.thrustPose); // 권총: 한 손 사격 자세를 덧씌운다 (gun.js)
  }
}
