// node tools/sim/stamina_duels.mjs main on|off
// 현재 본판 동작 그대로(별도 동작 라이브러리 덮어쓰기 없음), 유파5/무기6 × 자리교대8 = 48판.
import {newRound,DT,AI} from './harness_m.mjs';
import {STAMINA} from '../../src/config.js';
if(process.argv[2]!=='main')throw Error('main 인자를 명시하세요');
STAMINA.on=process.argv[3]!=='off';
const weapons=['longsword','rapier','zweihander','uchigatana','qinggang','falchion'];
const rows=[];
for(const weapon of weapons)for(let n=0;n<8;n++){
 const swap=n%2===1,seed=1000+n;
 const g=newRound({weapon:swap?'longsword':weapon,weapon2:swap?weapon:'longsword',AI2Class:AI,seed});
 const fighters=[g.player,g.enemy];
 const metrics=fighters.map(f=>({weapon:f.weapon.id,tradition:f.swordArt.tradition,firstZero:null,firstSevere:null,firstExhaustion:null,woundsWhileExhausted:0}));
 g.onWound=(att,vic,r)=>{if(vic.stamina.exhausted&&r.severity>0)metrics[fighters.indexOf(vic)].woundsWhileExhausted++;};
 try{
  while(g.t<30&&fighters.every(f=>f.alive)){
   g.step();
   for(let i=0;i<2;i++){
    const f=fighters[i],m=metrics[i],s=f.stamina,p=f.bodies.pelvis.translation();
    if(![p.x,p.y,p.z,s.value,...Object.values(f.sword.linvel())].every(Number.isFinite))throw Error(`nonfinite ${weapon}/${seed}`);
    if(m.firstZero==null&&s.value<=0)m.firstZero=+g.t.toFixed(3);
    if(m.firstSevere==null&&s.level>=2)m.firstSevere=+g.t.toFixed(3);
    if(m.firstExhaustion==null&&s.exhausted)m.firstExhaustion=+g.t.toFixed(3);
   }
  }
  for(let i=0;i<2;i++)Object.assign(metrics[i],{alive:fighters[i].alive,blood:+fighters[i].blood.toFixed(3),exhaustions:fighters[i].stamina.counts.exhaustion,costs: {...fighters[i].stamina.spent},counts:{...fighters[i].stamina.counts},endValue:+fighters[i].stamina.value.toFixed(3)});
  const me=swap?g.enemy:g.player,foe=swap?g.player:g.enemy;
  rows.push({weapon,seed,swap,seconds:+g.t.toFixed(3),winner:me.alive&&!foe.alive?'weapon':foe.alive&&!me.alive?'longsword':'draw',fighters:metrics});
 }finally{g.world.free();}
}
const summary=weapons.map(weapon=>{const r=rows.filter(r=>r.weapon===weapon);return{weapon,rounds:r.length,wins:r.filter(r=>r.winner==='weapon').length,losses:r.filter(r=>r.winner==='longsword').length,draws:r.filter(r=>r.winner==='draw').length,meanSeconds:+(r.reduce((a,r)=>a+r.seconds,0)/r.length).toFixed(2),exhaustions:r.flatMap(r=>r.fighters).reduce((a,f)=>a+f.exhaustions,0),woundsWhileExhausted:r.flatMap(r=>r.fighters).reduce((a,f)=>a+f.woundsWhileExhausted,0)};});
console.log(JSON.stringify({mode:'main',stamina:STAMINA.on,rounds:rows.length,summary,rows},null,2));
