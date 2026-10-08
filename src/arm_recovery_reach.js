// A heading-space guard may lie behind the actual chest during recovery.
// This is a small forward margin for selecting the IK goal, not an anatomical
// shoulder limit. Physical bodies, joint forces and weapon aim are untouched.
// Chest half-depth .11m + forearm radius .04m + .01m clearance.
const FRONT_MARGIN = 0.16;
const recoveryStates = new Set(['down', 'getup', 'kneel']);
const pending = new WeakMap();

// Common two-hand path, with one measured exception: the current lightsaber
// controller lost active re-cut speed/energy with both motor and contact fixes.
// Preserve that weapon until its separate controller is revalidated.
export function usesCoupledArmRecovery(weapon) {
  return !!weapon?.twoHand && weapon.id !== 'lightsaber';
}

/**
 * Constrain a chest-local IK target in place. Each arm keeps its own recovery
 * handover until its original target reaches the front again: the timed state
 * transition to stand alone does not prove the actual torso has straightened.
 * Returns whether this call changed the target's forward coordinate.
 */
export function constrainRecoveryArmReach(fighter, target, side) {
  // The gun and the measured two-hand exception retain their existing goals.
  if (fighter.weapon?.gun || (fighter.weaponCfg?.twoHand &&
      !usesCoupledArmRecovery(fighter.weapon || fighter.weaponCfg))) {
    pending.delete(fighter);
    return false;
  }
  const recovering = recoveryStates.has(fighter.state);
  if (!recovering && fighter.state !== 'stand') {
    // Death and unsupported states cannot carry a recovery goal into a later
    // revival or another controller. A new recovery call can arm it again.
    pending.delete(fighter);
    return false;
  }
  if (side !== 'S' && side !== 'O') return false;
  if (!Number.isFinite(target.x)) return false;

  let arms = pending.get(fighter);
  if (recovering) {
    if (!arms) pending.set(fighter, arms = { S: false, O: false });
    arms[side] = true;
  } else if (!arms?.[side]) {
    return false;
  }

  if (target.x >= FRONT_MARGIN) {
    if (!recovering) {
      arms[side] = false;
      if (!arms.S && !arms.O) pending.delete(fighter);
    }
    return false;
  }
  target.x = FRONT_MARGIN;
  return true;
}
