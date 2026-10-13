// 잠든 습지 — freshwater flooded forest around a firm mud island after rain.
// Visual scenery only. The level floor is flat through the 6.5m fighting area;
// tall plants, masonry and roots stay outside the 10.5m camera orbit;
// low ground-cover starts beyond the fighting area without hiding the fighters.
import * as THREE from 'three';
import { buildSluiceBear } from './stage_sluice_bear.js';
import { WETLAND_PUDDLES, puddleOutline, wetlandIslandRadius as islandRadius } from './wetland_ground.js';
import { Kit, rng, h3, box, limb, canvasTex } from './stage_kit.js';

const TAU = Math.PI * 2;
const HERO = { x: 21.2, z: -1.6, rotation: -Math.PI / 2 };
const C = {
  earth: 0x68664f, earthDeep: 0x454d3d, stone: 0xa0a9a7,
  stoneDark: 0x7e8780, wet: 0x49564b, tide: 0x313d34,
  bark: 0x958b72, barkDark: 0x686e57, moss: 0x617b48,
  leaf: 0x486a3e, leafDeep: 0x305642, leafLight: 0x819654,
  wood: 0x535443, water: 0x647e6b,
};

function soilTexture() {
  const r = rng(63302);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c4c7b1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 65; i++) {
      const x = r() * w, y = r() * h, rad = 10 + r() * 95;
      const patch = g.createRadialGradient(x, y, 0, x, y, rad);
      patch.addColorStop(0, i % 3 ? 'rgba(99,64,49,0.14)' : 'rgba(233,213,160,0.12)');
      patch.addColorStop(1, 'rgba(130,88,59,0)');
      g.fillStyle = patch; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 6200; i++) {
      const v = 100 + (r() * 145 | 0);
      g.fillStyle = `rgba(${v},${v - 8},${v - 16},${0.06 + r() * 0.17})`;
      const s = 0.4 + r() * 1.4; g.fillRect(r() * w, r() * h, s, s * 0.7);
    }
    // Muted fallen leaves break the bare soil without raised duel-floor props.
    for(let i=0;i<190;i++) {
      const x=r()*w,y=r()*h,len=5+r()*12,width=2+r()*4;
      g.save();g.translate(x,y);g.rotate(r()*TAU);
      g.fillStyle=i%3?'rgba(61,69,42,0.17)':'rgba(124,106,56,0.22)';
      g.beginPath();g.moveTo(0,-len/2);g.quadraticCurveTo(width,0,0,len/2);g.quadraticCurveTo(-width,0,0,-len/2);g.fill();g.restore();
    }
    // Faint runoff traces and leaf impressions, with no regular arena markings.
    for (let i = 0; i < 72; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = 'rgba(74,57,42,0.10)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + 3, x + 19 + r() * 15, y + 2); g.stroke();
    }
  });
}

function stoneTexture() {
  const r = rng(63401);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#dedfd6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 85; i++) {
      const x = r() * w, y = r() * h, rad = 12 + r() * 74;
      const patch = g.createRadialGradient(x, y, 0, x, y, rad);
      patch.addColorStop(0, i % 4 ? 'rgba(71,79,65,0.12)' : 'rgba(222,221,193,0.30)');
      patch.addColorStop(1, 'rgba(100,103,81,0)');
      g.fillStyle = patch; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 6400; i++) {
      g.fillStyle = i % 3 ? `rgba(52,61,49,${0.02 + r() * 0.12})` : 'rgba(255,255,236,0.21)';
      g.fillRect(r() * w, r() * h, 0.4 + r() * 1.3, 0.4 + r() * 1.7);
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = 'rgba(63,72,61,0.15)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 17); g.lineTo(x - 2, y + 34 + r() * 32); g.stroke();
    }
  });
}

function barkTexture() {
  const r = rng(63533);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#d4d0b9'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 215; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = i % 3 ? 'rgba(53,60,42,0.20)' : 'rgba(250,243,216,0.30)';
      g.lineWidth = 0.4 + r() * 2;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - 2, y + 34, x + 6, y + 61, x + 3, y + 70 + r() * 150); g.stroke();
    }
    for (let i = 0; i < 150; i++) {
      g.fillStyle = 'rgba(48,75,53,0.12)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 8, 2 + r() * 15, 0, 0, TAU); g.fill();
    }
  });
}

function put(K, bin, geometry, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, opt = {}) {
  const g = K.put(bin, geometry, color, pos, rot, scale, opt);
  geometry.dispose();
  return g;
}

function geometry(positions, indices = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices) g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// A closed, eight-facet leaf. Its folded ridge catches light without an alpha
// texture or a stack of translucent cards, including when seen from underneath.
function leafGeometry() {
  return geometry([
    0, 0, 0, -0.36, 0.10, 0.39, 0, 0.20, 0.48,
    0.36, 0.10, 0.39, 0, -0.07, 1, 0, 0.06, 0.47,
  ], [0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3, 0, 5, 1, 0, 3, 5, 1, 5, 4, 5, 3, 4]);
}

function canopyGeometry(detailed = false) {
  const g = new THREE.IcosahedronGeometry(1, detailed ? 1 : 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 0.88 + h3(x, y, z, 63519) * 0.24;
    p.setXYZ(i, x * f, y * (y > 0 ? 0.68 : 0.43), z * f);
  }
  g.computeVertexNormals(); return g;
}

function ground(scene, map) {
  const positions = [], colors = [], uv = [], indices = [], color = new THREE.Color();
  const rings = 22, segments = 112, radius = 85;
  for (let ring = 0; ring <= rings; ring++) {
    const rad = ring / rings * radius;
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * TAU, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const outer = THREE.MathUtils.smoothstep(rad, 10.8, 25);
      const soil = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.19) * 2.4);
      color.set(C.earth).lerp(new THREE.Color(C.earthDeep), outer * 0.32 + soil * 0.12);
      color.lerp(new THREE.Color(0x4b6247), outer * (0.60 + 0.18 * Math.sin(z * 0.21) ** 2));
      // Broad, soft canopy shade belongs to the soil instead of a uniform plaza.
      const shade = 0.90 + Math.sin(x * 0.38 + Math.cos(z * 0.30)) * 0.07;
      color.multiplyScalar(shade);
      // No ground vertex in the camera disk rises above the actual duel plane.
      let y = -0.016; // Low floodplain; visible shallows never change the physics floor.
      y += THREE.MathUtils.smoothstep(rad, 34, 73) * (1.1 + Math.sin(a * 3.2 + 1) * 0.7);
      positions.push(x, y, z); colors.push(color.r, color.g, color.b); uv.push(x * 0.27, z * 0.27);
      if (ring < rings && j < segments) {
        const k = ring * (segments + 1) + j;
        indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1);
      }
    }
  }
  const g = geometry(positions, indices);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1 }));
  mesh.name = 'sluice-flat-shaded-loam'; mesh.receiveShadow = true; scene.add(mesh);
}

