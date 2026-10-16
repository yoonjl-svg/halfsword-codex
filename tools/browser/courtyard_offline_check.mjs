import {chromium} from 'playwright';
import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/courtyard-offline.json';
const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'allow'});
 const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
 const url=base+'/?stage=courtyard&foe=samira&weapon=brothers_sword&foeWeapon=pistol';
 await p.goto(url,{waitUntil:'load'});
 await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
 report.cache=await p.evaluate(async()=>{
  const keys=await caches.keys(),own=keys.filter(k=>k.startsWith('stillness-pwa:'));
  const paths=[];for(const key of own)for(const req of await (await caches.open(key)).keys())paths.push(new URL(req.url).pathname);
  return {caches:own.length,files:paths.length,reviewAssets:paths.filter(p=>p.startsWith('/encounters/')),gameBundle:paths.some(p=>p.startsWith('/assets/main-')),audio:paths.includes('/sfx/breath/breath1.mp3')};
 });
 assert.equal(report.cache.caches,1);assert.equal(report.cache.reviewAssets.length,0);assert.ok(report.cache.gameBundle&&report.cache.audio);
 await p.close(); // Only the offline page renders; avoid two software GPUs competing.
 await ctx.setOffline(true);
 const off=await ctx.newPage();off.on('pageerror',e=>report.errors.push(String(e)));
 await off.goto(url+'&offlineProbe=1',{waitUntil:'load'});
 // Before the module is ready, window.game can be the named canvas element.
 await off.waitForFunction(()=>typeof window.game?.state==='string'&&window.game.renderCap,null,{timeout:30000});
 await off.clock.install();
 await off.clock.pauseAt(new Date());
 report.before=await off.evaluate(()=>({state:game.state}));
 await off.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<200&&await off.evaluate(()=>game.state!=='fight');i++)await off.clock.runFor(16);
 assert.equal(await off.evaluate(()=>game.state),'fight');
 report.offline=await off.evaluate(async()=>({state:game.state,stage:game.stage.id,cover:!!game.scene.getObjectByName('courtyard-cover'),audio:(await fetch('sfx/breath/breath1.mp3')).ok}));
 assert.equal(report.offline.stage,'courtyard');assert.ok(report.offline.cover&&report.offline.audio);assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));
