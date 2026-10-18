import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {Fighter} from '../../src/fighter.js';
import {LOOKS} from '../../src/looks.js';
await RAPIER.init();
const data=await(await fetch('../../docs/research/iberian_beat_20261018/replay/paired.json')).json(),views={};
for(const key of ['base','candidate']){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#292d2d');
 scene.add(new THREE.HemisphereLight(0xdde7e6,0x554834,2));
 const light=new THREE.DirectionalLight(0xffe6bb,3);light.position.set(-2,5,4);scene.add(light);
 const grid=new THREE.GridHelper(7,28,0x717367,0x40433e);scene.add(grid);
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),info=new Map();
 const f=[new Fighter(RAPIER,world,scene,info,{index:0,name:'P',x:-.7,heading:0,look:LOOKS.player,weapon:'zweihander',breakSeed:1}),new Fighter(RAPIER,world,scene,info,{index:1,name:'E',x:.7,heading:Math.PI,look:LOOKS.enemy,weapon:'longsword',breakSeed:1})];
 const camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(-1.6,2.8,4.4);camera.lookAt(0,1.15,.1);
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById(key),antialias:false});renderer.setPixelRatio(1);renderer.setSize(600,450,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;camera.aspect=600/450;camera.updateProjectionMatrix();
 views[key]={scene,f,camera,renderer,world};
}
window.showBeat=t=>{
 for(const key of ['base','candidate']){
  const {scene,f,camera,renderer}=views[key],rows=data[key].frames;
  const row=rows.reduce((a,b)=>Math.abs(a.dt-t)<Math.abs(b.dt-t)?a:b);
  for(let i=0;i<2;i++){row.fighters[i].meshes.forEach((m,j)=>{f[i].meshes[j].rb.setTranslation(m.p,true);f[i].meshes[j].rb.setRotation(m.q,true);});f[i].blood=row.fighters[i].blood;f[i].syncMeshes();}
  for(const o of [...scene.children])if(o.userData.trail){scene.remove(o);o.geometry.dispose();o.material.dispose();}
  const pts=rows.filter(r=>r.dt<=row.dt&&r.dt>=row.dt-.1).map(r=>{const sw=r.fighters[1].meshes.at(-1);return new THREE.Vector3(0,f[1].weaponCfg.hiltLength+f[1].weaponCfg.bladeLength,0).applyQuaternion(sw.q).add(sw.p);});
  if(pts.length>1){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xd98c76}));line.userData.trail=true;scene.add(line);}
  renderer.render(scene,camera);
 }
 document.getElementById('time').textContent=`접촉 뒤 ${t.toFixed(2)}초`;
};
document.querySelectorAll('button').forEach(b=>b.onclick=()=>window.showBeat(+b.dataset.t));window.showBeat(.3);window.replayReady=true;
