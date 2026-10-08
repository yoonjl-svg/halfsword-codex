/** Actual native comparison of the trailing-leg pose delay only.
 * --out=<fresh absolute directory> [--mode=natural|lying|side|hurt] [--models=off,on] [--seed=7]
 * The lag changes only B-leg targets; frozen SOURCE.json required.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { newRound, AI, CONFIG, DT, THREE } from '../harness_m.mjs';
import { floorObservation } from '../recovery_support_probe.mjs';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';
import { configureCombatDefaults } from '../../../src/combat_defaults.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(out|mode|models|seed)=(.+)$/.exec(x);assert(m);return[m[1],m[2]];}));
const seed=Number(opts.seed??7);assert(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff);
const models=(opts.models??'off,on').split(',');assert(models.length&&models.every(x=>['off','on'].includes(x)));
const mode=opts.mode??'natural';assert(['natural','lying','side','hurt'].includes(mode));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));fs.mkdirSync(opts.out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/recovery_support_probe.mjs','tools/sim/experiments/getup_sequence_20261009_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=hashes(),head=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'))).head;
const v3=v=>new THREE.Vector3(v.x,v.y,v.z);
const V=v=>[v.x,v.y,v.z],Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
function joint(j){
 const q=j.restInv.clone().multiply(Q(j.parent.rotation()).invert().multiply(Q(j.child.rotation()))).normalize();
 if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);
 const s=Math.hypot(q.x,q.y,q.z),a=2*Math.atan2(s,q.w);
 const relativeAngularVelocity=V(v3(j.child.angvel()).sub(v3(j.parent.angvel())).applyQuaternion(Q(j.parent.rotation()).invert()));
 return{relativeAngularVelocity,actualRestRelativeRotvec:s?V(new THREE.Vector3(q.x,q.y,q.z).multiplyScalar(a/s)):[0,0,0],targetQuaternion:j.target.toArray(),targetZRad:2*Math.atan2(j.target.z,j.target.w)};
}
function sample(G,f,tick){
 const parts=Object.fromEntries(Object.entries(f.bodies).map(([name,b])=>[name,{position:V(b.translation()),velocity:V(b.linvel()),angularVelocity:V(b.angvel()),floor:floorObservation(G.world,b)}]));
 const bodies=new Map(f.meshes.map(({rb})=>[rb.handle,rb]));if(f.sword)bodies.set(f.sword.handle,f.sword);
 const allFloor=[...bodies.values()].map(b=>({handle:b.handle,...floorObservation(G.world,b)}));
 const gaps=f.joints.map(j=>{const a=v3(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(v3(j.parent.translation())),b=v3(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(v3(j.child.translation()));return a.distanceTo(b);});
 return{maxJointGapM:Math.max(...gaps),tick,timeS:G.t,fighter:f.index,state:f.state,stateTime:f.stateTime,kneelAmount:f.kneelAmount,kneelAmountB:f.kneelAmountB??f.kneelAmount,kneelTime:f.kneelTime,riseTime:f.riseTime,muscle:f.muscle,crouch:f.crouch,stanceDrop:f.stanceDrop,footLoad:{...f.footLoad},balanceProbe:{...f.balanceProbe},gaitActive:f.gait.active,retainedGait:Object.fromEntries(Object.entries(f.gait.legs).map(([k,l])=>[k,{N:l.N,Nf:l.Nf,stance:l.stance,ankle:l.ankle?.toArray(),plant:l.plant?.toArray(),goal:l.goal?.toArray()}])),joints:Object.fromEntries(['thighF','shinF','footF','thighB','shinB','footB'].map(k=>[k,joint(f.jointByName[k])])),parts,allFloor,getupLeadDelay:!!f.getupLeadDelay,tilt:f.tiltDeg(),health:{alive:f.alive,limbs:{...f.limbs},blood:f.blood,pain:f.pain}};
}
class Passive{update(){}}
const savedRandom=Math.random;
async function run(model,reference){
 const observe=true;
 const r={model,observe,steps:0,nativeHashes:[],transitions:[],samples:[],wounds:[],firstGetup:null,firstStandAfterGetup:null,terminal:null};
 let G,tick=0,lastStates=null,prepared=false;
 try{
  G=newRound({seed,weapon:'zweihander',weapon2:'longsword',gap:5.6,walls:false,AIClass:mode==='natural'?AI:Passive,onFighter:f=>{
   f.armSupportModel='linked';f.onehandArmModel='legacy';f.getupLeadDelay=f.index===0&&model==='on';
   if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);f.onehandArmModel='manual';f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;f.canShove=true;}
   if(observe)f.balanceProbe={};
  }});
  assert(applySwordsmanship(G.player));
  const d=configureCombatDefaults({active:true},G.player.weapon);
  G.combat.cutReactionModel=d.cut;G.combat.cutReactionFighter=G.player;G.combat.finishRuleModel='power';G.combat.finishRuleFighter=null;
  r.policy={gravity:G.world.gravity.y,assist:CONFIG.GAIT.assist,supportModel:CONFIG.BODY.supportModel,footReaction:CONFIG.BODY.footReaction,finish:G.combat.finishRuleModel,cut:G.combat.cutReactionModel,cutFighter:G.combat.cutReactionFighter.index,fighters:[G.player,G.enemy].map(f=>({index:f.index,swordsmanship:f.swordsmanshipModel??null,stance:f.stanceMemoryModel??null,roll:f.rollTargetModel??null,armSupport:f.armSupportModel,arm:f.onehandArmModel,getupLeadDelay:!!f.getupLeadDelay}))};
  const origin=G.player.handOffset.toArray();
  G.before=()=>{
   const f=G.player,dx=tick<72?(0-origin[0])/72:0,dy=tick<72?(-.5-origin[1])/72:0;
   f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=true;f.inputActive=Math.abs(dx)+Math.abs(dy)>1e-5;f.move.set(0,0);f.stickX=0;f.stickY=0;
   assert(recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx,dy,held:true,active:f.inputActive}));
   if(mode!=='natural'&&!prepared&&tick===360){if(mode==='hurt')f.limbs.legF=.45;f.knockDown(true);f.bodies.chest.applyImpulse({x:mode==='side'?0:55,y:0,z:mode==='side'?55:0},true);prepared=true;}
  };
  const limit=mode==='natural'?2400:1800;
  for(tick=0;tick<limit;tick++){
   G.step();r.steps++;
   r.nativeHashes.push(sha(G.world.takeSnapshot()));
   const states=[G.player,G.enemy].map(f=>f.state).join(',');
   if(states!==lastStates)r.transitions.push({tick,timeS:G.t,states:[G.player.state,G.enemy.state],playerPelvis:V(G.player.bodies.pelvis.translation())});lastStates=states;
   if(G.player.state==='getup'&&r.firstGetup===null)r.firstGetup=tick;
   if(r.firstGetup!==null&&G.player.state==='stand'&&r.firstStandAfterGetup===null)r.firstStandAfterGetup=tick;
   if(observe&&(r.firstGetup!==null||G.player.state==='down'))r.samples.push(sample(G,G.player,tick));
   if(r.firstStandAfterGetup!==null&&tick>=r.firstStandAfterGetup+240){r.terminal='two_seconds_after_player_stand';break;}
   if(!G.player.alive||!G.enemy.alive){r.terminal='death';break;}
  }
  r.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity}));
 }finally{G?.eventQueue.free();G?.world.free();Math.random=savedRandom;}
 return r;
}
const startedUTC=new Date().toISOString(),started=performance.now(),cpuStart=process.cpuUsage();let error=null;const runs=[];
try{for(const model of models)runs.push(await run(model));}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
const sourceAfter=hashes();
const report={head,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,cpuSeconds:Object.fromEntries(Object.entries(process.cpuUsage(cpuStart)).map(([k,v])=>[k,v/1e6])),command:process.argv,mode,seed,sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),error,firstNativeDifference:runs.length===2?runs[0].nativeHashes.findIndex((h,i)=>runs[1].nativeHashes[i]!==h):null,runs,limitations:['Native Rapier game loop without renderer or render-frame emotion/hitstop equivalence.','Natural: authored low guard and actual opponent hits. Other modes: passive opponent, one knockDown(true) plus55Ns chest impulse at3s; hurt also assigns front-leg controller health .45. No body position/velocity assignment or native replacement.','Contact impulse/dt raw is not calibrated whole-body support. Contact arrays not matched by index.','Targets and balanceProbe describe last controller drive before native; contacts, positions and joint rotations are after native/Combat. Cached Gait data is not fresh while inactive.','Only player receives candidate. Both start independently from identical seed/input, then physical feedback may differ. Stand time is scheduled, not proof of sound weight transfer.']};
fs.writeFileSync(path.join(opts.out,'report.json.gz'),gzipSync(JSON.stringify(report)+'\n'));
const receipt={head,mode,seed,runs:runs.map(r=>({model:r.model,steps:r.steps,firstGetup:r.firstGetup,firstStand:r.firstStandAfterGetup,terminal:r.terminal,transitions:r.transitions,wounds:r.wounds})),firstNativeDifference:report.firstNativeDifference,sourceStable:report.sourceStable,error,wallSeconds:report.wallSeconds,cpuSeconds:report.cpuSeconds,out:opts.out};
fs.writeFileSync(path.join(opts.out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
if(error||!report.sourceStable)process.exitCode=1;
