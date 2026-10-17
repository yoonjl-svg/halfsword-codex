import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FLOW_REDESIGN,flowCandidate,spendFlowPenalty} from '../../src/nagashi_redesign.js';
import {FLOW_RECOVERY,flowRecoveryScale} from '../../src/nagashi_recovery.js';
import {newRound,DT} from './harness_m.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const rows=[],V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
Object.assign(FLOW_REDESIGN,{on:true,naturalExhaust:true});
function scenario({speed=V(-4,0,0),height=0,axis=V(0,0,1),blade=V(0,0,1),guard=true}={}){
 const p=V(.4,1.3+height,.05),D={index:0,alive:true,armed:true,state:'stand',stamina:{exhausted:false},schoolParry:true,skill:{_cover:{nagashi:{}}},parryGuard:{active:guard,held:guard,broken:false},bodies:{chest:{translation:()=>V(0,1.3,0)}},bladePoint:(t,out)=>out.copy(p).addScaledVector(blade,t-.3)};
 const O={index:1,alive:true,armed:true,state:'stand',swordProps:{},stamina:{attackId:1,time:1,attackUntil:2,exhausted:false}};
 const S={com:V(),p:V(),v:speed,w:V(),q:new THREE.Quaternion().setFromUnitVectors(V(0,1,0),axis)};
 return {D,O,S,p,n:V(1,0,0),call(t=1){return flowCandidate(D,O,S,p,this.n,4,t);}};
}
for(const [name,options,valid] of [
 ['upper-horizontal',{speed:V(-4,0,0)},true],
 ['upper-diagonal',{speed:V(-3,-3,0),height:.3},true],
 ['down-over-arm',{speed:V(1,-5,0),height:.1},true],
 ['axial-thrust',{speed:V(-4,0,0),axis:V(1,0,0)},false],
 ['retreating',{speed:V(4,0,0)},false],
 ['slow-bind',{speed:V(-.2,0,0)},false],
 ['below-waist',{height:-.5},false],
 ['not-guarding',{guard:false},false],
 ['tip-feeds-body',{blade:V(0,0,-1),height:0},false],
]){const c=scenario(options);if(name==='tip-feeds-body')c.p.z=.4;assert.equal(!!c.call(),valid,name);rows.push({name,valid});}
// First geometry is poor; the same real contact's guard/tangent can settle in
// the 120 ms window. Its start is not refreshed by later contact samples.
const c=scenario({guard:false});assert.equal(c.call(),null);c.D.parryGuard.active=true;c.D.parryGuard.held=true;
for(let t=1.02;t<1.12;t+=.02)assert(c.call(t));assert.equal(c.call(1.13),null);
assert(c.call(1.20)); // genuinely separated > the existing steel rearm interval.
c.O.flowSpentAttack=1;assert.equal(c.call(1.21),null);
c.O.stamina.attackId=2;assert.equal(c.call(1.22),null);assert(c.call(1.30));
c.O.stamina.flowAttackKind='thrust';assert.equal(c.call(1.31),null);
const noGuard=scenario();noGuard.D.parryGuard.broken=true;assert.equal(noGuard.call(),null);
noGuard.D.parryGuard.broken=false;noGuard.D.parryGuard.held=false;assert.equal(noGuard.call(),null);
const identities=scenario();identities.call();const second={...identities.D,index:2};
assert(flowCandidate(second,identities.O,identities.S,identities.p,identities.n,4,1.01));
assert.notEqual(identities.O.flowContactWindows.get(second),identities.O.flowContactWindows.get(identities.D));
identities.O.flowSpentAttack=1;
const another=scenario(); // another attacker can use the same numeric attack ID
assert(flowCandidate(identities.D,another.O,another.S,another.p,another.n,4,1.01));
rows.push({name:'contact-identity-and-false-guard',distinctDefenders:true,distinctAttackers:true,brokenRejected:true,releasedRejected:true});
rows.push({name:'contact-window',continuedAt110ms:true,expiredAt130ms:true,recontactAfterSeparation:true,noRepeatAttack:true});
const oldAttack=scenario();oldAttack.O.stamina.time=2.1;
assert.equal(oldAttack.call(2.1),null);assert.equal(oldAttack.D.flowCheck.reason,'attack-ended');
oldAttack.O.stamina.attackUntil=2.45; // actual swing renewal, not a new paid ID
assert(oldAttack.call(2.11));
rows.push({name:'attack-attribution-window',expiredIdRejected:true,renewedSlowSwingAccepted:true});
// Real engine stamina/controller/skill: exact one-off billing, inherited attack
// costs untouched, infinite equipment respected, natural exhaustion under guard.
for(const ai of [false,true]){
 const G=newRound({weapon:'uchigatana',weapon2:'longsword',seed:744});
 const f=ai?G.enemy:G.player,s=f.stamina;
 s.controller=ai?{mode:'defend',defVoid:false}:{held:true,broken:false};
 s.value=-40;s.attackId=8;
 const event=spendFlowPenalty(f,ai?G.player:G.enemy);
 assert.equal(event.before,-40);assert.equal(event.after,-70);assert.equal(event.actual,30);assert.equal(s.spent.flow,40);
 assert.equal(spendFlowPenalty(f,G.enemy),null);assert.equal(s.counts.flow,1);
 assert(s.exhausted);const saved=s.value;for(let i=0;i<20;i++)assert.equal(spendFlowPenalty(f,G.enemy),null);assert.equal(s.value,saved);
assert.equal(s.speed,0);assert.equal(f.skill.thrust(),false);
 let t=0,past=-1;while(s.exhausted){s.step(DT);t+=DT;const recovering=s.value;assert.equal(spendFlowPenalty(f,G.enemy),null);assert.equal(s.value,recovering);assert(s.value>=-70-1e-8);assert(s.value<=-35+1e-8);if(s.exhausted){assert(s.progress>=past);past=s.progress;assert.equal(s.speed,0);}}
 assert(Math.abs(t-(ai?35/15:35/21))<DT+1e-8);
 assert.equal(s.value,-35);assert.equal(s.level,2);assert.equal(spendFlowPenalty(f,G.enemy),null);s.step(DT);assert.equal(s.value,-35); // held guard stops normal recovery again.
 if(ai)s.controller.mode='idle';else s.controller.held=false;
 for(let i=0;i<Math.ceil(15/(ai?15:21)/DT);i++)s.step(DT);
 assert.equal(s.level,1);for(let i=0;i<Math.ceil(35/(ai?15:21)/DT);i++)s.step(DT);assert.equal(s.level,0);
 assert.equal(flowRecoveryScale(f),1);assert.equal(f.flowRecovery,undefined);
 rows.push({name:'actual-engine-exhaustion',role:ai?'AI':'player',seconds:t,unlock:-35,stageBack:[-20,15],guardIgnoredOnlyDuringExhaustion:true,noArmRecovery:true});
 s.setInfinite(true);s.attackId=9;const infinite=spendFlowPenalty(f,G.enemy);assert.equal(infinite.charged,false);assert.equal(s.value,s.max);
 G.world.free();G.eventQueue.free();
}
Object.assign(FLOW_REDESIGN,{on:false,naturalExhaust:false});assert.equal(FLOW_RECOVERY.seconds,0);
const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';mkdirSync(out,{recursive:true});writeFileSync(`${out}/implementation-checks.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
