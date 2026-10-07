// Resource-lifetime contracts only: synthetic effect states, no combat or renderer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { disposeVisualTrees } from '../../src/visual_resources.js';
import { createDecapFx } from '../../src/decap_fx.js';
import { createLimbSeverFx } from '../../src/limb_sever_fx.js';
import { Fighter } from '../../src/fighter.js';
import { weaponEnv } from '../../src/weapon_looks.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6)
  ?? `/tmp/halfsword-visual-resources-${Date.now()}.json`;
if (fs.existsSync(out)) throw new Error(`Refusing to replace evidence: ${out}`);
const sourcePaths = ['src/visual_resources.js', 'src/main.js', 'src/fighter.js',
  'src/decap_fx.js', 'src/limb_sever_fx.js', 'src/weapon_looks.js',
  'tools/sim/visual_resources.test.mjs', 'package-lock.json',
  'node_modules/three/src/core/EventDispatcher.js',
  'node_modules/three/src/objects/Sprite.js'];
const hashes = () => Object.fromEntries(sourcePaths.map((p) => [p,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, p))).digest('hex')]));
const result = {
  kind: 'visual_resource_lifetime_contract', createdUTC: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  command: [process.execPath, fileURLToPath(import.meta.url), `--out=${out}`],
  sourceBefore: hashes(), physicsSteps: 0, browserExecutions: 0,
  assertions: [], disposalCalls: [],
  limitations: [
    'Synthetic fighter states invoke the real visual FX factories; they do not prove a combat injury or natural severing event.',
    'Dispose event counts verify ownership and deduplication, not GPU deallocation or renderer program reference counts.',
    'Fighter.clearLoose is the real method called on a synthetic detached visual root; no physics world is created.',
    'Browser restart, shader warm-up, visual correctness and performance are verified separately.',
  ],
};
const counts = new Map();
const watch = (resource) => {
  if (!counts.has(resource)) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  return resource;
};
const count = (resource) => counts.get(resource) ?? 0;
function check(name, ok, detail = undefined) {
  result.assertions.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
}
function withoutRandom(name, fn) {
  const original = Math.random;
  let randomCalls = 0;
  Math.random = () => { randomCalls++; return 0.25; };
  try { fn(); } finally { Math.random = original; }
  result.disposalCalls.push({ name, randomCalls });
  check(`${name}: disposal consumes no Math.random`, randomCalls === 0);
}
function resources(roots) {
  const geometry = new Set(), material = new Set();
  for (const root of roots) root.traverse((o) => {
    if (o.geometry) geometry.add(watch(o.geometry));
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) material.add(watch(m));
  });
  return { geometry, material };
}
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const allCount = (set, expected) => [...set].every((x) => count(x) === expected);
const particles = { bloodOn: false, add() { throw new Error('Unexpected particle emission'); } };
const decap = createDecapFx(particles);
const limbs = createLimbSeverFx(particles);
function effectFixture() {
  const groups = Object.fromEntries(['chest', 'head', 'uarmS', 'farmS'].map((name) => [name, new THREE.Group()]));
  const fighter = {
    groups, decapitated: true,
    wounds: [{ stump: true, local: new THREE.Vector3(0, 0.17, 0) }],
    severedLimbs: [{ parent: 'uarmS', root: 'farmS', radius: 0.04,
      localParent: new THREE.Vector3(), localChild: new THREE.Vector3(),
      normalParent: new THREE.Vector3(0, 1, 0), normalChild: new THREE.Vector3(0, -1, 0) }],
  };
  decap.update([fighter], 0);
  limbs.update([fighter], 0);
  return { roots: Object.values(groups), neck: resources([groups.chest, groups.head]),
    limb: resources([groups.uarmS, groups.farmS]) };
}

