import assert from 'node:assert/strict';
import {newRound,DT,THREE,CONFIG} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installStep} from '../../src/italian_step_research.js';
CONFIG.SKILL.itOppositionVals={...CONFIG.SKILL.itOppositionVals,window:Infinity,relaxedContact:true,minVn:.2,maxGap:Infinity,injuryGrace:0};
const cases=['forward','neutral','backward','sideways','deadzone','move-only','kneel','feet-held','inactive-gait','busy-request','draw-pending','too-close','exhausted','cost-exhaustion','released','step-off'];const results=[];
function fixture(){const g=newRound({weapon:'rapier',weapon2:'sain',gap:1.4,seed:9}),f=g.player,a=g.enemy;f.foe=a;a.foe=f;const guard=new PlayerParryGuard(f,a);f.stamina.controller=guard;const m=installStep(f,a,guard);guard.held=true;guard.step(DT);guard.active=true;guard.clock=m.pressed+5;f.gait.active=true;Object.defineProperty(f,'feetHeld',{value:false,writable:true,configurable:true});f.state='stand';f.stickY=.4;f.move.set(0,.4);a.stamina.attack('cut');f.feel.point.copy(f.bladePoint(.4,new THREE.Vector3()));return {g,f,a,guard,m};}
for(const name of cases){const {g,f,a,guard,m}=fixture();try{
 const gait=f.gait;
 if(name==='neutral')f.stickY=0;
 if(name==='backward')f.stickY=-.4;
 if(name==='sideways'){f.stickY=0;f.stickX=.5;f.move.set(.5,0);}
 if(name==='deadzone')f.stickY=.15;
 if(name==='move-only')f.stickY=0;
 if(name==='kneel')f.state='kneel';
 if(name==='feet-held')f.feetHeld=true;
 if(name==='inactive-gait')gait.active=false;
 if(name==='busy-request')gait.req={kind:'pass',fwd:.5};
 if(name==='draw-pending')gait.drawPending={t:0};
 if(name==='too-close')f.foeDistance=()=>.9;
 if(name==='exhausted')f.stamina.exhaustLeft=1;
 if(name==='cost-exhaustion')f.stamina.value=CONFIG.STAMINA.floor+.01;
 if(name==='released')guard.held=false;
 if(name==='step-off')m.stepEnabled=false;
 const prior=gait.req;m.onClash(a,{vn:4});assert.equal(!!m.stepRequest,name==='forward',name);
 if(prior)assert.equal(gait.req,prior,'must not overwrite another technique');
 if(name==='forward'){assert.equal(gait.req.fwd,.2);assert.equal(gait.req.duration,.28);m.onClash(a,{vn:4});assert.equal(m.events.filter(e=>e.type==='stepQueued').length,1);}
 results.push({name,pass:true});
}finally{g.world.free();}}
for(const kind of ['pending-release','pending-back','queue-expiry','active-release','superseded','completed']){const {g,f,a,guard,m}=fixture();try{
 m.onClash(a,{vn:4});const own=f.gait.req;assert.ok(own);
 if(kind==='pending-release'){guard.held=false;m.beginGuardStep();assert.equal(f.gait.req,null);}
 if(kind==='pending-back'){f.stickY=-.4;f.move.y=-.4;m.update(DT);assert.equal(f.gait.req,null);}
 if(kind==='queue-expiry'){guard.clock+=.29;m.syncStep();assert.equal(f.gait.req,null);}
 if(kind==='active-release'){const leg=f.gait.legs.F;leg.stance=false;leg.kind='req';const target=leg.p1.toArray();f.stickY=0;m.syncStep();assert.equal(f.gait.req,own);assert.equal(own.push,0);assert.deepEqual(leg.p1.toArray(),target);assert.equal(m.events.filter(e=>e.type==='stepStarted').length,1);}
 if(kind==='superseded'){const next=f.gait.req={kind:'pass',fwd:.3};m.cancel('manual');assert.equal(f.gait.req,next);}
 if(kind==='completed'){m.cancel('complete');assert.equal(f.gait.req,null);}
 results.push({name:kind,pass:true});
}finally{g.world.free();}}
console.log(JSON.stringify({checks:results.length,synthetic:true,pass:true,results}));
