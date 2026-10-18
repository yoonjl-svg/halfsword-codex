import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.PORTRAIT_REVIEW_URL || 'http://127.0.0.1:4330/encounters/pixel-profiles-low128-20261017/';
const out=new URL('../../docs/art/pixel_profiles_strict_20261018',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],results=[];
for(const width of [320,390,1200]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('.card').last().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.card').count(),34);
 await page.evaluate(()=>Promise.all([...document.querySelectorAll('img[src]')].map(i=>i.decode())));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('[data-group=base]').click();assert.equal(await page.locator('.card').count(),18);
 if(width===1200)await page.screenshot({path:out+'/gallery-base.png',fullPage:true});
 await page.locator('[data-group=alter]').click();assert.equal(await page.locator('.card').count(),16);
 await page.evaluate(()=>Promise.all([...document.querySelectorAll('img[src]')].map(i=>i.decode())));
 if(width===1200)await page.screenshot({path:out+'/gallery-alter.png',fullPage:true});
 await page.locator('[data-group=base]').click();await page.locator('[data-background=check]').click();
 await page.locator('.card[data-id=artoria]').click();assert(await page.locator('dialog').isVisible());
 await page.evaluate(()=>Promise.all([...document.querySelectorAll('dialog img')].map(i=>i.decode())));
 if(width===390)await page.screenshot({path:out+'/mobile-artoria.png',fullPage:true});
 await page.locator('#next').click();assert((await page.locator('#detail-name').textContent()).includes('마야'));
 await page.locator('#previous').click();assert((await page.locator('#detail-name').textContent()).includes('아르토리아'));
 await page.keyboard.press('Escape');assert(!(await page.locator('dialog').isVisible()));
 await page.locator('#toggle-grid').click();assert.equal(await page.locator('#toggle-grid').getAttribute('aria-pressed'),'true');
 await page.locator('[data-background=dark]').click();
 if(width===1200){
  await page.screenshot({path:out+'/grid-base.png',fullPage:true});
  await page.locator('#toggle-grid').click();await page.locator('[data-group=all]').click();
  await page.evaluate(()=>{const keep=['player1','artoria','isolde','eira','chanda','terracotta','liao_mad','tome_mad'];document.querySelectorAll('.card').forEach(c=>{if(!keep.includes(c.dataset.id))c.style.display='none'});document.querySelector('h1').textContent='Stillness · 공통 액자와 단일 격자';document.querySelectorAll('nav,.count,footer,#toggle-grid').forEach(e=>e.style.display='none');});
  await page.screenshot({path:out+'/preview.png',fullPage:true});
 }
 results.push({width,counts:[34,18,16],horizontalOverflow:false,comparison:true,gridOverlay:true});await page.close();
}
const page=await browser.newPage();await page.goto(base);
const decoded=await page.evaluate(async()=>{const p=await(await fetch('profiles.json')).json();return Promise.all(p.characters.flatMap(c=>['original','low'].map(async k=>{const i=new Image();i.src=c[k].file;await i.decode();return{id:c.id,type:k,width:i.naturalWidth,height:i.naturalHeight}})))});
assert.equal(decoded.length,68);assert(decoded.every(i=>i.width===1254&&i.height===1254));assert.deepEqual(errors,[]);
await fs.writeFile(out+'/browser-verification.json',JSON.stringify({date:new Date().toISOString(),localReviewGallery:base,results,decoded,errors},null,2));await browser.close();console.log('Browser pass: 320/390/1200, 68 PNG, filter/comparison/keyboard/grid/overflow');
