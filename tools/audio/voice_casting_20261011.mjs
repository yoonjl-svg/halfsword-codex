// Recorded voice routing/rendering, not a claim of perceived age or acting quality.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const base=process.argv[2]||'http://127.0.0.1:4260',out=process.argv[3];assert(out);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const errors=[],rows=[];
try{const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/__voice_probe__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Recorded voice checks</title>'}));await page.goto(base+'/__voice_probe__');
for(const sr of [44100,48000]) {
 const result=await page.evaluate(async sr=>{
  const{Sound,VOICES}=await import('/src/sound.js');const results=[];
  for(const[id,profile]of Object.entries(VOICES)) {
   const off=new OfflineAudioContext(1,Math.round(sr*9),sr),s=new Sound();s.ctx=off;s.build();s.useSamples=true;
   await s.loadVoiceSamples([id]);const loaded={};
   for(const kind of ['ko','bleed','hurt','revive']){const expected=Array.isArray(profile.rec?.[kind])?profile.rec[kind].length:profile.rec?.[kind]||0;loaded[kind]=s.samples[`voice:${id}:${kind}`]?.length||0;if(loaded[kind]!==expected)throw Error(id+':'+kind+' not decoded');}
   const event=s.event.bind(s),events=[];s.event=opts=>{const e=event(opts);events.push(e);return e;};
   const kinds=['hurt','ko','bleed'];let gate=off.suspend(0),done=off.startRendering();
   for(let i=0;i<kinds.length;i++){await gate;if(i===0)s.hurt(id,.7);else s.death(id,i===1?'기절':'출혈');if(i<2)gate=off.suspend((i+1)*3);await off.resume();}
   const audio=await done,x=audio.getChannelData(0),windows=[];
   for(let j=0;j<3;j++){let peak=0,sum=0;for(let i=j*3*sr;i<(j+1)*3*sr;i++){const v=x[i];if(!Number.isFinite(v))throw Error('nonfinite');peak=Math.max(peak,Math.abs(v));sum+=v*v;}if(!(peak>0&&peak<1))throw Error(id+':'+kinds[j]+' silence or clipping');windows.push({kind:kinds[j],peak,rms:Math.sqrt(sum/(3*sr)),sources:events[j]?.srcs.length});}
   results.push({id,sr,loaded,windows});
  }
  return results;
 },sr);rows.push(...result);
}
assert.deepEqual(errors,[]);const names=['src/sound.js','src/characters_expansion.js','src/characters_wanderers.js','public/voice-casting.json'];const sources=Object.fromEntries(await Promise.all(names.map(async n=>[n,createHash('sha256').update(await fs.readFile(n)).digest('hex')])));
const report={pass:true,rows,errors,sources,completedUTC:new Date().toISOString(),limits:['Actual game Sound.build/loadVoiceSamples/hurt/death rendered in OfflineAudioContext.','Scheduled synthetic audio events; not natural combat wounds.','PCM/decoding checks cannot establish vocal age, naturalness, preference or phone loudness.']};await fs.writeFile(out+'/audio-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,profiles:rows.length/2,rates:2,renderedEvents:rows.length*3,errors}));
}finally{await browser.close();}
