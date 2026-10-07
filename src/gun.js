// ─────────────────────────────────────────────────────────────
//  권총 (??? 등급, 사장님 — "재미 삼아 최소 비용으로", 이런 무기는 더 늘리지 않는다)
//   · '찌르기'(탭)로 쏜다. 총은 저절로 상대를 겨누지만(자동 조준 — 끌기로 총을 돌리지 않는다, 조이스틱은 이동만) 겨눔이 상대 몸
//     둘레를 느리게 크게 흔들린다(GUN.sway*). 레이저 점이 몸 위를 들락날락할 때 그 순간에 맞춰 탭하는 것이 실력이다(사장님).
//     사람은 지금 총신 방향(칼 축 = 몸체 +y, 레이저가 보여 준다)으로 바로 한 발. AI 도 같은 흔들림으로 겨누고, 레이저가 골반 이상의 몸
//     (골반~머리)을 지날 때(GUN.aiAimTol) 쏜다. 싱글액션 6연발(사장님 "사실감"): 겨눈 사격 사이 GUN.cooldown, 여섯 발을 다 쏘면 GUN.reload 초 동안
//     실린더를 열고 한 발씩 채운다 — 다 채워야 다시 쏠 수 있다.
//   · 맞으면 늘 같은 세기(GUN.energy)의 찌르기 상처 — 새 상처 종류는 만들지 않는다. 투구·판금은 총알을 막는 대신 그 자리에서 부서진다.
//     맨머리 한 발 = 즉사, 가슴은 두세 발. 쏘면 팔 동작으로 총구를 튀겨 올린다(GUN.kick*, 물리 반동은 작은 '탁'). 총신 방향으로 레이저(탄 길)를 그린다
//   · 근접전 불가: 무기 제원이 날 없음·둔기 배율 0 이라 몸을 쳐도 아무 효과가 없다 (weapons.js pistol).
//   · 이동이 빠르다(spec.moveMul, fighter.js 걷는 속도). 부서지지 않는다(fragility 0).
//   · 소리: 총소리·장전 소리만 (불꽃·연기 없음). GUN_HOOKS 로 main.js 가 이어 줄 수 있고, 없으면 window.game.sound 로 낸다.
//  매 물리 스텝 combat.js afterStep 이 updateGun 을, skill.js thrust 가 gunCanFire 를, ai.js 가 gunAI 를 부른다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ANATOMY, ARENA, COMBAT } from './config.js';
import { prepareRevolverReload, playRevolverReload } from './revolver_reload_audio.js';

/** 권총을 든 동안 화면에 띄우는 자세 이름 (사장님: "사격 자세 라고 써") — main.js 자세 이름 표시가 GUARDS 대신 쓴다 */
export const GUN_STANCE = { name: '사격 자세', desc: '총이 저절로 상대를 겨누며 흔들린다 · 레이저가 몸에 걸린 순간 탭으로 쏜다' };

