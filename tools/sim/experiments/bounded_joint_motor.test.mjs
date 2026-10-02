// Research actuator tests; passive joint/contact forces are outside the tested actuator cap.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {RAPIER,THREE,newRound,DT} from '../harness_m.mjs';
import {boundedJointTorque,applyBoundedJointTorque,installBoundedLegMotors} from './bounded_joint_motor.mjs';

const output=process.argv[2]||'/workspace/halfsword-hybrid-evidence/bounded-joint-motor-tests.json';
const hash=x=>createHash('sha256').update(x).digest('hex');
const files=['bounded_joint_motor.mjs','bounded_joint_motor.test.mjs'];
const sources=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(new URL(p,import.meta.url)))])));
const sourceBefore=await sources(),tests=[];
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const zAxis=new THREE.Vector3(0,0,1),identity=()=>new THREE.Quaternion();
const near=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}, tolerance ${tol}`);
const nearVector=(a,b,tol=1e-5)=>{for(const k of ['x','y','z'])near(a[k],b[k],tol);};
const finite=x=>{if(typeof x==='number')assert.ok(Number.isFinite(x));else if(x&&typeof x==='object')Object.values(x).forEach(finite);};
async function test(name,fn){try{const details=await fn();tests.push({name,pass:true,details});console.log('PASS',name);}catch(e){tests.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}}
function physical(b){return {p:{...b.translation()},q:{...b.rotation()},v:{...b.linvel()},w:{...b.angvel()},mass:b.mass(),I:{...b.principalInertia()},force:{...b.userForce()},torque:{...b.userTorque()}};}
function fixture({dynamicParent=false,rotation=identity(),hinge=true}={}){
 const world=new RAPIER.World({x:0,y:0,z:0});world.timestep=DT;world.integrationParameters.numSolverIterations=6;
 const make=dynamic=>{
  const desc=dynamic?RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setLinearDamping(0).setAngularDamping(0):RAPIER.RigidBodyDesc.fixed();
  const b=world.createRigidBody(desc.setRotation(rotation));
  if(dynamic)world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setMass(6).setCollisionGroups(0),b);
  return b;
 };
 const parent=make(dynamicParent),child=make(true),zero={x:0,y:0,z:0};
 const joint=world.createImpulseJoint(hinge?RAPIER.JointData.revolute(zero,zero,zAxis):RAPIER.JointData.spherical(zero,zero),parent,child,true);
 world.step();near(child.principalInertia().z,1);
 return {world,parent,child,joint};
}
const request=(f,extra={})=>({parent:f.parent,child:f.child,target:identity(),dt:DT,k:1600,d:100,maxTorque:500,...extra});
function K(b){const I=b.principalInertia();near(I.x,I.y);near(I.y,I.z);return .5*I.z*V(b.angvel()).lengthSq()+.5*b.mass()*V(b.linvel()).lengthSq();}

await test('fixed COM hinge: position, target velocity and initial spin remain within actual 500 Nm impulse bound',()=>{
 const f=fixture(),rows=[];
 try{
  const native=f.world.takeSnapshot(),handles={parent:f.parent.handle,child:f.child.handle};
  for(const [name,initialOmega,targetVelocity] of [['position',0,0],['target_velocity',0,15],['braking',-15,0]]){
   const world=RAPIER.World.restoreSnapshot(native);
   try{
    const parent=world.getRigidBody(handles.parent),child=world.getRigidBody(handles.child);
    child.setAngvel({x:0,y:0,z:initialOmega},true);
    const before=physical(child),initialK=K(child),angle=500/1600;
    const r=applyBoundedJointTorque(request({parent,child},{target:new THREE.Quaternion().setFromAxisAngle(zAxis,angle),previousTarget:new THREE.Quaternion().setFromAxisAngle(zAxis,angle-targetVelocity*DT),axisWorld:zAxis}));
    finite(r);assert.ok(r.appliedNm<=500+1e-9);nearVector(child.userTorque(),r.torqueNm,1e-4);
    world.step();const actual=V(child.angvel()).sub(V(before.w)).multiplyScalar(child.principalInertia().z/world.timestep);
    nearVector(actual,r.torqueNm,.002);assert.ok(actual.length()<=500.002);nearVector(child.translation(),{x:0,y:0,z:0});nearVector(child.linvel(),{x:0,y:0,z:0});
    // Float32 angular-velocity residue divided by dt amplifies the off-axis torque floor.
    near(actual.x,0,1e-4);near(actual.y,0,1e-4);
    if(name!=='position')assert.equal(r.limited,true);
    rows.push({name,initialOmega,targetVelocity,appliedNm:r.appliedNm,requestedNm:r.requestedNm,actualMeanTorqueNm:actual.toArray(),deltaKJ:K(child)-initialK});
   }finally{world.free();}
  }
  return {snapshotSha256:hash(native),rows,initialSpinIsAnExplicitFixtureInput:true};
 }finally{f.world.free();}
});

await test('three-axis vector cap and equal/opposite torques conserve free-pair angular momentum',()=>{
 const f=fixture({dynamicParent:true,hinge:false});
 try{
  f.parent.setAngvel({x:-2,y:1,z:.5},true);f.child.setAngvel({x:3,y:-4,z:5},true);
  const beforeP=V(f.parent.angvel()),beforeC=V(f.child.angvel()),L=beforeP.clone().add(beforeC);
  const r=applyBoundedJointTorque(request(f,{target:new THREE.Quaternion().setFromEuler(new THREE.Euler(.8,-.6,.9)),previousTarget:identity(),maxTorque:25}));
  assert.equal(r.limited,true);near(r.appliedNm,25,1e-9);assert.ok(Object.values(r.torqueNm).every(x=>Math.abs(x)>1e-3));
  nearVector(V(f.parent.userTorque()).add(V(f.child.userTorque())),{x:0,y:0,z:0},1e-7);
  f.world.step();const afterP=V(f.parent.angvel()),afterC=V(f.child.angvel());
  const residual=afterP.clone().add(afterC).sub(L);nearVector(residual,{x:0,y:0,z:0},2e-6);
  const actualC=afterC.sub(beforeC).multiplyScalar(1/f.world.timestep),actualP=afterP.sub(beforeP).multiplyScalar(1/f.world.timestep);
  nearVector(actualC,r.torqueNm,.001);nearVector(actualP,V(r.torqueNm).negate(),.001);
  for(const b of [f.parent,f.child])nearVector(b.linvel(),{x:0,y:0,z:0});
  return {appliedVectorNm:r.torqueNm,actualChildMeanNm:actualC.toArray(),angularMomentumResidualNms:residual.toArray()};
 }finally{f.world.free();}
});

await test('tilted local-Z hinge projects onto the current world hinge axis',()=>{
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.45,.65,-.2)),f=fixture({rotation}),axis=zAxis.clone().applyQuaternion(rotation);
 try{
  const r=applyBoundedJointTorque(request(f,{target:new THREE.Quaternion().setFromEuler(new THREE.Euler(.5,-.3,.8)),previousTarget:identity(),axisWorld:axis,maxTorque:40}));
  near(V(r.torqueNm).cross(axis).length(),0,1e-8);assert.ok(r.appliedNm<=40+1e-9);
  f.world.step();const actual=V(f.child.angvel()).multiplyScalar(f.child.principalInertia().z/f.world.timestep);
  nearVector(actual,r.torqueNm,.002);near(actual.clone().cross(axis).length(),0,.002);nearVector(f.child.translation(),{x:0,y:0,z:0});
  return {worldAxis:axis.toArray(),appliedVectorNm:r.torqueNm,actualMeanVectorNm:actual.toArray()};
 }finally{f.world.free();}
});

await test('damping-only actuator dissipates energy; zero cap is passive; invalid requests are atomic',()=>{
 const f=fixture();
 try{
  f.child.setAngvel({x:0,y:0,z:10},true);const initialK=K(f.child);
  const r=applyBoundedJointTorque(request(f,{k:0,d:100,maxTorque:20,axisWorld:zAxis}));
  near(r.appliedNm,20,1e-9);assert.ok(r.torqueNm.z<0);f.world.step();assert.ok(K(f.child)<initialK);
  f.parent.resetTorques(true);f.child.resetTorques(true);
  const zero=applyBoundedJointTorque(request(f,{maxTorque:0}));near(zero.appliedNm,0);nearVector(f.child.userTorque(),{x:0,y:0,z:0});
  // Existing force/torque accumulators must also be untouched by rejected requests.
  f.child.addTorque({x:1,y:2,z:3},true);
  const before=[physical(f.parent),physical(f.child)];
  const invalid=[{dt:0},{dt:NaN},{k:-1},{d:Infinity},{maxTorque:-1},{maxTargetSpeed:NaN},{target:{x:0,y:0,z:0,w:0}},{previousTarget:{x:0,y:NaN,z:0,w:1}},{axisWorld:{x:0,y:0,z:0}}];
  for(const extra of invalid){assert.throws(()=>applyBoundedJointTorque(request(f,extra)));assert.deepEqual([physical(f.parent),physical(f.child)],before);}
  return {initialKJ:initialK,afterDampingKJ:K(f.child),dampingTorqueNm:r.torqueNm.z,invalidRequestsRejected:invalid.length,atomicBodyAndAccumulators:true};
 }finally{f.world.free();}
});

function gameState(f){return Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,physical(b)]));}
function jointSpec(j){const raw=j.joint.rawSet,axes=j.type==='hinge'?[3]:[3,4,5];return {a1:{...j.joint.anchor1()},a2:{...j.joint.anchor2()},frame1:{...j.joint.frameX1()},frame2:{...j.joint.frameX2()},contacts:j.joint.contactsEnabled(),limits:axes.map(a=>({axis:a,on:raw.jointLimitsEnabled(j.joint.handle,a),min:raw.jointLimitsMin(j.joint.handle,a),max:raw.jointLimitsMax(j.joint.handle,a)}))};}
await test('actual Fighter installation preserves bodies/constraints; bounded legs never configure native motors',()=>{
 class Passive{update(){}}
 const results=[],savedRandom=Math.random;
 try{
  for(const mode of ['bounded','recreate']){
   const G=newRound({seed:7,walls:false,AIClass:Passive});let install,raw,oldRaw;
   try{
    G.park();for(let i=0;i<12;i++)G.step();
    const f=G.player,legs=f.joints.filter(j=>/^(thigh|shin|foot)[FB]$/.test(j.name)),prior=gameState(f),specs=legs.map(jointSpec),oldJoints=legs.map(j=>j.joint),count=G.world.impulseJoints.len();
    raw=f.uprightJoint.rawSet;oldRaw=raw.jointConfigureMotor;let nativeLegCalls=0;
    raw.jointConfigureMotor=function(handle,...args){if(legs.some(j=>j.joint.handle===handle))nativeLegCalls++;return oldRaw.call(this,handle,...args);};
    install=installBoundedLegMotors({G,f,mode});
    assert.deepEqual(gameState(f),prior);assert.deepEqual(legs.map(jointSpec),specs);assert.equal(G.world.impulseJoints.len(),count);assert.ok(oldJoints.every(j=>!j.isValid()));
    for(let i=0;i<24;i++)G.step();finite(gameState(f));
    assert.equal(install.summary.nativeCallsIntercepted,24*14);
    if(mode==='bounded'){
     assert.equal(nativeLegCalls,0);assert.equal(install.summary.actuatorCalls,24*6);assert.equal(Object.keys(install.summary.perJoint).length,6);assert.ok(install.summary.maxCapRatio<=1+1e-12);
    }else{assert.equal(nativeLegCalls,24*14);assert.equal(install.summary.actuatorCalls,0);}
    results.push({mode,bodyStatePreserved:true,jointSpecsPreserved:true,nativeJointCount:count,nativeLegCalls,summary:install.summary,simulationSteps:24});
   }finally{install?.restore();if(raw&&oldRaw)raw.jointConfigureMotor=oldRaw;G.eventQueue.free();G.world.free();}
  }
 }finally{Math.random=savedRandom;}
 return {results,scope:'Installation plus 24 steps checks dispatch/finite actuator operation, not recovery or gait acceptance. Recreated passive constraints and contacts remain outside the actuator cap.'};
});

await test('actual gait resetRates suppresses first target-velocity feedforward and resumes it on the next update',()=>{
 class Passive{update(){}}
 const savedRandom=Math.random,G=newRound({seed:7,walls:false,AIClass:Passive});let install;
 try{
  G.park();for(let i=0;i<12;i++)G.step();
  const f=G.player,legs=f.joints.filter(j=>/^(thigh|shin|foot)[FB]$/.test(j.name));
  install=installBoundedLegMotors({G,f,mode:'bounded'});
  const drive=()=>{for(const b of Object.values(f.bodies))b.resetTorques(true);f.driveJoints();};
  const changeTargets=angle=>{const change=new THREE.Quaternion().setFromAxisAngle(zAxis,angle);for(const j of legs)j.target.multiply(change);};
  drive();changeTargets(.06);drive();
  for(const j of legs){const p=install.summary.perJoint[j.name];assert.equal(p.lastTargetVelocityReset,false);assert.ok(V(p.lastDesiredOmegaRadS).length()>1);}
  changeTargets(.4);
  f.gait.resetRates();assert.ok(legs.every(j=>j.prevRV===null));
  const resetsBefore=install.summary.targetVelocityResets;
  drive();assert.equal(install.summary.targetVelocityResets-resetsBefore,6);
  const firstAfterReset=legs.map(j=>{
   const p=install.summary.perJoint[j.name];assert.equal(p.lastTargetVelocityReset,true);near(V(p.lastDesiredOmegaRadS).length(),0,1e-12);
   return {name:j.name,desiredOmegaRadS:{...p.lastDesiredOmegaRadS},reset:p.lastTargetVelocityReset};
  });
  changeTargets(.025);drive();assert.equal(install.summary.targetVelocityResets-resetsBefore,6);
  const resumed=legs.map(j=>{
   const p=install.summary.perJoint[j.name];assert.equal(p.lastTargetVelocityReset,false);assert.ok(V(p.lastDesiredOmegaRadS).length()>1);
   return {name:j.name,desiredSpeedRadS:V(p.lastDesiredOmegaRadS).length()};
  });
  return {firstAfterReset,resumed,oneResetPerLeg:true,scope:'Real Fighter.driveJoints and Gait.resetRates with synthetic target jumps; checks controller history semantics, not whole-body recovery.'};
 }finally{install?.restore();G.eventQueue.free();G.world.free();Math.random=savedRandom;}
});

const sourceAfter=await sources(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
const result={probe:'bounded_joint_motor_tests',sourceBefore,sourceAfter,sourceStable,pass:sourceStable&&tests.every(t=>t.pass),tests,
 scope:'Isotropic COM fixtures measure actuator angular impulse; free-pair implicit inverse inertia is an approximation. Passive constraints/contact reactions and other game actuators are not globally torque-bounded. Synthetic inputs and numerical tolerances are not human strength limits.'};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({out:output,pass:result.pass,groups:tests.length,failed:tests.filter(t=>!t.pass).map(t=>t.name),sourceStable}));
if(!result.pass)process.exitCode=1;
