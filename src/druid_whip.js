// Braided living stems: one rigid grip and eight articulated lash segments.
// Dimensions are fictional game values, shared by the model and colliders.
import * as THREE from 'three';

export const DRUID = Object.freeze({ grip: .26, lash: 1.44, count: 8, mass: .77, handleMass: .21, tipWeight: .12 });
const Y = new THREE.Vector3(0, 1, 0);
const palette = [0x69704a, 0xa59a70, 0x67533c];
export function druidParts() {
  const out = [
    [['box', .023, .13, .023], 0, [.18, 0, .00105, .000065], null, false],
    [['ball', .025], -.135, [.03, 0, .0000075, .0000075], null, false],
  ];
  const L = DRUID.lash / DRUID.count;
  const weights = [1.8, 1.65, 1.5, 1.35, 1.2, 1.05, .9, .75];
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < DRUID.count; i++) {
    // Keep the light cord; concentrate the added root bundle in the final two links.
    const added = i === 7 ? DRUID.tipWeight * .75 : i === 6 ? DRUID.tipWeight * .25 : 0;
    const m = (DRUID.mass - DRUID.handleMass - DRUID.tipWeight) * weights[i] / sum + added;
    const r = i === 7 ? .024 : i === 6 ? .012 : .022 - .016 * i / (DRUID.count - 1);
    out.push([['box', r, L / 2, r], .13 + (i + .5) * L,
      [m, 0, m * (L * L + 4 * r * r) / 12, m * r * r * 2 / 3], null, true]);
  }
  return out;
}

// A single continuous three-strand braid; the runtime bends the SAME mesh to
// follow the physical joints. No rigid invisible blade behind a floppy picture.
export function makeBraid(steps = 72) {
  const sides = 5, vertices = 3 * (steps + 1) * sides;
  const p = new Float32Array(vertices * 3), colors = new Float32Array(vertices * 3), indices = [];
  for (let s = 0; s < 3; s++) {
    const color = new THREE.Color(palette[s]);
    for (let j = 0; j <= steps; j++) for (let k = 0; k < sides; k++) {
      const i = (s * (steps + 1) + j) * sides + k;
      color.toArray(colors, i * 3);
      if (j < steps) { const b = i - k + (k + 1) % sides; indices.push(i, b, i + sides, b, b + sides, i + sides); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .94, metalness: 0 }));
  mesh.castShadow = true; mesh.frustumCulled = false;
  const point = new THREE.Vector3(), tangent = new THREE.Vector3(), n = new THREE.Vector3(), bin = new THREE.Vector3();
  mesh.userData.bend = (points, start = 0, end = 1, handle = false) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, along = start + t * (end - start);
      curve.getPoint(t, point); curve.getTangent(t, tangent).normalize();
      n.set(0, 0, 1); if (Math.abs(n.dot(tangent)) > .95) n.set(1, 0, 0);
      n.addScaledVector(tangent, -n.dot(tangent)).normalize(); bin.crossVectors(tangent, n).normalize();
      // A thicker bound root tip makes the concentrated mass readable.
      const bundle = Math.max(0, Math.min(1, (along - .76) / .14));
      const tipRound = along > .97 ? 1 - .35 * (along - .97) / .03 : 1;
      const radius = handle ? .0195 : (.022 * (1 - .76 * along) + .018 * bundle) * tipRound;
      for (let s = 0; s < 3; s++) {
        const a = (handle ? t * 5 : along * 21) * Math.PI * 2 + s * Math.PI * 2 / 3;
        for (let k = 0; k < sides; k++) {
          const b = k / sides * Math.PI * 2;
          const x = radius * (.60 * Math.cos(a) + .41 * Math.cos(b));
          const z = radius * (.60 * Math.sin(a) + .41 * Math.sin(b));
          const i = ((s * (steps + 1) + j) * sides + k) * 3;
          p[i] = point.x + n.x * x + bin.x * z;
          p[i + 1] = point.y + n.y * x + bin.y * z;
          p[i + 2] = point.z + n.z * x + bin.z * z;
        }
      }
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  };
  return mesh;
}

