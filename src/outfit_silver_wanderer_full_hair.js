// v4 returns to the original long hair: connected volume and broad layered locks.
// Head/chest-local decoration only. Existing face, anatomy and physics are untouched.
export function createSilverWandererFullHair(h, originalHead) {
  const { THREE, addMerged, CLOTH, artoriaCloth }=h;
  const material={...CLOTH,metalness:.04,roughness:.6};
  const layer=g=>artoriaCloth(g,'silver-wanderer-hair');
  function lock(points,widths,depth=.012,rings=22) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const pos=[],uv=[],idx=[],sides=8,across=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let i=0;i<=rings;i++) {
      const t=i/rings,at=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
      const u=t*(widths.length-1),j=Math.min(widths.length-2,Math.floor(u));
      const width=THREE.MathUtils.lerp(widths[j],widths[j+1],u-j);
      across.set(0,0,1).addScaledVector(tangent,-tangent.z).normalize();normal.crossVectors(across,tangent).normalize();
      for(let k=0;k<sides;k++) {
        const a=k/sides*Math.PI*2,v=at.clone().addScaledVector(across,Math.sin(a)*width/2)
          .addScaledVector(normal,Math.cos(a)*depth*Math.min(1,width/.025));
        pos.push(v.x,v.y,v.z);uv.push(k/sides,t);
        if(i<rings) {const n=i*sides+k,next=i*sides+(k+1)%sides;idx.push(n,next,n+sides,next,next+sides,n+sides);}
      }
    }
    for(let k=1;k<sides-1;k++){idx.push(0,k+1,k);const e=rings*sides;idx.push(e,e+k,e+k+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  }
  // Joined side/back shell, open toward the face. A small depth closes the hem.
  function sideVolume() {
    const rows=[[.060,.082,.092,-.012],[.005,.106,.121,-.015],[-.09,.108,.139,-.018],
      [-.19,.105,.158,-.033],[-.30,.098,.166,-.05]];
    const n=40,pos=[],uv=[],idx=[],count=rows.length*(n+1);
    for(let side=0;side<2;side++) for(let j=0;j<rows.length;j++) for(let k=0;k<=n;k++) {
      const a=.98+k/n*(Math.PI*2-1.96),[y,rx,rz,x]=rows[j];
      const wave=.003*Math.cos(a*9+j*.3),r=side===0?wave:-.008;
      const hem=j===rows.length-1?.014*Math.cos(a*7):0;
      pos.push(x+(rx+r)*Math.cos(a),y+hem,(rz+r)*Math.sin(a));uv.push(k/n,j/(rows.length-1));
      if(j<rows.length-1&&k<n) {
        const p=side*count+j*(n+1)+k,q=p+n+1;
        if(side===0)idx.push(p,p+1,q,p+1,q+1,q);else idx.push(p,q,p+1,p+1,q,q+1);
      }
    }
    const join=(a,b)=>idx.push(a,a+count,b,a+count,b+count,b);
    for(let k=0;k<n;k++){join(k+1,k);join((rows.length-1)*(n+1)+k,(rows.length-1)*(n+1)+k+1);}
    for(let j=0;j<rows.length-1;j++){join(j*(n+1),(j+1)*(n+1));join((j+1)*(n+1)+n,j*(n+1)+n);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  }
  function head(g,look) {
    // Keep the original swept fringe, cheek locks and modest crown unchanged.
    originalHead(g,look);
    const l=layer(g),hair=[sideVolume()];
    for(const side of [-1,1]) hair.push(lock([[-.022,.036,side*.096],[-.026,-.055,side*.140],
      [-.056,-.166,side*.163],[-.097,-.279,side*.167],[-.122,-.345,side*.151]],
      [.003,.066,.077,.051,.003],.006));
    addMerged(l,hair,look.hair,material);
  }
  function chest(g,look) {
    const l=layer(g),hair=[],soft=[];
    // Soft continuous backing fills gaps; surface locks provide all visible layering.
    hair.push(lock([[-.147,.30,0],[-.172,.17,0],[-.19,-.08,0],[-.218,-.33,0],
      [-.239,-.56,0],[-.265,-.73,0],[-.28,-.805,0]], [.004,.29,.36,.365,.31,.20,.02],.022,28));
    for(let i=-3;i<=3;i++) {
      const z=i*.046,edge=Math.abs(i),end=-.83+edge*.035+(i%2===0?.015:0);
      (i%3===0?soft:hair).push(lock([[-.146,.30-edge*.012,z*.66],[-.185,.16,z],
        [-.219,-.075,z*1.12],[-.247,-.325,z*1.12],[-.264,-.59+edge*.016,z*1.06],
        [-.276,end,z*.97]], [.004,.096,.099,.096,.072,.003],.005,26));
    }
    addMerged(l,hair,look.hair,material);addMerged(l,soft,0x85808b,material);
  }
  return {head,chest};
}
