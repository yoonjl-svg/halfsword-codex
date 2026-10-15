// 실제 AI 공격 중 탈진 장면을 준비해 2.5초 무방비 구간을 측정한다. 자연 발생 빈도와 구별.
import {newRound,DT} from './harness_m.mjs';
const rows=[];
for(let seed=1;seed<=4;seed++){
 const g=newRound({weapon:'longsword',seed,gap:2.3});
 try{
  let started=null,finished=null,wounds=0,dead=false;
  g.onWound=(att,vic,r)=>{if(vic===g.player&&vic.stamina.exhausted&&r.severity>0)wounds++;};
  for(let i=0;i<1200&&g.player.alive;i++){
   if(started==null&&g.t>=2){g.player.stamina.spend('attack',150);started=g.t;}
   g.step();
   if(started!=null&&!g.player.stamina.exhausted){finished=g.t;break;}
  }
  rows.push({seed,started:+started?.toFixed(3),recovered:finished==null?null:+(finished-started).toFixed(3),wounds,alive:g.player.alive,state:g.player.state});
 }finally{g.world.free();}
}
console.log(JSON.stringify(rows,null,2));
