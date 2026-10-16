// Appearance only. Materials are freshly built by dressPart / the outfit factories.
// No body, collider, armor coverage or AI changes.
import * as THREE from 'three';

export function alterLook(base, kind) {
  const look={...base,alter:kind};
  if(kind==='heinrich') look.outfitPalette={0xc7cdd3:0x3e3544,0x6e747b:0x37303e,0x5c6168:0x282330};
  if(kind==='eira') {
    look.outfitPalette={0x222c48:0x854b60,0x18203a:0x4a2b40,0xf1f0ec:0xdcc8b8,0xc9ced6:0xb79caa,0xdadde3:0xcbb7c0};
    look.eyeColor=0x3b121b; // dark iris under the moving glow, not a bright fixed square
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
    const hood=new THREE.Group();hood.name='alter-deep-hood';g.add(hood);
    const cloth=mat(0x68394f),lining=mat(0x30212d),edge=mat(0x9a6b7b);
    for(const m of [cloth,lining,edge])m.defines={FL_CLOTH_GLOW:1};
    // Rounded cloth shell with an open face. The silver locks remain inside the
    // opening and continue onto the existing shoulder cape, with no new physics.
    const rings=[[.145,.17,.15,-.012],[.035,.205,.19,-.02],[-.09,.20,.19,-.028],[-.185,.13,.14,-.045],[-.22,.015,.02,-.06]],n=24,pos=[],idx=[];
    for(let j=0;j<rings.length;j++)for(let i=0;i<=n;i++){
      const [x,ry,rz,cy]=rings[j],a=i/n*Math.PI*2,fold=1+.025*Math.cos(a*7+j*.4);
      pos.push(x+.009*Math.cos(a*3),cy+Math.cos(a)*ry*fold,Math.sin(a)*rz*fold);
      if(j<rings.length-1&&i<n){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));shell.setIndex(idx);shell.computeVertexNormals();
    add(hood,shell,cloth);
    const inner=shell.clone();inner.scale(.98,.98,.98);add(hood,inner,lining);
    const lip=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;lip.push(new THREE.Vector3(.147+.009*Math.cos(a*3),-.012+Math.cos(a)*.17*(1+.025*Math.cos(a*7)),Math.sin(a)*.15*(1+.025*Math.cos(a*7))))}
    add(hood,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip),48,.006,5,false),edge);
  }
  if(look.blindfold){
    const wrap=new THREE.Group();wrap.name='alter-blindfold';g.add(wrap);
    const linen=mat(0xd9ccb3),fold=mat(0xb7a88d);
    const band=new THREE.CylinderGeometry(.112,.112,.057,20,1,true);band.scale(1.04,1,1);
    add(wrap,band,linen,[0,.016,0]);
    add(wrap,new THREE.BoxGeometry(.014,.055,.146),linen,[.113,.016,0]).name='alter-blindfold-front';
    for(const y of [-.002,.029])add(wrap,new THREE.BoxGeometry(.003,.004,.15),fold,[.122,y,0]);
    add(wrap,new THREE.SphereGeometry(.022,6,4),linen,[-.12,.013,0]);
    for(const s of [-1,1]){const tail=add(wrap,new THREE.BoxGeometry(.009,.13,.032),linen,[-.13,-.06,s*.022]);tail.rotation.x=s*.22;tail.rotation.z=-.18;}
  }
}
