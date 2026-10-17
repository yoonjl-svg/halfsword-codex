// One real-physics input transition and one player-attack surrogate, not duels.
import {redesignedTrial} from './japanese_flow_redesign.mjs';
import {installEarlyIntercept} from './japanese_flow_intercept_model.mjs';
import {TECH} from '../../src/ai_techniques.js';
import {DT} from './harness_m.mjs';
import {installFlowPractice} from './japanese_recovery_practice.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-intercept-20261017';mkdirSync(out,{recursive:true});
let flowAt=null,input=null;const after=[];
const defender=redesignedTrial({enabled:true,poses:'none',seed:755,atk:'longsword',policy:'hold',seconds:3.2,gap:1.75,onStart(G){G.ai.pickTech=()=>TECH.find(t=>t.name==='zwerch');installEarlyIntercept(G,.36,{horizontalOnly:true});},onFrame(G,g){
 if(G.combat.lastNagashi?.redesign&&flowAt===null)flowAt=G.t;
 if(flowAt!==null&&input===null&&G.t-flowAt>=.016)input={t:G.t,poseBefore:!!G.player.flowInterceptDebug,coverOwnedBefore:!!G.player.skill._cover?.own,accepted:G.player.skill.thrust()};
 if(input&&G.t-input.t<.1)after.push({t:G.t,guard:g.active,broken:g.broken,pose:!!G.player.flowInterceptDebug&&!!G.player.skill._cover?.own,coverWeight:G.player.skill._cover?.w,tap:!!G.player.skill.tap,arm:G.player.flowArmScale??1});
}});
const attacker=redesignedTrial({enabled:true,poses:'none',seed:681,weapon:'qinggang',atk:'uchigatana',policy:'attacker',seconds:17,onStart(G,g){
 installFlowPractice(G,'attacker');installEarlyIntercept(G,.36,{horizontalOnly:true,fighter:G.enemy});
 G.before=()=>{const f=G.player,t=G.t,d=f.foeDistance(),phase=t%2.1,stage=phase<.65?0:phase<.88?1:2;
  g.held=false;g.broken=f.skill.swinging;g.step(DT);const active=stage<2&&d<2.3&&!f.stamina.exhausted&&f.alive;f.handHeld=active;f.inputActive=active;
  if(active){const x=stage===0?.12:-.38,y=stage===0?.78:-.85,speed=stage===0?2.3:6.2;f.handOffset.x+=Math.max(-speed*DT,Math.min(speed*DT,x-f.handOffset.x));f.handOffset.y+=Math.max(-speed*DT,Math.min(speed*DT,y-f.handOffset.y));}
  f.move.set(.1*Math.sin(t),d>1.35?.4:d<1.05?-.45:0);f.stickX=f.move.x;f.stickY=f.move.y;
 };
}});
const result={defender:{flowAt,input,after,result:defender},attacker};writeFileSync(`${out}/input-check.json`,JSON.stringify(result));
console.log(JSON.stringify({flowAt,input,after,defenderFlows:defender.redesignedFlows.map(x=>x.penalty),attackerFlows:attacker.redesignedFlows.map(x=>x.penalty),attackerAlive:attacker.health.end.alive}));
if(!input?.accepted||!input.poseBefore||!input.coverOwnedBefore||after.slice(1).some(x=>x.guard||x.pose||x.arm!==1))process.exitCode=1;
