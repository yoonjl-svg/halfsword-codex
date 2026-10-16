// 03:00, a fictional homeward offering. Reuse the morning stage and its physics.
import * as T from 'three';
import {buildDunhuang} from './stage_dunhuang.js';
import {beginNight} from './stage_night_variants.js';
import {workshop,animate} from './stage_night_second.js';
import {rng} from './stage_kit.js';

function rope(w,points,r=.025,color=0xb4a182){
 w.put(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,5,false),color);
}
function emptyLoad(root){
 const frame=new T.Group();frame.name='opened-guardian-cart';root.add(frame);
 frame.position.set(-16.2,0,8.8);frame.rotation.y=1.27;
 const tilt=new T.Group();tilt.rotation.z=.14;frame.add(tilt);
 const load=new T.Group();load.rotation.x=-.06;tilt.add(load);
 const w=workshop(load,16601),wood=0x8a7053,pale=0xc2ad7e;
 // Full-length transport cradle, empty where the daytime clay cargo rested.
 for(const x of [-.48,.48])w.box([.11,.16,2.55],wood,[x,1.28,0]);
 for(const z of [-1.12,-.35,.55,1.12])w.box([1.04,.12,.15],0x5d4939,[0,1.24,z]);
 for(const [z,half] of [[-.9,.22],[-.45,.4],[.40,.33],[.95,.24]]){
  rope(w,[[-half,1.43,z],[-half*.75,1.29,z],[0,1.27,z],[half*.75,1.29,z],[half,1.43,z]],.075,pale);
  for(const dx of [-half,half])for(let j=0;j<4;j++)w.rod([dx-.025,1.38+j*.012,z-.10],[dx+.025,1.40+j*.014,z+.10],.009,0x9a815d);
 }
 // A removed lid leans outward. Loose ties and a tool suggest deliberate release.
 const lid=new T.Group();lid.position.set(1.58,.12,.15);lid.rotation.z=-.47;load.add(lid);
 const l=workshop(lid,16602);
 for(let i=0;i<7;i++)l.box([.145,2.35,.06],i%2?wood:0x9b8260,[(i-3)*.154,1.17,0]);
 for(const y of [.28,1.94])l.box([1.18,.11,.085],0x514236,[0,y,-.075]);l.finish('removed-crate-lid');
 rope(w,[[-.48,1.4,-.5],[-.85,1.18,-.7],[-1.42,.65,-.55],[-1.65,.16,-.2],[-1.87,.1,.13]]);
 rope(w,[[.48,1.4,.47],[.87,1.10,.67],[1.32,.6,.89],[1.6,.13,1.2],[1.87,.1,1.3]]);
 for(let i=0;i<6;i++)w.put(new T.IcosahedronGeometry(.055+i*.004,0),0xa49d89,[-.5+i*.18,1.18,-1.7+(i%2)*.12],[0,i,0],[1,.35,1]);
 // Bronze repair staples left on the cart; same material as the face repair.
 for(let i=0;i<3;i++)rope(w,[[.67+i*.13,1.16,-1.34],[.67+i*.13,1.20,-1.34],[.74+i*.13,1.20,-1.34],[.74+i*.13,1.16,-1.34]],.011,0x9a865b);
 w.finish('empty-straw-cradle');
 // Heavy flat soles lead from the broken shaft toward, but never into, the duel.
 const tracks=workshop(root,16603);
 for(let i=0;i<16;i++){
  const a=i/15,x=-12.8+a*3.2,z=9.8-a*3.9,s=i%2?1:-1;
  tracks.box([.19,.006,.37],0x8c887d,[x+s*.16,.022,z],[0,-.65,0]);
 }
 tracks.finish('guardian-homeward-prints');
 return [-16.2,1.5,8.8];
}
function homewardBoat(root){
 const group=new T.Group();group.name='homeward-votive-boat';group.position.set(12.3,.025,-6.4);group.rotation.y=.25;root.add(group);
 const w=workshop(group,16604),wood=0xa98c62,dark=0x584536;
 // A small open wooden boat, not a solid block: keel, planks, ribs and benches.
 const shape=(u,side,h)=>{
  const x=(u-.5)*2.35,beam=.39*Math.sin(Math.PI*u)**.65;
  return [x,.015+h*.34+Math.abs(u-.5)**3*.85,side*beam*(.55+.45*h)];
 };
 for(const side of [-1,1])for(let row=0;row<4;row++)for(let i=0;i<18;i++){
  const a=shape(i/18,side,row/4),b=shape((i+1)/18,side,row/4),c=shape(i/18,side,(row+1)/4),d=shape((i+1)/18,side,(row+1)/4);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c,...b,...d,...c],3));geo.computeVertexNormals();
  // Both sides are actual geometry, so looking into the hull shows wood.
  const rev=geo.clone(),p=rev.attributes.position;
  for(let k=0;k<p.count;k+=3){const v=new T.Vector3().fromBufferAttribute(p,k);p.setXYZ(k,p.getX(k+2),p.getY(k+2),p.getZ(k+2));p.setXYZ(k+2,v.x,v.y,v.z)}rev.computeVertexNormals();
  w.put(geo,row%2?wood:0x947752);w.put(rev,row%2?wood:0x947752);
 }
 for(const side of [-1,1])rope(w,Array.from({length:25},(_,i)=>shape(i/24,side,1)),.026,dark);
 w.box([1.8,.045,.24],0x69533d,[0,.045,0]);
 for(const x of [-.65,0,.65]){
  const u=x/2.35+.5,beam=shape(u,1,1)[2];w.box([.13,.045,beam*1.85],wood,[x,.235,0]);
  rope(w,[shape(u,-1,.92),shape(u,-1,.08),shape(u,1,.08),shape(u,1,.92)],.018,dark);
 }
 // A single unused oar crosses the empty seats; its blade points toward home.
 w.rod([-.85,.325,.18],[.78,.355,-.23],.023,0xbea77a);
 w.box([.34,.035,.13],0xc6ad7a,[.91,.361,-.26],[0,.25,0]);
 // Open bamboo slips, two bindings, washed-out marks (no invented historical text).
 for(let i=0;i<14;i++){
  const x=-.5+i*.078,z=.91+.018*Math.sin(i),y=.035+Math.abs(i-6)*.004;
  w.box([.067,.025,.53],i%3?0xbca575:0x9f8a62,[x,y,z],[0,.025*Math.sin(i),0]);
  for(let j=0;j<5;j++)if((i+j)%3)w.box([.015,.002,.022],0x665c48,[x,y+.014,z-.17+j*.07]);
 }
 for(const z of [.74,1.07])rope(w,[[-.53,.072,z],[0,.052,z],[.56,.077,z]],.009,0x6f5941);
 // Low irregular drifts settle around the keel; nothing suggests actual water.
 const r=rng(16604);
 for(let i=0;i<16;i++){
  const a=r()*Math.PI*2,rr=1+r()*.35;
  w.ball([.12+r()*.22,.009+r()*.009,.07+r()*.13],0x8d7e65,[Math.cos(a)*rr,.003,Math.sin(a)*.61]);
 }
 w.finish('boat-and-unread-bamboo-slips');
 return [12.3,.28,-6.4];
}
export function buildDunhuangNight(scene,lights){
 const build=(s,l)=>buildDunhuang(s,l,{night:true});
 const {stage,root}=beginNight(scene,lights,build,'dunhuang_night',{boundaryFires:false});
 scene.fog=new T.Fog(0x28354a,85,330);
 lights.hemi.intensity=.94;lights.sun.intensity=.69;stage.sunOffset={x:-10,y:13,z:-7};
 lights.sun.position.set(-10,13,-7);
 stage.fighterLight={color:0xd2c9bd,rimColor:0xbdcedb,rim:1.12,level:.57};
 const cart=emptyLoad(root),boat=homewardBoat(root);
 root.userData.stories=['낮의 토우가 사라진 수레. 벗겨진 덮개 아래 빈 짚 운반틀과 청동 꺾쇠가 남고, 무거운 발자국이 결투장 쪽으로 이어진다.',
  '마른 강을 향한 작은 배와 펼친 죽간. 누군가 귀향을 준비했지만 모래 위에는 배를 띄울 물이 없다.'];
 root.userData.details={cart,boat};root.userData.addedColliders=0;
 return animate(stage,root,[]);
}