function paving(K, r) {
  // Broken paving is embedded in the earth, not a raised fighting platform.
  for (let row = -8; row < 18; row++) {
    for (let col = -2; col <= 2; col++) {
      if (r() < (row < 8 ? 0.37 : 0.16)) continue;
      const x = row * 1.04 + (col % 2) * 0.28, z = col * 1.03 - 0.65 + Math.sin(row * 0.17) * 0.28;
      const w = 0.79 + r() * 0.16, d = 0.77 + r() * 0.16, cut = 0.05 + r() * 0.14;
      const y = 0.001 + r() * 0.004;
      const slab = geometry([-w / 2, y, -d / 2, w / 2 - cut, y, -d / 2, w / 2, y, -d / 2 + cut, w / 2, y, d / 2, -w / 2 + cut, y, d / 2, -w / 2, y, d / 2 - cut], [0, 5, 1, 1, 5, 4, 1, 4, 2, 2, 4, 3]);
      // Keep deterministic RNG consumption while breaking the old parade-like path.
      const retained = Math.abs(col) <= 1 && h3(row, col, 0, 63973) > 0.38;
      if (!retained) { slab.dispose(); r(); continue; }
      put(K, 'paving', slab, row < 7 ? 0x999487 : C.stoneDark, [x, 0, z], [0, (r() - 0.5) * 0.09, 0], 1, { vary: 0.2, noise: 0.1, uv: 'box', uvScale: 0.8 });
    }
  }
}

// Tapering fluted trunk: the lower ridges spread into real buttress roots.
function trunkGeometry(height, radius, seed) {
  const positions = [], indices = [], sides = 11, levels = [0, 0.06, 0.2, 0.48, 0.75, 1];
  for (let j = 0; j < levels.length; j++) {
    const t = levels[j], taper = 1 - t * 0.89;
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU;
      const rr = radius * taper * (1 + (j < 2 ? 0.23 : 0.10) * Math.cos(a * 5 + seed));
      positions.push(Math.cos(a) * rr + Math.sin(t * 2.8 + seed) * t * radius * 0.48, t * height, Math.sin(a) * rr + t * t * radius * 0.7);
      if (j < levels.length - 1 && i < sides) {
        const k = j * (sides + 1) + i;
        indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2);
      }
    }
  }
  return geometry(positions, indices);
}

// Triangular plank-like roots are thin at the crest and wide at soil level.
function buttressGeometry(points, widths) {
  const positions = [], indices = [];
  points.forEach((p, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const dx = after[0] - before[0], dz = after[2] - before[2], len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * widths[i], nz = dx / len * widths[i];
    positions.push(p[0] + nx, 0.025, p[2] + nz, p[0], p[1], p[2], p[0] - nx, 0.025, p[2] - nz);
    if (i < points.length - 1) {
      const k = i * 3;
      indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5, k, k + 2, k + 3, k + 2, k + 5, k + 3);
    }
  });
  indices.push(0, 1, 2);
  return geometry(positions, indices);
}

function mossStone(K, pos, size, color = C.stone, rot = [0, 0, 0]) {
  return put(K, 'stone', box(...size, 2, 1, 1), color, pos, rot, 1,
    { rough: 0.075, vary: 0.13, noise: 0.045, uv: 'box', uvScale: 0.55, snow: 0.47, snowColor: C.moss });
}

