// Phase 3: actual native contacts. --freeze copies runtime unchanged outside Git;
// natural uses ordinary input, down declares knockdown/hold/initial impulse.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return[x.slice(2,i),x.slice(i+1)];}));
const own='tools/sim/experiments/phase3_finish_contact_20261007.mjs';
if(args.freeze){
 assert(path.isAbsolute(args.freeze)&&!fs.existsSync(args.freeze));
 const base=args.base??root,overrides=new Set([own,...(args.patch??'').split(',').filter(Boolean)]);
 const origin=n=>overrides.has(n)?root:base;
 const scan=p=>fs.readdirSync(path.join(base,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
 const names=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',own];
 const deps=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
 const hashes=dir=>Object.fromEntries([...names,...deps].sort().map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))]));
 const selected=()=>Object.fromEntries([...names,...deps].sort().map(n=>[n,sha(fs.readFileSync(path.join(origin(n),n)))]));
 const before=selected();for(const n of names){fs.mkdirSync(path.dirname(path.join(args.freeze,n)),{recursive:true});fs.copyFileSync(path.join(origin(n),n),path.join(args.freeze,n));}
 fs.symlinkSync(path.join(base,'node_modules'),path.join(args.freeze,'node_modules'),'dir');assert.deepEqual(selected(),before);assert.deepEqual(hashes(args.freeze),before);
 fs.writeFileSync(path.join(args.freeze,'SOURCE.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),createdUTC:new Date().toISOString(),runtimeUnmodified:!args.patch,base:base,patches:[...overrides].filter(n=>n!==own),files:before},null,2)+'\n');console.log(args.freeze);process.exit(0);
}
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const manifest=()=>Object.fromEntries(Object.keys(source.files).map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
assert.deepEqual(manifest(),source.files);
const [{newRound,THREE,DT,CONFIG},{applySwordsmanship,recordSwordsmanshipInput},{configureCombatDefaults},{CHARACTERS_BY_ID},{LOOKS}]=await Promise.all([import('../harness_m.mjs'),import('../../../src/swordsmanship.js'),import('../../../src/combat_defaults.js'),import('../../../src/characters.js'),import('../../../src/looks.js')]);
const candidateModel=args.candidate??'armorCausal';
assert(['armorCausal','armorGuard'].includes(candidateModel));
const protocol=args.protocol??'natural',out=args.out;assert(['natural','down'].includes(protocol));assert(path.isAbsolute(out)&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const started=performance.now(),startedUTC=new Date().toISOString(),rows=[];
const health=f=>({alive:f.alive,armed:f.armed,state:f.state,blood:f.blood,consciousness:f.consciousness,daze:f.daze,pain:f.pain,balance:f.balance,wounds:f.wounds.length,bleed:f.bleed,cloth:{...f.cloth},plate:{...f.plate},helmetIntegrity:f.helmetIntegrity,hasHelmet:f.hasHelmet,cause:f.causeOfDeath??null});
const small=r=>r?Object.fromEntries(['type','zone','energy','ephys','mFree','mEff','eff','thr','bareThreshold','severity','pass','finish','armorBlocked','armorGuarded','finishRuleReason','plate','helmet','speed','t','helmetBlunt'].map(k=>[k,r[k]])):null;
const ctl=f=>({health:health(f),hand:f.handOffset.toArray(),move:f.move.toArray(),held:f.handHeld,active:f.inputActive,tap:f.skill.tap?{down:f.skill.tap.down,go:f.skill.tap.go,t:f.skill.tap.t}:null,push:f.skill.thrustPush,finish:f.finish.on});
const torsoDist=(p,e)=>Math.min(...['chest','abdomen','pelvis'].map(k=>{const a=p.bodies.chest.translation(),b=e.bodies[k].translation();return Math.hypot(a.x-b.x,a.z-b.z);}));
function shadows(C,pr,point){const m=C.finishRuleModel,S=pr.w.fighter.cache?.sword,P=pr.v.fighter.cache?.parts[pr.v.part];if(!S||!P)return null;try{C.finishRuleModel='legacy';const legacy=C.analyze(pr,point,S,P,true);C.finishRuleModel=candidateModel;const candidate=C.analyze(pr,point,S,P,true),actualCandidate=C.analyze(pr,point,S,P,false);return{legacy:small(legacy),candidate:small(candidate),actualCandidate:small(actualCandidate)};}finally{C.finishRuleModel=m;}}
for(const weapon of (args.weapons??'longsword,rapier').split(','))for(const armor of (args.armors??'none,plate').split(',')){
 let tape=null;
 for(const model of ['legacy',candidateModel]){
 const row={weapon,armor,model,protocol,steps:0,firstPolicyIntervention:null,firstPredictedIntervention:null,taps:[],downEvents:[],contacts:[],predictions:[],rebounds:[],applications:[],native:[],inputs:[],frames:[],terminal:null,models:null};rows.push(row);let G,tick=0,lastDown=false,tapAt=-1000,approachDone=null,cutStarted=null,terminalTick=null;
 try{
 G=newRound({seed:7,weapon,weapon2:'longsword',gap:protocol==='natural'?5.6:2.4,walls:false,look2:armor==='plate'?CHARACTERS_BY_ID.heinrich.look:LOOKS.enemy,onFighter:f=>{f.onehandArmModel='legacy';if(f.index===0){f.onehandArmModel='manual';const d=configureCombatDefaults({active:true},f.weapon);f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;}}});
 const f=G.player,e=G.enemy,C=G.combat;assert(applySwordsmanship(f));assert.equal(f.skill.autoGuard,false);f.canShove=true;C.cutReactionModel='centerline';C.cutReactionFighter=f;C.finishRuleModel=model;C.finishRuleFighter=f;
 row.models={player:[f.onehandArmModel,f.stanceMemoryModel,f.rollTargetModel,f.swordsmanshipModel],enemy:[e.onehandArmModel,e.stanceMemoryModel??'legacy',e.rollTargetModel??'legacy'],cut:C.cutReactionModel,finish:model,finishPlayerOnly:C.finishRuleFighter===f,autoGuard:f.skill.autoGuard,skillLevel:f.skill.level,limb:CONFIG.COMBAT.limbSeverTrial,gravity:G.world.gravity.y,emotion:'harness player neutral; opponent ordinary AI emotion'};
 assert.deepEqual(row.models.player,['manual','fresh','bounded','unified']);assert(row.models.limb);assert.equal(row.models.gravity,-9.81);
 if(protocol==='down'){G.ai.update=()=>{e.move.set(0,0);};e.knockDown(true);e.downTime=1e9;row.preparation='At creation enemy knockDown(true), downTime=1e9, enemy AI input idle; chest/head 40 Ns per body (80 Ns combined) toward player over initial .25s. No position/velocity/wound assignment.';}
 row.spawnSHA256=sha(G.world.takeSnapshot());
 const worldStep=G.world.step;G.world.step=function(...a){const r=worldStep.apply(this,a);row.native.push([tick,sha(this.takeSnapshot())]);return r;};
 const apply=e.applyWound;e.applyWound=function(r){const before=health(this),ret=apply.call(this,r);row.applications.push({tick,result:small(r),before,after:health(this)});return ret;};
 const rebound=C.rebound;C.rebound=function(pr,...a){const prior=this.lastRebound,before=health(pr.v.fighter),velocityBefore={sword:pr.w.body.linvel(),body:pr.v.body.linvel()},ret=rebound.call(this,pr,...a);if(pr.w.fighter===f)row.rebounds.push({tick,part:pr.v.part,before,after:health(pr.v.fighter),velocityBefore,velocityAfter:{sword:pr.w.body.linvel(),body:pr.v.body.linvel()},assigned:prior!==this.lastRebound,rebound:prior!==this.lastRebound?{...this.lastRebound}:null});return ret;};
 const predict=C.predict;C.predict=function(pr){const r=predict.call(this,pr);if(pr.w.fighter===f&&r){const old=this.finishRuleModel;this.finishRuleModel=candidateModel;const b=predict.call(this,pr);this.finishRuleModel=old;const ev={tick,part:pr.v.part,result:small(r),candidate:small(b)};if(b?.armorBlocked||b?.armorGuarded){row.firstPredictedIntervention??=tick;row.predictions.push(ev);}else if(r.finish)row.predictions.push(ev);}return r;};
 const strike=C.strike;C.strike=function(pr,p,passing){const before=health(pr.v.fighter),sc=shadows(this,pr,p),eligible=!!(sc?.legacy?.finish),cool=pr.v.fighter.hitCooldowns.has(`${pr.w.fighter.index}:${pr.v.part}`),beforeState=ctl(pr.w.fighter);const r=strike.call(this,pr,p,passing);
 if(pr.w.fighter===f&&(r||eligible)){const change=!!(sc?.legacy?.finish&&!sc.candidate?.finish);if(change&&!cool)row.firstPolicyIntervention??=tick;row.contacts.push({tick,attacker:pr.w.fighter.index,part:pr.v.part,point:p.toArray(),passing,cool,eligible,policyWouldChange:change,before,attackerBefore:beforeState,shadow:sc,actual:small(r),after:health(pr.v.fighter)});}return r;};
 G.before=()=>{
 const d=torsoDist(f,e);let req;
 if(tape)req=tape[tick];else if(protocol==='natural'){
  const down=e.alive&&e.state==='down',canTap=down&&f.finish.on&&tick-tapAt>=144&&(!f.skill.tap);
  if(cutStarted===null&&tick>=240&&d<=2.0)cutStarted=tick;
  const phase=cutStarted===null?-1:(tick-cutStarted)%180;let dx=0,dy=0;
  if(!down&&phase>=0){if(phase<48){dx=-.48/48;dy=.65/48;}else if(phase>=66&&phase<96){dx=.56/30;dy=-.76/30;}else if(phase>=132&&phase<162){dx=-.08/30;dy=.11/30;}}
  req={dx,dy,held:true,stickY:tick<240?0:Math.max(-1,Math.min(1,(d-(down?.65:1.15))*2)),tap:canTap,phase:down?'natural-down':cutStarted===null?'approach':'cut-cycle'};
 }else{
  if(tick>=300&&approachDone===null&&Math.abs(d-.65)<.06)approachDone=tick;
  if(tick>=780&&approachDone===null)approachDone=tick;
  const ready=approachDone!==null&&tick>=approachDone+90;
  req={dx:0,dy:0,held:true,stickY:tick<300||approachDone!==null?0:Math.max(-.4,Math.min(.4,(d-.65)*2)),tap:ready&&row.taps.length===0&&!f.skill.tap,phase:ready?'controlled-tap':tick<300?'settle':'approach'};
 }
 assert(req,'Baseline tape exhausted');row.inputs.push(req);
 if(protocol==='down'&&tick<30)for(const k of ['chest','head'])e.bodies[k].applyImpulse({x:-40*DT*4,y:0,z:0},true);
 const allowed=f.alive&&f.armed,active=Math.abs(req.dx)+Math.abs(req.dy)>1e-8;if(allowed){f.handOffset.x+=req.dx;f.handOffset.y+=req.dy;}f.handHeld=req.held;f.inputActive=active;assert(recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:allowed?req.dx:0,dy:allowed?req.dy:0,held:req.held,active}));f.move.set(0,f.alive?req.stickY:0);f.stickX=0;f.stickY=f.alive?req.stickY:0;
 if(req.tap){const accepted=f.skill.thrust();tapAt=tick;row.taps.push({tick,accepted,down:!!f.skill.tap?.down,finishOn:f.finish.on,distance:d,player:health(f),enemy:health(e)});}
 };
 const limit=tape?tape.length:protocol==='natural'?3000:1320;
 for(tick=0;tick<limit;tick++){G.step();row.steps++;const down=e.state==='down';if(down&&!lastDown)row.downEvents.push({tick,enemy:health(e)});lastDown=down;row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify([ctl(f),ctl(e)])),sha(JSON.stringify(row.inputs[tick]))]);if(terminalTick===null&&(!f.alive||!f.armed||!e.alive)){terminalTick=tick;row.terminal={tick,reason:!f.alive?'player_dead':!f.armed?'player_unarmed':'enemy_dead'};}if(!tape&&terminalTick!==null&&(protocol==='natural'||tick>=terminalTick+120))break;}
 row.terminal??={tick:row.steps-1,reason:tape?'paired_tape_end':'time_limit'};row.final={player:health(f),enemy:health(e)};if(!tape)tape=row.inputs;
 }catch(err){row.error={message:err.message,stack:err.stack};}finally{G?.eventQueue.free();G?.world.free();const file=path.join(out,`${weapon}-${armor}-${model}.json`);fs.writeFileSync(file,JSON.stringify(row)+'\n');row.artifact={path:file,sha256:sha(fs.readFileSync(file)),bytes:fs.statSync(file).size};console.log(JSON.stringify({weapon,armor,model,steps:row.steps,downs:row.downEvents.length,taps:row.taps.length,contacts:row.contacts.length,eligible:row.contacts.filter(c=>c.eligible).length,policy:row.firstPolicyIntervention,predicted:row.firstPredictedIntervention,terminal:row.terminal,error:row.error}));}
 }
}
const comparisons=[];for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1],n=Math.min(a.frames.length,b.frames.length),boundary=Math.min(a.firstPolicyIntervention??n,b.firstPolicyIntervention??n),diff=k=>a.frames.slice(0,n).findIndex((r,j)=>r[k]!==b.frames[j][k]);comparisons.push({weapon:a.weapon,armor:a.armor,commonSteps:n,firstPolicyIntervention:boundary===n?null:boundary,firstNativeDifference:diff(1),firstControllerDifference:diff(2),firstRequestedDifference:diff(3),sameSpawn:a.spawnSHA256===b.spawnSHA256,prefixExact:a.frames.slice(0,boundary).every((r,j)=>r[1]===b.frames[j][1]&&r[2]===b.frames[j][2])});}
const sourceStable=JSON.stringify(manifest())===JSON.stringify(source.files),report={head:source.head,source,sourceStable,protocol,candidateModel,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,argv:process.argv,executionCount:rows.length,steps:rows.reduce((s,r)=>s+r.steps,0),comparisons,rows:rows.map(({frames,inputs,contacts,predictions,native,...r})=>({...r,inputSHA256:sha(JSON.stringify(inputs)),contacts:contacts.length,eligibleContacts:contacts.filter(c=>c.eligible).length,blockedContacts:contacts.filter(c=>c.policyWouldChange).length,predictions:predictions.length})),measurementValid:sourceStable&&rows.every(r=>!r.error)&&comparisons.every(c=>c.sameSpawn&&c.prefixExact&&c.firstRequestedDifference===-1)};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(!report.measurementValid)process.exitCode=1;
