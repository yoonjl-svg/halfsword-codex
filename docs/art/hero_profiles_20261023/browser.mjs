import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url).pathname;
const base=process.env.PROFILE_BASE||'http://127.0.0.1:5230/encounters/pixel-profiles-low128-20261017/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
for(const width of [320,390,844,1280]){
 const context=await browser.newContext({viewport:{width,height:width<500?844:850},isMobile:width<500,hasTouch:width<500});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?new=1');await p.locator('.card').last().waitFor();await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('.card').count(),3);
 assert.equal(await p.locator('#count').innerText(),'3개 초상');
 await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.card img')].map(i=>i.decode()))});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('[data-mode=original]').click();
 await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.card img')].map(i=>i.decode()))});
 if(width===1280)await p.screenshot({path:root+'originals-desktop.png',fullPage:true});
 await p.locator('[data-mode=low]').click();
 await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.card img')].map(i=>i.decode()))});
 if(width===1280)await p.screenshot({path:root+'lows-desktop.png',fullPage:true});
 await p.locator('[data-background=check]').click();await p.locator('#toggle-grid').click();
 assert.equal(await p.locator('body').getAttribute('data-grid'),'true');
 await p.locator('.card[data-id=black_king]').click();
 await p.locator('#original').evaluate(i=>i.decode());await p.locator('#low').evaluate(i=>i.decode());
 assert.equal(await p.locator('#detail-name').innerText(),'올리비에');
 for(const k of ['original','low','grid']){
  const link=await p.locator('#download-'+k).getAttribute('href');
  const response=await p.request.get(new URL(link,base).href);assert(response.ok());
 }
 await p.locator('#next').click();assert.equal(await p.locator('#detail-name').innerText(),'롤랑');
 await p.locator('#previous').click();assert.equal(await p.locator('#detail-name').innerText(),'올리비에');
 if(width===390)await p.screenshot({path:root+'mobile-detail.png',fullPage:true});
 await p.locator('#close').click();assert.equal(await p.locator('dialog').evaluate(d=>d.open),false);
 await p.locator('[data-group=all]').click();assert.equal(await p.locator('.card').count(),37);
 const decoded=await p.evaluate(async()=>{
  const m=await fetch('profiles.json').then(r=>r.json());let count=0;
  for(const c of m.characters){for(const k of ['original','low','gridPreview']){const im=new Image();im.src=c[k].file;await im.decode();if(im.width!==1254||im.height!==1254)throw Error(c.id+k);count++}}
  return count;
 });assert.equal(decoded,111);
 assert.equal(errors.length,0);
 results.push({width,newProfiles:3,totalProfiles:37,decodedPNGs:decoded,overflow:false,gridToggle:true,downloads:true,pagerAndClose:true,errors});
 await context.close();
}
await browser.close();fs.writeFileSync(root+'browser-verification.json',JSON.stringify({base,results},null,2)+'\n');console.log(results);
