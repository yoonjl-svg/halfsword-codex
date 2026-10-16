// 03:00 at the salt-road caravanserai. Both traces are scenery outside the duel.
import * as T from 'three';
import {buildDayr} from './stage_dayr.js';
import {beginNight} from './stage_night_variants.js';
import {animate,workshop} from './stage_night_second.js';
import {canvasTex,rng} from './stage_kit.js';

function holdingCell(root){
 const cell=new T.Group();cell.name='dayr-open-escort-cell';cell.position.set(8.32,0,-17.96);root.add(cell);
 const w=workshop(cell,171001),iron=0x706c60,edge=0x8b8070;
 // Use an existing vaulted lodging bay as the enclosure. One hinged leaf is
 // open into the court; the latch and severed link lie on the inner floor.
 for(const x of [-1.27,1.27])w.box([.10,2.75,.12],edge,[x,1.375,0]);
 w.box([2.64,.10,.12],edge,[0,2.75,0]);
 for(let i=0;i<5;i++)w.rod([.10+i*.26,.14,0],[.10+i*.26,2.70,0],.024,iron);
 for(const y of [.25,1.34,2.52])w.box([1.21,.066,.065],iron,[.65,y,0]);
 w.box([.18,.07,.09],edge,[.03,1.35,.02]);
 const open=new T.Group();open.name='dayr-cell-open-leaf';open.position.set(-1.27,0,0);open.rotation.y=-1.04;cell.add(open);
 const d=workshop(open,171002);
 for(let i=0;i<6;i++)d.rod([.06+i*.235,.14,0],[.06+i*.235,2.69,0],.024,iron);
 for(const y of [.25,1.34,2.52])d.box([1.28,.066,.065],iron,[.64,y,0]);
 for(const y of [.32,2.36])w.put(new T.TorusGeometry(.07,.017,5,10),edge,[-1.27,y,0],[Math.PI/2,0,0]);
 d.finish('dayr-open-cell-bars');
 w.box([.70,.08,1.65],0x6c6657,[.47,.05,-1.15]);
 for(const z of [-1.75,-.62])w.box([.68,.015,.12],0x9a8b6b,[.47,.097,z]);
 w.put(new T.CylinderGeometry(.14,.14,.64,12),0x9b8e75,[.47,.19,-1.78],[0,0,Math.PI/2]);
 // The door's chain was opened or cut, not a generic pile of debris.
 for(let i=0;i<6;i++)w.put(new T.TorusGeometry(.065,.014,5,12,i===5?Math.PI*1.55:Math.PI*2),i%2?edge:iron,[-.60+i*.083,.04,-.42-i*.045],[Math.PI/2,i%2?.5:0,.25]);
 w.box([.14,.11,.08],0x827665,[-.10,.075,-.67],[0,.4,0]);
 w.finish('dayr-cell-frame-and-traces');
 cell.userData={visualOnly:true,openLeafDegrees:59.6,occupied:false};
 return cell;
}

function footprints(root){
 const group=new T.Group();group.name='dayr-barefoot-salt-trail';root.add(group);
 const tex=canvasTex(64,128,(g,w,h)=>{
  g.fillStyle='#c4c0ad';g.beginPath();g.ellipse(31,82,13,28,-.08,0,Math.PI*2);g.fill();
  g.beginPath();g.ellipse(33,47,19,22,.05,0,Math.PI*2);g.fill();
  for(let i=0;i<5;i++){g.beginPath();g.ellipse(17+i*8,17+Math.abs(i-1)*3,5.5-i*.55,7.6-i*.6,0,0,Math.PI*2);g.fill();}
 });
 const material=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.60,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const geo=new T.PlaneGeometry(.17,.31);geo.rotateX(-Math.PI/2);
 const path=new T.CatmullRomCurve3([[8.32,.014,-17.55],[11.9,.014,-14.1],[14.2,.014,-9.5],[14.6,.014,-4.6],[18.2,.014,-.4],[23,.014,.45],[29,.014,.9]].map(p=>new T.Vector3(...p)));
 const count=48,marks=new T.InstancedMesh(geo,material,count),o=new T.Object3D();marks.name='dayr-bare-footprints';marks.frustumCulled=false;group.add(marks);
 const opacity=new Float32Array(count);geo.setAttribute('trailOpacity',new T.InstancedBufferAttribute(opacity,1));
 // Fade alpha, not RGB: darkening a pale print made its last steps turn black.
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float trailOpacity;\nvarying float vTrailOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTrailOpacity = trailOpacity;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vTrailOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vTrailOpacity;');
 };
 material.customProgramCacheKey=()=> 'dayr-trail-alpha-v1';
 let minRadius=Infinity;const data=[];
 for(let i=0;i<count;i++){
  const u=i/(count-1),p=path.getPointAt(u),t=path.getTangentAt(u),side=i%2?1:-1;
  p.x+=t.z*.095*side;p.z-=t.x*.095*side;
  // Outside the paving the original salt ground sits lower.
  if(p.x>21.5)p.y=-.055;
  o.position.copy(p);o.rotation.set(0,Math.atan2(t.x,t.z)+side*.07,0);o.scale.set(1,1,1);o.updateMatrix();marks.setMatrixAt(i,o.matrix);
  opacity[i]=u>.78?Math.max(0,1-(u-.78)/.22):1;
  minRadius=Math.min(minRadius,Math.hypot(p.x,p.z));data.push(p.toArray());
 }
 // Salt skim drifts across the last marks: a specific disappearing trail,
 // not a weather change affecting the physical floor or footsteps.
 const random=rng(171003),pos=new Float32Array(54*3),base=[];
 for(let i=0;i<54;i++){const p=[22+random()*10,.10+random()*.23,-1.2+random()*3.1];base.push(p);pos.set(p,i*3);}
 const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.BufferAttribute(pos,3));
 const dust=new T.Points(dustGeo,new T.PointsMaterial({color:0xc6c8bb,size:.045,transparent:true,opacity:.25,depthWrite:false}));dust.name='dayr-trail-salt-drift';dust.frustumCulled=false;group.add(dust);
 group.userData={footprints:count,minRadius,route:data,vanishesInSalt:true,visualOnly:true};
 return t=>{for(let i=0;i<54;i++){pos[i*3]=22+((base[i][0]-22+t*.33)%10);pos[i*3+1]=base[i][1]+.035*Math.sin(t*.7+i);pos[i*3+2]=base[i][2]+.10*Math.sin(t*.4+i);}dustGeo.attributes.position.needsUpdate=true;};
}

