// Omari's anchorage: a coral-stone sea fort on the Indian Ocean after a squall.
// All detail is procedural and visual only. The flat 6.5m ring and camera orbit
// stay clear; the sea starts beyond a broad, stationary sandy-earth landing inside a masonry quay.
import * as THREE from 'three';
import { Kit, rng, box, cyl, limb, canvasTex } from './stage_kit.js';

const C = {
  coral: 0xdcc8a4, chalk: 0xf0e4cd, worn: 0xb6a688, shadow: 0x766e58,
  wood: 0x302e29, woodLight: 0x594b35, tar: 0x191f20, rope: 0xa98c58,
  brass: 0xb39552, sail: 0xb86845, sailLight: 0xd4a779, dark: 0x252f2d,
};
const TAU = Math.PI * 2;

// Compact sand and earth carried across a working stone quay. The large atlas
// has softly mixed patches and use marks, never repeating tile joints.
function earthTexture() {
  const r = rng(51123);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#eee5d0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 100; i++) {
      const x = r() * w, y = r() * h, rad = 11 + r() * 66;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, i % 3 ? 'rgba(112,96,69,0.16)' : 'rgba(255,250,218,0.21)');
      gr.addColorStop(1, 'rgba(150,133,91,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // The light central wearing is broad and irregular, not a marked arena.
    const wear = g.createRadialGradient(249, 263, 8, 249, 263, 140);
    wear.addColorStop(0, 'rgba(247,227,183,0.12)'); wear.addColorStop(1, 'rgba(247,227,183,0)');
    g.fillStyle = wear; g.fillRect(100, 100, 300, 320);
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = i % 4 ? `rgba(110,94,68,${0.02 + r() * 0.12})` : `rgba(255,249,220,${0.03 + r() * 0.16})`;
      const size = 0.35 + r() * 1.05;
      g.fillRect(r() * w, r() * h, size, size * (0.5 + r()));
    }
    const damp = g.createLinearGradient(398, 0, 512, 0);
    damp.addColorStop(0, 'rgba(68,89,70,0)'); damp.addColorStop(1, 'rgba(68,89,70,0.22)');
    g.fillStyle = damp; g.fillRect(398, 0, 114, h);
    // Broken haul marks and shallow heel scuffs dissolve into the loose fines.
    for (let i = 0; i < 75; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = 'rgba(91,79,58,0.07)'; g.lineWidth = 0.7 + r();
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 1, x + 7 + r() * 12, y + 2); g.stroke();
    }
  });
}

function sailTexture() {
  const r = rng(51517);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f6edda'; g.fillRect(0, 0, w, h);
    // Broad, separately cut canvas bolts with flat-felled lap seams. The seam
    // widths are intentionally readable; the stitching is not a field of dots.
    for (let x = 0, i = 0; x < w; x += 64, i++) {
      g.fillStyle = i % 3 ? 'rgba(116,83,50,0.035)' : 'rgba(255,251,223,0.24)';
      g.fillRect(x, 0, 64, h);
      g.fillStyle = 'rgba(94,63,39,0.19)'; g.fillRect(x + 2, 0, 4, h);
      g.fillStyle = 'rgba(255,249,224,0.5)'; g.fillRect(x + 6, 0, 2, h);
    }
    for (let i = 0; i < 28; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(117,79,39,0.065)'); gr.addColorStop(1, 'rgba(117,79,39,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Two old repairs are large pieces of cloth, not noisy procedural speckles.
    for (const [x, y, ww, hh] of [[145, 65, 55, 81], [330, 180, 69, 52]]) {
      g.fillStyle = 'rgba(255,247,211,0.20)'; g.fillRect(x, y, ww, hh);
      g.strokeStyle = 'rgba(109,73,40,0.23)'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, ww - 4, hh - 4);
    }
  });
}

