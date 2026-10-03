// Reuses the previous actual no-contact/no-tap input and complete native simulation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadEdgeTransition} from './edge_transition_candidate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),originalURL=new URL('./skill_manual_combat_probe.mjs',import.meta.url);
const opts=Object.fromEntries(process.argv.slice(2).map(v=>{const m=v.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return [m[1],m[2]];}));
const startS=Number(opts.start??3.6),duration=Number(opts.duration??6),weapons=(opts.weapons??'zweihander').split(','),modes=(opts.modes??'legacy,edge,observe,freezePlane,noPosition,noDamping').split(',');
if(!Number.isFinite(startS)||startS<0||!Number.isFinite(duration)||duration<=startS)throw Error('Invalid time');
if(modes.some(m=>!['legacy','edge','observe','freezePlane','noPosition','noDamping','c1Aim','motionMemory','runtimeC1'].includes(m)))throw Error('Invalid mode');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const original=fs.readFileSync(originalURL,'utf8'),split='const narrowDiagnosis=diagnose&&!roundWindow;';
if(original.split(split).length!==2)throw Error('Main marker');let source=original.split(split)[0];
function replace(a,b){if(source.split(a).length!==2)throw Error('Unique marker: '+a);source=source.replace(a,b);}
replace("const root=fileURLToPath(new URL('../../../',import.meta.url)),rawPath=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-manual-combat-round1.json';",'const root='+JSON.stringify(root)+',rawPath='+JSON.stringify(opts.out??'/tmp/edge-transition.json')+';');
replace("new URL('./skill_from_start_probe.mjs',import.meta.url)",'new URL('+JSON.stringify(new URL('./skill_from_start_probe.mjs',import.meta.url).href)+')');
replace("const roundWindow=process.argv.includes('--round-window'),diagnose=process.argv.includes('--diagnose')||roundWindow;",'const roundWindow=true,diagnose=true;');
replace("const modes={weak:{level:.4,autoGuard:true},off:{level:0,autoGuard:false}}",'const modes='+JSON.stringify(Object.fromEntries(modes.map(m=>[m,{level:0,autoGuard:false}]))));
replace("gap:1.85,skill:modes[mode].level,difficulty:'normal'});const f=G.player;","gap:6,skill:modes[mode].level,difficulty:'normal'});G.ai.update=()=>{};const f=G.player;");
replace("f.skill.autoGuard=modes[mode].autoGuard;f.armTorqueModel='legacy'","f.skill.autoGuard=modes[mode].autoGuard;if(mode!=='legacy')f.edgeIntentModel=mode==='runtimeC1'?'commandedPlaneC1':'commandedPlane';hooks?.install(G,f,mode);f.armTorqueModel='legacy'");
replace("f.move.set(0,time<2?.25:((time%4.4)<.6?.08:0));",'f.move.set(0,0);');
replace('[2.2,6.6,11,15.4].findIndex','[].findIndex');
replace('seconds:18,rawAimMeanErrorRad','seconds:'+duration+',rawAimMeanErrorRad');
replace('function combatRun(weapon,seed,mode,observed=true){','function combatRun(weapon,seed,mode,observed=true,hooks=null){\n  const prefix=crypto.createHash("sha256");');
replace('if(!observed){if(lifecycle.paused)break;continue;}','if(G.t<='+startS+'+1e-12)prefix.update(JSON.stringify({native:n,control:control(G)}));\n      if(!observed){if(lifecycle.paused)break;continue;}');
replace('frames.push({timeS:G.t,realTimeS:','frames.push({transition:hooks?.read(f)??null,timeS:G.t,realTimeS:');
replace('return {weapon,seed,mode,observed,first,lifecycle,summary:','return {prefixSHA256:prefix.digest("hex"),weapon,seed,mode,observed,first,lifecycle,summary:');
source=source.replace(/^(import .*? from )(['"])([^'"]+)\2/gm,(_,prefix,q,p)=>prefix+JSON.stringify(p.startsWith('.')?new URL(p,originalURL).href:import.meta.resolve(p)));
source+='\nexport {combatRun,control};\nexport const cleanup=()=>fs.rmSync(temporary,{recursive:true,force:true});\n';
const files=[...fs.readdirSync(root+'src').filter(n=>n.endsWith('.js')).map(n=>'src/'+n),'tools/sim/harness_m.mjs','tools/sim/experiments/skill_from_start_probe.mjs','tools/sim/experiments/skill_manual_combat_probe.mjs','tools/sim/experiments/edge_transition_candidate.mjs','tools/sim/experiments/edge_transition_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','package-lock.json'];
const manifest=()=>Object.fromEntries(files.sort().map(f=>[f,sha(fs.readFileSync(root+f))]));
function readHead(){const s=fs.readFileSync(root+'.git/HEAD','utf8').trim();if(!s.startsWith('ref: '))return s;const ref=s.slice(5),p=root+'.git/'+ref;return fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(x=>x.endsWith(' '+ref))?.split(' ')[0];}
const before=manifest(),head=readHead(),begin=performance.now(),rows=[],checks=[];
if(!/^[a-f0-9]{40}$/.test(head??''))throw Error('Cannot read HEAD');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'edge-transition-probe-')),loaded=await loadEdgeTransition();let harness;
try{
  const p=path.join(dir,'harness.mjs');fs.writeFileSync(p,source);harness=await import(pathToFileURL(p).href);
  for(const weapon of weapons){
    const group=[];
    for(const mode of modes){
      const hooks={install(G,f,m){if(['legacy','edge','runtimeC1'].includes(m))return;loaded.module.setTransition(f,{mode:m,startS,now:()=>G.t});f.driveSword=loaded.module.Fighter.prototype.driveSword;},read:f=>loaded.module.readTransition(f)};
      const r=harness.combatRun(weapon,7,mode,true,hooks);group.push(r);rows.push(r);
      console.log(JSON.stringify({weapon,mode,prefix:r.prefixSHA256,summary:r.summary}));
    }
    const base=group.find(r=>r.mode==='edge'),observe=group.find(r=>r.mode==='observe');
    if(!base||!observe)throw Error('edge and observe required');
    const c={weapon,observerNativeExact:base.nativeTraceSha256===observe.nativeTraceSha256,observerControllerExact:base.controllerTraceSha256===observe.controllerTraceSha256,prefixExact:group.filter(r=>!['legacy','runtimeC1'].includes(r.mode)).every(r=>r.prefixSHA256===base.prefixSHA256),initialNativeExact:group.every(r=>r.first.native===base.first.native),externalInputExact:group.every(r=>r.externalRequestedInputSha256===base.externalRequestedInputSha256),noContacts:group.every(r=>r.summary.contactWounds===0&&r.summary.clashes===0),noTap:group.every(r=>r.tapRequests.length===0),finite:group.every(r=>r.finite)};
    const runtime=group.find(r=>r.mode==='runtimeC1'),candidate=group.find(r=>r.mode==='c1Aim');
    if(runtime){if(!candidate||startS!==0)throw Error('runtimeC1 requires c1Aim from start0');c.runtimeNativeExact=runtime.nativeTraceSha256===candidate.nativeTraceSha256;const withoutDiag=r=>r.frames.map(({transition,...rest})=>rest);c.runtimeFramesExact=JSON.stringify(withoutDiag(runtime))===JSON.stringify(withoutDiag(candidate));}
    checks.push(c);
  }
  const after=manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after),executionPass=sourceStable&&checks.every(c=>Object.values(c).every(v=>v!==false));
  const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit:head,sourceBefore:before,sourceAfter:after,sourceStable,command:process.argv,startS,durationS:duration,generatedHarnessSHA256:sha(source),generatedFighterSHA256:loaded.generatedSHA256,wallSeconds:(performance.now()-begin)/1000,executionPass,checks,rows,
    contract:'Identical original input script as previous isolated no-tap: gap6m, enemy AI disabled, manual movement0, skill0/autoGuardfalse, paired grip, legacy arms/cut. Intervention only from startS, same complete native/controller prefix within commandedPlane modes. Diagnostic mutations only desired plane or twist terms, not poses/velocities. Explicit pre-step torque dot angular velocity dt is approximate work; free-body torque/I is not actual coupled solver response. No user/mobile/contact acceptance.'};
  fs.writeFileSync(opts.out??'/tmp/edge-transition.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({executionPass,checks,wallSeconds:report.wallSeconds,rows:rows.length}));if(!executionPass)process.exitCode=1;
}finally{harness?.cleanup();await loaded.cleanup();fs.rmSync(dir,{recursive:true,force:true});}
