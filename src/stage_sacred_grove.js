// Yeongman's sacred cedar grove. The level is visual only: the existing flat arena
// and camera remain authoritative. All trunks, roots, gates and large rocks stay
// outside the 10.5m camera orbit; the 6.5m fighting floor has only flush stones.
import * as THREE from 'three';
import { rng, h3, Kit, canvasTex, UP } from './stage_kit.js';

const TAU = Math.PI * 2;
const HERO = { x: 21, z: -3 };
const C = {
  earth: 0xd3cbb1, moss: 0x6a8a7a, deepMoss: 0x3f6e60,
  stone: 0x96a399, bark: 0x958b77, barkDark: 0x606a60,
  leaf: 0x588e76, leafLit: 0x95b68e, leafDeep: 0x3c7060,
  rope: 0xd1bf8e, paper: 0xf3f0dc, vermilion: 0xa54f38,
};

function barkTexture() {
  const r = rng(913);
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c9c5b8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 360; i++) {
      const x = r() * w, y = r() * h;
      ctx.strokeStyle = `rgba(${r() < 0.62 ? '50,50,39' : '247,244,220'},${0.08 + r() * 0.26})`;
      ctx.lineWidth = 0.45 + r() * 2.3;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + r() * 7, y + 30, x - r() * 8, y + 70, x + (r() - 0.5) * 12, y + 35 + r() * 190); ctx.stroke();
    }
    for (let i = 0; i < 1300; i++) {
      ctx.fillStyle = `rgba(39,44,34,${r() * 0.12})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 15);
    }
  });
}

function soilTexture() {
  const r = rng(702);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d8d6ca'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4100; i++) {
      const v = 90 + Math.floor(r() * 150);
      ctx.fillStyle = `rgba(${v},${v},${v},${0.12 + r() * 0.3})`;
      ctx.fillRect(r() * w, r() * h, 0.4 + r() * 2.2, 0.4 + r() * 1.5);
    }
    for (let i = 0; i < 38; i++) {
      ctx.strokeStyle = 'rgba(74,72,56,0.1)'; ctx.lineWidth = 0.6;
      const x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5 + r() * 10, y + (r() - 0.5) * 9); ctx.stroke();
    }
  });
}

// A cedar spray has a branching silhouette, with no solid sphere or cone canopy.
function sprayTexture() {
  const r = rng(828);
  return canvasTex(256, 192, (ctx) => {
    ctx.clearRect(0, 0, 256, 192);
    const twig = (ax, ay, bx, by, width) => {
      ctx.strokeStyle = '#dae7db'; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      for (let k = 1; k <= 10; k++) {
        const t = k / 11, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const len = (8 + r() * 10) * (1 - t * 0.35);
        for (const side of [-1, 1]) {
          ctx.strokeStyle = r() > 0.35 ? '#dde9dc' : '#abc1b3'; ctx.lineWidth = 2 + r() * 1.6;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.65, y + side * len); ctx.stroke();
        }
      }
    };
    twig(17, 113, 237, 91, 3.5);
    for (let i = 0; i < 13; i++) {
      const x = 37 + i * 14, y = 113 - (x - 17) * 0.1;
      const reach = (1 - Math.abs(i - 5) / 10) * (40 + r() * 14);
      twig(x, y, x + 30 + r() * 9, y - reach, 2);
      twig(x, y, x + 23 + r() * 12, y + reach * 0.76, 2);
    }
  });
}

function trunkGeometry(height, radius, seed, hero = false) {
  const sides = hero ? 28 : 10, levels = hero ? 13 : 5;
  const pos = [], uv = [], indices = [];
  for (let j = 0; j <= levels; j++) {
    const t = j / levels, y = height * t;
    const taper = (0.14 + 0.86 * Math.pow(1 - t, 0.7));
    const flare = 1 + 0.44 * Math.exp(-t * 24);
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU;
      const flute = 1 + 0.07 * Math.sin(a * 7 + t * 2) + 0.045 * Math.sin(a * 11 - t * 4 + seed);
      const rad = radius * taper * flare * flute;
      pos.push(Math.cos(a) * rad + Math.sin(t * 2.1 + seed) * t * height * 0.025, y, Math.sin(a) * rad + t * t * height * 0.024);
      uv.push(i / sides * (hero ? 4 : 1), t * (hero ? 3 : 1.5));
      if (j < levels && i < sides) {
        const n = j * (sides + 1) + i;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function put(K, bin, geo, color, pos, rot = [0, 0, 0], scale = 1, opt = {}) {
  K.put(bin, geo, color, pos, rot, scale, opt); geo.dispose();
}
function branch(K, a, b, ra, rb, color = C.bark, bin = 'bark', sides = 7) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), dir = bv.clone().sub(av);
  const g = new THREE.CylinderGeometry(rb, ra, dir.length(), sides, 1, true);
  const m = new THREE.Matrix4().compose(av.add(bv).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), new THREE.Vector3(1, 1, 1));
  K.putM(bin, g, color, m, { vary: 0.16, noise: 0.045 }); g.dispose();
}

function ground(scene, texture) {
  // Radial tessellation gives the fighting floor detail without a huge far mesh.
  const pos = [], uv = [], colors = [], indices = [], rings = 48, segments = 128;
  const base = new THREE.Color(C.earth), moss = new THREE.Color(C.moss), dark = new THREE.Color(C.deepMoss), tmp = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    const rad = j <= 26 ? j * 0.5 : 13 + Math.pow((j - 26) / 22, 1.5) * 83;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const forest = THREE.MathUtils.smoothstep(rad, 7.0 + Math.sin(a * 5) * 0.38, 13.8 + Math.sin(a * 3) * 0.9);
      const shade = (Math.sin(x * 0.86 + Math.sin(z * 0.63)) * Math.sin(z * 0.74 - x * 0.22) + 1) * 0.5;
      tmp.copy(base).lerp(moss, forest).lerp(dark, forest * (0.1 + shade * 0.4));
      tmp.multiplyScalar(0.84 + shade * 0.24 + h3(x, 0, z, 79) * 0.055);
      // Flat at and well beyond the duel boundary. Terrain only rises deep in forest.
      let y = rad <= 12 ? -0.055 : -0.055 + THREE.MathUtils.smoothstep(rad, 12, 25) * (0.23 + Math.sin(x * 0.17) * Math.cos(z * 0.22) * 0.4);
      const bank = Math.abs(x - (27.5 + Math.sin(z * 0.12) * 2.4));
      if (Math.abs(z) < 37 && bank < 2.3) y = THREE.MathUtils.lerp(0.005, y, THREE.MathUtils.smoothstep(bank, 1.1, 2.3));
      pos.push(x, y, z); uv.push(x * 0.35, z * 0.35); colors.push(tmp.r, tmp.g, tmp.b);
      if (j < rings && i < segments) { const k = j * (segments + 1) + i; indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 1 })); mesh.receiveShadow = true; mesh.name = 'grove-flat-duel-earth'; scene.add(mesh);
}

function cedar(K, foliage, r, x, z, height, radius, hero = false) {
  put(K, 'bark', trunkGeometry(height, radius, Math.floor(r() * 200), hero), hero ? C.bark : C.barkDark, [x, 0, z], [0, 0, 0], 1, { noise: 0.035, vary: 0.12 });
  if (hero) {
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * TAU + 0.15, len = 5.0 + r() * 1.45;
      const p0 = [x + Math.cos(a) * radius * 0.64, 1.55 + r() * 0.8, z + Math.sin(a) * radius * 0.64];
      const p1 = [x + Math.cos(a) * radius * 1.23, 0.28, z + Math.sin(a) * radius * 1.23];
      const p2 = [x + Math.cos(a + 0.1) * len, 0.02, z + Math.sin(a + 0.1) * len];
      branch(K, p0, p1, 0.75, 0.5, C.bark); branch(K, p1, p2, 0.5, 0.07, C.bark);
    }
  }
  const count = hero ? 22 : 10;
  for (let j = 0; j < count; j++) {
    const t = 0.37 + j / count * 0.55, y = height * t;
    const a = j * 2.39996 + r() * 0.35, len = (hero ? 8.0 : height * 0.24) * (1.22 - t) * (0.78 + r() * 0.44);
    const p0 = [x, y, z], p1 = [x + Math.cos(a) * len * 0.52, y + 0.15, z + Math.sin(a) * len * 0.52];
    const p2 = [x + Math.cos(a) * len, y - len * 0.17, z + Math.sin(a) * len];
    const br = radius * (1 - t) * (hero ? 0.33 : 0.2);
    branch(K, p0, p1, br, br * 0.56); branch(K, p1, p2, br * 0.56, 0.035);
    for (let k = 0; k < (hero ? 13 : 6); k++) {
      const s = 0.28 + r() * 0.8, width = (hero ? 2.1 : 1.25) * (0.78 + r() * 0.72);
      foliage.push({ x: x + Math.cos(a) * len * s + (r() - 0.5) * len * 0.6, y: y - len * s * 0.12 + (r() - 0.5) * 0.65, z: z + Math.sin(a) * len * s + (r() - 0.5) * len * 0.6, width, a: a + (r() - 0.5) * 1.8, tilt: (r() - 0.5) * 0.7, color: r() < 0.25 ? C.leafLit : r() < 0.25 ? C.leafDeep : C.leaf });
    }
  }
}

function sacredRope(K) {
  // Three visibly braided strands follow the natural trunk at chest/head height.
  for (let strand = 0; strand < 3; strand++) {
    const points = [];
    for (let i = 0; i <= 144; i++) {
      const a = i / 144 * TAU, twist = a * 23 + strand / 3 * TAU;
      const rad = 3.12 + Math.cos(twist) * 0.095;
      points.push(new THREE.Vector3(HERO.x + Math.cos(a) * rad, 3.0 + Math.sin(a * 2) * 0.07 + Math.sin(twist) * 0.095, HERO.z + Math.sin(a) * rad));
    }
    put(K, 'ritual', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 180, 0.092, 5, true), C.rope, [0, 0, 0], [0, 0, 0], 1, { noise: 0.04 });
  }
  // Folded shide paper, sparse and deliberately readable against the cedar bark.
  for (let n = 0; n < 5; n++) {
    const a = Math.PI * 0.57 + n * Math.PI * 0.22, x = HERO.x + Math.cos(a) * 3.28, z = HERO.z + Math.sin(a) * 3.28;
    branch(K, [x, 2.96, z], [x, 2.57, z], 0.022, 0.015, C.rope, 'ritual', 4);
    const points = [0, 0, 0.19, -0.09, 0.11, -0.27, 0.31, -0.32, 0.16, -0.53, 0.34, -0.6, 0.12, -0.87, -0.02, -0.8, 0.11, -0.59, -0.07, -0.52, 0.06, -0.3, -0.12, -0.25];
    const shape = new THREE.Shape(); shape.moveTo(points[0], points[1]); for (let k = 2; k < points.length; k += 2) shape.lineTo(points[k], points[k + 1]); shape.closePath();
    put(K, 'paper', new THREE.ShapeGeometry(shape), C.paper, [x, 2.56, z], [0, Math.PI / 2 - a, 0], 1, { noise: 0, vary: 0.02 });
  }
}

function torii(K) {
  // Small, off-axis and weathered: architecture remains secondary to the cedar.
  K.push([13.8, 0, 13.7], -0.76);
  for (const s of [-1, 1]) {
    branch(K, [s * 1.55, 0, 0], [s * 1.36, 4.5, 0], 0.18, 0.155, C.vermilion, 'paint', 10);
    put(K, 'stone', new THREE.CylinderGeometry(0.26, 0.32, 0.3, 8), C.stone, [s * 1.55, 0.11, 0]);
    put(K, 'paint', new THREE.BoxGeometry(0.28, 0.3, 0.28), 0x705b46, [s * 1.4, 3.17, 0]);
  }
  put(K, 'paint', new THREE.BoxGeometry(4.1, 0.21, 0.3), C.vermilion, [0, 3.2, 0], [0, 0, 0], 1, { vary: 0.1, noise: 0.09 });
  put(K, 'paint', new THREE.BoxGeometry(4.55, 0.27, 0.42), C.vermilion, [0, 4.27, 0], [0, 0, 0], 1, { noise: 0.09 });
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.56, y = 4.53 + Math.pow(Math.abs(x) / 2.24, 2) * 0.2;
    put(K, 'paint', new THREE.BoxGeometry(0.59, 0.17, 0.51), 0x3d4740, [x, y, 0], [0, 0, i * 0.022]);
  }
  put(K, 'paint', new THREE.BoxGeometry(0.13, 0.88, 0.23), C.vermilion, [0, 3.75, 0]);
  K.pop();
}

function plants(scene, r) {
  const positions = [], normals = [];
  for (let f = 0; f < 7; f++) {
    const a = f / 7 * TAU;
    for (let j = 0; j < 6; j++) {
      const t = j / 6, t1 = (j + 1) / 6, width = Math.sin((t + 0.08) * Math.PI) * 0.11;
      const p = [Math.cos(a) * t * 0.85, Math.sin(t * Math.PI * 0.78) * 0.55, Math.sin(a) * t * 0.85];
      const q = [Math.cos(a) * t1 * 0.85, Math.sin(t1 * Math.PI * 0.78) * 0.55, Math.sin(a) * t1 * 0.85];
      const dx = Math.sin(a) * width, dz = -Math.cos(a) * width;
      positions.push(p[0] + dx, p[1], p[2] + dz, p[0] - dx, p[1], p[2] - dz, q[0], q[1], q[2]);
      for (let n = 0; n < 3; n++) normals.push(0, 1, 0);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x80956a, roughness: 1, side: THREE.DoubleSide }), 180);
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < 180; i++) {
    const a = r() * TAU, rad = 11.9 + r() * 19;
    dummy.position.set(Math.cos(a) * rad, 0.01, Math.sin(a) * rad); dummy.rotation.y = r() * TAU; dummy.scale.setScalar(0.45 + r() * 0.9); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, c.set(C.leaf).lerp(new THREE.Color(C.leafLit), r()));
  }
  mesh.name = 'grove-ferns-outside-camera'; scene.add(mesh);
}

function stream(scene, K, r) {
  // The shallow stream is 26m beyond the floor, never crossing the arena.
  const pos = [], uv = [], indices = [];
  for (let i = 0; i <= 44; i++) {
    const z = -35 + i * 1.6, x = 27.5 + Math.sin(z * 0.12) * 2.4;
    for (const s of [-1, 1]) { pos.push(x + s * (1.0 + Math.sin(z * 0.26) * 0.2), 0.19, z); uv.push(s === -1 ? 0 : 1, i / 5); }
    if (i < 44) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    if (i % 2 === 0) for (const s of [-1, 1]) put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), C.stone, [x + s * (1.4 + r() * 0.2), 0.14, z], [r(), r() * TAU, r()], [0.45 + r() * 0.6, 0.24 + r() * 0.18, 0.55 + r() * 0.5], { rough: 0.06, noise: 0.08 });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  const texture = canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#879e96'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 85; i++) { ctx.fillStyle = `rgba(224,234,214,${0.06 + r() * 0.23})`; ctx.fillRect(r() * w, r() * h, 3 + r() * 20, 0.5 + r() * 1.4); }
  });
  const material = new THREE.MeshStandardMaterial({ color: 0xb9cbc1, map: texture, roughness: 0.28, metalness: 0.12 });
  const mesh = new THREE.Mesh(g, material); mesh.name = 'grove-distant-stream'; scene.add(mesh); return texture;
}

function distantMist(scene) {
  const texture = canvasTex(128, 128, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(218,232,218,0)'); gradient.addColorStop(0.38, 'rgba(218,232,218,0.35)'); gradient.addColorStop(0.74, 'rgba(218,232,218,0.66)'); gradient.addColorStop(1, 'rgba(218,232,218,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  for (const [radius, height, opacity] of [[34, 7, 0.14], [51, 10, 0.2], [70, 13, 0.25]]) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xc7d9cc, map: texture, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.y = height * 0.43; mesh.name = 'grove-forest-mist'; scene.add(mesh);
  }
}

/** Build a bounded, disposable visual stage, using only isolated seeded RNG. */
export function buildSacredGrove(scene, { hemi, sun } = {}) {
  const r = rng(197719), K = new Kit(88291), foliage = [];
  const sunOffset = { x: -5.5, y: 10, z: -4.5 };
  scene.background = new THREE.Color(0xc7d7cc); scene.fog = new THREE.Fog(0xb2c9bd, 26, 112);
  if (hemi) { hemi.color.set(0xdbe8dd); hemi.groundColor.set(0x859786); hemi.intensity = 1.42; }
  if (sun) { sun.color.set(0xfff6e5); sun.intensity = 1.4; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  const soil = soilTexture(), bark = barkTexture();
  ground(scene, soil);

  // Unevenly spaced, almost flush moss stones suggest the 6.5m combat boundary.
  for (let i = 0; i < 61; i++) {
    if (i % 19 < 3) continue;
    const a = i / 61 * TAU, d = 6.57 + (r() - 0.5) * 0.1;
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), i % 4 === 0 ? 0xa0a698 : C.stone, [Math.cos(a) * d, -0.035, Math.sin(a) * d], [0, r() * TAU, 0], [0.21 + r() * 0.09, 0.075, 0.32 + r() * 0.15], { rough: 0.022, noise: 0.08 });
  }
  // Moss-stained boulders stay outside the full camera orbit including their size.
  for (let i = 0; i < 51; i++) {
    const a = r() * TAU, d = 14.2 + r() * 23, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 7 || Math.hypot(x - 13.8, z - 13.7) < 4) continue;
    const size = 0.5 + r() * 1.45;
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), C.stone, [x, size * 0.26, z], [r() * 0.3, r() * TAU, r() * 0.3], [size, size * 0.65, size * 0.8], { rough: 0.12, noise: 0.12, snow: 0.86, snowColor: C.moss });
  }
  cedar(K, foliage, r, HERO.x, HERO.z, 29, 3.08, true);
  sacredRope(K); torii(K);

  for (let i = 0; i < 95; i++) {
    const a = i * 2.39996 + r() * 0.45, d = i < 22 ? 17.8 + r() * 11 : 30 + r() * 54;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 10 || Math.hypot(x - 13.8, z - 13.7) < 5) continue;
    const h = 16 + r() * 18;
    cedar(K, foliage, r, x, z, h, 0.28 + r() * 0.47);
  }

  // Layered low shrubs close the distant forest floor without enclosing the duel.
  for (let i = 0; i < 115; i++) {
    const a = r() * TAU, d = 20 + r() * 58, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 7 || Math.hypot(x - 13.8, z - 13.7) < 5) continue;
    for (let j = 0; j < 6; j++) foliage.push({ x: x + (r() - 0.5) * 3, y: 0.4 + r() * 1.6, z: z + (r() - 0.5) * 3, width: 1.0 + r() * 1.15, a: r() * TAU, tilt: (r() - 0.5) * 1.2, color: r() < 0.25 ? C.leafLit : C.leafDeep });
  }

  const spray = sprayTexture();
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: spray, alphaTest: 0.38, transparent: false, side: THREE.DoubleSide, roughness: 1 }), foliage.length * 2);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  foliage.forEach((f, i) => {
    for (let j = 0; j < 2; j++) {
      dummy.position.set(f.x, f.y, f.z); dummy.rotation.set(j ? -0.7 + f.tilt : f.tilt, f.a + j * 1.2, j ? 0.35 : -0.12); dummy.scale.set(f.width * 2.15, f.width * 1.35, 1); dummy.updateMatrix(); leaves.setMatrixAt(i * 2 + j, dummy.matrix); leaves.setColorAt(i * 2 + j, color.set(f.color));
    }
  });
  leaves.name = 'grove-cedar-sprays'; leaves.castShadow = false; scene.add(leaves);
  plants(scene, r);
  const water = stream(scene, K, r); distantMist(scene);

  const materials = {
    bark: new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 0.97 }),
    stone: new THREE.MeshStandardMaterial({ map: soil, vertexColors: true, roughness: 1, flatShading: true }),
    ritual: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    paper: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }),
    paint: new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 0.95 }),
  };
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = K.mesh(bin, material, { cast: bin === 'stone', receive: true });
    if (mesh) { mesh.name = `grove-${bin}`; scene.add(mesh); } else material.dispose();
    for (const geometry of K.bins[bin] || []) geometry.dispose();
  }

  // Twenty-four restrained drifting seeds, kept outside the duel floor.
  const count = 24, positions = new Float32Array(count * 3), seeds = [];
  for (let i = 0; i < count; i++) { const a = r() * TAU, d = 12 + r() * 13; seeds.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 1.3 + r() * 5, phase: r() * TAU }); positions.set([seeds[i].x, seeds[i].y, seeds[i].z], i * 3); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xe0dcc1, size: 0.028, transparent: true, opacity: 0.48, depthWrite: false })); motes.name = 'grove-drifting-seeds'; scene.add(motes);
  let time = 0, gust = 0;
  return {
    sunOffset,
    fighterLight: { color: 0xf1edda, rimColor: 0xdbeadf, level: 0.84, rim: 1.08 },
    update(dt) {
      const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1); time += step; gust *= Math.exp(-step * 1.6);
      water.offset.y = time * 0.012;
      for (let i = 0; i < count; i++) { const p = seeds[i]; positions[i * 3] = p.x + Math.sin(time * 0.18 + p.phase) * (0.45 + gust * 0.2); positions[i * 3 + 1] = p.y + Math.sin(time * 0.23 + p.phase) * 0.5; positions[i * 3 + 2] = p.z + Math.cos(time * 0.12 + p.phase) * 0.4; }
      moteGeo.attributes.position.needsUpdate = true;
    },
    excite(amount = 0) { if (Number.isFinite(amount)) gust = Math.min(1.5, gust + Math.max(0, amount) * 0.12); },
  };
}
