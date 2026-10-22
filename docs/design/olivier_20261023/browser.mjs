import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const id=process.env.MODEL_ID||'bernardo',base=process.env.MODEL_BASE||'http://127.0.0.1:5210/',dir=new URL('./'+id+'/',import.meta.url).pathname;fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),rows=[];
for(const role of ['foe','hero']){
 const c=await browser.newContext({viewport:{width:960,height:640},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-10-22T00:50:00+09:00')});await p.clock.pauseAt(new Date('2026-10-22T00:50:01+09:00'));
 const query=role==='foe'?'weapon=longsword&foe='+id:'hero='+id+'&weapon=tizona&foe=bran&foeWeapon=tree_branch';
 await p.goto(base+'?test=1&'+query+'&stage=cathedral&uniqueStage=5&nosw=1');await p.waitForFunction(()=>window.game?.state==='menu');
 const storage=await p.evaluate(()=>JSON.stringify(localStorage));await p.evaluate(()=>{game.renderCap.tick=()=>false;document.querySelector('#btnStart').click()});
 for(let i=0;i<180&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 assert.equal(await p.evaluate(()=>game.state),'fight');
 const stats=await p.evaluate(role=>{const f=role==='foe'?game.enemy:game.player;return{name:f.name,look:f.look,weapon:f.weapon.id,school:f.swordArt.tradition,plates:Object.keys(f.plate).length,helmet:f.helmetType};},role);
 assert.equal(stats.weapon,'tizona');assert.equal(stats.school,'iberian');assert.equal(stats.plates,13);assert.equal(stats.helmet,null);
 if(role==='hero'){
  const cdp=await c.newCDPSession(p),rect=await p.locator('#btnParry').boundingBox();assert(rect);const point={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await p.clock.runFor(100);assert(await p.evaluate(()=>game.playerGuard.held));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.clock.runFor(100);assert(!await p.evaluate(()=>game.playerGuard.held));
  const start=await p.evaluate(()=>({...game.player.handOffset}));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:570,y:180}]});
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:570+i*21,y:180+i*22}]});await p.clock.runFor(32)}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const hand=await p.evaluate(()=>({...game.player.handOffset}));assert(Math.abs(start.x-hand.x)+Math.abs(start.y-hand.y)>.01);
 }
 await p.clock.runFor(2600);await p.evaluate(()=>game.renderCap.tick=()=>true);await p.clock.runFor(16);await p.screenshot({path:dir+role+'-gameplay.png'});await p.evaluate(()=>game.renderCap.tick=()=>false);
 if(role==='foe'){
  await p.evaluate(()=>{const g=game,T=g.THREE,f=g.enemy,v=f.pelvisPos,forward=f.forward(new T.Vector3()),right=f.right(new T.Vector3());g.freeCam=true;g.camera.position.set(v.x+forward.x*2.7+right.x*1.25,1.9,v.z+forward.z*2.7+right.z*1.25);g.camera.lookAt(v.x,1.05,v.z);g.camera.fov=43;g.camera.updateProjectionMatrix();g.renderCap.tick=()=>true;});
  await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});await p.clock.runFor(16);await p.screenshot({path:dir+'game-model-close.png'});await p.evaluate(()=>game.renderCap.tick=()=>false);
  await p.evaluate(()=>{const g=game,T=g.THREE,f=g.enemy,v=f.pelvisPos,forward=f.forward(new T.Vector3()),right=f.right(new T.Vector3());g.camera.position.set(v.x+forward.x*1.7+right.x*.75,1.95,v.z+forward.z*1.7+right.z*.75);g.camera.lookAt(v.x,1.49,v.z);g.camera.fov=32;g.camera.updateProjectionMatrix();g.renderCap.tick=()=>true;});
  await p.clock.runFor(16);await p.screenshot({path:dir+'game-detail.png'});await p.evaluate(()=>game.renderCap.tick=()=>false);
 }
 await p.clock.runFor(2200);assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),storage);assert.equal(errors.length,0);rows.push({role,stats,errors,saveUnchanged:true,guardAndDrag:role==='hero'});await c.close();
}
await browser.close();fs.writeFileSync(dir+'browser-checks.json',JSON.stringify(rows,null,2));console.log(rows);
