// Optional low half-up arrangement. Reuses v4's full-length loose fall; only
// head-local hair is gathered. Face meshes, anatomy and physics stay native.
import { createSilverWandererFullHair } from './outfit_silver_wanderer_full_hair.js';

export function createSilverWandererCourtHair(h, originalHead) {
  const { THREE, bake, ball, cyl, addMerged, CLOTH, artoriaCloth }=h;
  const fullHair=createSilverWandererFullHair(h,originalHead);
  const material={...CLOTH,metalness:.04,roughness:.6};
  const gold={...CLOTH,metalness:.55,roughness:.43,steel:.6};
  const ivory={...CLOTH,metalness:.05,roughness:.6};
  function lock(points,widths,depth=.009) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const pos=[],uv=[],idx=[],rings=18,sides=8,across=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let i=0;i<=rings;i++) {
      const t=i/rings,at=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
      const u=t*(widths.length-1),j=Math.min(widths.length-2,Math.floor(u));
      const width=THREE.MathUtils.lerp(widths[j],widths[j+1],u-j);
      across.set(0,0,1).addScaledVector(tangent,-tangent.z).normalize();
      normal.crossVectors(across,tangent).normalize();
      for(let k=0;k<sides;k++) {
        const a=k/sides*Math.PI*2,v=at.clone().addScaledVector(across,Math.sin(a)*width/2)
          .addScaledVector(normal,Math.cos(a)*depth*Math.min(1,width/.02));
        pos.push(v.x,v.y,v.z);uv.push(k/sides,t);
        if(i<rings){const n=i*sides+k,next=i*sides+(k+1)%sides;idx.push(n,next,n+sides,next,next+sides,n+sides);}
      }
    }
    for(let k=1;k<sides-1;k++){idx.push(0,k+1,k);const e=rings*sides;idx.push(e,e+k,e+k+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  }
  function head(g,look) {
    originalHead(g,look);
    const layer=artoriaCloth(g,'silver-wanderer-hair');
    // Compact the existing face-framing locks and gather their rear ends.
    // Only this newly created hairstyle's own merged geometry is transformed.
    for(const mesh of layer.children) {
      const p=mesh.geometry?.attributes.position;if(!p)continue;
      for(let i=0;i<p.count;i++) {
        let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        if(x>0) {
          if(y<.055){y=.055+(y-.055)*.68;x=.066+(x-.066)*.7;z*=.94;}
          else {z*=.94;y-=.002;}
        } else {
          const gather=THREE.MathUtils.smoothstep(.06-y,0,.38);
          x=THREE.MathUtils.lerp(x,-.197,gather*.86);z*=1-.79*gather;
          y=.06+(y-.06)*.59;
        }
        p.setXYZ(i,x,y,z);
      }
      mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
    const swept=[],gleam=[];
    // Broad curved sections sweep behind the ears and overlap at the low tie.
    for(const side of [-1,1]) {
      swept.push(lock([[.022,.075,side*.074],[-.022,.026,side*.111],[-.098,-.04,side*.116],
        [-.164,-.10,side*.068],[-.202,-.136,side*.013]], [.02,.061,.066,.046,.021],.01));
      swept.push(lock([[-.055,.064,side*.069],[-.098,.016,side*.083],[-.14,-.057,side*.074],
        [-.197,-.13,side*.017]], [.039,.061,.048,.016],.01));
      gleam.push(lock([[-.003,.06,side*.101],[-.062,.002,side*.126],[-.124,-.066,side*.105],
        [-.192,-.128,side*.023]], [.003,.007,.006,.002],.003));
    }
    // A short loose tail overlaps the existing full fall below the clasp.
    swept.push(lock([[-.202,-.13,0],[-.217,-.20,.002],[-.228,-.29,-.009],[-.23,-.37,-.014]],
      [.043,.074,.07,.004],.01));
    addMerged(layer,swept,look.hair,material);addMerged(layer,gleam,0x98939d,material);
    // One face-following braid, large enough to read without an upright wisp.
    const braid=[];
    for(let strand=0;strand<3;strand++) {
      const points=Array.from({length:51},(_,i)=>{
        const t=i/50,a=t*Math.PI*9+strand*Math.PI*2/3;
        return new THREE.Vector3(.061+t*.026+.004*Math.sin(a),.043-t*.269,-.107-t*.034+.004*Math.cos(a));
      });
      braid.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),58,.0028,5,false));
    }
    braid.push(lock([[.087,-.222,-.141],[.09,-.255,-.145],[.09,-.279,-.143]], [.014,.014,.002],.006));
    addMerged(layer,braid,0x98939d,material);
    // Small ivory oval with a gold edge, no diadem or royal emblem.
    addMerged(layer,[ball(.019,16,10,[-.22,-.137,0],null,[.23,.64,1.4])],0xd8cfb7,ivory);
    addMerged(layer,[bake(new THREE.TorusGeometry(.021,.002,5,24),[-.225,-.137,0],
      [0,Math.PI/2,0],[1.3,.66,1]),cyl(.0078,.0078,.008,10,false,[.087,-.221,-.14])],0xad914e,gold);
  }
  return {head,chest:fullHair.chest};
}
