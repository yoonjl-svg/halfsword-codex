// Research/reproduction only: native reception through the existing grip.
// Continuous current-velocity holding failed free blade-plane preservation and
// changes live tap acceptance; do not expose this model as a playable trial.
// Holds the sampled relative velocity, not a pose or zero-speed target.
import assert from 'node:assert/strict';
import * as THREE from 'three';
const V=o=>new THREE.Vector3(o.x,o.y,o.z),Q=o=>new THREE.Quaternion(o.x,o.y,o.z,o.w);
const axes=[3,4,5];
function inverseAlong(b,a){const m=b.effectiveWorldInvInertia();return a.x*(m.m11*a.x+m.m12*a.y+m.m13*a.z)+a.y*(m.m21*a.x+m.m22*a.y+m.m23*a.z)+a.z*(m.m31*a.x+m.m32*a.y+m.m33*a.z);}
export function armNativeGrip(f,R){
 const joint=f.gripJoint,raw=joint.rawSet,h=joint.handle,sword=f.sword,farm=f.bodies.farmS;
 for(const n of ['jointSetMotorMaxForce','jointMotorMaxForce','jointMotorEnabled','jointMotorImpulse','jointSetMotorEnabled'])assert.equal(typeof raw[n],'function',n);
 assert(joint.isValid()&&f.armed&&f.lastDt>0);assert(axes.every(a=>!raw.jointMotorEnabled(h,a)),'Existing spherical grip must have no motor enabled');
 const torque=V(sword.userTorque()),cap=f.debug.wristCap,reserve=Math.max(0,cap-torque.length());
 if(reserve<=0)return {record:{applied:false,reason:'Existing explicit torque leaves no budget; it is not trimmed',torqueNm:torque.toArray(),originalCapNm:cap,reserveNm:reserve},afterStep(){return this.record;}};
 const frame=Q(farm.rotation()).multiply(Q(joint.frameX1())),relative=V(sword.angvel()).sub(V(farm.angvel()));
 const structure=()=>({handle:h,type:joint.type(),anchor1:{...joint.anchor1()},anchor2:{...joint.anchor2()},frame1:{...joint.frameX1()},frame2:{...joint.frameX2()},bodies:[farm,sword].map(b=>({handle:b.handle,p:{...b.translation()},q:{...b.rotation()},v:{...b.linvel()},w:{...b.angvel()},mass:b.mass(),inertia:{...b.principalInertia()},torque:{...b.userTorque()}}))});
 const before=structure();const rows=axes.map((a,i)=>{
  const axis=new THREE.Vector3().setComponent(i,1).applyQuaternion(frame).normalize(),inverse=inverseAlong(sword,axis)+inverseAlong(farm,axis);
  assert(inverse>0);const targetVelocity=relative.dot(axis),damping=1/(inverse*f.lastDt),oldCap=raw.jointMotorMaxForce(h,a),axisCap=reserve/3;
  raw.jointConfigureMotorModel(h,a,R.MotorModel.ForceBased);raw.jointConfigureMotor(h,a,0,targetVelocity,0,damping);raw.jointSetMotorMaxForce(h,a,axisCap);
  assert(raw.jointMotorEnabled(h,a));return {axis:a,axisWorld:axis.toArray(),targetVelocity,damping,inverse,cap:axisCap,oldCap};
 });assert.deepEqual(structure(),before,'Motor configuration must preserve existing joint and body state');
 const record={applied:true,jointRecreated:false,before,torqueNm:torque.toArray(),torqueNorm:torque.length(),originalCapNm:cap,reserveNm:reserve,
  requestedTorqueUpperBoundNm:torque.length()+rows.reduce((s,r)=>s+r.cap,0),actualWorldVectorTorqueBudgetVerified:false,structuralMotorTorqueBudgetSupported:true,rows,
  scope:'Per native step. Scalar cap requests fit remaining torque norm. Pinned Rapier0.30.1 motor Jacobian is the unit frameX1 basis and relative velocity projection, corroborated at the saved pose by isolated operator calibration; cap requests therefore give a mathematical world torque bound. Whole-game actual angular momentum/impulse integration and naturalness are not verified. Damping=effective inertia/outer dt. No new strength cap or zero-speed target.'};
 assert(record.requestedTorqueUpperBoundNm<=cap+1e-8);
 return {record,afterStep(){
  const subDt=f.lastDt/f.world.integrationParameters.numSolverIterations;
  for(const r of rows){r.lastSubstepImpulseNms=raw.jointMotorImpulse(h,r.axis);r.lastSubstepCapNms=r.cap*subDt;r.enabled=raw.jointMotorEnabled(h,r.axis);assert(r.enabled&&Number.isFinite(r.lastSubstepImpulseNms)&&Math.abs(r.lastSubstepImpulseNms)<=r.lastSubstepCapNms+2e-6);raw.jointSetMotorEnabled(h,r.axis,false);raw.jointSetMotorMaxForce(h,r.axis,r.oldCap);assert(!raw.jointMotorEnabled(h,r.axis));}
  return record;
 }};
}
