// One terrain contract for rendering, Rapier, foot placement and AI navigation.
// +z is downhill. Spawn positions are at the same height across the slope.
const slope = Math.tan(7 * Math.PI / 180);
export const ETNA = Object.freeze({ slope, degrees: 7, lavaEdgeZ: 5.25, lavaLevel: -slope * 5.25, shelfZ: -4 });
export const etnaHeight = (x, z) => -slope * Math.max(ETNA.shelfZ, z);
export function etnaNormal(x, z) {
  return z <= ETNA.shelfZ ? { x: 0, y: 1, z: 0 } : { x: 0, y: Math.cos(7 * Math.PI / 180), z: Math.sin(7 * Math.PI / 180) };
}
export const ETNA_TERRAIN = Object.freeze({ id: 'etna', heightAt: etnaHeight, normalAt: etnaNormal, ...ETNA });
export const terrainForStage = id => id === 'etna' ? ETNA_TERRAIN : null;

/** Flat stages retain collider creation order, dimensions and friction. */
export function createArenaGround(R, world, groups, { stageId = null, radius = 6.5, walls = true } = {}) {
  const terrain = terrainForStage(stageId), ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  if (terrain) {
    const vertices = [], indices = [], zs = [-30, ETNA.shelfZ, 30];
    for (const z of zs) for (const x of [-30, 30]) vertices.push(x, etnaHeight(x, z), z);
    for (let row = 0; row < 2; row++) { const a = row * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    world.createCollider(R.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)).setFriction(0.9).setCollisionGroups(groups), ground);
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

/** Call after world.step: only native overlaps of attached living body parts.
 * Weapons, debris and detached limbs cannot kill their former owner remotely.
 */
export function applyTerrainHazards(environment, colliderInfo) {
  if (!environment?.lava) return [];
  const victims = new Map();
  environment.world.intersectionPairsWith(environment.lava, collider => {
    const info = colliderInfo.get(collider.handle), f = info?.fighter;
    if (!f?.alive || info.kind === 'weapon' || f.detachedParts?.has(info.part) ||
        f.bodies[info.part]?.handle !== collider.parent()?.handle) return;
    victims.set(f, info.part);
  });
  const events = [];
  for (const [f, part] of victims) {
    f.revival = null; // Lava is final, including during a pre-existing revival.
    f.die('용암', true);
    f.terrainDeath = { part, position: { ...f.bodies[part].translation() } };
    events.push({ fighter: f, ...f.terrainDeath });
  }
  return events;
}
