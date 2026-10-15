import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.argv[2]||'/workspace/lobby-validation';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
for(const [name,width,height] of [['desktop',1440,900],['phone',844,390],['portrait',390,844]]){
 const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 await p.waitForFunction(()=>window.game?.player);
 await p.locator('#confirmNotices').click();
 await p.screenshot({path:`${out}/title-${name}.png`});await p.locator('#newJourney').click();
 await p.locator('#characterView canvas').waitFor({timeout:15000});
 await p.waitForTimeout(600);await p.screenshot({path:`${out}/lobby-${name}.png`});
 if(name==='phone'){
  const button=await p.locator('#lobbyDepart').boundingBox();assert.ok(button.y+button.height<=height);
  await p.locator('[data-weapon=longsword]').click();await p.locator('#equipItem').click();await p.screenshot({path:`${out}/longsword-equipped.png`});
  await p.locator('#tabArmor').click();await p.locator('button[data-armor=kettle]').click();await p.locator('button[data-armor=kettle] img').evaluate(img=>img.decode());
  const action=await p.locator('#unequipItem').boundingBox();assert.ok(action.y+action.height<=height);
  await p.screenshot({path:`${out}/armor-equipped.png`});await p.locator('#unequipItem').click();await p.screenshot({path:`${out}/armor-unequipped.png`});
  await p.locator('#equipItem').click();await p.locator('#tabWeapons').click();
  await p.locator('#characterView').focus();for(let i=0;i<4;i++)await p.keyboard.press('ArrowRight');await p.screenshot({path:`${out}/lobby-rotation.png`});
  await p.keyboard.press('Home');await p.locator('[data-weapon=tree_branch]').click();await p.locator('#equipItem').click();await p.screenshot({path:`${out}/branch-equipped.png`});
  await p.locator('#unequipItem').click();await p.screenshot({path:`${out}/unequipped.png`});
  await p.locator('#editName').click();await p.screenshot({path:`${out}/lobby-name.png`});await p.locator('#cancelName').click();
 }
 console.log(name,await p.locator('.lobby-columns').evaluate(el=>({width:el.clientWidth,height:el.clientHeight,scroll:el.scrollWidth})),errors);
 await p.close();
}
await browser.close();console.log(errors);assert.deepEqual(errors,[]);
