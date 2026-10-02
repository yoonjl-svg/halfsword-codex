// Isolated IK redundancy experiment. Keep desired hand endpoint and elbow flex,
// choose the closest shoulder orientation to the actual arm instead of restoring
// a history-transported elbow plane. No body pose/velocity/gain changes.
import {THREE} from '../harness_m.mjs';
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
export function installElbowSwivelCandidate({f,ledger,observe=false}){
  const records=[],sj=f.jointByName.uarmS,ej=f.jointByName.farmS;
  const a=V(sj.joint.anchor2()).distanceTo(V(ej.joint.anchor1()));
  const b=V(ej.joint.anchor2()).distanceTo(V(f.gripJoint.anchor1()));
  const original=f.constructor.prototype.driveJoints;
  const restore=ledger.replaceObservedMethod(f,'driveJoints',function(...args){
    const before=sj.target.clone(),beforeUnit=before.clone().normalize();
    const beta=2*Math.atan2(ej.target.z,ej.target.w);
    const chain=new THREE.Vector3(a+b*Math.cos(beta),b*Math.sin(beta),0);
    const desired=chain.clone().applyQuaternion(beforeUnit);
    const actual=Q(this.bodies.chest.rotation()).invert().multiply(Q(this.bodies.uarmS.rotation())).normalize();
    const actualDirection=chain.clone().applyQuaternion(actual).normalize();
    const candidate=new THREE.Quaternion().setFromUnitVectors(actualDirection,desired.clone().normalize()).multiply(actual).normalize();
    const active=!observe&&this.guardWeight()===0&&this.skill.thrustPose.w===0;
    if(active)sj.target.copy(candidate);
    records.push({active,betaRad:beta,before:before.toArray(),after:sj.target.toArray(),actual:actual.toArray(),beforeNorm:before.length(),
      oldErrorRad:actual.angleTo(before),newErrorRad:actual.angleTo(sj.target),
      rawEndpointDeltaM:chain.clone().applyQuaternion(sj.target).distanceTo(chain.clone().applyQuaternion(before)),
      endpointDeltaM:chain.clone().applyQuaternion(sj.target.clone().normalize()).distanceTo(desired)});
    return original.apply(this,args);
  });
  return {records,restore};
}
