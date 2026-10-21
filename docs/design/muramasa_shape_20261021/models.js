import * as THREE from 'three';
import { weaponPhysics } from '../../../src/weapon_class.js';
import { WEAPONS, weaponMatOpts, weaponSpecText } from '../../../src/weapons.js';
import { muramasaPartMesh as previousMesh, muramasaDecorate as previousDecorate } from './previous_details.js';
import previous from './before.json';
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
for(const id of ['uchigatana','muramasa','monohoshizao']){const w=WEAPONS[id];render(weapon(id),w.nameKo,weaponSpecText(w),'#out',{center:.44,range:.72,tilt:.22});}
render(weapon('muramasa'),'적갈색 감개','검은 마름모 · 각형 철 코등이','#details',{center:-.08,range:.20,tilt:0,lean:0});
render(weapon('muramasa'),'물결 하몬','은빛 담금질 무늬 · 단면의 능선','#details',{center:.40,range:.23,tilt:.25});
for(const id of ['balisarda','muramasa']){const w=WEAPONS[id];render(weapon(id),w.nameKo,`${w.tier==='legend'?'이탈리아 · 레전드':'일본 · 레어'} · 칼날 ${Math.round(w.bladeLength*100)}cm · ${weaponPhysics(w).mass.toFixed(2)}kg`,'#pair',{center:.44,range:.70,tilt:.25});}
const old=new THREE.Group();previous.muramasa.parts.forEach(([shape,y,,color,blade,pose],i)=>{const m=previousMesh(i,blade,shape,color,weaponMatOpts('steel',blade,'rare'),LOOKS.player,'rare');m.position.set(pose?.x??0,y,0);old.add(m);});previousDecorate.call({...WEAPONS.muramasa,bladeLength:.71},old);
render(old,'수정 전','날71cm · 거의 곧은 날','#shape-comparison',{center:.28,range:.56,tilt:0});
render(weapon('muramasa'),'수정 후','날70cm · 휨2cm · 1.12kg','#shape-comparison',{center:.28,range:.56,tilt:0});
window.modelsReady=true;
