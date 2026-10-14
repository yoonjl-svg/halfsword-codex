// Actual native fighter: clay decoration must preserve normal eyes, physics,
// part ownership and baseline injury. Rendering is assessed separately.
// node tools/sim/experiments/terracotta_appearance_gate.mjs /tmp/terracotta-native.json
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, THREE } from '../harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { attachHandVisuals } from '../../../src/hand_visual.js';

const out = path.resolve(process.argv[2] || '/tmp/terracotta-native.json');
assert(out.startsWith('/tmp/'), 'Keep generated evidence outside the checkout');
const sha = b => createHash('sha256').update(b).digest('hex');
const source = ['src/outfit_terracotta.js', 'src/looks.js', 'src/outfits.js',
  'src/characters_terracotta.js', 'src/characters.js', 'src/fighter.js', 'src/hand_visual.js',
  'tools/sim/experiments/terracotta_appearance_gate.mjs'];
const result = { pass: false, baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSha256: Object.fromEntries(source.map(f => [f, sha(fs.readFileSync(f))])), checks: [],
  options: { seed: 73, weapon: 'longsword', weapon2: 'ganjiang', walls: false, gap: 12 },
  input: 'Registered native character; identical initial snapshot; 240 native AI steps; seven direct cuts and 90 further steps.',
  limits: ['Single deterministic sample, not combat balance validation.',
    'Synthetic cuts verify retained decoration, not natural hit success.',
    'Rigid part-bound costume; no cloth simulation or ceramic fracture mechanic.',
    'Visual quality, sound and browser input are assessed separately.'] };
const check = (name, pass) => { assert(pass, name); result.checks.push(name); };
const dispose = g => { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); };
let dressed, neutral, hands;
try {
  const c = CHARACTERS_BY_ID.terracotta;
  check('Registered clay guard with fixed ganjiang, undisclosed human age and silent voice',
    c.name === '병마용' && c.age === null && c.weapon === 'ganjiang' && !c.weaponAlt && c.voice === 'silent');
  const opts = { ...result.options, look2: c.look, persona: c.ai.persona, difficulty: c.ai.level };
  dressed = newRound(opts); neutral = newRound({ ...opts, look2: { ...c.look, outfit: null } });
  check('Native initial physics snapshot identical', sha(dressed.world.takeSnapshot()) === sha(neutral.world.takeSnapshot()));
  for (let i = 0; i < 4; i++) {
    const a = dressed.enemy.groups.head.children[i], b = neutral.enemy.groups.head.children[i];
    assert.deepEqual(a.geometry.attributes.position.array, b.geometry.attributes.position.array);
    assert.deepEqual(a.geometry.index.array, b.geometry.index.array);
    assert.deepEqual(a.position.toArray(), b.position.toArray());
    assert.deepEqual(a.quaternion.toArray(), b.quaternion.toArray());
    assert.deepEqual(a.scale.toArray(), b.scale.toArray());
  }
  check('Native head, nose and normal eye shapes exactly retained', true);
  check('Standard torso scale and no steel protection', dressed.enemy.groups.chest.scale.z === 1
    && dressed.enemy.groups.abdomen.scale.z === 1 && !dressed.enemy.hasHelmet
    && c.look.armor === null && Object.keys(dressed.enemy.plate).length === 0);
  check('Existing ganjiang AI school', dressed.ai.school.id === 'ganjiang');
  const layers = [], representative = { ...dressed.enemy.partMesh };
  for (const { group } of dressed.enemy.meshes) group.traverse(node => {
    if (node.name.startsWith('terracotta-')) layers.push({ node, parent: node.parent });
  });
  check('Decoration attached beneath native part meshes', layers.length >= 25
    && layers.every(({ parent }) => Object.values(representative).includes(parent)));
  for (let i = 0; i < 240; i++) dressed.step();
  const parts = ['head', 'chest', 'abdomen', 'pelvis', 'farmS', 'thighF', 'shinF'];
  for (const part of parts) dressed.enemy.applyWound({ part, zone: part, type: 'cut', severity: 0.025,
    energy: 2, bleedPerSev: 0.005, local: new THREE.Vector3(0.1, 0, 0),
    dir: new THREE.Vector3(1, 0, 0), pass: true, passing: false, plate: false });
  for (let i = 0; i < 90; i++) { dressed.step(); dressed.enemy.syncMeshes(); }
  check('Seven wounds retain representative mesh identities and decoration', dressed.enemy.wounds.length >= parts.length
    && Object.entries(representative).every(([part, mesh]) => dressed.enemy.partMesh[part] === mesh)
    && layers.every(({ node, parent }) => node.parent === parent && node.visible));
  for (const body of dressed.world.bodies.getAll()) for (const v of [body.translation(), body.rotation(), body.linvel(), body.angvel()])
    assert(Object.values(v).every(Number.isFinite));
  check('330 native steps retain finite rigid-body state and valid joints',
    [dressed.player, dressed.enemy].every(f => f.joints.every(j => j.joint?.isValid())));
  result.meshes = 0; result.triangles = 0;
  for (const { group } of dressed.enemy.meshes) group.traverse(node => {
    if (!node.isMesh) return;
    assert(node.geometry.attributes.position.array.every(Number.isFinite));
    result.meshes++;
    result.triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  check('Finite mesh geometry', true);
  for (const { node } of layers) node.traverse(m => {
    if (m.isMesh) assert(m.material.metalness === 0 && m.material.roughness === 1);
  });
  check('Every added costume material is matte nonmetal clay', true);
  hands = attachHandVisuals(dressed.enemy, c.look);
  assert(hands?.main && hands?.off, 'Both native replacement hands must attach');
  let handMeshes = 0;
  for (const hand of [hands.main, hands.off]) hand.traverse(m => {
    if (!m.isMesh) return;
    handMeshes++;
    assert(!m.material.vertexColors || m.geometry.hasAttribute('color'),
      'Reused hand material must not request missing vertex color data');
    assert.equal(m.material.color.getHex(), c.look.hands);
    assert.equal(m.material.metalness, 0); assert.equal(m.material.roughness, 1);
  });
  check('Both generated hands and all grip modes use compatible matte clay material', handMeshes === 8);
  result.handMeshes = handMeshes;
  result.layers = layers.length; result.wounds = dressed.enemy.wounds.length; result.pass = true;
} catch (error) { result.failure = error.stack || String(error); process.exitCode = 1; }
finally {
  hands?.dispose();
  if (neutral) dispose(neutral); if (dressed) dispose(dressed);
  result.completedAt = new Date().toISOString(); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: result.pass, checks: result.checks.length, layers: result.layers,
  wounds: result.wounds, meshes: result.meshes, triangles: result.triangles, out,
  ...(result.failure ? { failure: result.failure } : {}) }));