export const GUN = {
  energy: 80, // J: 사용자 후속 요청으로 75 → 80. 방어구/부위에 따른 기존 피해 계산은 유지한다.
  // 싱글액션 사격 설정의 6연발. 사용자 지정 게임 시간이며 사람의 실측 평균을 뜻하지 않는다.
  rounds: 6, // 실린더에 드는 탄
  cooldown: 0.8, // 초: 한 발 쏜 뒤 다음 발까지 (공이를 젖히고 다시 겨누는 시간).
  reload: 8, // 초: 여섯 발을 다 쏘면 전체 재장전. 완료 시 탄수 6으로 복구한다.
  reloadOpen: 0.9, // 초: 열기·탄피 처리 뒤 삽입음 구간 시작.
  reloadClose: 0.8, // 초: 장전 말미에 남겨 두는 닫기 준비 구간.
  reloadInsertInterval: (7.3 / 6) * 0.8 * 0.8, // 사용자 후속: 현재 삽입 간격에서 다시20% 단축. 마지막 삽입은 닫기 준비 직전에 맞춘다.
  range: 25, // m: 총알이 닿는 거리
  armorBlunt: 0.25, // 투구·판금이 막으면(그리고 바로 부서지면) 몸에는 세기의 이 비율만 둔하게 전해진다
  laser: false, // 조준 레이저는 외형 PM gun_fx.js 가 그린다 (사장님: 아주 희미하게 · 두 겹 방지). true 면 여기 updateLaser 가 그린다(효과 모듈 없는 점검용)
  aiAimTol: 3, // 도: AI는 골반·배·가슴·붙어 있는 머리 중 총구와 가까운 부위를 기다린다.
  aiFirst: 1.5, // 초: AI 는 판이 열리고 이만큼 지나서야 첫 발을 쏜다
  maxWait: 0.6, // 초: 찌르기를 시작하고 이 안에 팔이 안 뻗어지면 그냥 그때 총구 방향으로 쏜다
  // 사격 자세 (사장님: 한 손 사격 자세) — gunPose. 몸 기준 [앞, 위, 총 든 쪽] (m·도)
  shoulder: [0, 0.1, 0.2], // 총 든 어깨 (가슴 기준)
  armLen: 0.55, // 곧게 뻗은 팔: 어깨에서 손까지
  // 자동 조준의 흔들림 (사장님: "자동으로 상대를 조준하되 꽤 많이 흔들리게 — 타이밍을 맞춰 발사만 누르면 되지만 그게 집중력을 요하게").
  //  난수 없이 시간·검객별 위상만의 함수다: 옆 sin θ · 위아래 sin 2θ 의 8자(리사주)라 한 주기에 두 번 가운데(가슴)를 지난다.
  //  θ 는 느리게 빨라졌다 느려졌다(swayWobble), 폭도 느리게 숨 쉬듯 변하고(swayBreath) 가운데도 조금씩 떠돌아(swayDrift) 똑같이 되풀이되지
  //  않는다. 아래 각도 신호는 gunAimTarget에서 몸 기준 폭/높이로 정규화한다. 거리가 멀어져도 표적 범위를 키우지 않는다.
  swayYaw: 10, // 옆 흔들림 신호의 상대 폭 (실제 목표 범위는 aimSide)
  swayPitch: 6, // 위아래 흔들림 신호의 상대 폭 (실제 높이 범위는 aimHeightSway)
  swayPeriod: 2.6, // 초: 8자 한 바퀴 (그 사이 가슴을 두 번 지난다). 짧을수록 빠르게 흔들린다
  swayWobble: 0.35, // 흔들리는 빠르기가 이 비율만큼 느리게 오르내린다 (0 이면 늘 같은 박자)
  swayBreath: 0.25, // 폭이 이 비율만큼 느리게 커졌다 작아진다 (0 이면 늘 같은 크기)
  swayDrift: 1.2, // 도: 8자의 가운데가 겨눔 가운데(aimSpan) 둘레를 이만큼 느리게 떠돈다 (0 이면 늘 그 한가운데를 지난다)
  aimLow: 0.07, // m: 총신/주먹 높이 보정. 몸 줄을 따라 내리되 골반 아래로는 내리지 않는다.
  aimSide: 0.30, // m: 상반신 중심선에서 좌우 최대 폭. 가슴 반폭 0.18m + 주변 여유 0.12m.
  aimHeightSway: 0.20, // 확대 전 골반→머리 몸 줄 길이 중 상하 흔들림 비율. 완성한 영역에 aimEnvelopeScale을 적용한다.
  aimEnvelopeScale: 1.1, // 기존 상반신 겨눔 영역을 중심에서 각 방향10% 확대. 떨림의 시계/난수/형태는 유지한다.
  aimSpanLoops: 0.5, // 8자 반 바퀴(평균 1.3초)마다 새 높이. 기존 전용 난수/보간 박자를 유지한다.
  // 불규칙한 흔들림: 8자 위에 얹는 매끄러운 무작위 떠돌이. swayRandHold 초마다 새 목표(옆 ±swayRandYaw°, 위아래 ±swayRandPitch°)를 전용 난수로 뽑아
  //  부드럽게 옮겨 간다 — 언제 몸에 걸릴지 읽기 어렵게. 판정 난수(Math.random·탄 퍼짐)와 분리한 검객별 난수라 칼 판은 바이트 그대로
  swayRandYaw: 18,
  swayRandPitch: 12,
  swayRandHold: 0.14, // 빠르고 불규칙한 손떨림. 목표 범위/팔 힘은 그대로 두고 변화 속도와 무작위 비중만 높인다.
  sideOn: -35, // 몸을 결투 사수처럼 반쯤 옆으로: 가슴을 이만큼 틀어 총 든 어깨를 앞으로 (도, 찌르기 몸 −20 과 같은 쪽)
  // 쏘는 동작 (사장님: "반동이 아니라 동작으로 총 쏘는 느낌을", 무기 PM 제안): 쏜 직후 총구를 위로 꺾고 손을 뒤로 당긴 뒤 장전 자세로 잇는다
  kickDeg: 16, // 도: 쏜 직후 총구를 이만큼 위로 꺾는다 (자세 목표 — 손목이 조금 넘쳐 실제 총구는 0.06초에 약 24° 까지 든다, 물리 반동 약 3° 포함)
  kickBack: 0.04, // m: 손을 이만큼 뒤로 당긴다
  kickTime: 0.08, // 초: 꺾은 채로 이만큼 — 그 뒤 장전 자세가 시작된다
  kickFade: 0.15, // 초: 꺾음이 이만큼에 걸쳐 풀리며 장전 자세로 넘어간다
  reloadIn: 0.35, // 초: (장전 때만) 꺾음 뒤 이만큼에 걸쳐 총을 가슴 앞으로 당겨 올리고 실린더 쪽을 연다
  reloadOut: 0.6, // 초: 장전 끝 이만큼 전부터 다시 뻗는다 (장전이 끝나는 순간엔 이미 겨누고 있게). 발 사이(cooldown)에는 당겨 올리지 않고 겨눈 채 공이치기만 젖힌다
  droop: 0, // 도: 뻗은 팔·총이 무게로 처지는 만큼 겨눔을 위로 올려 준다 (gunPose)
  recoilBack: 0.5, // N·s: 쏠 때 총을 뒤로 미는 충격 (사장님 '수전증처럼 떨려' → ×1.75(0.875) 에서 되돌림. 보이는 튐은 kick* 동작이 맡는다)
  recoilUp: 0.2, // N·s: 총구를 위로 차 올리는 충격 (총구에 건다). 0.35 → 0.2 되돌림 — 손목이 안정된 지금은 약 4° 튀었다 0.05초에 제자리인 짧은 '탁'
  spread: 1, // 도: 서서 쏠 때 총알이 총신(레이저)에서 벗어나는 최대 각 — 레이저를 믿고 쏠 수 있게 작게
  spreadMove: 3, // 도: 걷는 최고 속도로 달리며 쏘면 이만큼 더 벗어난다
};
/** main.js·효과 모듈이 이어 줄 자리: onShot(fighter, pos, dir, dist) — dir: 실제 총알 방향(퍼짐·AI 보정 포함), dist: 닿은 곳까지 거리(빗나가면 GUN.range), onReload(fighter, pos),
 *  onImpact(fighter, point, dir, what) — 총알이 닿은 곳과 날아간 방향(what: 'body' 몸 · 'world' 땅·벽 · 'weapon' 칼).
 *  빗나가 아무 데도 안 닿으면 부르지 않는다. 보여 주기만 (외형 PM gun_fx 의 탄착 먼지·궤적) */
