import { Vector3 } from 'three';
// One terrain contract for rendering, Rapier, foot placement and AI navigation.
// +z is downhill. Broad folds and shorter lips vary the local grade without
// terraces or steps. The horizontal lava shoreline stays at z=5.25.
const degrees = 10;
const slope = Math.tan(degrees * Math.PI / 180);
export const ETNA = Object.freeze({ slope, degrees, lavaEdgeZ: 5.25, lavaLevel: -slope * 5.25, profile: 'irregular-v3' });
const fold = (x, z) => .085 * Math.sin(1.05 * z + .65 * Math.sin(.6 * x)) + .022 * Math.sin(2.4 * z - .4 * x);
const vertexHeight = (x, z) => Math.fround(-slope * z + fold(x, z) - fold(x, ETNA.lavaEdgeZ));
// The same triangles are used for rendering, collision, height and foot normal.
// Finer cells cover the entire arena and camera orbit; distant cells are coarse.
const axis = [];
for (let p = -56; p <= 56; p += Math.abs(p + .01) < 12 ? .5 : Math.abs(p + .01) < 30 ? 1 : 2) axis.push(p);
const zAxis = [...axis, ETNA.lavaEdgeZ].sort((a, b) => a - b);
const heights = Float32Array.from(zAxis.flatMap(z => axis.map(x => vertexHeight(x, z))));
function cell(values, p) {
  let lo = 0, hi = values.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (values[mid] <= p) lo = mid; else hi = mid; }
  return lo;
}
function facet(x, z) {
  const i = cell(axis, x), j = cell(zAxis, z), dx = axis[i + 1] - axis[i], dz = zAxis[j + 1] - zAxis[j];
  const u = (x - axis[i]) / dx, v = (z - zAxis[j]) / dz, a = j * axis.length + i;
  const ha = heights[a], hb = heights[a + 1], hc = heights[a + axis.length], hd = heights[a + axis.length + 1];
  if (u + v <= 1) return { y: ha + u * (hb - ha) + v * (hc - ha), dx: (hb - ha) / dx, dz: (hc - ha) / dz };
  return { y: hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd), dx: (hd - hc) / dx, dz: (hd - hb) / dz };
}
export const etnaHeight = (x, z) => facet(x, z).y;
export function etnaNormal(x, z) {
  const f = facet(x, z), length = Math.hypot(f.dx, 1, f.dz);
  return { x: -f.dx / length, y: 1 / length, z: -f.dz / length };
}
export function etnaGroundMesh(extent = 30) {
  const xs = axis.filter(x => Math.abs(x) <= extent), zs = zAxis.filter(z => Math.abs(z) <= extent);
  const vertices = new Float32Array(xs.length * zs.length * 3), indices = [];
  let i = 0;
  for (const z of zs) for (const x of xs) { vertices[i++] = x; vertices[i++] = vertexHeight(x, z); vertices[i++] = z; }
  for (let row = 0; row < zs.length - 1; row++) for (let col = 0; col < xs.length - 1; col++) {
    const a = row * xs.length + col, c = a + xs.length;
    indices.push(a, c, a + 1, a + 1, c, c + 1);
  }
  return { vertices, indices: new Uint32Array(indices) };
}
export const ETNA_TERRAIN = Object.freeze({ id: 'etna', heightAt: etnaHeight, normalAt: etnaNormal, ...ETNA });
export const terrainForStage = id => id === 'etna' ? ETNA_TERRAIN : null;

/** Flat stages retain collider creation order, dimensions and friction. */
export function createArenaGround(R, world, groups, { stageId = null, radius = 6.5, walls = true } = {}) {
  const terrain = terrainForStage(stageId), ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  if (terrain) {
    const { vertices, indices } = etnaGroundMesh();
    world.createCollider(R.ColliderDesc.trimesh(vertices, indices).setFriction(0.9).setCollisionGroups(groups), ground);
  } else {
    world.createCollider(R.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(groups), ground);
  }
  const n = 32, r = radius + 0.25;
  for (let i = 0; i < (walls ? n : 0); i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    world.createCollider(R.ColliderDesc.cuboid(0.2, 0.6, r * Math.tan(Math.PI / n) + 0.05)
      .setTranslation(x, 0.6 + (terrain ? etnaHeight(x, z) : 0), z)
      .setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) }).setCollisionGroups(groups), ground);
  }
  // The fluid is a sensor, not a force/barrier. Its top exactly matches the
  // visible horizontal lava. The continuing rock slope remains underneath.
  const lava = terrain ? world.createCollider(R.ColliderDesc.cuboid(30, 5, 30)
    .setTranslation(0, ETNA.lavaLevel - 5, ETNA.lavaEdgeZ + 30).setSensor(true).setCollisionGroups(groups), ground) : null;
  return { world, ground, lava, terrain };
}

