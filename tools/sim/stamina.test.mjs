import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina } from '../../src/stamina.js';
import { STAMINA } from '../../src/config.js';
const near = (a,b,e=1e-7) => assert.ok(Math.abs(a-b)<e, `${a} != ${b}`);
function actor(extra={}) {
 const pos={x:0,y:1,z:0};
 const f={ alive:true, armed:true, state:'stand', heading:0, swordMass:1.6, move:new Vector2(), handOffset:new Vector2(), skill:{vel:new Vector2(),swinging:false}, bodies:{pelvis:{translation:()=>pos}}, ...extra };
 f.stamina=new Stamina(f); f.pos=pos; return f;
}
const tick=(f,seconds,dt=1/120)=>{for(let t=0;t<seconds-1e-9;t+=dt)f.stamina.step(Math.min(dt,seconds-t));};
const swing=(f,seconds,x,y=0)=>{f.skill.swinging=true;f.skill.vel.set(x,y);for(let t=0;t<seconds-1e-9;t+=1/120){const dt=Math.min(1/120,seconds-t);f.handOffset.x+=x*dt;f.handOffset.y+=y*dt;f.stamina.step(dt);}};
test('공격은 한 번에 베기12/찌르기7, 막기3; 무게는 원래 질량으로 고정',()=>{
 const f=actor(); f.stamina.attack(); f.stamina.attack('thrust');near(f.stamina.value,81);
 const w=actor({swordMass:2.9}); const k=Math.sqrt(2.9/1.6);near(w.stamina.weight,k);w.swordMass=.4;near(w.stamina.weight,k);w.stamina.attack();near(w.stamina.spent.attack,12*k);
});
test('무게 배율은 0.75~1.5',()=>{near(actor({swordMass:.1}).stamina.weight,.75);near(actor({swordMass:20}).stamina.weight,1.5);});
test('찌르기 시간 분류는 원래 질량과 찌르기 특성 사용, 방어 근육은 기존 한도',()=>{
 const saved={...STAMINA};Object.assign(STAMINA,{attackTempo:true,tempoProfiles:true});
 try{for(const [mass,style,rate] of [[1.6,null,.55],[2.9,null,.6],[1.1,{},.6]]){
  const f=actor({swordMass:mass,weaponCfg:{thrustStyle:style}});f.skill.tap={};f.stamina.value=-60;f.stamina.stages();
  near(f.stamina.attackSpeed,rate);f.swordMass=.2;near(f.stamina.attackSpeed,rate);
  f.stamina.controller={held:true};near(f.stamina.motorSpeed,.5);near(f.stamina.power,.25);
 }}finally{Object.assign(STAMINA,saved);}
});
test('짧은 입력 끊김/작은 방향 흔들림은 같은 긋기, 반대 방향은 새 공격',()=>{
 const f=actor();f.handOffset.set(-.5,.1);tick(f,.01);swing(f,.1,3);assert.equal(f.stamina.counts.cut,1);
 f.skill.swinging=false;tick(f,.08);swing(f,.2,3,.1);assert.equal(f.stamina.counts.cut,1);
 swing(f,.3,-3);assert.equal(f.stamina.counts.cut,2);
 f.skill.swinging=false;tick(f,.16);swing(f,.3,3);assert.equal(f.stamina.counts.cut,3);
});
test('해금 객체가 없어도 공격 비용, 자동 막기 이동에는 공격 비용 없음',()=>{
 const f=actor();assert.equal(f.skill.uniq,undefined);f.handOffset.set(-.5,.1);tick(f,.01);swing(f,.1,3);near(f.stamina.spent.attack,12);
 const d=actor();d.stamina.controller={held:true};swing(d,.2,3);near(d.stamina.spent.attack,0);near(d.stamina.spent.block,0);
});
test('실제 손 이동 없는 속도 신호나 작은 흔들림에는 비용 없음',()=>{
 const f=actor();f.skill.swinging=true;f.skill.vel.set(3,0);tick(f,.2);near(f.stamina.spent.attack,0);
 swing(f,.01,3);f.skill.swinging=false;tick(f,.2);near(f.stamina.spent.attack,0);
});
test('준비 중 실제 공격 접촉은 한 번 청구, 방어 자세의 접촉에는 공격 비용 없음',()=>{
 const f=actor();tick(f,.01);swing(f,.05,2,2);near(f.stamina.spent.attack,0);
 for(let i=0;i<8;i++)f.stamina.contactAttack('cut');near(f.stamina.spent.attack,12);
 f.skill.swinging=false;tick(f,.2);f.stamina.contactAttack('cut');near(f.stamina.spent.attack,12);
 const d=actor();d.stamina.controller={held:true};swing(d,.2,2);d.stamina.contactAttack('cut');near(d.stamina.spent.attack,0);
});
test('실제 접촉 청구는 상대 공격당 한 번, 다음 공격에서 다시 청구',()=>{
 const a=actor(),b=actor();b.stamina.controller={held:true};a.stamina.attack();for(let i=0;i<8;i++)b.stamina.block(a);near(b.stamina.spent.block,3);
 a.stamina.attack();b.stamina.block(a);near(b.stamina.spent.block,6);
});
test('비기는35 한 번, 구성 공격/걷기와 이중 청구하지 않음',()=>{
 const f=actor();f.skill.sec={};f.stamina.secret();f.stamina.attack();f.stamina.attack('thrust');near(f.stamina.value,65);near(f.stamina.spent.attack,0);near(f.stamina.spent.secret,35);
});
test('사람/AI 걷기는0.62m당 동방0.7·일반1.4·일본2.1, 걷는 중 회복·제자리 무료',()=>{
 for(const aiControlled of [false,true])for(const [trad,cost] of [['chinese',.7],['german',1.4],['italian',1.4],['iberian',1.4],['japanese',2.1],['none',1.4]]) {
  const f=actor({aiControlled,swordArt:{tradition:trad}});f.stamina.value=20;f.stamina.rest=.6;f.move.y=1;f.stamina.step(1/120);
  for(let i=0;i<123;i++){f.pos.x+=.01;f.stamina.step(1/120);}near(f.stamina.spent.move,cost);
  f.pos.x+=.01;f.stamina.step(1/120);
  near(f.stamina.spent.move,2*cost);assert.ok(f.stamina.value>30);
 }
 const f=actor();f.move.y=1;tick(f,2);near(f.stamina.spent.move,0);
});
test('거리0.62 직전에는 미청구, 일시정지·남은 거리를 거쳐 다음 문턱에서 한 번 청구',()=>{
 const f=actor();f.move.y=1;f.stamina.step(.01);
 for(let i=0;i<61;i++){f.pos.x+=.01;f.stamina.step(.01);}near(f.stamina.spent.move,0);
 f.stamina.step(0);near(f.stamina.spent.move,0);
 f.pos.x+=.01;f.stamina.step(.01);near(f.stamina.spent.move,1.4);
 f.pos.x+=.01;f.stamina.step(.01);near(f.stamina.spent.move,1.4);
});
test('비자발적/기술 이동에는 걷기 비용 없음',()=>{
 for(const extra of [{feetHeld:true},{gait:{req:{}}},{state:'down'}]){
 const f=actor(extra);f.move.y=1;f.stamina.step(.01);for(let i=0;i<100;i++){f.pos.x+=.01;f.stamina.step(.01);}near(f.stamina.spent.move,0);}
});
test('사람/AI 방어 유지 중 소모도 회복도 없음, 마지막 접촉의 지연은 유지',()=>{
 for(const ai of [false,true]) {
  const f=actor({aiControlled:ai});const c=ai?{mode:'defend'}:{held:true};f.stamina.controller=c;f.stamina.value=50;tick(f,2);near(f.stamina.value,50);
  const a=actor();a.stamina.attack();f.stamina.block(a);tick(f,.2);
  c.mode='watch';c.held=false;tick(f,.4);near(f.stamina.value,47);tick(f,.2);near(f.stamina.value,ai?50:51.2);
 }
});
test('오래 막고 접촉 없이 놓으면 이미 지난 회복 지연을 다시 부과하지 않음',()=>{
 const f=actor();f.stamina.value=50;f.stamina.controller={held:true};tick(f,2);f.stamina.controller.held=false;tick(f,.2);near(f.stamina.value,54.2);
});
test('0/심한 지침(STAMINA.severeAt) 단계와 +15 해제 문턱',()=>{
 const s=actor().stamina;s.value=-1;s.stages();near(s.speed,.7);s.value=10;s.stages();near(s.speed,.7);s.value=15;s.stages();near(s.speed,1);
 const S=STAMINA.severeAt,B=STAMINA.stageBack;s.value=S-1;s.stages();near(s.speed,.4);s.value=S+B-5;s.stages();near(s.speed,.4);s.value=S+B;s.stages();near(s.speed,.7);
});

