import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {createWetlandStorm} from '../../src/wetland_storm.js';
import {STAGE_DETAIL_PROFILES,synthStageDetail} from '../../src/stage_detail_sound.js';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const rows=[];
for(const seed of [161026,1,38,20261016]){
 function run(dt){const clock=createWetlandStorm(seed),events=[];for(let t=0;t<120-1e-8;t+=dt)clock.update(dt,e=>events.push(e));return {clock,events}}
 const a=run(1/30),b=run(1/120);assert.deepEqual(a.events,b.events);
 for(let group=0;group<12;group++){
  const flashes=a.events.filter(e=>e.group===group&&e.type==='flash'),thunder=a.events.filter(e=>e.group===group&&e.type==='thunder');
  assert.ok(flashes.length===1||flashes.length===2);assert.ok(thunder.length<=1);
  if(flashes.length===2)assert.ok(flashes[1].at-flashes[0].at>=.65);
  if(thunder.length){const delay=thunder[0].at-flashes.at(-1).at;assert.ok(delay>=1.3&&delay<=2.4)}
 }
 const saved={...a.clock.state};for(const dt of [0,-1,NaN,Infinity])a.clock.update(dt);assert.deepEqual(a.clock.state,saved);
 rows.push({seed,flashes:a.events.filter(e=>e.type==='flash').length,thunders:a.events.filter(e=>e.type==='thunder').length,events:a.events});
}
assert.ok(rows.some(r=>r.events.some(e=>e.type==='thunder'&&e.flashes===2)));
const old=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','4c77620f:src/stage_detail_sound.js'])).toString('base64'));
for(const kind of Object.keys(old.STAGE_DETAIL_PROFILES))assert.deepEqual(synthStageDetail(kind,8000,random(123)),old.synthStageDetail(kind,8000,random(123)));
const pcm=synthStageDetail('wetlandThunder',22050,random(123));let peak=0,sq=0;for(const v of pcm){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sq+=v*v}
assert.ok(peak>0&&peak<1);assert.equal(pcm.length,Math.ceil(3.8*22050));
const report={pass:true,frameRates:[30,120],secondsPerSeed:120,rows,unchangedSoundKinds:Object.keys(old.STAGE_DETAIL_PROFILES).length,thunder:{peak,rms:Math.sqrt(sq/pcm.length),seconds:3.8}};
fs.writeFileSync(process.argv[2]||'/tmp/wetland-storm-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:rows.map(({events,...r})=>r)}));
