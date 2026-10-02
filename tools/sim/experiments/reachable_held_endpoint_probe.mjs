// Two-condition actual game screen plus latch/new-input/release lifecycle fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runStroke} from '../whole_body_strike_probe.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {newRound,THREE,DT,CONFIG} from '../harness_m.mjs';
import {Fighter} from '../../../src/fighter.js';
import {loadHeldFollowEndpoint} from './held_follow_endpoint_candidate.mjs';
import {loadBodyInputTransfer} from './body_input_transfer_candidate.mjs';
import {loadReachableHeld,readNativeArmGeometry,forwardNativeArmTarget} from './reachable_held_endpoint_candidate.mjs';
const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const output=process.argv[2]??'/workspace/halfsword-hybrid-evidence/q04-reachable-held-r2-cheap.json';
try{await access(output);throw Error('Refuse overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const modes=['original','observe','clone','held','projectionOnly','lengthOnly','nativeReach','capHeld','budgetHeld','budgetNative'];
async function manifest(){
 async function scan(dir){const out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await scan(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const files=[...await scan('src'),'package-lock.json','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/harness_m.mjs','tools/sim/experiments/body_input_transfer_candidate.mjs','tools/sim/experiments/held_follow_endpoint_candidate.mjs','tools/sim/experiments/reachable_held_endpoint_candidate.mjs','tools/sim/experiments/reachable_held_endpoint_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];return Object.fromEntries(await Promise.all(files.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function skillState(f){return {handHeld:f.handHeld,inputActive:f.inputActive,off:f.handOffset.toArray(),aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),follow:f.skill.follow.toArray(),anchor:f.skill.anchor.toArray(),vel:f.skill.vel.toArray(),recovering:f.skill.recovering,swinging:f.skill.swinging};}
function phase(){return {steps:0,pathSignedWorkApproxJ:{},swordGravityWorkJ:0,maxHandErrorM:0,maxRawHandErrorM:0,maxShoulderTargetDistanceM:0,maxAppliedDistanceM:0,rawOutsideNativeShellSteps:0,appliedOutsideNativeShellSteps:0,maxGoalCorrectionM:0,maxNativeFKMismatchM:0,maxOffGripTargetDistanceM:0,offGripRadialOutsideSteps:0,maxGapM:0,nonStandSteps:0,maxShoulderTorqueNm:0,maxWristTorqueNm:0,maxWristCapOverrunNm:0,maxShoulderCapOverrunNm:0};}
function gap(f){return Math.max(...f.joints.map(j=>{const a=new THREE.Vector3().copy(j.joint.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.parent.rotation())).add(new THREE.Vector3().copy(j.parent.translation()));const b=new THREE.Vector3().copy(j.joint.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.child.rotation())).add(new THREE.Vector3().copy(j.child.translation()));return a.distanceTo(b);}));}
function experiment(mode,held,budgets,reachable,schedule){
 const latched=!['original','observe','clone'].includes(mode),reachMode=mode==='budgetNative'?'nativeReach':['projectionOnly','lengthOnly','nativeReach'].includes(mode)?mode:'observe';
 const record={mode,skillDispatch:0,frames:[],skillPreSnapshots:[],ikPreSnapshots:[],firstLatch:null,phase:{stroke:phase(),after_input:phase()}},native=createHash('sha256'),stroke=createHash('sha256'),undo=[];let shoulder=null,requestedShoulderDistance=null,ik=null,geometry;
 return {record,activate({G,f,ledger}){
  geometry=readNativeArmGeometry(f);record.nativeGeometry=geometry;record.actualSword={massKg:f.sword.mass(),localCOM:{...f.sword.localCom()},principalInertiaKgM2:{...f.sword.principalInertia()},principalInertiaLocalFrame:{...f.sword.principalInertiaLocalFrame()}};
  const original=f.skill.update,mod=mode==='clone'?held.clone:latched?held.candidate:held.observe;
  const implementation=mode==='original'?original:mod.Skill.prototype.update;
  f.skill.update=function(...args){record.skillDispatch++;const pre={nativeSHA256:sha(G.world.takeSnapshot()),controllerSHA256:sha(JSON.stringify(skillState(f)))};record.skillPreSnapshots.push(pre);const answer=implementation.apply(this,args),info=mod.heldEndpointInfo?.(this);
   if(info?.events.some(x=>x.kind==='latch')&&!record.firstLatch)record.firstLatch={call:record.skillDispatch,...pre,info};record.controller=info??null;reachable.observed.setReachableHeldState(f,{active:!!info?.latched,mode:reachMode,geometry});return answer;};
  undo.push(()=>{delete f.skill.update;});
  const observeIK=function(target){const raw=target.clone(),pre={nativeSHA256:sha(G.world.takeSnapshot()),controllerSHA256:sha(JSON.stringify({skill:skillState(f),armTarget:f.jointByName.uarmS.target.toArray(),elbowTarget:f.jointByName.farmS.target.toArray(),rawGoal:raw.toArray()}))};record.ikPreSnapshots.push(pre);
   if(mode==='original'||mode==='clone'){
    const c=this.bodies.chest,point=new THREE.Vector3(...CONFIG.ARM.shoulder);point.z*=this.side;point.applyQuaternion(new THREE.Quaternion().copy(c.rotation())).add(new THREE.Vector3().copy(c.translation()));requestedShoulderDistance=target.distanceTo(point);const result=(mode==='clone'?reachable.clone.Fighter.prototype.armIK:Fighter.prototype.armIK).call(this,target);
    const distance=THREE.MathUtils.clamp(requestedShoulderDistance,.08,CONFIG.ARM.upper+CONFIG.ARM.fore-CONFIG.ARM.slack),applied=raw.clone().sub(point).setLength(distance).add(point);ik={rawGoal:raw.toArray(),appliedGoal:applied.toArray(),reportedGoal:target.toArray(),rawRequestedDistanceM:requestedShoulderDistance,appliedRequestedDistanceM:distance,rawToAppliedM:raw.distanceTo(applied),nativeLengthsUsed:false,maxRequestM:CONFIG.ARM.upper+CONFIG.ARM.fore-CONFIG.ARM.slack};return result;
   }
   const result=reachable.observed.Fighter.prototype.armIK.call(this,target);ik=reachable.observed.reachableHeldInfo(this).last;requestedShoulderDistance=ik.rawRequestedDistanceM;ik.nativeFKGoal=forwardNativeArmTarget(this).toArray();ik.nativeFKErrorM=new THREE.Vector3().fromArray(ik.nativeFKGoal).distanceTo(new THREE.Vector3().fromArray(ik.appliedGoal));return result;};
  if(ledger)undo.push(ledger.replaceObservedMethod(f,'armIK',observeIK));else{f.armIK=observeIK;undo.push(()=>{delete f.armIK;});}
  if(mode==='capHeld'||mode.startsWith('budget')){const previous=f.armTorqueModel;f.armTorqueModel='sharedCap';undo.push(()=>{f.armTorqueModel=previous;});}
  if(mode!=='original'){
   const arm=budgets[mode.startsWith('budget')?'budgetBaseline':'observe'];
   undo.push(ledger.replaceObservedMethod(f,'manualMuscle',function(...args){const answer=arm.Fighter.prototype.manualMuscle.apply(this,args);shoulder=arm.q04Read(this);return answer;}));
   if(mode.startsWith('budget')){
    record.scheduleSHA256=sha(JSON.stringify(schedule));f.q04FixedShoulderCapNm=schedule[0].shoulder;f.q04FixedWristCapNm=schedule[0].wrist;
    undo.push(ledger.replaceObservedMethod(f,'driveSword',arm.Fighter.prototype.driveSword));undo.push(()=>{delete f.q04FixedShoulderCapNm;delete f.q04FixedWristCapNm;});
   }
  }
 },afterStep({G,f,ledger,sample:s,iteration}){
  const snap=G.world.takeSnapshot();native.update(snap);if(s.phase==='stroke')stroke.update(snap);
  const p=record.phase[s.phase];
  const distance=requestedShoulderDistance,actualHand=new THREE.Vector3().copy(s.actualHandWorldM),nativeFKError=ik.nativeFKErrorM??null,rawError=actualHand.distanceTo(new THREE.Vector3().fromArray(ik.rawGoal));
  const offShoulder=new THREE.Vector3().copy(geometry.offArm.shoulderLocal).applyQuaternion(new THREE.Quaternion().copy(f.bodies.chest.rotation())).add(new THREE.Vector3().copy(f.bodies.chest.translation())),idealOffGrip=new THREE.Vector3().fromArray(ik.appliedGoal).addScaledVector(new THREE.Vector3().copy(s.desiredBladeAxisWorldFromPreStep),geometry.offArm.gripAlongM),offDistance=idealOffGrip.distanceTo(offShoulder);
  const frame={step:iteration,controlTimeS:s.timeS-DT,phase:s.phase,skill:skillState(f),latch:record.controller,handTarget:s.desiredHandWorldMFromPreStep,aimTarget:s.desiredBladeAxisWorldFromPreStep,handErrorM:s.handTargetErrorM,rawHandErrorM:rawError,ik,nativeFKErrorM:nativeFKError,offGripDistanceM:offDistance,shoulderTargetDistanceM:distance,armFull:f.armFull,swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,shoulderCapNm:shoulder?.capNm??null,wristCapNm:s.wristCapNm,explicitTorqueRequests:[],pathSignedWorkApproxJ:{},swordGravityWorkJ:null};
  p.steps++;p.maxHandErrorM=Math.max(p.maxHandErrorM,s.handTargetErrorM);p.maxRawHandErrorM=Math.max(p.maxRawHandErrorM,rawError);p.maxShoulderTargetDistanceM=Math.max(p.maxShoulderTargetDistanceM,distance);p.maxAppliedDistanceM=Math.max(p.maxAppliedDistanceM,ik.appliedRequestedDistanceM);p.rawOutsideNativeShellSteps+=+(distance>geometry.maxRequestM+1e-9||distance<geometry.minRequestM-1e-9);p.appliedOutsideNativeShellSteps+=+(ik.appliedRequestedDistanceM>geometry.maxRequestM+1e-9||ik.appliedRequestedDistanceM<geometry.minRequestM-1e-9);p.maxGoalCorrectionM=Math.max(p.maxGoalCorrectionM,ik.rawToAppliedM);p.maxNativeFKMismatchM=Math.max(p.maxNativeFKMismatchM,nativeFKError);p.maxOffGripTargetDistanceM=Math.max(p.maxOffGripTargetDistanceM,offDistance);p.offGripRadialOutsideSteps+=+(offDistance>geometry.offArm.radialMaxM+1e-9);p.maxGapM=Math.max(p.maxGapM,gap(f));p.nonStandSteps+=+(f.state!=='stand');
  if(ledger){
   frame.swordGravityWorkJ=0;
   for(const segment of ledger.latest.physics){const a=segment.pre.bodies.find(x=>x.label==='0:sword'),b=segment.post.bodies.find(x=>x.label==='0:sword');frame.swordGravityWorkJ+=a.V-b.V;
    for(const [path,x] of Object.entries(segment.balance.byPath))if(/\.(manualMuscle|driveSword|elbowGravity|offHand)$/.test(path)){const name=path.split('.').at(-1);frame.pathSignedWorkApproxJ[name]=(frame.pathSignedWorkApproxJ[name]??0)+x.workApproxJ;}
   }
   for(const [path,work] of Object.entries(frame.pathSignedWorkApproxJ))p.pathSignedWorkApproxJ[path]=(p.pathSignedWorkApproxJ[path]??0)+work;p.swordGravityWorkJ+=frame.swordGravityWorkJ;
   frame.explicitTorqueRequests=ledger.latest.operations.filter(e=>e.method==='addTorque'&&/\.(manualMuscle|driveSword|elbowGravity)$/.test(e.path)).map(e=>({path:e.path,body:e.label,torqueNm:e.input}));
   for(const t of frame.explicitTorqueRequests){const magnitude=Math.hypot(t.torqueNm.x,t.torqueNm.y,t.torqueNm.z);if(t.body==='0:sword'){p.maxWristTorqueNm=Math.max(p.maxWristTorqueNm,magnitude);p.maxWristCapOverrunNm=Math.max(p.maxWristCapOverrunNm,magnitude-s.wristCapNm);}if(t.body==='0:uarmS'&&t.path.endsWith('.manualMuscle')){p.maxShoulderTorqueNm=Math.max(p.maxShoulderTorqueNm,magnitude);p.maxShoulderCapOverrunNm=Math.max(p.maxShoulderCapOverrunNm,magnitude-shoulder.capNm);}}
  }
  record.frames.push(frame);if(mode.startsWith('budget')&&iteration+1<schedule.length){f.q04FixedShoulderCapNm=schedule[iteration+1].shoulder;f.q04FixedWristCapNm=schedule[iteration+1].wrist;}
 },restore(){record.nativeTraceSHA256=native.digest('hex');record.strokeNativeTraceSHA256=stroke.digest('hex');for(const restore of undo.reverse())restore();}};
}
function lifecycle(held,reachable){
 const G=newRound({seed:7,walls:false,weapon:'longsword'});G.park();const f=G.player,from=[.02,.52],to=[.02,-.45],events=[];
 try{
  f.handOffset.set(...from);for(const n of ['prev','aim','aimRaw','anchor'])f.skill[n].set(...from);f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;for(let i=0;i<360;i++)G.step();
  const geometry=readNativeArmGeometry(f);let inactiveExactCalls=0;
  f.skill.update=function(...args){const result=held.candidate.Skill.prototype.update.apply(this,args);reachable.observed.setReachableHeldState(f,{active:held.candidate.heldEndpointInfo(this).latched,mode:'nativeReach',geometry});return result;};
  f.armIK=function(target){const result=reachable.observed.Fighter.prototype.armIK.call(this,target),info=reachable.observed.reachableHeldInfo(this);if(!info.last.active){const a=this.jointByName.uarmS.target.toArray(),b=this.jointByName.farmS.target.toArray();Fighter.prototype.armIK.call(this,target);assert.deepEqual(this.jointByName.uarmS.target.toArray(),a);assert.deepEqual(this.jointByName.farmS.target.toArray(),b);inactiveExactCalls++;}return result;};
  for(let i=0;i<66;i++){const u=(i+1)/66;f.handOffset.set(from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u);f.inputActive=true;G.step();}
  f.inputActive=false;for(let i=0;i<6;i++)G.step();let info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,true);const endpoint=info.endpoint.slice();assert.deepEqual(f.skill.aimRaw.toArray(),endpoint);events.push({kind:'initial_hold',info,skill:skillState(f)});
  f.handOffset.x+=.03;f.inputActive=false;G.step();info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,false);assert.equal(info.events.at(-1).kind,'new_input_rearm');assert.equal(reachable.observed.reachableHeldInfo(f).last.nativeLengthsUsed,false);events.push({kind:'new_actual_input_with_inactive_flag',info,skill:skillState(f),reach:reachable.observed.reachableHeldInfo(f)});
  for(let i=0;i<12&&!held.candidate.heldEndpointInfo(f.skill).latched;i++)G.step();info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,true);assert.equal(info.events.filter(x=>x.kind==='latch').length,2);events.push({kind:'relatched_endpoint',info,skill:skillState(f)});
  const before=f.skill.follow.clone();f.handHeld=false;f.inputActive=false;G.step();info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,false);assert.equal(info.events.at(-1).kind,'release_reset');assert.equal(reachable.observed.reachableHeldInfo(f).last.nativeLengthsUsed,false);const expected=before.multiplyScalar(Math.exp(-DT/CONFIG.SKILL.followDecay));assert.ok(f.skill.follow.distanceTo(expected)<1e-12);events.push({kind:'release_normal_decay',errorM:f.skill.follow.distanceTo(expected),info,skill:skillState(f),reach:reachable.observed.reachableHeldInfo(f)});
  return {pass:true,inactiveNativeIKTargetsExactCalls:inactiveExactCalls,scope:'Actual G.step lifecycle with scripted input only; full candidate switches native-length IK off on new input/release. New input .03m is a fixture, not human pointer-jitter intent.',events};
 }finally{G.eventQueue.free();G.world.free();}
}
function geometryFixture(reachable){
 const G=newRound({seed:7,walls:false,weapon:'longsword'});G.park();const f=G.player,rows=[];
 try{
  const geometry=readNativeArmGeometry(f),q=new THREE.Quaternion().copy(f.bodies.chest.rotation()),center=new THREE.Vector3().copy(geometry.shoulderLocal).applyQuaternion(q).add(new THREE.Vector3().copy(f.bodies.chest.translation())),before=sha(G.world.takeSnapshot());
  for(const distance of [.2,.4,.55])for(const direction of [[1,0,0],[.7,-.7,.1],[.2,.8,.5]]){
   const raw=center.clone().addScaledVector(new THREE.Vector3(...direction).normalize(),distance),results={};
   for(const mode of ['observe','projectionOnly','lengthOnly','nativeReach']){
    reachable.observed.setReachableHeldState(f,{active:mode!=='observe',mode,geometry});const target=raw.clone();reachable.observed.Fighter.prototype.armIK.call(f,target);const info=reachable.observed.reachableHeldInfo(f).last,fk=forwardNativeArmTarget(f),error=fk.distanceTo(new THREE.Vector3().fromArray(info.appliedGoal));
    results[mode]={nativeFKErrorM:error,rawGoal:info.rawGoal,appliedGoal:info.appliedGoal,targetQuaternions:{shoulder:f.jointByName.uarmS.target.toArray(),elbow:f.jointByName.farmS.target.toArray()},appliedDistanceM:info.appliedRequestedDistanceM};
    if(['lengthOnly','nativeReach'].includes(mode))assert.ok(error<1e-10);else assert.ok(Math.abs(error-.005)<1e-6);
   }
   assert.deepEqual(results.projectionOnly.targetQuaternions,results.observe.targetQuaternions);assert.deepEqual(results.nativeReach.targetQuaternions,results.lengthOnly.targetQuaternions);rows.push({distance,direction,results});
  }
  assert.equal(sha(G.world.takeSnapshot()),before);return {pass:true,nativeBodiesUnchanged:true,geometry,scope:'Hypothetical JS joint-target forward kinematics from actual native anchors. No rigid body position/velocity writes; not physical tracking or motor work.',rows};
 }finally{G.eventQueue.free();G.world.free();}
}
function summarize(row){const e=row.experiment;return {direction:row.direction,mode:e.mode,strokePeakTipMps:row.strokePeak.tipSpeedMps,maxHandErrorM:row.summary.maxHandTargetErrorM,afterInputAxisTravelRad:row.summary.afterInputBladeAxisTravelRad,endSwordKJ:row.final.swordEnergy.translationJ+row.final.swordEnergy.rotationJ,firstLatch:e.firstLatch,controller:e.controller,actualSword:e.actualSword,nativeGeometry:e.nativeGeometry,phase:e.phase};}
const before=await manifest(),started=performance.now(),rows=[],guards=[];let held,budgets,reachable,fixtures,error=null;
try{
 held=await loadHeldFollowEndpoint();budgets=await loadBodyInputTransfer();reachable=await loadReachableHeld();fixtures={lifecycle:lifecycle(held,reachable),geometry:geometryFixture(reachable)};
 for(const direction of ['down','up']){let original,observed,heldRow,lengthRow,capBaseline,schedule;
  for(const mode of modes){const exp=experiment(mode,held,budgets,reachable,schedule),row=runStroke({weapon:'longsword',direction,ending:'target_hold',reaction:'paired',intervention:exp,ledgerFactory:mode==='original'?null:G=>installForceLedger(G,{fighters:[G.player],sampleEvery:8,maxSamples:0})});row.experiment=exp.record;rows.push(row);
   if(mode==='original')original=row;if(mode==='observe')observed=row;if(mode==='held')heldRow=row;if(mode==='lengthOnly')lengthRow=row;if(mode==='capHeld'){capBaseline=row;schedule=row.experiment.frames.map(f=>({shoulder:f.shoulderCapNm,wrist:f.wristCapNm}));}
   const g={direction,mode,startNativeExact:row.startNativeSha256===original.startNativeSha256,startControllerExact:row.startSha256===original.startSha256,inputExact:row.inputSha256===original.inputSha256,dispatch210:row.experiment.skillDispatch===210,finite:row.finite};
   if(mode==='observe'||mode==='clone'){g.fullPhysicalControlTraceExact=row.traceSha256===original.traceSha256;g.fullNativeTraceExact=row.experiment.nativeTraceSHA256===original.experiment.nativeTraceSHA256;}
   if(!['original','observe','clone','capHeld'].includes(mode)){const reference=mode.startsWith('budget')?capBaseline:observed,call=row.experiment.firstLatch?.call;g.latchExecuted=call===67&&row.experiment.controller.latchedCalls===144;g.entireStrokeNativeExact=row.experiment.strokeNativeTraceSHA256===reference.experiment.strokeNativeTraceSHA256;g.firstLatchPreNativeExact=row.experiment.firstLatch.nativeSHA256===reference.experiment.skillPreSnapshots[call-1].nativeSHA256;g.firstLatchPreControllerExact=row.experiment.firstLatch.controllerSHA256===reference.experiment.skillPreSnapshots[call-1].controllerSHA256;g.latchedAimRawConstant=row.experiment.frames.slice(66).every(f=>JSON.stringify(f.skill.aimRaw)===JSON.stringify(row.experiment.controller.endpoint));}
   if(['lengthOnly','nativeReach'].includes(mode)){g.nativeIKFirstPreStateExact=row.experiment.ikPreSnapshots[66].nativeSHA256===heldRow.experiment.ikPreSnapshots[66].nativeSHA256&&row.experiment.ikPreSnapshots[66].controllerSHA256===heldRow.experiment.ikPreSnapshots[66].controllerSHA256;}
   if(mode==='projectionOnly'){g.projectionAloneNativeTraceExact=row.experiment.nativeTraceSHA256===heldRow.experiment.nativeTraceSHA256;g.projectionAlonePhysicalControlTraceExact=row.traceSha256===heldRow.traceSha256;}
   if(mode==='nativeReach'){g.relabelVsLengthOnlyNativeTraceExact=row.experiment.nativeTraceSHA256===lengthRow.experiment.nativeTraceSHA256;g.relabelVsLengthOnlyPhysicalControlTraceExact=row.traceSha256===lengthRow.traceSha256;}
   if(mode.startsWith('budget')){g.numericBudgetExact=row.experiment.frames.every((f,i)=>f.shoulderCapNm===schedule[i].shoulder&&f.wristCapNm===schedule[i].wrist);g.finalVectorCapsHeld=Object.values(row.experiment.phase).every(p=>p.maxShoulderCapOverrunNm<1e-9&&p.maxWristCapOverrunNm<1e-9);}
   if(mode==='budgetHeld')g.replayedBaselineTraceExact=row.traceSha256===capBaseline.traceSha256;
   guards.push(g);if(Object.values(g).includes(false))throw Error('Held endpoint gate failed:'+JSON.stringify(g));console.log(JSON.stringify(summarize(row)));
  }
 }
}catch(e){error=e.stack;}finally{await held?.cleanup();await budgets?.cleanup();await reachable?.cleanup();}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after),h=(await readFile(new URL('.git/HEAD',root),'utf8')).trim(),commit=h.startsWith('ref: ')?(await readFile(new URL('.git/'+h.slice(5),root),'utf8')).trim():h;
const result={probe:'q04-reachable-held-endpoint-r2',sourceCommit:commit,sourceSHA256:before,sourceSHA256After:after,sourceStable,error,wallSeconds:(performance.now()-started)/1000,temporarySkillSourceHashes:held?.sourceHashes,reusedExplicitBudgetSourceHashes:budgets?.sourceHashes,temporaryReachableSourceHashes:reachable?.sourceHashes,fixtures,guards,
 protocol:{candidate:'Native shoulder/elbow/grip lengths and native elbow limits define held IK reach shell, using existing ARM.slack. LengthOnly changes actual IK; projectionOnly just reports original IK clamped goal. NativeReach combines native-length IK and explicit applied goal. Reuses prior held input latch. No transforms/velocities/gains/strength/native-joint edits.',input:'Same actual longsword down/up drag.55s, hold1.2s, preparation3s legacy, pairedmeasurement,seed7. Scripted endpoints only; human pointer jitter/intention unresolved.',budget:'Strict paired numerical final shoulder/wrist cap schedule from capHeld. Native elbow/elbowGravity/offHand excluded.',work:'Path signed midpoint work includes reaction bodies; sword gravity exact actual COM potential change. No native total-work claim.',reach:'Raw goal and actual solved/report goal are separate. Native FK reconstructed from actual joint anchor vectors and JS target quaternions; applying goal uses pre-step chest. Off-grip distance currently post-step chest diagnosis; no full shoulder cone guarantee.'},summary:rows.map(summarize),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,rows:rows.length,sourceStable,error,wallSeconds:result.wallSeconds}));if(error||!sourceStable)process.exitCode=1;
