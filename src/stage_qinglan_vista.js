// Qinglan: a sunlit southern Chinese limestone gorge. This module owns only
// distant scenery; the fighting terrace, lighting and atmosphere live upstream.
import * as THREE from 'three';
import { Kit, rng } from './stage_kit.js';

const TAU = Math.PI * 2;
const WATER_Y = -25.6;
const ROCK = 0xbac0b8;
const LEAF = 0x40653a;

// Kit retains a copy for merging. Both the input and the retained copies are
// released here, leaving only the scene-owned merged geometries/materials.
class VistaKit extends Kit {
  putM(bin, geo, color, matrix, options = {}) {
    try { return super.putM(bin, geo, color, matrix, options); }
    finally { geo.dispose(); }
  }
}

function gridGeometry(columns, rows, point, reverse = false) {
  const positions = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    positions.push(...point(i / columns, j / rows));
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
    if (reverse) indices.push(a, c, b, b, c, d);
    else indices.push(a, b, c, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function rockColors(geometry, { base = -30, height = 60, distant = 0, arch = false, hill = false } = {}) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, c = geometry.attributes.color;
  const limestone = new THREE.Color(ROCK), vegetation = new THREE.Color(LEAF);
  const atmospheric = new THREE.Color(0x93b4b0), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), up = n.getY(i);
    const broad = Math.sin(x * 0.19 + z * 0.17) * Math.sin(y * 0.27 + z * 0.11);
    // Horizontal solution bands and long water-worn ribs have different scales.
    const bands = Math.sin(y * 0.71 + z * 0.055 + Math.sin(x * 0.15)) * (hill ? 0.014 : 0.10);
    const vein = Math.sin(z * 0.88 + Math.sin(y * 0.075) * 0.8 + x * 0.29);
    const grooves = Math.pow(Math.max(0, vein), 5) * (hill ? 0.15 : 0.33);
    const exposed = 0.5 + 0.5 * Math.sin(x * 0.18 + z * 0.27 + Math.sin(y * 0.12));
    const top = THREE.MathUtils.smoothstep((y - base) / height, 0.87, 0.98);
    const sideGrowth = hill ? Math.pow(Math.max(0, Math.sin(x * 0.12 + z * 0.17 + Math.sin(y * 0.075))
      * Math.sin(z * 0.13 - x * 0.055 + y * 0.042)), 2) * 0.60 : 0;
    const growth = arch
      ? THREE.MathUtils.smoothstep(up, 0.58, 0.9) * 0.68
      : THREE.MathUtils.clamp(top * 0.78 + THREE.MathUtils.smoothstep(up, 0.65, 0.95) * 0.23 + Math.max(0, broad - 0.15) * 0.22 + sideGrowth, 0, 0.95);
    color.copy(limestone).lerp(vegetation, growth);
    color.multiplyScalar(0.93 + bands - grooves + exposed * 0.15);
    color.lerp(atmospheric, distant);
    c.setXYZ(i, color.r, color.g, color.b);
  }
}

function archTop(z) {
  return -29 + 52 * Math.pow(Math.max(0.025, 1 - (z / 28.5) ** 2), 0.36)
    + 1.6 * Math.sin(z * 0.17 + 0.5) + 0.65 * Math.sin(z * 0.71);
}

function archBottom(z) {
  const opening = Math.pow(Math.max(0, 1 - ((z + 1.6) / 21.4) ** 2), 0.57);
  return -30 + 44.3 * opening + 0.55 * Math.sin(z * 0.54 + 1.7);
}

function naturalBridge(K) {
  // A continuous, irregular solid, swept across the gorge. Its cross section
  // flares into the banks; the aperture is genuinely empty all the way through.
  const bridge = gridGeometry(88, 32, (u, v) => {
    const z = -27.8 + u * 55.6, a = v * TAU;
    const lower = archBottom(z), upper = archTop(z);
    const mid = (upper + lower) * 0.5, half = (upper - lower) * 0.5;
    const depth = 8.4 + 5.4 * (Math.abs(z) / 28) ** 1.5 + Math.sin(z * 0.15 + 0.8) * 1.2;
    const fold = Math.sin(z * 0.78 + Math.sin(a * 2.0)) * 1.18
      + Math.sin(z * 1.71 - a * 3) * 0.42;
    return [90 + 2.4 * Math.sin(z * 0.09) + Math.cos(a) * (depth + fold),
      mid + Math.sin(a) * half + Math.cos(a) ** 2 * Math.sin(z * 0.66) * 0.5,
      z + Math.sin(a * 3 + z * 0.24) * 0.25];
  }, true);
  const g = K.put('bridge', bridge, ROCK, undefined, undefined, 1, { vary: 0, noise: 0 });
  rockColors(g, { arch: true });
  bridgeLedges(K);
  // The two open sweep ends lie completely inside these continuous abutments.
  karstHill(K, { x: 93, z: -33, rx: 19, rz: 18, h: 31, seed: 2, bin: 'bridge', base: -33 });
  karstHill(K, { x: 96, z: 34, rx: 22, rz: 19, h: 36, seed: 5, bin: 'bridge', base: -34 });
}

