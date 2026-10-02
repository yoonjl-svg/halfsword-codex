// Research only. Capture natural recovery, then identify one-step constrained response.
import {withOriginalRecovery,runSameLyingRecovery} from './same_lying_recovery_probe.mjs';
import {installBoundedLegMotors} from './bounded_joint_motor.mjs';
import {RAPIER,THREE,DT} from '../harness_m.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const ROOT=new URL('../../../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>!/^--out=.+$/.test(x)))throw Error('Only --out=PATH supported');
const output=args[0]?.slice(6)??'/workspace/halfsword-hybrid-evidence/recovery-joint-response.json';
try{await access(output);throw Error('Refusing to overwrite evidence: '+output);}catch(e){if(e.code!=='ENOENT')throw e;}
async function manifest(){
  async function files(dir){const out=[];for(const e of await readdir(new URL(dir,ROOT),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
  const paths=[...await files('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/same_lying_recovery_probe.mjs','tools/sim/experiments/bounded_joint_motor.mjs','tools/sim/experiments/recovery_joint_response_probe.mjs','docs/strike/same_lying_recovery_summary.json','package-lock.json'];
  return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,hash(await readFile(new URL(p,ROOT)))])));
}
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),plain=v=>({x:v.x,y:v.y,z:v.z});
function state(world){const out=[];world.forEachRigidBody(b=>out.push({handle:String(b.handle),type:b.bodyType(),mass:b.mass(),p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel(),inertia:b.principalInertia(),inertiaFrame:b.principalInertiaLocalFrame(),sleeping:b.isSleeping(),force:b.userForce(),torque:b.userTorque()}));return out.sort((a,b)=>Number(a.handle)-Number(b.handle));}
function relative(world,j){return V(world.getRigidBody(j.child).angvel()).sub(V(world.getRigidBody(j.parent).angvel())).dot(V(j.axisWorld));}
function invProjection(b,axis){const m=b.effectiveWorldInvInertia(),A=new THREE.Matrix3().set(m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33);return axis.dot(axis.clone().applyMatrix3(A));}
function support(world,handles){const bodies=Object.fromEntries(Object.entries(handles).map(([n,h])=>[n,world.getRigidBody(h)]));const c=collectSupportContacts({world,bodies},{detail:false});return {anySupport:c.anySupport,groups:Object.fromEntries(Object.entries(c.groups).map(([n,g])=>[n,{hasSupport:g.hasSupport,rawNormalImpulseNs:g.rawNormalImpulseNs,supportRawNormalImpulseNs:g.supportRawNormalImpulseNs}]))};}
function capture(G,f,scenario,phase,timeS){
  const bodyState=state(G.world),snapshot=G.world.takeSnapshot(),bodyHandles=Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,b.handle]));
  const descriptor={scenario,phase,timeS,state:f.state,pelvisHeightM:f.bodies.pelvis.translation().y,chestTiltDeg:f.tiltDeg(),levH:f.gait.levH,
    limbs:{...f.limbs},muscle:f.muscle,uprightScale:f.balanceProbe?.uprightScale??null,
    nativeSha256:hash(snapshot),bodySha256:hash(JSON.stringify(bodyState)),bodyState,bodyHandles,uprightHandle:f.uprightJoint.handle,
    support:support(G.world,bodyHandles),joints:f.joints.map(j=>({name:j.name,handle:j.joint.handle,parent:j.parent.handle,child:j.child.handle,type:j.type,manual:j.manual,k:j.k,d:j.d,max:j.max,gain:j.gain??1,target:j.target.toArray(),prevRV:j.prevRV?.toArray()??null,restInv:j.restInv.toArray()}))};
  if(hash(JSON.stringify(state(G.world)))!==descriptor.bodySha256)throw Error('Capture changed live body state');
  return {descriptor,snapshot,hooks:G.combat.physicsHooks};
}
function measure(saved){
  const {descriptor,snapshot,hooks}=saved,world=RAPIER.World.restoreSnapshot(snapshot);
  const row={...descriptor,branches:[],responses:[],guards:{},definition:'Fresh restore of the recorded natural pose; only six leg joints recreated unconfigured, equal force/torque reset, then paired impulses and one native step without controller update. Upper motors/upright retained as recorded. Local response includes contact, motor damping and passive constraints; not intrinsic inertia.'};
  let installed;
  try{
    if(hash(JSON.stringify(state(world)))!==descriptor.bodySha256)throw Error('Captured snapshot restore changes body state');
    row.guards.captureBodyExact=true;
    const bodies=Object.fromEntries(Object.entries(descriptor.bodyHandles).map(([n,h])=>[n,world.getRigidBody(h)]));
    const f={bodies,uprightJoint:world.getImpulseJoint(descriptor.uprightHandle),joints:descriptor.joints.map(j=>({...j,joint:world.getImpulseJoint(j.handle),parent:world.getRigidBody(j.parent),child:world.getRigidBody(j.child),target:new THREE.Quaternion().fromArray(j.target),prevRV:j.prevRV?new THREE.Vector3().fromArray(j.prevRV):null,restInv:new THREE.Quaternion().fromArray(j.restInv)}))};
    const before=hash(JSON.stringify(state(world))),count=world.impulseJoints.len();
    installed=installBoundedLegMotors({G:{world},f,mode:'bounded'});
    if(before!==hash(JSON.stringify(state(world)))||count!==world.impulseJoints.len())throw Error('Recreation changes body state or joint count');
    row.guards.recreationPreservesBodies=true;row.guards.jointCountPreserved=true;
    world.forEachRigidBody(b=>{if(b.isDynamic()){b.resetForces(true);b.resetTorques(true);}});
    const initial=state(world),native=world.takeSnapshot(),initialHash=hash(JSON.stringify(initial)),sourceHash=hash(native);
    row.responseCheckpoint={inputNativeSha256:sourceHash,bodySha256:initialHash,bodyState:initial,dt:world.timestep,gravity:{...world.gravity},solverIterations:world.integrationParameters.numSolverIterations,zeroLegMotorRequests:installed.summary.nativeCallsIntercepted===0};
    const joints=f.joints.filter(j=>['thighF','shinF','footF'].includes(j.name)).map(j=>{const axis=new THREE.Vector3(0,0,1).applyQuaternion(Q(j.parent.rotation()));return {name:j.name,parent:j.parent.handle,child:j.child.handle,axisWorld:plain(axis),freePairInverseInertia:invProjection(j.parent,axis)+invProjection(j.child,axis)};});
    row.responseCheckpoint.measuredJoints=joints;
    let restoredNativeHash;
    function branch(j,impulse){
      const w=RAPIER.World.restoreSnapshot(native),queue=new RAPIER.EventQueue(true);
      try{
        const bodyHash=hash(JSON.stringify(state(w))),nativeHash=hash(w.takeSnapshot());
        restoredNativeHash??=nativeHash;
        if(bodyHash!==initialHash||nativeHash!==restoredNativeHash)throw Error('Response branch initial state mismatch');
        const before=relative(w,j),axis=V(j.axisWorld).multiplyScalar(impulse);
        if(impulse!==0){w.getRigidBody(j.child).applyTorqueImpulse(plain(axis),true);w.getRigidBody(j.parent).applyTorqueImpulse(plain(axis.negate()),true);}
        const immediate=relative(w,j);w.step(queue,hooks);
        const after=relative(w,j),post=state(w);
        if(!Number.isFinite(after)||post.some(b=>![...Object.values(b.p),...Object.values(b.q),...Object.values(b.v),...Object.values(b.w)].every(Number.isFinite)))throw Error('Nonfinite response');
        const b={joint:j.name,impulseNms:impulse,inputSnapshotSha256:sourceHash,initialBodySha256:bodyHash,initialNativeSha256:nativeHash,originalReserializationExact:nativeHash===sourceHash,
          relativeOmegaBeforeRadS:before,relativeOmegaImmediateRadS:immediate,relativeOmegaAfterRadS:after,postBodySha256:hash(JSON.stringify(post)),supportAfter:support(w,descriptor.bodyHandles),bodyStateAfter:post};row.branches.push(b);return b;
      }finally{queue.free();w.free();}
    }
    for(const j of joints){
      const zero=branch(j,0),repeat=branch(j,0);
      if(zero.postBodySha256!==repeat.postBodySha256)throw Error('Zero replay differs');
      for(const size of [.001,.01]){
        const plus=branch(j,size),minus=branch(j,-size),p=(plus.relativeOmegaAfterRadS-zero.relativeOmegaAfterRadS)/size,m=(minus.relativeOmegaAfterRadS-zero.relativeOmegaAfterRadS)/(-size),central=(plus.relativeOmegaAfterRadS-minus.relativeOmegaAfterRadS)/(2*size),even=(plus.relativeOmegaAfterRadS+minus.relativeOmegaAfterRadS-2*zero.relativeOmegaAfterRadS)/2;
        const immediateP=(plus.relativeOmegaImmediateRadS-plus.relativeOmegaBeforeRadS)/size,immediateM=(minus.relativeOmegaImmediateRadS-minus.relativeOmegaBeforeRadS)/(-size);
        // Native Float32 velocities, particularly cancellation at large starting omega.
        const floatTolerance=2e-6*Math.max(1,j.freePairInverseInertia)+2e-7*Math.max(1,Math.abs(plus.relativeOmegaBeforeRadS))/size;
        row.responses.push({joint:j.name,impulseMagnitudeNms:size,freePairInverseInertia:j.freePairInverseInertia,immediatePlusGain:immediateP,immediateMinusGain:immediateM,immediateAbsoluteTolerance:floatTolerance,plusMinusZeroGain:p,minusMinusZeroGain:m,centralGain:central,centralToFreePairRatio:central/j.freePairInverseInertia,evenResponseRadS:even,plusMinusGainDifference:p-m});
        if(Math.abs(immediateP-j.freePairInverseInertia)>floatTolerance||Math.abs(immediateM-j.freePairInverseInertia)>floatTolerance)throw Error('Immediate free-pair gain mismatch outside Float32 tolerance');
      }
    }
    row.guards.sameInputSnapshot=true;row.guards.sameInitialBodyExact=true;row.guards.sameInitialNativeExact=true;row.guards.deterministicZero=true;row.guards.finite=true;row.guards.immediateFreePairPrediction=true;
    row.guards.neverConfiguredLegMotors=installed.summary.nativeCallsIntercepted===0;
  }catch(e){row.error=e.stack;throw Object.assign(e,{responseRow:row});}
  finally{installed?.restore();world.free();}
  return row;
}

