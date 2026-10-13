// Ancient standing Malayan sun bear. All detail is opaque stone in one merged mesh.
// Model space faces −Z; the default placement faces −X toward the duel camera.
import * as THREE from 'three';
import { Kit, h3 } from './stage_kit.js';

export const SLUICE_BEAR_POSITION = Object.freeze([0, 0, 0]);
export const SLUICE_BEAR_ROTATION_Y = Math.PI / 2;
export const BEAR_AVOID_RADIUS = 1.35;
export const BEAR_GROUND_RADIUS = BEAR_AVOID_RADIUS;

const TAU = Math.PI * 2;
const STONE = 0x444941;
const LIGHT_STONE = 0x50544a;
const DARK_STONE = 0x292f29;
const MOSS = 0x4e5d3c;
const OCHRE_STONE = 0xc0a777;
const MUZZLE_STONE = 0xb9aa87;

// Sculpted cross sections in model space (forward = −Z).
const BODY = [
  [1.36, 0.52, 0.4, 0, 0.16], [1.78, 0.74, 0.5, 0, 0.14],
  [2.32, 0.84, 0.6, 0, 0.1], [2.92, 0.84, 0.6, 0, 0.05],
  [3.48, 0.9, 0.58, 0, 0.04], [3.94, 0.93, 0.51, 0, 0.07],
  [4.23, 0.8, 0.43, 0, 0.07], [4.48, 0.65, 0.37, 0, 0.035],
  [4.65, 0.43, 0.31, 0, -0.015],
];
const HEAD = [
  [4.47, 0.36, 0.3, 0, -0.02], [4.69, 0.5, 0.4, 0, -0.035],
  [4.98, 0.61, 0.465, 0, -0.025], [5.27, 0.625, 0.455, 0, 0.005],
  [5.48, 0.51, 0.37, 0, 0.04], [5.63, 0.33, 0.24, 0, 0.06],
  [5.69, 0.11, 0.095, 0, 0.065],
];
const LEG = [
  [0.13, 0.24, 0.3, 0.42, 0.07], [0.5, 0.25, 0.31, 0.43, 0.08],
  [0.94, 0.27, 0.34, 0.45, 0.15], [1.34, 0.35, 0.4, 0.43, 0.16],
  [1.72, 0.39, 0.42, 0.36, 0.13], [1.96, 0.3, 0.34, 0.31, 0.12],
];
const FOOT = [
  [0.115, 0.28, 0.45, 0.43, -0.17], [0.22, 0.32, 0.51, 0.43, -0.17],
  [0.41, 0.3, 0.47, 0.43, -0.14], [0.6, 0.21, 0.32, 0.43, -0.015],
];
const ARM = [
  [1.7, 0.18, 0.21, 0.93, -0.17], [2.02, 0.21, 0.24, 0.96, -0.12],
  [2.48, 0.225, 0.26, 0.99, -0.06], [2.94, 0.24, 0.27, 0.98, -0.015],
  [3.45, 0.27, 0.295, 0.91, 0.035], [3.93, 0.29, 0.275, 0.77, 0.065],
  [4.16, 0.19, 0.19, 0.67, 0.075],
];
const HANGING_PAW = [
  [1.33, 0.145, 0.18, 0.91, -0.255], [1.5, 0.22, 0.24, 0.935, -0.24],
  [1.74, 0.23, 0.25, 0.95, -0.215], [1.99, 0.175, 0.2, 0.96, -0.17],
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
    [side * 0.43, 0.42, -0.3], [side * 0.34, 1.66, 0.17], 0.31));
  shapes.push(cuboid('bear-torso', [0, 3.06, 0.055], [0.855, 1.48, 0.57]));
  shapes.push(capsule('bear-head', [0, 4.925, -0.03], [0, 5.115, -0.03], 0.65));
  for (const side of [-1, 1]) shapes.push(capsule(`bear-forelimb-${side < 0 ? 'left' : 'right'}`,
    [side * 0.94, 1.6, -0.23], [side * 0.85, 3.91, 0.04], 0.26));
  shapes.push(capsule('bear-muzzle', [0, 4.96, -0.62], [0, 4.96, -0.83], 0.17));
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
    rough: 0.018, vary: 0.035, noise: 0.045,
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

