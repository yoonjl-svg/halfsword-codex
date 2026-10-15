// node tools/sim/stamina_duels.mjs main on|off
// 현재 본판 동작 그대로(별도 동작 라이브러리 덮어쓰기 없음), 무기5 × 자리교대24 = 120판(사용자 지시: 설계안48의 절반). STD_WEAPONS/STD_ROUNDS로 분할.
import {newRound,DT,AI} from './harness_m.mjs';
import { SCHOOLS } from '../../src/schools.js';
import {STAMINA} from '../../src/config.js';
if(process.argv[2]!=='main')throw Error('main 인자를 명시하세요');
STAMINA.on=process.argv[3]!=='off';
const weapons=(process.env.STD_WEAPONS??'longsword,rapier,zweihander,uchigatana,qinggang').split(',');
const rounds=Number(process.env.STD_ROUNDS??24);
if(!Number.isInteger(rounds)||rounds<2||rounds%2)throw Error('STD_ROUNDS must be a positive even count');
const rows=[];
for(const weapon of weapons)for(let n=0;n<rounds;n++){
 const swap=n%2===1,seed=1000+n;
 const g=newRound({weapon:swap?'longsword':weapon,weapon2:swap?weapon:'longsword',AI2Class:AI,seed,walls:true,difficulty:'normal',difficulty2:'normal',persona:{school:SCHOOLS[swap?weapon:'longsword']?swap?weapon:'longsword':'longsword'},persona2:{school:SCHOOLS[swap?'longsword':weapon]?swap?'longsword':weapon:'longsword'}});
 const fighters=[g.player,g.enemy];
 const metrics=fighters.map(f=>({weapon:f.weapon.id,tradition:f.swordArt.tradition,firstZero:null,firstSevere:null,firstExhaustion:null,woundsWhileExhausted:0}));
 g.onWound=(att,vic,r)=>{if(vic.stamina.exhausted&&r.severity>0)metrics[fighters.indexOf(vic)].woundsWhileExhausted++;};
 try{
  while(g.t<40&&fighters.every(f=>f.alive)){
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
