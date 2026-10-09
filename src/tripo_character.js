// Optional appearance only. Native bodies, colliders, armor and damage remain
// authoritative. The fixed asset's bind map is audited separately from its names.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { retainVisualResources } from './visual_resources.js';
import { SCHWARZ_RIG } from './tripo_character_rig.js';
import { prepareSchwarzFoot } from './tripo_foot_patch.js';

const V = (a) => new THREE.Vector3(...a);
let visualSeed = 0x53434857;
function visualOnly(build) {
  const random = Math.random;
  Math.random = () => ((visualSeed = (Math.imul(visualSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
  try { return build(); } finally { Math.random = random; }
}

// Called before the first Fighter/AI is created, only for the explicit sample.
export async function loadSchwarzAppearance() {
  const assetURL = new URL('./models/tripo/schwarz-anime.glb', document.baseURI).href;
  const loading = document.createElement('p');
  loading.id = 'characterModelLoading'; loading.setAttribute('role', 'status');
  loading.textContent = '슈바르츠 외형을 불러오는 중…';
  document.getElementById('menuSub')?.after(loading);
  try {
    const response = await fetch(assetURL, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`모델 응답 ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== SCHWARZ_RIG.bytes) throw new Error('모델 크기가 검증본과 다릅니다.');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== SCHWARZ_RIG.sha256) throw new Error('모델이 검증본과 다릅니다.');
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    gltf.scene.traverse(object => {
      const node = gltf.parser.associations.get(object)?.nodes;
      if (node !== undefined) object.userData.schwarzNode = node;
    });
    return prepareSchwarzAppearance(gltf.scene, assetURL);
  } finally { loading.remove(); }
}

export function prepareSchwarzAppearance(template, assetURL) {
  const footRepair = visualOnly(() => prepareSchwarzFoot(template));
  template.updateMatrixWorld(true);
  const templateNodes = new Map();
  template.traverse(object => {
    if (object.isBone) templateNodes.set(object.userData.schwarzNode, object);
  });
  const rest = new Map([...templateNodes].map(([id, bone]) => [id, {
    position: bone.getWorldPosition(new THREE.Vector3()),
    rotation: bone.getWorldQuaternion(new THREE.Quaternion()),
  }]));
  const definitions = SCHWARZ_RIG.regions.map(region => {
    for (const id of region.nodes) if (!rest.has(id)) throw new Error(`검증되지 않은 관절 ${id}`);
    const anchor = rest.get(region.anchor).position;
    const alignment = new THREE.Quaternion();
    if (region.end !== undefined) alignment.setFromUnitVectors(
      rest.get(region.end).position.clone().sub(anchor).normalize(), V(region.axis));
    return { ...region, alignment, anchor, offset: V(region.offset), scale: region.scale ?? SCHWARZ_RIG.scale };
  });
  if (new Set(definitions.flatMap(r => r.nodes)).size !== templateNodes.size) throw new Error('일부 관절의 연결이 빠졌습니다.');
  const meshes = [];
  // This dedicated template owns its cropped geometry. The downloaded GLB and
  // the separate full-model viewer retain the original open hands unchanged.
  template.traverse(object => {
    if (!object.isSkinnedMesh) return;
    object.frustumCulled = false; object.castShadow = true; object.receiveShadow = true;
    object.geometry = object.geometry.clone();
    const sourceIndex = object.geometry.index;
    if (!sourceIndex) throw new Error('검증되지 않은 비인덱스 모델');
    const keep = [];
    const position = object.geometry.attributes.position;
    const handPlanes = SCHWARZ_RIG.hands.map(([elbow, wrist, body]) => ({
      point: rest.get(wrist).position,
      normal: rest.get(wrist).position.clone().sub(rest.get(elbow).position).normalize(),
      nodes: new Set(definitions.find(region => region.body === body).nodes),
    }));
    const skinIndex = object.geometry.attributes.skinIndex, skinWeight = object.geometry.attributes.skinWeight;
    const vertex = new THREE.Vector3();
    // GLTF skin rest matrices (boneWorld * inverseBind) are identity, so these
    // positions use the bind-space world coordinates, not Armature translation.
    const beyondWrist = i => handPlanes.some(plane => {
      let armWeight = 0;
      for (let c = 0; c < 4; c++) {
        const node = object.skeleton.bones[skinIndex.getComponent(i, c)]?.userData.schwarzNode;
        if (plane.nodes.has(node)) armWeight += skinWeight.getComponent(i, c);
      }
      return armWeight > 0.5 && vertex.fromBufferAttribute(position, i).sub(plane.point).dot(plane.normal) > -0.001;
    });
    for (let i = 0; i < sourceIndex.count; i += 3) {
      const a = sourceIndex.getX(i), b = sourceIndex.getX(i + 1), c = sourceIndex.getX(i + 2);
      if (![a, b, c].some(beyondWrist)) keep.push(a, b, c);
    }
    object.geometry.setIndex(keep);
    retainVisualResources(object.geometry);
    meshes.push(object);
  });
  if (meshes.length !== SCHWARZ_RIG.skinnedMeshes) throw new Error('메시 수가 검증본과 다릅니다.');
  let current = null, disposals = 0;
  const session = {
    attach(fighter) {
      current = visualOnly(() => attachSkin(fighter, template, definitions, rest, () => disposals++));
      return current;
    },
    onWound(fighter) { if (current?.fighter === fighter) current.fallback('피격·갑옷 손상'); },
    snapshot() {
      return { requested: true, model: 'tripo', status: current?.status ?? 'ready', error: null,
        assetURL, loads: 1, disposals, footRepair, controllers: current ? [current.snapshot()] : [] };
    },
  };
  return session;
}

function attachSkin(fighter, template, definitions, rest, onDispose) {
  const root = cloneSkeleton(template);
  root.name = 'schwarz-tripo-appearance';
  root.userData.characterAppearance = 'schwarz-tripo';
  fighter.scene.add(root);
  const nodes = new Map(), skeletons = new Set(); let skinnedMeshCount = 0;
  root.traverse(object => {
    if (object.isBone) nodes.set(object.userData.schwarzNode, object);
    if (object.isSkinnedMesh) {
      skinnedMeshCount++; skeletons.add(object.skeleton);
      object.frustumCulled = false;
      object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
    }
  });
  const bindings = definitions.flatMap(region => region.nodes.map(id => ({
    id, body: fighter.bodies[region.body], bone: nodes.get(id),
    position: rest.get(id).position.clone().sub(region.anchor).applyQuaternion(region.alignment).multiplyScalar(region.scale).add(region.offset),
    rotation: region.alignment.clone().multiply(rest.get(id).rotation),
    scale: new THREE.Vector3(region.scale, region.scale, region.scale),
    world: new THREE.Matrix4(),
  })));
  const bindingOf = new Map(bindings.map(binding => [binding.bone, binding]));
  // Parent matrices are solved first; never overwrite physical body transforms.
  const order = [];
  root.traverse(object => { const binding = bindingOf.get(object); if (binding) order.push(binding); });
  const masked = [];
  for (const group of Object.values(fighter.groups)) group.traverse(object => {
    if (!object.isMesh && !object.isLine && !object.isSprite) return;
    for (let ancestor = object; ancestor && ancestor !== group; ancestor = ancestor.parent)
      if (ancestor.name === 'mitten-right' || ancestor.name === 'mitten-left') return;
    masked.push([object, object.layers.mask]);
    object.layers.set(31); // camera layer 0; keep native .visible armor semantics.
  });
  const initial = { helmet: fighter.hasHelmet, helmetIntegrity: fighter.helmetIntegrity,
    plate: { ...fighter.plate }, wounds: fighter.wounds.length };
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const bodyQ = new THREE.Quaternion(), parentInverse = new THREE.Matrix4();
  let status = 'ready', fallbackReason = null, updateCount = 0, disposed = false;
  const controller = {
    fighter,
    get status() { return status; },
    fallback(reason) {
      if (disposed || status !== 'ready') return;
      status = 'fallback'; fallbackReason = reason; root.visible = false;
      for (const [object, mask] of masked) object.layers.mask = mask;
      const info = globalThis.document?.getElementById('characterModelInfo');
      if (info) info.textContent = '슈바르츠 외형 시험 · 피격 후에는 상처·파손을 보여 주는 기존 외형으로 돌아갑니다.';
    },
    update() {
      if (disposed || status !== 'ready') return;
      if (fighter.decapitated || fighter.detachedParts?.size || fighter.wounds.length !== initial.wounds
        || fighter.hasHelmet !== initial.helmet || fighter.helmetIntegrity < initial.helmetIntegrity
        || Object.entries(initial.plate).some(([part, value]) => fighter.plate[part] < value)
        || Object.values(fighter.cloth).some(value => value < 1)) {
        controller.fallback('신체·장비 손상'); return;
      }
      root.updateMatrixWorld(true);
      for (const binding of bindings) {
        bodyQ.copy(binding.body.rotation());
        position.copy(binding.position).applyQuaternion(bodyQ).add(binding.body.translation());
        rotation.copy(bodyQ).multiply(binding.rotation);
        binding.world.compose(position, rotation, binding.scale);
      }
      for (const binding of order) {
        const parent = bindingOf.get(binding.bone.parent)?.world ?? binding.bone.parent.matrixWorld;
        parentInverse.copy(parent).invert();
        binding.bone.matrix.multiplyMatrices(parentInverse, binding.world);
        binding.bone.matrix.decompose(binding.bone.position, binding.bone.quaternion, binding.bone.scale);
        binding.bone.matrixWorld.copy(binding.world);
      }
      root.updateMatrixWorld(true);
      for (const skeleton of skeletons) skeleton.update();
      updateCount++;
    },
    snapshot() { return { role: 'enemy', status, fallbackReason, rootUUID: root.uuid,
      skinnedMeshCount, boneCount: nodes.size, updateCount, disposed }; },
    dispose() {
      if (disposed) return;
      for (const [object, mask] of masked) object.layers.mask = mask;
      for (const skeleton of skeletons) skeleton.dispose();
      disposed = true; onDispose();
      // Geometry is retained in the session template. main's round cleanup owns
      // these cloned materials and removes this root with the native roots.
    },
  };
  return controller;
}
