import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {Fighter} from '../../src/fighter.js';
import {LOOKS} from '../../src/looks.js';
await RAPIER.init();
const q=new URLSearchParams(location.search),folder=q.get('replay')??'finish';
const data=await(await fetch('../../docs/research/iberian_contact_20261018/replay/'+folder+'/paired.json')).json();
for(const id of ['base',data.candidate.id])for(const dt of [.0,.18,.36]){
 const section=document.createElement('section');section.innerHTML=`<h2>${id==='base'?'기존 막기':'접촉 방향으로 밀어 쓸기'} · +${dt.toFixed(2)}초</h2><small></small><canvas></canvas>`;document.getElementById('views').append(section);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#292d2d');scene.add(new THREE.HemisphereLight(0xdde7e6,0x554834,2));
 const light=new THREE.DirectionalLight(0xffe6bb,3);light.position.set(-2,5,4);scene.add(light);scene.add(new THREE.GridHelper(7,28,0x717367,0x40433e));
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),info=new Map();
 const f=[new Fighter(RAPIER,world,scene,info,{index:0,name:'P',x:-.8,heading:0,look:LOOKS.player,weapon:'zweihander',breakSeed:1}),new Fighter(RAPIER,world,scene,info,{index:1,name:'E',x:.8,heading:Math.PI,look:LOOKS.enemy,weapon:'longsword',breakSeed:1})];
 const rows=data.variants[id].frames,t=data.origin+dt,row=rows.reduce((a,b)=>Math.abs(a.t-t)<Math.abs(b.t-t)?a:b);
 for(let i=0;i<2;i++){row.fighters[i].meshes.forEach((m,j)=>{f[i].meshes[j].rb.setTranslation(m.p,true);f[i].meshes[j].rb.setRotation(m.q,true);});f[i].blood=row.fighters[i].blood;f[i].syncMeshes();}
 for(let i=0;i<2;i++){
  const pts=rows.filter(r=>r.t<=row.t&&r.t>=row.t-.12).map(r=>new THREE.Vector3(...r.tips[i]));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:i===0?0x9dd4a2:0xde8a77})));
 }
 const camera=new THREE.PerspectiveCamera(33,4/3,.1,30);camera.position.set(-1.6,2.6,4.4);camera.lookAt(0,1.2,.1);
 const renderer=new THREE.WebGLRenderer({canvas:section.querySelector('canvas'),antialias:false});renderer.setPixelRatio(1);renderer.setSize(400,300,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.render(scene,camera);
 section.querySelector('small').textContent=id==='base'?'기존 몸꼴':row.phase==='sweep'?'쓸기':row.phase==='carry'?'이어 받침':row.phase==='recover'?'회수':'대기';
}
window.replayReady=true;
