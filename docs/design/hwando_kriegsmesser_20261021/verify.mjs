import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, TIER_DRAW, drawWeaponCards, weaponSpecText} from '../../../src/weapons.js';
import {weaponPhysics, classifyFrame} from '../../../src/weapon_class.js';
import {resolveSwordArt} from '../../../src/sword_art.js';
import {newRound, DT, CONFIG, AI} from '../../../tools/sim/harness_m.mjs';
import {PlayerParryGuard} from '../../../src/parry_button.js';
import {TECH_BY_NAME} from '../../../src/ai_techniques.js';
const physics={};
for(const id of ['longsword','kriegsmesser','hwando'])physics[id]={...weaponPhysics(WEAPONS[id]),text:weaponSpecText(WEAPONS[id])};
assert(Math.abs(physics.kriegsmesser.mass-1.65)<1e-9);
assert(Math.abs(physics.hwando.mass-.9)<1e-9);
assert(physics.kriegsmesser.I/physics.longsword.I<1.1);
assert.equal(classifyFrame({...WEAPONS.kriegsmesser,frame:null}),'two');
for(const [id,school,base,tier] of [['hwando','chinese','qinggang','common'],['kriegsmesser','german','longsword','rare']]){
 const w=WEAPONS[id], a=resolveSwordArt(w), b=resolveSwordArt(WEAPONS[base]);
 assert.equal(w.tier,tier);assert.equal(a.tradition,school);
 for(const key of ['table','grip','offArm','parry','motion'])assert.deepEqual(a[key],b[key],id+'/'+key);
 assert(a.measure.reach>a.measure.contact);assert(w.breakChance(6)>0);
 if(w.twoHand){const p=w.buildParts()[0];for(const y of [0,w.gripAlong])assert(Math.abs(y-p[1])<=p[0][2]);}
}
CONFIG.ARENA.startHold=0;
class Quiet {update(){}}
const actions=[];
for(const weapon of ['hwando','kriegsmesser'])for(const action of ['cut','thrust','guard','ai']){
 const g=newRound({weapon,weapon2:'longsword',gap:1.8,seed:7,AIClass:['guard','ai'].includes(action)?AI:Quiet,...(action==='ai'?{AI2Class:AI}:{})});
 const p=g.player,guard=new PlayerParryGuard(p,g.enemy);p.stamina.controller=guard;
 let active=action==='ai',started=false,travel=0,previous=p.bladePoint(1).clone();const tech=TECH_BY_NAME.zornhau;
 g.before=t=>{
  if(action==='ai')return;
  if(action==='guard'){guard.held=t<2;active=guard.step(DT)||active;return;}
  if(t<.5){p.handOffset.set(...tech.from);return;}
  if(!started){started=true;if(action==='thrust')active=p.skill.thrust();}
  if(action==='cut'){const u=Math.min(1,(t-.5)/.35),n=u<.5?0:1,v=u<.5?u*2:(u-.5)*2,pts=[tech.from,...tech.path],a=pts[n],b=pts[n+1];p.handOffset.set(a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v);p.inputActive=true;active=true;}
 };
 for(let i=0;i<3/DT;i++){g.step();const tip=p.bladePoint(1);assert([tip.x,tip.y,tip.z,...Object.values(p.sword.linvel())].every(Number.isFinite));travel+=tip.distanceTo(previous);previous=tip.clone();}
 assert(active);assert(travel>.1);assert(Math.abs(p.stamina.originalMass-physics[weapon].mass)<1e-6);
 actions.push({weapon,action,active,travel,clashes:g.clashes,stamina:p.stamina.value,mass:p.stamina.originalMass});g.world.free();
}
// Exhaust every ordered draw-group path with the real draw function; no random Monte Carlo.
const pool=WEAPON_LIST.filter(w=>w.id!=='excalibur_replica'&&!RETIRED_WEAPONS.has(w.id)&&!w.characterOnly).map(w=>w.id);
function choices(ids){const tiers={};for(const id of ids){const w=WEAPONS[id];(tiers[w.tier]??=new Map()).set(w.drawGroup||id,[]);}for(const id of ids){const w=WEAPONS[id];tiers[w.tier].get(w.drawGroup||id).push(id);}const sum=Object.keys(tiers).reduce((s,t)=>s+TIER_DRAW[t],0);let prev=0;const all=[];for(const [tier,groups] of Object.entries(tiers)){const tr=(prev+TIER_DRAW[tier]/2)/sum;prev+=TIER_DRAW[tier];let j=0;for(const [group,members] of groups){for(let k=0;k<members.length;k++)all.push({id:members[k],group,p:TIER_DRAW[tier]/sum/groups.size/members.length,r:[tr,(j+.5)/groups.size,...(members.length>1?[(k+.5)/members.length]:[])]});j++;}}return all;}
const first={},any={};let total=0,paths=0;
for(const a of choices(pool))for(const b of choices(pool.filter(id=>(WEAPONS[id].drawGroup||id)!==a.group))){const r=[...a.r,...b.r];assert.deepEqual(drawWeaponCards(pool,2,{rnd:()=>r.shift()}),[a.id,b.id]);const p=a.p*b.p;first[a.id]=(first[a.id]||0)+p;for(const id of [a.id,b.id])any[id]=(any[id]||0)+p;total+=p;paths++;}
assert(Math.abs(total-1)<1e-10);assert(Math.abs(first.hwando-.08)<1e-10);assert(Math.abs(first.kriegsmesser-.0675)<1e-10);
const result={physics,inertiaRatio:physics.kriegsmesser.I/physics.longsword.I,actions,draw:{paths,total,pool:pool.length,first,any},limitations:'Compatibility/finite-state checks and exact draw enumeration; not a balance win-rate or human-feel study.'};
fs.writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({physics,actions:actions.length,paths,first:{hwando:first.hwando,kriegsmesser:first.kriegsmesser}}));
