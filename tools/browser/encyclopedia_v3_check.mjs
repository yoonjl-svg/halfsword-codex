import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { CATALOG_ITEMS, CATALOG_CHARACTERS } from '../../src/encyclopedia_data.js';
const base=process.argv[2]??'http://127.0.0.1:4187/';
const out=process.argv[3]??'docs/design/encyclopedia_20261031/v3';
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
  assert(images.every(i=>!i.error));assert(images.filter(i=>i.src.includes('/characters/')).every(i=>i.w===720&&i.h===960));
  async function columns(n){const r=await page.locator('.ec-card').evaluateAll((els,n)=>els.slice(0,n+1).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}),n);assert(r.slice(0,n).every(x=>Math.abs(x.y-r[0].y)<1));assert(r[n].y>r[0].y+10);}
  async function shot(name){await page.locator('.ec-card img, .ec-hero img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode()})));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`${out}/${name}-${width}.png`});}
  async function popup(){const layout=await page.locator('.ec-dialog').evaluate(d=>{const img=d.querySelector('.ec-hero img'),art=d.querySelector('.ec-hero'),r=img.getBoundingClientRect(),a=art.getBoundingClientRect();return{open:d.open,w:r.width,h:r.height,fit:getComputedStyle(img).objectFit,inside:r.left>=a.left-1&&r.top>=a.top-1&&r.right<=a.right+1&&r.bottom<=a.bottom+1,overflow:d.scrollWidth-d.clientWidth};});assert(layout.open&&layout.w>0&&layout.h>0&&layout.fit==='contain'&&layout.inside&&layout.overflow<2);}
  assert.equal(await page.locator('.encyclopedia input,.encyclopedia select,.ec-search,.ec-filters,.ec-count,.ec-total').count(),0);
  await columns(5);assert.equal(await page.locator('.ec-card').count(),CATALOG_ITEMS.length);
  if(width===844||width===1280)await shot('items');
  await page.locator('[data-entry="durandal"]').click();await popup();assert.equal(await page.locator('#ecDetailName').textContent(),'뒤랑달');assert((await page.locator('.ec-hero img').getAttribute('src')).includes('/items/durandal.webp'));
  if(width===844)await shot('item-popup');
  await page.keyboard.press('Escape');await page.locator('.ec-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.ec-card:focus').getAttribute('data-entry'),'durandal');
  await page.locator('.ec-card').first().click();await page.locator('.ec-next').click();assert((await page.locator('.ec-position').textContent()).startsWith('2 /'));await page.keyboard.press('ArrowLeft');assert((await page.locator('.ec-position').textContent()).startsWith('1 /'));
  for(let i=0;i<7;i++){await page.keyboard.press('Tab');assert(await page.locator('.ec-dialog').evaluate(d=>d.contains(d.getRootNode().activeElement)));}
  await page.mouse.click(3,3);await page.locator('.ec-dialog').waitFor({state:'hidden'});
  await page.locator('#ecCharactersTab').click();await columns(3);assert.equal(await page.locator('.ec-card').count(),CATALOG_CHARACTERS.length);assert((await page.locator('.ec-card img').first().getAttribute('src')).includes('/characters/player.webp'));
  const cards=await page.locator('.ec-models').evaluate(grid=>{const scroll=grid.closest('.ec-scroll'),panel=grid.closest('.ec-panel'),art=grid.querySelector('.ec-art'),r=art.getBoundingClientRect();return{cardBackground:getComputedStyle(art).backgroundColor,artRatio:r.width/r.height,scrollFraction:scroll.clientHeight/panel.clientHeight,overflows:[...grid.querySelectorAll('.ec-card-text')].some(e=>e.scrollWidth>e.clientWidth+1)};});
  assert.equal(cards.cardBackground,'rgb(48, 38, 28)');assert(Math.abs(cards.artRatio-.75)<.02);assert(cards.scrollFraction>.97);assert(!cards.overflows);
  if(width===844||width===1280||width===390)await shot('characters');
  // Last rows and related forms remain accessible without search or filters.
  await page.locator('[data-entry="julia"]').click();await popup();assert((await page.locator('.ec-hero img').getAttribute('src')).includes('ui/portraits/julia.webp'));assert((await page.locator('.ec-facts').textContent()).includes('숙련도4'));
  await page.locator('.ec-related').click();await popup();assert((await page.locator('.ec-facts').textContent()).includes('숙련도5'));assert((await page.locator('.ec-hero img').getAttribute('src')).includes('ui/portraits/julia_mad.webp'));
  if(width===844)await shot('character-popup');
  await page.locator('.ec-close').click();await page.locator('.ec-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.ec-card:focus').getAttribute('data-entry'),'julia');
  await page.locator('[data-entry="tome"]').scrollIntoViewIfNeeded();const returnScroll=await page.locator('.ec-scroll').evaluate(e=>e.scrollTop);await page.locator('[data-entry="tome"]').click();await page.locator('.ec-close').click();await page.locator('.ec-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.ec-scroll').evaluate(e=>e.scrollTop),returnScroll);
  await page.locator('#tabItems').click();assert(await page.locator('#panelInventory').isVisible());await page.locator('#tabEncyclopedia').click();assert(await page.locator('#ecCharactersTab[aria-selected=true]').isVisible());
  const overflow=await page.locator('.ec-panel,.ec-scroll,.contents-panel,.profile-panel').evaluateAll(els=>els.filter(e=>!e.hidden).map(e=>({name:e.className,over:e.scrollWidth-e.clientWidth})));
  assert(overflow.every(e=>e.over<2));assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(realSave))===saveBefore),true);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:[?#]|$)|rapier[^/]*\.js(?:[?#]|$)/.test(r.name))),false);
  checks.push({width,height,images:images.length,itemColumns:5,characterColumns:3,searchAndFiltersRemoved:true,cards,popup:true,focusTrap:true,escapeAndBackdrop:true,modelsThenProfiles:true,scrollRestored:true,saveUnchanged:true,noPhysicsLoaded:true,overflow});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/browser-checks.json`,JSON.stringify({base,checks,errors},null,2));console.log({views:checks.length,errors});
}finally{await browser.close();}
