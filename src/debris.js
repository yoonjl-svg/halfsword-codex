// ─────────────────────────────────────────────────────────────
//  흩어지는 조각 (겉모습만 — 물리 엔진·판정과 무관): 부러진 칼날 끝(fighter.shatterLook)과 부서진 투구·판금 조각
//  (fighter.flingDebris)을 이 모듈 하나가 띄우고, 움직이고, 치운다. 조각마다 수명과 사라지는 법을 따로 갖는다:
//   · 칼 조각 (spawnDebris): 부러진 순간 칼 몸체의 속도·각속도로 날아가 땅에 튀고, DEBRIS.life(1.6초)의 마지막 DEBRIS.fade 동안 흐려진다
//   · 방어구 조각 (scatterDebris): 방어구 전용 난수로 정한 속도·도는 빠르기·수명(ARMOR.debrisLife 1.1~1.7초)대로 날다가
//     땅에 튀고, 수명 후반(DEBRIS.armor.shrinkFrom 너머)에 작아져 사라진다
//  시계: 게임 시간. main.js 가 물리 한 스텝마다 tickDebris(PHYSICS.timestep)를 부르고(타격 멈칫·슬로모션을 그대로 따른다),
//   판이 끝나 메뉴가 뜬 뒤에는 판 끝 슬로모션 0.5배로 마저 날려 사라지게 한다. 싸움 중 일시정지면 멈춘 채 기다린다.
//   헤드리스 시뮬엔 부르는 쪽이 없어 조각을 띄우지 않는다(debrisEnabled — 검사 도구만 DEBRIS.headless 를 켜고 tickDebris 를 직접 부른다).
//  치우기: clearDebris() 하나 — main.js 가 새 판(newRound)·배경 바꿈 때 부른다(여러 번 불러도 괜찮다). 칼 조각은 주인 칼 그룹이
//   장면에서 빠지면(새 판이 싸움꾼 메쉬를 걷어낼 때) 다음 tick 에서도 치워진다.
//  난수: 이 모듈은 쓰지 않는다 (칼 조각의 옆 튕김은 조각 번호로, 방어구 조각의 흩어짐은 부르는 쪽 fighter.armorRandom 으로).
//   새 three.js 객체(UUID 에 Math.random)를 만드는 곳은 spawnDebris 의 회전 중심 그룹뿐이라 부르는 쪽이 isolatedVisual 로 감싼다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const DEBRIS = {
  life: 1.6, // 초: 칼 조각이 이만큼 지나면 사라진다
  fade: 0.5, // 초: 칼 조각이 마지막 이만큼 동안 흐려진다
  gravity: 9.81,
  floorY: 0, // 경기장 바닥 높이
  bounce: 0.3, // 땅에 튈 때 되튀는 비율
  groundFriction: 0.55, // 칼 조각: 땅에 닿을 때 수평 속도에 곱한다
  spinDamp: 0.5, // 칼 조각: 땅에 닿을 때 도는 빠르기에 곱한다
  kick: 0.8, // 부러질 때 옆으로 튕겨 나가는 속도 (m/s)
  // 방어구 조각 (수명은 부르는 쪽이 ARMOR.debrisLife 에서 골라 넘긴다): 조각 원점이 바닥 위 floor(m)에서 튀고,
  //  수명의 shrinkFrom 비율부터 끝까지 작아져 사라진다
  armor: { floor: 0.03, groundFriction: 0.6, spinDamp: 0.6, shrinkFrom: 0.45 },
  headless: false, // 브라우저 밖(시뮬)에서도 조각을 띄울까 (검사 도구만 켠다 — 저절로 움직이지 않아 tickDebris 를 직접 부른다)
};

const live = [];
let count = 0;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _box = new THREE.Box3();

/**
 * 칼 조각 하나를 띄운다. frag: 자식 좌표가 칼 그룹 기준인 그룹. pos/quat: 부러진 순간 칼 몸체의 자세,
 *  vel/angvel: 그 몸체의 속도·각속도 (월드). owner: 판이 바뀌면 장면에서 빠지는 칼 그룹 (정리 신호).
 */
