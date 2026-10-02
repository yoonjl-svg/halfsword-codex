// Research only: one-step impulse response of the actual standing constrained chain.
import {newRound,RAPIER,THREE,CONFIG,DT} from '../harness_m.mjs';
import {installBoundedLegMotors} from './bounded_joint_motor.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const ROOT=new URL('../../../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)??'/workspace/halfsword-hybrid-evidence/joint-response.json';
if(process.argv.slice(2).some(x=>!x.startsWith('--out=')))throw Error('Only --out=PATH is supported');
try{await access(output);throw Error('Refusing to overwrite evidence: '+output);}catch(e){if(e.code!=='ENOENT')throw e;}
async function manifest(){
  async function files(dir){const out=[];for(const e of await readdir(new URL(dir,ROOT),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
  const paths=[...await files('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/bounded_joint_motor.mjs','tools/sim/experiments/joint_response_probe.mjs','package-lock.json'];
  return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,hash(await readFile(new URL(p,ROOT)))])));
}
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),plain=v=>({x:v.x,y:v.y,z:v.z});
function state(world){const out=[];world.forEachRigidBody(b=>out.push({handle:String(b.handle),type:b.bodyType(),mass:b.mass(),p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel(),inertia:b.principalInertia(),inertiaFrame:b.principalInertiaLocalFrame(),sleeping:b.isSleeping(),force:b.userForce(),torque:b.userTorque()}));return out.sort((a,b)=>Number(a.handle)-Number(b.handle));}
function relative(world,j){return V(world.getRigidBody(j.child).angvel()).sub(V(world.getRigidBody(j.parent).angvel())).dot(V(j.axisWorld));}
function inertiaProjection(b,axis){const m=b.effectiveWorldInvInertia(),A=new THREE.Matrix3().set(m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33);return axis.dot(axis.clone().applyMatrix3(A));}
function contacts(world,handles){const bodies=Object.fromEntries(Object.entries(handles).map(([n,h])=>[n,world.getRigidBody(h)]));const c=collectSupportContacts({world,bodies},{detail:false});return {anySupport:c.anySupport,groups:Object.fromEntries(Object.entries(c.groups).map(([n,g])=>[n,{hasSupport:g.hasSupport,rawNormalImpulseNs:g.rawNormalImpulseNs,supportRawNormalImpulseNs:g.supportRawNormalImpulseNs}]))};}
const startManifest=await manifest(),savedRandom=Math.random;
const result={schema:1,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHashes:startManifest,
  definition:'One-step projected relative angular response to paired torque impulses in the actual standing chain. Contacts, upper native motors, upright motor and passive constraints remain coupled. This is not intrinsic inertia or a human material-property estimate.',
  preparation:{seed:7,seconds:3,gapM:8,walls:false,AI:'passive both fighters',controllerUpdatesDuringBranches:0},
  forcePolicy:'After ordinary preparation and six leg joint recreation, resetForces(true) and resetTorques(true) on every dynamic world body once, then take the shared native snapshot. Every branch restores that exact snapshot; gravity and native motor settings stay fixed.',branches:[],responses:[],guards:{}};
