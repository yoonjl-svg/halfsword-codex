// 사인검·아이스의 장식용 기하. 부품 질량·콜라이더·전투 규칙은 weapons.js가 소유한다.
import * as THREE from 'three';
import { swordKit, metalMat } from './weapon_looks.js';

export const SAIN_COLORS = { grip: 0x28272b, metal: 0xa48a4d, blade: 0x9ea5a8 };
export const ICE_COLORS = { grip: 0x573827, metal: 0x998355, blade: 0x74777c };

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

const iceKit = swordKit({
  blade: { edge: 'double', width: t => 1 - 0.14 * t, thick: 0.004, tip: 'spear',
    tipLen: 0.15, overshoot: 0, bevel: 0.006, fuller: { to: 0.66, width: 0.12, depth: 0.4 } },
  grip: { style: 'plain' }, guard: { style: 'bar' }, metal: ICE_COLORS.metal,
});

export function icePartMesh(index, isBlade, shape, color, opts, look, tier) {
  if (index !== 1) return iceKit(index, isBlade, shape, color, opts, look, tier);
  // Open brass ring, using the HBO hilt as a visual reference. No protruding peen.
  const group = new THREE.Group(), metal = metalMat(ICE_COLORS.metal, { rough: 0.33 });
  const ring = mesh(group, new THREE.TorusGeometry(0.022, 0.008, 8, 24), metal);
  ring.scale.z = 0.8;
  mesh(group, new THREE.BoxGeometry(0.022, 0.015, 0.016), metal, [0, 0.020, 0]);
  return group;
}

export function iceDecorate(group) {
  const h = this.hiltLength, L = this.bladeLength;
  const wave = inlay((x, y, side) => [x, y, side * (0.004 * (1 - 0.35 * (y - h) / L) + 0.00013)]);
  // Broad, subdued folded-steel waves; the fuller and sharpened edges remain clear.
  for (const side of [-1, 1]) for (const lane of [-3, -2, -1, 1, 2, 3]) {
    let prev;
    for (let k = 0; k <= 96; k++) {
      const t = k / 96, y = h + 0.055 + t * (L - 0.22);
      const x = (lane * 0.009 + Math.sin(t * 8 * Math.PI + Math.abs(lane) * 0.9) * 0.0018) * (1 - 0.14 * t);
      const point = [x, y];
      if (prev) wave.stroke(prev, point, side, 0.00032);
      prev = point;
    }
  }
  wave.finish(group, 0x92989d);
  const metal = metalMat(ICE_COLORS.metal, { rough: 0.35 });
  for (const y of [-0.174, 0.171]) mesh(group,
    new THREE.CylinderGeometry(0.020, 0.020, 0.011, 12), metal, [0, y, 0]);
}
