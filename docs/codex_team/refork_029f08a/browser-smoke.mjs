import {chromium} from '/workspace/halfsword-encyclopedia-20261031/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const out='/tmp/refork-029f08a-checks/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
try {
 await page.goto('http://127.0.0.1:4197/');
 await page.locator('#confirmNotices').waitFor({timeout:90000});
 await page.locator('#confirmNotices').tap();
 await page.locator('#enterLobby').tap();
 await page.locator('#lobbyDepart').waitFor({timeout:90000});
 for(const [dialog,close] of [['treeDialog','closeTree'],['titleDialog','closeTitle']]) {
   if(await page.locator(`#${dialog}[open]`).count())await page.locator(`#${close}`).tap();
 }
 await page.screenshot({path:out+'lobby.png'});
 await page.locator('#lobbyDepart').tap();
 await page.waitForFunction(()=>window.game?.state==='draw'&&window.game.draw.stage==='choose'&&window.game.draw.t>.6,null,{timeout:90000});
 await page.locator('#draw .wcard[data-i="0"]').tap();
 await page.waitForFunction(()=>window.game?.state==='fight',null,{timeout:90000});
 const before=await page.evaluate(()=>window.game.stats.simTime);
 const drawn=await page.evaluate(()=>({foeFlipped:document.querySelector('#draw .wcard.foe').classList.contains('flipped'),foeCard:window.game.draw.ids[2],foeWeapon:window.game.enemy.weapon.id}));
 assert.ok(drawn.foeFlipped);assert.equal(drawn.foeCard,drawn.foeWeapon);
 await page.waitForTimeout(8000);
 const state=await page.evaluate(()=>({game:window.game.state,simTime:window.game.stats.simTime,player:window.game.player.state,enemy:window.game.enemy.state,weapon:window.game.player.weapon.id,enemyWeapon:window.game.enemy.weapon.id}));
 assert.ok(state.simTime>before);assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'fight.png'});
 await writeFile(out+'browser-smoke.json',JSON.stringify({passed:true,compiled:true,touch:true,viewport:{width:844,height:390},titleToLobby:true,lobbyToStage:true,drawn,physicsAdvance:state.simTime-before,state,errors},null,2)+'\n');
 console.log(JSON.stringify({passed:true,state,errors}));
} catch(error) {
 await page.screenshot({path:out+'browser-failure.png'});
 await writeFile(out+'browser-failure.json',JSON.stringify({error:String(error),errors},null,2));
 throw error;
} finally {await browser.close();}
