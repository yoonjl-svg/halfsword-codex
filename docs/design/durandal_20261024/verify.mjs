import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {WEAPONS,WEAPON_LIST,RETIRED_WEAPONS,TIER_DRAW,drawWeaponCards,weaponSpecText} from '../../../src/weapons.js';
import {weaponPhysics} from '../../../src/weapon_class.js';import{resolveSwordArt}from'../../../src/sword_art.js';import{AURA_PROFILES}from'../../../src/aura.js';
import{CHARACTERS_BY_ID}from'../../../src/characters.js';import{newRound,DT,CONFIG,AI}from'../../../tools/sim/harness_m.mjs';import{PlayerParryGuard}from'../../../src/parry_button.js';import{TECH_BY_NAME}from'../../../src/ai_techniques.js';
const before=JSON.parse(fs.readFileSync(new URL('./before.json',import.meta.url))),w=WEAPONS.durandal;
for(const[id,old]of Object.entries(before.weapons))assert.deepEqual(JSON.parse(JSON.stringify({...WEAPONS[id],parts:WEAPONS[id].buildParts({grip:0xaaaaaa,hilt:0x888888})})),old,id);
for(const[id,old]of Object.entries(before.characters))if(id!=='roland')assert.deepEqual(JSON.parse(JSON.stringify(CHARACTERS_BY_ID[id])),old,id);
const physics=Object.fromEntries(['durandal','zweihander','tizona'].map(id=>[id,{...weaponPhysics(WEAPONS[id]),text:weaponSpecText(WEAPONS[id])}]));
assert.equal(w.tier,'legend');assert.equal(w.power,1.2);assert.equal(w.fragility,0);assert.equal(w.breakChance(100000),0);assert.equal(w.bladeLength,1.159);assert(Math.abs(physics.durandal.mass-2.2)<1e-9);assert(physics.durandal.I<physics.zweihander.I);assert.equal(w.gripAlong,-.22);assert(physics.durandal.text.includes('155 cm'));
assert.equal(CHARACTERS_BY_ID.roland.weapon,'durandal');assert.equal(CHARACTERS_BY_ID.roland.ai.persona.school,'durandal');assert(AURA_PROFILES.durandal);assert(!w.awe&&!w.ignoreArmor);
const art=resolveSwordArt(w),base=resolveSwordArt(WEAPONS.zweihander);assert.equal(art.tradition,'iberian');for(const key of['table','grip','offArm','parry','motion'])assert.deepEqual(art[key],base[key],key);
for(const y of[0,w.gripAlong]){const p=w.buildParts({})[0];assert(Math.abs(y-p[1])<=p[0][2]);}
let triangles=0,meshes=0;const geometry=[];
for(const[i,[shape,y,,color,blade]]of w.buildParts({}).entries()){
 const root=w.partMesh(i,blade,shape,color,{}, {},w.tier);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);const h=shape[0]==='box'?shape.slice(1):Array(3).fill(shape[1]);
 const overshoot=Math.max(0,...['x','y','z'].flatMap((axis,j)=>[box.max[axis]-h[j],-h[j]-box.min[axis]]));assert(overshoot<.001,[i,overshoot]);
 root.traverse(m=>{if(!m.isMesh)return;assert([...m.geometry.attributes.position.array].every(Number.isFinite));meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});geometry.push({part:i,maxVisualOvershootMeters:overshoot});
}
CONFIG.ARENA.startHold=0;class Quiet{update(){}}
const actions=[];
for(const action of['cut','thrust','guard','ai']){
 const g=newRound({weapon:'durandal',weapon2:'longsword',gap:1.8,seed:7,AIClass:['guard','ai'].includes(action)?AI:Quiet,...(action==='ai'?{AI2Class:AI}:{})}),p=g.player;
 assert(p.bladeMesh.isMesh);p.bloodyBlade(.1);assert(p.bladeBlood>0);const guard=new PlayerParryGuard(p,g.enemy);p.stamina.controller=guard;
 let active=action==='ai',started=false,travel=0,previous=p.bladePoint(1).clone();const tech=TECH_BY_NAME.zornhau;
 g.before=t=>{if(action==='ai')return;if(action==='guard'){guard.held=t<2;active=guard.step(DT)||active;return;}if(t<.5){p.handOffset.set(...tech.from);return;}if(!started){started=true;if(action==='thrust')active=p.skill.thrust();}if(action==='cut'){const u=Math.min(1,(t-.5)/.35),n=u<.5?0:1,v=u<.5?u*2:(u-.5)*2,pts=[tech.from,...tech.path],a=pts[n],b=pts[n+1];p.handOffset.set(a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v);p.inputActive=true;active=true;}};
 for(let i=0;i<3/DT;i++){g.step();const tip=p.bladePoint(1);assert([tip.x,tip.y,tip.z,...Object.values(p.sword.linvel())].every(Number.isFinite));travel+=tip.distanceTo(previous);previous=tip.clone();}
 assert(active&&travel>.1);assert(!p.weaponBroken);assert(Math.abs(p.stamina.originalMass-2.2)<1e-6);actions.push({action,active,travel,clashes:g.clashes,stamina:p.stamina.value,mass:p.stamina.originalMass});g.world.free();
}
// Enumerate the actual two-card draw paths, with no learned letter modifiers.
const pool=WEAPON_LIST.filter(w=>w.id!=='excalibur_replica'&&!RETIRED_WEAPONS.has(w.id)&&!w.characterOnly).map(w=>w.id);
function choices(ids){const tiers={};for(const id of ids){const w=WEAPONS[id];(tiers[w.tier]??=new Map()).set(w.drawGroup||id,[]);}for(const id of ids){const w=WEAPONS[id];tiers[w.tier].get(w.drawGroup||id).push(id);}const sum=Object.keys(tiers).reduce((s,t)=>s+TIER_DRAW[t],0);let prev=0;const all=[];for(const[tier,groups]of Object.entries(tiers)){const tr=(prev+TIER_DRAW[tier]/2)/sum;prev+=TIER_DRAW[tier];let j=0;for(const[group,members]of groups){for(let k=0;k<members.length;k++)all.push({id:members[k],group,p:TIER_DRAW[tier]/sum/groups.size/members.length,r:[tr,(j+.5)/groups.size,...(members.length>1?[(k+.5)/members.length]:[])]});j++;}}return all;}
const first={},any={};let total=0,paths=0;for(const a of choices(pool))for(const b of choices(pool.filter(id=>(WEAPONS[id].drawGroup||id)!==a.group))){const r=[...a.r,...b.r];assert.deepEqual(drawWeaponCards(pool,2,{rnd:()=>r.shift()}),[a.id,b.id]);const p=a.p*b.p;first[a.id]=(first[a.id]||0)+p;for(const id of[a.id,b.id])any[id]=(any[id]||0)+p;total+=p;paths++;}assert(Math.abs(total-1)<1e-10);assert(first.durandal>0);
const result={existingWeaponsUnchanged:Object.keys(before.weapons).length,existingCharactersPreservedExceptRoland:true,physics,actions,geometry,meshes,triangles,draw:{paths,total,pool:pool.length,firstDurandal:first.durandal,atLeastOneDurandal:any.durandal},limitations:'Finite motion/registration and geometry tests; not a human balance verdict. Forced debug breakWeapon bypasses rarity just as other legends do; normal collision break chance is zero.'};
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
