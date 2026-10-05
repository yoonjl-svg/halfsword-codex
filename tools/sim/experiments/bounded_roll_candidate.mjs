import * as THREE from 'three';

// Experimental command-rate contract, not a new force or velocity clamp.
// Keep the completed ordinary goal; limit only its roll relative to its
// previous blade frame. Swing, damping, inertia and the physical body are free.
const history = new WeakMap();
export function advanceRollTarget(fighter, target, blade) {
  const old = history.get(fighter);
  let requested = 0, applied = 0;
  if (old && fighter.lastDt > 0) {
    const reference = old.target.clone().applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(old.blade, blade));
    requested = Math.atan2(new THREE.Vector3().crossVectors(reference, target).dot(blade), reference.dot(target));
    const bound = fighter.weaponCfg.wristVmax * Math.sqrt(fighter.strength) * fighter.lastDt;
    applied = Math.max(-bound, Math.min(bound, requested));
    if (Math.abs(requested) > bound) target.copy(reference).applyAxisAngle(blade, applied).normalize();
  }
  history.set(fighter, {target:target.clone(), blade:blade.clone()});
  fighter.rollSlewDiagnostic = {requested, applied};
  return target;
}
