// ─────────────────────────────────────────────────────────────
//  결투장 가운데 장애물(잠든 습지 말레이곰 석상 · 봉인의 중정 급수정)의 물리: 고정 충돌체 · AI 돌아가기 · 카메라 보호
//   출처: 샛별 저장소 origin/main 325a5c38 의 src/arena_obstacle.js 를 옮겨 고침 — 우리 석상 꼴(받침 원기둥 + 캡슐, stage_sluice_bear.js)과
//   반지름(0.90 m, 확인표 1113)에 맞췄다. 보이지 않는 몸 끌기는 없다: AI 는 스틱 입력의 방향만 바꾸고, 플레이어는 직접 돌아가야 한다.
//   카메라 보호는 10/17 에 돌의 실제 꼴로 다시 짰다(아래 CAMERA_GUARD — 봉인의 중정 디자인 리뷰 고칠 목록 1, 확인표 2050).
// ─────────────────────────────────────────────────────────────
import { COURTYARD_COVER_SHAPES, COURTYARD_NAVIGATION, COURTYARD_START_Z, COURTYARD_START_Z_FOE } from './stage_courtyard_cover.js';
import { COVER_SIGHT, coverSight } from './courtyard_cover.js'; // 중정 실제 사선 (사장님 10/20 00:4x — 샛별 제안 ①) // 봉인의 중정 가운데 급수정 (샛별 저장소에서 가져옴 10/17 — 중정만 등록 · 시작 자리 · 총수 우회)
import { BEAR_OBSTACLE_SHAPES, BEAR_AVOID_RADIUS } from './stage_sluice_bear.js';

