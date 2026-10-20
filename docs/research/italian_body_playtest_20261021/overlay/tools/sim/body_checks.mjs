// Gate checks with synthetic clashes on real bodies; not real play success or balance evidence.
import assert from 'node:assert/strict';
import {newRound,DT,THREE,CONFIG} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installBody} from '../../src/italian_body_research.js';
const saved=CONFIG.SKILL.itOppositionVals,rows=[];
const cases=[['away',true],['expired',true],['far',true],['recent-injury',true],['soft-contact',true],['all-relaxed',true],['resting-contact',false],['released',false],['broken',false],['inactive',false],['exhausted',false],['no-attack-yet',false],['cost-exhaustion',false]];
try{for(const body of [false,true])for(const [name,accept]of cases)for(const relaxed of [false,true]){
 CONFIG.SKILL.itOppositionVals={...saved,window:Infinity,...(relaxed?{relaxedContact:true,minVn:.2,maxGap:Infinity,injuryGrace:0}:{})};
 const g=newRound({weapon:'rapier',weapon2:'sain',gap:1.4,seed:9});
 try{
  const f=g.player,a=g.enemy;f.foe=a;a.foe=f;const guard=new PlayerParryGuard(f,a);f.stamina.controller=guard;const mode='strongBind',m=installBody(f,a,guard,mode,body);let steps=0;f.gait.requestStep=()=>{steps++;};
  guard.held=true;guard.step(DT);guard.active=true;guard.clock=m.pressed+5;
  a.stamina.attack('cut');a.tipVel.copy(f.bodies.chest.translation()).sub(a.bladePoint(1,new THREE.Vector3())).normalize().multiplyScalar(4);
  f.feel.point.copy(f.bladePoint(.4,new THREE.Vector3()));let vn=4;
  if(name==='away'||name==='all-relaxed')a.tipVel.negate();
  if(name==='expired'||name==='all-relaxed')a.stamina.time=a.stamina.attackUntil+3;
  if(name==='far'||name==='all-relaxed')f.foeDistance=()=>2.4;
  if(name==='recent-injury'||name==='all-relaxed')m.lastInjury=guard.clock;
  if(name==='soft-contact'||name==='all-relaxed')vn=.35;
  if(name==='resting-contact')vn=.1;
  if(name==='released')guard.held=false;
  if(name==='broken')guard.broken=true;
  if(name==='inactive')guard.active=false;
  if(name==='exhausted')f.stamina.exhaustLeft=1;
  if(name==='no-attack-yet')a.stamina.attackId=0;
  if(name==='cost-exhaustion')f.stamina.value=CONFIG.STAMINA.floor+.01;
  m.onClash(a,{vn});const expected=relaxed&&accept;assert.equal(!!m.run,expected,`${mode}/${name}/${relaxed}`);
  if(expected){
   assert.equal(m.events.filter(e=>e.type==='beat').length,1);const spent=f.stamina.spent.attack;
   m.onClash(a,{vn});assert.equal(f.stamina.spent.attack,spent);assert.equal(m.starts,1);assert.ok(m.takeCue());assert.equal(m.takeCue(),null);assert.equal(m.events.filter(e=>e.type==='cue').length,1);m.update(DT);assert.equal(steps,0);
   guard.held=false;m.update(DT);assert.equal(m.run,null);m.beginGuardStep();guard.held=true;m.beginGuardStep();m.onClash(a,{vn});assert.equal(m.starts,1,'same attack must not repeat after new press');
  }
  if(!expected)assert.equal(m.takeCue(),null);
  rows.push({mode,body,name,relaxed,accepted:!!expected,pass:true});
 }finally{g.world.free();}
}}finally{CONFIG.SKILL.itOppositionVals=saved;}
console.log(JSON.stringify({checks:rows.length,pass:true,rows}));
