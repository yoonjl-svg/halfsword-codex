import * as THREE from 'three';

/** Research-only C1 join for the guard elevation slope change at y=.1.
 * Preserve the existing mapping outside (.05,.15), including both endpoints.
 * Inside, the intended elevation changes by at most .0275 rad (1.58 degrees).
 * This changes a controller target, not gravity, inertia or muscle strength.
 */
export function smoothIntentElevation(aim, x, y) {
  if (y <= .05 || y >= .15) return;
  const t = (y - .05) / .1;
  const elevation = -.055 + .11 * t + .11 * t * t;
  const azimuth = THREE.MathUtils.clamp((x - .05) * 1.7, -1.1, 1.3);
  aim.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth));
}

/** Research mode: retain the player's commanded cutting plane at rest.
 * The caller supplies the existing flat target; all wrist torque/reaction laws
 * run afterwards. This never changes a rigid body's pose or velocity directly.
 */
export function updateIntentEdgePlane(fighter, aim, blade, flatTarget, flat) {
  const yawInv = fighter.yaw.clone().invert();
  const localAim = aim.clone().applyQuaternion(yawInv).normalize();
  if (!fighter.intentEdgePreviousAim) {
    fighter.intentEdgePreviousAim = localAim.clone();
    fighter.intentEdgePlane = flatTarget.clone().applyQuaternion(yawInv).normalize();
    return;
  }
  const commandPlane = new THREE.Vector3()
    .crossVectors(fighter.intentEdgePreviousAim, localAim)
    .multiplyScalar(1 / fighter.lastDt);
  const commandSpeed = commandPlane.length() * (fighter.weaponCfg.hiltLength + .7 * fighter.weaponCfg.bladeLength);
  // Keep the existing edge-alignment speed transition. At rest retain the last
  // commanded plane instead of turning back towards the standing pose.
  const blend = THREE.MathUtils.smoothstep(commandSpeed, .5, 2.5);
  if (blend > 0) {
    commandPlane.normalize();
    if (commandPlane.dot(fighter.intentEdgePlane) < 0) commandPlane.negate();
    fighter.intentEdgePlane.lerp(commandPlane, blend).normalize();
  }
  fighter.intentEdgePreviousAim.copy(localAim);
  flatTarget.copy(fighter.intentEdgePlane).applyQuaternion(fighter.yaw);
  flatTarget.addScaledVector(blade, -flatTarget.dot(blade));
  if (flatTarget.lengthSq() < 1e-8) flatTarget.copy(flat);
  flatTarget.normalize();
  if (flatTarget.dot(flat) < 0) flatTarget.negate();
}
