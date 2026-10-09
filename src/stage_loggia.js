// A late-afternoon Italian fencing courtyard. The fighting surface is completely
// flat; architecture begins beyond the camera's 10.5 m orbit. All resources are
// owned by scene children so Stages.clear() can release the whole stage.
import * as THREE from 'three';
import { ARENA } from './config.js';
import { Kit, box, cyl, canvasTex, rng } from './stage_kit.js';

const PALETTE = {
  ivory: 0xe8d8b7,
  light: 0xf7e9cb,
  sand: 0xc1aa84,
  trim: 0xa18b6d,
  indigo: 0x313b58,
  recess: 0x222b43,
  burgundy: 0x7b273a,
  gold: 0xc4a06a,
  roof: 0xa9543c,
  green: 0x2e4739,
};

function plasterTexture() {
  const random = rng(9109);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f5f0e4';
    ctx.fillRect(0, 0, w, h);
    // Travertine pores: restrained enough to keep the long architectural lines.
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(111,92,63,${0.015 + random() * 0.075})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 6, 0.4 + random());
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(146,125,94,0.035)';
      ctx.fillRect(0, random() * h, w, 1 + random() * 2);
    }
  });
}

function pavingTexture() {
  const random = rng(6121);
  // One atlas covers the whole 30 m terrace. The motif is sized in metres so
  // broad inlays survive the low fighting camera; the 1024 atlas keeps joints.
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const unit = w / 30;
    ctx.translate(w / 2, h / 2);
    ctx.scale(unit, unit);
    const stone = ['#ddd6c2', '#c7c5b2', '#e9e0c9', '#7c8b7d', '#adb5a1', '#b3a183'];
    const polygon = (points, color, detail = true) => {
      ctx.save();
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.clip();
      if (detail) {
        const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        const bw = Math.max(...xs) - x, bh = Math.max(...ys) - y;
        // Each cut stone has its own mineral direction and muted cloudy grain.
        for (let j = 0; j < 3; j++) {
          ctx.strokeStyle = j ? 'rgba(85,82,61,0.075)' : 'rgba(255,250,227,0.22)';
          ctx.lineWidth = 0.025 + random() * 0.035;
          ctx.beginPath();
          const py = y + random() * bh;
          ctx.moveTo(x - 0.1, py);
          ctx.bezierCurveTo(x + bw * 0.3, py + bh * 0.12, x + bw * 0.55, py - bh * 0.18, x + bw + 0.1, py + bh * 0.2);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.strokeStyle = '#858571';
      ctx.lineWidth = 0.024;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,249,223,0.28)';
      ctx.lineWidth = 0.01;
      ctx.stroke();
    };
    const radial = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    const sector = (inner, outer, start, end, color) => {
      const points = [];
      for (let j = 0; j <= 5; j++) points.push(radial(outer, start + (end - start) * j / 5));
      for (let j = 5; j >= 0; j--) points.push(radial(inner, start + (end - start) * j / 5));
      polygon(points, color);
    };
    const annulus = (inner, outer, color, count = 64) => {
      for (let j = 0; j < count; j++) sector(inner, outer, j * Math.PI * 2 / count, (j + 1) * Math.PI * 2 / count, color);
    };
    ctx.fillStyle = '#aaa793';
    ctx.fillRect(-15, -15, 30, 30);
    for (let row = 0; row < 28; row++) for (let col = 0; col < 28; col++) {
      const size = 30 / 28;
      const x = col * size - 15, y = row * size - 15;
      polygon([[x, y], [x + size, y], [x + size, y + size], [x, y + size]], stone[(row + col) % 3]);
      // A clipped corner makes the green cabochons part of the stone setting.
      polygon([[x, y - 0.1], [x + 0.1, y], [x, y + 0.1], [x - 0.1, y]], stone[3], false);
    }
    // A broad square intarsia frame connects the round duel floor to the arcade.
    for (const [inset, width, color] of [[11.35, 0.14, stone[3]], [11.05, 0.32, stone[4]], [10.75, 0.08, stone[5]]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(-inset, -inset, inset * 2, inset * 2);
    }
    for (let side = 0; side < 4; side++) {
      ctx.save();
      ctx.rotate(side * Math.PI / 2);
      for (let j = -10; j <= 10; j++) {
        polygon([[j - 0.38, -11.05], [j, -11.31], [j + 0.38, -11.05], [j, -10.79]], j % 2 ? stone[0] : stone[3]);
      }
      ctx.restore();
    }
    // Opus sectile: cut marble petals, a sixteen-point compass, and a linked
    // diamond band. No raised geometry or decorative physics inside the arena.
    annulus(5.8, 6.35, stone[2]);
    annulus(5.72, 5.8, stone[3]);
    annulus(5.37, 5.72, stone[4]);
    annulus(5.25, 5.37, stone[2]);
    for (let j = 0; j < 48; j++) {
      const a = j * Math.PI / 24;
      polygon([radial(5.39, a), radial(5.54, a + 0.054), radial(5.7, a), radial(5.54, a - 0.054)], j % 2 ? stone[2] : stone[3]);
    }
    annulus(4.63, 5.25, stone[0]);
    annulus(4.47, 4.63, stone[3]);
    annulus(4.32, 4.47, stone[2]);
    for (let j = 0; j < 16; j++) {
      const a = j * Math.PI / 8;
      sector(0, 4.32, a, a + Math.PI / 8, stone[0]);
      const mid = a + Math.PI / 16;
      polygon([radial(1.66, mid), radial(2.65, a + 0.035), radial(4.2, mid), radial(2.65, a + Math.PI / 8 - 0.035)], j % 2 ? stone[4] : stone[1]);
      polygon([radial(1.66, mid), radial(2.65, a + 0.035), radial(4.2, mid), radial(2.65, mid)], j % 2 ? stone[3] : stone[5]);
      polygon([radial(4.73, mid), radial(4.95, mid + 0.046), radial(5.14, mid), radial(4.95, mid - 0.046)], stone[3]);
    }
    annulus(1.48, 1.68, stone[2], 32);
    annulus(1.4, 1.48, stone[3], 32);
    for (let j = 0; j < 16; j++) {
      const a = j * Math.PI / 8;
      polygon([[0, 0], radial(j % 2 ? 1.07 : 1.34, a), radial(0.54, a + Math.PI / 16)], j % 2 ? stone[3] : stone[2]);
      polygon([[0, 0], radial(0.54, a + Math.PI / 16), radial(j % 2 ? 1.34 : 1.07, a + Math.PI / 8)], stone[4]);
    }
    // Small satellite medallions make the border legible in oblique/reverse views.
    for (let j = 0; j < 8; j++) {
      const a = (j + 0.5) * Math.PI / 4;
      ctx.save();
      ctx.translate(...radial(8.1, a));
      ctx.rotate(a);
      polygon([[-0.95, 0], [0, -0.95], [0.95, 0], [0, 0.95]], stone[3]);
      polygon([[-0.79, 0], [0, -0.79], [0.79, 0], [0, 0.79]], stone[2]);
      for (let k = 0; k < 8; k++) polygon([[0, 0], radial(k % 2 ? 0.34 : 0.67, k * Math.PI / 4), radial(k % 2 ? 0.67 : 0.34, (k + 1) * Math.PI / 4)], k % 2 ? stone[4] : stone[5]);
      ctx.restore();
    }
    // Cloudy mineral wear crosses joins gently, avoiding a pristine printed mat.
    for (let i = 0; i < 40; i++) {
      const x = (random() - 0.5) * 29, y = (random() - 0.5) * 29;
      const r = 0.3 + random() * 1.8;
      const wear = ctx.createRadialGradient(x, y, 0, x, y, r);
      wear.addColorStop(0, i % 3 ? 'rgba(111,103,71,0.10)' : 'rgba(248,236,204,0.21)');
      wear.addColorStop(1, 'rgba(111,103,71,0)');
      ctx.fillStyle = wear;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 700; i++) {
      const x = (random() - 0.5) * 30, y = (random() - 0.5) * 30;
      ctx.fillStyle = i % 3 ? 'rgba(96,88,65,0.12)' : 'rgba(255,246,220,0.23)';
      ctx.fillRect(x, y, 0.02 + random() * 0.12, 0.02 + random() * 0.035);
    }
  });
}

