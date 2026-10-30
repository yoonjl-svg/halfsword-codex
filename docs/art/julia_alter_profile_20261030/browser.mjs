import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const base=process.env.PROFILE_URL||'http://127.0.0.1:5290/encounters/julia-alter-profile-20261030/',out=process.env.PROFILE_OUT||new URL('./',import.meta.url).pathname;
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),rows=[];
for(const width of [390,844,1280]){
 const c=await b.newContext({viewport:{width,height:width===390?844:900},hasTouch:true,isMobile:width<900}),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});
 await p.goto(base);await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('#showGrid').tap();await p.waitForFunction(()=>document.querySelector('#pixel').src.endsWith('grid.png')&&document.querySelector('#pixel').complete);
 assert.equal(await p.locator('#showGrid').getAttribute('aria-pressed'),'true');
 await p.locator('#showLow').tap();await p.waitForFunction(()=>document.querySelector('#pixel').src.endsWith('low.png')&&document.querySelector('#pixel').complete);
 await p.locator('summary').tap();assert(await p.locator('details').evaluate(e=>e.open));
 await p.screenshot({path:out+'gallery-'+width+'.png',fullPage:true});
 const alpha=await p.evaluate(async()=>{const image=document.querySelector('#pixel');await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=1254;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(627,127,1,1).data[3]});assert.equal(alpha,0);
 const dl=await p.evaluate(async()=>{const r=await fetch('julia-alter-profile.zip');const data=new Uint8Array(await r.arrayBuffer());return {status:r.status,signature:String.fromCharCode(data[0],data[1])}});assert.equal(dl.status,200);assert.equal(dl.signature,'PK');
 assert.equal(errors.length,0);rows.push({width,imagesLoaded:true,gridSwitch:true,comparisonExpanded:true,noOverflow:true,backgroundAlpha:alpha,zipDownload:true,errors});await c.close();
}await b.close();fs.writeFileSync(out+'browser-qa.json',JSON.stringify({base,rows},null,2));console.log(rows);
