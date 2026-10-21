import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url).pathname,base='http://127.0.0.1:5198';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
for(const variant of ['before','after'])for(const gesture of ['down','cross']){
 const context=await browser.newContext({viewport:{width:1100,height:620},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-21T15:00:00Z')});await page.clock.pauseAt(new Date('2026-10-21T15:00:01Z'));
 await page.goto(base+'/?test=1&weapon=druid_whip&foe=bran&foeWeapon=tree_branch&stage=clearing&foeWhiff=1&uniqueStage=5&nosw=1');await page.waitForFunction(()=>window.game?.state==='menu');
 await page.evaluate(async variant=>{const {WEAPONS}=await import('/src/weapons.js');if(variant==='before'){const p=await(await fetch('/docs/design/druid_whip_weight_20261021/old-parts.json')).json();WEAPONS.druid_whip.buildParts=()=>structuredClone(p);}window.whipVariant=variant;game.renderCap.tick=()=>false;document.querySelector('#btnStart').click()},variant);
 for(let i=0;i<180&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));
 await page.evaluate(()=>{const g=game,f=g.player,T=g.THREE;g.ai.update=()=>{};if(window.whipVariant==='before')for(const s of f.flexWeapon.segments)s.body.setAngularDamping(1.3);for(const m of g.enemy.meshes){const t=m.rb.translation();m.rb.setTranslation({x:t.x+3,y:t.y,z:t.z},true);m.group.visible=false;}const a=g.enemy.anchor.translation();g.enemy.anchor.setTranslation({x:a.x+3,y:a.y,z:a.z},true);g.freeCam=true;
 const v=f.pelvisPos,front=new T.Vector3(1,0,0).applyQuaternion(f.yaw),side=new T.Vector3(0,0,1).applyQuaternion(f.yaw);g.camera.position.set(v.x+front.x*3.5+side.x*2.8,2.1,v.z+front.z*3.5+side.z*2.8);g.camera.lookAt(v.x,1.1,v.z);g.camera.fov=48;g.camera.updateProjectionMatrix();g.renderCap.tick=()=>false;});
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});await page.clock.runFor(600);
 async function drag(points){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});for(const p of points.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});await page.clock.runFor(32);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await drag([{x:700,y:390},{x:700,y:350},{x:700,y:310},{x:700,y:270},{x:700,y:230}]);await page.clock.runFor(400);
 const points=gesture==='down'?Array.from({length:11},(_,i)=>({x:700+i*6,y:200+i*23})):Array.from({length:11},(_,i)=>({x:580+i*25,y:230+i*4}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});const samples=[];let best=-1,bestShot=-1,bestImage;
 for(let i=0;i<40;i++){
 await page.evaluate(i=>{game.renderCap.tick=()=>i%4===0},i);
 if(i>0&&i<points.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points[i]]});if(i===points.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(32);
 const r=await page.evaluate(()=>{const f=game.player,T=game.THREE,p=f.bladePoint(1).clone(),c=new T.Vector3().copy(f.bodies.chest.translation());const rel=p.clone().sub(c).applyQuaternion(f.yaw.clone().invert());return{hand:[f.handOffset.x,f.handOffset.y],tip:[p.x,p.y,p.z],forward:rel.x,speed:f.tipVel.length(),mass:f.stamina.originalMass,broken:f.weaponBroken,active:f.flexWeapon.active};});samples.push(r);
 const score=r.tip[1]>.45?r.forward:-1;if(score>best)best=score;if(i%4===0&&score>bestShot){bestShot=score;bestImage=await page.screenshot();}
 }
 if(bestImage)fs.writeFileSync(dir+`touch-${variant}-${gesture}.png`,bestImage);
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),stored);assert(!samples.some(r=>r.broken||r.active!==8));assert.equal(errors.length,0);
 rows.push({variant,gesture,bestForward:best,samples,errors,storageUnchanged:true});console.log(JSON.stringify({variant,gesture,bestForward:best}));await context.close();
}
fs.writeFileSync(dir+'touch-compare.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(({samples,...r})=>r)));await browser.close();
