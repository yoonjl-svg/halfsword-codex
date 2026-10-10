import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const base=process.argv[2]||'http://127.0.0.1:4280',out=process.argv[3],baseline=process.argv[4]||'7ea9d72';assert(out);await fs.mkdir(out,{recursive:true});
const before=execFileSync('git',['show',baseline+':src/sound.js'],{encoding:'utf8'}),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[];
try {const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/src/sound_baseline.js',r=>r.fulfill({contentType:'text/javascript',body:before}));await page.goto(base+'/voices.html');
const result=await page.evaluate(async()=>{
 const cur=await import('/src/sound.js'),old=await import('/src/sound_baseline.js');const saved=Math.random,rows=[];
 async function render(module,sr,id,kind,missing=false){Math.random=module.makeRng(6731);const ctx=new OfflineAudioContext(1,sr*4,sr),s=new module.Sound();s.ctx=ctx;s.build();s.useSamples=true;if(!missing)await s.loadVoiceSamples([id]);
  if(kind==='hurt')s.hurt(id,.7);else s.death(id,kind);const buffer=await ctx.startRendering();Math.random=saved;const x=buffer.getChannelData(0);let peak=0,sum=0;for(const v of x){if(!Number.isFinite(v))throw Error('nonfinite');peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  const rms=(a,b)=>Math.sqrt(x.slice(a*sr,b*sr).reduce((s,v)=>s+v*v,0)/((b-a)*sr));return {x,peak,rms:Math.sqrt(sum/x.length),early:rms(.05,.35),tail:rms(.7,1.0),sources:s.voices.reduce((n,e)=>n+e.srcs.length,0)};
 }
 for(const sr of [44100,48000])for(const [id,kind]of[['player','기절'],['player','출혈'],['player','목'],['player','hurt'],['bran','출혈']]){const a=await render(old,sr,id,kind),b=await render(cur,sr,id,kind);if(b.peak>=1)throw Error('clip');const unchanged=id!=='player'||kind==='hurt';if(unchanged&&!a.x.every((v,i)=>v===b.x[i]))throw Error('unrelated audio changed '+id+kind);if(!unchanged&&!(b.peak<a.peak*.6&&b.rms<a.rms*.6&&b.tail<b.early*.2))throw Error('quiet envelope failed '+JSON.stringify({a:{p:a.peak,r:a.rms},b:{p:b.peak,r:b.rms,e:b.early,t:b.tail}}));rows.push({sr,id,kind,unchanged,before:{peak:a.peak,rms:a.rms},after:{peak:b.peak,rms:b.rms,early:b.early,tail:b.tail,sources:b.sources}});}
 const missing=await render(cur,48000,'player','출혈',true);if(missing.peak!==0)throw Error('download failure played loud fallback');
 Math.random=saved;return {pass:true,rows,missingPeak:missing.peak};
});
const current=await fs.readFile('src/sound.js','utf8'),extract=s=>s.slice(s.indexOf('  fadeOutWorld() {'),s.indexOf('\n  /**',s.indexOf('  fadeOutWorld() {')));assert.equal(extract(current),extract(before));assert.deepEqual(errors,[]);result.tinnitusFunctionUnchanged=true;result.errors=errors;await fs.writeFile(out+'/player-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify({pass:true,cases:result.rows.length,tinnitusUnchanged:true,errors}));
}finally{await browser.close();}
