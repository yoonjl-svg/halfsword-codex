import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {CHARACTERS_BY_ID as chars,CHARACTERS} from '../../../src/characters.js';
import {LOOK_ARCHIVE} from '../../../src/looks.js';import {ARMOR} from '../../../src/config.js';
import {newRound,DT,AI,THREE} from '../../../tools/sim/harness_m.mjs';
import {probeStrike} from '../white_scale_samurai_20261022/probe.mjs';
const oldRoot=process.env.OLD_SOURCE||'/workspace/halfsword-wander';
const old=await import(pathToFileURL(oldRoot+'/src/characters.js')),looks=await import(pathToFileURL(oldRoot+'/src/looks.js'));
for(const[id,c]of Object.entries(old.CHARACTERS_BY_ID))if(id!=='black_king')assert.deepEqual(chars[id],c,id);
for(const[id,c]of Object.entries(looks.LOOK_ARCHIVE))if(id!=='black_king')assert.deepEqual(LOOK_ARCHIVE[id],c,id);
assert.deepEqual(LOOK_ARCHIVE.black_king.v1,looks.LOOK_ARCHIVE.black_king.v1);
assert.deepEqual(CHARACTERS.map(c=>c.id),old.CHARACTERS.map(c=>c.id));
const omit=c=>Object.fromEntries(Object.entries(c).filter(([k])=>!['look','lookVersion','backstory'].includes(k)));
assert.deepEqual(omit(chars.black_king),omit(old.CHARACTERS_BY_ID.black_king));
const out={otherCharactersUnchanged:Object.keys(chars).length-1,combatAndRosterUnchanged:true,oldLookPreserved:true,models:[],probes:[],rounds:[]};
const boxes=f=>Object.fromEntries(Object.entries(f.plateBoxes).map(([k,b])=>[k,{partial:b.partial,list:b.list.map(v=>({min:v.box.min.toArray(),max:v.box.max.toArray()}))}]));
let oldBoxes,oldPlates;
for(const version of ['v1','v2']){
 const g=newRound({look:LOOK_ARCHIVE.black_king[version],weapon:'tizona',seed:31}),f=g.player;
 assert.equal(f.swordArt.tradition,'iberian');assert.equal(Object.keys(f.plate).length,13);assert.equal(f.helmetType,'royal_open');
 if(version==='v1'){oldBoxes=boxes(f);oldPlates=structuredClone(f.plate)}else{assert.deepEqual(boxes(f),oldBoxes);assert.deepEqual(f.plate,oldPlates);out.exactArmorBoundsUnchanged=true;}
 let triangles=0,meshes=0;for(const {group}of f.meshes)group.traverse(o=>{if(o.geometry){const p=o.geometry.attributes.position;assert([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??p.count)/3;meshes++;}});
 out.models.push({version,triangles,meshes});
 const h=f.helmetGroup;f.helmetIntegrity=.4;f.shedHelmet(ARMOR.helmets.royal_open,{local:{z:.1},dir:new THREE.Vector3(1,0,0),energy:30});assert(!h.userData.pieces.crest);f.shatterHelmet(new THREE.Vector3(1,0,0),100);assert(!f.hasHelmet);assert.equal(h.parent,null);
 for(const part of Object.keys(f.plate))f.wearPlate(part,10000,new THREE.Vector3(1,0,0));assert(Object.values(f.plate).every(v=>v===0));
 g.world.free();
}
for(const type of ['cut','stab'])for(const[spot,y]of [['brow',.05],['face',-.035],['chin',-.08]]){
 const g=newRound({look:chars.black_king.look,weapon:'tizona',weapon2:'longsword',seed:31}),f=g.player;f.cacheState();g.enemy.cacheState();
 const r=probeStrike(g,g.enemy,f,'head',new THREE.Vector3(.075,y,0),new THREE.Vector3(1,0,0),type==='cut'?60:40,type);assert(r);assert.equal(r.helmet,spot==='brow');if(spot==='chin')assert.equal(r.zone,'neck');out.probes.push({type,spot,helmet:r.helmet,zone:r.zone});g.world.free();
}
for(const playerRole of [false,true])for(const seed of [41,42]){
 const c=chars.black_king,opts={seed,gap:2,weapon:playerRole?c.weapon:'longsword',weapon2:playerRole?'longsword':c.weapon,look:playerRole?c.look:undefined,look2:playerRole?undefined:c.look,AI2Class:AI};
 if(playerRole){opts.persona2=c.ai.persona;opts.difficulty2=c.ai.level}else{opts.persona=c.ai.persona;opts.difficulty=c.ai.level}
 const g=newRound(opts),f=playerRole?g.player:g.enemy;let maxSpeed=0;
 for(let i=0;i<12/DT;i++){g.step();for(const b of Object.values(f.bodies)){const p=b.translation(),v=b.linvel();assert([...Object.values(p),...Object.values(v)].every(Number.isFinite));maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));}}
 if(f.hasHelmet)f.shatterHelmet(new THREE.Vector3(1,0,0),100);for(const part of Object.keys(f.plate))if(f.plate[part]>0)f.wearPlate(part,10000,new THREE.Vector3(1,0,0));assert(Object.values(f.plate).every(v=>v===0));for(let i=0;i<60;i++)g.step();
 out.rounds.push({playerRole,seed,maxSpeed,hits:g.hits.length,clashes:g.clashes,helmetCleanup:!f.hasHelmet,plateCleanup:true});g.world.free();
}
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(out);
