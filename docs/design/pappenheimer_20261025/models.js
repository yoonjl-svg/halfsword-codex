import * as THREE from 'three';
import {WEAPONS,weaponMatOpts,weaponSpecText} from '../../../src/weapons.js';
import {LOOKS} from '../../../src/looks.js';
function weapon(id){const w=WEAPONS[id],g=new THREE.Group();w.buildParts(LOOKS.player).forEach(([shape,y,,color,isBlade,pose],i)=>{if(color==null)return;const m=w.partMesh(i,isBlade,shape,color,weaponMatOpts(w.material,isBlade,w.tier),LOOKS.player,w.tier);m.position.set(pose?.x??0,y,0);m.rotation.z=pose?.rotZ??0;m.visible=color!=null;g.add(m);});w.decorate?.(g,LOOKS.player);return g;}
function render(g,name,caption,where,{center=.46,range=.7,tilt=.22,lean=0}={}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#201c19');scene.add(new THREE.HemisphereLight(0xe7e8ec,0x685342,2));
 for(const [color,intensity,p] of [[0xffedd2,2,[-2,3,5]],[0xc0d3df,1.1,[3,0,2]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...p);scene.add(l);}
 const holder=new THREE.Group();holder.add(g);g.position.y-=center;holder.rotation.set(lean,tilt,0);scene.add(holder);
 const camera=new THREE.OrthographicCamera(-range*.7,range*.7,range,-range,.01,10);camera.position.set(0,0,3);camera.lookAt(0,0,0);
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(1.5);r.setSize(370,530);r.render(scene,camera);
 const fig=document.createElement('figure');fig.dataset.name=name;const cap=document.createElement('figcaption');cap.textContent=name;const sm=document.createElement('small');sm.textContent=caption;cap.append(sm);fig.append(r.domElement,cap);document.querySelector(where).append(fig);
}


for(const id of ['rapier','pappenheimer','dartagnan'])render(weapon(id),WEAPONS[id].nameKo,weaponSpecText(WEAPONS[id]),'#out',{center:.44,range:.66,tilt:.15});
render(weapon('pappenheimer'),'투각판과 겹친 고리','앞면 · 실제로 뚫린 구멍','#details',{center:.025,range:.14,tilt:.20});
render(weapon('pappenheimer'),'철사 감개 · 여섯 갈래 홈','옆면 · 손등 고리와 두 방호판','#details',{center:.012,range:.14,tilt:1.18});
render(weapon('pappenheimer'),'금장 칼날과 명문','박물관 기록의 라틴어 명문','#details',{center:.235,range:.15,tilt:.12});
const back=weapon('pappenheimer');back.rotation.y=Math.PI;render(back,'뒷면','금장과 투각판은 양면','#reverse',{center:.035,range:.18,tilt:.25});
window.modelsReady=true;