function taperedRoot(points, radii) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const segments = 44, sides = 8, g = new THREE.TubeGeometry(curve, segments, 1, sides, false), p = g.attributes.position;
  const center = new THREE.Vector3(), v = new THREE.Vector3();
  for (let j = 0; j <= segments; j++) {
    const t = j / segments, at = t * (radii.length - 1), low = Math.min(radii.length - 2, Math.floor(at));
    const radius = THREE.MathUtils.lerp(radii[low], radii[low + 1], at - low);
    curve.getPointAt(t, center);
    for (let i = 0; i <= sides; i++) {
      const k = j * (sides + 1) + i;
      v.fromBufferAttribute(p, k).sub(center).multiplyScalar(radius).add(center); p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals(); return g;
}

function sluice(K, leaves, crowns, r) {
  K.push([HERO.x, 0, HERO.z], HERO.rotation);
  // The hydraulic frame has long square beams and an unobstructed rectangular
  // opening, with a clear tilt where the living roots have lifted its right end.
  K.push([0, 0.20, 0]);
  K.frame.multiply(new THREE.Matrix4().makeRotationZ(0.105));
  for (const side of [-1, 1]) {
    for (let course = 0; course < 5; course++) {
      mossStone(K, [side * 3.89 + (course % 2) * 0.04, 1.24 + course * 1.10, -0.12], [2.23, 1.06, 2.9], course < 2 ? C.stoneDark : C.stone);
      // Broad flood stain, fading downward. It is confined to old submerged faces.
      if (course === 1 || course === 2) {
        const top = course === 2 ? 0.19 : 0.34;
        put(K, 'stain', box(2.16, top, 0.018), course === 2 ? C.tide : C.wet, [side * 3.89, 1.11 + course * 1.10, 1.355], [0, 0, 0], 1, { noise: 0.15, vary: 0.03 });
        for (let k = 0; k < 5; k++) put(K, 'stain', box(0.06 + r() * 0.08, 0.12 + r() * 0.27, 0.02), C.wet, [side * 3.89 - 0.9 + k * 0.43, 0.92 + course * 1.1, 1.36]);
      }
    }
  }
  mossStone(K, [0, 6.76, -0.10], [10.35, 1.13, 3.18], 0xa8aaa0);
  mossStone(K, [-1.64, 7.42, -0.28], [6.82, 0.34, 3.44], 0x969e8c, [0, 0.015, -0.018]);
  mossStone(K, [3.66, 7.51, -0.25], [3.38, 0.48, 3.30], C.stoneDark, [0.02, 0.025, -0.08]);
  mossStone(K, [0, 1.22, -0.25], [7.58, 0.66, 3.85], C.stoneDark);
  // A projecting outlet trough gives the last shower water an actual drip lip.
  mossStone(K, [-0.38, 1.12, 2.23], [1.24, 0.24, 2.70], C.stoneDark);
  for (const x of [-0.92, 0.16]) mossStone(K, [x, 1.34, 2.22], [0.16, 0.24, 2.63], C.stoneDark);
  put(K, 'stain', box(0.88, 0.013, 2.50), 0x4c6453, [-0.38, 1.253, 2.22]);
  // Recessed gate runners and a remnant stop log identify working infrastructure.
  for (const x of [-2.71, 2.71]) {
    put(K, 'stain', box(0.11, 4.22, 0.025), C.tide, [x, 3.79, 1.36]);
    put(K, 'stone', box(0.17, 4.2, 0.25), C.stoneDark, [x + Math.sign(x) * 0.16, 3.8, 1.28]);
  }
  for (let i = 0; i < 7; i++) {
    const y = 2.10 + i * 0.48;
    put(K, 'stain', box(i % 2 ? 0.35 : 0.66, 0.04, 0.02), 0x3c4a3c, [-3.47, y, 1.374]);
    put(K, 'stone', box(i % 2 ? 0.34 : 0.65, 0.026, 0.022), 0xb5baa4, [-3.47, y - 0.052, 1.381]);
  }
  // Dark old timber survives at the sides; the central view stays open.
  for (const [x, y, angle, length] of [[-2.42, 2.34, 0.03, 1.70], [-1.92, 1.96, -0.12, 1.11], [2.3, 2.59, -0.19, 2.21]]) {
    put(K, 'wood', box(0.31, length, 0.22), C.wood, [x, y, 0.52], [0.04, 0, angle], 1, { rough: 0.035, noise: 0.06, uv: 'box', uvScale: 0.65 });
  }
  put(K, 'wood', box(3.48, 0.19, 0.22), 0x494e40, [0.55, 1.88, 0.54], [0.02, 0.08, -0.19]);
  K.pop();

  // The side walls have collapsed in unequal lengths, with exposed end faces.
  for (const side of [-1, 1]) {
    for (let i = 0; i < (side < 0 ? 3 : 2); i++) {
      const x = side * (6.1 + i * 1.18), y = 0.59 + (side > 0 ? 0.8 : 0.2);
      mossStone(K, [x, y, -0.75 - i * 0.35], [2.08, 1.14, 2.45], C.stoneDark, [0.02, side * 0.055, side * (0.09 + i * 0.03)]);
    }
  }
  // Hero tree beside the opening. One high root crosses the lintel; its thinner
  // tails descend along the outside pier instead of filling the channel hole.
  const trunk = [5.72, 0, -1.23];
  put(K, 'bark', trunkGeometry(23.5, 2.18, 1.8), C.bark, trunk, [0, 0, -0.055], 1, { noise: 0.035, uv: 'box', uvScale: 0.33 });
  const roots = [
    [[5.72, 5.4, -1.23], [3.77, 3.35, 1.25], [3.17, 1.67, 3.00], [2.30, 0.14, 5.35]],
    [[5.72, 5.0, -1.23], [7.34, 2.67, 0.46], [8.51, 1.11, 2.76], [9.24, 0.08, 4.0]],
    [[5.72, 4.6, -1.23], [4.18, 2.8, -3.02], [1.34, 0.66, -4.73], [-0.12, 0.04, -6.02]],
    [[5.72, 4.8, -1.23], [8.10, 2.68, -2.34], [9.73, 0.47, -4.56], [10.32, 0.05, -6.10]],
    [[5.72, 3.4, -1.23], [5.98, 1.47, -4.39], [5.77, 0.37, -6.28], [4.70, 0.02, -7.08]],
  ];
  for (const points of roots) put(K, 'bark', buttressGeometry(points, [0.76, 0.72, 0.53, 0.04]), C.bark, [0, 0, 0], [0, 0, 0], 1, { noise: 0.055, uv: 'box', uvScale: 0.36, snow: 0.24, snowColor: C.moss });
  const capRoot = [[5.9, 9.9, -0.38], [4.2, 8.11, 1.13], [1.17, 7.48, 1.74], [-2.28, 7.09, 1.78], [-4.43, 5.87, 1.84], [-4.91, 2.2, 2.46], [-6.78, 0.08, 3.91]];
  const radii = [0.76, 0.57, 0.46, 0.36, 0.28, 0.19, 0.035];
  put(K, 'bark', taperedRoot(capRoot, radii), C.bark, [0, 0, 0], [0, 0, 0], 1, { noise: 0.025, uv: 'box', uvScale: 0.33 });
  const companion = [[5.8, 8.8, -0.5], [3.9, 8.26, 1.75], [1.6, 8.16, 2.03], [-0.5, 7.12, 1.73], [-3.7, 7.05, 1.90], [-5.14, 5.02, 2.44], [-5.26, 2.7, 2.31], [-6.40, 0.08, 3.24]];
  put(K, 'bark', taperedRoot(companion, [0.48, 0.41, 0.32, 0.26, 0.22, 0.17, 0.11, 0.025]), 0x8b8468, [0, 0, 0], [0, 0, 0], 1, { noise: 0.028, uv: 'box', uvScale: 0.35 });
  // Small hanging feeder roots are opaque geometry, with no vine curtain.
  for (let i = 0; i < 9; i++) {
    const x = -2.7 + i * 0.84, y = 7.1 + Math.max(0, x) * 0.18;
    limb(K, 'vine', [x, y, 1.90], [x + 0.10, y - 0.72 - r() * 1.22, 1.97], 0.026, 0.009, C.barkDark, {}, 4);
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39, y = 10.8 + i * 1.45, len = 4.7 + r() * 2.6;
    const end = [trunk[0] + Math.cos(a) * len, y + 1.5, trunk[2] + Math.sin(a) * len];
    limb(K, 'bark', [trunk[0], y, trunk[2]], end, 0.60 - i * 0.046, 0.12, C.bark, { uv: 'box', uvScale: 0.35 }, 8);
    for (let j = 0; j < 3; j++) {
      const p = [end[0] + (r() - 0.5) * 3.4, end[1] + r() * 1.2, end[2] + (r() - 0.5) * 3.4];
      crowns.push({ pos: heroWorld(p), width: 2.45 + r() * 1.1, height: 1.1, a, color: i % 3 ? C.leaf : C.leafLight, detailed: true });
      broadSpray(leaves, heroWorld(p), a, 8, 2.0, r, true);
    }
  }
  // A broken wooden gate leaf rests against the surviving outboard wall.
  K.push([-7.20, 0.55, 1.50], -0.15);
  for (let i = 0; i < 5; i++) put(K, 'wood', box(0.36, 2.40 - (i % 3) * 0.27, 0.16), C.wood, [i * 0.41, 1.0, 0], [-0.30, 0, 0.18], 1, { rough: 0.035, uv: 'box', uvScale: 0.6 });
  for (const y of [0.4, 1.53]) put(K, 'wood', box(2.2, 0.17, 0.22), 0x454d3d, [0.88, y, 0.14], [-0.30, 0, 0.18]);
  K.pop(); K.pop();
}

function heroWorld(p) { return [HERO.x - p[2], p[1], HERO.z + p[0]]; }

function broadSpray(leaves, pos, angle, count, length, r, light = false) {
  for (let j = 0; j < count; j++) {
    const a = angle + j / count * TAU + r() * 0.28;
    leaves.push({ pos: [pos[0] + Math.sin(a) * 0.22, pos[1] + r() * 0.20, pos[2] + Math.cos(a) * 0.22],
      rot: [-(0.12 + r() * 0.55), a, (r() - 0.5) * 0.50],
      scale: [length * (0.83 + r() * 0.26), length * 0.75, length * (0.78 + r() * 0.45)],
      color: light && j % 3 === 0 ? C.leafLight : j % 3 ? C.leaf : C.leafDeep });
  }
}

function forest(K, leaves, crowns, r) {
  const stands = [[-20,-9],[-19,17],[-4,25],[19,26],[38,19],[40,-18],[6,-27],[-25,-27],[-39,11],[-42,41],[4,52],[47,39],[54,-9],[-19,-53]];
  for (let i = 0; i < 88; i++) {
    const stand = stands[i % stands.length], a = r() * TAU, d = Math.sqrt(r()) * (i < 36 ? 5 : 10);
    const x = stand[0] + Math.cos(a) * d, z = stand[1] + Math.sin(a) * d, rad = Math.hypot(x, z);
    if (rad < 18.8 || Math.hypot(x - HERO.x, z - HERO.z) < 11) continue;
    // An opening behind the rectangular channel admits real lit undergrowth.
    if (x > 23 && x < 44 && z > -7 && z < 3) continue;
    const near = rad < 35, height = 13 + r() * 11, width = 0.24 + r() ** 2 * 1.3;
    const lean = (r() - 0.5) * 0.21;
    put(K, 'bark', trunkGeometry(height, width, i + 3), near ? C.barkDark : 0x7e8d76, [x, 0, z], [0, a, lean], 1, { noise: 0.025, uv: 'box', uvScale: 0.43 });
    if (near) {
      for (let j = 0; j < 3; j++) {
        const angle = a + j / 3 * TAU, len = width * 2.9 + 0.8;
        put(K, 'bark', buttressGeometry([[0, width * 2.6, 0], [Math.cos(angle) * len * 0.55, 0.50, Math.sin(angle) * len * 0.55], [Math.cos(angle) * len, 0.03, Math.sin(angle) * len]], [width * 0.35, width * 0.38, 0.02]), C.barkDark, [x, 0, z], [0, 0, 0], 1, { uv: 'box', uvScale: 0.4 });
      }
    }
    for (let j = 0; j < (near ? 5 : 3); j++) {
      const angle = a + j * 2.39, y = height * (0.62 + j * 0.067), len = 2.5 + r() * 2.8;
      const tip = [x + Math.sin(angle) * len, y + 0.8, z + Math.cos(angle) * len];
      limb(K, 'bark', [x, y - 0.65, z], tip, width * 0.35, 0.05, C.barkDark, {}, 6);
      crowns.push({ pos: tip, width: 2.2 + r() * 1.9, height: 1.0 + r() * 0.5, a: angle, color: j % 3 ? C.leaf : C.leafLight, detailed: near });
      if (near) broadSpray(leaves, [tip[0], tip[1] - 0.1, tip[2]], angle, 7, 1.7, r, true);
    }
    crowns.push({ pos: [x - Math.cos(a) * lean * height, height * 0.98, z + Math.sin(a) * lean * height], width: 2.5 + r() * 1.5, height: 1.6, a, color: C.leaf, detailed: near });
  }
  // Irregular young broadleaf trees and broad fans provide three distinct lower
  // layers; no evenly spaced palm trunks surround the clearing.
  for (let i = 0; i < 70; i++) {
    const stand = stands[i % stands.length], a = r() * TAU, d = r() * 7.3;
    const x = stand[0] + Math.cos(a) * d, z = stand[1] + Math.sin(a) * d;
    if (Math.hypot(x, z) < 15.2 || Math.hypot(x - HERO.x, z - HERO.z) < 10) continue;
    const height = 1.2 + r() * 3.6;
    limb(K, 'vine', [x, 0, z], [x + 0.17, height, z - 0.19], 0.075, 0.018, 0x718058, {}, 5);
    broadSpray(leaves, [x, height, z], a, 7, 1.65 + r() * 0.6, r, i % 4 === 0);
    if (i % 3 === 0) broadSpray(leaves, [x + 0.38, height * 0.6, z - 0.40], a + 1, 5, 1.25, r);
  }
  // Foliage seen through the sluice is deliberately sunlit and lower than the
  // lintel, so the opening reads as a passage instead of a black doorway.
  for (let i = 0; i < 12; i++) broadSpray(leaves, [31 + r() * 9, 1 + r() * 3.6, -5.9 + r() * 8.3], r() * TAU, 7, 1.5 + r() * 0.7, r, true);

  // Uneven, overlapping woodland closes the horizon with three depths. Leave
  // generous gaps between the near trees, then fill those gaps farther away.
  for (let i = 0; i < 112; i++) {
    const a = i * 2.39996 + r() * 0.42, d = 21 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (x > 10 && x < 28 && z > -12 && z < 11) continue;
    const width = 2.2 + r() * 2.4, height = 1.5 + r() * 4.9;
    crowns.push({ pos: [x, height, z], width, height: 1.5 + r() * 1.15, a, color: i % 4 === 0 ? C.leafLight : i % 3 ? C.leaf : C.leafDeep, detailed: true });
    if (i % 2 === 0) {
      broadSpray(leaves, [x, height + 0.7, z], a, 6, 1.7 + r() * 0.7, r, true);
      // Leaning saplings give the middle layer a separate, flexible silhouette.
      const bent = [x + Math.sin(a) * 0.9, height * 0.61, z + Math.cos(a) * 0.9];
      limb(K, 'bark', [x, 0, z], bent, 0.10, 0.065, C.barkDark, {}, 5);
      limb(K, 'bark', bent, [x, height, z], 0.065, 0.015, C.barkDark, {}, 5);
    }
  }
  // A light-filled grove at the far end of the old channel is actually geometry
  // through the opening. It is brighter and looser than the shaded side thickets.
  for (let i = 0; i < 13; i++) {
    const x = 34 + r() * 13, z = -8 + r() * 15, y = 1.8 + r() * 4;
    crowns.push({ pos: [x, y, z], width: 2.8 + r() * 1.8, height: 1.8, a: r() * TAU, color: i % 3 ? 0x8b9f68 : 0x71905d, detailed: true });
  }
  // A continuous far understory closes pale horizon holes between the near
  // trunks. Its irregular lower edge sits in the shaded forest floor, not on
  // thin poles, while the near clearing and the sluice remain unobstructed.
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU + (r() - 0.5) * 0.045, d = 39 + r() * 7;
    crowns.push({ pos: [Math.cos(a) * d, 2.3 + r() * 1.4, Math.sin(a) * d],
      width: 4.1 + r() * 1.6, height: 4.3 + r() * 1.9, a,
      color: i % 3 ? 0x405e46 : 0x526e50, detailed: false });
  }
}

