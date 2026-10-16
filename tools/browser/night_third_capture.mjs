// Actual stage renderer, fixed time. Landscape details move the camera and hide fighters.
import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-second';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const views={
 loggia:[['overview',[-8,5,10],[4,4,-14],55],['archive',[5.2,2.7,-12.4],[7.5,1.7,-17.8],48],['pages',[3.3,2.4,-9.2],[7,.05,-13.6],50]],
 sacred_grove:[['overview',[-8,5,10],[17,8,-3],58],['fallen',[-6,3,6],[-14,1,9],55],['roots',[13,2,2],[20.5,1,-3],55]],
 corsair:[['overview',[3,5,10],[25,2,0],58],['coral',[10,2.7,3.4],[17.1,1.1,-1],53],['reef',[10,2.8,12.2],[17.2,.8,8.8],52],['wreck',[17,3,12],[29,-.3,18],52]]
};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});const rows=[];
try{for(const [id,foe] of [['loggia','tome'],['sacred_grove','minami'],['corsair','omari']].filter(p=>!only||p[0]===only)){
 const stage=before?id:id+'_night',enemy=before||id==='sacred_grove'?foe:foe+'_mad',p=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(`${base}/?stage=${stage}&foe=${enemy}&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
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
