// Goujian-inspired bronze jian. Visuals only: weapons.js owns mass and colliders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { metalMat } from './weapon_looks.js';

export const GOUJIAN_COLORS = { grip: 0x8a7139, metal: 0xaf944b, blade: 0xb5a257 };

const SECTION = [-1, -0.78, -0.10, 0, 0.10, 0.78, 1];
const RELIEF = [0, 0.43, 0.90, 1, 0.90, 0.43, 0];
const STATIONS = [0, 0.12, 0.32, 0.55, 0.75, 0.875, 0.93, 0.97, 1];
const INLAY = 0x3d4935;

function geometry(vertices, colors) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function add(group, g, material, name) {
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.castShadow = true;
  group.add(m);
  return m;
}

function merged(parts) {
  const inputs = parts.map(g => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(inputs, false);
  inputs.forEach(g => g.dispose());
  parts.forEach(g => { if (!inputs.includes(g)) g.dispose(); });
  return result;
}

// Front-face triangles are retained for exact projection of the inlay. Its
// geometry is clipped to each triangle rather than floating over the ridge.
function bladeSurface(hx, hy, hz) {
  const ring = t => {
    const tip = t <= 0.875 ? 1 : (1 - t) / 0.125;
    const w = hx * (1 - 0.10 * t + 0.025 * Math.sin(Math.PI * t)) * tip;
    const h = hz * (1 - 0.24 * t) * tip;
    return SECTION.map((x, i) => [x * w, -hy + t * hy * 2, RELIEF[i] * h]);
  };
  const front = [], vertices = [], colors = [];
  const emit = (tri, shade) => {
    vertices.push(...tri.flat());
    for (let i = 0; i < 3; i++) colors.push(shade, shade, shade * 0.97);
  };
  for (let j = 1; j < STATIONS.length; j++) {
    const a = ring(STATIONS[j - 1]), b = ring(STATIONS[j]);
    for (let k = 0; k < SECTION.length - 1; k++) {
      const shade = k === 0 || k === 5 ? 1.22 : k === 2 || k === 3 ? 1.06 : 0.96;
      for (const tri of [[a[k], a[k + 1], b[k + 1]], [a[k], b[k + 1], b[k]]]) {
        const area = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1])
          - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1]);
        if (Math.abs(area) < 1e-12) continue;
        emit(tri, shade);
        emit([...tri].reverse().map(([x, y, z]) => [x, y, -z]), shade);
        // The sharpened edges and narrow medial ridge stay plain bronze.
        if (k === 1 || k === 4) front.push(tri);
      }
    }
  }
  const base = ring(0);
  for (let k = 0; k < base.length - 1; k++) {
    const a = base[k], b = base[k + 1], c = [b[0], b[1], -b[2]], d = [a[0], a[1], -a[2]];
    emit([a, d, c], 0.77); emit([a, c, b], 0.77);
  }
  return { geometry: geometry(vertices, colors), front };
}

function clipToTriangle(polygon, triangle) {
  let result = polygon;
  for (let i = 0; i < 3 && result.length; i++) {
    const a = triangle[i], b = triangle[(i + 1) % 3];
    const distance = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const input = result; result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length], dp = distance(p), dq = distance(q);
      if (dp >= -1e-12) result.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return result;
}

function projectedInlay(front) {
  const vertices = [];
  const polygon = (points, sides = [-1, 1]) => {
    for (const tri of front) {
      const p = clipToTriangle(points, tri);
      if (p.length < 3) continue;
      const [a, b, c] = tri;
      const determinant = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      const project = ([x, y], side) => {
        const u = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / determinant;
        const v = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / determinant;
        return [x, y, side * (a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]) + 0.000025)];
      };
      for (const side of sides) for (let i = 1; i < p.length - 1; i++) {
        const points3 = [project(p[0], side), project(p[i], side), project(p[i + 1], side)];
        vertices.push(...(side > 0 ? points3 : points3.reverse()).flat());
      }
    }
  };
  const stroke = (a, b, width, sides) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const nx = -dy / length * width / 2, ny = dx / length * width / 2;
    polygon([[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny],
      [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]], sides);
  };
  return { stroke, finish: () => geometry(vertices) };
}

