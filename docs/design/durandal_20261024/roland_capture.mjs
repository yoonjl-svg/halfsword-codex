import{chromium}from'playwright';import fs from'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5244',out=new URL('./',import.meta.url).pathname;
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
for(const id of ['durandal']){
 const p=await b.newPage({viewport:{width:960,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-10-21T11:00:00Z')});await p.clock.pauseAt(new Date('2026-10-21T11:00:01Z'));
 await p.goto(`${base}/?test=1&weapon=tree_branch&foe=roland&stage=clearing&foeWhiff=1&uniqueStage=5`);await p.waitForFunction(()=>window.game?.state==='menu',null,{timeout:120000});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.querySelector('#btnStart').click();});
 for(let i=0;i<130&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>game.ai.update=()=>{});await p.clock.runFor(1000);
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 await p.evaluate(()=>{game.freeCam=true;for(const m of game.player.meshes)m.group.visible=false;game.renderCap.tick=()=>true;});
 for(const view of ['front','grip']){
 await p.evaluate(view=>{const g=game,T=g.THREE,f=g.enemy,v=f.bodies.pelvis.translation(),ahead=new T.Vector3(1,0,0).applyQuaternion(f.yaw),side=new T.Vector3(0,0,1).applyQuaternion(f.yaw);const close=view==='grip',target=close?f.sword.translation():{x:v.x,y:1.25,z:v.z},dist=close?1.15:5.1;g.camera.position.set(target.x+ahead.x*dist+side.x*(close?.25:.75),close?target.y+.15:1.65,target.z+ahead.z*dist+side.z*(close?.25:.75));g.camera.lookAt(target.x,target.y,target.z);g.camera.fov=close?33:37;g.camera.updateProjectionMatrix();},view);await p.clock.runFor(16);await p.screenshot({path:out+`roland-${view}.png`});
 }
 rows.push(await p.evaluate(()=>({id:game.enemy.weapon.id,mass:game.enemy.sword.mass(),frame:game.enemy.weapon.frame,scabbards:game.enemy.groups.pelvis.children.filter(o=>o.name==='hwando-black-scabbard').length,triangles:game.renderer?.info?.render?.triangles})));if(errors.length)throw Error(errors.join('\n'));await p.close();
}
await b.close();fs.writeFileSync(out+'roland-equipment.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