export const GUN_HOOKS = { onShot: null, onReload: null, onImpact: null, onReloadStart: null, onLoadRound: null }; // onReloadStart: 게이트 열기 · onLoadRound: 한 발 넣기 딸깍 · onReload: 닫고 젖히기

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _l = new THREE.Vector3();

const _gp = new THREE.Vector3();
const _gq = new THREE.Quaternion();
const _ga = new THREE.Vector3();
const _gu = new THREE.Vector3(0, 1, 0);
const _gs = new THREE.Vector3();
const _gt = new THREE.Vector3();
const D2R = Math.PI / 180;

/** 자동 조준 흔들림 (도): 시간 t(초)·검객별 위상 ph 의 결정적 함수 → out { yaw, pitch }. 난수를 쓰지 않는다 (판정·난수 순서 불변) */
export function gunSway(t, ph, out = {}) {
  const w = (2 * Math.PI) / GUN.swayPeriod;
  // 박자·폭을 흔드는 느린 진동들: 8자 주기와 서로 안 맞는 비율(0.293·0.179·0.231·0.137·0.113 배)이라 같은 모양으로 되풀이되지 않는다
  const th = w * t + ph + GUN.swayWobble * Math.sin(w * 0.293 * t + 1.7 * ph);
  const br = 1 + GUN.swayBreath * Math.sin(w * 0.179 * t + 0.6 + ph);
  const bp = 1 + GUN.swayBreath * Math.sin(w * 0.231 * t + 2.3 + 0.5 * ph);
  out.yaw = GUN.swayYaw * br * Math.sin(th) + GUN.swayDrift * Math.sin(w * 0.137 * t + 0.9 * ph);
  out.pitch = GUN.swayPitch * bp * Math.sin(2 * th) + GUN.swayDrift * 0.7 * Math.sin(w * 0.113 * t + 1.1 + ph);
  return out;
}
const _sw = { yaw: 0, pitch: 0 };
/**
 * 한 손 사격 자세 (사장님 필요, 디렉터 13:37): skill.js 가 찌르기 중이 아니면 매 스텝 부른다 — 찌르기 덧씌우기 자세(thrustPose)를 채우고
 *  덧씌울 정도(0~1)를 돌려준다. 칼 자세 표(guards.js)는 건드리지 않고 그 위에 얹힌다. 걷기·물러나기는 그대로다.
 *  · 겨눔(자동 조준): 총 든 팔을 어깨에서 곧게 뻗고, 총구가 상대 몸을 향한 채 느리게 8자로 흔들린다(gunSway). 8자의 가운데는
 *    골반~머리 사이를 무작위로 천천히 오르내린다. 좌우도 상반신 근처로 제한한다(gunAimTarget).
 *    조준 패드(skill.aimRaw)는 읽지 않는다 — 사람·AI 똑같이 겨누고, 쏘는 순간을 고르는 것이 실력이다. 몸은 반쯤 옆으로(sideOn).
 *  · 쏜 직후: 총구를 위로 꺾고 손을 뒤로 당긴다(kick*) — 쏘는 느낌은 이 동작이 낸다.
 *  · 장전 중: 총을 가슴 앞으로 당겨 올려 총구를 위로 세운다(외형 PM 이 이때 약실을 빼냈다 넣는다). 장전 끝에 다시 뻗는다
 */
export function gunPose(f, pose) {
  const foe = f.foe;
  if (!f.alive || !f.armed || !foe || (f.state !== 'stand' && f.state !== 'kneel')) return 0;
  const g = state(f);
  const S = GUN.shoulder;
  // 실제 상대 상반신 주변의 목표점. 총알은 이 점으로 보정하지 않고 실제 총구 방향으로 쏜다.
  if (g.h == null) updateAimSpan(g, 0);
  const sw = gunSway(g.t ?? 0, f.index * 2.1, _sw);
  const rs = g.rs ?? { yaw: 0, pitch: 0 };
  const t = gunAimTarget(foe, g.h, { yaw: sw.yaw + rs.yaw, pitch: sw.pitch + rs.pitch }, _gt);
  const c = f.bodies.chest.translation();
  _gq.copy(f.yaw).invert();
  _ga.set(t.x - c.x, t.y - c.y, t.z - c.z).applyQuaternion(_gq).sub(_gp.set(S[0], S[1], S[2]));
  if (_ga.lengthSq() < 1e-6) _ga.set(1, 0, 0);
  _ga.normalize();
  const side = _gs.crossVectors(_ga, _gu).normalize();
  _ga.applyAxisAngle(side, GUN.droop * D2R).normalize();
  // 쏜 뒤 지난 시간 (쏜 다음 스텝에 0)
  const ts = g.since ?? Infinity;
  // 쏘는 동작: kickTime 동안 꺾은 채로, 그 뒤 kickFade 에 걸쳐 풀린다 (장전 자세가 이어받는다)
  //  (꺾을 때도 반 박자 안에 부드럽게 올린다 — 한 스텝에 꺾으면 손목이 넘쳐 한 번 더 출렁였다)
  const up = Math.min(1, ts / (0.5 * GUN.kickTime));
  const e = ts < GUN.kickTime ? up * up * (3 - 2 * up) : ts < GUN.kickTime + GUN.kickFade ? 1 - (ts - GUN.kickTime) / GUN.kickFade : 0;
  // 장전: 꺾음 뒤 당겨 올리고, 끝나 갈 때 다시 뻗는다 (0 = 뻗음, 1 = 가슴 앞)
  let r = 0;
  if (g.cool > 0 && g.reloading) r = Math.max(0, Math.min(1, (ts - GUN.kickTime) / GUN.reloadIn, g.cool / GUN.reloadOut)); // 장전 때만 당겨 올린다
  r = r * r * (3 - 2 * r);
  const L = GUN.armLen * (1 - 0.45 * r);
  for (let k = 0; k < 3; k++) pose.hand[k] = S[k] + _ga.getComponent(k) * (L - GUN.kickBack * e); // 꺾을 때 손을 겨눔 줄 따라 뒤로 당긴다
  if (e > 0) _ga.applyAxisAngle(side, GUN.kickDeg * e * D2R); // 총구를 위로 꺾는다 (손 자리는 위에서 이미 정했다)
  pose.hand[1] += 0.12 * r; // 가슴 앞으로 올린다
  pose.hand[2] -= 0.12 * r; // 몸 가운데 쪽으로
  // 총구 방향: 겨눔 방향 → 장전 중엔 위로 세운다
  const dx = _ga.x * (1 - r) + 0.25 * r;
  const dy = _ga.y * (1 - r) + 1 * r;
  const dz = _ga.z * (1 - r);
  const n = Math.hypot(dx, dy, dz) || 1;
  pose.dir[0] = dx / n;
  pose.dir[1] = dy / n;
  pose.dir[2] = dz / n;
  pose.chestYaw = GUN.sideOn * D2R;
  pose.pelvisYaw = GUN.sideOn * 0.6 * D2R;
  pose.pitch = 0;
  pose.drop = 0;
  return 1;
}

