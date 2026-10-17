import assert from 'node:assert/strict';
import {newRound,DT} from './harness_m.mjs';
import {beginFlowRecovery,FLOW_RECOVERY} from '../../src/nagashi_recovery.js';
import {trial} from './japanese_recovery.mjs';
import {writeFileSync} from 'node:fs';
const rows=[];Object.assign(FLOW_RECOVERY,{seconds:.36,release:true});
// Real engine body: no impulses/velocity edits at activation; one attack once;
// inputs and movement survive, scale restores, new round has no inherited state.
const G=newRound({weapon:'longsword',weapon2:'uchigatana',seed:720});G.park();
const f=G.player;for(let i=0;i<240;i++)G.step();f.stamina.attackId=12;
const v=JSON.stringify([f.sword.linvel(),f.sword.angvel(),f.sword.translation()]);
assert(beginFlowRecovery(f,G.enemy));const first=f.flowRecovery;
assert.equal(v,JSON.stringify([f.sword.linvel(),f.sword.angvel(),f.sword.translation()]));
assert(!beginFlowRecovery(f,G.enemy));assert.equal(f.flowRecovery,first);
const x0=f.bodies.pelvis.translation();let min=1;
for(let i=0;i<50;i++){f.move.set(0,1);f.handHeld=true;f.inputActive=true;f.handOffset.x+=DT;G.step();min=Math.min(min,f.flowArmScale);}
assert.equal(f.flowArmScale,1);assert(min<.4);assert(f.move.length()>0);
const dx=Math.hypot(f.bodies.pelvis.translation().x-x0.x,f.bodies.pelvis.translation().z-x0.z);assert(dx>.01);
// Prevent an old attack recontact even after the refractory period.
for(let i=0;i<60;i++)G.step();f.stamina.attackId=12;assert(!beginFlowRecovery(f,G.enemy));
f.stamina.attackId=13;assert(beginFlowRecovery(f,G.enemy));
rows.push({type:'actual-body-recovery',noActivationTeleport:true,noStack:true,movement:dx,minScale:min,restored:true,newAttackAllowed:true});G.world.free();G.eventQueue.free();
Object.assign(FLOW_RECOVERY,{seconds:0,release:false});
for(const opts of [{weapon:'longsword',book:true},{weapon:'uchigatana',book:false}]){
 const a=trial({...opts,seed:512,atk:'qinggang',policy:'riposte',seconds:12,duration:0,release:false});
 const b=trial({...opts,seed:512,atk:'qinggang',policy:'riposte',seconds:12,duration:.36,release:true});
 const pick=r=>JSON.stringify({health:r.health,enemy:r.enemy,commands:r.commands,timeline:r.timeline});
 assert.equal(pick(a),pick(b));assert.equal(b.events.length,0);rows.push({type:'scope',...opts,identical:true});
}
writeFileSync(`${process.env.OUT??'/workspace/japanese-recovery-20261017'}/checks.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
