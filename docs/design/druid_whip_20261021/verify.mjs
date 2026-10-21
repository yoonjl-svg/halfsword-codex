import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEAPONS,WEAPON_LIST,weaponSpecText,drawWeaponCards,TIER_DRAW,RETIRED_WEAPONS} from '../../../src/weapons.js';
import {newRound,DT,AI,CONFIG} from '../../../tools/sim/harness_m.mjs';
import {TECH_BY_NAME} from '../../../src/ai_techniques.js';
const before=JSON.parse(fs.readFileSync(new URL('./before.json',import.meta.url)));
for(const[id,old]of Object.entries(before))assert.deepEqual(JSON.parse(JSON.stringify({...WEAPONS[id],parts:WEAPONS[id].buildParts({grip:0xaaaaaa,hilt:0x888888})})),old,id);
const w=WEAPONS.druid_whip;assert.equal(w.tier,'mystery');assert.equal(w.power,1);assert.equal(w.school,'none');assert.equal(w.edged,false);
assert(Math.abs(w.buildParts({}).reduce((s,p)=>s+p[2][0],0)-.65)<1e-10);
CONFIG.ARENA.startHold=0;class Quiet{update(){}}
const rows=[];
for(const mode of ['rest','stroke','ai','both']){
 const g=newRound({weapon:'druid_whip',weapon2:mode==='both'?'druid_whip':'tree_branch',gap:1.35,seed:11,AIClass:mode==='rest'?Quiet:AI,AI2Class:mode==='ai'||mode==='both'?AI:Quiet});
 const f=g.player;let maxGap=0,maxSpeed=0,maxBend=0;const first=f.bladePoint(1).clone();
 g.before=t=>{if(mode!=='stroke')return;const tech=TECH_BY_NAME.zornhau,phase=t%1.6;const points=[tech.from,...tech.path];const u=Math.min(1,Math.max(0,(phase-.5)/.35)),i=u<.5?0:1,v=u<.5?u*2:(u-.5)*2;f.handOffset.set(points[i][0]+(points[i+1][0]-points[i][0])*v,points[i][1]+(points[i+1][1]-points[i][1])*v);f.inputActive=phase>=.5&&phase<.9;};
 for(let i=0;i<12/DT;i++){
  g.step();const x=f.flexWeapon;
  for(let j=0;j<x.active;j++){
   const s=x.segments[j],p=s.body.translation(),v=s.body.linvel();assert([...Object.values(p),...Object.values(v)].every(Number.isFinite));maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));
   const a=new THREE.Vector3(0,-x.L/2,0).applyQuaternion(new THREE.Quaternion().copy(s.body.rotation())).add(new THREE.Vector3().copy(p));
   const prev=j?x.segments[j-1].body:f.sword;
   const b=new THREE.Vector3(0,j?x.L/2:.13,0).applyQuaternion(new THREE.Quaternion().copy(prev.rotation())).add(new THREE.Vector3().copy(prev.translation()));maxGap=Math.max(maxGap,a.distanceTo(b));
  }
  const straight=new THREE.Vector3(0,.13+w.bladeLength,0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation())).add(new THREE.Vector3().copy(f.sword.translation()));maxBend=Math.max(maxBend,straight.distanceTo(f.bladePoint(1)));
 }
 assert(maxGap<.03,`${mode} joint gap ${maxGap}`);assert(maxSpeed<30,`${mode} speed ${maxSpeed}`);assert(maxBend>.1);assert(Math.abs(f.stamina.originalMass-.65)<1e-6);
 f.syncMeshes();assert([...f.bladeMesh.geometry.attributes.position.array].every(Number.isFinite));
 const massBefore=f.stamina.originalMass;f.breakWeapon();assert.equal(f.flexWeapon.active,4);assert.equal(f.weaponCfg.bladeLength,.72);
 for(const s of f.flexWeapon.segments.slice(4)){assert(s.info.detached);assert.equal(s.col.collisionGroups(),0);}
 for(let i=0;i<7/DT;i++)g.step();f.syncMeshes();assert(f.flexWeapon.tailExpired);assert.equal(f.flexWeapon.tail.visible,false);assert.equal(f.stamina.originalMass,massBefore);
 rows.push({mode,maxGap,maxSpeed,maxBend,travel:first.distanceTo(f.bladePoint(1)),hits:g.hits,clashes:g.clashes,broken:true,staminaMass:massBefore});g.world.free();
}
// Exact enumeration of the first card's tier/group slots (no Monte Carlo).
const pool=WEAPON_LIST.filter(w=>w.id!=='excalibur_replica'&&!RETIRED_WEAPONS.has(w.id)&&!w.characterOnly).map(w=>w.id);
const mystery=pool.filter(id=>WEAPONS[id].tier==='mystery');assert.equal(mystery.length,3);
const result={existingWeaponsUnchanged:Object.keys(before).length,spec:weaponSpecText(w),mysteryPool:mystery,firstCardProbability:TIER_DRAW.mystery/100/mystery.length,rows,scope:'Physics stability, live contact, original mass after break and regressions; not human balance acceptance.'};
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
