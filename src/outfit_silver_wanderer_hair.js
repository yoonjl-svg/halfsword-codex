// Silver-gray adaptation of Ukyo's exposed forehead and long front locks.
// SNK reference: https://www.snk-corp.co.jp/official/samuraispirits/characters/ukyo.php
// Only head-local visual geometry: no face, body, controller or collider edits.
export function createSilverWandererHair(h) {
  const { THREE, addMerged, CLOTH, artoriaCloth } = h;
  const material = { ...CLOTH, metalness: .04, roughness: .58 };
  // Elliptical ribbons follow their tangent so swept roots do not become flat seams.
  function lock(points, widths, depth=.008, rings=22) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const p=[], uv=[], indices=[], sides=8, across=new THREE.Vector3(), normal=new THREE.Vector3();
    for(let i=0;i<=rings;i++) {
      const t=i/rings, at=curve.getPoint(t), tangent=curve.getTangent(t).normalize();
      const u=t*(widths.length-1), j=Math.min(widths.length-2,Math.floor(u));
      const w=THREE.MathUtils.lerp(widths[j],widths[j+1],u-j);
      across.set(0,0,1).addScaledVector(tangent,-tangent.z).normalize();
      normal.crossVectors(across,tangent).normalize();
      for(let k=0;k<sides;k++) {
        const a=k/sides*Math.PI*2, v=at.clone().addScaledVector(across,Math.sin(a)*w/2)
          .addScaledVector(normal,Math.cos(a)*depth*Math.min(1,w/.012));
        p.push(v.x,v.y,v.z); uv.push(k/sides,t);
        if(i<rings) {
          const n=i*sides+k, next=i*sides+(k+1)%sides;
          indices.push(n,next,n+sides,next,next+sides,n+sides);
        }
      }
    }
    for(let k=1;k<sides-1;k++) { indices.push(0,k+1,k); const e=rings*sides;indices.push(e,e+k,e+k+1); }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  return (g,look)=> {
    const cap=g.children[4];
    if(cap?.geometry?.type==='SphereGeometry') {
      const geo=new THREE.SphereGeometry(.108,32,16,0,Math.PI*2,0,Math.PI*.7), p=geo.attributes.position;
      for(let i=0;i<p.count;i++) {
        const a=Math.atan2(p.getZ(i),p.getX(i)), t=Math.floor(i/33)/16;
        // Open brow; close-fitting nape. The upper surface stays a smooth crown.
        const theta=t*Math.PI*(.70-.34*Math.max(0,Math.cos(a)));
        const radius=.108+.0007*Math.cos(a*14)*Math.sin(theta)**2;
        p.setXYZ(i,radius*Math.sin(theta)*Math.cos(a),.112*Math.cos(theta),radius*Math.sin(theta)*Math.sin(a));
      }
      geo.computeVertexNormals();cap.geometry.dispose();cap.geometry=geo;
      cap.position.set(-.008,.006,0);cap.rotation.set(0,0,0);
    }
    const layer=artoriaCloth(g,'silver-wanderer-hair'), hair=[];
    for(const s of [-1,1]) {
      // Asymmetric part, flat cheek curtains, narrow tapered ends at the upper chest.
      const offset=s===1?.009:0;
      hair.push(lock([[.008,.115,-.021],[.065,.093,s*.039],[.095,.046,s*.078],
        [.114,-.026,s*.101],[.188,-.149,s*.128],[.237,-.266-offset,s*.134],
        [.252,-.331-offset,s*.119]], [.032,.058,.050,.039,.033,.023,.0015],.009));
      hair.push(lock([[.005,.113,s*.044],[.052,.088,s*.073],[.079,.032,s*.097],
        [.145,-.080,s*.124],[.218,-.205,s*.149],[.244,-.300+offset,s*.146]],
        [.025,.036,.027,.023,.018,.0015],.007));
    }
    addMerged(layer,hair,look.hair,material);
  };
}
