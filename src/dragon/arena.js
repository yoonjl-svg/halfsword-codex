import * as T from 'three';
import { DRAGON } from './rules.js';
import { GROUND_GROUPS } from '../fighter.js';
import { setSupportFloor } from '../gait.js';
import { mergeStaticPieces } from './merge.js';

export function createDragonArena(scene,R,world) {
  scene.background=new T.Color(0x9ca69e);scene.fog=new T.Fog(0x9ca69e,24,72);
  const sky=new T.Mesh(new T.SphereGeometry(110,20,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(0x5d7b82)},horizon:{value:new T.Color(0xa9ab99)}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;varying vec3 p;void main(){float h=pow(clamp(normalize(p).y,0.0,1.0),0.6);gl_FragColor=vec4(mix(horizon,top,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));scene.add(sky);
  scene.add(new T.HemisphereLight(0xd9dfd0,0x343429,2.0));
  const sun=new T.DirectionalLight(0xffdfb3,2.5);sun.position.set(-10,18,-7);sun.castShadow=true;
  sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:50});sun.shadow.bias=-.001;scene.add(sun);
  const stone=new T.MeshStandardMaterial({color:0x797c6c,roughness:.98});
  const dark=new T.MeshStandardMaterial({color:0x4c554d,roughness:1});
  const pale=new T.MeshStandardMaterial({color:0xa7a38a,roughness:.93});
  const floorMat=new T.MeshStandardMaterial({color:0x73796c,roughness:1});
  function mesh(geo,mat,p,rot) {const m=new T.Mesh(geo,mat);m.position.set(...p);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
  mesh(new T.CylinderGeometry(15,16,1.2,64),dark,[0,-.62,0]);
  mesh(new T.CylinderGeometry(13.5,13.5,.1,64),floorMat,[0,-.06,0]);
  // 고정 난수로 풍화 차이만 낸다. 전투 난수는 건드리지 않는다.
  let seed=713;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dummy=new T.Object3D();const tileGeo=new T.BoxGeometry(1.54,.012,1.54);
  const positions=[];for(let x=-12;x<=12;x+=1.55)for(let z=-12;z<=12;z+=1.55)if(Math.hypot(x,z)<12.9)positions.push([x,z]);
  const tiles=new T.InstancedMesh(tileGeo,stone,positions.length);tiles.receiveShadow=true;
  positions.forEach(([x,z],i)=>{dummy.position.set(x,.004,z);dummy.rotation.set(0,(rand()-.5)*.015,0);dummy.scale.set(.997+rand()*.002,1,.997+rand()*.002);dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);tiles.setColorAt(i,new T.Color().setHSL(.16,.05,.36+rand()*.035));});scene.add(tiles);
  const ground=world.createRigidBody(R.RigidBodyDesc.fixed());
  const floor=world.createCollider(R.ColliderDesc.cuboid(30,.5,30).setTranslation(0,-.5,0).setFriction(.9).setCollisionGroups(GROUND_GROUPS),ground);setSupportFloor(world,floor);
  for(let i=0;i<48;i++) {
    const a=i*Math.PI*2/48,r=DRAGON.radius+.4;
    const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-a);
    world.createCollider(R.ColliderDesc.cuboid(.2,1.2,r*Math.tan(Math.PI/48)+.05).setTranslation(Math.cos(a)*r,1.2,Math.sin(a)*r).setRotation(q).setCollisionGroups(GROUND_GROUPS),ground);
  }
  const blocks=[];
  for(let i=0;i<50;i++) {
    const a=i/50*Math.PI*2;
    if(a>2.5&&a<3.65)continue;
    const r=14.1,h=2+Math.floor(rand()*4);
    for(let j=0;j<h;j++)blocks.push({p:[Math.cos(a)*r,j*.58+.29,Math.sin(a)*r],rot:-a,s:[1.05,.52,1.64]});
    if(i%9===0){mesh(new T.CylinderGeometry(1,1.3,6.7,8),dark,[Math.cos(a)*15.1,3.2,Math.sin(a)*15.1]);}
  }
  const walls=new T.InstancedMesh(new T.BoxGeometry(1,1,1),stone,blocks.length);walls.castShadow=true;walls.receiveShadow=true;
  blocks.forEach((b,i)=>{dummy.position.set(...b.p);dummy.rotation.set(0,b.rot,0);dummy.scale.set(...b.s);dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix);walls.setColorAt(i,new T.Color().setHSL(.13,.08,.31+rand()*.13));});scene.add(walls);
  // 무너진 입구 아치와 옛 성문.
  for(const z of[-2.1,2.1]) {
    mesh(new T.BoxGeometry(1.2,5.5,.9),pale,[-13.4,2.7,z]);
    mesh(new T.BoxGeometry(1.5,.25,1.2),dark,[-13.4,4.6,z]);
  }
  for(let i=0;i<9;i++){const a=i/8*Math.PI; if(i===3)continue;mesh(new T.BoxGeometry(1.15,.66,.8),pale,[-13.4,4.5+Math.sin(a)*2.2,Math.cos(a)*2.2],[a-Math.PI/2,0,0]);}
  const covers=[{x:-3,z:-4,r:.8,h:2.8},{x:1.7,z:4.7,r:.8,h:2.5},{x:-6.7,z:2.1,r:.7,h:2.2}];
  for(const c of covers) {
    mesh(new T.BoxGeometry(c.r*2.4,.3,c.r*2.4),dark,[c.x,.15,c.z]);
    mesh(new T.CylinderGeometry(c.r*.75,c.r,c.h,8),pale,[c.x,c.h/2,c.z]);
    for(let j=0;j<4;j++)mesh(new T.CylinderGeometry(c.r*.82,c.r*.82,.055,8),dark,[c.x,.5+j*.48,c.z]);
    const body=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(c.x,c.h/2,c.z));
    c.collider=world.createCollider(R.ColliderDesc.cuboid(c.r,c.h/2,c.r).setFriction(.7).setCollisionGroups(GROUND_GROUPS),body);
  }
  const rubble=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),dark,55);rubble.castShadow=true;rubble.receiveShadow=true;
  for(let i=0;i<55;i++){const a=rand()*Math.PI*2,r=11+rand()*1.6;dummy.position.set(Math.cos(a)*r,.1,Math.sin(a)*r);dummy.rotation.set(rand(),rand(),rand());dummy.scale.set(.15+rand()*.4,.08+rand()*.2,.12+rand()*.25);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);}scene.add(rubble);
  // 용의 목고리와 같은 문장이 남은 옛 고정 고리.
  const iron=new T.MeshStandardMaterial({color:0x5b4f38,metalness:.45,roughness:.8});
  const ring=mesh(new T.TorusGeometry(.55,.055,5,14),iron,[11.7,1.4,0],[0,Math.PI/2,0]);
  mesh(new T.BoxGeometry(.3,2.5,2.8),pale,[12,1.4,0]);ring.position.x=11.78;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;mesh(new T.BoxGeometry(.05,.3,.07),iron,[11.8,1.4+Math.sin(a)*.82,Math.cos(a)*.82],[a,0,0]);}
  // 성채를 받치는 절벽과 협곡·마른 나무로 지면의 연속성을 만든다.
  mesh(new T.CylinderGeometry(29,34,4,24),dark,[0,-3.2,0]);
  const distant=new T.MeshStandardMaterial({color:0x6e817b,roughness:1});
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=53+rand()*12;const geo=new T.IcosahedronGeometry(1,1);const v=geo.attributes.position;for(let k=0;k<v.count;k++){const f=1+Math.sin(v.getX(k)*13+v.getY(k)*7+v.getZ(k)*19)*.09;v.setXYZ(k,v.getX(k)*f,v.getY(k)*f,v.getZ(k)*f);}geo.computeVertexNormals();const mountain=mesh(geo,distant,[Math.cos(a)*r,-3,Math.sin(a)*r]);mountain.scale.set(17+rand()*8,7+rand()*6,10+rand()*8);}
  for(let i=0;i<6;i++) {const a=i*.8,r=18;const x=Math.cos(a)*r,z=Math.sin(a)*r;mesh(new T.CylinderGeometry(.08,.2,4,5),dark,[x,1.5,z]);for(let k=0;k<2;k++)mesh(new T.CylinderGeometry(.025,.08,1.8,4),dark,[x+(k?-.5:.5),2.2,z],[0,0,k?-.65:.65]);}
  mergeStaticPieces(scene);
  return {covers,sun};
}
