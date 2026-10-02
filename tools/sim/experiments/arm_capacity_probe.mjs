// Research only: matched actual game strokes with explicit actuator capacity candidates.
import {runStroke} from '../whole_body_strike_probe.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {THREE} from '../harness_m.mjs';
import {readFile,readdir,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const plain=v=>({x:v.x,y:v.y,z:v.z});
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|variants|weapons|directions|endings|conditions)=(.+)$/.exec(s);if(!m)throw Error('Use --out/variants/weapons/directions/endings/conditions=value');return[m[1],m[2]];}));
const output=opts.out??'/tmp/arm-capacity.json';
const variants=(opts.variants??'baseline,clone,finalCap,portHill,combined').split(',');
const weapons=(opts.weapons??'sabre,zweihander').split(','),directions=(opts.directions??'down,up,cross').split(','),endings=(opts.endings??'release,target_hold').split(','),conditions=(opts.conditions??'healthy').split(',');
const allowed=['baseline','clone','finalCap','portHill','combined','runtimeFinalCap','elbowObserve','elbowRecreate','elbowBounded','combinedElbow'];
if(variants.some(x=>!allowed.includes(x))||conditions.some(x=>!['healthy','armWeak'].includes(x)))throw Error('Unknown candidate/condition');
try{await access(output);throw Error('Refusing to overwrite evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
async function manifest(){
 async function files(dir){let out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const paths=[...await files('src'),'tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/arm_capacity_probe.mjs','package-lock.json'];
 if(variants.some(v=>['clone','finalCap','portHill','combined','combinedElbow','runtimeFinalCap'].includes(v)))paths.push('tools/sim/experiments/arm_capacity_candidate.mjs');
 if(variants.some(v=>v.startsWith('elbow')||v==='combinedElbow'))paths.push('tools/sim/experiments/elbow_actuator_candidate.mjs','tools/sim/experiments/bounded_joint_motor.mjs');
 return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function experiment(variant,condition,modules,elbowModule){
 const record={variant,condition,configuredNative:null,configuredControl:null,dispatch:{driveSword:0,manualMuscle:0},diagnosticCount:0,frames:[],phase:{stroke:{workByPath:{}},after_input:{workByPath:{}}}},undo=[];
 let armInstall=null,elbowInstall=null,diagnostics=[];
 return {record,activate({G,f,ledger}){
  if(condition==='armWeak')f.limbs.armS=.15; // Isolated capacity field, not simulated injury or a wound trial.
  record.configuredNative=sha(G.world.takeSnapshot());
  record.configuredControl=sha(JSON.stringify({limbs:f.limbs,muscle:f.muscle,strength:f.strength,state:f.state,hand:f.handOffset.toArray(),jointTargets:f.joints.map(j=>[j.name,j.target.toArray(),j.prevRV?.toArray(),j.prevTarget?.toArray()])}));
  if(!ledger)return;
  if(variant==='runtimeFinalCap'){
   f.armTorqueModel='sharedCap';
   armInstall=modules.installer({f,ledger,variant:'clone',onDiagnostic:d=>{record.diagnosticCount++;diagnostics.push(d);}});
  }
  if(['clone','finalCap','portHill','combined','combinedElbow'].includes(variant))armInstall=modules.installer({f,ledger,variant:variant==='combinedElbow'?'combined':variant,onDiagnostic:d=>{record.diagnosticCount++;diagnostics.push(d);}});
  // Each candidate is installed through the ledger, preserving the actual wrapper dispatch.
  if(variant.startsWith('elbow')||variant==='combinedElbow')elbowInstall=elbowModule.installElbowActuator({G,f,ledger,mode:variant==='elbowObserve'?'observe':variant==='elbowRecreate'?'recreate':'bounded'});
 },afterStep({f,ledger,sample:s}){
  if(!ledger)return;
  const phase=record.phase[s.phase],segment=ledger.latest.physics[0],state=ledger.latest.postGame;
  for(const [path,b] of Object.entries(segment.balance.byPath))if(path.includes('driveSword')||path.includes('manualMuscle')||path.includes('elbowGravity')||path.includes('offHand')){
   const r=phase.workByPath[path]??={signedWorkApproxJ:0,positiveNetPathWorkApproxJ:0,negativeNetPathWorkApproxJ:0,bodies:{}};
   r.signedWorkApproxJ+=b.workApproxJ;r.positiveNetPathWorkApproxJ+=Math.max(0,b.workApproxJ);r.negativeNetPathWorkApproxJ+=Math.min(0,b.workApproxJ);
   for(const [label,x] of Object.entries(b.bodies))r.bodies[label]=(r.bodies[label]??0)+x.workApproxJ;
  }
  const actual={};
  for(const actuator of ['driveSword','manualMuscle','elbowGravity']){
   const ops=ledger.latest.operations.filter(e=>e.owner===f.index&&e.method==='addTorque'&&e.path.endsWith('.'+actuator));
   const force=new THREE.Vector3();let powerW=0,bodyTorques={};
   for(const op of ops){force.add(V(op.input));powerW+=op.instantPowerAtCallW;const t=bodyTorques[op.label]??={x:0,y:0,z:0};t.x+=op.input.x;t.y+=op.input.y;t.z+=op.input.z;}
   actual[actuator]={calls:ops.length,torqueSumNm:plain(force),instantPowerW:powerW,bodyTorques};
   if(ops.length)record.dispatch[actuator]=(record.dispatch[actuator]??0)+1;
  }
  for(const d of diagnostics){
   const method=d.actuator==='wrist'?'driveSword':'manualMuscle',body=d.actuator==='wrist'?'sword':'uarmS';
   const observed=actual[method],actualTorque=observed.bodyTorques[`${f.index}:${body}`];
   if(!actualTorque||V(actualTorque).distanceTo(V(d.torque))>1e-10)throw Error('Diagnostic torque differs from observed actual application');
   if(Math.abs(observed.instantPowerW-d.explicitRecipientPowerW)>1e-8*(1+Math.abs(observed.instantPowerW)))throw Error('Diagnostic power differs from actual operations');
   if(['finalCap','combined','combinedElbow','runtimeFinalCap'].includes(variant)&&V(d.torque).length()>d.capNm+1e-10)throw Error('Final explicit actuator exceeds cap');
  }
  const contacts=collectSupportContacts(f);let slip=0,points=0;
  for(const g of Object.values(contacts.groups))for(const c of g.contacts)if(c.hasSupport&&c.engineTouching&&c.freshTouching)for(const p of c.solverPoints)if(p.withinSlop&&p.distanceM<=0){slip=Math.max(slip,Math.hypot(p.relativeVelocity.x,p.relativeVelocity.z));points++;}
  const gaps=f.joints.map(j=>V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation())).distanceTo(V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()))));
  record.frames.push({timeS:s.timeS,phase:s.phase,state:f.state,muscle:f.muscle,strength:f.strength,armS:f.limbs.armS,tipSpeedMps:s.tipSpeedMps,swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,bodyKJ:state.total.K,maxJointGapM:Math.max(...gaps),slipMaxMps:slip,supportPointCount:points,actual,diagnostics});diagnostics=[];
 },restore(){record.armSummary=armInstall?.summary??null;record.elbowSummary=elbowInstall?.summary??null;elbowInstall?.restore();armInstall?.restore();for(const f of undo.reverse())f();}};
}
function summarize(row){const r=row.armExperiment;return {weapon:row.weapon,direction:row.direction,ending:row.ending,condition:r.condition,variant:r.variant,trace:row.traceSha256,input:row.inputSha256,configuredNative:r.configuredNative,configuredControl:r.configuredControl,peakTipMps:row.peak.tipSpeedMps,strokePeakTipMps:row.strokePeak.tipSpeedMps,...row.summary,nonStandSteps:r.frames.filter(x=>x.state!=='stand').length,maxBodyKJ:Math.max(...r.frames.map(x=>x.bodyKJ)),maxJointGapM:Math.max(...r.frames.map(x=>x.maxJointGapM)),maxSlipMps:Math.max(...r.frames.map(x=>x.slipMaxMps)),dispatch:r.dispatch,diagnosticCount:r.diagnosticCount,armSummary:r.armSummary,elbowSummary:r.elbowSummary,phase:r.phase};}
const started=performance.now(),before=await manifest(),rows=[],guards=[];let modules,elbowModule,error=null;
try{
 if(variants.some(v=>['clone','finalCap','portHill','combined','combinedElbow','runtimeFinalCap'].includes(v)))modules=await(await import('./arm_capacity_candidate.mjs')).loadArmCapacityCandidates();
 if(variants.some(v=>v.startsWith('elbow')||v==='combinedElbow'))elbowModule=await import('./elbow_actuator_candidate.mjs');
 for(const condition of conditions)for(const weapon of weapons)for(const direction of directions)for(const ending of endings){
  const plainExp=experiment('baseline',condition,null,null),unobserved=runStroke({weapon,direction,ending,reaction:'paired',intervention:plainExp});
  let baseline;
  for(const variant of [...new Set(['baseline',...variants])]){
   const exp=experiment(variant,condition,modules,elbowModule),row=runStroke({weapon,direction,ending,reaction:'paired',intervention:exp,ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:0})});row.armExperiment=exp.record;rows.push(row);
   const g={weapon,direction,ending,condition,variant,startNativeExact:row.startNativeSha256===unobserved.startNativeSha256,startControlExact:row.startSha256===unobserved.startSha256,inputExact:row.inputSha256===unobserved.inputSha256,configuredNativeExact:exp.record.configuredNative===plainExp.record.configuredNative,configuredControlExact:exp.record.configuredControl===plainExp.record.configuredControl,actualDriveExecuted:exp.record.dispatch.driveSword>0,actualShoulderExecuted:exp.record.dispatch.manualMuscle>0};
   if(variant==='baseline'){baseline=row;g.observerTraceExact=row.traceSha256===unobserved.traceSha256;}
   if(variant==='clone'||variant==='elbowObserve')g.cloneTraceExact=row.traceSha256===baseline.traceSha256;
   if(['clone','finalCap','portHill','combined','combinedElbow','runtimeFinalCap'].includes(variant)){g.diagnosticsExecuted=exp.record.diagnosticCount>0;g.noDiagnosticErrors=(exp.record.armSummary?.errors?.length??0)===0;}
   if(variant.startsWith('elbow')||variant==='combinedElbow'){
    const e=exp.record.elbowSummary,bounded=variant==='elbowBounded'||variant==='combinedElbow';
    g.elbowInstallerExecuted=!!e;g.elbowBodyPreserved=e?.bodyStatePreserved===true;g.elbowControlPreserved=e?.controlStatePreserved===true;
    g.elbowNativeIntercepted=e?.nativeCallsIntercepted>0;
    g.elbowNativeForwarding=bounded?e?.nativeCallsForwarded===0:e?.nativeCallsForwarded===e?.nativeCallsIntercepted;
    g.elbowActuatorDispatch=bounded?e?.actuatorCalls===e?.nativeCallsIntercepted&&e?.actuatorCalls>0:e?.actuatorCalls===0;
    g.elbowCap=bounded?e?.maxCapRatio<=1+1e-10:true;
   }
   guards.push(g);if(Object.values(g).includes(false))throw Error('Guard failed '+JSON.stringify(g));
   console.log(JSON.stringify({variant,condition,weapon,direction,ending,trace:row.traceSha256,peak:row.peak.tipSpeedMps,guards:g}));
  }
 }
}catch(e){error=e.stack;}finally{await modules?.cleanup();}
const after=await manifest(),stable=JSON.stringify(before)===JSON.stringify(after);
const result={probe:'arm_capacity',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceBefore:before,sourceAfter:after,sourceStable:stable,wallSeconds:(performance.now()-started)/1000,scope:{game:'Actual G.step and native bodies; paired measured grip, legacy prepared grip and legacy support; no opponent collisions',condition:'armWeak sets only limb capacity armS=.15 at matched checkpoint; not an injury simulation',capacity:'Existing shoulder/wrist swing cap shared with total explicit torque is a candidate design, not validated human joint envelope. Native elbow/spine/offarm and offhand spring remain separate unless elbow variant is selected',power:'Actual operation instantaneous torque power and segment midpoint work; not total native muscle work or damage'},guards,error,pass:!error&&stable,summary:rows.map(summarize),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});await writeFile(output.replace(/\.json$/,'.summary.json'),JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out:output,pass:result.pass,rows:rows.length,wallSeconds:result.wallSeconds}));if(!result.pass)process.exitCode=1;
