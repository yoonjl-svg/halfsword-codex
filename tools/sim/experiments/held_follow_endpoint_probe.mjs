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
const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const output=process.argv[2]??'/workspace/halfsword-hybrid-evidence/q04-held-follow-r1.json';
try{await access(output);throw Error('Refuse overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const modes=['original','observe','clone','candidate','capBaseline','budgetBaseline','budgetCandidate'];
async function manifest(){
 async function scan(dir){const out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await scan(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const files=[...await scan('src'),'package-lock.json','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/harness_m.mjs','tools/sim/experiments/body_input_transfer_candidate.mjs','tools/sim/experiments/held_follow_endpoint_candidate.mjs','tools/sim/experiments/held_follow_endpoint_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];return Object.fromEntries(await Promise.all(files.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function skillState(f){return {handHeld:f.handHeld,inputActive:f.inputActive,off:f.handOffset.toArray(),aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),follow:f.skill.follow.toArray(),anchor:f.skill.anchor.toArray(),vel:f.skill.vel.toArray(),recovering:f.skill.recovering,swinging:f.skill.swinging};}
function phase(){return {steps:0,pathSignedWorkApproxJ:{},swordGravityWorkJ:0,maxHandErrorM:0,maxShoulderTargetDistanceM:0,unreachableTargetSteps:0,maxGapM:0,nonStandSteps:0,maxShoulderTorqueNm:0,maxWristTorqueNm:0,maxWristCapOverrunNm:0,maxShoulderCapOverrunNm:0};}
function gap(f){return Math.max(...f.joints.map(j=>{const a=new THREE.Vector3().copy(j.joint.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.parent.rotation())).add(new THREE.Vector3().copy(j.parent.translation()));const b=new THREE.Vector3().copy(j.joint.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.child.rotation())).add(new THREE.Vector3().copy(j.child.translation()));return a.distanceTo(b);}));}
function experiment(mode,held,budgets,schedule){
 const record={mode,skillDispatch:0,frames:[],skillPreSnapshots:[],firstLatch:null,phase:{stroke:phase(),after_input:phase()}},native=createHash('sha256'),stroke=createHash('sha256'),undo=[];let shoulder=null,requestedShoulderDistance=null;
 return {record,activate({G,f,ledger}){
  const original=f.skill.update,mod=mode==='clone'?held.clone:['candidate','budgetCandidate'].includes(mode)?held.candidate:held.observe;
  const implementation=mode==='original'?original:mod.Skill.prototype.update;
  f.skill.update=function(...args){record.skillDispatch++;const pre={nativeSHA256:sha(G.world.takeSnapshot()),controllerSHA256:sha(JSON.stringify(skillState(f)))};record.skillPreSnapshots.push(pre);const answer=implementation.apply(this,args),info=mod.heldEndpointInfo?.(this);
   if(info?.events.some(x=>x.kind==='latch')&&!record.firstLatch)record.firstLatch={call:record.skillDispatch,...pre,info};record.controller=info??null;return answer;};
  undo.push(()=>{delete f.skill.update;});
  const observeIK=function(target){const c=this.bodies.chest,point=new THREE.Vector3(...CONFIG.ARM.shoulder);point.z*=this.side;point.applyQuaternion(new THREE.Quaternion().copy(c.rotation())).add(new THREE.Vector3().copy(c.translation()));requestedShoulderDistance=target.distanceTo(point);return Fighter.prototype.armIK.call(this,target);};
  if(ledger)undo.push(ledger.replaceObservedMethod(f,'armIK',observeIK));else{f.armIK=observeIK;undo.push(()=>{delete f.armIK;});}
  if(mode==='capBaseline'||mode.startsWith('budget')){const previous=f.armTorqueModel;f.armTorqueModel='sharedCap';undo.push(()=>{f.armTorqueModel=previous;});}
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
  const distance=requestedShoulderDistance,frame={step:iteration,controlTimeS:s.timeS-DT,phase:s.phase,skill:skillState(f),latch:record.controller,handTarget:s.desiredHandWorldMFromPreStep,aimTarget:s.desiredBladeAxisWorldFromPreStep,handErrorM:s.handTargetErrorM,shoulderTargetDistanceM:distance,armFull:f.armFull,swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,shoulderCapNm:shoulder?.capNm??null,wristCapNm:s.wristCapNm,explicitTorqueRequests:[],pathSignedWorkApproxJ:{},swordGravityWorkJ:null};
  p.steps++;p.maxHandErrorM=Math.max(p.maxHandErrorM,s.handTargetErrorM);p.maxShoulderTargetDistanceM=Math.max(p.maxShoulderTargetDistanceM,distance);p.unreachableTargetSteps+=+(distance>CONFIG.ARM.upper+CONFIG.ARM.fore-CONFIG.ARM.slack);p.maxGapM=Math.max(p.maxGapM,gap(f));p.nonStandSteps+=+(f.state!=='stand');
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
function lifecycle(held){
 const G=newRound({seed:7,walls:false,weapon:'longsword'});G.park();const f=G.player,from=[.02,.52],to=[.02,-.45],events=[];
 try{
  f.handOffset.set(...from);for(const n of ['prev','aim','aimRaw','anchor'])f.skill[n].set(...from);f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;for(let i=0;i<360;i++)G.step();
  f.skill.update=held.candidate.Skill.prototype.update;
  for(let i=0;i<66;i++){const u=(i+1)/66;f.handOffset.set(from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u);f.inputActive=true;G.step();}
  f.inputActive=false;for(let i=0;i<6;i++)G.step();let info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,true);const endpoint=info.endpoint.slice();assert.deepEqual(f.skill.aimRaw.toArray(),endpoint);events.push({kind:'initial_hold',info,skill:skillState(f)});
  f.handOffset.x+=.03;f.inputActive=false;G.step();info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,false);assert.equal(info.events.at(-1).kind,'new_input_rearm');events.push({kind:'new_actual_input_with_inactive_flag',info,skill:skillState(f)});
  for(let i=0;i<12&&!held.candidate.heldEndpointInfo(f.skill).latched;i++)G.step();info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,true);assert.equal(info.events.filter(x=>x.kind==='latch').length,2);events.push({kind:'relatched_endpoint',info,skill:skillState(f)});
  const before=f.skill.follow.clone();f.handHeld=false;f.inputActive=false;G.step();info=held.candidate.heldEndpointInfo(f.skill);assert.equal(info.latched,false);assert.equal(info.events.at(-1).kind,'release_reset');const expected=before.multiplyScalar(Math.exp(-DT/CONFIG.SKILL.followDecay));assert.ok(f.skill.follow.distanceTo(expected)<1e-12);events.push({kind:'release_normal_decay',errorM:f.skill.follow.distanceTo(expected),info,skill:skillState(f)});
  return {pass:true,scope:'Actual G.step lifecycle with scripted input only. New input .03m is a fixture, not human pointer-jitter intent.',events};
 }finally{G.eventQueue.free();G.world.free();}
}
function summarize(row){const e=row.experiment;return {direction:row.direction,mode:e.mode,strokePeakTipMps:row.strokePeak.tipSpeedMps,maxHandErrorM:row.summary.maxHandTargetErrorM,afterInputAxisTravelRad:row.summary.afterInputBladeAxisTravelRad,endSwordKJ:row.final.swordEnergy.translationJ+row.final.swordEnergy.rotationJ,firstLatch:e.firstLatch,controller:e.controller,phase:e.phase};}
const before=await manifest(),started=performance.now(),rows=[],guards=[];let held,budgets,fixtures,error=null;
try{
 held=await loadHeldFollowEndpoint();budgets=await loadBodyInputTransfer();fixtures=lifecycle(held);
 for(const direction of ['down','up']){let original,observed,capBaseline,schedule;
  for(const mode of modes){const exp=experiment(mode,held,budgets,schedule),row=runStroke({weapon:'longsword',direction,ending:'target_hold',reaction:'paired',intervention:exp,ledgerFactory:mode==='original'?null:G=>installForceLedger(G,{fighters:[G.player],sampleEvery:8,maxSamples:0})});row.experiment=exp.record;rows.push(row);
   if(mode==='original')original=row;if(mode==='observe')observed=row;if(mode==='capBaseline'){capBaseline=row;schedule=row.experiment.frames.map(f=>({shoulder:f.shoulderCapNm,wrist:f.wristCapNm}));}
   const g={direction,mode,startNativeExact:row.startNativeSha256===original.startNativeSha256,startControllerExact:row.startSha256===original.startSha256,inputExact:row.inputSha256===original.inputSha256,dispatch210:row.experiment.skillDispatch===210,finite:row.finite};
   if(mode==='observe'||mode==='clone'){g.fullPhysicalControlTraceExact=row.traceSha256===original.traceSha256;g.fullNativeTraceExact=row.experiment.nativeTraceSHA256===original.experiment.nativeTraceSHA256;}
   if(mode==='candidate'||mode==='budgetCandidate'){const reference=mode==='candidate'?observed:capBaseline,call=row.experiment.firstLatch?.call;g.latchExecuted=call===67&&row.experiment.controller.latchedCalls===144;g.entireStrokeNativeExact=row.experiment.strokeNativeTraceSHA256===reference.experiment.strokeNativeTraceSHA256;g.firstLatchPreNativeExact=row.experiment.firstLatch.nativeSHA256===reference.experiment.skillPreSnapshots[call-1].nativeSHA256;g.firstLatchPreControllerExact=row.experiment.firstLatch.controllerSHA256===reference.experiment.skillPreSnapshots[call-1].controllerSHA256;g.latchedAimRawConstant=row.experiment.frames.slice(66).every(f=>JSON.stringify(f.skill.aimRaw)===JSON.stringify(row.experiment.controller.endpoint));}
   if(mode.startsWith('budget')){g.numericBudgetExact=row.experiment.frames.every((f,i)=>f.shoulderCapNm===schedule[i].shoulder&&f.wristCapNm===schedule[i].wrist);g.finalVectorCapsHeld=Object.values(row.experiment.phase).every(p=>p.maxShoulderCapOverrunNm<1e-9&&p.maxWristCapOverrunNm<1e-9);}
   if(mode==='budgetBaseline')g.replayedBaselineTraceExact=row.traceSha256===capBaseline.traceSha256;
   guards.push(g);if(Object.values(g).includes(false))throw Error('Held endpoint gate failed:'+JSON.stringify(g));console.log(JSON.stringify(summarize(row)));
  }
 }
}catch(e){error=e.stack;}finally{await held?.cleanup();await budgets?.cleanup();}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after),h=(await readFile(new URL('.git/HEAD',root),'utf8')).trim(),commit=h.startsWith('ref: ')?(await readFile(new URL('.git/'+h.slice(5),root),'utf8')).trim():h;
const result={probe:'q04-held-follow-endpoint',sourceCommit:commit,sourceSHA256:before,sourceSHA256After:after,sourceStable,error,wallSeconds:(performance.now()-started)/1000,temporarySkillSourceHashes:held?.sourceHashes,reusedExplicitBudgetSourceHashes:budgets?.sourceHashes,fixtures,guards,
 protocol:{candidate:'Latch existing aimRaw/follow and actual input endpoint only at stopped held input boundary. Resume existing update path on actual new offset/inputActive or release. No transforms/velocities/gains/strength edits.',input:'Same actual longsword down/up drag.55s, hold1.2s, preparation3s legacy, pairedmeasurement,seed7. Scripted endpoints only; human pointer jitter/intention unresolved.',budget:'Strict paired numerical final shoulder/wrist cap schedule reused from sharedCap baseline. Native elbow/elbowGravity/offHand excluded. Legacy candidate uses existing budget law, not identical ceilings.',work:'Path signed midpoint work includes reaction bodies; sword gravity exact actual COM potential change. No native total-work claim.'},summary:rows.map(summarize),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,rows:rows.length,sourceStable,error,wallSeconds:result.wallSeconds}));if(error||!sourceStable)process.exitCode=1;
