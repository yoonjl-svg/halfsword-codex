import { chromium } from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out='/workspace/portrait-reference-20261017/gallery';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const reports=[];
for(const [width,height] of [[320,740],[390,844],[844,390],[1200,900]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});
 await page.goto('http://127.0.0.1:4199/encounters/pixel-profiles-20261017/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.card').count(),17);
 assert(await page.locator('.card img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`${out}/gallery-${width}.png`,fullPage:true});
 await page.locator('.card').first().click();
 assert.equal(await page.locator('#detail-name').textContent(),'플레이어');
 await page.screenshot({path:`${out}/player-${width}.png`});
 await page.locator('#previous').click();assert.equal(await page.locator('#detail-name').textContent(),'병마용');
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#detail-name').textContent(),'플레이어');
 const names=[];
 for(let i=0;i<17;i++){names.push(await page.locator('#detail-name').textContent());assert(await page.locator('#detail-image img').evaluate(i=>i.complete&&i.naturalWidth>0));await page.locator('#next').click();}
 assert.equal(new Set(names).size,17);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
 assert(await page.locator('.card').first().evaluate(b=>b===document.activeElement));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 assert.equal(errors.length,0,errors.join('\n'));
 reports.push({viewport:[width,height],characters:17,imagesLoaded:true,noOverflow:true,dialogCycle:17,focusRestored:true,errors});
 await page.close();
}
await browser.close();writeFileSync(`${out}/smoke.json`,JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports));