/** AI 발사 문턱도 같은 골반 이상 부위만 본다. 떨어진 머리는 아래에서 제외한다. */
const AIM_PARTS = ['pelvis', 'abdomen', 'chest'];
/** 지금 총신이 상대 상반신 부위 몸체 중심에서 벗어난 최소 각(도). */
function aimErr(f) {
  const foe = f.foe;
  if (!foe) return 180;
  const r = f.sword.rotation();
  const ax = _gp.set(0, 1, 0).applyQuaternion(_gq.set(r.x, r.y, r.z, r.w));
  const o = muzzle(f, new THREE.Vector3());
  // 목표점과 동일한 골반 이상 부위에서 발사 타이밍을 고른다.
  const err = (b) => {
    const c = b.translation();
    return (ax.angleTo(new THREE.Vector3(c.x - o.x, c.y - o.y, c.z - o.z)) * 180) / Math.PI;
  };
  let best = foe.bodies.head && !headOff(foe) ? err(foe.bodies.head) : 180;
  for (const k of AIM_PARTS) if (foe.bodies[k]) best = Math.min(best, err(foe.bodies[k]));
  return best;
}

/** 겨눌 머리가 없다: 참수됐거나(몸에서 떨어진 머리) 죽은 상대 (COMBAT.decapitate 를 끄면 예전처럼 늘 머리도 본다) */
export function headOff(foe) {
  return !!foe.decapitated; // 떨어진 머리만 겨눔에서 뺀다 (죽었지만 머리가 붙은 상대는 그대로 — 스위치가 참수 판 밖의 싸움을 바꾸지 않게, 디렉터 9/30)
}

/** 총구 (월드): 칼 몸체 (spec.muzzleX, 손잡이+칼날 길이, 0) — 총신이 주먹 위로 올라와 있어 칼 축에서 비켜 있다 */
function muzzle(f, out) {
  const r = f.sword.rotation();
  const p = f.sword.translation();
  return out.set(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(p.x, p.y, p.z));
}

function state(f) {
  return (f.gun ??= { cool: 0, pending: -1, shots: 0, hits: 0, ammo: GUN.rounds, reloading: false, since: Infinity, seed: (0x2545f491 ^ Math.imul(f.index + 1, 0x9e3779b9)) >>> 0, sseed: (0x68e31da4 ^ Math.imul(f.index + 7, 0x85ebca6b)) >>> 0, hseed: (0x3c6ef372 ^ Math.imul(f.index + 13, 0xc2b2ae35)) >>> 0 });
}
function rand(g) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
/** 흔들림 전용 난수 (탄 퍼짐 난수와 따로 — 흔들림을 바꿔도 탄 퍼짐 순서가 그대로). k = 'hseed' 는 겨눔 높이 전용 (옆·위아래 떠돌이 순서를 안 건드린다) */
function srand(g, k = 'sseed') {
  g[k] = (Math.imul(g[k], 1664525) + 1013904223) >>> 0;
  return g[k] / 4294967296;
}
/** 겨눔 높이: 기존 전용 난수/보간으로 골반(0)~머리(1)를 천천히 오간다. */
function updateAimSpan(g, dt) {
  const H = GUN.swayPeriod * GUN.aimSpanLoops;
  if (g.hA == null) {
    g.hA = srand(g, 'hseed');
    g.hB = srand(g, 'hseed');
    g.hT = 0;
    g.hH = H * (0.6 + 0.8 * srand(g, 'hseed'));
  }
  g.hT += dt;
  if (g.hT >= g.hH) {
    g.hA = g.hB;
    g.hB = srand(g, 'hseed');
    g.hT -= g.hH;
    g.hH = H * (0.6 + 0.8 * srand(g, 'hseed'));
  }
  const u = Math.min(1, g.hT / g.hH);
  g.h = g.hA + (g.hB - g.hA) * u * u * (3 - 2 * u);
}
const _span = Array.from({ length: 4 }, () => new THREE.Vector3());
const _aimSide = new THREE.Vector3();
const _aimCenter = new THREE.Vector3();
const _aimRotation = new THREE.Quaternion();
/** 골반→배→가슴→붙어 있는 머리의 실제 몸 줄. 누워도 월드 높이로 자르지 않는다. */
function aimSpan(foe, h, out) {
  const B = foe.bodies;
  const P = _span;
  let n = 0;
  for (const k of ['pelvis', 'abdomen', 'chest']) {
    const p = B[k].translation();
    P[n++].set(p.x, p.y, p.z);
  }
  if (B.head && !headOff(foe)) {
    const p = B.head.translation();
    P[n++].set(p.x, p.y, p.z);
  }
  let L = 0;
  for (let i = 1; i < n; i++) L += P[i].distanceTo(P[i - 1]);
  let s = Math.max(0, Math.max(0, Math.min(1, h)) * L - GUN.aimLow);
  for (let i = 1; i < n; i++) {
    const d = P[i].distanceTo(P[i - 1]);
    if (s <= d || i === n - 1) return out.copy(P[i - 1]).lerp(P[i], d > 1e-9 ? Math.min(1, s / d) : 0);
    s -= d;
  }
  return out.copy(P[0]);
}
/** 기존 상반신 목표 영역을 중심에서 확대한다. 반동/장전/실제 물리 총구와 탄 퍼짐은 별개다. */
export function gunAimTarget(foe, h, sway, out = new THREE.Vector3()) {
  const yawBound = GUN.swayYaw * (1 + GUN.swayBreath) + GUN.swayDrift + GUN.swayRandYaw;
  const pitchBound = GUN.swayPitch * (1 + GUN.swayBreath) + GUN.swayDrift * 0.7 + GUN.swayRandPitch;
  const unit = (v, bound) => Math.max(-1, Math.min(1, v / (bound || 1)));
  aimSpan(foe, h + GUN.aimHeightSway * unit(sway.pitch, pitchBound), out);
  // 가슴 좌우 축을 따라 흔든다. 몸이 누우면 상반신 주변 범위도 함께 눕는다.
  _aimSide.set(0, 0, 1).applyQuaternion(_aimRotation.copy(foe.bodies.chest.rotation()));
  out.addScaledVector(_aimSide, GUN.aimSide * unit(sway.yaw, yawBound));
  // 상하 신호만 키우면 몸 줄 끝에서 잘려 전체 높이는 그대로다. 완성한 영역 전체를
  // 확대해야 좌우뿐 아니라 높이도10% 늘어난다. 누운 몸과 떨어진 머리도 기존 몸 줄을 따른다.
  aimSpan(foe, 1, _aimCenter).add(_span[0]).multiplyScalar(0.5);
  return out.sub(_aimCenter).multiplyScalar(GUN.aimEnvelopeScale).add(_aimCenter);
}