function ferns(K, leaves, r) {
  const patches = [[13.8,-7.4],[15.7,6.4],[20,-10],[-13.9,-4.8],[-14.6,9.6],[-3.2,16.4],[6,-16.4],[14.1,12.5],[-11,-13.2]];
  for (let i = 0; i < 29; i++) {
    const patch = patches[i % patches.length], x = patch[0] + (r() - 0.5) * 2.3, z = patch[1] + (r() - 0.5) * 2.3;
    if (Math.hypot(x, z) < 13.5) continue;
    for (let j = 0; j < 5; j++) {
      const angle = j / 5 * TAU + i * 1.9, length = 1.1 + r() * 0.8;
      const base = [x, 0.05, z], tip = [x + Math.sin(angle) * length, 0.48 + r() * 0.27, z + Math.cos(angle) * length];
      limb(K, 'vine', base, tip, 0.014, 0.005, 0x728448, {}, 4);
      for (let k = 1; k < 6; k++) {
        const t = k / 6, pos = [x + (tip[0] - x) * t, Math.sin(t * Math.PI * 0.70) * 0.8, z + (tip[2] - z) * t];
        for (const side of [-1, 1]) leaves.push({ pos, rot: [-0.09, angle + side * 0.97, side * 0.09], scale: [0.28 * (1 - t * 0.50), 0.22, 0.48 * (1 - t * 0.58)], color: k % 2 ? C.leafLight : C.leaf });
      }
    }
  }
  // Pool-side bird's-nest ferns and elephant-ear leaves are large enough to read
  // in the phone view, with clear gaps between each opaque folded blade.
  for (const [x, y, z] of [[14.2, 1.10, -6.9], [15.5, 1.55, 5.2], [21.2, 2.0, 8.3], [23.9, 1.6, -9.4], [-14.8, 1.4, 3.6], [-7.5, 1.6, -15.1]]) {
    for (let j = 0; j < 8; j++) {
      const angle = j / 8 * TAU + 0.7, len = 1.7 + r() * 0.9;
      const leafBase = [x + Math.sin(angle) * 0.21, y, z + Math.cos(angle) * 0.21];
      limb(K, 'vine', [x, 0.08, z], leafBase, 0.035, 0.022, 0x72845b, {}, 5);
      leaves.push({ pos: leafBase, rot: [-0.12 + r() * 0.42, angle, (r() - 0.5) * 0.32], scale: [len * 0.62, len, len], color: j % 3 ? C.leaf : C.leafLight });
    }
  }
}

