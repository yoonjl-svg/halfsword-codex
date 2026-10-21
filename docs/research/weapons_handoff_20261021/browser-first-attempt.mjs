// Actual built receiver-based candidate, Chromium touch emulation; not human efficacy testing.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./browser/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const [id,school,pair] of [['dartagnan','italian','rapier,dartagnan'],['kusanagi','japanese','uchigatana,kusanagi']]) {
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4511/?test=1&cards='+pair+'&foe=bran&foeWeapon=tree_branch&stage=clearing&foeWhiff=1');
  await page.waitForFunction(()=>window.game?.state==='menu',null,{timeout:90000});
  await page.locator('#btnStart').tap();
  await page.waitForFunction(()=>game.draw?.stage==='choose'&&game.draw.t>=.5);
  await page.locator('.wcard').nth(1).tap();
  await page.waitForFunction(()=>{if(game.draw?.others&&game.draw?.foe){game.draw.hold=true;return true;}return false;});
  await page.evaluate(()=>document.fonts.ready);
  const cards=await page.locator('.wcard').allTextContents();
  await page.screenshot({path:new URL(id+'-cards.png',out).pathname});
  await page.evaluate(()=>game.draw.hold=false);
  await page.waitForFunction(()=>game.state==='fight');await page.waitForTimeout(3500);
  const cdp=await context.newCDPSession(page),box=await page.locator('#btnParry').boundingBox();assert(box);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  await page.waitForTimeout(250);
  const held=await page.evaluate(()=>game.playerGuard.held);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
  const released=await page.evaluate(()=>!game.playerGuard.held);
  const state=await page.evaluate(()=>({weapon:game.player.weapon.id,school:game.player.swordArt.tradition,tier:game.player.weapon.tier,
    finite:Object.values(game.player.sword.translation()).every(Number.isFinite),state:game.state,schoolParry:game.player.schoolParry,
    window:game.config.SKILL.itOppositionVals.window,storageKeys:Object.keys(localStorage)}));
  assert.equal(state.weapon,id);assert.equal(state.school,school);assert(state.finite&&held&&released);assert.equal(errors.length,0);
  assert(!state.storageKeys.some(k=>/journey|run\.v|profile/.test(k)),JSON.stringify(state.storageKeys));
  await page.screenshot({path:new URL(id+'-equipped.png',out).pathname});
  results.push({id,cards,held,released,state,errors});await context.close();console.log(id,'passed');
 }
} finally {await fs.writeFile(new URL('results.json',out),JSON.stringify(results,null,2)+'\n');await browser.close();}