// Eight distinct, simplified bird-and-worm-style signs. These ornamental
// strokes suggest the archaeological inscription; they are not a facsimile
// or a claim that this geometry transcribes the original ancient characters.
const SIGNS = [
  [[[-0.8, 0.8], [0, 1], [0.7, 0.7], [0.1, 0.35], [-0.1, -0.7], [-0.65, -1]], [[-0.65, 0], [0.55, 0.2], [0.8, -0.1]]],
  [[[-0.8, 0.6], [0, 1], [0.8, 0.6], [0, 0.1], [-0.65, 0.3], [-0.5, -0.3], [0.6, -0.8]], [[0.1, 0.2], [0, -0.9]]],
  [[[0.1, 1], [-0.2, 0.6], [-0.2, -0.8], [0.5, -1]], [[-0.7, 0.35], [0.5, 0.5], [0.8, 0.2]], [[-0.7, -0.2], [0.5, -0.1]]],
  [[[-0.8, 0.9], [0.6, 0.9], [0, 0.5], [-0.7, -0.2], [0.6, -0.3], [0.3, -1]], [[0, 0.5], [0.7, 0.1], [0.8, -0.6]]],
  [[[-0.7, 0.7], [0.1, 1], [0.7, 0.7], [0.2, 0.3], [0.1, -0.9]], [[-0.8, 0.1], [-0.4, -0.5], [0.7, -0.3]]],
  [[[-0.5, 1], [-0.7, 0.4], [0.4, 0.6], [0.7, 0.2], [-0.4, -0.2], [-0.3, -0.8], [0.5, -1]], [[0.1, 0.5], [0.1, -0.8]]],
  [[[-0.7, 0.8], [0.6, 0.9], [0.1, 0.2], [-0.7, -0.2]], [[-0.1, 0.5], [0.5, 0.1], [0.3, -0.8], [-0.3, -1]], [[-0.6, -0.4], [0.7, -0.3]]],
  [[[0.1, 1], [-0.2, 0.5], [-0.1, -0.7], [-0.7, -1]], [[-0.7, 0.4], [0.6, 0.6], [0.8, 0.2], [0.3, -0.1]], [[-0.5, -0.3], [0.6, -0.6]]],
];

function decorateBlade(mesh, front, hy) {
  const inlay = projectedInlay(front), L = hy * 2;
  // A continuous rhombus lattice, with a quiet root panel for the eight signs.
  // Both slopes use identical repeat lengths; nothing is placed randomly.
  const low = -hy + 0.090, high = -hy + L * 0.955;
  for (const direction of [-1, 1]) for (let i = -2; i < Math.ceil(L / 0.027) + 3; i++) {
    const center = low + i * 0.027;
    let a = [-0.023, center - direction * 0.023 * 1.85];
    let b = [0.023, center + direction * 0.023 * 1.85];
    if (a[1] > b[1]) [a, b] = [b, a];
    if (b[1] < low || a[1] > high) continue;
    const point = y => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
    inlay.stroke(point(Math.max(low, a[1])), point(Math.min(high, b[1])), 0.0010);
  }
  for (let i = 0; i < SIGNS.length; i++) {
    const cx = i < 4 ? 0.0087 : -0.0087, cy = -hy + 0.021 + (3 - i % 4) * 0.017;
    for (const path of SIGNS[i]) for (let j = 1; j < path.length; j++) {
      const transform = ([x, y]) => [cx + x * 0.0038, cy + y * 0.0055];
      inlay.stroke(transform(path[j - 1]), transform(path[j]), 0.00055);
    }
  }
  const ornament = add(mesh, inlay.finish(), metalMat(INLAY, {
    metal: 0.55, rough: 0.55, polygonOffset: true, polygonOffsetFactor: -1,
    polygonOffsetUnits: -1, side: THREE.DoubleSide,
  }), 'goujian-diamond-and-inscription-inlay');
  ornament.castShadow = false;
}

function guardGeometry() {
  const contour = [[-0.034, 0.004], [-0.025, -0.006], [-0.012, -0.007],
    [0.012, -0.007], [0.025, -0.006], [0.034, 0.004], [0.025, 0.007], [-0.025, 0.007]];
  const vertices = [];
  for (const side of [-1, 1]) for (let i = 0; i < contour.length; i++) {
    const [x, y] = contour[i], [u, v] = contour[(i + 1) % contour.length];
    const a = [x, y, side * 0.0128], b = [u, v, side * 0.0128];
    const c = [u * 0.96, v * 0.78, side * 0.0157], d = [x * 0.96, y * 0.78, side * 0.0157];
    for (const triangle of [[a, b, c], [a, c, d], [[0, 0, side * 0.0157], d, c]]) {
      vertices.push(...(side > 0 ? triangle : [...triangle].reverse()).flat());
    }
    if (side > 0) vertices.push(...a, ...[x, y, -0.0128], ...[u, v, -0.0128], ...a, ...[u, v, -0.0128], ...b);
  }
  return geometry(vertices);
}

