// Ancient standing Malayan sun bear. All detail is opaque stone in one merged mesh.
// Model space faces −Z; the default placement faces −X toward the duel camera.
import * as THREE from 'three';
import { Kit, h3 } from './stage_kit.js';

export const SLUICE_BEAR_POSITION = Object.freeze([0, 0, 0]);
export const SLUICE_BEAR_ROTATION_Y = Math.PI / 2;
export const BEAR_AVOID_RADIUS = 1.35;
export const BEAR_GROUND_RADIUS = BEAR_AVOID_RADIUS;

const TAU = Math.PI * 2;
const STONE = 0x929292;
const DARK_STONE = 0x656565;
const MOSS = 0x777777;
const COLLAR_STONE = 0x9c9c9c;
const MUZZLE_STONE = 0x9d9d9d;

// Model space faces −Z. The rounded abdomen is wider than the sloping
// shoulders; a short thick neck blends into the small sun-bear head.
const BODY = [
  [1.57, 0.3, 0.24, 0, 0.13], [1.67, 0.52, 0.36, 0, 0.13],
  [1.91, 0.74, 0.48, 0, 0.115], [2.3, 0.9, 0.59, 0, 0.09],
  [2.73, 0.935, 0.635, 0, 0.075], [3.17, 0.905, 0.61, 0, 0.065],
  [3.59, 0.85, 0.54, 0, 0.06], [3.95, 0.785, 0.48, 0, 0.055],
  [4.25, 0.66, 0.42, 0, 0.05], [4.5, 0.52, 0.375, 0, 0.04],
  [4.69, 0.445, 0.34, 0, 0.015],
];
const HEAD = [
  [4.48, 0.32, 0.26, 0, 0.025], [4.65, 0.38, 0.31, 0, 0.01],
  [4.87, 0.48, 0.385, 0, -0.015], [5.13, 0.57, 0.425, 0, -0.02],
  [5.37, 0.54, 0.405, 0, 0.005], [5.57, 0.445, 0.335, 0, 0.025],
  [5.7, 0.3, 0.22, 0, 0.04], [5.755, 0.105, 0.085, 0, 0.045],
];
const LEG = [
  [0.21, 0.155, 0.22, 0.85, 0.045], [0.48, 0.18, 0.25, 0.84, 0.08],
  [0.88, 0.235, 0.29, 0.76, 0.125], [1.23, 0.285, 0.34, 0.64, 0.14],
  [1.61, 0.335, 0.39, 0.49, 0.13], [1.94, 0.325, 0.36, 0.39, 0.115],
  [2.12, 0.24, 0.275, 0.34, 0.1],
];
const FOOT = [
  [0.115, 0.235, 0.355, 0.89, -0.17], [0.21, 0.27, 0.395, 0.91, -0.18],
  [0.335, 0.255, 0.33, 0.89, -0.11], [0.46, 0.155, 0.22, 0.835, 0.025],
];
const ARM = [
  [2.25, 0.165, 0.2, 1.005, -0.2], [2.59, 0.2, 0.245, 1.04, -0.12],
  [3.03, 0.225, 0.275, 1.015, -0.035], [3.45, 0.25, 0.295, 0.925, 0.035],
  [3.82, 0.265, 0.265, 0.79, 0.075], [4.09, 0.215, 0.21, 0.66, 0.085],
  [4.23, 0.125, 0.14, 0.59, 0.075],
];
const HANGING_PAW = [
  [2.115, 0.145, 0.17, 0.965, -0.255], [2.28, 0.21, 0.225, 0.985, -0.25],
  [2.47, 0.2, 0.23, 1.015, -0.21], [2.64, 0.16, 0.19, 1.035, -0.165],
];
const mirrorRings = (rings, side) => rings.map(([y, rx, rz, x, z]) => [y, rx, rz, x * side, z]);

