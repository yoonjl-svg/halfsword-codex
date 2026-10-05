/** Two predeclared passive-to-manual actual-game recovery rows. No state injection. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {configureRecoveryContactV2Trial} from '../../../src/recovery_contact_v2_trial.js';
import {observedCutStep,plain,controls,selectedState,pairAnalysis,snapshotWorld,V,norm} from './round4_integrated_observer.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|fixture)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(args.out&&path.isAbsolute(args.out)&&!fs.existsSync(args.out));
const fixture=args.fixture??'passive';assert(['passive','helmet-duel'].includes(fixture));
const duel=fixture==='helmet-duel';
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const manifest=()=>Object.fromEntries(Object.keys(source.files).sort().map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest();assert.deepEqual(sourceBefore,source.files,'Frozen manifest');
assert.equal(CONFIG.PHYSICS.gravity,-9.81);assert.equal(CONFIG.GAIT.stanceMemory,'legacy');assert.equal(CONFIG.BODY.supportModel,'legacy');
fs.mkdirSync(args.out,{recursive:true});
const observer=await observedCutStep();
const tape=[
 {phase:'lower',steps:24,dx:0,dy:-.18,held:true},
 {phase:'raise',steps:36,dx:-.28,dy:.38,held:true},
 {phase:'cut',steps:30,dx:.56,dy:-.76,held:true},
 {phase:'hold',steps:24,dx:0,dy:0,held:true},
 {phase:'reverse',steps:36,dx:-.38,dy:.66,held:true},
 {phase:'hold2',steps:24,dx:0,dy:0,held:true},
 {phase:'recut',steps:30,dx:.40,dy:-.70,held:true},
 {phase:'release',steps:60,dx:0,dy:0,held:false},
];
const tapeLength=tape.reduce((n,p)=>n+p.steps,0);assert.equal(tapeLength,264);
function tapeAt(t){let start=0;for(const p of tape){if(t<start+p.steps)return{...p,dx:p.dx/p.steps,dy:p.dy/p.steps,relativeTick:t,phaseTick:t-start,moveY:t<204?.35:0};start+=p.steps;}return null;}
const gaitState=g=>({active:g.active,started:g.started,lev:g.lev,levH:g.levH,levC:g.levC,handU:g.handU,Nsum:g.Nsum,legs:Object.fromEntries(Object.entries(g.legs).map(([k,l])=>[k,Object.fromEntries(['stance','N','Nf','pinF','pinLim','soleY','toeY'].map(p=>[p,plain(l[p])]))]))});
const health=f=>({alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),state:f.state,blood:f.blood,pain:f.pain,limbs:{...f.limbs}});
const rows=[],startedUTC=new Date().toISOString(),started=performance.now(),savedRandom=Math.random;
let error=null,signal=null;const interrupt=()=>{signal='SIGINT';},terminate=()=>{signal='SIGTERM';};process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);

async function run(model){
 const config=configureRecoveryContactV2Trial(new URLSearchParams({recoveryContactV2:model}));
 assert(config.active&&config.weapon==='zweihander'&&config.foeWeapon==='longsword'&&config.stanceModel==='fresh');
 assert.equal(config.cutModel,model==='combined'?'centerline':'legacy');
 const row={key:model,fixture,config,steps:0,frames:[],metrics:[],entries:[],pinCalls:[],events:[],woundCalls:[],transitions:[],requests:[],firstHitTick:null,firstGetupAfterHitTick:null,firstEffectiveFreshTick:null,trigger:null,tapeStart:null,terminal:null,error:null,checks:{finite:true,gravityFixed:true,globalLegacy:true,onlyPlayer:true,inputAccepted:true,productionFreshClear:true}};
 rows.push(row);let G,tick=0,lastReaction=null,activePin=null,currentInput=null,prevHealth=null,preCombatAlive=null,prevPad=null;
 try{
  G=newRound({seed:7,weapon:config.weapon,weapon2:config.foeWeapon,gap:5.6,walls:false,AIClass:AI,AI2Class:duel?AI:undefined,sameLook:duel,onFighter:f=>{
   if(f.index===0){f.onehandArmModel='manual';f.stanceMemoryModel=config.stanceModel;f.canShove=true;}
   const wound=f.applyWound;f.applyWound=function(h,...rest){
    const before=health(this),result=wound.call(this,h,...rest),after=health(this);
    row.woundCalls.push({tick,timeS:G?.t??0,fighter:f.index,request:plain(h),before,after});
    if(f.index===0&&h.energy>0&&row.firstHitTick===null)row.firstHitTick=tick;
    return result;
   };
   const enter=f.gait.enter;f.gait.enter=function(...a){
    const before=gaitState(this),reentry=!!this.started,result=enter.apply(this,a),after=gaitState(this);
    const effective=f.index===0&&reentry&&Object.values(before.legs).some(l=>l.Nf>0)&&Object.values(after.legs).every(l=>l.Nf===0);
    if(f.index===0&&reentry)row.checks.productionFreshClear&&=Object.values(after.legs).every(l=>l.Nf===0);
    const entry={tick,timeBeforeStepS:G?.t??0,fighter:f.index,state:f.state,health:health(f),reentry,effective,before,after};row.entries.push(entry);
    if(effective&&row.firstEffectiveFreshTick===null)row.firstEffectiveFreshTick=tick;
    if(effective&&row.trigger===null&&row.firstGetupAfterHitTick!==null&&f.alive&&f.armed&&f.gripJoint?.isValid()&&G.enemy.alive){
     row.trigger={tick,firstHitTick:row.firstHitTick,getupTick:row.firstGetupAfterHitTick,player:health(f),enemy:health(G.enemy)};row.tapeStart=tick+1;
    }
    return result;
   };
   if(f.index!==0)return;
   const pin=f.gait.pinFeet;f.gait.pinFeet=function(...a){
    activePin={tick,before:gaitState(this),applied:[]};
    try{return pin.apply(this,a);}finally{activePin.after=gaitState(this);if(row.firstEffectiveFreshTick!==null&&tick<=row.firstEffectiveFreshTick+300)row.pinCalls.push(activePin);activePin=null;}
   };
   for(const leg of ['F','B']){const b=f.bodies['foot'+leg];for(const method of ['addForceAtPoint','addTorque']){const fn=b[method];b[method]=function(...a){if(activePin)activePin.applied.push({leg,method,vector:V(a[0]),point:method==='addForceAtPoint'?V(a[1]):null,magnitude:norm(a[0])});return fn.apply(this,a);};}}
  }});
  assert.equal(!!G.ai2,duel);assert(applySwordsmanship(G.player));prevPad=G.player.handOffset.clone();
  G.combat.cutReactionModel=config.cutModel;G.combat.cutReactionFighter=config.cutModel==='centerline'?G.player:null;G.combat.finishRuleModel='legacy';G.combat.finishRuleFighter=G.player;
  G.combat.onCutReaction=r=>{lastReaction=r;};
  G.combat.afterStep=function(...a){preCombatAlive=[G.player.alive,G.enemy.alive];return observer.afterStep.apply(this,a);};
  row.creationNativeSHA256=sha(G.world.takeSnapshot());row.creationControlSHA256=sha(JSON.stringify([controls(G.player),controls(G.enemy)]));row.equipment={player:plain(G.player.look),enemy:plain(G.enemy.look)};
  G.before=()=>{
   const f=G.player,p=row.tapeStart!==null&&tick>=row.tapeStart?tapeAt(tick-row.tapeStart):null;
   if(duel&&row.tapeStart===null){
    // Observe normal player AI only. Do not overwrite its pad, held, movement or tap.
    const delta=f.handOffset.clone().sub(prevPad);
    currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};
    const accepted=recordSwordsmanshipInput(f,currentInput);row.checks.inputAccepted&&=accepted;
    row.requests.push({...currentInput,accepted,phase:'preparation-ai',relativeTick:null,stickY:f.stickY,move:f.move.toArray(),emotionMove:f.emoMods?.move??1});return;
   }
   const dx=p?.dx??0,dy=p?.dy??0,held=p?.held??true,active=Math.abs(dx)+Math.abs(dy)>1e-5,rawMove=p?.moveY??0;
   if(f.alive&&!f.weapon?.gun){f.handOffset.x+=dx;f.handOffset.y+=dy;}f.handHeld=held;f.inputActive=active;
   f.move.set(0,f.alive?rawMove*(f.emoMods?.move??1):0);f.stickX=0;f.stickY=f.alive?rawMove:0;
   currentInput={id:tick,timeS:G.t,dx:f.alive&&!f.weapon?.gun?dx:0,dy:f.alive&&!f.weapon?.gun?dy:0,held,active};
   const accepted=recordSwordsmanshipInput(f,currentInput);row.checks.inputAccepted&&=accepted;
   row.requests.push({...currentInput,accepted,phase:p?.phase??'passive',relativeTick:p?.relativeTick??null,stickY:f.stickY,move:f.move.toArray(),emotionMove:f.emoMods?.move??1});
  };
  G.combat.p5ContactObserver=(stage,d)=>{
   if(stage==='before'){
    lastReaction=null;
    return{...d,tick,timeS:G.t,sw:undefined,vb:undefined,cut:undefined,bodies:[d.sw,d.vb],before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),budgetAfter:d.cut.Eleft,stuckAfter:d.cut.stuckT,stuck:!!d.cut.stuck,regime:d.budgetBefore>0?'drag':'stuck',victimAlive:d.cut.pr.v.fighter.alive,aliveAtCombatStart:preCombatAlive?.[d.victim],attackerArmed:d.cut.pr.w.fighter.armed,phase:row.requests.at(-1)?.phase,relativeTick:row.requests.at(-1)?.relativeTick,swinging:!!d.cut.pr.w.fighter.skill?.swinging,inputActive:!!d.cut.pr.w.fighter.inputActive};
   }
   if(d.token){const t=d.token,event={...t,bodies:undefined,pointV:lastReaction?t.pointA:t.legacyPointV,reaction:lastReaction,actualJ:lastReaction?lastReaction.J:t.J,after:snapshotWorld(G.world,{bodies:t.bodies})};event.analysis=pairAnalysis(event);row.events.push(event);if(lastReaction)assert.equal(event.attacker,0,'Candidate applied to opponent');}
  };
  for(tick=0;tick<3600+tapeLength;tick++){
   if(tick%120===0)await new Promise(r=>setImmediate(r));if(signal)throw Error('Interrupted; partial row preserved');
   if(row.tapeStart===null&&tick>=3600){row.terminal={tick,reason:'no_qualifying_recovery_within_30s'};break;}
   if(row.tapeStart!==null&&tick>=row.tapeStart+tapeLength){row.terminal={tick,reason:'fixed_tape_complete'};break;}
   if(duel&&row.tapeStart!==null&&tick===row.tapeStart){row.handover={tick,before:health(G.player),pad:G.player.handOffset.toArray(),aiPresent:!!G.ai2};G.ai2=null;prevPad.copy(G.player.handOffset);}
   G.step();prevPad.copy(G.player.handOffset);
   const frame=[tick,sha(G.world.takeSnapshot()),sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),sha(JSON.stringify({player:currentInput,enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}))];row.frames.push(frame);row.steps=row.frames.length;
   row.checks.gravityFixed&&=CONFIG.PHYSICS.gravity===-9.81&&G.world.gravity.y===-9.81;
   row.checks.globalLegacy&&=CONFIG.GAIT.stanceMemory==='legacy'&&CONFIG.BODY.supportModel==='legacy';
   const playerAIExpected=duel&&(row.tapeStart===null||tick<row.tapeStart);
   row.checks.onlyPlayer&&=G.player.stanceMemoryModel==='fresh'&&G.enemy.stanceMemoryModel!=='fresh'&&G.combat.cutReactionModel===config.cutModel&&(config.cutModel!=='centerline'||G.combat.cutReactionFighter===G.player)&&!!G.ai2===playerAIExpected;
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));assert(row.checks.finite,'Nonfinite state');
   const state=selectedState(G),h=JSON.stringify(state.fighters.map(f=>[f.state,f.alive,f.armed,f.gripValid,f.limbs,f.control.assist.owner]));
   if(h!==prevHealth)row.transitions.push({tick,...state});prevHealth=h;
   row.metrics.push({tick,...state,playerGait:gaitState(G.player.gait)});
   if(row.firstHitTick!==null&&G.player.state==='getup'&&row.firstGetupAfterHitTick===null)row.firstGetupAfterHitTick=tick;
   if(!G.player.alive||!G.player.armed||!G.player.gripJoint?.isValid()||!G.enemy.alive){
    row.terminal={tick,reason:!G.player.alive?'player_dead':!G.player.armed||!G.player.gripJoint?.isValid()?'player_unarmed':'enemy_dead',afterTrigger:row.trigger!==null};break;
   }
  }
 }catch(e){row.error={name:e.name,message:e.message,stack:e.stack};}
 finally{
  if(G){row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.finalStates=[controls(G.player),controls(G.enemy)];}
  G?.eventQueue.free();G?.world.free();
  const p=path.join(args.out,model+'.json');fs.writeFileSync(p,JSON.stringify(row)+'\n');row.artifact={path:p,bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))};
  console.log(JSON.stringify({key:model,steps:row.steps,firstHitTick:row.firstHitTick,firstGetupAfterHitTick:row.firstGetupAfterHitTick,firstEffectiveFreshTick:row.firstEffectiveFreshTick,tapeStart:row.tapeStart,terminal:row.terminal,events:row.events.length,error:row.error,checks:row.checks}));
 }
}
try{for(const model of ['baseline','combined']){await run(model);if(signal)break;}}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 Math.random=savedRandom;process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&rows.length===2&&rows.every(r=>!r.error&&Object.values(r.checks).every(Boolean));
 const a=rows[0],b=rows[1],firstCandidate=b?.events.find(e=>e.reaction&&e.actualJ>0)?.tick??null,firstBranch=b?.events.find(e=>e.reaction)?.tick??null;
 const firstDifference=column=>a.frames.find((f,i)=>b.frames[i]&&f[column]!==b.frames[i][column])?.[0]??null;
 const comparisons=a&&b?{creationNativeExact:a.creationNativeSHA256===b.creationNativeSHA256,creationControlExact:a.creationControlSHA256===b.creationControlSHA256,firstCandidateImpulseTick:firstCandidate,firstCandidateBranchTick:firstBranch,firstNativeDifference:firstDifference(1),firstControlDifference:firstDifference(2),firstInputDifference:firstDifference(3),firstFrameDifference:a.frames.find((f,i)=>b.frames[i]&&JSON.stringify(f)!==JSON.stringify(b.frames[i]))?.[0]??null,prefixBeforeFirstBranchExact:firstBranch===null?null:a.frames.slice(0,firstBranch).every((f,i)=>JSON.stringify(f)===JSON.stringify(b.frames[i]))}:null;
 const report={schemaVersion:1,head:source.head,source,sourceBefore,sourceAfter,sourceStable,measurementValid,error,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionCount:rows.length,steps:rows.reduce((s,r)=>s+r.steps,0),command:process.argv,observer:{originalSHA256:observer.originalSHA256,transformedSHA256:observer.transformedSHA256},protocol:{fixture,gravity:-9.81,dt:DT,seed:7,gapM:5.6,walls:false,sameLook:duel,preparationPlayerAI:duel,waitLimitSteps:3600,tape,tapeLength,scope:'Production helper, player v2/manual/fresh from spawn; normal enemy AI. Passive fixture holds still; helmet-duel observes normal player AI with an opponent using ordinary LOOKS.player equipment until actual hit/getup/effective fresh. Player AI is then removed before the next step, which begins fixed relative human-delta tape and normal forward joystick. No health/state/body transform injection. Relative start times may differ. Helmet opponent differs from public default enemy; no browser render-frame, hitstop or emotion-update equivalence claim.'},comparisons,rows:rows.map(r=>({key:r.key,fixture:r.fixture,config:r.config,steps:r.steps,artifact:r.artifact,checks:r.checks,firstHitTick:r.firstHitTick,firstGetupAfterHitTick:r.firstGetupAfterHitTick,firstEffectiveFreshTick:r.firstEffectiveFreshTick,trigger:r.trigger,tapeStart:r.tapeStart,handover:r.handover,terminal:r.terminal,error:r.error,events:r.events.length}))};
 const file=path.join(args.out,'report.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');const raw=fs.readFileSync(file);fs.writeFileSync(path.join(args.out,'receipt.json'),JSON.stringify({path:file,bytes:raw.length,sha256:sha(raw),measurementValid,executionCount:report.executionCount,steps:report.steps},null,2)+'\n');if(!measurementValid)process.exitCode=1;
}
