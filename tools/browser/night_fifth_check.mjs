import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {CHARACTERS_BY_ID as C,CHARACTER_VARIANTS,aiAtProficiency} from '../../src/characters.js';
import {terrainForStage} from '../../src/etna_ground.js';
const base=process.argv[2]||'http://127.0.0.1:4194',source=process.env.SOURCE_BASE||'http://127.0.0.1:4193',out=process.argv[3]||'/tmp/night-fifth-check.json';
const report={errors:[]};
assert.equal(CHARACTER_VARIANTS.length,12);
assert.equal(terrainForStage('etna_night'),terrainForStage('etna'));
assert.equal(terrainForStage('qinglan_night'),null);
assert.deepEqual(C.chanda.ai,C.chanda_mad.ai);
assert.equal(C.chanda.weapon,C.chanda_mad.weapon);
assert.equal(C.renji.weapon,'morgenstern');assert.equal(C.renji_mad.weapon,'brothers_sword');
assert.equal(C.renji_mad.appearanceOnly,false);
for(let p=1;p<=5;p++){
 assert.deepEqual(aiAtProficiency(C.chanda,p),aiAtProficiency(C.chanda_mad,p));
 const old=aiAtProficiency(C.renji,p),alt=aiAtProficiency(C.renji_mad,p);
 assert.equal(old.level,alt.level);assert.deepEqual(old.persona.level,alt.persona.level);
 assert.deepEqual(old.persona.pers,alt.persona.pers);assert.deepEqual(old.persona.proficiency,alt.persona.proficiency);
}
report.stats={chandaUnchanged:true,kimNoStatBoost:true,proficiencies:5,variants:12};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 report.runtime=[];
 for(const [id,foe,weapon] of [['etna_night','chanda_mad','moye'],['qinglan_night','renji_mad','brothers_sword']]){
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await page.clock.install({time:new Date('2026-10-16T18:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
  await page.goto(`${base}/?stage=${id}&foe=${foe}&weapon=longsword&foeWeapon=${weapon}&emo=0`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
  for(let i=0;i<150&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
  const steamBefore=await page.evaluate(()=>Array.from(game.scene.getObjectByName('etna-geothermal-steam')?.geometry.attributes.position.array??[]));
  await page.evaluate(()=>{window.detailEvents=[];const original=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(name,data)=>{if(name==='stageDetail')detailEvents.push(data.kind);return original(name,data)}});
  await page.clock.runFor(14000);
  const data=await page.evaluate(()=>{
   const f=game.enemy,r=game.scene.children.find(o=>o.name===game.stage.id+'-story');
   const detailNames=['chanda-white-face-veil','renji-loose-long-hair'];
   return {stage:game.stage.id,state:game.state,weapon:f.weapon.id,terrain:game.terrain?.id??null,enemyTerrain:f.terrain?.id??null,sound:game.sound.stage,stories:r.userData.stories,hour:r.userData.hour,details:detailNames.filter(n=>Object.values(f.groups).some(g=>g.getObjectByName(n))),headArmor:f.helmetType,position:{...f.bodies.pelvis.translation()},events:detailEvents,colliders:game.world.colliders.len(),alive:f.alive,geothermal:r.userData.geothermal,abandonedSwords:r.userData.abandonedSwords};
  });
  assert.equal(data.weapon,weapon);assert.equal(data.sound,id);assert.equal(data.hour,3);assert.ok(data.stories.length>=2);
  assert.ok(Object.values(data.position).every(Number.isFinite));
  if(id==='etna_night'){
   assert.equal(data.terrain,'etna');assert.equal(data.enemyTerrain,'etna');assert.ok(data.events.includes('etnaCrust'));assert.ok(data.details.includes('chanda-white-face-veil'));assert.equal(data.headArmor,null);
   assert.equal(data.geothermal.ventCount,12);assert.equal(data.geothermal.particles,120);
   const steamAfter=await page.evaluate(()=>Array.from(game.scene.getObjectByName('etna-geothermal-steam').geometry.attributes.position.array));
   assert.ok(steamAfter.every(Number.isFinite));assert.notDeepEqual(steamAfter,steamBefore);data.steamAnimated=true;assert.equal(data.colliders,70);
  }else{
   assert.equal(data.terrain,null);assert.ok(!data.events.includes('cliffBird'));assert.ok(data.events.includes('springDrip'));assert.ok(data.details.includes('renji-loose-long-hair'));assert.equal(data.headArmor,'kasa');
   assert.equal(data.abandonedSwords.length,7);assert.equal(data.abandonedSwords.filter(s=>s.insideArena).length,3);assert.equal(data.colliders,68);
  }
  report.runtime.push(data);await page.close();
 }
 const page=await browser.newPage();await page.goto(source+'/night-encounters-4.html');
 report.audio=await page.evaluate(async()=>{
  const {Sound,makeRng}=await import('/src/sound.js'),{StageDetailSound}=await import('/src/stage_detail_sound.js');
  const c=new AudioContext();await c.resume();const s=new Sound();s.ctx=c;s.stage='etna_night';s.master=c.createGain();s.master.gain.value=0;s.master.connect(c.destination);
  const d=new StageDetailSound(s,makeRng);s._stageDetails=d;const etnaNodes=d.ambience().nodes.length,crust=d.event({kind:'etnaCrust',amp:.5});d.setPaused(true);const paused=d.voices.size===0&&!d.event({kind:'etnaCrust'});d.setPaused(false);
  d.setStage('qinglan_night');const qinglanNodes=d.ambience().nodes.length,birdRejected=!d.event({kind:'cliffBird'}),drip=d.event({kind:'springDrip',amp:.5});
  d.setStage('qinglan');const cleared=d.voices.size===0&&d.buffers.size===0,birdDay=d.event({kind:'cliffBird',amp:.5});d.stopAmbient();d.stopVoices();await c.close();return {etnaNodes,crust,paused,qinglanNodes,birdRejected,drip,cleared,birdDay};
 });
 for(const key of ['crust','paused','birdRejected','drip','cleared','birdDay'])assert.equal(report.audio[key],true,key);
 assert.ok(report.audio.etnaNodes>0&&report.audio.qinglanNodes>0);assert.deepEqual(report.errors,[]);
 report.pass=true;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close()}