function bridgeLedges(K) {
  const positions = [];
  const point = (z, elevation, row) => {
    const y = elevation + Math.sin(z * 0.23) * 0.52 + Math.sin(z * 0.71) * 0.15;
    const lower = archBottom(z), upper = archTop(z), mid = (lower + upper) / 2;
    if (y < lower + 1.4 || y > upper - 1.4) return null;
    const half = (upper - lower) / 2;
    const depth = 8.4 + 5.4 * (Math.abs(z) / 28) ** 1.5 + Math.sin(z * 0.15 + 0.8) * 1.2;
    const a = Math.PI - Math.asin((y - mid) / half);
    const fold = Math.sin(z * 0.78 + Math.sin(a * 2)) * 1.18 + Math.sin(z * 1.71 - a * 3) * 0.42;
    const x = 90 + 2.4 * Math.sin(z * 0.09) + Math.cos(a) * (depth + fold);
    return [x + [0.45, -0.9, 0.3][row], y + [-0.48, 0.06, 0.34][row], z];
  };
  for (const elevation of [-23, -17, -10, -3, 5, 12, 18, 22]) {
    for (let i = 0; i < 92; i++) for (let row = 0; row < 2; row++) {
      const z = -27.6 + i * 0.6;
      const a = point(z, elevation, row), b = point(z + 0.6, elevation, row);
      const c = point(z, elevation, row + 1), d = point(z + 0.6, elevation, row + 1);
      if (a && b && c && d) positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const g = K.put('bridge', geometry, ROCK, undefined, undefined, 1, { vary: 0, noise: 0 });
  rockColors(g, { arch: true });
}

function karstHill(K, { x, z, rx, rz, h, seed, bin = 'hills', base = -31, distant = 0 }) {
  const detailed = bin !== 'farHills';
  const crag = Math.sin(seed * 2.91) > 0.58;
  const crownStart = 0.48 + (0.5 + Math.sin(seed * 1.13) * 0.5) * 0.28;
  const point = (u, v) => {
    const t = 1 - (1 - v) ** 1.35;
    const a = u * TAU;
    // Broad weathered foot, steep flanks, smoothly rounded crown. The width
    // remains substantial high on the hill: these are towers, never needles.
    const dome = t < crownStart ? 1 - t * 0.13 : (1 - crownStart * 0.13)
      * Math.sqrt(Math.max(0.0001, 1 - ((t - crownStart) / (1 - crownStart)) ** 2));
    const shoulder = crag ? Math.pow(Math.max(0.0001, 1 - t), 0.46) * (1 + Math.sin(t * 5.2) * 0.10) : dome;
    const foot = 1 + 0.37 * Math.exp(-t * 15);
    const lobe = 1 + Math.sin(a * 2 + seed) * 0.13
      + Math.sin(a * 3 + seed * 0.7 + t * 0.35) * 0.11;
    const channel = Math.pow(Math.max(0, Math.sin(a * 8 + seed + Math.sin(t * 2.3 + seed) * 0.22)), 3);
    const flute = 1 - channel * 0.18 + Math.sin(a * 13 + seed) * 0.028;
    const rr = shoulder * foot * lobe * flute;
    return [x + Math.cos(a) * rx * rr + Math.sin(seed) * rx * Math.pow(t, 1.45) * 0.32,
      base + h * t + Math.sin(a + seed * 2) * h * 0.13 * Math.sin(t * Math.PI) * t,
      z + Math.sin(a) * rz * rr + Math.cos(seed * 1.7) * rz * Math.pow(t, 1.55) * 0.27];
  };
  const g = gridGeometry(detailed ? 38 : 30, detailed ? 22 : 16, point, true);
  const placed = K.put(bin, g, ROCK, undefined, undefined, 1, { noise: 0, vary: 0 });
  rockColors(placed, { base, height: h, distant, hill: true });
  if (detailed) {
    const r = rng(Math.floor(seed * 13817) + 9137);
    const facing = Math.atan2(-z, -x);
    for (let cluster = 0; cluster < 3; cluster++) {
      const angle = facing + (r() - 0.5) * 1.7;
      const t = 0.26 + r() * 0.47;
      for (let crown = 0; crown < 3; crown++) {
        const a = angle + (crown - 1) * 0.065;
        const p = point(a / TAU, 1 - (1 - Math.min(0.95, t + crown * 0.012)) ** (1 / 1.35));
        const size = (1.4 + r() * 1.5) * (crag ? 0.75 : 1);
        K.put('leaves', new THREE.IcosahedronGeometry(1, crown === 0 ? 0 : 1), crown === 1 ? 0x537342 : LEAF,
          [p[0], p[1] + size * (0.15 + r() * 0.3), p[2]], [0, r() * TAU, 0.15],
          [size * 1.18, size * 0.8, size], { vary: 0.17, noise: 0.03 });
        K.hillsideCrowns = (K.hillsideCrowns ?? 0) + 1;
      }
    }
  }
}

function mountainLayers(K) {
  // The central low saddle lets the distant river remain visible through the
  // bridge. Successive groups have different widths, heights and spacing.
  const layers = [
    { bin: 'hills', haze: 0.10, hills: [
      [103, -66, 17, 19, 61], [117, -40, 14, 18, 54], [104, 66, 20, 19, 69],
      [126, 43, 16, 17, 49], [97, -101, 23, 22, 65], [116, 103, 25, 23, 54],
      [53, -105, 24, 25, 59], [39, 114, 26, 22, 64], [-46, -109, 25, 29, 56],
      [-106, -59, 27, 25, 62], [-98, 46, 25, 28, 57], [-43, 115, 27, 23, 55],
    ] },
    { bin: 'farHills', haze: 0.40, hills: [
      [148, -99, 24, 26, 79], [151, -58, 21, 21, 65],
      [166, 67, 23, 21, 67], [145, 116, 27, 24, 79], [84, -153, 29, 28, 68],
      [-10, -158, 28, 28, 78], [-139, -103, 33, 25, 73], [-151, 9, 28, 27, 63],
      [-109, 127, 31, 29, 70], [10, 164, 27, 30, 75], [92, 168, 30, 26, 67],
    ] },
    { bin: 'farHills', haze: 0.66, hills: [
      [202, -109, 30, 29, 80], [222, -66, 25, 23, 72], [244, 62, 25, 25, 58],
      [211, 104, 30, 29, 78], [186, 165, 32, 32, 82], [143, -178, 30, 31, 80],
      [-68, -211, 38, 31, 78], [-191, -116, 35, 32, 73], [-211, 60, 32, 35, 76],
      [-104, 194, 32, 32, 77], [45, 213, 35, 30, 81],
    ] },
  ];
  let count = 0;
  for (const layer of layers) for (const [x, z, rx, rz, h] of layer.hills) {
    karstHill(K, { x, z, rx, rz, h, distant: layer.haze, bin: layer.bin, seed: ++count * 1.73 });
  }
  return count;
}

function riverCurve() {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-126, WATER_Y, 59), new THREE.Vector3(-62, WATER_Y, 44),
    new THREE.Vector3(-6, WATER_Y, 36), new THREE.Vector3(30, WATER_Y, 28),
    new THREE.Vector3(55, WATER_Y, 8), new THREE.Vector3(88, WATER_Y, 2),
    new THREE.Vector3(123, WATER_Y, 13), new THREE.Vector3(165, WATER_Y, -10),
    new THREE.Vector3(208, WATER_Y, -8), new THREE.Vector3(270, WATER_Y, 10),
  ], false, 'catmullrom', 0.35);
}

