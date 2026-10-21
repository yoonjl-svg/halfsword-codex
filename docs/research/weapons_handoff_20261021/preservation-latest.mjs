import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {WEAPONS as after} from '../../../src/weapons.js';
import {LOOKS} from '../../../src/looks.js';
const base=process.argv[2];assert(base,'pass exact receiver baseline checkout');
const {WEAPONS:before}=await import(pathToFileURL(base+'/src/weapons.js'));
const here=new URL('./',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('source-manifest.json',here)));
for(const f of manifest.files){const b=fs.readFileSync(f.path);assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);assert.deepEqual(b,execFileSync('git',['show',manifest.source+':'+f.path],{maxBuffer:20e6}));}
for(const [id,w] of Object.entries(before)){
 const old=JSON.parse(JSON.stringify(w)),current=JSON.parse(JSON.stringify(after[id]));
 if(id==='rapier')for(const k of ['tier','power','durability','fragility']){delete old[k];delete current[k];}
 assert.deepEqual(current,old,id+' metadata');assert.deepEqual(after[id].buildParts(LOOKS.player),w.buildParts(LOOKS.player),id+' physical parts');
}
assert.deepEqual(after.monohoshizao.secretBlade,before.monohoshizao.secretBlade);assert.equal(after.monohoshizao.secretBlade.k,1);assert.equal(after.kusanagi.secretBlade,undefined);
assert.equal(after.rapier.durability,.8);assert.equal(before.rapier.durability,.85);assert.equal(after.dartagnan.durability,.95);
const oldSmoke=fs.readFileSync(new URL('latest-before/weapon_smoke.stdout',here),'utf8').trim().split('\n');
const newSmoke=fs.readFileSync(new URL('latest-after/weapon_smoke.stdout',here),'utf8').trim().split('\n');assert.deepEqual(newSmoke.slice(0,oldSmoke.length),oldSmoke);
const oldDraw=JSON.parse(fs.readFileSync('docs/research/weapon_draw_update_20261021/current.json'));const newDraw=JSON.parse(fs.readFileSync(new URL('latest-receiver-draw.json',here)));delete oldDraw.source;delete newDraw.source;assert.deepEqual(newDraw,oldDraw);
const report={originalFilesPreserved:manifest.files.length,originalBytes:manifest.files.reduce((n,f)=>n+f.bytes,0),existingWeaponsPreserved:Object.keys(before).length,rapierExceptions:['tier','power','durability','fragility'],existingSmokeRowsIdentical:oldSmoke.length,newSmokeRows:newSmoke.length,latestJapaneseBonusPreserved:after.monohoshizao.secretBlade,kusanagiNoBonus:true,drawAllConditionsIdentical:true};
fs.writeFileSync(new URL('latest-preservation.json',here),JSON.stringify(report,null,2)+'\n');console.log(report);