try {
  const first = effectFixture();
  check('Actual decap FX shares exactly 3 geometry and 3 material instances',
    first.neck.geometry.size === 3 && first.neck.material.size === 3);
  check('Actual limb FX owns 4 end-face geometries and shares exactly 2 materials',
    first.limb.geometry.size === 4 && first.limb.material.size === 2);
  withoutRandom('First effect round cleanup', () => disposeVisualTrees([...first.roots, first.roots[0]]));
  check('All 3 decap geometries and all 5 FX materials survive cleanup',
    allCount(first.neck.geometry, 0) && allCount(first.neck.material, 0) && allCount(first.limb.material, 0));
  check('Every first-round limb end-face geometry is disposed once', allCount(first.limb.geometry, 1));

  const second = effectFixture();
  check('Next effect round reuses the exact retained FX resources',
    sameSet(first.neck.geometry, second.neck.geometry) && sameSet(first.neck.material, second.neck.material)
    && sameSet(first.limb.material, second.limb.material));
  check('Next-round limb geometries are fresh and not prematurely disposed',
    [...second.limb.geometry].every((g) => !first.limb.geometry.has(g) && count(g) === 0));
  withoutRandom('Second effect round cleanup', () => disposeVisualTrees(second.roots));
  check('Retained resources survive two rounds; both rounds release each owned limb geometry once',
    allCount(first.neck.geometry, 0) && allCount(first.neck.material, 0) && allCount(first.limb.material, 0)
    && allCount(first.limb.geometry, 1) && allCount(second.limb.geometry, 1));

  const retainedMaterial = [...first.neck.material][0];
  const clone = watch(retainedMaterial.clone());
  const cloneGeometry = watch(new THREE.PlaneGeometry());
  const cloneMesh = new THREE.Mesh(cloneGeometry, clone);
  withoutRandom('Owned clone cleanup', () => disposeVisualTrees([cloneMesh]));
  check('An owned material clone does not inherit retention from its source',
    count(clone) === 1 && count(cloneGeometry) === 1 && count(retainedMaterial) === 0);

  const texture = watch(new THREE.Texture()), environment = watch(weaponEnv());
  const geometry = watch(new THREE.BoxGeometry());
  const material = watch(new THREE.MeshStandardMaterial({ map: texture, envMap: environment }));
  const material2 = watch(new THREE.MeshBasicMaterial({ map: texture }));
  const rootA = new THREE.Group(), rootB = new THREE.Group();
  const meshA = new THREE.Mesh(geometry, [material, material2, material]);
  rootA.add(meshA);
  rootB.add(new THREE.Mesh(geometry, material));
  withoutRandom('Duplicate roots and material-array cleanup', () => disposeVisualTrees([rootA, rootB, rootA, meshA]));
  check('Geometry and array materials shared across roots are each disposed once per batch',
    count(geometry) === 1 && count(material) === 1 && count(material2) === 1);
  check('Shared map and actual weaponEnv texture are never disposed', count(texture) === 0 && count(environment) === 0);

  const spriteMaterial = watch(new THREE.SpriteMaterial({ map: texture }));
  const outsideMaterial = watch(new THREE.SpriteMaterial({ map: texture }));
  const sprite = new THREE.Sprite(spriteMaterial), outsideSprite = new THREE.Sprite(outsideMaterial);
  watch(sprite.geometry);
  check('The owned and outside sprites use Three.js singleton geometry', sprite.geometry === outsideSprite.geometry);
  withoutRandom('Sprite cleanup', () => disposeVisualTrees([sprite]));
  check('Sprite-owned material is released while singleton geometry and outside material survive',
    count(spriteMaterial) === 1 && count(sprite.geometry) === 0 && count(outsideMaterial) === 0 && count(texture) === 0);

  const scene = new THREE.Scene(), loose = new THREE.Group(), body = new THREE.Group();
  const looseGeometry = watch(new THREE.SphereGeometry(0.1, 4, 3));
  const looseMaterial = watch(new THREE.MeshStandardMaterial({ envMap: environment }));
  const scarGeometry = watch(new THREE.PlaneGeometry());
  const scarMaterial = watch(new THREE.MeshStandardMaterial({ map: texture, transparent: true }));
  loose.add(new THREE.Mesh(looseGeometry, looseMaterial), new THREE.Mesh(looseGeometry, looseMaterial),
    new THREE.Mesh(scarGeometry, scarMaterial));
  const bodyGeometry = watch(new THREE.BoxGeometry());
  const bodyMaterial = watch(new THREE.MeshStandardMaterial());
  body.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
  scene.add(loose, body);
  const owner = { meshes: [{ kind: 'loose', group: loose }, { kind: 'loose', group: loose }, { kind: 'head', group: body }] };
  withoutRandom('Fighter.clearLoose detached-root cleanup', () => Fighter.prototype.clearLoose.call(owner));
  check('clearLoose removes only the detached root and releases its helmet and scar resources once',
    loose.parent === null && body.parent === scene && count(looseGeometry) === 1 && count(looseMaterial) === 1
    && count(scarGeometry) === 1 && count(scarMaterial) === 1 && count(bodyGeometry) === 0 && count(bodyMaterial) === 0);
  withoutRandom('Repeated Fighter.clearLoose', () => Fighter.prototype.clearLoose.call(owner));
  check('Repeated clearLoose is a no-op after detachment, retaining textures',
    count(looseGeometry) === 1 && count(looseMaterial) === 1 && count(scarGeometry) === 1 && count(scarMaterial) === 1
    && count(texture) === 0 && count(environment) === 0);
  result.fixtureSummary = { effectRounds: 2, retainedGeometry: 3, retainedMaterial: 5,
    disposedLimbGeometry: 8, rendererCreated: false, worldCreated: false };
} catch (error) {
  result.exception = { name: error.name, message: error.message, stack: error.stack };
} finally {
  result.sourceAfter = hashes();
  result.sourceStable = JSON.stringify(result.sourceBefore) === JSON.stringify(result.sourceAfter);
  result.pass = !result.exception && result.sourceStable && result.assertions.every((a) => a.ok);
  result.failed = result.assertions.filter((a) => !a.ok).map((a) => a.name);
  result.completedUTC = new Date().toISOString();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  const bytes = fs.readFileSync(out);
  console.log(JSON.stringify({ out, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    pass: result.pass, assertions: result.assertions.length, failed: result.failed,
    exception: result.exception, sourceStable: result.sourceStable, physicsSteps: 0, browserExecutions: 0 }));
  process.exitCode = result.pass ? 0 : 1;
}
