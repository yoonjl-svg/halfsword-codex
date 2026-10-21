import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:4531';
const dir=new URL('./',import.meta.url);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/tools/browser/weapon_thumbs.html?ids=hwando,kriegsmesser,longsword');await page.waitForFunction(()=>window.thumbs?.done);
await page.screenshot({path:new URL('thumbs.png',dir).pathname});
const state=[];
for(const weapon of ['hwando','kriegsmesser']){
 await page.goto(base+'/?test=1&weapon='+weapon+'&foe=bran&foeWeapon=tree_branch&stage=clearing&foeWhiff=1');
 await page.waitForFunction(()=>window.game?.state==='menu',null,{timeout:120000});await page.locator('#btnStart').click();await page.waitForFunction(()=>game.state==='fight',null,{timeout:60000});await page.waitForTimeout(1300);
 state.push(await page.evaluate(()=>({weapon:game.player.weapon.id,tier:game.player.weapon.tier,school:game.player.art?.tradition,frame:game.player.weapon.frame,staminaMass:game.player.stamina.originalMass})));
 await page.screenshot({path:new URL(weapon+'-equipped.png',dir).pathname});
}
await page.goto(base+'/?test=1&cards=hwando,kriegsmesser&foe=bran&foeWeapon=tree_branch&stage=clearing&foeWhiff=1');await page.waitForFunction(()=>window.game?.state==='menu',null,{timeout:120000});await page.locator('#btnStart').click();await page.waitForFunction(()=>game.draw.stage==='choose'&&game.draw.t>=.5);await page.locator('.wcard').nth(0).click();
await page.evaluate(()=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('reveal timeout')),20000);function tick(){if(game.draw.others&&game.draw.foe){game.draw.hold=true;clearTimeout(timeout);resolve();}else requestAnimationFrame(tick);}tick();}));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:new URL('cards-desktop.png',dir).pathname});
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);await page.screenshot({path:new URL('cards-mobile.png',dir).pathname});
const cards=await page.locator('.wcard').allTextContents();await fs.writeFile(new URL('browser.json',dir),JSON.stringify({state,cards,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({state,errors}));
