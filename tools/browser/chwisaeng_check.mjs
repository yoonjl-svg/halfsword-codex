// Production UI: continue a valid draw checkpoint, choose the epic, and resume it.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/chwisaeng-ui';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const report={errors:[],cards:[]};
try{
 const page=await browser.newPage({viewport:{width:1200,height:675},reducedMotion:'reduce',hasTouch:true});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await page.addInitScript(()=>{
  if(!localStorage.getItem('stillness.fork.journey.v1'))localStorage.setItem('stillness.fork.journey.v1',JSON.stringify({version:1,stage:'qinglan_night',foe:'renji_mad',foeWeapon:'brothers_sword',weapon:null,cards:['brothers_sword','longsword'],lastWeapon:null}));
  HTMLElement.prototype.requestFullscreen=async()=>{};
 });
 const enter=async()=>{
  await page.goto(base+'/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.player);
  await page.evaluate(()=>{game.renderCap.tick=()=>false});
  if(await page.locator('#noticeDialog').evaluate(e=>e.open))await page.locator('#confirmNotices').click();
  await page.locator('#continueJourney').click();await page.locator('#lobbyDepart').click();
 };
 await enter();await page.waitForFunction(()=>game.draw.stage==='choose'&&game.draw.t>=.6);
 await page.locator('#draw .wcard').nth(0).dispatchEvent('click');
 await page.waitForFunction(()=>game.draw.stage==='reveal'&&game.draw.t>=1.35);await page.evaluate(()=>{game.draw.hold=true;game.renderCap.tick=()=>true});await page.waitForTimeout(100);
 assert.equal(await page.locator('#draw .wcard').nth(0).getAttribute('data-tier'),'epic');
 assert.equal(await page.locator('#draw .wcard .wname').nth(0).textContent(),'취생몽사');
 assert.equal(await page.locator('#draw .wcard .wabil').nth(0).textContent(),'(황약사: 몽롱한 일격)');
 assert.ok(await page.locator('#draw .wcard').nth(0).evaluate(e=>e.classList.contains('flipped')));
 for(const [width,height]of [[1200,675],[844,390],[568,320]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  const fit=await page.locator('#draw .wcard').nth(0).evaluate(el=>{
   const face=el.querySelector('.wface');return ['.wname','.wtier','.wdesc','.wabil'].map(s=>{const e=el.querySelector(s);return {selector:s,text:e.textContent,fit:e.scrollWidth<=e.clientWidth+1&&e.offsetTop+e.offsetHeight<=face.clientHeight+1}});
  });assert.ok(fit.every(r=>r.fit),JSON.stringify({width,fit}));report.cards.push({width,height,fit});
  await page.screenshot({path:`${out}/epic-card-${width}.png`});
 }
 await page.setViewportSize({width:1200,height:675});await page.evaluate(()=>{game.draw.hold=false});await page.waitForFunction(()=>game.state==='fight');await page.waitForTimeout(1500);
 const weapon=await page.evaluate(()=>({id:game.player.weapon.id,name:game.player.weapon.nameKo,tier:game.player.weapon.tier,power:game.player.weapon.power,blunt:game.player.weapon.mBlunt,fragility:game.player.weapon.fragility,state:game.state}));
 assert.equal(weapon.id,'brothers_sword');assert.equal(weapon.tier,'epic');assert.equal(weapon.state,'fight');assert.equal(weapon.power,1.1);assert.equal(weapon.blunt,1.6);assert.equal(weapon.fragility,0);report.weapon=weapon;
 await page.screenshot({path:`${out}/player-chwisaeng.png`});
 await enter();await page.waitForFunction(()=>game.state==='fight');assert.equal(await page.evaluate(()=>game.player.weapon.id),'brothers_sword');report.continueRestored=true;
 await page.goto(base+'/?stage=etna&foe=chanda&weapon=longsword&foeWeapon=moye&openSweep=0',{waitUntil:'networkidle'});
 await page.evaluate(()=>document.getElementById('btnStart').click());await page.waitForFunction(()=>document.querySelector('#foeIntro i')?.textContent==='식물학자');
 report.chandaTitle=await page.locator('#foeIntro i').textContent();
 await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('foeIntro')).opacity)>.9);
 await page.screenshot({path:`${out}/chanda-botanist.png`});
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{fs.writeFileSync(out+'/checks.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
console.log(JSON.stringify({pass:report.pass,errors:report.errors,cards:report.cards.length,continueRestored:report.continueRestored,chandaTitle:report.chandaTitle}));
