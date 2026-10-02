// Isolated actual-game comparison using a calibrated research engine build.
// Public/package dependencies are never changed. Only the harness RAPIER import
// is redirected; game classes/configuration and step loop remain the real source.
import {runStroke as npmStroke} from '../whole_body_strike_probe.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {installNativeElbow} from './native_elbow_candidate.mjs';
import * as THREE from 'three';
import {readFile,readdir,writeFile,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(module|calibration|out|weapons|directions|conditions)=(.+)$/.exec(s);if(!m)throw Error('Use named probe options');return[m[1],m[2]];}));
if(!args.module||!args.calibration)throw Error('Supply --module and independently passed --calibration');
const engine=pathToFileURL(resolve(args.module)),out=args.out??'/tmp/native-elbow.json';
try{await access(out);throw Error('Refusing to overwrite evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
const calibrationBytes=await readFile(args.calibration),calibration=JSON.parse(calibrationBytes),engineHash=sha(await readFile(engine));
if(!calibration.pass||!calibration.sourceStable||!calibration.moduleSourceStable||calibration.moduleSourceBefore!==engineHash)
  throw Error('Engine must match independently passed native API calibration');
const weapons=(args.weapons??'sabre,zweihander').split(','),directions=(args.directions??'down,up').split(','),conditions=(args.conditions??'healthy,armWeak').split(',');
if(conditions.some(c=>!['healthy','armWeak'].includes(c)))throw Error('Unknown condition');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
async function manifest(){
 async function files(dir){const paths=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())paths.push(...await files(p));else if(e.name.endsWith('.js'))paths.push(p);}return paths;}
 const paths=[...await files('src'),'package-lock.json','tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/native_elbow_candidate.mjs','tools/sim/experiments/native_elbow_probe.mjs','tools/sim/experiments/elbow_actuator_candidate.mjs'];
 return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function experiment(mode,condition){let installed;const record={mode,condition,configuredNative:null,configuredBody:null,frames:[]};
 return {record,activate({G,f,ledger}) {
  if(condition==='armWeak')f.limbs.armS=.15;
  record.configuredNative=sha(G.world.takeSnapshot());
  record.configuredBody=sha(JSON.stringify({limbs:f.limbs,body:Object.values(f.bodies).concat(f.sword).map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel(),b.mass(),b.principalInertia()]),joints:f.joints.map(j=>[j.name,j.target.toArray(),j.prevRV?.toArray()])}));
  if(mode==='observe'||mode==='nativeCap')installed=installNativeElbow({f,ledger,mode:mode==='observe'?'observe':'capped'});
  record.installNativeUnchanged=sha(G.world.takeSnapshot())===record.configuredNative;
 },afterStep({f,ledger,sample}) {
  const motor=installed?.afterStep();
  if(mode==='nativeCap'){
   const extras=ledger.latest.operations.filter(x=>x.owner===f.index&&x.path.endsWith('.elbowGravity')&&x.method==='addTorque');
   if(extras.length)throw Error('Gravity FF was applied outside the capped motor');
  }
  const gaps=f.joints.map(j=>V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation())).distanceTo(V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()))));
  record.frames.push({timeS:sample.timeS,phase:sample.phase,state:f.state,maxJointGapM:Math.max(...gaps),motor});
 },restore(){record.actuator=installed?.summary??null;installed?.restore();}};
}
function summarize(r){return {mode:r.native.mode,condition:r.native.condition,weapon:r.weapon,direction:r.direction,ending:r.ending,
 trace:r.traceSha256,input:r.inputSha256,start:r.startSha256,startNative:r.startNativeSha256,
 configuredNative:r.native.configuredNative,configuredBody:r.native.configuredBody,installNativeUnchanged:r.native.installNativeUnchanged,
 strokePeakTipMps:r.strokePeak.tipSpeedMps,wholePeakTipMps:r.peak.tipSpeedMps,...r.summary,
 nonStandSteps:r.native.frames.filter(f=>f.state!=='stand').length,maxJointGapM:Math.max(...r.native.frames.map(f=>f.maxJointGapM)),actuator:r.native.actuator};}
