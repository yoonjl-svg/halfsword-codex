import * as THREE from 'three';

const history = new WeakMap();
export function clearRollTarget(fighter) { history.delete(fighter); }

/** Optional finite-rate command for the completed ordinary blade-roll goal.
 * This does not clamp the sword's motion or torque. The existing wristVmax is
 * a conservative command budget, not a measured pronation/supination limit.
 * Keep the directed legacy goal, including its route; do not reselect either
 * source plane's sign or re-flip the result against the physical blade.
 */
export function advanceRollTarget(fighter, target, blade) {
  const old = history.get(fighter);
  if (old && fighter.lastDt > 0) {
    const reference = old.target.clone().applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(old.blade, blade));
    const requested = Math.atan2(new THREE.Vector3().crossVectors(reference, target).dot(blade), reference.dot(target));
    const bound = fighter.weaponCfg.wristVmax * Math.sqrt(fighter.strength) * fighter.lastDt;
    if (Math.abs(requested) > bound) {
      target.copy(reference).applyAxisAngle(blade, Math.sign(requested) * bound).normalize();
    }
  }
  history.set(fighter, {target: target.clone(), blade: blade.clone()});
  return target;
}
