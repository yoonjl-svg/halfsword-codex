import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {Fighter} from '../../src/fighter.js';
import {LOOKS} from '../../src/looks.js';
await RAPIER.init();
const isLive=new URLSearchParams(location.search).has('live');
const data=(await(await fetch(`../../docs/research/iberian_compare_20261018/replay/${isLive?'live-first':'paired'}.json`)).json()).variants,views=[];
if(isLive)document.querySelector('header p').textContent='로컬 연구판의 실제 물리 기록 재생 · 첫 전투 조건(seed941, 롱소드 상대, 베기 반격)의 첫 발동';
const choices=[['base','기존 상태'],['offset16','처음 방식 · 적정 16°'],['offset24','처음 방식 · 다소 센 24°'],['base','기존 상태'],['impulse6','추가 충격 · 적정 상한 6N·s'],['impulse9','추가 충격 · 다소 센 상한 9N·s']];
for(const [key,label] of choices){
 const section=document.createElement('section');section.innerHTML=`<h2>${label}</h2><small></small><canvas></canvas>`;document.getElementById('views').append(section);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#292d2d');scene.add(new THREE.HemisphereLight(0xdde7e6,0x554834,2));
 const light=new THREE.DirectionalLight(0xffe6bb,3);light.position.set(-2,5,4);scene.add(light);scene.add(new THREE.GridHelper(7,28,0x717367,0x40433e));
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),info=new Map();
 const f=[new Fighter(RAPIER,world,scene,info,{index:0,name:'P',x:-.7,heading:0,look:LOOKS.player,weapon:'zweihander',breakSeed:1}),new Fighter(RAPIER,world,scene,info,{index:1,name:'E',x:.7,heading:Math.PI,look:LOOKS.enemy,weapon:'longsword',breakSeed:1})];
 const camera=new THREE.PerspectiveCamera(36,4/3,.1,30);camera.position.set(-1.6,2.8,4.4);camera.lookAt(0,1.15,.1);
 if(isLive){
  // One shared camera derived from BASE at the first contact, never per candidate.
  const initial=data.base.frames[0],d=new THREE.Vector3(...initial.geometry.dChest),a=new THREE.Vector3().copy(initial.fighters[1].meshes[0].p);
  const center=d.clone().add(a).multiplyScalar(.5),line=a.clone().sub(d);line.y=0;line.normalize();
  const side=new THREE.Vector3(-line.z,0,line.x),pos=center.clone().addScaledVector(line,-1.6).addScaledVector(side,4.4);pos.y=2.8;
  camera.position.copy(pos);camera.lookAt(center.x,1.15,center.z);
 }
 const renderer=new THREE.WebGLRenderer({canvas:section.querySelector('canvas'),antialias:false});renderer.setPixelRatio(1);renderer.setSize(400,300,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 views.push({key,section,scene,world,f,camera,renderer});
}
window.showBeat=t=>{
 for(const {key,section,scene,f,camera,renderer} of views){
  const rows=data[key].frames,row=rows.reduce((a,b)=>Math.abs(a.dt-t)<Math.abs(b.dt-t)?a:b);
  for(let i=0;i<2;i++){row.fighters[i].meshes.forEach((m,j)=>{f[i].meshes[j].rb.setTranslation(m.p,true);f[i].meshes[j].rb.setRotation(m.q,true);});f[i].blood=row.fighters[i].blood;f[i].syncMeshes();}
  for(const o of [...scene.children])if(o.userData.trail){scene.remove(o);o.geometry.dispose();o.material.dispose();}
  const pts=rows.filter(r=>r.dt<=row.dt&&r.dt>=row.dt-.1).map(r=>new THREE.Vector3(...r.geometry.tip));
  if(pts.length>1){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xd98c76}));l.userData.trail=true;scene.add(l);}
  section.querySelector('small').textContent=`상대 칼 ↔ 가슴 중심 ${(row.geometry.chest*100).toFixed(0)}cm`;
  renderer.render(scene,camera);
 }
 document.getElementById('time').textContent=`접촉 뒤 ${t.toFixed(2)}초`;
};
document.querySelectorAll('button').forEach(b=>b.onclick=()=>window.showBeat(+b.dataset.t));window.showBeat(.3);window.replayReady=true;
