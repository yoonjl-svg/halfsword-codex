// Boundary fires: visual only, outside the arena/camera ring. Like Poseidon's
// braziers, warm terrain light is baked once instead of adding four shadow lights.
import * as THREE from 'three';
import {Kit,bakeLight,pointGlow} from './stage_kit.js';

export function addNightBoundaryFires(scene,root,original,temple=false){
 const positions=temple?[[10,10],[-10,10],[10,-10],[-10,-10]]:[[11,9],[-11,9],[11,-9],[-11,-9]];
 const light=pointGlow(positions.map(([x,z])=>({x,y:1.15,z,r:11,c:[3.2,1.5,.45]})));
 const v=new THREE.Vector3();scene.updateMatrixWorld(true);
 for(const o of original)o.traverse(m=>{
  if(!m.isMesh||m.isInstancedMesh||!m.geometry?.attributes.position||Array.isArray(m.material)||m.material.isMeshBasicMaterial)return;
  const g=m.geometry;
  if(!g.attributes.color)g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));
  m.material.vertexColors=true;m.material.needsUpdate=true;
  bakeLight(g,(x,y,z)=>{v.set(x,y,z).applyMatrix4(m.matrixWorld);return light(v.x,v.y,v.z)});
 });
 const k=new Kit(31616),put=(geo,color,pos,rot=[0,0,0],scale=1)=>{k.put('stand',geo,color,pos,rot,scale,{vary:.06});geo.dispose()};
 for(const [x,z] of positions){
  if(temple){
   put(new THREE.BoxGeometry(.8,.16,.8),0x69645a,[x,.08,z]);
   put(new THREE.BoxGeometry(.25,.75,.25),0x716c61,[x,.52,z]);
   put(new THREE.CylinderGeometry(.43,.29,.20,8),0x4d4640,[x,.98,z]);
   for(const dx of [-.28,.28])for(const dz of [-.28,.28])put(new THREE.BoxGeometry(.065,.38,.065),0x514a40,[x+dx,1.22,z+dz]);
   put(new THREE.ConeGeometry(.58,.23,4),0x474b48,[x,1.51,z],[0,Math.PI/4,0]);
  }else{
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3;
    put(new THREE.CylinderGeometry(.035,.045,1.0,6),0x4b4240,[x+Math.cos(a)*.25,.5,z+Math.sin(a)*.25],[Math.sin(a)*.18,0,-Math.cos(a)*.18]);
   }
   put(new THREE.CylinderGeometry(.43,.25,.26,10,1,true),0x4a4140,[x,1.02,z]);
   put(new THREE.TorusGeometry(.43,.025,4,12),0x7b5b43,[x,1.15,z],[Math.PI/2,0,0]);
  }
 }
 const stand=k.mesh('stand',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:temple?0:.35}),{light,cast:false});
 stand.name=temple?'night-boundary-stone-lanterns':'night-boundary-braziers';root.add(stand);
 for(const g of k.bins.stand)g.dispose();
 const flame=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),new THREE.MeshBasicMaterial({color:0xffa33c}),positions.length*3);
 const heart=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),new THREE.MeshBasicMaterial({color:0xffdf98}),positions.length);
 flame.name='boundary-fire-flames';heart.name='boundary-fire-hearts';root.add(flame,heart);
 const dummy=new THREE.Object3D();const update=t=>{
  positions.forEach(([x,z],i)=>{
   for(let j=0;j<3;j++){const h=(temple?.25:.43)*(1+.12*Math.sin(t*7+i*1.9+j)),a=j*2.1+t*.2;
    dummy.position.set(x+Math.cos(a)*.09,1.12+h/2,z+Math.sin(a)*.09);dummy.rotation.set(.05*Math.sin(t*5+j),a,.06*Math.sin(t*4+i));dummy.scale.set(.09,h,.09);dummy.updateMatrix();flame.setMatrixAt(i*3+j,dummy.matrix);
   }
   dummy.position.set(x,1.19,z);dummy.rotation.set(0,t*.2,0);dummy.scale.set(.095,.24,.095);dummy.updateMatrix();heart.setMatrixAt(i,dummy.matrix);
  });flame.instanceMatrix.needsUpdate=true;heart.instanceMatrix.needsUpdate=true;
 };
 flame.frustumCulled=false;heart.frustumCulled=false;update(0);
 root.userData.boundaryFires=positions;
 return update;
}
