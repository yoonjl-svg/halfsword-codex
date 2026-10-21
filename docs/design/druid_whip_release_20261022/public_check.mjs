import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),rows=[];
for(const path of ['druid-whip-20261021','iberian-boss-concepts-20261022']){
 const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,390,1200]){await p.setViewportSize({width,height:800});await p.goto('http://127.0.0.1:5200/encounters/'+path+'/');await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));rows.push({path,width,images:await p.locator('img').count(),errors});}
 await p.close();
}
const p=await b.newPage({viewport:{width:960,height:640},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5200/encounters/druid-whip-20261021/game/?test=1&weapon=druid_whip&foe=bran&foeWeapon=tree_branch&stage=clearing&uniqueStage=5&nosw=1');await p.waitForFunction(()=>game?.state==='menu');await p.locator('#btnStart').click();await p.waitForFunction(()=>game.state==='fight');assert.equal(await p.evaluate(()=>game.player.flexWeapon.active),8);assert.equal(errors.length,0);rows.push({nestedGame:true,errors});await b.close();fs.writeFileSync(new URL('./public-checks.json',import.meta.url),JSON.stringify(rows,null,2));console.log(rows);