export function spawnDebris(scene, frag, { pos, quat, vel, angvel, owner }) {
  frag.position.copy(pos);
  frag.quaternion.copy(quat);
  frag.updateMatrixWorld(true);
  // 조각 중심 속도 = 몸체 속도 + 각속도 × (중심 − 몸체 원점) + 옆으로 살짝 튕김
  _box.setFromObject(frag);
  const c = _box.getCenter(new THREE.Vector3());
  const r = c.clone().sub(pos);
  const v = new THREE.Vector3().crossVectors(angvel, r).add(vel);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).multiplyScalar(count++ % 2 ? DEBRIS.kick : -DEBRIS.kick);
  v.add(side).setY(v.y + 1.2);
  // 회전 중심을 조각 중심으로 옮긴다 (자식을 그만큼 반대로 민다)
  const pivot = new THREE.Group();
  pivot.position.copy(c);
  const local = c.clone().sub(pos).applyQuaternion(quat.clone().invert());
  for (const ch of [...frag.children]) ch.position.sub(local);
  frag.position.set(0, 0, 0);
  pivot.quaternion.copy(quat);
  frag.quaternion.identity();
  pivot.add(frag);
  const mats = [];
  frag.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.transparent = true;
      mats.push({ m, base: m.opacity ?? 1 });
    }
  });
  const size = _box.getSize(new THREE.Vector3());
  scene.add(pivot);
  live.push({
    obj: pivot,
    vel: v,
    w: angvel.clone().multiplyScalar(0.6),
    t: 0,
    life: DEBRIS.life,
    floor: DEBRIS.floorY + Math.max(0.01, Math.min(size.x, size.y, size.z) / 2),
    friction: DEBRIS.groundFriction,
    spinDamp: DEBRIS.spinDamp,
    mats, // 흐려지며 사라진다
    s0: null,
    owner,
  });
  return pivot;
}

/**
 * 방어구 조각 하나를 장면으로 떼어 내 흩어지게 한다 (월드 자세는 그대로, 새 객체를 만들지 않는다).
 *  vel: 속도(m/s), spin: 각속도(rad/s, 월드 축), life: 수명(초). 조각을 띄우지 않는 환경(헤드리스 시뮬)이면 바로 치운다.
 *  떼어 낸 조각의 지오메트리·재질은 사라질 때 푼다 (그 위의 긁힌 자국·금 포함)
 */
export function scatterDebris(scene, obj, { vel, spin, life }) {
  if (!debrisEnabled()) return disposeTree(obj);
  scene.attach(obj);
  live.push({
    obj,
    vel,
    w: spin,
    t: 0,
    life,
    floor: DEBRIS.floorY + DEBRIS.armor.floor,
    friction: DEBRIS.armor.groundFriction,
    spinDamp: DEBRIS.armor.spinDamp,
    mats: null,
    s0: obj.scale.clone(), // 작아지며 사라진다
    owner: null,
  });
}

/** 한 스텝 움직인다 (초, 게임 시간). 떠 있는 조각이 남았으면 true */
export function tickDebris(dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const d = live[i];
    d.t += dt;
    if (d.t >= d.life || (d.owner && !d.owner.parent)) {
      disposeTree(d.obj);
      live.splice(i, 1);
      continue;
    }
    const o = d.obj;
    d.vel.y -= DEBRIS.gravity * dt;
    o.position.addScaledVector(d.vel, dt);
    if (o.position.y < d.floor) {
      o.position.y = d.floor;
      if (d.vel.y < 0) d.vel.y = -d.vel.y * DEBRIS.bounce;
      d.vel.x *= d.friction;
      d.vel.z *= d.friction;
      d.w.multiplyScalar(d.spinDamp);
      d.landed = true; // (제안) 조각이 땅에 떨어지는 소리를 붙일 자리
    }
    const wl = d.w.length();
    if (wl > 1e-6) o.quaternion.premultiply(_q.setFromAxisAngle(_v.copy(d.w).divideScalar(wl), wl * dt));
    if (d.s0) {
      const k = 1 - THREE.MathUtils.smoothstep(d.t, d.life * DEBRIS.armor.shrinkFrom, d.life);
      o.scale.copy(d.s0).multiplyScalar(Math.max(1e-3, k));
    } else {
      const left = d.life - d.t;
      if (left < DEBRIS.fade) for (const { m, base } of d.mats) m.opacity = base * (left / DEBRIS.fade);
    }
  }
  return live.length > 0;
}

/** 남은 조각을 모두 치운다 (새 판·배경 바꿈. 여러 번 불러도 괜찮다) */
export function clearDebris() {
  for (const d of live) disposeTree(d.obj);
  live.length = 0;
}

/** 이 환경에서 조각을 띄울까 (브라우저, 또는 검사 도구가 headless 를 켰을 때) */
export function debrisEnabled() {
  return DEBRIS.headless || typeof requestAnimationFrame === 'function';
}

/** 지금 떠 있는 조각 수 (검사용). kind 'weapon' | 'armor' 면 그 종류만 */
export function debrisCount(kind) {
  if (!kind) return live.length;
  let n = 0;
  for (const d of live) if ((d.s0 ? 'armor' : 'weapon') === kind) n++;
  return n;
}

/** 장면에서 떼어 내고 지오메트리·재질을 GPU 에서 푼다 */
function disposeTree(o) {
  o.removeFromParent();
  o.traverse((c) => {
    c.geometry?.dispose();
    if (c.material) for (const m of [].concat(c.material)) m.dispose();
  });
}