// An irregular mud island opens into connected shallows among the tree trunks.
// Opaque water and merged plants avoid reflection passes / alpha-card overdraw.
function wetland(scene, K, leaves, crowns, clock) {
  const r = rng(63981), positions = [], colors = [], uv = [], indices = [];
  const shore = [], shoreColors = [], shoreIndices = [], segments = 144;
  const dark = new THREE.Color(0x91aaa0), pale = new THREE.Color(0xa5b8ab);
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * TAU, inner = islandRadius(a), outer = 36 + Math.sin(a * 4) * 4;
    for (const [j, d] of [inner, outer].entries()) {
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      positions.push(x, 0.018, z); uv.push(x * 0.065, z * 0.065);
      const c = j ? pale : dark; colors.push(c.r, c.g, c.b);
      const sd = inner - (j ? 0 : 0.72);
      shore.push(Math.cos(a) * sd, j ? 0.019 : 0.001, Math.sin(a) * sd);
      const mud = new THREE.Color(j ? 0x38443a : 0x4b4a38); shoreColors.push(mud.r,mud.g,mud.b);
    }
    if(i < segments) {
      const k=i*2; indices.push(k,k+2,k+1,k+1,k+2,k+3);
      shoreIndices.push(k,k+2,k+1,k+1,k+2,k+3);
    }
  }
  // The same irregular outlines drive the visible water and native movement.
  for(const {x:cx,z:cz,rx,rz,phase} of WETLAND_PUDDLES){
    const start=positions.length/3,n=56;
    positions.push(cx,0.018,cz);uv.push(cx*0.065,cz*0.065);colors.push(dark.r,dark.g,dark.b);
    for(let i=0;i<=n;i++){
      const a=i/n*TAU,f=puddleOutline(a,phase),x=cx+Math.cos(a)*rx*f,z=cz+Math.sin(a)*rz*f;
      positions.push(x,0.018,z);uv.push(x*0.065,z*0.065);colors.push(dark.r,dark.g,dark.b);
      if(i<n)indices.push(start,start+i+2,start+i+1);
    }
  }
  const map=canvasTex(512,512,(g,w,h)=>{
    g.fillStyle='#c0cfca';g.fillRect(0,0,w,h);
    // Soft vertical canopy streaks and broken horizontal glints suggest quiet
    // water, not a mirror of scene geometry. The texture tiles at world scale.
    for(let i=0;i<75;i++){
      const x=r()*w,y=r()*h,ww=3+r()*15,hh=15+r()*95;
      const shade=g.createRadialGradient(x,y,0,x,y,hh);shade.addColorStop(0,'rgba(32,56,39,0.08)');shade.addColorStop(1,'rgba(32,56,39,0)');g.fillStyle=shade;g.fillRect(x-ww,y-hh,ww*2,hh*2);
    }
    for(let i=0;i<480;i++){
      g.strokeStyle=i%4?'rgba(44,77,63,0.10)':'rgba(239,247,225,0.68)';
      const x=r()*w,y=r()*h;g.lineWidth=0.6+r()*0.8;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+6,y-1,x+8+r()*30,y);g.stroke();
    }
  });
  const g=geometry(positions,indices);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const material=new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:0.26,metalness:0.025,emissive:0x19332e,emissiveIntensity:0.35});
  material.onBeforeCompile=shader=>{
    shader.uniforms.wetlandTime=clock;
    shader.fragmentShader='uniform float wetlandTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      diffuseColor.rgb *= 0.98 + 0.02 * sin(vMapUv.y * 92.0 + wetlandTime * 0.32 + sin(vMapUv.x * 37.0));`);
  };
  material.customProgramCacheKey=()=> 'sluice-wetland-water-v1';
  const water=new THREE.Mesh(g,material);water.name='sluice-flooded-forest-water';water.receiveShadow=true;scene.add(water);
  const sg=geometry(shore,shoreIndices);sg.setAttribute('color',new THREE.Float32BufferAttribute(shoreColors,3));
  const bank=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.96}));
  bank.name='sluice-irregular-mud-bank';bank.receiveShadow=true;scene.add(bank);

  // Retain high leafy cover, with open spaces underneath where water is visible.
  for(const [x,z] of [[-11,12],[-12,-13],[3,17],[3,-17],[13,13],[14,-13],[25,9],[26,-12]]){
    const a=Math.atan2(z,x),height=8+r()*3,inward=[x*0.68,height,z*0.66];
    limb(K,'bark',[x,0,z],[x,height*0.77,z],0.36,0.16,C.barkDark,{},7);
    limb(K,'bark',[x,height*0.67,z],inward,0.18,0.045,C.barkDark,{},6);
    for(let j=0;j<3;j++){
      const angle=a+j*1.7,p=[inward[0]+Math.sin(angle)*2.3,height+j*0.52,inward[2]+Math.cos(angle)*2.8];
      crowns.push({pos:p,width:3.3+r(),height:1.7,a:angle,color:0x567346,detailed:true});
      broadSpray(leaves,[p[0],p[1]-1.9,p[2]],angle,4,2.1,r);
    }
  }
  // Clumps at broken intervals: sedges, not a regular reed fence around a ring.
  for(let i=0;i<52;i++){
    const a=i*2.39996+0.2*r(),d=12.4+r()*11,x=Math.cos(a)*d,z=Math.sin(a)*d;
    for(let j=0;j<9;j++){
      const angle=r()*TAU,h=0.55+r()*1.25,width=0.035+r()*0.05;
      const blade=geometry([-width,0,0,width,0,0,width*0.6,h*0.65,0.14,0,h,0.4,-width*0.6,h*0.65,0.14], [0,2,1,0,4,2,4,3,2,1,2,0,2,4,0,2,3,4]);
      // Kit expands indexed faces before rebuilding the normal attribute.
      blade.deleteAttribute('normal');
      put(K,'vine',blade,j%3?0x69794a:0x8b935b,[x+(r()-0.5)*0.6,0.02,z+(r()-0.5)*0.6],[0,angle,0]);
    }
    if(i%3===0) broadSpray(leaves,[x,0.55,z],a,4,0.65,r);
  }
  // Flat floating leaves have a visible notch; a few pale buds mark the pools.
  for(let i=0;i<115;i++){
    const a=r()*TAU,d=islandRadius(a)+0.8+r()*13,x=Math.cos(a)*d,z=Math.sin(a)*d;
    const ps=[0,0,0],idx=[];
    for(let j=0;j<=12;j++) { const t=0.16+j/12*(TAU-0.32);ps.push(Math.cos(t),0.015*Math.sin(t)**2,Math.sin(t));if(j<12)idx.push(0,j+2,j+1); }
    const size=0.18+r()*0.34;
    put(K,'leaf',geometry(ps,idx),i%3?0x6c8550:0x91a76a,[x,0.026,z],[0,r()*TAU,0],[size,1,size*0.82]);
    if(i%23===0)put(K,'leaf',new THREE.ConeGeometry(0.06,0.14,5),0xc5c6a3,[x,0.13,z]);
  }
  // Short exposed root arches emerge from shallow water near the forest edge.
  for(let i=0;i<24;i++){
    const a=i*2.39996,d=13.5+r()*7,x=Math.cos(a)*d,z=Math.sin(a)*d,span=0.8+r()*1.4,h=0.35+r()*0.85;
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,0,z),new THREE.Vector3(x+span*0.35,h,z+0.2),new THREE.Vector3(x+span,0.02,z+0.5)]);
    put(K,'bark',new THREE.TubeGeometry(curve,8,0.07+r()*0.06,5,false),C.barkDark,undefined,undefined,1,{uv:'box',uvScale:0.6});
  }
}