const before=await manifest(),start=performance.now(),directory=await mkdtemp(join(tmpdir(),'halfsword-native-elbow-')),rows=[],guards=[];
let error=null,clones={};
try{
 const rewrite=(s,url,special={})=>s.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(special[p]??(p.startsWith('.')?new URL(p,url).href:import.meta.resolve(p))));
 const harnessURL=new URL('tools/sim/harness_m.mjs',root),harness=await readFile(harnessURL,'utf8');
 const marker="../../node_modules/@dimforge/rapier3d-compat/rapier.mjs";
 if(harness.split(marker).length!==2)throw Error('Expected exactly one engine import');
 const harnessPath=join(directory,'harness.mjs'),harnessText=rewrite(harness,harnessURL,{[marker]:engine.href});
 await writeFile(harnessPath,harnessText);clones.harness=sha(harnessText);
 const strokeURL=new URL('tools/sim/whole_body_strike_probe.mjs',root),stroke=await readFile(strokeURL,'utf8');
 if(stroke.split('./harness_m.mjs').length!==2)throw Error('Expected exactly one stroke harness import');
 const strokePath=join(directory,'stroke.mjs'),strokeText=rewrite(stroke,strokeURL,{'./harness_m.mjs':pathToFileURL(harnessPath).href});
 await writeFile(strokePath,strokeText);clones.stroke=sha(strokeText);
 const {runStroke}=await import(pathToFileURL(strokePath).href);
 for(const condition of conditions)for(const weapon of weapons)for(const direction of directions){
  let reference,npm;
  for(const mode of ['npm','baseline','observe','nativeCap']){
   const exp=experiment(mode,condition),r=(mode==='npm'?npmStroke:runStroke)({weapon,direction,ending:'target_hold',reaction:'paired',intervention:exp,
    ledgerFactory:['observe','nativeCap'].includes(mode)?G=>installForceLedger(G,{fighters:[G.player],maxSamples:0}):null});
   r.native=exp.record;rows.push(r);const s=summarize(r);
   if(mode==='npm')npm=r;
   if(mode==='baseline')reference=r;
   const g={condition,weapon,direction,mode,installNativeUnchanged:s.installNativeUnchanged};
   if(mode==='baseline')g.npmMotionExact=r.traceSha256===npm.traceSha256;
   if(mode==='observe'||mode==='nativeCap'){
    g.sameNativeStart=r.native.configuredNative===reference.native.configuredNative;
    g.sameBodyControl=r.native.configuredBody===reference.native.configuredBody;
    g.sameRequestedInput=r.inputSha256===reference.inputSha256;
    g.actualNativeDispatch=exp.record.actuator.nativeCalls>0&&exp.record.actuator.measurements===exp.record.actuator.nativeCalls;
    if(mode==='observe')g.observerTraceExact=r.traceSha256===reference.traceSha256;
    if(mode==='nativeCap')g.noDuplicateFF=exp.record.actuator.explicitGravityCalls===exp.record.actuator.nativeCalls;
   }
   guards.push(g);
   // Cross-build npm parity is reported, not assumed as a same-engine intervention guard.
   if(Object.entries(g).some(([k,v])=>k!=='npmMotionExact'&&v===false))throw Error('Native actual-game guard failed '+JSON.stringify(g));
   console.log(JSON.stringify({mode,condition,weapon,direction,...s,guards:g}));
  }
 }
}catch(e){error=e.stack;}
finally{await rm(directory,{recursive:true,force:true});}
const after=await manifest(),engineAfter=sha(await readFile(engine)),sourceStable=JSON.stringify(before)===JSON.stringify(after)&&engineHash===engineAfter;
const result={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),engine:{path:engine.href,sha256:engineHash,sha256After:engineAfter,calibration:args.calibration,calibrationSHA256:sha(calibrationBytes)},sourceBefore:before,sourceAfter:after,sourceStable,clones,
 wallSeconds:(performance.now()-start)/1000,scope:{protocol:'Actual game strokes: sabre/zweihander, down/up, target_hold, prepare3s/stroke.55s/after1.2s, seed7. armWeak changes only armS=.15 at checkpoint.',intervention:'Same native engine/captured original hinge motor request. Preserve hinge/history; move current gravity FF into ForceBased target bias; cap that native motor. No package/runtime game change.',readout:'Last native solver substep impulse only, with calibrated substep cap ratio. No fullstep native work or average-torque claim. Other motors and passive limits separate.',portability:'Tag source and lock-pinned rebuild has metadata/template differences. Cross-build npm motion equality is measured separately, not presumed.'},guards,error,pass:!error&&sourceStable,summary:rows.map(summarize),rows};
await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});await writeFile(out.replace(/\.json$/,'.summary.json'),JSON.stringify({...result,rows:undefined},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,pass:result.pass,error,sourceStable,rows:rows.length,wallSeconds:result.wallSeconds}));if(!result.pass)process.exitCode=1;
