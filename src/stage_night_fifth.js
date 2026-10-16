// Midnight stories on the existing terrain. Props have no combat colliders.
import * as T from 'three';
import {buildEtna,landHeight} from './stage_etna.js';
import {buildQinglan} from './stage_qinglan.js';
import {beginNight} from './stage_night_variants.js';
import {workshop,animate} from './stage_night_second.js';
import {canvasTex,rng} from './stage_kit.js';

function add(parent,geo,mat,pos,name){const m=new T.Mesh(geo,mat);m.name=name;m.position.set(...pos);m.castShadow=true;parent.add(m);return m}
const rough=color=>new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide});
function deepSky(root,scene){
 const sky=root.getObjectByName('midnight-sky');
 const map=canvasTex(8,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#080f1d');g.addColorStop(.5,'#1d2e44');g.addColorStop(1,'#101a29');c.fillStyle=g;c.fillRect(0,0,w,h)});
 sky.material.map.dispose();sky.material.map=map;sky.material.needsUpdate=true;scene.background=new T.Color(0x1d2e44);
}

function stoppedWatercourse(root){
 const w=workshop(root,16511),x=13.4,r=rng(16510);
 const stone=(size,col,pos)=>{const geo=new T.BoxGeometry(...size),p=geo.attributes.position;const offsets=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].join();if(!offsets.has(key))offsets.set(key,[r()*.07-.035,r()*.06-.03,r()*.07-.035]);const d=offsets.get(key);p.setXYZ(i,p.getX(i)+d[0],p.getY(i)+d[1],p.getZ(i)+d[2])}geo.computeVertexNormals();w.put(geo,col,pos,[0,(r()-.5)*.06,0])};
 // A raised, dry masonry gutter follows the existing slope, ending in a plug
 // of cooled basalt. Foundations extend into the actual scenery height.
 for(let i=0;i<22;i++){
  const z=-9.5+i*.55,y=landHeight(x,z);
  stone([1.5,.32,.57],i%3?0x76756c:0x89877b,[x,y+.10,z]);
  for(const s of [-1,1])stone([.26,.43+r()*.15,.53],i%2?0x8b8879:0x686b66,[x+s*.67,y+.30,z]);
  w.box([.93,.014,.53],0x424741,[x,y+.27,z]);
  // Pale mineral rings record a water line above the now-empty channel.
  for(const s of [-1,1])w.box([.012,.035,.47],0xb4b19a,[x+s*.532,y+.43,z]);
 }
 const plugZ=-1.6,plugY=landHeight(x,plugZ);
 for(let i=0;i<9;i++)w.ball([.60,.27,.58],i%2?0x24272b:0x343537,[x+(i%3-1)*.47,plugY+.34+Math.floor(i/3)*.16,plugZ+(Math.floor(i/3)-1)*.43]);
 w.finish('lava-blocked-watercourse');
 const hot=new T.Group();hot.name='watercourse-cooling-cracks';root.add(hot);
 const glow=new T.MeshBasicMaterial({color:0xb34e2a});
 for(let i=0;i<4;i++)add(hot,new T.BoxGeometry(.48,.012,.025),glow,[x-.2+i*.14,plugY+.62+i*.025,plugZ-.45+i*.22],'last-red-seam').rotation.y=.2+i*.35;
 return {channel:[x,landHeight(x,-4)+.4,-4],plug:[x,plugY+.5,plugZ]};
}

