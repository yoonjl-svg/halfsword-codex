import assert from 'node:assert/strict';import fs from 'node:fs';
import {CHARACTERS_BY_ID as chars} from '../../../src/characters.js';
import {CHARACTERS_BY_ID as previous} from '/workspace/halfsword-current-baseline/src/characters.js';
import {newRound,DT,AI,THREE} from '../../../tools/sim/harness_m.mjs';
import {LOOK_ARCHIVE} from '../../../src/looks.js';
for(const[id,c]of Object.entries(previous))assert.deepEqual(chars[id],c,id);
assert.equal(chars.sebastian.name,'롤랑');assert.equal(chars.black_king.name,'올리비에');
const out={existingCharactersUnchanged:Object.keys(previous).length,models:[],fights:[]};
for(const id of ['sebastian','white_scale','black_king']){
 const c=chars[id],g=newRound({look:c.look,weapon:c.weapon,seed:37}),f=g.player;
 assert.equal(f.swordArt.tradition,id==='white_scale'?'japanese':'iberian');assert.equal(f.hasHelmet,id!=='black_king');
 assert.equal(Object.keys(f.plate).length,id==='white_scale'?11:13);
 const eyes=f.groups.head.children.slice(1,3).map(o=>{o.geometry.computeBoundingBox();return o.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(o.scale).toArray();});
 if(id==='black_king'){assert.equal(f.helmetGroup,undefined);for(const e of eyes){assert(Math.abs(e[1]-.015)<1e-7);assert(Math.abs(e[2]-.02)<1e-7);}}
 let triangles=0,meshes=0;
 for(const {group}of f.meshes)group.traverse(o=>{if(o.geometry){assert([...o.geometry.attributes.position.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes++;}});
 for(const part of Object.keys(f.plate))f.wearPlate(part,10000,new THREE.Vector3(1,0,0));assert(Object.values(f.plate).every(v=>v===0));g.world.free();
 out.models.push({id,name:c.name,eyes,meshes,triangles,plateCleanup:true,hasHelmet:id!=='black_king'});
 for(const seed of [51,52]){
  const g=newRound({seed,gap:2,weapon:'longsword',weapon2:c.weapon,look2:c.look,persona:c.ai.persona,difficulty:c.ai.level,AI2Class:AI});
  for(let i=0;i<12/DT;i++){g.step();for(const f of [g.player,g.enemy])for(const b of Object.values(f.bodies)){assert(Object.values(b.translation()).every(Number.isFinite));assert(Object.values(b.linvel()).every(Number.isFinite));}}
  out.fights.push({id,seed,hits:g.hits.length,clashes:g.clashes,seconds:12});g.world.free();
 }
}
// The eye reduction existed before the closed visor: 10 mm vs stock 15 mm.
const g=newRound({look:LOOK_ARCHIVE.black_king.v3,weapon:'tizona',seed:37}),o=g.player.groups.head.children[1];o.geometry.computeBoundingBox();out.previousEyeSize=o.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(o.scale).toArray();g.world.free();
fs.writeFileSync(new URL('./models.json',import.meta.url),JSON.stringify(out,null,2));console.log(out);
