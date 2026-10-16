// Three-o'clock variants share the original terrain and physical rules.
// Story objects are visual only, outside the duel/camera space.
import * as THREE from 'three';
import {buildFrozenBay} from './stage_frozen_bay.js';
import {buildTemple} from './stage_temple.js';
import {canvasTex,rng} from './stage_kit.js';
import {addNightBoundaryFires} from './stage_night_lamps.js';

const NIGHT=0x24324a;
export function beginNight(scene,lights,build,id,{boundaryFires=true,nightSky=true}={}){
  const before=new Set(scene.children),stage=build(scene,lights);
  const original=scene.children.filter(o=>!before.has(o));
  const mats=new Set();
  for(const o of original)o.traverse(c=>{
    const m=c.material;
    if(c.isMesh&&c.geometry.type==='SphereGeometry'&&c.geometry.parameters.radius>=200&&m?.side===THREE.BackSide)c.visible=false;
    for(const x of Array.isArray(m)?m:[m])if(x&&!mats.has(x)){mats.add(x);
      // Distant painted mountain layers must lose their daytime brightness too.
      if(x.isMeshBasicMaterial&&x.vertexColors)x.color.multiplyScalar(.16);
    }
  });
  scene.background=new THREE.Color(NIGHT);scene.fog=new THREE.Fog(NIGHT,55,id==='temple_night'?350:210);
  lights.hemi.color.set(0xa6bad1);lights.hemi.groundColor.set(0x39334a);lights.hemi.intensity=.85;
  lights.sun.color.set(0xb9cee4);lights.sun.intensity=.55;
  stage.sunOffset={x:7,y:9,z:-4};
  stage.nightHour=3;
  lights.sun.position.set(7,9,-4);
  stage.fighterLight={color:0xc7bec8,rimColor:0x9dc9d7,rim:1.25,level:.50};
  const root=new THREE.Group();root.name=id+'-story';root.userData={hour:3,visualOnly:true,stories:[]};scene.add(root);
  if(nightSky){
  const sky=canvasTex(8,256,(g,w,h)=>{const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#0b1427');grad.addColorStop(.46,'#2e405a');grad.addColorStop(.55,'#46576b');grad.addColorStop(1,'#17243a');g.fillStyle=grad;g.fillRect(0,0,w,h)});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(510,24,12),new THREE.MeshBasicMaterial({map:sky,side:THREE.BackSide,fog:false,depthWrite:false}));dome.name='midnight-sky';root.add(dome);
  const r=rng(31016),pos=[];
  for(let i=0;i<700;i++){const a=r()*Math.PI*2,y=.08+r()*.92,rr=Math.sqrt(1-y*y);pos.push(Math.cos(a)*rr*430,y*430,Math.sin(a)*rr*430)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  root.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xb4c3d9,size:1.1,sizeAttenuation:false,fog:false,transparent:true,opacity:.66,depthWrite:false})));
  }
  const fires=boundaryFires?addNightBoundaryFires(scene,root,original,id==='temple_night'):()=>{};
  return {stage,root,fires,original};
}
function addMesh(root,geo,color,pos,scale){
 const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.95,flatShading:true}));
 if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);root.add(m);m.castShadow=true;return m;
}
function moon(root){
 const map=canvasTex(256,256,(g)=>{g.fillStyle='#d8dfd6';g.beginPath();g.arc(128,128,103,0,Math.PI*2);g.fill();g.globalCompositeOperation='destination-out';g.beginPath();g.arc(168,108,103,0,Math.PI*2);g.fill();g.globalCompositeOperation='source-over';});
 const m=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,fog:false,depthWrite:false,color:0xc2d1ce}));m.name='temple-crescent';m.position.set(429,315,-69);m.scale.set(54,54,1);root.add(m);return m;
}
function aurora(root){
 const texture=canvasTex(256,128,(g,w,h)=>{
  for(let x=0;x<w;x++){const a=(.40+.13*Math.sin(x*.23+Math.sin(x*.071)*2)+.07*Math.sin(x*.63))*Math.sin(Math.PI*x/(w-1))**.45;const q=g.createLinearGradient(0,0,0,h);
   q.addColorStop(0,'rgba(116,85,169,0)');q.addColorStop(.24,`rgba(110,93,168,${a*.40})`);q.addColorStop(.65,`rgba(84,181,159,${a})`);q.addColorStop(.88,`rgba(132,213,165,${a*.80})`);q.addColorStop(1,'rgba(76,166,155,0)');g.fillStyle=q;g.fillRect(x,0,1,h);
  }
 });
 const bands=[];
 for(let b=0;b<2;b++){
  const n=100,pos=[],uv=[],idx=[];
  for(let i=0;i<=n;i++)for(let j=0;j<2;j++){const u=i/n;pos.push(145+b*44+24*Math.sin(u*8+b),22+b*10+7*Math.sin(u*5+b)+j*(18+5*Math.sin(u*9)),(u-.5)*360);uv.push(u,1-j);if(i<n&&j===0){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:true,opacity:b?.40:.76,depthWrite:false,fog:false}));m.name='aurora-curtain-'+b;m.frustumCulled=false;root.add(m);bands.push({m,base:Float32Array.from(pos),b});
 }
 return t=>{for(const {m,base,b} of bands){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const u=i/(p.count-1);p.setY(i,base[i*3+1]+1.7*Math.sin(u*8+t*.15+b));p.setX(i,base[i*3]+2*Math.sin(u*12+t*.11));}p.needsUpdate=true;}};
}
function cub(root){
 const g=new THREE.Group();g.name='visiting-bear-cub';g.position.set(12.8,.04,6.5);g.rotation.y=Math.atan2(-12.8,-6.5);root.add(g);
 const fur=0xc5c4ba,dark=0x171c27;
 const shape=new THREE.SphereGeometry(1,8,6),materials=new Map([fur,dark].map(c=>[c,new THREE.MeshStandardMaterial({color:c,roughness:.95,flatShading:true})]));
 const blob=(p,s,col=fur,parent=g)=>{const m=new THREE.Mesh(shape,materials.get(col));m.position.set(...p);m.scale.set(...s);m.castShadow=true;parent.add(m);return m};
 blob([0,.34,0],[.30,.35,.40]);blob([0,.60,.15],[.26,.28,.26]);
 for(const s of [-1,1]){blob([s*.18,.11,.20],[.13,.12,.23]);blob([s*.24,.14,-.20],[.17,.14,.21]);}
 const head=new THREE.Group();head.position.set(0,.82,.27);g.add(head);
 blob([0,0,0],[.23,.21,.23],fur,head);blob([0,-.06,.23],[.13,.09,.16],fur,head);
 blob([0,-.055,.355],[.06,.045,.04],dark,head);
 for(const s of [-1,1]){blob([s*.15,.15,-.02],[.085,.08,.055],fur,head);blob([s*.098,.025,.205],[.024,.025,.018],dark,head);}
 // Small paired tracks lead from the adult's bank to the waiting visitor.
 const tracks=new THREE.InstancedMesh(new THREE.CircleGeometry(.12,7),new THREE.MeshBasicMaterial({color:0x526975,transparent:true,opacity:.52,depthWrite:false}),44);
 tracks.name='cub-arrival-tracks';root.add(tracks);const paw=new THREE.Object3D();let index=0;
 for(let i=0;i<22;i++){const t=i/21,x=14+t*17,z=7+t*12,y=.025;for(const s of [-1,1]){
  paw.rotation.x=-Math.PI/2;paw.position.set(x+s*.18,y,z-s*.11);paw.scale.set(1,1.35,1);paw.updateMatrix();tracks.setMatrixAt(index++,paw.matrix);
 }}
 return t=>{head.rotation.y=.10*Math.sin(t*.3);head.rotation.x=.025*Math.sin(t*.7);g.scale.y=1+.008*Math.sin(t*1.8)};
}
export function buildFrozenBayNight(scene,lights){
 const {stage,root,fires}=beginNight(scene,lights,buildFrozenBay,'frozen_bay_night');
 root.userData.stories=['오로라 아래, 작은 발자국이 물가에서 결투장 가까이 이어진다.','어른 곰은 물가에 남고 새끼곰은 투야나가 서는 쪽을 기다린다.'];
 const glow=aurora(root),visit=cub(root),old=stage.update.bind(stage);let t=0;
 stage.update=dt=>{old(dt);t+=Math.min(.1,Math.max(0,dt));glow(t);visit(t);fires(t)};
 return stage;
}
function candle(root,x,y,z,height=.34){
 const g=new THREE.Group();g.name='waiting-candle';g.position.set(x,y,z);root.add(g);
 addMesh(g,new THREE.CylinderGeometry(.045,.058,height,8),0xd2c0a0,[0,height/2,0]);
 const flame=new THREE.Mesh(new THREE.OctahedronGeometry(.075),new THREE.MeshBasicMaterial({color:0xffc16c}));flame.position.y=height+.055;flame.scale.set(.4,1,.4);g.add(flame);
 const light=new THREE.PointLight(0xffc17b,1.8,3,2);light.position.set(0,height+.2,0);g.add(light);
 return t=>{flame.scale.y=1+.12*Math.sin(t*5+x);light.intensity=1.8+.15*Math.sin(t*5+x)};
}
function templeTrace(root){
 const stone=new THREE.Group();stone.name='left-behind-eyepatch';stone.position.set(11.8,0,5.2);root.add(stone);
 addMesh(stone,new THREE.BoxGeometry(1.7,.42,1.0),0x53575d,[0,.21,0]);
 addMesh(stone,new THREE.BoxGeometry(.73,.025,.36),0xc8bba2,[0,.45,0]);
 addMesh(stone,new THREE.SphereGeometry(.11,10,6),0x201f23,[-.22,.49,.07],[1,.20,.85]);
 const thread=new THREE.Mesh(new THREE.TorusGeometry(.22,.009,4,20),new THREE.MeshStandardMaterial({color:0x302b2c,roughness:1}));thread.rotation.x=Math.PI/2;thread.position.set(-.12,.48,.03);stone.add(thread);
 // Two cups at an empty seat; a candle still burns for someone who has not returned.
 const seat=new THREE.Group();seat.name='tea-for-the-absent';seat.position.set(12.8,0,-4.4);root.add(seat);
 addMesh(seat,new THREE.BoxGeometry(1.8,.20,.8),0x433124,[0,.22,0]);
 for(const s of [-1,1]){addMesh(seat,new THREE.CylinderGeometry(.10,.07,.11,12,1,true),0x9b9b8e,[s*.36,.375,0]);
 if(s===1){const tea=new THREE.Mesh(new THREE.CircleGeometry(.085,16),new THREE.MeshStandardMaterial({color:0x4e3528,roughness:.3}));tea.rotation.x=-Math.PI/2;tea.position.set(s*.36,.412,0);seat.add(tea);}}
 addMesh(seat,new THREE.BoxGeometry(.55,.10,.48),0x665345,[0,.05,.85]);
 const a=candle(root,11.8,.44,5.45,.28),b=candle(root,12.8,.32,-4.65,.23);
 return t=>{a(t);b(t)};
}
export function buildTempleNight(scene,lights){
 const {stage,root,fires}=beginNight(scene,lights,buildTemple,'temple_night');moon(root);
 root.userData.stories=['초승달 아래 돌 위에 한쪽 안대와 남은 천이 놓여 있다.','빈 자리 앞의 찻잔 둘과 아직 타는 촛불. 누군가 돌아오기를 기다렸을까.'];
 const candles=templeTrace(root),old=stage.update.bind(stage);let t=0;
 stage.update=dt=>{old(dt);t+=Math.min(.1,Math.max(0,dt));candles(t);fires(t)};
 return stage;
}
