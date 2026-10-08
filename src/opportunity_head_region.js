// Interior aim points in the observed native head sphere, plus the existing
// neck point. This selects a command target; it never enlarges a collider.
import * as THREE from 'three';

const finite = p => p && [p.x, p.y, p.z].every(Number.isFinite);
const vec = p => new THREE.Vector3(p.x, p.y, p.z);

export function thrustRegionCandidates(snapshot, origin, axis) {
  const radius = snapshot?.headRadius;
  if (!finite(snapshot?.head) || !finite(origin) || !finite(axis) ||
      !Number.isFinite(radius) || radius <= 0 || axis.lengthSq() < 0.5) return [];
  const center = vec(snapshot.head), from = vec(origin), dir = axis.clone().normalize();
  const q = snapshot.headQ;
  const rotation = q && [q.x, q.y, q.z, q.w].every(Number.isFinite)
    ? new THREE.Quaternion(q.x, q.y, q.z, q.w) : new THREE.Quaternion();
  // Leave an interior margin so the preferred line is not a tangent scrape.
  // 65% is an authored aiming margin, not an anatomical damage threshold.
  const inset = radius * 0.65;
  const projected = from.clone().addScaledVector(dir, Math.max(0, center.clone().sub(from).dot(dir)));
  const offset = projected.sub(center);
  // Minimum rotation alone favors the crown/edge when the weapon is high.
  // Prefer the neck or a deep head line; peripheral samples are fallbacks
  // when those are obstructed. Preserve an already central weapon line.
  const points = [
    ['head', center.clone(), 0],
    // Lower face and rear/side head remain available; these are aim samples,
    // not a claim that any particular surface is bare or penetrable.
    ...[[0.45, -0.35, 0], [-0.45, -0.35, 0], [0, -0.35, 0.45], [0, -0.35, -0.45]]
      .map(a => ['head', center.clone().add(new THREE.Vector3(...a).multiplyScalar(radius).applyQuaternion(rotation)), 0]),
    ...[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
      .map(a => ['head', center.clone().addScaledVector(new THREE.Vector3(...a), inset), 1]),
  ];
  if (offset.length() <= radius * 0.35) points.unshift(['head', center.clone().add(offset), 0]);
  if (finite(snapshot.neck)) points.push(['neck', vec(snapshot.neck), 0]);
  // The head collider is spherical: these world-space samples do not depend
  // on a face orientation. Collision and armor still decide the actual hit.
  return points.map(([zone, point, fallback]) => {
    const ray = point.clone().sub(from);
    if (ray.lengthSq() <= 1e-12) return { alignment: -Infinity };
    ray.normalize();
    // Prefer a visibly uncovered approach. Use only the captured helmet and
    // head pose, not damage prediction or the live victim. This straight ray
    // estimate can differ from the later physical contact and armor verdict.
    const toCenter = center.clone().sub(from), along = toCenter.dot(ray);
    const discriminant = along * along - (toCenter.lengthSq() - radius * radius);
    const entry = discriminant >= 0 ? along - Math.sqrt(discriminant) : -1;
    const covered = snapshot.hasHelmet && entry >= 0 &&
      from.clone().addScaledVector(ray, entry).sub(center).applyQuaternion(rotation.clone().invert()).y > -0.01;
    return { zone, point, fallback, covered: !!covered, alignment: ray.dot(dir) };
  }).filter(p => Number.isFinite(p.alignment)).sort((a, b) => Number(a.covered) - Number(b.covered) ||
    a.fallback - b.fallback || b.alignment - a.alignment);
}