function coralTexture() {
  const r = rng(5109);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#eee9db';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 95; i++) {
      const x = r() * w, y = r() * h, rad = 8 + r() * 60;
      const b = g.createRadialGradient(x, y, 0, x, y, rad);
      b.addColorStop(0, `rgba(108,101,79,${0.025 + r() * 0.07})`);
      b.addColorStop(1, 'rgba(108,101,79,0)');
      g.fillStyle = b;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 6000; i++) {
      const v = 105 + (r() * 100 | 0);
      g.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.04 + r() * 0.15})`;
      g.fillRect(r() * w, r() * h, 0.4 + r() * 2.1, 0.4 + r() * 2.2);
    }
    // Small broken coral pores, rather than marble veins or sandy footprints.
    for (let i = 0; i < 150; i++) {
      g.strokeStyle = 'rgba(107,100,81,0.14)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 1 + r() * 3, 0.8 + r() * 1.8, r() * TAU, 0, TAU);
      g.stroke();
    }
  });
}

function skyTexture() {
  const r = rng(19251);
  return canvasTex(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#34575f');
    sky.addColorStop(0.25, '#658b91');
    sky.addColorStop(0.44, '#abbcb7');
    sky.addColorStop(0.5, '#d0d8c9');
    sky.addColorStop(1, '#afbdb4');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // A passing blue-grey squall bank; the west has opened into pale sunlight.
    for (let i = 0; i < 76; i++) {
      const x = r() * w, y = 85 + r() * 135;
      const rad = 35 + r() * 140;
      g.save();
      g.translate(x, y);
      g.scale(1, 0.2 + r() * 0.14);
      const c = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      c.addColorStop(0, i < 49 ? 'rgba(39,66,72,0.14)' : 'rgba(249,238,205,0.21)');
      c.addColorStop(1, 'rgba(96,117,119,0)');
      g.fillStyle = c;
      g.fillRect(-rad, -rad, rad * 2, rad * 2);
      g.restore();
    }
    for (let i = 0; i < 34; i++) {
      const x = r() * w, y = h * (0.408 + r() * 0.047), rad = 40 + r() * 100;
      g.save();
      g.translate(x, y);
      g.scale(1, 0.15);
      const c = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      c.addColorStop(0, 'rgba(66,90,91,0.23)');
      c.addColorStop(1, 'rgba(66,90,91,0)');
      g.fillStyle = c;
      g.fillRect(-rad, -rad, rad * 2, rad * 2);
      g.restore();
    }
    const glow = g.createRadialGradient(w * 0.72, h * 0.36, 0, w * 0.72, h * 0.36, 150);
    glow.addColorStop(0, 'rgba(255,243,202,0.58)');
    glow.addColorStop(0.35, 'rgba(249,231,191,0.18)');
    glow.addColorStop(1, 'rgba(249,231,191,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  });
}

// A true pointed opening, with a little flattened shoulder common to coastal
// carved door surrounds. Extrusion gives the gate a visible deep reveal.
function archPath(path, half, spring, rise, reverse = false) {
  if (!reverse) {
    path.moveTo(-half, 0);
    path.lineTo(-half, spring);
    path.quadraticCurveTo(-half, spring + rise * 0.64, 0, spring + rise);
    path.quadraticCurveTo(half, spring + rise * 0.64, half, spring);
    path.lineTo(half, 0);
  } else {
    path.moveTo(half, 0);
    path.lineTo(half, spring);
    path.quadraticCurveTo(half, spring + rise * 0.64, 0, spring + rise);
    path.quadraticCurveTo(-half, spring + rise * 0.64, -half, spring);
    path.lineTo(-half, 0);
  }
  path.closePath();
}

function archWall(width, height, depth, half, spring, rise) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0);
  s.lineTo(width / 2, height); s.lineTo(-width / 2, height); s.closePath();
  const hole = new THREE.Path();
  archPath(hole, half, spring, rise, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function archBand(half, spring, rise, width, depth) {
  const s = new THREE.Shape();
  archPath(s, half + width, spring, rise + width);
  const hole = new THREE.Path();
  archPath(hole, half, spring, rise, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 });
}

function triangle(a, b, c, uv = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
  g.computeVertexNormals();
  return g;
}

/** Anchored lateen dhow. z is length, x is beam; all ships are stationary. */
function dhow(K, pos, rotation, scale, hero = false) {
  K.push(pos, rotation, scale);
  const sections = [
    [-14, 0.2, 3.9], [-11, 1.6, 3.2], [-7, 2.7, 2.8],
    [1, 2.95, 2.7], [8, 2.1, 3.3], [12.5, 0.12, 5.0],
  ];
  const positions = [];
  for (let j = 0; j < sections.length - 1; j++) {
    const [za, wa, ya] = sections[j], [zb, wb, yb] = sections[j + 1];
    for (const side of [-1, 1]) {
      const a = [wa * side, ya, za], b = [wb * side, yb, zb];
      if (hero) {
        // Five real strakes follow the rising sheer, separated by recessed dark
        // caulking. Their broad facets still read as one near-black wooden hull.
        const colors = [0x202c2c, 0x283332, 0x303b36, 0x3c4035, 0x484537];
        const hullPoint = (w, y, z, t) => [w * (0.63 + t * 0.37) * side, y * t, z];
        for (let band = 0; band < 5; band++) {
          const lo = band / 5 + 0.006, hi = (band + 1) / 5 - 0.006;
          const p0 = hullPoint(wa, ya, za, hi), p1 = hullPoint(wb, yb, zb, hi);
          const p2 = hullPoint(wb, yb, zb, lo), p3 = hullPoint(wa, ya, za, lo);
          for (const tri of [[p0, p1, p2], [p0, p2, p3]]) K.put('hull', triangle(...tri), colors[band], [0, 0, 0], [0, 0, 0], 1, { vary: 0.06, noise: 0.025 });
          if (band === 4) limb(K, 'wood', p0, p1, 0.055, 0.055, 0x827054, {}, 5);
        }
        // Pitch-dark backing prevents the tiny caulking gaps becoming holes.
        const c = [wb * 0.62 * side, 0.0, zb], d = [wa * 0.62 * side, 0.0, za];
        positions.push(...[a[0] * 0.995, a[1], a[2]], ...[b[0] * 0.995, b[1], b[2]], ...c,
          ...[a[0] * 0.995, a[1], a[2]], ...c, ...d);
      } else {
        const c = [wb * 0.63 * side, 0.0, zb], d = [wa * 0.63 * side, 0.0, za];
        positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
      // A continuous sheer stripe and worn timber bulwark, readable at a distance.
      limb(K, 'wood', a, b, 0.115, 0.115, C.woodLight, {}, 5);
      limb(K, 'brass', [a[0], ya - 0.38, za], [b[0], yb - 0.38, zb], 0.045, 0.045, C.brass, {}, 4);
      if (hero) {
        for (let i = 1; i <= 3; i++) {
          const t = i / 4, w = wa + (wb - wa) * t, z = za + (zb - za) * t, y = ya + (yb - ya) * t;
          limb(K, 'wood', [w * side, y - 1.1, z], [w * side, y + 0.43, z], 0.065, 0.05, C.woodLight, {}, 5);
        }
      }
    }
    positions.push(-wa, ya - 0.16, za, -wb, yb - 0.16, zb, wb, yb - 0.16, zb,
      -wa, ya - 0.16, za, wb, yb - 0.16, zb, wa, ya - 0.16, za);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hull.computeVertexNormals();
  K.put('hull', hull, C.tar);
  K.put('wood', box(3.7, 1.3, 4.7), C.wood, [0, 3.9, -8.4]);
  K.put('wood', box(4.25, 0.14, 5.1), C.woodLight, [0, 4.6, -8.4]);
  // One immense oblique lateen yard supplies the hero silhouette. The smaller
  // mizzen leans the other way; neither looks like square-rigged pirate clipart.
  const rigs = [[0, 18.8, -2.5, -10, 6.4, 10, 21], [0.3, 12.5, -8.5, -13.2, 6.8, -2.8, 14.3]];
  for (let ri = 0; ri < rigs.length; ri++) {
    const [x, mastH, mz, lowZ, lowY, highZ, highY] = rigs[ri];
    limb(K, 'wood', [x, 2.5, mz], [x + 0.25, mastH, mz - 0.8], ri ? 0.17 : 0.23, 0.07, C.woodLight);
    const A = [x, lowY, lowZ], B = [x, highY, highZ], D = [x, lowY - 1.0, highZ - 0.7];
    limb(K, 'wood', A, B, 0.09, 0.06, C.woodLight, {}, 7);
    // Barycentric UVs describe both full-sized canvas panels and the wind mask.
    // The three anchored edges have zero displacement; only the belly breathes.
    const rows = hero ? 12 : 4;
    const point = (u, v) => [
      x + Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * (hero ? 1.15 : 0.6),
      A[1] * (1 - u - v) + B[1] * u + D[1] * v,
      A[2] * (1 - u - v) + B[2] * u + D[2] * v,
    ];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < rows - i; j++) {
        const a = point(i / rows, j / rows), b = point((i + 1) / rows, j / rows), c = point(i / rows, (j + 1) / rows);
        const color = ri ? C.sailLight : i > rows - 3 ? 0xd4b48b : C.sail;
        const uv = hero ? [[i / rows, j / rows], [(i + 1) / rows, j / rows], [i / rows, (j + 1) / rows]] : null;
        K.put('cloth', triangle(a, b, c, uv), color, [0, 0, 0], [0, 0, 0], 1, { vary: 0.025, noise: 0.015 });
        if (j < rows - i - 1) K.put('cloth', triangle(b, point((i + 1) / rows, (j + 1) / rows), c,
          hero ? [[(i + 1) / rows, j / rows], [(i + 1) / rows, (j + 1) / rows], [i / rows, (j + 1) / rows]] : null),
          color, [0, 0, 0], [0, 0, 0], 1, { vary: 0.025, noise: 0.015 });
      }
    }
    if (hero) {
      // Doubled canvas at the three clews; a repaired corner is a distinct cut
      // piece, not random triangle brightness. It moves with the same sail UVs.
      for (const patch of [[[0, 0], [0.11, 0], [0, 0.11]], [[1, 0], [0.89, 0], [0.89, 0.11]], [[0, 1], [0, 0.89], [0.11, 0.89]]]) {
        const p = patch.map(([u, v]) => { const p = point(u, v); p[0] -= 0.014; return p; });
        K.put('cloth', triangle(...p, patch), ri ? 0xc2a078 : 0xd2a36f, [0, 0, 0], [0, 0, 0], 1, { vary: 0, noise: 0.015 });
      }
      for (const [a, b] of [[A, B], [B, D], [D, A]]) limb(K, 'rope', a, b, 0.075, 0.075, 0xc0a476, {}, 6);
    }
    for (const [a, b] of [[A, B], [B, D], [D, A]]) limb(K, 'rope', a, b, 0.037, 0.037, C.rope, {}, 5);
    for (const z of [-11, 9]) for (const side of [-1, 1]) {
      limb(K, 'rope', [x + 0.25, mastH - 1, mz - 0.8], [side * 2.1, 3.2, z], 0.024, 0.024, C.rope, {}, 4);
    }
  }
  if (hero) {
    // Dark slatted stern windows and brass corners reward closer camera angles.
    for (let z = -10; z < -6.4; z += 0.55) {
      K.put('hull', box(0.025, 0.64, 0.34), 0x111a1b, [-1.87, 4.0, z]);
      K.put('brass', box(0.035, 0.72, 0.045), C.brass, [-1.9, 4.0, z - 0.2]);
    }
    limb(K, 'wood', [0, 3.4, 11], [0, 5.5, 17], 0.14, 0.06, C.woodLight);
    // Broad repaired planks below the stern windows, a worn rudder and lashings.
    for (let i = 0; i < 3; i++) K.put('wood', box(0.08, 0.20, 1.5 + i * 0.25), i % 2 ? 0x645941 : 0x827054,
      [-2.02, 2.3 - i * 0.29, -9.5 + i * 0.36], [0, -0.13, -0.14]);
    K.put('wood', box(0.23, 3.0, 0.85), C.woodLight, [0, 1.3, -14.1], [0.14, 0, 0]);
    for (const y of [0.4, 1.4, 2.4]) K.put('hull', box(0.27, 0.15, 0.88), C.tar, [0, y, -14.1]);
  }
  K.pop();
}

// An ocean-going merchant carrack: a deep, broad hull and raised stern,
// square courses/topsails on fore and main, lateen mizzen. This is deliberately
// a second construction, not a scaled copy of the coastal lateen dhow.
function merchantShip(K, pos, rotation) {
  K.push(pos, rotation);
  const sections = [[-22, 2.8, 7.2], [-17, 4.2, 6.6], [-7, 4.9, 5.0], [8, 4.5, 5.0], [17, 2.6, 5.8], [23, 0.12, 6.6]];
  for (let j = 0; j < sections.length - 1; j++) {
    const [za, wa, ya] = sections[j], [zb, wb, yb] = sections[j + 1];
    for (const side of [-1, 1]) {
      for (let band = 0; band < 4; band++) {
        const lo = band / 4, hi = (band + 1) / 4;
        const point = (z, w, y, f) => [side * w * (0.58 + f * 0.42), y * f, z];
        const a = point(za, wa, ya, lo), b = point(zb, wb, yb, lo), c = point(zb, wb, yb, hi), d = point(za, wa, ya, hi);
        const color = [0x233c3a, 0x37423b, 0x645440, 0x776344][band];
        K.put('hull', triangle(a, b, c), color); K.put('hull', triangle(a, c, d), color);
        if (band === 2) limb(K, 'wood', c, d, 0.10, 0.10, 0xb39a68, {}, 5);
      }
      limb(K, 'wood', [side * wa, ya, za], [side * wb, yb, zb], 0.13, 0.13, 0x998056, {}, 5);
    }
    K.put('wood', triangle([-wa, ya - 0.14, za], [wa, ya - 0.14, za], [wb, yb - 0.14, zb]), 0x75674e);
    K.put('wood', triangle([-wa, ya - 0.14, za], [wb, yb - 0.14, zb], [-wb, yb - 0.14, zb]), 0x75674e);
  }
  // Broad flat transom, stern gallery and an honest bowsprit create the large
  // ship silhouette even with the sails mostly viewed from the quarter.
  for (let i = 0; i < 5; i++) {
    const width = 3.5 + i * 0.49;
    K.put('wood', box(width, 1.43, 0.28), i < 2 ? 0x37423b : i % 2 ? 0x78684c : 0x655941, [0, 0.74 + i * 1.43, -22]);
    if (i > 1) K.put('wood', box(width + 0.1, 0.10, 0.34), 0xa08c60, [0, 1.36 + i * 1.43, -22]);
  }
  K.put('wood', box(7.1, 3.1, 5.4), 0x685b45, [0, 7.5, -17.6]);
  K.put('wood', box(7.6, 0.25, 6.0), 0x998566, [0, 9.15, -17.6]);
  for (const side of [-1, 1]) {
    for (const z of [-19.3, -18.0, -16.7, -15.4]) {
      K.put('hull', box(0.04, 1.05, 0.65), 0x233834, [side * 3.58, 7.8, z]);
      K.put('brass', box(0.055, 0.1, 0.85), 0xb5a47a, [side * 3.61, 8.35, z]);
    }
    for (const z of [-10, -5, 0, 5, 10]) K.put('hull', box(0.05, 0.46, 0.66), 0x273832, [side * 4.63, 4.0, z]);
    limb(K, 'rope', [side * 3.9, 5.2, 16], [0, 10.1, 34], 0.055, 0.055, C.rope, {}, 4);
  }
  limb(K, 'wood', [0, 5.5, 17], [0, 10.1, 34], 0.22, 0.075, 0x8c7755, {}, 7);
  const squareSail = (z, top, width, height, color) => {
    const rows = 4, columns = 8;
    const point = (u, v) => [
      (u - 0.5) * width * (1 - v * 0.15),
      top - height * v + Math.sin(Math.PI * u) * 0.8 * v,
      z + Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 1.45,
    ];
    limb(K, 'wood', [-width * 0.55, top + 0.08, z], [width * 0.55, top + 0.08, z], 0.11, 0.11, 0x8a7757, {}, 6);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const u = i / columns, v = j / rows, U = (i + 1) / columns, V = (j + 1) / rows;
      const a = point(u, v), b = point(U, v), c = point(U, V), d = point(u, V);
      // UVs are a separate cloth panel; the distant square sails stay still.
      K.put('cloth', triangle(a, b, c, [[u, v], [U, v], [U, V]]), color, [0, 0, 0], [0, 0, 0], 1, { vary: 0.012, noise: 0.008 });
      K.put('cloth', triangle(a, c, d, [[u, v], [U, V], [u, V]]), color, [0, 0, 0], [0, 0, 0], 1, { vary: 0.012, noise: 0.008 });
    }
    for (const side of [-1, 1]) limb(K, 'rope', [side * width * 0.5, top, z], [side * 3.7, 5.1, z + 3.0], 0.035, 0.035, C.rope, {}, 4);
  };
  for (const [z, height, width] of [[10, 28, 15.3], [-2, 32, 18.5]]) {
    limb(K, 'wood', [0, 4, z], [0, height, z], 0.29, 0.07, 0x968362, {}, 7);
    K.put('wood', cyl(0.95, 0.7, 0.35, 10), 0x706951, [0, height * 0.60, z]);
    squareSail(z, height - 2.0, width * 0.50, 4.7, 0xd0cfb4);
    squareSail(z, height - 7.5, width * 0.75, 5.5, 0xc5c6aa);
    squareSail(z, height - 14.0, width, 6.3, 0xbec3a6);
    for (const side of [-1, 1]) {
      limb(K, 'rope', [0, height * 0.67, z], [side * 4.2, 5.1, z - 3.3], 0.05, 0.05, C.rope, {}, 4);
      limb(K, 'rope', [0, height - 0.5, z], [0, 6.5, z + 13], 0.045, 0.045, C.rope, {}, 4);
    }
  }
  limb(K, 'wood', [0, 7, -15], [0, 23, -15], 0.2, 0.06, 0x968362, {}, 6);
  limb(K, 'wood', [0, 13, -23], [0, 25, -9], 0.11, 0.08, 0x8a7757, {}, 6);
  K.put('cloth', triangle([0, 13, -23], [0, 25, -9], [0, 11.6, -9.6]), 0xb8bea4);
  for (const side of [-1, 1]) limb(K, 'rope', [0, 22, -15], [side * 3.2, 8.5, -19], 0.04, 0.04, C.rope, {}, 4);
  K.pop();
}

// A low offshore island and pre-electric masonry beacon finish the right-hand
// horizon. The open fire basket is unlit in daytime, not a modern glass lantern.
function beaconIsland(K, stoneOpt) {
  const r = rng(512890);
  for (let i = 0; i < 13; i++) {
    const x = 150 + (r() - 0.5) * 26, z = 110 + (r() - 0.5) * 42;
    const size = 7 + r() * 9;
    K.put('stone', new THREE.DodecahedronGeometry(size, 0), i % 3 ? 0x939e86 : 0x839a88,
      [x, -2.9 + r() * 1.0, z], [0, r() * TAU, 0], [1.5, 0.35 + r() * 0.12, 1.4], { ...stoneOpt, rough: 0.5, noise: 0.04 });
  }
  // Connected low vegetation silhouettes leave the tower legible above them.
  for (let i = 0; i < 18; i++) K.put('leaf', new THREE.IcosahedronGeometry(1, 0), i % 3 ? 0x65816d : 0x809276,
    [140 + r() * 21, 1.7 + r() * 1.6, 91 + r() * 36], [0, r() * TAU, 0], [2.2 + r() * 2.5, 0.8 + r(), 2.3 + r() * 2.0]);
  K.push([143, 2.5, 120]);
  K.put('stone', cyl(3.6, 5.0, 3.4, 8), 0xb3b49a, [0, 1.2, 0], [0, 0, 0], 1, stoneOpt);
  K.put('stone', cyl(2.35, 3.2, 11.8, 8), 0xc8c5a8, [0, 8.4, 0], [0, 0, 0], 1, stoneOpt);
  for (const y of [3.3, 14.2]) K.put('stone', cyl(y < 4 ? 3.37 : 2.77, y < 4 ? 3.47 : 2.85, 0.42, 8), 0xe0d6b4,
    [0, y, 0], [0, 0, 0], 1, stoneOpt);
  // Sea-facing door, narrow slit and parapet show human scale at a distance.
  K.put('hull', box(0.07, 2.3, 1.1), 0x5b6b60, [-3.1, 3.0, 0]);
  K.put('hull', box(0.06, 1.5, 0.45), 0x697566, [-2.65, 9.5, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    K.put('stone', box(1.05, 0.85, 0.65), 0xcfcbb0,
      [Math.cos(a) * 2.4, 14.84, Math.sin(a) * 2.4], [0, -a, 0], 1, stoneOpt);
  }
  K.put('hull', cyl(1.30, 0.86, 0.8, 8), 0x586355, [0, 15.3, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    limb(K, 'hull', [Math.cos(a) * 0.9, 15.0, Math.sin(a) * 0.9], [Math.cos(a) * 1.35, 16.6, Math.sin(a) * 1.35], 0.06, 0.045, 0x4c594c, {}, 4);
  }
  K.put('hull', new THREE.TorusGeometry(1.35, 0.055, 4, 12), 0x4c594c, [0, 16.6, 0], [Math.PI / 2, 0, 0]);
  K.pop();
}

function ocean(scene, sunOffset) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(sunOffset.x, sunOffset.y, sunOffset.z).normalize() },
      seaColor: { value: new THREE.Color(0x187a7b) },
      skyColor: { value: new THREE.Color(0xbccfbd) },
      fogColor: { value: new THREE.Color(0xb6ccc5) },
    },
    vertexShader: `
      uniform float time;
      varying vec3 worldPoint;
      void main() {
        vec3 p = position;
        p.z += sin(p.x * 0.19 + p.y * 0.11 + time * 0.57) * 0.10;
        p.z += sin(p.x * -0.29 + p.y * 0.31 + time * 0.76) * 0.045;
        worldPoint = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPoint, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 sunDir;
      uniform vec3 seaColor;
      uniform vec3 skyColor;
      uniform vec3 fogColor;
      varying vec3 worldPoint;
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        vec4 n = fract(sin(vec4(dot(i, vec2(127.1, 311.7)), dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)),
          dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)), dot(i + vec2(1.0), vec2(127.1, 311.7)))) * 43758.5453);
        return mix(mix(n.x, n.y, f.x), mix(n.z, n.w, f.x), f.y);
      }
      void main() {
        vec2 p = worldPoint.xz;
        float distanceXZ = distance(cameraPosition.xz, p);
        float warp = noise(p * 0.105 + vec2(time * 0.014, 0.0));
        float a = p.x * 0.86 + p.y * 0.28 + warp * 6.0 + time * 0.73;
        float b = p.x * -0.21 + p.y * 1.12 + noise(p * 0.072) * 4.0 - time * 0.61;
        float c = p.x * 3.2 + p.y * 1.7 + sin(a) * 0.75 + time * 1.2;
        float fine = 1.0 - smoothstep(30.0, 150.0, distanceXZ);
        vec3 n = normalize(vec3(cos(a) * 0.09 + cos(c) * 0.025 * fine, 1.0, cos(b) * 0.08 + cos(c) * 0.018 * fine));
        vec3 v = normalize(cameraPosition - worldPoint);
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        float ripple = (warp - 0.5) * 0.15;
        float spec = pow(max(dot(n, normalize(sunDir + v)), 0.0), 180.0);
        vec3 col = mix(seaColor * (0.87 + ripple), skyColor, 0.11 + fresnel * 0.48);
        col += vec3(1.0, 0.88, 0.61) * spec * 0.72;
        float fog = smoothstep(65.0, 310.0, distanceXZ);
        gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000, 72, 72), mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -2.4;
  sea.frustumCulled = false;
  scene.add(sea);
  return mat;
}

