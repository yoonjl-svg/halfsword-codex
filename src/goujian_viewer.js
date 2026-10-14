import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getWeapon, weaponMatOpts } from './weapons.js';
import { LOOKS } from './looks.js';
function createGoujian() {
  const spec=getWeapon('goujian'), group=new THREE.Group();
  spec.buildParts(LOOKS.player).forEach(([shape,y,,color,blade],index)=>{
    const mesh=spec.partMesh(index,blade,shape,color,weaponMatOpts(spec.material,blade,spec.tier),LOOKS.player,spec.tier);
    mesh.position.y=y;group.add(mesh);
  });
  spec.decorate?.(group,LOOKS.player);return group;
}

const host=document.querySelector('#viewer'),status=document.querySelector('#status');
try{
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x242827);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.88;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,1,0.01,30);
  scene.add(new THREE.HemisphereLight(0xe8edf0,0x5f5044,1.3));
  for(const [color,intensity,pos]of [[0xffedd2,1.8,[-2,3,4]],[0xc9dded,1.1,[3,2,-2]],[0xffffff,0.6,[1,0,4]]]){
    const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);
  }
  const model=createGoujian();scene.add(model);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=true;controls.enableDamping=false;
  controls.minDistance=0.08;controls.maxDistance=8;controls.rotateSpeed=0.65;
  let lost=false,active='whole',adjusted=false;
  const render=()=>{if(!lost)renderer.render(scene,camera);};
  const views={whole:{target:[0,.335,0],height:1.01,angle:[.22,.035,1]},
    hilt:{target:[0,.014,0],height:.24,angle:[.38,-.18,1]},
    blade:{target:[0,.30,0],height:.31,angle:[.32,.03,1]},
    edge:{target:[0,.30,0],height:.31,angle:[1,.04,.32]},
    pommel:{target:[0,-.055,0],height:.17,angle:[.55,-1,.65]}};
  function frame(id){
    active=id;adjusted=false;const v=views[id],height=Math.max(v.height,id==='whole'?.12/camera.aspect:.09/camera.aspect);
    controls.target.set(...v.target);camera.position.copy(controls.target).add(new THREE.Vector3(...v.angle).normalize().multiplyScalar(height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))));
    controls.update();render();
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===id)));
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(adjusted)render();else frame(active);}
  controls.addEventListener('start',()=>{adjusted=true;});
  controls.addEventListener('change',render);
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>frame(b.dataset.view)));
  for(const [id,factor]of [['zoom-in',0.8],['zoom-out',1.25]])document.getElementById(id).addEventListener('click',()=>{
    adjusted=true;
    const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();render();
  });
  const ro=new ResizeObserver(resize);ro.observe(host);resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;status.textContent='3D 화면을 복구하는 중입니다. 아래 사진도 볼 수 있어요.';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;status.textContent='한 손가락 회전 · 두 손가락 확대/이동';render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  window.addEventListener('pagehide',event=>{if(!event.persisted){controls.dispose();ro.disconnect();const geos=new Set(),mats=new Set();model.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material||[]))mats.add(m);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();}});
  status.textContent='한 손가락 회전 · 두 손가락 확대/이동';
  // Read-only rendering inspection for reproducible screenshots, not a game controller.
  window.goujianView={model,camera,controls,renderer,frame,render,scene};
}catch(e){status.textContent='이 브라우저에서 3D를 열지 못했어요. 아래 실제 모델 사진을 봐 주세요.';console.error(e);}
