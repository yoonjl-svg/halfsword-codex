import fs from 'node:fs';import assert from 'node:assert/strict';
import {CHARACTERS_BY_ID,CHARACTERS} from '../../../src/characters.js';import {LOOK_ARCHIVE} from '../../../src/looks.js';
import {newRound,DT,AI,THREE} from '../../../tools/sim/harness_m.mjs';import {captureVitalPose} from '../../../src/vital_target.js';
import {ARMOR} from '../../../src/config.js';
import {probeStrike} from './probe.mjs';
const old=JSON.parse(fs.readFileSync(new URL('./before.json',import.meta.url))),c=CHARACTERS_BY_ID.white_scale;
for(const[id,v]of Object.entries(old.characters))assert.deepEqual(CHARACTERS_BY_ID[id],v,id);
for(const[id,v]of Object.entries(old.looks))assert.deepEqual(LOOK_ARCHIVE[id],v,id);
assert.deepEqual(CHARACTERS.map(c=>c.id),old.rotation);assert.equal(c.weapon,'muramasa');assert.equal(c.ai.proficiency,3);assert.equal(c.ai.persona.proficiency.japanese,3);
const armor=[];
for(const variant of ['new','old'])for(const type of ['cut','stab'])for(const [spot,part,at]of [['brow','head',[.075,.05,0]],['face','head',[.075,-.035,0]],['chin','head',[.04,-.080,0]],['neck','chest',[.08,.135,0]]]){
 const look=variant==='new'?c.look:CHARACTERS_BY_ID.margarethe.look;
 const g=newRound({look,weapon:c.weapon,weapon2:'longsword',seed:31});const f=g.player;f.cacheState();g.enemy.cacheState();
 const r=probeStrike(g,g.enemy,f,part,new THREE.Vector3(...at),new THREE.Vector3(1,0,0),type==='cut'?60:40,type);
 assert(r);assert.equal(r.helmet,spot==='brow'||(variant==='new'&&spot==='face'),`${variant}/${type}/${spot}`);
 if(spot==='neck'||spot==='chin')assert.equal(r.zone,'neck'); // Existing head-local y < -.05 is the vulnerable neck band.
 armor.push({variant,type,spot,helmet:r.helmet,zone:r.zone,damage:r.type,severity:r.severity,integrity:f.helmetIntegrity});g.world.free();
}
const hornChecks=[];for(const side of [-1,1]){const g=newRound({look:c.look,weapon:c.weapon,seed:31}),f=g.player; {const helm=f.helmetGroup;const P=helm.userData.pieces;f.helmetIntegrity=.8;f.shedHelmet(ARMOR.helmets.kabuto_masked,{local:{z:.1*side},dir:new THREE.Vector3(1,0,0),energy:30});assert(!P[side>0?'hornR':'hornL']);assert(P[side>0?'hornL':'hornR']);f.helmetIntegrity=.4;f.shedHelmet(ARMOR.helmets.kabuto_masked,{local:{z:-.1*side},dir:new THREE.Vector3(1,0,0),energy:30});assert(!P.hornL);assert(!P.hornR);assert(!P.crest);}hornChecks.push({side,stages:2});g.world.free();}
const rounds=[];
for(const playerRole of [false,true])for(const seed of [41,42]){
 const opts={seed,gap:2,weapon:playerRole?c.weapon:'longsword',weapon2:playerRole?'longsword':c.weapon,look:playerRole?c.look:undefined,look2:playerRole?undefined:c.look,AI2Class:AI};
 if(playerRole){opts.persona2=c.ai.persona;opts.difficulty2=c.ai.level}else{opts.persona=c.ai.persona;opts.difficulty=c.ai.level}
 const g=newRound(opts),f=playerRole?g.player:g.enemy;
 assert.equal(f.swordArt.tradition,'japanese');assert.equal(Object.keys(f.plate).length,11);assert.equal(captureVitalPose(f).helmetMinY,-.116);
 let maxSpeed=0;
 for(let i=0;i<12/DT;i++){
  g.step();for(const b of Object.values(f.bodies)){const p=b.translation(),v=b.linvel();assert([...Object.values(p),...Object.values(v)].every(Number.isFinite));maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));}
 }
 f.syncMeshes();f.groups.head.updateWorldMatrix(true,true);
 const helm=f.helmetGroup;
 if(f.hasHelmet){
  for(const[y,z]of [[.016,-.035],[.016,.035],[-.015,0],[-.080,0]]){
   const origin=f.groups.head.localToWorld(new THREE.Vector3(1,y,z)),target=f.groups.head.localToWorld(new THREE.Vector3(0,y,z));
   const ray=new THREE.Raycaster(origin,target.sub(origin).normalize());const hit=ray.intersectObject(f.groups.head,true)[0];assert(hit);
   let o=hit.object;while(o&&o!==helm)o=o.parent;assert.equal(o,helm,'face sample must be hidden by helmet');
  }
 }
 let triangles=0;for(const{group}of f.meshes)group.traverse(o=>{if(o.geometry){const p=o.geometry.attributes.position;assert([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??p.count)/3;}});
 const lining=f.groups.chest.getObjectByName('white-scale-neck-lining');assert(lining);

 // Explicit damage cleanup: decorative horn pieces and armor must use native wear.
 if(f.hasHelmet)f.shatterHelmet(new THREE.Vector3(1,0,0),100);
 assert(!f.hasHelmet);assert.equal(helm.parent,null);
 for(const part of Object.keys(f.plate))if(f.plate[part]>0)f.wearPlate(part,10000,new THREE.Vector3(1,0,0));
 assert(Object.values(f.plate).every(v=>v===0));assert(lining.visible);
 for(let i=0;i<60;i++)g.step();
 rounds.push({playerRole,seed,maxSpeed,hits:g.hits.length,clashes:g.clashes,triangles,helmetCleanup:true,plateCleanup:true,liningRetained:true});g.world.free();
}
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify({existingCharacters:Object.keys(old.characters).length,unchangedRotation:old.rotation,armor,hornChecks,rounds},null,2));console.log({existingCharacters:Object.keys(old.characters).length,armorProbes:armor.length,rounds});