test('movement and attack use the separately approved fatigue rates',()=>{
 const s=actor().stamina;
 near(s.speed,1);near(s.attackSpeed,1);
 s.value=-1;s.stages();near(s.speed,.7);near(s.attackSpeed,.8);
 s.value=-41;s.stages();near(s.speed,.4);near(s.attackSpeed,.6);
 s.value=-80;s.stages();near(s.speed,0);near(s.attackSpeed,0);
});
test('탈진2.5초: 막기를 누르고 있어도 회복,0/지침으로 해제,추가비용없음',()=>{
 const f=actor();f.stamina.controller={held:true};f.stamina.spend('attack',180);near(f.stamina.value,STAMINA.floor);near(f.stamina.speed,0);
 f.stamina.attack();near(f.stamina.spent.attack,180);tick(f,2);near(f.stamina.value,STAMINA.floor+2*STAMINA.exhaustRecover);assert.ok(f.stamina.exhausted);
 tick(f,.5);near(f.stamina.value,0);near(f.stamina.speed,.7);assert.equal(f.stamina.exhausted,false);
 f.stamina.controller.held=false;tick(f,1);near(f.stamina.value,21);near(f.stamina.speed,1);
});
test('회복/탈진은 dt 분할과 무관, 일시정지 dt0은 진행하지 않음',()=>{
 for(const aiControlled of [false,true])for(const dt of [1/120,1/60,.1]){const f=actor({aiControlled});f.stamina.spend('attack',STAMINA.max-STAMINA.floor);tick(f,2.5,dt);near(f.stamina.value,0);near(f.stamina.exhaustLeft,0);f.stamina.step(0);near(f.stamina.value,0);}
});
test('기력 끔은 비용·힘·이동·입력 제한 모두 해제',()=>{
 const f=actor();f.stamina.spend('attack',STAMINA.max-STAMINA.floor);try{STAMINA.on=false;f.stamina.attack();near(f.stamina.speed,1);near(f.stamina.power,1);assert.equal(f.stamina.exhausted,false);tick(f,.1);near(f.stamina.value,100);}finally{STAMINA.on=true;}
});
test('사망·부활 중 기력 정지, 새 판100',()=>{for(const extra of [{alive:false},{revival:{}}]){const f=actor(extra);f.stamina.value=20;tick(f,3);near(f.stamina.value,20);}near(actor().stamina.value,100);});
