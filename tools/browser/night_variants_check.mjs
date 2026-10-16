// Runtime checks for cosmetic variants: no implicit mad-stat boost, stable stage disposal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {CHARACTERS,CHARACTER_VARIANTS,aiAtProficiency} from '../../src/characters.js';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-variants-check.json';
for(const id of ['eira','liao']){
 const original=CHARACTERS.find(c=>c.id===id),alter=CHARACTER_VARIANTS.find(c=>c.id===id+'_mad');
 assert.deepEqual(alter.ai,original.ai);
 for(let p=1;p<=5;p++)assert.deepEqual(aiAtProficiency(alter,p),aiAtProficiency(original,p));
 assert.equal(alter.weapon,original.weapon);
}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.clock.install({time:new Date('2026-10-16T18:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await page.goto(base+'/?stage=frozen_bay_night&foe=eira_mad&weapon=longsword&emo=0',{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>true});
 for(let lap=0;lap<3;lap++)for(const id of ['temple_night','temple','frozen_bay_night','frozen_bay','poseidon_night','poseidon']){
  await page.evaluate(id=>game.setStage(id),id);await page.clock.runFor(64);
  const row=await page.evaluate(()=>{const r=game.renderInfo();return {stage:game.stage.id,resources:{geometries:r.geometries,textures:r.textures,programs:r.programs},nightRoots:game.scene.children.filter(x=>x.name.endsWith('-story')).map(x=>({name:x.name,hour:x.userData.hour})),radius:game.config.ARENA.radius}});
  // The retained fighter caches shader variants when it first sees each light rig.
  // Geometry/textures must be stable immediately; programs after one complete lap.
  if(lap>0){const prev=rows.find(r=>r.stage===id&&r.lap===lap-1).value;
   assert.equal(row.resources.geometries,prev.resources.geometries);assert.equal(row.resources.textures,prev.resources.textures);
   if(lap>1)assert.deepEqual(row,prev);
  }
  if(!id.endsWith('_night'))assert.equal(row.nightRoots.length,0);
  if(['temple_night','frozen_bay_night'].includes(id))assert.equal(row.nightRoots[0].hour,3);
  rows.push({lap,stage:id,value:row});
  fs.writeFileSync(out,JSON.stringify({pass:false,rows,errors},null,2)+'\n');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out,JSON.stringify({pass:true,aiPairs:2,proficiencyPairs:10,stageBuilds:rows.length,rows,errors},null,2)+'\n');
 console.log(JSON.stringify({pass:true,aiPairs:2,proficiencyPairs:10,stageBuilds:rows.length,errors}));
}finally{await browser.close()}
