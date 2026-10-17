import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gapGuard} from './chinese_gap_model.mjs';
import {single} from './chinese_gap_trials.mjs';
import {newRound,DT} from './harness_m.mjs';
import {live} from './chinese_benefit_live.mjs';
const out=process.env.GAP_OUT??'/workspace/chinese-parry-gap-20261017',checks=[];
const old=JSON.parse(readFileSync('/workspace/chinese-parry-benefit-20261017/screen-base.json'));
const rows=JSON.parse(readFileSync(`${out}/screen-base.json`));
rows.forEach((r,i)=>{for(const k of ['health','wounds','stamina'])assert.deepEqual(r[k],old[i][k]);});checks.push({name:'baseline-57-exact',passed:57});
for(const cfg of ['qinggang:basic','longsword','uchigatana'])for(const kind of ['gate20','inside']){
 const x={cfg,atk:'longsword',name:'zornhau',gap:1.5,press:.8},a=single(x,'base'),b=single(x,kind);
 for(const k of ['health','wounds','stamina'])assert.deepEqual(a[k],b[k]);
}checks.push({name:'school-scope-pairs',passed:6});
for(const kind of ['delay12','gate20','inside','inside-ready']){
 const G=newRound({weapon:'qinggang',weapon2:'longsword',seed:700,gap:2.2});G.park();const Guard=gapGuard(kind),g=new Guard(G.player,G.enemy);G.player.stamina.controller=g;
 G.before=()=>{g.held=G.t<.3;g.step(DT);G.player.inputActive=g.active;};while(G.t<.8)G.step();assert(!g.active&&!g.defLine);assert(!g.upperWait);assert.equal(G.player.stamina.spent.attack,0);assert.equal(G.player.skill._cover?.w??0,0);G.eventQueue.free();G.world.free();
}checks.push({name:'release-range-no-attack-charge',passed:4});
const v=JSON.parse(readFileSync(`${out}/visual.json`));assert.deepEqual(v.errors,[]);
for(const k of ['base','gate20']){const a=v.result.find(r=>r.kind===k&&r.health),b=live({kind:k,GuardOverride:gapGuard(k),seed:103,atk:'longsword',policy:'reactive',gap:2.2,seconds:4.2});assert.deepEqual(a.health,b.health);assert.equal(a.duration,b.duration);}
checks.push({name:'browser-node-damage-exact',passed:2});
const poses=JSON.parse(readFileSync(`${out}/pose.json`));assert.deepEqual(poses.errors,[]);
for(const p of poses.result){const n=single({cfg:'qinggang',atk:p.atk,name:p.name,gap:p.gap,press:p.press},p.kind);assert.deepEqual(p.health,n.health);}
checks.push({name:'pose-browser-node-damage-exact',passed:2});
writeFileSync(`${out}/verification.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
