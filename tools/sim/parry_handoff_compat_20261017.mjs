// Compatibility only: preserve recipient's optional Italian parry behavior.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {single} from './chinese_contact_trials.mjs';
import {SKILL} from '../../src/config.js';
const rows=[];
for(const [itRetreat,itParryBeat,itForte] of [[0,0,0],[1,0,0],[2,0,0],[0,1,0],[0,0,1],[0,0,2]]){
 Object.assign(SKILL,{itRetreat,itParryBeat,itForte});
 const cfg={cfg:'rapier',atk:'longsword',name:'zornhau',gap:1.6,press:.7};
 const a=single(cfg,'base'),b=single(cfg,'path');
 for(const k of ['health','wounds','stamina','transitions','stats'])assert.deepEqual(a[k],b[k],`${itRetreat}/${itParryBeat}/${itForte}/${k}`);
 assert.equal(b.contactStats.detected,0);
 rows.push({itRetreat,itParryBeat,itForte,equal:true,baseStats:a.stats});
}
Object.assign(SKILL,{itRetreat:0,itParryBeat:0,itForte:0});
const dir=process.env.HANDOFF_OUT??'/workspace/parry-research-handoff-20261017';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/italian-compat.json`,JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows));