function obstacleShapes(position, rotationY) {
  const sin = Math.sin(rotationY), cos = Math.cos(rotationY);
  const world = ([x, y, z]) => [x * cos + z * sin + position[0], y + position[1], z * cos - x * sin + position[2]];
  const capsule = (name, start, end, radius) => {
    const a = world(start), b = world(end), delta = b.map((v, i) => v - a[i]);
    const length = Math.hypot(...delta), [x, y, z] = delta.map(v => v / length);
    const qLength = Math.hypot(z, -x, 1 + y);
    return Object.freeze({ name, type: 'capsule', radius, halfHeight: length * 0.5,
      center: Object.freeze(a.map((v, i) => (v + b[i]) * 0.5)),
      rotation: Object.freeze({ x: z / qLength, y: 0, z: -x / qLength, w: (1 + y) / qLength }) });
  };
  const cuboid = (name, center, halfExtents) => Object.freeze({ name, type: 'cuboid',
    center: Object.freeze(world(center)), halfExtents: Object.freeze(halfExtents),
    rotation: Object.freeze({ x: 0, y: Math.sin(rotationY * 0.5), z: 0, w: Math.cos(rotationY * 0.5) }) });
  const shapes = [Object.freeze({ name: 'bear-footing', type: 'cylinder',
    center: Object.freeze(world([0, 0.06, 0])), halfHeight: 0.06, radius: 1.25 })];
  for (const side of [-1, 1]) shapes.push(capsule(`bear-hindleg-${side < 0 ? 'left' : 'right'}`,
    [side * 0.845, 0.425, -0.18], [side * 0.455, 1.825, 0.12], 0.285));
  shapes.push(cuboid('bear-torso', [0, 2.93, 0.08], [0.89, 1.25, 0.62]));
  shapes.push(capsule('bear-head', [0, 4.6, -0.02], [0, 5.205, -0.02], 0.55));
  for (const side of [-1, 1]) shapes.push(capsule(`bear-forelimb-${side < 0 ? 'left' : 'right'}`,
    [side * 1.01, 2.2, -0.22], [side * 0.83, 3.91, 0.06], 0.235));
  shapes.push(capsule('bear-muzzle', [0, 5.045, -0.53], [0, 5.045, -0.735], 0.195));
  return Object.freeze(shapes);
}

// Pure data at [0,0,0], facing −X: WORLD centers and quaternion orientations.
// Apply each shape's center/rotation directly; do not rotate the group again.
// Capsule halfHeight is the half-length of its segment, excluding round caps.
// Cuboid halfExtents are along that shape's axes, before its supplied rotation.
// The thin ear tips and tiny worn surface chips intentionally have no collider.
export const BEAR_OBSTACLE_SHAPES = obstacleShapes(SLUICE_BEAR_POSITION, SLUICE_BEAR_ROTATION_Y);

