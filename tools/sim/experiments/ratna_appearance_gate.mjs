// Actual native fighter, decal projection, limb separation and resource cleanup.
// node tools/sim/experiments/ratna_appearance_gate.mjs /tmp/halfsword-ratna-20261013/appearance-native.json
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
const out = path.resolve(process.argv[2] || '/tmp/halfsword-ratna-20261013/appearance-native.json');
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
  options: { seed: 73, weapon: 'longsword', weapon2: 'falchion', walls: false, gap: 12 },
  look: { id: 'ratna', version: 'v1', outfit: 'ratna_ferryman', voice: 'tome' },
  input: 'Native newRound, nine mild cuts, native decal projection/reprojection, two joint cuts and 90 simulation steps.',
  checks: [],
  limits: [
    'Physics comparison covers the initial world snapshot with and without the outfit.',
    'Synthetic cuts and separation test appearance retention, not combat frequency or balance.',
    'Decal projection runs without canvas textures; browser evidence assesses visible wound quality.',
    'Rigid segmented clothes and the decorative paddle have no fabric or prop collision simulation.',
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
let dressed, neutral;
try {
  const look = getLook('ratna'), character = CHARACTERS_BY_ID.ratna;
  check('Registered adult ferryman with existing falchion and mature male voice',
    character?.age === 52 && character.weapon === 'falchion' && character.voice === 'tome'
    && character.look === look && character.lookVersion === 'v1' && look.outfit === result.look.outfit);
  dressed = newRound({ ...result.options, look2: look });
  neutral = newRound({ ...result.options, look2: { ...look, outfit: null } });
  result.snapshotSha256 = { dressed: sha(dressed.world.takeSnapshot()), neutral: sha(neutral.world.takeSnapshot()) };
  check('Native world snapshot identical', result.snapshotSha256.dressed === result.snapshotSha256.neutral);
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
  result.pass = true;
} catch (error) {
  result.failure = error.stack || String(error); process.exitCode = 1;
} finally {
  if (neutral) dispose(neutral);
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