/** 불규칙한 떠돌이: swayRandHold 초마다 새 목표를 뽑아 매끄럽게(smoothstep) 옮겨 간다 → g.rs { yaw, pitch } (도) */
function updateRandSway(g, dt) {
  const H = GUN.swayRandHold;
  if (!g.rsA) {
    g.rsA = { yaw: 0, pitch: 0 };
    g.rsB = { yaw: (srand(g) * 2 - 1) * GUN.swayRandYaw, pitch: (srand(g) * 2 - 1) * GUN.swayRandPitch };
    g.rsT = 0;
    g.rsH = H;
  }
  g.rsT += dt;
  if (g.rsT >= g.rsH) {
    g.rsA = g.rsB;
    g.rsB = { yaw: (srand(g) * 2 - 1) * GUN.swayRandYaw, pitch: (srand(g) * 2 - 1) * GUN.swayRandPitch };
    g.rsT -= g.rsH;
    g.rsH = H * (0.6 + 0.8 * srand(g)); // 머무는 시간도 들쭉날쭉
  }
  const u = Math.min(1, g.rsT / g.rsH);
  const e = u * u * (3 - 2 * u);
  g.rs = { yaw: g.rsA.yaw + (g.rsB.yaw - g.rsA.yaw) * e, pitch: g.rsA.pitch + (g.rsB.pitch - g.rsA.pitch) * e };
}

/** 지금 쏠 수 있나 (skill.js thrust 가 묻는다). 쏠 수 있으면 이번 찌르기에 한 발을 건다 */
export function gunCanFire(f, { now = false } = {}) {
  // 시작 대치 중 겨누기는 유지하되 발사는 받지 않는다. 이때 누른 입력을
  // 예약하지 않아 발이 풀리는 순간 저절로 쏘지 않는다. 사람·AI 공통이다.
  if (f.feetHeld) return false;
  const g = state(f);
  if (g.cool > 0 || g.pending >= 0) return false;
  g.pending = now ? GUN.maxWait : 0; // now: 찌르는 동작 없이 다음 스텝에 지금 총신(레이저) 방향으로 쏜다 (사격 자세가 이미 겨누고 있다)
  g.aim = 0; // 조준 보정 없음 (AI 는 gunAI 가 쏜 뒤 g.aim 을 난이도대로 정한다)
  return true;
}

/** 매 물리 스텝: 걸어 둔 한 발을 팔이 뻗을 때 쏘고, 발 사이·장전 시간을 센다 */
export function updateGun(f, world, combat, dt) {
  const g = state(f);
  g.t = (g.t ?? 0) + dt; // 흔들림 시계 (물리 스텝마다, 상태와 상관없이 흐른다)
  g.since += dt;
  updateRandSway(g, dt);
  updateAimSpan(g, dt);
  if (GUN.laser) updateLaser(f, g, world, combat);
  if (g.cool > 0) {
    const before = GUN.reload - g.cool;
    g.cool -= dt;
    if (g.reloading) {
      // 탄피 처리 뒤 여섯 발을 빠르게 넣고 닫는다. 삽입 묶음의 끝을
      // 닫기 준비 구간에 맞춰, 박자를 줄여도 마지막에 긴 공백이 생기지 않는다.
      const lastInsert = GUN.reload - GUN.reloadClose;
      const interval = Math.min(GUN.reloadInsertInterval, (lastInsert - GUN.reloadOpen) / Math.max(1, GUN.rounds - 1));
      const after = GUN.reload - g.cool;
      for (let i = 0; i < GUN.rounds; i++) {
        const ti = lastInsert - interval * (GUN.rounds - 1 - i);
        if (before < ti && after >= ti) sound('onLoadRound', f, i + 1);
      }
      if (g.cool <= 0) {
        g.reloading = false;
        g.ammo = GUN.rounds;
        sound('onReload', f);
      }
    }
  }
  // 이미 예약된 발사도 같은 시작 조건으로 막는다. 겨눔·장전 시계는 유지한다.
  if (f.feetHeld) return void (g.pending = -1);
  if (g.pending < 0) return;
  g.pending += dt;
  if (!f.alive || !f.armed) return void (g.pending = -1);
  if (!f.skill?.thrustPush && g.pending < GUN.maxWait) return;
  g.pending = -1;
  g.shots++;
  g.since = 0;
  g.ammo--;
  if (g.ammo <= 0) {
    g.reloading = true;
    g.cool = GUN.reload;
    sound('onReloadStart', f);
  } else g.cool = GUN.cooldown;
  fire(f, world, combat);
}

