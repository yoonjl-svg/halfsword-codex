import { chromium } from 'playwright';
import assert from 'node:assert/strict';import fs from 'node:fs';
const out=new URL('./',import.meta.url).pathname, base=process.env.WANDER_BASE||'http://127.0.0.1:5212/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const c=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});const p=await c.newPage(),errors=[];
p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
await p.clock.install({time:new Date('2026-10-23T00:35:00+09:00')});await p.clock.pauseAt(new Date('2026-10-23T00:35:01+09:00'));
await p.addInitScript(()=>{ if(!localStorage.getItem('wander-browser-seeded')) {
 localStorage.setItem('wander-browser-seeded','yes');
 localStorage.setItem('stillness.lobby.weapon.v1',JSON.stringify({version:1,weapon:'tree_branch'}));
 localStorage.setItem('stillness.journey.checkpoint.v1',JSON.stringify({version:1,stage:'castle'}));
 localStorage.setItem('stillness.journeyClears.v1','2');
} Element.prototype.requestFullscreen=async()=>{}; });
async function tick(ms=500){await p.clock.runFor(ms)}
async function click(id){await p.locator('#'+id).evaluate(el=>el.click());await tick();}
async function titleToFight(){await p.waitForFunction(()=>window.game?.state);await p.evaluate(()=>{game.renderCap.tick=()=>false});await click('confirmNotices');await tick(2200);await click('continueJourney');await p.waitForFunction(()=>game.state==='fight');await tick();}
async function lobby(){await click('btnPause');await click('btnLobby');await p.waitForSelector('#lobbyWander');await tick(350)}
async function shot(name){await p.evaluate(()=>game.renderCap.tick=()=>true);await tick(16);await p.screenshot({path:out+name+'.png'});await p.evaluate(()=>game.renderCap.tick=()=>false)}
await p.goto(base+'?title=1&nosw=1');await titleToFight();await lobby();
assert(await p.locator('#lobbyWander').isDisabled());await shot('locked-lobby');
// Unlock through the same public progress API; victory handling separately exercised below.
await p.evaluate(async()=>{const m=await import('/src/lobby_progress.js'),s=await import('/src/stages.js');s.STAGE_ORDER.forEach(id=>m.recordCampaignStage(id,s.STAGE_ORDER));});
await click('lobbyDepart');await lobby();assert(!await p.locator('#lobbyWander').isDisabled());
const normalSave=await p.evaluate(()=>localStorage.getItem('stillness.journey.checkpoint.v1'));
const sizes=[];
for(const [width,height]of[[844,390],[1200,800],[390,844],[320,700],[667,375]]){
 await p.setViewportSize({width,height});await tick();
 // Narrow portrait devices intentionally show the existing rotation screen; inspect layout behind it too.
 const layout=await p.evaluate(()=>{const r=document.querySelector('#gameEntrance').shadowRoot,l=r.querySelector('.lobby'),b=r.querySelector('#lobbyWander').getBoundingClientRect(),d=r.querySelector('#lobbyDepart').getBoundingClientRect(),a=r.querySelector('#lobbyPortrait').getBoundingClientRect();return{overflow:l.scrollWidth-l.clientWidth,button:b.toJSON(),depart:d.toJSON(),portrait:a.toJSON()}});
 assert(layout.overflow<=1,JSON.stringify(layout));assert(layout.button.y>=layout.depart.bottom-1);assert(layout.depart.y>=layout.portrait.bottom-1);sizes.push({width,height,...layout});
 if(width===844||width===1200)await shot('unlocked-lobby-'+width);
}
await p.setViewportSize({width:844,height:390});await tick();
// Seed a legal pending encounter so the integration test deterministically reaches Sebastian.
await p.evaluate(async()=>{const m=await import('/src/lobby_progress.js');m.ensureWanderRun(()=>({stage:'poseidon',foe:'sebastian',foeWeapon:'tizona'}));});
await click('lobbyWander');assert.equal(await p.evaluate(()=>game.state),'fight');
assert.equal(await p.evaluate(()=>game.stage.id),'poseidon');assert((await p.locator('#stageInfo').innerText()).includes('방랑 1'));
assert.equal(await p.evaluate(()=>game.enemy.character?.id??game.enemy.name),'세바스티앙');
await p.evaluate(()=>{game.ai.update=()=>{};});await tick(4200);await shot('wander-sebastian');
// Actual touch hold/release and drag, without changing the combat/guard definitions.
const cdp=await c.newCDPSession(p),box=await p.locator('#btnParry').boundingBox();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await tick(100);assert(await p.evaluate(()=>game.playerGuard.held));
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick(100);assert(!await p.evaluate(()=>game.playerGuard.held));
const before=await p.evaluate(()=>({...game.player.handOffset}));
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:490,y:120}]});
for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:490+i*18,y:120+i*15}]});await tick(30)}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
const after=await p.evaluate(()=>({...game.player.handOffset}));assert(Math.abs(before.x-after.x)+Math.abs(before.y-after.y)>.01);
const coins=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).coins);
// Force outcome only to exercise result/reward wiring; this is not an AI balance measurement.
await p.evaluate(()=>{game.enemy.state='dead';game.enemy.causeOfDeath='출혈'});await tick(4000);
const result=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')));
assert(result.coins-coins>=210&&result.coins-coins<=230,JSON.stringify({before:coins,after:result.coins,run:result.wander.run,state:await p.evaluate(()=>game.state)}));assert.equal(result.wander.run.status,'won');await shot('boss-reward');
await click('btnLobby');await p.waitForSelector('#lobbyWander');await tick();assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.journey.checkpoint.v1')),normalSave);
assert.equal(await p.locator('#lobbyWander').textContent(),'방랑 이어가기');await click('lobbyWander');
assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).wander.run.round),2);
const active=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).wander.run);
await lobby();await click('lobbyWander');
assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).wander.run.foe),active.foe);
await p.evaluate(()=>{game.player.state='dead';game.player.causeOfDeath='출혈'});await tick(4000);
assert(await p.locator('#btnStart').isHidden());assert(await p.locator('#btnLobby').isVisible());await shot('wander-defeat');
await click('btnLobby');await p.waitForSelector('#lobbyWander');await tick();assert.equal(await p.locator('#lobbyWander').textContent(),'방랑');
assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.journey.checkpoint.v1')),normalSave);
assert.equal(errors.length,0);
fs.writeFileSync(out+'browser-checks.json',JSON.stringify({sizes,errors,normalSaveUnchanged:true,unlockButton:true,touchGuardAndDrag:true,result,wanderRound2:active,defeatEndsRun:true},null,2));
await browser.close();console.log('PASS browser integration and mobile layouts');
