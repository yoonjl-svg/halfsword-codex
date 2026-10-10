// Visual revision: compare actual native physics against the preceding game source.
// node tools/sim/experiments/renji_reference_gate.mjs /tmp/halfsword-renji-refine-20261010/native.json
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newRound, THREE } from '../harness_m.mjs';
import { OUTFITS, newOutfitHelpers } from '../../../src/outfits.js';
import { LOOK_ARCHIVE } from '../../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
const out=process.argv[2];assert(out?.startsWith('/tmp/halfsword-renji-refine-20261010/'));
const basis='27888f2dae6cdfcc8a8b5244610feff488344dfe';
const oldCode=execFileSync('git',['show',`${basis}:src/outfit_renji.js`],{maxBuffer:1024*1024});
const {createRenjiOutfit}=await import('data:text/javascript;base64,'+oldCode.toString('base64'));
const current=OUTFITS.renji_wanderer, c=CHARACTERS_BY_ID.renji;
const sha=v=>createHash('sha256').update(v).digest('hex');
const opts={seed:73,weapon:'longsword',weapon2:c.weapon,look2:c.look,persona:c.ai.persona,difficulty:c.ai.level,walls:false};
const samples=[];
try {
 for(const factory of [createRenjiOutfit(newOutfitHelpers),current]){
  OUTFITS.renji_wanderer=factory;
  const g=newRound(opts),e=g.enemy;
  try {
   const trace=[],face=e.groups.head.children.slice(0,4).map(m=>({position:m.position.toArray(),scale:m.scale.toArray(),vertices:sha(Buffer.from(m.geometry.attributes.position.array.buffer))}));
   for(let i=0;i<240;i++){g.step();e.syncMeshes();trace.push(sha(g.world.takeSnapshot()));}
   samples.push({trace,face,weapon:e.weapon.id});
  }finally{g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free();}
 }
 assert.deepEqual(samples[0],samples[1],'Outfit revision must leave actual physics and stock face unchanged');
 OUTFITS.renji_wanderer=current;
 const g=newRound({...opts,gap:12});
 let vertices=0, retained=0;
 try {
  const e=g.enemy, holders=[];
  for(const {group} of e.meshes)group.traverse(n=>{if(n.name.startsWith('renji-'))holders.push([n,n.parent]);});
  for(const part of ['head','chest','farmS','thighF'])e.applyWound({part,zone:part,type:'cut',severity:.025,energy:2,bleedPerSev:.005,
   local:new THREE.Vector3(.1,0,0),dir:new THREE.Vector3(1,0,0),pass:true,passing:false,plate:false});
  for(let i=0;i<60;i++){g.step();e.syncMeshes();}
  assert(e.wounds.length>=4); assert(holders.length>5 && holders.every(([n,p])=>n.parent===p));retained=holders.length;
  for(const {group} of e.meshes)group.traverse(n=>{if(n.geometry){for(const key of ['position','normal','color'])if(n.geometry.attributes[key])assert(n.geometry.attributes[key].array.every(Number.isFinite));vertices+=n.geometry.attributes.position.count;}});
 }finally{g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free();}
 const samira=CHARACTERS_BY_ID.crown_boss, waist=[];
 for(const look of [LOOK_ARCHIVE.crown_boss.v7,samira.look]){
  const g=newRound({seed:91,weapon:'longsword',weapon2:samira.weapon,look2:look,persona:samira.ai.persona,difficulty:samira.ai.level,walls:false});
  try{
   const trace=[],mesh=[];
   for(const part of ['head','chest','abdomen','thighF','shinF']){
    const m=g.enemy.groups[part].children[0];mesh.push([part,sha(Buffer.from(m.geometry.attributes.position.array.buffer)),m.scale.toArray()]);
   }
   for(let i=0;i<240;i++){g.step();trace.push(sha(g.world.takeSnapshot()));}
   waist.push({trace,mesh});
  }finally{g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free();}
 }
 assert.deepEqual(waist[0],waist[1],'Samira belt must not change native dynamics or main body geometry');
 fs.writeFileSync(out,JSON.stringify({pass:true,basis,pairedNativeSteps:240,physicsFaceWeaponExact:true,traceSha256:sha(JSON.stringify(samples[1])),syntheticWounds:4,retainedLayers:retained,vertices,samira:{pairedSteps:240,bodyFaceNativeExact:true,beltRiseM:.07},limits:['Visual/physics isolation and synthetic wound retention only. No combat balance or aesthetic acceptance claim.']},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:true,pairedNativeSteps:240,syntheticWounds:4,retainedLayers:retained,vertices}));
}finally{OUTFITS.renji_wanderer=current;}
