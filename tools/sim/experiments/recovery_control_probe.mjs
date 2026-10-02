// Research interventions only, activated AFTER a matched native low-down checkpoint.
import {runSameLyingRecovery,withOriginalRecovery} from './same_lying_recovery_probe.mjs';
import {readFile,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {RAPIER,CONFIG} from '../harness_m.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createUprightMotorState,configureUprightMotor} from './upright_motor_candidate.mjs';

const root=new URL('../../../',import.meta.url);
const hash=x=>createHash('sha256').update(x).digest('hex');
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|variants|scenarios|analyze)=(.+)$/.exec(a);if(!m)throw Error('Use --out/variants/scenarios=value');return[m[1],m[2]];}));
const variants=(opts.variants??'projected,zeroUpright,removedUpright,noTargetVelocity,resetOnHandover').split(',');
const scenarios=(opts.scenarios??'healthy_getup,hurt_getup').split(',');
if(variants.some(v=>!['projected','zeroUpright','removedUpright','safeUprightGate','nativeGate','noTargetVelocity','resetOnHandover','stanceCapacity','constantFootMass','safeGateStanceCapacity','cloneGait','contactAirborne','safeGateContactAirborne'].includes(v))||scenarios.some(s=>!['healthy_getup','hurt_getup'].includes(s)))throw Error('Unknown variant/scenario');
let gaitModules=null;
async function prepareGaitModules(){
 const original=await readFile(new URL('src/gait.js',root),'utf8');
 const imports=original.replace("from 'three'",'from '+JSON.stringify(import.meta.resolve('three')))
  .replace("from './config.js'",'from '+JSON.stringify(new URL('src/config.js',root).href));
 if(imports===original||imports.includes("from './config.js'"))throw Error('Gait import isolation failed');
 const air="const air = l.soleY > GAIT.airFoot && (this.levH > 0 || (l.toeY > GAIT.airFoot * 0.75 && (l.N || 0) < 0.05 * this.Mg));";
 if(imports.split(air).length!==2)throw Error('Expected exactly one existing Gait air condition');
 const candidate="import {collectSupportContacts} from "+JSON.stringify(new URL('src/support_contacts.js',root).href)+";\n"+
  imports.replace(air,"const air = !collectSupportContacts(f, {detail: false}).groups[l.foot].hasSupport && "+air.slice('const air = '.length));
 const directory=await mkdtemp(join(tmpdir(),'halfsword-contact-air-gait-'));
 try{
  const clonePath=join(directory,'clone.mjs'),candidatePath=join(directory,'contact-air.mjs');
  await writeFile(clonePath,imports);await writeFile(candidatePath,candidate);
  const [clone,contactAirborne]=await Promise.all([import(pathToFileURL(clonePath).href),import(pathToFileURL(candidatePath).href)]);
  return {directory,clone:clone.Gait,contactAirborne:contactAirborne.Gait,
   sourceHashes:{original:hash(original),clone:hash(imports),contactAirborne:hash(candidate)},
   scope:'Shared original THREE/config/contact modules; copied Gait prototype is installed only after matched native checkpoint. Contact candidate adds AND !actual.hasSupport solely to existing air condition.'};
 }catch(error){await rm(directory,{recursive:true,force:true});throw error;}
}
async function manifest(){
 async function files(dir){let out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){let p=dir+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const ps=[...await files('src'),'tools/sim/experiments/recovery_control_probe.mjs','tools/sim/experiments/same_lying_recovery_probe.mjs','tools/sim/experiments/upright_motor_candidate.mjs','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','package-lock.json'];
 return Object.fromEntries(await Promise.all(ps.sort().map(async p=>[p,hash(await readFile(new URL(p,root)))])));
}
function intervention(kind){
 const undo=[];
 return {activate({G,f,row}){
  row.intervention={kind,afterMatchedCheckpoint:true,motorCallsChanged:0};
  row.intervention.stepEvents=[];
  if(['cloneGait','contactAirborne','safeGateContactAirborne'].includes(kind)){
   const oldPrototype=Object.getPrototypeOf(f.gait);
   Object.setPrototypeOf(f.gait,kind==='cloneGait'?gaitModules.clone.prototype:gaitModules.contactAirborne.prototype);
   undo.push(()=>Object.setPrototypeOf(f.gait,oldPrototype));
   row.intervention.gaitPrototypeReplaced=true;
  }
  const oldBegin=f.gait.begin,oldBeginDescriptor=Object.getOwnPropertyDescriptor(f.gait,'begin');
  f.gait.begin=function(l,stepKind,T){
   const contacts=collectSupportContacts(f,{detail:false});
   row.intervention.stepEvents.push({timeS:G.t-row.prepareSeconds,foot:l.k,kind:stepKind,T,levH:this.levH,levC:this.levC,pelvisHeightM:f.bodies.pelvis.translation().y,footSupport:Object.fromEntries(['F','B'].map(k=>{
    const leg=this.legs[k],horizontalReachM=Math.hypot(leg.hip.x-leg.plant.x,leg.hip.z-leg.plant.z);
    const airByOriginalCondition=leg.soleY>CONFIG.GAIT.airFoot&&(this.levH>0||(leg.toeY>CONFIG.GAIT.airFoot*.75&&(leg.N||0)<.05*this.Mg));
    return[k,{stance:leg.stance,soleY:leg.soleY,toeY:leg.toeY,hasSupport:contacts.groups['foot'+k].hasSupport,rawNormalForceN:contacts.groups['foot'+k].rawNormalForceN,N:leg.N,horizontalReachM,reachExceedsLimit:horizontalReachM>CONFIG.GAIT.reachMax,airByOriginalCondition,wouldSuppressAirCondition:airByOriginalCondition&&contacts.groups['foot'+k].hasSupport}];
   }))});
   return oldBegin.call(this,l,stepKind,T);
  };
  undo.push(()=>{if(oldBeginDescriptor)Object.defineProperty(f.gait,'begin',oldBeginDescriptor);else delete f.gait.begin;});
  if(kind==='stanceCapacity'||kind==='safeGateStanceCapacity'){
   const oldPose=f.gait.poseLegs;
   f.gait.poseLegs=function(...args){const out=oldPose.apply(this,args);for(const l of Object.values(this.legs))if(l.stance)for(const n of [l.thigh,l.shin,l.foot])f.jointByName[n].gain=CONFIG.GAIT.stanceGain;return out;};
   undo.push(()=>{f.gait.poseLegs=oldPose;});
  }
  if(kind==='constantFootMass'){
   const oldMass=f.gait.footMass;f.gait.footMass=function(){};undo.push(()=>{f.gait.footMass=oldMass;});
  }
  if(kind==='nativeGate') {
   const raw=f.uprightJoint.rawSet,old=raw.jointConfigureMotorPosition,owned=new Set([f.uprightJoint.handle]);
   const state=createUprightMotorState({world:G.world,joint:f.uprightJoint,activeAxes:[3,4,5],createJoint(){
    const joint=G.world.createImpulseJoint(RAPIER.JointData.generic({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0},0),f.anchor,f.bodies.pelvis,true);
    owned.add(joint.handle);return joint;
   }});
   let requests=[],applying=false;
   Object.assign(row.intervention,{removed:0,recreated:0});
   raw.jointConfigureMotorPosition=function(h,axis,target,stiffness,damping){
    if(applying||!owned.has(h))return old.call(this,h,axis,target,stiffness,damping);
    requests.push({axis,target,stiffness,damping});
    if(requests.length===3){
     const prior=state.joint;applying=true;
     try{
      const current=configureUprightMotor(state,requests);
      if(prior!==current){row.intervention.removed+=+!!prior;row.intervention.recreated+=+!!current;}
      // An old wrapper is retained only as an intercepted address while all motors are off.
      // No native call uses that stale handle; a live joint replaces it on reactivation.
      if(current)f.uprightJoint=current;
      row.intervention.motorCallsChanged+=requests.filter(r=>r.stiffness===0&&r.damping===0).length;
     }finally{applying=false;requests=[];}
    }
   };
   undo.push(()=>{raw.jointConfigureMotorPosition=old;});
  } else if(kind==='safeUprightGate'||kind==='safeGateStanceCapacity'||kind==='safeGateContactAirborne') {
   const raw=f.uprightJoint.rawSet,old=raw.jointConfigureMotorPosition;
   const owned=new Set([f.uprightJoint.handle]);let active=f.uprightJoint;
   Object.assign(row.intervention,{removed:0,recreated:0});
   raw.jointConfigureMotorPosition=function(h,ax,t,k,d){
    if(!owned.has(h))return old.call(this,h,ax,t,k,d);
    if(k===0&&d===0){if(active){G.world.removeImpulseJoint(active,true);active=null;row.intervention.removed++;}row.intervention.motorCallsChanged++;return;}
    if(!active){active=G.world.createImpulseJoint(RAPIER.JointData.generic({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0},0),f.anchor,f.bodies.pelvis,true);for(const axis of [3,4,5])raw.jointConfigureMotorModel(active.handle,axis,1);owned.add(active.handle);f.uprightJoint=active;row.intervention.recreated++;}
    return old.call(this,active.handle,ax,t,k,d);
   };
   undo.push(()=>{raw.jointConfigureMotorPosition=old;});
  } else if(kind==='removedUpright'){
   const raw=f.uprightJoint.rawSet,handle=f.uprightJoint.handle,old=raw.jointConfigureMotorPosition;
   G.world.removeImpulseJoint(f.uprightJoint,true);
   raw.jointConfigureMotorPosition=function(h,...args){if(h===handle){row.intervention.motorCallsChanged++;return;}return old.call(this,h,...args);};
   undo.push(()=>{raw.jointConfigureMotorPosition=old;});
  } else if(kind==='zeroUpright') {
   const old=f.driveBalance;
   f.driveBalance=function(...args){const out=old.apply(this,args);for(const ax of [3,4,5]){this.uprightJoint.rawSet.jointConfigureMotorPosition(this.uprightJoint.handle,ax,0,0,0);row.intervention.motorCallsChanged++;}return out;};
   undo.push(()=>{f.driveBalance=old;});
  } else if(kind==='noTargetVelocity') {
   const raw=f.uprightJoint.rawSet,old=raw.jointConfigureMotor;
   const handles=new Set(f.joints.filter(j=>!j.manual).map(j=>j.joint.handle));
   raw.jointConfigureMotor=function(h,ax,t,v,k,d){if(handles.has(h)){row.intervention.motorCallsChanged++;v=0;}return old.call(this,h,ax,t,v,k,d);};
   undo.push(()=>{raw.jointConfigureMotor=old;});
  } else if(kind==='resetOnHandover') {
   const old=f.driveJoints;let previous=f.gait.active;
   f.driveJoints=function(...args){if(this.gait.active&&!previous){for(const j of this.joints)if(!j.manual)delete j.prevRV;row.intervention.motorCallsChanged++;}previous=this.gait.active;return old.apply(this,args);};
   undo.push(()=>{f.driveJoints=old;});
  }
 },restore(){for(const fn of undo.reverse())fn();}};
}
function summarize(r){
 const frames=r.launchObservation?.compactPerStep??[],start=r.switchAtS,post=frames.filter(f=>f.timeS>start);
 const max=(key)=>post.reduce((a,b)=>!a||key(b)>key(a)?b:a,null);
 const energy=max(x=>x.KJ),gap=max(x=>x.maxJointAnchorGapM);
 let maxDelta=null;
 for(let i=1;i<post.length;i++){const a=post[i-1],b=post[i];const deltaK=b.KJ-a.KJ,deltaMechanical=deltaK+9.81*(b.massKg*b.COM.y-a.massKg*a.COM.y);if(!maxDelta||deltaMechanical>maxDelta.deltaMechanicalJ)maxDelta={timeS:b.timeS,state:b.state,deltaKJ:deltaK,deltaMechanicalJ:deltaMechanical,massBeforeKg:a.massKg,massAfterKg:b.massKg,massChanges:b.massChanges,explicitWorkApproxJ:b.explicitWorkApproxJ,nativeResidualImpulseNs:b.nativeResidualImpulseNs,maxJointAnchorGapM:b.maxJointAnchorGapM};}
 let tail=0,longest=0,exits=0,lastHandoverEndS=null;
 for(let i=0;i<post.length;i++){const b=post[i],a=post[i-1];tail=b.physicallyUprightGameGeometry?tail+1/120:0;longest=Math.max(longest,tail);if(a?.physicallyUprightGameGeometry&&!b.physicallyUprightGameGeometry)exits++;if(a?.levH>0&&b.levH<=0)lastHandoverEndS=b.timeS;}
 return {scenario:r.scenario,variant:r.variant,status:r.status,error:r.error??null,trace:r.traceSha256,refalls:r.postStandRefallTransitions?.length,finalState:r.final?.state,finalGeometryUpright:r.final?.physicallyUprightGameGeometry,finalHeightM:r.final?.pelvisHeightM,firstStandS:r.firstStandS,firstGeometryS:r.firstGameGeometryUprightS,handover:r.handover,geometryObservation:{tailUprightS:tail,longestUprightS:longest,uprightExitCount:exits,lastHandoverEndS,secondsAfterLastHandover:lastHandoverEndS==null?null:r.observationSeconds-lastHandoverEndS,definition:'Existing game geometry per-step observer, not human naturalness or a controller gate.'},maxHeightM:max(x=>x.pelvisHeightM)?.pelvisHeightM,maxCOMUpMps:max(x=>x.COMVelocityMps.y)?.COMVelocityMps.y,maxPelvisUpMps:max(x=>x.pelvisVelocityMps.y)?.pelvisVelocityMps.y,maxGapM:gap?.maxJointAnchorGapM,maxKJ:energy?.KJ,maxEnergyStep:maxDelta,maxNoNativeContactS:r.launchObservation?.maxNoNonPredictiveNativeGroundSolverIntervalS,slip:r.filteredSlip?.all?.nonPredictiveSupportPoints};
}
if(opts.analyze){
 if(!opts.out||opts.out===opts.analyze)throw Error('Analysis requires a separate --out path');
 const bytes=await readFile(opts.analyze),raw=JSON.parse(bytes);
 const result={probe:'recovery_control_postprocess',rawFile:opts.analyze,rawSha256:hash(bytes),analysisSourceSha256:hash(await readFile(new URL(import.meta.url))),correction:'Handover ends at levH<=0; minJerk may reach -2e-16 one step before exact zero. No simulation/control changed.',guards:raw.guards,sourceStable:raw.sourceStable,error:raw.error,summary:raw.rows.map(summarize)};
 await writeFile(opts.out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out:opts.out,rows:raw.rows.length,simulationRerun:false}));
} else {
const before=await manifest(),begin=performance.now(),rows=[],guards=[];
let error=null;
try {
 if(variants.some(v=>['cloneGait','contactAirborne','safeGateContactAirborne'].includes(v)))gaitModules=await prepareGaitModules();
 await withOriginalRecovery(async reference=>{
 for(const scenario of scenarios){
  const original=runSameLyingRecovery({scenario,model:'axial'});original.variant='original';rows.push(original);
  if(original.status!=='observed'||original.traceSha256!==reference.expectedOriginalTraceSha256[scenario])throw Error('Original exact-trace gate failed: '+scenario);
  let projected=null;
  const orderedVariants=[...new Set(['projected',...variants])];
  for(const variant of orderedVariants){
   const row=runSameLyingRecovery({scenario,model:'projected',expectedSwitch:original.switchSnapshot,intervention:intervention(variant)});row.variant=variant;rows.push(row);
   const gate={scenario,variant,status:row.status,matchedNative:row.switchSnapshot?.nativeWorldSha256===original.switchSnapshot.nativeWorldSha256,matchedControl:row.switchSnapshot?.physicalControlSha256===original.switchSnapshot.physicalControlSha256&&row.switchSnapshot?.additionalControllerSha256===original.switchSnapshot.additionalControllerSha256,sameInput:row.inputSha256===original.inputSha256,slipObserved:(row.filteredSlip?.all?.allSolverPoints?.pointSamples??0)>0};guards.push(gate);
   if(row.status!=='observed'||!gate.matchedNative||!gate.matchedControl||!gate.sameInput||!gate.slipObserved)throw Error('Evidence gate failed: '+JSON.stringify(gate)+' '+row.error);
   if(variant==='projected')projected=row;
   if(variant==='cloneGait'){
    gate.cloneTraceMatchesProjected=row.traceSha256===projected.traceSha256;
    if(!gate.cloneTraceMatchesProjected)throw Error('Unchanged cloned Gait trace differs from projected: '+scenario);
   }
   if(variant==='contactAirborne')gate.traceMatchesProjected=row.traceSha256===projected.traceSha256;
   if(variant==='safeGateContactAirborne'){
    const safe=rows.find(r=>r.scenario===scenario&&r.variant==='safeUprightGate');
    gate.traceMatchesSafeUprightGate=safe?row.traceSha256===safe.traceSha256:null;
   }
   console.log(JSON.stringify({progress:true,scenario,variant,refalls:row.postStandRefallTransitions?.length,trace:row.traceSha256,gate}));
  }
 }
});}catch(e){error=e.stack;}finally{if(gaitModules)await rm(gaitModules.directory,{recursive:true,force:true});}
const after=await manifest();
const result={probe:'recovery_control_diagnosis',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceSha256:before,sourceSha256After:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),wallSeconds:(performance.now()-begin)/1000,acceptance:'not assessed; isolated diagnostic interventions, not game changes',energyCaution:'Delta(K+MgCOM.y) includes changing mass/inertia; native motor/contact work unresolved.',gaitIsolation:gaitModules?{sourceHashes:gaitModules.sourceHashes,scope:gaitModules.scope}:null,guards,error,summary:rows.map(summarize),rows};
await writeFile(opts.out??'/tmp/recovery-control.json',JSON.stringify(result,null,2)+'\n');
if(opts.out)await writeFile(opts.out.replace(/\.json$/,'')+'.summary.json',JSON.stringify({...result,rows:undefined},null,2)+'\n');
console.log(JSON.stringify({out:opts.out??'/tmp/recovery-control.json',wallSeconds:result.wallSeconds,sourceStable:result.sourceStable,error,summary:result.summary.map(({slip,...x})=>x)}));
if(error||!result.sourceStable)process.exitCode=1;

}
