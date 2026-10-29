import {createJuliaOutfit} from './outfit_julia.js';

// Native body/face/hand proportions. These are costume meshes, not armor/colliders.
export function createJuliaAlterOutfit(h) {
  const {THREE:T,bake,box,cyl,ball,addMerged,artoriaCloth,taperedTube,reshapeMain,clothPanel,CLOTH,artoriaRoundedBox}=h;
  const base=createJuliaOutfit(h,{GREEN:0x293340,DARK_GREEN:0x202832,LINEN:0xc0c0b7,
    RUST:0xb5b6ae,RUST_DARK:0x777d7d,GOLD:0x988c6d,BROWN:0x433d36,COLLAR:0xd0d0c6});
  const STEEL=0x879091,EDGE=0xa5adaa,DARK=0x323c40,BRASS=0x8b7956;
  const metal={metalness:.63,roughness:.56,steel:.55};
  const tube=(pts,r)=>taperedTube(pts,pts.map(()=>r),Math.max(10,pts.length*5),6);
  // Project subdivided polygons onto the native face, so no floating flat mask or skin holes.
  const facePoint=([y,z],offset=.003)=>[Math.sqrt(Math.max(.00015,.101*.101-y*y-z*z))+offset,y,z];
  function facePatch(yz,offset=.003){
    const v=[],uv=[],indices=T.ShapeUtils.triangulateShape(yz.map(p=>new T.Vector2(...p)),[]);
    function tri(a,b,c,n){
      if(n){const mid=(p,q)=>p.map((x,i)=>(x+q[i])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);tri(a,ab,ca,n-1);tri(ab,b,bc,n-1);tri(ca,bc,c,n-1);tri(ab,bc,ca,n-1);return;}
      for(const p of [a,b,c]){v.push(...facePoint(p,offset));uv.push(...p);}
    }
    for(const [a,b,c]of indices)tri(yz[a],yz[b],yz[c],2);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  }
  function head(g,look){
    base.head(g,look);g.children[2].visible=false;
    const group=artoriaCloth(g,'julia-mechanical-face');
    const shape=[[.070,.033],[.058,.069],[.025,.091],[-.023,.088],[-.055,.067],[-.059,.047],[-.038,.029],[-.016,.019],[.003,.010],[.030,.015],[.046,.020]];
    addMerged(group,[facePatch(shape)],DARK,{...metal,side:T.DoubleSide});
    addMerged(group,[facePatch([[.057,.036],[.047,.069],[.020,.081],[.028,.048]],.006),facePatch([[-.013,.044],[-.024,.079],[-.048,.063],[-.039,.042]],.006)],STEEL,{...metal,side:T.DoubleSide});
    const boundary=shape.slice(5).concat([shape[0]]).map(p=>facePoint(p,.006));
    addMerged(group,[tube(boundary,.0017),tube([[-.010,.037],[-.032,.036],[-.050,.052]].map(p=>facePoint(p,.009)),.003)],EDGE,metal);
    addMerged(group,[bake(new T.TorusGeometry(.015,.0033,6,18),[.107,.016,.035],[0,Math.PI/2,0]),
      cyl(.012,.012,.006,14,false,[.107,.016,.035],[0,0,Math.PI/2])],DARK,metal);
    addMerged(group,[bake(new T.TorusGeometry(.013,.0015,6,18),[.111,.016,.035],[0,Math.PI/2,0]),
      ...[[.045,.052],[-.037,.063]].map(p=>ball(.0026,8,6,facePoint(p,.009)))],BRASS,metal);
    addMerged(group,[cyl(.0065,.0065,.002,12,false,[.112,.016,.035],[0,0,Math.PI/2])],0x6c1720,{metalness:.25,roughness:.4,emissive:0x4b0810,emissiveIntensity:.22});
  }
  // Remove the selected half of the actual garment/body surface, not an overlay.
  // The cut is cosmetic only: native collider, mass and joint descriptors stay intact.
  function trimSurface(g,keep){
    const meshes=[];g.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
    for(const mesh of meshes){
      const geo=mesh.geometry,attrs=geo.attributes,keys=Object.keys(attrs),rows=Object.fromEntries(keys.map(k=>[k,[]]));
      const matrix=new T.Matrix4();let node=mesh;
      while(node!==g){node.updateMatrix();matrix.premultiply(node.matrix);node=node.parent;}
      const vertex=i=>Object.fromEntries(keys.map(k=>[k,Array.from({length:attrs[k].itemSize},(_,n)=>attrs[k].array[i*attrs[k].itemSize+n])]));
      const dist=v=>keep(new T.Vector3(...v.position).applyMatrix4(matrix));
      const mix=(a,b,t)=>Object.fromEntries(keys.map(k=>[k,a[k].map((v,i)=>v+(b[k][i]-v)*t)]));
      const count=geo.index?.count??attrs.position.count;
      for(let i=0;i<count;i+=3){
        const tri=[0,1,2].map(n=>vertex(geo.index?geo.index.getX(i+n):i+n)),poly=[];
        for(let j=0;j<3;j++){
          const a=tri[j],b=tri[(j+1)%3],da=dist(a),db=dist(b);
          if(da>=0)poly.push(a);
          if((da>=0)!==(db>=0))poly.push(mix(a,b,da/(da-db)));
        }
        for(let j=1;j+1<poly.length;j++)for(const v of [poly[0],poly[j],poly[j+1]])for(const k of keys)rows[k].push(...v[k]);
      }
      if(!rows.position.length){mesh.visible=false;continue;}
      const out=new T.BufferGeometry();for(const k of keys)out.setAttribute(k,new T.Float32BufferAttribute(rows[k],attrs[k].itemSize));
      out.normalizeNormals();reshapeMain(mesh,out);
    }
  }
  const chrome={metalness:.82,roughness:.31,steel:.85};
  const graphite={metalness:.57,roughness:.50,steel:.45};
  // Compact actuators and shaped braces follow the existing torso, not a new rig.
  function between(a,b,r1,r2=r1){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),delta=q.clone().sub(p);
    const geo=new T.CylinderGeometry(r2,r1,delta.length(),10,1);
    geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));
    geo.translate(...p.add(q).multiplyScalar(.5).toArray());return geo;
  }
  function actuator(a,b,r=.009){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),mix=t=>p.clone().lerp(q,t).toArray();
    return [between(a,mix(.62),r),between(mix(.48),b,r*.48),
      ball(r*1.25,10,7,a),ball(r*.94,10,7,b)];
  }
  function hose(pts,r=.006,n=13){
    const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),ridges=[];
    for(let i=0;i<n;i++){
      const t=i/(n-1),p=curve.getPoint(t),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),curve.getTangent(t));
      const ring=new T.TorusGeometry(r*1.2,r*.21,5,10);ring.applyQuaternion(q);ring.translate(...p.toArray());ridges.push(ring);
    }
    return {core:tube(pts,r*.87),ridges};
  }
  // A closed gently convex casing with rounded boundary and a tapered outline.
  function casing(outline,x=.105,bulge=.012){
    const c=new T.Vector2();for(const p of outline)c.add(new T.Vector2(...p));c.divideScalar(outline.length);
    const boundary=new T.CatmullRomCurve3(outline.map(p=>new T.Vector3(0,...p)),true,'centripetal').getSpacedPoints(48).slice(0,-1);
    const area=boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p.y*q.z-p.z*q.y;},0);
    if(area<0)boundary.reverse();
    const pos=[],uv=[],idx=[],rings=5,n=boundary.length;
    for(let j=0;j<=rings;j++){
      const t=j/rings;for(const p of boundary){pos.push(x+bulge*(1-t*t),c.x+(p.y-c.x)*t,c.y+(p.z-c.y)*t);uv.push(t,p.y);}
    }
    for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n;idx.push(a,b,a+n,b,b+n,a+n);}
    const edge=pos.length/3;for(const p of boundary){pos.push(x-.006,p.y,p.z);uv.push(0,p.y);}
    const center=pos.length/3;pos.push(x-.006,c.x,c.y);uv.push(0,0);
    for(let i=0;i<n;i++){const a=rings*n+i,b=rings*n+(i+1)%n,aa=edge+i,bb=edge+(i+1)%n;idx.push(a,aa,b,b,aa,bb,center,bb,aa);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  function chest(g,look){
    base.chest(g,look);trimSurface(g,p=>p.z-(.006+.045*p.y));
    const group=artoriaCloth(g,'julia-mechanical-chest');
    const clavicleHose=hose([[-.010,.168,-.030],[.004,.164,-.088],[.012,.145,-.145],[.006,.110,-.185]],.006,16);
    const sideHose=hose([[-.074,.109,-.117],[-.087,.052,-.144],[-.078,-.050,-.135],[-.041,-.132,-.103]],.005,12);
    // Narrow spinal block and sockets stay behind the open diagonal framework.
    addMerged(group,[tube([[-.047,.145,-.026],[-.050,.040,-.034],[-.046,-.13,-.027]],.019),
      bake(artoriaRoundedBox(.085,.135,.047,.017),[-.028,-.010,-.040]),
      bake(ball(.045,16,12),[0,.103,-.186]),
      clavicleHose.core,sideHose.core,
      bake(new T.CylinderGeometry(.038,.044,.065,14,1,false,Math.PI/2,Math.PI),[0,.174,0]),
      box(.060,.060,.016,[0,.176,.006])],DARK,graphite);
    // Curved sternum and pectoral brace replace the former shelf-like rib bands.
    const sternum=[[.148,.004],[.137,-.026],[.089,-.044],[.034,-.038],[-.025,-.059],[-.077,-.047],[-.106,-.002]];
    addMerged(group,[casing(sternum,.096,.014),
      bake(casing([[.119,.013],[.100,.092],[.036,.109],[-.054,.079],[-.096,.018]],.077,.009),null,[0,Math.PI,0]),
      tube([[.105,.084,-.038],[.108,.119,-.075],[.083,.137,-.126],[.022,.111,-.181]],.012),
      tube([[-.075,.114,-.020],[-.090,.137,-.074],[-.069,.138,-.130],[-.005,.111,-.180]],.010),
      tube([[.097,-.082,-.029],[.103,-.065,-.073],[.066,-.036,-.128],[.004,.020,-.166]],.009),
      ...[.108,.054,-.007,-.067,-.121].map(y=>cyl(.025,.027,.019,14,false,[-.047,y,-.027]))],STEEL,chrome);
    addMerged(group,[...clavicleHose.ridges,...sideHose.ridges,
      ...actuator([.074,.064,-.124],[.090,-.070,-.055],.009),
      ...actuator([.015,.087,-.165],[.039,-.117,-.106],.011),
      ...actuator([-.076,.075,-.105],[-.048,-.122,-.085],.009),
      ...actuator([.042,.149,-.024],[.036,.205,-.021],.0055),
      ...actuator([-.042,.151,-.026],[-.036,.204,-.021],.0055),
      ...[.155,.176,.197].map(y=>bake(new T.TorusGeometry(.039,.0025,5,15,Math.PI),[0,y,0],[-Math.PI/2,0,0]))],EDGE,chrome);
    // Recessed shoulder pivot, with an outer socket and small central axle.
    addMerged(group,[bake(new T.TorusGeometry(.031,.006,7,20),[.006,.105,-.216]),
      cyl(.020,.020,.009,14,false,[.006,.105,-.217],[Math.PI/2,0,0]),
      ...[[.108,.101,-.029],[.114,.033,-.027],[.110,-.070,-.031]].map(p=>ball(.0037,8,6,p))],0xadb5b5,chrome);
    addMerged(group,[cyl(.009,.009,.011,10,false,[.006,.105,-.224],[Math.PI/2,0,0]),
      ...[[.112,.100,-.029],[.118,.033,-.027],[.114,-.070,-.031]].map(p=>ball(.0017,6,4,p))],DARK,graphite);
    // The untouched half remains cloth; the edge is slightly folded into the join.
    addMerged(group,[tube([[.121,.137,.012],[.122,.060,.009],[.121,-.040,.004],[.113,-.135,0]],.0025),
      tube([[-.122,.120,.012],[-.123,0,.006],[-.116,-.132,0]],.0025),
      clothPanel(.121,[[.117,.013],[.100,.010],[.105,-.003]],.002),
      clothPanel(.120,[[-.069,.003],[-.096,.001],[-.085,-.008]],.002)],0x35404a,CLOTH);
  }
  function abdomen(g,look){
    base.abdomen(g,look);trimSurface(g,p=>p.z-.001);
    const group=artoriaCloth(g,'julia-mechanical-waist');
    addMerged(group,[cyl(.027,.031,.115,14,false,[-.020,.015,-.044]),
      bake(artoriaRoundedBox(.090,.090,.080,.022),[-.017,.006,-.060])],DARK,graphite);
    const vertebra=[];
    for(const y of [.055,.025,-.005]){
      vertebra.push(cyl(.037,.039,.015,16,false,[-.013,y,-.044]));
      vertebra.push(bake(ball(.028,12,8),[.045,y,-.045],null,[.45,.28,1.20]));
    }
    addMerged(group,[...vertebra,
      ...actuator([.036,.078,-.106],[.042,-.032,-.109],.010),
      ...actuator([-.056,.076,-.090],[-.037,-.032,-.102],.009)],STEEL,chrome);
    addMerged(group,[...actuator([.060,.072,-.028],[.058,-.030,-.026],.0055),
      ...[.055,.025,-.005].map(y=>ball(.003,8,5,[.059,y,-.044]))],EDGE,chrome);
    addMerged(group,[box(.22,.036,.313,[0,-.051,0])],0x433d36,CLOTH);
    addMerged(group,[box(.012,.029,.035,[.117,-.051,-.02])],0x988c6d,CLOTH);
    addMerged(group,[box(.013,.017,.024,[.125,-.051,-.02])],0x433d36,CLOTH);
  }
  function upperOff(g,look){
    base.uarmO(g,look);trimSurface(g,p=>.068-p.y);
    const group=artoriaCloth(g,'julia-mechanical-shoulder');
    addMerged(group,[bake(ball(.040,14,10),[0,.112,0],null,[1,1.06,1]),
      cyl(.038,.037,.019,14,false,[0,.073,0])],STEEL,chrome);
    addMerged(group,[cyl(.039,.039,.006,14,false,[0,.075,0]),
      tube([[.028,.120,.006],[.033,.097,.008],[.025,.075,.006]],.003)],DARK,graphite);
  }
  function handPlates(mesh,closed){
    const group=new T.Group();group.name='julia-mechanical-hand';mesh.add(group);
    const y=closed?-.002:-.15,z=closed?.043:-.033;
    addMerged(group,[bake(box(.043,.048,.009),[0,y,z],[0,closed?0:.1,0]),
      ...[-1,0,1].map(i=>box(.011,.015,.007,[i*.014,y+.026,z-.002]))],STEEL,metal);
    addMerged(group,[-1,1].map(i=>ball(.0025,6,4,[i*.014,y-.015,z+(closed?.006:-.006)])),BRASS,metal);
    return group;
  }
  function forearm(g,look){
    base.farmS(g,look);
    const main=g.children[0];reshapeMain(main,cyl(.021,.019,.225,12,false));main.material.color.setHex(DARK);main.material.metalness=.45;main.material.roughness=.65;
    const group=artoriaCloth(g,'julia-mechanical-arm');
    // Parallel load-bearing rails and one short telescoping piston, all within the original arm width.
    addMerged(group,[-1,1].map(s=>tube([[.012,.087,s*.028],[.020,.03,s*.03],[.018,-.091,s*.023]],.007)),STEEL,metal);
    addMerged(group,[cyl(.031,.029,.018,16,false,[0,.054,0]),cyl(.027,.025,.018,16,false,[0,-.099,0]),
      cyl(.011,.011,.075,12,false,[-.021,.006,0]),cyl(.006,.006,.07,10,false,[-.021,-.061,0])],EDGE,metal);
    addMerged(group,[cyl(.034,.034,.006,16,true,[0,.053,0]),cyl(.028,.028,.006,16,true,[0,-.099,0]),
      cyl(.006,.006,.061,10,false,[.021,.055,0],[Math.PI/2,0,0])],BRASS,{...metal,side:T.DoubleSide});
    addMerged(group,[tube([[-.018,.052,.016],[-.028,.01,.018],[-.028,-.047,.014],[-.015,-.097,.014]],.003)],DARK,metal);
    // The native hands module reuses this material for open palm AND weapon-gripping fist.
    const sphere=g.children.find(o=>o.isMesh&&o.geometry.type==='SphereGeometry'&&Math.abs((o.geometry.parameters?.radius??0)-.042)<.002&&o.position.y<-.1);
    if(!sphere)throw new Error('Julia mechanical outfit: native hand missing');
    sphere.material=sphere.material.clone();sphere.material.color.setHex(STEEL);sphere.material.metalness=.55;sphere.material.roughness=.56;
    sphere.userData.decorateNativeHand=handPlates;
  }
  return {...base,head,chest,abdomen,uarmO:upperOff,farmS:forearm};
}
