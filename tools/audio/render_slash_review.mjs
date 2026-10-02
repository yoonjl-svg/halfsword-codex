// Local render: node tools/audio/render_slash_review.mjs URL OUT_DIR
// Uses the actual Sound.cut + event/bus/limiter path, with isolated bank/layer overrides.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const base=process.argv[2] || 'http://127.0.0.1:4198';
const out=process.argv[3] || '/workspace/halfsword-sound-review/2026-10-02';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto(base+'/sounds.html');
const rows=[];
try {
  for(const variant of ['current','edge','cleave']) for(const [kind,energy,through,seed] of [
    ['heavy',140,false,71],['heavy',140,false,172],['heavy',140,false,273],['cut',90,false,71],['through',110,true,71],
  ]) {
    const data=await page.evaluate(async({variant,kind,energy,through,seed})=>{
      const {Sound,makeRng}=await import('/src/sound.js');
      const {slashReview}=await import('/tools/audio/slash_review_candidate.mjs');
      const originalRandom=Math.random;
      Math.random=makeRng(seed);
      try {
        const sr=48000, off=new OfflineAudioContext(1,Math.round(sr*1.55),sr);
        const s=new Sound(); s.seed=seed; s.useSamples=true; s.fleshHit='samsho'; s.hitScale='legacy';
        s.unlock(off); s.setReverb(0); await s.samplesReady;
        const names=['slashHeavy','slashCut','slashThrough','wet','wetHeavy','thump'];
        for(const name of names) while(s.need(name)) s.makeOne(name);
        if(variant!=='current') {
          for(const [name,k] of [['slashHeavy','heavy'],['slashCut','cut'],['slashThrough','through']]) {
            s.bank[name]=[];
            for(let i=0;i<3;i++) s.addBuffer(name,slashReview(sr,s.seedFor(name,i),k,variant));
          }
          const wet=new Set([...s.bank.wet,...s.bank.wetHeavy]);
          const layer=s.layer.bind(s), body=s.body.bind(s);
          s.layer=(ev,b,opts={})=>layer(ev,b,wet.has(b)?{...opts,gain:(opts.gain??1)*(variant==='edge'?.2:.3)}:opts);
          s.body=(ev,g,rate)=>body(ev,g*(variant==='edge'?.35:.45),rate);
        }
        // Seed per event after deterministic preparation, equal original random choice/rates.
        Math.random=makeRng(seed+10000);
        s.cut(energy,through);
        const rendered=await off.startRendering(), x=rendered.getChannelData(0);
        if(!x.every(Number.isFinite)) throw Error('nonfinite audio');
        const bytes=new Uint8Array(x.buffer); let binary='';
        for(let i=0;i<bytes.length;i+=0x4000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x4000));
        return {audio:btoa(binary),samples:x.length,sr,peak:Math.max(...x.subarray(0,48000)),loadedSamples:Object.keys(s.samples),stats:s.stats};
      } finally { Math.random=originalRandom; }
    },{variant,kind,energy,through,seed});
    const filename=`${variant}-${kind}-${seed}.f32`, bytes=Buffer.from(data.audio,'base64');
    await fs.writeFile(path.join(out,filename),bytes);
    const {audio,...rest}=data;
    rows.push({variant,kind,energy,through,seed,filename,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...rest});
  }
  if(errors.length) throw Error(errors.join('\n'));
  await fs.writeFile(path.join(out,'render.json'),JSON.stringify({pass:true,sr:48000,reverb:0,rows,errors},null,2)+'\n');
  console.log(JSON.stringify({pass:true,rows:rows.length,out}));
} finally { await browser.close(); }
