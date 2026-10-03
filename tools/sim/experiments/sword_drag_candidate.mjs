/** Research-only removal of the sword's uncalibrated global rotational drag.
 * Joint muscles, body damping, gravity, contacts, mass and inertia are unchanged.
 * Zero drag is a short-motion limiting comparison, not calibrated aerodynamics.
 */
export function setSwordDrag(f, mode) {
  if (!['original', 'free'].includes(mode)) throw Error('Unknown sword drag mode');
  const before = f.sword.angularDamping();
  if (Math.abs(before - .3) > 1e-6) throw Error('Unexpected original sword drag');
  if (mode === 'free') f.sword.setAngularDamping(0);
  const after = f.sword.angularDamping();
  if (mode === 'free' ? after !== 0 : after !== before) throw Error('Sword drag selection failed');
  return { mode, beforePerS: before, afterPerS: after };
}
