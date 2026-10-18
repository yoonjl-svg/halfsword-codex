import {duel,OUT} from './iberian_ai_league.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const raw=Object.fromEntries(['native','outward'].map(v=>[v,JSON.parse(gunzipSync(readFileSync(`${OUT}/raw/${v}.json.gz`)))]));
const results=[];
for(const [i,row] of raw.native.entries())if(row.first!==null){
 const plain=duel(row.case,'native',{plain:true}),native=duel(row.case,'native'),outward=duel(row.case,'outward');
 const fields=['duration','result','health','enemy','breakTimes','modes','attacks'];
 for(const k of fields){assert.deepEqual(plain[k],native[k],`observer ${i} ${k}`);assert.deepEqual(native[k],row[k],`native replay ${i} ${k}`);assert.deepEqual(outward[k],raw.outward[i][k],`outward replay ${i} ${k}`);}
 assert((outward.motionPhases.sweep??0)>0,`No real sweep at ${i}`);
 results.push({i,case:row.case,plainEqualsNative:true,nativeExactReplay:true,outwardExactReplay:true,phases:outward.motionPhases,death:outward.health.death,first:outward.first,native,outward});
 console.log(JSON.stringify({i,checks:true,phases:outward.motionPhases,death:outward.health.death,first:outward.first}));
}
writeFileSync(`${OUT}/replay-checks.json.gz`,gzipSync(JSON.stringify(results)));
