// Three-o'clock stories: reuse terrain, collisions, weather and original events.
// New props remain outside the 10.5 m camera ring; none are combat objects.
import * as T from 'three';
import {beginNight} from './stage_night_variants.js';
import {buildClearingB} from './stage_clearing_b.js';
import {slopeY} from './stage_clearing.js';
import {buildCastle} from './stage_castle.js';
import {buildCathedral} from './stage_cathedral.js';
import {Kit,bakeLight,pointGlow,rng} from './stage_kit.js';

function workshop(root,seed){
 const kit=new Kit(seed);
 const put=(g,color,p,rot=[0,0,0],scale=1)=>{kit.put('props',g,color,p,rot,scale,{vary:.045});g.dispose()};
 const box=(s,c,p,rot)=>put(new T.BoxGeometry(...s),c,p,rot);
 const ball=(s,c,p)=>put(new T.SphereGeometry(1,7,5),c,p,[0,0,0],s);
 const rod=(a,b,r,c)=>{const aa=new T.Vector3(...a),bb=new T.Vector3(...b),v=bb.clone().sub(aa),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());
  const g=new T.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(q);put(g,c,aa.add(bb).multiplyScalar(.5).toArray())};
 const finish=(name,light)=>{const mesh=kit.mesh('props',new T.MeshStandardMaterial({vertexColors:true,roughness:.88,flatShading:true}),{light,cast:true});mesh.name=name;root.add(mesh);for(const g of kit.bins.props)g.dispose();return mesh};
 return {put,box,ball,rod,finish};
}
function bakeWarm(scene,original,points){
 const light=pointGlow(points),v=new T.Vector3(),done=new Set();scene.updateMatrixWorld(true);
 for(const o of original)o.traverse(m=>{
  if(!m.isMesh||m.isInstancedMesh||!m.geometry?.attributes.position||Array.isArray(m.material)||m.material.isMeshBasicMaterial||done.has(m.geometry))return;
  done.add(m.geometry);const g=m.geometry;
  if(!g.attributes.color)g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));
  m.material.vertexColors=true;m.material.needsUpdate=true;
  bakeLight(g,(x,y,z)=>{v.set(x,y,z).applyMatrix4(m.matrixWorld);return light(v.x,v.y,v.z)});
 });return light;
}
function flames(root,points){
 const mesh=new T.InstancedMesh(new T.ConeGeometry(1,1,6),new T.MeshBasicMaterial({color:0xffc77b}),points.length);
 mesh.name='night-story-flames';mesh.frustumCulled=false;root.add(mesh);const d=new T.Object3D();
 const update=t=>{points.forEach(([x,y,z,s],i)=>{d.position.set(x,y,z);d.rotation.set(.05*Math.sin(t*4+i),i,.06*Math.sin(t*6+i));d.scale.set(s*.28,s*(1+.11*Math.sin(t*9+i*1.3)),s*.28);d.updateMatrix();mesh.setMatrixAt(i,d.matrix)});mesh.instanceMatrix.needsUpdate=true};update(0);return update;
}
function lantern(w,x,y,z){
 w.box([.46,.07,.40],0x3c3329,[x,y-.25,z]);w.box([.46,.07,.40],0x3c3329,[x,y+.25,z]);
 for(const dx of [-.18,.18])for(const dz of [-.15,.15])w.box([.035,.5,.035],0x57462f,[x+dx,y,z+dz]);
 w.put(new T.ConeGeometry(.34,.20,4),0x635139,[x,y+.38,z],[0,Math.PI/4,0]);
 w.put(new T.TorusGeometry(.095,.012,4,12),0x95815a,[x,y+.56,z]);
 w.put(new T.CylinderGeometry(.055,.06,.18,7),0xcebb8e,[x,y-.12,z]);
}
function animate(stage,root,steps){
 const old=stage.update.bind(stage);let t=0;
 stage.update=dt=>{old(dt);t+=Math.min(.1,Math.max(0,dt));for(const step of steps)step(t)};
 root.userData.cameraSafeRadius=10.5;return stage;
}
// Small nocturnal life, batched wings. Moths orbit a lamp; bats cross the broken vault.
function winged(root,{bat=false,count=12,center,spread=1}){
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,0,0, .9,.05,-.3, .64,0,.34, 0,0,0,.64,0,.34,.24,0,.21],3));geo.computeVertexNormals();
 const mesh=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:bat?0x262733:0xd4bc8c,roughness:1,side:T.DoubleSide}),count*2);
 mesh.name=bat?'vault-bats':'lantern-moths';mesh.frustumCulled=false;root.add(mesh);const d=new T.Object3D(),r=rng(bat?1632:1631),ph=Array.from({length:count},()=>r()*6.28);
 return t=>{for(let i=0;i<count;i++){
  const a=t*(bat?.36:1.1)+ph[i],radius=spread*(.6+.4*(i%5)/4);
  const p=[center[0]+Math.cos(a)*radius,center[1]+Math.sin(a*1.7+i)*(bat?1.2:.28),center[2]+Math.sin(a)*radius];
  for(const s of [-1,1]){d.position.set(...p);d.rotation.set(0,-a,Math.sin(t*(bat?15:32)+i)*.85*s);const size=bat?.36:.075;d.scale.set(s*size,size,size);d.updateMatrix();mesh.setMatrixAt(i*2+(s>0?1:0),d.matrix)}
 }mesh.instanceMatrix.needsUpdate=true};
}
export function buildClearingNight(scene,lights){
 const {stage,root,original}=beginNight(scene,lights,buildClearingB,'clearing_night',{boundaryFires:false});
 lights.hemi.intensity=.93;lights.sun.intensity=.48;lights.sun.color.set(0xc0cbd3);
 // An empty rope on the original oak's dead branch. No body or named owner.
 const ox=-12.5,oz=-9.5,oy=slopeY(ox,oz,-1),a=2.6,len=3*.70;
 const lx=.15+Math.cos(a)*len,lz=.1+Math.sin(a)*len;
 const anchor=[ox+Math.cos(.3)*lx+Math.sin(.3)*lz,oy+4.2+len*.45,oz-Math.sin(.3)*lx+Math.cos(.3)*lz];
 const cord=new T.Group();cord.name='empty-oak-rope';cord.position.set(...anchor);root.add(cord);
 const ropeMat=new T.MeshStandardMaterial({color:0xb79d78,roughness:1});
 const strand=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.035,-1,0),new T.Vector3(0,-2.18,0)]),12,.022,5,false),ropeMat);cord.add(strand);
 const loop=new T.Mesh(new T.TorusGeometry(.24,.022,5,18),ropeMat);loop.position.set(0,-2.45,0);loop.scale.set(.86,1.2,1);cord.add(loop);
 const lamp=[anchor[0]+.28,slopeY(anchor[0]+.28,anchor[2],-1)+.55,anchor[2]],w=workshop(root,16301);
 w.put(new T.CylinderGeometry(.45,.53,.14,7),0x716b60,[lamp[0],lamp[1]-.37,lamp[2]]);lantern(w,...lamp);
 const light=bakeWarm(scene,original,[{x:lamp[0],y:lamp[1],z:lamp[2],r:13,c:[5,2.6,.8]}]);w.finish('oak-vigil-lantern',light);
 root.userData.stories=['회초리가 나온 참나무의 죽은 가지에 빈 노끈이 남아 있다. 누구의 흔적인지는 알 수 없다.','그 아래에는 아직 등불이 켜져 있고 밤나방이 모여든다. 누군가 다시 이 자리를 찾아왔을까.'];
 root.userData.details={rope:anchor,lamp};
 return animate(stage,root,[flames(root,[[lamp[0],lamp[1]+.02,lamp[2],.22]]),winged(root,{center:lamp,spread:.55}),t=>{cord.rotation.z=.025*Math.sin(t*.9);cord.rotation.x=.015*Math.sin(t*.6)}]);
}
export function buildCastleNight(scene,lights){
 const {stage,root,original}=beginNight(scene,lights,buildCastle,'castle_night',{boundaryFires:false});
 lights.hemi.intensity=.78;lights.sun.intensity=.44;stage.sunOffset={x:-7,y:9,z:4};
 const w=workshop(root,16302);
 // A route from the gate hugs the wall; repeated prints stop at the existing dummy.
 const foot=new T.Shape();foot.moveTo(-.055,-.15);foot.lineTo(.055,-.15);foot.lineTo(.055,-.045);foot.quadraticCurveTo(.09,.02,.068,.13);foot.quadraticCurveTo(0,.22,-.068,.13);foot.quadraticCurveTo(-.085,.025,-.045,-.035);foot.closePath();
 const sole=new T.ShapeGeometry(foot,5);sole.rotateX(-Math.PI/2);
 for(let i=0;i<42;i++){const a=Math.PI+i/41*1.86,rr=14.2+(i%2?.12:-.12),x=Math.cos(a)*rr,z=Math.sin(a)*rr;w.put(sole.clone(),0x8996a4,[x,.025,z],[0,-a+.08*Math.sin(i*3),0])}
 for(let row=0;row<3;row++)for(let i=0;i<6;i++)w.put(sole.clone(),row===1?0x82909e:0xa4adb4,[3.3+row*.34+(i%2?.05:-.05),.027,-11.5-i*.36],[0,.12*(row-1),0]);sole.dispose();
 // Cloak on a bench, practice sword leaning against it, one still-warm cup.
 const x=6.1,z=-12.9;
 w.box([1.65,.12,.54],0x71533d,[x,.52,z]);
 for(const dx of [-.62,.62])w.box([.14,.50,.4],0x4c3729,[x+dx,.25,z]);
 w.box([.68,.075,.68],0x647f95,[x-.2,.62,z+.03],[.03,.12,0]);
 w.box([.65,.48,.05],0x526c83,[x-.2,.34,z+.36],[.13,0,0]);
 w.rod([x+.7,.12,z+.55],[x+.52,1.35,z+.12],.043,0xac9065);
 w.rod([x+.32,1.10,z+.20],[x+.82,1.10,z+.20],.035,0x7e623d);
 w.put(new T.CylinderGeometry(.11,.09,.18,9,1,true),0x9a7351,[x+.54,.68,z]);
 lantern(w,4.7,1.05,-13.2);
 const light=bakeWarm(scene,original,[{x:4.7,y:1.15,z:-13.2,r:10,c:[4,2,.6]}]);w.finish('midnight-training-traces',light);
 root.userData.stories=['성문에서 훈련장으로 이어진 발자국. 허수아비 앞에는 짧은 왕복 자국이 겹쳐 있다.','벗어 둔 외투와 목검, 한 잔의 온기. 누군가는 다른 이들이 잠든 뒤에도 연습했다.'];
 root.userData.details={prints:[3.6,.03,-12.5],bench:[x,.6,z],dummy:[4,1.3,-14.2]};
 const steam=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(15*3),3)),new T.PointsMaterial({color:0xc0c5c8,size:.045,transparent:true,opacity:.23,depthWrite:false}));steam.name='training-cup-steam';root.add(steam);
 return animate(stage,root,[flames(root,[[4.7,1.08,-13.2,.20]]),t=>{const p=steam.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=(t*.13+i/p.count*.45)%.45;p.setXYZ(i,x+.54+Math.sin(t+i)*y*.12,.78+y,z+Math.cos(t*.7+i)*y*.1)}p.needsUpdate=true}]);
}
export function buildCathedralNight(scene,lights){
 const build=(scene,lights)=>buildCathedral(scene,lights,{emptyTomb:true});
 const {stage,root,original}=beginNight(scene,lights,build,'cathedral_night',{boundaryFires:false});
 // Daylight shafts are baked translucent cones: hide them at night to avoid
 // broad hard-edged bands over the sky. Moonlight comes from the shared light rig.
 for(const o of original)o.traverse(m=>{if(m.isMesh&&m.material?.isMeshBasicMaterial&&m.material.vertexColors&&m.material.transparent)m.visible=false;
  if(m.isPoints&&m.material?.color){m.material.color.set(0x9fb4cf);m.material.opacity*=.6}
 });
 lights.hemi.intensity=.80;lights.sun.intensity=.50;stage.sunOffset={x:-3,y:9,z:2.2};
 const w=workshop(root,16303),tx=-22.75,tz=16.8,sx=tx+.5,sz=tz-1.9;
 // A narrow dark socket and snapped vines remain where the sword stood.
 w.box([.06,.009,.28],0x1f252e,[sx,.024,sz],[0,.35,0]);
 for(let i=0;i<4;i++)w.rod([sx+.1*i,.055,sz+.07],[sx+.23+i*.12,.045,sz+.14+(i%2)*.3],.014,0x6f7958);
 // Interrupted scraping on the flagstones leads away, stopping before the arena.
 for(let i=0;i<16;i++){const t=i/15;w.box([.025,.006,.28],0x817c70,[sx+t*8.8,.024,sz-t*5.2],[0,-1.03,0]);}
 const light=bakeWarm(scene,original,[{x:tx,y:2,z:tz,r:7,c:[.8,1.0,1.4]}]);w.finish('missing-sword-trace',light);
 root.userData.stories=['박쥐들이 깨진 궁륭 사이를 오간다. 낮의 빈 천장이 밤에는 다른 생명의 통로가 된다.','관대의 유해와 장미에 감겼던 검이 사라졌다. 투구, 흐트러진 천과 끊어진 덩굴만 남아 있다.'];
 root.userData.details={tomb:[tx,.42,tz],socket:[sx,.03,sz],bats:[10,10,0]};
 return animate(stage,root,[winged(root,{bat:true,count:7,center:[10,10,0],spread:6})]);
}