function skyTexture() {
  const random = rng(231);
  return canvasTex(512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7b9dba');
    sky.addColorStop(0.34, '#a6bdcc');
    sky.addColorStop(0.44, '#d5cbd0');
    sky.addColorStop(0.5, '#e8ceb0');
    sky.addColorStop(0.58, '#c7b8a0');
    sky.addColorStop(1, '#b3b3a2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = random() * w;
      const y = 55 + random() * 45;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, 55);
      cloud.addColorStop(0, 'rgba(255,235,203,0.13)');
      cloud.addColorStop(1, 'rgba(255,235,203,0)');
      ctx.fillStyle = cloud;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.16);
      ctx.translate(-x, -y);
      ctx.fillRect(x - 60, y - 60, 120, 120);
      ctx.restore();
    }
  });
}

// A real opening, with curved soffit and rectangular spandrels above it.
function archPanel(radius, spring, halfWidth, top, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, spring);
  shape.lineTo(-halfWidth, top);
  shape.lineTo(halfWidth, top);
  shape.lineTo(halfWidth, spring);
  shape.lineTo(radius, spring);
  for (let i = 1; i <= 28; i++) {
    const angle = i / 28 * Math.PI;
    shape.lineTo(Math.cos(angle) * radius, spring + Math.sin(angle) * radius);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function archBand(inner, outer, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function roofGeometry(width, depth, rise) {
  const x = width / 2;
  const z = depth / 2;
  const positions = [
    -x, 0, z, x, 0, z, x, rise, 0, -x, 0, z, x, rise, 0, -x, rise, 0,
    x, 0, -z, -x, 0, -z, -x, rise, 0, x, 0, -z, -x, rise, 0, x, rise, 0,
    -x, 0, -z, -x, 0, z, -x, rise, 0, x, 0, z, x, 0, -z, x, rise, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildLoggia(scene, { hemi, sun } = {}) {
  const random = rng(64091);
  const kit = new Kit(1947);
  const fogColor = 0xd7c5ae;
  const sunOffset = { x: -7, y: 7.5, z: 5 };
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.Fog(fogColor, 27, 125);
  if (hemi) {
    hemi.color.set(0xb8c8df);
    hemi.groundColor.set(0xd7c8ae);
    hemi.intensity = 1.18;
  }
  if (sun) {
    sun.color.set(0xffd7a9);
    sun.intensity = 1.7;
    sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 40, 20),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // Kit clones its input. Dispose the CPU-only source immediately, then dispose
  // the temporary bins after merging; only final scene resources survive.
  const put = (bin, geometry, color, position, rotation, scale, options) => {
    const result = kit.put(bin, geometry, color, position, rotation, scale, options);
    geometry.dispose();
    return result;
  };
  const stone = { vary: 0.085, noise: 0.04, rough: 0.013, uv: 'box', uvScale: 0.28 };
  const block = (bin, w, h, d, color, position, options = stone) => put(bin, box(w, h, d), color, position, undefined, undefined, options);
  const ring = (inner, outer, color, y) => put('inlay', new THREE.RingGeometry(inner, outer, 128), color, [0, y, 0], [-Math.PI / 2, 0, 0], 1, { vary: 0, noise: 0 });

  // Both decorative layers remain below the y=0 physics ground. There are no
  // columns, planters, steps, or other false obstacles inside the fighting area.
  put('ground', new THREE.PlaneGeometry(160, 160), 0xb4ac8f, [0, -0.036, 0], [-Math.PI / 2, 0, 0]);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.92, color: 0xfff7e8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);
  // Adjacent annuli share a height but never overlap, avoiding shallow-view
  // z-fighting where the fine brass line meets its dark stone surround.
  ring(ARENA.radius - 0.16, ARENA.radius - 0.115, 0x69756a, -0.008);
  ring(ARENA.radius - 0.115, ARENA.radius - 0.055, 0xdbb67c, -0.008);
  ring(ARENA.radius - 0.055, ARENA.radius + 0.035, 0x69756a, -0.008);
  ring(ARENA.radius + 0.035, ARENA.radius + 0.085, 0xe8d8ad, -0.008);
  ring(ARENA.radius + 0.085, ARENA.radius + 0.12, 0x69756a, -0.008);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    // Small compass marks make the arena's edge legible from any orbit angle.
    const r = ARENA.radius;
    put('inlay', new THREE.PlaneGeometry(0.15, 0.38), PALETTE.gold, [Math.sin(a) * r, -0.006, Math.cos(a) * r], [-Math.PI / 2, 0, -a], 1, { vary: 0, noise: 0 });
  }

  function column(x, z, height = 4.35, radius = 0.22) {
    block('stone', radius * 3.4, 0.22, radius * 3.4, PALETTE.sand, [x, 0.11, z]);
    put('stone', cyl(radius * 1.5, radius * 1.62, 0.14, 12), PALETTE.light, [x, 0.28, z], undefined, 1, stone);
    put('stone', cyl(radius * 0.83, radius, height - 0.72, 12), PALETTE.ivory, [x, (height - 0.72) / 2 + 0.36, z], undefined, 1, stone);
    put('stone', cyl(radius * 1.42, radius * 0.94, 0.2, 12), PALETTE.light, [x, height - 0.26, z], undefined, 1, stone);
    block('stone', radius * 3.35, 0.18, radius * 3.35, PALETTE.light, [x, height - 0.07, z]);
    put('trim', cyl(radius * 1.03, radius * 1.03, 0.055, 12), PALETTE.trim, [x, 0.45, z]);
  }

  function arcade(position, rotation, centers) {
    kit.push(position, rotation);
    const left = Math.min(...centers) - 2.5;
    const right = Math.max(...centers) + 2.5;
    const width = right - left;
    const mid = (right + left) / 2;
    block('recess', width, 0.08, 4.1, 0x777a73, [mid, -0.04, -1.65]);
    block('recess', width, 0.42, 3.9, 0x555e66, [mid, 6.57, -1.55]);
    // Real rear archways and shadowed piers reveal the light garden beyond.
    // Nothing seals the openings with a flat dark plane.
    for (const x of centers) {
      put('stone', archPanel(1.96, 4.1, 2.5, 6.75, 0.45), 0x8e958e, [x, 0, -3.75], undefined, 1, stone);
      put('stone', archBand(1.96, 2.16, 0.14), 0xb7b9a3, [x, 4.1, -3.48], undefined, 1, stone);
      for (const side of [-1, 1]) {
        put('stone', cyl(0.24, 0.29, 4.12, 10), 0x8d958c, [x + side * 2.46, 2.06, -3.75], undefined, 1, stone);
        block('stone', 0.8, 0.2, 0.74, 0xaab09c, [x + side * 2.46, 4.15, -3.75]);
      }
      block('ground', 4.4, 0.06, 6, 0xa5a98a, [x, -0.05, -7]);
      block('leaves', 3.6, 0.58, 0.8, 0x65794e, [x, 0.29, -8.65], { vary: 0.09, noise: 0.08, rough: 0.15 });
    }
    block('recess', width, 0.18, 3, PALETTE.recess, [mid, 6.77, -1.3]);
    block('stone', width + 0.4, 0.23, 3.3, PALETTE.light, [mid, 7.03, -1.2]);
    block('stone', width + 0.5, 0.14, 3.55, PALETTE.light, [mid, 7.25, -1.2]);
    block('trim', width + 0.32, 0.16, 0.3, PALETTE.sand, [mid, 6.76, 0.42]);
    put('roof', roofGeometry(width + 0.9, 4.1, 0.78), PALETTE.roof, [mid, 7.32, -1.18]);
    for (const x of centers) {
      put('stone', archPanel(2.16, 4.35, 2.5, 6.81, 0.62), PALETTE.ivory, [x, 0, 0], undefined, 1, stone);
      put('stone', archBand(2.16, 2.4, 0.13), PALETTE.light, [x, 4.35, 0.38], undefined, 1, stone);
      block('stone', 0.27, 0.4, 0.2, PALETTE.light, [x, 6.64, 0.51]);
      // Stone benches sit in shade between the front and rear colonnades.
      block('stone', 2.2, 0.19, 0.65, PALETTE.sand, [x, 0.75, -1.78]);
      for (const side of [-1, 1]) block('stone', 0.25, 0.66, 0.58, PALETTE.trim, [x + side * 0.77, 0.33, -1.78]);
    }
    const piers = [...new Set(centers.flatMap((x) => [x - 2.5, x + 2.5]))];
    for (const x of piers) {
      column(x - 0.24, 0.035);
      column(x + 0.24, 0.035);
      block('stone', 1.15, 0.15, 0.95, PALETTE.light, [x, 4.44, 0]);
    }
    // A restrained dentil cornice rather than defensive castle crenellations.
    for (let x = left + 0.28; x < right; x += 0.64) block('stone', 0.23, 0.17, 0.28, PALETTE.sand, [x, 6.86, 0.46]);
    kit.pop();
  }
  arcade([0, 0, -14.3], 0, [-7.5, -2.5, 2.5, 7.5]);
  arcade([0, 0, 14.3], Math.PI, [-7.5, -2.5, 2.5, 7.5]);
  arcade([14.3, 0, 0], -Math.PI / 2, [-7.5]);
  arcade([14.3, 0, 0], -Math.PI / 2, [7.5]);

  // The eastern gate is the landmark: a sunlit open triumphal arch with a real
  // circular oculus above it, backed by a distant terracotta hill town.
  kit.push([14.48, 0, 0], -Math.PI / 2);
  for (const side of [-1, 1]) {
    block('stone', 1.48, 4.85, 1.2, PALETTE.ivory, [side * 3.75, 2.425, -0.1]);
    column(side * 3.68 - 0.3, 0.71, 5.03, 0.29);
    column(side * 3.68 + 0.3, 0.71, 5.03, 0.29);
    block('stone', 1.32, 0.22, 1.3, PALETTE.light, [side * 3.7, 5.08, 0.32]);
  }
  put('stone', archPanel(3, 4.85, 4.5, 8.45, 1.15), PALETTE.ivory, [0, 0, -0.08], undefined, 1, stone);
  put('stone', archBand(3, 3.34, 0.22), PALETTE.light, [0, 4.85, 0.6], undefined, 1, stone);
  for (let i = 0; i < 15; i++) {
    const angle = (i + 0.5) / 15 * Math.PI;
    put('trim', box(0.019, 0.26, 0.03), PALETTE.sand, [Math.cos(angle) * 3.17, 4.85 + Math.sin(angle) * 3.17, 0.725], [0, 0, angle - Math.PI / 2]);
  }
  block('stone', 9.35, 0.24, 1.55, PALETTE.light, [0, 8.45, 0]);
  const attic = new THREE.Shape();
  attic.moveTo(-4.25, 8.57);
  attic.lineTo(4.25, 8.57);
  attic.lineTo(4.25, 11.45);
  attic.lineTo(-4.25, 11.45);
  attic.closePath();
  const oculus = new THREE.Path();
  oculus.absarc(0, 10.04, 1.05, 0, Math.PI * 2, true);
  attic.holes.push(oculus);
  put('stone', new THREE.ExtrudeGeometry(attic, { depth: 0.75, bevelEnabled: false, curveSegments: 32 }), PALETTE.ivory, [0, 0, -0.38], undefined, 1, stone);
  put('stone', new THREE.TorusGeometry(1.13, 0.115, 8, 48), PALETTE.light, [0, 10.04, 0.48], undefined, 1, stone);
  put('trim', new THREE.TorusGeometry(1.29, 0.035, 6, 48), PALETTE.gold, [0, 10.04, 0.42]);
  for (const side of [-1, 1]) {
    block('stone', 0.29, 2.78, 0.22, PALETTE.light, [side * 3.89, 10, 0.46]);
    put('trim', new THREE.CircleGeometry(0.37, 24), PALETTE.sand, [side * 2.59, 10.03, 0.42]);
    put('stone', new THREE.TorusGeometry(0.37, 0.055, 6, 24), PALETTE.light, [side * 2.59, 10.03, 0.45]);
  }
  block('stone', 9.1, 0.19, 1.4, PALETTE.light, [0, 11.52, 0]);
  block('trim', 9.35, 0.12, 1.58, PALETTE.sand, [0, 11.69, 0]);
  put('roof', roofGeometry(9.65, 2.15, 0.52), PALETTE.roof, [0, 11.76, -0.04]);
  kit.pop();

  // The western edge opens over the town. Its low balustrade leaves sky and
  // distant roofs visible when the fighting camera turns through this side.
  kit.push([-14.6, 0, 0], Math.PI / 2);
  block('stone', 25.1, 0.19, 0.8, PALETTE.sand, [0, 0.095, 0]);
  block('stone', 25.5, 0.2, 0.83, PALETTE.light, [0, 1.25, 0]);
  for (let x = -12; x <= 12; x += 0.75) {
    put('stone', cyl(0.1, 0.15, 0.33, 8), PALETTE.ivory, [x, 0.4, 0], undefined, 1, stone);
    put('stone', cyl(0.12, 0.21, 0.35, 8), PALETTE.ivory, [x, 0.72, 0], undefined, 1, stone);
    put('stone', cyl(0.16, 0.12, 0.27, 8), PALETTE.ivory, [x, 1.02, 0], undefined, 1, stone);
  }
  for (const x of [-12.4, -6.2, 0, 6.2, 12.4]) block('stone', 0.64, 1.37, 0.73, PALETTE.ivory, [x, 0.685, 0]);
  kit.pop();

  function cypress(x, z, height) {
    put('wood', cyl(0.13, 0.24, height * 0.48, 7), 0x70604a, [x, height * 0.24, z]);
    for (let j = 0; j < 5; j++) {
      const y = height * (0.32 + j * 0.132);
      const width = height * (0.13 - j * 0.016);
      put('leaves', new THREE.IcosahedronGeometry(1, 1), j % 2 ? 0x354e3b : PALETTE.green,
        [x + (random() - 0.5) * 0.15, y, z + (random() - 0.5) * 0.15], [0, random() * Math.PI, 0], [width, height * 0.255, width * 0.8], { noise: 0.075, vary: 0.1 });
    }
  }
  for (const [x, z, h] of [[-12.5, -12.7, 7.9], [-12.5, 12.7, 8.5], [12.3, -12.4, 8.2], [12.3, 12.4, 9.1], [-20, -15, 9], [-20, 14, 10], [21, -8, 10.3], [21, 8, 8.9], [28, -5.2, 7.8], [28, 5.2, 8.3]]) cypress(x, z, h);
  for (const [x, z] of [[-9.3, -11.1], [-9.3, 11.1], [8.6, -11.25], [8.6, 11.25]]) {
    put('roof', cyl(0.5, 0.3, 0.85, 12), 0xb67150, [x, 0.425, z]);
    put('roof', cyl(0.54, 0.54, 0.14, 12), 0xc88a64, [x, 0.83, z]);
    put('leaves', new THREE.SphereGeometry(0.7, 12, 8), 0x526044, [x, 1.14, z], undefined, [1, 0.75, 1]);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      put('flowers', new THREE.IcosahedronGeometry(0.1, 0), i % 2 ? 0xba6970 : 0xe7bfab, [x + Math.cos(angle) * 0.48, 1.4 + random() * 0.14, z + Math.sin(angle) * 0.48]);
    }
  }

  // Warm plaster blocks and low pitched roofs form a continuous, distant town,
  // not a castle silhouette. A few restrained shutters give its scale away.
  for (let i = 0; i < 33; i++) {
    const angle = i / 33 * Math.PI * 2 + (random() - 0.5) * 0.08;
    const radius = 35 + random() * 20;
    const width = 4 + random() * 4;
    const depth = 4 + random() * 3;
    const height = 3.5 + random() * 6;
    kit.push([Math.cos(angle) * radius, -1.4, Math.sin(angle) * radius], -angle - Math.PI / 2);
    block('town', width, height, depth, [0xc8ac85, 0xd4b796, 0xb99f83, 0xd7bea1][i % 4], [0, height / 2, 0]);
    put('roof', roofGeometry(width + 0.6, depth + 0.7, 1.15), i % 2 ? 0xab6450 : PALETTE.roof, [0, height + 0.03, 0]);
    block('trim', width + 0.15, 0.16, depth + 0.18, PALETTE.sand, [0, height - 0.1, 0]);
    for (let y = 2.0; y < height - 0.8; y += 2.05) for (let x = -width / 2 + 0.95; x < width / 2 - 0.4; x += 1.75) block('distantDark', 0.48, 0.94, 0.06, 0x655d51, [x, y, depth / 2 + 0.04]);
    if (i % 3 === 0) block('town', 0.55, 1.4, 0.65, 0xbd9c77, [width * 0.22, height + 0.7, 0]);
    kit.pop();
  }
  kit.push([38, -1.4, -7], 0);
  block('town', 4.2, 16.4, 4.2, 0xc3a482, [0, 8.2, 0]);
  block('trim', 4.8, 0.27, 4.8, PALETTE.sand, [0, 16.4, 0]);
  put('roof', new THREE.ConeGeometry(3.75, 2.0, 4), PALETTE.roof, [0, 17.5, 0], [0, Math.PI / 4, 0]);
  for (const x of [-1, 1]) block('distantDark', 0.68, 2.0, 0.07, 0x6c6559, [x, 14.6, 2.13]);
  for (const z of [-1, 1]) block('distantDark', 0.07, 2.0, 0.68, 0x6c6559, [-2.13, 14.6, z]);
  kit.pop();
  for (let i = 0; i < 15; i++) {
    const angle = i / 15 * Math.PI * 2;
    put('hills', new THREE.SphereGeometry(1, 18, 10), i % 2 ? 0x939988 : 0x8a927f,
      [Math.cos(angle) * 78, -6, Math.sin(angle) * 78], [0, angle, 0], [24 + random() * 9, 11 + random() * 9, 27], { noise: 0.015, vary: 0.06 });
  }
  // A level garden walk continues through the gate into the distant town.
  put('ground', new THREE.PlaneGeometry(21, 5.8), 0xcdbb9b, [25.2, -0.025, 0], [-Math.PI / 2, 0, 0]);

  // Burgundy silk is confined to the distant arcade. All four banners share
  // one merged draw and a small vertex animation; their top edge stays fixed.
  function banner(position, rotation, width = 1.15, height = 3.5) {
    const geometry = new THREE.PlaneGeometry(width, height, 8, 16);
    const p = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      p.setZ(i, Math.cos(u * Math.PI * 8) * (0.045 + 0.06 * (1 - v)));
      p.setY(i, p.getY(i) - Math.sin(u * Math.PI) * 0.13 * (1 - v));
    }
    geometry.computeVertexNormals();
    const cloth = put('cloth', geometry, PALETTE.burgundy, position, [0, rotation, 0], 1, { vary: 0.03, noise: 0.025 });
    const colors = cloth.attributes.color;
    const mergedUV = cloth.attributes.uv;
    const gold = new THREE.Color(PALETTE.gold);
    for (let i = 0; i < colors.count; i++) {
      const v = mergedUV.getY(i);
      const u = mergedUV.getX(i);
      if ((v > 0.085 && v < 0.14) || u < 0.055 || u > 0.945) colors.setXYZ(i, gold.r, gold.g, gold.b);
    }
  }
  banner([13.27, 3.35, -4.37], -Math.PI / 2);
  banner([13.27, 3.35, 4.37], -Math.PI / 2);
  banner([-5.0, 3.4, -14.02], 0, 1.0, 3.35);
  banner([5.0, 3.4, 14.02], Math.PI, 1.0, 3.35);

  const standard = (options = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, ...options });
  const meshes = {};
  const materials = {
    stone: standard({ map: plasterTexture() }),
    trim: standard(),
    inlay: standard(),
    ground: standard(),
    recess: standard({ roughness: 1 }),
    roof: standard({ roughness: 1, flatShading: true }),
    town: standard(),
    hills: standard({ roughness: 1 }),
    distantDark: standard(),
    wood: standard(),
    leaves: standard({ flatShading: true, roughness: 1 }),
    flowers: standard({ flatShading: true }),
    cloth: standard({ side: THREE.DoubleSide, roughness: 1 }),
  };
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = kit.mesh(bin, material, { cast: bin === 'stone' || bin === 'leaves', receive: true });
    if (mesh) {
      mesh.name = `loggia-${bin}`;
      meshes[bin] = mesh;
      scene.add(mesh);
    } else material.dispose();
    for (const geometry of kit.bins[bin] ?? []) geometry.dispose();
  }

  // Seventy-two slow pollen motes, outside the center of the duel; no timers,
  // global randomness, dynamic lights, or particles spawning during combat.
  const count = 72;
  const motePositions = new Float32Array(count * 3);
  const motePhase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const radius = 7.4 + random() * 6;
    motePositions[i * 3] = Math.cos(a) * radius;
    motePositions[i * 3 + 1] = 0.7 + random() * 6;
    motePositions[i * 3 + 2] = Math.sin(a) * radius;
    motePhase[i] = random() * Math.PI * 2;
  }
  const moteHome = motePositions.slice();
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteTexture = canvasTex(16, 16, (ctx, w, h) => {
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    glow.addColorStop(0, 'rgba(255,244,209,0.8)');
    glow.addColorStop(0.3, 'rgba(255,244,209,0.45)');
    glow.addColorStop(1, 'rgba(255,244,209,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ map: moteTexture, color: 0xffe9b8, size: 0.055, transparent: true, opacity: 0.54, depthWrite: false }));
  motes.frustumCulled = false;
  scene.add(motes);

  const clothGeometry = meshes.cloth.geometry;
  const clothPositions = clothGeometry.attributes.position;
  const clothUV = clothGeometry.attributes.uv;
  const clothNormals = clothGeometry.attributes.normal;
  const clothHome = clothPositions.array.slice();
  let time = 0;
  let gust = 0;
  let nextClothRustle = 1.6;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xffe3c7, rimColor: 0xc7d8ef, rim: 1.05, level: 0.5 },
    excite(amount) {
      gust = Math.min(1, gust + Math.max(0, amount) * 0.24);
    },
    update(dt) {
      time += dt;
      gust = Math.max(0, gust - dt * 0.35);
      const breeze = 0.5 + Math.sin(time * 0.62) * 0.5;
      // This same slow wind crest lifts the silk and cues its quiet rustle.
      // The stage owns only the cue; the shared audio layer owns rate/distance.
      if (time >= nextClothRustle && breeze > 0.9) {
        stage.onEvent?.('stageDetail', { kind: 'clothRustle', amp: 0.32 + breeze * 0.12,
          pos: { x: 13.27, y: 3.35, z: -4.37 }, seed: 64091, time });
        nextClothRustle = time + 8;
      }
      for (let i = 0; i < clothPositions.count; i++) {
        const j = i * 3;
        const hang = 1 - clothUV.getY(i);
        const flutter = hang * (0.035 + breeze * 0.045 + gust * 0.07) * Math.sin(time * 1.7 + clothUV.getX(i) * 5 + clothHome[j] * 0.8 + clothHome[j + 2] * 0.3 - hang * 2.4);
        clothPositions.setXYZ(i, clothHome[j] + clothNormals.getX(i) * flutter, clothHome[j + 1], clothHome[j + 2] + clothNormals.getZ(i) * flutter);
      }
      clothPositions.needsUpdate = true;
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        const phase = motePhase[i];
        motePositions[j] = moteHome[j] + Math.sin(time * 0.16 + phase) * 0.75;
        motePositions[j + 1] = moteHome[j + 1] + Math.sin(time * 0.22 + phase) * 0.36;
        motePositions[j + 2] = moteHome[j + 2] + Math.cos(time * 0.13 + phase) * 0.55;
      }
      moteGeometry.attributes.position.needsUpdate = true;
    },
  };
  return stage;
}
