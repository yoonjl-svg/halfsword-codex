// Pale human face / painted armor / white mantle; appearance only.
import * as T from 'three';
import {addYueCommanderCloak} from './outfit_yue_cloak.js';
export function decorateTerracottaAlter(g,part){
 if(part!=='head'){
  const palette={0x929084:0x8d4035,0xa4a094:0xaa5946,0x7c7b70:0x563932,
   0xa6a193:0xc0a477,0x887269:0x594644,0x737c7b:0x4a5355};
  const seen=new Set();
  // Hands stay bare clay: recolor garment groups, not the shared hand material.
  g.traverse(o=>{if(part.startsWith('farm')&&!o.parent?.name?.startsWith('terracotta-'))return;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(!m?.color||seen.has(m))continue;seen.add(m);
    const color=palette[m.color.getHex()];if(color!==undefined)m.color.setHex(color);
   }});
  addYueCommanderCloak(g,part);
  return;
 }
 // Preserve the original head, hair cap and crown silhouette; replace clay
 // relief with a human face. Alpha is modest so the expression stays readable.
 const face=g.children[0],nose=g.children[3],hair=g.children[4];
 const skin=0xe0e4d8;
 for(const o of [face,nose]){
  o.material.color.setHex(skin);o.material.vertexColors=false;
  o.material.transparent=true;o.material.opacity=.88;o.material.depthWrite=false;
  o.material.roughness=.87;o.material.needsUpdate=true;
 }
 nose.scale.set(.76,.90,.88);
 hair.material.color.setHex(0x303b3c);
 for(const name of ['terracotta-sculpture','terracotta-face-incisions','terracotta-age']){
  const o=g.getObjectByName(name);if(o)o.visible=false;
 }
 for(const name of ['terracotta-cap','terracotta-hair-grooves'])g.getObjectByName(name)?.traverse(o=>{if(o.material?.color)o.material.color.setHex(0x354448)});
 const human=new T.Group();human.name='terracotta-pale-human-face';human.userData={opacity:.88,cosmetic:true};g.add(human);
 const flesh=new T.MeshStandardMaterial({color:skin,roughness:.87,transparent:true,opacity:.88,depthWrite:false});
 const ink=new T.MeshStandardMaterial({color:0x394241,roughness:1});
 const add=(geo,mat,p,scale)=>{const m=new T.Mesh(geo,mat);m.position.set(...p);if(scale)m.scale.set(...scale);human.add(m);return m};
 for(const side of [-1,1]){
  add(new T.SphereGeometry(.022,8,6),flesh,[-.007,-.023,side*.096],[.58,1.25,.43]);
  const brow=add(new T.BoxGeometry(.008,.0035,.036),ink,[.092,.038,side*.035]);brow.rotation.x=side*.10;
  const points=[[.106,-.038,side*.004],[.105,-.041,side*.023],[.092,-.047,side*.039]].map(p=>new T.Vector3(...p));
  add(new T.TubeGeometry(new T.CatmullRomCurve3(points),9,.0035,5,false),ink,[0,0,0]);
 }
 add(new T.SphereGeometry(.019,8,6),ink,[.077,-.079,0],[.26,.70,.78]);
 add(new T.ConeGeometry(.012,.035,6),ink,[.066,-.098,0],[.4,1,.7]).rotation.z=Math.PI;
 g.userData.spectralHumanFace=true;
}
