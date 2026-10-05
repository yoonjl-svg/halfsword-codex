// Controller/input contracts with real Skill filtering. Synthetic health/command
// states below are unit fixtures, never reported as actual combat exposure.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Skill } from '../../../src/skill.js';
import { WEAPONS } from '../../../src/weapons.js';
import { SWORDSMANSHIP as C, applySwordsmanship, hasSwordsmanship,
  recordSwordsmanshipInput, advanceSwordsmanship, resolveSwordsmanshipGoals } from '../../../src/swordsmanship.js';

const DT=1/120,cases=[];
const test=(name,fn)=>{fn();cases.push({name,pass:true});};
const near=(a,b,tol=1e-10)=>assert(Math.abs(a-b)<=tol,`${a} != ${b}`);
function fixture(weapon='qinggang', install=true) {
  const f={index:0,weapon:WEAPONS[weapon],weaponCfg:{twoHand:WEAPONS[weapon].twoHand},
    handOffset:new THREE.Vector2(.42,-.28),handHeld:false,inputActive:false,move:new THREE.Vector2(),
    handBase:[.5,.1,.05],yaw:new THREE.Quaternion(),guardPose:{oneHand:WEAPONS[weapon].oneHandStance},
    alive:true,armed:true,state:'stand',armHealth:1,limbs:{armS:1,legF:1,legB:1},pain:0,
    finish:{amt:0},barge:null,lift:0,closeW:0,foeDistance:()=>Infinity,jolt:0,
    bodyPose:{pelvisYaw:0,chestYaw:0,pitch:0,drop:0}};
  f.skill=new Skill(f,.7);f.skill.autoGuard=true;
  f.prepareSwordsmanship=dt=>goals(f,dt);
  if(install)assert.equal(applySwordsmanship(f),weapon!=='pistol');
  return f;
}
// A simple independent raw goal surface for controller contracts. This does not
// replace the actual Fighter mapping or native physics in the separate probe.
function goals(f,dt=DT) {
  const x=f.skill.aim.x,y=f.skill.aim.y;
  return resolveSwordsmanshipGoals(f,dt,new THREE.Vector3(.5,.1+y,.05+x),
    new THREE.Vector3(1,y,x).normalize(),new THREE.Vector3(.5,.2,.2),new THREE.Vector3(1,.1,.15).normalize());
}
function step(f,id,{dx=0,dy=0,held=false,active=Math.hypot(dx,dy)>1e-5}={}) {
  f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=held;f.inputActive=active;
  assert(recordSwordsmanshipInput(f,{id,timeS:id*DT,dx,dy,held,active}));
  f.skill.update(DT);return goals(f);
}

