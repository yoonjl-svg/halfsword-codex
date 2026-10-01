// Construction-only inventory through actual Fighter/harness objects.
// No physics integration, anatomy tuning, force monkeypatch or benchmark.
import { newRound, CONFIG, THREE, RAPIER } from './harness_m.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMain } from './is_main.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const arr = (v) => [v.x, v.y, v.z];
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const quaternion = (q) => [q.x, q.y, q.z, q.w];
const distance = (a, b) => V(a).distanceTo(V(b));
const worldPoint = (b, p) => V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
class Passive { update() {} }

function colliderRow(c) {
  const kind = RAPIER.ShapeType[c.shapeType()];
  const row = { shape: kind, massKg: c.mass(), worldPositionM: arr(c.translation()),
    worldQuaternion: quaternion(c.rotation()), collisionGroups: c.collisionGroups() >>> 0,
    friction: c.friction() };
  if (kind === 'Cuboid') row.fullDimensionsLocalM = arr(c.halfExtents()).map((x) => x * 2);
  if (kind === 'Capsule') Object.assign(row, { radiusM: c.radius(), halfCylinderLengthM: c.halfHeight(),
    endToEndLengthM: 2 * (c.halfHeight() + c.radius()) });
  if (kind === 'Ball') row.radiusM = c.radius();
  return row;
}

function jointRow(j, names) {
  const a1 = j.joint.anchor1(), a2 = j.joint.anchor2();
  const world1 = worldPoint(j.parent, a1), world2 = worldPoint(j.child, a2);
  const axes = j.type === 'hinge' ? { physicalBodyLocalZ: 3 } : { bodyLocalX: 3, bodyLocalY: 4, bodyLocalZ: 5 };
  const raw = j.joint.rawSet;
  return { name: j.name, parent: names.get(j.parent.handle), child: names.get(j.child.handle),
    modelType: j.type, nativeType: RAPIER.JointType[j.joint.type()],
    nominalRotationalDOF: j.type === 'hinge' ? 1 : 3, manual: j.manual,
    parentAnchorLocalM: arr(a1), childAnchorLocalM: arr(a2),
    parentAnchorWorldM: arr(world1), childAnchorWorldM: arr(world2), initialAnchorGapM: world1.distanceTo(world2),
    hingeAxisWorld: j.type === 'hinge' ? arr(new THREE.Vector3(0, 0, 1).applyQuaternion(Q(j.parent.rotation()))) : null,
    angularLimits: Object.fromEntries(Object.entries(axes).map(([name, axis]) => [name, {
      rawAxis: axis, enabled: raw.jointLimitsEnabled(j.joint.handle, axis),
      minRad: raw.jointLimitsMin(j.joint.handle, axis), maxRad: raw.jointLimitsMax(j.joint.handle, axis) }])),
    motorParameters: { k: j.k, d: j.d, nominalMax: j.max,
      meaning: 'configuration/target-error budget, not measured total applied torque' } };
}

