import {WEAPONS} from '../../src/weapons.js';
// 동일 기술/출발 자세에서 실제 칼날70% 지점의 최고 속도와 동작 시간을 비교.
import { newRound, DT, AI } from './harness_m.mjs';
const rows=[];
for(const weapon of ['longsword','rapier','zweihander','monohoshizao','qinggang']) {
 if(!WEAPONS[weapon])throw Error(`unknown weapon ${weapon}`);
 for(const level of [0,1,2]) {
  const g=newRound({weapon,weapon2:'longsword',seed:71,AI2Class:AI,gap:8});
  try {
   g.ai.update=()=>{};g.ai2.update=()=>{};const f=g.player,a=g.ai2;

   const tech=a.school.tech.find(t=>t.kind==='cut'&&t.name==='zornhau')??a.school.tech.find(t=>t.kind==='cut')??a.school.tech[0];
   f.handOffset.set(...tech.from);for(let i=0;i<240;i++)g.step();
   f.stamina.value=level===2?-31:level===1?-1:100;f.stamina.level=level;
   a.startAttack(tech,'test',{noFeint:true});a.startStrike();
   let peak=0,t=0,pathEnd=null,tilt=0;
   for(let i=0;i<360;i++) {
    // 단계별 비교 동안만 같은 기력 단계를 유지: 회복/추가 비용의 교란을 제외.
    f.stamina.value=level===2?-40:level===1?-10:100;f.stamina.level=level;
    if(pathEnd==null){a.handSpeed=11;a.moveHand(DT);}g.step();t+=DT;
    const pt=f.bladePoint(.7),v=f.sword.velocityAtPoint(pt);peak=Math.max(peak,Math.hypot(v.x,v.y,v.z));tilt=Math.max(tilt,f.tiltDeg());
    if(pathEnd==null&&!a.path.length)pathEnd=t;
    if(pathEnd!=null&&t>pathEnd+.3)break;
   }
   rows.push({weapon,tech:tech.name,level,peak:+peak.toFixed(3),pathEnd:+(pathEnd??0).toFixed(3),tilt:+tilt.toFixed(2),state:f.state});
  }finally{g.world.free();}
 }
}
for(const row of rows){const base=rows.find(r=>r.weapon===row.weapon&&r.level===0);row.speedRatio=+(row.peak/base.peak).toFixed(3);}
console.log(JSON.stringify(rows,null,2));
