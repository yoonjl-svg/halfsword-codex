import * as T from 'three';
import { DRAGON } from './rules.js';
import { GROUND_GROUPS } from '../fighter.js';
import { setSupportFloor } from '../gait.js';
import { mergeStaticPieces } from './merge.js';

// 일반 게임과 같은 선형 조명/색공간. 평평하게 겹치는 바닥 면과 거대한 전경 기둥을 피한다.
export function createDragonArena(scene,R,world) {
  const fog=0xaeb9c0;scene.background=new T.Color(fog);scene.fog=new T.Fog(fog,28,95);
  scene.add(new T.HemisphereLight(0xd9e3ea,0x727069,1.2));
  const sun=new T.DirectionalLight(0xffe9d4,1.7);sun.position.set(-8,13,7);sun.target.position.set(0,0,0);sun.castShadow=false;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-11,right:11,top:10,bottom:-10,near:1,far:45});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
  const stone=new T.MeshStandardMaterial({color:0x898a83,roughness:1}),dark=new T.MeshStandardMaterial({color:0x51595b,roughness:1}),pale=new T.MeshStandardMaterial({color:0xa8a497,roughness:1});
  const floorMat=new T.MeshStandardMaterial({color:0x777b78,roughness:1});
  const mesh=(g,mat,p,cast=false)=>{const m=new T.Mesh(g,mat);m.position.set(...p);m.castShadow=cast;m.receiveShadow=true;scene.add(m);return m;};
  mesh(new T.CylinderGeometry(14.5,16,1.4,48),dark,[0,-.75,0]);
  const floor=mesh(new T.CylinderGeometry(13.5,13.5,.12,48),floorMat,[0,-.07,0]);
  let seed=713;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dummy=new T.Object3D(),positions=[];
  for(let row=-8;row<=8;row++)for(let col=-8;col<=8;col++){const x=col*1.6+(row%2)*.8,z=row*1.55;if(Math.hypot(x,z)<12.6)positions.push([x,z]);}
  const tiles=new T.InstancedMesh(new T.BoxGeometry(1.57,.02,1.52),stone,positions.length);tiles.receiveShadow=true;
  positions.forEach(([x,z],i)=>{dummy.position.set(x,.015,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);const c=.80+rand()*.15;tiles.setColorAt(i,new T.Color(c,c,c*.985));});scene.add(tiles);
  const ground=world.createRigidBody(R.RigidBodyDesc.fixed());setSupportFloor(world,world.createCollider(R.ColliderDesc.cuboid(30,.5,30).setTranslation(0,-.5,0).setFriction(.9).setCollisionGroups(GROUND_GROUPS),ground));
  for(let i=0;i<48;i++){const a=i*Math.PI/24,r=DRAGON.radius+.4;world.createCollider(R.ColliderDesc.cuboid(.2,1.2,.95).setTranslation(Math.cos(a)*r,1.2,Math.sin(a)*r).setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-a)).setCollisionGroups(GROUND_GROUPS),ground);}
  const blocks=[];
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20;if(Math.sin(a)>.4&&Math.cos(a)<.4)continue; // 카메라 쪽은 무너져 전장이 보인다.
    const height=2+Math.floor(rand()*4);for(let j=0;j<height;j++)blocks.push({x:Math.cos(a)*14,z:Math.sin(a)*14,y:.3+j*.58,a:-a});
  }
  const walls=new T.InstancedMesh(new T.BoxGeometry(1.2,.54,2.1),stone,blocks.length);walls.receiveShadow=true;
  blocks.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.a,0);dummy.scale.set(1,1,1);dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix);const c=.70+rand()*.2;walls.setColorAt(i,new T.Color(c,c,c));});scene.add(walls);
  // 수호룡 뒤쪽의 성문: 가려진 몸의 큰 규모와 오래 지킨 자리를 함께 보여준다.
  for(const z of[-4.1,4.1]){
    mesh(new T.BoxGeometry(1.5,6.8,1.65),dark,[11,3.3,z]);
    for(let j=0;j<5;j++)mesh(new T.BoxGeometry(1.6,.15,1.75),stone,[11,.65+j*1.25,z]);
  }
  // 하중을 받치는 쐐기돌 아치: 빠진 중간 돌/공중에 뜬 상부 조각을 만들지 않는다.
  for(let i=0;i<13;i++){
    const a=i/13*Math.PI+.004,b=(i+1)/13*Math.PI-.004,shape=new T.Shape();
    shape.moveTo(Math.cos(a)*4.25,Math.sin(a)*4.25*.62);shape.lineTo(Math.cos(b)*4.25,Math.sin(b)*4.25*.62);
    shape.lineTo(Math.cos(b)*3.35,Math.sin(b)*3.35*.62);shape.lineTo(Math.cos(a)*3.35,Math.sin(a)*3.35*.62);shape.closePath();
    const m=mesh(new T.ExtrudeGeometry(shape,{depth:1.5,bevelEnabled:false}),stone,[10.25,6.7,0]);m.rotation.y=Math.PI/2;
  }
  const covers=[{x:-3,z:-4.6,r:.65,h:2.4},{x:-2,z:5.6,r:.65,h:2.35},{x:-7,z:-4,r:.65,h:2.0}];
  for(const c of covers){
    mesh(new T.BoxGeometry(1.65,.25,1.65),dark,[c.x,.125,c.z]);
    for(let j=0;j<4;j++){const h=c.h/4;mesh(new T.CylinderGeometry(c.r*.87,c.r,h-.025,10),pale,[c.x,j*h+h/2+.04,c.z],true);}
    const broken=mesh(new T.DodecahedronGeometry(.6,0),stone,[c.x+.17,c.h+.06,c.z-.15]);broken.scale.set(.75,.2,.7);
    c.collider=world.createCollider(R.ColliderDesc.cuboid(c.r,c.h/2,c.r).setTranslation(c.x,c.h/2,c.z).setCollisionGroups(GROUND_GROUPS),ground);
  }
  const rubble=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),dark,55);rubble.receiveShadow=true;
  for(let i=0;i<55;i++){const a=rand()*Math.PI*2,r=11+rand()*1.7;dummy.position.set(Math.cos(a)*r,.12,Math.sin(a)*r);dummy.rotation.set(rand(),rand(),rand());dummy.scale.set(.15+rand()*.4,.1+rand()*.15,.2+rand()*.3);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);}scene.add(rubble);
  const iron=new T.MeshStandardMaterial({color:0x6c5b40,metalness:.35,roughness:.8});
  for(const z of[-4.1,4.1]){const ring=mesh(new T.TorusGeometry(.5,.055,6,16),iron,[10.15,1.7,z]);ring.rotation.y=Math.PI/2;}
  mesh(new T.CylinderGeometry(30,35,4,24),dark,[0,-3,0]);
  const far=new T.MeshStandardMaterial({color:0x8b9a9e,roughness:1});
  for(let i=0;i<10;i++){const a=i*Math.PI/5,g=new T.IcosahedronGeometry(1,1),m=mesh(g,far,[Math.cos(a)*56,-5,Math.sin(a)*56]);m.scale.set(18+rand()*9,7+rand()*8,15+rand()*10);}
  mergeStaticPieces(scene);
  return{covers,sun};
}