// The sun bear's identifying crescent is a broad U of worn pale ochre
// stone, inset into the actual curved chest rather than a floating necklace.
function chestCrescent() {
  const positions = [], indices = [], steps = 18;
  const chestZ = (x, y) => {
    let i = 0;
    while (i < BODY.length - 2 && y > BODY[i + 1][0]) i++;
    const a = BODY[i], b = BODY[i + 1], t = (y - a[0]) / (b[0] - a[0]);
    const rx = THREE.MathUtils.lerp(a[1], b[1], t);
    const rz = THREE.MathUtils.lerp(a[2], b[2], t);
    const cz = THREE.MathUtils.lerp(a[4], b[4], t);
    return cz - rz * Math.max(0, 1 - (Math.abs(x) / rx) ** (2 / 0.94)) ** (0.94 / 2) - 0.035;
  };
  for (let i = 0; i <= steps; i++) {
    const a = 0.025 + i / steps * (Math.PI - 0.05), c = Math.cos(a), s = Math.sin(a);
    const outer = [-(0.66 + 0.04 * s) * c, 4.21 - 0.66 * s];
    const inner = [-(0.66 - 0.15 * s) * c, 4.21 - 0.30 * s];
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
  // Low circular stone footing leaves walkable ground all around the idol.
  part(kit, carvedLoft([
    [0, 1.24, 1.24], [0.055, 1.25, 1.25], [0.095, 1.2, 1.2], [0.12, 1.12, 1.12],
  ], 16), 0x59624f, [0, 0, 0], [0, 0, 0], 1, { rough: 0.006, snow: 0.5 });

  // Two distinct weight-bearing hindlegs and long plantigrade hindpaws make
  // this an upright bear, not a seated idol or a person with a bear's head.
  for (const side of [-1, 1]) {
    part(kit, carvedLoft(mirrorRings(LEG, side)), 0x42493f);
    part(kit, carvedLoft(mirrorRings(FOOT, side), 12, 0.7), 0x464d40);
    for (let toe = -1; toe <= 2; toe++) {
      const x = side * 0.43 + (toe - 0.5) * 0.108;
      incision(kit, [[x, 0.28, -0.638], [x, 0.42, -0.503], [x, 0.46, -0.38]], 0.01);
    }
  }
  part(kit, carvedLoft(BODY, 18));
  part(kit, chestCrescent(), OCHRE_STONE, [0, 0, 0], [0, 0, 0], 1,
    { rough: 0.002, vary: 0.025, noise: 0.025, snow: 0.025 });

  for (const side of [-1, 1]) {
    // The long sun-bear forelimbs hang down beside the thighs, with their
    // paws below the belly. No lifted wrists or human hands at the chest.
    part(kit, carvedLoft(mirrorRings(ARM, side), 12), 0x464b42);
    part(kit, carvedLoft(mirrorRings(HANGING_PAW, side), 12, 0.76), 0x41483e);
    for (let toe = -1; toe <= 2; toe++) {
      const x = side * 0.935 + (toe - 0.5) * 0.075;
      incision(kit, [[x, 1.36, -0.398], [x, 1.51, -0.477], [x, 1.64, -0.468]], 0.009, 0x242b24);
    }
    // Tiny round ears sit against the head, not on tall mouse-like stalks.
    oval(kit, [side * 0.472, 5.592, 0.064], [0.173, 0.205, 0.124], 0x454b40,
      [0, side * -0.13, side * -0.1]);
    oval(kit, [side * 0.479, 5.6, -0.047], [0.088, 0.112, 0.019], DARK_STONE,
      [0, side * -0.13, side * -0.1], { rough: 0.003, snow: 0.025 });
  }
  part(kit, carvedLoft(HEAD, 16, 0.87), LIGHT_STONE);

  // A broad pale lower face, compact round skull and short blunt nose are
  // the sun bear's facial landmarks. The pale material is weathered inlay.
  part(kit, carvedLoft([
    [0, 0.43, 0.28], [0.14, 0.43, 0.253], [0.32, 0.335, 0.202],
    [0.44, 0.255, 0.155], [0.47, 0.22, 0.12],
  ], 12, 0.77), MUZZLE_STONE, [0, 4.94, -0.414], [-Math.PI / 2, 0, 0], 1,
    { snow: 0.02, noise: 0.035 });
  oval(kit, [0, 5.005, -0.898], [0.221, 0.139, 0.09], 0x252c27,
    [0, 0, 0], { rough: 0.005, snow: 0 });
  for (const side of [-1, 1]) {
    oval(kit, [side * 0.362, 5.231, -0.41], [0.099, 0.056, 0.03], 0x202720,
      [0, side * -0.48, side * -0.05], { rough: 0.003, snow: 0 });
    oval(kit, [side * 0.365, 5.303, -0.391], [0.168, 0.047, 0.056], LIGHT_STONE,
      [0, side * -0.48, side * 0.11], { rough: 0.006, snow: 0.04 });
    incision(kit, [[side * 0.02, 4.791, -0.843], [side * 0.185, 4.771, -0.805],
      [side * 0.319, 4.789, -0.674]], 0.01, 0x68694e);
  }
  // Restrained fractures preserve the identity of an ancient stone idol.
  incision(kit, [[0.45, 5.49, -0.235], [0.415, 5.39, -0.316], [0.46, 5.31, -0.338]], 0.008, 0x30382e);
  incision(kit, [[-0.37, 2.98, -0.48], [-0.32, 2.76, -0.478],
    [-0.38, 2.54, -0.438], [-0.3, 2.37, -0.431]], 0.009, 0x30392f);
  incision(kit, [[0.81, 0.11, -0.735], [0.73, 0.112, -0.82],
    [0.75, 0.07, -0.95]], 0.012, 0x53684d);
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
  const color = new THREE.Color(), damp = new THREE.Color(0x3a4b36), moss = new THREE.Color(MOSS);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const patch = 0.5 + Math.sin(x * 2.1 + z * 1.7) * Math.cos(y * 1.8 + z * 0.8) * 0.5;
    const flood = 1 - THREE.MathUtils.smoothstep(y, 0.62 + patch * 0.16, 1.4 + patch * 0.21);
    color.fromBufferAttribute(colors, i).lerp(damp, flood * 0.48);
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
