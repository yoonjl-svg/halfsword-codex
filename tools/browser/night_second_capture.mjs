// Actual stage renderer, fixed time. Landscape details move the camera and hide fighters.
import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-second';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const views={
 clearing:[['overview',[5,5,12],[-11,3,-8],55],['tree',[-7,3.8,-2],[-13.7,3.1,-7.8],44],['trace',[-11.4,1.5,-4.8],[-13.8,.8,-7.8],42]],
 castle:[['overview',[-9,6,8],[4,5,-13],58],['training',[.5,3.2,-7.8],[5,.8,-13.5],45],['footsteps',[-10,4,-4],[-7,.1,-12.5],49],['wall-torches',[0,3.3,0],[0,4,-19],55]],
 cathedral:[['overview',[-12,6,14],[15,8,0],58],['tomb',[-22.75,2.4,12.6],[-22.75,.4,16.3],52],['bats',[-4,6,7],[11,10,0],50]]
};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});const rows=[];
try{for(const [id,foe] of [['clearing','bran'],['castle','isolde'],['cathedral','margarethe']].filter(p=>!only||p[0]===only)){
 const stage=before?id:id+'_night',p=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(`${base}/?stage=${stage}&foe=${foe}&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
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
  for(let i=0;i<40;i++){await p.clock.runFor(100);await p.screenshot({path:`${out}/${stage}-frames/${String(i).padStart(3,'0')}.png`})}
 }
 rows.push({...info,errors});fs.writeFileSync(out+'/capture.json',JSON.stringify(rows,null,2)+'\n');console.log(stage,JSON.stringify(errors));await p.close();
}}finally{await browser.close()}
if(rows.some(r=>r.errors.length||r.state!=='fight'))process.exitCode=1;
