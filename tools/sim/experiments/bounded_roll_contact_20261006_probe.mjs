// Existing round4 approach/touch fixture, completed through release when alive.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {observedCutStep,plain,controls,selectedState,pairAnalysis,snapshotWorld,V,norm} from './round4_integrated_observer.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const out=process.argv[2]?.replace(/^--out=/,'');
assert(process.argv.length===3&&process.argv[2].startsWith('--out=')&&path.isAbsolute(out)&&!fs.existsSync(out));
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'))),manifest=()=>Object.fromEntries(Object.keys(source.files).sort().map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest();assert.deepEqual(sourceBefore,source.files);assert.equal(CONFIG.PHYSICS.gravity,-9.81);
fs.mkdirSync(out,{recursive:true});
const observer=await observedCutStep();
const schedule=[['ready',60,[0,0],true],['raise',48,[-.28,.38],true],['raisedHold',24,[0,0],true],['firstCut',30,[.56,-.76],true],['followHold',36,[0,0],true],['reverse',36,[-.38,.66],true],['reverseHold',24,[0,0],true],['tap',60,[0,0],true],['recut',30,[.40,-.70],true],['recutHold',36,[0,0],true],['release',60,[0,0],false]];
const tape=schedule.flatMap(([phase,n,delta,held])=>Array.from({length:n},(_,i)=>({phase,delta:delta.map(v=>v/n),held,tap:phase==='tap'&&i===0})));assert.equal(tape.length,444);
const rows=[],startedUTC=new Date().toISOString(),started=performance.now(),random=Math.random;
let baselineTouchStart=null,error=null,signal=null;
const interrupted=()=>{signal='interrupted';};process.on('SIGINT',interrupted);process.on('SIGTERM',interrupted);
const health=f=>({alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),state:f.state,armHealth:f.armHealth,blood:f.blood,pain:f.pain,limbs:{...f.limbs}});
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b))));
async function run(mode){
 const row={mode,steps:0,stepCalls:0,frames:[],inputTape:[],metrics:[],events:[],woundCalls:[],touchStartTick:null,touchStartBoundary:null,
  firstGoalChangeTick:null,changedGoalFrames:0,firstQualifiedContactTick:null,qualifiedContacts:0,tapAccepted:null,terminal:null,error:null,
  exposure:{active:0,swinging:0,eligible:0,tap:0,thrust:0,owners:{}},checks:{finite:true,inputAccepted:true,ordinaryModels:true,gravityFixed:true}};
 rows.push(row);let G,tick=0,current=null,pre=null,insideDrive=false,requestedTorque=null,previousRoll=null;
 try{
  G=newRound({seed:7,weapon:'longsword',weapon2:'zweihander',gap:5.6,walls:false,AIClass:AI,onFighter:f=>{
   if(f.index===0)f.onehandArmModel='manual';
   const wound=f.applyWound;f.applyWound=function(h,...a){const before=health(this),result=wound.call(this,h,...a);row.woundCalls.push({tick,fighter:f.index,request:plain(h),before,after:health(this)});return result;};
  }});
  assert.equal(G.ai2,null);assert(applySwordsmanship(G.player));G.player.rollTargetModel=mode==='boundedRoll'?'bounded':undefined;G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;
  row.creationNativeSHA256=sha(G.world.takeSnapshot());row.creationControlSHA256=sha(JSON.stringify([controls(G.player),controls(G.enemy)]));
  const drive=G.player.driveSword,addTorque=G.player.sword.addTorque;
  G.player.driveSword=function(...a){insideDrive=true;try{return drive.apply(this,a);}finally{insideDrive=false;}};
  G.player.sword.addTorque=function(...a){if(insideDrive)requestedTorque=V(a[0]);return addTorque.apply(this,a);};
  G.player.boundedRollRead=d=>{
   if(previousRoll&&previousRoll.tick!==tick-1)previousRoll=null;
   const f=G.player,changed=d.target.distanceTo(d.raw)>1e-10,transport=previousRoll?new THREE.Quaternion().setFromUnitVectors(previousRoll.blade,d.blade):null;
   const slew=(key)=>previousRoll?Math.atan2(new THREE.Vector3().crossVectors(previousRoll[key].clone().applyQuaternion(transport),d[key]).dot(d.blade),previousRoll[key].clone().applyQuaternion(transport).dot(d[key])):0;
   pre={tick,phase:current?.phase,blade:d.blade.toArray(),flat:d.flat.toArray(),raw:d.raw.toArray(),target:d.target.toArray(),moving:d.moving,
    eligible:d.command.eligible,commandVelocity:d.command.velocity.toArray(),commandSpeedMps:d.command.speed,
    rawSlewRad:slew('raw'),targetSlewRad:slew('target'),rawErrorRad:angle(d.flat,d.raw),targetErrorRad:angle(d.flat,d.target),changed,commandBudgetRad:f.weaponCfg.wristVmax*Math.sqrt(f.strength)*DT,
    owner:f.swordsmanshipState.owner,inputActive:!!f.inputActive,swinging:!!f.skill.swinging,tap:!!f.skill.tap,thrustWeight:f.skill.thrustPose.w};
   previousRoll={tick,blade:d.blade.clone(),raw:d.raw.clone(),target:d.target.clone()};
   if(changed){row.firstGoalChangeTick??=tick;row.changedGoalFrames++;}
   for(const k of ['active','swinging','eligible','tap','thrust'])row.exposure[k]+=Number(({active:!!f.inputActive,swinging:!!f.skill.swinging,eligible:d.command.eligible,tap:!!f.skill.tap,thrust:f.skill.thrustPose.w>0})[k]);
   row.exposure.owners[pre.owner]=(row.exposure.owners[pre.owner]??0)+1;
  };
  G.before=()=>{
   const f=G.player,gap=new THREE.Vector3().copy(f.bodies.pelvis.translation()).distanceTo(new THREE.Vector3().copy(G.enemy.bodies.pelvis.translation()));
   const start=mode==='legacy'?tick>=240&&gap<=2.8:baselineTouchStart!==null&&tick===baselineTouchStart;
   if(row.touchStartTick===null&&start){row.touchStartTick=tick;if(mode==='legacy')baselineTouchStart=tick;row.touchStartBoundary={tick,gapM:gap,nativeSHA256:sha(G.world.takeSnapshot()),controlSHA256:sha(JSON.stringify([controls(G.player),controls(G.enemy)]))};}
   const local=row.touchStartTick===null?null:tick-row.touchStartTick,req=local===null?{phase:tick<240?'startLock':'approach',delta:[0,0],held:true,tap:false}:tape[local];assert(req);
   const [dx,dy]=req.delta,allowed=f.alive&&!f.weapon.gun,active=Math.abs(dx)+Math.abs(dy)>1e-5,stick=tick>=240&&(local===null||local<=347)?1:0;
   if(allowed){f.handOffset.x+=dx;f.handOffset.y+=dy;}f.handHeld=req.held;f.inputActive=active;
   const input={id:tick,timeS:G.t,dx:allowed?dx:0,dy:allowed?dy:0,held:req.held,active};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,input);
   if(req.tap&&f.alive)row.tapAccepted=f.skill.thrust();f.move.set(0,f.alive?stick*(f.emoMods?.move??1):0);f.stickX=0;f.stickY=f.alive?stick:0;
   current={tick,phase:req.phase,localTick:local,requested:{dx,dy,held:req.held,active,tap:req.tap,stickY:stick},applied:{input,move:f.move.toArray(),stick:[f.stickX,f.stickY]},enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}};row.inputTape.push(current);
  };
  G.combat.afterStep=observer.afterStep;
  G.combat.p5ContactObserver=(stage,d)=>{
   if(stage==='before'){
    if(d.attacker!==0)return null;
    const qualified=d.J>0&&G.player.alive&&G.player.armed&&d.cut.pr.v.fighter.alive&&pre?.eligible&&pre.moving>0;
    if(qualified){row.firstQualifiedContactTick??=tick;row.qualifiedContacts++;}
    return {...d,tick,timeS:G.t,phase:current?.phase,qualified:!!qualified,attackerState:health(G.player),victimState:health(d.cut.pr.v.fighter),
     sw:undefined,vb:undefined,cut:undefined,bodies:[d.sw,d.vb],before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),budgetAfter:d.cut.Eleft,stuckAfter:d.cut.stuckT,regime:d.budgetBefore>0?'drag':'stuck'};
   }
   if(d.token){const t=d.token,event={...t,bodies:undefined,pointV:t.legacyPointV,reaction:null,after:snapshotWorld(G.world,{bodies:t.bodies})};event.analysis=pairAnalysis(event);row.events.push(event);}
  };
  for(tick=0;tick<1404;tick++){
   if(tick%120===0)await new Promise(r=>setImmediate(r));if(signal)throw Error('Interrupted; partial row retained');
   if(row.touchStartTick!==null&&tick>=row.touchStartTick+tape.length){row.terminal={tick,reason:'full_touch_tape_complete'};break;}
   if(row.touchStartTick===null&&tick>=960){row.terminal={tick,reason:'no_normal_approach_within_6s_after_lock'};break;}
   pre=null;requestedTorque=null;row.stepCalls++;G.step();row.steps++;
   row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),sha(JSON.stringify(current.requested)),sha(JSON.stringify(current.applied)),sha(JSON.stringify(current.enemy))]);
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
   row.checks.gravityFixed&&=G.world.gravity.y===-9.81&&CONFIG.PHYSICS.gravity===-9.81;
   row.checks.ordinaryModels&&=G.combat.cutReactionModel==='legacy'&&G.combat.cutReactionFighter===null&&G.ai2===null&&!G.enemy.rollTargetModel&&G.player.rollTargetModel===(mode==='boundedRoll'?'bounded':undefined)&&!G.player.edgeIntentModel&&!G.player.thrustEdgeModel;
   const f=G.player,q=new THREE.Quaternion().copy(f.sword.rotation()),axis=new THREE.Vector3(0,1,0).applyQuaternion(q),flat=new THREE.Vector3(0,0,1).applyQuaternion(q),velocity=new THREE.Vector3().copy(f.sword.velocityAtPoint(f.bladePoint(.7,new THREE.Vector3()))),transverse=velocity.clone().projectOnPlane(axis),command=new THREE.Vector3(...(pre?.commandVelocity??[0,0,0])).projectOnPlane(axis);
   const normal=new THREE.Vector3().crossVectors(axis,transverse),commandNormal=new THREE.Vector3().crossVectors(axis,command),planeError=n=>n.lengthSq()>1e-12?Math.acos(Math.min(1,Math.abs(flat.dot(n.normalize())))):null;
   row.metrics.push({tick,phase:current.phase,localTick:current.localTick,pre,actual:{tipSpeedMps:norm(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))),midSpeedMps:velocity.length(),transverseSpeedMps:transverse.length(),commandSignedSpeedMps:command.lengthSq()>1e-12?transverse.dot(command.clone().normalize()):null,physicalEdgeErrorRad:planeError(normal),commandEdgeErrorRad:planeError(commandNormal),axialOmegaRadps:axis.dot(new THREE.Vector3().copy(f.sword.angvel())),swordKJ:snapshotWorld(G.world,{bodies:[f.sword]}).total.K,finalRequestedTorque:requestedTorque},state:selectedState(G)});
   if(!row.checks.finite)throw Error('Nonfinite native state');
   if(!f.alive||!f.armed||!f.gripJoint?.isValid()||!G.enemy.alive){row.terminal={tick,reason:!f.alive?'player_dead':!f.armed||!f.gripJoint?.isValid()?'player_unarmed':'enemy_dead',phase:current.phase};break;}
  }
 }catch(e){row.error={name:e.name,message:e.message,stack:e.stack};}
 finally{
  if(G){row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.finalStates=[health(G.player),health(G.enemy)];}
  G?.eventQueue.free();G?.world.free();const file=path.join(out,mode+'.json');fs.writeFileSync(file,JSON.stringify(row)+'\n');row.artifact={path:file,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))};
  console.log(JSON.stringify({mode,steps:row.steps,stepCalls:row.stepCalls,touchStart:row.touchStartTick,firstGoal:row.firstGoalChangeTick,firstQualifiedContact:row.firstQualifiedContactTick,terminal:row.terminal,error:row.error}));
 }
}
try{await run('legacy');if(rows[0].error||baselineTouchStart===null)throw Error('Baseline fixture did not provide a valid approach');await run('boundedRoll');}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 Math.random=random;process.off('SIGINT',interrupted);process.off('SIGTERM',interrupted);
 const a=rows[0],b=rows[1],n=a&&b?Math.min(a.frames.length,b.frames.length):0,firstDifferent=k=>a.frames.slice(0,n).findIndex((f,i)=>f[k]!==b.frames[i][k]);
 const comparison=a&&b?{sameCreation:a.creationNativeSHA256===b.creationNativeSHA256&&a.creationControlSHA256===b.creationControlSHA256,commonSteps:n,tapeStartTicks:[a.touchStartTick,b.touchStartTick],sameTouchStart:a.touchStartTick===b.touchStartTick,firstGoalChangeTick:b.firstGoalChangeTick,changedGoalFrames:b.changedGoalFrames,
  firstNativeDifference:firstDifferent(1),firstControlDifference:firstDifferent(2),firstRequestedInputDifference:firstDifferent(3),firstAppliedInputDifference:firstDifferent(4),firstEnemyInputDifference:firstDifferent(5),
  prefixBeforeFirstGoalExact:b.firstGoalChangeTick===null?null:a.frames.slice(0,b.firstGoalChangeTick).every((f,i)=>JSON.stringify(f)===JSON.stringify(b.frames[i])),qualifiedContactTicks:[a.firstQualifiedContactTick,b.firstQualifiedContactTick]}:null;
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&rows.length===2&&rows.every(r=>!r.error&&Object.values(r.checks).every(Boolean))&&comparison.sameCreation&&comparison.sameTouchStart&&comparison.firstRequestedInputDifference===-1&&comparison.firstAppliedInputDifference===-1&&(comparison.firstGoalChangeTick===null?comparison.firstNativeDifference===-1:comparison.prefixBeforeFirstGoalExact);
 const report={schemaVersion:1,head:source.head,source,sourceBefore,sourceAfter,sourceStable,measurementValid,effectAccepted:false,error,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionCount:rows.length,stepCalls:rows.reduce((s,r)=>s+r.stepCalls,0),completedSteps:rows.reduce((s,r)=>s+r.steps,0),command:process.argv,observer:{originalSHA256:observer.originalSHA256,transformedSHA256:observer.transformedSHA256},comparison,
  protocol:{gravity:9.81,dt:DT,seed:7,weapons:['longsword','zweihander'],gapM:5.6,startLockSteps:240,baselineApproach:'Normal forward joystick until actual pelvis distance<=2.8m, maximum720steps; candidate replays baseline absolute touch start with identical requested input.',schedule,tapeLength:444,limiter:'Selected before first physical step for player only. Completed legacy roll target only; command-point helper observes and does not select a plane.',stop:'Full tape including release while player alive/armed/grip-valid and enemy alive; otherwise preserve first terminal state. No new fixture/seed search.',limits:['Ordinary legacy contact response; no centerline mixture.','Conditional baseline approach defines one fixed replay input, not equal physical contact states after candidate intervention.','Reactive opponent input may diverge; later wounds, impact energy and victories are not matched-impact causal effects.','Requested and applied input hashes are separate. Human touch pattern at120Hz is not browser timing/phone naturalness.','Lower target slew or axial peak alone is not gameplay acceptance.']},rows:rows.map(r=>({mode:r.mode,steps:r.steps,stepCalls:r.stepCalls,artifact:r.artifact,checks:r.checks,firstGoalChangeTick:r.firstGoalChangeTick,changedGoalFrames:r.changedGoalFrames,touchStartTick:r.touchStartTick,firstQualifiedContactTick:r.firstQualifiedContactTick,qualifiedContacts:r.qualifiedContacts,terminal:r.terminal,error:r.error}))};
 const file=path.join(out,'report.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({path:file,sha256:sha(fs.readFileSync(file)),bytes:fs.statSync(file).size,measurementValid,executionCount:report.executionCount,stepCalls:report.stepCalls,completedSteps:report.completedSteps},null,2)+'\n');if(!measurementValid)process.exitCode=1;
}
