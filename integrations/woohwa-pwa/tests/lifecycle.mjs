import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root, origin, requiredEnv} from './config.mjs';
const {chromium}=await import(pathToFileURL(path.resolve(requiredEnv('PLAYWRIGHT_MODULE'))).href);
const chromePath=path.resolve(requiredEnv('CHROME_PATH'));
const base=origin+'/halfsword/';
// Permit the documented background server command to finish binding its loopback port.
for(let attempt=0;;attempt++) {
 try {const response=await fetch(origin+'/outside.html');assert(response.ok);break;}
 catch(error) {if(attempt>=49)throw new Error('Fixture server is not ready at '+origin,{cause:error});await new Promise(resolve=>setTimeout(resolve,100));}
}
const report={pass:false,checks:[],errors:[],limitations:['Chromium mobile emulation; real iPhone Add to Home Screen and Android OS installation are not automated here.','v2/v3 fixtures change only an HTML release marker; original game source is unchanged.']};
const record=(name,data=true)=>{report.checks.push({name,data});console.log('PASS '+name);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const v1=JSON.parse(await fs.readFile(root+'/v1/pwa-build.json')),v2=JSON.parse(await fs.readFile(root+'/v2/pwa-build.json')),v3=JSON.parse(await fs.readFile(root+'/v3/pwa-build.json'));
const prefix='stillness-pwa:'+base+':';
const mode=async(build,corrupt=false)=>fs.writeFile(root+'/server-state.json',JSON.stringify({build,corrupt}));
await mode('v1');
const profile=await fs.mkdtemp(path.join(root,'browser-profile-'));
const context=await chromium.launchPersistentContext(profile,{executablePath:chromePath,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking'],viewport:{width:844,height:390},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
const saved=JSON.stringify({pixel:false,sound:false,trail:false,blood:true,difficulty:'normal',skill:'0.3',fpsCap:false,moveMode:'stick'});
await context.addInitScript(value=>{if(!localStorage.getItem('gladiator-settings'))localStorage.setItem('gladiator-settings',value);},saved);
let page,probe,outside;
const wait=async(fn,arg)=>page.waitForFunction(fn,arg,{timeout:120000});
async function fight() {
 await page.locator('#btnStart').tap();
 await wait(()=>game.state==='draw'&&game.draw.stage==='choose'&&game.draw.t>.45);
 await page.locator('.wcard[data-i="0"]').tap();
 await wait(()=>game.state==='fight'&&game.player.fightT>2.05);
 await page.evaluate(()=>{window.pwaAccepted=0;const sample=()=>{if(game.state==='fight'&&game.player.handHeld&&game.player.inputActive)window.pwaAccepted++;requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:685,y:270,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:615,y:170,id:1}]});
 await wait(()=>window.pwaAccepted>0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 assert.equal(await page.locator('#pwaMenu').isVisible(),false);
 return page.evaluate(()=>({timeOrigin:performance.timeOrigin,body:game.player.bodies.pelvis.handle,step:game.combat.stepNo,accepted:window.pwaAccepted,settings:localStorage.getItem('gladiator-settings')}));
}
try {
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(base+'?cards=longsword,sabre',{waitUntil:'load'});
 await wait(()=>window.game?.enemy&&document.querySelector('#pwaMenu')?.dataset.state==='ready');
 const manifest=await page.evaluate(async()=>{const link=document.querySelector('link[rel="manifest"]');return {url:link.href,json:await(await fetch(link.href)).json()};});
 assert.equal(manifest.url,base+'manifest.webmanifest');assert.equal(new URL(manifest.json.start_url,manifest.url).href,base);
 assert.equal(manifest.json.display,'standalone');assert.equal(manifest.json.orientation,'landscape');
 const initial=await page.evaluate(async()=>({controller:!!navigator.serviceWorker.controller,keys:await caches.keys(),reg:(await navigator.serviceWorker.getRegistration()).scope}));
 assert.equal(initial.controller,false);assert.equal(initial.reg,base);assert(initial.keys.includes(prefix+v1.version));
 record('first install caches complete build without taking over running page',{manifest,initial,files:v1.files.length,bytes:v1.totalBytes});
 await page.reload({waitUntil:'load'});await wait(()=>navigator.serviceWorker.controller&&window.game?.enemy);
 await page.locator('#pwaMenu summary').tap();
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(layout.scrollWidth<=layout.width+1);
 await page.screenshot({path:root+'/menu.png'});
 const installability=await(await context.newCDPSession(page)).send('Page.getInstallabilityErrors');
 assert.deepEqual(installability.installabilityErrors,[]);record('Chromium installability and landscape menu',layout);
 await page.evaluate(async()=>{await(await caches.open('other-app-keep')).put('/sentinel',new Response('keep'));await(await caches.open('stillness-pwa:'+location.origin+'/halfsword-codex/:keep')).put('/fork-sentinel',new Response('fork'));});
 const first=await fight();assert.equal(first.settings,saved);record('real touch accepted; PWA hidden during fight',first);
 probe=await context.newPage();await probe.goto(base+'probe.html');assert(await probe.evaluate(()=>!!navigator.serviceWorker.controller));
 await mode('v2');
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await wait(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 await wait(()=>document.querySelector('#pwaMenu').dataset.state==='update-ready');
 const after=await page.evaluate(async()=>({timeOrigin:performance.timeOrigin,body:game.player.bodies.pelvis.handle,step:game.combat.stepNo,html:await(await fetch('./index.html')).text(),state:document.querySelector('#pwaMenu').dataset.state,settings:localStorage.getItem('gladiator-settings')}));
 assert.equal(after.timeOrigin,first.timeOrigin);assert.equal(after.body,first.body);assert(after.step>first.step);assert(!after.html.includes('name="pwa-test-release"'));assert.equal(after.state,'update-ready');assert.equal(after.settings,saved);
 record('update waits without reload or mixed HTML during combat',{timeOrigin:after.timeOrigin,step:after.step,state:after.state});
 await page.close();
 assert(await probe.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting));record('second open tab keeps previous version active');
 outside=await context.newPage();await outside.goto(origin+'/outside.html');await probe.close();
 await outside.waitForFunction(async({oldKey,newKey})=>{const ks=await caches.keys();return !ks.includes(oldKey)&&ks.includes(newKey);},{oldKey:prefix+v1.version,newKey:prefix+v2.version},{timeout:30000});
 assert.equal(await outside.evaluate(async()=>await(await caches.match('/sentinel')).text()),'keep');
 assert.equal(await outside.evaluate(async()=>await(await caches.match('/fork-sentinel')).text()),'fork');
 record('activation removes only own old cache; sibling game cache preserved');
 await context.setOffline(true);
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(base+'?cards=longsword,sabre&offline=1',{waitUntil:'load'});await wait(()=>window.game?.enemy);
 assert.equal(await page.locator('meta[name="pwa-test-release"]').getAttribute('content'),'v2');
 const offlineAudio=await page.evaluate(async()=>{const r=await fetch('sfx/breath/breath1.mp3');return {ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};});assert(offlineAudio.ok&&offlineAudio.bytes>0);
 const second=await fight();assert.equal(second.settings,saved);
 await page.locator('#btnPause').tap();await wait(()=>game.state==='paused');
 await page.screenshot({path:root+'/offline-menu.png'});
 const restart=await fight();assert(restart.accepted>0);record('new offline launch, audio, touch combat and restart',{second,restart,audio:offlineAudio});
 await page.locator('#btnPause').tap();await wait(()=>game.state==='paused');
 await context.setOffline(false);await mode('v3',true);
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await wait(()=>document.querySelector('#pwaMenu').dataset.state==='error');
 const failed=await page.evaluate(async()=>({keys:await caches.keys(),waiting:!!(await navigator.serviceWorker.getRegistration()).waiting,html:await(await fetch('./index.html')).text()}));
 assert(!failed.keys.includes(prefix+v3.version));assert(failed.keys.includes(prefix+v2.version));assert(!failed.waiting);assert(failed.html.includes('content="v2"'));
 record('corrupted new file rejects entire update; old version retained',{keys:failed.keys});
 await mode('v2');
 const worker=context.serviceWorkers().find(w=>w.url()===base+'sw.js');assert(worker);
 await worker.evaluate(()=>{self.__testOpen=self.caches.open;self.caches.open=async()=>{throw new Error('injected storage denial');};});
 const file=v2.files.find(f=>f.path==='pwa/icon-192.png');
 const returned=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch('./pwa/icon-192.png')).arrayBuffer())));
 assert.equal(sha(Buffer.from(returned)),file.sha256);
 await worker.evaluate(()=>{self.caches.open=self.__testOpen;delete self.__testOpen;});record('cache read denial still serves verified online bytes');
 assert.deepEqual(report.errors,[]);report.pass=true;
} catch(e) {report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:root+'/failure.png'}).catch(()=>{});}
finally {report.completedUTC=new Date().toISOString();await fs.writeFile(root+'/lifecycle-report.json',JSON.stringify(report,null,2)+'\n');await context.close();console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failure:report.failure?.message,errors:report.errors}));}
