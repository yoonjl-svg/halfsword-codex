// Integration: real Maya fight, unobstructed camera, stage disposal and audio ownership.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/courtyard-check.json';
const report={errors:[]},browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const p=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
 p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T08:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T08:00:01Z'));
 await p.goto(base+'/?stage=courtyard&foe=stage&weapon=longsword&foeWeapon=pistol&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<160&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{window.events=[];const original=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(name,data)=>{if(name==='stageDetail')events.push(data);return original(name,data)}});
 await p.clock.runFor(18000);
 report.fight=await p.evaluate(()=>({stage:game.stage.id,sound:game.sound.stage,foe:game.enemy.name,weapon:game.enemy.weapon.id,shots:game.enemy.gun?.shots??0,terrain:game.terrain,colliders:game.world.colliders.len(),position:{...game.enemy.bodies.pelvis.translation()},events:events.map(e=>e.kind)}));
 assert.equal(report.fight.foe,'마야 라토르');assert.equal(report.fight.weapon,'pistol');assert.equal(report.fight.terrain,null);assert.ok(report.fight.shots>0);assert.ok(Object.values(report.fight.position).every(Number.isFinite));assert.equal(report.fight.sound,'courtyard');
 // The central kiosk intentionally hides opponents; check the surrounding scene here.
 // Its physical camera/start-view protection is checked by courtyard_cover tests.
 report.camera=await p.evaluate(()=>{
  const T=game.THREE,root=game.scene.getObjectByName('courtyard-environment'),meshes=[];root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isMesh&&!o.material.transparent&&o.name!=='courtyard-sky'&&o.name!=='courtyard-cover')meshes.push(o)});
  const ray=new T.Raycaster(),bad=[],nonfinite=[];
  root.traverse(o=>{if(o.geometry?.attributes.position&&!Array.from(o.geometry.attributes.position.array).every(Number.isFinite))nonfinite.push(o.name)});
  const paths=game.camOpenPath(60);
  for(let i=0;i<72;i++){const a=i*Math.PI/36;paths.push({pos:new T.Vector3(Math.cos(a)*10.5,2.7,Math.sin(a)*10.5),look:new T.Vector3(0,1.1,0)})}
  for(let i=0;i<paths.length;i++){const {pos,look}=paths[i],d=look.clone().sub(pos);ray.set(pos,d.clone().normalize());ray.far=d.length()-.2;const hit=ray.intersectObjects(meshes,false)[0];if(hit)bad.push({i,name:hit.object.name,d:hit.distance})}
  return {samples:paths.length,bad,nonfinite};
 });assert.deepEqual(report.camera.bad,[]);assert.deepEqual(report.camera.nonfinite,[]);
 report.resources=[];
 for(let lap=0;lap<4;lap++)for(const stage of ['courtyard','dayr','loggia']){
  await p.evaluate(id=>{game.setStage(id);game.renderCap.tick=()=>true;game.scene.traverse(o=>{if(o.isMesh||o.isPoints)o.frustumCulled=false})},stage);await p.clock.runFor(32);
  const value=await p.evaluate(()=>{const r=game.renderInfo();return {geometries:r.geometries,textures:r.textures,programs:r.programs,roots:game.scene.children.filter(o=>o.name==='courtyard-environment').length}});
  if(lap>1)assert.deepEqual(value,report.resources.find(r=>r.lap===lap-1&&r.stage===stage).value);
  assert.equal(value.roots,stage==='courtyard'?1:0);report.resources.push({lap,stage,value});
 }
 const q=await browser.newPage();await q.goto('http://127.0.0.1:4193/night-encounters-5.html');
 report.audio=await q.evaluate(async()=>{
  const {Sound,makeRng}=await import('/src/sound.js'),{StageDetailSound,synthStageDetail}=await import('/src/stage_detail_sound.js');
  const c=new AudioContext();await c.resume();const sound=new Sound();sound.ctx=c;sound.stage='courtyard';sound.master=c.createGain();sound.master.gain.value=0;sound.master.connect(c.destination);
  const details=new StageDetailSound(sound,makeRng),nodes=details.ambience().nodes.length;
  const kinds=['courtyardCloth','courtyardDrip','courtyardRing'],pcm=kinds.map(kind=>{const a=synthStageDetail(kind,22050,makeRng(7));return {kind,finite:a.every(Number.isFinite),peak:Math.max(...a.map(Math.abs)),samples:a.length}});
  const accepted=details.event({kind:'courtyardCloth',amp:.5});details.setPaused(true);const pauseStops=details.voices.size===0&&!details.event({kind:'courtyardRing'});details.setPaused(false);
  details.setStage('loggia');const cleared=details.voices.size===0&&details.buffers.size===0,wrongStageRejected=!details.event({kind:'courtyardDrip'});details.stopAmbient();details.stopVoices();await c.close();return {nodes,pcm,accepted,pauseStops,cleared,wrongStageRejected};
 });for(const key of ['accepted','pauseStops','cleared','wrongStageRejected'])assert.equal(report.audio[key],true);assert.ok(report.audio.nodes>0);assert.ok(report.audio.pcm.every(p=>p.finite&&p.peak>0&&p.peak<1));
 report.wind=await q.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{buildCourtyard}=await import('/src/stage_courtyard.js');
  const runs=[];
  for(const fps of [30,120]){
   const scene=new T.Scene(),stage=buildCourtyard(scene,{hemi:new T.HemisphereLight(),sun:new T.DirectionalLight()}),schedule=[];let last=4;
   for(let i=0;i<fps*80;i++){stage.update(1/fps);if(stage.wind.nextGust!==last){schedule.push(stage.wind.nextGust);last=stage.wind.nextGust;}}
   const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){resources.add(o.material);for(const v of Object.values(o.material))if(v?.isTexture)resources.add(v)}});for(const r of resources)r.dispose();
   runs.push({fps,schedule});
  }return runs;
 });assert.deepEqual(report.wind[0].schedule,report.wind[1].schedule);for(const run of report.wind){let last=4;for(const t of run.schedule){assert.ok(t-last>=9&&t-last<=17);last=t;}}
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser.close()}
console.log(JSON.stringify({pass:report.pass,fight:report.fight,camera:report.camera,stageBuilds:report.resources?.length,errors:report.errors}));
