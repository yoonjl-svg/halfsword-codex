import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/courtyard-cover-browser.json';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const report={errors:[]};
try{
 const p=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});p.on('pageerror',e=>report.errors.push(String(e)));
 await p.clock.install({time:new Date('2026-10-16T08:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T08:00:01Z'));
 await p.goto(base+'/?stage=courtyard&foe=samira&weapon=brothers_sword&foeWeapon=pistol&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<160&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>game.ai.update=()=>{});await p.clock.runFor(5500);
 report.cover=await p.evaluate(()=>{
  const T=game.THREE,mesh=game.scene.getObjectByName('courtyard-cover'),colliders=[];game.scene.updateMatrixWorld(true);
  game.world.colliders.forEach(c=>{const p=c.translation();if(c.parent()?.isFixed()&&p.y>0&&Math.hypot(p.x,p.z)<1.7)colliders.push(c)});
  const paths=game.camOpenPath(60),inside=[];for(const [i,path]of paths.entries())if(colliders.some(c=>c.containsPoint(path.pos)))inside.push(i);
  const ray=new T.Raycaster(),visible=[];const ep=game.enemy.bodies.pelvis.translation();
  for(const y of [.5,.9,1.2,1.6]){
   const target=new T.Vector3(ep.x,y,ep.z),direction=target.clone().sub(game.camera.position);ray.set(game.camera.position,direction.clone().normalize());ray.far=direction.length();visible.push(!ray.intersectObject(mesh,false).length);
  }
  const matches=[];for(const z of [0,.4,-.4,2.5,-2.5]){
   const origin=new T.Vector3(2.5,1.35,z),direction=new T.Vector3(-1,0,0);ray.set(origin,direction);ray.far=5;const visible=ray.intersectObject(mesh,false)[0]?.distance??null;
   const hits=colliders.map(c=>c.castRay({origin,dir:direction},5,true)).filter(t=>t>=0),physical=hits.length?Math.min(...hits):null;matches.push({z,visible,physical});
  }
  return {radius:game.config.ARENA.radius,colliders:colliders.length,navigation:game.arenaObstacle.navigation,start:[game.player.bodies.pelvis.translation().z,ep.z],openingSamples:paths.length,cameraInside:inside,finalVisible:visible,shapeMatches:matches};
 });
 assert.equal(report.cover.colliders,9);assert.deepEqual(report.cover.cameraInside,[]);assert.ok(report.cover.finalVisible.every(Boolean));assert.ok(report.cover.start.every(z=>Math.abs(z-1.85)<.15));
 for(const hit of report.cover.shapeMatches){if(Math.abs(hit.z)<1)assert.ok(Math.abs(hit.visible-hit.physical)<.15);else{assert.equal(hit.visible,null);assert.equal(hit.physical,null);}}
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));
