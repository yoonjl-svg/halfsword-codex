// Small public water kiosk in the baori courtyard. Dimensions are in metres.
// One shared structural description drives the visible masonry and Rapier cover.
// A creative combination of Rajasthan water-service and chhatri forms, not a
// reconstruction of a specific historical pyaau. Local scene turns -90° about Y.
import * as THREE from 'three';
import { box, cyl, limb, canvasTex, rng } from './stage_kit.js';

const domeProfile=[[0,0],[1.02,0],[1.00,.13],[.83,.36],[.52,.57],[.17,.69],[0,.73]];
const domePoints=[];
for(const [radius,y]of domeProfile)for(let i=0;i<16;i++){
  const a=i*Math.PI/8;domePoints.push(Math.sin(a)*radius,y,Math.cos(a)*radius);
}
const LOCAL_SHAPES=[
  {type:'cuboid',halfExtents:[1.1,.13,.85],center:[0,.13,0]},
  {type:'cuboid',halfExtents:[.78,.82,.6],center:[0,1.08,0]},
  ...[-.94,.94].flatMap(x=>[-.7,.7].map(z=>({type:'cylinder',radius:.13,halfHeight:1.15,center:[x,1.41,z]}))),
  {type:'cuboid',halfExtents:[1.16,.14,.88],center:[0,2.58,0]},
  {type:'cuboid',halfExtents:[1.34,.09,1.05],center:[0,2.81,0]},
  {type:'convex',points:domePoints,center:[0,2.9,0]},
];
const turn=([x,y,z])=>[-z,y,x];
export const COURTYARD_COVER_SHAPES=LOCAL_SHAPES.map(s=>({...s,center:turn(s.center),
  ...(s.halfExtents?{halfExtents:turn(s.halfExtents).map(Math.abs)}:{}),
  ...(s.points?{points:s.points.flatMap((_,i)=>i%3?[]:turn(s.points.slice(i,i+3)))}:{})}));
export const COURTYARD_NAVIGATION=Object.freeze({x:0,z:0,radius:1.45,seekSight:true});
export const COURTYARD_START_Z=1.85;

// Fine sandstone grain has no giant painted brick grid: the joints below are
// modelled at their actual scale. One texture/merged mesh for the whole kiosk.
export function courtyardCoverTexture(){
  const r=rng(161026);
  return canvasTex(512,512,(c,w,h)=>{
    c.fillStyle='#e8decd';c.fillRect(0,0,w,h);
    for(let i=0;i<16000;i++){
      c.fillStyle=`rgba(${r()<.7?'99,75,48':'255,248,228'},${.025+r()*.12})`;
      c.fillRect(r()*w,r()*h,.4+r()*1.3,.4+r()*.8);
    }
    for(let i=0;i<70;i++){
      c.strokeStyle='rgba(127,96,61,.045)';c.lineWidth=.4+r();c.beginPath();
      const x=r()*w,y=r()*h;c.moveTo(x,y);c.bezierCurveTo(x+12,y+2,x+35,y-2,x+65,y+1);c.stroke();
    }
  });
}
function dressed(w,h,d,b=.008){
  const s=new THREE.Shape();s.moveTo(-w/2+b,-h/2+b);s.lineTo(w/2-b,-h/2+b);s.lineTo(w/2-b,h/2-b);s.lineTo(-w/2+b,h/2-b);s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:d-2*b,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:1}).translate(0,0,-d/2+b);
}
const lathe=(profile,n=24)=>new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),n);

