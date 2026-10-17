import {live} from './japanese_flow_live.mjs';
import {FLOW_RECOVERY} from '../../src/nagashi_recovery.js';
import * as THREE from 'three';
export function trial(o){
 const {duration=0,release=duration>0,track=false,...options}=o;
 Object.assign(FLOW_RECOVERY,{seconds:duration,release});
 const events=[],frames=[],prefix=[];let start=null,last=[null,null];
 try {
  const r=live({...options,onFrame(G,g){
   for(const [i,f] of [G.player,G.enemy].entries())if(f.flowRecovery&&last[i]!==f.flowRecovery){last[i]=f.flowRecovery;events.push({t:G.t,who:i,...f.flowRecovery});}
   if(G.combat.lastNagashi&&!start)start=G.t;
   if(track){
    const row={t:G.t,tip:G.enemy.bladePoint(1,new THREE.Vector3()).toArray(),p:G.player.bladePoint(1,new THREE.Vector3()).toArray(),scale:G.enemy.flowArmScale,move:G.enemy.move.toArray(),hand:G.enemy.handTarget.toArray(),w:G.enemy.sword.angvel(),cover:G.player.skill._cover?.w??0,pblood:G.player.blood,eblood:G.enemy.blood};
    if(!start)prefix.push(row);else if(G.t-start<1.25)frames.push(row);
   }
   o.onFrame?.(G,g);
  }});
  return {...r,durationSetting:duration,release,events,frames,prefix:track?JSON.stringify(prefix):null};
 } finally {Object.assign(FLOW_RECOVERY,{seconds:0,release:false});}
}
if(process.argv?.[1]?.endsWith('/japanese_recovery.mjs')){
 const {writeFileSync,mkdirSync}=await import('node:fs');
 const {createHash}=await import('node:crypto');
 const out=process.env.OUT??'/workspace/japanese-recovery-20261017';mkdirSync(out,{recursive:true});
 const phase=process.env.PHASE??'screen';
 const cases=phase.startsWith('screen')?[{seed:511,atk:'longsword',policy:'reactive',seconds:23.2},{seed:511,atk:'zweihander',policy:'riposte',seconds:20.9},{seed:512,atk:'qinggang',policy:'riposte',seconds:4.95},{seed:513,atk:'longsword',policy:'riposte',seconds:10.05},{seed:502,atk:'qinggang',policy:'slash',seconds:5.85},{seed:514,atk:'longsword',policy:'riposte',seconds:7.75}]:JSON.parse(process.env.CASES??'null')??[611,612,613,614].flatMap(seed=>['longsword','qinggang','zweihander'].flatMap(atk=>['riposte','slash'].map(policy=>({seed,atk,policy,seconds:30}))));
 const values=(process.env.VALUES??'base,0,0.18,0.24,0.30,0.36,0.45').split(',');
 for(const value of values){const rows=[];for(const c of cases){const r=trial({...c,duration:value==='base'?0:+value,release:value!=='base',track:phase.startsWith('screen')});if(r.prefix)r.prefix=createHash('sha256').update(r.prefix).digest('hex');rows.push(r);writeFileSync(`${out}/${phase}-${value}.json`,JSON.stringify(rows));console.log(JSON.stringify({value,...c,t:r.duration,flows:r.flows.length,events:r.events.length,alive:r.health.end.alive,enemyAlive:r.enemy.end.alive,blood:r.health.bloodLost,limb:r.health.limbLost,concussion:r.health.concussion,front:r.flows[0]?.front}));}}
}
