// Mobile audition and real game input; uses isolated browser settings only.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import{createHash,X509Certificate}from'node:crypto';
import{chromium}from'/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const base=process.argv[2]||'http://127.0.0.1:4261/',out=process.argv[3];assert(out);await fs.mkdir(out,{recursive:true});
const pins=[];for(const n of await fs.readdir('/usr/local/share/ca-certificates'))if(n.endsWith('.crt'))try{const c=new X509Certificate(await fs.readFile('/usr/local/share/ca-certificates/'+n));pins.push(createHash('sha256').update(c.publicKey.export({type:'spki',format:'der'})).digest('base64'));}catch{}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-certificate-errors-spki-list='+pins.join(',')]});
const report={pass:false,base,checks:[],errors:[],responses:[]};let page;
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{localStorage.setItem('gladiator-settings',JSON.stringify({sound:true,pixel:false,fpsCap:false}));window.audioAudit={starts:[],stops:0};const proto=BaseAudioContext.prototype,make=proto.createBufferSource;proto.createBufferSource=function(...args){const src=make.apply(this,args),start=src.start,stop=src.stop;src.start=function(...a){if(src.buffer?.length>1)audioAudit.starts.push({duration:src.buffer.duration,rate:src.playbackRate.value});return start.apply(this,a);};src.stop=function(...a){audioAudit.stops++;return stop.apply(this,a);};return src;};});
const track=p=>{p.on('pageerror',e=>report.errors.push(String(e)));p.on('response',res=>{if(res.url().startsWith(base)&&/\.(?:js|css|json|mp3)(?:\?|$)/.test(res.url()))report.responses.push({url:res.url(),status:res.status()});});};
try{
 page=await context.newPage();track(page);await page.goto(base+'voices.html');await page.locator('[data-character="sherpa"]').waitFor();assert.equal(await page.locator('[data-character="sherpa"] button').count(),0);
 const saved=await page.evaluate(()=>localStorage.getItem('gladiator-settings'));
 assert(!report.responses.some(r=>r.url.includes('/sfx/voice/')));
 for(const width of [320,390,844]){await page.setViewportSize({width,height:width===844?390:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});
 for(const id of ['eira','yeongman','tome'])for(const label of ['이전','새 배정'])for(const kind of ['짧은 신음','기절','출혈']){
  const row=page.locator(`[data-character="${id}"]`),group=row.locator('fieldset').filter({has:page.locator('legend',{hasText:label})}),btn=group.getByRole('button',{name:new RegExp(kind+' 듣기$')});
  const before=await page.evaluate(()=>audioAudit.starts.length);await btn.tap();await page.waitForFunction(n=>audioAudit.starts.length>n,before,{timeout:30000});assert(await page.locator('#status').textContent());
  await page.locator('#stop').tap();assert.equal(await page.locator('.is-playing').count(),0);
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('gladiator-settings')),saved);assert.equal(await page.locator('[data-character] .game-link').count(),3);
 report.checks.push({name:'audition18 real audio starts, stop, no premature voice download, unchanged settings, Sherpa excluded',data:await page.evaluate(()=>audioAudit)});
 await page.screenshot({path:out+'/audition.png'});
 // A first download failure must be retryable; use a fresh page so no bank is cached.
 if(base.startsWith('http://127.0.0.1')){
  const retry=await context.newPage();let fail=true;await retry.route('**/sfx/voice/reitanna_gasp.mp3',route=>fail?route.fulfill({status:503,body:''}):route.continue());await retry.goto(base+'voices.html');
  const btn=retry.locator('[data-character="eira"]').getByRole('button',{name:'에이라 린드 새 배정 짧은 신음 듣기'});await btn.tap();await retry.waitForFunction(()=>document.querySelector('#status').textContent.includes('재생하지 못'));
  fail=false;await btn.tap();await retry.waitForFunction(()=>audioAudit.starts.length>0);report.checks.push({name:'failed recording download retries successfully'});await retry.close();
 }
 await page.close();
 for(const [id,voice]of[['eira','soft_female'],['tome','tome']]){
  page=await context.newPage();track(page);await page.setViewportSize({width:844,height:390});await page.goto(base+'?foe='+id+'&stage=poseidon&cards=longsword,sabre');await page.waitForFunction(()=>window.game?.enemy);
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
  async function enter(){await page.locator('#btnStart').tap();await wait(()=>game.state==='fight'||(game.state==='draw'&&game.draw.stage==='choose'&&game.draw.t>.45));if(await page.evaluate(()=>game.state==='draw'))await page.locator('.wcard[data-i="0"]').tap();await wait(()=>game.state==='fight'&&game.player.fightT>2.05);}
  await enter();await page.waitForFunction(v=>game.sound.samples[`voice:${v}:hurt`]?.length>0,voice);
  await page.evaluate(()=>{window.accepted=0;const observe=()=>{if(game.state==='fight'&&game.player.handHeld&&game.player.inputActive)accepted++;requestAnimationFrame(observe);};requestAnimationFrame(observe);});
  const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:685,y:270,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:610,y:170,id:1}]});await wait(()=>accepted>0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  await page.locator('#btnPause').tap();await wait(()=>game.state==='paused');await page.evaluate(()=>window.oldPlayer=game.player);await enter();assert(await page.evaluate(()=>oldPlayer!==game.player));await page.waitForFunction(v=>game.sound.samples[`voice:${v}:hurt`]?.length>0,voice);
  const snapshot=await page.evaluate(v=>({voice:v,loaded:Object.fromEntries(Object.entries(game.sound.samples).filter(([n])=>n.startsWith('voice:')).map(([n,v])=>[n,v.length])),accepted,state:game.state}),voice);report.checks.push({name:'game touch/pause/restart '+id,data:snapshot});await page.close();
 }
 assert.deepEqual(report.errors,[]);assert(report.responses.every(r=>r.status===200));report.pass=true;
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{report.completedUTC=new Date().toISOString();await fs.writeFile(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,errors:report.errors,failure:report.failure?.message}));}
