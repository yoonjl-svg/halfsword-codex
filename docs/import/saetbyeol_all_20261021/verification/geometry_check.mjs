import assert from 'node:assert/strict';import * as THREE from 'three';import fs from 'node:fs';
import {WEAPONS,weaponMatOpts} from '../../../../src/weapons.js';import{LOOKS}from'../../../../src/looks.js';
import {newRound} from '../../../../tools/sim/harness_m.mjs';
const result=[];
for(const id of ['hwando','kriegsmesser']){
 const w=WEAPONS[id],root=new THREE.Group();let tris=0,maxOutside=0;
 for(const [i,p]of w.buildParts(LOOKS.player).entries()){
  const[s,y,,color,blade]=p,m=w.partMesh(i,blade,s,color,weaponMatOpts(w.material,blade,w.tier),LOOKS.player,w.tier);m.position.y=y;root.add(m);
  m.traverse(o=>{if(!o.geometry)return;const a=o.geometry.getAttribute('position');assert([...a.array].every(Number.isFinite));tris+=(o.geometry.index?.count??a.count)/3;if(blade)for(let j=0;j<a.count;j++)maxOutside=Math.max(maxOutside,Math.abs(a.getX(j))-s[1],Math.abs(a.getY(j))-s[2],Math.abs(a.getZ(j))-s[3]);});
 }
 w.decorate?.(root,LOOKS.player);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);
 assert(maxOutside<.01,`${id}: blade/collider deviation ${maxOutside}`);
 if(id==='hwando'){
  const guard=root.getObjectByName('hwando-openwork-samyeop-chilbo');assert.equal(guard.geometry.parameters.shapes.holes.length,4);
  const cast=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,.3,z),new THREE.Vector3(0,-1,0)).intersectObject(guard).length;
  assert.equal(cast(.023,0),0,'trefoil must be genuinely pierced');assert(cast(.032,0)>0,'solid outer rim');
 }
 const g=newRound({weapon:id,weapon2:'tree_branch',seed:39,gap:2.3});const p=g.player,oldMass=p.sword.mass();
 assert.equal(p.groups.pelvis.getObjectByName('hwando-black-scabbard')!==undefined,id==='hwando');
 const scabbard=p.groups.pelvis.getObjectByName('hwando-black-scabbard');
 p.breakWeapon();assert(p.weaponBroken);assert(p.sword.mass()<oldMass);assert(p.stamina.originalMass>=oldMass-1e-5);
 p.swordGroup.updateMatrixWorld(true);const inverse=p.swordGroup.matrixWorld.clone().invert();let high=-Infinity;
 p.swordGroup.traverse(o=>{if(!o.isMesh||!o.visible||o.name==='breakFace')return;const a=o.geometry.getAttribute('position'),m=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(m);high=Math.max(high,v.y);}});
 assert(high<=p.weaponCfg.hiltLength+p.weaponCfg.bladeLength+.0001,`${id} broken remainder beyond blade: ${high}`);
 if(scabbard)assert.equal(scabbard.parent,p.groups.pelvis);
 result.push({id,triangles:tris,visualLength:box.max.y-box.min.y,maxBladeColliderDeviation:maxOutside,massBefore:oldMass,massAfter:p.sword.mass(),brokenTop:high,scabbardPreserved:!!scabbard});g.world.free();
}
fs.writeFileSync(new URL('./geometry.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
