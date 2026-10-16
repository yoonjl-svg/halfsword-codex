// Cosmetic details only. +X is the face, +Y up, +Z the wearer's right.
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function mesh(parent,geo,color,name){
 const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.86,side:T.DoubleSide}));
 m.name=name;m.castShadow=true;parent.add(m);return m;
}
export function decorateFifthAlter(g,look,part){
 if(look.alter==='chanda'&&part==='head'){
  const mask=new T.Group();mask.name='chanda-cracked-half-mask';g.add(mask);
  const n=10,rows=8,p=[],ix=[];
  // Fired-clay cheek/chin shell; leave both eyes and the nose readable.
  for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
   const u=i/n,v=j/rows,z=-.107+u*.105,y=-.018-v*.09+.018*Math.sin(u*Math.PI);
   const x=Math.sqrt(Math.max(.001,.116**2-z*z-y*y*.50))+.005;
   p.push(x,y,z);
   if(i<n&&j<rows){const k=j*(n+1)+i;ix.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.computeVertexNormals();
  mesh(mask,geo,0x292b2b,'chanda-black-clay-mask');
  for(const pts of [[[-.075,-.025],[-.062,-.048],[-.073,-.065],[-.054,-.093]],[[-.062,-.048],[-.035,-.055],[-.027,-.071]]]){
   const v=pts.map(([z,y])=>new T.Vector3(Math.sqrt(Math.max(.001,.116**2-z*z-y*y*.50))+.0065,y,z));
   mesh(mask,new T.TubeGeometry(new T.CatmullRomCurve3(v),12,.0014,4,false),0xb2a99a,'mask-clay-fracture');
  }
  const cord=new T.CylinderGeometry(.113,.113,.006,24,1,true);cord.translate(0,-.022,0);
  mesh(mask,cord,0x403c34,'mask-tie');
 }
 if(look.alter==='renji'&&part==='head'){
  // Keep the original bangs and hat; longer uneven locks emerge below the brim.
  const pieces=[];
  for(let i=0;i<15;i++){
   const a=1.03+i/14*4.22,x=Math.cos(a)*.106,z=Math.sin(a)*.105;
   const len=.25+.10*(.5+.5*Math.sin(i*2.7));
   const curve=new T.CatmullRomCurve3([new T.Vector3(x,.012,z),new T.Vector3(x*1.1,-.10,z*1.08),new T.Vector3(x*1.08-.025,-len*.75,z*1.20),new T.Vector3(x-.04,-len,z*1.28+.018*Math.sin(i))]);
   const geo=new T.TubeGeometry(curve,9,.013+(i%3)*.002,5,false);
   // Taper ends, keeping a broad lock instead of a rope-like round tip.
   const p=geo.attributes.position;
   for(let j=0;j<p.count;j++){const row=Math.floor(j/6),t=row/9,c=curve.getPointAt(t),s=1-.92*t**3;p.setXYZ(j,c.x+(p.getX(j)-c.x)*s,c.y+(p.getY(j)-c.y)*s,c.z+(p.getZ(j)-c.z)*s)}
   geo.computeVertexNormals();pieces.push(geo);
  }
  const joined=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
  mesh(g,joined,0x24201f,'renji-loose-long-hair');
 }
 if(look.alter==='renji'&&part==='pelvis'){
  const old=g.getObjectByName('renji-sheathed-sword');if(!old)return;
  // The whole wrapped sword is now in his hand. No duplicate or empty scabbard.
  old.visible=false;
 }
}
