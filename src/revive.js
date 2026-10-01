// ─────────────────────────────────────────────────────────────
//  부활: 처음 죽을 때 한 번 더 일어선다 (오너 결정, 2026-09-28)
//   "이졸데는 좀 약한 대신 부활하게 하려고. 투지를 보여서 한 번 더 싸우는 거지."
//   캐릭터 시트(characters.js)의 revive: { count, … } 가 Fighter 로 들어온 싸움꾼만 해당한다.
//   없으면 fighter.revive 가 null 이라 아래 함수가 모두 곧장 돌아간다 (예전과 똑같다 — fights12 등 바이트 동일).
//
//  흐름 (쓰러진 순간 t = 0, 물리 시간):
//   fall  : 죽음처럼 힘이 풀려 쓰러져 눕는다 (state 'down', 근육 0.02 = 죽은 몸과 같다). 0 ~ lie
//           (연출: lightAt 에 하늘에서 빛이 내려와 descend 동안 펼쳐진다 → 알림 — revive_fx.js · main.js)
//   rise  : lie 에 몸을 되찾고(피가 멎고 피·의식·팔다리를 되찾는다) 기존 일어서기(getup: 무릎 → 일어섬)로 일어선다.
//           놓친 칼은 이때 손으로 날아와 다시 쥔다 (부러진 칼은 부러진 그대로)
//   stand : 선 뒤에도 빛이 머무는(linger) · 사라지는(fade) 동안은 아직 부활 중. 끝나면 싸움이 이어진다
//  부활하는 동안(fall ~ stand 끝)은 살아 있는 것으로 친다(alive — 판이 끝나지 않는다). 대신 상처를 받지도 주지도 않는다:
//   두 사람의 칼이 서로의 몸을 지나간다(충돌 그룹, ghost). 몸끼리는 그대로 부딪힌다(겹쳐 있다 튕겨 나가지 않게).
//   그 사이 상대(플레이어)가 죽으면 보통처럼 판이 끝난다. 두 번째 죽음은 보통 죽음이다(판마다 count 번만).
//  fighter.js 에는 갈고리 몇 줄만 둔다: 생성자(reviveOf) · die(tryRevive) · updateState(reviveTick) · applyWound · shove
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// 시간(초)과 되찾는 몸 상태의 기본값. 캐릭터 시트의 revive 가 같은 이름으로 덮어쓴다 (limbs 는 항목별로)
export const REVIVE = {
  count: 1, // 한 판에 몇 번 일어서나
  lie: 1.9, // 쓰러진 뒤 일어나기 시작할 때까지 (쓰러지는 약 0.6초 + 누워 있기 약 1.3초)
  lightAt: 1.2, // (연출) 하늘에서 빛이 내려오기 시작하는 때
  descend: 0.4, // (연출) 가는 빛줄기가 땅까지 내려와 다 펼쳐질 때까지 → 그때 알림
  kneel: 0.8, // 무릎 꿇은 자세 시간 (보통 일어서기는 1.1초 ÷ 다리 ÷ 기운 — 투지로 조금 빨리)
  rise: 0.9, // 무릎에서 일어서는 시간 (보통과 같은 0.9초)
  linger: 0.5, // 선 뒤에 빛이 머무는 시간
  fade: 0.6, // 빛이 사라지는 시간. 끝나면 부활 끝 (싸움이 이어진다)
  swordFly: 0.55, // 놓친 칼이 손으로 날아오는 시간
  swordArc: 0.35, // 날아오는 칼이 떠오르는 높이 (m)
  // 일어설 때 되찾는 몸 (이보다 나으면 그대로 둔다). 피는 약한 기운 문턱(VITALS.weakBlood 0.8) 아래 — 여전히 다친 몸이다
  blood: 0.7,
  consciousness: 0.9,
  limbs: { armS: 0.6, armO: 0.4, legF: 0.7, legB: 0.7 }, // 칼을 다시 놓치지 않고(dropSwordArm 0.15) 다리로 선다(주저앉음 0.25)
  obsession: 0.8, // 싸움을 이어 갈 때 집념 세기 (지배 감정, ai.js resumeAfterRevive)
  obsessionHold: 10, // 그동안 다른 감정이 집념을 밀어내지 못한다 (초)
};

const GROUND_BIT = 1; // fighter.js BIT.ground (충돌 그룹: 땅)

/** 생성자에서: 캐릭터 시트의 revive → 이 싸움꾼의 부활 설정 (없으면 null = 부활 없음) */
export function reviveOf(spec) {
  if (!spec || !(spec.count > 0)) return null;
  return { ...REVIVE, ...spec, limbs: { ...REVIVE.limbs, ...spec.limbs }, left: spec.count };
}

