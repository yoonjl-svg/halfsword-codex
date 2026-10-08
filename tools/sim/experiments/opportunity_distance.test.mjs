// Command/ownership tests, not contact or efficacy measurements.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Skill } from '../../../src/skill.js';
import { THRUST } from '../../../src/config.js';
import { measureThrustDistance } from '../../../src/combat_distance.js';
const checks = [], check = (name, fn) => { fn(); checks.push(name); };
const body = p => ({ translation: () => ({...p}), rotation: () => ({x:0,y:0,z:0,w:1}) });
function fixture(gap=1.3, model='v4') {
 const head={x:gap,y:1.25,z:0}, chest={x:gap,y:1,z:0}, pelvis={x:gap,y:.9,z:0};
 const foe={index:1,state:'kneel',alive:true,armed:false,headR:.1,balance:30,offBalance:.3,vigor:1,
  bodies:{head:body(head),chest:body(chest),pelvis:body(pelvis)}};
 const sword=body({x:.45,y:1.25,z:0});
 sword.rotation=()=>({x:0,y:0,z:-Math.SQRT1_2,w:Math.SQRT1_2});
 const f={index:0,opportunityModel:model,alive:true,armed:true,state:'stand',side:1,foe,
  weapon:{id:'rapier'},weaponCfg:{edged:true,mCut:1,mBlunt:1,mThrust:1,hiltLength:.1,bladeLength:1},
  bodies:{chest:body({x:0,y:1.33,z:0})},sword,yaw:new THREE.Quaternion(),
  forward:o=>o.set(1,0,0),handOffset:new THREE.Vector2(.1,.1),handBase:[.45,-.08,0],
  guardPose:{hand:[.45,-.08,0],oneHand:true},guardWeight:()=>1,finishEntryModel:'legacy',finish:{on:false,amt:0},
  stickX:0,stickY:0,move:new THREE.Vector2(),foeDistance:()=>gap};
 f.skill=new Skill(f,.7); return {f,foe,head,chest,pelvis};
}
check('actual grip geometry retreats when crowded and advances when far, with weapon-dependent band',()=>{
 const {f}=fixture();
 const close=measureThrustDistance(f,new THREE.Vector3(.8,1.25,0));
 const far=measureThrustDistance(f,new THREE.Vector3(2,1.25,0));
 assert(close.move<0 && far.move>0); assert(!close.ready&&!far.ready);
 f.weaponCfg.bladeLength=.6;
 const short=measureThrustDistance(f,new THREE.Vector3(2,1.25,0));
 assert(short.preferred<far.preferred); assert(short.reach<=THRUST.reach);
 assert.equal(measureThrustDistance(f,new THREE.Vector3(-1,1,0)).valid,false);
});
check('an angularly close axis must also pass through the small target corridor',()=>{
 const {f}=fixture();
 const m=measureThrustDistance(f,new THREE.Vector3(1.55,1.4,0));
 assert(m.alignment>Math.cos(20*Math.PI/180));assert(m.lineMiss>.07);assert(!m.aligned);
});
check('a ray missing the arm reach sphere cannot supply fictitious arm travel',()=>{
 const {f}=fixture(); f.sword=body({x:1,y:1.8,z:1});
 const m=measureThrustDistance(f,new THREE.Vector3(-.5,1.8,1));
 assert.equal(m.armTravel,0);assert.equal(m.reach,0);
});
check('preparation reserves arm travel in the rotated shoulder frame without adding damage mass',()=>{
 const {f}=fixture();f.handBase=[.7,.2,.15];
 f.bodies.chest.rotation=()=>({x:0,y:Math.sin(.2),z:0,w:Math.cos(.2)});
 f.skill.prepareThrustRange(new THREE.Vector3(1.55,1.25,0),.1);
 const q=new THREE.Quaternion(0,Math.sin(.2),0,Math.cos(.2));
 const shoulder=new THREE.Vector3(0,.1,.2).applyQuaternion(q);
 assert(new THREE.Vector3(...f.skill.thrustPose.hand).distanceTo(shoulder)<=.481);
 assert(!f.skill.thrustPush);assert(f.skill.activity>0);
});
check('two-hand preparation brings the hilt onto the line while preserving raw hand input',()=>{
 const {f}=fixture();f.weaponCfg.twoHand=true;f.handBase=[.4,0,.32];
 const raw=f.handOffset.clone();const start=.32;
 for(let i=0;i<90;i++)f.skill.prepareThrustRange(new THREE.Vector3(1.7,1.25,0),1/120);
 assert(f.skill.thrustPose.hand[2]<start-.2);assert.deepEqual(f.handOffset,raw);assert(!f.skill.thrustPush);
});
check('tap queues movement without counting an attack, force phase or forced body movement',()=>{
 const {f}=fixture(); const s=f.skill;
 assert(s.thrust()); assert(s.thrustRange); assert.equal(s.tap,null); assert.equal(s.thrusts,0);
 s.updateThrustRange(1/120); assert(f.move.y<0); assert.equal(s.thrustPush,false);
 assert.deepEqual(f.sword.translation(),{x:.45,y:1.25,z:0});
});
check('new manual stick or hand input cancels preparation and does not fire later',()=>{
 for (const kind of ['stick','hand']) {
  const {f}=fixture(); f.skill.thrust();
  if(kind==='stick')f.stickY=.5; else f.handOffset.x+=.1;
  f.skill.updateThrustRange(1/120);
  assert.equal(f.skill.thrustRange,null); assert.equal(f.skill.tap,null);
  assert.equal(f.skill.lastThrustRange.reason,'manual-input');
 }
});
check('time limit and lost opening do not produce an off-range thrust',()=>{
 for(const why of ['time','stand','dead']){
  const {f,foe}=fixture();f.skill.thrust();
  if(why==='time')f.skill.thrustRange.age=2.1;
  if(why==='stand')foe.state='stand'; if(why==='dead')foe.alive=false;
  f.skill.updateThrustRange(1/120); assert.equal(f.skill.tap,null);assert.equal(f.skill.thrustRange,null);
 }
});
check('explicit reset releases prepared pose; pause cannot leave a pending player attack',()=>{
 const {f}=fixture();f.skill.thrust();f.skill.updateThrustRange(.1);
 assert(f.skill.thrustPose.w>0);f.skill.clearThrustRange('input-reset');
 f.skill.updateThrustRange(.2);assert.equal(f.skill.thrustPose.w,0);assert.equal(f.skill.tap,null);
});
check('ready/aligned preparation commits once with original attack timing and no extra lunge',()=>{
 const {f}=fixture(1.56);const s=f.skill;assert(s.thrust());
 for(let i=0;i<30&&!s.tap;i++)s.updateThrustRange(1/120);
 assert(s.tap?.rangePrepared); assert.equal(s.thrusts,1);assert.equal(s.lunge,0);
 assert.deepEqual(s.tap.K,{aim:THRUST.aim,extend:THRUST.extend,hold:THRUST.hold,recover:THRUST.recover,reach:THRUST.reach});
 const target=[...s.tap.opportunity.target]; f.foe.bodies.head=body({x:4,y:4,z:4});
 s.updateThrust(.02);assert.deepEqual(s.tap.opportunity.target,target);
});
check('legacy v3 retains immediate tap and movement intent bypasses automatic repositioning',()=>{
 const {f}=fixture(1.3,'v3');assert(f.skill.thrust());assert(f.skill.tap);assert(!f.skill.thrustRange);
 const {f:manual}=fixture();manual.stickX=.5;assert(manual.skill.thrust());assert(manual.skill.tap);assert(!manual.skill.thrustRange);
});
console.log(JSON.stringify({pass:true,nativeSteps:0,checks}));
