import * as THREE from 'three';

const FOOT_NODE = 1000;
const SHIN_NODE = 61;
const CUFF_ABOVE_ANKLE = 0.015;
const BIND_TOLERANCE = 2e-6;
const requireRig = (condition, message) => {
  if (!condition) throw new Error(`슈바르츠 발 연결: ${message}`);
};

function identityError(matrix) {
  return Math.max(...matrix.elements.map((value, i) => Math.abs(value - (i % 5 === 0 ? 1 : 0))));
}

// Repairs only the private, freshly loaded game template. The source GLB and
// separately loaded viewer keep their original rig and geometry.
export function prepareSchwarzFoot(template) {
  template.updateMatrixWorld(true);
  const nodes = new Map(), meshes = [];
  template.traverse(object => {
    if (object.isBone) {
      const id = object.userData.schwarzNode;
      requireRig(Number.isInteger(id) && !nodes.has(id), '관절 식별자가 다릅니다.');
      nodes.set(id, object);
    }
    if (object.isSkinnedMesh) meshes.push(object);
  });
  requireRig(nodes.size === 64 && [...nodes.keys()].every(id => id >= 0 && id < 64)
    && meshes.length === 1, '검증된 원본 구조가 아닙니다.');
  const shin = nodes.get(SHIN_NODE), leftFoot = nodes.get(58);
  requireRig(shin.parent === nodes.get(62) && shin.children.length === 0
    && leftFoot.parent === nodes.get(59) && nodes.get(59).parent === nodes.get(60),
  '다리 계층이 다릅니다.');
  const ankle = leftFoot.getWorldPosition(new THREE.Vector3());
  const midHipZ = (nodes.get(60).getWorldPosition(new THREE.Vector3()).z
    + nodes.get(62).getWorldPosition(new THREE.Vector3()).z) / 2;
  requireRig(ankle.z < midHipZ && ankle.y > 0.04 && ankle.y < 0.06,
    '발목 위치가 검증 범위를 벗어났습니다.');
  ankle.z = 2 * midHipZ - ankle.z;
  const cutoffY = ankle.y + CUFF_ABOVE_ANKLE;
  const footWorld = new THREE.Matrix4().makeTranslation(ankle.x, ankle.y, ankle.z);
  const footInverse = footWorld.clone().invert();
  const foot = new THREE.Bone();
  foot.name = 'schwarz_synthetic_right_foot';
  foot.userData.schwarzNode = FOOT_NODE;
  foot.matrix.copy(shin.matrixWorld).invert().multiply(footWorld);
  foot.matrix.decompose(foot.position, foot.quaternion, foot.scale);
  // The source ancestors contain tiny nonuniform scale errors. Keeping the
  // computed local matrix preserves the intended world identity rotation/scale.
  foot.matrixAutoUpdate = false;
  foot.matrixWorldNeedsUpdate = true;

  const prepared = [], oldSkeletons = new Set();
  const report = { node: FOOT_NODE, parentNode: SHIN_NODE, ankle: ankle.toArray(),
    midHipZ, cutoffY, cuffAboveAnkle: CUFF_ABOVE_ANKLE,
    method: 'replace-shin-slot', blend: false, patchedVertices: 0,
    maxWeightSumError: 0, maxOriginalBindError: 0 };
  for (const mesh of meshes) {
    const original = mesh.geometry, skeleton = mesh.skeleton;
    const position = original.attributes.position;
    const indices = original.attributes.skinIndex, weights = original.attributes.skinWeight;
    requireRig(position?.count === 11332 && original.index?.count === 23508
      && indices?.itemSize === 4 && weights?.itemSize === 4
      && indices.count === position.count && weights.count === position.count
      && !indices.normalized && skeleton.bones.length === 64 && skeleton.boneInverses.length === 64,
    '스킨 구조가 다릅니다.');
    requireRig(new Set(skeleton.bones).size === nodes.size
      && skeleton.bones.every(bone => nodes.get(bone.userData.schwarzNode) === bone),
    '스킨 관절 목록이 다릅니다.');
    requireRig(identityError(mesh.bindMatrix) < BIND_TOLERANCE,
      '바인드 좌표계가 다릅니다.');
    const originalShin = skeleton.bones.indexOf(shin);
    for (let b = 0; b < skeleton.bones.length; b++) {
      const error = identityError(skeleton.bones[b].matrixWorld.clone().multiply(skeleton.boneInverses[b]));
      requireRig(Number.isFinite(error) && error < BIND_TOLERANCE, '원본 바인드 자세가 다릅니다.');
      report.maxOriginalBindError = Math.max(report.maxOriginalBindError, error);
    }
    // Every affected source vertex already uses four distinct influences.
    // A gradual split would require a fifth or discard unrelated weights.
    // Replace only the shin slot below the boot cuff; weights remain bitwise
    // identical. The cutoff is the midpoint of the desired 3 cm ankle band.
    const geometry = original.clone(), skinIndex = geometry.attributes.skinIndex;
    for (let vertex = 0; vertex < position.count; vertex++) {
      let sum = 0;
      for (let channel = 0; channel < 4; channel++) {
        const index = indices.getComponent(vertex, channel);
        const weight = weights.getComponent(vertex, channel);
        requireRig(Number.isInteger(index) && index >= 0 && index < skeleton.bones.length
          && Number.isFinite(weight) && weight >= 0 && weight <= 1, '잘못된 스킨 가중치입니다.');
        sum += weight;
      }
      const sumError = Math.abs(1 - sum);
      requireRig(sumError < 1e-6, '가중치 합이 다릅니다.');
      report.maxWeightSumError = Math.max(report.maxWeightSumError, sumError);
      const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
      requireRig([x, y, z].every(Number.isFinite), '잘못된 정점 위치입니다.');
      if (z <= midHipZ || y > cutoffY) continue;
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        if (indices.getComponent(vertex, channel) !== originalShin
          || weights.getComponent(vertex, channel) === 0) continue;
        skinIndex.setComponent(vertex, channel, skeleton.bones.length);
        changed = true;
      }
      if (changed) report.patchedVertices++;
    }
    skinIndex.needsUpdate = true;
    const expanded = new THREE.Skeleton([...skeleton.bones, foot],
      [...skeleton.boneInverses.map(inverse => inverse.clone()), footInverse.clone()]);
    requireRig(expanded.boneMatrices.length === 65 * 16, '관절 행렬 확장에 실패했습니다.');
    prepared.push({ mesh, geometry, skeleton: expanded });
    oldSkeletons.add(skeleton);
  }
  requireRig(report.patchedVertices > 0 && report.patchedVertices < 1000,
    '교정 정점 범위가 다릅니다.');
  // Commit only after all original topology and cloned geometry checks pass.
  shin.add(foot);
  foot.updateWorldMatrix(true, false);
  const syntheticBindError = identityError(foot.matrixWorld.clone().multiply(footInverse));
  if (!Number.isFinite(syntheticBindError) || syntheticBindError >= BIND_TOLERANCE) {
    shin.remove(foot);
    throw new Error('슈바르츠 발 연결: 새 발목 바인드 자세가 다릅니다.');
  }
  for (const { mesh, geometry, skeleton } of prepared) {
    mesh.geometry = geometry;
    mesh.skeleton = skeleton;
    skeleton.update();
  }
  // GLTFLoader normally has no texture yet; retain any allocated one until all
  // replacements are validated and installed.
  for (const skeleton of oldSkeletons) skeleton.dispose();
  report.maxSyntheticBindError = syntheticBindError;
  template.userData.schwarzFootPatch = report;
  return report;
}