function fire(f, world, combat) {
  const sw = f.sword;
  const r = sw.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향
  // 탄 퍼짐: 총신에서 무작위로 조금 벗어난다 (전용 난수 — Math.random 과 분리). 몸이 빠를수록 더 벗어난다
  const g = state(f);
  const pv = f.bodies.pelvis.linvel();
  const run = Math.min(1, Math.hypot(pv.x, pv.z) / 2.3);
  const cone = ((GUN.spread + GUN.spreadMove * run) * Math.PI) / 180;
  const a = Math.sqrt(rand(g)) * cone;
  const phi = rand(g) * Math.PI * 2;
  const u = _l.set(1, 0, 0).applyQuaternion(_q); // 총신에 수직인 두 축
  const v = new THREE.Vector3().crossVectors(_d, u);
  _d.multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a) * Math.cos(phi)).addScaledVector(v, Math.sin(a) * Math.sin(phi)).normalize();
  muzzle(f, _o); // 총구
  // AI 조준 보정: AI 는 난이도 실력(level.skill: 쉬움 0.4 · 보통 0.7 · 어려움 0.85)만큼 총신을 상대 가슴 쪽으로 바로잡아 쏜다:
  //  남는 오차 = 총신 오차 × (1 − (0.5 + 0.5·skill)). 사람은 바로잡지 않는다 — 레이저가 몸에 걸린 순간을 제가 골라 쏜다
  if (g.aim > 0 && f.foe?.bodies?.chest) {
    const c = f.foe.bodies.chest.translation();
    // 가슴 몸체 중심보다 10 cm 아래(명치)를 노린다 — 가슴 중심을 노리면 남은 오차가 위로 튈 때 목·얼굴로 가서 첫 발에 즉사했다
    // 기존 AI 난이도 보정은 명치 쪽으로 유지한다. 사람의 탄도에는 이 보정을 적용하지 않는다.
    const to = new THREE.Vector3(c.x - _o.x, c.y - 0.1 - _o.y, c.z - _o.z).normalize();
    _d.lerp(to, g.aim).normalize();
  }
  // 반동: 총구를 뒤·위로 차 올린다 (총구에 건 충격 — 손목이 받아 내며 총구가 들린다). 팔에도 충격이 전해진다
  const up = _l.set(0, 1, 0).addScaledVector(_d, -_d.y).normalize(); // 총신에 수직인 위쪽
  sw.applyImpulseAtPoint(
    { x: -_d.x * GUN.recoilBack + up.x * GUN.recoilUp, y: -_d.y * GUN.recoilBack + up.y * GUN.recoilUp, z: -_d.z * GUN.recoilBack + up.z * GUN.recoilUp },
    { x: _o.x, y: _o.y, z: _o.z },
    true,
  );
  f.takeJolt?.(GUN.recoilBack + GUN.recoilUp);
  const info = combat.info;
  const hit = castRay(world, _o, _d, (h) => info.get(h)?.fighter !== f && !info.get(h)?.detached);
  sound('onShot', f, _d.clone(), hit ? hit.toi : GUN.range); // 효과 모듈의 총알 궤적이 실제 총알을 따라가게 방향·거리를 넘긴다
  const vi = hit ? info.get(hit.collider.handle) : null;
  // 어디에 맞았나 (검사 도구가 읽는다): 허공·땅벽·칼·몸
  const what = !hit ? 'air' : !vi ? 'world' : vi.kind === 'weapon' ? 'weapon' : 'body';
  g.what = g.what ?? {};
  g.what[what] = (g.what[what] ?? 0) + 1;
  if (hit) GUN_HOOKS.onImpact?.(f, _o.clone().addScaledVector(_d, hit.toi), _d.clone(), what);
  if (what !== 'body' || vi.fighter === f) return; // 칼·땅·벽에 맞았거나 빗나갔다
  bulletHit(f, vi, _o.clone().addScaledVector(_d, hit.toi), _d.clone(), combat);
}

