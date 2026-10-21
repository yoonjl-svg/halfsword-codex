// 2026-10-21: secret peace conference, mistaken engagement, then artillery war.
// Local courtyard coordinates. All tall rubble remains outside the fighting/camera ring.
import * as THREE from 'three';
import { box, cyl, limb, rng, canvasTex } from './stage_kit.js';

export const RUIN_FIRE_SITES = [
  { x:-33.2, z:-4.4, y:.6, height:18, width:1.5 },
  { x:16.2, z:-24.4, y:.7, height:14, width:1.4 },
  { x:27.1, z:13.0, y:.6, height:10, width:1.2 },
];

function wall(K, outline, depth, color, pos, hole=null) {
  const shape=new THREE.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  if(hole){
    const path=new THREE.Path(),r=rng(hole.seed||4021);
    for(let i=0;i<20;i++){const a=-i/20*Math.PI*2,rad=hole.r*(.85+r()*.23),x=hole.x+Math.cos(a)*rad,y=hole.y+Math.sin(a)*rad;i?path.lineTo(x,y):path.moveTo(x,y);}path.closePath();shape.holes.push(path);
  }
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1}).translate(0,0,-depth/2);
  K.put('stone',geo,color,pos,undefined,1,{rough:.025,vary:.05});
  if(hole){
    const r=rng(5281),p=[],ids=[];
    for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,k=.91+r()*.18;
      for(const rr of [hole.r*k,hole.r*k+.22+r()*.22])p.push(hole.x+Math.cos(a)*rr,hole.y+Math.sin(a)*rr,depth/2+.018);
      if(i<24){const n=i*2;ids.push(n,n+1,n+2,n+1,n+3,n+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ids);g.computeVertexNormals();
    K.put('shade',g,0x382b27,pos,undefined,1,{vary:.1});
  }
}

function grounded(K,geo,color,x,z,{y=0,rot=[0,0,0],bin='stone'}={}) {
  geo.rotateX(rot[0]);geo.rotateY(rot[1]);geo.rotateZ(rot[2]);geo.computeBoundingBox();
  K.put(bin,geo,color,[x,y-geo.boundingBox.min.y,z],undefined,1,{rough:bin==='stone'?.035:0,vary:.15});
}

export function rubble(K,P,x,z,n=28,spread=3.1,seed=1471,y=0) {
  const r=rng(seed);
  for(let i=0;i<n;i++){
    const a=r()*Math.PI*2,d=Math.sqrt(r())*spread,w=.2+r()*1.0,h=.13+r()*.36,depth=.2+r()*.75;
    grounded(K,box(w,h,depth),i%4===0?P.pale:P.stone,x+Math.cos(a)*d,z+Math.sin(a)*d,{y,rot:[(r()-.5)*.6,r()*6.28,(r()-.5)*.6]});
  }
  for(let i=0;i<4;i++)grounded(K,box(.19,.22,1.6+r()*1.9),0x25201e,x+(r()-.5)*spread,z+(r()-.5)*spread,{y,bin:'wood',rot:[.08+r()*.25,r()*6.28,(r()-.5)*.2]});
}

