// Observer-only detail captures. Eye clips prescribe head motion to inspect the
// real effect; they are not recordings of AI combat or a new character animation.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-revision';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const report=[];
async function open(stage,foe,url=base,oldBear=false){
 const p=await browser.newPage({viewport:{width:720,height:480},deviceScaleFactor:1});
 const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 if(oldBear){const old=execFileSync('git',['show','e30c287c:src/stage_frozen_bay.js'],{encoding:'utf8'});const bear=/function chapelMoundAndBear[\s\S]*?(?=function dawnSky)/;await p.route(/\/src\/stage_frozen_bay\.js(?:\?.*)?$/,async r=>{const response=await r.fetch();const body=(await response.text()).replace(bear,old.match(bear)[0]);await r.fulfill({response,body})})}
 // Block only Vite's live-reload client in this capture, preserving transformed game imports.
 if(url.endsWith(':4193'))await p.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(`${url}/?stage=${stage}&foe=${foe}&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await p.clock.runFor(2500);
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 await p.evaluate(()=>{game.freeCam=true;game.renderCap.tick=()=>true;for(const m of game.player.meshes)m.group.visible=false});
 return {p,errors};
}
try{
 for(const [stage,foe] of [['frozen_bay_night','eira_mad'],['temple_night','liao_mad']]){
  const {p,errors}=await open(stage,foe);const frames=`${out}/${foe}-frames`;fs.mkdirSync(frames,{recursive:true});
  await p.evaluate(()=>{const g=game,T=g.THREE,h=g.enemy.bodies.head.translation(),f=new T.Vector3(1,0,0).applyQuaternion(g.enemy.yaw);
   g.camera.position.set(h.x+f.x*1.8,h.y+.025,h.z+f.z*1.8);g.camera.lookAt(h.x,h.y-.02,h.z);g.camera.fov=24;g.camera.updateProjectionMatrix();
   window.fxHeadBase={p:{...h},q:{...g.enemy.bodies.head.rotation()}};g.world.step=()=>{};
  });
  const samples=[];
  for(let i=0;i<40;i++){
   await p.evaluate(i=>{const g=game,T=g.THREE,b=window.fxHeadBase,t=i/10;const a=t<1?0:.58*Math.sin((t-1)*6);const q=new T.Quaternion(b.q.x,b.q.y,b.q.z,b.q.w).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),a));g.enemy.bodies.head.setRotation(q,true);g.renderCap.tick=()=>false},i);
   await p.clock.runFor(84);await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);
   await p.screenshot({path:`${frames}/${String(i).padStart(3,'0')}.png`});
   samples.push(await p.evaluate(()=>{const h=game.enemy.groups.head;return {head:h.children.filter(x=>x.isSprite||x.name==='veiled-eye-glow').map(x=>({opacity:x.material.opacity,size:x.scale.x})),trails:game.scene.children.filter(x=>x.isSprite&&x.renderOrder===3&&x.visible).map(x=>x.material.opacity)}}));
  }
  await p.screenshot({path:`${out}/${foe}-detail.png`});
  if(foe==='eira_mad')for(const [name,a] of [['side',Math.PI/2],['back',Math.PI]]){
   await p.evaluate(a=>{const g=game,T=g.THREE,h=g.enemy.bodies.head.translation(),f=new T.Vector3(1,0,0).applyQuaternion(g.enemy.yaw).applyAxisAngle(new T.Vector3(0,1,0),a);g.camera.position.set(h.x+f.x*1.8,h.y+.03,h.z+f.z*1.8);g.camera.lookAt(h.x,h.y-.04,h.z);},a);
   await p.clock.runFor(16);await p.screenshot({path:`${out}/hood-${name}.png`});
  }
  report.push({foe,samples,errors});fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');await p.close();
 }
 for(const oldBear of [true,false]){
  const {p,errors}=await open('frozen_bay_night','eira_mad','http://127.0.0.1:4193',oldBear);
  await p.evaluate(()=>{game.camera.position.set(28,2.6,17.2);game.camera.lookAt(34.1,2,20.9);game.camera.fov=32;game.camera.updateProjectionMatrix()});
  await p.clock.runFor(32);await p.screenshot({path:`${out}/adult-bear-${oldBear?'before':'after'}.png`});report.push({oldBear,errors});await p.close();
 }
}finally{await browser.close()}
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
if(report.some(r=>r.errors.length))process.exitCode=1;