export function drawDruidWhip(group) {
  const grip = makeBraid(22);
  grip.userData.bend([new THREE.Vector3(0, -.15, 0), new THREE.Vector3(0, .13, 0)], 0, 1, true);
  group.add(grip);
  const lash = makeBraid();
  lash.name = 'druid-lash';
  lash.userData.bend([new THREE.Vector3(0, .13, 0), new THREE.Vector3(.04, .55, 0), new THREE.Vector3(-.09, 1.0, 0), new THREE.Vector3(.14, 1.55, 0)]);
  group.add(lash); group.userData.bladeMesh = lash;
  const bark = new THREE.MeshStandardMaterial({ color: 0x6d573d, roughness: 1 });
  for (const y of [-.12, -.10, .095, .115]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.022, .003, 4, 9), bark);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  }
  for (const side of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, side*.035,.025,.008, side*.065,.075,0, side*.022,.057,-.006], 3));
    geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: side > 0 ? 0x7f8650 : 0x596943, side: THREE.DoubleSide, roughness: 1 }));
    leaf.position.y = .09; group.add(leaf);
  }
}

export function attachDruidWhip(f) {
  const R = f.R, world = f.world, root = f.sword;
  const parts = f.weapon.buildParts({}), L = DRUID.lash / DRUID.count;
  const p0 = new THREE.Vector3().copy(root.translation()), q0 = new THREE.Quaternion().copy(root.rotation());
  const segments = [], joints = [];
  let previous = root;
  for (let i = 0; i < DRUID.count; i++) {
    const part = parts[i + 2], old = f.swordColliders[i + 2], groups = old.collisionGroups();
    f.colliderInfo.delete(old.handle); world.removeCollider(old, true);
    const pos = new THREE.Vector3(0, part[1], 0).applyQuaternion(q0).add(p0);
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(q0)
      .setAngularDamping(1.3).setLinearDamping(.15).setAdditionalSolverIterations(8).setSoftCcdPrediction(.12));
    const [m, , Ie, It] = part[2];
    const col = world.createCollider(R.ColliderDesc.cuboid(part[0][1], L / 2, part[0][3])
      .setMassProperties(m, { x: 0, y: 0, z: 0 }, { x: Ie, y: It, z: Ie }, { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(.65).setRestitution(.08).setCollisionGroups(groups)
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.1), body);
    const state = {};
    const info = { fighter: f, kind: 'weapon', part: 'blade', body, flexible: true, state,
      props: { m, I: { x: Ie, y: It, z: Ie }, frame: new THREE.Quaternion() } };
    f.colliderInfo.set(col.handle, info);
    f.swordColliders[i + 2] = col; f.bladeColliders[i] = col;
    const joint = world.createImpulseJoint(R.JointData.spherical({ x: 0, y: i === 0 ? .13 : L / 2, z: 0 }, { x: 0, y: -L / 2, z: 0 }), previous, body, true);
    joint.setContactsEnabled(false); joints.push(joint);
    const group = new THREE.Group(); f.scene.add(group); f.meshes.push({ rb: body, group, kind: 'weapon-flex' });
    segments.push({ body, col, state, info, group }); previous = body;
  }
  root.recomputeMassPropertiesFromColliders();
  const flex = { segments, joints, active: DRUID.count, L };
  const lash = f.swordGroup.userData.bladeMesh;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), torque = new THREE.Vector3();
  flex.step = dt => {
    for (let i = 0; i < segments.length; i++) {
      const parent = i === 0 ? root : segments[i - 1].body, child = segments[i].body;
      qa.copy(parent.rotation()); qb.copy(child.rotation());
      a.copy(Y).applyQuaternion(qa); b.copy(Y).applyQuaternion(qb);
      // Small bend stiffness, equal-and-opposite physical torque. No aim lock or damage bonus.
      torque.crossVectors(b, a).multiplyScalar(.035 * (1 - i / 10));
      child.addTorque(torque, true); parent.addTorque({ x: -torque.x, y: -torque.y, z: -torque.z }, true);
    }
  };
  flex.cache = put => { for (const s of segments) put(s.body, s.state); };
  flex.point = (t, out) => {
    const u = THREE.MathUtils.clamp(t, 0, 1) * flex.active;
    const i = Math.min(flex.active - 1, Math.floor(u));
    const body = segments[i].body;
    return out.set(0, (u - i - .5) * L, 0).applyQuaternion(qb.copy(body.rotation())).add(a.copy(body.translation()));
  };
  const inv = new THREE.Matrix4(), points = [];
  flex.sync = () => {
    f.swordGroup.updateMatrixWorld(true); inv.copy(f.swordGroup.matrixWorld).invert(); points.length = 0;
    points.push(new THREE.Vector3(0, .13, 0));
    for (let i = 0; i < flex.active; i++) points.push(new THREE.Vector3(0, L / 2, 0).applyQuaternion(qb.copy(segments[i].body.rotation())).add(a.copy(segments[i].body.translation())).applyMatrix4(inv));
    lash.userData.bend(points, 0, flex.active / DRUID.count);
  };
  return flex;
}
