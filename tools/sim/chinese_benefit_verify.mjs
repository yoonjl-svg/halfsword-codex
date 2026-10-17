import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {run,dir} from './chinese_benefit_screen.mjs';
import {guardClass} from './chinese_benefit_model.mjs';
import {trial} from './parry_reading_trials.mjs';
import {newRound,DT} from './harness_m.mjs';
const read=name=>JSON.parse(readFileSync(`${dir}/${name}.json`));
const old=JSON.parse(gunzipSync(readFileSync('docs/research/chinese_player_parry_20261017/raw/risk-paired.json.gz'))).filter(r=>r.kind==='base');
const key=r=>[r.atk,r.name,r.gap,r.press].join('|');const results=[];
for(const r of read('screen-base')){const o=old.find(o=>key(o)===key(r));assert(o);for(const k of ['wounds','stamina','alive','blood'])assert.deepEqual(r[k],o[k]);}
results.push({check:'base-57-prior-physics',passed:57});
for(const cfg of ['qinggang:basic','longsword','uchigatana'])for(const kind of ['compact-native','upper-retain','speed20']){
 const spec={cfg,atk:'longsword',name:'zornhau',gap:1.5,press:.8};const a=run(spec,'base'),b=run(spec,kind);
 for(const k of ['wounds','stamina','alive','blood'])assert.deepEqual(a[k],b[k]);
}
results.push({check:'scope-outside-chinese-parry',passed:9});
for(const kind of ['base','compact-native','compact','upper-retain']){
 const G=newRound({weapon:'qinggang',weapon2:'longsword',seed:700,gap:2.2});G.park();
 const Guard=guardClass(kind),g=new Guard(G.player,G.enemy);G.player.stamina.controller=g;
 G.before=()=>{g.held=G.t<.3;g.step(DT);G.player.inputActive=g.active;};
 while(G.t<.8)G.step();assert(!g.active&&!g.defLine);assert(G.player.stamina.spent.attack===0);
 assert((G.player.skill._cover?.w??0)===0);G.eventQueue.free();G.world.free();
}
results.push({check:'release-and-range-outside',passed:4});
// No extra physics mutation from health observation: native candidate with/without wrapper.
const spec={cfg:'qinggang',atk:'longsword',name:'unterhau',gap:1.5,press:1.0416666666666667};
const a=run(spec,'compact-native'),b=trial({...spec,playerModel:true,heldAt:t=>t+1e-9>=spec.press,Guard:guardClass('compact-native')});
for(const k of ['wounds','stamina','alive','blood'])assert.deepEqual(a[k],b[k]);
results.push({check:'health-observer-passive',passed:1});
writeFileSync(`${dir}/verification.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