function lamps(root){
 const w=workshop(root,171004),flames=[],lights=[];
 // Lamps are attached to the actual wall/doorposts, not floating arena props.
 for(const [x,y,z] of [[6.75,2.1,-17.65],[16.05,2.5,-3.40],[16.05,2.5,3.40]]){
  w.box([.18,.24,.11],0x4f4840,[x,y-.23,z]);
  w.rod([x,y-.15,z],[x,y-.05,z+.30],.025,0x6f6350);
  w.put(new T.SphereGeometry(.14,10,5,0,Math.PI*2,Math.PI/2,Math.PI/2),0x9b744d,[x,y,z+.30]);
  const fire=new T.Mesh(new T.OctahedronGeometry(.105),new T.MeshBasicMaterial({color:0xffc88c}));fire.position.set(x,y+.06,z+.30);fire.scale.set(.35,1,.35);root.add(fire);flames.push(fire);
  const light=new T.PointLight(0xffcc91,8,7,2);light.position.set(x,y+.19,z+.55);root.add(light);lights.push(light);
 }
 w.finish('dayr-wall-oil-lamps');
 return t=>{flames.forEach((f,i)=>{const k=1+.09*Math.sin(t*6.1+i*2)+.04*Math.sin(t*10+i);f.scale.y=k;lights[i].intensity=8*k;});};
}

export function buildDayrNight(scene,lights){
 const {stage,root}=beginNight(scene,lights,buildDayr,'dayr_night',{boundaryFires:false});
 scene.getObjectByName('dayr-setting-sun').visible=false;
 const floor=scene.getObjectByName('dayr-floor'),a=floor.geometry.attributes.color,p=floor.geometry.attributes.position;
 // Remove the daytime baked orange gate beam only in this fresh night build.
 for(let i=0;i<a.count;i++){const v=.91+.012*Math.sin(p.getX(i)*1.3+p.getZ(i)*.8);a.setXYZ(i,v,v,v);}a.needsUpdate=true;
 scene.fog=new T.Fog(0x263446,72,290);
 lights.hemi.intensity=.98;lights.hemi.color.set(0xb8c7d8);lights.hemi.groundColor.set(0x4f4a47);
 lights.sun.intensity=.74;lights.sun.color.set(0xc1d0dc);stage.sunOffset={x:9,y:14,z:5};lights.sun.position.set(9,14,5);
 // The sunset-specific narrow shadow frustum is unsuitable for a high moon.
 stage.shadow={left:-5,right:5,top:5,bottom:-5,near:.1,far:45,mapSize:1024,bias:0,normalBias:0,snap:true};
 stage.fighterLight={color:0xc8c0b4,rimColor:0xc3d2db,rim:1.05,level:.56};
 holdingCell(root);const drift=footprints(root),fire=lamps(root);
 root.userData.stories=['호송대를 위해 닫아 두었던 아치방의 철창이 안쪽에서 열려 있다. 잠금 사슬과 빈 깔개만 남았다.',
  '맨발 자국이 결투장을 피해 문루 바깥 소금길로 이어진다. 마지막 흔적은 흘러가는 소금 먼지에 지워진다.'];
 root.userData.details={cell:[8.32,1.3,-17.96],tracks:[14.2,.1,-9.5],threshold:[23,.1,.45]};
 root.userData.addedColliders=0;root.userData.lamps=3;
 return animate(stage,root,[drift,fire]);
}
