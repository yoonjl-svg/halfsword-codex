// Actual stage renderer, fixed time. Landscape details move the camera and hide fighters.
import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-second';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const views={dayr:[
 ['overview',[-6,4,8],[18,3.4,0],58],
 ['conspiracy',[6.1,3.0,-13.7],[8.32,.48,-17.5],46],
 ['aftermath',[5.8,2.5,-10.6],[8.6,.25,-15.5],49],
 ['caravan',[22.8,2.5,-6.6],[27.0,1.2,.1],51],
 ['threshold',[11.3,2.3,2.8],[25.5,1.0,0],48],
 ['well',[7,3.2,-6.1],[12.7,.8,-11.3],51],
 ['far-side',[-3.2,3.2,6.4],[-12,.7,16.3],55],
 ['crawl',[-4.2,3.1,9.9],[-8.25,.15,13.55],48]
]};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});const rows=[];
try{for(const [id,foe] of [['dayr','silver_wanderer']].filter(p=>!only||p[0]===only)){
 const stage=before?id:id+'_night',enemy=before?foe:foe+'_mad',p=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 const foeWeapon='monohoshizao';
 await p.goto(`${base}/?stage=${stage}&foe=${enemy}&weapon=longsword&foeWeapon=${foeWeapon}&emo=0`,{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await p.clock.runFor(2500);await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);
 await p.screenshot({path:`${out}/${stage}-gameplay.png`});
 const info=await p.evaluate(()=>({stage:game.stage.id,state:game.state,foe:game.enemy.name,resources:game.renderInfo(),stories:game.scene.children.filter(x=>x.name.endsWith('-story')).map(x=>x.userData)}));
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 await p.evaluate(()=>{game.freeCam=true;for(const f of [game.player,game.enemy])for(const m of f.meshes)m.group.visible=false});
 for(const [name,pos,target,fov] of views[id]){
  await p.evaluate(({pos,target,fov})=>{game.camera.position.set(...pos);game.camera.lookAt(...target);game.camera.fov=fov;game.camera.updateProjectionMatrix()},{pos,target,fov});
  await p.clock.runFor(16);await p.screenshot({path:`${out}/${stage}-${name}.png`});
 }
 if(process.argv.includes('--clip')){
  fs.mkdirSync(`${out}/${stage}-frames`,{recursive:true});
  for(let i=0;i<80;i++){
   if(i===0||i===40){const [,pos,target,fov]=views[id].find(v=>v[0]===(i===0?'far-side':'crawl'));
    await p.evaluate(({pos,target,fov})=>{game.camera.position.set(...pos);game.camera.lookAt(...target);game.camera.fov=fov;game.camera.updateProjectionMatrix()},{pos,target,fov});}
   // Simulate all 100 ms, rendering only the final frame for this 10 fps clip.
   await p.evaluate(()=>{game.renderCap.tick=()=>false});await p.clock.runFor(84);
   await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);
   await p.screenshot({path:`${out}/${stage}-frames/${String(i).padStart(3,'0')}.png`});
  }
 }
 rows.push({...info,errors});fs.writeFileSync(out+'/capture.json',JSON.stringify(rows,null,2)+'\n');console.log(stage,JSON.stringify(errors));await p.close();
}}finally{await browser.close()}
if(rows.some(r=>r.errors.length||r.state!=='fight'))process.exitCode=1;
