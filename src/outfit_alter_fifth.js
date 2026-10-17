// Cosmetic details only. +X is the face, +Y up, +Z the wearer's right.
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function mesh(parent,geo,color,name){
 const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.86,side:T.DoubleSide}));
 m.name=name;m.castShadow=true;parent.add(m);return m;
}
export function decorateFifthAlter(g,look,part){
 if(look.alter==='chanda'&&part==='head'){
  const veil=new T.Group();veil.name='chanda-white-face-veil';g.add(veil);
  const n=18,rows=14,p=[],ix=[],colors=[];
  // A single thin cloth sheet, tied under the eyes, hanging below the chin.
  // Half-length drop, half-depth folds and fine ties: light cloth rather than a shell.
  for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
   const u=i/n,v=j/rows,a=u*2-1;
   const z=a*(.102-.020*Math.sin(v*Math.PI*.75));
   const y=.008-.16*v-.007*(1-a*a)+v**5*(.009*a*a+.0045*Math.sin(u*9+.3));
   const fold=Math.sin(u*Math.PI*6+.35)*(.00075+.005*v*v);
   const x=.088+.055*(1-a*a)+.013*v+.0045*Math.sin(v*Math.PI)+fold;
   p.push(x,y,z);
   const shade=.94+.045*Math.cos(u*Math.PI*6+.35);colors.push(shade,shade,shade);
   if(i<n&&j<rows){const k=j*(n+1)+i;ix.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ix);geo.computeVertexNormals();
  const cloth=mesh(veil,geo,0xf1ece1,'chanda-hanging-white-cloth');
  Object.assign(cloth.material,{roughness:1,vertexColors:true,transparent:true,opacity:.90,depthWrite:false});cloth.castShadow=false;
  const tie=new T.CatmullRomCurve3([[.092,.008,-.101],[.015,.017,-.116],[-.095,.022,-.072],[-.119,.022,.015],[-.072,.02,.095],[.018,.016,.116],[.092,.008,.101]].map(v=>new T.Vector3(...v)));
  mesh(veil,new T.TubeGeometry(tie,32,.00115,4,false),0xd4ccbc,'veil-head-tie');
  for(const pts of [[[-.117,.022,.014],[-.125,.002,.03],[-.122,-.079,.033]],[[-.117,.022,.014],[-.127,-.008,.006],[-.125,-.10,-.008]]]){
   mesh(veil,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v))),8,.0012,4,false),0xd4ccbc,'veil-tie-tail');
  }
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
