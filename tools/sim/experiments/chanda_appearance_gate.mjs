// Costume-only gate using the actual native fighter and wound implementation.
// node tools/sim/experiments/chanda_appearance_gate.mjs /tmp/halfsword-chanda-20261013/appearance-native.json
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, THREE } from '../harness_m.mjs';
import { getLook } from '../../../src/looks.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = path.resolve(process.argv[2] || '/tmp/halfsword-chanda-20261013/appearance-native.json');
assert(out.startsWith('/tmp/'), 'Keep generated evidence outside the checkout, under /tmp');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
  'src/looks.js', 'src/outfits.js', 'src/outfit_chanda.js', 'src/fighter.js',
  'src/config.js', 'src/ai.js', 'src/combat.js', 'tools/sim/harness_m.mjs',
  'tools/sim/experiments/chanda_appearance_gate.mjs', 'package-lock.json',
];
const result = {
  pass: false,
  completedAt: null,
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceSha256: Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
  options: { seed: 73, weapon: 'longsword', weapon2: 'sabre', walls: false, gap: 12 },
  look: { id: 'chanda', version: 'v1', outfit: 'chanda_watergate' },
  input: 'Native harness newRound; seven direct applyWound calls, followed by 90 native simulation steps.',
  checks: [],
  limits: [
    'Physics comparison covers the initial world snapshot with and without the outfit.',
    'Synthetic cuts check appearance retention; they do not demonstrate natural combat hits or balance.',
    'Rigid segmented garments have no fabric collision simulation; screenshots assess visual quality separately.',
  ],
};
const check = (name, value) => { assert(value, name); result.checks.push(name); };
const dispose = g => { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); };
let dressed, neutral;
try {
  const look = getLook('chanda');
  assert.equal(look.outfit, result.look.outfit);
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
  check('Stock head, nose and eye dimensions preserved', true);
  check('Original torso width', dressed.enemy.groups.chest.scale.z === 1 && dressed.enemy.groups.abdomen.scale.z === 1);
  check('Unarmored keeper', !dressed.enemy.hasHelmet && Object.keys(dressed.enemy.plate).length === 0);

  const layers = [];
  for (const { group } of dressed.enemy.meshes) group.traverse(node => {
    if (node.name.startsWith('chanda-')) layers.push({ node, parent: node.parent });
  });
  result.woundedParts = ['head', 'chest', 'abdomen', 'pelvis', 'farmS', 'thighF', 'shinF'];
  for (const part of result.woundedParts) dressed.enemy.applyWound({
    part, zone: part, type: 'cut', severity: 0.025, energy: 2, bleedPerSev: 0.005,
    local: new THREE.Vector3(0.1, 0, 0), dir: new THREE.Vector3(1, 0, 0),
    pass: true, passing: false, plate: false,
  });
  for (let i = 0; i < 90; i++) { dressed.step(); dressed.enemy.syncMeshes(); }
  result.layers = layers.length;
  result.wounds = dressed.enemy.wounds.length;
  result.stepsAfterWounds = 90;
  check('Wounds retain segmented clothing', layers.length > 10 && result.wounds >= result.woundedParts.length
    && layers.every(({ node, parent }) => node.parent === parent && node.visible));

  result.meshes = 0; result.triangles = 0;
  for (const { group } of dressed.enemy.meshes) group.traverse(node => {
    if (!node.isMesh) return;
    assert(node.geometry.attributes.position.array.every(Number.isFinite));
    result.meshes++;
    result.triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  check('All Chanda geometry finite after wounds', true);
  result.pass = true;
} catch (error) {
  result.failure = error.stack || String(error);
  process.exitCode = 1;
} finally {
  if (neutral) dispose(neutral);
  if (dressed) dispose(dressed);
  result.completedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: result.pass, checks: result.checks.length,
  layers: result.layers, wounds: result.wounds, meshes: result.meshes, triangles: result.triangles, out,
  ...(result.failure ? { failure: result.failure } : {}),
}));
