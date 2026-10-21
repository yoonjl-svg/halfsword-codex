// Silver lamellar warrior: follow the supplied reference armor closely.
// Mongol origin belongs to the story, not a separate costume reinterpretation.
// Reference-inspired fantasy equipment, not a reconstruction of a single relic.
export function createWhiteScaleOutfit(h) {
  const {THREE,bake,box,cyl,ball,addMerged,artoriaCloth,artoriaRoundedBox,taperedTube,clothNeck}=h;
  const SILVER=0xc3c4b7,PALE=0xd6d5c8,STEEL=0x8e958d,INK=0x242827,RED=0x79282d,GOLD=0xa38953,LEATHER=0x473c30;
  const metal={metalness:.63,roughness:.41,steel:.8},cloth={metalness:0,roughness:.95,side:THREE.DoubleSide};
  const add=(g,a,c=SILVER,m=metal)=>addMerged(g,a,c,m),V=p=>new THREE.Vector3(...p);
  const curve=(p,r=.002,n=16)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(V)),n,r,4,false);
  function mesh(p,uv,ix){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
  function profile(rows,y){let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return a.map((v,j)=>THREE.MathUtils.lerp(v,b[j],t));}
  const at=(rows,y,a,lift=0)=>{const [,d,w,x=0]=profile(rows,y);return[x+(d+lift)*Math.cos(a),y,(w+lift)*Math.sin(a)];};
  function shell(rows,a0=-Math.PI,a1=Math.PI,N=32){
    const p=[],uv=[],ix=[];for(let j=0;j<rows.length;j++)for(let i=0;i<=N;i++){
      p.push(...at(rows,rows[j][0],a0+(a1-a0)*i/N));uv.push(i/N,j/(rows.length-1));
      if(j<rows.length-1&&i<N){const n=j*(N+1)+i;ix.push(n,n+N+1,n+1,n+1,n+N+1,n+N+2);}
    }return mesh(p,uv,ix);
  }
  function ring(rows,y,a0=-Math.PI,a1=Math.PI,r=.002,lift=0){return curve(Array.from({length:33},(_,i)=>at(rows,y,a0+(a1-a0)*i/32,lift)),r,32);}
  function base(g,rows){const m=g.children[0];for(const c of g.children.slice(1))c.visible=false;m.geometry.dispose();m.geometry=shell(rows);}
  const scaleOutline=[[-.49,.48],[.49,.48],[.49,-.16],[.37,-.39],[0,-.53],[-.37,-.39],[-.49,-.16]];
  function scale(rows,y,a,w,H,lift){
    const p=at(rows,y,a,lift+.002),uv=[.5,.5],ix=[],N=scaleOutline.length;
    for(const k of [.82,1])for(const[u,v]of scaleOutline){p.push(...at(rows,y+v*H*k,a+u*w*k,lift+(k<1?.0025:0)));uv.push(u+.5,v+.5);}
    for(let i=0;i<N;i++){const j=(i+1)%N;ix.push(0,1+i,1+j,1+i,1+N+i,1+N+j,1+i,1+N+j,1+j);}return mesh(p,uv,ix);
  }
  function lamellar(g,rows,top,bottom,bands,cols,a0=-Math.PI,a1=Math.PI,{color=SILVER,laces=false}={}){
    const piles=[[],[],[]],stitches=[],rivets=[],step=(top-bottom)/(bands-1),dw=(a1-a0)/cols;
    // Bottom first: upper rows overlap lower rows with a real beveled edge.
    for(let row=bands-1;row>=0;row--)for(let col=0;col<cols;col++){
      const y=top-row*step,a=a0+(col+.5+(row%2?.17:-.17))*dw;
      if(a<a0+dw*.25||a>a1-dw*.25)continue;
      const offset=.004+(bands-row)*.0003;
      piles[(col+row*2)%3].push(scale(rows,y,a,dw*.95,step*1.48,offset));
      if(row%2===0&&col%2===0)rivets.push(ball(.0018,5,3,at(rows,y+step*.32,a,offset+.003)));
      if(laces&&col%3===1&&row<bands-1){
        stitches.push(curve([at(rows,y+step*.28,a-dw*.15,offset+.004),at(rows,y-step*.30,a+dw*.15,offset+.006)],.0013,2));
      }
    }
    add(g,piles[0],color);add(g,piles[1],color===SILVER?PALE:color);add(g,piles[2],color===SILVER?0xabb1a9:color);
    add(g,rivets,STEEL);add(g,stitches,RED,cloth);
  }
  function ribbon(g,rows,side=1){
    const p=[],uv=[],ix=[];for(let i=0;i<=24;i++)for(let edge=0;edge<2;edge++){
      const t=i/24,y=.125-.256*t,a=(side>0?0:Math.PI)+(-.88+1.56*t)+(edge?1:-1)*.16;
      p.push(...at(rows,y,a,.017+.002*Math.sin(t*7*Math.PI)+(edge?0:.001)));uv.push(edge,t);if(i<24&&edge===0){const n=i*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}
    }add(g,[mesh(p,uv,ix)],RED,cloth);
    const cords=[];for(const edge of [-1,1])cords.push(curve(Array.from({length:25},(_,i)=>{const t=i/24;return at(rows,.125-.256*t,(side>0?0:Math.PI)-.88+1.56*t+edge*.16,.017);}),.0014,24));add(g,cords,0x9e4c45,cloth);
  }
  function stud(g,p,r=.008){add(g,[bake(ball(r,10,6),p,null,[.36,1,1])],GOLD);add(g,[ball(r*.27,7,4,[p[0]+r*.4,p[1],p[2]])],INK);}
  function helmet(g){
    const helm=new THREE.Group();helm.name='white-scale-kabuto';helm.userData.pieces={};g.add(helm);g.userData.helmet=helm;
    function piece(id,geos,color=SILVER,mat=metal,pivot=[0,0,0]){
      const group=new THREE.Group();group.name='white-scale-helm-'+id;group.position.set(...pivot);helm.add(group);helm.userData.pieces[id]=group;
      for(const geo of geos)geo.translate(-pivot[0],-pivot[1],-pivot[2]);
      const m=add(group,geos,color,mat);if(m)m.userData.base={color,roughness:mat.roughness};return group;
    }
    const bowl=[[-.023,.110,.115,-.012],[.034,.113,.119,-.015],[.085,.096,.100,-.018],[.123,.066,.072,-.019],[.145,.020,.027,-.02]];
    piece('bowl',[shell(bowl)],INK,metal);
    const ribs=[],studs=[];for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2;ribs.push(curve(bowl.map(([y])=>at(bowl,y,a,.002)),.002,12));
      for(const y of [.008,.043,.078])studs.push(ball(.0025,6,4,at(bowl,y,a,.005)));
    }piece('ribs',ribs,STEEL);piece('rivets',studs,GOLD);
    piece('crest',[cyl(.025,.032,.013,12,false,[-.02,.148,0])],GOLD);
    // Wide, flared, overlapping neck guard (shikoro) with a narrow face opening.
    const nape=[[-.115,.147,.160,-.020],[-.069,.133,.144,-.020],[-.025,.117,.125,-.020],[.010,.114,.121,-.020]];
    const neckGuard=piece('nape',[shell(nape,.68,Math.PI*2-.68)],INK,{...metal,side:THREE.DoubleSide});
    lamellar(neckGuard,nape,-.006,-.102,5,27,.67,Math.PI*2-.67,{laces:true});
    add(neckGuard,[ring(nape,-.113,.67,Math.PI*2-.67,.003)],RED,cloth);
    // Brow and opaque menpo. Eyes are shadowed apertures, not glowing lamps.
    const brow=[[-.002,.117,.110,0],[.020,.150,.117,0],[.038,.130,.109,0]];
    piece('peak',[shell(brow,-Math.PI*.49,Math.PI*.49)],INK,{...metal,side:THREE.DoubleSide});
    piece('brow-trim',[ring(brow,.019,-Math.PI*.49,Math.PI*.49,.0022)],GOLD);
    const mask=[[-.118,.066,.048,.027],[-.093,.092,.074,.020],[-.058,.114,.087,.011],[-.021,.120,.091,.008],[.004,.116,.092,.007]];
    const maskGroup=piece('mask',[shell(mask,-Math.PI*.58,Math.PI*.58)],0x434947,{...metal,side:THREE.DoubleSide});
    const nose=bake(new THREE.ConeGeometry(.016,.047,4),[.135,-.026,0],[0,0,-Math.PI/2],[1,1,.72]);add(maskGroup,[nose],0x67716b);
    const lips=[curve([[.127,-.067,-.032],[.141,-.062,0],[.127,-.067,.032]],.0033,12),curve([[.117,-.089,-.025],[.130,-.094,0],[.117,-.089,.025]],.0018,12)];add(maskGroup,lips,0x101613);
    for(const s of [-1,1]){
      add(maskGroup,[curve([[.103,-.028,s*.064],[.120,-.042,s*.046],[.129,-.048,s*.027]],.0016,12)],STEEL);
      stud(maskGroup,[.081,-.064,s*.080],.008);
    }
    // A dark backing closes the eye band while the brow casts a deep shadow.
    const eyeBand=[[-.007,.115,.099,.002],[.018,.119,.102,.002]];piece('eyes',[shell(eyeBand,-Math.PI/2,Math.PI/2)],0x101613,cloth);
    for(const [s,id]of [[1,'hornR'],[-1,'hornL']]){
      const pts=[[.002,.105,s*.070],[.007,.185,s*.130],[.001,.218,s*.223],[-.012,.204,s*.300],[-.033,.278+(s>0?.012:0),s*.377]];
      const horn=piece(id,[taperedTube(pts,[.027,.025,.018,.011,.0008],36,10)],0x242822,{...metal,metalness:.16,roughness:.66},pts[0]);
      const rim=cyl(.032,.033,.015,16,true,pts[0]);rim.translate(-pts[0][0],-pts[0][1],-pts[0][2]);add(horn,[rim],GOLD);
      // Fine axial ridges distinguish horn from a smooth plastic spike.
      const lines=[];for(const k of [-1,1]){const p=pts.map((p,i)=>[p[0]-.009*k*(1-i/4),p[1]+.003,p[2]+s*.005*k*(1-i/4)]).map(p=>p.map((x,j)=>x-pts[0][j]));lines.push(curve(p,.0011,32));}add(horn,lines,0x4b4937,cloth);
    }
    const tie=piece('ties',[],RED,cloth);
    for(const s of [-1,1])add(tie,[curve([[.015,-.017,s*.112],[.087,-.105,s*.061],[.102,-.126,0]],.0032,18)],RED,cloth);
  }
  function shoulder(g){
    // Broad hanging sode: a flatter cap, clearer step between overlapping rows,
    // and tied mounting plates. Keep the arm and joint positions unchanged.
    const rows=[[-.115,.069,.093,0],[-.020,.069,.099,0],[.070,.070,.100,0],[.126,.064,.083,0],[.156,.039,.049,0]];
    base(g,[[-.190,.048,.050,0],[-.110,.057,.063,0],...rows.slice(1).map(([y,d,w,x])=>[y,d-.009,w-.009,x]),[.177,.006,.008,0]]);
    const cap=add(g,[shell(rows)],INK);lamellar(cap,rows,.132,-.099,9,18,-Math.PI,Math.PI,{laces:true});
    add(cap,[ring(rows,-.114,-Math.PI,Math.PI,.003),ring(rows,.120,-Math.PI,Math.PI,.0025)],STEEL);
    const binding=[],fasteners=[];
    for(const s of [-1,1]){
      binding.push(curve([at(rows,.130,s*.8,.013),at(rows,.063,s*.8,.017),at(rows,-.103,s*.8,.014)],.0032,20));
      for(const y of [.126,.064,-.020])fasteners.push(ball(.003,6,4,at(rows,y,s*.8,.017)));
    }add(cap,binding,RED,cloth);add(cap,fasteners,GOLD);
    const mount=artoriaCloth(g,'white-scale-sode-mount');add(mount,[curve([[.014,.165,-.032],[.030,.172,0],[.014,.165,.032]],.005,12),curve([[.005,.163,0],[.025,.171,-.016],[.028,.156,0],[.025,.171,.016],[.005,.163,0]],.003,16)],RED,cloth);
    const under=artoriaCloth(g,'white-scale-elbow-fabric');
    const cuff=[[-.191,.047,.050,0],[-.148,.055,.060,0],[-.090,.058,.064,0]];
    add(under,[shell(cuff)],0x303632,cloth);brocade(under,cuff,-.176,-.100,4,18);
  }
  function brocade(g,rows,bottom,top,bands,cols){
    const pattern=[],dw=Math.PI*2/cols,dy=(top-bottom)/bands;
    for(let r=0;r<bands;r++)for(let c=0;c<cols;c++){
      const y=bottom+(r+.5)*dy,a=(c+.5+(r%2)*.5)*dw;
      pattern.push(curve([at(rows,y-dy*.35,a,.003),at(rows,y,a-dw*.28,.003),at(rows,y+dy*.35,a,.003),at(rows,y,a+dw*.28,.003),at(rows,y-dy*.35,a,.003)],.0009,4));
    }add(g,pattern,0x666652,cloth);
  }
  function bracer(g){
    const rows=[[-.117,.047,.047,0],[-.060,.050,.049,0],[.040,.057,.056,0],[.114,.058,.057,0]];
    const backing=add(g,[shell(rows)],0x383b31,cloth);brocade(backing,rows,-.103,.075,6,20);
    const slats=[];for(let i=-2;i<=2;i++)slats.push(shell([[-.099,.053,.051,0],[.075,.063,.060,0]],i*.35-.12,i*.35+.12,3));const brace=add(g,slats,0x4d5751);const edges=[],rivets=[];for(let i=-2;i<=2;i++){for(const edge of [-.12,.12])edges.push(curve([at(rows,-.094,i*.35+edge,.007),at(rows,.069,i*.35+edge,.007)],.0009,2));for(const y of [-.090,.064])rivets.push(ball(.002,6,4,at(rows,y,i*.35,.009)));}add(brace,edges,STEEL);add(brace,rivets,GOLD);
    add(g,[ring(rows,-.082,-Math.PI,Math.PI,.004,.009),ring(rows,.060,-Math.PI,Math.PI,.004,.009)],RED,cloth);
    lamellar(g,rows,.111,.084,2,18,-Math.PI,Math.PI,{laces:true});
    const pattern=[];for(let row=0;row<4;row++)for(let i=-2;i<=2;i++)pattern.push(curve([at(rows,-.060+row*.032,Math.PI+i*.26,.003),at(rows,-.048+row*.032,Math.PI+i*.26+.13,.003),at(rows,-.036+row*.032,Math.PI+i*.26,.003)],.001,2));add(g,pattern,0x8d7f60,cloth);
  }
  function skirtPanel(g,rows,a0,a1){
    const structuralRows=rows.map(([y,...r])=>[Math.min(y,.178),...r]);
    const panel=add(g,[shell(structuralRows,a0,a1,9)],INK,{...metal,side:THREE.DoubleSide});
    const trim=[curve(structuralRows.map(([y])=>at(structuralRows,y,a0,.002)),.0022,14),curve(structuralRows.map(([y])=>at(structuralRows,y,a1,.002)),.0022,14),ring(structuralRows,structuralRows[0][0],a0,a1,.0022)];
    const lames=[],edges=[],lacing=[],holes=[];
    for(let row=0;row<5;row++){
      const y=rows.at(-1)[0]-.012-row*.063,edge=y-.062;
      const section=[edge,y-.020,y].map(Y=>{const [,d,w,x]=profile(rows,Y);return[Y,d+.004,w+.004,x]});
      lames.push(shell(section,a0+.025,a1-.025,12));edges.push(ring(section,edge,a0+.025,a1-.025,.0013,.0005));
      for(let j=0;j<6;j++){
        const a=a0+(j+.5)/6*(a1-a0);
        for(const sign of [-1,1]){
          const aa=a+sign*.023;
          holes.push(ball(.0018,5,3,at(rows,y-.010,aa,.0055)));
          lacing.push(curve([at(rows,y-.009,aa,.006),at(rows,y-.031,aa+sign*.009,.008),at(rows,y-.049,aa,.006)],.0015,4));
        }
      }
    }
    add(panel,lames,0x303633);add(panel,edges,0x68706a);add(panel,holes,0x111815);add(panel,lacing,RED,cloth);add(g,trim,STEEL);
  }
  function thigh(g){
    const fabric=artoriaCloth(g,'white-scale-trousers');const pants=[[-.235,.057,.060,0],[-.19,.068,.070,0],[.10,.078,.083,0],[.19,.074,.078,0]];add(fabric,[shell(pants)],0x252d2c,cloth);brocade(fabric,pants,-.226,-.155,4,20);
    // Each divided skirt panel follows its own leg; no solid hoop bridges legs.
    const rows=[[-.155,.133,.164,0],[-.085,.126,.149,0],[.060,.105,.113,0],[.205,.087,.085,0]];
    skirtPanel(g,rows,-1.38,-.12);skirtPanel(g,rows,.12,1.38);skirtPanel(g,rows,1.62,3.02);skirtPanel(g,rows,-3.02,-1.62);
  }
  function shin(g){
    const rows=[[-.183,.050,.047,0],[-.08,.056,.053,0],[.075,.057,.054,0],[.170,.051,.049,0]];
    add(g,[shell(rows)],LEATHER,cloth);
    const plates=[];for(let i=-1;i<=1;i++)plates.push(shell([[-.169,.056,.051,0],[.139,.063,.058,0]],i*.44-.16,i*.44+.16,4));add(g,plates,0x4d5751);
    const pattern=[];for(let row=0;row<8;row++)for(const a of [-.44,0,.44]){const y=-.145+row*.035;pattern.push(curve([at(rows,y,a-.10,.012),at(rows,y+.010,a,.014),at(rows,y,a+.10,.012)],.0012,3));}add(g,pattern,0x948e75,cloth);
    const welt=artoriaCloth(g,'white-scale-knee-wrap');add(welt,[shell([[.132,.058,.056,0],[.172,.059,.057,0],[.193,.051,.049,0]])],0x333a34,cloth);brocade(welt,[[.132,.058,.056,0],[.193,.051,.049,0]],.138,.183,3,18);
    const ties=[];for(const y of [-.136,-.052,.058,.132])ties.push(ring(rows,y,-Math.PI,Math.PI,.003,.009));add(g,ties,0x282b26,cloth);
    for(const s of [-1,1])add(g,[curve([at(rows,.13,s*.7,.009),at(rows,-.167,s*.7,.009)],.0016)],GOLD);
  }
  function foot(g){
    const m=g.children[0];m.geometry.dispose();m.geometry=bake(artoriaRoundedBox(.252,.083,.110,.025),[.006,-.001,0]);m.material.color.setHex(LEATHER);
    const fabric=artoriaCloth(g,'white-scale-boots');add(fabric,[bake(artoriaRoundedBox(.260,.016,.116,.007),[.006,-.034,0])],0x222521,cloth);
    add(fabric,[curve([[.119,.009,-.040],[.131,.028,0],[.119,.009,.040]],.0015,14)],0x9a8461,cloth);
  }
  return {
    armorParts:new Set(['chest','abdomen','pelvis','uarmS','uarmO','farmS','farmO','thighF','thighB','shinF','shinB']),head:helmet,
    chest(g,look){
      const lining=artoriaCloth(g,'white-scale-neck-lining');clothNeck(lining,look);
      const collar=[[.120,.078,.105,0],[.180,.066,.078,0],[.220,.060,.068,0]];add(lining,[shell(collar)],INK,cloth);
      const rows=[[-.143,.109,.148,0],[-.070,.126,.169,0],[.038,.135,.182,-.004],[.103,.119,.165,-.004],[.147,.073,.105,0]];
      base(g,rows.map(([y,d,w,x])=>[y,d-.008,w-.008,x]));add(g,[shell(rows)],INK);lamellar(g,rows,.104,-.128,11,28,-Math.PI,Math.PI,{laces:false});
      const yoke=add(g,[shell([[.105,.120,.165,-.004],[.135,.096,.131,-.002],[.150,.073,.106,0]])],INK);add(yoke,[ring(rows,.107,-Math.PI,Math.PI,.0028,.004)],STEEL);
      const knots=[];for(const side of [-1,1])for(const a of [.65,1.1,2.1,2.5])knots.push(curve([at(rows,.106,side*a-.035,.008),at(rows,.130,side*a,.008),at(rows,.106,side*a+.035,.008)],.0022,5));add(yoke,knots,RED,cloth);
      add(g,[ring(rows,-.140,-Math.PI,Math.PI,.0035),ring(rows,.117,-Math.PI,Math.PI,.003)],GOLD);ribbon(g,rows,1);ribbon(g,rows,-1);
      for(const s of [-1,1]){
        const y=.127,pts=[];for(let i=0;i<=8;i++){const a=.17+i/8*1.0;pts.push(at(rows,y-.026*Math.sin(a),s*a,.005));}add(g,[curve(pts,.006,16)],LEATHER,cloth);
      }
    },
    abdomen(g){
      const rows=[[-.086,.103,.140,0],[.001,.102,.140,0],[.081,.111,.150,0]];base(g,rows.map(([y,d,w,x])=>[y,d-.007,w-.007,x]));add(g,[shell(rows)],INK);lamellar(g,rows,.071,-.067,7,25,-Math.PI,Math.PI,{laces:true});
    },
    pelvis(g){
      const rows=[[-.088,.113,.165,0],[.009,.110,.154,0],[.086,.104,.145,0]];base(g,rows.map(([y,d,w,x])=>[y,d-.007,w-.007,x]));add(g,[shell(rows)],INK);
      const belt=[[-.031,.124,.166,0],[.047,.117,.158,0]];add(g,[shell(belt)],LEATHER,cloth);
      add(g,[ring(belt,-.028,-Math.PI,Math.PI,.003),ring(belt,-.010,-Math.PI,Math.PI,.003),ring(belt,.044,-Math.PI,Math.PI,.003)],RED,cloth);
      add(g,[box(.010,.039,.051,[.127,.016,-.013])],GOLD);add(g,[box(.011,.024,.036,[.132,.016,-.013])],0x302a22,cloth);
      const rivets=[];for(let i=-5;i<=5;i++)if(i!==0)rivets.push(ball(.003,6,4,at(belt,.016,i*.20,.005)));add(g,rivets,GOLD);
      const layer=artoriaCloth(g,'white-scale-belt-ties');
      const band=[[-.020,.129,.170,0],[.005,.128,.168,0],[.031,.124,.164,0]];add(layer,[shell(band)],0x59473a,cloth);
      for(const y of [-.013,.0,.017,.026])add(layer,[ring(band,y,-Math.PI,Math.PI,.0014)],0x8b7360,cloth);
      const knot=[];for(const side of [-1,1])knot.push(curve([[.135,.012,0],[.149,.021,side*.027],[.145,-.004,side*.033],[.136,.007,0]],.004,18));add(layer,knot,RED,cloth);
      for(const s of [-1,1])add(layer,[curve([[.134,.012,s*.059],[.141,-.054,s*.083],[.127,-.123,s*.095]],.007,15)],RED,cloth);
    },
    uarmS:shoulder,uarmO:shoulder,farmS:bracer,farmO:bracer,thighF:thigh,thighB:thigh,shinF:shin,shinB:shin,footF:foot,footB:foot,
  };
}
