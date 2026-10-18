// 30-second player-command surrogate, NOT a human playtest or AI-vs-AI match.
import {newRound,DT} from './harness_m.mjs';
import {SKILL} from '../../src/config.js';
import {observeHealth} from './iberian_health.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installIberianBeat} from '../../src/iberian_beat.js';
import * as THREE from 'three';
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function live({gain=0,yieldSeconds=0,impulseCap=3,speedCap=4,recoilDegrees=0,recoilSeconds=.28,recoilMode="offset",seed=101,atk='longsword',policy='riposte',seconds=30,gap=2.2,onFrame,onStart,GuardOverride,weapon='zweihander',reaction=.22,book=true}={}){
 SKILL.parryAssist=0;
 const G=newRound({weapon,weapon2:atk,gap,seed});
 const D=G.player,A=G.enemy;
 D.skill.corr=SKILL.corr;D.skill.corrTip=SKILL.corrTip;D.skill.autoGuard=true;
 D.schoolFootwork=true;D.schoolParry=book;
 const Guard=GuardOverride??PlayerParryGuard,guard=new Guard(D,A);D.stamina.controller=guard;
 const observer=observeHealth(D,()=>G.t),enemyObserver=observeHealth(A,()=>G.t),random=rng(seed+104729);
 const study=installIberianBeat(G.combat,{gain,yieldSeconds,impulseCap,speedCap,recoilDegrees,recoilSeconds,recoilMode});
 const r={gain,yieldSeconds,impulseCap,speedCap,recoilDegrees,recoilSeconds,recoilMode,seed,atk,policy,seconds,gap,weapon,reaction,book,commands:[],timeline:[],aiTechniques:{},clashes:[],flows:[],postFlow:[]};
 let counterDue=Infinity,slashUntil=0,slashX=-1;
 r.slashFrames=[];
 const previousClash=G.combat.hooks.onClash;
 G.combat.hooks.onClash=(p,s,info)=>{previousClash?.(p,s,info);if(!info.fresh)return;r.clashes.push({t:G.t,vn:info.vn,flow:!!info.nagashi});if(G.combat.lastIberianBeat?.time-G.t<=DT&&G.combat.lastIberianBeat?.time-G.t>=0)r.flows.push({t:G.t,front:null,frontStart:null,hitsBefore:enemyObserver.r.applied.length});if(['riposte','slash'].includes(policy)&&counterDue===Infinity&&G.t>nextCounter)counterDue=G.t+reaction+random()*.10;};
 let due=Infinity,heldUntil=0,lastMotion=-Infinity,notice=false,nextCounter=2,lastHeld=false,sample=0,lastAttackId=-1;
 // A separate observer uses visible physical blade speed/distance, never AI mode/attack id for decisions.
 G.before=()=>{
  const t=G.t,dist=D.foeDistance();
  const motion=dist<2.2&&Math.hypot(A.hitPointVel.x,A.hitPointVel.y,A.hitPointVel.z)>2.5;
  if(motion){lastMotion=t;if(!notice&&!guard.held&&due===Infinity){due=t+.16+random()*.16;notice=true;}}
  else if(t-lastMotion>.3)notice=false;
  if(t>=due){heldUntil=t+.65+random()*.45;due=Infinity;}
  let held=policy==='hold'?true:(t<heldUntil||(guard.held&&t-lastMotion<.18));
  if(D.skill.tap||D.skill.pom)held=false;
  if(policy==='slash'){
   if(guard.broken&&(!held||(!D.skill.swinging&&!D.skill.tap&&t>=slashUntil)))guard.broken=false;
   if(t<slashUntil)guard.broken=true;
  }else guard.broken=!!(D.skill.tap||D.skill.pom);
  guard.held=held;
  if(((policy==='exchange'&&!held&&t-lastMotion>.22)||(['riposte','slash'].includes(policy)&&t>=counterDue))&&!guard.broken&&t>nextCounter&&dist<2.05){
   if(policy==='slash'&&D.alive&&D.armed&&!D.stamina.exhausted){slashUntil=t+.20;slashX=-Math.sign(D.handOffset.x||1);guard.broken=true;counterDue=Infinity;nextCounter=t+1.2+random()*.4;r.commands.push({t,action:'swipe'});}
   else if(policy!=='slash'&&D.skill.thrust()){guard.broken=true;guard.held=false;counterDue=Infinity;nextCounter=t+1.2+random()*.4;r.commands.push({t,action:'tap'});}
  }
  if(guard.held!==lastHeld){r.commands.push({t,action:guard.held?'press':'release'});lastHeld=guard.held;}
  guard.step(DT);D.inputActive=guard.active;
  D.handHeld=t<slashUntil;
  if(t<slashUntil&&!D.stamina.exhausted){D.handOffset.x+=slashX*4.5*DT;D.handOffset.y-=4.5*DT;D.inputActive=true;r.slashFrames.push({t,force:D.skill._cover?.forceT??0,cover:D.skill._cover?.w??0,active:guard.active});}
  if(policy==='hold'||D.stamina.exhausted||!D.alive)D.move.set(0,0);
  else D.move.set(.18*Math.sin(t*.65+seed),dist<1.35?-.55:dist>1.85?.45:0);
  D.stickX=D.move.x;D.stickY=D.move.y;
  // Diagnostic logging only; these values never feed player commands.
  if(A.stamina.attackId!==lastAttackId){lastAttackId=A.stamina.attackId;const name=G.ai.tech?.name??G.ai.attack?.name??G.ai.phase??'unknown';r.aiTechniques[name]=(r.aiTechniques[name]??0)+1;}
 };
 onStart?.(G,guard);
 try{
  while(G.t+1e-9<seconds&&D.alive&&A.alive){G.step();observer.step(DT,guard);enemyObserver.step(DT);onFrame?.(G,guard);
   const tip=A.bladePoint(1,new THREE.Vector3()),c=A.bodies.chest.translation(),dc=D.bodies.chest.translation(),fwd=new THREE.Vector3(dc.x-c.x,0,dc.z-c.z).normalize(),off=tip.clone().sub(c),front=off.dot(fwd)>.35&&Math.abs(off.x*(-fwd.z)+off.z*fwd.x)<.45&&off.y>-.6&&off.y<.7;
   for(const flow of r.flows){if(G.t-flow.t>1.5)continue;if(front){flow.frontStart??=G.t;if(flow.front==null&&G.t-flow.frontStart>=.1)flow.front=flow.frontStart-flow.t;}else flow.frontStart=null;}
   if(G.t>=sample){r.timeline.push({t:G.t,p:observer.finish().end,e:enemyObserver.finish().end});sample+=1;}}
  r.instrumentation=5;r.beats=study.events;r.candidates=study.candidates;r.duration=G.t;r.health=observer.finish();r.enemy=enemyObserver.finish();r.guard={...guard.stats};return r;
 }finally{G.eventQueue.free();G.world.free();}
}

