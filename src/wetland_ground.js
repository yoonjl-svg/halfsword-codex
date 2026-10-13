// Shared wetland outlines: drawing and native movement read the same definitions.
// Metres in the level arena; no global RNG, timers, force or damage multipliers.
export const WETLAND_PUDDLES = Object.freeze([
  { x: -0.5, z: -2.0, rx: 2.0, rz: 1.1, phase: 0.7 },
  { x: 1.9, z: 2.3, rx: 1.9, rz: 1.15, phase: 2.2 },
  { x: -3.5, z: 2.7, rx: 1.3, rz: 0.85, phase: 4.1 },
  { x: 3.8, z: -2.8, rx: 1.4, rz: 0.95, phase: 1.8 },
  { x: -1.5, z: 4.6, rx: 1.4, rz: 0.75, phase: 3.4 },
].map(Object.freeze));
export const WETLAND_CORE_SPEED = 0.4;
export const puddleOutline = (angle, phase) => 1 + 0.09 * Math.sin(angle * 3 + phase);
export const wetlandIslandRadius = a => 9.6 + 1.45 * Math.sin(a * 3 + 0.4) + 0.85 * Math.cos(a * 5 - 0.8);

/** Voluntary locomotion only. The 0.3m wet rim is a continuous transition.
 * Balance catching and weapon/vertical physics are not scaled. */
export function wetlandMoveScale(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 1;
  let wet = 0;
  for (const p of WETLAND_PUDDLES) {
    const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz;
    const radius = puddleOutline(Math.atan2(dz, dx), p.phase);
    const inset = (radius - Math.hypot(dx, dz)) * Math.min(p.rx, p.rz);
    const t = Math.max(0, Math.min(1, inset / 0.3));
    wet = Math.max(wet, t * t * (3 - 2 * t));
  }
  return 1 - (1 - WETLAND_CORE_SPEED) * wet;
}
export function configureWetlandMovement(fighter, stageId) {
  fighter.movementSurface = stageId === 'sluice' ? 'wetland' : null;
  fighter.surfaceSpeedScale = 1;
}
