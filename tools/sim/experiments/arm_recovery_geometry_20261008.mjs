/** Actual game recovery geometry: --out=<fresh absolute dir> --mode=natural|lying|side|hurt --weapon=... */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,THREE,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {configureCombatDefaults} from '../../../src/combat_defaults.js';
import {prepareMorgensternTrial} from '../../../src/morgenstern_trial.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(out|mode|weapon|observe|pose)=(.+)$/.exec(x);assert(m);return[m[1],m[2]]}));
const mode=opts.mode??'natural',weapon=opts.weapon??'zweihander',observe=opts.observe!=='false';
const pose=opts.pose??'low',pad={low:[0,-.5],high:[.15,.65],wide:[.6,.15],cross:[-.6,.15],home:[.15,.1],recoveryHigh:[0,-.5],reinput:[0,-.5]}[pose];assert(pad);
assert(['natural','lying','side','hurt'].includes(mode));assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));fs.mkdirSync(opts.out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/experiments/arm_recovery_geometry_20261008.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=hashes(),head=fs.existsSync(root+'SOURCE.json')?JSON.parse(fs.readFileSync(root+'SOURCE.json')).head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const V=p=>new THREE.Vector3(p.x,p.y,p.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const toChest=(f,p)=>p.clone().sub(V(f.bodies.chest.translation())).applyQuaternion(Q(f.bodies.chest.rotation()).invert());
function wrist(f,side){const b=f.bodies['farm'+side];return (side==='S'?new THREE.Vector3(.135,0,0):new THREE.Vector3(0,-.135,0)).applyQuaternion(Q(b.rotation())).add(V(b.translation()));}
function elbow(f,side){const b=f.bodies['uarm'+side];return (side==='S'?new THREE.Vector3(.15,0,0):new THREE.Vector3(0,-.15,0)).applyQuaternion(Q(b.rotation())).add(V(b.translation()));}
const measured=new WeakMap();let observationTick=-1;
function instrument(f){for(const side of ['S','O']){const key=side==='S'?'armIK':'offArmIK',original=f[key];let previous=null;f[key]=function(target){const local=toChest(this,target);const D=local.clone().sub(new THREE.Vector3(0,.1,this.side*(side==='S'?.2:-.2))).normalize();const pole=new THREE.Vector3(-.25,-1,this.side*(side==='S'?.5:-.5)).normalize();const poleProjection=pole.clone().addScaledVector(D,-pole.dot(D)).length();original.call(this,target);const jt=this.jointByName['uarm'+side].target;const info=measured.get(this)??{};info[side]={callTick:observationTick,requested:local.toArray(),solved:new THREE.Vector3(...(side==='S'?[.27,0,0]:[0,-.275,0])).applyQuaternion(this.jointByName['farm'+side].target).add(new THREE.Vector3(...(side==='S'?[.3,0,0]:[0,-.3,0]))).applyQuaternion(jt).add(new THREE.Vector3(0,.1,this.side*(side==='S'?.2:-.2))).toArray(),poleProjection,targetUpper:new THREE.Vector3(...(side==='S'?[1,0,0]:[0,-1,0])).applyQuaternion(jt).toArray(),targetStepRad:previous?previous.angleTo(jt):0};previous=jt.clone();measured.set(this,info);};}}
function sample(f,tick){const p=Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,{p:V(b.translation()).toArray(),q:Q(b.rotation()).toArray()}]));
 const arms={};for(const side of ['S','O']){const b=f.bodies['uarm'+side];const upper=new THREE.Vector3(...(side==='S'?[1,0,0]:[0,-1,0])).applyQuaternion(Q(b.rotation())).applyQuaternion(Q(f.bodies.chest.rotation()).invert());
 const overlaps=[];for(const arm of ['uarm'+side,'farm'+side])for(const torso of ['chest','abdomen','pelvis']){const c=f.bodies[arm].collider(0).contactCollider(f.bodies[torso].collider(0),0);if(c&&c.distance<0)overlaps.push({arm,torso,depth:-c.distance});}
 arms[side]={...measured.get(f)?.[side],upper:upper.toArray(),elbow:toChest(f,elbow(f,side)).toArray(),wrist:toChest(f,wrist(f,side)).toArray(),overlaps};}
 const gaps=f.joints.map(j=>V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation())).distanceTo(V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()))));
 const pommel=new THREE.Vector3(0,f.weaponCfg.gripAlong??0,0).applyQuaternion(Q(f.sword.rotation())).add(V(f.sword.translation()));
 return{gripGapM:pommel.distanceTo(wrist(f,'O')),pommelChest:toChest(f,pommel).toArray(),tick,timeS:(tick+1)*DT,state:f.state,muscle:f.muscle,armed:f.armed,gripping:f.gripping,limbs:{...f.limbs},tilt:f.tiltDeg(),arms,parts:p,sword:{p:V(f.sword.translation()).toArray(),q:Q(f.sword.rotation()).toArray()},maxJointGapM:Math.max(...gaps),tipSpeed:f.tipVel.length()};}
