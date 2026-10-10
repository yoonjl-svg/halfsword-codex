// Static shores for Eira's inland frozen bay. +X remains the open lake;
// all scenery is beyond the duel/camera space and creates no physics bodies.
import * as THREE from 'three';
import { Kit, rng, box, cyl, limb } from './stage_kit.js';

const TAU = Math.PI * 2;
const BANK_ROWS = [0, 0.8, 2.8, 8, 19, 35];
const BANK_HEIGHTS = [0.12, 0.57, 1.05, 1.55, 1.9, 2.2];
const C = {
  snow: 0xb8c6d1, snowTop: 0xd4dde2, snowShade: 0x8296a7,
  rock: 0x394952, bark: 0x373d43, twig: 0x444950,
  wood: 0x605e59, woodDark: 0x353d43, rope: 0x787b75,
  pine: 0x243d42, ice: 0x7194a8,
};

// Kit copies construction geometries. Dispose each original, including the
// temporary cylinders made inside limb(), then the copied bins after merging.
class ShoreKit extends Kit {
  putM(bin, geo, color, matrix, options = {}) {
    try { return super.putM(bin, geo, color, matrix, options); }
    finally { geo.dispose(); }
  }
}

function shoreRadius(a) {
  return 29 + 7 * Math.sin(a * 2 + 0.7) + 3 * Math.cos(a * 3 - 0.3)
    + 0.65 * Math.sin(a * 11);
}

function bankRowHeight(a, j) {
  return Math.max(0.06, BANK_HEIGHTS[j] + (0.1 + j * 0.07) * Math.sin(a * 5 + j * 0.65)
    + 0.1 * Math.cos(a * 17));
}

function bankHeight(x, z) {
  const a = (Math.atan2(z, x) + TAU) % TAU;
  const depth = Math.hypot(x, z) - shoreRadius(a);
  for (let j = 0; j < BANK_ROWS.length - 1; j++) {
    if (depth <= BANK_ROWS[j + 1]) {
      const t = THREE.MathUtils.clamp((depth - BANK_ROWS[j]) / (BANK_ROWS[j + 1] - BANK_ROWS[j]), 0, 1);
      return THREE.MathUtils.lerp(bankRowHeight(a, j), bankRowHeight(a, j + 1), t);
    }
  }
  return bankRowHeight(a, BANK_ROWS.length - 1);
}

function geometry(positions) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function shoreLand(K) {
  const positions = [];
  const rows = BANK_ROWS;
  const n = 88;
  const point = (i, j) => {
    const a = 0.48 + (TAU - 1.06) * i / n;
    const d = shoreRadius(a) + rows[j];
    return [Math.cos(a) * d, bankRowHeight(a, j), Math.sin(a) * d];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const a = point(i, j), b = point(i + 1, j);
      const c = point(i, j + 1), d = point(i + 1, j + 1);
      positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }
  const g = K.put('land', geometry(positions), C.snow, undefined, undefined, 1,
    { vary: 0, noise: 0.025 });
  const p = g.attributes.position, colors = g.attributes.color;
  const snow = new THREE.Color(C.snow), shadow = new THREE.Color(C.snowShade);
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const shade = 0.08 + 0.18 * (0.5 + 0.5 * Math.sin(p.getX(i) * 0.16 + p.getZ(i) * 0.2));
    color.copy(snow).lerp(shadow, shade);
    colors.setXYZ(i, color.r, color.g, color.b);
  }
}

