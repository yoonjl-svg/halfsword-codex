import {createJuliaOutfit} from './outfit_julia.js';

// Native body/face/hand proportions. These are costume meshes, not armor/colliders.
export function createJuliaAlterOutfit(h) {
  const {THREE:T,bake,box,cyl,ball,addMerged,artoriaCloth,taperedTube,reshapeMain,clothPanel,CLOTH}=h;
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
  function chest(g,look){
    base.chest(g,look);
    const group=artoriaCloth(g,'julia-mechanical-chest');
    // A small irregular opening in the right waistcoat, exposing inner framework.
    // Flush layering gives depth without changing the native torso or armor coverage.
    const opening=[[.099,.076],[.081,.104],[.066,.141],[.033,.153],
      [.005,.148],[-.031,.151],[-.079,.128],[-.096,.100],[-.071,.068],
      [-.039,.058],[-.014,.064],[.022,.052],[.052,.055],[.079,.060]];
    addMerged(group,[clothPanel(.140,opening,.002)],0x1c252a,{...CLOTH,roughness:.9});
    // Three curved ribs span the dark cavity; a narrow side rail joins their ends.
    const ribs=[.054,.004,-.045].map((y,i)=>tube([[.151,y,.069+i*.004],
      [.158,y+.006,.087],[.160,y+.003,.111],[.151,y-.009,.135-i*.003]],.0055));
    ribs.push(tube([[.150,.078,.117],[.153,.044,.141],[.153,-.012,.139],[.149,-.070,.122]],.005));
    // A short clavicle brace emerges below the turned shirt collar.
    ribs.push(tube([[.135,.118,.015],[.140,.112,.044],[.149,.089,.076]],.0045));
    addMerged(group,ribs,EDGE,metal);
    addMerged(group,[cyl(.009,.009,.041,10,false,[.149,-.046,.088]),
      cyl(.004,.004,.033,10,false,[.150,-.009,.088]),
      cyl(.012,.012,.008,14,false,[.151,.070,.085],[0,0,Math.PI/2])],STEEL,metal);
    addMerged(group,[bake(new T.TorusGeometry(.009,.0018,6,14),[.156,.070,.085],[0,Math.PI/2,0]),
      ...[.052,.002,-.047].map(y=>ball(.0026,7,5,[.160,y,.128]))],BRASS,metal);
    // Uneven folded cloth edges, not a metal border or a second breastplate.
    const edge=opening.concat([opening[0]]).map(([y,z])=>[.146,y,z]);
    addMerged(group,[tube(edge,.003),
      clothPanel(.148,[[.076,.060],[.056,.055],[.060,.071],[.067,.074]],.002),
      clothPanel(.148,[[-.072,.069],[-.094,.101],[-.081,.102],[-.067,.082]],.002)],0x293340,CLOTH);
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
  return {...base,head,chest,farmS:forearm};
}
