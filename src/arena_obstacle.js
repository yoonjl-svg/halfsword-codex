// ─────────────────────────────────────────────────────────────
//  잠든 습지 가운데 말레이곰 석상의 물리: 고정 충돌체 · AI 돌아가기 · 카메라 보호
//   출처: 샛별 저장소 origin/main 325a5c38 의 src/arena_obstacle.js 를 옮겨 고침 — 우리 석상 꼴(받침 원기둥 + 캡슐, stage_sluice_bear.js)과
//   반지름(0.90 m, 확인표 1113)에 맞췄다. 보이지 않는 몸 끌기는 없다: AI 는 스틱 입력의 방향만 바꾸고, 플레이어는 직접 돌아가야 한다.
// ─────────────────────────────────────────────────────────────
import { COURTYARD_COVER_SHAPES, COURTYARD_NAVIGATION, COURTYARD_START_Z } from './stage_courtyard_cover.js';
import { BEAR_OBSTACLE_SHAPES, BEAR_AVOID_RADIUS } from './stage_sluice_bear.js';

export const BEAR_NAVIGATION = Object.freeze({ x: 0, z: 0, radius: BEAR_AVOID_RADIUS });
// AI 돌아가기 (확인표 1117): 석상 반지름 + CLEAR 안을 지나는 길은 막힌 것으로 보고, 지금 각에서 STEP rad 앞 · 반지름 + CLEAR + RING 자리로 스틱을 돌린다
export const OBSTACLE_ROUTE = Object.freeze({ clear: 0.5, step: 0.58, ring: 0.75 });
// 카메라가 석상 안으로 들어가지 않게 자르는 반지름 = 석상 반지름 + CAMERA_PAD (확인표 1118)
export const CAMERA_PAD = 0.28;
// 판 시작 자리 옆 비킴 (디자인 결정 D, 확인표 1121 → 1251): 석상은 정확히 가운데 두고 두 사람을 +z(카메라 어깨 쪽)로 옮겨 카메라 → 상대 시선이 석상에 막히지 않게.
//  판 시작 카메라(열림 1 · 0.5 · 0)에서 상대 머리·가슴(가운데·좌우 0.2)·골반·무릎까지 광선이 석상(곰 + 받침)에 하나도 안 닿는 가장 작은 값 (0.05 m 간격으로 잼).
//  곰 3.0 m 에서 0.45 → 사장님 10/14 10:3x 곰 3.2 m 에서 0.50 (0.45 면 열림 1 카메라 → 상대 가슴 오른쪽 0.2 광선 하나가 석상에 닿는다)
export const START_SIDE = 0.5;
export const stageStartZ = (stageId) => (stageId === 'courtyard' ? COURTYARD_START_Z : stageId === 'sluice' || stageId === 'sluice_night' ? START_SIDE : 0);

/**
 * 판(물리 세계)마다 부른다: 습지 석상 또는 중정 급수정의 고정 충돌체를 만들고, 다른 무대는 null. previous 가 같은 세계의 것이면 먼저 지운다.
 *  combat 의 colliderInfo 에는 넣지 않는다 — 칼·몸이 닿으면 땅처럼 물리로만 막히고, 총알 광선은 땅·돌로 친다
 */
export function configureStageObstacle(RAPIER, world, stageId, groups, previous = null) {
  if (previous?.world === world) world.removeRigidBody(previous.body);
  const courtyard=stageId==='courtyard';
  if (!courtyard && stageId !== 'sluice' && stageId !== 'sluice_night') return null;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const handles = new Set();
  for (const s of courtyard ? COURTYARD_COVER_SHAPES : BEAR_OBSTACLE_SHAPES) {
    const d = s.type === 'convex' ? RAPIER.ColliderDesc.convexHull(new Float32Array(s.points)) : s.type === 'cylinder' ? RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius) : s.type === 'capsule' ? RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius) : RAPIER.ColliderDesc.cuboid(...s.halfExtents);
    d.setTranslation(...s.center).setCollisionGroups(groups).setFriction(0.8).setRestitution(0.02);
    if (s.rotation) d.setRotation(s.rotation);
    handles.add(world.createCollider(d, body).handle);
  }
  return { world, body, handles, navigation: courtyard ? COURTYARD_NAVIGATION : BEAR_NAVIGATION };
}

/** a → b 선분이 가운데 centre 에서 radius 안을 지나나 (수평) */
export function obstacleSegmentBlocked(a, b, radius, centre = BEAR_NAVIGATION) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  if (length2 < 1e-8) return false;
  const t = Math.max(0, Math.min(1, ((centre.x - a.x) * dx + (centre.z - a.z) * dz) / length2));
  return Math.hypot(a.x + t * dx - centre.x, a.z + t * dz - centre.z) < radius;
}

