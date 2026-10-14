// Real Fighter + production particle/neck/limb FX. No browser/canvas substitute.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {RAPIER,THREE,DT} from '../harness_m.mjs';
import {Fighter} from '../../../src/fighter.js';
import {CHARACTERS_BY_ID} from '../../../src/characters.js';
import {LOOKS} from '../../../src/looks.js';
import {Particles} from '../../../src/effects.js';
import {createDecapFx} from '../../../src/decap_fx.js';
import {createLimbSeverFx} from '../../../src/limb_sever_fx.js';
import {Sound} from '../../../src/sound.js';
const rows=[];const out=process.argv[2];assert(out?.startsWith('/tmp/'));
for(const bloodOn of [true,false]) for(const reverse of [false,true]){
 const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:-9.81,z:0}),info=new Map();
 const c=CHARACTERS_BY_ID.terracotta;
 const clay=new Fighter(RAPIER,world,scene,info,{index:1,name:c.name,x:2,heading:Math.PI,look:c.look,weapon:c.weapon,physiology:c.physiology});
 const human=new Fighter(RAPIER,world,scene,info,{index:0,name:'human',x:-2,look:LOOKS.player,weapon:'longsword'});
 const particles=new Particles(scene);particles.bloodOn=bloodOn;
 const fx=createDecapFx(particles),limbs=createLimbSeverFx(particles);
 try {
  for(const f of [human,clay])f.decapitate(1,.1);
  for(let i=0;i<30;i++)fx.update([clay],DT);
  assert.equal(particles.list.length,0,'No clay neck spray under either blood setting');
  fx.update(reverse?[human,clay]:[clay,human],DT);
  const disc=f=>f.groups.chest.children.find(x=>x.name==='decapStump');
  assert.equal(disc(clay).children.length,2);assert.equal(disc(clay).children[0].material.color.getHex(),0x8b887a);
  assert.equal(disc(human).children.length,3);assert.equal(disc(human).children[0].material.color.getHex(),bloodOn?0x4a0a0c:0x3a3634,'Clay cannot recolor shared human cap materials');
  for(const f of [human,clay])f.severedLimbs=[{parent:'uarmS',root:'farmS',radius:.04,localParent:new THREE.Vector3(),localChild:new THREE.Vector3(),normalParent:new THREE.Vector3(0,-1,0),normalChild:new THREE.Vector3(0,1,0)}];
  particles.clear();for(let i=0;i<30;i++)limbs.update([clay],DT);assert.equal(particles.list.length,0);
  limbs.update(reverse?[human,clay]:[clay,human],.1);
  assert.equal(clay.groups.uarmS.children.find(x=>x.name==='limbSeverStump').children.length,1);
  assert.equal(human.groups.uarmS.children.find(x=>x.name==='limbSeverStump').children.length,2);
  if(bloodOn)assert(particles.list.some(p=>p.color.getHex()===0x8a0000));else assert.equal(particles.list.length,0);
  particles.clear();particles.clayChips(new THREE.Vector3(),new THREE.Vector3(1,0,0),120);
  assert(particles.list.length>0&&particles.list.every(p=>!p.sticks&&[0x8b887a,0xb0ac9a].includes(p.color.getHex())));
  for(let i=0;i<60;i++)particles.update(DT);assert.equal(particles.list.length,0,'Clay dust expires without ground stains');
  rows.push({bloodOn,reverse,pass:true});
 }finally{human.clearLoose();clay.clearLoose();world.free();}
}
const layers=[];const sound={_on:true,ctx:{},fleshBus:{},event:p=>p,pick:k=>k,layer:(ev,k,p)=>layers.push({ev,k,p})};
Sound.prototype.clay.call(sound,120,{x:1});assert.equal(layers.length,1);assert.equal(layers[0].k,'bone');assert.equal(layers[0].p.rate,.78);assert(layers[0].ev.pos.x===1);
const report={pass:true,rows,sound:layers,method:'Actual production Fighter/Particles/DecapFx/LimbSeverFx, detached native head joints. Synthetic limb events isolate rendering; physical sever covered by vitals gate. Human and clay caps rendered together in both orders/blood settings.'};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,mixedCases:rows.length,soundCases:1}));
