import { BODY, GAIT } from './config.js';

// Etna's downhill edge is visible terrain. These are planning margins in metres,
// not collision boundaries: the ordinary legs still have to execute this input.
const WARNING_DISTANCE = 1.25;
const SAFE_DISTANCE = 1.75;
const LOOK_AHEAD = 0.45;

/** Redirect voluntary AI input away from Etna's lava; never move a physical body. */
export function avoidEtnaLava(ai) {
  const f = ai.me, terrain = f.terrain;
  // The common flat-stage path returns before reading or writing any AI state.
  if (terrain?.id !== 'etna' || !Number.isFinite(terrain.lavaEdgeZ)) return false;
  if (!f.alive || f.state !== 'stand' || f.feetHeld || f.revival || f.missingSupportLeg) return false;
  const strength = Math.hypot(f.move.x, f.move.y), emotionScale = f.emoMods?.move ?? 1;
  if ((strength < 0.01 && !f.gait?.req) || !(emotionScale > 0)) return false;

  const pelvis = f.bodies.pelvis, p = pelvis.translation();
  const c = Math.cos(f.heading), s = Math.sin(f.heading);
  const hybrid = !!f.gait;
  const sideRatio = hybrid ? GAIT.sideFactor : 0.8;
  const backRatio = hybrid ? GAIT.backFactor : 0.75;
  const speed = hybrid ? GAIT.moveSpeed : BODY.moveSpeed;
  // Project both current downhill inertia and the existing travel request. A foot
  // already ahead of the pelvis matters even while the pelvis is moving upslope.
  const requestedZ = speed * (f.move.x * sideRatio * c
    - f.move.y * (f.move.y < 0 ? backRatio : 1) * s);
  let leadingZ = p.z + 0.35;
  for (const name of ['footF', 'footB']) {
    const foot = f.bodies[name];
    if (foot) leadingZ = Math.max(leadingZ, foot.translation().z + 0.14);
  }
  const projectedZ = leadingZ + Math.max(0, pelvis.linvel().z, requestedZ) * LOOK_AHEAD;
  if (projectedZ < terrain.lavaEdgeZ - WARNING_DISTANCE) return false;

  // A previously requested attack step is voluntary input too. It otherwise adds
  // its own forward travel after the stick is read; cancel a downhill request,
  // including one whose leg is already swinging. Balance-catching steps remain.
  const request = f.gait?.req;
  const cancelStep = !!request && -(request.fwd ?? 0) * s + (request.side ?? 0) * c > 0;
  if (cancelStep) f.gait.req = null;
  if (strength < 0.01) return cancelStep;

  // Aim upslope, with a small inward component at either side of the arena. The
  // negative minimum also handles early warnings caused by fast downhill motion.
  const dx = Math.max(-0.6, Math.min(0.6, -p.x * 0.15));
  const dz = Math.min(-0.5, terrain.lavaEdgeZ - SAFE_DISTANCE - p.z);
  let side = (dx * s + dz * c) / sideRatio;
  let forward = dx * c - dz * s;
  if (forward < 0) forward /= backRatio;
  // Undo local sideways/backward speed differences before normalizing. Preserve
  // the existing command budget, including emotion limits and raw-stick bounds.
  const limit = emotionScale; // raw stick stays within ±1 after undoing the multiplier
  const scale = Math.min(strength / Math.hypot(side, forward), limit / Math.max(Math.abs(side), Math.abs(forward)));
  side *= scale;
  forward *= scale;
  f.move.set(side, forward);
  f.stickX = side / emotionScale;
  f.stickY = forward / emotionScale;
  return true;
}
