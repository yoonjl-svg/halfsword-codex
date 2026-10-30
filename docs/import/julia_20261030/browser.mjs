import {chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const root=process.env.BROWSER_OUT||new URL('./',import.meta.url).pathname,base=process.env.JULIA_GAME||'http://127.0.0.1:5295/';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),rows=[];
for(const id of ['julia','julia_mad'])for(const role of ['foe','hero']){
 const c=await b.newContext({viewport:{width:1100,height:700},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[],bad=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))bad.push([r.status(),r.url()]);});await p.clock.install({time:new Date('2026-10-29T13:00:00Z')});await p.clock.pauseAt(new Date('2026-10-29T13:00:01Z'));
 const query=role==='foe'?`weapon=tree_branch&foe=${id}`:`hero=${id}&weapon=rapier&foe=bran&foeWeapon=tree_branch`;
 await p.goto(base+'?test=1&'+query+'&stage=cathedral&uniqueStage=5&nosw=1');await p.waitForFunction(()=>window.game?.state==='menu');const save=await p.evaluate(()=>JSON.stringify(localStorage));await p.evaluate(()=>{game.renderCap.tick=()=>false;document.querySelector('#btnStart').click()});
 for(let i=0;i<220&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);assert.equal(await p.evaluate(()=>game.state),'fight');
 const stats=await p.evaluate(role=>{const f=role==='foe'?game.enemy:game.player;return{name:f.name,nativeHair:!!f.groups.head.getObjectByName('julia-hair'),mechanicalWaist:!!f.groups.abdomen.getObjectByName('julia-mechanical-waist'),school:f.swordArt.tradition,proficiency:role==='foe'?game.ai.proficiency:null,weapon:f.weapon.id,plates:Object.keys(f.plate).length};},role);assert.equal(stats.name,id==='julia'?'쥘리아 크리스테바':'광기의 쥘리아 크리스테바');assert(stats.nativeHair);assert.equal(stats.mechanicalWaist,id==='julia_mad');assert.equal(stats.school,'italian');assert.equal(stats.weapon,'rapier');assert.equal(stats.plates,0);
 if(role==='hero'){
  const rect=await p.locator('#btnParry').boundingBox(),cdp=await c.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});await p.clock.runFor(80);assert(await p.evaluate(()=>game.playerGuard.held));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.clock.runFor(80);assert(!await p.evaluate(()=>game.playerGuard.held));
  const old=await p.evaluate(()=>({...game.player.handOffset}));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:700,y:210}]});for(let i=1;i<7;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:700+i*20,y:210+i*25}]});await p.clock.runFor(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const now=await p.evaluate(()=>({...game.player.handOffset}));assert(Math.abs(old.x-now.x)+Math.abs(old.y-now.y)>.01);
 }
 await p.clock.runFor(600);await p.evaluate(()=>game.renderCap.tick=()=>true);await p.clock.runFor(16);await p.screenshot({path:root+id+'-'+role+'-gameplay.png'});await p.evaluate(()=>game.renderCap.tick=()=>false);
 if(role==='foe'){
  await p.evaluate(()=>{const g=game,T=g.THREE,f=g.enemy,v=f.pelvisPos,F=new T.Vector3(1,0,0).applyQuaternion(f.groups.chest.getWorldQuaternion(new T.Quaternion())),R=new T.Vector3().crossVectors(F,new T.Vector3(0,1,0));g.freeCam=true;g.camera.position.set(v.x+F.x*2.6+R.x*.15,1.65,v.z+F.z*2.6+R.z*.15);g.camera.lookAt(v.x,1.02,v.z);g.camera.fov=40;g.camera.updateProjectionMatrix();g.renderCap.tick=()=>true;});await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'}).then(s=>s.evaluate(el=>el.id='capture-only-hide-ui')); await p.clock.runFor(16);await p.screenshot({path:root+id+'-game-close.png'});await p.evaluate(()=>game.renderCap.tick=()=>false);
 }
 await p.clock.runFor(3500);const valid=await p.evaluate(()=>[game.player,game.enemy].every(f=>Object.values(f.bodies).every(rb=>Object.values(rb.translation()).every(Number.isFinite))));assert(valid);assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),save);assert.equal(errors.length,0);assert.equal(bad.length,0);
 if(role==='foe'){
  await p.evaluate(()=>{document.querySelector('#capture-only-hide-ui')?.remove();game.freeCam=false;game.renderCap.tick=()=>true;game.player.die('검증')});await p.clock.runFor(4100);
  await p.waitForFunction(()=>!document.querySelector('#menuFoe').hidden&&document.querySelector('#menuFoeImg').complete&&document.querySelector('#menuFoeImg').naturalWidth===768);
  assert(await p.locator('#menuFoeImg').isVisible());assert((await p.locator('#menuFoeImg').getAttribute('src')).endsWith('/'+id+'.webp'));await p.screenshot({path:root+id+'-defeat-profile.png'});
  assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),save);assert.equal(errors.length,0);assert.equal(bad.length,0);
 }
 rows.push({id,role,stats,errors,bad,finiteBodies:true,storageUnchanged:true,guardAndDrag:role==='hero',defeatProfile:role==='foe'});await c.close();
}
fs.writeFileSync(root+'browser-qa.json',JSON.stringify({base,rows},null,2));console.log(rows);await b.close();
