// 사인검·아이스의 장식용 기하. 부품 질량·콜라이더·전투 규칙은 weapons.js가 소유한다.
import * as THREE from 'three';
import { swordKit, metalMat } from './weapon_looks.js';

export const SAIN_COLORS = { grip: 0x28272b, metal: 0xa48a4d, blade: 0x9ea5a8 };
export const ICE_COLORS = { grip: 0x784d32, metal: 0xb69a59, blade: 0xb5bbc0 };

function mesh(group, geometry, material, position = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.castShadow = true;
  group.add(m);
  return m;
}

function plate(points, depth, material) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

// One triangle batch for thin inlaid strokes and dots, including both faces.
function inlay(surface) {
  const vertices = [];
  const stroke = (a, b, side, width = 0.00022) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-8) return;
    const nx = -dy / length * width / 2, ny = dx / length * width / 2;
    const p = surface(a[0] + nx, a[1] + ny, side), q = surface(a[0] - nx, a[1] - ny, side);
    const r = surface(b[0] - nx, b[1] - ny, side), s = surface(b[0] + nx, b[1] + ny, side);
    vertices.push(...p, ...q, ...r, ...p, ...r, ...s);
  };
  const path = (points, side, width) => {
    for (let i = 1; i < points.length; i++) stroke(points[i - 1], points[i], side, width);
  };
  const dot = (x, y, radius, side) => {
    const center = surface(x, y, side);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, b = (k + 1) * Math.PI / 4;
      vertices.push(...center, ...surface(x + radius * Math.cos(a), y + radius * Math.sin(a), side),
        ...surface(x + radius * Math.cos(b), y + radius * Math.sin(b), side));
    }
  };
  const finish = (group, color) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    mesh(group, geo, metalMat(color, { rough: 0.42, metal: 0.65, side: THREE.DoubleSide }));
  };
  return { stroke, path, dot, finish };
}

const sainKit = swordKit({
  blade: { edge: 'double', width: t => 1 - 0.10 * t, thick: 0.0036, tip: 'round',
    tipLen: 0.055, overshoot: 0, bevel: 0.0028 },
  metal: SAIN_COLORS.metal,
});

