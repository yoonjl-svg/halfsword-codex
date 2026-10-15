import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173';
const out=process.argv[3]||'/tmp/start-screen';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const key='stillness.start-preview.notices.v1',results=[],errors=[];
const check=(name,data={})=>results.push({check:name,...data});
const watch=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const ready=page=>page.waitForFunction(()=>document.getElementById('entrance').dataset.phase==='ready');
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
async function readAll(page){
 for(let i=0;i<30;i++){
  const done=await page.locator('#noticeList').evaluate(el=>{el.scrollTop+=Math.max(30,el.clientHeight/2);return el.scrollTop+el.clientHeight>=el.scrollHeight-1;});
  await page.waitForTimeout(45);if(done)break;
 }
}
async function bounds(page){
 return page.evaluate(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect(),b=document.getElementById('confirmNotices').getBoundingClientRect();return {dialog:[r.left,r.top,r.right,r.bottom],confirm:[b.left,b.top,b.right,b.bottom],viewport:[innerWidth,innerHeight],scroll:document.getElementById('noticeList').scrollHeight>document.getElementById('noticeList').clientHeight};});
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(`${base}/start.html`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('.notice-entry').count(),6);
 let b=await bounds(page);assert.equal(b.scroll,true);check('first launch: six real notices in scrollable dialog',b);await shot(page,'notices-desktop');
 await page.evaluate(()=>localStorage.setItem('gladiator-settings','{"prototype-sentinel":true}'));
 await page.locator('#hideRead').check();await page.locator('#confirmNotices').click();
 await page.waitForTimeout(850);await shot(page,'wind-transition-desktop');await ready(page);await shot(page,'title-desktop');
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 const doc=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'h1'});
 const fonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});assert.ok(fonts.fonts.some(f=>f.familyName==='Cinzel'&&f.isCustomFont));check('wind transition reveals existing Cinzel title and two choices',{fonts:fonts.fonts});
 const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(state.hideRead,true);assert.ok(state.readIds.length>0&&state.readIds.length<6);
 await page.locator('#newJourney').click();assert.equal(await page.locator('#newJourney').getAttribute('aria-pressed'),'true');
 await page.locator('#continueJourney').click();assert.equal(await page.locator('#continueJourney').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#newJourney').getAttribute('aria-pressed'),'false');
 assert.equal(await page.evaluate(()=>localStorage.getItem('gladiator-settings')),'{"prototype-sentinel":true}');check('choice feedback preserves game progress/settings');
 await page.reload({waitUntil:'networkidle'});
 const remaining=await page.locator('.notice-entry').evaluateAll(els=>els.map(el=>el.dataset.noticeId));assert.equal(remaining.length,6-state.readIds.length);assert.ok(remaining.every(id=>!state.readIds.includes(id)));check('hide-read preference persists; offscreen notices remain unread',{read:state.readIds,remaining});
 await readAll(page);await page.locator('#confirmNotices').click();await ready(page);await page.reload({waitUntil:'networkidle'});await ready(page);assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);check('all read: next launch goes to title');
 await page.locator('#openNotices').click();assert.equal(await page.locator('.notice-entry').count(),6);await page.locator('#hideRead').uncheck();await page.locator('#confirmNotices').click();await ready(page);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.notice-entry').count(),6);check('reopen notices and turn hiding off');
 await page.evaluate(k=>localStorage.setItem(k,'{bad json'),key);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.notice-entry').count(),6);check('invalid saved preference recovers');
 for(const [name,width,height] of [['phone-landscape',844,390],['phone-portrait',390,844],['small-landscape',568,320],['small-portrait',320,568]]){
  const mobile=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});watch(mobile);
  await mobile.goto(`${base}/start.html`,{waitUntil:'networkidle'});await mobile.evaluate(()=>document.fonts.ready);b=await bounds(mobile);
  assert.ok(b.dialog[0]>=0&&b.dialog[1]>=0&&b.dialog[2]<=width&&b.dialog[3]<=height,JSON.stringify(b));assert.ok(b.confirm[3]<=height);assert.equal(b.scroll,true);
  if(name.startsWith('phone'))await shot(mobile,`notices-${name}`);
  await mobile.locator('#confirmNotices').click();await ready(mobile);
  const title=await mobile.locator('h1').boundingBox();assert.ok(title.x>=0&&title.x+title.width<=width+1,JSON.stringify(title));
  assert.equal(await mobile.locator('#continueJourney').isVisible(),true);
  if(name.startsWith('phone'))await shot(mobile,`title-${name}`);check(`${name}: dialog, scrolling and title fit`,{width,height,...b});await mobile.close();
 }
 const reduced=await browser.newPage({viewport:{width:844,height:390},reducedMotion:'reduce'});watch(reduced);await reduced.goto(`${base}/start.html`,{waitUntil:'networkidle'});await reduced.locator('#confirmNotices').click();await ready(reduced);assert.equal(await reduced.locator('#titleScreen').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');check('reduced motion: immediate static title');
 const denied=await browser.newPage();watch(denied);await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('denied','SecurityError');};});await denied.goto(`${base}/start.html`,{waitUntil:'networkidle'});await denied.locator('#hideRead').check();await denied.locator('#confirmNotices').click();await ready(denied);check('storage denied: screen remains usable');
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} start-screen checks; errors ${errors.length}`);
