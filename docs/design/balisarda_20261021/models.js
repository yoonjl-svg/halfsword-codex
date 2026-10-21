import * as THREE from 'three';
import { WEAPONS, weaponMatOpts, weaponSpecText } from '../../../src/weapons.js';
import { LOOKS } from '../../../src/looks.js';

function weapon(id){const w=WEAPONS[id],g=new THREE.Group();w.buildParts(LOOKS.player).forEach(([shape,y,,color,isBlade,pose],i)=>{const m=w.partMesh(i,isBlade,shape,color,weaponMatOpts(w.material,isBlade,w.tier),LOOKS.player,w.tier);m.position.set(pose?.x??0,y,0);m.rotation.z=pose?.rotZ??0;m.visible=color!=null;g.add(m);});w.decorate?.(g,LOOKS.player);return g;}
function render(g,name,caption,where,{center=.46,range=.7,tilt=.22,lean=0}={}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#201c19');scene.add(new THREE.HemisphereLight(0xe7e8ec,0x685342,2));
 for(const [color,intensity,p] of [[0xffedd2,2,[-2,3,5]],[0xc0d3df,1.1,[3,0,2]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...p);scene.add(l);}
 const holder=new THREE.Group();holder.add(g);g.position.y-=center;holder.rotation.set(lean,tilt,0);scene.add(holder);
 const camera=new THREE.OrthographicCamera(-range*.7,range*.7,range,-range,.01,10);camera.position.set(0,0,3);camera.lookAt(0,0,0);
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(1.5);r.setSize(370,530);r.render(scene,camera);
 const fig=document.createElement('figure');fig.dataset.name=name;const cap=document.createElement('figcaption');cap.textContent=name;const sm=document.createElement('small');sm.textContent=caption;cap.append(sm);fig.append(r.domElement,cap);document.querySelector(where).append(fig);
}
render(weapon('balisarda'),'발리사르다','이탈리아 · 레전드 · 칼날 95cm · 1.10kg','#out',{center:.47,range:.65,tilt:.28});
render(weapon('balisarda'),'은금 덩굴형 코등이','열린 바구니 · 상아색 감개 · 칼날의 잎 장식','#out',{center:.035,range:.15,tilt:.20,lean:.35});
render(weapon('balisarda'),'뒤쪽 세공','같은 모델을 뒤에서 관찰','#details',{center:.035,range:.15,tilt:Math.PI+.20,lean:.35});
for(const id of ['uchigatana','monohoshizao','kusanagi']){const w=WEAPONS[id];render(weapon(id),w.nameKo,weaponSpecText(w),'#japanese',{center:.44,range:.72,tilt:.22});}
window.modelsReady=true;
