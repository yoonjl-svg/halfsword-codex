// Complete late first-proc five-second windows; selection depends only on timing.
// Preserve original 30s files. All four arms extended for the same late cases.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {compareTrial,OUT} from './iberian_talho_outward.mjs';
const plan=JSON.parse(readFileSync(`${OUT}/plan.json`)),cfg=plan.configs.find(c=>c.id===process.env.ARM);
const original=JSON.parse(gunzipSync(readFileSync(`${OUT}/raw/${cfg.id}.json.gz`)));
const selected=original.flatMap((r,i)=>r.observation.first>25?[i]:[]);const rows=[];
for(const i of selected){
 const r=compareTrial({...plan.cases[i],seconds:35},cfg),a=original[i];
 for(const side of ['health','enemy'])assert.deepEqual(a[side].applied,r[side].applied.filter(h=>h.t<a.duration-1e-8));
 assert.deepEqual(a.commands,r.commands.filter(c=>c.t<a.duration-1e-8));
 assert.equal(a.observation.prefixHash,r.observation.prefixHash);
 rows.push({i,row:r});
}
mkdirSync(`${OUT}/extended`,{recursive:true});writeFileSync(`${OUT}/extended/${cfg.id}.json.gz`,gzipSync(JSON.stringify(rows)));console.log(cfg.id,selected,'prefix30 damage/commands identical');
