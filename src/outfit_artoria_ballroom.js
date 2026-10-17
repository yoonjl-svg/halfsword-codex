// Artoria's owner-approved ballroom counterpart. Clothes are visual surfaces:
// original body, joints, AI and the already-unarmored combat state are preserved.
export function createArtoriaBallroomOutfit(h, originalHead) {
  const {THREE,addMerged,CLOTH,bake,reshapeMain,artoriaRoundedBox,clothNeck,isoldeLock,taperedTube}=h;
  const DRESS=0x25232b,FOLD=0x3d3540,SEAM=0x66555d,BOOT=0x29272d,IVORY=0xe0d1b2;
  const GOLD=0xa8905d,THREAD=0x786849,UNDER=0x66505a;
  const fabric={...CLOTH,roughness:.78,side:THREE.DoubleSide};
  const leather={...CLOTH,roughness:.63};
  const chestRows=[[-.165,.091,.136],[-.10,.100,.146],[-.035,.118,.166],[.035,.124,.169],[.10,.111,.171],[.137,.091,.158],[.18,.045,.049]];
  const waistRows=[[-.11,.106,.154],[-.065,.096,.137],[0,.085,.120],[.055,.089,.128],[.11,.096,.141]];
  const lerp=THREE.MathUtils.lerp;
  function radii(rows,y){
    for(let i=0;i<rows.length-1;i++)if(y<=rows[i+1][0]){
      const a=rows[i],b=rows[i+1],u=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1),t=u*u*(3-2*u);
      return [lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    }
    return rows.at(-1).slice(1);
  }
  function point(rows,y,a,padding=0){
    const [rx,rz]=radii(rows,y),c=Math.cos(a),s=Math.sin(a);
    const r=1/Math.pow(Math.pow(Math.abs(c)/rx,2.35)+Math.pow(Math.abs(s)/rz,2.35),1/2.35);
    return [c*(r+padding),y,s*(r+padding)];
  }
  function surface(fn,rows=22,n=64){
    const vertices=[],uv=[],indices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
      vertices.push(...fn(j/rows,i/n*Math.PI*2));uv.push(i/n,j/rows);
      if(j<rows&&i<n){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function main(g,geo,color){
    const m=g.children[0];if(geo)reshapeMain(m,geo);
    m.material.color.setHex(color);m.material.roughness=.85;m.material.metalness=0;
    for(const extra of g.children.slice(1))extra.visible=false;
    return m;
  }
  const line=(g,pts,color=SEAM,r=.0015)=>addMerged(g,[taperedTube(pts,pts.map(()=>r),pts.length*5,5)],color,CLOTH);
  const edge=(g,fn,color,r=.0017)=>line(g,Array.from({length:65},(_,i)=>fn(i/64*Math.PI*2)),color,r);
  function chest(g,look){
    main(g,surface((t,a)=>point(chestRows,lerp(-.165,.18,t),a)),look.skin);
    clothNeck(g,look);
    carcanet(g);
    addMerged(g,[-1,1].map(s=>bake(new THREE.SphereGeometry(.048,18,12),[0,.099,s*.19],null,[1,.94,1])),look.skin,CLOTH);
    // Soft V court neckline and woven trim, inspired by Renaissance
    // formal dress; not a reconstruction of a single historical garment.
    const top=a=>Math.cos(a)>0?.005+.097*Math.pow(Math.abs(Math.sin(a)),1.1):.075;
    addMerged(g,[surface((t,a)=>point(chestRows,lerp(-.166,top(a),t),a,.003))],DRESS,fabric).name='artoria-ballroom-bodice';
    addMerged(g,[surface((t,a)=>point(chestRows,top(a)-t*.025,a,.006),4)],FOLD,fabric).name='artoria-court-neckline';
    edge(g,a=>point(chestRows,top(a),a,.008),GOLD,.0028);
    edge(g,a=>point(chestRows,top(a)-.022,a,.008),THREAD,.0016);
    // Small seed pearls follow the woven neckline. Their scale stays quiet.
    addMerged(g,Array.from({length:25},(_,i)=>{
      const a=-1.22+i/24*2.44;return bake(new THREE.SphereGeometry(.0032,8,6),point(chestRows,top(a)-.012,a,.009));
    }),IVORY,CLOTH);
    // The front stomacher narrows toward a pointed waist. Dark wine silk is
    // confined to this inset and the undergown; the main silhouette stays black.
    addMerged(g,[surface((t,a)=>{
      const angle=lerp(-.46,.46,a/(Math.PI*2)),y=lerp(-.165,top(angle)-.008,t);
      return point(chestRows,y,angle,.008);
    },14,24)],UNDER,fabric).name='artoria-court-stomacher';
    for(const side of [-1,1])line(g,Array.from({length:14},(_,i)=>point(chestRows,lerp(top(side*.46)-.008,-.165,i/13),side*.46,.01)),GOLD,.0023);
    for(const y of [-.035,-.09,-.145])ornament(g,(dy,z)=>{
      const a=Math.asin(z/.165);return point(chestRows,y+dy,a,.011);
    },.017,.019);
    // Retain her native silver side locks, including their chest continuation.
    addMerged(g,[-1,1].map(s=>isoldeLock([[.13,.15,s*.145],[.175,.06,s*.15],[.164,-.067,s*.17]],[.03,.032,.002],.012)),look.hair,CLOTH).name='artoria-hair';
  }
  // Loose court necklace: its front falls below the collarbones, leaving
  // the neck uncovered. Appearance only, with no light or armor effect.
  function carcanet(g){
    const jewel=new THREE.Group();jewel.name='artoria-court-necklace';g.add(jewel);
    const drape=a=>point(chestRows,.152-.088*Math.pow(Math.max(0,Math.cos(a)),1.3),a,.007);
    const gold={metalness:.52,roughness:.42,steel:.6};
    const pts=Array.from({length:97},(_,i)=>drape(i/96*Math.PI*2));
    addMerged(jewel,[taperedTube(pts,pts.map(()=>.0015),128,5)],0xb39761,gold);
    addMerged(jewel,[-.9,-.5,.5,.9].map(a=>bake(new THREE.SphereGeometry(.0042,10,8),drape(a))),0xe3d6ba,{...CLOTH,roughness:.48});
    const chain=Array.from({length:12},(_,i)=>point(chestRows,.064-i/11*.032,0,.008));
    addMerged(jewel,[taperedTube(chain,chain.map(()=>.0013),24,5)],0xb39761,gold);
    const center=point(chestRows,.049,0,.010);
    addMerged(jewel,[bake(new THREE.SphereGeometry(.0135,12,10),center,null,[.36,1.18,.88])],0xb39761,gold);
    addMerged(jewel,[bake(new THREE.OctahedronGeometry(.0095,1),[center[0]+.004,center[1],0],null,[.48,1.18,.87])],0x74303c,{metalness:.12,roughness:.31});
    addMerged(jewel,[bake(new THREE.SphereGeometry(.0055,12,10),point(chestRows,.029,0,.009),null,[.85,1.15,.85])],0xe3d6ba,{...CLOTH,roughness:.48});
  }
  // Four-leaf embroidery, built as thread rather than floating metal badges.
  function ornament(g,project,w,h){
    const pts=Array.from({length:33},(_,i)=>{
      const a=i/32*Math.PI*2,r=.72+.28*Math.cos(4*a);
      return project(Math.cos(a)*h*r,Math.sin(a)*w*r);
    });
    line(g,pts,THREAD,.0011);
    line(g,[project(-h*.3,0),project(h*.3,0)],GOLD,.0013);
  }
  function abdomen(g){
    main(g,surface((t,a)=>point(waistRows,lerp(-.11,.11,t),a)),DRESS);
    addMerged(g,[surface((t,a)=>{
      const y=lerp(-.11,.11,t),angle=lerp(-.26-.2*t,.26+.2*t,a/(Math.PI*2));
      return point(waistRows,y,angle,.004);
    },14,24)],UNDER,fabric);
    for(const side of [-1,1])line(g,Array.from({length:14},(_,i)=>{
      const t=i/13;return point(waistRows,-.11+t*.22,side*(.26+.2*t),.006);
    }),GOLD,.0023);
    ornament(g,(dy,z)=>point(waistRows,.015+dy,Math.asin(z/.125),.006),.019,.030);
    // A restrained V-shaped girdle separates the bodice from the full skirt.
    edge(g,a=>point(waistRows,-.092+.045*Math.abs(Math.sin(a)),a,.004),GOLD,.003);
    for(let i=0;i<4;i++)for(const side of [-1,1]){
      const y=.065-i*.033,p=point(waistRows,y,Math.PI+side*.18,.003),q=point(waistRows,y-.031,Math.PI-side*.18,.003);
      line(g,[p,q],FOLD,.0014);
    }
  }
  function pelvis(g){
    main(g,artoriaRoundedBox(.208,.18,.312,.045),DRESS);
    const at=(t,a,outer=false)=>{
      const flare=Math.pow(t,.72),fold=Math.pow(t,.8)*(.012*Math.cos(a*12+.25)+.003*Math.cos(a*19));
      // Leave enough front room for the native bent-knee guard and advancing
      // boot. The original short dress never had to enclose this leg motion.
      const rx=lerp(.103,.41+.05*Math.cos(a),flare)+.05*Math.sin(t*Math.PI)+fold+(outer?.007:0);
      const rz=lerp(.154,.399,flare)+fold+(outer?.007:0);
      // Hem clears the ground and rear foot; no long train crossing the gait.
      return [Math.cos(a)*rx,.118-.916*t+Math.pow(t,5)*.008*Math.cos(a*12),Math.sin(a)*rz];
    };
    const under=surface((t,a)=>at(t,a),28,96);
    const colors=[];
    for(let j=0;j<=28;j++)for(let i=0;i<=96;i++){
      const shade=.87+.13*Math.cos(i/96*Math.PI*24+.25);colors.push(shade,shade,shade);
    }
    under.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    addMerged(g,[under],UNDER,{...fabric,vertexColors:true}).name='artoria-ballroom-skirt';
    // Open black overskirt: a narrow opening at the waist widens over the
    // brocaded front panel. The complete undergown remains beneath it.
    const opening=t=>.12+.58*Math.pow(t,.68);
    const outerAt=(t,u)=>at(t,lerp(opening(t),Math.PI*2-opening(t),u),true);
    addMerged(g,[surface((t,a)=>outerAt(t,a/(Math.PI*2)),28,96)],DRESS,fabric).name='artoria-court-overskirt';
    for(const side of [-1,1]){
      line(g,Array.from({length:40},(_,i)=>at(i/39,side*opening(i/39),true)),GOLD,.0031);
      line(g,Array.from({length:40},(_,i)=>at(i/39,side*(opening(i/39)+.035),true)),THREAD,.0015);
    }
    line(g,Array.from({length:65},(_,i)=>outerAt(1,i/64)),GOLD,.0031);
    line(g,Array.from({length:65},(_,i)=>outerAt(.974,i/64)),THREAD,.0018);
    edge(g,a=>at(1,a),THREAD,.0022);
    // Repeating small woven motifs on the exposed silk, arranged vertically.
    // Modest contrast and spacing keep this from reading as an apron.
    for(const t of [.30,.47,.64,.81])for(const side of (t<.4?[0]:[-1,1])){
      const center=side*.22;
      ornament(g,(dy,z)=>{
        const p=at(t-dy/.916,center+z/.28);p[0]+=.003;return p;
      },.020,.026);
    }
    // The long pointed waist sits over the skirt, completing the court bodice.
    const waistPoint=(t,u)=>{
      const y=.131-.084*t,z=(u*2-1)*.042*(1-t),st=Math.max(0,(.118-y)/.916);
      const angle=Math.asin(z/lerp(.154,.399,Math.pow(st,.72))),p=at(st,angle);
      return [p[0]+.011,y,z];
    };
    addMerged(g,[surface((t,a)=>waistPoint(t,a/(Math.PI*2)),8,20)],UNDER,fabric);
    for(const side of [0,1])line(g,Array.from({length:12},(_,i)=>waistPoint(i/11,side)),GOLD,.0021);
  }

  function limb(g,look,upper=false,forearm=false){
    const old=g.children[0].geometry.parameters,{radius,height}=old;
    const geo=new THREE.CapsuleGeometry(radius,height+.014,8,24),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=THREE.MathUtils.clamp((p.getY(i)+height/2+radius)/(height+radius*2),0,1);
      const k=upper?lerp(.79,.98,t):lerp(.82,.96,t);
      p.setXYZ(i,p.getX(i)*k,p.getY(i),p.getZ(i)*k);
    }
    geo.computeVertexNormals();reshapeMain(g.children[0],geo);
    g.children[0].material.color.setHex(look.skin);g.children[0].material.metalness=0;
    if(forearm){
      for(const m of g.children.slice(1))if(m.material)m.material.color.setHex(look.skin);
      // Fitted forearm sleeves, gathered into a small ivory wrist ruffle.
      const sleeve=surface((t,a)=>{
        const r=lerp(.044,.055,t);return [Math.cos(a)*r,-.104+t*.278,Math.sin(a)*r];
      },10,32);
      addMerged(g,[sleeve],DRESS,fabric).name='artoria-court-lower-sleeve';
      const cuff=surface((t,a)=>{
        const r=.045+.014*t+.004*t*Math.cos(a*12);return [Math.cos(a)*r,-.097-.041*t,Math.sin(a)*r];
      },5,48);
      addMerged(g,[cuff],IVORY,fabric);
      edge(g,a=>[Math.cos(a)*.048,-.098,Math.sin(a)*.048],GOLD,.0021);
    }
    if(upper){
      // Owner rejected puff volume: follow the arm with a narrow sleeve, no
      // gathered shoulder or horizontal band that broadens the silhouette.
      const at=(t,a)=>{
        const r=.047+.008*Math.sin(t*Math.PI);
        return [Math.cos(a)*r,.157-t*.33,Math.sin(a)*r];
      };
      // Use the sleeve as this limb's visible surface. Keeping a second skin
      // capsule immediately beneath it causes jagged intersections at the cuff.
      const sleeve=main(g,surface(at,14,40),DRESS);
      sleeve.material.side=THREE.DoubleSide;sleeve.name='artoria-court-fitted-sleeve';
      line(g,Array.from({length:17},(_,i)=>{
        const p=at(i/16,Math.PI);p[0]-=.0015;return p;
      }),THREAD,.0013);
    }
  }

  function boot(g){
    const rows=[[-.229,.042,.044],[-.15,.047,.048],[-.04,.064,.060],[.10,.062,.058],[.205,.066,.061],[.285,.071,.065]];
    main(g,surface((t,a)=>point(rows,lerp(-.229,.285,t),a),22,48),BOOT);
    const cuff=addMerged(g,[surface((t,a)=>point(rows,.285-t*.029,a,.003),3,48)],FOLD,leather);cuff.name='artoria-knee-boot';
    edge(g,a=>point(rows,.285,a,.004),0x62545b,.0016);
    line(g,Array.from({length:18},(_,i)=>point(rows,-.217+i/17*.485,Math.PI,.002)),FOLD,.0013);
    // Soft ankle creases make the shafts read as leather rather than shin plates.
    for(const y of [-.167,-.186])line(g,Array.from({length:9},(_,i)=>point(rows,y+.004*Math.cos(i/8*Math.PI),-.95+i/8*1.9,.002)),FOLD,.0012);
  }
  function foot(g){
    const geo=artoriaRoundedBox(.264,.078,.115,.027),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const toe=THREE.MathUtils.smoothstep(p.getX(i),.01,.132);
      p.setXYZ(i,p.getX(i)+toe*.014,p.getY(i)*(1-toe*.28),p.getZ(i)*(1-toe*.16));
    }
    geo.computeVertexNormals();main(g,geo,BOOT);g.children[0].material.roughness=.63;
    addMerged(g,[bake(artoriaRoundedBox(.255,.012,.112,.005),[.005,-.035,0]),
      bake(artoriaRoundedBox(.055,.023,.082,.008),[-.081,-.038,0])],0x19191e,leather);
  }
  function bow(g){
    const holder=new THREE.Group();holder.name='artoria-ivory-bow';holder.position.set(-.14,-.045,0);g.add(holder);
    for(const s of [-1,1]){
      // Wide folded wings sit behind the nape, not above the head like ears.
      const verts=[],idx=[],n=32,rows=8;
      const at=(t,v)=>[-.008-.021*Math.sin(t*Math.PI)*(1-v*v),
        .009*Math.sin(t*Math.PI)+v*(.013+.040*Math.sin(t*Math.PI*.83)),s*(.013+t*.15)];
      for(let i=0;i<=n;i++)for(let j=0;j<=rows;j++){
        verts.push(...at(i/n,j/rows*2-1));
        if(i<n&&j<rows){const k=i*(rows+1)+j;idx.push(k,k+rows+1,k+1,k+1,k+rows+1,k+rows+2)}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
      addMerged(holder,[geo],IVORY,fabric);
      for(const side of [-1,1])line(holder,Array.from({length:17},(_,i)=>at(i/16,side)),0xc4b395,.0012);
      line(holder,Array.from({length:13},(_,i)=>at(i/12*.76,0)),0xcfc0a2,.001);
      const tail=[[-.006,-.009,s*.02],[-.015,-.062,s*.052],[-.005,-.133,s*.073],[-.017,-.167,s*.085]];
      addMerged(holder,[isoldeLock(tail,[.036,.041,.038,.029],.0025)],IVORY,fabric);
      line(holder,tail.map(([x,y,z])=>[x-.002,y,z+s*.013]),0xb4a48b,.0013);
    }
    addMerged(holder,[bake(new THREE.SphereGeometry(.026,14,10),[0,0,0],null,[.58,1,.85])],0xc5b493,fabric);
  }
  return {
    head(g,look){originalHead(g,look);bow(g)},chest,abdomen,pelvis,
    uarmS(g,l){limb(g,l,true)},uarmO(g,l){limb(g,l,true)},
    farmS(g,l){limb(g,l,false,true)},farmO(g,l){limb(g,l,false,true)},
    thighF(g,l){limb(g,l)},thighB(g,l){limb(g,l)},shinF:boot,shinB:boot,footF:foot,footB:foot,
  };
}
