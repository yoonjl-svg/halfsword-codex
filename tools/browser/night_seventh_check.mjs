import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {CHARACTERS_BY_ID as C,CHARACTER_VARIANTS,aiAtProficiency} from '../../src/characters.js';
import {STAGE_IDS,STAGE_FOE,STAGE_ORDER} from '../../src/stages.js';
import {ARENA} from '../../src/config.js';
const source=process.env.SOURCE_BASE||'http://127.0.0.1:4193',base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/night-seventh-check.json',report={errors:[]};
assert.equal(STAGE_IDS.filter(s=>s.endsWith('_night')).length,14);assert.equal(CHARACTER_VARIANTS.length,14);
assert.equal(STAGE_FOE.dayr_night,'silver_wanderer_mad');assert.ok(!STAGE_ORDER.includes('dayr_night'));
assert.equal(C.silver_wanderer_mad.appearanceOnly,true);
assert.equal(C.silver_wanderer.lookVersion,'v7-front1');assert.equal(C.silver_wanderer_mad.lookVersion,'v7-alter1');
assert.equal(C.silver_wanderer.look.daraishiFront,1);assert.equal(C.silver_wanderer_mad.look.daraishiFront,undefined);
for(const id of ['silver_wanderer','silver_wanderer_mad']){assert.equal(C[id].look.daraishiRevision,7);assert.equal(C[id].look.daraishiLower,undefined);assert.equal(C[id].look.daraishiScabbard,8);}
for(const k of ['ai','weapon','body','strength','voice','physiology'])assert.deepEqual(C.silver_wanderer[k],C.silver_wanderer_mad[k],k);
for(let p=1;p<=5;p++)assert.deepEqual(aiAtProficiency(C.silver_wanderer,p),aiAtProficiency(C.silver_wanderer_mad,p));
report.data={pairs:14,proficienciesIdentical:5,weapon:C.silver_wanderer.weapon,radius:ARENA.radius};
if(!process.env.DAY_BEFORE)throw new Error('Set DAY_BEFORE to the saved pre-change src/stage_dayr.js');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const p=await browser.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(base+'/?stage=dayr_night&foe=silver_wanderer_mad&weapon=longsword&foeWeapon=monohoshizao&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<150&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{window.events=[];const old=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(name,data)=>{if(name==='stageDetail')events.push(data.kind);return old(name,data)}});
 const start=await p.evaluate(()=>({state:game.state,colliders:game.world.colliders.len(),strength:game.enemy.strength,weapon:game.enemy.weapon.id,helmet:game.enemy.helmetType}));
 assert.equal(start.state,'fight');assert.equal(start.weapon,'monohoshizao');assert.equal(start.helmet,null);
 await p.clock.runFor(14000);
 report.runtime=await p.evaluate(()=>{
  const g=game,r=g.scene.getObjectByName('dayr_night-story'),trail=g.scene.getObjectByName('dayr-barefoot-salt-trail');
  const cuff=Object.values(g.enemy.groups).flatMap(o=>o.getObjectByName('daraishi-broken-wrist-shackle')?[o.getObjectByName('daraishi-broken-wrist-shackle')]:[]);
  const pos=g.enemy.bodies.pelvis.translation();return {start:null,position:{...pos},hour:r.userData.hour,stories:r.userData.stories,sunHidden:!g.scene.getObjectByName('dayr-setting-sun').visible,footprints:trail.userData.footprints,minRadius:trail.userData.minRadius,cell:g.scene.getObjectByName('dayr-open-escort-cell').userData,cuffs:cuff.map(o=>o.userData),events,frame:g.renderInfo(),addedColliders:r.userData.addedColliders};
 });report.runtime.start=start;
 assert.equal(report.runtime.hour,3);assert.ok(report.runtime.sunHidden);assert.equal(report.runtime.stories.length,2);assert.equal(report.runtime.footprints,48);assert.ok(report.runtime.minRadius>10.5);assert.equal(report.runtime.cuffs.length,1);assert.equal(report.runtime.cuffs[0].chainLinks,3);assert.equal(report.runtime.addedColliders,0);assert.ok(Object.values(report.runtime.position).every(Number.isFinite));assert.ok(report.runtime.events.includes('caravanRing'));
 await p.evaluate(()=>{game.renderCap.tick=()=>true;document.getElementById('btnPause').click()});await p.clock.runFor(16);
 const snapshot=()=>p.evaluate(()=>Array.from(game.scene.getObjectByName('dayr-trail-salt-drift').geometry.attributes.position.array));
 const t0=await snapshot();await p.clock.runFor(1000);assert.deepEqual(await snapshot(),t0);await p.evaluate(()=>document.getElementById('btnResume').click());await p.clock.runFor(300);assert.notDeepEqual(await snapshot(),t0);report.pause=true;
 report.chain=await p.evaluate(()=>{const c=game.scene.getObjectByName('daraishi-shackle-chain'),T=game.THREE;const dir=new T.Vector3(0,-1,0).applyQuaternion(c.getWorldQuaternion(new T.Quaternion()));return {direction:dir.toArray(),links:c.children.length,finite:c.children.every(o=>o.matrixWorld.elements.every(Number.isFinite))}});
 assert.equal(report.chain.links,3);assert.ok(report.chain.finite);assert.ok(report.chain.direction[1]<-.999);
 report.transitions=await p.evaluate(()=>{
  const values=[];for(let i=0;i<7;i++){game.setStage('dayr');const gone=!game.scene.getObjectByName('dayr_night-story'),sunVisible=game.scene.getObjectByName('dayr-setting-sun').visible;game.setStage('dayr_night');const {geometries,textures,programs}=game.renderInfo();values.push({gone,sunVisible,roots:game.scene.children.filter(o=>o.name==='dayr_night-story').length,geometries,textures,programs})}return values;
 });assert.ok(report.transitions.every(v=>v.gone&&v.sunVisible&&v.roots===1));assert.deepEqual(report.transitions.at(-1),report.transitions[1]);
 await p.close();
 // Compile/render the original builder from before this change beside current
 // and compare full vertex/material/texture signatures, not just the file text.
 const q=await browser.newPage();await q.goto(source+'/night-encounters-6.html');
 report.dayPreservation=await q.evaluate(async old=>{
  const T=await import('/node_modules/three/build/three.module.js'),current=await import('/src/stage_dayr.js');
  const code=old.replaceAll("from 'three'",`from '${location.origin}/node_modules/three/build/three.module.js'`).replaceAll("from './",`from '${location.origin}/src/`),url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),previous=await import(url);URL.revokeObjectURL(url);
  async function signature(build){const scene=new T.Scene();build(scene,{hemi:new T.HemisphereLight(),sun:new T.DirectionalLight()});scene.updateMatrixWorld(true);const data=[];scene.traverse(o=>{if(!o.geometry)return;const m=o.material;data.push({name:o.name,matrix:o.matrixWorld.toArray(),attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,v])=>[k,Array.from(v.array)])),index:o.geometry.index?Array.from(o.geometry.index.array):null,material:{color:m.color?.getHex(),opacity:m.opacity,side:m.side,map:m.map?.image?.toDataURL?.()}})});const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)))),n=>n.toString(16).padStart(2,'0')).join('');const seen=new Set();scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!seen.has(m)){seen.add(m);for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose()}});return {hash,objects:data.length};}
  return {before:await signature(previous.buildDayr),after:await signature(current.buildDayr)};
 },fs.readFileSync(process.env.DAY_BEFORE,'utf8'));assert.deepEqual(report.dayPreservation.before,report.dayPreservation.after);
 report.audio=await q.evaluate(async()=>{const {Sound,makeRng}=await import('/src/sound.js'),{StageDetailSound,hasStageDetails}=await import('/src/stage_detail_sound.js');const c=new AudioContext();await c.resume();const s=new Sound();s.ctx=c;s.stage='dayr_night';s.master=c.createGain();s.master.gain.value=0;s.master.connect(c.destination);const d=new StageDetailSound(s,makeRng);s._stageDetails=d;const nodes=d.ambience().nodes.length,event=d.event({kind:'caravanRing',amp:.75});d.stopAmbient();d.stopVoices();await c.close();return {mapped:hasStageDetails('dayr_night'),nodes,event};});assert.ok(report.audio.mapped&&report.audio.nodes>0&&report.audio.event);
 await q.close();assert.deepEqual(report.errors,[]);report.pass=true;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,data:report.data,runtime:report.runtime,day:report.dayPreservation,audio:report.audio}));
}finally{await browser.close()}
