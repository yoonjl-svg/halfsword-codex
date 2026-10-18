import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {live} from './iberian_beat_live.mjs';
import {trial,OUT} from './iberian_contact_study.mjs';
import {installAiContactSweep} from './iberian_contact_sweep.mjs';
const cfg=JSON.parse(readFileSync(`${OUT}/candidate-outward.json`)),report={checks:[]};
const fixture={seed:941,atk:'longsword',policy:'slash',reaction:.18,seconds:8};
const a=live(fixture),b=trial('live',{id:'base'},fixture);
for(const key of ['health','enemy','commands','clashes','guard','aiTechniques','duration'])assert.deepEqual(a[key],b[key],key);
report.checks.push('Baseline observer preserves actual damage, commands, clashes and result exactly');
for(const opt of [{book:false},{weapon:'longsword'}])trial('live',cfg,{...fixture,...opt,seconds:1,onFrame(G){assert.equal(G.player.skill._contactSweep,undefined);}});
report.checks.push('No installation without the book or on another school');
let tested=false;
trial('probe',cfg,{attack:'zornhau',gap:1.4,onFrame(G,g){
 assert.equal(G.combat.iberianBeat,undefined);
 const f=G.player,s=f.skill._contactSweep;if(tested||!s.run)return;
 const run=s.run,sk=f.skill,reset=()=>{f.state='stand';f.armed=true;f.stamina.exhaustLeft=0;g.held=true;g.broken=false;sk.tap=null;sk.pom=null;sk.sec=null;s.run=run;};
 const values={state:f.state,armed:f.armed,exhaustLeft:f.stamina.exhaustLeft,held:g.held,broken:g.broken,tap:sk.tap,pom:sk.pom,sec:sk.sec};
 for(const [name,change] of [['release',()=>g.held=false],['attack',()=>g.broken=true],['thrust',()=>sk.tap={}],['pommel',()=>sk.pom={}],['secret',()=>sk.sec={}],['exhaustion',()=>f.stamina.exhaustLeft=1],['death',()=>f.state='dead'],['disarm',()=>f.armed=false]]){
  reset();change();g.step(0);assert.equal(s.run,null,name);assert.equal(s.speed,0,name);report.checks.push(`Immediate ${name} cancellation`);
 }
 Object.assign(f,{state:values.state,armed:values.armed});f.stamina.exhaustLeft=values.exhaustLeft;Object.assign(g,{held:values.held,broken:values.broken});Object.assign(sk,{tap:values.tap,pom:values.pom,sec:values.sec});tested=true;
}});assert.ok(tested,'Must exercise an actual physical activation');
let aiState,aiChecks=0;
trial('live',{id:'base'},{seed:1201,weapon:'longsword',atk:'zweihander',policy:'slash',seconds:12,
 onStart(G){aiState=installAiContactSweep(G.enemy,G.ai,cfg);assert.ok(aiState);},
 onFrame(G){const f=G.enemy;assert.ok(Number.isFinite(f.skill.guardDrive));if(G.ai.mode!=='defend'){assert.equal(aiState.run,null);assert.equal(f.skill.guardDrive,0);aiChecks++;}assert.equal(G.combat.iberianBeat,undefined);}
});report.checks.push(`AI ordinary decisions retained; no stale guard drive outside defense (${aiChecks} steps; ${aiState.events.length} activations)`);
const source=readFileSync('tools/sim/iberian_contact_sweep.mjs','utf8');
for(const forbidden of ['applyImpulse','addTorque','setLinvel','setAngvel','setRotation','setTranslation'])assert.ok(!source.includes(forbidden),forbidden);
report.checks.push('Installer contains no direct rigid-body velocity, position, torque or impulse writes');
mkdirSync(`${OUT}/checks`,{recursive:true});writeFileSync(`${OUT}/checks/implementation.json`,JSON.stringify(report,null,2));console.log(report);
