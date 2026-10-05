// Input ownership/gate contracts. These tests do not certify human technique.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Skill} from '../../../src/skill.js';
import {WEAPON} from '../../../src/config.js';
import {guardAt} from '../../../src/guards.js';
import {applyMotionTiming,recordMotionTimingInput,updateMotionTiming} from '../../../src/motion_timing.js';
import {SWORD_ASSIST_V2 as C, applySwordAssistV2, updateSwordAssistReturn,
  assistSwordHand, assistSwordAim} from '../../../src/sword_assist_v2.js';
const DT = 1/120;
function fixture(mode='v2') {
  const f={index:0,weapon:{id:'qinggang'},weaponCfg:{twoHand:false},guardPose:{oneHand:true},
    onehandArmModel:'manual',motionTimingModel:'sequenced',alive:true,armed:true,state:'stand',
    handOffset:new THREE.Vector2(.45,-.35),move:new THREE.Vector2(),finish:{amt:0},
    armHealth:1,limbs:{armS:1,legF:1,legB:1},pain:0,foeDistance:()=>Infinity};
  f.skill=new Skill(f,0);
  assert(applySwordAssistV2({active:true,comparison:'sword',swordAssist:mode},f));
  return f;
}
const cases=[];
const test=(name,fn)=>{fn();cases.push({name,pass:true});};
test('ordinary, opponent and incompatible comparison stay absent',()=>{
  for(const change of [f=>f.index=1,f=>f.weapon.id='sabre',f=>f.onehandArmModel='legacy',f=>f.motionTimingModel='none']) {
    const f=fixture();delete f.swordAssistState;delete f.swordAssistModel;change(f);
    assert.equal(applySwordAssistV2({active:true,comparison:'sword',swordAssist:'v2'},f),false);
    assert.equal('swordAssistState' in f,false);
  }
  const f=fixture();delete f.swordAssistState;
  assert.equal(applySwordAssistV2({active:true,comparison:'force',swordAssist:'v2'},f),false);
  assert.equal('swordAssistState' in f,false);
});
test('A has identical real Skill output to absence of v2 state',()=>{
  const a=fixture('none'),b=fixture('none');delete b.swordAssistModel;delete b.swordAssistState;
  for(let i=0;i<480;i++) {
    for(const f of [a,b]){f.handHeld=i<120;f.inputActive=i<60;if(i<60)f.handOffset.x-=.005;f.skill.update(DT);}
    for(const key of ['handOffset'])assert.deepEqual(a[key].toArray(),b[key].toArray());
    for(const key of ['aim','aimRaw','aimVel','anchor','follow','vel'])assert.deepEqual(a.skill[key].toArray(),b.skill[key].toArray());
    assert.equal(a.skill.swings,b.skill.swings);assert.equal(a.skill.lunge,b.skill.lunge);
  }
});
test('stationary held touch preserves a deliberate high/side pose',()=>{
  const f=fixture(),before=f.handOffset.toArray();f.handHeld=true;
  for(let i=0;i<600;i++)f.skill.update(DT);
  assert.deepEqual(f.handOffset.toArray(),before);assert.equal(f.swordAssistState.phase,'guidance');
  assert.equal(f.swordAssistState.requestedHomeBlend,0);
});
test('slow released pose returns without new swings/follow/lunge',()=>{
  const f=fixture(),before=f.handOffset.toArray();
  for(let i=0;i<40;i++)f.skill.update(DT);
  assert.deepEqual(f.handOffset.toArray(),before,'Do not return during the release grace interval');
  for(let i=0;i<420;i++){
    f.skill.update(DT);
    assert(Math.hypot(f.swordAssistState.generatedDX,f.swordAssistState.generatedDY)<=C.returnSpeedMps*DT+1e-12);
    assert.equal(f.skill.swinging,false);assert.equal(f.skill.swings,0);assert.equal(f.skill.lunge,0);assert.equal(f.skill.follow.length(),0);
  }
  assert.deepEqual(f.handOffset.toArray(),[...C.homePad]);assert.equal(f.swordAssistState.phase,'ready');
  assert(f.swordAssistState.homeBlend>.999);
  const hand=new THREE.Vector3(.12+.5*Math.sqrt(1-(.15**2+.1**2)/WEAPON.reach**2),.2,.25);
  const home=guardAt(...C.homePad,{oneHand:true});assistSwordHand(f,hand,home.hand);
  assert(hand.distanceTo(new THREE.Vector3(...C.homeHand))<.001);
});
test('new unmoving touch interrupts the return immediately',()=>{
  const f=fixture();for(let i=0;i<65;i++)f.skill.update(DT);
  assert.equal(f.swordAssistState.phase,'returning');const before=f.handOffset.toArray();
  f.handHeld=true;f.skill.update(DT);assert.deepEqual(f.handOffset.toArray(),before);
  assert.equal(f.swordAssistState.returnVX,0);assert.equal(f.swordAssistState.returnVY,0);
  const blend=f.swordAssistState.homeBlend;
  for(let i=0;i<90;i++)f.skill.update(DT);
  assert.equal(f.swordAssistState.homeBlend,blend,'An unmoving retouch holds the ready reference');
});
test('mouse movement without held pointer interrupts return',()=>{
  const f=fixture();for(let i=0;i<65;i++)f.skill.update(DT);
  f.inputActive=true;f.handOffset.x-=.025;const before=f.handOffset.toArray();f.skill.update(DT);
  assert.deepEqual(f.handOffset.toArray(),before);assert.equal(f.swordAssistState.phase,'guidance');
});
test('special commands, pain and unavailable limbs yield all guidance',()=>{
  for(const change of [f=>f.skill.tap={},f=>f.skill.thrustPose.w=.2,f=>f.finish.amt=.1,
    f=>f.state='getup',f=>f.state='down',f=>f.armed=false,f=>f.alive=false,
    f=>f.armHealth=.4,f=>f.limbs.legF=.4,f=>f.pain=.3,f=>f.barge={},f=>f.lift=.01]){
    const f=fixture();for(let i=0;i<90;i++)updateSwordAssistReturn(f.skill,DT);
    change(f);const pad=f.handOffset.toArray();updateSwordAssistReturn(f.skill,DT);
    assert.deepEqual(f.handOffset.toArray(),pad);assert.equal(f.swordAssistState.phase,'suspended');
    assert.equal(f.swordAssistState.homeBlend,0);
    const hand=new THREE.Vector3(.5,.2,.1),aim=new THREE.Vector3(1,0,0);
    assert.equal(assistSwordHand(f,hand,[.2,.4,.3]),0);assert.equal(assistSwordAim(f,aim,[0,1,0]),0);
    assert.deepEqual(hand.toArray(),[.5,.2,.1]);assert.deepEqual(aim.toArray(),[1,0,0]);
  }
});
test('movement guidance stays within hand/angle budgets across opposing references',()=>{
  const f=fixture();f.handHeld=true;f.skill.update(DT);
  for(const g of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1]]) {
    const aim=new THREE.Vector3(1,0,0),before=aim.clone();assistSwordAim(f,aim,g);
    assert(before.angleTo(aim)<=C.aimBudgetRad+1e-12);assert(Math.abs(aim.length()-1)<1e-12);
    const hand=new THREE.Vector3(.5,.2,.3),h=hand.clone();assistSwordHand(f,hand,[.1,-3,5]);
    assert(hand.distanceTo(h)<=C.handBudgetM+1e-12);assert.equal(hand.x,h.x);
  }
});
test('zero physics time cannot age a paused controller',()=>{
  const f=fixture(),before=structuredClone(f.swordAssistState);updateSwordAssistReturn(f.skill,0);
  assert.deepEqual(f.swordAssistState,before);
});
test('movement consumed in a zero-physics render survives the next empty render',()=>{
  const f=fixture();f.bodyPose={pelvisYaw:0,chestYaw:0};f.motionAssistModel='coordinated';
  assert(applyMotionTiming({active:true,comparison:'sword',motionTiming:'sequenced'},f));
  f.swordAssistState.idleS=1;f.swordAssistState.homeBlend=.9;
  assert(recordMotionTimingInput(f,{id:1,timeS:0,dx:.01,dy:0,held:false,active:true}));
  assert(recordMotionTimingInput(f,{id:2,timeS:.01,dx:0,dy:0,held:false,active:false}));
  const pad=f.handOffset.toArray();updateSwordAssistReturn(f.skill,DT);
  assert.deepEqual(f.handOffset.toArray(),pad);assert.equal(f.swordAssistState.requestedHomeBlend,0);
  assert.equal(f.swordAssistState.phase,'guidance');updateMotionTiming(f,DT,0,0,.15);
});
test('ready carry translates a new hand gesture instead of lerping it to the center',()=>{
  const f=fixture();f.swordAssistState.homeBlend=1;
  const g=[.4,.1,.1],a=new THREE.Vector3(.5,.2,.25),b=a.clone().add(new THREE.Vector3(.03,0,0));
  assistSwordHand(f,a,g);assistSwordHand(f,b,g);
  assert(Math.abs(b.x-a.x-.03)<1e-12,'A new forward displacement is not suppressed by readiness');
  for(const dir of [[1,0,0],[0,1,0],[0,0,1],[-1,0,0]]){
    const aim=new THREE.Vector3(...dir),before=aim.clone();assistSwordAim(f,aim,[0,1,0]);
    assert(before.angleTo(aim)<=C.aimBudgetRad+1e-12);
  }
});
test('explicit thrust owns a continuous captured ready base',()=>{
  const f=fixture();for(let i=0;i<460;i++)f.skill.update(DT);
  const blend=f.swordAssistState.homeBlend;
  f.skill.tap={t:0,K:{aim:.11},h0:[...C.homeHand],v2BaseDir:[1,0,0]};
  updateSwordAssistReturn(f.skill,DT);assert.equal(f.swordAssistState.phase,'suspended');
  const hand=new THREE.Vector3(.3,.3,.3),aim=new THREE.Vector3(0,1,0);
  assert.equal(assistSwordHand(f,hand,[0,0,0]),0);assert.equal(assistSwordAim(f,aim,[0,0,1]),0);
  assert.deepEqual(hand.toArray(),[...C.homeHand]);assert.deepEqual(aim.toArray(),[1,0,0]);
  assert.equal(f.swordAssistState.homeBlend,blend);
  f.skill.tap.t=.12;f.skill.thrustPose.w=1;
  const nextHand=new THREE.Vector3(.3,.3,.3);assistSwordHand(f,nextHand,[.4,.1,.1]);
  assert.notDeepEqual(nextHand.toArray(),f.skill.tap.h0,'Prepare the moving underlying base while explicit thrust masks it');
  f.skill.thrustPose.w=0;
  f.skill.tap=null;updateSwordAssistReturn(f.skill,DT);
  assert.equal(f.swordAssistState.homeBlend,blend,'Command completion preserves readiness until new intent');
});
test('early aborted thrust carries its base across aim-end instead of exposing a jump',()=>{
  const f=fixture();f.state='down';
  f.skill.tap={t:.05,K:{aim:.11,recover:.18},h0:[.5,.1,.05],v2BaseDir:[1,0,0],abort:{t:.05,w:.4}};
  const raw=new THREE.Vector3(.3,.3,.3);let last=raw.clone();assistSwordHand(f,last,[.4,.1,.1]);
  let lastAim=new THREE.Vector3(0,1,0);assistSwordAim(f,lastAim,[0,0,1]);
  for(let i=1;i<=22;i++){
    f.skill.tap.t=.05+Math.min(.18,i*DT);
    const h=raw.clone(),a=new THREE.Vector3(0,1,0);assistSwordHand(f,h,[.4,.1,.1]);assistSwordAim(f,a,[0,0,1]);
    assert(h.distanceTo(last)<.021);assert(a.angleTo(lastAim)<.074);
    last=h;lastAim=a;
  }
  f.skill.tap=null;
  const h=raw.clone(),a=new THREE.Vector3(0,1,0);assistSwordHand(f,h,[.4,.1,.1]);assistSwordAim(f,a,[0,0,1]);
  assert(h.distanceTo(last)<1e-12);assert(a.angleTo(lastAim)<1e-7);
});
console.log(JSON.stringify({groups:cases.length,cases},null,2));
