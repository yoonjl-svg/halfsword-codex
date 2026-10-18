import assert from 'node:assert/strict';
import {newRound,DT} from './harness_m.mjs';
import {installControlRecovery} from './contact_control_recovery.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const rows=[];
for(const floor of [.25,.10])for(const hold of [.06,.60]){
 const G=newRound({weapon:'longsword',weapon2:'zweihander',seed:720});G.park();for(let i=0;i<240;i++)G.step();
 const f=G.player,c=installControlRecovery(f,{floor,seconds:hold+.24,holdSeconds:hold});f.stamina.attackId=12;
 const physical=()=>JSON.stringify([f.sword.translation(),f.sword.linvel(),f.sword.angvel(),f.handOffset.toArray(),f.move.toArray()]);
 const start=f.stamina.time,before=physical();assert(c.begin(G.enemy));assert.equal(before,physical());assert(!c.begin(G.enemy));
 f.stamina.time=start+hold*.5;assert.equal(c.scale(),floor);
 f.stamina.time=start+hold+.12;assert(Math.abs(c.scale()-(floor+1)/2)<1e-10);
 f.stamina.time=start;
 const p=f.bodies.pelvis.translation();let min=1;
 for(let i=0;i<Math.ceil((hold+.3)/DT);i++){f.move.set(0,1);f.handHeld=true;f.inputActive=true;f.handOffset.x+=DT;G.step();min=Math.min(min,f._studyControlScale);}
 assert.equal(min,floor);assert.equal(c.scale(),1);assert(!c.begin(G.enemy));
 while(f.stamina.time<start+hold+.24+.13)G.step();f.stamina.attackId=13;assert(c.begin(G.enemy));
 const move=Math.hypot(f.bodies.pelvis.translation().x-p.x,f.bodies.pelvis.translation().z-p.z);assert(move>.01);
 rows.push({floor,hold,recover:.24,min,midRecovery:(floor+1)/2,restored:true,noInstantWrites:true,noSameAttackRepeat:true,newAttack:true,moved:move});G.eventQueue.free();G.world.free();
}
const out='docs/research/iberian_control_duration_20261018/checks';mkdirSync(out,{recursive:true});writeFileSync(`${out}/controls.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
