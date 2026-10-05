// One current-game longsword contact pair. All runtime edits live in a frozen
// artifact; candidate is selected from creation for the player only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|prepareOnly|activeAI|scripted)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));assert(!opts.prepareOnly||opts.prepareOnly==='true');
assert(!opts.activeAI||opts.activeAI==='true');
assert(!opts.scripted||opts.scripted==='true');assert(!(opts.scripted&&opts.activeAI));
const root=fileURLToPath(new URL('../../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const scan=(d,p='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(d,e.name),p+e.name+'/'):[p+e.name]);
const src=scan(path.join(root,'src')).filter(n=>n.endsWith('.js')).map(n=>'src/'+n);
const files=[...src,'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/p4_command_candidate.mjs','package.json','package-lock.json'];
const dependencyNames=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const originalManifest=Object.fromEntries([...files,...dependencyNames].map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const directory=opts.out+'-runtime';assert(!fs.existsSync(directory));fs.mkdirSync(directory,{recursive:true});
for(const name of files){fs.mkdirSync(path.dirname(path.join(directory,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(directory,name));}
fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),'dir');
let fighter=fs.readFileSync(path.join(directory,'src/fighter.js'),'utf8');
const markers=[];
function inject(a,b){assert.equal(fighter.split(a).length,2,'Unique fighter anchor');fighter=fighter.replace(a,b);markers.push(a);}
fighter="import {observeCommandPoint} from '../tools/sim/experiments/p4_command_candidate.mjs';\n"+fighter;
inject('    const ev = edgeDir.length();','    const p4Command = observeCommandPoint(this, aim, blade), p4Rest = flatTarget.clone(), p4Physical = edgeDir.clone();\n    const ev = edgeDir.length();');
inject('      const mf = edgeDir.crossVectors(blade, edgeDir).normalize();',"      const mf = this.edgePlaneModel === 'commandDirection' && p4Command.eligible ? new THREE.Vector3().crossVectors(blade, p4Command.transverse).normalize() : edgeDir.crossVectors(blade, edgeDir).normalize();");
inject('    // Isolated research mode; ordinary games keep their existing edge alignment.',`    const p4Legacy = p4Rest.clone();
    if(moving>0){const n=new THREE.Vector3().crossVectors(blade,p4Physical).normalize();if(n.dot(flat)<0)n.negate();p4Legacy.lerp(n,moving);if(p4Legacy.lengthSq()<1e-4)p4Legacy.copy(n);p4Legacy.normalize();}
    this.p4Read?.({command:p4Command,blade,flat,target:flatTarget,legacy:p4Legacy,moving});
    // Isolated research mode; ordinary games keep their existing edge alignment.`);
fs.writeFileSync(path.join(directory,'src/fighter.js'),fighter);
const original=fs.readFileSync(path.join(root,'tools/sim/experiments/p5_centerline_probe.mjs'),'utf8');let runner=original;
function replace(a,b){assert.equal(runner.split(a).length,2,'Unique contact probe anchor: '+a);runner=runner.replace(a,b);}
replace("cwd:root,encoding:'utf8'","cwd:"+JSON.stringify(root)+",encoding:'utf8'");
replace("'tools/sim/experiments/p5_centerline_probe.mjs'","'tools/sim/experiments/p4_command_contact_runner.mjs','tools/sim/experiments/p4_command_candidate.mjs'");
replace("assert(applySwordsmanship(G.player));G.combat.cutReactionModel=mode;G.combat.cutReactionFighter=mode==='centerline'?G.player:null;", "assert(applySwordsmanship(G.player));G.player.edgePlaneModel=mode==='commandDirection'?'commandDirection':undefined;G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;");
replace('  G.before=()=>{',`  row.commandedFrames=0;row.firstCommandedTick=null;row.commandWindow=[];row.playerInputHashes=[];
  row.exposure={active:0,swinging:0,tap:0,thrust:0,eligible:0,owners:{}};row.firstEligibleTick=null;
  G.player.p4Read=d=>{const f=G.player;row.exposure.active+=Number(!!f.inputActive);row.exposure.swinging+=Number(!!f.skill.swinging);row.exposure.tap+=Number(!!f.skill.tap);row.exposure.thrust+=Number(f.skill.thrustPose.w>0);row.exposure.eligible+=Number(d.command.eligible);
    const owner=f.swordsmanshipState?.owner??'missing';row.exposure.owners[owner]=(row.exposure.owners[owner]??0)+1;if(d.command.eligible)row.firstEligibleTick??=tick;
    if(mode==='commandDirection'&&d.command.eligible&&d.target.distanceTo(d.legacy)>1e-8){row.commandedFrames++;row.firstCommandedTick??=tick;}
    if(row.firstPlayerCutTick!==null)row.commandWindow.push({tick,eligible:d.command.eligible,moving:d.moving,target:d.target.toArray(),flat:d.flat.toArray(),blade:d.blade.toArray(),commandVelocity:d.command.velocity.toArray()});};
  G.before=()=>{`);
replace("G.combat.cutReactionModel===mode","G.combat.cutReactionModel==='legacy'");
if(opts.activeAI){
  replace('G.before=()=>{const f=G.player,delta=f.handOffset.clone().sub(prev);currentInput=',
    'G.before=()=>{const f=G.player,delta=f.handOffset.clone().sub(prev);f.handOffset.copy(prev);if(f.alive&&!f.weapon?.gun){f.handOffset.x+=delta.x;f.handOffset.y+=delta.y;}f.handHeld=true;f.inputActive=Math.abs(delta.x)+Math.abs(delta.y)>1e-5;currentInput=');
  replace('dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive','dx:f.alive&&!f.weapon?.gun?delta.x:0,dy:f.alive&&!f.weapon?.gun?delta.y:0,held:!!f.handHeld,active:!!f.inputActive');
  replace("player:'Unified default assistance/manual arm from spawn. Original AI2 generates player input, explicitly recorded after AI update; not human touch equivalence.'",
    "player:'Unified default assistance/manual arm from spawn. Convert original AI2 requested pad change into a consumed delta: restore prior applied pad, add delta only while alive/non-gun, set held=true as a sustained-touch fixture assumption and active=(abs(dx)+abs(dy)>1e-5), then recordSwordsmanshipInput. Both rows use main.js ordering/L1 threshold at120Hz with inputScale1. Not human touch/rAF/hitstop equivalence; reactive AI can change future requests.'");
  replace('   const state=selectedState(G);',"   if(tick===600||(row.firstEligibleTick!==null&&tick===row.firstEligibleTick+60)){assert(row.exposure.eligible>0,'No active swing exposure by early fixture deadline');if(mode==='commandDirection')assert(row.commandedFrames>0,'Candidate not exposed during first active swing window');}\n   const state=selectedState(G);");
}
if(opts.scripted){
  replace('AIClass:AI,AI2Class:AI,','AIClass:AI,');
  replace('  G.before=()=>{const f=G.player,delta=f.handOffset.clone().sub(prev);currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,currentInput);};',`  const script=[['ready',60,[0,0],true],['raise',48,[-.28,.38],true],['raisedHold',24,[0,0],true],['firstCut',30,[.56,-.76],true],['followHold',36,[0,0],true],['reverse',36,[-.38,.66],true],['reverseHold',24,[0,0],true],['tap',60,[0,0],true],['recut',30,[.40,-.70],true],['recutHold',36,[0,0],true],['release',60,[0,0],false]].flatMap(([phase,n,delta,held])=>Array.from({length:n},(_,i)=>({phase,delta:delta.map(v=>v/n),held,tap:phase==='tap'&&i===0})));
  row.tapAccepted=false;
  G.before=()=>{const f=G.player,req=script[tick]??{phase:'release',delta:[0,0],held:false,tap:false},[dx,dy]=req.delta;
    const allowed=f.alive&&!f.weapon?.gun;if(allowed){f.handOffset.x+=dx;f.handOffset.y+=dy;}f.handHeld=req.held;f.inputActive=Math.abs(dx)+Math.abs(dy)>1e-5;
    currentInput={id:tick,timeS:G.t,dx:allowed?dx:0,dy:allowed?dy:0,held:f.handHeld,active:f.inputActive};row.playerInputHashes.push(sha(JSON.stringify(currentInput)));row.checks.inputAccepted&&=recordSwordsmanshipInput(f,currentInput);
    if(req.tap&&f.alive)row.tapAccepted=f.skill.thrust();f.move.set(0,0);f.stickX=f.stickY=0;
  };`);
  replace('   const state=selectedState(G);',"   if(tick===161){assert(row.exposure.eligible>0,'No eligible swing by the scripted firstCut end');if(mode==='commandDirection')assert(row.commandedFrames>0,'No candidate intervention by scripted firstCut end');}\n   const state=selectedState(G);");
  replace("player:'Unified default assistance/manual arm from spawn. Original AI2 generates player input, explicitly recorded after AI update; not human touch equivalence.'",
    "player:'Same explicit ready/raise/cut/reverse/tap/recut/release120Hz delta schedule as preserved recut probe; after444steps continue release. Original player AI2 is absent, original reactive opponent AI remains. Default newRound gap, no initial state/health/force changes. Main.js alive/non-gun delta application, L1 active threshold, held schedule, recordSwordsmanshipInput, then tap command. No hitstop/rAF or human phone equivalence. FirstCut end161 requires eligibility/intervention.'");
}
replace("(mode!=='centerline'||G.combat.cutReactionFighter===G.player)","(G.enemy.edgePlaneModel!=='commandDirection'&&G.combat.cutReactionFighter===null)");
replace("for(const weapons of [['longsword','zweihander'],['zweihander','longsword']])","for(const weapons of [['longsword','zweihander']])");
replace("const b=await run(weapons,'centerline');","const b=await run(weapons,'commandDirection');");
// Preserve partial frames on an assertion/failure, rather than adding only
// completed rows after run() returns. Failure executions are real executions.
replace('let G;\n try{','let G;rows.push(row);\n try{');
replace("const a=await run(weapons,'legacy');rows.push(a);const b=await run(weapons,'commandDirection');rows.push(b);","const a=await run(weapons,'legacy');const b=await run(weapons,'commandDirection');");
replace('steps:rows.reduce((s,r)=>s+r.steps,0)','steps:rows.reduce((s,r)=>s+r.frames.length,0)');
replace("comparisons.push({weapons,sameCreation,exactPrefixNativeControlInput:prefix,sameBoundary,samePairNative,firstTickSame:tick===b.firstPlayerCutTick,firstPlayerCutTick:tick,firstInputDivergence,steps:[a.steps,b.steps],events:[a.events.length,b.events.length]});", "comparisons.push({weapons,sameCreation,exactPrefixNativeControlInput:prefix,sameBoundary,samePairNative,firstTickSame:tick===b.firstPlayerCutTick,firstPlayerCutTicks:[a.firstPlayerCutTick,b.firstPlayerCutTick],firstInputDivergence,firstNativeDivergence:a.frames.findIndex((x,i)=>x[1]!==b.frames[i]?.[1]),steps:[a.steps,b.steps],events:[a.events.length,b.events.length],candidateCommandedFrames:b.commandedFrames,firstCommandedTick:b.firstCommandedTick});");
replace('candidateCommandedFrames:b.commandedFrames,firstCommandedTick:b.firstCommandedTick','candidateCommandedFrames:b.commandedFrames,firstCommandedTick:b.firstCommandedTick,exactBeforeCandidate:JSON.stringify(a.frames.slice(0,b.firstCommandedTick??0))===JSON.stringify(b.frames.slice(0,b.firstCommandedTick??0))');
if(opts.scripted)replace('candidateCommandedFrames:b.commandedFrames,','firstPlayerInputDivergence:a.playerInputHashes.slice(0,Math.min(a.playerInputHashes.length,b.playerInputHashes.length)).findIndex((x,i)=>x!==b.playerInputHashes[i]),candidateCommandedFrames:b.commandedFrames,');
replace("rows.length===4&&rows.every(r=>Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.sameCreation&&c.exactPrefixNativeControlInput&&c.sameBoundary&&c.samePairNative&&c.firstTickSame)","rows.length===2&&rows.every(r=>Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.sameCreation&&c.candidateCommandedFrames>0&&c.exactBeforeCandidate)");
replace("experiment:'p5_centerline_contact'","experiment:'p4_command_contact'");
replace("weapons:[['longsword','zweihander'],['zweihander','longsword']]","weapons:[['longsword','zweihander']]");
replace("scope:'Centerline candidate selected from creation for player only. Legacy request/Eleft debit/stuck timer unchanged. Old budgeted path never enabled. Contact-after input may diverge through original reactive AI. Instant pair energy is separate from requested budget debit.'", "scope:'Command-direction plane candidate selected from creation for player only; both use current ordinary legacy cut response. Original reactive AI inputs can diverge before contact, so this is a narrow contact-collapse screen, not an equal-impact strength or win-rate comparison. Stop120steps after first player cut.'");
const runnerName='tools/sim/experiments/p4_command_contact_runner.mjs';fs.writeFileSync(path.join(directory,runnerName),runner);
const manifestNames=[...files,...dependencyNames,runnerName];
const frozenManifest=Object.fromEntries(manifestNames.map(n=>[n,sha(fs.readFileSync(path.join(directory,n)))]));
const proof={schemaVersion:1,head,directory,originalManifest,frozenManifest,markers,sourceProbe:{path:'tools/sim/experiments/p5_centerline_probe.mjs',sha256:sha(original)},
  producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),candidateSHA256:sha(fs.readFileSync(path.join(root,'tools/sim/experiments/p4_command_candidate.mjs'))),
  executionCommand:[process.execPath,path.join(directory,runnerName),'--out='+opts.out,'--seconds='+(opts.scripted?6:20)],preparedUTC:new Date().toISOString(),preparedOnly:!!opts.prepareOnly,activeAI:!!opts.activeAI,scripted:!!opts.scripted};
fs.writeFileSync(opts.out+'-preparation.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:true,directory,command:proof.executionCommand}));
if(!opts.prepareOnly)execFileSync(process.execPath,proof.executionCommand.slice(1),{stdio:'inherit'});
