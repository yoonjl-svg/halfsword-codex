// 03:00 at the salt-road caravanserai: merchants' disguise / interrupted plot.
import * as T from 'three';
import {buildDayr} from './stage_dayr.js';
import {beginNight} from './stage_night_variants.js';
import {animate,workshop} from './stage_night_second.js';
import {addDayrCaravan} from './stage_dayr_caravan.js';
import {addDayrBlood} from './stage_dayr_blood.js';
import {canvasTex} from './stage_kit.js';

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
 // This night has a black zenith and a subdued blood-red horizon, not blue dawn.
 const sky=root.getObjectByName('midnight-sky').material;
 sky.map.dispose();
 sky.map=canvasTex(8,256,(c,w,h)=>{
  const g=c.createLinearGradient(0,0,0,h);
  for(const [at,color] of [[0,'#060405'],[.42,'#170c10'],[.52,'#291317'],[.65,'#1d0e11'],[1,'#090607']])g.addColorStop(at,color);
  c.fillStyle=g;c.fillRect(0,0,w,h);
 });
 sky.color.setHex(0xffffff);
 root.traverse(o=>{if(o.isPoints&&o.material.fog===false){o.material.opacity=.20;o.material.color.setHex(0xbda9a5);}});
 scene.getObjectByName('dayr-setting-sun').visible=false;
 const floor=scene.getObjectByName('dayr-floor'),a=floor.geometry.attributes.color,p=floor.geometry.attributes.position;
 // Remove the daytime baked orange gate beam only in this fresh night build.
 for(let i=0;i<a.count;i++){const v=.91+.012*Math.sin(p.getX(i)*1.3+p.getZ(i)*.8);a.setXYZ(i,v,v,v);}a.needsUpdate=true;
 scene.background=new T.Color(0x150d10);scene.fog=new T.Fog(0x150d10,55,220);
 lights.hemi.intensity=.22;lights.hemi.color.set(0x92a5bf);lights.hemi.groundColor.set(0x34323a);
 lights.sun.intensity=.12;lights.sun.color.set(0xa8bbd3);stage.sunOffset={x:9,y:14,z:5};lights.sun.position.set(9,14,5);
 // The sunset-specific narrow shadow frustum is unsuitable for a high moon.
 stage.shadow={left:-5,right:5,top:5,bottom:-5,near:.1,far:45,mapSize:1024,bias:0,normalBias:0,snap:true};
 stage.fighterLight={color:0x9ba8b6,rimColor:0xa6b8ca,rim:.68,level:.34};
 const caravan=addDayrCaravan(root),fire=lamps(root);
 addDayrBlood(scene,root);
 root.userData.stories=['문루 앞에는 짐을 실은 낙타들이 기다린다. 우물 곁에는 풀어놓은 안장과 물통이 남아 있다.',
  '상인의 천 아래 같은 단검들이 숨겨져 있다. 불빛 주변에 도면과 쓰러진 자들, 바닥과 벽의 핏자국이 드러난다. 모의는 끝나지 못했다.'];
 root.userData.details={caravan:[25.8,1.1,.1],conspiracy:[8.32,.5,-17.5],aftermath:[8,.2,-14.95],well:[13.5,.7,-11.4]};
 root.userData.addedColliders=0;root.userData.lamps=6;
 return animate(stage,root,[...caravan,fire]);
}