/** 총알 한 발이 몸 부위(vi = colliderInfo 항목)의 point 에 dir 방향으로 맞았다: 늘 같은 세기의 찌르기 상처 (검사 도구도 부른다) */
export function bulletHit(f, vi, point, dir, combat) {
  if (vi.detached) return null; // loose pieces are outside the trial's damage model
  const vic = vi.fighter;
  if (vic.state === 'dead') return null;
  _d.copy(dir);
  const b = vi.body;
  const bp = b.translation();
  const br = b.rotation();
  const local = point.clone().sub(_l.set(bp.x, bp.y, bp.z)).applyQuaternion(_q.set(br.x, br.y, br.z, br.w).invert());
  const zone = vi.kind === 'head' ? (local.y < -0.05 ? 'neck' : 'head') : vi.kind === 'chest' ? (local.y > 0.11 ? 'neck' : 'chest') : vi.kind;
  const helmet = zone === 'head' && vic.hasHelmet && local.y > -0.01;
  const plate = !helmet && zone !== 'neck' && !!vic.platedAt?.(vi.part, local);
  const E = GUN.energy * (f.weaponCfg.power ?? 1);
  if (helmet || plate) return armorStop(f, vi, vic, point, local, zone, helmet, E, combat);
  const A = ANATOMY[zone] ?? ANATOMY.chest;
  let guard = 1;
  if (zone !== 'head' && zone !== 'neck') guard = 0.55 + 0.45 * (vic.cloth[vi.part] ?? 1);
  const thr = A.stab * guard;
  const opened = E > thr;
  const res = {
    type: opened ? 'stab' : 'blunt',
    zone,
    energy: E,
    ephys: E,
    mFree: 0.01,
    severity: opened ? (E - thr) / 60 : 0,
    pass: opened,
    absorb: A.absorb ?? 100,
    bleedPerSev: (ANATOMY[zone] || ANATOMY.chest).bleed,
    local,
    point,
    dir: _d.clone(),
    speed: 300,
    mEff: 0.01,
    t: 1,
    helmet,
    helmetBlunt: helmet ? ANATOMY.helmet.blunt + (1 - ANATOMY.helmet.blunt) * (1 - vic.helmetIntegrity) : 1,
    bladeAxis: _d.clone(),
    gun: true,
  };
  state(f).hits++;
  vic.applyWound({ ...res, part: vi.part });
  // 맞은 몸이 살짝 밀린다 (총알 운동량은 작다 — 사람이 날아가지 않게 0.6 N·s 만)
  b.applyImpulseAtPoint({ x: _d.x * 0.6, y: _d.y * 0.6, z: _d.z * 0.6 }, { x: point.x, y: point.y, z: point.z }, true);
  combat.hooks.onWound?.(f, vic, res, point, { w: { fighter: f, kind: 'weapon', part: 'blade', body: f.sword }, v: vi });
  return res;
}

/**
 * 투구·판금이 총알을 막는다 — 대신 그 자리에서 부서진다 (사장님). 몸에는 둔한 충격(세기 × GUN.armorBlunt)만.
 *  투구: 내구도를 0 으로 → applyWound 가 벗겨/부숴 날린다. 판금: 그 부위 판의 내구도를 바닥으로 → wearPlate 가 판을 떼어 날린다
 */
function armorStop(f, vi, vic, point, local, zone, helmet, E, combat) {
  const Eb = E * GUN.armorBlunt;
  if (helmet) vic.helmetIntegrity = 0;
  else vic.plate[vi.part] = Math.min(vic.plate[vi.part], 1e-6);
  const res = {
    type: 'blunt',
    zone,
    energy: Eb,
    ephys: Eb,
    mFree: 0.01,
    severity: 0,
    pass: false,
    absorb: 100,
    bleedPerSev: 0,
    local,
    point,
    dir: _d.clone(),
    speed: 300,
    mEff: 0.01,
    t: 1,
    helmet,
    plate: !helmet,
    helmetBlunt: ANATOMY.helmet.blunt,
    bladeAxis: _d.clone(),
    gun: true,
    armorStopped: true,
  };
  state(f).hits++;
  vic.applyWound({ ...res, part: vi.part });
  vi.body.applyImpulseAtPoint({ x: _d.x * 0.6, y: _d.y * 0.6, z: _d.z * 0.6 }, { x: point.x, y: point.y, z: point.z }, true);
  combat.hooks.onWound?.(f, vic, res, point, { w: { fighter: f, kind: 'weapon', part: 'blade', body: f.sword }, v: vi });
  return res;
}

/**
 * 레이저(탄 길): 총구에서 총신 방향으로 처음 닿는 곳까지 붉은 선 + 끝에 점. 칼 그룹의 자식이라 총과 함께 움직인다.
 *  장전 중엔 흐리게 — 다시 쏠 수 있는지도 이걸로 보인다. 쏜 사람 자신의 몸·총은 건너뛴다
 */
function updateLaser(f, g, world, combat) {
  const group = f.swordGroup;
  if (!group) return;
  if (!g.laser) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.6, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.008).translate(0, 0.5, 0), mat);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat);
    beam.renderOrder = dot.renderOrder = 2;
    group.add(beam, dot);
    g.laser = { beam, dot, mat };
  }
  const L = g.laser;
  const show = f.alive && f.armed;
  L.beam.visible = L.dot.visible = show;
  if (!show) return;
  const r = f.sword.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  const dir = _l.set(0, 1, 0).applyQuaternion(_q);
  const o = muzzle(f, new THREE.Vector3());
  const hit = castRay(world, o, dir, (h) => combat.info.get(h)?.fighter !== f && !combat.info.get(h)?.detached);
  const dist = hit ? hit.toi : GUN.range;
  const y0 = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength; // 총구 (칼 기준)
  const mx = f.weapon.muzzleX ?? 0;
  L.beam.position.set(mx, y0, 0);
  L.beam.scale.set(1, Math.max(0.01, dist), 1);
  L.dot.position.set(mx, y0 + dist, 0);
  L.dot.visible = !!hit;
  L.mat.opacity = g.cool > 0 ? 0.18 : 0.6;
}

/** 광선 하나: 가장 가까이 맞은 콜라이더 { collider, toi } (없으면 null). 쏜 사람 자신의 콜라이더는 건너뛴다 */
function castRay(world, o, d, pred) {
  // RAPIER.Ray 는 origin·dir 만 담는 순수 객체라, 같은 모양의 객체를 넘기면 된다 (RAPIER 모듈을 따로 불러오지 않는다)
  const ray = { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } };
  const hit = world.castRay(ray, GUN.range, true, undefined, undefined, undefined, undefined, (c) => pred(c.handle));
  if (!hit) return null;
  return { collider: hit.collider, toi: hit.timeOfImpact ?? hit.toi };
}

