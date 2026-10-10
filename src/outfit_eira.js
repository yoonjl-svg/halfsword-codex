// Eira Lind: native face, body proportions, hands and wound meshes are retained.
// +X faces forward, +Y points upward/proximally, +Z points to the right.
// Every garment/hair section follows one native part; no simulated cloth/armor.
export function createEiraOutfit(h) {
  const { THREE, bake, box, cyl, addMerged, CLOTH, isoldeLock, artoriaCloth, sleeveVolume } = h;
  const NAVY = 0x202a40, SEAM = 0x35415a;
  const WHITE = 0xf0efea, FOLD = 0xcbd1d4;
  const BOOT = 0x191c24, LACE = 0x606574;
  const fabric = (g) => artoriaCloth(g, 'eira-fabric');
  const hairLayer = (g) => artoriaCloth(g, 'eira-hair');
  const color = (g, value) => {
    const m = g.children[0].material;
    m.color.setHex(value); m.roughness = 0.96; m.metalness = 0;
  };
  function plainTorso(g) {
    // Only remove dressPart's initial quilting/belt/skirt decorations. The
    // representative mesh, geometry identity, material and later wounds remain.
    for (const child of g.children.slice(1)) {
      g.remove(child); child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material?.dispose();
    }
    color(g, NAVY);
  }
  function panel(x, yz, thickness = 0.005) {
    const positions = [], uv = [], indices = [], n = yz.length;
    for (const dx of [-thickness / 2, thickness / 2]) for (const [y, z] of yz) {
      positions.push(x + dx, y, z); uv.push(z, y);
    }
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(yz.map(([y, z]) => new THREE.Vector2(y, z)), [])) {
      indices.push(a, c, b, n + a, n + b, n + c);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(i, j, n + j, i, n + j, n + i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  // A thin, softly squared cloth surface, with no solid shoulder/torso shell.
  // Rings are [Y, X radius, Z radius, squareness]; four rings drape the cape.
  function drape(rings, scallop = 0) {
    const positions = [], uv = [], indices = [], sides = 32;
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, power = 4] = rings[j];
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const r = (Math.abs(c / rx) ** power + Math.abs(s / rz) ** power) ** (-1 / power);
        positions.push(c * r, y + scallop * Math.cos(a * 6) * j / (rings.length - 1), s * r);
        uv.push(k / sides, j / (rings.length - 1));
        if (j < rings.length - 1 && k < sides) {
          const i = j * (sides + 1) + k;
          indices.push(i, i + sides + 1, i + 1, i + 1, i + sides + 1, i + sides + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function hairline(g) {
    // Change only the existing hair cap. The sphere, two stock eyes and nose
    // at children 0..3 are not touched, even temporarily.
    const cap = g.children[4];
    if (!cap?.isMesh || cap.geometry.type !== 'SphereGeometry') return;
    const geo = new THREE.SphereGeometry(0.107, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.64);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const t = Math.floor(i / 21) / 12;
      const theta = t * Math.PI * (0.64 - 0.23 * Math.max(0, Math.cos(a)));
      p.setXYZ(i, 0.107 * Math.sin(theta) * Math.cos(a), 0.107 * Math.cos(theta), 0.107 * Math.sin(theta) * Math.sin(a));
    }
    geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
    cap.position.set(-0.008, 0.004, 0); cap.rotation.set(0, 0, 0);
  }
  function backHair(g, look, lower) {
    const locks = [], shades = [];
    for (let i = -3; i <= 3; i++) {
      const z = i * 0.041, wave = i % 2 ? 1 : -1;
      const points = lower
        ? [[-0.155, 0.107, z * 1.12], [-0.156, 0.047, z + wave * 0.012],
          [-0.165, -0.009, z * 0.93], [-0.147, -0.066 + Math.abs(i) * 0.013, z * 0.92 + wave * 0.009]]
        : [[-0.137, 0.207, z * 0.8], [-0.158, 0.118, z * 1.09 + wave * 0.009],
          [-0.164, -0.002, z + wave * 0.013], [-0.151, -0.115, z * 1.06], [-0.156, -0.181, z * 1.12]];
      const widths = lower ? [0.058, 0.061, 0.044, 0.002] : [0.058, 0.065, 0.06, 0.058, 0.051];
      (i === -2 || i === 2 ? shades : locks).push(isoldeLock(points, widths, 0.015));
    }
    addMerged(hairLayer(g), locks, look.hair || WHITE, { ...CLOTH, roughness: 0.86 });
    addMerged(hairLayer(g), shades, 0xb5c8dc, CLOTH);
  }
  function sideLock(points, widths, depth) {
    // Side curtains are broad along X, complementing the flattened back locks.
    const geo = isoldeLock(points.map(([x, y, z]) => [z, y, x]), widths, depth);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getZ(i), p.getY(i), p.getX(i));
    // Swapping two axes reverses winding; restore the outward-facing surface.
    const index = geo.index;
    for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
    geo.computeVertexNormals(); return geo;
  }
  function robeSection(g, lower) {
    const top = lower ? 0.128 : 0.114, bottom = lower ? 0.151 : 0.143;
    // Extend only the shin's upper end: 12 cm overlaps the thigh in the native
    // stance while the ankle hem stays at the same height. No exposed end caps.
    const height = lower ? 0.5 : 0.445, y = lower ? 0.074 : 0;
    const geo = new THREE.CylinderGeometry(top, bottom, height, 24, 5, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const fold = 1 + 0.037 * Math.cos(a * 8);
      p.setXYZ(i, p.getX(i) * 0.92 * fold, p.getY(i) + y, p.getZ(i) * fold);
    }
    geo.computeVertexNormals();
    // Copy into the native CapsuleGeometry instead of replacing its identity:
    // partMesh and the radial wound contract continue to refer to this surface.
    g.children[0].geometry.copy(geo); geo.dispose(); color(g, NAVY);
    g.children[0].material.side = THREE.DoubleSide;
    if (lower) {
      const hem = new THREE.CylinderGeometry(bottom * 1.006, bottom * 1.011, 0.012, 24, 1, true);
      const hp = hem.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        const a = Math.atan2(hp.getZ(i), hp.getX(i)), fold = 1 + 0.037 * Math.cos(a * 8);
        hp.setXYZ(i, hp.getX(i) * 0.92 * fold, hp.getY(i) - 0.172, hp.getZ(i) * fold);
      }
      hem.computeVertexNormals();
      addMerged(fabric(g), [hem], SEAM, { ...CLOTH, side: THREE.DoubleSide });
      // Boot shafts show below the ankle-length hem and follow each shin.
      addMerged(fabric(g), [cyl(0.057, 0.049, 0.104, 12, false, [0, -0.163, 0])], BOOT, CLOTH);
      addMerged(fabric(g), [-0.137, -0.158, -0.179].flatMap((yy) => [
        box(0.003, 0.004, 0.055, [0.054, yy, 0], [0.28, 0, 0]),
        box(0.003, 0.004, 0.055, [0.055, yy, 0], [-0.28, 0, 0]),
      ]), LACE, CLOTH);
    }
  }
  function upperArm(g) {
    color(g, NAVY); sleeveVolume(g, 1.045, 1.1);
    addMerged(fabric(g), [cyl(0.06, 0.061, 0.008, 12, true, [0, -0.092, 0])], SEAM, CLOTH);
  }
  function forearm(g) {
    color(g, NAVY); sleeveVolume(g, 1.1, 1.03);
    addMerged(fabric(g), [cyl(0.052, 0.049, 0.062, 12, true, [0, -0.07, 0]),
      cyl(0.047, 0.046, 0.027, 12, true, [0, -0.108, 0])], WHITE, { ...CLOTH, side: THREE.DoubleSide });
    addMerged(fabric(g), [-0.052, -0.074, -0.095, -0.113].map((y, i) =>
      cyl(i < 2 ? 0.052 : 0.0475, i < 2 ? 0.051 : 0.047, 0.003, 12, true, [0, y, 0])), FOLD, CLOTH);
    // dressPart's native hand sphere and grip transform are deliberately intact.
  }
  function foot(g) {
    color(g, BOOT);
    addMerged(fabric(g), [box(0.252, 0.012, 0.113, [0, -0.034, 0]),
      box(0.069, 0.008, 0.109, [0.077, 0.039, 0])], 0x242730, CLOTH);
    addMerged(fabric(g), [-0.029, -0.001, 0.027].flatMap((x) => [
      box(0.004, 0.004, 0.066, [x, 0.041, 0], [0, 0.32, 0]),
      box(0.004, 0.004, 0.066, [x, 0.042, 0], [0, -0.32, 0]),
    ]), LACE, CLOTH);
  }
  return {
    head(g, look) {
      hairline(g);
      const locks = [];
      for (const s of [-1, 1]) {
        // Swept-open fringe leaves the complete stock eye/nose silhouette.
        locks.push(isoldeLock([[0.001, 0.104, s * 0.019], [0.049, 0.094, s * 0.054],
          [0.079, 0.064, s * 0.075], [0.048, 0.019, s * 0.094]], [0.037, 0.041, 0.03, 0.009], 0.009));
        locks.push(isoldeLock([[0.019, 0.072, s * 0.096], [-0.005, -0.006, s * 0.112],
          [0.063, -0.11, s * 0.13], [0.145, -0.217, s * 0.15]], [0.045, 0.058, 0.061, 0.05], 0.016));
        locks.push(sideLock([[-0.034, 0.038, s * 0.095], [-0.042, -0.05, s * 0.113],
          [-0.031, -0.15, s * 0.145], [-0.02, -0.235, s * 0.168]], [0.075, 0.098, 0.112, 0.11], 0.014));
        locks.push(isoldeLock([[-0.059, 0.038, s * 0.083], [-0.106, -0.049, s * 0.09],
          [-0.142, -0.129, s * 0.105], [-0.153, -0.213, s * 0.112]], [0.058, 0.057, 0.054, 0.041], 0.014));
      }
      locks.push(isoldeLock([[-0.103, 0.025, 0], [-0.114, -0.068, 0],
        [-0.147, -0.143, 0.006], [-0.153, -0.213, 0]], [0.104, 0.112, 0.104, 0.086], 0.014));
      addMerged(hairLayer(g), locks, look.hair || WHITE, { ...CLOTH, roughness: 0.86 });
    },
    chest(g, look) {
      plainTorso(g);
      const layer = fabric(g);
      // Broad white winter collar, draped over the unscaled native shoulders.
      addMerged(layer, [drape([[0.18, 0.057, 0.069, 2], [0.148, 0.124, 0.19, 6],
        [0.129, 0.142, 0.215, 5], [0.044, 0.149, 0.222, 4]], 0.004),
        cyl(0.056, 0.069, 0.05, 16, true, [0, 0.179, 0]),
        // One short bib stays wholly on the chest, without crossing a joint.
        panel(0.152, [[0.072, -0.066], [0.072, 0.066], [-0.087, 0.048],
          [-0.115, 0], [-0.087, -0.048]])], WHITE, { ...CLOTH, side: THREE.DoubleSide });
      addMerged(layer, [drape([[0.051, 0.1505, 0.2235, 4], [0.043, 0.1505, 0.2235, 4]], 0.004)], FOLD, { ...CLOTH, side: THREE.DoubleSide });
      backHair(g, look, false);
      addMerged(hairLayer(g), [-1, 1].flatMap((s) => [isoldeLock([[0.111, 0.168, s * 0.131],
        [0.168, 0.079, s * 0.152], [0.16, -0.018, s * 0.142],
        [0.156, -0.112, s * 0.156], [0.145, -0.175, s * 0.145]],
      [0.049, 0.068, 0.065, 0.059, 0.009], 0.017),
        sideLock([[-0.035, 0.185, s * 0.151], [-0.015, 0.09, s * 0.183],
          [-0.038, -0.02, s * 0.198], [-0.02, -0.15, s * 0.178]], [0.12, 0.15, 0.15, 0.025], 0.015),
      ]), look.hair || WHITE, { ...CLOTH, roughness: 0.86 });
    },
    abdomen(g, look) {
      plainTorso(g);
      backHair(g, look, true);
    },
    pelvis(g) {
      plainTorso(g);
      addMerged(fabric(g), [drape([[0.083, 0.108, 0.169, 6], [-0.041, 0.121, 0.189, 5],
        [-0.139, 0.137, 0.209, 4]], 0.003)], NAVY, { ...CLOTH, side: THREE.DoubleSide });
    },
    uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm,
    thighF: (g) => robeSection(g, false), thighB: (g) => robeSection(g, false),
    shinF: (g) => robeSection(g, true), shinB: (g) => robeSection(g, true),
    footF: foot, footB: foot,
  };
}
