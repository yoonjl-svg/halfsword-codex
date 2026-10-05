// Single approved fixture correction: respect the game's2s foot lock, approach
// with its normal joystick until actual distance<=2.8m, then the unchanged tape.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const arg=process.argv[2];assert(process.argv.length===3&&arg?.startsWith('--out='));const out=arg.slice(6);assert(path.isAbsolute(out)&&!fs.existsSync(out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const parentPath=path.join(root,'tools/sim/experiments/p4_round4_contact.mjs');
const original=fs.readFileSync(parentPath,'utf8');let source=original;
function edit(a,b){assert.equal(source.split(a).length,2,'Unique approach transform');source=source.replace(a,b);}
edit("const root=fileURLToPath(new URL('../../../',import.meta.url));",'const root='+JSON.stringify(root)+';');
const extra=String.raw`
replace("row.currentCommand.moving>0;if(qualified)", "row.currentCommand.moving>0&&G.player.alive&&G.player.armed&&d.cut.pr.v.fighter.alive;if(qualified)");
replace("qualifiedActiveCut:!!qualified,scriptPhase:", "victimState:{alive:d.cut.pr.v.fighter.alive,state:d.cut.pr.v.fighter.state},attackerState:{alive:G.player.alive,armed:G.player.armed,state:G.player.state},qualifiedActiveCut:!!qualified,scriptPhase:");
replace("row.tapAccepted=false;", "row.tapAccepted=false;row.touchStartTick=null;row.touchStartBoundary=null;");
replace("const f=G.player,req=script[tick]??{phase:'release',delta:[0,0],held:false,tap:false},[dx,dy]=req.delta;", "const f=G.player,gap=new THREE.Vector3().copy(f.bodies.pelvis.translation()).distanceTo(new THREE.Vector3().copy(G.enemy.bodies.pelvis.translation()));if(tick>=240&&row.touchStartTick===null&&gap<=2.8){row.touchStartTick=tick;row.touchStartBoundary={tick,gapM:gap,nativeSHA256:sha(G.world.takeSnapshot()),controlSHA256:sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)}))};}const localTick=row.touchStartTick===null?null:tick-row.touchStartTick,req=localTick===null?{phase:tick<240?'startLock':'approach',delta:[0,0],held:true,tap:false}:script[localTick]??{phase:'release',delta:[0,0],held:false,tap:false},[dx,dy]=req.delta;");
replace("const requestedStickY=tick<=347?1:0", "const requestedStickY=tick>=240&&(row.touchStartTick===null||tick-row.touchStartTick<=347)?1:0");
replace("if(tick===161)", "if(row.touchStartTick!==null&&tick===row.touchStartTick+161)");
replace("   const state=selectedState(G);", "   assert(row.touchStartTick!==null||tick<959,'No approach threshold within2s lock plus6s normal movement; stop without search');\n   const state=selectedState(G);");
replace("   if(!row.checks.finite)break;", "   if(row.firstEligiblePlayerCutTick===null&&row.touchStartTick!==null&&tick>=row.touchStartTick+script.length-1)break;\n   if(!row.checks.finite)break;");
replace("contactQualified:[a.contactQualified,b.contactQualified]", "touchStartTicks:[a.touchStartTick,b.touchStartTick],touchStartBoundaryExact:JSON.stringify(a.touchStartBoundary)===JSON.stringify(b.touchStartBoundary),contactQualified:[a.contactQualified,b.contactQualified]");
replace("c.exactBeforeCandidate&&c.firstPlayerInputDivergence===-1", "c.exactBeforeCandidate&&c.firstPlayerInputDivergence===-1&&c.touchStartBoundaryExact");
replace("experiment:'p4_round4_command_contact'", "experiment:'p4_round4_approach_contact'");
replace("Full forward joystick(0,1) through tick347 (recut end), then zero", "Honor original2s foot lock; after tick240 full forward joystick until actual3D pelvis gap<=2.8m (at most6s approach). Both rows must have exactly the same approach/input/native/control boundary. Start the same preserved touch tape there; continue full forward until its local tick347 (recut end), then zero");
replace("FirstCut end161 requires eligibility/intervention.", "FirstCut local end161 requires eligibility/intervention; no-contact row stops after the full444-step touch tape.");
replace("maximum6s", "maximum13s total, with2s start lock plus at most6s approach; no threshold or seed search");
replace("Qualified contact means actual player cut-response J>0", "Qualified contact requires a living armed player and a living victim, plus actual player cut-response J>0");
`;
const anchor='const runnerName=\'tools/sim/experiments/p4_command_contact_runner.mjs\';';
// Place extra runner edits inside the parent's String.raw extension, before it
// ends and before the old producer writes the frozen runner.
const end='`;'+'\n'+"const anchor=\"const runnerName='tools/sim/experiments/p4_command_contact_runner.mjs';\";";
edit(end,extra+'\n'+end);
edit("forwardStickTicks:[0,347],forwardStick:1", "forwardStickTicks:'After240step lock until the common touchStart+347',forwardStick:1,approachDistanceM:2.8");
edit("const command=[process.execPath,producerPath,'--out='+opts.out,'--scripted=true','--prepareOnly=true'];", "producer=producer.replace(\"'--seconds='+(opts.scripted?6:20)\",\"'--seconds='+(opts.scripted?13:20)\");fs.writeFileSync(producerPath,producer);\nconst command=[process.execPath,producerPath,'--out='+opts.out,'--scripted=true','--prepareOnly=true'];");
fs.mkdirSync(path.dirname(out),{recursive:true});const builder=out+'-approach-builder.mjs';assert(!fs.existsSync(builder));fs.writeFileSync(builder,source,{flag:'wx'});
execFileSync(process.execPath,[builder,'--out='+out],{stdio:'inherit'});
const prep=JSON.parse(fs.readFileSync(out+'-preparation.json'));
const proof={head:prep.head,parent:{path:parentPath,sha256:sha(original)},approachBuilder:{path:fileURLToPath(import.meta.url),sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))},generatedBuilder:{path:builder,sha256:sha(source)},executionCommand:prep.executionCommand,
 protocol:{gravity:9.81,seed:7,startGap:5.6,startLockSteps:240,approach:'Normal forward joystick(0,1); actual3D pelvis distance<=2.8m; at most720approach steps; no teleport or threshold search.',touch:'Unchanged444-step tape begins at the common approach boundary. Full forward through local347, then0. First qualified active non-thrust cut J>0 plus120steps; otherwise end of tape.',sourceCandidate:'Unchanged p4_command_candidate.mjs direction-only helper; from creation, no gain/torque/damping changes.'},preparedUTC:new Date().toISOString()};
fs.writeFileSync(out+'-approach-proof.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:true,executionCommand:prep.executionCommand}));