/**
 * die() 에서: 이 죽음을 부활로 바꿀 수 있으면 부활을 시작하고 true (die 는 여기서 멈춘다).
 *  부활하는 동안의 죽음(피가 모자람 등)도 삼킨다. 남은 횟수가 없으면 false → 보통 죽음
 */
export function tryRevive(f, cause) {
  if (f.revival) return true;
  if (f.decapitated) return false; // 참수된 몸은 일어서지 않는다 (현실감 귀결, COMBAT.decapitate — 남은 횟수는 그대로)
  if (cause === '내려찍기') return false; // 찍기 즉사는 참수처럼 되살아나지 않는다 (디렉터 10/1). 남은 횟수는 그대로 (fighter.applyWound h.finish)
  const R = f.revive;
  if (!R || R.left <= 0) return false;
  R.left--;
  f.revival = { phase: 'fall', t: 0, cause, n: R.count - R.left, standT: -1, disarmed: !f.armed, broken: !!f.weaponBroken, sword: null, groups: null, downTime: f.downTime };
  f.downTime = 1e9; // 저절로 일어나지 않는다 (reviveTick 이 lie 에 일으킨다)
  f.setState('down');
  ghost(f, true);
  return true;
}

/** updateState 에서 (일어서는 시간을 계산한 뒤, 상태를 옮기기 전) 부활하는 동안 매 스텝 */
export function reviveTick(f, dt) {
  const V = f.revival;
  const R = f.revive;
  V.t += dt;
  if (V.phase === 'fall') {
    f.muscle = Math.min(f.muscle, 0.02); // 죽은 몸처럼 힘이 다 풀린다 (보통 넘어짐은 0.1)
    if (V.t < R.lie) return;
    restore(f, R);
    f.setState('getup'); // 기존 일어서기: 무릎 꿇은 자세 → 일어섬
    V.phase = 'rise';
    if (!f.armed) V.sword = startSwordReturn(f);
  }
  if (V.phase === 'rise') {
    f.kneelTime = R.kneel;
    f.riseTime = R.rise;
    if (V.sword) flySword(f, V, dt);
    // 일어섰다 (지난 스텝 끝에 stand 로 옮겨졌다). 혹시 못 일어서도 넉넉한 시간이 지나면 빛을 거둔다
    if (f.state === 'stand' || V.t > R.lie + R.kneel + R.rise + 1.5) {
      if (V.sword) attachSword(f, V); // (칼이 아직 날아오는 중이면 마저 쥔다)
      V.phase = 'stand';
      V.standT = V.t;
    }
  }
  if (V.phase === 'stand' && V.t >= V.standT + R.linger + R.fade) end(f);
}

/** 일어서는 순간: 피가 멎고(상처는 그대로 보인다) 피·의식·팔다리를 되찾는다 */
function restore(f, R) {
  f.blood = Math.max(f.blood, R.blood);
  f.bleed = 0;
  for (const w of f.wounds) w.bleed = 0;
  f.consciousness = Math.max(f.consciousness, R.consciousness);
  f.pain = 0;
  f.daze = 0;
  f.balance = 100;
  f.offBalanceTime = 0;
  for (const k in R.limbs) if (k in f.limbs) f.limbs[k] = Math.max(f.limbs[k], R.limbs[k]);
}

function end(f) {
  const V = f.revival;
  if (V.sword) attachSword(f, V);
  ghost(f, false);
  f.downTime = V.downTime;
  f.revival = null;
}

/**
 * 유령: 부활하는 동안 상대 칼이 내 몸을, 내 칼이 상대(몸·칼)를 지나간다 — 상처·충격·파손이 생기지 않는다.
 *  원래 충돌 그룹을 적어 두었다가 끝날 때 그대로 되돌린다. 몸끼리·땅과는 그대로 부딪힌다
 */
function ghost(f, on) {
  const V = f.revival;
  if (!on) {
    for (const [col, g] of V.groups || []) col.setCollisionGroups(g);
    V.groups = null;
    return;
  }
  const foeWeapon = f.foe?.swordColliders?.[0] ? f.foe.swordColliders[0].collisionGroups() >>> 16 : 0;
  const saved = [];
  for (const k in f.bodies) {
    const rb = f.bodies[k];
    for (let i = 0; i < rb.numColliders(); i++) {
      const col = rb.collider(i);
      const g = col.collisionGroups();
      saved.push([col, g]);
      col.setCollisionGroups(g & ~foeWeapon); // 몸: 상대 칼만 뺀다
    }
  }
  for (const col of f.swordColliders) {
    const g = col.collisionGroups();
    saved.push([col, g]);
    col.setCollisionGroups(ghostSword(g));
  }
  V.groups = saved;
}
const ghostSword = (g) => (g & 0xffff0000) | GROUND_BIT; // 칼: 땅하고만

