import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const base=process.argv[2],out=process.argv[3],local=base==='http://127.0.0.1:4226/';
assert(local||base==='https://yoonjl-svg.github.io/halfsword-codex/');assert(out?.startsWith('/tmp/halfsword-isolde-bleed2-20261014/'));
const root=path.resolve('public'),prefix='transfers/isolde-bleed2-20261014';
const names=(await fs.readdir(path.join(root,prefix))).map(x=>prefix+'/'+x);names.push(prefix+'.zip');
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected=new Map(await Promise.all(names.map(async n=>[n,await fs.readFile(path.join(root,n))])));
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']};
if(!local){const u=new URL(process.env.HTTPS_PROXY||process.env.https_proxy);launch.proxy={server:u.protocol+'//'+u.host};if(u.username)launch.proxy.username=decodeURIComponent(u.username);if(u.password)launch.proxy.password=decodeURIComponent(u.password);}
const report={pass:false,local,files:[],audio:[],errors:[],deliveryToolSha256:hash(await fs.readFile(new URL(import.meta.url)))};let browser;
try{
 browser=await chromium.launch(launch);const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',ignoreHTTPSErrors:false});
 for(const [name,bytes] of expected){const r=await ctx.request.get(base+name,{maxRedirects:0});assert.equal(r.status(),200,name);const b=await r.body();assert.equal(hash(b),hash(bytes),name);report.files.push({name,bytes:b.length,sha256:hash(b)});}
 await ctx.route('**/*',async route=>{try{const u=new URL(route.request().url()),n=u.pathname.slice(new URL(base).pathname.length);assert.equal(u.origin,new URL(base).origin);assert(expected.has(n));const headers={...route.request().headers()};delete headers.range;const r=await route.fetch({headers,maxRedirects:0});assert.equal(r.status(),200,n);const b=await r.body();assert.equal(hash(b),hash(expected.get(n)));await route.fulfill({response:r,body:b});}catch(e){report.errors.push(e.message);await route.abort();}});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+prefix+'/index.html',{waitUntil:'networkidle'});
 report.audio=await page.evaluate(async()=>{const c=new AudioContext(),rows=[];for(const a of document.querySelectorAll('audio')){const b=await c.decodeAudioData(await(await fetch(a.src)).arrayBuffer());rows.push({id:a.id,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate});}await c.close();return rows;});
 for(const [id,d]of[['candidate',.75],['reserve',.68025],['source',8.80558]]){assert(Math.abs(report.audio.find(x=>x.id===id).duration-d)<.002);await page.locator(`[data-play="${id}"]`).tap();await page.waitForFunction(id=>document.getElementById(id).currentTime>.04,id);await page.evaluate(id=>document.getElementById(id).pause(),id);}
 for(const width of[320,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.screenshot({path:out+'.png',fullPage:true});assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.message;process.exitCode=1;}finally{if(browser)await browser.close();report.completedUTC=new Date().toISOString();await fs.writeFile(out+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,files:report.files.length,audio:report.audio,failure:report.failure}));}
