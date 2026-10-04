import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PISTOL_GRIP } from './weapon_looks.js';

// Display geometry only. Hand origins remain at the existing forearm anchors;
// an off hand reaching towards a weapon is never moved onto its target.
const MAIN_ANCHOR = new THREE.Vector3(0.13, 0, 0);
const OFF_ANCHOR = new THREE.Vector3(0, -0.135, 0);
const MAIN_DISTAL = new THREE.Vector3(1, 0, 0);
const OFF_DISTAL = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const PISTOL_ANGLE = THREE.MathUtils.degToRad(PISTOL_GRIP.deg);
// +y points towards the top of a grip, where the thumb meets the index side.
const PISTOL_AXIS = new THREE.Vector3(-Math.sin(PISTOL_ANGLE), -Math.cos(PISTOL_ANGLE), 0);

// Grip alpha/beta/theta and empty-hand choices adapted from yoonjl-svg/halfsword
// src/hands.js, commit 0b141acac19dcfe171d283c411ac164143d57962.
// Geometry, wrist anchoring and the pistol axis are implemented here separately.
const GRIPS = {
  _two: { a: 0, b: 15, t: 0, off: 'grip' },
  monohoshizao: { a: 0, b: 20, t: 0, off: 'grip' },
  frozen_tuna: { a: 0, b: 0, t: 0, off: 'grip' },
  sabre: { a: 0, b: 15, t: 60, off: 'fist' },
  falchion: { a: 0, b: 5, t: 0, off: 'fist' },
  rapier: { a: 0, b: 25, t: 70, off: 'open' },
  qinggang: { a: 0, b: 15, t: 0, off: 'fist' },
  tree_branch: { a: 0, b: 0, t: 0, off: 'fist' },
  rubber_chicken: { a: 0, b: 0, t: 0, off: 'fist' },
  morgenstern: { a: 0, b: 0, t: 0, off: 'fist' },
  pistol: { a: 0, b: 0, t: 0, off: 'open' },
  _one: { a: 0, b: 15, t: 0, off: 'fist' },
};

function mesh(group, geometry, material, position, scale) {
  const out = new THREE.Mesh(geometry, material);
  if (position) out.position.set(...position);
  if (scale) out.scale.set(...scale);
  out.castShadow = true;
  out.receiveShadow = true;
  group.add(out);
  return out;
}

function thumbSegment(group, material, from, to, radius) {
  const direction = to.clone().sub(from);
  const part = mesh(group, new THREE.CapsuleGeometry(radius, direction.length(), 3, 8), material);
  part.position.copy(from).add(to).multiplyScalar(0.5);
  part.quaternion.setFromUnitVectors(UP, direction.normalize());
  return part;
}

