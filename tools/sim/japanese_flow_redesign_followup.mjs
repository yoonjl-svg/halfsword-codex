import {redesignedTrial} from './japanese_flow_redesign.mjs';
import {TECH} from '../../src/ai_techniques.js';
import {DT} from './harness_m.mjs';
import {installFlowPractice} from './japanese_recovery_practice.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';mkdirSync(out,{recursive:true});const rows=[];
for(const poses of (process.env.ATTACK_ONLY?[]:['none','horizontal']))for(const name of ['zwerch','zwerchL'])for(const policy of ['hold','riposte']){
 const r=redesignedTrial({enabled:true,poses,seed:756,atk:'longsword',policy,seconds:10,gap:1.75,onStart(G){G.ai.pickTech=()=>TECH.find(t=>t.name===name);}});
 rows.push({name,...r});console.log(JSON.stringify({poses,name,policy,flows:r.redesignedFlows.length,alive:r.health.end.alive,limb:r.health.limbLost,concussion:r.health.concussion,blood:r.health.bloodLost,commands:r.commands}));
 writeFileSync(`${out}/followup.json`,JSON.stringify(rows));
}
const attackers=[];
for(const seed of [681,682]){
 const r=redesignedTrial({enabled:true,poses:'horizontal',seed,weapon:'qinggang',atk:'uchigatana',policy:'attacker',seconds:17,onStart(G,g){
  installFlowPractice(G,'attacker');
  G.before=()=>{const f=G.player,t=G.t,d=f.foeDistance(),phase=t%2.1,stage=phase<.65?0:phase<.88?1:2;
   g.held=false;g.broken=f.skill.swinging;g.step(DT);
   const active=stage<2&&d<2.3&&!f.stamina.exhausted&&f.alive;f.handHeld=active;f.inputActive=active;
   if(active){const x=stage===0?.12:-.38,y=stage===0?.78:-.85,speed=stage===0?2.3:6.2;f.handOffset.x+=Math.max(-speed*DT,Math.min(speed*DT,x-f.handOffset.x));f.handOffset.y+=Math.max(-speed*DT,Math.min(speed*DT,y-f.handOffset.y));}
   f.move.set(.1*Math.sin(t),d>1.35?.4:d<1.05?-.45:0);f.stickX=f.move.x;f.stickY=f.move.y;
  };
 }});
 attackers.push(r);writeFileSync(`${out}/attacker-check.json`,JSON.stringify(attackers));console.log(JSON.stringify({type:'attacker',seed,flows:r.redesignedFlows.map(f=>({d:f.d,penalty:f.penalty})),alive:r.health.end.alive}));
}
