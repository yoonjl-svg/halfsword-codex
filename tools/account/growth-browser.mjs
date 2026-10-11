import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
const base=new URL(process.argv[2]||'http://127.0.0.1:4294/'),out=process.argv[3]||'/tmp/halfsword-growth-browser-local',build=process.argv[4]||'/tmp/halfsword-account-ui-build-20261012';
const local=['127.0.0.1','localhost'].includes(base.hostname);assert(local||base.href==='https://yoonjl-svg.github.io/halfsword-codex/');
await fs.mkdir(out,{recursive:true});const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
if(!local){const u=new URL(process.env.HTTPS_PROXY);launch.proxy={server:u.protocol+'//'+u.host};if(u.username)launch.proxy.username=decodeURIComponent(u.username);if(u.password)launch.proxy.password=decodeURIComponent(u.password);}
const browser=await chromium.launch(launch),errors=[],hashes={},pending=[];
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
if(!local)await context.route('**/*',async route=>{try{const u=new URL(route.request().url());assert.equal(u.origin,base.origin);assert(u.pathname.startsWith(base.pathname));assert.equal(route.request().method(),'GET');const r=await route.fetch({timeout:30000,maxRedirects:0});assert.equal(r.status(),200);await route.fulfill({response:r,body:await r.body()});}catch(e){errors.push(e.message);await route.abort();}});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base.href)&&r.status()===200)pending.push((async()=>{const name=decodeURIComponent(new URL(r.url()).pathname.slice(base.pathname.length))||'index.html';try{const actual=await r.body(),expected=await fs.readFile(path.join(build,name));const sha=x=>createHash('sha256').update(x).digest('hex');assert.equal(sha(actual),sha(expected),name);hashes[name]=sha(actual);}catch(e){errors.push(e.message);}})());});
const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
const count=key=>page.locator(`[data-${key}]`).textContent().then(Number);
const tab=async id=>page.locator(`[data-view="${id}"]`).tap();
const capture=async name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.hs-page:not([hidden])')].every(e=>e.scrollWidth<=e.clientWidth+1)),'No horizontal overflow');
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
 await capture('reward-landscape');assert.equal(await count('points'),1);
 await page.setViewportSize({width:390,height:844});await capture('reward-portrait');await noOverflow();
 await tab('inventory');assert(await page.locator('[data-inventory-empty]').isVisible());await capture('inventory-empty');
 await tab('shop');await capture('shop');await page.locator('[data-purchase]').tap();await capture('purchase-confirm');await page.locator('[data-dialog-cancel]').tap();assert.equal(await count('coins'),30);
 await page.locator('[data-purchase]').tap();await page.keyboard.press('Escape');assert.equal(await count('coins'),30);
 // Hold the real device ledger to inspect pending UI without inventing a balance.
 await page.evaluate(()=>{window.uiLockReady=false;void navigator.locks.request('stillness-growth:v1:halfsword-codex-growth-trial:practice',async()=>{window.uiLockReady=true;await new Promise(resolve=>window.releaseUiLock=resolve);});});await wait(()=>window.uiLockReady);
 await page.locator('[data-purchase]').tap();await page.locator('[data-dialog-confirm]').tap();await wait(()=>document.querySelector('#btnStart').disabled);assert(await page.locator('.hs-sync').isVisible());assert.equal(await count('coins'),30,'No optimistic charge');
 await page.evaluate(()=>document.querySelector('#btnStart').click());assert.equal(await page.evaluate(()=>game.state),'paused','Pending operation blocks next fight');await page.evaluate(()=>window.releaseUiLock());await wait(()=>document.querySelector('[data-coins]').textContent==='0');assert(await page.locator('#btnStart').isEnabled());
 assert(await page.locator('[data-inventory-item]').isVisible());await page.locator('[data-equip]').tap();await wait(()=>document.querySelector('[data-equipped-label]').textContent==='장착 중');await capture('inventory');
 await page.locator('[data-equip]').tap();await wait(()=>document.querySelector('[data-equipped-label]').textContent==='보유 중');await page.locator('[data-equip]').tap();await wait(()=>document.querySelector('[data-equipped-label]').textContent==='장착 중');
 await tab('growth');await page.locator('[data-allocate]').tap();await page.locator('[data-dialog-confirm]').tap();await wait(()=>document.querySelector('[data-strength]').textContent==='1');assert.equal(await page.evaluate(()=>game.player.strength),1,'No midround/old-fighter mutation');await capture('growth');
 await page.locator('[data-account]').tap();await capture('account');assert(await page.locator('[data-login]').isDisabled());assert(await page.locator('[data-link]').isDisabled());
 await page.locator('[name=nickname]').fill('길 위의 사람');await page.locator('[data-profile] button').tap();await wait(()=>document.querySelector('[data-hub-name]').textContent==='길 위의 사람');
 await page.setViewportSize({width:320,height:640});for(const id of ['journey','shop','inventory','growth']){await tab(id);await noOverflow();}await page.locator('[data-account]').tap();await noOverflow();await capture('account-small');
 await page.setViewportSize({width:844,height:390});await open();assert.equal(await count('wins'),3);assert.equal(await count('coins'),0);assert.equal(await count('strength'),1);assert.equal(await page.locator('[data-hub-name]').textContent(),'길 위의 사람');assert.equal(await page.locator('[data-hub-name]').getAttribute('data-seal'),'✦');assert(await page.locator('[data-reward]').isHidden(),'Reload must not replay reward celebration');
 await start();assert.equal(await page.evaluate(()=>game.player.strength),1.02);
 await page.locator('#btnPause').tap();await page.locator('#btnResume').tap();assert.equal(await page.evaluate(()=>game.player.strength),1.02);
 await page.locator('#btnPause').tap();await start();assert.equal(await page.evaluate(()=>game.player.strength),1.02,'No compounding on restart');assert.equal(await count('wins'),3);
 await page.evaluate(()=>{game.player.die('기절',true);game.enemy.die('기절',true);});await wait(()=>game.state==='paused');await wait(()=>document.querySelector('[data-growth-status]').textContent==='저장됨');assert.equal(await count('wins'),3,'Simultaneous death gets no victory reward');
 await page.goto(new URL('?account=1&growth=1&weapon=rapier',base).href,{waitUntil:'domcontentloaded'});await wait(()=>!!game&&!!document.querySelector('.account-panel'));assert.equal(await page.locator('.hs-hub').count(),0,'Research entry excluded');assert.equal(await page.evaluate(()=>game.player.strength),1);
 await page.goto(base.href,{waitUntil:'domcontentloaded'});await wait(()=>!!window.game);assert.equal(await page.locator('.account-panel,.hs-hub').count(),0,'Normal game is unchanged');
 await Promise.all(pending);assert.deepEqual(errors,[]);
 const report={pass:true,local,at:new Date().toISOString(),groups:12,syntheticResults:4,limitations:'Enemy/player death states were injected only to test outcome bookkeeping. This is not a combat balance or human victory test. No hosted Supabase service configured.',hashes,errors};
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,groups:12,files:Object.keys(hashes).length,errors:errors.length}));
}catch(e){console.error(JSON.stringify(await page.evaluate(()=>({state:window.game?.state,title:document.querySelector('#menuTitle')?.textContent,growth:document.querySelector('.hs-hub')?.innerText,storage:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('stillness-growth:')))})).catch(()=>({}))));throw e;}finally{await browser.close();}
