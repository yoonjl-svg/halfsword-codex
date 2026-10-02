// Isolated native diagnostic; never imported by the game. Numbers are not human strength limits.
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2);
if(args.length>1||args.some(a=>!a.startsWith('--out=')))throw Error('Use --out=PATH');
const output=args[0]?.slice(6)||'/workspace/halfsword-hybrid-evidence/native-motor-limit.json';
const DT=1/120,K=1600,D=100,POSITION_TERM_CAP_NM=500;
const hash=x=>createHash('sha256').update(x).digest('hex');
const sourceBefore=hash(await readFile(new URL(import.meta.url)));
const vector=v=>({x:v.x,y:v.y,z:v.z});
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function state(body){
 const w=vector(body.angvel()),v=vector(body.linvel()),I=vector(body.principalInertia());
 near(I.x,I.y);near(I.y,I.z); // Isotropic inertia: frame conversion is unnecessary.
 return {positionM:vector(body.translation()),worldCOMM:vector(body.worldCom()),rotation:{...body.rotation()},
  velocityMps:v,omegaRadps:w,massKg:body.mass(),principalInertiaKgM2:I,
  kineticJ:.5*body.mass()*(v.x*v.x+v.y*v.y+v.z*v.z)+.5*I.z*(w.x*w.x+w.y*w.y+w.z*w.z)};
}
function verifyAxisAndFinite(s){
 const scalars=[s.kineticJ,s.massKg,...Object.values(s.principalInertiaKgM2),...Object.values(s.positionM),...Object.values(s.worldCOMM),...Object.values(s.rotation),...Object.values(s.velocityMps),...Object.values(s.omegaRadps)];
 assert.ok(scalars.every(Number.isFinite));
 for(const p of [s.positionM,s.worldCOMM,s.velocityMps])for(const n of ['x','y','z'])near(p[n],0);
 for(const n of ['x','y']){near(s.omegaRadps[n],0);near(s.rotation[n],0);}
 near(s.principalInertiaKgM2.z,1);
}