class Passive{update(){}}
const report={head,mode,weapon,pose,observe,sourceBefore,startedUTC:new Date().toISOString(),samples:[],nativeHashes:[],transitions:[],firstGetup:null,firstStand:null};
let G;const originalRandom=Math.random,started=performance.now();
try{G=newRound({seed:7,weapon,weapon2:'longsword',gap:5.6,walls:false,AIClass:mode==='natural'?AI:Passive,onFighter:f=>{f.armSupportModel='linked';f.onehandArmModel='legacy';if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);Object.assign(f,{onehandArmModel:'manual',stanceMemoryModel:d.stance,rollTargetModel:d.roll,canShove:true});prepareMorgensternTrial(f);}if(observe)instrument(f);}});
 assert(applySwordsmanship(G.player));const d=configureCombatDefaults({active:true},G.player.weapon);Object.assign(G.combat,{cutReactionModel:d.cut,cutReactionFighter:G.player,finishRuleModel:'power',finishRuleFighter:null});
 report.policy={gravity:G.world.gravity.y,assist:CONFIG.GAIT.assist,support:CONFIG.BODY.supportModel,v2:G.player.swordsmanshipModel,cut:d.cut,roll:G.player.rollTargetModel,stance:G.player.stanceMemoryModel,armSupport:G.player.armSupportModel};
 const origin=G.player.handOffset.toArray();let tick,lastState=null;
 G.before=()=>{const f=G.player,reinput=pose==='reinput'&&report.firstStand!==null&&tick>=report.firstStand+30,late=(pose==='recoveryHigh'||pose==='reinput')&&(f.state==='down'||f.state==='getup'),dx=reinput?Math.max(-.018,Math.min(.018,-.4-f.handOffset.x)):late?Math.max(-.012,Math.min(.012,.15-f.handOffset.x)):tick<72?(pad[0]-origin[0])/72:0,dy=reinput?Math.max(-.018,Math.min(.018,-.3-f.handOffset.y)):late?Math.max(-.012,Math.min(.012,.65-f.handOffset.y)):tick<72?(pad[1]-origin[1])/72:0;f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=true;f.inputActive=Math.abs(dx)+Math.abs(dy)>1e-5;f.move.set(0,0);f.stickX=0;f.stickY=0;assert(recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx,dy,held:true,active:f.inputActive}));
 if(mode!=='natural'&&tick===360){if(mode==='hurt')f.limbs.armO=.35;f.knockDown(true);f.bodies.chest.applyImpulse({x:mode==='side'?0:55,y:0,z:mode==='side'?55:0},true);}};
 for(tick=0;tick<(mode==='natural'?2400:1800);tick++){observationTick=tick;G.step();report.nativeHashes.push(sha(G.world.takeSnapshot()));if(lastState!==G.player.state){report.transitions.push({tick,state:G.player.state});lastState=G.player.state;}if(G.player.state==='getup'&&report.firstGetup===null)report.firstGetup=tick;if(report.firstGetup!==null&&G.player.state==='stand'&&report.firstStand===null)report.firstStand=tick;if(observe)report.samples.push(sample(G.player,tick));if(report.firstStand!==null&&tick>=report.firstStand+240)break;if(!G.player.alive||!G.enemy.alive)break;}
 report.steps=tick+1;report.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity}));
}catch(e){report.error={message:e.message,stack:e.stack};process.exitCode=1;}finally{G?.eventQueue.free();G?.world.free();Math.random=originalRandom;}
report.sourceAfter=hashes();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);assert(report.sourceStable);report.wallSeconds=(performance.now()-started)/1000;
report.summary=Object.fromEntries(['all','getup','afterStand'].map(state=>{const ss=report.samples.filter(s=>state==='all'||(state==='afterStand'?report.firstStand!==null&&s.tick>=report.firstStand:s.state===state));return[state,{frames:ss.length,maxGap:Math.max(0,...ss.map(s=>s.maxJointGapM)),arms:Object.fromEntries(['S','O'].map(a=>[a,{requestedRearFrames:ss.filter(s=>s.arms[a].callTick===s.tick&&s.arms[a].requested?.[0]<-.1).length,targetUpperRearFrames:ss.filter(s=>s.arms[a].callTick===s.tick&&s.arms[a].targetUpper?.[0]<-.5).length,actualUpperRearFrames:ss.filter(s=>s.arms[a].upper[0]<-.5).length,wristRearFrames:ss.filter(s=>s.arms[a].wrist[0]<-.1).length,torsoOverlapOver5cm:ss.filter(s=>s.arms[a].overlaps.some(o=>o.depth>.05)).length,maxOverlap:Math.max(0,...ss.flatMap(s=>s.arms[a].overlaps.map(o=>o.depth))),minRequestedX:Math.min(...ss.map(s=>s.arms[a].requested?.[0]??1)),maxTargetStepRad:Math.max(0,...ss.map(s=>s.arms[a].targetStepRad??0))}]))}]}));
fs.writeFileSync(path.join(opts.out,'report.json'),JSON.stringify(report)+'\n');console.log(JSON.stringify({out:opts.out,mode,weapon,firstGetup:report.firstGetup,firstStand:report.firstStand,summary:report.summary,error:report.error,wallSeconds:report.wallSeconds}));
