import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:4523';
const out=process.argv[3]||'docs/design/courtyard_ruins_20261021/shots';
fs.mkdirSync(out,{recursive:true});
const report={errors:[],shots:[],runtime:{}};
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1,hasTouch:true});
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.clock.install({time:new Date('2026-10-21T07:00:00Z')});await page.clock.pauseAt(new Date('2026-10-21T07:00:01Z'));
  await page.goto(`${base}/?test=1&stage=courtyard_night&foe=samira_mad&weapon=longsword&foeWeapon=sabre&emo=0`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.game?.player,{timeout:90000});
  await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click();});
  for(let i=0;i<300&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
  await page.evaluate(()=>{game.ai.update=()=>{};});
  await page.clock.runFor(4300);
  const shot=async name=>{await page.evaluate(()=>{game.renderCap.tick=()=>true;});await page.clock.runFor(48);await page.screenshot({path:`${out}/${name}.png`,timeout:120000});await page.evaluate(()=>{game.renderCap.tick=()=>false;});report.shots.push(name);};
  await shot('01_fight');
  report.runtime=await page.evaluate(()=>({state:game.state,stage:game.stage,foe:game.enemy.characterId,weapon:game.enemy.weapon.id,obstacle:game.arenaObstacle,render:game.renderInfo(),smokeSprites:game.scene.getObjectByName('courtyard-black-artillery-smoke')?.children.length,finite:[game.player,game.enemy].every(f=>Object.values(f.bodies).every(b=>Number.isFinite(b.translation().y)))}));
  await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
  const cam=async(pos,look,fov=55)=>page.evaluate(([pos,look,fov])=>{game.freeCam=true;game.camera.position.set(...pos);game.camera.up.set(0,1,0);game.camera.lookAt(...look);game.camera.fov=fov;game.camera.updateProjectionMatrix();},[pos,look,fov]);
  await cam([-19,16,17],[13,1,-1],61);await shot('02_overview');
  await cam([12,6,13],[32,4,1],55);await shot('03_gate_and_well');
  await cam([12,5,-10],[-10,3,24],55);await shot('04_reverse_arcade');
  await cam([5,4,12],[12,1.2,16],48);await shot('05_conference');
  const before=await page.evaluate(()=>game.scene.getObjectByName('courtyard-black-artillery-smoke').children.map(x=>x.position.toArray()));
  await page.clock.runFor(2300);
  const after=await page.evaluate(()=>game.scene.getObjectByName('courtyard-black-artillery-smoke').children.map(x=>x.position.toArray()));
  report.smokeMoves=JSON.stringify(before)!==JSON.stringify(after);
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{game.freeCam=false;game.camera.fov=55;game.camera.updateProjectionMatrix();});
  await page.clock.runFor(350);await shot('06_mobile');
  // Switch scene to confirm shared light/geometry disposal, then return to the new night.
  const swaps=[];
  for(const id of ['courtyard','courtyard_night','courtyard','courtyard_night']){
    await page.evaluate(id=>game.setStage(id),id);await page.clock.runFor(100);
    swaps.push(await page.evaluate(()=>({stage:game.stage.id,obstacle:game.arenaObstacle?.colliderCount,smoke:!!game.scene.getObjectByName('courtyard-black-artillery-smoke')})));
  }
  report.swaps=swaps;
  if(report.runtime.obstacle?.colliderCount!==9)report.errors.push('night central obstacle is not 9 colliders');
  if(report.runtime.weapon!=='sabre')report.errors.push('alter Maya weapon mismatch');
  if(!report.runtime.finite||!report.smokeMoves)report.errors.push('nonfinite body or static smoke');
  if(swaps.some(s=>s.obstacle!==9||s.smoke!==(s.stage==='courtyard_night')))report.errors.push('scene switching contract');
  fs.writeFileSync(`${out}/review.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  await page.close();
}finally{await browser.close();}
if(report.errors.length)process.exitCode=1;
