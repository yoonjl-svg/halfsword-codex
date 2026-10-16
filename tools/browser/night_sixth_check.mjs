import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {CHARACTERS_BY_ID as C,CHARACTER_VARIANTS,aiAtProficiency} from '../../src/characters.js';
import {STAGE_IDS,STAGE_FOE} from '../../src/stages.js';
import {ARENA} from '../../src/config.js';
const base=process.argv[2]||'http://127.0.0.1:4194',source=process.env.SOURCE_BASE||'http://127.0.0.1:4193';
const out=process.argv[3]||'/tmp/night-sixth-check.json',report={errors:[]};
assert.equal(STAGE_IDS.filter(s=>s.endsWith('_night')).length,13);
assert.equal(CHARACTER_VARIANTS.length,13);assert.equal(STAGE_FOE.dunhuang_night,'terracotta_mad');
assert.equal(C.terracotta_mad.appearanceOnly,true);
for(const key of ['ai','weapon','physiology','body','strength','voice'])assert.deepEqual(C.terracotta[key],C.terracotta_mad[key],key);
for(let p=1;p<=5;p++)assert.deepEqual(aiAtProficiency(C.terracotta,p),aiAtProficiency(C.terracotta_mad,p));
report.data={pairs:13,proficienciesIdentical:5,weapon:C.terracotta_mad.weapon,physiology:C.terracotta_mad.physiology,radius:ARENA.radius};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
try{
 report.runtime=[];
 for(const [stage,foe] of [['dunhuang','terracotta'],['dunhuang_night','terracotta_mad']]){
  const p=await browser.newPage({viewport:{width:960,height:540}});
  p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
  await p.goto(`${base}/?stage=${stage}&foe=${foe}&weapon=longsword&foeWeapon=goujian&emo=0`,{waitUntil:'networkidle'});
  await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
  for(let i=0;i<150&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
  const start=await p.evaluate(()=>({state:game.state,strength:game.enemy.strength,level:game.ai.level,
   weapon:game.enemy.weapon.id,physiology:game.enemy.physiology,helmet:game.enemy.helmetType,colliders:game.world.colliders.len()}));
  assert.equal(start.state,'fight');assert.equal(start.weapon,'goujian');assert.equal(start.helmet,null);
  await p.evaluate(()=>{window.events=[];const old=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(n,d)=>{if(n==='stageDetail')events.push(d.kind);return old(n,d)}});
  await p.clock.runFor(14000);
  const actual=await p.evaluate(()=>{
   const root=game.scene.getObjectByName('dunhuang_night-story'),repair=game.enemy.groups.head.getObjectByName('terracotta-bronze-face-repair');
   const boxes=['opened-guardian-cart','homeward-votive-boat','guardian-homeward-prints'].map(name=>{
    const o=game.scene.getObjectByName(name);if(!o)return null;
    const b=new game.THREE.Box3().setFromObject(o);return {name,nearest:Math.hypot(Math.max(b.min.x,Math.min(0,b.max.x)),Math.max(b.min.z,Math.min(0,b.max.z)))};
   });
   return {stage:game.stage.id,sound:game.sound.stage,story:root?.userData??null,repair:repair?.userData??null,
    events,boxes,position:{...game.enemy.bodies.pelvis.translation()},resources:game.renderInfo()};
  });
  assert.ok(actual.events.includes('dunhuangWood'));assert.equal(actual.sound,stage);
  assert.ok(Object.values(actual.position).every(Number.isFinite));
  if(stage.endsWith('_night')){
   assert.equal(actual.story.hour,3);assert.ok(actual.story.stories.length>=2);assert.equal(actual.repair.staples,3);
   assert.ok(actual.boxes.every(b=>b&&b.nearest>10.5));
   const transition=await p.evaluate(()=>{
    const values=[];
    for(let i=0;i<6;i++){
     game.setStage('dunhuang');const gone=!game.scene.getObjectByName('dunhuang_night-story');
     game.setStage('dunhuang_night');const {geometries,textures,programs}=game.renderInfo();
     values.push({gone,roots:game.scene.children.filter(x=>x.name==='dunhuang_night-story').length,memory:{geometries,textures,programs}});
    }return values;
   });
   assert.ok(transition.every(r=>r.gone&&r.roots===1));
   assert.deepEqual(transition.at(-1).memory,transition[0].memory);report.transitions=transition;
  }
  report.runtime.push({start,...actual});await p.close();
 }
 assert.deepEqual(report.runtime[0].start,report.runtime[1].start);
 // Optional before-source verifies that the night-only branch leaves daytime
 // vertex data, placements, materials and procedural canvas textures identical.
 if(process.env.DAY_BEFORE){
  const p=await browser.newPage();await p.goto(source+'/night-encounters-5.html');
  const old=fs.readFileSync(process.env.DAY_BEFORE,'utf8');
  report.dayPreservation=await p.evaluate(async(old)=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const current=await import('/src/stage_dunhuang.js');
   const code=old.replaceAll("from 'three'",`from '${location.origin}/node_modules/three/build/three.module.js'`).replaceAll("from './",`from '${location.origin}/src/`);
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));const previous=await import(url);URL.revokeObjectURL(url);
   async function signature(build){
    const scene=new T.Scene(),lights={hemi:new T.HemisphereLight(),sun:new T.DirectionalLight()};build(scene,lights);scene.updateMatrixWorld(true);
    const data=[];scene.traverse(o=>{if(!o.geometry)return;const m=o.material;
     data.push({name:o.name,visible:o.visible,matrix:o.matrixWorld.toArray(),attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,v])=>[k,Array.from(v.array)])),index:o.geometry.index?Array.from(o.geometry.index.array):null,
      material:{type:m.type,color:m.color?.getHex(),opacity:m.opacity,side:m.side,map:m.map?.image?.toDataURL?.()}});
    });
    const bytes=new TextEncoder().encode(JSON.stringify(data)),digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    const disposed=new Set();scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!disposed.has(m)){disposed.add(m);for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose()}});
    return {hash,objects:data.length};
   }
   return {before:await signature(previous.buildDunhuang),after:await signature(current.buildDunhuang)};
  },old);
  assert.deepEqual(report.dayPreservation.before,report.dayPreservation.after);await p.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,data:report.data,day:report.dayPreservation}));
}finally{await browser.close()}
