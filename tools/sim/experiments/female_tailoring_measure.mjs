// Run separately against the baseline/current trees, then compare all non-visual row fields.
// Output is created outside Git; explicit damage fixtures are not ordinary combat success.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [root,out]=process.argv.slice(2);
const {newRound,THREE}=await import(pathToFileURL(root+'/tools/sim/harness_m.mjs'));
const {CHARACTERS_BY_ID}=await import(pathToFileURL(root+'/src/characters.js'));
const rows=[];
for (const id of ['isolde','yeongman','artoria','margarethe','crown_boss','tome','omari']) {
 const c=CHARACTERS_BY_ID[id],g=newRound({seed:73,weapon:'sain',weapon2:c.weapon,look2:c.look,persona:c.ai.persona,difficulty:c.ai.level,gap:3,walls:false});
 const e=g.enemy, snapshots=[], geometry=[];
 const eyes=e.groups.head.children.slice(1,3).map(m=>({scale:m.scale.toArray(),size:new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).toArray()}));
 const armor=Object.fromEntries(Object.entries(e.plateBoxes).map(([k,v])=>[k,{partial:v.partial,boxes:v.list.map(x=>[x.box.min.toArray(),x.box.max.toArray()])}]));
 const masses=Object.fromEntries(Object.entries(e.bodies).map(([k,b])=>[k,b.mass()]));
 const posture=()=>({state:e.state,alive:e.alive,stamina:e.stamina,plate:{...e.plate},wounds:e.wounds.length});
 const snapshot=()=>snapshots.push(createHash('sha256').update(g.world.takeSnapshot()).digest('hex'));
 snapshot(); for(let i=0;i<180;i++){g.step();snapshot();}
 const pre=posture();
 for(const part of ['head','chest','uarmS'])e.applyWound({part,zone:part==='uarmS'?'arm':part,type:'cut',severity:.025,energy:2,bleedPerSev:.005,local:new THREE.Vector3(.1,0,0),dir:new THREE.Vector3(1,0,0),pass:true,passing:false,plate:false});
 for(const part of ['chest','uarmS']) if(e.plate[part]) e.wearPlate(part,10000,new THREE.Vector3(1,0,0),part);
 for(let i=0;i<60;i++){g.step();snapshot();}
 e.syncMeshes();
 for(const [part,group] of Object.entries(e.groups))group.traverse(m=>{if(m.geometry){const a=m.geometry.attributes.position;for(let i=0;i<a.array.length;i++)assert(Number.isFinite(a.array[i]));geometry.push([part,a.count]);}});
 rows.push({id,weapon:c.weapon,ai:c.ai,armor,masses,snapshots,pre,post:posture(),visual:{version:c.lookVersion,eyes,geometry}});
 g.player.clearLoose();e.clearLoose();g.eventQueue.free();g.world.free();
}
fs.writeFileSync(out,JSON.stringify({rows,limit:'Same-seed 180 live steps + explicit wounds/plate destruction +60 steps, against passive player; no balance/naturalness claim.'})+'\n',{flag:'wx'});
console.log(JSON.stringify({out,characters:rows.length,snapshots:rows.reduce((n,r)=>n+r.snapshots.length,0)}));
