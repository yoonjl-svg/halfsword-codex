import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {CHARACTER_VARIANTS} from '../../src/characters.js';
import {STAGE_IDS,STAGE_FOE} from '../../src/stages.js';
import {stageStartZ} from '../../src/arena_obstacle.js';
import {sweepParams} from '../../src/camera_rig.js';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-fourth.json';
const night=STAGE_IDS.filter(id=>id.endsWith('_night'));
assert.equal(night.length,10);
for(const id of night)assert.ok(CHARACTER_VARIANTS.some(c=>c.id===STAGE_FOE[id]));
assert.equal(stageStartZ('sluice_night'),stageStartZ('sluice'));
assert.deepEqual(sweepParams('sluice_night'),sweepParams('sluice'));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}),rows=[],errors=[];
try{
 const p=await browser.newPage({viewport:{width:960,height:540}});
 p.on('pageerror',e=>errors.push(String(e)));
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(base+'/?stage=clearing_night&foe=bran_mad&weapon=longsword&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>document.getElementById('btnStart').click());
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 const hat=await p.evaluate(()=>({cosmetic:!!game.enemy.groups.head.getObjectByName('alter-player-kettle-hat'),armor:game.enemy.hasHelmet,type:game.enemy.helmetType}));
 assert.deepEqual(hat,{cosmetic:true,armor:false,type:null});
 for(const id of ['sluice','sluice_night','sacred_grove','sacred_grove_night']){
  await p.evaluate(id=>game.setStage(id),id);
  const row=await p.evaluate(()=>({id:game.stage.id,obstacle:game.arenaObstacle,surface:game.enemy.movementSurface,sound:game.sound.stage,deer:!!game.scene.getObjectByName('grove-sika-deer'),story:game.scene.children.find(x=>x.name.endsWith('-story'))?.userData??null}));
  if(id.startsWith('sluice')){assert.ok(row.obstacle.colliderCount>0);assert.equal(row.surface,'wetland');assert.equal(row.sound,id)}
  if(id==='sacred_grove')assert.equal(row.deer,true);
  if(id==='sacred_grove_night')assert.equal(row.deer,false);
  rows.push(row);
 }
 assert.deepEqual(rows[0].obstacle,rows[1].obstacle);assert.deepEqual(errors,[]);
 fs.writeFileSync(out,JSON.stringify({pass:true,nightPairs:night.map(id=>[id,STAGE_FOE[id]]),hat,rows,errors},null,2)+'\n');
 console.log(JSON.stringify({pass:true,nightPairs:10,hat,errors}));
}finally{await browser.close()}
