// Ancient seated marsh bear. All detail is opaque stone in one merged mesh.
// Model space faces −Z; the default placement faces −X toward the duel camera.
import * as THREE from 'three';
import { Kit, h3 } from './stage_kit.js';

export const SLUICE_BEAR_POSITION = Object.freeze([12.5, 0, -1]);
export const SLUICE_BEAR_ROTATION_Y = Math.PI / 2;

const TAU = Math.PI * 2;
const STONE = 0x929a90;
const LIGHT_STONE = 0xa3aa9e;
const DARK_STONE = 0x626f63;
const MOSS = 0x637448;

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
    uv: 'box', uvScale: 0.56, snow: 0.17, snowColor: MOSS,
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

function sculptBear(kit) {
  // A low, chipped octagonal footing sits in the mud; its skirt is flooded.
  part(kit, carvedLoft([
    [-0.04, 2.34, 1.86, 0, -0.03], [0.12, 2.33, 1.87, 0, -0.03],
    [0.35, 2.25, 1.81, 0.025, -0.01], [0.46, 2.12, 1.7, 0.025, -0.01],
  ], 10, 0.88), 0x7e8b79, [0, 0, 0], [0, 0, 0], 1, { rough: 0.048, snow: 0.5 });

  // Broad rump, weight-bearing belly and continuous shoulder hump. The head
  // grows straight from this mass, with no human neck, waist or upright legs.
  part(kit, carvedLoft([
    [0.48, 0.83, 0.66, 0, 0.35], [0.77, 1.29, 0.94, 0, 0.31],
    [1.4, 1.43, 1.06, 0, 0.26], [2.25, 1.33, 1.07, 0, 0.19],
    [3.15, 1.26, 1.02, 0, 0.13], [3.94, 1.36, 0.97, 0, 0.15],
    [4.43, 1.37, 0.86, 0, 0.2], [4.83, 1.13, 0.75, 0, 0.18],
    [5.22, 0.88, 0.66, 0, 0.06], [5.46, 0.51, 0.47, 0, -0.03],
  ], 18));

  for (const side of [-1, 1]) {
    // Folded rear haunches sit behind the forelimbs, low and splayed outward.
    part(kit, carvedLoft([
      [0.5, 0.41, 0.49, side * 1.2, 0.43],
      [0.84, 0.65, 0.77, side * 1.25, 0.46],
      [1.39, 0.72, 0.86, side * 1.25, 0.47],
      [1.91, 0.6, 0.72, side * 1.19, 0.48],
      [2.37, 0.39, 0.48, side * 1.02, 0.46],
      [2.54, 0.17, 0.26, side * 0.95, 0.42],
    ], 12), 0x8b9589);

    // Heavy uninterrupted forelegs, wide at the elbow and planted on paws.
    part(kit, carvedLoft([
      [0.66, 0.4, 0.51, side * 1.22, -0.87],
      [1.12, 0.48, 0.54, side * 1.3, -0.77],
      [1.9, 0.48, 0.55, side * 1.43, -0.57],
      [2.71, 0.5, 0.57, side * 1.49, -0.33],
      [3.49, 0.58, 0.56, side * 1.38, -0.1],
      [4.06, 0.58, 0.52, side * 1.2, 0.04],
      [4.47, 0.38, 0.38, side * 1.09, 0.08],
    ], 12), 0x979f91);

    // Flattened five-toed front paws, not hands. Toe grooves are cuts in stone.
    part(kit, carvedLoft([
      [0.45, 0.43, 0.64, side * 1.23, -1.08],
      [0.58, 0.54, 0.76, side * 1.23, -1.08],
      [0.86, 0.52, 0.72, side * 1.23, -1.07],
      [1.09, 0.36, 0.5, side * 1.24, -0.88],
    ], 12, 0.65), 0x949e8f);
    part(kit, carvedLoft([
      [0.45, 0.36, 0.59, side * 1.59, -0.23],
      [0.58, 0.48, 0.72, side * 1.58, -0.25],
      [0.8, 0.44, 0.64, side * 1.53, -0.18],
      [1.07, 0.26, 0.39, side * 1.47, 0.02],
    ], 10, 0.74), 0x879480);
    for (let toe = -1; toe <= 2; toe++) {
      const x = side * 1.23 + (toe - 0.5) * 0.19;
      incision(kit, [[x, 0.77, -1.765], [x, 0.89, -1.55], [x, 0.93, -1.37]], 0.014);
    }

    // Broad short bear skull and small rounded ears, with a shaded carved cup.
    oval(kit, [side * 0.87, 6.46, 0.015], [0.43, 0.47, 0.245], 0x949d91,
      [0, side * -0.09, side * -0.13]);
    oval(kit, [side * 0.87, 6.49, -0.207], [0.267, 0.292, 0.043], DARK_STONE,
      [0, side * -0.09, side * -0.13], { rough: 0.008, snow: 0.06 });
  }

  part(kit, carvedLoft([
    [4.98, 0.56, 0.49, 0, -0.12], [5.2, 0.8, 0.64, 0, -0.22],
    [5.56, 0.98, 0.76, 0, -0.24], [5.94, 1.025, 0.76, 0, -0.18],
    [6.25, 0.91, 0.64, 0, -0.09], [6.48, 0.64, 0.43, 0, 0],
    [6.59, 0.25, 0.2, 0, 0.03],
  ], 16, 0.87), LIGHT_STONE);

  // The muzzle projects well beyond the small eyes; a wide blunt nose and
  // closed carved jaw keep the silhouette unmistakably ursine from the side.
  part(kit, carvedLoft([
    [0, 0.68, 0.415], [0.28, 0.67, 0.365], [0.59, 0.49, 0.29],
    [0.79, 0.36, 0.225], [0.82, 0.3, 0.16],
  ], 12, 0.72), 0xabb0a0, [0, 5.47, -0.75], [-Math.PI / 2, 0, 0]);
  oval(kit, [0, 5.55, -1.589], [0.35, 0.23, 0.155], 0x536258,
    [0, 0, 0], { rough: 0.008, snow: 0.015 });
  for (const side of [-1, 1]) {
    oval(kit, [side * 0.626, 5.93, -0.837], [0.192, 0.124, 0.064], 0x4b5a50,
      [0, side * -0.52, side * -0.1], { rough: 0.005, snow: 0 });
    oval(kit, [side * 0.626, 5.93, -0.879], [0.092, 0.061, 0.048], 0x707c69,
      [0, side * -0.52, 0], { rough: 0.003, snow: 0 });
    // A worn brow ridge casts a real shadow over each recessed eye.
    oval(kit, [side * 0.636, 6.075, -0.806], [0.34, 0.12, 0.13], LIGHT_STONE,
      [0, side * -0.52, side * 0.13], { rough: 0.015, snow: 0.19 });
    incision(kit, [[side * 0.03, 5.265, -1.518], [side * 0.29, 5.23, -1.43],
      [side * 0.51, 5.265, -1.23]], 0.018, 0x6f7767);
  }

  // Restrained masonry fractures and a worn chevron at the throat. They are
  // geometry rather than decals and share the same opaque material.
  incision(kit, [[0.71, 6.29, -0.587], [0.65, 6.16, -0.71],
    [0.72, 6.04, -0.761]], 0.013, 0x6f7b6a);
  incision(kit, [[-0.73, 3.49, -0.704], [-0.52, 3.1, -0.827],
    [-0.59, 2.77, -0.84], [-0.44, 2.57, -0.888]], 0.012, 0x73806d);
  incision(kit, [[-0.59, 4.47, -0.573], [-0.34, 4.24, -0.74],
    [0, 4.0, -0.831], [0.34, 4.24, -0.74], [0.59, 4.47, -0.573]], 0.016, 0x737f6d);
  incision(kit, [[1.68, 0.365, -0.99], [1.56, 0.385, -1.19],
    [1.61, 0.36, -1.35], [1.47, 0.24, -1.6]], 0.016, 0x53684d);
}

