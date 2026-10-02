// Research only: matched natural recovery; source clones and observed dispatch.
import {runSameLyingRecovery,withOriginalRecovery} from './same_lying_recovery_probe.mjs';
import {LEG_NAMES,noteTargetHistory,rotationVector,transformRecoveryHandoffGait} from './recovery_handoff_candidate.mjs';
import {RAPIER,THREE,DT} from '../harness_m.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const ROOT=new URL('../../../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const args=process.argv.slice(2);if(args.some(x=>!/^--(?:out|variants|causal-reference)=.+$/.test(x)))throw Error('Use --out=PATH --variants=clone,targetBlend,contactPivot or --variants=uprightOff --causal-reference=PATH');
const causalReferencePath=args.find(x=>x.startsWith('--causal-reference='))?.slice(19);
const variants=(args.find(x=>x.startsWith('--variants='))?.slice(11)??'clone,targetBlend,contactPivot').split(',');
if(new Set(variants).size!==variants.length||variants.some(v=>!['clone','targetBlend','contactPivot','uprightOff'].includes(v))||(causalReferencePath?variants.join(',')!=='uprightOff':variants[0]!=='clone'))throw Error('Use clone-first variants or only uprightOff with verified causal reference');
const output=args.find(x=>x.startsWith('--out='))?.slice(6)??'/workspace/halfsword-hybrid-evidence/recovery-handoff.json';
try{await access(output);throw Error('Refusing to overwrite evidence: '+output);}catch(e){if(e.code!=='ENOENT')throw e;}
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),vec=v=>({x:v.x,y:v.y,z:v.z});
async function manifest(){async function files(dir){const out=[];for(const e of await readdir(new URL(dir,ROOT),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const paths=[...await files('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/same_lying_recovery_probe.mjs','tools/sim/experiments/recovery_handoff_candidate.mjs','tools/sim/experiments/recovery_handoff_probe.mjs','docs/strike/same_lying_recovery_summary.json','package-lock.json'];return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,hash(await readFile(new URL(p,ROOT)))])));}
function encode(v,depth=0){if(v==null||['number','boolean','string'].includes(typeof v))return v;if(depth>6||typeof v==='function')return undefined;if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();if(Array.isArray(v))return v.map(x=>encode(x,depth+1));if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)return undefined;return Object.fromEntries(Object.keys(v).sort().flatMap(k=>{const x=encode(v[k],depth+1);return x===undefined?[]:[[k,x]];}));}
function own(o){return Object.fromEntries(Object.keys(o).sort().filter(k=>!k.startsWith('recoveryHandoff')).flatMap(k=>{const v=encode(o[k]);return v===undefined?[]:[[k,v]];}));}
function control(f){return {bodies:Object.entries(f.bodies).map(([n,b])=>[n,b.translation(),b.rotation(),b.linvel(),b.angvel(),b.mass(),b.principalInertia()]),sword:[f.sword.translation(),f.sword.rotation(),f.sword.linvel(),f.sword.angvel()],anchor:[f.anchor.translation(),f.anchor.rotation(),f.anchor.linvel(),f.anchor.angvel()],fighter:own(f),gait:own(f.gait),skill:own(f.skill),joints:f.joints.map(j=>({name:j.name,target:j.target.toArray(),prevRV:j.prevRV?.toArray()??null,gain:j.gain??1}))};}
function support(f){const c=collectSupportContacts(f,{detail:true});return {anySupport:c.anySupport,groups:Object.fromEntries(Object.entries(c.groups).map(([n,g])=>[n,{hasSupport:g.hasSupport,rawNormalImpulseNs:g.rawNormalImpulseNs,supportedVerticalN:g.contacts.filter(c=>c.hasSupport).reduce((s,c)=>s+c.rawNormalImpulseNs*c.normalAlignmentWithUp,0)/DT,points:g.contacts.filter(c=>c.hasSupport).flatMap(c=>c.solverPoints.filter(p=>p.withinSlop).map(p=>({point:p.point,distanceM:p.distanceM,slipMps:Math.hypot(p.relativeVelocity.x,p.relativeVelocity.z)})))}]))};}
function feet(f){const out={};for(const k of ['F','B']){const l=f.gait.legs[k],b=f.bodies[l.foot],q=Q(b.rotation()),actual=new THREE.Vector3(-.05,.035,0).applyQuaternion(q).add(V(b.translation())),p=f.bodies.pelvis,hip=new THREE.Vector3(0,-.04,l.side*.095).applyQuaternion(Q(p.rotation())).add(V(p.translation()));out[k]={stance:l.stance,actualAnkle:vec(actual),sensedAnkle:vec(l.ankle),plant:vec(l.plant),hip:vec(hip),sensedHip:vec(l.hip),pelvisRotation:{...p.rotation()},plantOffsetM:actual.distanceTo(l.plant),horizontalPlantOffsetM:Math.hypot(actual.x-l.plant.x,actual.z-l.plant.z),hipToPlantM:hip.distanceTo(l.plant),hipToAnkleM:hip.distanceTo(actual),horizontalHipToPlantM:Math.hypot(hip.x-l.plant.x,hip.z-l.plant.z),soleY:l.soleY,toeY:l.toeY,N:l.N??0,extra:l.extra??0,heel:l.heel};}return out;}
function goals(f){return Object.fromEntries(LEG_NAMES.map(n=>[n,{target:f.jointByName[n].target.toArray(),prevRV:f.jointByName[n].prevRV?.toArray()??null,gain:f.jointByName[n].gain??1}]));}
let directory,CloneFighter;const Gaits={},cloneHashes={};
async function prepare(){directory=await mkdtemp(join(tmpdir(),'halfsword-recovery-handoff-'));
 function rewrite(source,sourceUrl){return source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceUrl).href:import.meta.resolve(p)));}
 const fighterSource=rewrite(await readFile(new URL('src/fighter.js',ROOT),'utf8'),new URL('src/fighter.js',ROOT));const fighterPath=join(directory,'fighter-clone.mjs');await writeFile(fighterPath,fighterSource);cloneHashes.fighter=hash(fighterSource);({Fighter:CloneFighter}=await import(pathToFileURL(fighterPath).href));
 const gaitSource=rewrite(await readFile(new URL('src/gait.js',ROOT),'utf8'),new URL('src/gait.js',ROOT));
 for(const variant of variants){const source=transformRecoveryHandoffGait(gaitSource,{variant:variant==='uprightOff'?'clone':variant,duration:.35}),path=join(directory,variant+'.mjs');await writeFile(path,source);cloneHashes[variant]=hash(source);({Gait:Gaits[variant]}=await import(pathToFileURL(path).href));}
}
function intervention(variant,expected=null){const undo=[];let currentFrame=null,lastPose=null,prefix=createHash('sha256'),prefixCount=0,firstStand=false,offRemaining=null,oldUpright=null,ledgerReference;return {
 activate({G,f,row,ledger}){
  ledgerReference=ledger;
  row.handoff={variant,cloneDispatch:{gaitUpdate:0,applyPose:0,updateState:0},transitions:[],entries:[],stepEvents:[],frames:[],nativeDemandDefinition:'Configured native motor targets/velocities/k/d only. stiffnessErrorProxy is k*(configured target-current rotvec component); it is not solver-delivered torque. Native constraint/motor work remains unmeasured.'};
  if(typeof ledger.replaceObservedMethod!=='function')throw Error('Observed dispatch replacement required');
  for(const name of Object.getOwnPropertyNames(Gaits[variant].prototype)){const method=Object.getOwnPropertyDescriptor(Gaits[variant].prototype,name)?.value;if(name==='constructor'||typeof method!=='function')continue;
   const wrapped=name==='update'?function(...a){row.handoff.cloneDispatch.gaitUpdate++;return method.apply(this,a);}:name==='enter'?function(...a){const before={goals:goals(f),feet:feet(f),support:support(f)};const out=method.apply(this,a);row.handoff.entries.push({timeS:G.t-row.prepareSeconds,before,after:{goals:goals(f),feet:feet(f),support:support(f)},sourceProbe:{...this.recoveryHandoffProbe}});return out;}:name==='begin'?function(l,kind,T){row.handoff.stepEvents.push({timeS:G.t-row.prepareSeconds,foot:l.k,kind,T,feet:feet(f),support:support(f)});return method.call(this,l,kind,T);}:name==='legIK'?function(l,h,a,yaw,pitch,...rest){if(currentFrame)(currentFrame.ik??=[]).push({foot:l.k,hip:vec(h),ankleTarget:vec(a),yaw,pitch,actualAnkle:feet(f)[l.k].actualAnkle});return method.call(this,l,h,a,yaw,pitch,...rest);}:method;
   undo.push(ledger.replaceObservedMethod(f.gait,name,wrapped));
  }
  undo.push(ledger.replaceObservedMethod(f,'updateState',function(dt){
   row.handoff.cloneDispatch.updateState++;currentFrame={timeS:G.t-row.prepareSeconds+dt,from:this.state,native:[],beforeGoals:goals(f)};
   if(variant==='uprightOff'&&offRemaining===0){const data=RAPIER.JointData.generic({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0},0),joint=G.world.createImpulseJoint(data,f.anchor,f.bodies.pelvis,true);for(const axis of [3,4,5])joint.rawSet.jointConfigureMotorModel(joint.handle,axis,1);f.uprightJoint=joint;offRemaining=null;row.handoff.uprightIntervention.recreatedAtS=G.t-row.prepareSeconds;}
   const imminent=!firstStand&&this.state==='getup'&&this.stateTime>this.kneelTime+this.riseTime&&this.legHealth>=.25;
   if(imminent){const c=control(f);row.handoff.preStandCheckpoint={nativeSha256:hash(G.world.takeSnapshot()),controllerSha256:hash(JSON.stringify(c)),bodyPrefixSha256:prefix.copy().digest('hex'),prefixFrames:prefixCount,control:c};if(expected){row.handoff.preStandCheckpoint.matched=['nativeSha256','controllerSha256','bodyPrefixSha256','prefixFrames'].every(k=>row.handoff.preStandCheckpoint[k]===expected[k]);if(!row.handoff.preStandCheckpoint.matched)throw Error('Pre-stand native/controller/prefix mismatch');}}
   const out=CloneFighter.prototype.updateState.call(this,dt);currentFrame.to=this.state;
   if(variant==='uprightOff'&&imminent&&this.state==='stand'){
    oldUpright=f.uprightJoint;const c=control(f),bodyBefore=hash(JSON.stringify(c.bodies));G.world.removeImpulseJoint(oldUpright,true);
    if(bodyBefore!==hash(JSON.stringify(control(f).bodies)))throw Error('Upright removal changed body state');
    offRemaining=Math.round(.35/DT);row.handoff.uprightIntervention={removedAtS:G.t-row.prepareSeconds,offPhysicsSteps:offRemaining,suppressedCalls:0,bodyPreserved:true,oldHandle:String(oldUpright.handle)};
   }
   if(currentFrame.from!==currentFrame.to)row.handoff.transitions.push({timeS:currentFrame.timeS,from:currentFrame.from,to:currentFrame.to,beforeGoals:currentFrame.beforeGoals,support:support(f),anchorQ:{...f.anchor.rotation()}});
   return out;
  }));
  undo.push(ledger.replaceObservedMethod(f,'applyPose',function(dt){row.handoff.cloneDispatch.applyPose++;const before=goals(f),out=CloneFighter.prototype.applyPose.call(this,dt),after=goals(f);
   currentFrame.goalChanges=LEG_NAMES.map(n=>({name:n,angleRad:new THREE.Quaternion().fromArray(before[n].target).angleTo(new THREE.Quaternion().fromArray(after[n].target)),incomingTargetRateRadS:lastPose?rotationVector(new THREE.Quaternion().fromArray(before[n].target).multiply(new THREE.Quaternion().fromArray(lastPose[n].target).invert())).multiplyScalar(1/dt).toArray():null,target:after[n].target}));lastPose=before;noteTargetHistory(f,dt);return out;}));
  const raw=f.uprightJoint.rawSet,original=raw.jointConfigureMotor,handles=new Map(f.joints.filter(j=>LEG_NAMES.includes(j.name)).map(j=>[j.joint.handle,j]));
  raw.jointConfigureMotor=function(handle,axis,target,velocity,k,d){const j=handles.get(handle);if(j&&currentFrame){const cur=rotationVector(j.restInv.clone().multiply(Q(j.parent.rotation()).invert().multiply(Q(j.child.rotation())))),component=j.type==='hinge'?'z':['x','y','z'][axis-3];currentFrame.native.push({name:j.name,axis,target,velocity,k,d,stiffnessErrorProxyNm:k*(target-cur[component])});}return original.call(this,handle,axis,target,velocity,k,d);};undo.push(()=>{raw.jointConfigureMotor=original;});
  const position=raw.jointConfigureMotorPosition;
  raw.jointConfigureMotorPosition=function(handle,axis,target,k,d){
   const ours=handle===f.uprightJoint.handle;
   const suppressed=variant==='uprightOff'&&offRemaining!=null&&handle===oldUpright?.handle;
   if(ours&&currentFrame)(currentFrame.upright??=[]).push({axis,target,k,d,suppressed});
   if(suppressed){row.handoff.uprightIntervention.suppressedCalls++;if(axis===5)offRemaining--;return;}
   return position.call(this,handle,axis,target,k,d);
  };undo.push(()=>{raw.jointConfigureMotorPosition=position;});
 },
 afterStep({G,f,row,observation,ledger}){
  if(!row.handoff)return;
  const c=control(f);if(!firstStand&&f.state!=='stand'){prefix.update(JSON.stringify(c));prefixCount++;}
  const isFirst=!firstStand&&f.state==='stand';if(isFirst){firstStand=true;row.handoff.firstStandTimeS=observation.timeS;}
  currentFrame??={native:[],goalChanges:[]};currentFrame.timeS=observation.timeS;currentFrame.state=f.state;currentFrame.pelvisHeightM=observation.pelvisHeightM;currentFrame.gapM=observation.maxJointAnchorGapM;currentFrame.KJ=observation.actualKineticJ;
  currentFrame.anchorQ={...f.anchor.rotation()};currentFrame.support=support(f);currentFrame.feet=feet(f);
  const balance=ledgerReference.latest.physics[0].balance;
  currentFrame.explicitBalance={explicitForceImpulseNs:balance.explicitForceImpulse,explicitAngularImpulseNms:balance.explicitAngularImpulse,workApproxJ:balance.forceWorkApproxJ,gravityWorkApproxJ:balance.gravityWorkApproxJ,massChanges:balance.massPropertyChanges,
   byPath:Object.fromEntries(Object.entries(balance.byPath).map(([path,b])=>[path,{workApproxJ:b.workApproxJ,netForceN:b.netForceN,netTorqueAboutOriginNm:b.netTorqueAboutOriginNm}]))};
  if((row.handoff.firstStandTimeS!=null&&observation.timeS<=row.handoff.firstStandTimeS+1.5)||currentFrame.from!==currentFrame.to)row.handoff.frames.push(currentFrame);
  // Small continuous maxima, preserving full runner compact frames separately.
  const m=row.handoff.maxima??={goalStepRad:0,configuredVelocityRadS:0,stiffnessErrorProxyNm:0};for(const g of currentFrame.goalChanges??[])m.goalStepRad=Math.max(m.goalStepRad,g.angleRad);for(const a of currentFrame.native){m.configuredVelocityRadS=Math.max(m.configuredVelocityRadS,Math.abs(a.velocity));m.stiffnessErrorProxyNm=Math.max(m.stiffnessErrorProxyNm,Math.abs(a.stiffnessErrorProxyNm));}
  row.handoff.sourceExecution={...f.gait.recoveryHandoffProbe};currentFrame=null;
 },restore(){for(const restore of undo.reverse())restore();}
};}
function summary(r){const fs=r.launchObservation?.compactPerStep??[],start=r.firstStandS??Infinity,after=fs.filter(f=>f.timeS>=start);return {scenario:r.scenario,variant:r.handoff?.variant,status:r.status,error:r.error??null,traceSha256:r.traceSha256,firstStandS:r.firstStandS,refalls:r.postStandRefallTransitions?.length,preStandMatched:r.handoff?.preStandCheckpoint?.matched??null,sourceExecution:r.handoff?.sourceExecution,cloneDispatch:r.handoff?.cloneDispatch,maxima:r.handoff?.maxima,afterFirstStand:{maxKJ:after.length?Math.max(...after.map(f=>f.KJ)):null,maxHeightM:after.length?Math.max(...after.map(f=>f.pelvisHeightM)):null,maxUpVelocityMps:after.length?Math.max(...after.map(f=>f.pelvisVelocityMps.y)):null,maxGapM:after.length?Math.max(...after.map(f=>f.maxJointAnchorGapM)):null,noMeasuredGroupSupportS:r.launchObservation?.maxNoConfirmedMeasuredGroupSupportIntervalS,slip:r.filteredSlip?.afterFirstStand},ledger:r.ledger?.summary};}
function windowSummary(r){
 const frames=r.launchObservation.compactPerStep,start=r.firstStandS,before=frames.filter(f=>f.timeS<start).at(-1),window=frames.filter(f=>f.timeS>=start&&f.timeS<start+.35-1e-10),detailed=r.handoff.frames.filter(f=>f.timeS>=start&&f.timeS<start+.35-1e-10),last=window.at(-1);
 const potential=f=>9.81*f.massKg*f.COM.y;
 return {firstStandS:start,windowPhysicsSteps:window.length,before:{timeS:before.timeS,KJ:before.KJ,potentialJ:potential(before),massKg:before.massKg},first:window[0],last,
  deltaKJ:last.KJ-before.KJ,deltaMechanicalJ:last.KJ+potential(last)-before.KJ-potential(before),maxKJ:Math.max(...window.map(f=>f.KJ)),
  explicitWorkApproxJ:window.reduce((s,f)=>s+f.explicitWorkApproxJ,0),wholeBodyRawGroundImpulseNs:window.reduce((s,f)=>s+f.rawGroundImpulseNs,0),
  confirmedGroupUpwardImpulseNs:detailed.reduce((s,f)=>s+Object.values(f.support.groups).reduce((n,g)=>n+g.supportedVerticalN*DT,0),0),
  noMeasuredGroupSupportSteps:detailed.filter(f=>!f.support.anySupport).length,massChanges:window.flatMap(f=>f.massChanges.length?[{timeS:f.timeS,changes:f.massChanges}]:[]),
  firstControllerFrame:detailed[0],intervention:r.handoff.uprightIntervention??null};
}
const before=await manifest(),start=performance.now(),rows=[],guards=[],originals=[];let error=null;
let causalReference=null,referenceRows={};const causalComparisons=[];
if(causalReferencePath){
 const raw=await readFile(causalReferencePath),prior=JSON.parse(raw);
 if(prior.error||!prior.sourceStable||prior.guards.some(g=>Object.entries(g).some(([k,v])=>!['scenario','variant'].includes(k)&&v!==true)))throw Error('Causal reference evidence did not pass');
 const sourceParity=Object.entries(before).filter(([p])=>p!=='tools/sim/experiments/recovery_handoff_probe.mjs').every(([p,h])=>prior.sourceHashes[p]===h);
 if(!sourceParity)throw Error('Causal reference executed-source hashes differ');
 causalReference={path:causalReferencePath,sha256:hash(raw),sourceParity,cloneHashes:prior.cloneHashes,originals:prior.originals,verifiedGuards:prior.guards};
 for(const scenario of ['healthy_getup','hurt_getup']){const r=prior.rows.find(r=>r.scenario===scenario&&r.handoff?.variant==='clone');if(!r)throw Error('Missing prior clone baseline');referenceRows[scenario]=r;}
}
try{await prepare();await withOriginalRecovery(async reference=>{
 if(causalReference&&(cloneHashes.fighter!==causalReference.cloneHashes.fighter||cloneHashes.uprightOff!==causalReference.cloneHashes.clone))throw Error('Reused source clone hashes differ');
 for(const scenario of ['healthy_getup','hurt_getup']){
  const original=causalReference?causalReference.originals.find(r=>r.scenario===scenario):runSameLyingRecovery({scenario,model:'axial'});originals.push({scenario,status:original.status,traceSha256:original.traceSha256,inputSha256:original.inputSha256,switchSnapshot:original.switchSnapshot,reused:!!causalReference});
  if(original.status!=='observed'||original.traceSha256!==reference.expectedOriginalTraceSha256[scenario])throw Error('Original exact trace guard failed: '+scenario);
  let baseline=referenceRows[scenario];
  for(const variant of variants){const r=runSameLyingRecovery({scenario,model:'projected',expectedSwitch:original.switchSnapshot,intervention:intervention(variant,baseline?.handoff?.preStandCheckpoint)});rows.push(r);
   const guard={scenario,variant,observed:r.status==='observed',originalTraceExact:true,switchExact:r.switchGuardPassed===true,sameInput:r.inputSha256===original.inputSha256,dispatchExecuted:(r.handoff?.cloneDispatch?.gaitUpdate??0)>0&&(r.handoff?.cloneDispatch?.applyPose??0)>0&&(r.handoff?.sourceExecution?.updateCalls??0)>0,preStandExists:!!r.handoff?.preStandCheckpoint};
   if(variant==='clone'){guard.cloneTraceExact=r.traceSha256===reference.rows.find(r=>r.scenario===scenario).sameLying.projectedTraceSha256;baseline=r;}else{guard.preStandExact=r.handoff?.preStandCheckpoint?.matched===true;guard.candidateApplied=variant==='targetBlend'?(r.handoff?.sourceExecution?.targetApplications??0)>0:variant==='uprightOff'?(r.handoff?.uprightIntervention?.suppressedCalls===126&&r.handoff.uprightIntervention.bodyPreserved&&r.handoff.uprightIntervention.recreatedAtS!=null):(r.handoff?.sourceExecution?.pivotApplications??0)>0;}
   guards.push(guard);if(Object.entries(guard).some(([k,v])=>!['scenario','variant'].includes(k)&&v!==true))throw Error('Execution/clone/matched guard failed: '+JSON.stringify(guard)+' '+r.error);
   if(causalReference)causalComparisons.push({scenario,baselineTraceSha256:baseline.traceSha256,baseline:windowSummary(baseline),uprightOff:windowSummary(r)});
  }
 }
});}catch(e){error=e.stack;process.exitCode=1;}finally{if(directory)await rm(directory,{recursive:true,force:true});}
const after=await manifest(),result={probe:'recovery_handoff',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHashes:before,sourceHashesAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),cloneHashes,variants,causalReference,causalComparisons,protocol:{seed:7,DT,durationS:.35,durationMeaning:'Research trajectory blending time, not a physiological constant. No physical body velocity/height limits, state-entry blocking, extra force or weapon reaction changes. Causal uprightOff alone removes upright for 42 physics steps then recreates the original free generic/ForceBased actuator.',nativeTorqueLimit:'Native solver-delivered torque/work unavailable; configured requests and a stiffness error proxy are reported separately from explicit force ledger.',correctedObservation:'Hip offset .04m matches Gait.sense. Prior r2 hip distances used .07m and are excluded from reach conclusions; other observations and physics trajectories are unchanged.'},wallSeconds:(performance.now()-start)/1000,error,guards,originals,summary:rows.map(summary),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});await writeFile(output.replace(/\.json$/,'')+'.summary.json',JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,error,sourceStable:result.sourceStable,wallSeconds:result.wallSeconds,guards,summary:result.summary.map(s=>({...s,ledger:undefined,afterFirstStand:{...s.afterFirstStand,slip:undefined}}))},null,2));
if(error||!result.sourceStable)process.exitCode=1;