export function warGate(K,P,{arch}) {
  // The missing tower and broken chajja are real missing geometry, not painted cracks.
  wall(K,[[-4.4,0],[-4.4,9.0],[-3.4,9.3],[-2.8,8.6],[-2.2,8.8],[-1.6,7.8],[-.8,8.1],[0,7.2],[1.2,7.6],[2,6.9],[3.2,7.1],[4.4,6.7],[4.4,0],[2.7,0],[2.7,5.6],[2.2,6.25],[-2.2,6.25],[-2.7,5.6],[-2.7,0]],3.4,P.stone,[0,0,-24.4],{x:-3.53,y:5.15,r:.52});
  arch(K,0,0,-22.30,5.25,6.65,.6);
  // Broken doors retain fragments of the red seal that closed the confidential meeting.
  for(let i=0;i<16;i++){
    const x=-2.34+i*.312,h=i<7?4.3+(i%3)*.36:1.2+(i%4)*.36;
    K.put('wood',box(.292,h,.13),i%3?0x46302b:0x282222,[x,h/2,-22.56],undefined,1,{vary:.16});
  }
  for(const [x,w,y]of [[-1.1,2.4,.75],[-1.2,2.3,2.6],[1.25,2.2,.75]])K.put('iron',box(w,.13,.07),P.iron,[x,y,-22.46]);
  K.put('stone',box(4.1,.23,3.9),P.pale,[-2.5,6.9,-24.15]);
  K.put('stone',box(3.6,.24,4.65),P.pale,[-2.6,7.28,-24.0]);
  // One damaged jharokha survives on the left; the opposing window has fallen.
  K.put('stone',box(2.4,.24,1.35),P.pale,[-2.8,5.9,-21.7]);
  for(const x of [-3.75,-1.85])K.put('stone',box(.2,1.65,.6),P.stone,[x,6.8,-21.7]);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    if(row+col>4)continue;const x=-3.6+col*.42,y=6.05+row*.34;
    limb(K,'stone',[x,y,-21.35],[x+.21,y+.17,-21.35],.035,.035,P.pale,{},5);
    limb(K,'stone',[x+.21,y+.17,-21.35],[x+.42,y,-21.35],.035,.035,P.pale,{},5);
  }
  rubble(K,P,2.8,-20.8,28,2.4,2175);
  grounded(K,new THREE.SphereGeometry(.23,12,8),0x232326,3.7,-20.5,{bin:'iron'});
  grounded(K,box(2.1,.23,1.1),P.pale,-2.5,-20.8,{rot:[.18,.35,.13]});
}

export function warArchitecture(K,P,{column,arch,room,pavilion}) {
  // North arcade: standing, shattered, standing. Missing roofs expose blackened timber.
  for(let j=0;j<11;j++){
    const x=-27+j*5.4,broken=[1,2,8,9].includes(j),h=broken?(j%2?2.1:3.4):5.05;
    const outline=[[-2.75,0],[-2.75,h],[-1.6,h+.15],[-.8,h-.28],[.2,h+.07],[1,h-.18],[2.75,h],[2.75,0]];
    wall(K,outline,.8,broken?0x926f60:P.rose,[x,0,-28.3],j===7?{x:.3,y:2.8,r:1.22}:null);
    K.put('stone',box(5.4,.18,7.3),P.stone,[x,.09,-25]);
    if(!broken){
      column(K,x-2.6,.18,-21.7,4.35);arch(K,x,.18,-21.7,4.6,4.2,.72,P.stone);room(K,x,j%2);
      K.put('stone',box(5.48,.35,8),P.pale,[x,4.66,-25]);
      K.put('interior',box(5.3,.08,6.9),0x51443f,[x,4.44,-25]);
      K.put('stone',box(5.4,.6,.5),P.stone,[x,5.12,-21.45]);
      K.put('stone',box(5.4,.14,.72),P.pale,[x,5.5,-21.45]);
    }else{
      column(K,x-2.6,.18,-21.7,1.0+(j%3)*.35);
      K.put('stone',box(.45,1.35,5.4),P.rose,[x-2.55,.85,-25]);
      limb(K,'wood',[x-2,2,-27.8],[x+1.5,.3,-21.9],.13,.10,0x211e1d);
      rubble(K,P,x,-22.7,25,2.5,301+j,.18);
    }
  }
  // Eastern lodging range: a shell hole and two entire collapsed bays opposite the well.
  K.push([30,0,-1],-Math.PI/2);
  for(let j=0;j<8;j++){
    const x=-19+j*5.25,broken=j===2||j===3;
    wall(K,[[-2.7,0],[-2.7,4.4],[-1.2,4.55],[.3,4.35],[2.7,4.5],[2.7,0]],.8,P.stone,[x,0,-1],j===5?{x:0,y:2.4,r:1.38,seed:525}:null);
    if(!broken){
      column(K,x-2.5,0,4.15,4.3);arch(K,x,0,4.15,4.55,4.08,.6);
      K.put('stone',box(5.3,.3,6.8),P.pale,[x,4.5,1.5]);
      K.put('stone',box(5.3,.6,.55),P.stone,[x,4.95,4.5]);
      K.put('wood',box(1.55,2.65,.13),0x47352d,[x,1.325,-.51]);
    }else{
      column(K,x-2.5,0,4.15,1.5);
      rubble(K,P,x,2.8,22,2.2,612+j);
      limb(K,'wood',[x-2,3.8,-.6],[x+1.8,.22,4],.14,.1,0x27201f);
    }
  }K.pop();
  // Boundary retains the ground-level courtyard silhouette, with an artillery breach.
  for(const [z0,z1]of [[-29,-5.2],[3.2,12],[19,25]]){
    K.put('stone',box(1.1,3.1,z1-z0),P.rose,[-34,1.55,(z0+z1)/2]);
    K.put('stone',box(1.4,.2,z1-z0),P.pale,[-34,3.2,(z0+z1)/2]);
  }
  rubble(K,P,-33,15.4,44,3.6,717);
  for(const [x,w]of [[-14.45,39.1],[21,20.2]]){
    K.put('stone',box(w,2.7,1.3),P.stone,[x,1.35,24.5]);
    K.put('stone',box(w,.2,1.6),P.pale,[x,2.8,24.5]);
  }
  for(const x of [4.7,11.3])column(K,x,0,24.5,4.3);
  arch(K,8,0,24.5,5.4,4.8,1.7);
  pavilion(K,-17,0,24.5,1.05);
}