class Passive{update(){}}
let G,installed;
try{
  G=newRound({seed:7,walls:false,gap:8,AIClass:Passive});
  for(let i=0;i<Math.round(3/DT);i++)G.step();
  const f=G.player;
  if(f.state!=='stand')throw Error('Ordinary preparation is not standing: '+f.state);
  result.preparation.observed={timeS:G.t,state:f.state,pelvis:f.bodies.pelvis.translation(),omega:f.bodies.pelvis.angvel(),support:contacts(G.world,Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,b.handle])))};
  const before=hash(JSON.stringify(state(G.world))),countBefore=G.world.impulseJoints.len();
  installed=installBoundedLegMotors({G,f,mode:'bounded'});
  result.guards.recreationPreservesBodies=before===hash(JSON.stringify(state(G.world)));
  result.guards.jointCountPreserved=countBefore===G.world.impulseJoints.len();
  result.guards.noLegMotorRequests=installed.summary.nativeCallsIntercepted===0;
  G.world.forEachRigidBody(b=>{if(b.isDynamic()){b.resetForces(true);b.resetTorques(true);}});
  const bodyHandles=Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,b.handle]));
  const joints=['thighF','shinF','footF'].map(name=>{const j=f.jointByName[name],axis=new THREE.Vector3(0,0,1).applyQuaternion(Q(j.parent.rotation()));return {name,parent:j.parent.handle,child:j.child.handle,joint:j.joint.handle,axisWorld:plain(axis),freePairInverseInertia:inertiaProjection(j.parent,axis)+inertiaProjection(j.child,axis)};});
  const snapshot=G.world.takeSnapshot(),initialBodyHash=hash(JSON.stringify(state(G.world)));
  result.checkpoint={nativeSha256:hash(snapshot),bodySha256:initialBodyHash,dt:DT,gravity:{...G.world.gravity},solverIterations:G.world.integrationParameters.numSolverIterations,joints,bodyState:state(G.world),legMotorState:'six recreated joints never configured; upper native motors and upright retained',configuration:{supportModel:CONFIG.BODY.supportModel??'unspecified',weightMode:CONFIG.BODY.weightMode,assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode}};
  function branch(j,impulse){
    const world=RAPIER.World.restoreSnapshot(snapshot),queue=new RAPIER.EventQueue(true);
    try{
      const initialHash=hash(JSON.stringify(state(world))),nativeHash=hash(world.takeSnapshot());
      result.restoreDiagnostics??=[];
      result.restoreDiagnostics.push({joint:j.name,impulseNms:impulse,initialBodySha256:initialHash,reserializedNativeSha256:nativeHash,
        nativeReserializationExact:nativeHash===result.checkpoint.nativeSha256,
        bodyDifferences:initialHash===initialBodyHash?[]:state(world).flatMap((b,i)=>JSON.stringify(b)===JSON.stringify(result.checkpoint.bodyState[i])?[]:[{original:result.checkpoint.bodyState[i],restored:b}])});
      if(initialHash!==initialBodyHash)throw Error('Restored initial body state mismatch');
      if(nativeHash!==result.restoreDiagnostics[0].reserializedNativeSha256)throw Error('Restored native branch states differ');
      const before=relative(world,j),axis=V(j.axisWorld).multiplyScalar(impulse);
      if(impulse!==0){world.getRigidBody(j.child).applyTorqueImpulse(plain(axis),true);world.getRigidBody(j.parent).applyTorqueImpulse(plain(axis.negate()),true);}
      const immediate=relative(world,j);
      world.step(queue,G.combat.physicsHooks);
      const after=relative(world,j),postState=state(world);
      if(!Number.isFinite(after)||postState.some(b=>![...Object.values(b.p),...Object.values(b.q),...Object.values(b.v),...Object.values(b.w)].every(Number.isFinite)))throw Error('Nonfinite response');
      const row={joint:j.name,impulseNms:impulse,initialBodySha256:initialHash,initialNativeSha256:nativeHash,relativeOmegaBeforeRadS:before,relativeOmegaImmediateRadS:immediate,relativeOmegaAfterRadS:after,postBodySha256:hash(JSON.stringify(postState)),supportAfter:contacts(world,bodyHandles),bodyStateAfter:postState};result.branches.push(row);return row;
    }finally{queue.free();world.free();}
  }
  for(const j of joints){
    const zero=branch(j,0),repeat=branch(j,0);
    if(zero.postBodySha256!==repeat.postBodySha256)throw Error('Zero replay is not deterministic');
    for(const size of [.001,.01,.1]){
      const plus=branch(j,size),minus=branch(j,-size),p=(plus.relativeOmegaAfterRadS-zero.relativeOmegaAfterRadS)/size,m=(minus.relativeOmegaAfterRadS-zero.relativeOmegaAfterRadS)/(-size),central=(plus.relativeOmegaAfterRadS-minus.relativeOmegaAfterRadS)/(2*size),even=(plus.relativeOmegaAfterRadS+minus.relativeOmegaAfterRadS-2*zero.relativeOmegaAfterRadS)/2;
      const immediateP=(plus.relativeOmegaImmediateRadS-plus.relativeOmegaBeforeRadS)/size,immediateM=(minus.relativeOmegaImmediateRadS-minus.relativeOmegaBeforeRadS)/(-size);
      result.responses.push({joint:j.name,impulseMagnitudeNms:size,freePairInverseInertia:j.freePairInverseInertia,immediatePlusGain:immediateP,immediateMinusGain:immediateM,immediateRelativeTolerance:2e-6,plusMinusZeroGain:p,minusMinusZeroGain:m,centralGain:central,centralToFreePairRatio:central/j.freePairInverseInertia,evenResponseRadS:even,plusMinusGainDifference:p-m});
      if(Math.abs(immediateP-j.freePairInverseInertia)>2e-6*Math.max(1,j.freePairInverseInertia)||Math.abs(immediateM-j.freePairInverseInertia)>2e-6*Math.max(1,j.freePairInverseInertia))throw Error('Immediate impulse does not match free-pair prediction within Float32 tolerance');
    }
  }
  result.guards.sameInitialState=true;result.guards.sameRestoredNativeInitialState=true;result.guards.deterministicZeroReplay=true;result.guards.finiteResponses=true;result.guards.immediateFreePairPrediction=true;
}catch(error){result.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{installed?.restore();G?.eventQueue.free();G?.world.free();Math.random=savedRandom;}
result.sourceHashesAfter=await manifest();result.guards.sourceStable=JSON.stringify(startManifest)===JSON.stringify(result.sourceHashesAfter);
if(!result.guards.sourceStable||Object.values(result.guards).some(x=>x!==true))process.exitCode=1;
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,error:result.error??null,guards:result.guards,responses:result.responses},null,2));