if(process.argv[1]?.endsWith('/iberian_beat_live.mjs')){
 const {writeFileSync,mkdirSync}=await import('node:fs');
 const out=process.env.OUT??'docs/research/iberian_beat_20261018/raw';mkdirSync(out,{recursive:true});
 const configs=JSON.parse(process.env.CONFIGS??'[{"gain":0},{"gain":1.4,"impulseCap":6,"speedCap":8}]');
 const cases=JSON.parse(process.env.CASES??'null')??[701,702].flatMap(seed=>['longsword','qinggang','uchigatana','zweihander'].flatMap(atk=>['reactive','slash'].map(policy=>({seed,atk,policy}))));
 for(const cfg of configs){const rows=[];for(const c of cases){const r=live({...c,...cfg,seconds:+(process.env.SECONDS??30)});rows.push(r);writeFileSync(`${out}/${process.env.LABEL??'live'}-${cfg.gain}-${cfg.yieldSeconds??0}.json`,JSON.stringify(rows));console.log(JSON.stringify({cfg,...c,t:r.duration,beats:r.beats.length,alive:r.health.end.alive,enemyAlive:r.enemy.end.alive,blood:r.health.bloodLost,limb:r.health.limbLost,enemyLimb:r.enemy.limbLost,concussion:r.health.concussion}));}}
}