export const BEAR_NAVIGATION = Object.freeze({ x: 0, z: 0, radius: BEAR_AVOID_RADIUS });
// AI 돌아가기 (확인표 1117): 석상 반지름 + CLEAR 안을 지나는 길은 막힌 것으로 보고, 지금 각에서 STEP rad 앞 · 반지름 + CLEAR + RING 자리로 스틱을 돌린다
export const OBSTACLE_ROUTE = Object.freeze({ clear: 0.5, step: 0.58, ring: 0.75 });
// 카메라 보호 (10/17 — 확인표 1118 의 '석상 반지름 + 0.28 m 원' 을 바꿈 → 2050. docs/design/courtyard_fix_2026-10-17.md §1):
//  예전: 어깨 너머 카메라 길이 그 원에 막히면 원 앞으로 당기면서 높이도 같은 비로 내 몸 높이까지 내렸다. 원(중정 1.73 m)이 돌(긴 면 반폭 0.85 m)보다
//   커서 둘 사이 띠(약 0.6 m)에 설 수 있었고, 돌에 등을 대면 카메라가 내 몸 0.14~0.68 m · 허리 높이 0.9 m 로 들어가 내 캐릭터가 화면에서 사라졌다
//   (습지 석상도 같은 함수라 0.06 m — 칼 거리 상대 기준 바닥 칸 × 방향의 중정 3.9 % · 습지 2.1 %).
//  지금: 당기지도 내리지도 않는다. 카메라 거리 · 높이는 평소 그대로 두고, 돌의 실제 꼴(충돌체 — 상자 · 원기둥 · 캡슐 · 볼록 돔)이
//   ① 카메라 자리에서 pad 안이거나 ② 카메라 → 내 머리 · 가슴 · 골반 시선을 막으면, 내 무게중심을 축으로 카메라를 옆으로 돌려(위에서 보면 원을 따라)
//   막히지 않는 가장 작은 각을 찾는다 — 어깨 쪽(오른쪽) 먼저, 반대쪽이 sideBias 넘게 작으면 그쪽. 폰은 카메라를 손으로 못 돌리니 늘 내 몸이 보이게.
//  화면마다(main.js updateCamera): 한 번 고른 쪽을 지키고(돌 앞에서 좌우로 튀지 않게) 각은 시간으로 옮긴다 — 막히면 빨리 돌아 나가고(tauOut) 풀리면 천천히 돌아온다(tauBack).
//   그 상태는 넘겨받은 카메라 벡터마다 따로 둔다(main.js 는 화면마다 같은 camTarget 을 넘긴다). 측정 도구는 { instant: true } — 상태 없이 그 자리의 각
export const CAMERA_GUARD = Object.freeze({
  pad: 0.5, // 카메라 자리가 돌 꼴에서 떨어질 거리(m) — 가까운 면(0.1 m)이 돌 잔무늬를 자르지 않고 돌이 화면 한쪽을 덮지 않게 [사장님 확인 전]
  sight: 0.08, // 시선이 돌 꼴을 스칠 때 여유(m) — 보이는 돌이 충돌체보다 조금 큰 곳(습지 곰 털 · 머리 0.03~0.11 m)
  tip: 0.25, // 시선 끝(내 몸 점)에서 이만큼 앞까지만 본다 — 몸이 돌에 닿아도 시선 끝이 몸 둘레 여유에 걸려 늘 막히지 않게
  // 내 몸에서 보여야 할 점 [옆(m — 카메라에서 본 가로), 무게중심 위(m)]: 머리 가운데 · 양옆 · 가슴 양옆 · 골반 양옆 — 모두 보여야 '보인다'(몸 가운데만 보면 반쪽이 돌에 가려도 통과했다)
  eyes: [[0, 0.62], [-0.12, 0.62], [0.12, 0.62], [-0.2, 0.3], [0.2, 0.3], [-0.16, -0.05], [0.16, -0.05]],
  swingMax: 125, // 내 몸 둘레로 돌리는 가장 큰 각(°) — 급수정 넓은 면에 등을 붙여도 닿는다(바닥 지도 최대 값보다 넉넉히) [사장님 확인 전]
  step: 5, // 찾는 간격(°) — 처음 풀린 칸에서 반씩 세 번 좁힌다(0.6°)
  sideBias: 30, // 반대쪽(왼쪽)으로 돌기가 이만큼(°) 넘게 작아야 그쪽으로 [사장님 확인 전]
  tauOut: 0.06, // 막혀서 돌아 나갈 때 시간 상수(실제 초) — 막힌 화면이 몇 화면 넘게 남지 않게 [사장님 확인 전]
  tauBack: 0.3, // 풀려서 평소 자리로 돌아올 때 시간 상수(실제 초) [사장님 확인 전]
  forget: 0.5, // 이만큼(실제 초) 안 불리면(메뉴 · 새 판) 고른 쪽을 잊는다
  wall: 10.5, // 돌린 자리도 이 반지름 안 — main.js updateCamera '경기장 바깥 돌벽을 뚫고 나가지 않게' 와 같은 값
});
// 판 시작 자리 옆 비킴 (디자인 결정 D, 확인표 1121 → 1251): 석상은 정확히 가운데 두고 두 사람을 +z(카메라 어깨 쪽)로 옮겨 카메라 → 상대 시선이 석상에 막히지 않게.
//  판 시작 카메라(열림 1 · 0.5 · 0)에서 상대 머리·가슴(가운데·좌우 0.2)·골반·무릎까지 광선이 석상(곰 + 받침)에 하나도 안 닿는 가장 작은 값 (0.05 m 간격으로 잼).
//  곰 3.0 m 에서 0.45 → 사장님 10/14 10:3x 곰 3.2 m 에서 0.50 (0.45 면 열림 1 카메라 → 상대 가슴 오른쪽 0.2 광선 하나가 석상에 닿는다)
export const START_SIDE = 0.5;
// who 0 = 플레이어 · 1 = 상대. 중정은 비대칭(사장님 10/20 00:4x — 샛별 제안 ②: 처음엔 마야가 보이고 한 번 옆걸음이면 급수정 뒤로)
export const stageStartZ = (stageId, who = 0) => ((stageId === 'courtyard' || stageId === 'courtyard_night') ? (who ? COURTYARD_START_Z_FOE : COURTYARD_START_Z) : stageId === 'sluice' || stageId === 'sluice_night' ? START_SIDE : 0);

/**
 * 판(물리 세계)마다 부른다: 습지 석상 또는 중정 급수정의 고정 충돌체를 만들고, 다른 무대는 null. previous 가 같은 세계의 것이면 먼저 지운다.
 *  combat 의 colliderInfo 에는 넣지 않는다 — 칼·몸이 닿으면 땅처럼 물리로만 막히고, 총알 광선은 땅·돌로 친다
 */
