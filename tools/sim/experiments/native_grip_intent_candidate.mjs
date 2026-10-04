// Research only. Transfer the existing complete wrist request into the same
// capped native grip; no added current-speed-holding channel or new pose target.
// The full3-axis transfer failed ordinary-cut blade-plane preservation and is
// rejected for public use. Pair routing modes remain diagnostics, not trials.
import assert from 'node:assert/strict';
import * as T from 'three';
const V=o=>new T.Vector3(o.x,o.y,o.z),Q=o=>new T.Quaternion(o.x,o.y,o.z,o.w);
const axes=[3,4,5];
const inverseAlong=(b,a)=>{const m=b.effectiveWorldInvInertia();return a.x*(m.m11*a.x+m.m12*a.y+m.m13*a.z)+a.y*(m.m21*a.x+m.m22*a.y+m.m23*a.z)+a.z*(m.m31*a.x+m.m32*a.y+m.m33*a.z);};

// Read the actual three final addTorque calls, including post-debug blade twist.
// Other methods and torque calls outside driveSword are left intact. Disabled
// capture must pass each call through verbatim, so baseline trace can be checked.
export function captureWristRequest(f,replace,{pairDiagnostic=false}={}){
 const original=f.driveSword,bodies=[f.sword,f.bodies.farmS,f.bodies.chest];
 let latest=null;
 f.driveSword=function(...args){
  const active=replace()&&f.armed&&f.gripJoint?.isValid(),calls=[];
  const methods=bodies.map(b=>b.addTorque);
  for(let i=0;i<bodies.length;i++)bodies[i].addTorque=function(t,wake){calls.push({body:i,torque:V(t).toArray(),wake});if(!active)return methods[i].call(this,t,wake);};
  try{return original.apply(this,args);}finally{
   bodies.forEach((b,i)=>b.addTorque=methods[i]);
   assert(calls.length===0||(calls.length===3&&calls.every((c,i)=>c.body===i&&c.wake===true)),'Only the three existing final wrist/reaction calls may be replaced');
   if(calls.length){assert(V({x:calls[0].torque[0]+calls[1].torque[0]+calls[2].torque[0],y:calls[0].torque[1]+calls[1].torque[1]+calls[2].torque[1],z:calls[0].torque[2]+calls[1].torque[2]+calls[2].torque[2]}).length()<1e-8,'Original wrist/reaction must close');}
   latest={replaced:active&&calls.length>0,calls,capNm:f.debug.wristCap};
   // Diagnosis only: same requested torque, changed reaction route, no motor.
   if(pairDiagnostic&&latest.replaced){const t=new T.Vector3(...calls[0].torque),scale=t.length()>latest.capNm?latest.capNm/t.length():1;t.multiplyScalar(scale);methods[0].call(bodies[0],t,true);methods[1].call(bodies[1],t.clone().negate(),true);latest.pairDiagnostic={applied:true,requestScale:scale,requestNormNm:new T.Vector3(...calls[0].torque).length(),boundedRequestNm:t.toArray(),reason:'Original torque forwarded; full reaction redirected to forearm, original chest share removed; diagnostic only'};}

  }
 };
 return ()=>latest;
}

export function armIntentGrip(f,R,captured){
 if(!captured?.replaced)return {record:{applied:false,reason:'No replaced active wrist request'},afterStep(){return this.record;}};
 const joint=f.gripJoint,raw=joint.rawSet,h=joint.handle,sword=f.sword,farm=f.bodies.farmS;
 assert(joint.isValid()&&f.armed&&f.lastDt>0&&axes.every(a=>!raw.jointMotorEnabled(h,a)));
 const request=new T.Vector3(...captured.calls[0].torque),cap=captured.capNm;
 assert(Number.isFinite(cap)&&cap>=0&&request.toArray().every(Number.isFinite));
 const scale=request.length()>cap?cap/request.length():1,torque=request.clone().multiplyScalar(scale);
 const frame=Q(farm.rotation()).multiply(Q(joint.frameX1())).normalize(),relative=V(sword.angvel()).sub(V(farm.angvel()));
 const unchanged=()=>JSON.stringify({handle:h,type:joint.type(),a1:joint.anchor1(),a2:joint.anchor2(),q1:joint.frameX1(),q2:joint.frameX2(),b:[farm,sword].map(b=>({p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel(),F:b.userForce(),T:b.userTorque()}))});
 const before=unchanged(),rows=axes.map((a,i)=>{
  const axis=new T.Vector3().setComponent(i,1).applyQuaternion(frame),inverse=inverseAlong(sword,axis)+inverseAlong(farm,axis);
  assert(inverse>0);const damping=1/(inverse*f.lastDt),component=torque.dot(axis),targetVelocity=relative.dot(axis)+2*component/damping,oldCap=raw.jointMotorMaxForce(h,a);
  raw.jointConfigureMotorModel(h,a,R.MotorModel.ForceBased);raw.jointConfigureMotor(h,a,0,targetVelocity,0,damping);raw.jointSetMotorMaxForce(h,a,Math.abs(component));
  return {axis:a,axisWorld:axis.toArray(),requestedTorqueNm:component,targetVelocity,sampledRelativeVelocity:relative.dot(axis),damping,inverse,cap:Math.abs(component),oldCap};
 });assert.equal(unchanged(),before,'Configure existing grip without changing body/joint structure');
 const vectorCapNm=Math.hypot(...rows.map(r=>r.cap));assert(vectorCapNm<=cap+1e-7);
 const record={applied:true,jointRecreated:false,captured,requestNm:request.toArray(),boundedRequestNm:torque.toArray(),requestNormNm:request.length(),requestScale:scale,vectorCapNm,rows,
  reactionRouting:'Native torque pair is sword↔forearm; original forearm-long-axis reaction routed to chest is removed with its captured original calls. This is a changed reaction path, not exact legacy equivalence.',
  scope:'Unit orthogonal motor basis gives sqrt(sum cap_i²) torque bound. Per-step requested direction and blade twist include original control/Hill/release policy. Velocity surplus2*T_i/d is a first bounded force-transfer hypothesis, not a proved identical implicit/substep response. Last substep scalar impulse is not total outer impulse.'};
 return {record,afterStep(){const subDt=f.lastDt/f.world.integrationParameters.numSolverIterations;for(const r of rows){r.lastSubstepImpulseNms=raw.jointMotorImpulse(h,r.axis);r.lastSubstepCapNms=r.cap*subDt;assert(Number.isFinite(r.lastSubstepImpulseNms)&&Math.abs(r.lastSubstepImpulseNms)<=r.lastSubstepCapNms+2e-6);raw.jointSetMotorEnabled(h,r.axis,false);raw.jointSetMotorMaxForce(h,r.axis,r.oldCap);assert(!raw.jointMotorEnabled(h,r.axis));}return record;}};
}
