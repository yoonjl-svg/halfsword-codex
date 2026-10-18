import assert from 'node:assert/strict';
import {newRound,DT} from './harness_m.mjs';
import {installControlRecovery} from './contact_control_recovery.mjs';
import {strengthTrial,CANDIDATE} from './iberian_control_strength.mjs';
import {trial} from './iberian_contact_study.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const results=[];
for(const floor of [.25,0]){
 const G=newRound({weapon:'longsword',weapon2:'zweihander',seed:720});G.park();for(let i=0;i<240;i++)G.step();
 const f=G.player,c=installControlRecovery(f,{floor});f.stamina.attackId=12;
 const physical=()=>JSON.stringify([f.sword.translation(),f.sword.linvel(),f.sword.angvel(),f.handOffset.toArray(),f.move.toArray()]);
 const before=physical();assert(c.begin(G.enemy));assert.equal(before,physical());assert(!c.begin(G.enemy));
 const p=f.bodies.pelvis.translation();let min=1;
 for(let i=0;i<60;i++){f.move.set(0,1);f.handHeld=true;f.inputActive=true;f.handOffset.x+=DT;G.step();min=Math.min(min,f._studyControlScale);}
 assert.equal(min,floor);assert.equal(c.scale(),1);assert(!c.begin(G.enemy));f.stamina.attackId=13;assert(c.begin(G.enemy));
 const move=Math.hypot(f.bodies.pelvis.translation().x-p.x,f.bodies.pelvis.translation().z-p.z);assert(move>.01);
 results.push({floor,noInstantBodyOrInputWrites:true,noRepeat:true,min,restored:true,newAttack:true,moved:move});G.eventQueue.free();G.world.free();
}
const opt={attack:'zornhau',atk:'longsword',gap:1.4,counter:true};
const a=trial('probe',CANDIDATE,opt),b=strengthTrial(opt,1,'probe');
const pick=r=>JSON.stringify([r.health,r.enemy,r.commands,r.motions,r.samples]);assert.equal(pick(a),pick(b));
results.push({observerAndAdapterNeutral:true,motions:b.motions.length});
for(const floor of [.25,0]){
 const r=strengthTrial({...opt,book:false},floor,'probe');assert.equal(r.motions.length,0);assert.equal(r.controlEvents.length,0);
 results.push({floor,bookDisabledNoEffect:true});
}
mkdirSync('docs/research/iberian_control_strength_20261018/checks',{recursive:true});writeFileSync('docs/research/iberian_control_strength_20261018/checks/implementation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
