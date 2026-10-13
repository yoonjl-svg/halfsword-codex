// Optional low half-up arrangement. Reuses v4's full-length loose fall; only
// head-local hair is gathered. Face meshes, anatomy and physics stay native.
import { createSilverWandererFullHair } from './outfit_silver_wanderer_full_hair.js';

export function createSilverWandererCourtHair(h, originalHead) {
  const { THREE, bake, ball, cyl, addMerged, CLOTH, artoriaCloth }=h;
  const fullHair=createSilverWandererFullHair(h,originalHead);
  const material={...CLOTH,metalness:.04,roughness:.6};
  const gold={...CLOTH,metalness:.55,roughness:.43,steel:.6};
  const ivory={...CLOTH,metalness:.05,roughness:.6};
  function flatFringe() {
    // One broad diagonal sweep lies 1–2 mm above the same spherical cap.
    // No separate tubular roots, raised tips or bright crown highlights.
    const pos=[],uv=[],idx=[],across=24,rows=10;
    for(let j=0;j<=rows;j++)for(let i=0;i<=across;i++) {
      const u=i/across,t=j/rows,a=-.98+2.1*u;
      const top=.18+.18*Math.sin(Math.PI*u),hem=1.06+.2*u+.08*Math.sin(Math.PI*u);
      const theta=THREE.MathUtils.lerp(top,hem,t);
      const r=.1092+.0008*Math.sin(Math.PI*t)*Math.sin(Math.PI*u);
      pos.push(-.009+r*Math.sin(theta)*Math.cos(a),.005+r*Math.cos(theta),r*Math.sin(theta)*Math.sin(a));
      uv.push(u,t);
      if(j<rows&&i<across){const p=j*(across+1)+i;idx.push(p,p+1,p+across+1,p+1,p+across+2,p+across+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  }
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
  function crownPoint(theta,a,relief=0) {
    const r=.1125+.0025*Math.sin(theta)**2+.0013*Math.sin(a*6+theta*3)*Math.sin(theta)**2+relief;
    return [-.009+r*Math.sin(theta)*Math.cos(a),.005+r*1.075*Math.cos(theta),r*Math.sin(theta)*Math.sin(a)];
  }
  function layeredCrown() {
    const geo=new THREE.SphereGeometry(.1125,40,18,0,Math.PI*2,0,Math.PI*.77),p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const a=Math.atan2(p.getZ(i),p.getX(i)),t=Math.floor(i/41)/18;
      const theta=t*(Math.PI*(.77-.4*Math.max(0,Math.cos(a)))+.035*Math.sin(a*3));
      const point=crownPoint(theta,a);p.setXYZ(i,...point);
    }
    geo.computeVertexNormals();return geo;
  }
  function crownSweep(points,widths) {
    const curve=new THREE.CatmullRomCurve3(points.map(([theta,a])=>new THREE.Vector3(theta,a,0)));
    const pos=[],uv=[],idx=[],rows=20,columns=8;
    for(let j=0;j<=rows;j++) {
      const t=j/rows,center=curve.getPoint(t),u=t*(widths.length-1),k=Math.min(widths.length-2,Math.floor(u));
      const width=THREE.MathUtils.lerp(widths[k],widths[k+1],u-k);
      for(let i=0;i<=columns;i++) {
        const across=i/columns*2-1;
        // Broad, overlapping scalp-following sections: roots never detach.
        const theta=center.x+across*.075*Math.sin(t*Math.PI),a=center.y+across*width;
        pos.push(...crownPoint(theta,a,.0015+.0075*Math.sin(i/columns*Math.PI)*Math.sin(t*Math.PI)));
        uv.push(i/columns,t);
        if(j<rows&&i<columns){const n=j*(columns+1)+i;idx.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  }
  function plait(points,radius,spread,turns) {
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),pieces=[];
    for(let strand=0;strand<3;strand++) {
      const braid=[];
      for(let i=0;i<=60;i++) {
        const t=i/60,at=path.getPoint(t),axis=path.getTangent(t).normalize();
        const cross=new THREE.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();
        const normal=new THREE.Vector3().crossVectors(cross,axis).normalize(),a=t*Math.PI*2*turns+strand*Math.PI*2/3;
        at.addScaledVector(cross,spread*Math.cos(a)).addScaledVector(normal,spread*Math.sin(a));braid.push(at);
      }
      pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(braid),64,radius,5,false));
    }
    return pieces;
  }
  function braidedHead(g,look) {
    // Retain v4's filled side/back volume and long cheek sections, then replace
    // the smooth cap. The inherited lifted crown locks are gated off in v6.
    fullHair.head(g,look);
    const cap=g.children[4];cap.geometry.dispose();cap.geometry=layeredCrown();cap.position.set(0,0,0);
    const layer=artoriaCloth(g,'silver-wanderer-hair'),dark=[],soft=[];
    // Overlapping fans cover the whole front crown through the hairline.
    // The central sweep closes the former smooth triangle between side locks.
    dark.push(crownSweep([[.13,-.7],[.44,-.43],[.78,-.23],[1.08,-.1],[1.34,.14]],
      [.92,.67,.52,.37,.012]));
    soft.push(crownSweep([[.14,-.43],[.48,-.1],[.86,.2],[1.18,.54],[1.53,.94],[1.78,1.12]],
      [.84,.6,.45,.32,.18,.014]));
    soft.push(crownSweep([[.12,-.86],[.43,-.7],[.83,-.61],[1.16,-.5],[1.51,-.86],[1.84,-1.03]],
      [.84,.57,.43,.35,.19,.015]));
    dark.push(crownSweep([[.17,-1.11],[.53,-1.04],[1.01,-1.0],[1.54,-1.21],[1.95,-1.31]],
      [.62,.47,.35,.2,.015]));
    for(let i=0;i<2;i++)dark.push(crownSweep([[.16,.35+i*.8],[.57,.87+i*.67],
      [1.09,1.52+i*.55],[1.72,1.85+i*.45]], [.62,.46,.37,.018]));
    // A few broad tips break the cap edge while lying against the filled sides.
    for(const side of [-1,1])dark.push(lock([[.06,.04,side*.092],[.072,-.015,side*.111],
      [.04,-.09,side*.132],[.004,-.20,side*.145]], [.035,.045,.037,.003],.007));
    for(const side of [-1,1])dark.push(lock([[.015,.015,side*.132],[-.03,-.035,side*.166],
      [-.087,-.09,side*.166],[-.156,-.13,side*.104],[-.219,-.156,side*.016]],
      [.028,.052,.06,.055,.027],.009));
    addMerged(layer,dark,look.hair,material);addMerged(layer,soft,0x827d8a,material);
    const braid=[];
    for(const side of [-1,1])braid.push(...plait([[.038,.041,side*.115],[.013,.004,side*.149],
      [-.038,-.044,side*.184],[-.095,-.097,side*.18],[-.169,-.135,side*.108],[-.223,-.154,side*.024]],.004,.005,5));
    braid.push(...plait([[-.223,-.16,0],[-.237,-.25,0],[-.248,-.34,.006],[-.259,-.435,.014]],.005,.009,5));
    braid.push(lock([[-.26,-.43,.014],[-.269,-.48,.014],[-.278,-.54,.007]], [.031,.042,.003],.008));
    addMerged(layer,braid,0x918b99,material);
    addMerged(layer,[ball(.018,16,10,[-.237,-.152,0],null,[.25,.62,1.4])],0xd8cfb7,ivory);
    addMerged(layer,[bake(new THREE.TorusGeometry(.020,.002,5,24),[-.242,-.152,0],
      [0,Math.PI/2,0],[1.3,.64,1]),cyl(.017,.016,.011,12,false,[-.26,-.431,.014])],0xad914e,gold);
  }
  function head(g,look) {
    if(look?.hairStyle==='court_braided_layers'){braidedHead(g,look);return;}
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
    const swept=[flatFringe()],gleam=[];
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
