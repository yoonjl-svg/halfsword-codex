// Actual stage renderer, fixed time. Landscape details move the camera and hide fighters.
import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/yue-spectacle';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const views={dunhuang:[
 ['overview',[-6,4,8],[19,5,-6],58],
 ['duel',[7.5,2.2,-1.0],[13.2,1.0,-4.3],43],
 ['procession',[8,2.4,9],[14.6,1,-2],48],
 ['west',[-1.5,2.0,0],[-14,1,0],65],
 ['north',[0,2.0,1.5],[0,1,14],65],
 ['south',[0,2.0,-1.5],[0,1,-14],65],
 ['battlefield',[-20,23,-24],[0,0,0],66],
 ['standard',[-8,2.3,-9],[-8.6,1.5,-15.2],46]
]};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});const rows=[];
try{for(const [id,foe] of [['dunhuang','terracotta']].filter(p=>!only||p[0]===only)){
 const stage=before?id:id+'_night',enemy=before?foe:foe+'_mad',p=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 const foeWeapon='goujian';
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
  // Four directions, each 2.5s: prove that combat surrounds the field.
  fs.mkdirSync(`${out}/${stage}-frames`,{recursive:true});
  for(let i=0;i<100;i++){
   if(i%25===0)await p.evaluate(i=>{const a=(i/25)*Math.PI/2;game.camera.position.set(Math.cos(a)*1.5,2.0,Math.sin(a)*1.5);game.camera.lookAt(Math.cos(a)*14,1,Math.sin(a)*14);game.camera.fov=65;game.camera.updateProjectionMatrix()},i);
   await p.evaluate(()=>{game.renderCap.tick=()=>false});await p.clock.runFor(84);await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);await p.screenshot({path:`${out}/${stage}-frames/${String(i).padStart(3,'0')}.png`})}
 }
 rows.push({...info,errors});fs.writeFileSync(out+'/capture.json',JSON.stringify(rows,null,2)+'\n');console.log(stage,JSON.stringify(errors));await p.close();
}}finally{await browser.close()}
if(rows.some(r=>r.errors.length||r.state!=='fight'))process.exitCode=1;
