import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {newRound,AI,DT,CONFIG,THREE} from './harness_m.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=process.argv[2]||'/tmp/grip-integration.json',files=['src/fighter.js','src/gait.js','src/combat.js','src/config.js','src/ai.js','src/weapons.js','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/grip_integration_probe.mjs'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(repo+'/'+p)).digest('hex')]));
const startWall=performance.now(),sourceBefore=hashes(),savedReaction=CONFIG.GRIP.reactionModel,randomBefore=Math.random;
const result={createdUTC:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),command:`node tools/sim/grip_integration_probe.mjs ${out}`,sourceBefore,protocol:{scenes:4,seed:17,dt:DT,settings:{weightMode:CONFIG.BODY.weightMode,assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale,limbSeverTrial:CONFIG.COMBAT.limbSeverTrial},duel:'actual AI normal on both actors; longsword vs zweihander, 30 seconds, no park/injury injection or early death exit',getup:'same force_default_trace hurt_getup: total8s, at3s player legF=.45 and knockDown(false); enemy parked, player has no AI',ledgerInstalled:false,scope:'Every frame finite state of all dynamic world bodies and world-transformed anatomical/sword-grip joint anchors; actual Combat wounds/clashes, live grip, fighter state changes. Contact manifolds sampled at10Hz as witnesses only. No human naturalness, balancing, or joint-gap acceptance threshold.'},rows:[]};
class Passive{update(){}}
const V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w);
function jointGap(j){const p=j.body1(),c=j.body2();const a=V(j.anchor1()).applyQuaternion(Q(p.rotation())).add(V(p.translation())),b=V(j.anchor2()).applyQuaternion(Q(c.rotation())).add(V(c.translation()));return a.distanceTo(b);}
try{for(const kind of ['ai_duel','hurt_getup'])for(const reaction of ['legacy','paired']){
 CONFIG.GRIP.reactionModel=reaction;const seconds=kind==='ai_duel'?30:8,frames=Math.round(seconds/DT),G=newRound({seed:17,walls:false,weapon:'longsword',weapon2:'zweihander',AIClass:kind==='ai_duel'?AI:Passive,AI2Class:kind==='ai_duel'?AI:null});
 const row={kind,reaction,seconds,frames:0,bothAI:kind==='ai_duel'&&G.ai instanceof AI&&G.ai2 instanceof AI,finite:true,exceptions:[],gripFrames:{player:0,enemy:0},transitions:[],maxAnchorGapByActor:{player:{},enemy:{}},unexpectedMissingJoints:[],contactWitnesses:{sampledFrames:0,weaponOpponentManifolds:0,positiveRawNormalImpulseManifolds:0},samples:[],walls:false};
 const sceneWall=performance.now(),trace=crypto.createHash('sha256');let previous=[G.player.state,G.enemy.state];
 try{
  if(kind==='hurt_getup')G.park();
  for(let i=0;i<frames;i++){
   if(kind==='hurt_getup'&&i===Math.round(3/DT)){G.player.limbs.legF=.45;G.player.knockDown(false);row.injury={timeS:i*DT,legF:.45,source:'synthetic limb function change; not collision injury'};}
   G.step();row.frames++;
   G.world.forEachRigidBody(b=>{if(b.isDynamic())for(const x of [b.translation(),b.rotation(),b.linvel(),b.angvel(),b.worldCom(),b.principalInertia()])if(!Object.values(x).every(Number.isFinite)){row.finite=false;row.nonfiniteFirst??={timeS:G.t,handle:String(b.handle)};}});
   for(const [a,f] of [['player',G.player],['enemy',G.enemy]]){
    if(f.gripping)row.gripFrames[a]++;
    for(const j of f.joints){if(!j.joint)continue;if(!G.world.getImpulseJoint(j.joint.handle)){if(!row.unexpectedMissingJoints.some(x=>x.actor===a&&x.name===j.name))row.unexpectedMissingJoints.push({actor:a,name:j.name,timeS:G.t});continue;}const gap=jointGap(j.joint);row.maxAnchorGapByActor[a][j.name]=Math.max(row.maxAnchorGapByActor[a][j.name]||0,gap);row.finite&&=Number.isFinite(gap);}
    if(f.armed&&G.world.getImpulseJoint(f.gripJoint.handle)){const gap=jointGap(f.gripJoint);row.maxAnchorGapByActor[a].swordGrip=Math.max(row.maxAnchorGapByActor[a].swordGrip||0,gap);row.finite&&=Number.isFinite(gap);}
   }
   const now=[G.player.state,G.enemy.state];for(let a=0;a<2;a++)if(now[a]!==previous[a])row.transitions.push({timeS:G.t,actor:a===0?'player':'enemy',from:previous[a],to:now[a]});previous=now;
   trace.update(JSON.stringify([G.player,G.enemy].map(f=>({state:f.state,health:f.blood,limbs:f.limbs,bodies:[...Object.values(f.bodies),f.sword].map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel(),b.mass()])}))));
   if(i%Math.round(.1/DT)===0){row.contactWitnesses.sampledFrames++;const seen=new Set();for(const att of [G.player,G.enemy])for(const col of att.bladeColliders||[])G.world.contactPairsWith(col,other=>{const vi=G.combat.info.get(other.handle);if(!vi||vi.fighter===att)return;const key=[String(col.handle),String(other.handle)].sort().join(':');if(seen.has(key))return;seen.add(key);G.world.contactPair(col,other,m=>{if(m.numContacts()>0)row.contactWitnesses.weaponOpponentManifolds++;let raw=0;for(let n=0;n<m.numContacts();n++)raw+=m.contactImpulse(n);if(raw>0)row.contactWitnesses.positiveRawNormalImpulseManifolds++;});});}
   if(i%120===0)row.samples.push({timeS:G.t,player:{state:G.player.state,blood:G.player.blood,armed:G.player.armed,gripping:G.player.gripping,pelvisY:G.player.bodies.pelvis.translation().y},enemy:{state:G.enemy.state,blood:G.enemy.blood,armed:G.enemy.armed,gripping:G.enemy.gripping,pelvisY:G.enemy.bodies.pelvis.translation().y},hits:G.hits.length,clashes:G.clashes});
  }
 }catch(e){row.exceptions.push({message:e.message,stack:e.stack,timeS:G.t});}
 row.wallSeconds=(performance.now()-sceneWall)/1000;row.traceSha256=trace.digest('hex');row.hits=G.hits.length;row.clashes=G.clashes;row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.name,victim:w.vic.name,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}));row.final=[G.player,G.enemy].map(f=>({name:f.name,state:f.state,blood:f.blood,limbs:{...f.limbs},armed:f.armed,gripping:f.gripping,actualWoundCount:f.wounds.length}));row.pass=row.finite&&!row.exceptions.length&&!row.unexpectedMissingJoints.length&&row.frames===frames;
 result.rows.push(row);G.eventQueue.free();G.world.free();Math.random=randomBefore;console.log(JSON.stringify({kind,reaction,pass:row.pass,frames:row.frames,hits:row.hits,clashes:row.clashes,gripFrames:row.gripFrames,wallSeconds:row.wallSeconds}));
}}finally{CONFIG.GRIP.reactionModel=savedReaction;Math.random=randomBefore;result.sourceAfter=hashes();result.sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(result.sourceAfter);result.totalWallSeconds=(performance.now()-startWall)/1000;result.pass=result.sourceStable&&result.rows.length===4&&result.rows.every(r=>r.pass);fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:result.pass,totalWallSeconds:result.totalWallSeconds,sourceStable:result.sourceStable,out}));process.exitCode=result.pass?0:1;}
