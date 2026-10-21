import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {CHARACTERS_BY_ID as chars,CHARACTERS} from '../../../src/characters.js';import {LOOK_ARCHIVE} from '../../../src/looks.js';import {ARMOR} from '../../../src/config.js';
import {newRound,DT,AI,THREE} from '../../../tools/sim/harness_m.mjs';import {probeStrike} from '../white_scale_samurai_20261022/probe.mjs';
const oldRoot=process.env.OLD_SOURCE||'/workspace/halfsword-warrior-refine';
const old=await import(pathToFileURL(oldRoot+'/src/characters.js')),looks=await import(pathToFileURL(oldRoot+'/src/looks.js')),config=await import(pathToFileURL(oldRoot+'/src/config.js'));
for(const [id,c]of Object.entries(old.CHARACTERS_BY_ID))assert.deepEqual(chars[id],c,id);
for(const [id,c]of Object.entries(looks.LOOK_ARCHIVE))assert.deepEqual(LOOK_ARCHIVE[id],c,id);
assert.deepEqual(CHARACTERS.map(c=>c.id),old.CHARACTERS.map(c=>c.id));
for(const[id,h]of Object.entries(config.ARMOR.helmets))assert.deepEqual(ARMOR.helmets[id],h,id);
const out={existingCharactersUnchanged:Object.keys(old.CHARACTERS_BY_ID).length,journeyUnchanged:true,existingLooksUnchanged:true,existingHelmetsUnchanged:true,models:[],probes:[],rounds:[],shoulderPoints:[]};
const oldBoxes=JSON.parse(fs.readFileSync(new URL('../sebastian_shoulder_structure_20261022/before-armor.json',import.meta.url)));
for(const id of ['bernardo','black_king','sebastian']){
 const c=chars[id],g=newRound({look:c.look,weapon:c.weapon,seed:31}),f=g.player;
 assert.equal(f.swordArt.tradition,'iberian');assert.equal(Object.keys(f.plate).length,13);
 if(id==='sebastian'){
  const boxes=Object.fromEntries(Object.entries(f.plateBoxes).map(([k,b])=>[k,{partial:b.partial,list:b.list.map(v=>({min:v.box.min.toArray(),max:v.box.max.toArray()}))}]));assert.deepEqual(boxes,oldBoxes.boxes);assert.deepEqual(f.plate,oldBoxes.plate);
  for(const part of ['uarmS','uarmO']){const point=f.groups[part].getObjectByName('royal-shoulder-simple-point');assert(point);assert(!f.groups[part].getObjectByName('royal-shoulder-lion'));assert(!f.groups[part].getObjectByName('royal-shoulder-upright-wing'));const cap=point.parent;assert(f.plateBoxes[part].list.some(b=>b.mesh===cap));point.geometry.computeBoundingBox();cap.geometry.computeBoundingBox();const rise=point.geometry.boundingBox.max.y-cap.geometry.boundingBox.max.y;assert(rise>.03&&rise<.06);const parent=cap.parent;f.wearPlate(part,10000,new THREE.Vector3(1,0,0));assert.equal(point.parent,cap);assert.notEqual(cap.parent,parent);out.shoulderPoints.push({part,rise,attachedToPlate:true,breaksWithPlate:true});}
 }else{
  assert.deepEqual(c.ai,chars.sebastian.ai);assert.equal(c.weapon,'tizona');assert.equal(f.helmetType,'royal_open');
  const h=f.helmetGroup;f.helmetIntegrity=.4;f.shedHelmet(ARMOR.helmets.royal_open,{local:{z:.1},dir:new THREE.Vector3(1,0,0),energy:30});assert(!h.userData.pieces.crest);f.shatterHelmet(new THREE.Vector3(1,0,0),100);assert(!f.hasHelmet);assert.equal(h.parent,null);
 }
 let triangles=0,meshes=0;for(const{group}of f.meshes)group.traverse(o=>{if(o.geometry){const p=o.geometry.attributes.position;assert([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??p.count)/3;meshes++;}});
 out.models.push({id,triangles,meshes,plates:Object.keys(f.plate).length});g.world.free();
}
for(const id of ['bernardo','black_king'])for(const type of ['cut','stab'])for(const[spot,y]of [['brow',.05],['face',-.035],['chin',-.08]]){
 const c=chars[id],g=newRound({look:c.look,weapon:c.weapon,weapon2:'longsword',seed:31}),f=g.player;f.cacheState();g.enemy.cacheState();const r=probeStrike(g,g.enemy,f,'head',new THREE.Vector3(.075,y,0),new THREE.Vector3(1,0,0),type==='cut'?60:40,type);assert(r);assert.equal(r.helmet,spot==='brow',`${id}/${type}/${spot}`);if(spot==='chin')assert.equal(r.zone,'neck');out.probes.push({id,type,spot,helmet:r.helmet,zone:r.zone});g.world.free();
}
for(const id of ['bernardo','black_king'])for(const playerRole of [false,true])for(const seed of [41,42]){
 const c=chars[id],opts={seed,gap:2,weapon:playerRole?c.weapon:'longsword',weapon2:playerRole?'longsword':c.weapon,look:playerRole?c.look:undefined,look2:playerRole?undefined:c.look,AI2Class:AI};if(playerRole){opts.persona2=c.ai.persona;opts.difficulty2=c.ai.level}else{opts.persona=c.ai.persona;opts.difficulty=c.ai.level}
 const g=newRound(opts),f=playerRole?g.player:g.enemy;let maxSpeed=0;
 for(let i=0;i<12/DT;i++){g.step();for(const b of Object.values(f.bodies)){const p=b.translation(),v=b.linvel();assert([...Object.values(p),...Object.values(v)].every(Number.isFinite));maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));}}
 if(f.hasHelmet)f.shatterHelmet(new THREE.Vector3(1,0,0),100);for(const part of Object.keys(f.plate))if(f.plate[part]>0)f.wearPlate(part,10000,new THREE.Vector3(1,0,0));assert(Object.values(f.plate).every(v=>v===0));for(let i=0;i<60;i++)g.step();out.rounds.push({id,playerRole,seed,maxSpeed,hits:g.hits.length,clashes:g.clashes,helmetCleanup:!f.hasHelmet,plateCleanup:true});g.world.free();
}
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(out);
