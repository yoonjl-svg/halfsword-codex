import assert from 'node:assert/strict';
import {newRound,DT} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {PressOpposition,installPress,installPressDamage,adjustPressHit,PRESS_REFINED} from '../../src/italian_press_research.js';
const results=[];
function fixture(){const g=newRound({weapon:'rapier',weapon2:'sain',seed:941,gap:2.2});const p=g.player,a=g.enemy;const guard=new PlayerParryGuard(p,a);p.stamina.controller=guard;const m=installPress(p,a,guard);return {g,p,a,guard,m};}
function check(name,test){const f=fixture();try{test(f);results.push({name,pass:true});}finally{f.g.world.free();}}
const press=f=>{f.guard.held=true;f.guard.step(DT);f.m.update(DT);};
check('Input starts without a weapon clash or enemy attack',f=>{f.a.stamina.attackId=0;press(f);assert.equal(f.m.starts,1);assert.ok(f.m.run);assert.equal(f.m.events.filter(e=>e.type==='clashCue').length,0);});
check('Holding for 3 seconds does not repeat or retain mitigation',f=>{press(f);for(let i=0;i<720;i++){f.guard.step(DT);f.m.update(DT);}assert.equal(f.m.starts,1);assert.equal(f.m.protection(),0);});
check('A tap commits one attack and its bounded receiving window',f=>{press(f);f.guard.held=false;f.guard.step(DT);f.m.update(DT);assert.ok(f.m.run);assert.equal(f.m.protection(),.3);f.m.run.t=.41;assert.equal(f.m.protection(),0);});
check('Repress during the action cannot restart it or refresh its shield',f=>{press(f);f.guard.held=false;f.guard.step(DT);f.guard.held=true;f.guard.step(DT);assert.equal(f.m.starts,1);});
check('A fresh press after completion starts once more',f=>{press(f);for(let i=0;i<180;i++){f.guard.step(DT);f.m.update(DT);}f.guard.held=false;f.guard.step(DT);press(f);assert.equal(f.m.starts,2);});
check('One normal thrust cost and no receiving surcharge',f=>{const cost=f.p.stamina.value;press(f);const paid=cost-f.p.stamina.value;assert.ok(paid>0);const expected=fixture();expected.p.stamina.attack('thrust');assert.equal(paid,100-expected.p.stamina.value);expected.g.world.free();f.a.stamina.attack('cut');f.p.stamina.block(f.a);assert.equal(cost-f.p.stamina.value,paid);});
for(const [name,change] of [
 ['wrong weapon',f=>f.p.weapon={...f.p.weapon,id:'longsword'}],
 ['book unequipped',f=>f.p.schoolParry=false],
 ['down',f=>f.p.state='prone'],
 ['dead',f=>Object.defineProperty(f.p,'alive',{value:false})],
 ['unarmed',f=>Object.defineProperty(f.p,'armed',{value:false})],
 ['exhausted',f=>f.p.stamina.exhaustLeft=3],
 ['manual thrust',f=>f.p.skill.tap={t:0}],
 ['secret',f=>f.p.skill.sec={stage:'strike'}],
 ['broken input',f=>f.guard.broken=true],
])check(`Reject ${name}`,f=>{change(f);press(f);assert.equal(f.m.starts,0);});
check('Incapacity immediately removes attack and mitigation',f=>{press(f);f.p.state='prone';f.m.update(DT);assert.equal(f.m.run,null);assert.equal(f.m.protection(),0);});
check('Recovery has no mitigation',f=>{press(f);f.m.run.t=.43;assert.equal(f.m.protection(),0);});
check('Slow stamina cannot extend protection beyond .70 real seconds',f=>{press(f);f.m.run.age=.71;assert.equal(f.m.protection(),0);});
check('Sharp incoming damage uses severity only; no physical impulse multiplier',f=>{press(f);const h={type:'stab',severity:2,energy:50,ephys:40,pass:true};const r=adjustPressHit(h,f.a,f.p);assert.equal(r.severity,1.4);assert.equal(r.energy,50);assert.equal(r.ephys,40);assert.equal(r.pass,true);assert.equal(h.severity,2);});
check('Blunt incoming damage uses damage energy',f=>{press(f);const r=adjustPressHit({type:'blunt',severity:0,energy:50,ephys:40},f.a,f.p);assert.equal(r.energy,35);assert.equal(r.ephys,40);});
check('Outgoing attack is reduced and returns to normal after completion',f=>{press(f);const h={type:'stab',severity:2,energy:50};assert.equal(adjustPressHit(h,f.p,f.a).severity,1.2);f.m.cancel('test');assert.strictEqual(adjustPressHit(h,f.p,f.a),h);});
check('No-hit and unrelated fighters are unmodified',f=>{assert.equal(adjustPressHit(null,f.p,f.a),null);const h={type:'stab',severity:1,energy:40};assert.strictEqual(adjustPressHit(h,f.p,f.a),h);});
check('Contact cue cannot fake activation or repeat',f=>{f.m.onClash(f.a);assert.equal(f.m.starts,0);press(f);f.m.onClash(f.a);f.m.onClash(f.a);assert.ok(f.m.takeCue());assert.equal(f.m.takeCue(),null);assert.equal(f.m.events.filter(e=>e.type==='clashCue').length,1);});
check('Combat damage wrapper installs only once',f=>{installPressDamage(f.g.combat);const fn=f.g.combat.analyze;installPressDamage(f.g.combat);assert.strictEqual(f.g.combat.analyze,fn);});

