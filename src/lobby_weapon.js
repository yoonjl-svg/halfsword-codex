import * as THREE from 'three';
import { getWeapon, weaponMatOpts } from './weapons.js';
import { LOOKS } from './looks.js';

// 무기 섬네일과 실제 Fighter가 사용하는 동일한 buildParts → partMesh → decorate.
// 로비가 소유한 겉모습만 만들며 물리 세계나 게임 무기는 바꾸지 않는다.
export function buildLobbyWeapon(id) {
  const spec = getWeapon(id), group = new THREE.Group(), finish = spec.finishTier ?? spec.tier;
  spec.buildParts(LOOKS.player).forEach(([shape, y, , color, isBlade, pose], i) => {
    const opts = weaponMatOpts(spec.material, isBlade, finish);
    let part = spec.partMesh?.(i, isBlade, shape, color ?? 0x888888, opts, LOOKS.player, finish);
    if (!part) {
      const geometry = shape[0] === 'box' ? new THREE.BoxGeometry(shape[1]*2, shape[2]*2, shape[3]*2)
        : shape[0] === 'ball' ? new THREE.SphereGeometry(shape[1], 16, 12) : new THREE.CapsuleGeometry(shape[2], shape[1]*2, 4, 10);
      part = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: color ?? 0x888888, roughness: .75, metalness: .05, ...opts }));
    }
    part.position.set(pose?.x ?? 0, y, 0);
    if (pose?.rotZ) part.rotation.z = pose.rotZ;
    part.visible = color != null; group.add(part);
  });
  spec.decorate?.(group, LOOKS.player);
  group.name = `lobby-weapon-${id}`;
  return group;
}

export function disposeLobbyWeapon(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(part => {
    if (part.geometry) geometries.add(part.geometry);
    for (const mat of [part.material].flat()) if (mat) materials.add(mat);
  });
  for (const geo of geometries) geo.dispose();
  for (const mat of materials) mat.dispose(); // 환경 텍스처는 게임과 공유하므로 해제하지 않는다.
  group.removeFromParent();
}
