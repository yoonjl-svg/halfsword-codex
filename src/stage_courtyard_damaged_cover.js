// Night-only damage. Reuse the existing cover model and its unchanged physical shell.
import * as THREE from 'three';
import {buildCourtyardCover} from './stage_courtyard_cover.js';
import {rng,box,canvasTex} from './stage_kit.js';

// Clip in the cover's own coordinates, then return to the original primitive frame.
// Actual missing triangles and a rough fracture face; no dark polygon hiding an intact roof.
function fracture(geometry,toCover,limit){
  const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(toCover);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  const outside=[],normals=[],tex=[],cuts=[];
  const signed=v=>v.p.x+v.p.z-limit+.028*Math.sin(v.p.y*37)+.018*Math.sin((v.p.x-v.p.z)*23);
  const mix=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
  const push=v=>{outside.push(...v.p.toArray());normals.push(...v.n.toArray());tex.push(...v.uv.toArray());};
  for(let i=0;i<p.count;i+=3){
    const tri=Array.from({length:3},(_,j)=>({p:new THREE.Vector3().fromBufferAttribute(p,i+j),n:new THREE.Vector3().fromBufferAttribute(n,i+j),uv:uv?new THREE.Vector2().fromBufferAttribute(uv,i+j):new THREE.Vector2()}));
    const poly=[];
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3],da=signed(a),db=signed(b);
      if(da<=0)poly.push(a);
      if((da<=0)!==(db<=0)){const hit=mix(a,b,da/(da-db));poly.push(hit);cuts.push(hit.p);}
    }
    for(let j=1;j<poly.length-1;j++){push(poly[0]);push(poly[j]);push(poly[j+1]);}
  }
  const inverse=toCover.clone().invert();
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(outside,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));result.applyMatrix4(inverse);
  const unique=[...new Map(cuts.map(v=>[v.toArray().map(x=>x.toFixed(5)).join(','),v])).values()];
  let cap=null;
  if(unique.length>=3){
    const center=unique.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(unique.length);
    unique.sort((a,b)=>Math.atan2(a.y-center.y,(a.x-a.z-center.x+center.z)/Math.SQRT2)-Math.atan2(b.y-center.y,(b.x-b.z-center.x+center.z)/Math.SQRT2));
    const coords=[];
    for(let j=0;j<unique.length;j++)coords.push(...center.toArray(),...unique[j].toArray(),...unique[(j+1)%unique.length].toArray());
    const capNormals=[];for(let i=0;i<coords.length;i+=3)capNormals.push(Math.SQRT1_2,0,Math.SQRT1_2);
    cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(coords.length/3*2).fill(0),2));cap.setAttribute('normal',new THREE.Float32BufferAttribute(capNormals,3));cap.applyMatrix4(inverse);
  }
  g.dispose();return {surface:result,cap};
}

function brokenBasin(g){
  // Keep the hollow inner bowl. Remove a small radial wedge and cap only its stone wall.
  const points=g.parameters.points,start=Math.PI/4+.42,end=Math.PI/4-.42;
  const surface=new THREE.LatheGeometry(points,24,start,Math.PI*2-.84);
  const triangles=THREE.ShapeUtils.triangulateShape(points,[]),coords=[];
  for(const [a,flip]of [[start,false],[end,true]])for(const ids of triangles){
    for(const i of flip?[...ids].reverse():ids){const p=points[i];coords.push(p.x*Math.sin(a),p.y,p.x*Math.cos(a));}
  }
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(coords.length/3*2).fill(0),2));cap.computeVertexNormals();
  return {surface,cap};
}

export function buildDamagedCourtyardCover(K,P){
  const original=K.put,origin=K.frame.clone().invert();
  let cuts=0;
  K.put=function(bin,g,color,pos=[0,0,0],rot=[0,0,0],scale=1,opt={}){
    if(bin!=='cover')return original.call(this,bin,g,color,pos,rot,scale,opt);
    const v=typeof scale==='number'?new THREE.Vector3(scale,scale,scale):new THREE.Vector3(...scale);
    const local=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot,'YXZ')),v);
    const toCover=origin.clone().multiply(this.frame).multiply(local);
    const bounds=new THREE.Box3().setFromBufferAttribute(g.attributes.position).applyMatrix4(toCover);
    const roof=bounds.min.y>2.44;
    const basin=g.type==='LatheGeometry'&&bounds.min.y>.80&&bounds.max.y<1.02&&bounds.min.z>.4;
    if(!roof&&!basin)return original.call(this,bin,g,color,pos,rot,scale,opt);
    const cut=basin?brokenBasin(g):fracture(g,toCover,1.20);g.dispose();cuts++;
    let value;
    if(cut.surface.attributes.position.count)value=original.call(this,bin,cut.surface,color,pos,rot,scale,opt);else cut.surface.dispose();
    if(cut.cap)original.call(this,bin,cut.cap,0xd3b397,pos,rot,scale,{...opt,vary:.06,noise:.025});
    return value;
  };
  try{buildCourtyardCover(K,P);}finally{K.put=original;}
  // Fragments stay against the plinth, within the existing navigation clearance.
  for(const [x,z,w,d,h,a]of [[.79,.85,.29,.17,.075,.3],[.62,.98,.20,.15,.045,-.25],[.9,.67,.18,.12,.052,.6],[.2,.89,.09,.07,.025,.3]]){
    K.put('cover',box(w,h,d),0xbda08b,[x,h/2+.014,z],[0,a,0],1,{rough:.015,vary:.08,noise:.02});
  }
  return {cutPrimitives:cuts};
}