function sound(kind, f, ...more) {
  const p = muzzle(f, new THREE.Vector3());
  const hook = GUN_HOOKS[kind];
  if (hook) return hook(f, p, ...more);
  const snd = globalThis.window?.game?.sound;
  if (!snd?.ctx || !snd._on) return;
  ({ onShot: gunshotSound, onReload: reloadSound, onReloadStart: gateOpenSound, onLoadRound: loadRoundSound })[kind]?.(snd, p, ...more);
}

// ── 소리 (sound.js 의 이벤트·묶음을 그대로 빌려 쓴다: 전체 음량·끄기·먹먹함을 따른다) ──
/** 총소리: 짧고 센 잡음 터짐 + 낮은 "쿵" + 경기장에 울리는 꼬리 */
export function gunshotSound(snd, pos) {
  void prepareRevolverReload(snd); // 첫 사격부터 미리 읽어 장전 때 녹음이 준비되도록 한다.
  if (snd.gunshot) return snd.gunshot({ pos }); // 30차: 총성은 sound.js 의 gunshot 이 낸다 (.357/.44급 + 무대 울림). 아래는 옛 소리 — sound.js 가 오래된 판일 때만
  const c = snd.ctx;
  const ev = snd.event({ bus: snd.metalBus, gain: 2.2, prio: 3, pos }); // 사장님 '총성도 크게': 1.2 → 2.2 (약 +5 dB)
  const t = c.currentTime;
  const nb = snd._noiseBuf();
  const src = c.createBufferSource();
  src.buffer = nb;
  const hp = c.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 1800;
  hp.Q.value = 0.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1.6, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(hp).connect(g).connect(ev.input);
  src.start(t, Math.random() * 3);
  src.stop(t + 0.62);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  const og = c.createGain();
  og.gain.setValueAtTime(0.9, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(og).connect(ev.input);
  o.start(t);
  o.stop(t + 0.21);
  ev.srcs.push(src, o);
  ev.end = t + 0.62;
}
// 기존 장전 합성음이 소비하던 전역 난수 수를 유지한다. 녹음 선택/대체음은 별도 난수를 쓴다.
// 소리 교체만으로 전투 난수 순서가 바뀌지 않도록 7 + (6 × 2) + 2회를 보존한다.
function retainReloadRandom(count) {
  for (let i = 0; i < count; i++) Math.random();
}
/** 실린더 열기와 탄피 처리: 실제 리볼버 조작 녹음의 편집 구간. */
export function gateOpenSound(snd, pos) {
  retainReloadRandom(7);
  return playRevolverReload(snd, pos, 'open');
}
/** 한 발 삽입: 기존 물리 스케줄이 전달한 1~6번에 대응하는 서로 다른 녹음. */
export function loadRoundSound(snd, pos, roundNumber) {
  retainReloadRandom(2);
  return playRevolverReload(snd, pos, 'insert', roundNumber);
}
/** 장전 완료의 잠금: 실제 리볼버 조작 녹음. */
export function reloadSound(snd, pos) {
  retainReloadRandom(2);
  return playRevolverReload(snd, pos, 'close');
}

/**
 * 권총 AI (ai.js 가 무기가 총이면 매 스텝 이것만 부른다): 간격을 벌려 도망 다니며 쏜다.
 *  3.2 m 보다 가까우면 물러나고(벽이 가까우면 옆으로 돈다), 5 m 보다 멀면 다가간다. 쏠 수 있고 7 m 안이면 찌르기(=발사).
 */
export function gunAI(ai, dt) {
  const me = ai.me;
  // 판이 열리자마자 쏘지 않는다: 첫 발 전 GUN.aiFirst 초 (예전엔 0.1초에 쏴 판이 시작하자마자 끝나기도 했다).
  //  장전(cool)으로 기다리면 사격 자세가 총을 세워 올렸다가 내리며 쏴서 땅을 쐈다 → 겨눈 채로 따로 센다
  const d = ai.d;
  ai.gunT = (ai.gunT ?? 0) + dt;
  let fwd = d < 3.2 ? -1 : d > 5 ? 0.8 : 0;
  let side = Math.sin(ai.gunT * 0.9) * 0.6; // 옆으로 흔들며 움직인다 (가만히 서 있지 않게)
  const p = me.bodies.pelvis.translation();
  const rr = Math.hypot(p.x, p.z);
  if (fwd < 0 && rr > ARENA.radius - 1.3) {
    // 벽을 등졌다: 뒤로 못 가니 옆으로 크게 돌아 빠져나간다
    fwd = 0;
    side = (ai.gunSide ??= Math.sign(ai.foeLat || 1) * -1);
  } else ai.gunSide = null;
  me.move.set(side, fwd);
  ai.hand.set(0, 0); // 사격 자세(gunPose)는 조준 패드를 읽지 않는다 — 손 목표만 가운데에 둔다
  ai.handSpeed = 1.2;
  ai.moveHand(dt);
  // 흔들리는 총구가 상대의 골반 이상 몸 부위(골반·배·가슴·머리) 중 하나에서 aiAimTol° 안으로 들어왔을 때만 쏜다 (팔을 뻗는 중이나 장전 뒤 내려오는 중엔 쏘지 않는다)
  const aimed = aimErr(me) < GUN.aiAimTol;
  if (ai.gunT >= GUN.aiFirst && aimed && d < 7 && (me.gun?.cool ?? 0) <= 0 && me.skill.thrust({ step: false })) state(me).aim = 0.5 + 0.5 * (ai.level?.skill ?? 0.7);
}
