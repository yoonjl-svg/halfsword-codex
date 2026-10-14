// A fictional Qin funerary guard, made from the game's native part-bound meshes.
// +X front, +Y up, +Z right. Fired-clay armor relief is decoration, never steel.
export function createTerracottaOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, artoriaRoundedBox } = h;
  const CLAY = 0x929084, LIGHT = 0xa4a094, EDGE = 0x7c7b70;
  const HAIR = 0x73756d, GROOVE = 0x62665f, CORD = 0xa6a193;
  const RED = 0x887269, BLUE = 0x737c7b;
  const matte = { roughness: 1, metalness: 0 };
  const layer = (g, name = 'clay') => artoriaCloth(g, `terracotta-${name}`);

  // Sparse deterministic clay mottling uses vertex colors, without texture
  // requests, noise displacement, or changing the representative wound mesh.
  function claySurface(mesh) {
    if (!mesh?.isMesh || !mesh.material?.isMeshStandardMaterial) return;
    const p = mesh.geometry.attributes.position, colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const v = 0.963 + 0.022 * Math.sin(x * 84 + y * 61 + z * 43)
        + 0.013 * Math.cos(y * 127 - x * 52 + z * 93);
      colors.push(v, v, v);
    }
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    Object.assign(mesh.material, matte, { vertexColors: true });
  }
  function add(g, pieces, color, name = 'clay') {
    const mesh = addMerged(layer(g, name), pieces, color, matte);
    claySurface(mesh); return mesh;
  }
  function line(points, r = 0.0014, sides = 4) {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),
      Math.max(4, (points.length - 1) * 3), r, sides, false);
  }
  function base(g, color, torso = false) {
    const main = g.children[0];
    main.material.color.setHex(color);
    if (torso) {
      for (const child of g.children.slice(1)) child.visible = false;
      const p = main.geometry.parameters;
      const geo = artoriaRoundedBox(p.width, p.height, p.depth, 0.022);
      main.geometry.copy(geo); geo.dispose();
    }
    for (const child of g.children) claySurface(child);
  }
  function plate(x, y, z, width, height, depth = 0.011) {
    // Small flat octagonal tablets, with one bevel. The thickness is visible
    // at the hems while the broad clay face remains quiet under stage light.
    const w = width / 2, hh = height / 2, c = 0.003;
    const shape = new THREE.Shape();
    shape.moveTo(-w + c, -hh); shape.lineTo(w - c, -hh);
    shape.lineTo(w, -hh + c); shape.lineTo(w, hh - c);
    shape.lineTo(w - c, hh); shape.lineTo(-w + c, hh);
    shape.lineTo(-w, hh - c); shape.lineTo(-w, -hh + c); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
      bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 1, steps: 1, curveSegments: 1 });
    geo.rotateY(Math.PI / 2); geo.translate(x - depth / 2, y, z);
    // ExtrudeGeometry is non-indexed; normalize for the merged helper.
    const count = geo.attributes.position.count;
    geo.setIndex(Array.from({ length: count }, (_, i) => i)); return geo;
  }
  function tablets(g, { rows, cols, x, y, stepY = 0.046, stepZ = 0.051, width = 0.046, height = 0.042 }) {
    const pale = [], grey = [], ties = [];
    for (const sign of [-1, 1]) for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const z = (col - (cols - 1) / 2) * stepZ;
      const atY = y - row * stepY, atX = sign * (x + (row % 2) * 0.0015);
      ((row + col) % 4 === 1 ? pale : grey).push(plate(atX, atY, z, width, height));
      const tx = atX + sign * 0.0072;
      // Two incised lacing holes and a raised cross tie in each tablet.
      for (const dz of [-0.011, 0.011]) ties.push(line([
        [tx, atY + 0.012, z + dz], [tx + sign * 0.001, atY + 0.004, z + dz * 0.45],
      ], 0.0014));
    }
    add(g, grey, CLAY, 'tablets'); add(g, pale, LIGHT, 'tablets'); add(g, ties, EDGE, 'lacing');
  }
  function head(g) {
    base(g, LIGHT);
    // The original sphere, nose and normal eye boxes retain all positions,
    // scales and geometry. Sculpted additions never replace eye meshes.
    const cap = g.children[4], segments = 24, rings = 12;
    const geo = new THREE.SphereGeometry(0.107, segments, rings, 0, Math.PI * 2, 0, Math.PI * 0.68);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / (segments + 1)) / rings;
      const theta = t * Math.PI * (0.67 - 0.31 * Math.max(0, Math.cos(a)));
      p.setXYZ(i, 0.107 * Math.sin(theta) * Math.cos(a), 0.107 * Math.cos(theta), 0.107 * Math.sin(theta) * Math.sin(a));
    }
    geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
    cap.position.set(-0.008, 0.005, 0); cap.rotation.set(0, 0, 0); claySurface(cap);
    const ridges = [], relief = [], dark = [], ribbons = [];
    // Swept grooves stay close to the scalp rather than becoming loose hair.
    for (let i = 0; i < 19; i++) {
      const a = i / 18 * Math.PI * 2;
      const pts = [];
      for (let j = 0; j < 6; j++) {
        const theta = 0.29 + j / 5 * (Math.PI * (0.67 - 0.31 * Math.max(0, Math.cos(a))) - 0.31);
        const turn = a + 0.19 * (1 - j / 5);
        pts.push([-0.008 + 0.108 * Math.sin(theta) * Math.cos(turn),
          0.005 + 0.108 * Math.cos(theta), 0.108 * Math.sin(theta) * Math.sin(turn)]);
      }
      ridges.push(line(pts, 0.0012));
    }
    for (const s of [-1, 1]) {
      // Native eyes remain unobscured; brows finish above their upper edges.
      relief.push(line([[0.097, 0.034, s * 0.016], [0.099, 0.039, s * 0.035],
        [0.082, 0.034, s * 0.063]], 0.004, 6));
      relief.push(bake(ball(0.024, 10, 7), [-0.008, -0.024, s * 0.096], null, [0.66, 1.4, 0.45]));
      dark.push(line([[-0.005, -0.007, s * 0.107], [0.004, -0.023, s * 0.107],
        [-0.009, -0.041, s * 0.107]], 0.002, 5));
      relief.push(line([[0.105, -0.035, s * 0.006], [0.105, -0.041, s * 0.025],
        [0.087, -0.052, s * 0.045]], 0.007, 6));
      for (let i = 0; i < 3; i++) dark.push(line([[0.109 - i * 0.001, -0.037 - i * 0.003, s * 0.008],
        [0.103, -0.044 - i * 0.002, s * 0.028], [0.088, -0.05 - i * 0.002, s * 0.043]], 0.0008));
      // Narrow modeled cap ties beside the ear, not a helmet chin guard.
      ribbons.push(line([[-0.021, 0.123, s * 0.05], [0.013, 0.059, s * 0.082],
        [0.032, -0.006, s * 0.087], [0.028, -0.071, s * 0.067]], 0.0034, 5));
    }
    relief.push(bake(ball(0.03, 10, 7), [0.063, -0.087, 0], null, [0.6, 0.67, 0.8]));
    relief.push(bake(new THREE.ConeGeometry(0.020, 0.056, 8), [0.064, -0.118, 0], [0, 0, Math.PI], [0.55, 1, 1]));
    for (let i = -2; i <= 2; i++) dark.push(line([[0.079, -0.078, i * 0.006],
      [0.074, -0.103, i * 0.004], [0.065, -0.136, i * 0.001]], 0.0009));
    // Low rectangular crown base and two folded upright lobes follow the
    // public reference's Qin cap silhouette; all pieces belong to the head.
    add(g, [box(0.104, 0.035, 0.078, [-0.031, 0.117, 0]),
      box(0.088, 0.044, 0.025, [-0.035, 0.15, -0.035], [0.13, 0, 0.12]),
      box(0.090, 0.046, 0.025, [-0.031, 0.154, 0.035], [-0.13, 0, -0.12]),
      cyl(0.032, 0.036, 0.043, 10, false, [-0.037, 0.144, 0])], EDGE, 'cap');
    ribbons.push(line([[-0.083, 0.137, -0.048], [-0.015, 0.153, -0.05], [0.018, 0.167, -0.042]], 0.002));
    add(g, relief, CLAY, 'sculpture'); add(g, ridges, GROOVE, 'hair-grooves');
    add(g, dark, GROOVE, 'face-incisions'); add(g, ribbons, LIGHT, 'cap-ties');
    // A single short irregular forehead crack; the rest of the face is whole.
    add(g, [line([[0.082, 0.057, -0.029], [0.087, 0.05, -0.033],
      [0.09, 0.046, -0.03]], 0.00065)], EDGE, 'age');
  }
  function chest(g) {
    base(g, EDGE, true);
    add(g, [cyl(0.070, 0.083, 0.039, 14, true, [0, 0.153, 0]),
      box(0.009, 0.145, 0.025, [0.121, 0.087, -0.038], [0.5, 0, 0]),
      box(0.009, 0.145, 0.025, [0.123, 0.087, 0.038], [-0.5, 0, 0])], LIGHT, 'collar');
    tablets(g, { rows: 4, cols: 6, x: 0.126, y: 0.059 });
    const straps = [], knots = [];
    for (const s of [-1, 1]) {
      straps.push(box(0.258, 0.017, 0.038, [0, 0.136, s * 0.128]));
      knots.push(line([[0.139, 0.103, s * 0.109], [0.145, 0.116, s * 0.12],
        [0.14, 0.106, s * 0.137], [0.142, 0.10, s * 0.123],
        [0.148, 0.086, s * 0.142]], 0.0032, 5));
    }
    add(g, straps, CLAY, 'straps'); add(g, knots, CORD, 'knots');
    add(g, [box(0.001, 0.011, 0.017, [0.1335, 0.058, -0.072]),
      box(0.001, 0.006, 0.012, [0.1335, 0.01, 0.124])], RED, 'old-pigment');
    add(g, [line([[0.135, -0.047, 0.025], [0.135, -0.055, 0.018],
      [0.135, -0.06, 0.022]], 0.0008)], EDGE, 'age');
  }
  function abdomen(g) {
    base(g, EDGE, true);
    tablets(g, { rows: 2, cols: 6, x: 0.117, y: 0.040, stepY: 0.043, height: 0.039 });
    add(g, [box(0.236, 0.029, 0.332, [0, -0.049, 0])], CLAY, 'belt');
    add(g, [line([[0.126, -0.04, -0.012], [0.137, -0.029, -0.03],
      [0.135, -0.056, -0.03], [0.128, -0.045, 0.014],
      [0.139, -0.063, 0.023]], 0.004, 5)], CORD, 'belt-knot');
  }
  function pelvis(g) {
    base(g, EDGE, true);
    tablets(g, { rows: 3, cols: 6, x: 0.112, y: 0.055, stepY: 0.044, height: 0.041 });
    add(g, [box(0.012, 0.113, 0.034, [0, -0.01, 0.171], [0, Math.PI / 2, 0]),
      box(0.012, 0.113, 0.034, [0, -0.01, -0.171], [0, Math.PI / 2, 0])], CLAY, 'side-lacing');
  }
  function upperArm(g) {
    base(g, CLAY);
    add(g, [cyl(0.061, 0.059, 0.205, 14, true, [0, 0.01, 0]),
      cyl(0.063, 0.064, 0.021, 14, true, [0, -0.083, 0])], LIGHT, 'sleeves');
    const folds = [];
    for (let i = 0; i < 4; i++) folds.push(line([[0.02, 0.095, -0.048 + i * 0.031],
      [0.05, 0.02, -0.038 + i * 0.025], [0.046, -0.072, -0.038 + i * 0.025]], 0.0015));
    add(g, folds, EDGE, 'sleeve-folds');
  }
  function forearm(g) {
    base(g, LIGHT);
    // hand_visual.js reuses this sphere's material for fingers and a palm
    // whose geometry has no color attribute. Keep hands uniform matte clay;
    // enabling vertexColors on the shared material would render them black.
    const hand = g.children[1];
    hand.geometry.deleteAttribute('color');
    hand.material.vertexColors = false;
    add(g, [cyl(0.05, 0.046, 0.15, 12, true, [0, 0.016, 0]),
      cyl(0.049, 0.049, 0.022, 12, true, [0, -0.058, 0])], CLAY, 'cuffs');
  }
  function thigh(g) {
    base(g, LIGHT);
    // Separate short coat skirts stop above each knee and move with that leg.
    add(g, [cyl(0.08, 0.094, 0.235, 14, true, [0, 0.069, 0])], CLAY, 'coat-skirt');
    const seams = [];
    for (const s of [-1, 1]) seams.push(line([[0.055, 0.163, s * 0.064],
      [0.064, 0.075, s * 0.065], [0.069, -0.045, s * 0.064]], 0.002));
    add(g, seams, EDGE, 'coat-seams');
    add(g, [box(0.003, 0.041, 0.011, [0.09, 0.002, 0])], BLUE, 'old-pigment');
  }
  function shin(g) {
    base(g, LIGHT);
    const wraps = [];
    for (let i = 0; i < 6; i++) wraps.push(cyl(0.0535, 0.0545, 0.023, 12, true, [0, -0.12 + i * 0.042, 0]));
    add(g, wraps, CLAY, 'leg-wraps');
    add(g, [line([[0.035, 0.125, 0.043], [0.043, 0.035, 0.034],
      [0.037, -0.13, 0.042]], 0.002)], EDGE, 'wrap-seam');
  }
  function foot(g) {
    base(g, EDGE);
    add(g, [box(0.25, 0.014, 0.116, [0, -0.032, 0]),
      bake(ball(0.044, 10, 6), [0.1, 0.001, 0], null, [0.67, 0.58, 1.2])], CLAY, 'shoes');
    add(g, [line([[0.118, 0.024, -0.045], [0.125, 0.026, 0],
      [0.118, 0.024, 0.045]], 0.002)], LIGHT, 'shoe-seams');
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm, thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin, footF: foot, footB: foot };
}
