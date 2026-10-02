// Research only: actual game strokes, matched native checkpoints and observed dispatch.
import {runStroke} from '../whole_body_strike_probe.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {Fighter} from '../../../src/fighter.js';
import {THREE} from '../harness_m.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {loadTorsoTargetCandidates} from './torso_target_candidate.mjs';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const root=new URL('../../../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),plain=v=>({x:v.x,y:v.y,z:v.z});
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(out|variants|weapons|directions|endings)=(.+)$/.exec(x);if(!m)throw Error('Use --out/variants/weapons/directions/endings=value');return[m[1],m[2]];}));
const output=opts.out??'/tmp/strike-control.json',variants=(opts.variants??'baseline,clone,chest,gravityOffAll,gravityOffShoulder,gravityOffElbow,gravityOffWrist').split(',');
const weapons=(opts.weapons??'longsword,zweihander').split(','),directions=(opts.directions??'down,up,cross').split(','),endings=(opts.endings??'release').split(',');
if(variants.some(v=>!['baseline','clone','chest','chestYaw','gravityOffAll','gravityOffShoulder','gravityOffElbow','gravityOffWrist'].includes(v)))throw Error('Unknown variant');
try{await access(output);throw Error('Refusing to overwrite evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
async function manifest(){
 async function files(dir){let out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const paths=[...await files('src'),'tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/harness_m.mjs','tools/sim/experiments/strike_control_probe.mjs','tools/sim/experiments/torso_target_candidate.mjs','package-lock.json'];
 return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,hash(await readFile(new URL(p,root)))])));
}
function newPhase(){return {steps:0,bodyGravityWorkJ:0,swordGravityWorkJ:0,explicitWorkApproxJ:0,byPath:{},nonStandSteps:0,maxJointGapM:0,supportPointSamples:0,supportPointSpeedSumMps:0,maxSupportPointSpeedMps:0,maxSwordKJ:0,maxBodyKJ:0};}
function intervention(variant,modules){
 const undo=[],record={variant,driveCalls:0,gravityCalls:0,removedGravityCalls:0,removedGravityByPath:{},phase:{stroke:newPhase(),after_input:newPhase()},frames:[],initialChest:null,calibration:null};
 let frameControl=null;
 return {record,activate({G,f,ledger}){
  record.initialChest={...f.bodies.chest.rotation()};
  if(variant==='chest'||variant==='chestYaw'){record.calibration=modules.captureCalibration(f,{rotation:variant==='chestYaw'?'yaw':'full'});undo.push(()=>modules.clearCalibration(f));}
  const drive=(variant==='chest'||variant==='chestYaw')?modules.candidate:variant==='clone'?modules.clone:Fighter.prototype.driveSword;
  undo.push(ledger.replaceObservedMethod(f,'driveSword',function(...args){
   record.driveCalls++;
   const chest=Q(this.bodies.chest.rotation()),c=V(this.bodies.chest.translation());
   const result=drive.apply(this,args);
   frameControl={chestRotation:{...this.bodies.chest.rotation()},chestOmega:plain(this.bodies.chest.angvel()),
    handTarget:plain(this.handTarget),handTargetInActualChest:plain(this.handTarget.clone().sub(c).applyQuaternion(chest.clone().invert())),
    aimTarget:plain(this.aimDirW),armTarget:this.jointByName.uarmS.target.toArray()};
   if(variant==='chest'||variant==='chestYaw')record.controller=modules.calibrationInfo(this);
   return result;
  }));
  if(variant.startsWith('gravityOff'))undo.push(ledger.replaceObservedMethod(f,'gravityTorque',function(bodies,pivot,localX,out){
   const result=Fighter.prototype.gravityTorque.call(this,bodies,pivot,localX,out);record.gravityCalls++;
   const path=pivot===this.bodies.farmS&&localX===.13?'Wrist':pivot===this.bodies.uarmS&&localX===-.15?'Shoulder':pivot===this.bodies.uarmS&&localX===.15?'Elbow':'Other';
   if(variant==='gravityOffAll'||variant==='gravityOff'+path){record.removedGravityCalls++;record.removedGravityByPath[path]=(record.removedGravityByPath[path]??0)+1;result.multiplyScalar(0);}
   return result;
  }));
 },afterStep({G,f,ledger,sample:s}){
  const phase=record.phase[s.phase];phase.steps++;phase.nonStandSteps+=+(f.state!=='stand');
  const gaps=f.joints.map(j=>V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation())).distanceTo(V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()))));
  const gap=Math.max(...gaps);phase.maxJointGapM=Math.max(phase.maxJointGapM,gap);
  const contacts=collectSupportContacts(f);let slipMax=0,slipCount=0,slipSum=0;
  for(const g of Object.values(contacts.groups))for(const c of g.contacts)if(c.hasSupport&&c.engineTouching&&c.freshTouching)for(const p of c.solverPoints)if(p.withinSlop&&p.distanceM<=0){const v=Math.hypot(p.relativeVelocity.x,p.relativeVelocity.z);slipCount++;slipSum+=v;slipMax=Math.max(slipMax,v);}
  phase.supportPointSamples+=slipCount;phase.supportPointSpeedSumMps+=slipSum;phase.maxSupportPointSpeedMps=Math.max(phase.maxSupportPointSpeedMps,slipMax);
  const q=ledger.latest.physics[0],p=ledger.latest.postGame.total;phase.bodyGravityWorkJ+=q.balance.gravityWorkApproxJ;phase.explicitWorkApproxJ+=q.balance.forceWorkApproxJ;
  const swPre=q.pre.bodies.find(b=>b.label==='0:sword'),swPost=q.post.bodies.find(b=>b.label==='0:sword');
  // Read the body's actual potential difference; constant sword mass in these strokes.
  const swordGravityWorkJ=swPre&&swPost?swPre.V-swPost.V:null;
  if(swordGravityWorkJ!==null)phase.swordGravityWorkJ+=swordGravityWorkJ;
  const work={};
  for(const [path,b] of Object.entries(q.balance.byPath)){
   const dest=phase.byPath[path]??={signedWorkApproxJ:0,positiveWorkApproxJ:0,negativeWorkApproxJ:0,bodyWork:{}};
   dest.signedWorkApproxJ+=b.workApproxJ;dest.positiveWorkApproxJ+=Math.max(0,b.workApproxJ);dest.negativeWorkApproxJ+=Math.min(0,b.workApproxJ);
   for(const [label,row] of Object.entries(b.bodies)){dest.bodyWork[label]=(dest.bodyWork[label]??0)+row.workApproxJ;}
   work[path]=b.workApproxJ;
  }
  const swordK=s.swordEnergy.translationJ+s.swordEnergy.rotationJ;
  phase.maxSwordKJ=Math.max(phase.maxSwordKJ,swordK);phase.maxBodyKJ=Math.max(phase.maxBodyKJ,p.K);
  record.frames.push({timeS:s.timeS,phase:s.phase,state:f.state,control:frameControl,tipSpeedMps:s.tipSpeedMps,swordKJ:swordK,bodyKJ:p.K,bodyPJ:p.P,bodyL:p.L,bodyVJ:p.V,bodyMassKg:p.mass,swordGravityWorkJ,maxJointGapM:gap,slipMaxMps:slipMax,slipSamples:slipCount,
   chestDeltaRad:Q(record.initialChest).angleTo(Q(f.bodies.chest.rotation())),chestOmega:plain(f.bodies.chest.angvel()),pelvisOmega:plain(f.bodies.pelvis.angvel()),explicitWorkApproxJ:q.balance.forceWorkApproxJ,explicitWorkByPath:work,nativeResidualImpulseNs:q.balance.residualP});
 },restore(){for(const f of undo.reverse())f();}};
}
function summarize(row){
 const r=row.controlExperiment,s=row.summary;
 return {weapon:row.weapon,direction:row.direction,ending:row.ending,variant:r.variant,trace:row.traceSha256,startNativeSha256:row.startNativeSha256,
  peakTipMps:row.peak.tipSpeedMps,strokePeakTipMps:row.strokePeak.tipSpeedMps,swordKAtPeakJ:row.peak.swordEnergy.translationJ+row.peak.swordEnergy.rotationJ,
  ...s,driveCalls:r.driveCalls,removedGravityCalls:r.removedGravityCalls,removedGravityByPath:r.removedGravityByPath,
  calibration:r.calibration,controller:r.controller??null,maxChestDeltaRad:Math.max(...r.frames.map(x=>x.chestDeltaRad)),phases:r.phase};
}
const before=await manifest(),started=performance.now(),rows=[],guards=[];
let error=null,modules;
try{
 modules=await loadTorsoTargetCandidates();
 for(const weapon of weapons)for(const direction of directions)for(const ending of endings){
  // Observer-off current controller uses the same runStroke and requested input.
  const plain=runStroke({weapon,direction,ending,reaction:'paired'});
  let baseline=null;
  for(const variant of [...new Set(['baseline',...variants])]){
   const experiment=intervention(variant,modules),row=runStroke({weapon,direction,ending,reaction:'paired',ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],sampleEvery:8,maxSamples:0}),intervention:experiment});
   row.controlExperiment=experiment.record;rows.push(row);
   const g={weapon,direction,ending,variant,nativeStartExact:row.startNativeSha256===plain.startNativeSha256,controlStartExact:row.startSha256===plain.startSha256,inputExact:row.inputSha256===plain.inputSha256,driveExecuted:experiment.record.driveCalls>0};
   if(variant==='baseline'){baseline=row;g.observerTraceExact=row.traceSha256===plain.traceSha256;}
   if(variant==='clone')g.cloneTraceExact=row.traceSha256===baseline.traceSha256;
   if(variant==='chest'||variant==='chestYaw')g.transportedExecuted=experiment.record.controller?.transportedCalls>0;
   if(variant.startsWith('gravityOff'))g.gravityRemovalExecuted=experiment.record.removedGravityCalls>0;
   guards.push(g);if(Object.values(g).some(x=>x===false))throw Error('Evidence gate failed: '+JSON.stringify(g));
   console.log(JSON.stringify({progress:true,weapon,direction,variant,trace:row.traceSha256,peakTipMps:row.peak.tipSpeedMps,guards:g}));
  }
 }
}catch(e){error=e.stack;}finally{await modules?.cleanup();}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
const result={probe:'strike_control',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceSha256:before,sourceSha256After:after,sourceStable,wallSeconds:(performance.now()-started)/1000,
 protocol:{input:'Actual handOffset strokes and G.step; fixed scripted request, reactive skill input/filter remain active.',matchedPreparation:'legacy grip preparation3s, then paired for every measured variant; current public support legacy .3, world gravity unchanged.',scope:'Unopposed strikes, not collisions or human naturalness. Gravity-off modes remove only specified gravityTorque output. Native joint work, total contact work and foot mass flux remain unresolved. Chest candidate transports checkpoint-relative rotation; not production input mapping.'},candidateSourceHashes:modules?.sourceHashes,guards,error,summary:rows.map(summarize),rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
await writeFile(output.replace(/\.json$/,'.summary.json'),JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out:output,rows:rows.length,wallSeconds:result.wallSeconds,sourceStable,error}));
if(error||!sourceStable)process.exitCode=1;
