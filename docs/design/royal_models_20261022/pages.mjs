import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const base=process.env.REVIEW_BASE||'http://127.0.0.1:5200/encounters/',dir=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),results=[];
for(const slug of ['royal-concepts-20261022','returned-king-20261022']){
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,390,844,1200]){
  await p.setViewportSize({width,height:844});await p.goto(base+slug+'/');await p.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));await p.locator('img').evaluateAll(nodes=>nodes.forEach(n=>n.loading='eager'));await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const data=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,images:document.images.length,links:[...document.querySelectorAll('nav a')].map(a=>a.href)}));assert(data.scroll<=width,JSON.stringify(data));assert.equal(errors.length,0);results.push({slug,...data,errors});if(width===390)await p.screenshot({path:dir+slug+'-mobile.png',fullPage:true});
 }
 const links=await p.locator('a[href^="game/?"]').evaluateAll(nodes=>nodes.map(a=>a.href));for(const url of links){const r=await p.request.get(url);assert.equal(r.status(),200);const u=new URL(url),id=u.searchParams.get('hero')||u.searchParams.get('foe');assert(['bernardo','black_king','sebastian'].includes(id));assert.equal(u.searchParams.get('stage'),'cathedral');assert.equal(u.searchParams.get('nosw'),'1');}
 await p.close();
}
await browser.close();fs.writeFileSync(dir+'pages.json',JSON.stringify(results,null,2)+'\n');console.log({viewports:results.length,pass:true});