const start=performance.now(),before=await manifest(),captures=[],rows=[],traceGuards=[];
const result={schema:1,probe:'natural_recovery_joint_response',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHashes:before,
  protocol:{scenarios:['healthy_getup','hurt_getup'],phases:['lowDown','firstStand'],impulsesNms:[.001,.01],axis:'parent local Z expressed in world, fixed at the checkpoint',controllerUpdatesPerBranch:0,physicsStepsPerBranch:1,
    forcePolicy:'All dynamic bodies resetForces(true)/resetTorques(true) identically before the shared response snapshot. No pose/velocity/mass setters. Gravity unchanged. Passive leg joint recreation drops leg solver history; upper/upright native retained. Cached native combat hooks are used; combat/controller updates are not run.',
    interpretation:'State-dependent coupled one-step response, not an exact effective inertia identification, a motor gain prescription, a recovery acceptance test or a human material measurement.'},traceGuards,rows,error:null};
try{
  await withOriginalRecovery(async reference=>{
    for(const scenario of result.protocol.scenarios){
      const original=runSameLyingRecovery({scenario,model:'axial'});
      const guard={scenario,originalExact:original.status==='observed'&&original.traceSha256===reference.expectedOriginalTraceSha256[scenario],originalTraceSha256:original.traceSha256};traceGuards.push(guard);
      if(!guard.originalExact)throw Error('Prior original trace guard failed: '+scenario);
      let stood=false;
      const projected=runSameLyingRecovery({scenario,model:'projected',expectedSwitch:original.switchSnapshot,intervention:{
        activate({G,f,row}){const saved=capture(G,f,scenario,'lowDown',row.switchAtS);if(saved.descriptor.nativeSha256!==row.switchSnapshot.nativeWorldSha256||f.state!=='down')throw Error('Low-down checkpoint guard failed');captures.push(saved);},
        afterStep({G,f,observation}){if(!stood&&f.state==='stand'){stood=true;captures.push(capture(G,f,scenario,'firstStand',observation.timeS));}}
      }});
      const expected=reference.rows.find(r=>r.scenario===scenario).sameLying.projectedTraceSha256;
      Object.assign(guard,{projectedExact:projected.status==='observed'&&projected.traceSha256===expected,projectedTraceSha256:projected.traceSha256,switchExact:projected.switchGuardPassed===true,sameInput:original.inputSha256===projected.inputSha256,firstStandS:projected.firstStandS,capturedBoth:captures.filter(x=>x.descriptor.scenario===scenario).length===2});
      if(!guard.projectedExact||!guard.switchExact||!guard.sameInput||!guard.capturedBoth)throw Error('Read-only projected capture trace guard failed: '+scenario+' '+projected.error);
    }
  });
  for(const saved of captures){try{rows.push(measure(saved));}catch(e){if(e.responseRow)rows.push(e.responseRow);throw e;}}
}catch(e){result.error=e.stack;process.exitCode=1;}
result.sourceHashesAfter=await manifest();result.sourceStable=JSON.stringify(before)===JSON.stringify(result.sourceHashesAfter);result.wallSeconds=(performance.now()-start)/1000;
result.summary=rows.map(r=>({scenario:r.scenario,phase:r.phase,timeS:r.timeS,state:r.state,pelvisHeightM:r.pelvisHeightM,uprightScale:r.uprightScale,support:r.support,guards:r.guards,error:r.error??null,responses:r.responses}));
if(!result.sourceStable||rows.length!==4||rows.some(r=>r.error||Object.values(r.guards).some(v=>v!==true)))process.exitCode=1;
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
await writeFile(output.replace(/\.json$/,'')+'.summary.json',JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,error:result.error,sourceStable:result.sourceStable,wallSeconds:result.wallSeconds,traceGuards,summary:result.summary},null,2));
