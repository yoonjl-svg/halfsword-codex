// Small public water kiosk in the baori courtyard. Dimensions are in metres.
// One shared structural description drives the visible masonry and Rapier cover.
// A creative combination of Rajasthan water-service and chhatri forms, not a
// reconstruction of a specific historical pyaau. Local scene turns -90° about Y.
import * as THREE from 'three';
import { box, cyl, limb } from './stage_kit.js';

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

export function buildCourtyardCover(K,P){
  for(const s of LOCAL_SHAPES){
    const g=s.type==='cuboid'?box(...s.halfExtents.map(v=>v*2)):s.type==='cylinder'?cyl(s.radius,s.radius,s.halfHeight*2,16):new THREE.LatheGeometry(domeProfile.map(p=>new THREE.Vector2(...p)),16);
    K.put('cover',g,s.center[1]>2.7?P.rose:s.center[1]<.3?P.rose:P.pale,s.center,[0,0,0],1,{uv:'box',uvScale:1/3,vary:.035,noise:.025});
  }
  // Small brackets under the projecting eaves and a stone finial.
  for(const x of [-.94,.94])for(const z of [-.7,.7]){
    K.put('cover',box(.42,.15,.32),P.stone,[x,2.37,z]);
    for(const sign of [-1,1])K.put('cover',box(.34,.16,.2),P.rose,[x+sign*.16,2.25,z],[0,0,-sign*.5]);
  }
  K.put('cover',cyl(.025,.1,.18,8),P.pale,[0,3.71,0]);
  // Shallow service niches are surface relief on a solid water reservoir; they
  // are deliberately not see-through windows. A ladle, vessel and mineral
  // streaks make the purpose legible instead of a generic statue/plinth.
  for(const side of [-1,1]){
    K.put('cover',box(.94,.72,.025),0x8e7e65,[0,1.25,side*.616]);
    K.put('cover',box(1.15,.1,.23),P.stone,[0,.86,side*.66]);
    for(const x of [-.57,.57])K.put('cover',box(.1,.91,.08),P.stone,[x,1.25,side*.65]);
    K.put('cover',box(1.22,.15,.13),P.stone,[0,1.78,side*.65]);
    const vessel=new THREE.LatheGeometry([[.11,0],[.21,.07],[.24,.22],[.18,.39],[.12,.43],[.17,.46]].map(v=>new THREE.Vector2(...v)),10);
    K.put('cover',vessel,0x96704b,[-.22,.9,side*.68]);
    limb(K,'cover',[.25,1.4,side*.65],[.25,1.05,side*.78],.023,.018,0x796146);
    K.put('cover',new THREE.SphereGeometry(.09,8,5,0,Math.PI*2,0,Math.PI/2),0x8d7049,[.25,1.06,side*.78],[Math.PI,0,0],[1,.35,1]);
    for(const x of [-.31,.12,.37])K.put('cover',box(.05,.39,.012),0x9aab94,[x,.62,side*.608]);
  }
}
