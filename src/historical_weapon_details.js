// Busan Museum military hwando (구입10194) and Albion Knecht Mark II.
// Referenced shapes, enlarged blade lengths selected by the user; not measured replicas.
import * as THREE from 'three';
import { metalMat, weaponEnv } from './weapon_looks.js';
export const HISTORICAL_WEAPON = {
  hwando: { blade: .72, width: .036, sag: .009, grip: .145, guardWidth: .071 },
  kriegsmesser: { blade: .95, width: .0445, sag: .014, grip: .235, guardWidth: .25 },
};
const iron = () => metalMat(0x39372f, { rough: .57 });
const brass = () => metalMat(0x9a8050, { rough: .49, metal: .72 });
const steel = () => metalMat(0x858b89, { rough: .37 });
function add(g,geo,mat,x=0,y=0,z=0) { const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m; }
function extrusion(shape,depth) { const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:8});geo.translate(0,0,-depth/2);return geo; }
function poly(points) { const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s; }
function box(g,w,h,d,mat,x=0,y=0,z=0) {return add(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
function ring(g,r,t,mat,x,y,z) {return add(g,new THREE.TorusGeometry(r,t,5,16),mat,x,y,z);}

// The centre line is expressed relative to its end-to-end chord. This preserves
// a real bow while keeping the visual blade within 1 cm of the combat collider.
function bladeMesh(id,shape,color) {
  const o=HISTORICAL_WEAPON[id],L=shape[2]*2,N=56,W=o.width/2,tip=id==='hwando'?.075:.14;
  const pos=[],colors=[],c=new THREE.Color(color);
  function section(t){
    const u=Math.max(0,(t-(1-tip/L))/(tip/L));
    const width=W*(1-(id==='hwando'?.12:.22)*t);
    const cx=4*o.sag*t*(1-t);
    let back=cx-width,edge=cx+width;
    const apex=-W*.42;
    if(u>0){back=back*(1-u)+(apex)*u;edge=edge*(1-u**2.3)+apex*u**2.3;}
    const span=edge-back,th=(id==='hwando'?.0031:.0037)*(1-.50*t)*(1-u**2);
    const ridge=back+span*.16;
    const groove=id==='kriegsmesser'?Math.min(1,t/.035)*Math.max(0,Math.min(1,(.69-t)/.06)):0;
    const gx=back+span*.25,gw=span*.075*groove;
    const points=[[edge,0,1.12],[edge-span*.08,th*.18,1.08],[gx+gw,th*.90,1],
      [gx+gw*.55,th*(.90-.40*groove),.74],[gx-gw*.55,th*(.90-.40*groove),.74],
      [gx-gw,th*.95,1],[ridge,th,1],[back,th*.86,.93]];
    const all=[...points,...points.slice().reverse().map(([x,z,v])=>[x,-z,v])];
    return all.map(([x,z,v])=>({p:[x,(t-.5)*L,z],v}));
  }
  const tri=(a,b,d)=>{for(const q of [a,b,d]){pos.push(...q.p);colors.push(c.r*q.v,c.g*q.v,c.b*q.v);}};
  for(let n=0;n<N;n++){const a=section(n/N),b=section((n+1)/N);for(let j=0;j<a.length;j++){const k=(j+1)%a.length;tri(a[j],b[j],b[k]);tri(a[j],b[k],a[k]);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:id==='hwando'?.42:.30,metalness:.84,envMap:weaponEnv(),envMapIntensity:.8,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.name=id+'-curved-blade';return mesh;
}
function hwandoGuard(){
  const g=new THREE.Group(),s=new THREE.Shape();s.absellipse(0,0,.0355,.0275,0,Math.PI*2,false);
  // Two three-lobed apertures and two curved jewel/cloud apertures, simplified
  // from the museum photographs. Open geometry, not painted black spots.
  for(const sign of [-1,1]){
    const hole=new THREE.Path();const cx=sign*.023;
    for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,r=.0064+.0022*Math.cos(a*3);const x=cx+r*Math.cos(a),y=r*Math.sin(a);i?hole.lineTo(x,y):hole.moveTo(x,y);}hole.closePath();s.holes.push(hole);
    const h=new THREE.Path();h.moveTo(-.009,sign*.019);h.bezierCurveTo(-.013,sign*.008,-.003,sign*.009,0,sign*.013);h.bezierCurveTo(.003,sign*.009,.013,sign*.008,.009,sign*.019);h.quadraticCurveTo(0,sign*.026,-.009,sign*.019);s.holes.push(h);
  }
  const plate=add(g,extrusion(s,.0035),iron());plate.rotation.x=Math.PI/2;plate.name='hwando-openwork-samyeop-chilbo';
  // Narrow raised perimeter, keeps the thin plate edge readable.
  const rim=ring(g,1,.019,brass(),0,0,0);rim.rotation.x=Math.PI/2;rim.scale.set(.0355,.0275,.0355);
  return g;
}
function hwandoGrip(){
 const g=new THREE.Group(),base=new THREE.MeshStandardMaterial({color:0x302820,roughness:.95});
 const m=add(g,new THREE.CylinderGeometry(.014,.0145,.125,10),base);m.scale.z=.82;
 const cord=new THREE.MeshStandardMaterial({color:0x856444,roughness:.94});
 const vertices=[];
 for(const side of [-1,1])for(let y=-.052;y<.057;y+=.014)for(const slope of [-.95,.95])for(let i=0;i<12;i++){
   const point=(n,e)=>{const x=-.0144+.0288*n/12;return [x,Math.max(-.062,Math.min(.062,y+x*slope+e*.0027)),side*(.0124*Math.sqrt(Math.max(0,1-(x/.0145)**2))+.0008+(slope>0?.0002:0))];};
   const a=point(i,-1),b=point(i+1,-1),c=point(i+1,1),d=point(i,1);
   vertices.push(...a,...b,...c,...a,...c,...d);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();cord.side=THREE.DoubleSide;
 add(g,geometry,cord).name='hwando-fitted-cross-wrap';
 for(const y of [-.064,.064]){const b=add(g,new THREE.CylinderGeometry(.015,.015,.007,12),brass(),0,y);b.scale.z=.9;}
 return g;
}
function knechtGrip(){
 const g=new THREE.Group();const wood=new THREE.MeshStandardMaterial({color:0x573827,roughness:.84});
 // Enclosed tang, two long slabs; narrow metal perimeter, no exposed broad tang.
 box(g,.026,.235,.025,steel());for(const side of [-1,1])box(g,.027,.230,.005,wood,0,0,side*.014);
 const pin=steel(),dark=iron();
 for(const y of [-.085,-.028,.029,.085])for(const side of [-1,1]){
  const r=ring(g,.0027,.0008,pin,0,y,side*.017);r.name='knecht-tubular-rivet';
  add(g,new THREE.CircleGeometry(.0017,10),dark,0,y,side*.0171).rotation.y=side<0?Math.PI:0;
 }
 // A few fine, deterministic grain lines rather than random noise/painted ornament.
 const grain=new THREE.MeshStandardMaterial({color:0x684832,roughness:.95});
 for(const side of [-1,1])for(const x of [-.009,-.005,.006])box(g,.0006,.21,.0003,grain,x,0,side*.01665);
 return g;
}
function knechtGuard(){
 const g=new THREE.Group(),mat=steel();
 const bar=poly([[-.125,-.007],[-.11,-.006],[-.028,-.004],[.028,-.004],[.11,-.006],[.125,-.007],[.125,.007],[.11,.006],[.025,.006],[-.025,.006],[-.11,.006],[-.125,.007]]);
 add(g,extrusion(bar,.011),mat);
 // Mark II's outward-flared Nagel, on only one side of the weapon.
 const lug=poly([[-.007,0],[.007,0],[.012,.028],[.020,.038],[.016,.047],[-.016,.047],[-.02,.038],[-.012,.028]]);
 const n=add(g,extrusion(lug,.006),mat,0,0,.004);n.rotation.x=Math.PI/2;n.name='knecht-flared-nagel';
 return g;
}
export function historicalPartMesh(id,index,isBlade,shape,color){
 if(isBlade)return bladeMesh(id,shape,color);
 if(index===0)return id==='hwando'?hwandoGrip():knechtGrip();
 if(index===2)return id==='hwando'?hwandoGuard():knechtGuard();
 const g=new THREE.Group();
 if(index===1){
  if(id==='hwando'){const cap=add(g,new THREE.CylinderGeometry(.015,.014,.017,12),brass());cap.scale.z=.86;}
  else {const s=poly([[-.015,.014],[-.018,-.006],[-.011,-.018],[.008,-.02],[.021,-.012],[.017,.014]]);add(g,extrusion(s,.030),steel());}
 }
 return g;
}
export function historicalDecorate(group){
 if(this.id==='hwando'){
  const m=box(group,.035,.019,.009,brass(),0,this.hiltLength+.0095);m.name='hwando-blade-collar';
 }else{
  const band=box(group,.030,.012,.035,steel(),0,.081);band.name='knecht-grip-ferrule';
 }
}

// A separate empty scabbard is attached to the hip, never to the moving blade.
// Museum scabbard length is extended by the selected blade-length increase.
export function hwandoScabbard(bladeLength=.72){
 const group=new THREE.Group();group.name='hwando-black-scabbard';const L=bladeLength+.05;
 const s=new THREE.Shape();s.moveTo(-.023,0);
 for(let i=0;i<=32;i++){const t=i/32,c=4*.009*t*(1-t),w=.023*(1-.17*t);s.lineTo(c-w,-t*L);}
 s.quadraticCurveTo(.016,-L-.015,.025,-L);for(let i=32;i>=0;i--){const t=i/32,c=4*.009*t*(1-t),w=.023*(1-.17*t);s.lineTo(c+w,-t*L);}s.closePath();
 add(group,extrusion(s,.018),new THREE.MeshStandardMaterial({color:0x1d201d,roughness:.58}));
 const fitting=brass();
 for(const y of [0,-L*.18,-L*.37])box(group,.049,.012,.022,fitting,4*.009*(-y/L)*(1+y/L),y);
 for(const y of [-L*.18,-L*.37])ring(group,.0075,.0017,fitting,-.028,y,0);
 // Scalloped chape edge, with the main black wood still visible above it.
 const cap=poly([[-.018,-L+.037],[-.009,-L+.029],[0,-L+.037],[.009,-L+.029],[.018,-L+.037],[.023,-L+.006],[.014,-L-.009],[-.012,-L-.009],[-.022,-L+.006]]);
 add(group,extrusion(cap,.0205),fitting);
 // Plain suspension cords interpret the missing belt connector; not an original reconstruction.
 const cord=new THREE.MeshStandardMaterial({color:0x62503b,roughness:1});
 for(const y of [-L*.18,-L*.37]){const points=[new THREE.Vector3(-.028,y,0),new THREE.Vector3(-.045,y*.52,0),new THREE.Vector3(-.02,.025,0)];add(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.0018,5,false),cord);}
 return group;
}
