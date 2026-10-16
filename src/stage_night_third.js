// Appearance-only midnight stories. Original terrain, events and duel bounds stay intact.
import * as T from 'three';
import {beginNight} from './stage_night_variants.js';
import {workshop,bakeWarm,animate} from './stage_night_second.js';
import {buildLoggia} from './stage_loggia.js';
import {buildSacredGrove} from './stage_sacred_grove.js';
import {buildCorsair} from './stage_corsair.js';
import {rng,canvasTex} from './stage_kit.js';

export function buildLoggiaNight(scene,lights){
 const build=(s,l)=>buildLoggia(s,l,{archiveBay:true});
 const {stage,root,original}=beginNight(scene,lights,build,'loggia_night',{boundaryFires:false});
 lights.hemi.intensity=.92;lights.sun.intensity=.56;
 const w=workshop(root,16311),x=7.5,z=-17.8;
 // A small archive room inside a single rear bay; other archways stay open.
 for(const dx of [-1.42,1.42])w.box([.28,3.8,4.1],0x837d70,[x+dx,1.9,z-1.85]);
 w.box([3.12,3.8,.28],0x6e6b65,[x,1.9,z-3.8]);
 w.box([3.3,.24,4.2],0x8b8271,[x,3.9,z-1.85]);
 for(const y of [.6,1.3,2.0,2.7]){
  w.box([2.5,.09,.45],0x4c4035,[x,y,z-3.4]);
  for(let i=0;i<12;i++)w.box([.13,.45,.29],i%3===0?0x866b4c:i%3===1?0x594e49:0x697064,[x-1.1+i*.19,y+.27,z-3.36]);
 }
 for(const dx of [-1.19,1.19])w.box([.20,3.45,.30],0x8f887a,[x+dx,1.72,z]);
 w.box([2.58,.22,.30],0xa39a87,[x,3.5,z]);
 w.box([2.18,3.24,.10],0x1d252f,[x,1.62,z-.15]);
 for(const side of [-1,1]){
  const hinge=new T.Group();hinge.position.set(x+side*1.1,0,z+.04);hinge.rotation.y=side*.43;root.add(hinge);
  const door=workshop(hinge,16312+side);
  for(let j=0;j<5;j++)door.box([.20,3.22,.12],j%2?0x594b40:0x655341,[-side*(.11+j*.216),1.61,0]);
  for(const y of [.42,2.72])door.box([1.05,.075,.035],0x3b3d3d,[-side*.55,y,.085]);
  door.put(new T.TorusGeometry(.085,.018,5,12),0x99866a,[-side*.94,1.43,.12]);
  // Two torn halves of the old sealing strip, wax still on one half.
  door.box([.45,.18,.012],0xcbb993,[-side*.85,1.8,.09],[0,0,side*.13]);
  if(side===1)door.put(new T.CylinderGeometry(.10,.10,.025,10),0x934c49,[-.94,1.8,.115],[Math.PI/2,0,0]);
  door.finish('unsealed-archive-door-'+side,()=>[.9,1.0,1.1]);
 }
 const pages=new T.Group();pages.name='archive-loose-pages';root.add(pages);const r=rng(16315),leaves=[];
 const ink=canvasTex(128,192,(g,w,h)=>{g.fillStyle='#c6b58f';g.fillRect(0,0,w,h);g.fillStyle='#776953';for(let y=25;y<h-16;y+=12){g.fillRect(16,y,69+(y%4)*7,2)}g.fillRect(16,16,22,6)});
 const paper=new T.MeshStandardMaterial({map:ink,side:T.DoubleSide,roughness:1});
 for(let i=0;i<17;i++){
  const g=new T.PlaneGeometry(.31+r()*.12,.46+r()*.15,3,3),p=g.attributes.position;
  for(let k=0;k<p.count;k++)p.setZ(k,.035*Math.sin(p.getX(k)*11+i));g.computeVertexNormals();
  const m=new T.Mesh(g,paper);m.rotation.set(-Math.PI/2,0,r()*6.28);m.position.set(x+(r()-.5)*1.8-i*.07,.04,z+1.0+i*.30);pages.add(m);leaves.push({m,y:m.position.y,phase:r()*6.28});
 }
 // Moonlight entering the opened bay makes the paper trail readable.
 w.finish('archive-stone-frame',bakeWarm(scene,original,[{x,y:3,z:z+1,r:9,c:[.65,.84,1.05]}]));
 root.userData.stories=['닫혀 있던 서고의 문이 벌어지고 봉인지가 찢겨 있다. 누가 열었는지는 알 수 없다.','뜯겨 나온 책장이 회랑을 따라 이어진다. 토메의 등에는 사슬로 잠근 책이 남아 있다.'];
 root.userData.details={archive:[x,1.8,z],pages:[x-.5,.05,z+3.3]};
 return animate(stage,root,[t=>{for(const {m,y,phase} of leaves){m.position.y=y+Math.max(0,Math.sin(t*.7+phase))**8*.055;m.rotation.x=-Math.PI/2+.03*Math.sin(t*.7+phase)}}]);
}

