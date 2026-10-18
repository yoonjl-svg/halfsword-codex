// Paired, ordinary AI-vs-AI comparison. No player-command surrogate.
import {newRound,DT,AI} from './harness_m.mjs';
import {installAiContactSweep} from './iberian_contact_sweep.mjs';
import {linkSweepRecovery} from './contact_control_recovery.mjs';
import {observeHealth} from './iberian_health.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export const OUT='docs/research/iberian_ai_league_20261019';
const motion=JSON.parse(readFileSync('docs/research/iberian_contact_20261018/candidate-outward.json'));
export const opponents=[['german','longsword'],['italian','rapier'],['iberian','zweihander'],['japanese','uchigatana'],['chinese','qinggang'],['none','morgenstern']];
export const cases=opponents.flatMap(([school,weapon2])=>['zweihander','flamberge'].flatMap(weapon=>[3101,3102,3103].flatMap(seed=>[0,1].map(slot=>({school,weapon2,weapon,seed,slot,seconds:30,proficiency:5})))));
export function duel(c,variant,{plain=false}={}){
 const p=c.slot===0?c.weapon:c.weapon2,e=c.slot===0?c.weapon2:c.weapon;
 const G=newRound({seed:c.seed,weapon:p,weapon2:e,gap:2.6,walls:true,sameLook:true,
  AI2Class:AI,difficulty:'normal',difficulty2:'normal',persona:{proficiency:c.proficiency},persona2:{proficiency:c.proficiency}});
 const D=c.slot===0?G.player:G.enemy,A=c.slot===0?G.enemy:G.player,ai=c.slot===0?G.ai2:G.ai;
 if(!G.ai||!G.ai2||!D.aiControlled||!A.aiControlled)throw Error('Two actual AIs required');
 if(D.swordArt.tradition!=='iberian'||A.swordArt.tradition!==c.school)throw Error(`Wrong school ${D.swordArt.tradition}/${A.swordArt.tradition} expected ${c.school}`);
 const health=observeHealth(D,()=>G.t),enemy=observeHealth(A,()=>G.t);
 const prefix=createHash('sha256'),events=[];let first=null,state,cap,activeFrames=0,twistFrames=0,minScale=1;
 const observer={trigger(t,detail){first??=t;events.push({t,...detail});}};
 const twistAudit=({scale})=>{if(scale<1)twistFrames++;};A._studyTwistAudit=twistAudit;
 if(!plain){
  state=installAiContactSweep(D,ai,{...motion,observeOnly:variant==='native'});
  if(!state)throw Error('AI contact sweep missing');
  // User correction: NO force/control benefit on either motion.
  // Observe the same eligible contacts without installing any motor adapter.
  const noBenefit={begin:()=>false};
  const owner={step:ai.update.bind(ai)};
  linkSweepRecovery(owner,state,D,noBenefit,observer,()=>G.t);ai.update=dt=>owner.step(dt);
 }
 const breakTimes={self:[],foe:[]};
 for(const [f,key] of [[D,'self'],[A,'foe']]){const br=f.breakWeapon.bind(f);f.breakWeapon=(...args)=>{const old=f.weaponBroken;const r=br(...args);if(!old&&f.weaponBroken)breakTimes[key].push(G.t);return r;};}
 const modes={self:{},foe:{}},attacks={self:0,foe:0};let prev=[0,0];
 try{
  while(G.t+1e-9<c.seconds&&D.alive&&A.alive){
   if(first===null)prefix.update(JSON.stringify([G.t,...[D,A].map(f=>[f.bodies.chest.translation(),f.sword.translation(),f.sword.linvel(),f.handOffset.toArray(),f.stamina.value,f.stamina.attackId])]));
   G.step();health.step(DT);enemy.step(DT);
   const s=cap?.scale()??1;if(s<1)activeFrames++;minScale=Math.min(minScale,s);
   for(const [i,f,key] of [[0,D,'self'],[1,A,'foe']]){const ctl=f.stamina.controller; modes[key][ctl.mode]=(modes[key][ctl.mode]??0)+DT;if(f.stamina.attackId!==prev[i]){attacks[key]++;prev[i]=f.stamina.attackId;}}
  }
  return {case:c,variant,plain,duration:G.t,result:!D.alive&&!A.alive?'D':!D.alive?'L':!A.alive?'W':'D',health:health.finish(),enemy:enemy.finish(),first,prefixHash:prefix.digest('hex'),events,motions:state?.events??[],effects:cap?.events??[],activeFrames,twistFrames,minScale,breakTimes,modes,attacks,
   settings:{schools:[D.swordArt.tradition,A.swordArt.tradition],proficiency:[ai.proficiency,A.stamina.controller.proficiency],bothAI:true,forceBenefit:false,controlBenefit:false,shoulderTwist:false,look:'same player look',gap:2.6}};
 }finally{G.eventQueue.free();G.world.free();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 mkdirSync(`${OUT}/raw`,{recursive:true});
 if(process.env.CHECK){
  const c=cases[0],a=duel(c,'native',{plain:true}),b=duel(c,'native');
  const fields=['health','enemy','duration','result','breakTimes','attacks','modes'];
  const checks=Object.fromEntries(fields.map(k=>[k,JSON.stringify(a[k])===JSON.stringify(b[k])]));
  writeFileSync(`${OUT}/checks.json`,JSON.stringify({case:c,checks,events:b.events.length,settings:b.settings},null,2));
  if(Object.values(checks).some(v=>!v))throw Error('Native observer changed ordinary AI');
  console.log(JSON.stringify(checks));
 }else{
  const variant=process.env.ARM;if(!['native','outward'].includes(variant))throw Error('ARM required');
  const rows=[],started=Date.now();
  for(const [i,c] of cases.entries()){
   const row=duel(c,variant);rows.push(row);
   writeFileSync(`${OUT}/raw/${variant}.json.gz`,gzipSync(JSON.stringify(rows)));
   console.log(JSON.stringify({variant,i,school:c.school,result:row.result,effects:row.effects.length,elapsed:(Date.now()-started)/1000}));
  }
  writeFileSync(`${OUT}/${variant}-runtime.json`,JSON.stringify({started:new Date(started).toISOString(),ended:new Date().toISOString(),seconds:(Date.now()-started)/1000,n:rows.length},null,2));
 }
}