// ── 놓친 칼이 손으로 돌아온다 ──
//  칼은 그대로 물리 물체(동역학)다. 날아오는 동안엔 아무것과도 부딪히지 않게 하고(충돌 그룹 0) 중력을 끄고, 매 스텝 속도를 정해
//  손목 자리로 끌어온다(곡선을 그리며 떠올랐다 내려앉는다). 다 오면 생성자와 똑같은 손목 관절로 다시 쥔다
const _p = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _qh = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

function startSwordReturn(f) {
  const sw = f.sword;
  for (const col of f.swordColliders) col.setCollisionGroups(0);
  sw.setGravityScale(0, true);
  const p = sw.translation();
  const r = sw.rotation();
  return { t: 0, p0: new THREE.Vector3(p.x, p.y, p.z), q0: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
}

/** 손목(아래팔 앞끝, 생성자의 손목 관절 자리) 월드 위치 */
function wristOf(f, out) {
  const b = f.bodies.farmS;
  const r = b.rotation();
  const t = b.translation();
  return out.set(0.13, 0, 0).applyQuaternion(_qc.set(r.x, r.y, r.z, r.w)).add(_w.set(t.x, t.y, t.z));
}

/** 쥐었을 때의 칼 자세: 생성자의 준비 자세 (몸이 바라보는 쪽으로 칼끝이 앞을 향함) */
function holdRot(f, out) {
  return out.setFromAxisAngle(UP, f.heading).multiply(_qc.setFromAxisAngle(Z_AXIS, -1.45));
}

function flySword(f, V, dt) {
  const S = V.sword;
  S.t += dt;
  const u = Math.min(1, S.t / f.revive.swordFly);
  if (u >= 1) return attachSword(f, V);
  const e = u * u * (3 - 2 * u);
  // 이번 스텝이 끝날 때 있어야 할 자리 → 속도
  const target = wristOf(f, _p);
  target.sub(S.p0).multiplyScalar(e).add(S.p0);
  target.y += f.revive.swordArc * Math.sin(Math.PI * u);
  const sw = f.sword;
  const p = sw.translation();
  sw.setLinvel({ x: (target.x - p.x) / dt, y: (target.y - p.y) / dt, z: (target.z - p.z) / dt }, true);
  // 자세: 처음 자세 → 쥐는 자세 (구면 보간) 로 이번 스텝만큼 돌린다
  _q.copy(S.q0).slerp(holdRot(f, _qh), e);
  const r = sw.rotation();
  _qc.set(r.x, r.y, r.z, r.w).invert();
  _q.multiply(_qc); // 지금 → 목표 회전
  if (_q.w < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
  const ang = 2 * Math.acos(Math.min(1, _q.w));
  const s = Math.sqrt(Math.max(1e-12, 1 - _q.w * _q.w));
  const k = ang / dt / s;
  sw.setAngvel(ang > 1e-5 ? { x: _q.x * k, y: _q.y * k, z: _q.z * k } : { x: 0, y: 0, z: 0 }, true);
}

/** 칼을 손에 쥔다: 손목 자리·쥐는 자세에 맞춰 놓고 생성자와 같은 손목 관절을 다시 만든다 */
function attachSword(f, V) {
  V.sword = null;
  const sw = f.sword;
  const w = wristOf(f, _p);
  sw.setTranslation({ x: w.x, y: w.y, z: w.z }, true);
  const q = holdRot(f, _qh);
  sw.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  const v = f.bodies.farmS.linvel();
  sw.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
  sw.setAngvel({ x: 0, y: 0, z: 0 }, true);
  sw.setGravityScale(1, true);
  // 날아오는 동안 꺼 둔 충돌을 부활 중의 유령 칼로 (부활이 끝나면 ghost 가 원래대로 되돌린다)
  for (const [col, g] of V.groups || []) if (f.swordColliders.includes(col)) col.setCollisionGroups(ghostSword(g));
  f.gripJoint = f.world.createImpulseJoint(f.R.JointData.spherical({ x: 0.13, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), f.bodies.farmS, sw, true);
  f.armed = true;
  f.tipPrev = null; // 칼끝 자리가 한순간에 옮겨졌다: 칼끝 속도 추정이 튀지 않게 (breakWeapon 과 같다)
  f.hitPointPrev = null;
  f.prevAim = null;
}
