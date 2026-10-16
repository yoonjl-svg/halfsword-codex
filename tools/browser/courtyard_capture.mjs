import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4193',out=process.argv[3]||'/tmp/courtyard-ui';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const report={errors:[],views:[]};
try{
 const p=await browser.newPage({viewport:{width:1200,height:675},hasTouch:true});
 p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T08:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T08:00:01Z'));
 await p.goto(base+'/?stage=courtyard&foe=samira&weapon=brothers_sword&foeWeapon=pistol&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<150&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await p.clock.runFor(5500);await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);
 report.game=await p.evaluate(()=>({stage:game.stage.id,foe:game.enemy.name,weapon:game.enemy.weapon.id,state:game.state,render:game.renderInfo(),camera:game.camera.position.toArray()}));
 await p.screenshot({path:out+'/gameplay.png'});
 await p.setViewportSize({width:844,height:390});await p.clock.runFor(100);await p.screenshot({path:out+'/gameplay-mobile.png'});await p.setViewportSize({width:1200,height:675});
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 await p.evaluate(()=>{game.freeCam=true;for(const o of game.scene.children)if(o.renderOrder===2||o.renderOrder===3){if(o.material?.transparent)o.material.opacity=0;}for(const f of [game.player,game.enemy])for(const m of f.meshes)m.group.visible=false});
 for(let [name,pos,target,fov]of [
  ['overview',[13,10,19],[-8,-.7,-6],58],
  ['well',[-6,7,13],[-21,-2,-1],56],
  ['gate',[6,2.4,-9],[0,4,-24],52],
  ['traces',[-8.5,2.5,10],[-12.2,.5,5.8],49],
  ['seals',[6.7,1.2,-18.1],[4.7,.25,-20.6],43],
  ['approach',[24,15,49],[-5,0,-3],56],
  ['reverse',[-4,4,-14],[11,1.5,21],58],
 ]){
  pos=[-pos[2],pos[1],pos[0]];target=[-target[2],target[1],target[0]];
  await p.evaluate(({pos,target,fov})=>{game.camera.position.set(...pos);game.camera.lookAt(...target);game.camera.fov=fov;game.camera.updateProjectionMatrix()},{pos,target,fov});
  await p.clock.runFor(16);await p.screenshot({path:`${out}/${name}.png`});report.views.push({name,pos,target,fov});
 }
 if(process.argv.includes('--clip')){
  await p.setViewportSize({width:960,height:540});
  await p.evaluate(()=>{game.camera.position.set(-13,7,-6);game.camera.lookAt(1,-2,-21);game.camera.fov=56;game.camera.updateProjectionMatrix()});
  fs.mkdirSync(out+'/frames',{recursive:true});
  for(let i=0;i<80;i++){await p.clock.runFor(100);await p.screenshot({path:`${out}/frames/${String(i).padStart(3,'0')}.png`})}
 }
}finally{await browser.close();fs.writeFileSync(out+'/capture.json',JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));if(report.errors.length||report.game?.state!=='fight')process.exitCode=1;
