// Explicit variation audition and actual mobile game; normal TLS through configured proxy.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const [base,out,build] = process.argv.slice(2);
const selected=(process.argv.find(x=>x.startsWith('--characters='))?.slice(13)||'').split(',').filter(Boolean);
const gameIds=(process.argv.find(x=>x.startsWith('--game='))?.slice(7)||'').split(',').filter(Boolean);
const takeCount=(id,kind)=>id==='player'&&kind!=='피격'?1:2;
assert(base && out && build); await fs.mkdir(out,{recursive:true});
const local = new URL(base).hostname==='127.0.0.1';
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
if(!local){const u=new URL(process.env.HTTPS_PROXY||process.env.https_proxy);launch.proxy={server:u.protocol+'//'+u.host};if(u.username)launch.proxy.username=decodeURIComponent(u.username);if(u.password)launch.proxy.password=decodeURIComponent(u.password);}
const browser=await chromium.launch(launch);
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const report={pass:false,base,checks:[],errors:[],assets:{},tlsVerification:true};const pending=new Set();
const hash=b=>createHash('sha256').update(b).digest('hex');
await context.route('**/*',async route=>{
 const url=route.request().url();
 if(!url.startsWith(base)){await route.continue();return;}
 const job=(async()=>{try{
  const response=await route.fetch({maxRedirects:0,maxRetries:1,timeout:30000});
  assert.equal(response.status(),200,'HTTP '+response.status()+' '+new URL(url).pathname);
  const body=await response.body();const rel=decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length))||'index.html';
  assert(!rel.includes('..'));const expected=await fs.readFile(path.join(build,rel));
  assert.equal(hash(body),hash(expected),'Public/build mismatch '+rel);report.assets[rel]=hash(body);
  await route.fulfill({response,body});
 }catch(e){report.errors.push(e.message.replace(/https?:\/\/[^\s]+/g,'[URL]'));await route.abort().catch(()=>{});}})();
 pending.add(job);try{await job;}finally{pending.delete(job);}
});
await context.addInitScript(()=>{
 localStorage.setItem('gladiator-settings',JSON.stringify({sound:true,pixel:false,fpsCap:false}));
 window.audioAudit={starts:[],stops:0};const make=BaseAudioContext.prototype.createBufferSource;
 BaseAudioContext.prototype.createBufferSource=function(...args){const src=make.apply(this,args),start=src.start,stop=src.stop;
 src.start=function(...a){if(src.buffer?.length>1)audioAudit.starts.push({duration:src.buffer.duration,rate:src.playbackRate.value});return start.apply(this,a);};
 src.stop=function(...a){audioAudit.stops++;return stop.apply(this,a);};return src;};
});
let page;
const open=async(url)=>{const p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));await p.goto(url);return p;};
try{
 page=await open(base+'voices.html');await page.locator('[data-character="sherpa"]').waitFor();
 assert.equal(await page.locator('[data-character]').count(),16);
 assert(!Object.keys(report.assets).some(r=>r.startsWith('sfx/voice/')));
 const saved=await page.evaluate(()=>localStorage.getItem('gladiator-settings'));
 for(const width of[320,390,844]){await page.setViewportSize({width,height:width===844?390:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});
 const cast=await page.evaluate(async()=>fetch('./voice-casting.json').then(r=>r.json()));
 for(const row of cast){assert.equal(await page.locator(`[data-character="${row.id}"] button`).count(),row.id==='player'?4:row.changed?12:6);}
 assert.equal(cast.find(r=>r.id==='eira').name,'투야나 니콜라예바');assert.equal(cast.find(r=>r.id==='yeongman').name,'미나미');assert.equal(cast.find(r=>r.id==='yeongman').voice,'isolde');
 const used=new Set();let taps=0;
 const cases=[];
 for(const row of cast.filter(r=>!selected.length||selected.includes(r.id))){if(!used.has(row.voice)){used.add(row.voice);cases.push([row,row.changed?'새 배정':'현재 목소리']);}}
 if(!selected.length||selected.includes('crown_boss'))cases.push([cast.find(r=>r.id==='crown_boss'),'이전']);
 for(const[row,label]of cases)for(const kind of['피격','기절','출혈'])for(let n=1;n<=takeCount(row.id,kind);n++){
  const btn=page.locator(`[data-character="${row.id}"]`).getByRole('button',{name:`${row.name} ${label} ${kind} ${n} 듣기`,exact:true});
  const before=await page.evaluate(()=>audioAudit.starts.length);await btn.tap();
  await page.waitForFunction(n=>audioAudit.starts.length>n,before,{timeout:30000});
  assert((await page.locator('#status').textContent()).includes(`${kind} ${n} 재생 중`));
  await page.locator('#stop').tap();assert.equal(await page.locator('.is-playing').count(),0);taps++;
 }
 assert(!Object.keys(report.assets).some(r=>['liao_bleed2','player_exhale2','margarethe_ko2','margarethe_bleed2','margarethe_ko1','tuyana_bleed2_fade'].some(x=>r.endsWith('/'+x+'.mp3'))));
 assert.equal(await page.evaluate(()=>localStorage.getItem('gladiator-settings')),saved);
 report.checks.push({name:'16subjects, explicit player death exception, selected numbered buttons, no early voice fetch, stop, unchanged settings, no rejected take',taps,widths:[320,390,844]});
 await page.locator(`[data-character="${selected.includes('margarethe')?'margarethe':'crown_boss'}"]`).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/audition.png'});await page.close();
 for(const[id,voice]of(gameIds.length?gameIds.map(id=>[id,cast.find(r=>r.id===id).voice]):[['crown_boss','maya'],['eira','soft_female'],['omari','omari']])){
  page=await open(base+'?foe='+id+'&stage=poseidon&cards=longsword,sabre');await page.setViewportSize({width:844,height:390});
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});await wait(()=>window.game?.enemy);
  async function enter(){await page.locator('#btnStart').tap();await wait(()=>game.state==='fight'||(game.state==='draw'&&game.draw.stage==='choose'&&game.draw.t>.45));if(await page.evaluate(()=>game.state==='draw'))await page.locator('.wcard[data-i="0"]').tap();await wait(()=>game.state==='fight'&&game.player.fightT>2.05);}
  await enter();await page.waitForFunction(v=>['hurt','ko','bleed'].every(k=>game.sound.samples[`voice:${v}:${k}`]?.length===2),voice,{timeout:30000});
  await page.evaluate(()=>{window.accepted=0;const observe=()=>{if(game.state==='fight'&&game.player.handHeld&&game.player.inputActive)accepted++;requestAnimationFrame(observe);};requestAnimationFrame(observe);});
  const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:685,y:270,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:610,y:170,id:1}]});await wait(()=>accepted>0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  if(id==='omari'||id==='margarethe'){
   const before=await page.evaluate(()=>audioAudit.starts.length);await page.evaluate(()=>game.player.die('출혈'));await wait(()=>game.state==='paused');await page.waitForFunction(n=>audioAudit.starts.length>n,before);
   assert(await page.evaluate(()=>game.sound.playerDeathVoice?.srcs.length===1 && game.sound.samples['voice:player:ko'].length===1 && game.sound.samples['voice:player:bleed'].length===1));report.checks.push({name:'player death uses one quiet exhale; tinnitus code unchanged'});
  }else{await page.locator('#btnPause').tap();await wait(()=>game.state==='paused');}
  await page.evaluate(()=>window.oldPlayer=game.player);await enter();assert(await page.evaluate(()=>oldPlayer!==game.player));
  await page.waitForFunction(v=>['hurt','ko','bleed'].every(k=>game.sound.samples[`voice:${v}:${k}`]?.length===2),voice);
  report.checks.push({name:'mobile game input/pause/restart '+id,voice});await page.close();
 }
 await Promise.all([...pending]);assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await Promise.all([...pending]);report.completedUTC=new Date().toISOString();await fs.writeFile(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,assets:Object.keys(report.assets).length,errors:report.errors,failure:report.failure?.message}));}
