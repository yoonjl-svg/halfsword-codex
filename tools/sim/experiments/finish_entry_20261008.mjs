// Native opt-in finish comparison; copied source, declared preparation, no pose injection.
// node tools/sim/experiments/finish_entry_20261008.mjs NEW_ABSOLUTE_OUTPUT [scenario,...]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=process.argv[2];
assert(out&&path.isAbsolute(out)&&!fs.existsSync(out)&&!out.startsWith(root));
const own='tools/sim/experiments/finish_entry_20261008.mjs',sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const names=[...scan('src'),own,'tools/sim/harness_m.mjs','package.json','package-lock.json'].sort();
const hashes=dir=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))]));
const source=hashes(root),frozen=path.join(out,'source');
for(const n of names){const p=path.join(frozen,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,n),p);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(frozen,'node_modules'),'dir');assert.deepEqual(hashes(root),source);assert.deepEqual(hashes(frozen),source);
const write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const load=n=>import(pathToFileURL(path.join(frozen,n)).href);
const [{newRound,DT,CONFIG},{applySwordsmanship,recordSwordsmanshipInput},{configureCombatDefaults},{CHARACTERS_BY_ID},{LOW_FINISH}]=await Promise.all([load('tools/sim/harness_m.mjs'),load('src/swordsmanship.js'),load('src/combat_defaults.js'),load('src/characters.js'),load('src/finish_entry.js')]);
const cases={high:{tap:256},low:{tap:498},kneel:{tap:681},ground:{ground:true},qinggang:{ground:true,weapon:'qinggang',gapGoal:.6},rapierPlate:{ground:true,weapon:'rapier',plate:true},broken:{ground:true,broken:true}};
const selected=(process.argv[3]??'high,low,kneel,ground,qinggang,rapierPlate').split(',');assert(selected.every(x=>cases[x]));
const protocol={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),source,limits:LOW_FINISH,settings:'Current ordinary player v2/manual/fresh/bounded, both linked/power, centerline player, gravity9.81, severOn, recovery sequence unset.',preparation:'high/low: enemy.knockDown(true) tick240, fixed tap tick256/498. kneel: enemy legF/B=.2 and knockDown(false) tick240, fixed tap681. Ground: enemy down from creation, downTime=1e9, enemy idle, chest/head 40Ns each toward player over first.25s; no position/velocity assignment. Player approaches to1.2m (qinggang .6m) via authored stick then one tap. Baseline input replayed exactly in candidate. Broken case uses game breakSword at tick300.',argv:process.argv};write('protocol.json',protocol);
const rows=[];
const compact=r=>r?Object.fromEntries(['type','zone','energy','eff','thr','severity','pass','finishingStrike','finishPower','armorBlocked'].map(k=>[k,r[k]])):null;
for(const name of selected){const spec=cases[name];let tape;
for(const model of ['legacy','low']){
 let G,tick=0,approachDone=null;const row={name,model,steps:0,frames:[],inputs:[],contacts:[],predictions:[],taps:[],error:null};rows.push(row);
 try{
 G=newRound({seed:7,weapon:spec.weapon??'longsword',weapon2:'longsword',gap:spec.ground?2.4:1.5,walls:false,...(spec.plate?{look2:CHARACTERS_BY_ID.heinrich.look}:{}),onFighter:f=>{f.armSupportModel='linked';f.finishEntryModel=model;if(f.index===0){f.onehandArmModel='manual';const d=configureCombatDefaults({active:true},f.weapon);f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;}}});
 const f=G.player,e=G.enemy,C=G.combat;assert(applySwordsmanship(f));f.canShove=true;C.cutReactionModel='centerline';C.cutReactionFighter=f;C.finishRuleModel='power';C.finishRuleFighter=null;G.ai.update=()=>e.move.set(0,0);
 assert(CONFIG.COMBAT.limbSeverTrial);assert.equal(CONFIG.PHYSICS.gravity,-9.81);
 if(spec.ground){e.knockDown(true);e.downTime=1e9;}
 row.spawn=sha(G.world.takeSnapshot());
 const analyze=C.analyze;C.analyze=function(pr,p,S,P,pred=false){const r=analyze.call(this,pr,p,S,P,pred);if(r&&pr.w.fighter===f){const item={tick,...compact(r),part:pr.v.part,foeState:e.state,tapDown:!!f.skill.tap?.down,tapGo:!!f.skill.tap?.go,push:f.skill.thrustPush,point:[p.x,p.y,p.z]};(pred?row.predictions:row.contacts).push(item);}return r;};
 const dist=()=>{const a=f.bodies.chest.translation();return Math.min(...['chest','abdomen','pelvis'].map(k=>{const b=e.bodies[k].translation();return Math.hypot(a.x-b.x,a.z-b.z);}));};
 G.before=()=>{
 if(!spec.ground&&tick===240){if(name==='kneel'){e.limbs.legF=.2;e.limbs.legB=.2;e.knockDown(false);}else e.knockDown(true);}
 if(spec.ground&&tick<30)for(const k of ['chest','head'])e.bodies[k].applyImpulse({x:-40*DT*4,y:0,z:0},true);
 if(spec.broken&&tick===300)f.breakWeapon();
 let req;
 if(tape)req=tape[tick];
 else if(!spec.ground)req={stickY:0,tap:tick===spec.tap};
 else{const d=dist();if(tick>=300&&approachDone===null&&(Math.abs(d-(spec.gapGoal??1.2))<.04||tick>=720))approachDone=tick;req={stickY:tick<300||approachDone!==null?0:Math.max(-.4,Math.min(.4,(d-(spec.gapGoal??1.2))*2)),tap:approachDone!==null&&tick===approachDone+90};}
 row.inputs.push(req);f.move.set(0,req.stickY);f.stickX=0;f.stickY=req.stickY;f.handHeld=false;f.inputActive=false;assert(recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:0,dy:0,held:false,active:false}));
 if(req.tap){const accepted=f.skill.thrust();row.taps.push({tick,accepted,down:!!f.skill.tap?.down,foeState:e.state,chestY:e.bodies.chest.translation().y,pelvisY:e.bodies.pelvis.translation().y,distance:dist(),on:f.finish.on,amt:f.finish.amt,canStart:f.finish.canStart});}
 };
 for(tick=0;tick<1320;tick++){
 G.step();row.steps++;const p=f.finish.plunge,tp=f.skill.tap;
 row.frames.push({tick,native:sha(G.world.takeSnapshot()),attackerState:f.state,foeState:e.state,chestY:e.bodies.chest.translation().y,pelvisY:e.bodies.pelvis.translation().y,on:f.finish.on,amt:f.finish.amt,canStart:f.finish.canStart,moveY:f.move.y,inside:p.inside,walk:p.walk,surfaceInside:p.surfaceInside,surfaceWalk:p.surfaceWalk,short:p.short,surfaceShort:p.surfaceShort,gaitActive:f.gait.active,stance:[f.gait.legs.F.stance,f.gait.legs.B.stance],tap:tp?{down:tp.down,t:tp.t,walking:!!tp.walking,go:!!tp.go,abort:!!tp.abort,ended:!!tp.ended,upDone:!!tp.upDone,lineDone:!!tp.lineDone,walkEnd:tp.walkEnd??null}:null});
 assert([f,e].every(x=>x.meshes.every(({rb})=>[rb.translation(),rb.rotation(),rb.linvel(),rb.angvel()].every(v=>Object.values(v).every(Number.isFinite)))));
 }
 row.final={states:[f.state,e.state],alive:[f.alive,e.alive],wounds:[f.wounds.length,e.wounds.length],tapPending:!!f.skill.tap};
 }catch(e){row.error=e.stack;}finally{try{G?.eventQueue.free();G?.world.free();}catch(e){row.cleanupError=e.message;}}
 row.summary={taps:row.taps,firstGo:row.frames.find(x=>x.tap?.go),firstAbort:row.frames.find(x=>x.tap?.abort),firstWalk:row.frames.find(x=>x.tap?.walking&&!x.tap.abort),zeroMoveWalkSteps:row.frames.filter(x=>x.tap?.walking&&!x.tap.abort&&x.moveY===0).length,finishingContacts:row.contacts.filter(x=>x.finishingStrike),final:row.final,error:row.error};
 write(name+'-'+model+'.json',row);if(!tape)tape=row.inputs;console.log(JSON.stringify({name,model,tap:row.taps,go:row.summary.firstGo?.tick,abort:row.summary.firstAbort?.tick,walk:row.summary.firstWalk?.tick,zeroMoveWalk:row.summary.zeroMoveWalkSteps,finishing:row.summary.finishingContacts.length,final:row.final,error:row.error}));
}}
assert.deepEqual(hashes(frozen),source);
const comparisons=[];for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1];comparisons.push({name:a.name,sameSpawn:a.spawn===b.spawn,sameRequestedInput:JSON.stringify(a.inputs)===JSON.stringify(b.inputs),firstNativeDifference:a.frames.findIndex((x,i)=>x.native!==b.frames[i]?.native)});}
const report={sourceStable:true,head:protocol.head,executionCount:rows.length,steps:rows.reduce((n,r)=>n+r.steps,0),comparisons,rows:rows.map(r=>({name:r.name,model:r.model,steps:r.steps,summary:r.summary,sha256:sha(fs.readFileSync(path.join(out,r.name+'-'+r.model+'.json')))})),executionPassed:rows.every(r=>!r.error)&&comparisons.every(c=>c.sameSpawn&&c.sameRequestedInput)};write('report.json',report);if(!report.executionPassed)process.exitCode=1;