function model(mode, offHandLocal) {
  const saved = CONFIG.BODY.weightMode, random = Math.random;
  let G;
  try {
    CONFIG.BODY.weightMode = mode;
    G = newRound({ seed: 7, walls: false, AIClass: Passive });
    const f = G.player;
    // Realize queued mass-property updates without advancing or changing the pose.
    for (const b of [...Object.values(f.bodies), f.sword]) b.recomputeMassPropertiesFromColliders();
    const names = new Map(Object.entries(f.bodies).map(([n, b]) => [b.handle, n]));
    const parts = Object.fromEntries(Object.entries(f.bodies).map(([name, b]) => {
      const mesh = f.partMesh[name];
      return [name, { massKg: b.mass(), bodyWorldM: arr(b.translation()),
        principalInertiaKgM2: arr(b.principalInertia()), principalFrameQuaternion: quaternion(b.principalInertiaLocalFrame()),
        colliders: Array.from({ length: b.numColliders() }, (_, i) => colliderRow(b.collider(i))),
        primaryVisualGeometry: { type: mesh.geometry.type, parameters: { ...mesh.geometry.parameters },
          meshScale: arr(mesh.scale), parentLocalQuaternion: quaternion(mesh.parent.quaternion),
          meaning: 'primary dressed mesh only; clothing, hand spheres and armor decorations may extend farther' } }];
    }));
    const j = f.jointByName;
    const lengths = {
      swordUpperM: distance(j.uarmS.joint.anchor2(), j.farmS.joint.anchor1()),
      swordForeToGripM: distance(j.farmS.joint.anchor2(), f.gripJoint.anchor1()),
      offUpperM: distance(j.uarmO.joint.anchor2(), j.farmO.joint.anchor1()),
      offForeToForcePointM: distance(j.farmO.joint.anchor2(), offHandLocal),
      thighFM: distance(j.thighF.joint.anchor2(), j.shinF.joint.anchor1()),
      shinFM: distance(j.shinF.joint.anchor2(), j.footF.joint.anchor1()),
      thighBM: distance(j.thighB.joint.anchor2(), j.shinB.joint.anchor1()),
      shinBM: distance(j.shinB.joint.anchor2(), j.footB.joint.anchor1()),
    };
    const visualCounts = { bones: 0, skinnedMeshes: 0, handSphereMeshes: {} };
    for (const { group } of f.meshes) group.traverse((node) => {
      if (node.isBone) visualCounts.bones++;
      if (node.isSkinnedMesh) visualCounts.skinnedMeshes++;
    });
    for (const name of ['farmS', 'farmO']) {
      let count = 0;
      f.groups[name].traverse((node) => { if (node.geometry?.type === 'SphereGeometry') count++; });
      visualCounts.handSphereMeshes[name] = count;
    }
    const permits = (a, b) => !!((a >>> 16) & (b & 65535)) && !!((b >>> 16) & (a & 65535));
    const bodyGroups = Object.values(parts).map((p) => p.colliders[0].collisionGroups);
    const swordGroups = f.sword.collider(0).collisionGroups() >>> 0;
    const row = { weightMode: mode, bodyCount: Object.keys(parts).length,
      anatomicalJointCount: f.joints.length, bodyMassSumKg: Object.values(parts).reduce((a, b) => a + b.massKg, 0),
      controllerTotalMassKg: f.totalMass, swordMassKg: f.sword.mass(),
      extraObjects: { sword: 'separate dynamic body', uprightAnchor: 'separate kinematic body',
        gripJoint: { type: RAPIER.JointType[f.gripJoint.type()], forearmAnchorLocalM: arr(f.gripJoint.anchor1()) },
        uprightJoint: { type: RAPIER.JointType[f.uprightJoint.type()] } },
      parts, joints: f.joints.map((x) => jointRow(x, names)), lengths, visualCounts,
      collisionGroupChecks: {
        allPrimarySelfBodyPairsFiltered: bodyGroups.every((a, i) => bodyGroups.slice(i + 1).every((b) => !permits(a, b))),
        allPrimaryBodyAgainstOwnSwordFiltered: bodyGroups.every((a) => !permits(a, swordGroups)),
        note: 'group compatibility only, not geometric overlap test; primary colliders examined' },
      torso: Object.fromEntries(['pelvis', 'abdomen', 'chest'].map((n) => {
        const p = parts[n], d = p.primaryVisualGeometry.parameters;
        return [n, { colliderFullXYZM: p.colliders[0].fullDimensionsLocalM,
          visualPrimaryFullXYZM: [d.width, d.height, d.depth] }];
      })),
      footMass: { configuredExtraPerStanceFootKg: CONFIG.GAIT.footExtra,
        constructionFootMassKg: { F: f.bodies.footF.mass(), B: f.bodies.footB.mass() } } };
    if (f.gait) {
      f.gait.enter(); // Exercise the existing stance initialization, without world.step.
      for (const name of ['footF', 'footB']) f.bodies[name].recomputeMassPropertiesFromColliders();
      row.footMass.afterActualGaitEnterFootMassKg = { F: f.bodies.footF.mass(), B: f.bodies.footB.mass() };
      row.footMass.afterEnterBodyMassSumKg = Object.values(f.bodies).reduce((a, b) => a + b.mass(), 0);
      row.footMass.afterEnterControllerTotalMassKg = f.totalMass;
      row.footMass.note = 'stance initializes additional mass through existing footMass; no integration or gait benchmark';
    }
    return row;
  } finally { CONFIG.BODY.weightMode = saved; Math.random = random; G?.world.free(); G?.eventQueue.free(); }
}

