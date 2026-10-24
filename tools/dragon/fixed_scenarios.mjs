import{setup,DT}from'./harness.mjs';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';import{GROUND_GROUPS}from'../../src/fighter.js';
const out=[];
function save(name,s){const r={name,health:s.d.health,stamina:s.f.stamina.value,spent:s.f.stamina.spent,playerAlive:s.f.alive,stats:s.d.stats,position:s.d.position.toArray(),head:s.d.model.pose.head.toArray(),player:s.f.pelvisPos};out.push(r);console.log(name,JSON.stringify(r));s.dispose();return r;}
for(const[attack,guard,dodge]of[['nip',false,false],['nip',true,false],['bite',true,false],['bite',false,true],['claw',true,false]]){
 const s=setup();s.d.cool=100;s.advance(2.2);s.moveTo(attack==='claw'?2.4:-1.3,attack==='claw'?2:0);s.g.held=guard;s.d.begin(attack);
 for(let i=0;i<2.3/DT;i++){s.f.move.set(dodge?1:0,0);s.f.stickX=dodge?1:0;s.tick();}
 save(attack+(guard?'_guard':'')+(dodge?'_dodge':''),s);
}
for(const covered of[true,false]){
 const s=setup();s.d.cool=100;s.advance(2.2);s.moveTo(-5,0);s.d.phase='active';s.d.attack='fire';s.d.phaseU=.5;s.d.fireHeading=Math.PI;s.d.firePitch=-.23;s.d.model.update(s.d,0);
 if(covered){const c=s.world.createCollider(s.R.ColliderDesc.cuboid(.7,1.5,1).setTranslation(-2,1.5,0).setCollisionGroups(GROUND_GROUPS));s.d.covers.push({collider:c});}s.world.step();s.d.updateFire();s.d.firePlayer();save('fire_'+(covered?'covered':'open'),s);
}
{
 const s=setup();s.d.cool=100;s.advance(30);const r=save('idle30',s);assert.deepEqual(r.position,[7.2,0,0]);assert.equal(r.stats.damageDealt,0);
}
writeFileSync('docs/design/dragon_fixed_20261024/scenarios.json',JSON.stringify(out,null,2));
