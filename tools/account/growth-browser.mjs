import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
const base=new URL(process.argv[2]||'http://127.0.0.1:4293/'),out=process.argv[3]||'/tmp/halfsword-growth-browser-local',build=process.argv[4]||'/tmp/halfsword-growth-build-20261011';
const local=['127.0.0.1','localhost'].includes(base.hostname);assert(local||base.href==='https://yoonjl-svg.github.io/halfsword-codex/');
await fs.mkdir(out,{recursive:true});const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
if(!local){const u=new URL(process.env.HTTPS_PROXY);launch.proxy={server:u.protocol+'//'+u.host};if(u.username)launch.proxy.username=decodeURIComponent(u.username);if(u.password)launch.proxy.password=decodeURIComponent(u.password);}
const browser=await chromium.launch(launch),errors=[],hashes={},pending=[];
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
if(!local)await context.route('**/*',async route=>{try{const u=new URL(route.request().url());assert.equal(u.origin,base.origin);assert(u.pathname.startsWith(base.pathname));assert.equal(route.request().method(),'GET');const r=await route.fetch({timeout:30000,maxRedirects:0});assert.equal(r.status(),200);await route.fulfill({response:r,body:await r.body()});}catch(e){errors.push(e.message);await route.abort();}});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base.href)&&r.status()===200)pending.push((async()=>{const name=decodeURIComponent(new URL(r.url()).pathname.slice(base.pathname.length))||'index.html';try{const actual=await r.body(),expected=await fs.readFile(path.join(build,name));const sha=x=>createHash('sha256').update(x).digest('hex');assert.equal(sha(actual),sha(expected),name);hashes[name]=sha(actual);}catch(e){errors.push(e.message);}})());});
const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
const count=key=>page.locator(`[data-${key}]`).innerText().then(Number);
const open=async()=>{await page.goto(new URL('?account=1&growth=1',base).href,{waitUntil:'domcontentloaded'});await wait(()=>window.game&&document.querySelector('[data-growth-status]')?.textContent==='저장됨');};
const start=async()=>{await page.locator('#btnStart').tap();await wait(()=>game.state==='draw'&&game.draw.stage==='choose'&&game.draw.t>=.45);await page.locator('.wcard[data-i="0"]').tap();await wait(()=>game.state==='fight');await page.evaluate(()=>{game.ai.update=()=>{};});};
const fixtureWin=async expected=>{assert(await page.evaluate(()=>game.player.alive));await page.evaluate(()=>game.enemy.die('기절',true));await page.waitForFunction(n=>Number(document.querySelector('[data-wins]').textContent)===n,expected,{timeout:90000});if(await page.evaluate(()=>game.state==='fight'))await page.locator('#btnPause').tap();await wait(()=>game.state==='paused');};
try{
 await page.setViewportSize({width:320,height:640});
 for(const name of ['growth.html','growth-setup.html']){await page.goto(new URL(name,base).href);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.screenshot({path:path.join(out,'setup.png'),fullPage:true});await page.setViewportSize({width:844,height:390});
 await open();assert.equal(await count('coins'),0);assert.equal(await count('wins'),0);
 // First real start/card/input path, then explicitly synthetic death fixtures to exercise result bookkeeping.
 for(let i=1;i<=3;i++){await start();assert.equal(await page.evaluate(()=>game.player.strength),1);await page.touchscreen.tap(620,170);await fixtureWin(i);await wait(()=>document.querySelector('[data-growth-status]').textContent==='저장됨');assert.equal(await count('wins'),i);assert.equal(await count('coins'),i*10);console.log(JSON.stringify({fixtureWin:i,coins:i*10}));}
 assert.equal(await count('points'),1);await page.locator('[data-purchase]').tap();await wait(()=>document.querySelector('[data-coins]').textContent==='0');assert(await page.locator('[data-purchase]').isDisabled());
 await page.locator('[data-equip]').tap();await wait(()=>document.querySelector('.growth-panel [data-seal]').textContent.includes('인장'));
 await page.locator('[data-allocate]').tap();await wait(()=>document.querySelector('[data-strength]').textContent==='1');assert.equal(await page.evaluate(()=>game.player.strength),1,'No midround/old-fighter mutation');
 await page.locator('[data-allocate]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'growth.png'),fullPage:true});
 await open();assert.equal(await count('wins'),3);assert.equal(await count('coins'),0);assert.equal(await count('strength'),1);assert.match(await page.locator('.growth-panel [data-seal]').innerText(),/인장/);
 await start();assert.equal(await page.evaluate(()=>game.player.strength),1.02);
 await page.locator('#btnPause').tap();await page.locator('#btnResume').tap();assert.equal(await page.evaluate(()=>game.player.strength),1.02);
 await page.locator('#btnPause').tap();await start();assert.equal(await page.evaluate(()=>game.player.strength),1.02,'No compounding on restart');assert.equal(await count('wins'),3);
 await page.evaluate(()=>{game.player.die('기절',true);game.enemy.die('기절',true);});await wait(()=>game.state==='paused');await wait(()=>document.querySelector('[data-growth-status]').textContent==='저장됨');assert.equal(await count('wins'),3,'Simultaneous death gets no victory reward');
 await page.goto(new URL('?account=1&growth=1&weapon=rapier',base).href,{waitUntil:'domcontentloaded'});await wait(()=>!!game&&!!document.querySelector('.account-panel'));assert.equal(await page.locator('.growth-panel').count(),0,'Research entry excluded');assert.equal(await page.evaluate(()=>game.player.strength),1);
 await Promise.all(pending);assert.deepEqual(errors,[]);
 const report={pass:true,local,at:new Date().toISOString(),groups:7,syntheticResults:4,limitations:'Enemy/player death states were injected only to test outcome bookkeeping. This is not a combat balance or human victory test. No hosted Supabase service configured.',hashes,errors};
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,groups:7,files:Object.keys(hashes).length,errors:errors.length}));
}catch(e){console.error(JSON.stringify(await page.evaluate(()=>({state:window.game?.state,title:document.querySelector('#menuTitle')?.textContent,growth:document.querySelector('.growth-panel')?.innerText,storage:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('stillness-growth:')))})).catch(()=>({}))));throw e;}finally{await browser.close();}
