// Real AI/Skill command contracts; no native engine or contact claim.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AI } from '../../../src/ai.js';
import { Skill } from '../../../src/skill.js';
import { measureThrustDistance } from '../../../src/combat_distance.js';
import { prepareOpportunityRange, clearOpportunityRange } from '../../../src/opportunity_ai.js';
import { execFileSync } from 'node:child_process';

const base = '9171874a880024010a87ad793fd6fd58a7817f3e';
const oldSource = execFileSync('git', ['show', `${base}:src/ai.js`], {encoding:'utf8'})
  .replace(/from '([^']+)'/g, (_, p) => `from '${p.startsWith('.') ? new URL(p,new URL('../../../src/ai.js',import.meta.url)).href : import.meta.resolve(p)}'`);
const { AI: OldAI } = await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const body = (p,q=new THREE.Quaternion()) => ({translation:()=>p,rotation:()=>q});
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
function fixture(model='v4') {
  const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(1,0,0));
  const me={index:1,opportunityModel:model,alive:true,armed:true,state:'stand',vigor:1,side:1,
    weapon:{id:'rapier'},weaponCfg:{hiltLength:.15,bladeLength:.9},yaw:new THREE.Quaternion(),
    handOffset:new THREE.Vector2(.15,.1),handBase:[.4,0,.15],guardPose:{hand:[.4,0,.15]},
    sword:body(V(.4,1.4,.15),q),bodies:{chest:body(V(0,1.4,0)),pelvis:body(V())},
    forward:out=>out.set(1,0,0),move:new THREE.Vector2(),finish:{amt:0}};
  me.skill=new Skill(me);
  const ai=Object.assign(Object.create(AI.prototype),{me,foe:{alive:true,armed:true},mode:'attack',phase:'approach',
    M:{contact:1.5,clinch:1.2,reach:1.7},foeReach:2.1,level:{discipline:1},
    pers:{margin:.3,circleDir:1},guard:{name:'pflug'},patience:1,anger:0,fear:0,obsession:0,
    opportunityAttack:{kind:'thrust',started:false,episode:1,target:V(1.8,1.4,.15)},
    opportunityState:{attempts:0},stats:{aborted:0},path:[],closeInside:true,closeWant:true,closeArmed:true,
    stepT:.3,stepDelay:0,why:'open',foeClosing:0,contactDist:()=>.9});
  return ai;
}
function readyTarget(ai){
  const m=measureThrustDistance(ai.me,ai.opportunityAttack.target);
  ai.opportunityAttack.target.set(.4+m.preferred,1.4,.15);
}
check('v3/off hold distances preserve previous AI across weapon reach and morale',()=>{
  for(const model of ['off','v1','v2','v3'])for(const reach of [1.1,1.7,2.3])for(const chasing of [false,true]){
    const a=fixture(model);a.M.reach=reach;a.foe.armed=!chasing;
    assert.equal(a.holdDist(),OldAI.prototype.holdDist.call(a));
  }
});
check('v4 armed watch preference responds to own reach without changing chase or unarmed retreat',()=>{
  const a=fixture();const before=a.holdDist();a.M.reach+=.4;
  assert.ok(Math.abs(a.holdDist()-before-.1)<1e-12);
  for(const chasing of [true,false]){a.foe.armed=!chasing;a.me.armed=false;assert.equal(a.holdDist(),OldAI.prototype.holdDist.call(a));}
});
check('preparation keeps delayed target owned, keeps request state and never spends an attack',()=>{
  const a=fixture();const r=prepareOpportunityRange(a);assert.ok(r.valid);assert.ok(r.move>0);
  const request=a.me.skill.rangeAI;assert.notEqual(request.target,a.opportunityAttack.target);
  request.marker=17;a.opportunityAttack.target.x+=.02;prepareOpportunityRange(a);
  assert.equal(a.me.skill.rangeAI,request);assert.equal(request.marker,17);
  assert.equal(request.target.x,a.opportunityAttack.target.x);assert.equal(a.opportunityState.attempts,0);
});
check('too-close and too-far special thrusts position before a strike; ordinary close-shove cannot override',()=>{
  const a=fixture();a.opportunityAttack.target.x=.9;a.moveFeet(1/120,.9);assert.ok(a.me.move.y<0);
  assert.equal(a.startStrike(),false);assert.equal(a.opportunityState.attempts,0);
  a.opportunityAttack.target.x=2.2;a.moveFeet(1/120,2.2);assert.ok(a.me.move.y>0);
  assert.equal(a.startStrike(),false);assert.equal(a.opportunityState.attempts,0);
  readyTarget(a);a.moveFeet(1/120,.9);assert.equal(a.me.move.y,0);
});
check('kneeling preparation does not issue movement, and committed strike does not re-enter range control',()=>{
  const a=fixture();a.me.state='kneel';a.moveFeet(1/120,.9);assert.equal(a.me.move.y,0);
  a.me.state='stand';a.phase='strike';a.opportunityAttack.started=true;
  a.moveFeet(1/120,.9);assert.equal(a.me.move.y,0);assert.equal(a.me.move.x,0);
});
check('actual axis alignment is required before spending a special attempt',()=>{
  const a=fixture();readyTarget(a);a.me.sword=body(V(.4,1.4,.15));
  assert.ok(measureThrustDistance(a.me,a.opportunityAttack.target).ready);
  assert.equal(a.startStrike(),false);assert.equal(a.opportunityState.attempts,0);
});
check('abort, nonpreparing mode and held feet remove range ownership through Skill cancellation',()=>{
  for(const cause of ['abort','mode','held']){
    const a=fixture();prepareOpportunityRange(a);a.me.skill.prepareThrustRange(a.opportunityAttack.target,.1);
    assert.ok(a.me.skill.thrustPose.w>0);
    if(cause==='abort')a.abortAttack();else{if(cause==='mode')a.mode='defend';else a.me.feetHeld=true;prepareOpportunityRange(a);}
    assert.equal(a.me.skill.rangeAI,null);assert.equal(a.me.skill.rangePose,null);
    assert.equal(a.opportunityState.attempts,0);
  }
});
check('v3 special close retreat is byte-for-value unchanged',()=>{
  for(const d of [.9,1.3,1.7]){
    const a=fixture('v3'),b=fixture('v3');a.phase=b.phase='strike';a.stepT=b.stepT=0;
    a.moveFeet(1/120,d);OldAI.prototype.moveFeet.call(b,1/120,d);
    assert.deepEqual(a.me.move.toArray(),b.me.move.toArray());
    assert.equal(a.me.stickX,b.me.stickX);assert.equal(a.me.stickY,b.me.stickY);
  }
});
console.log(JSON.stringify({checks:checks.length,nativeRuns:0,passed:checks},null,2));
