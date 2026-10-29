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
  function ribBand(y){
    const positions=[],uv=[],indices=[],steps=24;
    for(let i=0;i<=steps;i++){
      const a=i/steps*Math.PI;
      for(const [r,dy]of [[0,-.010],[1,-.010],[1,.010],[0,.010]]){
        positions.push((.096+r*.016)*Math.cos(a),y+dy+.009*Math.sin(a),-(.150+r*.021)*Math.sin(a));uv.push(i/steps,dy);
      }
      if(i<steps)for(let j=0;j<4;j++){const k=i*4+j,n=i*4+(j+1)%4;indices.push(k,n,k+4,n,n+4,k+4);}
    }
    indices.push(0,2,1,0,3,2,steps*4,steps*4+1,steps*4+2,steps*4,steps*4+2,steps*4+3);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function chest(g,look){
    base.chest(g,look);
    // Left half: negative local Z, opposite the existing face and weapon-arm machinery.
    trimSurface(g,p=>p.z-(.006+.045*p.y));
    const group=artoriaCloth(g,'julia-mechanical-chest');
    // Narrow inner chassis leaves actual depth and gaps between the outer rib brackets.
    addMerged(group,[bake(artoriaRoundedBox(.12,.235,.085,.018),[-.012,-.003,-.063]),
      box(.205,.278,.011,[0,0,.004],[.045,0,0]),
      cyl(.034,.032,.21,14,false,[-.040,-.010,-.111])],DARK,metal);
    addMerged(group,[ribBand(.086),ribBand(.005),ribBand(-.078),
      tube([[.005,.149,-.006],[.024,.151,-.070],[.016,.123,-.146],[0,.100,-.195]],.016),
      tube([[-.085,.113,-.075],[-.090,.01,-.105],[-.078,-.119,-.089]],.008),
      bake(new T.CylinderGeometry(.041,.047,.065,16,1,false,Math.PI/2,Math.PI),[0,.174,0]),
      box(.076,.065,.016,[0,.174,.006])],STEEL,metal);
    // Shoulder bearing is part of the torso silhouette, not a decorative shoulder pad.
    addMerged(group,[cyl(.046,.046,.035,18,false,[0,.103,-.188],[Math.PI/2,0,0]),
      cyl(.034,.034,.040,16,false,[0,.103,-.192],[Math.PI/2,0,0]),
      cyl(.038,.038,.026,20,false,[.073,.021,-.082],[0,0,Math.PI/2])],DARK,metal);
    addMerged(group,[bake(new T.TorusGeometry(.038,.006,7,22),[0,.103,-.209]),
      bake(new T.TorusGeometry(.033,.005,7,20),[.088,.021,-.082],[0,Math.PI/2,0]),
      cyl(.015,.015,.065,12,false,[.075,-.071,-.064]),
      cyl(.007,.007,.064,10,false,[.075,-.114,-.064]),
      tube([[.102,.112,-.012],[.109,.034,-.018],[.107,-.105,-.014]],.006)],EDGE,metal);
    const teeth=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2;teeth.push(box(.007,.010,.008,[.093,.021+Math.cos(a)*.025,-.082+Math.sin(a)*.025],[a,0,0]));}
    addMerged(group,[...teeth,cyl(.010,.010,.009,12,false,[.094,.021,-.082],[0,0,Math.PI/2]),
      ...[.089,.008,-.075].map(y=>ball(.0035,7,5,[.112,y,-.025]))],BRASS,metal);
    addMerged(group,[tube([[-.010,.11,-.139],[.039,.05,-.139],[.044,-.030,-.128],[.015,-.121,-.108]],.005),
      tube([[.040,.135,-.043],[.061,.084,-.061],[.051,.030,-.045]],.004)],0x252d31,{...metal,roughness:.84});
    // Cloth ends near the sternum; it does not continue under the exposed half.
    addMerged(group,[tube([[.121,.137,.012],[.122,.06,.009],[.121,-.04,.004],[.113,-.135,0]],.003),
      tube([[-.122,.12,.012],[-.123,0,.006],[-.116,-.132,0]],.003)],0x35404a,CLOTH);
  }
  function abdomen(g,look){
    base.abdomen(g,look);trimSurface(g,p=>p.z-.001);
    const group=artoriaCloth(g,'julia-mechanical-waist');
    addMerged(group,[bake(artoriaRoundedBox(.13,.13,.09,.015),[-.005,.008,-.06]),
      cyl(.028,.032,.11,14,false,[0,.012,-.108])],DARK,metal);
    addMerged(group,[cyl(.011,.011,.085,12,false,[.065,.014,-.071]),
      cyl(.006,.006,.11,10,false,[.065,.017,-.113]),
      box(.134,.019,.127,[0,.047,-.071]),box(.14,.019,.13,[0,-.016,-.071])],STEEL,metal);
    addMerged(group,[box(.144,.005,.127,[0,.056,-.071]),
      cyl(.014,.014,.009,12,false,[.067,-.026,-.071])],BRASS,metal);
    // Retain the continuous native belt and buckle below the exposed waist joint.
    addMerged(group,[box(.22,.036,.313,[0,-.051,0])],0x433d36,CLOTH);
    addMerged(group,[box(.012,.029,.035,[.117,-.051,-.02])],0x988c6d,CLOTH);
    addMerged(group,[box(.013,.017,.024,[.125,-.051,-.02])],0x433d36,CLOTH);
  }
  function upperOff(g,look){
    base.uarmO(g,look);trimSurface(g,p=>.068-p.y);
    const group=artoriaCloth(g,'julia-mechanical-shoulder');
    addMerged(group,[cyl(.043,.039,.075,14,false,[0,.104,0])],DARK,metal);
    addMerged(group,[cyl(.045,.044,.016,16,false,[0,.131,0]),
      cyl(.042,.042,.012,16,false,[0,.073,0])],STEEL,metal);
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
