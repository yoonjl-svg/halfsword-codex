// 소금길의 마지막 역참 — a fictional courtyard inspired by Dayr-e Gachin,
// Iran. Brick iwans, barrel-vaulted cells and low roof domes, not a mosque.
// Scenery only: the complete duel surface stays at y=0 and the 10.5 m camera
// orbit stays clear. Source geometries/bins are released after baking; final
// scene resources are owned by Stages.clear(). No physics or external assets.
import * as THREE from 'three';
import { Kit, rng, box, cyl, limb, canvasTex } from './stage_kit.js';

const C = {
  brick: 0xc7a77d, pale: 0xddbf93, worn: 0xab8965, shade: 0x756750,
  recess: 0x655b4f, sand: 0xdbc9a5, wood: 0x70604b, iron: 0x4e4941,
  leaf: 0x72775a, straw: 0x9c9169,
};

class OwnedKit extends Kit {
  putM(bin, geometry, color, matrix, options = {}) {
    try { return super.putM(bin, geometry, color, matrix, options); }
    finally { geometry.dispose(); }
  }
}

function triangles(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}

function brickTexture() {
  const r = rng(141007);
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#918674'; ctx.fillRect(0, 0, w, h);
    const bw = w / 6, bh = h / 16;
    for (let row = 0; row < 16; row++) for (let col = -1; col < 7; col++) {
      const x = (col + (row % 2) * .5) * bw, y = row * bh;
      const light = 76 + r() * 13;
      ctx.fillStyle = `hsl(39 18% ${light}%)`;
      ctx.fillRect(x + 1.3, y + 1.8, bw - 2.6, bh - 3.5);
      ctx.fillStyle = 'rgba(255,248,218,.19)'; ctx.fillRect(x + 2, y + 2, bw - 4, 1.5);
      ctx.fillStyle = 'rgba(84,70,48,.14)'; ctx.fillRect(x + 2, y + bh - 4, bw - 4, 1.6);
      for (let j = 0; j < 15; j++) {
        ctx.fillStyle = j % 3 ? 'rgba(75,67,52,.07)' : 'rgba(255,246,220,.20)';
        ctx.fillRect(x + r() * bw, y + 3 + r() * (bh - 6), 1 + r() * 8, 1 + r() * 2);
      }
    }
    for (let i = 0; i < 42; i++) {
      const x = r() * w, y = r() * h, rad = 5 + r() * 24;
      const stain = ctx.createRadialGradient(x, y, 0, x, y, rad);
      stain.addColorStop(0, 'rgba(248,238,210,.14)'); stain.addColorStop(1, 'rgba(248,238,210,0)');
      ctx.fillStyle = stain; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

function pavingTexture() {
  const r = rng(141008);
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#a49476'; ctx.fillRect(0, 0, w, h);
    // A periodic two-to-one brick herringbone bond, with chipped joins and
    // powdery salt wear. The repeat is 5.76 m, so individual bricks are .36 m.
    const unit = w / 32;
    for (let y = -4; y < 36; y++) for (let x = -4; x < 36; x++) {
      if (((x + y) % 4 + 4) % 4 !== 0) continue;
      for (const [px, py, bw, bh] of [[x, y, 2, 1], [x + 2, y, 1, 2]]) {
        const shade = 57 + r() * 17;
        ctx.fillStyle = `hsl(${34 + r() * 6} ${20 + r() * 11}% ${shade}%)`;
        ctx.fillRect(px * unit + 1.1, py * unit + 1.2, bw * unit - 2.2, bh * unit - 2.4);
        ctx.fillStyle = 'rgba(251,234,196,.24)';
        ctx.fillRect(px * unit + 2, py * unit + 2, bw * unit - 4, 1.5);
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = j % 2 ? 'rgba(70,55,32,.15)' : 'rgba(255,242,211,.23)';
          ctx.fillRect((px + r() * bw) * unit, (py + r() * bh) * unit, 1 + r() * 7, 1 + r() * 2);
        }
      }
    }
    for (let i = 0; i < 95; i++) {
      const x = r() * w, y = r() * h, radius = 14 + r() * 93;
      const wear = ctx.createRadialGradient(x, y, 0, x, y, radius);
      wear.addColorStop(0, i % 4 ? 'rgba(230,211,172,.20)' : 'rgba(93,78,53,.10)');
      wear.addColorStop(1, 'rgba(220,203,167,0)');
      ctx.fillStyle = wear; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
}

// Two-centred pointed arch: the two circles meet at a cusp, and meet their
// vertical jambs tangentially. These are actual open vaults, not dark decals.
function archPoint(width, spring, rise, t) {
  const half = width / 2, c = (rise * rise - half * half) / (2 * half), radius = half + c;
  const side = t < .5 ? -1 : 1, u = t < .5 ? t * 2 : (1 - t) * 2;
  return [side * (Math.sqrt(Math.max(0, radius * radius - rise * rise * u * u)) - c), spring + rise * u];
}

function archPanel(width, spring, rise, span, top, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0); shape.lineTo(-width / 2, 0);
  for (let i = 0; i <= 40; i++) shape.lineTo(...archPoint(width, spring, rise, i / 40));
  shape.lineTo(width / 2, 0); shape.lineTo(span / 2, 0);
  shape.lineTo(span / 2, top); shape.lineTo(-span / 2, top); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -depth); return g;
}

