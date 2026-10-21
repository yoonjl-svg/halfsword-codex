import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.SHAPE_SOURCE||new URL('../../../',import.meta.url).pathname;
const {newRound,THREE}=await import(pathToFileURL(root+'/tools/sim/harness_m.mjs'));
const {CHARACTERS_BY_ID,CHARACTERS}=await import(pathToFileURL(root+'/src/characters.js'));
const out={characters:CHARACTERS_BY_ID,rotation:CHARACTERS.map(c=>c.id),models:{}};
for(const id of ['white_scale','sebastian']){
 const c=CHARACTERS_BY_ID[id],g=newRound({look:c.look,weapon:c.weapon,seed:31}),f=g.player;
 const boxes=Object.fromEntries(Object.entries(f.plateBoxes).map(([k,b])=>[k,{partial:b.partial,list:b.list.map(v=>({min:v.box.min.toArray(),max:v.box.max.toArray()}))}]));
 const bodies=Object.fromEntries(Object.entries(f.bodies).map(([k,b])=>[k,{mass:b.mass(),position:{...b.translation()},rotation:{...b.rotation()}}]));
 // Sample actual cylindrical/capsule skin surfaces, including rounded endcaps.
 const coverage={};
 for(const [stem,h,r]of [['uarm',.105,.045],['farm',.095,.040],['thigh',.15,.065],['shin',.16,.050]])for(const suffix of stem==='uarm'||stem==='farm'?['S','O']:['F','B']){
  const part=stem+suffix,points=[];
  for(let j=0;j<=48;j++){
   const y=-(h+r)+(h+r)*2*j/48,rr=Math.sqrt(Math.max(0,r*r-Math.max(0,Math.abs(y)-h)**2));
   for(let i=0;i<32;i++){
    const a=i*Math.PI/16,v=new THREE.Vector3(rr*Math.cos(a),y,rr*Math.sin(a));
    if(suffix==='S')v.applyAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
    points.push(f.platedAt(part,v)?1:0);
   }
  }coverage[part]=points.join('');
 }
 const freshPlate={...f.plate};
 for(const part of Object.keys(f.plate)){f.plate[part]=.20;f.wearPlate(part,1,new THREE.Vector3(1,0,0));}
 const wornBoxes=Object.fromEntries(Object.entries(f.plateBoxes).map(([k,b])=>[k,b.list.map(v=>({min:v.box.min.toArray(),max:v.box.max.toArray()}))]));
 out.models[id]={boxes,plate:freshPlate,bodies,coverage,wornBoxes};
 if(!process.env.SHAPE_SOURCE&&id==='sebastian'){
  const old=JSON.parse(fs.readFileSync(new URL('../sebastian_shoulder_structure_20261022/before-armor.json',import.meta.url)));
  assert.deepEqual(boxes,old.boxes);assert.deepEqual(freshPlate,old.plate);assert.deepEqual(c,old.character);
  out.lions=[];
  for(const part of ['uarmS','uarmO']){
   const lion=f.groups[part].getObjectByName('royal-shoulder-lion');assert(lion);const cap=lion.parent;
   assert(f.plateBoxes[part].list.some(b=>b.mesh===cap));
   assert(!f.groups[part].getObjectByName('royal-shoulder-upright-wing'));
   let maxY=-Infinity;lion.traverse(o=>{if(o.geometry){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){assert(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));maxY=Math.max(maxY,a.getY(i));}}});
   cap.geometry.computeBoundingBox();const rise=maxY-cap.geometry.boundingBox.max.y;assert(rise>.04&&rise<.10);
   const originalParent=cap.parent;f.wearPlate(part,10000,new THREE.Vector3(1,0,0));assert.equal(lion.parent,cap);assert.notEqual(cap.parent,originalParent);
   out.lions.push({part,rise,attachedToPlate:true,breaksWithPlate:true});
  }
 }g.world.free();
}
const path=new URL(process.env.SHAPE_SOURCE?'./before-shapes.json':'./after-shapes.json',import.meta.url);
fs.writeFileSync(path,JSON.stringify(out,null,2)+'\n');
if(!process.env.SHAPE_SOURCE){
 const old=JSON.parse(fs.readFileSync(new URL('./before-shapes.json',import.meta.url)));
 assert.deepEqual(out.characters,old.characters);assert.deepEqual(out.rotation,old.rotation);
 const summary={allCharactersUnchanged:true,rotationUnchanged:true,lions:out.lions,coverage:{}};
 for(const id of ['white_scale','sebastian']){
  assert.deepEqual(out.models[id].bodies,old.models[id].bodies);assert.deepEqual(out.models[id].plate,old.models[id].plate);
  summary.coverage[id]={};for(const [part,values]of Object.entries(out.models[id].coverage)){
   const before=old.models[id].coverage[part];let gained=0,lost=0;for(let i=0;i<before.length;i++){if(before[i]!==values[i]){if(values[i]==='1')gained++;else lost++;}}
   const stem=part.replace(/[SOFB]$/,''),[h,r]=({uarm:[.105,.045],farm:[.095,.040],thigh:[.15,.065],shin:[.16,.050]})[stem];
   const {ARMOR}=await import(pathToFileURL(root+'/src/config.js'));let wornChanges=0;
   const covers=(boxes,v)=>boxes.some(b=>new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)).distanceToPoint(v)<=ARMOR.plate.coverMargin);
   for(let j=0;j<=48;j++)for(let i=0;i<32;i++){
    const y=-(h+r)+(h+r)*2*j/48,rr=Math.sqrt(Math.max(0,r*r-Math.max(0,Math.abs(y)-h)**2)),a=i*Math.PI/16,v=new THREE.Vector3(rr*Math.cos(a),y,rr*Math.sin(a));if(part.endsWith('S'))v.applyAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
    if(covers(out.models[id].wornBoxes[part],v)!==covers(old.models[id].wornBoxes[part],v))wornChanges++;
   }
   assert.equal(wornChanges,0,`${id}/${part} worn skin coverage changed`);
   summary.coverage[id][part]={samples:values.length,gained,lost,wornChanges};assert.equal(gained+lost,0,`${id}/${part} skin coverage changed`);
  }
 }
 fs.writeFileSync(new URL('./shape-checks.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');console.log(summary);
}
