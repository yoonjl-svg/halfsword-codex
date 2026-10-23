import * as THREE from 'three';
import {WEAPONS,weaponMatOpts,weaponSpecText} from '../../../src/weapons.js';
import {LOOKS} from '../../../src/looks.js';
function weapon(id){const w=WEAPONS[id],g=new THREE.Group();w.buildParts(LOOKS.player).forEach(([shape,y,,color,isBlade,pose],i)=>{const m=w.partMesh(i,isBlade,shape,color,weaponMatOpts(w.material,isBlade,w.tier),LOOKS.player,w.tier);m.position.set(pose?.x??0,y,0);m.rotation.z=pose?.rotZ??0;m.visible=color!=null;g.add(m);});w.decorate?.(g,LOOKS.player);return g;}
function render(g,name,caption,where,{center=.46,range=.7,tilt=.22,lean=0}={}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#201c19');scene.add(new THREE.HemisphereLight(0xe7e8ec,0x685342,2));
 for(const [color,intensity,p] of [[0xffedd2,2,[-2,3,5]],[0xc0d3df,1.1,[3,0,2]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...p);scene.add(l);}
 const holder=new THREE.Group();holder.add(g);g.position.y-=center;holder.rotation.set(lean,tilt,0);scene.add(holder);
 const camera=new THREE.OrthographicCamera(-range*.7,range*.7,range,-range,.01,10);camera.position.set(0,0,3);camera.lookAt(0,0,0);
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(1.5);r.setSize(370,530);r.render(scene,camera);
 const fig=document.createElement('figure');fig.dataset.name=name;const cap=document.createElement('figcaption');cap.textContent=name;const sm=document.createElement('small');sm.textContent=caption;cap.append(sm);fig.append(r.domElement,cap);document.querySelector(where).append(fig);
}

for(const id of ['zweihander','durandal','tizona'])render(weapon(id),WEAPONS[id].nameKo,weaponSpecText(WEAPONS[id]),'#out',{center:.535,range:.94,tilt:.18});
render(weapon('durandal'),'붉은 감개 · 성물함','십자 격자와 팔각 금장','#details',{center:-.075,range:.255,tilt:.15});
render(weapon('durandal'),'십자 코등이와 칼날','넓은 양날 · 긴 중앙 피홈','#details',{center:.34,range:.225,tilt:.15});
const back=weapon('durandal');back.rotation.y=Math.PI;render(back,'뒤랑달 뒷면','양면 성물함 · 같은 축척','#reverse',{center:.535,range:.94,tilt:.18});
window.modelsReady=true;
