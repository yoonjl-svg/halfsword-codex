// Research-only input radial hypothesis. Preserve native joints, strength, torque settings and weapon aim.
import { THREE, CONFIG } from '../harness_m.mjs';
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
export const radialReach=(inputRadius,inputR,nativeReach)=>Math.max(.08,nativeReach*Math.sqrt(Math.max(0,1-(inputRadius/inputR)**2)));
export function installElbowReachCandidate({f,ledger,mode='candidate'}){
  if(!['candidate','observe'].includes(mode))throw Error('Unknown reach mode');
  const original=f.constructor.prototype.armIK,records=[];
  const up=f.bodies.uarmS,fore=f.bodies.farmS,shoulderJ=f.jointByName.uarmS.joint,elbowJ=f.jointByName.farmS.joint,gripJ=f.gripJoint;
  const nativeUpper=V(shoulderJ.anchor2()).distanceTo(V(elbowJ.anchor1()));
  const nativeFore=V(elbowJ.anchor2()).distanceTo(V(gripJ.anchor1()));
  const nativeReach=nativeUpper+nativeFore-CONFIG.ARM.slack;
  const restore=ledger.replaceObservedMethod(f,'armIK',function(target){
    const chest=this.bodies.chest,shoulder=point(chest,shoulderJ.anchor1()),requested=V(target),delta=requested.clone().sub(shoulder);
    const radius=delta.length(),aimRadius=this.skill.aim.length(),inputR=CONFIG.WEAPON.reach;
    const appliedRadius=radialReach(aimRadius,inputR,nativeReach);
    const applied=radius>1e-8?delta.clone().multiplyScalar(appliedRadius/radius).add(shoulder):requested.clone();
    const active=mode==='candidate'&&this.guardWeight()===0&&this.skill.thrustPose.w===0;
    if(active)target.copy(applied);
    const beforeAim=this.aimDirW.toArray();const result=original.call(this,target);
    records.push({active,requested:requested.toArray(),applied:V(target).toArray(),requestedRadiusM:radius,
      appliedRadiusM:active?appliedRadius:radius,inputRadiusM:aimRadius,nativeReachM:nativeReach,
      directionDot:radius>1e-8?V(target).sub(shoulder).normalize().dot(delta.normalize()):1,axisBefore:beforeAim});
    return result;
  });
  return {records,nativeUpperM:nativeUpper,nativeForeM:nativeFore,nativeReachM:nativeReach,restore};
}
