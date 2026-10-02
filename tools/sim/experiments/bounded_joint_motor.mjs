// Research only. Explicit paired torques with a bound on the full motor vector.
// This limits this actuator, not passive joint/contact reactions or other actuators.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const plain = v => ({x:v.x,y:v.y,z:v.z});
function rotationVector(q) {
  q.normalize();
  if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);
  const s=Math.hypot(q.x,q.y,q.z);
  return s<1e-12?new THREE.Vector3():new THREE.Vector3(q.x,q.y,q.z).multiplyScalar(2*Math.atan2(s,q.w)/s);
}
function invInertia(body) {
  const m=body.effectiveWorldInvInertia();
  return new THREE.Matrix3().set(m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33);
}

/** Backward-Euler PD approximation for the free body pair, followed by vector cap.
 * A=I_child^-1+I_parent^-1, [Id+(dt*d+dt^2*k)A] tau=k*e+(d+dt*k)*(wd-w).
 * Native contacts, translation locks and neighboring joints are NOT included in A.
 * target/previousTarget are child orientations in the parent's local frame.
 */
export function boundedJointTorque({parent,child,target,previousTarget=null,dt,k,d,maxTorque,axisWorld=null,maxTargetSpeed=15}) {
  if(![dt,k,d,maxTorque,maxTargetSpeed].every(Number.isFinite)||dt<=0||k<0||d<0||maxTorque<0||maxTargetSpeed<0)
    throw new TypeError('Finite positive dt and nonnegative motor parameters required');
  for(const q of [target,previousTarget].filter(Boolean))if(![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.hypot(q.x,q.y,q.z,q.w)<1e-12)throw new TypeError('Valid target quaternion required');
  const qp=Q(parent.rotation()),qc=Q(child.rotation());
  const error=rotationVector(qp.clone().multiply(Q(target)).multiply(qc.clone().invert()));
  const omega=V(child.angvel()).sub(V(parent.angvel()));
  const desiredOmega=previousTarget?rotationVector(Q(target).multiply(Q(previousTarget).invert())).multiplyScalar(1/dt).applyQuaternion(qp):new THREE.Vector3();
  if(desiredOmega.length()>maxTargetSpeed)desiredOmega.setLength(maxTargetSpeed);
  const A=invInertia(child),P=invInertia(parent);
  for(let i=0;i<9;i++)A.elements[i]+=P.elements[i];
  const velocityError=desiredOmega.clone().sub(omega),rhs=error.clone().multiplyScalar(k).addScaledVector(velocityError,d+dt*k);
  let torque;
  if(axisWorld){
    const axis=V(axisWorld);if(!Number.isFinite(axis.length())||axis.length()<1e-12)throw new TypeError('Nonzero finite hinge axis required');axis.normalize();
    const denom=1+(dt*d+dt*dt*k)*axis.dot(axis.clone().applyMatrix3(A));
    torque=axis.multiplyScalar(rhs.dot(axis)/denom);
  }else{
    const M=A.clone().multiplyScalar(dt*d+dt*dt*k);M.elements[0]+=1;M.elements[4]+=1;M.elements[8]+=1;
    if(!(M.determinant()>0))throw new Error('Non-positive implicit motor matrix');
    torque=rhs.clone().applyMatrix3(M.invert());
  }
  const requestedNm=torque.length();
  if(requestedNm>maxTorque)torque.multiplyScalar(maxTorque/requestedNm);
  if(![torque.x,torque.y,torque.z,requestedNm].every(Number.isFinite))throw new Error('Nonfinite bounded torque');
  return {torqueNm:plain(torque),requestedNm,appliedNm:torque.length(),capNm:maxTorque,
    errorRad:plain(error),relativeOmegaRadS:plain(omega),desiredOmegaRadS:plain(desiredOmega),
    limited:requestedNm>maxTorque};
}
export function applyBoundedJointTorque(request) {
  const result=boundedJointTorque(request),t=result.torqueNm;
  request.child.addTorque(t,true);
  request.parent.addTorque({x:-t.x,y:-t.y,z:-t.z},true);
  return result;
}

function signature(f){return JSON.stringify(Object.entries(f.bodies).map(([n,b])=>[n,b.mass(),b.translation(),b.rotation(),b.linvel(),b.angvel()]));}
function equivalentQuaternion(a,b){return Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)>1-1e-6;}

/** Replace only native leg motors, preserving native joint anchors and limits.
 * Native joint recreation resets solver history. Use recreation-only controls
 * before attributing an effect solely to the bounded actuator.
 */
