import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const base=process.env.REVIEW_BASE||'http://127.0.0.1:5216/encounters/',dir=new URL('./',import.meta.url).pathname;
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),rows=[];
for(const slug of ['wander-heroes-20261023','wander-20261023']){
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const width of[320,390,844,1200]){await p.setViewportSize({width,height:844});await p.goto(base+slug+'/');await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));const r=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,images:document.images.length}));assert(r.scroll<=width);assert.equal(errors.length,0);rows.push({slug,...r});if(width===390)await p.screenshot({path:dir+slug+'-mobile.png',fullPage:true});}
 await p.close();
}await b.close();fs.writeFileSync(dir+'pages.json',JSON.stringify(rows,null,2));console.log('PASS 8 page widths and all images');
