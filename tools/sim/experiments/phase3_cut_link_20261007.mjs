/** Current ordinary manual-cut replay. Observes actual strike/applyWound/drag.
 * Optional research-only refund changes just capped drag budget; never shipped.
 * --freeze=<fresh-runtime> then frozen script --out=<fresh-dir> --reference=<bounded-raw> [--mode=observe|refund|plain]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(freeze|out|reference|mode)=(.+)$/.exec(x);assert(m);return[m[1],m[2]];}));
const sha=x=>createHash('sha256').update(x).digest('hex');
if(opts.freeze){
 assert(path.isAbsolute(opts.freeze)&&!fs.existsSync(opts.freeze));
 const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
 const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/round4_integrated_observer.mjs','tools/sim/experiments/phase3_cut_link_20261007.mjs'];
 const deps=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
 const hashes=base=>Object.fromEntries([...files,...deps].sort().map(p=>[p,sha(fs.readFileSync(path.join(base,p)))]));
 const before=hashes(root);
 for(const p of files){const q=path.join(opts.freeze,p);fs.mkdirSync(path.dirname(q),{recursive:true});fs.copyFileSync(path.join(root,p),q);}
 fs.symlinkSync(path.join(root,'node_modules'),path.join(opts.freeze,'node_modules'),'dir');
 assert.deepEqual(hashes(root),before);assert.deepEqual(hashes(opts.freeze),before);
 fs.writeFileSync(path.join(opts.freeze,'SOURCE.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,files:before,command:process.argv},null,2)+'\n');
 console.log(opts.freeze);
}else{
 const mode=opts.mode??'observe';assert(['observe','refund','plain'].includes(mode));
 assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));assert(opts.reference);
 const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'))),hashes=()=>Object.fromEntries(Object.keys(source.files).map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
 assert.deepEqual(hashes(),source.files);fs.mkdirSync(opts.out,{recursive:true});
 const raw=fs.readFileSync(opts.reference),ref=JSON.parse(raw);assert.equal(ref.mode,'bounded');
 const {newRound,AI,CONFIG}=await import('../harness_m.mjs');
 const {applySwordsmanship,recordSwordsmanshipInput}=await import('../../../src/swordsmanship.js');
 const {configureCombatDefaults}=await import('../../../src/combat_defaults.js');
 const {observedCutStep,plain,controls,pairAnalysis,snapshotWorld}=await import('./round4_integrated_observer.mjs');
 const observer=mode==='plain'?null:await observedCutStep();
 const health=f=>({alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),state:f.state,pain:f.pain,blood:f.blood,bleed:f.bleed,consciousness:f.consciousness,limbs:{...f.limbs},wounds:f.wounds.length,detached:[...(f.detachedParts??[])],plate:{...f.plate},helmetIntegrity:f.helmetIntegrity});
 const summary=r=>r?Object.fromEntries(['type','zone','energy','ephys','severity','pass','stuck','finish','speed','quality','eff','thr','mEff','mFree','absorb','t'].map(k=>[k,r[k]])):null;
 const started=performance.now(),startedUTC=new Date().toISOString(),oldRandom=Math.random;
 let G,tick=0,serial=0,activeStrike=null,lastReaction=null,error=null;
 const row={weapon:ref.weapon,mode,steps:0,spawnSHA256:null,frames:[],strikes:[],woundCalls:[],feedback:[],resistance:[],episodeEnds:[],refunds:[],checks:{finite:true,inputAccepted:true,currentOrdinary:true},reference:{path:opts.reference,bytes:raw.length,sha256:sha(raw)}};
 try{
  G=newRound({seed:7,weapon:ref.weapon,weapon2:'zweihander',gap:5.6,walls:false,AIClass:AI,onFighter:f=>{if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);f.onehandArmModel='manual';f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;}}});
  // Assert the current ordinary policy before stepping the recorded input.
  assert.equal(G.player.rollTargetModel,'bounded');assert(applySwordsmanship(G.player));G.player.canShove=true;
  G.combat.cutReactionModel='centerline';G.combat.cutReactionFighter=G.player;G.combat.finishRuleModel='legacy';G.combat.finishRuleFighter=G.player;
  row.spawnSHA256=sha(G.world.takeSnapshot());assert.equal(row.spawnSHA256,ref.spawnSHA256,'Same recorded creation state');
  if(observer){
   G.combat.afterStep=observer.afterStep;G.combat.onCutReaction=r=>{lastReaction=r;};
   const strike=G.combat.strike;
   G.combat.strike=function(pr,point,passing){
    const id=serial++,previous=activeStrike;activeStrike=id;
    const before=health(pr.v.fighter),beforeCount=row.woundCalls.length,feedbackCount=row.feedback.length;
    try{const r=strike.call(this,pr,point,passing);row.strikes.push({id,tick,attacker:pr.w.fighter.index,victim:pr.v.fighter.index,key:`${pr.wc}:${pr.vc}`,part:pr.v.part,point:plain(point),passing,before,after:health(pr.v.fighter),result:summary(r),actualApplyCalls:row.woundCalls.length-beforeCount,feedbackCalls:row.feedback.length-feedbackCount});return r;}
    finally{activeStrike=previous;}
   };
   for(const f of [G.player,G.enemy]){const apply=f.applyWound;f.applyWound=function(h){const before=health(this);const result=apply.call(this,h);row.woundCalls.push({strikeId:activeStrike,tick,fighter:f.index,part:h.part,passing:h.passing,request:summary(h),before,after:health(this)});return result;};}
   const feedback=G.combat.hooks.onWound;
   G.combat.hooks.onWound=function(att,vic,r,...rest){const result=feedback.call(this,att,vic,r,...rest);row.feedback.push({strikeId:activeStrike,tick,attacker:att.index,victim:vic.index,result:summary(r),health:health(vic)});return result;};
   G.combat.p5ContactObserver=(stage,d)=>{
    if(stage==='before'){lastReaction=null;return{...d,cut:d.cut,bodies:[d.sw,d.vb],tick,phase:ref.inputs[tick].phase,before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),budgetAfterLegacy:d.cut.Eleft,stuckAfterLegacy:d.cut.stuckT,health:health(d.cut.pr.v.fighter),regime:d.budgetBefore>0?'drag':'stuck'};}
    if(!d.token)return;const t=d.token,r=lastReaction;
    if(mode==='refund'&&r&&t.budgetBefore>0&&r.J<t.J){
     const refund=(t.J-r.J)*t.s;t.cut.Eleft=t.budgetBefore-r.J*t.s;
     t.cut.stuckT=t.cut.Eleft<=1e-3&&t.cut.stuck?CONFIG.STRIKE.stuckTime:t.stuckBefore;
     row.refunds.push({tick,key:t.key,refund,legacyBudget:t.budgetAfterLegacy,budget:t.cut.Eleft,legacyTimer:t.stuckAfterLegacy,timer:t.cut.stuckT});
    }
    const e={tick:t.tick,phase:t.phase,key:t.key,part:t.part,attacker:t.attacker,victim:t.victim,health:t.health,regime:t.regime,stuck:t.cut.stuck,point:t.point,pointA:t.pointA,pointV:r?t.pointA:t.legacyPointV,dir:t.dir,s:t.s,J:t.J,actualJ:r?r.J:t.J,budgetBefore:t.budgetBefore,budgetAfter:t.cut.Eleft,budgetAfterLegacy:t.budgetAfterLegacy,stuckBefore:t.stuckBefore,stuckAfter:t.cut.stuckT,reaction:r,before:t.before,after:snapshotWorld(G.world,{bodies:t.bodies})};
    e.analysis=pairAnalysis(e);row.resistance.push(e);
   };
  }
  G.before=()=>{const f=G.player,q=ref.inputs[tick].requested,allowed=f.alive&&f.armed;
   if(allowed){f.handOffset.x+=q.dx;f.handOffset.y+=q.dy;}f.handHeld=q.held;f.inputActive=q.active;
   row.checks.inputAccepted&&=recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:allowed?q.dx:0,dy:allowed?q.dy:0,held:q.held,active:q.active});
   f.move.set(0,f.alive?q.stickY:0);f.stickX=0;f.stickY=f.alive?q.stickY:0;
  };
  for(tick=0;tick<ref.steps;tick++){
   const previous=[...G.combat.cutting].map(([key,c])=>({key,Eleft:c.Eleft,stuckT:c.stuckT,part:c.pr.v.part,applied:c.applied}));
   G.step();row.steps++;
   for(const e of previous)if(!G.combat.cutting.has(e.key))row.episodeEnds.push({tick,...e});
   row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify([controls(G.player),controls(G.enemy)])),sha(JSON.stringify({player:ref.inputs[tick].requested,enemy:{active:G.enemy.inputActive,hand:G.enemy.handOffset.toArray(),move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}))]);
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
   row.checks.currentOrdinary&&=G.player.skill.level===0&&!G.player.skill.autoGuard&&G.player.swordsmanshipModel==='unified'&&G.player.stanceMemoryModel==='fresh'&&G.player.rollTargetModel==='bounded'&&G.combat.cutReactionModel==='centerline'&&CONFIG.COMBAT.limbSeverTrial&&G.world.gravity.y===-9.81;
   assert(row.checks.finite,'Nonfinite dynamics');
  }
  row.finalHealth=[health(G.player),health(G.enemy)];row.firstOldNativeDifference=row.frames.findIndex((f,i)=>f[1]!==ref.frames[i]?.[1]);
 }catch(e){error={name:e.name,message:e.message,stack:e.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[observed Combat source]')};}
 finally{G?.eventQueue.free();G?.world.free();Math.random=oldRandom;}
 const sourceStable=JSON.stringify(hashes())===JSON.stringify(source.files);
 const pass=!error&&sourceStable&&Object.values(row.checks).every(Boolean)&&row.steps===ref.steps;
 const report={pass,error,source,sourceStable,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,observer:observer?{originalSHA256:observer.originalSHA256,transformedSHA256:observer.transformedSHA256}:null,protocol:'Recorded native03 bounded ordinary hand deltas/joystick; normal opponent AI, no body/health/wound/input outcome injection. Player harness emotion neutral. Actual strike, applyWound and feedback calls are distinct. No browser FX claim. Refund mode is isolated diagnostic, not production.',row};
 const file=path.join(opts.out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');
 console.log(JSON.stringify({pass,error:error?{name:error.name,message:error.message}:null,weapon:row.weapon,mode,steps:row.steps,firstOldNativeDifference:row.firstOldNativeDifference,strikes:row.strikes.length,woundCalls:row.woundCalls.length,feedback:row.feedback.length,resistance:row.resistance.length,cappedDrag:row.resistance.filter(e=>e.regime==='drag'&&e.reaction&&e.actualJ<e.J).length,refunds:row.refunds.length,wallSeconds:report.wallSeconds,file}));if(!pass)process.exitCode=1;
}