function lastWater(root){
 const x=11.8,z=-5.4,y=landHeight(x,z),group=new T.Group();group.name='broken-water-jars';group.position.set(x,y+.10,z);root.add(group);
 const profile=[[0,0],[.24,.02],[.39,.20],[.43,.54],[.34,.80],[.23,.94],[.24,1.02]].map(p=>new T.Vector2(...p));
 const clay=rough(0x9b7960),inside=rough(0x494136);
 // A missing quarter makes the broken mouth/body visible, not a solid urn.
 const shell=new T.LatheGeometry(profile,20,.22,Math.PI*1.55);
 const jar=add(group,shell,clay,[0,.10,0],'fractured-water-jar');jar.rotation.set(.10,-.12,-.40);
 // Seat the broken base on the slope; the missing side faces the duel terrace.
 group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(jar);jar.position.y+=y+.025-bounds.min.y;
 const inner=shell.clone();inner.scale(.97,.98,.97);const lining=add(group,inner,inside,jar.position.toArray(),'dark-jar-interior');lining.rotation.copy(jar.rotation);
 const w=workshop(group,16512);
 for(let i=0;i<8;i++)w.put(new T.CylinderGeometry(.21,.17,.038,5,1,true,0,1.9),i%2?0xa88b6c:0x7a604b,[.15+Math.sin(i*2.1)*.72,.025,Math.cos(i*2.1)*.6],[.1*i,i,.15]);
 // A second intact small jar and a snapped carrying yoke imply a failed delivery.
 w.put(new T.LatheGeometry(profile.map(v=>v.clone().multiplyScalar(.68)),16),0x6f725f,[-.66,0,-.7]);
 w.rod([-.8,.14,-.8],[.75,.18,-.82],.045,0x69604d);w.rod([.84,.17,-.82],[1.25,.09,-.55],.045,0x8e7a5c);
 w.finish('water-jar-shards-and-yoke');
 const wet=add(root,new T.CircleGeometry(.72,24),new T.MeshStandardMaterial({color:0x313f40,roughness:.22,transparent:true,opacity:.72,depthWrite:false}),[x+.45,landHeight(x+.45,z+.7)+.025,z+.7],'last-water-wet-stone');wet.rotation.x=-Math.PI/2;wet.scale.set(.52,1.8,1);
 const map=canvasTex(64,64,c=>{const q=c.createRadialGradient(32,32,0,32,32,32);q.addColorStop(0,'rgba(188,199,207,.6)');q.addColorStop(.4,'rgba(175,189,200,.25)');q.addColorStop(1,'rgba(175,189,200,0)');c.fillStyle=q;c.fillRect(0,0,64,64)});
 const r=rng(16513),p=new Float32Array(18*3),seeds=Array.from({length:18},()=>r());
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p,3));
 const steam=new T.Points(geo,new T.PointsMaterial({map,color:0xb5c5cf,size:.65,transparent:true,opacity:.28,depthWrite:false}));steam.name='last-water-steam';root.add(steam);
 return {position:[x,y+.6,z],update:t=>{for(let i=0;i<seeds.length;i++){const q=(t*.12+seeds[i])%1;geo.attributes.position.setXYZ(i,x+.55+.25*Math.sin(q*4+i),y+.15+q*1.65,z+.6+.19*Math.sin(q*3+i))}geo.attributes.position.needsUpdate=true}};
}

export function buildEtnaNight(scene,lights){
 const {stage,root}=beginNight(scene,lights,buildEtna,'etna_night',{boundaryFires:false});
 deepSky(root,scene);
 lights.hemi.intensity=1.00;lights.sun.intensity=.68;
 lights.hemi.groundColor.set(0x57434a);stage.fighterLight={color:0xc9c2bb,rimColor:0xdd9d72,rim:1.05,level:.60};
 scene.fog=new T.Fog(0x283343,65,330);
 const channel=stoppedWatercourse(root),water=lastWater(root);
 root.userData.stories=['옛 돌 물길의 안쪽에 물때만 남았다. 검게 굳은 용암이 아래쪽 길을 틀어막고 있다.','깨진 물항아리와 부러진 운반대. 돌에 샌 마지막 물이 작은 김으로 사라지는데 수문지기는 아직 떠나지 않았다.'];
 root.userData.details={...channel,jars:water.position};
 return animate(stage,root,[water.update]);
}

