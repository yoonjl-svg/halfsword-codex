// Actual native fighter, decal projection, limb separation and resource cleanup.
// node tools/sim/experiments/ratna_appearance_gate.mjs /tmp/halfsword-ratna-v3-20261013/appearance-native.json
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, THREE } from '../harness_m.mjs';
import { getLook } from '../../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { rebuildDecal } from '../../../src/effects.js';
import { disposeVisualTrees } from '../../../src/visual_resources.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = path.resolve(process.argv[2] || '/tmp/halfsword-ratna-v3-20261013/appearance-native.json');
assert(out.startsWith('/tmp/'), 'Keep generated evidence outside the checkout, under /tmp');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
  'src/looks.js', 'src/outfits.js', 'src/outfit_ratna.js', 'src/characters.js', 'src/characters_expansion.js',
  'src/fighter.js', 'src/limb_sever.js', 'src/effects.js', 'src/visual_resources.js',
  'src/config.js', 'src/ai.js', 'src/combat.js', 'tools/sim/harness_m.mjs',
  'tools/sim/experiments/ratna_appearance_gate.mjs', 'package-lock.json',
];
const result = {
  pass: false, completedAt: null,
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceSha256: Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
  options: { seed: 73, weapon: 'longsword', weapon2: 'rapier', walls: false, gap: 12 },
  look: { id: 'ratna', version: 'v3', outfit: 'ratna_ferryman', voice: 'tome' },
  input: 'Native newRound, nine mild cuts, native decal projection/reprojection, two joint cuts and 90 simulation steps.',
  checks: [],
  limits: [
    'Physics comparison covers the initial world snapshot with and without the outfit.',
    'Synthetic cuts and separation test appearance retention, not combat frequency or balance.',
    'Decal projection runs without canvas textures; browser evidence assesses visible wound quality.',
    'Rigid clothes, decorative paddle, monkey and shoes have no additional collision or animal AI.',
    'Wetland movement exemption is character metadata here; terrain behavior is tested by its separate gate.',
    'Head-clearance probes use native face radius and neck anchors; hair overlap and extreme combined head poses remain visual limitations.',
  ],
};
const check = (name, value) => { assert(value, name); result.checks.push(name); };
const rootsOf = g => [...g.player.meshes, ...g.enemy.meshes].map(({ group }) => group);
function dispose(g) {
  if (!g.visualsDisposed) {
    g.player.clearLoose(); g.enemy.clearLoose();
    const roots = rootsOf(g); roots.forEach(group => group.removeFromParent());
    disposeVisualTrees(roots); g.visualsDisposed = true;
  }
  g.eventQueue.free(); g.world.free();
}
let dressed, neutral, archived, archivedV2, restarted;
try {
  const look = getLook('ratna'), character = CHARACTERS_BY_ID.ratna;
  check('Registered adult wetland guide uses the existing rapier and rapier school',
    character?.age === 52 && character.weapon === 'rapier' && character.voice === 'tome'
    && character.ai.persona.school === 'rapier' && character.ai.persona.idle.guard === 'pflugR'
    && character.look === look && character.lookVersion === 'v3' && look.outfit === result.look.outfit
    && character.name === '라트나 위라세타쿤' && character.epithet === '습지 안내인'
    && character.terrainTraits?.wetlandImmunity === true);
  result.options.persona = character.ai.persona;
  dressed = newRound({ ...result.options, look2: look });
  neutral = newRound({ ...result.options, look2: { ...look, outfit: null } });
  check('Native fighter equips the registered rapier', dressed.enemy.weapon.id === 'rapier');
  result.snapshotSha256 = { dressed: sha(dressed.world.takeSnapshot()), neutral: sha(neutral.world.takeSnapshot()) };
  check('Native world snapshot identical', result.snapshotSha256.dressed === result.snapshotSha256.neutral);
  archived = newRound({ ...result.options, look2: getLook('ratna', 'v1') });
  check('Archived v1 remains available with original trousers and sandals', getLook('ratna', 'v1').hoseUpper === 0x264e4d
    && !getLook('ratna', 'v1').ratnaRevision
    && !archived.enemy.groups.chest.getObjectByName('ratna-monkey')
    && !archived.enemy.groups.footF.getObjectByName('ratna-reed-shoe')
    && sha(archived.world.takeSnapshot()) === result.snapshotSha256.dressed);
  archivedV2 = newRound({ ...result.options, look2: getLook('ratna', 'v2') });
  check('Archived v2 preserves its fine curls and outer monkey placement', getLook('ratna', 'v2').ratnaRevision === 2
    && !archivedV2.enemy.groups.head.getObjectByName('ratna-curls')
    && archivedV2.enemy.groups.chest.getObjectByName('ratna-monkey')?.position.z === 0
    && sha(archivedV2.world.takeSnapshot()) === result.snapshotSha256.dressed);
  for (let i = 0; i < 4; i++) {
    const a = dressed.enemy.groups.head.children[i], b = neutral.enemy.groups.head.children[i];
    assert.deepEqual(a.geometry.attributes.position.array, b.geometry.attributes.position.array);
    assert.deepEqual(a.position.toArray(), b.position.toArray());
    assert.deepEqual(a.scale.toArray(), b.scale.toArray());
    assert.deepEqual(a.quaternion.toArray(), b.quaternion.toArray());
  }
  check('Stock male head, nose and eyes preserved', true);
  for (const part of ['uarmS', 'uarmO', 'thighF', 'thighB']) {
    assert.deepEqual(dressed.enemy.partMesh[part].geometry.parameters, neutral.enemy.partMesh[part].geometry.parameters);
  }
  check('Native capsule metadata preserved for off-center wound projection', true);
  check('Original torso width and no armor bonus', dressed.enemy.groups.chest.scale.z === 1
    && dressed.enemy.groups.abdomen.scale.z === 1 && !dressed.enemy.hasHelmet
    && Object.keys(dressed.enemy.plate).length === 0);

  const layers = [], reps = Object.entries(dressed.enemy.partMesh).map(([part, mesh]) => ({ part, mesh, geometry: mesh.geometry }));
  for (const [part, group] of Object.entries(dressed.enemy.groups)) group.traverse(node => {
    if (node.name.startsWith('ratna-')) layers.push({ node, parent: node.parent, part });
  });
  result.layers = layers.length;
  check('Costume layers belong to individual wound representatives', layers.length >= 15
    && layers.every(({ parent, part }) => parent === dressed.enemy.partMesh[part]));
  check('Paddle, chart and sounding weight remain on their own body part',
    layers.some(({ node, part }) => node.name === 'ratna-paddle' && part === 'chest')
    && layers.some(({ node, part }) => node.name === 'ratna-map' && part === 'pelvis')
    && layers.some(({ node, part }) => node.name === 'ratna-sounding-weight' && part === 'pelvis'));
  const monkey = layers.find(({ node }) => node.name === 'ratna-monkey');
  const monkeyBounds = new THREE.Box3();
  monkey?.node.traverse(mesh => {
    if (mesh.isMesh) { mesh.geometry.computeBoundingBox(); monkeyBounds.union(mesh.geometry.boundingBox); }
  });
  if (monkey) { monkey.node.updateMatrix(); monkeyBounds.applyMatrix4(monkey.node.matrix); }
  result.monkeyBounds = { min: monkeyBounds.min.toArray(), max: monkeyBounds.max.toArray() };
  check('Complete monkey belongs to the left shoulder chest and clears face and weapon side',
    monkey?.part === 'chest' && monkey.parent === dressed.enemy.partMesh.chest
    && monkeyBounds.max.z < -0.12 && monkeyBounds.min.y > -0.025
    && monkeyBounds.max.y < 0.36 && monkeyBounds.max.x < 0.1);
  check('Whole monkey moved three centimeters inward on the left shoulder',
    Math.abs(monkey.node.position.z - archivedV2.enemy.groups.chest.getObjectByName('ratna-monkey').position.z - 0.03) < 1e-9);
  const monkeyPoints = [];
  monkey.node.traverse(mesh => {
    if (!mesh.isMesh) return;
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) monkeyPoints.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(monkey.node.matrix));
  });
  const chestBody = dressed.enemy.bodies.chest, headBody = dressed.enemy.bodies.head;
  const chestInverse = new THREE.Quaternion().copy(chestBody.rotation()).invert();
  const headCenter = new THREE.Vector3().copy(headBody.translation()).sub(new THREE.Vector3().copy(chestBody.translation())).applyQuaternion(chestInverse);
  const neck = new THREE.Vector3().copy(dressed.enemy.jointByName.head.joint.anchor1());
  const headRadius = dressed.enemy.partMesh.head.geometry.parameters.radius;
  const gapAt = (x, y, z) => {
    const center = headCenter.clone().sub(neck).applyEuler(new THREE.Euler(x, y, z)).add(neck);
    return Math.min(...monkeyPoints.map(p => p.distanceTo(center))) - headRadius;
  };
  const gaps = (xs, ys, zs) => xs.flatMap(x => ys.flatMap(y => zs.map(z => gapAt(x, y, z))));
  result.monkeyHeadClearanceM = { neutral: gapAt(0, 0, 0),
    smallPoseMin: Math.min(...gaps([-0.2, 0, 0.2], [-0.45, 0, 0.45], [-0.2, 0, 0.2])),
    jointLimitPoseMin: Math.min(...gaps([-0.5, 0, 0.5], [-1, 0, 1], [-0.7, 0, 0.5])) };
  check('Monkey clears the native face in neutral and small head rotations',
    result.monkeyHeadClearanceM.neutral > 0.02 && result.monkeyHeadClearanceM.smallPoseMin > 0);
  if (result.monkeyHeadClearanceM.jointLimitPoseMin < 0) result.limits.push(
    'Combined extreme neck-limit poses can overlap the decorative monkey; no new collision or head restriction is introduced.');
  const curls = dressed.enemy.groups.head.getObjectByName('ratna-curls'), curlBounds = new THREE.Box3();
  curls?.traverse(mesh => {
    if (mesh.isMesh) { mesh.geometry.computeBoundingBox(); curlBounds.union(mesh.geometry.boundingBox); }
  });
  result.curlBounds = { min: curlBounds.min.toArray(), max: curlBounds.max.toArray() };
  check('Raised spiral curls stay compact around the original head', curls?.parent === dressed.enemy.partMesh.head
    && curlBounds.max.y > 0.12 && curlBounds.max.y < 0.145 && curlBounds.min.y > -0.075
    && Math.max(Math.abs(curlBounds.min.z), Math.abs(curlBounds.max.z)) < 0.14);
  check('Warm ochre trousers and broad reed shoes use native body parts',
    dressed.enemy.partMesh.thighF.material.color.getHex() === 0xc29b45
    && ['footF', 'footB'].every(part => {
      const shoe = dressed.enemy.groups[part].getObjectByName('ratna-reed-shoe');
      if (!shoe || shoe.parent !== dressed.enemy.partMesh[part]) return false;
      shoe.children[0].geometry.computeBoundingBox();
      const size = shoe.children[0].geometry.boundingBox.getSize(new THREE.Vector3());
      return size.x > 0.29 && size.z > 0.15 && size.y < 0.025;
    }));

  result.woundedParts = ['head', 'chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'thighF', 'shinF'];
  const decals = [];
  for (const part of result.woundedParts) {
    dressed.enemy.applyWound({ part, zone: part === 'head' ? 'head' : part.includes('arm') ? 'arm' : part.startsWith('thigh') || part.startsWith('shin') ? 'leg' : part,
      type: 'cut', severity: 0.025, energy: 2, bleedPerSev: 0.005,
      local: new THREE.Vector3(0.1, 0, 0), dir: new THREE.Vector3(1, 0, 0),
      pass: true, passing: false, plate: false });
    const mesh = dressed.enemy.partMesh[part];
    // Use the native projector on the actual wound surface, without a DOM
    // canvas. Texturing/visible overlap remains a separate browser check.
    const decal = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    decal.userData = { mesh, p: new THREE.Vector3(0.1, 0, 0), rot: new THREE.Euler(0, Math.PI / 2, 0) };
    rebuildDecal(decal, 0.04, 0.08); mesh.add(decal);
    assert(decal.geometry.attributes.position.count > 0, `${part}: projected cut must contain triangles`);
    rebuildDecal(decal, 0.06, 0.1);
    assert(decal.geometry.attributes.position.count > 0, `${part}: expanding wound must remain projectable`);
    if (part.startsWith('uarm')) {
      const target = mesh.clone(false); target.position.set(0, 0, 0); target.quaternion.identity();
      target.updateMatrixWorld(true);
      const hits = new THREE.Raycaster(new THREE.Vector3(0.2, 0, 0), new THREE.Vector3(-1, 0, 0)).intersectObject(target, false);
      assert(hits.length > 0 && hits[0].face.materialIndex === 1, `${part}: visible sleeve belongs to native wound target`);
      const dp = decal.geometry.attributes.position;
      let outside = -Infinity;
      for (let i = 0; i < dp.count; i++) outside = Math.max(outside, dp.getX(i));
      assert(outside >= hits[0].point.x - 0.0001, `${part}: cut projects onto outer sleeve surface`);
    }
    decals.push(decal);
  }
  check('Nine native wound surfaces accept cuts and expanding decals', dressed.enemy.wounds.length === 9 && decals.length === 9);
  check('Upper-arm cuts project onto the visible cream sleeves', true);
  for (const part of ['farmO', 'shinF']) {
    const local = new THREE.Vector3().copy(dressed.enemy.jointByName[part].joint.anchor2());
    dressed.enemy.applyWound({ part, zone: part === 'farmO' ? 'arm' : 'leg',
      type: 'cut', severity: 1.25, energy: 90, bleedPerSev: 0.005, local,
      dir: new THREE.Vector3(1, 0, 0), pass: true, passing: true, plate: false });
  }
  result.detachedParts = [...(dressed.enemy.detachedParts || [])];
  check('Native forearm and lower leg separation succeeds', ['farmO', 'shinF', 'footF'].every(part => dressed.enemy.detachedParts?.has(part)));
  for (let i = 0; i < 90; i++) { dressed.step(); dressed.enemy.syncMeshes(); }
  result.stepsAfterWounds = 90; result.wounds = dressed.enemy.wounds.length;
  check('Wounds and detached limbs retain costume and representative identities',
    layers.every(({ node, parent }) => node.parent === parent && node.visible)
    && reps.every(({ part, mesh, geometry }) => dressed.enemy.partMesh[part] === mesh && mesh.geometry === geometry)
    && decals.every(decal => decal.parent === decal.userData.mesh));
  check('Separated sandal and cuff follow their detached rigid bodies', ['shinF', 'footF'].every(part => {
    const p = dressed.enemy.bodies[part].translation();
    return dressed.enemy.groups[part].position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) < 1e-9;
  }));

  result.meshes = 0; result.triangles = 0; result.costumeTriangles = 0;
  for (const { group } of dressed.enemy.meshes) group.traverse(node => {
    if (!node.isMesh) return;
    assert(node.geometry.attributes.position.array.every(Number.isFinite));
    result.meshes++;
    result.triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  layers.forEach(({ node }) => node.traverse(mesh => {
    if (mesh.isMesh) result.costumeTriangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
  }));
  for (const part of ['uarmS', 'uarmO']) {
    result.costumeTriangles += dressed.enemy.partMesh[part].geometry.groups
      .filter(group => group.materialIndex === 1).reduce((sum, group) => sum + group.count / 3, 0);
  }
  check('All Ratna geometry finite after cuts and separation', true);
  // Budget applies to costume only, independently of the native weapon mesh.
  check('Compact procedural costume remains below 18000 triangles', result.costumeTriangles < 18000);

  const resources = new Map();
  for (const { group } of dressed.enemy.meshes) group.traverse(node => {
    for (const resource of [node.geometry, ...[node.material].flat()].filter(Boolean)) if (!resources.has(resource)) {
      resources.set(resource, 0);
      resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
    }
  });
  const roots = rootsOf(dressed); roots.forEach(group => group.removeFromParent());
  disposeVisualTrees(roots); dressed.visualsDisposed = true;
  result.disposedResources = resources.size;
  check('Round cleanup disposes each geometry and material once', resources.size > 0
    && [...resources.values()].every(count => count === 1) && roots.every(group => group.parent === null));
  restarted = newRound({ ...result.options, look2: look });
  const freshMonkey = restarted.enemy.groups.chest.getObjectByName('ratna-monkey');
  check('Restart creates one fresh monkey and clean injury state', freshMonkey && freshMonkey !== monkey.node
    && freshMonkey.children.every((mesh, i) => mesh.geometry !== monkey.node.children[i]?.geometry)
    && restarted.enemy.wounds.length === 0 && !restarted.enemy.detachedParts?.size
    && sha(restarted.world.takeSnapshot()) === result.snapshotSha256.dressed);
  result.pass = true;
} catch (error) {
  result.failure = error.stack || String(error); process.exitCode = 1;
} finally {
  if (neutral) dispose(neutral);
  if (archived) dispose(archived);
  if (archivedV2) dispose(archivedV2);
  if (restarted) dispose(restarted);
  if (dressed) dispose(dressed);
  result.completedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: result.pass, checks: result.checks.length,
  layers: result.layers, wounds: result.wounds, detachedParts: result.detachedParts,
  meshes: result.meshes, triangles: result.triangles, costumeTriangles: result.costumeTriangles,
  disposedResources: result.disposedResources, out,
  ...(result.failure ? { failure: result.failure } : {}),
}));