function fallenPine(root,origin,yaw,length,seed){
 const group=new T.Group();group.name='fallen-grove-pine';group.position.set(...origin);group.rotation.y=yaw;root.add(group);
 const w=workshop(group,seed),r=rng(seed),a=[0,.48,0],b=[length,.39,.28];
 w.rod(a,b,.39,0x655c50);
 for(let i=0;i<9;i++){
  const angle=i/9*Math.PI*2;
  w.rod([0,.48,0],[-.5-r()*.7,.48+Math.sin(angle)*.75,Math.cos(angle)*1.0],.09,0x544c40);
 }
 // Splintered pale heartwood and root ball distinguish a fallen tree from cut timber.
 w.ball([.42,.65,.72],0x463e35,[-.05,.43,0]);
 for(let i=0;i<7;i++)w.rod([.22,.45+(r()-.5)*.4,(r()-.5)*.45],[.9+r()*.4,.4+(r()-.5)*.35,(r()-.5)*.4],.055,0xb7a17c);
 for(let i=0;i<12;i++){
  const d=1.7+i*(length-2)/12,s=i%2?-1:1,tip=[d+.65,.60+r()*.55,s*(.7+r()*.7)];
  w.rod([d,.45,.1],tip,.055,0x726557);
  if(i>5){w.ball([.65,.22,.60],i%3?0x425d49:0x63765a,tip);w.ball([.42,.19,.55],0x4d6950,[tip[0]+.5,tip[1]-.05,tip[2]])}
 }
 w.finish('fallen-pine-trunk-and-boughs');return group;
}
export function buildSacredGroveNight(scene,lights){
 const {stage,root}=beginNight(scene,lights,buildSacredGrove,'sacred_grove_night',{boundaryFires:false});
 lights.hemi.intensity=1.0;lights.sun.intensity=.58;stage.sunOffset={x:5,y:12,z:-3};
 fallenPine(root,[-18,.03,7.2],-.25,8.5,16321);
 fallenPine(root,[14.2,.03,14.8],.55,7.6,16322);
 fallenPine(root,[-12.8,.03,-13.3],2.8,6.6,16323);
 const n=85,r=rng(16324),seeds=Array.from({length:n},()=>({a:r()*6.28,d:2+r()*3.6,h:.25+r()*1.9,p:r()*6.28}));
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(n*3),3));
 const map=canvasTex(32,32,(c)=>{const q=c.createRadialGradient(16,16,0,16,16,16);q.addColorStop(0,'#f1edb0');q.addColorStop(.16,'#cee192');q.addColorStop(.5,'rgba(170,205,100,.25)');q.addColorStop(1,'rgba(130,180,80,0)');c.fillStyle=q;c.fillRect(0,0,32,32)});
 const flies=new T.Points(g,new T.PointsMaterial({map,vertexColors:true,size:.15,transparent:true,opacity:.82,depthWrite:false}));flies.name='living-root-fireflies';root.add(flies);
 root.userData.stories=['세 그루가 뿌리를 드러낸 채 쓰러졌다. 꺾인 가지와 아직 푸른 잎이 숲 가장자리에 남아 있다.','서 있는 신목의 뿌리에는 반딧불이 모인다. 무너진 숲 한가운데 남은 생명의 자리.'];
 root.userData.details={fallen:[[-18,0,7.2],[14.2,0,14.8],[-12.8,0,-13.3]],roots:[21,1,-3]};
 return animate(stage,root,[t=>{seeds.forEach((s,i)=>{g.attributes.position.setXYZ(i,21+Math.cos(s.a+t*.026)*s.d,s.h+Math.sin(t*.6+s.p)*.23,-3+Math.sin(s.a+t*.026)*s.d);const b=.25+.75*Math.max(0,Math.sin(t*1.2+s.p))**2;g.attributes.color.setXYZ(i,b,b*.98,b*.61)});g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true}]);
}

