import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url).pathname;
const base='http://127.0.0.1:5230/encounters/pixel-profiles-low128-20261017/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?new=1');await page.locator('.card').last().waitFor();
  await page.locator('[data-mode=low]').click();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.card img')].map(i=>i.decode()))});
  assert.equal(await page.locator('.card').count(),3);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+`gallery-${width}.png`,fullPage:true});
  for(const id of ['sebastian','black_king']){
    await page.locator(`.card[data-id=${id}]`).click();
    await page.locator('#low').evaluate(i=>i.decode());
    assert.equal(await page.locator('#low').evaluate(i=>i.naturalWidth),1254);
    for(const k of ['low','grid'])assert((await page.request.get(new URL(await page.locator('#download-'+k).getAttribute('href'),base).href)).ok());
    await page.screenshot({path:root+`${id}-${width}.png`,fullPage:true});
    await page.locator('#close').click();
  }
  assert.equal(errors.length,0);results.push({width,profiles:3,overflow:false,updatedLowsAndGridDownloads:true,errors});
  await context.close();
}
await browser.close();fs.writeFileSync(root+'browser-verification.json',JSON.stringify(results,null,2)+'\n');console.log(results);
