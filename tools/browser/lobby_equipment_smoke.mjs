import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173',out=process.argv[3]||'/tmp/lobby-equipment';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],checks=[];
const watch=p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const title=async p=>{await p.waitForFunction(()=>window.game?.player);if(await p.locator('#noticeDialog').evaluate(d=>d.open))await p.locator('#confirmNotices').click();};
const state=async(p,equip,unequip,weapon)=>{assert.equal(await p.locator('#equipItem').isEnabled(),equip);assert.equal(await p.locator('#unequipItem').isEnabled(),unequip);assert.equal(await p.locator('#characterView').getAttribute('data-equipped'),weapon);};
const shot=(p,name)=>p.screenshot({path:`${out}/${name}.png`});
try{
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();watch(p);
 await p.goto(base+'/',{waitUntil:'networkidle'});await title(p);
 const style=sel=>p.locator(sel).evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.borderTopColor,s.borderTopWidth,s.clipPath,s.backgroundImage];});
 const titleButton=await style('#newJourney');await shot(p,'title-reference');await p.locator('#newJourney').tap();await p.locator('#characterView canvas').waitFor();
 assert.deepEqual(await style('#tabInventory'),titleButton);assert.equal(await p.locator('#lobbyBack').textContent(),'‹ 첫 화면으로');
 await state(p,false,false,'');assert.equal(await p.locator('.inventory-item').count(),2);assert.equal(await p.locator('.inventory-slot').count(),18);
 const layout=await p.locator('.inventory-grid').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),item=e.firstElementChild.getBoundingClientRect(),root=e.getRootNode();return {columns:s.gridTemplateColumns.split(' ').length,rows:s.gridTemplateRows.split(' ').length,cell:[item.width,item.height],width:r.width,frame:root.querySelector('.portrait-card').getBoundingClientRect().toJSON(),panel:root.querySelector('.character-panel').getBoundingClientRect().toJSON(),depart:root.getElementById('lobbyDepart').getBoundingClientRect().toJSON()};});
 assert.equal(layout.columns,5);assert.equal(layout.rows,4);assert.ok(Math.abs(layout.cell[0]-layout.cell[1])<1);assert.ok(layout.cell[0]>43.3);
 assert.ok(Math.abs(layout.frame.width/layout.panel.width-.8)<.01);assert.ok(Math.abs(layout.frame.height/layout.panel.height-.8)<.01);assert.ok(layout.depart.y>=layout.frame.bottom&&layout.depart.bottom<=390);
 assert.equal(await p.locator('#itemName,#itemDescription,.inventory-note').count(),0);
 await shot(p,'lobby-phone');checks.push({name:'title button CSS shared; 80% character frame; 5×4 square grid; two single-cell items; departure below',layout});
 const bodies=await p.evaluate(()=>game.player.meshes.map(({rb})=>({position:rb.translation(),rotation:rb.rotation()})));
 await p.locator('[data-weapon=longsword]').tap();await state(p,true,false,'');await shot(p,'selected-not-equipped');
 await p.locator('#equipItem').tap();await state(p,false,true,'longsword');await shot(p,'longsword-equipped');
 assert.equal(await p.locator('[data-weapon=longsword] .equipped-badge').isVisible(),true);
 await p.locator('[data-weapon=tree_branch]').tap();await state(p,true,false,'longsword');
 await p.locator('#equipItem').tap();await state(p,false,true,'tree_branch');await shot(p,'branch-equipped');
 assert.equal(await p.locator('[data-weapon=longsword] .equipped-badge').isVisible(),false);
 await p.locator('#unequipItem').tap();await state(p,true,false,'');await shot(p,'unequipped');
 await p.locator('.inventory-slot').first().tap();await state(p,false,false,'');
 for(let i=0;i<8;i++){await p.locator('[data-weapon=longsword]').tap();await p.locator('#equipItem').tap();await p.locator('#unequipItem').tap();await p.locator('.inventory-slot').first().tap();}
 assert.deepEqual(await p.evaluate(()=>game.player.meshes.map(({rb})=>({position:rb.translation(),rotation:rb.rotation()}))),bodies);assert.equal(await p.evaluate(()=>game.stats.simTime),0);
 checks.push({name:'selection is separate from equip; direct swap removes old weapon; unequip/clear and repeated cycles; physics untouched'});
 await p.locator('[data-weapon=longsword]').tap();await p.locator('#equipItem').tap();
 const v=await p.locator('#characterView').boundingBox(),cdp=await c.newCDPSession(p),x=v.x+v.width*.1,y=v.y+v.height*.5;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+v.width*.25,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(Math.abs(Number(await p.locator('#characterView').getAttribute('data-angle'))-90)<3);await shot(p,'equipped-rotation');
 await p.reload({waitUntil:'networkidle'});await title(p);await p.locator('#newJourney').tap();await state(p,false,false,'longsword');
 await p.locator('#editName').tap();await p.locator('#playerNameInput').fill('방랑 검객');await p.locator('#nameForm button[type=submit]').tap();
 await p.locator('#lobbyBack').tap();await title(p);await p.locator('#newJourney').tap();await state(p,false,false,'longsword');
 checks.push({name:'equipped weapon rotates with model; persistence through reload/name edit/back navigation; selection resets'});
 await p.locator('#lobbyDepart').tap();await p.waitForFunction(()=>game.state==='draw');checks.push({name:'departure still enters existing journey card flow'});await c.close();
 for(const [name,width,height] of [['desktop',1440,900],['portrait',390,844],['small-portrait',320,568],['small-landscape',568,320]]){
  const q=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});watch(q);await q.goto(base+'/',{waitUntil:'networkidle'});await title(q);await q.locator('#newJourney').click();await q.locator('#characterView canvas').waitFor();
  assert.ok(await q.locator('.lobby').evaluate(e=>e.scrollWidth<=e.clientWidth));await q.locator('#equipItem').scrollIntoViewIfNeeded();
  await q.locator('[data-weapon=longsword]').click();await q.locator('#equipItem').click();await state(q,false,true,'longsword');
  if(name==='desktop'){await shot(q,'lobby-desktop');await q.locator('#tabSkills').click();await shot(q,'skillbook');await q.locator('#tabSettings').click();assert.equal(await q.locator('#lobbyFps').isVisible(),true);}
  if(name==='portrait'){await q.locator('.lobby').evaluate(e=>e.scrollTop=0);await shot(q,'lobby-portrait');}
  await q.locator('#lobbyDepart').scrollIntoViewIfNeeded();await q.locator('#lobbyDepart').click();await q.waitForFunction(()=>game.state==='draw');
  checks.push({name:`${name}: fits, equipment buttons and departure reachable`});await q.close();
 }
 const denied=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
 await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied');};Storage.prototype.setItem=()=>{throw Error('denied');};});
 const d=await denied.newPage();watch(d);await d.goto(base+'/',{waitUntil:'networkidle'});await title(d);await d.locator('#newJourney').click();await d.locator('[data-weapon=tree_branch]').click();await d.locator('#equipItem').click();await state(d,false,true,'tree_branch');
 await d.locator('#lobbyBack').click();await title(d);await d.locator('#newJourney').click();await state(d,false,false,'tree_branch');await denied.close();
 checks.push({name:'storage denied: equip still works and survives lobby remount within session'});assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/equipment.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} equipment/layout checks; errors ${errors.length}`);