export function installBoundedLegMotors({G,f,mode='bounded'}) {
  if(!['bounded','recreate'].includes(mode))throw new Error('Unknown leg motor experiment');
  const before=signature(f),legs=f.joints.filter(j=>/^(thigh|shin|foot)[FB]$/.test(j.name));
  if(legs.length!==6||legs.some(j=>j.manual))throw new Error('Expected six native leg joints');
  const records=[],byHandle=new Map();
  for(const j of legs){
    const old=j.joint,raw=old.rawSet,axes=j.type==='hinge'?[3]:[3,4,5];
    const limits=axes.map(axis=>({axis,enabled:raw.jointLimitsEnabled(old.handle,axis),min:raw.jointLimitsMin(old.handle,axis),max:raw.jointLimitsMax(old.handle,axis)}));
    const a1=old.anchor1(),a2=old.anchor2(),frame1=old.frameX1(),frame2=old.frameX2(),contacts=old.contactsEnabled();
    const data=j.type==='hinge'?RAPIER.JointData.revolute(a1,a2,{x:0,y:0,z:1}):RAPIER.JointData.spherical(a1,a2);
    G.world.removeImpulseJoint(old,true);
    const joint=G.world.createImpulseJoint(data,j.parent,j.child,true);joint.setContactsEnabled(contacts);
    if(!equivalentQuaternion(frame1,joint.frameX1())||!equivalentQuaternion(frame2,joint.frameX2()))throw new Error('Joint frames changed: '+j.name);
    for(const x of limits){if(x.enabled)joint.rawSet.jointSetLimits(joint.handle,x.axis,x.min,x.max);if(mode==='recreate')joint.rawSet.jointConfigureMotorModel(joint.handle,x.axis,1);}
    j.joint=joint;
    const record={j,previous:j.target.clone(),prevRV:j.prevRV,axes,limits,calls:0};records.push(record);byHandle.set(joint.handle,record);
  }
  if(signature(f)!==before)throw new Error('Joint recreation changed body state');
  const summary={mode,bodyStatePreserved:true,joints:records.map(r=>({name:r.j.name,axes:r.axes,limits:r.limits})),nativeCallsIntercepted:0,actuatorCalls:0,targetVelocityResets:0,limitedCalls:0,maxAppliedNm:0,maxCapRatio:0,maxRequestedNm:0,perJoint:{},definition:'Explicit muscle torque only; passive native constraint/contact torques and other game actuators remain outside this bound.'};
  const raw=f.uprightJoint.rawSet,oldConfigure=raw.jointConfigureMotor;
  raw.jointConfigureMotor=function(handle,axis,target,velocity,k,d){
    const r=byHandle.get(handle);
    if(!r)return oldConfigure.call(this,handle,axis,target,velocity,k,d);
    summary.nativeCallsIntercepted++;r.calls++;
    if(mode==='recreate')return oldConfigure.call(this,handle,axis,target,velocity,k,d);
    if(axis!==r.axes.at(-1))return;
    const j=r.j,mu=k/(j.k*(j.gain||1));
    // Native driveJoints creates a fresh prevRV after gait.resetRates. Preserve
    // its zero feedforward for that first target instead of adding a velocity pulse.
    const targetVelocityReset=r.prevRV!==j.prevRV;
    const result=applyBoundedJointTorque({parent:j.parent,child:j.child,target:j.target,previousTarget:targetVelocityReset?null:r.previous,
      dt:f.lastDt,k,d,maxTorque:j.max*mu,axisWorld:j.type==='hinge'?new THREE.Vector3(0,0,1).applyQuaternion(Q(j.parent.rotation())):null});
    r.previous.copy(j.target);r.prevRV=j.prevRV;
    summary.targetVelocityResets+=+targetVelocityReset;
    const count=summary.perJoint[j.name]??={calls:0,limitedCalls:0,maxAppliedNm:0,maxCapRatio:0};count.calls++;count.limitedCalls+=+result.limited;
    count.lastDesiredOmegaRadS=result.desiredOmegaRadS;count.lastTargetVelocityReset=targetVelocityReset;
    const ratio=result.capNm>0?result.appliedNm/result.capNm:result.appliedNm===0?0:Infinity;
    if(ratio>1+1e-12)throw new Error('Explicit actuator exceeded cap');
    count.maxAppliedNm=Math.max(count.maxAppliedNm,result.appliedNm);count.maxCapRatio=Math.max(count.maxCapRatio,ratio);
    summary.actuatorCalls++;summary.limitedCalls+=+result.limited;summary.maxAppliedNm=Math.max(summary.maxAppliedNm,result.appliedNm);summary.maxCapRatio=Math.max(summary.maxCapRatio,ratio);summary.maxRequestedNm=Math.max(summary.maxRequestedNm,result.requestedNm);
  };
  return {summary,restore(){raw.jointConfigureMotor=oldConfigure;}};
}