export async function inventory() {
  const files = ['src/fighter.js', 'src/gait.js', 'src/config.js', 'tools/sim/harness_m.mjs', 'tools/sim/body_model_inventory.mjs'];
  const sourceHashes = Object.fromEntries(await Promise.all(files.map(async (f) => [f, createHash('sha256').update(await readFile(ROOT + f)).digest('hex')])));
  const fighter = await readFile(ROOT + 'src/fighter.js', 'utf8');
  const offMethod = fighter.slice(fighter.indexOf('  offArmIK(target) {'), fighter.indexOf('  // 칼끝/타격 지점'));
  const offUpper = Number(/const a = ([\d.]+);/.exec(offMethod)?.[1]);
  const offFore = Number(/const b = ([\d.]+);/.exec(offMethod)?.[1]);
  const forcePoint = /const hand = _gh.set\(([^)]+)\)/.exec(fighter)?.[1].split(',').map(Number);
  if (!forcePoint || forcePoint.length !== 3 || ![offUpper, offFore, ...forcePoint].every(Number.isFinite)) throw new Error('Off-arm source contract changed; inspect constants');
  const result = { schemaVersion: 1, command: 'node tools/sim/body_model_inventory.mjs',
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceHashes,
    protocol: 'actual newRound(seed7); construction-only; no world.step/render or force replacement; realize mass properties through native recompute; inspect hybrid and levitate joint construction',
    scope: 'geometry/model inventory, not validated anthropometry or human resemblance',
    sourceComment: { declaredRigidBodyCount: Number(/강체\(rigid body\) (\d+)개/.exec(fighter)?.[1]),
      reference: 'src/fighter.js:4; src/metadata file is absent in this checkout' },
    ik: { sword: { ...CONFIG.ARM }, off: { upper: offUpper, fore: offFore, forcePointLocalM: forcePoint } },
    models: [model('hybrid', { x: forcePoint[0], y: forcePoint[1], z: forcePoint[2] }), model('levitate', { x: forcePoint[0], y: forcePoint[1], z: forcePoint[2] })],
    structuralLimits: {
      hands: 'No separately articulated hand/finger rigid bodies. farm includes hand mass; visual hand sphere; main spherical grip and off-hand spring approximate grasp.',
      wristReaction: 'driveSword splits opposite torque between forearm and chest: forearm-axis twist goes directly to chest (fighter.js:1948-1956), an abstract transmission path; total opposite torque remains paired.',
      torso: 'Pelvis/abdomen/chest boxes with two spherical torso joints. No independent rib cage/scapula/clavicle chain or distributed spinal articulation in the measured topology.',
      collision: 'Self body/weapon collisions filtered; foot groups also omit enemy body/foot. Joint topology alone does not prevent anatomical penetration.',
      continuousExecution: 'Connected rigid bodies exist, but goals come from separate heading/balance/pose/arm/sword/grip controllers. Inventory alone cannot establish continuous human coordination.',
      note: 'Model limitations are confirmed representational omissions; severity of feel/physics consequences needs controlled dynamics and user assessment.' } };
  const h = result.models[0];
  result.consistency = {
    declaredBodyCountMatches: result.sourceComment.declaredRigidBodyCount === h.bodyCount,
    swordUpperIkMinusMeasuredM: result.ik.sword.upper - h.lengths.swordUpperM,
    swordForeIkMinusMeasuredM: result.ik.sword.fore - h.lengths.swordForeToGripM,
    offUpperIkMinusMeasuredM: result.ik.off.upper - h.lengths.offUpperM,
    offForeIkMinusMeasuredM: result.ik.off.fore - h.lengths.offForeToForcePointM,
    description: 'compare immutable body-local joint anchors and actual grip/force point, not moving world endpoint separation' };
  return result;
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('No options: fixed output docs/strike/body_model_inventory.json');
    const result = await inventory();
    await writeFile(ROOT + 'docs/strike/body_model_inventory.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ bodyCount: result.models[0].bodyCount, jointCount: result.models[0].anatomicalJointCount,
      consistency: result.consistency, footMass: result.models[0].footMass, torso: result.models[0].torso }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