await RAPIER.init();
const rows=[];
for(const initialOmega of [0,-15]){
 const base=new RAPIER.World({x:0,y:0,z:0});
 base.timestep=DT;base.integrationParameters.numSolverIterations=6;
 try{
  const anchor=base.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const body=base.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setLinearDamping(0).setAngularDamping(0));
  // Side length 1 m, mass 6 kg: each principal inertia is m*(1²+1²)/12 = 1 kg m².
  base.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setMass(6),body);
  const joint=base.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:1}),anchor,body,true);
  base.step(); // Resolve initial mass properties with zero motion and an unconfigured motor.
  body.setAngvel({x:0,y:0,z:initialOmega},true);
  const snapshot=base.takeSnapshot(),snapshotSha256=hash(snapshot),handles={body:body.handle,joint:joint.handle};
  const plans=initialOmega===0
   ? [{name:'free_rest',motor:false,targetVel:0},{name:'capped_position',motor:true,targetVel:0},{name:'capped_position_plus_target_velocity',motor:true,targetVel:15}]
   : [{name:'free_spinning',motor:false,targetVel:0},{name:'capped_position_plus_braking',motor:true,targetVel:0}];
  for(const plan of plans){
   const world=RAPIER.World.restoreSnapshot(snapshot);
   try{
    const b=world.getRigidBody(handles.body),j=world.getImpulseJoint(handles.joint),before=state(b);
    verifyAxisAndFinite(before);near(before.omegaRadps.z,initialOmega);
    near(before.rotation.w,1);assert.equal(j.type(),RAPIER.JointType.Revolute);
    assert.equal(j.limitsEnabled(),false);near(world.timestep,DT,1e-8);
    if(plan.motor){j.configureMotorModel(RAPIER.MotorModel.ForceBased);j.configureMotor(POSITION_TERM_CAP_NM/K,plan.targetVel,K,D);}
    assert.deepEqual(state(b),before,'Motor configuration must not directly mutate body state');
    world.step();const after=state(b);verifyAxisAndFinite(after);
    const meanNativeTorqueNm=before.principalInertiaKgM2.z*(after.omegaRadps.z-before.omegaRadps.z)/world.timestep;
    if(!plan.motor){near(meanNativeTorqueNm,0);near(after.kineticJ,before.kineticJ);}
    rows.push({name:plan.name,groupInitialOmegaRadps:initialOmega,snapshotSha256,
     initialPhysicalSha256:hash(JSON.stringify(before)),nativeRawAxis:j.rawAxis(),worldHingeAxis:{x:0,y:0,z:1},
     motor:plan.motor?{model:'ForceBased',targetPositionRad:POSITION_TERM_CAP_NM/K,targetVelocityRadps:plan.targetVel,stiffnessNmPerRad:K,dampingNmSPerRad:D,positionTermCapNm:POSITION_TERM_CAP_NM}:null,
     before,after,meanNativeMotorAndConstraintTorqueNm:meanNativeTorqueNm,positionTermCapExceeded:plan.motor&&Math.abs(meanNativeTorqueNm)>POSITION_TERM_CAP_NM,
     kineticChangeJ:after.kineticJ-before.kineticJ,finite:true,axisAndTranslationInvariant:true,mutationPreservesPhysicalState:true});
   }finally{world.free();}
  }
 }finally{base.free();}
}
const groupGuards=[0,-15].map(omega=>{
 const group=rows.filter(r=>r.groupInitialOmegaRadps===omega);
 return {initialOmegaRadps:omega,sameNativeSnapshot:new Set(group.map(r=>r.snapshotSha256)).size===1,samePhysicalStart:new Set(group.map(r=>r.initialPhysicalSha256)).size===1};
});
assert.ok(groupGuards.every(g=>g.sameNativeSnapshot&&g.samePhysicalStart));
const velocity=rows.find(r=>r.name==='capped_position_plus_target_velocity');
const braking=rows.find(r=>r.name==='capped_position_plus_braking');
assert.ok(velocity.positionTermCapExceeded,'Expected direct target-velocity counterexample');
assert.ok(braking.positionTermCapExceeded,'Expected direct braking counterexample');
const packageData=JSON.parse(await readFile(new URL('../../../node_modules/@dimforge/rapier3d-compat/package.json',import.meta.url),'utf8'));
const sourceAfter=hash(await readFile(new URL(import.meta.url)));
const result={probe:'native_motor_limit_probe',rapierVersion:packageData.version,sourceSha256:sourceBefore,sourceSha256After:sourceAfter,sourceStable:sourceBefore===sourceAfter,
 protocol:{timestepS:DT,solverIterations:6,stepsPerRow:1,geometry:'Fixed anchor and 6 kg isotropic cube, local/world Z revolute at COM; no fixed collider, contacts, gravity, body damping or sleep.',
  actualTorqueDefinition:'Iz * (omegaZ_after - omegaZ_before) / native timestep: mean net native motor+constraint torque over one step; no instantaneous torque claim.',
  api:'RevoluteImpulseJoint.configureMotor(targetPos,targetVel,k,d), ForceBased. Axis supplied to JointData.revolute is local Z; rawAxis is the native joint coordinate, not world Z index.',
  limits:'Position-error cap is reproduced, not a motor max-force API. Numeric inputs are engineering diagnostics, not human strength. Fixed-anchor reactions lie outside the dynamic-body energy boundary; whole-body launch cause and a game fix are not established.'},
 groupGuards,rows,pass:sourceBefore===sourceAfter&&rows.every(r=>r.finite&&r.axisAndTranslationInvariant)&&velocity.positionTermCapExceeded&&braking.positionTermCapExceeded};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({out:output,pass:result.pass,sourceStable:result.sourceStable,groupGuards,rows:rows.map(r=>({name:r.name,meanNativeTorqueNm:r.meanNativeMotorAndConstraintTorqueNm,capExceeded:r.positionTermCapExceeded,kineticChangeJ:r.kineticChangeJ,nativeRawAxis:r.nativeRawAxis}))}));
if(!result.pass)process.exitCode=1;