function wreck(root){
 const group=new T.Group();group.name='stranded-empty-dhow';group.position.set(28.4,-1.5,18.5);group.rotation.set(.13,-.42,.18);root.add(group);
 const w=workshop(group,16331),length=11;
 // Open ribs, missing planks and a snapped mast: a hull one can see into.
 for(let i=0;i<9;i++){
  const z=-length/2+i*length/8,beam=1.9*Math.sin(Math.PI*(i+.5)/9);
  for(const s of [-1,1]){w.rod([0,-.5,z],[s*beam*.68,.05,z],.11,0x74634b);w.rod([s*beam*.68,.05,z],[s*beam,1.1,z],.10,0x817055)}
 }
 for(const s of [-1,1])for(let row=0;row<5;row++)for(let i=0;i<14;i++){
  if(s===-1&&i>7&&i<11&&row>1)continue;
  const za=-length/2+i*length/14,zb=za+length/14,ba=1.9*Math.sin(Math.PI*(i+.25)/14),bb=1.9*Math.sin(Math.PI*(i+1.25)/14),f=.35+row*.16;
  w.rod([s*ba*f,-.35+row*.31,za],[s*bb*f,-.35+row*.31,zb],.11, row%2?0x584b3b:0x6b5942);
 }
 w.rod([0,-.5,-5.5],[0,-.5,5.5],.16,0x514839);
 w.rod([0,-.35,0],[.15,2.8,-.2],.15,0x87765b);
 w.rod([.15,2.8,-.2],[1.9,.6,-3.1],.12,0x87765b);
 for(let i=0;i<4;i++)w.rod([.11+i*.04,2.5,-.15],[.1+i*.1,3.02+(i%2)*.15,-.18],.03,0xc2ac7a);
 // Torn sail trapped across the broken spar, no crew or moving ship.
 const pos=[.3,2.55,-.5,1.8,.64,-3.0,1.25,.42,-2.8,1.0,.73,-2.1,.5,.25,-1.6,.28,.8,-.5],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex([0,1,2,0,2,3,0,3,4,0,4,5]);g.computeVertexNormals();
 const sail=new T.Mesh(g,new T.MeshStandardMaterial({color:0xa49a7d,roughness:1,side:T.DoubleSide}));group.add(sail);
 w.finish('wreck-open-hull');return group;
}
function luminousSurf(root){
 const g=new T.PlaneGeometry(25,38,58,80);g.rotateX(-Math.PI/2);g.translate(31.5,-2.21,11.5);
 const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;varying vec3 p;void main(){float edge=smoothstep(19.,23.,p.x)*(1.-smoothstep(38.,44.,p.x));float plankton=(.55+.45*sin(p.z*.69+sin(p.z*.2)*2.));float phase=p.x*1.25+sin(p.z*.30)*.8+time*.75;float crest=pow(max(0.,sin(phase)),14.);float grain=.55+.45*sin(p.z*13.+p.x*7.);float fade=1.-smoothstep(12.,19.,abs(p.z-11.5));float alpha=edge*fade*plankton*crest*(.34+.32*grain);gl_FragColor=vec4(.12,.91,.82,alpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const m=new T.Mesh(g,mat);m.name='bioluminescent-harbor-surf';root.add(m);return t=>{mat.uniforms.time.value=t};
}
export function buildCorsairNight(scene,lights){
 const build=(s,l)=>buildCorsair(s,l,{night:true});
 const {stage,root}=beginNight(scene,lights,build,'corsair_night',{boundaryFires:false});
 lights.hemi.intensity=1.03;lights.sun.intensity=.61;
 wreck(root);
 root.userData.stories=['물러난 파도 뒤에 빈 배가 좌초되어 있다. 부러진 돛대와 열린 늑골 사이로 아무도 보이지 않는다.','선체 곁으로 밀려드는 파도가 푸르게 빛났다 사라진다. 돌아온 선장은 이 배에서 내렸을까.'];
 root.userData.details={wreck:[28.4,-1.5,18.5],surf:[31,-2.2,11.5],shipMotion:'stranded; fixed position'};
 return animate(stage,root,[luminousSurf(root)]);
}
