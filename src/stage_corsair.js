// Omari's anchorage: a coral-stone sea fort on the Indian Ocean after a squall.
// All detail is procedural and visual only. The flat 6.5m ring and camera orbit
// stay clear; the sea starts beyond a broad, stationary masonry quay.
import * as THREE from 'three';
import { ARENA } from './config.js';
import { Kit, rng, box, cyl, limb, canvasTex } from './stage_kit.js';

const C = {
  coral: 0xdcc8a4, chalk: 0xf0e4cd, worn: 0xb6a688, shadow: 0x766e58,
  wood: 0x302e29, woodLight: 0x594b35, tar: 0x191f20, rope: 0xa98c58,
  brass: 0xb39552, sail: 0xb86845, sailLight: 0xd4a779, dark: 0x252f2d,
};
const TAU = Math.PI * 2;

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

function triangle(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
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
      const c = [wb * 0.63 * side, 0.0, zb], d = [wa * 0.63 * side, 0.0, za];
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
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
    // Panelled triangular cloth: a shallow belly and seams, baked in one mesh.
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
        K.put('cloth', triangle(a, b, c), color, [0, 0, 0], [0, 0, 0], 1, { vary: 0.11, noise: 0.025 });
        if (j < rows - i - 1) K.put('cloth', triangle(b, point((i + 1) / rows, (j + 1) / rows), c), color, [0, 0, 0], [0, 0, 0], 1, { vary: 0.11, noise: 0.025 });
      }
      if (hero && i > 0) limb(K, 'rope', point(i / rows, 0), point(i / rows, 1 - i / rows), 0.012, 0.012, C.rope, {}, 4);
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
    limb(K, 'rope', [-2.7, 2.9, -4], [-13, 1.8, -11], 0.055, 0.055, C.rope, {}, 6);
    limb(K, 'wood', [0, 3.4, 11], [0, 5.5, 17], 0.14, 0.06, C.woodLight);
  }
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
  const stoneTex = coralTexture();
  const stoneOpt = { uv: 'box', uvScale: 0.42, vary: 0.11, noise: 0.035 };

  // Wide masonry landing: edges are 18m+ from the duel, and no combat surface moves.
  K.put('stone', box(38, 2.7, 37), C.worn, [0, -1.42, 0], [0, 0, 0], 1, stoneOpt);
  K.put('stone', box(38.5, 0.24, 37.5), C.chalk, [0, -0.16, 0], [0, 0, 0], 1, stoneOpt);
  for (let z = -17.7; z <= 17.7; z += 1.75) {
    for (let x = -18.4; x < 18.2; x += 2.8) {
      const width = Math.min(2.76, 18.4 - x);
      if (width <= 0) continue;
      K.put('floor', box(width, 0.05, 1.72), r() < 0.12 ? 0xcbbfa6 : 0xe0d7c2,
        [x + width * 0.5, -0.045, z], [0, 0, 0], 1, { ...stoneOpt, vary: 0.095, noise: 0.025 });
    }
  }
  // The ring is a pale, flush stone inset with a thin incised bronze boundary.
  K.put('floor', new THREE.CircleGeometry(ARENA.radius, 96), 0xede2c9, [0, -0.009, 0], [-Math.PI / 2, 0, 0], 1, stoneOpt);
  K.put('inlay', new THREE.RingGeometry(ARENA.radius - 0.07, ARENA.radius + 0.04, 96), 0x978560, [0, -0.003, 0], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU, rad = ARENA.radius + 0.25;
    K.put('floor', box(0.35, 0.022, 0.78), i % 6 ? C.chalk : C.worn,
      [Math.cos(a) * rad, -0.004, Math.sin(a) * rad], [0, -a, 0], 1, { ...stoneOpt, rough: 0.012 });
  }
  // A worn navigation rose is quiet enough to leave the fighters dominant.
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, len = i % 2 ? 0.78 : 1.23;
    const rotate = (x, z) => [Math.cos(a) * x - Math.sin(a) * z, -0.002, Math.sin(a) * x + Math.cos(a) * z];
    K.put('inlay', triangle(rotate(-0.11, 0.15), rotate(0.11, 0.15), rotate(0, len)), i % 2 ? 0xa89a79 : 0x8a836b);
  }

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

  // Main dhow has its broadside to the opening camera; two distant hulls give scale.
  dhow(K, [43, -2.15, -3.5], 0.12, 0.82, true);
  dhow(K, [65, -2.3, 47], -0.25, 0.6);
  dhow(K, [95, -2.3, -61], 0.7, 0.46);
  for (let i = 0; i < 13; i++) {
    const z = 28 + i * 3.1, h = 3 + r() * 5;
    K.put('stone', box(3.0 + r() * 2, h, 4 + r() * 2), 0xa0a894, [-42 - r() * 8, h / 2 - 1, z], [0, r() * 0.12, 0], 1, stoneOpt);
  }
  // A handful of distant seabirds remain part of the static merged silhouette.
  for (let i = 0; i < 14; i++) {
    const x = 39 + r() * 40, y = 15 + r() * 16, z = (r() - 0.5) * 80;
    for (const side of [-1, 1]) K.put('hull', triangle([x, y, z], [x + 0.18, y + 0.17, z + side * 0.52], [x - 0.06, y + 0.08, z + side * 0.44]), 0x526564);
  }

  const mats = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, map: stoneTex, roughness: 0.96 }),
    floor: new THREE.MeshStandardMaterial({ vertexColors: true, map: stoneTex, roughness: 0.88 }),
    inlay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    rope: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.38 }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  for (const [name, material] of Object.entries(mats)) {
    const mesh = K.mesh(name, material, { cast: name === 'stone' || name === 'wood', receive: name !== 'leaf' });
    if (mesh) { mesh.name = `corsair-${name}`; scene.add(mesh); }
    // Kit copies its pieces into the final mesh; they have never reached the GPU.
    for (const g of K.bins[name] ?? []) g.dispose();
  }

  let t = 0;
  return {
    sunOffset,
    fighterLight: { color: 0xffe7c0, rimColor: 0xb6dfdf, level: 0.16 },
    excite() {},
    update(dt) {
      t += Math.min(Math.max(dt, 0), 0.1);
      sea.uniforms.time.value = t;
    },
  };
}
