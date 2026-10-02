// Production-build audio startup and weak/strong routing, including no-Worker fallback.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,access,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.argv[2]||'http://127.0.0.1:4202';
const out=process.argv[3]||'/workspace/halfsword-sound-review/selected-short-browser';
await mkdir(out,{recursive:true});
try {await access(out+'/result.json');throw Error('Use a fresh output directory');} catch(e){if(e.code!=='ENOENT')throw e;}
const files=['src/sound.js','src/slash_draw.js','src/soundlab.js','src/config.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const before=await hashes(),errors=[],rows=[];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
try {
 for(const fallback of [false,true]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  await ctx.addInitScript(({fallback})=>{const Original=window.Worker;window.__soundWorkers=[];window.Worker=class extends Original{constructor(url,...rest){if(fallback)throw Error('Intentional Worker unavailable');super(url,...rest);window.__soundWorkers.push(String(url));}};},{fallback});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await p.goto(base+'/?weapon=longsword&foeWeapon=longsword');
  await p.waitForFunction(()=>window.game?.player?.sword);await p.locator('#btnStart').tap();
  await p.waitForFunction(()=>game.state==='fight');
  await p.waitForFunction(()=>game.sound.bank.drawnCut?.length===3&&game.sound.bank.drawnHeavy?.length===3,null,{timeout:60000});
  const row=await p.evaluate(({fallback})=>{
   const s=game.sound,picks=[],pick=s.pick;s.pick=function(name){picks.push(name);return pick.call(this,name);};
   const checks=[];
   try {
    for(const energy of [35,90,111.9,112,140])for(const through of [false,true]){picks.length=0;s.cut(energy,through);checks.push({energy,through,bank:picks.find(x=>x.startsWith('drawn'))});}
    s.on=false;picks.length=0;s.cut(140,false);const mutedPicks=picks.length;s.on=true;
    return {fallback,mode:s.fleshHit,ctxState:s.ctx.state,sampleRate:s.ctx.sampleRate,workers:window.__soundWorkers,checks,mutedPicks,
     banks:Object.fromEntries(['drawnCut','drawnHeavy'].map(k=>[k,s.bank[k].map(b=>({seconds:b.duration,finite:b.getChannelData(0).every(Number.isFinite)}))])),simTime:game.stats.simTime};
   }finally{s.pick=pick;}
  },{fallback});
  assert.equal(row.mode,'drawn');assert.equal(row.ctxState,'running');assert.equal(row.mutedPicks,0);
  assert.equal(row.workers.some(x=>x.includes('soundgen')),!fallback);
  for(const r of row.checks)assert.equal(r.bank,r.energy>=112?'drawnHeavy':'drawnCut');
  for(const bs of Object.values(row.banks))assert.ok(bs.every(b=>b.finite));
  await p.screenshot({path:out+`/game-${fallback?'fallback':'worker'}.png`});
  rows.push(row);await ctx.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844}});
 await p.goto(base+'/sounds.html');await p.getByText('A2/B2 단축 (적용)',{exact:true}).waitFor();
 assert.equal(await p.getByText('35차 강베기 (적용)',{exact:true}).count(),0);
 const lab={newLabel:true,oldDefaultLabelAbsent:true};await p.screenshot({path:out+'/lab.png'});
 const after=await hashes();assert.deepEqual(before,after);assert.deepEqual(errors,[]);
 await writeFile(out+'/result.json',JSON.stringify({pass:true,base,method:'Local production preview, mobile emulation; direct Sound.cut invocations verify audio routing, not physical hit efficacy or human listening',sourceBefore:before,sourceAfter:after,rows,lab,errors},null,2)+'\n');
 console.log(JSON.stringify({pass:true,rows:rows.length,errors,out}));
}finally{await browser.close();}
