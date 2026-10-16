// Real scheduler and Web Audio classes, with natural gaps and rain ambience.
// The 14s excerpt also supplies the audio for the unchanged weather footage.
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:4193',out=process.argv[3]||'/tmp/thunder-flow';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),rows=[];
try{
 const page=await browser.newPage();await page.goto(base+'/night-encounters-4.html');
 for(const range of [{name:'thunder-flow',start:0,seconds:80},{name:'weather-excerpt',start:60.008,seconds:14}]){
  const data=await page.evaluate(async range=>{
   const {Sound,makeRng}=await import('/src/sound.js');
   const {StageDetailSound}=await import('/src/stage_detail_sound.js');
   const {createWetlandStorm}=await import('/src/wetland_storm.js');
   const {SOUND}=await import('/src/config.js');
   const clock=createWetlandStorm(),events=[];
   clock.update(range.start+range.seconds,e=>{if(e.type==='thunder'&&e.at>range.start)events.push({kind:'wetlandThunder',amp:e.amp,variant:e.variant,seed:e.group,time:e.at})});
   const sr=22050,c=new OfflineAudioContext(2,Math.ceil(range.seconds*sr),sr),s=new Sound();
   s.ctx=c;s.stage='sluice_night';s.seed=161026;s.master=c.createGain();s.master.gain.value=SOUND.volume;s.master.connect(c.destination);
   const detail=new StageDetailSound(s,makeRng);detail.ambience();
   const scheduled=events.map(e=>({e,promise:c.suspend(e.time-range.start)})),render=c.startRendering(),accepted=[];
   for(const {e,promise} of scheduled){await promise;accepted.push({ok:detail.event(e),...detail.stats.last});await c.resume()}
   const buffer=await render;
   return {sr,events,accepted,channels:[0,1].map(i=>Array.from(buffer.getChannelData(i)))};
  },range);
  const n=data.channels[0].length,buf=Buffer.alloc(44+n*4);
  buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(data.sr,24);buf.writeUInt32LE(data.sr*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*4,40);
  let peak=0;for(let i=0;i<n;i++)for(let ch=0;ch<2;ch++){const v=data.channels[ch][i];peak=Math.max(peak,Math.abs(v));buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+(i*2+ch)*2)}
  fs.writeFileSync(`${out}/${range.name}.wav`,buf);rows.push({...range,peak,events:data.events,accepted:data.accepted});
 }
}finally{await browser.close()}
fs.writeFileSync(out+'/flow.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows.map(({events,accepted,...r})=>({...r,events:events.length,allAccepted:accepted.every(e=>e.ok)}))));
if(rows.some(r=>r.accepted.some(e=>!e.ok)||r.peak>=1||r.peak<=0))process.exitCode=1;
