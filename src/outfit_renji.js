// Kurose Renji: visual clothing only. +X front, +Y up, +Z right.
// Keep the native face, eyes, nose, hands and representative wound meshes intact.
export function createRenjiOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, isoldeLock, artoriaCloth } = h;
  const INK = 0x17191e, NAVY = 0x202637, FOLD = 0x303548;
  const WINE = 0x49202d, VIOLET = 0x665080, LIGHT = 0x816b9a;
  const STRAW = 0xb9a477, STRAW_DARK = 0x80704d;
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.96 };
  const doubleCloth = { ...cloth, side: THREE.DoubleSide };
  const layer = (g) => artoriaCloth(g, 'renji-cloth');
  const tint = (g, color) => g.children[0].material.color.setHex(color);

  // All helper geometries have indexed position/normal/uv attributes, so the
  // shared merger keeps one draw per material and disposes construction pieces.
  function panel(x, yz, thickness = 0.006) {
    const vertices = [], uv = [], indices = [], n = yz.length;
    for (const dx of [-thickness / 2, thickness / 2]) for (const [y, z] of yz) {
      vertices.push(x + dx, y, z); uv.push(z, y);
    }
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(yz.map(([y, z]) => new THREE.Vector2(y, z)), []))
      indices.push(a, c, b, n + a, n + b, n + c);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(i, j, n + j, i, n + j, n + i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }
  function line(a, b, radius = 0.002, sides = 5) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const axis = to.clone().sub(from);
    const geo = new THREE.CylinderGeometry(radius, radius, axis.length(), sides);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
    geo.translate(...from.add(to).multiplyScalar(0.5).toArray());
    return geo;
  }
  function pleats(top, bottom, height, y, xScale = 1, zScale = 1, slope = 0) {
    const geo = new THREE.CylinderGeometry(top, bottom, height, 32, 4, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const fold = 1 + 0.07 * Math.cos(a * 8);
      const x = p.getX(i) * fold * xScale, z = p.getZ(i) * fold * zScale;
      p.setXYZ(i, x, p.getY(i) + y + slope * z, z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function hatTilt(geo) {
    // Raise the front edge enough to see the stock eyes from the game camera.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + p.getX(i) * 0.15);
    geo.computeVertexNormals(); return geo;
  }
  function head(g, look) {
    const l = layer(g), cap = g.children[4];
    // Hair only: no quietFace, eye scaling, face/nose geometry or transform edits.
    if (cap?.geometry?.type === 'SphereGeometry') {
      const geo = new THREE.SphereGeometry(0.107, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.65);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const t = Math.floor(i / 21) / 12;
        const theta = t * Math.PI * (0.65 - 0.24 * Math.max(0, Math.cos(a)));
        p.setXYZ(i, 0.107 * Math.sin(theta) * Math.cos(a), 0.107 * Math.cos(theta), 0.107 * Math.sin(theta) * Math.sin(a));
      }
      geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
      cap.position.set(-0.008, 0.004, 0); cap.rotation.set(0, 0, 0);
      cap.material.color.setHex(look.hair);
    }
    const locks = [
      isoldeLock([[0.055, 0.091, -0.056], [0.089, 0.076, -0.011], [0.103, 0.052, 0.036], [0.074, 0.03, 0.078]], [0.043, 0.039, 0.032, 0.003], 0.008),
      isoldeLock([[0.042, 0.083, -0.066], [0.08, 0.059, -0.079], [0.075, 0.015, -0.094], [0.03, -0.06, -0.098]], [0.03, 0.032, 0.023, 0.002], 0.008),
    ];
    for (const s of [-1, 1]) locks.push(isoldeLock([[-0.034, 0.049, s * 0.091], [-0.064, -0.012, s * 0.093], [-0.063, -0.084, s * 0.074], [-0.037, -0.129, s * 0.061]], [0.043, 0.043, 0.031, 0.003], 0.012));
    addMerged(l, locks, look.hair, cloth);

    // A shallow open straw cone and a thin circular lip, never a metal helmet.
    const cone = cyl(0.002, 0.292, 0.157, 40, true, [0, 0.1595, 0]);
    const rim = bake(new THREE.TorusGeometry(0.292, 0.0033, 4, 40), [0, 0.081, 0], [Math.PI / 2, 0, 0]);
    addMerged(l, [hatTilt(cone), hatTilt(rim)], STRAW, doubleCloth);
    const weave = [];
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, c = Math.cos(a), s = Math.sin(a);
      weave.push(hatTilt(line([0.008 * c, 0.235, 0.008 * s], [0.29 * c, 0.083, 0.29 * s], 0.00135, 4)));
    }
    for (const r of [0.096, 0.19, 0.268]) {
      const ring = bake(new THREE.TorusGeometry(r, 0.001, 3, 40), [0, 0.24 - r * 0.538, 0], [Math.PI / 2, 0, 0]);
      weave.push(hatTilt(ring));
    }
    // Short chin cords lie beside the cheeks and leave both eye boxes open.
    for (const s of [-1, 1]) {
      weave.push(line([0.009, 0.081, s * 0.099], [0.063, -0.08, s * 0.075], 0.0016));
      weave.push(line([0.063, -0.08, s * 0.075], [0.046, -0.103, 0], 0.0016));
    }
    addMerged(l, weave, STRAW_DARK, cloth);
  }
  function chest(g) {
    tint(g, INK);
    const l = layer(g);
    // The kimono crosses on the front; small burgundy edges read at game scale.
    addMerged(l, [panel(0.127, [[0.137, -0.139], [0.134, -0.082], [-0.14, 0.127], [-0.14, 0.078]]),
      panel(0.125, [[0.134, 0.139], [0.134, 0.09], [0.032, -0.006], [-0.001, 0.025]])], WINE, cloth);
    addMerged(l, [panel(0.132, [[0.139, -0.135], [0.137, -0.103], [-0.14, 0.108], [-0.14, 0.078]])], 0x30303a, cloth);
    const scarf = bake(new THREE.TorusGeometry(0.076, 0.028, 6, 20), [0, 0.171, 0], [Math.PI / 2, 0, 0], [1, 1.22, 1]);
    const lower = bake(new THREE.TorusGeometry(0.082, 0.021, 6, 20), [0, 0.144, 0], [Math.PI / 2, 0, 0], [1, 1.2, 1]);
    addMerged(l, [scarf, lower, ball(0.037, 10, 7, [-0.017, 0.135, 0.094]),
      panel(-0.126, [[0.145, 0.08], [0.124, 0.142], [-0.136, 0.135], [-0.17, 0.076]], 0.012)], VIOLET, cloth);
    addMerged(l, [panel(-0.134, [[-0.126, 0.077], [-0.119, 0.136], [-0.143, 0.135], [-0.17, 0.076]], 0.006),
      bake(new THREE.TorusGeometry(0.084, 0.0035, 4, 20), [0, 0.169, 0], [Math.PI / 2, 0, 0], [1, 1.2, 1])], LIGHT, cloth);
  }
  function abdomen(g) {
    tint(g, INK);
    const l = layer(g);
    addMerged(l, [box(0.236, 0.079, 0.34, [0, -0.034, 0]),
      box(0.016, 0.046, 0.068, [0.125, -0.035, -0.044])], VIOLET, cloth);
    addMerged(l, [-0.058, -0.023, 0.0].map(y => box(0.005, 0.004, 0.333, [0.121, y, 0])), LIGHT, cloth);
  }
  function pelvis(g) {
    tint(g, NAVY);
    // Hide only the stock circular tunic skirt, keeping the native pelvis mesh.
    if (g.children[1]?.geometry?.type === 'CylinderGeometry') g.children[1].visible = false;
    const l = layer(g);
    addMerged(l, [pleats(0.167, 0.179, 0.205, -0.024, 0.71, 1),
      panel(0.121, [[0.075, -0.135], [0.075, 0.135], [-0.146, 0.117], [-0.146, -0.117]])], NAVY, doubleCloth);
    addMerged(l, [panel(0.128, [[0.04, -0.067], [0.04, -0.031], [-0.18, -0.035], [-0.216, -0.072]]),
      panel(0.13, [[0.039, -0.025], [0.039, 0.013], [-0.15, 0.024], [-0.18, -0.016]])], VIOLET, cloth);
    addMerged(l, [box(0.242, 0.008, 0.343, [0, 0.067, 0])], WINE, cloth);

    // A completely sheathed side sword, built into the pelvis's visual group.
    // It has no weapon registration, collider, blade edge, attack or damage data.
    const sword = new THREE.Group(); sword.name = 'renji-sheathed-sword';
    sword.userData.visualOnly = true; l.add(sword);
    sword.position.set(-0.1, 0.004, -0.195); sword.rotation.z = -1.02;
    addMerged(sword, [bake(cyl(0.018, 0.014, 0.6, 10, false, [0, -0.316, 0]), null, null, [0.66, 1, 1]),
      bake(ball(0.015, 8, 6, [0, -0.614, 0]), null, null, [0.65, 1, 1])], 0x1a1820, cloth);
    addMerged(sword, [cyl(0.014, 0.014, 0.17, 8, false, [0, 0.106, 0]),
      ...[0.044, 0.068, 0.092, 0.116, 0.14, 0.164].map(y => cyl(0.015, 0.015, 0.004, 8, true, [0, y, 0]))], WINE, cloth);
    addMerged(sword, [bake(cyl(0.034, 0.034, 0.007, 12, false, [0, 0.017, 0]), null, null, [0.72, 1, 1]),
      cyl(0.017, 0.017, 0.018, 10, false, [0, -0.008, 0]),
      cyl(0.015, 0.015, 0.008, 8, false, [0, 0.193, 0])], 0x9e8558, { ...cloth, metalness: 0.25, roughness: 0.7 });
    addMerged(l, [line([-0.09, 0.062, -0.173], [-0.117, -0.052, -0.211], 0.006),
      line([-0.13, 0.051, -0.176], [-0.217, -0.06, -0.206], 0.006)], VIOLET, cloth);
  }
  function upperArm(g) {
    tint(g, INK); const l = layer(g);
    addMerged(l, [cyl(0.068, 0.083, 0.264, 16, true, [0, -0.011, 0])], INK, doubleCloth);
    addMerged(l, [cyl(0.0835, 0.084, 0.012, 16, true, [0, -0.138, 0])], WINE, doubleCloth);
  }
  function forearm(g) {
    tint(g, INK); const l = layer(g);
    // Stop above the unmodified hand sphere at Y=-.135.
    addMerged(l, [cyl(0.07, 0.051, 0.184, 16, true, [0, 0.012, 0])], INK, doubleCloth);
    addMerged(l, [cyl(0.052, 0.05, 0.022, 16, true, [0, -0.077, 0])], VIOLET, doubleCloth);
    addMerged(l, [cyl(0.064, 0.061, 0.006, 16, true, [0, 0.033, 0])], WINE, doubleCloth);
  }
  function thigh(g) {
    tint(g, NAVY); const l = layer(g);
    // Native knee is Y=.5: thigh centre .715 gives local knee=-.215.
    // Continue 6cm below that joint, outside the shin's hidden upper overlap.
    addMerged(l, [pleats(0.104, 0.12, 0.52, -0.015, 1.03, 0.94)], NAVY, doubleCloth);
    const seams = [];
    for (const a of [-0.65, 0, 0.65, Math.PI]) {
      const c = Math.cos(a), s = Math.sin(a), fold = 1 + 0.07 * Math.cos(a * 8);
      seams.push(line([0.105 * c * fold * 1.03, 0.237, 0.105 * s * fold * 0.94], [0.121 * c * fold * 1.03, -0.269, 0.121 * s * fold * 0.94], 0.002));
    }
    addMerged(l, seams, FOLD, cloth);
  }
  function shin(g) {
    tint(g, NAVY); const l = layer(g);
    // Shin centre .29 gives local knee=+.21. Start 7cm above it, inside the
    // thigh cloth; preserve the ankle hem. Both pieces keep their own bone.
    addMerged(l, [pleats(0.114, 0.126, 0.4315, 0.06425, 1.03, 0.94, 0.14)], NAVY, doubleCloth);
    addMerged(l, [pleats(0.1265, 0.128, 0.019, -0.145, 1.03, 0.94, 0.14)], WINE, doubleCloth);
    addMerged(l, [pleats(0.128, 0.129, 0.008, -0.152, 1.03, 0.94, 0.14)], VIOLET, doubleCloth);
    addMerged(l, [cyl(0.053, 0.05, 0.057, 12, true, [0, -0.179, 0])], 0xc5bba7, doubleCloth);
  }
  function foot(g) {
    tint(g, 0x232128); const l = layer(g);
    addMerged(l, [box(0.246, 0.015, 0.114, [0, -0.033, 0])], STRAW_DARK, cloth);
    addMerged(l, [line([0.052, 0.041, 0], [-0.027, 0.043, -0.048], 0.007),
      line([0.052, 0.041, 0], [-0.027, 0.043, 0.048], 0.007)], WINE, cloth);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm, thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin, footF: foot, footB: foot };
}