function lowHills(K) {
  // Three overlapping broad ridges, with no alpine peaks or enclosing wall.
  for (let layer = 0; layer < 3; layer++) {
    const positions = [];
    const n = 76;
    const point = (i, row) => {
      const t = i / n;
      const a = 0.18 + (TAU - 0.44) * t;
      const d = 73 + layer * 19 + row * 12 + 4 * Math.sin(a * 3 + layer);
      const crest = 4.8 + layer * 1.15 + 2.9 * Math.sin(a * 2.3 + layer * 0.6)
        + 1.5 * Math.sin(a * 6.2 + layer) + 0.55 * Math.sin(a * 13.7 + layer);
      // The headlands descend into the frozen lake. Full-height arc endpoints
      // otherwise read as rectangular walls when viewed toward the bay mouth.
      const taper = THREE.MathUtils.smoothstep(t, 0, 0.16)
        * THREE.MathUtils.smoothstep(1 - t, 0, 0.18);
      return [Math.cos(a) * d, row === 1 ? (crest + 0.3) * taper - 0.3 : -0.3, Math.sin(a) * d];
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
      const a = point(i, j), b = point(i + 1, j), c = point(i, j + 1), d = point(i + 1, j + 1);
      positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    K.put('far', geometry(positions), [0x314b5b, 0x3d5669, 0x4b6375][layer], undefined, undefined, 1,
      { vary: 0, noise: 0.012 });
  }
  // The opposite shore is a thin, unbroken silhouette through the open +X gap.
  // Very low relief and distance haze keep the broad frozen lake readable.
  const positions = [];
  const point = (i, ridge) => {
    const a = i / 108 * TAU;
    const d = 181 + Math.sin(a * 3) * 5 + (ridge ? 5 : 0);
    const y = ridge ? 2.2 + 0.8 * Math.sin(a * 5 + 0.4) + 0.5 * Math.sin(a * 11) : -0.4;
    return [Math.cos(a) * d, y, Math.sin(a) * d];
  };
  for (let i = 0; i < 108; i++) {
    const a = point(i, 0), b = point(i + 1, 0), c = point(i, 1), d = point(i + 1, 1);
    positions.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  K.put('far', geometry(positions), 0x6d8396, undefined, undefined, 1, { vary: 0, noise: 0 });
}

function bareLarch(K, r, x, z, h, detailed) {
  const leanX = (r() - 0.5) * 0.43, leanZ = (r() - 0.5) * 0.43;
  const baseY = bankHeight(x, z) - 0.18;
  K.push([x, baseY, z], r() * TAU);
  limb(K, 'wood', [0, -0.2, 0], [leanX * 0.65, h * 0.65, leanZ * 0.65], h * 0.024, h * 0.013, C.bark, { noise: 0.08 }, 6);
  limb(K, 'wood', [leanX * 0.65, h * 0.65, leanZ * 0.65], [leanX, h, leanZ], h * 0.013, 0.012, C.bark, {}, 5);
  const tiers = detailed ? 6 : 4;
  const twist = r() * TAU;
  for (let k = 0; k < tiers; k++) {
    const t = 0.28 + k * 0.64 / tiers;
    const spread = h * 0.32 * (1 - t) * (0.9 + r() * 0.25);
    const branches = detailed ? 4 : 3;
    for (let j = 0; j < branches; j++) {
      const a = twist + j * TAU / branches + k * 1.27;
      const start = [leanX * t, h * t, leanZ * t];
      const mid = [start[0] + Math.cos(a) * spread * 0.68, start[1] - spread * 0.12, start[2] + Math.sin(a) * spread * 0.68];
      const tip = [start[0] + Math.cos(a) * spread, start[1] + spread * 0.17, start[2] + Math.sin(a) * spread];
      limb(K, 'wood', start, mid, 0.042 * (1 - t) + 0.01, 0.013, C.twig, {}, 4);
      limb(K, 'wood', mid, tip, 0.014, 0.003, C.twig, {}, 3);
      if (detailed) {
        for (const side of [-1, 1]) {
          const aa = a + side * 0.65;
          limb(K, 'wood', mid,
            [mid[0] + Math.cos(aa) * spread * 0.42, mid[1] + spread * 0.24, mid[2] + Math.sin(aa) * spread * 0.42],
            0.009, 0.0025, C.twig, {}, 3);
        }
      }
    }
  }
  // A pale frost stripe catches only one side of a few foreground trunks.
  if (detailed && r() < 0.35) limb(K, 'land', [-0.08, 0, 0.04], [-0.08 + leanX * 0.2, h * 0.2, 0.04 + leanZ * 0.2], 0.026, 0.018, C.snowShade, {}, 3);
  K.pop();
}

function pine(K, r, x, z, h) {
  K.push([x, bankHeight(x, z) - 0.18, z], r() * TAU);
  K.put('wood', cyl(0.04, h * 0.024, h, 6), C.bark, [0, h / 2, 0]);
  for (let i = 0; i < 4; i++) {
    const scale = 1 - i * 0.2;
    K.put('pine', cyl(0.015, h * 0.2 * scale, h * 0.38, 7), C.pine,
      [0, h * (0.34 + i * 0.175), 0], [0, i * 0.53, 0], 1,
      { rough: 0.09, noise: 0.07, snow: 0.18, snowColor: C.snowShade });
  }
  K.pop();
}

function woodedBanks(K, r) {
  let larches = 0, pines = 0;
  // Irregular spacing and a second offset belt avoid a planted avenue silhouette.
  for (let i = 0; i < 82; i++) {
    const a = 0.56 + (TAU - 1.26) * (i + r() * 0.65) / 82;
    const depth = 5 + r() * 16 + (i % 3 === 0 ? 10 : 0);
    const d = shoreRadius(a) + depth;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x + 10, z - 24) < 4) continue;
    const h = 6 + r() * 5;
    if (i % 11 === 0) { pine(K, r, x, z, h * 0.85); pines++; }
    else { bareLarch(K, r, x, z, h, depth < 16); larches++; }
  }
  return { larches, pines };
}

