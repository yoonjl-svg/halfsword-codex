// Qinglan import: actual stage opponent, gameplay/overview captures and repeat
// stage disposal. No geometry or gameplay parameters changed for the shots.
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4192';
const out=process.argv[3]||'/tmp/qinglan-import';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],resources=[];
try {
 const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.clock.install({time:new Date('2026-10-16T12:00:00Z')});
 await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
 await page.goto(base+'/?weapon=longsword&foe=renji&stage=qinglan&emo=0',{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
 await page.evaluate(()=>{game.ai.update=()=>{}});
 await page.clock.runFor(4000);
 await page.evaluate(()=>{game.renderCap.tick=()=>true});await page.clock.runFor(16);
 const state=await page.evaluate(()=>({stage:game.stage.id,radius:game.config.ARENA.radius,foe:game.enemy.name,state:game.state}));
 assert.equal(state.stage,'qinglan');assert.equal(state.foe,'김씨');assert.equal(state.state,'fight');
 await page.screenshot({path:out+'/qinglan-gameplay.png'});
 await page.evaluate(()=>{game.freeCam=true;game.camera.position.set(-16,16,24);game.camera.lookAt(14,-2,0);game.camera.fov=55;game.camera.updateProjectionMatrix()});
 await page.addStyleTag({content:'body > :not(canvas) {visibility:hidden!important}'});
 await page.clock.runFor(16);
 await page.screenshot({path:out+'/qinglan-overview.png'});
 for(let i=0;i<3;i++){
  for(const id of ['castle','qinglan']){
   await page.evaluate(id=>game.setStage(id),id);await page.clock.runFor(32);
  }
  resources.push(await page.evaluate(()=>{const r=game.renderInfo();return {geometries:r.geometries,textures:r.textures,programs:r.programs}}));
 }
 assert.deepEqual(resources[2],resources[1]);assert.deepEqual(resources[1],resources[0]);assert.equal(errors.length,0);
 const report={pass:true,...state,resources,errors};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close()}
