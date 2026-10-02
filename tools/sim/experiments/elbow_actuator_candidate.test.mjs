/** Research-only actual Rapier and actual Fighter gates, no game source mutation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {RAPIER,THREE,DT,newRound} from '../harness_m.mjs';
import {installForceLedger,snapshotWorld} from '../force_ledger.mjs';
import {runStroke} from '../whole_body_strike_probe.mjs';
import {boundedElbowTorque,installElbowActuator,elbowGravityFeedforward} from './elbow_actuator_candidate.mjs';

const output=process.argv[2]||'/workspace/halfsword-hybrid-evidence/elbow-actuator-candidate-tests.json';
const repo=new URL('../../../',import.meta.url),tests=[],savedRandom=Math.random;
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const files=['src/fighter.js','src/gait.js','src/config.js','src/combat.js','src/weapons.js','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/experiments/bounded_joint_motor.mjs'];
const manifest=()=>Object.fromEntries(files.map(p=>[p,hash(fs.readFileSync(new URL(p,repo)))]));
const before=manifest(),V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion().copy(q),z=new THREE.Vector3(0,0,1);
const tol={torque:2e-3,angularMomentum:4e-6,nativeScalar:3e-6};
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t*(1+Math.abs(a)+Math.abs(b)),`${a} != ${b}; Float32 abs+relative ${t}`);
const nearVec=(a,b,t=1e-6)=>{for(const k of ['x','y','z'])near(a[k],b[k],t);};
const finite=x=>{if(typeof x==='number')assert.ok(Number.isFinite(x));else if(x&&typeof x==='object')Object.values(x).forEach(finite);};
async function test(name,fn){try{const details=await fn();tests.push({name,pass:true,details});console.log('PASS',name);}catch(e){tests.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}}
function freeHinge(q=new THREE.Quaternion()){
  const world=new RAPIER.World({x:0,y:0,z:0});world.timestep=DT;
  const bodies=[0,1].map(()=>{const b=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setRotation(q).setLinearDamping(0).setAngularDamping(0));world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setMass(6).setCollisionGroups(0),b);return b;});
  world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},z),...bodies,true);world.step();
  return {world,parent:bodies[0],child:bodies[1],axis:z.clone().applyQuaternion(q)};
}
const request=(G,extra={})=>({parent:G.parent,child:G.child,targetAngle:.2,targetVelocity:0,k:400,d:38,maxTorque:30,dt:DT,...extra});
await test('free dynamic hinge: PD plus FF total cap and measured equal/opposite angular response',()=>{
  const rows=[];
  for(const q of [new THREE.Quaternion(),new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,-.6,.2))]){
    const G=freeHinge(q);
    try{
      const pre=snapshotWorld(G.world),r=boundedElbowTorque(request(G,{targetVelocity:15,gravityFFNm:80}));
      assert.equal(r.limited,true);near(r.appliedNm,30,1e-10);
      // Clipping PD alone before adding FF would exceed 30; this clips the sum once.
      G.child.addTorque(r.torqueNm,true);G.parent.addTorque(V(r.torqueNm).negate(),true);
      nearVec(V(G.parent.userTorque()).add(V(G.child.userTorque())),{x:0,y:0,z:0},1e-7);
      G.world.step();const post=snapshotWorld(G.world);
      nearVec(post.total.P,pre.total.P,tol.angularMomentum);nearVec(post.total.L,pre.total.L,tol.angularMomentum);
      nearVec(V(G.child.angvel()).multiplyScalar(G.child.principalInertia().z/G.world.timestep),r.torqueNm,tol.torque);
      rows.push({result:r,deltaP:V(post.total.P).sub(V(pre.total.P)),deltaL:V(post.total.L).sub(V(pre.total.L)),actualChildOmega:G.child.angvel()});
    }finally{G.world.free();}
  }
  return {rows,FFPlacement:'Existing explicit gravity FF after implicit PD denominator, whole sum clipped.'};
});
await test('scalar equation preserves supplied target velocity, zero cap and finite validation',()=>{
  const G=freeHinge();try{
    G.child.setAngvel({x:0,y:0,z:3},true);
    const r=boundedElbowTorque(request(G,{targetVelocity:7,gravityFFNm:-4}));
    near(r.pdNm,(400*.2+(38+DT*400)*(7-3))/(1+2*(DT*38+DT*DT*400)),1e-8);
    near(r.requestedSignedNm,r.pdNm-4,1e-10);
    assert.equal(boundedElbowTorque(request(G,{maxTorque:0})).appliedNm,0);
    for(const change of [{dt:0},{k:-1},{targetVelocity:NaN},{gravityFFNm:Infinity}])assert.throws(()=>boundedElbowTorque(request(G,change)));
    return r;
  }finally{G.world.free();}
});
class Passive{update(){}}
function setup(){const G=newRound({seed:7,walls:false,AIClass:Passive});G.park();for(let i=0;i<12;i++)G.step();return G;}
function bodyState(world){const out=[];world.forEachRigidBody(b=>out.push({handle:b.handle,p:{...b.translation()},q:{...b.rotation()},v:{...b.linvel()},w:{...b.angvel()},mass:b.mass()}));return out;}
await test('actual farmS observe/recreate/bounded installation preserves body/control/joint spec; bounded native motor truly never configured',()=>{
  const rows=[];
  for(const mode of ['observe','recreate','bounded']){
    const G=setup(),ledger=installForceLedger(G,{fighters:[G.player],maxSamples:1}),f=G.player,j=f.jointByName.farmS;
    const old=j.joint,count=G.world.impulseJoints.len(),raw=old.rawSet,original=raw.jointConfigureMotor;
    let actualNativeCalls=0,install;
    raw.jointConfigureMotor=function(handle,...args){if(handle===j.joint.handle)actualNativeCalls++;return original.call(this,handle,...args);};
    try{
      install=installElbowActuator({G,f,ledger,mode});
      assert.equal(G.world.impulseJoints.len(),count);assert.deepEqual(install.summary.specAfter,install.summary.specBefore);
      assert.equal(install.summary.bodyBeforeSHA256,install.summary.bodyAfterSHA256);assert.equal(install.summary.previousInputSHA256,install.summary.inputAfterSHA256);
      assert.equal(old.isValid(),mode==='observe');assert.equal(install.summary.nativeMotorModelConfigured,mode==='recreate');
      for(let i=0;i<24;i++)G.step();finite(bodyState(G.world));
      assert.equal(install.summary.nativeCallsIntercepted,24);
      if(mode==='bounded'){
        assert.equal(actualNativeCalls,0);assert.equal(install.summary.nativeCallsForwarded,0);assert.equal(install.summary.actuatorCalls,24);
        assert.ok(install.summary.maxCapRatio<=1+1e-12);
        const ops=ledger.latest.operations.filter(e=>e.method==='addTorque'&&e.path.endsWith('fighter[0].elbowGravity'));
        assert.equal(ops.length,2);nearVec(V(ops[0].input).add(V(ops[1].input)),{x:0,y:0,z:0},1e-9);
        near(V(ops[0].input).length(),install.summary.last.appliedNm,1e-10);
      }else assert.equal(actualNativeCalls,24);
      rows.push({mode,actualNativeCalls,summary:install.summary,lastRecords:install.records.slice(-2)});
    }finally{install?.restore();raw.jointConfigureMotor=original;ledger.restore();G.eventQueue.free();G.world.free();}
  }
  return rows;
});
await test('actual native Hill-position input and prevRV reset are preserved without invented velocity feedforward',()=>{
  const G=setup(),f=G.player,ledger=installForceLedger(G,{fighters:[f],maxSamples:0}),j=f.jointByName.farmS;
  const install=installElbowActuator({G,f,ledger,mode:'bounded'});
  try{
    const axis=z.clone().applyQuaternion(Q(j.parent.rotation())),cur=boundedElbowTorque({parent:j.parent,child:j.child,restInv:j.restInv,targetAngle:0,targetVelocity:0,k:400,d:38,maxTorque:80,dt:DT}).thetaRad;
    // Explicit synthetic angular-velocity initial condition, not a per-frame freeze.
    j.parent.setAngvel({x:0,y:0,z:0},true);j.child.setAngvel(axis.clone().multiplyScalar(.5*f.weaponCfg.elbowVmax),true);
    j.target.copy(Q(j.restInv).invert().multiply(new THREE.Quaternion().setFromAxisAngle(z,cur+1)));
    j.prevRV=null;f.driveJoints();f.elbowGravity();const first=install.summary.last.nativeInput;
    assert.equal(first.targetVelocityReset,true);near(first.targetVelocity,0,1e-12);
    const baseMaxError=first.maxTorque/Math.max(1,first.k),hillHalf=(1-.5)/(1+.5/.25);
    near(first.targetAngle-cur,baseMaxError*hillHalf,tol.nativeScalar);
    j.target.multiply(new THREE.Quaternion().setFromAxisAngle(z,.02));f.driveJoints();f.elbowGravity();const next=install.summary.last.nativeInput;
    assert.equal(next.targetVelocityReset,false);near(next.targetVelocity,.02/f.lastDt,tol.nativeScalar);
    near(next.maxTorque,j.max*(next.k/(j.k*(j.gain||1))),1e-10);
    return {first,next,scope:'Native stiffness position target retains existing Hill; final total torque cap is j.max*mus, no extra Hill curve on damping/FF.'};
  }finally{install.restore();ledger.restore();G.eventQueue.free();G.world.free();}
});
await test('FF computation matches actual legacy elbowGravity and respects disabled/detached states',()=>{
  const G=setup(),f=G.player,j=f.jointByName.farmS;
  try{
    for(const b of [j.parent,j.child])b.resetTorques(true);
    const ff=elbowGravityFeedforward(f,j),axis=z.clone().applyQuaternion(Q(j.parent.rotation()));f.elbowGravity();
    nearVec(j.child.userTorque(),axis.clone().multiplyScalar(ff.torqueNm),2e-5);
    nearVec(V(j.parent.userTorque()).add(V(j.child.userTorque())),{x:0,y:0,z:0},2e-5);
    const active=ff;f.state='dead';assert.equal(elbowGravityFeedforward(f,j).torqueNm,0);
    f.state='stand';f.muscle=.1;assert.equal(elbowGravityFeedforward(f,j).torqueNm,0);
    f.muscle=1;f.detachedParts=new Set(['farmS']);assert.equal(elbowGravityFeedforward(f,j).torqueNm,0);
    return {active,disabledZero:true};
  }finally{G.eventQueue.free();G.world.free();}
});
await test('single actual longsword down stroke: native clone and recreation gates; observer trace exact; bound measured',()=>{
  const rows=[];
  for(const mode of ['baseline','observe','recreate','bounded']){
    let install,gate=null;
    const intervention=mode==='baseline'?null:{activate({G,f,ledger}){
      const native=G.world.takeSnapshot(),clone=RAPIER.World.restoreSnapshot(native);
      try{assert.deepEqual(bodyState(clone),bodyState(G.world));gate={nativeCloneBodiesExact:true,nativeSnapshotSHA256:hash(Buffer.from(native))};}finally{clone.free();}
      install=installElbowActuator({G,f,ledger,mode});
    },restore(){install?.restore();}};
    const stroke=runStroke({weapon:'longsword',direction:'down',reaction:'paired',ending:'release',seed:7,prepareS:3,durationS:.55,afterS:.5,sampleHz:30,
      ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:2,sampleEvery:60}),intervention});
    if(mode==='bounded'){assert.ok(install.summary.maxCapRatio<=1+1e-12);assert.equal(install.summary.nativeCallsForwarded,0);assert.ok(install.summary.actuatorCalls>0);}
    rows.push({mode,gate,stroke,installer:install?{summary:install.summary,records:install.records}:null});
  }
  const a=rows[0];assert.ok(rows.every(r=>r.stroke.startSha256===a.stroke.startSha256&&r.stroke.startNativeSha256===a.stroke.startNativeSha256&&r.stroke.inputSha256===a.stroke.inputSha256));
  assert.equal(rows[1].stroke.traceSha256,a.stroke.traceSha256);
  return {samePreparationAndRequestedInput:true,observerPhysicalControlTraceExact:true,recreationTraceEqualsBaseline:rows[2].stroke.traceSha256===a.stroke.traceSha256,
    recreationHistoryEffectMustBeSeparated:true,rows,scope:'One scripted actual arm stroke only; no naturalness, multi-weapon or damaged-body acceptance claim.'};
});
Math.random=savedRandom;
const after=manifest(),report={createdUTC:new Date().toISOString(),baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  command:'node tools/sim/experiments/elbow_actuator_candidate.test.mjs [outside-repo-output.json]',sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),
  tolerances:tol,Float32:'Actual Rapier Float32 state, explicit abs+relative measurement tolerances; no gameplay bounds copied from tests.',tests,
  limitations:['Free-pair implicit PD excludes coupled neighboring joints/contact reactions','Position Hill is inherited in tz only; total cap j.max*mus is not full force-velocity correction',
    'Recreation resets native solver history; observe and recreation-only controls retained','Single actual stroke is a state/dispatch gate, not human realism validation','No game src edits/public activation']};
report.pass=report.sourceStable&&tests.every(t=>t.pass);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,groups:tests.length,failed:tests.filter(t=>!t.pass).map(t=>t.name),sourceStable:report.sourceStable,output}));process.exitCode=report.pass?0:1;