export function configureStageObstacle(RAPIER, world, stageId, groups, previous = null) {
  if (previous?.world === world) world.removeRigidBody(previous.body);
  const courtyard=stageId==='courtyard'||stageId==='courtyard_night';
  if (!courtyard && stageId !== 'sluice' && stageId !== 'sluice_night') return null;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const handles = new Set();
  for (const s of courtyard ? COURTYARD_COVER_SHAPES : BEAR_OBSTACLE_SHAPES) {
    const d = s.type === 'convex' ? RAPIER.ColliderDesc.convexHull(new Float32Array(s.points)) : s.type === 'cylinder' ? RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius) : s.type === 'capsule' ? RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius) : RAPIER.ColliderDesc.cuboid(...s.halfExtents);
    d.setTranslation(...s.center).setCollisionGroups(groups).setFriction(0.8).setRestitution(0.02);
    if (s.rotation) d.setRotation(s.rotation);
    handles.add(world.createCollider(d, body).handle);
  }
  if (courtyard) COVER_SIGHT.handles.set(world, handles);
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
  let seekingShot = obstacle.seekSight && f.weapon?.gun;
  // 중정 실제 사선 (사장님 10/20 00:4x — 샛별 제안 ①): 사선 확보용 우회는 총구 → 상대 6 점이 모두 급수정에 가릴 때만. 하나라도 열렸으면 원으로 강제 우회하지 않는다
  //  (가까운 돌로 향하는 이동 충돌 회피 — 입력 방향 0.75 m 앞 — 는 그대로)
  if (COVER_SIGHT.on && seekingShot) {
    seekingShot = coverSight(f, foe).blocked;
    const len = Math.hypot(f.move.x, f.move.y);
    const vx = f.move.x * s + f.move.y * c, vz = f.move.x * c - f.move.y * s;
    const ahead = { x: p.x + (vx / Math.max(len, 1e-9)) * 0.75, z: p.z + (vz / Math.max(len, 1e-9)) * 0.75 };
    const inward = vx * (obstacle.x - p.x) + vz * (obstacle.z - p.z) > 0;
    if (!seekingShot && !(len > 0.01 && inward && obstacleSegmentBlocked(p, ahead, clearRadius, obstacle))) { ai.obstacleSide = null; return; }
  }
  // // 중정 급수정만(seekSight — stage_courtyard_cover.js): 사선이 막힌 총수는 쏠 각을 찾아 걸어 돈다 (샛별 저장소 10/17). 석상(습지)은 전 그대로
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

// ── 카메라 보호: 돌의 실제 꼴로 (위 CAMERA_GUARD 머리말) ──

/**
 * 충돌체 꼴(세상 좌표 — configureStageObstacle 과 같은 표) → 카메라 · 그늘 셈용 몸: 축에 맞춘 상자 · 세운 원기둥 · 캡슐.
 *  볼록 껍질(중정 돔)은 높이 켜마다 감싸는 세운 원기둥을 쌓아서, 돌린 상자는 감싸는 상자로 본다(넉넉한 쪽). 꼴을 바꾸면 여기도 그대로 따라온다
 */