// A game damage model, not a medical timescale. The existing pain HUD and
// damaged-limb/getup controller provide feedback; no forced screen overlay.
export const LAVA_BURN = Object.freeze({ limbDamagePerSecond: 3, painPerSecond: 5,
  fatalExposureSeconds: 6, coolingPerSecond: 0.5 });
const LIMB = { footF: 'legF', shinF: 'legF', thighF: 'legF', footB: 'legB', shinB: 'legB', thighB: 'legB',
  uarmS: 'armS', farmS: 'armS', uarmO: 'armO', farmO: 'armO' };

/** Native sensor overlap after each physics step. Damage is per exposed limb,
 * not per collider, and uses simulation time. Weapons/detached parts do not burn
 * their owner. Leaving the lava stops new damage; lost leg function stays lost.
 */
export function applyTerrainHazards(environment, colliderInfo, dt = environment?.world?.timestep ?? 1 / 120) {
  if (!environment?.lava || !(dt > 0)) return [];
  const victims = new Map();
  environment.world.intersectionPairsWith(environment.lava, collider => {
    const info = colliderInfo.get(collider.handle), f = info?.fighter;
    if (!f?.alive || info.kind === 'weapon' || f.detachedParts?.has(info.part) ||
        f.bodies[info.part]?.handle !== collider.parent()?.handle) return;
    if (!victims.has(f)) victims.set(f, new Set());
    victims.get(f).add(info.part);
  });
  const previous = environment.burning ?? new Set();
  for (const f of previous) if (!victims.has(f) && f.lavaBurn) {
    f.lavaBurn.inLava = false;
    if (!f.alive) { previous.delete(f); continue; }
    f.lavaBurn.exposure = Math.max(0, f.lavaBurn.exposure - dt * LAVA_BURN.coolingPerSecond);
    if (f.lavaBurn.exposure === 0) previous.delete(f);
  }
  const events = [];
  for (const [f, parts] of victims) {
    previous.add(f);
    const burn = f.lavaBurn ??= { inLava: false, exposure: 0, contactTime: 0, legs: [], wounds: {} };
    burn.inLava = true; burn.exposure += dt; burn.contactTime += dt;
    const limbs = new Set();
    for (const part of parts) {
      const limb = LIMB[part];
      if (limb) limbs.add(limb);
      if (!burn.wounds[part]) {
        // One nonbleeding thermal wound per body part. Standard hurt voice and
        // pain rendering may respond; the blood/drip systems see bleed=0.
        const wound = { part, type: 'burn', severity: 0.5, bleed: 0, local: new Vector3() };
        burn.wounds[part] = wound; f.wounds.push(wound);
        f.pain = Math.min(2, f.pain + 0.8);
      }
      burn.wounds[part].severity = Math.min(1.5, burn.wounds[part].severity + dt);
    }
    for (const limb of limbs) {
      f.limbs[limb] = Math.max(0, f.limbs[limb] - LAVA_BURN.limbDamagePerSecond * dt);
      if (limb.startsWith('leg') && !burn.legs.includes(limb)) burn.legs.push(limb);
    }
    f.pain = Math.min(2, f.pain + LAVA_BURN.painPerSecond * dt);
    if (limbs.has('armS') && f.limbs.armS < 0.15 && f.armed) f.dropSword();
    // Reuse the physical knee/getup transition, never move a body directly.
    if (!f.revival && f.legsCannotSupport) f.knockDown(false);
    if (burn.exposure >= LAVA_BURN.fatalExposureSeconds) {
      f.revival = null;
      f.die('용암', true);
      const part = parts.values().next().value;
      f.terrainDeath = { part, position: { ...f.bodies[part].translation() } };
    }
    events.push({ fighter: f, parts: [...parts], exposure: burn.exposure, fatal: !f.alive });
  }
  environment.burning = previous;
  return events;
}