// One broad padded finger section, with a real opening along the grip axis.
// The thumb closes the side opening; no finger joints or colliders are added.
function gripShell(side, beta = 0) {
  const positions = [];
  const indices = [];
  const segments = 18;
  const gap = 0.72;
  const start = -Math.PI / 2 + gap / 2;
  const end = Math.PI * 1.5 - gap / 2;
  const slices = [-0.041, -0.032, 0.032, 0.041];
  for (let row = 0; row < slices.length; row++) {
    const round = row === 0 || row === slices.length - 1 ? 0.91 : 1;
    for (let i = 0; i <= segments; i++) {
      const a = start + ((end - start) * i) / segments;
      // Beta tilts the padded finger outline; the hole stays on the true grip
      // axis so a slanted handshake grip does not intersect the handle.
      positions.push(Math.cos(a) * 0.048 * round + Math.tan(beta) * slices[row] * 0.65, slices[row], Math.sin(a) * 0.037 * round * side);
      positions.push(Math.cos(a) * 0.022, slices[row], Math.sin(a) * 0.020 * side);
    }
  }
  const stride = (segments + 1) * 2;
  const quad = (a, b, c, d) => {
    if (side > 0) indices.push(a, d, b, b, d, c);
    else indices.push(a, b, d, b, c, d);
  };
  for (let row = 0; row < slices.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * stride + i * 2;
      quad(a, a + 2, a + stride + 2, a + stride);
      quad(a + 1, a + stride + 1, a + stride + 3, a + 3);
    }
    const first = row * stride;
    const last = first + segments * 2;
    quad(first, first + stride, first + stride + 1, first + 1);
    quad(last, last + 1, last + stride + 1, last + stride);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    quad(a, a + 1, a + 3, a + 2);
    const b = (slices.length - 1) * stride + a;
    quad(b, b + 2, b + 3, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergePart(group, material) {
  const geometries = [];
  for (const object of [...group.children]) {
    object.updateMatrix();
    const geometry = object.geometry.toNonIndexed();
    geometry.applyMatrix4(object.matrix);
    geometry.deleteAttribute('uv');
    geometries.push(geometry);
    object.geometry.dispose();
    group.remove(object);
  }
  const geometry = mergeGeometries(geometries);
  for (const part of geometries) part.dispose();
  return mesh(group, geometry, material);
}

function createHand(parent, anchor, distal, side, material, grip, isOff) {
  const root = new THREE.Group();
  root.name = side > 0 ? 'mitten-right' : 'mitten-left';
  root.position.copy(anchor);
  parent.add(root);

  const cuff = mesh(root, new THREE.CylinderGeometry(0.030, 0.036, 0.037, 10), material);
  cuff.position.copy(distal).multiplyScalar(-0.023);
  cuff.quaternion.setFromUnitVectors(UP, distal);

  const pose = new THREE.Group();
  root.add(pose);
  const closed = new THREE.Group();
  pose.add(closed);
  mesh(closed, gripShell(side, THREE.MathUtils.degToRad(isOff ? Math.min(grip.b, 10) : grip.b)), material);
  // Closed grip reference: palm block at -X faces the handle (+X), +Y is
  // the index/radial edge. Right fingers wrap from +Z to tips at the -Z gap;
  // the opposing thumb must start at +Z and close towards -Z. Left mirrors Z.
  // A symmetric capsule at -Z pointing +Z had reversed this opposition.
  const thumbExtension = isOff ? 0 : THREE.MathUtils.clamp(grip.t / 90, 0, 1);
  const thumbBase = new THREE.Vector3(-0.026, 0.022, side * 0.027);
  const thumbKnuckle = new THREE.Vector3(0.003, 0.042, side * 0.028)
    .lerp(new THREE.Vector3(-0.006, 0.050, side * 0.025), thumbExtension);
  const thumbTip = new THREE.Vector3(0.013, 0.036, -side * 0.016)
    .lerp(new THREE.Vector3(0.002, 0.080, side * 0.010), thumbExtension);
  mesh(closed, new THREE.SphereGeometry(1, 10, 7), material,
    thumbBase.toArray(), [0.021, 0.021, 0.020]);
  thumbSegment(closed, material, thumbBase, thumbKnuckle, 0.013);
  thumbSegment(closed, material, thumbKnuckle, thumbTip, 0.012);
  mesh(closed, new THREE.SphereGeometry(1, 10, 7), material, [-0.045, 0, 0], [0.013, 0.041, 0.032]);
  closed.rotation.y = THREE.MathUtils.degToRad(grip.a);
  mergePart(closed, material);

  const relaxed = new THREE.Group();
  pose.add(relaxed);
  // Open hand uses a different reference: fingers +X, radial/thumb edge +Y.
  // Right palmar normal is -Z (left +Z); do not mirror the whole hand to fix
  // the closed thumb, as that would invert this already consistent pose.
  mesh(relaxed, new THREE.SphereGeometry(1, 12, 8), material, [0.013, 0, 0], [0.044, 0.032, 0.020]);
  mesh(relaxed, new THREE.SphereGeometry(1, 10, 7), material, [0.044, -0.003, 0], [0.023, 0.028, 0.020]);
  const emptyThumb = mesh(relaxed, new THREE.CapsuleGeometry(0.012, 0.025, 3, 8), material, [0.011, 0.032, -side * 0.010]);
  emptyThumb.rotation.z = -0.78;
  emptyThumb.rotation.x = side * 0.25;
  mergePart(relaxed, material);

  const emptyFist = new THREE.Group();
  pose.add(emptyFist);
  // A lightly closed empty hand uses one padded finger mass, without a hole.
  mesh(emptyFist, new THREE.SphereGeometry(1, 10, 7), material, [0.005, 0, 0], [0.040, 0.038, 0.026]);
  const fistThumb = mesh(emptyFist, new THREE.CapsuleGeometry(0.012, 0.027, 3, 8), material, [0.022, 0.023, -side * 0.020]);
  fistThumb.rotation.z = -0.8;
  fistThumb.rotation.x = side * 0.8;
  mergePart(emptyFist, material);
  return { root, pose, closed, relaxed, emptyFist, distal };
}

function handSphere(group) {
  let sphere = null;
  group?.traverse((object) => {
    if (!sphere && object.isMesh && object.geometry?.type === 'SphereGeometry'
      && Math.abs((object.geometry.parameters?.radius ?? 0) - 0.042) < 0.002 && object.position.y < -0.1) sphere = object;
  });
  return sphere;
}

/**
 * Attach once after Fighter has constructed its body and weapon groups.
 * Call update after the existing syncMeshes loop and dispose before removal.
 * Reuses and hides the existing spheres, restoring their visibility on dispose.
 */
export function attachHandVisuals(fighter, look = {}) {
  // Three's UUID construction consumes Math.random. Keep all geometry/material
  // construction on a display-only stream, with zero game-stream draws.
  const realRandom = Math.random;
  let seed = (Math.imul((fighter.index ?? 0) + 1, 0x9e3779b1) ^ 0x48414e44) >>> 0;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  try {
    return buildHandVisuals(fighter, look);
  } finally {
    Math.random = realRandom;
  }
}

function buildHandVisuals(fighter, look) {
  if (!fighter.groups?.farmS || !fighter.groups?.farmO) return null;
  const spheres = [handSphere(fighter.groups.farmS), handSphere(fighter.groups.farmO)];
  const visibility = spheres.map((sphere) => sphere?.visible);
  const fallback = spheres.some((sphere) => !sphere) ? new THREE.MeshStandardMaterial({
    color: look.hands ?? look.skin ?? 0xc98f5e,
    roughness: 0.8,
    metalness: 0.02,
  }) : null;
  const grip = GRIPS[fighter.weapon?.id] ?? (fighter.weaponCfg?.twoHand ? GRIPS._two : GRIPS._one);
  // Fighter.side is explicitly +1 for a right-handed weapon arm in partDefs;
  // forearm pose/heading does not determine handedness.
  const side = fighter.side < 0 ? -1 : 1;
  const main = createHand(fighter.groups.farmS, MAIN_ANCHOR, MAIN_DISTAL, side, spheres[0]?.material ?? fallback, grip, false);
  const off = createHand(fighter.groups.farmO, OFF_ANCHOR, OFF_DISTAL, -side, spheres[1]?.material ?? fallback, grip, true);
  for (const sphere of spheres) if (sphere) sphere.visible = false;
  const inverse = new THREE.Quaternion();
  const relative = new THREE.Quaternion();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  let disposed = false;

  function orient(hand, forearm, gripping, fist = false) {
    hand.closed.visible = gripping;
    hand.relaxed.visible = !gripping && !fist;
    hand.emptyFist.visible = !gripping && fist;
    if (!gripping) {
      // Empty hands follow their own forearms, including a detached forearm.
      x.copy(hand.distal);
      y.set(hand === main ? 0 : 1, hand === main ? 1 : 0, 0);
      z.crossVectors(x, y).normalize();
      y.crossVectors(z, x).normalize();
    } else {
      inverse.copy(forearm.quaternion).invert();
      relative.copy(inverse).multiply(fighter.swordGroup.quaternion);
      y.copy(fighter.weapon?.gun ? PISTOL_AXIS : UP).applyQuaternion(relative).normalize();
      // Keep the palm on the arm side of the handle while showing its axis.
      x.copy(hand.distal).addScaledVector(y, -hand.distal.dot(y));
      if (x.lengthSq() < 1e-5) {
        x.set(1, 0, 0).applyQuaternion(relative);
        x.addScaledVector(y, -x.dot(y));
      }
      x.normalize();
      z.crossVectors(x, y).normalize();
      x.crossVectors(y, z).normalize();
    }
    basis.makeBasis(x, y, z);
    hand.pose.quaternion.setFromRotationMatrix(basis);
  }

  function update() {
    if (disposed) return;
    const armed = !!fighter.armed && !!fighter.swordGroup && !fighter.detachedParts?.has('farmS');
    orient(main, fighter.groups.farmS, armed);
    const offDetached = fighter.detachedParts?.has('farmO');
    orient(off, fighter.groups.farmO, armed && !!fighter.weaponCfg?.twoHand && !!fighter.gripping && !offDetached,
      armed && !offDetached && grip.off === 'fist');
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const hand of [main, off]) {
      hand.root.removeFromParent();
      hand.root.traverse((object) => object.geometry?.dispose());
    }
    for (let i = 0; i < spheres.length; i++) if (spheres[i]) spheres[i].visible = visibility[i];
    fallback?.dispose();
  }

  update();
  return { update, dispose, main: main.root, off: off.root };
}
