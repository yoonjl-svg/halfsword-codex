// One physical centrepiece for the optional wetland. No invisible body steering.
import { BEAR_OBSTACLE_SHAPES, BEAR_AVOID_RADIUS } from './stage_sluice_bear.js';

export const BEAR_NAVIGATION = Object.freeze({ x: 0, z: 0, radius: BEAR_AVOID_RADIUS });
export function configureStageObstacle(RAPIER, world, stageId, groups, previous = null) {
  if (previous?.world === world) world.removeRigidBody(previous.body);
  if (stageId !== 'sluice') return null;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const handles = new Set();
  for (const s of BEAR_OBSTACLE_SHAPES) {
    const d = s.type === 'cylinder' ? RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius)
      : s.type === 'capsule' ? RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius)
      : RAPIER.ColliderDesc.cuboid(...s.halfExtents);
    d.setTranslation(...s.center).setCollisionGroups(groups).setFriction(0.8).setRestitution(0.02);
    if (s.rotation) d.setRotation(s.rotation);
    handles.add(world.createCollider(d, body).handle);
  }
  // Deliberately absent from combat.colliderInfo: a gun ray classifies these as world/stone.
  return { world, body, handles, navigation: BEAR_NAVIGATION };
}

export function obstacleSegmentBlocked(a, b, radius, centre = BEAR_NAVIGATION) {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  if (length2 < 1e-8) return false;
  const t = Math.max(0, Math.min(1, ((centre.x - a.x) * dx + (centre.z - a.z) * dz) / length2));
  return Math.hypot(a.x + t * dx - centre.x, a.z + t * dz - centre.z) < radius;
}

/** Changes AI stick input only; player motion and physical body velocities are untouched. */
export function routeAroundStageObstacle(ai) {
  const f = ai.me, foe = ai.foe, obstacle = f.arenaObstacle;
  if (!obstacle || !f.alive || !foe?.alive || f.state !== 'stand' || f.feetHeld || f.revival) return;
  const p = f.bodies.pelvis.translation(), target = foe.bodies.pelvis.translation();
  const clearRadius = obstacle.radius + 0.5;
  // Either fighter can enter the navigation margin without entering stone.
  // Project route endpoints outward so a same-side approach can finish.
  const marginPoint = v => {
    const x = v.x - obstacle.x, z = v.z - obstacle.z, d = Math.hypot(x, z);
    return d > 1e-6 && d < clearRadius + 0.02
      ? { x: obstacle.x + x / d * (clearRadius + 0.02), z: obstacle.z + z / d * (clearRadius + 0.02) } : v;
  };
  if (!obstacleSegmentBlocked(marginPoint(p), marginPoint(target), clearRadius, obstacle)) {
    ai.obstacleSide = null;
    return;
  }
  // Preserve a stationary attack/revival hold and deliberate retreat. Redirect an
  // existing approach stick at its requested strength, never add locomotor force.
  const c = Math.cos(f.heading), s = Math.sin(f.heading), speed = Math.hypot(f.move.x, f.move.y);
  const mx = f.move.x * s + f.move.y * c, mz = f.move.x * c - f.move.y * s;
  if (speed < 0.01 || mx * (target.x - p.x) + mz * (target.z - p.z) <= 0) return;
  const angle = Math.atan2(p.z - obstacle.z, p.x - obstacle.x);
  const targetAngle = Math.atan2(target.z - obstacle.z, target.x - obstacle.x);
  const delta = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
  ai.obstacleSide ??= Math.abs(delta) > 0.01 ? Math.sign(delta) : (f.index ? 1 : -1);
  const next = angle + ai.obstacleSide * 0.58, radius = clearRadius + 0.75;
  const dx = obstacle.x + Math.cos(next) * radius - p.x, dz = obstacle.z + Math.sin(next) * radius - p.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return;
  const x = dx / length, z = dz / length;
  f.move.set((x * s + z * c) * speed, (x * c - z * s) * speed);
  f.stickX = f.move.x; f.stickY = f.move.y;
}

/** Conservative camera clearance for the full-height centrepiece, including near plane. */
export function clampStageCamera(origin, camera, obstacle) {
  if (!obstacle) return camera;
  const r = obstacle.radius + 0.28;
  let ax = origin.x - obstacle.x, az = origin.z - obstacle.z;
  const ad = Math.hypot(ax, az);
  // A leaning COM can enter the conservative circle without the body entering stone.
  if (ad < r + 0.01) { const k = (r + 0.02) / Math.max(ad, 1e-6); ax = ad ? ax * k : r + 0.02; az = ad ? az * k : 0; }
  const dx = camera.x - obstacle.x - ax, dz = camera.z - obstacle.z - az;
  const aa = dx * dx + dz * dz, bb = 2 * (ax * dx + az * dz), cc = ax * ax + az * az - r * r;
  const discriminant = bb * bb - 4 * aa * cc;
  if (aa > 1e-8 && discriminant >= 0) {
    const hit = (-bb - Math.sqrt(discriminant)) / (2 * aa);
    if (hit >= 0 && hit <= 1) {
      const t = Math.max(0, hit - 0.04 / Math.sqrt(aa));
      camera.x = obstacle.x + ax + dx * t; camera.z = obstacle.z + az + dz * t;
      camera.y = origin.y + (camera.y - origin.y) * t;
    }
  }
  return camera;
}
