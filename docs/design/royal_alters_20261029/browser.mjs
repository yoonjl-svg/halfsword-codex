import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const root=process.env.ROYAL_QA_OUT||new URL('./',import.meta.url).pathname,base=process.env.ROYAL_GAME||'http://127.0.0.1:5241/';fs.mkdirSync(root,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),rows=[];
for(const id of ['roland_mad','bernardo_mad']){
 const c=await b.newContext({viewport:{width:1100,height:700},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[],bad=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))bad.push([r.status(),r.url()]);});
 await p.clock.install({time:new Date('2026-10-29T14:00:00Z')});await p.clock.pauseAt(new Date('2026-10-29T14:00:01Z'));
 await p.goto(base+'?test=1&weapon=longsword&foe='+id+'&stage=cathedral&uniqueStage=5&nosw=1');await p.waitForFunction(()=>window.game?.state==='menu');
 const save=await p.evaluate(()=>JSON.stringify(localStorage));await p.evaluate(()=>{game.renderCap.tick=()=>false;document.querySelector('#btnStart').click()});
 for(let i=0;i<230&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);assert.equal(await p.evaluate(()=>game.state),'fight');
 const stats=await p.evaluate(()=>{const f=game.enemy;return{name:f.name,outfit:f.groups.head.userData.outfit,school:f.swordArt.tradition,proficiency:game.ai.proficiency,vitality:f.vitality,weapon:f.weapon.id,plates:Object.keys(f.plate).length,helmet:f.hasHelmet,helmetType:f.helmetType};});
 assert.equal(stats.outfit,id==='roland_mad'?'roland_alter':'bernardo_alter');assert.equal(stats.school,'iberian');assert.equal(stats.proficiency,6);assert.equal(stats.vitality,1.1);assert.equal(stats.plates,13);assert.equal(stats.helmet,id==='bernardo_mad');
 const cdp=await c.newCDPSession(p),rect=await p.locator('#btnParry').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});await p.clock.runFor(64);assert(await p.evaluate(()=>game.playerGuard.held));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.clock.runFor(64);assert(!await p.evaluate(()=>game.playerGuard.held));
 await p.evaluate(()=>game.renderCap.tick=()=>true);await p.clock.runFor(16);await p.screenshot({path:root+id+'-gameplay.png'});
 await p.evaluate(()=>{const g=game,T=g.THREE,f=g.enemy,v=f.pelvisPos,F=f.forward(new T.Vector3()),R=f.right(new T.Vector3());g.freeCam=true;g.camera.position.set(v.x+F.x*2.6+R.x*.72,1.7,v.z+F.z*2.6+R.z*.72);g.camera.lookAt(v.x,1.08,v.z);g.camera.fov=40;g.camera.updateProjectionMatrix();});
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});await p.clock.runFor(16);await p.screenshot({path:root+id+'-close.png'});await p.evaluate(()=>game.renderCap.tick=()=>false);
 await p.clock.runFor(2800);assert(await p.evaluate(()=>[game.player,game.enemy].every(f=>Object.values(f.bodies).every(rb=>Object.values(rb.translation()).every(Number.isFinite)))));
 assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),save);assert.equal(errors.length,0);assert.equal(bad.length,0);rows.push({id,stats,guardTouch:true,finiteBodies:true,storageUnchanged:true,errors,bad});await c.close();
}
fs.writeFileSync(root+'browser-qa.json',JSON.stringify({base,rows},null,2));console.log(rows);await b.close();