check('Refined action protects through short recovery, then ends',f=>{Object.assign(f.m.cfg,PRESS_REFINED);press(f);f.m.run.t=.60;assert.equal(f.m.protection(),.65);f.m.run.t=.655;f.m.update(.01);assert.equal(f.m.run,null);assert.equal(f.m.protection(),0);});
check('Refined slow action has a real time protection ceiling',f=>{Object.assign(f.m.cfg,PRESS_REFINED);press(f);f.m.run.age=.851;assert.equal(f.m.protection(),0);});
check('Refined tap still commits one weak attack',f=>{Object.assign(f.m.cfg,PRESS_REFINED);press(f);f.guard.held=false;f.guard.step(DT);f.m.update(DT);assert.equal(f.m.starts,1);assert.equal(f.m.protection(),.65);assert.equal(f.m.outgoing(),.6);});
check('Refined incoming/outgoing combine without changing physical collision energy',f=>{Object.assign(f.m.cfg,PRESS_REFINED);press(f);const h={type:'cut',severity:2,energy:50,ephys:40};assert.ok(Math.abs(adjustPressHit(h,f.a,f.p).severity-.7)<1e-12);assert.equal(adjustPressHit(h,f.a,f.p).energy,50);assert.equal(adjustPressHit(h,f.p,f.a).severity,1.2);});
check('Real wound callback is forwarded exactly once',f=>{let n=0;f.g.combat.hooks.onWound=()=>n++;installPressDamage(f.g.combat);press(f);f.g.combat.hooks.onWound(f.p,f.a,{type:'stab',severity:.1});assert.equal(n,1);assert.equal(f.m.run.hitAt,f.m.run.t);});
check('Refined prediction and steering remain bounded and finite',f=>{Object.assign(f.m.cfg,PRESS_REFINED);press(f);f.m.run.target0.x+=.5;for(let i=0;i<65;i++)f.m.update(DT);for(const x of f.m.samples){assert.ok([...x.hand,...x.dir].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...x.dir)-1)<1e-6);}assert.equal(f.m.cfg.lead,.15);assert.equal(f.m.cfg.steer,12);assert.equal(f.m.cfg.steerRate,60);});
console.log(JSON.stringify({passed:results.length,results},null,2));
