// 실제 Skill 속도·입력·물리 루프: 준비 면제와 헛친 공격 비용을 함께 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT } from './harness_m.mjs';
import { TECH, G } from '../../src/ai_techniques.js';
import { Stamina } from '../../src/stamina.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { STAMINA } from '../../src/config.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function setup(from=[.15,0],stage=0,fatigue=0) {
 const g=newRound({weapon:'longsword',seed:23,gap:8,walls:false});g.ai.update=()=>{};
 for(const f of [g.player,g.enemy]){f.handHeld=true;f.inputActive=true;f.handOffset.set(...from);}
 for(let i=0;i<240;i++)g.step();
 for(const f of [g.player,g.enemy])f.stamina=new Stamina(f);
 g.enemy.stamina.controller=g.ai;new PlayerUniqueAssist(g.player,{stage});g.step();
 if(fatigue){const step=g.step;g.step=()=>{g.player.stamina.value=fatigue===1?-10:-60;g.player.stamina.level=fatigue;step();};}
 g.move=(to,seconds,both=false)=>{
  const fs=both?[g.player,g.enemy]:[g.player],starts=fs.map(f=>f.handOffset.toArray()),n=Math.ceil(seconds/DT);
  for(let i=1;i<=n;i++){fs.forEach((f,j)=>{f.handOffset.set(starts[j][0]+(to[0]-starts[j][0])*i/n,starts[j][1]+(to[1]-starts[j][1])*i/n);f.inputActive=true;});g.step();}
 };
 g.hold=()=>{for(let i=0;i<30;i++)g.step();};return g;
}
test('빠른 준비→내려베기는 사람/AI 모두12; 느린 준비와 해금에도 같음',()=>{
 for(const stage of [0,5])for(const seconds of [.16,.6]){
  const g=setup([.15,0],stage);try{
   const tech=TECH.find(t=>t.name==='zornhau');g.ai.startAttack(tech,'test',{noFeint:true});
   g.move(G.tagR,seconds,true);g.hold();near(g.player.stamina.spent.attack,0);near(g.enemy.stamina.spent.attack,0);
   g.ai.startStrike();g.move(tech.path[0],.12,true);g.move(tech.path[1],.16,true);g.hold();
   near(g.player.stamina.spent.attack,12);near(g.enemy.stamina.spent.attack,12);
  }finally{g.world.free();}
 }
});
test('지친 물리 명령과 원래 손길 판정: 준비 비용0·12종 한 번 청구·유파 인식 동일',()=>{
 const saved={...STAMINA};Object.assign(STAMINA,{attackTempo:true,tempoInput:true,tempoGravity:true,tempoWristDamping:true});
 try{
  for(const fatigue of [1,2]){
   const g=setup([.15,0],5,fatigue);try{
    g.move(G.tagR,.16);g.hold();near(g.player.stamina.spent.attack,0);
    const tech=TECH.find(t=>t.name==='zornhau');for(const to of tech.path)g.move(to,.16);g.hold();near(g.player.stamina.spent.attack,12);
   }finally{g.world.free();}
  }
  for(const stage of [0,5])for(const tech of TECH){let reference;
   for(const fatigue of [0,1,2]){const g=setup(tech.from,stage,fatigue);try{
    for(const to of tech.path){const from=g.player.handOffset;g.move(to,Math.hypot(to[0]-from.x,to[1]-from.y)/3);}
    g.hold();near(g.player.stamina.spent.attack,tech.kind==='thrust'?7:12);
    const recognized={techs:g.player.skill.uniq?.stats.techs??{},fired:g.player.skill.uniq?.stats.fired??{}};
    if(reference)assert.deepEqual(recognized,reference,`${tech.name}, stage ${stage}, fatigue ${fatigue}`);else reference=structuredClone(recognized);
   }finally{g.world.free();}}
  }
 }finally{Object.assign(STAMINA,saved);}
});
test('당겼다가 탭 찌르기는7 한 번; 준비 뒤 공격 취소는0',()=>{
 for(const attack of [false,true]){const g=setup();try{
  g.move(G.pflugR,.1);g.hold();near(g.player.stamina.spent.attack,0);
  if(attack){assert.ok(g.player.skill.thrust());g.hold();near(g.player.stamina.spent.attack,7);}
 }finally{g.world.free();}}
});
test('중앙에서 머리·양 어깨·옆·허리로 준비만 하는 입력은0',()=>{
 for(const key of ['tag','tagR','tagL','sideR','sideL','pflugR','pflugL']){
  const g=setup();try{g.move(G[key],.14);g.hold();near(g.player.stamina.spent.attack,0);}finally{g.world.free();}
 }
});
test('해금0/5: 12종 실제 긋기는 빗나가도 각각 베기12/찌르기7',()=>{
 for(const stage of [0,5])for(const tech of TECH){const g=setup(tech.from,stage);try{
  for(const to of tech.path){const from=g.player.handOffset;g.move(to,Math.hypot(to[0]-from.x,to[1]-from.y)/3);}
  g.hold();near(g.player.stamina.spent.attack,tech.kind==='thrust'?7:12);assert.equal(g.hits.length,0);
 }finally{g.world.free();}}
});
