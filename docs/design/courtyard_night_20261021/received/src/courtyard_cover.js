// 봉인의 중정 실제 사선 (샛별 저장소 연구 courtyard_cover_study_20261019 — 사장님 10/20 00:4x '샛별이 제안한 마야 ai 변화 3종 적용해'):
//  총구에서 상대 골반 · 배 · 가슴(가운데 · 좌우 0.14 m) · 머리 6 점으로 광선을 쏴, 모두 급수정에 가리면 '사선이 막힘'. 쏘기 · 쿨타임 · 명중 · 위력은 그대로.
import * as THREE from 'three';
export const COVER_SIGHT = { on: true, handles: new WeakMap() }; // world → 급수정 충돌체 handle 모음 (configureStageObstacle 이 채움)
const _q = new THREE.Quaternion();
export function coverSight(shooter, target) {
  const q = shooter.sword.rotation(), p = shooter.sword.translation();
  const origin = new THREE.Vector3(shooter.weapon.muzzleX ?? 0, shooter.weaponCfg.hiltLength + shooter.weaponCfg.bladeLength, 0)
    .applyQuaternion(_q.set(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
  const handles = COVER_SIGHT.handles.get(shooter.world);
  const samples = [];
  for (const name of ['pelvis', 'abdomen', 'chest', 'head']) {
    if (name === 'head' && target.decapitated) continue;
    const b = target.bodies[name];
    if (!b) continue;
    const bp = b.translation(), r = b.rotation();
    for (const side of name === 'chest' ? [-0.14, 0, 0.14] : [0]) {
      const point = new THREE.Vector3(0, 0, side).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(bp.x, bp.y, bp.z));
      const dir = point.clone().sub(origin), length = dir.length();
      dir.multiplyScalar(1 / Math.max(length, 1e-9));
      const hit = handles && shooter.world.castRay({ origin, dir }, Math.max(0, length - 0.01), true, undefined, undefined, undefined, undefined, (c) => handles.has(c.handle));
      samples.push(!!hit);
    }
  }
  return { blocked: samples.length > 0 && samples.every(Boolean) };
}
