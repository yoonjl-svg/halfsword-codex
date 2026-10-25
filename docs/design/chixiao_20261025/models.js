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


render(weapon('chixiao'),'적소검','동방 · 레전드 · 날 80 cm · 1.30 kg','#out',{center:.382,range:.56,tilt:.18});
render(weapon('chixiao'),'백옥과 금동','흰 뱀을 암시하는 코등이 · 교차 감개','#out',{center:.005,range:.145,tilt:.20});
render(weapon('chixiao'),'붉은 강철','칼날의 능선 · 밑동의 구름 상감','#out',{center:.225,range:.19,tilt:.32});
render(weapon('qinggang'),'청강검','기존 동방 한손검','#details',{center:.382,range:.56,tilt:.18});
render(weapon('chixiao'),'적소검','같은 축척','#details',{center:.382,range:.56,tilt:.18});
render(weapon('goujian'),'월왕구천검','기존 동방 청동검','#details',{center:.382,range:.56,tilt:.18});
const back=weapon('chixiao');back.rotation.y=Math.PI;render(back,'뒷면','장식과 날은 양면','#reverse',{center:.005,range:.145,tilt:.20});
window.modelsReady=true;
