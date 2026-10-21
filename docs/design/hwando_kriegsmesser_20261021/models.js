import * as THREE from 'three';
import {WEAPONS,weaponMatOpts,weaponSpecText} from '../../../src/weapons.js';
import {LOOKS} from '../../../src/looks.js';
for(const id of ['hwando','kriegsmesser','longsword']){
 const w=WEAPONS[id],group=new THREE.Group();
 w.buildParts(LOOKS.player).forEach(([shape,y,,color,isBlade],pi)=>{let mesh=w.partMesh?.(pi,isBlade,shape,color,weaponMatOpts(w.material,isBlade,w.tier),LOOKS.player,w.tier);if(!mesh){const geo=shape[0]==='ball'?new THREE.SphereGeometry(shape[1]):new THREE.BoxGeometry(shape[1]*2,shape[2]*2,shape[3]*2);mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color}));}mesh.position.y=y;group.add(mesh);});w.decorate?.(group,LOOKS.player);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#201c19');scene.add(new THREE.HemisphereLight(0xe7e8ec,0x685342,2.0));const light=new THREE.DirectionalLight(0xffedd2,2);light.position.set(-2,3,5);scene.add(light);const fill=new THREE.DirectionalLight(0xc0d3df,1.1);fill.position.set(3,0,2);scene.add(fill);scene.add(group);group.rotation.y=.25;
 const camera=new THREE.OrthographicCamera(-.44,.44,.7,-.7,.01,10);camera.position.set(0,.5,3);camera.lookAt(0,.5,0);
 const render=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});render.setPixelRatio(1.5);render.setSize(360,572);render.render(scene,camera);
 const fig=document.createElement('figure'),cap=document.createElement('figcaption');cap.textContent=w.nameKo;const small=document.createElement('small');small.textContent=weaponSpecText(w);cap.append(small);fig.append(render.domElement,cap);document.querySelector('#out').append(fig);
}
window.modelsReady=true;
