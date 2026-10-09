// Real GLB geometry/skin and native Rapier execution; texture pixels/rendering are separate.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareSchwarzAppearance } from '../../src/tripo_character.js';
import { SCHWARZ_RIG } from '../../src/tripo_character_rig.js';
import { attachHandVisuals } from '../../src/hand_visual.js';
import { getLook } from '../../src/looks.js';
import { setPlateWear } from '../../src/outfits.js';
import { disposeVisualTrees } from '../../src/visual_resources.js';
import { newRound, DT } from '../sim/harness_m.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const asset = option('asset') ?? path.join(repo, 'public/models/tripo/schwarz-anime.glb');
const out = option('out') ?? `/tmp/schwarz-native-adapter-${Date.now()}.json`;
if (fs.existsSync(out)) throw new Error(`Refusing to replace evidence: ${out}`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['src/tripo_character.js', 'src/tripo_character_rig.js', 'src/tripo_foot_patch.js',
  'src/fighter.js', 'src/hand_visual.js', 'src/visual_resources.js', 'tools/sim/harness_m.mjs',
  'tools/assets/tripo_character.test.mjs'];
const hashes = () => Object.fromEntries(sources.map(name => [name, hash(fs.readFileSync(path.join(repo, name)))]));
const report = { kind: 'schwarz_real_glb_native_adapter', startedUTC: new Date().toISOString(),
  command: process.argv, asset, sourceBefore: hashes(), assertions: [], randomChecks: [], traces: [],
  limitations: ['Texture decoding is replaced by empty textures; this does not verify appearance or GPU rendering.',
    'The paired native trace is a short deterministic observation, not broad combat coverage.',
    'Armor visibility and fallback are deliberate lifecycle fixtures, not natural impact evidence.'] };
function check(name, ok, detail) {
  report.assertions.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
  if (!ok) throw new Error(name);
}
function withoutRandom(name, action) {
  const previous = Math.random;
  let calls = 0;
  const monitor = () => { calls++; return previous(); };
  Math.random = monitor;
  let value;
  try { value = action(); } finally {
    const restored = Math.random === monitor;
    Math.random = previous;
    report.randomChecks.push({ name, calls, restored });
    check(`${name}: preserves the game random stream`, calls === 0 && restored);
  }
  return value;
}
const renderables = root => {
  const objects = [];
  root.traverse(object => { if (object.isMesh || object.isLine || object.isSprite) objects.push(object); });
  return objects;
};
const skinWorld = mesh => {
  mesh.updateWorldMatrix(true, false);
  mesh.skeleton.update();
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
    mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
};
const counts = world => ({ bodies: world.bodies.len(), colliders: world.colliders.len(), joints: world.impulseJoints.len() });
const worldHash = world => hash(world.takeSnapshot());
const disposalWatch = resource => {
  const tally = { count: 0 };
  resource.addEventListener('dispose', () => tally.count++);
  return tally;
};
const originalRandom = Math.random;
const originalDocument = globalThis.document;
globalThis.document ??= { getElementById: () => null };
const liveRounds = [];

try {
  const bytes = fs.readFileSync(asset);
  check('Input is the pinned genuine generated GLB', bytes.length === SCHWARZ_RIG.bytes && hash(bytes) === SCHWARZ_RIG.sha256);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'offline-empty-textures', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.traverse(object => {
    const node = gltf.parser.associations.get(object)?.nodes;
    if (node !== undefined) object.userData.schwarzNode = node;
  });
  gltf.scene.updateMatrixWorld(true);
  const sourceMesh = renderables(gltf.scene).find(object => object.isSkinnedMesh);
  const sourceGeometry = sourceMesh.geometry;
  const sourceIndices = Array.from(sourceGeometry.index.array);
  const sourceWeights = sourceGeometry.attributes.skinWeight.array.slice();
  const sourceRest = skinWorld(sourceMesh);
  const session = prepareSchwarzAppearance(gltf.scene, asset);
  const patchedRest = skinWorld(sourceMesh);
  const maxRestError = Math.max(...sourceRest.map((point, i) => point.distanceTo(patchedRest[i])));
  check('Synthetic ankle and hand crop preserve every bind vertex', maxRestError < 2e-6, { maxRestError });
  check('Synthetic ankle preserves source weights exactly', hash(sourceWeights) === hash(sourceMesh.geometry.attributes.skinWeight.array));
  check('Original downloaded geometry is not mutated', sourceGeometry.index.count === 23508
    && sourceGeometry.attributes.skinIndex.array.every(index => index < 64));
  check('All 65 runtime bones are mapped once to 14 native bodies', sourceMesh.skeleton.bones.length === 65
    && SCHWARZ_RIG.regions.length === 14
    && new Set(SCHWARZ_RIG.regions.flatMap(region => region.nodes)).size === 65
    && SCHWARZ_RIG.regions.flatMap(region => region.nodes).length === 65);
  const kept = new Set();
  const croppedIndex = sourceMesh.geometry.index.array;
  for (let i = 0; i < croppedIndex.length; i += 3) kept.add(Array.from(croppedIndex.slice(i, i + 3)).join(','));
  const removed = [];
  for (let i = 0; i < sourceIndices.length; i += 3) {
    const triangle = sourceIndices.slice(i, i + 3);
    if (!kept.has(triangle.join(','))) removed.push(triangle);
  }
  const positions = sourceGeometry.attributes.position;
  check('Open-hand crop removes hands while preserving all leg triangles', removed.length > 0
    && removed.every(triangle => triangle.every(index => positions.getY(index) > 0.35)),
  { removedTriangles: removed.length, keptTriangles: croppedIndex.length / 3 });
  report.footRepair = gltf.scene.userData.schwarzFootPatch;

  for (const enabled of [false, true]) {
    const game = newRound({ seed: 719, weapon: 'longsword', weapon2: 'longsword', look2: getLook('margarethe') });
    liveRounds.push(game);
    const fighter = game.enemy;
    for (const f of [game.player, fighter]) f.syncMeshes();
    const hands = attachHandVisuals(fighter, getLook('margarethe'));
    const before = worldHash(game.world), nativeCounts = counts(game.world);
    let controller;
    if (enabled) controller = withoutRandom('Attach appearance', () => session.attach(fighter));
    check(`Attach leaves native world unchanged (${enabled})`, worldHash(game.world) === before
      && JSON.stringify(counts(game.world)) === JSON.stringify(nativeCounts));
    const nextRandom = Math.random(), trace = createHash('sha256');
    const skinRoot = enabled ? fighter.scene.children.find(object => object.userData.characterAppearance === 'schwarz-tripo') : null;
    for (let tick = 0; tick < 120; tick++) {
      game.step();
      for (const f of [game.player, fighter]) f.syncMeshes();
      hands.update();
      if (controller) {
        const beforeUpdate = worldHash(game.world);
        withoutRandom(`Update ${tick}`, () => controller.update());
        check(`Update ${tick} leaves native world unchanged`, worldHash(game.world) === beforeUpdate);
      }
      trace.update(game.world.takeSnapshot());
    }
    const row = { enabled, initialNativeSHA: before, nativeCounts, nextRandom,
      nativeTraceSHA: trace.digest('hex'), steps: 120, seconds: 120 * DT };
    report.traces.push(row);
    if (controller) {
      check('Adapter remained active throughout the short trace', controller.status === 'ready');
      const bones = [];
      skinRoot.traverse(object => { if (object.isBone) bones.push(object); });
      check('Every actual runtime bone matrix is finite', bones.length === 65
        && bones.every(bone => bone.matrixWorld.elements.every(Number.isFinite)));
      const skin = renderables(skinRoot).find(object => object.isSkinnedMesh);
      check('Actual deformed skin vertices are finite', skinWorld(skin).every(point => point.toArray().every(Number.isFinite)));
      const originals = Object.values(fighter.groups).flatMap(renderables);
      const nativeHands = [...renderables(hands.main), ...renderables(hands.off)];
      const nativeBody = originals.filter(object => !nativeHands.includes(object));
      check('Native hands stay on their original rendering layer', nativeHands.every(object => object.layers.mask === 1));
      check('Native body alone is masked', nativeBody.length > 0 && nativeBody.every(object => object.layers.mask === 2 ** 31));
      check('Native weapon remains visible', fighter.swordGroup.visible && renderables(fighter.swordGroup).every(object => object.layers.mask === 1));
      const visibleBeforeWear = nativeBody.map(object => object.visible);
      setPlateWear(fighter.plateGroups.chest, 0);
      const visibleAfterWear = nativeBody.map(object => object.visible);
      check('Real armor display changes remain possible while masked', visibleAfterWear.some((visible, i) => visible !== visibleBeforeWear[i]));
      withoutRandom('Victim injury fallback', () => session.onWound(fighter));
      check('Fallback restores layers without undoing armor visibility changes', controller.status === 'fallback'
        && !skinRoot.visible && nativeBody.every((object, i) => object.layers.mask === 1 && object.visible === visibleAfterWear[i]));
      const fallbackWorld = worldHash(game.world);
      withoutRandom('Repeated fallback and update', () => { session.onWound(fighter); controller.update(); });
      check('Repeated fallback changes no native state', worldHash(game.world) === fallbackWorld);

      const geometryDisposed = disposalWatch(skin.geometry);
      const materials = Array.isArray(skin.material) ? skin.material : [skin.material];
      const materialDisposed = materials.map(disposalWatch);
      skin.skeleton.computeBoneTexture();
      const boneTextureDisposed = disposalWatch(skin.skeleton.boneTexture);
      const preDispose = worldHash(game.world);
      withoutRandom('Dispose appearance twice', () => { controller.dispose(); controller.dispose(); });
      check('Controller disposal preserves native world and releases its skeleton once', worldHash(game.world) === preDispose
        && boneTextureDisposed.count === 1 && session.snapshot().disposals === 1);
      hands.dispose();
      skinRoot.removeFromParent();
      withoutRandom('Round visual cleanup', () => disposeVisualTrees([skinRoot]));
      check('Round cleanup preserves cached geometry and releases cloned materials once', geometryDisposed.count === 0
        && materialDisposed.every(tally => tally.count === 1));
      const next = withoutRandom('Next-round appearance clone', () => session.attach(fighter));
      const nextRoot = fighter.scene.children.find(object => object.userData.characterAppearance === 'schwarz-tripo');
      const nextSkin = renderables(nextRoot).find(object => object.isSkinnedMesh);
      check('Next round uses retained geometry and a fresh material/skeleton', nextSkin.geometry === skin.geometry
        && nextSkin.material !== skin.material && nextSkin.skeleton !== skin.skeleton);
      withoutRandom('Next-round disposal', () => next.dispose());
      nextRoot.removeFromParent(); disposeVisualTrees([nextRoot]);
    } else hands.dispose();
    game.world.free(); game.eventQueue.free(); liveRounds.splice(liveRounds.indexOf(game), 1);
  }
  check('Enabled appearance preserves the complete paired native trace and random draw',
    report.traces[0].initialNativeSHA === report.traces[1].initialNativeSHA
    && report.traces[0].nativeTraceSHA === report.traces[1].nativeTraceSHA
    && report.traces[0].nextRandom === report.traces[1].nextRandom);
} catch (error) {
  report.exception = { name: error.name, message: error.message, stack: error.stack };
} finally {
  Math.random = originalRandom;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  for (const game of liveRounds) { game.world.free(); game.eventQueue.free(); }
  report.sourceAfter = hashes();
  report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  report.pass = !report.exception && report.sourceStable && report.assertions.every(assertion => assertion.ok);
  report.finishedUTC = new Date().toISOString();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, assertions: report.assertions.length, out,
    sourceStable: report.sourceStable, exception: report.exception?.message, traces: report.traces }));
  if (!report.pass) process.exitCode = 1;
}
