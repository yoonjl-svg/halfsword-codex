// Recipient-main integration check. Preserve its +1 proficiency policy;
// compare native AI at equal proficiency, and exercise the delivered geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {CHARACTERS_BY_ID as C,CHARACTER_VARIANTS,aiAtProficiency} from '../../src/characters.js';
import {STAGE_IDS,STAGE_ORDER,STAGE_FOE} from '../../src/stages.js';
import {WEAPONS as W} from '../../src/weapons.js';
const base=process.argv[2]||'http://127.0.0.1:4196';
const out=process.argv[3]||'/tmp/content-handoff-browser';
fs.mkdirSync(out,{recursive:true});
const report={errors:[],variants:[],runtime:[],transitions:[]};
assert.equal(CHARACTER_VARIANTS.length,16);
assert.equal(STAGE_IDS.filter(id=>id.endsWith('_night')).length,14);
assert.equal(STAGE_ORDER.length,24); // recipient's existing journey, unchanged
for(const alter of CHARACTER_VARIANTS){
 const original=C[alter.variantOf];
 assert.equal(alter.ai.proficiency,Math.min(5,original.ai.proficiency+1));
 report.variants.push({id:alter.id,base:original.ai.proficiency,alter:alter.ai.proficiency});
}
for(const id of ['chanda','renji','terracotta','silver_wanderer','samira','artoria']){
 const a=C[id+'_mad'],b=C[id];
 for(const key of ['body','strength','voice','physiology','revive'])assert.deepEqual(a[key],b[key],id+'/'+key);
 if(id!=='renji')assert.equal(a.weapon,b.weapon);
 for(let p=1;p<=5;p++){
  const aa=aiAtProficiency(a,p),bb=aiAtProficiency(b,p);
  if(id==='renji')aa.persona.school=bb.persona.school;
  assert.deepEqual(aa,bb,`${id}: equal-proficiency AI ${p}`);
 }
}
assert.equal(C.chanda.epithet,'식물학자');assert.equal(C.chanda_mad.epithet,C.chanda.epithet);
assert.equal(C.renji.weapon,'morgenstern');assert.equal(C.renji_mad.weapon,'brothers_sword');
assert.equal(W.brothers_sword.nameKo,'황약사의 검');assert.equal(W.brothers_sword.mBlunt,1.6);
assert.equal(W.brothers_sword.desc,'흰 천으로 감싼 검. 오랫동안 풀지 않은 듯 단단히 매여 있다.\n“번뇌는 기억력 때문이라더군.” (취생몽사: 몽롱한 일격)');
assert.equal(W.frozen_tuna.mBlunt,2.6);assert.equal(W.rubber_chicken.mBlunt,1.6); // memo only
assert.equal(C.artoria_mad.lookVersion,'v4-alter13');assert.equal(C.artoria_mad.look.armor,null);
assert.equal(C.artoria.look.armor,'plate');
assert.equal(C.silver_wanderer.lookVersion,'v7-silver-c');
assert.equal(C.silver_wanderer_mad.look.hair,C.silver_wanderer.look.hair);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 for(const [stage,id] of [['etna_night','chanda_mad'],['qinglan_night','renji_mad'],['dunhuang_night','terracotta_mad'],['dayr_night','silver_wanderer_mad'],['courtyard','samira_mad'],['corsair','artoria_mad']]){
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
  page.on('pageerror',e=>report.errors.push(`${id}: ${e}`));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(`${id}: ${m.text()}`)});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  await page.clock.install({time:new Date('2026-10-17T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
  await page.goto(`${base}/?stage=${stage}&foe=${id}&weapon=longsword&foeWeapon=${C[id].weapon}&emo=0`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
  for(let i=0;i<180&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
  assert.equal(await page.evaluate(()=>game.state),'fight',id);
  const before=await page.evaluate(()=>({sim:game.stats.simTime,steam:Array.from(game.scene.getObjectByName('etna-geothermal-steam')?.geometry.attributes.position.array??[])}));
  // Native enemy AI, physics and stamina remain enabled throughout.
  for(let i=0;i<12;i++){
   await page.clock.runFor(500);
   assert.ok(await page.evaluate(()=>Object.values(game.enemy.bodies).every(b=>Object.values(b.translation()).every(Number.isFinite))),id+' finite physics');
  }
  await page.evaluate(()=>{game.renderCap.tick=()=>true});await page.clock.runFor(16);
  const data=await page.evaluate(()=>{
   const g=game,f=g.enemy,find=n=>g.scene.getObjectByName(n);
   const story=find(g.stage.id+'-story'),crown=find('artoria-lily-crown'),cord=find('artoria-black-cincture');
   const gold=[];crown?.traverse(o=>{if(o.material?.metalness===.58)gold.push({roughness:o.material.roughness,env:o.material.envMapIntensity,emissive:o.material.emissive?.getHex()})});
   const meshes=[];cord?.traverse(o=>{if(o.geometry?.attributes.position)meshes.push(o)});
   return {id:f.name,stage:g.stage.id,weapon:f.weapon.id,sim:g.stats.simTime,terrain:g.terrain?.id??null,sound:g.sound.stage,
    level:g.ai.level,proficiency:g.ai.persona.proficiency,story:story?.userData,plate:Object.keys(f.plate),
    geothermal:Array.from(find('etna-geothermal-steam')?.geometry.attributes.position.array??[]),
    ghosts:find('yue-apparitions')?.userData,face:find('terracotta-pale-human-face')?.userData,
    cloak:find('yue-commanders-white-cloak-chest')?.userData,caravan:find('dayr-assassin-caravan')?.userData,blood:find('dayr-blood-aftermath')?.userData,
    dispatch:!!find('maya-open-dispatch-case'),cover:!!find('courtyard-cover'),
    artoria:{crown:!!crown,scale:crown?.scale.x,gold,braids:!!find('artoria-coronation-braids'),cord:!!cord,cordAtAbdomen:cord?.parent===f.groups.abdomen,
     cordFinite:meshes.every(o=>Array.from(o.geometry.attributes.position.array).every(Number.isFinite)),deformedMeshes:meshes.filter(o=>Object.hasOwn(o,'onBeforeRender')).length},
    forbidden:['artoria-ivory-bow','artoria-broken-circlet','yue-ghost-banner','dayr-open-escort-cell','dayr-barefoot-salt-trail','daraishi-broken-wrist-shackle'].filter(n=>!!find(n)),
    resources:g.renderInfo()};
  });
  assert.equal(data.stage,stage);assert.equal(data.weapon,C[id].weapon);assert.equal(data.sound,stage);assert.ok(data.sim>before.sim);
  assert.deepEqual(data.forbidden,[]);
  if(stage.endsWith('_night')){assert.equal(data.story.hour,3);assert.equal(STAGE_FOE[stage],id)}
  if(stage==='etna_night'){
   assert.equal(data.terrain,'etna');assert.equal(data.story.geothermal.ventCount,12);
   assert.equal(data.story.geothermal.particles,120);assert.notDeepEqual(data.geothermal,before.steam);assert.ok(data.geothermal.every(Number.isFinite));
  }
  delete data.geothermal;
  if(stage==='qinglan_night'){assert.equal(data.story.abandonedSwords.length,7);assert.equal(data.story.abandonedSwords.filter(s=>s.insideArena).length,3)}
  if(stage==='dunhuang_night'){
   assert.equal(data.ghosts.count,20);assert.equal(data.ghosts.duelPairs,8);assert.equal(data.ghosts.walkers,4);
   assert.equal(data.ghosts.marchingSpears,3);assert.equal(data.ghosts.marchingBanners,0);assert.equal(data.ghosts.colliders,0);
   assert.equal(data.face.opacity,.88);assert.equal(data.cloak.thickness,0);
   const t0=await page.evaluate(()=>{document.getElementById('btnPause').click();return game.scene.getObjectByName('yue-apparitions').userData.time});
   await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>game.scene.getObjectByName('yue-apparitions').userData.time),t0);
   await page.evaluate(()=>document.getElementById('btnResume').click());await page.clock.runFor(200);
   assert.ok(await page.evaluate(()=>game.scene.getObjectByName('yue-apparitions').userData.time)>t0);data.pauseResume=true;
  }
  if(stage==='dayr_night'){assert.equal(data.caravan.fallen,3);assert.equal(data.caravan.camels,3);assert.equal(data.blood.pools,3);assert.equal(data.blood.crawlTrails,1);assert.equal(data.blood.wallSprays,2)}
  if(stage==='courtyard')assert.ok(data.dispatch&&data.cover);
  if(id==='artoria_mad'){
   assert.deepEqual(data.plate,[]);assert.ok(data.artoria.crown&&data.artoria.braids&&data.artoria.cord&&data.artoria.cordAtAbdomen&&data.artoria.cordFinite);
   assert.ok(data.artoria.deformedMeshes>0);assert.equal(data.artoria.scale,.72);assert.ok(data.artoria.gold.length>5);
   assert.ok(data.artoria.gold.every(m=>m.roughness===.35&&m.env===.66&&m.emissive===0));
  }
  await page.screenshot({path:path.join(out,id+'.png')});
  report.runtime.push(data);
  // Exercise actual rebuild/dispose path, including renderer allocation cleanup.
  if(stage.endsWith('_night')){
   const transitions=await page.evaluate(stage=>{
    const result=[];for(let i=0;i<4;i++){
     game.setStage(stage.slice(0,-6));const removed=!game.scene.getObjectByName(stage+'-story');
     game.setStage(stage);const {geometries,textures}=game.renderInfo();
     result.push({removed,roots:game.scene.children.filter(o=>o.name===stage+'-story').length,geometries,textures});
    }return result;
   },stage);
   assert.ok(transitions.every(r=>r.removed&&r.roots===1));assert.deepEqual(transitions.at(-1),transitions[1]);
   report.transitions.push({stage,transitions});
  }
  await page.close();console.log(stage,id,'passed');
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n')}
