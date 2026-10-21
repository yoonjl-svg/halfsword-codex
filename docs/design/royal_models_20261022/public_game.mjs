import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),out=[];
for(const id of ['bernardo','black_king','sebastian'])for(const role of ['foe','hero']){
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-22T00:50:00+09:00')});await p.clock.pauseAt(new Date('2026-10-22T00:50:01+09:00'));
 const slug=id==='sebastian'?'returned-king-20261022':'royal-concepts-20261022',query=role==='hero'?`hero=${id}&weapon=tizona&foe=bran&foeWeapon=tree_branch`:`foe=${id}&weapon=longsword`;
 const url=`http://127.0.0.1:5200/encounters/${slug}/game/?test=1&${query}&stage=cathedral&uniqueStage=5&nosw=1`;
 await p.goto(url);await p.waitForFunction(()=>window.game?.state==='menu');await p.evaluate(()=>{game.renderCap.tick=()=>false;document.querySelector('#btnStart').click()});for(let i=0;i<180&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 assert.equal(await p.evaluate(()=>game.state),'fight');const data=await p.evaluate(role=>{let f=role==='hero'?game.player:game.enemy;return{name:f.name,weapon:f.weapon.id,school:f.swordArt.tradition,helmet:f.helmetType}},role);assert.equal(data.weapon,'tizona');assert.equal(data.school,'iberian');assert.equal(data.name,{bernardo:'베르나르도',black_king:'검은 왕',sebastian:'세바스티앙'}[id]);assert.equal(errors.length,0);out.push({id,role,url,...data,errors});await p.close();
}
await browser.close();fs.writeFileSync(new URL('./public-game.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log({directLinks:out.length,pass:true});