/** AI 스틱 입력만 바꾼다: 상대에게 가는 길이 석상에 막혔으면 다가가던 세기 그대로 방향만 석상 둘레로. 기존 무대의 서 있는 공격·부활·물러남은 그대로. 중정 총수만 막힌 사선을 찾아 돌아간다. */
export function routeAroundStageObstacle(ai) {
  const f = ai.me;
  const foe = ai.foe;
  const obstacle = f.arenaObstacle;
  if (!obstacle || !f.alive || !foe?.alive || f.state !== 'stand' || f.feetHeld || f.revival) return;
  const p = f.bodies.pelvis.translation();
  const target = foe.bodies.pelvis.translation();
  const clearRadius = obstacle.radius + OBSTACLE_ROUTE.clear;
  // 둘 중 누구든 돌 안이 아니라 길잡이 여유 안에만 들어와도, 길 끝을 바깥으로 밀어 같은 쪽 접근이 끝날 수 있게
  const marginPoint = (v) => {
    const x = v.x - obstacle.x;
    const z = v.z - obstacle.z;
    const d = Math.hypot(x, z);
    return d > 1e-6 && d < clearRadius + 0.02 ? { x: obstacle.x + (x / d) * (clearRadius + 0.02), z: obstacle.z + (z / d) * (clearRadius + 0.02) } : v;
  };
  if (!obstacleSegmentBlocked(marginPoint(p), marginPoint(target), clearRadius, obstacle)) {
    ai.obstacleSide = null;
    return;
  }
  const c = Math.cos(f.heading);
  const s = Math.sin(f.heading);
  const seekingShot = obstacle.seekSight && f.weapon?.gun; // Only the courtyard kiosk: a blocked gunner walks around for a firing angle.
  const speed = Math.max(seekingShot ? .65 : 0, Math.hypot(f.move.x, f.move.y));
  const mx = f.move.x * s + f.move.y * c;
  const mz = f.move.x * c - f.move.y * s;
  if (!seekingShot && (speed < 0.01 || mx * (target.x - p.x) + mz * (target.z - p.z) <= 0)) return; // 멈춘 공격·물러남은 그대로
  const angle = Math.atan2(p.z - obstacle.z, p.x - obstacle.x);
  const targetAngle = Math.atan2(target.z - obstacle.z, target.x - obstacle.x);
  const delta = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
  ai.obstacleSide ??= Math.abs(delta) > 0.01 ? Math.sign(delta) : f.index ? 1 : -1;
  const next = angle + ai.obstacleSide * OBSTACLE_ROUTE.step;
  const radius = clearRadius + OBSTACLE_ROUTE.ring;
  const dx = obstacle.x + Math.cos(next) * radius - p.x;
  const dz = obstacle.z + Math.sin(next) * radius - p.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return;
  const x = dx / length;
  const z = dz / length;
  f.move.set((x * s + z * c) * speed, (x * c - z * s) * speed);
  f.stickX = f.move.x;
  f.stickY = f.move.y;
}

/** 카메라가 석상을 가로지르거나 안으로 들어가지 않게: origin(내 무게중심) → camera 선분이 석상 원에 닿으면 그 앞에서 자른다 */
export function clampStageCamera(origin, camera, obstacle) {
  if (!obstacle) return camera;
  const r = obstacle.radius + CAMERA_PAD;
  let ax = origin.x - obstacle.x;
  let az = origin.z - obstacle.z;
  const ad = Math.hypot(ax, az);
  // 기운 무게중심은 몸이 돌에 안 들어가도 원 안에 들 수 있다
  if (ad < r + 0.01) {
    const k = (r + 0.02) / Math.max(ad, 1e-6);
    ax = ad ? ax * k : r + 0.02;
    az = ad ? az * k : 0;
  }
  const dx = camera.x - obstacle.x - ax;
  const dz = camera.z - obstacle.z - az;
  const aa = dx * dx + dz * dz;
  const bb = 2 * (ax * dx + az * dz);
  const cc = ax * ax + az * az - r * r;
  const disc = bb * bb - 4 * aa * cc;
  if (aa > 1e-8 && disc >= 0) {
    const hit = (-bb - Math.sqrt(disc)) / (2 * aa);
    if (hit >= 0 && hit <= 1) {
      const t = Math.max(0, hit - 0.04 / Math.sqrt(aa));
      camera.x = obstacle.x + ax + dx * t;
      camera.z = obstacle.z + az + dz * t;
      camera.y = origin.y + (camera.y - origin.y) * t;
    }
  }
  return camera;
}
