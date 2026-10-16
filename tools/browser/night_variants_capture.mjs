// Actual game scenes, fixed simulation time; optional before capture for the three pairs.
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4193',out=process.argv[3]||'/tmp/night-variants';
const before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const pairs=before?[['poseidon_night','heinrich_mad'],['frozen_bay','eira'],['temple','liao']]:[['poseidon_night','heinrich_mad'],['frozen_bay_night','eira_mad'],['temple_night','liao_mad']];
const rows=[],only=process.argv.find(s=>s.startsWith('--only='))?.slice(7);
try{for(const [stage,foe] of pairs.filter(p=>!only||p[0]===only)){
 const p=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true});const errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(`${base}/?stage=${stage}&foe=${foe}&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await p.clock.runFor(2500);
 await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);
 await p.screenshot({path:`${out}/${stage}-gameplay.png`});
 const info=await p.evaluate(()=>({stage:game.stage.id,foe:game.enemy.name,state:game.state,level:game.ai.level,proficiency:game.ai.persona.proficiency,eyes:game.enemy.groups.head.children.filter(x=>x.isSprite).map(x=>({size:x.scale.x,opacity:x.material.opacity})),render:game.renderInfo()}));
 await p.addStyleTag({content:'body > :not(canvas) {visibility:hidden!important}'});
 await p.evaluate(()=>{const g=game;g.freeCam=true;const v=g.enemy.bodies.pelvis.translation(),T=g.THREE;const f=new T.Vector3(1,0,0).applyQuaternion(g.enemy.yaw);g.camera.position.set(v.x+f.x*4.2,1.25,v.z+f.z*4.2);g.camera.lookAt(v.x,1.02,v.z);g.camera.fov=34;g.camera.updateProjectionMatrix();for(const m of g.player.meshes)m.group.visible=false;});
 await p.setViewportSize({width:720,height:960});await p.clock.runFor(16);await p.screenshot({path:`${out}/${foe}-portrait.png`});
 await p.setViewportSize({width:1200,height:675});
 await p.clock.runFor(96);
 await p.evaluate(stage=>{const g=game;g.camera.fov=58;g.camera.updateProjectionMatrix();
 if(stage.startsWith('frozen')){g.camera.position.set(-11,6,-17);g.camera.lookAt(25,14,18)}
 else if(stage.startsWith('temple')){g.camera.position.set(-14,5,-16);g.camera.lookAt(20,18,0)}
 else {g.camera.position.set(-12,6,12);g.camera.lookAt(10,3,-6)}},stage);
 await p.clock.runFor(16);await p.screenshot({path:`${out}/${stage}-overview.png`});
 // Close observers keep the stage's actual light and the fighter's actual pose.
 await p.setViewportSize({width:720,height:960});await p.clock.runFor(96);
 await p.evaluate(()=>{const g=game,T=g.THREE,v=g.enemy.bodies.pelvis.translation(),f=new T.Vector3(1,0,0).applyQuaternion(g.enemy.yaw);g.camera.position.set(v.x+f.x*4.2,1.25,v.z+f.z*4.2);g.camera.lookAt(v.x,1.02,v.z);g.camera.fov=34;g.camera.updateProjectionMatrix()});
 await p.clock.runFor(16);await p.screenshot({path:`${out}/${foe}-front.png`});
 await p.setViewportSize({width:1200,height:675});await p.clock.runFor(96);
 const views=stage.startsWith('frozen')?[['visitor',[8.5,2,1.5],[16,1,9],45],['bears',[7,3,0],[23,2,13],38]]:
 stage.startsWith('temple')?[['cloth',[8.9,2.4,3.5],[11.8,.45,5.2],38],['tea',[10,2,-7],[12.8,.35,-4.4],38]]:
 [['offerings',[8.3,1.2,-3.5],[9.87,.12,-5.1],38]];
 for(const [name,pos,target,fov] of views){await p.evaluate(({pos,target,fov})=>{game.camera.position.set(...pos);game.camera.lookAt(...target);game.camera.fov=fov;game.camera.updateProjectionMatrix()},{pos,target,fov});await p.clock.runFor(32);await p.screenshot({path:`${out}/${stage}-${name}.png`})}
 rows.push({...info,errors});fs.writeFileSync(out+'/capture.json',JSON.stringify(rows,null,2)+'\n');console.log(stage,JSON.stringify(errors));await p.close();
}}finally{await browser.close()}
if(rows.some(r=>r.errors.length||r.state!=='fight'))process.exitCode=1;