export function ruinedPavilion(K,P,x,z,scale=1){
  K.push([x,0,z],0,scale);
  for(const [xx,zz,h]of [[-1.1,-1.1,2.3],[1.1,-1.1,.8],[-1.1,1.1,1.3],[1.1,1.1,.45]]){
    K.put('stone',box(.84,.27,.84),P.pale,[xx,.135,zz]);
    K.put('stone',cyl(.22,.29,h,8),P.stone,[xx,.27+h/2,zz]);
  }
  grounded(K,new THREE.SphereGeometry(1.55,12,6,0,Math.PI*2,0,Math.PI/2).scale(1,.65,1),P.rose,.3,2.4,{rot:[.05,.3,.18]});
  rubble(K,P,.3,2.4,12,1.3,1212);
  rubble(K,P,0,0,18,2.3,1211);K.pop();
}

export function warTraces(K,P){
  // Cannonballs and fresh stone fracture, with broad low spall outside the camera orbit.
  for(const [x,z]of [[-11.1,9.2],[12.1,-9.5],[18,16]]){
    rubble(K,P,x,z,17,1.7,Math.round((x+50)*100));
    grounded(K,new THREE.SphereGeometry(.19,10,8),0x28272a,x+.3,z-.2,{bin:'iron'});
  }
  // Debris has slid onto supported stepwell landings; never floating over the void.
  rubble(K,P,-28.25,-7.9,14,.48,982,-1.55);
  rubble(K,P,-26.9,-7.4,12,.45,983,-3.1);
  // Opposed chairs and a split meeting table, at the sheltered edge of the courtyard.
  K.push([-10.4,0,-15.5],.18);
  for(const side of [-1,1]){
    const z=side*1.65;
    for(const x of [-.42,.42])for(const dz of [-.36,.36])K.put('wood',box(.09,.74,.09),0x4c3227,[x,.37,z+dz]);
    K.put('wood',box(.98,.09,.88),0x674833,[0,.78,z]);
    for(const x of [-.42,.42])K.put('wood',box(.09,.92,.09),0x4c3227,[x,1.05,z+side*.36]);
    K.put('wood',box(.92,.4,.08),0x74513a,[0,1.32,z+side*.36]);
  }
  K.put('wood',box(2,.14,.77),0x402b25,[-.27,.75,-.35],[0,.08,.04]);
  grounded(K,box(2,.14,.8),0x2e2520,.5,.45,{bin:'wood',rot:[.15,-.18,.15]});
  for(const x of [-.95,.42])for(const z of [-.65,-.1])K.put('wood',box(.13,.68,.13),0x463128,[x,.34,z]);
  for(let i=0;i<3;i++)grounded(K,box(.3,.008,.2),i===1?0x776758:0xb4a389,.15+i*.4,-.2+i*.25,{y:i===0?.82:0,bin:'cloth',rot:[0,i*.7,0]});
  K.pop();
  // Burnt beams at the bases of the three black smoke columns.
  for(const s of RUIN_FIRE_SITES){
    for(let i=0;i<6;i++)grounded(K,box(.19,.2,1.8+i*.19),0x201b19,s.x+(i-3)*.3,s.z+(i%3)*.3,{bin:'wood',rot:[.03,.3+i*.47,.08]});
  }
}