function voussoirs(K, width, spring, rise, thickness, z, depth, color, count = 36) {
  for (let i = 0; i < count; i++) {
    const t0 = (i + .055) / count, t1 = (i + .945) / count;
    const p = [archPoint(width, spring, rise, t0), archPoint(width, spring, rise, t1),
      archPoint(width + thickness * 2, spring, rise + thickness, t1), archPoint(width + thickness * 2, spring, rise + thickness, t0)];
    const s = new THREE.Shape(); s.moveTo(...p[0]); for (const q of p.slice(1)) s.lineTo(...q); s.closePath();
    K.put('trim', new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }), color, [0, 0, z], undefined, 1, { vary: .2, noise: .055 });
  }
}

const brickOpt = { uv: 'box', uvScale: .42, vary: .08, noise: .035 };
function masonry(K, geometry, color = C.brick, position, rotation) {
  return K.put('brick', geometry, color, position, rotation, 1, brickOpt);
}

function vaultedCell(K, x, width = 4.15) {
  K.push([x, 0, 0]);
  masonry(K, archPanel(2.65, 2.15, 1.95, width, 5.9, 2.8));
  // The rear of each shaded lodging bay includes a narrow wooden room door.
  masonry(K, box(3.25, 4.85, .2), C.recess, [0, 2.43, -2.84]);
  K.put('wood', box(.91, 1.85, .08), 0x645d50, [0, 1.05, -2.71]);
  for (const dx of [-.31, -.1, .11, .32]) K.put('wood', box(.018, 1.79, .025), 0x403d34, [dx, 1.06, -2.65]);
  K.put('iron', box(.71, .055, .035), C.iron, [0, 1.48, -2.61]);
  K.put('iron', new THREE.TorusGeometry(.065, .014, 4, 8), C.iron, [.24, 1.06, -2.6]);
  voussoirs(K, 2.66, 2.15, 1.95, .25, .025, .17, C.pale, 24);
  for (const sign of [-1, 1]) {
    masonry(K, box(.23, 2.16, .18), C.pale, [sign * 1.455, 1.08, .10]);
    masonry(K, box(.49, .31, 3.05), C.pale, [sign * 1.87, .15, -1.31]);
  }
  masonry(K, box(width + .03, .18, .36), C.worn, [0, 5.17, .095]);
  masonry(K, box(width + .07, .2, .46), C.pale, [0, 5.91, -.03]);
  masonry(K, box(width, .21, 3.18), C.worn, [0, 5.63, -1.38]);
  K.put('shade', box(2.55, .013, 2.85), 0x857251, [0, .014, -1.35]);
  // Small baked-brick service domes are lower than the iwan; no finials.
  masonry(K, new THREE.SphereGeometry(1.51, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2), C.worn, [0, 5.67, -1.7]);
  K.pop();
}

