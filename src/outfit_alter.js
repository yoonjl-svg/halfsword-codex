// Appearance only. Materials are freshly built by dressPart / the outfit factories.
// No body, collider, armor coverage or AI changes.
import * as THREE from 'three';

export function alterLook(base, kind) {
  const look={...base,alter:kind};
  if(kind==='heinrich') look.outfitPalette={0xc7cdd3:0x3e3544,0x6e747b:0x37303e,0x5c6168:0x282330};
  if(kind==='eira') {
    look.outfitPalette={0x222c48:0x854b60,0x18203a:0x4a2b40,0xf1f0ec:0xdcc8b8,0xc9ced6:0xb79caa,0xdadde3:0xcbb7c0};
    look.eyeColor=0x921626;
  }
  if(kind==='liao') {
    look.outfitPalette={0x3a5f9e:0xb88745,0x27447a:0x76512e,0x33558f:0x936e3f,0x1e2a44:0x4a3528};
    look.blindfold=true;
  }
  // Base garments and added outfit parts share the same palette substitution.
  for(const key of ['tunic','quilt','sleeve','hoseUpper','hoseLower','belt','metal'])
    if(look.outfitPalette?.[look[key]]!=null)look[key]=look.outfitPalette[look[key]];
  return look;
}

export function decorateAlter(g,look,part) {
  if(!look.alter)return;
  const seen=new Set();
  g.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(!m?.color||seen.has(m))continue;seen.add(m);
    const c=look.outfitPalette?.[m.color.getHex()];if(c!=null)m.color.setHex(c);
  }});
  if(part!=='head')return;
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0,side:THREE.DoubleSide});
  const add=(parent,geo,m,pos)=>{const x=new THREE.Mesh(geo,m);if(pos)x.position.set(...pos);x.castShadow=true;parent.add(x);return x};
  if(look.alter==='eira'){
    const hat=new THREE.Group();hat.name='alter-wide-brim-hat';g.add(hat);
    const cloth=mat(0x68394f),edge=mat(0xa47685),band=mat(0x30232f);
    // Broad felt surfaces should keep their wine color under the fighter rim light.
    cloth.defines={FL_CLOTH_GLOW:1};
    // Wide curved brim, with a low front and gently curled back, not a cone hat.
    const brim=new THREE.CylinderGeometry(.35,.35,.014,32,1,false);
    const p=brim.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z)/.35;
      p.setXYZ(i,x*.91,p.getY(i)+.108+r*r*(.025*Math.sin(Math.atan2(z,x))**2-.022*x/.35),z);
    }
    brim.computeVertexNormals();add(hat,brim,cloth);
    add(hat,new THREE.CylinderGeometry(.105,.133,.18,16),cloth,[-.015,.203,0]);
    add(hat,new THREE.CylinderGeometry(.131,.135,.032,16,1,true),band,[-.015,.13,0]);
    const trim=new THREE.TorusGeometry(.347,.004,4,32);trim.rotateX(Math.PI/2);trim.scale(.91,1,1);
    const tp=trim.attributes.position;for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i);tp.setY(i,tp.getY(i)+.108+.025*Math.sin(Math.atan2(z,x))**2-.022*x/.318)}
    trim.computeVertexNormals();add(hat,trim,edge);
    add(hat,new THREE.BoxGeometry(.008,.025,.024),mat(0xb2a4b0),[.122,.13,0]);
  }
  if(look.blindfold){
    const wrap=new THREE.Group();wrap.name='alter-blindfold';g.add(wrap);
    const linen=mat(0xd9ccb3),fold=mat(0xb7a88d);
    const band=new THREE.CylinderGeometry(.112,.112,.057,20,1,true);band.scale(1.04,1,1);
    add(wrap,band,linen,[0,.016,0]);
    add(wrap,new THREE.BoxGeometry(.014,.055,.146),linen,[.113,.016,0]);
    for(const y of [-.002,.029])add(wrap,new THREE.BoxGeometry(.003,.004,.15),fold,[.122,y,0]);
    add(wrap,new THREE.SphereGeometry(.022,6,4),linen,[-.12,.013,0]);
    for(const s of [-1,1]){const tail=add(wrap,new THREE.BoxGeometry(.009,.13,.032),linen,[-.13,-.06,s*.022]);tail.rotation.x=s*.22;tail.rotation.z=-.18;}
  }
}
