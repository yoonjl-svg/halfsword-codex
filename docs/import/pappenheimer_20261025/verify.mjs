import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {WEAPONS,WEAPON_LIST,RETIRED_WEAPONS,TIER_DRAW,drawWeaponCards,weaponSpecText}from'../../../src/weapons.js';
import {weaponPhysics}from'../../../src/weapon_class.js';import{resolveSwordArt}from'../../../src/sword_art.js';
import{CHARACTERS_BY_ID}from'../../../src/characters.js';import{newRound,DT,CONFIG,AI}from'../../../tools/sim/harness_m.mjs';
import{PlayerParryGuard}from'../../../src/parry_button.js';import{TECH_BY_NAME}from'../../../src/ai_techniques.js';
const before=JSON.parse(fs.readFileSync(new URL('./before.json',import.meta.url))),w=WEAPONS.pappenheimer;
for(const[id,old]of Object.entries(before.weapons))assert.deepEqual(JSON.parse(JSON.stringify({...WEAPONS[id],parts:WEAPONS[id].buildParts({grip:0xaaaaaa,hilt:0x888888})})),old,id);
assert.deepEqual(JSON.parse(JSON.stringify(CHARACTERS_BY_ID)),before.characters);
const physics=Object.fromEntries(['rapier','pappenheimer','dartagnan','balisarda'].map(id=>[id,{...weaponPhysics(WEAPONS[id]),text:weaponSpecText(WEAPONS[id])}]));
assert.equal(w.tier,'rare');assert.equal(w.power,1.05);assert.equal(w.fragility,.032);assert(Math.abs(physics.pappenheimer.mass-1.34)<1e-10);assert.equal(w.bladeLength,.892);
assert(!w.ability&&!w.ignoreArmor);const art=resolveSwordArt(w),rapierArt=resolveSwordArt(WEAPONS.rapier);
assert.equal(art.tradition,'italian');for(const key of['grip','offArm','parry','motion'])assert.deepEqual(art[key],rapierArt[key],key);
const bounds=new THREE.Box3(),geometry=[];let triangles=0,meshes=0;
for(const[i,[shape,y,,color,isBlade]]of w.buildParts({}).entries()){
 if(color==null)continue;const root=w.partMesh(i,isBlade,shape,color,{}, {},w.tier);root.position.y=y;root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root));
 root.traverse(m=>{if(!m.isMesh)return;assert([...m.geometry.attributes.position.array].every(Number.isFinite));meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
 if(isBlade){const b=new THREE.Box3().setFromObject(root);assert(Math.abs(b.max.y-b.min.y-.892)<.001);geometry.push({bladeLength:b.max.y-b.min.y});}
}
assert(Math.abs(bounds.max.y-bounds.min.y-1.111)<.001);assert(bounds.max.x-bounds.min.x<=.214);
CONFIG.ARENA.startHold=0;class Quiet{update(){}}
const actions=[];
for(const action of['cut','thrust','guard','ai']){
 const g=newRound({weapon:'pappenheimer',weapon2:'rapier',gap:1.8,seed:7,AIClass:['guard','ai'].includes(action)?AI:Quiet,...(action==='ai'?{AI2Class:AI}:{})}),p=g.player;
 assert(p.bladeMesh.isMesh);p.bloodyBlade(.1);assert(p.bladeBlood>0);const guard=new PlayerParryGuard(p,g.enemy);p.stamina.controller=guard;
 let active=action==='ai',started=false,travel=0,previous=p.bladePoint(1).clone();const tech=TECH_BY_NAME.zornhau;
 g.before=t=>{if(action==='ai')return;if(action==='guard'){guard.held=t<2;active=guard.step(DT)||active;return;}if(t<.5){p.handOffset.set(...tech.from);return;}if(!started){started=true;if(action==='thrust')active=p.skill.thrust();}if(action==='cut'){const u=Math.min(1,(t-.5)/.35),n=u<.5?0:1,v=u<.5?u*2:(u-.5)*2,pts=[tech.from,...tech.path],a=pts[n],b=pts[n+1];p.handOffset.set(a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v);p.inputActive=true;active=true;}};
 for(let i=0;i<3/DT;i++){g.step();const tip=p.bladePoint(1);assert([tip.x,tip.y,tip.z,...Object.values(p.sword.linvel())].every(Number.isFinite));travel+=tip.distanceTo(previous);previous=tip.clone();}
 assert(active&&travel>.1);assert(Math.abs(p.stamina.originalMass-1.34)<1e-6);actions.push({action,active,travel,clashes:g.clashes,stamina:p.stamina.value,mass:p.stamina.originalMass});
 if(action==='thrust'){p.breakWeapon();assert(p.weaponBroken);assert(Math.abs(p.stamina.originalMass-1.34)<1e-6);actions.at(-1).breakage=true;}
 g.world.free();
}
// Exhaustive two-card paths are appended below; test actual drawWeaponCards.

// Enumerate the actual two-card draw paths, with no learned letter modifiers.
const pool=WEAPON_LIST.filter(w=>w.id!=='excalibur_replica'&&!RETIRED_WEAPONS.has(w.id)&&!w.characterOnly).map(w=>w.id);
function choices(ids){const tiers={};for(const id of ids){const w=WEAPONS[id];(tiers[w.tier]??=new Map()).set(w.drawGroup||id,[]);}for(const id of ids){const w=WEAPONS[id];tiers[w.tier].get(w.drawGroup||id).push(id);}const sum=Object.keys(tiers).reduce((s,t)=>s+TIER_DRAW[t],0);let prev=0;const all=[];for(const[tier,groups]of Object.entries(tiers)){const tr=(prev+TIER_DRAW[tier]/2)/sum;prev+=TIER_DRAW[tier];let j=0;for(const[group,members]of groups){for(let k=0;k<members.length;k++)all.push({id:members[k],group,p:TIER_DRAW[tier]/sum/groups.size/members.length,r:[tr,(j+.5)/groups.size,...(members.length>1?[(k+.5)/members.length]:[])]});j++;}}return all;}
const first={},any={};let total=0,paths=0;for(const a of choices(pool))for(const b of choices(pool.filter(id=>(WEAPONS[id].drawGroup||id)!==a.group))){const r=[...a.r,...b.r];assert.deepEqual(drawWeaponCards(pool,2,{rnd:()=>r.shift()}),[a.id,b.id]);const p=a.p*b.p;first[a.id]=(first[a.id]||0)+p;for(const id of[a.id,b.id])any[id]=(any[id]||0)+p;total+=p;paths++;}assert(Math.abs(total-1)<1e-10);assert(first.pappenheimer>0);

const result={existingWeaponsUnchanged:Object.keys(before.weapons).length,allCharactersUnchanged:true,physics,geometry,bounds:{min:bounds.min,max:bounds.max},triangles,meshes,actions,draw:{paths,total,first:first.pappenheimer,atLeastOne:any.pappenheimer}};fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
