// Ratna's working clothes and river tools. +X front, +Y up, +Z right.
// Every layer belongs to one native ragdoll part; the paddle is one rigid prop.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function createRatnaOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth, artoriaRoundedBox } = h;
  const CREAM = 0xded2b4, FOLD = 0xb9a98a, LIGHT = 0xe9dec4;
  const RUST = 0x884936, RUST_EDGE = 0xb07351, TEAL = 0x264e4d, TEAL_EDGE = 0x3c6360;
  const WOOD = 0x785039, GRAIN = 0x493326, LEATHER = 0x45362b, ROPE = 0xa38b62;
  const BRASS = 0xa18a53, SALT = 0x93958a;
  const cloth = { ...CLOTH, roughness: 0.97, metalness: 0 };
  const twoSided = { ...cloth, side: THREE.DoubleSide };
  const bronze = { roughness: 0.72, metalness: 0.35 };
  const layer = (g, name = 'fabric') => artoriaCloth(g, `ratna-${name}`);
  function tint(g, color) {
    const m = g.children[0].material;
    m.color.setHex(color); m.roughness = 0.97; m.metalness = 0;
  }
  function torso(g, color, radius) {
    // Preserve representative mesh and geometry identity for wound rendering.
    for (const child of g.children.slice(1)) child.visible = false;
    const { width, height, depth } = g.children[0].geometry.parameters;
    const geo = artoriaRoundedBox(width, height, depth, radius);
    g.children[0].geometry.copy(geo); geo.dispose(); tint(g, color);
  }
  function line(a, b, radius = 0.002, sides = 6) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const geo = new THREE.CylinderGeometry(radius, radius, delta.length(), sides);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    geo.translate(...start.add(end).multiplyScalar(0.5).toArray()); return geo;
  }
  function garment(rows) {
    // Open cuffs; a little garment ease makes the silhouette sturdy without
    // enlarging the underlying body or stretching fabric across two joints.
    return new THREE.LatheGeometry(rows.map(([y, r]) => new THREE.Vector2(r, y)), 18);
  }
  function panel(x, yz) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(yz.flatMap(([y, z]) => [x, y, z]), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(yz.flatMap(([y, z]) => [z, y]), 2));
    const indices = [];
    for (let i = 1; i < yz.length - 1; i++) indices.push(0, i, i + 1);
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function headV1(g, look) {
    // Only hair is reshaped. Native face sphere, eyes and nose stay untouched.
    // Start with an open cap so the remapped hairline keeps both triangles in
    // every bottom cell (a full sphere omits one at its collapsed south pole).
    const cap = g.children[4], geo = new THREE.SphereGeometry(0.107, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.67);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / 19) / 10;
      const theta = t * Math.PI * (0.65 - 0.28 * Math.max(0, Math.cos(a)));
      p.setXYZ(i, 0.108 * Math.sin(theta) * Math.cos(a), 0.108 * Math.cos(theta), 0.108 * Math.sin(theta) * Math.sin(a));
    }
    geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
    cap.position.set(-0.008, 0.006, 0); cap.rotation.set(0, 0, 0);
    const dark = [], grey = [];
    // Small rounded curls over a continuous cap, with salt at the temples.
    for (let row = 0; row < 3; row++) {
      const count = [7, 11, 15][row], theta = [0.28, 0.66, 1.04][row];
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + row * 0.19;
        const r = 0.109, x = -0.008 + r * Math.sin(theta) * Math.cos(a);
        const y = 0.006 + r * Math.cos(theta), z = r * Math.sin(theta) * Math.sin(a);
        (row === 2 && Math.abs(Math.sin(a)) > 0.7 || i % 6 === 0 ? grey : dark)
          .push(bake(ball(0.02, 8, 6), [x, y, z], null, [1, 0.65, 1]));
      }
    }
    for (const s of [-1, 1]) {
      grey.push(bake(ball(0.023, 8, 6), [-0.005, 0.009, s * 0.099], null, [0.65, 1.3, 0.45]));
      dark.push(bake(ball(0.021, 8, 6), [0.055, -0.05, s * 0.067], null, [0.65, 1.1, 0.85]));
      grey.push(bake(ball(0.018, 8, 6), [0.072, -0.067, s * 0.04], null, [0.75, 0.65, 1.2]));
      dark.push(box(0.006, 0.005, 0.029, [0.099, 0.034, s * 0.035], [s * -0.055, 0, 0]));
      dark.push(bake(ball(0.016, 8, 6), [0.096, -0.039, s * 0.015], null, [0.32, 0.35, 1.2]));
    }
    dark.push(bake(ball(0.025, 10, 6), [0.054, -0.086, 0], null, [1.1, 0.5, 1.45]));
    grey.push(bake(ball(0.014, 8, 6), [0.071, -0.081, 0.008], null, [0.65, 0.5, 1.3]));
    addMerged(layer(g, 'hair'), dark, look.hair, cloth);
    addMerged(layer(g, 'hair'), grey, SALT, cloth);
  }
  function head(g, look) {
    if (!(look.ratnaRevision >= 2)) return headV1(g, look);
    const cap = g.children[4], segments = 24, rings = 14;
    const geo = new THREE.SphereGeometry(0.108, segments, rings, 0, Math.PI * 2, 0, Math.PI * 0.67);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / (segments + 1)) / rings;
      const theta = t * Math.PI * (0.65 - 0.28 * Math.max(0, Math.cos(a)));
      const r = 0.108 + 0.002 * Math.sin(a * 11 + t * 7) * Math.sin(theta);
      p.setXYZ(i, r * Math.sin(theta) * Math.cos(a), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(a));
    }
    geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
    cap.position.set(-0.008, 0.006, 0); cap.rotation.set(0, 0, 0);
    const curls = [], beard = [], grey = [];
    const scalp = (a, theta) => new THREE.Vector3(-0.008 + 0.111 * Math.sin(theta) * Math.cos(a),
      0.006 + 0.111 * Math.cos(theta), 0.111 * Math.sin(theta) * Math.sin(a));
    // Fine dark arcs sit against a continuous short cap: grey never becomes
    // a separate pale lump, and the native face/eye/nose meshes are untouched.
    if (look.ratnaRevision >= 3) {
      const raised = [], ridges = [], silver = [];
      let curlIndex = 0;
      // Close-packed little spiral knots, rising less than 2 cm from the cap.
      // The tapered spiral follows each rounded tuft instead of making a
      // loose mane, tall topknot or pale patches over the crown.
      for (const [theta, count] of [[0.18, 4], [0.45, 9], [0.75, 14], [1.04, 17], [1.35, 17], [1.66, 17], [1.88, 12]]) {
        for (let i = 0; i < count; i++) {
          const a = i / count * Math.PI * 2 + theta * 0.63;
          const hairline = Math.PI * (0.65 - 0.28 * Math.max(0, Math.cos(a)));
          if (theta + 0.085 > hairline) continue;
          const normal = new THREE.Vector3(Math.sin(theta) * Math.cos(a), Math.cos(theta), Math.sin(theta) * Math.sin(a));
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
          const at = normal.clone().multiplyScalar(0.107).add(new THREE.Vector3(-0.008, 0.006, 0));
          const place = geo => geo.applyQuaternion(q).translate(...at.toArray());
          raised.push(place(bake(ball(0.011, 8, 5), [0, 0.008, 0], null, [1, 0.9, 1])));
          const points = [];
          for (let j = 0; j <= 7; j++) {
            const t = j / 7, y = 0.002 + t * 0.0145, turn = t * Math.PI * 2.3 + a;
            const r = 0.011 * Math.sqrt(Math.max(0, 1 - ((y - 0.008) / 0.0099) ** 2)) + 0.0006;
            points.push(new THREE.Vector3(Math.cos(turn) * r, y, Math.sin(turn) * r));
          }
          const gray = curlIndex++ % 17 === 8;
          (gray ? silver : ridges).push(place(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 7, gray ? 0.0007 : 0.0011, 4, false)));
        }
      }
      addMerged(layer(g, 'curls'), raised, look.hair, cloth);
      addMerged(layer(g, 'curls'), ridges, 0x48443a, cloth);
      addMerged(layer(g, 'curls'), silver, 0x858477, cloth);
    } else {
      for (const [theta, count] of [[0.35, 6], [0.67, 9], [1.0, 12]]) for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + theta;
        const points = [scalp(a - 0.12, theta + 0.025), scalp(a, theta - 0.065),
          scalp(a + 0.13, theta - 0.025), scalp(a + 0.08, theta + 0.04)];
        curls.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 6, 0.0026, 4, false));
      }
    }
    for (const s of [-1, 1]) {
      beard.push(bake(ball(0.021, 8, 6), [0.055, -0.05, s * 0.067], null, [0.65, 1.1, 0.85]),
        bake(ball(0.018, 8, 6), [0.072, -0.067, s * 0.04], null, [0.75, 0.65, 1.2]),
        box(0.006, 0.005, 0.029, [0.099, 0.034, s * 0.035], [s * -0.055, 0, 0]),
        bake(ball(0.016, 8, 6), [0.096, -0.039, s * 0.015], null, [0.32, 0.35, 1.2]));
      for (let i = 0; i < 3; i++) {
        const x = -0.022 + i * 0.012, z = s * (0.107 - i * 0.001);
        grey.push(line([x, 0.011, z], [x + 0.003, 0.031, z - s * 0.003], 0.0008, 4));
      }
      grey.push(line([0.079, -0.063, s * 0.039], [0.073, -0.075, s * 0.031], 0.0007, 4));
    }
    beard.push(bake(ball(0.025, 10, 6), [0.054, -0.086, 0], null, [1.1, 0.5, 1.45]));
    addMerged(layer(g, 'hair'), curls, 0x3a382f, cloth);
    addMerged(layer(g, 'hair'), beard, look.hair, cloth);
    addMerged(layer(g, 'hair'), grey, 0x83867b, cloth);
  }
  function shoulderMonkey(g, look) {
    // One seated companion on the left shoulder. Its complete silhouette,
    // including the curled tail, follows the chest, never the head or arm.
    const l = layer(g, 'monkey'), fur = [], light = [], dark = [];
    l.position.set(0, look.ratnaRevision >= 3 ? -0.025 : -0.044, look.ratnaRevision >= 3 ? 0.03 : 0);
    const brown = 0x70513a, pale = 0xb89168;
    fur.push(bake(ball(0.048, 12, 8), [-0.025, 0.211, -0.225], [0, 0, 0.17], [0.85, 1.26, 0.85]),
      bake(ball(0.041, 12, 8), [0.019, 0.303, -0.232], null, [0.98, 1.04, 1]),
      bake(ball(0.034, 10, 6), [-0.027, 0.174, -0.227], null, [1.2, 0.77, 1.08]),
      line([-0.004, 0.249, -0.23], [0.012, 0.282, -0.232], 0.025, 10));
    for (const s of [-1, 1]) {
      const z = -0.232 + s * 0.027;
      const footZ = look.ratnaRevision >= 3 ? -0.207 + s * 0.012 : -0.218 + s * 0.016;
      const footY = 0.147 + (look.ratnaRevision >= 3 ? (s === 1 ? 0.012 : -0.023) : 0);
      fur.push(bake(ball(0.024, 8, 6), [0.009, 0.17, z], null, [1.2, 0.8, 0.85]),
        line([0.002, 0.239, z], [0.051, 0.191, z - s * 0.003], 0.011),
        line([0.051, 0.191, z - s * 0.003], [0.059, 0.16, z], 0.009),
        line([0.018, 0.164, z], [0.03, footY + 0.001, footZ], 0.008),
        bake(ball(0.018, 10, 6), [0.022, 0.307, -0.232 + s * 0.05], null, [0.5, 1, 0.86]));
      light.push(bake(ball(0.011, 8, 6), [0.03, 0.307, -0.232 + s * 0.05], null, [0.3, 0.85, 0.8]),
        bake(ball(0.02, 10, 6), [0.052, 0.306, -0.232 + s * 0.014], null, [0.48, 1.1, 0.85]),
        bake(ball(0.013, 8, 6), [0.062, 0.154, z], null, [1.2, 0.4, 0.7]),
        bake(ball(0.012, 8, 6), [0.03, footY, footZ], null, [1.5, 0.4, 0.75]));
      dark.push(ball(0.0037, 8, 6, [0.064, 0.313, -0.232 + s * 0.015]));
    }
    light.push(bake(ball(0.022, 10, 6), [0.018, 0.216, -0.225], null, [0.22, 1.6, 1.3]),
      bake(ball(0.018, 10, 6), [0.063, 0.292, -0.232], null, [0.48, 0.65, 1]));
    dark.push(bake(ball(0.007, 8, 6), [0.073, 0.296, -0.232], null, [0.5, 0.5, 1]),
      line([0.072, 0.286, -0.24], [0.072, 0.286, -0.224], 0.0014, 4));
    const tail = new THREE.CatmullRomCurve3([[-0.066, 0.18, -0.24], [-0.112, 0.15, -0.255],
      [-0.145, 0.103, -0.255], [-0.139, 0.052, -0.244], [-0.113, 0.045, -0.228],
      [-0.107, 0.069, -0.218]].map(p => new THREE.Vector3(...p)));
    fur.push(new THREE.TubeGeometry(tail, 14, 0.007, 6, false));
    addMerged(l, fur, brown, cloth); addMerged(l, light, pale, cloth); addMerged(l, dark, 0x28221c, cloth);
  }
  function paddle(g) {
    const l = layer(g, 'paddle'), angle = -0.46;
    // Build in its own frame, then bake the whole wooden paddle diagonally
    // across the back. It has no collider and never becomes a second weapon.
    const place = geo => bake(geo, [-0.158, 0.015, 0], [angle, 0, 0]);
    const blade = artoriaRoundedBox(0.022, 0.31, 0.132, 0.009);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const t = (bp.getY(i) + 0.155) / 0.31;
      bp.setZ(i, bp.getZ(i) * (0.63 + 0.37 * Math.sin(t * Math.PI)));
    }
    blade.computeVertexNormals(); blade.translate(0, -0.407, 0);
    addMerged(l, [place(blade), place(cyl(0.012, 0.014, 0.85, 10, false, [0, 0.083, 0])),
      place(bake(artoriaRoundedBox(0.027, 0.026, 0.105, 0.009), [0, 0.516, 0]))], WOOD, cloth);
    addMerged(l, [-0.027, 0.002, 0.032].map(z => place(line([-0.012, -0.53, z * 0.6], [-0.012, -0.285, z], 0.0012, 4))), GRAIN, cloth);
    addMerged(l, [-0.192, -0.173, -0.154].map(y => place(cyl(0.015, 0.015, 0.008, 10, true, [0, y, 0]))), ROPE, twoSided);
  }
  function chest(g, look) {
    torso(g, CREAM, 0.041); const l = layer(g);
    addMerged(l, [cyl(0.041, 0.046, 0.055, 12, false, [0, 0.169, 0]),
      panel(0.122, [[0.14, -0.039], [0.14, 0.039], [0.07, 0]])], look.skin, twoSided);
    addMerged(l, [panel(0.126, [[0.146, -0.074], [0.153, -0.031], [0.071, -0.008], [0.091, -0.048]]),
      panel(0.126, [[0.146, 0.074], [0.153, 0.031], [0.071, 0.008], [0.091, 0.048]]),
      box(0.006, 0.176, 0.018, [0.123, -0.026, 0])], LIGHT, twoSided);
    addMerged(l, [-0.011, -0.061, -0.11].map(y => ball(0.004, 6, 4, [0.128, y, 0])), FOLD, cloth);
    addMerged(l, [line([0.117, 0.089, -0.137], [0.126, -0.126, -0.112]),
      line([0.117, 0.076, 0.135], [0.126, -0.126, 0.106])], FOLD, cloth);
    // One strap, attached only to the chest, secures the rigid back paddle.
    addMerged(l, [box(0.008, 0.35, 0.021, [0.128, 0, 0], [0.7, 0, 0]),
      box(0.008, 0.35, 0.021, [-0.137, 0, 0], [0.7, 0, 0])], LEATHER, cloth);
    paddle(g);
    if (look.ratnaRevision >= 2) shoulderMonkey(g, look);
  }
  function abdomen(g) {
    torso(g, CREAM, 0.026); const l = layer(g);
    addMerged(l, [bake(artoriaRoundedBox(0.233, 0.057, 0.337, 0.017), [0, -0.044, 0])], RUST, cloth);
    addMerged(l, [-0.06, -0.031].map(y => box(0.004, 0.006, 0.29, [0.119, y, 0])), RUST_EDGE, cloth);
  }
  function pelvis(g, look) {
    torso(g, look.hoseUpper, 0.026); const l = layer(g);
    addMerged(l, [bake(artoriaRoundedBox(0.224, 0.083, 0.348, 0.017), [0, 0.058, 0]),
      panel(0.12, [[0.078, -0.15], [0.079, -0.018], [-0.094, 0.018], [-0.069, -0.086]]),
      bake(ball(0.027, 10, 6), [0.124, 0.034, -0.089], null, [0.45, 0.6, 1])], RUST, twoSided);
    addMerged(l, [line([0.123, 0.07, -0.143], [0.123, -0.062, -0.083], 0.0025),
      line([0.122, 0.07, -0.019], [0.122, -0.086, 0.014], 0.0025)], RUST_EDGE, cloth);
    // Folded waxed chart, held close to the right hip. Fold/route markings
    // communicate a map without tiny text or a hanging panel across the legs.
    const map = layer(g, 'map');
    addMerged(map, [bake(artoriaRoundedBox(0.019, 0.099, 0.072, 0.004), [0.125, 0.003, 0.119], [0.1, 0, 0])], 0xc5b594, cloth);
    addMerged(map, [line([0.137, -0.037, 0.113], [0.137, 0.04, 0.113], 0.0012),
      line([0.137, 0.027, 0.092], [0.137, 0.009, 0.126], 0.0015),
      line([0.137, 0.009, 0.126], [0.137, -0.022, 0.137], 0.0015)], TEAL_EDGE, cloth);
    addMerged(map, [box(0.024, 0.017, 0.081, [0.126, -0.015, 0.119])], LEATHER, cloth);
    const weight = layer(g, 'sounding-weight');
    addMerged(weight, [line([0.039, 0.062, -0.187], [0.039, -0.058, -0.187], 0.0035),
      bake(new THREE.TorusGeometry(0.019, 0.0035, 5, 12), [0.035, 0.037, -0.187], [0, Math.PI / 2, 0])], ROPE, cloth);
    addMerged(weight, [cyl(0.01, 0.018, 0.05, 10, false, [0.039, -0.078, -0.187]),
      cyl(0.019, 0.019, 0.009, 10, false, [0.039, -0.099, -0.187])], BRASS, bronze);
  }
  function upperArm(g, look) {
    tint(g, look.skin); const l = layer(g);
    // Include the visible sleeve in the native wound target, so cuts project
    // onto cream fabric instead of being hidden on skin underneath it.
    // Follow the native rounded shoulder with a small cloth allowance: a
    // straight taper here lets the skin capsule pierce the upper sleeve.
    const sleeve = garment([[-0.103, 0.058], [-0.043, 0.066], [0.07, 0.067],
      [0.105, 0.061], [0.135, 0.052], [0.159, 0.026], [0.176, 0]]);
    const main = g.children[0], parameters = main.geometry.parameters;
    const merged = mergeGeometries([main.geometry, sleeve], true);
    main.geometry.copy(merged); main.geometry.parameters = parameters;
    sleeve.dispose(); merged.dispose();
    main.material = [main.material, new THREE.MeshStandardMaterial({ color: CREAM, ...twoSided })];
    addMerged(l, [garment([[-0.119, 0.058], [-0.108, 0.066], [-0.09, 0.066], [-0.077, 0.061]])], LIGHT, twoSided);
    addMerged(l, [cyl(0.065, 0.065, 0.005, 18, true, [0, -0.098, 0])], FOLD, twoSided);
  }
  function forearm(g, look) { tint(g, look.skin); }
  function thigh(g, look) {
    const geo = garment([[-0.218, 0.065], [-0.182, 0.074], [-0.032, 0.091], [0.143, 0.089], [0.219, 0.069]]);
    const parameters = g.children[0].geometry.parameters;
    g.children[0].geometry.copy(geo); g.children[0].geometry.parameters = parameters;
    geo.dispose(); tint(g, look.hoseUpper);
    g.children[0].material.side = THREE.DoubleSide;
    addMerged(layer(g), [cyl(0.069, 0.069, 0.023, 18, true, [0, -0.207, 0])], look.trouserSeam ?? TEAL_EDGE, twoSided);
  }
  function shin(g, look) {
    tint(g, look.skin);
    // A short cuff follows each shin independently; the lower calves are bare.
    // Close just the upper end so a bent knee cannot expose the skin cap
    // through the open cuff. This still belongs solely to the native shin.
    addMerged(layer(g), [garment([[0.153, 0.062], [0.171, 0.069], [0.228, 0.067], [0.234, 0]])], look.hoseUpper, twoSided);
    addMerged(layer(g), [cyl(0.065, 0.065, 0.01, 18, true, [0, 0.157, 0])], look.trouserSeam ?? TEAL_EDGE, twoSided);
  }
  function foot(g, look) {
    tint(g, look.skin); const l = layer(g);
    const geo = artoriaRoundedBox(0.25, 0.075, 0.11, 0.018);
    g.children[0].geometry.copy(geo); geo.dispose();
    if (look.ratnaRevision >= 2) {
      const shoes = layer(g, 'reed-shoe');
      addMerged(shoes, [bake(artoriaRoundedBox(0.31, 0.019, 0.161, 0.008), [0.008, -0.036, 0])], look.shoes, cloth);
      const reeds = [];
      for (let i = 0; i < 10; i++) {
        const x = -0.127 + i * 0.03, width = 0.151 - 0.012 * Math.abs(i - 4.5) / 4.5;
        reeds.push(line([x, -0.024, -width / 2], [x, -0.024, width / 2], 0.0021, 5));
      }
      addMerged(shoes, reeds, 0xd3bc86, cloth);
      addMerged(shoes, [-1, 1].map(s => line([-0.123, -0.023, s * 0.058], [0.145, -0.023, s * 0.058], 0.0025, 5)), ROPE, cloth);
      addMerged(shoes, [box(0.031, 0.009, 0.118, [0.058, 0.039, 0]),
        box(0.027, 0.009, 0.116, [-0.042, 0.039, 0]),
        ...[-1, 1].flatMap(s => [line([0.058, 0.04, s * 0.052], [0.061, -0.022, s * 0.067], 0.007, 6),
          line([-0.042, 0.04, s * 0.052], [-0.044, -0.022, s * 0.066], 0.006, 6)])], LEATHER, cloth);
      return;
    }
    addMerged(l, [bake(artoriaRoundedBox(0.257, 0.015, 0.116, 0.005), [0, -0.037, 0]),
      box(0.028, 0.009, 0.11, [0.059, 0.039, 0]),
      box(0.026, 0.009, 0.11, [-0.04, 0.039, 0]),
      ...[-1, 1].flatMap(s => [box(0.026, 0.06, 0.008, [-0.04, 0.009, s * 0.055]),
        box(0.028, 0.06, 0.008, [0.059, 0.009, s * 0.055])])], LEATHER, cloth);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm, thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin, footF: foot, footB: foot };
}