test('melee roster installs once before control and guns/opponents stay untouched',()=>{
  for(const weapon of Object.keys(WEAPONS)) {
    const f=fixture(weapon,false),before=JSON.stringify({level:f.skill.level,autoGuard:f.skill.autoGuard,handBase:f.handBase,pad:f.handOffset.toArray()});
    const ok=applySwordsmanship(f);
    assert.equal(ok,weapon!=='pistol');
    assert.equal(hasSwordsmanship(f),weapon!=='pistol');
    if(ok){assert.equal(f.skill.level,0);assert.equal(f.skill.autoGuard,false);assert.equal(f.swordsmanshipState.profile.weaponId,weapon);}
    else assert.equal(JSON.stringify({level:f.skill.level,autoGuard:f.skill.autoGuard,handBase:f.handBase,pad:f.handOffset.toArray()}),before);
  }
  const opponent=fixture('qinggang',false);opponent.index=1;
  assert.equal(applySwordsmanship(opponent),false);assert.equal(opponent.swordsmanshipState,undefined);
});
test('weapon mismatch and stale/duplicate input cannot activate a controller',()=>{
  const f=fixture();assert(recordSwordsmanshipInput(f,{id:2,timeS:1,dx:0,dy:0,held:true,active:false}));
  assert.equal(recordSwordsmanshipInput(f,{id:2,timeS:1,dx:1,dy:0,held:true,active:true}),false);
  assert.equal(recordSwordsmanshipInput(f,{id:3,timeS:.5,dx:1,dy:0,held:true,active:true}),false);
  const before=f.swordsmanshipState.input;f.weapon=WEAPONS.rapier;
  assert.equal(hasSwordsmanship(f),false);assert.equal(recordSwordsmanshipInput(f,{id:4,timeS:2,dx:1,dy:0,held:true,active:true}),false);
  assert.equal(f.swordsmanshipState.input,before);
});
test('held input preserves pad and learned offset after the raw filter settles',()=>{
  const f=fixture(),pad=f.handOffset.toArray();
  for(let i=0;i<360;i++)step(f,i,{held:true});
  assert.deepEqual(f.handOffset.toArray(),pad);
  assert.equal(f.swordsmanshipState.phase,'holding');
  const correction=f.swordsmanshipState.handCorrection.toArray(),rotation=f.swordsmanshipState.aimCorrection.toArray();
  for(let i=360;i<450;i++)step(f,i,{held:true});
  assert.deepEqual(f.swordsmanshipState.handCorrection.toArray(),correction);
  assert.deepEqual(f.swordsmanshipState.aimCorrection.toArray(),rotation);
  assert.equal(f.skill.swings,0);assert.equal(f.skill.lunge,0);
});
test('released idle returns without counterfeit input velocity, new swings or new lunges',()=>{
  const f=fixture(),pad=f.handOffset.toArray();
  for(let i=0;i<25;i++){step(f,i);assert.deepEqual(f.handOffset.toArray(),pad);}
  let generated=0;
  for(let i=25;i<600;i++) {
    const state=step(f,i);generated+=Math.hypot(state.generatedDX,state.generatedDY)>1e-12;
    near(f.skill.vel.length(),0);assert.equal(f.skill.swinging,false);assert.equal(f.skill.swings,0);assert.equal(f.skill.lunge,0);near(f.skill.follow.length(),0);
  }
  assert(generated>0);assert.deepEqual(f.handOffset.toArray(),[...f.swordsmanshipState.profile.homePad]);
});
test('a real filtered drag followed by release reaches declared ready hand and aim',()=>{
  const f=fixture();let i=0;
  for(;i<90;i++)step(f,i,{dx:-.003,dy:.002,held:true});
  for(;i<690;i++)step(f,i);
  const s=f.swordsmanshipState;
  assert.deepEqual(f.handOffset.toArray(),[...s.profile.homePad]);
  assert(s.hand.distanceTo(new THREE.Vector3(...s.profile.homeHand))<.003,'Drag dead-band residual must not strand the ready hand');
  assert(s.aim.angleTo(new THREE.Vector3(...s.profile.homeDir))<.02,'Drag dead-band residual must not strand the ready aim');
  assert.equal(s.phase,'ready');
});
test('unmoving retouch immediately stops return and preserves the prepared offset',()=>{
  const f=fixture();for(let i=0;i<50;i++)step(f,i);
  assert(f.swordsmanshipState.returning);const pad=f.handOffset.toArray();
  step(f,50,{held:true});assert.deepEqual(f.handOffset.toArray(),pad);
  assert.equal(f.swordsmanshipState.generatedDX,0);assert.equal(f.swordsmanshipState.generatedDY,0);
  const h=f.swordsmanshipState.handCorrection.toArray(),q=f.swordsmanshipState.aimCorrection.toArray();
  for(let i=51;i<141;i++)step(f,i,{held:true});
  assert.deepEqual(f.swordsmanshipState.handCorrection.toArray(),h);assert.deepEqual(f.swordsmanshipState.aimCorrection.toArray(),q);
});
test('movement consumed before a zero-step render survives a later empty sample',()=>{
  const f=fixture();f.swordsmanshipState.idleS=1;
  assert(recordSwordsmanshipInput(f,{id:1,timeS:0,dx:.01,dy:0,held:false,active:true}));
  assert(recordSwordsmanshipInput(f,{id:2,timeS:.01,dx:0,dy:0,held:false,active:false}));
  const pad=f.handOffset.toArray();advanceSwordsmanship(f.skill,DT);
  assert(f.swordsmanshipState.moving);assert.deepEqual(f.handOffset.toArray(),pad);assert.equal(f.swordsmanshipState.generatedDX,0);
});
test('new mouse motion owns input even without a held pointer',()=>{
  const f=fixture();for(let i=0;i<50;i++)step(f,i);
  const wanted=f.handOffset.clone().add(new THREE.Vector2(-.02,.01));
  step(f,50,{dx:-.02,dy:.01,held:false});
  assert.deepEqual(f.handOffset.toArray(),wanted.toArray());assert(f.swordsmanshipState.moving);assert.equal(f.swordsmanshipState.generatedDX,0);
});
test('movement before the first physics step cannot be absorbed into startup offset',()=>{
  const quiet=fixture(),moved=fixture();
  const a=step(quiet,0,{held:true}),b=step(moved,0,{dx:.03,dy:.02,held:true});
  const dr=new THREE.Vector2(moved.skill.aim.y-quiet.skill.aim.y,moved.skill.aim.x-quiet.skill.aim.x);
  const dh=new THREE.Vector2(b.hand.y-a.hand.y,b.hand.z-a.hand.z);
  assert(dr.lengthSq()>1e-12,'Actual Skill filter exposed the first supplied gesture');
  assert(dh.dot(dr)/dr.lengthSq()>=C.retainedPlaneMotion-1e-9,'First real gesture must survive the installation reference');
});
test('sweeps and reversals retain declared planar projection and finite unit blade goals',()=>{
  for(const weapon of ['qinggang','longsword','rapier','morgenstern']) {
    const f=fixture(weapon);let projections=0,lastHand=null,lastRaw=null;
    for(let i=0;i<360;i++) {
      const sign=i<120?1:i<240?-1:1,state=step(f,i,{dx:.002*sign,dy:.0015*sign,held:true});
      // Independently reconstruct this fixture's raw plane and compare the
      // resolved hand displacement, rather than trusting a reported metric.
      const raw=new THREE.Vector3(.5,.1+f.skill.aim.y,.05+f.skill.aim.x);
      if(lastHand&&lastRaw) {
        const dr=raw.clone().sub(lastRaw),dh=state.hand.clone().sub(lastHand),den=dr.y**2+dr.z**2;
        if(den>1e-12){const projected=(dh.y*dr.y+dh.z*dr.z)/den;assert(projected>=C.retainedPlaneMotion-1e-9);projections++;}
      }
      assert(state.hand.toArray().every(Number.isFinite));assert(state.aim.toArray().every(Number.isFinite));near(state.aim.length(),1,1e-10);
      lastHand=state.hand.clone();lastRaw=raw;
    }
    assert(projections>300);
  }
});
test('recognized cuts preserve raw forward displacement while slow preparation remains active',()=>{
  const f=fixture('longsword');let lastHand=null,lastRaw=null,cutFrames=0,preparationFrames=0;
  for(let i=0;i<360;i++) {
    const slow=i<120,period=slow?240:72,angle=2*Math.PI*i/period;
    const wanted=new THREE.Vector2(.32*Math.cos(angle),.32*Math.sin(angle));
    const state=step(f,i,{dx:wanted.x-f.handOffset.x,dy:wanted.y-f.handOffset.y,held:true});
    const raw=new THREE.Vector3(.5,.1+f.skill.aim.y,.05+f.skill.aim.x);
    if(lastHand&&lastRaw) {
      const dr=raw.clone().sub(lastRaw),dh=state.hand.clone().sub(lastHand),den=dr.y**2+dr.z**2;
      if(den>1e-12) {
        const projection=(dh.y*dr.y+dh.z*dr.z)/den;
        if(f.skill.swinging){assert(projection>=1-1e-9,'Preparation must not subtract forward cut displacement');cutFrames++;}
        else if(state.handChangeM>1e-6)preparationFrames++;
      }
    }
    lastHand=state.hand.clone();lastRaw=raw;
  }
  assert(cutFrames>60);assert(preparationFrames>30);
});
test('synthetic unavailable states stop automatic return without native setters',()=>{
  for(const change of [f=>f.alive=false,f=>f.armed=false,f=>f.state='down',f=>f.state='getup',f=>f.pain=.7,f=>f.armHealth=.1,f=>f.limbs.legF=.1]) {
    const f=fixture();for(let i=0;i<50;i++)step(f,i);
    change(f);const pad=f.handOffset.toArray();advanceSwordsmanship(f.skill,DT);goals(f);
    assert.deepEqual(f.handOffset.toArray(),pad);assert.equal(f.swordsmanshipState.generatedDX,0);assert.equal(f.swordsmanshipState.generatedDY,0);
  }
});
test('paused controller cannot age its release timer or consume pending movement',()=>{
  const f=fixture();recordSwordsmanshipInput(f,{id:1,timeS:0,dx:.01,dy:0,held:false,active:true});
  const before=JSON.stringify(f.swordsmanshipState);
  for(const dt of [0,-1,NaN,Infinity])advanceSwordsmanship(f.skill,dt);
  assert.equal(JSON.stringify(f.swordsmanshipState),before);
});
test('normal explicit thrust captures its start and hands back the same underlying base',()=>{
  const f=fixture();for(let i=0;i<120;i++)step(f,i);
  const start=f.swordsmanshipState.hand.toArray(),dir=f.swordsmanshipState.aim.toArray();
  f.skill.tap={t:0,K:{aim:.1,recover:.2},h0:start,swordsmanshipBaseDir:dir};
  advanceSwordsmanship(f.skill,DT);let s=goals(f);
  assert.deepEqual(s.hand.toArray(),start);near(s.aim.angleTo(new THREE.Vector3(...dir)),0,1e-7);assert.equal(s.owner,'thrust');
  f.skill.tap.t=.2;f.skill.thrustPose.w=1;goals(f);
  f.skill.thrustPose.w=0;s=goals(f);const base=s.hand.toArray(),baseAim=s.aim.toArray();
  f.skill.tap=null;advanceSwordsmanship(f.skill,DT);s=goals(f);
  assert.deepEqual(s.hand.toArray(),base);near(s.aim.angleTo(new THREE.Vector3(...baseAim)),0,1e-7);
});
test('synthetic early abort withdraws captured start continuously before command removal',()=>{
  const f=fixture();goals(f);f.state='down';
  f.skill.tap={t:.04,K:{aim:.1,recover:.2},h0:[.3,.4,-.2],swordsmanshipBaseDir:[0,1,0],abort:{t:.04,w:.3}};
  advanceSwordsmanship(f.skill,DT);let last=goals(f).hand.clone(),maxStep=0;
  for(let i=1;i<=24;i++) {
    f.skill.tap.t=.04+i*DT;advanceSwordsmanship(f.skill,DT);
    const s=goals(f);maxStep=Math.max(maxStep,last.distanceTo(s.hand));last=s.hand.clone();
    assert(s.aim.toArray().every(Number.isFinite));near(s.aim.length(),1,1e-10);
  }
  assert(maxStep<.04);f.skill.tap=null;advanceSwordsmanship(f.skill,DT);near(last.distanceTo(goals(f).hand),0);
});
console.log(JSON.stringify({groups:cases.length,scope:'Real Skill input-filter/controller contracts with synthetic state/command fixtures; no physics combat or human-naturalness claim.',cases},null,2));
