// Active-control deletion diagnosis; never imported by the game or treated as a fix.
import {readFile,writeFile,mkdtemp,mkdir,copyFile,symlink,rm,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const o=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(source-ref|source-commit|seed|seconds|switch|stride|out|expected-baseline-trace|archive-manifest)=(.+)$/.exec(x);if(!m)throw new Error('Use --source-ref/--seed/--seconds/--switch/--stride/--out=value');return[m[1],m[2]];}));
const core=['src/fighter.js','src/config.js','src/gait.js','src/support_transfer.js','src/support_contacts.js','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','package.json','package-lock.json'];
async function archive(){
 const commit=execFileSync('git',['rev-parse','--verify',o['source-ref']+'^{commit}'],{cwd:ROOT,encoding:'utf8'}).trim();
 const directory=await mkdtemp(join(tmpdir(),'halfsword-heavy-'));
 try{
  const data=execFileSync('git',['archive',commit,'--','src','tools','package.json','package-lock.json'],{cwd:ROOT,maxBuffer:64*1024*1024});
  execFileSync('tar',['-xf','-','-C',directory],{input:data});
  const manifest={sourceCommit:commit,archiveSha256:sha(data),coreSha256:{}};
  for(const file of core){const expected=sha(execFileSync('git',['show',commit+':'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));const actual=sha(await readFile(join(directory,file)));if(actual!==expected)throw new Error('Archive source hash mismatch: '+file);manifest.coreSha256[file]=actual;}
  manifest.dependencyLockMatchesCurrent=sha(await readFile(join(ROOT,'package-lock.json')))===manifest.coreSha256['package-lock.json'];if(!manifest.dependencyLockMatchesCurrent)throw new Error('Archived package-lock differs from current dependencies; use an isolated npm ci instead of this shared node_modules mode.');
  await symlink(join(ROOT,'node_modules'),join(directory,'node_modules'),'dir');
  const dir=join(directory,'tools/sim/experiments');await mkdir(dir,{recursive:true});
  for(const file of ['heavy_down_launch_probe.mjs','heavy_down_delayed_ablation.mjs'])await copyFile(new URL(file,import.meta.url),join(dir,file));
  const manifestPath=join(directory,'archive-manifest.json');await writeFile(manifestPath,JSON.stringify(manifest));
  const args=process.argv.slice(2).filter(a=>!a.startsWith('--source-ref='));args.push('--source-commit='+commit,'--archive-manifest='+manifestPath);
  execFileSync(process.execPath,[join(dir,'heavy_down_delayed_ablation.mjs'),...args],{cwd:directory,stdio:'inherit'});
 }finally{await rm(directory,{recursive:true,force:true});}
}
async function main(){
 if(o['source-ref'])return archive();
 const {runSupportTransfer}=await import('./heavy_down_launch_probe.mjs');
 const seed=Number(o.seed??7),seconds=Number(o.seconds??25),switchS=Number(o.switch??2),stride=Number(o.stride??12);
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isFinite(seconds)||!Number.isFinite(switchS)||switchS<0||seconds<=switchS||!Number.isInteger(stride)||stride<1)throw new Error('Invalid seed/seconds/switch/stride');
 const paths=async dir=>{const out=[];for(const e of await readdir(join(ROOT,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await paths(p));else if(e.name.endsWith('.js'))out.push(p);}return out;};
 const files=[...await paths('src'),...core.filter(x=>!x.startsWith('src/')),'tools/sim/experiments/heavy_down_launch_probe.mjs','tools/sim/experiments/heavy_down_delayed_ablation.mjs'].sort();
 const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(join(ROOT,p)))])));
 const before=await manifest(),start=performance.now(),rows=[];
 for(const kind of ['oldaxial','noPair','noUpright','noPairNoUpright']){
  let active=false;
  const intervention={prepare({f,row}){
   row.ablation=kind;row.ablationAudit={suppressedAxialPointCalls:0,uprightZeroConfigurations:0};
   if(kind==='oldaxial')return;
   const original=f.driveBalance;
   f.driveBalance=function(...args){
    if(!active)return original.apply(this,args); // identical axial fall before switch
    const restore=[];
    if(kind==='noPair'||kind==='noPairNoUpright')for(const body of [f.bodies.pelvis,f.bodies.footF,f.bodies.footB]){const old=body.addForceAtPoint;body.addForceAtPoint=function(){row.ablationAudit.suppressedAxialPointCalls++;};restore.push(()=>{body.addForceAtPoint=old;});}
    try{return original.apply(this,args);}finally{for(const r of restore)r();if(kind==='noUpright'||kind==='noPairNoUpright')for(const axis of [3,4,5]){f.uprightJoint.rawSet.jointConfigureMotorPosition(f.uprightJoint.handle,axis,0,0,0);row.ablationAudit.uprightZeroConfigurations++;}}
   };
  },beforeStep({G,f,row,physicalControl,hash,vec,DT,iteration}){
   if(iteration!==Math.round(switchS/DT))return;
   const full={physicalControl:physicalControl(f),nativeJointAnchors:f.joints.map(j=>({name:j.name,anchor1:vec(j.joint.anchor1()),anchor2:vec(j.joint.anchor2())})),uprightJointAnchors:{anchor1:vec(f.uprightJoint.anchor1()),anchor2:vec(f.uprightJoint.anchor2())}};
   row.switchWitness={observationTimeS:iteration*DT,worldTimeS:G.t,state:f.state,stateTimeS:f.stateTime,sha256:hash(JSON.stringify(full)),pelvisHeightM:f.bodies.pelvis.translation().y,chestTiltDeg:f.tiltDeg(),full};active=true;
  }};
  rows.push(runSupportTransfer({scenario:'healthy_getup',model:'axial',seed,ledgerOn:true,sampleStride:stride,observationSeconds:seconds,intervention}));
 }
 const after=await manifest();let commit=o['source-commit'];if(!commit)try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}catch{commit='unlabelled';}
 const known=commit.startsWith('b6483ea')&&seed===7&&seconds===25;const expected=o['expected-baseline-trace']??(known?'dd37acfde6fee03dc3b15d762b2256c66c4158d41567950a43dc5f8d376c8df6':null);
 const result={probe:'heavy_down_delayed_ablation',acceptance:'not-assessed',sourceCommit:commit,archiveVerification:o['archive-manifest']?JSON.parse(await readFile(o['archive-manifest'],'utf8')):null,sourceSha256:before,sourceSha256After:after,sourceStableDuringRun:JSON.stringify(before)===JSON.stringify(after),baselineExactTrace:expected?rows[0].traceSha256===expected:null,sameInitialState:rows.every(r=>r.startSha256===rows[0].startSha256),sameInput:rows.every(r=>r.inputSha256===rows[0].inputSha256),sameSwitchState:rows.every(r=>r.switchWitness?.sha256&&r.switchWitness.sha256===rows[0].switchWitness?.sha256),wallSeconds:(performance.now()-start)/1000,protocol:{seed,seconds,switchS,prepareSeconds:3,timestepS:1/120,assist:.1,catch:'on',catchScale:1,grip:'paired',scope:'Only player driveBalance axial pelvis/feet addForceAtPoint; native upright axes3/4/5 k=d=0 afterwards; before-switch passthrough, no other PD/pose/input changes.',caution:'Diagnostic deletion, not a cure. balanceProbe axial appliedUpN stays computed when calls are suppressed; ledger alone observes actually delivered forces. Fixed switch2s may precede lowest prone pose; inspect witness. Finite/observed never means accepted recovery. Native motor/contact work remains unmetered.'},rows};
 if(o.out)await writeFile(o.out,JSON.stringify(result,null,2)+'\n');else console.log(JSON.stringify(result));
 console.log(JSON.stringify({out:o.out??null,acceptance:result.acceptance,baselineExactTrace:result.baselineExactTrace,sameSwitchState:result.sameSwitchState,sourceStableDuringRun:result.sourceStableDuringRun,rows:rows.map(r=>({ablation:r.ablation,status:r.status,finite:r.finite,switchPelvisHeightM:r.switchWitness?.pelvisHeightM,switchTiltDeg:r.switchWitness?.chestTiltDeg,peakCOMVyMps:r.launchObservation?.peaks.COMVy.COMVelocityMps.y,finalPhysicallyUpright:r.final?.physicallyUprightGameGeometry,error:r.error??null}))}));
 if(!result.sourceStableDuringRun||!result.sameInitialState||!result.sameInput||!result.sameSwitchState||result.baselineExactTrace===false||rows.some(r=>r.status==='error'||r.finite!==true))process.exitCode=1;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
