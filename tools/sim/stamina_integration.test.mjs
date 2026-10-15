import { TRADITIONS } from '../../src/schools.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { requestIai } from '../../src/secret_instant.js';
import { STAMINA, SECRET } from '../../src/config.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function game(fn,weapon='longsword'){const g=newRound({weapon,seed:7});try{return fn(g);}finally{g.world.free();}}
test('실제 파손 전 강체 질량을 고정',()=>{for(const id of ['rapier','zweihander'])game(g=>{const p=g.player;const k=p.stamina.weight;p.breakWeapon();assert.ok(p.swordMass<p.stamina.originalMass);p.stamina.attack();near(p.stamina.spent.attack,12*k);},id);});
test('고유 동작 해금0/5에서 같은 입력의 공격 횟수와 비용이 같음',()=>{
 const rows=[];for(const stage of [0,5])game(g=>{g.ai.update=()=>{};const p=g.player;new PlayerUniqueAssist(p,{stage});
 for(let i=0;i<80;i++){p.handOffset.set(.4-i*.01,.1);p.inputActive=true;g.step();}rows.push({n:p.stamina.counts.cut,c:p.stamina.spent.attack});});
 assert.ok(rows[0].c>0);assert.deepEqual(rows[0],rows[1]);
});
test('실제 막기 버튼의 자세 이동은 비용 없음, 유지 중 회복 중단',()=>game(g=>{
 g.ai.update=()=>{};const p=g.player;const guard=new PlayerParryGuard(p,g.enemy);p.stamina.controller=guard;p.stamina.value=50;guard.held=true;
 for(let i=0;i<120;i++){guard.step(DT);g.step();}near(p.stamina.spent.attack,0);near(p.stamina.spent.block,0);near(p.stamina.value,50);
 guard.held=false;for(let i=0;i<120;i++){guard.step(DT);g.step();}assert.ok(p.stamina.value>50);
}));
test('실제 탭 찌르기 한 번은7, 프레임 수와 관계없이 한 번',()=>game(g=>{
 g.ai.update=()=>{};g.step();assert.ok(g.player.skill.thrust());for(let i=0;i<120;i++)g.step();near(g.player.stamina.spent.attack,7);
}));
test('AI 실제 공격은 기술당 한 번, 기력 부족 시 휴식 결심',()=>game(g=>{
 const a=g.ai;const t=a.school.techs?.[0]??a.school.techByName.zornhau;
 assert.ok(t);a.startAttack(t,'test',{noFeint:true});a.startStrike();near(g.enemy.stamina.spent.attack,t.kind==='thrust'?7:12);
 g.enemy.stamina.value=5;a.mode='watch';a.update(DT);assert.ok(a.staminaRest);assert.equal(a.startAttack(t,'test'),false);
}));
test('탈진 중 이동·찌르기·막기·비기 예약 차단,2.5초 뒤0으로 복귀',()=>game(g=>{
 g.ai.update=()=>{};const p=g.player;const guard=new PlayerParryGuard(p,g.enemy);p.stamina.controller=guard;guard.held=true;p.stamina.spend('attack',150);
 p.instantReq={};p.iaiReq={};p.move.set(1,1);assert.equal(p.skill.thrust(),false);
 for(let i=0;i<300;i++){p.move.set(1,1);guard.step(DT);g.step();if(i<299){assert.ok(p.feetHeld);near(p.move.length(),0);assert.equal(guard.active,false);assert.equal(p.skill.swinging,false);}}
 near(p.stamina.value,0);assert.equal(p.stamina.exhausted,false);assert.equal(p.stamina.level,1);assert.equal(p.instantReq,null);assert.equal(p.iaiReq,null);assert.equal(p.state,'stand');
}));
test('AI 탈진은 지형 우회보다 우선하여 자발적 이동을 막음',()=>game(g=>{g.enemy.stamina.spend('attack',150);g.ai.update(DT);near(g.enemy.move.length(),0);assert.equal(g.ai.mode,'watch');}));
test('진행 중 발도는 탈진 때 끝나고 팔·칼의 동적 물리와 양손 잡기를 복구',()=>{
 const previous=SECRET.iaiKinematic;
 try{for(const kinematic of [0,1]){SECRET.iaiKinematic=kinematic;game(g=>{
  g.ai.update=()=>{};const p=g.player;for(let i=0;i<240;i++)g.step();
  requestIai(p,{player:true});g.step();assert.ok(p.iai);assert.equal(p.sword.isKinematic(),!!kinematic);
  p.iaiOneHold=true;p.stamina.spend('attack',150);g.step();
  assert.equal(p.iai,null);assert.equal(p.iaiOneHold,false);assert.equal(p.sword.isDynamic(),true);
  for(const part of ['uarmS','farmS'])assert.equal(p.bodies[part].isDynamic(),true);
  for(let i=0;i<60;i++)g.step();assert.ok(Number.isFinite(p.bodies.pelvis.translation().y));
 },'uchigatana');}}finally{SECRET.iaiKinematic=previous;}
});
test('끔 상태는 탈진 입력 차단도 없고 동일 힘',()=>game(g=>{g.step();g.player.stamina.spend('attack',150);try{STAMINA.on=false;assert.equal(g.player.stamina.exhausted,false);near(g.player.stamina.power,1);assert.ok(g.player.skill.thrust());}finally{STAMINA.on=true;}}));

test('실제 칼 충돌을 상대 공격당 한 번의 막기 비용으로 셈',()=>game(g=>{
 const guard=new PlayerParryGuard(g.player,g.enemy);g.player.stamina.controller=guard;guard.held=true;g.before=()=>guard.step(DT);
 for(let i=0;i<2400&&g.player.alive;i++)g.step();
 assert.ok(g.clashes>0);assert.ok(g.player.stamina.counts.block>0);near(g.player.stamina.spent.block,g.player.stamina.counts.block*3);near(g.player.stamina.spent.attack,0);
}));
test('실제 플레이어 비기의 구성 찌르기는35에 포함',()=>game(g=>{
 g.ai.update=()=>{};g.step();const p=g.player;assert.ok(p.skill.secret({S:TRADITIONS.italian.secret}));
 for(let i=0;i<120;i++)g.step();near(p.stamina.spent.secret,35);near(p.stamina.spent.attack,0);near(p.stamina.spent.move,0);
},'rapier'));
