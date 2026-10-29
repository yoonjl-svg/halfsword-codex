import assert from 'node:assert/strict';import fs from'node:fs';import {execFileSync}from'node:child_process';
import R from '@dimforge/rapier3d-compat';import * as T from 'three';import{Fighter}from'../../../src/fighter.js';import{CHARACTERS_BY_ID as C}from'../../../src/characters.js';
const out=new URL('./',import.meta.url).pathname;await R.init();const rows=[];
for(const id of ['roland','bernardo']){
 const a=C[id],b=C[id+'_mad'];assert.deepEqual(a.ai,b.ai);for(const key of ['weapon','vitality','voice','school'])assert.deepEqual(a[key],b[key]);
 const normal=JSON.parse(execFileSync('node',['tools/sim/look_tris.mjs',id,'--json'],{encoding:'utf8'}));assert.deepEqual(normal,JSON.parse(fs.readFileSync(out+'baseline/'+id+'.json')));
 const w=new R.World({x:0,y:-9.81,z:0}),scene=new T.Scene(),f=[];
 for(const c of [a,b])f.push(new Fighter(R,w,scene,new Map(),{index:f.length,name:c.name,x:f.length*5,heading:0,look:c.look,weapon:c.weapon,vitality:c.vitality,breakSeed:1}));
 const [base,alter]=f;assert.deepEqual(Object.keys(base.plate),Object.keys(alter.plate));
 // Body armor regions and physical body/joint data stay those of the v2 original.
 for(const k of Object.keys(base.plateBoxes)){
  const simple=x=>({list:x.list.map(o=>({min:o.box.min.toArray(),max:o.box.max.toArray()})),partial:x.partial});assert.deepEqual(simple(base.plateBoxes[k]),simple(alter.plateBoxes[k]));
 }
 assert.equal(alter.hasHelmet,id==='bernardo');const meshes={};let tris=0,count=0;
 for(const [part,g]of Object.entries(alter.groups)){let n=0;g.traverseVisible(o=>{if(o.isMesh){count++;n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3}});meshes[part]=n;tris+=n;}
 let helmetTest=null;if(id==='bernardo'){
  const h=alter.helmetGroup;assert(h.userData.pieces.crest);alter.helmetIntegrity=.3;alter.shedHelmet(alter.helmetSpec,{local:new T.Vector3(),dir:new T.Vector3(1,0,0),energy:100});assert(!h.userData.pieces.crest);alter.knockOffHelmet(new T.Vector3(1,0,0),250);assert.equal(alter.hasHelmet,false);assert.equal(h.parent,null);helmetTest='crest shedding and full break passed';
 }
 rows.push({id:alter.name,proficiency:b.ai.proficiency,vitality:b.vitality,weapon:b.weapon,bodyArmorParts:Object.keys(alter.plate).length,bodyArmorBoundsUnchanged:true,baseAppearanceUnchanged:true,aiUnchanged:true,helmet:b.look.helmet,tris,meshCount:count,meshes,helmetTest});w.free();
}
fs.writeFileSync(out+'checks.json',JSON.stringify(rows,null,2));console.log(rows);
