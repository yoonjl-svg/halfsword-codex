import assert from 'node:assert/strict';
import {newRound,DT,THREE} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installOpposition} from '../../src/italian_opposition_research.js';
import {writeFileSync} from 'node:fs';
// Real simulated bodies, synthetic contact callback for lifecycle invariants only.
// These checks do not count as combat-benefit evidence.
const results=[];
for(const mode of ['release','exhaustion','explicitAttack','repeat','move']){
 const g=newRound({weapon:'rapier',weapon2:'longsword',gap:1.4,seed:9}),f=g.player,a=g.enemy;
 g.ai.update=()=>{};f.foe=a;a.foe=f;const guard=new PlayerParryGuard(f,a);f.stamina.controller=guard;
 const mod=installOpposition(f,a,guard,{variant:'slow',window:.32});guard.held=true;guard.step(DT);guard.active=true;guard.mode='defend';
 a.stamina.attack('cut');const c=f.bodies.chest.translation(),tip=a.bladePoint(1,new THREE.Vector3());a.tipVel.set(c.x-tip.x,c.y-tip.y,c.z-tip.z).normalize().multiplyScalar(4);
 f.stamina.block(a);const before=f.stamina.spent.attack;const clash=()=>mod.clash(f.bladePoint(0,new THREE.Vector3()),4,{fresh:true,vn:4});clash();assert.ok(mod.run);
 assert.equal(mod.events.filter(e=>e.type==='start').length,1);assert.ok(Math.abs(f.stamina.spent.attack-before-(7-3)*f.stamina.weight)<1e-8);
 if(mode==='release'){guard.held=false;f.skill.update(DT);assert.equal(mod.run,null);}
 if(mode==='exhaustion'){f.stamina.exhaustLeft=1;f.skill.update(DT);assert.equal(mod.run,null);}
 if(mode==='explicitAttack'){f.skill.thrust();f.skill.update(DT);assert.equal(mod.run,null);}
 if(mode==='repeat'){clash();mod.cancel('check');guard.held=false;guard.step(DT);guard.held=true;guard.step(DT);guard.active=true;clash();assert.equal(mod.run,null);assert.equal(mod.events.filter(e=>e.type==='start').length,1);}
 if(mode==='move'){f.move.set(.23,-.4);f.stickX=.23;f.stickY=-.4;f.skill.update(DT);assert.equal(f.move.x,.23);assert.equal(f.move.y,-.4);}
 results.push({mode,passed:true});g.world.free();
}
writeFileSync('raw/lifecycle-checks.json',JSON.stringify(results,null,2));console.log(results);
