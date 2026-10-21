// node docs/design/kusanagi_20261021/verify.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { WEAPONS } from '../../../src/weapons.js';
import { weaponPhysics, classifyFrame } from '../../../src/weapon_class.js';
import { resolveSwordArt } from '../../../src/sword_art.js';
import { newRound, DT, CONFIG, AI } from '../../../tools/sim/harness_m.mjs';
import { PlayerParryGuard } from '../../../src/parry_button.js';
import { requestIai } from '../../../src/secret_instant.js';
import { TECH_BY_NAME } from '../../../src/ai_techniques.js';

const k = WEAPONS.kusanagi, u = WEAPONS.uchigatana;
const physics = weaponPhysics(k), baseline = weaponPhysics(u);
assert.equal(k.school, 'japanese'); assert.equal(k.tier, 'legend');
assert.equal(k.bladeLength, .75); assert.equal(k.power, 1.2);
assert.equal(k.mCut, 1.2); assert.equal(k.mThrust, 1.1);
assert(Math.abs(physics.mass-1.1)<1e-12);
assert.equal(classifyFrame({...k,frame:null}), 'two');
assert(physics.com-k.hiltLength>=.08 && physics.com-k.hiltLength<=.09);
assert(physics.I>0.1 && physics.I<baseline.I);
const grip=k.buildParts()[0];
for(const handY of [0,k.gripAlong])assert(Math.abs(handY-grip[1])<=grip[0][2]);
for(const impulse of [0,1,5,30,1000]) assert.equal(k.breakChance(impulse),0);
for(const persona of [null,{school:'kusanagi'}]) {
  const a=resolveSwordArt(k,persona), b=resolveSwordArt(u,persona?{school:'uchigatana'}:null);
  assert.equal(a.tradition,'japanese');
  for(const key of ['table','grip','parry','tech','offArm','motion']) assert.deepEqual(a[key],b[key],key);
  assert(a.measure.contact>0 && a.measure.reach>a.measure.contact && a.measure.cutTime>0);
}
CONFIG.ARENA.startHold=0;
class Quiet { update(){} }
const cases=[];
for(const weapon of ['uchigatana','kusanagi']) for(const action of ['cut','thrust','guard','iai']) {
  const g=newRound({weapon,weapon2:'longsword',gap:1.8,seed:7,AIClass:action==='guard'?AI:Quiet});
  const p=g.player, start=p.bladePoint(1).clone();
  const guard=new PlayerParryGuard(p,g.enemy);
  let active=false, finished=false, travel=0, previous=start, frames=0, started=false;
  const tech=TECH_BY_NAME.zornhau;
  g.before=t=>{
    if(action==='guard') {guard.held=t<2; active=guard.step(DT)||active; return;}
    if(t<.5){p.handOffset.set(...tech.from);return;}
    if(!started){started=true;if(action==='thrust')active=p.skill.thrust();if(action==='iai')requestIai(p,{player:true});}
    if(action==='cut') {
      const u=Math.min(1,(t-.5)/.35), n=u<.5?0:1, v=u<.5?u*2:(u-.5)*2;
      const pts=[tech.from,...tech.path], a=pts[n],b=pts[n+1];
      p.handOffset.set(a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v);p.inputActive=true;active=true;
    }
  };
  for(let i=0;i<3/DT;i++){
    g.step();const tip=p.bladePoint(1);
    assert([tip.x,tip.y,tip.z,...Object.values(p.sword.linvel())].every(Number.isFinite));
    travel+=tip.distanceTo(previous);previous=tip.clone();frames++;
    if(action==='iai'){active||=!!p.iai;finished||=!!p.instantResult;}
  }
  assert(active,`${weapon}/${action} did not activate`);
  if(action==='iai')assert(finished,`${weapon}/iai did not complete`);
  assert(travel>.1 && !p.weaponBroken);
  cases.push({weapon,action,active,finished:action==='iai'?finished:undefined,travel,frames,state:p.state,clashes:g.clashes,stamina:p.stamina.value});
  g.world.free();
}
const result={physics,baseline,comAheadOfBladeBase:physics.com-k.hiltLength,inertiaRatio:physics.I/baseline.I,
  schoolContracts:'player and AI Japanese definitions match uchigatana',cases,
  limitation:'Scripted compatibility and finite-state checks; not a win-rate or human feel test.'};
writeFileSync(new URL('./kusanagi-contracts.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
