import {setup,DT} from './harness.mjs';
import {writeFileSync} from 'node:fs';
import {GUN_HOOKS} from '../../src/gun.js';
import {GROUND_GROUPS} from '../../src/fighter.js';
const out=[];
function save(name,s,extra={}){const f=s.f;const result={name,player:{state:f.state,alive:f.alive,stamina:f.stamina.value,blood:f.blood,spent:{...f.stamina.spent},pos:{...f.pelvisPos}},dragon:s.d.snapshot(),...extra};out.push(result);console.log(name,JSON.stringify({hits:s.d.stats.hitsTaken,blocks:s.d.stats.blocked,cover:s.d.stats.coverStops,bossDamage:s.d.stats.damageDealt,stamina:f.stamina.value,...extra}));s.dispose();}
for(const [attack,guard,dodge] of [['nip',false,false],['nip',true,false],['bite',true,false],['bite',false,true],['claw',true,false],['tail',true,false]]) {
 const s=setup();s.d.cool=100;s.advance(2.2);s.moveTo(s.d.position.x-(attack==='claw'?2.8:attack==='tail'?-3:3.5),attack==='tail'?.35:0);s.g.held=guard;s.d.begin(attack);if(dodge){s.f.move.set(1,0);s.f.stickX=1;}
 s.advance(2.2);save(attack+(guard?'_guard':'')+(dodge?'_dodge':''),s);
}
for(const covered of[true,false]){
 const s=setup();s.advance(2.2,{brain:false});s.d.position.set(2.3,0,0);s.d.heading=Math.PI;s.d.attack='fire';s.d.phase='active';s.d.phaseU=.5;s.d.model.update(s.d,0);s.moveTo(-5,0);
 if(covered){const c=s.world.createCollider(s.R.ColliderDesc.cuboid(.7,1.5,1).setTranslation(-3,1.5,0).setCollisionGroups(GROUND_GROUPS));s.d.covers.push({collider:c});}
 s.world.step();s.d.updateFire();s.d.firePlayer();save('fire_'+(covered?'covered':'open'),s,{fireLength:s.d.fireLength});
}
for(const axis of[[1,0],[0,-1]])for(const scale of[1,1.5]){
 const s=setup({scale,x:-20});s.d.position.set(20,0,0);s.advance(2.2,{brain:false});s.f.move.set(...axis);s.f.stickX=axis[0];s.f.stickY=axis[1];const p={...s.f.pelvisPos};s.advance(2.5,{brain:false});const q=s.f.pelvisPos;save('move_'+axis+'_'+scale,s,{distance:Math.hypot(q.x-p.x,q.z-p.z)});
}
{
 const s=setup({weapon:'pistol'});GUN_HOOKS.onImpact=(_f,p)=>s.d.bulletImpact(p);s.d.position.set(0,0,0);s.advance(2.2,{brain:false});s.moveTo(-4.6,0);
 for(let i=0;i<10/DT;i++){if(i%140===0)s.f.skill.thrust();s.tick({brain:false});}save('pistol_shots',s,{gun:s.f.gun});GUN_HOOKS.onImpact=null;
}
writeFileSync('docs/design/dragon_20261024/scenarios.json',JSON.stringify(out,null,2));