function water(scene, K, r) {
  const poolCenter = new THREE.Vector3(17.0, 0.03, -1.35), positions = [poolCenter.x, poolCenter.y, poolCenter.z], colors = [], indices = [];
  const centerColor = new THREE.Color(C.water), edgeColor = new THREE.Color(0x798568);
  colors.push(centerColor.r, centerColor.g, centerColor.b);
  for (let i = 0; i <= 36; i++) {
    const a = i / 36 * TAU, radius = 0.95 + Math.sin(a * 5) * 0.035 + Math.cos(a * 3) * 0.04;
    positions.push(poolCenter.x + Math.cos(a) * 2.42 * radius, poolCenter.y, poolCenter.z + Math.sin(a) * 4.75 * radius);
    colors.push(edgeColor.r, edgeColor.g, edgeColor.b);
    if (i < 36) indices.push(0, i + 2, i + 1);
  }
  const g = geometry(positions, indices); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const pool = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.70, metalness: 0.025 }));
  pool.name = 'sluice-dripping-pool'; pool.receiveShadow = true; scene.add(pool);
  // A narrow remnant channel runs away sideways; all water is outside the orbit.
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU, x = poolCenter.x + Math.cos(a) * 2.58, z = poolCenter.z + Math.sin(a) * 4.93;
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), C.stoneDark, [x, 0.13 + r() * 0.12, z], [0, r() * TAU, 0], [0.35 + r() * 0.35, 0.26 + r() * 0.18, 0.4 + r() * 0.37], { noise: 0.06, snow: 0.66, snowColor: C.moss });
  }
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, d = 0.65 + r() * 0.3;
    put(K, 'leaf', leafGeometry(), 0x665b3c, [poolCenter.x + Math.cos(a) * d * 1.8, 0.045, poolCenter.z + Math.sin(a) * d * 4.5], [0, r() * TAU, 0], [0.26, 0.1, 0.43], { noise: 0.04 });
  }
  const dropPositions = new Float32Array(27), drops = [];
  for (let i = 0; i < 9; i++) drops.push({ x: i === 0 ? 17.62 : 19.27 + r() * 0.05, z: i === 0 ? -1.98 : -3.3 + r() * 4.8, height: i === 0 ? 1.04 : 1.5 + r() * 0.18, phase: r(), period: 1.7 + r() * 1.6 });
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3));
  const points = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xc1d0bc, size: 0.036, transparent: true, opacity: 0.78, depthWrite: false }));
  points.name = 'sluice-falling-drops'; points.frustumCulled = false; scene.add(points);
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xa8b59c, transparent: true, opacity: 0.24, depthWrite: false });
  const ripples = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.009, 3, 32), rippleMaterial.clone());
    ring.name = `sluice-pool-ripple-${i}`; ring.rotation.x = -Math.PI / 2; ring.position.set(i === 0 ? 17.62 : 19.12, 0.044, i === 0 ? -1.98 : -2.8 + i * 1.64); scene.add(ring); ripples.push(ring);
  }
  rippleMaterial.dispose();
  return {
    update(time) {
      drops.forEach((p, i) => {
        const t = i === 0 ? Math.max(0, (time % 4.7 - 4.22) / 0.48) : (time / p.period + p.phase) % 1;
        const y = i === 0 && time % 4.7 < 4.22 ? -1 : 0.05 + p.height * (1 - t * t);
        dropPositions.set([p.x, y, p.z], i * 3);
      });
      dg.attributes.position.needsUpdate = true;
      ripples.forEach((ring, i) => {
        const phase = i === 0 ? Math.min(1, time % 4.7 / 1.2) : ((time + 0.63 * i) % 2.3) / 2.3;
        ring.scale.setScalar(0.035 + phase * 0.48); ring.material.opacity = (1 - phase) * 0.23;
      });
    },
  };
}

