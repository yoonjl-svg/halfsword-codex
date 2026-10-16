import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {createWetlandStorm} from '../../src/wetland_storm.js';
import {STAGE_DETAIL_PROFILES,synthStageDetail,WETLAND_THUNDER_VARIANTS} from '../../src/stage_detail_sound.js';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const previousStorm=await import('../fixtures/wetland_storm_before_dynamics.mjs');
const rows=[];
for(const seed of [161026,1,38,20261016]){
 function run(dt){const clock=createWetlandStorm(seed),events=[];for(let t=0;t<120-1e-8;t+=dt)clock.update(dt,e=>events.push(e));return {clock,events}}
 const a=run(1/30),b=run(1/120);assert.deepEqual(a.events,b.events);
 const oldClock=previousStorm.createWetlandStorm(seed),oldEvents=[];
 for(let t=0;t<120-1e-8;t+=1/30)oldClock.update(1/30,e=>oldEvents.push(e));
 const timing=events=>events.map(e=>e.type==='thunder'?{type:e.type,at:e.at,group:e.group,flashes:e.flashes}:e);
 assert.deepEqual(timing(a.events),timing(oldEvents));
 const sounds=a.events.filter(e=>e.type==='thunder');
 assert.equal(new Set(sounds.map(e=>e.variant)).size,3);
 assert.ok(sounds.every((e,i)=>e.amp>=.55&&e.amp<=.95&&(!i||e.variant!==sounds[i-1].variant)));
 assert.ok(sounds.some(e=>e.amp<.65));
 assert.ok(sounds.some((e,i)=>e.variant!==e.group%3));
 for(let group=0;group<12;group++){
  const flashes=a.events.filter(e=>e.group===group&&e.type==='flash'),thunder=a.events.filter(e=>e.group===group&&e.type==='thunder');
  assert.ok(flashes.length===1||flashes.length===2);assert.ok(thunder.length<=1);
  assert.ok(flashes[0].at-group*10>=2&&flashes[0].at-group*10<=6);
  assert.ok(flashes.every(e=>e.at>=group*10&&e.at<(group+1)*10));
  if(flashes.length===2){const gap=flashes[1].at-flashes[0].at;assert.ok(gap>=.65&&gap<=3.7)}
  if(thunder.length){const delay=thunder[0].at-flashes[0].at;assert.ok(delay>=2.3&&delay<=4.4)}
 }
 const saved={...a.clock.state};for(const dt of [0,-1,NaN,Infinity])a.clock.update(dt);assert.deepEqual(a.clock.state,saved);
 rows.push({seed,flashes:a.events.filter(e=>e.type==='flash').length,thunders:sounds.length,timingUnchanged:true,minAmp:Math.min(...sounds.map(e=>e.amp)),maxAmp:Math.max(...sounds.map(e=>e.amp)),events:a.events});
}
assert.ok(rows.some(r=>r.events.some(e=>e.type==='thunder'&&e.flashes===2)));
const old=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','eaf75841c165bc87d9d469c25a0afaaf4746e991:src/stage_detail_sound.js'])).toString('base64'));
for(const kind of Object.keys(old.STAGE_DETAIL_PROFILES))assert.deepEqual(synthStageDetail(kind,8000,random(123)),old.synthStageDetail(kind,8000,random(123)));
const thunder=WETLAND_THUNDER_VARIANTS.map(({name,duration},variant)=>{
 const pcm=synthStageDetail('wetlandThunder',22050,random(123),variant);let peak=0,sq=0;
 for(const v of pcm){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sq+=v*v}
 assert.ok(peak>0&&peak<1);assert.equal(pcm.length,Math.ceil(duration*22050));
 assert.ok(pcm[0]===0&&pcm.at(-1)===0);
 const windows=[];for(let start=0;start<pcm.length;start+=5512){let energy=0;const end=Math.min(pcm.length,start+5512);for(let i=start;i<end;i++)energy+=pcm[i]**2;windows.push(Math.sqrt(energy/(end-start)))}
 if(variant===2)assert.ok(windows[13]>windows[11], 'long thunder must swell again after three seconds');
 return {name,seconds:duration,peak,rms:Math.sqrt(sq/pcm.length),quarterSecondRms:windows};
});
const report={pass:true,frameRates:[30,120],secondsPerSeed:120,rows,unchangedSoundKinds:Object.keys(old.STAGE_DETAIL_PROFILES).length,thunder};
fs.writeFileSync(process.argv[2]||'/tmp/wetland-storm-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:rows.map(({events,...r})=>r)}));
