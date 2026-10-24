import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import * as T from 'three';
import { Fighter } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { CHARACTERS_BY_ID as C } from '../../src/characters.js';
import { Particles } from '../../src/effects.js';
import { bloodPalette } from '../../src/blood_palette.js';
import { createDecapFx } from '../../src/decap_fx.js';
import { createLimbFx } from '../../src/limb_fx.js';
import { Sound } from '../../src/sound.js';
await RAPIER.init();
const setup=(id,fn)=>{const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new T.Scene();const f=new Fighter(RAPIER,world,scene,new Map(),{index:0,x:0,heading:0,look:LOOKS.player,weapon:'longsword',physiology:C[id]?.physiology});try{fn(f,scene);}finally{world.free();}};
const wound=(props={})=>({zone:'torso',part:'chest',type:'stab',severity:.8,energy:120,bleedPerSev:.4,local:new T.Vector3(.1,0,0),dir:new T.Vector3(1,0,0),...props});
test('base clay remains proficiency2, ghost proficiency5 is reflected in actual Chinese skill table and voice',()=>{
 assert.equal(C.terracotta.ai.proficiency,2);assert.equal(C.terracotta.physiology.bleeds,false);
 assert.equal(C.terracotta_mad.ai.proficiency,5);assert.equal(C.terracotta_mad.ai.persona.proficiency.chinese,5);assert.equal(C.terracotta_mad.voice,'silent');
 assert.equal(C.terracotta_mad.ai.persona.school,C.terracotta.ai.persona.school);assert.equal(C.terracotta_mad.weapon,C.terracotta.weapon);
});
test('ghost and normal human bleed and die from the same torso wound while head remains attached; clay does neither',()=>{
 const results=[];for(const id of ['terracotta_mad','bran','terracotta'])setup(id,f=>{f.applyWound(wound());for(let i=0;i<1200&&f.alive;i++)f.updateVitals(1/120);results.push({id,alive:f.alive,blood:f.blood,bleed:f.bleed,head:!!f.jointByName.head.joint,decapitated:!!f.decapitated,cause:f.causeOfDeath});});
 assert.deepEqual({...results[0],id:null},{...results[1],id:null});assert.equal(results[0].alive,false);assert.equal(results[0].cause,'출혈');assert.equal(results[0].head,true);assert.equal(results[0].decapitated,false);assert.equal(results[2].alive,true);assert.equal(results[2].blood,1);console.log('BLEED',JSON.stringify(results));
});
test('ghost dies from head puncture, concussion and finishing torso attack without forced decapitation',()=>{
 for(const [label,h]of[['puncture',wound({zone:'head',part:'head',bleedPerSev:.01})],['concussion',wound({zone:'head',part:'head',type:'blunt',severity:0,energy:2000})],['finish',wound({finish:true})]])setup('terracotta_mad',f=>{f.applyWound(h);f.updateVitals(1/120);assert.equal(f.alive,false,label);assert.equal(!!f.decapitated,false,label);assert.ok(f.jointByName.head.joint,label);console.log('DEATH',label,f.causeOfDeath);});
});
test('white/red drops and ground residue coexist without a global color change; blood-off suppresses drops',()=>{
 const scene=new T.Scene(),p=new Particles(scene),pos=new T.Vector3(0,.01,0),dir=new T.Vector3(1,0,0),white=bloodPalette({physiology:{blood:'white'}});
 p.blood(pos,dir,1,1,white.splash);p.drip(pos,white.drip);p.blood(pos,dir,1,1);p.drip(pos);p.update(.5);
 const colors=new Set(p.list.map(i=>i.color.getHex()));for(const c of [white.splash,white.drip,0x8a0000,0x7a0000])assert.ok(colors.has(c));assert.ok(p.list.some(i=>i.stuck));
 p.clear();p.bloodOn=false;p.drip(pos,white.drip);assert.equal(p.list.length,0);p.blood(pos,dir,1,1,white.splash);assert.ok(p.list.every(i=>i.color.getHex()===0xb3b0a9));
});
test('white and human severed neck/limb materials stay separate, white spray and blood-off work',()=>{
 const scene=new T.Scene(),p=new Particles(scene),fx=createDecapFx(p),lfx=createLimbFx(p);
 const make=(white)=>({physiology:{body:'human',blood:white?'white':'red'},decapitated:true,wounds:[],groups:{chest:new T.Group(),head:new T.Group(),uarmS:new T.Group(),farmS:new T.Group()},severed:[{parent:'uarmS',parts:['farmS'],kind:'elbow',parentLocal:{x:.1,y:0,z:0},childLocal:{x:0,y:.1,z:0}}]});
 const w=make(true),r=make(false),fs=[w,r];fx.update(fs,.1);lfx.update(fs,.1);
 const cap=(f,key,name)=>f.groups[key].getObjectByName(name).children[0].material;
 assert.notEqual(cap(w,'chest','decapStump'),cap(r,'chest','decapStump'));assert.equal(cap(w,'chest','decapStump').color.getHex(),bloodPalette(w).flesh);assert.equal(cap(r,'chest','decapStump').color.getHex(),0x4a0a0c);
 assert.equal(cap(w,'farmS','limbStump').color.getHex(),bloodPalette(w).flesh);assert.ok(p.list.some(i=>i.color.getHex()===bloodPalette(w).splash));assert.ok(p.list.some(i=>i.color.getHex()===0x8a0000));
 p.clear();p.bloodOn=false;fx.update(fs,.1);lfx.update(fs,.1);assert.equal(p.list.length,0);for(const f of fs)assert.equal(cap(f,'chest','decapStump').color.getHex(),0x3a3634);
});
test('silent ghost has no voiced hurt/death samples; normal impact sounds are independent',()=>{const s=Object.create(Sound.prototype);Object.assign(s,{_on:true,ctx:{currentTime:0},master:{},pickSample:()=>{throw Error('unexpected voice sample')},event:()=>({})});let layers=0;s.layer=()=>layers++;s.hurt('silent',1);s.death('silent','출혈');assert.equal(layers,0);assert.equal(C.terracotta_mad.revive,undefined);});
