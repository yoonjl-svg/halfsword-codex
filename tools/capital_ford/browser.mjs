import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:5292/ford.html',out=process.argv[3]||'docs/design/capital_ford_20261029/screens';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const checks=[];
for(const [mode,width,height,mobile]of [['explore',1280,800,false],['explore',844,390,true],['team',844,390,true],['duel',390,844,true]]){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});const page=await ctx.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)requests.push({status:r.status(),url:r.url()});});
 const u=new URL(base);u.searchParams.set('mode',mode);await page.goto(u.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__ford);await page.waitForTimeout(500);
 const storage=await page.evaluate(()=>({...localStorage}));
 if(!mobile){await page.evaluate(()=>document.getElementById('app').shadowRoot.querySelector('#battleModal').hidden=true);await page.screenshot({path:`${out}/overview.png`});await page.evaluate(()=>document.getElementById('app').shadowRoot.querySelector('#battleModal').hidden=false);}
 if(mobile)await page.locator('#battleGo').tap();else await page.locator('#battleGo').click();await page.waitForFunction(()=>window.__ford.G.elapsed>1.0,{},{timeout:60000});
 const initial=await page.evaluate(()=>window.__ford.G.human.bodies.pelvis.translation());
 if(mode==='explore'){
  if(mobile){const box=await page.locator('#movePad').boundingBox();const cdp=await ctx.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2-35,id:5}]});await page.waitForFunction(t=>window.__ford.G.elapsed>t+1.5,await page.evaluate(()=>window.__ford.G.elapsed),{timeout:60000});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await page.keyboard.down('w');await page.waitForFunction(t=>window.__ford.G.elapsed>t+1.5,await page.evaluate(()=>window.__ford.G.elapsed),{timeout:60000});await page.keyboard.up('w');}
 }
 if(mode!=='explore'){await page.locator('#guardButton').tap();await page.waitForFunction(()=>window.__ford.G.elapsed>2.0,{},{timeout:60000});}
 const data=await page.evaluate(()=>({position:window.__ford.G.human.bodies.pelvis.translation(),time:window.__ford.G.elapsed,metrics:window.__ford.metrics,stage:window.__ford.arena.stats(),fighters:window.__ford.G.fighters.length,storage:{...localStorage},overflow:document.documentElement.scrollWidth>innerWidth}));
 assert(data.time>0);assert(!data.overflow);assert.deepEqual(data.storage,storage);if(mode==='explore')assert(data.position.x>initial.x+.2,JSON.stringify({initial,data}));
 await page.screenshot({path:`${out}/${mode}-${width}.png`});
 // Actual pointer tap pauses and resumes; mouse/touch surface enters wide camera without losing the world.
 if(mobile)await page.locator('#battlePause').tap();else await page.locator('#battlePause').click();assert.equal(await page.evaluate(()=>window.__ford.playing),false);
 await page.locator('#viewMode').click();assert.equal(await page.evaluate(()=>window.__ford.view),'wide');if(mobile)await page.locator('#resumeBattle').tap();else await page.locator('#resumeBattle').click();assert.equal(await page.evaluate(()=>window.__ford.playing),true);
 checks.push({mode,width,height,initial,...data,errors,requests});assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await ctx.close();
}
await fs.writeFile(out+'/browser.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));await browser.close();