function exposedRocks(K, r) {
  for (let i = 0; i < 45; i++) {
    const a = 0.6 + (TAU - 1.25) * (i + r() * 0.75) / 45;
    const d = shoreRadius(a) + 0.1 + r() * 2.4;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const w = 0.75 + r() * 1.75, h = 0.35 + r() * 0.7;
    K.put('land', new THREE.DodecahedronGeometry(1, 0), C.rock,
      [x, h * 0.38, z], [0.1, r() * TAU, 0.08], [w, h, 0.5 + r() * 0.75],
      { rough: 0.07, noise: 0.09, snow: 0.92, snowColor: C.snow });
  }
  // Small plates pushed up at shore. They never make an arena border.
  for (let i = 0; i < 18; i++) {
    const a = 1.2 + r() * 3.85;
    const d = shoreRadius(a) - 1.4 - r() * 1.7;
    K.put('ice', box(0.8 + r() * 1.4, 0.10 + r() * 0.08, 0.55 + r() * 0.8), C.ice,
      [Math.cos(a) * d, 0.1 + r() * 0.16, Math.sin(a) * d],
      [(r() - 0.5) * 0.45, a + r(), (r() - 0.5) * 0.35], 1,
      { rough: 0.045, noise: 0.03, snow: 0.48, snowColor: C.snowTop });
  }
}

