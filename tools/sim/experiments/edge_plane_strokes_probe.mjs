// Reuse the complete from-spawn preparation, input and native/control hashing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const originalURL=new URL('./skill_from_start_probe.mjs',import.meta.url);
const opts=Object.fromEntries(process.argv.slice(2).map(v=>{const m=v.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return [m[1],m[2]];}));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const original=fs.readFileSync(originalURL,'utf8'),marker='const rows=[],observerChecks=[];';
if(original.split(marker).length!==2)throw Error('Main marker changed');
let source=original.split(marker)[0];
function replace(a,b){if(source.split(a).length!==2)throw Error('Unique marker: '+a);source=source.replace(a,b);}
replace("const root=fileURLToPath(new URL('../../../',import.meta.url));",'const root='+JSON.stringify(root)+';');
replace("const rawPath=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-from-start-round3.json';",'const rawPath='+JSON.stringify(opts.out??'/tmp/edge-plane-strokes.json')+';');
replace("const modes={weak:{level:.4,autoGuard:true},off:{level:0,autoGuard:false}};", "const modes={legacyOff:{level:0,autoGuard:false},planeOff:{level:0,autoGuard:false},legacyWeak:{level:.4,autoGuard:true},planeWeak:{level:.4,autoGuard:true}};");
replace("f.armTorqueModel='sharedCap'", "f.armTorqueModel='legacy';if(mode.startsWith('plane'))f.edgeTorqueModel='planePotential'");
replace("G.combat.cutReactionModel='budgeted'", "G.combat.cutReactionModel='legacy'");
source=source.replace(/^(import .*? from )(['"])([^'"]+)\2/gm,(_,prefix,q,p)=>prefix+JSON.stringify(p.startsWith('.')?new URL(p,originalURL).href:import.meta.resolve(p)));
source+='\nexport {run};';
const files=[...fs.readdirSync(root+'src').filter(n=>n.endsWith('.js')).map(n=>'src/'+n),
  'tools/sim/harness_m.mjs','tools/sim/experiments/skill_from_start_probe.mjs','tools/sim/experiments/edge_plane_strokes_probe.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','package-lock.json'];
const manifest=()=>Object.fromEntries(files.sort().map(f=>[f,sha(fs.readFileSync(root+f))]));
function head(){const h=fs.readFileSync(root+'.git/HEAD','utf8').trim();return h.startsWith('ref: ')?fs.readFileSync(root+'.git/'+h.slice(5),'utf8').trim():h;}
const before=manifest(),commit=head(),begin=performance.now(),rows=[],checks=[],observers=[];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'edge-plane-strokes-'));
try{
  const p=path.join(dir,'harness.mjs');fs.writeFileSync(p,source);const {run}=await import(pathToFileURL(p).href);
  for(const weapon of ['sabre','zweihander'])for(const motion of ['down','up','cross'])for(const ending of ['release','reinput'])for(const correction of ['Off','Weak']){
    const old=run(weapon,motion,ending,'legacy'+correction,true),candidate=run(weapon,motion,ending,'plane'+correction,true);
    rows.push(old,candidate);
    const check={weapon,motion,ending,correction,initialNativeExact:old.firstStepContract.nativeBeforeFirstStep===candidate.firstStepContract.nativeBeforeFirstStep,
      externalInputExact:old.inputSha256===candidate.inputSha256,finite:[old,candidate].every(r=>r.summary.finite),noContacts:[old,candidate].every(r=>r.summary.maxCutContacts===0)};
    checks.push(check);console.log(JSON.stringify(check));
  }
  for(const correction of ['Off','Weak']){
    const a=rows.find(r=>r.weapon==='sabre'&&r.motion==='cross'&&r.ending==='reinput'&&r.mode==='plane'+correction),b=run('sabre','cross','reinput','plane'+correction,false);
    observers.push({correction,initialNativeExact:a.firstStepContract.nativeBeforeFirstStep===b.firstStepContract.nativeBeforeFirstStep,
      preparedNativeExact:a.prepared.native===b.prepared.native,preparedControllerExact:a.prepared.controller===b.prepared.controller,prepareTraceExact:a.prepared.trace===b.prepared.trace,
      nativeExact:a.nativeTraceSha256===b.nativeTraceSha256,controllerExact:a.traceSha256===b.traceSha256,externalInputExact:a.inputSha256===b.inputSha256});
  }
  const after=manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after)&&head()===commit;
  const executionPass=sourceStable&&[...checks,...observers].every(c=>Object.values(c).every(v=>v!==false));
  const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit:commit,sourceBefore:before,sourceAfter:after,sourceStable,command:process.argv,
    generatedHelperSHA256:sha(source),originalHelperSHA256:sha(original),wallSeconds:(performance.now()-begin)/1000,executionPass,checks,observers,rows,
    contract:'50 actual runs: 2weapons*3motions*2endings(release/reinput)*2correction levels(0/.4)*2torque laws +2unobserved candidate repeats. Original3s preparation plus2.05s stroke/pause/reinput/end path, with potential enabled before first step. Both arm/cut legacy, paired grip, parked foe. Same spawn native and external input; prepared states can differ. No contact or mobile acceptance. Full native/control hashing before/after preparation; observer comparison includes preparation. No history or previous-target variables are added by the potential.'};
  fs.writeFileSync(opts.out??'/tmp/edge-plane-strokes.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({executionPass,rows:rows.length,observers,wallSeconds:report.wallSeconds}));if(!executionPass)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
