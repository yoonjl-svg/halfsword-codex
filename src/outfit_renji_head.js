// Renji's uneven, side-swept hair and low seated straw hat. +X is forward.
// The native face, eye boxes, nose and their transforms remain untouched.
export function createRenjiHead(h) {
  const { THREE, bake, cyl, addMerged, CLOTH, isoldeLock, artoriaCloth } = h;
  const STRAW = 0xb9a477, WEAVE = 0x80704d;
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.96 };
  const hatRadius = 0.29, hatApex = 0.132, hatBrim = 0.006, hatPitch = 0.18;

  function line(a, b, radius = 0.0014, sides = 4) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const axis = to.clone().sub(from);
    const geo = new THREE.CylinderGeometry(radius, radius, axis.length(), sides);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
    geo.translate(...from.add(to).multiplyScalar(0.5).toArray());
    return geo;
  }
  function hatTilt(geo) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + p.getX(i) * hatPitch);
    geo.computeVertexNormals();
    return geo;
  }
  const hatY = (r) => hatApex + (hatBrim - hatApex) * r / hatRadius;
  function tuckUnderHat(geo, offset = [0, 0, 0]) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + offset[0], z = p.getZ(i) + offset[2];
      const ceiling = hatY(Math.hypot(x, z)) + x * hatPitch - 0.002 - offset[1];
      p.setY(i, Math.min(p.getY(i), ceiling));
    }
    geo.computeVertexNormals();
    return geo;
  }
  function fringeBacking() {
    // A thin forehead-following layer joins the fringe at its roots. Its lower
    // edge rises over the open eye and slopes down toward the swept side.
    const edge = [1.40, 1.31, 1.27, 1.20, 1.24, 1.33, 1.35, 1.45, 1.51];
    const columns = 24, rows = 6, vertices = [], uv = [], indices = [];
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      for (let col = 0; col <= columns; col++) {
        const u = col / columns, a = -1.12 + u * 2.2;
        const sample = u * (edge.length - 1), k = Math.min(edge.length - 2, Math.floor(sample));
        const bottom = THREE.MathUtils.lerp(edge[k], edge[k + 1], sample - k);
        const theta = THREE.MathUtils.lerp(0.56, bottom, t), r = 0.112;
        vertices.push(-0.005 + r * Math.sin(theta) * Math.cos(a), 0.007 + r * Math.cos(theta), r * Math.sin(theta) * Math.sin(a));
        uv.push(u, t);
        if (row < rows && col < columns) {
          const n = row * (columns + 1) + col;
          indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }

  return function head(g, look) {
    const layer = artoriaCloth(g, 'renji-head'), cap = g.children[4];
    const HAIR = look.hair ?? 0x241d16;
    if (cap?.geometry?.type === 'SphereGeometry') {
      const geo = new THREE.SphereGeometry(0.109, 28, 14, 0, Math.PI * 2, 0, 2.15);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const t = Math.acos(THREE.MathUtils.clamp(p.getY(i) / 0.109, -1, 1)) / 2.15;
        const front = Math.max(0, Math.cos(a));
        // The hidden crown has a high, broken frontal hairline. The individual
        // fringe tips below it determine the silhouette, never a circular hem.
        const edge = 2.02 - 1.15 * front + 0.075 * Math.sin(a * 5 + 0.7);
        const theta = t * edge, r = 0.109 + 0.0015 * Math.sin(a * 7) * t;
        p.setXYZ(i, r * Math.sin(theta) * Math.cos(a), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(a));
      }
      // Use the cap's eventual local offset when seating its crown below straw.
      tuckUnderHat(geo, [-0.005, 0.007, 0]);
      cap.geometry.dispose(); cap.geometry = geo;
      cap.position.set(-0.005, 0.007, 0); cap.rotation.set(0, 0, 0);
      cap.material.color.setHex(HAIR); cap.material.roughness = 0.94;
    }

    // Connected roots and four unequal short tips retain the tidy side part.
    // A narrow right-side tip lightly overlaps the original eye box.
    const locks = [
      fringeBacking(),
      isoldeLock([[0.039, 0.105, -0.069], [0.082, 0.075, -0.06], [0.101, 0.039, -0.049], [0.098, 0.012, -0.06]], [0.032, 0.04, 0.026, 0.001], 0.007),
      isoldeLock([[0.025, 0.111, -0.057], [0.083, 0.083, -0.035], [0.104, 0.047, -0.013], [0.108, 0.028, -0.006]], [0.036, 0.043, 0.028, 0.001], 0.007),
      isoldeLock([[0.022, 0.113, -0.045], [0.081, 0.088, -0.011], [0.106, 0.043, 0.026], [0.105, 0.002, 0.051]], [0.038, 0.048, 0.025, 0.001], 0.007),
      isoldeLock([[-0.013, 0.108, -0.015], [0.06, 0.085, 0.053], [0.084, 0.037, 0.077], [0.064, -0.035, 0.094]], [0.04, 0.048, 0.028, 0.001], 0.008),
    ];
    for (const s of [-1, 1]) {
      const extra = s === 1 ? 0.006 : 0;
      for (let i = 0; i < 2; i++) {
        locks.push(isoldeLock([
          [0.034 - i * 0.073, 0.067 - i * 0.008, s * (0.082 + i * 0.003)],
          [0.038 - i * 0.083, 0.001, s * (0.098 + i * 0.002)],
          [0.025 - i * 0.079, -0.0376, s * (0.101 + i * 0.001)],
          [0.039 - i * 0.083, (-0.077 - extra - i * 0.013) * 0.8, s * (0.089 + i * 0.008)],
        ], [0.026, 0.028, 0.023, 0.002], 0.011));
      }
    }
    for (let i = -1; i <= 1; i++) {
      locks.push(isoldeLock([
        [-0.064, 0.081, i * 0.038], [-0.109, 0.009, i * 0.048],
        [-0.107, -0.047, i * 0.048], [-0.091 + Math.abs(i) * 0.006, -0.094 + Math.abs(i) * 0.01, i * 0.05 + 0.004],
      ], [0.042, 0.052, 0.041, 0.002], 0.01));
    }
    const hair = addMerged(layer, locks.map((geo) => tuckUnderHat(geo)), HAIR, { ...cloth, roughness: 0.91 });
    hair.name = 'renji-layered-hair';

    // The old apex was .238m and brim .081m: the cone now seats against the
    // rear crown. Forward pitch lifts the front brim to .058m, above the eyes.
    const cone = cyl(0.002, hatRadius, hatApex - hatBrim, 48, true, [0, (hatApex + hatBrim) / 2, 0]);
    const rim = bake(new THREE.TorusGeometry(hatRadius, 0.003, 4, 48), [0, hatBrim, 0], [Math.PI / 2, 0, 0]);
    const hat = addMerged(layer, [hatTilt(cone), hatTilt(rim)], STRAW, { ...cloth, side: THREE.DoubleSide });
    hat.name = 'renji-seated-straw-hat';
    const weave = [];
    for (let i = 0; i < 28; i++) {
      const a = i * Math.PI / 14, c = Math.cos(a), s = Math.sin(a);
      weave.push(hatTilt(line([0.007 * c, hatY(0.007) + 0.0008, 0.007 * s], [0.288 * c, hatY(0.288) + 0.0008, 0.288 * s], 0.0009)));
    }
    for (const r of [0.085, 0.17, 0.248, 0.279]) {
      weave.push(hatTilt(bake(new THREE.TorusGeometry(r, 0.0008, 3, 48), [0, hatY(r) + 0.0008, 0], [Math.PI / 2, 0, 0])));
    }
    for (const s of [-1, 1]) {
      weave.push(line([0.012, 0.067, s * 0.126], [0.06, -0.082, s * 0.076], 0.0015));
      weave.push(line([0.06, -0.082, s * 0.076], [0.039, -0.11, 0], 0.0015));
    }
    addMerged(layer, weave, WEAVE, cloth);
  };
}
