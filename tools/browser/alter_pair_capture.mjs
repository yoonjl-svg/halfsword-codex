// Actual game renderer with fixed time. Portraits move the camera and hide only the player.
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/alter-pairs';
const pairs=(process.argv[4]||'cathedral_night:margarethe,cathedral_night:margarethe_mad,castle_night:isolde,castle_night:isolde_mad').split(',').map(s=>s.split(':'));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const rows=[];
try{for(const [stage,foe] of pairs){
 const page=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.clock.install({time:new Date('2026-10-16T18:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await page.goto(`${base}/?stage=${stage}&foe=${foe}&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
 await page.evaluate(()=>{game.ai.update=()=>{}});await page.clock.runFor(2500);
 await page.evaluate(()=>{game.renderCap.tick=()=>true});await page.clock.runFor(16);
 const prefix=`${out}/${stage}-${foe}`;
 await page.screenshot({path:prefix+'-gameplay.png'});
 const info=await page.evaluate(()=>({stage:game.stage.id,foe:game.enemy.name,state:game.state,strength:game.enemy.strength,level:game.ai.level,proficiency:game.ai.persona.proficiency,plateBoxes:Object.fromEntries(Object.entries(game.enemy.plateBoxes||{}).map(([key,boxes])=>[key,{partial:boxes.partial,boxes:boxes.list.map(b=>({min:b.box.min,max:b.box.max}))}])),helmet:game.enemy.helmetType,render:game.renderInfo()}));
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 await page.evaluate(()=>{game.freeCam=true;for(const m of game.player.meshes)m.group.visible=false});
 await page.setViewportSize({width:720,height:960});
 const selectedViews=process.argv.find(a=>a.startsWith('--views='))?.slice(8).split(',');
 for(const view of selectedViews||['front','back','head',...(process.argv.includes('--details')?['hair','waist']:[])]){
  await page.evaluate(view=>{const g=game,T=g.THREE,v=(view==='head'?g.enemy.bodies.head:g.enemy.bodies.pelvis).translation(),f=new T.Vector3(1,0,0).applyQuaternion(g.enemy.yaw);
   const dist=view==='head'?1.7:(view==='back'?-4.2:4.2);g.camera.position.set(v.x+f.x*dist,view==='head'?v.y+.04:1.25,v.z+f.z*dist);g.camera.lookAt(v.x,view==='head'?v.y+.015:1.02,v.z);g.camera.fov=view==='head'?24:34;g.camera.updateProjectionMatrix();
   if(view==='front'&&g.stage.id.startsWith('sluice')){
    // Stay in front of the central statue; both versions use the same camera.
    g.camera.position.set(v.x+f.x*2.35,1.25,v.z+f.z*2.35);g.camera.lookAt(v.x,1.02,v.z);g.camera.fov=55;g.camera.updateProjectionMatrix();
   }
   if(view==='hair'||view==='waist'){
    const p=g.enemy.bodies[view==='hair'?'head':'abdomen'].translation();
    f.applyAxisAngle(new T.Vector3(0,1,0),view==='hair'?2.3:.25);
    const d=view==='hair'?2.2:1.65,y=p.y+(view==='hair'?-.17:-.04);
    g.camera.position.set(p.x+f.x*d,y+.03,p.z+f.z*d);g.camera.lookAt(p.x,y,p.z);
    g.camera.fov=view==='hair'?30:29;g.camera.updateProjectionMatrix();
   }
   if(view==='embroidery'){
    const p=g.enemy.bodies.chest.translation();
    g.camera.position.set(p.x-f.x*1.1,p.y+.025,p.z-f.z*1.1);g.camera.lookAt(p.x,p.y-.025,p.z);
    g.camera.fov=28;g.camera.updateProjectionMatrix();
   }
  },view);await page.clock.runFor(16);await page.screenshot({path:prefix+`-${view}.png`});
 }
 rows.push({...info,errors});fs.writeFileSync(out+'/capture.json',JSON.stringify(rows,null,2)+'\n');console.log(stage,foe,JSON.stringify(errors));await page.close();
}}finally{await browser.close()}
if(rows.some(r=>r.errors.length||r.state!=='fight'))process.exitCode=1;