function arrow(w,tip,tail){
 w.rod(tip,tail,.014,0xb8a482);
 const d=new T.Vector3(...tail).sub(new T.Vector3(...tip)),end=new T.Vector3(...tail),unit=d.clone().normalize();
 for(const s of [-1,1]){
  const a=end.clone().addScaledVector(unit,-.22),b=end.clone().addScaledVector(unit,-.045);
  const wing=new T.Vector3(0,.065*s,.015*s),p=[...a.toArray(),...b.toArray(),...b.clone().add(wing).toArray(),...a.clone().add(wing.clone().multiplyScalar(.35)).toArray()];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();w.put(g,0xc6bca5);
 }
}
function ambush(root){
 const w=workshop(root,16521),rock=[12.2,.64,-6.4];
 w.ball([1.24,.76,1.05],0x697775,rock);
 // Arrow flights share an incoming direction; snapped shafts remain at the impact.
 const r=rng(16523);
 for(let i=0;i<11;i++){
  const tip=[11.25+r()*.28,.38+r()*.65,-6.95+r()*.95];
  const len=i%4===0?.38:1.0+r()*.30;
  arrow(w,tip,[tip[0]-(.75+r()*.15)*len,tip[1]+(.08+r()*.24)*len,tip[2]-(.35+r()*.23)*len]);
 }
 const x=11.9,z=4.8;
 const bundle=new T.Group();bundle.name='abandoned-travel-baggage';bundle.position.set(x,.06,z);bundle.rotation.set(0,.25,-.34);root.add(bundle);
 const b=workshop(bundle,16522);
 for(const s of [-1,1])b.rod([s*.58,0,0],[s*.58,1.1,.13],.055,0x796449);
 for(const y of [.14,.45,.91])b.rod([-.67,y,.05],[.67,y,.05],.045,0x847156);
 b.box([1.02,.62,.47],0x7b7270,[0,.45,.34],[.08,0,.08]);
 for(const dx of [-.38,.37])b.box([.035,.63,.51],0xb9a788,[dx,.45,.34]);
 b.put(new T.CylinderGeometry(.16,.16,1.2,10),0xb2aa92,[0,.95,.35],[0,0,Math.PI/2]);
 b.rod([-.25,.96,.06],[-.8,.48,-.12],.018,0x4a3930);b.rod([.23,.93,.07],[.8,.29,-.1],.018,0x4a3930);
 b.finish('splintered-travel-frame');
 for(let i=0;i<5;i++)w.box([.43,.045,.34],i%2?0x938370:0xb5aa8d,[x-.65+i*.32,.035,z+.7+(i%2)*.3],[0,i*.8,0]);
 arrow(w,[x,.40,z+.23],[x-.72,.70,z-.70]);
 w.finish('ambush-arrows-and-scattered-belongings');
 return {arrows:rock,baggage:[x,.6,z]};
}
export function buildQinglanNight(scene,lights){
 const build=(s,l)=>buildQinglan(s,l,{night:true});
 const {stage,root}=beginNight(scene,lights,build,'qinglan_night',{boundaryFires:false});
 deepSky(root,scene);
 // Retain the immense gorge and river. Moonlit granite stays readable at night.
 scene.fog=new T.Fog(0x1d2e44,100,460);lights.hemi.intensity=.82;lights.sun.intensity=.54;
 stage.sunOffset={x:5,y:13,z:-5};stage.fighterLight={color:0xd0c5be,rimColor:0xb9cdda,rim:1.1,level:.56};
 root.userData.details=ambush(root);
 root.userData.stories=['한 방향에서 날아온 화살이 쉼터의 바위를 박고 있다. 꺾인 화살대 사이로 더는 사람이 지나지 않는다.','운반대와 여행짐이 길가에 버려졌다. 무슨 일이 있었는지는 말하지 않지만, 김씨가 들고 있는 것은 이제 형의 칼이다.'];
 return animate(stage,root,[]);
}