export function sainPartMesh(index, isBlade, shape, color, opts, look, tier) {
  if (isBlade) return sainKit(index, isBlade, shape, color, opts, look, tier);
  const group = new THREE.Group(), metal = metalMat(SAIN_COLORS.metal, { rough: 0.35 });
  const dark = metalMat(SAIN_COLORS.grip, { rough: 0.58, metal: 0.5 });
  if (index === 0) {
    // The museum's flat, ornamented hilt narrowed to the approved hand grip.
    group.add(plate([[-0.016, -0.10], [-0.012, -0.04], [-0.012, 0.04], [-0.016, 0.10],
      [0.016, 0.10], [0.012, 0.04], [0.012, -0.04], [0.016, -0.10]], 0.027, dark));
    for (const y of [-0.083, 0.083]) mesh(group, new THREE.BoxGeometry(0.033, 0.006, 0.029), metal, [0, y, 0]);
  } else if (index === 1) {
    // Four-lobed flower plate, entirely within the physical pommel's ±25mm.
    const outline = Array.from({ length: 65 }, (_, k) => {
      const a = k * Math.PI / 32, r = 0.021 + 0.004 * Math.cos(4 * a);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    group.add(plate(outline, 0.011, dark));
    const p = inlay((x, y, side) => [x, y, side * 0.0057]);
    for (const side of [-1, 1]) {
      p.path([...outline, outline[0]].map(([x, y]) => [x * 0.94, y * 0.94]), side, 0.0007);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        p.dot(Math.cos(a) * 0.011, Math.sin(a) * 0.011, 0.0012, side);
      }
      mesh(group, new THREE.TorusGeometry(0.006, 0.001, 5, 16), metal, [0, 0, side * 0.006]);
      const boss = mesh(group, new THREE.SphereGeometry(0.004, 10, 6), metal, [0, 0, side * 0.006]);
      boss.scale.z = 0.45;
    }
    p.finish(group, SAIN_COLORS.metal);
  } else if (index === 2) {
    // Short broad plate guard; no Japanese disc or European crossguard.
    const guard = mesh(group, new THREE.CylinderGeometry(0.04, 0.04, 0.009, 32), dark);
    guard.scale.z = 0.325;
    const border = mesh(group, new THREE.TorusGeometry(0.038, 0.0008, 5, 32), metal);
    border.rotation.x = Math.PI / 2;
    border.scale.y = 0.325;
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// Geometric seal-letter interpretation of 四寅斬邪, not a facsimile of the museum's 27 characters.
const SEAL = [
  [[[-1, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]], [[-0.35, 1], [-0.35, -0.3], [-0.7, -0.65]],
    [[0.3, 1], [0.3, -0.4], [0.75, -0.4]]],
  [[[0, 1.2], [0, 0.9]], [[-1, 0.5], [-1, 0.9], [1, 0.9], [1, 0.5]], [[-0.7, 0.4], [0.7, 0.4]],
    [[-0.6, 0.15], [0.6, 0.15], [0.6, -0.5], [-0.6, -0.5], [-0.6, 0.15]], [[0, 0.4], [0, -0.5]],
    [[-0.6, -0.2], [0.6, -0.2]], [[-0.3, -0.7], [-0.7, -1.1]], [[0.3, -0.7], [0.7, -1.1]]],
  [[[-1, 0.8], [0, 0.8]], [[-0.5, 1.1], [-0.5, -1.1]], [[-1, 0.45], [0, 0.45], [0, -0.3], [-1, -0.3], [-1, 0.45]],
    [[-1, 0.05], [0, 0.05]], [[-1, -0.65], [0, -0.65]], [[1, 1.0], [0.35, 0.75], [0.35, -0.3], [0.15, -1]],
    [[0.35, 0.25], [1, 0.25]], [[0.75, 0.25], [0.75, -1.1]]],
  [[[-1, 0.9], [0, 0.9]], [[-0.7, 0.9], [-0.9, 0.15], [0, 0.15]], [[-0.3, 0.9], [-0.3, -1.1], [-0.8, -1.1]],
    [[0, 0.15], [-1, -0.8]], [[0.35, -1.1], [0.35, 1.0], [1, 1.0], [0.6, 0.3], [1, -0.2], [0.8, -0.6], [0.35, -0.6]]],
];

export function sainDecorate(group) {
  const h = this.hiltLength, L = this.bladeLength;
  const blade = inlay((x, y, side) => [x, y, side * (0.0036 * (1 - 0.35 * (y - h) / L) + 0.00013)]);
  // Seven-star groups echo the Big Dipper; other small stars suggest the celestial field.
  const stars = [[-0.005, 0], [0.003, 0.016], [0.006, 0.035], [-0.002, 0.048],
    [-0.006, 0.071], [0, 0.086], [0.004, 0.108]];
  for (let band = 0; band < 4; band++) {
    const points = stars.map(([x, y]) => [x * (1 - band * 0.055), h + 0.075 + band * 0.135 + y]);
    blade.path(points, 1, 0.00035);
    for (const [x, y] of points) blade.dot(x, y, 0.00115, 1);
  }
  for (let i = 0; i < 8; i++) {
    const y = h + 0.075 + i * 0.067;
    for (const points of SEAL[i % SEAL.length]) {
      blade.path(points.map(([x, v]) => [x * 0.005, y + v * 0.011]), -1, 0.0005);
    }
  }
  blade.finish(group, 0xbca360);
  const silver = inlay((x, y, side) => [x, y, side * (0.0036 * (1 - 0.35 * (y - h) / L) + 0.00014)]);
  for (const side of [-1, 1]) for (const x of [-0.0105, 0.0105]) {
    silver.stroke([x, h + 0.06], [x * 0.88, h + L - 0.095], side, 0.00024);
  }
  silver.finish(group, 0xc7cdd0);
  // Hilt borders and flower rivets stay inside the physical handle.
  const hilt = inlay((x, y, side) => [x, y, side * 0.0137]);
  for (const side of [-1, 1]) {
    for (const x of [-0.010, 0.010]) hilt.stroke([x, -0.075], [x, 0.075], side, 0.00045);
    for (const y of [-0.044, 0.044]) {
      hilt.dot(0, y, 0.003, side);
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        hilt.dot(Math.cos(a) * 0.0045, y + Math.sin(a) * 0.0045, 0.0013, side);
      }
    }
    for (const points of SEAL[0]) hilt.path(points.map(([x, y]) => [x * 0.006, y * 0.012]), side, 0.0004);
  }
  hilt.finish(group, SAIN_COLORS.metal);
  const collar = mesh(group, new THREE.BoxGeometry(0.0355, 0.025, 0.0094),
    metalMat(SAIN_COLORS.metal, { rough: 0.35 }), [0, h + 0.0125, 0]);
  collar.castShadow = true;
}

// HBO-inspired section: wide grinding bevels, a recessed central fuller and
// two short side grooves. These are surfaces, not floating painted lines.
function iceBladeGeometry(shape) {
  const [, hx, hy, hz] = shape, L = 2 * hy;
  const vertices = [], colors = [];
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const ring = y => {
    const t = (y + hy) / L, tip = smooth(1 - 0.15 / L, 1, t);
    const width = hx * (1 - 0.11 * t) * (1 - tip);
    const thick = Math.min(hz, 0.0045) * (1 - 0.27 * t) * (1 - tip);
    const longDepth = thick * 0.56 * (1 - smooth(0.77, 0.94, t));
    const shortDepth = thick * 0.32 * (1 - smooth(0.14, 0.23, t));
    const front = [
      [-1, 0, 1.10], [-0.72, thick, 1.03], [-0.55, thick, 1],
      [-0.515, thick - shortDepth, 0.80], [-0.485, thick - shortDepth, 0.80], [-0.45, thick, 1.06],
      [-0.16, thick, 1.04], [-0.105, thick - longDepth, 0.72], [0.105, thick - longDepth, 0.72],
      [0.16, thick, 1.04], [0.45, thick, 1.06], [0.485, thick - shortDepth, 0.80],
      [0.515, thick - shortDepth, 0.80], [0.55, thick, 1], [0.72, thick, 1.03], [1, 0, 1.10],
    ];
    return [...front.map(([x, z, c]) => ({ p: [x * width, y, z], c })),
      ...front.slice(1, -1).reverse().map(([x, z, c]) => ({ p: [x * width, y, -z], c }))];
  };
  const triangle = (a, b, c) => {
    for (const v of [a, b, c]) { vertices.push(...v.p); colors.push(v.c, v.c, v.c); }
  };
  // More rings around the tip and fuller endings, few elsewhere.
  const heights = [...Array.from({ length: 35 }, (_, i) => -hy + L * 0.86 * i / 34),
    ...Array.from({ length: 13 }, (_, i) => -hy + L * (0.86 + 0.14 * (i + 1) / 13))];
  let previous = ring(heights[0]);
  for (const y of heights.slice(1)) {
    const current = ring(y);
    for (let k = 0; k < current.length; k++) {
      const j = (k + 1) % current.length;
      triangle(previous[k], previous[j], current[j]);
      triangle(previous[k], current[j], current[k]);
    }
    previous = current;
  }
  const base = ring(-hy), center = { p: [0, -hy, 0], c: 0.85 };
  for (let k = 0; k < base.length; k++) triangle(center, base[(k + 1) % base.length], base[k]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function icePlate(shape, depth, material, bevel = 0.0012) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
    steps: 1, curveSegments: 16 });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return new THREE.Mesh(geometry, material);
}

function iceWoodGeometry(shape) {
  const [, , hy] = shape, vertices = [], colors = [], rings = 24, sides = 16;
  const point = (i, k) => {
    const t = i / rings, a = k * Math.PI * 2 / sides;
    const radius = 0.0125 + 0.005 * t + 0.0015 * Math.sin(t * Math.PI);
    const grain = Math.sin(a * 7 + t * 2.1) * Math.sin(a * 3 - t * 3.7);
    const r = radius - 0.00025 * Math.max(0, grain);
    const worn = Math.abs(Math.cos(a)) ** 12 * Math.sin(t * Math.PI);
    return { p: [Math.cos(a) * r, -hy + 2 * hy * t, Math.sin(a) * r * 0.92],
      c: 0.83 + 0.13 * grain + 0.20 * worn };
  };
  for (let i = 0; i < rings; i++) for (let k = 0; k < sides; k++) {
    const a = point(i, k), b = point(i, k + 1), c = point(i + 1, k + 1), d = point(i + 1, k);
    for (const v of [a, d, c, a, c, b]) { vertices.push(...v.p); colors.push(v.c, v.c * 0.94, v.c * 0.88); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function icePartMesh(index, isBlade, shape) {
  if (isBlade) {
    // fighter.js colors this mesh directly when blood accumulates.
    const blade = new THREE.Mesh(iceBladeGeometry(shape), metalMat(ICE_COLORS.blade,
      { rough: 0.25, metal: 0.76, env: 1.25, vertexColors: true, side: THREE.DoubleSide }));
    blade.castShadow = true;
    return blade;
  }
  const group = new THREE.Group();
  const brass = metalMat(ICE_COLORS.metal, { rough: 0.30, metal: 0.82 });
  const steel = metalMat(0x7d858b, { rough: 0.27, metal: 0.78, env: 1.2 });
  if (index === 0) {
    mesh(group, iceWoodGeometry(shape), new THREE.MeshStandardMaterial({
      color: ICE_COLORS.grip, roughness: 0.63, metalness: 0, vertexColors: true }));
  } else if (index === 1) {
    // The detailed HBO reference shows an oval recess, not a through-hole.
    const outline = new THREE.Shape();
    outline.moveTo(0, -0.0250);
    outline.bezierCurveTo(-0.024, -0.0250, -0.027, -0.012, -0.018, 0.003);
    outline.bezierCurveTo(-0.010, 0.018, -0.010, 0.018, -0.009, 0.0288);
    outline.lineTo(0.009, 0.0288);
    outline.bezierCurveTo(0.010, 0.018, 0.010, 0.018, 0.018, 0.003);
    outline.bezierCurveTo(0.027, -0.012, 0.024, -0.0250, 0, -0.0250);
    const hole = new THREE.Path();
    hole.absellipse(0, -0.009, 0.012, 0.013, 0, 2 * Math.PI, true);
    outline.holes.push(hole);
    group.add(icePlate(outline, 0.017, brass));
    const recess = [];
    for (const side of [-1, 1]) for (let band = 0; band < 4; band++) for (let k = 0; k < 32; k++) {
      const point = (r, angle) => [Math.cos(angle) * 0.012 * r,
        -0.009 + Math.sin(angle) * 0.013 * r, side * (0.005 + 0.0035 * r * r)];
      const a = k * Math.PI / 16, b = (k + 1) * Math.PI / 16, r0 = band / 4, r1 = (band + 1) / 4;
      const p = point(r0, a), q = point(r0, b), r = point(r1, b), s = point(r1, a);
      recess.push(...p, ...q, ...r, ...p, ...r, ...s);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(recess, 3));
    geometry.computeVertexNormals();
    mesh(group, geometry, metalMat(ICE_COLORS.metal,
      { rough: 0.33, metal: 0.78, side: THREE.DoubleSide }));
    mesh(group, new THREE.CylinderGeometry(0.003, 0.0035, 0.006, 8), steel, [0, -0.027, 0]);
  } else if (index === 2) {
    // Steel quillons and a broad shield plate; the brass is confined to the ends.
    const bar = new THREE.Shape();
    bar.moveTo(-0.130, -0.006);
    for (const [x, y] of [[-0.042, -0.009], [0.042, -0.009], [0.130, -0.006],
      [0.130, 0.006], [0.042, 0.009], [-0.042, 0.009], [-0.130, 0.006]]) bar.lineTo(x, y);
    bar.closePath();
    group.add(icePlate(bar, 0.018, steel));
    const shield = new THREE.Shape();
    shield.moveTo(-0.044, 0);
    for (const [x, y] of [[-0.026, -0.012], [0.026, -0.012], [0.044, 0],
      [0.037, 0.015], [0, 0.029], [-0.037, 0.015]]) shield.lineTo(x, y);
    shield.closePath();
    group.add(icePlate(shield, 0.025, steel, 0.0014));
    for (const sign of [-1, 1]) {
      const knob = mesh(group, new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 24), brass,
        [sign * 0.130, 0, 0]);
      knob.rotation.z = Math.PI / 2;
      const grooves = [], shades = [];
      const p = (radius, k) => {
        const a = k * Math.PI / 24;
        return [sign * (0.137 + (k % 2) * 0.00065), Math.cos(a) * radius, Math.sin(a) * radius];
      };
      for (let k = 0; k < 48; k++) {
        const a = p(0.005, k), b = p(0.0107, k), c = p(0.0107, k + 1), d = p(0.005, k + 1);
        grooves.push(...a, ...b, ...c, ...a, ...c, ...d);
        for (const j of [k, k, k + 1, k, k + 1, k + 1]) {
          const shade = j % 2 ? 1 : 0.72; shades.push(shade, shade, shade);
        }
      }
      const grooveGeo = new THREE.BufferGeometry();
      grooveGeo.setAttribute('position', new THREE.Float32BufferAttribute(grooves, 3));
      grooveGeo.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
      grooveGeo.computeVertexNormals();
      mesh(group, grooveGeo, metalMat(ICE_COLORS.metal,
        { rough: 0.36, metal: 0.82, vertexColors: true, side: THREE.DoubleSide }));
      const boss = mesh(group, new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 16), brass,
        [sign * 0.1385, 0, 0]);
      boss.rotation.z = Math.PI / 2;
      const pin = mesh(group, new THREE.CylinderGeometry(0.003, 0.0035, 0.004, 6), brass,
        [sign * 0.141, 0, 0]);
      pin.rotation.z = Math.PI / 2;
      const collar = mesh(group, new THREE.CylinderGeometry(0.009, 0.009, 0.008, 12), brass, [sign * 0.124, 0, 0]);
      collar.rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) {
        const rivet = mesh(group, new THREE.SphereGeometry(0.003, 8, 6), steel, [sign * 0.027, 0.018, side * 0.012]);
        rivet.scale.z = 0.5;
      }
    }
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function iceDecorate(group) {
  const steel = metalMat(0x7d858b, { rough: 0.27, metal: 0.78 });
  const brass = metalMat(ICE_COLORS.metal, { rough: 0.30, metal: 0.82 });
  for (const [y, radius, material] of [[-0.174, 0.0135, brass], [0.173, 0.018, steel]]) {
    mesh(group, new THREE.CylinderGeometry(radius, radius, 0.018, 16), material, [0, y, 0]);
  }
}
