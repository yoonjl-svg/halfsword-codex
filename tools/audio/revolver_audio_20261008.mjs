// Actual Sound/gun reload synthesis via OfflineAudioContext; no physics or human loudness claim.
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out=process.argv[2];assert(out);await fs.mkdir(out,{recursive:false});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['src/sound.js','src/gun.js','src/config.js','tools/audio/revolver_audio_20261008.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(names.map(async n=>[n,sha(await fs.readFile(n))])));
const before=await manifest(),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage(),errors=[],rows=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/__audio_probe__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Local audio measurement</title>'}));
try {
 await page.goto('http://127.0.0.1:4160/__audio_probe__');
 for(const sr of [44100,48000])for(const kind of ['shot','round','six']) {
 const data=await page.evaluate(async({sr,kind})=>{
  const {Sound,makeRng}=await import('/src/sound.js');const {GUN,loadRoundSound,gateOpenSound,reloadSound}=await import('/src/gun.js');
  const prior=Math.random;let calls=0;const rng=makeRng(73);Math.random=()=>{calls++;return rng();};
  try{
   const duration=kind==='six'?10:2,off=new OfflineAudioContext(1,sr*duration,sr),s=new Sound();s.useSamples=false;s.unlock(off);
   for(const name of ['gunshot','gunTail'])while(s.need(name))s.makeOne(name);
   const events=[],event=s.event.bind(s);s.event=opts=>{const e=event(opts);events.push({time:off.currentTime,gain:opts.gain,event:e});return e;};
   const startCalls=calls;let pcm;
   if(kind==='shot'){s.gunshot();pcm=await off.startRendering();}
   else if(kind==='round'){loadRoundSound(s);pcm=await off.startRendering();}
   else{
    const times=[0,...Array.from({length:GUN.rounds},(_,i)=>GUN.reloadOpen+(GUN.reload-GUN.reloadOpen-GUN.reloadClose)*(i+.5)/GUN.rounds),GUN.reload];
    let stop=off.suspend(0),done=off.startRendering();
    for(let i=0;i<times.length;i++){await stop;if(i===0)gateOpenSound(s);else if(i===times.length-1)reloadSound(s);else loadRoundSound(s);if(i+1<times.length)stop=off.suspend(times[i+1]);await off.resume();}
    pcm=await done;
   }
   const x=pcm.getChannelData(0);let peak=0,sum=0;for(const v of x){if(!Number.isFinite(v))throw Error('Nonfinite PCM');peak=Math.max(peak,Math.abs(v));sum+=v*v;}
   const windows=events.map(({time,gain,event})=>{let sum=0;const a=Math.floor(time*sr),b=Math.min(x.length,a+Math.ceil(.3*sr));for(let i=a;i<b;i++)sum+=x[i]*x[i];return{time,gain,sources:event.srcs.length,rms:Math.sqrt(sum/(b-a))};});
   let b='';const bytes=new Uint8Array(x.buffer);for(let i=0;i<bytes.length;i+=16384)b+=String.fromCharCode(...bytes.subarray(i,i+16384));
   return{sr,kind,peak,rms:Math.sqrt(sum/x.length),randomCalls:calls-startCalls,events:windows,pcm:btoa(b)};
  }finally{Math.random=prior;}
 },{sr,kind});
 const pcm=Buffer.from(data.pcm,'base64');delete data.pcm;data.pcmSHA256=sha(pcm);const samples=pcm.length/4,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm.readFloatLE(i*4)))*32767),44+i*2);
 data.wav=kind+'-'+sr+'.wav';await fs.writeFile(path.join(out,data.wav),wav);await fs.writeFile(path.join(out,kind+'-'+sr+'.f32'),pcm);assert(data.peak<1&&data.rms>0);if(kind==='six'){assert.equal(data.events.length,8);assert(data.events.slice(1,7).every(e=>e.sources===2&&e.rms>0));}rows.push(data);
 }
 const after=await manifest();assert.deepEqual(before,after);assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({pass:true,source:before,errors,rows},null,2)+'\n');console.log(JSON.stringify({pass:true,out,rows:rows.map(({kind,sr,peak,rms,randomCalls})=>({kind,sr,peak,rms,randomCalls}))}));
}finally{await browser.close();}
