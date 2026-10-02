// Render selected runtime cuts without changing their production gains or graph.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base=process.argv[2]||'http://127.0.0.1:4201';
const out=process.argv[3]||'/workspace/halfsword-sound-review/2026-10-02-selected-short';
const sourceFiles=['src/sound.js','src/config.js','src/slash_draw.js','src/soundgen.js','src/main.js','src/soundlab.js','tools/audio/slash_draw_candidate.mjs'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,sha(await fs.readFile(p))])));
await fs.mkdir(out,{recursive:true});
try { await fs.access(path.join(out,'render.json')); throw Error('Use fresh output directory'); } catch(e) { if(e.code!=='ENOENT') throw e; }
const before=await hashes(), head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage(), errors=[],rows=[];
page.on('pageerror',e=>errors.push(String(e)));
const specs=[];
for(const sr of [44100,48000]) {
  for(const seed of [71,172,273]) for(const energy of [90,140]) specs.push({id:`cut-${energy}-${seed}-${sr}`,sr,seed,energy,through:false});
  for(const energy of [111.9,112]) for(const through of [false,true]) specs.push({id:`boundary-${energy}-${through}-${sr}`,sr,seed:71,energy,through});
  for(const energy of [90,140,300]) for(const mode of ['drawn','samsho']) specs.push({id:`stab-${mode}-${energy}-${sr}`,sr,seed:71,energy,mode,stab:true});
  for(const variant of ['draw','fiber']) for(const seed of [71,172,273]) specs.push({id:`original-${variant}-${seed}-${sr}`,sr,seed,energy:140,variant});
  specs.push({id:`overlap-${sr}`,sr,seed:71,energy:140,overlap:48});
}
specs.push({id:'listening-weak',sr:48000,seed:71,energy:90,timeline:[{time:.2,energy:90,seed:71},{time:1.2,energy:90,seed:172},{time:2.2,energy:90,seed:273}],duration:3});
specs.push({id:'listening-strong',sr:48000,seed:71,energy:140,timeline:[{time:.2,energy:140,seed:71},{time:1.2,energy:140,seed:172},{time:2.2,energy:140,seed:273}],duration:3});
specs.push({id:'listening-weak-strong',sr:48000,seed:71,energy:90,timeline:[{time:.2,energy:90,seed:71},{time:1.2,energy:140,seed:71},{time:2.2,energy:90,seed:172},{time:3.2,energy:140,seed:172}],duration:4});
try {
  await page.goto(base+'/sounds.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.lab);
  for(const spec of specs) {
    const data=await page.evaluate(async spec=>{
      const {Sound,makeRng}=await import('/src/sound.js');
      const {SOUND}=await import('/src/config.js');
      const {DRAWN_SLASH}=await import('/src/slash_draw.js');
      const {slashDraw}=await import('/tools/audio/slash_draw_candidate.mjs');
      const savedRandom=Math.random; Math.random=makeRng(spec.seed);
      try {
        const off=new OfflineAudioContext(1,Math.round(spec.sr*(spec.duration||1.5)),spec.sr),s=new Sound();
        s.seed=spec.seed; if(spec.mode||spec.variant) s.fleshHit=spec.mode||'samsho';
        s.unlock(off); await s.samplesReady;
        for(const name of ['drawnCut','drawnHeavy','slashCut','slashHeavy','slashThrough','slashStab','wet','wetHeavy','thump']) while(s.need(name)) s.makeOne(name);
        if(spec.variant) {
          for(const [name,kind] of [['slashHeavy','heavy'],['slashCut','cut'],['slashThrough','through']]) {
            s.bank[name]=[]; for(let i=0;i<3;i++) s.addBuffer(name,slashDraw(spec.sr,s.seedFor(name,i),kind,spec.variant));
          }
          const wet=new Set([...s.bank.wet,...s.bank.wetHeavy]),layer=s.layer.bind(s),body=s.body.bind(s);
          s.layer=(ev,b,opts={})=>layer(ev,b,wet.has(b)?{...opts,gain:(opts.gain??1)*(spec.variant==='draw'?.025:.06)}:opts);
          s.body=(ev,g,rate)=>body(ev,g*(spec.variant==='draw'?0:.035),rate);
        }
        const selected=[],layers=[],events=[],pick=s.pick.bind(s),layer=s.layer.bind(s),event=s.event.bind(s);
        s.pick=name=>{const b=pick(name);selected.push({name,index:s.bank[name].indexOf(b),durationS:b.duration});return b;};
        s.layer=(ev,b,opts={})=>{layers.push({eventStartS:ev.start,bank:Object.entries(s.bank).find(([,a])=>a.includes(b))?.[0]||'recording',gain:opts.gain??1,rate:opts.rate??1,delay:opts.delay??0,durationS:b?.duration});return layer(ev,b,opts);};
        s.event=opts=>{const ev=event(opts);events.push({timeS:ev.start,gain:opts.gain});return ev;};
        const hit=h=>{Math.random=makeRng(h.seed+10000);spec.stab?s.stab(h.energy):s.cut(h.energy,h.through||false);};
        let rendered;
        if(spec.timeline) {
          let suspended=off.suspend(spec.timeline[0].time),done=off.startRendering();
          for(let i=0;i<spec.timeline.length;i++) {
            await suspended;hit(spec.timeline[i]);
            if(i+1<spec.timeline.length) suspended=off.suspend(spec.timeline[i+1].time);
            await off.resume();
          }
          rendered=await done;
        } else {
          for(let i=0;i<(spec.overlap||1);i++) hit({...spec,seed:spec.seed+i});
          rendered=await off.startRendering();
        }
        const x=rendered.getChannelData(0); if(!x.every(Number.isFinite)) throw Error('nonfinite');
        let peakAbs=0;for(const v of x) peakAbs=Math.max(peakAbs,Math.abs(v));
        const bytes=new Uint8Array(x.buffer);let binary='';for(let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
        return {audio:btoa(binary),samples:x.length,peakAbs,selected,layers,events,loadedSamples:Object.keys(s.samples),stats:s.stats,defaults:{mode:s.fleshHit,hitScale:s.hitScale,volume:s.master.gain.value,reverb:SOUND.reverb,samples:SOUND.samples,maxVoices:SOUND.maxVoices},drawn: DRAWN_SLASH};
      } finally {Math.random=savedRandom;}
    },spec);
    const bytes=Buffer.from(data.audio,'base64'),filename=spec.id+'.f32';await fs.writeFile(path.join(out,filename),bytes);
    const {audio,...rest}=data;rows.push({...spec,filename,sha256:sha(bytes),...rest});
  }
  const after=await hashes(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
  const stabPairs=await Promise.all(rows.filter(r=>r.stab&&r.mode==='drawn').map(async r=>{
    const other=rows.find(o=>o.stab&&o.mode==='samsho'&&o.sr===r.sr&&o.energy===r.energy);
    const a=await fs.readFile(path.join(out,r.filename)),b=await fs.readFile(path.join(out,other.filename));
    let maxAbs=0,diff2=0,energy2=0;
    for(let i=0;i<a.length;i+=4){const x=a.readFloatLE(i),d=x-b.readFloatLE(i);maxAbs=Math.max(maxAbs,Math.abs(d));diff2+=d*d;energy2+=x*x;}
    const relativeRMS=Math.sqrt(diff2/Math.max(energy2,1e-30));
    const graphExact=['layers','events','selected'].every(k=>JSON.stringify(r[k])===JSON.stringify(other[k]));
    // Separate OfflineAudioContexts can differ at float rounding precision, also observed in round2.
    return {sr:r.sr,energy:r.energy,byteExact:r.sha256===other.sha256,graphExact,maxAbs,relativeRMS,
      withinFloatTolerance:graphExact&&maxAbs<=1e-6&&relativeRMS<=1e-5};
  }));
  const bankPass=rows.filter(r=>!r.stab&&!r.variant).every(r=>r.selected.filter(p=>p.name.startsWith('drawn')).length===(r.timeline?.length||r.overlap||1)&&r.selected.filter(p=>p.name.startsWith('drawn')).every((p,i)=>p.name===((r.timeline?.[i]?.energy??r.energy)>=112?'drawnHeavy':'drawnCut')));
  const pass=sourceStable&&!errors.length&&stabPairs.every(r=>r.withinFloatTolerance)&&bankPass&&rows.every(r=>r.peakAbs<1);
  await fs.writeFile(path.join(out,'render.json'),JSON.stringify({pass,head,sourceBefore:before,sourceAfter:after,sourceStable,bankPass,stabPairs,errors,rows,method:'Actual production Sound.cut/stab through OfflineAudioContext. Runtime gain unchanged. Original round2 overrides only in explicitly marked reference rows.'},null,2)+'\n');
  console.log(JSON.stringify({pass,sourceStable,bankPass,stabPairs,rows:rows.length,out}));if(!pass) throw Error('Render checks failed');
} finally {await browser.close();}
