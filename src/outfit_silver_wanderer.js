// Reference-led preview: native anatomy/eyes, rigid part-local visual layers.
// +X forward, +Y up/proximal, +Z right. No colliders, armor or controller edits.
export function createSilverWandererOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, isoldeLock,
    artoriaCloth, artoriaRoundedBox, sleeveVolume } = h;
  const WHITE = 0xe9e9e5, PURPLE = 0x433653, HEM = 0x776b88;
  const SILVER = 0xb6bbc3, LEATHER = 0x413039, GOLD = 0xa88b45;
  const cloth = { ...CLOTH, metalness: 0, roughness: .87, side: THREE.DoubleSide };
  const steel = { ...CLOTH, metalness: .55, roughness: .4, steel: .7 };
  const hairMat = { ...CLOTH, metalness: .04, roughness: .58 };
  const layer = (g, kind = 'cloth') => artoriaCloth(g, `silver-wanderer-${kind}`);
  function tint(g, color) {
    g.children[0].material.color.setHex(color);
    g.children[0].material.metalness = 0;
    g.children[0].material.roughness = .88;
  }
  function torso(g, color) {
    for (const child of g.children.slice(1)) child.visible = false;
    const { width, height, depth } = g.children[0].geometry.parameters;
    const geo = artoriaRoundedBox(width, height, depth, Math.min(.055, height / 3), .96);
    g.children[0].geometry.copy(geo); geo.dispose(); tint(g, color);
  }
  function line(points, radius = .002) {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),
      Math.max(6, points.length * 4), radius, 5, false);
  }
  // Open elliptical cloth with shallow folds. Rows: y, depth, width, x offset.
  function drape(rows, start = 0, sweep = Math.PI * 2, fold = .015, power = 2) {
    const pos = [], uv = [], idx = [], n = 32;
    for (let j = 0; j < rows.length; j++) for (let k = 0; k <= n; k++) {
      const [y, rx, rz, x = 0] = rows[j], a = start + k / n * sweep;
      const f = 1 + fold * Math.cos(a * 8 + j * .25);
      const c = Math.cos(a), sn = Math.sin(a);
      const r = (Math.abs(c / rx) ** power + Math.abs(sn / rz) ** power) ** (-1 / power);
      pos.push(x + r * c * f, y, r * sn * f); uv.push(k / n, j / (rows.length - 1));
      if (j < rows.length - 1 && k < n) {
        const i = j * (n + 1) + k;
        idx.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  function head(g, look) {
    // Replace only the stock hair cap; the head and its three face meshes stay intact.
    const cap = g.children[4];
    if (cap?.geometry?.type === 'SphereGeometry') {
      const geo = new THREE.SphereGeometry(.108, 24, 12, 0, Math.PI * 2, 0, Math.PI * .68);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / 25) / 12;
        const theta = t * Math.PI * (.68 - .29 * Math.max(0, Math.cos(a)));
        p.setXYZ(i, .108 * Math.sin(theta) * Math.cos(a), .108 * Math.cos(theta), .108 * Math.sin(theta) * Math.sin(a));
      }
      geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
      cap.position.set(-.009, .005, 0); cap.rotation.set(0, 0, 0);
    }
    const locks = [], lights = [];
    // A swept, off-center part; open forehead and long temple strands.
    for (const s of [-1, 1]) {
      locks.push(isoldeLock([[.025, .113, -.024], [.062, .098, s * .047],
        [.064, .061, s * .088], [.021, .018, s * .107]], [.052, .063, .045, .012], .01));
      locks.push(isoldeLock([[.031, .076, s * .084], [.069, .005, s * .102],
        [.052, -.091, s * .118], [.10, -.19, s * .117]], [.029, .034, .027, .003], .009));
      lights.push(isoldeLock([[.025, .115, -.024], [.061, .102, s * .042],
        [.07, .068, s * .075]], [.008, .009, .002], .006));
    }
    for (let i = -2; i <= 2; i++) locks.push(isoldeLock([
      [-.081, .074, i * .034], [-.114, -.012, i * .041],
      [-.141, -.15, i * .047], [-.163, -.34 + Math.abs(i) * .019, i * .056]], [.047, .058, .065, .003], .011));
    addMerged(layer(g, 'hair'), locks, look.hair, hairMat);
    addMerged(layer(g, 'hair'), lights, 0xb6b3bc, hairMat);
  }
  function backHair(g) {
    // One continuous chest-attached curtain, like the existing long capes.
    // Tapered head locks overlap it; no rectangular seams at spine joints.
    const dark = [], light = [];
    for (let i = -3; i <= 3; i++) {
      const z = i * .04;
      const points = [[-.128, .257 - Math.abs(i) * .019, z * .66], [-.163, .15, z],
        [-.171, -.07, z * 1.14], [-.19, -.33, z * 1.21],
        [-.23, -.61, z * 1.17], [-.269, -.83 + Math.abs(i) * .038, z * 1.04]];
      (i % 3 === 0 ? light : dark).push(isoldeLock(points, [.003, .058, .061, .06, .044, .002], .009));
    }
    addMerged(layer(g, 'hair'), dark, 0x85808b, hairMat);
    addMerged(layer(g, 'hair'), light, 0x98939d, hairMat);
  }
  function chest(g, look) {
    torso(g, WHITE); const l = layer(g);
    // High open standing collar and short shoulder mantle; neither is heavy armor.
    addMerged(l, [drape([[.254, .072, .082], [.19, .079, .092], [.16, .127, .188],
      [.119, .14, .208], [.037, .14, .211]], .58, Math.PI * 2 - 1.16, .008, 4)], PURPLE, cloth);
    const edges = [];
    for (const s of [-1, 1]) {
      edges.push(line([[.06, .253, s * .045], [.066, .19, s * .05], [.098, .145, s * .106], [.109, .08, s * .116], [.111, .037, s * .117]], .0028));
      // Small restrained silver scrolls on the collar, no texture dependency.
      edges.push(line([[.074, .197, s * .06], [.077, .211, s * .056], [.077, .223, s * .064],
        [.077, .23, s * .051], [.069, .24, s * .05]], .0016));
    }
    addMerged(l, edges, SILVER, steel);
    addMerged(l, [line([[.116, .132, -.004], [.118, .027, .006], [.118, -.139, -.002]], .002)], 0xbbbfc4, cloth);
    addMerged(l, [line([[.117, .074, -.093], [.123, .039, -.046], [.12, .012, -.018]], .002),
      line([[.117, -.088, .11], [.124, -.106, .057], [.118, -.119, .027]], .002)], 0xd0d1d0, cloth);
    if (look?.hairStyle !== 'swept_long_front') backHair(g);
  }
  function abdomen(g) {
    torso(g, WHITE); const l = layer(g);
    addMerged(l, [bake(artoriaRoundedBox(.236, .07, .338, .015), [0, -.053, 0])], LEATHER, cloth);
    addMerged(l, [box(.01, .051, .007, [.126, -.05, -.035]), box(.01, .051, .007, [.126, -.05, .005]),
      box(.01, .007, .047, [.126, -.076, -.015]), box(.01, .007, .047, [.126, -.026, -.015]),
      line([[.135, -.05, -.032], [.135, -.05, .006]], .002)], 0x79737d, steel);
    addMerged(l, [-.095, .085, .125].map(z => ball(.0038, 8, 6, [.122, -.047, z])), SILVER, steel);
  }
  function pelvis(g) {
    torso(g, PURPLE); const l = layer(g);
    addMerged(l, [drape([[.107, .109, .16], [-.011, .124, .186], [-.149, .142, .211]], .44, Math.PI * 2 - .88, .024)], 0x5a4c68, cloth);
    addMerged(l, [line([[.124, .086, -.164], [.137, .046, -.06], [.139, -.015, .04], [.117, -.07, .164]], .013)], LEATHER, cloth);
    // Empty scabbard beside the left leg; decorative and independently colored.
    const scabbard = bake(cyl(.025, .02, .66, 10, false), [-.018, -.22, -.24], [0, 0, -.23]);
    addMerged(l, [scabbard], 0x655047, cloth);
    addMerged(l, [bake(cyl(.027, .027, .019, 10, false), [.057, .101, -.24], [0, 0, -.23]),
      bake(cyl(.021, .014, .04, 10, false), [-.088, -.527, -.24], [0, 0, -.23])], GOLD, steel);
  }
  function upperArm(g) {
    tint(g, WHITE); sleeveVolume(g, 1.04, 1.16);
    const l = layer(g);
    addMerged(l, [bake(ball(.072, 20, 12, null, null, [0, Math.PI * 2, 0, Math.PI * .59]), [0, .098, 0], null, [1, 1.02, 1.04]),
      cyl(.073, .07, .016, 20, true, [0, .074, 0])], PURPLE, cloth);
    addMerged(l, [cyl(.071, .07, .004, 20, true, [0, .064, 0])], HEM, cloth);
  }
  function forearm(g) {
    tint(g, WHITE); sleeveVolume(g, 1.28, 1.05); const l = layer(g);
    addMerged(l, [cyl(.059, .049, .058, 20, true, [0, -.068, 0])], PURPLE, cloth);
    addMerged(l, [cyl(.06, .058, .012, 20, true, [0, -.045, 0]),
      cyl(.053, .05, .012, 20, true, [0, -.082, 0]), cyl(.049, .047, .009, 20, true, [0, -.1, 0])], SILVER, steel);
  }
  function skirt(g, side, lower) {
    tint(g, WHITE); const l = layer(g);
    // Each half follows its own leg; an open front keeps white trousers readable.
    const start = side === 1 ? .14 : Math.PI;
    const rows = lower ? [[.29, .118, .115, -.034], [.14, .127, .125, -.038], [-.09, .145, .142, -.04], [-.175, .13, .136, -.037]]
      : [[.264, .135, .13, -.019], [.11, .142, .137, -.022], [-.12, .137, .137, -.03], [-.265, .134, .136, -.033]];
    addMerged(l, [drape(rows, start, Math.PI - .14, .034)], 0x665976, cloth);
    if (lower) {
      addMerged(l, [drape([[-.166, .131, .137, -.037], [-.177, .131, .137, -.037]], start, Math.PI - .14, .034)], HEM, cloth);
      addMerged(l, [drape([[.12, .058, .058], [.043, .063, .06], [-.13, .049, .049], [-.2, .053, .052]], -.92, 1.84, .006)], SILVER, steel);
      addMerged(l, [line([[.058, .12, 0], [.066, .034, 0], [.052, -.13, 0], [.056, -.2, 0]], .0023)], 0xd9dce1, steel);
    }
  }
  function foot(g) {
    tint(g, 0x9b9fa8);
    addMerged(layer(g), [-.025, .007, .039].map(x => box(.021, .005, .105, [x, .041, 0], [0, 0, -.05])), SILVER, steel);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm, farmS: forearm, farmO: forearm,
    thighF: g => skirt(g, 1, false), thighB: g => skirt(g, -1, false),
    shinF: g => skirt(g, 1, true), shinB: g => skirt(g, -1, true), footF: foot, footB: foot };
}
