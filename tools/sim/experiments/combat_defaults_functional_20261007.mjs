// Short native input regression. No power, natural recovery, or realism claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';
import {configureCombatDefaults} from '../../../src/combat_defaults.js';
import {configureSwordsmanshipDefault,swordsmanshipDefaultSupportsWeapon} from '../../../src/swordsmanship_default.js';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2]?.replace(/^--out=/,'');
const contactRun=process.argv[3]==='--contact';
assert((process.argv.length===3||process.argv.length===4&&contactRun)&&process.argv[2].startsWith('--out=')&&path.isAbsolute(out)&&!fs.existsSync(out),'Supply a fresh absolute --out directory, optionally --contact');
const sha=b=>createHash('sha256').update(b).digest('hex');
const scan=(d,p='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(d,e.name),p+e.name+'/'):[p+e.name]);
const sourceNames=[...scan(path.join(root,'src')).filter(n=>n.endsWith('.js')).map(n=>'src/'+n),'tools/sim/harness_m.mjs','tools/sim/experiments/combat_defaults_functional_20261007.mjs','package.json','package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const manifest=()=>Object.fromEntries(sourceNames.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const sourceBefore=manifest(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const entry=configureSwordsmanshipDefault(new URLSearchParams());
const previousPolicy=weapon=>({longsword:{stance:'legacy',cut:'centerline',roll:'bounded'},qinggang:{stance:'legacy',cut:'legacy',roll:'bounded'},zweihander:{stance:'fresh',cut:'centerline',roll:'legacy'}}[weapon.id]??{stance:'legacy',cut:'legacy',roll:'legacy'});
const weapons=contactRun?['sabre']:['sabre','rapier','zweihander','rubber_chicken','monohoshizao','lightsaber','pistol'];
const schedule=[['ready',60,[0,0],true,0],['raise',48,[-.28,.38],true,1],['raisedHold',24,[0,0],true,1],['firstCut',30,[.56,-.76],true,1],['followHold',36,[0,0],true,1],['reverse',36,[-.38,.66],true,1],['reverseHold',24,[0,0],true,1],['tap',60,[0,0],true,0],['recut',30,[.40,-.70],true,0],['recutHold',36,[0,0],true,0],['release',60,[0,0],false,0]];
const tape=schedule.flatMap(([phase,n,delta,held,stickY])=>Array.from({length:n},(_,i)=>({phase,dx:delta[0]/n,dy:delta[1]/n,held,stickY,tap:phase==='tap'&&i===0})));
assert.equal(tape.length,444);assert.equal(CONFIG.PHYSICS.gravity,-9.81);assert.equal(CONFIG.GAIT.stanceMemory,'legacy');assert.equal(CONFIG.BODY.supportModel,'legacy');
class IdleOpponent {update(){}}
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),norm=v=>Math.hypot(v.x,v.y,v.z);
const health=f=>({state:f.state,alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),offGripValid:!!f.offGripJoint?.isValid(),armHealth:f.armHealth,blood:f.blood,pelvisY:f.bodies.pelvis.translation().y});
const control=f=>({health:health(f),handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,handTarget:f.handTarget.toArray(),aim:f.aimDirW.toArray(),skillLevel:f.skill.level,autoGuard:f.skill.autoGuard,onehandArmModel:f.onehandArmModel??null,version:f.swordsmanshipState?.version??null});
const jointGap=j=>j?.isValid()?V(j.anchor1()).applyQuaternion(Q(j.body1().rotation())).add(V(j.body1().translation())).distanceTo(V(j.anchor2()).applyQuaternion(Q(j.body2().rotation())).add(V(j.body2().translation()))):null;
function state(f){
 const axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),chestUp=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.bodies.chest.rotation()));
 const gaps=f.joints.filter(j=>j.joint?.isValid()).map(j=>({name:j.name,gapM:jointGap(j.joint)}));
 return {...health(f),handOffset:f.handOffset.toArray(),assistPhase:f.swordsmanshipState?.phase??null,assistOwner:f.swordsmanshipState?.owner??null,
  gripGapM:jointGap(f.gripJoint),maxJointGap:gaps.reduce((a,b)=>b.gapM>a.gapM?b:a,{name:null,gapM:0}),
  chestTiltRad:Math.acos(THREE.MathUtils.clamp(chestUp.y,-1,1)),aimErrorRad:Math.acos(THREE.MathUtils.clamp(axis.dot(f.aimDirW),-1,1)),
  tipSpeedMps:norm(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))),swordOmegaRadps:norm(f.sword.angvel()),
  gunShots:f.gun?.shots??0};
}
const rows=[],startedUTC=new Date().toISOString(),started=performance.now(),random=Math.random;let error=null,baselineTouchStart=null;
fs.mkdirSync(out,{recursive:true});
// Preserve the exact controller sources alongside hashes, without dependencies or frame payloads.
for(const n of sourceNames.filter(n=>!n.startsWith('node_modules/'))){const dest=path.join(out,'source',n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,n),dest);}
async function run(weapon,mode){
 const row={weapon,mode,steps:0,error:null,checks:{finite:true,inputAccepted:true,inputConsumed:true,gravityFixed:true,modelsFixed:true},creation:null,
  firstInput:null,boundaries:[],states:{},firstFailure:{},contact:{swordContactSteps:0,centerlineEvents:0,positiveImpulseEvents:0,wrongAttackerEvents:0,unresolvedAttackerEvents:0,firstCenterlineEvent:null,wounds:0},
  extremes:{minPelvisY:Infinity,maxPelvisY:-Infinity,maxChestTiltRad:0,maxAimErrorRad:0,maxGripGapM:0,maxJointGapM:0,maxSwordOmegaRadps:0,maxTipSpeedMps:0,minFootColliderY:Infinity}};
 rows.push(row);let G,tick=0,request=null,supplied=null;
 const nativeDigest=createHash('sha256'),requestedDigest=createHash('sha256'),appliedDigest=createHash('sha256');
 try{
  G=newRound({seed:7,weapon,weapon2:'longsword',gap:5.6,walls:false,AIClass:contactRun?AI:IdleOpponent,onFighter:f=>{
   f.onehandArmModel='legacy';if(f.index===0&&swordsmanshipDefaultSupportsWeapon(f.weapon))f.onehandArmModel='manual';
   if(f.index===0){const policy=mode==='previous'?previousPolicy(f.weapon):configureCombatDefaults(entry,f.weapon);f.stanceMemoryModel=policy.stance;f.rollTargetModel=policy.roll;}
  }});
  const f=G.player;row.policy=mode==='previous'?previousPolicy(f.weapon):configureCombatDefaults(entry,f.weapon);
  f.skill.autoGuard=true;row.v2=swordsmanshipDefaultSupportsWeapon(f.weapon);if(row.v2)assert(applySwordsmanship(f));f.canShove=true;
  G.combat.cutReactionModel=row.policy.cut;G.combat.cutReactionFighter=row.policy.cut==='centerline'?f:null;
  row.creation={nativeSHA256:sha(G.world.takeSnapshot()),controllerSHA256:sha(JSON.stringify([control(f),control(G.enemy)])),state:state(f)};
  G.combat.onCutReaction=r=>{
   const attacker=G.combat.info.get(Number(r.key.split(':')[0]))?.fighter?.index;
   row.contact.centerlineEvents++;row.contact.positiveImpulseEvents+=Number(r.J>0);
   row.contact.wrongAttackerEvents+=Number(attacker!==undefined&&attacker!==0);row.contact.unresolvedAttackerEvents+=Number(attacker===undefined);
   row.contact.firstCenterlineEvent??={tick,phase:request?.phase,mode:r.mode,key:r.key,step:r.step,attacker,appliedPositiveImpulse:r.J>0};
  };
  G.before=()=>{
   if(contactRun){
    const gap=V(f.bodies.pelvis.translation()).distanceTo(V(G.enemy.bodies.pelvis.translation()));
    if(row.touchStartTick===undefined&&(mode==='previous'?tick>=240&&gap<=2.8:baselineTouchStart!==null&&tick===baselineTouchStart)){
     row.touchStartTick=tick;if(mode==='previous')baselineTouchStart=tick;
     row.touchStartBoundary={tick,gapM:gap,nativeSHA256:sha(G.world.takeSnapshot())};
    }
    const local=row.touchStartTick===undefined?null:tick-row.touchStartTick;
    request=local===null?{phase:tick<240?'startLock':'approach',dx:0,dy:0,held:true,stickY:tick>=240?1:0,tap:false}:{...tape[local],stickY:local<=347?1:0};
   }else request=tape[tick];
   const allowed=f.alive&&!f.weapon.gun,active=Math.abs(request.dx)+Math.abs(request.dy)>1e-5;
   if(allowed){f.handOffset.x+=request.dx;f.handOffset.y+=request.dy;}f.handHeld=request.held;f.inputActive=active;
   supplied={id:tick,timeS:G.t,dx:allowed?request.dx:0,dy:allowed?request.dy:0,held:request.held,active};
   const accepted=recordSwordsmanshipInput(f,supplied);row.checks.inputAccepted&&=accepted===row.v2;
   if(request.tap)row.tapAccepted=f.alive?f.skill.thrust():false;
   const stick=f.alive?request.stickY:0;f.move.set(0,stick);f.stickX=0;f.stickY=stick;
   requestedDigest.update(JSON.stringify(request)+'\n');appliedDigest.update(JSON.stringify({supplied,stick})+'\n');
   if(row.firstInput===null&&active)row.firstInput={tick,supplied,accepted,before:control(f)};
  };
  for(tick=0;tick<(contactRun?1404:tape.length);tick++){
   if(contactRun&&row.touchStartTick!==undefined&&tick>=row.touchStartTick+tape.length){row.terminal='full_touch_tape_complete';break;}
   if(contactRun&&row.touchStartTick===undefined&&tick>=960){row.terminal='approach_not_exposed';break;}
   if(tick%120===0)await new Promise(r=>setImmediate(r));G.step();row.steps++;
   const s=state(f),e=row.extremes;row.states[s.state]=(row.states[s.state]??0)+1;
   const finite=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
   row.checks.finite&&=finite;row.checks.inputConsumed&&=!row.v2||JSON.stringify(f.swordsmanshipState.input)===JSON.stringify(supplied);
   row.checks.gravityFixed&&=G.world.gravity.y===-9.81;row.checks.modelsFixed&&=f.stanceMemoryModel===row.policy.stance&&f.rollTargetModel===row.policy.roll&&G.combat.cutReactionModel===row.policy.cut;
   for(const [name,failed]of Object.entries({nonfinite:!finite,dead:!s.alive,unarmed:!s.armed,invalidGrip:!s.gripValid,pelvisBelowGround:s.pelvisY<0,notStanding:s.state!=='stand'}))if(failed&&row.firstFailure[name]===undefined)row.firstFailure[name]={tick,phase:request.phase};
   e.minPelvisY=Math.min(e.minPelvisY,s.pelvisY);e.maxPelvisY=Math.max(e.maxPelvisY,s.pelvisY);e.maxChestTiltRad=Math.max(e.maxChestTiltRad,s.chestTiltRad);e.maxAimErrorRad=Math.max(e.maxAimErrorRad,s.aimErrorRad);
   e.maxGripGapM=Math.max(e.maxGripGapM,s.gripGapM??0);e.maxJointGapM=Math.max(e.maxJointGapM,s.maxJointGap.gapM);e.maxSwordOmegaRadps=Math.max(e.maxSwordOmegaRadps,s.swordOmegaRadps);e.maxTipSpeedMps=Math.max(e.maxTipSpeedMps,s.tipSpeedMps);
   for(const name of ['footF','footB']){const b=f.bodies[name];if(b)e.minFootColliderY=Math.min(e.minFootColliderY,b.translation().y);}
   let contacts=0;for(const c of f.swordColliders)G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,m=>{contacts+=m.numSolverContacts();}));if(contacts)row.contact.swordContactSteps++;
   nativeDigest.update(G.world.takeSnapshot());
   if(tick===row.firstInput?.tick)row.firstInput.after=control(f);
   const nextLocal=contactRun?tick-(row.touchStartTick??Infinity)+1:tick+1;
   if(tick===0||nextLocal===tape.length||nextLocal>=0&&tape[nextLocal]?.phase!==request.phase)row.boundaries.push({tick,phase:request.phase,state:s,nativeSHA256:sha(G.world.takeSnapshot())});
   if(!finite)throw Error('Nonfinite native state');
  }
  row.final=state(f);row.contact.wounds=G.wounds.length;
  row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}));
  // Controlled lifecycle sentinel after the motion run, not injury/recovery evidence.
  const gait=f.gait;assert(gait.started);const sentinel={F:123.25,B:456.5};for(const k of ['F','B'])gait.legs[k].Nf=sentinel[k];
  const nativeBefore=sha(G.world.takeSnapshot());gait.enter();const after=Object.fromEntries(['F','B'].map(k=>[k,gait.legs[k].Nf]));
  row.reentryContract={kind:'direct Gait.enter with authored Nf sentinel after motion; no recovered-standing efficacy',sentinel,after,expected:row.policy.stance==='fresh'?{F:0,B:0}:sentinel,
   nativeBefore,nativeAfter:sha(G.world.takeSnapshot())};row.reentryContract.pass=JSON.stringify(after)===JSON.stringify(row.reentryContract.expected);
 }catch(e){row.error={name:e.name,message:e.message,stack:e.stack};}
 finally{
  row.nativeTraceSHA256=nativeDigest.digest('hex');row.requestedInputSHA256=requestedDigest.digest('hex');row.appliedInputSHA256=appliedDigest.digest('hex');
  G?.eventQueue.free();G?.world.free();console.log(JSON.stringify({weapon,mode,steps:row.steps,error:row.error?.message??null,failures:row.firstFailure,contact:row.contact,extremes:row.extremes}));
 }
}
try{for(const weapon of weapons)for(const mode of ['previous','common'])await run(weapon,mode);}catch(e){error={message:e.message,stack:e.stack};}
finally{
 Math.random=random;const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
 const comparisons=weapons.map(weapon=>{const a=rows.find(r=>r.weapon===weapon&&r.mode==='previous'),b=rows.find(r=>r.weapon===weapon&&r.mode==='common');return{weapon,
  creationNativeExact:a?.creation?.nativeSHA256===b?.creation?.nativeSHA256,creationControlExact:a?.creation?.controllerSHA256===b?.creation?.controllerSHA256,
  requestedInputExact:a?.requestedInputSHA256===b?.requestedInputSHA256,appliedInputExact:a?.appliedInputSHA256===b?.appliedInputSHA256,nativeTraceExact:a?.nativeTraceSHA256===b?.nativeTraceSHA256,
  newGrossFailureKinds:b?Object.keys(b.firstFailure).filter(k=>!a?.firstFailure[k]):null};});
 const expectedRuns=contactRun?2:14;
 const executionPass=!error&&sourceStable&&rows.length===expectedRuns&&rows.every(r=>!r.error&&r.steps===(contactRun?(r.touchStartTick??516)+444:444)&&Object.values(r.checks).every(Boolean)&&r.reentryContract?.pass)&&comparisons.every(c=>c.creationNativeExact&&c.creationControlExact&&c.requestedInputExact);
 const report={schemaVersion:1,head,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,sourceBefore,sourceAfter,sourceStable,
  executionPass,newPhysicsExecutions:rows.length,physicsSteps:rows.reduce((n,r)=>n+r.steps,0),dt:DT,protocol:{seed:7,weapons,gapM:5.6,contactRun,opponent:contactRun?'Normal original AI, 240-step lock then ordinary approach; baseline gap<=2.8m fixes both tape start ticks.':'Idle ordinary opponent; no AI input. Authored move and hand tape, native game Fighter and Combat.',schedule,steps:444,
   defaults:'previous 3-ID whitelist vs imported common capability policy; same production v2 weapon support and real applySwordsmanship/recordSwordsmanshipInput',
   exclusions:'No body/velocity/health injection during motion; no physics coefficient changes. Gait Nf sentinel runs only after completed motion.',
   limitations:'Fixed 3.7s input screen (contact mode additionally uses one bounded approach). Not natural recovery, active cut power, AI wins, long-duration spin, human realism, browser input, or all-contact acceptance. Centerline exposure is counted only if actual runtime callback fires. Legacy recordSwordsmanshipInput rejection is expected for excluded weapons and gun. Ground metric is foot body center, not contact load. Initial 14-row source contained an unused boundedRollRead callback: its all-zero roll field does not measure roll activation; current script omits this unsupported observer.'},
  comparisons,rows,error};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({executionPass,runs:report.newPhysicsExecutions,steps:report.physicsSteps,wallSeconds:report.wallSeconds,sourceStable,comparisons}));if(!executionPass)process.exitCode=1;
}
