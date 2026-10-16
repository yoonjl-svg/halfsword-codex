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
  if(kind==='margarethe') {
    look.outfitPalette={0x2c2c32:0xd9d1b9,0x1c1c20:0x948b77,0x8d939b:0xf1e5c9,
      0x1b1b20:0xc7bfae,0x131316:0x8d8377,0x1e1e22:0xb7ab98,0x24242a:0x9d9285};
  }
  if(kind==='isolde') {
    look.outfitPalette={0xe6ded0:0x684274,0xd8cdb8:0x4a3155,0x33363f:0xc4b79f,
      0x2b2e36:0xc4b79f,0x4a4d57:0x9d8661};
    look.outfit='isolde_saber'; // Remove the three long-hair sections; add the cropped head below.
  }
  if(kind==='tome') {
    look.outfitPalette={0x632b3c:0xc8baa1,0x8b4d58:0x9b8767,0x1c191b:0xe0d5bc,
      0x4a2230:0x96856b,0x35343b:0xa99d88};
  }
  if(kind==='omari') {
    look.outfitPalette={0xe4d4b4:0x40988e,0x193b4b:0x32948d,0x47616a:0x82b4a0,0x813848:0xb6935a,
      0x665a4b:0x344e4b,0xa55c60:0xd5b776};
  }
  // Base garments and added outfit parts share the same palette substitution.
  for(const key of ['tunic','quilt','sleeve','hoseUpper','hoseLower','belt','metal'])
    if(look.outfitPalette?.[look[key]]!=null)look[key]=look.outfitPalette[look[key]];
  return look;
}

export function decorateAlter(g,look,part) {
  if(!look.alter)return;
  const seen=new Set();
  g.traverse(o=>{
    // Helmet wear restores its saved base color; save the altered palette there too.
    const wearColor=look.outfitPalette?.[o.userData.base?.color];
    if(wearColor!=null)o.userData.base={...o.userData.base,color:wearColor};
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(!m?.color||seen.has(m))continue;seen.add(m);
    const c=look.outfitPalette?.[m.color.getHex()];if(c!=null)m.color.setHex(c);
  }});
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0,side:THREE.DoubleSide});
  const add=(parent,geo,m,pos)=>{const x=new THREE.Mesh(geo,m);if(pos)x.position.set(...pos);x.castShadow=true;parent.add(x);return x};
  if(look.alter==='omari'&&['chest','abdomen','pelvis'].includes(part)){
    // An open, salt-worn captain's coat. Each short section follows its own body
    // part, as the existing clothing does; there is no new cloth physics.
    const coat=new THREE.Group();coat.name='alter-worn-captain-coat';g.add(coat);
    const cloth=mat(0x294b4a),edge=mat(0x8c9c81),n=20,pos=[],idx=[];
    const top=part==='chest'?.16:part==='abdomen'?.09:.10;
    const bottom=part==='chest'?-.18:part==='abdomen'?-.10:-.36;
    for(let row=0;row<2;row++)for(let i=0;i<=n;i++){
      const a=.68+(Math.PI*2-1.36)*i/n,rx=part==='pelvis'?.165:.148,rz=part==='chest'?.205:part==='abdomen'?.187:.207;
      const torn=part==='pelvis'&&row===1?(.035*Math.sin(i*2.1)+(i===5||i===14?.095:0)):0;
      pos.push(Math.cos(a)*rx*(row?1.08:1),row?bottom+torn:top,Math.sin(a)*rz*(row?1.08:1));
      if(row===0&&i<n){const k=i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();add(coat,geo,cloth);
    if(part==='chest')for(const s of [-1,1]){
      const lapel=add(coat,new THREE.BoxGeometry(.022,.23,.05),edge,[.13,.045,s*.13]);lapel.rotation.x=s*.20;
    }
  }
  if(look.alter==='tome'&&part==='chest'){
    const book=new THREE.Group();book.name='alter-sealed-book';g.add(book);
    const leather=mat(0x554835),pages=mat(0xc1b393),iron=mat(0x443f3b),brass=mat(0xa58a51);
    add(book,new THREE.BoxGeometry(.12,.51,.38),pages,[-.23,-.025,0]);
    for(const x of [-.30,-.16])add(book,new THREE.BoxGeometry(.025,.57,.43),leather,[x,-.025,0]);
    add(book,new THREE.BoxGeometry(.16,.57,.034),leather,[-.23,-.025,.213]);
    for(const z of [-.15,.15])add(book,new THREE.BoxGeometry(.035,.43,.038),leather,[-.14,.01,z]);
    const links=new THREE.InstancedMesh(new THREE.TorusGeometry(.021,.005,5,10),iron,23),d=new THREE.Object3D();book.add(links);
    for(let i=0;i<23;i++){
      const vertical=i<14,k=vertical?i:i-14;
      d.position.set(-.322,vertical?-.285+k*.04:-.025,vertical?0:-.16+k*.04);
      d.rotation.set(0,Math.PI/2,0);d.rotateY(k%2?.65:0);if(!vertical)d.rotateZ(Math.PI/2);d.scale.set(1,1.2,1);d.updateMatrix();links.setMatrixAt(i,d.matrix);
    }
    add(book,new THREE.BoxGeometry(.035,.075,.065),brass,[-.35,-.05,0]);
    add(book,new THREE.BoxGeometry(.004,.025,.009),iron,[-.371,-.05,0]);
  }
  if(part!=='head')return;
  if(look.alter==='isolde'){
    const hair=new THREE.Group();hair.name='alter-cropped-hair';g.add(hair);
    const black=mat(look.hair);
    add(hair,new THREE.BoxGeometry(.052,.14,.18),black,[-.087,-.025,0]);
    for(const s of [-1,1])for(let i=0;i<3;i++){
      const lock=add(hair,new THREE.BoxGeometry(.038,.105+i*.012,.023),black,[-.052+i*.039,-.035-i*.006,s*.094]);
      lock.rotation.x=s*(.08+i*.03);
    }
  }
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
