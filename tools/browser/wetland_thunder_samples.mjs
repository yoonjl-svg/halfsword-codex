// Isolated previews through the same Web Audio bus and cached variants as play.
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:4193',out=process.argv[3]||'/tmp/thunder-samples';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),rows=[];
try{
 const page=await browser.newPage();await page.goto(base+'/night-encounters-4.html');
 for(let variant=0;variant<3;variant++){
  const data=await page.evaluate(async variant=>{
   const {Sound,makeRng}=await import('/src/sound.js');
   const {StageDetailSound,WETLAND_THUNDER_VARIANTS}=await import('/src/stage_detail_sound.js');
   const {SOUND}=await import('/src/config.js');
   const spec=WETLAND_THUNDER_VARIANTS[variant],sr=22050,c=new OfflineAudioContext(2,Math.ceil((spec.duration+.05)*sr),sr);
   const sound=new Sound();sound.ctx=c;sound.stage='sluice_night';sound.master=c.createGain();sound.master.gain.value=SOUND.volume;sound.master.connect(c.destination);
   const detail=new StageDetailSound(sound,makeRng),accepted=detail.event({kind:'wetlandThunder',amp:.8,seed:variant,time:0});
   const buffer=await c.startRendering();
   return {...spec,sr,accepted,stats:detail.stats,channels:[0,1].map(i=>Array.from(buffer.getChannelData(i)))};
  },variant);
  const n=data.channels[0].length,buf=Buffer.alloc(44+n*4);
  buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(data.sr,24);buf.writeUInt32LE(data.sr*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*4,40);
  let peak=0;for(let i=0;i<n;i++)for(let ch=0;ch<2;ch++){const v=data.channels[ch][i];peak=Math.max(peak,Math.abs(v));buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+(i*2+ch)*2)}
  fs.writeFileSync(`${out}/thunder-${data.name}.wav`,buf);
  rows.push({name:data.name,seconds:data.duration,accepted:data.accepted,stats:data.stats,peak});
 }
}finally{await browser.close()}
fs.writeFileSync(out+'/samples.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows.map(({stats,...r})=>r)));
if(rows.some(r=>!r.accepted||r.peak>=1||r.peak<=0))process.exitCode=1;
