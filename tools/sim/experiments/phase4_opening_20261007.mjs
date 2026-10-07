/** Bounded character opening audit. Native harness; authored input proxy, not phone play.
 * --freeze=/fresh/source | --out=/fresh/results [--plain=episode-id --reference=report.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');assert(i>2);return[x.slice(2,i),x.slice(i+1)];}));
const sha=x=>createHash('sha256').update(x).digest('hex');
const own='tools/sim/experiments/phase4_opening_20261007.mjs';
if(args.freeze){
 assert(path.isAbsolute(args.freeze)&&!fs.existsSync(args.freeze));
 const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
 const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',own];
 const deps=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
 const hashes=d=>Object.fromEntries([...files,...deps].sort().map(f=>[f,sha(fs.readFileSync(path.join(d,f)))]));
 const before=hashes(root);
 for(const f of files){fs.mkdirSync(path.dirname(path.join(args.freeze,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(args.freeze,f));}
 fs.symlinkSync(path.join(root,'node_modules'),path.join(args.freeze,'node_modules'),'dir');
 assert.deepEqual(hashes(root),before);assert.deepEqual(hashes(args.freeze),before);
 fs.writeFileSync(path.join(args.freeze,'SOURCE.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),createdUTC:new Date().toISOString(),node:process.version,files:before},null,2)+'\n');
 console.log(args.freeze);process.exit(0);
}
assert(args.out&&path.isAbsolute(args.out)&&!fs.existsSync(args.out));
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const hashes=()=>Object.fromEntries(Object.keys(source.files).map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));assert.deepEqual(hashes(),source.files);
fs.mkdirSync(args.out,{recursive:true});
const [{newRound,DT,CONFIG,THREE},{applySwordsmanship,recordSwordsmanshipInput},{configureCombatDefaults},{CHARACTERS_BY_ID}]=await Promise.all([import('../harness_m.mjs'),import('../../../src/swordsmanship.js'),import('../../../src/combat_defaults.js'),import('../../../src/characters.js')]);
const observed=!args.plain,startedUTC=new Date().toISOString(),started=performance.now();
const protocol={seed:7,limitS:10,startGap:CONFIG.ARENA.startGap,startHold:CONFIG.ARENA.startHold,walls:true,player:'longsword',characters:['bran','isolde','margarethe'],modes:['wait','forward-gesture'],input:{wait:'No movement, held=false, dx=dy=0; ordinary v2 neutral ready guard.',forward:'After release at 2 s, fixed forward stickY=.28 until 4.5 s, then zero; no adaptive approach.',gesture:'At 3.00–3.30 s held=true, dx=.12/36 and dy=.08/36 per 120 Hz step; 3.30–3.60 s held=true, dx=-.24/36 and dy=-.16/36; held until 3.75 s, then release. Small authored relative gesture; no thrust tap/max-power input.'},limitations:['Authored proxy, not recorded human or real phone input.','Harness native simulation time excludes render-frame hitstop/slow motion and player frame-level emotion; enemy emotions are native AI.','Character base weapons selected explicitly; Bran random alternate weapon is not sampled.','Stop on first death, including Isolde first life; revival quality outside this opening scope.']};
const health=f=>({alive:f.alive,armed:f.armed,state:f.state,blood:f.blood,pain:f.pain,bleed:f.bleed,consciousness:f.consciousness,balance:f.balance,daze:f.daze,limbs:{...f.limbs},wounds:f.wounds.length,detached:[...(f.detachedParts??[])],cause:f.causeOfDeath??null});
const small=r=>Object.fromEntries(['type','zone','part','energy','severity','pass','stuck','finish','speed','thr'].map(k=>[k,r?.[k]]));
const rows=[];
for(const id of protocol.characters)for(const mode of protocol.modes){
 const episode=id+'-'+mode;if(args.plain&&args.plain!==episode)continue;
 const c=CHARACTERS_BY_ID[id],row={episode,id,mode,observed,character:{weapon:c.weapon,level:c.ai.level,persona:c.ai.persona,look:c.look,revive:c.revive??null},events:[],transitions:[],samples:[],first:{},aiCounts:{},timeByStateS:{},checks:{finite:true,currentOrdinary:true,inputAccepted:true},peak:[{omega:0,axial:0,tilt:0},{omega:0,axial:0,tilt:0}],falls:[0,0],steps:0};
 let G,tick=0,lastKey=null,lastStates=['stand','stand'];
 const timing=()=>({tick,timeS:G.t,fromReleaseS:G.t-CONFIG.ARENA.startHold});
 const distance=()=>{const a=G.player.bodies.chest.translation(),b=G.enemy.bodies.chest.translation();return Math.hypot(a.x-b.x,a.z-b.z);};
 const aiState=()=>({mode:G.ai.mode,phase:G.ai.phase,why:G.ai.why,tech:G.ai.tech?.name,distanceM:distance(),perceivedDistanceM:G.ai.d,contactM:G.ai.M.contact,needM:G.ai.need,patience:G.ai.patience,timer:G.ai.timer,attackT:G.ai.attackT,move:G.enemy.move.toArray(),state:G.enemy.state,feetHeld:G.enemy.feetHeld,playerState:G.player.state,pain:G.enemy.pain,tipSpeed:G.enemy.tipVel.length()});
 const emit=(kind,data)=>{const event={...timing(),kind,...data};if(row.events.length<160)row.events.push(event);row.aiCounts[kind]=(row.aiCounts[kind]??0)+1;return event;};
 const rngOriginal=Math.random;
 try{
  G=newRound({seed:7,weapon:'longsword',weapon2:c.weapon,look2:c.look,revive:c.revive,difficulty:c.ai.level,persona:c.ai.persona,onFighter:f=>{f.onehandArmModel='legacy';if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);f.onehandArmModel='manual';f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;f.canShove=true;}}});
  const f=G.player,e=G.enemy,C=G.combat;
  assert(applySwordsmanship(f));const d=configureCombatDefaults({active:true},f.weapon);C.cutReactionModel=d.cut;C.cutReactionFighter=f;C.finishRuleModel='legacy';C.finishRuleFighter=f;
  row.spawnSHA256=sha(G.world.takeSnapshot());row.initial=[health(f),health(e)];
  if(observed){
   for(const name of ['startAttack','startStrike','abortAttack','startWithdraw']){const fn=G.ai[name];G.ai[name]=function(...a){const before=aiState(),ret=fn.apply(this,a),ev=emit(name,{before,after:aiState(),result:ret});if(name==='startAttack'&&ret&&!row.first.attack)row.first.attack=ev;if(name==='startStrike'&&!row.first.strike)row.first.strike=ev;return ret;};}
   G.onWound=(att,vic,r)=>{const ev=emit('wound',{attacker:att.index,victim:vic.index,result:small(r),health:health(vic)});row.first.wound??=ev;};
   const clash=C.hooks.onClash;C.hooks.onClash=function(...a){const ev=emit('clash',{speed:a[1]});row.first.clash??=ev;return clash?.apply(this,a);};
  }
  const inputHash=createHash('sha256');
  G.before=()=>{
   const forward=mode==='forward-gesture',u=tick-360,held=forward&&tick>=360&&tick<450;
   const dx=forward&&u>=0&&u<36?.12/36:forward&&u>=36&&u<72?-.24/36:0;
   const dy=forward&&u>=0&&u<36?.08/36:forward&&u>=36&&u<72?-.16/36:0;
   const stickY=forward&&tick>=240&&tick<540?.28:0,active=Math.abs(dx)+Math.abs(dy)>1e-5;
   if(f.alive){f.handOffset.x+=dx;f.handOffset.y+=dy;}f.handHeld=held;f.inputActive=active;f.move.set(0,f.alive?stickY:0);f.stickX=0;f.stickY=stickY;
   const q={id:tick,timeS:G.t,dx,dy,held,active};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,q);inputHash.update(JSON.stringify({...q,stickY})+'\n');
  };
  for(tick=0;tick<Math.round(protocol.limitS/DT);tick++){
   G.step();row.steps++;
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));assert(row.checks.finite);
   row.checks.currentOrdinary&&=!G.ai2&&f.skill.level===0&&!f.skill.autoGuard&&f.swordsmanshipModel==='unified'&&f.onehandArmModel==='manual'&&f.stanceMemoryModel==='fresh'&&f.rollTargetModel==='bounded'&&C.cutReactionModel==='centerline'&&C.cutReactionFighter===f&&C.finishRuleModel==='legacy'&&CONFIG.COMBAT.limbSeverTrial&&G.world.gravity.y===-9.81;
   if(observed){
    const s=aiState(),key=[s.mode,s.phase,s.tech,s.state,s.feetHeld,s.playerState].join('/');
    if(key!==lastKey&&row.transitions.length<100)row.transitions.push({...timing(),...s});lastKey=key;
    if(tick%60===0&&row.samples.length<24)row.samples.push({...timing(),...s,health:[health(f),health(e)]});
    if(!e.feetHeld&&!row.first.release)row.first.release={...timing(),...s};
    if(!e.feetHeld&&e.move.y>.05&&!row.first.approach)row.first.approach={...timing(),...s};
    if(!e.feetHeld){const k=s.mode+'/'+s.phase+'/'+s.state;row.timeByStateS[k]=(row.timeByStateS[k]??0)+DT;}
    for(const [i,ff] of [f,e].entries()){
     const w=ff.sword.angvel(),axis=new THREE.Vector3(0,1,0).applyQuaternion(ff.sword.rotation()),up=new THREE.Vector3(0,1,0).applyQuaternion(ff.bodies.chest.rotation());
     row.peak[i].omega=Math.max(row.peak[i].omega,Math.hypot(w.x,w.y,w.z));row.peak[i].axial=Math.max(row.peak[i].axial,Math.abs(w.x*axis.x+w.y*axis.y+w.z*axis.z));row.peak[i].tilt=Math.max(row.peak[i].tilt,Math.acos(Math.max(-1,Math.min(1,up.y))));
     if(ff.state==='down'&&lastStates[i]!=='down')row.falls[i]++;lastStates[i]=ff.state;
    }
    if(!row.first.weaponContact){for(const ff of [f,e])for(const a of ff.swordColliders)G.world.contactPairsWith(a,b=>{const info=C.info.get(b.handle);if(!info?.fighter||info.fighter===ff)return;G.world.contactPair(a,b,m=>{let impulse=0,minDist=Infinity;for(let j=0;j<m.numContacts();j++){impulse+=m.contactImpulse(j);minDist=Math.min(minDist,m.contactDist(j));}if((impulse>0||minDist<=0)&&!row.first.weaponContact)row.first.weaponContact=emit('weaponContact',{attacker:ff.index,other:info.fighter.index,part:info.part,impulse,minDistance:minDist,distanceM:distance()});});});}
   }
   if(!f.alive||!e.alive){row.terminal={...timing(),reason:!f.alive?'player_dead':'enemy_dead'};break;}
  }
  row.terminal??={...timing(),reason:'10s_limit'};row.final=[health(f),health(e)];row.finalAI=aiState();row.stats={...G.ai.stats};row.clashes=G.clashes;row.wounds=G.wounds.map(w=>({timeS:w.t,fromReleaseS:w.t-CONFIG.ARENA.startHold,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity}));
  row.endSnapshotSHA256=sha(G.world.takeSnapshot());row.inputSHA256=inputHash.digest('hex');row.endControllerSHA256=sha(JSON.stringify({player:{hand:f.handOffset.toArray(),held:f.handHeld,move:f.move.toArray(),skillLevel:f.skill.level,owner:f.swordsmanshipState?.owner},enemy:{hand:e.handOffset.toArray(),held:e.handHeld,move:e.move.toArray()},ai:aiState(),health:row.final,stats:G.ai.stats}));
 }finally{G?.eventQueue.free();G?.world.free();Math.random=rngOriginal;}
 if(args.plain){const ref=JSON.parse(fs.readFileSync(args.reference)).rows.find(r=>r.episode===episode);row.equivalence=Object.fromEntries(['spawnSHA256','endSnapshotSHA256','inputSHA256','endControllerSHA256','steps'].map(k=>[k,row[k]===ref[k]]));assert(Object.values(row.equivalence).every(Boolean));}
 rows.push(row);fs.writeFileSync(path.join(args.out,episode+'.json'),JSON.stringify(row,null,2)+'\n');
 console.log(JSON.stringify({episode,steps:row.steps,first:Object.fromEntries(Object.entries(row.first).map(([k,v])=>[k,{timeS:v.timeS,fromReleaseS:v.fromReleaseS,tech:v.after?.tech}])),stats:row.stats,final:row.final.map(f=>({alive:f.alive,state:f.state,blood:f.blood,wounds:f.wounds})),equivalence:row.equivalence}));
}
const sourceStable=JSON.stringify(hashes())===JSON.stringify(source.files);assert(sourceStable);
const report={pass:sourceStable&&rows.every(r=>Object.values(r.checks).every(Boolean)),source,sourceStable,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,protocol,rows};
fs.writeFileSync(path.join(args.out,'report.json'),JSON.stringify(report,null,2)+'\n');assert(report.pass);console.log(JSON.stringify({pass:report.pass,episodes:rows.length,wallSeconds:report.wallSeconds,report:path.join(args.out,'report.json')}));
