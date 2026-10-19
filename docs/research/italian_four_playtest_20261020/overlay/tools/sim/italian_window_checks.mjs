// Boundary/lifecycle check with synthetic clash input on real Rapier bodies; not a success-rate study.
import assert from 'node:assert/strict';
import {newRound,DT,THREE,CONFIG} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installFollowup} from '../../src/italian_followup_research.js';
const saved=CONFIG.SKILL.itOppositionVals;
let checks=0;
try{
 for(const mode of ['usefulNear','usefulRoll','strongBind','strongThrust'])for(const [window,age,accepted] of [[.32,.8,false],[1,.8,true],[1,1.05,false]]){
  CONFIG.SKILL.itOppositionVals={...saved,window};
  const g=newRound({weapon:'rapier',weapon2:'longsword',gap:1.4,seed:9});
  try{
   const f=g.player,a=g.enemy;f.foe=a;a.foe=f;const guard=new PlayerParryGuard(f,a);f.stamina.controller=guard;
   const m=installFollowup(f,a,guard,mode);guard.held=true;guard.step(DT);guard.active=true;guard.clock=m.pressed+age;
   a.stamina.attack('cut');const tip=a.bladePoint(1,new THREE.Vector3());a.tipVel.copy(f.bodies.chest.translation()).sub(tip).normalize().multiplyScalar(4);
   f.feel.point.copy(f.bladePoint(.4,new THREE.Vector3()));m.onClash(a,{vn:4});assert.equal(!!m.run,accepted);
   assert.equal(m.events.filter(e=>e.type==='beat').length,accepted?1:0);
   if(accepted){const spent=f.stamina.spent.attack;m.onClash(a,{vn:4});assert.equal(m.events.filter(e=>e.type==='beat').length,1);assert.equal(f.stamina.spent.attack,spent);guard.held=false;m.update(DT);assert.equal(m.run,null);}
   checks++;
  }finally{g.world.free();}
 }
}finally{CONFIG.SKILL.itOppositionVals=saved;}
console.log(JSON.stringify({checks,pass:true,oldWindowRejectsAt:.8,newWindowAcceptsAt:.8,newWindowRejectsAt:1.05,oneImpulsePerAttack:true,releaseCancels:true}));
