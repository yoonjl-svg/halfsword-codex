/** Current ordinary recovery -> manual recut. Existing low-guard protocol, no injury/state injection.
 * Freeze once, run observe once, then optional plain replay for observer equivalence.
 * --freeze=<fresh-runtime> | --out=<fresh-dir> [--mode=observe|plain --reference=<observe-report>]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(freeze|out|mode|reference)=(.+)$/.exec(x);assert(m);return[m[1],m[2]];}));
const sha=x=>createHash('sha256').update(x).digest('hex');
if(opts.freeze){
 assert(path.isAbsolute(opts.freeze)&&!fs.existsSync(opts.freeze));
 const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
 const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/round4_integrated_observer.mjs','tools/sim/experiments/phase3_recovery_integration_20261007.mjs'];
 const deps=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
 const hashes=base=>Object.fromEntries([...files,...deps].sort().map(p=>[p,sha(fs.readFileSync(path.join(base,p)))]));
 const before=hashes(root);
 for(const p of files){const q=path.join(opts.freeze,p);fs.mkdirSync(path.dirname(q),{recursive:true});fs.copyFileSync(path.join(root,p),q);}
 fs.symlinkSync(path.join(root,'node_modules'),path.join(opts.freeze,'node_modules'),'dir');
 assert.deepEqual(hashes(root),before);assert.deepEqual(hashes(opts.freeze),before);
 fs.writeFileSync(path.join(opts.freeze,'SOURCE.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,files:before,command:process.argv},null,2)+'\n');
 console.log(opts.freeze);
}else{
 const mode=opts.mode??'observe';assert(['observe','plain'].includes(mode));
 assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));
 const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
 const hashes=()=>Object.fromEntries(Object.keys(source.files).map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
 assert.deepEqual(hashes(),source.files);fs.mkdirSync(opts.out,{recursive:true});
 const refBytes=opts.reference?fs.readFileSync(opts.reference):null,ref=refBytes?JSON.parse(refBytes):null;
 if(mode==='plain')assert(ref?.pass&&ref.row.mode==='observe');
 const {newRound,AI,CONFIG}=await import('../harness_m.mjs');
 const {applySwordsmanship,recordSwordsmanshipInput}=await import('../../../src/swordsmanship.js');
 const {configureCombatDefaults}=await import('../../../src/combat_defaults.js');
 const {observedCutStep,plain,controls,selectedState,pairAnalysis,snapshotWorld}=await import('./round4_integrated_observer.mjs');
 const observer=mode==='observe'?await observedCutStep():null;
 const tape=[
  {phase:'raise-right',steps:84,target:[.42,.42],held:true,moveY:.30},
  {phase:'cut-left',steps:36,target:[-.40,-.42],held:true,moveY:.30},
  {phase:'hold-left',steps:24,held:true,moveY:0},
  {phase:'raise-left',steps:60,target:[-.40,.42],held:true,moveY:.20},
  {phase:'recut-right',steps:36,target:[.38,-.44],held:true,moveY:.20},
  {phase:'hold-right',steps:24,held:true,moveY:0},
  {phase:'release',steps:60,held:false,moveY:0},
 ];
 const tapeLength=tape.reduce((n,p)=>n+p.steps,0);assert.equal(tapeLength,324);
 function tapeAt(t){for(const p of tape){if(t<p.steps)return{...p,phaseTick:t};t-=p.steps;}return null;}
 const health=f=>({alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),state:f.state,pain:f.pain,blood:f.blood,bleed:f.bleed,consciousness:f.consciousness,limbs:{...f.limbs},wounds:f.wounds.length,detached:[...(f.detachedParts??[])]});
 const gait=g=>({active:g.active,started:g.started,legs:Object.fromEntries(Object.entries(g.legs).map(([k,l])=>[k,{N:l.N,Nf:l.Nf,stance:l.stance}]))});
 const result=r=>r?Object.fromEntries(['type','zone','part','energy','severity','pass','stuck','finish','speed','eff','thr','t'].map(k=>[k,r[k]])):null;
 const row={mode,steps:0,nativeSteps:0,frames:[],requests:[],woundCalls:[],feedback:[],entries:[],events:[],transitions:[],samples:[],firstHitTick:null,firstGetupTick:null,firstFreshTick:null,tapeStart:mode==='plain'?ref.row.tapeStart:null,terminal:null,maxPlayerJointGapM:0,checks:{finite:true,currentOrdinary:true,inputAccepted:true,playerAliveArmedGrip:true}};
 let G,tick=0,lastReaction=null,preCombatAlive=null,error=null,lastState=null,phaseOrigin=null,lastPhase=null;
 const savedRandom=Math.random,started=performance.now(),startedUTC=new Date().toISOString();
 try{
  G=newRound({seed:7,weapon:'zweihander',weapon2:'longsword',gap:5.6,walls:false,AIClass:AI,onFighter:f=>{
   if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);f.onehandArmModel='manual';f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;f.canShove=true;}
   if(!observer)return;
   const apply=f.applyWound;f.applyWound=function(h,...rest){const before=health(this),r=apply.call(this,h,...rest),after=health(this);row.woundCalls.push({tick,fighter:f.index,request:result(h),before,after});if(f.index===0&&h.energy>0&&row.firstHitTick===null)row.firstHitTick=tick;return r;};
   const enter=f.gait.enter;f.gait.enter=function(...args){
    const before=gait(this),reentry=!!this.started,r=enter.apply(this,args),after=gait(this);
    const effective=f.index===0&&reentry&&Object.values(before.legs).some(l=>l.Nf>0)&&Object.values(after.legs).every(l=>l.Nf===0);
    row.entries.push({tick,fighter:f.index,health:health(f),before,after,reentry,effective});
    if(effective&&row.firstFreshTick===null)row.firstFreshTick=tick;
    if(effective&&row.tapeStart===null&&row.firstGetupTick!==null&&f.alive&&f.armed&&f.gripJoint?.isValid()&&G.enemy.alive)row.tapeStart=tick+1;
    return r;
   };
  }});
  assert(!G.ai2);assert(applySwordsmanship(G.player));
  const nativeStep=G.world.step;G.world.step=function(...args){const r=nativeStep.apply(this,args);row.nativeSteps++;return r;};
  const d=configureCombatDefaults({active:true},G.player.weapon);
  G.combat.cutReactionModel=d.cut;G.combat.cutReactionFighter=G.player;G.combat.finishRuleModel='legacy';G.combat.finishRuleFighter=G.player;
  row.spawnSHA256=sha(G.world.takeSnapshot());row.equipment={player:plain(G.player.look),enemy:plain(G.enemy.look)};
  if(observer){
   G.combat.afterStep=function(...args){preCombatAlive=[G.player.alive,G.enemy.alive];return observer.afterStep.apply(this,args);};
   G.combat.onCutReaction=r=>{lastReaction=r;};
   G.onWound=(att,vic,r)=>row.feedback.push({tick,attacker:att.index,victim:vic.index,result:result(r)});
   G.combat.p5ContactObserver=(stage,d)=>{
    if(stage==='before'){lastReaction=null;return{...d,cut:undefined,sw:undefined,vb:undefined,bodies:[d.sw,d.vb],tick,before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),budgetAfter:d.cut.Eleft,stuckAfter:d.cut.stuckT,stuck:!!d.cut.stuck,regime:d.budgetBefore>0?'drag':'stuck',victimAlive:d.cut.pr.v.fighter.alive,aliveAtCombatStart:preCombatAlive?.[d.victim],phase:row.requests.at(-1)?.phase,relativeTick:row.tapeStart===null?null:tick-row.tapeStart,owner:d.cut.pr.w.fighter.swordsmanshipState?.owner};}
    if(!d.token)return;const t=d.token,e={...t,bodies:undefined,pointV:lastReaction?t.pointA:t.legacyPointV,reaction:lastReaction,actualJ:lastReaction?lastReaction.J:t.J,after:snapshotWorld(G.world,{bodies:t.bodies})};e.analysis=pairAnalysis(e);row.events.push(e);
   };
  }
  const preparationOrigin=G.player.handOffset.toArray();
  G.before=()=>{
   const f=G.player,p=row.tapeStart!==null&&tick>=row.tapeStart?tapeAt(tick-row.tapeStart):null;
   const phase=p?.phase??(tick<72?'alber-lower':'alber-hold');
   if(phase!==lastPhase){phaseOrigin=f.handOffset.toArray();lastPhase=phase;}
   let dx=0,dy=0;if(!p&&tick<72){dx=(0-preparationOrigin[0])/72;dy=(-.5-preparationOrigin[1])/72;}
   if(p?.target){dx=(p.target[0]-phaseOrigin[0])/p.steps;dy=(p.target[1]-phaseOrigin[1])/p.steps;}
   const q=mode==='plain'?ref.row.requests[tick]:{dx,dy,held:p?.held??true,active:Math.abs(dx)+Math.abs(dy)>1e-5,stickY:p?.moveY??0,phase};assert(q);
   if(f.alive&&!f.weapon?.gun){f.handOffset.x+=q.dx;f.handOffset.y+=q.dy;}f.handHeld=q.held;f.inputActive=q.active;
   f.move.set(0,f.alive?q.stickY*(f.emoMods?.move??1):0);f.stickX=0;f.stickY=f.alive?q.stickY:0;
   const accepted=recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:f.alive?q.dx:0,dy:f.alive?q.dy:0,held:q.held,active:q.active});row.checks.inputAccepted&&=accepted;
   row.requests.push({...q,accepted});
  };
  const limit=mode==='plain'?ref.row.steps:3600+tapeLength;
  for(tick=0;tick<limit;tick++){
   if(mode==='observe'&&row.tapeStart===null&&tick>=3600){row.terminal={tick,reason:'no_qualifying_recovery_within_30s'};break;}
   if(mode==='observe'&&row.tapeStart!==null&&tick>=row.tapeStart+tapeLength){row.terminal={tick,reason:'fixed_tape_complete'};break;}
   G.step();row.steps++;
   row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify([controls(G.player),controls(G.enemy)])),sha(JSON.stringify({player:row.requests.at(-1),enemy:{active:G.enemy.inputActive,hand:G.enemy.handOffset.toArray(),move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}))]);
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));assert(row.checks.finite);
   row.checks.currentOrdinary&&=G.player.swordsmanshipModel==='unified'&&G.player.skill.level===0&&!G.player.skill.autoGuard&&G.player.stanceMemoryModel==='fresh'&&G.player.rollTargetModel==='bounded'&&G.combat.cutReactionModel==='centerline'&&G.combat.cutReactionFighter===G.player&&G.combat.finishRuleModel==='legacy'&&CONFIG.COMBAT.limbSeverTrial&&G.world.gravity.y===-9.81&&!G.ai2;
   row.checks.playerAliveArmedGrip&&=G.player.alive&&G.player.armed&&!!G.player.gripJoint?.isValid();
   const s=selectedState(G);row.maxPlayerJointGapM=Math.max(row.maxPlayerJointGapM,...s.fighters[0].gaps.map(g=>g.gapM));
   const key=JSON.stringify(s.fighters.map(f=>[f.state,f.alive,f.armed,f.gripValid,f.limbs,f.control.assist.owner]));
   if(key!==lastState)row.transitions.push({tick,...s});lastState=key;if(tick%60===0)row.samples.push({tick,...s});
   if(row.firstHitTick!==null&&G.player.state==='getup'&&row.firstGetupTick===null)row.firstGetupTick=tick;
   if(mode==='observe'&&(!G.player.alive||!G.player.armed||!G.player.gripJoint?.isValid()||!G.enemy.alive)){row.terminal={tick,reason:!G.player.alive?'player_dead':!G.player.armed||!G.player.gripJoint?.isValid()?'player_unarmed':'enemy_dead',afterRecovery:row.tapeStart!==null};break;}
  }
  row.finalHealth=[health(G.player),health(G.enemy)];row.finalControls=sha(JSON.stringify([controls(G.player),controls(G.enemy)]));
  if(mode==='plain'){
   row.equivalence={spawn:row.spawnSHA256===ref.row.spawnSHA256,frames:JSON.stringify(row.frames)===JSON.stringify(ref.row.frames),health:JSON.stringify(row.finalHealth)===JSON.stringify(ref.row.finalHealth),controls:row.finalControls===ref.row.finalControls};
   assert(Object.values(row.equivalence).every(Boolean),'Observer/plain replay differs');
  }
 }catch(e){error={name:e.name,message:e.message,stack:e.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[observed Combat source]')};}
 finally{G?.eventQueue.free();G?.world.free();Math.random=savedRandom;}
 const live=row.events.filter(e=>e.attacker===0&&e.reaction&&e.actualJ>0&&e.victimAlive&&e.aliveAtCombatStart&&row.tapeStart!==null&&e.tick>=row.tapeStart);
 row.exposure={hit:row.firstHitTick!==null,getup:row.firstGetupTick!==null,fresh:row.firstFreshTick!==null,manualLiveContact:live.length>0,liveContactSteps:live.map(e=>e.tick),fullTape:row.tapeStart!==null&&row.steps-row.tapeStart>=tapeLength};
 const sourceStable=JSON.stringify(hashes())===JSON.stringify(source.files);
 const pass=!error&&sourceStable&&row.checks.finite&&row.checks.currentOrdinary&&row.checks.inputAccepted;
 const report={pass,error,source,sourceStable,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,reference:refBytes?{path:opts.reference,bytes:refBytes.length,sha256:sha(refBytes)}:null,protocol:{seed:7,weapon:'zweihander',foe:'longsword/default normal AI',gapM:5.6,waitLimitSteps:3600,tape,tapeLength,scope:'Current ordinary from spawn. Same authored low-guard input protocol as phase2 recovery closure; actual hit/getup/fresh triggers fixed manual tape. Player emotion neutral. No injected injury/state/pose/AI/forces. Plain replays observed requests to isolate instrumentation. Measurement pass is distinct from exposure/efficacy.'},row};
 const file=path.join(opts.out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');
 console.log(JSON.stringify({pass,error:error?{name:error.name,message:error.message}:null,mode,steps:row.steps,nativeSteps:row.nativeSteps,firstHit:row.firstHitTick,getup:row.firstGetupTick,fresh:row.firstFreshTick,tapeStart:row.tapeStart,terminal:row.terminal,exposure:row.exposure,equivalence:row.equivalence,wallSeconds:report.wallSeconds,file}));if(!pass)process.exitCode=1;
}