export function damagedCoverLeak(parent){
  // Same -90 degree world orientation as the physical central cover.
  const root=new THREE.Group();root.name='courtyard-damaged-cover-water';root.rotation.y=-Math.PI/2;parent.add(root);
  const r=rng(211041),wetMat=new THREE.MeshStandardMaterial({color:0x5d574f,roughness:.25,metalness:.08,transparent:true,opacity:.38,depthWrite:false});
  const patch=(points,mat,z)=>{const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(s),mat);m.position.z=z;root.add(m);return m;};
  patch([[.09,.83],[.20,.84],[.23,.71],[.20,.58],[.26,.41],[.23,.27],[.13,.27],[.15,.43],[.10,.65]],wetMat,.607);
  const crackMat=new THREE.MeshBasicMaterial({color:0x302622});
  patch([[.34,1.90],[.30,1.73],[.36,1.58],[.29,1.42],[.34,1.25],[.30,1.07],[.32,.99],[.28,1.07],[.32,1.25],[.27,1.42],[.34,1.58],[.28,1.73],[.32,1.90]],crackMat,.609);
  const puddlePoints=[];
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2,rad=.8+r()*.2;puddlePoints.push([.15+Math.cos(a)*.27*rad,1.15+Math.sin(a)*.38*rad]);}
  const s=new THREE.Shape();puddlePoints.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const puddleMap=canvasTex(64,64,(c,w,h)=>{const g=c.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.6,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const puddleGeo=new THREE.ShapeGeometry(s),pp=puddleGeo.attributes.position,pu=puddleGeo.attributes.uv;
  for(let i=0;i<pp.count;i++)pu.setXY(i,(pp.getX(i)-.15)/.54+.5,(pp.getY(i)+1.15)/.76+.5);
  const puddle=new THREE.Mesh(puddleGeo,new THREE.MeshStandardMaterial({map:puddleMap,color:0x535a55,roughness:.14,metalness:.12,transparent:true,opacity:.50,depthWrite:false}));puddle.rotation.x=-Math.PI/2;puddle.position.y=.019;puddle.name='courtyard-leak-puddle';root.add(puddle);
  // Two short, faint wet rivulets across the top of the plinth.
  for(const [x,z,w,d]of [[.15,.76,.055,.17],[.18,.84,.045,.10]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),wetMat);m.rotation.x=-Math.PI/2;m.position.set(x,.263,z);root.add(m);}
  const dropGeo=new THREE.SphereGeometry(.012,5,4),dropMat=new THREE.MeshBasicMaterial({color:0x9bafae,transparent:true,opacity:.68});
  const drops=[],ripples=[];
  for(let i=0;i<8;i++){const mesh=new THREE.Mesh(dropGeo,dropMat);mesh.visible=false;mesh.name='courtyard-water-drop';root.add(mesh);drops.push({mesh,age:0,active:false});}
  const ringGeo=new THREE.RingGeometry(.018,.024,16);
  for(let i=0;i<4;i++){const mesh=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0x829691,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;root.add(mesh);ripples.push({mesh,age:1});}
  const sources=[{x:0,y:1.198,z:.716,ground:.891,vz:0,next:.1},{x:.20,y:.938,z:.79,ground:.022,vz:.61,next:.2}];
  const soundPoint=new THREE.Vector3(),state={emitted:0,impacts:0};let time=0,nextSound=1.4;
  const update=(dt,onDrip)=>{
    time+=dt;
    for(const source of sources){
      if(time<source.next)continue;
      source.next=time+.26+r()*.62;
      const d=drops.find(x=>!x.active);if(d){Object.assign(d,{age:0,active:true,source});d.mesh.visible=true;state.emitted++;}
    }
    for(const d of drops){if(!d.active)continue;d.age+=dt;const s=d.source,t=d.age,y=s.y-4.9*t*t;
      d.mesh.position.set(s.x,y,s.z+s.vz*t);d.mesh.scale.set(.75,1.2+t*5,.75);
      if(y>s.ground)continue;d.active=false;d.mesh.visible=false;state.impacts++;
      const ripple=ripples.find(x=>x.age>.6)||ripples[0];ripple.age=0;ripple.mesh.position.set(s.x,s.ground+.002,s.z+s.vz*Math.sqrt((s.y-s.ground)/4.9));
      if(s.vz&&time>nextSound){nextSound=time+2.0+r()*2.1;soundPoint.copy(ripple.mesh.position);root.localToWorld(soundPoint);onDrip?.({x:soundPoint.x,y:soundPoint.y,z:soundPoint.z});}
    }
    for(const q of ripples){q.age+=dt;const u=q.age/.6;q.mesh.scale.setScalar(1+u*4);q.mesh.material.opacity=u<1?.24*(1-u):0;}
    root.userData={...state,time};
  };
  return {update,root};
}