function iwan(K, position, rotation, scale = 1) {
  K.push(position, rotation, scale);
  masonry(K, archPanel(7.7, 3.9, 5.2, 12.6, 10.9, 4.8));
  // Three recessed brick courses reveal the full depth of the vaulted gateway.
  voussoirs(K, 7.73, 3.9, 5.2, .37, .01, .27, C.pale, 48);
  voussoirs(K, 8.53, 3.9, 5.61, .23, -.04, .24, C.worn, 50);
  for (const z of [-1.65, -3.35, -4.73]) voussoirs(K, 7.6, 3.9, 5.13, .21, z, .22, z < -3 ? C.worn : C.shade, 44);
  for (const sign of [-1, 1]) {
    masonry(K, box(.37, 3.9, .31), C.pale, [sign * 4.03, 1.95, .11]);
    masonry(K, box(.22, 10.6, .23), C.worn, [sign * 6.02, 5.3, .12]);
    masonry(K, box(.42, 10.77, .3), C.pale, [sign * 6.38, 5.39, .05]);
    masonry(K, box(1.93, .46, .76), C.worn, [sign * 5.3, .23, .09]);
    // Shallow blank recessed brick panels, a caravanserai's sober facade.
    masonry(K, box(1.30, 2.1, .055), C.worn, [sign * 5.14, 6.89, .04]);
    masonry(K, box(1.03, 1.86, .073), C.brick, [sign * 5.14, 6.89, .085]);
  }
  masonry(K, box(13.12, .24, .55), C.pale, [0, 10.86, -.015]);
  masonry(K, box(12.82, .15, .42), C.worn, [0, 10.39, .07]);
  for (let i = 0; i < 36; i++) K.put('trim', box(.16, .20, .16), C.pale, [-6.04 + i * .345, 10.58, .18], [0, 0, Math.PI / 4], 1, { vary: .14 });
  // Simple open doors stand against the tunnel walls, leaving the desert view.
  for (const sign of [-1, 1]) {
    K.put('wood', box(.11, 3.45, 2.3), C.wood, [sign * 3.69, 1.77, -3.55]);
    for (const y of [.68, 1.83, 2.91]) K.put('iron', box(.14, .13, 2.15), C.iron, [sign * 3.66, y, -3.55]);
  }
  K.put('shade', box(7.55, .014, 4.8), 0x776b53, [0, .015, -2.4]);
  K.pop();
}

