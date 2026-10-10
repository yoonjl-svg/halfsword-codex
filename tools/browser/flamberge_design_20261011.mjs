// Rendered model and mobile viewer delivery; no combat-performance claims.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createHash,X509Certificate}from'node:crypto';
import{chromium}from'/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const base=process.argv[2],out=process.argv[3];assert(base&&out);await fs.mkdir(out,{recursive:true});
const pins=[];for(const n of await fs.readdir('/usr/local/share/ca-certificates'))if(n.endsWith('.crt'))try{const c=new X509Certificate(await fs.readFile('/usr/local/share/ca-certificates/'+n));pins.push(createHash('sha256').update(c.publicKey.export({type:'spki',format:'der'})).digest('base64'));}catch{}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-certificate-errors-spki-list='+pins.join(',')]});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const report={pass:false,base,checks:[],errors:[],files:[]};let page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));const responses=[];
page.on('response',r=>{if(r.url().startsWith(base))responses.push(r);});
const pos=()=>page.evaluate(()=>flambergeView.camera.position.toArray());
try{
 await page.goto(base+'flamberge-viewer.html');await page.waitForFunction(()=>window.flambergeView);
 const bounds=await page.evaluate(()=>{const m=flambergeView.model,V=flambergeView.controls.target.constructor,lo=new V(Infinity,Infinity,Infinity),hi=new V(-Infinity,-Infinity,-Infinity),v=new V();let triangles=0;m.updateMatrixWorld(true);m.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;triangles+=(o.geometry.index?.count||a.count)/3;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);lo.min(v);hi.max(v);}}});return{min:lo.toArray(),max:hi.toArray(),size:hi.sub(lo).toArray(),triangles};});
 assert(Math.abs(bounds.size[0]-.505)<1e-5&&Math.abs(bounds.size[1]-1.689)<1e-5);assert(bounds.size[2]>0.04);report.checks.push({name:'actual geometry dimensions',bounds});
 for(const width of[320,390,844]){await page.setViewportSize({width,height:width===844?390:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});
 for(const id of['hilt','blade','edge','whole']){await page.locator(`[data-view="${id}"]`).tap();assert.equal(await page.locator(`[data-view="${id}"]`).getAttribute('aria-pressed'),'true');}
 await page.locator('#viewer').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox(),before=await pos();
 const cdp=await context.newCDPSession(page);const x=box.x+box.width*.55,y=Math.max(10,box.y)+130;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+55*i/6,y:y+25*i/6,id:1}]});await page.evaluate(()=>new Promise(requestAnimationFrame));}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await cdp.detach();assert.notDeepEqual(await pos(),before);
 const distance=()=>page.evaluate(()=>flambergeView.camera.position.distanceTo(flambergeView.controls.target));const d=await distance();await page.locator('#zoom-in').tap();await page.waitForFunction(expected=>Math.abs(flambergeView.camera.position.distanceTo(flambergeView.controls.target)-expected)<1e-6,d*.8);assert(Math.abs(await distance()/d-.8)<1e-6,JSON.stringify({before:d,after:await distance(),ratio:await distance()/d}));
 const zoomed=await pos();await page.setViewportSize({width:390,height:760});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await pos(),zoomed);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.locator('#zoom-out').tap();await page.waitForFunction(expected=>Math.abs(flambergeView.camera.position.distanceTo(flambergeView.controls.target)-expected)<1e-6,d);assert(Math.abs(await distance()/d-1)<1e-6);
 report.checks.push({name:'four presets, real touch orbit, zoom, view preserved on resize, persisted-pagehide simulation'});
 for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());assert(await img.evaluate(e=>e.naturalWidth>100));}
 report.checks.push({name:'five photos decoded'});
 await page.locator('[data-view="hilt"]').tap();await page.locator('#viewer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile.png'});
 // Hash the actual fetched public/browser resources, including entry, chunks and photos.
 const unique=new Map(responses.map(r=>[r.url(),r]));for(const[url,r]of unique){const b=await r.body();report.files.push({url,status:r.status(),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
 assert(report.files.every(f=>f.status===200));assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{report.completedUTC=new Date().toISOString();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,files:report.files.length,errors:report.errors,failure:report.failure?.message}));}
