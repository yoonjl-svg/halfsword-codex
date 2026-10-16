// Cosmetic painted clay and staple repair; no armor or damage-rule changes.
import * as T from 'three';
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
  return;
 }
 const repair=new T.Group();repair.name='terracotta-bronze-face-repair';g.add(repair);
 const clayCrack=new T.MeshStandardMaterial({color:0x45433b,roughness:1});
 const bronze=new T.MeshStandardMaterial({color:0x9a865b,roughness:.76,metalness:.35});
 const onFace=(y,z,lift=.003)=>new T.Vector3(Math.sqrt(Math.max(.001,.107**2-y*y-z*z))+lift,y,z);
 const path=[[.077,.034],[.057,.042],[.035,.038],[.012,.051],[-.009,.047],[-.027,.057],[-.048,.046],[-.069,.043]];
 const crack=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(path.map(([y,z])=>onFace(y,z))),28,.0018,4,false),clayCrack);repair.add(crack);
 for(const [y,z] of [[.055,.042],[-.012,.048],[-.052,.045]]){
  const pts=[onFace(y-.003,z-.014,.003),onFace(y-.003,z-.014,.007),onFace(y+.003,z+.014,.007),onFace(y+.003,z+.014,.003)];
  const staple=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),9,.0024,5,false),bronze);staple.castShadow=true;repair.add(staple);
 }
 repair.userData={cosmetic:true,staples:3,interpretation:'창작 수복 흔적; 진대 공법 복원 아님'};
}