// A small number of long, translucent ribbons meet the masonry and hull. This
// is one draw, no particle emitter, reflection pass, timer or transient object.
function harborWash(scene) {
  const r = rng(51771), positions = [], uv = [], kind = [], phase = [];
  const quad = (a, b, c, d, mist, ph) => {
    for (const [p, u, v] of [[a, 0, 0], [b, 1, 0], [c, 1, 1], [a, 0, 0], [c, 1, 1], [d, 0, 1]]) {
      positions.push(...p); uv.push(u, v); kind.push(mist); phase.push(ph);
    }
  };
  for (let i = 0; i < 26; i++) {
    const x = i < 10 ? 20 + r() * 7 : 37 + r() * 14, z = (r() - 0.5) * 33;
    const len = 2.8 + r() * 5, width = 0.25 + r() * 0.55, y = -2.18 + r() * 0.035;
    quad([x, y, z - len / 2], [x + width, y, z - len / 2], [x + width, y, z + len / 2], [x, y, z + len / 2], 0, r() * TAU);
  }
  for (const z of [-13.4, -6.5, 4.5, 12.2]) {
    quad([19.35, -1.3, z - 1.7], [19.35, -1.3, z + 1.7], [19.45, 0.45, z + 1.45], [19.45, 0.45, z - 1.45], 1, r() * 0.65);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('washKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('washPhase', new THREE.Float32BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xe0e8d5) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    vertexShader: `
      uniform float time;
      attribute float washKind;
      attribute float washPhase;
      varying vec2 vWashUV;
      varying float vKind;
      varying float vPhase;
      void main() {
        vWashUV = uv; vKind = washKind; vPhase = washPhase;
        vec3 p = position;
        float tide = sin(time * 0.9817477 - 3.14159265);
        p.y += washKind * (0.13 + tide * 0.13) * sin(uv.y * 3.14159265);
        p.y += (1.0 - washKind) * sin(time * 0.9817477 + washPhase) * 0.06;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vWashUV;
      varying float vKind;
      varying float vPhase;
      void main() {
        float edge = sin(vWashUV.x * 3.14159265) * sin(vWashUV.y * 3.14159265);
        float pulse = 0.5 + 0.5 * sin(time * 0.9817477 - 3.14159265);
        float fray = 0.7 + 0.3 * sin(vWashUV.y * 19.0 + vPhase + sin(vWashUV.x * 8.0));
        float alpha = edge * fray * mix(0.15 + pulse * 0.26, pulse * 0.14, vKind);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'corsair-quay-wash';
  scene.add(mesh);
  return mat;
}

// Two readable gulls replace the frozen flock. Both are ordinary native meshes;
// no sprite sheets, particle allocation, extra lights or off-screen render pass.
function harborGulls(scene) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const clock = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gullTime = clock;
    shader.vertexShader = `uniform float gullTime;
      attribute float gullWing;
      ${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float flap = sin(gullTime * 5.4) * 0.28 * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(gullTime * 0.31), 4.0));
      transformed.y += gullWing * flap;
    `);
  };
  material.customProgramCacheKey = () => 'corsair-gull-glide-1';
  const make = (flying) => {
    const G = new Kit(flying ? 51230 : 51231);
    const sphere = (pos, scale, color) => G.put('gull', new THREE.SphereGeometry(1, 8, 5), color, pos, [0, 0, 0], scale, { vary: 0, noise: 0.025 });
    sphere([0, 0, 0], [0.13, 0.14, 0.31], 0xe5e7dc);
    sphere([0, 0.16, 0.19], [0.09, 0.10, 0.105], 0xf0efe1);
    G.put('gull', new THREE.ConeGeometry(0.034, 0.14, 5), 0xc8a764, [0, 0.145, 0.32], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) {
      sphere([side * 0.073, 0.18, 0.245], [0.014, 0.015, 0.012], 0x303735);
      if (flying) {
        const a = [side * 0.07, 0.07, 0.08], b = [side * 0.55, 0.16, 0.0], c = [side * 0.89, 0.06, -0.22], d = [side * 0.36, 0.02, -0.21];
        G.put('gull', triangle(a, b, d), 0xbcc8c5);
        G.put('gull', triangle(b, c, d), 0x566762);
      } else {
        sphere([side * 0.09, 0.018, -0.06], [0.075, 0.095, 0.23], 0xaebcba);
        limb(G, 'gull', [side * 0.06, -0.06, 0.0], [side * 0.06, -0.27, 0.04], 0.015, 0.012, 0xba9861, {}, 4);
      }
    }
    G.put('gull', triangle([-0.075, 0.035, -0.20], [0.075, 0.035, -0.20], [0, 0.065, -0.43]), 0xe3e5dc);
    const mesh = G.mesh('gull', material, { cast: false, receive: false });
    for (const g of G.bins.gull) g.dispose();
    const positions = mesh.geometry.attributes.position;
    const wings = new Float32Array(positions.count);
    if (flying) for (let i = 0; i < wings.length; i++) wings[i] = Math.max(0, Math.abs(positions.getX(i)) - 0.15);
    mesh.geometry.setAttribute('gullWing', new THREE.BufferAttribute(wings, 1));
    mesh.name = flying ? 'corsair-gull-flight' : 'corsair-gull-perched';
    scene.add(mesh);
    return mesh;
  };
  const flying = make(true), perched = make(false);
  perched.position.set(18.1, 1.12, 3); perched.rotation.y = -0.6;
  const update = (time) => {
    clock.value = time;
    const a = time * 0.21 + 2.1;
    flying.position.set(29 + Math.cos(a) * 7, 5.8 + Math.sin(a * 2.0) * 0.8, -1 + Math.sin(a) * 16);
    flying.rotation.set(0, Math.atan2(-7 * Math.sin(a), 16 * Math.cos(a)), -0.14 * Math.sin(a));
    perched.rotation.y = -0.6 + Math.sin(time * 0.19) * 0.12;
  };
  update(0);
  return { update, flying };
}

// Salt-worn joints, fishing gear and shallow coral shelves connect the broad
// earth landing to its sea. Every raised detail remains beyond 10.5m radius.
function livingQuay(K, stoneOpt) {
  const r = rng(51742);
  for (const z of [-12.6, -4.5, 5.9, 14.8]) {
    // Recessed drains are flush with the visual floor, never new collisions.
    for (let i = 0; i < 5; i++) K.put('inlay', box(0.045, 0.007, 0.38), 0x686e5c,
      [14.7 + i * 0.12, -0.009, z]);
    K.put('stone', box(0.98, 0.026, 0.62), 0xacad91, [14.95, -0.04, z], [0, 0, 0], 1, stoneOpt);
  }
  for (let i = 0; i < 38; i++) {
    const z = -16.8 + r() * 34, x = 16.0 + r() * 2.5;
    K.put('stone', new THREE.DodecahedronGeometry(0.12 + r() * 0.16), i % 3 ? 0xd2c6a5 : 0x9ca78d,
      [x, 0.02, z], [r(), r() * TAU, r()], [1.8, 0.14, 0.7 + r()], { vary: 0.07, noise: 0.05 });
  }
  // A mended fishing net dries on the near corner: a broad transparent woven
  // shape, not opaque clutter in front of the ship or combatants.
  for (const z of [-12.2, -8.3]) limb(K, 'wood', [15.7, 0, z], [15.7, 1.6, z], 0.045, 0.035, 0x78745a, {}, 5);
  const netPoint = (u, v) => [15.7 - Math.sin(v * Math.PI) * 0.34,
    1.54 - 1.44 * v - Math.sin(u * Math.PI) * 0.22 * (1 - v), -12.2 + u * 3.9];
  for (let i = 0; i <= 19; i++) {
    let p = netPoint(i / 19, 0);
    for (let j = 1; j <= 7; j++) { const q = netPoint(i / 19, j / 7); limb(K, 'rope', p, q, 0.012, 0.012, 0x97917a, {}, 3); p = q; }
  }
  for (let j = 0; j <= 7; j++) {
    let p = netPoint(0, j / 7);
    for (let i = 1; i <= 19; i++) { const q = netPoint(i / 19, j / 7); limb(K, 'rope', p, q, j ? 0.012 : 0.025, j ? 0.012 : 0.025, 0xaca387, {}, 3); p = q; }
  }
  // Coral shelves break the sea/quay seam at the stair corner. Deep-green wet
  // lower strata and pale eroded tops remain distinct at the gameplay distance.
  for (let i = 0; i < 14; i++) {
    const x = 21 + r() * 7, z = 15.5 + r() * 8, radius = 0.65 + r() * 1.0;
    K.put('stone', new THREE.DodecahedronGeometry(radius, 0), 0x729285,
      [x, -2.08, z], [0, r() * TAU, 0], [1.6, 0.38, 0.9], { ...stoneOpt, rough: 0.09 });
    if (i < 8) K.put('stone', new THREE.DodecahedronGeometry(radius, 0), 0xc4bd99,
      [x, -1.81, z], [0, r() * TAU, 0], [1.35, 0.24, 0.8], { ...stoneOpt, rough: 0.065 });
  }
  // Just three wind-pruned salt plants, rooted in broken edge joints.
  for (const [x, z, scale] of [[17.5, 15.7, 1], [16.9, -14.0, 0.85], [-15.0, 16.8, 1.1]]) {
    for (let i = 0; i < 11; i++) {
      const a = r() * TAU, reach = (0.17 + r() * 0.38) * scale;
      const end = [x + Math.cos(a) * reach, (0.14 + r() * 0.23) * scale, z + Math.sin(a) * reach];
      limb(K, 'leaf', [x, 0.01, z], end, 0.025, 0.008, 0x77866a, {}, 4);
      K.put('leaf', new THREE.IcosahedronGeometry(0.14, 0), i % 3 ? 0x7e967b : 0xa0ad84,
        end, [r(), r(), r()], [1.4, 0.45, 0.7]);
    }
  }
}

/** Native stage contract; Stages owns and disposes every added scene resource. */
export function buildCorsair(scene, lights = {}) {
  const r = rng(511709);
  const K = new Kit(51017);
  const sunOffset = { x: -6, y: 8, z: 7 };
  scene.background = new THREE.Color(0xb6ccc5);
  scene.fog = new THREE.Fog(0xb6ccc5, 50, 270);
  if (lights.hemi) {
    lights.hemi.color.set(0xc2dbdf);
    lights.hemi.groundColor.set(0xc3ab81);
    lights.hemi.intensity = 1.0;
  }
  if (lights.sun) {
    lights.sun.color.set(0xffe4b1);
    lights.sun.intensity = 1.45;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(590, 40, 20), new THREE.MeshBasicMaterial({
    map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  scene.add(sky);
  const sea = ocean(scene, sunOffset);
  const wash = harborWash(scene);
  const gulls = harborGulls(scene);
  const stoneTex = coralTexture();
  const floorTex = earthTexture();
  const stoneOpt = { uv: 'box', uvScale: 0.42, vary: 0.11, noise: 0.035 };
  const floorOpt = { uv: 'box', uvScale: 1 / 38, vary: 0.075, noise: 0.02 };

  // Wide masonry landing: edges are 18m+ from the duel, and no combat surface moves.
  K.put('stone', box(38, 2.7, 37), C.worn, [0, -1.42, 0], [0, 0, 0], 1, stoneOpt);
  K.put('stone', box(38.5, 0.24, 37.5), C.chalk, [0, -0.16, 0], [0, 0, 0], 1, stoneOpt);
  // One continuous level surface: compact sandy earth inside the retained
  // masonry rim. The physics floor is unchanged; no visual artificial ring.
  K.put('floor', new THREE.PlaneGeometry(37.9, 37.1, 24, 24), 0xc9b28c,
    [0, -0.008, 0], [-Math.PI / 2, 0, 0], 1, { ...floorOpt, vary: 0, noise: 0.025 });

  // Quay coping and mooring fixtures: all taller objects are outside camera orbit.
  for (const z of [-18.2, 18.2]) {
    K.put('stone', box(37.7, 0.56, 0.65), C.coral, [0, 0.23, z], [0, 0, 0], 1, stoneOpt);
    K.put('stone', box(38.1, 0.11, 0.83), C.chalk, [0, 0.565, z], [0, 0, 0], 1, stoneOpt);
  }
  for (const z of [-14, -6, 3, 12]) {
    K.put('stone', box(1.35, 0.32, 1.35), C.coral, [18.1, 0.1, z], [0, 0, 0], 1, stoneOpt);
    K.put('hull', cyl(0.2, 0.3, 0.68, 10), C.tar, [18.1, 0.48, z]);
    K.put('brass', cyl(0.32, 0.31, 0.1, 10), C.brass, [18.1, 0.77, z]);
    for (let i = 0; i < 3; i++) K.put('rope', new THREE.TorusGeometry(0.47 + i * 0.065, 0.038, 5, 24), C.rope,
      [17.1, 0.04 + i * 0.015, z + 0.3], [Math.PI / 2, 0, 0]);
  }
  // The landing ends in individual worn coping blocks, a damp tide line and
  // stone steps. All relief is seaward of 18m, well beyond the camera orbit.
  for (let z = -17.6; z < 18; z += 1.45) {
    K.put('stone', box(0.86, 0.25, 1.40), z % 3 < 1.5 ? C.coral : C.chalk,
      [18.92, -0.08, z], [0, 0, 0], 1, { ...stoneOpt, rough: 0.065 });
    K.put('stone', box(0.05, 0.65 + r() * 0.4, 1.4), 0x627e70,
      [19.03, -1.77, z], [0, 0, 0], 1, stoneOpt);
  }
  for (let i = 0; i < 5; i++) K.put('stone', box(0.8, 0.32, 3.7), C.worn,
    [19.3 + i * 0.73, -0.22 - i * 0.29, 13.8], [0, 0, 0], 1, { ...stoneOpt, rough: 0.05 });
  // Two working bundles: stacked timber crates, folded canvas, heavy rope.
  for (const [x, z, rot] of [[13.4, -11.8, -0.16], [-13.8, 8.5, 0.21]]) {
    K.push([x, 0, z], rot);
    for (const [xx, zz, yy, sc] of [[0, 0, 0, 1], [1.55, 0.25, 0, 0.85], [0.08, 0.1, 1.05, 0.68]]) {
      K.put('wood', box(1.25, 1, 1.1), 0x75654c, [xx, yy + 0.5 * sc, zz], [0, 0, 0], sc);
      for (const side of [-1, 1]) {
        K.put('wood', box(1.35, 0.14, 0.12), 0x4b4738, [xx, yy + (side < 0 ? 0.12 : 0.87) * sc, zz + 0.55 * sc], [0, 0, 0], sc);
        K.put('wood', box(0.14, 1, 0.12), 0x4b4738, [xx + side * 0.49 * sc, yy + 0.5 * sc, zz + 0.55 * sc], [0, 0, 0], sc);
      }
    }
    for (let i = 0; i < 4; i++) K.put('rope', new THREE.TorusGeometry(0.48 + i * 0.085, 0.058, 5, 20), C.rope,
      [1.0, 0.07 + i * 0.025, 1.8], [Math.PI / 2, 0, 0]);
    K.put('cloth', box(1.03, 0.09, 0.9), C.sail, [0.08, 1.77, 0.1]);
    K.put('cloth', box(1.03, 0.54, 0.05), C.sail, [0.08, 1.5, 0.57]);
    K.pop();
  }

  livingQuay(K, stoneOpt);

  // Coral gate, deeply carved timber doors, and an asymmetric arcaded storehouse.
  K.push([-19, 0, -2], Math.PI / 2);
  K.put('stone', archWall(10, 7.8, 2.1, 1.75, 3.6, 1.8), C.coral, [0, 0, 0], [0, 0, 0], 1, stoneOpt);
  K.put('stone', archBand(1.75, 3.6, 1.8, 0.32, 0.22), C.chalk, [0, 0, 1.06], [0, 0, 0], 1, stoneOpt);
  K.put('wood', box(3.43, 5.1, 0.16), C.wood, [0, 2.54, -1.7]);
  for (let x = -1.55; x <= 1.56; x += 0.29) K.put('hull', box(0.016, 4.8, 0.022), C.tar, [x, 2.55, -1.59]);
  for (const x of [-1.3, -0.43, 0.43, 1.3]) for (let y = 0.55; y < 4.9; y += 0.48) {
    K.put('brass', new THREE.SphereGeometry(0.06, 5, 4), C.brass, [x, y, -1.54]);
  }
  for (const x of [-4, 4]) {
    K.put('stone', box(3.2, 9.2, 3.5), C.coral, [x, 4.6, -0.3], [0, 0, 0], 1, stoneOpt);
    K.put('stone', box(3.45, 0.26, 3.75), C.chalk, [x, 8.3, -0.3], [0, 0, 0], 1, stoneOpt);
    K.put('hull', box(0.22, 1.6, 0.03), C.dark, [x, 6.0, 1.47]);
    for (const xx of [-1.05, 0, 1.05]) K.put('stone', box(0.59, 0.66, 3.5), C.chalk, [x + xx, 9.4, -0.3], [0, 0, 0], 1, stoneOpt);
  }
  K.put('stone', box(10.8, 0.26, 2.55), C.chalk, [0, 7.45, 0], [0, 0, 0], 1, stoneOpt);
  // Small stone roundel, incised rather than a heraldic European crest.
  K.put('brass', new THREE.TorusGeometry(0.38, 0.035, 5, 24), C.brass, [0, 6.4, 1.08]);
  K.pop();

  K.push([-5.0, 0, -19.6]);
  for (let i = 0; i < 4; i++) {
    const x = i * 4.5 - 6.75;
    K.put('stone', archWall(4.52, 5.7, 1.0, 1.5, 2.5, 1.5), C.coral, [x, 0, 0], [0, 0, 0], 1, stoneOpt);
    K.put('stone', archBand(1.5, 2.5, 1.5, 0.16, 0.14), C.chalk, [x, 0, 0.51], [0, 0, 0], 1, stoneOpt);
    K.put('hull', box(3.15, 4.6, 0.15), 0x41453a, [x, 2.3, -3.1]);
  }
  K.put('stone', box(18.8, 0.32, 4.4), C.chalk, [0, 5.5, -1.55], [0, 0, 0], 1, stoneOpt);
  K.put('stone', box(18.8, 0.7, 0.46), C.coral, [0, 5.97, 0.4], [0, 0, 0], 1, stoneOpt);
  K.pop();
  // The return wall is low, revealing harbor trees and the washed coastal town.
  K.put('stone', box(3.4, 3.2, 20), C.coral, [-20, 1.6, 11.4], [0, 0, 0], 1, stoneOpt);
  K.put('stone', box(3.75, 0.23, 20.4), C.chalk, [-20, 3.3, 11.4], [0, 0, 0], 1, stoneOpt);

  // Rough timber shade frame and rust-red awning, tucked into the far quay corner.
  for (const x of [9.5, 16.4]) for (const z of [-15.5, -18]) {
    limb(K, 'wood', [x, 0, z], [x, 3.8, z], 0.105, 0.08, C.woodLight);
  }
  for (const z of [-15.5, -18]) limb(K, 'wood', [9.5, 3.75, z], [16.4, 3.75, z], 0.08, 0.08, C.woodLight);
  for (let i = 0; i < 12; i++) {
    const xa = 9.4 + i * 0.6, xb = xa + 0.6;
    const ya = 3.65 - Math.sin(i / 12 * Math.PI) * 0.35, yb = 3.65 - Math.sin((i + 1) / 12 * Math.PI) * 0.35;
    const a = [xa, ya, -15.2], b = [xb, yb, -15.2], c = [xb, yb, -18.4], d = [xa, ya, -18.4];
    K.put('cloth', triangle(a, b, c), i % 4 ? C.sail : C.sailLight);
    K.put('cloth', triangle(a, c, d), i % 4 ? C.sail : C.sailLight);
  }
  for (const [x, z, scale] of [[13, -15.8, 1], [14.3, -16, 0.8], [-12.5, -16.2, 1.1], [-14, -15.8, 0.9]]) {
    K.put('wood', cyl(0.44, 0.38, 1.05, 10), C.woodLight, [x, 0.52 * scale, z], [0, 0, 0], scale);
    for (const y of [0.15, 0.81]) K.put('hull', new THREE.TorusGeometry(0.42 * scale, 0.036, 5, 10), C.tar, [x, y * scale, z], [Math.PI / 2, 0, 0]);
  }

  // Sparse coastal palms: silhouettes belong to the town, not a tropical beach.
  for (const [x, z, height] of [[-27, 14, 12.7], [-28, 4, 10.5], [-24, -25, 11.8]]) {
    const lean = 1.2;
    for (let i = 0; i < 6; i++) limb(K, 'wood', [x + lean * (i / 6) ** 2, height * i / 6, z],
      [x + lean * ((i + 1) / 6) ** 2, height * (i + 1) / 6, z], 0.23 - i * 0.018, 0.215 - i * 0.018, 0x786b4f);
    for (let j = 0; j < 9; j++) {
      const a = j / 9 * TAU, len = 3.6 + r() * 1.4;
      const root = [x + lean, height, z];
      let prev = root;
      for (let k = 1; k <= 5; k++) {
        const f = k / 5, next = [root[0] + Math.cos(a) * len * f, height + Math.sin(f * Math.PI) * 0.9 - f * f * 1.8, z + Math.sin(a) * len * f];
        limb(K, 'leaf', prev, next, 0.035, 0.025, 0x414e3c, {}, 4);
        const width = Math.sin(f * Math.PI) * 0.62 + 0.13;
        for (const side of [-1, 1]) K.put('leaf', triangle(prev, next, [next[0] + Math.cos(a + Math.PI / 2) * width * side,
          next[1] - 0.33, next[2] + Math.sin(a + Math.PI / 2) * width * side]), j % 2 ? 0x526047 : 0x3c4d41);
        prev = next;
      }
    }
  }

  // Near lateen dhow, larger offshore square-rig merchant, distant coastal dhow.
  dhow(K, [40.5, -2.15, -3.5], 0.12, 0.9, true);
  // The visible hawsers terminate on real bollards. Long, heavy catenaries tie
  // the ship to the quay and replace the earlier line ending in empty water.
  for (const [a, b] of [[[37.7, 0.75, -12.1], [18.1, 0.7, -6]], [[38.9, 0.65, 4.7], [18.1, 0.7, 12]]]) {
    let prev = a;
    for (let i = 1; i <= 14; i++) {
      const f = i / 14;
      const next = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(Math.PI * f) * 1.05, a[2] + (b[2] - a[2]) * f];
      limb(K, 'rope', prev, next, 0.078, 0.078, C.rope, { noise: 0.025 }, 6); prev = next;
    }
  }
  merchantShip(K, [82, -2.65, 43], 0.55);
  dhow(K, [95, -2.3, -61], 0.7, 0.46);
  beaconIsland(K, stoneOpt);
  for (let i = 0; i < 13; i++) {
    const z = 28 + i * 3.1, h = 3 + r() * 5;
    K.put('stone', box(3.0 + r() * 2, h, 4 + r() * 2), 0xa0a894, [-42 - r() * 8, h / 2 - 1, z], [0, r() * 0.12, 0], 1, stoneOpt);
  }

  const mats = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, map: stoneTex, roughness: 0.96 }),
    floor: new THREE.MeshStandardMaterial({ vertexColors: true, map: floorTex, roughness: 0.9 }),
    inlay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    rope: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.38 }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, map: sailTexture(), roughness: 1, flatShading: true, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  // Fine grains are shaded at world scale and fade with distance. The atlas
  // supplies the broad damp/traffic patches; no extra downloaded texture.
  mats.floor.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec2 harborEarthXZ;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      harborEarthXZ = (modelMatrix * vec4(position, 1.0)).xz;
    `);
    shader.fragmentShader = `varying vec2 harborEarthXZ;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 grainCell = floor(harborEarthXZ * 68.0);
      float grain = fract(sin(dot(grainCell, vec2(127.1, 311.7))) * 43758.5453);
      float nearGrain = 1.0 - smoothstep(8.0, 23.0, distance(cameraPosition.xz, harborEarthXZ));
      diffuseColor.rgb *= 1.0 + (grain - 0.5) * 0.16 * nearGrain;
    `);
  };
  mats.floor.customProgramCacheKey = () => 'corsair-compact-sandy-earth-1';
  const windTime = { value: 0 };
  mats.cloth.onBeforeCompile = (shader) => {
    shader.uniforms.corsairWindTime = windTime;
    shader.vertexShader = `uniform float corsairWindTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float belly = clamp(27.0 * uv.x * uv.y * (1.0 - uv.x - uv.y), 0.0, 1.0) * (1.0 - step(60.0, position.x));
      float pull = sin(corsairWindTime * 0.9817477) * 0.22;
      float flutter = sin(corsairWindTime * 1.9634954 + position.z * 0.4) * 0.055;
      transformed += vec3(0.9928086, 0.0, -0.1197122) * belly * (pull + flutter);
    `);
  };
  mats.cloth.customProgramCacheKey = () => 'corsair-anchored-lateen-3';
  for (const [name, material] of Object.entries(mats)) {
    const mesh = K.mesh(name, material, { cast: name === 'stone' || name === 'wood', receive: name !== 'leaf' });
    if (name === 'floor' && mesh) {
      // Put the 38m landing inside one atlas tile. Repeating at world x/z=0
      // would cut the broad stains across the centre of the duel circle.
      const uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
    }
    if (mesh) { mesh.name = `corsair-${name}`; scene.add(mesh); }
    // Kit copies its pieces into the final mesh; they have never reached the GPU.
    for (const g of K.bins[name] ?? []) g.dispose();
  }

  let t = 0, nextGullCall = 6.9, gullCalls = 0, lastDetail = -10;
  const tideClock = (time) => time + Math.sin(time * 0.31) * 0.24 + Math.sin(time * 0.13) * 0.14;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xffe7c0, rimColor: 0xb6dfdf, level: 0.16 },
    excite() {},
    update(dt) {
      const previous = tideClock(t) % 6.4;
      t = (t + (Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0));
      sea.uniforms.time.value = t;
      wash.uniforms.time.value = tideClock(t);
      windTime.value = tideClock(t);
      gulls.update(t);
      if (t >= nextGullCall && t - lastDetail >= 2.2) {
        const p = gulls.flying.position;
        stage.onEvent?.('stageDetail', { kind: 'gullCall', amp: 0.26, pos: { x: p.x, y: p.y, z: p.z }, seed: 5113 + gullCalls, time: t });
        lastDetail = t;
        gullCalls++;
        nextGullCall += 29.92 + Math.sin(gullCalls * 2.399) * 2.2;
      }
      const phase = tideClock(t) % 6.4;
      // Wind and wash share a slowly varying clock; visual crests still trigger
      // their sounds. Gulls take a quiet slot instead of competing every few seconds.
      if (previous < 1.6 && phase >= 1.6 && t - lastDetail >= 2.2) {
        stage.onEvent?.('stageDetail', { kind: 'riggingCreak', amp: 0.34 + Math.sin(t * 0.23) * 0.04, pos: { x: 40.5, y: 8, z: -3.5 }, seed: 5101, time: t });
        lastDetail = t;
      }
      if (previous < 4.8 && phase >= 4.8 && t - lastDetail >= 2.2) {
        stage.onEvent?.('stageDetail', { kind: 'waterLap', amp: 0.28 + Math.sin(t * 0.39) * 0.04, pos: { x: 19.35, y: -0.6, z: -6.5 }, seed: 5102, time: t });
        lastDetail = t;
      }
    },
  };
  return stage;
}
