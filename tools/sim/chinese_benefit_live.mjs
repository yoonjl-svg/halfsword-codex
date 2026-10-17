// 30-second player-command surrogate, NOT a human playtest or AI-vs-AI match.
import {newRound,DT} from './harness_m.mjs';
import {SKILL} from '../../src/config.js';
import {guardClass,observeHealth} from './chinese_benefit_model.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function live({kind='base',seed=101,atk='longsword',policy='exchange',seconds=30,gap=2.2,onFrame}={}){
 SKILL.parryAssist=0;
 const G=newRound({weapon:'qinggang',weapon2:atk,gap,seed});
 const D=G.player,A=G.enemy;
 D.skill.corr=SKILL.corr;D.skill.corrTip=SKILL.corrTip;D.skill.autoGuard=true;
 D.schoolFootwork=true;D.schoolParry=true;
 const Guard=guardClass(kind),guard=new Guard(D,A);D.stamina.controller=guard;
 const observer=observeHealth(D,()=>G.t),enemyObserver=observeHealth(A,()=>G.t),random=rng(seed+104729);
 const r={kind,seed,atk,policy,seconds,gap,commands:[],timeline:[],aiTechniques:{}};
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
  guard.broken=!!(D.skill.tap||D.skill.pom);
  guard.held=held;
  if(policy==='exchange'&&!held&&!guard.broken&&t>nextCounter&&t-lastMotion>.22&&dist<2.05){
   if(D.skill.thrust()){guard.broken=true;nextCounter=t+2.4+random()*.8;r.commands.push({t,action:'tap'});}
  }
  if(guard.held!==lastHeld){r.commands.push({t,action:guard.held?'press':'release'});lastHeld=guard.held;}
  guard.step(DT);D.inputActive=guard.active;
  if(policy==='hold'||D.stamina.exhausted||!D.alive)D.move.set(0,0);
  else D.move.set(.18*Math.sin(t*.65+seed),dist<1.35?-.55:dist>1.85?.45:0);
  D.stickX=D.move.x;D.stickY=D.move.y;
  // Diagnostic logging only; these values never feed player commands.
  if(A.stamina.attackId!==lastAttackId){lastAttackId=A.stamina.attackId;const name=G.ai.tech?.name??G.ai.attack?.name??G.ai.phase??'unknown';r.aiTechniques[name]=(r.aiTechniques[name]??0)+1;}
 };
 try{
  while(G.t+1e-9<seconds&&D.alive&&A.alive){G.step();observer.step(DT,guard);enemyObserver.step(DT);onFrame?.(G,guard);if(G.t>=sample){r.timeline.push({t:G.t,p:observer.finish().end,e:enemyObserver.finish().end});sample+=1;}}
  r.instrumentation=2;r.duration=G.t;r.health=observer.finish();r.enemy=enemyObserver.finish();r.guard={...guard.stats};return r;
 }finally{G.eventQueue.free();G.world.free();}
}
if(process.argv[1]?.endsWith('/chinese_benefit_live.mjs')){
 const dir=process.env.BENEFIT_OUT??'/workspace/chinese-parry-benefit-20261017';mkdirSync(dir,{recursive:true});
 const kinds=(process.env.KINDS??'base,low-preview,compact,cross').split(','),seeds=(process.env.SEEDS??'101,102,103,104').split(',').map(Number),atks=(process.env.ATKS??'longsword,qinggang').split(','),policies=(process.env.POLICIES??'reactive,exchange').split(',');
 for(const kind of kinds){const rows=[];for(const seed of seeds)for(const atk of atks)for(const policy of policies){const r=live({kind,seed,atk,policy,gap:+(process.env.GAP??2.2)});rows.push(r);console.log(JSON.stringify({kind,seed,atk,policy,duration:r.duration,alive:r.health.end.alive,enemyAlive:r.enemy.end.alive,hits:r.health.hits,bloodLost:r.health.bloodLost,limbLost:r.health.limbLost,concussion:r.health.concussion,block:r.health.stamina.spent.block,attack:r.health.stamina.spent.attack}));writeFileSync(`${dir}/${process.env.LABEL??'live'}-${kind}.json`,JSON.stringify(rows));}}
}