export function blackWarSmoke(root){
  const r=rng(211026),textures=Array.from({length:3},()=>canvasTex(128,128,(c,w,h)=>{
    // Filled charcoal billows. Bright outlines around every lobe look like hollow rings.
    const core=c.createRadialGradient(64,64,8,64,64,55);core.addColorStop(0,'rgba(9,10,12,.95)');core.addColorStop(.6,'rgba(18,20,23,.68)');core.addColorStop(1,'rgba(27,29,32,0)');c.fillStyle=core;c.fillRect(0,0,w,h);
    for(let i=0;i<17;i++){
      const a=i*2.4,rr=20+r()*22,x=64+Math.cos(a)*(i<5?10:23),y=64+Math.sin(a)*(i<5?10:23);
      const shade=16+Math.floor(r()*13),g=c.createRadialGradient(x,y,0,x,y,rr);g.addColorStop(0,`rgba(${shade},${shade+1},${shade+2},.3)`);g.addColorStop(.5,`rgba(${shade},${shade+1},${shade+2},.22)`);g.addColorStop(1,`rgba(${shade},${shade+1},${shade+2},0)`);c.fillStyle=g;c.fillRect(x-rr,y-rr,rr*2,rr*2);
    }
  }));
  const group=new THREE.Group();group.name='courtyard-black-artillery-smoke';root.add(group);
  const puffs=[];
  for(const [j,s]of RUIN_FIRE_SITES.entries())for(let i=0;i<12;i++){
    const material=new THREE.SpriteMaterial({map:textures[i%3],color:0xffffff,transparent:true,opacity:.66,depthWrite:false,fog:true});
    const sprite=new THREE.Sprite(material);sprite.name=`war-smoke-${j}-${i}`;group.add(sprite);
    puffs.push({sprite,s,phase:(i+r()*.4)/12,drift:r()*6.28,spin:(r()-.5)*.025,size:.8+r()*.4});
  }
  const ashN=42,ashPos=new Float32Array(ashN*3),ashGeo=new THREE.BufferGeometry();ashGeo.setAttribute('position',new THREE.BufferAttribute(ashPos,3));
  const ash=new THREE.Points(ashGeo,new THREE.PointsMaterial({color:0x665c51,size:.07,transparent:true,opacity:.4,depthWrite:false}));ash.name='courtyard-drifting-ash';root.add(ash);
  const embers=[];
  for(const s of RUIN_FIRE_SITES){
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(.85,12),new THREE.MeshBasicMaterial({color:0x6d2515,transparent:true,opacity:.55,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(s.x,.035,s.z);mesh.name='courtyard-smouldering-timber';root.add(mesh);embers.push(mesh);
  }
  const update=(time)=>{
    for(const p of puffs){const u=(p.phase+time/32)%1,size=(1.2+u*2.7)*p.s.width*p.size;
      p.sprite.position.set(p.s.x+u*u*5+Math.sin(u*4+time*.09)*u*1.5+Math.sin(p.drift)*u*.8,p.s.y+u*p.s.height,p.s.z+u*u*2.2+Math.cos(u*3+time*.06)*u*1.2);
      p.sprite.scale.set(size,size*(.95+Math.sin(p.drift)*.13),1);p.sprite.material.rotation=p.drift+time*p.spin;
      p.sprite.material.opacity=.8*Math.min(1,u*12)*Math.min(1,(1-u)*5);
    }
    for(let i=0;i<ashN;i++){const s=RUIN_FIRE_SITES[i%3],u=((i*.618+time*.045)%1);ashPos[i*3]=s.x+u*5+Math.sin(i*2.5+time*.15);ashPos[i*3+1]=.2+u*5;ashPos[i*3+2]=s.z+u*2+Math.cos(i+time*.2);}
    ashGeo.attributes.position.needsUpdate=true;
    embers.forEach((e,i)=>e.material.opacity=.42+.08*Math.sin(time*1.2+i*2)+.04*Math.sin(time*3.7+i));
  };
  update(7);return {update,puffs:puffs.length,sites:RUIN_FIRE_SITES.length};
}
