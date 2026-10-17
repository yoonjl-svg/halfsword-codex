// Fictional thin silk commander's mantle, keeping the painted armor exposed.
// Long straight panels / side ties; not a reconstruction of a dated artifact.
import * as T from 'three';
export function addYueCommanderCloak(g,part){
 if(part!=='chest')return;
 const root=new T.Group();root.name='yue-commanders-white-cloak-'+part;root.userData={cosmetic:true,thickness:0};g.add(root);
 const silk=new T.MeshStandardMaterial({color:0xe4e1d5,roughness:.91,side:T.DoubleSide});
 silk.defines={FL_CLOTH_GLOW:1};
 const hem=new T.MeshStandardMaterial({color:0xb6b59e,roughness:.92,side:T.DoubleSide});hem.defines={FL_CLOTH_GLOW:1};
 // A single cloth surface curls over the shoulders into the back. The
 // neckline starts farther along that curve, leaving the throat/armor open.
 // Sparse shallow folds suggest thin silk rather than a rigid pleated curtain.
 const fall=new T.CatmullRomCurve3([
  [.145,.09,0],[.08,.17,0],[-.04,.18,0],[-.14,.14,0],[-.174,.04,0],
  [-.19,-.12,0],[-.21,-.40,0],[-.27,-.70,0],[-.37,-1.01,0]
 ].map(p=>new T.Vector3(...p)),false,'centripetal');
 const shape=(u,v,side)=>{
  const shoulder=smooth((u-.30)/.20)*(1-smooth((u-.78)/.20));
  const start=.25*(1-shoulder),p=fall.getPointAt(start+(1-start)*v);
  const width=.220+.055*smooth(v),gap=.012*smooth((v-.68)/.32);
  const z=side*(gap+(width-gap)*u);
  const y=p.y+.018*Math.cos(u*Math.PI*2)*v*v+.025*(1-u)**4*v*v;
  const x=p.x-(.003+.003*v)*Math.sin(u*10+v*1.5);
  return [x,y,z];
 };
 const patch=(fn,nu,nv,mat)=>{
  const p=[],index=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)p.push(...fn(i/nu,j/nv));
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i;index.push(k,k+1,k+nu+1,k+1,k+nu+2,k+nu+1)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(index);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;root.add(mesh);return mesh;
 };
 for(const side of [-1,1]){
  patch((u,v)=>shape(u,v,side),22,40,silk);
  // Narrow woven borders follow the fabric surface; no thick solid edging.
  patch((u,v)=>{const p=shape(.97+u*.022,v,side);p[0]-=.001;return p},1,12,hem);
  for(const h of [.952,.975])patch((u,v)=>{const p=shape(u,h+v*.006,side);p[0]-=.001;return p},14,1,hem);
 }
 if(part==='chest'){
  // Small side ties hold the over-shoulder ends; no central Western clasp.
  for(const side of [-1,1]){
   const points=[[.145,.090,side*.13],[.150,.060,side*.14],[.147,.015,side*.148],[.143,-.020,side*.142]].map(p=>new T.Vector3(...p));
   const cord=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.003,5,false),hem);root.add(cord);
   const knot=new T.Mesh(new T.SphereGeometry(.008,7,5),silk);knot.position.set(.150,.060,side*.14);root.add(knot);
  }
 }
}
function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
