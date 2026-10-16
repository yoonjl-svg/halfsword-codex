// Actual production renderer; held fighters/camera isolate weather contrast.
import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/wetland-weather';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}),errors=[],report={};
const p=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
async function advance(ms,render=false){await p.evaluate(render=>game.renderCap.tick=()=>render,render);await p.clock.runFor(ms)}
const weather=()=>p.evaluate(()=>({...game.scene.getObjectByName('sluice_night-story').userData.weather}));
async function flash(){for(let i=0;i<850;i++){await advance(16);if((await weather()).flash>.70){await advance(1,true);return}}throw Error('No flash peak within expected interval')}
async function shot(name){await p.evaluate(()=>game.renderCap.tick=()=>true);await p.clock.runFor(1);await p.screenshot({path:`${out}/${name}.png`});report[name]=await weather()}
try{
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(base+'/?stage=sluice_night&foe=ratna_mad&weapon=longsword&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await advance(2500);
 await p.evaluate(()=>{game.freeCam=true;game.world.step=()=>{};window.weatherEvents=[];const original=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(name,data)=>{if(data?.kind==='wetlandThunder')window.weatherEvents.push({...data});return original(name,data)}});
 await advance(16,true);await shot('gameplay-dark');await flash();await advance(16,true);await shot('gameplay-flash');
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 await p.evaluate(()=>{for(const f of [game.player,game.enemy])for(const m of f.meshes)m.group.visible=false;game.camera.position.set(6,4,6);game.camera.lookAt(17,3,-9);game.camera.fov=58;game.camera.updateProjectionMatrix()});
 await advance(600,true);await shot('village-dark');await flash();await advance(16,true);await shot('village-flash');
 await p.evaluate(()=>{game.camera.position.set(11.2,1.7,-7.7);game.camera.lookAt(13.7,.45,-5.2);game.camera.fov=43;game.camera.updateProjectionMatrix()});
 await advance(600,true);await shot('letters-dark');await flash();await advance(16,true);await shot('letters-flash');
 report.events=await p.evaluate(()=>window.weatherEvents);report.errors=errors;fs.writeFileSync(out+'/capture.json',JSON.stringify(report,null,2)+'\n');
}finally{await browser.close()}
if(errors.length)process.exitCode=1;
