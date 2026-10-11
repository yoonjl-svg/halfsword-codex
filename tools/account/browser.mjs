import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
const base=new URL(process.argv[2] || 'http://127.0.0.1:4292/'), out=process.argv[3] || '/tmp/halfsword-account-browser-local';
const build=process.argv[4] || '/tmp/halfsword-account-build-20261011';
const local=['127.0.0.1','localhost'].includes(base.hostname);
assert(local || base.href==='https://yoonjl-svg.github.io/halfsword-codex/');
await fs.mkdir(out,{recursive:true});
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
if(!local){const u=new URL(process.env.HTTPS_PROXY);launch.proxy={server:u.protocol+'//'+u.host};if(u.username)launch.proxy.username=decodeURIComponent(u.username);if(u.password)launch.proxy.password=decodeURIComponent(u.password);}
const browser=await chromium.launch(launch),errors=[],hashes={};
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
// Chromium does not inherit the managed proxy CA; Playwright's request transport does.
// Fetch actual public bytes with TLS verification enabled, then render those bytes.
if (!local) await context.route('**/*', async route => {
 try {
  const url=new URL(route.request().url());assert.equal(url.origin,base.origin);assert(url.pathname.startsWith(base.pathname));assert.equal(route.request().method(),'GET');
  const response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:30000});assert.equal(response.status(),200);
  await route.fulfill({response,body:await response.body()});
 } catch(error) {errors.push('public fetch: '+error.message);await route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const pending=[];
page.on('response',r=>{if(r.url().startsWith(base.href)&&r.status()===200)pending.push((async()=>{const url=new URL(r.url());const relative=decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html';if(!relative||relative.includes('..'))return;try{const actual=await r.body(),expected=await fs.readFile(path.join(build,relative));assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(expected).digest('hex'),relative);hashes[relative]=createHash('sha256').update(actual).digest('hex');}catch(e){errors.push('hash '+relative+': '+e.message);}})());});
const open=async(query='?account=1&cards=sain,ice&foe=renji&stage=qinglan')=>{await page.goto(new URL(query,base).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.game&&!!document.querySelector('.account-panel'));};
try{
 await page.goto(new URL('account.html',base).href);assert.match(await page.locator('body').innerText(),/이 기기 저장만 사용 가능/);
 await page.setViewportSize({width:320,height:640});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'guide.png'),fullPage:true});
 await page.setViewportSize({width:844,height:390});await open();await page.locator('.account-panel summary').click();
 assert.match(await page.locator('[data-status]').innerText(),/계정 서버 연결 전/);assert(await page.locator('[data-link]').isDisabled());
 await page.locator('[name=nickname]').fill('기억하는 여행자');await page.locator('[data-profile] button').click();
 await page.locator('[data-setting=sound]').click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('stillness-account:v1:halfsword-codex:game-settings')).sound);
 await open();await page.locator('.account-panel summary').click();assert.equal(await page.locator('[name=nickname]').inputValue(),'기억하는 여행자');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('stillness-account:v1:halfsword-codex:game-settings')).sound),saved);
 await page.screenshot({path:path.join(out,'account.png'),fullPage:true});
 await context.setOffline(true);await page.locator('[name=nickname]').fill('연결 없이 기억');await page.locator('[data-profile] button').click();await context.setOffline(false);
 await open();await page.locator('.account-panel summary').click();assert.equal(await page.locator('[name=nickname]').inputValue(),'연결 없이 기억');
 await page.locator('#btnStart').click();await page.waitForFunction(()=>window.game.draw.stage==='choose' && window.game.draw.t>=.45);await page.locator('.wcard[data-i="0"]').click();
 await page.waitForFunction(()=>window.game.state==='fight' && window.game.player.fightT>2.05,{timeout:20000});
 await page.touchscreen.tap(650,190);await page.waitForTimeout(400);await page.locator('#btnPause').click();
 assert(await page.locator('#menu').evaluate(e=>e.classList.contains('show')));await page.locator('#btnStart').click();
 await page.waitForFunction(()=>window.game.draw.stage==='choose' && window.game.draw.t>=.45);await page.locator('.wcard[data-i="0"]').click();await page.waitForFunction(()=>window.game.state==='fight' && window.game.player.fightT>2.05);
 // Normal game does not load the account panel or inherit trial preferences.
 await page.goto(new URL('?cards=sain,ice',base).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.game);assert.equal(await page.locator('.account-panel').count(),0);
 await Promise.all(pending);assert.deepEqual(errors,[]);
 const report={pass:true,local,at:new Date().toISOString(),checks:['320px guide','local nickname reload','settings reload','offline edit','mobile entry/input/pause/restart','normal game isolation'],hashes,errors};
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,checks:report.checks.length,files:Object.keys(hashes).length,errors:errors.length,out}));
}catch(error){console.error(JSON.stringify(await page.evaluate(()=>({state:window.game?.state,stage:window.game?.draw?.stage,t:window.game?.draw?.t,menu:document.querySelector('#menu')?.className})).catch(()=>({}))));throw error;}finally{await browser.close();}
