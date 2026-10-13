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

function woodTexture() {
  const r = rng(141061);
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ddd1b7'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) {
      const x = r() * w;
      ctx.strokeStyle = i % 4 ? 'rgba(72,59,41,.11)' : 'rgba(255,243,211,.22)';
      ctx.lineWidth = .4 + r() * 1.7; ctx.beginPath(); ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 4, h * .3, x - 3, h * .65, x + (r() - .5) * 5, h); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = r() * w, y = r() * h;
      ctx.strokeStyle = 'rgba(85,67,43,.16)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 3, 7 + r() * 10, 0, 0, Math.PI * 2); ctx.stroke();
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
  if (Math.abs(Math.abs(x) - 10.62) < .1 || Math.abs(x) < .1) {
    for (const y of [.58, 1.48]) {
      K.put('iron', box(.73, .057, .045), C.iron, [0, y, -2.60]);
      for (const dx of [-.27, .27]) K.put('iron', new THREE.SphereGeometry(.025, 6, 4), 0x726959, [dx, y, -2.567]);
    }
    for (let j = 0; j < 9; j++) K.put('trim', box(.28, .13, .095), j % 3 ? C.worn : C.brick,
      [-1.4 + j * .35, 4.83, .063], undefined, 1, { rough: .012, vary: .1 });
    for (const side of [-1, 1]) for (let j = 0; j < 4; j++) K.put('trim', box(.23, .115, .065), C.worn,
      [side * 1.456, .21 + j * .16, .204], [0, 0, side * j * .014], 1, { rough: .016, vary: .13 });
  }
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
    // Quiet brick basket bond inside the existing recessed panels: shallow
    // projecting headers and imperfect edges, with no added tile or writing.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) for (const pair of [-1, 1]) {
      const vertical = (row + col) % 2;
      K.put('trim', box(.37, .155, .055), C.brick,
        [sign * 5.14 + (col - .5) * .47 + (vertical ? pair * .093 : 0), 6.36 + row * .53 + (vertical ? 0 : pair * .093), .138],
        [0, 0, vertical ? Math.PI / 2 : 0], 1, { rough: .006, vary: .065 });
    }
  }
  masonry(K, box(13.12, .24, .55), C.pale, [0, 10.86, -.015]);
  masonry(K, box(12.82, .15, .42), C.worn, [0, 10.39, .07]);
  for (let i = 0; i < 36; i++) K.put('trim', box(.16, .20, .16), C.pale, [-6.04 + i * .345, 10.58, .18], [0, 0, Math.PI / 4], 1, { vary: .14 });
  // Aged plank leaves remain open against the tunnel: iron strap hinges,
  // rounded rivet heads and worn pull rings reveal their thickness up close.
  for (const sign of [-1, 1]) {
    for (let j = 0; j < 8; j++) K.put('wood', box(.13, 3.45, .278), j % 3 ? C.wood : 0x827058,
      [sign * 3.69, 1.77, -4.556 + j * .2875], undefined, 1, { vary: .11, rough: .009 });
    for (const y of [.68, 1.83, 2.91]) {
      K.put('iron', box(.15, .115, 2.09), C.iron, [sign * 3.66, y, -3.57]);
      for (const z of [-4.34, -3.57, -2.80]) K.put('iron', new THREE.SphereGeometry(.037, 7, 4), 0x706858, [sign * 3.566, y, z]);
      K.put('iron', cyl(.064, .064, .23, 7), C.iron, [sign * 3.66, y, -4.64]);
    }
    K.put('iron', box(.04, .23, .15), C.iron, [sign * 3.588, 1.43, -2.78]);
    K.put('iron', new THREE.TorusGeometry(.112, .022, 6, 14), 0x706858, [sign * 3.547, 1.32, -2.78], [0, Math.PI / 2, 0]);
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
    // Sunset enters through the eastern iwan. The courtyard receives cool
    // open-sky fill, with a long warm strip through the gate; geometry stays
    // flat. Architecture lies outside the small character shadow map.
    const east = THREE.MathUtils.smoothstep(p.getX(i), 1, 18);
    const gate = (1 - THREE.MathUtils.smoothstep(Math.abs(p.getZ(i) - .01765 * (18 - p.getX(i))), 3.05, 4.15))
      * THREE.MathUtils.smoothstep(p.getX(i), -16, -8);
    const shade = (.11 + east * .12) * (1 - gate);
    color.setXYZ(i, color.getX(i) * (1 - shade + gate * .17), color.getY(i) * (1 - shade * .87 + gate * .025), color.getZ(i) * (1 - shade * .48 - gate * .10));
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

function nicheLuggage(K) {
  // One modest stopover still life, tucked into an existing shaded lodging
  // bay. The cloth drapes over the load with real folds and a sagging hem.
  K.push([19.03, 0, -10.62], -Math.PI / 2);
  K.put('wood', box(1.8, .11, 1.08), C.wood, [0, .41, -.06]);
  for (const x of [-.68, .68]) for (const z of [-.43, .30]) K.put('wood', box(.10, .37, .11), C.wood, [x, .185, z]);
  K.put('wood', box(1.27, .43, .66), 0x726650, [0, .675, -.06]);
  const clothAt = (u, v) => [u, 1.00 - Math.max(0, Math.abs(u) - .58) * 1.3 - Math.max(0, Math.abs(v) - .28) * 1.36
    + Math.sin(u * 18 + v * 3) * .022 * THREE.MathUtils.smoothstep(Math.abs(v), .20, .59), v - .06];
  const points = [];
  for (let i = 0; i < 16; i++) for (let j = 0; j < 12; j++) {
    const u = -.81 + i * 1.62 / 16, v = -.59 + j * 1.18 / 12;
    const a = clothAt(u, v), b = clothAt(u + 1.62 / 16, v), c = clothAt(u, v + 1.18 / 12), d = clothAt(u + 1.62 / 16, v + 1.18 / 12);
    points.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  K.put('cloth', triangles(points), 0x8f8470, undefined, undefined, 1, { noise: .028, vary: .03 });
  for (const u of [-.45, .42]) for (let j = 0; j < 12; j++) {
    const a = clothAt(u, -.59 + j * 1.18 / 12), b = clothAt(u, -.59 + (j + 1) * 1.18 / 12);
    a[1] += .019; b[1] += .019; limb(K, 'rope', a, b, .016, .016, 0xa4977b, {}, 5);
  }
  // A rolled muted wool blanket rests beside the covered pack.
  K.put('cloth', cyl(.17, .17, .78, 12), 0x6e7467, [1.08, .20, -.18], [0, 0, Math.PI / 2]);
  for (const x of [.83, 1.33]) K.put('rope', new THREE.TorusGeometry(.174, .012, 4, 12), 0xafa085, [x, .20, -.18], [0, Math.PI / 2, 0]);
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
  K.put('wood', cyl(.24, .19, .37, 12, true), 0x897351, [1.54, .195, .76]);
  K.put('shade', cyl(.214, .214, .012, 12), 0x4e4535, [1.54, .33, .76]);
  for (const y of [.10, .32]) K.put('iron', new THREE.TorusGeometry(y < .2 ? .207 : .233, .018, 4, 12), C.iron, [1.54, y, .76], [Math.PI / 2, 0, 0]);
  K.put('iron', new THREE.TorusGeometry(.22, .013, 4, 12, Math.PI), C.iron, [1.54, .36, .76]);
  K.pop();
  // Terracotta water jars at the shaded door, with visibly open dark necks.
  for (const [x, z, s] of [[16.1, -6.7, 1], [18.86, -9.35, .69], [-15.5, 11.2, .9]]) {
    const profile = [[0, 0], [.22, 0], [.37, .24], [.43, .55], [.33, .87], [.18, 1.02], [.18, 1.17], [.22, 1.2]];
    K.put('pot', new THREE.LatheGeometry(profile.map(([a, b]) => new THREE.Vector2(a * s, b * s)), 12), 0xa97c59, [x, 0, z]);
    K.put('shade', cyl(.168 * s, .168 * s, .014, 12), 0x504434, [x, 1.16 * s, z]);
  }
  nicheLuggage(K);
  for (const [x, z, s] of [[13.6, 14.7, 1.3], [-14.7, -12.4, .9], [-16, 14.2, 1.5], [15.8, -11.6, .8], [13.5, -15.6, .75], [-8.8, 16.5, .7]]) shrub(K, x, z, s, 141020 + Math.round(x * 10));
  const r = rng(141030);
  for (let i = 0; i < 45; i++) {
    const side = i % 2 ? -1 : 1, x = (r() - .5) * 32, z = side * (15.3 + r() * 1.3);
    K.put('rubble', new THREE.DodecahedronGeometry(.09 + r() * .12, 0), C.worn, [x, .06, z], [r(), r(), r()], [1.35, .65, .85], { vary: .16 });
  }
  return well;
}

function desert(K, scene) {
  // Saline weathering belongs to the same flat surface: broad, almost
  // imperceptible whitening far off the road, with no pasted islands or mounds.
  const xs = [-340, -180, -80, 0, 24, 50, ...Array.from({ length: 27 }, (_, i) => 60 + i * 5), 240, 340];
  const zs = [-340, -180, -100, ...Array.from({ length: 31 }, (_, i) => -75 + i * 5), 110, 180, 340];
  const groundPoints = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const a = [xs[i], -.08, zs[j]], b = [xs[i + 1], -.08, zs[j]], c = [xs[i], -.08, zs[j + 1]], d = [xs[i + 1], -.08, zs[j + 1]];
    groundPoints.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const ground = K.put('desert', triangles(groundPoints), C.sand, undefined, undefined, 1, { noise: .008 });
  const p = ground.attributes.position, color = ground.attributes.color, pale = new THREE.Color(0xe6d7b8);
  for (let i = 0; i < p.count; i++) {
    let fade = 0;
    for (const [x, z, rx, rz] of [[88, -32, 18, 12], [132, 37, 23, 16], [169, -49, 21, 14]]) {
      const dx = (p.getX(i) - x) / rx, dz = (p.getZ(i) - z) / rz;
      const d = Math.hypot(dx, dz) * (1 + Math.sin(dx * 3 + dz * 2) * .09);
      fade = Math.max(fade, Math.max(0, 1 - d * d) ** 3 * .16);
    }
    color.setXYZ(i, color.getX(i) + (pale.r - color.getX(i)) * fade,
      color.getY(i) + (pale.g - color.getY(i)) * fade, color.getZ(i) + (pale.b - color.getZ(i)) * fade);
  }
  // The horizon is deliberately low and nearly level: a dry salt basin rather
  // than giant sand dunes. Muted broken ridges sit far behind the open iwan.
  for (let band = 0; band < 3; band++) {
    const p = [], count = 32, x = 125 + band * 54;
    for (let i = 0; i < count; i++) {
      const z = -200 + i * 13, next = z + 13;
      const height = q => 1.2 + band * 1.1 + Math.max(0, Math.sin(q * .61 + band) + Math.sin(q * 1.78) * .3) * (2.9 + band);
      p.push(x, -.12, z, x, height(i + 1), next, x, height(i), z, x, -.12, z, x, -.12, next, x, height(i + 1), next);
    }
    K.put('horizon', triangles(p), [0xa58b8e, 0xb79a9d, 0xc8a7a5][band]);
  }
  const map = canvasTex(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#273554'); gradient.addColorStop(.23, '#536386');
    gradient.addColorStop(.36, '#9990b2'); gradient.addColorStop(.425, '#ce98aa');
    gradient.addColorStop(.475, '#f4b095'); gradient.addColorStop(.498, '#ffcb99');
    gradient.addColorStop(.535, '#d6a192'); gradient.addColorStop(1, '#a08280');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    // Longitude matches the sphere's +X opening. Broad amber haze is confined
    // to the setting sun; the opposite sky retains a cooler violet dusk.
    const azimuth = Math.atan2(-6, 340), u = ((Math.PI - azimuth) / (2 * Math.PI));
    for (const x of [u * w - w, u * w, u * w + w]) {
      ctx.save(); ctx.translate(x, h * .492); ctx.scale(1, .28);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * .26);
      glow.addColorStop(0, 'rgba(255,215,151,.70)'); glow.addColorStop(.35, 'rgba(255,167,116,.38)'); glow.addColorStop(1, 'rgba(255,140,109,0)');
      ctx.fillStyle = glow; ctx.fillRect(-w * .26, -w * .26, w * .52, w * .52); ctx.restore();
    }
    // Thin, feathered clouds catch peach light. Overlapping translucent
    // ellipses avoid hard painted stripes across the otherwise open desert sky.
    const cloud = rng(141046);
    for (let i = 0; i < 27; i++) {
      const x = cloud() * w, y = h * (.30 + cloud() * .152), length = 26 + cloud() * 95, height = .8 + cloud() * 2.2;
      for (let j = 5; j >= 0; j--) {
        ctx.fillStyle = j > 1 ? 'rgba(154,117,149,.030)' : 'rgba(255,195,159,.10)';
        ctx.beginPath(); ctx.ellipse(x, y + j * .15, length + j * 6, height + j * .4, -.035, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'dayr-sky'; sky.renderOrder = -10; scene.add(sky);
  // One texture/quad contains the small amber solar disc and its soft halo.
  // Depth testing keeps it behind the real gate and desert ridges; it never
  // overlays fighters or walls. It is static, with no postprocessing bloom.
  const sunMap = canvasTex(512, 512, (ctx, w, h) => {
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    glow.addColorStop(0, 'rgba(255,248,207,1)'); glow.addColorStop(.135, 'rgba(255,235,163,1)');
    glow.addColorStop(.157, 'rgba(255,205,107,1)'); glow.addColorStop(.165, 'rgba(255,175,81,.54)');
    glow.addColorStop(.24, 'rgba(255,156,92,.24)'); glow.addColorStop(.50, 'rgba(255,156,111,.09)');
    glow.addColorStop(1, 'rgba(255,156,111,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  });
  sunMap.wrapS = sunMap.wrapT = THREE.ClampToEdgeWrapping;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(124.8, 124.8), new THREE.MeshBasicMaterial({ map: sunMap, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  disc.name = 'dayr-setting-sun'; disc.position.set(340, 12.5, -6); disc.lookAt(0, 2, 0); scene.add(disc);
}

export function buildDayr(scene, { hemi, sun } = {}) {
  const before = new Set(scene.children);
  // Same azimuth/elevation as the visible disc, scaled into the shared shadow
  // camera's range. Fighter-only fill keeps the backlit opponent readable.
  const sunOffset = { x: 14, y: .515, z: -.25 };
  scene.background = new THREE.Color(0xe6ad96);
  scene.fog = new THREE.Fog(0xe1ad9b, 68, 290);
  if (hemi) { hemi.color.setHex(0xb8bfdf); hemi.groundColor.setHex(0xd0a386); hemi.intensity = 1.55; }
  if (sun) { sun.color.setHex(0xffb878); sun.intensity = 2.6; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  const K = new OwnedKit(141001); desert(K, scene); floor(K); courtyard(K); const well = props(K);
  const brickMap = brickTexture(), pavingMap = pavingTexture(), woodMap = woodTexture();
  const standard = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, ...extra });
  const materials = {
    brick: standard({ map: brickMap }), trim: standard(), floor: standard({ map: pavingMap }),
    wood: standard({ map: woodMap }), iron: standard({ roughness: .83, metalness: .24 }), rope: standard(), cloth: standard({ side: THREE.DoubleSide }),
    leaf: standard({ side: THREE.DoubleSide }), pot: standard({ side: THREE.DoubleSide }),
    rubble: standard(), shade: standard(), desert: standard(),
    horizon: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
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
    fighterLight: { color: 0xffe3cf, rimColor: 0xffd09a, rim: .92, level: .55 },
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
