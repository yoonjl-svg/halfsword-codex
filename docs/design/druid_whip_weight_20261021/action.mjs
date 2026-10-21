import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5198',dir=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.install({time:new Date('2026-10-21T14:00:00Z')});await page.clock.pauseAt(new Date('2026-10-21T14:00:01Z'));
await page.goto(base+'/?test=1&weapon=druid_whip&foe=bran&foeWeapon=tree_branch&stage=clearing&foeWhiff=1&uniqueStage=5&nosw=1');
await page.waitForFunction(()=>window.game?.state==='menu');await page.evaluate(()=>{game.renderCap.tick=()=>false;document.querySelector('#btnStart').click()});
for(let i=0;i<180&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
await page.evaluate(async()=>{
 const g=game,T=g.THREE,f=g.player;g.ai.update=()=>{};g.freeCam=true;for(const m of g.enemy.meshes)m.group.visible=false;
 const {TECH_BY_NAME}=await import('/src/ai_techniques.js');window.whipTech=TECH_BY_NAME.zornhau;
 const v=f.pelvisPos,front=new T.Vector3(1,0,0).applyQuaternion(f.yaw),side=new T.Vector3(0,0,1).applyQuaternion(f.yaw);
 g.camera.position.set(v.x+front.x*3.4+side.x*2,1.8,v.z+front.z*3.4+side.z*2);g.camera.lookAt(v.x,1.15,v.z);g.camera.fov=48;g.camera.updateProjectionMatrix();
 f.handOffset.set(...whipTech.from);g.renderCap.tick=()=>true;
});await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
await page.clock.runFor(600);let best=-1,bestImage=null;const rows=[];
for(let i=0;i<16;i++){
 await page.evaluate(i=>{const f=game.player,points=[whipTech.from,...whipTech.path],u=Math.min(1,i/7),j=u<.5?0:1,v=u<.5?u*2:(u-.5)*2;f.handOffset.set(points[j][0]+(points[j+1][0]-points[j][0])*v,points[j][1]+(points[j+1][1]-points[j][1])*v);f.inputActive=i<8;},i);
 await page.clock.runFor(50);
 const row=await page.evaluate(()=>{const f=game.player,p=f.sword.translation(),tip=f.bladePoint(1);return{span:Math.hypot(tip.x-p.x,tip.z-p.z),tip:[tip.x,tip.y,tip.z],speed:f.tipVel.length(),broken:f.weaponBroken,active:f.flexWeapon.active};});rows.push(row);
 const image=await page.screenshot();if(row.span>best&&!row.broken){best=row.span;bestImage=image;}
 if([2,7,12].includes(i))fs.writeFileSync(dir+`swing-${i}.png`,image);
}
if(bestImage)fs.writeFileSync(dir+'swing.png',bestImage);
fs.writeFileSync(dir+'action.json',JSON.stringify({rows,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));
