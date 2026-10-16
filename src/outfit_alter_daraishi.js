// Cosmetic prisoner/escort ambiguity; no armor, constraints, mass or combat logic.
import * as T from 'three';

export function decorateDaraishiAlter(g,part,palette){
 // The archived v10 lower coat stores colors in skinned vertex attributes rather
 // than material.color. Recolor those exact swatches without touching skin/hair.
 const pairs=Object.entries(palette).map(([from,to])=>[new T.Color(+from),new T.Color(to)]);
 g.traverse(o=>{
  const a=o.geometry?.attributes.color;
  if(!a||!o.material?.vertexColors)return;
  for(let i=0;i<a.count;i++)for(const [old,next] of pairs){
   if(Math.abs(a.getX(i)-old.r)+Math.abs(a.getY(i)-old.g)+Math.abs(a.getZ(i)-old.b)<.0001){a.setXYZ(i,next.r,next.g,next.b);break;}
  }
  a.needsUpdate=true;
 });
 if(part!=='farmO')return;
 const cuff=new T.Group();cuff.name='daraishi-broken-wrist-shackle';cuff.userData={cosmetic:true,chainLinks:3};g.add(cuff);
 const iron=new T.MeshStandardMaterial({color:0x87857b,metalness:.56,roughness:.72});
 const dark=new T.MeshStandardMaterial({color:0x414448,metalness:.45,roughness:.78});
 const add=(geo,mat,p)=>{const m=new T.Mesh(geo,mat);m.position.set(...p);m.castShadow=true;cuff.add(m);return m};
 // A hollow band wraps the existing sleeve just above the hand, not a solid
 // cylinder intersecting the wrist. The short broken chain stays by the arm.
 const band=add(new T.CylinderGeometry(.066,.061,.068,16,1,true),iron,[0,-.092,0]);
 for(const y of [-.126,-.058]){
  const rim=add(new T.TorusGeometry(y<-.1?.061:.066,.006,5,16),dark,[0,y,0]);rim.rotation.x=Math.PI/2;
 }
 add(new T.BoxGeometry(.029,.05,.021),dark,[0,-.092,-.065]);
 add(new T.SphereGeometry(.007,6,4),iron,[0,-.092,-.079]);
 const chain=new T.Group();chain.name='daraishi-shackle-chain';chain.position.set(0,-.092,-.079);cuff.add(chain);
 for(let i=0;i<3;i++){
  const broken=i===2;
  const link=new T.Mesh(new T.TorusGeometry(.025,.0065,5,12,broken?Math.PI*1.48:Math.PI*2),iron);
  link.position.set(i*.003,-.024-i*.042,0);link.castShadow=true;chain.add(link);
  link.scale.y=1.3;link.rotation.y=i%2?Math.PI/2:0;link.rotation.z=broken?.65:.18;
 }
 // Keep the short chain hanging below a raised wrist, as existing dangling
 // outfit details do. This is a render-only orientation, not a body constraint.
 const q=new T.Quaternion(),down=new T.Vector3(0,-1,0),localDown=new T.Vector3();
 band.onBeforeRender=()=>{
  cuff.getWorldQuaternion(q).invert();localDown.copy(down).applyQuaternion(q);
  chain.quaternion.setFromUnitVectors(down,localDown);chain.updateMatrixWorld(true);
 };
}