function riverAndBanks(K) {
  const curve = riverCurve();
  const sample = (t, offset, y) => {
    const p = curve.getPoint(t), tangent = curve.getTangent(t);
    const length = Math.hypot(tangent.x, tangent.z);
    return [p.x - tangent.z / length * offset, y, p.z + tangent.x / length * offset];
  };
  const width = t => 7.3 + Math.sin(t * 13 + 0.7) * 1.5 + Math.sin(t * 31) * 0.5;
  const river = K.put('river', gridGeometry(148, 8, (t, across) =>
    sample(t, (across * 2 - 1) * width(t), WATER_Y), true), 0x428f80,
  undefined, undefined, 1, { vary: 0, noise: 0 });
  const colors = river.attributes.color;
  const p = river.attributes.position, deep = new THREE.Color(0x357c70), jade = new THREE.Color(0x71b6a0), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ripple = 0.5 + Math.sin(p.getX(i) * 0.1 + p.getZ(i) * 0.24) * 0.25;
    color.copy(deep).lerp(jade, ripple);
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  for (const side of [-1, 1]) {
    const bank = K.put('banks', gridGeometry(148, 12, (t, across) => {
      const outward = across * 48;
      const y = WATER_Y - 0.12 + Math.pow(across, 0.64) * 14
        + Math.sin(t * 32 + side) * across * 2.2 + Math.sin(across * 9 + t * 48) * across * 0.7;
      const point = sample(t, side * (width(t) * 0.99 + outward), y);
      const radius = Math.hypot(point[0], point[2]);
      if (radius < 25) { point[0] *= 25 / radius; point[2] *= 25 / radius; }
      return point;
    }, side > 0), ROCK, undefined, undefined, 1, { vary: 0, noise: 0 });
    rockColors(bank, { base: WATER_Y, height: 20 });
  }
  // Broken, long sun glints follow the current; geometry, not animated particles.
  const r = rng(746321);
  for (let i = 0; i < 35; i++) {
    const t = 0.14 + r() * 0.67, offset = (r() - 0.5) * width(t) * 1.35;
    const length = 0.002 + r() * 0.005, halfWidth = 0.025 + r() * 0.045;
    K.put('glints', gridGeometry(1, 1, (u, v) => sample(t + u * length, offset + (v - 0.5) * halfWidth, WATER_Y + 0.023)),
      0xb9d9be, undefined, undefined, 1, { vary: 0.12, noise: 0 });
  }
  return { x: 45, y: WATER_Y, z: 15 };
}

