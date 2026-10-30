import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { CATALOG_ITEMS, CATALOG_CHARACTERS, filterCatalog } from '../../src/encyclopedia_data.js';
const base=process.argv[2]??'http://127.0.0.1:4187/';
const out=process.argv[3]??'docs/design/encyclopedia_20261031/v2';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM??'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[],checks=[];
try{
 for(const [width,height] of [[1280,720],[844,390],[740,360],[390,844],[320,700]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<1000});
  await context.addInitScript(()=>{window.realSave=window.localStorage;realSave.setItem('encyclopedia.qa','unchanged');window.saveBefore=JSON.stringify(Object.entries(realSave));});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base);await page.locator('.ec-card').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  const paths=[...new Set([...CATALOG_ITEMS,...CATALOG_CHARACTERS].flatMap(e=>[e.image,e.model,e.illustration]).filter(Boolean))];
  const images=await page.evaluate(async paths=>Promise.all(paths.map(src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({src,w:img.naturalWidth,h:img.naturalHeight});img.onerror=()=>resolve({src,error:true});img.src=src;}))),paths);
  assert(images.every(i=>!i.error));assert(images.filter(i=>i.src.includes('/characters/')).every(i=>i.w===720&&i.h===960));assert(images.filter(i=>i.src.includes('/items/')).every(i=>i.w>=1024&&i.h>=1024));
  async function five(){const r=await page.locator('.ec-card').evaluateAll(els=>els.slice(0,6).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}));assert.equal(r.length,6);assert(r.slice(0,5).every(x=>Math.abs(x.y-r[0].y)<1));assert(r[5].y>r[0].y+10);}
  async function shot(name){await page.locator('.ec-card img, .ec-hero img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));await page.screenshot({path:`${out}/${name}-${width}.png`});}
  async function contained(){const layout=await page.locator('.ec-dialog').evaluate(dialog=>{const img=dialog.querySelector('.ec-hero img'),art=dialog.querySelector('.ec-hero'),detail=dialog.querySelector('.ec-detail');const r=img.getBoundingClientRect(),a=art.getBoundingClientRect(),d=detail.getBoundingClientRect();return{open:dialog.open,w:r.width,h:r.height,fit:getComputedStyle(img).objectFit,imageInsideArt:r.left>=a.left-1&&r.top>=a.top-1&&r.right<=a.right+1&&r.bottom<=a.bottom+1,artInsideDetail:a.top>=d.top-1&&a.left>=d.left-1&&a.right<=d.right+1,overflow:dialog.scrollWidth-dialog.clientWidth};});assert(layout.open&&layout.w>0&&layout.h>0&&layout.fit==='contain'&&layout.imageInsideArt&&layout.artInsideDetail&&layout.overflow<2,JSON.stringify({width,layout}));}
  await five();assert.equal(await page.locator('.ec-card').count(),CATALOG_ITEMS.length);
  if(width===844||width===1280)await shot('items');
  await page.locator('select[aria-label="유파"]').selectOption('italian');await page.locator('select[aria-label="등급"]').selectOption('legend');assert.equal(await page.locator('.ec-card').count(),filterCatalog(CATALOG_ITEMS,{school:'italian',tier:'legend'}).length);await page.locator('.ec-reset').click();
  const search=page.locator('.ec-search input');await search.fill('뒤랑달');await page.locator('.ec-card').click();await page.locator('.ec-hero img').evaluate(img=>img.decode());await contained();assert.equal(await page.locator('#ecDetailName').textContent(),'뒤랑달');assert((await page.locator('.ec-hero img').getAttribute('src')).includes('/items/durandal.webp'));assert(await page.locator('.ec-next').isDisabled());
  if(width===844||width===1280)await shot('item-popup');
  await page.keyboard.press('Escape');await page.locator('.ec-dialog').waitFor({state:'hidden'});assert.equal(await search.inputValue(),'뒤랑달');assert.equal(await page.locator('.ec-card:focus').getAttribute('data-entry'),'durandal');
  await search.fill('없는 물건 987');assert(await page.locator('.ec-empty').isVisible());await page.locator('.ec-reset').click();
  // Native dialog traps keyboard focus; navigation retains the original grid return target.
  await page.locator('.ec-card').first().click();await page.locator('.ec-next').click();assert((await page.locator('.ec-position').textContent()).startsWith('2 /'));await page.keyboard.press('ArrowLeft');assert((await page.locator('.ec-position').textContent()).startsWith('1 /'));
  for(let i=0;i<7;i++){await page.keyboard.press('Tab');assert(await page.locator('.ec-dialog').evaluate(d=>d.contains(d.getRootNode().activeElement)));}
  await page.mouse.click(3,3);await page.locator('.ec-dialog').waitFor({state:'hidden'});
  await page.locator('#ecCharactersTab').click();await five();assert.equal(await page.locator('.ec-card').count(),CATALOG_CHARACTERS.length);assert((await page.locator('.ec-card img').first().getAttribute('src')).includes('/characters/player.webp'));
  if(width===844||width===1280)await shot('characters');
  await page.locator('select[aria-label="종류"]').selectOption('base');await search.fill('쥘리아');await page.locator('.ec-card').click();await contained();assert((await page.locator('.ec-hero img').getAttribute('src')).includes('ui/portraits/julia.webp'));assert((await page.locator('.ec-facts').textContent()).includes('숙련도4'));
  await page.locator('.ec-related').click();await contained();assert((await page.locator('.ec-facts').textContent()).includes('숙련도5'));assert((await page.locator('.ec-hero img').getAttribute('src')).includes('ui/portraits/julia_mad.webp'));
  if(width===844||width===1280||width===390)await shot('character-popup');
  await page.locator('.ec-close').click();await page.locator('.ec-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.ec-card:focus').getAttribute('data-entry'),'julia');assert.equal(await search.inputValue(),'쥘리아');
  await page.locator('.ec-reset').click();await page.locator('.ec-scroll').evaluate(e=>e.scrollTop=200);const scroll=await page.locator('.ec-scroll').evaluate(e=>e.scrollTop);await page.locator('[data-entry="tome"]').scrollIntoViewIfNeeded();const returnScroll=await page.locator('.ec-scroll').evaluate(e=>e.scrollTop);await page.locator('[data-entry="tome"]').click();await page.locator('.ec-close').click();await page.locator('.ec-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.ec-scroll').evaluate(e=>e.scrollTop),returnScroll);
  await page.locator('#tabItems').click();assert(await page.locator('#panelInventory').isVisible());await page.locator('#tabEncyclopedia').click();assert(await page.locator('#ecCharactersTab[aria-selected=true]').isVisible());
  const overflow=await page.locator('.ec-panel,.ec-scroll,.contents-panel,.profile-panel').evaluateAll(els=>els.filter(e=>!e.hidden).map(e=>({name:e.className,over:e.scrollWidth-e.clientWidth})));
  assert(overflow.every(e=>e.over<2),JSON.stringify({width,overflow}));assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(realSave))===saveBefore),true);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:[?#]|$)|rapier[^/]*\.js(?:[?#]|$)/.test(r.name))),false);
  checks.push({width,height,images:images.length,columns:5,popupContainment:true,focusTrap:true,escapeAndBackdrop:true,filteredNavigation:true,modelsThenProfiles:true,scrollRestored:true,saveUnchanged:true,noPhysicsLoaded:true,overflow});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/browser-checks.json`,JSON.stringify({base,checks,errors},null,2));console.log({views:checks.length,errors});
}finally{await browser.close();}