export function cameraBlockers(shapes) {
  return Object.freeze(shapes.flatMap((s) => {
    const [x, y, z] = s.center;
    const q = s.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
    const turn = (vx, vy, vz) => { // 사원수 q 로 벡터를 돌린다
      const tx = 2 * (q.y * vz - q.z * vy), ty = 2 * (q.z * vx - q.x * vz), tz = 2 * (q.x * vy - q.y * vx);
      return [vx + q.w * tx + (q.y * tz - q.z * ty), vy + q.w * ty + (q.z * tx - q.x * tz), vz + q.w * tz + (q.x * ty - q.y * tx)];
    };
    if (s.type === 'cuboid') {
      const [a, b, c] = s.halfExtents;
      let hx = a, hy = b, hz = c;
      if (s.rotation) { hx = hy = hz = 0; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const [u, v, w] = turn(sx * a, sy * b, sz * c); hx = Math.max(hx, Math.abs(u)); hy = Math.max(hy, Math.abs(v)); hz = Math.max(hz, Math.abs(w)); } }
      return Object.freeze({ k: 'box', x0: x - hx, x1: x + hx, y0: y - hy, y1: y + hy, z0: z - hz, z1: z + hz });
    }
    if (s.type === 'capsule') {
      const [ax, ay, az] = turn(0, s.halfHeight, 0); // Rapier 캡슐 축 = 제 몸 +Y
      return Object.freeze({ k: 'cap', ax: x - ax, ay: y - ay, az: z - az, bx: x + ax, by: y + ay, bz: z + az, r: s.radius });
    }
    if (s.type === 'cylinder' && !s.rotation) return Object.freeze({ k: 'cyl', x, z, r: s.radius, y0: y - s.halfHeight, y1: y + s.halfHeight });
    // 볼록 껍질(점은 가운데 기준) · 돌린 원기둥: 점들의 높이 켜마다 감싸는 세운 원기둥 (중정 돔 — 둥근 지붕이 위로 갈수록 좁아지는 꼴을 따른다)
    const pts = s.points ?? [-s.radius, -s.halfHeight, -s.radius, s.radius, s.halfHeight, s.radius];
    const ring = new Map(); // 높이(mm) → 그 켜의 가장 큰 반지름
    for (let i = 0; i < pts.length; i += 3) { const [u, v, w] = turn(pts[i], pts[i + 1], pts[i + 2]); const k = Math.round(v * 1000); ring.set(k, Math.max(ring.get(k) ?? 0, Math.hypot(u, w))); }
    const ys = [...ring.keys()].sort((a, b) => a - b);
    if (ys.length < 2) return [Object.freeze({ k: 'cyl', x, z, r: ring.get(ys[0]) ?? 0, y0: y + ys[0] / 1000, y1: y + ys[0] / 1000 })];
    return ys.slice(1).map((k, i) => Object.freeze({ k: 'cyl', x, z, r: Math.max(ring.get(ys[i]), ring.get(k)), y0: y + ys[i] / 1000, y1: y + k / 1000 }));
  }));
}
// 길잡이(navigation) → 카메라 셈용 몸. 길잡이 객체는 그대로 두고(AI · 시험 도구가 같은 객체를 읽는다) 옆에 붙여 둔다
const CAMERA_BODIES = new Map([[COURTYARD_NAVIGATION, cameraBlockers(COURTYARD_COVER_SHAPES)], [BEAR_NAVIGATION, cameraBlockers(BEAR_OBSTACLE_SHAPES)]]);

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** 점(x, y, z)이 몸 b 에서 e 안인가 */
function pointNear(b, x, y, z, e) {
  if (b.k === 'box') {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    return dx * dx + dy * dy + dz * dz < e * e;
  }
  if (b.k === 'cyl') {
    const dr = Math.max(0, Math.hypot(x - b.x, z - b.z) - b.r), dy = Math.max(b.y0 - y, 0, y - b.y1);
    return dr * dr + dy * dy < e * e;
  }
  const ux = b.bx - b.ax, uy = b.by - b.ay, uz = b.bz - b.az;
  const t = clamp01(((x - b.ax) * ux + (y - b.ay) * uy + (z - b.az) * uz) / (ux * ux + uy * uy + uz * uz || 1));
  return Math.hypot(x - b.ax - ux * t, y - b.ay - uy * t, z - b.az - uz * t) < b.r + e;
}
/** 선분 p → p + d 와 캡슐 축 선분 사이 가장 가까운 거리 (Ericson, 실시간 충돌 검출 5.1.9) */
function segmentAxisDistance(px, py, pz, dx, dy, dz, b) {
  const ex = b.bx - b.ax, ey = b.by - b.ay, ez = b.bz - b.az;
  const rx = px - b.ax, ry = py - b.ay, rz = pz - b.az;
  const a = dx * dx + dy * dy + dz * dz, e = ex * ex + ey * ey + ez * ez, f = ex * rx + ey * ry + ez * rz;
  let s = 0, t = 0;
  if (a <= 1e-12) t = e > 1e-12 ? clamp01(f / e) : 0;
  else {
    const c = dx * rx + dy * ry + dz * rz;
    if (e <= 1e-12) s = clamp01(-c / a);
    else {
      const bb = dx * ex + dy * ey + dz * ez, den = a * e - bb * bb;
      s = den > 1e-12 ? clamp01((bb * f - c * e) / den) : 0;
      t = (bb * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((bb - c) / a); }
    }
  }
  return Math.hypot(px + dx * s - b.ax - ex * t, py + dy * s - b.ay - ey * t, pz + dz * s - b.az - ez * t);
}
/** 선분 p → q 가 몸 b 를 e 만큼 부풀린 꼴에 닿나 */
function segmentHits(b, px, py, pz, qx, qy, qz, e) {
  const dx = qx - px, dy = qy - py, dz = qz - pz;
  if (b.k === 'box') {
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[px, dx, b.x0 - e, b.x1 + e], [py, dy, b.y0 - e, b.y1 + e], [pz, dz, b.z0 - e, b.z1 + e]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
      let ta = (lo - p) / d, tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    return true;
  }
  if (b.k === 'cyl') {
    // 수평으로 원(r + e) 안인 구간 ∩ 높이(y0 − e ~ y1 + e) 안인 구간
    const R = b.r + e, ox = px - b.x, oz = pz - b.z;
    const A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), C = ox * ox + oz * oz - R * R;
    let t0 = 0, t1 = 1;
    if (A < 1e-12) { if (C > 0) return false; }
    else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) return false;
      const sq = Math.sqrt(disc);
      t0 = Math.max(t0, (-B - sq) / (2 * A)); t1 = Math.min(t1, (-B + sq) / (2 * A));
      if (t0 > t1) return false;
    }
    const lo = b.y0 - e, hi = b.y1 + e;
    if (Math.abs(dy) < 1e-9) return py >= lo && py <= hi;
    let ta = (lo - py) / dy, tb = (hi - py) / dy;
    if (ta > tb) [ta, tb] = [tb, ta];
    return Math.max(t0, ta) <= Math.min(t1, tb);
  }
  return segmentAxisDistance(px, py, pz, dx, dy, dz, b) < b.r + e;
}
/** 카메라 자리(x, y, z)에서 내 몸이 보이나: 자리가 모든 몸에서 pad 밖이고, 머리 · 가슴 · 골반의 가운데 · 양옆 시선이 몸(sight 만큼 부풀림)에 안 막힌다 */
function cameraClear(bodies, origin, x, y, z) {
  const G = CAMERA_GUARD;
  for (const b of bodies) if (pointNear(b, x, y, z, G.pad)) return false;
  const hx = origin.x - x, hz = origin.z - z, hl = Math.hypot(hx, hz) || 1, sx = -hz / hl, sz = hx / hl; // 카메라에서 본 가로(수평)
  for (const [side, up] of G.eyes) {
    const tx = origin.x + sx * side - x, ty = origin.y + up - y, tz = origin.z + sz * side - z;
    const L = Math.hypot(tx, ty, tz), k = L > G.tip ? (L - G.tip) / L : 0;
    for (const b of bodies) if (segmentHits(b, x, y, z, x + tx * k, y + ty * k, z + tz * k, G.sight)) return false;
  }
  return true;
}
/** 카메라를 내 무게중심 둘레로 a(rad) 돌린 자리 (높이 그대로, 경기장 벽 안). 카메라가 내 뒤에 있는 동안 음수 = 어깨 쪽(오른쪽) */
function swingTo(origin, base, a, out) {
  const vx = base.x - origin.x, vz = base.z - origin.z, c = Math.cos(a), s = Math.sin(a);
  out.x = origin.x + vx * c - vz * s;
  out.z = origin.z + vx * s + vz * c;
  out.y = base.y;
  const r = Math.hypot(out.x, out.z);
  if (r > CAMERA_GUARD.wall) { out.x *= CAMERA_GUARD.wall / r; out.z *= CAMERA_GUARD.wall / r; }
  return out;
}
const _swung = { x: 0, y: 0, z: 0 };
/** side(−1 어깨 쪽 · +1 반대쪽)로 돌려 막히지 않는 가장 작은 각(rad, 크기). swingMax 안에 없으면 null */
function clearAngle(bodies, origin, base, side) {
  const G = CAMERA_GUARD, step = (G.step * Math.PI) / 180, max = (G.swingMax * Math.PI) / 180;
  const ok = (a) => { swingTo(origin, base, side * a, _swung); return cameraClear(bodies, origin, _swung.x, _swung.y, _swung.z); };
  for (let lo = 0, a = step; a <= max + 1e-9; lo = a, a += step) {
    if (!ok(a)) continue;
    let hi = a;
    for (let i = 0; i < 3; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
    return hi;
  }
  return null;
}
/**
 * 점(x, y, z)에서 (dx, dy, dz)(단위 벡터) 쪽으로 length 안에 장애물 꼴이 있나 — 무대의 해 그늘(봉인의 중정: 급수정 그늘에 든 몸은 해를 덜 받는다,
 *  stage_courtyard.js fighterShade)이 쓴다. 장애물이 없거나 모르는 길잡이면 false
 */
export function obstacleBlocksRay(obstacle, x, y, z, dx, dy, dz, length = 30) {
  const bodies = obstacle && (obstacle.camera ?? CAMERA_BODIES.get(obstacle));
  if (!bodies) return false;
  const qx = x + dx * length, qy = y + dy * length, qz = z + dz * length;
  for (const b of bodies) if (segmentHits(b, x, y, z, qx, qy, qz, 0)) return true;
  return false;
}
const guardState = new WeakMap(); // 넘겨받은 카메라 벡터 → { side, swing, t }
const clockSec = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;

/**
 * 카메라 보호 (main.js updateCamera — 어깨 너머 자리를 정한 뒤 화면마다): 장애물이 카메라 자리나 카메라 → 내 몸 시선을 막으면
 *  거리 · 높이는 그대로 두고 내 무게중심(origin)을 축으로 카메라를 옆으로 돌린다 — 당기지도 내리지도 않는다(위 CAMERA_GUARD 머리말).
 *  opts.instant: 상태 없이 그 자리의 각 그대로(측정 도구). 아니면 카메라 벡터마다 고른 쪽을 지키고 각을 시간으로 옮긴다
 */
export function clampStageCamera(origin, camera, obstacle, opts = {}) {
  const bodies = obstacle && (obstacle.camera ?? CAMERA_BODIES.get(obstacle));
  if (!bodies) return camera;
  const G = CAMERA_GUARD;
  let st = null;
  if (!opts.instant) {
    st = guardState.get(camera);
    if (!st) guardState.set(camera, (st = { side: 0, swing: 0, t: -1 }));
  }
  const t = clockSec();
  const dt = st && st.t >= 0 ? t - st.t : 0;
  if (st && dt > G.forget) { st.side = 0; st.swing = 0; }
  // 이번 화면에 가야 할 각
  let side = 0, target = 0;
  if (!cameraClear(bodies, origin, camera.x, camera.y, camera.z)) {
    const need = { [-1]: clearAngle(bodies, origin, camera, -1), [1]: clearAngle(bodies, origin, camera, 1) };
    side = st?.side || -1; // 고른 쪽 (처음엔 어깨 쪽)
    // 중정(seekSight)은 고른 어깨 쪽에 길이 남아 있으면 반대쪽이 더 짧아도 바로 갈아타지 않는다 (사장님 10/20 00:4x — 샛별 제안 ③, 습지는 가림이 늘어 전 그대로)
    if (need[side] == null || (!obstacle.seekSight && need[-side] != null && need[-side] + (G.sideBias * Math.PI) / 180 < need[side])) side = -side;
    if (need[side] != null) target = side * need[side];
    else side = 0; // 양쪽 모두 막힘 — 평소 자리 그대로 (바닥 지도에서는 없음)
  }
  let swing = target;
  if (st) {
    st.t = t;
    if (side && st.side && side !== st.side) st.swing = target; // 쪽이 바뀌면 바로 — 돌 너머로 쓸고 지나가지 않게
    else {
      const tau = Math.abs(target) > Math.abs(st.swing) ? G.tauOut : G.tauBack;
      st.swing += (target - st.swing) * (dt > 0 ? 1 - Math.exp(-Math.min(dt, G.forget) / tau) : 1);
    }
    if (side) st.side = side;
    else if (Math.abs(st.swing) < 1e-3) { st.side = 0; st.swing = 0; }
    swing = st.swing;
  }
  if (swing) swingTo(origin, camera, swing, camera);
  return camera;
}
