import {Stamina} from '../../src/stamina.js';
// 정해진 플레이어 입력의 기력 도달 시각. 모델 계산표 대신 실제 Skill/Fighter를 통과한다.
import {newRound,DT} from './harness_m.mjs';
const rows=[];
for(const [name,period] of [['cuts_fast',.5],['cuts_slow',1],['thrusts_fast',.5]]) {
 const g=newRound({weapon:name.startsWith('thrust')?'rapier':'longsword',seed:23,gap:8});g.ai.update=()=>{};
 try {
  const f=g.player;f.handOffset.set(.45,.12);for(let i=0;i<240;i++)g.step();f.stamina=new Stamina(f);const t0=g.t;let index=-1;let zero=null,severe=null,exhaust=null,lastExhaust=false;
  for(let i=0;i<30/DT;i++){
   const t=g.t-t0;const n=Math.floor(t/period);
   if(name.startsWith('thrust')) {if(n!==index&&f.foe)f.skill.thrust({step:false});}
   else if(!f.stamina.exhausted){const u=Math.min(1,(t-n*period)/.18);const dir=n%2?1:-1;f.handOffset.set(dir*(-.45+.9*u),.12);f.inputActive=u<1;f.handHeld=true;}
   index=n;g.step();
   if(zero==null&&f.stamina.value<=0)zero=+(g.t-t0).toFixed(3);
   if(severe==null&&f.stamina.level>=2)severe=+(g.t-t0).toFixed(3);
   if(exhaust==null&&f.stamina.exhausted)exhaust=+(g.t-t0).toFixed(3);
  }
  rows.push({name,weapon:f.weapon.id,zero,severe,exhaust,exhaustions:f.stamina.counts.exhaustion,costs:f.stamina.spent,counts:f.stamina.counts,finalState:f.state});
 }finally{g.world.free();}
}
console.log(JSON.stringify(rows,null,2));