function tower(K, x, z) {
  masonry(K, cyl(2.10, 2.45, 6.0, 16), C.brick, [x, 3, z]);
  masonry(K, cyl(2.2, 2.17, .30, 16), C.pale, [x, 6.01, z]);
  masonry(K, new THREE.SphereGeometry(2.04, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.worn, [x, 6.07, z]);
  for (let j = 0; j < 10; j++) {
    const a = j / 10 * Math.PI * 2;
    K.put('shade', box(.15, .57, .055), C.recess, [x + Math.cos(a) * 2.15, 4.6, z + Math.sin(a) * 2.15], [0, -a + Math.PI / 2, 0]);
  }
}

function courtyard(K) {
  // The principal opening sits directly in the first shoulder-camera view.
  iwan(K, [18, 0, 0], -Math.PI / 2);
  for (const x of [-17.95, 18]) {
    K.push([x, 0, 0], x > 0 ? -Math.PI / 2 : Math.PI / 2);
    if (x < 0) {
      masonry(K, archPanel(4.2, 2.7, 3.3, 6.7, 7.3, 3.2), C.brick);
      voussoirs(K, 4.22, 2.7, 3.3, .3, .01, .19, C.pale, 32);
      masonry(K, box(4.21, 5.91, .18), C.recess, [0, 2.96, -3.25]);
      masonry(K, box(6.91, .23, .43), C.pale, [0, 7.28, 0]);
      for (const side of [-1, 1]) vaultedCell(K, side * 4.95, 3.15);
    }
    for (const offset of [-14.78, -10.62, 10.62, 14.78]) vaultedCell(K, offset);
    // Complete the narrow wall strips between the central iwan and cells.
    for (const sign of [-1, 1]) masonry(K, box(2.05, 5.9, 2.8), C.brick, [sign * 7.45, 2.95, -1.4]);
    K.pop();
  }
  for (const z of [-18, 18]) {
    K.push([0, 0, z], z < 0 ? 0 : Math.PI);
    for (let j = -3; j <= 3; j++) vaultedCell(K, j * 4.16);
    for (const sign of [-1, 1]) masonry(K, box(3.24, 5.9, 2.8), C.brick, [sign * 16.18, 2.95, -1.4]);
    K.pop();
  }
  for (const x of [-19, 19]) for (const z of [-19, 19]) tower(K, x, z);
}

function floor(K) {
  const g = new THREE.PlaneGeometry(43, 43, 80, 80); g.rotateX(-Math.PI / 2);
  const paved = K.put('floor', g, 0xffffff, undefined, undefined, 1, { uv: 'box', uvScale: 1 / 5.76, vary: 0, noise: .012 });
  const p = paved.attributes.position, color = paved.attributes.color;
  for (let i = 0; i < p.count; i++) {
    // Architecture lies beyond the character shadow map. This fixed, soft
    // afternoon shade grounds the west/south walls without changing lighting.
    const west = 1 - THREE.MathUtils.smoothstep(p.getX(i), -18, -12.5);
    const south = 1 - THREE.MathUtils.smoothstep(p.getZ(i), -18, -13.2);
    const shade = 1 - Math.max(west, south) * .25;
    color.setXYZ(i, color.getX(i) * shade, color.getY(i) * shade, color.getZ(i) * shade);
  }
  // Worn perimeter flags stand well outside the duel/camera clear area.
  for (const sign of [-1, 1]) for (let j = -14; j <= 14; j += 1.1) {
    masonry(K, box(1.03, .12, .67), C.worn, [j, .04, sign * 17.04]);
    if (Math.abs(j) > 4.4) masonry(K, box(.67, .12, 1.03), C.worn, [sign * 17.04, .04, j]);
  }
}

function shrub(K, x, z, scale, seed) {
  const r = rng(seed); K.push([x, 0, z], r() * Math.PI * 2, scale);
  for (let j = 0; j < 8; j++) {
    const a = j * 2.4, end = [Math.cos(a) * (.35 + r() * .32), .35 + r() * .6, Math.sin(a) * (.35 + r() * .32)];
    limb(K, 'wood', [0, .04, 0], end, .024, .008, C.wood, {}, 5);
    for (let k = 0; k < 4; k++) {
      const y = end[1] * (.45 + k * .14), x = end[0] * (.45 + k * .14), z = end[2] * (.45 + k * .14);
      K.put('leaf', triangles([x, y, z, x + .15, y + .065, z + .08, x + .02, y + .105, z + .026,
        x, y, z, x - .11, y + .12, z - .09, x - .03, y + .015, z - .025]), j % 3 ? C.leaf : C.straw);
    }
  }
  K.pop();
}

function props(K) {
  const well = [10.7, 0, -12.1]; K.push(well, -.18);
  for (let level = 0; level < 4; level++) for (let j = 0; j < 16; j++) {
    const angle = (j + level % 2 * .5) / 16 * Math.PI * 2;
    masonry(K, box(.37, .22, .34), level === 3 ? C.pale : C.worn, [Math.cos(angle) * .9, .11 + level * .22, Math.sin(angle) * .9], [0, -angle, 0]);
  }
  K.put('shade', cyl(.73, .73, .015, 20), 0x393a35, [0, .13, 0]);
  for (const sign of [-1, 1]) limb(K, 'wood', [sign * 1.24, 0, 0], [sign * 1.12, 2.97, 0], .11, .08, C.wood, {}, 8);
  limb(K, 'wood', [-1.36, 2.92, 0], [1.37, 2.92, 0], .105, .085, C.wood, {}, 8);
  for (const sign of [-1, 1]) limb(K, 'wood', [sign * 1.13, 2.14, 0], [sign * .39, 2.94, 0], .045, .045, C.wood, {}, 6);
  K.put('iron', new THREE.TorusGeometry(.22, .035, 6, 18), C.iron, [0, 2.74, 0]);
  for (let i = 0; i < 4; i++) K.put('rope', new THREE.TorusGeometry(.35 + i * .035, .018, 5, 22), 0xa39473, [-1.12, .036 + i * .024, .91], [Math.PI / 2, .04, 0]);
  K.pop();
  // Terracotta water jars at the shaded door, with visibly open dark necks.
  for (const [x, z, s] of [[16.1, -6.7, 1], [15.4, -7.05, .69], [-15.5, 11.2, .9]]) {
    const profile = [[0, 0], [.22, 0], [.37, .24], [.43, .55], [.33, .87], [.18, 1.02], [.18, 1.17], [.22, 1.2]];
    K.put('pot', new THREE.LatheGeometry(profile.map(([a, b]) => new THREE.Vector2(a * s, b * s)), 12), 0xa97c59, [x, 0, z]);
    K.put('shade', cyl(.168 * s, .168 * s, .014, 12), 0x504434, [x, 1.16 * s, z]);
  }
  for (const [x, z, s] of [[13.6, 14.7, 1.3], [-14.7, -12.4, .9], [-16, 14.2, 1.5], [15.8, -11.6, .8], [13.5, -15.6, .75], [-8.8, 16.5, .7]]) shrub(K, x, z, s, 141020 + Math.round(x * 10));
  const r = rng(141030);
  for (let i = 0; i < 45; i++) {
    const side = i % 2 ? -1 : 1, x = (r() - .5) * 32, z = side * (15.3 + r() * 1.3);
    K.put('rubble', new THREE.DodecahedronGeometry(.09 + r() * .12, 0), C.worn, [x, .06, z], [r(), r(), r()], [1.35, .65, .85], { vary: .16 });
  }
  return well;
}

function desert(K, scene) {
  K.put('desert', new THREE.PlaneGeometry(680, 680).rotateX(-Math.PI / 2), C.sand, [0, -.08, 0], undefined, 1, { noise: .025 });
  const r = rng(141032);
  // The horizon is deliberately low and nearly level: a dry salt basin rather
  // than giant sand dunes. Muted broken ridges sit far behind the open iwan.
  for (let band = 0; band < 3; band++) {
    const p = [], count = 32, x = 125 + band * 54;
    for (let i = 0; i < count; i++) {
      const z = -200 + i * 13, next = z + 13;
      const height = q => 1.2 + band * 1.1 + Math.max(0, Math.sin(q * .61 + band) + Math.sin(q * 1.78) * .3) * (2.9 + band);
      p.push(x, -.12, z, x, height(i + 1), next, x, height(i), z, x, -.12, z, x, -.12, next, x, height(i + 1), next);
    }
    K.put('horizon', triangles(p), [0xb7aa94, 0xc0b6a3, 0xcac3b3][band]);
  }
  for (let j = 0; j < 38; j++) {
    const x = 25 + r() * 140, z = (r() - .5) * 190, width = 4 + r() * 15;
    K.put('salt', triangles([x, -.067, z, x + width, -.067, z + .4, x + width * .8, -.067, z - .4,
      x, -.067, z, x + width * .8, -.067, z - .4, x - 2, -.067, z - .9]), j % 3 ? 0xe1d6bc : 0xcebb98);
  }
  const map = canvasTex(512, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#527f99'); gradient.addColorStop(.36, '#9bb7bf');
    gradient.addColorStop(.49, '#e0d9be'); gradient.addColorStop(.54, '#e8d6b2');
    gradient.addColorStop(1, '#c8b99c'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(242,233,205,.055)'; ctx.fillRect(0, 96 + i * 4, w, 1.5);
    }
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'dayr-sky'; sky.renderOrder = -10; scene.add(sky);
}

export function buildDayr(scene, { hemi, sun } = {}) {
  const before = new Set(scene.children);
  const sunOffset = { x: -8, y: 10, z: -6 };
  scene.background = new THREE.Color(0xded1b6);
  scene.fog = new THREE.Fog(0xdcd0b6, 68, 290);
  if (hemi) { hemi.color.setHex(0xc3d5db); hemi.groundColor.setHex(0xa89a7b); hemi.intensity = 1.35; }
  if (sun) { sun.color.setHex(0xffdea9); sun.intensity = 2.05; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  const K = new OwnedKit(141001); desert(K, scene); floor(K); courtyard(K); const well = props(K);
  const brickMap = brickTexture(), pavingMap = pavingTexture();
  const standard = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, ...extra });
  const materials = {
    brick: standard({ map: brickMap }), trim: standard(), floor: standard({ map: pavingMap }),
    wood: standard(), iron: standard({ roughness: .83, metalness: .24 }), rope: standard(),
    leaf: standard({ side: THREE.DoubleSide }), pot: standard({ side: THREE.DoubleSide }),
    rubble: standard(), shade: standard(), desert: standard(),
    horizon: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), salt: standard({ side: THREE.DoubleSide }),
  };
  for (const [bin, mat] of Object.entries(materials)) {
    const mesh = K.mesh(bin, mat, { cast: ['brick', 'trim', 'wood', 'pot'].includes(bin), receive: true });
    if (mesh) {
      mesh.name = `dayr-${bin}`; scene.add(mesh);
    } else mat.dispose();
    for (const geometry of K.bins[bin] ?? []) geometry.dispose();
  }
  // A small rope and iron ring move together at the well. Their cue is emitted
  // at the turn of the same slow swing; the shared sound layer handles gain.
  const swing = new THREE.Group(); swing.name = 'dayr-well-rope';
  swing.position.set(well[0], 2.62, well[2]); swing.rotation.y = -.18;
  const rope = new THREE.Mesh(cyl(.018, .018, 1.51, 6), materials.rope);
  rope.geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array(rope.geometry.attributes.position.count).fill([.43, .34, .22]).flat(), 3));
  rope.position.y = -.755;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.105, .025, 6, 16), materials.iron);
  ring.geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array(ring.geometry.attributes.position.count).fill([.13, .12, .10]).flat(), 3));
  ring.position.y = -1.6; swing.add(rope, ring); scene.add(swing);
  let trianglesCount = 0, meshesCount = 0;
  for (const object of scene.children) if (!before.has(object)) object.traverse(child => {
    if (!child.isMesh) return;
    meshesCount++;
    trianglesCount += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
  });
  const ringPosition = new THREE.Vector3(), swingPeriod = Math.PI * 2 / .19;
  let time = 0, nextRing = 11;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xffe5c5, rimColor: 0xc9dce1, rim: .8, level: .43 },
    stats: { triangles: trianglesCount, meshes: meshesCount, clearRadius: 10.5, proceduralTextureMax: 1024 },
    excite() {},
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, .1);
      swing.rotation.z = Math.cos((time - 11) * .19) * .032;
      if (time >= nextRing) {
        ring.getWorldPosition(ringPosition);
        stage.onEvent?.('stageDetail', { kind: 'caravanRing', amp: .75, pos: { x: ringPosition.x, y: ringPosition.y, z: ringPosition.z }, seed: 141001, time });
        nextRing += swingPeriod;
      }
    },
  };
  return stage;
}