function bridgeVegetation(K) {
  const r = rng(88217);
  let count = 0;
  // Separated groves have interlocking angular crowns, exposed gaps and a few
  // taller shrubs; no repeated row of individually rounded skyline beads.
  for (const [center, spread, size] of [[-21, 3.0, 1.4], [-12, 2.1, 1.7], [-2, 3.4, 2.0], [9, 2.2, 1.5], [22, 3.2, 1.7]]) {
    for (let j = 0; j < 6; j++) {
      const z = center + (r() - 0.5) * spread;
      const x = 90 + 2.4 * Math.sin(z * 0.09) + (r() - 0.5) * 5.4;
      const s = size * (0.55 + r() * 0.65), y = archTop(z) - s * 0.3;
      K.put('leaves', new THREE.IcosahedronGeometry(1, j % 3 === 0 ? 0 : 1), j % 4 ? LEAF : 0x587743,
        [x, y + s * 0.35, z], [r() * 0.3, r() * TAU, r() * 0.2], [s * 1.24, s * (0.7 + r() * 0.5), s],
        { noise: 0.045, vary: 0.19 });
      count++;
    }
  }
  // Broad scrub masses at the foot visually join the bridge to the valley bank.
  for (const side of [-1, 1]) for (let i = 0; i < 27; i++) {
    const x = 70 + r() * 42, z = side * (26 + r() * 23), size = 1.3 + r() * 2.7;
    K.put('leaves', new THREE.IcosahedronGeometry(1, 1), LEAF,
      [x, -21.3 + r() * 1.0, z], [0, r() * TAU, 0], [size * 1.4, size * 0.68, size],
      { noise: 0.025, vary: 0.18 });
    count++;
  }
  return count;
}

export function buildQinglanVista(scene) {
  const K = new VistaKit(568231);
  const riverPos = riverAndBanks(K);
  const hills = mountainLayers(K);
  naturalBridge(K);
  const vegetation = bridgeVegetation(K) + (K.hillsideCrowns ?? 0);
  const materials = {
    bridge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true }),
    hills: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    farHills: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    banks: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    leaves: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    river: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.06, side: THREE.DoubleSide }),
    glints: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };
  const stats = { meshes: 0, triangles: 0, hills, vegetation, minSceneryRadius: Infinity,
    riverY: WATER_Y, archCenter: { x: 90, y: 0, z: 0 }, archCrestY: archTop(0) };
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = K.mesh(bin, material, { cast: false, receive: bin === 'bridge' || bin === 'banks' });
    if (!mesh) { material.dispose(); continue; }
    mesh.name = `qinglan-vista-${bin}`;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
    const p = mesh.geometry.attributes.position;
    stats.meshes++;
    stats.triangles += (mesh.geometry.index?.count ?? p.count) / 3;
    for (let i = 0; i < p.count; i++) {
      stats.minSceneryRadius = Math.min(stats.minSceneryRadius, Math.hypot(p.getX(i), p.getZ(i)));
    }
    scene.add(mesh);
    for (const source of K.bins[bin]) source.dispose();
    delete K.bins[bin];
  }
  return { stats, riverPos };
}
