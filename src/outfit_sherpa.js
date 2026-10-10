// A fictional surveyor's personal traveling clothes. +X front, +Y up, +Z right.
// Native anatomy, representative wound meshes, hands and physics stay intact.
export function createSherpaOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, isoldeLock, artoriaCloth, artoriaRoundedBox } = h;
  const IVORY = 0xded3b6, LIGHT = 0xeee5ce, FOLD = 0xb8aa8b;
  const SHIRT = 0x59513e, TROUSERS = 0x55422f, SEAM = 0x6a543b;
  const LEATHER = 0x352921, EDGE = 0x514135, BOOT = 0x2b2823, STEEL = 0x7c7a6c;
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.98 };
  const twoSided = { ...cloth, side: THREE.DoubleSide };
  const leather = { ...CLOTH, metalness: 0, roughness: 0.87 };
  const metal = { ...CLOTH, metalness: 0.32, roughness: 0.72 };
  const layer = (g) => artoriaCloth(g, 'sherpa-cloth');
  const hairLayer = (g) => artoriaCloth(g, 'sherpa-hair');
  function tint(g, color) {
    g.children[0].material.color.setHex(color);
    g.children[0].material.roughness = 0.98;
    g.children[0].material.metalness = 0;
  }
  function plainTorso(g, color, radius = 0.025) {
    // Hide only dressPart's stock quilt, crossed straps and tunic skirt.
    // Its original mesh/geometry/material remain the wound representative.
    for (const child of g.children.slice(1)) child.visible = false;
    const { width, height, depth } = g.children[0].geometry.parameters;
    const rounded = artoriaRoundedBox(width, height, depth, radius);
    g.children[0].geometry.copy(rounded); rounded.dispose();
    tint(g, color);
  }
  function line(a, b, radius = 0.0018) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const geo = new THREE.CylinderGeometry(radius, radius, delta.length(), 5);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    geo.translate(...start.add(end).multiplyScalar(0.5).toArray());
    return geo;
  }
  // Thin draped strips have shared indexed attributes for the normal merger.
  // Rows are [x, y, z, width, fold]; +Z is the crosswise fabric direction.
  function strip(rows, ragged = 0) {
    const positions = [], uv = [], indices = [], columns = 8;
    const curve = new THREE.CatmullRomCurve3(rows.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const steps = (rows.length - 1) * 3;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, at = curve.getPoint(t), span = t * (rows.length - 1);
      const row = Math.min(rows.length - 2, Math.floor(span)), mix = span - row;
      const width = THREE.MathUtils.lerp(rows[row][3], rows[row + 1][3], mix);
      const fold = THREE.MathUtils.lerp(rows[row][4] || 0, rows[row + 1][4] || 0, mix);
      for (let k = 0; k <= columns; k++) {
        const u = k / columns, ridge = Math.sin(u * Math.PI);
        const hem = j === steps ? ragged * [0, .45, -.3, .65, -.18, .32, -.6, .2, 0][k] : 0;
        positions.push(at.x + fold * (0.68 * ridge + 0.32 * Math.sin(u * Math.PI * 3)) + 0.0015 * Math.sin(u * Math.PI * 4),
          at.y + 0.004 * ridge + hem, at.z + (u - 0.5) * width);
        uv.push(u, t);
        if (j < steps && k < columns) {
          const i = j * (columns + 1) + k;
          indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }
  function neckShawl() {
    const positions = [], uv = [], indices = [], sides = 40, rings = 6;
    for (let j = 0; j <= rings; j++) for (let k = 0; k <= sides; k++) {
      const t = j / rings, a = k / sides * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const spread = Math.sin(t * Math.PI * 0.5), fold = 0.003 * Math.sin(a * 5 + t * 3) * t;
      const rx = 0.055 + 0.075 * spread, rz = 0.064 + 0.122 * spread;
      positions.push(c * (rx + fold), 0.185 - 0.066 * t - 0.027 * s * t
        - 0.008 * Math.sin(t * Math.PI) + 0.004 * Math.cos(a * 3) * t,
      s * (rz + fold) + 0.017 * t);
      uv.push(k / sides, t);
      if (j < rings && k < sides) {
        const i = j * (sides + 1) + k;
        indices.push(i, i + 1, i + sides + 1, i + 1, i + sides + 2, i + sides + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function wrapBand(y, height, rx, rz, tilt = 0, frontTilt = 0) {
    const positions = [], uv = [], indices = [], sides = 36;
    for (let row = 0; row <= 3; row++) {
      const v = row / 3, fold = 1 + 0.009 * Math.sin(v * Math.PI);
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * Math.PI * 2, x = rx * Math.cos(a), z = rz * Math.sin(a);
        positions.push(-0.009 + x * fold, y + (v - 0.5) * height + z * tilt + x * frontTilt,
          z * fold);
        uv.push(k / sides, v);
        if (row < 3 && k < sides) {
          const i = row * (sides + 1) + k;
          indices.push(i, i + 1, i + sides + 1, i + 1, i + sides + 2, i + sides + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function sideLock(points, widths, depth) {
    const geo = isoldeLock(points.map(([x, y, z]) => [z, y, x]), widths, depth);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getZ(i), p.getY(i), p.getX(i));
    const index = geo.index;
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b);
    }
    geo.computeVertexNormals(); return geo;
  }
  function head(g, look) {
    const l = layer(g), hair = [], hairColor = look.hair || 0x201b18;
    // A shallow folded crown, never a helmet. The lowest front wrap stays
    // above the stock eyes; the forehead/face sphere is never reshaped.
    const crown = bake(ball(0.112, 24, 10, null, null, [0, Math.PI * 2, 0, Math.PI / 2]),
      [-0.009, 0.066, 0], null, [1, 0.65, 1]);
    addMerged(l, [crown, wrapBand(0.074, 0.036, 0.113, 0.114, 0.12, -0.065),
      wrapBand(0.096, 0.032, 0.108, 0.112, -0.11, 0.07),
      wrapBand(0.12, 0.022, 0.091, 0.098, 0.10, -0.035)], IVORY, twoSided);
    addMerged(l, [wrapBand(0.062, 0.0035, 0.114, 0.115, 0.12, -0.065),
      wrapBand(0.083, 0.003, 0.109, 0.113, -0.11, 0.07),
      wrapBand(0.113, 0.003, 0.092, 0.099, 0.10, -0.035)], FOLD, twoSided);
    addMerged(l, [strip([[-0.099, 0.071, 0.078, 0.043, -0.006],
      [-0.12, 0.012, 0.105, 0.036, -0.006], [-0.116, -0.061, 0.114, 0.03, -0.004],
      [-0.131, -0.125, 0.124, 0.018, 0]], 0.014)], LIGHT, twoSided);
    for (const s of [-1, 1]) {
      hair.push(sideLock([[0.013, 0.068, s * 0.1], [0.039, 0.024, s * 0.107],
        [0.018, -0.018, s * 0.112], [0.042, -0.079 + (s === 1 ? .012 : 0), s * 0.09]],
      [0.055, 0.06, 0.054, 0.005], 0.007));
      hair.push(sideLock([[-0.046, 0.05, s * 0.098], [-0.052, -0.012, s * 0.113],
        [-0.079, -0.055, s * 0.091], [-0.058, -0.088, s * 0.096]], [0.048, 0.055, 0.037, 0.004], 0.008));
      hair.push(isoldeLock([[0.069, 0.067, s * 0.064], [0.091, 0.045, s * 0.071],
        [0.088, 0.008, s * 0.081]], [0.032, 0.027, 0.003], 0.006));
    }
    hair.push(isoldeLock([[0.055, 0.081, 0.021], [0.09, 0.059, 0.011],
      [0.105, 0.036, -0.009]], [0.029, 0.026, 0.003], 0.004));
    // Short uneven nape locks gather into a small, low tied tail.
    for (const z of [-0.055, -0.025, 0.013, 0.045]) hair.push(isoldeLock([
      [-0.102, 0.042, z], [-0.112, -0.03, z * 0.95], [-0.127, -0.077, z * 0.6 + .009]],
    [0.041, 0.037, 0.009], 0.009));
    hair.push(isoldeLock([[-0.118, -0.061, 0.017], [-0.145, -0.089, 0.031],
      [-0.157, -0.132, 0.045], [-0.15, -0.168, 0.028]], [0.036, 0.04, 0.032, 0.003], 0.012));
    addMerged(hairLayer(g), hair, hairColor, cloth);
    addMerged(l, [bake(new THREE.TorusGeometry(0.019, 0.003, 5, 12),
      [-0.137, -0.083, 0.027], [Math.PI / 2, 0, -0.35], [0.8, 1, 1])], LEATHER, leather);
  }
  function chest(g) {
    plainTorso(g, SHIRT, 0.045); const l = layer(g);
    // The neck wrap opens smoothly onto the right shoulder and into two
    // curved hanging surfaces. Broad folds come from fabric depth, not lines.
    addMerged(l, [neckShawl(), strip([[-0.125, -0.149, -0.087, 0.145, -0.013],
      [-0.127, -0.103, -0.035, 0.245, -0.023], [-0.127, -0.018, 0.032, 0.278, -0.025],
      [-0.114, 0.093, 0.065, 0.253, -0.018], [-0.066, 0.134, 0.10, 0.191, -0.007],
      [0.025, 0.142, 0.104, 0.19, 0.006], [0.105, 0.118, 0.049, 0.282, 0.015],
      [0.127, 0.061, 0.023, 0.307, 0.032], [0.13, -0.024, -0.022, 0.297, 0.034],
      [0.128, -0.081, -0.067, 0.249, 0.026], [0.126, -0.148, -0.122, 0.143, 0.011]], 0.009)], IVORY, twoSided);
    addMerged(l, [strip([[0.129, 0.10, 0.041, 0.052, 0.017],
      [0.148, 0.049, -0.009, 0.061, 0.022], [0.15, -0.016, -0.066, 0.041, 0.013],
      [0.138, -0.092, -0.113, 0.018, 0.007], [0.132, -0.145, -0.143, 0.009, 0.004]])], 0xd1c5a8, twoSided);
  }
  function abdomen(g) {
    plainTorso(g, SHIRT); const l = layer(g);
    addMerged(l, [bake(artoriaRoundedBox(0.234, 0.037, 0.336, 0.014), [0, -0.048, 0])], LEATHER, leather);
    addMerged(l, [box(0.008, 0.024, 0.004, [0.123, -0.048, -0.012]),
      box(0.008, 0.024, 0.004, [0.123, -0.048, 0.019]),
      box(0.008, 0.004, 0.035, [0.123, -0.037, 0.0035]),
      box(0.008, 0.004, 0.035, [0.123, -0.059, 0.0035])], STEEL, metal);
    addMerged(l, [strip([[0.128, 0.107, -0.13, 0.119, 0.006],
      [0.129, 0.038, -0.151, 0.086, 0.011], [0.128, -0.089, -0.154, 0.067, 0.008]], 0.006)], IVORY, twoSided);
    addMerged(l, [strip([[0.142, 0.103, -0.141, 0.005], [0.144, 0.031, -0.161, 0.006],
      [0.14, -0.086, -0.168, 0.004]])], FOLD, twoSided);
  }
  function pelvis(g) {
    plainTorso(g, TROUSERS); const l = layer(g);
    addMerged(l, [strip([[0.127, 0.101, -0.154, 0.069, 0.006],
      [0.13, 0.033, -0.159, 0.064, 0.008], [0.144, -0.071, -0.158, 0.058, 0.009],
      [0.139, -0.209, -0.182, 0.045, 0.004]], 0.022)], IVORY, twoSided);
    addMerged(l, [strip([[0.139, 0.099, -0.169, 0.005], [0.145, 0.032, -0.171, 0.004],
      [0.156, -0.075, -0.169, 0.006], [0.146, -0.208, -0.188, 0.003]])], FOLD, twoSided);
    // A compact worn map/sample pouch hangs from the opposite belt side.
    addMerged(l, [box(0.045, 0.098, 0.079, [0.126, 0.005, 0.128], [0.04, 0, -0.06]),
      box(0.009, 0.049, 0.082, [0.153, 0.035, 0.128], [0, 0, -0.06]),
      box(0.018, 0.057, 0.017, [0.113, 0.079, 0.11]),
      box(0.018, 0.057, 0.017, [0.113, 0.079, 0.146])], LEATHER, leather);
    addMerged(l, [line([0.155, -0.033, 0.096], [0.155, -0.036, 0.16]),
      line([0.158, 0.057, 0.093], [0.158, 0.013, 0.096]),
      line([0.158, 0.013, 0.096], [0.158, 0.013, 0.159])], EDGE, leather);
    addMerged(l, [ball(0.005, 8, 6, [0.16, 0.02, 0.128])], STEEL, metal);
    addMerged(l, [box(0.008, 0.03, 0.057, [0.14, 0.069, 0.128], [0.03, 0, -0.06])], IVORY, cloth);
    addMerged(l, [line([0.146, 0.076, 0.109], [0.146, 0.079, 0.126], 0.001),
      line([0.146, 0.079, 0.126], [0.146, 0.073, 0.147], 0.001)], SEAM, cloth);
  }
  function upperArm(g, look) { tint(g, look.skin); }
  function forearm(g, look) {
    tint(g, look.skin); const l = layer(g);
    addMerged(l, [cyl(0.049, 0.044, 0.108, 16, true, [0, -0.043, 0])], LEATHER, { ...leather, side: THREE.DoubleSide });
    addMerged(l, [cyl(0.0497, 0.049, 0.011, 16, true, [0, 0.006, 0]),
      cyl(0.045, 0.0446, 0.011, 16, true, [0, -0.091, 0])], EDGE, leather);
    const studs = [];
    for (const y of [-0.01, -0.066]) for (const z of [-0.019, 0.019])
      studs.push(bake(ball(0.0043, 8, 6), [0.043, y, z], null, [0.5, 1, 1]));
    addMerged(l, studs, STEEL, metal);
  }
  function thigh(g) {
    tint(g, TROUSERS); const l = layer(g);
    const trousers = new THREE.CylinderGeometry(0.069, 0.059, 0.441, 20, 5, true);
    const p = trousers.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), fold = 1 + .018 * Math.cos(a * 7);
      p.setXYZ(i, p.getX(i) * fold, p.getY(i) - .0085, p.getZ(i) * fold);
    }
    trousers.computeVertexNormals(); addMerged(l, [trousers], TROUSERS, twoSided);
    addMerged(l, [line([0.024, 0.13, 0.061], [0.023, -0.12, 0.061], 0.0015),
      line([0.022, 0.13, -0.061], [0.021, -0.12, -0.061], 0.0015)], SEAM, cloth);
  }
  function shin(g) {
    tint(g, IVORY); const l = layer(g);
    addMerged(l, [cyl(0.054, 0.052, 0.335, 16, true, [0, 0.035, 0])], IVORY, twoSided);
    const bands = [];
    for (let i = 0; i < 6; i++) bands.push(cyl(0.0548 - i * .0003, 0.0545 - i * .0003,
      0.006, 16, true, [0, 0.137 - i * 0.047, 0], [0, 0, i % 2 ? -.08 : .075]));
    addMerged(l, bands, FOLD, twoSided);
    addMerged(l, [cyl(0.052, 0.049, 0.09, 14, true, [0, -0.163, 0])], BOOT, { ...leather, side: THREE.DoubleSide });
    addMerged(l, [cyl(0.0528, 0.0524, 0.011, 14, true, [0, -0.124, 0])], EDGE, leather);
  }
  function foot(g) {
    tint(g, BOOT); const l = layer(g);
    addMerged(l, [box(0.251, 0.01, 0.113, [0, -0.034, 0]),
      box(0.062, 0.004, 0.101, [0.086, 0.039, 0])], EDGE, leather);
    addMerged(l, [-0.035, -0.009, 0.017].flatMap((x) => [
      line([x - .01, .041, -.028], [x + .01, .041, .028], .002),
      line([x + .01, .042, -.028], [x - .01, .042, .028], .002),
    ]), 0x766b55, cloth);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm, thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin, footF: foot, footB: foot };
}
