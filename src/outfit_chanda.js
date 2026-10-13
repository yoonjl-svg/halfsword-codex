// Chanda, a fictional Khmer-inspired watergate keeper. Costume only: every
// section follows a native ragdoll part, with the stock face/body dimensions.
export function createChandaOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth, artoriaRoundedBox } = h;
  const INDIGO = 0x252c4b, SEAM = 0x414967, TROUSERS = 0x353d50;
  const OCHRE = 0xb49354, OCHRE_EDGE = 0x866d3f, WRAP = 0xb0a58a;
  const ROPE = 0x978360, LEATHER = 0x43372d, BRASS = 0x93805a;
  const fabric = (g) => artoriaCloth(g, 'chanda-fabric');
  const hair = (g) => artoriaCloth(g, 'chanda-hair');
  const twoSided = { ...CLOTH, side: THREE.DoubleSide };
  const bronze = { roughness: 0.75, metalness: 0.32 };
  function tint(g, color) {
    const m = g.children[0].material;
    m.color.setHex(color); m.roughness = 0.96; m.metalness = 0;
  }
  function torso(g, color, radius) {
    // Retain the representative mesh and its geometry identity for wounds.
    // Only the default quilting, collar and skirt are hidden.
    for (const child of g.children.slice(1)) child.visible = false;
    const { width, height, depth } = g.children[0].geometry.parameters;
    const geo = artoriaRoundedBox(width, height, depth, radius);
    g.children[0].geometry.copy(geo); geo.dispose(); tint(g, color);
  }
  // Broad locks use a transported cross-section, so the compact bun can turn
  // around its crown without becoming a spiky cone or a single smooth sphere.
  function lock(points, widths, thickness = 0.009) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const steps = 14, sides = 6, frames = curve.computeFrenetFrames(steps, false);
    const positions = [], uv = [], indices = [];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, at = curve.getPointAt(t), u = t * (widths.length - 1);
      const n = Math.min(widths.length - 2, Math.floor(u));
      const width = THREE.MathUtils.lerp(widths[n], widths[n + 1], u - n);
      for (let k = 0; k < sides; k++) {
        const a = k / sides * Math.PI * 2;
        const p = at.clone().addScaledVector(frames.normals[j], Math.cos(a) * thickness)
          .addScaledVector(frames.binormals[j], Math.sin(a) * width / 2);
        positions.push(...p.toArray()); uv.push(k / sides, t);
        if (j < steps) {
          const i = j * sides + k, next = j * sides + (k + 1) % sides;
          indices.push(i, next, i + sides, next, next + sides, i + sides);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  // Rows [x,y,z,width] form a narrow folded shawl on just the left shoulder.
  // Both surfaces and sewn edges provide 3 mm thickness without a solid shell.
  function clothStrip(rows) {
    const positions = [], uv = [], indices = [], cols = 8;
    const curve = new THREE.CatmullRomCurve3(rows.map(r => new THREE.Vector3(...r.slice(0, 3))));
    const steps = (rows.length - 1) * 4, count = (steps + 1) * (cols + 1);
    for (const side of [-1, 1]) for (let j = 0; j <= steps; j++) {
      const t = j / steps, at = curve.getPoint(t), u = t * (rows.length - 1);
      const n = Math.min(rows.length - 2, Math.floor(u));
      const width = THREE.MathUtils.lerp(rows[n][3], rows[n + 1][3], u - n);
      for (let k = 0; k <= cols; k++) {
        const v = k / cols;
        positions.push(at.x + 0.003 * Math.sin(v * Math.PI * 4) + side * 0.0015,
          at.y + 0.003 * Math.sin(v * Math.PI), at.z + (v - 0.5) * width);
        uv.push(v, t);
        if (j < steps && k < cols) {
          const i = (side === 1 ? count : 0) + j * (cols + 1) + k;
          if (side === 1) indices.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2);
          else indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
        }
      }
    }
    const edge = (a, b) => indices.push(a, a + count, b, b, a + count, b + count);
    for (let j = 0; j < steps; j++) {
      edge(j * (cols + 1), (j + 1) * (cols + 1));
      edge(j * (cols + 1) + cols, (j + 1) * (cols + 1) + cols);
    }
    for (let k = 0; k < cols; k++) {
      edge(k, k + 1); edge(steps * (cols + 1) + k, steps * (cols + 1) + k + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  // Lathed cloth volume: authored garment ease, separate legs and open cuffs.
  function garment(rings, folds = 0.018) {
    const sides = 20, positions = [], uv = [], indices = [];
    for (let j = 0; j < rings.length; j++) {
      const [y, radius] = rings[j];
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * Math.PI * 2, r = radius * (1 + folds * Math.cos(a * 8));
        positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
        uv.push(k / sides, j / (rings.length - 1));
        if (j < rings.length - 1 && k < sides) {
          const i = j * (sides + 1) + k;
          indices.push(i, i + 1, i + sides + 1, i + 1, i + sides + 2, i + sides + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function head(g, look) {
    // Stock sphere, nose, eye positions and dimensions stay untouched.
    const cap = g.children[4], geo = new THREE.SphereGeometry(0.107, 20, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / 21) / 12;
      const theta = t * Math.PI * (0.66 - 0.27 * Math.max(0, Math.cos(a)));
      p.setXYZ(i, 0.107 * Math.sin(theta) * Math.cos(a), 0.107 * Math.cos(theta), 0.107 * Math.sin(theta) * Math.sin(a));
    }
    geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
    cap.position.set(-0.006, 0.005, 0); cap.rotation.set(0, 0, 0);
    // Gathered hair has a continuous dark volume beneath the swept locks.
    // This fills the crown/temple gaps without changing the native head or eyes.
    const dark = [bake(new THREE.SphereGeometry(0.1, 16, 10),
      [-0.026, 0.065, 0], null, [0.95, 0.85, 1.05])], sheen = [];
    for (let i = -3; i <= 3; i++) {
      const z = i * 0.026;
      (i % 3 === 0 ? sheen : dark).push(lock([
        [0.082 - Math.abs(i) * 0.01, 0.065 - Math.abs(i) * 0.002, z],
        [0.021, 0.112 - Math.abs(i) * 0.008, z * 1.08],
        [-0.05, 0.124, z * 0.76], [-0.064, 0.151, z * 0.36],
      ], [0.028, 0.034, 0.027, 0.014], 0.008));
    }
    for (const s of [-1, 1]) {
      dark.push(lock([[0.017, 0.01, s * 0.102], [-0.05, 0.048, s * 0.098],
        [-0.091, 0.095, s * 0.062], [-0.075, 0.151, s * 0.021]], [0.024, 0.036, 0.032, 0.014]));
      dark.push(lock([[0.061, 0.059, s * 0.079], [0.041, 0.013, s * 0.099],
        [0.033, -0.025, s * 0.095]], [0.021, 0.019, 0.002], 0.006));
    }
    dark.push(bake(new THREE.SphereGeometry(0.049, 12, 8), [-0.065, 0.151, 0], null, [0.91, 0.91, 1.1]));
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, points = [];
      for (let k = 0; k < 5; k++) {
        const t = k / 4, b = a + t * Math.PI * 1.25;
        points.push([-0.065 + Math.cos(b) * 0.043, 0.122 + Math.sin(t * Math.PI) * 0.078,
          Math.sin(b) * 0.055]);
      }
      (i % 2 ? sheen : dark).push(lock(points, [0.021, 0.031, 0.033, 0.026, 0.012], 0.009));
    }
    addMerged(hair(g), dark, look.hair, { ...CLOTH, roughness: 0.81 });
    addMerged(hair(g), sheen, 0x252321, { ...CLOTH, roughness: 0.82 });
    addMerged(hair(g), [bake(new THREE.TorusGeometry(0.038, 0.004, 5, 16), [-0.065, 0.122, 0], [Math.PI / 2, 0, 0])], OCHRE_EDGE, CLOTH);
    addMerged(fabric(g), [-1, 1].map(s => box(0.005, 0.004, 0.031, [0.097, 0.036, s * 0.034], [s * 0.035, 0, 0])), look.hair, CLOTH);
    addMerged(fabric(g), [box(0.003, 0.004, 0.027, [0.093, -0.05, 0])], 0x7a4939, CLOTH);
  }
  function chest(g, look) {
    torso(g, INDIGO, 0.042); const l = fabric(g);
    addMerged(l, [cyl(0.041, 0.049, 0.06, 12, false, [0, 0.171, 0])], look.skin, CLOTH);
    addMerged(l, [bake(new THREE.TorusGeometry(0.061, 0.006, 5, 20), [0.012, 0.139, 0], [Math.PI / 2, 0, 0], [0.91, 1, 1.12]),
      box(0.005, 0.219, 0.006, [0.122, -0.008, 0.023])], SEAM, CLOTH);
    // One continuous shoulder fold; no crossing straps and no shoulder armor.
    addMerged(l, [clothStrip([[-0.129, -0.145, -0.11, 0.112], [-0.126, 0.041, -0.13, 0.12],
      [-0.095, 0.129, -0.145, 0.11], [0.004, 0.142, -0.146, 0.11],
      [0.101, 0.125, -0.134, 0.107], [0.126, 0.048, -0.121, 0.098],
      [0.128, -0.145, -0.094, 0.096]])], OCHRE, twoSided);
    addMerged(l, [clothStrip([[0.13, 0.091, -0.158, 0.009], [0.132, 0.008, -0.15, 0.009],
      [0.134, -0.145, -0.126, 0.009]])], OCHRE_EDGE, twoSided);
    addMerged(l, [bake(new THREE.TorusGeometry(0.014, 0.0035, 5, 12), [0.134, 0.08, -0.124], [0, Math.PI / 2, 0]),
      box(0.006, 0.003, 0.023, [0.135, 0.08, -0.124])], BRASS, bronze);
  }
  function abdomen(g) {
    torso(g, INDIGO, 0.029); const l = fabric(g);
    addMerged(l, [clothStrip([[0.123, 0.099, -0.093, 0.094], [0.123, 0.018, -0.078, 0.09],
      [0.128, -0.074, -0.08, 0.081]])], OCHRE, twoSided);
    addMerged(l, [bake(artoriaRoundedBox(0.231, 0.037, 0.332, 0.018), [0, -0.049, 0])], ROPE, CLOTH);
    addMerged(l, [-0.039, -0.051, -0.063].map(y => bake(artoriaRoundedBox(0.235, 0.04, 0.337, 0.018), [0, y, 0], null, [1, 0.1, 1])), OCHRE_EDGE, CLOTH);
    addMerged(l, [ball(0.014, 8, 6, [0.124, -0.048, 0.087]),
      cyl(0.004, 0.003, 0.098, 6, false, [0.127, -0.081, 0.101], [0.2, 0, 0.11])], ROPE, CLOTH);
  }
  function pelvis(g) {
    torso(g, TROUSERS, 0.025); const l = fabric(g);
    // A short indigo blouse hem ends at the waist; the legs stay trousers.
    addMerged(l, [bake(artoriaRoundedBox(0.219, 0.059, 0.34, 0.018), [0, 0.069, 0])], INDIGO, CLOTH);
    addMerged(l, [clothStrip([[0.128, 0.1, -0.08, 0.082], [0.135, 0.015, -0.088, 0.077],
      [0.142, -0.084, -0.105, 0.065], [0.146, -0.142, -0.121, 0.057]])], OCHRE, twoSided);
    // A slim, blunt, old measuring rod hangs from two loops at the right hip.
    addMerged(l, [cyl(0.009, 0.009, 0.275, 8, false, [0.021, -0.074, 0.185], [0.07, 0, 0.05]),
      box(0.015, 0.038, 0.027, [0.021, 0.069, 0.176])], 0x61513a, CLOTH);
    addMerged(l, [-0.014, -0.06, -0.106, -0.152].map(y => box(0.004, 0.004, 0.019, [0.032, y, 0.185])), WRAP, CLOTH);
    addMerged(l, [cyl(0.011, 0.012, 0.027, 8, false, [0.021, -0.211, 0.176])], BRASS, bronze);
    addMerged(l, [box(0.021, 0.043, 0.013, [0.019, 0.049, 0.181]),
      box(0.02, 0.016, 0.022, [0.023, -0.003, 0.184])], LEATHER, CLOTH);
  }
  function upperArm(g, look) {
    tint(g, look.skin); const l = fabric(g);
    addMerged(l, [garment([[0.16, 0.012], [0.143, 0.042], [0.096, 0.061],
      [0.024, 0.066], [-0.031, 0.064]], 0.022)], INDIGO, twoSided);
    addMerged(l, [cyl(0.0647, 0.0647, 0.012, 20, true, [0, -0.027, 0])], SEAM, twoSided);
  }
  function forearm(g, look) { tint(g, look.skin); }
  function thigh(g) {
    const geo = garment([[0.22, 0.074], [0.154, 0.087], [0.045, 0.092],
      [-0.085, 0.087], [-0.19, 0.069], [-0.222, 0.063]], 0.033);
    g.children[0].geometry.copy(geo); geo.dispose(); tint(g, TROUSERS);
    g.children[0].material.side = THREE.DoubleSide;
    addMerged(fabric(g), [cyl(0.064, 0.064, 0.018, 20, true, [0, -0.209, 0])], SEAM, twoSided);
  }
  function shin(g, look) {
    tint(g, look.skin); const l = fabric(g);
    // The gathered trouser cuff overlaps the knee; wrappings stop above sandals.
    addMerged(l, [garment([[0.228, 0.064], [0.153, 0.063], [0.116, 0.06]])], TROUSERS, twoSided);
    addMerged(l, [garment([[0.131, 0.056], [0.065, 0.058], [-0.038, 0.056], [-0.157, 0.052]])], WRAP, twoSided);
    addMerged(l, [0.111, 0.071, 0.031, -0.009, -0.049, -0.089, -0.129].map((y, i) =>
      cyl(0.0588 - Math.max(0, i - 2) * 0.0012, 0.0586 - Math.max(0, i - 2) * 0.0012,
        0.006, 18, true, [0, y, 0], [0, 0, 0.08])), 0x8c816c, twoSided);
  }
  function foot(g, look) {
    tint(g, look.skin); const l = fabric(g);
    const geo = artoriaRoundedBox(0.25, 0.075, 0.11, 0.018);
    g.children[0].geometry.copy(geo); geo.dispose();
    addMerged(l, [bake(artoriaRoundedBox(0.257, 0.013, 0.116, 0.005), [0, -0.036, 0]),
      box(0.025, 0.008, 0.11, [0.061, 0.039, 0]),
      box(0.026, 0.008, 0.111, [-0.037, 0.039, 0]),
      ...[-1, 1].flatMap(s => [box(0.026, 0.059, 0.008, [-0.037, 0.009, s * 0.055]),
        box(0.025, 0.059, 0.008, [0.061, 0.009, s * 0.055])]),
      box(0.089, 0.007, 0.014, [0.005, 0.043, 0])], LEATHER, CLOTH);
    addMerged(l, [box(0.008, 0.013, 0.011, [-0.037, 0.026, -0.061])], BRASS, bronze);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm, thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin, footF: foot, footB: foot };
}
