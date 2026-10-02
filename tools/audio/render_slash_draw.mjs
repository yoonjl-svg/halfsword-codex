// Same actual cut/event/bus/limiter path as round 1, isolated listening overrides.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base=process.argv[2] || 'http://127.0.0.1:4198';
const out=process.argv[3] || '/workspace/halfsword-sound-review/2026-10-02-round2';
const files=['src/sound.js','src/config.js','tools/audio/slash_review_candidate.mjs','tools/audio/slash_draw_candidate.mjs','tools/audio/render_slash_draw.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before=await hashes(), head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await fs.mkdir(out,{recursive:true});
await fs.access(path.join(out,'render.json')).then(()=>{throw Error('Use a fresh output directory');},()=>{});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage(), errors=[], rows=[];
page.on('pageerror',e=>errors.push(String(e)));
try {
  await page.goto(base+'/sounds.html');
  for(const variant of ['edge','cleave','draw','fiber']) for(const [kind,energy,through,seed] of [
    ['heavy',140,false,71],['heavy',140,false,172],['heavy',140,false,273],['cut',90,false,71],['through',110,true,71],
  ]) {
    const data=await page.evaluate(async({variant,kind,energy,through,seed})=>{
      const {Sound,makeRng}=await import('/src/sound.js');
      const {slashReview}=await import('/tools/audio/slash_review_candidate.mjs');
      const {slashDraw}=await import('/tools/audio/slash_draw_candidate.mjs');
      const originalRandom=Math.random; Math.random=makeRng(seed);
      try {
        const sr=48000, off=new OfflineAudioContext(1,Math.round(sr*1.55),sr), s=new Sound();
        s.seed=seed; s.useSamples=true; s.fleshHit='samsho'; s.hitScale='legacy';
        s.unlock(off); s.setReverb(0); await s.samplesReady;
        for(const name of ['slashHeavy','slashCut','slashThrough','wet','wetHeavy','thump']) while(s.need(name)) s.makeOne(name);
        const newVariant=variant==='draw'||variant==='fiber';
        for(const [name,k] of [['slashHeavy','heavy'],['slashCut','cut'],['slashThrough','through']]) {
          s.bank[name]=[];
          for(let i=0;i<3;i++) s.addBuffer(name,(newVariant?slashDraw:slashReview)(sr,s.seedFor(name,i),k,variant));
        }
        const wet=new Set([...s.bank.wet,...s.bank.wetHeavy]), layer=s.layer.bind(s), body=s.body.bind(s);
        const wetScale={edge:.2,cleave:.3,draw:.025,fiber:.06}[variant];
        const bodyScale={edge:.35,cleave:.45,draw:0,fiber:.035}[variant];
        // Keep the original body call even at gain zero to preserve random
        // consumption / choice semantics; it contributes no audible body layer.
        s.layer=(ev,b,opts={})=>layer(ev,b,wet.has(b)?{...opts,gain:(opts.gain??1)*wetScale}:opts);
        s.body=(ev,g,rate)=>body(ev,g*bodyScale,rate);
        Math.random=makeRng(seed+10000); s.cut(energy,through);
        const rendered=await off.startRendering(), x=rendered.getChannelData(0);
        if(!x.every(Number.isFinite)) throw Error('nonfinite audio');
        let peakAbs=0; for(const v of x) peakAbs=Math.max(peakAbs,Math.abs(v));
        const bytes=new Uint8Array(x.buffer); let binary='';
        for(let i=0;i<bytes.length;i+=0x4000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x4000));
        return {audio:btoa(binary),samples:x.length,sr,peakAbs,wetScale,bodyScale,loadedSamples:Object.keys(s.samples),stats:s.stats};
      } finally { Math.random=originalRandom; }
    },{variant,kind,energy,through,seed});
    const filename=`${variant}-${kind}-${seed}.f32`, bytes=Buffer.from(data.audio,'base64');
    await fs.writeFile(path.join(out,filename),bytes);
    const {audio,...rest}=data;
    rows.push({variant,kind,energy,through,seed,filename,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...rest});
  }
  const after=await hashes(), sourceStable=JSON.stringify(before)===JSON.stringify(after);
  if(errors.length||!sourceStable) throw Error(JSON.stringify({errors,sourceStable}));
  await fs.writeFile(path.join(out,'render.json'),JSON.stringify({pass:true,head,sourceBefore:before,sourceAfter:after,sourceStable,sr:48000,reverb:0,rows,errors},null,2)+'\n');
  console.log(JSON.stringify({pass:true,sourceStable,rows:rows.length,out}));
} finally { await browser.close(); }