// Each ring is [height, halfWidth, halfDepth, centerX, centerZ]. Changing
// silhouettes through the rings makes a carved animal, rather than spheres.
function carvedLoft(rings, sides = 14, square = 0.94) {
  const positions = [], indices = [];
  rings.forEach(([y, rx, rz, cx = 0, cz = 0]) => {
    for (let i = 0; i < sides; i++) {
      const a = i / sides * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      positions.push(cx + Math.sign(c) * Math.abs(c) ** square * rx, y,
        cz + Math.sign(s) * Math.abs(s) ** square * rz);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i, b = j * sides + (i + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  for (let i = 1; i < sides - 1; i++) {
    indices.push(0, i, i + 1);
    const top = (rings.length - 1) * sides;
    indices.push(top, top + i + 1, top + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function part(kit, geometry, color = STONE, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, options = {}) {
  kit.put('bear', geometry, color, position, rotation, scale, {
    rough: 0.008, vary: 0.025, noise: 0.035,
    uv: 'box', uvScale: 0.56, snow: 0.085, snowColor: MOSS,
    ...options,
  });
  geometry.dispose();
}

function oval(kit, position, scale, color = STONE, rotation = [0, 0, 0], options = {}) {
  part(kit, new THREE.SphereGeometry(1, 12, 7), color, position, rotation, scale, options);
}

function incision(kit, points, radius = 0.015, color = DARK_STONE) {
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
    const delta = b.clone().sub(a);
    const matrix = new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, delta.clone().normalize()), new THREE.Vector3(1, 1, 1));
    const geometry = new THREE.CylinderGeometry(radius * 0.7, radius, delta.length(), 5, 1, false);
    kit.putM('bear', geometry, color, matrix, { vary: 0.03, noise: 0.025 });
    geometry.dispose();
  }
}

// The identifying U is a thin, shallow relief in the same grey stone.
// Its small value difference catches the light without colored inlay.
function chestCrescent() {
  const positions = [], indices = [], steps = 18;
  const chestZ = (x, y) => {
    let i = 0;
    while (i < BODY.length - 2 && y > BODY[i + 1][0]) i++;
    const a = BODY[i], b = BODY[i + 1], t = (y - a[0]) / (b[0] - a[0]);
    const rx = THREE.MathUtils.lerp(a[1], b[1], t);
    const rz = THREE.MathUtils.lerp(a[2], b[2], t);
    const cz = THREE.MathUtils.lerp(a[4], b[4], t);
    return cz - rz * Math.max(0, 1 - (Math.abs(x) / rx) ** (2 / 0.94)) ** (0.94 / 2) - 0.018;
  };
  for (let i = 0; i <= steps; i++) {
    const a = 0.025 + i / steps * (Math.PI - 0.05), c = Math.cos(a), s = Math.sin(a);
    const outer = [-(0.57 + 0.025 * s) * c, 4.13 - 0.48 * s];
    const inner = [-(0.57 - 0.03 * s) * c, 4.13 - 0.35 * s];
    for (const [x, y] of [outer, inner]) positions.push(x, y, chestZ(x, y));
    if (i < steps) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function sculptBear(kit) {
  const headPieces = [];
  // Low circular stone footing leaves walkable ground all around the idol.
  part(kit, carvedLoft([
    [0, 1.24, 1.24], [0.055, 1.25, 1.25], [0.095, 1.2, 1.2], [0.12, 1.12, 1.12],
  ], 16), 0x858585, [0, 0, 0], [0, 0, 0], 1, { rough: 0.006, snow: 0.5 });

  // Two distinct weight-bearing hindlegs and long plantigrade hindpaws make
  // this an upright bear, not a seated idol or a person with a bear's head.
  for (const side of [-1, 1]) {
    part(kit, carvedLoft(mirrorRings(LEG, side), 18), 0x909090);
    part(kit, carvedLoft(mirrorRings(FOOT, side), 16, 0.91), 0x929292);
    for (let toe = -1; toe <= 2; toe++) {
      const x = side * 0.91 + (toe - 0.5) * 0.09;
      incision(kit, [[x, 0.195, -0.553], [x, 0.31, -0.438], [x, 0.345, -0.345]], 0.01);
    }
  }
  part(kit, carvedLoft(BODY, 24));
  part(kit, chestCrescent(), COLLAR_STONE, [0, 0, 0], [0, 0, 0], 1,
    { rough: 0.002, vary: 0.025, noise: 0.025, snow: 0.025 });

  for (const side of [-1, 1]) {
    // The sun-bear forelimbs hang outside the rounded abdomen; their wrists
    // bend slightly inward and their small paws end beside the lower belly.
    part(kit, carvedLoft(mirrorRings(ARM, side), 16), 0x919191);
    part(kit, carvedLoft(mirrorRings(HANGING_PAW, side), 14, 0.92), 0x909090);
    for (let toe = -1; toe <= 2; toe++) {
      const x = side * 0.975 + (toe - 0.5) * 0.078;
      incision(kit, [[x, 2.16, -0.401], [x, 2.29, -0.471], [x, 2.4, -0.45]], 0.008, 0x777777);
      part(kit, new THREE.ConeGeometry(0.039, 0.165, 6), 0x868686,
        [x, 2.05, -0.378], [-0.14, 0, Math.PI], 1, { rough: 0.002, snow: 0 });
    }
    const earStart = kit.bins.bear.length;
    // The little flattened ears merge into the upper sides of the skull.
    // Their tops barely rise above the crown, avoiding a cartoon silhouette.
    oval(kit, [side * 0.445, 5.555, 0.045], [0.146, 0.171, 0.095], STONE,
      [0, side * -0.13, side * -0.46]);
    oval(kit, [side * 0.451, 5.564, -0.042], [0.075, 0.093, 0.015], 0x7b7b7b,
      [0, side * -0.13, side * -0.46], { rough: 0.002, snow: 0.025 });
    headPieces.push(...kit.bins.bear.slice(earStart));
  }
  // A fixed stone neck collar penetrates both the torso and turned skull.
  // This overlap closes the wedge that a rotated, tapered head otherwise opens.
  part(kit, carvedLoft([
    [4.28, 0.59, 0.39, 0, 0.04], [4.52, 0.53, 0.39, -0.02, 0.035],
    [4.73, 0.465, 0.35, -0.04, 0.025], [4.96, 0.36, 0.29, -0.055, 0.015],
  ], 24), STONE, [0, 0, 0], [0, 0, 0], 1, { rough: 0.004 });
  const faceStart = kit.bins.bear.length;
  part(kit, carvedLoft(HEAD, 22, 1.04), STONE);

  // The reference has a compact muzzle about half the head width. Its
  // short lower jaw, small open eyes and neutral mouth avoid a smiling mask.
  part(kit, carvedLoft([
    [0, 0.283, 0.225], [0.095, 0.3, 0.204], [0.195, 0.265, 0.163],
    [0.265, 0.21, 0.127], [0.288, 0.173, 0.102],
  ], 18, 1.02), MUZZLE_STONE, [0, 5.135, -0.388], [-Math.PI / 2, 0, 0], 1,
    { rough: 0.004, snow: 0.015, noise: 0.025 });
  // The rounded triangular nose is only about 23% of the skull width.
  part(kit, carvedLoft([
    [5.148, 0.046, 0.032, 0, -0.724], [5.192, 0.101, 0.048, 0, -0.737],
    [5.248, 0.132, 0.05, 0, -0.73], [5.284, 0.095, 0.035, 0, -0.713],
  ], 14, 1.01), 0x707070, [0, 0, 0], [0, 0, 0], 1, { rough: 0.002, snow: 0 });
  // Conform the dark eye cuts to the skull, with no protruding eye spheres.
  const eyeSurface = new THREE.Mesh(carvedLoft(HEAD, 22, 1.04),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const eyeRay = new THREE.Raycaster(), eyeSegments = 16;
  for (const side of [-1, 1]) {
    const positions = [], indices = [];
    const eyePoint = (x, y) => {
      eyeRay.set(new THREE.Vector3(x, y, -2), new THREE.Vector3(0, 0, 1));
      const hit = eyeRay.intersectObject(eyeSurface, false)[0];
      positions.push(x, y, (hit?.point.z ?? -0.34) - 0.005);
    };
    eyePoint(side * 0.276, 5.372);
    for (let i = 0; i < eyeSegments; i++) {
      const a = i / eyeSegments * TAU;
      eyePoint(side * 0.276 + Math.cos(a) * 0.044, 5.372 + Math.sin(a) * 0.034);
      indices.push(0, (i + 1) % eyeSegments + 1, i + 1);
    }
    const eye = new THREE.BufferGeometry();
    eye.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    eye.setIndex(indices); eye.computeVertexNormals();
    part(kit, eye, 0x626262, [0, 0, 0], [0, 0, 0], 1, { rough: 0, snow: 0, vary: 0.01 });
    oval(kit, [side * 0.066, 5.228, -0.776], [0.022, 0.015, 0.005], 0x5d5d5d,
      [0, side * -0.15, 0], { rough: 0.001, snow: 0 });
    incision(kit, [[0, 5.026, -0.676], [side * 0.135, 5.026, -0.66]], 0.006, 0x797979);
  }
  eyeSurface.geometry.dispose(); eyeSurface.material.dispose();
  // Restrained fractures preserve the identity of an ancient stone idol.
  incision(kit, [[0.45, 5.49, -0.235], [0.415, 5.39, -0.316], [0.46, 5.31, -0.338]], 0.008, 0x777777);
  headPieces.push(...kit.bins.bear.slice(faceStart));
  // The photographed animal looks slightly to its right, with a small head
  // tilt. Transform only the face/skull/ears; the body and colliders stay fixed.
  const pivot = new THREE.Vector3(0, 5.12, 0);
  const turn = new THREE.Matrix4().makeTranslation(...pivot.toArray())
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0.28, -0.075, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
  for (const geometry of headPieces) geometry.applyMatrix4(turn);
  incision(kit, [[-0.37, 2.98, -0.48], [-0.32, 2.76, -0.478],
    [-0.38, 2.54, -0.438], [-0.3, 2.37, -0.431]], 0.009, 0x777777);
  incision(kit, [[0.81, 0.11, -0.735], [0.73, 0.112, -0.82],
    [0.75, 0.07, -0.95]], 0.012, 0x777777);
}

/** Render-only helper. The caller creates colliders from the returned shapes. */
export function buildSluiceBear(scene, {
  stoneMap = null,
  position = SLUICE_BEAR_POSITION,
  rotationY = SLUICE_BEAR_ROTATION_Y,
} = {}) {
  const kit = new Kit(64371);
  sculptBear(kit);
  const material = new THREE.MeshStandardMaterial({
    map: stoneMap, vertexColors: true, roughness: 1, metalness: 0,
  });
  const mesh = kit.mesh('bear', material, { cast: true, receive: true });
  mesh.name = 'sluice-ancient-standing-bear';

  // Flood discoloration is continuous across pieces. Broad patches soften
  // the waterline and moss follows upward stone faces plus damp foot crevices.
  const positions = mesh.geometry.attributes.position;
  const normals = mesh.geometry.attributes.normal;
  const colors = mesh.geometry.attributes.color;
  const color = new THREE.Color(), damp = new THREE.Color(0x727272), moss = new THREE.Color(MOSS);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const patch = 0.5 + Math.sin(x * 2.1 + z * 1.7) * Math.cos(y * 1.8 + z * 0.8) * 0.5;
    const flood = 1 - THREE.MathUtils.smoothstep(y, 0.62 + patch * 0.16, 1.4 + patch * 0.21);
    color.fromBufferAttribute(colors, i).lerp(damp, flood * 0.3);
    const upper = THREE.MathUtils.smoothstep(normals.getY(i), 0.3, 0.9);
    const growth = THREE.MathUtils.smoothstep(patch, 0.51, 0.83) * (upper * 0.16 + flood * 0.2);
    color.lerp(moss, growth);
    const streak = Math.sin(x * 15.7 + z * 9.3) > 0.92 ? 0.035 : 0;
    color.multiplyScalar(1 - streak * (0.6 + h3(x, 0, z, 419) * 0.4));
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  colors.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  scene.add(mesh);
  for (const geometries of Object.values(kit.bins)) {
    for (const geometry of geometries) geometry.dispose();
  }

  const footprint = {
    position: [...position], rotationY, groundRadius: BEAR_GROUND_RADIUS,
    shapes: obstacleShapes(position, rotationY),
  };
  const triangleCount = (mesh.geometry.index?.count ?? positions.count) / 3;
  mesh.userData.sluiceBear = { triangleCount, footprint };
  return { mesh, footprint, triangleCount };
}
