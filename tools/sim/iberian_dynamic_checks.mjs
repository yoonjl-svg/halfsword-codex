import assert from 'node:assert/strict';
import {live} from './iberian_beat_live.mjs';
import {measured,CONFIGS,OUT} from './iberian_dynamic_study.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const report={checks:[]},fixture={seed:941,atk:'longsword',policy:'slash',reaction:.18,seconds:16};
const plain=live(fixture),observed=measured('live',CONFIGS[0],fixture);
for(const key of ['health','enemy','commands','clashes','guard','aiTechniques','duration'])assert.deepEqual(plain[key],observed[key],key);
report.checks.push('Observer preserves health, inputs, contacts and results in a 16-second baseline');
let released=0,active=0;
const cfg=CONFIGS.find(c=>c.id==='lateral');
measured('probe',cfg,{attack:'zwerch',gap:1.6,onStart(G,guard){const before=G.before;G.before=()=>{before();if(G.t>1.18){guard.held=false;guard.step(0);}};},onFrame(G,guard){
 const s=G.player.skill._dynamicBeat;if(s.run)active++;
 if(G.t>1.20){assert.equal(s.run,null);released++;}
 assert.equal(G.combat.iberianBeat,undefined);
}});
assert.ok(active>0&&released>0);report.checks.push('Sweep starts, stops on release; no extra collision impulse hook');
for(const opt of [{book:false},{weapon:'longsword'}])measured('live',cfg,{...fixture,...opt,seconds:2,onFrame(G){assert.equal(G.player.skill._dynamicBeat,undefined);}});
report.checks.push('No install without the Iberian block book / on another school');
mkdirSync(`${OUT}/checks`,{recursive:true});writeFileSync(`${OUT}/checks/implementation.json`,JSON.stringify(report,null,2));console.log(report);
