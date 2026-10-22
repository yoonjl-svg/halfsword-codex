// Returned king: approved ivory/gold general silhouette + the lone king's story.
// Native ragdoll costume, +X front. Cloth lives under the base mesh; every metal
// plate belongs to its native body part and participates in existing armor wear.
export function createReturnedKingOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, artoriaRoundedBox, taperedTube } = h;
  const IVORY=0xd7cfba, EDGE=0xae8e49, LIGHT=0xd0b16a, DARK=0x4a4134;
  const WINE=0x541f2a, HEM=0x9a7845, BLACK=0x171613;
  const metal={metalness:.68,roughness:.42,steel:.8};
  const cloth={metalness:0,roughness:.96,side:THREE.DoubleSide};
  const add=(g,p,c=IVORY,m=metal)=>addMerged(g,p,c,m);
  const rounded=(w,y,z,p,r=.025)=>bake(artoriaRoundedBox(w,y,z,r),p);
  function line(a,b,r=.0025){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
    return new THREE.CylinderGeometry(r,r,v.length(),5).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize())).translate(...start.add(end).multiplyScalar(.5).toArray());
  }
  function panel(x,yz,ridge=0){
    const y=yz.reduce((a,p)=>a+p[0],0)/yz.length,z=yz.reduce((a,p)=>a+p[1],0)/yz.length;
    const p=[x+ridge,y,z,...yz.flatMap(([a,b])=>[x,a,b])],index=[];
    for(let i=0;i<yz.length;i++)index.push(0,1+i,1+(i+1)%yz.length);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(p.filter((_,i)=>i%3!==0),2));geo.setIndex(index);geo.computeVertexNormals();return geo;
  }
  function outline(x,yz,r=.003){return yz.map((p,i)=>line([x,...p],[x,...yz[(i+1)%yz.length]],r));}
  function castle(x,y,z,s=1){
    // Raised three-tower gate relief, readable without a texture atlas.
    const pieces=[box(.004,.030*s,.058*s,[x,y,z])];
    for(const a of [-1,0,1]){
      const yy=y+.015*s+(a===0?.011*s:0),zz=z+a*.022*s;
      pieces.push(box(.006,.035*s,.015*s,[x+.003,yy,zz]));
      for(const b of [-1,1])pieces.push(box(.006,.009*s,.005*s,[x+.003,yy+.020*s,zz+b*.005*s]));
    }
    return pieces;
  }
  function medallion(g,x,y,z,r=.025){
    add(g,[cyl(r,r,.008,12,false,[x,y,z],[0,0,Math.PI/2])],EDGE);
    add(g,[cyl(r*.69,r*.69,.011,10,false,[x+.003,y,z],[0,0,Math.PI/2])],DARK);
    const rays=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;rays.push(line([x+.011,y+Math.cos(a)*r*.25,z+Math.sin(a)*r*.25],[x+.011,y+Math.cos(a)*r*.57,z+Math.sin(a)*r*.57],.0015));}add(g,rays,LIGHT);
  }
  function fittedBase(g){
    const m=g.children[0],p=m.geometry.parameters;
    for(const c of g.children.slice(1))c.visible=false;
    if(p.width){const geo=artoriaRoundedBox(p.width,p.height,p.depth,.025);m.geometry.copy(geo);geo.dispose();}
  }
  function cape(g){
    const layer=artoriaCloth(g,'returned-king-cape'),pos=[],uv=[],idx=[],colors=[],rows=18,cols=28;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const t=j/rows,u=i/cols*2-1,fold=Math.cos(u*Math.PI*5+.12*Math.sin(u*8)),width=.19+.15*Math.sin(Math.min(1,t*2)*Math.PI/2);
      pos.push(-.155-.13*t-.021*fold*(.25+.75*t),.14-1.19*t+.009*Math.cos(u*10)*t*t,u*width);
      uv.push(i/cols,t);const c=new THREE.Color(WINE).multiplyScalar(.72+.27*(fold+1)/2);colors.push(c.r,c.g,c.b);
      if(j<rows&&i<cols){const n=j*(cols+1)+i;idx.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();
    add(layer,[geo],0xffffff,{...cloth,vertexColors:true}).name='returned-king-wine-cape';
    const hem=[];
    for(const t of [.94,.98])for(let i=0;i<cols;i++){
      const at=u=>[-.155-.13*t-.021*Math.cos(u*Math.PI*5+.12*Math.sin(u*8))*(.25+.75*t)-.002,.14-1.19*t+.009*Math.cos(u*10)*t*t,u*.34];
      hem.push(line(at(i/cols*2-1),at((i+1)/cols*2-1),.003));
    }
    add(layer,hem,HEM,cloth);
    // Quiet damaged banner seams inside the mantle: the missing army's trace.
    add(layer,[-1,0,1].map((s)=>line([-.255,-.45,s*.15],[-.305,-.88,s*.21],.003)),0x7c4c43,cloth);
  }
  function helmet(g){
    const helm=new THREE.Group();helm.name='returned-king-closed-helmet';helm.userData.pieces={};g.add(helm);g.userData.helmet=helm;
    function piece(id,geos,color=IVORY,opts=metal){const group=new THREE.Group();group.name='royal-helm-'+id;helm.add(group);helm.userData.pieces[id]=group;const mesh=add(group,geos,color,opts);mesh.userData.base={color,roughness:opts.roughness};return group;}
    const shell=bake(new THREE.SphereGeometry(.122,16,10),[-.011,.012,0],null,[1,1.12,1]);
    piece('bowl',[shell]);
    // Opaque steel completely covers the original face, including the beard line.
    const visor=[[.074,-.098],[.084,-.055],[.079,.055],[.074,.098],[-.050,.109],[-.105,.069],[-.116,0],[-.105,-.069],[-.050,-.109]];
    piece('visor',[panel(.119,visor,.038)],IVORY,{...metal,side:THREE.DoubleSide});
    piece('bevor',[bake(new THREE.CylinderGeometry(.096,.117,.048,16,1,true),[0,-.102,0],null,[1.04,1,1])]);
    piece('trim',[...outline(.122,visor,.003),line([.158,.071,0],[.158,-.099,0],.0028),cyl(.123,.123,.012,16,true,[-.011,.079,0])],EDGE);
    // Black inlaid slit and vents have an opaque backing: no glowing eyes.
    piece('slit',[panel(.159,[[.027,-.077],[.027,.077],[.016,.075],[.016,-.075]])],BLACK,{roughness:1,metalness:0,side:THREE.DoubleSide});
    const vents=[];for(const s of [-1,1])for(let i=0;i<3;i++)vents.push(box(.002,.013,.004,[.148,-.020-i*.014,s*(.035+i*.008)]));piece('vents',vents,BLACK,cloth);
    const crown=[cyl(.125,.125,.015,16,true,[-.011,.100,0])];
    for(let i=-2;i<=2;i++){
      const a=i*.46,x=-.011+Math.cos(a)*.124,z=Math.sin(a)*.124,H=i===0?.080:.055;
      const geo=panel(.006,[[0,-.012],[H*.32,-.009],[H*.53,-.020],[H*.69,-.014],[H*.57,-.006],[H*.83,-.007],[H,0],[H*.83,.007],[H*.57,.006],[H*.69,.014],[H*.53,.020],[H*.32,.009],[0,.012]],.005);geo.rotateY(-a);geo.translate(x,.106,z);crown.push(geo);
    }
    piece('crest',crown,EDGE,{...metal,side:THREE.DoubleSide});
    piece('jewel',[bake(ball(.011,8,6),[.126,.119,0],null,[.4,1,1])],0x5d1c23,{...metal,metalness:.2});
    const plume=[];for(const s of [-1,0,1])plume.push(taperedTube([[0,.143,s*.012],[-.07,.205,s*.023],[-.16,.183,s*.026],[-.21,.09,s*.016],[-.19,-.035,s*.007]],[.018,.026,.025,.018,.003],16,6));
    piece('plume',plume,WINE,cloth);
  }
  function shoulder(g){
    const plates=[];for(let i=0;i<3;i++)plates.push(bake(new THREE.SphereGeometry(.122-i*.012,14,8,0,Math.PI*2,0,Math.PI*.65),[0,.071-i*.046,0],null,[1.05,.8,1.1]));
    add(g,plates);add(g,[bake(new THREE.TorusGeometry(.123,.0038,4,14,Math.PI*2),[0,.068,0],[Math.PI/2,0,0], [1.05,1.1,1])],EDGE);
    add(g,castle(.119,.039,0,.8),EDGE);
    const studs=[];for(const z of [-.062,0,.062])studs.push(ball(.0045,6,4,[.104,-.030,z]));add(g,studs,LIGHT);
  }
  function forearm(g){
    add(g,[cyl(.061,.051,.234,12,false,[0,-.005,0])]);
    add(g,[cyl(.064,.064,.017,12,true,[0,.106,0]),cyl(.054,.054,.018,12,true,[0,-.116,0])],EDGE);
    add(g,[panel(.060,[[.087,-.024],[.099,0],[.087,.024],[-.092,.020],[-.108,0],[-.092,-.020]],.009)],IVORY);
    add(g,[line([.071,.075,0],[.071,-.083,0],.0025)],EDGE);
  }
  function thigh(g){
    // Split, overlapping tassets follow each thigh instead of bridging the hips.
    const layer=artoriaCloth(g,'royal-skirt');add(layer,[cyl(.095,.105,.38,12,true,[0,.025,0])],WINE,cloth);
    for(let i=0;i<3;i++){
      const y=.165-i*.102,w=.074+i*.003,points=[[y,-w],[y,w],[y-.087,w+.005],[y-.105,0],[y-.087,-w-.005]];
      add(g,[panel(.100-i*.004,points,.019)]);add(g,outline(.103-i*.004,points,.0026),EDGE);
    }
    add(g,castle(.125,.070,0,.52),EDGE);
  }
  function shin(g){
    add(g,[cyl(.066,.044,.35,12,true,[0,-.005,0]),bake(ball(.071,12,8),[.014,.17,0],null,[1,.75,1])]);
    const pts=[[.186,0],[.136,.046],[-.168,.030],[-.185,0],[-.168,-.030],[.136,-.046]];
    add(g,[panel(.063,pts,.022)],IVORY);add(g,outline(.066,pts),EDGE);
    add(g,[line([.087,.132,0],[.087,-.163,0],.002)],EDGE);
  }
  function foot(g){
    add(g,[rounded(.257,.083,.119,[.010,.008,0],.025)]);
    const lines=[];for(const x of [-.05,0,.05,.10])lines.push(box(.009,.006,.106,[x,.050,0]));add(g,lines,EDGE);
  }
  return {
    armorParts:new Set(['chest','abdomen','pelvis','uarmS','uarmO','farmS','farmO','thighF','thighB','shinF','shinB','footF','footB']),
    head:helmet,
    neck(g){add(g,[cyl(.069,.084,.075,14,true,[0,.002,0])],DARK);},
    chest(g){
      fittedBase(g);cape(g);
      add(g,[rounded(.287,.283,.400,[-.002,.002,0],.048),cyl(.076,.100,.054,14,true,[0,.150,0])]);
      const pts=[[.118,-.155],[.135,0],[.118,.155],[-.084,.149],[-.138,0],[-.084,-.149]];
      add(g,[panel(.150,pts,.033)],IVORY);add(g,outline(.153,pts,.004),EDGE);
      const shield=[[.083,-.043],[.083,.043],[.014,.036],[-.028,0],[.014,-.036]];
      add(g,[panel(.187,shield,.006)],WINE,metal);add(g,outline(.191,shield,.0025),EDGE);add(g,castle(.198,.030,0,.84),LIGHT);
      for(const s of [-1,1]){
        medallion(g,.159,.108,s*.128,.025);
        const scrolls=[];for(let i=0;i<5;i++){const y=.069-i*.031,z=s*(.079+i*.006);scrolls.push(line([.175,y,z],[.174,y-.018,z+s*.021],.002),line([.174,y-.018,z+s*.021],[.173,y-.025,z+s*.006],.002));}add(g,scrolls,EDGE);
      }
    },
    abdomen(g){fittedBase(g);for(let i=0;i<3;i++){add(g,[rounded(.245,.066,.334-i*.008,[0,.055-i*.055,0],.025)]);add(g,[box(.007,.008,.296,[.127,.033-i*.055,0])],EDGE);}},
    pelvis(g){
      fittedBase(g);add(g,[rounded(.250,.158,.343,[0,.012,0],.035)]);
      add(g,[rounded(.262,.026,.350,[0,.074,0],.028)],DARK);add(g,[box(.012,.031,.037,[.136,.074,0])],EDGE);
      for(const s of [-1,1]){
        const pts=[[.048,s*.043],[.061,s*.157],[-.108,s*.189],[-.135,s*.107],[-.091,s*.043]];
        if(s<0)pts.reverse();
        add(g,[panel(.130,pts,.014)]);add(g,outline(.133,pts,.003),EDGE);
      }
    },
    uarmS:shoulder,uarmO:shoulder,farmS:forearm,farmO:forearm,
    thighF:thigh,thighB:thigh,shinF:shin,shinB:shin,footF:foot,footB:foot,
  };
}