function windMaterial(material, clock, amount) {
  material.onBeforeCompile = shader => {
    shader.uniforms.sluiceTime = clock;
    shader.vertexShader = `uniform float sluiceTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sway = sin(sluiceTime * 0.39 + position.x * 0.19 + position.z * 0.23);
      float flutter = sin(sluiceTime * 0.91 + position.z * 0.73) * 0.22;
      float high = smoothstep(0.1, 2.0, position.y);
      transformed.x += (sway + flutter) * high * ${amount.toFixed(4)};
      transformed.z += cos(sluiceTime * 0.31 + position.x * 0.24) * high * ${(amount * 0.55).toFixed(4)};
    `);
  };
  material.customProgramCacheKey = () => `sluice-wind-${amount}`;
  return material;
}

function perchedBird(scene) {
  const bodyKit = new Kit(633991), headKit = new Kit(633992);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  put(bodyKit, 'bird', new THREE.IcosahedronGeometry(1, 1), 0x948957, [0, 0.16, 0], [0.14, 0, 0], [0.13, 0.19, 0.24]);
  for (const side of [-1, 1]) put(bodyKit, 'bird', new THREE.IcosahedronGeometry(1, 0), 0x435541, [side * 0.095, 0.20, -0.035], [0.30, 0, side * 0.07], [0.055, 0.13, 0.20]);
  put(bodyKit, 'bird', box(0.082, 0.025, 0.30), 0x4e5c42, [0, 0.10, -0.27], [-0.25, 0, 0]);
  for (const side of [-1, 1]) limb(bodyKit, 'bird', [side * 0.057, -0.015, 0.055], [side * 0.063, 0.10, 0.035], 0.014, 0.013, 0x766346, {}, 4);
  put(headKit, 'bird', new THREE.IcosahedronGeometry(1, 1), 0xb1a065, [0, 0, 0], [0, 0, 0], [0.105, 0.11, 0.12]);
  put(headKit, 'bird', new THREE.ConeGeometry(0.026, 0.10, 4), 0x8f7a40, [0, -0.019, 0.143], [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) put(headKit, 'bird', new THREE.IcosahedronGeometry(1, 0), 0x192b21, [side * 0.094, 0.018, 0.065], [0, 0, 0], 0.018);
  const root = new THREE.Group(); root.name = 'sluice-perched-woodland-bird'; root.position.set(21.95, 1.38, -7.70); root.rotation.y = -1.2;
  const body = bodyKit.mesh('bird', material), head = headKit.mesh('bird', material);
  body.name = 'sluice-bird-body'; head.name = 'sluice-bird-head'; head.position.set(0, 0.32, 0.11); root.add(body, head); scene.add(root);
  for (const kit of [bodyKit, headKit]) for (const g of kit.bins.bird) g.dispose();
  return { update(time, call) { head.rotation.x = -call * 0.18; head.rotation.y = Math.sin(time * 0.22) * 0.19; body.scale.y = 1 + call * 0.035; } };
}

/** Bounded, deterministic scenery. No physics bodies, global timers or RNG use. */
export function buildSluice(scene, { hemi, sun } = {}) {
  const r = rng(633917), K = new Kit(637317), leaves = [], crowns = [], clock = { value: 0 };
  const sunOffset = { x: -6.2, y: 11.0, z: -7.2 };
  scene.background = new THREE.Color(0x94a58e);
  scene.fog = new THREE.Fog(0x7b9176, 26, 90);
  if (hemi) { hemi.color.set(0xdde7d4); hemi.groundColor.set(0x807664); hemi.intensity = 1.23; }
  if (sun) { sun.color.set(0xffedd0); sun.intensity = 1.42; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  const soil = soilTexture(), stone = stoneTexture(), bark = barkTexture();
  ground(scene, soil); paving(K, r); sluice(K, leaves, crowns, r); forest(K, leaves, crowns, r); ferns(K, leaves, r); wetland(scene, K, leaves, crowns, clock);
  const bear = buildSluiceBear(scene, { stoneMap: stone, position: [14, 0, -2] });
  const pool = water(scene, K, r);
  const birdModel = perchedBird(scene);
  // Fallen stones and leaf litter occupy forest margins, not the camera lane.
  for (let i = 0; i < 36; i++) {
    const a = r() * TAU, d = 14.6 + r() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 10) continue;
    const size = 0.35 + r() * 0.85;
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), C.stoneDark, [x, size * 0.22, z], [0, a, 0], [size, size * 0.48, size * 0.8], { noise: 0.09, snow: 0.65, snowColor: C.moss });
  }
  for (let i = 0; i < 110; i++) {
    const a = r() * TAU, d = 10.9 + r() * 20;
    put(K, 'leaf', leafGeometry(), i % 3 ? 0x81734b : 0x6a5b3c, [Math.cos(a) * d, 0.015, Math.sin(a) * d], [0, a, 0], [0.14 + r() * 0.19, 0.12, 0.23 + r() * 0.25], { vary: 0.17, noise: 0.03 });
  }
  const leaf = leafGeometry(), crownFine = canopyGeometry(true), crownCoarse = canopyGeometry(false);
  for (const f of leaves) K.put('leaf', leaf, f.color, f.pos, f.rot, f.scale, { noise: 0.025, vary: 0.14 });
  for (const f of crowns) K.put('crown', f.detailed ? crownFine : crownCoarse, f.color, f.pos, [0, f.a, 0.06], [f.width, Math.max(f.height * 1.55, f.width * 0.91), f.width * 0.85], { noise: 0.025, vary: 0.15 });
  leaf.dispose(); crownFine.dispose(); crownCoarse.dispose();
  const materials = {
    paving: new THREE.MeshStandardMaterial({ map: stone, vertexColors: true, roughness: 0.96 }),
    stone: new THREE.MeshStandardMaterial({ map: stone, vertexColors: true, roughness: 0.94, flatShading: true }),
    bark: new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 1, flatShading: true }),
    stain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    vine: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    leaf: windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }), clock, 0.047),
    crown: windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), clock, 0.065),
  };
  let triangleCount = 0;
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = K.mesh(bin, material, { cast: bin === 'stone' || bin === 'bark', receive: true,
      light: bin === 'bark' ? (x, y, z) => {
        const near = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - HERO.x, z - HERO.z), 4, 11);
        const patch = near * Math.exp(-Math.pow((z - HERO.z - 3.7 + y * 0.18) / 2.1, 2));
        return [patch * 0.24, patch * 0.19, patch * 0.10];
      } : null });
    if (mesh) { mesh.name = `sluice-${bin}`; triangleCount += mesh.geometry.attributes.position.count / 3; scene.add(mesh); }
    else material.dispose();
    for (const g of K.bins[bin] || []) g.dispose();
  }
  let time = 0, lastDrip = 0, lastRustle = -10, lastBird = -20, lastDetail = -3, gust = 0;
  let previousDripPhase = 0, previousWind = Math.sin(1.2), previousBird = Math.sin(-1.4);
  const stage = {
    sunOffset,
    fighterLight: { color: 0xf1eedb, rimColor: 0xe2e9d2, level: 0.89, rim: 1.04 },
    waterPulse: 0,
    visualDetails: { bear: { position: bear.mesh.position.toArray(), triangles: bear.triangleCount }, hero: { ...HERO }, pool: { x: 17, y: 0.03, z: -1.35 }, flatRadius: 6.5, clearOrbit: 10.5, wetland: { waterLevel: 0.018, innerMin: 7.3, outerMax: 40 }, mergedTriangles: triangleCount, leafCount: leaves.length, crownCount: crowns.length },
    update(dt) {
      const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
      if (step === 0) return;
      time += step; gust *= Math.exp(-step * 1.5); clock.value = time; pool.update(time);
      const dripPhase = time % 4.7, wind = Math.sin(time * 0.39 + 1.2), bird = Math.sin(time * 0.123 - 1.4);
      stage.waterPulse = dripPhase < 1.2 ? (1 - dripPhase / 1.2) ** 2 : 0;
      birdModel.update(time, Math.max(0, (bird - 0.982) / 0.018));
      if (dripPhase < previousDripPhase && time - lastDrip >= 2.5 && time - lastDetail >= 2) {
        stage.onEvent?.('stageDetail', { kind: 'sluiceDrip', amp: 0.7, pos: { x: 17.62, y: 0.07, z: -1.98 }, seed: 637318, time });
        lastDrip = lastDetail = time;
      }
      if (wind > 0.88 && previousWind <= 0.88 && time - lastRustle >= 8 && time - lastDetail >= 2) {
        stage.onEvent?.('stageDetail', { kind: 'jungleRustle', amp: 0.6 + gust * 0.04, pos: { x: 19.7, y: 11, z: 4.5 }, seed: 637319, time });
        lastRustle = lastDetail = time;
      }
      if (bird > 0.985 && previousBird <= 0.985 && time - lastBird >= 30 && time - lastDetail >= 2) {
        stage.onEvent?.('stageDetail', { kind: 'jungleBird', amp: 0.8, pos: { x: 21.95, y: 1.70, z: -7.70 }, seed: 637320, time });
        lastBird = lastDetail = time;
      }
      previousDripPhase = dripPhase; previousWind = wind; previousBird = bird;
    },
    excite(amount = 0) { if (Number.isFinite(amount)) gust = Math.min(1, gust + Math.max(0, amount) * 0.08); },
  };
  pool.update(0);
  return stage;
}
