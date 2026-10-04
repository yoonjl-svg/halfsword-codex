// Isolated native operator calibration at the saved actual grip relative pose.
// This is not a game efficacy run or an alteration of the gameplay timestep.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
const o=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|reference|module)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
for(const k of ['out','reference','module'])assert(o[k]&&path.isAbsolute(o[k]));assert(!fs.existsSync(o.out));
const sha=b=>createHash('sha256').update(b).digest('hex'),moduleBytes=fs.readFileSync(o.module),referenceBytes=fs.readFileSync(o.reference);
assert.equal(sha(moduleBytes),'a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623');
const ref=JSON.parse(referenceBytes);assert(ref.pass&&ref.sourceStable);const sample=ref.rows[0].frames.find(f=>f.tick===965).nativeGrip.before.bodies;
const R=(await import(pathToFileURL(o.module).href)).default;await R.init();
const V=v=>new T.Vector3(v.x,v.y,v.z),Q=q=>new T.Quaternion(q.x,q.y,q.z,q.w),xyz=v=>({x:v.x,y:v.y,z:v.z});
const dt=ref.dt,axes=[3,4,5],rows=[],start=performance.now(),sourceBefore=sha(fs.readFileSync(new URL(import.meta.url)));
let pass=false;
function run(i,kind){
 const world=new R.World({x:0,y:0,z:0});world.timestep=kind==='saturated'?dt:1e-5;world.integrationParameters.numSolverIterations=kind==='saturated'?6:1;
 const bodies=sample.map((s,n)=>{const desc=R.RigidBodyDesc.dynamic().setRotation(s.q).setCanSleep(false).setAngularDamping(0).setLinearDamping(0).setAdditionalMassProperties(1,{x:0,y:0,z:0},{x:1,y:1,z:1},{x:0,y:0,z:0,w:1});
  const b=world.createRigidBody(desc);b.recomputeMassPropertiesFromColliders();assert.equal(b.mass(),1);if(kind!=='saturated')b.setAngvel(s.w,true);return b;});
 const joint=world.createImpulseJoint(R.JointData.spherical({x:0,y:0,z:0},{x:0,y:0,z:0}),...bodies,true),raw=joint.rawSet,h=joint.handle;
 const axis=new T.Vector3().setComponent(i,1).applyQuaternion(Q(bodies[0].rotation()).multiply(Q(joint.frameX1()))).normalize(),relative=V(bodies[1].angvel()).sub(V(bodies[0].angvel()));
 const target=kind==='saturated'?6:relative.dot(axis);raw.jointConfigureMotorModel(h,axes[i],R.MotorModel.ForceBased);raw.jointConfigureMotor(h,axes[i],0,target,0,120);raw.jointSetMotorMaxForce(h,axes[i],5);if(kind==='off')raw.jointSetMotorEnabled(h,axes[i],false);
 const state=()=>bodies.map(b=>({q:{...b.rotation()},w:{...b.angvel()},p:{...b.translation()},mass:b.mass(),I:{...b.principalInertia()},frame:{...b.principalInertiaLocalFrame()},inverse:[...b.effectiveWorldInvInertia().elements]}));
 const before=state(),beforeJoint={handle:h,type:joint.type(),anchor1:{...joint.anchor1()},anchor2:{...joint.anchor2()},frame1:{...joint.frameX1()},frame2:{...joint.frameX2()}};
 world.step();const after=state(),delta=after.map((s,n)=>V(s.w).sub(V(before[n].w))),impulseBound=5*world.timestep;
 assert(after.every(s=>s.mass===1&&s.I.x===1&&s.I.y===1&&s.I.z===1&&V(s.p).length()===0));
 const result={axis:axes[i],kind,targetVelocity:target,axisWorld:axis.toArray(),dt:world.timestep,iterations:world.integrationParameters.numSolverIterations,beforeJoint,before,after,deltaAngularVelocity:delta.map(v=>v.toArray()),
  bodyAngularImpulseNorm:delta.map(v=>v.length()),body2DirectionDot:delta[1].length()>1e-12?delta[1].clone().normalize().dot(axis):null,body2ImpulseOverCapDt:delta[1].length()/impulseBound,
  angularMomentumClosure:delta[0].clone().add(delta[1]).toArray(),lastSubstepMotorImpulse:raw.jointMotorImpulse(h,axes[i]),scalarSubstepCap:5*world.timestep/world.integrationParameters.numSolverIterations};
 assert(Number.isFinite(result.lastSubstepMotorImpulse));world.free();return result;
}
try{
 for(let i=0;i<3;i++)for(const kind of ['saturated','off','matched'])rows.push(run(i,kind));
 for(const r of rows){if(r.kind==='saturated'){
  assert(Math.abs(r.lastSubstepMotorImpulse)<=r.scalarSubstepCap+2e-6,'Actual scalar motor bound');
  assert(r.bodyAngularImpulseNorm.every(v=>v<=5*r.dt+2e-6),'Measured unit-inertia body response bound at this pose');
 }else if(r.kind==='matched'){
  const off=rows.find(x=>x.axis===r.axis&&x.kind==='off');r.matchedMinusOff=r.after.map((s,n)=>V(s.w).sub(V(off.after[n].w)).toArray());
  assert(r.matchedMinusOff.every(v=>Math.hypot(...v)<2e-6),'Projected instantaneous target must match native free response at the saved pose');
 }}pass=true;
}finally{
 const sourceAfter=sha(fs.readFileSync(new URL(import.meta.url)));fs.writeFileSync(o.out,JSON.stringify({schema:1,pass,sourceBefore,sourceAfter,sourceStable:sourceBefore===sourceAfter,modulePath:o.module,moduleSHA256:sha(moduleBytes),referencePath:o.reference,referenceSHA256:sha(referenceBytes),argv:process.argv.slice(2),wallSeconds:(performance.now()-start)/1000,rows,
  scope:'Actual saved relative pose; isolated isotropic unit inertia two-body coincident COM spherical descriptor, zero gravity/contact/damping. Saturated rows use gameplay dt/solver6; 1e-5/solver1 rows calibrate instantaneous velocity target only and are not a new gameplay timestep. Engineering response tolerance 2e-6 does not supersede the previous 1e-7 paired principal-inertia momentum acceptance or prove a whole-game vector bound. No game efficacy or naturalness claim.'},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass,rows:rows.map(r=>({axis:r.axis,kind:r.kind,capRatio:r.body2ImpulseOverCapDt,directionDot:r.body2DirectionDot,closure:Math.hypot(...r.angularMomentumClosure),matchedMinusOff:r.matchedMinusOff}))}));
}
