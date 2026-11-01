// Research recorder invariance, not a gameplay balance test.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {drillRun} from './special_balance.mjs';
import {observeRound,BASE} from './balance_core_20261101.mjs';
import * as C from '../../src/config.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const checks=[];
for(const row of ['chinese','kote','rdHold']){
 let recorded;
 const common={dur:9,normalDamage:true,oneShot:true,distance:1.2,preCombo:false,sjit:0,jit:0,spd:[4,4]};
 const plain=drillRun(row,171,{...common,onInit(G,P){P.humanInput=true;}});
 const observed=drillRun(row,171,{...common,onInit(G,P){recorded=observeRound(G,{tech:row});}});
 assert.deepEqual(observed,plain,`${row}: recorder changed physics result`);
 const result=recorded.finish();assert.equal(result.humanInput,true);assert.equal(result.gear.maxStamina,100);assert.equal(result.gear.infinite,false);
 checks.push({row,pass:true,rawHash:sha(JSON.stringify(plain)),events:result.events.length});
}
const files=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n');
for(const f of files)assert.equal(sha(fs.readFileSync(f)),sha(execFileSync('git',['show',`${BASE}:${f}`])),`Gameplay source changed: ${f}`);
const out={base:BASE,checkedAt:new Date().toISOString(),checks,sourceFilesCompared:files.length,gameplaySourceUnchanged:true,timeScale:C.TIME.k};
fs.mkdirSync('docs/research/attack_balance_20261101/validation',{recursive:true});
fs.writeFileSync('docs/research/attack_balance_20261101/validation/recorder-invariance.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
