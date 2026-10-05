// Research-only command-point direction. No stored normal or rest-plane memory.
// The live caller retains its physical-speed blend and all torque/reaction laws.
import * as THREE from 'three';

export function observeCommandPoint(fighter, aim, blade) {
  const length=fighter.weaponCfg.hiltLength+.7*fighter.weaponCfg.bladeLength;
  const point=fighter.handTarget.clone().addScaledVector(aim,length);
  const previous=fighter.p4CommandPreviousPoint;
  const velocity=previous&&fighter.lastDt>0?point.clone().sub(previous).divideScalar(fighter.lastDt):new THREE.Vector3();
  (fighter.p4CommandPreviousPoint ||= new THREE.Vector3()).copy(point);
  const transverse=velocity.clone().addScaledVector(blade,-velocity.dot(blade));
  const eligible=!!fighter.inputActive&&!!fighter.skill.swinging&&!fighter.skill.tap&&fighter.skill.thrustPose.w===0&&transverse.lengthSq()>1e-8;
  return{point,velocity,transverse,speed:transverse.length(),eligible};
}
