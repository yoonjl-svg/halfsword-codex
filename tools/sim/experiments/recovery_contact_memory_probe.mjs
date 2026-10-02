import {clearStanceFrictionMemory} from './recovery_contact_memory_candidate.mjs';
import {installRecoveryTouchdownObserver} from './recovery_touchdown_observer.mjs';
// Q02 actual game screen: existing horizontal controller, contact-conditioned COM target.
import {runSameLyingRecovery,withOriginalRecovery} from './same_lying_recovery_probe.mjs';
import {bindRecoveryCapture,observeRecoveryCapture,transformRecoveryCaptureFighter} from './recovery_capture_candidate.mjs';
import {DT,CONFIG} from '../harness_m.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const ROOT=new URL('../../../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const args=process.argv.slice(2);
if(args.some(a=>!/^--(out=.+|support=(projected|legacy)|pulse=(none|left|right))$/.test(a)))throw Error('Use --out=PATH --support=projected|legacy --pulse=none|left|right');
const output=args.find(a=>a.startsWith('--out='))?.slice(6)??'/workspace/halfsword-hybrid-evidence/q02-contact-memory-r1.json';
const supportModel=args.find(a=>a.startsWith('--support='))?.slice(10)??'projected';
const pulse=args.find(a=>a.startsWith('--pulse='))?.slice(8)??'none';
for(const p of [output,output+'.summary.json'])try{await access(p);throw Error('Refusing evidence overwrite '+p);}catch(e){if(e.code!=='ENOENT')throw e;}
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
function encode(v,depth=0){if(v==null||['number','boolean','string'].includes(typeof v))return v;if(depth>6||typeof v==='function')return undefined;if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();if(Array.isArray(v))return v.map(x=>encode(x,depth+1));if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)return undefined;return Object.fromEntries(Object.keys(v).sort().flatMap(k=>{const x=encode(v[k],depth+1);return x===undefined?[]:[[k,x]];}));}
const own=o=>Object.fromEntries(Object.keys(o).sort().flatMap(k=>{const v=encode(o[k]);return v===undefined?[]:[[k,v]];}));
function control(f){return {fighter:own(f),gait:own(f.gait),skill:own(f.skill),joints:f.joints.map(j=>({name:j.name,target:j.target.toArray(),prevRV:j.prevRV?.toArray()??null,gain:j.gain??1,k:j.k,d:j.d,max:j.max}))};}
async function manifest(){async function walk(dir){const out=[];for(const e of await readdir(new URL(dir,ROOT),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await walk(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const files=[...await walk('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/same_lying_recovery_probe.mjs','tools/sim/experiments/recovery_com_transfer_candidate.mjs','tools/sim/experiments/recovery_capture_candidate.mjs','tools/sim/experiments/recovery_capture_probe.mjs','tools/sim/experiments/recovery_contact_memory_candidate.mjs','tools/sim/experiments/recovery_contact_memory_probe.mjs','tools/sim/experiments/recovery_touchdown_observer.mjs','docs/strike/same_lying_recovery_summary.json','package-lock.json'];
 return Object.fromEntries(await Promise.all(files.sort().map(async p=>[p,hash(await readFile(new URL(p,ROOT)))])));}
let temp,Clone,cloneSha;
async function prepare(){temp=await mkdtemp(join(tmpdir(),'halfsword-recovery-com-'));const url=new URL('src/fighter.js',ROOT);let source=await readFile(url,'utf8');source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,url).href:import.meta.resolve(p)));source=transformRecoveryCaptureFighter(source);cloneSha=hash(source);const file=join(temp,'fighter.mjs');await writeFile(file,source);({Fighter:Clone}=await import(pathToFileURL(file).href));}
function intervention(variant,expected=null){const undo=[];let diagnostic,context,report,ledgerRef,Gref,fref,prefix=createHash('sha256'),prefixFrames=0,started=false;
 return {activate({G,f,row,ledger}){
   if(supportModel==='legacy')CONFIG.BODY.supportModel='legacy';
   Gref=G;fref=f;ledgerRef=ledger;report=row.comTransfer??={variant,frames:[],requests:[]};
   report.externalPulse=[];report.memory=[];diagnostic=installRecoveryTouchdownObserver({G,f,row,ledger});undo.push(()=>diagnostic.restore());report.touchdown=diagnostic.out;
   const pulseDirection=f.right().clone().multiplyScalar(pulse==='left'?-18:18),switchTime=G.t;
   const applyPulse=()=>{const t=G.t-switchTime;if(pulse==='none'||t<.4-1e-9||t>=.6-1e-9)return;
     f.bodies.pelvis.addForce({x:pulseDirection.x,y:pulseDirection.y,z:pulseDirection.z},true);
     report.externalPulse.push({timeS:(Math.round((G.t-row.prepareSeconds)/DT)+1)*DT,forceN:{x:pulseDirection.x,y:pulseDirection.y,z:pulseDirection.z}});};
   const stamp=()=>({timeS:(Math.round((G.t-row.prepareSeconds)/DT)+1)*DT,nativeSha256:hash(G.world.takeSnapshot()),controllerSha256:hash(JSON.stringify(control(f))),prefixSha256:prefix.copy().digest('hex'),prefixFrames});
   context={enabled:false,mode:variant.includes('Capture')||variant==='captureCarry'?'capture':'static',calls:0,applications:0,record(event){
     if(event.eligible&&!report.firstEligible){report.firstEligible=stamp();if(expected?.firstEligible){report.firstEligibleExact=JSON.stringify(report.firstEligible)===JSON.stringify(expected.firstEligible);if(!report.firstEligibleExact)throw Error('First eligible native/controller/prefix mismatch');}}
     if(event.eligible&&context.enabled)started=true;
     report.requests.push({timeS:(Math.round((G.t-row.prepareSeconds)/DT)+1)*DT,state:f.state,stateTime:f.stateTime,levH:f.gait?.levH??0,...event});
   }};
   const originalEnter=Object.getPrototypeOf(f.gait).enter;
   undo.push(ledger.replaceObservedMethod(f.gait,'enter',function(...args){
     const entry={...stamp(),before:Object.fromEntries(['F','B'].map(k=>[k,{Nf:this.legs[k].Nf??null,N:this.legs[k].N??null}]))};
     if(variant==='memoryReset'){if(report.memory.length===0){entry.preMemoryExact=JSON.stringify(entry)===JSON.stringify(expected?.memory?.[0]);if(!entry.preMemoryExact)throw Error('First memory entry native/controller/prefix mismatch');}else entry.preMemoryExact=null;started=true;clearStanceFrictionMemory(this);entry.afterReset=Object.fromEntries(['F','B'].map(k=>[k,{Nf:this.legs[k].Nf,N:this.legs[k].N??null}]));}
     report.memory.push(entry);return originalEnter.apply(this,args);
   }));
   if(variant!=='baseline')undo.push(bindRecoveryCapture(f,context));
   if(variant!=='baseline'||pulse!=='none'){const method=variant==='baseline'?Object.getPrototypeOf(f).driveBalance:Clone.prototype.driveBalance;
     undo.push(ledger.replaceObservedMethod(f,'driveBalance',function(...a){applyPulse();return method.apply(this,a);}));}
 },afterStep({f,row,observation}){
   diagnostic?.afterStep(observation);
   report??=row.comTransfer??={variant,frames:[],requests:[]};
   const support=observeRecoveryCapture(f);
   report.frames.push({timeS:observation.timeS,state:f.state,stateTimeS:f.stateTime,kneelAmount:f.kneelAmount,
     support,pelvisHeightM:observation.pelvisHeightM,KJ:observation.actualKineticJ,gapM:observation.maxJointAnchorGapM,
     force:observation.balanceProbe?{x:observation.balanceProbe.horizontalXN,z:observation.balanceProbe.horizontalZN}:null,
     stance:{F:f.gait.legs.F.stance,B:f.gait.legs.B.stance},levH:f.gait.levH,
     ankles:Object.fromEntries(['F','B'].map(k=>{const l=f.gait.legs[k];return[k,{ankle:l.ankle?.toArray(),plant:l.plant?.toArray(),N:l.N,extra:l.extra}];})),pelvisVelocity:f.bodies.pelvis.linvel(),correctionApplied:context?.applications??0});
   if(context){report.calls=context.calls;report.applications=context.applications;
     if(!started){prefix.update(JSON.stringify(control(f)));prefixFrames++;}
   }
 },restore(){for(const u of undo.reverse())u();}};
}
const extreme=(xs,key)=>xs.length?Math.max(...xs.map(x=>x[key])):null;
function summarize(r){const fs=r.comTransfer.frames,stand=r.firstStandS,getup=fs.filter(f=>f.state==='getup'&&(stand==null||f.timeS<stand)),post=fs.filter(f=>stand!=null&&f.timeS>=stand),last=getup.at(-1),req=r.comTransfer.requests;
 const supported=getup.filter(x=>x.support.outsideM!=null);
 return {scenario:r.scenario,variant:r.comTransfer.variant,traceSha256:r.traceSha256,firstStandS:stand,firstRefallS:r.postStandRefallTransitions?.[0]?.timeS??null,refalls:r.postStandRefallTransitions?.length,
  calls:r.comTransfer.calls??0,applications:r.comTransfer.applications??0,eligibleRequests:req.filter(x=>x.eligible).length,
  firstEligible:r.comTransfer.firstEligible??null,firstEligibleExact:r.comTransfer.firstEligibleExact??null,
  firstGetup:{steps:getup.length,emptyHullSteps:getup.length-supported.length,maxOutsideSupportM:supported.length?Math.max(...supported.map(x=>x.support.outsideM)):null,lastOutsideSupportM:last?.support.outsideM??null,lastCOM:last?.support.com??null,lastGroups:last?.support.groups??null},
  whole:{maxKJ:extreme(fs,'KJ'),maxGapM:extreme(fs,'gapM'),maxPelvisHeightM:extreme(fs,'pelvisHeightM'),maxCOMUpMps:r.launchObservation.peaks.COMVy.COMVelocityMps.y},
  postStand:{maxKJ:extreme(post,'KJ'),maxGapM:extreme(post,'gapM'),maxPelvisHeightM:extreme(post,'pelvisHeightM'),slip:r.filteredSlip.afterFirstStand.confirmedSupportPoints},
  stateTransitions:r.transitions,memory:r.comTransfer.memory,touchdownFrames:r.comTransfer.touchdown?.length??0,limits:'contact hull is geometric support, not COP or sufficient force capacity; COM uses actual selected dynamic masses; existing driveBalance force and upright remain; no native total work inference'};
}
const before=await manifest(),headBefore=head(),started=performance.now(),rows=[],guards=[],originals=[];let error=null;
try{await prepare();await withOriginalRecovery(async reference=>{for(const scenario of ['healthy_getup','hurt_getup']){
 const original=runSameLyingRecovery({scenario,model:'axial'});originals.push({scenario,status:original.status,traceSha256:original.traceSha256});
 if(original.status!=='observed'||original.traceSha256!==reference.expectedOriginalTraceSha256[scenario])throw Error('Historical original trace mismatch '+scenario);
 let baseline;const observations={};
 for(const variant of ['baseline','observe','memoryReset']){
   const r=runSameLyingRecovery({scenario,model:'projected',expectedSwitch:original.switchSnapshot,intervention:intervention(variant,variant==='memoryReset'?observations.static?.comTransfer:null)});rows.push(r);
   const guard={scenario,variant,observed:r.status==='observed',checkpoint:r.switchGuardPassed===true,input:r.inputSha256===original.inputSha256,finite:r.finite===true};
   if(variant==='baseline')baseline=r;
   else{guard.actualCloneCalls=(r.comTransfer.calls??0)>0;guard.eligible=(r.comTransfer.requests??[]).some(x=>x.eligible);}
   if(variant.startsWith('observe')){observations[variant==='observeCapture'?'capture':'static']=r;guard.observationExact=r.traceSha256===baseline.traceSha256;}
   if(variant==='memoryReset'){guard.preMemoryExact=r.comTransfer.memory.length>0&&r.comTransfer.memory[0].preMemoryExact===true;guard.memoryCleared=r.comTransfer.memory.every(x=>x.afterReset.F.Nf===0&&x.afterReset.B.Nf===0);guard.oldPositiveMemoryObserved=r.comTransfer.memory.some(x=>x.before.F.Nf>0||x.before.B.Nf>0);guard.physicalTraceChanged=r.traceSha256!==baseline.traceSha256;}
   guard.externalPulseCount=r.comTransfer.externalPulse.length===(pulse==='none'?0:24);
   if(variant!=='baseline')guard.externalPulseExact=JSON.stringify(r.comTransfer.externalPulse)===JSON.stringify(baseline.comTransfer.externalPulse);
   guard.nativeFootBodiesObserved=r.comTransfer.touchdown.every(x=>x.prePhysicsBodies.length===6&&x.postPhysicsBodies.length===6);
   guards.push(guard);console.log(JSON.stringify({scenario,variant,guard,refalls:r.postStandRefallTransitions?.length,applications:r.comTransfer?.applications,error:r.error}));
   if(Object.entries(guard).some(([k,v])=>!['scenario','variant'].includes(k)&&v!==true))throw Error('Execution guard failed '+JSON.stringify(guard)+' '+r.error);
 }
}});}catch(e){error=e.stack;process.exitCode=1;}finally{if(temp)await rm(temp,{recursive:true,force:true});}
const after=await manifest(),headAfter=head(),result={probe:'recovery_contact_memory',createdUTC:new Date().toISOString(),command:'node tools/sim/experiments/recovery_contact_memory_probe.mjs '+args.join(' '),headBefore,headAfter,headStable:headBefore===headAfter,sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),cloneSha,wallSeconds:(performance.now()-started)/1000,error,guards,originals,
 protocol:{seed:7,weapon:'longsword',condition:'healthy or front-leg controller .45, not collision wound',support:supportModel+' after matched low-down checkpoint; paired grip; assist .1/catch on/1',pulse:{direction:pulse,magnitudeN:pulse==='none'?0:18,applied:'pelvis COM, world direction fixed from matched checkpoint right vector',startAfterCheckpointS:.4,durationS:.2},candidate:'At Gait.enter only reset per-foot filtered friction-load peak Nf to zero. Next pinFeet reads current contact normally. No COM correction. N, Nsum, mass, plant, motor and force gains unchanged.',limitations:'No position/velocity injection, state timing change, new gains or extra force path. Existing horizontal direct support is not replaced by ground-reaction leg actuation. This screen tests contact-conditioned COM control, not completed hand/knee/foot load transfer or human realism.'},summary:rows.filter(r=>r.status==='observed').map(summarize),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});await writeFile(output+'.summary.json',JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sourceStable:result.sourceStable,headStable:result.headStable,wallSeconds:result.wallSeconds,error,summary:result.summary}));
if(error||!result.sourceStable||!result.headStable)process.exitCode=1;