export function buildCourtyardCover(K,P){
  // Fine bevels/profiles stay within the original structural collision envelope.
  // Recesses are at most 9 cm deep, with solid stone immediately behind them.
  const put=(g,c,p=[0,0,0],rot=[0,0,0],scale=1,opt={})=>K.put('cover',g,c,p,rot,scale,{uv:'box',uvScale:1.5,vary:.035,noise:.015,...opt});
  const stone=0xc9af8b,edge=0xd5bd97,shadow=0x968064;
  const plinth=LOCAL_SHAPES[0],core=LOCAL_SHAPES[1];
  put(dressed(...plinth.halfExtents.map(v=>v*2),.018),0xb39a79,plinth.center);
  put(dressed(2.16,.045,1.66,.008),edge,[0,.235,0]);
  put(dressed(2.12,.04,1.62,.008),shadow,[0,.065,0]);
  // Staggered ashlar courses with chamfered edges, including the top slab.
  const bottom=core.center[1]-core.halfExtents[1],course=core.halfExtents[1]*2/6;
  for(let row=0;row<6;row++){
    const cuts=row%2?[-.78,-.39,.39,.78]:[-.78,0,.78];
    for(let i=0;i<cuts.length-1;i++)put(dressed(cuts[i+1]-cuts[i]-.005,course-.004,1.02,.006),stone,[(cuts[i]+cuts[i+1])/2,bottom+(row+.5)*course,0]);
  }
  // A real shallow arched recess on each serving face, not a painted square.
  for(const side of [-1,1]){
    K.push([0,0,0],side<0?Math.PI:0);
    const wall=new THREE.Shape();wall.moveTo(-.78,bottom);wall.lineTo(.78,bottom);wall.lineTo(.78,1.9);wall.lineTo(-.78,1.9);wall.closePath();
    const niche=new THREE.Path();niche.moveTo(-.34,1.02);niche.lineTo(-.34,1.4);niche.absarc(0,1.4,.34,Math.PI,0,true);niche.lineTo(.34,1.02);niche.closePath();wall.holes.push(niche);
    put(new THREE.ExtrudeGeometry(wall,{depth:.09,bevelEnabled:false,curveSegments:20}),stone,[0,0,.51]);
    put(box(.67,.72,.004),0x9c896d,[0,1.37,.513]);
    // Thin voussoirs and jambs follow the opening; no massive rectangular frame.
    for(let i=0;i<11;i++){
      const a=i*Math.PI/11+.008,b=(i+1)*Math.PI/11-.008,s=new THREE.Shape();
      s.absarc(0,0,.398,a,b,false);s.absarc(0,0,.347,b,a,true);s.closePath();
      put(new THREE.ExtrudeGeometry(s,{depth:.028,bevelEnabled:false,curveSegments:3}),i%3===0?edge:stone,[0,1.4,.601]);
    }
    for(const x of [-.373,.373])put(dressed(.052,.38,.035,.006),edge,[x,1.21,.613]);
    for(let row=1;row<6;row++){
      const y=bottom+row*course;
      const spans=y<1.02?[[-.775,.775]]:y<1.75?[[-.775,-.41],[.41,.775]]:[[-.775,.775]];
      for(const [a,b]of spans)put(box(b-a,.007,.003),shadow,[(a+b)/2,y,.601],undefined,1,{vary:0,noise:0});
    }
    for(let row=0;row<6;row++)for(const x of row%2?[-.54,.54]:[0]){
      const y=bottom+(row+.5)*course;if(y>1&&Math.abs(x)<.4)continue;
      const lo=y-course/2+.003,hi=Math.abs(x)<.4?Math.min(1.02,y+course/2-.003):y+course/2-.003;
      put(box(.006,hi-lo,.003),shadow,[x,(lo+hi)/2,.602],undefined,1,{vary:0,noise:0});
    }
    // Old edge spalls and two hairline fractures; keep the water recess clear.
    for(const [x,y,flip]of [[-.65,.55,1],[.58,1.61,-1],[-.57,1.86,1],[.2,.37,-1]]){
      const chip=new THREE.Shape();chip.moveTo(x,y);chip.lineTo(x+flip*.045,y+.008);chip.lineTo(x+flip*.021,y-.019);chip.closePath();
      put(new THREE.ShapeGeometry(chip),0xaa9578,[0,0,.604]);
    }
    for(const pts of [[[-.66,1.09],[-.62,1.04],[-.63,.99],[-.59,.94]],[[.43,.39],[.49,.36],[.50,.30]]])for(let i=1;i<pts.length;i++)
      limb(K,'cover',[...pts[i-1],.604],[...pts[i],.604],.0015,.0015,0x948267,{},4);
    // Copper outlet, worn handwheel, a dark bore and a hollow stone catch bowl.
    put(new THREE.TorusGeometry(.071,.013,6,20),0x79694b,[0,1.28,.548]);
    limb(K,'cover',[0,1.28,.53],[0,1.24,.72],.028,.024,0x787b60,{},12);
    put(cyl(.025,.025,.038,16,true),0x807150,[0,1.225,.716]);
    put(new THREE.CircleGeometry(.019,16),0x3d4138,[0,1.204,.716],[Math.PI/2,0,0]);
    limb(K,'cover',[0,1.28,.61],[0,1.355,.61],.01,.01,0x786346,{},8);
    put(new THREE.TorusGeometry(.044,.007,6,16),0x8c7852,[0,1.36,.61],[-Math.PI/2,0,0]);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;limb(K,'cover',[0,1.36,.61],[Math.cos(a)*.043,1.36,.61+Math.sin(a)*.043],.005,.005,0x8c7852,{},6);}
    put(lathe([[0,0],[.12,0],[.2,.04],[.255,.13],[.26,.17],[.232,.18],[.22,.14],[.16,.065],[0,.045]],32),edge,[0,.83,.64],[0,0,0],[1,1,.78]);
    put(new THREE.CircleGeometry(.15,28),0x6c786d,[0,.882,.64],[-Math.PI/2,0,0],[1,.78,1],{vary:0,noise:0});
    put(dressed(.52,.06,.25,.01),shadow,[0,.825,.63]);
    // Irregular mineral wash follows the outlet and drain, rather than bars.
    for(let i=0;i<7;i++){
      const x=(i-3)*.026,y=.43+(i%3)*.045,h=.32-(i%2)*.08;
      const s=new THREE.Shape();s.moveTo(x-.002,y);s.lineTo(x+.005,y+.09);s.lineTo(x+.003,y+.17);s.lineTo(x+.018,y+h);s.lineTo(x-.021,y+h-.012);s.lineTo(x-.012,y+.15);s.closePath();
      put(new THREE.ShapeGeometry(s),i%2?0xb6b096:0xa7a68c,[0,0,.603]);
    }
    // A small drinking vessel and hanging dipper give a human scale.
    put(lathe([[.045,0],[.064,.025],[.071,.10],[.052,.15],[.055,.17],[.045,.17],[.043,.155],[.051,.09]],24),0x9d7353,[-.54,1.905,.3]);
    put(new THREE.TorusGeometry(.037,.006,5,16),0x7a6549,[.53,1.53,.625]);
    limb(K,'cover',[.53,1.53,.635],[.51,1.19,.665],.009,.012,0x8d754f,{},8);
    put(lathe([[0,0],[.035,.005],[.066,.035],[.069,.06],[.06,.06],[.052,.03],[0,.012]],20),0x9e865e,[.51,1.15,.668]);
    K.pop();
  }
  put(dressed(1.59,.07,1.23,.012),edge,[0,1.91,0]);
  // Turned octagonal columns, ring mouldings and carved stone brackets.
  for(const s of LOCAL_SHAPES.filter(s=>s.type==='cylinder')){
    const [x,,z]=s.center;
    const profile=[[.13,0],[.13,.09],[.117,.12],[.11,.18],[.102,.24],[.102,1.86],[.115,1.92],[.13,1.98],[.13,2.3]];
    put(lathe(profile,16),edge,[x,.26,z]);
    for(const y of [.42,2.19,2.27])put(new THREE.TorusGeometry(.12,.012,6,16),stone,[x,y,z],[Math.PI/2,0,0]);
    put(dressed(.31,.09,.29,.013),stone,[x,2.36,z]);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      K.push([x,2.38,z],a);
      const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(.37,0);s.bezierCurveTo(.32,-.06,.19,-.06,.15,-.15);s.bezierCurveTo(.11,-.21,.04,-.25,0,-.27);s.closePath();
      put(new THREE.ExtrudeGeometry(s,{depth:.085,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1}),stone,[0,0,-.0425]);K.pop();
    }
  }
  // Articulated cornice: several narrow mouldings take the place of two blocks.
  for(const [w,d,h,y,c]of [[2.28,1.72,.055,2.468,edge],[2.29,1.73,.19,2.59,stone],[2.32,1.76,.04,2.70,edge],[2.43,1.88,.035,2.737,shadow],[2.59,2.02,.065,2.782,stone],[2.68,2.1,.055,2.867,edge]])put(dressed(w,h,d,Math.min(.01,h/4)),c,[0,y,0]);
  // Small carved flower medallions on the frieze, deeply shaded beneath eaves.
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    K.push([0,0,0],a);const front=a===0||a===Math.PI?.87:1.15,span=front<1?1.8:1.3;
    for(let i=0;i<7;i++){
      const x=(i-3)*span/7;
      put(new THREE.TorusGeometry(.037,.006,5,12),shadow,[x,2.586,front]);
      for(let j=0;j<5;j++){const t=j*Math.PI*2/5;put(new THREE.SphereGeometry(.013,6,4),edge,[x+Math.sin(t)*.023,2.586+Math.cos(t)*.023,front+.006],[0,0,t],[.7,1.4,.35]);}
    }K.pop();
  }
  // Smooth radial segments follow exactly the original dome profile. Fine ribs
  // and construction rings articulate it without growing the roof/collision.
  put(lathe(domeProfile,64),0xb99472,[0,2.9,0]);
  for(const [r,y]of [[1.01,.025],[.94,.20],[.74,.43],[.45,.60]])put(new THREE.TorusGeometry(r,.006,5,64),0xa88565,[0,2.9+y,0],[Math.PI/2,0,0]);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;
    for(let j=2;j<domeProfile.length-1;j++){
      const [r0,y0]=domeProfile[j-1],[r1,y1]=domeProfile[j];
      limb(K,'cover',[Math.sin(a)*(r0+.003),2.9+y0,Math.cos(a)*(r0+.003)],[Math.sin(a)*(r1+.003),2.9+y1,Math.cos(a)*(r1+.003)],.005,.005,0xa88565,{},5);
    }
  }
  put(lathe([[.09,0],[.1,.035],[.07,.06],[.055,.08],[.065,.11],[.04,.14],[.014,.19],[0,.22]],24),edge,[0,3.60,0]);
}
