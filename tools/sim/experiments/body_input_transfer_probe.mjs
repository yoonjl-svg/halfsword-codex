// Actual G.step / Fighter / Rapier run; one candidate, two separately labelled budgets.
import {runStroke} from '../whole_body_strike_probe.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {Fighter} from '../../../src/fighter.js';
import {THREE} from '../harness_m.mjs';
import {loadBodyInputTransfer} from './body_input_transfer_candidate.mjs';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
async function readCommit(){const h=(await readFile(new URL('.git/HEAD',root),'utf8')).trim();return h.startsWith('ref: ')?(await readFile(new URL('.git/'+h.slice(5),root),'utf8')).trim():h;}
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const options=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(screen|out)=(.+)$/.exec(a);if(!m)throw Error('Use --screen/--out=value');return[m[1],m[2]];}));
const screen=options.screen??'cheap';if(!['cheap','expanded'].includes(screen))throw Error('Unknown screen');
const output=options.out??`/workspace/halfsword-hybrid-evidence/q04-body-input-${screen}.json`;
try{await access(output);throw Error('Refuse evidence overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const cases=screen==='cheap'?[{weapon:'longsword',direction:'down',ending:'release'},{weapon:'longsword',direction:'cross',ending:'target_hold'}]:
 ['sabre','zweihander'].flatMap(weapon=>['down','up','cross'].flatMap(direction=>['release','target_hold'].map(ending=>({weapon,direction,ending}))));
const modes=['baseline','observe','clone','candidate','capBaseline','capCandidate','budgetBaseline','budgetCandidate'];
async function manifest(){
 async function scan(dir){const out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await scan(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const paths=[...await scan('src'),'package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm',
  'tools/sim/whole_body_strike_probe.mjs','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/body_input_transfer_candidate.mjs','tools/sim/experiments/body_input_transfer_probe.mjs'];
 return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function spec(f){const j=f.jointByName.farmS,raw=j.joint.rawSet,h=j.joint.handle;return {handle:h,k:j.k,d:j.d,max:j.max,anchor1:{...j.joint.anchor1()},anchor2:{...j.joint.anchor2()},frame1:{...j.joint.frameX1()},frame2:{...j.joint.frameX2()},limits:{on:raw.jointLimitsEnabled(h,3),min:raw.jointLimitsMin(h,3),max:raw.jointLimitsMax(h,3)}};}
function maximumGap(f){return Math.max(...f.joints.map(j=>V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation())).distanceTo(V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation())))));}
function phase(){return {steps:0,shoulderWorkApproxJ:0,wristWorkApproxJ:0,elbowGravityWorkApproxJ:0,swordGravityWorkJ:0,maxAppliedShoulderNm:0,maxAppliedWristNm:0,maxHandTargetErrorM:0,maxBladeTargetErrorRad:0,maxJointGapM:0,maxTargetTwistRadps:0,nonStandSteps:0,capOverrunNm:0};}
function makeIntervention(mode,modules,budgetSchedule=null){
 const undo=[],native=createHash('sha256'),physical=createHash('sha256'),control=createHash('sha256');
 const record={mode,calls:0,frames:[],phases:{stroke:phase(),after_input:phase()},nativeGeometryPreserved:true};let shoulder=null;
 return {record,activate({G,f,ledger}){
  record.checkpointNativeSha256=sha(G.world.takeSnapshot());record.nativeGeometry=spec(f);
  record.actualSword={massKg:f.sword.mass(),localCOM:{...f.sword.localCom()},worldCOM:{...f.sword.worldCom()},principalInertiaKgM2:{...f.sword.principalInertia()},principalInertiaLocalFrame:{...f.sword.principalInertiaLocalFrame()}};
  record.nominalLimits={shoulderMaxNm:f.jointByName.uarmS.max,wristMaxNm:f.weaponCfg.maxAimTorque,shoulderVmax:f.weaponCfg.shoulderVmax,wristVmax:f.weaponCfg.wristVmax,legacyArmTorqueModel:f.armTorqueModel??'legacy'};
  if(mode.startsWith('cap')||mode.startsWith('budget')){const previous=f.armTorqueModel;f.armTorqueModel='sharedCap';undo.push(()=>{f.armTorqueModel=previous;});}
  if(mode.startsWith('budget')){
   record.budgetScheduleSha256=sha(JSON.stringify(budgetSchedule));f.q04FixedShoulderCapNm=budgetSchedule[0].shoulder;f.q04FixedWristCapNm=budgetSchedule[0].wrist;
   undo.push(ledger.replaceObservedMethod(f,'driveSword',modules[mode].Fighter.prototype.driveSword));
   undo.push(()=>{delete f.q04FixedShoulderCapNm;delete f.q04FixedWristCapNm;});
  }
  if(mode!=='baseline'){
   const module=mode.startsWith('budget')?modules[mode]:mode==='clone'?modules.clone:['candidate','capCandidate'].includes(mode)?modules.candidate:modules.observe;
   undo.push(ledger.replaceObservedMethod(f,'manualMuscle',function(...args){record.calls++;const answer=module.Fighter.prototype.manualMuscle.apply(this,args);shoulder=module.q04Read?.(this)??null;return answer;}));
  }
 },afterStep({G,f,ledger,sample:s,iteration}){
  native.update(G.world.takeSnapshot());record.nativeGeometryPreserved&&=JSON.stringify(spec(f))===JSON.stringify(record.nativeGeometry);
  const p=record.phases[s.phase],frame={step:iteration,timeS:s.timeS,phase:s.phase,shoulder,wristCapNm:s.wristCapNm,handTarget:s.desiredHandWorldMFromPreStep,aimTarget:s.desiredBladeAxisWorldFromPreStep,handErrorM:s.handTargetErrorM,bladeErrorRad:s.bladeAimErrorRad,swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,chestOmega:s.chest.angularVelocityRadps,maxGapM:maximumGap(f),explicitTorqueRequests:[]};
  p.steps++;p.maxHandTargetErrorM=Math.max(p.maxHandTargetErrorM,s.handTargetErrorM);p.maxBladeTargetErrorRad=Math.max(p.maxBladeTargetErrorRad,s.bladeAimErrorRad);p.maxJointGapM=Math.max(p.maxJointGapM,frame.maxGapM);p.nonStandSteps+=+(f.state!=='stand');
  if(shoulder){p.maxTargetTwistRadps=Math.max(p.maxTargetTwistRadps,Math.abs(shoulder.targetTwistRadps));p.maxAppliedShoulderNm=Math.max(p.maxAppliedShoulderNm,Math.hypot(...shoulder.appliedNm));p.capOverrunNm=Math.max(p.capOverrunNm,Math.hypot(...shoulder.appliedNm)-shoulder.capNm);}
  if(ledger){
   physical.update(JSON.stringify(ledger.latest.postGame));
   for(const segment of ledger.latest.physics){
    const pre=segment.pre.bodies.find(b=>b.label==='0:sword'),post=segment.post.bodies.find(b=>b.label==='0:sword');p.swordGravityWorkJ+=pre.V-post.V;
    for(const [path,b] of Object.entries(segment.balance.byPath)){if(path.includes('.manualMuscle'))p.shoulderWorkApproxJ+=b.workApproxJ;else if(path.includes('.elbowGravity'))p.elbowGravityWorkApproxJ+=b.workApproxJ;else if(path.endsWith('.driveSword'))p.wristWorkApproxJ+=b.workApproxJ;}
   }
   frame.explicitTorqueRequests=ledger.latest.operations.filter(e=>e.method==='addTorque'&&(e.path.includes('.manualMuscle')||e.path.includes('.driveSword')||e.path.includes('.elbowGravity'))).map(e=>({path:e.path,body:e.label,torqueNm:e.input}));
   for(const t of frame.explicitTorqueRequests)if(t.body==='0:sword')p.maxAppliedWristNm=Math.max(p.maxAppliedWristNm,Math.hypot(t.torqueNm.x,t.torqueNm.y,t.torqueNm.z));
  }
  control.update(JSON.stringify({handTarget:frame.handTarget,aimTarget:frame.aimTarget,armTarget:f.jointByName.uarmS.target.toArray(),armPrevTarget:f.jointByName.uarmS.prevTarget?.toArray(),wristBrake:f.wristBrake,wristHill:f.wristHill,skillAim:f.skill.aim.toArray()}));
  record.frames.push(frame);
  if(mode.startsWith('budget')&&iteration+1<budgetSchedule.length){f.q04FixedShoulderCapNm=budgetSchedule[iteration+1].shoulder;f.q04FixedWristCapNm=budgetSchedule[iteration+1].wrist;}
 },restore(){record.nativeTraceSha256=native.digest('hex');record.observedBodyTraceSha256=physical.digest('hex');record.controlTraceSha256=control.digest('hex');for(const restore of undo.reverse())restore();}};
}
function summarize(r){const e=r.experiment;return {weapon:r.weapon,direction:r.direction,ending:r.ending,mode:e.mode,strokePeakTipMps:r.strokePeak.tipSpeedMps,maxHandTargetErrorM:r.summary.maxHandTargetErrorM,afterInputAxisTravelRad:r.summary.afterInputBladeAxisTravelRad,endSwordKJ:r.final.swordEnergy.translationJ+r.final.swordEnergy.rotationJ,endBladeAimErrorRad:r.final.bladeAimErrorRad,calls:e.calls,actualSword:e.actualSword,nominalLimits:e.nominalLimits,phases:e.phases};}
const before=await manifest(),started=performance.now(),rows=[],guards=[];let modules,error=null;
try{
 modules=await loadBodyInputTransfer();
 for(const condition of cases){let baseline,observed,budgetSchedule;
  for(const mode of modes){
   const intervention=makeIntervention(mode,modules,budgetSchedule),row=runStroke({...condition,reaction:'paired',intervention,ledgerFactory:mode==='baseline'?null:G=>installForceLedger(G,{fighters:[G.player],sampleEvery:8,maxSamples:0})});row.experiment=intervention.record;rows.push(row);
   if(mode==='capBaseline')budgetSchedule=row.experiment.frames.map(x=>({shoulder:x.shoulder.capNm,wrist:x.wristCapNm}));
   if(mode==='baseline')baseline=row;if(mode==='observe')observed=row;
   const guard={...condition,mode,startNativeExact:row.startNativeSha256===baseline.startNativeSha256,startControllerExact:row.startSha256===baseline.startSha256,inputRequestExact:row.inputSha256===baseline.inputSha256,nativeGeometryPreserved:intervention.record.nativeGeometryPreserved,finite:row.finite};
   if(mode==='observe'||mode==='clone'){guard.physicalControlTraceExact=row.traceSha256===baseline.traceSha256;guard.nativeTraceExact=row.experiment.nativeTraceSha256===baseline.experiment.nativeTraceSha256;guard.actualControllerTraceExact=row.experiment.controlTraceSha256===baseline.experiment.controlTraceSha256;}
   if(mode==='clone'){guard.observedBodyTraceExact=row.experiment.observedBodyTraceSha256===observed.experiment.observedBodyTraceSha256;guard.cloneExecuted=row.experiment.calls===210;}
   if(mode.includes('andidate')){guard.candidateExecuted=row.experiment.calls===210;guard.sameFirstHandAimTargets=JSON.stringify({hand:row.experiment.frames[0].handTarget,aim:row.experiment.frames[0].aimTarget})===JSON.stringify({hand:baseline.experiment.frames[0].handTarget,aim:baseline.experiment.frames[0].aimTarget});}
   if(mode.startsWith('budget')){guard.numericBudgetExact=row.experiment.frames.every((x,i)=>x.shoulder.capNm===budgetSchedule[i].shoulder&&x.wristCapNm===budgetSchedule[i].wrist);guard.finalShoulderCapHeld=Math.max(...Object.values(row.experiment.phases).map(x=>x.capOverrunNm))<1e-9;}
   if(mode==='budgetBaseline'){const cap=rows.findLast(x=>x.experiment.mode==='capBaseline');guard.budgetReplayBaselineTraceExact=row.traceSha256===cap.traceSha256;}
   guards.push(guard);if(Object.values(guard).includes(false))throw Error('Guard failed: '+JSON.stringify(guard));
   console.log(JSON.stringify(summarize(row)));
  }
 }
}catch(e){error=e.stack;}finally{await modules?.cleanup();}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
const result={probe:'q04-body-input-transfer',screen,sourceCommit:await readCommit(),sourceSha256:before,sourceSha256After:after,sourceStable,wallSeconds:(performance.now()-started)/1000,temporarySourceHashes:modules?.sourceHashes,guards,error,
 protocol:{candidate:'Shoulder twist damping: −0.8*(relative twist omega − IK target twist omega). All driveSword/armIK input/world targets and torque gains retained; no chest full/yaw follow.',preparation:'Legacy preparation3s; paired measurement; drag.55s; ending observation1.2s; seed7; actual native G.step.',sameTarget:'Same world mapping/input/first target; later target equality cannot be claimed across diverging dynamic chest translations and skill feedback.',budget:'Legacy comparisons retain nominal gains/caps. capBaseline/capCandidate both use existing sharedCap; same nominal law, state-dependent Hill ceilings differ. budgetBaseline/budgetCandidate replay identical per-step final shoulder and wrist ceilings from capBaseline. Native motor/elbowGravity/offHand budgets unchanged, not included in a total cap.',work:'Explicit path midpoint quadrature only; sword gravity exact COM potential difference. No native total-work or efficiency claim.',scope:'Unopposed healthy strokes; release includes original automatic return. No collision, human naturalness or mobile acceptance.'},summary:rows.map(summarize),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});await writeFile(output.replace(/\.json$/,'.summary.json'),JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,rows:rows.length,sourceStable,error,wallSeconds:result.wallSeconds}));if(error||!sourceStable)process.exitCode=1;
