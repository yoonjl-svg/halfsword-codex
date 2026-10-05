// Round4 contact fixture only: retained command-plane candidate and touch tape,
// normal forward joystick added. All transforms are guarded and artifact-local.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const parentName='tools/sim/experiments/p4_command_contact.mjs';
const original=fs.readFileSync(path.join(root,parentName),'utf8');let producer=original;
function edit(a,b){assert.equal(producer.split(a).length,2,'Unique producer anchor');producer=producer.replace(a,b);}
edit("const root=fileURLToPath(new URL('../../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');",'const root='+JSON.stringify(root)+",sha=b=>createHash('sha256').update(b).digest('hex');");
const extension=String.raw`
// Additional round4 transforms affect the fixture/observation, never gains or
// the retained commandDirection formula.
replace("import {newRound,AI,THREE,DT} from '../harness_m.mjs';", "import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';");
replace("const row={weapons,mode,observer,seed:7,frames:[],events:[],window:[],firstPlayerCutTick:null,", "const row={weapons,mode,observer,seed:7,frames:[],events:[],window:[],firstPlayerCutTick:null,firstEligiblePlayerCutTick:null,qualifiedCuts:0,inputTape:[],p4Metrics:[],");
replace("assert(applySwordsmanship(G.player));G.player.edgePlaneModel", "assert.equal(CONFIG.PHYSICS.gravity,-9.81);assert.equal(G.world.gravity.y,-9.81);assert(applySwordsmanship(G.player));G.player.edgePlaneModel");
replace("  row.commandedFrames=0;", "  let insideP4Drive=false,lastP4Torque=null;const driveP4=G.player.driveSword,torqueP4=G.player.sword.addTorque;G.player.driveSword=function(...a){insideP4Drive=true;try{return driveP4.apply(this,a);}finally{insideP4Drive=false;}};G.player.sword.addTorque=function(...a){if(insideP4Drive)lastP4Torque={tick,vector:V(a[0])};return torqueP4.apply(this,a);};\n  row.commandedFrames=0;");
replace("G.player.p4Read=d=>{const f=G.player;", "G.player.p4Read=d=>{const f=G.player;row.currentCommand={tick,phase:row.currentPhase,eligible:d.command.eligible,moving:d.moving,commandVelocity:d.command.velocity.toArray(),commandTransverse:d.command.transverse.toArray(),flat:d.flat.toArray(),blade:d.blade.toArray(),target:d.target.toArray(),legacy:d.legacy.toArray()};");
replace("    const allowed=f.alive&&!f.weapon?.gun;", "    row.currentPhase=req.phase;const allowed=f.alive&&!f.weapon?.gun;");
replace("if(req.tap&&f.alive)row.tapAccepted=f.skill.thrust();f.move.set(0,0);f.stickX=f.stickY=0;", "if(req.tap&&f.alive)row.tapAccepted=f.skill.thrust();const requestedStickY=tick<=347?1:0,emv=f.emoMods?.move??1;f.move.set(0,f.alive?requestedStickY*emv:0);f.stickX=0;f.stickY=f.alive?requestedStickY:0;const applied={hand:currentInput,move:f.move.toArray(),stick:[f.stickX,f.stickY],tapRequested:req.tap};row.playerInputHashes[tick]=sha(JSON.stringify(applied));row.inputTape.push({tick,phase:req.phase,requested:{dx,dy,held:req.held,active:Math.abs(dx)+Math.abs(dy)>1e-5,stick:[0,requestedStickY],tap:req.tap},applied});");
replace("if(d.attacker!==0||row.events.length>=64)return null;lastReaction=null;", "if(d.attacker!==0||row.events.length>=256)return null;lastReaction=null;const qualified=Number.isFinite(d.J)&&d.J>0&&row.currentCommand?.eligible&&row.currentCommand.moving>0;if(qualified){row.firstEligiblePlayerCutTick??=tick;row.qualifiedCuts++;}");
replace("return {...d,sw:undefined", "return {...d,qualifiedActiveCut:!!qualified,scriptPhase:row.currentPhase,commandedFramesBefore:row.commandedFrames,sw:undefined");
replace("   const state=selectedState(G);", "   const f=G.player,blade=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation())),flat=new THREE.Vector3(0,0,1).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation())),mid=f.bladePoint(.7,new THREE.Vector3()),vel=new THREE.Vector3().copy(f.sword.velocityAtPoint(mid)),transverse=vel.clone().addScaledVector(blade,-vel.dot(blade)),cmd=new THREE.Vector3(...(row.currentCommand?.commandVelocity??[0,0,0])).projectOnPlane(blade),cutNormal=new THREE.Vector3().crossVectors(blade,transverse),cmdNormal=new THREE.Vector3().crossVectors(blade,cmd),angle=n=>n.lengthSq()>1e-12?Math.acos(Math.min(1,Math.abs(flat.dot(n.normalize())))):null;row.p4Metrics.push({tick,phase:row.currentPhase,pre:row.currentCommand,actual:{tipSpeedMps:norm(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))),midVelocity:vel.toArray(),midTransverseSpeedMps:transverse.length(),commandSignedSpeedMps:cmd.lengthSq()>1e-12?transverse.dot(cmd.clone().normalize()):null,physicalEdgeErrorRad:angle(cutNormal),commandEdgeErrorRad:angle(cmdNormal),axialOmegaRadps:blade.dot(new THREE.Vector3().copy(f.sword.angvel())),swordKJ:snapshotWorld(G.world,{bodies:[f.sword]}).total.K,torque:lastP4Torque?.tick===tick?lastP4Torque.vector:null,health:f.armHealth,state:f.state,alive:f.alive,armed:f.armed},bodyGapM:new THREE.Vector3().copy(f.bodies.pelvis.translation()).distanceTo(new THREE.Vector3().copy(G.enemy.bodies.pelvis.translation()))});\n   const state=selectedState(G);");
replace("if(observer&&row.firstPlayerCutTick!=null&&tick>=row.firstPlayerCutTick+120)break;", "if(observer&&row.firstEligiblePlayerCutTick!=null&&tick>=row.firstEligiblePlayerCutTick+120)break;");
replace("row.checks.contactObserved=!observer||row.events.length>0;", "row.contactObserved=row.events.length>0;row.contactQualified=row.firstEligiblePlayerCutTick!==null;");
replace("firstPlayerInputDivergence:a.playerInputHashes", "contactQualified:[a.contactQualified,b.contactQualified],firstEligiblePlayerCutTicks:[a.firstEligiblePlayerCutTick,b.firstEligiblePlayerCutTick],qualifiedCuts:[a.qualifiedCuts,b.qualifiedCuts],firstPlayerInputDivergence:a.playerInputHashes");
replace("   G.step();prev.copy", "   row.currentCommand=null;G.step();prev.copy");
replace("c.sameCreation&&c.candidateCommandedFrames>0&&c.exactBeforeCandidate", "c.sameCreation&&c.candidateCommandedFrames>0&&c.exactBeforeCandidate&&c.firstPlayerInputDivergence===-1");
replace("experiment:'p4_command_contact'", "experiment:'p4_round4_command_contact'");
replace("postFirstCutSteps:120", "postFirstEligibleCutSteps:120");
replace("Default newRound gap, no initial state/health/force changes.", "Default newRound gap5.6. Full forward joystick(0,1) through tick347 (recut end), then zero, via main move*emotionScale and raw stick contract. No initial state/health/force changes; no distance/seed search; gravity9.81.");
replace("Stop120steps after first player cut.", "Qualified contact means actual player cut-response J>0 while active non-thrust command eligibility and physical moving weight>0; stop120steps later, maximum6s. Mere touching, held/tap contacts and unexposed candidates do not close the active-cut gate. Measurement validity is separate from contact qualification and gameplay acceptance.");
`;
const anchor="const runnerName='tools/sim/experiments/p4_command_contact_runner.mjs';";
edit(anchor,extension+'\n'+anchor);
fs.mkdirSync(path.dirname(opts.out),{recursive:true});
const producerPath=opts.out+'-producer.mjs';assert(!fs.existsSync(producerPath));fs.writeFileSync(producerPath,producer,{flag:'wx'});
const command=[process.execPath,producerPath,'--out='+opts.out,'--scripted=true','--prepareOnly=true'];
execFileSync(process.execPath,command.slice(1),{stdio:'inherit'});
const prep=JSON.parse(fs.readFileSync(opts.out+'-preparation.json'));
const proof={schemaVersion:1,scope:'Round4 normal approach fixture. Existing candidate/helper unchanged. No physics performed by this prepare command.',
  parentProducer:{path:parentName,sha256:sha(original)},round4Producer:{path:fileURLToPath(import.meta.url),sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))},
  generatedProducer:{path:producerPath,sha256:sha(producer)},prepareCommand:command,executionCommand:prep.executionCommand,head:prep.head,
  unchangedCandidateSHA256:prep.candidateSHA256,protocol:{seed:7,gravity:9.81,defaultStartGap:5.6,forwardStickTicks:[0,347],forwardStick:1,touchTape:'Existing preserved ready/raise/firstCut/hold/reverse/hold/tap/recut/hold/release schedule; unchanged.',contactQualification:'Player actual cut-response J>0; command eligible and moving>0 at that tick. Candidate must be exposed. First qualified cut +120steps or6s maximum.',rows:2},preparedUTC:new Date().toISOString()};
fs.writeFileSync(opts.out+'-round4-proof.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:true,proof:opts.out+'-round4-proof.json',executionCommand:prep.executionCommand}));
