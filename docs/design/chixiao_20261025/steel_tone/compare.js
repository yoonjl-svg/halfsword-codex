import * as THREE from 'three';
import {WEAPONS,weaponMatOpts} from '../../../../src/weapons.js';
import {LOOKS} from '../../../../src/looks.js';
import {chixiaoPartMesh as before} from './before/chixiao_details.js';
function weapon(old){const w=WEAPONS.chixiao,g=new THREE.Group();w.buildParts(LOOKS.player).forEach(([shape,y,,color,isBlade,pose],i)=>{if(color==null)return;const m=(old?before:w.partMesh)(i,isBlade,shape,color,weaponMatOpts(w.material,isBlade,w.tier),LOOKS.player,w.tier);m.position.set(pose?.x??0,y,0);m.rotation.z=pose?.rotZ??0;g.add(m);});return g;}
function render(old,width,range,center,tilt){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#201c19');scene.add(new THREE.HemisphereLight(0xe7e8ec,0x685342,2));
 for(const [color,intensity,xyz]of [[0xffedd2,2,[-2,3,5]],[0xc0d3df,1.1,[3,0,2]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...xyz);scene.add(l);}
 const g=weapon(old),holder=new THREE.Group();g.position.y=-center;holder.add(g);holder.rotation.y=tilt;scene.add(holder);
 const h=560,camera=new THREE.OrthographicCamera(-range*width/h,range*width/h,range,-range,.01,10);camera.position.z=3;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1.5);renderer.setSize(width,h);renderer.render(scene,camera);return renderer.domElement;
}
for(const [old,label]of [[true,'이전 · 붉은 금속과 분홍빛 반사'],[false,'수정 · 적갈색 철빛과 은회색 날선']]){const fig=document.createElement('figure'),cap=document.createElement('figcaption'),views=document.createElement('div');cap.textContent=label;views.className='views';views.append(render(old,190,.56,.382,.18),render(old,260,.19,.225,.32));fig.append(cap,views);document.querySelector('#out').append(fig);}
window.ready=true;