function agedPier(K, r) {
  // A crooked gate with two pale route notches is the recognizable landmark.
  // Local -Z points out onto the ice; the shoreward end is buried under snow.
  const pos = { x: -10, y: 0.64, z: 19.6 };
  K.push([pos.x, 0, pos.z], -0.1);
  for (const x of [-0.67, 0.67]) K.put('wood', box(0.17, 0.22, 6.9), C.woodDark, [x, 0.42, 0.55]);
  for (let i = 0; i < 23; i++) {
    const z = -2.62 + i * 0.287;
    const y = 0.59 + Math.sin(i * 0.7) * 0.025;
    K.put('wood', box(1.91 + r() * 0.1, 0.13, 0.265), i % 4 === 0 ? 0x73716a : C.wood,
      [(r() - 0.5) * 0.07, y, z], [0, (r() - 0.5) * 0.018, (r() - 0.5) * 0.025], 1,
      { rough: 0.018, noise: 0.08, vary: 0.17 });
    if (i > 14 || i % 4 === 0) K.put('land', box(1.87, 0.038, 0.22), C.snow,
      [0.02, y + 0.086, z], [0, 0, -0.005], 1, { rough: 0.018, noise: 0.02 });
    if (i % 3 === 0) for (let j = 0; j < 2; j++) {
      K.put('wood', box(0.72 + r() * 0.5, 0.003, 0.009), C.woodDark,
        [(r() - 0.5) * 0.6, y + 0.067, z + (j - 0.5) * 0.11], [0, 0.016, 0], 1, { noise: 0 });
    }
  }
  for (const side of [-1, 1]) {
    let previous = null;
    for (let i = 0; i < 3; i++) {
      const z = -2.45 + i * 2.8, lean = side * (0.06 + i * 0.045);
      const top = [side * 1.03 + lean, 1.36 + (i === 1 ? -0.13 : 0.04), z + 0.08];
      limb(K, 'wood', [side * 1.03, -0.15, z], top, 0.105, 0.075, C.wood, { noise: 0.1 }, 6);
      K.put('land', cyl(0.085, 0.09, 0.045, 6), C.snowTop, [top[0], top[1] + 0.013, top[2]]);
      if (previous) {
        const a = [previous[0], previous[1] - 0.22, previous[2]];
        const b = [top[0], top[1] - 0.22, top[2]];
        const mid = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.2, (a[2] + b[2]) / 2];
        limb(K, 'rope', a, mid, 0.021, 0.021, C.rope, {}, 4);
        limb(K, 'rope', mid, b, 0.021, 0.021, C.rope, {}, 4);
      }
      previous = top;
    }
  }
  // The gate is shoreward: aged cross brace and a taller, leaning marker post.
  limb(K, 'wood', [-1.08, -0.06, 3.6], [-1.36, 2.42, 3.57], 0.13, 0.075, C.wood, { noise: 0.1 }, 6);
  K.put('wood', box(1.68, 0.2, 0.065), C.wood, [-0.63, 2.08, 3.57], [0, 0.08, -0.07], 1, { rough: 0.024 });
  for (const y of [1.62, 1.8]) K.put('land', box(0.11, 0.05, 0.012), C.snowTop, [-1.25, y, 3.475], [0, 0, 0.11]);
  limb(K, 'wood', [-0.88, 0.73, 3.62], [0.95, 1.17, 3.62], 0.055, 0.04, C.woodDark, {}, 5);
  // One loose loop beside the landing, large enough to read without micro-noise.
  K.put('rope', new THREE.TorusGeometry(0.25, 0.025, 4, 15, Math.PI * 1.82), C.rope,
    [0.54, 0.705, -1.6], [Math.PI / 2, 0, 0.4]);
  K.pop();
  return pos;
}

export function buildFrozenBayShore(scene) {
  const K = new ShoreKit(728391), r = rng(491731);
  shoreLand(K);
  lowHills(K);
  exposedRocks(K, r);
  const forest = woodedBanks(K, r);
  const pierPos = agedPier(K, r);
  const materials = {
    land: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }),
    pine: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    rope: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    ice: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.04 }),
    far: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  const stats = { meshes: 0, triangles: 0, ...forest, minSceneryRadius: Infinity };
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = K.mesh(bin, material, { cast: bin === 'wood', receive: bin !== 'far' });
    if (!mesh) { material.dispose(); continue; }
    mesh.name = `frozen-bay-${bin}`;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
    const p = mesh.geometry.attributes.position;
    stats.meshes++;
    stats.triangles += (mesh.geometry.index?.count ?? p.count) / 3;
    for (let i = 0; i < p.count; i++) stats.minSceneryRadius = Math.min(stats.minSceneryRadius, Math.hypot(p.getX(i), p.getZ(i)));
    scene.add(mesh);
    for (const g of K.bins[bin]) g.dispose();
    delete K.bins[bin];
  }
  return { stats, pierPos };
}