function guardInlays() {
  const vertices = [], colors = [];
  // Museum description distinguishes blue glass on the front from turquoise
  // on the reverse; these two faces deliberately use separate palettes.
  const glass = [0x174975, 0x216c94, 0x255685, 0x3984a8, 0x154b79, 0x347da2];
  const turquoise = [0x389c91, 0x65b9a1, 0x4bac9f, 0x2d8f82, 0x76bdab, 0x43a89b];
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.0082, skew = Math.sign(x) * 0.0015;
    const points = [[x - 0.0036 + skew, -0.0036], [x + 0.0036 + skew, -0.0036],
      [x + 0.0036, 0.0037], [x - 0.0036, 0.0037]];
    const center = [x + skew / 2, 0, side * 0.01595];
    for (let j = 0; j < 4; j++) {
      const a = [...points[j], side * 0.01574], b = [...points[(j + 1) % 4], side * 0.01574];
      const triangle = [center, a, b];
      vertices.push(...(side > 0 ? triangle : triangle.reverse()).flat());
      const color = new THREE.Color((side > 0 ? glass : turquoise)[i]);
      color.multiplyScalar(j % 2 ? 1 : 0.84);
      for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
    }
  }
  return geometry(vertices, colors);
}

export function goujianPartMesh(index, isBlade, shape, color, opts, look, tier) {
  if (isBlade) {
    const [, hx, hy, hz] = shape, surface = bladeSurface(hx, hy, hz);
    const blade = new THREE.Mesh(surface.geometry, metalMat(GOUJIAN_COLORS.blade, {
      rough: 0.32, metal: 0.82, env: 1.15, vertexColors: true, side: THREE.DoubleSide,
    }));
    blade.name = 'goujian-faceted-bronze-blade';
    blade.castShadow = true;
    decorateBlade(blade, surface.front, hy);
    return blade;
  }
  const group = new THREE.Group(), bronze = metalMat(GOUJIAN_COLORS.metal, { rough: 0.40, metal: 0.8 });
  if (index === 0) {
    const body = new THREE.CylinderGeometry(0.0124, 0.0128, shape[2] * 2, 24);
    body.scale(1.08, 1, 1);
    const rings = [-0.030, 0.032].map(y => {
      const g = new THREE.TorusGeometry(0.013, 0.0017, 6, 32);
      g.rotateX(Math.PI / 2); g.scale(1, 1, 0.91); g.translate(0, y, 0);
      return g;
    });
    add(group, merged([body, ...rings]), metalMat(GOUJIAN_COLORS.grip, { rough: 0.45, metal: 0.78 }), 'goujian-cylindrical-two-ring-hilt');
  } else if (index === 1) {
    const disk = new THREE.CylinderGeometry(0.0248, 0.026, 0.0078, 64);
    disk.translate(0, 0.0001, 0);
    add(group, disk, bronze, 'goujian-round-disk-pommel');
    const vertices = [];
    // Eleven very fine concentric incised circles on the pommel's underside.
    for (let ring = 0; ring < 11; ring++) for (let k = 0; k < 64; k++) {
      const radius = 0.002 + ring * 0.00203, a = k * Math.PI / 32, b = (k + 1) * Math.PI / 32;
      const p = (r, angle) => [r * Math.cos(angle), -0.00385, r * Math.sin(angle)];
      const A = p(radius - 0.00013, a), B = p(radius + 0.00013, a);
      const C = p(radius + 0.00013, b), D = p(radius - 0.00013, b);
      vertices.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
    const lines = add(group, geometry(vertices), metalMat(0x68582d, {
      rough: 0.53, metal: 0.65, side: THREE.DoubleSide,
    }), 'goujian-eleven-pommel-circles');
    lines.castShadow = false;
  } else if (index === 2) {
    add(group, guardGeometry(), bronze, 'goujian-compact-boat-guard');
    add(group, guardInlays(), new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.28, metalness: 0.22, vertexColors: true,
      side: THREE.DoubleSide,
    }), 'goujian-turquoise-and-blue-guard-inlays');
  }
  return group;
}

export function goujianDecorate(group) {
  // All details belong to their physical part so fracture/dropped fragments
  // retain the correct local ornament. No animation, random placement or aura.
  group.userData.goujian = { inscription: 'simplified-bird-worm-style', pommelCircles: 11 };
}