/** Render-only helper. The caller creates colliders from the returned boxes. */
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
  mesh.name = 'sluice-ancient-seated-bear';

  // Flood discoloration is continuous across pieces. Broad patches soften
  // the waterline and moss follows upward stone faces plus damp foot crevices.
  const positions = mesh.geometry.attributes.position;
  const normals = mesh.geometry.attributes.normal;
  const colors = mesh.geometry.attributes.color;
  const color = new THREE.Color(), damp = new THREE.Color(0x53694e), moss = new THREE.Color(MOSS);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const patch = 0.5 + Math.sin(x * 2.1 + z * 1.7) * Math.cos(y * 1.8 + z * 0.8) * 0.5;
    const flood = 1 - THREE.MathUtils.smoothstep(y, 0.62 + patch * 0.16, 1.4 + patch * 0.21);
    color.fromBufferAttribute(colors, i).lerp(damp, flood * 0.48);
    const upper = THREE.MathUtils.smoothstep(normals.getY(i), 0.3, 0.9);
    const growth = THREE.MathUtils.smoothstep(patch, 0.51, 0.83) * (upper * 0.28 + flood * 0.2);
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

  // Broad simple volumes intentionally avoid complex mesh collision. Centers
  // and half extents are in local model space; position/rotation match render.
  const footprint = {
    position: [...position], rotationY,
    boxes: [
      { name: 'footing', center: [0, 0.2, -0.03], halfExtents: [2.28, 0.25, 1.83] },
      { name: 'body', center: [0, 2.53, -0.06], halfExtents: [1.94, 2.07, 1.41] },
      { name: 'head', center: [0, 5.68, -0.34], halfExtents: [1.27, 1.25, 1.24] },
    ],
  };
  const triangleCount = (mesh.geometry.index?.count ?? positions.count) / 3;
  mesh.userData.sluiceBear = { triangleCount, footprint };
  return { mesh, footprint, triangleCount };
}
